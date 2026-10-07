use super::model::{Host, Id, VaultData};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "id", rename_all = "camelCase")]
pub enum Source {
    Host,
    Identity(Id),
    Group(Id),
    Default,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sourced<T> {
    pub value: T,
    pub from: Source,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Effective {
    pub username: Option<Sourced<String>>,
    pub port: Sourced<u16>,
    pub identity_id: Option<Sourced<Id>>,
    pub key_id: Option<Sourced<Id>>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Inherited {
    pub username: Option<Sourced<String>>,
    pub port: Option<Sourced<u16>>,
    pub identity_id: Option<Sourced<Id>>,
}

pub fn inherited(data: &VaultData, group_id: Option<Id>) -> Inherited {
    let mut inherited = Inherited::default();
    let mut cursor = group_id;
    let mut depth = 0;
    while let Some(id) = cursor.filter(|_| depth < data.groups.len()) {
        let Some(group) = data.groups.iter().find(|group| group.id == id) else {
            break;
        };
        depth += 1;
        let from = Source::Group(group.id);
        let defaults = &group.defaults;
        let identity = defaults
            .identity_id
            .and_then(|id| data.identities.iter().find(|identity| identity.id == id));
        if inherited.username.is_none() {
            inherited.username = identity
                .map(|identity| Sourced {
                    value: identity.username.clone(),
                    from: Source::Identity(identity.id),
                })
                .or_else(|| {
                    defaults
                        .username
                        .clone()
                        .map(|value| Sourced { value, from })
                });
        }
        if inherited.port.is_none() {
            inherited.port = defaults.port.map(|value| Sourced { value, from });
        }
        if inherited.identity_id.is_none() {
            inherited.identity_id = identity.map(|identity| Sourced {
                value: identity.id,
                from,
            });
        }
        cursor = group.parent_id;
    }
    inherited
}

pub fn effective(data: &VaultData, host: &Host) -> Effective {
    let mut inherited = inherited(data, host.group_id);
    if let Some(value) = host.port {
        inherited.port = Some(Sourced {
            value,
            from: Source::Host,
        });
    }
    host.credential.resolve(data, inherited)
}
