# Connexions SSH locales — plan d’implémentation

Ce document traduit la demande d’un usage comparable à Termius, sans synchronisation cloud, en changements pour Via. Il décrit le premier lot livré et l’architecture proposée pour les étapes suivantes. La recherche officielle est dans [termius-ssh-research.md](termius-ssh-research.md).

## Contrainte confirmée et première livraison

Le fonctionnement des onglets doit rester identique à l’existant, comme dans Zen / Arc / Dia. La gestion des connexions se trouve exclusivement dans le sélecteur « Nouvel onglet », jamais dans les réglages. Le sélecteur propose Terminal local et SSH et ne remplace pas la sidebar, ses favoris ou les splits. Un registre de types et de panneaux permet d’étendre ce parcours aux protocoles futurs lorsque leur moteur de session sera disponible. Les propositions de séparation ci-dessous concernent les données de connexion et leur édition, pas une refonte des interactions d’onglets.

Le premier lot ajoute création atomique, édition, duplication, recherche, sélection d’une identité réutilisable et personnalisation d’une identité pour une connexion. `Enregistrer` ne lance aucune session ; `Enregistrer et connecter` ouvre un nouvel onglet par l’action existante. « Nouvel onglet », Ctrl+T, les menus d’espace et la palette passent par le même sélecteur ; l’ouverture ou l’annulation du sélecteur ne démarre aucun processus. Modifier une connexion ne change pas le nom ni le processus des onglets ouverts. Les erreurs conservent le formulaire et la saisie. Les connexions existantes restent compatibles sans migration du stockage.

Les groupes hérités, l’édition globale des identités partagées, les secrets mémorisés et les changements de cycle de vie SSH décrits plus bas restent à livrer.

## Comportement cible

Un hôte enregistré existe indépendamment de ses sessions. On peut créer, modifier, dupliquer, supprimer et rechercher ses connexions, puis ouvrir une ou plusieurs sessions pour un même hôte. Fermer un terminal conserve la connexion enregistrée. Au redémarrage, les hôtes restent disponibles et aucune connexion ne démarre automatiquement.

La fiche d’un hôte contient un nom, une adresse ou un alias OpenSSH, le port (22 par défaut), un utilisateur et un mode d’authentification. Elle propose une identité réutilisable dans le même espace de travail. Les hôtes peuvent être organisés ; les dossiers de favoris existants restent des conteneurs d’onglets et ne doivent pas devenir implicitement des groupes de configuration SSH.

## État du dépôt et écarts

| Élément           | État observé                                                                            | Changement nécessaire                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hôtes persistants | `Resource` stocke nom, adresse/alias, port et identité dans le snapshot SQLite          | Garder cette base, ajouter édition et duplication                                                                      |
| Identités         | `Identity` stocke utilisateur et chemin de clé                                          | Donner un nom et permettre sélection, édition et réutilisation                                                         |
| Création          | `createSshResource` réalise trois commandes séparées (identité, ressource, nœud)        | Une mutation backend atomique pour éviter les objets orphelins                                                         |
| Formulaire        | `TargetDialog.vue` crée uniquement ; ferme aussi lorsque le store intercepte une erreur | Retourner un résultat explicite, afficher les erreurs, conserver la saisie                                             |
| Validation        | Port converti avec `Number`, sans validation de plage dans le formulaire                | Valider entier 1–65535, adresse, utilisateur et références au backend également                                        |
| Sessions          | Les ressources et les onglets sont partiellement couplés dans la sidebar                | Catalogue d’hôtes distinct ; supprimer un onglet conserve l’hôte                                                       |
| Authentification  | Processus OpenSSH dans un PTY ; secrets saisis dans le terminal                         | Garder ce chemin pour agent/clé et mot de passe non mémorisé                                                           |
| Secrets mémorisés | Interdits par les documents produit et confidentialité actuels                          | Ajouter un stockage sécurisé séparé si l’on veut retrouver ce confort de Termius                                       |
| État connecté     | `spawn_ssh_attempt` annonce `Connected` dès que le processus est lancé                  | Ne pas assimiler démarrage du client et authentification réussie                                                       |
| Reconnexion       | Le callback de sortie relance sans distinguer fin normale et panne                      | Propager le code de sortie, ne pas relancer après fermeture volontaire ou sortie normale ; annulation pendant le délai |

Fichiers concernés : `src/components/TargetDialog.vue`, `src/components/new-tab/SshTabPicker.vue`, `src/stores/app.ts`, `src/ipc/{client,types}.ts`, `src-tauri/src/domain/{mod,validation}.rs`, `src-tauri/src/service/{workspaces,organization}.rs`, `src-tauri/src/commands/terminal.rs`, `src-tauri/src/{ssh,pty,repository}.rs`.

## Architecture proposée

Conserver `Resource` comme hôte enregistré, `Identity` comme contexte d’authentification et la session comme état temporaire. Exposer des commandes `ssh_host_create`, `ssh_host_update`, `ssh_host_duplicate`, `ssh_host_delete` et des commandes CRUD pour les identités. La création peut référencer une identité existante ou en créer une au sein de la même mutation. Les références restent isolées par workspace. Une modification affecte les prochaines connexions et ne redémarre pas les sessions en cours.

Ajouter progressivement un nom explicite d’identité et un mode `agent`, `keyFile` ou `password`. La migration doit conserver les connexions existantes : un chemin de clé devient `keyFile`, les autres conservent la résolution OpenSSH. Les champs nouvellement persistés doivent disposer de valeurs par défaut Serde et l’import/export doit rester rétrocompatible.

Pour la mémorisation facultative des mots de passe et phrases de passe, SQLite ne contient qu’une référence opaque. Le secret est conservé dans le coffre du système (Keychain, Credential Manager, Secret Service). Un coffre absent ou verrouillé entraîne une demande interactive, jamais un enregistrement en clair. Les secrets ne figurent ni dans les snapshots, exports, logs, arguments de processus, ni dans l’état Pinia durable. Le backend est propriétaire de leur lecture et de leur suppression.

Le PTY OpenSSH actuel ne fournit pas une API structurée d’authentification. Avant la mémorisation des secrets, réaliser un prototype d’intégration : soit un mécanisme askpass maîtrisé, dont les requêtes et la portée sont vérifiées sur les trois OS, soit un moteur SSH embarqué exposant authentification, vérification de clé hôte et ouverture du shell. Ne pas détecter les demandes de mot de passe en analysant les textes du terminal : langue, bannières et keyboard-interactive rendent cela fragile. Le choix du moteur doit conserver une voie OpenSSH pour les alias et configurations système complexes.

## Ordre de livraison

1. **Hôtes réellement réutilisables** : catalogue accessible dans le sélecteur de type de Nouvel onglet, formulaire création/édition, duplication, recherche, identité existante ou nouvelle, mutation atomique et erreurs visibles. Agent/clé et mot de passe interactif fonctionnent sans cloud.
2. **Cycle de vie fiable** : distinguer processus démarré, authentification et session ouverte selon les capacités du moteur ; traiter sortie normale, interruption et reconnexion annulable ; autoriser plusieurs sessions indépendantes pour un hôte.
3. **Identifiants mémorisés** : prototype backend, coffre système, option explicite de mémorisation, saisie ponctuelle et oubli d’un secret. Mettre à jour `SECURITY.md`, `docs/PRIVACY.md` et `docs/PRODUCT.md` pour refléter le comportement livré.
4. **Organisation avancée** : groupes d’hôtes et héritage de configuration si nécessaire, en dehors des dossiers d’onglets existants. Import OpenSSH avec résolution effective par `ssh -G` et gestion correcte des alias multiples et Include.

Le lot 1 est le premier périmètre utile pour un usage personnel. Il ne constitue pas encore une parité complète avec Termius ; les fonctions adjacentes comme SFTP, tunnels et snippets nécessitent des lots séparés.

## Vérification à prévoir lors de l’implémentation

- Créer un hôte, relancer l’app et retrouver ses paramètres sans processus lancé.
- Modifier ou dupliquer un hôte sans modifier une session déjà ouverte ; fermer une session et conserver l’hôte.
- Réutiliser une identité dans un workspace ; refuser une référence vers un autre workspace.
- Échouer pendant une création sans laisser d’identité ou de nœud orphelin ; conserver le formulaire et son message d’erreur.
- Ouvrir deux sessions du même hôte, les fermer indépendamment et ne pas reconnecter après `exit`.
- Vérifier sur un serveur SSH de test : clé, agent, mot de passe, port personnalisé, empreinte inconnue et empreinte modifiée.
- Pour le lot coffre : tester coffre verrouillé/absent, suppression, export et absence du secret dans SQLite, logs et ligne de commande sur chaque OS pris en charge.

Les observations ci-dessus viennent d’une lecture du code ; aucune connexion réelle n’a été testée pendant cette recherche.
