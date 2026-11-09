# Mars — Réparer la propulsion

Une simulation pédagogique 3D en JavaScript, Vite et Three.js. Cette première étape installe le projet et son environnement visuel. Les gestes de réparation, le briefing interactif, la checklist de progression et le bilan seront ajoutés aux étapes suivantes.

## Lancer le projet

Prérequis : Node.js 24 LTS (voir `.nvmrc`) et npm.

```sh
npm ci
npm run dev
```

Ouvre l’adresse affichée par Vite, au chemin `/simulation-mars/`.

```sh
npm test          # Contrats des 43 nœuds, pivots, secours, alarme et caméra
npm run build    # Produit le site statique dans dist/
npm run preview  # Sert le build compilé, au même chemin
```

Dans le sandbox cloud, utilise si nécessaire un cache accessible :

```sh
export npm_config_cache=/workspace/.environment/npm-cache
```

## Ce qui fonctionne à cette étape

- Sol ocre avec relief léger, cailloux, ciel rose-orangé, soleil rasant, ombres et poussière.
- Vue fixe à la hauteur d’un astronaute agenouillé, avec légère respiration. La rotation et le zoom sont limités : la caméra ne tourne pas autour du vaisseau.
- Trappe, quatre vis cruciformes, vis centrale de sécurité, boîtier électrique, capot, levier, LED verte, alarme rouge à 1 Hz, bornes et outils provisoires.
- Lampe frontale et bip d’alarme facultatif. Le son ne démarre qu’après activation volontaire.
- Interface française, navigation clavier et respect de la préférence « réduire les animations » pour la respiration et la poussière.

Les réparations restent verrouillées pendant ce repérage. Aucun clic sur la trappe ou le levier ne fait avancer la procédure. Ce n’est pas encore une simulation jouable de bout en bout.

## Commandes

| Action | Souris / tactile | Clavier |
| --- | --- | --- |
| Regarder | Glisser dans la vue | Focaliser la vue 3D, puis utiliser les flèches |
| Zoom limité | Molette | `+` et `−` dans la vue 3D |
| Recentrer | Bouton Recentrer | `R` |
| Lampe frontale | Bouton Lampe | `L` |
| Son de l’alarme | Bouton Son | `Tab` pour le sélectionner, puis `Entrée` ou `Espace` |

## Organisation

- `src/main.js` : initialisation et boucle de rendu.
- `src/scene/` : terrain, atmosphère, coque, caméra et clignotement.
- `src/assets/manifest.js` : les **43 noms de nœuds** de la section 6 du cahier des charges.
- `src/assets/placeholders.js` : géométries, hiérarchies et pivots provisoires.
- `src/assets/loader.js` : GLTFLoader, DRACOLoader, RGBELoader et secours par nœud.
- `src/state/machine.js` : état initial de repérage ; les futures étapes y seront centralisées.
- `src/ui/textes.js` : textes modifiables de l’interface et des étiquettes.
- `src/interactions/`, `src/steps/` : emplacements réservés aux prochaines tâches.
- `public/models/`, `public/sounds/`, `public/hdri/`, `public/textures/` : futurs fichiers locaux.

Les consignes existantes portent actuellement le nom `AGENTS (1).md`. Les spécifications se trouvent dans `SPEC.md` et `docs/Spec.md` (attention à la casse sous Linux).

## Ajouter les vrais modèles plus tard

Dépose les fichiers GLB dans `public/models/`, avec les noms et pivots indiqués dans la section 6 de `SPEC.md`. Les pièces mobiles doivent rester des nœuds séparés. Les fichiers sont utilisés tels quels, sans modification.

Redémarre Vite après avoir ajouté un fichier public facultatif, ou relance le build. La configuration détecte les fichiers présents, ce qui évite des requêtes 404 quand ils sont absents. Un fichier absent ou illisible conserve les géométries provisoires ; chaque nœud manquant est signalé par un avertissement explicite dans la console. La scène démarre sans aucun modèle fourni. Les décodeurs Draco proviennent du paquet npm Three.js et sont inclus dans le build, sans CDN.

Le faisceau est placé derrière la trappe fermée : ses bornes ne sont pas censées être visibles avant l’ouverture. La hiérarchie permet déjà de faire pivoter `Hatch_Hinge` autour de son bord gauche, avec la trappe et ses vis. Chaque vis a son pivot au centre de la tête et un axe local Z. Le capot et le levier ont leurs pivots en haut et à la base, respectivement.

Un HDRI facultatif peut être ajouté sous `public/hdri/mars_sky.hdr`. En son absence, le ciel et l’environnement de réflexion sont générés localement. Aucun téléchargement extérieur ni clé API n’est nécessaire pour jouer la scène.

## GitHub Pages

Le workflow `.github/workflows/deploy.yml` installe les dépendances avec `npm ci`, exécute les tests, compile puis publie `dist/` à chaque push sur `main`. Il peut aussi être lancé manuellement. Dans GitHub, sélectionner **Settings → Pages → Source → GitHub Actions** avant le premier déploiement.

**Le chemin Vite est fixé à `/simulation-mars/`, conformément à la demande.** Pour un site Pages de projet, ce chemin suppose un dépôt appelé `simulation-mars`. Le dépôt actuel s’appelle `R-paration-propulsion` : il faudra donc le renommer ou convenir d’un changement de `base` avant une publication utilisable à son adresse Pages standard. Une compilation locale réussie ne valide pas cette configuration distante. Le workflow n’est pas exécuté par une commande de build locale.

Les fichiers présents dans `dist/` sont générés et ne doivent pas être commités.

## Checklist avant l’étape 2

- [ ] `npm ci`, `npm test` et `npm run build` réussissent.
- [ ] La scène démarre via `npm run dev` sans erreur de console ; les avertissements « géométries provisoires » sont attendus.
- [ ] Le sol, les roches, le ciel, le soleil et la poussière sont visibles.
- [ ] La trappe, ses quatre vis, la vis de sécurité, le boîtier et les outils sont repérables.
- [ ] Le voyant rouge clignote à 1 Hz ; la LED verte reste allumée.
- [ ] La vue respire légèrement ; glisser ou utiliser les flèches ne déplace pas l’astronaute et reste limité.
- [ ] Le zoom reste limité, `R` recentre et `L` commande la lampe ; les boutons fonctionnent au clavier.
- [ ] Le son démarre uniquement à la demande et peut être coupé.
- [ ] La scène fonctionne sans GLB ni HDRI ; les 43 nœuds restent présents une seule fois.
- [ ] Le build servi avec `npm run preview` fonctionne sous `/simulation-mars/`.
- [ ] Avant publication : la source Pages est GitHub Actions et le chemin public correspond au `base` demandé.

Les résultats d’une validation dans Chromium avec un GPU logiciel ne garantissent pas 60 images/s sur toutes les machines. Chrome, Firefox et Edge restent à vérifier sur les postes ciblés avant la livraison finale.
