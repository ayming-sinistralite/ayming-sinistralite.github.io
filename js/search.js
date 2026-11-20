// ── Search & Autocomplete ──

import { state } from './state.js?v=24ffa11';
import { getData, libelleOf } from './data.js?v=24ffa11';
import { normalize, viewEl, adaptCodeToLevel, comboKeys, debounce, trackEmptySearch } from './utils.js?v=24ffa11';
import { goTo, routePath, currentRoute } from './route.js?v=24ffa11';
import { rankSectors } from './search-synonyms.js?v=24ffa11';


// Retour a la vue nationale : inverse exact de ce que render() masque quand un
// secteur s'affiche. Quatre chemins y menent, le fil d'Ariane, l'onglet deja actif,
// l'adresse d'une vue nue, et Entree sur un champ de recherche vide.
export function clearSelection(viewId) {
  var vs = state.views[viewId];
  if (vs) vs.code = null;
  var results = viewEl(viewId, 'results');
  var searchInput = viewEl(viewId, 'searchInput');
  if (searchInput) searchInput.value = '';
  // Saisie arrivée par ?q= (la landing) : la vue nationale s'ouvre sur la recherche remplie.
  if (vs && vs.pendingQuery && searchInput) {
    searchInput.value = vs.pendingQuery;
    vs.pendingQuery = '';
    searchInput.focus();
    searchInput.dispatchEvent(new Event('focus'));
  }

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

// Les suggestions pour une saisie : jusqu'à 25 secteurs et le total des correspondances.
function autocompleteMatches(data, vs, query) {
  var matches;
  var totalCount = 0;
  if (!query || query.length < 1) {
    // No query: show the divisions, or the sections when the Section tab is active
    var listLevel = vs.level === 'naf1' && data.by_naf1 ? 'naf1' : 'naf2';
    matches = Object.entries(data['by_' + listLevel])
      .map(function(p) { return { code: p[0], libelle: p[1].libelle, level: listLevel }; })
      .sort(function(a, b) { return a.code.localeCompare(b.code); });
    totalCount = matches.length;
  } else {
    // Tous les niveaux, le code déjà affiché écarté d'une recherche par code (search-synonyms.js).
    var all = rankSectors(data.naf_index, query, { skip: vs.code });
    totalCount = all.length;
    matches = all.slice(0, 25);
  }
  return { matches: matches, totalCount: totalCount };
}

export function setupSearch(viewId, renderFn) {
  var searchInput = viewEl(viewId, 'searchInput');
  var acBox = viewEl(viewId, 'autocomplete');
  var levelTabs = viewEl(viewId, 'levelTabs');
  var vs = state.views[viewId];
  var data = getData(viewId);

  var entry = currentRoute();
  if (entry.view === viewId && !entry.code && entry.query) vs.pendingQuery = entry.query;

  // Combobox ARIA : le champ pilote la liste de suggestions.
  searchInput.setAttribute('role', 'combobox');
  searchInput.setAttribute('aria-autocomplete', 'list');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.setAttribute('aria-controls', acBox.id);
  acBox.setAttribute('role', 'listbox');

  var debounced = debounce(function() { showAutocomplete(searchInput.value); }, 120);
  searchInput.addEventListener('input', debounced);
  // Le champ montre « code · libellé » du secteur affiché : au focus, le texte est sélectionné
  // pour qu'une frappe le remplace, et la liste part du code comme avant.
  searchInput.addEventListener('focus', function() {
    var shown = this.value && this.value === this.dataset.shown;
    if (shown) this.select();
    showAutocomplete(shown ? vs.code : this.value);
  });
  comboKeys(searchInput, {
    items: function() { return acBox.querySelectorAll('.ac-item'); },
    index: function() { return vs.acIndex; },
    setIndex: function(n) { vs.acIndex = n; },
    onEnter: function() {
      // La saisie arme un showAutocomplete() differe de 120 ms. Sans cette annulation
      // il se declenche APRES closeAc() et rouvre la liste qu'Entree vient de fermer,
      // visible des que la frappe et Entree sont separees de moins de 120 ms.
      debounced.cancel();
      if (searchInput.value.trim()) return false;
      closeAc();
      clearSelection(viewId);
      goTo(viewId);
      searchInput.blur();
      return true;
    },
    onEscape: closeAc
  });

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
    var found = autocompleteMatches(data, vs, query);
    var matches = found.matches, totalCount = found.totalCount;

    trackEmptySearch(matches.length ? '' : query, viewId);
    if (matches.length === 0) {
      acBox.innerHTML = '<div class="ac-hint" role="presentation">Aucun secteur ne correspond. Essayez un autre mot du métier ou le code NAF.</div>';
      vs.acIndex = -1;
      searchInput.removeAttribute('aria-activedescendant');
      searchInput.setAttribute('aria-expanded', 'true');
      acBox.classList.add('open');
      return;
    }

    var rawQ = query ? query.trim() : '';
    acBox.innerHTML = matches.map(function(m, i) {
      var codeHtml = rawQ ? highlightText(m.code, rawQ) : m.code;
      var libelleHtml = rawQ ? highlightText(m.libelle, rawQ) : m.libelle;
      // Un vrai lien vers la page du secteur, que le routeur intercepte (js/route.js).
      return '<a class="ac-item" role="option" aria-selected="false" id="' + viewId + '-acOpt' + i + '" href="' + routePath(viewId, m.code, m.libelle) + '" data-code="' + m.code + '" data-level="' + m.level + '">' +
        '<span class="code">' + codeHtml + '</span>' +
        '<span class="libelle">' + libelleHtml + '</span>' +
        '<span class="level-tag">' + (m.level === 'naf1' ? 'SECTION' : m.level.toUpperCase()) + '</span>' +
        '</a>';
    }).join('') +
    (totalCount > 0 ? '<div class="ac-count" role="presentation">' + totalCount + ' résultat' + (totalCount > 1 ? 's' : '') + (totalCount > 25 ? ' (25 affichés)' : '') + '</div>' : '');

    acBox.querySelectorAll('.ac-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;   // nouvel onglet : le lien suffit
        e.preventDefault();
        setLevel(viewId, this.dataset.level);
        selectCode(viewId, this.dataset.code, this.dataset.level, renderFn);
        closeAc();
      });
    });

    vs.acIndex = -1;
    searchInput.removeAttribute('aria-activedescendant');
    searchInput.setAttribute('aria-expanded', 'true');
    acBox.classList.add('open');
  }

  function closeAc() {
    acBox.classList.remove('open');
    vs.acIndex = -1;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
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

function adaptCode(viewId, code, targetLevel) {
  return adaptCodeToLevel(getData(viewId), code, targetLevel);
}

export function selectCode(viewId, code, level, renderFn) {
  var vs = state.views[viewId];
  vs.code = code;
  vs.level = level;
  var input = viewEl(viewId, 'searchInput'), lib = libelleOf(viewId, code);
  input.value = input.dataset.shown = lib ? code + ' · ' + lib : code;
  goTo(viewId, code);
  if (renderFn) renderFn(viewId, code, level);
}
