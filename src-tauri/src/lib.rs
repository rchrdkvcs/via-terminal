mod commands;
pub mod domain;
pub mod pty;
pub mod repository;
pub mod service;
pub mod ssh;
use domain::*;
use pty::SessionManager;
use repository::Repository;
use service::DomainService;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use uuid::Uuid;

pub struct BackendState {
    pub domain: DomainService,
    pub sessions: Arc<SessionManager>,
    ssh_statuses: Arc<Mutex<HashMap<Uuid, ssh::SshStatus>>>,
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
    state.domain.save_tab(tab, sessions)
}
#[tauri::command]
fn window_state_save(
    state: State<BackendState>,
    window: WindowState,
) -> Result<WindowState, String> {
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
    state.domain.save_split_group(group)
}
#[tauri::command]
fn split_group_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    state.domain.delete_split_group(id)
}
#[tauri::command]
fn workspace_move(
    state: State<BackendState>,
    id: Uuid,
    before_id: Option<Uuid>,
) -> Result<Workspace, String> {
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
    state.domain.update_workspace(id, name, icon, default_shell)
}
#[tauri::command]
fn workspace_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
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
fn ssh_host_save(state: State<BackendState>, input: SshHostInput) -> Result<Resource, String> {
    state.domain.save_ssh_host(input)
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
fn profile_create(
    state: State<BackendState>,
    workspace_id: Uuid,
    name: String,
    executable: String,
    args: Option<Vec<String>>,
    working_directory: Option<String>,
) -> Result<LocalProfile, String> {
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
    state.domain.rename_sidebar_node(id, label)
}
#[tauri::command]
fn sidebar_node_move(
    state: State<BackendState>,
    id: Uuid,
    parent_id: Option<Uuid>,
    position: i64,
) -> Result<SidebarNode, String> {
    state.domain.move_sidebar_node(id, parent_id, position)
}
#[tauri::command]
fn sidebar_root_order_save(
    state: State<BackendState>,
    workspace_id: Uuid,
    ids: Vec<Uuid>,
) -> Result<(), String> {
    state.domain.save_sidebar_root_order(workspace_id, ids)
}
#[tauri::command]
fn sidebar_node_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
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
    state
        .domain
        .set_favorite(workspace_id, target_kind, target_id, pinned)
}
#[tauri::command]
fn favorite_move(state: State<BackendState>, id: Uuid, position: i64) -> Result<(), String> {
    state.domain.move_favorite(id, position)
}
#[tauri::command]
fn tab_delete(state: State<BackendState>, id: Uuid) -> Result<(), String> {
    state.domain.delete_tab(id)
}
#[tauri::command]
fn window_create(app: tauri::AppHandle) -> Result<(), String> {
    let label = format!("window-{}", Uuid::new_v4());
    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App("index.html".into()))
        .title("Via")
        .inner_size(1100.0, 720.0)
        // The native drop target of the webview swallows every HTML5 drag
        // event, which stops the sidebar drag and drop. Windows created here do
        // not inherit `dragDropEnabled` from tauri.conf.json, so set it again.
        .disable_drag_drop_handler()
        .build()
        .map(|_| ())
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
            app.manage(BackendState {
                domain,
                sessions: Arc::new(SessionManager::default()),
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
            ssh_host_save,
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
            commands::terminal::profile_detect,
            commands::terminal::ssh_config_list,
            commands::terminal::ssh_session_connect,
            commands::terminal::ssh_session_status,
            commands::terminal::session_spawn,
            commands::terminal::session_write,
            commands::terminal::session_resize,
            commands::terminal::session_close,
            window_create
        ])
        .build(tauri::generate_context!())
        .expect("error while building Via");
    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            let state = app_handle.state::<BackendState>();
            let _ = state.domain.mark_clean_shutdown();
        }
    });
}
