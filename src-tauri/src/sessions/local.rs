//! Local shells in a native PTY.

use super::{
    events::{Event, EventSink, SessionState},
    shells::Shell,
    Ending, SessionIo, Size,
};
use crate::error::{AppError, AppResult};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
};
use uuid::Uuid;

pub struct LocalSpec {
    pub shell: Shell,
    pub cwd: Option<String>,
}

struct LocalSession {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

fn pty_size(size: Size) -> PtySize {
    PtySize {
        rows: size.rows,
        cols: size.cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn failure(cause: impl std::fmt::Display) -> AppError {
    AppError::new(
        "spawn_failed",
        format!("le shell n’a pas pu démarrer : {cause}"),
    )
}

pub fn spawn(
    id: Uuid,
    spec: LocalSpec,
    size: Size,
    sink: Arc<dyn EventSink>,
    ending: Ending,
) -> AppResult<Arc<dyn SessionIo>> {
    let pair = native_pty_system()
        .openpty(pty_size(size))
        .map_err(failure)?;
    let mut command = CommandBuilder::new(&spec.shell.path);
    command.args(&spec.shell.args);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("TERM_PROGRAM", "Via");
    let cwd = spec
        .cwd
        .filter(|dir| std::path::Path::new(dir).is_dir())
        .or_else(|| dirs::home_dir().map(|home| home.to_string_lossy().into_owned()));
    if let Some(cwd) = cwd {
        command.cwd(cwd);
    }
    let mut child = pair.slave.spawn_command(command).map_err(failure)?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(failure)?;
    let writer = pair.master.take_writer().map_err(failure)?;
    let killer = child.clone_killer();

    sink.state(id, SessionState::Ready, None);
    let output = sink.clone();
    std::thread::spawn(move || {
        let mut buffer = vec![0; 16 * 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(read) => output.emit(Event::Output {
                    session_id: id,
                    data: buffer[..read].to_vec(),
                }),
            }
        }
    });
    // Waiting on the child, not on EOF: ConPTY keeps the pipe open after the
    // shell exits until the master is dropped, which `ended` does.
    std::thread::spawn(move || {
        let exit_code = child.wait().ok().map(|status| status.exit_code() as i32);
        std::thread::sleep(std::time::Duration::from_millis(60));
        ending.ended();
        sink.emit(Event::State {
            session_id: id,
            state: SessionState::Exited,
            message: None,
            exit_code,
        });
    });

    Ok(Arc::new(LocalSession {
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        killer: Mutex::new(killer),
    }))
}

impl SessionIo for LocalSession {
    fn write(&self, data: &[u8]) -> AppResult<()> {
        let mut writer = self.writer.lock().unwrap();
        writer
            .write_all(data)
            .and_then(|_| writer.flush())
            .map_err(|_| AppError::new("session_closed", "cette session est terminée"))
    }

    fn resize(&self, size: Size) -> AppResult<()> {
        self.master
            .lock()
            .unwrap()
            .resize(pty_size(size))
            .map_err(|cause| AppError::new("resize_failed", cause.to_string()))
    }

    fn close(&self) {
        // The waiter thread observes the exit and reports it.
        let _ = self.killer.lock().unwrap().kill();
    }
}
