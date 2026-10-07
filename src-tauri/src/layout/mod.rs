mod validate;

use crate::{error::AppResult, storage::Storage};
use serde::{Deserialize, Serialize};
use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

const DOCUMENT: &str = "layout";
const BACKUP_PREFIX: &str = "layout.invalid.";

fn backup_key() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis());
    format!("{BACKUP_PREFIX}{millis}")
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Layout {
    pub active_space_id: Option<Uuid>,
    pub sidebar: Sidebar,
    pub spaces: Vec<Space>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sidebar {
    pub width: u16,
    pub visible: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Space {
    pub id: Uuid,
    pub name: String,
    pub icon: String,
    pub default_shell: Option<String>,
    pub pinned: Vec<Entry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Entry {
    Tab(Tab),
    Split(Split),
    Folder {
        id: Uuid,
        name: String,
        open: bool,
        rows: Vec<Row>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Row {
    Tab(Tab),
    Split(Split),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: Uuid,
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub view: Option<View>,
    pub target: Target,
}

/// What a remote tab shows instead of its terminal. A tab without a view is a terminal.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum View {
    Files { path: Option<String> },
    Document { path: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Split {
    pub id: Uuid,
    pub direction: Direction,
    pub sizes: Vec<f32>,
    pub tabs: Vec<Tab>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Direction {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Target {
    Local {
        shell: Option<String>,
        cwd: Option<String>,
    },
    Host {
        host_id: Uuid,
    },

    Quick {
        address: String,
        port: Option<u16>,
        username: Option<String>,
    },
}

impl Default for Layout {
    fn default() -> Self {
        let space = Space {
            id: Uuid::new_v4(),
            name: "Personnel".into(),
            icon: "terminal".into(),
            default_shell: None,
            pinned: vec![],
        };
        Self {
            active_space_id: Some(space.id),
            sidebar: Sidebar {
                width: 264,
                visible: true,
            },
            spaces: vec![space],
        }
    }
}

pub struct Layouts {
    storage: Arc<Storage>,
}

impl Layouts {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self { storage }
    }

    pub fn load(&self) -> AppResult<Layout> {
        let raw: Option<serde_json::Value> = self.storage.load(DOCUMENT).ok().flatten();
        let saved = raw
            .clone()
            .and_then(|value| serde_json::from_value::<Layout>(value).ok());
        if let Some(layout) = saved.filter(|layout| validate::check(layout).is_ok()) {
            return Ok(layout);
        }
        if let Some(raw) = raw {
            self.storage.save(&backup_key(), &raw)?;
        }
        let layout = Layout::default();
        self.storage.save(DOCUMENT, &layout)?;
        Ok(layout)
    }

    pub fn save(&self, layout: &Layout) -> AppResult<()> {
        validate::check(layout)?;
        self.storage.save(DOCUMENT, layout)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn backups(storage: &Storage) -> Vec<serde_json::Value> {
        storage.documents_with_prefix(BACKUP_PREFIX).unwrap()
    }

    #[test]
    fn invalid_stored_layout_is_kept_aside_before_falling_back() {
        let storage = Arc::new(Storage::memory().unwrap());
        let mut invalid = Layout::default();
        invalid.spaces[0].name = "x".repeat(200);
        storage.save(DOCUMENT, &invalid).unwrap();

        let layouts = Layouts::new(storage.clone());
        let loaded = layouts.load().unwrap();

        assert_ne!(loaded, invalid);
        assert!(validate::check(&loaded).is_ok());
        assert_eq!(
            backups(&storage),
            vec![serde_json::to_value(&invalid).unwrap()]
        );
        assert_eq!(layouts.load().unwrap(), loaded);
        assert_eq!(backups(&storage).len(), 1);
    }

    #[test]
    fn unreadable_stored_layout_is_kept_aside() {
        let storage = Arc::new(Storage::memory().unwrap());
        let unreadable = serde_json::json!({ "spaces": "not a list" });
        storage.save(DOCUMENT, &unreadable).unwrap();

        Layouts::new(storage.clone()).load().unwrap();

        assert_eq!(backups(&storage), vec![unreadable]);
    }

    #[test]
    fn missing_layout_creates_default_without_backup() {
        let storage = Arc::new(Storage::memory().unwrap());
        let loaded = Layouts::new(storage.clone()).load().unwrap();
        assert_eq!(storage.load::<Layout>(DOCUMENT).unwrap(), Some(loaded));
        assert!(backups(&storage).is_empty());
    }
}
