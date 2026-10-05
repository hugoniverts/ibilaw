// Écran d'accueil : liste des lieux, création, import.

import { VERSION } from './version.js';
import { h, mettre, vider, toast, demander, ouvrirFeuille, fermerFeuille, choisirFichier, formatDate } from './outils.js';
import * as lieux from './lieux.js';
import { pwa, installer, etatHorsLigne } from './pwa.js';
import { infosAppareil } from './veille.js';

export async function ecranAccueil(zone) {
  zone.classList.add('ecran-page');
  const liste = h('div', { class: 'pile' });
  const conseil = h('div');
  const pied = h('footer', { class: 'pied' });

  mettre(zone,
    h('header', { class: 'entete-accueil' },
      h('h1', null, 'IBILAW'),
      h('p', null, 'Le plan du lieu et la position de l\'équipe')),
    !window.isSecureContext && h('div', { class: 'conseil conseil-erreur' },
      h('strong', null, 'Connexion non sécurisée'),
      h('p', null, 'Cette adresse n\'est pas en HTTPS : le GPS ne fonctionnera pas.')),
    conseil,
    liste,
    h('div', { class: 'pile' },
      h('button', { class: 'btn btn-principal btn-large', onclick: nouveauLieu }, '＋ Nouveau lieu'),
      h('button', { class: 'btn btn-large', onclick: importer }, '📂 Importer un lieu (fichier)'),
      h('button', { class: 'btn btn-large', onclick: () => { location.hash = '#/diagnostic'; } }, '🩺 Diagnostic du téléphone')),
    pied);

  async function remplir() {
    const tous = await lieux.listerLieux();
    vider(liste);
    if (!tous.length) {
      liste.append(h('p', { class: 'vide' }, 'Aucun lieu pour l\'instant. Crée ton premier lieu, ou importe un fichier de lieu qu\'on t\'a envoyé.'));
    }
    for (const lieu of tous) {
      const aPlacer = lieu.points.filter((p) => !lieux.estPlace(p)).length;
      const captures = lieu.points.filter((p) => p.capture).length;
      const resume = [`${lieu.points.length} point${lieu.points.length > 1 ? 's' : ''}`];
      if (aPlacer) resume.push(`${aPlacer} à placer`);
      if (captures) resume.push(`${captures} capturé${captures > 1 ? 's' : ''}`);
      if (!lieu.plan) resume.push('pas encore de plan');
      liste.append(h('button', { class: 'carte-lieu', onclick: () => { location.hash = '#/lieu/' + lieu.id; } },
        h('span', { class: 'carte-lieu-nom' }, lieu.nom),
        h('span', { class: 'carte-lieu-detail' }, resume.join(' · ')),
        h('span', { class: 'carte-lieu-detail' }, 'Modifié le ' + formatDate(lieu.maj))));
    }
  }

  async function majEtat() {
    const a = infosAppareil();
    vider(conseil);
    if (!a.installee) {
      if (a.iPhone) {
        conseil.append(h('div', { class: 'conseil' },
          h('strong', null, 'Installe l\'appli sur ton iPhone'),
          h('p', null, 'Dans Safari : bouton Partager (le carré avec une flèche vers le haut), puis « Sur l\'écran d\'accueil ». Ensuite, ouvre toujours IBILAW par son icône : ce que tu enregistres dans Safari ne suit pas dans l\'appli installée.')));
      } else if (pwa.invite) {
        conseil.append(h('div', { class: 'conseil' },
          h('strong', null, 'Installe l\'appli'),
          h('p', null, 'Elle s\'ouvrira en plein écran, comme une vraie appli.'),
          h('button', { class: 'btn btn-principal', onclick: installer }, 'Installer')));
      } else if (a.android) {
        conseil.append(h('div', { class: 'conseil' },
          h('strong', null, 'Installe l\'appli'),
          h('p', null, 'Dans Chrome : menu ⋮ puis « Ajouter à l\'écran d\'accueil » ou « Installer l\'application ».')));
      }
    }
    const horsLigne = await etatHorsLigne();
    const texte = horsLigne.pret ? '✅ Prête pour le hors-ligne'
      : horsLigne.raison === 'test-local' ? 'Test sur ordinateur (cache hors ligne désactivé)'
        : '⏳ Hors-ligne pas encore prêt';
    vider(pied).append(`Version ${VERSION} · ${texte}`);
  }

  async function nouveauLieu() {
    const v = await demander({
      titre: 'Nouveau lieu',
      champs: [
        { nom: 'nom', label: 'Nom du lieu', placeholder: 'Walibi Belgium', majuscules: true },
        { nom: 'code', label: 'Code admin', placeholder: '4 caractères minimum', aide: 'Il protège la préparation, la capture et le calage de ce lieu contre les fausses manips. Note-le : il sera demandé sur chaque téléphone.' },
      ],
      valider: 'Créer',
    });
    if (!v) return;
    if (v.code.length < 4) { toast('Le code admin doit faire au moins 4 caractères.', 'erreur'); return; }
    const lieu = await lieux.creerLieu(v.nom, v.code);
    location.hash = '#/lieu/' + lieu.id;
  }

  async function importer() {
    const fichier = await choisirFichier('.json,application/json');
    if (!fichier) return;
    let contenu;
    try {
      contenu = await lieux.lireFichierLieu(fichier);
    } catch (e) {
      toast(e.message, 'erreur', 6000);
      return;
    }
    const existant = await lieux.lireLieu(contenu.lieu.id);
    const finir = async (mode) => {
      fermerFeuille();
      try {
        const lieu = await lieux.importerLieu(contenu, mode);
        toast(`« ${lieu.nom} » importé`);
        location.hash = '#/lieu/' + lieu.id;
      } catch (e) {
        toast('Import impossible : ' + e.message, 'erreur', 6000);
      }
    };
    if (!existant) { await finir('remplacer'); return; }
    ouvrirFeuille({
      titre: 'Ce lieu existe déjà',
      contenu: [
        h('p', null, `« ${existant.nom} » est déjà sur ce téléphone (modifié le ${formatDate(existant.maj)}). Le fichier date du ${formatDate(contenu.exporte || contenu.lieu.maj)}.`),
        h('button', { class: 'btn btn-danger btn-large', onclick: () => finir('remplacer') }, 'Remplacer par le fichier'),
        h('button', { class: 'btn btn-large', onclick: () => finir('copie') }, 'Garder les deux (importer en copie)'),
        h('button', { class: 'btn btn-large', onclick: fermerFeuille }, 'Annuler'),
      ],
    });
  }

  pwa.surChangement = majEtat;
  await remplir();
  await majEtat();
  return () => { pwa.surChangement = null; };
}
