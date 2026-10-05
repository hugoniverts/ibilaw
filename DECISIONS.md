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

## Calage : ce que l'évaluation a montré
Essais sur un terrain fictif déformé de quelques dizaines de mètres, avec un GPS qui tremble de 4 m :
- Avec 6 à 12 points, la méthode souple (thin plate spline) n'est pas meilleure que la simple, et ses plus grosses erreurs sont pires (jusqu'à 45 m contre 20 m).
- Avec 20 points, elle fait légèrement mieux (7 m contre 8 m en moyenne).
- Avec 40 points, elle fait nettement mieux (4 m contre 7 m).

Compromis retenu : méthode simple par défaut ; « Auto » ne passe en souple qu'à partir de 8 points et seulement si l'erreur estimée baisse d'au moins 20 %. L'erreur est estimée en retirant chaque point à tour de rôle et en mesurant où il retombe. Hugo peut forcer une méthode dans l'onglet « Caler ».

Autres choix du calage et de la capture :
- Pas de position affichée tant qu'il n'y a pas 3 points capturés et placés, ou s'ils sont presque alignés.
- Capture : moyenne sur 8 secondes, les mesures précises comptent davantage ; la précision affichée est la précision médiane des mesures.
- Un point créé sur place (« ＋ Point ici ») est posé automatiquement sur le plan si le calage existe déjà ; il ne sert alors pas au calage (sinon il se confirmerait lui-même).
- Les captures faites en simulation sont marquées, ignorées hors simulation, et ne peuvent pas écraser une vraie capture.
- Fusion de deux téléphones : par identifiant de point, sinon par nom ; pour un point capturé des deux côtés, la capture la plus précise gagne.
- La position s'arrête quand on quitte l'écran du lieu, et le suivi GPS est relancé à chaque retour dans l'appli.
- Simulation : terrain fictif de 900 m de large, tourné de 25°, écrasé comme une vue penchée et déformé par zones.

## Destination et écran de poche
- Distance vers un point capturé : vraie distance GPS, qui ne dépend pas du calage. Vers un point seulement placé sur le plan : distance estimée par le calage, affichée avec « environ ».
- Distances arrondies à 5 m (inutile d'afficher plus fin que le GPS) ; « Tu y es » à 15 m ou moins.
- La destination reste affichée sur le plan même si sa catégorie est masquée par un filtre.
- La destination n'est pas mémorisée quand on quitte le lieu.
- Écran de poche : fond noir, texte gris très sombre, déverrouillage par appui de 2 secondes. Il ne peut pas empêcher les gestes du système (balayage vers l'accueil).

## Partage d'équipe (Supabase)
- Pas de connexion permanente : toutes les 5 secondes, un seul échange « voici ma position, donne-moi celles des autres ». En cas d'échec, les essais s'espacent (jusqu'à 30 s) et reprennent dès le retour du réseau ou de l'appli à l'écran.
- Aucune table n'est accessible directement depuis internet : l'appli ne passe que par des fonctions (vérifié : lecture directe refusée).
- Rejoindre et se synchroniser demandent seulement le code de session. Publier demande un « code de publication », choisi par Hugo à sa première publication et jamais stocké en clair sur le serveur ; il est mémorisé sur le téléphone qui a publié.
- L'image du plan est stockée dans la base, découpée en morceaux de texte. Un nouveau plan n'est visible de l'équipe qu'une fois complet.
- L'ancienneté d'une position est calculée par le serveur, pour ne pas dépendre de l'heure réglée sur chaque téléphone.
- Une position de plus de 20 secondes n'est pas renvoyée au serveur : l'ancienne reste et vieillit.
- Mise à jour d'un lieu republié : automatique sur les téléphones de l'équipe ; proposée par un bandeau sur un téléphone où le mode admin est déverrouillé (pour ne pas écraser des modifications en cours).
- Les captures faites en simulation ne sont pas publiées.
- 60 personnes maximum par session.
- Les couleurs viennent de la liste `FONCTIONS` de `config.js` ; une fonction saisie en texte libre prend la couleur « Autre ».
- Une session d'essai (points et membres fictifs) est restée sur le serveur après les tests du 5 octobre 2026. Elle est inoffensive. Pour voir les sessions : dans l'éditeur SQL de Supabase, `select code, maj from public.sessions;` ; pour en enlever une, `delete from public.sessions where code = 'LE-CODE';`. Le code de publication d'essai a été neutralisé (ligne renommée `cle_essai_inactive` dans la table `reglages`).

## Mise en ligne
- Site : https://hugoniverts.github.io/ibilaw/ (dépôt public `hugoniverts/ibilaw`, GitHub Pages sur la branche `main`), en ligne depuis le 5 octobre 2026.
- Hugo a créé par erreur un dépôt `Hugo-NIVERTS`, vide et inutilisé ; à lui de le supprimer.

## État au 5 octobre 2026
Écrit et testé sur ordinateur : tout le lot 1 (lieux, plan, points, export / import, hors-ligne, simulation, capture, calage, fusion) et l'essentiel du lot 2 (destination, écran de poche, session d'équipe, positions en direct, mise à jour automatique, hors ligne). Le partage a été testé avec le vrai serveur et des membres simulés, pas encore avec de vrais téléphones. Le vrai GPS, l'anti-veille et l'installation ne peuvent se tester que sur téléphone : voir `CHECKLIST-IPHONE.md`.

Prochaines étapes : essais du suivi en fond (OwnTracks) et de la boussole, puis lot 3 (traces et GPX).
