// ── Mon entreprise : autodiagnostic de sinistralité ──
// L'entreprise se retrouve dans l'annuaire public (ou reste anonyme), renseigne
// ses chiffres, et on la situe face à son secteur, aux établissements de même
// taille et à la moyenne nationale. La cotisation AT/MP est estimée via le barème
// officiel des coûts moyens dès que la masse salariale est connue.

import { state } from './state.js';
import { getData, getStore } from './data.js';
import { el, normalize, expandQuery } from './utils.js';
import { switchView } from './nav.js';
import { estimateCotisation, itShares, MAJORATIONS } from './cost-model.js';

// Palette des secteurs comparés (réutilisée par la comparaison inline + l'app).
// Secteurs comparés, le secteur courant gardant var(--accent). Vert de la charte, puis des
// teintes hors charte assumées : quatre séries doivent rester distinctes d'un coup d'œil.
export var SECTOR_COLORS = ['#00b08b', '#f29100', '#8a5cc2', '#6d8093'];

var DOMAIN = 'at';
var LEVELS = ['naf5', 'naf4', 'naf2'];
var LVL_RANK = { naf5: 0, naf4: 1, naf2: 2 };   // pour classer les résultats : NAF5 d'abord
// Risques positionnés en plus de l'AT, affichés dès que l'entreprise les renseigne.
var POS_DOMAINS = [
  { id: 'at', label: 'Accidents du travail', field: 'accidents', subject: 'd\'accidents du travail' },
  { id: 'mp', label: 'Maladies professionnelles', field: 'mp', subject: 'de maladies professionnelles' },
  { id: 'trajet', label: 'Accidents de trajet', field: 'trajet', subject: 'd\'accidents de trajet' }
];

function vs() { return state.views.compare; }

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Formatage ──
function frNum(n) { return n.toLocaleString('fr-FR'); }
function fmt1(n) { return (n == null || isNaN(n)) ? '—' : n.toFixed(1).replace('.', ','); }
function fmtEur(n) {
  n = Math.round(n);
  if (n >= 1000000) return frNum(Math.round(n / 100000) / 10) + ' M€';
  if (n >= 10000) return frNum(Math.round(n / 1000)) + ' k€';
  return frNum(n) + ' €';
}

// ── Helpers purs (testés dans tests/compare.test.js) ──
export function companyIF(count, eff) {
  return (count != null && count >= 0 && eff > 0) ? (count / eff) * 1000 : null;
}

// Classe d'écart commune au verdict et aux badges (tolérance de ±5 % autour du secteur).
export function ratioClass(r) { return r > 1.05 ? 'above' : r < 0.95 ? 'below' : 'neutral'; }

// Compteur saisi : on retire les séparateurs de milliers (espace, point, virgule)
// pour que "2 000" ou "2,000" ne soit pas lu comme 2.
export function parseCount(raw) {
  var s = String(raw == null ? '' : raw).replace(/[^\d]/g, '');
  return s === '' ? null : parseInt(s, 10);
}

// Taux en pourcentage : la virgule décimale française est acceptée.
export function parseRate(raw) {
  var s = String(raw == null ? '' : raw).replace(/[\s%]/g, '').replace(',', '.');
  if (s === '' || !/^\d*\.?\d+$/.test(s)) return null;
  var n = parseFloat(s);
  return n >= 0 && n < 100 ? n : null;
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

// Part estimée des AT du secteur arrêtés plus de 45 jours (catégories it4 à it6 du barème),
// à partir de la durée moyenne du secteur et de la distribution nationale publiée.
export function sectorShareOver45(stats) {
  var n = stats && (stats.at_4j_arret || stats.at_1er_reglement);
  if (!(n > 0) || !stats.journees_it) return null;
  var s = itShares('at', stats.journees_it / n);
  return s[3] + s[4] + s[5];
}

// ── Résolution du secteur (tous niveaux du domaine) ──
function resolveEntry(code, domain) {
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
  if (data.naf_index) return data.naf_index;
  return []
    .concat(Object.entries(data.by_naf2).map(function(p) { return { code: p[0], libelle: p[1].libelle, level: 'naf2' }; }))
    .concat(Object.entries(data.by_naf4).map(function(p) { return { code: p[0], libelle: p[1].libelle, level: 'naf4' }; }))
    .concat(Object.entries(data.by_naf5).map(function(p) { return { code: p[0], libelle: p[1].libelle, level: 'naf5' }; }));
}

// ── Actions ──
export function selectSector(code) {
  var res = resolveEntry(code);
  if (!res) return false;
  var v = vs();
  v.sector = code;
  v.sectorLevel = res.level;
  v.sectorLib = res.entry.libelle || '';
  renderBench();
  return true;
}

// ── Rendu principal ──
export function renderBench() {
  if (!getData(DOMAIN)) return;
  var v = vs();
  var sectorSearch = el('bench-sectorSearch');
  if (sectorSearch) sectorSearch.hidden = !!v.sector;
  renderSectorChip();

  var box = el('bench-results');
  if (!box) return;
  var sectorRes = v.sector ? resolveEntry(v.sector) : null;
  var ready = !!(sectorRes && v.effectif > 0 && v.accidents != null && v.accidents >= 0);
  box.innerHTML = (ready ? renderResult(v) : renderEmptyResult(!!sectorRes)) + resultFooter(v, ready);
}

// Pied de la carte résultat : l'appel vers le diagnostic personnalisé, qui a sa propre vue.
// Une fois le résultat affiché, le pied passe en encart mis en avant. L'animation d'arrivée
// ne joue qu'au passage de l'état vide à l'état rempli, pas à chaque frappe (la carte est
// reconstruite à chaque saisie).
var ctaWasReady = false;
function resultFooter(v, ready) {
  var arriving = ready && !ctaWasReady;
  ctaWasReady = ready;
  return '<div class="bench-result-foot bench-result-cta' + (ready ? ' is-ready' : '') + (arriving ? ' is-arriving' : '') + '">' +
    '<p>Recevez votre <strong>diagnostic de sinistralité personnalisé</strong>, au format PDF.</p>' +
    '<button type="button" class="bench-primary-btn" data-go-diagnostic' + (ready ? '' : ' disabled') + '>Obtenir mon diagnostic' +
      (ready ? '<span class="bench-btn-arrow" aria-hidden="true">→</span>' : '') + '</button>' +
  '</div>';
}

function lineRow(label, value, cls) {
  return '<div class="bench-line' + (cls ? ' ' + cls : '') + '"><span class="bench-line-label">' + label + '</span>' +
    '<span class="bench-line-val">' + value + '</span></div>';
}

function badge(ratio) {
  if (ratio == null) return '';
  return '<span class="bench-badge ' + ratioClass(ratio) + '">' + (ratio >= 1 ? '+' : '−') +
    Math.round(Math.abs(ratio - 1) * 100) + ' % vs secteur</span>';
}

// ── Carte résultat, état vide : la structure est visible avant la saisie ──
function renderEmptyResult(hasSector) {
  var hint = hasSector
    ? 'Renseignez votre effectif et vos accidents avec arrêt.'
    : 'Choisissez votre secteur, puis renseignez votre effectif et vos accidents avec arrêt.';
  return '<div class="bench-result-head"><h3>Votre indice de fréquence</h3></div>' +
    '<div class="bench-big is-empty"><span class="bench-big-num">—</span>' +
      '<span class="bench-big-cap">' + hint + '</span></div>' +
    '<div class="bench-lines">' +
      lineRow('Votre secteur', '—') +
      lineRow('Établissements de même taille', '—') +
      lineRow('Moyenne nationale', '—') +
      lineRow('Cotisation AT/MP estimée', '—') +
      lineRow('Économie potentielle', '—') +
    '</div>';
}

// ── Carte résultat, complète : un chiffre, cinq lignes ──
function renderResult(v) {
  var d = computeDiagnostic(v);
  var secIF = d.at.sec, natIF = d.at.nat, coIF = d.at.co, ratio = d.at.ratio, peerIF = d.at.peer;
  var est = d.est;
  var costRows;
  if (!(v.masseSalariale > 0)) {
    costRows = lineRow('Cotisation AT/MP estimée', 'ajoutez votre masse salariale', 'is-muted') +
      lineRow('Économie potentielle', '—', 'is-muted');
  } else if (!est) {
    costRows = lineRow('Cotisation AT/MP estimée', 'non estimable pour ce secteur', 'is-muted');
  } else {
    var g = est.gap, gapRow;
    if (g == null) gapRow = '';
    else if (g > est.cotisation * 0.02) gapRow = lineRow('Économie potentielle en revenant à la moyenne', '≈ ' + fmtEur(g) + ' / an', 'is-gain');
    else if (g < -est.cotisation * 0.02) gapRow = lineRow('Avance sur la moyenne de votre secteur', '≈ ' + fmtEur(-g) + ' / an', 'is-ahead');
    else gapRow = lineRow('Écart à la moyenne de votre secteur', 'proche de zéro');
    costRows = lineRow('Cotisation AT/MP estimée', fmtEur(est.cotisation) + ' / an') + gapRow;
  }

  return '<div class="bench-result-head"><h3>Votre indice de fréquence</h3>' +
      '<span class="bench-result-sector">' + escapeHtml(v.sector) + ' · ' + escapeHtml(v.sectorLib) + '</span></div>' +
    '<div class="bench-big">' +
      '<span class="bench-big-num">' + fmt1(coIF) + '</span>' +
      '<span class="bench-big-cap">accidents avec arrêt pour 1 000 salariés</span>' +
      badge(ratio) +
    '</div>' +
    '<div class="bench-lines">' +
      lineRow('Votre secteur', fmt1(secIF)) +
      lineRow('Établissements de même taille', peerIF != null ? fmt1(peerIF) : 'non publié', peerIF == null ? 'is-muted' : '') +
      lineRow('Moyenne nationale', fmt1(natIF)) +
      costRows +
    '</div>' +
    (est ? '<p class="bench-footnote">Estimation indicative, barème des coûts moyens AT/MP et majorations ' + MAJORATIONS.year + ' (CTN ' + est.ctn + ').</p>' : '');
}

// Cotisation estimée. Les MP entrent dans la valeur du risque au même titre que les AT
// (D242-6-6), mais seulement si l'entreprise les a renseignées.
function estimateFor(v, s, eff) {
  if (!(v.masseSalariale > 0)) return null;
  var company = { accidents: v.accidents };
  if (v.deces != null) company.deces = v.deces;
  var mpRes = v.mp != null ? resolveEntry(v.sector, 'mp') : null;
  if (v.mp != null) company.mp = v.mp;
  return estimateCotisation(v.sector, s, company, v.masseSalariale, eff, mpRes ? mpRes.entry.stats : null);
}

// Décomposition du taux net, dans l'ordre de la formule
// taux net = (taux brut + M1) × (1 + M2) + M3 + M4. Utilisée par le rapport PDF.
export function tauxSteps(imputedCost, masseSalariale, m) {
  if (!(masseSalariale > 0)) return null;
  var brut = imputedCost / masseSalariale * 100;
  var m2 = (brut + m.M1) * m.M2;
  return { brut: brut, m1: m.M1, m2: m2, m3: m.M3, m4: m.M4, net: brut + m.M1 + m2 + m.M3 + m.M4 };
}

// ── Calcul complet, partagé par la carte résultat et le diagnostic personnalisé ──
// Un seul endroit calcule les chiffres cités, pour que l'écran et le PDF disent la même chose.
export function computeDiagnostic(v) {
  var res = v && v.sector ? resolveEntry(v.sector) : null;
  if (!res || !(v.effectif > 0) || v.accidents == null) return null;
  var eff = v.effectif;
  var s = res.entry.stats;
  var nat = getData(DOMAIN).meta.national || {};
  var coIF = companyIF(v.accidents, eff);
  var sizeData = getData('size');
  var bands = (sizeData && sizeData[v.sector]) ? sizeData[v.sector].bands : null;
  var est = estimateFor(v, s, eff);

  function risk(domain, count) {
    var r = resolveEntry(v.sector, domain);
    var d = getData(domain);
    var co = companyIF(count, eff);
    var sec = r ? r.entry.stats.indice_frequence : null;
    return {
      co: co, sec: sec,
      nat: d && d.meta.national ? d.meta.national.indice_frequence : null,
      ratio: (co != null && sec > 0) ? co / sec : null,
      entry: r ? r.entry : null
    };
  }

  var out = {
    sector: v.sector, sectorLib: v.sectorLib, level: res.level, entry: res.entry, stats: s,
    effectif: eff, accidents: v.accidents,
    at: { co: coIF, sec: s.indice_frequence, nat: nat.indice_frequence,
          peer: sizePeerIF(s.indice_frequence, bands, eff),
          ratio: s.indice_frequence > 0 ? coIF / s.indice_frequence : null },
    est: est,
    steps: est ? tauxSteps(est.imputedCost, est.masseSalariale, MAJORATIONS) : null,
    mp: v.mp != null ? risk('mp', v.mp) : null,
    trajet: v.trajet != null ? risk('trajet', v.trajet) : null,
    days: null, over45: null,
    extra: (getData('extra') || {})[v.sector] || null
  };
  if (v.joursArret != null && v.accidents > 0 && s.at_1er_reglement > 0) {
    var coDays = v.joursArret / v.accidents, secDays = s.journees_it / s.at_1er_reglement;
    out.days = { co: coDays, sec: secDays, ratio: secDays > 0 ? coDays / secDays : null };
  }
  if (v.arrets45 != null && v.accidents > 0) {
    var coShare = Math.min(v.arrets45 / v.accidents, 1), secShare = sectorShareOver45(s);
    out.over45 = { co: coShare, sec: secShare, ratio: secShare > 0 ? coShare / secShare : null };
  }
  return out;
}

// ── Pastille du secteur sélectionné ──
function renderSectorChip() {
  var wrap = el('bench-sectorChip');
  if (!wrap) return;
  var v = vs();
  if (!v.sector) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<span class="bench-chip">' +
    '<span class="bench-chip-code">' + escapeHtml(v.sector) + '</span>' +
    '<span class="bench-chip-lib">' + escapeHtml(v.sectorLib || '') + '</span>' +
    '<button type="button" class="bench-chip-x" id="bench-sectorClear" aria-label="Changer de secteur">&times;</button>' +
  '</span>';
  var clr = el('bench-sectorClear');
  if (clr) clr.addEventListener('click', function() {
    var s = vs(); s.sector = null; s.sectorLevel = null; s.sectorLib = null;
    var inp = el('bench-sectorInput');
    renderBench();
    if (inp) { inp.value = ''; inp.focus(); }
  });
}

// ── Autocomplete secteur (sélection unique) ──
function setupSectorInput() {
  var input = el('bench-sectorInput');
  var acBox = el('bench-autocomplete');
  if (!input || !acBox) return;

  function closeAc() { acBox.classList.remove('open'); vs().acIndex = -1; }

  function show(query) {
    var index = buildIndex();
    var raw = (query || '').trim();
    if (!raw) {
      // Pas de liste de divisions par défaut : on invite à taper, NAF5 = le plus précis.
      acBox.innerHTML = '<div class="ac-hint">Tapez un métier ou un code NAF. Le niveau le plus précis (NAF5) donne l\'estimation la plus juste.</div>';
      acBox.classList.add('open');
      return;
    }
    var qUp = raw.toUpperCase();
    var isCode = /^[0-9]/.test(raw);
    var terms = expandQuery(query);
    var matches = index.filter(function(e) {
      if (isCode) return e.code.toUpperCase().startsWith(qUp);
      return terms.some(function(t) { return normalize(e.code).includes(t) || normalize(e.libelle).includes(t); });
    }).sort(function(a, b) {
      var ra = LVL_RANK[a.level], rb = LVL_RANK[b.level];   // NAF5 en tête
      if (ra !== rb) return ra - rb;
      return a.code.localeCompare(b.code);
    }).slice(0, 30);
    if (!matches.length) { closeAc(); return; }
    acBox.innerHTML = matches.map(function(m) {
      return '<div class="ac-item" data-code="' + m.code + '">' +
        '<span class="code">' + m.code + '</span>' +
        '<span class="libelle">' + m.libelle + '</span>' +
        '<span class="level-tag">' + m.level.toUpperCase() + '</span>' +
        '</div>';
    }).join('');
    acBox.querySelectorAll('.ac-item').forEach(function(item) {
      item.addEventListener('click', function() {
        selectSector(this.dataset.code);
        input.value = '';
        closeAc();
      });
    });
    vs().acIndex = -1;
    acBox.classList.add('open');
  }

  var debounce;
  input.addEventListener('input', function() {
    clearTimeout(debounce);
    debounce = setTimeout(function() { show(input.value); }, 120);
  });
  input.addEventListener('focus', function() { show(this.value); });
  input.addEventListener('keydown', function(e) {
    var items = acBox.querySelectorAll('.ac-item');
    var v = vs();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      v.acIndex = Math.min(v.acIndex + 1, items.length - 1);
      items.forEach(function(it, i) { it.classList.toggle('active', i === v.acIndex); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      v.acIndex = Math.max(v.acIndex - 1, 0);
      items.forEach(function(it, i) { it.classList.toggle('active', i === v.acIndex); });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length) items[v.acIndex >= 0 ? v.acIndex : 0].click();
    } else if (e.key === 'Escape') {
      closeAc();
    }
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('#bench-sectorSearch')) closeAc();
  });
}

// ── Champs saisis ──
var COUNT_FIELDS = { 'bench-effectif': 'effectif', 'bench-masse': 'masseSalariale', 'bench-accidents': 'accidents' };

function setupInputs() {
  Object.keys(COUNT_FIELDS).forEach(function(id) {
    var inp = el(id);
    if (!inp) return;
    inp.addEventListener('input', function() {
      vs()[COUNT_FIELDS[id]] = parseCount(this.value);
      renderBench();
    });
    // À la sortie du champ, le nombre s'affiche avec ses séparateurs de milliers.
    inp.addEventListener('blur', function() {
      var n = parseCount(this.value);
      if (n != null) this.value = frNum(n);
    });
  });
  // Le bouton de la carte résultat ouvre le diagnostic personnalisé.
  var view = el('view-compare');
  if (view) view.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-go-diagnostic]');
    if (btn && !btn.disabled) switchView('diagnostic');
  });

  var reset = el('bench-reset');
  if (reset) reset.addEventListener('click', function() {
    var v = vs();
    Object.keys(COUNT_FIELDS).forEach(function(id) {
      v[COUNT_FIELDS[id]] = null;
      var e = el(id); if (e) e.value = '';
    });
    v.sector = null; v.sectorLevel = null; v.sectorLib = null;
    // Le reste du diagnostic repart aussi de zéro : il décrit la même entreprise.
    ['joursArret', 'arrets45', 'mp', 'trajet', 'deces', 'tauxNotifie', 'knowsTaux', 'duerp', 'suivi45', 'tauxVerifie', 'ijRecup'].forEach(function(k) { v[k] = null; });
    v.diagStep = 0;
    ['bench-sectorInput'].forEach(function(id) {
      var e = el(id); if (e) e.value = '';
    });
    renderBench();
  });
}

// ── Init ──
export function initCompare() {
  setupSectorInput();
  setupInputs();

  document.querySelectorAll('.nav-item[data-view="compare"]').forEach(function(item) {
    item.addEventListener('click', function() { renderBench(); });
  });
  window.addEventListener('hashchange', function() {
    if (window.location.hash.replace('#', '').trim() === 'compare') renderBench();
  });
  if (window.location.hash.replace('#', '').trim() === 'compare') renderBench();
}

// Arrivée depuis la landing : un code connu est choisi d'emblée et l'effectif prend la main,
// un mot-clé ouvre la recherche déjà remplie. La saisie ne passe que par .value.
export function prefillSector(query) {
  var q = (query || '').trim();
  var code = q.toUpperCase().replace(/[.\s]/g, '');
  if (code && selectSector(code)) {
    var eff = el('bench-effectif');
    if (eff) eff.focus();
    return;
  }
  renderBench();
  var inp = el('bench-sectorInput');
  if (inp && q) { inp.value = q; inp.focus(); }
}

// Ouvre l'autodiagnostic avec un secteur déjà choisi (bouton des vues sectorielles).
export function openCompareWithSector(code) {
  var v = vs();
  if (code && resolveEntry(code)) {
    v.sector = code;
    var res = resolveEntry(code);
    v.sectorLevel = res.level;
    v.sectorLib = res.entry.libelle || '';
  }
  renderBench();
}
