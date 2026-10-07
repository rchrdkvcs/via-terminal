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
    host: CaseHost,
    effective: serde_json::Value,
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
        let host = Host {
            id: uuid::Uuid::nil(),
            group_id: case.host.group_id,
            label: String::new(),
            address: "a".into(),
            port: case.host.port,
            credential: case.host.credential,
            tags: vec![],
            notes: String::new(),
            created_at: 0,
            last_connected_at: None,
        };
        let effective = serde_json::to_value(resolve::effective(&data, &host)).unwrap();
        assert_eq!(effective, case.effective, "{}", case.name);
    }
}
