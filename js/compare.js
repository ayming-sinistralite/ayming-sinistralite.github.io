// ── Mon entreprise : les données de l'autodiagnostic ──
// Les helpers purs, la résolution du secteur, le calcul partagé par le parcours (flow.js) et le
// rapport, et la recherche de secteur. On situe l'entreprise face à son secteur, aux
// établissements de même taille et à la moyenne nationale, sur des chiffres comparables.

import { state } from './state.js?v=36466a3';
import { getData, getStore } from './data.js?v=36466a3';
import { esc, comboAria, comboKeys, closeCombo, debounce, trackEmptySearch } from './utils.js?v=36466a3';
import { rankSectors } from './search-synonyms.js?v=36466a3';
import { nationalIndex } from './route.js?v=36466a3';

// Palette des secteurs comparés (réutilisée par la comparaison inline + l'app).
// Secteurs comparés, le secteur courant gardant var(--accent). Vert de la charte, puis des
// teintes hors charte assumées : quatre séries doivent rester distinctes d'un coup d'œil.
export var SECTOR_COLORS = ['#00b08b', '#f29100', '#8a5cc2', '#6d8093'];

var DOMAIN = 'at';
var LEVELS = ['naf5'];   // l'autoévaluation ne propose que des NAF5

export function vs() { return state.views.compare; }

// ── Helpers purs (testés dans tests/compare.test.js) ──
export function companyIF(count, eff) {
  return (count != null && count >= 0 && eff > 0) ? (count / eff) * 1000 : null;
}

// Compteur saisi : un entier positif, séparateurs de milliers acceptés ("2 000", "2.000", "2,000").
// Tout le reste ("-1", "1,5", "12abc") est refusé plutôt que lu de travers.
export function parseCount(raw) {
  var s = String(raw == null ? '' : raw).replace(/\s/g, '');
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10);
  return null;
}

// Une saisie non vide que le parseur refuse est signalée sur le champ, avec ce qui est attendu.
export function flagInput(input, value, message) {
  var bad = input.value.trim() !== '' && value == null;
  var id = input.id + '-error';
  var note = document.getElementById(id);
  if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  if (bad && !note) {
    note = document.createElement('p');
    note.className = 'flow-error';
    note.id = id;
    note.textContent = message;
    input.insertAdjacentElement('afterend', note);
    input.setAttribute('aria-describedby', id);
  } else if (bad) {
    note.textContent = message;
  } else if (note) {
    note.remove();
    input.removeAttribute('aria-describedby');
  }
}

// Tranches d'établissement des fiches (size-data.json), dans l'ordre de leurs bands.
var SIZE_LIMITS = [10, 20, 50, 100, 200];
export function sizeBandIndex(eff) {
  if (!(eff > 0)) return -1;
  for (var i = 0; i < SIZE_LIMITS.length; i++) if (eff < SIZE_LIMITS[i]) return i;
  return SIZE_LIMITS.length;
}

// Indice de fréquence des établissements de la même tranche, dérivé des parts publiées :
// IF tranche = IF secteur × part des accidents ÷ part des salariés.
// Une part nulle signale une donnée absente de la fiche, jamais un zéro réel.
export function sizePeerIF(sectorIF, bands, eff) {
  var i = sizeBandIndex(eff);
  var b = (bands && i >= 0) ? bands[i] : null;
  if (!b || !(sectorIF > 0) || !(b.part_accidents > 0) || !(b.part_salaries > 0)) return null;
  return sectorIF * b.part_accidents / b.part_salaries;
}

// ── Résolution du secteur (NAF5 du domaine) ──
export function resolveEntry(code, domain) {
  domain = domain || DOMAIN;
  if (!code || !getData(domain)) return null;
  for (var i = 0; i < LEVELS.length; i++) {
    var store = getStore(domain, LEVELS[i]);
    if (store && store[code]) return { entry: store[code], level: LEVELS[i] };
  }
  return null;
}

function buildIndex() {
  var data = getData(DOMAIN);
  if (!data) return [];
  // Seuls les NAF5 entrent dans le comparateur : le parcours se fait sur le métier précis de l'entreprise.
  return data.naf_index.filter(function(e) { return e.level === 'naf5'; });
}

// ── Actions ──
// Le choix d'un secteur prévient le parcours, qui se redessine s'il est à l'écran.
export function selectSector(code) {
  var res = resolveEntry(code);
  if (!res) return false;
  var v = vs();
  v.sector = code;
  v.sectorLevel = res.level;
  v.sectorLib = res.entry.libelle || '';
  window.dispatchEvent(new CustomEvent('benchsector'));
  return true;
}

// Le national : la somme des NAF 5 (comme le titre et le badge), la ligne méta seulement à défaut.
function natIF(data, view) {
  var n = nationalIndex(data, view);
  return n != null ? n : (data.meta && data.meta.national ? data.meta.national.indice_frequence : null);
}

// ── Calcul complet, partagé par le parcours et le rapport ──
// Un seul endroit calcule les chiffres cités, pour que l'écran et le PDF disent la même chose.
// Rien que des chiffres comparables à ceux du secteur, sans estimation en euros.
export function computeDiagnostic(v) {
  var res = v && v.sector ? resolveEntry(v.sector) : null;
  if (!res || !(v.effectif > 0) || v.accidents == null) return null;
  var eff = v.effectif;
  var s = res.entry.stats;
  var nat = getData(DOMAIN).meta.national || {};
  var coIF = companyIF(v.accidents, eff);
  var sizeData = getData('size');
  var bands = (sizeData && sizeData[v.sector]) ? sizeData[v.sector].bands : null;

  function risk(domain, count) {
    var r = resolveEntry(v.sector, domain);
    var d = getData(domain);
    var co = companyIF(count, eff);
    var sec = r ? r.entry.stats.indice_frequence : null;
    return {
      co: co, sec: sec,
      nat: d ? natIF(d, domain) : null,
      ratio: (co != null && sec > 0) ? co / sec : null,
      entry: r ? r.entry : null
    };
  }

  var out = {
    sector: v.sector, sectorLib: v.sectorLib, level: res.level, entry: res.entry, stats: s,
    effectif: eff, accidents: v.accidents,
    at: { co: coIF, sec: s.indice_frequence, nat: natIF(getData(DOMAIN), DOMAIN),
          peer: sizePeerIF(s.indice_frequence, bands, eff),
          ratio: s.indice_frequence > 0 ? coIF / s.indice_frequence : null },
    mp: risk('mp', v.mp),
    trajet: v.trajet != null ? risk('trajet', v.trajet) : null,
    days: null, over45: null,
    // Les causes nommées par l'entreprise, chacune avec sa part dans le secteur.
    extra: (getData('extra') || {})[v.sector] || null,
    // Pour le rapport : la répartition par taille et la série nationale.
    bands: bands, bandIndex: sizeBandIndex(eff), natYearly: nat.yearly || null
  };
  if (v.joursArret != null && v.accidents > 0 && s.at_1er_reglement > 0) {
    var coDays = v.joursArret / v.accidents, secDays = s.journees_it / s.at_1er_reglement;
    out.days = { co: coDays, sec: secDays, ratio: secDays > 0 ? coDays / secDays : null };
  }
  if (v.arrets45 != null && v.accidents > 0) {
    // Part de l'entreprise seule : la durée des arrêts n'est pas publiée par secteur.
    out.over45 = { co: Math.min(v.arrets45 / v.accidents, 1) };
  }
  return out;
}

// ── Recherche de secteur (sélection unique) ──
// Branchée sur le champ d'une question du parcours, redessinée à chaque écran. onPick reçoit le code.
export function bindSectorSearch(input, acBox, onPick) {
  if (!input || !acBox) return;
  var aria = comboAria(input, acBox);
  var acIndex = -1;

  function closeAc() { acIndex = -1; closeCombo(acBox, aria); }

  function show(query) {
    var index = buildIndex();
    var raw = (query || '').trim();
    if (!raw) { closeAc(); return; }
    // Le classement de la recherche principale, NAF5 en tête (search-synonyms.js).
    var matches = rankSectors(index, raw).slice(0, 30);
    trackEmptySearch(matches.length ? '' : raw, 'compare');
    if (!matches.length) {
      acBox.innerHTML = '<div class="ac-hint">Aucun métier ne correspond. Essayez un autre mot ou votre code NAF.</div>';
      acBox.classList.add('open');
      aria.opened();
      return;
    }
    acBox.innerHTML = matches.map(function(m) {
      return '<div class="ac-item" data-code="' + esc(m.code) + '">' +
        '<span class="code">' + esc(m.code) + '</span>' +
        '<span class="libelle">' + esc(m.libelle) + '</span>' +
        '<span class="level-tag">' + m.level.toUpperCase() + '</span>' +
        '</div>';
    }).join('');
    acBox.querySelectorAll('.ac-item').forEach(function(item) {
      item.addEventListener('click', function() { closeAc(); onPick(this.dataset.code); });
    });
    acIndex = -1;
    acBox.classList.add('open');
    aria.opened();
  }

  input.addEventListener('input', debounce(function() { show(input.value); }, 120));
  comboKeys(input, {
    items: function() { return acBox.querySelectorAll('.ac-item'); },
    index: function() { return acIndex; },
    setIndex: function(n) { acIndex = n; },
    onEscape: closeAc
  });
  input.addEventListener('blur', function() { setTimeout(closeAc, 200); });
}
