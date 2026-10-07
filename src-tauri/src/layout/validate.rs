use super::{Entry, Layout, Row, Split, Tab};
use crate::error::{AppError, AppResult};
use std::collections::HashSet;
use uuid::Uuid;

const MAX_NAME: usize = 80;
const MAX_TITLE: usize = 200;

pub fn check(layout: &Layout) -> AppResult<()> {
    if layout.spaces.is_empty() {
        return Err(AppError::invalid("there must be at least one space"));
    }
    if !(160..=640).contains(&layout.sidebar.width) {
        return Err(AppError::invalid("sidebar width out of range"));
    }
    let mut ids = Ids::default();
    for space in &layout.spaces {
        ids.claim(space.id)?;
        name(&space.name, MAX_NAME)?;
        short(&space.icon)?;
        for entry in &space.pinned {
            match entry {
                Entry::Tab(tab) => check_tab(tab, &mut ids)?,
                Entry::Split(split) => check_split(split, &mut ids)?,
                Entry::Folder {
                    id,
                    name: label,
                    rows,
                    ..
                } => {
                    ids.claim(*id)?;
                    name(label, MAX_NAME)?;
                    for row in rows {
                        match row {
                            Row::Tab(tab) => check_tab(tab, &mut ids)?,
                            Row::Split(split) => check_split(split, &mut ids)?,
                        }
                    }
                }
            }
        }
    }
    match layout.active_space_id {
        Some(id) if !layout.spaces.iter().any(|space| space.id == id) => {
            Err(AppError::invalid("the active space does not exist"))
        }
        _ => Ok(()),
    }
}

#[derive(Default)]
struct Ids(HashSet<Uuid>);

impl Ids {
    fn claim(&mut self, id: Uuid) -> AppResult<()> {
        if self.0.insert(id) {
            Ok(())
        } else {
            Err(AppError::invalid("an element appears twice in the layout"))
        }
    }
}

fn check_tab(tab: &Tab, ids: &mut Ids) -> AppResult<()> {
    ids.claim(tab.id)?;
    if tab
        .remote_cwd
        .as_ref()
        .is_some_and(|path| path.len() > 32768 || path.contains('\0'))
    {
        return Err(AppError::invalid("invalid remote directory"));
    }
    match &tab.title {
        Some(title) => name(title, MAX_TITLE),
        None => Ok(()),
    }
}

fn check_split(split: &Split, ids: &mut Ids) -> AppResult<()> {
    ids.claim(split.id)?;
    if !(2..=4).contains(&split.tabs.len()) {
        return Err(AppError::invalid("a split view holds two to four tabs"));
    }
    let sizes_valid = split.sizes.len() == split.tabs.len()
        && split
            .sizes
            .iter()
            .all(|size| size.is_finite() && *size > 0.0);
    if !sizes_valid {
        return Err(AppError::invalid("split sizes do not match its tabs"));
    }
    split.tabs.iter().try_for_each(|tab| check_tab(tab, ids))
}

fn name(value: &str, max: usize) -> AppResult<()> {
    if value.trim().is_empty() || value.chars().count() > max {
        return Err(AppError::invalid(
            "names must be between 1 and 80 characters",
        ));
    }
    Ok(())
}

fn short(value: &str) -> AppResult<()> {
    if value.is_empty() || value.len() > 32 {
        return Err(AppError::invalid("invalid icon"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::{Direction, Target};
    use super::*;

    fn tab() -> Tab {
        Tab {
            id: Uuid::new_v4(),
            title: None,
            remote_cwd: None,
            target: Target::Local {
                shell: None,
                cwd: None,
            },
        }
    }

    fn with(entry: Entry) -> Layout {
        let mut layout = Layout::default();
        layout.spaces[0].pinned.push(entry);
        layout
    }

    #[test]
    fn default_layout_is_valid() {
        assert!(check(&Layout::default()).is_ok());
    }

    #[test]
    fn rejects_duplicates_and_bad_splits() {
        let shared = tab();
        let mut layout = with(Entry::Tab(shared.clone()));
        layout.spaces[0].pinned.push(Entry::Tab(shared));
        assert!(check(&layout).is_err());

        let split = |tabs: Vec<Tab>, sizes: Vec<f32>| Split {
            id: Uuid::new_v4(),
            direction: Direction::Horizontal,
            sizes,
            tabs,
        };
        assert!(check(&with(Entry::Split(split(vec![tab()], vec![1.0])))).is_err());
        assert!(check(&with(Entry::Split(split(vec![tab(), tab()], vec![1.0])))).is_err());
        assert!(check(&with(Entry::Split(split(
            vec![tab(), tab()],
            vec![1.0, 1.0]
        ))))
        .is_ok());
    }

    #[test]
    fn rejects_empty_layout_and_unknown_active_space() {
        let mut layout = Layout {
            active_space_id: Some(Uuid::new_v4()),
            ..Layout::default()
        };
        assert!(check(&layout).is_err());
        layout.spaces.clear();
        assert!(check(&layout).is_err());
    }
}
