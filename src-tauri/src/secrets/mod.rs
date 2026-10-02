//! Encrypted secret storage.
//!
//! Secrets are sealed with ChaCha20-Poly1305 and stored as blobs. The 256-bit
//! key comes from a [`KeySource`]: the OS keychain in the app, a fixed key in
//! tests. Without a key, secrets are unavailable and callers must ask the user
//! every time instead of storing anything in clear.

mod keychain;

use crate::{error::AppError, error::AppResult, storage::Storage};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305, Key, Nonce,
};
use std::sync::Arc;
use zeroize::Zeroizing;

pub use keychain::OsKeychain;

const NONCE_LEN: usize = 12;

/// Provides the master key, creating it on first use when the store allows.
pub trait KeySource {
    fn master_key(&self) -> Option<Zeroizing<[u8; 32]>>;
}

pub struct Secrets {
    storage: Arc<Storage>,
    cipher: Option<ChaCha20Poly1305>,
}

impl Secrets {
    pub fn new(storage: Arc<Storage>, source: &dyn KeySource) -> Self {
        let cipher = source
            .master_key()
            .map(|key| ChaCha20Poly1305::new(Key::from_slice(key.as_ref())));
        Self { storage, cipher }
    }

    pub fn available(&self) -> bool {
        self.cipher.is_some()
    }

    pub fn put(&self, id: &str, secret: &[u8]) -> AppResult<()> {
        let cipher = self.cipher()?;
        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
        let mut sealed = nonce.to_vec();
        sealed.extend(
            cipher
                .encrypt(&nonce, secret)
                .map_err(|_| AppError::new("secrets", "le secret n’a pas pu être chiffré"))?,
        );
        self.storage.put_blob(&blob_key(id), &sealed)
    }

    pub fn get(&self, id: &str) -> AppResult<Option<Zeroizing<Vec<u8>>>> {
        let Some(cipher) = self.cipher.as_ref() else {
            return Ok(None);
        };
        let Some(sealed) = self.storage.get_blob(&blob_key(id))? else {
            return Ok(None);
        };
        if sealed.len() < NONCE_LEN {
            return Err(AppError::new(
                "secrets",
                "le secret enregistré est corrompu",
            ));
        }
        let (nonce, body) = sealed.split_at(NONCE_LEN);
        cipher
            .decrypt(Nonce::from_slice(nonce), body)
            .map(|plain| Some(Zeroizing::new(plain)))
            .map_err(|_| {
                AppError::new("secrets", "le secret enregistré ne peut pas être déchiffré")
            })
    }

    pub fn get_string(&self, id: &str) -> AppResult<Option<Zeroizing<String>>> {
        Ok(self
            .get(id)?
            .and_then(|bytes| String::from_utf8(bytes.to_vec()).ok())
            .map(Zeroizing::new))
    }

    pub fn delete(&self, id: &str) -> AppResult<()> {
        self.storage.delete_blob(&blob_key(id))
    }

    fn cipher(&self) -> AppResult<&ChaCha20Poly1305> {
        self.cipher.as_ref().ok_or_else(|| {
            AppError::new(
                "secrets_unavailable",
                "aucun trousseau système n’est disponible pour protéger les secrets",
            )
        })
    }
}

fn blob_key(id: &str) -> String {
    format!("secret:{id}")
}

#[cfg(test)]
pub struct FixedKey(pub Option<[u8; 32]>);

#[cfg(test)]
impl KeySource for FixedKey {
    fn master_key(&self) -> Option<Zeroizing<[u8; 32]>> {
        self.0.map(Zeroizing::new)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn secrets(key: Option<[u8; 32]>) -> (Arc<Storage>, Secrets) {
        let storage = Arc::new(Storage::memory().unwrap());
        let secrets = Secrets::new(storage.clone(), &FixedKey(key));
        (storage, secrets)
    }

    #[test]
    fn round_trips_without_storing_plaintext() {
        let (storage, secrets) = secrets(Some([7; 32]));
        secrets.put("host:1", b"hunter2").unwrap();
        let raw = storage.get_blob("secret:host:1").unwrap().unwrap();
        assert!(!raw.windows(7).any(|window| window == b"hunter2"));
        assert_eq!(
            secrets.get_string("host:1").unwrap().unwrap().as_str(),
            "hunter2"
        );
        secrets.delete("host:1").unwrap();
        assert!(secrets.get("host:1").unwrap().is_none());
    }

    #[test]
    fn refuses_to_store_without_a_key() {
        let (_, secrets) = secrets(None);
        assert!(!secrets.available());
        assert_eq!(
            secrets.put("a", b"x").unwrap_err().code,
            "secrets_unavailable"
        );
        assert!(secrets.get("a").unwrap().is_none());
    }

    #[test]
    fn another_key_cannot_read() {
        let storage = Arc::new(Storage::memory().unwrap());
        Secrets::new(storage.clone(), &FixedKey(Some([1; 32])))
            .put("a", b"x")
            .unwrap();
        let other = Secrets::new(storage, &FixedKey(Some([2; 32])));
        assert!(other.get("a").is_err());
    }
}
