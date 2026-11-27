// ── KPI rendering ──

import { fmt, fmt1, fmtCompact, badgeHTML, KPI_HELP, viewEl, esc } from './utils.js?v=36466a3';
import { getStore } from './data.js?v=36466a3';
import { SMALL_SECTOR } from './route.js?v=36466a3';
import { topSectors, historyYearAt } from './findings.js?v=36466a3';
import { SECTOR_COLORS } from './compare.js?v=36466a3';
import { historyFor } from './history.js?v=36466a3';
import { state, yearFor } from './state.js?v=36466a3';

// ── Le bloc des chiffres clés d'un secteur ──
// Une carte principale (l'indice de fréquence, le seul chiffre qu'une entreprise compare à son
// secteur : écart à la France et courbe depuis 2019), cinq chiffres secondaires avec leur
// évolution sur un an, et la carte qui ouvre l'analyse de Virginie. Les séries viennent de
// history-<vue>.json, chargé après le rendu : la courbe et les évolutions s'ajoutent sans rien décaler.
var SERIES = { indice_frequence: 'if', deces: 'dc', journees_it: 'j', nouvelles_ip: 'ip', nb_salaries: 'sal' };
var SPARK_FROM = 2019;

function sparkSVG(years, mine, france, at) {
  var pts = [];
  years.forEach(function(y, i) { if (y >= SPARK_FROM && mine[i] != null) pts.push({ y: y, v: mine[i], f: france ? france[i] : null, i: i }); });
  if (pts.length < 2) return '';
  var vals = [];
  pts.forEach(function(p) { vals.push(p.v); if (p.f != null) vals.push(p.f); });
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  if (hi === lo) { hi += 1; lo -= 1; }
  var W = 300, H = 72, pad = 6;
  var x = function(k) { return pad + k * (W - 2 * pad) / (pts.length - 1); };
  var yv = function(v) { return pad + (hi - v) * (H - 2 * pad) / (hi - lo); };
  var line = pts.map(function(p, k) { return (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + yv(p.v).toFixed(1); }).join(' ');
  var area = line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + H + ' L' + x(0).toFixed(1) + ' ' + H + ' Z';
  var fr = pts.every(function(p) { return p.f != null; })
    ? '<path class="kpi-spark-fr" d="' + pts.map(function(p, k) { return (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + yv(p.f).toFixed(1); }).join(' ') + '"/>' : '';
  var cur = 0;
  pts.forEach(function(p, k) { if (p.i === at) cur = k; });
  return '<div class="kpi-spark-plot"><svg class="kpi-spark-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<path class="kpi-spark-area" d="' + area + '"/>' + fr + '<path class="kpi-spark-line" d="' + line + '"/></svg>' +
    '<span class="kpi-spark-dot" style="left:' + (x(cur) / W * 100).toFixed(2) + '%;top:' + (yv(pts[cur].v) / H * 100).toFixed(2) + '%"></span></div>' +
    '<div class="kpi-spark-axis"><span>' + pts[0].y + '</span><span class="kpi-spark-key"><i class="is-me"></i>Ce secteur' +
    (fr ? '<i class="is-fr"></i>France' : '') + '</span><span>' + pts[pts.length - 1].y + '</span></div>';
}

// « ▲ 4 % sur un an » ; sous 20 cas, un pourcentage exagère : on donne la valeur de l'an passé.
function deltaHTML(statKey, cur, prev, prevYear) {
  if (cur == null || prev == null) return '';
  if (prev < 20 && statKey !== 'nb_salaries') return '<span class="kpi-delta">' + fmt(prev) + ' en ' + prevYear + '</span>';
  if (!prev) return '';
  var pct = (cur - prev) / prev * 100;
  if (Math.abs(pct) < 0.5) return '<span class="kpi-delta">Stable sur un an</span>';
  var up = pct > 0;
  var tone = statKey === 'nb_salaries' ? '' : (up ? ' is-worse' : ' is-better');
  return '<span class="kpi-delta' + tone + '"><b aria-hidden="true">' + (up ? '▲' : '▼') + '</b>' +
    (up ? '+' : '−') + fmt(Math.round(Math.abs(pct))) + '\u00a0% sur un an</span>';
}

function fillHistory(viewId, grid, code, eventKey) {
  historyFor(viewId, code).then(function(res) {
    if (!res || grid.dataset.code !== code || !grid.classList.contains('kpi-v2')) return;
    var years = res.meta.years, h = res.h;
    var at = historyYearAt(years, yearFor(viewId, state.views[viewId].level), state.views[viewId].level);
    var spark = grid.querySelector('.kpi-spark');
    if (spark && h['if']) spark.innerHTML = sparkSVG(years, h['if'], res.national && res.national['if'], at);
    if (at < 1) return;
    grid.querySelectorAll('[data-stat]').forEach(function(card) {
      var k = card.getAttribute('data-stat'), key = k === eventKey ? 'n' : SERIES[k];
      var arr = h[key];
      var slot = card.querySelector('.kpi-trend');
      if (arr && slot) slot.innerHTML = deltaHTML(k, arr[at], arr[at - 1], years[at - 1]);
    });
  }).catch(function() {});
}

function rankHTML(rank, total) {
  var fill = total > 1 ? (total - rank) / (total - 1) * 100 : 100;
  return '<div class="kpi-rank"><span class="kpi-rank-track"><i style="width:' + fill.toFixed(1) + '%"></i></span>' +
    '<span class="kpi-rank-txt">' + rank + (rank === 1 ? 'er' : 'e') + ' sur ' + fmt(total) + '</span></div>';
}


// L'aide d'une carte : son intitulé souligné en pointillé est un vrai bouton (clavier, tactile), la bulle
// s'ouvre au survol, au focus clavier et au clic. Sans définition, l'intitulé reste du texte.
var helpSeq = 0;
function labelHTML(label) {
  if (!KPI_HELP[label]) return label;
  var id = 'kpiHelpTip' + (++helpSeq);
  return '<button type="button" class="kpi-help" aria-label="' + esc(label) + ', définition" aria-expanded="false" aria-describedby="' + id + '">' +
    '<span class="kpi-help-txt">' + label + '</span>' +
    '<span class="kpi-help-tip" role="tooltip" id="' + id + '">' + KPI_HELP[label] + '</span></button>';
}

function closeHelps(except) {
  document.querySelectorAll('.kpi-help[aria-expanded="true"]').forEach(function(b) {
    if (b !== except) b.setAttribute('aria-expanded', 'false');
  });
}

// Écouteurs posés une fois pour toutes les cartes, rendues et re-rendues par innerHTML.
document.addEventListener('click', function(e) {
  var btn = e.target.closest ? e.target.closest('.kpi-help') : null;
  closeHelps(btn);
  if (!btn) return;
  btn.classList.remove('dismissed');
  btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
});
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  closeHelps(null);
  // Échap ferme aussi la bulle ouverte par le survol ou le focus.
  document.querySelectorAll('.kpi-help:hover, .kpi-help:focus').forEach(function(b) { b.classList.add('dismissed'); });
});
document.addEventListener('focusout', function(e) {
  if (e.target.classList && e.target.classList.contains('kpi-help')) e.target.classList.remove('dismissed');
});

// Formate la valeur d'un secteur comparé selon la métrique (IF = 1 décimale, reste = compact).
function fmtStat(statKey, v) {
  if (v === undefined || v === null) return '—';
  if (statKey === 'indice_frequence') return fmt1(v);
  return fmtCompact(v).text;
}

// compareStats : les stats des secteurs comparés quand elles ne sont pas celles de l'année de
// référence (filtre d'année, year.js), sinon on les lit dans le jeu NAF5.
// Sous 1 000 salariés, l'indice de fréquence d'un secteur varie de 92 % en médiane sur cinq ans,
// contre 23 % au-delà de 5 000 (mesuré sur les NAF 5, 2020 à 2024) : la note le dit au lecteur.

function kpiNote(s, values) {
  var notes = [];
  if (!s.nb_salaries) notes.push('Aucun salarié n\'est recensé dans ce secteur pour cette année, ses indicateurs ne se calculent pas.');
  else if (s.nb_salaries < SMALL_SECTOR) notes.push('Petit secteur, moins de 1 000 salariés. À cette taille, quelques accidents suffisent à faire varier fortement l\'indice de fréquence d\'une année à l\'autre, il se lit avec prudence.');
  if (values.some(function(v) { return v === null || v === undefined; })) notes.push('Un tiret signale une valeur non publiée (secret statistique).');
  return notes.join(' ');
}

export function renderKPIs(viewId, stats, national, config, allAtLevel, code, compareCodes, compareStats) {
  var s = stats;
  var nat = national;
  var cfg = config;
  var eventKey = cfg.eventKey;
  compareCodes = compareCodes || [];

  // Ranking by event count
  var rank = allAtLevel.findIndex(function(e) { return e.code === code; }) + 1;
  // « 12e sur 725 » : le rang parmi les secteurs du niveau affiché (allAtLevel).
  var rankBadge = rank < 1 ? '' : '<span class="badge neutral">' + rank + (rank === 1 ? 'er' : 'e') + ' sur ' + fmt(allAtLevel.length) + '</span>';

  var c1 = fmtCompact(s[eventKey]);
  var c2 = fmtCompact(s.deces);
  var c3 = fmtCompact(s.journees_it);
  var c4 = fmtCompact(s.nouvelles_ip);
  var c5 = fmtCompact(s.nb_salaries);
  var kpis = [
    { label: 'Indice de fréquence', statKey: 'indice_frequence', value: fmt1(s.indice_frequence), full: null, badge: badgeHTML(s.indice_frequence, nat.indice_frequence) },
    { label: cfg.eventLabel, statKey: eventKey, value: c1.text, full: c1.compact ? fmt(s[eventKey]) : null, badge: rankBadge },
    { label: 'Décès', statKey: 'deces', value: c2.text, full: c2.compact ? fmt(s.deces) : null, badge: '' },
    { label: 'Journées perdues', statKey: 'journees_it', value: c3.text, full: c3.compact ? fmt(s.journees_it) : null, badge: '' },
    { label: 'Incapacités permanentes', statKey: 'nouvelles_ip', value: c4.text, full: c4.compact ? fmt(s.nouvelles_ip) : null, badge: '' },
    { label: 'Salariés', statKey: 'nb_salaries', value: c5.text, full: c5.compact ? fmt(s.nb_salaries) : null, badge: '' },
  ];

  // En mode comparaison, on lit les valeurs des secteurs comparés (NAF5).
  var naf5 = compareCodes.length ? getStore(viewId, 'naf5') : null;

  var note = viewEl(viewId, 'kpiNote');
  if (note) {
    var txt = compareCodes.length ? '' : kpiNote(s, [s[eventKey], s.indice_frequence, s.deces, s.journees_it, s.nouvelles_ip, s.nb_salaries]);
    note.textContent = txt;
    note.hidden = !txt;
  }

  var grid = viewEl(viewId, 'kpiGrid');
  grid.classList.toggle('comparing', compareCodes.length > 0);
  // Nombre de segments (secteur courant + comparés) → la grille s'élargit progressivement.
  grid.classList.remove('seg-2', 'seg-3', 'seg-4', 'seg-5');
  if (compareCodes.length) grid.classList.add('seg-' + Math.min(compareCodes.length + 1, 5));

  grid.innerHTML = kpis.map(function(k) {

    // Mode comparaison : segments côte à côte (secteur courant + comparés), chiffres aussi visibles (style GA4).
    if (compareCodes.length) {
      var segs = '<div class="kpi-seg"><span class="kpi-seg-pill current">' + code + '</span>' +
        '<span class="kpi-seg-val">' + k.value + '</span></div>';
      segs += compareCodes.map(function(cc, i) {
        var cs = compareStats ? compareStats[cc] : (naf5[cc] && naf5[cc].stats);
        var val = cs ? fmtStat(k.statKey, cs[k.statKey]) : '—';
        var color = SECTOR_COLORS[i % SECTOR_COLORS.length];
        return '<div class="kpi-seg"><span class="kpi-seg-pill" style="background:' + color + '">' + cc + '</span>' +
          '<span class="kpi-seg-val">' + val + '</span></div>';
      }).join('');
      return '<div class="kpi-card kpi-card-compare">' +
        '<div class="label">' + labelHTML(k.label) + '</div>' +
        '<div class="kpi-segments">' + segs + '</div>' +
        '</div>';
    }

    var fullAttr = k.full ? ' data-full="' + k.full + '"' : '';
    if (k.statKey === 'indice_frequence') {
      return '<div class="kpi-card kpi-lead">' +
        '<div class="label">' + labelHTML(k.label) + '</div>' +
        '<div class="kpi-lead-fig"><div class="value">' + k.value + '</div><span class="kpi-unit">pour 1&nbsp;000 salariés</span></div>' +
        (k.badge || '') +
        // Le seul lien de la page vers l'article qui explique l'indicateur (maillage interne, SEO).
        '<a class="kpi-learn" href="./articles/taux-de-frequence-taux-de-gravite/">Indice, taux de fréquence et taux de gravité</a>' +
        '<div class="kpi-spark"></div>' +
        '</div>';
    }
    return '<div class="kpi-card kpi-mini" data-stat="' + k.statKey + '">' +
      '<div class="label">' + labelHTML(k.label) + '</div>' +
      '<div class="value"' + fullAttr + '>' + k.value + '</div>' +
      (k.statKey === eventKey && rank >= 1 ? rankHTML(rank, allAtLevel.length) : '') +
      '<div class="kpi-trend"></div>' +
      '</div>';
  }).join('');
  grid.classList.toggle('kpi-v2', !compareCodes.length);
  grid.dataset.code = code;
  if (!compareCodes.length) {
    if (window.lucide) window.lucide.createIcons();
    fillHistory(viewId, grid, code, eventKey);
  }
}

export function renderNationalState(viewId, getData, getStore, cfg, setLevel, selectCode, renderFn) {
  var data = getData(viewId);
  var nat = data.meta.national;
  var container = viewEl(viewId, 'nationalState');
  if (!container || !nat) return;

  // National KPIs (same layout as code KPIs, without badges)
  var nc1 = fmtCompact(nat[cfg.eventKey] || 0);
  var nc2 = fmtCompact(nat.deces || 0);
  var nc3 = fmtCompact(nat.journees_it || 0);
  var nc4 = fmtCompact(nat.nouvelles_ip || 0);
  var nc5 = fmtCompact(nat.nb_salaries || 0);
  var kpis = [
    { label: cfg.eventLabel, value: nc1.text, full: nc1.compact ? fmt(nat[cfg.eventKey] || 0) : null },
    { label: 'Indice de fréquence', value: fmt(nat.indice_frequence) },
    { label: 'Décès', value: nc2.text, full: nc2.compact ? fmt(nat.deces || 0) : null },
    { label: 'Journées perdues', value: nc3.text, full: nc3.compact ? fmt(nat.journees_it || 0) : null },
    { label: 'Incapacités permanentes', value: nc4.text, full: nc4.compact ? fmt(nat.nouvelles_ip || 0) : null },
    { label: 'Salariés', value: nc5.text, full: nc5.compact ? fmt(nat.nb_salaries || 0) : null },
  ];

  var kpiHtml = '<div class="kpi-grid">' + kpis.map(function(k) {
    var fullAttr = k.full ? ' data-full="' + k.full + '"' : '';
    return '<div class="kpi-card"><div class="label">' + labelHTML(k.label) + '</div><div class="value"' + fullAttr + '>' + k.value + '</div></div>';
  }).join('') + '</div>';

  // Top 10 NAF5 by IF
  var naf5Store = getStore(viewId, 'naf5');
  var top10 = topSectors(naf5Store, cfg.eventKey);

  var rowsHtml = top10.map(function(item, idx) {
    return '<div class="top-sector-row" data-code="' + item.code + '">' +
      '<span class="rank">' + (idx + 1) + '</span>' +
      '<span class="code">' + item.code + '</span>' +
      '<span class="libelle">' + item.libelle + '</span>' +
      '<span class="if-val">' + fmt1(item.if_val) + '</span>' +
      '<span class="events">' + fmt(item.events) + '</span>' +
      '</div>';
  }).join('');

  container.innerHTML = kpiHtml +
    '<div class="top-sectors"><h4>Top 10 secteurs par indice de fréquence</h4>' + rowsHtml + '</div>';

  // Click to navigate
  container.querySelectorAll('.top-sector-row').forEach(function(row) {
    row.addEventListener('click', function() {
      var code = this.dataset.code;
      setLevel(viewId, 'naf5');
      selectCode(viewId, code, 'naf5', renderFn);
    });
  });
}
