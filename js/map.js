/**
 * map.js — Phase 8: Coloration choroplèthe
 * Charge les données régionales et colorie les 21 caisses, les 16 métropolitaines
 * en place et les 5 ultramarines dans les encarts de gauche.
 */

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
export function colorierCarte(viewType, year, data, metricId = DEFAULT_METRIC) {
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
    renderRanking(viewType, getActiveYear(viewType), getActiveMetric(viewType));
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
    const read = readCaisse(caisse, viewType, metricId, year);

    if (!read) {
      tooltip.style.display = 'none';
      return;
    }

    const metric = METRICS[metricId] || METRICS[DEFAULT_METRIC];
    tooltip.innerHTML = `<span class="tooltip-name">${read.name}</span><span class="tooltip-val">${metric.label(viewType)} : ${metric.format(read.val)} (${year})</span>`;
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
    const read = readCaisse(caisse, viewType, metricId, year);
    if (!read) return;

    const metric = METRICS[metricId] || METRICS[DEFAULT_METRIC];
    panel.querySelector('.tap-panel-name').textContent = read.name;
    panel.querySelector('.tap-panel-metric').textContent = metric.label(viewType);
    panel.querySelector('.tap-panel-val').textContent = `${metric.format(read.val)} (${year})`;
    panel.classList.add('open');
    e.stopPropagation();
  });
}

/**
 * Vérifie que chaque caisse ID a au moins un élément [data-caisse] dans le DOM.
 */
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

    window.addEventListener('hashchange', () => closeTapPanel());
  } catch (err) {
    masquerCartes();
  }
});
