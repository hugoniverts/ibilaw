// Démarrage de l'appli et passage d'un écran à l'autre.
// L'adresse (après le #) dit quel écran afficher :
//   #/               accueil (liste des lieux)
//   #/lieu/<id>      un lieu (plan, points…)
//   #/diagnostic     vérification du téléphone

import { h, vider, fermerFeuille } from './outils.js';
import { demanderConservation } from './stockage.js';
import { demarrerPwa } from './pwa.js';
import { ecranAccueil } from './ecran-accueil.js';
import { ecranLieu } from './ecran-lieu.js';
import { ecranDiagnostic } from './ecran-diagnostic.js';

const racine = document.getElementById('app');
let nettoyer = null;
let numero = 0;
let routePrecedente = '#/';
let routeCourante = '#/';

async function afficher() {
  const moi = ++numero;
  if (nettoyer) { try { nettoyer(); } catch (e) { console.warn(e); } nettoyer = null; }
  fermerFeuille();
  routePrecedente = routeCourante;
  routeCourante = location.hash || '#/';

  const zone = h('div', { class: 'ecran' });
  vider(racine).append(zone);
  const morceaux = routeCourante.replace(/^#\/?/, '').split('/');
  const retour = () => { location.hash = routePrecedente.startsWith('#/lieu/') ? routePrecedente : '#/'; };

  let fin = null;
  try {
    if (morceaux[0] === 'lieu' && morceaux[1]) fin = await ecranLieu(zone, morceaux[1]);
    else if (morceaux[0] === 'diagnostic') fin = await ecranDiagnostic(zone, { retour });
    else fin = await ecranAccueil(zone);
  } catch (e) {
    console.error(e);
    vider(zone).append(h('div', { class: 'ecran-page' },
      h('h1', null, 'Oups'),
      h('p', null, 'Cet écran n\'a pas pu s\'afficher : ' + (e && e.message ? e.message : e)),
      h('button', { class: 'btn btn-large', onclick: () => { location.hash = '#/'; location.reload(); } }, 'Revenir à l\'accueil')));
  }
  // Si on a changé d'écran pendant le chargement, on range tout de suite celui-ci.
  if (moi === numero) nettoyer = fin || null;
  else if (fin) fin();
}

window.addEventListener('hashchange', afficher);
demarrerPwa();
demanderConservation();
afficher();
