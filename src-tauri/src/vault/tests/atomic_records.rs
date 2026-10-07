use super::{failing_vault, host};
use crate::{
    sessions::ssh::{ConnectionStore, Remembered},
    vault::{
        input::{HostInput, IdentityInput, SecretUpdate},
        model::{secret_id, SecretKind, VaultData},
        HostCredential, QuickTarget, Vault,
    },
};
use zeroize::Zeroizing;

const FAIL_REPLACEMENT: &str = "CREATE TRIGGER reject_secret BEFORE INSERT ON blobs
    WHEN json_extract((SELECT json FROM documents WHERE key='vault'), '$.hosts[0].notes')='reject'
    BEGIN SELECT RAISE(ABORT, 'injected failure'); END;";

#[test]
fn failed_password_replacement_preserves_metadata_and_secret_after_reload() {
    let (vault, storage, secrets) = failing_vault(FAIL_REPLACEMENT, Some([3; 32]));
    let saved = vault
        .save_host(HostInput {
            password: SecretUpdate::Set("old".into()),
            ..host("a")
        })
        .unwrap();
    assert!(vault
        .save_host(HostInput {
            id: Some(saved.id),
            notes: "reject".into(),
            password: SecretUpdate::Set("new".into()),
            ..host("b")
        })
        .is_err());
    for current in [&vault, &Vault::load(storage, secrets).unwrap()] {
        assert_eq!(
            current.view().unwrap().snapshot.data.hosts,
            vec![saved.clone()]
        );
        assert_eq!(
            current.plan(saved.id).unwrap().password.unwrap().as_str(),
            "old"
        );
    }
}

#[test]
fn unavailable_key_does_not_publish_hosts_or_identities() {
    let (vault, storage, secrets) = failing_vault("", None);
    assert!(vault
        .save_host(HostInput {
            password: SecretUpdate::Set("pw".into()),
            ..host("a")
        })
        .is_err());
    assert!(vault
        .save_identity(IdentityInput {
            id: None,
            label: "".into(),
            username: "user".into(),
            key_id: None,
            password: SecretUpdate::Set("pw".into()),
        })
        .is_err());
    assert_eq!(vault.view().unwrap().snapshot.data, VaultData::default());
    assert_eq!(
        Vault::load(storage, secrets)
            .unwrap()
            .view()
            .unwrap()
            .snapshot
            .data,
        VaultData::default()
    );
}

#[test]
fn failed_secret_deletion_preserves_host_and_identity_references() {
    let sql = "CREATE TRIGGER reject_delete BEFORE DELETE ON blobs
               BEGIN SELECT RAISE(ABORT, 'injected failure'); END;";
    let (vault, storage, secrets) = failing_vault(sql, Some([3; 32]));
    let identity = vault
        .save_identity(IdentityInput {
            id: None,
            label: "".into(),
            username: "user".into(),
            key_id: None,
            password: SecretUpdate::Set("pw".into()),
        })
        .unwrap();
    let mut input = host("a");
    input.credential = HostCredential::Identity { id: identity.id };
    input.password = SecretUpdate::Set("host-pw".into());
    let saved = vault.save_host(input).unwrap();
    assert!(vault.delete_identity(identity.id).is_err());
    assert!(vault.delete_host(saved.id).is_err());
    for current in [&vault, &Vault::load(storage, secrets).unwrap()] {
        assert_eq!(
            current.view().unwrap().snapshot.data.identities,
            vec![identity.clone()]
        );
        assert_eq!(
            current.view().unwrap().snapshot.data.hosts,
            vec![saved.clone()]
        );
        assert_eq!(
            current
                .secrets
                .get_string(&secret_id(SecretKind::Password, saved.id))
                .unwrap()
                .unwrap()
                .as_str(),
            "host-pw"
        );
        // The selected identity is authoritative; the old host secret remains intact.
        assert_eq!(
            current.plan(saved.id).unwrap().password.unwrap().as_str(),
            "pw"
        );
    }
}

#[test]
fn failed_remembering_does_not_save_quick_connect() {
    let sql = "CREATE TRIGGER reject_secret BEFORE INSERT ON blobs
               BEGIN SELECT RAISE(ABORT, 'injected failure'); END;";
    let (vault, storage, secrets) = failing_vault(sql, Some([3; 32]));
    let plan = vault
        .quick_plan(
            QuickTarget {
                address: "a".into(),
                port: None,
                username: None,
            },
            true,
        )
        .unwrap();
    assert!(vault
        .authenticated(
            &plan,
            "user",
            Remembered {
                password_verified: false,
                password: Some(Zeroizing::new("pw".into())),
                passphrase: None,
            }
        )
        .is_err());
    assert!(vault.view().unwrap().snapshot.data.hosts.is_empty());
    assert!(Vault::load(storage, secrets)
        .unwrap()
        .view()
        .unwrap()
        .snapshot
        .data
        .hosts
        .is_empty());
}
