use super::{
    input::{self, IdentityInput},
    model::{Id, Identity, SecretKind},
    Vault,
};
use crate::error::{AppError, AppResult};
use uuid::Uuid;

impl Vault {
    pub fn save_identity(&self, input: IdentityInput) -> AppResult<Identity> {
        let username = input.username.trim().to_string();
        if username.is_empty() {
            return Err(AppError::invalid(
                "une identité doit avoir un nom d’utilisateur",
            ));
        }
        input::validate_username(&username)?;
        let label = input::trimmed(Some(input.label.clone())).unwrap_or_else(|| username.clone());
        self.commit_with_secrets(|data, secrets| {
            input::validate_key_ref(data, input.key_id)?;
            let identity = Identity {
                id: input.id.unwrap_or_else(Uuid::new_v4),
                label,
                username,
                key_id: input.key_id,
            };
            match data.identities.iter_mut().find(|i| i.id == identity.id) {
                Some(existing) => *existing = identity.clone(),
                None if input.id.is_some() => return Err(AppError::not_found("identité")),
                None => data.identities.push(identity.clone()),
            }
            secrets.update(SecretKind::Password, identity.id, &input.password)?;
            Ok(identity)
        })
    }

    pub fn delete_identity(&self, id: Id) -> AppResult<()> {
        self.commit_with_secrets(|data, secrets| {
            let identity = data
                .identities
                .iter()
                .find(|identity| identity.id == id)
                .cloned()
                .ok_or_else(|| AppError::not_found("identité"))?;
            data.identities.retain(|identity| identity.id != id);
            for host in &mut data.hosts {
                host.credential.identity_removed(&identity);
            }
            secrets.forget(id);
            Ok(())
        })
    }
}
