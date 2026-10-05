// Partage d'équipe : échanges avec le serveur (Supabase).
// Rien ici n'est indispensable : sans réseau, les appels échouent proprement et
// l'appli continue avec ce qu'elle a en mémoire.
//
// Un lieu partagé porte : lieu.session = { code, version, planVersion, planSignature }

import { PARTAGE, FONCTIONS } from '../config.js';
import { base } from './stockage.js';
import * as lieux from './lieux.js';
import { idCourt, sansAccents, tamponVersBase64, base64VersTampon } from './outils.js';

const TAILLE_MORCEAU = 300000;   // caractères par morceau d'image envoyé

const MESSAGES = {
  SESSION_INCONNUE: 'Aucune session ne porte ce code.',
  SESSION_PLEINE: 'Cette session est pleine (60 personnes).',
  CLE_INCORRECTE: 'Code de publication incorrect.',
  CLE_TROP_COURTE: 'Le code de publication doit faire au moins 6 caractères.',
  CODE_INVALIDE: 'Le code de session doit faire 4 à 20 caractères : lettres, chiffres ou tirets.',
  LIEU_TROP_GROS: 'Ce lieu contient trop de données pour être publié.',
  PLAN_INCOMPLET: 'L\'envoi du plan a été interrompu. Recommence la publication.',
};

async function appeler(fonction, parametres = {}, delaiMax = 15000) {
  const arret = new AbortController();
  const minuterie = setTimeout(() => arret.abort(), delaiMax);
  let reponse;
  let donnees = null;
  try {
    reponse = await fetch(`${PARTAGE.url}/rest/v1/rpc/${fonction}`, {
      method: 'POST',
      headers: { apikey: PARTAGE.cle, 'Content-Type': 'application/json' },
      body: JSON.stringify(parametres),
      cache: 'no-store',
      signal: arret.signal,
    });
    const texte = await reponse.text();
    donnees = texte ? JSON.parse(texte) : null;
  } catch {
    const erreur = new Error('Pas de réseau, ou serveur injoignable.');
    erreur.reseau = true;
    throw erreur;
  } finally {
    clearTimeout(minuterie);
  }
  if (!reponse.ok) {
    const code = donnees && donnees.message;
    const erreur = new Error(MESSAGES[code] || code || `Erreur du serveur (${reponse.status}).`);
    erreur.code = code;
    throw erreur;
  }
  return donnees;
}

// Plusieurs essais pour les envois longs sur un réseau capricieux.
async function appelerAvecEssais(fonction, parametres, essais = 3) {
  for (let i = 1; ; i++) {
    try {
      return await appeler(fonction, parametres, 30000);
    } catch (e) {
      if (!e.reseau || i >= essais) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

export const normaliserCode = (code) => String(code || '').trim().toUpperCase();

// ---------------------------------------------------------------------
// Mon profil sur ce téléphone : { membre, pseudo, fonction }
// ---------------------------------------------------------------------
export const lireProfil = () => base.lire('reglages', 'profil');

export async function enregistrerProfil(pseudo, fonction) {
  const ancien = await lireProfil();
  const profil = { membre: (ancien && ancien.membre) || idCourt() + idCourt(), pseudo, fonction };
  await base.ecrire('reglages', profil, 'profil');
  return profil;
}

export function couleurFonction(nom) {
  const f = FONCTIONS.find((x) => sansAccents(x.nom) === sansAccents(nom || ''));
  return (f || FONCTIONS[FONCTIONS.length - 1]).couleur;
}

// ---------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------
export const serveurJoignable = () => appeler('publication_initialisee', {}, 8000).then(() => true, () => false);

// Télécharge la version publiée d'une session et la range dans le téléphone.
// lieuLocal (facultatif) : la copie déjà présente, pour ne pas retélécharger un plan inchangé.
// confirmerRemplacement (facultatif) : appelée si un lieu du même identifiant, non rattaché
// à cette session, est déjà sur le téléphone ; si elle renvoie false, rien n'est écrit.
export async function telecharger(code, lieuLocal, surProgression, confirmerRemplacement) {
  const r = await appeler('rejoindre', { p_code: normaliserCode(code) });
  const lieu = r.lieu;
  const existant = await lieux.lireLieu(lieu.id);
  if (existant && !(existant.session && existant.session.code === r.code) && confirmerRemplacement) {
    if (!(await confirmerRemplacement(existant))) throw new Error('Rien n\'a été modifié.');
  }
  const planConnu = lieuLocal && lieuLocal.id === lieu.id && lieuLocal.session ? lieuLocal.session.planVersion : null;
  let donneesPlan = null;
  if (r.plan_version > 0 && r.plan_version !== planConnu) {
    const morceaux = [];
    for (let rang = 0; rang < r.plan_morceaux; rang++) {
      if (surProgression) surProgression(rang, r.plan_morceaux);
      const morceau = await appelerAvecEssais('lire_plan_morceau', { p_code: r.code, p_version: r.plan_version, p_rang: rang });
      if (typeof morceau !== 'string') throw new Error('Le plan est en cours de publication. Réessaie dans une minute.');
      morceaux.push(morceau);
    }
    donneesPlan = base64VersTampon(morceaux.join(''));
  }
  lieu.session = { code: r.code, version: r.version, planVersion: r.plan_version };
  lieu.reseau = lieu.reseau || { noeuds: [], segments: [] };
  lieu.maj = Date.now();
  await base.lot(['lieux', 'plans'], (tx) => {
    tx.objectStore('lieux').put(lieu);
    if (donneesPlan) tx.objectStore('plans').put({ lieuId: lieu.id, type: r.plan_type, donnees: donneesPlan });
    else if (r.plan_version === 0) tx.objectStore('plans').delete(lieu.id);
  });
  return lieu;
}

// Un seul échange : « voici ma position, donne-moi celles des autres ».
// profil vide = simple observateur (rien n'est écrit sur le serveur).
export function synchroniser(code, profil, position, destination) {
  return appeler('synchroniser', {
    p_code: code,
    p_membre: profil ? profil.membre : null,
    p_pseudo: profil ? profil.pseudo : null,
    p_fonction: profil ? profil.fonction : null,
    p_lat: position ? position.lat : null,
    p_lon: position ? position.lon : null,
    p_precision: position ? Math.round(position.precision) : null,
    p_destination: destination || null,
  }, 8000);
}

export const quitter = (code, membre) => appeler('quitter', { p_code: code, p_membre: membre }, 8000).catch(() => {});

// ---------------------------------------------------------------------
// Publication (admin)
// ---------------------------------------------------------------------
export const publicationInitialisee = () => appeler('publication_initialisee');
export const lireCleMemorisee = () => base.lire('reglages', 'cle-publication');

// Envoie le lieu (et son plan s'il a changé) dans la session. Met à jour lieu.session.
export async function publier(lieu, cle, codeSession, surProgression) {
  const code = normaliserCode(codeSession);
  const copie = JSON.parse(JSON.stringify(lieu));
  delete copie.session;
  for (const p of copie.points) {
    if (p.capture && p.capture.simulee) p.capture = null;     // les captures d'essai ne partent pas
  }
  let r = await appelerAvecEssais('publier_session', { p_cle: cle, p_code: code, p_lieu: copie });

  const plan = await lieux.lirePlan(lieu.id);
  const signature = plan ? `${plan.donnees.byteLength}:${lieu.plan.largeur}x${lieu.plan.hauteur}` : null;
  const dejaEnvoye = lieu.session && lieu.session.code === code && lieu.session.planSignature === signature && r.plan_version > 0;
  if (plan && !dejaEnvoye) {
    const texte = tamponVersBase64(plan.donnees);
    const total = Math.ceil(texte.length / TAILLE_MORCEAU);
    const version = r.plan_version + 1;
    for (let rang = 0; rang < total; rang++) {
      if (surProgression) surProgression(rang, total);
      await appelerAvecEssais('publier_plan_morceau', {
        p_cle: cle, p_code: code, p_version: version, p_rang: rang,
        p_donnees: texte.slice(rang * TAILLE_MORCEAU, (rang + 1) * TAILLE_MORCEAU),
      });
    }
    r = await appelerAvecEssais('valider_plan', { p_cle: cle, p_code: code, p_version: version, p_type: plan.type, p_morceaux: total });
  }
  lieu.session = { code, version: r.version, planVersion: r.plan_version, planSignature: signature };
  await lieux.enregistrerLieu(lieu);
  await base.ecrire('reglages', cle, 'cle-publication');
  return lieu.session;
}
