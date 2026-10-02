//! Inheritance: what a host actually uses once its groups and identity are
//! taken into account, and where each value comes from.

use super::model::{Group, Host, Id, Identity, VaultData};
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

/// Inheritance levels from the most specific: the host, then each ancestor.
enum Level<'a> {
    Host(&'a Host),
    Group(&'a Group),
}

fn levels<'a>(data: &'a VaultData, host: &'a Host) -> Vec<Level<'a>> {
    let mut levels = vec![Level::Host(host)];
    let mut cursor = host.group_id;
    // Bounded walk: validation forbids cycles, this guards against bad data.
    while let Some(id) = cursor.filter(|_| levels.len() <= data.groups.len() + 1) {
        let Some(group) = data.groups.iter().find(|group| group.id == id) else {
            break;
        };
        levels.push(Level::Group(group));
        cursor = group.parent_id;
    }
    levels
}

fn identity(data: &VaultData, id: Option<Id>) -> Option<&Identity> {
    id.and_then(|id| data.identities.iter().find(|identity| identity.id == id))
}

pub fn effective(data: &VaultData, host: &Host) -> Effective {
    let mut username = None;
    let mut port = None;
    let mut identity_id = None;
    for level in levels(data, host) {
        let (defaults, source) = match level {
            Level::Host(host) => (&host.overrides, Source::Host),
            Level::Group(group) => (&group.defaults, Source::Group(group.id)),
        };
        let level_identity = identity(data, defaults.identity_id);
        if username.is_none() {
            username = defaults
                .username
                .clone()
                .map(|value| Sourced {
                    value,
                    from: source,
                })
                .or_else(|| {
                    level_identity.map(|identity| Sourced {
                        value: identity.username.clone(),
                        from: Source::Identity(identity.id),
                    })
                });
        }
        if port.is_none() {
            port = defaults.port.map(|value| Sourced {
                value,
                from: source,
            });
        }
        if identity_id.is_none() {
            identity_id = level_identity.map(|identity| Sourced {
                value: identity.id,
                from: source,
            });
        }
    }
    let key_id = host
        .key_id
        .map(|value| Sourced {
            value,
            from: Source::Host,
        })
        .or_else(|| {
            let identity = identity(data, identity_id.as_ref().map(|sourced| sourced.value))?;
            identity.key_id.map(|value| Sourced {
                value,
                from: Source::Identity(identity.id),
            })
        });
    Effective {
        username,
        port: port.unwrap_or(Sourced {
            value: 22,
            from: Source::Default,
        }),
        identity_id,
        key_id,
    }
}
