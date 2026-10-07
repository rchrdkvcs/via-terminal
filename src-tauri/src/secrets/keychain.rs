use super::KeySource;
use chacha20poly1305::{
    aead::{KeyInit, OsRng},
    ChaCha20Poly1305,
};
use zeroize::Zeroizing;

const SERVICE: &str = "dev.viaterminal.desktop";
const ACCOUNT: &str = "vault-master-key";

pub struct OsKeychain;

impl KeySource for OsKeychain {
    fn master_key(&self) -> Option<Zeroizing<[u8; 32]>> {
        let entry = keyring::Entry::new(SERVICE, ACCOUNT).ok()?;
        match entry.get_secret() {
            Ok(bytes) => to_key(Zeroizing::new(bytes)),
            Err(keyring::Error::NoEntry) => {
                let key = ChaCha20Poly1305::generate_key(&mut OsRng);
                entry.set_secret(key.as_slice()).ok()?;

                to_key(Zeroizing::new(entry.get_secret().ok()?))
            }
            Err(_) => None,
        }
    }
}

fn to_key(bytes: Zeroizing<Vec<u8>>) -> Option<Zeroizing<[u8; 32]>> {
    let array: [u8; 32] = bytes.as_slice().try_into().ok()?;
    Some(Zeroizing::new(array))
}
