use super::App;
use crate::{
    error::AppResult,
    layout::Layout,
    sessions::shells::{self, Shell},
    settings::Settings,
    vault::VaultView,
};
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    layout: Layout,
    settings: Settings,
    vault: VaultView,
    shells: Vec<Shell>,
    /// The shell used when neither the tab, its space nor settings name one.
    system_shell: Option<String>,
    platform: &'static str,
}

#[tauri::command]
pub fn app_bootstrap(app: State<App>) -> AppResult<Bootstrap> {
    Ok(Bootstrap {
        layout: app.layouts.load()?,
        settings: app.settings.get(),
        vault: app.vault.view()?,
        system_shell: shells::default_path(&app.shells),
        shells: app.shells.clone(),
        platform: std::env::consts::OS,
    })
}

#[tauri::command]
pub fn layout_save(app: State<App>, layout: Layout) -> AppResult<()> {
    app.layouts.save(&layout)
}

#[tauri::command]
pub fn settings_save(app: State<App>, settings: Settings) -> AppResult<Settings> {
    app.settings.save(settings)
}

/// Called only after frontend persistence has completed, before installing.
#[tauri::command]
pub fn app_prepare_update(app: State<App>) {
    app.sessions.close_all();
}
