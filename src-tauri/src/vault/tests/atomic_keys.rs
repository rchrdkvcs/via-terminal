use super::{failing_vault, host};
use crate::{
    secrets::{FixedKey, Secrets},
    storage::Storage,
    vault::{
        input::{HostInput, KeyImport},
        model::VaultData,
        HostCredential, Vault,
    },
};
use std::sync::Arc;

#[test]
fn failed_key_creation_leaves_no_orphaned_secret() {
    let uri = format!("file:{}?mode=memory&cache=shared", uuid::Uuid::new_v4());
    let observer = rusqlite::Connection::open(&uri).unwrap();
    let storage = Arc::new(
        Storage::with_faults(
            rusqlite::Connection::open(&uri).unwrap(),
            "CREATE TRIGGER reject_document BEFORE INSERT ON documents
             BEGIN SELECT RAISE(ABORT, 'injected failure'); END;",
        )
        .unwrap(),
    );
    let secrets = Arc::new(Secrets::new(storage.clone(), &FixedKey(Some([3; 32]))));
    let vault = Vault::load(storage.clone(), secrets.clone()).unwrap();
    assert!(vault.generate_key("new").is_err());
    let source = super::vault();
    let key = source.generate_key("source").unwrap();
    let saved = source
        .save_host(HostInput {
            credential: HostCredential::Key {
                id: key.id,
                username: None,
            },
            ..host("a")
        })
        .unwrap();
    let private_key = source.plan(saved.id).unwrap().key.unwrap().private_key;
    assert!(vault
        .import_key(KeyImport {
            label: "import".into(),
            private_key: private_key.to_string(),
            passphrase: None,
            remember_passphrase: false,
        })
        .is_err());
    let count: i64 = observer
        .query_row("SELECT count(*) FROM blobs", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
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
fn failed_key_deletion_keeps_key_secret_and_host_reference() {
    let sql = "CREATE TRIGGER reject_delete BEFORE DELETE ON blobs
               BEGIN SELECT RAISE(ABORT, 'injected failure'); END;";
    let (vault, storage, secrets) = failing_vault(sql, Some([3; 32]));
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
    assert!(vault.delete_key(key.id).is_err());
    for current in [&vault, &Vault::load(storage, secrets).unwrap()] {
        assert_eq!(
            current.view().unwrap().snapshot.data.keys,
            vec![key.clone()]
        );
        let planned = current.plan(saved.id).unwrap().key.unwrap();
        assert_eq!(planned.id, key.id);
        assert!(planned.private_key.contains("OPENSSH PRIVATE KEY"));
    }
}

#[test]
fn successful_secret_mutations_survive_reload() {
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
    let reloaded = Vault::load(storage.clone(), secrets.clone()).unwrap();
    assert_eq!(reloaded.plan(saved.id).unwrap().key.unwrap().id, key.id);
    reloaded.delete_key(key.id).unwrap();
    let reloaded = Vault::load(storage, secrets).unwrap();
    assert!(reloaded.view().unwrap().snapshot.data.keys.is_empty());
    assert!(reloaded.plan(saved.id).unwrap().key.is_none());
}
