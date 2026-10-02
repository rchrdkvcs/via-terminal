//! SQLite persistence: named JSON documents and opaque blobs.
//!
//! Callers never see SQL. A document is a whole value replaced atomically, which
//! is enough for a single-window application whose data fits in memory.

use crate::error::AppResult;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Serialize};
use std::{path::Path, sync::Mutex};

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS documents(key TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS blobs(key TEXT PRIMARY KEY, value BLOB NOT NULL);
";

pub struct Storage {
    connection: Mutex<Connection>,
}

impl Storage {
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        Self::from_connection(Connection::open(path)?)
    }

    pub fn memory() -> AppResult<Self> {
        Self::from_connection(Connection::open_in_memory()?)
    }

    fn from_connection(connection: Connection) -> AppResult<Self> {
        connection.execute_batch(SCHEMA)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    /// The stored document, or `None` when it was never saved.
    pub fn load<T: DeserializeOwned>(&self, key: &str) -> AppResult<Option<T>> {
        let json: Option<String> = self
            .connection
            .lock()
            .unwrap()
            .query_row("SELECT json FROM documents WHERE key=?1", [key], |row| {
                row.get(0)
            })
            .optional()?;
        Ok(match json {
            Some(json) => Some(serde_json::from_str(&json)?),
            None => None,
        })
    }

    pub fn save<T: Serialize>(&self, key: &str, value: &T) -> AppResult<()> {
        let json = serde_json::to_string(value)?;
        self.connection.lock().unwrap().execute(
            "INSERT INTO documents(key,json) VALUES(?1,?2)
             ON CONFLICT(key) DO UPDATE SET json=excluded.json",
            params![key, json],
        )?;
        Ok(())
    }

    pub fn get_blob(&self, key: &str) -> AppResult<Option<Vec<u8>>> {
        Ok(self
            .connection
            .lock()
            .unwrap()
            .query_row("SELECT value FROM blobs WHERE key=?1", [key], |row| {
                row.get(0)
            })
            .optional()?)
    }

    pub fn put_blob(&self, key: &str, value: &[u8]) -> AppResult<()> {
        self.connection.lock().unwrap().execute(
            "INSERT INTO blobs(key,value) VALUES(?1,?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn delete_blob(&self, key: &str) -> AppResult<()> {
        self.connection
            .lock()
            .unwrap()
            .execute("DELETE FROM blobs WHERE key=?1", [key])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_round_trip_and_replace() {
        let storage = Storage::memory().unwrap();
        assert_eq!(storage.load::<Vec<u8>>("doc").unwrap(), None);
        storage.save("doc", &vec![1u8, 2]).unwrap();
        storage.save("doc", &vec![3u8]).unwrap();
        assert_eq!(storage.load::<Vec<u8>>("doc").unwrap(), Some(vec![3]));
    }

    #[test]
    fn blobs_round_trip_and_delete() {
        let storage = Storage::memory().unwrap();
        storage.put_blob("a", b"secret").unwrap();
        assert_eq!(
            storage.get_blob("a").unwrap().as_deref(),
            Some(&b"secret"[..])
        );
        storage.delete_blob("a").unwrap();
        assert_eq!(storage.get_blob("a").unwrap(), None);
    }
}
