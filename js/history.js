// ── Dix ans d'évolution, circonstances et journées d'arrêt ──
// Deux fichiers que la page ne charge qu'à l'ouverture d'une vue sectorielle, pour ne pas
// alourdir le premier affichage : history-<vue>.json (séries 2015 à l'année de référence,
// tirées de l'API Ameli) et fiche-<vue>.json (les répartitions des fiches, avec les journées
// perdues). Chaque graphique sert un thème du rapport : le taux, les arrêts, la prévention, les MP.
// Les panneaux à barres passent par renderDimensionPanel (charts.js), les courbes sont
// dessinées ici. Tout graphique vit dans un pool de state.views et est détruit au rendu suivant.

import { fmt, pctFr, themeColor, cssColor, viewEl, levelOfCode } from './utils.js?v=f8b7846';
import { state, VIEW_CONFIG } from './state.js?v=f8b7846';
import { PANELS, renderDimensionPanel } from './charts.js?v=f8b7846';
import { isWorse, short, versus, noteFinding, tooltipStyle, titleStyle, subtitleStyle, buildDaysChart, buildShareChart, describeCanvas } from './findings.js?v=f8b7846';
import { daysFigure } from './body.js?v=f8b7846';

var FILES = {};

function load(name) {
  if (!FILES[name]) {
    FILES[name] = fetch('./data/' + name + '.json').then(function(resp) {
      if (!resp.ok) throw new Error(name + ' (' + resp.status + ')');
      return resp.json();
    });
    // Un échec ne reste pas en cache : le rendu suivant retentera.
    FILES[name].catch(function() { delete FILES[name]; });
  }
  return FILES[name];
}

function lookup(file, code) {
  return (file && file['by_' + levelOfCode(code)] || {})[code] || null;
}

// ── Lecture des répartitions des fiches ──

// Modalités qui ne disent rien de la circonstance : on les écarte, comme ailleurs dans l'app.
var UNKNOWN = /non pr[ée]cis|non cod|non d[ée]termin|inconnu|pas d.information|sans information|non renseign/i;

function cap(label) {
  var s = String(label).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ficheRows(dims, risk, dim) {
  return ((((dims || {})[risk]) || {})[dim] || []).filter(function(r) { return !UNKNOWN.test(r[0]); });
}

// Une entrée de fiche-<vue>.json porte des lignes [indice du libellé, sinistres, journées].
function expandRows(file, entry) {
  var out = {};
  Object.keys(entry).forEach(function(dim) {
    var labels = file.meta.labels[dim] || [];
    out[dim] = entry[dim].map(function(r) { return [labels[r[0]], r[1], r[2]]; });
  });
  return out;
}

// Les fiches ne publient pas de ligne nationale. La somme des NAF 2, qui couvrent tous les
// secteurs sans case masquée, en tient lieu. Calculée une fois par vue.
var NATIONAL = {};
function nationalFiche(file, viewId) {
  if (NATIONAL[viewId]) return NATIONAL[viewId];
  var sums = {};
  Object.keys(file.by_naf2 || {}).forEach(function(code) {
    var entry = file.by_naf2[code];
    Object.keys(entry).forEach(function(dim) {
      var byLabel = sums[dim] || (sums[dim] = {});
      entry[dim].forEach(function(r) {
        var s = byLabel[r[0]] || (byLabel[r[0]] = [r[0], 0, 0]);
        s[1] += r[1]; s[2] += r[2];
      });
    });
  });
  var entry = {};
  Object.keys(sums).forEach(function(dim) { entry[dim] = Object.keys(sums[dim]).map(function(k) { return sums[dim][k]; }); });
  var nat = {};
  nat[viewId] = expandRows(file, entry);
  NATIONAL[viewId] = nat;
  return nat;
}

function expandFiche(file, viewId, code) {
  var entry = lookup(file, code);
  if (!entry) return null;
  var dims = { nat: nationalFiche(file, viewId) };
  dims[viewId] = expandRows(file, entry);
  return dims;
}


// Part des sinistres par modalité, les premières seulement, avec la part nationale.
var TOP = 8;
export function ficheShares(risk, dim) {
  var shares = function(rows) {
    rows = rows.filter(function(r) { return r[1] > 0; });
    var total = rows.reduce(function(s, r) { return s + r[1]; }, 0);
    return rows.map(function(r) { return { label: cap(r[0]), value: r[1], pct: Math.round(r[1] / total * 1000) / 10 }; });
  };
  return function(dims) {
    var nat = {};
    shares(ficheRows((dims || {}).nat, risk, dim)).forEach(function(d) { nat[d.label] = d.pct; });
    return shares(ficheRows(dims, risk, dim))
      .map(function(d) { d.nat = nat[d.label] || 0; return d; })
      .sort(function(a, b) { return b.value - a.value; })
      .slice(0, TOP);
  };
}

// Journées perdues par sinistre. Une modalité de quelques cas donnerait une moyenne au
// hasard : on ne garde que celles qui pèsent au moins 2 % des sinistres, et 5 cas.
export function ficheDays(risk, dim, keepOrder) {
  return function(dims) {
    var nat = {};
    ficheRows((dims || {}).nat, risk, dim).forEach(function(r) { if (r[1]) nat[cap(r[0])] = Math.round(r[2] / r[1]); });
    var rows = ficheRows(dims, risk, dim);
    var total = rows.reduce(function(s, r) { return s + r[1]; }, 0);
    var floor = Math.max(5, total * 0.02);
    var out = rows
      .filter(function(r) { return r[1] >= floor && r[2] > 0; })
      .map(function(r) { var l = cap(r[0]); return { label: l, value: Math.round(r[2] / r[1]), n: r[1], nat: nat[l] }; });
    if (!keepOrder) out.sort(function(a, b) { return b.value - a.value; });
    return out.slice(0, TOP);
  };
}


// Pour le rapport PDF : les répartitions de la fiche d'un secteur, avec la référence nationale,
// prêtes pour ficheShares, ficheDays et siegeDays. null quand la fiche du secteur manque.
export function ficheFor(viewId, code) {
  return load('fiche-' + viewId).then(function(file) { return expandFiche(file, viewId, code); });
}

// Le fichier des séries d'une vue, pour le filtre d'année des chiffres clés (year.js).
export function historyFile(viewId) { return load('history-' + viewId); }

// Pour le rapport PDF : les séries annuelles d'un secteur et du national.
export function historyFor(viewId, code) {
  return load('history-' + viewId).then(function(file) {
    var h = lookup(file, code);
    return h ? { meta: file.meta, h: h, national: file.national } : null;
  });
}

// Le siège des lésions se lit sur la silhouette de body.js : chaque libellé de fiche rejoint
// une partie de la silhouette, « corps entier » et « autres » passent en ligne sous la figure.
var SIEGE_PARTS = [
  [/^t[êe]te/i, 'tete'], [/^cou/i, 'cou'], [/^dos/i, 'dos'], [/^torse/i, 'torse'],
  [/^membres sup/i, 'membres_superieurs'], [/^membres inf/i, 'membres_inferieurs'],
  [/^ensemble du corps/i, 'corps_entier'], [/^autres/i, 'autres']
];

export function siegeDays(risk) {
  var days = ficheDays(risk, 'siege_des_lesions');
  return function(dims) {
    return days(dims).map(function(d) {
      var part = SIEGE_PARTS.filter(function(p) { return p[0].test(d.label); })[0];
      return part ? { key: part[1], label: d.label, value: d.value, n: d.n, nat: d.nat } : null;
    }).filter(Boolean);
  };
}

function siegeDaysFigure(entries, title) {
  var days = {}, worse = {};
  entries.forEach(function(d) { days[d.key] = d.value; if (isWorse(d.value, d.nat)) worse[d.key] = true; });
  return '<div class="bf-head">' + title + '</div>' + daysFigure(days, title + ', journées d\'arrêt par sinistre', worse);
}

var LAZY_PANELS = {
  atCirc: {
    section: 'circSection', empty: 'Circonstances indisponibles.',
    metrics: [
      { title: 'Ce qui a dérapé (déviation)', bars: ficheShares('at', 'deviation'), build: buildShareChart },
      { title: 'Agent matériel en cause', bars: ficheShares('at', 'agent_materiel_de_la_deviation'), build: buildShareChart },
    ]
  },
  trajetCirc: {
    section: 'circSection', empty: 'Circonstances indisponibles.',
    metrics: [
      { title: 'Ce qui a dérapé (déviation)', bars: ficheShares('trajet', 'deviation'), build: buildShareChart },
      { title: 'Agent matériel en cause', bars: ficheShares('trajet', 'agent_materiel_de_la_deviation'), build: buildShareChart },
    ]
  },
  atSeverity: {
    section: 'severitySection', empty: 'Journées d\'arrêt indisponibles.',
    metrics: [
      { title: 'Selon la nature des lésions', bars: ficheDays('at', 'nature_des_lesions'), build: buildDaysChart },
      { title: 'Selon le siège des lésions', bars: siegeDays('at'), html: siegeDaysFigure },
      { title: 'Selon l\'âge de la victime', bars: ficheDays('at', 'age_de_la_victime', true), build: buildDaysChart },
      { title: 'Selon l\'agent matériel', bars: ficheDays('at', 'agent_materiel_de_la_deviation'), build: buildDaysChart }
    ]
  },
  trajetSeverity: {
    section: 'severitySection', empty: 'Journées d\'arrêt indisponibles.',
    metrics: [
      { title: 'Selon la nature des lésions', bars: ficheDays('trajet', 'nature_des_lesions'), build: buildDaysChart },
      { title: 'Selon le siège des lésions', bars: siegeDays('trajet'), html: siegeDaysFigure },
      { title: 'Selon l\'âge de la victime', bars: ficheDays('trajet', 'age_de_la_victime', true), build: buildDaysChart }
    ]
  },
  mpSeverity: {
    section: 'severitySection', empty: 'Journées d\'arrêt indisponibles.',
    metrics: [
      { title: 'Selon la maladie', bars: ficheDays('mp', 'maladie'), build: buildDaysChart },
      { title: 'Selon l\'âge de la victime', bars: ficheDays('mp', 'age_de_la_victime', true), build: buildDaysChart },
      { title: 'Selon la durée d\'exposition', bars: ficheDays('mp', 'duree_d_exposition', true), build: buildDaysChart },
      { title: 'Selon la profession', bars: ficheDays('mp', 'profession'), build: buildDaysChart }
    ]
  },
};
Object.keys(LAZY_PANELS).forEach(function(k) { PANELS[k] = LAZY_PANELS[k]; });

// ── Courbes sur dix ans ──

var HISTORY_CHARTS = {
  at: ['if', 'days', 'severity', 'causes'],
  mp: ['if', 'days', 'severity', 'groupes'],
  trajet: ['if', 'days', 'severity', 'causes']
};

// endLabel est le nom écrit au bout de la courbe, à la place d'une légende.
function lineDataset(label, data, color, opts) {
  return Object.assign({
    label: label, endLabel: label, data: data, borderColor: color, backgroundColor: color, borderWidth: 2,
    pointRadius: 3, pointHoverRadius: 5, tension: 0.3, fill: false, spanGaps: true
  }, opts || {});
}

// Chaque série écrit son nom à droite de son dernier point. Deux noms trop proches sont
// écartés vers le bas, puis ramenés dans le cadre.
var END_FONT = '600 11px Lato, sans-serif';
var END_GAP = 13;
var END_LABELS = {
  id: 'endLabels',
  afterDatasetsDraw: function(chart) {
    var items = [];
    chart.data.datasets.forEach(function(ds, i) {
      if (!ds.endLabel || ds.type === 'bar' || !chart.isDatasetVisible(i)) return;
      var meta = chart.getDatasetMeta(i);
      for (var j = ds.data.length - 1; j >= 0; j--) {
        if (ds.data[j] != null) { items.push({ text: ds.endLabel, color: ds.borderColor, x: meta.data[j].x, y: meta.data[j].y }); break; }
      }
    });
    if (!items.length) return;
    items.sort(function(p, q) { return p.y - q.y; });
    for (var k = 1; k < items.length; k++) items[k].y = Math.max(items[k].y, items[k - 1].y + END_GAP);
    var bottom = chart.chartArea.bottom;
    for (k = items.length - 1; k >= 0; k--) {
      items[k].y = Math.min(items[k].y, k === items.length - 1 ? bottom : items[k + 1].y - END_GAP);
    }
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = END_FONT;
    ctx.textBaseline = 'middle';
    items.forEach(function(it) { ctx.fillStyle = it.color; ctx.fillText(it.text, it.x + 6, it.y); });
    ctx.restore();
  }
};

var measureCtx = null;
function endLabelRoom(datasets) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = END_FONT;
  var widest = 0;
  datasets.forEach(function(ds) { if (ds.endLabel && ds.type !== 'bar') widest = Math.max(widest, measureCtx.measureText(ds.endLabel).width); });
  return widest ? Math.ceil(widest) + 10 : 0;
}

function baseOptions(spec) {
  var tick = themeColor('--text-dim');
  var yFormat = spec.yFormat;
  return {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { right: spec.legend ? 0 : endLabelRoom(spec.datasets) } },
    plugins: {
      legend: { display: !!spec.legend, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: themeColor('--text-secondary'), padding: 10 } },
      datalabels: { display: false },
      title: titleStyle(spec.finding, spec.title), subtitle: subtitleStyle(spec.finding, spec.title),
      tooltip: Object.assign(tooltipStyle(), yFormat ? { callbacks: { label: function(c) { return ' ' + c.dataset.label + ' : ' + yFormat(c.parsed.y); } } } : {})
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tick, font: { size: 11 }, maxRotation: 0, autoSkip: true } },
      y: { beginAtZero: true, grid: { color: themeColor('--chart-grid') }, ticks: { color: tick, font: { size: 11 }, callback: yFormat ? function(v) { return yFormat(v); } : undefined } }
    }
  };
}

function ratio(a, b) {
  return a.map(function(v, i) { return v != null && b[i] ? Math.round(v / b[i] * 10) / 10 : null; });
}

// Les séries d'une catégorie (causes, groupes, tableaux) les plus lourdes l'an dernier.
function topSeries(block, n) {
  return Object.keys(block || {})
    .map(function(k) { var s = block[k]; return { label: k, data: s, last: s[s.length - 1] || 0 }; })
    .filter(function(s) { return s.last > 0; })
    .sort(function(a, b) { return b.last - a.last; })
    .slice(0, n);
}

// L'API ne publie pas l'indice de 2020, année du chômage partiel, le pipeline le recalcule.
// Ce point se dessine en creux, et les segments qui le touchent en pointillé.
function mark2020(i2020, color, radius) {
  if (i2020 < 0) return {};
  var touches = function(c) { return c.p0DataIndex === i2020 || c.p1DataIndex === i2020; };
  return {
    segment: { borderDash: function(c) { return touches(c) ? [3, 3] : undefined; } },
    pointBackgroundColor: function(c) { return c.dataIndex === i2020 ? themeColor('--bg-card') : color; },
    pointRadius: function(c) { return c.dataIndex === i2020 ? 4 : radius; }
  };
}

function chartSpec(kind, viewId, hist, sectors) {
  var years = hist.meta.years;
  var nat = hist.national;
  var cur = sectors[0].h;
  var compared = sectors.filter(function(s) { return s.h; });
  var muted = themeColor('--c-muted');
  var last = years.length - 1;
  var lastYear = years[last];
  var fmt1 = function(v) { return v == null ? 'n/a' : String(v).replace('.', ','); };
  var both = function(a, b) { return a != null && b != null; };

  if (kind === 'if') {
    // Le national remonte à 2005, le secteur à 2015 : un seul axe, le secteur démarre en route.
    var longYears = hist.meta.years_long;
    var pad = longYears.length - years.length;
    var i2020 = longYears.indexOf(2020);
    var ds = [lineDataset('National', nat.if_long, muted, Object.assign({ borderDash: [6, 3] }, mark2020(i2020, muted, 2)))];
    compared.forEach(function(s) {
      var c = cssColor(s.color);
      ds.push(lineDataset(s.code, new Array(pad).fill(null).concat(s.h['if']), c, mark2020(i2020, c, 3)));
    });
    var ifCur = cur['if'][last], ifNat = nat['if'][last];
    return { title: 'Indice de fréquence depuis ' + longYears[0], labels: longYears, datasets: ds, yFormat: fmt1,
      worse: isWorse(ifCur, ifNat) ? ifCur / ifNat : null,
      finding: both(ifCur, ifNat) ? fmt1(ifCur) + (viewId === 'mp' ? ' maladies' : ' accidents') + ' pour 1 000 salariés en ' + lastYear + versus(ifCur, ifNat, fmt1) : null,
      note: i2020 >= 0 ? 'Point de 2020 en creux. Avec le chômage partiel, l\'indice officiel de cette année n\'est pas calculé, il est recalculé ici à partir des sinistres et des salariés.' : null,
      aria: 'Indice de fréquence du secteur de ' + years[0] + ' à ' + lastYear + ', de ' + fmt1(cur['if'][0]) + ' à ' + fmt1(ifCur) + ', et national depuis ' + longYears[0] + '.' };
  }
  if (kind === 'days') {
    var natDays = ratio(nat.j, nat.n);
    var ds2 = [lineDataset('National', natDays, muted, { borderDash: [6, 3], pointRadius: 2 })];
    compared.forEach(function(s) { ds2.push(lineDataset(s.code, ratio(s.h.j, s.h.n), cssColor(s.color))); });
    var d = ratio(cur.j, cur.n);
    return { title: 'Journées d\'arrêt par sinistre depuis ' + years[0], labels: years, datasets: ds2,
      worse: isWorse(d[last], natDays[last]) ? d[last] / natDays[last] : null, yFormat: function(v) { return v == null ? 'n/a' : Math.round(v) + ' j'; },
      finding: both(d[last], natDays[last]) ? Math.round(d[last]) + ' jours d\'arrêt par sinistre en ' + lastYear + versus(d[last], natDays[last], Math.round) : null,
      aria: 'Journées d\'arrêt par sinistre, de ' + fmt1(d[0]) + ' en ' + years[0] + ' à ' + fmt1(d[last]) + ' en ' + lastYear + '.' };
  }
  if (kind === 'severity') {
    // Les décès MP viennent des fiches, depuis 2019 seulement : la courbe suit ce qui est publié.
    var sev = [{ type: 'bar', label: 'Nouvelles IP', data: cur.ip, backgroundColor: cssColor('var(--c-5)'), borderRadius: 3, yAxisID: 'y' }];
    if (cur.dc) sev.push(lineDataset('Décès', cur.dc, themeColor('--danger'), { type: 'line', yAxisID: 'y2', tension: 0 }));
    var firstDc = cur.dc ? cur.dc.findIndex(function(v) { return v != null; }) : -1;
    var ipRate = function(h) { return h.ip[last] != null && h.n[last] ? Math.round(h.ip[last] / h.n[last] * 1000) / 10 : null; };
    var rCur = ipRate(cur), rNat = ipRate(nat);
    return { title: cur.dc ? 'Incapacités permanentes et décès' : 'Nouvelles incapacités permanentes', labels: years, bar: true,
      datasets: sev, yFormat: fmt, legend: !!cur.dc,
      worse: isWorse(rCur, rNat) ? rCur / rNat : null,
      finding: both(rCur, rNat) ? fmt1(rCur) + ' IP pour 100 sinistres en ' + lastYear + versus(rCur, rNat, fmt1) : null,
      note: firstDc > 0 ? 'Décès publiés depuis ' + years[firstDc] + '.' : null,
      aria: 'Nouvelles incapacités permanentes, ' + fmt(cur.ip[last]) + ' en ' + lastYear +
        (cur.dc ? ', et décès, ' + fmt(cur.dc[last]) : '') + '.' };
  }
  if (kind === 'causes' || kind === 'groupes') {
    // Les causes sont des parts, les groupes des nombres de cas : l'écart au national se lit
    // toujours en part des sinistres de la dernière année.
    var share = kind === 'causes';
    var block = share ? cur.causes : cur.groupes;
    var natBlock = (share ? nat.causes : nat.groupes) || {};
    var series = topSeries(block, 5);
    if (!series.length) return null;
    var lastShare = function(v, h) { return v == null ? null : share ? v * 100 : h.n[last] ? v / h.n[last] * 100 : null; };
    series.forEach(function(s) {
      s.pct = lastShare(s.last, cur);
      s.nat = natBlock[s.label] ? lastShare(natBlock[s.label][last], nat) : null;
    });
    var hot = themeColor('--danger');
    var worst = series.filter(function(s) { return isWorse(s.pct, s.nat); })
      .sort(function(a, b) { return (b.pct - b.nat) - (a.pct - a.nat); })[0];
    var noun = share ? 'des sinistres' : 'des maladies';
    var titles = { causes: 'Principales causes, part des sinistres dont la cause est connue', groupes: 'Maladies reconnues par groupe' };
    return { title: titles[kind], labels: years,
      worse: worst ? worst.pct / worst.nat : null,
      datasets: series.map(function(s) {
        return lineDataset(s.label, share ? s.data.map(function(v) { return v == null ? null : Math.round(v * 1000) / 10; }) : s.data,
          isWorse(s.pct, s.nat) ? hot : themeColor('--accent'), { endLabel: short(s.label, 20) });
      }),
      yFormat: share ? function(v) { return pctFr(v, 0); } : fmt,
      finding: worst ? worst.label + ', ' + pctFr(worst.pct, 0) + ' ' + noun + ' en ' + lastYear + ' contre ' + pctFr(worst.nat, 0) + ' au national'
        : (share ? 'Aucune cause' : 'Aucun groupe') + ' nettement au-dessus du national en ' + lastYear,
      aria: titles[kind] + ', en tête ' + series[0].label + '.' };
  }
  return null;
}

function drawTrend(viewId, hist, sectors) {
  var section = viewEl(viewId, 'trendSection');
  var grid = viewEl(viewId, 'trendGrid');
  if (!section || !grid) return;
  var vs = state.views[viewId];
  if (!sectors[0].h) { section.style.display = 'none'; return; }
  section.style.display = '';
  var sub = viewEl(viewId, 'trendSub');
  if (sub) sub.textContent = 'De ' + hist.meta.years[0] + ' à ' + hist.meta.years[hist.meta.years.length - 1] +
    ' pour le secteur. L\'indice national remonte à ' + hist.meta.years_long[0] + ', les chiffres par secteur ne sont pas publiés avant ' + hist.meta.years[0] +
    '. En rouge, ce qui pèse au moins 10 % de plus qu\'au national.';

  var specs = HISTORY_CHARTS[viewId]
    .map(function(k) { var spec = chartSpec(k, viewId, hist, sectors); if (spec) spec.kind = k; return spec; })
    .filter(Boolean);
  grid.innerHTML = specs.map(function(spec) {
    return '<div class="evo-card"><div class="evo-chart-wrap"><canvas></canvas></div>' +
      (spec.note ? '<p class="evo-note">' + spec.note + '</p>' : '') + '</div>';
  }).join('');
  var canvases = grid.querySelectorAll('canvas');
  specs.forEach(function(spec, i) {
    if (spec.worse) noteFinding(canvases[i], { kind: spec.kind, topic: spec.title, text: spec.finding, ratio: spec.worse });
    // Avec un secteur comparé, le constat nomme celui dont il parle.
    if (spec.finding && sectors.filter(function(s) { return s.h; }).length > 1) spec.finding = sectors[0].code + ', ' + spec.finding.charAt(0).toLowerCase() + spec.finding.slice(1);
    var opts = baseOptions(spec);
    if (spec.datasets.some(function(d) { return d.yAxisID === 'y2'; })) {
      opts.scales.y2 = { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: themeColor('--danger-text'), font: { size: 11 }, precision: 0 } };
    }
    describeCanvas(canvases[i], (spec.finding ? spec.finding + '. ' : '') + spec.aria);
    vs.evoCharts.push(new Chart(canvases[i], {
      type: spec.bar ? 'bar' : 'line',
      data: { labels: spec.labels, datasets: spec.datasets },
      options: opts,
      plugins: spec.legend ? [] : [END_LABELS]
    }));
  });
}

// Point d'entrée, appelé à chaque rendu d'une vue sectorielle. sectors[0] est le courant.
export function renderHistory(viewId, sectors) {
  var vs = state.views[viewId];
  vs.evoCharts.forEach(function(c) { c.destroy(); });
  vs.evoCharts = [];
  var token = {};
  vs.historyToken = token;

  Promise.all([load('history-' + viewId), load('fiche-' + viewId)])
    .then(function(files) {
      if (vs.historyToken !== token) return;
      var hist = files[0], fiche = files[1];
      var withData = sectors.map(function(s) {
        return {
          code: s.code, color: s.color,
          h: lookup(hist, s.code),
          dims: expandFiche(fiche, viewId, s.code),
          entry: { libelle: s.entry && s.entry.libelle }
        };
      });
      drawTrend(viewId, hist, withData);
      (VIEW_CONFIG[viewId].lazyPanels || []).forEach(function(id) { renderDimensionPanel(viewId, id, withData); });
    })
    .catch(function(err) {
      if (vs.historyToken !== token) return;
      console.warn('Séries indisponibles :', err.message);
      ['trendSection'].concat((VIEW_CONFIG[viewId].lazyPanels || []).map(function(id) { return PANELS[id].section; }))
        .forEach(function(suffix) { var s = viewEl(viewId, suffix); if (s) s.style.display = 'none'; });
    });
}
