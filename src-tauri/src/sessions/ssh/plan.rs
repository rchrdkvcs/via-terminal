//! The contract between the vault and the SSH client.
//!
//! The vault turns a host into a [`ConnectPlan`] holding everything already
//! known, secrets included. While connecting, the client calls back into a
//! [`ConnectionStore`] to verify the server key and, once authenticated, to
//! persist what the user chose to remember.

use crate::error::AppResult;
use uuid::Uuid;
use zeroize::Zeroizing;

pub struct ConnectPlan {
    /// `None` for a quick connect that is not in the vault yet.
    pub host_id: Option<Uuid>,
    pub label: String,
    pub address: String,
    pub port: u16,
    /// `None` asks the user.
    pub username: Option<String>,
    pub key: Option<PlanKey>,
    pub password: Option<Zeroizing<String>>,
    /// Whether "remember" may be offered (a keychain is available).
    pub can_remember: bool,
    /// Quick connect only: save the host once authenticated.
    pub save_host: bool,
}

pub struct PlanKey {
    pub id: Uuid,
    pub label: String,
    /// The private key as stored, possibly passphrase-protected.
    pub private_key: Zeroizing<String>,
    pub passphrase: Option<Zeroizing<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostKeyStatus {
    Trusted,
    Unknown,
    Changed { previous_fingerprint: String },
}

/// The server key as presented, fingerprint as `SHA256:…`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerKey {
    pub algorithm: String,
    pub fingerprint: String,
}

/// What the user asked to remember during a successful authentication.
#[derive(Default)]
pub struct Remembered {
    pub password: Option<Zeroizing<String>>,
    pub passphrase: Option<(Uuid, Zeroizing<String>)>,
}

pub trait ConnectionStore: Send + Sync + 'static {
    fn host_key_status(&self, address: &str, port: u16, key: &ServerKey) -> HostKeyStatus;

    /// Trust `key` for this address, replacing any previous key.
    fn trust_host_key(&self, address: &str, port: u16, key: &ServerKey) -> AppResult<()>;

    /// Called once authentication succeeded. Records the connection, saves a
    /// quick-connect host, stores remembered secrets. Returns the host id when
    /// the vault changed because of it.
    fn authenticated(
        &self,
        plan: &ConnectPlan,
        username: &str,
        remembered: Remembered,
    ) -> AppResult<Option<Uuid>>;
}
