// ── Le rapport : les briques des chapitres ──
// Les écarts relevés pour la page de la direction, les figures, les encadrés, et les repères nationaux.

import { esc, fmt1, frNum } from './utils.js?v=e9f97a8';
import { chartSlot } from './report-charts.js?v=e9f97a8';
import { isWorse, nationalSum } from './findings.js?v=e9f97a8';
import { getData } from './data.js?v=e9f97a8';
import { CAUSE_LABELS } from './report-constants.js?v=e9f97a8';
import { pct, ext, offerHref, OFFERS, resourceCard } from './report-offers.js?v=e9f97a8';
import { helpLine, plural } from './report-base.js?v=e9f97a8';

// Les écarts marqués en rouge, relevés au fil des graphiques pour la page de la direction.
// Chaque écart garde son risque (PART, posé par chaque partie) et son sujet court.
var NOTES = [], PART = '';
// L'état se pose et se lit par ces fonctions : un module importé ne peut pas réaffecter ses variables.
export function resetNotes() { NOTES = []; }
export function setPart(name) { PART = name; }
export function noteCount() { return NOTES.length; }
export function trimNotes(n) { NOTES.length = n; }
export function sortedNotes() { return NOTES.slice().sort(function(a, b) { return b.ratio - a.ratio; }); }

// pair : la ligne en cause, sa valeur dans le secteur (a) et au national (b), et son unité, pour
// les deux barres de la page de la direction.
export function noteGap(topic, ratio, pair) {
  if (ratio > 1) NOTES.push({ part: PART === 'Maladies professionnelles' ? 'mp' : 'at', head: PART + ' · ' + topic.split(',')[0],
    label: esc(pair.label), a: pair.a, b: pair.b, unit: pair.unit, ratio: ratio });
}

export function fmtNote(n, unit) { return unit === '' ? fmt1(n) : frNum(n); }

// Un graphique du rapport : le constat en titre, le sujet en sous-titre, puis le canvas.
// Un graphique dont la série du secteur ne publie rien au-dessus de zéro : à sa place, le cadre
// de même hauteur et sa phrase, comme data.ameli.fr affiche « aucune donnée ».
export function noDataFig(topic, text, rows) {
  return '<div class="rp-figure"><p class="rp-find">' + topic + '</p><div class="rp-nodata" style="height:' + (4 + rows * 7) + 'mm"><span>' + text + '</span></div></div>';
}

export function published(a) { return !!a && a.some(function(x) { return x > 0; }); }

export function fig(find, topic, spec, rows, legend) {
  return '<div class="rp-figure">' + (find ? '<p class="rp-find">' + find + '</p>' : '<p class="rp-find">' + topic + '</p>') +
    (find ? '<p class="rp-why">' + topic + '</p>' : '') + chartSlot(spec, 4 + rows * 7) + (legend || '') + '</div>';
}

// La légende sous un graphique de répartition ou de durées, sur une ligne : ce que sont la barre
// pâle ou le trait. Le rouge se lit sans légende, la barre dépasse sa référence.
function legendOf(kind) {
  return '<p class="rp-legend"><span><i class="is-part"></i>Votre secteur</span>' +
    (kind === 'days' ? '<span><i class="is-tick"></i>Moyenne nationale</span>' : '<span><i class="is-ref"></i>France entière</span>') + '</p>';
}

// Un libellé d'axe sur deux lignes au plus, coupé à l'espace le plus proche du milieu : une ligne
// de graphique tient 7 mm, et une troisième ligne chevaucherait la voisine.
export function twoLines(text) {
  if (text.length <= 26) return text;
  var best = -1;
  for (var i = text.indexOf(' '); i >= 0; i = text.indexOf(' ', i + 1)) {
    if (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2)) best = i;
  }
  return best < 0 ? text : [text.slice(0, best), text.slice(best + 1)];
}

// Parts en %, la part nationale en barre pâle derrière. rows : [{ label, pct, nat }].
// opts.rows force la hauteur (pour aligner deux graphiques côte à côte), opts.thick l'épaisseur,
// opts.wide un graphique en pleine largeur, ses libellés sur une ligne.
export function shareFig(rows, topic, mark, opts) {
  opts = opts || {};
  rows = (rows || []).filter(function(r) { return r.pct != null; });
  if (rows.length < 2) return '';
  var hasRef = rows.some(function(r) { return r.nat != null; });
  // Le titre est le sujet du graphique, comme dans l'outil : un constat n'y nommerait qu'une ligne
  // quand plusieurs dépassent le national. Le plus fort écart rejoint « L'essentiel ».
  var worst = rows.filter(function(r) { return isWorse(r.pct, r.nat); }).sort(function(a, b) { return b.pct / b.nat - a.pct / a.nat; })[0];
  if (worst) noteGap(topic, worst.pct / worst.nat, { label: worst.label, a: worst.pct, b: worst.nat, unit: '%' });
  return fig(null, topic, { type: 'share', aria: topic, labelW: opts.wide ? 300 : null, labels: rows.map(function(r) { return opts.wide ? r.label : twoLines(r.label); }),
    values: rows.map(function(r) { return r.pct; }), ref: hasRef ? rows.map(function(r) { return r.nat; }) : null, mark: mark == null ? -1 : mark, fmt: 'pct', thick: opts.thick }, opts.rows || rows.length, hasRef && !opts.noLegend ? legendOf('share') : '');
}

// Journées par sinistre, la moyenne nationale en trait. rows : [{ label, value, nat }].
export function daysFig(rows, topic) {
  rows = (rows || []).filter(function(r) { return r.value > 0; });
  if (rows.length < 2) return '';
  // « L'essentiel » retient le plus grand écart en jours : un rapport de durées gonfle quand la
  // moyenne nationale d'une modalité rare tient en quelques jours.
  var worst = rows.filter(function(r) { return isWorse(r.value, r.nat); }).sort(function(a, b) { return (b.value - b.nat) - (a.value - a.nat); })[0];
  if (worst) noteGap(topic, worst.value / worst.nat, { label: worst.label, a: worst.value, b: worst.nat, unit: 'j' });
  var hasRef = rows.some(function(r) { return r.nat != null; });
  return fig(null, topic, { type: 'days', aria: topic, labels: rows.map(function(r) { return twoLines(r.label); }),
    values: rows.map(function(r) { return r.value; }), ref: rows.map(function(r) { return r.nat == null ? null : r.nat; }) }, rows.length, hasRef ? legendOf('days') : '');
}

export function cols(a, b) { return a && b ? '<div class="rp-grid2"><div>' + a + '</div><div>' + b + '</div></div>' : (a || '') + (b || ''); }

function para(list) { return list.filter(Boolean).map(function(t) { return '<p class="rp-p">' + t + '</p>'; }).join(''); }

export function meaning(list) {
  list = list.filter(Boolean);
  return list.length ? '<div class="rp-meaning"><h3 class="rp-h3">Ce que cela veut dire pour vous</h3>' + para(list) + '</div>' : '';
}

// Un mot du texte en lien vers l'offre qui s'y rapporte.
export function kw(key, text) { return ext(offerHref(OFFERS[key]), text); }

// Ce que vous pouvez faire : les actions du chapitre, avec qui et quand, puis l'aide d'Ayming,
// une phrase par offre, et la ressource, retirée si la page déborde.
// Les actions, les offres et la ressource du thème, celles de la feuille de route.
export function guideOf(t, d, lead) { return t ? nextBox({ lead: lead, actions: t.actions, offers: t.offers, card: t.resource }, d) : ''; }

function nextBox(g, d) {
  var acts = g.actions || [], offers = g.offers || [];
  if (!acts.length && !offers.length) return '';
  return '<div class="rp-todo">' + (g.lead ? '<p class="rp-todo-lead">' + g.lead + '</p>' : '') +
      '<div class="rp-todo-cols"><div><p class="rp-todo-k">' + (acts.length > 1 ? 'Vos actions' : 'Votre action') + '</p>' +
      '<ol class="rp-do">' + acts.map(function(a, i) {
        return '<li><span class="rp-do-n">' + (i + 1) + '</span><div>' + a.text + '<span class="rp-do-meta">' + a.owner + ', ' + a.whenLabel.charAt(0).toLowerCase() + a.whenLabel.slice(1) + '</span></div></li>';
      }).join('') + '</ol></div>' +
      (offers.length ? '<div><p class="rp-todo-k">Comment Ayming peut vous aider</p>' +
        '<ul class="rp-help">' + offers.map(function(k) { return helpLine(k, d); }).join('') + '</ul></div>' : '') + '</div>' +
      (g.card ? '<div class="rp-filler">' + resourceCard(g.card, true) + '</div>' : '') +
    '</div>';
}

// Le face-à-face du bandeau : le chiffre de l'entreprise, « VS », celui du secteur. La pastille
// dit l'écart, en rouge seulement quand l'entreprise fait moins bien.
export function vsHero(co, coLabel, sec, secLabel, ratio) {
  var chip = ratio == null || !isFinite(ratio) ? '' : ratio >= 2 ? '×' + fmt1(ratio) + ' le secteur' : ratio > 1.05 ? '+' + Math.round((ratio - 1) * 100) + ' %' : ratio < 0.95 ? '−' + Math.round((1 - ratio) * 100) + ' %' : 'au niveau';
  return '<div class="rp-vs"><div class="rp-vs-co">' + (chip ? '<span class="rp-vs-chip' + (ratio > 1.05 ? ' is-worse' : '') + '">' + chip + '</span>' : '') +
      '<strong>' + co + '</strong><span>' + coLabel + '</span></div><span class="rp-vs-mid">VS</span>' +
    '<div><strong>' + sec + '</strong><span>' + secLabel + '</span></div></div>';
}

// Trois chiffres du bandeau, sans cadre. figs : [[chiffre, légende], ...].
export function heroFigs(figs) {
  figs = figs.filter(Boolean);
  return figs.length ? '<div class="rp-hero-figs">' + figs.map(function(f) { return '<div><strong>' + f[0] + '</strong><span>' + f[1] + '</span></div>'; }).join('') + '</div>' : '';
}

// Une phrase qui porte la page, en blanc sur le bleu nuit.
export function punch(html) { return html ? '<p class="rp-punch">' + html + '</p>' : ''; }

export function lowerFirst(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }

// ── Références nationales, calculées une fois par jeu de données ──
var MEMO = {};

export function memo(key, fn) { if (!(key in MEMO)) MEMO[key] = fn(); return MEMO[key]; }

// Parts des causes au national : les parts de chaque secteur, pondérées par ses sinistres.
export function nationalCauses(view, countKey) {
  return memo('causes-' + view, function() {
    var store = (getData(view) || {}).by_naf5 || {}, sum = {}, tot = 0;
    Object.keys(store).forEach(function(c) {
      var e = store[c], n = (e.stats || {})[countKey] || 0, rc = e.risk_causes || {};
      if (!n) return;
      Object.keys(rc).forEach(function(k) { sum[k] = (sum[k] || 0) + (rc[k] || 0) * n; });
      tot += n;
    });
    var out = {};
    Object.keys(sum).forEach(function(k) { out[k] = tot ? Math.round(sum[k] / tot * 10) / 10 : 0; });
    return out;
  });
}

export function nationalExtra() {
  return memo('extra', function() {
    var ex = getData('extra') || {};
    return nationalSum(Object.keys(ex).map(function(c) { return ex[c]; }));
  });
}

// Le rang d'un indice de fréquence parmi les secteurs NAF 5 publiés, du plus exposé au moins exposé.
export function rankOf(view, value) {
  var list = memo('if-' + view, function() {
    var store = (getData(view) || {}).by_naf5 || {};
    return Object.keys(store).map(function(c) { return (store[c].stats || {}).indice_frequence; }).filter(function(x) { return x != null; });
  });
  return { rank: 1 + list.filter(function(x) { return x > value; }).length, of: list.length };
}

export function causeRows(entry, natShares) {
  return Object.keys((entry || {}).risk_causes || {}).map(function(k) {
    return { key: k, label: CAUSE_LABELS[k] || k, pct: entry.risk_causes[k], nat: natShares[k] };
  }).filter(function(r) { return r.pct > 0 && r.key !== 'Autres risques'; })
    .sort(function(a, b) { return b.pct - a.pct; }).slice(0, 6);
}

// ── Partie 1, les accidents du travail ──

// Votre position : votre fréquence face au secteur en tête de page, les quatre repères, le rang
// parmi les secteurs, et vingt ans de fréquence nationale avec les dix ans du secteur.
// La sinistralité par taille d'établissement, le graphique de l'outil : la part des accidents et
// celle des salariés par tranche, la fréquence de chaque tranche. Les chiffres du secteur seuls,
// l'entreprise se lit dans les quatre repères au-dessus. Une tranche sans
// salarié publié ne se dessine pas.
export function sizeBlock(d) {
  var bands = (d.bands || []).filter(function(b) { return b.part_salaries > 0; }), out = { html: '', txt: null };
  if (bands.length < 2 || !d.stats.indice_frequence) return out;
  // Sans accident publié, la fréquence de la tranche reste vide plutôt que de se lire comme un zéro.
  var ifs = bands.map(function(b) { return b.part_accidents > 0 ? Math.round(b.part_accidents / b.part_salaries * d.stats.indice_frequence * 10) / 10 : null; });
  var you = d.bandIndex != null ? bands.indexOf(d.bands[d.bandIndex]) : -1;
  out.html = fig(null, 'Sinistralité par taille d\'établissement',
    { type: 'size', aria: 'Part des accidents, part des salariés et fréquence par taille d\'établissement', labels: bands.map(function(b) { return b.label; }),
      acc: bands.map(function(b) { return b.part_accidents; }), sal: bands.map(function(b) { return b.part_salaries; }), ifs: ifs }, 6);
  if (you >= 0 && ifs[you] != null) out.txt = 'Avec ' + plural(d.effectif, 'salarié', 'salariés') + ', vous êtes dans la tranche ' + bands[you].label + ', où la fréquence du secteur est de ' + fmt1(ifs[you]) +
    ' accidents pour 1 000 salariés. Votre entreprise est à ' + fmt1(d.at.co) + '. Une tranche dont la part des accidents dépasse la part des salariés est plus exposée que la moyenne du secteur.';
  return out;
}

// Le positionnement de l'outil : chaque secteur NAF 5 est un point placé selon sa fréquence, le
// secteur dans la couleur de la partie, l'entreprise en bleu Ayming, la moyenne nationale en trait.
// L'échelle s'arrête au 99e centile pour qu'un secteur extrême n'écrase pas les autres, un point
// au-delà se pose au bord.
export function positionStrip(d) {
  var store = (getData('at') || {}).by_naf5 || {};
  // Les mêmes activités que le rang cité à côté (rankOf) : toutes celles dont l'indice est publié.
  var all = Object.keys(store).map(function(c) { return store[c].stats; }).filter(function(s) { return s && s.indice_frequence != null; })
    .map(function(s) { return s.indice_frequence; }).sort(function(a, b) { return a - b; });
  if (all.length < 20) return '';
  var max = Math.max(all[Math.floor(all.length * 0.99)], d.at.sec, d.at.co) * 1.04;
  var x = function(v) { return Math.min(100, v / max * 100); };
  var dots = all.map(function(v) { return '<i style="left:' + x(v).toFixed(2) + '%"></i>'; }).join('');
  // Deux repères à moins de 40 px l'un de l'autre (6,2 % de la bande, 172 mm) : le plus bas écrit son libellé à gauche de son trait.
  var near = Math.abs(x(d.at.sec) - x(d.at.nat)) < 6.2;
  var mark = function(v, cls, label) {
    var left = near && ((cls === 'is-sec' && d.at.sec <= d.at.nat) || (cls === 'is-nat' && d.at.nat < d.at.sec)) ? ' is-left' : '';
    return '<span class="rp-strip-mark ' + cls + left + '" style="left:' + x(v).toFixed(2) + '%"><b>' + label + '</b></span>';
  };
  return '<div class="rp-figure"><p class="rp-find">Votre secteur parmi les ' + all.length + ' activités</p>' +
    '<p class="rp-why">Chaque point est une activité, placée selon ses accidents avec arrêt pour 1 000 salariés.</p>' +
    '<div class="rp-strip"><div class="rp-strip-track">' + dots + '</div>' +
      mark(d.at.nat, 'is-nat', 'France ' + fmt1(d.at.nat)) + mark(d.at.sec, 'is-sec', 'Votre secteur ' + fmt1(d.at.sec)) + mark(d.at.co, 'is-co', 'Vous ' + fmt1(d.at.co)) +
    '</div><p class="rp-strip-axis"><span>Les moins exposées</span><span>Les plus exposées</span></p></div>';
}
