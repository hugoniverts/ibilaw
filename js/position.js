// Ma position : GPS réel du téléphone, ou position fictive (mode simulation).
// Les écrans s'abonnent et reçoivent { source, etat, position, message } à chaque changement.
//
//   source : 'arret' | 'gps' | 'simulation'
//   etat   : 'arret' | 'recherche' | 'ok' | 'refuse' | 'erreur'
//   position : { lat, lon, precision (mètres), date } ou null

import { hasardCloche } from './simulation.js';

const RAD = Math.PI / 180;
const abonnes = new Set();
let source = 'arret';
let etat = 'arret';
let position = null;
let message = '';
let suivi = null;         // suivi GPS en cours
let minuterie = null;     // battement de la simulation
let vraie = null;         // vraie position fictive (avant tremblement)

export const instantane = () => ({ source, etat, position, message });

function publier() {
  const i = instantane();
  for (const f of abonnes) f(i);
}

// Renvoie une fonction pour se désabonner.
export function abonner(fn) {
  abonnes.add(fn);
  fn(instantane());
  return () => abonnes.delete(fn);
}

function lancerSuivi() {
  if (suivi !== null) navigator.geolocation.clearWatch(suivi);
  suivi = navigator.geolocation.watchPosition((p) => {
    position = { lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy, date: Date.now() };
    etat = 'ok';
    message = '';
    publier();
  }, (err) => {
    if (err.code === 1) {
      etat = 'refuse';
      message = 'Accès à la position refusé. Autorise-le dans les réglages du téléphone (voir Diagnostic).';
    } else if (etat !== 'ok') {
      etat = 'erreur';
      message = 'Position introuvable pour l\'instant. Réessaie dehors.';
    }
    publier();
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
}

function couper() {
  if (suivi !== null) { navigator.geolocation.clearWatch(suivi); suivi = null; }
  if (minuterie !== null) { clearInterval(minuterie); minuterie = null; }
}

export function demarrerGps() {
  couper();
  position = null;
  message = '';
  if (!('geolocation' in navigator)) {
    source = 'gps'; etat = 'erreur'; message = 'Ce navigateur ne donne pas accès au GPS.';
    publier();
    return;
  }
  source = 'gps';
  etat = 'recherche';
  lancerSuivi();
  publier();
}

export function demarrerSimulation() {
  couper();
  source = 'simulation';
  position = null;
  message = '';
  etat = vraie ? 'ok' : 'recherche';
  minuterie = setInterval(battre, 1000);
  battre();
  publier();
}

// Déplace la position fictive (appelé quand on touche le plan en simulation).
export function placerSimulation(lat, lon) {
  vraie = { lat, lon };
  if (source === 'simulation') battre();
}

function battre() {
  if (!vraie) return;
  const precision = 4 + Math.random() * 5;
  const tremblement = precision * 0.5;
  position = {
    lat: vraie.lat + (hasardCloche() * tremblement) / 111320,
    lon: vraie.lon + (hasardCloche() * tremblement) / (111320 * Math.cos(vraie.lat * RAD)),
    precision,
    date: Date.now(),
  };
  etat = 'ok';
  publier();
}

export function arreter() {
  couper();
  source = 'arret';
  etat = 'arret';
  position = null;
  message = '';
  publier();
}

// Au retour dans l'appli, le téléphone a pu suspendre le GPS : on le relance.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && source === 'gps') lancerSuivi();
});

// Fait la moyenne de la position pendant quelques secondes (capture d'un point).
// Les mesures précises comptent plus que les imprécises.
// Renvoie { lat, lon, precision, mesures } ou null si aucune mesure n'est arrivée.
export function capturer(dureeSecondes, surProgression) {
  return new Promise((resoudre) => {
    const mesures = [];
    const debut = Date.now();
    let derniereDate = 0;
    const desabonner = abonner((i) => {
      if (i.etat !== 'ok' || !i.position || i.position.date === derniereDate || i.position.date < debut) return;
      derniereDate = i.position.date;
      mesures.push(i.position);
    });
    const horloge = setInterval(() => {
      const ecoule = (Date.now() - debut) / 1000;
      if (surProgression) surProgression(Math.min(1, ecoule / dureeSecondes), mesures.length);
      if (ecoule < dureeSecondes) return;
      clearInterval(horloge);
      desabonner();
      if (!mesures.length) { resoudre(null); return; }
      let poids = 0; let lat = 0; let lon = 0;
      for (const m of mesures) {
        const w = 1 / Math.max(1, m.precision) ** 2;
        poids += w; lat += w * m.lat; lon += w * m.lon;
      }
      const precisions = mesures.map((m) => m.precision).sort((x, y) => x - y);
      resoudre({
        lat: lat / poids,
        lon: lon / poids,
        precision: precisions[Math.floor(precisions.length / 2)],
        mesures: mesures.length,
      });
    }, 250);
  });
}
