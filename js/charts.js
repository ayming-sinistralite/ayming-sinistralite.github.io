// ── Chart rendering ──

import { fmt, pctFr, themeColor, CAUSE_COLORS, el, viewEl } from './utils.js';
import { state, VIEW_CONFIG } from './state.js';
import { getData, getStore } from './data.js';
import { selectCode } from './search.js';
import { SECTOR_COLORS } from './compare.js';

// ── Accessibilité : alternative textuelle des canvas de graphique ──
// Un <canvas> est opaque aux lecteurs d'écran, on lui donne un rôle et une phrase de résumé.
function describeCanvas(canvas, label) {
  if (!canvas) return;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
}

// Nombre à la française (virgule décimale), cohérent avec fmtCompact.
function ariaNum(n, digits) {
  if (n === null || n === undefined || isNaN(n)) return 'n/a';
  return n.toFixed(digits === undefined ? 1 : digits).replace('.', ',');
}

// Première et dernière valeur non nulles d'une série (pour décrire une évolution).
function firstDefined(arr) {
  for (var i = 0; i < arr.length; i++) { if (arr[i] !== null && arr[i] !== undefined) return arr[i]; }
  return null;
}
function lastDefined(arr) {
  for (var i = arr.length - 1; i >= 0; i--) { if (arr[i] !== null && arr[i] !== undefined) return arr[i]; }
  return null;
}

// ── Causes chart ──
function buildCausesChart(canvas, causes, viewId) {
  var sorted = Object.entries(causes || {})
    .filter(function(pair) { return pair[1] > 0; })
    .sort(function(a, b) { return b[1] - a[1]; });

  var chartData;
  // AT has 12 cause columns: cap at 6 + Autres. MP has few categories: show all.
  if (viewId === 'at' && sorted.length > 6) {
    var top = sorted.slice(0, 6);
    var rest = sorted.slice(6).reduce(function(sum, pair) { return sum + pair[1]; }, 0);
    chartData = top.concat([['Autres', rest]]);
  } else {
    chartData = sorted;
  }

  if (chartData.length === 0) return null;

  var labels = chartData.map(function(pair) { return pair[0]; });
  var values = chartData.map(function(pair) { return pair[1]; });

  var causesCode = state.views[viewId] && state.views[viewId].code;
  describeCanvas(canvas, 'Répartition des causes d\'accidents' +
    (causesCode ? ' pour le secteur ' + causesCode : '') +
    ', principale cause ' + labels[0].toLowerCase() + ' à ' + Math.round(values[0]) + ' pour cent.');

  // Les caractères des MP ne s'excluent pas, un cancer d'origine chimique compte à la fois
  // en « Risque chimique » et en « Cancers professionnels ». Leur somme dépasse donc 100 %
  // (jusqu'à 175 % sur 105 secteurs), et un anneau les afficherait comme des parts d'un tout
  // en les renormalisant en silence. Des barres disent ce que la donnée dit vraiment, la part
  // des MP du secteur qui portent ce caractère.
  if (VIEW_CONFIG[viewId].causesExclusive === false) {
    return buildInjuryChart(canvas, null, chartData.map(function(pair) {
      return { label: pair[0], value: pair[1], pct: Math.round(pair[1] * 10) / 10 };
    }), CAUSE_COLORS[0]);
  }

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: CAUSE_COLORS.slice(0, values.length),
        borderColor: themeColor('--bg-elevated'),
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'left',
          align: 'center',
          labels: {
            padding: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11, family: "'Lato', sans-serif" },
            color: '#8b949e',
            generateLabels: function(chart) {
              var d = chart.data;
              return d.labels.map(function(label, i) {
                return {
                  text: label,
                  fillStyle: d.datasets[0].backgroundColor[i],
                  fontColor: themeColor('--text-secondary'),
                  strokeStyle: 'transparent',
                  pointStyle: 'circle',
                  index: i,
                  hidden: !chart.getDataVisibility(i),
                };
              });
            }
          }
        },
        tooltip: {
          backgroundColor: themeColor('--chart-tooltip-bg'),
          borderColor: themeColor('--border'),
          borderWidth: 1,
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
          titleColor: themeColor('--text'),
          bodyColor: themeColor('--text-secondary'),
          callbacks: { label: function(ctx) { return ' ' + ctx.label + ': ' + ctx.parsed.toFixed(1) + '%'; } }
        },
        datalabels: {
          color: '#fff',
          font: { size: 12, weight: '600', family: "'Lato', sans-serif" },
          formatter: function(value) {
            return value >= 3 ? Math.round(value) + '%' : '';
          },
          anchor: 'center',
          align: 'center',
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

export function renderCausesChart(viewId, sectors) {
  var vs = state.views[viewId];
  if (vs.causesChart) { vs.causesChart.destroy(); vs.causesChart = null; }
  if (vs.causesCharts) vs.causesCharts.forEach(function(c) { c.destroy(); });
  vs.causesCharts = [];
  var wrap = viewEl(viewId, 'causesWrap');
  if (!wrap) return;

  if (sectors.length < 2) {
    wrap.classList.remove('cmp-cols', 'cmp-cols-1', 'cmp-cols-2');
    wrap.style.height = '320px';
    wrap.innerHTML = '<canvas id="' + viewId + '-causesChart"></canvas>';
    var ch = buildCausesChart(el(viewId + '-causesChart'), sectors[0].entry && sectors[0].entry.risk_causes, viewId);
    if (ch) vs.causesCharts.push(ch);
    else wrap.innerHTML = '<div class="cmp-nodata" style="height:320px;display:flex;align-items:center;justify-content:center">Aucune donnée de cause</div>';
    return;
  }
  wrap.style.height = 'auto';
  buildCompareColumns(wrap, sectors, function(sec, idx, body) {
    body.innerHTML = '<div class="chart-wrap" style="height:300px"><canvas></canvas></div>';
    var c = buildCausesChart(body.querySelector('canvas'), sec.entry && sec.entry.risk_causes, viewId);
    if (c) vs.causesCharts.push(c);
    else body.innerHTML = '<p class="cmp-nodata">Aucune donnée de cause.</p>';
  });
}

// ── Funnel chart ──
function buildFunnel(container, items, viewId, uid) {
  var maxVal = items[items.length - 1].value || 1;
  var n = items.length;

  // Build bars with conversion rates between them
  var html = '';
  for (var i = 0; i < n; i++) {
    var d = items[i];
    var pct = Math.round(((i + 1) / n) * 100);
    var ofTotal = (d.value / maxVal * 100).toFixed(1);
    html += '<div class="funnel-bar" style="width:' + pct + '%;background:' + d.color + '" data-idx="' + i + '" data-pct="' + ofTotal + '">' +
      '<span class="funnel-bar-label">' + d.label + '</span>' +
      '<span class="funnel-bar-value">' + fmt(d.value) + '</span>' +
      '</div>';
    // Insert conversion rate between consecutive tiers. Le taux peut dépasser 100 % côté MP
    // (19 secteurs), parce qu'une IP notifiée cette année peut porter sur une maladie
    // reconnue une année précédente, et qu'une maladie peut en produire plusieurs. Dire
    // « 300 % donnent lieu à » serait faux, on énonce alors les deux comptes.
    if (i < n - 1) {
      var next = items[i + 1];
      var nextVal = next.value || 0;
      var rate = nextVal > 0 ? d.value / nextVal * 100 : 0;
      html += '<div class="funnel-rate">' + (rate > 100
        ? fmt(d.value) + ' ' + d.label.toLowerCase() + ' pour ' + fmt(nextVal) + ' ' + next.label
        : pctFr(rate) + ' donnent lieu à ' + d.label.toLowerCase()) + '</div>';
    }
  }

  var tipId = viewId + '-funnelTip' + uid;
  container.style.position = 'relative';
  container.innerHTML = '<div class="funnel">' + html + '</div><div class="funnel-tooltip" id="' + tipId + '"></div>';

  var tip = el(tipId);
  var eventLabel = VIEW_CONFIG[viewId].eventLabel;
  container.querySelectorAll('.funnel-bar').forEach(function(bar) {
    var i = +bar.dataset.idx;
    var pctText = i === items.length - 1 ? '100% des ' + eventLabel : bar.dataset.pct + '% des ' + eventLabel;
    bar.addEventListener('mouseenter', function() {
      tip.innerHTML = pctText;
      tip.classList.add('visible');
    });
    bar.addEventListener('mousemove', function(e) {
      var rect = container.getBoundingClientRect();
      tip.style.left = (e.clientX - rect.left + 12) + 'px';
      tip.style.top = (e.clientY - rect.top - 32) + 'px';
    });
    bar.addEventListener('mouseleave', function() { tip.classList.remove('visible'); });
  });
}

export function renderFunnelChart(viewId, sectors, cfg) {
  var wrap = viewEl(viewId, 'funnelWrap');
  if (!wrap) return;

  if (sectors.length < 2) {
    wrap.classList.remove('cmp-cols', 'cmp-cols-1', 'cmp-cols-2');
    buildFunnel(wrap, cfg.funnelItems(sectors[0].entry.stats), viewId, '');
    return;
  }
  buildCompareColumns(wrap, sectors, function(sec, idx, body) {
    if (!sec.entry) { body.innerHTML = '<p class="cmp-nodata">Données indisponibles.</p>'; return; }
    buildFunnel(body, cfg.funnelItems(sec.entry.stats), viewId, idx);
  });
}

// ── Position strip ──
export function renderPositionStrip(viewId, code, level, ifValue, renderFn, compareCodes) {
  compareCodes = compareCodes || [];
  var store = getStore(viewId, level);
  var data = getData(viewId);
  // Inclure les secteurs réels à 0 accident (IF=0 mesuré = secteur le plus sûr).
  // On exclut seulement les secteurs sans salariés (IF indéfini, 0/0).
  var allIF = Object.entries(store)
    .map(function(pair) { return { code: pair[0], libelle: pair[1].libelle, if_val: pair[1].stats.indice_frequence, nb_salaries: pair[1].stats.nb_salaries }; })
    .filter(function(d) { return d.nb_salaries > 0; })
    .sort(function(a, b) { return a.if_val - b.if_val; });

  if (allIF.length === 0) return;
  var maxIF = allIF[allIF.length - 1].if_val;
  var levelLabel = level === 'naf5' ? 'NAF' : level === 'naf4' ? 'NAF4' : 'NAF2';
  viewEl(viewId, 'posTitle').textContent =
    'Positionnement IF // ' + allIF.length + ' codes ' + levelLabel;

  var strip = viewEl(viewId, 'posStrip');
  var tipId = viewId + '-posTip';
  var html = '<div class="pos-track"></div><div class="pos-tip" id="' + tipId + '"></div>';

  allIF.forEach(function(d, i) {
    var x = (d.if_val / maxIF * 96) + 2;
    var isCurrent = d.code === code;
    var isCompared = !isCurrent && compareCodes.indexOf(d.code) !== -1;
    var dotCls = 'pos-dot' + (isCurrent ? ' current' : isCompared ? ' compared' : '');
    var dotStyle = 'left:' + x + '%';
    if (isCompared) {
      // Même couleur que les pastilles / segments KPI / courbes pour ce secteur.
      dotStyle += ';background:' + SECTOR_COLORS[compareCodes.indexOf(d.code) % SECTOR_COLORS.length];
    }
    html += '<div class="' + dotCls + '" style="' + dotStyle + '" data-idx="' + i + '"></div>';
    if (isCurrent) {
      html += '<div class="pos-marker-label" style="left:' + x + '%">IF ' + ifValue.toFixed(1) + '</div>';
    }
  });

  var natIF = data.meta.national.indice_frequence;
  var natX = (natIF / maxIF * 96) + 2;
  html += '<div class="pos-national" style="left:' + natX + '%"></div>';
  html += '<div class="pos-national-label" style="left:' + natX + '%">Moy. ' + natIF.toFixed(1) + '</div>';

  var minIF = allIF[0].if_val;
  html += '<div class="pos-axis" style="left:2%">' + minIF.toFixed(0) + '</div>';
  html += '<div class="pos-axis pos-end">' + maxIF.toFixed(0) + '</div>';

  strip.innerHTML = html;

  var tip = el(tipId);
  strip.querySelectorAll('.pos-dot:not(.current)').forEach(function(dot) {
    var d = allIF[+dot.dataset.idx];
    dot.addEventListener('mouseenter', function() {
      var short = d.libelle.length > 30 ? d.libelle.substring(0, 30) + '...' : d.libelle;
      tip.textContent = d.code + '  ' + short + '  IF ' + d.if_val.toFixed(1);
      tip.style.left = dot.style.left;
      tip.classList.add('visible');
    });
    dot.addEventListener('mouseleave', function() { tip.classList.remove('visible'); });
    dot.addEventListener('click', function() {
      tip.classList.remove('visible');
      selectCode(viewId, d.code, level, renderFn);
    });
  });
}

// ── Comparison chart ──
export function renderComparisonChart(viewId, code, level, renderFn, compareCodes) {
  compareCodes = compareCodes || [];
  var data = getData(viewId);
  var items = [];
  var naf5Store = getStore(viewId, 'naf5');
  var clickLevel = level;
  var selectedMode = compareCodes.length > 0 && level === 'naf5';

  if (selectedMode) {
    items = [code].concat(compareCodes)
      .map(function(c) {
        var e = naf5Store[c];
        return e ? { code: c, libelle: e.libelle, if_val: e.stats.indice_frequence } : null;
      })
      .filter(Boolean);
    clickLevel = 'naf5';
    viewEl(viewId, 'compTitle').textContent = 'Comparaison // secteurs sélectionnés';
  } else if (level === 'naf5') {
    var naf2 = code.substring(0, 2);
    items = Object.entries(naf5Store)
      .filter(function(pair) { return pair[0].substring(0, 2) === naf2; })
      .map(function(pair) { return { code: pair[0], libelle: pair[1].libelle, if_val: pair[1].stats.indice_frequence }; });
    viewEl(viewId, 'compTitle').textContent = 'Comparaison // division ' + naf2;
  } else if (level === 'naf4') {
    items = Object.entries(naf5Store)
      .filter(function(pair) { return pair[0].substring(0, 4) === code; })
      .map(function(pair) { return { code: pair[0], libelle: pair[1].libelle, if_val: pair[1].stats.indice_frequence }; });
    clickLevel = 'naf5';
    viewEl(viewId, 'compTitle').textContent = 'Comparaison // sous-classes ' + code;
  } else {
    var naf2Store = getStore(viewId, 'naf2');
    items = Object.entries(naf2Store)
      .map(function(pair) { return { code: pair[0], libelle: pair[1].libelle, if_val: pair[1].stats.indice_frequence }; });
    viewEl(viewId, 'compTitle').textContent = 'Comparaison // toutes divisions';
  }

  // En mode "secteurs sélectionnés", on conserve l'ordre (courant en premier).
  if (!selectedMode) items.sort(function(a, b) { return b.if_val - a.if_val; });

  var labels = items.map(function(s) { return s.code; });
  var values = items.map(function(s) { return s.if_val; });
  var allAccent = (level === 'naf4');
  var inactiveColor = themeColor('--border');
  var inactiveBorder = themeColor('--border-light');
  var accentColor = themeColor('--accent');
  var colors, borderColors;
  if (selectedMode) {
    colors = items.map(function(s) {
      if (s.code === code) return accentColor;
      var ci = compareCodes.indexOf(s.code);
      return SECTOR_COLORS[ci % SECTOR_COLORS.length];
    });
    borderColors = colors;
  } else {
    colors = items.map(function(s) { return (allAccent || s.code === code) ? accentColor : inactiveColor; });
    borderColors = items.map(function(s) { return (allAccent || s.code === code) ? accentColor : inactiveBorder; });
  }

  var canvas = viewEl(viewId, 'compChart');
  canvas.style.cursor = 'pointer';

  var curItem = items.filter(function(s) { return s.code === code; })[0];
  var compNatIF = data.meta.national.indice_frequence;
  describeCanvas(canvas, 'Comparaison de l\'indice de fréquence, ' +
    (curItem ? code + ' à ' + ariaNum(curItem.if_val) : code) +
    ' contre ' + ariaNum(compNatIF) + ' au niveau national.');

  var vs = state.views[viewId];
  if (vs.compChart) vs.compChart.destroy();
  vs.compChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: { topLeft: 2, topRight: 2 },
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: function(evt, elements) {
        if (elements.length > 0) {
          var idx = elements[0].index;
          var target = items[idx];
          if (target && target.code !== code) {
            selectCode(viewId, target.code, clickLevel, renderFn);
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: themeColor('--chart-tooltip-bg'),
          borderColor: themeColor('--border'),
          borderWidth: 1,
          titleColor: themeColor('--text'),
          bodyColor: themeColor('--text-secondary'),
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
          callbacks: {
            title: function(ctx) {
              var i = ctx[0].dataIndex;
              return items[i].code + '  ' + items[i].libelle;
            },
            label: function(ctx) { return ' IF: ' + ctx.parsed.y.toFixed(1); }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "'JetBrains Mono', monospace", size: 10 } },
          grid: { color: themeColor('--chart-grid') }
        },
        x: {
          grid: { display: false },
          title: {
            display: true,
            text: 'Indice de fréquence',
            font: { family: "'JetBrains Mono', monospace", size: 10, weight: '500' },
            color: themeColor('--text-dim')
          },
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            maxRotation: 90,
            minRotation: 45
          }
        }
      }
    }
  });
  viewEl(viewId, 'compWrap').style.height = '320px';

  // Render companion table
  var cfg = VIEW_CONFIG[viewId];
  var eventKey = cfg.eventKey;
  var tableRows = items.map(function(item, idx) {
    var store = getStore(viewId, clickLevel === 'naf5' ? 'naf5' : level);
    var entry = store[item.code];
    var events = entry ? (entry.stats[eventKey] || 0) : 0;
    var isActive = item.code === code ? ' class="active-row"' : '';
    return '<tr' + isActive + ' data-code="' + item.code + '" data-level="' + clickLevel + '">' +
      '<td class="rank">' + (idx + 1) + '</td>' +
      '<td class="code">' + item.code + '</td>' +
      '<td>' + item.libelle + '</td>' +
      '<td class="if-val">' + item.if_val.toFixed(1) + '</td>' +
      '<td>' + fmt(events) + '</td>' +
      '</tr>';
  }).join('');
  var tableWrap = viewEl(viewId, 'compTable');
  tableWrap.innerHTML = '<table class="comp-table"><thead><tr>' +
    '<th>#</th><th>Code</th><th>Libellé</th><th>IF</th><th>' + cfg.eventLabel + '</th>' +
    '</tr></thead><tbody>' + tableRows + '</tbody></table>';
  tableWrap.querySelectorAll('tr[data-code]').forEach(function(row) {
    row.addEventListener('click', function() {
      var c = this.dataset.code;
      var l = this.dataset.level;
      if (c !== code) selectCode(viewId, c, l, renderFn);
    });
  });
}

export function setupCompToggle(viewId) {
  var toggle = viewEl(viewId, 'compToggle');
  if (!toggle) return;
  toggle.querySelectorAll('button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      toggle.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var mode = btn.dataset.mode;
      var chartWrap = viewEl(viewId, 'compWrap');
      var tableWrap = viewEl(viewId, 'compTable');
      if (mode === 'table') {
        chartWrap.style.display = 'none';
        tableWrap.classList.add('visible');
      } else {
        chartWrap.style.display = '';
        tableWrap.classList.remove('visible');
      }
    });
  });
}

// ── Evolution charts ──
export function renderEvolutionCharts(viewId, entry, level, compareCodes) {
  compareCodes = compareCodes || [];
  var data = getData(viewId);
  var years = data.meta.years;
  var sec = viewEl(viewId, 'evoSection');
  if (!years || years.length < 2 || !entry.yearly) {
    sec.style.display = 'none';
    return;
  }
  sec.style.display = '';
  var vs = state.views[viewId];
  vs.evoCharts.forEach(function(c) { c.destroy(); });
  vs.evoCharts = [];

  var cfg = VIEW_CONFIG[viewId];
  var eventKey = cfg.eventKey;
  var eventLabel = cfg.eventLabel;
  var natYearly = data.meta.national.yearly;
  // Libellé de la ligne du secteur courant : son code (cohérent avec les secteurs comparés).
  var currentLabel = state.views[viewId].code || 'Secteur';

  // Prepare data arrays
  var sectorEvents = [], sectorIF = [], sectorTG = [];
  var natIF = [], natTG = [];
  years.forEach(function(yr) {
    var y = entry.yearly[yr];
    var n = natYearly[yr];
    sectorEvents.push(y ? y.events : null);
    sectorIF.push(y ? y.indice_frequence : null);
    sectorTG.push(y ? y.taux_gravite : null);
    natIF.push(n ? n.indice_frequence : null);
    natTG.push(n ? n.taux_gravite : null);
  });

  // Common chart options
  var baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11, family: 'var(--sans)' }, color: themeColor('--text-secondary'), padding: 12 } },
      tooltip: { backgroundColor: themeColor('--chart-tooltip-bg'), borderColor: themeColor('--border'), borderWidth: 1, titleColor: themeColor('--text'), bodyColor: themeColor('--text-secondary'), titleFont: { family: 'var(--sans)', size: 12 }, bodyFont: { family: 'var(--mono)', size: 12 }, cornerRadius: 6, padding: 10 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'var(--mono)', size: 12, weight: '600' }, color: themeColor('--chart-label') } },
      y: { beginAtZero: true, grid: { color: themeColor('--chart-grid') }, ticks: { font: { family: 'var(--mono)', size: 11 }, color: themeColor('--text-dim') } },
    },
  };

  function deltaPlugin(vals) {
    return {
      id: 'deltaLabel',
      afterDraw: function(chart) {
        if (!vals || vals.length < 2) return;
        var first = vals[0], last = vals[vals.length - 1];
        if (first == null || last == null || first === 0) return;
        var pct = ((last - first) / first * 100).toFixed(1);
        var sign = pct > 0 ? '+' : '';
        var color = pct > 0 ? '#ef4444' : pct < 0 ? '#22c55e' : '#64748b';
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = '600 12px var(--mono)';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(sign + pct + '%', chart.chartArea.right, chart.chartArea.top - 6);
        ctx.restore();
      }
    };
  }

  // Generate gradient colors for N bars
  function barColors(r, g, b, n) {
    var bgs = [], borders = [];
    for (var i = 0; i < n; i++) {
      var a = 0.3 + (i / Math.max(n - 1, 1)) * 0.5;
      bgs.push('rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(2) + ')');
      borders.push('rgba(' + r + ',' + g + ',' + b + ',1)');
    }
    return { bg: bgs, border: borders };
  }
  var nYears = years.length;
  var evColors = barColors(99, 102, 241, nYears);
  var ifColors = barColors(234, 179, 8, nYears);

  // 1. Events chart (line). En comparaison (NAF5) : superposition des secteurs comparés,
  // SANS ligne nationale (les comptes absolus ne se comparent pas au total national).
  var evCanvas = viewEl(viewId, 'evoEvents');
  var comparingEvo = compareCodes.length && level === 'naf5';
  var evCurColor = compareCodes.length ? themeColor('--accent') : '#6366f1';
  var evDatasets = [{
    label: compareCodes.length ? currentLabel : eventLabel, data: sectorEvents,
    borderColor: evCurColor, borderWidth: 2,
    pointRadius: 5, pointBackgroundColor: evCurColor, pointHoverRadius: 7,
    fill: !compareCodes.length, backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.3,
  }];
  if (comparingEvo) {
    var naf5StoreEv = getStore(viewId, 'naf5');
    compareCodes.forEach(function(cc, i) {
      var ce = naf5StoreEv[cc];
      if (!ce || !ce.yearly) return;
      var color = SECTOR_COLORS[i % SECTOR_COLORS.length];
      evDatasets.push({
        label: cc,
        data: years.map(function(yr) { return ce.yearly[yr] ? ce.yearly[yr].events : null; }),
        borderColor: color, backgroundColor: color, borderWidth: 2,
        pointRadius: 4, pointBackgroundColor: color, pointHoverRadius: 6,
        fill: false, tension: 0.3, spanGaps: true,
      });
    });
  }
  describeCanvas(evCanvas, 'Évolution de ' + eventLabel + ' de ' + years[0] + ' à ' + years[years.length - 1] +
    ', de ' + fmt(firstDefined(sectorEvents)) + ' à ' + fmt(lastDefined(sectorEvents)) + '.');
  vs.evoCharts.push(new Chart(evCanvas, {
    type: 'line',
    data: { labels: years, datasets: evDatasets },
    options: Object.assign({}, baseOpts, {
      plugins: Object.assign({}, baseOpts.plugins, {
        title: { display: true, text: eventLabel, font: { family: 'var(--sans)', size: 13, weight: '500' }, color: '#cbd5e1', padding: { bottom: 8 } },
      }),
    }),
  }));

  // 2. IF chart (sector line + national dashed line) - skip for views without IF canvas
  var ifCanvas = viewEl(viewId, 'evoIF');
  if (ifCanvas) {
    // En mode comparaison, le secteur courant prend la couleur d'accent (cohérence
    // avec ses pastilles / points de position / barres). Sinon, doré (identité du graphe).
    var curColor = compareCodes.length ? themeColor('--accent') : '#eab308';
    var ifDatasets = [
      {
        label: currentLabel, data: sectorIF,
        borderColor: curColor, borderWidth: 2,
        pointRadius: 5, pointBackgroundColor: curColor, pointHoverRadius: 7,
        fill: true, backgroundColor: compareCodes.length ? 'transparent' : 'rgba(234,179,8,0.1)', tension: 0.3,
      },
      {
        label: 'National', data: natIF,
        borderColor: '#64748b', borderWidth: 2, borderDash: [6, 3],
        pointRadius: 4, pointBackgroundColor: '#64748b',
        fill: false, tension: 0.3,
      }
    ];
    // Superposition des secteurs comparés (NAF5 uniquement)
    if (compareCodes.length && level === 'naf5') {
      var naf5Store = getStore(viewId, 'naf5');
      compareCodes.forEach(function(cc, i) {
        var ce = naf5Store[cc];
        if (!ce || !ce.yearly) return;
        var color = SECTOR_COLORS[i % SECTOR_COLORS.length];
        ifDatasets.push({
          label: cc,
          data: years.map(function(yr) { return ce.yearly[yr] ? ce.yearly[yr].indice_frequence : null; }),
          borderColor: color, backgroundColor: color, borderWidth: 2,
          pointRadius: 4, pointBackgroundColor: color, pointHoverRadius: 6,
          fill: false, tension: 0.3, spanGaps: true,
        });
      });
    }
    describeCanvas(ifCanvas, 'Évolution de l\'indice de fréquence de ' + years[0] + ' à ' + years[years.length - 1] +
      ', de ' + ariaNum(firstDefined(sectorIF)) + ' à ' + ariaNum(lastDefined(sectorIF)) + '.');
    vs.evoCharts.push(new Chart(ifCanvas, {
      type: 'line',
      data: {
        labels: years,
        datasets: ifDatasets
      },
      options: Object.assign({}, baseOpts, {
        plugins: Object.assign({}, baseOpts.plugins, {
          title: { display: true, text: 'Indice de Fréquence', font: { family: 'var(--sans)', size: 13, weight: '500' }, color: '#cbd5e1', padding: { bottom: 8 } },
        }),
      }),
    }));
  }
}

// ── Demographics charts (AT only) ──
// Colonnes côte à côte (une par secteur) avec en-tête coloré, façon GA4.
// renderCol(secteur, idx, bodyEl) y dessine les graphiques du secteur.
function buildCompareColumns(container, sectors, renderCol) {
  container.classList.add('cmp-cols', 'cmp-cols-' + sectors.length);
  container.innerHTML = '';
  sectors.forEach(function(sec, idx) {
    var col = document.createElement('div');
    col.className = 'cmp-col';
    var lib = sec.entry && sec.entry.libelle ? sec.entry.libelle : '';
    col.innerHTML =
      '<div class="cmp-col-head">' +
        '<span class="cmp-col-dot" style="background:' + sec.color + '"></span>' +
        '<span class="cmp-col-code">' + sec.code + '</span>' +
        (lib ? '<span class="cmp-col-lib">' + lib + '</span>' : '') +
      '</div>' +
      '<div class="cmp-col-body"></div>';
    container.appendChild(col);
    renderCol(sec, idx, col.querySelector('.cmp-col-body'));
  });
}

export function renderDemographics(viewId, sectors) {
  var section = viewEl(viewId, 'demoSection');
  if (!section) return;
  var vs = state.views[viewId];
  // Les trois vues partagent ces graphiques, seul le nom du sinistre change.
  var sinistres = VIEW_CONFIG[viewId].sinistreLabel;

  if (vs.demoCharts) vs.demoCharts.forEach(function(c) { c.destroy(); });
  vs.demoCharts = [];

  var hasDemo = function(sec) {
    var d = sec.entry && sec.entry.demographics;
    return d && d.sex && (d.sex.masculin || d.sex.feminin);
  };
  if (!sectors.some(hasDemo)) { section.style.display = 'none'; return; }
  section.style.display = '';

  // Construit les deux graphiques (sexe + âge) d'un secteur dans les canvas fournis.
  function buildDemo(sexCanvas, ageCanvas, demo) {
  // 1. Sex donut
  var sexLabels = ['Masculin', 'Féminin'];
  var sexValues = [demo.sex.masculin || 0, demo.sex.feminin || 0];
  var sexTotal = sexValues[0] + sexValues[1];

  var mPct = sexTotal > 0 ? Math.round(sexValues[0] / sexTotal * 100) : 0;
  var fPct = sexTotal > 0 ? Math.round(sexValues[1] / sexTotal * 100) : 0;
  describeCanvas(sexCanvas, 'Répartition des ' + sinistres + ' par sexe, ' + mPct + ' pour cent d\'hommes et ' + fPct + ' pour cent de femmes.');

  vs.demoCharts.push(new Chart(sexCanvas, {
    type: 'doughnut',
    data: {
      labels: sexLabels,
      datasets: [{
        data: sexValues,
        backgroundColor: ['#4e9af5', '#e5534b'],
        borderColor: themeColor('--bg-elevated'),
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '50%',
      plugins: {
        title: { display: true, text: 'Répartition par sexe', font: { family: 'var(--sans)', size: 13, weight: '500' }, color: themeColor('--text-secondary'), padding: { bottom: 8 } },
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11, family: "'Lato', sans-serif" },
            color: themeColor('--text'),
            generateLabels: function(chart) {
              var d = chart.data;
              return d.labels.map(function(label, i) {
                return {
                  text: label,
                  fillStyle: d.datasets[0].backgroundColor[i],
                  fontColor: themeColor('--text'),
                  strokeStyle: 'transparent',
                  pointStyle: 'circle',
                  hidden: false,
                  index: i,
                };
              });
            }
          }
        },
        datalabels: {
          color: '#fff',
          font: { size: 14, weight: '600', family: "'Lato', sans-serif" },
          formatter: function(value) {
            var pct = sexTotal > 0 ? (value / sexTotal * 100).toFixed(0) : 0;
            return pct + '%';
          },
          display: function(ctx) {
            return ctx.dataset.data[ctx.dataIndex] > 0;
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var pct = sexTotal > 0 ? (ctx.raw / sexTotal * 100).toFixed(1) : 0;
              return ' ' + fmt(ctx.raw) + ' (' + pct + '%)';
            }
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  }));

  // 2. Age bar chart (horizontal)
  var ageGroups = ['<20', '20-24', '25-29', '30-34', '35-39', '40-49', '50-59', '60-64', '65+'];
  var ageLabels = ['< 20 ans', '20-24 ans', '25-29 ans', '30-34 ans', '35-39 ans', '40-49 ans', '50-59 ans', '60-64 ans', '65+ ans'];
  var ageValues = ageGroups.map(function(g) { return (demo.age && demo.age[g]) || 0; });
  var ageColors = ['rgba(99,102,241,0.3)', 'rgba(99,102,241,0.38)', 'rgba(99,102,241,0.46)', 'rgba(99,102,241,0.54)', 'rgba(99,102,241,0.62)', 'rgba(99,102,241,0.7)', 'rgba(99,102,241,0.78)', 'rgba(99,102,241,0.86)', 'rgba(99,102,241,0.94)'];

  var ageTotal = ageValues.reduce(function(s, v) { return s + v; }, 0);
  var ageMaxIdx = 0;
  ageValues.forEach(function(v, i) { if (v > ageValues[ageMaxIdx]) ageMaxIdx = i; });
  describeCanvas(ageCanvas, ageTotal > 0
    ? 'Répartition des ' + sinistres + ' par âge, tranche la plus touchée ' + ageLabels[ageMaxIdx] + ' à ' + Math.round(ageValues[ageMaxIdx] / ageTotal * 100) + ' pour cent.'
    : 'Répartition des ' + sinistres + ' par âge.');

  vs.demoCharts.push(new Chart(ageCanvas, {
    type: 'bar',
    data: {
      labels: ageLabels,
      datasets: [{
        data: ageValues,
        backgroundColor: ageColors,
        borderColor: ageColors.map(function() { return 'rgba(99,102,241,1)'; }),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        title: { display: true, text: 'Répartition par âge', font: { family: 'var(--sans)', size: 13, weight: '500' }, color: themeColor('--text-secondary'), padding: { bottom: 8 } },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var total = ageValues.reduce(function(s, v) { return s + v; }, 0);
              var pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
              return ' ' + fmt(ctx.raw) + ' (' + pct + '%)';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: themeColor('--chart-grid') },
          ticks: { font: { size: 11, family: "'JetBrains Mono', monospace" }, color: themeColor('--chart-label') }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11, family: "'Lato', sans-serif" }, color: themeColor('--chart-label') }
        }
      }
    }
  }));
  } // fin buildDemo

  var grid = section.querySelector('.demo-grid');
  if (sectors.length < 2) {
    grid.classList.remove('cmp-cols', 'cmp-cols-1', 'cmp-cols-2');
    grid.innerHTML =
      '<div class="demo-card"><div class="demo-chart-wrap"><canvas id="' + viewId + '-demoSex"></canvas></div></div>' +
      '<div class="demo-card"><div class="demo-chart-wrap"><canvas id="' + viewId + '-demoAge"></canvas></div></div>';
    buildDemo(el(viewId + '-demoSex'), el(viewId + '-demoAge'), sectors[0].entry.demographics);
    return;
  }
  buildCompareColumns(grid, sectors, function(sec, idx, body) {
    var d = sec.entry && sec.entry.demographics;
    if (!d || !d.sex || (!d.sex.masculin && !d.sex.feminin)) {
      body.innerHTML = '<p class="cmp-nodata">Démographie indisponible.</p>';
      return;
    }
    body.innerHTML =
      '<div class="demo-chart-wrap"><canvas></canvas></div>' +
      '<div class="demo-chart-wrap"><canvas></canvas></div>';
    var cv = body.querySelectorAll('canvas');
    buildDemo(cv[0], cv[1], d);
  });
}

// ── Sinistralité par taille d'établissement (extrait du chart vectoriel des fiches) ──
// Phrase de contexte : tranche d'effectif en sur-risque (part accidents > part salariés).
function sizeSubText(bands) {
  var worst = null, worstGap = 0;
  (bands || []).forEach(function(b) {
    var gap = b.part_accidents - b.part_salaries;
    if (b.part_salaries >= 1 && gap > worstGap) { worstGap = gap; worst = b.label; }
  });
  return worst
    ? 'Sur-risque dans les établissements de ' + worst + ' salariés : leur part d\'accidents dépasse leur part de salariés.'
    : 'Part des accidents du travail et part des salariés par taille d\'établissement.';
}

function buildSizeChart(canvas, bands, sectorIF) {
  var labels = bands.map(function(b) { return b.label; });
  var acc = bands.map(function(b) { return b.part_accidents; });
  var sal = bands.map(function(b) { return b.part_salaries; });
  // IF par tranche dérivé : (part accidents / part salariés) * IF du secteur
  var ifBand = bands.map(function(b) {
    return b.part_salaries > 0 ? Math.round(b.part_accidents / b.part_salaries * sectorIF * 10) / 10 : null;
  });
  var tickColor = themeColor('--text-dim');
  var gridColor = themeColor('--border');

  var sizeWorst = null, sizeWorstGap = 0;
  (bands || []).forEach(function(b) {
    var gap = b.part_accidents - b.part_salaries;
    if (b.part_salaries >= 1 && gap > sizeWorstGap) { sizeWorstGap = gap; sizeWorst = b.label; }
  });
  describeCanvas(canvas, 'Part des accidents et part des salariés par taille d\'établissement' +
    (sizeWorst ? ', sur-risque dans les établissements de ' + sizeWorst + ' salariés.' : '.'));

  return new Chart(canvas, {
    data: {
      labels: labels,
      datasets: [
        { type: 'bar', label: 'Part des accidents', data: acc, backgroundColor: '#6cae6f', borderRadius: 3, yAxisID: 'y', order: 2 },
        { type: 'bar', label: 'Part des salariés', data: sal, backgroundColor: '#7e57c2', borderRadius: 3, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Indice de fréquence', data: ifBand, borderColor: '#c74a43', backgroundColor: '#c74a43', borderWidth: 2, pointRadius: 3, tension: 0.25, yAxisID: 'y1', order: 1, spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 12, color: tickColor } },
        datalabels: { display: false },
        tooltip: { callbacks: { label: function(c) {
          if (c.dataset.yAxisID === 'y1') return ' IF tranche : ' + (c.parsed.y == null ? 'n/a' : c.parsed.y);
          return ' ' + c.dataset.label + ' : ' + c.parsed.y + ' %';
        } } }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Part (%)', color: tickColor }, ticks: { color: tickColor, callback: function(v){return v+'%';} }, grid: { color: gridColor } },
        y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Indice de fréquence', color: '#c74a43' }, ticks: { color: '#c74a43' }, grid: { drawOnChartArea: false } },
        x: { ticks: { color: tickColor }, grid: { display: false } }
      }
    }
  });
}

export function renderSizeChart(viewId, sectors) {
  var section = viewEl(viewId, 'sizeSection');
  if (!section) return;
  var vs = state.views[viewId];
  if (vs.sizeCharts) vs.sizeCharts.forEach(function(c) { c.destroy(); });
  if (vs.sizeChart) { vs.sizeChart.destroy(); vs.sizeChart = null; }
  vs.sizeCharts = [];

  var hasBands = function(sec) { return sec.bands && sec.bands.length; };
  if (!sectors.some(hasBands)) { section.style.display = 'none'; return; }
  section.style.display = '';

  var card = section.querySelector('.chart-card');
  var sub = viewEl(viewId, 'sizeSub');

  if (sectors.length < 2) {
    var s0 = sectors[0];
    if (sub) sub.textContent = sizeSubText(s0.bands);
    card.classList.remove('cmp-cols', 'cmp-cols-1', 'cmp-cols-2');
    card.innerHTML = '<div class="chart-wrap" id="' + viewId + '-sizeWrap" style="height:340px"><canvas id="' + viewId + '-sizeChart"></canvas></div>';
    vs.sizeCharts.push(buildSizeChart(el(viewId + '-sizeChart'), s0.bands, s0.sectorIF));
    return;
  }
  if (sub) sub.textContent = 'Part des accidents et part des salariés par taille d\'établissement, comparées entre secteurs.';
  buildCompareColumns(card, sectors, function(sec, idx, body) {
    if (!hasBands(sec)) { body.innerHTML = '<p class="cmp-nodata">Données de taille indisponibles.</p>'; return; }
    body.innerHTML = '<div class="chart-wrap" style="height:320px"><canvas></canvas></div>';
    vs.sizeCharts.push(buildSizeChart(body.querySelector('canvas'), sec.bands, sec.sectorIF));
  });
}

// ── Panneaux de dimensions : nature des accidents (AT, Trajet) et profil MP ──
// Toutes ces dimensions se lisent pareil, une barre horizontale par modalité, part des
// sinistres du secteur. Ce qui change d'une vue à l'autre tient dans PANELS, plus bas.
var DIMENSION_LABELS = {
  siege: {
    tete: 'Tête', cou: 'Cou', dos: 'Dos', torse: 'Torse',
    membres_superieurs: 'Membres supérieurs', membres_inferieurs: 'Membres inférieurs',
    corps_entier: 'Corps entier', autres: 'Autres'
  },
  activite: {
    operation_machine: 'Opération machine', outils_main: 'Outils à main',
    conduite_transport: 'Conduite / transport', manipulation_objets: 'Manipulation d\'objets',
    transport_manuel: 'Transport manuel de charge', mouvement: 'Mouvement du corps',
    presence: 'Présence sur les lieux', autre: 'Autre'
  },
  modalite: {
    contact_electrique: 'Contact électrique', noyade_ensevelissement: 'Noyade / ensevelissement',
    ecrasement_mouvement: 'Écrasement en mouvement', heurt_objet: 'Heurt d\'objet',
    contact_coupant: 'Contact objet coupant', coincement: 'Coincement',
    contrainte_corps: 'Contrainte physique / posture', morsure: 'Morsure / coup d\'animal', autre: 'Autre'
  },
  duree: {
    non_precise: 'Non précisé', moins_6_mois: 'Moins de 6 mois', '6_mois_1_an': 'De 6 mois à 1 an',
    '1_a_5_ans': 'De 1 à 5 ans', '5_a_10_ans': 'De 5 à 10 ans', plus_10_ans: 'Plus de 10 ans'
  },
  profession: {
    agriculteurs: 'Agriculteurs', artisans: 'Artisans', conducteurs: 'Conducteurs',
    dirigeants: 'Dirigeants', employes: 'Employés', employes_non_qualifies: 'Employés non qualifiés',
    personnels_service: 'Personnels de service', professions_intermediaires: 'Professions intermédiaires',
    specialistes_sciences: 'Spécialistes des sciences', professions_militaires: 'Professions militaires',
    non_precise: 'Non précisé'
  }
};

// Exclut "non_determine", retire les zéros, renormalise en % sur le reste, trie décroissant.
// keepOrder préserve l'ordre déclaré des modalités : une durée d'exposition se lit de la
// plus courte à la plus longue, la trier par valeur détruirait la progression.
function injuryBars(raw, labelMap, keepOrder) {
  var entries = Object.keys(labelMap)
    .filter(function(k) { return k !== 'non_determine'; })
    .map(function(k) { return { label: labelMap[k], value: (raw || {})[k] || 0 }; })
    .filter(function(d) { return d.value > 0; });
  if (!keepOrder) entries.sort(function(a, b) { return b.value - a.value; });
  var total = entries.reduce(function(s, d) { return s + d.value; }, 0);
  entries.forEach(function(d) { d.pct = total > 0 ? Math.round(d.value / total * 1000) / 10 : 0; });
  return entries;
}

// Les maladies professionnelles arrivent en liste ordonnée, avec leur part déjà calculée
// sur l'ensemble des MP du secteur. On n'en dessine que les premières, la liste complète
// vit dans le tableau sous le panneau.
var DISEASE_BARS = 8;

function diseaseBars(list) {
  return (list || [])
    .filter(function(d) { return d.nb > 0; })
    .slice(0, DISEASE_BARS)
    .map(function(d) { return { label: d.libelle || d.code, value: d.nb, pct: d.pct || 0 }; });
}

// Construit la fonction de lecture d'une dimension classée par clé.
function keyedBars(key, labelMap, keepOrder) {
  return function(dims) { return injuryBars((dims || {})[key], labelMap, keepOrder); };
}

// Les libellés officiels vont jusqu'à « Aff. Rachis lombaire/manutention charges lourdes ».
// Chart.js rogne alors le DÉBUT du libellé, ce qui donne « e/manutention charges lourdes ».
// On coupe donc nous-mêmes par la fin, le libellé entier restant dans l'infobulle.
var TICK_MAX = 26;

function shortenTick(label) {
  return label.length > TICK_MAX ? label.slice(0, TICK_MAX - 1).trimEnd() + '…' : label;
}

// title vaut null quand la carte porte déjà un titre en HTML.
function buildInjuryChart(canvas, title, entries, color) {
  var tickColor = themeColor('--text-dim');
  var labels = entries.map(function(d) { return d.label; });

  if (title) {
    describeCanvas(canvas, entries.length
      ? title + ', en tête ' + entries[0].label.toLowerCase() + ' à ' + Math.round(entries[0].pct) + ' pour cent.'
      : title + ', aucune donnée disponible.');
  }

  return new Chart(canvas, {
    type: 'bar',
    data: { labels: labels,
      datasets: [{ data: entries.map(function(d) { return d.pct; }), backgroundColor: color, borderRadius: 3 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, datalabels: { display: false },
        title: { display: !!title, text: title, color: themeColor('--text-secondary'), font: { size: 13, weight: '600' }, padding: { bottom: 8 } },
        tooltip: { callbacks: {
          title: function(c) { return labels[c[0].dataIndex]; },
          label: function(c) { return ' ' + pctFr(c.parsed.x); }
        } }
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: tickColor, callback: function(v) { return pctFr(v, 0); } }, grid: { color: themeColor('--border') } },
        y: { ticks: { color: tickColor, font: { size: 11 }, callback: function(v, i) { return shortenTick(labels[i]); } }, grid: { display: false } }
      }
    }
  });
}

// Un panneau nomme sa section HTML, la phrase qui l'introduit, et ses mesures. Ajouter
// une dimension à une vue, c'est ajouter une ligne ici puis son nom dans VIEW_CONFIG.
export var PANELS = {
  atInjury: {
    section: 'injurySection',
    empty: 'Nature des accidents indisponible.',
    metrics: [
      { title: 'Siège des lésions', color: '#5b8def', bars: keyedBars('siege_lesions', DIMENSION_LABELS.siege) },
      { title: 'Activité physique', color: '#e0a458', bars: keyedBars('activite_physique', DIMENSION_LABELS.activite) },
      { title: 'Modalité de la blessure', color: '#c074c0', bars: keyedBars('modalite_blessure', DIMENSION_LABELS.modalite) }
    ]
  },
  trajetInjury: {
    section: 'injurySection',
    empty: 'Siège des lésions indisponible.',
    metrics: [
      { title: 'Siège des lésions', color: '#5b8def', bars: keyedBars('trajet_siege_lesions', DIMENSION_LABELS.siege) }
    ]
  },
  mpProfile: {
    section: 'profileSection',
    empty: 'Profil des maladies indisponible.',
    metrics: [
      { title: 'Principales maladies reconnues', color: '#7c6ef0', bars: function(dims) { return diseaseBars((dims || {}).mp_diseases); } },
      { title: 'Durée d\'exposition avant la reconnaissance', color: '#3fa796', bars: keyedBars('mp_duree_exposition', DIMENSION_LABELS.duree, true) },
      { title: 'Profession de la victime', color: '#e0a458', bars: keyedBars('mp_profession', DIMENSION_LABELS.profession) }
    ]
  }
};

// Dessine un panneau de dimensions pour un ou plusieurs secteurs. Un seul secteur donne
// une carte par mesure, plusieurs donnent une colonne par secteur façon GA4.
export function renderDimensionPanel(viewId, panelId, sectors) {
  var panel = PANELS[panelId];
  var section = panel && viewEl(viewId, panel.section);
  if (!section) return;
  var vs = state.views[viewId];
  var metrics = panel.metrics;

  var hasData = function(sec) {
    return metrics.some(function(m) { return m.bars(sec.dims).length; });
  };
  if (!sectors.some(hasData)) { section.style.display = 'none'; return; }
  section.style.display = '';

  var grid = section.querySelector('.injury-grid');
  if (sectors.length < 2) {
    grid.classList.remove('cmp-cols', 'cmp-cols-1', 'cmp-cols-2');
    grid.innerHTML = metrics.map(function() {
      return '<div class="chart-card"><div class="chart-wrap injury-wrap"><canvas></canvas></div></div>';
    }).join('');
    var canvases = grid.querySelectorAll('canvas');
    metrics.forEach(function(m, i) {
      vs.injuryCharts.push(buildInjuryChart(canvases[i], m.title, m.bars(sectors[0].dims), m.color));
    });
    return;
  }
  buildCompareColumns(grid, sectors, function(sec, idx, body) {
    if (!hasData(sec)) { body.innerHTML = '<p class="cmp-nodata">' + panel.empty + '</p>'; return; }
    body.innerHTML = metrics.map(function() { return '<div class="chart-wrap injury-wrap"><canvas></canvas></div>'; }).join('');
    var cv = body.querySelectorAll('canvas');
    metrics.forEach(function(m, i) {
      vs.injuryCharts.push(buildInjuryChart(cv[i], m.title, m.bars(sec.dims), m.color));
    });
  });
}

// Rend tous les panneaux déclarés par la vue, et détruit d'abord les graphiques du rendu
// précédent (un seul pool, tous panneaux confondus).
export function renderPanels(viewId, panelIds, sectors) {
  var vs = state.views[viewId];
  if (vs.injuryCharts) vs.injuryCharts.forEach(function(c) { c.destroy(); });
  vs.injuryCharts = [];
  (panelIds || []).forEach(function(id) { renderDimensionPanel(viewId, id, sectors); });
}

// ── Maladies professionnelles (MP only) : tableau détaillé sous le panneau de profil ──
// Le panneau montre les principales maladies en barres, ce tableau donne le détail que
// des barres ne portent pas : les séquelles et les journées perdues, tableau par tableau.
export function renderDiseaseTable(viewId, dims) {
  var section = viewEl(viewId, 'diseaseSection');
  if (!section) return;
  var active = ((dims && dims.mp_diseases) || [])
    .filter(function(d) { return d.nb > 0 || d.ip > 0 || d.deces > 0; });
  if (!active.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  var rows = active.map(function(d) {
    // L'alinéa 7 n'a pas de numéro de tableau, son libellé le nomme déjà.
    var code = d.code === 'HORS-TABLEAU' ? '-' : d.code;
    return '<tr><td class="dz-code">' + code + '</td>' +
      '<td class="dz-lib">' + (d.libelle || '') + '</td>' +
      '<td class="dz-nb">' + fmt(d.nb || 0) + '</td>' +
      '<td class="dz-pct">' + (d.nb ? pctFr(d.pct || 0) : '-') + '</td>' +
      '<td class="dz-nb">' + fmt(d.ip || 0) + '</td>' +
      '<td class="dz-nb">' + fmt(d.deces || 0) + '</td>' +
      '<td class="dz-nb">' + fmt(d.journees || 0) + '</td></tr>';
  }).join('');
  viewEl(viewId, 'diseaseWrap').innerHTML =
    '<table class="disease-table"><thead><tr>' +
    '<th>Tableau</th><th>Maladie professionnelle</th><th>Cas</th><th>Part</th>' +
    '<th>Nouvelles IP</th><th>Décès</th><th>Journées perdues</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}
