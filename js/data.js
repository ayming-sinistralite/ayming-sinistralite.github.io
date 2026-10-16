// ── Data loading & cache ──

var DATASETS = {};

export async function loadDataset(type) {
  if (DATASETS[type]) return DATASETS[type];
  var resp = await fetch('./data/' + type + '-data.json');
  if (!resp.ok) throw new Error('Échec du chargement des données ' + type + ' (' + resp.status + ')');
  var json = await resp.json();
  DATASETS[type] = json;
  return json;
}

// L'historique par année d'un jeu (yearly-<jeu>.json, la moitié de son poids) ne sert qu'à
// Virginie : il arrive après l'affichage et se greffe sur les entrées, comme le pipeline le relit.
var YEARLY = {};
var YEARLY_LEVELS = ['by_naf5', 'by_naf4', 'by_naf2', 'by_naf1'];

export function loadYearly(type) {
  if (!YEARLY[type]) {
    YEARLY[type] = loadDataset(type).then(function(data) {
      return fetch('./data/yearly-' + type + '.json').then(function(resp) {
        if (!resp.ok) throw new Error('Échec du chargement de l\'historique ' + type + ' (' + resp.status + ')');
        return resp.json();
      }).then(function(yearly) {
        if (yearly.national) data.meta.national.yearly = yearly.national;
        YEARLY_LEVELS.forEach(function(level) {
          var store = data[level] || {}, series = yearly[level] || {};
          Object.keys(series).forEach(function(code) { if (store[code]) store[code].yearly = series[code]; });
        });
        return data;
      });
    });
    // Un échec ne reste pas en cache : le rendu suivant retentera.
    YEARLY[type].catch(function() { delete YEARLY[type]; });
  }
  return YEARLY[type];
}

export function getStore(viewId, level) {
  return DATASETS[viewId]['by_' + level];
}

export function getData(viewId) {
  return DATASETS[viewId];
}

// Pour un jeu chargé hors de loadDataset (extra-dimensions.json n'en suit pas le nommage).
export function setData(type, json) {
  DATASETS[type] = json;
}

// Libellé d'un code, pris dans le jeu de la vue s'il est chargé, sinon dans un autre :
// les adresses des secteurs le reprennent (js/route.js). Vide si aucun jeu ne le connaît.
var LEVELS = ['naf5', 'naf4', 'naf2', 'naf1'];
export function libelleOf(viewId, code) {
  var types = [viewId, 'at', 'mp', 'trajet'];
  for (var i = 0; i < types.length; i++) {
    var d = DATASETS[types[i]];
    if (!d) continue;
    for (var j = 0; j < LEVELS.length; j++) {
      var entry = (d['by_' + LEVELS[j]] || {})[code];
      if (entry) return entry.libelle || '';
    }
  }
  return '';
}
