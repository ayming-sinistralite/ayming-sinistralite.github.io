// ── Filtre d'année des chiffres clés ──
// Les séries history-<vue>.json égalent les chiffres clés au NAF 5, champ par champ et pour
// chaque secteur (vérifié le 2026-10-01). Au NAF 2 et au NAF 4 elles sont recalculées depuis
// les NAF 5 et s'en écartent, le filtre n'apparaît donc qu'au NAF 5. Il change les seuls
// chiffres clés : les répartitions des fiches et les graphiques restent sur l'année de
// référence, et la note sous les années le dit.

import { state } from './state.js?v=58f7592';
import { viewEl } from './utils.js?v=58f7592';
import { historyFile } from './history.js?v=58f7592';

// Les chiffres clés d'une année, au format des stats de <vue>-data.json que lit renderKPIs.
function statsAt(h, i, eventKey) {
  var at = function(k) { var s = h && h[k]; return s && s[i] != null ? s[i] : null; };
  var s = { indice_frequence: at('if'), deces: at('dc'), journees_it: at('j'), nouvelles_ip: at('ip'), nb_salaries: at('sal') };
  s[eventKey] = at('n');
  return s;
}

function note(year, latest) {
  if (year === latest) return '';
  var txt = 'Chiffres clés de ' + year + '. Les graphiques de la page portent sur ' + latest + '.';
  if (year === '2020') txt += ' En 2020, le chômage partiel a faussé les effectifs, l\'indice de fréquence de cette année se compare mal aux autres.';
  return txt;
}

// draw(stats, national, classement, statsDesComparés) redessine les chiffres clés.
// redraw() remet ceux de l'année de référence puis rappelle ce filtre, après un clic.
export function renderYearFilter(viewId, cfg, level, code, compareCodes, draw, redraw) {
  var bar = viewEl(viewId, 'yearBar');
  if (!bar) return;
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
  if (level !== 'naf5') { bar.hidden = true; return; }
  historyFile(viewId).then(function(file) {
    var v = state.views[viewId];
    if (v.code !== code || v.level !== level) return;
    var h = file.by_naf5[code];
    if (!h) { bar.hidden = true; return; }
    var years = file.meta.years.map(String);
    var latest = years[years.length - 1];
    var year = state.year && years.indexOf(state.year) >= 0 ? state.year : latest;
    bar.hidden = false;
    bar.innerHTML = '<div class="year-pills" role="group" aria-label="Année des chiffres clés">' +
      years.map(function(y) {
        var on = y === year;
        return '<button type="button" class="year-pill' + (on ? ' active' : '') + '" data-year="' + y + '"' +
          (y === latest ? ' data-latest="1"' : '') + ' aria-pressed="' + on + '">' + y + '</button>';
      }).join('') + '</div>' +
      (year !== latest ? '<p class="year-note">' + note(year, latest) + '</p>' : '');
    if (year === latest) return;
    var i = years.indexOf(year);
    var ranking = Object.keys(file.by_naf5).map(function(c) {
      return { code: c, count: (file.by_naf5[c].n || [])[i] };
    }).filter(function(r) { return r.count != null; })
      .sort(function(a, b) { return b.count - a.count; });
    var cmp = {};
    compareCodes.forEach(function(c) { cmp[c] = statsAt(file.by_naf5[c], i, cfg.eventKey); });
    draw(statsAt(h, i, cfg.eventKey), statsAt(file.national, i, cfg.eventKey), ranking, cmp);
  }).catch(function() { bar.hidden = true; });
}
