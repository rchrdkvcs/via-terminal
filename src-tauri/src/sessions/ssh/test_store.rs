//! A vault stand-in that answers with a fixed key status and records calls.

use super::{ConnectPlan, ConnectionStore, HostKeyStatus, Remembered, ServerKey};
use crate::error::AppResult;
use std::sync::Mutex;
use uuid::Uuid;

pub struct FakeStore {
    status: HostKeyStatus,
    pub trusted: Mutex<Vec<ServerKey>>,
    /// Username and remembered password of each `authenticated` call.
    pub authenticated: Mutex<Vec<(String, Option<String>)>>,
}

impl ConnectionStore for FakeStore {
    fn host_key_status(&self, _: &str, _: u16, _: &ServerKey) -> HostKeyStatus {
        self.status.clone()
    }

    fn trust_host_key(&self, _: &str, _: u16, key: &ServerKey) -> AppResult<()> {
        self.trusted.lock().unwrap().push(key.clone());
        Ok(())
    }

    fn authenticated(
        &self,
        _: &ConnectPlan,
        username: &str,
        remembered: Remembered,
    ) -> AppResult<Option<Uuid>> {
        let password = remembered.password.map(|password| password.to_string());
        self.authenticated
            .lock()
            .unwrap()
            .push((username.to_string(), password));
        Ok(None)
    }
}

impl FakeStore {
    pub fn new(status: HostKeyStatus) -> Self {
        Self {
            status,
            trusted: Mutex::default(),
            authenticated: Mutex::default(),
        }
    }
}
