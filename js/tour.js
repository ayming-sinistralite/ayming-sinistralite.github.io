// ── Visite guidée de l'outil (Driver.js, chargé en CDN avec defer) ──
//
// Quatre arrêts : la recherche de secteur, les chiffres clés, Virginie, puis Mon entreprise.
// Les chiffres clés n'existent qu'une fois un secteur choisi, la visite en charge donc un
// d'exemple quand aucun ne l'est, puis remet l'utilisateur là où il était à la fin.
// Départ automatique à la première visite seulement (drapeau localStorage, simple confort
// de l'utilisateur), jamais sur un lien profond, en démo ou dans l'autodiagnostic : le
// bouton « ? » de la barre du haut reste alors la seule porte.
// Les textes des popovers sont écrits ici, aucun ne vient de data/*.json ni d'une saisie.

import { state } from './state.js?v=58f7592';
import { el, viewEl } from './utils.js?v=58f7592';
import { currentRoute, goTo } from './route.js?v=58f7592';

var FLAG = 'sinistralite-tour-done';
var SAMPLE_CODE = '4711D';
var SECTOR_VIEWS = ['at', 'mp', 'trajet'];

// L'adresse telle qu'elle était à l'ouverture de la page, avant que le routage ne la corrige.
// /autodiagnostic/ est l'entrée par défaut, celle que le routage écrit lui-même sur app.html ou
// une adresse inconnue : un rechargement la retrouve, ce n'est pas un lien profond. Une vue
// sectorielle, le diagnostic ou une saisie venue de la landing (?q=) en sont un.
var entryRoute = currentRoute();
var deepLink = !(entryRoute.view === 'compare' && !entryRoute.query);

var running = false;      // vrai de l'appel à startTour jusqu'à la fermeture
var tour = null;
var origin = null;

function readFlag() {
  try { return window.localStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
}
function writeFlag() {
  try { window.localStorage.setItem(FLAG, '1'); } catch (e) {}
}
function isDemo() { return /[?&](demo|test)\b/.test(window.location.search); }

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

// Le rail ou la barre du bas portent chacun un onglet « Mon entreprise », un seul est affiché.
function compareTab() {
  var tabs = document.querySelectorAll('.nav-item[data-view="compare"]');
  for (var i = 0; i < tabs.length; i++) if (visible(tabs[i])) return tabs[i];
  return null;
}

function currentView() { return state.activeView; }

function sectorSelected() {
  var vs = state.views[currentView()];
  return !!(vs && vs.code);
}

// Charge un secteur d'exemple pour que la grille de chiffres clés existe.
function ensureSector() {
  if (sectorSelected()) return Promise.resolve();
  var view = currentView();
  goTo(view, SAMPLE_CODE);
  return waitFor(function () {
    var grid = viewEl(view, 'kpiGrid');
    return grid && grid.children.length > 0 && visible(grid);
  }, 4000);
}

function finish() {
  running = false;
  writeFlag();
  // Remet l'utilisateur sur la vue d'où il est parti, sans laisser le secteur d'exemple.
  if (origin) goTo(origin.view, origin.code);
  else goTo('compare');
}

export function startTour() {
  if (running && tour && !tour.isActive()) running = false;   // une fermeture sans rappel ne bloque pas
  if (running) return;
  var api = window.driver && window.driver.js;
  if (!api || !api.driver) return;   // Driver pas encore chargé, ou bloqué : la page vit sans
  running = true;
  // Le drapeau se pose au départ : fermée tôt, Driver peut sauter onDestroyed, la visite
  // ne doit pas se relancer seule pour autant.
  writeFlag();
  origin = currentRoute();

  // Le panneau de Virginie masquerait son propre lanceur.
  var panel = el('assistantPanel');
  var closeBtn = el('assistantClose');
  if (panel && !panel.hidden && closeBtn) closeBtn.click();

  var toSectorView = Promise.resolve();
  if (SECTOR_VIEWS.indexOf(currentView()) < 0) {
    goTo('at');
    toSectorView = waitFor(function () {
      return currentView() === 'at' && visible(viewEl('at', 'searchInput'));
    }, 4000);
  }

  toSectorView.then(function () {
    tour = api.driver({
      popoverClass: 'tour-popover',
      showProgress: true,
      progressText: '{{current}} sur {{total}}',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      allowClose: true,
      stagePadding: 6,
      onDestroyed: finish,
      steps: [
        {
          element: function () { return viewEl(currentView(), 'searchInput'); },
          popover: {
            title: 'Cherchez un secteur',
            description: 'Tapez un code NAF ou un mot-clé. L\'outil affiche alors les accidents du travail, les maladies professionnelles et les accidents de trajet de ce secteur.',
            side: 'bottom', align: 'start',
            onNextClick: function () { ensureSector().then(function () { tour.moveNext(); }); }
          }
        },
        {
          element: function () { return viewEl(currentView(), 'kpiGrid'); },
          popover: {
            title: 'Les chiffres clés',
            description: 'Pour le secteur choisi, chaque indicateur est comparé à la moyenne nationale. Ici, un secteur d\'exemple.',
            side: 'top', align: 'center'
          }
        },
        {
          element: function () { return el('assistantLaunchBtn'); },
          popover: {
            title: 'Virginie, votre assistante',
            description: 'Elle commente les graphiques du secteur et relève ce qui s\'écarte de la moyenne nationale.',
            side: 'left', align: 'end'
          }
        },
        {
          element: function () { return compareTab(); },
          popover: {
            title: 'Mon entreprise',
            description: 'Saisissez votre effectif, vos accidents et votre masse salariale pour situer votre entreprise face à son secteur et obtenir un rapport personnalisé en PDF.',
            side: 'right', align: 'start'
          }
        }
      ]
    });
    tour.drive();
  });
}

export function initTour() {
  // Le « ? » de la barre du haut (mobile) et l'entrée « Visite guidée » du menu latéral.
  document.querySelectorAll('[data-tour-start]').forEach(function (btn) { btn.addEventListener('click', startTour); });
  initWelcome();
  if (readFlag() || deepLink || isDemo()) return;
  if (document.body.getAttribute('data-view') === 'diagnostic') return;
  // Le temps que la vue d'entrée finisse de se monter.
  setTimeout(openWelcome, 600);
}

// ── Message d'accueil ──
// À la première visite, un accueil propose la visite guidée ou l'autodiagnostic, plutôt que
// d'imposer la visite. Le drapeau se pose à l'ouverture : l'accueil ne revient pas.
function openWelcome() {
  var dlg = el('welcomeDialog');
  if (!dlg || typeof dlg.showModal !== 'function' || dlg.open) return;
  writeFlag();
  dlg.showModal();
}

function initWelcome() {
  var dlg = el('welcomeDialog');
  if (!dlg) return;
  var close = function () { if (dlg.open) dlg.close(); };
  el('welcomeClose').addEventListener('click', close);
  // Un clic sur le fond, hors de la fenêtre, ferme aussi.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  el('welcomeTour').addEventListener('click', function () { close(); startTour(); });
  el('welcomeCompare').addEventListener('click', function () {
    close();
    goTo('compare');
  });
}
