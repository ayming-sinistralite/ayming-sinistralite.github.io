// ── Le profil de l'accueil : le prénom, le secteur et la raison de la visite, sur l'appareil seulement ──
// L'accueil les demande (tour.js), la barre latérale affiche le prénom, les vues et le calcul
// s'ouvrent sur le secteur, l'étape contact reprend le prénom. Rien n'est transmis : seule
// l'étape contact du diagnostic envoie quelque chose à Ayming (FAQ « Mes données »).

var KEY = 'sinistralite-profile';

export function getProfile() {
  try {
    var p = JSON.parse(localStorage.getItem(KEY)) || {};
    var str = function(k) { return typeof p[k] === 'string' ? p[k] : ''; };
    return { prenom: str('prenom'), sector: str('sector'), motif: str('motif') };
  } catch (e) { return { prenom: '', sector: '', motif: '' }; }
}

// « jose » devient « Jose », « marie-claire » « Marie-Claire » : le badge porte un prénom soigné.
export function capitalize(name) {
  return name.replace(/(^|[\s-])(\S)/g, function(m, sep, ch) { return sep + ch.toUpperCase(); });
}

// Fusionne les champs donnés, puis prévient les modules qui en dépendent.
export function setProfile(fields) {
  var p = getProfile();
  Object.keys(fields).forEach(function(k) { p[k] = fields[k] || ''; });
  p.prenom = capitalize(p.prenom.replace(/\s+/g, ' ').trim().slice(0, 40));
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* stockage refusé, l'outil reste générique */ }
  window.dispatchEvent(new Event('profilechange'));
}
