use super::collision_tests::wait;
use super::{
    model::{Collision, Direction, Request},
    test_peer::Peer,
    Files,
};
use crate::sessions::events::{recording::Recorder, Event};
use std::sync::Arc;
use uuid::Uuid;
#[tokio::test]
async fn recursive_transfers_keep_empty_directories_and_skip_already_completed_files_on_retry() {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(true)).await;
    let recorder = Arc::new(Recorder::default());
    let files = Files::from_stream(client, Uuid::new_v4(), recorder.clone())
        .await
        .unwrap();
    let root = std::env::temp_dir().join(format!("via-recursive-test-{}", Uuid::new_v4()));
    let source = root.join("folder");
    tokio::fs::create_dir_all(source.join("empty"))
        .await
        .unwrap();
    tokio::fs::write(source.join("item"), b"first")
        .await
        .unwrap();
    let id = Uuid::new_v4();
    files
        .execute(Request::Transfer {
            id,
            direction: Direction::Upload,
            sources: vec![source.to_string_lossy().into()],
            destination: "/".into(),
            completed_sources: vec![],
            directories: Default::default(),
            owner: String::new(),
        })
        .await
        .unwrap();
    wait(&recorder, id, "completed").await;
    assert!(files
        .execute(Request::List {
            path: "/folder/empty".into()
        })
        .await
        .unwrap()["entries"]
        .as_array()
        .unwrap()
        .is_empty());
    let completed = recorder
        .0
        .lock()
        .unwrap()
        .iter()
        .find_map(|e| match e {
            Event::Files(p) if p.id == id && p.state == "completed" => {
                Some(p.completed_sources.clone())
            }
            _ => None,
        })
        .unwrap();
    tokio::fs::write(source.join("item"), b"changed locally after transfer")
        .await
        .unwrap();
    let retry = Uuid::new_v4();
    files
        .execute(Request::Transfer {
            id: retry,
            direction: Direction::Upload,
            sources: vec![source.to_string_lossy().into()],
            destination: "/".into(),
            completed_sources: completed,
            directories: Default::default(),
            owner: String::new(),
        })
        .await
        .unwrap();
    // The completed empty directory can collide on retry; explicitly merge it.
    if tokio::time::timeout(
        std::time::Duration::from_millis(150),
        wait(&recorder, retry, "conflict"),
    )
    .await
    .is_ok()
    {
        files
            .execute(Request::Resolve {
                id: retry,
                choice: Collision::Replace,
                all: true,
            })
            .await
            .unwrap();
    }
    wait(&recorder, retry, "completed").await;
    assert_eq!(
        files
            .execute(Request::Read {
                path: "/folder/item".into()
            })
            .await
            .unwrap()["content"],
        "first"
    );
    tokio::fs::remove_dir_all(root).await.unwrap();
}
