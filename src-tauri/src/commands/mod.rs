//! Tauri commands: thin adapters from IPC to the modules. Every command
//! returns `AppResult`, so the interface always gets `{ code, message }`.

pub mod app;
pub mod emitter;
pub mod sessions;
pub mod vault;

use crate::{
    layout::Layouts, sessions::shells::Shell, sessions::SessionHub, settings::SettingsStore,
    vault::Vault,
};
use std::sync::Arc;

pub struct App {
    pub layouts: Layouts,
    pub settings: SettingsStore,
    pub vault: Arc<Vault>,
    pub sessions: SessionHub,
    pub shells: Vec<Shell>,
}

/// Registers every command; the list is the IPC surface of the application.
pub fn handler() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        app::app_bootstrap,
        app::layout_save,
        app::settings_save,
        vault::vault_get,
        vault::host_save,
        vault::host_delete,
        vault::host_duplicate,
        vault::group_save,
        vault::group_delete,
        vault::identity_save,
        vault::identity_delete,
        vault::key_import,
        vault::key_generate,
        vault::key_rename,
        vault::key_delete,
        vault::known_host_delete,
        sessions::session_open_local,
        sessions::session_open_host,
        sessions::session_open_quick,
        sessions::session_write,
        sessions::session_resize,
        sessions::session_close,
        sessions::session_answer,
    ]
}
