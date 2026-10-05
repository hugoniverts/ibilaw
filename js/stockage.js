// Mémoire locale du téléphone (IndexedDB). Rien ne part sur internet.
//   lieux    : un enregistrement par lieu (nom, points, calage…)
//   plans    : l'image du plan de chaque lieu (séparée car lourde)
//   traces   : les traces GPS (lot 3)
//   reglages : petites valeurs (profil, lieux déverrouillés…)

const NOM_BASE = 'ibilaw';
const VERSION_BASE = 1;

let ouverture = null;

function ouvrir() {
  if (!ouverture) {
    ouverture = new Promise((resoudre, rejeter) => {
      const req = indexedDB.open(NOM_BASE, VERSION_BASE);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('lieux')) db.createObjectStore('lieux', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans', { keyPath: 'lieuId' });
        if (!db.objectStoreNames.contains('traces')) {
          db.createObjectStore('traces', { keyPath: 'id' }).createIndex('lieuId', 'lieuId');
        }
        if (!db.objectStoreNames.contains('reglages')) db.createObjectStore('reglages');
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); ouverture = null; };
        resoudre(db);
      };
      req.onerror = () => { ouverture = null; rejeter(req.error); };
    });
  }
  return ouverture;
}

// Lance une opération et attend que la transaction soit vraiment écrite.
async function operation(magasins, mode, action) {
  const db = await ouvrir();
  return new Promise((resoudre, rejeter) => {
    const tx = db.transaction(magasins, mode);
    let resultat;
    const req = action(tx);
    if (req) req.onsuccess = () => { resultat = req.result; };
    tx.oncomplete = () => resoudre(resultat);
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error || new Error('Écriture annulée (mémoire pleine ?)'));
  });
}

export const base = {
  lire: (magasin, cle) => operation(magasin, 'readonly', (tx) => tx.objectStore(magasin).get(cle)),
  lireTout: (magasin) => operation(magasin, 'readonly', (tx) => tx.objectStore(magasin).getAll()),
  lireParIndex: (magasin, index, valeur) => operation(magasin, 'readonly', (tx) => tx.objectStore(magasin).index(index).getAll(valeur)),
  ecrire: (magasin, valeur, cle) => operation(magasin, 'readwrite', (tx) => tx.objectStore(magasin).put(valeur, cle)),
  supprimer: (magasin, cle) => operation(magasin, 'readwrite', (tx) => tx.objectStore(magasin).delete(cle)),
  // Plusieurs écritures d'un coup : tout passe, ou rien.
  lot: (magasins, action) => operation(magasins, 'readwrite', (tx) => { action(tx); return null; }),
};

// Demande au navigateur de ne pas effacer nos données quand il manque de place.
export async function demanderConservation() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* sans importance */ }
  return false;
}

export async function etatStockage() {
  const etat = { ok: false, utilise: null, quota: null, conserve: null, erreur: null };
  try {
    await base.ecrire('reglages', Date.now(), 'test-ecriture');
    etat.ok = typeof (await base.lire('reglages', 'test-ecriture')) === 'number';
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      etat.utilise = e.usage ?? null;
      etat.quota = e.quota ?? null;
    }
    if (navigator.storage && navigator.storage.persisted) etat.conserve = await navigator.storage.persisted();
  } catch (e) {
    etat.erreur = e && e.message ? e.message : String(e);
  }
  return etat;
}
