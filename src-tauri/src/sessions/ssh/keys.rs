//! Unlocking the plan's private key, asking for its passphrase when needed.
//!
//! The stored passphrase is tried first. A key that is merely unreadable is
//! skipped without bothering the user; an encrypted one gets a few prompts.

use super::{asker::Asker, PlanKey};
use crate::sessions::prompts::{Prompt, PromptAnswer};
use russh::keys::{decode_secret_key, Error, PrivateKey};
use zeroize::Zeroizing;

const PASSPHRASE_ATTEMPTS: usize = 3;

/// The decoded key, with the passphrase the user typed and asked to remember.
pub(super) struct Unlocked {
    pub key: PrivateKey,
    pub remember: Option<Zeroizing<String>>,
}

/// `None` when the key cannot be used: unreadable, or the user gave up.
pub(super) async fn unlock(key: &PlanKey, asker: &Asker) -> Option<Unlocked> {
    let stored = key
        .passphrase
        .as_ref()
        .map(|passphrase| passphrase.as_str());
    match decode_secret_key(&key.private_key, stored) {
        Ok(decoded) => {
            return Some(Unlocked {
                key: decoded,
                remember: None,
            })
        }
        Err(error) if !needs_passphrase(&key.private_key, &error, stored.is_some()) => return None,
        Err(_) => {}
    }
    let mut retry = stored.is_some();
    for _ in 0..PASSPHRASE_ATTEMPTS {
        let prompt = Prompt::Passphrase {
            key_label: key.label.clone(),
            can_remember: asker.can_remember,
            retry,
        };
        let PromptAnswer::Text { value, remember } = asker.ask(prompt).await else {
            return None;
        };
        let value = Zeroizing::new(value);
        if let Ok(decoded) = decode_secret_key(&key.private_key, Some(value.as_str())) {
            return Some(Unlocked {
                key: decoded,
                remember: remember.then_some(value),
            });
        }
        retry = true;
    }
    None
}

/// Whether failing to decode means a passphrase is missing or wrong, rather
/// than the key being unusable. Encrypted PKCS#8 and PuTTY keys do not report
/// `KeyIsEncrypted` without a passphrase, so their text is checked too.
fn needs_passphrase(text: &str, error: &Error, passphrase_tried: bool) -> bool {
    passphrase_tried
        || matches!(error, Error::KeyIsEncrypted)
        || text.contains("-----BEGIN ENCRYPTED PRIVATE KEY-----")
        || text.lines().any(|line| {
            line.strip_prefix("Encryption:")
                .is_some_and(|cipher| cipher.trim() != "none")
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypted_keys_need_a_passphrase() {
        let unreadable = Error::CouldNotReadKey;
        assert!(needs_passphrase("", &Error::KeyIsEncrypted, false));
        assert!(needs_passphrase(
            "-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n",
            &unreadable,
            false
        ));
        assert!(needs_passphrase(
            "PuTTY-User-Key-File-3: ssh-ed25519\nEncryption: aes256-cbc\n",
            &unreadable,
            false
        ));
        assert!(needs_passphrase("anything", &unreadable, true));
    }

    #[test]
    fn unreadable_plain_keys_are_skipped() {
        let unreadable = Error::CouldNotReadKey;
        assert!(!needs_passphrase("not a key", &unreadable, false));
        assert!(!needs_passphrase(
            "PuTTY-User-Key-File-3: ssh-ed25519\nEncryption: none\n",
            &unreadable,
            false
        ));
    }
}
