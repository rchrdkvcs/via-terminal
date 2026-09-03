use super::*;

impl DomainService {
    pub fn create_workspace(
        &self,
        name: String,
        icon: String,
        color: String,
        default_shell: Option<String>,
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
            let executable =
                if let Some(shell) = default_shell.filter(|shell| !shell.trim().is_empty()) {
                    shell
                } else if d.settings.default_shell.trim().is_empty() {
                    crate::domain::default_shell()
                } else {
                    d.settings.default_shell.clone()
                };
            d.profiles.push(LocalProfile {
                id: profile_id,
                workspace_id,
                name: crate::domain::shell_label(&executable),
                executable,
                args: vec![],
                working_directory: None,
            });
            d.workspaces.push(w.clone());
            Ok(w)
        })
    }
    pub fn move_workspace(&self, id: Id, before_id: Option<Id>) -> Result<Workspace, String> {
        self.mutate(|d| {
            let moving = d
                .workspaces
                .iter()
                .find(|workspace| workspace.id == id)
                .cloned()
                .ok_or("workspace not found")?;
            let mut ordered = d.workspaces.clone();
            ordered.sort_by_key(|workspace| workspace.position);
            ordered.retain(|workspace| workspace.id != id);
            let position = before_id
                .map(|before| {
                    ordered
                        .iter()
                        .position(|workspace| workspace.id == before)
                        .ok_or("workspace anchor not found")
                })
                .transpose()?
                .unwrap_or(ordered.len());
            ordered.insert(position, moving.clone());
            for (position, workspace) in ordered.iter_mut().enumerate() {
                workspace.position = position as i64;
            }
            d.workspaces = ordered;
            Ok(d.workspaces
                .iter()
                .find(|workspace| workspace.id == id)
                .cloned()
                .unwrap())
        })
    }
    pub fn update_workspace(
        &self,
        id: Id,
        name: String,
        icon: String,
        default_shell: Option<String>,
    ) -> Result<Workspace, String> {
        let name = name.trim().to_string();
        let icon = icon.trim().to_string();
        if name.is_empty() {
            return Err("workspace name cannot be empty".into());
        }
        if icon.is_empty() {
            return Err("workspace icon cannot be empty".into());
        }
        self.mutate(|d| {
            let workspace = d
                .workspaces
                .iter_mut()
                .find(|workspace| workspace.id == id)
                .ok_or("workspace not found")?;
            workspace.name = name;
            workspace.icon = icon;
            let updated = workspace.clone();
            if let Some(shell) = default_shell.filter(|shell| !shell.trim().is_empty()) {
                if let Some(profile_id) = updated.default_profile_id {
                    if let Some(profile) = d
                        .profiles
                        .iter_mut()
                        .find(|profile| profile.id == profile_id)
                    {
                        profile.name = crate::domain::shell_label(&shell);
                        profile.executable = shell;
                    }
                }
            }
            Ok(updated)
        })
    }
    pub fn delete_workspace(&self, id: Id) -> Result<(), String> {
        self.mutate(|d| {
            if !d.workspaces.iter().any(|workspace| workspace.id == id) {
                return Err("workspace not found".into());
            }
            if d.workspaces.len() <= 1 {
                return Err("cannot delete the last workspace".into());
            }
            d.workspaces.retain(|workspace| workspace.id != id);
            d.profiles.retain(|item| item.workspace_id != id);
            d.identities.retain(|item| item.workspace_id != id);
            d.resources.retain(|item| item.workspace_id != id);
            d.sidebar_nodes.retain(|item| item.workspace_id != id);
            d.favorites.retain(|item| item.workspace_id != id);
            d.saved_sessions.retain(|item| item.workspace_id != id);
            d.tabs.retain(|item| item.workspace_id != id);
            for (position, workspace) in d.workspaces.iter_mut().enumerate() {
                workspace.position = position as i64;
            }
            let live_tabs: std::collections::HashSet<Id> =
                d.tabs.iter().map(|tab| tab.id).collect();
            let fallback = d.workspaces.first().map(|workspace| workspace.id);
            for window in &mut d.windows {
                if window.active_workspace_id == Some(id) {
                    window.active_workspace_id = fallback;
                }
                if window
                    .active_tab_id
                    .is_some_and(|tab| !live_tabs.contains(&tab))
                {
                    window.active_tab_id = None;
                }
            }
            Ok(())
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
}
