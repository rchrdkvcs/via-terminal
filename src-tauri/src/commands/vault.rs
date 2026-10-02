//! Every mutation returns the whole vault view, so the interface replaces its
//! copy instead of patching it, plus the id of what was created or changed.

use super::App;
use crate::{
    error::AppResult,
    vault::{
        input::{GroupInput, HostInput, IdentityInput, KeyImport},
        model::Id,
        Vault, VaultView,
    },
};
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mutation {
    vault: VaultView,
    id: Option<Id>,
}

fn done(vault: &Vault, id: Option<Id>) -> AppResult<Mutation> {
    Ok(Mutation {
        vault: vault.view()?,
        id,
    })
}

#[tauri::command]
pub fn vault_get(app: State<App>) -> AppResult<VaultView> {
    app.vault.view()
}

#[tauri::command]
pub fn host_save(app: State<App>, input: HostInput) -> AppResult<Mutation> {
    let host = app.vault.save_host(input)?;
    done(&app.vault, Some(host.id))
}

#[tauri::command]
pub fn host_delete(app: State<App>, id: Id) -> AppResult<Mutation> {
    app.vault.delete_host(id)?;
    done(&app.vault, None)
}

#[tauri::command]
pub fn host_duplicate(app: State<App>, id: Id) -> AppResult<Mutation> {
    let host = app.vault.duplicate_host(id)?;
    done(&app.vault, Some(host.id))
}

#[tauri::command]
pub fn group_save(app: State<App>, input: GroupInput) -> AppResult<Mutation> {
    let group = app.vault.save_group(input)?;
    done(&app.vault, Some(group.id))
}

#[tauri::command]
pub fn group_delete(app: State<App>, id: Id) -> AppResult<Mutation> {
    app.vault.delete_group(id)?;
    done(&app.vault, None)
}

#[tauri::command]
pub fn identity_save(app: State<App>, input: IdentityInput) -> AppResult<Mutation> {
    let identity = app.vault.save_identity(input)?;
    done(&app.vault, Some(identity.id))
}

#[tauri::command]
pub fn identity_delete(app: State<App>, id: Id) -> AppResult<Mutation> {
    app.vault.delete_identity(id)?;
    done(&app.vault, None)
}

#[tauri::command]
pub fn key_import(app: State<App>, input: KeyImport) -> AppResult<Mutation> {
    let key = app.vault.import_key(input)?;
    done(&app.vault, Some(key.id))
}

#[tauri::command]
pub fn key_generate(app: State<App>, label: String) -> AppResult<Mutation> {
    let key = app.vault.generate_key(&label)?;
    done(&app.vault, Some(key.id))
}

#[tauri::command]
pub fn key_rename(app: State<App>, id: Id, label: String) -> AppResult<Mutation> {
    app.vault.rename_key(id, &label)?;
    done(&app.vault, Some(id))
}

#[tauri::command]
pub fn key_delete(app: State<App>, id: Id) -> AppResult<Mutation> {
    app.vault.delete_key(id)?;
    done(&app.vault, None)
}

#[tauri::command]
pub fn known_host_delete(app: State<App>, id: Id) -> AppResult<Mutation> {
    app.vault.delete_known_host(id)?;
    done(&app.vault, None)
}
