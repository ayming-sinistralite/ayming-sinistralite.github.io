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
    compare: { diagStep: 0, sector: null, sectorLevel: null, sectorLib: null, effectif: null, masseSalariale: null, accidents: null, joursArret: null, arrets45: null, mp: null, trajet: null, deces: null, tauxNotifie: null, knowsTaux: null, duerp: null, suivi45: null, tauxVerifie: null, ijRecup: null, contact: null, acIndex: -1 },
  }
};

// ── View config ──

// Données open data (TMS, MP psychiques, causes de trajet) que le pipeline ajoute aux fiches.
export var VIEW_CONFIG = {
  at: {
    title: 'Accidents du Travail par Secteur',
    subtitle: 'Statistiques de sinistralité par code NAF. 729 secteurs, 19,3M salariés.',
    eventKey: 'at_1er_reglement',
    eventLabel: 'AT en 1er règlement',
    secondaryKey: 'at_4j_arret',
    ifDenominator: 'at_1er_reglement',
    causesTitle: 'Causes d\'accidents',
    sinistreLabel: 'accidents du travail',
    // Panneaux de dimensions rendus sous la démographie. Leur contenu est défini dans
    // charts.js (PANELS) ; une vue déclare ici lesquels elle affiche.
    panels: ['atInjury'],
    // Clé du siège des lésions dans extra-dimensions.json, dessiné sur la silhouette (body.js).
    siegeKey: 'siege_lesions',
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: 'var(--c-danger)' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: 'var(--c-2)' },
        { label: 'AT avec arrêt 4j+',       value: s.at_4j_arret || 0,      color: 'var(--c-1)' },
        { label: 'AT en 1er règlement',     value: s.at_1er_reglement || 0,  color: 'var(--c-3)' },
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
    causesTitle: 'Types de maladies',
    // Les caractères d'une MP se cumulent (un cancer chimique compte deux fois), donc leurs
    // parts ne forment pas un tout et se lisent en barres, pas en anneau.
    causesExclusive: false,
    sinistreLabel: 'maladies professionnelles',
    panels: ['mpProfile'],
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: 'var(--c-danger)' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: 'var(--c-2)' },
        { label: 'MP en 1er règlement',     value: s.mp_1er_reglement || 0,  color: 'var(--c-3)' },
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
    causesTitle: null,
    sinistreLabel: 'accidents de trajet',
    panels: ['trajetCauses'],
    siegeKey: 'trajet_siege_lesions',
    funnelItems: function(s) {
      return [
        { label: 'Décès',                    value: s.deces || 0,             color: 'var(--c-danger)' },
        { label: 'Incapacités permanentes', value: s.nouvelles_ip || 0,      color: 'var(--c-2)' },
        { label: 'Acc. trajet en 1er règlement', value: s.trajet_count || 0, color: 'var(--c-3)' },
      ];
    },
  },
  diagnostic: {
    title: 'Votre diagnostic personnalisé',
    subtitle: '',
  },
  compare: {
    title: 'Mon entreprise',
    subtitle: 'Situez votre entreprise face à votre secteur, estimez votre cotisation AT/MP et votre économie potentielle.',
  },
};
