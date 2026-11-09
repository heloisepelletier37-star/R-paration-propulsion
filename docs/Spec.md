Cahier des charges — Simulation « Réparer la propulsion »
1. Objectif pédagogique
À la fin, l'apprenant sait réaliser dans le bon ordre et sans danger la réparation d'un faisceau électrique de propulsion :

mettre le circuit hors tension ;
ouvrir la trappe d'accès avec le bon tournevis ;
inspecter le faisceau et remplacer les fils sectionnés ;
refermer la trappe ;
remettre sous tension et vérifier que le voyant d'alarme est éteint.
Les erreurs sont autorisées (on apprend en se trompant) mais elles ont des conséquences visibles et sont consignées dans le bilan.

1 bis. Accompagnement pédagogique : Inès et la checklist
Inès est l'ingénieure du centre de contrôle qui guide l'astronaute par radio. Elle apparaît dans un encadré de communication (portrait 2D ou silhouette dans un cadre « liaison radio », nom « Inès — Centre de contrôle », texte qui s'écrit lettre par lettre, bruit radio léger). Tous ses messages sont sous-titrés et l'apprenant avance avec « Suivant » ou la touche Espace.

Briefing d'Inès (avant de pouvoir agir)
La simulation commence par un briefing obligatoire, en 6 messages courts :

Situation : « Ta propulsion est en panne, le voyant rouge clignote. On va la réparer ensemble, étape par étape. »
Objectif : présentation de la checklist des 5 étapes (la checklist s'anime à l'écran pendant ce message).
Conseil sécurité : « Règle n° 1 : on ne touche jamais un circuit sous tension. Coupe toujours le courant avant d'ouvrir. »
Conseil outils : « La trappe tient avec des vis cruciformes. Le tournevis plat sert aux bornes des fils. Ne retire pas la vis centrale : c'est une vis de sécurité. »
Conseil inspection : « Il fait sombre dans la trappe : allume ta lampe frontale (L). Remplace chaque fil coupé par un fil de la même couleur. »
Commandes : rappel des gestes (glisser, mouvement circulaire, clic droit pour marquer) avec une mini-animation pour chacun, puis bouton « Je suis prêt ».
Le briefing peut être réécouté à tout moment (bouton « Briefing »).

Checklist permanente
Panneau à gauche de l'écran, toujours visible, titre « Procédure de réparation ».
Les 5 étapes, chacune avec ses sous-étapes (ex. étape 2 : « Choisir le bon tournevis », « Retirer les 4 vis », « Ouvrir la trappe »).
États : à faire (gris), en cours (surligné), réussie (coche verte, cochée automatiquement), erreur commise (petit triangle orange, reste visible).
L'étape en cours est dépliée, les autres repliées.
Conseils d'Inès pendant la réparation
Au début de chaque étape : un rappel en une phrase (ex. étape 4 : « Revisse en croix pour que la trappe soit bien plaquée »).
Après chaque erreur : Inès explique pourquoi c'était une erreur et ce qu'il faut faire (ex. « Ce tournevis glisse : la tête de vis est cruciforme. »). Pas de reproche, ton encourageant.
Le bouton « Aide » appelle Inès : indice progressif en 3 niveaux (piste → consigne précise → démonstration animée du geste).
Après 30 s d'inactivité sur une étape, Inès propose spontanément de l'aide.
Débriefing d'Inès (fin)
Inès commente le bilan : ce qui a été bien fait, les erreurs commises avec la règle à retenir pour chacune, et une phrase de conclusion.

Deux modes (écran d'accueil)
Entraînement : briefing complet, checklist détaillée, conseils et aide disponibles.
Évaluation : briefing réduit au message 1, checklist limitée aux 5 titres, pas d'aide ; seul le débriefing final est donné.
2. Mise en scène
Vue à la première personne, astronaute agenouillé devant le flanc du vaisseau, sol martien (régolithe ocre, cailloux), ciel rose-orangé, poussière en suspension (particules légères).
Lumière : soleil rasant chaud + lumière d'ambiance faible ; lampe frontale activable (touche L) indispensable pour bien voir l'intérieur de la trappe.
Caméra : légère respiration (oscillation lente), zoom limité, rotation contrainte (on ne peut pas tourner autour du vaisseau).
Son : souffle dans le casque, vent, bip du voyant, clics, vissage, étincelle, bruit radio des messages d'Inès.
Le voyant rouge clignote (1 Hz) dès le début, avec bip synchronisé.
3. Interface (HUD style visière de casque)
Encadré radio d'Inès en haut (voir section 1 bis) et checklist à gauche.
Ceinture à outils en bas : tournevis cruciforme, tournevis plat, pince à dénuder, fils de rechange (rouge, noir, jaune), lampe.
Un outil sélectionné apparaît « en main » (modèle 3D attaché à la caméra, en bas à droite).
Indicateurs : tension du circuit (ON/OFF), chrono, nombre d'erreurs.
Boutons « Briefing » et « Aide » (Inès, 3 niveaux d'indice) ; chaque indice consulté est compté.
4. Étapes et interactions réalistes
Étape 1 — Mise hors tension
Boîtier électrique avec un levier protégé par un capot basculant rouge.
Geste : cliquer sur le capot pour le relever (animation 0,4 s), puis glisser le levier vers le bas (drag vertical, résistance : il faut dépasser 70 % de la course sinon il revient).
Retour : clac sonore, LED « POWER » verte → éteinte, indicateur HUD « Tension : OFF ». Le voyant d'alarme continue de clignoter mais sans bip (alimenté par batterie de secours).
Erreur possible : passer à l'étape 2 sans couper → au premier contact du tournevis avec la trappe : étincelle, flash blanc, son de décharge, écran qui tremble, message « Choc électrique ! Coupe l'alimentation d'abord. » Erreur consignée, retour à l'étape 1.
Étape 2 — Ouverture de la trappe
Trappe fixée par 4 vis cruciformes (+ 1 vis plate de sécurité au centre, piège pédagogique : elle ne doit pas être retirée, elle ne fixe pas la trappe — à préciser dans le briefing).
Geste de dévissage : sélectionner le bon tournevis, cliquer sur une vis, puis effectuer un mouvement circulaire de la souris dans le sens antihoraire (ou touche Q maintenue). Chaque tour complet fait sortir la vis de 1/4 ; 4 tours pour l'extraire. La vis tourne et recule réellement en 3D.
Mauvais tournevis : la tête glisse (son de dérapage, petite rayure), erreur consignée.
Sens horaire : la vis se bloque (son sourd), message « Antihoraire pour dévisser ».
Les vis retirées s'ajoutent à un compteur « vis » dans le HUD (4/4 attendues pour refermer).
Quand les 4 vis sont retirées : saisir le bord de la trappe et la tirer (drag) ; elle pivote sur sa charnière (0 → 110°) avec inertie.
Étape 3 — Inspection et remplacement
Intérieur : faisceau de 6 fils colorés reliant un bornier gauche à un bornier droit. Aléatoirement, 1 à 2 fils sont sectionnés (tirage à chaque partie), avec extrémités effilochées et brin de cuivre visible.
Sans lampe frontale, l'intérieur est sombre : il faut l'allumer pour inspecter.
Inspection : survol d'un fil = surbrillance légère ; clic = gros plan caméra sur ce fil et diagnostic « intact » / « sectionné ». L'apprenant doit déclarer les fils sectionnés (clic droit ou touche E = marquer). Marquer un fil intact = erreur.
Remplacement d'un fil sectionné, dans l'ordre :
Tournevis plat : desserrer les 2 bornes du fil (mini-geste circulaire, 1 tour).
Retirer le fil endommagé (drag hors de la trappe).
Prendre le fil de rechange de la bonne couleur (mauvaise couleur = erreur, message).
Pince à dénuder : clic sur chaque extrémité → l'isolant se rétracte, cuivre visible.
Glisser chaque extrémité vers sa borne (aimantation quand on est à < 2 cm), puis resserrer au tournevis plat.
Le fil neuf est une courbe (CatmullRomCurve3 + TubeGeometry) qui suit le curseur pendant le drag, avec un léger affaissement simulant la gravité martienne (0,38 g).
Étape 4 — Fermeture
Pousser la trappe (drag inverse) jusqu'à fermeture (clac).
Revisser les 4 vis : sens horaire, ordre en croix recommandé (haut-gauche → bas-droite → haut-droite → bas-gauche). Ordre non respecté = avertissement (pas une erreur bloquante) : la trappe reste légèrement de travers jusqu'à la dernière vis.
Vis non revissée à fond = la simulation refuse de passer à la suite (« Une vis n'est pas serrée »).
Étape 5 — Remise sous tension et test
Remonter le levier (drag vers le haut), refermer le capot rouge.
Si tout est correct : LED « POWER » verte, le voyant d'alarme s'éteint après 2 s, son de démarrage de la propulsion (grondement montant), légère vibration caméra, message d'Inès « Propulsion opérationnelle. Bon travail. »
Si un fil sectionné n'a pas été remplacé ou est mal raccordé : le voyant continue de clignoter, message « Défaut persistant », retour à l'étape 1 (il faut recouper avant de rouvrir).
5. Bilan final
Écran récapitulatif : temps total, erreurs par étape (avec leur libellé), indices utilisés, note sur 20, bouton « Recommencer » (nouveau tirage des fils sectionnés) et bouton « Exporter le bilan » (fichier JSON téléchargé).

6. Modèles 3D attendus (public/models/)
Format GLB, unités en mètres, axe Y vers le haut, textures PBR ≤ 2048 px, compression Draco acceptée. Chaque pièce mobile doit être un nœud séparé portant exactement le nom ci-dessous, avec son point de pivot au bon endroit.

Fichier	Nœuds attendus	Pivot / remarque
ship_panel.glb	Panel, Hatch, Hatch_Hinge	Hatch pivote sur Hatch_Hinge (bord gauche)
ship_panel.glb	Screw_TL, Screw_TR, Screw_BL, Screw_BR, Screw_Safety	pivot au centre de la tête, axe de vissage = Z local
power_box.glb	PowerBox, Breaker_Cover, Breaker_Lever, LED_Power	capot pivote sur son bord haut ; levier sur sa base
ship_panel.glb	Alarm_Light	matériau émissif séparé (nommé M_Alarm)
harness.glb	Terminal_L_1..6, Terminal_R_1..6, Terminal_Screw_L_1..6, Terminal_Screw_R_1..6	les fils eux-mêmes sont générés par le code
tools.glb	Screwdriver_Phillips, Screwdriver_Flat, Wire_Stripper, Headlamp	pivot au point de prise en main
mars_ground.glb	Ground, Rocks	facultatif : sinon sol procédural
Fichiers additionnels : public/hdri/mars_sky.hdr (HDRI ciel martien, facultatif — sinon dégradé procédural).

7. Critères d'acceptation
La simulation se joue de bout en bout avec les placeholders, puis avec les vrais modèles sans changer le code.
Aucune étape ne peut être contournée, et aucune action n'est possible avant la fin du briefing d'Inès.
La checklist reflète toujours l'état réel de la réparation.
Chaque erreur listée ci-dessus est détectée, montrée et consignée.
Fonctionne sur Chrome, Firefox et Edge récents ; publiée sur GitHub Pages.
