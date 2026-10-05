// Écran d'un lieu : le plan et ses points.
//   onglet « Carte »    : consulter, voir sa position (tout le monde)
//   onglet « Préparer » : importer le plan, poser / modifier les points (code admin)
//   onglet « Capturer » : relever la position GPS des points sur le terrain (code admin)
//   onglet « Caler »    : régler la correspondance GPS <-> plan (code admin)

import { CATEGORIES, REGLAGES } from '../config.js';
import {
  h, mettre, vider, toast, demander, confirmer, ouvrirFeuille, fermerFeuille,
  choisirFichier, partagerOuTelecharger, sansAccents, formatOctets,
} from './outils.js';
import { base } from './stockage.js';
import * as lieux from './lieux.js';
import * as position from './position.js';
import { creerCarte } from './carte.js';
import { calculerCalage, distanceMetres } from './calage.js';
import { terrainFictif } from './simulation.js';
import { activerAntiVeille, arreterAntiVeille } from './veille.js';
import { creerTerrain } from './terrain.js';
import { ouvrirEcranDePoche } from './poche.js';
import * as partage from './partage.js';
import { demanderProfil, formatAge } from './equipe.js';

// 237 -> « 235 m », 1240 -> « 1,2 km » (inutile d'afficher plus fin que le GPS)
function formatDistance(metres) {
  if (metres < 950) return `${Math.max(5, Math.round(metres / 5) * 5)} m`;
  return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
}

export async function ecranLieu(zone, id) {
  const lieu = await lieux.lireLieu(id);
  if (!lieu) {
    toast('Ce lieu n\'est plus sur ce téléphone.', 'erreur');
    location.hash = '#/';
    return null;
  }

  const etat = {
    mode: 'carte',
    admin: await lieux.estDeverrouille(id),
    // Action en cours sur le plan :
    //   { type: 'placer', file: [ids des points à placer], dernier }  ou  { type: 'deplacer', id }
    action: null,
    selection: null,              // id du point mis en avant
    masquees: new Set(),          // catégories masquées
    recherche: '',
    derniereCategorie: CATEGORIES[0].id,
    simulation: false,            // position fictive pour tester chez soi
    calage: null,                 // résultat de calculerCalage()
    destination: null,            // id du point vers lequel je vais
  };
  let carte = null;
  let urlImage = null;
  let derniere = position.instantane();   // dernier état connu de ma position
  let fermerPoche = null;                 // écran noir de poche ouvert ?

  // Équipe (seulement si le lieu est rattaché à une session)
  let profil = await partage.lireProfil();   // { membre, pseudo, fonction } ou rien
  let equipe = [];                        // les autres membres, tels que reçus du serveur
  let equipeRecue = 0;                    // heure de cette réception
  let fauxEquipiers = [];                 // coéquipiers fictifs du mode simulation
  let horsLigne = false;
  let syncActive = true;
  let minuterieSync = null;
  let echecs = 0;
  let versionSignalee = 0;
  let battements = 0;

  const titre = h('div', { class: 'barre-titre' }, lieu.nom);
  const bandeauSimulation = h('div', { class: 'bandeau-simulation', hidden: true }, 'SIMULATION · touche le plan pour déplacer ta position fictive');
  const bandeau = h('div', { class: 'bandeau', hidden: true });
  const destinationNom = h('strong');
  const destinationDistance = h('span', { class: 'destination-distance' });
  const bandeauDestination = h('div', { class: 'bandeau-destination', hidden: true },
    h('button', { class: 'destination-texte', 'aria-label': 'Voir le trajet', onclick: voirTrajet }, destinationNom, destinationDistance),
    h('button', { class: 'btn-icone', 'aria-label': 'Ne plus y aller', onclick: () => { etat.destination = null; dessiner(); } }, '✕'));
  const bandeauVersion = h('div', { class: 'bandeau-version', hidden: true },
    h('span', null, 'Une version plus récente de ce lieu a été publiée.'),
    h('button', { class: 'btn', onclick: chargerVersionPubliee }, 'Charger'));
  const pastilleReseau = h('div', { class: 'pastille-reseau', hidden: true }, 'Hors ligne');
  const boutonEquipe = h('button', { class: 'btn', onclick: ouvrirEquipe }, '👥 Équipe');
  const pastille = h('div', { class: 'pastille-gps', hidden: true });
  const boutonPosition = h('button', { 'aria-label': 'Ma position', onclick: basculerPosition }, '📡');
  const boutonPoche = h('button', { 'aria-label': 'Écran noir de poche', hidden: true, onclick: ouvrirPoche }, '🌑');
  const zoneCarte = h('div', { class: 'zone-carte' });
  const actions = h('div', { class: 'barre-actions' });
  const onglets = h('nav', { class: 'onglets' });
  zone.classList.add('ecran-lieu');
  zone.append(
    h('header', { class: 'barre-haut' },
      h('button', { class: 'btn-icone', 'aria-label': 'Retour à la liste des lieux', onclick: () => { location.hash = '#/'; } }, '‹'),
      titre,
      h('button', { class: 'btn-icone', 'aria-label': 'Menu du lieu', onclick: ouvrirMenu }, '⋯')),
    bandeauSimulation,
    bandeauVersion,
    bandeau,
    bandeauDestination,
    zoneCarte,
    h('div', { class: 'barre-bas' }, actions, onglets));

  const trouver = (pointId) => lieu.points.find((p) => p.id === pointId);

  // Une capture faite en simulation ne compte que pendant la simulation.
  const captureValide = (p) => !!p.capture && (etat.simulation || !p.capture.simulee);

  function recalculer() {
    const points = lieu.points
      .filter((p) => captureValide(p) && lieux.estPlace(p) && p.calage !== false)
      .map((p) => ({ id: p.id, lat: p.capture.lat, lon: p.capture.lon, x: p.x, y: p.y }));
    etat.calage = calculerCalage(points, (lieu.calage && lieu.calage.methode) || 'auto');
  }

  async function sauver() {
    recalculer();
    try {
      await lieux.enregistrerLieu(lieu);
    } catch (e) {
      toast('Enregistrement impossible : ' + e.message, 'erreur', 6000);
    }
  }

  function selectionner(point) {
    etat.selection = point.id;
    dessiner();
    if (carte && lieux.estPlace(point)) carte.centrer(point.x, point.y);
  }

  const terrain = creerTerrain({ lieu, etat, sauver, dessiner, deselectionner, selectionner, formulairePoint, captureValide });

  async function exigerAdmin() {
    if (etat.admin) return true;
    const v = await demander({
      titre: 'Code admin',
      message: `La préparation de « ${lieu.nom} » est protégée.`,
      champs: [{ nom: 'code', label: 'Code admin de ce lieu' }],
      valider: 'Déverrouiller',
    });
    if (!v) return false;
    if (!(await lieux.verifierCode(lieu, v.code))) {
      toast('Code incorrect.', 'erreur');
      return false;
    }
    await lieux.deverrouiller(lieu.id);
    etat.admin = true;
    return true;
  }

  // -------------------------------------------------------------------
  // Le plan
  // -------------------------------------------------------------------
  async function monterCarte() {
    if (carte) { carte.detruire(); carte = null; }
    if (urlImage) { URL.revokeObjectURL(urlImage); urlImage = null; }
    vider(zoneCarte);
    const plan = lieu.plan ? await lieux.lirePlan(lieu.id) : null;
    if (!plan) {
      zoneCarte.append(h('div', { class: 'sans-plan' },
        h('p', null, 'Ce lieu n\'a pas encore de plan.'),
        etat.admin
          ? h('button', { class: 'btn btn-principal btn-large', onclick: importerPlan }, '🖼 Importer l\'image du plan')
          : h('button', { class: 'btn btn-large', onclick: async () => { if (await exigerAdmin()) { await monterCarte(); dessiner(); } } }, '🔓 Déverrouiller pour importer le plan'),
        etat.admin && h('p', { class: 'aide' }, 'Image JPG ou PNG. Un PDF doit d\'abord être converti en image.')));
      return;
    }
    urlImage = URL.createObjectURL(new Blob([plan.donnees], { type: plan.type }));
    const conteneur = h('div', { class: 'plan' });
    zoneCarte.append(conteneur, pastille, pastilleReseau,
      h('div', { class: 'boutons-carte' },
        boutonPoche,
        boutonPosition,
        h('button', { 'aria-label': 'Zoomer', onclick: () => carte.zoomer(1) }, '＋'),
        h('button', { 'aria-label': 'Dézoomer', onclick: () => carte.zoomer(-1) }, '－'),
        h('button', { 'aria-label': 'Voir tout le plan', onclick: () => carte.toutVoir() }, '⤢')));
    carte = creerCarte(conteneur, lieu.plan, urlImage);
    carte.surClicPlan(surClicPlan);
    carte.surClicPoint(surClicPoint);
    carte.surClicEquipier(ouvrirEquipier);
  }

  function dessiner() {
    if (carte) {
      const terrainOuvert = etat.mode === 'capturer' || etat.mode === 'caler';
      carte.afficherPoints(lieu.points.filter((p) => !etat.masquees.has(p.categorie) || p.id === etat.destination), {
        selection: etat.selection,
        destination: etat.destination,
        interactif: !etat.action,
        etat: terrainOuvert ? (p) => (captureValide(p) ? 'capture' : 'a-capturer') : null,
      });
    }
    bandeauSimulation.hidden = !etat.simulation;
    dessinerBandeau();
    dessinerBarres();
    dessinerPosition();
    dessinerEquipe();
  }

  // -------------------------------------------------------------------
  // Ma position
  // -------------------------------------------------------------------
  // Où je suis sur le plan : { x, y } ou null si le calage ne permet pas de le dire.
  function maPlaceSurLePlan() {
    const p = derniere.position;
    if (derniere.etat !== 'ok' || !p || !etat.calage || !etat.calage.ok) return null;
    return etat.calage.convertir(p.lat, p.lon);
  }

  function dessinerPosition() {
    const actif = derniere.source !== 'arret';
    boutonPosition.textContent = actif ? '◎' : '📡';
    boutonPosition.classList.toggle('actif', actif);
    pastille.hidden = !actif;
    if (actif) {
      const p = derniere.position;
      const nom = derniere.source === 'simulation' ? 'Simulation' : 'GPS';
      let texte;
      let classe = 'ok';
      if (derniere.etat === 'ok') {
        const age = Math.round((Date.now() - p.date) / 1000);
        texte = `${nom} ± ${Math.round(p.precision)} m`;
        if (age >= 10) { texte += ` · il y a ${age < 90 ? age + ' s' : Math.round(age / 60) + ' min'}`; classe = 'attention'; }
        if (p.precision > REGLAGES.precisionAlerte) classe = 'attention';
        if (!etat.calage || !etat.calage.ok) { texte += ' · calage insuffisant : position non affichée'; classe = 'attention'; }
      } else if (derniere.etat === 'recherche') {
        texte = derniere.source === 'simulation' ? 'Simulation : touche le plan pour te placer' : 'Recherche GPS…';
        classe = 'attention';
      } else {
        texte = derniere.message || 'Position indisponible';
        classe = 'erreur';
      }
      pastille.textContent = texte;
      pastille.className = 'pastille-gps ' + classe;
    }
    boutonPoche.hidden = !actif;
    const q = maPlaceSurLePlan();
    if (carte) carte.afficherMoi(q ? { x: q.x, y: q.y, rayon: Math.max(4, derniere.position.precision * etat.calage.pixelsParMetre) } : null);
    dessinerDestination(q);
  }

  // -------------------------------------------------------------------
  // Destination : ligne droite et distance jusqu'à un point
  // -------------------------------------------------------------------
  // Distance jusqu'à un point : { metres, approx } ou null si on ne peut pas la connaître.
  // Si le point a été capturé, c'est la vraie distance GPS ; sinon elle est estimée sur le plan.
  function distanceVers(point, maPlace) {
    const p = derniere.etat === 'ok' ? derniere.position : null;
    if (!p) return null;
    if (captureValide(point)) return { metres: distanceMetres(p, point.capture), approx: false };
    if (maPlace && lieux.estPlace(point)) return { metres: etat.calage.metresEntre(maPlace, point), approx: true };
    return null;
  }

  function dessinerDestination(maPlace) {
    const but = etat.destination ? trouver(etat.destination) : null;
    if (!but) etat.destination = null;
    bandeauDestination.hidden = !but;
    if (!but) {
      if (carte) carte.afficherTrajet(null);
      return;
    }
    const d = distanceVers(but, maPlace);
    destinationNom.textContent = `🧭 ${but.nom}`;
    if (d) {
      destinationDistance.textContent = d.metres <= 15 ? 'Tu y es ✅' : (d.approx ? 'environ ' : '') + formatDistance(d.metres);
    } else if (derniere.source === 'arret') {
      destinationDistance.textContent = 'Active ta position 📡';
    } else if (derniere.etat !== 'ok') {
      destinationDistance.textContent = 'Position en attente…';
    } else {
      destinationDistance.textContent = 'Distance inconnue (calage insuffisant)';
    }
    if (carte) carte.afficherTrajet(maPlace && lieux.estPlace(but) ? maPlace : null, but);
  }

  function voirTrajet() {
    const but = etat.destination ? trouver(etat.destination) : null;
    if (!carte || !but || !lieux.estPlace(but)) return;
    const moi = maPlaceSurLePlan();
    if (moi) carte.voirEnsemble(moi, but);
    else carte.centrer(but.x, but.y);
  }

  function ouvrirPoche() {
    if (fermerPoche) fermerPoche();
    fermerPoche = ouvrirEcranDePoche(() => {
      const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (derniere.etat !== 'ok') return `${heure} · position en attente`;
      const but = etat.destination ? trouver(etat.destination) : null;
      const d = but ? distanceVers(but, maPlaceSurLePlan()) : null;
      return `${heure} · ${derniere.source === 'simulation' ? 'simulation' : 'GPS'} ± ${Math.round(derniere.position.precision)} m`
        + (d ? ` · ${but.nom} à ${formatDistance(d.metres)}` : '');
    });
  }

  async function basculerPosition() {
    if (derniere.source !== 'arret') {
      const q = maPlaceSurLePlan();
      if (q) carte.centrer(q.x, q.y);
      else toast(derniere.etat === 'ok' ? 'Position non affichable : le calage du plan est insuffisant.' : 'Position pas encore connue.');
      return;
    }
    // L'anti-veille doit être demandée directement dans l'appui.
    const methode = await activerAntiVeille();
    position.demarrerGps();
    if (!methode) toast('Impossible d\'empêcher la mise en veille : règle le verrouillage automatique du téléphone sur « Jamais ».', 'erreur', 8000);
    if (!(await base.lire('reglages', 'notice-position'))) {
      await base.ecrire('reglages', true, 'notice-position');
      await demander({
        titre: 'À savoir',
        message: 'Ta position ne fonctionne que si IBILAW reste ouverte à l\'écran. L\'appli garde l\'écran allumé : ne verrouille pas le téléphone et ne passe pas sur une autre appli, sinon ta position se fige (surtout sur iPhone). Prévois une batterie externe.',
        valider: 'Compris',
        annuler: null,
      });
    }
  }

  async function basculerSimulation() {
    fermerFeuille();
    if (!etat.simulation) {
      if (!lieu.plan) { toast('Importe d\'abord l\'image du plan.'); return; }
      etat.simulation = true;
      position.demarrerSimulation();
      creerFauxEquipiers();
      toast('Simulation activée : touche le plan pour déplacer ta position fictive (onglets Carte, Capturer ou Caler).', 'info', 6000);
    } else {
      etat.simulation = false;
      fauxEquipiers = [];
      position.arreter();
      if (carte) carte.afficherFantome(null);
      toast('Simulation arrêtée');
    }
    recalculer();
    dessiner();
  }

  async function effacerCapturesSimulees() {
    fermerFeuille();
    for (const p of lieu.points) {
      if (p.capture && p.capture.simulee) { p.capture = null; p.maj = Date.now(); }
    }
    await sauver();
    dessiner();
    toast('Captures simulées effacées');
  }

  function deselectionner() {
    etat.selection = null;
    if (carte) carte.retirerProvisoire();
    dessiner();
  }

  // Décale le plan pour que le point reste visible à côté de la feuille ouverte.
  function garderVisible(point, feuille) {
    if (!carte || !lieux.estPlace(point)) return;
    const c = zoneCarte.getBoundingClientRect();
    const f = feuille.getBoundingClientRect();
    const enBas = f.width > c.width * 0.7;
    carte.garderVisible(point.x, point.y, enBas
      ? { bas: Math.max(0, c.bottom - f.top) }
      : { droite: Math.max(0, c.right - f.left) });
  }

  function surClicPlan(p) {
    if (etat.action && etat.action.type === 'placer') { placer(p); return; }
    if (etat.action && etat.action.type === 'deplacer') { deplacer(p); return; }
    if (etat.mode === 'preparer') { nouveauPointIci(p); return; }
    if (etat.simulation) {
      const g = terrainFictif(lieu.plan).versGps(p.x, p.y);
      carte.afficherFantome(p);
      position.placerSimulation(g.lat, g.lon);
      return;
    }
    if (etat.selection) { fermerFeuille(); deselectionner(); }
  }

  function surClicPoint(point) {
    etat.selection = point.id;
    dessiner();
    if (etat.mode === 'preparer') ouvrirEdition(point);
    else if (etat.mode === 'carte') ouvrirFiche(point);
    else garderVisible(point, terrain.ouvrirCapture(point));
  }

  // -------------------------------------------------------------------
  // Bandeau d'instruction (placement / déplacement en cours)
  // -------------------------------------------------------------------
  function dessinerBandeau() {
    vider(bandeau);
    const a = etat.action;
    const point = a && trouver(a.type === 'placer' ? a.file[0] : a.id);
    if (a && !point) { etat.action = null; }
    bandeau.hidden = !etat.action;
    if (!etat.action) return;
    if (a.type === 'placer') {
      const cat = lieux.categorie(point.categorie);
      bandeau.append(
        h('div', { class: 'bandeau-texte' },
          h('span', null, 'Touche le plan pour placer'),
          h('strong', null, `${cat.symbole} ${point.nom}`),
          a.file.length > 1 && h('small', null, `encore ${a.file.length} à placer`)),
        h('div', { class: 'bandeau-boutons' },
          a.dernier && h('button', { class: 'btn', onclick: annulerDernier }, '↩ Annuler'),
          a.file.length > 1 && h('button', { class: 'btn', onclick: passer }, 'Passer'),
          h('button', { class: 'btn', onclick: arreterAction }, 'Arrêter')));
    } else {
      bandeau.append(
        h('div', { class: 'bandeau-texte' },
          h('span', null, 'Touche le nouvel emplacement de'),
          h('strong', null, point.nom)),
        h('div', { class: 'bandeau-boutons' },
          h('button', { class: 'btn', onclick: arreterAction }, 'Annuler')));
    }
  }

  function arreterAction() {
    etat.action = null;
    etat.selection = null;
    dessiner();
  }

  function commencerPlacement(ids) {
    fermerFeuille();
    etat.action = { type: 'placer', file: ids.slice(), dernier: null };
    etat.selection = null;
    dessiner();
  }

  async function placer(p) {
    const a = etat.action;
    const point = trouver(a.file.shift());
    if (point) {
      a.dernier = { id: point.id, x: point.x, y: point.y };
      Object.assign(point, { x: p.x, y: p.y, maj: Date.now() });
      await sauver();
    }
    if (etat.action === a && !a.file.length) {
      etat.action = null;
      toast(point ? `« ${point.nom} » placé ✅` : 'Placement terminé');
    }
    dessiner();
  }

  function passer() {
    etat.action.file.shift();
    etat.action.dernier = null;
    dessiner();
  }

  async function annulerDernier() {
    const a = etat.action;
    const point = a && a.dernier && trouver(a.dernier.id);
    if (!point) return;
    Object.assign(point, { x: a.dernier.x, y: a.dernier.y, maj: Date.now() });
    a.file.unshift(point.id);
    a.dernier = null;
    await sauver();
    dessiner();
  }

  function commencerDeplacement(point) {
    fermerFeuille();
    etat.action = { type: 'deplacer', id: point.id };
    etat.selection = point.id;
    dessiner();
  }

  async function deplacer(p) {
    const point = trouver(etat.action.id);
    etat.action = null;
    etat.selection = null;
    if (point) {
      Object.assign(point, { x: p.x, y: p.y, maj: Date.now() });
      await sauver();
      toast('Point déplacé');
    }
    dessiner();
  }

  // -------------------------------------------------------------------
  // Équipe : positions des autres, partage de la mienne
  // -------------------------------------------------------------------
  // Tous les coéquipiers à afficher, avec leur ancienneté à l'instant présent (en secondes).
  function tousLesEquipiers() {
    const ecoule = Math.round((Date.now() - equipeRecue) / 1000);
    return [
      ...equipe.map((m) => ({ ...m, age: m.age + ecoule })),
      ...(etat.simulation ? fauxEquipiers.map((m) => ({ ...m, age: m.fige ? Math.round((Date.now() - m.fige) / 1000) : 0 })) : []),
    ];
  }

  function dessinerEquipe() {
    const tous = tousLesEquipiers();
    pastilleReseau.hidden = !(lieu.session && horsLigne);
    boutonEquipe.textContent = `👥 Équipe (${tous.length})`;
    if (!carte) return;
    const cal = etat.calage && etat.calage.ok ? etat.calage : null;
    carte.afficherEquipe(cal ? tous.filter((m) => m.lat != null).map((m) => {
      const q = cal.convertir(m.lat, m.lon);
      return {
        id: m.membre, x: q.x, y: q.y,
        couleur: partage.couleurFonction(m.fonction),
        initiale: (m.pseudo[0] || '?').toUpperCase(),
        etiquette: m.pseudo + (m.age >= 20 ? ` · ${formatAge(m.age)}` : ''),
        ancien: m.age >= 90,
      };
    }) : []);
  }

  // Un échange avec le serveur, puis on programme le suivant. En cas d'échec
  // (pas de réseau), on espace les essais et on reprend tout seul.
  async function synchroniser() {
    clearTimeout(minuterieSync);
    if (!syncActive) return;
    let attente = REGLAGES.intervallePartage * 1000;
    if (lieu.session && document.visibilityState === 'visible') {
      try {
        const p = derniere.source === 'gps' && derniere.etat === 'ok' && Date.now() - derniere.position.date < 20000
          ? derniere.position : null;
        const but = etat.destination ? trouver(etat.destination) : null;
        const r = await partage.synchroniser(lieu.session.code, etat.simulation ? null : profil, p, but ? but.nom : null);
        equipe = r.membres.filter((m) => !profil || m.membre !== profil.membre);
        equipeRecue = Date.now();
        horsLigne = false;
        echecs = 0;
        if (r.version > lieu.session.version && versionSignalee !== r.version) {
          versionSignalee = r.version;
          // Sur un téléphone admin, on ne remplace pas le lieu sans prévenir (modifs locales possibles).
          if (etat.admin) bandeauVersion.hidden = false;
          else chargerVersionPubliee();
        }
      } catch (e) {
        horsLigne = true;
        echecs++;
        if (e.code === 'SESSION_INCONNUE') {
          syncActive = false;
          toast('Cette session n\'existe plus sur le serveur.', 'erreur', 6000);
        }
        attente = Math.min(30000, attente * 2 ** Math.min(echecs, 3));
      }
      dessinerEquipe();
    }
    if (syncActive) minuterieSync = setTimeout(synchroniser, attente);
  }

  async function chargerVersionPubliee() {
    bandeauVersion.hidden = true;
    try {
      const planAvant = lieu.session.planVersion;
      const nouveau = await partage.telecharger(lieu.session.code, lieu);
      // Même objet « lieu » pour tout l'écran : on remplace son contenu.
      for (const cle of Object.keys(lieu)) delete lieu[cle];
      Object.assign(lieu, nouveau);
      titre.textContent = lieu.nom;
      recalculer();
      if (lieu.session.planVersion !== planAvant) await monterCarte();
      dessiner();
      toast('Lieu mis à jour avec la dernière version publiée');
    } catch {
      versionSignalee = 0;      // on réessaiera au prochain échange
    }
  }

  function texteAge(m) {
    if (m.lat == null) return 'pas encore de position';
    if (m.age < 20) return 'à l\'instant';
    return `il y a ${formatAge(m.age)}`;
  }

  function detailsEquipier(m) {
    const morceaux = [m.fonction];
    if (m.destination) morceaux.push(`→ ${m.destination}`);
    if (m.lat != null && derniere.etat === 'ok') morceaux.push(`à ${formatDistance(distanceMetres(derniere.position, m))}`);
    return morceaux.join(' · ');
  }

  function centrerSurEquipier(m) {
    fermerFeuille();
    const cal = etat.calage && etat.calage.ok ? etat.calage : null;
    if (!carte || !cal || m.lat == null) { toast('Sa position n\'est pas affichable sur le plan pour l\'instant.'); return; }
    const q = cal.convertir(m.lat, m.lon);
    carte.centrer(q.x, q.y);
  }

  function ouvrirEquipe() {
    const tous = tousLesEquipiers().sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
    ouvrirFeuille({
      titre: `Équipe · session ${lieu.session ? lieu.session.code : 'simulée'}`,
      haute: true,
      contenu: [
        profil
          ? h('p', { class: 'aide' }, `Tu apparais comme « ${profil.pseudo} » (${profil.fonction}).`
            + (derniere.source === 'gps' ? '' : ' Ta position n\'est pas partagée : active-la avec 📡.'))
          : h('button', { class: 'btn btn-principal btn-large', onclick: modifierProfil }, '👤 Choisir mon pseudo pour apparaître'),
        lieu.session && horsLigne && h('p', { class: 'alerte' }, 'Hors ligne : les positions ne sont plus mises à jour. L\'appli réessaie toute seule.'),
        !tous.length && h('p', { class: 'vide' }, 'Personne d\'autre dans la session pour l\'instant.'),
        h('div', { class: 'liste' }, tous.map((m) => h('button', { class: 'ligne', onclick: () => centrerSurEquipier(m) },
          h('span', { class: 'equipier', style: `--c:${partage.couleurFonction(m.fonction)}` }, (m.pseudo[0] || '?').toUpperCase()),
          h('span', { class: 'ligne-nom ligne-deux' }, h('strong', null, m.pseudo + (m.faux ? ' (fictif)' : '')), h('small', null, detailsEquipier(m))),
          h('span', { class: 'badge ' + (m.lat == null || m.age >= 90 ? 'badge-gris' : m.age >= 20 ? 'badge-attention' : 'badge-ok') }, texteAge(m))))),
      ],
    });
  }

  function ouvrirEquipier(membreId) {
    const m = tousLesEquipiers().find((x) => x.membre === membreId);
    if (!m) return;
    ouvrirFeuille({
      titre: m.pseudo + (m.faux ? ' (fictif)' : ''),
      contenu: [
        h('p', null, detailsEquipier(m)),
        h('p', { class: 'aide' }, `Dernière position : ${texteAge(m)}` + (m.precision ? `, précise à ${Math.round(m.precision)} m` : '') + '.'),
      ],
    });
  }

  async function modifierProfil() {
    fermerFeuille();
    const v = await demanderProfil({ titre: 'Mon profil', profil, valider: 'Enregistrer' });
    if (!v) return;
    profil = await partage.enregistrerProfil(v.pseudo, v.fonction);
    toast(`Tu apparais maintenant comme « ${profil.pseudo} »`);
    synchroniser();
  }

  async function publierPourEquipe() {
    fermerFeuille();
    if (!lieu.plan) { toast('Importe d\'abord l\'image du plan.'); return; }
    let initialisee;
    try {
      initialisee = await partage.publicationInitialisee();
    } catch (e) {
      toast(e.message, 'erreur', 6000);
      return;
    }
    const memorisee = await partage.lireCleMemorisee();
    const v = await demander({
      titre: lieu.session ? 'Republier pour l\'équipe' : 'Publier pour l\'équipe',
      message: 'Le plan, les points, les captures et le calage sont envoyés en ligne. L\'équipe les récupère avec le code de session.',
      champs: [
        {
          nom: 'code', label: 'Code de session (à donner à l\'équipe)', placeholder: 'WALIBI25',
          valeur: lieu.session ? lieu.session.code : sansAccents(lieu.nom).replace(/[^a-z0-9]+/g, '').toUpperCase().slice(0, 12),
        },
        {
          nom: 'cle', label: initialisee ? 'Code de publication' : 'Choisis ton code de publication', valeur: memorisee || '',
          aide: initialisee
            ? 'Celui que tu as choisi lors de ta première publication.'
            : '6 caractères minimum. Il protège ton espace en ligne et sera redemandé pour publier depuis un autre appareil : note-le, et ne le donne pas à l\'équipe.',
        },
      ],
      valider: 'Publier',
    });
    if (!v) return;
    toast('Publication en cours…');
    try {
      await partage.publier(lieu, v.cle, v.code, (rang, total) => { titre.textContent = `Envoi du plan ${rang + 1} / ${total}…`; });
    } catch (e) {
      titre.textContent = lieu.nom;
      toast('Publication impossible : ' + e.message, 'erreur', 8000);
      return;
    }
    titre.textContent = lieu.nom;
    versionSignalee = lieu.session.version;
    syncActive = true;
    dessiner();
    synchroniser();
    const code = lieu.session.code;
    const invitation = `IBILAW : rejoins la session ${code}.\n1. Ouvre ${location.origin}${location.pathname}\n2. Installe l'appli (iPhone : Partager, « Sur l'écran d'accueil »).\n3. Touche « Rejoindre une session » et saisis le code ${code}.`;
    ouvrirFeuille({
      titre: 'Publié ✅',
      contenu: [
        h('p', { class: 'code-session' }, code),
        h('p', { class: 'aide' }, 'Donne ce code à l\'équipe. Chacun ouvre IBILAW, touche « Rejoindre une session », saisit le code, son pseudo et sa fonction. À faire une fois avec une bonne connexion : le plan se télécharge, puis tout marche hors ligne.'),
        h('button', {
          class: 'btn btn-principal btn-large',
          onclick: async () => {
            try {
              if (navigator.share) await navigator.share({ text: invitation });
              else { await navigator.clipboard.writeText(invitation); toast('Invitation copiée'); }
            } catch { /* partage annulé */ }
          },
        }, '📤 Envoyer l\'invitation'),
        !profil && h('button', { class: 'btn btn-large', onclick: modifierProfil }, '👤 Choisir mon pseudo pour apparaître sur le plan'),
      ],
    });
  }

  async function quitterSession() {
    fermerFeuille();
    const ok = await confirmer({
      titre: 'Quitter la session ?',
      message: 'Ta position est effacée du serveur et tu ne vois plus l\'équipe. Le lieu reste sur ce téléphone.',
      valider: 'Quitter',
      danger: true,
    });
    if (!ok) return;
    if (profil) partage.quitter(lieu.session.code, profil.membre);
    delete lieu.session;
    equipe = [];
    bandeauVersion.hidden = true;
    await sauver();
    dessiner();
    toast('Session quittée');
  }

  // Coéquipiers fictifs du mode simulation : ils se promènent sur le plan et ne
  // sortent jamais de ce téléphone.
  function creerFauxEquipiers() {
    const modeles = [['Léa', 'Cadreur', 0.3, 0.4], ['Max', 'Régie', 0.5, 0.55], ['Inès', 'Comédien', 0.65, 0.4], ['Tom', 'Sécurité', 0.4, 0.65]];
    fauxEquipiers = modeles.map(([pseudo, fonction, fx, fy], i) => ({
      membre: 'faux-' + i, pseudo, fonction, faux: true, precision: 6,
      x: lieu.plan.largeur * fx, y: lieu.plan.hauteur * fy,
      destination: i === 0 && lieu.points[0] ? lieu.points[0].nom : null,
      fige: i === 3 ? Date.now() - 240000 : null,       // Tom n'a plus donné de position depuis 4 minutes
    }));
    bougerFauxEquipiers();
  }

  function bougerFauxEquipiers() {
    if (!lieu.plan) return;
    const sol = terrainFictif(lieu.plan);
    const pas = lieu.plan.largeur / 300;
    for (const m of fauxEquipiers) {
      if (!m.fige || m.lat == null) {
        if (m.lat != null) {
          m.x = Math.min(lieu.plan.largeur * 0.9, Math.max(lieu.plan.largeur * 0.1, m.x + (Math.random() - 0.5) * 2 * pas));
          m.y = Math.min(lieu.plan.hauteur * 0.9, Math.max(lieu.plan.hauteur * 0.1, m.y + (Math.random() - 0.5) * 2 * pas));
        }
        Object.assign(m, sol.versGps(m.x, m.y));
      }
    }
  }

  // -------------------------------------------------------------------
  // Barres du bas
  // -------------------------------------------------------------------
  function onglet(mode, texte) {
    return h('button', { class: 'onglet' + (etat.mode === mode ? ' actif' : ''), onclick: () => changerMode(mode) }, texte);
  }

  function dessinerBarres() {
    vider(actions);
    const aPlacer = lieu.points.filter((p) => !lieux.estPlace(p)).length;
    if (etat.mode === 'carte') {
      mettre(actions,
        h('button', { class: 'btn', onclick: ouvrirListe }, `🔍 Points (${lieu.points.length})`),
        (lieu.session || etat.simulation) && boutonEquipe);
    } else if (etat.mode === 'preparer') {
      mettre(actions,
        lieu.plan && h('div', { class: 'astuce' }, 'Touche le plan pour ajouter un point, ou un point pour le modifier.'),
        h('button', { class: 'btn' + (aPlacer ? ' btn-principal' : ''), onclick: ouvrirListe },
          aPlacer ? `📋 ${aPlacer} à placer` : `📋 Points (${lieu.points.length})`),
        h('button', { class: 'btn', onclick: ouvrirCollage }, '＋ Liste'));
    } else if (etat.mode === 'capturer') {
      const restants = lieu.points.filter((p) => !captureValide(p)).length;
      mettre(actions,
        h('div', { class: 'astuce' }, 'Va à un point, touche-le sur le plan (ou dans la liste), puis capture.'),
        h('button', { class: 'btn' + (restants ? ' btn-principal' : ''), onclick: terrain.ouvrirListeCaptures },
          restants ? `📋 Reste ${restants}` : '📋 Tout est capturé ✅'),
        h('button', { class: 'btn', onclick: terrain.nouveauPointIci }, '＋ Point ici'));
    } else {
      const r = terrain.resumeCalage();
      mettre(actions,
        h('div', { class: 'astuce' + (r.ok && !r.douteux ? '' : ' astuce-alerte') }, r.texte),
        h('button', { class: 'btn btn-principal', onclick: terrain.ouvrirCalage }, '⚙️ Régler le calage'));
    }
    const cadenas = etat.admin ? '' : '🔒 ';
    vider(onglets).append(
      onglet('carte', 'Carte'),
      onglet('preparer', cadenas + 'Préparer'),
      onglet('capturer', cadenas + 'Capturer'),
      onglet('caler', cadenas + 'Caler'));
  }

  async function changerMode(mode) {
    if (mode === etat.mode) return;
    if (mode !== 'carte' && !(await exigerAdmin())) return;
    fermerFeuille();
    etat.mode = mode;
    etat.action = null;
    etat.selection = null;
    if (carte) carte.retirerProvisoire();
    if (!lieu.plan) await monterCarte();
    dessiner();
  }

  // -------------------------------------------------------------------
  // Fiche d'un point (onglet Carte)
  // -------------------------------------------------------------------
  function ouvrirFiche(point) {
    const cat = lieux.categorie(point.categorie);
    const estBut = etat.destination === point.id;
    const d = distanceVers(point, maPlaceSurLePlan());
    const feuille = ouvrirFeuille({
      titre: `${cat.symbole} ${point.nom}`,
      contenu: [
        h('p', { class: 'aide' }, cat.nom + (d ? ` · à ${d.approx ? 'environ ' : ''}${formatDistance(d.metres)}` : '')),
        h('button', {
          class: 'btn btn-large' + (estBut ? '' : ' btn-principal'),
          onclick: () => {
            etat.destination = estBut ? null : point.id;
            fermerFeuille();
            if (!estBut) voirTrajet();
          },
        }, estBut ? '✕ Ne plus y aller' : '🧭 Y aller'),
      ],
      surFermeture: deselectionner,
    });
    garderVisible(point, feuille);
  }

  // -------------------------------------------------------------------
  // Formulaire d'un point (onglet Préparer)
  // -------------------------------------------------------------------
  function formulairePoint({ titreFeuille, point, texteValider, surValidation, extras }) {
    let cat = point.categorie;
    const nom = h('input', {
      class: 'champ', type: 'text', value: point.nom, placeholder: 'Nom du point',
      autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'done',
    });
    const grille = h('div', { class: 'grille-categories' });
    const dessinerCategories = () => {
      vider(grille);
      for (const c of CATEGORIES) {
        grille.append(h('button', {
          type: 'button', class: 'puce' + (c.id === cat ? ' active' : ''), style: `--c:${c.couleur}`,
          onclick: () => { cat = c.id; dessinerCategories(); },
        }, `${c.symbole} ${c.nom}`));
      }
    };
    dessinerCategories();
    const formulaire = h('form', {
      class: 'pile',
      onsubmit: async (e) => {
        e.preventDefault();
        const n = nom.value.trim();
        if (!n) { nom.focus(); return; }
        etat.derniereCategorie = cat;
        await surValidation({ nom: n, categorie: cat });
        fermerFeuille();
      },
    }, nom, grille, h('button', { type: 'submit', class: 'btn btn-principal btn-large' }, texteValider), extras);
    const feuille = ouvrirFeuille({ titre: titreFeuille, contenu: formulaire, surFermeture: deselectionner });
    if (!point.nom) nom.focus();
    return feuille;
  }

  function nouveauPointIci(p) {
    carte.montrerProvisoire(p.x, p.y);
    const feuille = formulairePoint({
      titreFeuille: 'Nouveau point',
      point: { nom: '', categorie: etat.derniereCategorie },
      texteValider: 'Ajouter ce point',
      surValidation: async (v) => {
        lieu.points.push(lieux.nouveauPoint({ ...v, x: p.x, y: p.y }));
        await sauver();
        toast(`« ${v.nom} » ajouté`);
      },
    });
    garderVisible(p, feuille);
  }

  function ouvrirEdition(point) {
    const place = lieux.estPlace(point);
    const feuille = formulairePoint({
      titreFeuille: 'Modifier le point',
      point,
      texteValider: 'Enregistrer',
      surValidation: async (v) => {
        Object.assign(point, v, { maj: Date.now() });
        await sauver();
      },
      extras: h('div', { class: 'rangee' },
        h('button', { type: 'button', class: 'btn', onclick: () => (place ? commencerDeplacement(point) : commencerPlacement([point.id])) },
          place ? '✥ Déplacer' : '📍 Placer sur le plan'),
        h('button', { type: 'button', class: 'btn btn-danger', onclick: () => supprimerPoint(point) }, '🗑 Supprimer')),
    });
    garderVisible(point, feuille);
  }

  async function supprimerPoint(point) {
    const ok = await confirmer({
      titre: 'Supprimer ce point ?',
      message: `« ${point.nom} »` + (point.capture ? ' — sa capture GPS sera perdue.' : ''),
      valider: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    lieu.points = lieu.points.filter((p) => p.id !== point.id);
    await sauver();
    fermerFeuille();
    dessiner();
    toast('Point supprimé');
  }

  // -------------------------------------------------------------------
  // Liste des points : recherche, filtres par catégorie
  // -------------------------------------------------------------------
  function ouvrirListe() {
    const preparation = etat.mode === 'preparer';
    const champ = h('input', {
      class: 'champ', type: 'search', placeholder: 'Chercher un point…', value: etat.recherche,
      autocomplete: 'off', enterKeyHint: 'search',
      oninput: () => { etat.recherche = champ.value; remplir(); },
    });
    const filtres = h('div', { class: 'puces' });
    const tete = h('div', { class: 'pile' });
    const corps = h('div', { class: 'liste' });

    function dessinerFiltres() {
      vider(filtres);
      for (const c of CATEGORIES) {
        const nombre = lieu.points.filter((p) => p.categorie === c.id).length;
        if (!nombre) continue;
        filtres.append(h('button', {
          class: 'puce' + (etat.masquees.has(c.id) ? '' : ' active'), style: `--c:${c.couleur}`,
          'aria-pressed': String(!etat.masquees.has(c.id)),
          onclick: () => {
            if (etat.masquees.has(c.id)) etat.masquees.delete(c.id); else etat.masquees.add(c.id);
            dessinerFiltres();
            remplir();
            dessiner();
          },
        }, `${c.symbole} ${c.nom} (${nombre})`));
      }
    }

    function remplir() {
      vider(tete);
      vider(corps);
      const q = sansAccents(etat.recherche);
      const visibles = lieu.points.filter((p) => !etat.masquees.has(p.categorie) && (!q || sansAccents(p.nom).includes(q)));
      const aPlacer = visibles.filter((p) => !lieux.estPlace(p));
      const places = visibles.filter(lieux.estPlace).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      if (preparation && lieu.plan && aPlacer.length > 1) {
        tete.append(h('button', { class: 'btn btn-principal btn-large', onclick: () => commencerPlacement(aPlacer.map((p) => p.id)) },
          `📍 Placer ces ${aPlacer.length} points à la suite`));
      }
      if (!lieu.points.length) {
        corps.append(h('p', { class: 'vide' }, preparation
          ? 'Aucun point. Touche le plan pour en poser un, ou colle une liste.'
          : 'Aucun point pour l\'instant.'));
      } else if (!visibles.length) {
        corps.append(h('p', { class: 'vide' }, 'Aucun point ne correspond.'));
      }
      // Les points à placer d'abord (dans l'ordre de la liste collée), puis les autres par ordre alphabétique.
      for (const p of [...aPlacer, ...places]) {
        const cat = lieux.categorie(p.categorie);
        corps.append(h('button', { class: 'ligne', onclick: () => choisir(p) },
          h('span', { class: 'ligne-symbole', style: `--c:${cat.couleur}` }, cat.symbole),
          h('span', { class: 'ligne-nom' }, p.nom),
          !lieux.estPlace(p) && h('span', { class: 'badge badge-attention' }, 'à placer'),
          p.capture && h('span', { class: 'badge badge-ok' }, 'capturé')));
      }
    }

    function choisir(point) {
      if (!lieux.estPlace(point)) {
        if (!preparation) { toast('Ce point n\'est pas encore placé sur le plan.'); return; }
        if (!lieu.plan) { toast('Importe d\'abord l\'image du plan.'); return; }
        commencerPlacement([point.id]);
        return;
      }
      fermerFeuille();
      etat.selection = point.id;
      dessiner();
      if (carte) carte.centrer(point.x, point.y);
      if (preparation) ouvrirEdition(point); else ouvrirFiche(point);
    }

    dessinerFiltres();
    remplir();
    ouvrirFeuille({ titre: `Points (${lieu.points.length})`, contenu: [champ, filtres, tete, corps], haute: true });
  }

  // -------------------------------------------------------------------
  // Coller une liste de points
  // -------------------------------------------------------------------
  function ouvrirCollage() {
    const zoneTexte = h('textarea', {
      class: 'champ zone-texte', rows: 8, spellcheck: false, autocapitalize: 'off',
      placeholder: 'Un point par ligne :\nKondaa;attraction\nPizza Solo;restauration\nLoge;base technique',
      oninput: analyser,
    });
    const resume = h('p', { class: 'aide' });
    const bouton = h('button', { class: 'btn btn-principal btn-large', disabled: true, onclick: ajouter }, 'Ajouter');
    let analyse = { points: [] };

    function analyser() {
      analyse = lieux.analyserListe(zoneTexte.value, lieu.points);
      const n = analyse.points.length;
      const morceaux = [`${n} point${n > 1 ? 's' : ''} reconnu${n > 1 ? 's' : ''}`];
      if (analyse.doublons.length) morceaux.push(`${analyse.doublons.length} déjà présent${analyse.doublons.length > 1 ? 's' : ''} (ignoré${analyse.doublons.length > 1 ? 's' : ''})`);
      if (analyse.categoriesInconnues.length) {
        morceaux.push(`catégorie inconnue classée « Autre » : ${[...new Set(analyse.categoriesInconnues)].join(', ')}`);
      }
      resume.textContent = zoneTexte.value.trim() ? morceaux.join(' · ') : '';
      bouton.disabled = !n;
      bouton.textContent = n ? `Ajouter ${n} point${n > 1 ? 's' : ''}` : 'Ajouter';
    }

    async function ajouter() {
      const n = analyse.points.length;
      if (!n) return;
      lieu.points.push(...analyse.points);
      await sauver();
      toast(`${n} point${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}. Il reste à les placer sur le plan.`, 'info', 5000);
      dessiner();
      ouvrirListe();
    }

    ouvrirFeuille({
      titre: 'Coller une liste de points',
      haute: true,
      contenu: [
        h('p', { class: 'aide' }, 'Une ligne par point : le nom, un point-virgule, la catégorie. Un copier-coller de deux colonnes Excel marche aussi.'),
        zoneTexte,
        resume,
        bouton,
        h('p', { class: 'aide' }, 'Catégories : ' + CATEGORIES.map((c) => c.nom.toLowerCase()).join(', ') + '.'),
      ],
    });
  }

  // -------------------------------------------------------------------
  // Menu du lieu
  // -------------------------------------------------------------------
  function ouvrirMenu() {
    const bouton = (texte, action, classe = '') => h('button', { class: 'btn btn-large btn-gauche ' + classe, onclick: action }, texte);
    const simulees = lieu.points.filter((p) => p.capture && p.capture.simulee).length;
    ouvrirFeuille({
      titre: lieu.nom,
      haute: true,
      contenu: [
        etat.admin && bouton(lieu.session ? `📡 Republier pour l'équipe (session ${lieu.session.code})` : '📡 Publier pour l\'équipe', publierPourEquipe),
        lieu.session && bouton(profil ? `👤 Mon profil (${profil.pseudo})` : '👤 Choisir mon pseudo', modifierProfil),
        bouton('📤 Exporter ce lieu (fichier)', exporter),
        bouton(etat.simulation ? '🧪 Arrêter la simulation' : '🧪 Mode simulation (tester chez soi)', basculerSimulation),
        !etat.simulation && derniere.source === 'gps' && bouton('📡 Arrêter ma position', () => { fermerFeuille(); position.arreter(); arreterAntiVeille(); }),
        etat.admin && simulees > 0 && bouton(`🧹 Effacer les ${simulees} captures simulées`, effacerCapturesSimulees),
        etat.admin && bouton('🖼 Changer l\'image du plan', importerPlan),
        etat.admin && bouton('✏️ Renommer le lieu', renommer),
        etat.admin
          ? bouton('🔒 Verrouiller le mode admin', verrouiller)
          : bouton('🔓 Déverrouiller le mode admin', deverrouillerDepuisMenu),
        bouton('🩺 Diagnostic du téléphone', () => { location.hash = '#/diagnostic'; }),
        lieu.session && bouton('🚪 Quitter la session', quitterSession),
        etat.admin && bouton('🗑 Supprimer ce lieu', supprimerLieu, 'btn-danger'),
      ],
    });
  }

  async function deverrouillerDepuisMenu() {
    fermerFeuille();
    if (!(await exigerAdmin())) return;
    toast('Mode admin déverrouillé');
    if (!lieu.plan) await monterCarte();
    dessiner();
  }

  async function verrouiller() {
    fermerFeuille();
    await lieux.verrouiller(lieu.id);
    etat.admin = false;
    etat.mode = 'carte';
    etat.action = null;
    etat.selection = null;
    if (!lieu.plan) await monterCarte();
    dessiner();
    toast('Mode admin verrouillé');
  }

  async function exporter() {
    fermerFeuille();
    let fichier;
    try {
      fichier = await lieux.exporterLieu(lieu.id);
    } catch (e) {
      toast('Export impossible : ' + e.message, 'erreur', 6000);
      return;
    }
    // Le partage doit partir directement d'un appui (exigence d'iOS) : d'où ce second bouton.
    ouvrirFeuille({
      titre: 'Fichier prêt',
      contenu: [
        h('p', null, `${fichier.name} (${formatOctets(fichier.size)})`),
        h('p', { class: 'aide' }, 'Ce fichier contient tout le lieu : plan, points, captures, calage. Envoie-le-toi (mail, WhatsApp, Drive) pour le sauvegarder, ou pour l\'ouvrir sur un autre appareil avec « Importer un lieu ».'),
        h('button', {
          class: 'btn btn-principal btn-large',
          onclick: async () => {
            const resultat = await partagerOuTelecharger(fichier);
            if (resultat === 'telecharge') toast('Fichier enregistré dans les téléchargements');
            if (resultat !== 'annule') fermerFeuille();
          },
        }, '📤 Envoyer / enregistrer le fichier'),
      ],
    });
  }

  async function importerPlan() {
    fermerFeuille();
    const fichier = await choisirFichier('image/jpeg,image/png,image/webp');
    if (!fichier) return;
    toast('Préparation de l\'image…');
    let image;
    try {
      image = await lieux.preparerImagePlan(fichier);
    } catch (e) {
      toast(e.message, 'erreur', 6000);
      return;
    }
    const tailleChange = lieu.plan && (lieu.plan.largeur !== image.largeur || lieu.plan.hauteur !== image.hauteur);
    if (tailleChange && lieu.points.some(lieux.estPlace)) {
      const ok = await confirmer({
        titre: 'Remplacer le plan ?',
        message: 'La nouvelle image n\'a pas la même taille. Les points déjà placés seront remis à l\'échelle : c\'est bon si c\'est le même dessin, sinon il faudra les replacer. Le calage sera à refaire.',
        valider: 'Remplacer',
      });
      if (!ok) return;
    }
    try {
      await lieux.definirPlan(lieu, image);
    } catch (e) {
      toast('Enregistrement du plan impossible : ' + e.message, 'erreur', 6000);
      return;
    }
    await monterCarte();
    dessiner();
    toast(image.reduite ? `Plan importé (image réduite à ${image.largeur} × ${image.hauteur} pixels)` : 'Plan importé ✅', 'info', 5000);
  }

  async function renommer() {
    fermerFeuille();
    const v = await demander({
      titre: 'Renommer le lieu',
      champs: [{ nom: 'nom', label: 'Nom du lieu', valeur: lieu.nom, majuscules: true }],
      valider: 'Renommer',
    });
    if (!v) return;
    lieu.nom = v.nom;
    await sauver();
    titre.textContent = lieu.nom;
  }

  async function supprimerLieu() {
    fermerFeuille();
    const ok = await confirmer({
      titre: 'Supprimer ce lieu ?',
      message: `« ${lieu.nom} », son plan, ses ${lieu.points.length} points et ses traces seront effacés de ce téléphone. Exporte-le d'abord si tu veux le garder.`,
      valider: 'Supprimer définitivement',
      danger: true,
    });
    if (!ok) return;
    await lieux.supprimerLieu(lieu.id);
    toast('Lieu supprimé');
    location.hash = '#/';
  }

  // Les barres d'abord (pour que le plan connaisse sa vraie hauteur), puis le plan.
  recalculer();
  dessiner();
  await monterCarte();
  dessiner();

  const desabonner = position.abonner((i) => { derniere = i; dessinerPosition(); });
  // Chaque seconde : ancienneté de ma position ; toutes les 3 secondes : celle des autres
  // (et, en simulation, les coéquipiers fictifs font quelques pas).
  const horloge = setInterval(() => {
    dessinerPosition();
    if (++battements % 3 === 0) {
      if (etat.simulation) bougerFauxEquipiers();
      dessinerEquipe();
    }
  }, 1000);

  // Dès qu'on revient dans l'appli ou que le réseau revient : on resynchronise tout de suite.
  const reprendre = () => { if (document.visibilityState === 'visible') synchroniser(); };
  document.addEventListener('visibilitychange', reprendre);
  window.addEventListener('online', reprendre);
  synchroniser();

  return () => {
    syncActive = false;
    clearTimeout(minuterieSync);
    document.removeEventListener('visibilitychange', reprendre);
    window.removeEventListener('online', reprendre);
    clearInterval(horloge);
    if (fermerPoche) fermerPoche();
    desabonner();
    position.arreter();
    arreterAntiVeille();
    if (carte) carte.detruire();
    if (urlImage) URL.revokeObjectURL(urlImage);
  };
}
