use super::test_peer::{Node, Peer};
use russh_sftp::protocol::FileAttributes;
use std::collections::HashMap;
impl Peer {
    pub fn new(replacement: bool) -> Self {
        let attrs = FileAttributes {
            permissions: Some(0o100640),
            uid: Some(1000),
            gid: Some(100),
            size: Some(4),
            ..Default::default()
        };
        let mut peer = Self {
            nodes: HashMap::from([(
                "/config".into(),
                Node {
                    bytes: b"old\n".to_vec(),
                    attrs,
                },
            )]),
            replacement,
            dirs: HashMap::new(),
        };
        peer.nodes.insert(
            "/".into(),
            Node {
                bytes: vec![],
                attrs: FileAttributes {
                    permissions: Some(0o40755),
                    uid: Some(1000),
                    gid: Some(100),
                    ..Default::default()
                },
            },
        );
        peer.nodes.insert(
            "/link".into(),
            Node {
                bytes: b"/config".to_vec(),
                attrs: FileAttributes {
                    permissions: Some(0o120777),
                    ..Default::default()
                },
            },
        );
        peer
    }
}
