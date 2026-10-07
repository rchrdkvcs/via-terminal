use super::{
    input,
    model::{secret_id, Defaults, Id, Identity, SecretKind, VaultData},
    resolve::{Effective, Inherited, Source, Sourced},
    Vault,
};
use crate::{
    error::{AppError, AppResult},
    sessions::ssh::{ConnectPlan, CredentialChoice, PlanKey},
};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum HostCredential {
    #[default]
    Inherit,
    Identity {
        id: Id,
    },
    Key {
        id: Id,
        username: Option<String>,
    },
    Password {
        username: Option<String>,
    },
}

impl HostCredential {
    /// Reads the separate fields stored before the selector existed. A host
    /// identity wins over older fields; any other host username or key is an
    /// explicit credential that no longer mixes with group defaults.
    pub(super) fn from_legacy(own: bool, overrides: &Defaults, key_id: Option<Id>) -> Self {
        let username = overrides.username.clone();
        match (overrides.identity_id.filter(|_| !own), key_id) {
            (Some(id), _) => Self::Identity { id },
            (None, Some(id)) => Self::Key { id, username },
            (None, None) if own || username.is_some() => Self::Password { username },
            (None, None) => Self::Inherit,
        }
    }

    pub(super) fn chosen(choice: &CredentialChoice) -> AppResult<Self> {
        match choice {
            CredentialChoice::Identity { .. } => Ok(Self::authenticated(choice, "")),
            CredentialChoice::Password { username } | CredentialChoice::Key { username, .. } => {
                input::validate_username(username)?;
                let username = input::trimmed(Some(username.clone())).ok_or_else(|| {
                    AppError::new("invalid_username", "Ajoutez un nom d’utilisateur")
                })?;
                Ok(Self::authenticated(choice, &username))
            }
        }
    }

    pub(super) fn authenticated(choice: &CredentialChoice, username: &str) -> Self {
        let username = Some(username.to_string());
        match choice {
            CredentialChoice::Password { .. } => Self::Password { username },
            CredentialChoice::Identity { id } => Self::Identity { id: *id },
            CredentialChoice::Key { id, .. } => Self::Key { id: *id, username },
        }
    }

    pub(super) fn normalized(self) -> Self {
        match self {
            Self::Key { id, username } => Self::Key {
                id,
                username: input::trimmed(username),
            },
            Self::Password { username } => Self::Password {
                username: input::trimmed(username),
            },
            other => other,
        }
    }

    pub(super) fn validate(&self, data: &VaultData) -> AppResult<()> {
        if let Self::Key {
            username: Some(username),
            ..
        }
        | Self::Password {
            username: Some(username),
        } = self
        {
            input::validate_username(username)?;
        }
        self.validate_references(data)
    }

    pub(super) fn validate_references(&self, data: &VaultData) -> AppResult<()> {
        match self {
            Self::Identity { id } if !data.identities.iter().any(|i| i.id == *id) => {
                Err(AppError::not_found("identité"))
            }
            Self::Key { id, .. } if !data.keys.iter().any(|key| key.id == *id) => {
                Err(AppError::not_found("clé"))
            }
            _ => Ok(()),
        }
    }

    pub(super) fn identity_removed(&mut self, identity: &Identity) {
        if *self == (Self::Identity { id: identity.id }) {
            *self = Self::Password {
                username: Some(identity.username.clone()),
            };
        }
    }

    pub(super) fn key_removed(&mut self, key_id: Id) {
        if let Self::Key { id, username } = self {
            if *id == key_id {
                *self = Self::Password {
                    username: username.take(),
                };
            }
        }
    }

    pub(super) fn resolve(&self, data: &VaultData, inherited: Inherited) -> Effective {
        fn host<T>(value: T) -> Sourced<T> {
            Sourced {
                value,
                from: Source::Host,
            }
        }
        let (username, identity_id, key_id) = match self {
            Self::Inherit => (inherited.username, inherited.identity_id, None),
            Self::Identity { id } => match data.identities.iter().find(|i| i.id == *id) {
                Some(identity) => (
                    Some(Sourced {
                        value: identity.username.clone(),
                        from: Source::Identity(identity.id),
                    }),
                    Some(host(identity.id)),
                    None,
                ),
                None => (None, None, None),
            },
            Self::Key { id, username } => (username.clone().map(host), None, Some(host(*id))),
            Self::Password { username } => (username.clone().map(host), None, None),
        };
        let key_id = key_id.or_else(|| {
            let id = identity_id.as_ref()?.value;
            let identity = data.identities.iter().find(|i| i.id == id)?;
            identity.key_id.map(|value| Sourced {
                value,
                from: Source::Identity(identity.id),
            })
        });
        Effective {
            username,
            port: inherited.port.unwrap_or(Sourced {
                value: 22,
                from: Source::Default,
            }),
            identity_id,
            key_id,
        }
    }

    fn password_owners(&self, host: Option<Id>, identity: Option<Id>) -> Vec<Id> {
        let host = host.filter(|_| !matches!(self, Self::Identity { .. }));
        host.into_iter().chain(identity).collect()
    }

    pub(super) fn password_owner(&self, host: Id) -> Id {
        match self {
            Self::Identity { id } => *id,
            _ => host,
        }
    }
}

impl Vault {
    pub(super) fn connection(
        &self,
        data: &VaultData,
        host: Option<Id>,
        credential: &HostCredential,
        effective: &Effective,
    ) -> AppResult<(Option<PlanKey>, Option<Zeroizing<String>>)> {
        let key = effective
            .key_id
            .as_ref()
            .map(|sourced| self.plan_key(data, sourced.value))
            .transpose()?;
        let identity = effective.identity_id.as_ref().map(|sourced| sourced.value);
        for owner in credential.password_owners(host, identity) {
            if let Some(password) = self
                .secrets
                .get_string(&secret_id(SecretKind::Password, owner))?
            {
                return Ok((key, Some(password)));
            }
        }
        Ok((key, None))
    }

    pub(super) fn apply_credential(
        &self,
        plan: &mut ConnectPlan,
        choice: CredentialChoice,
    ) -> AppResult<()> {
        let credential = HostCredential::chosen(&choice)?;
        let (username, (key, password)) = self.read(|data| {
            credential.validate_references(data)?;
            let effective = credential.resolve(data, Inherited::default());
            let connection = self.connection(data, None, &credential, &effective)?;
            Ok::<_, AppError>((effective.username.map(|s| s.value), connection))
        })?;
        plan.username = username;
        plan.key = key;
        plan.password = password;
        plan.credential = Some(choice);
        Ok(())
    }
}
