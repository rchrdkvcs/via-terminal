use crate::error::AppResult;
use ts_rs::TS;
use uuid::Uuid;
use zeroize::Zeroizing;

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CredentialChoice {
    Password { username: String },
    Identity { id: Uuid },
    Key { id: Uuid, username: String },
}

pub struct ConnectPlan {
    pub credential: Option<CredentialChoice>,
    pub host_id: Option<Uuid>,
    pub label: String,
    pub address: String,
    pub port: u16,

    pub username: Option<String>,
    pub key: Option<PlanKey>,
    pub password: Option<Zeroizing<String>>,

    pub can_remember: bool,

    pub save_host: bool,
}

pub struct PlanKey {
    pub id: Uuid,
    pub label: String,

    pub private_key: Zeroizing<String>,
    pub passphrase: Option<Zeroizing<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostKeyStatus {
    Trusted,
    Unknown,
    Changed { previous_fingerprint: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerKey {
    pub algorithm: String,
    pub fingerprint: String,
}

#[derive(Default)]
pub struct Remembered {
    pub password_verified: bool,
    pub password: Option<Zeroizing<String>>,
    pub passphrase: Option<(Uuid, Zeroizing<String>)>,
}

pub trait ConnectionStore: Send + Sync + 'static {
    fn select_credential(&self, plan: &mut ConnectPlan, choice: CredentialChoice) -> AppResult<()>;

    fn host_key_status(&self, address: &str, port: u16, key: &ServerKey) -> HostKeyStatus;

    fn trust_host_key(&self, address: &str, port: u16, key: &ServerKey) -> AppResult<()>;

    fn authenticated(
        &self,
        plan: &ConnectPlan,
        username: &str,
        remembered: Remembered,
    ) -> AppResult<Option<Uuid>>;
}
