// =====================================================================
// IBILAW — réglages modifiables sans toucher au reste du code.
// Après une modification : republier le site (voir README).
// =====================================================================

// Catégories de points. « alias » = mots acceptés dans une liste collée.
export const CATEGORIES = [
  { id: 'attraction', nom: 'Attraction', couleur: '#ff5a5f', symbole: '🎢', alias: ['attractions', 'manege', 'coaster'] },
  { id: 'restauration', nom: 'Restauration', couleur: '#ffb400', symbole: '🍔', alias: ['restaurant', 'restaurants', 'resto', 'snack', 'bar', 'food'] },
  { id: 'maison-hantee', nom: 'Maison hantée', couleur: '#b266ff', symbole: '👻', alias: ['maison hantee', 'hantee', 'maison', 'scare zone', 'zone de peur', 'halloween'] },
  { id: 'entree-sortie', nom: 'Entrée / sortie', couleur: '#2ecc71', symbole: '🚪', alias: ['entree', 'sortie', 'entree/sortie', 'entree sortie', 'acces'] },
  { id: 'rendez-vous', nom: 'Point de rendez-vous', couleur: '#00c2ff', symbole: '📍', alias: ['rendez-vous', 'rendez vous', 'rdv', 'point de rendez-vous'] },
  { id: 'base-technique', nom: 'Base technique / loge', couleur: '#ff7ab6', symbole: '🎛️', alias: ['base technique', 'base', 'technique', 'loge', 'loges', 'regie'] },
  { id: 'zone-tournage', nom: 'Zone de tournage', couleur: '#ff8c42', symbole: '🎥', alias: ['zone de tournage', 'tournage', 'plateau', 'set'] },
  { id: 'autre', nom: 'Autre', couleur: '#9aa5b1', symbole: '⭐', alias: ['autres', 'divers', 'boutique', 'service', 'toilettes', 'wc'] },
];

// Fonctions de l'équipe (une couleur par fonction). Utilisé à partir du lot 2.
export const FONCTIONS = [
  { id: 'realisateur', nom: 'Réalisateur', couleur: '#ff4d4f' },
  { id: 'assistant-realisateur', nom: 'Assistant réalisateur', couleur: '#ff9f1a' },
  { id: 'createur-contenu', nom: 'Créateur de contenu', couleur: '#b266ff' },
  { id: 'comedien', nom: 'Comédien', couleur: '#ff7ab6' },
  { id: 'cadreur', nom: 'Cadreur', couleur: '#00c2ff' },
  { id: 'regie', nom: 'Régie', couleur: '#2ecc71' },
  { id: 'securite', nom: 'Sécurité', couleur: '#f5e663' },
  { id: 'autre', nom: 'Autre', couleur: '#9aa5b1' },
];

export const REGLAGES = {
  // Image du plan : au-delà de ce nombre de pixels, l'image est réduite à l'import
  // (16 millions = limite sûre pour un iPhone).
  planPixelsMax: 16000000,
  // Précision GPS (en mètres) au-delà de laquelle une capture affiche un avertissement.
  precisionAlerte: 15,
  // Durée (en secondes) pendant laquelle une capture fait la moyenne des mesures.
  dureeCapture: 8,
  // Intervalle minimum (en secondes) entre deux envois de position à l'équipe.
  intervallePartage: 5,
};
