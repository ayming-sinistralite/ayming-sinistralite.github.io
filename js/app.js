// ── App entry point ──

import { loadDataset, getData, getStore } from './data.js';
import { state, VIEW_CONFIG } from './state.js';
import { el, viewEl, splitCompareCodes } from './utils.js';
import { initNav, switchView } from './nav.js';
import { setupSearch, selectCode, setLevel, clearSelection } from './search.js';
import { renderKPIs, renderNationalState } from './kpi.js';
import { renderCausesChart, renderFunnelChart, renderPositionStrip, renderComparisonChart, setupCompToggle, renderEvolutionCharts, renderDemographics, renderSizeChart, renderPanels, renderDiseaseTable } from './charts.js';
import { toggleShare, copyLink } from './insights.js';
import { initAssistant, setAssistantContext, toggleAssistant, closeAssistant, isAssistantOpen } from './assistant.js';
import { initCompare } from './compare.js';
import { initInlineCompare, renderInline, hideInlineBar } from './compare-inline.js';
import { SECTOR_COLORS } from './compare.js';
import { loadCtnMap } from './cost-model.js';

// Données "taille d'établissement" (AT uniquement, extrait des fiches PDF)
var sizeData = {};
async function loadSizeData() {
  try {
    var resp = await fetch('./data/size-data.json');
    if (resp.ok) sizeData = await resp.json();
  } catch (e) { /* données taille optionnelles */ }
}

// Dimensions textuelles (siège des lésions, activité, modalité, maladies MP) par NAF5
var extraData = {};
async function loadExtraData() {
  try {
    var resp = await fetch('./data/extra-dimensions.json');
    if (resp.ok) extraData = await resp.json();
  } catch (e) { /* dimensions optionnelles */ }
}

// Event listeners for drawer buttons (all views)
function attachDrawerListeners() {
  // Les boutons « insights » (icône étincelles) ouvrent désormais l'assistant Virginie.
  ['insightsBtn', 'mp-insightsBtn', 'trajet-insightsBtn'].forEach(function(id) {
    var btn = el(id);
    if (btn) btn.addEventListener('click', toggleAssistant);
  });
  ['shareBtn', 'mp-shareBtn', 'trajet-shareBtn'].forEach(function(id) {
    var btn = el(id);
    if (btn) btn.addEventListener('click', function() { toggleShare(); });
  });
  var closeShare = el('shareCloseBtn');
  if (closeShare) closeShare.addEventListener('click', toggleShare);
  var copyBtn = el('copyLinkBtn');
  if (copyBtn) copyBtn.addEventListener('click', copyLink);
}

// ── Render orchestration ──
function render(viewId, code, level) {
  var data = getData(viewId);
  var cfg = VIEW_CONFIG[viewId];
  var store = getStore(viewId, level);
  var entry = store[code];
  if (!entry) return;

  viewEl(viewId, 'emptyState').style.display = 'none';
  // Un rendu annule toute sortie en cours, sinon .leaving masquerait ce rendu.
  viewEl(viewId, 'results').classList.remove('leaving');
  viewEl(viewId, 'results').classList.add('visible');
  var mapSec = viewEl(viewId, 'mapSection');
  if (mapSec) mapSec.style.display = 'none';

  var s = entry.stats;
  var nat = data.meta.national;

  viewEl(viewId, 'selTitle').textContent = code + ' // ' + entry.libelle;
  var levelLabel = level === 'naf5' ? 'Code NAF' : level === 'naf4' ? 'Sous-classe NAF' : 'Division NAF';
  var subText = levelLabel;
  if (entry.codes_naf5) subText += ' // ' + entry.codes_naf5.length + ' codes NAF agrégés';
  viewEl(viewId, 'selSub').textContent = subText;

  // Breadcrumb
  var bc = viewEl(viewId, 'breadcrumb');
  var crumbs = [];
  var naf2code = code.substring(0, 2);
  var naf4code = code.substring(0, 4);
  var naf2entry = data.by_naf2[naf2code];
  var naf4entry = data.by_naf4[naf4code];
  if (level === 'naf5') {
    if (naf2entry) crumbs.push({ code: naf2code, label: naf2code + ' ' + naf2entry.libelle, level: 'naf2' });
    if (naf4entry) crumbs.push({ code: naf4code, label: naf4code + ' ' + naf4entry.libelle, level: 'naf4' });
    crumbs.push({ label: code, current: true });
  } else if (level === 'naf4') {
    if (naf2entry) crumbs.push({ code: naf2code, label: naf2code + ' ' + naf2entry.libelle, level: 'naf2' });
    crumbs.push({ label: code, current: true });
  } else {
    crumbs.push({ label: code, current: true });
  }
  crumbs.unshift({ label: 'Vue nationale', root: true });
  bc.innerHTML = crumbs.map(function(c, i) {
    var sep = i < crumbs.length - 1 ? '<span class="sep">&rsaquo;</span>' : '';
    if (c.root) return '<a data-root="1">' + c.label + '</a>' + sep;
    if (c.current) return '<span class="current">' + c.label + '</span>';
    return '<a data-code="' + c.code + '" data-level="' + c.level + '">' + c.label + '</a>' + sep;
  }).join('');
  bc.querySelectorAll('a[data-code]').forEach(function(a) {
    a.addEventListener('click', function() {
      setLevel(viewId, this.dataset.level);
      selectCode(viewId, this.dataset.code, this.dataset.level, render);
    });
  });
  var rootLink = bc.querySelector('a[data-root]');
  if (rootLink) rootLink.addEventListener('click', function() { window.location.hash = viewId; });

  // Ranking by event count
  var eventKey = cfg.eventKey;
  var allAtLevel = Object.entries(getStore(viewId, level))
    .map(function(pair) { return { code: pair[0], count: pair[1].stats[eventKey] }; })
    .sort(function(a, b) { return b.count - a.count; });

  // Comparaison inline de secteurs : NAF5 uniquement. La liste est partagée par les trois
  // vues, donc on la lit sans la modifier : un secteur absent de cette vue reste comparé
  // dans les autres (Trajet couvre 629 secteurs, AT 729).
  var vstate = state.views[viewId];
  var compareCodes = [];
  if (level === 'naf5') {
    // Sélectionner un secteur qui était comparé le promeut secteur courant, il quitte
    // donc la liste des comparés, sinon le bouton d'ajout resterait bloqué à sa limite.
    state.compareCodes = state.compareCodes.filter(function(c) { return c !== code; });
    var split = splitCompareCodes(state.compareCodes, code, function(c) { return !!store[c]; });
    compareCodes = split.visible;
    renderInline(viewId, split.missing);
  } else {
    hideInlineBar(viewId);
  }
  // Trace de la comparaison effectivement dessinée, lue par loadFromHash() pour savoir
  // si cette vue est à jour. La liste étant partagée, elle peut avoir changé pendant
  // qu'une autre vue était affichée.
  vstate.renderedCompare = state.compareCodes.join(',');

  // Secteurs à afficher côte à côte (courant + comparés) dans toutes les cartes.
  // Le courant porte la couleur accent ; les comparés reprennent la palette des chips.
  var cmpSet = [code].concat(compareCodes);
  var colorOf = function(i) { return i === 0 ? 'var(--accent)' : SECTOR_COLORS[(i - 1) % SECTOR_COLORS.length]; };
  var store5 = getStore(viewId, 'naf5');
  var sectorOf = function(c, i) { return { code: c, color: colorOf(i), entry: store[c] || store5[c] }; };
  var sectors = cmpSet.map(sectorOf);

  renderKPIs(viewId, s, nat, cfg, allAtLevel, code, compareCodes);
  setAssistantContext(viewId, s, nat, entry.risk_causes || {}, cfg, entry.yearly);
  renderPositionStrip(viewId, code, level, s.indice_frequence, render, compareCodes);
  if (cfg.causesTitle) {
    renderCausesChart(viewId, sectors);
  }
  renderFunnelChart(viewId, sectors, cfg);
  renderComparisonChart(viewId, code, level, render, compareCodes);
  renderEvolutionCharts(viewId, entry, level, compareCodes);

  renderDemographics(viewId, sectors);
  renderSizeChart(viewId, cmpSet.map(function(c, i) {
    var sd = sizeData[c];
    var e = store5[c];
    return { code: c, color: colorOf(i), entry: e, bands: sd && sd.bands, sectorIF: e ? e.stats.indice_frequence : 0 };
  }));
  renderPanels(viewId, cfg.panels, cmpSet.map(function(c, i) {
    return { code: c, color: colorOf(i), entry: store5[c], dims: extraData[c] };
  }));
  renderDiseaseTable(viewId, extraData[code]);
}

// ── URL hash routing ──
function loadFromHash() {
  var hash = window.location.hash.replace('#', '').trim();
  if (!hash) return;

  // Parse: #at/CODE, #mp/CODE, or legacy #CODE
  var viewId, code;
  if (hash.startsWith('at/')) {
    viewId = 'at';
    code = hash.substring(3);
  } else if (hash.startsWith('mp/')) {
    viewId = 'mp';
    code = hash.substring(3);
  } else if (hash.startsWith('trajet/')) {
    viewId = 'trajet';
    code = hash.substring(7);
  } else if (hash === 'at' || hash === 'mp' || hash === 'trajet' || hash === 'compare') {
    if (hash === 'compare') { switchView(hash); return; }
    // Un hash de vue nu demande la vue nationale. On efface AVANT switchView(),
    // qui reporte sinon le secteur de la vue precedente et reecrit le hash.
    var prevVs = state.views[state.activeView];
    if (prevVs) prevVs.code = null;
    if (hash !== state.activeView) switchView(hash);
    clearSelection(hash);
    return;
  } else {
    // Legacy: bare code maps to AT
    viewId = 'at';
    code = hash;
  }

  // selectCode() réécrit le hash, ce qui redéclenche hashchange et nous ramène ici.
  // Si la vue et le code demandés sont déjà affichés, le rendu a déjà eu lieu.
  // Évalué avant switchView(), qui aligne state.activeView sur viewId.
  // La comparaison compte dans « déjà affiché » : elle est partagée par les trois vues,
  // donc elle a pu changer pendant qu'une autre vue était à l'écran, et cette vue-ci
  // montrerait encore son rendu d'avant.
  var vs = state.views[viewId];
  var current = vs.code;
  var alreadyShown = viewId === state.activeView && !!code &&
    (current === code || current === code.toUpperCase()) &&
    vs.renderedCompare === state.compareCodes.join(',');

  if (viewId !== state.activeView) switchView(viewId);

  if (!code || alreadyShown) return;

  var data = getData(viewId);
  for (var i = 0; i < 3; i++) {
    var levels = ['naf5', 'naf4', 'naf2'];
    var level = levels[i];
    if (data['by_' + level][code]) {
      setLevel(viewId, level);
      selectCode(viewId, code, level, render);
      return;
    }
  }
  var upper = code.toUpperCase();
  for (var j = 0; j < 3; j++) {
    var lvl = ['naf5', 'naf4', 'naf2'][j];
    if (data['by_' + lvl][upper]) {
      setLevel(viewId, lvl);
      selectCode(viewId, upper, lvl, render);
      return;
    }
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Load all 3 datasets in parallel
    await Promise.all([
      loadDataset('at'),
      loadDataset('mp'),
      loadDataset('trajet'),
      loadSizeData(),
      loadExtraData(),
      loadCtnMap(),
    ]);

    // Hide skeleton, reveal content
    var skeleton = document.getElementById('loadingSkeleton');
    if (skeleton) skeleton.style.display = 'none';

    // Init nav (pass render for theme toggle re-render)
    initNav(render);

    // Attach drawer button listeners
    attachDrawerListeners();

    // Setup search for each view
    setupSearch('at', render);
    setupSearch('mp', render);
    setupSearch('trajet', render);

    // Setup comparison toggles
    setupCompToggle('at');
    setupCompToggle('mp');
    setupCompToggle('trajet');

    // Setup the "Comparer" view
    initCompare();

    // Setup the Virginie assistant (floating launcher + conversation panel)
    initAssistant();

    // Setup inline sector comparison (NAF5) for each detail view
    initInlineCompare(render);

    // Render national default state for each view
    ['at', 'mp', 'trajet'].forEach(function(viewId) {
      renderNationalState(viewId, getData, getStore, VIEW_CONFIG[viewId], setLevel, selectCode, render);
    });

    // Click outside closes the share drawer (l'assistant gère son propre clic extérieur)
    document.addEventListener('click', function(e) {
      var shareDrawer = el('shareDrawer');
      if (shareDrawer.classList.contains('open') && !shareDrawer.contains(e.target) && !e.target.closest('.action-btn')) {
        toggleShare();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (isAssistantOpen()) { closeAssistant(); return; }
        if (el('shareDrawer').classList.contains('open')) { toggleShare(); return; }
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        var searchInput = viewEl(state.activeView, 'searchInput');
        if (document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    // Hash routing
    window.addEventListener('hashchange', loadFromHash);
    loadFromHash();

    // Init Lucide icons
    lucide.createIcons();

  } catch (err) {
    // Hide skeleton
    var skel = document.getElementById('loadingSkeleton');
    if (skel) skel.style.display = 'none';

    // Show error state
    var errorState = document.getElementById('errorState');
    var errorMsg = document.getElementById('errorMessage');
    if (errorState) errorState.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = err.message || 'Impossible de charger les données.';

    // Retry button reloads the page
    var retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.addEventListener('click', function() {
      window.location.reload();
    });
  }
});
