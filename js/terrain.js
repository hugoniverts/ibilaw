// Sur le terrain : capture GPS des points et réglage du calage.
// Ces écrans s'ouvrent depuis les onglets « Capturer » et « Caler » d'un lieu.
//
// ctx (fourni par ecran-lieu.js) :
//   { lieu, etat, sauver(), dessiner(), deselectionner(), selectionner(point),
//     formulairePoint(options), captureValide(point) }

import { CATEGORIES, REGLAGES } from '../config.js';
import { h, mettre, vider, toast, confirmer, ouvrirFeuille, fermerFeuille, sansAccents, formatDate } from './outils.js';
import * as lieux from './lieux.js';
import * as position from './position.js';

const metres = (v) => `${Math.round(v)} m`;

export function creerTerrain(ctx) {
  const { lieu, etat } = ctx;

  // -------------------------------------------------------------------
  // Capture d'un point
  // -------------------------------------------------------------------
  function ouvrirCapture(point) {
    const cat = lieux.categorie(point.categorie);
    let enCours = false;
    let resultat = null;
    let ferme = false;

    const ligneCapture = h('p', { class: 'aide' });
    const ligneGps = h('p', { class: 'aide' });
    const bouton = h('button', { class: 'btn btn-principal btn-large', onclick: lancer });
    const barre = h('div', { class: 'progression', hidden: true }, h('div'));
    const zoneResultat = h('div', { class: 'pile' });
    const options = h('div', { class: 'pile' });

    // Une vraie capture ne doit jamais être écrasée par une capture fictive.
    const protegee = () => etat.simulation && point.capture && !point.capture.simulee;

    function majGps() {
      if (enCours || resultat) return;
      const i = position.instantane();
      if (protegee()) {
        ligneGps.textContent = 'Ce point a une vraie capture : la simulation ne peut pas la remplacer.';
        bouton.disabled = true;
      } else if (i.etat === 'ok') {
        ligneGps.textContent = `${i.source === 'simulation' ? 'Position fictive' : 'GPS actuel'} : précision ± ${metres(i.position.precision)}`;
        bouton.disabled = false;
      } else {
        ligneGps.textContent = i.source === 'arret'
          ? 'Active d\'abord ta position avec le bouton 📡 sur le plan.'
          : i.source === 'simulation' ? 'Touche le plan pour choisir ta position fictive.'
            : (i.message || 'Recherche de la position GPS…');
        bouton.disabled = true;
      }
    }

    function majCapture() {
      const c = ctx.captureValide(point) ? point.capture : null;
      const ecart = etat.calage && etat.calage.ok ? etat.calage.ecarts[point.id] : null;
      ligneCapture.textContent = c
        ? `Capturé le ${formatDate(c.date)}${c.simulee ? ' (simulation)' : ''} · précision ± ${metres(c.precision)} · ${c.mesures} mesure${c.mesures > 1 ? 's' : ''}`
          + (ecart != null ? ` · écart au calage ${metres(ecart)}` : '')
        : 'Pas encore capturé.';
      bouton.textContent = c ? '📍 Recapturer ma position ici' : '📍 Capturer ma position ici';
      bouton.hidden = false;
      vider(options);
      mettre(options,
        !lieux.estPlace(point) && h('p', { class: 'alerte' }, 'Ce point n\'est pas encore placé sur le plan : il ne peut pas servir au calage. Place-le dans l\'onglet « Préparer ».'),
        c && lieux.estPlace(point) && h('button', { class: 'btn', onclick: basculerCalage },
          point.calage !== false ? '✅ Sert au calage' : '⬜ Ne sert pas au calage'),
        c && h('button', { class: 'btn btn-danger', onclick: effacer }, '🗑 Effacer la capture'));
    }

    async function lancer() {
      enCours = true;
      resultat = null;
      vider(zoneResultat);
      bouton.disabled = true;
      barre.hidden = false;
      const r = await position.capturer(REGLAGES.dureeCapture, (part, n) => {
        barre.firstChild.style.width = `${Math.round(part * 100)}%`;
        bouton.textContent = `Capture en cours… ${n} mesure${n > 1 ? 's' : ''}`;
      });
      enCours = false;
      barre.hidden = true;
      barre.firstChild.style.width = '0';
      if (ferme) return;
      if (!r) {
        toast('Aucune mesure GPS reçue. Réessaie.', 'erreur');
        majCapture();
        majGps();
        return;
      }
      resultat = r;
      const faible = r.precision > REGLAGES.precisionAlerte;
      bouton.hidden = true;
      mettre(zoneResultat,
        h('p', { class: 'resultat' + (faible ? ' resultat-faible' : '') }, `Précision ± ${metres(r.precision)} (${r.mesures} mesure${r.mesures > 1 ? 's' : ''})`),
        faible && h('p', { class: 'alerte' }, `Précision faible (plus de ${REGLAGES.precisionAlerte} m). Éloigne-toi des bâtiments et des arbres, attends quelques secondes et recommence. Tu peux quand même l'enregistrer.`),
        h('div', { class: 'rangee' },
          h('button', { class: 'btn', onclick: () => { resultat = null; majCapture(); lancer(); } }, '↻ Recommencer'),
          h('button', { class: 'btn btn-principal', onclick: enregistrer }, '✅ Enregistrer')));
    }

    async function enregistrer() {
      const r = resultat;
      resultat = null;
      point.capture = { lat: r.lat, lon: r.lon, precision: r.precision, mesures: r.mesures, date: Date.now(), auteur: null };
      if (etat.simulation) point.capture.simulee = true;
      let suite = '';
      if (!lieux.estPlace(point)) {
        // Point créé sur place : si le calage existe déjà, on le pose automatiquement sur le plan.
        const q = etat.calage && etat.calage.ok ? etat.calage.convertir(r.lat, r.lon) : null;
        if (q && q.x >= 0 && q.y >= 0 && q.x <= lieu.plan.largeur && q.y <= lieu.plan.hauteur) {
          Object.assign(point, { x: q.x, y: q.y, calage: false });
          suite = ' Posé sur le plan d\'après le calage : vérifie sa place.';
        } else {
          suite = ' Il reste à le placer sur le plan (onglet « Préparer »).';
        }
      }
      point.maj = Date.now();
      await ctx.sauver();
      fermerFeuille();
      toast(`« ${point.nom} » capturé ✅${suite}`, 'info', suite ? 6000 : 3500);
    }

    async function basculerCalage() {
      point.calage = point.calage === false;
      point.maj = Date.now();
      await ctx.sauver();
      majCapture();
      ctx.dessiner();
    }

    async function effacer() {
      const ok = await confirmer({ titre: 'Effacer cette capture ?', message: `La position GPS de « ${point.nom} » sera perdue.`, valider: 'Effacer', danger: true });
      if (!ok) return;
      point.capture = null;
      point.maj = Date.now();
      await ctx.sauver();
      majCapture();
      majGps();
      ctx.dessiner();
    }

    const desabonner = position.abonner(majGps);
    majCapture();
    majGps();
    return ouvrirFeuille({
      titre: `${cat.symbole} ${point.nom}`,
      contenu: [ligneCapture, bouton, barre, ligneGps, zoneResultat, options],
      surFermeture: () => { ferme = true; desabonner(); ctx.deselectionner(); },
    });
  }

  // -------------------------------------------------------------------
  // Liste des points à capturer
  // -------------------------------------------------------------------
  function ouvrirListeCaptures() {
    let recherche = '';
    const champ = h('input', {
      class: 'champ', type: 'search', placeholder: 'Chercher un point…', autocomplete: 'off', enterKeyHint: 'search',
      oninput: () => { recherche = champ.value; remplir(); },
    });
    const corps = h('div', { class: 'liste' });

    function remplir() {
      vider(corps);
      const q = sansAccents(recherche);
      const visibles = lieu.points.filter((p) => !q || sansAccents(p.nom).includes(q));
      const restants = visibles.filter((p) => !ctx.captureValide(p));
      const faits = visibles.filter(ctx.captureValide).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      if (!visibles.length) corps.append(h('p', { class: 'vide' }, lieu.points.length ? 'Aucun point ne correspond.' : 'Aucun point dans ce lieu.'));
      for (const p of [...restants, ...faits]) {
        const cat = lieux.categorie(p.categorie);
        corps.append(h('button', { class: 'ligne', onclick: () => { fermerFeuille(); ctx.selectionner(p); ouvrirCapture(p); } },
          h('span', { class: 'ligne-symbole', style: `--c:${cat.couleur}` }, cat.symbole),
          h('span', { class: 'ligne-nom' }, p.nom),
          ctx.captureValide(p)
            ? h('span', { class: 'badge ' + (p.capture.precision > REGLAGES.precisionAlerte ? 'badge-attention' : 'badge-ok') }, `± ${metres(p.capture.precision)}`)
            : h('span', { class: 'badge badge-gris' }, 'à capturer')));
      }
    }

    remplir();
    const faits = lieu.points.filter(ctx.captureValide).length;
    ouvrirFeuille({ titre: `Captures : ${faits} / ${lieu.points.length}`, contenu: [champ, corps], haute: true });
  }

  // -------------------------------------------------------------------
  // Nouveau point à ma position
  // -------------------------------------------------------------------
  function nouveauPointIci() {
    if (position.instantane().etat !== 'ok') {
      toast('Active d\'abord ta position avec le bouton 📡 sur le plan.');
      return;
    }
    ctx.formulairePoint({
      titreFeuille: 'Nouveau point ici',
      point: { nom: '', categorie: etat.derniereCategorie || CATEGORIES[0].id },
      texteValider: 'Créer puis capturer',
      surValidation: async (v) => {
        const point = lieux.nouveauPoint(v);
        lieu.points.push(point);
        await ctx.sauver();
        // La feuille du formulaire se ferme juste après : on ouvre la capture ensuite.
        setTimeout(() => { ctx.selectionner(point); ouvrirCapture(point); }, 0);
      },
    });
  }

  // -------------------------------------------------------------------
  // Réglage du calage
  // -------------------------------------------------------------------
  function resumeCalage() {
    const c = etat.calage;
    if (!c || !c.ok) return { ok: false, texte: c ? c.message : 'Calage non calculé.' };
    const erreur = c.erreurMoyenne[c.methode];
    const methode = c.methode === 'souple' ? 'méthode souple' : 'méthode simple';
    return {
      ok: true,
      texte: `Calage actif : ${methode}, ${c.n} points` + (erreur != null ? `, erreur moyenne ${metres(erreur)}.` : '.'),
      douteux: erreur != null && erreur > 25,
      sansControle: erreur == null,
    };
  }

  function ouvrirCalage() {
    const corps = h('div', { class: 'pile' });

    async function choisirMethode(methode) {
      lieu.calage = { methode };
      await ctx.sauver();
      remplir();
      ctx.dessiner();
    }

    async function basculer(point) {
      point.calage = point.calage === false;
      point.maj = Date.now();
      await ctx.sauver();
      remplir();
      ctx.dessiner();
    }

    function remplir() {
      vider(corps);
      const c = etat.calage;
      const r = resumeCalage();
      const preference = (lieu.calage && lieu.calage.methode) || 'auto';
      mettre(corps,
        h('p', { class: r.ok ? 'resultat' : 'alerte' }, r.texte),
        r.sansControle && h('p', { class: 'aide' }, 'Avec seulement 3 points, impossible de vérifier la précision : capture un 4e point pour contrôler.'),
        r.douteux && h('p', { class: 'alerte' }, 'Calage peu fiable. Cherche ci-dessous les points avec un gros écart : recapture-les, ou décoche-les.'));

      if (c && c.ok) {
        const texteErreur = (m) => (c.erreurMoyenne[m] != null ? ` · ${metres(c.erreurMoyenne[m])}` : '');
        const choix = (id, texte, actif = true) => h('button', {
          class: 'puce' + (preference === id ? ' active' : ''), disabled: !actif, onclick: () => choisirMethode(id),
        }, texte);
        mettre(corps,
          h('div', { class: 'feuille-sous-titre' }, 'Méthode'),
          h('div', { class: 'puces' },
            choix('auto', 'Auto (conseillé)'),
            choix('affine', 'Simple' + texteErreur('affine')),
            choix('souple', c.soupleDisponible ? 'Souple' + texteErreur('souple') : 'Souple (dès 6 points)', c.soupleDisponible)),
          h('p', { class: 'aide' }, 'Le nombre est l\'erreur moyenne estimée. « Simple » suppose un plan déformé partout pareil ; « Souple » s\'adapte zone par zone mais demande beaucoup de points bien répartis. « Auto » ne choisit « Souple » que si elle fait nettement mieux.'));
      }

      const captures = lieu.points.filter(ctx.captureValide);
      const utilisables = captures.filter(lieux.estPlace);
      const ecart = (p) => (c && c.ok && c.ecarts[p.id] != null ? c.ecarts[p.id] : null);
      const tries = utilisables.slice().sort((a, b) => (ecart(b) ?? -1) - (ecart(a) ?? -1));
      const connus = utilisables.map(ecart).filter((e) => e != null).sort((a, b) => a - b);
      const mediane = connus.length ? connus[Math.floor(connus.length / 2)] : 0;
      const seuil = Math.max(15, mediane * 2.5);

      mettre(corps, h('div', { class: 'feuille-sous-titre' }, `Points de calage (${utilisables.filter((p) => p.calage !== false).length} utilisés)`));
      if (!utilisables.length) corps.append(h('p', { class: 'vide' }, 'Aucun point n\'est à la fois capturé et placé sur le plan.'));
      const liste = h('div', { class: 'liste' });
      for (const p of tries) {
        const e = ecart(p);
        const utilise = p.calage !== false;
        liste.append(h('div', { class: 'ligne ligne-calage' },
          h('button', { class: 'case' + (utilise ? ' cochee' : ''), 'aria-label': utilise ? 'Ne plus utiliser' : 'Utiliser', onclick: () => basculer(p) }, utilise ? '✓' : ''),
          h('button', { class: 'ligne-nom ligne-lien', onclick: () => { fermerFeuille(); ctx.selectionner(p); ouvrirCapture(p); } }, p.nom),
          !utilise ? h('span', { class: 'badge badge-gris' }, 'ignoré')
            : e == null ? h('span', { class: 'badge badge-gris' }, '—')
              : h('span', { class: 'badge ' + (e > seuil ? 'badge-danger' : 'badge-ok') }, (e > seuil ? '⚠️ ' : '') + `écart ${metres(e)}`)));
      }
      corps.append(liste);
      const nonPlaces = captures.filter((p) => !lieux.estPlace(p));
      if (nonPlaces.length) {
        corps.append(h('p', { class: 'aide' }, `Capturés mais pas encore placés sur le plan (inutilisables pour le calage) : ${nonPlaces.map((p) => p.nom).join(', ')}.`));
      }
    }

    remplir();
    ouvrirFeuille({ titre: 'Calage du plan', contenu: corps, haute: true });
  }

  return { ouvrirCapture, ouvrirListeCaptures, nouveauPointIci, ouvrirCalage, resumeCalage };
}
