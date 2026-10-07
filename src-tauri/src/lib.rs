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
        shells: sessions::shells::detect(),
        staging: files::Staging::new(app.path().app_cache_dir()?.join("file-drops")),
    })
}

pub fn run() {
    let app = tauri::Builder::default()
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
            let app = handle.state::<App>();
            app.sessions.close_all();
            app.staging.clear();
        }
    });
}
