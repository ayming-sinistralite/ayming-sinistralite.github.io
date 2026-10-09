// ── Chart rendering ──

import { fmt, fmt1, pctFr, themeColor, causeColors, cssColor, el, viewEl } from './utils.js?v=f8b7846';
import { state, VIEW_CONFIG } from './state.js?v=f8b7846';
import { getData, getStore } from './data.js?v=f8b7846';
import { selectCode } from './search.js?v=f8b7846';
import { SECTOR_COLORS } from './compare.js?v=f8b7846';
import { describeCanvas, buildShareChart, nationalSum } from './findings.js?v=f8b7846';

// Nombre à la française (virgule décimale), cohérent avec fmtCompact.
function ariaNum(n, digits) {
  if (n === null || n === undefined || isNaN(n)) return 'n/a';
  return n.toFixed(digits === undefined ? 1 : digits).replace('.', ',');
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
    ', principale cause ' + labels[0].toLowerCase() + ' à ' + Math.round(values[0]) + ' pour cent des accidents dont la cause est connue.');

  // Les caractères des MP ne s'excluent pas, un cancer d'origine chimique compte à la fois
  // en « Risque chimique » et en « Cancers professionnels ». Leur somme dépasse donc 100 %
  // (jusqu'à 175 % sur 105 secteurs), et un anneau les afficherait comme des parts d'un tout
  // en les renormalisant en silence. Des barres disent ce que la donnée dit vraiment, la part
  // des MP du secteur qui portent ce caractère.
  if (VIEW_CONFIG[viewId].causesExclusive === false) {
    return buildInjuryChart(canvas, null, chartData.map(function(pair) {
      return { label: pair[0], value: pair[1], pct: Math.round(pair[1] * 10) / 10 };
    }), 'var(--c-1)');
  }

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: causeColors().slice(0, values.length),
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
            color: themeColor('--text-secondary'),
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
          titleFont: { family: "'Lato', sans-serif", size: 11 },
          bodyFont: { family: "'Lato', sans-serif", size: 11 },
          titleColor: themeColor('--text'),
          bodyColor: themeColor('--text-secondary'),
          callbacks: { label: function(ctx) { return ' ' + ctx.label + ' : ' + ctx.parsed.toFixed(1).replace('.', ',') + ' % des accidents dont la cause est connue'; } }
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
// Encre du texte posé sur une barre : blanc ou marine, celle qui contraste le plus avec la
// teinte réelle de la barre dans le thème courant (le cyan et le vert ne portent pas le blanc).
function inkOn(color) {
  var m = /^var\((--[\w-]+)\)$/.exec(color);
  var hex = m ? themeColor(m[1]) : color;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#fff';
  var lum = [1, 3, 5].map(function(i) {
    var c = parseInt(hex.substr(i, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  var L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  // Contraste avec le blanc (L 1) contre l'encre #0f172a (L 0,0086).
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.0586) ? '#fff' : '#0f172a';
}

function buildFunnel(container, items, viewId, uid) {
  var maxVal = items[items.length - 1].value || 1;
  var n = items.length;

  // Build bars with conversion rates between them
  var html = '';
  for (var i = 0; i < n; i++) {
    var d = items[i];
    var pct = Math.round(((i + 1) / n) * 100);
    var ofTotal = (d.value / maxVal * 100).toFixed(1);
    html += '<div class="funnel-bar" style="width:' + pct + '%;background:' + d.color + ';color:' + inkOn(d.color) + '" data-idx="' + i + '" data-pct="' + ofTotal + '">' +
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
  viewEl(viewId, 'posTitle').textContent = level === 'naf1'
    ? 'Positionnement IF // ' + allIF.length + ' sections'
    : 'Positionnement IF // ' + allIF.length + ' codes ' + levelLabel;

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
      html += '<div class="pos-marker-label" style="left:' + x + '%">IF ' + fmt1(ifValue) + '</div>';
    }
  });

  var natIF = data.meta.national.indice_frequence;
  var natX = (natIF / maxIF * 96) + 2;
  html += '<div class="pos-national" style="left:' + natX + '%"></div>';
  html += '<div class="pos-national-label" style="left:' + natX + '%">Moy. ' + fmt1(natIF) + '</div>';

  var minIF = allIF[0].if_val;
  html += '<div class="pos-axis" style="left:2%">' + minIF.toFixed(0) + '</div>';
  html += '<div class="pos-axis pos-end">' + maxIF.toFixed(0) + '</div>';

  strip.innerHTML = html;

  var tip = el(tipId);
  var dots = strip.querySelectorAll('.pos-dot');
  function showTip(i) {
    var d = allIF[i];
    var short = d.libelle.length > 30 ? d.libelle.substring(0, 30) + '...' : d.libelle;
    tip.textContent = d.code + '  ' + short + '  IF ' + fmt1(d.if_val);
    tip.style.left = dots[i].style.left;
    tip.classList.add('visible');
  }
  strip.querySelectorAll('.pos-dot:not(.current)').forEach(function(dot) {
    var i = +dot.dataset.idx;
    dot.addEventListener('mouseenter', function() { showTip(i); });
    dot.addEventListener('mouseleave', function() { tip.classList.remove('visible'); });
    dot.addEventListener('click', function() {
      tip.classList.remove('visible');
      selectCode(viewId, allIF[i].code, level, renderFn);
    });
  });

  // Au clavier, la bande est un seul arrêt de tabulation (et non 700 points) : les flèches
  // parcourent les secteurs par IF croissant depuis le secteur affiché, Entrée ouvre celui
  // pointé. L'infobulle, annoncée en direct, dit où l'on est.
  var cur = -1;
  allIF.forEach(function(d, i) { if (d.code === code) cur = i; });
  var focusIdx = cur;
  strip.tabIndex = 0;
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-roledescription', 'bande de positionnement');
  strip.setAttribute('aria-label', 'Positionnement de l\'indice de fréquence parmi ' + allIF.length +
    ' secteurs. Flèches gauche et droite pour parcourir, Entrée pour ouvrir un secteur.');
  tip.setAttribute('aria-live', 'polite');
  function mark(i) {
    strip.querySelectorAll('.pos-dot.kbd').forEach(function(x) { x.classList.remove('kbd'); });
    if (i >= 0) { dots[i].classList.add('kbd'); showTip(i); }
  }
  strip.onfocus = function() { if (focusIdx < 0) focusIdx = 0; mark(focusIdx); };
  strip.onblur = function() { mark(-1); tip.classList.remove('visible'); focusIdx = cur; };
  strip.onkeydown = function(e) {
    var step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (step) focusIdx = Math.max(0, Math.min(allIF.length - 1, focusIdx + step));
    else if (e.key === 'Home') focusIdx = 0;
    else if (e.key === 'End') focusIdx = allIF.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusIdx !== cur) selectCode(viewId, allIF[focusIdx].code, level, renderFn);
      return;
    } else return;
    e.preventDefault();
    mark(focusIdx);
  };
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
  } else if (level === 'naf1') {
    // Une section se compare à ses propres divisions, cliquables, jamais à toutes les divisions.
    var naf2Of = getStore(viewId, 'naf2');
    items = (getStore(viewId, 'naf1')[code].codes_naf2 || [])
      .filter(function(c) { return naf2Of[c]; })
      .map(function(c) { return { code: c, libelle: naf2Of[c].libelle, if_val: naf2Of[c].stats.indice_frequence }; });
    clickLevel = 'naf2';
    viewEl(viewId, 'compTitle').textContent = 'Comparaison // divisions de la section ' + code;
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
  var allAccent = (level === 'naf4' || level === 'naf1');
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
          titleFont: { family: "'Lato', sans-serif", size: 11 },
          bodyFont: { family: "'Lato', sans-serif", size: 11 },
          callbacks: {
            title: function(ctx) {
              var i = ctx[0].dataIndex;
              return items[i].code + '  ' + items[i].libelle;
            },
            label: function(ctx) { return ' IF: ' + fmt1(ctx.parsed.y); }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { family: "'Lato', sans-serif", size: 10 } },
          grid: { color: themeColor('--chart-grid') }
        },
        x: {
          grid: { display: false },
          title: {
            display: true,
            text: 'Indice de fréquence',
            font: { family: "'Lato', sans-serif", size: 10, weight: '500' },
            color: themeColor('--text-dim')
          },
          ticks: {
            font: { family: "'Lato', sans-serif", size: 9 },
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
      '<td class="if-val">' + fmt1(item.if_val) + '</td>' +
      '<td>' + fmt(events) + '</td>' +
      '</tr>';
  }).join('');
  var tableWrap = viewEl(viewId, 'compTable');
  tableWrap.innerHTML = '<table class="comp-table"><thead><tr>' +
    '<th>#</th><th>Code</th><th>Libellé</th><th>IF</th><th>' + cfg.eventLabel + '</th>' +
    '</tr></thead><tbody>' + tableRows + '</tbody></table>';
  tableWrap.querySelectorAll('tr[data-code]').forEach(function(row) {
    function open() {
      if (row.dataset.code !== code) selectCode(viewId, row.dataset.code, row.dataset.level, renderFn);
    }
    row.addEventListener('click', open);
    // La vue tableau est le pendant clavier des barres du graphique.
    row.tabIndex = 0;
    row.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
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

// ── Demographics charts (AT only) ──
// Colonnes côte à côte (une par secteur) avec en-tête coloré, façon GA4.
// renderCol(secteur, idx, bodyEl) y dessine les graphiques du secteur.
export function buildCompareColumns(container, sectors, renderCol) {
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

// ── Démographie des sinistres ──
// Parts par sexe et par âge, dans l'ordre des tranches, avec la part nationale de chacune.
export var SEX_GROUPS = [['masculin', 'Hommes'], ['feminin', 'Femmes']];
export var AGE_GROUPS = [['<20', 'Moins de 20 ans'], ['20-24', '20 à 24 ans'], ['25-29', '25 à 29 ans'], ['30-34', '30 à 34 ans'],
  ['35-39', '35 à 39 ans'], ['40-49', '40 à 49 ans'], ['50-59', '50 à 59 ans'], ['60-64', '60 à 64 ans'], ['65+', '65 ans et plus']];

export function demoShares(raw, natRaw, groups) {
  var pct = function(block) {
    var total = groups.reduce(function(s, g) { return s + ((block || {})[g[0]] || 0); }, 0);
    return function(k) { return total ? Math.round(((block || {})[k] || 0) / total * 1000) / 10 : null; };
  };
  var mine = pct(raw), theirs = pct(natRaw);
  return groups
    .filter(function(g) { return ((raw || {})[g[0]] || 0) > 0; })
    .map(function(g) { return { label: g[1], value: raw[g[0]], pct: mine(g[0]), nat: theirs(g[0]) }; });
}

var DEMO_NATIONAL = {};
export function nationalDemographics(viewId) {
  if (!DEMO_NATIONAL[viewId]) {
    var store = getStore(viewId, 'naf5') || {};
    DEMO_NATIONAL[viewId] = nationalSum(Object.keys(store).map(function(c) { return store[c].demographics; }));
  }
  return DEMO_NATIONAL[viewId];
}

export function renderDemographics(viewId, sectors) {
  var section = viewEl(viewId, 'demoSection');
  if (!section) return;
  var vs = state.views[viewId];

  if (vs.demoCharts) vs.demoCharts.forEach(function(c) { c.destroy(); });
  vs.demoCharts = [];

  var hasDemo = function(sec) {
    var d = sec.entry && sec.entry.demographics;
    return d && d.sex && (d.sex.masculin || d.sex.feminin);
  };
  if (!sectors.some(hasDemo)) { section.style.display = 'none'; return; }
  section.style.display = '';

  // Le national : la démographie sommée sur tous les NAF 5 de la vue, calculée une fois.
  var nat = nationalDemographics(viewId);

  // Construit les deux graphiques (sexe + âge) d'un secteur dans les canvas fournis, au
  // format des autres graphiques de la page : constat en titre, part nationale en barre pâle.
  function buildDemo(sexCanvas, ageCanvas, demo) {
    vs.demoCharts.push(buildShareChart(sexCanvas, 'Selon le sexe de la victime', demoShares(demo.sex, nat.sex, SEX_GROUPS)));
    vs.demoCharts.push(buildShareChart(ageCanvas, 'Selon l\'âge de la victime', demoShares(demo.age, nat.age, AGE_GROUPS)));
  }

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
        { type: 'bar', label: 'Part des accidents', data: acc, backgroundColor: themeColor('--c-1'), borderRadius: 3, yAxisID: 'y', order: 2 },
        { type: 'bar', label: 'Part des salariés', data: sal, backgroundColor: themeColor('--c-8'), borderRadius: 3, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Indice de fréquence', data: ifBand, borderColor: themeColor('--c-2'), backgroundColor: themeColor('--c-2'), borderWidth: 2, pointRadius: 3, tension: 0.25, yAxisID: 'y1', order: 1, spanGaps: true }
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
        y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Indice de fréquence', color: themeColor('--c-2') }, ticks: { color: themeColor('--c-2') }, grid: { drawOnChartArea: false } },
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
export var DIMENSION_LABELS = {
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

// Les causes de trajet viennent de l'API Ameli déjà en parts de l'ensemble des accidents
// de trajet du secteur (les véhicules, en parts des pertes de contrôle). On ne renormalise
// donc pas : une part masquée par le secret statistique (null) disparaît sans gonfler les autres.
// Les libellés Ameli dépassent la largeur de l'axe, on les raccourcit sans en changer le sens.
export var API_LABELS = {
  'Perte de contrôle d\'un véhicule': 'Perte de contrôle',
  'Perte d\'équilibre avec chute': 'Déséquilibre avec chute',
  'Perte d\'équilibre sans chute': 'Déséquilibre sans chute',
  'Entrainé par quelque chose ou quelqu\'un': 'Entraîné (objet, personne)'
};

function shareBars(field, sub) {
  return function(dims, entry) {
    var shares = ((entry || {})[field] || {})[sub] || {};
    return Object.keys(shares)
      .filter(function(k) { return shares[k] > 0; })
      .map(function(k) { return { label: API_LABELS[k] || k, value: shares[k], pct: Math.round(shares[k] * 1000) / 10 }; })
      .sort(function(a, b) { return b.value - a.value; });
  };
}

// Les MP hors tableau arrivent en nombres par chapitre de la CIM-10. La part se calcule sur
// l'ensemble des MP hors tableau du secteur ; un chapitre masqué par le secret (nb nul) disparaît.
function horsTableauBars(dims, entry) {
  var list = ((entry || {}).mp_hors_tableau || []).filter(function(d) { return d.nb > 0; });
  var total = list.reduce(function(s, d) { return s + d.nb; }, 0);
  return list.map(function(d) {
    return { label: d.libelle || d.code, value: d.nb, pct: Math.round(d.nb / total * 1000) / 10 };
  });
}

// La série des MP psychiques, une barre par année. Une série sans aucun cas ne se dessine pas.
export function psyYearBars(dims, entry) {
  var series = (entry || {}).mp_psy || {};
  var years = Object.keys(series).sort();
  if (!years.some(function(y) { return series[y] > 0; })) return [];
  return years.map(function(y) { return { label: y, value: series[y] || 0 }; });
}

// Construit la fonction de lecture d'une dimension classée par clé.
// dims.nat, quand app.js le fournit, porte la même dimension sommée sur tous les secteurs.
export function keyedBars(key, labelMap, keepOrder) {
  return function(dims) {
    var nat = {};
    injuryBars(((dims || {}).nat || {})[key], labelMap).forEach(function(d) { nat[d.label] = d.pct; });
    var hasNat = Object.keys(nat).length > 0;
    return injuryBars((dims || {})[key], labelMap, keepOrder).map(function(d) {
      if (hasNat) d.nat = nat[d.label] || 0;
      return d;
    });
  };
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
      datasets: [{ data: entries.map(function(d) { return d.pct; }), backgroundColor: cssColor(color), borderRadius: 3 }] },
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

// Une série annuelle en nombres de cas, barres verticales. Une mesure la choisit par build.
function buildYearChart(canvas, title, entries, color) {
  var tickColor = themeColor('--text-dim');
  if (entries.length) {
    var first = entries[0], last = entries[entries.length - 1];
    describeCanvas(canvas, title + ', de ' + fmt(first.value) + ' cas en ' + first.label + ' à ' + fmt(last.value) + ' en ' + last.label + '.');
  }
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: entries.map(function(d) { return d.label; }),
      datasets: [{ data: entries.map(function(d) { return d.value; }), backgroundColor: cssColor(color), borderRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, datalabels: { display: false },
        title: { display: !!title, text: title, color: themeColor('--text-secondary'), font: { size: 13, weight: '600' }, padding: { bottom: 8 } },
        tooltip: { callbacks: { label: function(c) { return ' ' + fmt(c.parsed.y) + ' cas'; } } }
      },
      scales: {
        x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: tickColor, precision: 0 }, grid: { color: themeColor('--border') } }
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
      { title: 'Activité physique', color: 'var(--c-1)', bars: keyedBars('activite_physique', DIMENSION_LABELS.activite) },
      { title: 'Modalité de la blessure', color: 'var(--c-2)', bars: keyedBars('modalite_blessure', DIMENSION_LABELS.modalite) }
    ]
  },
  trajetCauses: {
    section: 'causesSection',
    empty: 'Causes des accidents de trajet indisponibles.',
    metrics: [
      { title: 'Cause de l\'accident', color: 'var(--c-1)', bars: shareBars('trajet_causes', 'causes') },
      { title: 'Véhicule, quand le conducteur en perd le contrôle', color: 'var(--c-2)', bars: shareBars('trajet_causes', 'vehicules') }
    ]
  },
  mpProfile: {
    section: 'profileSection',
    empty: 'Profil des maladies indisponible.',
    metrics: [
      { title: 'Principales maladies reconnues', color: 'var(--c-1)', bars: function(dims) { return diseaseBars((dims || {}).mp_diseases); } },
      { title: 'Durée d\'exposition avant la reconnaissance', color: 'var(--c-3)', bars: keyedBars('mp_duree_exposition', DIMENSION_LABELS.duree, true) },
      { title: 'Profession de la victime', color: 'var(--c-2)', bars: keyedBars('mp_profession', DIMENSION_LABELS.profession) }
    ]
  },
  mpPsy: {
    section: 'psySection',
    empty: 'Aucune maladie psychique ni hors tableau reconnue.',
    metrics: [
      { title: 'Maladies psychiques reconnues par année', color: 'var(--c-4)', bars: psyYearBars, build: buildYearChart },
      { title: 'MP hors tableau, par famille de maladies', color: 'var(--c-2)', bars: horsTableauBars }
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
    return metrics.some(function(m) { return m.bars(sec.dims, sec.entry).length; });
  };
  if (!sectors.some(hasData)) { section.style.display = 'none'; return; }
  section.style.display = '';

  // Une mesure sans ligne dessinerait un axe vide de 0 à 1 : seules restent celles qu'un
  // secteur affiché au moins renseigne (5121Z en MP, l'âge ou les MP hors tableau).
  metrics = metrics.filter(function(m) { return sectors.some(function(sec) { return m.bars(sec.dims, sec.entry).length; }); });

  var grid = section.querySelector('.injury-grid');
  if (sectors.length < 2) {
    grid.classList.remove('cmp-cols', 'cmp-cols-1', 'cmp-cols-2');
    // Une mesure dessinée en HTML (m.html, une silhouette) prend la place d'un canvas.
    grid.innerHTML = metrics.map(function(m) {
      return '<div class="chart-card">' + (m.html
        ? m.html(m.bars(sectors[0].dims, sectors[0].entry), m.title)
        : '<div class="chart-wrap injury-wrap"><canvas></canvas></div>') + '</div>';
    }).join('');
    metrics.forEach(function(m, i) {
      if (m.html) return;
      vs.injuryCharts.push((m.build || buildShareChart)(grid.children[i].querySelector('canvas'), m.title, m.bars(sectors[0].dims, sectors[0].entry), m.color));
    });
    return;
  }
  buildCompareColumns(grid, sectors, function(sec, idx, body) {
    if (!hasData(sec)) { body.innerHTML = '<p class="cmp-nodata">' + panel.empty + '</p>'; return; }
    // En comparaison, une mesure qu'un autre secteur renseigne garde sa place, pour que les
    // colonnes restent alignées, avec une mention à la place du graphique.
    body.innerHTML = metrics.map(function(m) {
      if (!m.bars(sec.dims, sec.entry).length) return '<div class="chart-wrap injury-wrap"><p class="cmp-nodata">Pas de données pour ce secteur sur « ' + m.title + ' ».</p></div>';
      return m.html ? '<div>' + m.html(m.bars(sec.dims, sec.entry), m.title) + '</div>' : '<div class="chart-wrap injury-wrap"><canvas></canvas></div>';
    }).join('');
    metrics.forEach(function(m, i) {
      if (m.html || !m.bars(sec.dims, sec.entry).length) return;
      vs.injuryCharts.push((m.build || buildShareChart)(body.children[i].querySelector('canvas'), m.title, m.bars(sec.dims, sec.entry), m.color));
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

  // La barre de la colonne Part se mesure au plus gros tableau, qui la remplit.
  var maxPct = Math.max.apply(null, active.map(function(d) { return d.pct || 0; })) || 1;
  var total = function(key) { return active.reduce(function(s, d) { return s + (d[key] || 0); }, 0); };
  var rows = active.map(function(d) {
    // L'alinéa 7 n'a pas de numéro de tableau, son libellé le nomme déjà.
    var code = d.code === 'HORS-TABLEAU' ? '-' : d.code;
    var bar = d.nb ? '<span class="dz-bar"><span style="width:' + Math.round((d.pct || 0) / maxPct * 100) + '%"></span></span>' : '';
    return '<tr><td class="dz-code">' + code + '</td>' +
      '<td class="dz-lib">' + (d.libelle || '') + '</td>' +
      '<td class="dz-nb">' + fmt(d.nb || 0) + '</td>' +
      '<td class="dz-pct">' + bar + (d.nb ? pctFr(d.pct || 0) : '-') + '</td>' +
      '<td class="dz-nb">' + fmt(d.ip || 0) + '</td>' +
      '<td class="dz-nb">' + fmt(d.deces || 0) + '</td>' +
      '<td class="dz-nb">' + fmt(d.journees || 0) + '</td></tr>';
  }).join('');
  viewEl(viewId, 'diseaseWrap').innerHTML =
    '<table class="disease-table"><thead><tr>' +
    '<th>Tableau</th><th>Maladie professionnelle</th><th>Cas</th><th>Part</th>' +
    '<th><span class="dz-long">Nouvelles </span>IP</th><th>Décès</th><th>Journées<span class="dz-long"> perdues</span></th>' +
    '</tr></thead><tbody>' + rows + '</tbody>' +
    '<tfoot><tr><td></td><td class="dz-lib">Total</td>' +
      '<td class="dz-nb">' + fmt(total('nb')) + '</td><td></td>' +
      '<td class="dz-nb">' + fmt(total('ip')) + '</td>' +
      '<td class="dz-nb">' + fmt(total('deces')) + '</td>' +
      '<td class="dz-nb">' + fmt(total('journees')) + '</td></tr></tfoot></table>';
}
