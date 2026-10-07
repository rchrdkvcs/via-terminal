use super::App;
use crate::{
    error::{AppError, AppResult},
    files::{
        model::{Reply, Request as FileRequest},
        parse_chunk,
    },
};
use std::borrow::Cow;
use tauri::{
    ipc::{InvokeBody, Request},
    AppHandle, State,
};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
#[tauri::command]
pub async fn session_files(
    app: State<'_, App>,
    id: Uuid,
    request: FileRequest,
) -> AppResult<Reply> {
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
/// Takes a raw body framed by `staging::parse_chunk`, with the staging id in a header.
#[tauri::command]
pub async fn files_stage_chunk(app: State<'_, App>, request: Request<'_>) -> AppResult<()> {
    let id = request
        .headers()
        .get("via-staging")
        .and_then(|id| Uuid::parse_str(id.to_str().ok()?).ok())
        .ok_or_else(|| AppError::not_found("Dépôt temporaire"))?;
    // The JSON form only appears when the webview falls back to its message channel.
    let body: Cow<[u8]> = match request.body() {
        InvokeBody::Raw(body) => Cow::Borrowed(body),
        InvokeBody::Json(body) => Cow::Owned(
            serde_json::from_value(body.clone())
                .map_err(|_| AppError::invalid("Bloc de fichier invalide"))?,
        ),
    };
    let (path, data) = parse_chunk(&body)?;
    app.staging.chunk(id, path, data).await
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
