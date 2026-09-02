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
