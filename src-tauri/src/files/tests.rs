use super::{model::Request, test_peer::Peer, Files};
use crate::sessions::events::recording::Recorder;
use std::sync::Arc;
use uuid::Uuid;
pub(super) async fn client(replacement: bool) -> Arc<Files> {
    let (client, server) = tokio::io::duplex(256 * 1024);
    russh_sftp::server::run(server, Peer::new(replacement)).await;
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
async fn safe_save_preserves_metadata_and_detects_a_concurrent_edit() {
    let files = client(true).await;
    let read = files
        .json(Request::Read {
            path: "/config".into(),
        })
        .await
        .unwrap();
    let original: super::model::Document = serde_json::from_value(read).unwrap();
    let mut changed = original.clone();
    changed.content = "saved\r\n".into();
    files
        .json(Request::Save {
            document: changed,
            original: original.content.clone(),
            overwrite: false,
        })
        .await
        .unwrap();
    let current = files
        .json(Request::Read {
            path: "/config".into(),
        })
        .await
        .unwrap();
    assert_eq!(current["content"], "saved\r\n");
    assert_eq!(current["permissions"], 0o100640);
    assert_eq!(current["uid"], 1000);
    assert_eq!(current["gid"], 100);
    let mut stale = original.clone();
    stale.content = "other edit".into();
    let error = files
        .json(Request::Save {
            document: stale,
            original: original.content,
            overwrite: false,
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "file_conflict");
    assert_eq!(
        files
            .json(Request::Read {
                path: "/config".into()
            })
            .await
            .unwrap()["content"],
        "saved\r\n"
    );
}
#[tokio::test]
async fn unsupported_safe_replacement_never_truncates_the_original() {
    let files = client(false).await;
    let read = files
        .json(Request::Read {
            path: "/config".into(),
        })
        .await
        .unwrap();
    let mut document: super::model::Document = serde_json::from_value(read).unwrap();
    document.content = "new".into();
    let error = files
        .json(Request::Save {
            document,
            original: "old\n".into(),
            overwrite: false,
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "file_unsafe_save");
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
#[tokio::test]
async fn editing_through_a_link_addresses_the_target_and_rejects_a_changed_resolution() {
    let files = client(true).await;
    let read = files
        .json(Request::Read {
            path: "/link".into(),
        })
        .await
        .unwrap();
    let mut document: super::model::Document = serde_json::from_value(read).unwrap();
    assert_eq!(document.resolved_path, "/config");
    document.resolved_path = "/elsewhere".into();
    document.content = "new".into();
    let error = files
        .json(Request::Save {
            document,
            original: "old\n".into(),
            overwrite: false,
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "file_target_changed");
}
