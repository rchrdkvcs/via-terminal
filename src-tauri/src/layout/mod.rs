//! The persisted part of the sidebar: spaces and their pinned rows.
//!
//! The interface owns organization rules (ADR-0008); this module only checks
//! that what it is asked to persist is structurally sound, then stores it.
//! Temporary tabs and sessions never reach this document.

mod validate;

use crate::{error::AppResult, storage::Storage};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

const DOCUMENT: &str = "layout";

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
    pub color: String,
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
    pub target: Target,
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
    /// An address typed by hand that is not (yet) a vault host.
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
            color: "slate".into(),
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

    /// The saved layout, or a first-launch layout when none is valid.
    pub fn load(&self) -> AppResult<Layout> {
        let saved: Option<Layout> = self.storage.load(DOCUMENT).ok().flatten();
        match saved.filter(|layout| validate::check(layout).is_ok()) {
            Some(layout) => Ok(layout),
            None => {
                let layout = Layout::default();
                self.storage.save(DOCUMENT, &layout)?;
                Ok(layout)
            }
        }
    }

    pub fn save(&self, layout: &Layout) -> AppResult<()> {
        validate::check(layout)?;
        self.storage.save(DOCUMENT, layout)
    }
}
