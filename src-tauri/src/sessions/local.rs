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
    super::integration::apply(&spec.shell, &mut command);
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
        let _ = self.killer.lock().unwrap().kill();
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::super::{
        events::{recording::Recorder, Event, SessionState},
        shells::Shell,
        LocalSpec, SessionHub, Size,
    };
    use std::{
        sync::Arc,
        time::{Duration, Instant},
    };
    use uuid::Uuid;

    fn output(recorder: &Recorder, id: Uuid) -> String {
        let events = recorder.0.lock().unwrap();
        let bytes: Vec<u8> = events
            .iter()
            .filter_map(|event| match event {
                Event::Output { session_id, data } if *session_id == id => Some(data.clone()),
                _ => None,
            })
            .flatten()
            .collect();
        String::from_utf8_lossy(&bytes).into_owned()
    }

    fn exit_code(recorder: &Recorder, id: Uuid) -> Option<Option<i32>> {
        recorder
            .0
            .lock()
            .unwrap()
            .iter()
            .find_map(|event| match event {
                Event::State {
                    session_id,
                    state: SessionState::Exited,
                    exit_code,
                    ..
                } if *session_id == id => Some(*exit_code),
                _ => None,
            })
    }

    fn eventually<T>(what: &str, mut check: impl FnMut() -> Option<T>) -> T {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if let Some(value) = check() {
                return value;
            }
            assert!(Instant::now() < deadline, "timed out waiting for {what}");
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    #[test]
    fn a_local_shell_runs_input_and_reports_its_exit() {
        let recorder = Arc::new(Recorder::default());
        let hub = SessionHub::new(recorder.clone());
        let spec = LocalSpec {
            shell: Shell {
                path: "/bin/sh".into(),
                name: "sh".into(),
                args: Vec::new(),
            },
            cwd: Some(std::env::temp_dir().to_string_lossy().into_owned()),
        };
        let id = hub.open_local(spec, Size { cols: 80, rows: 24 }).unwrap();
        assert_eq!(recorder.states(id), vec![SessionState::Ready]);

        hub.resize(
            id,
            Size {
                cols: 120,
                rows: 40,
            },
        )
        .unwrap();
        hub.write(id, b"echo via-$((40 + 2))\n").unwrap();
        eventually("the command output", || {
            output(&recorder, id).contains("via-42").then_some(())
        });

        hub.write(id, b"exit 3\n").unwrap();
        let code = eventually("the shell exit", || exit_code(&recorder, id));
        assert_eq!(code, Some(3));
        assert_eq!(
            recorder.states(id),
            vec![SessionState::Ready, SessionState::Exited]
        );
        assert_eq!(hub.write(id, b"echo\n").unwrap_err().code, "session_closed");
    }

    #[test]
    fn closing_a_local_shell_ends_it() {
        let recorder = Arc::new(Recorder::default());
        let hub = SessionHub::new(recorder.clone());
        let spec = LocalSpec {
            shell: Shell {
                path: "/bin/sh".into(),
                name: "sh".into(),
                args: Vec::new(),
            },
            cwd: None,
        };
        let id = hub.open_local(spec, Size { cols: 80, rows: 24 }).unwrap();
        hub.close(id);
        eventually("the shell exit", || exit_code(&recorder, id));
        assert_eq!(
            hub.resize(id, Size { cols: 80, rows: 24 })
                .unwrap_err()
                .code,
            "session_closed"
        );
    }
}
