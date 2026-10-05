# Check-list de test sur iPhone

À faire sur le site en ligne (`https://hugoniverts.github.io/ibilaw/`), pas sur l'ordinateur. Note ce qui ne marche pas, avec une capture d'écran si possible.

## 1. Installation
- [ ] L'adresse s'ouvre dans Safari, l'écran d'accueil IBILAW s'affiche en sombre.
- [ ] Partager, « Sur l'écran d'accueil » : l'icône orange IBILAW apparaît.
- [ ] L'appli ouverte par son icône est en plein écran, sans barre d'adresse.
- [ ] Rien n'est caché par l'encoche en haut ni par la barre du bas.

## 2. Diagnostic (depuis l'icône)
- [ ] « Installée sur l'écran d'accueil » : vert.
- [ ] « Fonctionnement hors ligne » : vert (attendre quelques secondes au premier lancement).
- [ ] « Mémoire du téléphone » : vert ou orange, jamais rouge.
- [ ] « Tester le GPS » dehors : l'iPhone demande l'autorisation, puis une précision s'affiche.
- [ ] « Tester l'anti-veille » : l'écran reste allumé plus longtemps que le délai de verrouillage habituel.

## 3. Hors ligne
- [ ] Fermer l'appli, passer en mode avion, rouvrir par l'icône : elle s'ouvre normalement.
- [ ] Les lieux déjà enregistrés sont toujours là.

## 4. Lieu et plan
- [ ] « Importer un lieu (fichier) » ouvre « Fichiers » et accepte le fichier `.json` envoyé depuis l'ordinateur.
- [ ] Le plan s'affiche net, le zoom à deux doigts et le déplacement sont fluides.
- [ ] Les boutons ＋ / － / ⤢ zooment d'une seule main.
- [ ] En zoomant à fond, le plan ne clignote pas et ne devient pas noir.
- [ ] Les noms des points apparaissent en zoomant.

## 5. Points
- [ ] Toucher un point ouvre sa fiche ; le plan se décale pour que le point reste visible.
- [ ] « Points » : la recherche trouve un point par son nom, les filtres masquent une catégorie.
- [ ] Onglet « Préparer » : le code admin est demandé, un mauvais code est refusé.
- [ ] Toucher le plan en mode « Préparer » : le clavier s'ouvre sur le nom du nouveau point.
- [ ] Le clavier ne cache pas le champ du nom ni le bouton « Ajouter ».
- [ ] Déplacer et supprimer un point fonctionnent.

## 6. Export
- [ ] Menu « ⋯ », « Exporter ce lieu », « Envoyer / enregistrer le fichier » : la feuille de partage de l'iPhone s'ouvre.
- [ ] Le fichier envoyé (mail ou « Enregistrer dans Fichiers ») se réimporte sans erreur.

## 7. Mise à jour
- [ ] Après une publication, le bandeau « Nouvelle version prête » apparaît et le numéro de version change en bas de l'accueil.

## 8. Simulation (à la maison)
- [ ] Menu « ⋯ », « Mode simulation » : le bandeau rayé orange s'affiche.
- [ ] Toucher le plan déplace le rond orange en pointillés.
- [ ] Onglet « Capturer » : capturer 4 points en simulation fonctionne (barre de progression, précision, « Enregistrer »).
- [ ] Après 3 captures, la pastille bleue apparaît sur le plan, près du rond orange.
- [ ] Onglet « Caler » : l'erreur moyenne et les écarts s'affichent ; décocher un point change le résultat.
- [ ] Arrêter la simulation, puis « Effacer les captures simulées ».

## 9. Vrai GPS (dehors, dans ta rue ou un parc)
- [ ] Toucher 📡 : l'iPhone demande l'autorisation, le message « À savoir » s'affiche une fois.
- [ ] La pastille passe de « Recherche GPS… » à « GPS ± … m ».
- [ ] L'écran reste allumé tant que l'appli est ouverte.
- [ ] Passer sur une autre appli 30 secondes puis revenir : la position reprend toute seule en quelques secondes.
- [ ] Verrouiller puis déverrouiller l'iPhone : la position reprend et l'écran reste de nouveau allumé.
- [ ] Capturer un point réel : environ 8 mesures en 8 secondes, précision affichée.
- [ ] En intérieur, l'avertissement « Précision faible » apparaît.
- [ ] Avec un plan de ton quartier (capture d'écran d'une carte) et 4 points capturés : la pastille bleue te suit quand tu marches.
- [ ] Bouton ◎ : le plan se recentre sur toi.

## 10. Destination et écran de poche
- [ ] Toucher un point, « Y aller » : le bandeau bleu affiche la distance, une ligne blanche part de ta position.
- [ ] En marchant vers le point, la distance diminue ; à l'arrivée, « Tu y es ✅ ».
- [ ] Toucher le bandeau bleu : le plan cadre ta position et la destination.
- [ ] La croix du bandeau efface la destination et la ligne.
- [ ] Bouton 🌑 : l'écran devient noir, les appuis courts ne font rien.
- [ ] Téléphone en poche 2 minutes avec l'écran noir : au retour, la position a continué à se mettre à jour.
- [ ] Doigt appuyé 2 secondes : retour au plan.

## 11. Deux téléphones
- [ ] Le second téléphone importe le même fichier, capture un point, exporte.
- [ ] Sur le premier : « Importer un lieu », « Fusionner les captures du fichier » ; le résumé annonce la capture ajoutée.

## À venir
Les tests de session d'équipe et de traces seront ajoutés avec les lots 2 et 3.
