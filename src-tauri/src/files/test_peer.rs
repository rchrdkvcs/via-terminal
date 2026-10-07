use russh_sftp::{protocol::*, server::Handler};
use std::collections::HashMap;
#[derive(Clone)]
pub struct Node {
    pub bytes: Vec<u8>,
    pub attrs: FileAttributes,
}
pub struct Peer {
    pub nodes: HashMap<String, Node>,
    pub replacement: bool,
    pub dirs: HashMap<String, Option<String>>,
}
pub fn status(id: u32) -> Status {
    Status {
        id,
        status_code: StatusCode::Ok,
        error_message: String::new(),
        language_tag: String::new(),
    }
}
impl Handler for Peer {
    type Error = StatusCode;
    fn unimplemented(&self) -> StatusCode {
        StatusCode::OpUnsupported
    }
    async fn init(&mut self, _: u32, _: HashMap<String, String>) -> Result<Version, StatusCode> {
        let mut version = Version::new();
        if self.replacement {
            version
                .extensions
                .insert("posix-rename@openssh.com".into(), "1".into());
        }
        Ok(version)
    }
    async fn realpath(&mut self, id: u32, path: String) -> Result<Name, StatusCode> {
        let path = if path == "." { "/".to_owned() } else { path };
        let node = self.nodes.get(&path).ok_or(StatusCode::NoSuchFile)?;
        let path = if node.attrs.is_symlink() {
            String::from_utf8(node.bytes.clone()).unwrap()
        } else {
            path
        };
        Ok(Name {
            id,
            files: vec![File {
                filename: path,
                longname: String::new(),
                attrs: Default::default(),
            }],
        })
    }
    async fn opendir(&mut self, id: u32, path: String) -> Result<Handle, StatusCode> {
        self.open_directory(id, path)
    }
    async fn readdir(&mut self, id: u32, handle: String) -> Result<Name, StatusCode> {
        self.read_directory(id, handle)
    }
    async fn mkdir(
        &mut self,
        id: u32,
        path: String,
        attrs: FileAttributes,
    ) -> Result<Status, StatusCode> {
        self.make_directory(id, path, attrs)
    }
    async fn rmdir(&mut self, id: u32, path: String) -> Result<Status, StatusCode> {
        self.remove_directory(id, path)
    }
    async fn stat(&mut self, id: u32, path: String) -> Result<Attrs, StatusCode> {
        let node = self.nodes.get(&path).ok_or(StatusCode::NoSuchFile)?;
        let mut attrs = node.attrs.clone();
        attrs.size = attrs.size.or(Some(node.bytes.len() as u64));
        Ok(Attrs { id, attrs })
    }
    async fn lstat(&mut self, id: u32, path: String) -> Result<Attrs, StatusCode> {
        self.stat(id, path).await
    }
    async fn open(
        &mut self,
        id: u32,
        path: String,
        flags: OpenFlags,
        attrs: FileAttributes,
    ) -> Result<Handle, StatusCode> {
        self.open_node(id, path, flags, attrs)
    }
    async fn close(&mut self, id: u32, _: String) -> Result<Status, StatusCode> {
        Ok(status(id))
    }
    async fn read(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        len: u32,
    ) -> Result<Data, StatusCode> {
        self.read_node(id, handle, offset, len)
    }
    async fn write(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        bytes: Vec<u8>,
    ) -> Result<Status, StatusCode> {
        self.write_node(id, handle, offset, bytes)
    }
    async fn setstat(
        &mut self,
        id: u32,
        path: String,
        attrs: FileAttributes,
    ) -> Result<Status, StatusCode> {
        self.set_attrs(id, path, attrs)
    }
    async fn remove(&mut self, id: u32, path: String) -> Result<Status, StatusCode> {
        self.nodes.remove(&path).ok_or(StatusCode::NoSuchFile)?;
        Ok(status(id))
    }
    async fn rename(
        &mut self,
        id: u32,
        source: String,
        target: String,
    ) -> Result<Status, StatusCode> {
        if self.nodes.contains_key(&target) {
            return Err(StatusCode::Failure);
        }
        let node = self.nodes.remove(&source).ok_or(StatusCode::NoSuchFile)?;
        self.nodes.insert(target, node);
        Ok(status(id))
    }
    async fn extended(
        &mut self,
        id: u32,
        request: String,
        data: Vec<u8>,
    ) -> Result<Packet, StatusCode> {
        if request != "posix-rename@openssh.com" || !self.replacement {
            return Err(StatusCode::OpUnsupported);
        }
        let mut rest = &data[..];
        let mut path = || {
            let len = u32::from_be_bytes(rest[..4].try_into().unwrap()) as usize;
            let value = String::from_utf8(rest[4..4 + len].to_vec()).unwrap();
            rest = &rest[4 + len..];
            value
        };
        let source = path();
        let target = path();
        let node = self.nodes.remove(&source).ok_or(StatusCode::NoSuchFile)?;
        self.nodes.insert(target, node);
        Ok(status(id).into())
    }
}
