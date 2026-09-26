// ── KPI rendering ──

import { fmt, fmtCompact, badgeHTML, KPI_HELP, viewEl } from './utils.js';
import { getStore } from './data.js';
import { SECTOR_COLORS } from './compare.js';

// Formate la valeur d'un secteur comparé selon la métrique (IF = 1 décimale, reste = compact).
function fmtStat(statKey, v) {
  if (v === undefined || v === null) return '—';
  if (statKey === 'indice_frequence') return fmt(v);
  return fmtCompact(v).text;
}

export function renderKPIs(viewId, stats, national, config, allAtLevel, code, compareCodes) {
  var s = stats;
  var nat = national;
  var cfg = config;
  var eventKey = cfg.eventKey;
  compareCodes = compareCodes || [];

  // Ranking by event count
  var rank = allAtLevel.findIndex(function(e) { return e.code === code; }) + 1;
  var total = allAtLevel.length;
  var rankBadge = '<span class="badge neutral">#' + rank + '</span>';

  var c1 = fmtCompact(s[eventKey]);
  var c2 = fmtCompact(s.deces);
  var c3 = fmtCompact(s.journees_it);
  var c4 = fmtCompact(s.nouvelles_ip);
  var c5 = fmtCompact(s.nb_salaries);
  var kpis = [
    { label: cfg.eventLabel, statKey: eventKey, value: c1.text, full: c1.compact ? fmt(s[eventKey]) : null, badge: rankBadge },
    { label: 'Indice de fréquence', statKey: 'indice_frequence', value: fmt(s.indice_frequence), full: null, badge: badgeHTML(s.indice_frequence, nat.indice_frequence) },
    { label: 'Décès', statKey: 'deces', value: c2.text, full: c2.compact ? fmt(s.deces) : null, badge: '' },
    { label: 'Journées perdues', statKey: 'journees_it', value: c3.text, full: c3.compact ? fmt(s.journees_it) : null, badge: '' },
    { label: 'Incapacités permanentes', statKey: 'nouvelles_ip', value: c4.text, full: c4.compact ? fmt(s.nouvelles_ip) : null, badge: '' },
    { label: 'Salariés', statKey: 'nb_salaries', value: c5.text, full: c5.compact ? fmt(s.nb_salaries) : null, badge: '' },
  ];

  // En mode comparaison, on lit les valeurs des secteurs comparés (NAF5).
  var naf5 = compareCodes.length ? getStore(viewId, 'naf5') : null;

  var grid = viewEl(viewId, 'kpiGrid');
  grid.classList.toggle('comparing', compareCodes.length > 0);
  // Nombre de segments (secteur courant + comparés) → la grille s'élargit progressivement.
  grid.classList.remove('seg-2', 'seg-3', 'seg-4', 'seg-5');
  if (compareCodes.length) grid.classList.add('seg-' + Math.min(compareCodes.length + 1, 5));

  grid.innerHTML = kpis.map(function(k) {
    var help = KPI_HELP[k.label] ? '<span class="kpi-help">?<span class="kpi-help-tip">' + KPI_HELP[k.label] + '</span></span>' : '';

    // Mode comparaison : segments côte à côte (secteur courant + comparés), chiffres aussi visibles (style GA4).
    if (compareCodes.length) {
      var segs = '<div class="kpi-seg"><span class="kpi-seg-pill current">' + code + '</span>' +
        '<span class="kpi-seg-val">' + k.value + '</span></div>';
      segs += compareCodes.map(function(cc, i) {
        var ce = naf5[cc];
        var val = ce ? fmtStat(k.statKey, ce.stats[k.statKey]) : '—';
        var color = SECTOR_COLORS[i % SECTOR_COLORS.length];
        return '<div class="kpi-seg"><span class="kpi-seg-pill" style="background:' + color + '">' + cc + '</span>' +
          '<span class="kpi-seg-val">' + val + '</span></div>';
      }).join('');
      return '<div class="kpi-card kpi-card-compare">' +
        '<div class="label">' + k.label + help + '</div>' +
        '<div class="kpi-segments">' + segs + '</div>' +
        '</div>';
    }

    var fullAttr = k.full ? ' data-full="' + k.full + '"' : '';
    return '<div class="kpi-card">' +
      '<div class="label">' + k.label + help + '</div>' +
      '<div class="value"' + fullAttr + '>' + k.value + '</div>' +
      (k.badge || '') +
      '</div>';
  }).join('');
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
    var help = KPI_HELP[k.label] ? '<span class="kpi-help">?<span class="kpi-help-tip">' + KPI_HELP[k.label] + '</span></span>' : '';
    return '<div class="kpi-card"><div class="label">' + k.label + help + '</div><div class="value"' + fullAttr + '>' + k.value + '</div></div>';
  }).join('') + '</div>';

  // Top 10 NAF5 by IF
  var naf5Store = getStore(viewId, 'naf5');
  var top10 = Object.entries(naf5Store)
    .map(function(pair) { return { code: pair[0], libelle: pair[1].libelle, if_val: pair[1].stats.indice_frequence, events: pair[1].stats[cfg.eventKey] || 0 }; })
    .sort(function(a, b) { return b.if_val - a.if_val; })
    .slice(0, 10);

  var rowsHtml = top10.map(function(item, idx) {
    return '<div class="top-sector-row" data-code="' + item.code + '">' +
      '<span class="rank">' + (idx + 1) + '</span>' +
      '<span class="code">' + item.code + '</span>' +
      '<span class="libelle">' + item.libelle + '</span>' +
      '<span class="if-val">' + item.if_val.toFixed(1) + '</span>' +
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
