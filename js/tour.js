// ── Visites guidées de l'outil (Driver.js, chargé en CDN avec defer) ──
//
// Trois visites, chacune au moment où elle sert (divulgation progressive) :
// - La visite de l'outil, depuis le message d'accueil : l'accueil, Mon entreprise, les trois
//   onglets de données, Virginie et les ressources. Elle ne change pas de vue.
// - La visite des onglets AT, MP et Trajet : choisir un secteur, lire ses chiffres, comparer, et
//   Virginie pour les commenter.
// Ces deux visites ne se lancent jamais seules (l'accueil puis une visite d'affilée
// agaçaient) : à la première arrivée sur la vue, une bulle près de Virginie la propose. « Non merci »
// ne la repropose plus, « Visite guidée » et les premiers pas la lancent toujours.
// « Visite guidée » (menu latéral, « ? » sur mobile) rejoue celle de la vue affichée.
// Le message d'accueil s'ouvre à la première visite (drapeau localStorage, simple confort de
// l'utilisateur), sur la page d'accueil, l'autodiagnostic ou un secteur ouvert depuis la landing.
// Les visites suivantes arrivent sans message. Rien ne s'ouvre seul sur un autre lien profond ni en démo.
// Les textes des popovers sont écrits ici, aucun ne vient de data/*.json ni d'une saisie.

import { state } from './state.js?v=24ffa11';
import { tradeCodes, naf5Matches } from './search-synonyms.js?v=24ffa11';
import { el, viewEl, comboAria, comboKeys, ensureStyle, trackEvent, readStored, writeStored } from './utils.js?v=24ffa11';
import { currentRoute, isDemo, goTo } from './route.js?v=24ffa11';
import { mockup } from './mockup.js?v=24ffa11';
import { getData } from './data.js?v=24ffa11';
import { getProfile, setProfile, capitalize } from './profile.js?v=24ffa11';
import { renderTag } from './badge.js?v=24ffa11';
import { markStep } from './checklist.js?v=24ffa11';
import { sendLead, SIGNUP_HANDLER_URL } from './lead.js?v=24ffa11';

var FLAG = 'sinistralite-tour-done';                 // l'accueil et la visite de l'outil
var SIGNUP_FLAG = 'sinistralite-signed-up';           // le prénom et l'e-mail sont donnés : l'accueil ne se rouvre plus seul
var SECTOR_FLAG = 'sinistralite-sector-tour-done';    // la visite des onglets de données
var SECTOR_VIEWS = ['at', 'mp', 'trajet'];
// La bulle qui propose la visite des onglets, déclinée une fois pour toutes.
var OFFER_DECLINED = 'sinistralite-sector-tour-declined';
var wantTour = false;   // les premiers pas demandent la visite : elle se lance sans bulle

// L'adresse telle qu'elle était à l'ouverture de la page, avant que le routage ne la corrige.
// L'accueil (/accueil/, et toute adresse inconnue) et /autodiagnostic/, où mènent les boutons de
// la landing, ne sont pas des liens profonds : le message d'accueil doit s'y ouvrir. Une vue
// sectorielle ou le rapport en sont un, sauf ouverts depuis la landing : rien ne s'y ouvre à
// l'arrivée, les visites attendent la prochaine vue que l'utilisateur ouvre lui-même.
var landed = fromLanding();
var deepLink = !landed && ['home', 'compare'].indexOf(currentRoute().view) < 0;
// La saisie du champ de secteur de la landing (/accueil/?q=), lue avant que le routeur ne nettoie l'adresse.
var landingQuery = currentRoute().query;
var arrived = false;   // vrai dès le premier changement de vue fait par l'utilisateur

var tour = null;
var landingPending = false;   // un secteur venu de la landing attend la fin de l'accueil
var tourStarting = false;     // « Visite de l'outil » ferme l'accueil : la visite prend la suite

// Une page ouverte depuis la landing (son bouton, sa recherche ou l'un de ses secteurs), à
// l'exclusion d'un rechargement ou d'un retour arrière, qui gardent le même référent.
function fromLanding() {
  try {
    var nav = window.performance.getEntriesByType('navigation')[0];
    if ((nav && nav.type !== 'navigate') || !document.referrer) return false;
    var ref = new URL(document.referrer);
    var root = new URL('./', document.baseURI);
    return ref.origin === root.origin && (ref.pathname === root.pathname || ref.pathname === root.pathname + 'index.html');
  } catch (e) { return false; }
}

function readFlag(key) { return readStored(key) === '1'; }
function writeFlag(key) { writeStored(key, '1'); }

function waitFor(test, ms) {
  return new Promise(function (resolve) {
    var t0 = Date.now();
    (function poll() {
      var ok = false;
      try { ok = test(); } catch (e) {}
      if (ok || Date.now() - t0 > ms) return resolve(ok);
      setTimeout(poll, 60);
    })();
  });
}

function visible(node) { return !!node && node.getClientRects().length > 0; }
function firstVisible(nodes) {
  for (var i = 0; i < nodes.length; i++) if (visible(nodes[i])) return nodes[i];
  return null;
}

// Le rail ou la barre du bas portent chacun un onglet « Mon entreprise », un seul est affiché.
function compareTab() { return firstVisible(document.querySelectorAll('.nav-item[data-view="compare"]')); }
// Les trois onglets de données, du rail ou de la barre du bas. Driver n'éclaire qu'un élément :
// un cadre invisible épouse les trois onglets, et disparaît avec la visite.
function viewTabs() {
  var tabs = ['at', 'mp', 'trajet'].map(function (v) {
    return firstVisible(document.querySelectorAll('.nav-item[data-view="' + v + '"]'));
  }).filter(Boolean);
  if (!tabs.length) return null;
  var r = tabs.reduce(function (acc, t) {
    var b = t.getBoundingClientRect();
    return { top: Math.min(acc.top, b.top), left: Math.min(acc.left, b.left), bottom: Math.max(acc.bottom, b.bottom), right: Math.max(acc.right, b.right) };
  }, { top: Infinity, left: Infinity, bottom: -Infinity, right: -Infinity });
  var box = el('tourTabsBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'tourTabsBox';
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:-1';
    document.body.appendChild(box);
  }
  box.style.top = r.top + 'px'; box.style.left = r.left + 'px';
  box.style.width = (r.right - r.left) + 'px'; box.style.height = (r.bottom - r.top) + 'px';
  return box;
}

function sectorShown() {
  var view = state.activeView;
  var vs = state.views[view];
  var grid = viewEl(view, 'kpiGrid');
  return SECTOR_VIEWS.indexOf(view) >= 0 && !!(vs && vs.code) && !!grid && grid.children.length > 0 && visible(grid);
}
// La vue nationale d'un onglet de données, quand ses chiffres sont affichés.
function nationalShown() {
  var view = state.activeView;
  if (SECTOR_VIEWS.indexOf(view) < 0) return false;
  var box = viewEl(view, 'nationalState');
  return !!box && visible(box) && !!box.querySelector('.kpi-grid');
}
// La vue doit montrer ce que dit l'adresse : une vue nue redirigée vers le secteur du profil
// (app.js) affiche encore un instant la vue nationale, que la visite ne doit pas prendre.
function dataViewShown() { return currentRoute().code ? sectorShown() : nationalShown(); }

function busy() {
  var dlg = el('welcomeDialog');
  return (tour && tour.isActive()) || (dlg && dlg.open);
}

// Chaque arrêt porte mock: [vue, partie] : la maquette de l'outil (js/mockup.js) en tête de bulle,
// la partie dont parle l'arrêt allumée, comme les bulles de Microsoft 365.
function withMock(step) {
  if (!step.mock) return step;
  var m = step.mock;
  step.popover.onPopoverRender = function (pop) {
    var old = pop.wrapper.querySelector('.tour-mock');
    if (old) old.remove();
    var box = document.createElement('div');
    box.className = 'tour-mock' + (m[1] === 'bot' ? ' is-bottom' : '');
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = mockup(m[0], m[1]);
    pop.wrapper.insertBefore(box, pop.wrapper.firstChild);
    if (window.lucide) window.lucide.createIcons();
  };
  return step;
}

// Driver.js retire aria-haspopup, aria-expanded et aria-controls de l'élément qu'il quitte, les valeurs
// propres à l'élément comprises. On les note avant qu'il n'écrive les siennes, et on les rend après.
var ARIA = ['aria-haspopup', 'aria-expanded', 'aria-controls'];

function saveAria(saved, node) {
  if (!node || saved.some(function (s) { return s.node === node; })) return;
  saved.push({ node: node, values: ARIA.map(function (a) { return node.getAttribute(a); }) });
}

function restoreAria(saved, active) {
  saved.forEach(function (s) {
    if (s.node === active) return;
    ARIA.forEach(function (a, i) {
      if (s.values[i] === null) s.node.removeAttribute(a);
      else s.node.setAttribute(a, s.values[i]);
    });
  });
}

// Les feuilles de la visite (tour.css, et driver.css de jsDelivr, avec son empreinte) ne chargent
// qu'à la première visite ou au premier message d'accueil.
var DRIVER_CSS = 'https://cdn.jsdelivr.net/npm/driver.js@1.8.0/dist/driver.css';
var DRIVER_CSS_SRI = 'sha384-XUGWln86d3kDvw/W1Qbii8QQyeWs2LcFYfGhYrmSZ0ZiXxowttKpfdhPdLE+WMFx';
var driverStyle = null;
function driverStyles() {
  if (!driverStyle) driverStyle = new Promise(function (resolve) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = DRIVER_CSS;
    link.integrity = DRIVER_CSS_SRI;
    link.crossOrigin = 'anonymous';
    link.onload = link.onerror = function () { resolve(); };
    document.head.appendChild(link);
  });
  return driverStyle.then(function () { return ensureStyle('styles/tour.css'); }).catch(function () {});
}

var driving = false;   // les feuilles arrivent : un second appel ne lance pas une seconde visite
var tourName = 'outil';   // la visite lancée : « outil » ou « secteur », pour la mesure GA4
function drive(steps, onDone) {
  var api = window.driver && window.driver.js;
  if (!api || !api.driver) return;   // Driver pas encore chargé, ou bloqué : la page vit sans
  if (driving || (tour && tour.isActive())) return;
  driving = true;
  driverStyles().then(function () { driving = false; driveNow(api, steps, onDone); });
}

function driveNow(api, steps, onDone) {
  if (tour && tour.isActive()) return;
  // Le panneau de Virginie masquerait son propre lanceur.
  var panel = el('assistantPanel');
  var closeBtn = el('assistantClose');
  if (panel && !panel.hidden && closeBtn) closeBtn.click();
  var saved = [];
  // Mesure GA4 : quelle visite, et l'arrêt où elle s'est fermée (« 3/5 », « 5/5 » quand elle va au bout).
  var name = tourName, reached = 0;
  trackEvent('tour_start_atmp', { method: name, view: state.activeView });
  tour = api.driver({
    popoverClass: 'tour-popover',
    showProgress: steps.length > 1,
    progressText: '{{current}} sur {{total}}',
    nextBtnText: 'Suivant',
    prevBtnText: 'Précédent',
    doneBtnText: 'Terminer',
    allowClose: true,
    stagePadding: 6,
    steps: steps.map(withMock).map(function (st, i) {
      // Au premier arrêt il n'y a rien avant : pas de « Précédent ».
      if (i === 0) st.popover.showButtons = ['next', 'close'];
      return st;
    }),
    onHighlightStarted: function (node, step, opts) {
      saveAria(saved, node);
      if (opts && opts.state && opts.state.activeIndex != null) reached = Math.max(reached, opts.state.activeIndex + 1);
    },
    onHighlighted: function (node) { restoreAria(saved, node); },
    // Driver appelle onDestroyed pendant sa propre destruction : la visite suivante attend la fin.
    onDestroyed: function () {
      trackEvent('tour_end_atmp', { method: name, step: reached + '/' + steps.length, view: state.activeView });
      restoreAria(saved, null);
      var box = el('tourTabsBox');
      if (box) box.remove();
      if (onDone) setTimeout(onDone, 300);
    }
  });
  tour.drive();
}

function virginieStep(view, description) {
  return {
    mock: [view, 'bot'],
    element: function () { return el('assistantLaunchBtn'); },
    popover: {
      title: 'Une question\u00a0? Demandez à Virginie',
      description: description || 'Elle répond à vos questions sur le secteur et vous montre ce qui s\'écarte de la moyenne nationale.',
      side: 'left', align: 'end'
    }
  };
}

// ── La visite de l'outil ──
function startToolTour() {
  // Le drapeau se pose au départ : fermée tôt, Driver peut sauter onDestroyed, la visite
  // ne doit pas se relancer seule pour autant.
  writeFlag(FLAG);
  tourName = 'outil';
  var steps = [
    {
      mock: ['home', 'home'],
      element: function () { return firstVisible(document.querySelectorAll('.nav-item[data-view="home"]')); },
      popover: {
        title: 'L\'accueil',
        description: 'Votre point de départ\u00a0: les chiffres des secteurs, votre autodiagnostic et nos ressources sont à un clic d\'ici.',
        side: 'right', align: 'start'
      }
    },
    // D'abord les chiffres du secteur, puis l'autodiagnostic pour aller plus loin.
    {
      mock: ['at', 'tabs'],
      element: viewTabs,
      popover: {
        title: 'Les chiffres de votre secteur',
        description: 'Découvrez les chiffres clés de votre secteur en accidents du travail, maladies professionnelles et accidents de trajet.',
        side: 'right', align: 'start'
      }
    },
    {
      mock: ['compare', 'compare'],
      element: compareTab,
      popover: {
        title: 'Mon entreprise',
        description: 'Pour aller plus loin, situez votre entreprise face à son secteur en sept questions, puis partagez le résultat avec votre équipe, pour des lieux de travail plus sûrs.',
        side: 'right', align: 'start'
      }
    },
    // La visite finit sur Virginie, à qui poser toute question en chemin.
    virginieStep('home', 'Ouvrez sa bulle, en bas à droite de l\'écran\u00a0: elle répond à vos questions et peut vous faire visiter chaque page.')
  ];
  drive(steps, function () { maybeOfferTour(6000); });
}

// ── La visite des onglets AT, MP et Trajet ──
function startDataTour() {
  writeFlag(SECTOR_FLAG);
  markStep('sector');
  tourName = 'secteur';
  var view = state.activeView;
  drive(sectorShown() ? sectorSteps(view) : nationalSteps(view));
}

function nationalSteps(view) {
  var box = viewEl(view, 'nationalState');
  return [
    {
      mock: [view, 'search'],
      element: function () { return viewEl(view, 'searchInput'); },
      popover: {
        title: 'Choisissez votre secteur',
        description: 'Tapez un code NAF ou un mot-clé. L\'onglet affiche alors les chiffres de ce secteur face à la moyenne nationale.',
        side: 'bottom', align: 'start'
      }
    },
    {
      mock: [view, 'kpis'],
      element: function () { return box.querySelector('.kpi-grid'); },
      popover: {
        title: 'Les chiffres nationaux',
        description: 'Tant qu\'aucun secteur n\'est choisi, l\'onglet montre la France entière, tous secteurs confondus.',
        side: 'top', align: 'center'
      }
    },
    {
      mock: [view, 'chart'],
      element: function () { return box.querySelector('.top-sectors'); },
      popover: {
        title: 'Les secteurs les plus touchés',
        description: 'Choisissez-en un pour l\'explorer, puis comparez-le à d\'autres secteurs.',
        side: 'top', align: 'start'
      }
    },
    virginieStep(view)
  ];
}

function sectorSteps(view) {
  var steps = [
    {
      mock: [view, 'search'],
      element: function () { return viewEl(view, 'searchInput'); },
      popover: {
        title: 'Changez de secteur',
        description: 'Tapez un code NAF ou un mot-clé pour afficher un autre secteur.',
        side: 'bottom', align: 'start'
      }
    },
    {
      mock: [view, 'kpis'],
      element: function () { return viewEl(view, 'kpiGrid'); },
      popover: {
        title: 'Les chiffres clés',
        description: 'Chaque indicateur du secteur est comparé à la moyenne nationale. Les graphiques plus bas détaillent les causes, les victimes et l\'évolution.',
        side: 'top', align: 'center'
      }
    }
  ];
  if (visible(viewEl(view, 'cmpAddBtn'))) {
    steps.push({
      mock: [view, 'add'],
      element: function () { return viewEl(view, 'cmpAddBtn'); },
      popover: {
        title: 'Comparez',
        description: 'Ajoutez d\'autres secteurs pour les voir côte à côte.',
        side: 'bottom', align: 'start'
      }
    });
  }
  steps.push(virginieStep(view));
  return steps;
}

// « Visite guidée » rejoue la visite de la vue affichée.
export function startTour() {
  if (dataViewShown()) startDataTour();
  else startToolTour();
}

// À la première arrivée sur un onglet AT, MP ou Trajet, la bulle propose sa visite, une fois la vue
// prête et rien d'autre ouvert. delay laisse le temps de découvrir la page avant que la bulle
// n'arrive. Mon entreprise n'a pas de visite : le questionnaire s'explique seul.
function maybeOfferTour(delay) {
  if (isDemo() || (deepLink && !arrived && !wantTour) || SECTOR_VIEWS.indexOf(state.activeView) < 0) return;
  if (!wantTour && (readFlag(SECTOR_FLAG) || readFlag(OFFER_DECLINED))) return;
  var view = state.activeView;
  waitFor(dataViewShown, 4000).then(function (ok) {
    if (!ok || busy() || state.activeView !== view) return;
    if (wantTour) { wantTour = false; startDataTour(); return; }
    setTimeout(function () {
      if (state.activeView === view && dataViewShown() && !busy()) showOffer();
    }, delay == null ? 1200 : delay);
  });
}

// La bulle s'accroche au lanceur de Virginie, et cache l'accroche « Ayming insights » le temps d'y répondre.
function showOffer() {
  var box = el('tourOffer'), launcher = el('assistantLauncher');
  if (!box || !launcher || launcher.style.display === 'none') return;
  el('tourOfferText').textContent = 'Je vous montre comment lire un secteur et le comparer, en quatre étapes.';
  box.hidden = false;
  launcher.classList.add('has-offer');
}

function hideOffer() {
  var box = el('tourOffer'), launcher = el('assistantLauncher');
  if (box) box.hidden = true;
  if (launcher) launcher.classList.remove('has-offer');
}

function initOffer() {
  var box = el('tourOffer');
  if (!box) return;
  el('tourOfferYes').addEventListener('click', function () { hideOffer(); startTour(); });
  function decline() {
    writeFlag(OFFER_DECLINED);
    hideOffer();
  }
  el('tourOfferNo').addEventListener('click', decline);
  el('tourOfferX').addEventListener('click', decline);
}

export function initTour() {
  document.querySelectorAll('[data-tour-start]').forEach(function (btn) { btn.addEventListener('click', startTour); });
  // Un clic sur Virginie pendant une visite la ferme, avant que Virginie ne s'ouvre (phase de capture).
  var launcher = el('assistantLauncher');
  if (launcher) launcher.addEventListener('click', function (e) {
    if (tour && tour.isActive()) tour.destroy();
    if (!e.target.closest('#tourOffer')) hideOffer();
  }, true);
  initWelcome();
  initOffer();
  // « Découvrir les secteurs » des premiers pas lance la visite.
  window.addEventListener('wanttour', function () { wantTour = true; hideOffer(); setTimeout(function () { maybeOfferTour(0); }, 50); });
  // Une visite de vue déjà vue avant que la liste ne la demande compte comme faite.
  if (readFlag(SECTOR_FLAG)) markStep('sector');
  window.addEventListener('routechange', function () { arrived = true; hideOffer(); maybeOfferTour(); });
  if (isDemo()) return;
  // Le temps que la vue d'entrée finisse de se monter. Sans inscription, l'accueil s'ouvre partout,
  // sur un lien partagé et l'autodiagnostic compris, par-dessus la page demandée.
  setTimeout(function () {
    if (!readFlag(SIGNUP_FLAG)) { landingPending = !!landingQuery; openWelcome(); return; }
    if (deepLink || document.body.getAttribute('data-view') === 'diagnostic') return;
    if (landingQuery) openQuery(landingQuery);
    else maybeOfferTour();
  }, 600);
}

// Une visite déjà accueillie qui revient de la landing ou d'une invitation avec un secteur (/accueil/?q=) :
// pas de questions à reposer, le secteur s'ouvre, ou la recherche remplie pour un mot-clé.
function openQuery(q) {
  var d = getData('at');
  var code = q.toUpperCase().replace(/[.\s]/g, '');
  if (d && d.by_naf5[code]) { goTo('at', code); return; }
  // Un mot du métier (« restaurant ») qui désigne un secteur précis ouvre ce secteur.
  var trade = d ? tradeCodes(q).filter(function (c) { return d.by_naf5[c]; })[0] : null;
  if (trade) { goTo('at', trade); return; }
  window.location.replace(new URL('accidents-du-travail/?q=' + encodeURIComponent(q), document.baseURI).href);
}

// ── Message d'accueil ──
// Deux étapes obligatoires, sans « Passer » ni fermeture : le prénom et l'e-mail (envoyés à Pardot
// avec la provenance de la visite, js/lead.js), puis le secteur de la personne, toujours vide au départ,
// même ouvert depuis un lien partagé, qui reste affiché derrière. Vient ensuite l'accueil, qui propose
// la visite ou de découvrir seul. Le prénom, l'e-mail et le secteur vont au profil (profile.js), que
// l'étape contact du rapport reprend. Tant que l'e-mail n'est pas donné, l'accueil revient à chaque visite.
var LABELS = ['welcomeQ0', 'welcomeQ1', 'welcomeTitle'];
var wStep = 0;
var draft = { prenom: '', email: '', sector: '' };
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var sentEmail = '';

// Le tag suit chaque saisie, et « Continuer » ne s'active qu'une fois la réponse donnée : sans réponse,
// seul « Passer » fait avancer.
function paintTag() {
  renderTag(el('welcomeTag'), draft);
  // L'étape du prénom et de l'e-mail garde son bouton actif : un clic dit ce qui manque (advance).
  var answered = [true, !!draft.sector];
  el('welcomeDialog').querySelectorAll('.welcome-step').forEach(function (sec) {
    var btn = sec.querySelector('[data-welcome-next]');
    if (btn) btn.disabled = !answered[Number(sec.dataset.step)];
  });
}

function showStep(n) {
  wStep = n;
  var dlg = el('welcomeDialog');
  dlg.querySelectorAll('.welcome-step').forEach(function (sec) { sec.hidden = Number(sec.dataset.step) !== n; });
  dlg.querySelectorAll('.welcome-dots span').forEach(function (d, i) { d.classList.toggle('on', i === n); });
  dlg.setAttribute('aria-labelledby', LABELS[n]);
  if (n === 1) el('welcomeHi').textContent = draft.prenom ? 'Bonjour, ' + draft.prenom + '.' : '';
  if (n === 2) {
    el('welcomeTitle').textContent = draft.prenom
      ? 'Bienvenue, ' + draft.prenom + '\u00a0!'
      : 'Bienvenue dans l\'outil Sinistralité AT/MP';
  }
  paintTag();
  var focus = n === 0 ? (draft.prenom ? el('welcomeEmail') : el('welcomeName')) : n === 1 ? el('welcomeSector') : el('welcomeTour');
  if (focus) setTimeout(function () {
    focus.focus();
    if (n === 1 && !draft.sector && focus.value) focus.dispatchEvent(new Event('input'));
  }, 0);
}

// Les deux étapes sont obligatoires : « Continuer » ne passe qu'une réponse valide.
function advance() {
  if (wStep === 0) {
    var err = !draft.prenom ? 'Indiquez votre prénom.'
      : !EMAIL_RE.test(draft.email) ? 'Cette adresse e-mail semble incomplète, par exemple prenom.nom@entreprise.fr.' : '';
    el('welcomeErr').textContent = err;
    if (err) return;
    setProfile({ prenom: draft.prenom, email: draft.email });
    signUp();
  } else if (wStep === 1) {
    if (!draft.sector) return;
    setProfile({ sector: draft.sector });
  }
  showStep(Math.min(wStep + 1, 2));
}

// L'inscription part une fois par adresse : rouvrir l'accueil sans changer l'e-mail ne renvoie rien.
// Le champ piège rempli trahit un robot, rien ne part. En démo non plus.
function signUp() {
  writeFlag(SIGNUP_FLAG);
  if (isDemo() || !SIGNUP_HANDLER_URL || el('welcomeSite').value || draft.email === sentEmail) return;
  sentEmail = draft.email;
  var route = currentRoute();
  sendLead({
    prenom: draft.prenom, email: draft.email,
    consent: el('welcomeConsent').checked ? 'true' : '',
    message: 'Inscription à l\'outil Sinistralité AT/MP' + (route.code ? ' (arrivée sur le secteur ' + route.code + ')' : '')
  }, SIGNUP_HANDLER_URL).then(function (ok) {
    if (ok) trackEvent('sign_up', { method: 'welcome' });
    else { sentEmail = ''; trackEvent('error_atmp', { step: 'signup_send' }); }
  });
}

// Le secteur se choisit au niveau le plus fin (NAF5), celui que le badge et les vues affichent.
function sectorMatches(query) { return naf5Matches(getData('at'), query, 5); }

function initSectorQuestion() {
  var input = el('welcomeSector'), box = el('welcomeSectorAc');
  var aria = comboAria(input, box), active = -1;
  function close() { box.classList.remove('open'); active = -1; aria.closed(); }
  function pick(code) {
    var d = getData('at');
    draft.sector = code;
    input.value = code + ' ' + (d && d.by_naf5[code] ? d.by_naf5[code].libelle : '');
    close();
    paintTag();
  }
  input.addEventListener('input', function () {
    draft.sector = '';
    paintTag();
    var list = sectorMatches(input.value);
    if (!list.length) { close(); return; }
    box.innerHTML = list.map(function (m) {
      return '<div class="ac-item" data-code="' + m.code + '"><span class="code">' + m.code + '</span>' +
        '<span class="libelle">' + m.libelle + '</span></div>';
    }).join('');
    box.querySelectorAll('.ac-item').forEach(function (it) {
      it.addEventListener('click', function () { pick(this.dataset.code); });
    });
    active = -1;
    box.classList.add('open');
    aria.opened();
  });
  input.addEventListener('blur', function () { setTimeout(close, 150); });
  comboKeys(input, {
    items: function () { return box.classList.contains('open') ? box.querySelectorAll('.ac-item') : []; },
    index: function () { return active; },
    setIndex: function (n) { active = n; },
    // Entrée sans liste ouverte, une fois le secteur choisi : question suivante.
    onEnter: function (items) { if (!items.length && draft.sector) { advance(); return true; } return false; },
    onEscape: close
  });
}

// Le profil préremplit les réponses déjà données. Le secteur d'un lien partagé ne remplit rien :
// c'est celui de l'expéditeur, la personne donne le sien. Un mot-clé tapé sur la landing reste dans
// le champ, et la liste des secteurs s'ouvre à la question.
function prefillDraft() {
  var p = getProfile();
  var d = getData('at');
  draft.prenom = p.prenom;
  draft.email = p.email;
  var typed = landingQuery.toUpperCase().replace(/[.\s]/g, '');
  draft.sector = p.sector || (d && d.by_naf5[typed] ? typed : '');
  el('welcomeName').value = draft.prenom;
  el('welcomeEmail').value = draft.email;
  el('welcomeErr').textContent = '';
  el('welcomeSector').value = draft.sector && d && d.by_naf5[draft.sector]
    ? draft.sector + ' ' + d.by_naf5[draft.sector].libelle : landingQuery;
}

// Un dialogue modal rend le reste de la page inerte, bandeau des cookies compris : l'accueil
// attend que le visiteur y ait répondu. Sans conteneur GTM (js/gtm.js sans id, ou bloqué), rien à
// attendre ; si seul le bandeau ne se charge pas, l'accueil s'ouvre quand même au bout de 4 s.
function afterCookieChoice(fn) {
  var done = false;
  var go = function () { if (!done) { done = true; fn(); } };
  var answered = function () {
    var cs = window.CookieScript && window.CookieScript.instance;
    return !cs || !!(cs.currentState && cs.currentState().action);
  };
  var gtmOn = (window.dataLayer || []).some(function (e) { return e && e.event === 'gtm.js'; });
  if (!gtmOn || window.gtmBlocked || (window.CookieScript && answered())) return go();
  ['gtmblocked', 'CookieScriptAccept', 'CookieScriptAcceptAll', 'CookieScriptReject'].forEach(function (n) {
    window.addEventListener(n, go);
  });
  if (!window.CookieScript) {
    window.addEventListener('CookieScriptLoaded', function () { if (answered()) go(); });
    setTimeout(function () { if (!window.CookieScript) go(); }, 4000);
  }
}

function openWelcome() {
  afterCookieChoice(showWelcome);
}

function showWelcome() {
  var dlg = el('welcomeDialog');
  if (!dlg || typeof dlg.showModal !== 'function' || dlg.open) return;
  writeFlag(FLAG);
  prefillDraft();
  ensureStyle('styles/tour.css').catch(function () {}).then(function () {
    if (dlg.open) return;
    dlg.showModal();
    showStep(0);
    trackEvent('signup_view_atmp', { entry: currentRoute().code ? 'sector' : document.body.getAttribute('data-view') || '' });
  });
}

function initWelcome() {
  var dlg = el('welcomeDialog');
  if (!dlg) return;
  var close = function () { if (dlg.open) dlg.close(); };
  // Les deux étapes ne se ferment pas : ni Échap, ni clic sur le fond. L'accueil final, lui, se ferme.
  dlg.addEventListener('cancel', function (e) { if (wStep < 2) e.preventDefault(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg && wStep === 2) close(); });
  // Fermé sans lancer la visite de l'outil : la bulle de la vue viendra, mais pas aussitôt,
  // pour laisser découvrir la page. Venu de la landing, il ouvre le secteur recueilli, sinon sa saisie.
  dlg.addEventListener('close', function () {
    var open = landingPending && !tourStarting;
    landingPending = false;
    tourStarting = false;
    if (open) { openQuery(draft.sector || landingQuery); return; }
    if (!(tour && tour.isActive())) maybeOfferTour(6000);
  });
  el('welcomeTour').addEventListener('click', function () { tourStarting = true; close(); startToolTour(); });
  el('welcomeSkip').addEventListener('click', close);
  el('welcomeForm').addEventListener('submit', function (e) { e.preventDefault(); advance(); });
  dlg.querySelectorAll('section:not([data-step="0"]) [data-welcome-next]').forEach(function (b) { b.addEventListener('click', advance); });
  var name = el('welcomeName');
  name.addEventListener('input', function () { draft.prenom = capitalize(name.value.replace(/\s+/g, ' ').trim().slice(0, 40)); paintTag(); });
  var email = el('welcomeEmail');
  email.addEventListener('input', function () { draft.email = email.value.trim().slice(0, 120); paintTag(); });
  initSectorQuestion();
  // « Mon prénom et mon secteur », dans le menu du compte, rouvre l'inscription et le secteur.
  var again = el('sbProfile');
  if (again) again.addEventListener('click', openWelcome);
  // Les étapes prénom et secteur des premiers pas (checklist.js) rouvrent aussi les questions.
  window.addEventListener('openwelcome', openWelcome);
}
