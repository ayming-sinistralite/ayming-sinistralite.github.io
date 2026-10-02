// ── Menu latéral (ordinateur) ──
// Repli mémorisé, points rouges, ressources, annonce et compte. Le contenu des ressources et de
// l'annonce vit dans sidebar-config.js. Le nom du compte reste en mémoire vive : rien n'est stocké.

import { state } from './state.js?v=58f7592';
import { el, esc } from './utils.js?v=58f7592';
import { getData, getStore } from './data.js?v=58f7592';
import { SIDEBAR_RESOURCES, SIDEBAR_PROMO } from './sidebar-config.js?v=58f7592';

var COLLAPSE_KEY = 'sinistralite-sidebar';
var PROMO_KEY = 'sinistralite-sidebar-promo';
var AYMING = 'https://www.ayming.fr/';

// Même convention que le rapport (report.js), utm_content distingue le menu du rapport.
function aymingUrl(path, campaign) {
  return AYMING + path + '?utm_source=sinistralite&utm_medium=referral&utm_campaign=' + campaign + '&utm_content=sidebar';
}

function readStore(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* stockage refusé, le menu marche sans */ }
}

// ── Compte : « Invité » jusqu'à l'étape contact du diagnostic ──
var account = null;

function renderAccount() {
  var name = 'Invité', org = '', initial = 'I';
  if (account) {
    name = account.name;
    org = account.org;
    initial = name.charAt(0).toUpperCase();
  }
  el('sbName').textContent = name;
  el('sbOrg').textContent = org;
  el('sbAvatar').textContent = initial;
  el('sbAccBtn').setAttribute('aria-label', 'Menu du compte, ' + name);
}

// Appelé par lead.js quand l'étape contact du diagnostic nomme la personne.
export function setAccount(fields) {
  var name = [fields && fields.prenom, fields && fields.nom].filter(Boolean).join(' ').trim();
  if (!name) return;
  account = { name: name, org: (fields.societe || '').trim() };
  if (el('sbName')) renderAccount();
}

// ── Menus déroulants ──
var openBtn = null;

function closeMenus(returnFocus) {
  if (!openBtn) return;
  var btn = openBtn;
  openBtn = null;
  btn.setAttribute('aria-expanded', 'false');
  el(btn.getAttribute('aria-controls')).hidden = true;
  if (returnFocus) btn.focus();
}

function toggleMenu(btn) {
  var wasOpen = openBtn === btn;
  closeMenus(false);
  if (wasOpen) return;
  openBtn = btn;
  btn.setAttribute('aria-expanded', 'true');
  el(btn.getAttribute('aria-controls')).hidden = false;
  syncThemeSwitch();
}

function syncThemeSwitch() {
  var dark = document.documentElement.getAttribute('data-theme') === 'dark';
  el('sbThemeSwitch').setAttribute('aria-checked', dark ? 'true' : 'false');
}

// ── Repli ──
function setCollapsed(collapsed, persist) {
  document.documentElement.classList.toggle('sb-collapsed', collapsed);
  var btn = el('sbCollapse');
  var label = collapsed ? 'Ouvrir le menu' : 'Réduire le menu';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  // Replié, les vues n'ont plus de texte : l'infobulle prend le relais.
  document.querySelectorAll('#sidebar [data-label]').forEach(function(item) {
    if (collapsed) item.setAttribute('title', item.getAttribute('data-label'));
    else item.removeAttribute('title');
  });
  closeMenus(false);
  if (persist) writeStore(COLLAPSE_KEY, collapsed ? '1' : '0');
}

// ── Points rouges ──
// Mon entreprise tant que l'autoévaluation n'est pas remplie. MP ou Trajet quand l'indice de
// fréquence du secteur sélectionné y dépasse le niveau national et que l'onglet n'a pas encore
// été ouvert pour ce secteur. Les valeurs sont celles que les vues calculent déjà.
var seen = {};
var lastSector = null;   // dernier secteur affiché, retenu quand on passe par Mon entreprise

function selfEvalFilled() {
  var v = state.views.compare;
  return !!(v.sector && v.effectif > 0 && v.accidents != null);
}

// Le niveau de la vue qui porte le secteur peut différer de celui de l'onglet visé : on cherche
// le code dans les niveaux de fiche, du plus fin au plus large.
function aboveNational(viewId, code) {
  var data = getData(viewId);
  if (!data || !data.meta || !data.meta.national) return false;
  var levels = ['naf5', 'naf4', 'naf2'];
  for (var i = 0; i < levels.length; i++) {
    var store = getStore(viewId, levels[i]);
    var entry = store && store[code];
    if (entry && entry.stats) return entry.stats.indice_frequence > data.meta.national.indice_frequence;
  }
  return false;
}

function setDot(viewId, on) {
  var item = document.querySelector('#sidebar .nav-item[data-view="' + viewId + '"]');
  if (!item) return;
  item.querySelector('.sb-dot').hidden = !on;
  var base = item.getAttribute('data-label');
  item.setAttribute('aria-label', on ? base + ', à regarder' : base);
}

export function refreshSidebar() {
  if (!el('sidebar')) return;
  var active = state.activeView;
  var vs = state.views[active];
  if (active !== 'compare' && active !== 'diagnostic' && vs && vs.code) {
    lastSector = vs.code;
    seen[active + '|' + vs.code] = true;
  }
  setDot('compare', !selfEvalFilled());
  ['mp', 'trajet'].forEach(function(viewId) {
    var on = !!lastSector && !seen[viewId + '|' + lastSector] &&aboveNational(viewId, lastSector);
    setDot(viewId, on);
  });
}

// ── Contenu ──
function renderResources() {
  el('sbResPop').innerHTML = SIDEBAR_RESOURCES.map(function(r) {
    return '<a class="sb-pop-item" href="' + esc(aymingUrl(r.path, r.campaign)) + '" target="_blank" rel="noopener">' +
      '<span class="sb-pop-txt"><span class="sb-pop-k">' + esc(r.kind) + '</span><span class="sb-pop-t">' + esc(r.title) + '</span></span>' +
      '<i data-lucide="external-link" class="sb-pop-ext"></i></a>';
  }).join('');
}

function renderPromo() {
  var promo = el('sbPromo');
  var p = SIDEBAR_PROMO;
  if (!p || readStore(PROMO_KEY) === p.id) { promo.hidden = true; return; }
  promo.innerHTML =
    '<span class="sb-promo-k">' + esc(p.kicker) + '</span>' +
    '<strong class="sb-promo-t">' + esc(p.title) + '</strong>' +
    '<p class="sb-promo-p">' + esc(p.text) + '</p>' +
    '<a class="sb-promo-cta" href="' + esc(aymingUrl(p.path, p.campaign)) + '" target="_blank" rel="noopener">' + esc(p.cta) + '</a>' +
    '<button type="button" class="sb-promo-x" id="sbPromoX" aria-label="Fermer l\'annonce"><i data-lucide="x"></i></button>';
  promo.hidden = false;
  el('sbPromoX').addEventListener('click', function() {
    writeStore(PROMO_KEY, p.id);
    promo.hidden = true;
  });
}

// toggleTheme : la bascule d'nav.js, qui relance aussi les graphiques.
export function initSidebar(toggleTheme) {
  if (!el('sidebar')) return;
  renderResources();
  renderPromo();
  renderAccount();
  setCollapsed(readStore(COLLAPSE_KEY) === '1', false);
  if (window.lucide) window.lucide.createIcons();

  el('sbCollapse').addEventListener('click', function() {
    setCollapsed(!document.documentElement.classList.contains('sb-collapsed'), true);
  });
  el('sbResBtn').addEventListener('click', function() { toggleMenu(this); });
  el('sbAccBtn').addEventListener('click', function() { toggleMenu(this); });
  el('sbThemeSwitch').addEventListener('click', function() {
    toggleTheme();
    syncThemeSwitch();
  });
  el('sbResPop').addEventListener('click', function(e) {
    if (e.target.closest('a')) closeMenus(false);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMenus(true);
  });
  document.addEventListener('click', function(e) {
    if (openBtn && !e.target.closest('.sb-menu')) closeMenus(false);
  });

  // L'autoévaluation se remplit dans la vue Mon entreprise : le point suit la saisie.
  ['input', 'change', 'click'].forEach(function(type) {
    el('view-compare').addEventListener(type, function() { setTimeout(refreshSidebar, 0); });
  });
  refreshSidebar();
}
