// Écran noir de poche : l'appli reste ouverte (donc le GPS continue), mais l'écran
// est noir et ne réagit plus aux appuis, pour glisser le téléphone dans une poche.
// Sur un écran OLED, le noir consomme aussi beaucoup moins de batterie.
// Pour revenir : garder le doigt appuyé 2 secondes.

import { h } from './outils.js';

const DUREE_APPUI = 2000;

// lireEtat() renvoie le petit texte affiché en gris (état du GPS).
// Renvoie une fonction qui ferme l'écran.
export function ouvrirEcranDePoche(lireEtat) {
  const info = h('div', { class: 'poche-info' });
  const ecran = h('div', { class: 'poche' },
    h('div', { class: 'poche-titre' }, 'Écran de poche'),
    info,
    h('div', { class: 'poche-aide' }, 'Garde le doigt appuyé 2 secondes pour revenir'),
    h('div', { class: 'poche-jauge' }, h('div')));
  let minuterie = null;

  const maj = () => { info.textContent = lireEtat(); };
  const horloge = setInterval(maj, 2000);
  maj();

  function fermer() {
    clearInterval(horloge);
    clearTimeout(minuterie);
    ecran.remove();
  }
  const relacher = () => { ecran.classList.remove('appui'); clearTimeout(minuterie); };
  ecran.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ecran.classList.add('appui');
    clearTimeout(minuterie);
    minuterie = setTimeout(fermer, DUREE_APPUI);
  });
  for (const fin of ['pointerup', 'pointercancel', 'pointerleave']) ecran.addEventListener(fin, relacher);
  ecran.addEventListener('contextmenu', (e) => e.preventDefault());

  document.body.append(ecran);
  return fermer;
}
