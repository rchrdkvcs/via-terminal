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
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

pub struct BackendState {
    pub domain: DomainService,
    pub sessions: Arc<SessionManager>,
    locked: AtomicBool,
    pin_hash: Mutex<Option<String>>,
}
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: Uuid,
    data_base64: String,
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
    let result = state.sessions.spawn(
        &profile.executable,
        &profile.args,
        profile.working_directory.as_deref(),
        cols,
        rows,
        move |id, bytes| {
            let _ = app.emit(
                "terminal-output",
                TerminalOutput {
                    session_id: id,
                    data_base64: BASE64.encode(bytes),
                },
            );
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
            let domain = DomainService::new(repo);
            let pin_hash = domain.pin_hash().map_err(std::io::Error::other)?;
            app.manage(BackendState {
                domain,
                sessions: Arc::new(SessionManager::default()),
                locked: AtomicBool::new(pin_hash.is_some()),
                pin_hash: Mutex::new(pin_hash),
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
            app_is_locked,
            pin_configure,
            app_unlock
        ])
        .run(tauri::generate_context!())
        .expect("error while running Terminarr")
}
