use super::App;
use crate::{
    error::{AppError, AppResult},
    files::model::Request,
};
use serde_json::Value;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
#[tauri::command]
pub async fn session_files(app: State<'_, App>, id: Uuid, request: Request) -> AppResult<Value> {
    app.sessions.files(id, request).await
}
#[tauri::command]
pub async fn files_pick(app: AppHandle, directory: bool, download: bool) -> AppResult<Vec<String>> {
    tauri::async_runtime::spawn_blocking(move || {
        let picker = app.dialog().file();
        let paths = if download {
            picker.blocking_pick_folder().map(|p| vec![p])
        } else if directory {
            picker.blocking_pick_folders()
        } else {
            picker.blocking_pick_files()
        };
        paths
            .unwrap_or_default()
            .into_iter()
            .map(|p| {
                p.into_path()
                    .map(|p| p.to_string_lossy().into_owned())
                    .map_err(|_| AppError::invalid("Chemin local invalide"))
            })
            .collect()
    })
    .await
    .map_err(|_| AppError::new("file_local", "Sélection de fichiers interrompue"))?
}
#[tauri::command]
pub fn files_stage_begin(app: State<App>) -> AppResult<Uuid> {
    app.staging.begin()
}
#[tauri::command]
pub async fn files_stage_chunk(
    app: State<'_, App>,
    id: Uuid,
    path: String,
    data: Vec<u8>,
) -> AppResult<()> {
    app.staging.chunk(id, &path, data).await
}
#[tauri::command]
pub fn files_stage_finish(app: State<App>, id: Uuid) -> AppResult<Vec<String>> {
    app.staging.finish(id)
}
#[tauri::command]
pub fn files_stage_discard(app: State<App>, id: Uuid) -> AppResult<()> {
    app.staging.discard(id)
}

#[tauri::command]
pub async fn files_stage_directory(app: State<'_, App>, id: Uuid, path: String) -> AppResult<()> {
    app.staging.directory(id, &path).await
}
