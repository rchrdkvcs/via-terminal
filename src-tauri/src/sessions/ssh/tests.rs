use super::{test_harness::Harness, HostKeyStatus};
use crate::files::model::Reply;
use crate::sessions::{
    events::SessionState,
    prompts::{Prompt, PromptAnswer},
};

fn text(value: &str, remember: bool) -> PromptAnswer {
    PromptAnswer::Text {
        value: value.into(),
        remember,
    }
}

#[tokio::test]
async fn unknown_key_then_typed_password_reaches_a_shell_until_exit() {
    let harness = Harness::new(HostKeyStatus::Unknown).await;
    let id = harness.open(None);

    let (prompt_id, prompt) = harness.prompt(id).await;
    let Prompt::HostKey {
        fingerprint,
        previous_fingerprint,
        ..
    } = prompt
    else {
        panic!("expected the host key prompt, got {prompt:?}");
    };
    assert_eq!(fingerprint, harness.server.fingerprint);
    assert_eq!(previous_fingerprint, None);
    harness.answer(prompt_id, PromptAnswer::Accept);

    let (prompt_id, prompt) = harness.prompt(id).await;
    assert!(
        matches!(prompt, Prompt::Authentication { .. }),
        "{prompt:?}"
    );
    let trusted = harness.store.trusted.lock().unwrap().clone();
    assert_eq!(trusted.len(), 1);
    assert_eq!(trusted[0].fingerprint, harness.server.fingerprint);
    harness.answer(prompt_id, text("pw", true));

    harness.state(id, SessionState::Ready).await;
    assert_eq!(
        *harness.store.authenticated.lock().unwrap(),
        vec![("via".to_string(), Some("pw".to_string()))]
    );
    harness.hub.write(id, b"hello").unwrap();
    harness.output(id, "hello").await;

    harness.hub.write(id, b"exit\n").unwrap();
    let (_, exit_code) = harness.state(id, SessionState::Exited).await;
    assert_eq!(exit_code, Some(0));
    assert!(harness.hub.write(id, b"late").is_err());
}

#[tokio::test]
async fn a_refused_stored_password_asks_again_with_retry() {
    let harness = Harness::new(HostKeyStatus::Trusted).await;
    let id = harness.open(Some("wrong"));

    let (prompt_id, prompt) = harness.prompt(id).await;
    assert!(
        matches!(prompt, Prompt::Password { retry: true, .. }),
        "{prompt:?}"
    );
    harness.answer(prompt_id, text("pw", false));

    harness.state(id, SessionState::Ready).await;
    assert_eq!(
        *harness.store.authenticated.lock().unwrap(),
        vec![("via".to_string(), None)]
    );
    harness.hub.close(id);
    let (_, exit_code) = harness.state(id, SessionState::Exited).await;
    assert_eq!(exit_code, None);
}

#[tokio::test]
async fn a_refused_host_key_fails_without_trusting_it() {
    let harness = Harness::new(HostKeyStatus::Unknown).await;
    let id = harness.open(Some("pw"));

    let (prompt_id, prompt) = harness.prompt(id).await;
    assert!(matches!(prompt, Prompt::HostKey { .. }), "{prompt:?}");
    harness.answer(prompt_id, PromptAnswer::Cancel);

    let (message, _) = harness.state(id, SessionState::Failed).await;
    assert_eq!(message.as_deref(), Some("Clé du serveur refusée"));
    assert!(harness.store.trusted.lock().unwrap().is_empty());
    assert!(harness.store.authenticated.lock().unwrap().is_empty());
}

#[tokio::test]
async fn a_changed_key_shows_the_previous_fingerprint() {
    let previous = "SHA256:previous".to_string();
    let harness = Harness::new(HostKeyStatus::Changed {
        previous_fingerprint: previous.clone(),
    })
    .await;
    let id = harness.open(Some("pw"));

    let (prompt_id, prompt) = harness.prompt(id).await;
    let Prompt::HostKey {
        fingerprint,
        previous_fingerprint,
        ..
    } = prompt
    else {
        panic!("expected the host key prompt, got {prompt:?}");
    };
    assert_eq!(fingerprint, harness.server.fingerprint);
    assert_eq!(previous_fingerprint, Some(previous));
    harness.answer(prompt_id, PromptAnswer::Accept);

    harness.state(id, SessionState::Ready).await;
    assert_eq!(harness.store.trusted.lock().unwrap().len(), 1);
    harness.hub.close(id);
    harness.state(id, SessionState::Exited).await;
}

#[tokio::test]
async fn sftp_reuses_the_authenticated_session_and_shell_exit_ends_file_access() {
    let harness = Harness::new(HostKeyStatus::Trusted).await;
    let id = harness.open(Some("pw"));
    harness.state(id, SessionState::Ready).await;
    let file = harness
        .hub
        .files(
            id,
            crate::files::model::Request::Read {
                path: "/config".into(),
            },
        )
        .await
        .unwrap();
    assert!(matches!(file, Reply::Document(ref d) if d.content == "old\n"));
    assert_eq!(harness.store.authenticated.lock().unwrap().len(), 1);
    harness.hub.write(id, b"still running").unwrap();
    harness.output(id, "still running").await;
    harness.hub.write(id, b"exit\n").unwrap();
    harness.state(id, SessionState::Exited).await;
    let error = harness
        .hub
        .files(
            id,
            crate::files::model::Request::Read {
                path: "/config".into(),
            },
        )
        .await
        .unwrap_err();
    assert_eq!(error.code, "session_closed");
}
