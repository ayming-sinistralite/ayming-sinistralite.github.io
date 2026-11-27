// ── Vos rapports : les diagnostics obtenus, gardés sur l'appareil ──
// Chaque rapport affiché enregistre les réponses qui le produisent (pas le rapport lui-même, qui
// se recalcule), pour que l'accueil puisse le rouvrir et le partager plus tard. Un même secteur,
// une même entreprise et un même effectif ne font qu'un rapport : les dernières réponses
// l'emportent. Rien n'est transmis. En démonstration, les rapports vont dans le stockage de session :
// l'accueil de la démonstration les montre le temps de l'onglet, sans toucher la liste gardée.

import { state } from './state.js?v=36466a3';
import { isDemo } from './route.js?v=36466a3';
import { readJSON, writeJSON, readSession, writeSession } from './utils.js?v=36466a3';
import { resolveEntry } from './compare.js?v=36466a3';
import { getData } from './data.js?v=36466a3';

var KEY = 'sinistralite-reports';
var DEMO_KEY = 'sinistralite-demo-reports';
var MAX = 10;
var FIELDS = ['sector', 'sectorLevel', 'sectorLib', 'effectif', 'accidents', 'joursArret', 'arrets45',
  'siret', 'mp', 'trajet', 'motif', 'suivi45', 'ijRecup', 'reserves', 'contact', 'leadSent'];

function readDemo() {
  try { return JSON.parse(readSession(DEMO_KEY)) || []; } catch (e) { return []; }
}

export function listReports() {
  var list = isDemo() ? readDemo() : readJSON(KEY, []);
  if (!Array.isArray(list)) return [];
  // Une entrée sans réponses n'est pas un rapport : l'accueil et la reprise lisent r.answers.
  return list.filter(function(r) { return r && r.answers && typeof r.answers === 'object'; });
}

function write(list) {
  if (isDemo()) writeSession(DEMO_KEY, JSON.stringify(list));
  else writeJSON(KEY, list);
  window.dispatchEvent(new Event('reportschange'));
}

function idOf(v) {
  return [v.sector, (v.contact && v.contact.societe) || '', v.effectif].join('|');
}

export function saveReport(v) {
  if (!v || !v.sector) return;
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
  // Un secteur qui n'est plus un NAF5 (rapport d'avant le choix NAF5 seul) ne rouvre pas : le calcul le refuserait.
  if (!r || (getData('at') && !resolveEntry(r.answers.sector))) return false;
  var v = state.views.compare;
  FIELDS.forEach(function(k) { v[k] = r.answers[k] == null ? null : r.answers[k]; });
  return true;
}
