pub mod domain;
pub mod pty;
pub mod repository;
pub mod service;
pub mod ssh;
use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use domain::*;
use pty::SessionManager;
use rand_core::OsRng;
use repository::Repository;
use service::DomainService;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::{collections::HashMap, time::Duration};
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

pub struct BackendState {
    pub domain: DomainService,
    pub sessions: Arc<SessionManager>,
    locked: AtomicBool,
    pin_hash: Mutex<Option<String>>,
    ssh_statuses: Arc<Mutex<HashMap<Uuid, ssh::SshStatus>>>,
}
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

impl BackendState {
    fn require_unlocked(&self) -> Result<(), String> {
        if self.locked.load(Ordering::SeqCst) {
            Err("application is locked".into())
        } else {
            Ok(())
        }
    }
}

#[tauri::command]
fn app_snapshot(state: State<BackendState>) -> Result<AppData, String> {
    state.domain.snapshot()
}
#[tauri::command]
fn tab_save(
    state: State<BackendState>,
    tab: Tab,
    sessions: Vec<SavedSession>,
) -> Result<Tab, String> {
    state.require_unlocked()?;
    state.domain.save_tab(tab, sessions)
}
#[tauri::command]
fn window_state_save(
    state: State<BackendState>,
    window: WindowState,
) -> Result<WindowState, String> {
    state.require_unlocked()?;
    state.domain.save_window_state(window)
}
#[tauri::command]
fn app_recovery_state(state: State<BackendState>) -> Result<AppState, String> {
    state.domain.recovery_state()
}
#[tauri::command]
fn app_recovery_finish(state: State<BackendState>) -> Result<(), String> {
    state.domain.finish_recovery()
}
#[tauri::command]
fn app_mark_clean_shutdown(state: State<BackendState>) -> Result<(), String> {
    state.domain.mark_clean_shutdown()
}
#[tauri::command]
fn workspace_list(state: State<BackendState>) -> Result<Vec<Workspace>, String> {
    Ok(state.domain.snapshot()?.workspaces)
}
#[tauri::command]
fn workspace_create(
    state: State<BackendState>,
    name: String,
    icon: Option<String>,
    color: Option<String>,
    default_shell: Option<String>,
) -> Result<Workspace, String> {
    state.domain.create_workspace(
        name,
        icon.unwrap_or_else(|| "terminal".into()),
        color.unwrap_or_else(|| "#7c6ef6".into()),
        default_shell,
    )
}
#[tauri::command]
fn split_group_save(state: State<BackendState>, group: SplitGroup) -> Result<SplitGroup, String> {
    state.require_unlocked()?;
    state.domain.save_split_group(group)
}
#[tauri::command]
fn split_group_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    state.require_unlocked()?;
    state.domain.delete_split_group(id)
}
#[tauri::command]
fn workspace_move(
    state: State<BackendState>,
    id: Uuid,
    before_id: Option<Uuid>,
) -> Result<Workspace, String> {
    state.require_unlocked()?;
    state.domain.move_workspace(id, before_id)
}
#[tauri::command]
fn workspace_update(
    state: State<BackendState>,
    id: Uuid,
    name: String,
    icon: String,
    default_shell: Option<String>,
) -> Result<Workspace, String> {
    state.require_unlocked()?;
    state.domain.update_workspace(id, name, icon, default_shell)
}
#[tauri::command]
fn workspace_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    state.require_unlocked()?;
    state.domain.delete_workspace(id)
}
#[tauri::command]
fn identity_create(
    state: State<BackendState>,
    workspace_id: Uuid,
    name: String,
    username: String,
    identity_file: Option<String>,
) -> Result<Identity, String> {
    state
        .domain
        .create_identity(workspace_id, name, username, identity_file)
}
#[tauri::command]
fn resource_create(
    state: State<BackendState>,
    workspace_id: Uuid,
    name: String,
    host: Option<String>,
    ssh_alias: Option<String>,
    port: Option<u16>,
    identity_id: Option<Uuid>,
) -> Result<Resource, String> {
    state
        .domain
        .create_resource(workspace_id, name, host, ssh_alias, port, identity_id)
}
#[tauri::command]
fn settings_get(state: State<BackendState>) -> Result<Settings, String> {
    Ok(state.domain.snapshot()?.settings)
}
#[tauri::command]
fn settings_update(state: State<BackendState>, settings: Settings) -> Result<Settings, String> {
    state.domain.update_settings(settings)
}
#[tauri::command]
fn export_create(state: State<BackendState>, path: Option<String>) -> Result<String, String> {
    let json = state.domain.export_json()?;
    if let Some(path) = path {
        state.domain.export_file(std::path::Path::new(&path))?
    }
    Ok(json)
}
#[tauri::command]
fn import_validate(json: String) -> Result<AppData, String> {
    let data: AppData = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    data.validate()?;
    Ok(data)
}
#[tauri::command]
fn import_apply(state: State<BackendState>, json: String) -> Result<AppData, String> {
    state.domain.import_json(&json)
}
#[tauri::command]
fn profile_detect() -> Vec<String> {
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
fn ssh_config_list() -> Result<Vec<ssh::SshTarget>, String> {
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
    sessions: Arc<SessionManager>,
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
struct SshConnectionResult {
    session_id: Uuid,
    resolved: ssh::ResolvedSshTarget,
}

#[tauri::command]
fn ssh_session_connect(
    app: tauri::AppHandle,
    state: State<BackendState>,
    workspace_id: Uuid,
    resource_id: Uuid,
    identity_id: Uuid,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<SshConnectionResult, String> {
    state.require_unlocked()?;
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
fn ssh_session_status(state: State<BackendState>, id: Uuid) -> Result<ssh::SshStatus, String> {
    state
        .ssh_statuses
        .lock()
        .map_err(|_| "SSH state unavailable".to_string())?
        .get(&id)
        .copied()
        .ok_or("SSH session not found".into())
}
#[tauri::command]
fn session_spawn(
    app: tauri::AppHandle,
    state: State<BackendState>,
    workspace_id: Uuid,
    profile_id: Uuid,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<pty::SpawnedSession, String> {
    state.require_unlocked()?;
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
fn session_write(state: State<BackendState>, id: Uuid, data: String) -> Result<(), String> {
    state.require_unlocked()?;
    state.sessions.write(id, data.as_bytes())
}
#[tauri::command]
fn session_resize(
    state: State<BackendState>,
    id: Uuid,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.require_unlocked()?;
    state.sessions.resize(id, cols, rows)
}
#[tauri::command]
fn session_close(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    if let Ok(mut statuses) = state.ssh_statuses.lock() {
        if statuses.contains_key(&id) {
            statuses.insert(id, ssh::SshStatus::Closed);
        }
    }
    state.sessions.close(id)
}

#[tauri::command]
fn profile_create(
    state: State<BackendState>,
    workspace_id: Uuid,
    name: String,
    executable: String,
    args: Option<Vec<String>>,
    working_directory: Option<String>,
) -> Result<LocalProfile, String> {
    state.require_unlocked()?;
    state.domain.create_profile(
        workspace_id,
        name,
        executable,
        args.unwrap_or_default(),
        working_directory,
    )
}
#[tauri::command]
fn sidebar_node_create(
    state: State<BackendState>,
    workspace_id: Uuid,
    kind: String,
    label: String,
    parent_id: Option<Uuid>,
    target_id: Option<Uuid>,
) -> Result<SidebarNode, String> {
    state.require_unlocked()?;
    state
        .domain
        .create_sidebar_node(workspace_id, kind, label, parent_id, target_id)
}
#[tauri::command]
fn sidebar_node_rename(
    state: State<BackendState>,
    id: Uuid,
    label: String,
) -> Result<SidebarNode, String> {
    state.require_unlocked()?;
    state.domain.rename_sidebar_node(id, label)
}
#[tauri::command]
fn sidebar_node_move(
    state: State<BackendState>,
    id: Uuid,
    parent_id: Option<Uuid>,
    position: i64,
) -> Result<SidebarNode, String> {
    state.require_unlocked()?;
    state.domain.move_sidebar_node(id, parent_id, position)
}
#[tauri::command]
fn sidebar_root_order_save(
    state: State<BackendState>,
    workspace_id: Uuid,
    ids: Vec<Uuid>,
) -> Result<(), String> {
    state.require_unlocked()?;
    state.domain.save_sidebar_root_order(workspace_id, ids)
}
#[tauri::command]
fn sidebar_node_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    state.require_unlocked()?;
    state.domain.delete_sidebar_node(id)
}
#[tauri::command]
fn favorite_set(
    state: State<BackendState>,
    workspace_id: Uuid,
    target_kind: String,
    target_id: Uuid,
    pinned: bool,
) -> Result<(), String> {
    state.require_unlocked()?;
    state
        .domain
        .set_favorite(workspace_id, target_kind, target_id, pinned)
}
#[tauri::command]
fn favorite_move(state: State<BackendState>, id: Uuid, position: i64) -> Result<(), String> {
    state.require_unlocked()?;
    state.domain.move_favorite(id, position)
}
#[tauri::command]
fn tab_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    state.require_unlocked()?;
    state.domain.delete_tab(id)
}
#[tauri::command]
fn window_create(app: tauri::AppHandle) -> Result<(), String> {
    let label = format!("window-{}", Uuid::new_v4());
    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App("index.html".into()))
        .title("via terminal")
        .inner_size(1100.0, 720.0)
        // The native drop target of the webview swallows every HTML5 drag
        // event, which stops the sidebar drag and drop. Windows created here do
        // not inherit `dragDropEnabled` from tauri.conf.json, so set it again.
        .disable_drag_drop_handler()
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn app_lock(app: tauri::AppHandle, state: State<BackendState>) -> Result<(), String> {
    state.locked.store(true, Ordering::SeqCst);
    app.emit("app-lock-changed", true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn app_is_locked(state: State<BackendState>) -> bool {
    state.locked.load(Ordering::SeqCst)
}

#[tauri::command]
fn pin_configure(state: State<BackendState>, pin: String) -> Result<(), String> {
    state.require_unlocked()?;
    if pin.len() < 4 || pin.len() > 128 {
        return Err("PIN must contain between 4 and 128 characters".into());
    }
    let salt = SaltString::generate(&mut OsRng);
    let encoded = Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map_err(|_| "could not protect PIN".to_string())?
        .to_string();
    state.domain.set_pin_hash(&encoded)?;
    *state.pin_hash.lock().map_err(|_| "PIN state unavailable")? = Some(encoded);
    Ok(())
}

#[tauri::command]
fn app_unlock(
    app: tauri::AppHandle,
    state: State<BackendState>,
    pin: Option<String>,
) -> Result<(), String> {
    let stored = state
        .pin_hash
        .lock()
        .map_err(|_| "PIN state unavailable")?
        .clone();
    if let Some(encoded) = stored {
        let supplied = pin.ok_or("PIN required")?;
        let hash = PasswordHash::new(&encoded).map_err(|_| "PIN state invalid")?;
        Argon2::default()
            .verify_password(supplied.as_bytes(), &hash)
            .map_err(|_| "invalid PIN")?;
    }
    state.locked.store(false, Ordering::SeqCst);
    app.emit("app-lock-changed", false)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let repo = Repository::open(data_dir.join("via-terminal.sqlite"))
                .map_err(std::io::Error::other)?;
            let domain = DomainService::new(repo);
            domain.begin_run().map_err(std::io::Error::other)?;
            let pin_hash = domain.pin_hash().map_err(std::io::Error::other)?;
            app.manage(BackendState {
                domain,
                sessions: Arc::new(SessionManager::default()),
                locked: AtomicBool::new(pin_hash.is_some()),
                pin_hash: Mutex::new(pin_hash),
                ssh_statuses: Arc::new(Mutex::new(HashMap::new())),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_snapshot,
            tab_save,
            split_group_save,
            split_group_delete,
            window_state_save,
            app_recovery_state,
            app_recovery_finish,
            app_mark_clean_shutdown,
            workspace_list,
            workspace_create,
            workspace_move,
            workspace_update,
            workspace_delete,
            identity_create,
            resource_create,
            profile_create,
            sidebar_node_create,
            sidebar_node_rename,
            sidebar_node_move,
            sidebar_root_order_save,
            sidebar_node_delete,
            favorite_set,
            favorite_move,
            tab_delete,
            settings_get,
            settings_update,
            export_create,
            import_validate,
            import_apply,
            profile_detect,
            ssh_config_list,
            ssh_session_connect,
            ssh_session_status,
            session_spawn,
            session_write,
            session_resize,
            session_close,
            window_create,
            app_lock,
            app_is_locked,
            pin_configure,
            app_unlock
        ])
        .build(tauri::generate_context!())
        .expect("error while building via terminal");
    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            let state = app_handle.state::<BackendState>();
            let _ = state.domain.mark_clean_shutdown();
        }
    });
}
