use super::{
    jobs::Job,
    join,
    model::{Collision, Direction, TransferEvent, TransferState},
    paths::remote_name,
    walk::{walk, Destination, Found, Node, Source},
};
use crate::{error::AppResult, sessions::events::recording::Recorder};
use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, Mutex},
};
use uuid::Uuid;

#[derive(Clone, Copy, PartialEq)]
enum Kind {
    Directory,
    File,
    Link,
}
/// An in-memory tree read as a source.
struct Tree(BTreeMap<String, Kind>);
/// An in-memory destination recording each published file as (source, target, replaced).
#[derive(Default)]
struct Target {
    entries: Mutex<BTreeMap<String, Kind>>,
    copies: Mutex<Vec<(String, String, bool)>>,
}
struct Existing(Kind);
impl Tree {
    fn new(entries: &[(&str, Kind)]) -> Self {
        Self(entries.iter().map(|(p, k)| ((*p).into(), *k)).collect())
    }
}
impl Target {
    fn new(entries: &[(&str, Kind)]) -> Self {
        let target = Self::default();
        let mut map = target.entries.lock().unwrap();
        map.insert("/dest".into(), Kind::Directory);
        map.extend(entries.iter().map(|(p, k)| ((*p).into(), *k)));
        drop(map);
        target
    }
    fn copies(&self) -> Vec<(String, String, bool)> {
        self.copies.lock().unwrap().clone()
    }
}
impl Source for Tree {
    type Path = String;
    type File = ();
    fn key(&self, path: &String) -> String {
        path.clone()
    }
    fn name(&self, path: &String) -> AppResult<String> {
        Ok(path.rsplit('/').next().unwrap().into())
    }
    async fn inspect(&self, path: &String) -> AppResult<Node<()>> {
        Ok(match self.0[path] {
            Kind::Directory => Node::Directory,
            Kind::File => Node::File(()),
            Kind::Link => Node::Other,
        })
    }
    async fn children(&self, path: &String) -> AppResult<Vec<(String, String)>> {
        Ok(self
            .0
            .keys()
            .filter_map(|p| Some((p.strip_prefix(&format!("{path}/"))?, p)))
            .filter(|(name, _)| !name.contains('/'))
            .map(|(name, p)| (name.into(), p.clone()))
            .collect())
    }
}
impl Found for Existing {
    fn is_directory(&self) -> bool {
        self.0 == Kind::Directory
    }
}
impl Destination<Tree> for Target {
    type Path = String;
    type Found = Existing;
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
    async fn existing(&self, path: &String) -> AppResult<Option<Existing>> {
        Ok(self
            .entries
            .lock()
            .unwrap()
            .get(path)
            .copied()
            .map(Existing))
    }
    async fn create_directory(&self, path: &String) -> AppResult<()> {
        let previous = self
            .entries
            .lock()
            .unwrap()
            .insert(path.clone(), Kind::Directory);
        assert!(previous.is_none(), "{path} created twice");
        Ok(())
    }
    async fn copy(
        &self,
        _: &Job,
        source: String,
        _: (),
        target: String,
        replaced: Option<Existing>,
    ) -> AppResult<()> {
        self.entries
            .lock()
            .unwrap()
            .insert(target.clone(), Kind::File);
        let copy = (source, target, replaced.is_some());
        self.copies.lock().unwrap().push(copy);
        Ok(())
    }
}
fn job(policy: Option<Collision>, completed: &[&str], directories: &[(&str, &str)]) -> Job {
    let event = TransferEvent {
        session_id: Uuid::new_v4(),
        id: Uuid::new_v4(),
        direction: Direction::Upload,
        state: TransferState::Running,
        path: "/dest".into(),
        bytes: 0,
        total: 0,
        message: None,
        skipped: vec![],
        completed_sources: completed.iter().map(|s| (*s).into()).collect(),
        directories: directories
            .iter()
            .map(|(s, d)| ((*s).into(), (*d).into()))
            .collect::<HashMap<_, _>>(),
    };
    let job = Job::new(event, Arc::new(Recorder::default()));
    *job.policy.lock().unwrap() = policy;
    job
}
/// Walks `roots` into `/dest`; a collision without a preset answer fails the test.
async fn run(job: &Job, tree: &Tree, target: &Target, roots: &[&str]) -> AppResult<()> {
    let roots = roots.iter().map(|r| (*r).into()).collect();
    let walking = walk(job, tree, target, roots, "/dest".into());
    tokio::time::timeout(std::time::Duration::from_secs(1), walking)
        .await
        .expect("the walk asked about a collision")
}
fn sorted(mut values: Vec<String>) -> Vec<String> {
    values.sort();
    values
}

#[tokio::test]
async fn the_skipped_report_lists_source_paths_for_links_and_declined_collisions() {
    let tree = Tree::new(&[
        ("/src/link", Kind::Link),
        ("/src/taken", Kind::File),
        ("/src/sub", Kind::Directory),
        ("/src/kept", Kind::File),
    ]);
    let target = Target::new(&[("/dest/taken", Kind::File), ("/dest/sub", Kind::Directory)]);
    let job = job(Some(Collision::Skip), &[], &[]);
    let roots = ["/src/link", "/src/taken", "/src/sub", "/src/kept"];
    run(&job, &tree, &target, &roots).await.unwrap();
    let skipped = job.event.lock().unwrap().skipped.clone();
    assert_eq!(sorted(skipped), ["/src/link", "/src/sub", "/src/taken"]);
    assert_eq!(
        target.copies(),
        [("/src/kept".into(), "/dest/kept".into(), false)]
    );
}

#[tokio::test]
async fn keep_both_uses_the_first_free_numbered_name_and_remembers_the_directory() {
    let tree = Tree::new(&[
        ("/src/f", Kind::File),
        ("/src/d", Kind::Directory),
        ("/src/d/x", Kind::File),
    ]);
    let target = Target::new(&[
        ("/dest/f", Kind::File),
        ("/dest/f (1)", Kind::Directory),
        ("/dest/d", Kind::Directory),
    ]);
    let job = job(Some(Collision::KeepBoth), &[], &[]);
    run(&job, &tree, &target, &["/src/f", "/src/d"])
        .await
        .unwrap();
    assert_eq!(
        target.copies(),
        [
            ("/src/d/x".into(), "/dest/d (1)/x".into(), false),
            ("/src/f".into(), "/dest/f (2)".into(), false),
        ]
    );
    let event = job.event.lock().unwrap();
    assert_eq!(event.directories["/src/d"], "/dest/d (1)");
    assert_eq!(
        sorted(event.completed_sources.clone()),
        ["/src/d/x", "/src/f"]
    );
}

#[tokio::test]
async fn replace_overwrites_files_merges_directories_and_refuses_kind_changes() {
    let tree = Tree::new(&[
        ("/src/f", Kind::File),
        ("/src/d", Kind::Directory),
        ("/src/d/x", Kind::File),
    ]);
    let target = Target::new(&[("/dest/f", Kind::File), ("/dest/d", Kind::Directory)]);
    let job = job(Some(Collision::Replace), &[], &[]);
    run(&job, &tree, &target, &["/src/f", "/src/d"])
        .await
        .unwrap();
    assert_eq!(
        target.copies(),
        [
            ("/src/d/x".into(), "/dest/d/x".into(), false),
            ("/src/f".into(), "/dest/f".into(), true),
        ]
    );
    for (source, existing, message) in [
        ("/src/f", Kind::Directory, "Un fichier ne peut pas"),
        ("/src/d", Kind::File, "Un dossier ne peut pas"),
        ("/src/d", Kind::Link, "Un dossier ne peut pas"),
    ] {
        let name = source.rsplit('/').next().unwrap();
        let target = Target::new(&[(&format!("/dest/{name}"), existing)]);
        let job = self::job(Some(Collision::Replace), &[], &[]);
        let error = run(&job, &tree, &target, &[source]).await.unwrap_err();
        assert!(error.message.starts_with(message), "{}", error.message);
        assert!(target.copies().is_empty());
    }
}

#[tokio::test]
async fn retry_skips_completed_sources_and_merges_into_remembered_directories_without_asking() {
    let tree = Tree::new(&[
        ("/src/d", Kind::Directory),
        ("/src/d/done", Kind::File),
        ("/src/d/new", Kind::File),
    ]);
    let target = Target::new(&[
        ("/dest/d", Kind::Directory),
        ("/dest/d (1)", Kind::Directory),
        ("/dest/d (1)/done", Kind::File),
    ]);
    let job = job(None, &["/src/d/done"], &[("/src/d", "/dest/d (1)")]);
    run(&job, &tree, &target, &["/src/d"]).await.unwrap();
    assert_eq!(
        target.copies(),
        [("/src/d/new".into(), "/dest/d (1)/new".into(), false)]
    );
}

#[tokio::test]
async fn retry_trusts_a_remembered_directory_only_as_a_direct_child_of_its_receiving_directory() {
    let tree = Tree::new(&[("/src/d", Kind::Directory), ("/src/d/x", Kind::File)]);
    for remembered in [
        "/elsewhere",
        "/dest/../etc",
        "/dest/..",
        "/dest/",
        "/dest//d",
        "/dest/other/d",
        "relative",
    ] {
        let target = Target::new(&[]);
        let job = job(Some(Collision::Replace), &[], &[("/src/d", remembered)]);
        let error = run(&job, &tree, &target, &["/src/d"]).await.unwrap_err();
        assert_eq!(
            error.message, "Destination de reprise invalide",
            "{remembered}"
        );
        assert_eq!(target.entries.lock().unwrap().len(), 1, "{remembered}");
        assert!(target.copies().is_empty());
    }
}
