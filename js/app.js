// ── App entry point ──

import { loadDataset, getData, getStore, setData, libelleOf } from './data.js?v=f8b7846';
import { currentRoute, goTo, navigate, routePath, titleFor, setLibelleLookup, initRouter } from './route.js?v=f8b7846';
import { state, VIEW_CONFIG } from './state.js?v=f8b7846';
import { el, viewEl, splitCompareCodes, naf1Of } from './utils.js?v=f8b7846';
import { initNav, switchView } from './nav.js?v=f8b7846';
import { refreshSidebar } from './sidebar.js?v=f8b7846';
import { setupSearch, selectCode, setLevel, clearSelection } from './search.js?v=f8b7846';
import { renderKPIs, renderNationalState } from './kpi.js?v=f8b7846';
import { renderCausesChart, renderFunnelChart, renderPositionStrip, renderComparisonChart, setupCompToggle, renderDemographics, renderSizeChart, renderPanels, renderDiseaseTable } from './charts.js?v=f8b7846';
import { renderHistory } from './history.js?v=f8b7846';
import { toggleShare, copyLink } from './insights.js?v=f8b7846';
import { initAssistant, setAssistantContext, toggleAssistant, closeAssistant, isAssistantOpen } from './assistant.js?v=f8b7846';
import { initCompare, renderBench, prefillSector, prefillTest, computeDiagnostic, vs as benchState } from './compare.js?v=f8b7846';
import { initDiagnostic, renderDiagnostic, openReport } from './diagnostic.js?v=f8b7846';
import { captureAttribution } from './lead.js?v=f8b7846';
import { initInlineCompare, renderInline, hideInlineBar } from './compare-inline.js?v=f8b7846';
import { SECTOR_COLORS } from './compare.js?v=f8b7846';
import { loadCtnMap } from './cost-model.js?v=f8b7846';
import { getProfile } from './profile.js?v=f8b7846';
import { initBadge } from './badge.js?v=f8b7846';
import { initShare } from './share.js?v=f8b7846';
import { renderTmsBody, renderSiegeBody } from './body.js?v=f8b7846';
import { nationalSum, resetFindings } from './findings.js?v=f8b7846';
import { renderYearFilter } from './year.js?v=f8b7846';
import { initTour } from './tour.js?v=f8b7846';
import { initHome, renderHome } from './home.js?v=f8b7846';
import { initChecklist, markStep } from './checklist.js?v=f8b7846';
import { renderAbsence, redrawAbsence } from './absence.js?v=f8b7846';

// Données "taille d'établissement" (AT uniquement, extrait des fiches PDF)
var sizeData = {};
async function loadSizeData() {
  try {
    // Passe par loadDataset pour que « Mon entreprise » la lise aussi via getData('size').
    sizeData = await loadDataset('size');
  } catch (e) { /* données taille optionnelles */ }
}

// Dimensions textuelles (siège des lésions, activité, modalité, maladies MP) par NAF5
var extraData = {};
var extraNational = null;
async function loadExtraData() {
  try {
    var resp = await fetch('./data/extra-dimensions.json');
    if (resp.ok) extraData = await resp.json();
    // Le fichier couvre tous les NAF 5 sans case masquée : leur somme sert de référence nationale.
    extraNational = nationalSum(Object.keys(extraData).map(function(c) { return extraData[c]; }));
    setData('extra', extraData);   // lu aussi par le diagnostic personnalisé
  } catch (e) { /* dimensions optionnelles */ }
}

// Les dimensions d'un secteur, avec la référence nationale en dims.nat pour les graphiques.
function sectorDims(code) {
  var d = extraData[code];
  return d ? Object.assign({ nat: extraNational }, d) : undefined;
}

// Event listeners for drawer buttons (all views)
function attachDrawerListeners() {
  // Les boutons « insights » (icône étincelles) ouvrent l'assistant Virginie.
  SECTOR_VIEWS.forEach(function(v) {
    var insights = viewEl(v, 'insightsBtn'), share = viewEl(v, 'shareBtn');
    if (insights) insights.addEventListener('click', toggleAssistant);
    if (share) share.addEventListener('click', function() { toggleShare(); });
  });
  var closeShare = el('shareCloseBtn');
  if (closeShare) closeShare.addEventListener('click', toggleShare);
  var copyBtn = el('copyLinkBtn');
  if (copyBtn) copyBtn.addEventListener('click', copyLink);
}

// ── Render orchestration ──
function render(viewId, code, level) {
  resetFindings(viewId);
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
  // La carte des vues AT et Trajet suit le secteur (js/map.js), les autres la masquent.
  if (mapSec && !mapSec.hasAttribute('data-follows-sector')) mapSec.style.display = 'none';

  var s = entry.stats;
  var nat = data.meta.national;

  viewEl(viewId, 'selTitle').textContent = code + ' // ' + entry.libelle;
  var levelLabel = level === 'naf5' ? 'Code NAF' : level === 'naf4' ? 'Sous-classe NAF' : level === 'naf2' ? 'Division NAF' : 'Section NAF';
  var subText = levelLabel;
  if (entry.codes_naf5) subText += ' // ' + entry.codes_naf5.length + ' codes NAF agrégés';
  if (entry.codes_naf2) subText += ' // ' + entry.codes_naf2.length + ' division' + (entry.codes_naf2.length > 1 ? 's' : '');
  viewEl(viewId, 'selSub').textContent = subText;

  // Breadcrumb
  var bc = viewEl(viewId, 'breadcrumb');
  var crumbs = [];
  var naf2code = code.substring(0, 2);
  var naf4code = code.substring(0, 4);
  var naf2entry = data.by_naf2[naf2code];
  var naf4entry = data.by_naf4[naf4code];
  // La section parente vient en tête du fil quand le jeu en porte une (voir naf1Of).
  var sectionCode = level === 'naf1' ? null : naf1Of(data, naf2code);
  var sectionEntry = sectionCode && data.by_naf1 && data.by_naf1[sectionCode];
  if (sectionEntry && level !== 'naf1') crumbs.push({ code: sectionCode, label: sectionCode + ' ' + sectionEntry.libelle, level: 'naf1' });
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
    var sep = i < crumbs.length - 1 ? '<span class="sep" aria-hidden="true">&rsaquo;</span>' : '';
    // De vrais liens (clavier, nouvel onglet), que le clic simple garde dans la page.
    if (c.root) return '<a data-root="1" href="' + routePath(viewId) + '">' + c.label + '</a>' + sep;
    if (c.current) return '<span class="current">' + c.label + '</span>';
    return '<a data-code="' + c.code + '" data-level="' + c.level + '" href="' + routePath(viewId, c.code, libelleOf(viewId, c.code)) + '">' + c.label + '</a>' + sep;
  }).join('');
  function plainClick(e) { return !(e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0); }
  bc.querySelectorAll('a[data-code]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      if (!plainClick(e)) return;
      e.preventDefault();
      setLevel(viewId, this.dataset.level);
      selectCode(viewId, this.dataset.code, this.dataset.level, render);
    });
  });
  var rootLink = bc.querySelector('a[data-root]');
  if (rootLink) rootLink.addEventListener('click', function(e) {
    if (!plainClick(e)) return;
    e.preventDefault();
    goTo(viewId);
  });

  // Ranking by event count
  var eventKey = cfg.eventKey;
  var allAtLevel = Object.entries(getStore(viewId, level))
    .map(function(pair) { return { code: pair[0], count: pair[1].stats[eventKey] }; })
    .sort(function(a, b) { return b.count - a.count; });

  // Comparaison inline de secteurs : NAF5 uniquement. La liste est partagée par les trois
  // vues, donc on la lit sans la modifier : un secteur absent de cette vue reste comparé
  // dans les autres (Trajet couvre moins de secteurs que l'AT).
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
  // Trace de la comparaison effectivement dessinée, lue par loadFromRoute() pour savoir
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

  var drawYear = function(ys, ynat, yrank, ycmp) { renderKPIs(viewId, ys, ynat, cfg, yrank, code, compareCodes, ycmp); };
  var drawKPIs = function() {
    renderKPIs(viewId, s, nat, cfg, allAtLevel, code, compareCodes);
    renderYearFilter(viewId, cfg, level, code, compareCodes, drawYear, drawKPIs);
  };
  drawKPIs();
  setAssistantContext(viewId, s, nat, entry.risk_causes || {}, cfg, entry.yearly);
  renderPositionStrip(viewId, code, level, s.indice_frequence, render, compareCodes);
  if (cfg.causesTitle) {
    renderCausesChart(viewId, sectors);
  }
  renderFunnelChart(viewId, sectors, cfg);
  renderComparisonChart(viewId, code, level, render, compareCodes);

  renderDemographics(viewId, sectors);
  renderSizeChart(viewId, cmpSet.map(function(c, i) {
    var sd = sizeData[c];
    var e = store5[c];
    return { code: c, color: colorOf(i), entry: e, bands: sd && sd.bands, sectorIF: e ? e.stats.indice_frequence : 0 };
  }));
  // La silhouette d'abord : elle décide si la rangée « nature » a une ou deux colonnes, et
  // un graphique Chart.js dessiné avant ce choix garde sa largeur provisoire et déborde.
  renderSiegeBody(viewId, cmpSet.map(function(c, i) {
    return { code: c, color: colorOf(i), entry: store5[c], dims: sectorDims(c) };
  }), cfg.siegeKey, cfg.sinistreLabel);
  renderPanels(viewId, cfg.panels, cmpSet.map(function(c, i) {
    return { code: c, color: colorOf(i), entry: store[c] || store5[c], dims: sectorDims(c) };
  }));
  renderDiseaseTable(viewId, extraData[code]);
  // Seul le volet MP porte une section silhouette, les autres vues sortent aussitôt.
  renderTmsBody(viewId, sectors, data.meta);
  // Séries sur dix ans, circonstances et structure : fichiers chargés à la demande (history.js).
  renderHistory(viewId, sectors);
  // Le bloc d'absence lit les trois jeux : il attend les deux autres et se redessine à leur arrivée.
  renderAbsence(viewId, level, code);
  refreshSidebar();
}

// ── Chargement progressif des jeux de données ──
// La page s'affiche dès que le jeu de la vue d'entrée est lu, les deux autres arrivent
// ensuite. Une vue sectorielle lit son propre jeu, « Mon entreprise » et le diagnostic
// partent de l'AT et ne lisent MP et Trajet que lorsque l'entreprise les renseigne.
var SECTOR_VIEWS = ['at', 'mp', 'trajet'];
var mpSettled = false;    // le jeu MP est arrivé ou a échoué, le diagnostic ne l'attend plus
var lastSectorShown = null;   // le secteur de la dernière vue sectorielle, que Mon entreprise reprend
var profileSectorUsed = false;   // le secteur de l'accueil a ouvert une vue sectorielle, une fois par page
var datasetReady = {};   // type -> promesse résolue quand la vue sectorielle est montée

function datasetFor(viewId) {
  return SECTOR_VIEWS.indexOf(viewId) >= 0 ? viewId : 'at';
}

function mountSectorView(viewId) {
  setupSearch(viewId, render);
  setupCompToggle(viewId);
  renderNationalState(viewId, getData, getStore, VIEW_CONFIG[viewId], setLevel, selectCode, render);
}

// Squelette de chargement, le temps qu'une vue ouverte trop tôt reçoive son jeu.
function setPending(on) {
  document.body.classList.toggle('data-pending', on);
  var skeleton = document.getElementById('loadingSkeleton');
  if (skeleton) skeleton.style.display = on ? '' : 'none';
  // Quitter une vue en échec pour une vue chargée efface son message d'erreur.
  var errorState = document.getElementById('errorState');
  if (errorState) errorState.style.display = 'none';
}

function showLoadError(err) {
  setPending(false);
  var errorState = document.getElementById('errorState');
  var errorMsg = document.getElementById('errorMessage');
  if (errorState) errorState.style.display = 'flex';
  if (errorMsg) errorMsg.textContent = err.message || 'Impossible de charger les données.';
  var retryBtn = document.getElementById('retryBtn');
  if (retryBtn) retryBtn.addEventListener('click', function() {
    window.location.reload();
  });
}

// ── Routage par adresse (js/route.js) ──
function loadFromRoute() {
  var route = currentRoute();

  // Jeu pas encore arrivé : on attend, puis on relit l'adresse, qui a pu changer entre-temps.
  var needed = datasetFor(route.view);
  if (!getData(needed)) {
    setPending(true);
    datasetReady[needed].then(loadFromRoute, showLoadError);
    return;
  }
  // Le diagnostic chiffre les MP déclarées : il attend leur jeu, ou son échec, que l'estimation signale.
  if (route.view === 'diagnostic' && !getData('mp') && datasetReady.mp && !mpSettled) {
    setPending(true);
    datasetReady.mp.catch(function() {}).then(function() { mpSettled = true; loadFromRoute(); });
    return;
  }
  setPending(false);
  document.title = titleFor(route);

  if (route.view === 'home') {
    navigate(routePath('home'), { replace: true });
    switchView('home', true);
    renderHome();
    return;
  }

  if (route.view === 'compare' || route.view === 'diagnostic') {
    // Le diagnostic personnalisé se calcule depuis les saisies de « Mon entreprise » : ouvert
    // sans elles (lien partagé, rechargement), il renvoie vers le calcul.
    var target = route.view === 'diagnostic' && !computeDiagnostic(benchState()) ? 'compare' : route.view;
    // Le secteur que l'utilisateur regardait, que Mon entreprise reprend quand rien n'y est encore saisi.
    var carried = target === 'compare' && !benchState().sector ? lastSectorShown || getProfile().sector || null : null;
    // Adresse canonique sans entrée d'historique : ancienne ancre, ?q= déjà lu, adresse inconnue.
    navigate(routePath(target), { replace: true });
    switchView(target, true);
    if (target === 'diagnostic') { renderDiagnostic(); return; }
    // Arrivée depuis la landing avec la saisie de secteur du hero (?q=<saisie>).
    if (route.query || carried) prefillSector(route.query || carried);
    else renderBench();
    // ?test saute au rapport une seule fois : « Revenir au calcul » doit pouvoir y rester.
    if (prefillTest()) openReport();
    return;
  }

  var viewId = route.view;
  var code = route.code;
  lastSectorShown = code || null;
  setRouteNote(viewId, '');
  if (code) markStep('sector');
  // La première vue sectorielle ouverte sans secteur s'ouvre sur celui de l'accueil (profile.js).
  // Ensuite, une vue nue reste la vue nationale : vider la recherche y ramène.
  if (!code && !profileSectorUsed) {
    profileSectorUsed = true;
    var mine = getProfile().sector;
    if (mine && (getData(viewId).by_naf5 || {})[mine]) { goTo(viewId, mine); return; }
  }
  if (code) profileSectorUsed = true;
  if (!code) {
    // Une vue sans secteur demande la vue nationale.
    var prevVs = state.views[state.activeView];
    if (prevVs) prevVs.code = null;
    navigate(routePath(viewId), { replace: true });
    if (viewId !== state.activeView) switchView(viewId, true);
    clearSelection(viewId);
    return;
  }

  // selectCode() écrit l'adresse, qui émet routechange et nous ramène ici.
  // Si la vue et le code demandés sont déjà affichés, le rendu a déjà eu lieu.
  // Évalué avant switchView(), qui aligne state.activeView sur viewId.
  // La comparaison compte dans « déjà affiché » : elle est partagée par les trois vues,
  // donc elle a pu changer pendant qu'une autre vue était à l'écran, et cette vue-ci
  // montrerait encore son rendu d'avant.
  var vs = state.views[viewId];
  var alreadyShown = viewId === state.activeView && vs.code === code &&
    vs.renderedCompare === state.compareCodes.join(',');

  if (viewId !== state.activeView) switchView(viewId, true);

  // Déjà affiché : seule l'adresse peut encore porter un ancien libellé.
  if (alreadyShown) { goTo(viewId, code); return; }

  var data = getData(viewId);
  var levels = ['naf5', 'naf4', 'naf2', 'naf1'];
  for (var i = 0; i < levels.length; i++) {
    if ((data['by_' + levels[i]] || {})[code]) {
      setLevel(viewId, levels[i]);
      selectCode(viewId, code, levels[i], render);
      return;
    }
  }
  // Un code que cette vue ne publie pas (un secteur absent de Trajet, un code inconnu) : la vue
  // nationale, avec une ligne qui le dit plutôt qu'un retour muet.
  vs.code = null;
  navigate(routePath(viewId), { replace: true });
  clearSelection(viewId);
  // Le libellé peut venir d'un autre jeu, encore en route sur une arrivée directe : on les attend.
  Promise.all(['at', 'mp', 'trajet'].map(function(t) {
    return datasetReady[t] ? datasetReady[t].catch(function() {}) : null;
  })).then(function() {
    var now = currentRoute();
    if (now.view !== viewId || now.code) return;   // la personne est déjà ailleurs
    var lib = libelleOf(viewId, code);
    setRouteNote(viewId, lib
      ? 'Le secteur ' + code + ' (' + lib + ') n\'a pas de données pour ' + VIEW_NOUN[viewId] + '. Voici la vue nationale.'
      : 'Aucun secteur ne porte le code « ' + code + ' ». Voici la vue nationale, cherchez votre secteur ci-dessus.');
  });
}

var VIEW_NOUN = { at: 'les accidents du travail', mp: 'les maladies professionnelles', trajet: 'les accidents de trajet' };

// La ligne posée au-dessus de la vue nationale quand l'adresse demandait un secteur absent.
// Le code vient de l'adresse : posé par textContent, jamais en HTML.
function setRouteNote(viewId, text) {
  var id = viewId + '-routeNote';
  var note = el(id);
  if (!text) { if (note) note.remove(); return; }
  if (!note) {
    var anchor = viewEl(viewId, 'emptyState');
    if (!anchor) return;
    note = document.createElement('p');
    note.id = id;
    note.className = 'route-note';
    note.setAttribute('role', 'status');
    anchor.parentNode.insertBefore(note, anchor);
  }
  note.textContent = text;
}

// ── Init ──
captureAttribution();
setLibelleLookup(libelleOf);
document.addEventListener('DOMContentLoaded', async function() {
  // Sous <base href>, « #main-content » mènerait à la racine du site : le lien d'évitement
  // déplace donc le focus lui-même.
  var skip = document.querySelector('.skip-link');
  if (skip) skip.addEventListener('click', function(e) {
    e.preventDefault();
    var main = el('main-content');
    if (main) main.focus();
  });
  try {
    // Seul le jeu de la vue d'entrée retient l'affichage, les petits fichiers annexes
    // partent avec lui.
    var first = datasetFor(currentRoute().view);
    await Promise.all([
      loadDataset(first),
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

    // Setup the "Comparer" view
    initCompare();
    initDiagnostic();
    initHome();
    initChecklist();

    // Setup the Virginie assistant (floating launcher + conversation panel)
    initAssistant();

    // Setup inline sector comparison (NAF5) for each detail view
    initInlineCompare(render);

    // Monte la vue d'entrée, puis charge les deux autres jeux en arrière-plan. Un échec
    // ne s'affiche que si l'on ouvre la vue concernée.
    mountSectorView(first);
    datasetReady[first] = Promise.resolve();
    SECTOR_VIEWS.forEach(function(viewId) {
      if (viewId === first) return;
      datasetReady[viewId] = loadDataset(viewId).then(function() {
        mountSectorView(viewId);
        redrawAbsence();
        // Les risques MP et Trajet de « Mon entreprise » apparaissent avec leur jeu.
        if (state.activeView === 'compare') renderBench();
      });
      datasetReady[viewId].catch(function() {});
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
      // « / » n'est un raccourci que hors d'un champ de saisie.
      var t = e.target;
      var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !typing) {
        var searchInput = viewEl(state.activeView, 'searchInput');
        if (!searchInput) return;   // « Mon entreprise » n'a pas de recherche de secteur principale
        if (document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    // Routage par adresse : retour et avance du navigateur, liens internes, puis l'adresse d'entrée.
    initRouter();
    window.addEventListener('routechange', loadFromRoute);
    loadFromRoute();

    // Init Lucide icons
    lucide.createIcons();

    // Visite guidée : départ automatique à la première visite, bouton « ? » sinon
    initTour();
    initBadge();
    initShare();
    // Un secteur choisi à l'accueil remplit le calcul s'il est à l'écran et encore vide.
    window.addEventListener('profilechange', function() {
      var mine = getProfile().sector;
      if (mine && state.activeView === 'compare' && !benchState().sector) prefillSector(mine);
    });

  } catch (err) {
    showLoadError(err);
  }
});
