use super::{model::Request, tests::client};
#[tokio::test]
async fn ordinary_file_operations_and_recursive_deletion_are_observable_through_the_api() {
    let files = client(true).await;
    files
        .execute(Request::Create {
            path: "/folder".into(),
            directory: true,
        })
        .await
        .unwrap();
    files
        .execute(Request::Create {
            path: "/folder/new".into(),
            directory: false,
        })
        .await
        .unwrap();
    files
        .execute(Request::Move {
            path: "/folder/new".into(),
            destination: "/folder/renamed".into(),
        })
        .await
        .unwrap();
    files
        .execute(Request::Chmod {
            path: "/folder/renamed".into(),
            permissions: 0o644,
        })
        .await
        .unwrap();
    let list = files
        .execute(Request::List {
            path: "/folder".into(),
        })
        .await
        .unwrap();
    assert_eq!(list["entries"][0]["name"], "renamed");
    assert_eq!(
        files
            .execute(Request::Read {
                path: "/folder/renamed".into()
            })
            .await
            .unwrap()["permissions"],
        0o100644
    );
    files
        .execute(Request::Delete {
            path: "/folder".into(),
        })
        .await
        .unwrap();
    assert!(files
        .execute(Request::Read {
            path: "/folder/renamed".into()
        })
        .await
        .is_err());
    assert!(files
        .execute(Request::List {
            path: "/folder".into()
        })
        .await
        .is_err());
}
