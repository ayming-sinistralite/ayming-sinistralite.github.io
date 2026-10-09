// ── Mon entreprise : autodiagnostic de sinistralité ──
// L'entreprise se retrouve dans l'annuaire public (ou reste anonyme), renseigne
// ses chiffres, et on la situe face à son secteur, aux établissements de même
// taille et à la moyenne nationale. La cotisation AT/MP est estimée via le barème
// officiel des coûts moyens dès que la masse salariale est connue.

import { state } from './state.js?v=f8b7846';
import { getData, getStore } from './data.js?v=f8b7846';
import { el, expandQuery, matchesTerms, codeQuery, esc, fmt1, frNum, fmtEur, comboAria, comboKeys } from './utils.js?v=f8b7846';
import { switchView } from './nav.js?v=f8b7846';
import { currentRoute, hasFlag } from './route.js?v=f8b7846';
import { ctnIsOfficial, estimateCotisation, MAJORATIONS } from './cost-model.js?v=f8b7846';
import { markStep } from './checklist.js?v=f8b7846';

// Palette des secteurs comparés (réutilisée par la comparaison inline + l'app).
// Secteurs comparés, le secteur courant gardant var(--accent). Vert de la charte, puis des
// teintes hors charte assumées : quatre séries doivent rester distinctes d'un coup d'œil.
export var SECTOR_COLORS = ['#00b08b', '#f29100', '#8a5cc2', '#6d8093'];

var DOMAIN = 'at';
var LEVELS = ['naf5', 'naf4', 'naf2'];
var LVL_RANK = { naf5: 0, naf4: 1, naf2: 2 };   // pour classer les résultats : NAF5 d'abord

export function vs() { return state.views.compare; }

// ── Helpers purs (testés dans tests/compare.test.js) ──
export function companyIF(count, eff) {
  return (count != null && count >= 0 && eff > 0) ? (count / eff) * 1000 : null;
}

// Classe d'écart commune au verdict et aux badges (tolérance de ±5 % autour du secteur).
export function ratioClass(r) { return r > 1.05 ? 'above' : r < 0.95 ? 'below' : 'neutral'; }

// Compteur saisi : un entier positif, séparateurs de milliers acceptés ("2 000", "2.000", "2,000").
// Tout le reste ("-1", "1,5", "12abc") est refusé plutôt que lu de travers.
export function parseCount(raw) {
  var s = String(raw == null ? '' : raw).replace(/\s/g, '');
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10);
  return null;
}

// Montant en euros : séparateurs de milliers et centimes acceptés ("4 800 000,50", "4.800.000",
// "4,800,000.50"). Le dernier séparateur suivi d'un ou deux chiffres porte les centimes.
export function parseMoney(raw) {
  var s = String(raw == null ? '' : raw).replace(/[\s€]/g, '');
  var m = /^(.*?)(?:[.,](\d{1,2}))?$/.exec(s);
  var whole = parseCount(m[1]);
  if (whole == null) return null;
  return m[2] ? whole + parseInt(m[2], 10) / Math.pow(10, m[2].length) : whole;
}

// Une saisie non vide que le parseur refuse est signalée sur le champ, avec ce qui est attendu.
export function flagInput(input, value, message) {
  var bad = input.value.trim() !== '' && value == null;
  var field = input.closest('.bench-field');
  var note = field && field.querySelector('.bench-field-error');
  if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  if (!field) return;
  if (bad && !note) {
    note = document.createElement('span');
    note.className = 'bench-field-error';
    note.id = input.id + '-error';
    note.textContent = message;
    field.appendChild(note);
    input.setAttribute('aria-describedby', note.id);
  } else if (!bad && note) {
    note.remove();
    input.removeAttribute('aria-describedby');
  }
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

// ── Résolution du secteur (tous niveaux du domaine) ──
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
  // Les sections n'entrent pas dans le comparateur : une section couvre plusieurs CTN, aucune cotisation n'y est étayée.
  if (data.naf_index) return data.naf_index.filter(function(e) { return e.level !== 'naf1'; });
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
  // La masse salariale est requise : sans elle, ni cotisation ni rapport complet.
  var ready = !!(sectorRes && v.effectif > 0 && v.accidents != null && v.accidents >= 0 && v.masseSalariale > 0);
  if (ready) markStep('company');
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

// Les montants en euros se lisent par an ou par mois, au choix du visiteur. Le choix vit le temps
// de la page, la carte étant reconstruite à chaque saisie.
var costPeriod = 'an';
function perPeriod(n) {
  return costPeriod === 'mois' ? fmtEur(n / 12) + ' / mois' : fmtEur(n) + ' / an';
}
function periodToggle() {
  function btn(p, label) {
    return '<button type="button" data-cost-period="' + p + '" aria-pressed="' + (costPeriod === p) + '">' + label + '</button>';
  }
  return '<div class="bench-period" role="group" aria-label="Afficher les montants">' +
    btn('an', 'Par an') + btn('mois', 'Par mois') + '</div>';
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
    ? 'Renseignez votre effectif, vos accidents avec arrêt et votre masse salariale.'
    : 'Choisissez votre secteur, puis renseignez votre effectif, vos accidents avec arrêt et votre masse salariale.';
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
    if (est.mode === 'collectif') gapRow = lineRow('Économie potentielle', 'aucune, taux collectif', 'is-muted');
    else if (g == null) gapRow = '';
    else if (g > est.cotisation * 0.02) gapRow = lineRow('Économie potentielle en revenant à la moyenne', '≈ ' + perPeriod(g), 'is-gain');
    else if (g < -est.cotisation * 0.02) gapRow = lineRow('Avance sur la moyenne de votre secteur', '≈ ' + perPeriod(-g), 'is-ahead');
    else gapRow = lineRow('Écart à la moyenne de votre secteur', 'proche de zéro');
    costRows = periodToggle() + lineRow('Cotisation AT/MP estimée', perPeriod(est.cotisation)) + gapRow;
  }

  return '<div class="bench-result-head"><h3>Votre indice de fréquence</h3>' +
      '<span class="bench-result-sector">' + esc(v.sector) + ' · ' + esc(v.sectorLib) + '</span></div>' +
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
    (est ? '<p class="bench-footnote">' + modeNote(est) + ' Estimation indicative, barème des coûts moyens AT/MP et majorations ' + MAJORATIONS.year + ' (CTN ' + est.ctn + ').</p>' : '');
}

// Ce que la tarification fait de la sinistralité de l'entreprise, selon son effectif.
// Partagée par la carte résultat et le rapport, pour qu'ils disent la même chose.
export function modeNote(est) {
  return modeSentence(est) +
    (est.mpMissing ? ' Vos maladies professionnelles n\'entrent pas dans cette estimation, les données de votre secteur ne sont pas disponibles.' : '') +
    (est.ctnApprox ? ' Le comité technique de votre secteur est approché par sa division NAF, la table officielle n\'ayant pas pu être chargée.' : '');
}

function modeSentence(est) {
  if (est.mode === 'individuel') return 'Avec 150 salariés et plus, votre taux est individuel et suit directement votre sinistralité.';
  if (est.mode === 'mixte') return 'Entre 20 et 149 salariés, votre taux est mixte. ' + Math.round(est.partIndividuelle * 100) + ' % de ce taux suit votre sinistralité, le reste suit celle de votre secteur.';
  return 'En dessous de 20 salariés, votre taux est collectif et fixé pour votre secteur. Vos accidents ne le modifient pas tant que vous restez sous ce seuil.';
}

// Cotisation estimée. Les MP entrent dans la valeur du risque au même titre que les AT
// (D242-6-6), mais seulement si l'entreprise les a renseignées.
function estimateFor(v, s, eff) {
  if (!(v.masseSalariale > 0)) return null;
  var company = { accidents: v.accidents };
  if (v.deces != null) company.deces = v.deces;
  // Les arrêts de l'entreprise, quand elle les donne, classent ses accidents à sa place du barème.
  if (v.joursArret != null && v.accidents > 0) company.avgDays = v.joursArret / v.accidents;
  if (v.arrets45 != null && v.accidents > 0) company.over45 = Math.min(v.arrets45 / v.accidents, 1);
  var mpRes = v.mp != null ? resolveEntry(v.sector, 'mp') : null;
  if (v.mp != null) company.mp = v.mp;
  var est = estimateCotisation(v.sector, s, company, v.masseSalariale, eff, mpRes ? mpRes.entry.stats : null);
  // Une donnée qui manque ne retire rien en silence : la note de l'estimation le dit.
  if (est && v.mp != null && !mpRes) est.mpMissing = true;
  if (est && !ctnIsOfficial()) est.ctnApprox = true;
  return est;
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
  if (!res || !(v.effectif > 0) || v.accidents == null || !(v.masseSalariale > 0)) return null;
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
    // En collectif, le taux se construit sur la sinistralité du secteur, pas sur celle de l'entreprise.
    steps: est ? tauxSteps(est.mode === 'collectif' ? est.imputedCostRef : est.imputedCost, est.masseSalariale, MAJORATIONS) : null,
    mp: v.mp != null ? risk('mp', v.mp) : null,
    trajet: v.trajet != null ? risk('trajet', v.trajet) : null,
    days: null, over45: null,
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

// ── Pastille du secteur sélectionné ──
function renderSectorChip() {
  var wrap = el('bench-sectorChip');
  if (!wrap) return;
  var v = vs();
  if (!v.sector) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<span class="bench-chip">' +
    '<span class="bench-chip-code">' + esc(v.sector) + '</span>' +
    '<span class="bench-chip-lib">' + esc(v.sectorLib || '') + '</span>' +
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
  var aria = comboAria(input, acBox);

  function closeAc() { acBox.classList.remove('open'); vs().acIndex = -1; aria.closed(); }

  function show(query) {
    var index = buildIndex();
    var raw = (query || '').trim();
    if (!raw) {
      // Pas de liste de divisions par défaut : on invite à taper, NAF5 = le plus précis.
      acBox.innerHTML = '<div class="ac-hint">Tapez un métier ou un code NAF. Le niveau le plus précis (NAF5) donne l\'estimation la plus juste.</div>';
      acBox.classList.add('open');
      aria.opened();
      return;
    }
    var qUp = codeQuery(raw);
    var terms = expandQuery(query);
    var matches = index.filter(function(e) {
      if (qUp) return e.code.toUpperCase().startsWith(qUp);
      return matchesTerms(e, terms);
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
    aria.opened();
  }

  var debounce;
  input.addEventListener('input', function() {
    clearTimeout(debounce);
    debounce = setTimeout(function() { show(input.value); }, 120);
  });
  input.addEventListener('focus', function() { show(this.value); });
  comboKeys(input, {
    items: function() { return acBox.querySelectorAll('.ac-item'); },
    index: function() { return vs().acIndex; },
    setIndex: function(n) { vs().acIndex = n; },
    onEscape: closeAc
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('#bench-sectorSearch')) closeAc();
  });
}

// ── Champs saisis ──
var COUNT_FIELDS = { 'bench-effectif': 'effectif', 'bench-masse': 'masseSalariale', 'bench-accidents': 'accidents' };

// Une saisie lisible mais invraisemblable (2,5 € de masse salariale, plus d'accidents que de
// salariés) n'est pas refusée : une ligne sous le champ invite à la vérifier.
function warnField(id, message) {
  var input = el(id);
  var field = input && input.closest('.bench-field');
  if (!field) return;
  var note = field.querySelector('.bench-field-warn');
  if (message && !note) {
    note = document.createElement('span');
    note.className = 'bench-field-warn';
    note.setAttribute('role', 'status');
    field.appendChild(note);
  }
  if (message) note.textContent = message;
  else if (note) note.remove();
}
function checkPlausible() {
  var v = vs();
  var perHead = v.effectif && v.masseSalariale != null ? v.masseSalariale / v.effectif : null;
  warnField('bench-masse', perHead != null && perHead < 5000
    ? 'Cela fait moins de 5 000 € par salarié et par an. La masse salariale se saisit en euros, sur l\'année.' : null);
  warnField('bench-accidents', v.effectif && v.accidents != null && v.accidents > v.effectif
    ? 'Plus d\'accidents que de salariés, vérifiez le nombre saisi.' : null);
}

function setupInputs() {
  Object.keys(COUNT_FIELDS).forEach(function(id) {
    var inp = el(id);
    if (!inp) return;
    var money = COUNT_FIELDS[id] === 'masseSalariale';
    var parse = money ? parseMoney : parseCount;
    var expected = money ? 'Un montant en euros, par exemple 4 800 000.' : 'Un nombre entier, par exemple 120.';
    inp.addEventListener('input', function() {
      var n = parse(this.value);
      vs()[COUNT_FIELDS[id]] = n;
      flagInput(this, n, expected);
      checkPlausible();
      renderBench();
    });
    // À la sortie du champ, le nombre s'affiche avec ses séparateurs de milliers.
    inp.addEventListener('blur', function() {
      var n = parse(this.value);
      if (n != null) this.value = frNum(Math.round(n));
    });
  });
  // Le bouton de la carte résultat ouvre le diagnostic personnalisé.
  var view = el('view-compare');
  if (view) view.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-go-diagnostic]');
    if (btn && !btn.disabled) switchView('diagnostic');
    var per = e.target.closest('[data-cost-period]');
    if (per && per.getAttribute('data-cost-period') !== costPeriod) {
      costPeriod = per.getAttribute('data-cost-period');
      renderBench();
      var again = view.querySelector('[data-cost-period="' + costPeriod + '"]');
      if (again) again.focus();
    }
  });

  var reset = el('bench-reset');
  if (reset) reset.addEventListener('click', function() {
    var v = vs();
    Object.keys(COUNT_FIELDS).forEach(function(id) {
      v[COUNT_FIELDS[id]] = null;
      var e = el(id); if (e) e.value = '';
    });
    checkPlausible();
    v.sector = null; v.sectorLevel = null; v.sectorLib = null;
    // Le reste du diagnostic repart aussi de zéro : il décrit la même entreprise.
    ['joursArret', 'arrets45', 'mp', 'trajet', 'deces', 'tauxNotifie', 'motif', 'suivi45', 'ijRecup', 'reserves'].forEach(function(k) { v[k] = null; });
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
  window.addEventListener('routechange', function() {
    if (currentRoute().view === 'compare') renderBench();
  });
  // Une saisie venue de la landing (?q=) est servie par prefillSector(), appelé par le routeur.
  var entry = currentRoute();
  if (entry.view === 'compare' && !entry.query) renderBench();
}

// ?test remplit tout le parcours, du calcul au contact, pour aller au PDF en cliquant « Continuer ».
// Il vaut mode démonstration (diagnostic.js) : rien ne part vers Pardot. ?demo seul reste vide,
// car en rendez-vous on saisit les chiffres du prospect.
var TEST_ANSWERS = {
  joursArret: 540, arrets45: 3, deces: 0, mp: 1, tauxNotifie: 4.1, motif: 'hausse',
  reserves: 'non', suivi45: 'non', ijRecup: 'nsp',
  contact: { prenom: 'Test', nom: 'Ayming', email: 'test@ayming.com', societe: 'AYMING', fonction: 'Responsable Prévention', consent: true }
};
var TEST_COUNTS = { 'bench-effectif': 120, 'bench-accidents': 9, 'bench-masse': 4800000 };
var testApplied = false;
// Vrai au seul premier appel, pour que « Revenir au calcul » reste sur le calcul.
export function prefillTest() {
  if (testApplied || !hasFlag('test')) return false;
  testApplied = true;
  var v = vs();
  if (!v.sector) selectSector('4120A');   // sans ?q=, un secteur par défaut
  Object.keys(TEST_COUNTS).forEach(function(id) {
    var inp = el(id), k = COUNT_FIELDS[id];
    if (!inp || v[k] != null) return;
    v[k] = TEST_COUNTS[id];
    inp.value = frNum(TEST_COUNTS[id]);
  });
  Object.keys(TEST_ANSWERS).forEach(function(k) { if (v[k] == null) v[k] = TEST_ANSWERS[k]; });
  renderBench();
  return true;
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

