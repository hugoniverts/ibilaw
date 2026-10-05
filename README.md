# IBILAW

Appli web pour téléphone : le plan d'un lieu, ses points importants, et bientôt la position de chaque membre de l'équipe. Elle s'installe sur l'écran d'accueil (sans App Store) et fonctionne hors ligne après un premier chargement.

Adresse du site : **https://hugoniverts.github.io/ibilaw/**

## Où en est l'appli

| Lot | Contenu | État |
|---|---|---|
| 1 | Appli installable, hors ligne, diagnostic du téléphone | Fait |
| 1 | Lieux, image du plan, points, liste collée, export / import | Fait |
| 1 | Position GPS, capture, simulation | À faire |
| 1 | Calage du plan, fusion des captures de deux téléphones | À faire |
| 2 | Recherche de destination, session d'équipe, positions en direct | À faire |
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

## Le jour du repérage

Section à compléter quand la capture GPS et le calage seront livrés (fin du lot 1).

## Le jour du live

Section à compléter quand la session d'équipe sera livrée (lot 2).

## Fichiers du projet

- `index.html`, `css/`, `js/` : l'appli.
- `config.js` : les réglages modifiables.
- `sw.js` : fonctionnement hors ligne et mises à jour.
- `vendor/leaflet/` : bibliothèque d'affichage du plan.
- `mes-fichiers/` : plan et liste de points de Walibi. Ce dossier reste sur l'ordinateur, il n'est pas publié.
- `DECISIONS.md` : les choix faits en cours de route.
- `CHECKLIST-IPHONE.md` : les tests à faire sur iPhone.
