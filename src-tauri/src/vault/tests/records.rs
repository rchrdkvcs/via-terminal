use super::{host, vault};
use crate::vault::{input::*, model::*};

#[test]
fn a_host_only_needs_an_address() {
    let vault = vault();
    let saved = vault.save_host(host(" srv.example.net ")).unwrap();
    assert_eq!(saved.label, "srv.example.net");
    assert!(vault.save_host(host("-oProxyCommand=x")).is_err());
    assert!(vault.save_host(host("")).is_err());
}

#[test]
fn hosts_inherit_from_groups_and_identities() {
    let vault = vault();
    let identity = vault
        .save_identity(IdentityInput {
            id: None,
            label: String::new(),
            username: "admin".into(),
            key_id: None,
            password: SecretUpdate::Set("pw".into()),
        })
        .unwrap();
    let parent = vault
        .save_group(GroupInput {
            id: None,
            parent_id: None,
            name: "Client".into(),
            defaults: Defaults {
                port: Some(2222),
                identity_id: Some(identity.id),
                username: None,
            },
        })
        .unwrap();
    let child = vault
        .save_group(GroupInput {
            id: None,
            parent_id: Some(parent.id),
            name: "Prod".into(),
            defaults: Defaults::default(),
        })
        .unwrap();
    let saved = vault
        .save_host(HostInput {
            group_id: Some(child.id),
            ..host("db")
        })
        .unwrap();
    let plan = vault.plan(saved.id).unwrap();
    assert_eq!(plan.port, 2222);
    assert_eq!(plan.username.as_deref(), Some("admin"));
    assert_eq!(plan.password.as_deref().map(|p| p.as_str()), Some("pw"));

    // A group cannot move inside its own child.
    let cycle = GroupInput {
        id: Some(parent.id),
        parent_id: Some(child.id),
        name: "Client".into(),
        defaults: Defaults::default(),
    };
    assert!(vault.save_group(cycle).is_err());

    // Deleting the parent keeps the child and its host.
    vault.delete_group(parent.id).unwrap();
    assert_eq!(vault.plan(saved.id).unwrap().port, 22);
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
            key_id: Some(key.id),
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
