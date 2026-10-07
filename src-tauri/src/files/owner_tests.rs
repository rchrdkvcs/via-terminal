use super::{model::Request, tests::client};
#[tokio::test]
async fn refuses_a_document_or_transfer_owned_by_another_endpoint_or_account() {
    let files = client(true).await;
    let value = files
        .execute(Request::Read {
            path: "/config".into(),
        })
        .await
        .unwrap();
    let mut document: super::model::Document = serde_json::from_value(value).unwrap();
    document.owner = "different endpoint".into();
    document.content = "wrong target".into();
    let error = files
        .execute(Request::Save {
            document,
            original: "old\n".into(),
            overwrite: true,
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "file_owner_changed");
    assert_eq!(
        files
            .execute(Request::Read {
                path: "/config".into()
            })
            .await
            .unwrap()["content"],
        "old\n"
    );
    let error = files
        .execute(Request::Transfer {
            id: uuid::Uuid::new_v4(),
            direction: super::model::Direction::Download,
            sources: vec!["/config".into()],
            destination: "/tmp".into(),
            completed_sources: vec![],
            directories: Default::default(),
            owner: "different account".into(),
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "file_owner_changed");
}
