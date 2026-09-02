// ── Nav & Theme ──

import { state, VIEW_CONFIG } from './state.js';
import { el, viewEl, themeColor } from './utils.js';

function updateChartDefaults() {
  Chart.defaults.color = themeColor('--chart-label');
  Chart.defaults.plugins.legend.labels.color = themeColor('--text-secondary');
  Chart.defaults.borderColor = themeColor('--border');
}

function updateThemeUI() {
  lucide.createIcons();
}

export function toggleTheme(renderFn) {
  var html = document.documentElement;
  var isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('sinistralite-theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('sinistralite-theme', 'dark');
  }
  updateThemeUI();
  updateChartDefaults();
  var vs = state.views[state.activeView];
  if (vs.code && renderFn) renderFn(state.activeView, vs.code, vs.level);
}

export function switchView(viewId) {
  if (viewId === state.activeView) return;
  var prevView = state.activeView;
  state.activeView = viewId;

  // Update nav
  document.querySelectorAll('.nav-item[data-view]').forEach(function(item) {
    item.classList.toggle('active', item.dataset.view === viewId);
  });

  // Update view containers
  document.querySelectorAll('.view').forEach(function(v) {
    v.classList.toggle('active', v.id === 'view-' + viewId);
  });

  // Update header
  var cfg = VIEW_CONFIG[viewId];
  el('headerTitle').textContent = cfg.title;
  el('headerSubtitle').textContent = cfg.subtitle;

  // Update footer
  el('footerSource').innerHTML = 'Source : <a href="' + cfg.sourceUrl + '" target="_blank">' + cfg.sourceLabel + '</a>';

  // La vue "Comparer" n'a pas de code unique : elle gère ses propres secteurs
  if (viewId === 'compare') {
    window.location.hash = 'compare';
    return;
  }

  // Always carry over the selected sector across tabs
  var prevVs = state.views[prevView];
  var code = prevVs && prevVs.code ? prevVs.code : state.views[viewId].code;
  if (code) {
    window.location.hash = viewId + '/' + code;
  } else {
    window.location.hash = viewId;
  }
}

export function initNav(renderFn) {
  // Chart defaults
  Chart.defaults.color = '#8b949e';
  Chart.defaults.font.family = "'Lato', sans-serif";
  updateChartDefaults();

  // Nav rail click handlers
  document.querySelectorAll('.nav-item[data-view]').forEach(function(item) {
    if (!item.classList.contains('disabled')) {
      item.addEventListener('click', function() {
        var target = this.dataset.view;
        // Cliquer l'onglet deja actif ramene a la vue nationale : switchView()
        // sort tot dans ce cas, le hash nu est donc le seul chemin de retour.
        if (target === state.activeView && target !== 'compare') {
          window.location.hash = target;
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
  var saved = localStorage.getItem('sinistralite-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  updateThemeUI();
}
