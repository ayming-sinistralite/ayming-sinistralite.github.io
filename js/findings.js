// ── Graphiques qui disent leur constat face au national ──
// Partagés par les vues sectorielles : history.js (journées d'arrêt, circonstances, courbes),
// charts.js (panneaux de parts, démographie) et body.js (silhouettes). Une entrée porte sa
// valeur et, quand elle est connue, la valeur nationale en nat.

import { fmt, pctFr, themeColor, wrapLabel } from './utils.js?v=36466a3';
import { SMALL_SAMPLE, SMALL_SECTOR } from './route.js?v=36466a3';

// ── Accessibilité : alternative textuelle des canvas de graphique ──
// Un <canvas> est opaque aux lecteurs d'écran, on lui donne un rôle et une phrase de résumé.
export function describeCanvas(canvas, label) {
  if (!canvas) return;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
}

// Les infobulles au clavier : un canvas de graphique reçoit le focus (Tab), les flèches gauche et
// droite (haut et bas sur des barres horizontales) parcourent les éléments et Échap efface.
// Un plugin Chart.js global, enregistré une fois par initNav, donc valable pour chaque graphique.
// Un graphique sans infobulle (le rapport papier) reste hors du parcours de Tab.
export var CHART_KEYBOARD = {
  id: 'keyboardTooltip',
  afterInit: function(chart) {
    var tip = chart.options.plugins && chart.options.plugins.tooltip;
    if (tip && tip.enabled === false) return;
    var canvas = chart.canvas, at = -1;
    var count = function() { return (chart.data.labels || []).length || (chart.data.datasets[0] ? chart.data.datasets[0].data.length : 0); };
    var show = function() {
      var els = [];
      chart.data.datasets.forEach(function(ds, d) {
        var m = chart.getDatasetMeta(d);
        if (m.hidden || !m.data[at]) return;
        els.push({ datasetIndex: d, index: at });
      });
      var first = els.length && chart.getDatasetMeta(els[0].datasetIndex).data[at];
      chart.setActiveElements(els);
      chart.tooltip.setActiveElements(els, first ? { x: first.x, y: first.y } : { x: 0, y: 0 });
      chart.update('none');
    };
    var clear = function() {
      at = -1;
      chart.setActiveElements([]);
      chart.tooltip.setActiveElements([], { x: 0, y: 0 });
      chart.update('none');
    };
    var horizontal = chart.options.indexAxis === 'y';
    var onKey = function(e) {
      var n = count(), k = e.key, step = 0;
      if (k === 'ArrowRight' || (horizontal && k === 'ArrowDown')) step = 1;
      else if (k === 'ArrowLeft' || (horizontal && k === 'ArrowUp')) step = -1;
      else if (k === 'Escape' && at >= 0) { clear(); e.preventDefault(); return; }
      if (!step || !n) return;
      e.preventDefault();
      at = at < 0 ? (step > 0 ? 0 : n - 1) : (at + step + n) % n;
      show();
    };
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('blur', clear);
    chart._kbOff = function() { canvas.removeEventListener('keydown', onKey); canvas.removeEventListener('blur', clear); };
  },
  beforeDestroy: function(chart) { if (chart._kbOff) chart._kbOff(); }
};

// Les jeux de données ne publient pas de ligne nationale. Sommer tous les secteurs d'un même
// niveau en tient lieu : records est une liste d'objets { dimension: { modalité: effectif } },
// seules les dimensions en effectifs sont sommées (une liste, les maladies MP, est ignorée).
export function nationalSum(records) {
  var out = {};
  records.forEach(function(r) {
    Object.keys(r || {}).forEach(function(dim) {
      var block = r[dim];
      if (!block || typeof block !== 'object' || Array.isArray(block)) return;
      var sum = out[dim] || (out[dim] = {});
      Object.keys(block).forEach(function(k) { if (typeof block[k] === 'number') sum[k] = (sum[k] || 0) + block[k]; });
    });
  });
  return out;
}

// Une valeur du secteur n'est signalée qu'à 10 % au moins au-dessus du national, et d'au
// moins un point (ou un jour), pour que la couleur désigne un vrai écart et pas un arrondi :
// une part de 4,4 % contre 3,9 % passe les 10 % mais s'écrit « 4 % contre 4 % ».
var ABOVE = 1.1;
var MIN_GAP = 1;
export function isWorse(v, nat) { return nat != null && v != null && v > nat * ABOVE && v - nat >= MIN_GAP; }

// Infobulle d'une barre de l'entonnoir : sa part de la dernière étape (base). Sans base, le compte
// seul ; au-delà de la base (une IP peut porter sur une maladie d'une année passée), les deux comptes.
export function funnelTip(v, base, label) {
  if (!base) return fmt(v);
  if (v > base) return fmt(v) + ' pour ' + fmt(base) + ' ' + label;
  return pctFr(v / base * 100) + ' des ' + label;
}

// Bande de gravité de Virginie : 1,1 est le seuil de isWorse (le badge rouge), 0,9 son symétrique.
export function sevBandOf(ifRatio) {
  return ifRatio >= 3 ? 'severe' : ifRatio >= 1.6 ? 'high' : ifRatio >= 1.1 ? 'elevated' : ifRatio >= 0.8 ? 'moderate' : 'low';
}

// Rang de l'année choisie dans l'historique : le filtre d'année n'existe qu'au niveau NAF 5.
export function historyYearAt(years, year, level) {
  var at = year && level === 'naf5' ? years.indexOf(Number(year)) : years.length - 1;
  return at < 0 ? years.length - 1 : at;
}

// Les dix secteurs à l'indice de fréquence le plus haut, parmi ceux que le verdict du titre accepte.
export function topSectors(store, eventKey) {
  return Object.keys(store)
    .map(function(c) { var st = store[c].stats; return { code: c, libelle: store[c].libelle, if_val: st.indice_frequence, events: st[eventKey] || 0, sal: st.nb_salaries || 0 }; })
    .filter(function(r) { return r.events >= SMALL_SAMPLE && r.sal >= SMALL_SECTOR; })
    .sort(function(a, b) { return b.if_val - a.if_val; })
    .slice(0, 10);
}

// Le champ de recherche montre « code · libellé » du secteur affiché : ce texte n'est pas une saisie.
export function isShownText(q, shown) { return !!q && q === shown; }

// ── Titres qui disent le constat ──
// Le titre d'un graphique énonce l'écart le plus net avec le national, le sous-titre garde
// le sujet. Chart.js ne coupe pas un titre, wrap le fait.

// Les lignes sont équilibrées, pour ne pas laisser un mot seul sous le titre.
export function wrap(text, max) {
  var lines = [], line = '';
  var width = Math.ceil(text.length / Math.ceil(text.length / max)) + 4;
  text.split(' ').forEach(function(w) {
    if (line && (line + ' ' + w).length > width) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  });
  if (line) lines.push(line);
  return lines;
}

// « contre 26,4 au national », ou « comme au national » quand les deux s'écrivent pareil.
export function versus(cur, nat, format) {
  return format(cur) === format(nat) ? ', comme au national' : ', contre ' + format(nat) + ' au national';
}

export function short(label, max) {
  return label.length > max ? label.slice(0, max - 1).trimEnd() + '…' : label;
}

function worstDays(entries) {
  return entries.filter(function(d) { return isWorse(d.value, d.nat); })
    .sort(function(a, b) { return b.value / b.nat - a.value / a.nat; })[0];
}

export function worstShare(entries) {
  return entries.filter(function(d) { return isWorse(d.pct, d.nat); })
    .sort(function(a, b) { return (b.pct - b.nat) - (a.pct - a.nat); })[0];
}

function daysFinding(entries, full) {
  var worst = worstDays(entries);
  if (worst) return (full ? worst.label : short(worst.label, 40)) + ', ' + fmt(worst.value) + ' jours par sinistre contre ' + fmt(worst.nat) + ' au national';
  return entries.some(function(d) { return d.nat != null; }) ? 'Aucune durée nettement au-dessus du national' : null;
}

export function sharesFinding(entries, full) {
  var worst = worstShare(entries);
  if (worst) return (full ? worst.label : short(worst.label, 40)) + ', ' + pctFr(worst.pct, 0) + ' des sinistres contre ' + pctFr(worst.nat, 0) + ' au national';
  // Sans part nationale connue, le graphique garde son sujet pour titre.
  return entries.some(function(d) { return d.nat != null; }) ? 'Une répartition proche du national' : null;
}

// ── Graphiques propres à ces panneaux ──

export function tooltipStyle() {
  return { backgroundColor: themeColor('--chart-tooltip-bg'), borderColor: themeColor('--border'), borderWidth: 1,
    titleColor: themeColor('--text'), bodyColor: themeColor('--text-secondary'), cornerRadius: 6, padding: 10 };
}

// Dans l'outil, le titre reste le sujet : le constat est lu par Virginie (registre plus bas)
// et par les lecteurs d'écran. Le rapport PDF pourra afficher finding en titre.
export function titleStyle(finding, topic) {
  var text = topic || finding;
  return { display: !!text, text: text ? wrap(text, 52) : '', color: themeColor('--text-secondary'), font: { size: 13, weight: '600' }, padding: { bottom: 8 } };
}

export function subtitleStyle() {
  return { display: false };
}

// ── Registre des constats, lu par Virginie ──
// Chaque graphique qui trouve un écart net avec le national le note ici, pour sa vue. Virginie
// en tire ses écarts les plus forts et l'offre qui répond à chacun (js/assistant.js). En
// comparaison, seule la colonne du secteur courant compte.
var NOTES = {};

export function resetFindings(viewId) { NOTES[viewId] = []; }

// Un même graphique redessiné (changement de thème) ne compte qu'une fois.
export function readFindings(viewId) {
  var seen = {};
  return (NOTES[viewId] || []).filter(function(n) {
    var key = n.section + '|' + n.text;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

// target : l'élément du graphique (sa vue et sa section s'en déduisent) ou un identifiant de vue.
// note : { section, kind, topic, text, ratio }, ratio étant secteur / national.
export function noteFinding(target, note) {
  var viewId = target, section = note.section;
  if (typeof target !== 'string') {
    var col = target.closest('.cmp-col');
    if (col && col.parentElement.firstElementChild !== col) return;
    var view = target.closest('.view');
    var sec = target.closest('[id$="Section"]');
    if (!view) return;
    viewId = view.id.replace(/^view-/, '');
    section = section || (sec ? sec.id.replace(viewId + '-', '') : '');
  }
  (NOTES[viewId] || (NOTES[viewId] = [])).push(Object.assign({}, note, { section: section }));
}

// Rouge là où le secteur dépasse nettement le national, bleu ailleurs. Le gris reste au national.
function worseColors(entries, key) {
  var hot = themeColor('--danger'), calm = themeColor('--accent');
  return entries.map(function(d) { return isWorse(d[key], d.nat) ? hot : calm; });
}

// Le rouge ne porte pas seul le « pire que le national » : la barre en rouge s'ouvre sur un
// ▲ et l'écart en pourcent, lisible aussi en niveaux de gris, à l'impression et par un daltonien.
function worseTag(entries, key) {
  return {
    display: function(ctx) { var d = entries[ctx.dataIndex]; return isWorse(d[key], d.nat); },
    formatter: function(v, ctx) { var d = entries[ctx.dataIndex]; return '\u25B2 +' + Math.round((d[key] / d.nat - 1) * 100) + '\u00A0%'; },
    anchor: 'end', align: 'end', offset: 4, clip: false,
    color: themeColor('--danger-text'), font: { size: 11, weight: '700', family: "'Lato', sans-serif" }
  };
}

// La place à droite des barres pour l'étiquette de worseTag.
var TAG_ROOM = { right: 62 };

function barScales(labels, tickFormat) {
  var tickColor = themeColor('--text-dim');
  return {
    x: { beginAtZero: true, ticks: { color: tickColor, callback: tickFormat }, grid: { color: themeColor('--border') } },
    y: { ticks: { color: tickColor, font: { size: 11 }, callback: function(v, i) { return wrapLabel(labels[i], 22); } }, grid: { display: false } }
  };
}

// Barres horizontales en jours par sinistre, un trait sombre marque le national.
export function buildDaysChart(canvas, title, entries) {
  var labels = entries.map(function(d) { return d.label; });
  var finding = daysFinding(entries);
  var worst = worstDays(entries);
  if (worst) noteFinding(canvas, { kind: 'days', topic: title, text: daysFinding(entries, true), ratio: worst.value / worst.nat });
  if (entries.length) {
    describeCanvas(canvas, title + '. ' + (finding ? finding + '.' : 'En tête ' + entries[0].label.toLowerCase() + ' avec ' + entries[0].value + ' jours par sinistre.'));
  }
  var ink = themeColor('--text');
  return new Chart(canvas, {
    type: 'bar',
    plugins: [ChartDataLabels],
    data: { labels: labels, datasets: [
      { data: entries.map(function(d) { return d.value; }), backgroundColor: worseColors(entries, 'value'), borderRadius: 3, order: 1,
        datalabels: worseTag(entries, 'value') },
      { type: 'line', showLine: false, order: 0, data: entries.map(function(d) { return d.nat == null ? null : { x: d.nat, y: d.label }; }),
        pointStyle: 'line', rotation: 90, pointRadius: 9, pointHoverRadius: 9, borderWidth: 2.5, pointBorderColor: ink, borderColor: ink, backgroundColor: ink }
    ] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: TAG_ROOM },
      interaction: { mode: 'index', axis: 'y', intersect: false },
      plugins: {
        legend: { display: false }, datalabels: { display: false },
        title: titleStyle(finding, title), subtitle: subtitleStyle(finding, title),
        tooltip: Object.assign(tooltipStyle(), { callbacks: {
          title: function(c) { return labels[c[0].dataIndex]; },
          label: function(c) {
            var d = entries[c.dataIndex];
            return c.datasetIndex ? ' National, ' + fmt(d.nat) + ' jours' : ' ' + fmt(d.value) + ' jours par sinistre, sur ' + fmt(d.n) + ' sinistres';
          }
        } })
      },
      scales: barScales(labels, function(v) { return v + ' j'; })
    }
  });
}

// Part des sinistres par circonstance, la barre pâle derrière chacune est la part nationale.
export function buildShareChart(canvas, title, entries) {
  var labels = entries.map(function(d) { return d.label; });
  var finding = sharesFinding(entries);
  var worst = worstShare(entries);
  if (worst) noteFinding(canvas, { kind: 'share', topic: title, text: sharesFinding(entries, true), ratio: worst.pct / worst.nat });
  if (entries.length) describeCanvas(canvas, title + '.' + (finding ? ' ' + finding + '.' : ''));
  return new Chart(canvas, {
    type: 'bar',
    plugins: [ChartDataLabels],
    data: { labels: labels, datasets: [
      { data: entries.map(function(d) { return d.pct; }), backgroundColor: worseColors(entries, 'pct'), borderRadius: 3,
        grouped: false, barPercentage: 0.55, order: 1, datalabels: worseTag(entries, 'pct') },
      { data: entries.map(function(d) { return d.nat; }), backgroundColor: themeColor('--border'), borderColor: themeColor('--c-8'), borderWidth: 1.5, borderRadius: 3,
        grouped: false, barPercentage: 0.95, order: 2 }
    ] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: TAG_ROOM },
      interaction: { mode: 'index', axis: 'y', intersect: false },
      plugins: {
        legend: { display: false }, datalabels: { display: false },
        title: titleStyle(finding, title), subtitle: subtitleStyle(finding, title),
        tooltip: Object.assign(tooltipStyle(), { callbacks: {
          title: function(c) { return labels[c[0].dataIndex]; },
          label: function(c) { return (c.datasetIndex ? ' National, ' : ' Secteur, ') + pctFr(c.parsed.x); }
        } })
      },
      scales: barScales(labels, function(v) { return pctFr(v, 0); })
    }
  });
}
