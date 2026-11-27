// ── Accueil de l'outil (/accueil/) ──
// Le point de départ, où mène le logo : Mon entreprise et les trois onglets de données, chacun
// illustré, et vos rapports, et l'ajout aux favoris.

import { el, esc, trackEvent } from './utils.js?v=36466a3';
import { VIEW_PATHS } from './route.js?v=36466a3';
import { mockup } from './mockup.js?v=36466a3';
import { listReports, deleteReport, restoreReport } from './reports.js?v=36466a3';
import { openReport } from './diagnostic.js?v=36466a3';
import { getProfile } from './profile.js?v=36466a3';

// Ce que contient chaque onglet, sans chiffre : un chiffre daterait la page chaque année.
var TILES = [
  { view: 'compare', path: 'autodiagnostic', title: 'Mon entreprise', go: 'Situer mon entreprise',
    text: 'Six questions sur votre entreprise, et votre rapport personnalisé face à son secteur, à lire à l\'écran et en PDF.' },
  { view: 'at', title: 'Accidents du travail', go: 'Explorer',
    text: 'Les victimes, les lésions, les circonstances et la gravité des accidents du travail de chaque secteur.' },
  { view: 'mp', title: 'Maladies professionnelles', go: 'Explorer',
    text: 'Les maladies reconnues dans chaque secteur, les TMS, les troubles psychiques et leur gravité.' },
  { view: 'trajet', title: 'Accidents de trajet', go: 'Explorer',
    text: 'Les accidents de trajet de chaque secteur, leurs causes et leurs circonstances.' }
];

function tile(t) {
  return '<a class="home-tile' + (t.view === 'compare' ? ' home-tile-main' : '') + '" href="' + (t.path || VIEW_PATHS[t.view]) + '/">' +
    '<span class="home-tile-body">' +
      '<span class="home-tile-title">' + t.title + '</span>' +
      '<span class="home-tile-text">' + t.text + '</span>' +
      '<span class="home-tile-go">' + t.go + ' <span aria-hidden="true">→</span></span>' +
    '</span>' +
    '<span class="home-tile-ill" aria-hidden="true">' + mockup(t.view) + '</span>' +
  '</a>';
}

function renderTiles() {
  var box = el('home-tiles');
  if (!box) return;
  box.innerHTML = TILES.map(tile).join('');
}

// ── Vos rapports (js/reports.js) ──
function shortDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderReports() {
  var band = el('home-reportsBand'), box = el('home-reports');
  if (!band || !box) return;
  var list = listReports();
  var note = band.querySelector('.home-reports-note');
  if (note) note.hidden = !list.length;
  // Sans rapport, la section reste et pousse à en créer un, plutôt que d'apparaître au premier.
  if (!list.length) {
    box.innerHTML = '<div class="home-reports-empty">' +
      '<span class="home-reports-empty-art" aria-hidden="true"><span class="home-ghosts">' + '<span class="home-ghost"><i data-lucide="file-text"></i><span><b></b><em></em></span><u></u></span>' + '<span class="home-ghost"><i data-lucide="file-text"></i><span><b></b><em></em></span><u></u></span>' + '</span></span>' +
      '<span class="home-card-title">Aucun rapport pour l\'instant</span>' +
      '<span class="home-card-text">Vos rapports apparaîtront ici, gardés sur cet appareil, pour les rouvrir, les télécharger ou les partager.</span>' +
      '<a class="home-btn home-btn-primary" href="autodiagnostic/">Créer mon rapport</a>' +
    '</div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  box.innerHTML = list.map(function(r, i) {
    var a = r.answers, company = a.contact && a.contact.societe;
    return '<article class="home-report">' +
      '<span class="home-card-kind">Rapport du ' + shortDate(r.date) + '</span>' +
      '<span class="home-card-title">' + esc(company || a.sectorLib || a.sector) + '</span>' +
      '<span class="home-card-text">' + esc(a.sector) + (company ? ' · ' + esc(a.sectorLib || '') : '') +
        (a.effectif ? ' · ' + esc(String(a.effectif)) + ' salariés' : '') + '</span>' +
      '<span class="home-report-actions">' +
        '<button type="button" class="home-btn home-btn-primary" data-report-open="' + i + '">Ouvrir le rapport</button>' +
        '<button type="button" class="home-report-del" data-report-del="' + i + '" aria-label="Supprimer ce rapport"><i data-lucide="x"></i></button>' +
      '</span>' +
    '</article>';
  }).join('');
  if (window.lucide) window.lucide.createIcons();
}

// Le titre de l'accueil salue la personne par le prénom donné à l'accueil (profile.js).
function renderGreeting() {
  var t = document.querySelector('#view-home .home-title');
  if (!t) return;
  var p = getProfile();
  t.textContent = p.prenom ? 'Bonjour, ' + p.prenom + '\u00a0!' : 'Bienvenue dans l\'outil Sinistralité AT/MP';
}

export function renderHome() {
  renderGreeting();
  renderReports();
  renderTiles();
  if (window.lucide) window.lucide.createIcons();
}

// ── Favoris ──
// Aucun navigateur ne laisse une page s'ajouter elle-même aux favoris. Le bouton met donc dans
// l'adresse le marqueur utm_source=bookmark (utm_medium=referral), que le favori enregistre : un retour par ce favori se
// lit comme tel (js/attribution.js) au lieu d'un accès direct. Les autres paramètres
// de l'adresse sont gardés. Une carte flottante, sans décaler la page, montre le raccourci.
function bookmarkKeys() {
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (touch) return null;
  return [mac ? '⌘' : 'Ctrl', 'D'];
}

var MARK = { utm_source: 'bookmark', utm_medium: 'referral' };

function setMark(on) {
  try {
    var url = new URL(window.location.href);
    Object.keys(MARK).forEach(function(k) {
      if (on) url.searchParams.set(k, MARK[k]);
      else if (url.searchParams.get(k) === MARK[k]) url.searchParams.delete(k);
    });
    history.replaceState(history.state, '', url.href);
  } catch (e) { /* adresse inchangée, le favori reste possible */ }
}

// Le marqueur ne sert qu'au favori pris sur l'accueil : il quitte l'adresse au premier changement
// de vue, pour ne pas suivre un lien partagé ensuite.
function markBookmark() {
  setMark(true);
  window.addEventListener('routechange', function clear() {
    window.removeEventListener('routechange', clear);
    setMark(false);
  });
}

var hideTimer = null;
function hideTip() {
  var tip = el('home-bookmarkTip');
  if (tip) tip.hidden = true;
  clearTimeout(hideTimer);
}

function showTip() {
  var tip = el('home-bookmarkTip');
  var keys = bookmarkKeys();
  tip.innerHTML =
    '<span class="bm-star" aria-hidden="true"><i data-lucide="star"></i></span>' +
    '<span class="bm-text"><strong>Gardez l\'outil sous la main</strong>' +
      (keys
        ? '<span class="bm-keys">Appuyez sur <kbd>' + keys[0] + '</kbd><span aria-hidden="true">+</span><kbd>' + keys[1] + '</kbd></span>'
        : '<span class="bm-keys">Ajoutez cette page à vos favoris depuis le menu de votre navigateur.</span>') +
    '</span>';
  tip.hidden = false;
  // Rejoue l'animation à chaque clic.
  tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
  if (window.lucide) window.lucide.createIcons();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideTip, 9000);
}

// Aussi l'action « Ajouter aux favoris » du guide de Virginie (js/assistant.js), d'où `method`.
// Le clic seul se mesure ici ; le retour par le favori se lit en source « bookmark » dans GA4.
export function offerBookmark(method) {
  trackEvent('bookmark_atmp', { method: method || 'accueil' });
  markBookmark();
  showTip();
}

export function initHome() {
  var btn = el('home-bookmark');
  if (!btn) return;
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    offerBookmark('accueil');
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest || !e.target.closest('#home-bookmarkTip')) hideTip();
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('routechange', hideTip);
  window.addEventListener('profilechange', renderGreeting);
  window.addEventListener('reportschange', renderReports);
  el('home-reports').addEventListener('click', function(e) {
    var t = e.target.closest('[data-report-open], [data-report-del], [data-report-confirm], [data-report-keep]');
    if (!t) return;
    if (t.hasAttribute('data-report-keep')) { cancelDelete(); return; }
    var r = listReports()[Number(t.dataset.reportOpen || t.dataset.reportDel || t.dataset.reportConfirm)];
    if (!r) return;
    if (t.hasAttribute('data-report-del')) { askDelete(t.closest('.home-report-actions'), t.dataset.reportDel); return; }
    if (t.hasAttribute('data-report-confirm')) { deleteReport(r.id); return; }
    if (restoreReport(r.id)) openReport();
  });
  // Une question ouverte se referme par Échap ou par un clic hors de ses boutons, et le rapport reste.
  document.addEventListener('click', function(e) {
    if (!e.target.closest || !e.target.closest('.home-report-actions.is-confirm, [data-report-del]')) cancelDelete();
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') cancelDelete(); });
}

// Le × ne supprime pas tout de suite : il remplace les actions de la carte par une question,
// sans boîte de dialogue, et le focus va sur « Garder ».
function askDelete(actions, i) {
  cancelDelete();
  actions = document.querySelectorAll('#home-reports .home-report-actions')[Number(i)] || actions;
  if (!actions) return;
  actions.classList.add('is-confirm');
  actions.innerHTML =
    '<span class="home-report-ask" id="home-reportAsk">Supprimer ce rapport ?</span>' +
    '<button type="button" class="home-btn home-btn-danger" data-report-confirm="' + Number(i) + '" aria-describedby="home-reportAsk">Supprimer</button>' +
    '<button type="button" class="home-btn home-btn-ghost" data-report-keep>Garder</button>';
  actions.querySelector('[data-report-keep]').focus();
}

function cancelDelete() {
  if (document.querySelector('#home-reports .home-report-actions.is-confirm')) renderReports();
}
