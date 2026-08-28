use crate::domain::*;
use crate::repository::Repository;
use std::{path::Path, sync::Mutex};
use uuid::Uuid;
pub struct DomainService {
    repo: Mutex<Repository>,
}
impl DomainService {
    pub fn new(repo: Repository) -> Self {
        Self {
            repo: Mutex::new(repo),
        }
    }
    pub fn snapshot(&self) -> Result<AppData, String> {
        self.repo
            .lock()
            .unwrap()
            .load()?
            .ok_or("app data unavailable".into())
    }
    fn mutate<T>(&self, f: impl FnOnce(&mut AppData) -> Result<T, String>) -> Result<T, String> {
        let repo = self.repo.lock().unwrap();
        let mut data = repo.load()?.ok_or("app data unavailable")?;
        let value = f(&mut data)?;
        data.validate()?;
        repo.save(&data)?;
        Ok(value)
    }
    pub fn create_workspace(
        &self,
        name: String,
        icon: String,
        color: String,
    ) -> Result<Workspace, String> {
        self.mutate(|d| {
            let w = Workspace {
                id: Uuid::new_v4(),
                name,
                icon,
                color,
                position: d.workspaces.len() as i64,
                default_profile_id: None,
            };
            d.workspaces.push(w.clone());
            Ok(w)
        })
    }
    pub fn duplicate_workspace(&self, id: Id, name: String) -> Result<Workspace, String> {
        self.mutate(|d| {
            let source = d
                .workspaces
                .iter()
                .find(|w| w.id == id)
                .cloned()
                .ok_or("workspace not found")?;
            let new_id = Uuid::new_v4();
            let mut profile_map = std::collections::HashMap::new();
            let originals: Vec<_> = d
                .profiles
                .iter()
                .filter(|p| p.workspace_id == id)
                .cloned()
                .collect();
            for mut p in originals {
                let old = p.id;
                p.id = Uuid::new_v4();
                p.workspace_id = new_id;
                profile_map.insert(old, p.id);
                d.profiles.push(p)
            }
            let w = Workspace {
                id: new_id,
                name,
                icon: source.icon,
                color: source.color,
                position: d.workspaces.len() as i64,
                default_profile_id: source
                    .default_profile_id
                    .and_then(|x| profile_map.get(&x).copied()),
            };
            d.workspaces.push(w.clone());
            Ok(w)
        })
    }
    pub fn create_identity(
        &self,
        workspace_id: Id,
        name: String,
        username: String,
        identity_file: Option<String>,
    ) -> Result<Identity, String> {
        self.mutate(|d| {
            if !d.workspaces.iter().any(|w| w.id == workspace_id) {
                return Err("workspace not found".into());
            }
            let i = Identity {
                id: Uuid::new_v4(),
                workspace_id,
                name,
                username,
                identity_file,
            };
            d.identities.push(i.clone());
            Ok(i)
        })
    }
    pub fn create_resource(
        &self,
        workspace_id: Id,
        name: String,
        host: Option<String>,
        ssh_alias: Option<String>,
        port: Option<u16>,
        identity_id: Option<Id>,
    ) -> Result<Resource, String> {
        self.mutate(|d| {
            let r = Resource {
                id: Uuid::new_v4(),
                workspace_id,
                name,
                ssh_alias,
                host,
                port,
                identity_id,
            };
            d.resources.push(r.clone());
            Ok(r)
        })
    }
    pub fn update_settings(&self, settings: Settings) -> Result<Settings, String> {
        self.mutate(|d| {
            d.settings = settings.clone();
            Ok(settings)
        })
    }
    pub fn export_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(&self.snapshot()?).map_err(|e| e.to_string())
    }
    pub fn import_json(&self, json: &str) -> Result<AppData, String> {
        let mut incoming: AppData = serde_json::from_str(json).map_err(|e| e.to_string())?;
        incoming.validate()?;
        remap_ids(&mut incoming);
        incoming.validate()?;
        self.repo.lock().unwrap().save(&incoming)?;
        Ok(incoming)
    }
    pub fn export_file(&self, path: &Path) -> Result<(), String> {
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, self.export_json()?).map_err(|e| e.to_string())?;
        std::fs::rename(tmp, path).map_err(|e| e.to_string())
    }
}
fn remap_ids(data: &mut AppData) {
    let mut ws = std::collections::HashMap::new();
    for w in &mut data.workspaces {
        let old = w.id;
        w.id = Uuid::new_v4();
        ws.insert(old, w.id);
    }
    let mut profiles = std::collections::HashMap::new();
    for p in &mut data.profiles {
        let old = p.id;
        p.id = Uuid::new_v4();
        p.workspace_id = ws[&p.workspace_id];
        profiles.insert(old, p.id);
    }
    for w in &mut data.workspaces {
        w.default_profile_id = w
            .default_profile_id
            .and_then(|id| profiles.get(&id).copied());
    }
    let mut identities = std::collections::HashMap::new();
    for i in &mut data.identities {
        let old = i.id;
        i.id = Uuid::new_v4();
        i.workspace_id = ws[&i.workspace_id];
        identities.insert(old, i.id);
    }
    for r in &mut data.resources {
        r.id = Uuid::new_v4();
        r.workspace_id = ws[&r.workspace_id];
        r.identity_id = r.identity_id.and_then(|i| identities.get(&i).copied())
    }
    data.sidebar_nodes.clear();
    data.favorites.clear()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn duplicate_has_independent_ids() {
        let s = DomainService::new(Repository::memory().unwrap());
        let source = s.snapshot().unwrap().workspaces[0].clone();
        let copy = s.duplicate_workspace(source.id, "Copy".into()).unwrap();
        assert_ne!(source.id, copy.id);
        assert_ne!(source.default_profile_id, copy.default_profile_id)
    }
    #[test]
    fn export_import_remaps_ids() {
        let s = DomainService::new(Repository::memory().unwrap());
        let original = s.snapshot().unwrap().workspaces[0].id;
        let imported = s.import_json(&s.export_json().unwrap()).unwrap();
        assert_ne!(original, imported.workspaces[0].id)
    }
}
