mod transaction;
pub(crate) use transaction::BlobChange;

use crate::error::AppResult;
use rusqlite::{Connection, OptionalExtension};
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
        Self::prepare(Connection::open(path)?)
    }

    pub fn memory() -> AppResult<Self> {
        Self::prepare(Connection::open_in_memory()?)
    }

    #[cfg(test)]
    pub(crate) fn with_faults(connection: Connection, faults: &str) -> AppResult<Self> {
        connection.execute_batch(SCHEMA)?;
        connection.execute_batch(faults)?;
        Self::prepare(connection)
    }

    fn prepare(connection: Connection) -> AppResult<Self> {
        connection.execute_batch(SCHEMA)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

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
        self.save_with_blobs(key, value, &[])
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
        let put = BlobChange::Put {
            key: "a".into(),
            value: b"secret".to_vec(),
        };
        storage.save_with_blobs("doc", &1, &[put]).unwrap();
        assert_eq!(
            storage.get_blob("a").unwrap().as_deref(),
            Some(&b"secret"[..])
        );
        let delete = BlobChange::Delete { key: "a".into() };
        storage.save_with_blobs("doc", &2, &[delete]).unwrap();
        assert_eq!(storage.get_blob("a").unwrap(), None);
        assert_eq!(storage.load::<u8>("doc").unwrap(), Some(2));
    }
}
