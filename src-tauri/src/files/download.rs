use super::{
    jobs::Job,
    paths::local_name,
    sftp_error,
    walk::{walk, Destination, Found, Node, Source},
    Files,
};
use crate::error::{AppError, AppResult};
use std::{
    fs::Metadata,
    path::{Path, PathBuf},
};
pub(super) fn local(error: std::io::Error) -> AppError {
    AppError::new(
        "file_local",
        format!("Écriture locale impossible : {error}"),
    )
}
impl Files {
    pub async fn download(
        &self,
        job: &Job,
        sources: Vec<String>,
        destination: String,
    ) -> AppResult<()> {
        let destination = tokio::fs::canonicalize(destination).await.map_err(local)?;
        walk(job, &Remote(self), &Local(self), sources, destination).await
    }
}
struct Remote<'a>(&'a Files);
struct Local<'a>(&'a Files);
impl Source for Remote<'_> {
    type Path = String;
    type File = u64;
    fn key(&self, path: &String) -> String {
        path.clone()
    }
    fn name(&self, path: &String) -> AppResult<String> {
        Ok(path.rsplit('/').next().unwrap_or("").to_owned())
    }
    async fn inspect(&self, path: &String) -> AppResult<Node<u64>> {
        let attrs = self.0.raw.lstat(path).await.map_err(sftp_error)?.attrs;
        Ok(if attrs.is_symlink() {
            Node::Other
        } else if attrs.is_dir() {
            Node::Directory
        } else if attrs.is_regular() {
            Node::File(attrs.size.unwrap_or(0))
        } else {
            Node::Other
        })
    }
    async fn children(&self, path: &String) -> AppResult<Vec<(String, String)>> {
        let entries = self.0.list(path).await?;
        Ok(entries.into_iter().map(|e| (e.name, e.path)).collect())
    }
}
impl Found for Metadata {
    fn is_directory(&self) -> bool {
        self.is_dir()
    }
}
impl Destination<Remote<'_>> for Local<'_> {
    type Path = PathBuf;
    type Found = Metadata;
    fn child(&self, parent: &PathBuf, name: &str) -> AppResult<PathBuf> {
        local_name(name)?;
        Ok(parent.join(name))
    }
    fn display(&self, path: &PathBuf) -> String {
        path.to_string_lossy().into_owned()
    }
    fn name_of<'a>(&self, path: &'a str) -> Option<&'a str> {
        Path::new(path).file_name()?.to_str()
    }
    async fn existing(&self, path: &PathBuf) -> AppResult<Option<Metadata>> {
        match tokio::fs::symlink_metadata(path).await {
            Ok(found) => Ok(Some(found)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(local(e)),
        }
    }
    async fn create_directory(&self, path: &PathBuf) -> AppResult<()> {
        tokio::fs::create_dir(path).await.map_err(local)
    }
    async fn copy(
        &self,
        job: &Job,
        source: String,
        size: u64,
        target: PathBuf,
        replaced: Option<Metadata>,
    ) -> AppResult<()> {
        self.0
            .download_file(job, &source, target, size, replaced.is_some())
            .await
    }
}
