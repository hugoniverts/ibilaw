// Petits outils partagés par tous les écrans.

// Fabrique un élément HTML : h('button', { class: 'btn', onclick: f }, 'Texte')
export function h(balise, props, ...enfants) {
  const el = document.createElement(balise);
  for (const [cle, val] of Object.entries(props || {})) {
    if (val == null || val === false) continue;
    if (cle === 'class') el.className = val;
    else if (cle === 'style') el.setAttribute('style', val);
    else if (cle.startsWith('on') && typeof val === 'function') el.addEventListener(cle.slice(2), val);
    else if (cle in el && !cle.includes('-')) el[cle] = val;
    else el.setAttribute(cle, val === true ? '' : val);
  }
  ajouter(el, enfants);
  return el;
}

function ajouter(el, enfants) {
  for (const e of enfants) {
    if (e == null || e === false) continue;
    if (Array.isArray(e)) ajouter(el, e);
    else el.append(e.nodeType ? e : document.createTextNode(String(e)));
  }
}

// Ajoute des enfants à un élément existant, en ignorant les valeurs vides
// (pratique pour écrire « condition && élément »).
export function mettre(el, ...enfants) {
  ajouter(el, enfants);
  return el;
}

export function vider(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

export function echapper(texte) {
  return String(texte).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function idCourt() {
  const o = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(o, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

// « Maison Hantée » -> « maison hantee » (pour comparer sans accents ni majuscules)
export function sansAccents(texte) {
  return String(texte).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function formatOctets(n) {
  if (n < 1024) return n + ' o';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';
  return (n / 1024 / 1024 / 1024).toFixed(1).replace('.', ',') + ' Go';
}

export function formatDate(ms) {
  return new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export async function hacher(texte) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function tamponVersBase64(tampon) {
  const o = new Uint8Array(tampon);
  let s = '';
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64VersTampon(b64) {
  const s = atob(b64);
  const o = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
  return o.buffer;
}

// ---------------------------------------------------------------------
// Messages brefs en bas d'écran
// ---------------------------------------------------------------------
let zoneToasts;

export function toast(message, type = 'info', duree = 3500) {
  if (!zoneToasts || !zoneToasts.isConnected) {
    zoneToasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(zoneToasts);
  }
  const t = h('div', { class: 'toast toast-' + type }, message);
  zoneToasts.append(t);
  setTimeout(() => t.remove(), duree);
}

// ---------------------------------------------------------------------
// Feuille qui monte du bas de l'écran (une seule à la fois)
// ---------------------------------------------------------------------
let feuilleOuverte = null;

export function ouvrirFeuille({ titre, contenu, surFermeture, haute = false }) {
  fermerFeuille();
  const fond = h('div', { class: 'feuille-fond', onclick: () => fermerFeuille() });
  const feuille = h('div', { class: 'feuille' + (haute ? ' feuille-haute' : ''), role: 'dialog', 'aria-label': titre },
    h('div', { class: 'feuille-tete' },
      h('div', { class: 'feuille-titre' }, titre),
      h('button', { class: 'btn-icone', 'aria-label': 'Fermer', onclick: () => fermerFeuille() }, '✕')),
    h('div', { class: 'feuille-corps' }, contenu));
  document.body.append(fond, feuille);
  feuilleOuverte = { fond, feuille, surFermeture };
  return feuille;
}

export function fermerFeuille() {
  if (!feuilleOuverte) return;
  const f = feuilleOuverte;
  feuilleOuverte = null;
  f.fond.remove();
  f.feuille.remove();
  if (f.surFermeture) f.surFermeture();
}

// ---------------------------------------------------------------------
// Boîte de dialogue : question avec champs. Renvoie les valeurs, ou null si annulé.
// champs : [{ nom, label, type, valeur, placeholder, aide }]
// ---------------------------------------------------------------------
export function demander({ titre, message, champs = [], valider = 'OK', annuler = 'Annuler', danger = false }) {
  return new Promise((resoudre) => {
    const entrees = {};
    const finir = (resultat) => { fond.remove(); resoudre(resultat); };
    const soumettre = (e) => {
      e.preventDefault();
      const valeurs = {};
      for (const c of champs) valeurs[c.nom] = entrees[c.nom].value.trim();
      finir(valeurs);
    };
    const formulaire = h('form', { class: 'dialogue', onsubmit: soumettre, onclick: (e) => e.stopPropagation() },
      h('h2', null, titre),
      message && h('p', { class: 'dialogue-message' }, message),
      champs.map((c) => h('label', { class: 'champ-bloc' },
        h('span', null, c.label),
        (entrees[c.nom] = h('input', {
          class: 'champ', type: c.type || 'text', value: c.valeur || '', placeholder: c.placeholder || '',
          autocomplete: 'off', autocapitalize: c.majuscules ? 'sentences' : 'off', spellcheck: false, required: c.optionnel ? null : true,
        })),
        c.aide && h('small', null, c.aide))),
      h('div', { class: 'dialogue-boutons' },
        annuler && h('button', { type: 'button', class: 'btn', onclick: () => finir(null) }, annuler),
        h('button', { type: 'submit', class: 'btn ' + (danger ? 'btn-danger' : 'btn-principal') }, valider)));
    const fond = h('div', { class: 'dialogue-fond', onclick: () => finir(null) }, formulaire);
    document.body.append(fond);
    const premier = champs[0] && entrees[champs[0].nom];
    if (premier) premier.focus();
  });
}

export async function confirmer(options) {
  return (await demander({ valider: 'Oui', ...options })) !== null;
}

// ---------------------------------------------------------------------
// Donner un fichier à l'utilisateur : feuille de partage sur téléphone,
// téléchargement classique sur ordinateur. À appeler directement dans un
// clic (sinon iOS refuse le partage).
// ---------------------------------------------------------------------
export async function partagerOuTelecharger(fichier) {
  const tactile = matchMedia('(pointer: coarse)').matches;
  if (tactile && navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: fichier.name });
      return 'partage';
    } catch (e) {
      if (e.name === 'AbortError') return 'annule';
    }
  }
  const url = URL.createObjectURL(fichier);
  const lien = h('a', { href: url, download: fichier.name });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'telecharge';
}

// Ouvre le sélecteur de fichiers du téléphone / de l'ordinateur.
export function choisirFichier(accept) {
  return new Promise((resoudre) => {
    const entree = h('input', { type: 'file', accept, style: 'position:fixed;left:-9999px' });
    entree.addEventListener('change', () => { resoudre(entree.files[0] || null); entree.remove(); });
    entree.addEventListener('cancel', () => { resoudre(null); entree.remove(); });
    document.body.append(entree);
    entree.click();
  });
}
