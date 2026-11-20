// ── Filtre d'année ──
// Les séries history-<vue>.json égalent les chiffres clés au NAF 5, champ par champ et pour
// chaque secteur (vérifié le 2026-10-01). Au NAF 2 et au NAF 4 elles sont recalculées depuis
// les NAF 5 et s'en écartent, le filtre n'apparaît donc qu'au NAF 5. Il change les chiffres clés
// et les graphiques que ces séries suffisent à construire (le positionnement et la comparaison de
// l'indice de fréquence, qui ne lisent que lui). Les répartitions des fiches n'existent que pour
// l'année de référence : leurs titres portent une pastille « Données <année> » (stampYears),
// et la note sous les années le dit quand une autre année est choisie.

import { state } from './state.js?v=24ffa11';
import { viewEl } from './utils.js?v=24ffa11';
import { historyFile } from './history.js?v=24ffa11';
import { getData } from './data.js?v=24ffa11';

function yearsOf(viewId) {
  var data = getData(viewId);
  return (data && data.meta && data.meta.years || []).map(String);
}

// Les chiffres clés d'une année, au format des stats de <vue>-data.json que lit renderKPIs.
function statsAt(h, i, eventKey) {
  var at = function(k) { var s = h && h[k]; return s && s[i] != null ? s[i] : null; };
  var s = { indice_frequence: at('if'), deces: at('dc'), journees_it: at('j'), nouvelles_ip: at('ip'), nb_salaries: at('sal') };
  s[eventKey] = at('n');
  return s;
}

function note(year, latest) {
  if (year === latest) return '';
  var txt = 'Chiffres clés et positionnement de ' + year + '. Les autres graphiques portent sur ' + latest + ', l\'année de leurs données.';
  if (year === '2020') txt += ' En 2020, le chômage partiel a faussé les effectifs, l\'indice de fréquence de cette année se compare mal aux autres.';
  return txt;
}


// Pastille d'année sur chaque titre de graphique marqué data-year-kind : « ref » les données de
// l'année de référence (la dernière du jeu), « follow » celles de l'année que les graphiques
// dessinent (state.views[viewId].chartYear, posée par app.js), « trend » la plage des séries.
// Une pastille « ref » prend la classe year-tag-fixed quand les années en choisissent une autre,
// pour qu'aucun graphique ne passe pour suivre les années sans le faire.
export function stampYears(viewId, level) {
  var root = viewEl(viewId, 'results');
  var years = yearsOf(viewId);
  if (!root || !years.length) return;
  var latest = years[years.length - 1];
  var vs = state.views[viewId];
  var picked = level === 'naf5' && state.year && years.indexOf(state.year) >= 0 ? state.year : latest;
  var drawn = vs.chartYear || latest;
  var tagOf = function(node, text, fixed) {
    var tag = node.querySelector('.year-tag');
    if (!tag) {
      tag = document.createElement('span');
      tag.className = 'year-tag';
      node.appendChild(tag);
    }
    tag.textContent = text;
    tag.classList.toggle('year-tag-fixed', !!fixed);
  };
  root.querySelectorAll('[data-year-kind]').forEach(function(node) {
    var kind = node.getAttribute('data-year-kind');
    if (kind === 'follow') tagOf(node, 'Données ' + drawn, false);
    else if (kind === 'ref') tagOf(node, 'Données ' + latest, picked !== latest);
    else if (kind === 'trend') {
      historyFile(viewId).then(function(file) {
        var ys = file.meta.years;
        tagOf(node, 'Données ' + ys[0] + '–' + ys[ys.length - 1], false);
      }).catch(function() {});
    }
  });
}

// draw(stats, national, classement, statsDesComparés) redessine les chiffres clés.
// redraw() remet ceux de l'année de référence puis rappelle ce filtre, après un clic.
// drawCharts(yif) dessine les graphiques qui suivent l'année : yif décrit l'année choisie
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
      if (!pill) return;
      state.year = pill.dataset.latest ? null : pill.dataset.year;
      bar._redraw();
    });
  }
  if (level !== 'naf5') { bar.hidden = true; plain(); return; }
  // Les années viennent du jeu de la vue, déjà chargé : les pastilles se dessinent sans attendre
  // le fichier d'historique, qui n'est lu qu'au choix d'une autre année que la dernière.
  var years = yearsOf(viewId);
  if (!years.length) { bar.hidden = true; plain(); return; }
  var latest = years[years.length - 1];
  var year = state.year && years.indexOf(state.year) >= 0 ? state.year : latest;
  bar.hidden = false;
  bar.innerHTML = '<div class="year-pills" role="group" aria-label="Année des chiffres clés et du positionnement">' +
    years.map(function(y) {
      var on = y === year;
      return '<button type="button" class="year-pill' + (on ? ' active' : '') + '" data-year="' + y + '"' +
        (y === latest ? ' data-latest="1"' : '') + ' aria-pressed="' + on + '">' + y + '</button>';
    }).join('') + '</div>' +
    (year !== latest ? '<p class="year-note">' + note(year, latest) + '</p>' : '');
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
