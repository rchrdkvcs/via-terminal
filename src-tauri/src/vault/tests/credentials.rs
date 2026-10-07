use super::{host, vault};
use crate::{
    secrets::{FixedKey, Secrets},
    sessions::ssh::{ConnectionStore, CredentialChoice, Remembered},
    storage::Storage,
    vault::{input::*, model::*, HostCredential, Vault},
};
use std::sync::Arc;

fn identity(vault: &Vault, username: &str, key_id: Option<Id>, password: &str) -> Identity {
    vault
        .save_identity(IdentityInput {
            id: None,
            label: username.into(),
            username: username.into(),
            key_id,
            password: SecretUpdate::Set(password.into()),
        })
        .unwrap()
}

#[test]
fn a_record_stored_before_the_selector_loads_and_saves_in_the_new_shape() {
    let storage = Arc::new(Storage::memory().unwrap());
    let id = uuid::Uuid::new_v4();
    storage
        .save(
            "vault",
            &serde_json::json!({ "hosts": [{
                "id": id, "groupId": null, "label": "a", "address": "a", "keyId": null,
                "overrides": { "username": "root", "port": 2200, "identityId": null },
            }] }),
        )
        .unwrap();
    let secrets = Arc::new(Secrets::new(storage.clone(), &FixedKey(Some([3; 32]))));
    let vault = Vault::load(storage, secrets).unwrap();
    let plan = vault.plan(id).unwrap();
    assert_eq!((plan.username.as_deref(), plan.port), (Some("root"), 2200));
    let host = &vault.view().unwrap().snapshot.data.hosts[0];
    let saved = serde_json::to_value(host).unwrap();
    assert_eq!(
        saved["credential"],
        serde_json::json!({ "kind": "inherit", "username": "root", "key": null })
    );
    assert!(saved.get("ownCredentials").is_none() && saved.get("overrides").is_none());
}

#[test]
fn an_explicit_host_credential_does_not_use_group_secrets() {
    let vault = vault();
    let key = vault.generate_key("Group key").unwrap();
    let identity = identity(&vault, "group-user", Some(key.id), "group-password");
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
            group_id: Some(group.id),
            credential: HostCredential::Password {
                username: Some(" own-user ".into()),
            },
            ..host("test")
        })
        .unwrap();
    assert_eq!(
        saved.credential,
        HostCredential::Password {
            username: Some("own-user".into())
        }
    );
    let plan = vault.plan(saved.id).unwrap();
    assert_eq!(plan.username.as_deref(), Some("own-user"));
    assert_eq!(plan.port, 2200);
    assert!(plan.key.is_none());
    assert!(plan.password.is_none());
}

#[test]
fn saving_rejects_a_credential_missing_from_the_vault() {
    let vault = vault();
    for credential in [
        HostCredential::Identity {
            id: uuid::Uuid::new_v4(),
        },
        HostCredential::Key {
            id: uuid::Uuid::new_v4(),
            username: None,
        },
        HostCredential::Password {
            username: Some("-oProxyCommand".into()),
        },
    ] {
        assert!(vault
            .save_host(HostInput {
                credential,
                ..host("test")
            })
            .is_err());
    }
    assert!(vault.view().unwrap().snapshot.data.hosts.is_empty());
}

#[test]
fn deleting_a_selected_identity_or_key_keeps_the_username_and_asks_for_a_password() {
    let vault = vault();
    let key = vault.generate_key("Key").unwrap();
    let identity = identity(&vault, "deploy", None, "pw");
    let by_identity = vault
        .save_host(HostInput {
            credential: HostCredential::Identity { id: identity.id },
            ..host("a")
        })
        .unwrap();
    let by_key = vault
        .save_host(HostInput {
            credential: HostCredential::Key {
                id: key.id,
                username: Some("root".into()),
            },
            ..host("b")
        })
        .unwrap();
    vault.delete_identity(identity.id).unwrap();
    vault.delete_key(key.id).unwrap();
    let hosts = vault.view().unwrap().snapshot.data.hosts;
    assert_eq!(
        hosts[0].credential,
        HostCredential::Password {
            username: Some("deploy".into())
        }
    );
    assert_eq!(
        hosts[1].credential,
        HostCredential::Password {
            username: Some("root".into())
        }
    );
    let plan = vault.plan(by_identity.id).unwrap();
    assert!(plan.password.is_none());
    assert!(vault.plan(by_key.id).unwrap().key.is_none());
}

#[test]
fn selecting_an_identity_replaces_old_host_credentials_after_success() {
    let vault = vault();
    let key = vault.generate_key("Old key").unwrap();
    let identity = identity(&vault, "identity-user", None, "identity-password");
    let saved = vault
        .save_host(HostInput {
            credential: HostCredential::Key {
                id: key.id,
                username: Some("old-user".into()),
            },
            password: SecretUpdate::Set("old-password".into()),
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
            credential: HostCredential::Password {
                username: Some("original".into()),
            },
            ..host("test")
        })
        .unwrap();
    let mut plan = vault.plan(saved.id).unwrap();
    for choice in [
        CredentialChoice::Key {
            id: uuid::Uuid::new_v4(),
            username: "other".into(),
        },
        CredentialChoice::Password {
            username: "  ".into(),
        },
    ] {
        assert!(vault.select_credential(&mut plan, choice).is_err());
    }
    assert_eq!(plan.username.as_deref(), Some("original"));
    assert!(plan.credential.is_none());
}
