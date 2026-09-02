// ── Mon entreprise : benchmark sectoriel + coût social estimé (AT) ──
// L'entreprise renseigne son secteur, son effectif et ses AT avec arrêt ;
// on la situe face à son secteur et à la moyenne nationale, puis on estime
// le coût social de ses accidents via le barème officiel des coûts moyens AT/MP.

import { state } from './state.js';
import { getData, getStore } from './data.js';
import { el, normalize, expandQuery } from './utils.js';
import { estimateCotisation, AVG_SALARY, MAJORATIONS, BAREME_YEAR, BAREME_SOURCE } from './cost-model.js';

// Palette des secteurs comparés (réutilisée par la comparaison inline + l'app).
export var SECTOR_COLORS = ['#e8710a', '#12b5cb', '#e52592', '#1e8e3e'];

var DOMAIN = 'at';
var LEVELS = ['naf5', 'naf4', 'naf2'];
var LVL_RANK = { naf5: 0, naf4: 1, naf2: 2 };   // pour classer les résultats : NAF5 d'abord
// Risques positionnés dans le benchmark (le coût social reste sur l'AT).
var POS_DOMAINS = [
  { id: 'at', label: 'Accidents du travail', field: 'accidents', subject: 'd\'accidents du travail' },
  { id: 'mp', label: 'Maladies professionnelles', field: 'mp', subject: 'de maladies professionnelles' },
  { id: 'trajet', label: 'Accidents de trajet', field: 'trajet', subject: 'd\'accidents de trajet' }
];

function vs() { return state.views.compare; }

// ── Formatage ──
function frNum(n) { return n.toLocaleString('fr-FR'); }
function fmt0(n) { return (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('fr-FR'); }
function fmt1(n) { return (n == null || isNaN(n)) ? '—' : n.toFixed(1).replace('.', ','); }
function pct(x) { return Math.round(x * 100) + ' %'; }
function fmtEur(n) {
  n = Math.round(n);
  if (n >= 1000000) return frNum(Math.round(n / 100000) / 10) + ' M€';
  if (n >= 10000) return frNum(Math.round(n / 1000)) + ' k€';
  return frNum(n) + ' €';
}

// ── Résolution du secteur (tous niveaux du domaine AT) ──
function resolveEntry(code, domain) {
  domain = domain || DOMAIN;
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
// Exporté pour le renvoi depuis l'assistant (« Comparer une entreprise à ce secteur »).
export function selectSector(code) {
  var res = resolveEntry(code);
  if (!res) return;
  var v = vs();
  v.sector = code;
  v.sectorLevel = res.level;
  v.sectorLib = res.entry.libelle || '';
  renderBench();
}

// ── Rendu principal ──
function renderBench() {
  var data = getData(DOMAIN);
  var box = el('bench-results');
  if (!data || !box) return;
  var v = vs();

  renderSectorChip();
  applyOtherVisibility();

  var sectorRes = v.sector ? resolveEntry(v.sector) : null;
  var eff = v.effectif, acc = v.accidents;
  var ready = sectorRes && eff > 0 && acc != null && acc >= 0;

  if (!ready) {
    box.innerHTML = renderSamplePreview(!!sectorRes);
    return;
  }

  var entry = sectorRes.entry;
  var s = entry.stats;

  box.innerHTML = renderPositions(v, eff) + renderCotisation(v, entry, s, eff);
}

// ── État initial : aperçu grisé de ce que l'outil va produire ──
function renderSamplePreview(hasSector) {
  var hint = hasSector
    ? 'Renseignez votre <strong>effectif</strong> et vos <strong>AT avec arrêt</strong> pour voir votre position et le coût estimé.'
    : 'Choisissez votre <strong>secteur</strong>, puis renseignez votre effectif et vos AT avec arrêt.';
  var ghost =
    '<section class="bench-card bench-ghost" aria-hidden="true">' +
      '<h3>Ma position : indice de fréquence</h3>' +
      '<p class="bench-sub">Vos sinistres ramenés à 1 000 salariés, comparés à votre secteur et à la moyenne nationale.</p>' +
      '<div class="bench-pos-tablewrap"><table class="bench-pos-table"><thead><tr>' +
        '<th>Risque</th><th>Mon entreprise</th><th>Mon secteur</th><th>National</th><th>vs secteur</th>' +
      '</tr></thead><tbody>' +
        '<tr><td class="bench-pos-risk">Accidents du travail</td>' +
          '<td class="num accent"><div class="bench-co"><span class="bench-co-if">22,5</span><span class="bench-co-cap">votre indice de fréquence</span></div></td>' +
          '<td class="num">76,5</td><td class="num">23,9</td><td><span class="bench-badge below">−71%</span></td></tr>' +
      '</tbody></table></div>' +
    '</section>';
  return '<div class="bench-sample"><div class="bench-sample-hint"><span>' + hint + '</span></div>' + ghost + '</div>';
}

// ── Carte « Ma position » (AT + MP + Trajet) ──
export function companyIF(count, eff) {
  return (count != null && count >= 0 && eff > 0) ? (count / eff) * 1000 : null;
}

// Classe d'écart commune au verdict et aux badges (tolérance de ±5 % autour du secteur).
export function ratioClass(r) { return r > 1.05 ? 'above' : r < 0.95 ? 'below' : 'neutral'; }

// Verdict global : il couvre TOUS les risques affichés, pas seulement l'AT.
// Un seul risque au-dessus du secteur suffit à faire basculer le bandeau en alerte.
function renderVerdict(risks) {
  var scored = risks.filter(function(d) { return d.ratio != null; });
  if (!scored.length) return '';

  var aboves = scored.filter(function(d) { return d.cls === 'above'; })
                     .sort(function(a, b) { return b.ratio - a.ratio; });
  var belows = scored.filter(function(d) { return d.cls === 'below'; });

  function above(d) { return 'Votre fréquence ' + d.subject + ' est <strong>' + pct(d.ratio - 1) + ' au-dessus</strong> de votre secteur.'; }
  function below(d) { return 'Votre fréquence ' + d.subject + ' est <strong>' + pct(1 - d.ratio) + ' en dessous</strong> de votre secteur.'; }

  var cls, txt;
  if (aboves.length) {
    cls = 'above';
    txt = aboves.map(above).join(' ');
    if (belows.length === 1) txt += ' En revanche, votre fréquence ' + belows[0].subject + ' est <strong>' + pct(1 - belows[0].ratio) + ' en dessous</strong>.';
    else if (belows.length > 1) txt += ' En revanche, vos autres risques suivis sont en dessous de votre secteur.';
  } else if (belows.length === scored.length) {
    cls = 'below';
    txt = (scored.length === 1) ? below(scored[0])
        : 'Tous vos risques suivis sont <strong>en dessous</strong> de la moyenne de votre secteur.';
  } else {
    cls = 'neutral';
    txt = (scored.length === 1) ? 'Votre fréquence ' + scored[0].subject + ' est <strong>proche de la moyenne</strong> de votre secteur.'
        : 'Votre sinistralité est <strong>proche de la moyenne</strong> de votre secteur.';
  }
  return '<div class="bench-verdict ' + cls + '">' + txt + '</div>';
}

function renderPositions(v, eff) {
  // MP / Trajet n'apparaissent que si l'utilisateur les a ajoutés (indépendamment).
  var risks = POS_DOMAINS.filter(function(d) {
    return d.id === 'at' || (d.id === 'mp' && v.showMp) || (d.id === 'trajet' && v.showTrajet);
  }).map(function(d) {
    var data = getData(d.id);
    var res = resolveEntry(v.sector, d.id);
    var secIF = res ? res.entry.stats.indice_frequence : null;
    var coIF = companyIF(v[d.field], eff);
    var ratio = (coIF != null && secIF > 0) ? coIF / secIF : null;
    return {
      label: d.label, subject: d.subject,
      secIF: secIF,
      natIF: (data && data.meta.national) ? data.meta.national.indice_frequence : null,
      coIF: coIF, ratio: ratio,
      cls: ratio != null ? ratioClass(ratio) : null
    };
  });

  var headline = renderVerdict(risks);

  var rows = risks.map(function(d) {
    var badge = (d.ratio != null)
      ? '<span class="bench-badge ' + d.cls + '">' + (d.ratio >= 1 ? '+' : '−') + Math.round(Math.abs(d.ratio - 1) * 100) + '%</span>'
      : '<span class="bench-badge muted">—</span>';
    // Cellule "Mon entreprise" : l'indice de fréquence, libellé clair (pas la formule brute).
    var coCell = (d.coIF != null)
      ? '<div class="bench-co"><span class="bench-co-if">' + fmt1(d.coIF) + '</span>' +
          '<span class="bench-co-cap">votre indice de fréquence</span></div>'
      : '<span class="bench-co-empty">—</span>';
    return '<tr>' +
      '<td class="bench-pos-risk">' + d.label + '</td>' +
      '<td class="num accent">' + coCell + '</td>' +
      '<td class="num">' + fmt1(d.secIF) + '</td>' +
      '<td class="num">' + fmt1(d.natIF) + '</td>' +
      '<td>' + badge + '</td>' +
    '</tr>';
  }).join('');

  return '<section class="bench-card">' +
    '<h3>Ma position : indice de fréquence</h3>' +
    '<p class="bench-sub">L\'indice de fréquence ramène vos sinistres à 1 000 salariés (nombre ÷ effectif × 1 000), pour pouvoir comparer à votre secteur et à la moyenne nationale, quelle que soit la taille.</p>' +
    headline +
    '<div class="bench-pos-tablewrap"><table class="bench-pos-table"><thead><tr>' +
      '<th>Risque</th><th>Mon entreprise</th><th>Mon secteur</th><th>National</th><th>vs secteur</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
  '</section>';
}

// ── Carte « Coût social estimé » ──
function renderCotisation(v, entry, s, eff) {
  var company = { accidents: v.accidents };
  if (v.deces != null) company.deces = v.deces;
  // Les MP entrent dans la valeur du risque au même titre que les AT (D242-6-6),
  // mais seulement si l'entreprise les a renseignées.
  var mpRes = v.showMp ? resolveEntry(v.sector, 'mp') : null;
  var mpStats = mpRes ? mpRes.entry.stats : null;
  if (v.showMp && v.mp != null && v.mp >= 0) company.mp = v.mp;
  var est = estimateCotisation(v.sector, s, company, v.masseSalariale || 0, eff, mpStats);
  if (!est) return '';

  var modeNote = est.mode === 'individuel'
    ? 'Tarification individuelle (≥ 150 salariés) : votre taux reflète directement votre sinistralité.'
    : est.mode === 'mixte'
      ? 'Tarification mixte (20–149 salariés) : une partie de votre taux dépend de votre sinistralité.'
      : 'Tarification collective (< 20 salariés) : votre taux est fixé par votre secteur ; la prévention agit indirectement.';

  // L'économie potentielle = écart de cotisation vs une entreprise à la sinistralité moyenne du secteur.
  var gapHTML = '';
  if (est.gap != null) {
    var g = est.gap;
    if (g > est.cotisation * 0.02) gapHTML = '<div class="bench-gap above">≈ <strong>' + fmtEur(g) + ' / an</strong> de surcoût lié à votre sur-sinistralité. C\'est votre économie potentielle en revenant à la moyenne de votre secteur.</div>';
    else if (g < -est.cotisation * 0.02) gapHTML = '<div class="bench-gap below">≈ <strong>' + fmtEur(-g) + ' / an</strong> de moins qu\'une entreprise moyenne de votre secteur : vous êtes déjà sous la moyenne.</div>';
    else gapHTML = '<div class="bench-gap neutral">Proche de la cotisation attendue pour la moyenne de votre secteur.</div>';
  }

  var msLabel = est.estimatedMs
    ? 'Masse salariale estimée (' + fmt0(eff) + ' × ' + fmt0(AVG_SALARY) + ' €)'
    : 'Masse salariale (saisie)';

  return '<section class="bench-card bench-cost">' +
    '<h3>Votre cotisation AT/MP estimée</h3>' +
    '<p class="bench-sub">Part de votre cotisation liée à votre sinistralité, à partir du barème des coûts moyens AT/MP ' +
      BAREME_YEAR + ' (CTN ' + est.ctn + ') et des majorations ' + MAJORATIONS.year + '.</p>' +
    '<div class="bench-cost-main">' +
      '<span class="bench-cost-big">' + fmtEur(est.cotisation) + '</span>' +
      '<span class="bench-cost-unit">par an<br>taux net estimé ≈ ' + fmt1(est.tauxNet) + ' %</span>' +
    '</div>' +
    gapHTML +
    '<div class="bench-cost-breakdown">' +
      breakdownRow(msLabel, est.masseSalariale) +
      breakdownRow('Coût de votre sinistralité (valeur du risque)', est.imputedCost) +
      (est.withMp ? breakdownRow('dont accidents du travail', est.atCost) : '') +
      (est.withMp ? breakdownRow('dont maladies professionnelles', est.mpCost) : '') +
      breakdownRow('Votre cotisation estimée', est.cotisation) +
      (est.cotisationRef != null ? breakdownRow('Cotisation à la moyenne du secteur', est.cotisationRef) : '') +
    '</div>' +
    '<p class="bench-disclaimer">' + modeNote + ' ' + perimetreNote(est.withMp) +
      ' Estimation indicative (± selon le code risque réel ; le taux collectif exact n\'est pas public par NAF). ' +
      BAREME_SOURCE + ' Renseignez votre masse salariale réelle pour affiner.</p>' +
  '</section>';
}

// Le périmètre du calcul doit être dit à l'utilisateur, il change le montant.
// Les accidents de trajet n'y figurent jamais, ils sont couverts par la majoration M1.
function perimetreNote(withMp) {
  return withMp
    ? 'Le calcul couvre vos accidents du travail et vos maladies professionnelles. Les accidents de trajet en sont exclus, ils sont couverts par la majoration forfaitaire M1.'
    : 'Le calcul ne couvre que vos accidents du travail. Ajoutez vos maladies professionnelles ci-dessus pour une estimation complète, elles entrent dans la valeur du risque au même titre que les AT.';
}

function breakdownRow(label, value) {
  return '<div class="bench-bd-row"><span class="bench-bd-label">' + label + '</span>' +
    '<span class="bench-bd-val">' + fmtEur(value) + '</span></div>';
}

// ── Ajout indépendant des risques MP / Trajet ──
function toggleRisk(key, on, label) {
  var field = el('bench-' + key + 'Field');
  var btn = el('bench-add' + key.charAt(0).toUpperCase() + key.slice(1));
  if (field) field.style.display = on ? '' : 'none';
  if (btn) {
    btn.classList.toggle('active', on);
    btn.textContent = (on ? '✓ ' : '+ ') + label;
  }
}
function applyOtherVisibility() {
  var v = vs();
  toggleRisk('mp', v.showMp, 'Maladies professionnelles');
  toggleRisk('trajet', v.showTrajet, 'Accidents de trajet');
  toggleRisk('deces', v.showDeces, 'Décès');
}

// ── Pastille du secteur sélectionné ──
function renderSectorChip() {
  var wrap = el('bench-sectorChip');
  if (!wrap) return;
  var v = vs();
  if (!v.sector) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<span class="bench-chip">' +
    '<span class="bench-chip-code">' + v.sector + '</span>' +
    '<span class="bench-chip-lib">' + (v.sectorLib || '') + '</span>' +
    '<button class="bench-chip-x" id="bench-sectorClear" aria-label="Changer de secteur">&times;</button>' +
  '</span>';
  var clr = el('bench-sectorClear');
  if (clr) clr.addEventListener('click', function() {
    var s = vs(); s.sector = null; s.sectorLevel = null; s.sectorLib = null;
    var inp = el('bench-sectorInput'); if (inp) inp.value = '';
    renderBench();
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
    if (!e.target.closest('#view-compare .bench-search')) closeAc();
  });
}

// ── Champs entreprise ──
function setupCompanyInputs() {
  var map = { 'bench-effectif': 'effectif', 'bench-masse': 'masseSalariale', 'bench-accidents': 'accidents', 'bench-mp': 'mp', 'bench-trajet': 'trajet', 'bench-deces': 'deces' };
  Object.keys(map).forEach(function(id) {
    var inp = el(id);
    if (!inp) return;
    inp.addEventListener('input', function() {
      // Compteurs entiers : on retire les séparateurs de milliers (espace, point, virgule)
      // pour éviter que "2 000" / "2,000" soit lu comme 2.
      var raw = (this.value || '').replace(/[^\d]/g, '');
      vs()[map[id]] = raw === '' ? null : parseInt(raw, 10);
      renderBench();
    });
  });
  var addMp = el('bench-addMp');
  if (addMp) addMp.addEventListener('click', function() {
    var v = vs(); v.showMp = !v.showMp;
    if (!v.showMp) { v.mp = null; var i = el('bench-mp'); if (i) i.value = ''; }
    renderBench();
    if (v.showMp) { var f = el('bench-mp'); if (f) f.focus(); }
  });
  var addTrajet = el('bench-addTrajet');
  if (addTrajet) addTrajet.addEventListener('click', function() {
    var v = vs(); v.showTrajet = !v.showTrajet;
    if (!v.showTrajet) { v.trajet = null; var i = el('bench-trajet'); if (i) i.value = ''; }
    renderBench();
    if (v.showTrajet) { var f = el('bench-trajet'); if (f) f.focus(); }
  });
  var addDeces = el('bench-addDeces');
  if (addDeces) addDeces.addEventListener('click', function() {
    var v = vs(); v.showDeces = !v.showDeces;
    if (!v.showDeces) { v.deces = null; var i = el('bench-deces'); if (i) i.value = ''; }
    renderBench();
    if (v.showDeces) { var f = el('bench-deces'); if (f) f.focus(); }
  });

  var reset = el('bench-reset');
  if (reset) reset.addEventListener('click', function() {
    var v = vs();
    v.effectif = null; v.masseSalariale = null; v.accidents = null; v.mp = null; v.trajet = null; v.deces = null;
    v.sector = null; v.sectorLevel = null; v.sectorLib = null; v.showMp = false; v.showTrajet = false; v.showDeces = false;
    ['bench-effectif', 'bench-masse', 'bench-accidents', 'bench-mp', 'bench-trajet', 'bench-deces', 'bench-sectorInput'].forEach(function(id) {
      var e = el(id); if (e) e.value = '';
    });
    renderBench();
  });
}

// ── Init ──
export function initCompare() {
  setupSectorInput();
  setupCompanyInputs();

  document.querySelectorAll('.nav-item[data-view="compare"]').forEach(function(item) {
    item.addEventListener('click', function() { renderBench(); });
  });
  window.addEventListener('hashchange', function() {
    if (window.location.hash.replace('#', '').trim() === 'compare') renderBench();
  });
  if (window.location.hash.replace('#', '').trim() === 'compare') renderBench();
}
