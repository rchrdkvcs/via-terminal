use super::{
    model::{now_ms, Defaults, Host, Id, KnownHost, SecretKind},
    Vault,
};
use crate::{
    error::AppResult,
    sessions::ssh::{ConnectPlan, ConnectionStore, HostKeyStatus, Remembered, ServerKey},
};
use uuid::Uuid;

impl ConnectionStore for Vault {
    fn select_credential(
        &self,
        plan: &mut ConnectPlan,
        choice: crate::sessions::ssh::CredentialChoice,
    ) -> AppResult<()> {
        self.apply_credential(plan, choice)
    }

    fn host_key_status(&self, address: &str, port: u16, key: &ServerKey) -> HostKeyStatus {
        self.read(|data| {
            let known = data
                .known_hosts
                .iter()
                .find(|k| k.address.eq_ignore_ascii_case(address) && k.port == port);
            match known {
                None => HostKeyStatus::Unknown,
                Some(known) if known.fingerprint == key.fingerprint => HostKeyStatus::Trusted,
                Some(known) => HostKeyStatus::Changed {
                    previous_fingerprint: known.fingerprint.clone(),
                },
            }
        })
    }

    fn trust_host_key(&self, address: &str, port: u16, key: &ServerKey) -> AppResult<()> {
        self.commit(|data| {
            data.known_hosts
                .retain(|k| !(k.address.eq_ignore_ascii_case(address) && k.port == port));
            data.known_hosts.push(KnownHost {
                id: Uuid::new_v4(),
                address: address.to_string(),
                port,
                algorithm: key.algorithm.clone(),
                fingerprint: key.fingerprint.clone(),
                added_at: now_ms(),
            });
            Ok(())
        })
    }

    fn authenticated(
        &self,
        plan: &ConnectPlan,
        username: &str,
        remembered: Remembered,
    ) -> AppResult<Option<Id>> {
        if plan.host_id.is_none() && !plan.save_host {
            return Ok(None);
        }
        let saved = plan.host_id.is_none();
        self.commit_with_secrets(|data, secrets| {
            if plan
                .credential
                .as_ref()
                .is_some_and(|choice| !super::credentials::exists(data, choice))
            {
                return Ok(None);
            }
            if plan
                .host_id
                .is_some_and(|id| !data.hosts.iter().any(|host| host.id == id))
            {
                return Ok(None);
            }
            let host_id = if let Some(host) = plan
                .host_id
                .and_then(|id| data.hosts.iter_mut().find(|h| h.id == id))
            {
                host.last_connected_at = Some(now_ms());
                host.id
            } else {
                let host = Host {
                    own_credentials: false,
                    id: Uuid::new_v4(),
                    group_id: None,
                    label: plan.label.clone(),
                    address: plan.address.clone(),
                    overrides: Defaults {
                        username: Some(username.to_string()),
                        port: (plan.port != 22).then_some(plan.port),
                        identity_id: None,
                    },
                    key_id: None,
                    tags: vec![],
                    notes: String::new(),
                    created_at: now_ms(),
                    last_connected_at: Some(now_ms()),
                };
                data.hosts.push(host.clone());
                host.id
            };
            let mut changed = saved;
            if let Some(choice) = &plan.credential {
                use crate::sessions::ssh::CredentialChoice;
                let host = data
                    .hosts
                    .iter_mut()
                    .find(|host| host.id == host_id)
                    .unwrap();
                match choice {
                    CredentialChoice::Password { .. } => {
                        host.overrides.identity_id = None;
                        host.overrides.username = Some(username.to_string());
                        host.key_id = None;
                        host.own_credentials = true;
                    }
                    CredentialChoice::Identity { id } => {
                        host.overrides.identity_id = Some(*id);
                        host.overrides.username = None;
                        host.key_id = None;
                        host.own_credentials = false;
                    }
                    CredentialChoice::Key { id, .. } => {
                        host.overrides.identity_id = None;
                        host.overrides.username = Some(username.to_string());
                        host.key_id = Some(*id);
                        host.own_credentials = true;
                    }
                }
                secrets.update(
                    SecretKind::Password,
                    host_id,
                    &super::input::SecretUpdate::Clear,
                )?;
                changed = true;
            }
            if let Some(password) = remembered.password {
                let owner = match plan.credential {
                    Some(crate::sessions::ssh::CredentialChoice::Identity { id }) => id,
                    _ => host_id,
                };
                secrets.put(SecretKind::Password, owner, password.as_bytes())?;
                changed = true;
            }
            if let Some((key_id, passphrase)) = remembered.passphrase {
                if data.keys.iter().any(|key| key.id == key_id) {
                    secrets.put(SecretKind::Passphrase, key_id, passphrase.as_bytes())?;
                    changed = true;
                }
            }
            Ok(changed.then_some(host_id))
        })
    }
}
