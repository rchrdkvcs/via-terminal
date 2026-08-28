use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;
pub type Id = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: Id,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub position: i64,
    pub default_profile_id: Option<Id>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalProfile {
    pub id: Id,
    pub workspace_id: Id,
    pub name: String,
    pub executable: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub working_directory: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Resource {
    pub id: Id,
    pub workspace_id: Id,
    pub name: String,
    pub ssh_alias: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub identity_id: Option<Id>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub id: Id,
    pub workspace_id: Id,
    pub name: String,
    pub username: String,
    pub identity_file: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SidebarNode {
    pub id: Id,
    pub workspace_id: Id,
    pub parent_id: Option<Id>,
    pub kind: String,
    pub label: String,
    pub target_id: Option<Id>,
    pub position: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Favorite {
    pub id: Id,
    pub workspace_id: Id,
    pub target_kind: String,
    pub target_id: Id,
    pub position: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SavedSession {
    pub id: Id,
    pub workspace_id: Id,
    /// `profile` for a local shell, `resource` for SSH.
    pub target_kind: String,
    pub target_id: Id,
    #[serde(default)]
    pub working_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PaneTree {
    Pane {
        session_id: Id,
    },
    Split {
        direction: SplitDirection,
        /// Fraction of the available space occupied by the first child.
        ratio: f32,
        first: Box<PaneTree>,
        second: Box<PaneTree>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: Id,
    pub workspace_id: Id,
    pub name: String,
    #[serde(default)]
    pub root: Option<PaneTree>,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub id: Id,
    #[serde(default)]
    pub active_workspace_id: Option<Id>,
    #[serde(default)]
    pub active_tab_id: Option<Id>,
    #[serde(default)]
    pub x: Option<i32>,
    #[serde(default)]
    pub y: Option<i32>,
    #[serde(default = "default_window_width")]
    pub width: u32,
    #[serde(default = "default_window_height")]
    pub height: u32,
    #[serde(default)]
    pub maximized: bool,
    #[serde(default)]
    pub sidebar_hidden: bool,
}

fn default_window_width() -> u32 {
    1100
}
fn default_window_height() -> u32 {
    720
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    #[serde(default = "default_true")]
    pub clean_shutdown: bool,
    #[serde(default)]
    pub recovery_available: bool,
}
fn default_true() -> bool {
    true
}
impl Default for AppState {
    fn default() -> Self {
        Self {
            clean_shutdown: true,
            recovery_available: false,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: String,
    pub density: String,
    pub font_family: String,
    pub font_size: u16,
    pub restore_local_sessions: bool,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            density: "comfortable".into(),
            font_family: "Cascadia Mono".into(),
            font_size: 14,
            restore_local_sessions: false,
        }
    }
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    #[serde(default)]
    pub workspaces: Vec<Workspace>,
    #[serde(default)]
    pub profiles: Vec<LocalProfile>,
    #[serde(default)]
    pub resources: Vec<Resource>,
    #[serde(default)]
    pub identities: Vec<Identity>,
    #[serde(default)]
    pub sidebar_nodes: Vec<SidebarNode>,
    #[serde(default)]
    pub favorites: Vec<Favorite>,
    #[serde(default)]
    pub saved_sessions: Vec<SavedSession>,
    #[serde(default)]
    pub tabs: Vec<Tab>,
    #[serde(default)]
    pub windows: Vec<WindowState>,
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub app_state: AppState,
}
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
                name: "PowerShell".into(),
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
                validate_pane_tree(
                    root,
                    tab.workspace_id,
                    &self.saved_sessions,
                    &mut pane_sessions,
                )?;
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
pub(crate) fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".into()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_duplicate_ids_across_entity_types() {
        let mut data = AppData::seed();
        let workspace_id = data.workspaces[0].id;
        data.identities.push(Identity {
            id: workspace_id,
            workspace_id,
            name: "Admin".into(),
            username: "root".into(),
            identity_file: None,
        });
        assert_eq!(data.validate().unwrap_err(), "duplicate id");
    }

    #[test]
    fn rejects_sidebar_and_favorite_cross_workspace_references() {
        let mut data = AppData::seed();
        let first = data.workspaces[0].id;
        let second = Uuid::new_v4();
        data.workspaces.push(Workspace {
            id: second,
            name: "Other".into(),
            icon: "terminal".into(),
            color: "#000".into(),
            position: 1,
            default_profile_id: None,
        });
        let profile_id = data.profiles[0].id;
        data.sidebar_nodes.push(SidebarNode {
            id: Uuid::new_v4(),
            workspace_id: second,
            parent_id: None,
            kind: "profile".into(),
            label: "Wrong".into(),
            target_id: Some(profile_id),
            position: 0,
        });
        assert!(data
            .validate()
            .unwrap_err()
            .contains("cross-workspace sidebar"));
        data.sidebar_nodes.clear();
        data.favorites.push(Favorite {
            id: Uuid::new_v4(),
            workspace_id: first,
            target_kind: "resource".into(),
            target_id: Uuid::new_v4(),
            position: 0,
        });
        assert!(data.validate().unwrap_err().contains("favorite target"));
    }

    #[test]
    fn rejects_sidebar_parent_cycles() {
        let mut data = AppData::seed();
        let workspace_id = data.workspaces[0].id;
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        data.sidebar_nodes.push(SidebarNode {
            id: first,
            workspace_id,
            parent_id: Some(second),
            kind: "folder".into(),
            label: "First".into(),
            target_id: None,
            position: 0,
        });
        data.sidebar_nodes.push(SidebarNode {
            id: second,
            workspace_id,
            parent_id: Some(first),
            kind: "folder".into(),
            label: "Second".into(),
            target_id: None,
            position: 0,
        });
        assert_eq!(data.validate().unwrap_err(), "sidebar parent cycle");
    }

    #[test]
    fn old_snapshots_receive_empty_layout_and_clean_app_state() {
        let data: AppData = serde_json::from_str(r#"{"workspaces":[],"profiles":[],"resources":[],"identities":[],"sidebarNodes":[],"favorites":[],"settings":{"theme":"system","density":"comfortable","fontFamily":"Cascadia Mono","fontSize":14,"restoreLocalSessions":false}}"#).unwrap();
        assert!(data.tabs.is_empty());
        assert!(data.windows.is_empty());
        assert_eq!(data.app_state, AppState::default());
    }

    #[test]
    fn rejects_a_pane_that_crosses_workspace_boundary() {
        let mut data = AppData::seed();
        let first = data.workspaces[0].id;
        let profile = data.profiles[0].id;
        let second = Uuid::new_v4();
        data.workspaces.push(Workspace {
            id: second,
            name: "Other".into(),
            icon: "terminal".into(),
            color: "#000".into(),
            position: 1,
            default_profile_id: None,
        });
        let session_id = Uuid::new_v4();
        data.saved_sessions.push(SavedSession {
            id: session_id,
            workspace_id: first,
            target_kind: "profile".into(),
            target_id: profile,
            working_directory: None,
        });
        data.tabs.push(Tab {
            id: Uuid::new_v4(),
            workspace_id: second,
            name: "Wrong".into(),
            root: Some(PaneTree::Pane { session_id }),
            position: 0,
        });
        assert_eq!(
            data.validate().unwrap_err(),
            "cross-workspace pane session reference"
        );
    }
}
