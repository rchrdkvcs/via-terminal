//! Embedded SSH client (russh). See `plan.rs` for the contract with the vault.
//!
//! [`spawn`] hands back a handle at once and drives the connection on the
//! async runtime: socket and handshake (`connect`), server key verification
//! (`handler`), credentials (`auth`, `keys`, `interactive`, `asker`), then the
//! shell (`channel`). The handle only talks to that task through channels, so
//! `write` never blocks. Input typed before the shell is ready is dropped: it
//! was aimed at a prompt or at nothing, never at the remote shell.

mod asker;
mod auth;
mod channel;
mod connect;
mod failure;
mod handler;
mod interactive;
mod keys;
pub mod plan;

pub use plan::*;

use super::{events::EventSink, prompts::Prompts, Ending, SessionIo, Size};
use crate::error::{AppError, AppResult};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::sync::{mpsc, watch};
use uuid::Uuid;

/// Everything a connection needs from the hub.
pub struct Context {
    pub id: Uuid,
    pub sink: Arc<dyn EventSink>,
    pub prompts: Arc<Prompts>,
    pub store: Arc<dyn ConnectionStore>,
    pub ending: Ending,
}

/// What the handle asks of the running connection.
enum Command {
    Write(Vec<u8>),
    Resize(Size),
}

/// How a connection ended, reported once by `connect`.
enum Outcome {
    /// The remote shell ended on its own.
    Exited(Option<i32>),
    /// The user closed the session.
    Closed,
    /// The connection dropped while ready.
    Disconnected,
    Failed(failure::Failure),
}

/// The task's side of the handle.
struct Link {
    commands: mpsc::UnboundedReceiver<Command>,
    closed: watch::Receiver<bool>,
    ready: Arc<AtomicBool>,
}

struct SshSession {
    commands: mpsc::UnboundedSender<Command>,
    closed: watch::Sender<bool>,
    ready: Arc<AtomicBool>,
}

/// Start connecting in the background and return the session handle at once.
pub fn spawn(plan: ConnectPlan, size: Size, context: Context) -> Arc<dyn SessionIo> {
    let (commands, commands_receiver) = mpsc::unbounded_channel();
    let (closed, closed_receiver) = watch::channel(false);
    let ready = Arc::new(AtomicBool::new(false));
    let link = Link {
        commands: commands_receiver,
        closed: closed_receiver,
        ready: ready.clone(),
    };
    tauri::async_runtime::spawn(connect::run(plan, size, context, link));
    Arc::new(SshSession {
        commands,
        closed,
        ready,
    })
}

/// Resolves once the user closed the session, or nobody holds its handle.
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

    fn close(&self) {
        self.closed.send_replace(true);
    }
}

#[cfg(test)]
mod test_harness;
#[cfg(test)]
mod test_server;
#[cfg(test)]
mod test_store;
#[cfg(test)]
mod tests;
