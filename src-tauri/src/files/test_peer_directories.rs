use super::test_peer::{status, Node, Peer};
use russh_sftp::protocol::*;
impl Peer {
    pub(super) fn open_directory(&mut self, id: u32, path: String) -> Result<Handle, StatusCode> {
        if !self
            .nodes
            .get(&path)
            .ok_or(StatusCode::NoSuchFile)?
            .attrs
            .is_dir()
        {
            return Err(StatusCode::Failure);
        }
        let handle = format!("dir:{id}");
        self.dirs.insert(handle.clone(), Some(path));
        Ok(Handle { id, handle })
    }
    pub(super) fn read_directory(&mut self, id: u32, handle: String) -> Result<Name, StatusCode> {
        let path = self
            .dirs
            .get_mut(&handle)
            .and_then(Option::take)
            .ok_or(StatusCode::Eof)?;
        let prefix = format!("{}/", path.trim_end_matches('/'));
        let files = self
            .nodes
            .iter()
            .filter_map(|(path, node)| {
                let name = path.strip_prefix(&prefix)?;
                if name.is_empty() || name.contains('/') {
                    return None;
                }
                Some(File {
                    filename: name.into(),
                    longname: String::new(),
                    attrs: node.attrs.clone(),
                })
            })
            .collect();
        Ok(Name { id, files })
    }
    pub(super) fn make_directory(
        &mut self,
        id: u32,
        path: String,
        attrs: FileAttributes,
    ) -> Result<Status, StatusCode> {
        if self.nodes.contains_key(&path) {
            return Err(StatusCode::Failure);
        }
        self.nodes.insert(
            path,
            Node {
                bytes: vec![],
                attrs: FileAttributes {
                    permissions: Some(0o40000 | attrs.permissions.unwrap_or(0o755)),
                    uid: Some(1000),
                    gid: Some(100),
                    ..Default::default()
                },
            },
        );
        Ok(status(id))
    }
    pub(super) fn remove_directory(&mut self, id: u32, path: String) -> Result<Status, StatusCode> {
        if self
            .nodes
            .keys()
            .any(|p| p.starts_with(&format!("{path}/")))
        {
            return Err(StatusCode::Failure);
        }
        self.nodes.remove(&path).ok_or(StatusCode::NoSuchFile)?;
        Ok(status(id))
    }
}
