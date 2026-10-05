// Fenêtre « qui suis-je ? » : pseudo et fonction (et code de session pour rejoindre).

import { FONCTIONS } from '../config.js';
import { h } from './outils.js';

const AUTRE = FONCTIONS[FONCTIONS.length - 1].nom;

// Renvoie { code, pseudo, fonction }, ou null si annulé.
export function demanderProfil({ titre, message, avecCode = false, profil = null, valider = 'OK' }) {
  return new Promise((resoudre) => {
    const fonctionConnue = profil && FONCTIONS.some((f) => f.nom === profil.fonction);
    const champCode = h('input', {
      class: 'champ', type: 'text', placeholder: 'WALIBI25', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false,
    });
    const champPseudo = h('input', {
      class: 'champ', type: 'text', value: profil ? profil.pseudo : '', placeholder: 'Ton prénom ou ton surnom',
      maxLength: 24, autocomplete: 'off', autocapitalize: 'words',
    });
    const choix = h('select', { class: 'champ' },
      FONCTIONS.map((f) => h('option', { value: f.nom }, f.nom === AUTRE ? 'Autre (à préciser)' : f.nom)));
    choix.value = profil ? (fonctionConnue ? profil.fonction : AUTRE) : FONCTIONS[0].nom;
    const champLibre = h('input', {
      class: 'champ', type: 'text', value: profil && !fonctionConnue ? profil.fonction : '', placeholder: 'Ta fonction',
      maxLength: 40, autocomplete: 'off', hidden: choix.value !== AUTRE,
    });
    choix.addEventListener('change', () => {
      champLibre.hidden = choix.value !== AUTRE;
      if (!champLibre.hidden) champLibre.focus();
    });

    const finir = (resultat) => { fond.remove(); resoudre(resultat); };
    const formulaire = h('form', {
      class: 'dialogue',
      onclick: (e) => e.stopPropagation(),
      onsubmit: (e) => {
        e.preventDefault();
        const code = champCode.value.trim();
        const pseudo = champPseudo.value.trim();
        if (avecCode && !code) { champCode.focus(); return; }
        if (!pseudo) { champPseudo.focus(); return; }
        finir({ code, pseudo, fonction: choix.value === AUTRE ? (champLibre.value.trim() || AUTRE) : choix.value });
      },
    },
    h('h2', null, titre),
    message && h('p', { class: 'dialogue-message' }, message),
    avecCode && h('label', { class: 'champ-bloc' }, h('span', null, 'Code de session'), champCode),
    h('label', { class: 'champ-bloc' }, h('span', null, 'Pseudo'), champPseudo),
    h('label', { class: 'champ-bloc' }, h('span', null, 'Fonction'), choix, champLibre,
      h('small', null, 'Ton pseudo et ta fonction s\'affichent sur le plan des autres, avec une couleur par fonction.')),
    h('div', { class: 'dialogue-boutons' },
      h('button', { type: 'button', class: 'btn', onclick: () => finir(null) }, 'Annuler'),
      h('button', { type: 'submit', class: 'btn btn-principal' }, valider)));
    const fond = h('div', { class: 'dialogue-fond', onclick: () => finir(null) }, formulaire);
    document.body.append(fond);
    (avecCode ? champCode : champPseudo).focus();
  });
}

// 45 -> « 45 s », 200 -> « 3 min », 9000 -> « 3 h »
export function formatAge(secondes) {
  if (secondes < 60) return `${secondes} s`;
  if (secondes < 3600) return `${Math.round(secondes / 60)} min`;
  return `${Math.round(secondes / 3600)} h`;
}
