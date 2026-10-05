# Décisions prises en cours de route

## Choix validés par Hugo (5 octobre 2026)
- Nom de l'appli : IBILAW. Hébergement : GitHub Pages (compte `hugoniverts`). Partage des positions : Supabase, au lot 2.
- Préparation sur PC, capture GPS sur iPhone 16 Pro. Deux téléphones captureront probablement le 17 octobre : fusion des captures prévue à l'étape calage.
- Deux niveaux de droits : admin (code choisi à la création de chaque lieu) et équipier.
- Suivi « en fond » : impossible pour une web app sur iPhone. Hugo a validé le plan sans choisir entre les deux options ; retenu par défaut : écran noir de poche dans l'appli, plus un essai du suivi par l'appli OwnTracks au début du lot 2 (on garde ou on jette après test réel).
- Traces des équipiers : elles restent sur leur téléphone, envoi par fichier GPX.

## Choix techniques tranchés par Claude
- Aucune étape de construction : fichiers HTML/JS simples (Node n'est pas installé sur le PC).
- Leaflet 1.9.4 rangé dans `vendor/leaflet` (empreintes officielles vérifiées), pas de chargement depuis internet.
- Image du plan : une seule image, réduite à 16 millions de pixels maximum à l'import. Si l'affichage pose problème sur iPhone, passer à un découpage en tuiles sans changer les données.
- À l'ouverture, le plan remplit l'écran au lieu de s'afficher en entier (un plan large serait minuscule sur un téléphone tenu en hauteur). Le bouton ⤢ montre tout le plan.
- Taille des points selon leur nombre à l'écran : petites pastilles quand il y en a beaucoup, noms affichés quand il y en a peu.
- Un lieu = un enregistrement (points inclus) ; l'image et les traces sont stockées à part. Export = un seul fichier `.json`.
- Code admin : stocké haché avec le lieu, insensible aux majuscules. C'est un garde-fou, pas une sécurité.
- Poser un point : simple appui sur le plan en mode « Préparer ». Déplacer : bouton « Déplacer » puis appui sur le nouvel emplacement (pas de glisser, trop risqué au doigt).
- Liste collée : les doublons de nom sont ignorés, une catégorie inconnue devient « Autre ».
- Mises à jour : appliquées d'office à l'ouverture si elles attendaient, proposées par un bandeau si elles arrivent en cours d'utilisation (pas de rechargement surprise en pleine capture).
- Anti-veille : fonction du système, avec vidéo silencieuse de secours (NoSleep.js) pour les iPhone avant iOS 18.4.
- La recherche par nom et les filtres par catégorie (prévus au lot 2) sont déjà dans la liste des points, car la préparation en avait besoin.
- Le plan Walibi et la liste de points sont dans `mes-fichiers/`, exclu de Git (le plan appartient à Walibi, le dépôt est public).
- Liste de points Walibi : le numéro entre crochets est celui de la légende du plan (rouge = attractions, violet = restauration). Les maisons hantées viennent d'un résumé du site Halloween et sont à vérifier.
- Commits Git signés avec l'adresse `hugoniverts@users.noreply.github.com` pour ne pas exposer l'adresse mail dans un dépôt public.
- PDF du plan : converti en image à la main (4465 × 2764 pixels). L'appli n'importe pas les PDF ; à proposer à Hugo si le besoin revient pour d'autres lieux.

## État au 5 octobre 2026
Étapes 0 et 1 du lot 1 écrites et testées sur ordinateur (création de lieu, import du plan, liste collée, placement à la suite, modification, déplacement, suppression, export / import, hors-ligne). Pas encore testé sur iPhone : voir `CHECKLIST-IPHONE.md`.

Prochaine étape : position GPS, capture, simulation, puis calage et fusion des captures.
