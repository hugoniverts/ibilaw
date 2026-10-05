# IBILAW

Appli web pour téléphone : le plan d'un lieu, ses points importants, et bientôt la position de chaque membre de l'équipe. Elle s'installe sur l'écran d'accueil (sans App Store) et fonctionne hors ligne après un premier chargement.

Adresse du site : **https://hugoniverts.github.io/ibilaw/**

## Où en est l'appli

| Lot | Contenu | État |
|---|---|---|
| 1 | Appli installable, hors ligne, diagnostic du téléphone | Fait |
| 1 | Lieux, image du plan, points, liste collée, export / import | Fait |
| 1 | Position GPS, capture, simulation | Fait, à tester sur iPhone |
| 1 | Calage du plan, fusion des captures de deux téléphones | Fait, à tester sur iPhone |
| 2 | Destination (ligne et distance), écran noir de poche | Fait, à tester sur iPhone |
| 2 | Session d'équipe, positions en direct | Fait, à tester à plusieurs téléphones |
| 2 | Essais : suivi en fond par une autre appli, boussole | À faire |
| 3 | Traces et fichiers GPX | À faire |

## Mettre le site en ligne

### La toute première fois

1. Sur `github.com/new`, connecté avec le compte `hugoniverts` : nom du dépôt `ibilaw`, choisir « Public », ne rien cocher d'autre, puis « Create repository ».
2. Envoyer l'appli (une fenêtre de connexion GitHub s'ouvre la première fois) :

   ```bash
   git -C "C:\Users\hugon\OneDrive\Documents\plan-equipe" push -u origin main
   ```

3. Sur la page du dépôt : « Settings », puis « Pages » dans le menu de gauche. Sous « Branch », choisir `main` et `/ (root)`, puis « Save ».
4. Attendre une à deux minutes : le site est à l'adresse ci-dessus.

### À chaque mise à jour

Avant d'envoyer, le numéro de version doit changer à deux endroits, avec la même valeur : la ligne `VERSION` de `sw.js` et celle de `js/version.js`. C'est ce changement qui déclenche la mise à jour sur les téléphones.

```bash
git -C "C:\Users\hugon\OneDrive\Documents\plan-equipe" add -A
```

```bash
git -C "C:\Users\hugon\OneDrive\Documents\plan-equipe" commit -m "Mise à jour"
```

```bash
git -C "C:\Users\hugon\OneDrive\Documents\plan-equipe" push
```

Sur les téléphones, un bandeau « Nouvelle version prête » apparaît à l'ouverture suivante avec du réseau. Le numéro de version est affiché en bas de l'accueil.

## Tester sur l'ordinateur

Clic droit sur `serveur-local.ps1`, « Exécuter avec PowerShell », puis ouvrir `http://localhost:8123`. Le GPS d'un téléphone ne peut pas se tester ainsi : il exige le site en ligne (HTTPS).

## Installer l'appli sur un téléphone

- **iPhone** : ouvrir l'adresse dans Safari, bouton Partager, « Sur l'écran d'accueil ». Ensuite, toujours ouvrir IBILAW par son icône : l'appli installée a sa propre mémoire, séparée de Safari.
- **Android** : ouvrir l'adresse dans Chrome, puis « Installer » (ou menu ⋮, « Ajouter à l'écran d'accueil »).
- Ouvrir ensuite « Diagnostic du téléphone » : tout doit être vert.

## Créer un lieu (sur l'ordinateur)

1. « Nouveau lieu » : donner un nom et choisir un code admin. Ce code sera demandé sur chaque téléphone pour préparer, capturer et caler.
2. « Importer l'image du plan » : JPG ou PNG. Un PDF doit d'abord être converti en image.
3. Onglet « Préparer », puis au choix :
   - toucher le plan pour poser un point (nom et catégorie) ;
   - « ＋ Liste » pour coller une liste, une ligne par point : `Nom;Catégorie`. Le bouton « Placer ces points à la suite » les présente ensuite un par un : un appui sur le plan par point.
4. Toucher un point pour le renommer, changer sa catégorie, le déplacer ou le supprimer.
5. Menu « ⋯ », « Exporter ce lieu » : un seul fichier `.json` contient tout (plan, points, captures, calage).

## Envoyer le lieu sur un téléphone

1. S'envoyer le fichier exporté (mail, WhatsApp, Drive) et l'enregistrer dans « Fichiers » sur le téléphone.
2. Dans IBILAW : « Importer un lieu (fichier) ».
3. Pour modifier le lieu sur ce téléphone, ouvrir l'onglet « Préparer » et saisir le code admin.

## Modifier les catégories, les fonctions et les réglages

Tout est dans `config.js` : catégories de points (nom, couleur, symbole), fonctions de l'équipe (nom, couleur), seuil de précision GPS, durée d'une capture. Republier le site après modification.

## Se repérer (onglet « Carte », pour tout le monde)

- **Voir sa position :** toucher 📡 sur le plan et autoriser la position. La pastille bleue apparaît dès que le plan est calé ; le cercle autour montre la précision. Le bouton devient ◎ : il recentre le plan sur soi.
- **Chercher un point :** « Points », puis taper son nom ou filtrer par catégorie.
- **Aller quelque part :** toucher un point, puis « Y aller ». Un bandeau bleu affiche la distance en mètres, mise à jour en continu, et une ligne blanche relie ta position au point. C'est une ligne droite, pas un itinéraire par les allées. « environ » devant la distance signifie que le point n'a pas été capturé au GPS : la distance est estimée sur le plan.
- **Mettre le téléphone dans la poche :** toucher 🌑. L'écran devient noir et ne réagit plus, mais l'appli reste ouverte et la position continue. Garder le doigt appuyé 2 secondes pour revenir. Ne pas verrouiller le téléphone : cela arrêterait la position.

## S'entraîner chez soi (mode simulation)

1. Ouvrir le lieu, menu « ⋯ », « Mode simulation ». Un bandeau rayé orange reste affiché.
2. Toucher le plan : c'est ta position fictive. Le rond orange en pointillés est l'endroit touché, la pastille bleue est la position que l'appli calcule.
3. Onglet « Capturer » : toucher le plan sur un point pour « t'y rendre », toucher le point, « Capturer ma position ici », « Enregistrer ». Recommencer sur 4 ou 5 points.
4. Onglet « Caler » : l'erreur moyenne et l'écart de chaque point s'affichent.
5. Les captures faites en simulation sont marquées et ne comptent plus dès que la simulation est arrêtée. Pour les supprimer : menu « ⋯ », « Effacer les captures simulées ».

Le terrain fictif est volontairement déformé par rapport au plan, pour ressembler à un vrai plan dessiné.

## Le jour du repérage

### La veille
- Lieu préparé sur l'ordinateur (plan, points placés), exporté, puis importé sur l'iPhone dans l'appli installée.
- Diagnostic tout vert sur chaque téléphone qui va capturer.
- Captures simulées effacées.
- Batterie externe chargée : écran allumé et GPS vident un téléphone en quelques heures.
- Si deux téléphones capturent : les deux importent **le même fichier** avant de partir.

### Sur place
1. Ouvrir IBILAW par son icône, ouvrir le lieu, toucher 📡 et autoriser la position. Attendre que la pastille affiche « GPS ± … m » en vert.
2. Garder l'appli ouverte et l'écran allumé : sur iPhone, la position se fige dès qu'on change d'appli ou qu'on verrouille.
3. Onglet « Capturer » (code admin). Se rendre à un point, à l'endroit exact où il est posé sur le plan, à ciel ouvert.
4. Toucher le point (sur le plan ou dans la liste), « Capturer ma position ici », rester immobile pendant la mesure, puis « Enregistrer ».
5. Si la précision dépasse 15 m, un avertissement s'affiche : s'écarter des bâtiments et des arbres, attendre quelques secondes, « Recommencer ».
6. Commencer par 4 ou 5 points aux quatre coins du lieu : la position apparaît sur le plan dès 3 points, et un 4e permet de vérifier.
7. Pour un endroit absent de la liste : « ＋ Point ici ».
8. De temps en temps, onglet « Caler » : regarder l'erreur moyenne. Un point marqué ⚠️ a un gros écart : le recapturer, ou le décocher.
9. À chaque pause : menu « ⋯ », « Exporter ce lieu », et s'envoyer le fichier. C'est la sauvegarde.

### Rassembler les captures de deux téléphones
1. Le second téléphone exporte son lieu et envoie le fichier.
2. Sur le téléphone principal : « Importer un lieu (fichier) », puis « Fusionner les captures du fichier ».
3. Pour un point capturé des deux côtés, la capture la plus précise est gardée. Les points créés sur place par l'autre téléphone sont ajoutés.

### Comprendre le calage
- « Simple » suppose que le plan est déformé partout de la même façon. C'est la méthode par défaut, fiable dès 4 ou 5 points.
- « Souple » s'adapte zone par zone. Elle ne fait mieux qu'avec beaucoup de points bien répartis (une vingtaine ou plus) ; avec peu de points elle peut être pire.
- « Auto » compare les deux et ne retient « Souple » que si elle est nettement meilleure.
- Tant qu'il n'y a pas 3 points capturés et placés, non alignés, l'appli n'affiche aucune position plutôt qu'une position fausse.

## Partager avec l'équipe

### Publier le lieu (organisateur)
1. Ouvrir le lieu, menu « ⋯ », « Publier pour l'équipe ».
2. Choisir un **code de session** (exemple : `WALIBI25`). C'est le seul code à donner à l'équipe.
3. La toute première fois, choisir un **code de publication** (6 caractères minimum). Il protège ton espace en ligne : il est redemandé pour publier depuis un autre appareil. Le noter, ne pas le donner à l'équipe.
4. « Publier » : le plan, les points, les captures et le calage partent en ligne. « Envoyer l'invitation » prépare un message avec le lien et le code.
5. Après une modification (point ajouté, calage amélioré) : menu « ⋯ », « Republier ». Les téléphones de l'équipe se mettent à jour tout seuls en quelques secondes.

### Rejoindre (équipe)
1. Ouvrir IBILAW par son icône, « Rejoindre une session ».
2. Saisir le code de session, son pseudo et sa fonction.
3. Le lieu se télécharge une fois (à faire avec une bonne connexion), puis tout marche hors ligne.
4. Toucher 📡 pour partager sa position.

### Ce qu'on voit
- Chaque personne est une pastille de la couleur de sa fonction, avec son initiale et son pseudo. Si sa position date de plus de 20 secondes, l'ancienneté s'affiche à côté du pseudo ; au-delà de 90 secondes la pastille devient pâle.
- « Équipe » (onglet « Carte ») : la liste de tout le monde, avec fonction, destination en cours, distance et ancienneté. Toucher une ligne centre le plan sur la personne.
- « Hors ligne », en haut à droite du plan : le téléphone n'arrive plus à joindre le serveur. Tout le reste continue de marcher, et l'appli réessaie toute seule.

### À savoir
- Le serveur ne garde que la dernière position de chacun, pas d'historique. Une position de plus de 24 heures n'est plus transmise.
- Une personne dont l'appli n'est plus à l'écran garde sa dernière position, qui vieillit.
- En mode simulation, ta position fictive n'est jamais envoyée, et quatre coéquipiers fictifs apparaissent (ils restent sur ton téléphone).
- « Quitter la session » (menu « ⋯ ») efface ta position du serveur.

## Le jour du live

### Quelques jours avant
- Republier le lieu après le repérage (captures et calage à jour).
- Envoyer l'invitation à l'équipe. Chacun installe l'appli, rejoint la session **en Wi-Fi**, et ouvre « Diagnostic du téléphone » : tout doit être vert, y compris « Partage d'équipe ».
- Ouvrir `supabase.com` et vérifier que le projet `ibilaw` n'est pas en pause : un projet gratuit s'endort après 7 jours sans activité. S'il l'est, « Restore project ».
- Une batterie externe par personne.

### Le jour même
1. Chacun ouvre IBILAW par son icône, ouvre le lieu, touche 📡.
2. Garder l'appli à l'écran. Pour ranger le téléphone : bouton 🌑 (écran noir de poche), sans verrouiller.
3. Pour retrouver quelqu'un : « Équipe », toucher son nom. Pour aller à un point : le toucher, « Y aller ».
4. Si le réseau sature : chacun garde sa propre position et le plan ; les positions des autres reviennent dès que le réseau repasse.
5. Changement de dernière minute (nouveau point de rendez-vous) : l'ajouter dans « Préparer », puis « Republier ».

## Le serveur (Supabase)

- Projet `ibilaw`, hébergé à Francfort, sur le compte Supabase de Hugo (connexion par GitHub).
- La structure de la base est dans `supabase/schema.sql`. Pour la recréer : la coller dans l'éditeur SQL du projet et lancer.
- L'adresse du projet et sa clé publique sont dans `config.js`. Ces deux valeurs sont faites pour être publiques.
- Le mot de passe de la base a été généré par Supabase à la création et n'est noté nulle part : l'appli ne s'en sert pas. Il se réinitialise dans « Project Settings », « Database ».

## Fichiers du projet

- `index.html`, `css/`, `js/` : l'appli.
- `config.js` : les réglages modifiables.
- `sw.js` : fonctionnement hors ligne et mises à jour.
- `vendor/leaflet/` : bibliothèque d'affichage du plan.
- `mes-fichiers/` : plan et liste de points de Walibi. Ce dossier reste sur l'ordinateur, il n'est pas publié.
- `DECISIONS.md` : les choix faits en cours de route.
- `CHECKLIST-IPHONE.md` : les tests à faire sur iPhone.
