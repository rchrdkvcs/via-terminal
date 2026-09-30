# Gestion SSH inspirée de Termius, entièrement locale

Recherche effectuée le 30 septembre 2026 dans la documentation officielle Termius. Cette note décrit les comportements observables, puis les choix proposés pour Via. Elle ne prétend pas reproduire l'implémentation interne de Termius.

## Ce que documente Termius

- **Hôte enregistré** : sur desktop, `Vault > Hosts > New Host`, saisir adresse, port, utilisateur et mot de passe, puis `Connect`. L'hôte est automatiquement enregistré. Pour une clé, le même formulaire permet d'importer ou coller une clé privée, de lui donner un nom et de la sauvegarder. [Connecting to a server](https://docs.termius.com/organize-and-connect-to-hosts/connecting-to-a-server)
- **Machine et session sont distinctes** : un Host décrit une machine, ses labels/tags et paramètres de protocoles. Le terminal représente la connexion active. Enregistrer un hôte permet de réutiliser ses paramètres. [What is Termius](https://docs.termius.com/getting-started/what-is-termius)
- **Identités réutilisables** : une Identity associe utilisateur, mot de passe et clé. Plusieurs hôtes ou groupes peuvent référencer la même identité, sans duplication des credentials. Le formulaire d'hôte permet de la sélectionner depuis le champ utilisateur. [Identities](https://docs.termius.com/keychain/identities)
- **Groupes** : groupes imbriqués, déplacement par formulaire ou drag and drop, et tags transversaux. Les paramètres sont hérités des parents, paramètre par paramètre, sauf override explicite. L'écran d'un groupe inclut aussi les hôtes de ses sous-groupes. [Groups and tags](https://docs.termius.com/organize-and-connect-to-hosts/groups-and-tags)
- **Trousseau** : import de clés depuis fichier ou presse-papiers, génération de clés, passphrase facultativement mémorisée et export de la clé publique vers `authorized_keys`. [SSH keys and certificates](https://docs.termius.com/keychain/ssh-keys-and-certificates)
- **Connexions avancées** : sélection de plusieurs jump hosts constituant une host chain, proxy HTTP/SOCKS5, agent forwarding. Termius utilise son propre agent SSH. [Connecting to a server](https://docs.termius.com/organize-and-connect-to-hosts/connecting-to-a-server)

## Local et cloud : nuance importante

La page commerciale propose un **Local vault** dans Starter et un **Personal cloud vault** avec synchronisation dans Pro. [Pricing](https://termius.com/pricing)

La documentation distingue cela du bouton `Sync keys and identities` : celui-ci garde seulement les credentials localement ; hosts, groups et autres données restent synchronisés avec un compte. Elle indique aussi que la déconnexion du compte efface les données locales, y compris les credentials non synchronisés. Pour respecter la demande utilisateur, Via doit avoir une persistance locale autonome, sans compte ni service de synchronisation ; copier ce bouton ne suffirait pas. [Sync of keys and passwords](https://docs.termius.com/keychain/sync-of-keys-and-passwords)

## Proposition pour Via

Ces recommandations sont des choix d'implémentation, pas des affirmations sur Termius.

### Première livraison utilisable

1. Rendre explicite l'enregistrement d'une connexion SSH : nom, hostname/IP, port (22 par défaut), utilisateur, identité ou fichier de clé, organisation dans le workspace actif.
2. Offrir `Enregistrer` et `Enregistrer et connecter`, puis `Modifier`, `Dupliquer`, `Supprimer` et `Connecter` depuis la connexion sauvegardée. Le libellé de connexion reste indépendant du nom du tab runtime.
3. Réutiliser une identité entre plusieurs connexions du même workspace et refléter ses mises à jour au prochain lancement SSH.
4. Restaurer les connexions et leur organisation au redémarrage, sans relancer des connexions réseau automatiquement.
5. Distinguer un alias importé de `~/.ssh/config` d'un hôte défini dans Via. Ne pas réécrire la configuration utilisateur.
6. Garantir une validation identique côté frontend et backend : adresse requise, port 1–65535, références d'identités appartenant au workspace, valeurs passées à SSH comme arguments et non chaîne shell.

### Écart à traiter pour une parité authentification

L'[ADR OpenSSH](adr/0002-system-openssh-for-v1.md) actuel interdit l'interception et la sauvegarde des mots de passe ; [PRIVACY](PRIVACY.md) exclut mots de passe, passphrases et contenus des clés. Une simple fiche d'hôte avec un chemin de clé et un agent système peut livrer les connexions enregistrées, mais ne constitue pas la parité Termius pour les mots de passe mémorisés.

Pour cette parité, prévoir une évolution explicite : stockage des secrets dans le trousseau natif de l'OS (ou coffre local chiffré dont la clé est protégée par l'OS), références opaques dans SQLite, exports sans secrets, suppression du secret lors de sa suppression métier, et flux d'authentification structuré compatible avec OpenSSH. Ne pas injecter les mots de passe dans les arguments, variables d'environnement ou l'historique du terminal ; ne pas analyser arbitrairement le texte PTY pour répondre aux prompts. Le choix entre un pont `SSH_ASKPASS` correctement isolé et un moteur SSH embarqué nécessite une étude et des tests multiplateformes.

### Suite vers la parité organisationnelle

Les folders Via limités à un niveau ne sont pas équivalents aux groupes Termius. Une étape suivante devrait introduire des groupes hiérarchiques avec defaults et overrides explicites, recherche par noms/adresses/tags et affichage des valeurs héritées. Host chains, proxies, génération/import de clés privées et SFTP constituent des étapes distinctes ; ils ne doivent pas être présentés comme déjà livrés par la première étape.

## Critères d'acceptation

- Créer une connexion, fermer Via et la retrouver avec les mêmes paramètres.
- Connecter plusieurs fois un hôte sauvegardé sans ressaisir adresse/port/utilisateur.
- Modifier une identité partagée et vérifier les paramètres du prochain lancement de chaque hôte lié.
- Refuser les ports invalides et références vers un autre workspace, y compris via l'API native.
- Ouvrir un hôte importé avec la configuration OpenSSH existante et conserver les prompts de vérification d'empreinte.
- Exporter l'organisation sans secret et sans contenu de terminal.
- Si les mots de passe mémorisés sont implémentés ultérieurement, vérifier coffre verrouillé/absent, suppression, échec d'authentification, prompts interactifs, et absence de secrets dans SQLite, diagnostics, argv et exports.
