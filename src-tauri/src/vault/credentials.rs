use super::{
    input,
    model::{secret_id, SecretKind},
    Vault,
};
use crate::{
    error::{AppError, AppResult},
    sessions::ssh::{ConnectPlan, CredentialChoice},
};

impl Vault {
    pub(super) fn apply_credential(
        &self,
        plan: &mut ConnectPlan,
        choice: CredentialChoice,
    ) -> AppResult<()> {
        let (username, key, password) = self.read(|data| match &choice {
            CredentialChoice::Password { username } => {
                input::validate_username(username)?;
                if username.trim().is_empty() {
                    return Err(AppError::new(
                        "invalid_username",
                        "Ajoutez un nom d’utilisateur",
                    ));
                }
                Ok((username.trim().to_string(), None, None))
            }
            CredentialChoice::Identity { id } => {
                let identity = data
                    .identities
                    .iter()
                    .find(|identity| identity.id == *id)
                    .ok_or_else(|| AppError::not_found("identité"))?;
                Ok((
                    identity.username.clone(),
                    identity
                        .key_id
                        .map(|id| self.plan_key(data, id))
                        .transpose()?,
                    self.secrets
                        .get_string(&secret_id(SecretKind::Password, *id))?,
                ))
            }
            CredentialChoice::Key { id, username } => {
                input::validate_username(username)?;
                if username.trim().is_empty() {
                    return Err(AppError::new(
                        "invalid_username",
                        "Ajoutez un nom d’utilisateur",
                    ));
                }
                Ok((
                    username.trim().to_string(),
                    Some(self.plan_key(data, *id)?),
                    None,
                ))
            }
        })?;
        plan.username = Some(username);
        plan.key = key;
        plan.password = password;
        plan.credential = Some(choice);
        Ok(())
    }
}

pub(super) fn exists(data: &super::model::VaultData, choice: &CredentialChoice) -> bool {
    match choice {
        CredentialChoice::Identity { id } => {
            data.identities.iter().any(|identity| identity.id == *id)
        }
        CredentialChoice::Key { id, .. } => data.keys.iter().any(|key| key.id == *id),
        CredentialChoice::Password { .. } => true,
    }
}
