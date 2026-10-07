use super::{
    jobs::Job,
    join, missing,
    paths::remote_name,
    sftp_error,
    walk::{walk, Destination, Found, Node, Source},
    Files,
};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::FileAttributes;
use std::{fs::Metadata, path::PathBuf};
pub(super) fn local(error: std::io::Error) -> AppError {
    AppError::new(
        "file_local",
        format!("Lecture du fichier local impossible : {error}"),
    )
}
impl Files {
    pub async fn upload(
        &self,
        job: &Job,
        sources: Vec<String>,
        destination: String,
    ) -> AppResult<()> {
        let roots = sources.into_iter().map(PathBuf::from).collect();
        walk(job, &Local, &Remote(self), roots, destination).await
    }
}
struct Local;
struct Remote<'a>(&'a Files);
impl Source for Local {
    type Path = PathBuf;
    type File = Metadata;
    fn key(&self, path: &PathBuf) -> String {
        path.to_string_lossy().into_owned()
    }
    fn name(&self, path: &PathBuf) -> AppResult<String> {
        path.file_name()
            .and_then(|n| n.to_str())
            .map(str::to_owned)
            .ok_or_else(|| AppError::invalid("Nom local invalide"))
    }
    async fn inspect(&self, path: &PathBuf) -> AppResult<Node<Metadata>> {
        let metadata = tokio::fs::symlink_metadata(path).await.map_err(local)?;
        Ok(if metadata.is_dir() {
            Node::Directory
        } else if metadata.is_file() {
            Node::File(metadata)
        } else {
            Node::Other
        })
    }
    async fn children(&self, path: &PathBuf) -> AppResult<Vec<(String, PathBuf)>> {
        let mut children = Vec::new();
        let mut entries = tokio::fs::read_dir(path).await.map_err(local)?;
        while let Some(entry) = entries.next_entry().await.map_err(local)? {
            let name = entry
                .file_name()
                .to_str()
                .ok_or_else(|| AppError::invalid("Nom local non UTF-8"))?
                .to_owned();
            children.push((name, entry.path()));
        }
        Ok(children)
    }
}
impl Found for FileAttributes {
    fn is_directory(&self) -> bool {
        self.is_dir()
    }
}
impl Destination<Local> for Remote<'_> {
    type Path = String;
    type Found = FileAttributes;
    fn child(&self, parent: &String, name: &str) -> AppResult<String> {
        remote_name(name)?;
        Ok(join(parent, name))
    }
    fn display(&self, path: &String) -> String {
        path.clone()
    }
    fn name_of<'a>(&self, path: &'a str) -> Option<&'a str> {
        path.rsplit('/').next()
    }
    async fn existing(&self, path: &String) -> AppResult<Option<FileAttributes>> {
        match self.0.raw.lstat(path).await {
            Ok(found) => Ok(Some(found.attrs)),
            Err(e) if missing(&e) => Ok(None),
            Err(e) => Err(sftp_error(e)),
        }
    }
    async fn create_directory(&self, path: &String) -> AppResult<()> {
        self.0
            .raw
            .mkdir(path, Default::default())
            .await
            .map(drop)
            .map_err(sftp_error)
    }
    async fn copy(
        &self,
        job: &Job,
        source: PathBuf,
        file: Metadata,
        target: String,
        replaced: Option<FileAttributes>,
    ) -> AppResult<()> {
        self.0
            .upload_file(job, source, &target, &file, replaced)
            .await
    }
}
