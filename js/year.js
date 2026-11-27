// ── Filtre d'année ──
// Le filtre n'apparaît qu'au NAF 5, où les séries history-<vue>.json égalent les chiffres clés
// champ par champ (vérifié le 2026-10-01) ; au NAF 2 et au NAF 4 elles sont recalculées depuis
// les NAF 5 et s'en écartent. Il propose les années dont les fichiers par année existent
// (VIEW_YEARS, state.js) et change toute la page : les chiffres clés, le positionnement et la
// comparaison viennent des séries, les répartitions des fichiers <jeu>-data-<année>.json,
// fiche-<vue>-<année>.json, extra-dimensions-<année>.json et size-data-<année>.json (app.js).
// yearEntry plaque les valeurs de l'année sur l'entrée de référence d'un secteur : les graphiques
// lisent alors cette entrée comme celle de 2024 et n'ont rien à savoir de l'année.

import { state, VIEW_CONFIG, VIEW_YEARS, DATA_YEAR, yearFor } from './state.js?v=36466a3';
import { viewEl } from './utils.js?v=36466a3';
import { historyFile } from './history.js?v=36466a3';
import { loadYearFile } from './data.js?v=36466a3';

// Les chiffres clés d'une année, au format des stats de <vue>-data.json que lit renderKPIs.
export function statsAt(h, i, eventKey) {
  var at = function(k) { var s = h && h[k]; return s && s[i] != null ? s[i] : null; };
  var s = { indice_frequence: at('if'), deces: at('dc'), journees_it: at('j'), nouvelles_ip: at('ip'), nb_salaries: at('sal') };
  s[eventKey] = at('n');
  return s;
}

// L'année choisie, prête à dessiner : { year, index, data (le <jeu>-data-<année>.json), hist (les séries) }.
var VIEWS = {};
var READY = {};
export function loadYearView(viewId, year) {
  var key = viewId + '-' + year;
  if (!VIEWS[key]) {
    VIEWS[key] = Promise.all([loadYearFile(viewId + '-data', year), historyFile(viewId)]).then(function(r) {
      var index = r[1].meta.years.map(String).indexOf(year);
      if (index < 0) throw new Error('Année absente de la série : ' + year);
      READY[key] = { year: year, index: index, data: r[0], hist: r[1] };
      return READY[key];
    });
    VIEWS[key].catch(function() { delete VIEWS[key]; });
  }
  return VIEWS[key];
}

export function readyYearView(viewId, year) {
  return READY[viewId + '-' + year] || null;
}

// Les noms des causes d'accident de history-at.json, que le pipeline écrit au singulier pour une.
var CAUSE_NAMES = { 'Risque machine': 'Risque machines' };

// L'entrée d'un secteur pour l'année de yv : l'entrée de référence dont ce que l'année change est
// remplacé. Les causes de l'AT viennent des séries ; les types de maladies de la MP n'existent
// pour aucune autre année (risk_causes null, le graphique le dit). Les champs que la 2024 porte
// et que l'année ne remplace pas (libellé, série des MP psychiques) restent ceux de l'entrée.
export function yearEntry(viewId, entry, code, yv) {
  var ys = (yv.data.by_naf5 || {})[code] || {};
  var h = (yv.hist.by_naf5 || {})[code];
  var out = Object.assign({}, entry);
  out.stats = Object.assign(statsAt(h, yv.index, VIEW_CONFIG[viewId].eventKey), ys.stats || {});
  out.demographics = ys.demographics;
  out.tms = ys.tms;
  out.mp_hors_tableau = ys.mp_hors_tableau;
  out.trajet_causes = ys.trajet_causes;
  out.risk_causes = viewId === 'at' ? {} : null;
  if (viewId === 'at' && h && h.causes) {
    Object.keys(h.causes).forEach(function(k) {
      var v = h.causes[k][yv.index];
      out.risk_causes[CAUSE_NAMES[k] || k] = v == null ? 0 : Math.round(v * 1000) / 10;
    });
  }
  return out;
}

function note(viewId, year) {
  var txt = '';
  if (state.year && state.year !== year) {
    txt = 'Pas de données ' + (viewId === 'trajet' ? 'de trajet ' : '') + 'pour ' + state.year + ', ' + year + ' est affichée.';
  }
  if (year === '2020') txt += (txt ? ' ' : '') + 'En 2020, le chômage partiel a faussé les effectifs, l\'indice de fréquence de cette année se compare mal aux autres.';
  return txt;
}


// Pastille d'année sur chaque titre marqué data-year-kind : « follow » un bloc que l'année choisie
// change (la pastille ne paraît que si l'année dessinée en diffère), « trend » la plage des séries.
// L'année choisie paraît une fois, dans l'en-tête de la page : une pastille ne se pose que là où
// la donnée d'un bloc en diffère.
function stampYears(viewId, level) {
  var root = viewEl(viewId, 'results');
  if (!root) return;
  var picked = yearFor(viewId, level);
  var drawn = state.views[viewId].chartYear || DATA_YEAR;
  var tagOf = function(node, text) {
    var tag = node.querySelector('.year-tag');
    if (text === null) { if (tag) tag.remove(); return; }
    if (!tag) {
      tag = document.createElement('span');
      tag.className = 'year-tag';
      node.appendChild(tag);
    }
    tag.textContent = text;
  };
  root.querySelectorAll('[data-year-kind]').forEach(function(node) {
    var kind = node.getAttribute('data-year-kind');
    if (kind === 'follow') tagOf(node, drawn !== picked ? 'Données ' + drawn : null);
    else if (kind === 'trend') {
      historyFile(viewId).then(function(file) {
        var ys = file.meta.years;
        tagOf(node, 'Données ' + ys[0] + '–' + ys[ys.length - 1]);
      }).catch(function() {});
    }
  });
}

// draw(stats, national, classement, statsDesComparés) redessine les chiffres clés.
// redraw() redessine toute la vue pour l'année que state.year vient de changer.
// drawCharts(yif) dessine les graphiques de position : yif décrit l'année choisie
// (year, ifOf(code), salOf(code), natIF), null pour l'année de référence. Elle est appelée à
// chaque passage, y compris quand le filtre est masqué, puis les pastilles d'année se posent.
export function renderYearFilter(viewId, cfg, level, code, compareCodes, draw, redraw, drawCharts) {
  var bar = viewEl(viewId, 'yearBar');
  var plain = function() { drawCharts(null); stampYears(viewId, level); };
  if (!bar) { plain(); return; }
  bar._redraw = redraw;
  if (!bar.dataset.bound) {
    bar.dataset.bound = '1';
    bar.addEventListener('click', function(e) {
      var pill = e.target.closest('.year-pill');
      if (!pill || pill.classList.contains('active')) return;
      state.year = pill.dataset.latest ? null : pill.dataset.year;
      bar._redraw();
    });
  }
  var years = VIEW_YEARS[viewId] || [];
  if (level !== 'naf5' || !years.length) { bar.hidden = true; plain(); return; }
  var latest = DATA_YEAR;
  var year = yearFor(viewId, level);
  var vs = state.views[viewId];
  var failed = vs.yearFailed;
  vs.yearFailed = null;
  bar.hidden = false;
  var notes = [failed ? 'Les données de ' + failed + ' n\'ont pas pu se charger, l\'année ' + year + ' reste affichée.' : '', note(viewId, year)]
    .filter(Boolean).join(' ');
  bar.innerHTML = '<div class="year-pills" role="group" aria-label="Année des données">' +
    years.map(function(y) {
      var on = y === year;
      return '<button type="button" class="year-pill' + (on ? ' active' : '') + '" data-year="' + y + '"' +
        (y === latest ? ' data-latest="1"' : '') + ' aria-pressed="' + on + '">' + y + '</button>';
    }).join('') + '</div>' +
    (notes ? '<p class="year-note" role="status">' + notes + '</p>' : '');
  plain();
  if (year === latest) return;
  historyFile(viewId).then(function(file) {
    var v = state.views[viewId];
    if (v.code !== code || v.level !== level) return;
    var h = file.by_naf5[code];
    if (!h) { bar.hidden = true; return; }
    var i = file.meta.years.map(String).indexOf(year);
    if (i < 0) { bar.hidden = true; return; }
    var ranking = Object.keys(file.by_naf5).map(function(c) {
      return { code: c, count: (file.by_naf5[c].n || [])[i] };
    }).filter(function(r) { return r.count != null; })
      .sort(function(a, b) { return b.count - a.count; });
    var cmp = {};
    compareCodes.forEach(function(c) { cmp[c] = statsAt(file.by_naf5[c], i, cfg.eventKey); });
    draw(statsAt(h, i, cfg.eventKey), statsAt(file.national, i, cfg.eventKey), ranking, cmp);
    var at = function(rec, k) { var a = rec && rec[k]; return a && a[i] != null ? a[i] : null; };
    drawCharts({
      year: year,
      ifOf: function(c) { return at(file.by_naf5[c], 'if'); },
      salOf: function(c) { return at(file.by_naf5[c], 'sal'); },
      natIF: at(file.national, 'if')
    });
    stampYears(viewId, level);
  }).catch(function() { bar.hidden = true; });
}
