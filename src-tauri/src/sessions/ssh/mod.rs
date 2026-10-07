mod asker;
mod attempts;
mod auth;
mod channel;
mod connect;
mod failure;
mod handler;
mod interactive;
mod keys;
pub mod plan;
mod sftp;

pub use plan::*;

use super::{events::EventSink, prompts::Prompts, Ending, SessionIo, Size};
use crate::error::{AppError, AppResult};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::sync::{mpsc, watch};
use uuid::Uuid;

pub struct Context {
    pub id: Uuid,
    pub sink: Arc<dyn EventSink>,
    pub prompts: Arc<Prompts>,
    pub store: Arc<dyn ConnectionStore>,
    pub ending: Ending,
}

enum Command {
    Write(Vec<u8>),
    Resize(Size),
}

enum Outcome {
    Exited(Option<i32>),

    Closed,

    Disconnected,
    Failed(failure::Failure),
}

struct Link {
    commands: mpsc::UnboundedReceiver<Command>,
    files: mpsc::UnboundedReceiver<crate::files::Call>,
    closed: watch::Receiver<bool>,
    ready: Arc<AtomicBool>,
}

struct SshSession {
    commands: mpsc::UnboundedSender<Command>,
    files: mpsc::UnboundedSender<crate::files::Call>,
    closed: watch::Sender<bool>,
    ready: Arc<AtomicBool>,
}

/// Without a size, the session opens no shell and only serves files.
pub fn spawn(plan: ConnectPlan, size: Option<Size>, context: Context) -> Arc<dyn SessionIo> {
    let (files, files_receiver) = mpsc::unbounded_channel();
    let (commands, commands_receiver) = mpsc::unbounded_channel();
    let (closed, closed_receiver) = watch::channel(false);
    let ready = Arc::new(AtomicBool::new(false));
    let link = Link {
        commands: commands_receiver,
        files: files_receiver,
        closed: closed_receiver,
        ready: ready.clone(),
    };
    tauri::async_runtime::spawn(connect::run(plan, size, context, link));
    Arc::new(SshSession {
        commands,
        files,
        closed,
        ready,
    })
}

async fn closing(closed: &mut watch::Receiver<bool>) {
    let _ = closed.wait_for(|closed| *closed).await;
}

fn session_closed() -> AppError {
    AppError::new("session_closed", "this session has ended")
}

impl SessionIo for SshSession {
    fn write(&self, data: &[u8]) -> AppResult<()> {
        if !self.ready.load(Ordering::Acquire) {
            return Ok(());
        }
        self.commands
            .send(Command::Write(data.to_vec()))
            .map_err(|_| session_closed())
    }

    fn resize(&self, size: Size) -> AppResult<()> {
        self.commands
            .send(Command::Resize(size))
            .map_err(|_| session_closed())
    }

    fn files(&self, call: crate::files::Call) -> AppResult<()> {
        if !self.ready.load(Ordering::Acquire) {
            return Err(session_closed());
        }
        self.files.send(call).map_err(|_| session_closed())
    }

    fn close(&self) {
        self.closed.send_replace(true);
    }
}

#[cfg(test)]
mod sftp_tests;
#[cfg(test)]
mod test_harness;
#[cfg(test)]
mod test_server;
#[cfg(test)]
mod test_store;
#[cfg(test)]
mod tests;

#[cfg(test)]
mod credential_tests;
#[cfg(test)]
mod password_tests;
