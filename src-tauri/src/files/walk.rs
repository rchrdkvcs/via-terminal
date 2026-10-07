//! The recursive walk shared by uploads and downloads: completed sources, remembered
//! directories, link skipping, collision answers and keep-both names. Endpoints only read the
//! source, and inspect, create and publish at the destination.
//!
//! The skipped report lists source paths, the entries the user selected that were not copied.
use super::{errors::kind_collision, jobs::Job, model::Collision};
use crate::error::{AppError, AppResult};

pub enum Node<F> {
    Directory,
    File(F),
    /// Links and special files, never followed.
    Other,
}
pub trait Source {
    type Path;
    type File;
    /// Identifies the source in completed sources, remembered directories and skipped entries.
    fn key(&self, path: &Self::Path) -> String;
    fn name(&self, path: &Self::Path) -> AppResult<String>;
    async fn inspect(&self, path: &Self::Path) -> AppResult<Node<Self::File>>;
    async fn children(&self, path: &Self::Path) -> AppResult<Vec<(String, Self::Path)>>;
}
pub trait Found {
    /// A real directory, not a link to one.
    fn is_directory(&self) -> bool;
}
pub trait Destination<S: Source> {
    type Path: Clone;
    type Found: Found;
    /// Validates `name` for this destination.
    fn child(&self, parent: &Self::Path, name: &str) -> AppResult<Self::Path>;
    fn display(&self, path: &Self::Path) -> String;
    fn name_of<'a>(&self, path: &'a str) -> Option<&'a str>;
    async fn existing(&self, path: &Self::Path) -> AppResult<Option<Self::Found>>;
    async fn create_directory(&self, path: &Self::Path) -> AppResult<()>;
    /// Publishes one file, replacing `replaced` when given.
    async fn copy(
        &self,
        job: &Job,
        source: S::Path,
        file: S::File,
        target: Self::Path,
        replaced: Option<Self::Found>,
    ) -> AppResult<()>;
}
struct Pending<S: Source, D: Destination<S>> {
    source: S::Path,
    parent: D::Path,
    name: String,
    target: D::Path,
}
pub async fn walk<S: Source, D: Destination<S>>(
    job: &Job,
    source: &S,
    destination: &D,
    roots: Vec<S::Path>,
    root: D::Path,
) -> AppResult<()> {
    let mut stack = Vec::new();
    for path in roots {
        let name = source.name(&path)?;
        stack.push(pending(destination, path, root.clone(), name)?);
    }
    while let Some(Pending {
        source: path,
        parent,
        name,
        mut target,
    }) = stack.pop()
    {
        job.check()?;
        let key = source.key(&path);
        if job.already_completed(&key) {
            continue;
        }
        let file = match source.inspect(&path).await? {
            Node::File(file) => file,
            Node::Other => {
                job.skip(&key);
                continue;
            }
            Node::Directory => {
                let entry = Pending {
                    source: path,
                    parent,
                    name,
                    target,
                };
                let Some(target) = directory(job, destination, &key, &entry).await? else {
                    continue;
                };
                for (name, child) in source.children(&entry.source).await? {
                    stack.push(pending(destination, child, target.clone(), name)?);
                }
                continue;
            }
        };
        let replaced = match destination.existing(&target).await? {
            None => None,
            Some(found) => match job.collision(&destination.display(&target)).await? {
                Collision::Skip => {
                    job.skip(&key);
                    continue;
                }
                Collision::Replace if found.is_directory() => return Err(kind_collision(true)),
                Collision::Replace => Some(found),
                Collision::KeepBoth => {
                    target = available(destination, &parent, &name).await?;
                    None
                }
            },
        };
        destination.copy(job, path, file, target, replaced).await?;
        job.completed(&key);
    }
    Ok(())
}
fn pending<S: Source, D: Destination<S>>(
    destination: &D,
    source: S::Path,
    parent: D::Path,
    name: String,
) -> AppResult<Pending<S, D>> {
    Ok(Pending {
        target: destination.child(&parent, &name)?,
        source,
        parent,
        name,
    })
}
/// Returns the directory receiving the children, or `None` when skipped.
async fn directory<S: Source, D: Destination<S>>(
    job: &Job,
    destination: &D,
    key: &str,
    entry: &Pending<S, D>,
) -> AppResult<Option<D::Path>> {
    let remembered = job.directory(key);
    let mut target = match &remembered {
        Some(previous) => retry_directory(destination, &entry.parent, previous)?,
        None => entry.target.clone(),
    };
    match destination.existing(&target).await? {
        Some(found) if remembered.is_some() && found.is_directory() => {}
        Some(found) => match job.collision(&destination.display(&target)).await? {
            Collision::Skip => {
                job.skip(key);
                return Ok(None);
            }
            Collision::Replace if !found.is_directory() => return Err(kind_collision(false)),
            Collision::Replace => {}
            Collision::KeepBoth => {
                target = available(destination, &entry.parent, &entry.name).await?;
                destination.create_directory(&target).await?;
            }
        },
        None => destination.create_directory(&target).await?,
    }
    job.remember_directory(key, &destination.display(&target));
    Ok(Some(target))
}
/// Retry state comes back from the interface: a remembered directory is trusted only as a
/// direct child of the directory receiving it, so it cannot leave the transfer destination.
fn retry_directory<S: Source, D: Destination<S>>(
    destination: &D,
    parent: &D::Path,
    remembered: &str,
) -> AppResult<D::Path> {
    let invalid = || AppError::invalid("Destination de reprise invalide");
    let name = destination.name_of(remembered).ok_or_else(invalid)?;
    let candidate = destination.child(parent, name).map_err(|_| invalid())?;
    if destination.display(&candidate) == remembered {
        Ok(candidate)
    } else {
        Err(invalid())
    }
}
async fn available<S: Source, D: Destination<S>>(
    destination: &D,
    parent: &D::Path,
    name: &str,
) -> AppResult<D::Path> {
    for index in 1..10000 {
        let candidate = destination.child(parent, &format!("{name} ({index})"))?;
        if destination.existing(&candidate).await?.is_none() {
            return Ok(candidate);
        }
    }
    Err(AppError::new(
        "file_collision",
        "Aucun nom de destination disponible",
    ))
}
