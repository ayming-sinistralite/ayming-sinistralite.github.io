// ── Search & Autocomplete ──

import { state } from './state.js';
import { getData, getStore } from './data.js';
import { normalize, expandQuery, viewEl } from './utils.js';

// Retour a la vue nationale : inverse exact de ce que render() masque quand un
// secteur s'affiche. Quatre chemins y menent, le fil d'Ariane, l'onglet deja actif,
// un hash de vue nu, et Entree sur un champ de recherche vide.
export function clearSelection(viewId) {
  var vs = state.views[viewId];
  if (vs) vs.code = null;
  var results = viewEl(viewId, 'results');
  var searchInput = viewEl(viewId, 'searchInput');
  if (searchInput) searchInput.value = '';

  function devoiler() {
    // .leaving part TOUJOURS : la classe l'emporte sur .visible dans la cascade,
    // la laisser en place rendrait invisible un secteur rechoisi entre-temps.
    if (results) results.classList.remove('leaving');
    // Garde anti-course : un secteur a été rechoisi pendant la sortie, on laisse
    // le nouveau rendu tranquille plutôt que de le masquer.
    if (vs && vs.code) return;
    if (results) results.classList.remove('visible');
    var empty = viewEl(viewId, 'emptyState');
    if (empty) empty.style.display = '';
    var mapSec = viewEl(viewId, 'mapSection');
    if (mapSec) mapSec.style.display = '';
  }

  var anime = results && results.classList.contains('visible') &&
    !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (anime) {
    results.classList.add('leaving');
    setTimeout(devoiler, 200);
  } else {
    devoiler();
  }
}

export function setupSearch(viewId, renderFn) {
  var searchInput = viewEl(viewId, 'searchInput');
  var acBox = viewEl(viewId, 'autocomplete');
  var levelTabs = viewEl(viewId, 'levelTabs');
  var vs = state.views[viewId];
  var data = getData(viewId);

  var defaultEntries = []
    .concat(Object.entries(data.by_naf2).map(function(p) { return { code: p[0], libelle: p[1].libelle, level: 'naf2' }; }))
    .concat(Object.entries(data.by_naf4).map(function(p) { return { code: p[0], libelle: p[1].libelle, level: 'naf4' }; }))
    .sort(function(a, b) { return a.code.localeCompare(b.code); });

  var debounceTimer;
  searchInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() { showAutocomplete(searchInput.value); }, 120);
  });
  searchInput.addEventListener('focus', function() {
    showAutocomplete(this.value);
  });
  searchInput.addEventListener('keydown', function(e) {
    var items = acBox.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      vs.acIndex = Math.min(vs.acIndex + 1, items.length - 1);
      updateAcActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      vs.acIndex = Math.max(vs.acIndex - 1, 0);
      updateAcActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // La saisie arme un showAutocomplete() differe de 120 ms. Sans cette annulation
      // il se declenche APRES closeAc() et rouvre la liste qu'Entree vient de fermer,
      // visible des que la frappe et Entree sont separees de moins de 120 ms.
      clearTimeout(debounceTimer);
      if (!searchInput.value.trim()) {
        closeAc();
        clearSelection(viewId);
        window.location.hash = viewId;
        searchInput.blur();
      } else if (items.length > 0) {
        var idx = vs.acIndex >= 0 ? vs.acIndex : 0;
        items[idx].click();
      }
    } else if (e.key === 'Escape') {
      closeAc();
    }
  });

  function updateAcActive(items) {
    items.forEach(function(el, i) { el.classList.toggle('active', i === vs.acIndex); });
    if (items[vs.acIndex]) items[vs.acIndex].scrollIntoView({ block: 'nearest' });
  }

  function highlightText(text, query) {
    if (!query) return text;
    var idx = normalize(text).indexOf(normalize(query));
    if (idx === -1) return text;
    var before = text.substring(0, idx);
    var match = text.substring(idx, idx + query.length);
    var after = text.substring(idx + query.length);
    return before + '<mark>' + match + '</mark>' + after;
  }

  function showAutocomplete(query) {
    var matches;
    var totalCount = 0;
    if (!query || query.length < 1) {
      // No query: show NAF2 divisions
      matches = Object.entries(data.by_naf2)
        .map(function(p) { return { code: p[0], libelle: p[1].libelle, level: 'naf2' }; })
        .sort(function(a, b) { return a.code.localeCompare(b.code); });
      totalCount = matches.length;
    } else {
      var q = normalize(query);
      var qUp = query.trim().toUpperCase();
      var isCodeSearch = /^[0-9]/.test(query.trim());

      if (isCodeSearch) {
        // Progressive drill-down: show next-level codes matching prefix
        // Skip the currently selected code so only children/siblings show
        var selectedCode = vs.code ? vs.code.toUpperCase() : null;
        var allMatches = data.naf_index
          .filter(function(e) {
            if (e.code.toUpperCase() === selectedCode) return false;
            return e.code.toUpperCase().startsWith(qUp);
          })
          .sort(function(a, b) {
            // Exact match first, then by code length (shorter = broader), then alphabetical
            var aExact = a.code.toUpperCase() === qUp ? 0 : 1;
            var bExact = b.code.toUpperCase() === qUp ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
            if (a.code.length !== b.code.length) return a.code.length - b.code.length;
            return a.code.localeCompare(b.code);
          });
        totalCount = allMatches.length;
        matches = allMatches.slice(0, 25);
      } else {
        // Text search: match across all levels, avec les synonymes usuels en plus de la requête brute
        var terms = expandQuery(query);
        var allMatches = data.naf_index
          .filter(function(e) {
            return terms.some(function(t) { return normalize(e.code).includes(t) || normalize(e.libelle).includes(t); });
          })
          .sort(function(a, b) {
            var aStarts = normalize(a.libelle).indexOf(q) === 0 ? 0 : 1;
            var bStarts = normalize(b.libelle).indexOf(q) === 0 ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            if (a.code.length !== b.code.length) return a.code.length - b.code.length;
            return a.code.localeCompare(b.code);
          });
        totalCount = allMatches.length;
        matches = allMatches.slice(0, 25);
      }
    }

    if (matches.length === 0) { closeAc(); return; }

    var rawQ = query ? query.trim() : '';
    acBox.innerHTML = matches.map(function(m) {
      var codeHtml = rawQ ? highlightText(m.code, rawQ) : m.code;
      var libelleHtml = rawQ ? highlightText(m.libelle, rawQ) : m.libelle;
      return '<div class="ac-item" data-code="' + m.code + '" data-level="' + m.level + '">' +
        '<span class="code">' + codeHtml + '</span>' +
        '<span class="libelle">' + libelleHtml + '</span>' +
        '<span class="level-tag">' + m.level.toUpperCase() + '</span>' +
        '</div>';
    }).join('') +
    (totalCount > 0 ? '<div class="ac-count">' + totalCount + ' résultat' + (totalCount > 1 ? 's' : '') + (totalCount > 25 ? ' (25 affichés)' : '') + '</div>' : '');

    acBox.querySelectorAll('.ac-item').forEach(function(item) {
      item.addEventListener('click', function() {
        setLevel(viewId, this.dataset.level);
        selectCode(viewId, this.dataset.code, this.dataset.level, renderFn);
        closeAc();
      });
    });

    vs.acIndex = -1;
    acBox.classList.add('open');
  }

  function closeAc() {
    acBox.classList.remove('open');
    vs.acIndex = -1;
  }

  document.addEventListener('click', function(e) {
    if (!e.target.closest('#view-' + viewId + ' .search-wrapper')) closeAc();
  });

  // Level tabs
  levelTabs.querySelectorAll('button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLevel(viewId, this.dataset.level);
      if (vs.code) {
        var newCode = adaptCode(viewId, vs.code, vs.level);
        if (newCode) selectCode(viewId, newCode, vs.level, renderFn);
      }
      // Re-trigger autocomplete with current query
      var q = searchInput.value.trim();
      if (q) showAutocomplete(q);
    });
  });
}

export function setLevel(viewId, level) {
  state.views[viewId].level = level;
  viewEl(viewId, 'levelTabs').querySelectorAll('button').forEach(function(b) {
    b.classList.toggle('active', b.dataset.level === level);
  });
}

export function adaptCode(viewId, code, targetLevel) {
  var store = getStore(viewId, targetLevel);
  if (store[code]) return code;
  if (targetLevel === 'naf4' && code.length >= 4) return store[code.substring(0, 4)] ? code.substring(0, 4) : null;
  if (targetLevel === 'naf2') return store[code.substring(0, 2)] ? code.substring(0, 2) : null;
  var match = Object.keys(store).find(function(k) { return k.startsWith(code); });
  return match || null;
}

export function selectCode(viewId, code, level, renderFn) {
  var vs = state.views[viewId];
  vs.code = code;
  vs.level = level;
  viewEl(viewId, 'searchInput').value = code;
  window.location.hash = viewId + '/' + code;
  if (renderFn) renderFn(viewId, code, level);
}
