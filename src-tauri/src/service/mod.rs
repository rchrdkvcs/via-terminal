use crate::domain::*;
use crate::repository::Repository;
use std::sync::Mutex;
use uuid::Uuid;

mod lifecycle;
mod organization;
#[cfg(test)]
mod tests;
mod workspaces;

pub struct DomainService {
    repo: Mutex<Repository>,
}

impl DomainService {
    pub fn new(repo: Repository) -> Self {
        Self {
            repo: Mutex::new(repo),
        }
    }
    pub fn snapshot(&self) -> Result<AppData, String> {
        self.repo
            .lock()
            .unwrap()
            .load()?
            .ok_or("app data unavailable".into())
    }
    pub fn local_profile(&self, workspace_id: Id, profile_id: Id) -> Result<LocalProfile, String> {
        let data = self.snapshot()?;
        if !data
            .workspaces
            .iter()
            .any(|workspace| workspace.id == workspace_id)
        {
            return Err("workspace not found".into());
        }
        data.profiles
            .into_iter()
            .find(|profile| profile.id == profile_id && profile.workspace_id == workspace_id)
            .ok_or_else(|| "profile not found in workspace".into())
    }
    fn mutate<T>(&self, f: impl FnOnce(&mut AppData) -> Result<T, String>) -> Result<T, String> {
        let repo = self.repo.lock().unwrap();
        let mut data = repo.load()?.ok_or("app data unavailable")?;
        let value = f(&mut data)?;
        data.validate()?;
        repo.save(&data)?;
        Ok(value)
    }
}

/// True when `candidate` sits under `ancestor` in the sidebar hierarchy.
/// Used before a move so a folder can never be dropped into its own subtree.
fn is_descendant(nodes: &[SidebarNode], candidate: Id, ancestor: Id) -> bool {
    let mut current = Some(candidate);
    let mut seen = std::collections::HashSet::new();
    while let Some(id) = current {
        if id == ancestor {
            return true;
        }
        if !seen.insert(id) {
            return false;
        }
        current = nodes
            .iter()
            .find(|node| node.id == id)
            .and_then(|node| node.parent_id);
    }
    false
}

/// Drop the named sessions from every pane tree, collapsing empty splits and
/// removing tabs left with nothing to show.
fn prune_sessions_from_tabs(tabs: &mut Vec<Tab>, sessions: &std::collections::HashSet<Id>) {
    for tab in tabs.iter_mut() {
        tab.root = tab.root.take().and_then(|root| prune_pane(root, sessions));
    }
    tabs.retain(|tab| tab.root.is_some());
}

fn prune_pane(tree: PaneTree, sessions: &std::collections::HashSet<Id>) -> Option<PaneTree> {
    match tree {
        PaneTree::Pane { session_id } => {
            if sessions.contains(&session_id) {
                None
            } else {
                Some(PaneTree::Pane { session_id })
            }
        }
        PaneTree::Split {
            direction,
            ratio,
            first,
            second,
        } => match (prune_pane(*first, sessions), prune_pane(*second, sessions)) {
            (Some(first), Some(second)) => Some(PaneTree::Split {
                direction,
                ratio,
                first: Box::new(first),
                second: Box::new(second),
            }),
            (Some(only), None) | (None, Some(only)) => Some(only),
            (None, None) => None,
        },
    }
}

fn remap_ids(data: &mut AppData) {
    let mut ws = std::collections::HashMap::new();
    for w in &mut data.workspaces {
        let old = w.id;
        w.id = Uuid::new_v4();
        ws.insert(old, w.id);
    }
    let mut profiles = std::collections::HashMap::new();
    for p in &mut data.profiles {
        let old = p.id;
        p.id = Uuid::new_v4();
        p.workspace_id = ws[&p.workspace_id];
        profiles.insert(old, p.id);
    }
    for w in &mut data.workspaces {
        w.default_profile_id = w
            .default_profile_id
            .and_then(|id| profiles.get(&id).copied());
    }
    let mut identities = std::collections::HashMap::new();
    for i in &mut data.identities {
        let old = i.id;
        i.id = Uuid::new_v4();
        i.workspace_id = ws[&i.workspace_id];
        identities.insert(old, i.id);
    }
    let mut resources = std::collections::HashMap::new();
    for r in &mut data.resources {
        let old = r.id;
        r.id = Uuid::new_v4();
        r.workspace_id = ws[&r.workspace_id];
        r.identity_id = r.identity_id.and_then(|i| identities.get(&i).copied());
        resources.insert(old, r.id);
    }
    let mut nodes = std::collections::HashMap::new();
    for node in &mut data.sidebar_nodes {
        let old = node.id;
        node.id = Uuid::new_v4();
        node.workspace_id = ws[&node.workspace_id];
        nodes.insert(old, node.id);
    }
    for node in &mut data.sidebar_nodes {
        node.parent_id = node.parent_id.and_then(|id| nodes.get(&id).copied());
        node.target_id = node.target_id.and_then(|id| match node.kind.as_str() {
            "profile" => profiles.get(&id).copied(),
            "resource" => resources.get(&id).copied(),
            _ => None,
        });
    }
    for favorite in &mut data.favorites {
        favorite.id = Uuid::new_v4();
        favorite.workspace_id = ws[&favorite.workspace_id];
        favorite.target_id = match favorite.target_kind.as_str() {
            "profile" => profiles[&favorite.target_id],
            "resource" => resources[&favorite.target_id],
            _ => unreachable!("validated favorite kind"),
        };
    }
    let mut sessions = std::collections::HashMap::new();
    for session in &mut data.saved_sessions {
        let old = session.id;
        session.id = Uuid::new_v4();
        session.workspace_id = ws[&session.workspace_id];
        session.target_id = match session.target_kind.as_str() {
            "profile" => profiles[&session.target_id],
            "resource" => resources[&session.target_id],
            _ => unreachable!("validated saved session kind"),
        };
        sessions.insert(old, session.id);
    }
    for tab in &mut data.tabs {
        tab.id = Uuid::new_v4();
        tab.workspace_id = ws[&tab.workspace_id];
        if let Some(root) = &mut tab.root {
            remap_pane_sessions(root, &sessions);
        }
    }
    // Window state belongs to a particular installation, not to a portable export.
    data.windows.clear();
    data.app_state = AppState::default();
}

fn pane_session_ids(tree: &PaneTree) -> Vec<Id> {
    match tree {
        PaneTree::Pane { session_id } => vec![*session_id],
        PaneTree::Split { first, second, .. } => {
            let mut ids = pane_session_ids(first);
            ids.extend(pane_session_ids(second));
            ids
        }
    }
}

fn prune_split_tab(tree: SplitTabTree, removed: Id) -> Option<SplitTabTree> {
    match tree {
        SplitTabTree::Tab { tab_id } if tab_id == removed => None,
        SplitTabTree::Tab { .. } => Some(tree),
        SplitTabTree::Split {
            direction,
            ratio,
            first,
            second,
        } => match (
            prune_split_tab(*first, removed),
            prune_split_tab(*second, removed),
        ) {
            (Some(first), Some(second)) => Some(SplitTabTree::Split {
                direction,
                ratio,
                first: Box::new(first),
                second: Box::new(second),
            }),
            (Some(remaining), None) | (None, Some(remaining)) => Some(remaining),
            (None, None) => None,
        },
    }
}

fn remap_pane_sessions(tree: &mut PaneTree, sessions: &std::collections::HashMap<Id, Id>) {
    match tree {
        PaneTree::Pane { session_id } => *session_id = sessions[session_id],
        PaneTree::Split { first, second, .. } => {
            remap_pane_sessions(first, sessions);
            remap_pane_sessions(second, sessions);
        }
    }
}
