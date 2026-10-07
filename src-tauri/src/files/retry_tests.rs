use super::{
    collision_tests::wait,
    model::{Collision, Direction, Request},
    test_peer::Peer,
    Files,
};
use crate::sessions::events::{recording::Recorder, Event};
use std::sync::Arc;
use uuid::Uuid;
#[tokio::test]
async fn retries_into_the_directory_chosen_by_keep_both_in_both_directions() {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(true)).await;
    let recorder = Arc::new(Recorder::default());
    let files = Files::from_stream(client, Uuid::new_v4(), recorder.clone())
        .await
        .unwrap();
    let root = std::env::temp_dir().join(format!("via-retry-test-{}", Uuid::new_v4()));
    let source = root.join("folder");
    tokio::fs::create_dir_all(&source).await.unwrap();
    tokio::fs::write(source.join("item"), b"first")
        .await
        .unwrap();
    files
        .execute(Request::Create {
            path: "/folder".into(),
            directory: true,
        })
        .await
        .unwrap();
    for direction in [Direction::Upload, Direction::Download] {
        let (sources, destination) = match direction {
            Direction::Upload => (vec![source.to_string_lossy().into_owned()], "/".to_owned()),
            Direction::Download => (
                vec!["/folder (1)".to_owned()],
                root.to_string_lossy().into_owned(),
            ),
        };
        if matches!(direction, Direction::Download) {
            tokio::fs::create_dir(root.join("folder (1)"))
                .await
                .unwrap();
        }
        let id = Uuid::new_v4();
        files
            .execute(Request::Transfer {
                id,
                direction,
                sources: sources.clone(),
                destination: destination.clone(),
                completed_sources: vec![],
                directories: Default::default(),
                owner: String::new(),
            })
            .await
            .unwrap();
        wait(&recorder, id, "conflict").await;
        files
            .execute(Request::Resolve {
                id,
                choice: Collision::KeepBoth,
                all: true,
            })
            .await
            .unwrap();
        wait(&recorder, id, "completed").await;
        let event = recorder
            .0
            .lock()
            .unwrap()
            .iter()
            .find_map(|event| match event {
                Event::Files(p) if p.id == id && p.state == "completed" => Some(p.clone()),
                _ => None,
            })
            .unwrap();
        match direction {
            Direction::Upload => {
                tokio::fs::write(source.join("new"), b"remaining")
                    .await
                    .unwrap();
            }
            Direction::Download => {
                files
                    .execute(Request::Create {
                        path: "/folder (1)/later".into(),
                        directory: false,
                    })
                    .await
                    .unwrap();
            }
        }
        let retry = Uuid::new_v4();
        files
            .execute(Request::Transfer {
                id: retry,
                direction,
                sources,
                destination,
                completed_sources: event.completed_sources,
                directories: event.directories,
                owner: String::new(),
            })
            .await
            .unwrap();
        wait(&recorder, retry, "completed").await;
        match direction {
            Direction::Upload => {
                assert!(files
                    .execute(Request::Read {
                        path: "/folder/new".into()
                    })
                    .await
                    .is_err());
                assert_eq!(
                    files
                        .execute(Request::Read {
                            path: "/folder (1)/new".into()
                        })
                        .await
                        .unwrap()["content"],
                    "remaining"
                );
            }
            Direction::Download => {
                assert!(!root.join("folder (1)/later").exists());
                assert!(root.join("folder (1) (1)/later").exists());
            }
        }
    }
    tokio::fs::remove_dir_all(root).await.unwrap();
}
