use super::*;
use std::collections::HashSet;

impl AppData {
    pub fn seed() -> Self {
        let workspace_id = Uuid::new_v4();
        let profile_id = Uuid::new_v4();
        Self {
            workspaces: vec![Workspace {
                id: workspace_id,
                name: "Personnel".into(),
                icon: "terminal".into(),
                color: "#7c6ef6".into(),
                position: 0,
                default_profile_id: Some(profile_id),
            }],
            profiles: vec![LocalProfile {
                id: profile_id,
                workspace_id,
                name: shell_label(&default_shell()),
                executable: default_shell(),
                args: vec![],
                working_directory: None,
            }],
            settings: Settings::default(),
            ..Default::default()
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        let mut ids = HashSet::new();
        for id in self
            .workspaces
            .iter()
            .map(|x| x.id)
            .chain(self.profiles.iter().map(|x| x.id))
            .chain(self.resources.iter().map(|x| x.id))
            .chain(self.identities.iter().map(|x| x.id))
            .chain(self.sidebar_nodes.iter().map(|x| x.id))
            .chain(self.favorites.iter().map(|x| x.id))
            .chain(self.saved_sessions.iter().map(|x| x.id))
            .chain(self.tabs.iter().map(|x| x.id))
            .chain(self.split_groups.iter().map(|x| x.id))
            .chain(self.windows.iter().map(|x| x.id))
        {
            if !ids.insert(id) {
                return Err("duplicate id".into());
            }
        }
        let has = |id| self.workspaces.iter().any(|w| w.id == id);
        for p in &self.profiles {
            if !has(p.workspace_id) {
                return Err("profile references missing workspace".into());
            }
        }
        for i in &self.identities {
            if !has(i.workspace_id) {
                return Err("identity references missing workspace".into());
            }
        }
        for w in &self.workspaces {
            if let Some(pid) = w.default_profile_id {
                let p = self
                    .profiles
                    .iter()
                    .find(|p| p.id == pid)
                    .ok_or("default profile missing")?;
                if p.workspace_id != w.id {
                    return Err("cross-workspace default profile reference".into());
                }
            }
        }
        for r in &self.resources {
            if !has(r.workspace_id) {
                return Err("resource references missing workspace".into());
            }
            if let Some(id) = r.identity_id {
                let i = self
                    .identities
                    .iter()
                    .find(|i| i.id == id)
                    .ok_or("resource identity missing")?;
                if i.workspace_id != r.workspace_id {
                    return Err("cross-workspace identity reference".into());
                }
            }
        }
        for node in &self.sidebar_nodes {
            if !has(node.workspace_id) {
                return Err("sidebar node references missing workspace".into());
            }
            if let Some(parent_id) = node.parent_id {
                if node.kind == "folder" {
                    return Err("folders cannot be nested".into());
                }
                let parent = self
                    .sidebar_nodes
                    .iter()
                    .find(|candidate| candidate.id == parent_id)
                    .ok_or("sidebar parent missing")?;
                if parent.workspace_id != node.workspace_id {
                    return Err("cross-workspace sidebar parent reference".into());
                }
                if parent.kind != "folder" {
                    return Err("sidebar parent is not a folder".into());
                }
            }
            match (node.kind.as_str(), node.target_id) {
                ("folder", None) => {}
                ("profile", Some(target_id)) => {
                    let target = self
                        .profiles
                        .iter()
                        .find(|item| item.id == target_id)
                        .ok_or("sidebar profile target missing")?;
                    if target.workspace_id != node.workspace_id {
                        return Err("cross-workspace sidebar target reference".into());
                    }
                }
                ("resource", Some(target_id)) => {
                    let target = self
                        .resources
                        .iter()
                        .find(|item| item.id == target_id)
                        .ok_or("sidebar resource target missing")?;
                    if target.workspace_id != node.workspace_id {
                        return Err("cross-workspace sidebar target reference".into());
                    }
                }
                _ => return Err("invalid sidebar node kind or target".into()),
            }
            let mut ancestors = HashSet::new();
            let mut parent_id = node.parent_id;
            while let Some(id) = parent_id {
                if !ancestors.insert(id) || id == node.id {
                    return Err("sidebar parent cycle".into());
                }
                parent_id = self
                    .sidebar_nodes
                    .iter()
                    .find(|candidate| candidate.id == id)
                    .and_then(|parent| parent.parent_id);
            }
        }
        for favorite in &self.favorites {
            if !has(favorite.workspace_id) {
                return Err("favorite references missing workspace".into());
            }
            let owns_target = match favorite.target_kind.as_str() {
                "profile" => self.profiles.iter().any(|item| {
                    item.id == favorite.target_id && item.workspace_id == favorite.workspace_id
                }),
                "resource" => self.resources.iter().any(|item| {
                    item.id == favorite.target_id && item.workspace_id == favorite.workspace_id
                }),
                _ => return Err("invalid favorite target kind".into()),
            };
            if !owns_target {
                return Err("favorite target missing or belongs to another workspace".into());
            }
        }
        for session in &self.saved_sessions {
            if !has(session.workspace_id) {
                return Err("saved session references missing workspace".into());
            }
            let owns_target = match session.target_kind.as_str() {
                "profile" => self.profiles.iter().any(|item| {
                    item.id == session.target_id && item.workspace_id == session.workspace_id
                }),
                "resource" => self.resources.iter().any(|item| {
                    item.id == session.target_id && item.workspace_id == session.workspace_id
                }),
                _ => return Err("invalid saved session target kind".into()),
            };
            if !owns_target {
                return Err("saved session target missing or belongs to another workspace".into());
            }
        }
        let mut pane_sessions = HashSet::new();
        for tab in &self.tabs {
            if !has(tab.workspace_id) {
                return Err("tab references missing workspace".into());
            }
            if let Some(root) = &tab.root {
                if !matches!(root, PaneTree::Pane { .. }) {
                    return Err("a tab represents exactly one session".into());
                }
                validate_pane_tree(
                    root,
                    tab.workspace_id,
                    &self.saved_sessions,
                    &mut pane_sessions,
                )?;
            }
            if let Some(folder_id) = tab.folder_id {
                let folder = self
                    .sidebar_nodes
                    .iter()
                    .find(|node| node.id == folder_id && node.kind == "folder")
                    .ok_or("tab folder missing")?;
                if folder.workspace_id != tab.workspace_id || !tab.organized {
                    return Err("tab folder requires a pinned tab in the same workspace".into());
                }
            }
        }
        let mut grouped_tabs = HashSet::new();
        for group in &self.split_groups {
            if group.tab_ids.len() < 2 || group.tab_ids.len() > 4 {
                return Err("split group must contain two to four tabs".into());
            }
            let mut members = HashSet::new();
            for tab_id in &group.tab_ids {
                if !members.insert(*tab_id) || !grouped_tabs.insert(*tab_id) {
                    return Err("tab belongs to multiple split groups".into());
                }
                let tab = self
                    .tabs
                    .iter()
                    .find(|tab| tab.id == *tab_id)
                    .ok_or("split tab missing")?;
                if tab.workspace_id != group.workspace_id || !tab.organized {
                    return Err("split group members must be pinned in one workspace".into());
                }
            }
            let mut leaves = Vec::new();
            split_tab_leaves(&group.root, &mut leaves)?;
            if leaves != group.tab_ids {
                return Err("split tree does not match members".into());
            }
        }
        for window in &self.windows {
            if window.width == 0 || window.height == 0 {
                return Err("invalid window dimensions".into());
            }
            if let Some(workspace_id) = window.active_workspace_id {
                if !has(workspace_id) {
                    return Err("window references missing workspace".into());
                }
                if let Some(tab_id) = window.active_tab_id {
                    let tab = self
                        .tabs
                        .iter()
                        .find(|tab| tab.id == tab_id)
                        .ok_or("window references missing tab")?;
                    if tab.workspace_id != workspace_id {
                        return Err("cross-workspace window tab reference".into());
                    }
                }
            } else if window.active_tab_id.is_some() {
                return Err("window tab requires an active workspace".into());
            }
        }
        Ok(())
    }
}

fn split_tab_leaves(tree: &SplitTabTree, leaves: &mut Vec<Id>) -> Result<(), String> {
    match tree {
        SplitTabTree::Tab { tab_id } => leaves.push(*tab_id),
        SplitTabTree::Split {
            ratio,
            first,
            second,
            ..
        } => {
            if !ratio.is_finite() || *ratio < 0.15 || *ratio > 0.85 {
                return Err("invalid split group ratio".into());
            }
            split_tab_leaves(first, leaves)?;
            split_tab_leaves(second, leaves)?;
        }
    }
    Ok(())
}

fn validate_pane_tree(
    tree: &PaneTree,
    workspace_id: Id,
    sessions: &[SavedSession],
    seen: &mut HashSet<Id>,
) -> Result<(), String> {
    match tree {
        PaneTree::Pane { session_id } => {
            if !seen.insert(*session_id) {
                return Err("session appears more than once in tab".into());
            }
            let session = sessions
                .iter()
                .find(|session| session.id == *session_id)
                .ok_or("pane references missing saved session")?;
            if session.workspace_id != workspace_id {
                return Err("cross-workspace pane session reference".into());
            }
        }
        PaneTree::Split {
            ratio,
            first,
            second,
            ..
        } => {
            if !ratio.is_finite() || *ratio <= 0.05 || *ratio >= 0.95 {
                return Err("invalid pane split ratio".into());
            }
            validate_pane_tree(first, workspace_id, sessions, seen)?;
            validate_pane_tree(second, workspace_id, sessions, seen)?;
        }
    }
    Ok(())
}
