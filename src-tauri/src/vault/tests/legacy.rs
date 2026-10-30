//! Hosts saved while groups existed keep the username, port and key they resolved to.
use crate::vault::{
    model::{Host, VaultData},
    resolve, HostCredential,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
struct Cases {
    groups: Value,
    identities: Value,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    name: String,
    legacy: Option<Value>,
    host: Value,
    effective: Value,
}

fn value(sourced: &Value) -> &Value {
    sourced.get("value").unwrap_or(&Value::Null)
}

#[test]
fn loading_bakes_group_defaults_into_each_host() {
    let fixture: Cases = serde_json::from_str(include_str!("legacy-cases.json")).unwrap();
    for case in fixture.cases {
        let mut stored = json!({ "id": uuid::Uuid::nil(), "label": "a", "address": "a" });
        let stored_fields = stored.as_object_mut().unwrap();
        stored_fields.extend(case.host.as_object().unwrap().clone());
        if let Some(legacy) = &case.legacy {
            stored_fields.retain(|field, _| field != "port" && field != "credential");
            stored_fields.extend(legacy.as_object().unwrap().clone());
        }
        let data: VaultData = serde_json::from_value(json!({
            "groups": fixture.groups,
            "identities": fixture.identities,
            "hosts": [stored],
        }))
        .unwrap();
        let host = &data.hosts[0];
        let effective = serde_json::to_value(resolve::effective(&data, host)).unwrap();
        for field in ["username", "port", "keyId"] {
            assert_eq!(
                value(&effective[field]),
                value(&case.effective[field]),
                "{}: {field}",
                case.name
            );
        }
        let saved = serde_json::to_value(&data).unwrap();
        assert!(saved.get("groups").is_none(), "{}", case.name);
        assert!(saved["hosts"][0].get("groupId").is_none(), "{}", case.name);
    }
}

#[test]
fn a_host_drawing_everything_from_a_group_identity_selects_that_identity() {
    let identity = uuid::Uuid::new_v4();
    let group = uuid::Uuid::new_v4();
    let data: VaultData = serde_json::from_value(json!({
        "groups": [{ "id": group, "parentId": null, "name": "Prod",
            "defaults": { "username": null, "port": 2222, "identityId": identity } }],
        "identities": [{ "id": identity, "label": "Admin", "username": "admin", "keyId": null }],
        "hosts": [{ "id": uuid::Uuid::new_v4(), "groupId": group, "label": "a", "address": "a",
            "port": null, "credential": { "kind": "inherit", "username": null, "key": null } }],
    }))
    .unwrap();
    let host: &Host = &data.hosts[0];
    assert_eq!(host.credential, HostCredential::Identity { id: identity });
    assert_eq!(host.port, Some(2222));
}
