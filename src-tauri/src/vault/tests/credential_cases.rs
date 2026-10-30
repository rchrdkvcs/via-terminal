use crate::vault::{
    model::{Host, Identity, VaultData},
    resolve, HostCredential,
};
use serde::Deserialize;

#[derive(Deserialize)]
struct Cases {
    identities: Vec<Identity>,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    name: String,
    host: CaseHost,
    effective: serde_json::Value,
    passwords: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaseHost {
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
        identities: fixture.identities,
        ..VaultData::default()
    };
    for case in fixture.cases {
        let host: Host = serde_json::from_value(serde_json::json!({
            "id": uuid::Uuid::nil(),
            "label": "a",
            "address": "a",
            "port": case.host.port,
            "credential": case.host.credential,
        }))
        .unwrap();
        assert_eq!(host.credential, case.host.credential, "{}", case.name);
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
