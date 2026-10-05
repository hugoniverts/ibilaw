// Affichage du plan (image) avec zoom et déplacement au doigt, grâce à Leaflet.
// Les coordonnées de l'appli sont en pixels de l'image : x vers la droite, y vers le bas.

import { categorie, estPlace } from './lieux.js';
import { echapper } from './outils.js';

const L = window.L;

export function creerCarte(conteneur, plan, urlImage) {
  const versCarte = (x, y) => L.latLng(-y, x);
  const versPixels = (latlng) => ({ x: latlng.lng, y: -latlng.lat });
  const limites = L.latLngBounds(versCarte(0, plan.hauteur), versCarte(plan.largeur, 0));
  const dansLePlan = (p) => p.x >= 0 && p.y >= 0 && p.x <= plan.largeur && p.y <= plan.hauteur;

  const carte = L.map(conteneur, {
    crs: L.CRS.Simple,
    attributionControl: false,
    zoomControl: false,
    doubleClickZoom: false,
    zoomSnap: 0.25,
    zoomDelta: 0.75,
    minZoom: -8,
    maxZoom: 2,
    maxBoundsViscosity: 0.8,
    bounceAtZoomLimits: false,
  });
  L.imageOverlay(urlImage, limites).addTo(carte);
  const zoomEntier = carte.getBoundsZoom(limites);          // zoom où tout le plan tient à l'écran
  carte.setMinZoom(zoomEntier - 0.5);
  carte.setMaxBounds(limites.pad(0.4));
  // À l'ouverture, le plan remplit l'écran (un plan large sur un téléphone tenu
  // en hauteur serait minuscule si on l'affichait en entier).
  carte.setView(limites.getCenter(), carte.getBoundsZoom(limites, true), { animate: false });

  // Quand beaucoup de points sont à l'écran, ce sont de petites pastilles ; quand il
  // y en a peu, ils grossissent puis leur nom apparaît (sinon tout se chevauche).
  let positions = [];
  const majDensite = () => {
    const vue = carte.getBounds();
    const visibles = positions.filter((ll) => vue.contains(ll)).length;
    const taille = carte.getSize();
    const surface = taille.x * taille.y;
    conteneur.classList.toggle('zoom-loin', visibles > surface / 3000);
    conteneur.classList.toggle('avec-noms', visibles <= surface / 11000);
  };
  carte.on('moveend', majDensite);

  const observateur = new ResizeObserver(() => carte.invalidateSize());
  observateur.observe(conteneur);

  const couchePoints = L.layerGroup().addTo(carte);
  let provisoire = null;
  let ecouteurPoint = null;

  function icone(point, choisi, etat) {
    const cat = categorie(point.categorie);
    return L.divIcon({
      className: 'pt-enveloppe',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: `<div class="pt${choisi ? ' pt-choisi' : ''}${etat ? ' pt-' + etat : ''}" style="--c:${cat.couleur}"><span>${cat.symbole}</span></div>`
        + `<div class="pt-nom">${echapper(point.nom)}</div>`,
    });
  }

  return {
    leaflet: carte,

    // points : liste à afficher.
    // options : { selection: id du point mis en avant,
    //             interactif: false pour que les appuis traversent les points (pendant un placement),
    //             etat: (point) => 'capture' | '' }
    afficherPoints(points, options = {}) {
      couchePoints.clearLayers();
      positions = [];
      for (const p of points) {
        if (!estPlace(p)) continue;
        const choisi = options.selection === p.id;
        positions.push(versCarte(p.x, p.y));
        const m = L.marker(versCarte(p.x, p.y), {
          icon: icone(p, choisi, options.etat ? options.etat(p) : ''),
          zIndexOffset: choisi ? 1000 : 0,
          keyboard: false,
          interactive: options.interactif !== false,
        });
        m.on('click', () => ecouteurPoint && ecouteurPoint(p));
        m.addTo(couchePoints);
      }
      majDensite();
    },

    // Appelle fn({x, y}) quand on touche le plan (pas un point).
    surClicPlan(fn) {
      carte.on('click', (e) => {
        const p = versPixels(e.latlng);
        if (dansLePlan(p)) fn(p);
      });
    },
    surClicPoint(fn) { ecouteurPoint = fn; },

    // Repère temporaire (point en cours de création).
    montrerProvisoire(x, y) {
      this.retirerProvisoire();
      provisoire = L.marker(versCarte(x, y), {
        icon: L.divIcon({ className: 'pt-enveloppe', iconSize: [40, 40], iconAnchor: [20, 20], html: '<div class="pt pt-provisoire"><span>＋</span></div>' }),
        interactive: false, zIndexOffset: 2000,
      }).addTo(carte);
    },
    retirerProvisoire() {
      if (provisoire) { provisoire.remove(); provisoire = null; }
    },

    centrer(x, y) {
      carte.setView(versCarte(x, y), Math.max(carte.getZoom(), zoomEntier + 1.75), { animate: true });
    },
    // Décale le plan si besoin pour que ce point ne soit pas caché par un panneau.
    garderVisible(x, y, { bas = 0, droite = 0 } = {}) {
      carte.panInside(versCarte(x, y), { paddingTopLeft: [50, 60], paddingBottomRight: [50 + droite, 60 + bas] });
    },
    toutVoir() { carte.fitBounds(limites); },
    zoomer(sens) { carte.setZoom(carte.getZoom() + sens * 0.75); },

    detruire() {
      observateur.disconnect();
      carte.remove();
    },
  };
}
