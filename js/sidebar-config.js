// ── Contenu du menu latéral, à éditer sans toucher au code ──
// Chaque lien pointe vers ayming.fr : path est le chemin après www.ayming.fr/, campaign devient
// utm_campaign (utm_content vaut « sidebar », voir sidebar.js).

// Le menu « Ressources » : les types de contenu d'Ayming, chacun ouvrant sa rubrique sur ayming.fr.
export var SIDEBAR_RESOURCE_TYPES = [
  { icon: 'newspaper', title: 'Articles et avis d\'expert', text: 'Les décryptages et les conseils de nos experts.', path: 'newsroom/actualites-avis-dexpert/', campaign: 'ressources-articles' },
  { icon: 'calendar', title: 'Événements et webinaires', text: 'Nos prochains rendez-vous et les webinaires en replay.', path: 'newsroom/evenements/', campaign: 'ressources-evenements' },
  { icon: 'book-open', title: 'Guides, livres blancs et baromètres', text: 'Nos publications, à lire ou à télécharger.', path: 'newsroom/guides-barometres/', campaign: 'ressources-guides' },
  { icon: 'mic', title: 'Podcasts', text: 'Nos épisodes, à écouter où vous voulez.', path: 'newsroom/podcasts/', campaign: 'ressources-podcasts' }
];

// Les contenus de « À découvrir », sur l'accueil (home.js). Une ligne par contenu, dans l'ordre d'affichage.
export var SIDEBAR_RESOURCES = [
  { kind: 'Livre blanc', title: 'Les enjeux clés de la déclaration d\'accident du travail', path: 'newsroom/guides-barometres/livre-blanc-declaration-accident-travail-enjeux/', campaign: 'ressource-livre-blanc-dat' },
  { kind: 'Article', title: 'Déclaration d\'accident du travail, 10 erreurs à éviter', path: 'newsroom/actualites-avis-dexpert/declaration-daccident-du-travail-les-erreurs-a-eviter/', campaign: 'ressource-dat-erreurs' },
  { kind: 'Webinaire en replay', title: 'Situations dangereuses et presqu\'accidents, du signalement à la prévention', path: 'newsroom/evenements/situations-dangereuses-et-presquaccidents-du-signalement-a-la-prevention/', campaign: 'ressource-webinaire-presquaccidents' },
  { kind: 'Guide', title: 'Pilotage des arrêts de travail de longue durée, 10 questions', path: 'newsroom/guides-barometres/arret-de-travail-long/', campaign: 'ressource-guide-arrets-longs' },
  { kind: 'Livre blanc', title: 'Maîtriser l\'art de la subrogation des IJSS', path: 'newsroom/guides-barometres/comment-bien-subroger-les-ijss-livre-blanc/', campaign: 'ressource-livre-blanc-subrogation' }
];

// Le contenu mis en avant en tête de « À découvrir », sur l'accueil (home.js).
// Mettre FEATURED_RESOURCE à null pour ne rien mettre en avant.
export var FEATURED_RESOURCE = {
  kicker: 'Livre blanc',
  title: 'Subrogation des IJSS',
  text: 'Les points de vigilance pour maintenir le salaire sans perdre les indemnités.',
  path: 'newsroom/guides-barometres/comment-bien-subroger-les-ijss-livre-blanc/',
  campaign: 'ressource-livre-blanc-subrogation'
};
