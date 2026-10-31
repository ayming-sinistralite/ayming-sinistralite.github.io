// ── App entry point ──

import { loadDataset, loadYearly, loadExtra, getData, getStore, libelleOf } from './data.js?v=5f667a9';
import { currentRoute, goTo, navigate, routePath, applyPageMeta, setLibelleLookup, initRouter, sectorFacts, verdict, tradeName, SMALL_SAMPLE, VIEW_TITLES } from './route.js?v=5f667a9';
import { state, VIEW_CONFIG } from './state.js?v=5f667a9';
import { el, viewEl, splitCompareCodes, naf1Of, whenBandNear } from './utils.js?v=5f667a9';
import { initNav, switchView } from './nav.js?v=5f667a9';
import { refreshSidebar } from './sidebar.js?v=5f667a9';
import { setupSearch, selectCode, setLevel, clearSelection } from './search.js?v=5f667a9';
import { renderKPIs, renderNationalState } from './kpi.js?v=5f667a9';
import { renderCausesChart, renderFunnelChart, renderPositionStrip, renderComparisonChart, setupCompToggle, renderDemographics, renderSizeChart, renderPanels, renderDiseaseTable, PANELS } from './charts.js?v=5f667a9';
import { renderHistory } from './history.js?v=5f667a9';
import { toggleShare, copyLink } from './insights.js?v=5f667a9';
import { initAssistant, setAssistantContext, toggleAssistant, closeAssistant, isAssistantOpen } from './assistant.js?v=5f667a9';
import { computeDiagnostic, vs as benchState } from './compare.js?v=5f667a9';
import { initFlow, renderFlow, refreshFlow, prefillSector, prefillTest } from './flow.js?v=5f667a9';
import { initDiagnostic, renderDiagnostic, openReport } from './diagnostic.js?v=5f667a9';
import { listReports, restoreReport } from './reports.js?v=5f667a9';
import { captureAttribution } from './lead.js?v=5f667a9';
import { initInlineCompare, renderInline, hideInlineBar } from './compare-inline.js?v=5f667a9';
import { SECTOR_COLORS } from './compare.js?v=5f667a9';
import { getProfile } from './profile.js?v=5f667a9';
import { initBadge } from './badge.js?v=5f667a9';
import { initShare } from './share.js?v=5f667a9';
import { renderTmsBody, renderSiegeBody } from './body.js?v=5f667a9';
import { nationalSum, resetFindings } from './findings.js?v=5f667a9';
import { renderYearFilter } from './year.js?v=5f667a9';
import { initTour } from './tour.js?v=5f667a9';
import { initHome, renderHome } from './home.js?v=5f667a9';
import { initChecklist, markStep } from './checklist.js?v=5f667a9';
import { renderAbsence, redrawAbsence } from './absence.js?v=5f667a9';

// Données "taille d'établissement" (AT uniquement, extrait des fiches PDF), à la demande : le graphique
// de taille d'une page AT et « Mon entreprise ». Passe par loadDataset pour que ce dernier la lise
// via getData('size'). Ne rejette pas : sans elle, le graphique et les tranches s'effacent.
function loadSize() {
  return loadDataset('size').catch(function() { return null; });
}

// Dimensions textuelles (siège des lésions, activité, modalité, maladies MP) par NAF5, à la demande
// (data.js, loadExtra). Ici seulement la référence nationale, calculée à leur arrivée.
var extraData = {};
var extraNational = null;
var extraIn = false;
function withExtra() {
  return loadExtra().then(function(json) {
    if (json && json !== extraData) {
      extraData = json;
      extraIn = true;
      // Le fichier couvre tous les NAF 5 sans case masquée : leur somme sert de référence nationale.
      extraNational = nationalSum(Object.keys(json).map(function(c) { return json[c]; }));
    }
    return json;
  });
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

// Le bloc que scripts/prerender.py écrit dans le HTML (titre, chiffres, voisins) sert aux visiteurs
// sans JavaScript et aux moteurs : le premier rendu de la vue le remplace, et le retirer deux fois ne coûte rien.
function removeStatic(viewId) {
  var block = el(viewId + '-static');
  if (block) block.remove();
}

// Le titre et le sous-titre d'un secteur NAF 5, repris des pages prérendues (même titre, même verdict que <title>).
function sectorHeading(viewId, code, entry, data) {
  var nb = '\u00a0';
  var title = tradeName(code, entry.libelle) + nb + ': ' + VIEW_TITLES[viewId];
  var year = data.meta.years[data.meta.years.length - 1];
  var f = sectorFacts(data, viewId, code) || {};
  var sub = 'Code NAF ' + code;
  if ((f.events || 0) < SMALL_SAMPLE) sub += ' · moins de dix cas en ' + year;
  else if (f.indice != null && f.national) sub += ' · ' + verdict(f.indice, f.national).replace(' %', nb + '%') + ' en ' + year;
  return { title: title, sub: sub };
}

// ── Render orchestration ──
function render(viewId, code, level) {
  resetFindings(viewId);
  var data = getData(viewId);
  var cfg = VIEW_CONFIG[viewId];
  var store = getStore(viewId, level);
  var entry = store[code];
  if (!entry) return;

  removeStatic(viewId);
  viewEl(viewId, 'emptyState').style.display = 'none';
  // Un rendu annule toute sortie en cours, sinon .leaving masquerait ce rendu.
  viewEl(viewId, 'results').classList.remove('leaving');
  viewEl(viewId, 'results').classList.add('visible');
  var mapSec = viewEl(viewId, 'mapSection');
  // La carte des vues AT et Trajet suit le secteur (js/map.js), les autres la masquent.
  if (mapSec && !mapSec.hasAttribute('data-follows-sector')) mapSec.style.display = 'none';

  var s = entry.stats;
  var nat = data.meta.national;

  var heading = level === 'naf5' ? sectorHeading(viewId, code, entry, data) : null;
  viewEl(viewId, 'selTitle').textContent = heading ? heading.title : code + ' // ' + entry.libelle;
  var levelLabel = level === 'naf5' ? 'Code NAF' : level === 'naf4' ? 'Sous-classe NAF' : level === 'naf2' ? 'Division NAF' : 'Section NAF';
  var subText = levelLabel;
  if (entry.codes_naf5) subText += ' // ' + entry.codes_naf5.length + ' codes NAF agrégés';
  if (entry.codes_naf2) subText += ' // ' + entry.codes_naf2.length + ' division' + (entry.codes_naf2.length > 1 ? 's' : '');
  viewEl(viewId, 'selSub').textContent = heading ? heading.sub : subText;

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
  // Les fichiers du bas de page arrivent à la demande : une réponse tardive ne dessine que si ce
  // rendu est encore le dernier de la vue (autre secteur, autre comparaison, thème changé).
  var lazyToken = {};
  vstate.lazyToken = lazyToken;
  var current = function() { return vstate.lazyToken === lazyToken && state.activeView === viewId; };
  // Tant qu'un panneau du bas attend son fichier, ses bandes n'ont pas de hauteur et la carte
  // remonterait sous les yeux, donc se chargerait aussitôt : une réserve de place la tient à
  // distance et disparaît quand le dernier fichier est arrivé (pas de classe CSS pour cela, style en ligne).
  var space = lazySpace(viewId);
  space.style.display = 'none';
  var waiting = 0;
  var lazy = {
    hold: function() { waiting++; space.style.display = ''; },
    release: function() { if (current() && --waiting <= 0) space.style.display = 'none'; }
  };

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
  // L'historique par année (data.js) ne sert qu'à Virginie : elle le demande à l'ouverture de son
  // panneau (loadTrend) et reçoit sa tendance à l'arrivée du fichier.
  var drawAssistant = function(loadTrend) { setAssistantContext(viewId, s, nat, entry.risk_causes || {}, cfg, entry.yearly, loadTrend); };
  drawAssistant(entry.yearly ? null : function() {
    return loadYearly(viewId).then(function() {
      if (entry.yearly && current()) drawAssistant(null);
    });
  });
  renderPositionStrip(viewId, code, level, s.indice_frequence, render, compareCodes);
  if (cfg.causesTitle) {
    renderCausesChart(viewId, sectors);
  }
  renderFunnelChart(viewId, sectors, cfg);
  renderComparisonChart(viewId, code, level, render, compareCodes);

  renderDemographics(viewId, sectors);
  var drawSize = function() {
    var sizeData = getData('size') || {};
    renderSizeChart(viewId, cmpSet.map(function(c, i) {
      var sd = sizeData[c];
      var e = store5[c];
      return { code: c, color: colorOf(i), entry: e, bands: sd && sd.bands, sectorIF: e ? e.stats.indice_frequence : 0 };
    }));
  };
  // Les tranches de taille ne partent que lorsque leur section approche (AT seul en porte une).
  var sizeSection = viewEl(viewId, 'sizeSection');
  if (getData('size') || !sizeSection) drawSize();
  else {
    lazy.hold();
    whenBandNear([sizeSection], function() {
      loadSize().then(function() { if (current()) drawSize(); lazy.release(); });
    });
  }
  // La silhouette d'abord : elle décide si la rangée « nature » a une ou deux colonnes, et
  // un graphique Chart.js dessiné avant ce choix garde sa largeur provisoire et déborde.
  // Les dimensions (extra-dimensions.json) ne partent qu'à l'approche de leurs sections : la vue
  // garde de quoi les dessiner à leur arrivée, et un nouveau rendu les redessine sur-le-champ.
  vstate.drawDims = function() {
    renderSiegeBody(viewId, cmpSet.map(function(c, i) {
      return { code: c, color: colorOf(i), entry: store5[c], dims: sectorDims(c) };
    }), cfg.siegeKey, cfg.sinistreLabel);
    renderPanels(viewId, cfg.panels, cmpSet.map(function(c, i) {
      return { code: c, color: colorOf(i), entry: store[c] || store5[c], dims: sectorDims(c) };
    }));
    renderDiseaseTable(viewId, extraData[code]);
  };
  if (extraIn) vstate.drawDims();
  else {
    var dimSections = ['siegeSection', 'diseaseSection'].concat((cfg.panels || []).map(function(id) { return PANELS[id].section; }));
    lazy.hold();
    whenBandNear(dimSections.map(function(id) { return viewEl(viewId, id); }), function() {
      withExtra().then(function() { if (current()) vstate.drawDims(); lazy.release(); });
    });
  }
  // Seul le volet MP porte une section silhouette, les autres vues sortent aussitôt.
  renderTmsBody(viewId, sectors, data.meta);
  // Séries sur dix ans, circonstances et structure : fichiers chargés à la demande (history.js).
  renderHistory(viewId, sectors, lazy);
  // Le bloc d'absence lit les trois jeux : il attend les deux autres et se redessine à leur arrivée.
  renderAbsence(viewId, level, code);
  refreshSidebar();
}

// ── Chargement progressif des jeux de données ──
// La page s'affiche dès que le jeu de la vue d'entrée est lu, les deux autres arrivent
// à la demande (ensureDataset). Une vue sectorielle lit son propre jeu, « Mon entreprise » et le diagnostic
// partent de l'AT et ne lisent MP et Trajet que lorsque l'entreprise les renseigne.
var SECTOR_VIEWS = ['at', 'mp', 'trajet'];
var mpSettled = false;    // le jeu MP est arrivé ou a échoué, le diagnostic ne l'attend plus
var lastSectorShown = null;   // le secteur de la dernière vue sectorielle, que Mon entreprise reprend
var profileSectorUsed = false;   // le secteur de l'accueil a ouvert une vue sectorielle, une fois par page
var datasetReady = {};   // type -> promesse résolue quand la vue sectorielle est montée

function datasetFor(viewId) {
  return SECTOR_VIEWS.indexOf(viewId) >= 0 ? viewId : 'at';
}

// MP et Trajet ne se chargent qu'à la demande : leur onglet, Mon entreprise et le diagnostic, ou
// la lecture d'une vue sectorielle qui descend vers le bloc d'absence, seul à lire les trois jeux.
// Un échec reste en promesse rejetée, affiché seulement si l'on ouvre la vue concernée.
function ensureDataset(viewId) {
  if (!datasetReady[viewId]) {
    datasetReady[viewId] = loadDataset(viewId).then(function() {
      mountSectorView(viewId);
      redrawAbsence();
      refreshSidebar();
      // Les chiffres MP des questions de « Mon entreprise » apparaissent avec leur jeu.
      refreshFlow();
    });
    datasetReady[viewId].catch(function() {});
  }
  return datasetReady[viewId];
}

// Le bloc d'absence est loin sous la ligne de flottaison : un écran de lecture suffit à charger
// les deux autres jeux avant qu'il n'arrive à l'écran.
function loadOthersOnScroll() {
  function onScroll() {
    if (window.scrollY < window.innerHeight * 0.8 || SECTOR_VIEWS.indexOf(state.activeView) < 0) return;
    window.removeEventListener('scroll', onScroll);
    SECTOR_VIEWS.forEach(ensureDataset);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Ce que « Mon entreprise » et le rapport lisent en plus des trois jeux : les dimensions (siège des
// lésions du rapport) et les tranches de taille. Lancées à l'entrée dans l'un des deux écrans, sans
// retenir « Mon entreprise » (la saisie dure plus longtemps que le chargement), mais le rapport les
// attend. Une arrivée tardive redessine l'écran ouvert. La promesse ne rejette pas.
var benchPromise = null;
var benchSettled = false;
function benchData() {
  if (!benchPromise) {
    benchPromise = Promise.all([withExtra(), loadSize()]).then(function() {
      benchSettled = true;
      if (state.activeView === 'compare') refreshFlow();
      else if (state.activeView === 'diagnostic') renderDiagnostic();
    });
  }
  return benchPromise;
}

// La réserve de place sous la vue, créée au premier besoin.
function lazySpace(viewId) {
  var id = viewId + '-lazySpace';
  var space = el(id);
  if (!space) {
    space = document.createElement('div');
    space.id = id;
    space.setAttribute('aria-hidden', 'true');
    space.style.minHeight = Math.round(Math.min(Math.max(window.innerHeight * 2, 1400), 2600)) + 'px';
    el('view-' + viewId).appendChild(space);
  }
  return space;
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
  // Message fixe : err.message est en anglais pour un échec réseau (« Failed to fetch »).
  console.warn(err);
  if (errorMsg) errorMsg.textContent = 'Vérifiez votre connexion puis réessayez.';
  var errorTitle = errorState && errorState.querySelector('h2');
  if (errorTitle) errorTitle.textContent = 'Les statistiques n\'ont pas pu se charger';
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
  // Mon entreprise et le diagnostic lisent MP et Trajet dès qu'on les renseigne, le rapport aussi.
  if (route.view === 'compare' || route.view === 'diagnostic') { SECTOR_VIEWS.forEach(ensureDataset); benchData(); }
  if (!getData(needed)) {
    setPending(true);
    ensureDataset(needed).then(loadFromRoute, showLoadError);
    return;
  }
  // Le diagnostic chiffre les MP déclarées : il attend leur jeu, ou son échec, que l'estimation signale.
  if (route.view === 'diagnostic' && !getData('mp') && datasetReady.mp && !mpSettled) {
    setPending(true);
    datasetReady.mp.catch(function() {}).then(function() { mpSettled = true; loadFromRoute(); });
    return;
  }
  // Le rapport lit le siège des lésions et les tranches de taille : le diagnostic attend leurs fichiers.
  if (route.view === 'diagnostic' && !benchSettled) {
    setPending(true);
    benchData().then(loadFromRoute);
    return;
  }
  setPending(false);
  applyPageMeta(route);

  if (route.view === 'home') {
    navigate(routePath('home'), { replace: true });
    switchView('home', true);
    renderHome();
    return;
  }

  if (route.view === 'compare' || route.view === 'diagnostic') {
    // Le diagnostic personnalisé se calcule depuis les saisies de « Mon entreprise ». Rechargé, il
    // rouvre le dernier rapport gardé sur l'appareil (reports.js), celui que l'écran montrait. Sans
    // rapport gardé (lien partagé, autre appareil, démonstration), il renvoie vers le calcul.
    if (route.view === 'diagnostic' && !computeDiagnostic(benchState())) {
      var last = listReports()[0];
      if (last) restoreReport(last.id);
    }
    var target = route.view === 'diagnostic' && !computeDiagnostic(benchState()) ? 'compare' : route.view;
    // Le secteur que l'utilisateur regardait, que Mon entreprise reprend quand rien n'y est encore saisi.
    var carried = target === 'compare' && !benchState().sector ? lastSectorShown || getProfile().sector || null : null;
    // Adresse canonique sans entrée d'historique : ancienne ancre, ?q= déjà lu, adresse inconnue.
    navigate(routePath(target), { replace: true });
    switchView(target, true);
    if (target === 'diagnostic') { renderDiagnostic(); return; }
    // Arrivée depuis la landing avec la saisie de secteur du hero (?q=<saisie>).
    if (route.query || carried) prefillSector(route.query || carried);
    else renderFlow();
    // ?test saute au rapport une seule fois : « Modifier mes réponses » doit pouvoir revenir aux questions.
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
    removeStatic(viewId);
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
  removeStatic(viewId);
  clearSelection(viewId);
  // Le libellé peut venir d'un autre jeu, encore en route sur une arrivée directe : on les attend.
  Promise.all(SECTOR_VIEWS.map(function(t) {
    return ensureDataset(t).catch(function() {});
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
// La date d'écriture du jeu (meta.generated, posée par le pipeline) suit les sources du pied de
// page. Un jeu écrit avant cette date n'en porte pas, et la ligne reste cachée.
function renderUpdated(data) {
  var span = el('footerUpdated');
  var stamp = data && data.meta && data.meta.generated;
  var day = stamp ? new Date(stamp + 'T00:00:00') : null;
  if (!span || !day || isNaN(day)) return;
  span.textContent = 'Données mises à jour le ' + day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
  span.hidden = false;
}

document.addEventListener('DOMContentLoaded', async function() {
  // Sous <base href>, « #main-content » mènerait à la racine du site : le lien d'évitement
  // déplace donc le focus lui-même.
  var skip = document.querySelector('.skip-link');
  if (skip) skip.addEventListener('click', function(e) {
    e.preventDefault();
    var main = el('main-content');
    if (main) main.focus();
  });
  // Les icônes du squelette et du menu se dessinent sans attendre les données (l'état d'erreur en a besoin).
  lucide.createIcons();
  try {
    // Seul le jeu de la vue d'entrée retient l'affichage, le petit fichier des noms courts part
    // avec lui. Dimensions, tailles, historiques et cartes se chargent à l'approche de leurs
    // sections (render, map.js), jamais avec la page.
    var first = datasetFor(currentRoute().view);
    await loadDataset(first);
    // Le jeu d'entrée est là : ensureDataset ne doit ni le recharger ni remonter sa vue.
    datasetReady[first] = Promise.resolve();
    renderUpdated(getData(first));

    // Hide skeleton, reveal content
    var skeleton = document.getElementById('loadingSkeleton');
    if (skeleton) skeleton.style.display = 'none';

    // Init nav (pass render for theme toggle re-render)
    initNav(render);

    // Attach drawer button listeners
    attachDrawerListeners();

    // Setup the "Comparer" view
    initFlow();
    initDiagnostic();
    initHome();
    initChecklist();

    // Setup the Virginie assistant (floating launcher + conversation panel)
    initAssistant();

    // Setup inline sector comparison (NAF5) for each detail view
    initInlineCompare(render);

    // Monte la vue d'entrée. Les deux autres jeux attendent qu'on en ait besoin (ensureDataset).
    mountSectorView(first);
    loadOthersOnScroll();

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
    // La page est posée : js/map.js attendait ce signal pour mesurer sa distance à l'écran, car
    // avant, la page est courte et la carte paraît toute proche.
    document.documentElement.setAttribute('data-app-ready', '');
    window.dispatchEvent(new Event('appready'));

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
