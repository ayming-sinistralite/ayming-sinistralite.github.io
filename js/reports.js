// ── Vos rapports : les diagnostics obtenus, gardés sur l'appareil ──
// Chaque rapport affiché enregistre les réponses qui le produisent (pas le rapport lui-même, qui
// se recalcule), pour que l'accueil puisse le rouvrir et le partager plus tard. Un même secteur,
// une même entreprise et un même effectif ne font qu'un rapport : les dernières réponses
// l'emportent. Rien n'est transmis, et rien n'est gardé en démonstration.

import { state } from './state.js?v=24ffa11';
import { isDemo } from './route.js?v=24ffa11';
import { readJSON, writeJSON } from './utils.js?v=24ffa11';

var KEY = 'sinistralite-reports';
var MAX = 10;
var FIELDS = ['sector', 'sectorLevel', 'sectorLib', 'effectif', 'accidents', 'joursArret', 'arrets45',
  'mp', 'trajet', 'motif', 'suivi45', 'ijRecup', 'reserves', 'contact', 'leadSent'];

export function listReports() {
  var list = readJSON(KEY, []);
  if (!Array.isArray(list)) return [];
  // Une entrée sans réponses n'est pas un rapport : l'accueil et la reprise lisent r.answers.
  return list.filter(function(r) { return r && r.answers && typeof r.answers === 'object'; });
}

function write(list) {
  writeJSON(KEY, list);
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
