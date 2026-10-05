// Service worker : garde l'appli en mémoire pour qu'elle s'ouvre sans réseau.
//
// À CHAQUE PUBLICATION : changer VERSION ici ET dans js/version.js (même valeur).
// C'est ce changement qui déclenche la mise à jour sur les téléphones.
const VERSION = '0.3.0';

const CACHE = 'ibilaw-' + VERSION;
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'config.js',
  'css/app.css',
  'js/app.js',
  'js/calage.js',
  'js/carte.js',
  'js/ecran-accueil.js',
  'js/ecran-diagnostic.js',
  'js/ecran-lieu.js',
  'js/lieux.js',
  'js/outils.js',
  'js/poche.js',
  'js/position.js',
  'js/pwa.js',
  'js/simulation.js',
  'js/stockage.js',
  'js/terrain.js',
  'js/veille.js',
  'js/veille-media.js',
  'js/version.js',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

// Installation : on télécharge tout. Si un seul fichier manque, on n'installe rien
// (mieux vaut l'ancienne version complète qu'une nouvelle à moitié).
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FICHIERS.map(async (fichier) => {
      const reponse = await fetch(new Request(fichier, { cache: 'reload' }));
      if (!reponse.ok) throw new Error('Fichier manquant : ' + fichier);
      await cache.put(fichier, reponse);
    }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith('ibilaw-') && nom !== CACHE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

// La page demande d'activer la nouvelle version (bouton « Mettre à jour »).
self.addEventListener('message', (e) => {
  if (e.data === 'activer') self.skipWaiting();
});

// Les fichiers de l'appli sont toujours servis depuis la mémoire : ouverture
// immédiate, avec ou sans réseau.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const enMemoire = await cache.match(e.request, { ignoreSearch: true });
    if (enMemoire) return enMemoire;
    if (e.request.mode === 'navigate') {
      const accueil = await cache.match('index.html');
      if (accueil) return accueil;
    }
    return fetch(e.request);
  })());
});
