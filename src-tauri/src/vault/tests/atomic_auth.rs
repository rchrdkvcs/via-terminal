use super::{failing_vault, host};
use crate::{
    sessions::ssh::{ConnectionStore, Remembered},
    vault::{
        input::{HostInput, SecretUpdate},
        model::{secret_id, SecretKind},
        HostCredential, Vault,
    },
};
use zeroize::Zeroizing;

#[test]
fn failure_on_second_secret_rolls_back_first_secret_and_connection_timestamp() {
    let sql = "CREATE TRIGGER reject_passphrase BEFORE INSERT ON blobs
        WHEN NEW.key LIKE 'secret:passphrase:%'
        BEGIN SELECT RAISE(ABORT, 'injected failure'); END;";
    let (vault, storage, secrets) = failing_vault(sql, Some([3; 32]));
    let key = vault.generate_key("key").unwrap();
    let saved = vault
        .save_host(HostInput {
            credential: HostCredential::Key {
                id: key.id,
                username: None,
            },
            password: SecretUpdate::Set("old".into()),
            ..host("a")
        })
        .unwrap();
    let plan = vault.plan(saved.id).unwrap();
    assert!(vault
        .authenticated(
            &plan,
            "user",
            Remembered {
                password: Some(Zeroizing::new("new".into())),
                passphrase: Some((key.id, Zeroizing::new("phrase".into()))),
            }
        )
        .is_err());
    for current in [&vault, &Vault::load(storage, secrets).unwrap()] {
        let view = current.view().unwrap();
        assert_eq!(view.snapshot.data.hosts, vec![saved.clone()]);
        assert!(view.snapshot.passphrases.is_empty());
        assert_eq!(
            current.plan(saved.id).unwrap().password.unwrap().as_str(),
            "old"
        );
    }
}

#[test]
fn completed_authentication_does_not_resurrect_a_deleted_host() {
    let (vault, storage, secrets) = failing_vault("", Some([3; 32]));
    let saved = vault.save_host(host("a")).unwrap();
    let plan = vault.plan(saved.id).unwrap();
    vault.delete_host(saved.id).unwrap();
    assert_eq!(
        vault
            .authenticated(
                &plan,
                "user",
                Remembered {
                    password: Some(Zeroizing::new("pw".into())),
                    passphrase: None,
                }
            )
            .unwrap(),
        None
    );
    assert!(secrets
        .get(&secret_id(SecretKind::Password, saved.id))
        .unwrap()
        .is_none());
    for current in [&vault, &Vault::load(storage, secrets).unwrap()] {
        assert!(current.view().unwrap().snapshot.data.hosts.is_empty());
    }
}

#[test]
fn completed_authentication_does_not_remember_a_deleted_keys_passphrase() {
    let (vault, storage, secrets) = failing_vault("", Some([3; 32]));
    let key = vault.generate_key("key").unwrap();
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
    vault.delete_key(key.id).unwrap();
    assert_eq!(
        vault
            .authenticated(
                &plan,
                "user",
                Remembered {
                    password: None,
                    passphrase: Some((key.id, Zeroizing::new("phrase".into()))),
                }
            )
            .unwrap(),
        None
    );
    assert!(secrets
        .get(&secret_id(SecretKind::Passphrase, key.id))
        .unwrap()
        .is_none());
    for current in [&vault, &Vault::load(storage, secrets).unwrap()] {
        assert!(current.view().unwrap().snapshot.data.keys.is_empty());
        assert!(current.plan(saved.id).unwrap().key.is_none());
    }
}
