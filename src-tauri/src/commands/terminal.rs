use crate::{pty, ssh, BackendState};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{Emitter, State};
use uuid::Uuid;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: Uuid,
    data_base64: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionExited {
    session_id: Uuid,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SshStateChanged {
    session_id: Uuid,
    status: ssh::SshStatus,
    attempt: u8,
    replacement_session_id: Option<Uuid>,
}

#[derive(Clone)]
struct SshConnectionSpec {
    executable: String,
    args: Vec<String>,
    cols: u16,
    rows: u16,
}

#[tauri::command]
pub(crate) fn profile_detect() -> Vec<String> {
    let mut shells: Vec<String> = if cfg!(windows) {
        vec!["powershell.exe", "pwsh.exe", "cmd.exe", "wsl.exe"]
    } else {
        vec!["/bin/zsh", "/bin/bash", "/bin/sh"]
    }
    .into_iter()
    .filter(|c| command_exists(c))
    .map(str::to_string)
    .collect();
    if cfg!(windows) {
        const GIT_BASH: &[&str] = &[
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files\Git\usr\bin\bash.exe",
        ];
        if let Some(path) = GIT_BASH.iter().copied().find(|path| command_exists(path)) {
            shells.push(path.to_string());
        } else if command_exists("bash.exe") {
            shells.push("bash.exe".into());
        }
    } else {
        for name in ["zsh", "bash", "fish", "pwsh"] {
            if !command_exists(name) {
                continue;
            }
            let already_present = shells.iter().any(|existing| {
                std::path::Path::new(existing)
                    .file_name()
                    .and_then(|value| value.to_str())
                    == Some(name)
            });
            if !already_present {
                shells.push(name.to_string());
            }
        }
    }
    shells
}
fn command_exists(command: &str) -> bool {
    if std::path::Path::new(command).is_absolute() {
        return std::path::Path::new(command).exists();
    }
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|p| p.join(command).exists()))
        .unwrap_or(false)
}
#[tauri::command]
pub(crate) fn ssh_config_list() -> Result<Vec<ssh::SshTarget>, String> {
    let path = dirs::home_dir()
        .ok_or("home directory unavailable")?
        .join(".ssh/config");
    if !path.exists() {
        return Ok(vec![]);
    }
    ssh::load_config(&path)
}

fn ssh_executable() -> Result<String, String> {
    let candidate = if cfg!(windows) { "ssh.exe" } else { "ssh" };
    command_exists(candidate)
        .then(|| candidate.to_string())
        .ok_or_else(|| "OpenSSH was not found on PATH".into())
}

fn ssh_spec(
    state: &BackendState,
    workspace_id: Uuid,
    resource_id: Uuid,
    identity_id: Uuid,
    cols: u16,
    rows: u16,
) -> Result<(SshConnectionSpec, ssh::ResolvedSshTarget), String> {
    if cols == 0 || rows == 0 || cols > 1000 || rows > 1000 {
        return Err("invalid terminal dimensions".into());
    }
    let data = state.domain.snapshot()?;
    let resource = data
        .resources
        .iter()
        .find(|item| item.id == resource_id && item.workspace_id == workspace_id)
        .ok_or("resource does not belong to workspace")?;
    let identity = data
        .identities
        .iter()
        .find(|item| item.id == identity_id && item.workspace_id == workspace_id)
        .ok_or("identity does not belong to workspace")?;
    if resource.identity_id != Some(identity.id) {
        return Err("resource is not associated with this identity".into());
    }
    let destination = resource
        .ssh_alias
        .as_deref()
        .or(resource.host.as_deref())
        .ok_or("resource has no SSH destination")?;
    let executable = ssh_executable()?;
    let args = ssh::connection_args(
        destination,
        Some(&identity.username),
        resource.port,
        identity.identity_file.as_deref(),
    )?;
    let resolved = ssh::resolve_with_openssh(
        &executable,
        destination,
        Some(&identity.username),
        resource.port,
        identity.identity_file.as_deref(),
    )?;
    Ok((
        SshConnectionSpec {
            executable,
            args,
            cols,
            rows,
        },
        resolved,
    ))
}

fn spawn_ssh_attempt(
    app: tauri::AppHandle,
    sessions: Arc<pty::SessionManager>,
    statuses: Arc<Mutex<HashMap<Uuid, ssh::SshStatus>>>,
    spec: SshConnectionSpec,
    attempt: u8,
) -> Result<pty::SpawnedSession, String> {
    let output_app = app.clone();
    let exit_app = app.clone();
    let exit_sessions = sessions.clone();
    let exit_statuses = statuses.clone();
    let exit_spec = spec.clone();
    let spawned = sessions.spawn_with_exit(
        &spec.executable,
        &spec.args,
        None,
        spec.cols,
        spec.rows,
        move |id, bytes| {
            let _ = output_app.emit(
                "terminal-output",
                TerminalOutput {
                    session_id: id,
                    data_base64: BASE64.encode(bytes),
                },
            );
        },
        move |id| {
            let closed = exit_statuses
                .lock()
                .map(|map| map.get(&id) == Some(&ssh::SshStatus::Closed))
                .unwrap_or(true);
            if closed {
                return;
            }
            if let Ok(mut map) = exit_statuses.lock() {
                map.insert(id, ssh::SshStatus::Disconnected);
            }
            let _ = exit_app.emit(
                "ssh-state-changed",
                SshStateChanged {
                    session_id: id,
                    status: ssh::SshStatus::Disconnected,
                    attempt,
                    replacement_session_id: None,
                },
            );
            let policy = ssh::ReconnectPolicy::default();
            let Some(delay) = policy.delay(attempt) else {
                if let Ok(mut map) = exit_statuses.lock() {
                    map.insert(id, ssh::SshStatus::Failed);
                }
                let _ = exit_app.emit(
                    "ssh-state-changed",
                    SshStateChanged {
                        session_id: id,
                        status: ssh::SshStatus::Failed,
                        attempt,
                        replacement_session_id: None,
                    },
                );
                return;
            };
            std::thread::sleep(Duration::from_millis(delay));
            if let Ok(mut map) = exit_statuses.lock() {
                map.insert(id, ssh::SshStatus::Reconnecting);
            }
            let _ = exit_app.emit(
                "ssh-state-changed",
                SshStateChanged {
                    session_id: id,
                    status: ssh::SshStatus::Reconnecting,
                    attempt: attempt + 1,
                    replacement_session_id: None,
                },
            );
            match spawn_ssh_attempt(
                exit_app.clone(),
                exit_sessions,
                exit_statuses.clone(),
                exit_spec,
                attempt + 1,
            ) {
                Ok(next) => {
                    let _ = exit_app.emit(
                        "ssh-state-changed",
                        SshStateChanged {
                            session_id: id,
                            status: ssh::SshStatus::Connected,
                            attempt: attempt + 1,
                            replacement_session_id: Some(next.id),
                        },
                    );
                }
                Err(_) => {
                    if let Ok(mut map) = exit_statuses.lock() {
                        map.insert(id, ssh::SshStatus::Failed);
                    }
                }
            }
        },
    )?;
    statuses
        .lock()
        .map_err(|_| "SSH state unavailable")?
        .insert(spawned.id, ssh::SshStatus::Connected);
    Ok(spawned)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SshConnectionResult {
    session_id: Uuid,
    resolved: ssh::ResolvedSshTarget,
}

#[tauri::command]
pub(crate) fn ssh_session_connect(
    app: tauri::AppHandle,
    state: State<BackendState>,
    workspace_id: Uuid,
    resource_id: Uuid,
    identity_id: Uuid,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<SshConnectionResult, String> {
    let (spec, resolved) = ssh_spec(
        &state,
        workspace_id,
        resource_id,
        identity_id,
        cols.unwrap_or(80),
        rows.unwrap_or(24),
    )?;
    let spawned = spawn_ssh_attempt(
        app.clone(),
        state.sessions.clone(),
        state.ssh_statuses.clone(),
        spec,
        0,
    )?;
    app.emit(
        "ssh-state-changed",
        SshStateChanged {
            session_id: spawned.id,
            status: ssh::SshStatus::Connected,
            attempt: 0,
            replacement_session_id: None,
        },
    )
    .map_err(|e| e.to_string())?;
    Ok(SshConnectionResult {
        session_id: spawned.id,
        resolved,
    })
}

#[tauri::command]
pub(crate) fn ssh_session_status(
    state: State<BackendState>,
    id: Uuid,
) -> Result<ssh::SshStatus, String> {
    state
        .ssh_statuses
        .lock()
        .map_err(|_| "SSH state unavailable".to_string())?
        .get(&id)
        .copied()
        .ok_or("SSH session not found".into())
}
#[tauri::command]
pub(crate) fn session_spawn(
    app: tauri::AppHandle,
    state: State<BackendState>,
    workspace_id: Uuid,
    profile_id: Uuid,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<pty::SpawnedSession, String> {
    let profile = state.domain.local_profile(workspace_id, profile_id)?;
    if profile.executable.trim().is_empty() || profile.executable.contains('\0') {
        return Err("invalid profile executable".into());
    }
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);
    if cols == 0 || rows == 0 || cols > 1000 || rows > 1000 {
        return Err("invalid terminal dimensions".into());
    }
    let output_app = app.clone();
    let result = state.sessions.spawn_with_exit(
        &profile.executable,
        &profile.args,
        profile.working_directory.as_deref(),
        cols,
        rows,
        move |id, bytes| {
            let _ = output_app.emit(
                "terminal-output",
                TerminalOutput {
                    session_id: id,
                    data_base64: BASE64.encode(bytes),
                },
            );
        },
        // Without this the webview cannot tell a finished shell from a silent
        // one, so a closed tab looked identical to a live session.
        move |id| {
            let _ = app.emit("session-exited", SessionExited { session_id: id });
        },
    )?;
    Ok(result)
}
#[tauri::command]
pub(crate) fn session_write(
    state: State<BackendState>,
    id: Uuid,
    data: String,
) -> Result<(), String> {
    state.sessions.write(id, data.as_bytes())
}
#[tauri::command]
pub(crate) fn session_resize(
    state: State<BackendState>,
    id: Uuid,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.sessions.resize(id, cols, rows)
}
#[tauri::command]
pub(crate) fn session_close(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    if let Ok(mut statuses) = state.ssh_statuses.lock() {
        if statuses.contains_key(&id) {
            statuses.insert(id, ssh::SshStatus::Closed);
        }
    }
    state.sessions.close(id)
}
