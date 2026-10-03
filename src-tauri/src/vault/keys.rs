use super::{
    input::KeyImport,
    model::{now_ms, Id, Key, SecretKind},
    Vault,
};
use crate::error::{AppError, AppResult};
use russh::keys::{decode_secret_key, ssh_key::LineEnding, Algorithm, HashAlg, PrivateKey};
use uuid::Uuid;
use zeroize::Zeroizing;

fn describe(id: Id, label: String, key: &PrivateKey, encrypted: bool) -> AppResult<Key> {
    let public = key.public_key();
    Ok(Key {
        id,
        label,
        algorithm: public.algorithm().as_str().to_string(),
        fingerprint: public.fingerprint(HashAlg::Sha256).to_string(),
        public_key: public
            .to_openssh()
            .map_err(|_| AppError::invalid("cette clé ne peut pas être exportée"))?,
        encrypted,
        created_at: now_ms(),
    })
}

fn label_or(label: &str, fallback: &str) -> String {
    let label = label.trim();
    if label.is_empty() { fallback } else { label }.to_string()
}

impl Vault {
    /// Import a pasted or file-read private key. The text is stored as given,
    /// so an encrypted key stays encrypted at rest.
    pub fn import_key(&self, import: KeyImport) -> AppResult<Key> {
        let text = Zeroizing::new(import.private_key.trim().to_string() + "\n");
        let passphrase = import.passphrase.as_deref().filter(|p| !p.is_empty());
        let encrypted = text.contains("ENCRYPTED")
            || PrivateKey::from_openssh(text.as_bytes()).is_ok_and(|key| key.is_encrypted());
        let decoded = decode_secret_key(&text, passphrase).map_err(|_| match passphrase {
            None if encrypted => AppError::new(
                "passphrase_required",
                "cette clé est protégée par une phrase de passe",
            ),
            None => AppError::invalid("ce texte n’est pas une clé privée prise en charge"),
            Some(_) => AppError::invalid("la phrase de passe est incorrecte"),
        })?;
        let id = Uuid::new_v4();
        let key = describe(
            id,
            label_or(&import.label, "Clé importée"),
            &decoded,
            encrypted,
        )?;
        self.commit_with_secrets(|data, secrets| {
            secrets.put(SecretKind::PrivateKey, id, text.as_bytes())?;
            if let (true, true, Some(passphrase)) =
                (encrypted, import.remember_passphrase, passphrase)
            {
                secrets.put(SecretKind::Passphrase, id, passphrase.as_bytes())?;
            }
            data.keys.push(key.clone());
            Ok(key)
        })
    }

    pub fn generate_key(&self, label: &str) -> AppResult<Key> {
        let mut private = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519)
            .map_err(|_| AppError::new("keys", "la clé n’a pas pu être générée"))?;
        private.set_comment("via");
        let text = private
            .to_openssh(LineEnding::LF)
            .map_err(|_| AppError::new("keys", "la clé n’a pas pu être encodée"))?;
        let id = Uuid::new_v4();
        let key = describe(id, label_or(label, "Clé Ed25519"), &private, false)?;
        self.commit_with_secrets(|data, secrets| {
            secrets.put(SecretKind::PrivateKey, id, text.as_bytes())?;
            data.keys.push(key.clone());
            Ok(key)
        })
    }

    pub fn rename_key(&self, id: Id, label: &str) -> AppResult<Key> {
        self.commit(|data| {
            let key = data
                .keys
                .iter_mut()
                .find(|key| key.id == id)
                .ok_or_else(|| AppError::not_found("clé"))?;
            key.label = label_or(label, &key.label.clone());
            Ok(key.clone())
        })
    }

    /// Hosts and identities using the key lose the reference.
    pub fn delete_key(&self, id: Id) -> AppResult<()> {
        self.commit_with_secrets(|data, secrets| {
            let before = data.keys.len();
            data.keys.retain(|key| key.id != id);
            if data.keys.len() == before {
                return Err(AppError::not_found("clé"));
            }
            for host in data.hosts.iter_mut().filter(|h| h.key_id == Some(id)) {
                host.key_id = None;
            }
            for identity in data.identities.iter_mut().filter(|i| i.key_id == Some(id)) {
                identity.key_id = None;
            }
            secrets.forget(id);
            Ok(())
        })
    }

    pub fn delete_known_host(&self, id: Id) -> AppResult<()> {
        self.commit(|data| {
            data.known_hosts.retain(|known| known.id != id);
            Ok(())
        })
    }
}
