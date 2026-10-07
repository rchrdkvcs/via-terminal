use super::{model::Request, tests::client};
#[tokio::test]
async fn ordinary_file_operations_and_recursive_deletion_are_observable_through_the_api() {
    let files = client(true).await;
    files
        .json(Request::Create {
            parent: "/".into(),
            name: "folder".into(),
            directory: true,
        })
        .await
        .unwrap();
    files
        .json(Request::Create {
            parent: "/folder".into(),
            name: "new".into(),
            directory: false,
        })
        .await
        .unwrap();
    files
        .json(Request::Move {
            path: "/folder/new".into(),
            destination: "/folder/renamed".into(),
        })
        .await
        .unwrap();
    files
        .json(Request::Chmod {
            path: "/folder/renamed".into(),
            permissions: 0o644,
        })
        .await
        .unwrap();
    let list = files
        .json(Request::List {
            path: "/folder".into(),
        })
        .await
        .unwrap();
    assert_eq!(list["entries"][0]["name"], "renamed");
    assert_eq!(
        files
            .json(Request::Read {
                path: "/folder/renamed".into()
            })
            .await
            .unwrap()["permissions"],
        0o100644
    );
    files
        .json(Request::Delete {
            path: "/folder".into(),
        })
        .await
        .unwrap();
    assert!(files
        .json(Request::Read {
            path: "/folder/renamed".into()
        })
        .await
        .is_err());
    assert!(files
        .json(Request::List {
            path: "/folder".into()
        })
        .await
        .is_err());
}

#[tokio::test]
async fn listing_and_recursive_deletion_accept_posix_names_with_backslashes() {
    let files = client(true).await;
    for (name, directory) in [("dir", true), ("a\\b", false)] {
        let parent = if directory { "/" } else { "/dir" };
        let create = Request::Create {
            parent: parent.into(),
            name: name.into(),
            directory,
        };
        files.json(create).await.unwrap();
    }
    let listing = files
        .json(Request::List {
            path: "/dir".into(),
        })
        .await
        .unwrap();
    assert_eq!(listing["entries"][0]["name"], "a\\b");
    files
        .json(Request::Delete {
            path: "/dir".into(),
        })
        .await
        .unwrap();
    assert!(files
        .json(Request::List {
            path: "/dir".into()
        })
        .await
        .is_err());
}
