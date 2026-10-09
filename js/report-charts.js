// ── Les graphiques du rapport, aux couleurs Ayming ──
// Le rapport s'écrit en chaîne de caractères : chaque graphique y laisse un <canvas
// data-rp-chart> dont la description attend ici, puis mountReportCharts() les dessine une fois
// le rapport inséré. Le papier est toujours blanc, donc les couleurs sont fixes et ne suivent
// pas le thème de l'app. Les instances vivent sur state.views.compare.reportCharts et sont
// détruites avant chaque nouveau rendu. Chaque partie a sa couleur, lue sur la page (--rp-part) :
// le bleu des accidents, le vert des maladies. Le gris reste la référence, le rouge l'écart.

import { state } from './state.js?v=f8b7846';
import { isWorse } from './findings.js?v=f8b7846';

var AY = {
  blue: '#00AEEF', navy: '#004A76', mid: '#0072B6', teal: '#00B08B', soft: '#84D0F5',
  grey: '#C9D3DB', body: '#4A5B68', muted: '#8E8F9B', grid: '#eef2f6', red: '#DC533A'
};

var specs = {}, next = 0;

export function resetReportCharts() { specs = {}; next = 0; }

// Réserve un emplacement : renvoie le HTML du canvas, la description est gardée pour le montage.
export function chartSlot(spec, heightMm) {
  var id = 'rpc' + (++next);
  specs[id] = spec;
  return '<div class="rp-chart" style="height:' + (heightMm || 45) + 'mm"><canvas data-rp-chart="' + id + '" role="img" aria-label="' + (spec.aria || '') + '"></canvas></div>';
}

export function destroyReportCharts() {
  var v = state.views.compare;
  (v.reportCharts || []).forEach(function(c) { c.destroy(); });
  v.reportCharts = [];
}

function fr(n, digits) { return n == null || isNaN(n) ? '' : n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function fmtValue(fmt, n) {
  if (fmt === 'pct') return fr(n, 0) + ' %';
  if (fmt === 'eur') return n >= 10000 ? fr(n / 1000, 0) + ' k€' : fr(n, 0) + ' €';
  if (fmt === 'int') return fr(n, 0);
  return fr(n, 1);
}

function base() {
  return {
    responsive: true, maintainAspectRatio: false, animation: false, devicePixelRatio: 3,
    layout: { padding: { right: 36, top: 4 } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  };
}
function axis(extra) {
  var a = { grid: { color: AY.grid, drawTicks: false }, border: { display: false },
    ticks: { color: AY.body, font: { family: "'Lato', sans-serif", size: 11 }, padding: 6 } };
  Object.keys(extra || {}).forEach(function(k) { a[k] = extra[k]; });
  return a;
}
function labels(fmt, color) {
  return { anchor: 'end', align: 'end', offset: 4, clamp: true, color: color || AY.navy,
    font: { family: "'Lato', sans-serif", weight: 700, size: 11 }, formatter: function(n) { return fmtValue(fmt, n); } };
}

// La couleur de la partie où le graphique est posé, marine hors partie.
function partOf(canvas) { return getComputedStyle(canvas).getPropertyValue('--rp-part').trim() || AY.navy; }
// La même couleur, éclaircie, pour les barres qui ne sont pas mises en avant.
function paleOf(hex) {
  var n = parseInt(hex.slice(1), 16), mix = function(c) { return Math.round(c + (255 - c) * 0.62); };
  return 'rgb(' + mix(n >> 16) + ',' + mix((n >> 8) & 255) + ',' + mix(n & 255) + ')';
}

// Barres horizontales : la ligne « vous » en bleu Ayming, le secteur dans la couleur de la partie, les repères en gris.
function hbar(canvas, s) {
  var part = partOf(canvas);
  var colors = s.values.map(function(_, i) { return i === s.you ? AY.blue : (s.colors && s.colors[i]) || (i === 1 ? part : AY.grey); });
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: s.labels, datasets: [{ data: s.values, backgroundColor: colors, borderRadius: 6, barThickness: s.thick || 16 }] },
    options: Object.assign(base(), {
      indexAxis: 'y',
      scales: { x: axis({ display: false, beginAtZero: true, grace: '12%' }), y: axis({ grid: { display: false }, ticks: { autoSkip: false, color: AY.body, font: { family: "'Lato', sans-serif", size: 11 }, padding: 6 } }) },
      plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: labels(s.fmt) }
    }),
    plugins: [ChartDataLabels]
  });
}

// Barres verticales, une barre mise en avant (la tranche de l'entreprise, un seuil de coût).
function vbar(canvas, s) {
  var part = partOf(canvas);
  var colors = s.values.map(function(_, i) { return i === s.you ? part : paleOf(part); });
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: s.labels, datasets: [{ data: s.values, backgroundColor: colors, borderRadius: 6, maxBarThickness: 34 }] },
    options: Object.assign(base(), {
      layout: { padding: { top: 18 } },
      scales: { x: axis({ grid: { display: false } }), y: axis({ display: false, beginAtZero: true, grace: '10%' }) },
      plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: labels(s.fmt) }
    }),
    plugins: [ChartDataLabels]
  });
}

// ── Les graphiques repris de l'outil ──
// Chaque courbe écrit son nom au bout de son dernier point, à la place d'une légende, comme la
// tendance de l'outil (js/history.js). Deux noms trop proches sont écartés, puis ramenés dans le cadre.
var END_FONT = '700 10px Lato, sans-serif', END_GAP = 12;
var END_LABELS = {
  id: 'rpEndLabels',
  afterDatasetsDraw: function(chart) {
    var items = [];
    chart.data.datasets.forEach(function(ds, i) {
      if (!ds.endLabel || ds.type === 'bar') return;
      var meta = chart.getDatasetMeta(i);
      for (var j = ds.data.length - 1; j >= 0; j--) {
        if (ds.data[j] != null) { items.push({ text: ds.endLabel, color: ds.borderColor, x: meta.data[j].x, y: meta.data[j].y }); break; }
      }
    });
    items.sort(function(a, b) { return a.y - b.y; });
    for (var k = 1; k < items.length; k++) items[k].y = Math.max(items[k].y, items[k - 1].y + END_GAP);
    for (k = items.length - 1; k >= 0; k--) items[k].y = Math.min(items[k].y, k === items.length - 1 ? chart.chartArea.bottom : items[k + 1].y - END_GAP);
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = END_FONT;
    ctx.textBaseline = 'middle';
    items.forEach(function(it) { ctx.fillStyle = it.color; ctx.fillText(it.text, it.x + 5, it.y); });
    ctx.restore();
  }
};
// Une année sur trois, la dernière comprise : 2015, 2018, 2021, 2024.
function yearTicks() {
  return { color: AY.muted, font: { size: 9 }, maxRotation: 0, autoSkip: false,
    callback: function(v, i, all) { return (all.length - 1 - i) % 3 === 0 ? this.getLabelForValue(v) : ''; } };
}
function endRoom(series) {
  var ctx = document.createElement('canvas').getContext('2d');
  ctx.font = END_FONT;
  return Math.ceil(series.reduce(function(w, s) { return Math.max(w, ctx.measureText(s.label).width); }, 0)) + 10;
}
// Dix ans du secteur, le national en tirets gris. series : [{ label, data, tone }], tone vaut
// 'part' (la couleur de la partie), 'nat' (la référence) ou 'worse' (au-dessus du national).
function decade(canvas, s) {
  var part = partOf(canvas);
  var tone = { part: part, nat: AY.muted, worse: AY.red };
  return new Chart(canvas, {
    type: 'line',
    data: { labels: s.years, datasets: s.series.map(function(ser) {
      return { label: ser.label, endLabel: ser.label, data: ser.data, borderColor: tone[ser.tone], backgroundColor: tone[ser.tone],
        borderWidth: ser.tone === 'nat' ? 1.8 : 2.2, borderDash: ser.tone === 'nat' ? [5, 3] : [], pointRadius: ser.tone === 'nat' ? 1.5 : 2.2, tension: 0.3, spanGaps: true };
    }) },
    options: Object.assign(base(), {
      layout: { padding: { right: endRoom(s.series), top: 6 } },
      scales: { x: axis({ grid: { display: false }, ticks: yearTicks() }),
        y: axis({ beginAtZero: true, ticks: { color: AY.muted, font: { size: 9 }, maxTicksLimit: 5, callback: function(n) { return fmtValue(s.fmt, n) + (s.unit || ''); } } }) },
      plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } }
    }),
    plugins: [END_LABELS]
  });
}
// Les incapacités permanentes en barres, les décès en ligne rouge sur un second axe.
function ipdc(canvas, s) {
  var sets = [{ type: 'bar', label: 'Nouvelles IP', data: s.ip, backgroundColor: paleOf(partOf(canvas)), borderRadius: 3, yAxisID: 'y', order: 2 }];
  if (s.dc) sets.push({ type: 'line', label: 'Décès', data: s.dc, borderColor: AY.red, backgroundColor: AY.red, borderWidth: 2, pointRadius: 2.2, tension: 0, spanGaps: true, yAxisID: 'y2', order: 1 });
  var tick = { color: AY.muted, font: { size: 9 }, maxTicksLimit: 5, precision: 0 };
  return new Chart(canvas, {
    data: { labels: s.years, datasets: sets },
    options: Object.assign(base(), {
      layout: { padding: { right: 4, top: 6 } },
      scales: { x: axis({ grid: { display: false }, ticks: yearTicks() }),
        y: axis({ beginAtZero: true, ticks: tick }),
        y2: { display: !!s.dc, position: 'right', beginAtZero: true, grid: { display: false }, border: { display: false }, ticks: { color: AY.red, font: { size: 9 }, maxTicksLimit: 4, precision: 0 } } },
      plugins: { tooltip: { enabled: false }, datalabels: { display: false },
        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, color: AY.body, font: { family: "'Lato', sans-serif", size: 10 } } } }
    })
  });
}
// La sinistralité par taille d'établissement, comme dans l'outil : la part des accidents et la
// part des salariés de chaque tranche, l'indice de fréquence de la tranche en ligne.
function size(canvas, s) {
  var part = partOf(canvas);
  var sets = [
    { type: 'bar', label: 'Part des accidents', data: s.acc, backgroundColor: part, borderRadius: 3, yAxisID: 'y', order: 3 },
    { type: 'bar', label: 'Part des salariés', data: s.sal, backgroundColor: AY.grey, borderRadius: 3, yAxisID: 'y', order: 3 },
    { type: 'line', label: 'Fréquence de la tranche', data: s.ifs, borderColor: AY.navy, backgroundColor: AY.navy, borderWidth: 2, pointRadius: 2.5, tension: 0.25, spanGaps: true, yAxisID: 'y1', order: 1 }
  ];
  return new Chart(canvas, {
    data: { labels: s.labels, datasets: sets },
    options: Object.assign(base(), {
      layout: { padding: { right: 4, top: 4 } },
      scales: { x: axis({ grid: { display: false }, ticks: { color: AY.body, font: { size: 10 } } }),
        y: axis({ beginAtZero: true, ticks: { color: AY.muted, font: { size: 9 }, maxTicksLimit: 5, callback: function(n) { return n + ' %'; } } }),
        y1: { position: 'right', beginAtZero: true, grid: { display: false }, border: { display: false }, ticks: { color: AY.navy, font: { size: 9 }, maxTicksLimit: 5 } } },
      plugins: { tooltip: { enabled: false }, datalabels: { display: false },
        legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: AY.body, font: { family: "'Lato', sans-serif", size: 10 } } } }
    })
  });
}

// Deux barres par ligne, le secteur en marine et le national en gris, pour lire l'écart ligne à ligne.
function pairs(canvas, s) {
  var dl = labels(s.fmt);
  dl.font.size = 10;
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: s.labels, datasets: [
      { label: 'Votre secteur', data: s.values, backgroundColor: AY.navy, borderRadius: 4, barThickness: 9 },
      { label: 'Moyenne nationale', data: s.nat, backgroundColor: AY.grey, borderRadius: 4, barThickness: 9 }
    ] },
    options: Object.assign(base(), {
      indexAxis: 'y',
      scales: { x: axis({ display: false, beginAtZero: true, grace: '14%' }), y: axis({ grid: { display: false }, ticks: { autoSkip: false, color: AY.body, font: { family: "'Lato', sans-serif", size: 10 }, padding: 6 }, afterFit: function(sc) { sc.width = 140; } }) },
      plugins: { tooltip: { enabled: false }, datalabels: dl,
        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, color: AY.body, font: { family: "'Lato', sans-serif", size: 11 } } } }
    }),
    plugins: [ChartDataLabels]
  });
}

// Le format des graphiques de l'app, sur papier : la référence (national, ou votre entreprise
// quand elle a son chiffre) en barre pâle derrière chaque barre, ou en trait pour les journées.
// Rouge seulement là où isWorse le dit, la barre de l'entreprise (mark) en bleu Ayming. Pas
// d'infobulle sur papier, la valeur s'écrit au bout de la barre.
var PALE = '#E3E9EF', INK = '#1F2A33';
function refColors(s, part) {
  return s.values.map(function(v, i) {
    return i === s.mark ? AY.blue : (s.ref && isWorse(v, s.ref[i])) ? AY.red : part;
  });
}
// La colonne des libellés : 150 px dans une demi-largeur, plus large pour un graphique en pleine
// largeur, dont les libellés tiennent alors sur une ligne.
function yLabels(w) {
  return axis({ grid: { display: false }, ticks: { autoSkip: false, color: AY.body, font: { family: "'Lato', sans-serif", size: 10 }, padding: 6 },
    afterFit: function(sc) { sc.width = w || 150; } });
}
function share(canvas, s) {
  var dl = labels(s.fmt || 'pct');
  dl.font.size = 10;
  // Une épaisseur fixe, la même dans tous les graphiques de répartition du rapport.
  // 'fill' : des barres épaisses qui remplissent le cadre, comme le sexe dans l'outil.
  var t = s.thick || 9, fill = t === 'fill';
  var size = function(k, pct) { return fill ? { barPercentage: pct, categoryPercentage: 1 } : { barThickness: Math.round(t * k) }; };
  var sets = [Object.assign({ data: s.values, backgroundColor: refColors(s, partOf(canvas)), borderRadius: 3, grouped: false, order: 1, datalabels: dl }, size(1, 0.5))];
  if (s.ref) sets.push(Object.assign({ data: s.ref, backgroundColor: PALE, borderRadius: 3, grouped: false, order: 2, datalabels: { display: false } }, size(1.7, 0.8)));
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: s.labels, datasets: sets },
    options: Object.assign(base(), {
      indexAxis: 'y',
      scales: { x: axis({ display: false, beginAtZero: true, grace: '16%' }), y: yLabels(s.labelW) },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }),
    plugins: [ChartDataLabels]
  });
}
function days(canvas, s) {
  var dl = labels('int');
  dl.font.size = 10;
  dl.formatter = function(n) { return fr(n, 0) + ' j'; };
  var sets = [{ data: s.values, backgroundColor: refColors(s, partOf(canvas)), borderRadius: 3, order: 1, barThickness: 9, datalabels: dl }];
  if (s.ref) sets.push({ type: 'line', showLine: false, order: 0, datalabels: { display: false },
    data: s.ref.map(function(r, i) { return r == null ? null : { x: r, y: s.labels[i] }; }),
    pointStyle: 'line', rotation: 90, pointRadius: 8, borderWidth: 2.5, pointBorderColor: INK, borderColor: INK, backgroundColor: INK });
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: s.labels, datasets: sets },
    options: Object.assign(base(), {
      indexAxis: 'y',
      scales: { x: axis({ display: false, beginAtZero: true, grace: '16%' }), y: yLabels(s.labelW) },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }),
    plugins: [ChartDataLabels]
  });
}

var DRAW = { hbar: hbar, vbar: vbar, pairs: pairs, share: share, days: days, decade: decade, ipdc: ipdc, size: size };

export function mountReportCharts(root) {
  destroyReportCharts();
  if (typeof Chart === 'undefined') return;
  var list = state.views.compare.reportCharts;
  root.querySelectorAll('canvas[data-rp-chart]').forEach(function(canvas) {
    var s = specs[canvas.getAttribute('data-rp-chart')];
    if (s && DRAW[s.type]) list.push(DRAW[s.type](canvas, s));
  });
  dropFillers(root);
}

// Une ressource ne fait que remplir la place libre : on la retire de toute page qu'elle
// ferait dépasser de l'A4, le pied de page compris.
function dropFillers(root) {
  var a4 = 297 * 96 / 25.4;
  root.querySelectorAll('#diag-report .rp-page').forEach(function(pg) {
    var fillers = pg.querySelectorAll('.rp-filler');
    for (var i = fillers.length - 1; i >= 0 && pg.offsetHeight > a4 + 1; i--) fillers[i].remove();
  });
}
