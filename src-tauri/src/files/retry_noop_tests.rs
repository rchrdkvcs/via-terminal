use super::{
    collision_tests::wait,
    model::{Direction, Request, TransferPlan, TransferState},
    test_peer::Peer,
    Files,
};
use crate::sessions::events::{recording::Recorder, Event};
use std::sync::Arc;
use uuid::Uuid;

#[tokio::test]
async fn retry_with_every_source_completed_finishes_without_copying_or_counting_again() {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(true)).await;
    let recorder = Arc::new(Recorder::default());
    let files = Files::from_stream(client, Uuid::new_v4(), Default::default(), recorder.clone())
        .await
        .unwrap();
    let root = std::env::temp_dir().join(format!("via-noop-retry-{}", Uuid::new_v4()));
    tokio::fs::create_dir(&root).await.unwrap();
    for direction in [Direction::Upload, Direction::Download] {
        // The completed source is deliberately absent: a retry must not read it again.
        let source = match direction {
            Direction::Upload => root.join("already-finished").to_string_lossy().into_owned(),
            Direction::Download => "/already-finished".to_owned(),
        };
        let destination = match direction {
            Direction::Upload => "/".to_owned(),
            Direction::Download => root.to_string_lossy().into_owned(),
        };
        let id = Uuid::new_v4();
        files
            .json(Request::Transfer(TransferPlan {
                id,
                direction,
                sources: vec![source.clone()],
                destination,
                completed_sources: vec![source.clone()],
                directories: Default::default(),
                owner: Default::default(),
            }))
            .await
            .unwrap();
        wait(&recorder, id, TransferState::Completed).await;
        let events = recorder.0.lock().unwrap();
        let result = events
            .iter()
            .find_map(|event| match event {
                Event::Files(event)
                    if event.id == id && event.state == TransferState::Completed =>
                {
                    Some(event)
                }
                _ => None,
            })
            .unwrap();
        assert_eq!(result.completed_sources, vec![source]);
        assert_eq!(result.bytes, 0);
        assert_eq!(result.total, 0);
    }
    assert!(tokio::fs::read_dir(&root)
        .await
        .unwrap()
        .next_entry()
        .await
        .unwrap()
        .is_none());
    tokio::fs::remove_dir_all(root).await.unwrap();
}
