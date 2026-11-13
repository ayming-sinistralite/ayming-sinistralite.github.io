// ── Le rapport : les offres, les ressources et leurs liens ──
// Formatage partagé avec le parcours, adresses UTM, offres Ayming, cartes de ressources et code QR.

import { utmQuery, AYMING } from './utils.js?v=e9f97a8';

// ── Formatage, partagé avec le parcours ──
export function pct(x) { return Math.round(x * 100) + ' %'; }

export function gap(ratio) {
  if (ratio == null) return '';
  var p = Math.round(Math.abs(ratio - 1) * 100);
  return ratio > 1.05 ? p + ' % au-dessus de' : ratio < 0.95 ? p + ' % en dessous de' : 'au niveau de';
}

// ── Liens sortants : tout lien vers ayming.fr porte ses UTM ──
// utm_content distingue le rapport de l'écran, utm_campaign l'offre ou la ressource.
export function utm(campaign) { return utmQuery(campaign, 'rapport'); }

function offerUrl(path, campaign) { return AYMING + 'ressources-humaines/' + path + utm(campaign); }

export function ext(url, text) { return '<a href="' + url + '" target="_blank" rel="noopener">' + text + '</a>'; }

// ── Les accompagnements Ayming : le comment de chaque thème ──
// Repris des fichiers de positionnement de chaque offre et des
// pages des outils, relus au guide de vocabulaire juridique. Le rapport parle au nom d'Ayming :
// l'outil de remontée terrain et de pré-déclaration n'est jamais nommé, il renvoie à sa page
// (url). La déclaration et les réserves relèvent des consultants, jamais de l'outil. Ayming fait
// le travail (externalisation), mais le lecteur reste celui qui pilote et décide : chaque phrase
// dit comment Ayming aide, en une phrase simple par offre, « nous » étant le guide : Ayming
// aide et guide, il ne « prend pas en charge » à la place de l'équipe.
export var ACCILINE = 'https://www.acciline.com/';

export var OFFERS = {
  terrain: { name: 'Remontée des événements terrain', url: ACCILINE + 'module-evenements/', campaign: 'remontee-terrain',
    line: function() { return 'Nous vous fournissons un outil pour que vos équipes signalent presqu\'accidents et situations dangereuses depuis leur téléphone.'; } },
  duerp: { name: 'Document unique (DUERP)', path: 'prevention-et-sante-au-travail/evaluer-les-risques-professionnels-duerp/', campaign: 'duerp',
    line: function(d) { return 'Nous vous fournissons un outil qui tient votre document unique' + (d.effectif >= 50 ? ' et votre PAPRIPACT' : '') + ' à jour, relié à vos accidents.'; },
    proof: 'Le contenu du DUERP et les décisions de prévention restent de la responsabilité de l\'employeur.' },
  dat: { name: 'Déclaration des accidents du travail', path: 'atmp/declarer-un-accident-du-travail/', campaign: 'declarer-un-accident-du-travail',
    line: function() { return 'Nous pouvons reprendre la déclaration de chaque accident dans les 48 heures et suivre chaque dossier jusqu\'à la décision de la caisse.'; },
    proof: 'Plus de 35 000 accidents du travail suivis chaque année pour nos clients.' },
  mp: { name: 'Questionnaires de maladie professionnelle', path: 'atmp/questionnaires-de-maladie-professionnelle/', campaign: 'questionnaires-de-maladie-professionnelle',
    line: function() { return 'Nous pouvons préparer avec vous la réponse à chaque questionnaire, dans les 30 jours.'; },
    proof: 'Plus de 200 questionnaires traités chaque année.' },
  collecte: { name: 'Collecter et traiter les arrêts de travail', path: 'arrets-de-travail/collecter-les-arrets-de-travail/', campaign: 'collecte-arrets',
    line: function() { return 'Nous pouvons réunir tous vos arrêts au même endroit et les vérifier avant la paie.'; },
    proof: 'Plus de 250 000 documents collectés chaque année.' },
  arrets: { name: 'Arrêts de longue durée', path: 'arrets-de-travail/arrets-longue-duree/', campaign: 'pilotage-arrets-longue-duree',
    line: function() { return 'Nous pouvons suivre chaque mois vos arrêts de plus de 45 jours.'; },
    proof: null },
  ij: { name: 'Récupérer les IJ', path: 'arrets-de-travail/recuperer-les-ij/', campaign: 'recuperer-ij',
    line: function() { return 'Nous pouvons vous aider à rapprocher les IJ attendues et reçues sur les arrêts de l\'année.'; },
    proof: 'Plus de 30 M€ d\'IJ déclarées chaque année pour nos clients.' },
  ijss: { name: 'Remboursements IJSS et prévoyance', path: 'arrets-de-travail/remboursements-ijss-et-prevoyance/', campaign: 'remboursements-ijss',
    line: function() { return 'Nous pouvons vérifier chaque mois ce que la caisse et la prévoyance vous versent.'; },
    proof: null },
  tiers: { name: 'Accidents causés par un tiers', path: 'atmp/accidents-causes-par-un-tiers/', campaign: 'accidents-tiers' },
  // Sous 20 salariés, le taux est collectif : les sinistres de l'entreprise ne le font pas, l'offre
  // ne paraît qu'à partir de 20. Jamais de calcul du taux ni de montant, le rapport n'en donne plus.
  taux: { name: 'Cotisations AT/MP', path: 'couts-rh/cotisations-at-mp/', campaign: 'cotisations-at-mp',
    line: function() { return 'Nous pouvons vous accompagner dans la maîtrise de vos cotisations AT/MP, en suivant chaque sinistre imputé à votre compte.'; },
    proof: null }
};

// Les causes où un tiers est le plus souvent en jeu : leur piste de prévention renvoie à l'offre
// « Accidents causés par un tiers », qui ne paraît donc que là où ces causes pèsent dans le secteur.
export var TIERS_CAUSES = ['Agressions', 'Risque routier'];

// Les autres offres RH d'Ayming, sur la page des offres seulement : le rapport ne les pousse nulle
// part ailleurs, aucune donnée du secteur ne les appelle. « Accidents causés par un tiers » n'est
// pas une carte de cette page : il suit les pistes de prévention des causes où un tiers est en jeu
// (TIERS_CAUSES).
var HR_OFFERS = {
  charges: { name: 'Charges sociales', path: 'couts-rh/charges-sociales/', campaign: 'charges-sociales',
    line: function() { return 'Nous pouvons vérifier vos charges sociales et repérer les sommes versées en trop.'; } },
  urssaf: { name: 'Contrôle Urssaf', path: 'couts-rh/controle-urssaf/', campaign: 'controle-urssaf',
    line: function() { return 'Nous pouvons préparer avec vous un contrôle Urssaf et vous accompagner pendant son déroulement.'; } },
  apprentissage: { name: 'Aides à l\'apprentissage', path: 'couts-rh/aides-a-lapprentissage/', campaign: 'aides-apprentissage',
    line: function() { return 'Nous pouvons repérer les aides à l\'apprentissage auxquelles vous avez droit et suivre leur versement.'; } },
  visites: { name: 'Visites médicales', path: 'prevention-et-sante-au-travail/externaliser-visites-medicales/', campaign: 'visites-medicales',
    line: function() { return 'Nous pouvons organiser et suivre les visites médicales de vos salariés.'; } },
  rattrapage: { name: 'Rattrapage des visites médicales', path: 'prevention-et-sante-au-travail/rattraper-les-visites-medicales-en-retard/', campaign: 'rattrapage-visites-medicales',
    line: function() { return 'Nous pouvons rattraper les visites médicales en retard.'; } }
};
HR_OFFERS.veille = { name: 'Veille Net-Entreprises', path: 'atmp/questionnaires-de-maladie-professionnelle/', campaign: 'veille-net-entreprises',
  line: function() { return 'Nous pouvons voir arriver chaque questionnaire sur Net-Entreprises et vous alerter dans les délais.'; } };
Object.keys(HR_OFFERS).forEach(function(k) { OFFERS[k] = HR_OFFERS[k]; });

// La page des offres reprend les cartes du hub des offres RH (ayming-france.github.io) : sa photo,
// sa famille, son titre et sa phrase, sans les boutons. La remontée des événements terrain, absente
// du hub, ouvre la famille des risques. Les photos sont dans assets/report/offres/.
export var HUB_CARDS = [
  ['terrain', 'Santé au travail', 'Faire remonter les événements terrain', 'Signaler presqu\'accidents et situations dangereuses depuis le téléphone, pour agir avant l\'accident.'],
  ['duerp', 'Santé au travail', 'Évaluer les risques professionnels', 'Faciliter la mise à jour du DUERP, piloter la priorisation des actions et suivre leur exécution.'],
  ['visites', 'Santé au travail', 'Gérer les visites médicales', 'Planifier, relancer et tracer les visites médicales pour se décharger d\'une tâche chronophage.'],
  ['rattrapage', 'Santé au travail', 'Rattraper les visites médicales en retard', 'Résorber le retard accumulé et régulariser votre situation rapidement.'],
  ['dat', 'AT/MP', 'Déclarer un accident du travail', 'Constituer le dossier complet et déclarer dans les délais.'],
  ['veille', 'AT/MP', 'Veille Net-Entreprises', 'Voir arriver chaque questionnaire AT/MP sur Net-Entreprises et répondre dans les délais.'],
  ['mp', 'AT/MP', 'Traiter un questionnaire de maladie professionnelle', 'Documenter la réponse et la suivre jusqu\'à la décision de la caisse.'],
  ['collecte', 'Arrêts de travail', 'Collecter et traiter les arrêts de travail', 'Centraliser les justificatifs, contrôler la complétude, simplifier la saisie.'],
  ['ijss', 'Arrêts de travail', 'Suivre les remboursements IJSS et prévoyance', 'Sécuriser les déclarations DSN, CPAM et assureurs, et piloter les remboursements.'],
  ['ij', 'Arrêts de travail', 'Vérifier les indemnités journalières reçues', 'Rapprocher les IJ attendues et reçues sur les arrêts de l\'année.'],
  ['arrets', 'Arrêts de travail', 'Piloter les arrêts longue durée', 'Détecter les arrêts AT de plus de 45 jours et suivre leur évolution.'],
  ['charges', 'Coûts RH', 'Optimiser les charges sociales', 'Étudier les bases et les exonérations, pour réduire les charges patronales.'],
  ['urssaf', 'Coûts RH', 'Accompagner un contrôle Urssaf', 'Préparer en amont, et un appui technique et financier pendant le contrôle.'],
  ['apprentissage', 'Coûts RH', 'Obtenir les aides à l\'apprentissage', 'Bénéficier de toutes les aides, avec un reporting consolidé.']
];

export function offerHref(o) { return o.url ? o.url + utm(o.campaign) : offerUrl(o.path, o.campaign); }

export function offerLink(key) { var o = OFFERS[key]; return ext(offerHref(o), o.name); }

// ── Les ressources Ayming : de quoi aller plus loin sur chaque thème ──
export var RESOURCES = {
  refus: [{ kind: 'Article', title: 'Déclaration d\'accident du travail, 10 erreurs à éviter', path: 'newsroom/actualites-avis-dexpert/declaration-daccident-du-travail-les-erreurs-a-eviter/', campaign: 'ressource-dat-erreurs' },
    { kind: 'Podcast', title: 'Accident du travail, comment réagir face au malaise d\'un salarié', path: 'newsroom/podcasts/malaise-accident-du-travail/', campaign: 'ressource-podcast-malaise' }],
  prevention: [{ kind: 'Webinaire en replay', title: 'Situations dangereuses et presqu\'accidents, du signalement à la prévention', path: 'newsroom/evenements/situations-dangereuses-et-presquaccidents-du-signalement-a-la-prevention/', campaign: 'ressource-webinaire-presquaccidents' }],
  mp: [{ kind: 'Guide', title: '10 questions que tous les RH se posent sur la fin des notifications des questionnaires risques professionnels', path: 'newsroom/guides-barometres/10-questions-que-tous-les-rh-se-posent-sur-la-fin-des-notifications-des-questionnaires-risques-professionnels/', campaign: 'ressource-guide-qrp' }],
  arrets: [{ kind: 'Guide', title: 'Les 10 questions que tous les RH se posent sur le pilotage des arrêts de travail de longue durée', path: 'newsroom/guides-barometres/arret-de-travail-long/', campaign: 'ressource-guide-arrets-longs' },
    { kind: 'Livre blanc', title: 'Maîtriser l\'art de la subrogation des IJSS', path: 'newsroom/guides-barometres/comment-bien-subroger-les-ijss-livre-blanc/', campaign: 'ressource-livre-blanc-subrogation' },
    { kind: 'Baromètre', title: 'Baromètre de l\'absentéisme et de l\'engagement', path: 'newsroom/guides-barometres/barometre-de-labsenteisme-et-de-lengagement/', campaign: 'ressource-barometre-absenteisme' }],
  // Le podcast des arrêts longs, dans le panneau du thème des arrêts.
  arretsPodcast: { kind: 'Podcast', title: 'AT longue durée, les leviers pour maîtriser vos arrêts longs', path: 'newsroom/podcasts/piloter-at-longue-duree/', campaign: 'ressource-podcast-arrets-longs' },
  // Un épisode du podcast La Voix des RH, en fin de page « À lire et à revoir ».
  podcasts: [{ kind: 'Podcast', title: 'Gestion des accidents du travail, obligations et bonnes pratiques', path: 'newsroom/podcasts/la-voix-des-rh-gestion-des-accidents-du-travail-obligations-et-bonnes-pratiques/', campaign: 'ressource-podcast-gestion-at' }],
  all: [{ kind: 'Livre blanc', title: 'Les enjeux clés de la déclaration d\'accident du travail', path: 'newsroom/guides-barometres/livre-blanc-declaration-accident-travail-enjeux/', campaign: 'ressource-livre-blanc-dat' }],
  // Dans « À lire et à revoir », le guide du taux remplace celui des questionnaires, déjà proposé
  // dans la partie des maladies, et le guide des accidents causés par un tiers ferme la liste.
  taux: { kind: 'Guide', title: 'Tout savoir sur le taux AT/MP', path: 'newsroom/guides-barometres/tout-savoir-sur-le-taux-de-cotisation-at-mp/', campaign: 'ressource-guide-taux-atmp' },
  tiers: { kind: 'Guide', title: 'Les 10 questions que tous les RH se posent sur les accidents du travail causés par un tiers', path: 'newsroom/guides-barometres/10-questions-que-tous-les-rh-se-posent-sur-les-accidents-du-travail-causes-par-un-tiers/', campaign: 'ressource-guide-tiers' }
};

// ── Ce qui remplit une page MP restée à moitié vide (packPages) ──
// Chaque page nomme ses candidats dans l'ordre (data-fill). Le premier qui ne figure pas déjà dans
// les pages du rapport l'emporte, le rendez-vous avec un consultant en dernier recours.
export var FILL = {
  'guide-mp': { kind: 'Guide', title: 'Les 10 questions que tous les RH se posent sur les maladies professionnelles', path: 'newsroom/guides-barometres/les-10-questions-que-tous-les-rh-se-posent-sur-les-maladies-professionnelles/', campaign: 'ressource-guide-mp' },
  'guide-qrp': RESOURCES.mp[0]
};
// Les pages des accidents du travail et L'essentiel puisent dans les ressources du rapport.
FILL['webinaire-prevention'] = RESOURCES.prevention[0];
FILL['article-declaration'] = RESOURCES.refus[0];
FILL['guide-arrets'] = RESOURCES.arrets[0];
FILL['barometre-absenteisme'] = RESOURCES.arrets[2];

export var FILL_LEAD = { 'Guide': 'Le guide', 'Article': 'L\'article', 'Webinaire en replay': 'Le webinaire en replay', 'Livre blanc': 'Le livre blanc', 'Baromètre': 'Le baromètre', 'Podcast': 'Le podcast' };

// Un guide, un livre blanc ou un baromètre s'ouvre sur une page de téléchargement.
export var FILL_VERB = { 'Article': 'le lire', 'Webinaire en replay': 'le revoir', 'Podcast': 'l\'écouter' };

export var FILL_MIN_MM = 60;

function resourceUrl(r) { return AYMING + r.path + utm(r.campaign); }

// La couverture de chaque ressource, reprise d'ayming.fr et servie en local (CSP img-src 'self').
// qr : le code QR de la ressource à droite, pour la page « À lire et à revoir » imprimée.
export function resourceCard(r, wide, qr) {
  // Une couverture de podcast est carrée, elle s'affiche entière plutôt que recadrée en portrait.
  return '<a class="rp-res' + (wide ? ' is-wide' : '') + (r.kind === 'Podcast' ? ' is-square' : '') + '" href="' + resourceUrl(r) + '" target="_blank" rel="noopener">' +
    '<img src="assets/report/' + r.campaign + '.jpg" alt="">' +
    '<span class="rp-res-body"><span class="rp-res-k">' + r.kind + '</span><span class="rp-res-t">' + r.title + '</span></span>' +
    (qr ? qrSvg(resourceUrl(r)) : '') + '</a>';
}

// Un code QR en SVG, par qrcode-generator (chargé en defer, comme Chart.js). Sans la bibliothèque,
// le code manque et le lien reste cliquable.
// Aux couleurs d'Ayming : modules arrondis en dégradé du bleu nuit au bleu, yeux bleus, et le symbole
// d'Ayming au centre. Les modules forment un seul tracé : un dégradé sur des centaines de <rect> donne
// au PDF un motif par module (8 Mo pour une quinzaine de codes). La correction d'erreur H (30 %) couvre les modules que le symbole cache.
var QR_N = 0;

export function qrSvg(url) {
  if (typeof qrcode === 'undefined') return '';
  var q = qrcode(0, 'H');
  q.addData(url);
  q.make();
  var n = q.getModuleCount(), id = 'rpqr' + (++QR_N);
  var hole = Math.ceil(n * 0.22) | 1, lo = (n - hole) / 2, hi = lo + hole;
  var isEye = function(r, c) { return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7); };
  var dots = '';
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      if (!q.isDark(r, c) || isEye(r, c) || (r >= lo - 0.5 && r < hi && c >= lo - 0.5 && c < hi)) continue;
      dots += 'M' + (c + 0.35) + ' ' + r + 'h0.3a0.35 0.35 0 0 1 0.35 0.35v0.3a0.35 0.35 0 0 1-0.35 0.35h-0.3a0.35 0.35 0 0 1-0.35-0.35v-0.3a0.35 0.35 0 0 1 0.35-0.35z';
    }
  }
  var eye = function(x, y) {
    return '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="6" height="6" rx="1.6" fill="none" stroke="#0072B6" stroke-width="1"/>' +
      '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx="0.8" fill="#004A76"/>';
  };
  return '<span class="rp-qr"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" role="img" aria-label="Code QR">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#004A76"/><stop offset="1" stop-color="#0072B6"/></linearGradient></defs>' +
    '<path fill="url(#' + id + ')" d="' + dots + '"/>' + eye(0, 0) + eye(n - 7, 0) + eye(0, n - 7) +
    '<rect x="' + lo + '" y="' + lo + '" width="' + hole + '" height="' + hole + '" rx="1.2" fill="#fff"/>' +
    '<svg x="' + (lo + 0.5) + '" y="' + (lo + 0.5) + '" width="' + (hole - 1) + '" height="' + (hole - 1) + '" viewBox="0 0 64 67">' +
      '<image href="assets/ayming-logo.png" width="167" height="67"/></svg>' +
  '</svg></span>';
}

// Les chiffres des consultants, sur la page du rendez-vous.
export var PROOFS = '<div class="rp-keynums"><div><strong>35 000</strong><span>accidents du travail suivis chaque année</span></div>' +
  '<div><strong>200+</strong><span>questionnaires MP traités chaque année</span></div>' +
  '<div><strong>250 000</strong><span>documents d\'arrêt collectés par an</span></div>' +
  '<div><strong>30 M€</strong><span>d\'IJ déclarées chaque année</span></div></div>';
