# 001 — Rendre l’aperçu latéral plus ample et plus réactif

- **Status**: DONE
- **Commit**: 13dfd56
- **Severity**: HIGH
- **Category**: Purpose & frequency, easing & duration, physicality & origin
- **Estimated scope**: 3 files, environ 70 lignes

## Problem

L’aperçu de la barre latérale cachée est déclenché par une bande invisible de
20 px, puis parcourt toute sa largeur en seulement 100 ms. Le panneau reste en
outre collé aux limites verticales de la zone de contenu. L’ensemble donne une
interaction difficile à viser, abrupte et insuffisamment distincte de la barre
latérale épinglée.

```vue
<!-- src/App.vue:243-259 — current -->
<div
  class="absolute inset-y-0 start-0 z-40"
  :style="{ width: store.sidebarPeek ? `${sidebarWidth}px` : '20px' }"
  :aria-hidden="store.sidebarPeek ? undefined : 'true'"
  @pointerenter="scheduleReveal"
  @pointerleave="scheduleHide"
>
  <Transition
    enter-active-class="transition-[translate,opacity] duration-100 ease-out"
    enter-from-class="-translate-x-full opacity-0"
    leave-active-class="transition-[translate,opacity] duration-100 ease-out"
    leave-to-class="-translate-x-full opacity-0"
  >
    <div
      v-if="store.sidebarPeek"
      class="h-full overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl"
      :style="{ width: `${sidebarWidth}px` }"
    >
```

La préférence par défaut n’accorde que 50 ms entre l’entrée du pointeur et
l’ouverture, sans aucun retour visuel pendant cette attente :

```ts
// src/lib/preferences.ts:29-35 — current
const fallback: LocalPreferences = {
  cursorStyle: 'bar',
  cursorBlink: true,
  screenReaderMode: false,
  sidebarRevealDelay: 50,
  sidebarHideDelay: 300,
```

## Target

- Détacher l’overlay de **4 px des bords haut, bas et gauche** de la fenêtre.
  Le conteneur principal possède `px-2` (8 px) dans `src/App.vue:202`. La zone
  d’activation reste au bord de fenêtre tandis que le panneau reçoit
  `inset-y-1 start-1`, ce qui le place à 4 px du bord et lui fait surplomber de
  4 px le début du contenu.
- Porter la zone d’activation cachée à **32 px**, sans changer la largeur
  visible de la sidebar.
- Révéler le panneau après **100 ms**, sans indicateur intermédiaire susceptible
  de produire un clignotement visuel.
- Faire entrer le panneau depuis `translateX(-12px)` et `opacity: 0` pendant
  **200 ms** avec la courbe drawer
  `cubic-bezier(0.32, 0.72, 0, 1)`. Il doit repartir en **160 ms** avec la même
  courbe. Ne plus le faire parcourir `-100%` de sa largeur.
- Conserver l’interruptibilité via `<Transition>` et des transitions CSS.
- En réduction de mouvement, supprimer la transition et le déplacement,
  conformément à `docs/TECHNICAL.md`.

Structure cible (les classes peuvent être réparties lisiblement, mais les
valeurs ne doivent pas changer) :

```vue
<div
  class="absolute inset-y-0 start-0 z-40"
  :style="{ width: store.sidebarPeek ? `${sidebarWidth + 4}px` : '32px' }"
  :aria-hidden="store.sidebarPeek ? undefined : 'true'"
  @pointerenter="scheduleReveal"
  @pointerleave="scheduleHide"
>
  <Transition
    enter-active-class="transition-[transform,opacity] duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
    enter-from-class="-translate-x-3 opacity-0 motion-reduce:translate-x-0"
    leave-active-class="transition-[transform,opacity] duration-160 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
    leave-to-class="-translate-x-3 opacity-0 motion-reduce:translate-x-0"
  >
    <div
      v-if="store.sidebarPeek"
      class="absolute inset-y-1 start-1 overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl"
      :style="{ width: `${sidebarWidth}px` }"
    >
```

## Repo conventions to follow

- Le shell de sidebar et son mode temporaire sont volontairement centralisés
  dans `src/App.vue:190-283`; ne déplacer ni l’état ni les timers vers
  `AppSidebar.vue`.
- Les animations d’interface emploient déjà des propriétés ciblées et
  `motion-reduce`, par exemple
  `src/components/sidebar/AppSidebar.vue:100-110` utilise
  `transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none`.
- La zone de contenu utilise `gap-2 px-2 pb-2` dans `src/App.vue:202`. Les 4 px
  de détachement doivent être calculés par rapport à cette géométrie existante,
  pas par un nouveau wrapper.
- Ne pas introduire de bibliothèque de motion : Vue `<Transition>` et Tailwind
  suffisent.

## Steps

1. Dans `src/App.vue:243`, conserver la zone d’activation sur
   `inset-y-0 start-0`, puis positionner le panneau interne avec
   `absolute inset-y-1 start-1`.
2. Dans `src/App.vue:245`, remplacer la largeur cachée `20px` par `32px`.
   Garder exactement `sidebarWidth` lorsque `sidebarPeek` est vrai afin que la
   préférence utilisateur reste la source de vérité.
3. Ne pas ajouter d’indicateur intermédiaire dans la zone d’activation : le
   panneau est le seul retour visuel.
4. Dans `src/App.vue:250-255`, remplacer la translation en pourcentage et le
   timing de 100 ms par les quatre classes d’entrée/sortie exactes de la cible.
   Utiliser `transform` plutôt que la propriété CSS indépendante `translate`.
5. Vérifier que le resize handle de `src/App.vue:264-281` reste au bord droit
   du panneau ouvert et que son `@pointerenter="scheduleReveal"` est conservé.
6. Dans `src/lib/preferences.ts:33`, passer la valeur de repli
   `sidebarRevealDelay` de `50` à `100`. Ne pas écraser les préférences déjà
   enregistrées : seules les nouvelles installations ou préférences
   réinitialisées doivent prendre cette valeur.
7. Ajouter un test Playwright dans `e2e/sidebar.spec.ts` qui cache la sidebar
   via le store, place le pointeur à `x = 12` au milieu de la zone de contenu,
   attend l’overlay, puis vérifie que sa boîte est à 4 px du bord gauche de la
   fenêtre et à 4 px des limites verticales de la zone principale (tolérance de
   1 px). Vérifier également qu’un pointeur à `x = 28` active l’overlay, ce qui
   protège la nouvelle cible de 32 px.

## Boundaries

- Ne pas modifier `src/components/sidebar/AppSidebar.vue` ni les composants de
  contenu de la sidebar.
- Ne pas changer le comportement épinglé, sa largeur, ni le redimensionnement.
- Ne pas changer `sidebarHideDelay` (300 ms).
- Ne pas ajouter de dépendance ni de nouveau composable.
- Ne pas animer `width`, `left`, `margin` ou `padding` pendant l’entrée/sortie.
- Si la géométrie de `src/App.vue:202-283` diffère du commit `13dfd56`, arrêter
  et signaler la dérive plutôt que d’improviser.

## Verification

- **Mechanical** : exécuter `pnpm typecheck`, `pnpm lint`, `pnpm test`, puis
  `pnpm test:e2e -- e2e/sidebar.spec.ts`. Chaque commande doit sortir avec le
  code 0.
- **Feel check** : utiliser l’environnement Jean déjà démarré (appeler d’abord
  `get_run_environments`; ne jamais lancer un serveur de développement),
  masquer la sidebar puis confirmer :
  - le pointeur est capté jusqu’à 32 px depuis le bord gauche ;
  - le panneau apparaît après 100 ms sans indicateur ni clignotement préalable ;
  - le panneau est séparé de 4 px en haut, en bas et à gauche et recouvre
    visuellement de 4 px la marge intérieure de 8 px du layout ;
  - l’entrée part seulement de 12 px vers la gauche, sans balayage brutal sur
    toute la largeur ;
  - quitter puis rentrer rapidement ne fait ni clignoter ni repartir le panneau
    depuis `-100%`.
  - Dans DevTools, régler la lecture des animations à 10 % et confirmer que le
    panneau décélère jusqu’à sa position finale sans rebond.
  - Activer `prefers-reduced-motion: reduce` dans le panneau Rendering et
    confirmer que le panneau apparaît sans transition ni translation.
- **Done when** : la géométrie 4/32 px est couverte par Playwright, tous les
  contrôles mécaniques passent, et l’aperçu paraît immédiatement ciblable sans
  déplacer ni recalculer le terminal.
