//! Wire types of the remote explorer, generated into `src/ipc/bindings.ts`.
use super::Owner;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Deserialize, TS)]
#[serde(
    tag = "operation",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
#[ts(rename = "FileRequest")]
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
        parent: String,
        name: String,
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
    Transfer(TransferPlan),
    Cancel {
        id: Uuid,
    },
    Resolve {
        id: Uuid,
        choice: Collision,
        all: bool,
    },
}
/// Answer to a request: a listing, a document, or nothing for commands.
#[derive(Debug, Serialize, TS)]
#[serde(untagged)]
#[ts(rename = "FilesReply")]
pub enum Reply {
    Listing(Listing),
    Document(Document),
    Done,
}
#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TransferPlan {
    pub id: Uuid,
    pub owner: Owner,
    pub direction: Direction,
    pub sources: Vec<String>,
    pub destination: String,
    #[serde(default)]
    #[ts(as = "Option<_>", optional)]
    pub completed_sources: Vec<String>,
    #[serde(default)]
    #[ts(as = "Option<_>", optional)]
    pub directories: HashMap<String, String>,
}
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub owner: Owner,
    pub path: String,
    pub entries: Vec<Entry>,
}
#[derive(Debug, Clone, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "RemoteText")]
pub struct Document {
    pub owner: Owner,
    pub path: String,
    pub resolved_path: String,
    pub content: String,
    pub permissions: Option<u32>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum EntryKind {
    File,
    Directory,
    Link,
    Other,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "RemoteEntry")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    pub target_kind: Option<EntryKind>,
    pub size: u64,
    pub modified: Option<u32>,
    pub permissions: Option<u32>,
}
#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "TransferDirection")]
pub enum Direction {
    Upload,
    Download,
}
#[derive(Debug, Clone, Copy, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Collision {
    Replace,
    Skip,
    KeepBoth,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "NativeTransferState")]
pub enum TransferState {
    Running,
    Conflict,
    Completed,
    Failed,
    Cancelled,
}
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TransferEvent {
    pub session_id: Uuid,
    pub id: Uuid,
    pub direction: Direction,
    pub state: TransferState,
    pub path: String,
    pub bytes: u64,
    pub total: u64,
    pub message: Option<String>,
    pub skipped: Vec<String>,
    pub completed_sources: Vec<String>,
    pub directories: HashMap<String, String>,
}
