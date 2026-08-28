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
    /// Resolve a launch profile from persisted state and prove that it belongs
    /// to the workspace selected by the caller. Process launch code must use
    /// this instead of accepting an executable from the webview.
    pub fn local_profile(&self, workspace_id: Id, profile_id: Id) -> Result<LocalProfile, String> {
        let data = self.snapshot()?;
        if !data
            .workspaces
            .iter()
            .any(|workspace| workspace.id == workspace_id)
        {
            return Err("workspace not found".into());
        }
        data.profiles
            .into_iter()
            .find(|profile| profile.id == profile_id && profile.workspace_id == workspace_id)
            .ok_or_else(|| "profile not found in workspace".into())
    }
    pub fn pin_hash(&self) -> Result<Option<String>, String> {
        self.repo.lock().unwrap().private_setting("pin_hash")
    }
    pub fn set_pin_hash(&self, value: &str) -> Result<(), String> {
        self.repo
            .lock()
            .unwrap()
            .set_private_setting("pin_hash", value)
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
            let workspace_id = Uuid::new_v4();
            let profile_id = Uuid::new_v4();
            let w = Workspace {
                id: workspace_id,
                name,
                icon,
                color,
                position: d.workspaces.len() as i64,
                default_profile_id: Some(profile_id),
            };
            d.profiles.push(LocalProfile {
                id: profile_id,
                workspace_id,
                name: "PowerShell".into(),
                executable: crate::domain::default_shell(),
                args: vec![],
                working_directory: None,
            });
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
            let mut identity_map = std::collections::HashMap::new();
            for mut identity in d
                .identities
                .iter()
                .filter(|item| item.workspace_id == id)
                .cloned()
                .collect::<Vec<_>>()
            {
                let old = identity.id;
                identity.id = Uuid::new_v4();
                identity.workspace_id = new_id;
                identity_map.insert(old, identity.id);
                d.identities.push(identity);
            }
            let mut resource_map = std::collections::HashMap::new();
            for mut resource in d
                .resources
                .iter()
                .filter(|item| item.workspace_id == id)
                .cloned()
                .collect::<Vec<_>>()
            {
                let old = resource.id;
                resource.id = Uuid::new_v4();
                resource.workspace_id = new_id;
                resource.identity_id = resource
                    .identity_id
                    .and_then(|identity_id| identity_map.get(&identity_id).copied());
                resource_map.insert(old, resource.id);
                d.resources.push(resource);
            }
            let mut node_map = std::collections::HashMap::new();
            let mut copied_nodes = d
                .sidebar_nodes
                .iter()
                .filter(|item| item.workspace_id == id)
                .cloned()
                .collect::<Vec<_>>();
            for node in &mut copied_nodes {
                let old = node.id;
                node.id = Uuid::new_v4();
                node.workspace_id = new_id;
                node_map.insert(old, node.id);
            }
            for node in &mut copied_nodes {
                node.parent_id = node
                    .parent_id
                    .and_then(|parent_id| node_map.get(&parent_id).copied());
                node.target_id = node
                    .target_id
                    .and_then(|target_id| match node.kind.as_str() {
                        "profile" => profile_map.get(&target_id).copied(),
                        "resource" => resource_map.get(&target_id).copied(),
                        _ => None,
                    });
            }
            d.sidebar_nodes.extend(copied_nodes);
            for mut favorite in d
                .favorites
                .iter()
                .filter(|item| item.workspace_id == id)
                .cloned()
                .collect::<Vec<_>>()
            {
                favorite.id = Uuid::new_v4();
                favorite.workspace_id = new_id;
                favorite.target_id = match favorite.target_kind.as_str() {
                    "profile" => profile_map[&favorite.target_id],
                    "resource" => resource_map[&favorite.target_id],
                    _ => unreachable!("validated favorite kind"),
                };
                d.favorites.push(favorite);
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
    let mut resources = std::collections::HashMap::new();
    for r in &mut data.resources {
        let old = r.id;
        r.id = Uuid::new_v4();
        r.workspace_id = ws[&r.workspace_id];
        r.identity_id = r.identity_id.and_then(|i| identities.get(&i).copied());
        resources.insert(old, r.id);
    }
    let mut nodes = std::collections::HashMap::new();
    for node in &mut data.sidebar_nodes {
        let old = node.id;
        node.id = Uuid::new_v4();
        node.workspace_id = ws[&node.workspace_id];
        nodes.insert(old, node.id);
    }
    for node in &mut data.sidebar_nodes {
        node.parent_id = node.parent_id.and_then(|id| nodes.get(&id).copied());
        node.target_id = node.target_id.and_then(|id| match node.kind.as_str() {
            "profile" => profiles.get(&id).copied(),
            "resource" => resources.get(&id).copied(),
            _ => None,
        });
    }
    for favorite in &mut data.favorites {
        favorite.id = Uuid::new_v4();
        favorite.workspace_id = ws[&favorite.workspace_id];
        favorite.target_id = match favorite.target_kind.as_str() {
            "profile" => profiles[&favorite.target_id],
            "resource" => resources[&favorite.target_id],
            _ => unreachable!("validated favorite kind"),
        };
    }
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

    fn organized_data() -> AppData {
        let mut data = AppData::seed();
        let workspace_id = data.workspaces[0].id;
        let profile_id = data.profiles[0].id;
        let identity_id = Uuid::new_v4();
        let resource_id = Uuid::new_v4();
        let folder_id = Uuid::new_v4();
        data.identities.push(Identity {
            id: identity_id,
            workspace_id,
            name: "Admin".into(),
            username: "root".into(),
            identity_file: Some("admin_key".into()),
        });
        data.resources.push(Resource {
            id: resource_id,
            workspace_id,
            name: "Server".into(),
            ssh_alias: Some("server".into()),
            host: None,
            port: Some(22),
            identity_id: Some(identity_id),
        });
        data.sidebar_nodes.push(SidebarNode {
            id: folder_id,
            workspace_id,
            parent_id: None,
            kind: "folder".into(),
            label: "Production".into(),
            target_id: None,
            position: 0,
        });
        data.sidebar_nodes.push(SidebarNode {
            id: Uuid::new_v4(),
            workspace_id,
            parent_id: Some(folder_id),
            kind: "resource".into(),
            label: "Server".into(),
            target_id: Some(resource_id),
            position: 0,
        });
        data.favorites.push(Favorite {
            id: Uuid::new_v4(),
            workspace_id,
            target_kind: "profile".into(),
            target_id: profile_id,
            position: 0,
        });
        data
    }

    #[test]
    fn duplicate_workspace_copies_complete_organization_with_independent_ids() {
        let repo = Repository::memory().unwrap();
        repo.save(&organized_data()).unwrap();
        let service = DomainService::new(repo);
        let source = service.snapshot().unwrap().workspaces[0].id;
        let copy = service.duplicate_workspace(source, "Copy".into()).unwrap();
        let snapshot = service.snapshot().unwrap();
        assert_eq!(
            snapshot
                .identities
                .iter()
                .filter(|x| x.workspace_id == copy.id)
                .count(),
            1
        );
        assert_eq!(
            snapshot
                .resources
                .iter()
                .filter(|x| x.workspace_id == copy.id)
                .count(),
            1
        );
        assert_eq!(
            snapshot
                .sidebar_nodes
                .iter()
                .filter(|x| x.workspace_id == copy.id)
                .count(),
            2
        );
        assert_eq!(
            snapshot
                .favorites
                .iter()
                .filter(|x| x.workspace_id == copy.id)
                .count(),
            1
        );
        let copied_resource = snapshot
            .resources
            .iter()
            .find(|x| x.workspace_id == copy.id)
            .unwrap();
        let copied_identity = snapshot
            .identities
            .iter()
            .find(|x| x.workspace_id == copy.id)
            .unwrap();
        assert_eq!(copied_resource.identity_id, Some(copied_identity.id));
        assert!(snapshot.validate().is_ok());
    }

    #[test]
    fn import_preserves_organization_and_remaps_every_reference() {
        let service = DomainService::new(Repository::memory().unwrap());
        let incoming = organized_data();
        let old_workspace = incoming.workspaces[0].id;
        let old_node_ids: Vec<_> = incoming.sidebar_nodes.iter().map(|x| x.id).collect();
        let imported = service
            .import_json(&serde_json::to_string(&incoming).unwrap())
            .unwrap();
        assert_ne!(imported.workspaces[0].id, old_workspace);
        assert_eq!(imported.sidebar_nodes.len(), 2);
        assert_eq!(imported.favorites.len(), 1);
        assert!(imported
            .sidebar_nodes
            .iter()
            .all(|x| !old_node_ids.contains(&x.id)));
        let folder = imported
            .sidebar_nodes
            .iter()
            .find(|x| x.kind == "folder")
            .unwrap();
        let child = imported
            .sidebar_nodes
            .iter()
            .find(|x| x.kind == "resource")
            .unwrap();
        assert_eq!(child.parent_id, Some(folder.id));
        assert_eq!(child.target_id, Some(imported.resources[0].id));
        assert_eq!(imported.favorites[0].target_id, imported.profiles[0].id);
        assert!(imported.validate().is_ok());
    }
    #[test]
    fn profile_cannot_be_resolved_through_another_workspace() {
        let s = DomainService::new(Repository::memory().unwrap());
        let data = s.snapshot().unwrap();
        let profile = &data.profiles[0];
        assert!(s.local_profile(Uuid::new_v4(), profile.id).is_err());
    }
    #[test]
    fn pin_hash_is_private_and_persistent() {
        let s = DomainService::new(Repository::memory().unwrap());
        s.set_pin_hash("encoded-secret-verifier").unwrap();
        assert_eq!(
            s.pin_hash().unwrap().as_deref(),
            Some("encoded-secret-verifier")
        );
        assert!(!s.export_json().unwrap().contains("encoded-secret-verifier"));
    }
}
