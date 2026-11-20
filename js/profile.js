// ── Le profil de l'accueil : le prénom, l'e-mail, le secteur et la raison de la visite, gardés sur l'appareil ──
// L'accueil les demande (tour.js) et envoie le prénom et l'e-mail à Ayming, la barre latérale affiche le
// prénom, les vues et le questionnaire s'ouvrent sur le secteur, l'étape contact reprend le prénom et
// l'e-mail. Le reste n'est transmis que par l'étape contact du diagnostic (FAQ « Mes données »).

import { readJSON, writeJSON } from './utils.js?v=24ffa11';

var KEY = 'sinistralite-profile';

export function getProfile() {
  var p = readJSON(KEY, {});
  var str = function(k) { return p && typeof p[k] === 'string' ? p[k] : ''; };
  return { prenom: str('prenom'), email: str('email'), sector: str('sector'), motif: str('motif') };
}

// « marc » devient « Marc », « marie-claire » « Marie-Claire » : le badge porte un prénom soigné.
export function capitalize(name) {
  return name.replace(/(^|[\s-])(\S)/g, function(m, sep, ch) { return sep + ch.toUpperCase(); });
}

// Fusionne les champs donnés, puis prévient les modules qui en dépendent.
export function setProfile(fields) {
  var p = getProfile();
  Object.keys(fields).forEach(function(k) { p[k] = fields[k] || ''; });
  p.prenom = capitalize(p.prenom.replace(/\s+/g, ' ').trim().slice(0, 40));
  writeJSON(KEY, p);
  window.dispatchEvent(new Event('profilechange'));
}
