use super::{
    input::{self, GroupInput, IdentityInput},
    model::{Defaults, Group, Id, Identity, SecretKind},
    Vault,
};
use crate::error::{AppError, AppResult};
use uuid::Uuid;

impl Vault {
    pub fn save_group(&self, input: GroupInput) -> AppResult<Group> {
        let name = input::trimmed(Some(input.name))
            .ok_or_else(|| AppError::invalid("un groupe doit avoir un nom"))?;
        let defaults = Defaults {
            username: input::trimmed(input.defaults.username),
            ..input.defaults
        };
        self.commit(|data| {
            input::validate_defaults(data, &defaults)?;
            let id = input.id.unwrap_or_else(Uuid::new_v4);
            input::validate_parent(data, id, input.parent_id)?;
            let position = data
                .groups
                .iter()
                .map(|g| g.position + 1)
                .max()
                .unwrap_or(0);
            match data.groups.iter_mut().find(|group| group.id == id) {
                Some(group) => {
                    group.name = name;
                    group.parent_id = input.parent_id;
                    group.defaults = defaults;
                    Ok(group.clone())
                }
                None if input.id.is_some() => Err(AppError::not_found("groupe")),
                None => {
                    let group = Group {
                        id,
                        parent_id: input.parent_id,
                        name,
                        position,
                        defaults,
                    };
                    data.groups.push(group.clone());
                    Ok(group)
                }
            }
        })
    }

    pub fn delete_group(&self, id: Id) -> AppResult<()> {
        self.commit(|data| {
            let group = data
                .groups
                .iter()
                .find(|group| group.id == id)
                .cloned()
                .ok_or_else(|| AppError::not_found("groupe"))?;
            data.groups.retain(|g| g.id != id);
            for child in data.groups.iter_mut().filter(|g| g.parent_id == Some(id)) {
                child.parent_id = group.parent_id;
            }
            for host in data.hosts.iter_mut().filter(|h| h.group_id == Some(id)) {
                host.group_id = group.parent_id;
            }
            Ok(())
        })
    }

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
            for group in data.groups.iter_mut() {
                if group.defaults.identity_id == Some(id) {
                    group.defaults.identity_id = None;
                }
            }
            secrets.forget(id);
            Ok(())
        })
    }
}
