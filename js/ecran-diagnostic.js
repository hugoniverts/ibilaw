// Écran « Diagnostic » : dit à chacun si son téléphone est prêt.

import { VERSION } from './version.js';
import { REGLAGES } from '../config.js';
import { h, formatOctets } from './outils.js';
import { etatStockage } from './stockage.js';
import { etatHorsLigne } from './pwa.js';
import { infosAppareil, activerAntiVeille, arreterAntiVeille, etatAntiVeille } from './veille.js';
import { serveurJoignable } from './partage.js';

const SYMBOLES = { ok: '✅', attention: '⚠️', erreur: '❌', attente: '⏳' };

export async function ecranDiagnostic(zone, { retour }) {
  zone.classList.add('ecran-page');
  const a = infosAppareil();
  const liste = h('div', { class: 'pile' });
  zone.append(
    h('header', { class: 'entete-page' },
      h('button', { class: 'btn-icone', 'aria-label': 'Retour', onclick: retour }, '‹'),
      h('h1', null, 'Diagnostic')),
    h('p', { class: 'aide' }, 'Tout doit être vert avant le jour J. Les lignes GPS et anti-veille se testent avec leur bouton.'),
    liste);

  function ligne(titre) {
    const pastille = h('span', { class: 'diag-pastille' }, SYMBOLES.attente);
    const detail = h('div', { class: 'diag-detail' });
    const actions = h('div', { class: 'diag-actions' });
    liste.append(h('div', { class: 'diag-ligne' }, pastille,
      h('div', { class: 'diag-texte' }, h('div', { class: 'diag-titre' }, titre), detail, actions)));
    return {
      actions,
      regler(etat, texte) { pastille.textContent = SYMBOLES[etat]; detail.textContent = texte; },
    };
  }

  // --- Téléphone
  const tel = ligne('Téléphone');
  if (a.iPhone && a.iosVersion !== null && a.iosVersion < 16.04) {
    tel.regler('erreur', 'iPhone avec un iOS trop ancien. Mets-le à jour (iOS 16.4 minimum, 18.4 ou plus conseillé).');
  } else if (a.iPhone) {
    tel.regler('ok', 'iPhone / iPad' + (a.iosVersion ? ` (iOS ${Math.floor(a.iosVersion)} ou plus récent)` : ''));
  } else {
    tel.regler('ok', a.android ? 'Téléphone Android' : 'Ordinateur');
  }

  // --- Installation
  const inst = ligne('Installée sur l\'écran d\'accueil');
  if (a.installee) inst.regler('ok', 'Oui, l\'appli est ouverte depuis son icône.');
  else if (a.iPhone || a.android) inst.regler('attention', 'Pas encore. Installe-la depuis l\'écran d\'accueil de l\'appli, puis relance ce diagnostic depuis l\'icône.');
  else inst.regler('ok', 'Sur ordinateur, pas besoin de l\'installer.');

  // --- HTTPS
  const https = ligne('Connexion sécurisée');
  if (window.isSecureContext) https.regler('ok', 'Oui (indispensable pour le GPS).');
  else https.regler('erreur', 'Non : le GPS ne fonctionnera pas à cette adresse.');

  // --- Hors-ligne
  const hl = ligne('Fonctionnement hors ligne');
  const etatHl = await etatHorsLigne();
  if (etatHl.pret) hl.regler('ok', `Prêt : la version ${VERSION} est gardée en mémoire.`);
  else if (etatHl.raison === 'test-local') hl.regler('attention', 'Désactivé pendant les tests sur ordinateur.');
  else if (etatHl.raison === 'non-gere') hl.regler('erreur', 'Ce navigateur ne sait pas garder l\'appli en mémoire.');
  else hl.regler('attention', 'Pas encore prêt. Garde la page ouverte quelques secondes avec du réseau, puis reviens ici.');

  // --- Mémoire
  const mem = ligne('Mémoire du téléphone');
  const st = await etatStockage();
  if (!st.ok) {
    mem.regler('erreur', 'Impossible d\'enregistrer des données' + (st.erreur ? ` (${st.erreur})` : '') + '. La navigation privée bloque souvent la mémoire.');
  } else {
    const place = st.utilise != null && st.quota ? ` ${formatOctets(st.utilise)} utilisés sur ${formatOctets(st.quota)} disponibles.` : '';
    if (st.conserve) mem.regler('ok', 'Fonctionne, et les données sont protégées contre l\'effacement automatique.' + place);
    else mem.regler('attention', 'Fonctionne.' + place + ' Le téléphone peut effacer ces données s\'il manque de place : exporte ton lieu après chaque séance de travail.');
  }

  // --- Réseau
  const reseau = ligne('Réseau');
  const majReseau = () => (navigator.onLine
    ? reseau.regler('ok', 'Connecté.')
    : reseau.regler('attention', 'Hors ligne (l\'appli fonctionne quand même).'));
  majReseau();
  window.addEventListener('online', majReseau);
  window.addEventListener('offline', majReseau);

  // --- Serveur du partage d'équipe
  const serveur = ligne('Partage d\'équipe');
  serveur.regler('attente', 'Vérification du serveur…');
  serveurJoignable().then((ok) => {
    if (ok) serveur.regler('ok', 'Le serveur des positions répond.');
    else if (!navigator.onLine) serveur.regler('attention', 'Pas de réseau pour l\'instant : impossible de vérifier.');
    else serveur.regler('erreur', 'Le serveur ne répond pas. L\'organisateur doit vérifier sur supabase.com que le projet n\'est pas en pause (un projet gratuit s\'endort après 7 jours sans activité).');
  });

  // --- GPS
  const gps = ligne('GPS');
  gps.regler('attente', 'Appuie sur le bouton, puis autorise l\'accès à la position.');
  gps.actions.append(h('button', { class: 'btn', onclick: testerGps }, 'Tester le GPS'));
  function testerGps() {
    if (!('geolocation' in navigator)) { gps.regler('erreur', 'Ce navigateur ne donne pas accès au GPS.'); return; }
    gps.regler('attente', 'Recherche de la position… (jusqu\'à 20 secondes, de préférence dehors)');
    navigator.geolocation.getCurrentPosition((pos) => {
      const precision = Math.round(pos.coords.accuracy);
      if (precision <= REGLAGES.precisionAlerte) gps.regler('ok', `Position reçue, précise à ${precision} m.`);
      else gps.regler('attention', `Position reçue, mais précise à ${precision} m seulement. C'est normal en intérieur : réessaie dehors.`);
    }, (err) => {
      const messages = {
        1: 'Accès à la position refusé. Sur iPhone : Réglages > Confidentialité et sécurité > Service de localisation (activé), puis « Sites web Safari » sur « Lorsque l\'app est active » avec « Position exacte ». Ferme et rouvre ensuite l\'appli.',
        2: 'Position introuvable pour l\'instant. Réessaie dehors.',
        3: 'Pas de réponse du GPS en 20 secondes. Réessaie dehors.',
      };
      gps.regler('erreur', messages[err.code] || err.message);
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  // --- Anti-veille
  const veille = ligne('Anti-veille (écran toujours allumé)');
  const boutonVeille = h('button', { class: 'btn', onclick: basculerVeille }, 'Tester l\'anti-veille');
  veille.regler('attente', 'Sur iPhone, le GPS s\'arrête quand l\'écran s\'éteint : l\'appli doit donc garder l\'écran allumé.');
  veille.actions.append(boutonVeille);
  async function basculerVeille() {
    if (etatAntiVeille()) {
      arreterAntiVeille();
      boutonVeille.textContent = 'Tester l\'anti-veille';
      veille.regler('attente', 'Test arrêté.');
      return;
    }
    const methode = await activerAntiVeille();
    if (!methode) { veille.regler('erreur', 'Impossible d\'empêcher la mise en veille sur ce téléphone. Règle le verrouillage automatique sur « Jamais » le jour J.'); return; }
    boutonVeille.textContent = 'Arrêter le test';
    veille.regler('ok', `Activé (${methode === 'systeme' ? 'méthode du système' : 'méthode de secours'}). Pour vérifier : ne touche plus l'écran et attends un peu plus que ton délai de verrouillage habituel, il doit rester allumé.`);
  }

  zone.append(h('p', { class: 'pied' }, 'IBILAW version ' + VERSION));

  return () => {
    window.removeEventListener('online', majReseau);
    window.removeEventListener('offline', majReseau);
    arreterAntiVeille();
  };
}
