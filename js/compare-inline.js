// ── Comparaison inline de secteurs (NAF5 uniquement) ──
// Permet, depuis la fiche d'un secteur NAF5, d'ajouter jusqu'à 4 autres
// secteurs NAF5 superposés dans les graphiques clés de la vue courante.

import { state } from './state.js';
import { getStore } from './data.js';
import { viewEl, normalize, expandQuery } from './utils.js';
import { SECTOR_COLORS } from './compare.js';

// Le secteur courant compte dans le total : 1 courant + 1 comparé = 2 colonnes max
// (comparaison côte à côte façon GA4). À étendre plus tard si besoin.
var MAX_COMPARE = 1;
var renderFn = null;

// Index NAF5 (code -> libellé) par domaine, construit à la demande.
var naf5IndexCache = {};
function buildNaf5Index(viewId) {
  if (naf5IndexCache[viewId]) return naf5IndexCache[viewId];
  var store = getStore(viewId, 'naf5');
  var index = Object.keys(store)
    .map(function(code) { return { code: code, libelle: store[code].libelle }; })
    .sort(function(a, b) { return a.code.localeCompare(b.code); });
  naf5IndexCache[viewId] = index;
  return index;
}

// ── Actions ──
export function addCompareCode(viewId, code) {
  var vs = state.views[viewId];
  if (!vs.code || code === vs.code) return;
  if (state.compareCodes.indexOf(code) !== -1) return;
  if (state.compareCodes.length >= MAX_COMPARE) return;
  if (!getStore(viewId, 'naf5')[code]) return;
  state.compareCodes.push(code);
  rerun(viewId);
}

export function removeCompareCode(viewId, code) {
  state.compareCodes = state.compareCodes.filter(function(c) { return c !== code; });
  rerun(viewId);
}

function rerun(viewId) {
  var vs = state.views[viewId];
  if (vs.code && renderFn) renderFn(viewId, vs.code, vs.level);
}

// ── Chips amovibles ──
// « missing » liste les secteurs comparés que la vue courante ne couvre pas. Ils restent
// affichés, grisés, pour que le passage sur cet onglet n'ait pas l'air d'avoir perdu la
// comparaison. Le secteur reste comparé dans les vues qui le couvrent.
export function renderChips(viewId, missing) {
  missing = missing || [];
  var wrap = viewEl(viewId, 'cmpChips');
  if (!wrap) return;
  var vs = state.views[viewId];
  var naf5 = getStore(viewId, 'naf5');
  // Un secteur devenu le secteur courant de cette vue n'a plus de pastille ici, mais il
  // reste comparé dans les vues où il n'est pas le secteur courant.
  var shown = state.compareCodes.filter(function(c) { return c !== vs.code; });
  // Les couleurs suivent l'ordre des secteurs réellement tracés, comme dans app.js.
  var colorIdx = 0;
  wrap.innerHTML = shown.map(function(code) {
    var absent = missing.indexOf(code) !== -1;
    var entry = naf5[code];
    var lib = absent ? 'Pas de données dans cette vue' : (entry ? entry.libelle : '');
    var dot = '<span class="chip-dot"></span>';
    if (!absent) {
      dot = '<span class="chip-dot" style="background:' + SECTOR_COLORS[colorIdx % SECTOR_COLORS.length] + '"></span>';
      colorIdx++;
    }
    return '<span class="compare-chip' + (absent ? ' compare-chip-absent' : '') + '" data-code="' + code + '">' +
      dot +
      '<span class="chip-code">' + code + '</span>' +
      '<span class="chip-lib">' + lib + '</span>' +
      '<button class="chip-remove" data-code="' + code + '" aria-label="Retirer ' + code + '">&times;</button>' +
      '</span>';
  }).join('');
  wrap.querySelectorAll('.chip-remove').forEach(function(btn) {
    btn.addEventListener('click', function() { removeCompareCode(viewId, this.dataset.code); });
  });
}

// ── Affichage / masquage de la barre de comparaison ──
export function renderInline(viewId, missing) {
  var bar = viewEl(viewId, 'cmpBar');
  if (bar) bar.style.display = '';
  var vs = state.views[viewId];
  // Pastille non amovible du secteur courant (couleur accent via CSS).
  var cur = viewEl(viewId, 'cmpCurrent');
  if (cur) {
    cur.innerHTML = '<span class="chip-dot"></span>' +
      '<span class="cmp-current-code">' + (vs.code || '') + '</span>';
  }
  renderChips(viewId, missing);
  // À la limite (1 courant + MAX_COMPARE comparé), on masque le bouton d'ajout
  // et la recherche : pas de cul-de-sac, le secteur comparé reste affiché.
  var atMax = state.compareCodes.length >= MAX_COMPARE;
  var addBtn = viewEl(viewId, 'cmpAddBtn');
  var searchWrap = viewEl(viewId, 'cmpSearchWrap');
  if (addBtn) addBtn.style.display = atMax ? 'none' : '';
  if (atMax && searchWrap) searchWrap.style.display = 'none';
}

export function hideInlineBar(viewId) {
  var bar = viewEl(viewId, 'cmpBar');
  if (bar) bar.style.display = 'none';
}

// ── Autocomplete d'ajout (NAF5 uniquement) ──
function setupInput(viewId) {
  var input = viewEl(viewId, 'cmpAddInput');
  var acBox = viewEl(viewId, 'cmpAutocomplete');
  if (!input || !acBox) return;
  var addBtn = viewEl(viewId, 'cmpAddBtn');
  var searchWrap = viewEl(viewId, 'cmpSearchWrap');
  var vs = state.views[viewId];
  var acIndex = -1;

  function closeAc() { acBox.classList.remove('open'); acIndex = -1; }

  // Affiche le champ de recherche (style GA4 : un clic révèle l'input).
  function showSearch() {
    if (searchWrap) searchWrap.style.display = '';
    if (addBtn) addBtn.style.display = 'none';
    input.focus();
    show(input.value);
  }
  // Masque le champ et restaure le bouton "+ Ajouter" (sauf à la limite, où il reste masqué).
  function hideSearch() {
    if (searchWrap) searchWrap.style.display = 'none';
    if (addBtn) addBtn.style.display = (state.compareCodes.length >= MAX_COMPARE) ? 'none' : '';
    input.value = '';
    closeAc();
  }
  if (addBtn) addBtn.addEventListener('click', showSearch);

  function show(query) {
    if (state.compareCodes.length >= MAX_COMPARE) {
      var lbl = MAX_COMPARE > 1 ? MAX_COMPARE + ' secteurs comparés' : '1 secteur comparé';
      acBox.innerHTML = '<div class="ac-item ac-item-info">Maximum ' + lbl + '.</div>';
      acBox.classList.add('open');
      return;
    }
    var index = buildNaf5Index(viewId);
    var current = vs.code;
    var selected = state.compareCodes;
    var raw = (query || '').trim();
    var matches;
    if (!raw) {
      matches = index.slice(0, 25);
    } else {
      var qUp = raw.toUpperCase();
      var isCode = /^[0-9]/.test(raw);
      var terms = expandQuery(query);
      matches = index.filter(function(e) {
        if (isCode) return e.code.toUpperCase().startsWith(qUp);
        return terms.some(function(t) { return normalize(e.code).includes(t) || normalize(e.libelle).includes(t); });
      }).slice(0, 25);
    }
    matches = matches.filter(function(m) {
      return m.code !== current && selected.indexOf(m.code) === -1;
    });
    if (!matches.length) { closeAc(); return; }
    acBox.innerHTML = matches.map(function(m) {
      return '<div class="ac-item" data-code="' + m.code + '">' +
        '<span class="code">' + m.code + '</span>' +
        '<span class="libelle">' + m.libelle + '</span>' +
        '<span class="level-tag">NAF5</span>' +
        '</div>';
    }).join('');
    acBox.querySelectorAll('.ac-item').forEach(function(item) {
      item.addEventListener('click', function() {
        addCompareCode(viewId, this.dataset.code);
        hideSearch();
      });
    });
    acIndex = -1;
    acBox.classList.add('open');
  }

  var debounce;
  input.addEventListener('input', function() {
    clearTimeout(debounce);
    debounce = setTimeout(function() { show(input.value); }, 120);
  });
  input.addEventListener('focus', function() { show(this.value); });
  input.addEventListener('keydown', function(e) {
    var items = acBox.querySelectorAll('.ac-item[data-code]');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acIndex = Math.min(acIndex + 1, items.length - 1);
      items.forEach(function(it, i) { it.classList.toggle('active', i === acIndex); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acIndex = Math.max(acIndex - 1, 0);
      items.forEach(function(it, i) { it.classList.toggle('active', i === acIndex); });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length) items[acIndex >= 0 ? acIndex : 0].click();
    } else if (e.key === 'Escape') {
      hideSearch();
      if (addBtn) addBtn.focus();
    }
  });

  // Fermeture du champ quand le focus le quitte (laisse le clic sur un item passer).
  input.addEventListener('blur', function() {
    setTimeout(function() {
      var a = document.activeElement;
      if (!a || !a.closest || !a.closest('#' + viewId + '-cmpBar')) hideSearch();
    }, 150);
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('#' + viewId + '-cmpBar')) { closeAc(); hideSearch(); }
  });
}

// ── Init (une seule fois) ──
export function initInlineCompare(fn) {
  renderFn = fn;
  ['at', 'mp', 'trajet'].forEach(setupInput);
}
