// ── Contenu du menu latéral, à éditer sans toucher au code ──
// Chaque lien pointe vers ayming.fr : path est le chemin après www.ayming.fr/, campaign devient
// utm_campaign (utm_content vaut « sidebar », voir sidebar.js).

// Le menu « Ressources » : les types de contenu d'Ayming, chacun ouvrant sa rubrique sur ayming.fr.
export var SIDEBAR_RESOURCE_TYPES = [
  { icon: 'newspaper', title: 'Articles et avis d\'expert', text: 'Les décryptages et les analyses de nos consultants.', path: 'newsroom/actualites-avis-dexpert/', campaign: 'ressources-articles' },
  { icon: 'calendar', title: 'Événements et webinaires', text: 'Nos prochains rendez-vous et les webinaires en replay.', path: 'newsroom/evenements/', campaign: 'ressources-evenements' },
  { icon: 'book-open', title: 'Guides, livres blancs et baromètres', text: 'Nos publications, à lire ou à télécharger.', path: 'newsroom/guides-barometres/', campaign: 'ressources-guides' },
  { icon: 'mic', title: 'Podcasts', text: 'Nos épisodes, à écouter où vous voulez.', path: 'newsroom/podcasts/', campaign: 'ressources-podcasts' }
];
