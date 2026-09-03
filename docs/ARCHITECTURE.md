# Architecture

Via suit une organisation par responsabilité, avec des dépendances orientées vers le domaine.

```text
src/
├── domain/       règles pures liées aux concepts de Via
├── stores/       orchestration réactive des cas d’usage
├── ipc/          adaptateur vers le processus natif Tauri
├── terminal/     adaptateur vers xterm
├── components/   présentation Vue
├── composables/  comportements de présentation réutilisables
└── lib/          utilitaires techniques sans responsabilité métier
```

## Modules et seams

### Disposition des panes et des split groups

`src/domain/layout.ts` est le module qui porte les transformations des arbres de panes et de split groups. Son interface accepte des valeurs et retourne de nouvelles valeurs, sans Vue, Pinia, Tauri ni xterm.

Ce seam concentre les invariants structurels : suppression d’une feuille avec réduction de l’arbre, remplacement d’une session, conversion vers les types persistés et limitation des ratios. Les appelants obtiennent ainsi plus de leverage avec une interface réduite, tandis que les règles bénéficient d’une meilleure locality.

### Store d’application

`src/stores/app.ts` orchestre l’état réactif et les effets. Il coordonne les modules du domaine et les adaptateurs, mais ne réimplémente plus les transformations d’arbres.

### Adaptateurs

- `src/ipc/` adapte les commandes et événements du processus Tauri.
- `src/terminal/` adapte le cycle de vie et le rendu des sessions xterm.
- `src/lib/preferences.ts` et `src/lib/sidebar-state.ts` adaptent la persistance locale du navigateur.

La règle de dépendance est simple : la présentation peut dépendre du store, le store peut dépendre du domaine et des adaptateurs, mais le domaine ne dépend d’aucun détail d’infrastructure ou de présentation.

## Processus natif Rust

```text
src-tauri/src/
├── lib.rs                    composition Tauri et enregistrement des commandes
├── commands/
│   └── terminal.rs           adaptateur IPC des sessions locales et SSH
├── domain/
│   ├── mod.rs                modèle sérialisé et valeurs par défaut
│   └── validation.rs         invariants globaux de AppData
├── service/
│   ├── mod.rs                seam transactionnel et transformations partagées
│   ├── workspaces.rs         Workspace, Identity et Resource
│   ├── organization.rs       Tab, Folder, Favorite et Split group
│   └── lifecycle.rs          état, fenêtres, import et export
├── repository.rs             adaptateur SQLite
├── pty.rs                    gestionnaire des processus terminaux
└── ssh.rs                    configuration et résolution OpenSSH
```

`DomainService` reste l’unique interface transactionnelle. Son implémentation est répartie par concepts sans multiplier les interfaces : toutes les mutations passent toujours par le même verrou, puis par la séquence chargement, mutation, validation et sauvegarde.

Les commandes terminal sont des adaptateurs fins autour de `DomainService`, `SessionManager` et OpenSSH. La composition root conserve seule la connaissance de l’ensemble des modules. Le domaine ne dépend ni de Tauri, ni de SQLite, ni du runtime PTY.

## Surface de test

Les tests existants conservent le store et la disposition rendue comme seams publics. Comme cette refonte ne change aucun comportement, ils servent de tests de caractérisation : les mêmes scénarios doivent réussir avant et après le déplacement de l’implémentation.
