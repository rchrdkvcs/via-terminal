use super::{test_harness::Harness, HostKeyStatus};
use crate::{files::model::Reply, sessions::events::SessionState};

#[tokio::test]
async fn sftp_opens_while_the_shell_floods_output() {
    let harness = Harness::new(HostKeyStatus::Trusted).await;
    let id = harness.open(Some("pw"));
    harness.state(id, SessionState::Ready).await;
    harness.hub.write(id, b"flood\n").unwrap();
    harness.output(id, "flooding").await;
    let read = harness.hub.files(
        id,
        crate::files::model::Request::Read {
            path: "/config".into(),
        },
    );
    let file = tokio::time::timeout(std::time::Duration::from_secs(5), read)
        .await
        .expect("SFTP must not wait for the shell reader")
        .unwrap();
    assert!(matches!(file, Reply::Document(_)));
    harness.output(id, "line 499").await;
    harness.hub.write(id, b"still usable").unwrap();
    harness.output(id, "still usable").await;
}
