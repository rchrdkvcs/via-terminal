use super::{
    collision_tests::wait,
    model::{Collision, Direction, Request, TransferPlan, TransferState},
    test_peer::Peer,
    Files,
};
use crate::sessions::events::{recording::Recorder, Event};
use std::{path::Path, sync::Arc};
use uuid::Uuid;

async fn service(replacement: bool) -> (Arc<Files>, Arc<Recorder>) {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(replacement)).await;
    let recorder = Arc::new(Recorder::default());
    let files = Files::from_stream(client, Uuid::new_v4(), Default::default(), recorder.clone());
    (files.await.unwrap(), recorder)
}
fn local(name: &str, mode: u32) -> std::path::PathBuf {
    let root = std::env::temp_dir().join(format!("via-mode-test-{}", Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let path = root.join(name);
    std::fs::write(&path, b"uploaded").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(mode)).unwrap();
    }
    let _ = mode;
    path
}
/// Uploads one file to `/`, answering a collision with `choice`; returns the final event.
async fn upload(
    files: &Arc<Files>,
    recorder: &Recorder,
    source: &Path,
    choice: Collision,
) -> (TransferState, Option<String>) {
    let id = Uuid::new_v4();
    let plan = TransferPlan {
        id,
        owner: Default::default(),
        direction: Direction::Upload,
        sources: vec![source.to_string_lossy().into()],
        destination: "/".into(),
        completed_sources: vec![],
        directories: Default::default(),
    };
    files.json(Request::Transfer(plan)).await.unwrap();
    wait(recorder, id, TransferState::Conflict).await;
    let resolve = Request::Resolve {
        id,
        choice,
        all: false,
    };
    files.json(resolve).await.unwrap();
    for _ in 0..500 {
        let last = recorder
            .0
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find_map(|event| match event {
                Event::Files(p) if p.id == id && !matches!(p.state, TransferState::Running) => {
                    Some((p.state, p.message.clone()))
                }
                _ => None,
            });
        if let Some(last) = last.filter(|(state, _)| *state != TransferState::Conflict) {
            return last;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    panic!("transfer did not finish");
}
#[cfg(unix)]
async fn mode(files: &Arc<Files>, path: &str) -> u64 {
    let read = files
        .json(Request::Read { path: path.into() })
        .await
        .unwrap();
    read["permissions"].as_u64().unwrap() & 0o7777
}

#[cfg(unix)]
#[tokio::test]
async fn replacement_keeps_the_destination_mode_and_new_files_keep_local_execution() {
    let (files, recorder) = service(true).await;
    let create = Request::Create {
        parent: "/".into(),
        name: "tool".into(),
        directory: false,
    };
    files.json(create).await.unwrap();
    let chmod = Request::Chmod {
        path: "/tool".into(),
        permissions: 0o755,
    };
    files.json(chmod).await.unwrap();
    let source = local("tool", 0o640);
    let (state, message) = upload(&files, &recorder, &source, Collision::Replace).await;
    assert_eq!(state, TransferState::Completed, "{message:?}");
    assert_eq!(mode(&files, "/tool").await, 0o755);
    let source = local("config", 0o775);
    let (state, _) = upload(&files, &recorder, &source, Collision::KeepBoth).await;
    assert_eq!(state, TransferState::Completed);
    assert_eq!(mode(&files, "/config (1)").await, 0o755);
}

#[tokio::test]
async fn a_file_cannot_replace_a_directory_and_the_failure_explains_the_recovery() {
    let (files, recorder) = service(true).await;
    let create = Request::Create {
        parent: "/".into(),
        name: "item".into(),
        directory: true,
    };
    files.json(create).await.unwrap();
    let (state, message) =
        upload(&files, &recorder, &local("item", 0o644), Collision::Replace).await;
    assert_eq!(state, TransferState::Failed);
    assert!(message.unwrap().contains("Ignorer ou Conserver les deux"));
    assert!(files
        .json(Request::List {
            path: "/item".into()
        })
        .await
        .is_ok());
}

#[tokio::test]
async fn replacing_without_safe_rename_leaves_the_original_intact() {
    let (files, recorder) = service(false).await;
    let (state, message) = upload(
        &files,
        &recorder,
        &local("config", 0o644),
        Collision::Replace,
    )
    .await;
    assert_eq!(state, TransferState::Failed);
    assert!(message.unwrap().contains("remplacer sûrement"));
    let read = files
        .json(Request::Read {
            path: "/config".into(),
        })
        .await
        .unwrap();
    assert_eq!(read["content"], "old\n");
}
