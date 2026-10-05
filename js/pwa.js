// Tout ce qui fait de la page une « appli » : fonctionnement hors ligne,
// mises à jour, installation sur l'écran d'accueil.

import { VERSION } from './version.js';
import { h } from './outils.js';

export const pwa = {
  invite: null,           // proposition d'installation d'Android / Chrome, quand elle existe
  surChangement: null,    // fonction appelée quand l'état change (pour rafraîchir l'accueil)
};

const prevenir = () => pwa.surChangement && pwa.surChangement();

// En test sur l'ordinateur (localhost), le cache hors ligne est désactivé pour voir
// tout de suite les modifications. Ajouter « ?sw » à l'adresse pour le tester quand même.
const enTestLocal = ['localhost', '127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('sw');

export function demarrerPwa() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pwa.invite = e; prevenir(); });
  window.addEventListener('appinstalled', () => { pwa.invite = null; prevenir(); });
  enregistrer();
}

async function enregistrer() {
  if (!('serviceWorker' in navigator) || enTestLocal) return;
  const avaitControleur = !!navigator.serviceWorker.controller;
  let recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    prevenir();
    // Première installation : rien à recharger. Mise à jour : on repart sur la nouvelle version.
    if (!avaitControleur || recharge) return;
    recharge = true;
    location.reload();
  });
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    // Une mise à jour attendait depuis la dernière fois : on l'applique dès l'ouverture.
    if (reg.waiting && avaitControleur) reg.waiting.postMessage('activer');
    reg.addEventListener('updatefound', () => {
      const nouveau = reg.installing;
      if (!nouveau) return;
      nouveau.addEventListener('statechange', () => {
        if (nouveau.state === 'installed' && navigator.serviceWorker.controller) proposerMiseAJour(nouveau);
      });
    });
    let dernierControle = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - dernierControle < 10 * 60 * 1000) return;
      dernierControle = Date.now();
      reg.update().catch(() => {});
    });
  } catch (e) {
    console.warn('Hors-ligne indisponible :', e);
  }
}

// Une nouvelle version est arrivée pendant l'utilisation : on laisse l'utilisateur
// choisir le moment (pas de rechargement surprise en pleine capture).
function proposerMiseAJour(nouveau) {
  if (document.querySelector('.maj-dispo')) return;
  document.body.append(h('div', { class: 'maj-dispo' },
    h('span', null, 'Nouvelle version prête'),
    h('button', { class: 'btn btn-principal', onclick: () => nouveau.postMessage('activer') }, 'Mettre à jour')));
}

export async function etatHorsLigne() {
  if (enTestLocal) return { pret: false, raison: 'test-local' };
  if (!('serviceWorker' in navigator) || !window.caches) return { pret: false, raison: 'non-gere' };
  const noms = await caches.keys();
  const enMemoire = noms.includes('ibilaw-' + VERSION);
  const pret = enMemoire && !!navigator.serviceWorker.controller;
  return { pret, raison: pret ? null : 'pas-encore' };
}

export async function installer() {
  if (!pwa.invite) return;
  pwa.invite.prompt();
  await pwa.invite.userChoice.catch(() => {});
  pwa.invite = null;
  prevenir();
}
