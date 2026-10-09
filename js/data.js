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
