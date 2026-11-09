# Mars — Réparer la propulsion

Une simulation pédagogique 3D en JavaScript, Vite et Three.js. La scène martienne et l’accompagnement pédagogique sont en place : accueil, deux modes, briefing, checklist, outils, indices et débriefing. Les gestes de réparation seront ajoutés ensuite ; des boutons de test permettent déjà de parcourir les cinq étapes.

## Lancer le projet

Prérequis : Node.js 24 LTS (voir `.nvmrc`) et npm.

```sh
npm ci
npm run dev
```

Ouvre l’adresse affichée par Vite. La configuration utilise un chemin relatif (`base: './'`) pour s’adapter à l’emplacement de publication.

```sh
npm test          # 22 tests : scène, machine à états et écriture progressive
npm run test:browser # Parcours fonctionnel dans Chromium ; lance son serveur Vite
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
- Accueil avec choix Entraînement / Évaluation et choix des signaux sonores.
- Messages d’Inès uniquement textuels, écrits progressivement, dans une zone en bas à droite distincte de la vue 3D. Aucun portrait, avatar ou silhouette.
- Checklist permanente avec les cinq étapes, leurs sous-étapes en Entraînement, progression et erreurs conservées jusqu’au bilan.
- Sept outils sélectionnables avec représentation en main, indices progressifs, relecture du briefing et débriefing final.

La caméra, la lampe, les outils et la validation sont verrouillés avant la fin du briefing. Les actions de réparation restent à développer : les boutons de test valident uniquement la progression des écrans et les positions provisoires de la scène.

## Accompagnement pédagogique

**Entraînement** : six messages obligatoires, checklist détaillée, rappel au début de chaque étape, explication constructive après chaque erreur et bouton Aide. Les trois niveaux d’aide proposent une piste, une consigne précise, puis une démonstration animée. Chaque consultation est comptée, même si la démonstration est revue. Après 30 secondes sans action sur une étape, Inès propose de l’aide sans consommer d’indice.

**Évaluation** : seul le premier message du briefing est affiché, puis la checklist présente les cinq titres. Aucun indice, rappel, retour d’erreur ou proposition d’aide n’est donné pendant le parcours. Les erreurs sont enregistrées et révélées au bilan final.

Le bouton **Briefing** permet de relire les messages à tout moment après le départ. Les actions et le chrono sont suspendus pendant cette relecture ; progression, outils et journal sont conservés. Le bouton **Suivant**, ou Espace, affiche d’abord le texte entier s’il est en cours d’écriture, puis permet d’avancer. La dernière confirmation est **Je suis prêt**. La préférence système « réduire les animations » affiche directement le texte complet.

Le bouton `−` réduit l’encadré d’Inès. Un nouveau message laisse l’encadré réduit et signale sa présence par une pastille clignotante et un libellé. Le liseré est bleu pour une consigne, vert pour une réussite et orange pour une erreur. Les lecteurs d’écran reçoivent le message complet en une seule annonce.

## Parcourir les étapes avant l’ajout des gestes

1. Choisir un mode et terminer son briefing.
2. Sélectionner un outil, consulter les indices en Entraînement et, si utile, utiliser **Simuler une erreur**.
3. Cliquer sur **Valider l’étape (test)** : toutes les sous-étapes courantes sont cochées et seule l’étape suivante est débloquée.
4. Après les cinq validations, parcourir le débriefing : réussites, erreurs avec règles à retenir, nombre d’indices et conclusion.
5. Utiliser **Recommencer** pour revenir à l’accueil avec un nouveau journal.

Ces validations sont explicitement enregistrées comme du debug. Elles ne prouvent pas la maîtrise des gestes et ne produisent pas de note. Les poses de la trappe, du disjoncteur et des voyants suivent la progression pour rendre le parcours visible.

## Commandes

| Action | Souris / tactile | Clavier |
| --- | --- | --- |
| Regarder | Glisser dans la vue | Focaliser la vue 3D, puis utiliser les flèches |
| Zoom limité | Molette | `+` et `−` dans la vue 3D |
| Recentrer | Bouton Recentrer | `R` |
| Lampe frontale | Bouton Lampe | `L` |
| Son de l’alarme | Bouton Son | `Tab` pour le sélectionner, puis `Entrée` ou `Espace` |
| Choisir un outil | Bouton de la ceinture | `1` à `7`, ou `Tab` puis `Entrée` |
| Poser l’outil | Bouton Poser l’outil | `Échap` |
| Lire le message suivant | Bouton dans l’encadré d’Inès | `Espace` ou activation du bouton au clavier |

Les commandes de vue et d’outils ne sont disponibles qu’après le briefing. Les futurs gestes `Q` et `E` sont présentés en démonstration ; ils ne sont pas encore actifs.

## Organisation

- `src/main.js` : initialisation et boucle de rendu.
- `src/scene/` : terrain, atmosphère, coque, caméra et clignotement.
- `src/assets/manifest.js` : les **43 noms de nœuds** de la section 6 du cahier des charges.
- `src/assets/placeholders.js` : géométries, hiérarchies et pivots provisoires.
- `src/assets/loader.js` : GLTFLoader, DRACOLoader, RGBELoader et secours par nœud.
- `src/state/machine.js` : transitions, verrouillage, messages, erreurs, indices et temps actif.
- `src/state/procedure.js` : identifiants des cinq étapes, sous-étapes, outils et projection de l’état.
- `src/ui/textes.js` : textes modifiables de l’interface et des étiquettes.
- `src/interactions/`, `src/steps/` : emplacements réservés aux prochaines tâches.
- `public/models/`, `public/sounds/`, `public/hdri/`, `public/textures/` : futurs fichiers locaux.

Les consignes existantes portent actuellement le nom `AGENTS (1).md`. Les spécifications se trouvent dans `SPEC.md` et `docs/Spec.md` (attention à la casse sous Linux).

### Brancher les futurs gestes

Les gestes devront émettre des événements vers `createMachine()` :

- `COMPLETE_SUBSTEP` avec `stepId` et `substepId` coche une sous-étape de l’étape courante.
- `VALIDATE_STEP` avec `stepId` ne passe à la suite que si toutes ses sous-étapes sont terminées.
- `RECORD_ERROR` avec `stepId` et `code` ajoute une erreur connue du catalogue de `src/ui/textes.js`.
- `ACTIVITY` réarme le délai d’inactivité ; les sélections d’outils et les actions de l’interface le font déjà.

Les validations d’une autre étape, les événements périmés et les actions pendant le briefing sont refusés par la machine, indépendamment de l’état des boutons. Les snapshots sont immuables.

### Vérifications navigateur

`npm run test:browser` utilise Chrome ou Chromium déjà installé et démarre puis arrête son propre serveur sur le port 5199. Si nécessaire, préciser le navigateur :

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Le parcours vérifie les deux modes, les verrouillages, les outils, les trois indices, les erreurs, la relecture, les cinq étapes, le débriefing et l’absence de chevauchement entre la radio et la vue 3D sur petit écran. Il enregistre les captures sous `.artifacts/` (ignoré par Git).

Captures de référence : [accueil](docs/screenshots/accueil.png), [accompagnement](docs/screenshots/accompagnement.png), [petit écran](docs/screenshots/accompagnement-mobile.png).

Pour tester le build compilé, lancer `npm run preview` dans un premier terminal, puis fournir son adresse au test depuis un second terminal :

```sh
npm run test:browser -- http://127.0.0.1:4173/
```

## Ajouter les vrais modèles plus tard

Dépose les fichiers GLB dans `public/models/`, avec les noms et pivots indiqués dans la section 6 de `SPEC.md`. Les pièces mobiles doivent rester des nœuds séparés. Les fichiers sont utilisés tels quels, sans modification.

Redémarre Vite après avoir ajouté un fichier public facultatif, ou relance le build. La configuration détecte les fichiers présents, ce qui évite des requêtes 404 quand ils sont absents. Un fichier absent ou illisible conserve les géométries provisoires ; chaque nœud manquant est signalé par un avertissement explicite dans la console. La scène démarre sans aucun modèle fourni. Les décodeurs Draco proviennent du paquet npm Three.js et sont inclus dans le build, sans CDN.

Le faisceau est placé derrière la trappe fermée : ses bornes ne sont pas censées être visibles avant l’ouverture. La hiérarchie permet déjà de faire pivoter `Hatch_Hinge` autour de son bord gauche, avec la trappe et ses vis. Chaque vis a son pivot au centre de la tête et un axe local Z. Le capot et le levier ont leurs pivots en haut et à la base, respectivement.

Un HDRI facultatif peut être ajouté sous `public/hdri/mars_sky.hdr`. En son absence, le ciel et l’environnement de réflexion sont générés localement. Aucun téléchargement extérieur ni clé API n’est nécessaire pour jouer la scène.

## GitHub Pages

Le workflow `.github/workflows/deploy.yml` installe les dépendances avec `npm ci`, exécute les tests, compile puis publie `dist/` à chaque push sur `main`. Il peut aussi être lancé manuellement. Dans GitHub, sélectionner **Settings → Pages → Source → GitHub Actions** avant le premier déploiement.

Le `base` Vite relatif (`./`) conserve la configuration de `main`. Les ressources compilées sont référencées relativement au site, ce qui permet de publier sous le chemin du dépôt sans imposer le nom `simulation-mars`. Une compilation locale réussie ne valide pas le déploiement distant ; le workflow n’est pas exécuté par une commande de build locale.

Les fichiers présents dans `dist/` sont générés et ne doivent pas être commités.

## Checklist avant l’ajout des gestes

- [ ] `npm ci`, `npm test` et `npm run build` réussissent.
- [ ] La scène démarre via `npm run dev` sans erreur de console ; les avertissements « géométries provisoires » sont attendus.
- [ ] Le sol, les roches, le ciel, le soleil et la poussière sont visibles.
- [ ] La trappe, ses quatre vis, la vis de sécurité, le boîtier et les outils sont repérables.
- [ ] Le voyant rouge clignote à 1 Hz ; la LED verte reste allumée.
- [ ] La vue respire légèrement ; glisser ou utiliser les flèches ne déplace pas l’astronaute et reste limité.
- [ ] Le zoom reste limité, `R` recentre et `L` commande la lampe ; les boutons fonctionnent au clavier.
- [ ] Le son démarre uniquement à la demande et peut être coupé.
- [ ] La scène fonctionne sans GLB ni HDRI ; les 43 nœuds restent présents une seule fois.
- [ ] Le build servi avec `npm run preview` fonctionne à l’adresse affichée par Vite.
- [ ] Avant publication : la source Pages est GitHub Actions et les ressources relatives se chargent à l’adresse du site.
- [ ] L’accueil propose les deux modes et garde les commandes de mission verrouillées.
- [ ] Les six messages d’Entraînement sont parcourus avant de pouvoir choisir un outil ou valider une étape.
- [ ] La relecture suspend les actions et le chrono sans effacer le journal.
- [ ] Les indices progressent jusqu’à la démonstration et sont comptés ; l’inactivité propose une aide sans la compter.
- [ ] Les erreurs restent visibles dans la checklist après une réussite et sont expliquées au bilan.
- [ ] En Évaluation : un seul message initial, cinq titres, aucune aide ni retour intermédiaire.
- [ ] Les cinq validations successives conduisent au débriefing, puis Recommencer réinitialise le parcours.

Les résultats d’une validation dans Chromium avec un GPU logiciel ne garantissent pas 60 images/s sur toutes les machines. Chrome, Firefox et Edge restent à vérifier sur les postes ciblés avant la livraison finale.
