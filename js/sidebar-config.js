// ── Contenu du menu latéral, à éditer sans toucher au code ──
// Chaque lien pointe vers ayming.fr : path est le chemin après www.ayming.fr/, campaign devient
// utm_campaign (utm_content vaut « sidebar », voir sidebar.js).

// Le menu « Ressources ». Une ligne par contenu, dans l'ordre d'affichage.
export var SIDEBAR_RESOURCES = [
  { kind: 'Baromètre', title: 'Baromètre national des risques professionnels', path: 'newsroom/guides-barometres/barometre-national-des-risques-professionnels/', campaign: 'ressource-barometre-risques-pro' },
  { kind: 'Article', title: 'Comment est calculé le taux de cotisation AT/MP ?', path: 'newsroom/actualites-avis-dexpert/comment-est-calcule-le-taux-de-cotisation-at-mp/', campaign: 'ressource-calcul-taux' },
  { kind: 'Article', title: 'Déclaration d\'accident du travail, 10 erreurs à éviter', path: 'newsroom/actualites-avis-dexpert/declaration-daccident-du-travail-les-erreurs-a-eviter/', campaign: 'ressource-dat-erreurs' },
  { kind: 'Webinaire en replay', title: 'Situations dangereuses et presqu\'accidents, du signalement à la prévention', path: 'newsroom/evenements/situations-dangereuses-et-presquaccidents-du-signalement-a-la-prevention/', campaign: 'ressource-webinaire-presquaccidents' },
  { kind: 'Guide', title: 'Pilotage des arrêts de travail de longue durée, 10 questions', path: 'newsroom/guides-barometres/arret-de-travail-long/', campaign: 'ressource-guide-arrets-longs' },
  { kind: 'Livre blanc', title: 'Maîtriser l\'art de la subrogation des IJSS', path: 'newsroom/guides-barometres/comment-bien-subroger-les-ijss-livre-blanc/', campaign: 'ressource-livre-blanc-subrogation' }
];

// La carte au-dessus du compte, un seul message. Une fois fermée, elle reste fermée sur
// l'appareil tant que id ne change pas : un nouveau message porte un nouvel id.
// Mettre SIDEBAR_PROMO à null pour ne rien afficher.
export var SIDEBAR_PROMO = {
  id: 'livre-blanc-subrogation',
  kicker: 'Livre blanc',
  title: 'Subrogation des IJSS',
  text: 'Les points de vigilance pour maintenir le salaire sans perdre les indemnités.',
  cta: 'Découvrir le livre blanc',
  path: 'newsroom/guides-barometres/comment-bien-subroger-les-ijss-livre-blanc/',
  campaign: 'ressource-livre-blanc-subrogation'
};
