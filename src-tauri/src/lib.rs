pub mod domain;
pub mod pty;
pub mod repository;
pub mod service;
pub mod ssh;
use domain::*;
use pty::SessionManager;
use repository::Repository;
use service::DomainService;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

pub struct BackendState {
    pub domain: DomainService,
    pub sessions: Arc<SessionManager>,
}
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: Uuid,
    data: String,
}

#[tauri::command]
fn app_snapshot(state: State<BackendState>) -> Result<AppData, String> {
    state.domain.snapshot()
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
) -> Result<Workspace, String> {
    state.domain.create_workspace(
        name,
        icon.unwrap_or_else(|| "terminal".into()),
        color.unwrap_or_else(|| "#7c6ef6".into()),
    )
}
#[tauri::command]
fn workspace_duplicate(
    state: State<BackendState>,
    id: Uuid,
    name: String,
) -> Result<Workspace, String> {
    state.domain.duplicate_workspace(id, name)
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
    let candidates = if cfg!(windows) {
        vec!["powershell.exe", "pwsh.exe", "cmd.exe", "wsl.exe"]
    } else {
        vec!["/bin/zsh", "/bin/bash", "/bin/sh"]
    };
    candidates
        .into_iter()
        .filter(|c| command_exists(c))
        .map(str::to_string)
        .collect()
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
#[tauri::command]
fn session_spawn(
    app: tauri::AppHandle,
    state: State<BackendState>,
    executable: String,
    args: Vec<String>,
    working_directory: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<pty::SpawnedSession, String> {
    let result = state.sessions.spawn(
        &executable,
        &args,
        working_directory.as_deref(),
        cols.unwrap_or(80),
        rows.unwrap_or(24),
        move |id, bytes| {
            let _ = app.emit(
                "terminal-output",
                TerminalOutput {
                    session_id: id,
                    data: String::from_utf8_lossy(&bytes).into_owned(),
                },
            );
        },
    )?;
    Ok(result)
}
#[tauri::command]
fn session_write(state: State<BackendState>, id: Uuid, data: String) -> Result<(), String> {
    state.sessions.write(id, data.as_bytes())
}
#[tauri::command]
fn session_resize(
    state: State<BackendState>,
    id: Uuid,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.sessions.resize(id, cols, rows)
}
#[tauri::command]
fn session_close(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    state.sessions.close(id)
}

#[tauri::command]
fn window_create(app: tauri::AppHandle) -> Result<(), String> {
    let label = format!("window-{}", Uuid::new_v4());
    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App("index.html".into()))
        .title("Terminarr")
        .inner_size(1100.0, 720.0)
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn app_lock(app: tauri::AppHandle) -> Result<(), String> {
    app.emit("app-lock-changed", true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn app_unlock(app: tauri::AppHandle) -> Result<(), String> {
    app.emit("app-lock-changed", false)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let repo = Repository::open(data_dir.join("terminarr.sqlite"))
                .map_err(std::io::Error::other)?;
            app.manage(BackendState {
                domain: DomainService::new(repo),
                sessions: Arc::new(SessionManager::default()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_snapshot,
            workspace_list,
            workspace_create,
            workspace_duplicate,
            identity_create,
            resource_create,
            settings_get,
            settings_update,
            export_create,
            import_validate,
            import_apply,
            profile_detect,
            ssh_config_list,
            session_spawn,
            session_write,
            session_resize,
            session_close,
            window_create,
            app_lock,
            app_unlock
        ])
        .run(tauri::generate_context!())
        .expect("error while running Terminarr")
}
