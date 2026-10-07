use super::{
    model::{Document, Request},
    test_peer::Peer,
    Files,
};
use crate::sessions::events::recording::Recorder;
use std::sync::Arc;
use uuid::Uuid;
async fn client(peer: Peer) -> Arc<Files> {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, peer).await;
    Files::from_stream(
        client,
        Uuid::new_v4(),
        Default::default(),
        Arc::new(Recorder::default()),
    )
    .await
    .unwrap()
}
#[tokio::test]
async fn rejects_binary_and_invalid_utf8_without_lossy_conversion() {
    for bytes in [vec![0, 1, 2], vec![0xff, 0xfe, 65]] {
        let mut peer = Peer::new(true);
        peer.nodes.get_mut("/config").unwrap().bytes = bytes;
        let files = client(peer).await;
        assert_eq!(
            files
                .json(Request::Read {
                    path: "/config".into()
                })
                .await
                .unwrap_err()
                .code,
            "file_encoding"
        );
    }
}
#[tokio::test]
async fn limits_actual_bytes_read_when_the_file_outgrows_its_advertised_size() {
    let mut peer = Peer::new(true);
    peer.nodes.get_mut("/config").unwrap().bytes = vec![b'A'; 5_000_001];
    let files = client(peer).await;
    assert_eq!(
        files
            .json(Request::Read {
                path: "/config".into()
            })
            .await
            .unwrap_err()
            .code,
        "file_too_large"
    );
}
#[tokio::test]
async fn refuses_saving_without_owner_information_and_keeps_the_original() {
    let mut peer = Peer::new(true);
    peer.nodes.get_mut("/config").unwrap().attrs.uid = None;
    peer.nodes.get_mut("/config").unwrap().attrs.gid = None;
    let files = client(peer).await;
    let read = files
        .json(Request::Read {
            path: "/config".into(),
        })
        .await
        .unwrap();
    let mut document: Document = serde_json::from_value(read).unwrap();
    document.content = "changed".into();
    assert_eq!(
        files
            .json(Request::Save {
                document,
                original: "old\n".into(),
                overwrite: false
            })
            .await
            .unwrap_err()
            .code,
        "file_metadata"
    );
    assert_eq!(
        files
            .json(Request::Read {
                path: "/config".into()
            })
            .await
            .unwrap()["content"],
        "old\n"
    );
}
