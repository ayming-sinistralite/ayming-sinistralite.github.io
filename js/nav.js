// ── Nav & Theme ──

import { state, VIEW_CONFIG } from './state.js?v=e9f97a8';
import { el, themeColor } from './utils.js?v=e9f97a8';
import { initSidebar, refreshSidebar } from './sidebar.js?v=e9f97a8';
import { goTo } from './route.js?v=e9f97a8';

// Un seul h1 par page. Une vue nationale (sans secteur) a pour h1 le titre de l'en-tête, une page
// de secteur a « {vue}-selTitle », et tant que le bloc prérendu (son propre <h1>) est là, c'est lui.
// hasSector, quand l'appelant le sait (render() tourne avant que tout l'état soit posé), prime sur
// l'état. has-sector sert aussi au CSS : sur téléphone l'en-tête générique s'efface devant les chiffres.
export function syncPageHeading(hasSector) {
  var viewId = state.activeView;
  var isSectorView = !!el(viewId + '-results');
  if (hasSector === undefined) hasSector = isSectorView && !!(state.views[viewId] && state.views[viewId].code);
  document.body.classList.toggle('has-sector', !!hasSector);
  var t = el('headerTitle');
  if (!t) return;
  if (isSectorView && !hasSector && !document.querySelector('.static-sector')) {
    t.setAttribute('role', 'heading');
    t.setAttribute('aria-level', '1');
  } else {
    t.removeAttribute('role');
    t.removeAttribute('aria-level');
  }
}

function updateChartDefaults() {
  Chart.defaults.color = themeColor('--chart-label');
  Chart.defaults.plugins.legend.labels.color = themeColor('--text-secondary');
  Chart.defaults.borderColor = themeColor('--border');
}

function updateThemeUI() {
  var tt = el('themeToggle');
  if (tt) tt.setAttribute('aria-pressed', String(document.documentElement.getAttribute('data-theme') === 'dark'));
  lucide.createIcons();
}

function toggleTheme(renderFn) {
  var html = document.documentElement;
  var isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    try { localStorage.setItem('sinistralite-theme', 'light'); } catch (e) {}
  } else {
    html.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('sinistralite-theme', 'dark'); } catch (e) {}
  }
  updateThemeUI();
  updateChartDefaults();
  var vs = state.views[state.activeView];
  if (vs.code && renderFn) renderFn(state.activeView, vs.code, vs.level);
}

// fromRouter : le routeur affiche l'adresse déjà en place, il n'y a rien à réécrire.
export function switchView(viewId, fromRouter) {
  if (viewId === state.activeView) return;
  var prevView = state.activeView;
  state.activeView = viewId;
  document.body.dataset.view = viewId;
  // Une autre vue s'ouvre en haut, pas à la hauteur où la précédente était lue.
  window.scrollTo(0, 0);

  // Update nav
  document.querySelectorAll('.nav-item[data-view]').forEach(function(item) {
    var on = item.dataset.view === viewId;
    item.classList.toggle('active', on);
    if (on) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });

  refreshSidebar();

  // Update view containers
  document.querySelectorAll('.view').forEach(function(v) {
    v.classList.toggle('active', v.id === 'view-' + viewId);
  });

  // Update header
  var cfg = VIEW_CONFIG[viewId];
  el('headerTitle').textContent = cfg.title;
  el('headerSubtitle').textContent = cfg.subtitle;
  syncPageHeading();

  if (fromRouter) return;

  // La vue "Comparer" n'a pas de code unique : elle gère ses propres secteurs
  if (viewId === 'home' || viewId === 'compare' || viewId === 'diagnostic') {
    goTo(viewId);
    return;
  }

  // Always carry over the selected sector across tabs
  var prevVs = state.views[prevView];
  goTo(viewId, prevVs && prevVs.code ? prevVs.code : state.views[viewId].code);
}

export function initNav(renderFn) {
  // Chart defaults
  Chart.defaults.font.family = "'Lato', sans-serif";
  updateChartDefaults();

  // Clics sur les vues (menu latéral et barre du bas)
  document.querySelectorAll('.nav-item[data-view]').forEach(function(item) {
    if (!item.classList.contains('disabled')) {
      item.addEventListener('click', function() {
        var target = this.dataset.view;
        // Cliquer l'onglet deja actif ramene a la vue nationale : switchView()
        // sort tot dans ce cas, l'adresse de la vue nue est donc le seul chemin de retour.
        if (target === state.activeView && target !== 'compare') {
          goTo(target);
          return;
        }
        switchView(target);
      });
    }
  });

  // Theme toggle
  el('themeToggle').addEventListener('click', function() {
    toggleTheme(renderFn);
  });

  // Restore theme from localStorage
  var saved = null;
  try { saved = localStorage.getItem('sinistralite-theme'); } catch (e) {}
  var prefersDark = false;
  try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
  if (saved === 'dark' || (saved !== 'light' && prefersDark)) document.documentElement.setAttribute('data-theme', 'dark');
  updateThemeUI();
  initSidebar(function() { toggleTheme(renderFn); });
}
