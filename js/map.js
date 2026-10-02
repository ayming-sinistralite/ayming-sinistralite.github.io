/**
 * map.js — Phase 8: Coloration choroplèthe
 * Charge les données régionales et colorie les 21 caisses, les 16 métropolitaines
 * en place et les 5 ultramarines dans les encarts de gauche.
 */

import { currentRoute } from './route.js?v=58f7592';

// Les 21 caisses ont un territoire tracé : les 16 métropolitaines en place, les 5
// ultramarines dans les encarts de la colonne de gauche du SVG.
const CAISSE_IDS = [
  'alsace-moselle', 'aquitaine', 'auvergne', 'bourgogne-franche-comte',
  'bretagne', 'centre-ouest', 'centre-val-de-loire', 'cramif',
  'languedoc-roussillon', 'midi-pyrenees', 'nord-est', 'nord-picardie',
  'normandie', 'pays-de-la-loire', 'rhone-alpes', 'sud-est',
  'cgss-guadeloupe', 'cgss-martinique', 'cgss-guyane', 'cgss-reunion', 'css-mayotte'
];

let regionalData = null;

const MIN_COLOR = '#deebf7';
const MAX_COLOR = '#08519c';
const DEFAULT_YEAR = '2024';
const DEFAULT_METRIC = 'count';

/**
 * Les deux lectures d'une caisse. Le nombre brut classe surtout les régions par effectif
 * salarié, l'indice de fréquence les classe par risque et se compare d'une caisse à l'autre.
 */
const METRICS = {
  count: {
    label: (viewType) => viewType === 'at' ? 'Accidents du travail' : 'Accidents de trajet',
    value: (caisse, field, year) => (caisse[field] || {})[year],
    format: (v) => Math.round(v).toLocaleString('fr-FR'),
  },
  if: {
    label: () => 'Indice de fréquence, sinistres pour 1 000 salariés',
    value: (caisse, field, year) => {
      const n = (caisse[field] || {})[year];
      const sal = (caisse.salaries || {})[year];
      return n != null && sal ? n / sal * 1000 : null;
    },
    format: (v) => v.toFixed(1).replace('.', ','),
  },
};

/**
 * Interpole linéairement entre deux couleurs hex.
 * @param {string} minColor - couleur hex minimale (ex: '#deebf7')
 * @param {string} maxColor - couleur hex maximale (ex: '#08519c')
 * @param {number} t - facteur d'interpolation, entre 0 et 1
 * @returns {string} couleur rgb interpolée
 */
function interpolateColor(minColor, maxColor, t) {
  const clamp = Math.min(1, Math.max(0, t));

  const parseHex = (hex) => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ];
  };

  const [r1, g1, b1] = parseHex(minColor);
  const [r2, g2, b2] = parseHex(maxColor);

  const r = Math.round(r1 + (r2 - r1) * clamp);
  const g = Math.round(g1 + (g2 - g1) * clamp);
  const b = Math.round(b1 + (b2 - b1) * clamp);

  return `rgb(${r},${g},${b})`;
}

/**
 * Génère la légende avec 5 paliers de couleur.
 * @param {string} legendElId - ID de l'élément conteneur de la légende
 * @param {number} minVal - valeur minimale
 * @param {number} maxVal - valeur maximale
 * @param {string} minColor - couleur hex minimale
 * @param {string} maxColor - couleur hex maximale
 */
function renderLegende(legendElId, minVal, maxVal, minColor, maxColor, label, format) {
  const el = document.getElementById(legendElId);
  if (!el) return;

  const steps = [0, 0.25, 0.5, 0.75, 1.0];
  const swatches = steps.map(t => {
    const color = interpolateColor(minColor, maxColor, t);
    const val = minVal + (maxVal - minVal) * t;
    return `<span class="legend-swatch" style="background:${color}" title="${format(val)}"></span>`;
  }).join('');

  const labelHtml = label ? `<span class="legend-label">${label}</span>` : '';
  el.innerHTML = `${labelHtml}<span class="legend-min">${format(minVal)}</span><div class="legend-swatches">${swatches}</div><span class="legend-max">${format(maxVal)}</span>`;
}

/**
 * Colorie la carte SVG avec un dégradé de couleur proportionnel aux données.
 * @param {string} viewType - 'at' ou 'trajet'
 * @param {string} year - année des données (ex: '2024')
 * @param {object} data - données régionales (regional-data.json)
 */
function colorierCarte(viewType, year, data, metricId = DEFAULT_METRIC) {
  const svgId = viewType === 'at' ? 'france-map-at' : 'france-map-trajet';
  const legendId = viewType === 'at' ? 'at-mapLegend' : 'trajet-mapLegend';
  const field = viewType === 'at' ? 'at' : 'trajet';
  const metric = METRICS[metricId] || METRICS[DEFAULT_METRIC];

  const svg = document.getElementById(svgId);
  if (!svg || !data) return;

  const caisses = data.caisses || [];

  const drawn = CAISSE_IDS.map(id => {
    const caisse = caisses.find(c => c.id === id);
    if (!caisse) return null;
    const val = metric.value(caisse, field, year);
    return val != null ? { id, val } : null;
  }).filter(Boolean);

  if (drawn.length === 0) return;

  const values = drawn.map(c => c.val);
  const min = Math.min(...values);
  const max = Math.max(...values);

  drawn.forEach(({ id, val }) => {
    const el = svg.querySelector(`[data-caisse="${id}"]`);
    if (!el) return;

    const t = min === max ? 0 : (val - min) / (max - min);
    el.style.fill = interpolateColor(MIN_COLOR, MAX_COLOR, t);
  });

  renderLegende(legendId, min, max, MIN_COLOR, MAX_COLOR, metric.label(viewType), metric.format);

  // La teinte ne se lit pas sans la vue : l'alternative textuelle dit la mesure, les deux
  // extrêmes, et renvoie au classement qui donne la valeur de chaque caisse.
  const name = (id) => { const c = caisses.find(x => x.id === id); return (c && c.name) || id; };
  const hi = drawn.reduce((a, b) => (b.val > a.val ? b : a));
  const lo = drawn.reduce((a, b) => (b.val < a.val ? b : a));
  svg.setAttribute('aria-label',
    `Carte de France par caisse régionale, ${metric.label(viewType).toLowerCase()} en ${year}. ` +
    `Le plus élevé : ${name(hi.id)}, ${metric.format(hi.val)}. Le plus bas : ${name(lo.id)}, ${metric.format(lo.val)}. ` +
    `Le classement voisin donne la valeur de chaque caisse.`);
}

/** État du tri par vue */
const sortState = { at: 'desc', trajet: 'desc' };

/** Retourne l'année active pour une vue depuis les pill buttons. */
function getActiveYear(viewType) {
  const container = document.getElementById(viewType + '-yearSelect');
  if (!container) return DEFAULT_YEAR;
  const active = container.querySelector('.year-pill.active');
  return active ? active.dataset.year : DEFAULT_YEAR;
}

/** Retourne la mesure active pour une vue, nombre brut ou indice de fréquence. */
function getActiveMetric(viewType) {
  const container = document.getElementById(viewType + '-metricSelect');
  if (!container) return DEFAULT_METRIC;
  const active = container.querySelector('.year-pill.active');
  return active ? active.dataset.metric : DEFAULT_METRIC;
}

/** Lit une caisse pour une vue, une mesure et une année. Retourne null si la donnée manque. */
function readCaisse(caisse, viewType, metricId, year) {
  const field = viewType === 'at' ? 'at' : 'trajet';
  const metric = METRICS[metricId] || METRICS[DEFAULT_METRIC];
  const val = metric.value(caisse, field, year);
  return val == null ? null : { id: caisse.id, name: caisse.name || caisse.id, val };
}

/**
 * Affiche le classement des caisses pour la vue, l'année et la mesure données.
 * @param {string} viewType - 'at' ou 'trajet'
 * @param {string} year - année des données (ex: '2024')
 * @param {string} metricId - 'count' ou 'if'
 */
function renderRanking(viewType, year, metricId = DEFAULT_METRIC) {
  const listEl = document.getElementById(viewType + '-rankingList');
  if (!listEl || !regionalData) return;

  const format = (METRICS[metricId] || METRICS[DEFAULT_METRIC]).format;

  // Les 21 caisses, toutes tracées sur la carte, dans un seul classement sur une seule
  // échelle de couleur, pour qu'une ligne porte la teinte de son territoire.
  const all = (regionalData.caisses || [])
    .map(c => readCaisse(c, viewType, metricId, year))
    .filter(Boolean);
  if (!all.length) return;

  const values = all.map(c => c.val);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const dir = sortState[viewType] === 'desc' ? -1 : 1;
  all.sort((a, b) => dir * (a.val - b.val));

  listEl.innerHTML = all.map((c, i) => {
    const t = min === max ? 0 : (c.val - min) / (max - min);
    const color = interpolateColor(MIN_COLOR, MAX_COLOR, t);
    const pct = Math.max(8, Math.round(t * 100));
    return `<li class="ranking-item" data-caisse="${c.id}">` +
      `<span class="ranking-fill" style="background:${color};width:${pct}%"></span>` +
      `<span class="ranking-pos">${i + 1}</span>` +
      `<span class="ranking-name">${c.name}</span>` +
      `<span class="ranking-val">${format(c.val)}</span></li>`;
  }).join('');
}

/**
 * Configure le bouton de tri pour inverser l'ordre du classement.
 * @param {string} viewType - 'at' ou 'trajet'
 */
function setupSortButton(viewType) {
  const btn = document.getElementById(viewType + '-sortBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    sortState[viewType] = sortState[viewType] === 'desc' ? 'asc' : 'desc';
    btn.innerHTML = sortState[viewType] === 'desc' ? '\u25BC' : '\u25B2';
    if (sectorView[viewType]) renderSectorRanking(viewType, sectorView[viewType].rows);
    else renderRanking(viewType, getActiveYear(viewType), getActiveMetric(viewType));
  });
}

/**
 * Configure la bascule nombre / indice de fr\u00E9quence.
 * @param {string} viewType - 'at' ou 'trajet'
 */
function setupMetricSelector(viewType) {
  const container = document.getElementById(viewType + '-metricSelect');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const pill = e.target.closest('.year-pill');
    if (!pill) return;
    container.querySelector('.year-pill.active')?.classList.remove('active');
    pill.classList.add('active');
    updateMap(viewType, getActiveYear(viewType), pill.dataset.metric);
  });
}

/**
 * Configure le sélecteur d'année pour mettre à jour la carte, la légende et le classement.
 * @param {string} viewType - 'at' ou 'trajet'
 */
function setupYearSelector(viewType) {
  const container = document.getElementById(viewType + '-yearSelect');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const pill = e.target.closest('.year-pill');
    if (!pill) return;
    container.querySelector('.year-pill.active')?.classList.remove('active');
    pill.classList.add('active');
    updateMap(viewType, pill.dataset.year, getActiveMetric(viewType));
  });
}

/**
 * Met à jour la carte, la légende et le classement pour la vue et l'année données.
 * @param {string} viewType - 'at' ou 'trajet'
 * @param {string} year - année des données (ex: '2024')
 */
function updateMap(viewType, year, metricId = DEFAULT_METRIC) {
  colorierCarte(viewType, year, regionalData, metricId);
  renderRanking(viewType, year, metricId);
}

/**
 * Configure le tooltip de survol pour une carte SVG.
 * Désactivé sur les appareils tactiles (reporté à la Phase 9).
 * @param {string} svgId - ID de l'élément SVG
 * @param {string} viewType - 'at' ou 'trajet'
 */
function setupTooltip(svgId, viewType) {
  if (navigator.maxTouchPoints > 0) return;

  const svg = document.getElementById(svgId);
  const tooltip = document.getElementById('mapTooltip');
  if (!svg || !tooltip) return;

  svg.addEventListener('mousemove', (e) => {
    const g = e.target.closest('[data-caisse]');
    if (!g) {
      tooltip.style.display = 'none';
      return;
    }

    const caisseId = g.dataset.caisse;
    const caisses = regionalData ? regionalData.caisses || [] : [];
    const caisse = caisses.find(c => c.id === caisseId);
    if (!caisse) {
      tooltip.style.display = 'none';
      return;
    }

    const year = getActiveYear(viewType);
    const metricId = getActiveMetric(viewType);
    const sec = sectorCaisseText(viewType, caisseId);
    const read = sec ? { name: sec.name } : readCaisse(caisse, viewType, metricId, year);

    if (!read) {
      tooltip.style.display = 'none';
      return;
    }

    const metric = METRICS[metricId] || METRICS[DEFAULT_METRIC];
    const val = sec ? sec.line : `${metric.label(viewType)} : ${metric.format(read.val)} (${year})`;
    tooltip.innerHTML = `<span class="tooltip-name">${read.name}</span><span class="tooltip-val">${val}</span>`;
    tooltip.style.display = 'block';

    let left = e.clientX + 12;
    let top = e.clientY + 12;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (left + tw > window.innerWidth - 8) left = e.clientX - tw - 12;
    if (left < 8) left = 8;
    if (top + th > window.innerHeight - 8) top = e.clientY - th - 12;
    if (top < 8) top = 8;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  });

  svg.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
}

/**
 * Lie les survols entre carte SVG et panneau de classement.
 * Hover sur la carte met en avant la ligne du classement (et inversement).
 * Les autres éléments sont atténués via la classe .map-dim sur le conteneur SVG.
 */
function setupLinkedHighlight(svgId, viewType) {
  const svg = document.getElementById(svgId);
  const rankingList = document.getElementById(viewType + '-rankingList');
  if (!svg || !rankingList) return;

  function highlight(caisseId) {
    svg.classList.add('map-dim');
    const g = svg.querySelector(`[data-caisse="${caisseId}"]`);
    if (g) g.classList.add('map-active');
    const li = rankingList.querySelector(`[data-caisse="${caisseId}"]`);
    if (li) li.classList.add('ranking-active');
  }

  function clear() {
    svg.classList.remove('map-dim');
    svg.querySelectorAll('.map-active').forEach(el => el.classList.remove('map-active'));
    rankingList.querySelectorAll('.ranking-active').forEach(el => el.classList.remove('ranking-active'));
  }

  svg.addEventListener('mouseover', (e) => {
    const g = e.target.closest('[data-caisse]');
    if (!g) { clear(); return; }
    clear();
    highlight(g.dataset.caisse);
  });
  svg.addEventListener('mouseleave', clear);

  rankingList.addEventListener('mouseover', (e) => {
    const li = e.target.closest('[data-caisse]');
    if (!li) { clear(); return; }
    clear();
    highlight(li.dataset.caisse);
  });
  rankingList.addEventListener('mouseleave', clear);
}

/**
 * Ferme le panneau tap mobile s'il est ouvert.
 */
function closeTapPanel() {
  const panel = document.getElementById('mapTapPanel');
  if (panel && panel.classList.contains('open')) {
    panel.classList.remove('open');
  }
}

/**
 * Configure le panneau tap mobile pour une carte SVG.
 * Activé uniquement sur les appareils tactiles (navigator.maxTouchPoints > 0).
 * @param {string} svgId - ID de l'élément SVG
 * @param {string} viewType - 'at' ou 'trajet'
 */
function setupTapPanel(svgId, viewType) {
  if (navigator.maxTouchPoints === 0) return;

  const svg = document.getElementById(svgId);
  const panel = document.getElementById('mapTapPanel');
  if (!svg || !panel) return;

  svg.addEventListener('click', (e) => {
    const g = e.target.closest('[data-caisse]');
    if (!g) return;

    const caisseId = g.dataset.caisse;
    const caisses = regionalData ? regionalData.caisses || [] : [];
    const caisse = caisses.find(c => c.id === caisseId);
    if (!caisse) return;

    const year = getActiveYear(viewType);
    const metricId = getActiveMetric(viewType);
    const sec = sectorCaisseText(viewType, caisseId);
    const read = sec ? { name: sec.name } : readCaisse(caisse, viewType, metricId, year);
    if (!read) return;

    const metric = METRICS[metricId] || METRICS[DEFAULT_METRIC];
    panel.querySelector('.tap-panel-name').textContent = read.name;
    panel.querySelector('.tap-panel-metric').textContent = sec ? 'Salariés du secteur' : metric.label(viewType);
    panel.querySelector('.tap-panel-val').textContent = sec ? sec.line : `${metric.format(read.val)} (${year})`;
    panel.classList.add('open');
    e.stopPropagation();
  });
}

/**
 * Vérifie que chaque caisse ID a au moins un élément [data-caisse] dans le DOM.
 */
/**
 * Les deux cartes partagent un même tracé, assets/france-map.svg, chargé ici plutôt que recopié
 * dans app.html : chaque page publiée (une par secteur) pèse ainsi 95 Ko de moins.
 */
async function chargerCarteSVG() {
  const res = await fetch('assets/france-map.svg');
  if (!res.ok) throw new Error(`france-map.svg: HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  for (const id of ['france-map-at', 'france-map-trajet']) {
    const svg = document.getElementById(id);
    if (svg) svg.append(...Array.from(doc.documentElement.childNodes, (n) => document.importNode(n, true)));
  }
}

function verifierStructureSVG() {
  const manquants = [];

  CAISSE_IDS.forEach(id => {
    const els = document.querySelectorAll(`[data-caisse="${id}"]`);
    if (els.length === 0) manquants.push(id);
  });

  // Le cas nominal est silencieux, seule une caisse manquante mérite un signal.
  if (manquants.length > 0) {
    console.warn('[map.js] Caisses manquantes dans le SVG:', manquants);
  }
}

/* ── Carte d'un secteur ──────────────────────────────────────────────────────
 * Quand un secteur est choisi (vue AT ou Trajet), la carte montre où il emploie
 * ses salariés : chaque caisse est teintée par l'écart entre sa part des salariés du secteur
 * et sa part de tous les salariés (data/regional-sector.json, chargé à la première demande).
 * Ce sont des salariés, pas des accidents. Un secret statistique reste masqué, jamais zéro. */

let sectorData = null;
let sectorPromise = null;
const sectorView = { at: null, trajet: null };
const SECTOR_LEVELS = ['by_naf5', 'by_naf4', 'by_naf2', 'by_naf1'];
const SECTOR_BAND_TITLE = 'Où travaillent les salariés du secteur';
// Un indice de 2 (la caisse pèse deux fois plus dans le secteur que dans l'ensemble) donne la teinte pleine.
const INDEX_FULL = 2;

function loadSectorData() {
  if (!sectorPromise) {
    sectorPromise = fetch('data/regional-sector.json')
      .then((res) => {
        if (!res.ok) throw new Error(`regional-sector.json: HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => { sectorData = d; return d; })
      .catch((err) => { sectorPromise = null; throw err; });
  }
  return sectorPromise;
}

/** Le secteur de l'adresse (/accidents-du-travail/<code>-..., ancienne ancre comprise). Null sans secteur. */
function sectorCodeFromRoute() {
  const route = currentRoute();
  return ['at', 'trajet', 'mp'].includes(route.view) ? route.code : null;
}

function sectorEntry(code) {
  if (!sectorData || !code) return null;
  for (const level of SECTOR_LEVELS) {
    const entry = (sectorData[level] || {})[code];
    if (entry) return entry;
  }
  return null;
}

/** Part de chaque caisse dans l'ensemble des salariés, depuis la carte nationale. */
function allSalariesShares(year) {
  const caisses = (regionalData && regionalData.caisses) || [];
  const total = caisses.reduce((sum, c) => sum + ((c.salaries || {})[year] || 0), 0);
  const out = {};
  caisses.forEach((c) => { out[c.id] = total ? ((c.salaries || {})[year] || 0) / total : 0; });
  return out;
}

function formatPct(v) {
  if (v > 0 && v < 0.001) return '< 0,1 %';
  return (v * 100).toFixed(1).replace('.', ',') + ' %';
}

/** Teinte d'un indice, en tokens CSS seulement : de l'arrière-plan de la carte vers l'accent. */
function indexColor(index) {
  const t = Math.min(1, Math.max(0, index / INDEX_FULL));
  return `color-mix(in srgb, var(--accent) ${Math.round(10 + 90 * t)}%, var(--bg-elevated))`;
}

/** Une ligne par caisse : part du secteur, part de tous les salariés, indice ou null si masquée. */
function sectorRows(entry, year) {
  const all = allSalariesShares(year);
  return CAISSE_IDS.map((id) => {
    const caisse = (regionalData.caisses || []).find((c) => c.id === id);
    const share = (entry.caisses || {})[id];
    const hidden = share == null;
    return {
      id,
      name: (caisse && caisse.name) || id,
      share: hidden ? null : share,
      all: all[id],
      index: hidden || !all[id] ? null : share / all[id],
      hidden,
    };
  });
}

/** Le texte du survol ou du panneau tactile d'une caisse en mode secteur, sans balise. */
function sectorCaisseText(viewType, caisseId) {
  const view = sectorView[viewType];
  if (!view) return null;
  const row = view.rows.find((r) => r.id === caisseId);
  if (!row) return null;
  const line = row.hidden
    ? 'Secret statistique, les salariés du secteur ne sont pas publiés dans cette caisse'
    : `${formatPct(row.share)} des salariés du secteur, contre ${formatPct(row.all)} de l'ensemble des salariés`;
  return { name: row.name, line };
}

function sectorHeadline(rows) {
  const visible = rows.filter((r) => !r.hidden);
  if (!visible.length) {
    return 'Aucune caisse ne publie les salariés de ce secteur, ils relèvent du secret statistique.';
  }
  const top = visible.reduce((a, b) => (b.share > a.share ? b : a));
  // Les caisses masquées se partagent le reste du secteur : si ce reste dépasse la première
  // caisse publiée, l'une d'elles pourrait la devancer, on ne l'affirme pas.
  const hiddenMass = Math.max(0, 1 - visible.reduce((sum, r) => sum + r.share, 0));
  const lead = hiddenMass > top.share
    ? 'Parmi les caisses qui publient, le secteur emploie le plus de salariés en '
    : 'Le secteur emploie le plus de salariés en ';
  return `${lead}${top.name} (${formatPct(top.share)} des salariés du secteur).`;
}

function ensureHatch(svg, viewType) {
  const id = `map-hatch-${viewType}`;
  if (svg.querySelector('#' + id)) return id;
  svg.insertAdjacentHTML('afterbegin',
    `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    '<rect class="hatch-bg" width="6" height="6"/><line class="hatch-line" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>');
  return id;
}

function renderSectorRanking(viewType, rows) {
  const listEl = document.getElementById(viewType + '-rankingList');
  if (!listEl) return;
  const dir = sortState[viewType] === 'desc' ? -1 : 1;
  const shown = rows.filter((r) => !r.hidden).sort((a, b) => dir * (a.share - b.share));
  const hidden = rows.filter((r) => r.hidden);
  const max = Math.max(...shown.map((r) => r.share), 0);
  listEl.innerHTML = shown.map((r, i) => {
    const pct = max ? Math.max(8, Math.round(r.share / max * 100)) : 8;
    return `<li class="ranking-item" data-caisse="${r.id}">` +
      `<span class="ranking-fill" style="background:${indexColor(r.index)};width:${pct}%"></span>` +
      `<span class="ranking-pos">${i + 1}</span>` +
      `<span class="ranking-name">${r.name}</span>` +
      `<span class="ranking-val">${formatPct(r.share)}</span></li>`;
  }).join('') + hidden.map((r) =>
    `<li class="ranking-item ranking-hidden" data-caisse="${r.id}">` +
    `<span class="ranking-pos">-</span><span class="ranking-name">${r.name}</span>` +
    '<span class="ranking-val">secret statistique</span></li>').join('');
}

function renderSectorLegend(viewType) {
  const el = document.getElementById(viewType + '-mapLegend');
  if (!el) return;
  const swatches = [0, 0.5, 1, 1.5, 2].map((i) =>
    `<span class="legend-swatch" style="background:${indexColor(i)}"></span>`).join('');
  el.innerHTML = '<span class="legend-label">Poids du secteur dans la caisse</span>' +
    '<span class="legend-min">Moins que la moyenne</span>' +
    `<div class="legend-swatches">${swatches}</div>` +
    '<span class="legend-max">Plus que la moyenne</span>' +
    '<span class="legend-hidden-key"><span class="legend-swatch legend-swatch-hidden"></span>Secret statistique</span>';
}

function sectorNote(year, code) {
  let text = `La carte compte les salariés du secteur en ${year}, pas les accidents. Chaque caisse est teintée ` +
    'par la part des salariés du secteur qu\'elle porte, comparée à sa part de l\'ensemble des salariés. ' +
    'Les parts se calculent sur le total publié du secteur.';
  if (code.length === 4 || code.length === 2) {
    text += ' Pour ce niveau, une caisse reste masquée dès que l\'un de ses codes NAF 5 l\'est.';
  }
  return text;
}

/** Bascule une carte en mode secteur : teintes, légende, classement, titre et note. */
function showSectorMap(viewType, code, entry) {
  const section = document.getElementById(viewType + '-mapSection');
  const svg = document.getElementById(viewType === 'at' ? 'france-map-at' : 'france-map-trajet');
  if (!section || !svg) return;
  const year = (sectorData.meta && sectorData.meta.year) || DEFAULT_YEAR;
  const rows = sectorRows(entry, year);
  sectorView[viewType] = { rows };

  const hatch = ensureHatch(svg, viewType);
  rows.forEach((r) => {
    const el = svg.querySelector(`[data-caisse="${r.id}"]`);
    if (!el) return;
    el.style.fill = r.hidden ? `url(#${hatch})` : indexColor(r.index);
  });

  const headline = sectorHeadline(rows);
  document.getElementById(viewType + '-mapHeadline').textContent = headline;
  document.getElementById(viewType + '-mapNote').textContent = sectorNote(year, code);
  const title = section.parentElement.querySelector('.band-title');
  if (title) {
    if (!title.dataset.national) title.dataset.national = title.textContent;
    title.textContent = SECTOR_BAND_TITLE;
  }
  svg.setAttribute('aria-label', `Carte de France par caisse régionale, salariés du secteur en ${year}. ${headline} ` +
    'Le classement voisin donne la part de chaque caisse.');
  renderSectorLegend(viewType);
  renderSectorRanking(viewType, rows);
  section.classList.add('map-sector');
  section.style.display = '';
}

/** Rétablit la carte nationale, identique à celle d'avant la sélection d'un secteur. */
function showNationalMap(viewType) {
  const section = document.getElementById(viewType + '-mapSection');
  if (!section) return;
  const wasSector = section.classList.contains('map-sector');
  sectorView[viewType] = null;
  section.style.display = '';
  if (!wasSector) return;
  section.classList.remove('map-sector');
  const title = section.parentElement.querySelector('.band-title');
  if (title && title.dataset.national) title.textContent = title.dataset.national;
  const note = document.getElementById(viewType + '-mapNote');
  if (note && note.dataset.national) note.textContent = note.dataset.national;
  updateMap(viewType, getActiveYear(viewType), getActiveMetric(viewType));
}

/** Aligne les deux cartes sur le secteur de l'adresse. Sans secteur, la carte nationale. */
function syncMapWithRoute() {
  const code = sectorCodeFromRoute();
  ['at', 'trajet'].forEach((viewType) => {
    const section = document.getElementById(viewType + '-mapSection');
    if (!section) return;
    const note = document.getElementById(viewType + '-mapNote');
    if (note && !note.dataset.national) note.dataset.national = note.textContent;
    if (!code) { showNationalMap(viewType); return; }
    const hide = () => { sectorView[viewType] = null; section.style.display = 'none'; };
    loadSectorData().then(() => {
      // L'adresse a pu changer pendant le chargement.
      if (sectorCodeFromRoute() !== code) return;
      const entry = sectorEntry(code);
      // Aucune donnée publiée pour ce secteur : la carte se masque, comme avant.
      if (entry) showSectorMap(viewType, code, entry);
      else hide();
    }).catch(hide);
  });
}

/**
 * Charge les données régionales depuis le fichier JSON.
 */
async function loadRegionalData() {
  const res = await fetch('data/regional-data.json');
  if (!res.ok) throw new Error(`regional-data.json: HTTP ${res.status}`);
  regionalData = await res.json();
}

/**
 * Masque les cartes régionales. Le reste de l'application (KPI, graphiques,
 * recherche) reste pleinement utilisable sans elles.
 */
function masquerCartes() {
  ['at-mapSection', 'trajet-mapSection'].forEach((id) => {
    const section = document.getElementById(id);
    if (section) section.style.display = 'none';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await chargerCarteSVG();
    verifierStructureSVG();
    await loadRegionalData();
    colorierCarte('at', DEFAULT_YEAR, regionalData);
    colorierCarte('trajet', DEFAULT_YEAR, regionalData);
    renderRanking('at', DEFAULT_YEAR);
    renderRanking('trajet', DEFAULT_YEAR);
    setupTooltip('france-map-at', 'at');
    setupTooltip('france-map-trajet', 'trajet');
    setupYearSelector('at');
    setupYearSelector('trajet');
    setupMetricSelector('at');
    setupMetricSelector('trajet');
    setupSortButton('at');
    setupSortButton('trajet');
    setupLinkedHighlight('france-map-at', 'at');
    setupLinkedHighlight('france-map-trajet', 'trajet');
    setupTapPanel('france-map-at', 'at');
    setupTapPanel('france-map-trajet', 'trajet');

    const closeBtn = document.querySelector('#mapTapPanel .tap-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', () => closeTapPanel());

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('mapTapPanel');
      if (panel && panel.classList.contains('open') && !panel.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    window.addEventListener('routechange', () => { closeTapPanel(); syncMapWithRoute(); });
    syncMapWithRoute();
  } catch (err) {
    masquerCartes();
  }
});
