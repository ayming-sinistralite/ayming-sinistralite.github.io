// ── State ──

import { getData } from './data.js?v=e9f97a8';

// L'année des données publiées, écrite ici une seule fois pour le JS. Elle doit valoir la dernière
// entrée de meta.years des jeux (tests/year.test.js le vérifie) ; le HTML statique (app.html, index.html)
// la porte en dur, l'étape « grep des années » du yearly-refresh le suit.
export var DATA_YEAR = '2024';

export var state = {
  activeView: 'at',
  // Secteurs comparés, partagés par AT, MP et Trajet au même titre que le secteur
  // sélectionné, que switchView() reporte déjà d'un onglet à l'autre.
  compareCodes: [],
  // Année des chiffres clés choisie dans le filtre (year.js), partagée par les trois vues ;
  // null = l'année de référence.
  year: null,
  views: {
    at: { code: null, level: 'naf2', causesChart: null, compChart: null, causesCharts: [], sizeCharts: [], injuryCharts: [], evoCharts: [], demoCharts: [], acIndex: -1 },
    mp: { code: null, level: 'naf2', causesChart: null, compChart: null, causesCharts: [], sizeCharts: [], injuryCharts: [], evoCharts: [], demoCharts: [], acIndex: -1 },
    trajet: { code: null, level: 'naf2', causesChart: null, compChart: null, causesCharts: [], sizeCharts: [], injuryCharts: [], evoCharts: [], demoCharts: [], acIndex: -1 },
    compare: { flowStep: 0, sector: null, sectorLevel: null, sectorLib: null, effectif: null, accidents: null, joursArret: null, arrets45: null, mp: null, trajet: null, deces: null, causes: [], motif: null, suivi45: null, ijRecup: null, reserves: null, contact: null, acIndex: -1, reportCharts: [] },
  }
};

// ── View config ──

// Données open data (TMS, MP psychiques, causes de trajet) que le pipeline ajoute aux fiches.
// Le périmètre affiché sous le titre se compte dans le jeu chargé, jamais à la main.
function coverage(type, withSalaries) {
  var d = getData(type);
  if (!d || !d.by_naf5) return '';
  var out = ' ' + Object.keys(d.by_naf5).length + ' secteurs';
  var sal = withSalaries && d.meta && d.meta.national && d.meta.national.nb_salaries;
  if (sal) out += ', ' + (sal / 1e6).toFixed(1).replace('.', ',') + ' millions de salariés';
  return out + '.';
}

export var VIEW_CONFIG = {
  at: {
    title: 'Accidents du travail par secteur',
    get subtitle() { return 'Statistiques de sinistralité par code NAF.' + coverage('at', true); },
    eventKey: 'at_1er_reglement',
    eventLabel: 'Accidents avec arrêt (1er règlement)',
    causesTitle: 'Causes d\'accidents',
    // Au-delà de ce nombre, les causes les plus rares se regroupent en « Autres ». null : toutes.
    maxCauses: 6,
    eventNoun: 'accidents',
    assistantMetric: 'indice_frequence',
    mapIfLabel: 'Indice de fréquence, sinistres pour 1 000 salariés',
    sinistreLabel: 'accidents du travail',
    // Panneaux de dimensions rendus sous la démographie. Leur contenu est défini dans
    // charts.js (PANELS) ; une vue déclare ici lesquels elle affiche.
    panels: ['atInjury'],
    // Panneaux dont les données arrivent après le rendu, dessinés par history.js.
    lazyPanels: ['atSeverity', 'atCirc'],
    // Clé du siège des lésions dans extra-dimensions.json, dessiné sur la silhouette (body.js).
    siegeKey: 'siege_lesions',
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: 'var(--c-danger)', rateLabel: 'un décès' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: 'var(--c-2)', rateLabel: 'une incapacité permanente' },
        { label: 'AT avec arrêt 4j+',       value: s.at_4j_arret || 0,      color: 'var(--c-1)', rateLabel: 'un arrêt de 4 jours et plus' },
        { label: 'Accidents avec arrêt (1er règlement)',     value: s.at_1er_reglement || 0,  color: 'var(--c-3)' },
      ];
    },
  },
  mp: {
    title: 'Maladies professionnelles par secteur',
    get subtitle() { return 'Statistiques de maladies professionnelles par code NAF.' + coverage('mp'); },
    eventKey: 'mp_1er_reglement',
    eventLabel: 'Maladies reconnues (1er règlement)',
    causesTitle: 'Types de maladies',
    // Les caractères d'une MP se cumulent (un cancer chimique compte deux fois), donc leurs
    // parts ne forment pas un tout et se lisent en barres, pas en anneau.
    causesExclusive: false,
    maxCauses: null,
    eventNoun: 'maladies',
    assistantMetric: 'events',
    mapIfLabel: 'Maladies professionnelles pour 1 000 salariés',
    sinistreLabel: 'maladies professionnelles',
    panels: ['mpProfile', 'mpPsy'],
    lazyPanels: ['mpSeverity'],
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: 'var(--c-danger)', rateLabel: 'un décès' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: 'var(--c-2)', rateLabel: 'une incapacité permanente' },
        { label: 'Maladies reconnues (1er règlement)',     value: s.mp_1er_reglement || 0,  color: 'var(--c-3)' },
      ];
    },
  },
  trajet: {
    title: 'Accidents de trajet par secteur',
    get subtitle() { return 'Statistiques d\'accidents de trajet par code NAF.' + coverage('trajet'); },
    eventKey: 'trajet_count',
    eventLabel: 'Accidents de trajet',
    causesTitle: null,
    maxCauses: null,
    eventNoun: 'accidents',
    assistantMetric: 'events',
    mapIfLabel: 'Indice de fréquence, sinistres pour 1 000 salariés',
    sinistreLabel: 'accidents de trajet',
    panels: ['trajetCauses'],
    lazyPanels: ['trajetSeverity', 'trajetCirc'],
    siegeKey: 'trajet_siege_lesions',
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: 'var(--c-danger)', rateLabel: 'un décès' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: 'var(--c-2)', rateLabel: 'une incapacité permanente' },
        { label: 'Acc. trajet en 1er règlement', value: s.trajet_count || 0, color: 'var(--c-3)' },
      ];
    },
  },
  home: {
    title: 'Accueil',
    subtitle: '',
  },
  diagnostic: {
    title: 'Votre diagnostic personnalisé',
    subtitle: '',
  },
  compare: {
    title: 'Mon entreprise',
    subtitle: 'Situez votre entreprise face à votre secteur, en huit questions, et recevez votre rapport personnalisé.',
  },
};
