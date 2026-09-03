use super::*;

impl DomainService {
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
}
