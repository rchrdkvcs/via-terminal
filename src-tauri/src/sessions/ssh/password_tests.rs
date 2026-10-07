use super::{test_harness::Harness, HostKeyStatus};
use crate::sessions::{
    events::SessionState,
    prompts::{Prompt, PromptAnswer},
};

#[tokio::test]
async fn a_refused_initial_password_is_never_remembered_after_a_successful_retry() {
    let harness = Harness::new(HostKeyStatus::Trusted).await;
    let id = harness.open(None);
    let (prompt_id, prompt) = harness.prompt(id).await;
    assert!(matches!(prompt, Prompt::Authentication { .. }));
    harness.answer(
        prompt_id,
        PromptAnswer::Authentication {
            username: "via".into(),
            password: "wrong".into(),
            remember: true,
        },
    );
    let (prompt_id, prompt) = harness.prompt(id).await;
    assert!(matches!(prompt, Prompt::Password { retry: true, .. }));
    harness.answer(
        prompt_id,
        PromptAnswer::Text {
            value: "pw".into(),
            remember: false,
        },
    );
    harness.state(id, SessionState::Ready).await;
    assert_eq!(
        *harness.store.authenticated.lock().unwrap(),
        vec![("via".to_string(), None)]
    );
    harness.hub.close(id);
}
