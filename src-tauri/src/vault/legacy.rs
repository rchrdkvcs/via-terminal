//! Vault records written by older versions. Hosts used to sit in groups that supplied a
//! username, port and identity; loading bakes what a host drew from its groups into the host
//! itself so it keeps connecting the same way.
use super::{
    credential::HostCredential,
    model::{Host, Id, Identity, Key, KnownHost, VaultData},
};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct StoredVault {
    #[serde(default)]
    groups: Vec<StoredGroup>,
    #[serde(default)]
    hosts: Vec<StoredHost>,
    #[serde(default)]
    identities: Vec<Identity>,
    #[serde(default)]
    keys: Vec<Key>,
    #[serde(default)]
    known_hosts: Vec<KnownHost>,
}

impl From<StoredVault> for VaultData {
    fn from(stored: StoredVault) -> Self {
        let hosts = stored
            .hosts
            .into_iter()
            .map(|host| host.migrate(&stored.groups, &stored.identities))
            .collect();
        Self {
            hosts,
            identities: stored.identities,
            keys: stored.keys,
            known_hosts: stored.known_hosts,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct StoredGroup {
    id: Id,
    parent_id: Option<Id>,
    #[serde(default)]
    defaults: Defaults,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Defaults {
    username: Option<String>,
    port: Option<u16>,
    identity_id: Option<Id>,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum StoredCredential {
    Inherit {
        #[serde(default)]
        username: Option<String>,
        #[serde(default)]
        key: Option<Id>,
    },
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct StoredHost {
    id: Id,
    group_id: Option<Id>,
    label: String,
    address: String,
    port: Option<u16>,
    credential: Option<StoredCredential>,
    #[serde(default)]
    own_credentials: bool,
    #[serde(default)]
    overrides: Defaults,
    key_id: Option<Id>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    created_at: i64,
    #[serde(default)]
    last_connected_at: Option<i64>,
}

/// What a host drew from its groups, nearest group first for each field.
#[derive(Default)]
struct Inherited<'a> {
    username: Option<String>,
    port: Option<u16>,
    identity: Option<&'a Identity>,
}

fn inherited<'a>(
    groups: &[StoredGroup],
    identities: &'a [Identity],
    group_id: Option<Id>,
) -> Inherited<'a> {
    let mut inherited = Inherited::default();
    let mut cursor = group_id;
    let mut depth = 0;
    while let Some(id) = cursor.filter(|_| depth < groups.len()) {
        let Some(group) = groups.iter().find(|group| group.id == id) else {
            break;
        };
        depth += 1;
        let defaults = &group.defaults;
        let identity = defaults
            .identity_id
            .and_then(|id| identities.iter().find(|identity| identity.id == id));
        if inherited.username.is_none() {
            inherited.username = identity
                .map(|identity| identity.username.clone())
                .or_else(|| defaults.username.clone());
        }
        inherited.port = inherited.port.or(defaults.port);
        inherited.identity = inherited.identity.or(identity);
        cursor = group.parent_id;
    }
    inherited
}

impl StoredHost {
    fn credential(&mut self) -> StoredCredential {
        if let Some(credential) = self.credential.take() {
            return credential;
        }
        let username = self.overrides.username.clone();
        match (
            self.own_credentials,
            self.overrides.identity_id,
            self.key_id,
        ) {
            (false, Some(id), _) => StoredCredential::Identity { id },
            (false, None, key) => StoredCredential::Inherit { username, key },
            (true, _, Some(id)) => StoredCredential::Key { id, username },
            (true, _, None) => StoredCredential::Password { username },
        }
    }

    pub(super) fn migrate(mut self, groups: &[StoredGroup], identities: &[Identity]) -> Host {
        let inherited = inherited(groups, identities, self.group_id);
        let credential = match self.credential() {
            StoredCredential::Inherit { username, key } => {
                match (username, key, inherited.identity) {
                    (None, None, Some(identity))
                        if inherited.username.as_deref() == Some(&identity.username) =>
                    {
                        HostCredential::Identity { id: identity.id }
                    }
                    (username, key, identity) => {
                        let username = username.or(inherited.username);
                        match key.or_else(|| identity.and_then(|identity| identity.key_id)) {
                            Some(id) => HostCredential::Key { id, username },
                            None => HostCredential::Password { username },
                        }
                    }
                }
            }
            StoredCredential::Identity { id } => HostCredential::Identity { id },
            StoredCredential::Key { id, username } => HostCredential::Key { id, username },
            StoredCredential::Password { username } => HostCredential::Password { username },
        };
        Host {
            id: self.id,
            label: self.label,
            address: self.address,
            port: self.port.or(self.overrides.port).or(inherited.port),
            credential,
            tags: self.tags,
            notes: self.notes,
            created_at: self.created_at,
            last_connected_at: self.last_connected_at,
        }
    }
}
