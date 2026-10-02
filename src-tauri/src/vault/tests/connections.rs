use super::vault;
use crate::{
    sessions::ssh::{ConnectionStore, HostKeyStatus, Remembered, ServerKey},
    vault::QuickTarget,
};
use zeroize::Zeroizing;

#[test]
fn quick_connect_saves_the_host_and_remembered_password_once_authenticated() {
    let vault = vault();
    let plan = vault
        .quick_plan(
            QuickTarget {
                address: "10.0.0.5".into(),
                port: Some(2200),
                username: Some("root".into()),
            },
            true,
        )
        .unwrap();
    let remembered = Remembered {
        password: Some(Zeroizing::new("pw".into())),
        passphrase: None,
    };
    let id = vault
        .authenticated(&plan, "root", remembered)
        .unwrap()
        .unwrap();
    let saved = vault.plan(id).unwrap();
    assert_eq!(
        (saved.port, saved.username.as_deref()),
        (2200, Some("root"))
    );
    assert_eq!(saved.password.as_deref().map(|p| p.as_str()), Some("pw"));

    let unsaved = vault
        .quick_plan(
            QuickTarget {
                address: "b".into(),
                port: None,
                username: None,
            },
            false,
        )
        .unwrap();
    assert_eq!(
        vault
            .authenticated(&unsaved, "u", Remembered::default())
            .unwrap(),
        None
    );
}

#[test]
fn host_keys_are_trusted_explicitly_and_changes_detected() {
    let vault = vault();
    let key = |fingerprint: &str| ServerKey {
        algorithm: "ssh-ed25519".into(),
        fingerprint: fingerprint.into(),
    };
    assert_eq!(
        vault.host_key_status("h", 22, &key("A")),
        HostKeyStatus::Unknown
    );
    vault.trust_host_key("h", 22, &key("A")).unwrap();
    assert_eq!(
        vault.host_key_status("H", 22, &key("A")),
        HostKeyStatus::Trusted
    );
    assert_eq!(
        vault.host_key_status("h", 22, &key("B")),
        HostKeyStatus::Changed {
            previous_fingerprint: "A".into()
        }
    );
    assert_eq!(
        vault.host_key_status("h", 2222, &key("A")),
        HostKeyStatus::Unknown
    );
}
