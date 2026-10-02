// ── L'absence liée au travail : jours perdus par salarié, secteur face à la France ──
// Somme des journées d'arrêt des AT, des MP et des accidents de trajet, rapportée aux salariés
// du fichier AT. Le bloc est le même dans les trois vues sectorielles, il lit donc les trois
// jeux, dont deux arrivent après le premier rendu (redrawAbsence les attend).

import { state } from './state.js?v=58f7592';
import { getData } from './data.js?v=58f7592';
import { viewEl, fmt1, themeColor } from './utils.js?v=58f7592';
import { isWorse, noteFinding, describeCanvas, tooltipStyle } from './findings.js?v=58f7592';

var RISKS = [
  { key: 'at', label: 'AT', full: 'accidents du travail' },
  { key: 'mp', label: 'MP', full: 'maladies professionnelles' },
  { key: 'trajet', label: 'Trajet', full: 'accidents de trajet' }
];
var ALPHAS = [1, 0.7, 0.45];

function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

// datasets : { at, mp, trajet } (les jeux tels que chargés, absents tant qu'ils n'ont pas
// été lus). Rend null quand le bloc ne peut pas se dessiner : AT inconnu pour ce code, jeu
// AT sans salariés, ou jeu manquant. Sinon :
// { sector, national, parts, natParts, missing } où parts et natParts sont les jours par
// salarié de chaque risque (null si le risque manque) et missing la liste des risques absents.
// Le national est calculé sur les mêmes risques que le secteur, pour comparer des choses égales.
export function computeAbsence(datasets, level, code) {
  var at = datasets && datasets.at;
  if (!at || !datasets.mp || !datasets.trajet) return null;
  var entryAt = at['by_' + level] && at['by_' + level][code];
  var staff = entryAt && entryAt.stats ? num(entryAt.stats.nb_salaries) : null;
  var natStaff = at.meta && at.meta.national ? num(at.meta.national.nb_salaries) : null;
  if (!staff || !natStaff || num(entryAt.stats.journees_it) == null) return null;

  var parts = [], natParts = [], missing = [];
  RISKS.forEach(function(r) {
    var ds = datasets[r.key];
    var entry = ds['by_' + level] && ds['by_' + level][code];
    var days = entry && entry.stats ? num(entry.stats.journees_it) : null;
    var natDays = ds.meta && ds.meta.national ? num(ds.meta.national.journees_it) : null;
    if (days == null || natDays == null) {
      parts.push(null); natParts.push(null); missing.push(r);
      return;
    }
    parts.push(days / staff);
    natParts.push(natDays / natStaff);
  });
  function total(a) { return a.reduce(function(s, v) { return s + (v || 0); }, 0); }
  return { sector: total(parts), national: total(natParts), parts: parts, natParts: natParts, missing: missing };
}

export function absenceHeadline(res) {
  return fmt1(res.sector) + ' jours d\'absence par salarié et par an, contre ' + fmt1(res.national) + ' en France';
}

// Dit quels risques manquent, sans rien promettre de plus que ce qui est calculé.
export function absenceNote(res) {
  if (!res.missing.length) return '';
  var names = res.missing.map(function(r) { return r.full; }).join(' et ');
  return 'Les ' + names + ' ne sont pas publiés pour ce secteur et ne sont pas comptés. La France est calculée sur les mêmes risques.';
}

// Rouge seulement au-dessus du national de 10 % et d'un jour au moins, bleu sinon.
export function absenceIsWorse(res) { return isWorse(res.sector, res.national); }

// Une teinte de la couleur du thème : les trois segments d'une barre en sont trois densités.
function shade(color, alpha) {
  var m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  var n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

function destroy(vs) {
  if (vs.absenceChart) { vs.absenceChart.destroy(); vs.absenceChart = null; }
}

function hide(viewId) {
  destroy(state.views[viewId]);
  var sec = viewEl(viewId, 'absenceSection');
  if (sec) sec.style.display = 'none';
}

// Dessine le bloc de la vue pour le secteur affiché. Sans les trois jeux, ne montre rien :
// redrawAbsence rappelle cette fonction à l'arrivée du dernier.
export function renderAbsence(viewId, level, code) {
  var sec = viewEl(viewId, 'absenceSection');
  if (!sec) return;
  var res = computeAbsence({ at: getData('at'), mp: getData('mp'), trajet: getData('trajet') }, level, code);
  if (!res) { hide(viewId); return; }

  var vs = state.views[viewId];
  destroy(vs);
  var worse = absenceIsWorse(res);
  var headline = absenceHeadline(res);
  viewEl(viewId, 'absenceHeadline').textContent = headline;
  var noteEl = viewEl(viewId, 'absenceNote');
  noteEl.textContent = absenceNote(res);
  noteEl.style.display = noteEl.textContent ? '' : 'none';
  sec.style.display = 'block';

  if (worse) noteFinding(viewId, { section: 'absenceSection', kind: 'days', topic: 'L\'absence liée au travail',
    text: headline, ratio: res.sector / res.national });

  var canvas = viewEl(viewId, 'absenceChart');
  describeCanvas(canvas, 'Jours d\'absence par salarié et par an. ' + headline + '.');
  var own = themeColor(worse ? '--danger' : '--accent'), grey = themeColor('--c-muted');
  var tick = themeColor('--text-dim');
  var datasets = RISKS.map(function(r, i) {
    return {
      label: r.label,
      data: [res.parts[i], res.natParts[i]],
      backgroundColor: [shade(own, ALPHAS[i]), shade(grey, ALPHAS[i])],
      borderColor: themeColor('--bg-elevated'), borderWidth: 1, borderSkipped: false
    };
  });
  vs.absenceChart = new Chart(canvas, {
    type: 'bar',
    data: { labels: ['Ce secteur', 'France'], datasets: datasets },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        datalabels: { display: false },
        legend: { position: 'bottom', labels: { color: tick, boxWidth: 12, boxHeight: 12 } },
        tooltip: Object.assign(tooltipStyle(), { callbacks: {
          label: function(c) {
            return c.raw == null ? ' ' + c.dataset.label + ', non publié' : ' ' + c.dataset.label + ', ' + fmt1(c.raw) + ' jours par salarié';
          }
        } })
      },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { color: tick, callback: function(v) { return fmt1(v); } }, grid: { color: themeColor('--border') },
          title: { display: true, text: 'Jours d\'absence par salarié et par an', color: tick } },
        y: { stacked: true, ticks: { color: themeColor('--text'), font: { size: 12 } }, grid: { display: false } }
      }
    }
  });
}

// À l'arrivée d'un jeu, redessine le bloc des vues qui affichent déjà un secteur.
export function redrawAbsence() {
  ['at', 'mp', 'trajet'].forEach(function(viewId) {
    var vs = state.views[viewId];
    if (vs && vs.code) renderAbsence(viewId, vs.level, vs.code);
  });
}
