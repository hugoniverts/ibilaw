// Calage du plan : transformer une position GPS en un endroit du plan (en pixels).
//
// Deux méthodes, calculées à partir des points à la fois capturés (GPS) et placés (plan) :
//  - « affine » (simple) : le plan est supposé étiré / tourné / penché de façon uniforme.
//    Possible dès 3 points.
//  - « souple » (thin plate spline) : autorise des déformations différentes selon les
//    zones, comme sur un plan dessiné. Possible dès 6 points.
//
// Pour les comparer honnêtement, on retire chaque point à tour de rôle, on recalcule
// le calage sans lui, et on mesure à quelle distance il retombe. C'est aussi cette
// distance (« écart ») qui permet de repérer une mauvaise capture.

const RAYON_TERRE = 6371000;
const RAD = Math.PI / 180;
// Raideurs essayées pour la méthode souple (grande = proche de l'affine, petite = très souple).
const RAIDEURS = [1, 0.3, 0.1, 0.03, 0.01];

// GPS -> mètres (est, nord) autour d'une origine. Largement assez précis à l'échelle d'un parc.
export function versMetres(lat, lon, origine) {
  return {
    e: (lon - origine.lon) * RAD * RAYON_TERRE * Math.cos(origine.lat * RAD),
    n: (lat - origine.lat) * RAD * RAYON_TERRE,
  };
}

export function distanceMetres(a, b) {
  const d = versMetres(b.lat, b.lon, a);
  return Math.hypot(d.e, d.n);
}

// Résout A·x = b pour chaque second membre de B (élimination de Gauss avec pivot).
// A et B sont modifiés ; les solutions se retrouvent dans B. Renvoie false si insoluble.
function resoudre(A, B) {
  const n = A.length;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r;
    if (Math.abs(A[pivot][c]) < 1e-11) return false;
    if (pivot !== c) {
      [A[c], A[pivot]] = [A[pivot], A[c]];
      for (const b of B) [b[c], b[pivot]] = [b[pivot], b[c]];
    }
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      for (const b of B) b[r] -= f * b[c];
    }
  }
  for (const b of B) {
    for (let r = n - 1; r >= 0; r--) {
      let s = b[r];
      for (let k = r + 1; k < n; k++) s -= A[r][k] * b[k];
      b[r] = s / A[r][r];
    }
  }
  return true;
}

// pts : [{ u, v, x, y }] — u, v = position terrain (sans unité), x, y = pixels du plan.
function ajusterAffine(pts) {
  const A = [new Float64Array(3), new Float64Array(3), new Float64Array(3)];
  const bx = new Float64Array(3);
  const by = new Float64Array(3);
  for (const p of pts) {
    const ligne = [p.u, p.v, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) A[i][j] += ligne[i] * ligne[j];
      bx[i] += ligne[i] * p.x;
      by[i] += ligne[i] * p.y;
    }
  }
  if (!resoudre(A, [bx, by])) return null;
  const f = (u, v) => ({ x: bx[0] * u + bx[1] * v + bx[2], y: by[0] * u + by[1] * v + by[2] });
  f.lineaire = [bx[0], bx[1], by[0], by[1]];
  return f;
}

const noyau = (du, dv) => {
  const r2 = du * du + dv * dv;
  return r2 === 0 ? 0 : 0.5 * r2 * Math.log(r2);
};

function ajusterSouple(pts, raideur) {
  const n = pts.length;
  const N = n + 3;
  const A = Array.from({ length: N }, () => new Float64Array(N));
  const bx = new Float64Array(N);
  const by = new Float64Array(N);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const k = noyau(pts[i].u - pts[j].u, pts[i].v - pts[j].v);
      A[i][j] = k;
      A[j][i] = k;
    }
    A[i][i] = raideur;
    A[i][n] = 1; A[i][n + 1] = pts[i].u; A[i][n + 2] = pts[i].v;
    A[n][i] = 1; A[n + 1][i] = pts[i].u; A[n + 2][i] = pts[i].v;
    bx[i] = pts[i].x;
    by[i] = pts[i].y;
  }
  if (!resoudre(A, [bx, by])) return null;
  return (u, v) => {
    let x = bx[n] + bx[n + 1] * u + bx[n + 2] * v;
    let y = by[n] + by[n + 1] * u + by[n + 2] * v;
    for (let i = 0; i < n; i++) {
      const k = noyau(u - pts[i].u, v - pts[i].v);
      x += bx[i] * k;
      y += by[i] * k;
    }
    return { x, y };
  };
}

// Pour chaque point : écart (en mètres) quand on recalcule le calage sans lui.
function ecartsCroises(pts, ajuster, enMetres) {
  return pts.map((p, i) => {
    const f = ajuster(pts.filter((_, j) => j !== i));
    if (!f) return null;
    const q = f(p.u, p.v);
    return enMetres(q.x - p.x, q.y - p.y);
  });
}

function moyenne(valeurs) {
  const v = (valeurs || []).filter((x) => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// points : [{ id, lat, lon, x, y }] (déjà filtrés : capturés, placés et cochés).
// preference : 'auto' | 'affine' | 'souple'.
// Renvoie { ok: false, message } si le calage est impossible, sinon :
// { ok: true, n, methode, recommandee, soupleDisponible,
//   erreurMoyenne: { affine, souple },   en mètres (null si pas assez de points pour vérifier)
//   ecarts: { idPoint: mètres },         avec la méthode utilisée
//   pixelsParMetre, convertir(lat, lon) -> { x, y } }
export function calculerCalage(points, preference = 'auto') {
  const n = points.length;
  if (n < 3) {
    return { ok: false, n, message: `Il faut au moins 3 points capturés et placés sur le plan (pour l'instant : ${n}).` };
  }
  const origine = {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lon: points.reduce((s, p) => s + p.lon, 0) / n,
  };
  const m = points.map((p) => ({ id: p.id, x: p.x, y: p.y, ...versMetres(p.lat, p.lon, origine) }));

  // Étalement des points sur le terrain, et test d'alignement.
  let see = 0; let snn = 0; let sen = 0;
  for (const p of m) { see += p.e * p.e; snn += p.n * p.n; sen += p.e * p.n; }
  const etalement = Math.sqrt((see + snn) / n);
  if (etalement < 5) {
    return { ok: false, n, message: 'Les points de calage sont trop proches les uns des autres. Capture des points éloignés.' };
  }
  const trace = see + snn;
  const petite = trace / 2 - Math.sqrt(Math.max(0, trace * trace / 4 - (see * snn - sen * sen)));
  const alignes = { ok: false, n, message: 'Les points de calage sont presque alignés. Capture un point nettement à l\'écart de cette ligne.' };
  if (petite / (trace - petite) < 0.0025) return alignes;

  const pts = m.map((p) => ({ id: p.id, x: p.x, y: p.y, u: p.e / etalement, v: p.n / etalement }));
  const affine = ajusterAffine(pts);
  if (!affine) return alignes;
  const [a, b, c, d] = affine.lineaire;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return alignes;

  // Un écart en pixels ramené en mètres (tient compte d'un plan plus écrasé dans un sens).
  const enMetres = (dx, dy) => Math.hypot((d * dx - b * dy) / det, (a * dy - c * dx) / det) * etalement;

  const ecartsAffine = n >= 4 ? ecartsCroises(pts, ajusterAffine, enMetres) : null;
  let ecartsSouple = null;
  let souple = null;
  if (n >= 6) {
    let meilleure = null;
    for (const raideur of RAIDEURS) {
      const ecarts = ecartsCroises(pts, (q) => ajusterSouple(q, raideur), enMetres);
      const moy = moyenne(ecarts);
      if (moy !== null && (meilleure === null || moy < meilleure.moy)) meilleure = { raideur, ecarts, moy };
    }
    if (meilleure) {
      souple = ajusterSouple(pts, meilleure.raideur);
      if (souple) ecartsSouple = meilleure.ecarts;
    }
  }
  const erreurMoyenne = { affine: moyenne(ecartsAffine), souple: moyenne(ecartsSouple) };
  // La méthode souple n'est recommandée que si elle fait nettement mieux (au moins 20 %)
  // avec assez de points (8) : avec peu de points, elle peut partir de travers entre eux.
  const recommandee = n >= 8 && erreurMoyenne.souple !== null && erreurMoyenne.affine !== null
    && erreurMoyenne.souple < erreurMoyenne.affine * 0.8 ? 'souple' : 'affine';
  const methode = preference === 'souple' && souple ? 'souple' : preference === 'affine' ? 'affine' : recommandee;
  const f = methode === 'souple' ? souple : affine;
  const ecartsRetenus = methode === 'souple' ? ecartsSouple : ecartsAffine;
  const ecarts = {};
  if (ecartsRetenus) pts.forEach((p, i) => { ecarts[p.id] = ecartsRetenus[i]; });

  return {
    ok: true, n, methode, recommandee, soupleDisponible: !!souple, erreurMoyenne, ecarts,
    pixelsParMetre: Math.sqrt(Math.abs(det)) / etalement,
    convertir(lat, lon) {
      const q = versMetres(lat, lon, origine);
      return f(q.e / etalement, q.n / etalement);
    },
  };
}
