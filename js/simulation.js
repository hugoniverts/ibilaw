// Mode simulation : un terrain fictif collé sous le plan, pour tout tester depuis chez soi.
//
// Toucher le plan donne une « vraie » position sur ce terrain fictif. Le terrain est
// volontairement tourné, écrasé et déformé par rapport au plan (comme un vrai plan
// dessiné), pour que capture et calage se comportent comme sur le terrain.

const RAD = Math.PI / 180;
const ORIGINE = { lat: 50.7, lon: 4.59 };
const LARGEUR_METRES = 900;       // le plan fictif couvre environ 900 m de large
const ANGLE = 25 * RAD;           // le plan n'est pas orienté au nord
const ECRASEMENT = 1.7;           // vue penchée : la profondeur est tassée sur le dessin

export function terrainFictif(plan) {
  const metresParPixel = LARGEUR_METRES / plan.largeur;
  return {
    versGps(x, y) {
      const cx = x - plan.largeur / 2;
      const cy = y - plan.hauteur / 2;
      // Déformation de quelques dizaines de mètres, différente selon les zones.
      const e = cx * metresParPixel + 35 * Math.sin((cy / plan.hauteur) * 5);
      const n = -cy * metresParPixel * ECRASEMENT + 28 * Math.sin((cx / plan.largeur) * 6);
      const est = e * Math.cos(ANGLE) - n * Math.sin(ANGLE);
      const nord = e * Math.sin(ANGLE) + n * Math.cos(ANGLE);
      return {
        lat: ORIGINE.lat + nord / 111320,
        lon: ORIGINE.lon + est / (111320 * Math.cos(ORIGINE.lat * RAD)),
      };
    },
  };
}

// Hasard « en cloche » (centré sur 0), pour imiter le tremblement d'un GPS.
export function hasardCloche() {
  let s = 0;
  for (let i = 0; i < 6; i++) s += Math.random();
  return (s - 3) / Math.sqrt(0.5);
}
