// ── Nav & Theme ──

import { state, VIEW_CONFIG } from './state.js?v=58f7592';
import { el, themeColor } from './utils.js?v=58f7592';
import { initSidebar, refreshSidebar } from './sidebar.js?v=58f7592';
import { goTo } from './route.js?v=58f7592';

function updateChartDefaults() {
  Chart.defaults.color = themeColor('--chart-label');
  Chart.defaults.plugins.legend.labels.color = themeColor('--text-secondary');
  Chart.defaults.borderColor = themeColor('--border');
}

function updateThemeUI() {
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

  // Update nav
  document.querySelectorAll('.nav-item[data-view]').forEach(function(item) {
    item.classList.toggle('active', item.dataset.view === viewId);
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

  if (fromRouter) return;

  // La vue "Comparer" n'a pas de code unique : elle gère ses propres secteurs
  if (viewId === 'compare' || viewId === 'diagnostic') {
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
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  updateThemeUI();
  initSidebar(function() { toggleTheme(renderFn); });
}
