// Empêche l'écran de s'éteindre tant que l'appli est ouverte.
// Sur iPhone, le GPS d'une web app s'arrête dès que l'écran se verrouille :
// garder l'écran allumé est donc indispensable.
//
// Deux méthodes :
//  - « systeme » : la fonction officielle du navigateur (Wake Lock) ;
//  - « video »   : solution de secours pour les iPhone plus anciens — une mini-vidéo
//                  silencieuse qui tourne en boucle (technique de NoSleep.js).

import { VIDEO_WEBM, VIDEO_MP4 } from './veille-media.js';
import { h } from './outils.js';

let verrou = null;      // verrou système en cours
let video = null;       // vidéo de secours en cours
let voulue = false;     // l'utilisateur veut-il l'anti-veille ?

export function infosAppareil() {
  const ua = navigator.userAgent;
  const iPhone = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  let iosVersion = null;
  const m = ua.match(/OS (\d+)_(\d+)/);
  if (iPhone && m) iosVersion = parseInt(m[1], 10) + parseInt(m[2], 10) / 100;
  const installee = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return { iPhone, android: /Android/.test(ua), iosVersion, installee };
}

// Avant iOS 18.4, le Wake Lock officiel existe mais ne marche pas dans une appli
// installée sur l'écran d'accueil : on passe alors par la vidéo de secours.
function methodePreferee() {
  const a = infosAppareil();
  const systemeDispo = 'wakeLock' in navigator;
  const systemeDouteux = a.iPhone && a.installee && a.iosVersion !== null && a.iosVersion < 18.04;
  if (systemeDispo && !systemeDouteux) return 'systeme';
  if (a.iPhone || !systemeDispo) return 'video';
  return 'systeme';
}

async function activerSysteme() {
  verrou = await navigator.wakeLock.request('screen');
  verrou.addEventListener('release', () => { verrou = null; });
}

async function activerVideo() {
  if (!video) {
    video = h('video', { title: 'IBILAW', playsInline: true, loop: true, style: 'position:fixed;left:-10px;top:-10px;width:1px;height:1px;opacity:0.01' },
      h('source', { src: VIDEO_WEBM, type: 'video/webm' }),
      h('source', { src: VIDEO_MP4, type: 'video/mp4' }));
    video.setAttribute('playsinline', '');
    document.body.append(video);
  }
  await video.play();
}

// À appeler depuis un appui de l'utilisateur (exigence des navigateurs).
// Renvoie 'systeme', 'video', ou null si rien n'a marché.
export async function activerAntiVeille() {
  voulue = true;
  const ordre = methodePreferee() === 'systeme' ? ['systeme', 'video'] : ['video', 'systeme'];
  for (const methode of ordre) {
    try {
      if (methode === 'systeme') {
        if (!('wakeLock' in navigator)) continue;
        await activerSysteme();
      } else {
        await activerVideo();
      }
      return methode;
    } catch { /* on essaie la méthode suivante */ }
  }
  return null;
}

export function arreterAntiVeille() {
  voulue = false;
  if (verrou) { verrou.release().catch(() => {}); verrou = null; }
  if (video) { video.pause(); video.remove(); video = null; }
}

export function etatAntiVeille() {
  if (verrou) return 'systeme';
  if (video && !video.paused) return 'video';
  return null;
}

// Le système relâche le verrou quand on quitte l'appli : on le reprend au retour.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !voulue) return;
  if (video) video.play().catch(() => {});
  else if (!verrou && 'wakeLock' in navigator) activerSysteme().catch(() => {});
});
