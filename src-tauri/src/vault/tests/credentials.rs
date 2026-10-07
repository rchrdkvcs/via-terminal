use super::{host, vault};
use crate::{
    sessions::ssh::{ConnectionStore, CredentialChoice, Remembered},
    vault::{input::*, model::*},
};

#[test]
fn an_explicit_host_credential_does_not_mix_with_the_group_identity() {
    let vault = vault();
    let key = vault.generate_key("Group key").unwrap();
    let identity = vault
        .save_identity(IdentityInput {
            id: None,
            label: "Group identity".into(),
            username: "group-user".into(),
            key_id: Some(key.id),
            password: SecretUpdate::Set("group-password".into()),
        })
        .unwrap();
    let group = vault
        .save_group(GroupInput {
            id: None,
            parent_id: None,
            name: "Group".into(),
            defaults: Defaults {
                username: None,
                identity_id: Some(identity.id),
                port: Some(2200),
            },
        })
        .unwrap();
    let saved = vault
        .save_host(HostInput {
            own_credentials: true,
            group_id: Some(group.id),
            overrides: Defaults {
                username: Some("own-user".into()),
                ..Default::default()
            },
            ..host("test")
        })
        .unwrap();
    let plan = vault.plan(saved.id).unwrap();
    assert_eq!(plan.username.as_deref(), Some("own-user"));
    assert_eq!(plan.port, 2200);
    assert!(plan.key.is_none());
    assert!(plan.password.is_none());
}

#[test]
fn selecting_an_identity_replaces_old_host_credentials_after_success() {
    let vault = vault();
    let key = vault.generate_key("Old key").unwrap();
    let identity = vault
        .save_identity(IdentityInput {
            id: None,
            label: "Identity".into(),
            username: "identity-user".into(),
            key_id: None,
            password: SecretUpdate::Set("identity-password".into()),
        })
        .unwrap();
    let saved = vault
        .save_host(HostInput {
            key_id: Some(key.id),
            password: SecretUpdate::Set("old-password".into()),
            overrides: Defaults {
                username: Some("old-user".into()),
                ..Default::default()
            },
            ..host("test")
        })
        .unwrap();
    let mut plan = vault.plan(saved.id).unwrap();
    vault
        .select_credential(&mut plan, CredentialChoice::Identity { id: identity.id })
        .unwrap();
    assert!(plan.key.is_none());
    assert_eq!(plan.username.as_deref(), Some("identity-user"));
    assert_eq!(
        plan.password.as_deref().map(|p| p.as_str()),
        Some("identity-password")
    );
    // Selection alone does not persist anything.
    assert_eq!(
        vault.plan(saved.id).unwrap().username.as_deref(),
        Some("old-user")
    );
    vault
        .authenticated(&plan, "identity-user", Remembered::default())
        .unwrap();
    let next = vault.plan(saved.id).unwrap();
    assert!(next.key.is_none());
    assert_eq!(next.username.as_deref(), Some("identity-user"));
    assert_eq!(
        next.password.as_deref().map(|p| p.as_str()),
        Some("identity-password")
    );
    assert!(!vault.view().unwrap().snapshot.passwords.contains(&saved.id));
}

#[test]
fn a_missing_credential_leaves_the_connection_plan_unchanged() {
    let vault = vault();
    let saved = vault
        .save_host(HostInput {
            overrides: Defaults {
                username: Some("original".into()),
                ..Default::default()
            },
            ..host("test")
        })
        .unwrap();
    let mut plan = vault.plan(saved.id).unwrap();
    assert!(vault
        .select_credential(
            &mut plan,
            CredentialChoice::Key {
                id: uuid::Uuid::new_v4(),
                username: "other".into()
            }
        )
        .is_err());
    assert_eq!(plan.username.as_deref(), Some("original"));
    assert!(plan.credential.is_none());
}
