pub mod app;
pub mod emitter;
pub mod files;
pub mod sessions;
pub mod vault;

use crate::{
    layout::Layouts, sessions::shells::DetectedShells, sessions::SessionHub,
    settings::SettingsStore, vault::Vault,
};
use std::sync::Arc;

pub struct App {
    pub layouts: Layouts,
    pub settings: SettingsStore,
    pub vault: Arc<Vault>,
    pub sessions: SessionHub,
    pub shells: DetectedShells,
    pub staging: crate::files::Staging,
}

impl App {
    pub fn shutdown(&self) {
        self.sessions.close_all();
        self.staging.clear();
    }
}

pub fn handler() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        app::app_bootstrap,
        app::app_prepare_update,
        app::app_exit,
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
        files::session_files,
        files::files_pick,
        files::files_stage_begin,
        files::files_stage_chunk,
        files::files_stage_directory,
        files::files_stage_finish,
        files::files_stage_discard,
        crate::swipe::swipe_region,
        crate::swipe::swipe_haptic,
    ]
}
