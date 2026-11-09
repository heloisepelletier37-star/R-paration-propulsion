# AGENTS.md — Simulation « Réparation de la propulsion » (Mars)

## Contexte
Simulation pédagogique 3D dans le navigateur. Un astronaute seul sur Mars doit réparer le module de propulsion de son vaisseau. L'apprenant réalise lui-même chaque geste. Le cahier des charges complet est dans `docs/SPEC.md` : **lis-le avant toute tâche** et respecte-le à la lettre.

## Stack imposée
- Vite + JavaScript (ES modules), pas de TypeScript, pas de framework UI.
- Three.js (dernière version stable) avec `GLTFLoader`, `DRACOLoader`, `RGBELoader`, `OrbitControls`.
- Rendu : `MeshStandardMaterial`/PBR, `ACESFilmicToneMapping`, ombres activées, environnement HDRI.
- Audio : Web Audio API via `THREE.AudioListener` / `PositionalAudio`.
- Déploiement : GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`), `base` Vite = nom du dépôt.

## Organisation du code
```
index.html
src/
  main.js            # init renderer, scène, boucle
  scene/             # éclairage, environnement martien, caméra
  assets/loader.js   # chargement GLB + écran de chargement
  interactions/      # raycasting, drag, gestes (vissage, levier, câblage)
  steps/             # une étape = un fichier (step1-power.js ... step5-test.js)
  state/machine.js   # machine à états des étapes + journal d'erreurs
  ui/                # HUD, consignes, feedback, écran bilan
  audio/
public/models/       # fichiers .glb fournis par l'utilisatrice (ne pas modifier)
public/textures/  public/sounds/  public/hdri/
docs/SPEC.md
```

## Règles
- Toute la logique pédagogique passe par la machine à états (`state/machine.js`). Une étape ne peut pas être sautée.
- Les modèles 3D sont chargés par **nom de nœud** (voir la table des nœuds dans `docs/SPEC.md`). Si un nœud manque, afficher un avertissement console clair et utiliser un placeholder géométrique de même nom : la simulation doit toujours tourner, même sans les vrais modèles.
- Textes d'interface en français, tutoiement, phrases courtes.
- Tous les textes pédagogiques (messages d'Inès, intitulés de la checklist, explications d'erreur, indices, débriefing) sont regroupés dans un seul fichier `src/ui/textes.js`, pour que la conceptrice puisse les modifier sans toucher au code.
- Accessibilité : chaque interaction souris a un équivalent clavier ; contraste suffisant ; sous-titres pour l'audio.
- Performance : 60 fps visés sur un portable récent, `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Pas de dépendance hors npm, pas de clé API, pas de tracking.

## Vérifications avant de terminer une tâche
1. `npm install` puis `npm run build` sans erreur.
2. Aucune erreur dans la console au lancement (`npm run dev`).
3. Décrire dans la PR : ce qui a changé, comment le tester à la main, captures si visuel.
