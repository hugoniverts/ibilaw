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
  const coucheEquipe = L.layerGroup().addTo(carte);
  let provisoire = null;
  let ecouteurPoint = null;
  let ecouteurEquipier = null;
  let moi = null;         // pastille « ma position »
  let cercle = null;      // son cercle de précision
  let fantome = null;     // vraie position fictive (simulation)
  let trajet = null;      // ligne droite vers la destination (deux traits superposés)
  const pastille = (classe, taille) => L.divIcon({
    className: 'pt-enveloppe', iconSize: [taille, taille], iconAnchor: [taille / 2, taille / 2], html: `<div class="${classe}"></div>`,
  });

  function icone(point, choisi, etat, but) {
    const cat = categorie(point.categorie);
    return L.divIcon({
      className: 'pt-enveloppe',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: `<div class="pt${choisi ? ' pt-choisi' : ''}${but ? ' pt-but' : ''}${etat ? ' pt-' + etat : ''}" style="--c:${cat.couleur}"><span>${cat.symbole}</span></div>`
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
        const but = options.destination === p.id;
        const m = L.marker(versCarte(p.x, p.y), {
          icon: icone(p, choisi, options.etat ? options.etat(p) : '', but),
          zIndexOffset: choisi ? 1000 : but ? 900 : 0,
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

    // Ma position : pastille bleue et cercle de précision. p = { x, y, rayon } en pixels
    // du plan, ou null pour la masquer.
    afficherMoi(p) {
      if (!p) {
        if (moi) { moi.remove(); cercle.remove(); moi = null; cercle = null; }
        return;
      }
      const ou = versCarte(p.x, p.y);
      if (!moi) {
        cercle = L.circle(ou, { radius: p.rayon, color: '#4db2ff', weight: 2, fillColor: '#4db2ff', fillOpacity: 0.2, interactive: false }).addTo(carte);
        moi = L.marker(ou, { icon: pastille('moi', 26), interactive: false, keyboard: false, zIndexOffset: 3000 }).addTo(carte);
      } else {
        moi.setLatLng(ou);
        cercle.setLatLng(ou);
        cercle.setRadius(p.rayon);
      }
    },
    // Les autres membres de l'équipe.
    // membres : [{ id, x, y, couleur, initiale, etiquette, ancien }]
    afficherEquipe(membres) {
      coucheEquipe.clearLayers();
      for (const m of membres) {
        L.marker(versCarte(m.x, m.y), {
          icon: L.divIcon({
            className: 'pt-enveloppe', iconSize: [36, 36], iconAnchor: [18, 18],
            html: `<div class="equipier${m.ancien ? ' equipier-ancien' : ''}" style="--c:${m.couleur}">${echapper(m.initiale)}</div>`
              + `<div class="equipier-nom">${echapper(m.etiquette)}</div>`,
          }),
          zIndexOffset: 2200,
          keyboard: false,
        }).on('click', () => ecouteurEquipier && ecouteurEquipier(m.id)).addTo(coucheEquipe);
      }
    },
    surClicEquipier(fn) { ecouteurEquipier = fn; },

    // Simulation : l'endroit réellement touché, pour le comparer à la position calculée.
    afficherFantome(p) {
      if (fantome) { fantome.remove(); fantome = null; }
      if (p) fantome = L.marker(versCarte(p.x, p.y), { icon: pastille('fantome', 22), interactive: false, keyboard: false, zIndexOffset: 2500 }).addTo(carte);
    },

    // Ligne droite entre deux endroits du plan (ma position et ma destination). Sans arguments : l'efface.
    afficherTrajet(a, b) {
      if (!a || !b) {
        if (trajet) { trajet.forEach((t) => t.remove()); trajet = null; }
        return;
      }
      const points = [versCarte(a.x, a.y), versCarte(b.x, b.y)];
      if (!trajet) {
        trajet = [
          L.polyline(points, { color: '#05070a', weight: 9, opacity: 0.75, lineCap: 'round', interactive: false }).addTo(carte),
          L.polyline(points, { color: '#ffffff', weight: 4, opacity: 1, lineCap: 'round', interactive: false }).addTo(carte),
        ];
      } else {
        trajet.forEach((t) => t.setLatLngs(points));
      }
    },
    // Cadre le plan pour voir deux endroits à la fois.
    voirEnsemble(a, b) {
      carte.fitBounds(L.latLngBounds([versCarte(a.x, a.y), versCarte(b.x, b.y)]).pad(0.3), { maxZoom: zoomEntier + 2.5 });
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
