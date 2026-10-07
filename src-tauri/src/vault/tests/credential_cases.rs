use crate::vault::{
    model::{Group, Host, Id, Identity, VaultData},
    resolve, HostCredential,
};
use serde::Deserialize;

#[derive(Deserialize)]
struct Cases {
    groups: Vec<Group>,
    identities: Vec<Identity>,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    name: String,
    legacy: Option<serde_json::Value>,
    host: CaseHost,
    effective: serde_json::Value,
    passwords: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaseHost {
    group_id: Option<Id>,
    port: Option<u16>,
    credential: HostCredential,
}

#[test]
fn hosts_resolve_the_shared_credential_cases() {
    let fixture: Cases = serde_json::from_str(include_str!(
        "../../../../src/test/fixtures/credential-cases.json"
    ))
    .unwrap();
    let data = VaultData {
        groups: fixture.groups,
        identities: fixture.identities,
        ..VaultData::default()
    };
    for case in fixture.cases {
        let mut stored = serde_json::json!({
            "id": uuid::Uuid::nil(),
            "groupId": case.host.group_id,
            "label": "a",
            "address": "a",
            "port": case.host.port,
            "credential": case.host.credential,
        });
        if let Some(legacy) = &case.legacy {
            let stored = stored.as_object_mut().unwrap();
            stored.retain(|field, _| field != "port" && field != "credential");
            stored.extend(legacy.as_object().unwrap().clone());
        }
        let host: Host = serde_json::from_value(stored).unwrap();
        assert_eq!(host.credential, case.host.credential, "{}", case.name);
        assert_eq!(host.port, case.host.port, "{}", case.name);
        let effective = resolve::effective(&data, &host);
        let identity = effective.identity_id.as_ref().map(|sourced| sourced.value);
        let passwords: Vec<String> = host
            .credential
            .password_owners(Some(host.id), identity)
            .into_iter()
            .map(|id| match id == host.id {
                true => "host".into(),
                false => id.to_string(),
            })
            .collect();
        assert_eq!(passwords, case.passwords, "{}", case.name);
        assert_eq!(
            serde_json::to_value(effective).unwrap(),
            case.effective,
            "{}",
            case.name
        );
    }
}
