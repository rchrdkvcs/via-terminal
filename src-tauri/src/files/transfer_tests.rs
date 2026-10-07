use super::{model::Request, test_peer::Peer, Files};
use crate::sessions::events::{recording::Recorder, Event};
use std::sync::Arc;
use uuid::Uuid;
#[tokio::test]
async fn upload_and_download_stream_contents_through_the_public_operations() {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(true)).await;
    let recorder = Arc::new(Recorder::default());
    let files = Files::from_stream(client, Uuid::new_v4(), recorder.clone())
        .await
        .unwrap();
    let root = std::env::temp_dir().join(format!("via-files-test-{}", Uuid::new_v4()));
    tokio::fs::create_dir(&root).await.unwrap();
    let source = root.join("uploaded");
    tokio::fs::write(&source, b"transferred").await.unwrap();
    let id = Uuid::new_v4();
    files
        .execute(Request::Transfer {
            id,
            completed_sources: vec![],
            directories: Default::default(),
            owner: String::new(),
            direction: super::model::Direction::Upload,
            sources: vec![source.to_string_lossy().into()],
            destination: "/".into(),
        })
        .await
        .unwrap();
    wait_completed(&recorder, id).await;
    assert_eq!(
        files
            .execute(Request::Read {
                path: "/uploaded".into()
            })
            .await
            .unwrap()["content"],
        "transferred"
    );
    let output = root.join("download");
    tokio::fs::create_dir(&output).await.unwrap();
    let download = Uuid::new_v4();
    files
        .execute(Request::Transfer {
            id: download,
            completed_sources: vec![],
            directories: Default::default(),
            owner: String::new(),
            direction: super::model::Direction::Download,
            sources: vec!["/uploaded".into()],
            destination: output.to_string_lossy().into(),
        })
        .await
        .unwrap();
    wait_completed(&recorder, download).await;
    assert_eq!(
        tokio::fs::read(output.join("uploaded")).await.unwrap(),
        b"transferred"
    );
    tokio::fs::remove_dir_all(root).await.unwrap();
}
async fn wait_completed(recorder: &Recorder, id: Uuid) {
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            let state = recorder
                .0
                .lock()
                .unwrap()
                .iter()
                .find_map(|event| match event {
                    Event::Files(progress)
                        if progress.id == id
                            && ["completed", "failed", "cancelled"].contains(&progress.state) =>
                    {
                        Some((progress.state, progress.message.clone()))
                    }
                    _ => None,
                });
            if let Some((state, message)) = state {
                assert_eq!(state, "completed", "{message:?}");
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
}
