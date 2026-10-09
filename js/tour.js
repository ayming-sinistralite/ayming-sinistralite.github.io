// ── Visites guidées de l'outil (Driver.js, chargé en CDN avec defer) ──
//
// Trois visites, chacune au moment où elle sert (divulgation progressive) :
// - La visite de l'outil, depuis le message d'accueil : l'accueil, Mon entreprise, les trois
//   onglets de données, Virginie et les ressources. Elle ne change pas de vue.
// - La visite de Mon entreprise : le secteur, les trois chiffres à saisir, le résultat, puis le
//   rapport complet. Elle se lance seule la première fois que le calcul est à l'écran, une fois
//   l'accueil fermé ou la visite de l'outil terminée.
// - La visite des onglets AT, MP et Trajet : choisir un secteur, lire ses chiffres, comparer, et
//   Virginie pour les commenter. Elle se lance seule à la première ouverture d'un de ces
//   onglets, national ou sectoriel, une fois ses chiffres affichés.
// « Visite guidée » (menu latéral, « ? » sur mobile) rejoue celle de la vue affichée.
// Le message d'accueil s'ouvre à la première visite (drapeau localStorage, simple confort de
// l'utilisateur), sur la page d'accueil, l'autodiagnostic ou un secteur ouvert depuis la landing.
// Les visites suivantes arrivent sans message. Rien ne s'ouvre seul sur un autre lien profond ni en démo.
// Les textes des popovers sont écrits ici, aucun ne vient de data/*.json ni d'une saisie.

import { state } from './state.js?v=f8b7846';
import { el, viewEl, normalize, expandQuery, matchesTerms, codeQuery, comboAria, comboKeys } from './utils.js?v=f8b7846';
import { currentRoute, isDemo, goTo } from './route.js?v=f8b7846';
import { mockup } from './mockup.js?v=f8b7846';
import { getData } from './data.js?v=f8b7846';
import { getProfile, setProfile, capitalize } from './profile.js?v=f8b7846';
import { renderTag } from './badge.js?v=f8b7846';
import { markStep } from './checklist.js?v=f8b7846';
import { MOTIFS } from './report.js?v=f8b7846';

var FLAG = 'sinistralite-tour-done';                 // l'accueil et la visite de l'outil
var COMPANY_FLAG = 'sinistralite-company-tour-done';  // la visite de Mon entreprise
var SECTOR_FLAG = 'sinistralite-sector-tour-done';    // la visite des onglets de données
var SECTOR_VIEWS = ['at', 'mp', 'trajet'];

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

function readFlag(key) {
  try { return window.localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function writeFlag(key) {
  try { window.localStorage.setItem(key, '1'); } catch (e) {}
}

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
function companyShown() { return state.activeView === 'compare' && visible(el('bench-step1')); }

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
    box.className = 'tour-mock' + (m[1] === 'bot' || m[1] === 'resources' ? ' is-bottom' : '');
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

function drive(steps, onDone) {
  var api = window.driver && window.driver.js;
  if (!api || !api.driver) return;   // Driver pas encore chargé, ou bloqué : la page vit sans
  if (tour && tour.isActive()) return;
  // Le panneau de Virginie masquerait son propre lanceur.
  var panel = el('assistantPanel');
  var closeBtn = el('assistantClose');
  if (panel && !panel.hidden && closeBtn) closeBtn.click();
  var saved = [];
  tour = api.driver({
    popoverClass: 'tour-popover',
    showProgress: steps.length > 1,
    progressText: '{{current}} sur {{total}}',
    nextBtnText: 'Suivant',
    prevBtnText: 'Précédent',
    doneBtnText: 'Terminer',
    allowClose: true,
    stagePadding: 6,
    steps: steps.map(withMock),
    onHighlightStarted: function (node) { saveAria(saved, node); },
    onHighlighted: function (node) { restoreAria(saved, node); },
    // Driver appelle onDestroyed pendant sa propre destruction : la visite suivante attend la fin.
    onDestroyed: function () {
      restoreAria(saved, null);
      var box = el('tourTabsBox');
      if (box) box.remove();
      window.dispatchEvent(new Event('tourend'));   // la carte gagnée attend la fin (badge.js)
      if (onDone) setTimeout(onDone, 300);
    }
  });
  tour.drive();
}

function virginieStep(view) {
  return {
    mock: [view, 'bot'],
    element: function () { return el('assistantLaunchBtn'); },
    popover: {
      title: 'Virginie, votre assistante',
      description: 'Elle répond à vos questions sur le secteur et vous montre ce qui s\'écarte de la moyenne nationale.',
      side: 'left', align: 'end'
    }
  };
}

// ── La visite de l'outil ──
function startToolTour() {
  // Le drapeau se pose au départ : fermée tôt, Driver peut sauter onDestroyed, la visite
  // ne doit pas se relancer seule pour autant.
  writeFlag(FLAG);
  var steps = [
    {
      mock: ['home', 'home'],
      element: function () { return firstVisible(document.querySelectorAll('.nav-item[data-view="home"]')); },
      popover: {
        title: 'L\'accueil',
        description: 'Tout l\'outil part d\'ici, et le logo vous y ramène.',
        side: 'right', align: 'start'
      }
    },
    {
      mock: ['compare', 'compare'],
      element: compareTab,
      popover: {
        title: 'Mon entreprise',
        description: 'Votre rapport personnalisé en PDF, à partir de quatre chiffres sur votre entreprise.',
        side: 'right', align: 'start'
      }
    },
    {
      mock: ['at', 'tabs'],
      element: viewTabs,
      popover: {
        title: 'Les chiffres de chaque secteur',
        description: 'Votre secteur face à la moyenne nationale, en accidents du travail, maladies professionnelles et trajet.',
        side: 'right', align: 'start'
      }
    },
    virginieStep('at')
  ];
  // Les ressources vivent dans le menu latéral, absent sur mobile.
  if (visible(el('sbResBtn'))) {
    steps.push({
      mock: ['home', 'resources'],
      element: function () { return el('sbResBtn'); },
      popover: {
        title: 'Les ressources',
        description: 'Les guides, articles, livres blancs et webinaires d\'Ayming sur les risques professionnels, en accès libre.',
        side: 'right', align: 'start'
      }
    });
  }
  drive(steps, maybeViewTour);
}

// ── La visite de Mon entreprise ──
// Les trois chiffres à saisir, du premier champ au dernier.
function countFields() {
  var n = el('bench-effectif');
  var last = el('bench-masse');
  while (n && last && !n.contains(last)) n = n.parentElement;
  return n;
}

function startCompanyTour() {
  writeFlag(COMPANY_FLAG);
  markStep('company-tour');
  var hasSector = !!state.views.compare.sector;
  drive([
    {
      mock: ['compare', 'sector'],
      element: function () { return el('bench-sectorBlock'); },
      popover: {
        title: 'Votre secteur',
        description: hasSector
          ? 'Votre secteur est déjà choisi. La croix permet d\'en prendre un autre.'
          : 'Tapez votre métier ou votre code NAF (code APE).',
        side: 'bottom', align: 'start'
      }
    },
    {
      mock: ['compare', 'fields'],
      element: countFields,
      popover: {
        title: 'Trois chiffres',
        description: 'Votre effectif, vos accidents du travail reconnus avec arrêt sur l\'année et votre masse salariale annuelle. Le calcul se fait dans votre navigateur.',
        side: 'bottom', align: 'start'
      }
    },
    {
      mock: ['compare', 'result'],
      element: function () { return el('bench-results'); },
      popover: {
        title: 'Votre position',
        description: 'Votre fréquence face à votre secteur et aux entreprises de votre taille, et votre cotisation estimée.',
        side: 'left', align: 'start'
      }
    },
    {
      mock: ['compare', 'cta'],
      element: function () { return document.querySelector('#bench-results [data-go-diagnostic]'); },
      popover: {
        title: 'Votre rapport complet',
        description: 'Quelques questions de plus sur vos arrêts et votre taux, et vous recevez votre diagnostic personnalisé en PDF.',
        side: 'top', align: 'start'
      }
    }
  ]);
}

// ── La visite des onglets AT, MP et Trajet ──
function startDataTour() {
  writeFlag(SECTOR_FLAG);
  markStep('sector');
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
        description: 'Cliquez sur l\'un d\'eux pour l\'explorer, puis comparez-le à d\'autres secteurs.',
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
  else if (companyShown()) startCompanyTour();
  else startToolTour();
}

// La visite de la vue affichée, si elle n'a jamais été vue, une fois la vue prête.
function maybeViewTour() {
  if (isDemo() || (deepLink && !arrived) || state.activeView === 'home') return;
  var company = state.activeView === 'compare';
  if (readFlag(company ? COMPANY_FLAG : SECTOR_FLAG)) return;
  waitFor(company ? companyShown : dataViewShown, 4000).then(function (ok) {
    if (!ok || busy()) return;
    if (companyShown() && !readFlag(COMPANY_FLAG)) startCompanyTour();
    else if (dataViewShown() && !readFlag(SECTOR_FLAG)) startDataTour();
  });
}

export function initTour() {
  document.querySelectorAll('[data-tour-start]').forEach(function (btn) { btn.addEventListener('click', startTour); });
  // Un clic sur Virginie pendant une visite la ferme, avant que Virginie ne s'ouvre (phase de capture).
  var launcher = el('assistantLauncher');
  if (launcher) launcher.addEventListener('click', function () { if (tour && tour.isActive()) tour.destroy(); }, true);
  initWelcome();
  // Une visite de vue déjà vue avant que la liste ne la demande compte comme faite.
  if (readFlag(COMPANY_FLAG)) markStep('company-tour');
  if (readFlag(SECTOR_FLAG)) markStep('sector');
  window.addEventListener('routechange', function () { arrived = true; maybeViewTour(); });
  if (isDemo() || deepLink) return;
  if (document.body.getAttribute('data-view') === 'diagnostic') return;
  // Le temps que la vue d'entrée finisse de se monter.
  setTimeout(function () {
    if (!readFlag(FLAG)) openWelcome();
    else if (landingQuery) openQuery(landingQuery);
    else maybeViewTour();
  }, 600);
}

// Une visite déjà accueillie qui revient de la landing ou d'une invitation avec un secteur (/accueil/?q=) :
// pas de questions à reposer, le secteur s'ouvre, ou la recherche remplie pour un mot-clé.
function openQuery(q) {
  var d = getData('at');
  var code = q.toUpperCase().replace(/[.\s]/g, '');
  if (d && d.by_naf5[code]) { goTo('at', code); return; }
  window.location.replace(new URL('accidents-du-travail/?q=' + encodeURIComponent(q), document.baseURI).href);
}

// ── Message d'accueil ──
// Trois questions d'abord, comme un assistant qui fait connaissance : le prénom, le secteur, puis
// la raison de la visite, chacune passable. Le badge « Bonjour, je m'appelle » se remplit pendant la saisie. Vient ensuite
// l'accueil, au prénom de la personne s'il est connu, qui propose la visite ou de découvrir seul.
// Les réponses vont au profil (profile.js), sur l'appareil seulement. Le drapeau se pose à
// l'ouverture : le message ne revient pas, sauf par « Mon prénom et mon secteur » du menu du compte.
var LABELS = ['welcomeQ0', 'welcomeQ1', 'welcomeQ2', 'welcomeTitle'];
var wStep = 0;
var draft = { prenom: '', sector: '', motif: '' };

// Le tag suit chaque saisie, et « Continuer » ne s'active qu'une fois la réponse donnée : sans réponse,
// seul « Passer » fait avancer.
function paintTag() {
  renderTag(el('welcomeTag'), draft);
  var answered = [!!draft.prenom, !!draft.sector];
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
  el('welcomeMotifs').querySelectorAll('[data-motif]').forEach(function (b) {
    b.classList.toggle('is-on', b.dataset.motif === draft.motif);
  });
  if (n === 3) {
    el('welcomeTitle').textContent = draft.prenom
      ? 'Bienvenue, ' + draft.prenom + '\u00a0!'
      : 'Bienvenue dans l\'outil Sinistralité AT/MP';
  }
  paintTag();
  var focus = n === 0 ? el('welcomeName') : n === 1 ? el('welcomeSector')
    : n === 2 ? el('welcomeMotifs').querySelector('[data-motif]') : el('welcomeTour');
  if (focus) setTimeout(function () {
    focus.focus();
    if (n === 1 && !draft.sector && focus.value) focus.dispatchEvent(new Event('input'));
  }, 0);
}

// Passer au suivant, en gardant (keep) ou non la réponse de l'étape.
function advance(keep) {
  if (wStep === 0) {
    if (!keep) draft.prenom = '';
    setProfile({ prenom: draft.prenom });
  } else if (wStep === 1) {
    if (!keep) draft.sector = '';
    if (draft.sector) setProfile({ sector: draft.sector });
  } else if (wStep === 2) {
    if (!keep) draft.motif = '';
    if (draft.motif) setProfile({ motif: draft.motif });
  }
  showStep(Math.min(wStep + 1, 3));
}

// Le secteur se choisit au niveau le plus fin (NAF5), celui que le badge et les vues affichent.
function sectorMatches(query) {
  var data = getData('at');
  var raw = (query || '').trim();
  if (!data || !raw) return [];
  var index = data.naf_index ? data.naf_index.filter(function (e) { return e.level === 'naf5'; })
    : Object.keys(data.by_naf5).map(function (c) { return { code: c, libelle: data.by_naf5[c].libelle }; });
  var up = codeQuery(raw);
  if (up) {
    return index.filter(function (e) { return e.code.toUpperCase().indexOf(up) === 0; }).slice(0, 5);
  }
  var terms = expandQuery(raw);
  // Un mot du libellé qui commence par la saisie passe avant une simple occurrence
  // (« tra » : Transports avant Extraction).
  function rank(e) {
    var lib = normalize(e.libelle);
    return terms.some(function (t) { return (' ' + lib).indexOf(' ' + t) >= 0; }) ? 0 : 1;
  }
  return index.filter(function (e) {
    return matchesTerms(e, terms);
  }).sort(function (a, b) { return rank(a) - rank(b); }).slice(0, 5);
}

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
    onEnter: function (items) { if (!items.length && draft.sector) { advance(true); return true; } return false; },
    onEscape: close
  });
}

// Le secteur de l'adresse (un secteur ouvert depuis la landing) préremplit la question.
function prefillDraft() {
  var p = getProfile();
  var d = getData('at');
  var routed = currentRoute().code;
  draft.prenom = p.prenom;
  draft.motif = p.motif;
  var typed = landingQuery.toUpperCase().replace(/[.\s]/g, '');
  draft.sector = p.sector || (routed && d && d.by_naf5[routed] ? routed : '') || (d && d.by_naf5[typed] ? typed : '');
  el('welcomeName').value = draft.prenom;
  // Un mot-clé tapé sur la landing reste dans le champ : la liste des secteurs s'ouvre à la question.
  el('welcomeSector').value = draft.sector && d && d.by_naf5[draft.sector]
    ? draft.sector + ' ' + d.by_naf5[draft.sector].libelle : landingQuery;
}

function openWelcome() {
  var dlg = el('welcomeDialog');
  if (!dlg || typeof dlg.showModal !== 'function' || dlg.open) return;
  writeFlag(FLAG);
  prefillDraft();
  dlg.showModal();
  showStep(0);
}

function initWelcome() {
  var dlg = el('welcomeDialog');
  if (!dlg) return;
  var close = function () { if (dlg.open) dlg.close(); };
  el('welcomeClose').addEventListener('click', close);
  // Un clic sur le fond, hors de la fenêtre, ferme aussi.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  // Fermé sans lancer la visite de l'outil (bouton, croix, Échap) : la visite de la vue suit.
  dlg.addEventListener('close', function () { setTimeout(maybeViewTour, 300); });
  el('welcomeTour').addEventListener('click', function () { close(); startToolTour(); });
  el('welcomeSkip').addEventListener('click', close);
  // La raison de la visite : un clic répond et passe à la suite. Elle donne son titre à la carte
  // (badge.js) et ouvre le diagnostic sur sa première vraie étape (diagnostic.js).
  var motifs = el('welcomeMotifs');
  motifs.innerHTML = MOTIFS.map(function (m) {
    return '<button type="button" class="welcome-choice" data-motif="' + m.key + '">' + m.label + '</button>';
  }).join('');
  motifs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-motif]');
    if (!b) return;
    draft.motif = b.dataset.motif;
    advance(true);
  });
  dlg.querySelectorAll('[data-welcome-next]').forEach(function (b) { b.addEventListener('click', function () { advance(true); }); });
  dlg.querySelectorAll('[data-welcome-skip]').forEach(function (b) { b.addEventListener('click', function () { advance(false); }); });
  var name = el('welcomeName');
  name.addEventListener('input', function () { draft.prenom = capitalize(name.value.replace(/\s+/g, ' ').trim().slice(0, 40)); paintTag(); });
  name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); advance(true); } });
  initSectorQuestion();
  // « Mon prénom et mon secteur », dans le menu du compte, rouvre les deux questions.
  var again = el('sbProfile');
  if (again) again.addEventListener('click', openWelcome);
  // Les étapes prénom et secteur des premiers pas (checklist.js) rouvrent aussi les questions.
  window.addEventListener('openwelcome', openWelcome);
}
