use super::test_peer::{status, Node, Peer};
use russh_sftp::protocol::*;
impl Peer {
    pub(super) fn open_node(
        &mut self,
        id: u32,
        path: String,
        flags: OpenFlags,
        attrs: FileAttributes,
    ) -> Result<Handle, StatusCode> {
        if flags.contains(OpenFlags::EXCLUDE) && self.nodes.contains_key(&path) {
            return Err(StatusCode::Failure);
        }
        if flags.contains(OpenFlags::CREATE) {
            self.nodes.insert(
                path.clone(),
                Node {
                    bytes: vec![],
                    attrs: FileAttributes {
                        permissions: Some(0o100000 | attrs.permissions.unwrap_or(0o600)),
                        uid: Some(1000),
                        gid: Some(100),
                        ..Default::default()
                    },
                },
            );
        }
        if !self.nodes.contains_key(&path) {
            return Err(StatusCode::NoSuchFile);
        }
        Ok(Handle { id, handle: path })
    }
    pub(super) fn read_node(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        len: u32,
    ) -> Result<Data, StatusCode> {
        let bytes = &self.nodes.get(&handle).ok_or(StatusCode::NoSuchFile)?.bytes;
        if offset as usize >= bytes.len() {
            return Err(StatusCode::Eof);
        }
        Ok(Data {
            id,
            data: bytes[offset as usize..bytes.len().min(offset as usize + len as usize)].to_vec(),
        })
    }
    pub(super) fn write_node(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        bytes: Vec<u8>,
    ) -> Result<Status, StatusCode> {
        let node = self.nodes.get_mut(&handle).ok_or(StatusCode::NoSuchFile)?;
        node.bytes
            .resize(node.bytes.len().max(offset as usize + bytes.len()), 0);
        node.bytes[offset as usize..offset as usize + bytes.len()].copy_from_slice(&bytes);
        Ok(status(id))
    }
    pub(super) fn set_attrs(
        &mut self,
        id: u32,
        path: String,
        attrs: FileAttributes,
    ) -> Result<Status, StatusCode> {
        let node = self.nodes.get_mut(&path).ok_or(StatusCode::NoSuchFile)?;
        if let Some(mode) = attrs.permissions {
            node.attrs.permissions = Some(0o100000 | mode);
        }
        if let Some(uid) = attrs.uid {
            node.attrs.uid = Some(uid);
        }
        if let Some(gid) = attrs.gid {
            node.attrs.gid = Some(gid);
        }
        Ok(status(id))
    }
}
