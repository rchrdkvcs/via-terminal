use super::App;
use crate::{
    error::AppResult,
    sessions::{prompts::PromptAnswer, LocalSpec, Size},
    vault::model::Id,
};
use serde::Deserialize;
use std::sync::Arc;
use tauri::State;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTarget {
    shell: Option<String>,
    cwd: Option<String>,
}

#[tauri::command]
pub fn session_open_local(app: State<App>, target: LocalTarget, size: Size) -> AppResult<Id> {
    let shell = app
        .shells
        .resolve(target.shell, app.settings.get().default_shell)?;
    app.sessions.open_local(
        LocalSpec {
            shell,
            cwd: target.cwd,
        },
        size,
    )
}

#[tauri::command]
/// Without a size, the session serves files only and opens no shell.
pub fn session_open_host(app: State<App>, host_id: Id, size: Option<Size>) -> AppResult<Id> {
    let plan = app.vault.plan(host_id)?;
    app.sessions.open_ssh(plan, app.vault.clone(), size)
}

#[tauri::command]
pub fn session_open_quick(
    app: State<App>,
    target: crate::vault::QuickTarget,
    size: Option<Size>,
) -> AppResult<Id> {
    let plan = app
        .vault
        .quick_plan(target, app.settings.get().save_quick_connect)?;
    let store: Arc<dyn crate::sessions::ssh::ConnectionStore> = app.vault.clone();
    app.sessions.open_ssh(plan, store, size)
}

#[tauri::command]
pub fn session_write(app: State<App>, id: Id, data: String) -> AppResult<()> {
    app.sessions.write(id, data.as_bytes())
}

#[tauri::command]
pub fn session_resize(app: State<App>, id: Id, size: Size) -> AppResult<()> {
    app.sessions.resize(id, size)
}

#[tauri::command]
pub fn session_close(app: State<App>, id: Id) {
    app.sessions.close(id);
}

#[tauri::command]
pub fn session_answer(app: State<App>, prompt_id: Id, answer: PromptAnswer) -> AppResult<()> {
    app.sessions.answer(prompt_id, answer)
}
