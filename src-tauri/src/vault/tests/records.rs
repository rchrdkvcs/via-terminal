use super::{host, vault};
use crate::vault::{input::*, HostCredential};

#[test]
fn a_host_only_needs_an_address() {
    let vault = vault();
    let saved = vault.save_host(host(" srv.example.net ")).unwrap();
    assert_eq!(saved.label, "srv.example.net");
    assert!(vault.save_host(host("-oProxyCommand=x")).is_err());
    assert!(vault.save_host(host("")).is_err());
}

#[test]
fn views_carry_a_revision_that_only_committed_changes_advance() {
    let vault = vault();
    let before = vault.view().unwrap().revision;
    assert!(vault.save_host(host("")).is_err());
    assert_eq!(vault.view().unwrap().revision, before);
    vault.save_host(host("a")).unwrap();
    assert_eq!(vault.view().unwrap().revision, before + 1);
}

#[test]
fn snapshots_report_secrets_without_exposing_them() {
    let vault = vault();
    let saved = vault
        .save_host(HostInput {
            password: SecretUpdate::Set("s3cret".into()),
            ..host("a")
        })
        .unwrap();
    let view = vault.view().unwrap();
    assert_eq!(view.snapshot.passwords, vec![saved.id]);
    assert!(!serde_json::to_string(&view).unwrap().contains("s3cret"));
    vault
        .save_host(HostInput {
            id: Some(saved.id),
            password: SecretUpdate::Clear,
            ..host("a")
        })
        .unwrap();
    assert!(vault.view().unwrap().snapshot.passwords.is_empty());
}

#[test]
fn generated_keys_are_usable_by_plans() {
    let vault = vault();
    let key = vault.generate_key("").unwrap();
    assert!(key.public_key.starts_with("ssh-ed25519 "));
    let saved = vault
        .save_host(HostInput {
            credential: HostCredential::Key {
                id: key.id,
                username: None,
            },
            ..host("a")
        })
        .unwrap();
    let plan = vault.plan(saved.id).unwrap();
    assert!(plan
        .key
        .unwrap()
        .private_key
        .contains("OPENSSH PRIVATE KEY"));
    vault.delete_key(key.id).unwrap();
    assert!(vault.plan(saved.id).unwrap().key.is_none());
}
