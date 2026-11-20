// ── Data loading & cache ──

var DATASETS = {};

export async function loadDataset(type) {
  if (DATASETS[type]) return DATASETS[type];
  var names = loadShortNamesOnce();
  var resp = await fetch('./data/' + type + '-data.json');
  if (!resp.ok) throw new Error('Échec du chargement des données ' + type + ' (' + resp.status + ')');
  var json = await resp.json();
  await names;
  DATASETS[type] = json;
  return json;
}

// L'historique par année d'un jeu (yearly-<jeu>.json, la moitié de son poids) ne sert qu'à
// Virginie : il ne part qu'à l'ouverture de son panneau (assistant.js) et se greffe sur les entrées.
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

// Dimensions textuelles par NAF5 (extra-dimensions.json, 1,9 Mo) : le siège des lésions, les panneaux
// du bas de page et le rapport. Elles ne partent qu'à la demande, jamais avec la page. La promesse
// ne rejette pas : un échec rend null (les panneaux disent « indisponible ») et le prochain appel retente.
var EXTRA = null;
export function loadExtra() {
  if (getData('extra')) return Promise.resolve(getData('extra'));
  if (!EXTRA) {
    EXTRA = fetch('./data/extra-dimensions.json').then(function(resp) {
      if (!resp.ok) throw new Error('extra-dimensions (' + resp.status + ')');
      return resp.json();
    }).then(function(json) {
      setData('extra', json);   // lu aussi par le rapport (compare.js, report.js)
      return json;
    }).catch(function() { EXTRA = null; return null; });
  }
  return EXTRA;
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

// Noms de métier courts des titres de page (data/short-names.json, tenu à la main par
// data/pipeline/short_names.py). Un échec de chargement laisse les titres sur le libellé officiel.
var SHORT_NAMES = {};

export function setShortNames(map) {
  SHORT_NAMES = map || {};
}

export function loadShortNames() {
  return fetch('./data/short-names.json').then(function(resp) {
    if (!resp.ok) throw new Error('short-names ' + resp.status);
    return resp.json();
  }).then(setShortNames).catch(function() {});
}

// Un seul chargement, lancé avec le premier jeu : les titres le trouvent prêt au premier rendu.
var NAMES_LOADED = null;
function loadShortNamesOnce() {
  if (!NAMES_LOADED) NAMES_LOADED = loadShortNames();
  return NAMES_LOADED;
}

export function shortNameOf(code) {
  return SHORT_NAMES[code] || '';
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
