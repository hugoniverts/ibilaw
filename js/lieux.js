// Les lieux : création, lecture, sauvegarde, export / import en un seul fichier.
//
// Forme d'un lieu :
// {
//   id, nom, cree, maj, format: 1,
//   admin:  { sel, hash }                      code admin (jamais stocké en clair)
//   plan:   { largeur, hauteur } | null        l'image elle-même est dans le magasin « plans »
//   points: [ { id, nom, categorie,
//               x, y,                          place sur le plan en pixels (null = pas encore placé)
//               capture: null | { lat, lon, precision, mesures, date, auteur },
//               calage: true,                  ce point sert-il au calage ?
//               maj } ],
//   calage: null | { … }                       résultat du calage (étape 3)
//   reseau: { noeuds: [], segments: [] }       réservé V2 : allées déduites des traces
// }

import { base } from './stockage.js';
import { CATEGORIES, REGLAGES } from '../config.js';
import { idCourt, hacher, sansAccents, tamponVersBase64, base64VersTampon, h } from './outils.js';

const FORMAT_FICHIER = 'ibilaw-lieu';

export function categorie(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// ---------------------------------------------------------------------
// Lecture / écriture
// ---------------------------------------------------------------------
export async function listerLieux() {
  const tous = await base.lireTout('lieux');
  return tous.sort((a, b) => b.maj - a.maj);
}

export const lireLieu = (id) => base.lire('lieux', id);
export const lirePlan = (lieuId) => base.lire('plans', lieuId);

export async function enregistrerLieu(lieu) {
  lieu.maj = Date.now();
  await base.ecrire('lieux', lieu);
  return lieu;
}

export async function creerLieu(nom, codeAdmin) {
  const sel = idCourt();
  const lieu = {
    id: idCourt(), nom, cree: Date.now(), maj: Date.now(), format: 1,
    admin: { sel, hash: await hacherCode(codeAdmin, sel) },
    plan: null, points: [], calage: null,
    reseau: { noeuds: [], segments: [] },
  };
  await base.ecrire('lieux', lieu);
  await deverrouiller(lieu.id);
  return lieu;
}

export async function supprimerLieu(id) {
  const traces = await base.lireParIndex('traces', 'lieuId', id);
  await base.lot(['lieux', 'plans', 'traces', 'reglages'], (tx) => {
    tx.objectStore('lieux').delete(id);
    tx.objectStore('plans').delete(id);
    for (const t of traces) tx.objectStore('traces').delete(t.id);
    tx.objectStore('reglages').delete('admin:' + id);
  });
}

// ---------------------------------------------------------------------
// Code admin (garde-fou contre les fausses manips, pas un coffre-fort)
// ---------------------------------------------------------------------
function hacherCode(code, sel) {
  return hacher(sel + ':' + code.trim().toLowerCase());
}

export async function verifierCode(lieu, code) {
  return (await hacherCode(code, lieu.admin.sel)) === lieu.admin.hash;
}

export const estDeverrouille = async (lieuId) => (await base.lire('reglages', 'admin:' + lieuId)) === true;
export const deverrouiller = (lieuId) => base.ecrire('reglages', true, 'admin:' + lieuId);
export const verrouiller = (lieuId) => base.supprimer('reglages', 'admin:' + lieuId);

// ---------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------
export function nouveauPoint({ nom, categorie: cat = 'autre', x = null, y = null }) {
  return { id: idCourt(), nom, categorie: cat, x, y, capture: null, calage: true, maj: Date.now() };
}

export const estPlace = (point) => point.x != null && point.y != null;

// Lit une liste collée (« Nom;Catégorie », une ligne par point).
// Séparateurs acceptés : point-virgule, tabulation (copie depuis Excel) ou virgule.
export function analyserListe(texte, pointsExistants = []) {
  const dejaLa = new Set(pointsExistants.map((p) => sansAccents(p.nom)));
  const resultat = { points: [], doublons: [], categoriesInconnues: [] };
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const sep = ligne.includes('\t') ? '\t' : ligne.includes(';') ? ';' : ',';
    const morceaux = ligne.split(sep).map((m) => m.trim().replace(/^"(.*)"$/, '$1'));
    const nom = morceaux[0];
    if (!nom || (sansAccents(nom) === 'nom' && resultat.points.length === 0)) continue;
    if (dejaLa.has(sansAccents(nom))) { resultat.doublons.push(nom); continue; }
    dejaLa.add(sansAccents(nom));
    const cat = trouverCategorie(morceaux[1]);
    if (morceaux[1] && !cat) resultat.categoriesInconnues.push(morceaux[1]);
    resultat.points.push(nouveauPoint({ nom, categorie: cat ? cat.id : 'autre' }));
  }
  return resultat;
}

function trouverCategorie(texte) {
  if (!texte) return null;
  const t = sansAccents(texte);
  return CATEGORIES.find((c) => c.id === t || sansAccents(c.nom) === t || (c.alias || []).includes(t)) || null;
}

// ---------------------------------------------------------------------
// Image du plan
// ---------------------------------------------------------------------
// Prépare une image choisie par l'utilisateur : réduite si elle est trop grande
// pour un téléphone, convertie en JPEG si elle est trop lourde.
export async function preparerImagePlan(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const l = img.naturalWidth;
    const ht = img.naturalHeight;
    if (!l || !ht) throw new Error('Image illisible');
    const echelle = Math.min(1, Math.sqrt(REGLAGES.planPixelsMax / (l * ht)));
    const formatDirect = ['image/jpeg', 'image/png', 'image/webp'].includes(fichier.type);
    if (echelle === 1 && formatDirect && fichier.size <= 5 * 1024 * 1024) {
      return { type: fichier.type, largeur: l, hauteur: ht, donnees: await fichier.arrayBuffer(), reduite: false };
    }
    const largeur = Math.round(l * echelle);
    const hauteur = Math.round(ht * echelle);
    const toile = h('canvas', { width: largeur, height: hauteur });
    const ctx = toile.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, largeur, hauteur);
    const blob = await new Promise((r) => toile.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Conversion de l\'image impossible');
    return { type: 'image/jpeg', largeur, hauteur, donnees: await blob.arrayBuffer(), reduite: echelle < 1 };
  } catch (e) {
    throw new Error('Impossible de lire cette image (formats acceptés : JPG, PNG, WebP).');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Enregistre l'image du plan. Si une image existait avec d'autres dimensions,
// les points déjà placés sont remis à l'échelle (même dessin, autre taille).
export async function definirPlan(lieu, image) {
  const ancien = lieu.plan;
  if (ancien && (ancien.largeur !== image.largeur || ancien.hauteur !== image.hauteur)) {
    const fx = image.largeur / ancien.largeur;
    const fy = image.hauteur / ancien.hauteur;
    for (const p of lieu.points) {
      if (estPlace(p)) { p.x *= fx; p.y *= fy; }
    }
    lieu.calage = null;
  }
  lieu.plan = { largeur: image.largeur, hauteur: image.hauteur };
  lieu.maj = Date.now();
  await base.lot(['lieux', 'plans'], (tx) => {
    tx.objectStore('plans').put({ lieuId: lieu.id, type: image.type, donnees: image.donnees });
    tx.objectStore('lieux').put(lieu);
  });
}

// ---------------------------------------------------------------------
// Export / import : un lieu complet dans un seul fichier
// ---------------------------------------------------------------------
export async function exporterLieu(id) {
  const lieu = await lireLieu(id);
  const plan = await lirePlan(id);
  const traces = await base.lireParIndex('traces', 'lieuId', id);
  const contenu = {
    format: FORMAT_FICHIER, version: 1, exporte: Date.now(),
    lieu,
    plan: plan ? { type: plan.type, base64: tamponVersBase64(plan.donnees) } : null,
    traces,
  };
  const jour = new Date().toISOString().slice(0, 10);
  const nomSimple = sansAccents(lieu.nom).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lieu';
  return new File([JSON.stringify(contenu)], `ibilaw-${nomSimple}-${jour}.json`, { type: 'application/json' });
}

// Lit et vérifie un fichier de lieu. Renvoie son contenu, prêt pour importerLieu().
export async function lireFichierLieu(fichier) {
  let contenu;
  try {
    contenu = JSON.parse(await fichier.text());
  } catch {
    throw new Error('Ce fichier n\'est pas un fichier de lieu IBILAW.');
  }
  if (!contenu || contenu.format !== FORMAT_FICHIER || !contenu.lieu || !contenu.lieu.id || !Array.isArray(contenu.lieu.points)) {
    throw new Error('Ce fichier n\'est pas un fichier de lieu IBILAW.');
  }
  if (contenu.version > 1) throw new Error('Ce fichier vient d\'une version plus récente de l\'appli. Mets l\'appli à jour.');
  return contenu;
}

// Fusionne dans le lieu déjà présent les captures d'un fichier du même lieu
// (deux téléphones qui capturent chacun de leur côté).
// Un point capturé des deux côtés garde la capture la plus précise.
export async function fusionnerCaptures(contenu) {
  const lieu = await lireLieu(contenu.lieu.id);
  if (!lieu) throw new Error('Le lieu d\'origine n\'est pas sur ce téléphone.');
  const stats = { ajoutees: 0, remplacees: 0, gardees: 0, nouveaux: 0 };
  const parId = new Map(lieu.points.map((p) => [p.id, p]));
  const parNom = new Map(lieu.points.map((p) => [sansAccents(p.nom), p]));
  for (const q of contenu.lieu.points) {
    if (q.capture && q.capture.simulee) q.capture = null;
    const p = parId.get(q.id) || parNom.get(sansAccents(q.nom));
    if (!p) {
      lieu.points.push(q);
      stats.nouveaux++;
      continue;
    }
    if (!estPlace(p) && estPlace(q)) { p.x = q.x; p.y = q.y; p.maj = Date.now(); }
    if (!q.capture) continue;
    const locale = p.capture && !p.capture.simulee ? p.capture : null;
    if (!locale) { p.capture = q.capture; stats.ajoutees++; }
    else if (locale.date === q.capture.date) continue;
    else if (q.capture.precision < locale.precision) { p.capture = q.capture; stats.remplacees++; }
    else { stats.gardees++; continue; }
    p.maj = Date.now();
  }
  await enregistrerLieu(lieu);
  return stats;
}

// mode « remplacer » : écrase le lieu du même identifiant.
// mode « copie »     : crée un nouveau lieu à côté de l'existant.
export async function importerLieu(contenu, mode = 'remplacer') {
  const lieu = contenu.lieu;
  const traces = Array.isArray(contenu.traces) ? contenu.traces : [];
  if (mode === 'copie') {
    lieu.id = idCourt();
    lieu.nom += ' (copie)';
    delete lieu.session;
    for (const t of traces) { t.id = idCourt(); }
  }
  for (const t of traces) t.lieuId = lieu.id;
  lieu.reseau = lieu.reseau || { noeuds: [], segments: [] };
  const anciennes = await base.lireParIndex('traces', 'lieuId', lieu.id);
  const donneesPlan = contenu.plan ? base64VersTampon(contenu.plan.base64) : null;
  await base.lot(['lieux', 'plans', 'traces'], (tx) => {
    tx.objectStore('lieux').put(lieu);
    if (donneesPlan) tx.objectStore('plans').put({ lieuId: lieu.id, type: contenu.plan.type, donnees: donneesPlan });
    else tx.objectStore('plans').delete(lieu.id);
    for (const t of anciennes) tx.objectStore('traces').delete(t.id);
    for (const t of traces) tx.objectStore('traces').put(t);
  });
  return lieu;
}
