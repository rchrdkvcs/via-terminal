use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{Arc, Mutex},
};
use uuid::Uuid;
pub struct Session {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn Child + Send + Sync>,
}
#[derive(Default)]
pub struct SessionManager {
    sessions: Mutex<HashMap<Uuid, Session>>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnedSession {
    pub id: Uuid,
}
impl SessionManager {
    pub fn spawn<F>(
        &self,
        executable: &str,
        args: &[String],
        cwd: Option<&str>,
        cols: u16,
        rows: u16,
        on_output: F,
    ) -> Result<SpawnedSession, String>
    where
        F: Fn(Uuid, Vec<u8>) + Send + 'static,
    {
        self.spawn_with_exit(executable, args, cwd, cols, rows, on_output, |_| {})
    }

    #[allow(clippy::too_many_arguments)]
    pub fn spawn_with_exit<F, E>(
        &self,
        executable: &str,
        args: &[String],
        cwd: Option<&str>,
        cols: u16,
        rows: u16,
        on_output: F,
        on_exit: E,
    ) -> Result<SpawnedSession, String>
    where
        F: Fn(Uuid, Vec<u8>) + Send + 'static,
        E: FnOnce(Uuid) + Send + 'static,
    {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        let mut cmd = CommandBuilder::new(executable);
        for arg in args {
            cmd.arg(arg);
        }
        if let Some(cwd) = cwd {
            cmd.cwd(cwd)
        }
        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let id = Uuid::new_v4();
        std::thread::spawn(move || {
            let mut buf = vec![0; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => on_output(id, buf[..n].to_vec()),
                }
            }
            on_exit(id);
        });
        self.sessions.lock().unwrap().insert(
            id,
            Session {
                writer,
                master: pair.master,
                child,
            },
        );
        Ok(SpawnedSession { id })
    }
    pub fn write(&self, id: Uuid, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions.get_mut(&id).ok_or("session not found")?;
        session.writer.write_all(data).map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())
    }
    pub fn resize(&self, id: Uuid, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions.get(&id).ok_or("session not found")?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }
    pub fn close(&self, id: Uuid) -> Result<(), String> {
        let mut session = self
            .sessions
            .lock()
            .unwrap()
            .remove(&id)
            .ok_or("session not found")?;
        session.child.kill().map_err(|e| e.to_string())
    }
    pub fn contains(&self, id: Uuid) -> bool {
        self.sessions.lock().unwrap().contains_key(&id)
    }
}
pub type SharedSessions = Arc<SessionManager>;
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unknown_session_operations_fail() {
        let s = SessionManager::default();
        let id = Uuid::new_v4();
        assert!(s.write(id, b"hello").is_err());
        assert!(s.resize(id, 80, 24).is_err());
        assert!(s.close(id).is_err())
    }
}
