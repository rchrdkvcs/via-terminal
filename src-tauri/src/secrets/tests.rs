use super::*;

fn secrets(key: Option<[u8; 32]>) -> (Arc<Storage>, Secrets) {
    let storage = Arc::new(Storage::memory().unwrap());
    let secrets = Secrets::new(storage.clone(), &FixedKey(key));
    (storage, secrets)
}

fn persist(storage: &Storage, change: AppResult<BlobChange>) -> AppResult<()> {
    storage.save_with_blobs("document", &(), &[change?])
}

#[test]
fn round_trips_without_storing_plaintext() {
    let (storage, secrets) = secrets(Some([7; 32]));
    persist(&storage, secrets.seal("host:1", b"hunter2")).unwrap();
    let raw = storage.get_blob("secret:host:1").unwrap().unwrap();
    assert!(!raw.windows(7).any(|window| window == b"hunter2"));
    assert_eq!(
        secrets.get_string("host:1").unwrap().unwrap().as_str(),
        "hunter2"
    );
    persist(&storage, Ok(Secrets::removal("host:1"))).unwrap();
    assert!(secrets.get("host:1").unwrap().is_none());
}

#[test]
fn refuses_to_store_without_a_key() {
    let (storage, secrets) = secrets(None);
    assert!(!secrets.available());
    assert_eq!(
        persist(&storage, secrets.seal("a", b"x")).unwrap_err().code,
        "secrets_unavailable"
    );
    assert!(storage.get_blob("secret:a").unwrap().is_none());
    assert!(secrets.get("a").unwrap().is_none());
}

#[test]
fn another_key_cannot_read() {
    let (storage, secrets) = secrets(Some([1; 32]));
    persist(&storage, secrets.seal("a", b"x")).unwrap();
    let other = Secrets::new(storage, &FixedKey(Some([2; 32])));
    assert!(other.get("a").is_err());
}
