use super::*;

#[test]
fn removing_a_split_leaf_collapses_its_parent() {
    let removed = Uuid::new_v4();
    let remaining = Uuid::new_v4();
    let tree = SplitTabTree::Split {
        direction: SplitDirection::Vertical,
        ratio: 0.5,
        first: Box::new(SplitTabTree::Tab { tab_id: removed }),
        second: Box::new(SplitTabTree::Tab { tab_id: remaining }),
    };

    assert!(matches!(
        prune_split_tab(tree, removed),
        Some(SplitTabTree::Tab { tab_id }) if tab_id == remaining
    ));
}

#[test]
fn export_import_remaps_ids() {
    let s = DomainService::new(Repository::memory().unwrap());
    let original = s.snapshot().unwrap().workspaces[0].id;
    let imported = s.import_json(&s.export_json().unwrap()).unwrap();
    assert_ne!(original, imported.workspaces[0].id)
}

fn organized_data() -> AppData {
    let mut data = AppData::seed();
    let workspace_id = data.workspaces[0].id;
    let profile_id = data.profiles[0].id;
    let identity_id = Uuid::new_v4();
    let resource_id = Uuid::new_v4();
    let folder_id = Uuid::new_v4();
    data.identities.push(Identity {
        id: identity_id,
        workspace_id,
        name: "Admin".into(),
        username: "root".into(),
        identity_file: Some("admin_key".into()),
    });
    data.resources.push(Resource {
        id: resource_id,
        workspace_id,
        name: "Server".into(),
        ssh_alias: Some("server".into()),
        host: None,
        port: Some(22),
        identity_id: Some(identity_id),
    });
    data.sidebar_nodes.push(SidebarNode {
        id: folder_id,
        workspace_id,
        parent_id: None,
        kind: "folder".into(),
        label: "Production".into(),
        target_id: None,
        position: 0,
    });
    data.sidebar_nodes.push(SidebarNode {
        id: Uuid::new_v4(),
        workspace_id,
        parent_id: Some(folder_id),
        kind: "resource".into(),
        label: "Server".into(),
        target_id: Some(resource_id),
        position: 0,
    });
    data.favorites.push(Favorite {
        id: Uuid::new_v4(),
        workspace_id,
        target_kind: "profile".into(),
        target_id: profile_id,
        position: 0,
    });
    data
}
#[test]
fn update_workspace_persists_name_and_icon() {
    let repo = Repository::memory().unwrap();
    let data = AppData::seed();
    let workspace_id = data.workspaces[0].id;
    repo.save(&data).unwrap();
    let service = DomainService::new(repo);

    let updated = service
        .update_workspace(workspace_id, " Operations ".into(), "server".into(), None)
        .unwrap();

    assert_eq!(updated.name, "Operations");
    assert_eq!(updated.icon, "server");
    let snapshot = service.snapshot().unwrap();
    assert_eq!(snapshot.workspaces[0].name, "Operations");
}

#[test]
fn delete_workspace_removes_owned_records_and_keeps_the_last_one() {
    let service = DomainService::new(Repository::memory().unwrap());
    let first = service.snapshot().unwrap().workspaces[0].id;
    let second = service
        .create_workspace("Ops".into(), "server".into(), "#67e8f9".into(), None)
        .unwrap();

    service.delete_workspace(second.id).unwrap();
    let snapshot = service.snapshot().unwrap();
    assert_eq!(snapshot.workspaces.len(), 1);
    assert_eq!(snapshot.workspaces[0].id, first);
    assert!(service.delete_workspace(first).is_err());
}

#[test]
fn create_workspace_keeps_the_launch_profile_off_the_sidebar() {
    let service = DomainService::new(Repository::memory().unwrap());
    let workspace = service
        .create_workspace("Ops".into(), "server".into(), "#67e8f9".into(), None)
        .unwrap();
    let snapshot = service.snapshot().unwrap();
    assert!(snapshot
        .sidebar_nodes
        .iter()
        .all(|node| node.workspace_id != workspace.id || node.kind != "profile"));
    assert_eq!(
        snapshot
            .profiles
            .iter()
            .find(|profile| profile.workspace_id == workspace.id)
            .map(|profile| profile.executable.as_str()),
        Some(snapshot.settings.default_shell.as_str())
    );
}

#[test]
fn updating_the_default_shell_rewrites_workspace_launch_profiles() {
    let service = DomainService::new(Repository::memory().unwrap());
    let mut settings = service.snapshot().unwrap().settings;
    settings.default_shell = "cmd.exe".into();
    service.update_settings(settings).unwrap();
    let snapshot = service.snapshot().unwrap();
    assert_eq!(snapshot.settings.default_shell, "cmd.exe");
    assert_eq!(snapshot.profiles[0].executable, "cmd.exe");
    assert_eq!(snapshot.profiles[0].name, "CMD");
}

#[test]
fn import_preserves_organization_and_remaps_every_reference() {
    let service = DomainService::new(Repository::memory().unwrap());
    let incoming = organized_data();
    let old_workspace = incoming.workspaces[0].id;
    let old_node_ids: Vec<_> = incoming.sidebar_nodes.iter().map(|x| x.id).collect();
    let imported = service
        .import_json(&serde_json::to_string(&incoming).unwrap())
        .unwrap();
    assert_ne!(imported.workspaces[0].id, old_workspace);
    assert_eq!(imported.sidebar_nodes.len(), 2);
    assert_eq!(imported.favorites.len(), 1);
    assert!(imported
        .sidebar_nodes
        .iter()
        .all(|x| !old_node_ids.contains(&x.id)));
    let folder = imported
        .sidebar_nodes
        .iter()
        .find(|x| x.kind == "folder")
        .unwrap();
    let child = imported
        .sidebar_nodes
        .iter()
        .find(|x| x.kind == "resource")
        .unwrap();
    assert_eq!(child.parent_id, Some(folder.id));
    assert_eq!(child.target_id, Some(imported.resources[0].id));
    assert_eq!(imported.favorites[0].target_id, imported.profiles[0].id);
    assert!(imported.validate().is_ok());
}
#[test]
fn profile_cannot_be_resolved_through_another_workspace() {
    let s = DomainService::new(Repository::memory().unwrap());
    let data = s.snapshot().unwrap();
    let profile = &data.profiles[0];
    assert!(s.local_profile(Uuid::new_v4(), profile.id).is_err());
}

#[test]
fn layout_and_window_state_round_trip_through_public_service() {
    let service = DomainService::new(Repository::memory().unwrap());
    let snapshot = service.snapshot().unwrap();
    let workspace_id = snapshot.workspaces[0].id;
    let profile_id = snapshot.profiles[0].id;
    let session_id = Uuid::new_v4();
    let tab = Tab {
        id: Uuid::new_v4(),
        workspace_id,
        name: "Operations".into(),
        root: Some(PaneTree::Pane { session_id }),
        position: 0,
        organized: false,
        folder_id: None,
    };
    service
        .save_tab(
            tab.clone(),
            vec![SavedSession {
                id: session_id,
                workspace_id,
                target_kind: "profile".into(),
                target_id: profile_id,
                working_directory: Some("C:\\Work".into()),
            }],
        )
        .unwrap();
    let window = WindowState {
        id: Uuid::new_v4(),
        active_workspace_id: Some(workspace_id),
        active_tab_id: Some(tab.id),
        x: Some(10),
        y: Some(20),
        width: 1200,
        height: 800,
        maximized: false,
        sidebar_hidden: true,
    };
    service.save_window_state(window.clone()).unwrap();
    let restored = service.snapshot().unwrap();
    assert_eq!(restored.tabs, vec![tab]);
    assert_eq!(restored.windows, vec![window]);
    assert_eq!(
        restored.saved_sessions[0].working_directory.as_deref(),
        Some("C:\\Work")
    );
}

#[test]
fn an_unclean_run_is_offered_for_recovery_once() {
    let repository = Repository::memory().unwrap();
    let service = DomainService::new(repository);
    assert!(!service.begin_run().unwrap());
    assert!(!service.recovery_state().unwrap().clean_shutdown);
    // Simulate a new process opening the snapshot left by the crashed run.
    assert!(service.begin_run().unwrap());
    assert!(service.recovery_state().unwrap().recovery_available);
    service.finish_recovery().unwrap();
    assert!(!service.recovery_state().unwrap().recovery_available);
    service.mark_clean_shutdown().unwrap();
    assert!(service.recovery_state().unwrap().clean_shutdown);
}

#[test]
fn a_created_profile_and_node_become_openable_organization() {
    let service = DomainService::new(Repository::memory().unwrap());
    let workspace = service.snapshot().unwrap().workspaces[0].id;

    let profile = service
        .create_profile(workspace, "CMD".into(), "cmd.exe".into(), vec![], None)
        .unwrap();
    let node = service
        .create_sidebar_node(
            workspace,
            "profile".into(),
            "CMD".into(),
            None,
            Some(profile.id),
        )
        .unwrap();

    let data = service.snapshot().unwrap();
    assert!(data.profiles.iter().any(|item| item.id == profile.id));
    assert!(data.sidebar_nodes.iter().any(|item| item.id == node.id));
    assert!(service.local_profile(workspace, profile.id).is_ok());
}

#[test]
fn folders_cannot_be_nested() {
    let service = DomainService::new(Repository::memory().unwrap());
    let workspace = service.snapshot().unwrap().workspaces[0].id;
    let parent = service
        .create_sidebar_node(workspace, "folder".into(), "Parent".into(), None, None)
        .unwrap();
    let error = service
        .create_sidebar_node(
            workspace,
            "folder".into(),
            "Child".into(),
            Some(parent.id),
            None,
        )
        .unwrap_err();
    assert_eq!(error, "folders cannot be nested");
}

#[test]
fn moving_a_node_renumbers_its_siblings_densely() {
    let service = DomainService::new(Repository::memory().unwrap());
    let workspace = service.snapshot().unwrap().workspaces[0].id;
    let mut ids = vec![];
    for label in ["A", "B", "C"] {
        ids.push(
            service
                .create_sidebar_node(workspace, "folder".into(), label.into(), None, None)
                .unwrap()
                .id,
        );
    }

    service.move_sidebar_node(ids[2], None, 0).unwrap();

    let mut nodes = service.snapshot().unwrap().sidebar_nodes;
    nodes.sort_by_key(|node| node.position);
    assert_eq!(
        nodes
            .iter()
            .map(|node| node.label.as_str())
            .collect::<Vec<_>>(),
        vec!["C", "A", "B"]
    );
    assert_eq!(
        nodes.iter().map(|node| node.position).collect::<Vec<_>>(),
        vec![0, 1, 2]
    );
}

#[test]
fn deleting_a_node_removes_every_reference_to_its_target() {
    let service = DomainService::new(Repository::memory().unwrap());
    let workspace = service.snapshot().unwrap().workspaces[0].id;
    let identity = service
        .create_identity(workspace, "ops".into(), "ops".into(), None)
        .unwrap();
    let resource = service
        .create_resource(
            workspace,
            "Production".into(),
            Some("prod.example.net".into()),
            None,
            None,
            Some(identity.id),
        )
        .unwrap();
    let folder = service
        .create_sidebar_node(workspace, "folder".into(), "Clients".into(), None, None)
        .unwrap();
    let node = service
        .create_sidebar_node(
            workspace,
            "resource".into(),
            "Production".into(),
            Some(folder.id),
            Some(resource.id),
        )
        .unwrap();
    service
        .set_favorite(workspace, "resource".into(), resource.id, true)
        .unwrap();

    let session_id = Uuid::new_v4();
    service
        .save_tab(
            Tab {
                id: Uuid::new_v4(),
                workspace_id: workspace,
                name: "Production".into(),
                root: Some(PaneTree::Pane { session_id }),
                position: 0,
                organized: true,
                folder_id: None,
            },
            vec![SavedSession {
                id: session_id,
                workspace_id: workspace,
                target_kind: "resource".into(),
                target_id: resource.id,
                working_directory: None,
            }],
        )
        .unwrap();

    service.delete_sidebar_node(folder.id).unwrap();

    let data = service.snapshot().unwrap();
    assert!(!data
        .sidebar_nodes
        .iter()
        .any(|item| item.id == folder.id || item.id == node.id));
    assert!(data.resources.is_empty());
    assert!(data.favorites.is_empty());
    assert!(data.saved_sessions.is_empty());
    assert!(data.tabs.is_empty());
}

#[test]
fn a_favorite_is_pinned_and_unpinned_without_duplicates() {
    let service = DomainService::new(Repository::memory().unwrap());
    let data = service.snapshot().unwrap();
    let workspace = data.workspaces[0].id;
    let profile = data.profiles[0].id;

    service
        .set_favorite(workspace, "profile".into(), profile, true)
        .unwrap();
    service
        .set_favorite(workspace, "profile".into(), profile, true)
        .unwrap();
    assert_eq!(service.snapshot().unwrap().favorites.len(), 1);

    service
        .set_favorite(workspace, "profile".into(), profile, false)
        .unwrap();
    assert!(service.snapshot().unwrap().favorites.is_empty());
}

#[test]
fn moving_a_favorite_renumbers_the_list() {
    let service = DomainService::new(Repository::memory().unwrap());
    let data = service.snapshot().unwrap();
    let workspace = data.workspaces[0].id;
    let first = data.profiles[0].id;
    let second = service
        .create_profile(workspace, "Second".into(), "cmd.exe".into(), vec![], None)
        .unwrap()
        .id;
    service
        .set_favorite(workspace, "profile".into(), first, true)
        .unwrap();
    service
        .set_favorite(workspace, "profile".into(), second, true)
        .unwrap();
    let favorite = service
        .snapshot()
        .unwrap()
        .favorites
        .into_iter()
        .find(|item| item.target_id == second)
        .unwrap();

    service.move_favorite(favorite.id, 0).unwrap();

    let mut favorites = service.snapshot().unwrap().favorites;
    favorites.sort_by_key(|item| item.position);
    assert_eq!(
        favorites
            .iter()
            .map(|item| item.target_id)
            .collect::<Vec<_>>(),
        vec![second, first]
    );
    assert_eq!(
        favorites
            .iter()
            .map(|item| item.position)
            .collect::<Vec<_>>(),
        vec![0, 1]
    );
}

#[test]
fn deleting_a_tab_drops_the_sessions_it_owned() {
    let service = DomainService::new(Repository::memory().unwrap());
    let data = service.snapshot().unwrap();
    let workspace = data.workspaces[0].id;
    let profile = data.profiles[0].id;
    let session_id = Uuid::new_v4();
    let tab_id = Uuid::new_v4();

    service
        .save_tab(
            Tab {
                id: tab_id,
                workspace_id: workspace,
                name: "Shell".into(),
                root: Some(PaneTree::Pane { session_id }),
                position: 0,
                organized: false,
                folder_id: None,
            },
            vec![SavedSession {
                id: session_id,
                workspace_id: workspace,
                target_kind: "profile".into(),
                target_id: profile,
                working_directory: None,
            }],
        )
        .unwrap();

    service.delete_tab(tab_id).unwrap();

    let data = service.snapshot().unwrap();
    assert!(data.tabs.is_empty());
    assert!(data.saved_sessions.is_empty());
}

#[test]
fn a_pane_tree_stays_camel_case_on_the_wire() {
    let json = serde_json::to_string(&PaneTree::Split {
        direction: SplitDirection::Vertical,
        ratio: 0.5,
        first: Box::new(PaneTree::Pane {
            session_id: Uuid::nil(),
        }),
        second: Box::new(PaneTree::Pane {
            session_id: Uuid::nil(),
        }),
    })
    .unwrap();
    assert!(json.contains("\"sessionId\""), "{json}");
    assert!(!json.contains("session_id"), "{json}");
}
