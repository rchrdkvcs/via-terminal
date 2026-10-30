#[cfg(test)]
mod bindings;
mod commands;
pub mod error;
pub mod files;
pub mod layout;
pub mod secrets;
pub mod sessions;
pub mod settings;
pub mod storage;
pub mod swipe;
pub mod vault;

use commands::{emitter::TauriSink, App};
use std::sync::Arc;
use tauri::{Emitter, Manager};

fn build(app: &tauri::AppHandle) -> Result<App, Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let storage = Arc::new(storage::Storage::open(data_dir.join("via.sqlite"))?);
    let secrets = Arc::new(secrets::Secrets::new(storage.clone(), &secrets::OsKeychain));
    Ok(App {
        layouts: layout::Layouts::new(storage.clone()),
        settings: settings::SettingsStore::load(storage.clone())?,
        vault: Arc::new(vault::Vault::load(storage, secrets)?),
        sessions: sessions::SessionHub::new(Arc::new(TauriSink(app.clone()))),
        shells: sessions::shells::DetectedShells::detect(),
        staging: files::Staging::new(app.path().app_cache_dir()?.join("file-drops")),
    })
}

/// The default macOS menu, minus Close Window: its Cmd+W would close the whole window
/// before the webview sees the key, while Via binds it to closing the active tab.
#[cfg(target_os = "macos")]
fn menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{AboutMetadata, Menu, PredefinedMenuItem as Item, Submenu};
    let name = app.package_info().name.clone();
    let about = AboutMetadata {
        name: Some(name.clone()),
        version: Some(app.package_info().version.to_string()),
        ..Default::default()
    };
    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                name,
                true,
                &[
                    &Item::about(app, None, Some(about))?,
                    &Item::separator(app)?,
                    &Item::services(app, None)?,
                    &Item::separator(app)?,
                    &Item::hide(app, None)?,
                    &Item::hide_others(app, None)?,
                    &Item::show_all(app, None)?,
                    &Item::separator(app)?,
                    &Item::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &Item::undo(app, None)?,
                    &Item::redo(app, None)?,
                    &Item::separator(app)?,
                    &Item::cut(app, None)?,
                    &Item::copy(app, None)?,
                    &Item::paste(app, None)?,
                    &Item::select_all(app, None)?,
                ],
            )?,
            &Submenu::with_items(app, "View", true, &[&Item::fullscreen(app, None)?])?,
            &Submenu::with_items(
                app,
                "Window",
                true,
                &[&Item::minimize(app, None)?, &Item::maximize(app, None)?],
            )?,
        ],
    )
}

pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu);
    let app = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let state = build(app.handle())?;
            app.manage(state);
            swipe::install(app.handle());
            Ok(())
        })
        .invoke_handler(commands::handler())
        .build(tauri::generate_context!())
        .expect("error while building Via");
    app.run(|handle, event| {
        if let tauri::RunEvent::ExitRequested {
            code: None,
            ref api,
            ..
        } = event
        {
            api.prevent_exit();
            let _ = handle.emit("app-exit-requested", ());
        }
        if matches!(event, tauri::RunEvent::Exit) {
            handle.state::<App>().shutdown();
        }
    });
}
