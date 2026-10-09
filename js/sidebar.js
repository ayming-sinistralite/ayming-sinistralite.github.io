// ── Menu latéral (ordinateur) ──
// Repli mémorisé, points rouges, ressources, accès à la carte et compte. Le contenu des ressources
// vit dans sidebar-config.js. Le nom du compte reste en mémoire vive : rien n'est stocké.

import { state } from './state.js?v=f8b7846';
import { el, esc } from './utils.js?v=f8b7846';
import { getData, getStore } from './data.js?v=f8b7846';
import { SIDEBAR_RESOURCE_TYPES } from './sidebar-config.js?v=f8b7846';
import { checklistActive, checklistComplete } from './checklist.js?v=f8b7846';
import { getProfile } from './profile.js?v=f8b7846';
import { sectorLabel, badgeTitle, openBadge } from './badge.js?v=f8b7846';

var COLLAPSE_KEY = 'sinistralite-sidebar';
var AYMING = 'https://www.ayming.fr/';

// Même convention que le rapport (report.js), utm_content distingue le menu, l'accueil et le rapport.
export function aymingUrl(path, campaign, content) {
  return AYMING + path + '?utm_source=sinistralite&utm_medium=referral&utm_campaign=' + campaign + '&utm_content=' + (content || 'sidebar');
}

function readStore(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* stockage refusé, le menu marche sans */ }
}

// ── Compte : « Invité », le prénom et le secteur de l'accueil, puis l'étape contact du diagnostic ──
var account = null;

function renderAccount() {
  var name = 'Invité', org = '', initial = 'I';
  var p = getProfile();
  if (p.prenom || p.sector) {
    name = p.prenom || 'Invité';
    org = sectorLabel(p.sector);
    initial = name.charAt(0).toUpperCase();
  }
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
// Chaque bouton connaît son menu ici, pas par son aria-controls : la visite guidée (Driver.js)
// retire aria-controls et aria-expanded de l'élément qu'elle vient de montrer.
var MENUS = { sbResBtn: 'sbResPop', sbAccBtn: 'sbAccPop' };
var openBtn = null;

function closeMenus(returnFocus) {
  if (!openBtn) return;
  var btn = openBtn;
  openBtn = null;
  btn.setAttribute('aria-expanded', 'false');
  el(MENUS[btn.id]).hidden = true;
  if (returnFocus) btn.focus();
}

function toggleMenu(btn) {
  var wasOpen = openBtn === btn;
  closeMenus(false);
  if (wasOpen) return;
  openBtn = btn;
  btn.setAttribute('aria-controls', MENUS[btn.id]);
  btn.setAttribute('aria-expanded', 'true');
  var pop = el(MENUS[btn.id]);
  pop.hidden = false;
  placeMenu(btn, pop);
  syncThemeSwitch();
}

// Le menu s'ouvre à la hauteur de son bouton, remonté juste ce qu'il faut pour tenir dans
// l'écran : un menu court ne tombe plus au pied de la page, loin de ce qui l'a ouvert.
function placeMenu(btn, pop) {
  var margin = 12;
  var top = Math.min(btn.getBoundingClientRect().top, window.innerHeight - pop.offsetHeight - margin);
  pop.style.top = Math.max(margin, top) + 'px';
  pop.style.bottom = 'auto';
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
  renderAccount();   // le libellé du secteur du profil n'est lisible qu'une fois les données arrivées
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
  el('sbResPop').innerHTML = SIDEBAR_RESOURCE_TYPES.map(function(r) {
    return '<a class="sb-pop-item sb-pop-type" href="' + esc(aymingUrl(r.path, r.campaign)) + '" target="_blank" rel="noopener">' +
      '<span class="sb-pop-ico"><i data-lucide="' + esc(r.icon) + '"></i></span>' +
      '<span class="sb-pop-txt"><span class="sb-pop-t">' + esc(r.title) + '</span>' +
        (r.text ? '<span class="sb-pop-d">' + esc(r.text) + '</span>' : '') + '</span>' +
      '<i data-lucide="external-link" class="sb-pop-ext"></i></a>';
  }).join('');
}

// Les premiers pas occupent la place tant qu'ils sont à l'écran. Terminés, ils laissent un accès
// permanent à la carte gagnée, sans croix : la carte se rouvre et se partage à tout moment.
function renderPromo() {
  var promo = el('sbPromo');
  if (checklistActive() || !checklistComplete()) { promo.hidden = true; return; }
  promo.innerHTML =
    '<span class="sb-promo-k">Votre carte</span>' +
    '<strong class="sb-promo-t">' + esc(badgeTitle()) + '</strong>' +
    '<p class="sb-promo-p">Partagez-la sur LinkedIn ou avec un collègue.</p>' +
    '<button type="button" class="sb-promo-cta" id="sbPromoCta">Voir ma carte</button>';
  promo.hidden = false;
  el('sbPromoCta').addEventListener('click', openBadge);
}

// toggleTheme : la bascule d'nav.js, qui relance aussi les graphiques.
export function initSidebar(toggleTheme) {
  if (!el('sidebar')) return;
  renderResources();
  renderPromo();
  window.addEventListener('checklistchange', renderPromo);
  window.addEventListener('profilechange', renderAccount);
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
  el('sbProfile').addEventListener('click', function() { closeMenus(false); });
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
