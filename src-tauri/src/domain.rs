use serde::{Deserialize, Serialize};
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
    pub settings: Settings,
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
        Ok(())
    }
}
fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".into()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into())
    }
}
