use super::{
    model::{Collision, Direction, Request},
    test_peer::Peer,
    Files,
};
use crate::sessions::events::{recording::Recorder, Event};
use std::sync::Arc;
use uuid::Uuid;
pub(super) async fn wait(recorder: &Recorder, id: Uuid, state: super::model::TransferState) {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            if recorder
                .0
                .lock()
                .unwrap()
                .iter()
                .any(|e| matches!(e, Event::Files(p) if p.id == id && p.state == state))
            {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
}
#[tokio::test]
async fn keep_both_and_cancelling_a_collision_leave_the_existing_file_intact() {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(true)).await;
    let recorder = Arc::new(Recorder::default());
    let files = Files::from_stream(client, Uuid::new_v4(), Default::default(), recorder.clone())
        .await
        .unwrap();
    let root = std::env::temp_dir().join(format!("via-collision-test-{}", Uuid::new_v4()));
    tokio::fs::create_dir(&root).await.unwrap();
    let source = root.join("config");
    tokio::fs::write(&source, b"uploaded").await.unwrap();
    let id = Uuid::new_v4();
    files
        .json(Request::Transfer(super::model::TransferPlan {
            id,
            direction: Direction::Upload,
            sources: vec![source.to_string_lossy().into()],
            destination: "/".into(),
            completed_sources: vec![],
            directories: Default::default(),
            owner: Default::default(),
        }))
        .await
        .unwrap();
    wait(&recorder, id, super::model::TransferState::Conflict).await;
    files
        .json(Request::Resolve {
            id,
            choice: Collision::KeepBoth,
            all: true,
        })
        .await
        .unwrap();
    wait(&recorder, id, super::model::TransferState::Completed).await;
    assert_eq!(
        files
            .json(Request::Read {
                path: "/config".into()
            })
            .await
            .unwrap()["content"],
        "old\n"
    );
    assert_eq!(
        files
            .json(Request::Read {
                path: "/config (1)".into()
            })
            .await
            .unwrap()["content"],
        "uploaded"
    );
    let cancelled = Uuid::new_v4();
    files
        .json(Request::Transfer(super::model::TransferPlan {
            id: cancelled,
            direction: Direction::Upload,
            sources: vec![source.to_string_lossy().into()],
            destination: "/".into(),
            completed_sources: vec![],
            directories: Default::default(),
            owner: Default::default(),
        }))
        .await
        .unwrap();
    wait(&recorder, cancelled, super::model::TransferState::Conflict).await;
    files.json(Request::Cancel { id: cancelled }).await.unwrap();
    wait(&recorder, cancelled, super::model::TransferState::Cancelled).await;
    let listing = files
        .json(Request::List { path: "/".into() })
        .await
        .unwrap();
    assert!(!listing["entries"]
        .as_array()
        .unwrap()
        .iter()
        .any(|entry| entry["name"].as_str().unwrap().starts_with(".via-")));
    assert_eq!(
        files
            .json(Request::Read {
                path: "/config".into()
            })
            .await
            .unwrap()["content"],
        "old\n"
    );
    tokio::fs::remove_dir_all(root).await.unwrap();
}
#[cfg(unix)]
#[tokio::test]
async fn the_skipped_report_lists_source_paths_in_both_directions() {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(true)).await;
    let recorder = Arc::new(Recorder::default());
    let files = Files::from_stream(client, Uuid::new_v4(), Default::default(), recorder.clone())
        .await
        .unwrap();
    let root = std::env::temp_dir().join(format!("via-skipped-test-{}", Uuid::new_v4()));
    tokio::fs::create_dir(&root).await.unwrap();
    tokio::fs::write(root.join("config"), b"local")
        .await
        .unwrap();
    tokio::fs::symlink(root.join("config"), root.join("link"))
        .await
        .unwrap();
    let local = |name: &str| root.join(name).to_string_lossy().into_owned();
    for (direction, sources, destination) in [
        (
            Direction::Upload,
            vec![local("config"), local("link")],
            "/".to_owned(),
        ),
        (
            Direction::Download,
            vec!["/config".to_owned(), "/link".to_owned()],
            local(""),
        ),
    ] {
        let id = Uuid::new_v4();
        files
            .json(Request::Transfer(super::model::TransferPlan {
                id,
                direction,
                sources: sources.clone(),
                destination,
                completed_sources: vec![],
                directories: Default::default(),
                owner: Default::default(),
            }))
            .await
            .unwrap();
        wait(&recorder, id, super::model::TransferState::Conflict).await;
        let resolve = Request::Resolve {
            id,
            choice: Collision::Skip,
            all: true,
        };
        files.json(resolve).await.unwrap();
        wait(&recorder, id, super::model::TransferState::Completed).await;
        let mut skipped = recorder
            .0
            .lock()
            .unwrap()
            .iter()
            .find_map(|event| match event {
                Event::Files(p)
                    if p.id == id && p.state == super::model::TransferState::Completed =>
                {
                    Some(p.skipped.clone())
                }
                _ => None,
            })
            .unwrap();
        skipped.sort();
        assert_eq!(skipped, sources);
    }
    tokio::fs::remove_dir_all(root).await.unwrap();
}
