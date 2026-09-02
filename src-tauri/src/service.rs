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
    pub fn update_settings(&self, settings: Settings) -> Result<Settings, String> {
        if settings.default_shell.trim().is_empty() || settings.default_shell.contains('\0') {
            return Err("invalid default shell".into());
        }
        self.mutate(|d| {
            d.settings = settings.clone();
            let shell = d.settings.default_shell.clone();
            let label = crate::domain::shell_label(&shell);
            let default_ids: std::collections::HashSet<_> = d
                .workspaces
                .iter()
                .filter_map(|workspace| workspace.default_profile_id)
                .collect();
            for profile in &mut d.profiles {
                if default_ids.contains(&profile.id) {
                    profile.executable = shell.clone();
                    profile.name = label.clone();
                }
            }
            Ok(settings)
        })
    }
    pub fn save_tab(&self, tab: Tab, sessions: Vec<SavedSession>) -> Result<Tab, String> {
        self.mutate(|data| {
            if !data
                .workspaces
                .iter()
                .any(|workspace| workspace.id == tab.workspace_id)
            {
                return Err("workspace not found".into());
            }
            if sessions
                .iter()
                .any(|session| session.workspace_id != tab.workspace_id)
            {
                return Err("cross-workspace saved session reference".into());
            }
            let old_session_ids: std::collections::HashSet<_> = data
                .tabs
                .iter()
                .find(|item| item.id == tab.id)
                .and_then(|item| item.root.as_ref())
                .map(pane_session_ids)
                .unwrap_or_default()
                .into_iter()
                .collect();
            data.saved_sessions
                .retain(|session| !old_session_ids.contains(&session.id));
            data.saved_sessions.extend(sessions);
            match data.tabs.iter_mut().find(|item| item.id == tab.id) {
                Some(existing) => *existing = tab.clone(),
                None => data.tabs.push(tab.clone()),
            }
            Ok(tab)
        })
    }
    pub fn save_split_group(&self, group: SplitGroup) -> Result<SplitGroup, String> {
        self.mutate(|data| {
            match data
                .split_groups
                .iter_mut()
                .find(|item| item.id == group.id)
            {
                Some(existing) => *existing = group.clone(),
                None => data.split_groups.push(group.clone()),
            }
            Ok(group)
        })
    }

    pub fn delete_split_group(&self, id: Id) -> Result<(), String> {
        self.mutate(|data| {
            data.split_groups.retain(|group| group.id != id);
            Ok(())
        })
    }
    pub fn save_window_state(&self, window: WindowState) -> Result<WindowState, String> {
        self.mutate(|data| {
            match data.windows.iter_mut().find(|item| item.id == window.id) {
                Some(existing) => *existing = window.clone(),
                None => data.windows.push(window.clone()),
            }
            Ok(window)
        })
    }
    pub fn begin_run(&self) -> Result<bool, String> {
        self.mutate(|data| {
            let recovery_available = !data.app_state.clean_shutdown;
            data.app_state.recovery_available = recovery_available;
            data.app_state.clean_shutdown = false;
            Ok(recovery_available)
        })
    }
    pub fn recovery_state(&self) -> Result<AppState, String> {
        Ok(self.snapshot()?.app_state)
    }
    pub fn finish_recovery(&self) -> Result<(), String> {
        self.mutate(|data| {
            data.app_state.recovery_available = false;
            Ok(())
        })
    }
    pub fn mark_clean_shutdown(&self) -> Result<(), String> {
        self.mutate(|data| {
            data.app_state.clean_shutdown = true;
            data.app_state.recovery_available = false;
            Ok(())
        })
    }
    pub fn export_json(&self) -> Result<String, String> {
        let mut portable = self.snapshot()?;
        portable.windows.clear();
        portable.app_state = AppState::default();
        serde_json::to_string_pretty(&portable).map_err(|e| e.to_string())
    }
    pub fn import_json(&self, json: &str) -> Result<AppData, String> {
        let mut incoming: AppData = serde_json::from_str(json).map_err(|e| e.to_string())?;
        incoming.validate()?;
        remap_ids(&mut incoming);
        incoming.validate()?;
        self.repo.lock().unwrap().save(&incoming)?;
        Ok(incoming)
    }
    pub fn create_profile(
        &self,
        workspace_id: Id,
        name: String,
        executable: String,
        args: Vec<String>,
        working_directory: Option<String>,
    ) -> Result<LocalProfile, String> {
        if name.trim().is_empty() {
            return Err("profile name is required".into());
        }
        if executable.trim().is_empty() || executable.contains('\0') {
            return Err("invalid profile executable".into());
        }
        self.mutate(|d| {
            if !d.workspaces.iter().any(|w| w.id == workspace_id) {
                return Err("workspace not found".into());
            }
            let profile = LocalProfile {
                id: Uuid::new_v4(),
                workspace_id,
                name,
                executable,
                args,
                working_directory,
            };
            d.profiles.push(profile.clone());
            Ok(profile)
        })
    }

    pub fn create_sidebar_node(
        &self,
        workspace_id: Id,
        kind: String,
        label: String,
        parent_id: Option<Id>,
        target_id: Option<Id>,
    ) -> Result<SidebarNode, String> {
        if label.trim().is_empty() {
            return Err("sidebar label is required".into());
        }
        self.mutate(|d| {
            let position = d
                .sidebar_nodes
                .iter()
                .filter(|node| node.workspace_id == workspace_id && node.parent_id == parent_id)
                .count() as i64;
            let node = SidebarNode {
                id: Uuid::new_v4(),
                workspace_id,
                parent_id,
                kind,
                label,
                target_id,
                position,
            };
            d.sidebar_nodes.push(node.clone());
            Ok(node)
        })
    }

    pub fn rename_sidebar_node(&self, id: Id, label: String) -> Result<SidebarNode, String> {
        if label.trim().is_empty() {
            return Err("sidebar label is required".into());
        }
        self.mutate(|d| {
            let node = d
                .sidebar_nodes
                .iter_mut()
                .find(|node| node.id == id)
                .ok_or("sidebar node not found")?;
            node.label = label;
            Ok(node.clone())
        })
    }

    /// Move a node inside its workspace. `position` is the index among the new
    /// siblings; the whole sibling list is renumbered so positions stay dense.
    pub fn move_sidebar_node(
        &self,
        id: Id,
        parent_id: Option<Id>,
        position: i64,
    ) -> Result<SidebarNode, String> {
        self.mutate(|d| {
            let workspace_id = d
                .sidebar_nodes
                .iter()
                .find(|node| node.id == id)
                .map(|node| node.workspace_id)
                .ok_or("sidebar node not found")?;
            if let Some(parent_id) = parent_id {
                let parent = d
                    .sidebar_nodes
                    .iter()
                    .find(|node| node.id == parent_id)
                    .ok_or("sidebar parent missing")?;
                if parent.workspace_id != workspace_id {
                    return Err("cross-workspace sidebar parent reference".into());
                }
                if is_descendant(&d.sidebar_nodes, parent_id, id) {
                    return Err("sidebar parent cycle".into());
                }
            }
            {
                let node = d
                    .sidebar_nodes
                    .iter_mut()
                    .find(|node| node.id == id)
                    .ok_or("sidebar node not found")?;
                node.parent_id = parent_id;
            }
            let mut siblings: Vec<Id> = d
                .sidebar_nodes
                .iter()
                .filter(|node| {
                    node.workspace_id == workspace_id
                        && node.parent_id == parent_id
                        && node.id != id
                })
                .map(|node| (node.position, node.id))
                .collect::<std::collections::BTreeSet<_>>()
                .into_iter()
                .map(|(_, id)| id)
                .collect();
            let index = position.clamp(0, siblings.len() as i64) as usize;
            siblings.insert(index, id);
            for (order, sibling) in siblings.into_iter().enumerate() {
                if let Some(node) = d.sidebar_nodes.iter_mut().find(|node| node.id == sibling) {
                    node.position = order as i64;
                }
            }
            d.sidebar_nodes
                .iter()
                .find(|node| node.id == id)
                .cloned()
                .ok_or_else(|| "sidebar node not found".to_string())
        })
    }

    /// Persist the single canonical order shared by organized tabs and root folders.
    pub fn save_sidebar_root_order(&self, workspace_id: Id, ids: Vec<Id>) -> Result<(), String> {
        self.mutate(|d| {
            let expected: std::collections::HashSet<Id> = d
                .tabs
                .iter()
                .filter(|tab| {
                    tab.workspace_id == workspace_id && tab.organized && tab.folder_id.is_none()
                })
                .map(|tab| tab.id)
                .chain(
                    d.sidebar_nodes
                        .iter()
                        .filter(|node| {
                            node.workspace_id == workspace_id
                                && node.kind == "folder"
                                && node.parent_id.is_none()
                        })
                        .map(|node| node.id),
                )
                .collect();
            let provided: std::collections::HashSet<Id> = ids.iter().copied().collect();
            if provided.len() != ids.len() || provided != expected {
                return Err("invalid sidebar root order".into());
            }
            for (position, id) in ids.into_iter().enumerate() {
                if let Some(tab) = d.tabs.iter_mut().find(|tab| tab.id == id) {
                    tab.position = position as i64;
                } else if let Some(node) = d.sidebar_nodes.iter_mut().find(|node| node.id == id) {
                    node.position = position as i64;
                }
            }
            Ok(())
        })
    }

    /// Remove a node, its descendants and everything that referenced their
    /// targets, so the snapshot stays valid in a single transaction.
    pub fn delete_sidebar_node(&self, id: Id) -> Result<(), String> {
        self.mutate(|d| {
            let mut removed = vec![id];
            let mut index = 0;
            while index < removed.len() {
                let current = removed[index];
                for node in &d.sidebar_nodes {
                    if node.parent_id == Some(current) {
                        removed.push(node.id);
                    }
                }
                index += 1;
            }
            let removed: std::collections::HashSet<Id> = removed.into_iter().collect();
            let targets: std::collections::HashSet<Id> = d
                .sidebar_nodes
                .iter()
                .filter(|node| removed.contains(&node.id))
                .filter_map(|node| node.target_id)
                .collect();
            d.sidebar_nodes.retain(|node| !removed.contains(&node.id));
            d.profiles.retain(|item| !targets.contains(&item.id));
            d.resources.retain(|item| !targets.contains(&item.id));
            d.favorites
                .retain(|item| !targets.contains(&item.target_id));
            for workspace in &mut d.workspaces {
                if workspace
                    .default_profile_id
                    .is_some_and(|profile| targets.contains(&profile))
                {
                    workspace.default_profile_id = None;
                }
            }
            let orphaned: std::collections::HashSet<Id> = d
                .saved_sessions
                .iter()
                .filter(|session| targets.contains(&session.target_id))
                .map(|session| session.id)
                .collect();
            d.saved_sessions
                .retain(|session| !orphaned.contains(&session.id));
            prune_sessions_from_tabs(&mut d.tabs, &orphaned);
            for tab in &mut d.tabs {
                if tab
                    .folder_id
                    .is_some_and(|folder_id| removed.contains(&folder_id))
                {
                    tab.folder_id = None;
                }
            }
            let live: std::collections::HashSet<Id> = d.tabs.iter().map(|tab| tab.id).collect();
            for window in &mut d.windows {
                if window.active_tab_id.is_some_and(|tab| !live.contains(&tab)) {
                    window.active_tab_id = None;
                }
            }
            Ok(())
        })
    }

    pub fn set_favorite(
        &self,
        workspace_id: Id,
        target_kind: String,
        target_id: Id,
        pinned: bool,
    ) -> Result<(), String> {
        self.mutate(|d| {
            d.favorites
                .retain(|item| !(item.workspace_id == workspace_id && item.target_id == target_id));
            if pinned {
                let position = d
                    .favorites
                    .iter()
                    .filter(|item| item.workspace_id == workspace_id)
                    .count() as i64;
                d.favorites.push(Favorite {
                    id: Uuid::new_v4(),
                    workspace_id,
                    target_kind,
                    target_id,
                    position,
                });
            }
            Ok(())
        })
    }

    pub fn move_favorite(&self, id: Id, position: i64) -> Result<(), String> {
        self.mutate(|d| {
            let workspace_id = d
                .favorites
                .iter()
                .find(|item| item.id == id)
                .map(|item| item.workspace_id)
                .ok_or("favorite not found")?;
            let mut ids: Vec<Id> = d
                .favorites
                .iter()
                .filter(|item| item.workspace_id == workspace_id && item.id != id)
                .map(|item| (item.position, item.id))
                .collect::<std::collections::BTreeSet<_>>()
                .into_iter()
                .map(|(_, id)| id)
                .collect();
            let index = position.clamp(0, ids.len() as i64) as usize;
            ids.insert(index, id);
            for (position, favorite_id) in ids.into_iter().enumerate() {
                if let Some(item) = d.favorites.iter_mut().find(|item| item.id == favorite_id) {
                    item.position = position as i64;
                }
            }
            Ok(())
        })
    }

    pub fn delete_tab(&self, id: Id) -> Result<(), String> {
        self.mutate(|d| {
            let sessions: std::collections::HashSet<Id> = d
                .tabs
                .iter()
                .find(|tab| tab.id == id)
                .and_then(|tab| tab.root.as_ref())
                .map(pane_session_ids)
                .unwrap_or_default()
                .into_iter()
                .collect();
            d.tabs.retain(|tab| tab.id != id);
            for group in &mut d.split_groups {
                group.tab_ids.retain(|tab_id| *tab_id != id);
                if let Some(root) = prune_split_tab(group.root.clone(), id) {
                    group.root = root;
                }
            }
            d.split_groups.retain(|group| group.tab_ids.len() >= 2);
            d.saved_sessions
                .retain(|session| !sessions.contains(&session.id));
            for window in &mut d.windows {
                if window.active_tab_id == Some(id) {
                    window.active_tab_id = None;
                }
            }
            Ok(())
        })
    }

    pub fn export_file(&self, path: &Path) -> Result<(), String> {
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, self.export_json()?).map_err(|e| e.to_string())?;
        std::fs::rename(tmp, path).map_err(|e| e.to_string())
    }
}

/// True when `candidate` sits under `ancestor` in the sidebar hierarchy.
/// Used before a move so a folder can never be dropped into its own subtree.
fn is_descendant(nodes: &[SidebarNode], candidate: Id, ancestor: Id) -> bool {
    let mut current = Some(candidate);
    let mut seen = std::collections::HashSet::new();
    while let Some(id) = current {
        if id == ancestor {
            return true;
        }
        if !seen.insert(id) {
            return false;
        }
        current = nodes
            .iter()
            .find(|node| node.id == id)
            .and_then(|node| node.parent_id);
    }
    false
}

/// Drop the named sessions from every pane tree, collapsing empty splits and
/// removing tabs left with nothing to show.
fn prune_sessions_from_tabs(tabs: &mut Vec<Tab>, sessions: &std::collections::HashSet<Id>) {
    for tab in tabs.iter_mut() {
        tab.root = tab.root.take().and_then(|root| prune_pane(root, sessions));
    }
    tabs.retain(|tab| tab.root.is_some());
}

fn prune_pane(tree: PaneTree, sessions: &std::collections::HashSet<Id>) -> Option<PaneTree> {
    match tree {
        PaneTree::Pane { session_id } => {
            if sessions.contains(&session_id) {
                None
            } else {
                Some(PaneTree::Pane { session_id })
            }
        }
        PaneTree::Split {
            direction,
            ratio,
            first,
            second,
        } => match (prune_pane(*first, sessions), prune_pane(*second, sessions)) {
            (Some(first), Some(second)) => Some(PaneTree::Split {
                direction,
                ratio,
                first: Box::new(first),
                second: Box::new(second),
            }),
            (Some(only), None) | (None, Some(only)) => Some(only),
            (None, None) => None,
        },
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
    let mut sessions = std::collections::HashMap::new();
    for session in &mut data.saved_sessions {
        let old = session.id;
        session.id = Uuid::new_v4();
        session.workspace_id = ws[&session.workspace_id];
        session.target_id = match session.target_kind.as_str() {
            "profile" => profiles[&session.target_id],
            "resource" => resources[&session.target_id],
            _ => unreachable!("validated saved session kind"),
        };
        sessions.insert(old, session.id);
    }
    for tab in &mut data.tabs {
        tab.id = Uuid::new_v4();
        tab.workspace_id = ws[&tab.workspace_id];
        if let Some(root) = &mut tab.root {
            remap_pane_sessions(root, &sessions);
        }
    }
    // Window state belongs to a particular installation, not to a portable export.
    data.windows.clear();
    data.app_state = AppState::default();
}

fn pane_session_ids(tree: &PaneTree) -> Vec<Id> {
    match tree {
        PaneTree::Pane { session_id } => vec![*session_id],
        PaneTree::Split { first, second, .. } => {
            let mut ids = pane_session_ids(first);
            ids.extend(pane_session_ids(second));
            ids
        }
    }
}

fn prune_split_tab(tree: SplitTabTree, removed: Id) -> Option<SplitTabTree> {
    match tree {
        SplitTabTree::Tab { tab_id } if tab_id == removed => None,
        SplitTabTree::Tab { .. } => Some(tree),
        SplitTabTree::Split {
            direction,
            ratio,
            first,
            second,
        } => match (
            prune_split_tab(*first, removed),
            prune_split_tab(*second, removed),
        ) {
            (Some(first), Some(second)) => Some(SplitTabTree::Split {
                direction,
                ratio,
                first: Box::new(first),
                second: Box::new(second),
            }),
            (Some(remaining), None) | (None, Some(remaining)) => Some(remaining),
            (None, None) => None,
        },
    }
}

fn remap_pane_sessions(tree: &mut PaneTree, sessions: &std::collections::HashMap<Id, Id>) {
    match tree {
        PaneTree::Pane { session_id } => *session_id = sessions[session_id],
        PaneTree::Split { first, second, .. } => {
            remap_pane_sessions(first, sessions);
            remap_pane_sessions(second, sessions);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removing_a_split_leaf_collapses_its_parent() {
        let removed = Uuid::new_v4();
        let remaining = Uuid::new_v4();
        let tree = SplitTabTree::Split {
            direction: SplitDirection::Vertical,
            ratio: 0.5,
            first: Box::new(SplitTabTree::Tab { tab_id: removed }),
            second: Box::new(SplitTabTree::Tab { tab_id: remaining }),
        };

        assert!(matches!(
            prune_split_tab(tree, removed),
            Some(SplitTabTree::Tab { tab_id }) if tab_id == remaining
        ));
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
    fn update_workspace_persists_name_and_icon() {
        let repo = Repository::memory().unwrap();
        let data = AppData::seed();
        let workspace_id = data.workspaces[0].id;
        repo.save(&data).unwrap();
        let service = DomainService::new(repo);

        let updated = service
            .update_workspace(workspace_id, " Operations ".into(), "server".into(), None)
            .unwrap();

        assert_eq!(updated.name, "Operations");
        assert_eq!(updated.icon, "server");
        let snapshot = service.snapshot().unwrap();
        assert_eq!(snapshot.workspaces[0].name, "Operations");
    }

    #[test]
    fn delete_workspace_removes_owned_records_and_keeps_the_last_one() {
        let service = DomainService::new(Repository::memory().unwrap());
        let first = service.snapshot().unwrap().workspaces[0].id;
        let second = service
            .create_workspace("Ops".into(), "server".into(), "#67e8f9".into(), None)
            .unwrap();

        service.delete_workspace(second.id).unwrap();
        let snapshot = service.snapshot().unwrap();
        assert_eq!(snapshot.workspaces.len(), 1);
        assert_eq!(snapshot.workspaces[0].id, first);
        assert!(service.delete_workspace(first).is_err());
    }

    #[test]
    fn create_workspace_keeps_the_launch_profile_off_the_sidebar() {
        let service = DomainService::new(Repository::memory().unwrap());
        let workspace = service
            .create_workspace("Ops".into(), "server".into(), "#67e8f9".into(), None)
            .unwrap();
        let snapshot = service.snapshot().unwrap();
        assert!(snapshot
            .sidebar_nodes
            .iter()
            .all(|node| node.workspace_id != workspace.id || node.kind != "profile"));
        assert_eq!(
            snapshot
                .profiles
                .iter()
                .find(|profile| profile.workspace_id == workspace.id)
                .map(|profile| profile.executable.as_str()),
            Some(snapshot.settings.default_shell.as_str())
        );
    }

    #[test]
    fn updating_the_default_shell_rewrites_workspace_launch_profiles() {
        let service = DomainService::new(Repository::memory().unwrap());
        let mut settings = service.snapshot().unwrap().settings;
        settings.default_shell = "cmd.exe".into();
        service.update_settings(settings).unwrap();
        let snapshot = service.snapshot().unwrap();
        assert_eq!(snapshot.settings.default_shell, "cmd.exe");
        assert_eq!(snapshot.profiles[0].executable, "cmd.exe");
        assert_eq!(snapshot.profiles[0].name, "CMD");
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
    fn layout_and_window_state_round_trip_through_public_service() {
        let service = DomainService::new(Repository::memory().unwrap());
        let snapshot = service.snapshot().unwrap();
        let workspace_id = snapshot.workspaces[0].id;
        let profile_id = snapshot.profiles[0].id;
        let session_id = Uuid::new_v4();
        let tab = Tab {
            id: Uuid::new_v4(),
            workspace_id,
            name: "Operations".into(),
            root: Some(PaneTree::Pane { session_id }),
            position: 0,
            organized: false,
            folder_id: None,
        };
        service
            .save_tab(
                tab.clone(),
                vec![SavedSession {
                    id: session_id,
                    workspace_id,
                    target_kind: "profile".into(),
                    target_id: profile_id,
                    working_directory: Some("C:\\Work".into()),
                }],
            )
            .unwrap();
        let window = WindowState {
            id: Uuid::new_v4(),
            active_workspace_id: Some(workspace_id),
            active_tab_id: Some(tab.id),
            x: Some(10),
            y: Some(20),
            width: 1200,
            height: 800,
            maximized: false,
            sidebar_hidden: true,
        };
        service.save_window_state(window.clone()).unwrap();
        let restored = service.snapshot().unwrap();
        assert_eq!(restored.tabs, vec![tab]);
        assert_eq!(restored.windows, vec![window]);
        assert_eq!(
            restored.saved_sessions[0].working_directory.as_deref(),
            Some("C:\\Work")
        );
    }

    #[test]
    fn an_unclean_run_is_offered_for_recovery_once() {
        let repository = Repository::memory().unwrap();
        let service = DomainService::new(repository);
        assert!(!service.begin_run().unwrap());
        assert!(!service.recovery_state().unwrap().clean_shutdown);
        // Simulate a new process opening the snapshot left by the crashed run.
        assert!(service.begin_run().unwrap());
        assert!(service.recovery_state().unwrap().recovery_available);
        service.finish_recovery().unwrap();
        assert!(!service.recovery_state().unwrap().recovery_available);
        service.mark_clean_shutdown().unwrap();
        assert!(service.recovery_state().unwrap().clean_shutdown);
    }

    #[test]
    fn a_created_profile_and_node_become_openable_organization() {
        let service = DomainService::new(Repository::memory().unwrap());
        let workspace = service.snapshot().unwrap().workspaces[0].id;

        let profile = service
            .create_profile(workspace, "CMD".into(), "cmd.exe".into(), vec![], None)
            .unwrap();
        let node = service
            .create_sidebar_node(
                workspace,
                "profile".into(),
                "CMD".into(),
                None,
                Some(profile.id),
            )
            .unwrap();

        let data = service.snapshot().unwrap();
        assert!(data.profiles.iter().any(|item| item.id == profile.id));
        assert!(data.sidebar_nodes.iter().any(|item| item.id == node.id));
        assert!(service.local_profile(workspace, profile.id).is_ok());
    }

    #[test]
    fn folders_cannot_be_nested() {
        let service = DomainService::new(Repository::memory().unwrap());
        let workspace = service.snapshot().unwrap().workspaces[0].id;
        let parent = service
            .create_sidebar_node(workspace, "folder".into(), "Parent".into(), None, None)
            .unwrap();
        let error = service
            .create_sidebar_node(
                workspace,
                "folder".into(),
                "Child".into(),
                Some(parent.id),
                None,
            )
            .unwrap_err();
        assert_eq!(error, "folders cannot be nested");
    }

    #[test]
    fn moving_a_node_renumbers_its_siblings_densely() {
        let service = DomainService::new(Repository::memory().unwrap());
        let workspace = service.snapshot().unwrap().workspaces[0].id;
        let mut ids = vec![];
        for label in ["A", "B", "C"] {
            ids.push(
                service
                    .create_sidebar_node(workspace, "folder".into(), label.into(), None, None)
                    .unwrap()
                    .id,
            );
        }

        service.move_sidebar_node(ids[2], None, 0).unwrap();

        let mut nodes = service.snapshot().unwrap().sidebar_nodes;
        nodes.sort_by_key(|node| node.position);
        assert_eq!(
            nodes
                .iter()
                .map(|node| node.label.as_str())
                .collect::<Vec<_>>(),
            vec!["C", "A", "B"]
        );
        assert_eq!(
            nodes.iter().map(|node| node.position).collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
    }

    #[test]
    fn deleting_a_node_removes_every_reference_to_its_target() {
        let service = DomainService::new(Repository::memory().unwrap());
        let workspace = service.snapshot().unwrap().workspaces[0].id;
        let identity = service
            .create_identity(workspace, "ops".into(), "ops".into(), None)
            .unwrap();
        let resource = service
            .create_resource(
                workspace,
                "Production".into(),
                Some("prod.example.net".into()),
                None,
                None,
                Some(identity.id),
            )
            .unwrap();
        let folder = service
            .create_sidebar_node(workspace, "folder".into(), "Clients".into(), None, None)
            .unwrap();
        let node = service
            .create_sidebar_node(
                workspace,
                "resource".into(),
                "Production".into(),
                Some(folder.id),
                Some(resource.id),
            )
            .unwrap();
        service
            .set_favorite(workspace, "resource".into(), resource.id, true)
            .unwrap();

        let session_id = Uuid::new_v4();
        service
            .save_tab(
                Tab {
                    id: Uuid::new_v4(),
                    workspace_id: workspace,
                    name: "Production".into(),
                    root: Some(PaneTree::Pane { session_id }),
                    position: 0,
                    organized: true,
                    folder_id: None,
                },
                vec![SavedSession {
                    id: session_id,
                    workspace_id: workspace,
                    target_kind: "resource".into(),
                    target_id: resource.id,
                    working_directory: None,
                }],
            )
            .unwrap();

        service.delete_sidebar_node(folder.id).unwrap();

        let data = service.snapshot().unwrap();
        assert!(!data
            .sidebar_nodes
            .iter()
            .any(|item| item.id == folder.id || item.id == node.id));
        assert!(data.resources.is_empty());
        assert!(data.favorites.is_empty());
        assert!(data.saved_sessions.is_empty());
        assert!(data.tabs.is_empty());
    }

    #[test]
    fn a_favorite_is_pinned_and_unpinned_without_duplicates() {
        let service = DomainService::new(Repository::memory().unwrap());
        let data = service.snapshot().unwrap();
        let workspace = data.workspaces[0].id;
        let profile = data.profiles[0].id;

        service
            .set_favorite(workspace, "profile".into(), profile, true)
            .unwrap();
        service
            .set_favorite(workspace, "profile".into(), profile, true)
            .unwrap();
        assert_eq!(service.snapshot().unwrap().favorites.len(), 1);

        service
            .set_favorite(workspace, "profile".into(), profile, false)
            .unwrap();
        assert!(service.snapshot().unwrap().favorites.is_empty());
    }

    #[test]
    fn moving_a_favorite_renumbers_the_list() {
        let service = DomainService::new(Repository::memory().unwrap());
        let data = service.snapshot().unwrap();
        let workspace = data.workspaces[0].id;
        let first = data.profiles[0].id;
        let second = service
            .create_profile(workspace, "Second".into(), "cmd.exe".into(), vec![], None)
            .unwrap()
            .id;
        service
            .set_favorite(workspace, "profile".into(), first, true)
            .unwrap();
        service
            .set_favorite(workspace, "profile".into(), second, true)
            .unwrap();
        let favorite = service
            .snapshot()
            .unwrap()
            .favorites
            .into_iter()
            .find(|item| item.target_id == second)
            .unwrap();

        service.move_favorite(favorite.id, 0).unwrap();

        let mut favorites = service.snapshot().unwrap().favorites;
        favorites.sort_by_key(|item| item.position);
        assert_eq!(
            favorites
                .iter()
                .map(|item| item.target_id)
                .collect::<Vec<_>>(),
            vec![second, first]
        );
        assert_eq!(
            favorites
                .iter()
                .map(|item| item.position)
                .collect::<Vec<_>>(),
            vec![0, 1]
        );
    }

    #[test]
    fn deleting_a_tab_drops_the_sessions_it_owned() {
        let service = DomainService::new(Repository::memory().unwrap());
        let data = service.snapshot().unwrap();
        let workspace = data.workspaces[0].id;
        let profile = data.profiles[0].id;
        let session_id = Uuid::new_v4();
        let tab_id = Uuid::new_v4();

        service
            .save_tab(
                Tab {
                    id: tab_id,
                    workspace_id: workspace,
                    name: "Shell".into(),
                    root: Some(PaneTree::Pane { session_id }),
                    position: 0,
                    organized: false,
                    folder_id: None,
                },
                vec![SavedSession {
                    id: session_id,
                    workspace_id: workspace,
                    target_kind: "profile".into(),
                    target_id: profile,
                    working_directory: None,
                }],
            )
            .unwrap();

        service.delete_tab(tab_id).unwrap();

        let data = service.snapshot().unwrap();
        assert!(data.tabs.is_empty());
        assert!(data.saved_sessions.is_empty());
    }

    #[test]
    fn a_pane_tree_stays_camel_case_on_the_wire() {
        let json = serde_json::to_string(&PaneTree::Split {
            direction: SplitDirection::Vertical,
            ratio: 0.5,
            first: Box::new(PaneTree::Pane {
                session_id: Uuid::nil(),
            }),
            second: Box::new(PaneTree::Pane {
                session_id: Uuid::nil(),
            }),
        })
        .unwrap();
        assert!(json.contains("\"sessionId\""), "{json}");
        assert!(!json.contains("session_id"), "{json}");
    }
}
