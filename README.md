# Mars — Réparer la propulsion

Une simulation pédagogique 3D en JavaScript, Vite et Three.js. Les deux premières étapes se réalisent dans la scène : mise hors tension, quatre vis à dévisser et trappe à tirer. Un contact sous tension, un mauvais tournevis ou une tentative sur la vis de sécurité ont des conséquences visibles et sont consignés. Les boutons de test permettent de parcourir les trois étapes suivantes, dont les gestes restent à développer.

## Lancer le projet

Prérequis : Node.js 24 LTS (voir `.nvmrc`) et npm.

```sh
npm ci
npm run dev
```

Ouvre l’adresse affichée par Vite. La configuration utilise un chemin relatif (`base: './'`) pour s’adapter à l’emplacement de publication.

```sh
npm test          # 51 tests : scène, progression, sécurité, dévissage, trappe et écriture
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
- Capot animé en 0,4 seconde et levier à glisser au-delà de 70 % ; retour automatique si le geste est insuffisant ou annulé.
- Choc électrique au contact d’un tournevis avec la trappe sous tension : étincelle, flash, décharge sonore, secousse, alerte et erreur consignée.
- Quatre tours antihoraires par vis, rotation et recul en 3D, conservation des quatre vis et compteur dans le HUD.
- Dérapage sonore, mouvement de l’outil et rayure avec le mauvais tournevis ; vis centrale protégée et tentatives consignées.
- Ouverture de la trappe sur sa charnière jusqu’à 110°, avec inertie, uniquement après le retrait des quatre vis.

La caméra, la lampe, les outils et la validation sont verrouillés avant la fin du briefing. Les deux premières étapes ne peuvent pas être validées par debug. Les trois suivantes conservent leurs boutons de test.

## Étape 1 — Mise hors tension

1. Terminer le briefing, puis cliquer sur le capot rouge du boîtier électrique. Il se relève en 0,4 seconde ; le levier est bloqué pendant cette animation.
2. Saisir le levier et le glisser vers le bas. **Dépasser 70 % de la course avant de relâcher.** Un relâchement à 70 % exactement ou avant fait revenir le levier sans ajouter d’erreur.
3. Une coupure réussie déclenche un clac, éteint la LED verte et affiche `Tension : OFF`. Le voyant rouge continue de clignoter sur sa batterie, sans bip. La checklist valide automatiquement les deux sous-étapes et passe à l’ouverture de la trappe.

Pendant le glissement, la caméra reste stable. Échap, une perte de capture du pointeur, un changement de fenêtre ou la relecture du briefing annulent le geste sans couper le courant.

**Au clavier** : ouvrir « Commandes au clavier », activer « Relever le capot rouge », puis focaliser le levier avec Tab. Maintenir `↓` pour le faire descendre et relâcher après 70 % ; `↑` le remonte, `Fin` atteint la course complète et `Échap` annule.

**Choc électrique** : sélectionner un tournevis cruciforme ou plat, puis toucher la trappe ou une de ses vis alors que le circuit est sous tension. Un seul contact déclenche les effets et une erreur dans le journal, puis remet la procédure à l’étape 1. Le court délai de récupération empêche un même contact tenu de compter plusieurs erreurs. Le bouton « Toucher la trappe avec le tournevis » offre le même contact au clavier. Une trappe hors tension ne provoque aucune décharge.

En Évaluation, l’alerte physique de sécurité reste visible, mais Inès ne donne pas d’explication intermédiaire et le journal détaillé n’apparaît qu’au bilan. Les sons respectent le choix Son ; la préférence « réduire les animations » supprime la secousse et le flash animé.

## Étape 2 — Dévissage et ouverture

1. Couper le courant, puis choisir le **tournevis cruciforme** dans la ceinture.
2. Maintenir le clic sur une vis d’angle, puis décrire des cercles **antihoraires autour de son centre**. Le cercle pointillé repère la vis sélectionnée. Quatre tours complets sont nécessaires ; chaque tour fait sortir la vis d’un quart de sa course. On peut relâcher et reprendre sans perdre le travail.
3. Répéter sur les quatre vis d’angle. Une vis retirée disparaît de la trappe et rejoint le compteur **Vis conservées : 0 / 4 → 4 / 4**. La vis centrale reste en place.
4. Saisir le **bord droit de la trappe**, puis le tirer vers la gauche de l’écran jusqu’à l’ouverture complète. La trappe pivote vers l’astronaute sur sa charnière gauche. Relâcher : elle termine son mouvement avec inertie, puis l’étape 3 s’active automatiquement.

Le tournevis plat dérape : son, léger mouvement de l’outil, rayure persistante et erreur consignée avec le nom de la vis. Une tentative sur la vis centrale est également consignée, sans la retirer. Tourner dans le sens horaire bloque le mouvement avec un son sourd et le rappel « Antihoraire pour dévisser » en Entraînement ; ce blocage n’ajoute pas d’erreur. Refaire le même arc à l’envers ne permet pas d’accumuler artificiellement des tours.

La trappe reste retenue tant qu’une des quatre vis n’est pas retirée. Un glissement partiel laisse la trappe entrouverte sans valider l’étape. Échap, une perte de capture, un changement de fenêtre ou la relecture du briefing annulent le glissement courant et restaurent sa position précédente. Les tours déjà effectués sur les vis restent acquis. La caméra est immobilisée pendant les gestes.

**Au clavier** : ouvrir « Commandes au clavier — trappe », sélectionner une vis et maintenir **Q**, y compris sur AZERTY (environ un tour par seconde). Relâcher pour faire une pause. Après les quatre vis, focaliser le curseur d’ouverture : **←** tire la trappe, **→** la repousse, **Fin** ouvre complètement et **Échap** annule le glissement. On peut aussi cliquer une vis dans la scène puis maintenir Q.

En Évaluation, les effets physiques et le compteur restent visibles ; les explications et erreurs détaillées sont réservées au bilan. Les sons suivent le réglage Son. La préférence de réduction des animations supprime le mouvement décoratif de dérapage de l’outil.

## Accompagnement pédagogique

**Entraînement** : six messages obligatoires, checklist détaillée, rappel au début de chaque étape, explication constructive après chaque erreur et bouton Aide. Les trois niveaux d’aide proposent une piste, une consigne précise, puis une démonstration animée. Chaque consultation est comptée, même si la démonstration est revue. Après 30 secondes sans action sur une étape, Inès propose de l’aide sans consommer d’indice.

**Évaluation** : seul le premier message du briefing est affiché, puis la checklist présente les cinq titres. Aucun indice, rappel, explication pédagogique ou proposition d’aide n’est donné pendant le parcours. Les effets physiques et les compteurs restent visibles. Les erreurs sont enregistrées et détaillées au bilan final.

Le bouton **Briefing** permet de relire les messages à tout moment après le départ. Les actions et le chrono sont suspendus pendant cette relecture ; progression, outils et journal sont conservés. Le bouton **Suivant**, ou Espace, affiche d’abord le texte entier s’il est en cours d’écriture, puis permet d’avancer. La dernière confirmation est **Je suis prêt**. La préférence système « réduire les animations » affiche directement le texte complet.

Le bouton `−` réduit l’encadré d’Inès. Un nouveau message laisse l’encadré réduit et signale sa présence par une pastille clignotante et un libellé. Le liseré est bleu pour une consigne, vert pour une réussite et orange pour une erreur. Les lecteurs d’écran reçoivent le message complet en une seule annonce.

## Parcourir les étapes encore provisoires

1. Choisir un mode et terminer son briefing.
2. Réaliser la mise hors tension, retirer les quatre vis et tirer la trappe. En Entraînement, les indices et **Simuler une erreur** permettent aussi de tester les retours pédagogiques.
3. Pour les étapes 3 à 5, cliquer sur **Valider l’étape (test)** : leurs sous-étapes sont cochées et seule l’étape suivante est débloquée.
4. Après les cinq validations, parcourir le débriefing : réussites, erreurs avec règles à retenir, nombre d’indices et conclusion.
5. Utiliser **Recommencer** pour revenir à l’accueil avec un nouveau journal.

Les deux premières validations sont enregistrées comme des gestes ; les trois suivantes sont identifiées comme du debug. Le parcours ne produit pas encore de note sur la réparation complète. Les poses de la trappe et des voyants suivent la progression. La fermeture de test replace les quatre vis et remet le compteur à zéro ; le vrai geste de revissage viendra avec l’étape 4.

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
| Ouvrir le capot | Clic sur le capot rouge | Bouton Relever le capot rouge |
| Abaisser le levier | Glisser vers le bas, puis relâcher | Focaliser le levier, maintenir `↓` puis relâcher ; `Fin` pour la course complète |
| Annuler un glissement | Relâchement avant le seuil ou perte de capture | `Échap` |
| Toucher la trappe | Contact du tournevis sélectionné dans la vue | Bouton Toucher la trappe avec le tournevis |
| Choisir une vis | Clic sur sa tête | Bouton de la vis dans Commandes au clavier — trappe |
| Dévisser | Clic maintenu et cercles antihoraires | Sélectionner la vis puis maintenir `Q` |
| Ouvrir la trappe | Tirer le bord droit vers la gauche | Focaliser le curseur de trappe, maintenir `←` puis relâcher ; `Fin` pour ouvrir complètement |

Les commandes de vue et d’outils ne sont disponibles qu’après le briefing. La touche `E` pour marquer un fil sera activée lors de l’étape d’inspection.

## Organisation

- `src/main.js` : initialisation et boucle de rendu.
- `src/scene/` : terrain, atmosphère, coque, caméra et clignotement.
- `src/assets/manifest.js` : les **43 noms de nœuds** de la section 6 du cahier des charges.
- `src/assets/placeholders.js` : géométries, hiérarchies et pivots provisoires.
- `src/assets/loader.js` : GLTFLoader, DRACOLoader, RGBELoader et secours par nœud.
- `src/state/machine.js` : transitions, verrouillage, messages, erreurs, indices et temps actif.
- `src/state/procedure.js` : identifiants des cinq étapes, sous-étapes, outils et projection de l’état.
- `src/ui/textes.js` : textes modifiables de l’interface et des étiquettes.
- `src/interactions/power.js` : raycasting, capture du pointeur et commandes clavier du boîtier.
- `src/steps/step1-power.js` : durée du capot, course, seuil strict et identifiants des cibles.
- `src/steps/step2-hatch.js` : vis, tours, suivi angulaire, extraction et course de la trappe.
- `src/interactions/hatch.js` : cercles à la souris, Q maintenu, glissement de la trappe et annulation des gestes.
- `src/scene/electric-shock.js` : étincelles et secousse à durée limitée.
- `public/models/`, `public/sounds/`, `public/hdri/`, `public/textures/` : futurs fichiers locaux.

Les consignes existantes portent actuellement le nom `AGENTS (1).md`. Les spécifications se trouvent dans `SPEC.md` et `docs/Spec.md` (attention à la casse sous Linux).

### Brancher les futurs gestes

La mise hors tension utilise `OPEN_POWER_COVER`, `POWER_COVER_READY`, `POWER_DRAG_START`, `POWER_DRAG_MOVE`, `POWER_DRAG_END` et `POWER_DRAG_CANCEL`. La machine contrôle les délais et identifiants de geste. `TOUCH_HATCH` applique le choc sous tension ; `SHOCK_FINISHED` ne peut le terminer avant son délai.

L’ouverture utilise `SELECT_SCREW`, `SCREW_TURN_START`, `SCREW_TURN_MOVE` et `SCREW_TURN_END`. Les mouvements transmettent un angle signé borné par échantillon ; la machine conserve les tours, les rayures et le journal. `HATCH_DRAG_START`, `HATCH_DRAG_MOVE`, `HATCH_DRAG_END`, `HATCH_DRAG_CANCEL` et `HATCH_OPENED` contrôlent la course et la fin de l’animation. Aucun retrait ni mouvement de trappe n’est accepté avant la coupure du courant. Les changements d’outil et la relecture annulent les gestes actifs.

Les gestes des étapes suivantes devront émettre des événements vers `createMachine()` :

- `COMPLETE_SUBSTEP` avec `stepId` et `substepId` coche une sous-étape de l’étape courante.
- `VALIDATE_STEP` avec `stepId` ne passe à la suite que si toutes ses sous-étapes sont terminées.
- `RECORD_ERROR` avec `stepId` et `code` ajoute une erreur connue du catalogue de `src/ui/textes.js`.
- `ACTIVITY` réarme le délai d’inactivité ; les sélections d’outils et les actions de l’interface le font déjà.

Les validations d’une autre étape, les événements périmés et les actions pendant le briefing sont refusés par la machine, indépendamment de l’état des boutons. Les événements génériques de validation et de sous-étape ne peuvent pas contourner les gestes des étapes 1 et 2. Les snapshots sont immuables.

### Vérifications navigateur

`npm run test:browser` utilise Chrome ou Chromium déjà installé et démarre puis arrête son propre serveur sur le port 5199. Si nécessaire, préciser le navigateur :

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Le parcours vérifie les deux modes et l’accompagnement, puis teste le boîtier, le seuil, les annulations, la coupure, le choc et l’ouverture. `scripts/hatch-checks.mjs` contrôle les cercles, le sens horaire, le mauvais outil, la vis centrale, le recul des vis, le compteur et le glissement sur la charnière. En développement, il pilote réellement la souris dans la scène à partir des projections des nœuds ; les positions de debug sont en lecture seule. Le build compilé est contrôlé au clavier. Les captures sont enregistrées sous `.artifacts/` (ignoré par Git).

Pour contrôler seulement l’ouverture : `npm run test:browser -- --hatch`. Le même contrôle accepte l’adresse d’un build servi, par exemple `npm run test:browser -- http://127.0.0.1:4173/ --hatch`.

Captures de référence : [accueil](docs/screenshots/accueil.png), [accompagnement](docs/screenshots/accompagnement.png), [petit écran](docs/screenshots/accompagnement-mobile.png), [mise hors tension](docs/screenshots/mise-hors-tension.png), [trappe ouverte](docs/screenshots/trappe-ouverte.png).

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

## Checklist avant l’étape suivante

- [ ] `npm ci`, `npm test` et `npm run build` réussissent.
- [ ] La scène démarre via `npm run dev` sans erreur de console ; les avertissements « géométries provisoires » sont attendus.
- [ ] Le sol, les roches, le ciel, le soleil et la poussière sont visibles.
- [ ] La trappe, ses quatre vis, la vis de sécurité, le boîtier et les outils sont repérables.
- [ ] Au départ, le voyant rouge clignote à 1 Hz et la LED verte est allumée.
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
- [ ] En Évaluation : un seul message initial, cinq titres, aucune aide ; seule l’alerte physique de sécurité intervient lors d’un choc.
- [ ] Le capot s’ouvre en 0,4 seconde et le levier reste bloqué avant son ouverture complète.
- [ ] À 70 % exactement ou moins, le levier revient sans validation ; au-delà, le relâchement coupe le courant.
- [ ] Après coupure, la LED verte et le bip s’éteignent ; l’alarme rouge clignote toujours et l’étape 2 est active.
- [ ] Un tournevis sur la trappe sous tension déclenche les effets et une erreur ; le même contact hors tension reste sans décharge.
- [ ] Le cruciforme dévisse les quatre vis d’angle en quatre tours antihoraires chacune ; rotation et recul sont visibles en 3D.
- [ ] Le tournevis plat dérape, laisse une rayure et ajoute une erreur ; un même geste tenu ne compte qu’une erreur.
- [ ] La vis centrale reste en place et sa manipulation est consignée.
- [ ] Le sens horaire bloque la vis sans l’extraire ; relâcher puis reprendre conserve les tours déjà effectués.
- [ ] Le compteur atteint 4 / 4 avant de permettre l’ouverture de la trappe.
- [ ] Tirer le bord droit vers la gauche fait pivoter la trappe jusqu’à 110°, puis active automatiquement l’étape 3.
- [ ] Q maintenu et le curseur d’ouverture au clavier permettent les mêmes gestes, avec annulation par Échap.
- [ ] Le debug ne peut pas valider les étapes 1 et 2 ; les gestes réels puis les trois validations de test conduisent au débriefing.

Les résultats d’une validation dans Chromium avec un GPU logiciel ne garantissent pas 60 images/s sur toutes les machines. Chrome, Firefox et Edge restent à vérifier sur les postes ciblés avant la livraison finale.
