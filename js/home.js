// ── Accueil de l'outil (/accueil/) ──
// Le point de départ, où mène le logo : Mon entreprise et les trois onglets de données, chacun
// illustré, le contenu Ayming à découvrir (js/sidebar-config.js), le contact, et l'ajout aux favoris.

import { el, esc } from './utils.js?v=f8b7846';
import { SIDEBAR_RESOURCES, FEATURED_RESOURCE } from './sidebar-config.js?v=f8b7846';
import { aymingUrl } from './sidebar.js?v=f8b7846';
import { VIEW_PATHS } from './route.js?v=f8b7846';
import { mockup } from './mockup.js?v=f8b7846';
import { listReports, deleteReport, restoreReport } from './reports.js?v=f8b7846';
import { openReport } from './diagnostic.js?v=f8b7846';
import { getProfile } from './profile.js?v=f8b7846';

// Ce que contient chaque onglet, sans chiffre : un chiffre daterait la page chaque année.
var TILES = [
  { view: 'compare', path: 'autodiagnostic', title: 'Mon entreprise', go: 'Situer mon entreprise',
    text: 'En quatre chiffres, situez votre entreprise face à son secteur et recevez votre rapport personnalisé en PDF.' },
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

function renderDiscover() {
  var box = el('home-discover');
  if (!box) return;
  var items = SIDEBAR_RESOURCES.slice();
  // Le contenu mis en avant ouvre la rangée, sans doublon s'il figure aussi dans la liste.
  var f = FEATURED_RESOURCE;
  if (f) {
    items = items.filter(function(r) { return r.path !== f.path; });
    items.unshift({ kind: f.kicker, title: f.title, text: f.text, path: f.path, campaign: f.campaign, featured: true });
  }
  box.innerHTML = items.map(function(r) {
    return '<a class="home-card' + (r.featured ? ' home-card-featured' : '') + '" href="' + esc(aymingUrl(r.path, r.campaign, 'accueil')) + '" target="_blank" rel="noopener">' +
      '<span class="home-card-kind">' + esc(r.kind) + '</span>' +
      '<span class="home-card-title">' + esc(r.title) + '</span>' +
      (r.text ? '<span class="home-card-text">' + esc(r.text) + '</span>' : '') +
      '<span class="home-card-go">Lire sur ayming.fr <i data-lucide="external-link"></i></span>' +
    '</a>';
  }).join('');
}

// ── Vos rapports (js/reports.js) ──
function shortDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderReports() {
  var band = el('home-reportsBand'), box = el('home-reports');
  if (!band || !box) return;
  var list = listReports();
  band.hidden = !list.length;
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
  renderDiscover();
  if (window.lucide) window.lucide.createIcons();
}

// ── Favoris ──
// Aucun navigateur ne laisse une page s'ajouter elle-même aux favoris. Le bouton met donc dans
// l'adresse le marqueur utm_source=bookmark (utm_medium=referral), que le favori enregistre : un retour par ce favori se
// lit comme tel (lead.js, captureAttribution) au lieu d'un accès direct. Les autres paramètres
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

export function initHome() {
  var btn = el('home-bookmark');
  if (!btn) return;
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    markBookmark();
    showTip();
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest || !e.target.closest('#home-bookmarkTip')) hideTip();
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('routechange', hideTip);
  window.addEventListener('profilechange', renderGreeting);
  window.addEventListener('reportschange', renderReports);
  el('home-reports').addEventListener('click', function(e) {
    var t = e.target.closest('[data-report-open], [data-report-del]');
    if (!t) return;
    var r = listReports()[Number(t.dataset.reportOpen || t.dataset.reportDel)];
    if (!r) return;
    if (t.hasAttribute('data-report-del')) { deleteReport(r.id); return; }
    if (restoreReport(r.id)) openReport();
  });
}
