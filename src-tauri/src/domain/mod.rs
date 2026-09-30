mod validation;
#[cfg(test)]
mod validation_tests;

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

/// Non-secret connection configuration. Saving this never starts a session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshHostInput {
    pub workspace_id: Id,
    pub id: Option<Id>,
    pub name: String,
    pub host: Option<String>,
    pub ssh_alias: Option<String>,
    pub port: Option<u16>,
    pub identity_id: Option<Id>,
    pub identity_name: String,
    pub username: String,
    pub identity_file: Option<String>,
    pub parent_id: Option<Id>,
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
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
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
    #[serde(default)]
    pub organized: bool,
    /// Folder this tab lives in. Local terminals dropped onto a folder use this
    /// instead of a sidebar node, because they all share the default profile.
    #[serde(default)]
    pub folder_id: Option<Id>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SplitTabTree {
    Tab {
        tab_id: Id,
    },
    Split {
        direction: SplitDirection,
        ratio: f32,
        first: Box<SplitTabTree>,
        second: Box<SplitTabTree>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SplitGroup {
    pub id: Id,
    pub workspace_id: Id,
    pub tab_ids: Vec<Id>,
    pub root: SplitTabTree,
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
    pub font_family: String,
    pub font_size: u16,
    /// Executable used by every workspace default launch profile.
    #[serde(default = "default_shell")]
    pub default_shell: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            font_family: "Cascadia Mono".into(),
            font_size: 14,
            default_shell: default_shell(),
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
    pub split_groups: Vec<SplitGroup>,
    #[serde(default)]
    pub windows: Vec<WindowState>,
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub app_state: AppState,
}
pub(crate) fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".into()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into())
    }
}

pub(crate) fn shell_label(executable: &str) -> String {
    let name = std::path::Path::new(executable)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(executable);
    match name.to_ascii_lowercase().as_str() {
        "powershell.exe" => "PowerShell".into(),
        "pwsh.exe" => "PowerShell 7".into(),
        "cmd.exe" => "CMD".into(),
        "wsl.exe" => "WSL".into(),
        "zsh" => "Zsh".into(),
        "fish" => "Fish".into(),
        "pwsh" => "PowerShell 7".into(),
        "bash.exe" | "bash" => {
            if cfg!(windows) {
                "Git Bash".into()
            } else {
                "Bash".into()
            }
        }
        "sh" => "Sh".into(),
        _ => name.to_string(),
    }
}
