// ── Le profil de l'accueil : le prénom, l'e-mail, le secteur et la raison de la visite, gardés sur l'appareil ──
// L'accueil les demande (tour.js) et envoie le prénom et l'e-mail à Ayming, la barre latérale affiche le
// prénom, les vues et le questionnaire s'ouvrent sur le secteur, l'étape contact reprend le prénom,
// le nom et l'e-mail. Le reste n'est transmis que par l'étape contact du diagnostic (FAQ « Mes données »).

import { readJSON, writeJSON, normalize } from './utils.js?v=36466a3';

var KEY = 'sinistralite-profile';

// Le profil tel que l'accueil l'a gardé, le prénom tel que tapé.
function stored() {
  var p = readJSON(KEY, {});
  var str = function(k) { return p && typeof p[k] === 'string' ? p[k] : ''; };
  return { prenom: str('prenom'), email: str('email'), sector: str('sector'), motif: str('motif') };
}

// Le nom n'est jamais demandé : il se relit dans l'e-mail à chaque lecture (splitName).
export function getProfile() {
  var p = stored();
  var who = splitName(p.prenom, p.email);
  return { prenom: who.prenom, nom: who.nom, email: p.email, sector: p.sector, motif: p.motif };
}

// Le prénom tapé et l'e-mail donnent le nom seulement quand l'adresse le prouve :
// « Victor » + victor.isnard@ donne Isnard, « Amélie VINCENT-DEBEZE » + amelie.vincentdebeze.a2p@ donne
// Amélie et VINCENT-DEBEZE, « DUPONT Marie » + marie.dupont@ les remet dans l'ordre. Une initiale
// (pmoreno@), une adresse générique (rh@), un prénom composé dans l'adresse (marie.claire.dupont@)
// ou un doute laissent le nom vide et le prénom tel quel.
export function splitName(prenom, email) {
  var keep = { prenom: prenom, nom: '' };
  var local = String(email || '').toLowerCase().split('@')[0].split('+')[0];
  var parts = local.split(/[._]/).filter(Boolean);
  if (parts.length < 2 || !/^[a-z-]{2,}$/.test(parts[1])) return keep;
  // Une troisième partie n'est admise que codée (le « a2p » d'une agence) : en lettres, elle peut être le nom.
  if (parts.slice(2).some(function(x) { return !/\d/.test(x); })) return keep;
  var key = function(s) { return normalize(s).replace(/[^a-z]/g, ''); };
  var first = key(parts[0]), last = key(parts[1]);
  var words = String(prenom || '').split(' ').filter(Boolean);
  if (!words.length) return keep;
  // Le prénom tapé, composé ou non, est la première partie de l'adresse : la seconde est le nom.
  if (key(prenom) === first) return { prenom: prenom, nom: capitalize(parts[1]) };
  // Prénom et nom tapés ensemble, dans un ordre ou l'autre : chaque moitié retrouve sa partie.
  for (var k = 1; k < words.length; k++) {
    var a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    if (key(a) === first && key(b) === last) return { prenom: a, nom: b };
    if (key(b) === first && key(a) === last) return { prenom: b, nom: a };
  }
  return keep;
}

// « marc » devient « Marc », « marie-claire » « Marie-Claire » : le badge porte un prénom soigné.
export function capitalize(name) {
  return name.replace(/(^|[\s-])(\S)/g, function(m, sep, ch) { return sep + ch.toUpperCase(); });
}

// Fusionne les champs donnés, puis prévient les modules qui en dépendent.
export function setProfile(fields) {
  var p = stored();
  Object.keys(fields).forEach(function(k) { if (k !== 'nom') p[k] = fields[k] || ''; });
  p.prenom = capitalize(p.prenom.replace(/\s+/g, ' ').trim().slice(0, 40));
  writeJSON(KEY, p);
  window.dispatchEvent(new Event('profilechange'));
}
