use super::Storage;
use crate::error::AppResult;
use rusqlite::params;
use serde::Serialize;

pub(crate) enum BlobChange {
    Put { key: String, value: Vec<u8> },
    Delete { key: String },
}

impl Storage {
    pub(crate) fn save_with_blobs<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        blobs: &[BlobChange],
    ) -> AppResult<()> {
        let json = serde_json::to_string(value)?;
        let mut connection = self.connection.lock().unwrap();
        let transaction = connection.transaction()?;
        transaction.execute(
            "INSERT INTO documents(key,json) VALUES(?1,?2)
             ON CONFLICT(key) DO UPDATE SET json=excluded.json",
            params![key, json],
        )?;
        for blob in blobs {
            match blob {
                BlobChange::Put { key, value } => {
                    transaction.execute(
                        "INSERT INTO blobs(key,value) VALUES(?1,?2)
                         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                        params![key, value],
                    )?;
                }
                BlobChange::Delete { key } => {
                    transaction.execute("DELETE FROM blobs WHERE key=?1", [key])?;
                }
            }
        }
        transaction.commit()?;
        Ok(())
    }
}
