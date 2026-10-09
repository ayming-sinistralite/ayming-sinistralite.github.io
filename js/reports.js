// ── Vos rapports : les diagnostics obtenus, gardés sur l'appareil ──
// Chaque rapport affiché enregistre les réponses qui le produisent (pas le rapport lui-même, qui
// se recalcule), pour que l'accueil puisse le rouvrir et le partager plus tard. Un même secteur,
// une même entreprise et un même effectif ne font qu'un rapport : les dernières réponses
// l'emportent. Rien n'est transmis, et rien n'est gardé en démonstration.

import { state } from './state.js?v=f8b7846';
import { isDemo } from './route.js?v=f8b7846';

var KEY = 'sinistralite-reports';
var MAX = 10;
var FIELDS = ['sector', 'sectorLevel', 'sectorLib', 'effectif', 'masseSalariale', 'accidents', 'joursArret', 'arrets45',
  'mp', 'trajet', 'deces', 'tauxNotifie', 'motif', 'suivi45', 'ijRecup', 'reserves', 'contact', 'leadSent'];

export function listReports() {
  try {
    var list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* stockage refusé, le rapport reste à l'écran */ }
  window.dispatchEvent(new Event('reportschange'));
}

function idOf(v) {
  return [v.sector, (v.contact && v.contact.societe) || '', v.effectif].join('|');
}

export function saveReport(v) {
  if (isDemo() || !v || !v.sector) return;
  var answers = {};
  FIELDS.forEach(function(k) { answers[k] = v[k] == null ? null : v[k]; });
  var id = idOf(v);
  var list = listReports().filter(function(r) { return r.id !== id; });
  list.unshift({ id: id, date: new Date().toISOString(), answers: answers });
  write(list.slice(0, MAX));
}

export function deleteReport(id) {
  write(listReports().filter(function(r) { return r.id !== id; }));
}

// Remet les réponses d'un rapport dans Mon entreprise, prêtes pour l'écran du rapport.
export function restoreReport(id) {
  var r = listReports().filter(function(x) { return x.id === id; })[0];
  if (!r) return false;
  var v = state.views.compare;
  FIELDS.forEach(function(k) { v[k] = r.answers[k] == null ? null : r.answers[k]; });
  return true;
}
