// ── State ──

export var state = {
  activeView: 'at',
  // Secteurs comparés, partagés par AT, MP et Trajet au même titre que le secteur
  // sélectionné, que switchView() reporte déjà d'un onglet à l'autre.
  compareCodes: [],
  views: {
    at: { code: null, level: 'naf2', causesChart: null, compChart: null, causesCharts: [], sizeCharts: [], injuryCharts: [], evoCharts: [], demoCharts: [], acIndex: -1 },
    mp: { code: null, level: 'naf2', causesChart: null, compChart: null, causesCharts: [], sizeCharts: [], injuryCharts: [], evoCharts: [], demoCharts: [], acIndex: -1 },
    trajet: { code: null, level: 'naf2', causesChart: null, compChart: null, causesCharts: [], sizeCharts: [], injuryCharts: [], evoCharts: [], demoCharts: [], acIndex: -1 },
    compare: { sector: null, sectorLevel: null, sectorLib: null, effectif: null, masseSalariale: null, accidents: null, mp: null, trajet: null, deces: null, showMp: false, showTrajet: false, showDeces: false, acIndex: -1 },
  }
};

// ── View config ──

export var VIEW_CONFIG = {
  at: {
    title: 'Accidents du Travail par Secteur',
    subtitle: 'Statistiques de sinistralité par code NAF. 729 secteurs, 19,3M salariés.',
    eventKey: 'at_1er_reglement',
    eventLabel: 'AT en 1er règlement',
    secondaryKey: 'at_4j_arret',
    ifDenominator: 'at_4j_arret',
    sourceLabel: 'Ameli, Risque AT par CTN x NAF 2024',
    sourceUrl: 'https://assurance-maladie.ameli.fr/etudes-et-donnees/risque-at-ctn-x-naf-serie-annuelle',
    causesTitle: 'Causes d\'accidents',
    sinistreLabel: 'accidents du travail',
    // Panneaux de dimensions rendus sous la démographie. Leur contenu est défini dans
    // charts.js (PANELS) ; une vue déclare ici lesquels elle affiche.
    panels: ['atInjury'],
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: '#c74a43' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: '#f09a2e' },
        { label: 'AT avec arrêt 4j+',       value: s.at_4j_arret || 0,      color: '#4e8ac5' },
        { label: 'AT en 1er règlement',     value: s.at_1er_reglement || 0,  color: '#6a5ec8' },
      ];
    },
  },
  mp: {
    title: 'Maladies Professionnelles par Secteur',
    subtitle: 'Statistiques de maladies professionnelles par code NAF. 729 secteurs.',
    eventKey: 'mp_1er_reglement',
    eventLabel: 'MP en 1er règlement',
    secondaryKey: 'mp_1er_reglement',
    ifDenominator: 'mp_1er_reglement',
    sourceLabel: 'Ameli, Risque MP par CTN x NAF 2024',
    sourceUrl: 'https://assurance-maladie.ameli.fr/etudes-et-donnees/risque-mp-ctn-x-naf-serie-annuelle',
    causesTitle: 'Types de maladies',
    // Les caractères d'une MP se cumulent (un cancer chimique compte deux fois), donc leurs
    // parts ne forment pas un tout et se lisent en barres, pas en anneau.
    causesExclusive: false,
    sinistreLabel: 'maladies professionnelles',
    panels: ['mpProfile'],
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: '#c74a43' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: '#f09a2e' },
        { label: 'MP en 1er règlement',     value: s.mp_1er_reglement || 0,  color: '#6a5ec8' },
      ];
    },
  },
  trajet: {
    title: 'Accidents de Trajet par Secteur',
    subtitle: 'Statistiques d\'accidents de trajet par code NAF. 629 secteurs.',
    eventKey: 'trajet_count',
    eventLabel: 'Accidents de trajet',
    secondaryKey: 'trajet_count',
    ifDenominator: 'trajet_count',
    sourceLabel: 'Ameli, Fiches NAF 2024 (PDF)',
    sourceUrl: 'https://assurance-maladie.ameli.fr/etudes-et-donnees/sinistralite-at-mp-par-code-naf',
    causesTitle: null,
    sinistreLabel: 'accidents de trajet',
    panels: ['trajetInjury'],
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: '#e5534b' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: '#f09a2e' },
        { label: 'Acc. trajet en 1er règlement', value: s.trajet_count || 0, color: '#7c6ef0' },
      ];
    },
  },
  compare: {
    title: 'Mon entreprise',
    subtitle: 'Situez votre entreprise face à votre secteur, estimez votre cotisation AT/MP et votre économie potentielle.',
    sourceLabel: 'Ameli 2024 · barème coûts moyens AT/MP 2024',
    sourceUrl: 'https://assurance-maladie.ameli.fr/etudes-et-donnees/risque-at-ctn-x-naf-serie-annuelle',
  },
};
