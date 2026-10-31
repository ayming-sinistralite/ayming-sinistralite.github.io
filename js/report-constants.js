// ── Constantes du rapport, sans le poids du rapport ──
// Le parcours, la visite et Virginie n'ont besoin que de ces libellés : ils les prennent ici, et
// js/report.js (120 Ko) ne se charge qu'à la construction d'un rapport (diagnostic.js).

// demande et message pré-remplissent « Votre demande » (RH) et « Votre message » du formulaire
// ayming.fr (champs 7 et 8 du formulaire 2, préremplissage par l'URL). Jamais de nom, d'email ni
// de société dans cette URL : elle finit dans les pages vues de GA4.
export var CONTACT_URL = 'https://www.ayming.fr/contactez-nous/?utm_source=sinistralite&utm_medium=referral&utm_campaign=diagnostic' +
  '&demande=RH&message=' + encodeURIComponent('Suite à mon diagnostic sinistralité AT/MP');

// Ce qui amène l'entreprise, première question du diagnostic. Sa réponse choisit le premier
// paragraphe du rapport, le reste de la page est commun. « Simplement faire le point » garde
// l'ouverture générale (lead null).
export var MOTIFS = [
  { key: 'hausse', label: 'Nos accidents ou nos arrêts ont augmenté',
    lead: 'Vos accidents ou vos arrêts ont augmenté. Ce rapport montre où vous vous situez face à votre secteur, ce qui pèse le plus, et ce qu\'il est encore temps de faire.' },
  { key: 'accident', label: 'Un accident récent ou grave',
    lead: 'Un accident grave pèse longtemps, par la durée de l\'arrêt, une éventuelle incapacité permanente et les réserves émises dans les 10 jours. Ce rapport situe votre sinistralité dans celle de votre secteur, et montre où agir en premier.' },
  { key: 'bilan', label: 'Préparer le bilan social ou la BDESE',
    lead: 'Vos indicateurs de fréquence et de gravité figurent dans votre bilan social ou votre BDESE. Ce rapport les situe face à votre secteur, à votre taille et à la France entière, avec les chiffres officiels à citer.' },
  { key: 'certif', label: 'Un appel d\'offres ou une certification (MASE, ISO 45001)',
    lead: 'Un appel d\'offres ou un audit MASE ou ISO 45001 vous demande vos indicateurs. Ce rapport les situe face à votre secteur, avec les chiffres officiels à citer.' },
  { key: 'point', label: 'Simplement faire le point', lead: null }
];

export var CAUSE_LABELS = {
  'Outillage a main': 'Outillage à main', 'Manutention mecanique': 'Manutention mécanique',
  'Autres vehicules': 'Autres véhicules', 'Risque machines': 'Risque machine'
};
