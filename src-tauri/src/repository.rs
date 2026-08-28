use crate::domain::AppData;
use rusqlite::{params, Connection};
use std::path::Path;
pub struct Repository {
    connection: Connection,
}
impl Repository {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        Self::from_connection(Connection::open(path).map_err(|e| e.to_string())?)
    }
    pub fn memory() -> Result<Self, String> {
        Self::from_connection(Connection::open_in_memory().map_err(|e| e.to_string())?)
    }
    fn from_connection(connection: Connection) -> Result<Self, String> {
        connection.execute_batch("PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS private_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);").map_err(|e|e.to_string())?;
        let repo = Self { connection };
        if repo.load()?.is_none() {
            repo.save(&AppData::seed())?
        }
        Ok(repo)
    }
    pub fn load(&self) -> Result<Option<AppData>, String> {
        let mut stmt = self
            .connection
            .prepare("SELECT json FROM snapshots WHERE id=1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        match rows.next().map_err(|e| e.to_string())? {
            Some(row) => {
                let json: String = row.get(0).map_err(|e| e.to_string())?;
                Ok(Some(
                    serde_json::from_str(&json).map_err(|e| e.to_string())?,
                ))
            }
            None => Ok(None),
        }
    }
    pub fn save(&self, data: &AppData) -> Result<(), String> {
        data.validate()?;
        let json = serde_json::to_string(data).map_err(|e| e.to_string())?;
        self.connection.execute("INSERT INTO snapshots(id,json) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET json=excluded.json",params![json]).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn private_setting(&self, key: &str) -> Result<Option<String>, String> {
        let result = self.connection.query_row(
            "SELECT value FROM private_settings WHERE key=?1",
            params![key],
            |row| row.get(0),
        );
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }
    pub fn set_private_setting(&self, key: &str, value: &str) -> Result<(), String> {
        self.connection.execute(
            "INSERT INTO private_settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        ).map(|_| ()).map_err(|error| error.to_string())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Identity, Resource, Workspace};
    use uuid::Uuid;
    #[test]
    fn round_trip() {
        let r = Repository::memory().unwrap();
        let mut d = r.load().unwrap().unwrap();
        d.workspaces[0].name = "Client A".into();
        r.save(&d).unwrap();
        assert_eq!(r.load().unwrap().unwrap().workspaces[0].name, "Client A")
    }
    #[test]
    fn rejects_cross_workspace_identity() {
        let r = Repository::memory().unwrap();
        let mut d = r.load().unwrap().unwrap();
        let a = d.workspaces[0].id;
        let b = Uuid::new_v4();
        d.workspaces.push(Workspace {
            id: b,
            name: "B".into(),
            icon: "b".into(),
            color: "#000".into(),
            position: 1,
            default_profile_id: None,
        });
        let iid = Uuid::new_v4();
        d.identities.push(Identity {
            id: iid,
            workspace_id: a,
            name: "Admin".into(),
            username: "root".into(),
            identity_file: None,
        });
        d.resources.push(Resource {
            id: Uuid::new_v4(),
            workspace_id: b,
            name: "Server".into(),
            ssh_alias: None,
            host: Some("same.host".into()),
            port: Some(22),
            identity_id: Some(iid),
        });
        assert!(r.save(&d).unwrap_err().contains("cross-workspace"))
    }
}
