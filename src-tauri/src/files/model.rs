use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(
    tag = "operation",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Request {
    List {
        path: String,
    },
    Read {
        path: String,
    },
    Save {
        document: Document,
        original: String,
        overwrite: bool,
    },
    Create {
        path: String,
        directory: bool,
    },
    Move {
        path: String,
        destination: String,
    },
    Delete {
        path: String,
    },
    Chmod {
        path: String,
        permissions: u32,
    },
    Transfer {
        id: Uuid,
        direction: Direction,
        sources: Vec<String>,
        destination: String,
        #[serde(default)]
        completed_sources: Vec<String>,
        #[serde(default)]
        directories: std::collections::HashMap<String, String>,
        #[serde(default)]
        owner: String,
    },
    Cancel {
        id: Uuid,
    },
    Resolve {
        id: Uuid,
        choice: Collision,
        all: bool,
    },
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    #[serde(default)]
    pub owner: String,
    pub path: String,
    pub resolved_path: String,
    pub content: String,
    pub permissions: Option<u32>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub kind: &'static str,
    pub target_kind: Option<&'static str>,
    pub size: u64,
    pub modified: Option<u32>,
    pub permissions: Option<u32>,
}
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Direction {
    Upload,
    Download,
}
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Collision {
    Replace,
    Skip,
    KeepBoth,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferEvent {
    pub session_id: Uuid,
    pub id: Uuid,
    pub state: &'static str,
    pub path: String,
    pub bytes: u64,
    pub total: u64,
    pub message: Option<String>,
    pub skipped: Vec<String>,
    pub completed_sources: Vec<String>,
    pub directories: std::collections::HashMap<String, String>,
}
