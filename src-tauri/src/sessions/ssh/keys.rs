use super::{asker::Asker, PlanKey};
use crate::sessions::prompts::{Prompt, PromptAnswer};
use russh::keys::{decode_secret_key, Error, PrivateKey};
use zeroize::Zeroizing;

const PASSPHRASE_ATTEMPTS: usize = 3;

pub(super) struct Unlocked {
    pub key: PrivateKey,
    pub remember: Option<Zeroizing<String>>,
}

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
