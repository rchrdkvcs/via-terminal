use super::{test_harness::Harness, ConnectionStore, CredentialChoice, HostKeyStatus, ServerKey};
use crate::{
    secrets::{FixedKey, Secrets},
    sessions::{
        events::SessionState,
        prompts::{Prompt, PromptAnswer},
        Size,
    },
    storage::Storage,
    vault::{
        input::{IdentityInput, SecretUpdate},
        HostCredential, QuickTarget, Vault,
    },
};
use std::sync::Arc;

async fn setup() -> (Harness, Arc<Vault>) {
    let harness = Harness::new(HostKeyStatus::Trusted).await;
    let storage = Arc::new(Storage::memory().unwrap());
    let secrets = Arc::new(Secrets::new(storage.clone(), &FixedKey(Some([3; 32]))));
    let vault = Arc::new(Vault::load(storage, secrets).unwrap());
    vault
        .trust_host_key(
            "127.0.0.1",
            harness.server.port,
            &ServerKey {
                algorithm: "ssh-ed25519".into(),
                fingerprint: harness.server.fingerprint.clone(),
            },
        )
        .unwrap();
    (harness, vault)
}

#[tokio::test]
async fn vault_key_can_be_selected_and_reused_on_the_next_connection() {
    let (harness, vault) = setup().await;
    let key = vault.generate_key("Test key").unwrap();
    let plan = vault
        .quick_plan(
            QuickTarget {
                address: "127.0.0.1".into(),
                port: Some(harness.server.port),
                username: None,
            },
            true,
        )
        .unwrap();
    let id = harness
        .hub
        .open_ssh(plan, vault.clone(), Some(Size { cols: 80, rows: 24 }))
        .unwrap();
    let (prompt_id, prompt) = harness.prompt(id).await;
    assert!(matches!(prompt, Prompt::Authentication { .. }));
    harness.answer(
        prompt_id,
        PromptAnswer::Credential {
            credential: CredentialChoice::Key {
                id: key.id,
                username: "via-key".into(),
            },
        },
    );
    harness.state(id, SessionState::Ready).await;
    let view = vault.view().unwrap();
    let host = &view.snapshot.data.hosts[0];
    let plan = vault.plan(host.id).unwrap();
    assert_eq!(plan.key.as_ref().unwrap().id, key.id);
    assert_eq!(plan.username.as_deref(), Some("via-key"));
    assert!(plan.password.is_none());
    harness.hub.close(id);
    harness.state(id, SessionState::Exited).await;
    let next = harness
        .hub
        .open_ssh(plan, vault, Some(Size { cols: 80, rows: 24 }))
        .unwrap();
    harness.state(next, SessionState::Ready).await;
    harness.hub.close(next);
}

#[tokio::test]
async fn refused_password_can_switch_to_an_identity_with_a_different_username() {
    let (harness, vault) = setup().await;
    let key = vault.generate_key("Test key").unwrap();
    let identity = vault
        .save_identity(IdentityInput {
            id: None,
            label: "Deploy".into(),
            username: "via-key".into(),
            key_id: Some(key.id),
            password: SecretUpdate::Keep,
        })
        .unwrap();
    let mut plan = vault
        .quick_plan(
            QuickTarget {
                address: "127.0.0.1".into(),
                port: Some(harness.server.port),
                username: Some("wrong-user".into()),
            },
            true,
        )
        .unwrap();
    plan.password = Some(zeroize::Zeroizing::new("wrong".into()));
    let id = harness
        .hub
        .open_ssh(plan, vault.clone(), Some(Size { cols: 80, rows: 24 }))
        .unwrap();
    let (prompt_id, prompt) = harness.prompt(id).await;
    assert!(matches!(prompt, Prompt::Password { retry: true, .. }));
    harness.answer(
        prompt_id,
        PromptAnswer::Credential {
            credential: CredentialChoice::Identity { id: identity.id },
        },
    );
    harness.state(id, SessionState::Ready).await;
    let view = vault.view().unwrap();
    let host = &view.snapshot.data.hosts[0];
    assert_eq!(
        host.credential,
        HostCredential::Identity { id: identity.id }
    );
    let plan = vault.plan(host.id).unwrap();
    assert_eq!(plan.username.as_deref(), Some("via-key"));
    assert_eq!(plan.key.unwrap().id, key.id);
    assert!(plan.password.is_none());
    harness.hub.close(id);
}

#[tokio::test]
async fn cancelling_the_identity_selection_does_not_save_a_host() {
    let (harness, vault) = setup().await;
    let plan = vault
        .quick_plan(
            QuickTarget {
                address: "127.0.0.1".into(),
                port: Some(harness.server.port),
                username: None,
            },
            true,
        )
        .unwrap();
    let id = harness
        .hub
        .open_ssh(plan, vault.clone(), Some(Size { cols: 80, rows: 24 }))
        .unwrap();
    let (prompt_id, _) = harness.prompt(id).await;
    harness.answer(prompt_id, PromptAnswer::Cancel);
    harness.state(id, SessionState::Failed).await;
    assert!(vault.view().unwrap().snapshot.data.hosts.is_empty());
}
