use super::{parse_chunk, Staging};
use uuid::Uuid;

fn base() -> std::path::PathBuf {
    std::env::temp_dir().join(format!("via-staging-test-{}", Uuid::new_v4()))
}

#[test]
fn an_unusable_cache_does_not_prevent_startup_and_only_refuses_drops() {
    let blocked = base();
    std::fs::write(&blocked, b"not a directory").unwrap();
    let staging = Staging::new(blocked.clone());
    assert_eq!(staging.begin().unwrap_err().code, "file_local");
    std::fs::remove_file(blocked).unwrap();
}

#[tokio::test]
async fn launch_and_exit_clear_staged_copies_and_names_stay_inside_their_root() {
    let base = base();
    let stale = base.join(Uuid::new_v4().to_string());
    std::fs::create_dir_all(&stale).unwrap();
    let staging = Staging::new(base.clone());
    assert!(!stale.exists());
    let id = staging.begin().unwrap();
    let staged = staging.chunk(id, "dir/a\\b", b"data").await;
    assert_eq!(staged.is_ok(), !cfg!(windows), "{staged:?}");
    for unsafe_path in ["../escape", "/absolute", "dir/../../escape", ""] {
        assert!(
            staging.chunk(id, unsafe_path, &[]).await.is_err(),
            "{unsafe_path}"
        );
    }
    assert_eq!(
        staging.finish(id).unwrap().len(),
        usize::from(!cfg!(windows))
    );
    staging.clear();
    assert_eq!(std::fs::read_dir(&base).unwrap().count(), 0);
    assert!(staging.finish(id).is_err());
    std::fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_raw_chunk_carries_its_path_then_its_bytes() {
    let framed = |length: u32, rest: &[u8]| [&length.to_be_bytes()[..], rest].concat();
    let body = framed(9, "dir/étédata".as_bytes());
    assert_eq!(parse_chunk(&body).unwrap(), ("dir/été", b"data".as_slice()));
    assert_eq!(parse_chunk(&framed(0, b"")).unwrap(), ("", [].as_slice()));
    let cut_character = framed(8, "dir/été".as_bytes());
    for invalid in [&[0, 0, 1][..], &framed(2, b"a"), &cut_character] {
        assert!(parse_chunk(invalid).is_err(), "{invalid:?}");
    }
}
