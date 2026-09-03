use super::*;

#[test]
fn rejects_duplicate_ids_across_entity_types() {
    let mut data = AppData::seed();
    let workspace_id = data.workspaces[0].id;
    data.identities.push(Identity {
        id: workspace_id,
        workspace_id,
        name: "Admin".into(),
        username: "root".into(),
        identity_file: None,
    });
    assert_eq!(data.validate().unwrap_err(), "duplicate id");
}

#[test]
fn rejects_sidebar_and_favorite_cross_workspace_references() {
    let mut data = AppData::seed();
    let first = data.workspaces[0].id;
    let second = Uuid::new_v4();
    data.workspaces.push(Workspace {
        id: second,
        name: "Other".into(),
        icon: "terminal".into(),
        color: "#000".into(),
        position: 1,
        default_profile_id: None,
    });
    let profile_id = data.profiles[0].id;
    data.sidebar_nodes.push(SidebarNode {
        id: Uuid::new_v4(),
        workspace_id: second,
        parent_id: None,
        kind: "profile".into(),
        label: "Wrong".into(),
        target_id: Some(profile_id),
        position: 0,
    });
    assert!(data
        .validate()
        .unwrap_err()
        .contains("cross-workspace sidebar"));
    data.sidebar_nodes.clear();
    data.favorites.push(Favorite {
        id: Uuid::new_v4(),
        workspace_id: first,
        target_kind: "resource".into(),
        target_id: Uuid::new_v4(),
        position: 0,
    });
    assert!(data.validate().unwrap_err().contains("favorite target"));
}

#[test]
fn rejects_nested_folders() {
    let mut data = AppData::seed();
    let workspace_id = data.workspaces[0].id;
    let first = Uuid::new_v4();
    let second = Uuid::new_v4();
    data.sidebar_nodes.push(SidebarNode {
        id: first,
        workspace_id,
        parent_id: Some(second),
        kind: "folder".into(),
        label: "First".into(),
        target_id: None,
        position: 0,
    });
    data.sidebar_nodes.push(SidebarNode {
        id: second,
        workspace_id,
        parent_id: Some(first),
        kind: "folder".into(),
        label: "Second".into(),
        target_id: None,
        position: 0,
    });
    assert_eq!(data.validate().unwrap_err(), "folders cannot be nested");
}

#[test]
fn old_snapshots_receive_empty_layout_and_clean_app_state() {
    let data: AppData = serde_json::from_str(r#"{"workspaces":[],"profiles":[],"resources":[],"identities":[],"sidebarNodes":[],"favorites":[],"settings":{"theme":"system","density":"comfortable","fontFamily":"Cascadia Mono","fontSize":14,"restoreLocalSessions":false}}"#).unwrap();
    assert!(data.tabs.is_empty());
    assert!(data.windows.is_empty());
    assert_eq!(data.app_state, AppState::default());
}

#[test]
fn rejects_a_pane_that_crosses_workspace_boundary() {
    let mut data = AppData::seed();
    let first = data.workspaces[0].id;
    let profile = data.profiles[0].id;
    let second = Uuid::new_v4();
    data.workspaces.push(Workspace {
        id: second,
        name: "Other".into(),
        icon: "terminal".into(),
        color: "#000".into(),
        position: 1,
        default_profile_id: None,
    });
    let session_id = Uuid::new_v4();
    data.saved_sessions.push(SavedSession {
        id: session_id,
        workspace_id: first,
        target_kind: "profile".into(),
        target_id: profile,
        working_directory: None,
    });
    data.tabs.push(Tab {
        id: Uuid::new_v4(),
        workspace_id: second,
        name: "Wrong".into(),
        root: Some(PaneTree::Pane { session_id }),
        position: 0,
        organized: false,
        folder_id: None,
    });
    assert_eq!(
        data.validate().unwrap_err(),
        "cross-workspace pane session reference"
    );
}
