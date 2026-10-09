// ── Le rapport : un guide personnalisé, pas une plaquette ──
// Il s'adresse au responsable RH et paie, ou au DRH, qui le lit et le porte : il lui donne le
// quoi et le pourquoi, et de quoi défendre un plan devant sa direction (la page « L'essentiel » se transmet
// telle quelle). Les thèmes suivent le parcours de travail d'Ayming : la
// prévention, la déclaration de chaque accident, la réponse aux questionnaires de maladie
// professionnelle, la collecte des arrêts et les IJ, puis la cotisation, où tout aboutit.
// Chaque thème ouvre sur son statut, donne la règle, votre situation, puis ce que vous pouvez
// faire, en interne et avec Ayming. Un thème n'apparaît que s'il vous concerne.
// Conception : lead-magnet-report/DESIGN.md, sur le modèle du StoryBrand
// Marketing Report et le système de marque Ayming. Les textes clients passent le validateur de
// vocabulaire juridique d'Ayming.

import { MAJORATIONS, BAREME_SOURCE, estimateCoutSocial, baremeFor, ctnForNaf } from './cost-model.js?v=f8b7846';
import { modeNote, resolveEntry } from './compare.js?v=f8b7846';
import { DIMENSION_LABELS, SEX_GROUPS, AGE_GROUPS, API_LABELS, demoShares, nationalDemographics, keyedBars, psyYearBars } from './charts.js?v=f8b7846';
import { ficheShares, ficheDays, siegeDays } from './history.js?v=f8b7846';
import { getData } from './data.js?v=f8b7846';
import { ASSISTANT_ECARTS } from './assistant-content.js?v=f8b7846';
import { siegeFigure, sharesFigure, daysFigure } from './body.js?v=f8b7846';
import { chartSlot, resetReportCharts } from './report-charts.js?v=f8b7846';
import { isWorse, nationalSum } from './findings.js?v=f8b7846';
import { esc, fmt1, frNum, fmtEur, netEntreprisesLink } from './utils.js?v=f8b7846';

// ── Formatage, partagé avec le parcours ──
export function fmt2(n) { return (n == null || isNaN(n)) ? '—' : n.toFixed(2).replace('.', ','); }
export function pct(x) { return Math.round(x * 100) + ' %'; }
export function gap(ratio) {
  if (ratio == null) return '';
  var p = Math.round(Math.abs(ratio - 1) * 100);
  return ratio > 1.05 ? p + ' % au-dessus de' : ratio < 0.95 ? p + ' % en dessous de' : 'au niveau de';
}

// ── Liens sortants : tout lien vers ayming.fr porte ses UTM ──
// utm_content distingue le rapport de l'écran, utm_campaign l'offre ou la ressource.
var AYMING = 'https://www.ayming.fr/';
function utm(campaign) { return '?utm_source=sinistralite&utm_medium=referral&utm_campaign=' + campaign + '&utm_content=rapport'; }
function offerUrl(path, campaign) { return AYMING + 'ressources-humaines/' + path + utm(campaign); }
// demande et message pré-remplissent « Votre demande » (RH) et « Votre message » du formulaire
// ayming.fr (champs 7 et 8 du formulaire 2, préremplissage par l'URL). Jamais de nom, d'email ni
// de société dans cette URL : elle finit dans les pages vues de GA4.
export var CONTACT_URL = 'https://www.ayming.fr/contactez-nous/?utm_source=sinistralite&utm_medium=referral&utm_campaign=diagnostic' +
  '&demande=RH&message=' + encodeURIComponent('Suite à mon diagnostic sinistralité AT/MP');
function ext(url, text) { return '<a href="' + url + '" target="_blank" rel="noopener">' + text + '</a>'; }

// ── Les accompagnements Ayming : le comment de chaque thème ──
// Repris des fichiers de positionnement de chaque offre (~/projects/ayming/work/offers) et des
// pages des outils, relus au guide de vocabulaire juridique. Le rapport parle au nom d'Ayming :
// l'outil de remontée terrain et de pré-déclaration n'est jamais nommé, il renvoie à sa page
// (url). La déclaration et les réserves relèvent des consultants, jamais de l'outil. Ayming fait
// le travail (externalisation), mais le lecteur reste celui qui pilote et décide : chaque phrase
// dit comment Ayming aide, en une phrase simple par offre, « nous » étant le guide : Ayming
// aide et guide, il ne « prend pas en charge » à la place de l'équipe.
var ACCILINE = 'https://www.acciline.com/';
var OFFERS = {
  terrain: { name: 'Remontée des événements terrain', url: ACCILINE + 'module-evenements/', campaign: 'remontee-terrain',
    line: function() { return 'Nous vous fournissons un outil pour que vos équipes signalent presqu\'accidents et situations dangereuses depuis leur téléphone.'; } },
  duerp: { name: 'Document unique (DUERP)', path: 'prevention-et-sante-au-travail/evaluer-les-risques-professionnels-duerp/', campaign: 'duerp',
    line: function(d) { return 'Nous vous fournissons un outil qui tient votre document unique' + (d.effectif >= 50 ? ' et votre PAPRIPACT' : '') + ' à jour, relié à vos accidents.'; },
    proof: 'Le contenu du DUERP et les décisions de prévention restent de la responsabilité de l\'employeur.' },
  dat: { name: 'Déclaration des accidents du travail', path: 'atmp/declarer-un-accident-du-travail/', campaign: 'declarer-un-accident-du-travail',
    line: function() { return 'Nous pouvons déclarer chaque accident dans les 48 heures et vous aider à motiver vos réserves.'; },
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
    line: function() { return 'Nous pouvons récupérer les IJ non perçues des années passées.'; },
    proof: 'Plus de 30 M€ d\'IJ déclarées chaque année pour nos clients.' },
  ijss: { name: 'Remboursements IJSS et prévoyance', path: 'arrets-de-travail/remboursements-ijss-et-prevoyance/', campaign: 'remboursements-ijss',
    line: function() { return 'Nous pouvons vérifier chaque mois ce que la caisse et la prévoyance vous versent.'; },
    proof: null },
  cotisations: { name: 'Cotisations AT/MP', path: 'couts-rh/cotisations-at-mp/', campaign: 'cotisations-atmp',
    line: function() { return 'Nous pouvons vérifier votre compte AT/MP avant chaque notification.'; },
    proof: null }
};
// Les autres offres RH d'Ayming, sur la page des offres seulement : le rapport ne les pousse nulle
// part ailleurs, aucune donnée du secteur ne les appelle. « Accidents causés par un tiers » reste à
// part tant que l'autodiagnostic ne pose pas la question (DESIGN.md).
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
var HUB_CARDS = [
  ['terrain', 'Santé au travail', 'Faire remonter les événements terrain', 'Signaler presqu\'accidents et situations dangereuses depuis le téléphone, pour agir avant l\'accident.'],
  ['duerp', 'Santé au travail', 'Évaluer les risques professionnels', 'Faciliter la mise à jour du DUERP, piloter la priorisation des actions et suivre leur exécution.'],
  ['visites', 'Santé au travail', 'Gérer les visites médicales', 'Planifier, relancer et tracer les visites médicales pour se décharger d\'une tâche chronophage.'],
  ['rattrapage', 'Santé au travail', 'Rattraper les visites médicales en retard', 'Résorber le retard accumulé et régulariser votre situation rapidement.'],
  ['dat', 'AT/MP', 'Déclarer un accident du travail', 'Constituer le dossier complet et déclarer dans les délais.'],
  ['veille', 'AT/MP', 'Veille Net-Entreprises', 'Voir arriver chaque questionnaire AT/MP sur Net-Entreprises et répondre dans les délais.'],
  ['mp', 'AT/MP', 'Traiter un questionnaire de maladie professionnelle', 'Documenter la réponse et la suivre jusqu\'à la décision de la caisse.'],
  ['cotisations', 'AT/MP', 'Maîtriser les cotisations AT/MP', 'Manager et piloter vos AT/MP.'],
  ['collecte', 'Arrêts de travail', 'Collecter et traiter les arrêts de travail', 'Centraliser les justificatifs, contrôler la complétude, simplifier la saisie.'],
  ['ijss', 'Arrêts de travail', 'Suivre les remboursements IJSS et prévoyance', 'Sécuriser les déclarations DSN, CPAM et assureurs, et piloter les remboursements.'],
  ['ij', 'Arrêts de travail', 'Récupérer les IJ non perçues', 'Identifier les montants non perçus et faciliter les démarches de récupération.'],
  ['arrets', 'Arrêts de travail', 'Piloter les arrêts longue durée', 'Détecter les arrêts AT de plus de 45 jours et suivre leur évolution.'],
  ['charges', 'Coûts RH', 'Optimiser les charges sociales', 'Étudier les bases et les exonérations, pour réduire les charges patronales.'],
  ['urssaf', 'Coûts RH', 'Accompagner un contrôle Urssaf', 'Préparer en amont, et un appui technique et financier pendant le contrôle.'],
  ['apprentissage', 'Coûts RH', 'Obtenir les aides à l\'apprentissage', 'Bénéficier de toutes les aides, avec un reporting consolidé.']
];
function offerHref(o) { return o.url ? o.url + utm(o.campaign) : offerUrl(o.path, o.campaign); }
function offerLink(key) { var o = OFFERS[key]; return ext(offerHref(o), o.name); }

// ── Les ressources Ayming : de quoi aller plus loin sur chaque thème ──
var RESOURCES = {
  refus: [{ kind: 'Article', title: 'Déclaration d\'accident du travail, 10 erreurs à éviter', path: 'newsroom/actualites-avis-dexpert/declaration-daccident-du-travail-les-erreurs-a-eviter/', campaign: 'ressource-dat-erreurs' },
    { kind: 'Article', title: 'Absence de fait accidentel et absence de témoin, les réserves motivées', path: 'newsroom/actualites-avis-dexpert/absence-de-fait-accidentel-absence-de-temoin-reserves-motivees/', campaign: 'ressource-reserves-motivees' }],
  prevention: [{ kind: 'Webinaire en replay', title: 'Situations dangereuses et presqu\'accidents, du signalement à la prévention', path: 'newsroom/evenements/situations-dangereuses-et-presquaccidents-du-signalement-a-la-prevention/', campaign: 'ressource-webinaire-presquaccidents' }],
  mp: [{ kind: 'Guide', title: '10 questions que tous les RH se posent sur la fin des notifications des questionnaires risques professionnels', path: 'newsroom/guides-barometres/10-questions-que-tous-les-rh-se-posent-sur-la-fin-des-notifications-des-questionnaires-risques-professionnels/', campaign: 'ressource-guide-qrp' }],
  arrets: [{ kind: 'Guide', title: 'Les 10 questions que tous les RH se posent sur le pilotage des arrêts de travail de longue durée', path: 'newsroom/guides-barometres/arret-de-travail-long/', campaign: 'ressource-guide-arrets-longs' },
    { kind: 'Livre blanc', title: 'Maîtriser l\'art de la subrogation des IJSS', path: 'newsroom/guides-barometres/comment-bien-subroger-les-ijss-livre-blanc/', campaign: 'ressource-livre-blanc-subrogation' },
    { kind: 'Baromètre', title: 'Baromètre de l\'absentéisme et de l\'engagement', path: 'newsroom/guides-barometres/barometre-de-labsenteisme-et-de-lengagement/', campaign: 'ressource-barometre-absenteisme' }],
  taux: [{ kind: 'Article', title: 'Comment est calculé le taux de cotisation AT/MP ?', path: 'newsroom/actualites-avis-dexpert/comment-est-calcule-le-taux-de-cotisation-at-mp/', campaign: 'ressource-calcul-taux' },
    { kind: 'Article', title: 'Contestation du taux AT/MP, quand se lancer ?', path: 'newsroom/actualites-avis-dexpert/contestation-du-taux-at-mp-delai-2-mois/', campaign: 'ressource-contestation-taux' }],
  // Deux épisodes du podcast La Voix des RH, en fin de page « À lire et à revoir ».
  podcasts: [{ kind: 'Podcast', title: 'Gestion des accidents du travail, obligations et bonnes pratiques', path: 'newsroom/podcasts/la-voix-des-rh-gestion-des-accidents-du-travail-obligations-et-bonnes-pratiques/', campaign: 'ressource-podcast-gestion-at' },
    { kind: 'Podcast', title: 'Taux de cotisation AT/MP, les faces cachées de la tarification', path: 'newsroom/podcasts/la-voix-des-rh-les-faces-cachees-de-la-tarification-du-taux-de-cotisation-at-mp/', campaign: 'ressource-podcast-tarification' }],
  all: [{ kind: 'Baromètre', title: 'Baromètre national des risques professionnels', path: 'newsroom/guides-barometres/barometre-national-des-risques-professionnels/', campaign: 'ressource-barometre-risques-pro' }]
};

// ── Ce qui remplit une page MP restée à moitié vide (packPages) ──
// Chaque page nomme ses candidats dans l'ordre (data-fill). Le premier qui ne figure pas déjà dans
// les pages du rapport l'emporte, le rendez-vous avec un consultant en dernier recours. Le guide santé mentale
// ne se propose que là où le secteur compte des maladies psychiques.
var FILL = {
  'guide-mp': { kind: 'Guide', title: 'Les 10 questions que tous les RH se posent sur les maladies professionnelles', path: 'newsroom/guides-barometres/les-10-questions-que-tous-les-rh-se-posent-sur-les-maladies-professionnelles/', campaign: 'ressource-guide-mp' },
  'guide-qrp': RESOURCES.mp[0],
  'guide-sante-mentale': { kind: 'Guide', title: 'Les 10 questions que tous les RH se posent sur la santé mentale des collaborateurs', path: 'newsroom/guides-barometres/10-questions-que-tous-les-rh-se-posent-sur-la-sante-mentale/', campaign: 'ressource-guide-sante-mentale' }
};
// Les pages des accidents du travail et L'essentiel puisent dans les ressources du rapport.
FILL['article-taux'] = RESOURCES.taux[0];
FILL['webinaire-prevention'] = RESOURCES.prevention[0];
FILL['article-declaration'] = RESOURCES.refus[0];
FILL['guide-arrets'] = RESOURCES.arrets[0];
FILL['barometre-absenteisme'] = RESOURCES.arrets[2];
var FILL_LEAD = { 'Guide': 'Le guide', 'Article': 'L\'article', 'Webinaire en replay': 'Le webinaire en replay', 'Livre blanc': 'Le livre blanc', 'Baromètre': 'Le baromètre' };
var FILL_MIN_MM = 60;
function resourceUrl(r) { return AYMING + r.path + utm(r.campaign); }
// La couverture de chaque ressource, reprise d'ayming.fr et servie en local (CSP img-src 'self').
// qr : le code QR de la ressource à droite, pour la page « À lire et à revoir » imprimée.
function resourceCard(r, wide, qr) {
  // Une couverture de podcast est carrée, elle s'affiche entière plutôt que recadrée en portrait.
  return '<a class="rp-res' + (wide ? ' is-wide' : '') + (r.kind === 'Podcast' ? ' is-square' : '') + '" href="' + resourceUrl(r) + '" target="_blank" rel="noopener">' +
    '<img src="assets/report/' + r.campaign + '.jpg" alt="">' +
    '<span class="rp-res-body"><span class="rp-res-k">' + r.kind + '</span><span class="rp-res-t">' + r.title + '</span></span>' +
    (qr ? qrSvg(resourceUrl(r)) : '') + '</a>';
}
// Un code QR en SVG, par qrcode-generator (chargé en defer, comme Chart.js). Sans la bibliothèque,
// le code manque et le lien reste cliquable.
// Aux couleurs d'Ayming : modules arrondis en dégradé du bleu nuit au bleu, yeux bleus, et le symbole
// d'Ayming au centre. La correction d'erreur H (30 %) couvre les modules que le symbole cache.
var QR_N = 0;
function qrSvg(url) {
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
      dots += '<rect x="' + c + '" y="' + r + '" width="1" height="1" rx="0.35"/>';
    }
  }
  var eye = function(x, y) {
    return '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="6" height="6" rx="1.6" fill="none" stroke="#0072B6" stroke-width="1"/>' +
      '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx="0.8" fill="#004A76"/>';
  };
  return '<span class="rp-qr"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" role="img" aria-label="Code QR">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#004A76"/><stop offset="1" stop-color="#0072B6"/></linearGradient></defs>' +
    '<g fill="url(#' + id + ')">' + dots + '</g>' + eye(0, 0) + eye(n - 7, 0) + eye(0, n - 7) +
    '<rect x="' + lo + '" y="' + lo + '" width="' + hole + '" height="' + hole + '" rx="1.2" fill="#fff"/>' +
    '<svg x="' + (lo + 0.5) + '" y="' + (lo + 0.5) + '" width="' + (hole - 1) + '" height="' + (hole - 1) + '" viewBox="0 0 64 67">' +
      '<image href="assets/ayming-logo.png" width="167" height="67"/></svg>' +
  '</svg></span>';
}
// Les chiffres des consultants, sur la page du rendez-vous.
var PROOFS = '<div class="rp-keynums"><div><strong>35 000</strong><span>accidents du travail suivis chaque année</span></div>' +
  '<div><strong>200+</strong><span>questionnaires MP traités chaque année</span></div>' +
  '<div><strong>250 000</strong><span>documents d\'arrêt collectés par an</span></div>' +
  '<div><strong>30 M€</strong><span>d\'IJ déclarées chaque année</span></div></div>';

// ── Échéances, relatives à la date du rapport ──
// Ce qui amène l'entreprise, première question du diagnostic. Sa réponse choisit le premier
// paragraphe du rapport, le reste de la page est commun. « Simplement faire le point » garde
// l'ouverture générale (lead null).
export var MOTIFS = [
  { key: 'hausse', label: 'Notre taux AT/MP a augmenté',
    lead: 'Votre taux a augmenté. Il repose sur vos trois dernières années connues, et chaque sinistre y pèse selon la durée de son arrêt. Ce rapport montre d\'où vient la hausse probable, et ce qu\'il est encore temps de faire dans les deux mois qui suivent la notification.' },
  { key: 'accident', label: 'Un accident récent ou grave',
    lead: 'Un accident pèse sur trois taux successifs, selon la durée de l\'arrêt, une éventuelle incapacité permanente et les réserves émises dans les 10 jours. Ce rapport situe votre sinistralité dans celle de votre secteur, et montre ce qu\'un accident de plus coûte à votre taux.' },
  { key: 'bilan', label: 'Préparer le bilan social ou la BDESE',
    lead: 'Vos indicateurs de fréquence et de gravité figurent dans votre bilan social ou votre BDESE. Ce rapport les situe face à votre secteur, à votre taille et à la France entière, avec les chiffres officiels à citer.' },
  { key: 'certif', label: 'Un appel d\'offres ou une certification (MASE, ISO 45001)',
    lead: 'Un appel d\'offres ou un audit MASE ou ISO 45001 vous demande vos indicateurs. Ce rapport les situe face à votre secteur, et l\'attestation de votre compte AT/MP fait foi pour le dossier.' },
  { key: 'point', label: 'Simplement faire le point', lead: null }
];
function motifLead(v) {
  var m = MOTIFS.filter(function(x) { return x.key === v.motif; })[0];
  return m && m.lead ? m.lead : 'Si vous êtes en charge des ressources humaines, de la paie ou de la prévention, et que vous voulez agir sur la sinistralité de votre entreprise, ce rapport est fait pour vous.';
}

function nextNotificationYear(now) { return now.getMonth() === 0 && now.getDate() < 5 ? now.getFullYear() : now.getFullYear() + 1; }
var WHEN_ORDER = { now: 0, m1: 1, jan: 2, m6: 3 };
function whenLabel(w, now) {
  return w === 'now' ? 'Dès maintenant' : w === 'm1' ? 'Sous 30 jours' : w === 'jan' ? 'Janvier ' + nextNotificationYear(now) : 'Sous 6 mois';
}

// Ce qu'un accident avec arrêt de plus ajoute aux cotisations, au profil moyen du secteur.
// Le taux se calcule sur trois années de sinistres rapportées à trois années de masse salariale :
// le coût d'un sinistre entre dans trois taux pour un tiers chacun, soit une fois son coût au
// total, multiplié par (1 + M2) et par la part individuelle du taux. Nul en collectif.
// Les maladies psychiques et hors tableau du secteur, tirées de l'open data : des nombres de cas
// publiés, jamais une part modélisée. Une phrase n'apparaît que si le secteur compte des cas.
export function mpApiSentences(entry) {
  var out = [];
  var psy = (entry || {}).mp_psy || {};
  var years = Object.keys(psy).sort();
  var total = years.reduce(function(s, y) { return s + (psy[y] || 0); }, 0);
  var last = years[years.length - 1];
  if (total > 0) {
    out.push(frNum(total) + ' maladie' + (total > 1 ? 's psychiques reconnues' : ' psychique reconnue') + ' dans votre secteur depuis ' + years[0] + ', dont ' + frNum(psy[last] || 0) + ' en ' + last + '.');
  }
  var hors = ((entry || {}).mp_hors_tableau || []).filter(function(c) { return c.nb > 0; });
  var horsTotal = hors.reduce(function(s, c) { return s + c.nb; }, 0);
  if (horsTotal > 0) {
    out.push(frNum(horsTotal) + ' maladie' + (horsTotal > 1 ? 's' : '') + ' hors tableaux' + (last ? ' en ' + last : '') + ', surtout « ' + esc(hors[0].libelle) + ' » (' + frNum(hors[0].nb) + ').');
  }
  return out;
}

// Un accident de l'entreprise, avec ses propres arrêts quand elle les a donnés.
function companyArrets(d, n) {
  var c = { accidents: n };
  if (d.days) c.avgDays = d.days.co;
  if (d.over45) c.over45 = d.over45.co;
  return c;
}

export function accidentCost(d) {
  if (!d.est || !(d.est.partIndividuelle > 0)) return null;
  var one = estimateCoutSocial(d.sector, d.stats, companyArrets(d, 1), 0);
  return one ? one.direct * (1 + MAJORATIONS.M2) * d.est.partIndividuelle : null;
}

var CAUSE_LABELS = {
  'Outillage a main': 'Outillage à main', 'Manutention mecanique': 'Manutention mécanique',
  'Autres vehicules': 'Autres véhicules', 'Risque machines': 'Risque machine'
};

// Des pistes de prévention pour chaque grande cause d'accident du secteur, en mots simples. Elles
// suivent l'ordre des principes de prévention (L4121-2 du code du travail) : agir à la source et
// protéger collectivement (EPC) avant d'équiper chacun (EPI), puis former.
var CAUSE_LEVERS = {
  'Manutention manuelle': 'Équiper les postes d\'aides à la manutention, comme des chariots ou des tables élévatrices, et former aux gestes et postures.',
  'Chutes de hauteur': 'Protéger les zones en hauteur par des garde-corps ou des plateformes, puis former au travail en hauteur, avec un harnais quand la protection collective ne suffit pas.',
  'Chutes de plain-pied': 'Dégager, entretenir et éclairer les sols et les passages, et fournir des chaussures de sécurité.',
  'Outillage a main': 'Choisir des outils adaptés et bien entretenus, et fournir des gants adaptés à chaque tâche.',
  'Risque machines': 'Vérifier les protecteurs des machines, couper l\'énergie avant toute intervention, et former les opérateurs.',
  'Manutention mecanique': 'Séparer les piétons des engins, et former et habiliter chaque conducteur.',
  'Autres vehicules': 'Baliser les circulations et séparer les piétons des véhicules.',
  'Risque routier': 'Réduire le nombre et la durée des déplacements, entretenir les véhicules, et former à la conduite.',
  'Risque physique': 'Réduire à la source le bruit, les vibrations et la chaleur, puis compléter par des équipements de protection adaptés.',
  'Risque chimique': 'Remplacer les produits dangereux quand c\'est possible, capter les émissions à la source, puis fournir des équipements de protection adaptés.',
  'Agressions': 'Organiser l\'accueil et le travail isolé, et former les équipes aux situations difficiles.'
};

// ── Mise en page ──
// Chaque page ouvre sur un bandeau teinté : le logo, la pastille de la partie, le titre en deux
// temps (« Votre position|face à votre métier », une ligne légère puis une ligne grasse) et un
// anneau en haut à droite, vert pour l'ouverture et les maladies, bleu ailleurs. opts.part donne
// sa couleur à la page (at, mp, taux), que les graphiques lisent aussi. opts.hero se pose dans le
// bandeau, sous le titre.
var FOOT = 'Diagnostic comparatif établi à partir de vos réponses et des statistiques de l\'Assurance Maladie 2024';
function pageTitle(title) {
  var t = title.split('|');
  return t.length > 1 ? '<span class="rp-h-l">' + t[0] + '</span><span class="rp-h-b">' + t[1] + '</span>' : '<span class="rp-h-b">' + title + '</span>';
}
function foot(n) { return '<div class="rp-foot"><span>' + FOOT + '</span><span class="rp-pn">' + n + '</span></div>'; }
function page(n, title, inner, opts) {
  opts = opts || {};
  var ring = opts.ring || (opts.part === 'mp' ? 'green' : 'blue');
  // data-join : une page de chapitre sans chiffre d'ouverture peut rejoindre la précédente (packPages).
  var join = opts.part && !opts.hero && title ? ' data-part="' + opts.part + '" data-join="' + esc(title.replace('|', ' ')) + '"' : (opts.part ? ' data-part="' + opts.part + '"' : '');
  var fill = opts.fill ? ' data-fill="' + opts.fill.join(' ') + '"' : '';
  return '<section class="rp-page' + (opts.part ? ' rp-part-' + opts.part : '') + (opts.cls ? ' ' + opts.cls : '') + '" data-id="' + opts.id + '"' + join + fill + '>' +
    '<header class="rp-band rp-ring-' + ring + '">' +
      '<div class="rp-head"><img src="assets/ayming-logo.png" alt="Ayming" class="rp-logo"><span class="rp-pill">' + (opts.kicker || 'Diagnostic de sinistralité') + '</span></div>' +
      (title ? '<h2 class="rp-h">' + pageTitle(title) + '</h2>' : '') + (opts.hero || '') +
    '</header>' +
    '<div class="rp-body">' + inner + '</div>' + foot(n) +
  '</section>';
}
function block(k, inner, cls) { return '<div class="rp-block' + (cls ? ' ' + cls : '') + '"><span class="rp-block-k">' + k + '</span>' + inner + '</div>'; }

// Une page de thème : le statut et le verdict d'abord, puis un court paragraphe qui dit pourquoi
// c'est important, écrit comme un rapport et non dans un encadré, votre
// situation, et le panneau bleu « Ce que vous pouvez faire » : vos actions, puis comment Ayming
// peut vous aider, une ligne par offre, puis la ressource.
// Une ligne par offre, une phrase simple qui dit ce qu'Ayming peut faire pour vous (« Nous vous
// fournissons », « Nous pouvons »), le nom de l'offre en lien au bout :
// trois puces sur deux colonnes prenaient une demi-page, le contenu doit rester le plus gros).
function helpLine(k, d) { return '<li>' + OFFERS[k].line(d) + ' ' + offerLink(k) + '</li>'; }

// ── Les thèmes, chacun renvoie null quand il ne vous concerne pas ──
function buildThemes(v, d, now) {
  var mode = d.est ? d.est.mode : null;
  var collectif = mode === 'collectif';
  var perAcc = accidentCost(d);
  var list = [];
  function act(text, owner, when, quick, offer) { return { text: text, owner: owner, when: when, quick: !!quick, offer: offer || null, whenLabel: whenLabel(when, now) }; }

  // 1. Chaque accident, jusqu'à la décision de prise en charge
  if (d.accidents > 0) {
    list.push({ id: 'refus', title: 'Chaque accident, jusqu\'à la décision de prise en charge', short: 'Déclarations et réserves', forWho: 'RH et paie',
      status: v.reserves === 'oui' ? 'ok' : 'todo',
      verdict: v.reserves === 'oui' ? 'Des réserves sont motivées quand les circonstances le justifient.'
        : v.reserves === 'non' ? 'Motiver des réserves quand les faits le justifient est un levier encore disponible.'
        : v.reserves === 'nsp' ? 'Vérifier si des réserves sont émises est un premier levier simple.'
        : 'Chaque accident se joue au moment de sa déclaration.',
      actions: [act('Écrire la procédure de déclaration, en précisant qui recueille les faits, qui déclare et qui remplace en cas d\'absence', 'RH', 'm1', true, 'terrain'),
        act('Examiner les circonstances de chaque accident avant de déclarer, pour décider s\'il y a lieu de motiver des réserves', 'RH, avec le manager concerné', 'now', true, 'dat')],
      offers: ['terrain', 'dat'],
      objection: ['« Émettre des réserves, c\'est suspecter nos salariés. »', 'Une réserve porte sur les circonstances, jamais sur la personne. Elle permet à la caisse d\'instruire le dossier complètement, et ne se justifie que lorsque les faits le demandent.'],
      resource: RESOURCES.refus[0] });
  }

  // 2. La prévention
  // Le document unique et les presqu'accidents se lisent dans les données du secteur, jamais dans
  // une réponse : chaque grande cause est un risque à y inscrire.
  var topCause = Object.keys((d.entry || {}).risk_causes || {}).filter(function(k) { return k !== 'Autres risques'; })
    .map(function(k) { return { label: CAUSE_LABELS[k] || k, value: d.entry.risk_causes[k] }; })
    .sort(function(a, b) { return b.value - a.value; })[0];
  if (topCause && !(topCause.value > 0)) topCause = null;
  var prevStatus = topCause ? 'todo' : 'watch';
  var prevActs = [act('Mettre en place un signalement simple des presqu\'accidents et des situations dangereuses, depuis le terrain', 'HSE, avec les managers', 'm1', true, 'terrain'),
    act('Confronter les causes et les lésions de votre secteur à votre document unique, et dater la mise à jour', 'HSE, avec la direction', 'm1', true, 'duerp'),
    act('Demander à votre caisse régionale (Carsat) les aides à la prévention ouvertes à votre entreprise', 'HSE', 'm6')];
  list.push({ id: 'prevention', title: 'La prévention, avant l\'accident', short: 'Prévention et DUERP', forWho: 'HSE et RH',
    status: prevStatus,
    verdict: topCause ? '« ' + topCause.label + ' » cause ' + Math.round(topCause.value) + ' % des accidents de votre secteur, le premier risque à inscrire dans votre document unique.'
      : 'Les causes des accidents de votre secteur sont la matière de votre document unique.',
    actions: prevActs,
    offers: ['terrain', 'duerp'],
    objection: ['« La prévention coûte plus qu\'elle ne rapporte. »', perAcc
      ? 'Chaque accident avec arrêt évité épargne environ ' + fmtEur(perAcc) + ' de cotisations sur trois taux, avant même le coût des absences et du remplacement.'
      : 'Sous 20 salariés, votre taux ne dépend pas de vos accidents, mais chaque accident évité épargne des absences, un remplacement et une désorganisation.'],
    resource: RESOURCES.prevention[0] });

  // 3. Les maladies professionnelles
  if (v.mp > 0 || (d.mp && d.mp.sec > d.mp.nat)) {
    list.push({ id: 'mp', title: 'Les maladies professionnelles', short: 'Maladies professionnelles', forWho: 'RH et HSE',
      status: v.mp > 0 ? 'todo' : 'watch',
      verdict: v.mp > 0 ? 'Vous avez eu ' + frNum(v.mp) + ' maladie' + (v.mp > 1 ? 's professionnelles reconnues' : ' professionnelle reconnue') + ' sur l\'année.'
        : 'Votre secteur compte plus de maladies professionnelles que la moyenne nationale.',
      actions: [act('Désigner qui répond aux questionnaires de la caisse, et tenir à jour les expositions par poste', 'RH, avec HSE', 'm1', true, 'mp')],
      offers: ['mp'],
      objection: ['« Nos RH connaissent les postes et peuvent répondre seuls. »', 'Souvent, oui. La difficulté tient aux expositions anciennes et aux archives incomplètes, et au délai de 30 jours qui laisse peu de temps pour les reconstituer.'],
      resource: RESOURCES.mp[0] });
  }

  // 4. Les arrêts et les indemnités journalières
  if (d.accidents > 0) {
    // La durée des arrêts n'est pas publiée par secteur : les arrêts de plus de 45 jours se lisent
    // sur les seuls chiffres de l'entreprise, dans l'action qui les suit, sans moyenne sectorielle.
    var longAction = v.arrets45 > 0
      ? 'Suivre ' + (v.arrets45 > 1 ? 'vos ' + frNum(v.arrets45) + ' arrêts' : 'votre arrêt') + ' de plus de 45 jours, avec un référent pour ' + (v.arrets45 > 1 ? 'chacun' : 'lui')
      : 'Recenser les arrêts de plus de 45 jours en cours et désigner un référent pour chacun';
    var arretsOffers = ['collecte'];
    if (v.suivi45 === 'non' || v.arrets45 > 0) arretsOffers.push('arrets');
    arretsOffers.push(v.ijRecup === 'oui' ? 'ijss' : 'ij');
    list.push({ id: 'arrets', title: 'Les arrêts et les indemnités journalières', short: 'Arrêts et IJSS', forWho: 'RH et paie',
      status: (v.ijRecup === 'non' || v.ijRecup === 'nsp' || v.suivi45 === 'non' || (d.days && d.days.ratio > 1.05)) ? 'todo' : v.ijRecup === 'oui' ? 'ok' : 'watch',
      verdict: d.days ? 'Vos arrêts durent en moyenne ' + fmt1(d.days.co) + ' jours par accident, contre ' + fmt1(d.days.sec) + ' dans votre secteur.'
        : v.ijRecup === 'oui' ? 'Vous rapprochez déjà les IJ avancées et remboursées.' : 'Le rapprochement des IJ avancées et remboursées n\'est pas en place, ou pas vérifié.',
      actions: [act('Centraliser les arrêts et leurs justificatifs, et contrôler qu\'ils sont complets avant la paie', 'Paie', 'm1', true, 'collecte'),
        act(longAction, 'RH', 'm1', true, 'arrets'),
        act('Rapprocher chaque mois les IJ attendues et les IJ reçues, arrêt par arrêt', 'Paie', 'm1', true, 'ijss'),
        act('Reprendre les arrêts des années antérieures pour repérer les IJ non perçues', 'Paie', 'm6', false, 'ij')],
      offers: arretsOffers,
      objection: ['« Notre logiciel de paie s\'en charge. »', 'Le logiciel calcule ce qui est dû. Il ne vérifie pas que la caisse l\'a versé, ni qu\'un arrêt long reste cohérent avec son motif.'],
      // Le guide des arrêts longs quand l'entreprise en a, ou ne les suit pas, sinon la subrogation.
      resource: arretsOffers.indexOf('arrets') >= 0 ? RESOURCES.arrets[0] : RESOURCES.arrets[1] });
  }

  // 5. Le taux et la cotisation, où tout le reste aboutit
  if (d.est) {
    var above = v.tauxNotifie != null && !collectif && v.tauxNotifie > d.est.tauxNet * 1.15;
    list.push({ id: 'taux', title: 'Votre taux et votre cotisation', short: 'Taux et cotisation AT/MP', forWho: 'RH et paie, et votre direction financière',
      status: collectif ? 'na' : (above || d.at.ratio > 1.05) ? 'todo' : 'ok',
      verdict: collectif ? 'Sous 20 salariés, votre taux est celui de votre secteur, estimé à ' + fmt2(d.est.tauxNet) + ' %.'
        : 'Votre taux est estimé à ' + fmt2(d.est.tauxNet) + ' %, soit une cotisation de ' + fmtEur(d.est.cotisation) + ' par an.',
      actions: collectif
        ? [act('Vérifier que le code risque de votre notification correspond à votre activité réelle', 'Direction ou RH', 'm1', true)]
        : [act('À la notification de janvier, relire les sinistres imputés à votre compte AT/MP, et engager dans les deux mois les démarches sur ceux qui le justifient', 'RH ou paie, avec la direction financière', 'jan', true, 'cotisations'),
           act('Suivre le taux chaque année avec la direction financière, comme un poste de charges', 'Direction financière', 'm6', false, 'cotisations')],
      offers: collectif ? [] : ['cotisations'],
      objection: collectif ? null : ['« Discuter notre taux va se retourner contre nous. »', 'Relire les imputations, c\'est s\'assurer de payer ce qui est dû. Nous vérifions avec vous que chaque sinistre imputé correspond à votre dossier.'],
      resource: RESOURCES.taux[0] });
  }
  // L'ordre du parcours Ayming : la prévention d'abord, le taux en dernier.
  var ORDER = ['prevention', 'refus', 'mp', 'arrets', 'taux'];
  return list.sort(function(a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
}

// ── Les chapitres : les données, ce qu'elles veulent dire pour vous, ce que vous pouvez faire ──
// Chaque chapitre reprend une bande des vues sectorielles de l'app, appliquée à l'entreprise :
// son chiffre prend la place de la référence nationale quand elle l'a, l'analyse du secteur reste
// entière quand elle ne l'a pas. Puis deux ou trois phrases qui lisent ces données avec les
// chiffres et les réponses de l'entreprise, puis ce qu'elle peut faire, avec l'aide d'Ayming là
// où la donnée la justifie (lien sur le mot, ressource quand la place le permet).
// Conception : lead-magnet-report/DESIGN.md.

// Les écarts marqués en rouge, relevés au fil des graphiques pour la page de la direction.
// Chaque écart garde son risque (PART, posé par chaque partie) et son sujet court.
var NOTES = [], PART = '';
// pair : la ligne en cause, sa valeur dans le secteur (a) et au national (b), et son unité, pour
// les deux barres de la page de la direction.
function noteGap(topic, ratio, pair) {
  if (ratio > 1) NOTES.push({ part: PART === 'Maladies professionnelles' ? 'mp' : 'at', head: PART + ', ' + topic.split(',')[0].toLowerCase(),
    label: esc(pair.label), a: pair.a, b: pair.b, unit: pair.unit, ratio: ratio });
}
function fmtNote(n, unit) { return unit === '' ? fmt1(n) : frNum(n); }

// Un graphique du rapport : le constat en titre, le sujet en sous-titre, puis le canvas.
// Un graphique dont la série du secteur ne publie rien au-dessus de zéro : à sa place, le cadre
// de même hauteur et sa phrase, comme data.ameli.fr affiche « aucune donnée ».
function noDataFig(topic, text, rows) {
  return '<div class="rp-figure"><p class="rp-find">' + topic + '</p><div class="rp-nodata" style="height:' + (4 + rows * 7) + 'mm"><span>' + text + '</span></div></div>';
}
function published(a) { return !!a && a.some(function(x) { return x > 0; }); }
function fig(find, topic, spec, rows, legend) {
  return '<div class="rp-figure">' + (find ? '<p class="rp-find">' + find + '</p>' : '<p class="rp-find">' + topic + '</p>') +
    (find ? '<p class="rp-why">' + topic + '</p>' : '') + chartSlot(spec, 4 + rows * 7) + (legend || '') + '</div>';
}
// La légende sous un graphique de répartition ou de durées, sur une ligne : ce que sont la barre
// pâle ou le trait. Le rouge se lit sans légende, la barre dépasse sa référence.
function legendOf(kind) {
  return '<p class="rp-legend"><span><i class="is-part"></i>Votre secteur</span>' +
    (kind === 'days' ? '<span><i class="is-tick"></i>Moyenne nationale</span>' : '<span><i class="is-ref"></i>France entière</span>') + '</p>';
}
// Un libellé d'axe sur deux lignes au plus, coupé à l'espace le plus proche du milieu : une ligne
// de graphique tient 7 mm, et une troisième ligne chevaucherait la voisine.
function twoLines(text) {
  if (text.length <= 26) return text;
  var best = -1;
  for (var i = text.indexOf(' '); i >= 0; i = text.indexOf(' ', i + 1)) {
    if (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2)) best = i;
  }
  return best < 0 ? text : [text.slice(0, best), text.slice(best + 1)];
}
// Parts en %, la part nationale en barre pâle derrière. rows : [{ label, pct, nat }].
// opts.rows force la hauteur (pour aligner deux graphiques côte à côte), opts.thick l'épaisseur,
// opts.wide un graphique en pleine largeur, ses libellés sur une ligne.
function shareFig(rows, topic, mark, opts) {
  opts = opts || {};
  rows = (rows || []).filter(function(r) { return r.pct != null; });
  if (rows.length < 2) return '';
  var hasRef = rows.some(function(r) { return r.nat != null; });
  // Le titre est le sujet du graphique, comme dans l'outil : un constat n'y nommerait qu'une ligne
  // quand plusieurs dépassent le national. Le plus fort écart rejoint « L'essentiel ».
  var worst = rows.filter(function(r) { return isWorse(r.pct, r.nat); }).sort(function(a, b) { return b.pct / b.nat - a.pct / a.nat; })[0];
  if (worst) noteGap(topic, worst.pct / worst.nat, { label: worst.label, a: worst.pct, b: worst.nat, unit: '%' });
  return fig(null, topic, { type: 'share', aria: topic, labelW: opts.wide ? 300 : null, labels: rows.map(function(r) { return opts.wide ? r.label : twoLines(r.label); }),
    values: rows.map(function(r) { return r.pct; }), ref: hasRef ? rows.map(function(r) { return r.nat; }) : null, mark: mark == null ? -1 : mark, fmt: 'pct', thick: opts.thick }, opts.rows || rows.length, hasRef && !opts.noLegend ? legendOf('share') : '');
}
// Journées par sinistre, la moyenne nationale en trait. rows : [{ label, value, nat }].
function daysFig(rows, topic) {
  rows = (rows || []).filter(function(r) { return r.value > 0; });
  if (rows.length < 2) return '';
  // « L'essentiel » retient le plus grand écart en jours : un rapport de durées gonfle quand la
  // moyenne nationale d'une modalité rare tient en quelques jours.
  var worst = rows.filter(function(r) { return isWorse(r.value, r.nat); }).sort(function(a, b) { return (b.value - b.nat) - (a.value - a.nat); })[0];
  if (worst) noteGap(topic, worst.value / worst.nat, { label: worst.label, a: worst.value, b: worst.nat, unit: 'j' });
  var hasRef = rows.some(function(r) { return r.nat != null; });
  return fig(null, topic, { type: 'days', aria: topic, labels: rows.map(function(r) { return twoLines(r.label); }),
    values: rows.map(function(r) { return r.value; }), ref: rows.map(function(r) { return r.nat == null ? null : r.nat; }) }, rows.length, hasRef ? legendOf('days') : '');
}
function cols(a, b) { return a && b ? '<div class="rp-grid2"><div>' + a + '</div><div>' + b + '</div></div>' : (a || '') + (b || ''); }
function para(list) { return list.filter(Boolean).map(function(t) { return '<p class="rp-p">' + t + '</p>'; }).join(''); }
function meaning(list) {
  list = list.filter(Boolean);
  return list.length ? '<div class="rp-meaning"><h3 class="rp-h3">Ce que cela veut dire pour vous</h3>' + para(list) + '</div>' : '';
}
// Un mot du texte en lien vers l'offre qui s'y rapporte.
function kw(key, text) { return ext(offerHref(OFFERS[key]), text); }

// Ce que vous pouvez faire : les actions du chapitre, avec qui et quand, puis l'aide d'Ayming,
// une phrase par offre, et la ressource, retirée si la page déborde.
// Les actions, les offres et la ressource du thème, celles de la feuille de route.
function guideOf(t, d, lead) { return t ? nextBox({ lead: lead, actions: t.actions, offers: t.offers, card: t.resource }, d) : ''; }
function nextBox(g, d) {
  var acts = g.actions || [], offers = g.offers || [];
  if (!acts.length && !offers.length) return '';
  return '<div class="rp-todo">' + (g.lead ? '<p class="rp-todo-lead">' + g.lead + '</p>' : '') +
      '<div class="rp-todo-cols"><div><p class="rp-todo-k">' + (acts.length > 1 ? 'Vos actions' : 'Votre action') + '</p>' +
      '<ol class="rp-do">' + acts.map(function(a, i) {
        return '<li><span class="rp-do-n">' + (i + 1) + '</span><div>' + a.text + '<span class="rp-do-meta">' + a.owner + ', ' + a.whenLabel.charAt(0).toLowerCase() + a.whenLabel.slice(1) + '</span></div></li>';
      }).join('') + '</ol></div>' +
      (offers.length ? '<div><p class="rp-todo-k">Comment Ayming peut vous aider</p>' +
        '<ul class="rp-help">' + offers.map(function(k) { return helpLine(k, d); }).join('') + '</ul></div>' : '') + '</div>' +
      (g.card ? '<div class="rp-filler">' + resourceCard(g.card, true) + '</div>' : '') +
    '</div>';
}

// Le face-à-face du bandeau : le chiffre de l'entreprise, « VS », celui du secteur. La pastille
// dit l'écart, en rouge seulement quand l'entreprise fait moins bien.
function vsHero(co, coLabel, sec, secLabel, ratio) {
  var chip = ratio == null || !isFinite(ratio) ? '' : ratio >= 2 ? '×' + fmt1(ratio) + ' le secteur' : ratio > 1.05 ? '+' + Math.round((ratio - 1) * 100) + ' %' : ratio < 0.95 ? '−' + Math.round((1 - ratio) * 100) + ' %' : 'au niveau';
  return '<div class="rp-vs"><div class="rp-vs-co">' + (chip ? '<span class="rp-vs-chip' + (ratio > 1.05 ? ' is-worse' : '') + '">' + chip + '</span>' : '') +
      '<strong>' + co + '</strong><span>' + coLabel + '</span></div><span class="rp-vs-mid">VS</span>' +
    '<div><strong>' + sec + '</strong><span>' + secLabel + '</span></div></div>';
}
// Trois chiffres du bandeau, sans cadre. figs : [[chiffre, légende], ...].
function heroFigs(figs) {
  figs = figs.filter(Boolean);
  return figs.length ? '<div class="rp-hero-figs">' + figs.map(function(f) { return '<div><strong>' + f[0] + '</strong><span>' + f[1] + '</span></div>'; }).join('') + '</div>' : '';
}
// Une phrase qui porte la page, en blanc sur le bleu nuit.
function punch(html) { return html ? '<p class="rp-punch">' + html + '</p>' : ''; }
function lowerFirst(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }

// ── Références nationales, calculées une fois par jeu de données ──
var MEMO = {};
function memo(key, fn) { if (!(key in MEMO)) MEMO[key] = fn(); return MEMO[key]; }
// Parts des causes au national : les parts de chaque secteur, pondérées par ses sinistres.
function nationalCauses(view, countKey) {
  return memo('causes-' + view, function() {
    var store = (getData(view) || {}).by_naf5 || {}, sum = {}, tot = 0;
    Object.keys(store).forEach(function(c) {
      var e = store[c], n = (e.stats || {})[countKey] || 0, rc = e.risk_causes || {};
      if (!n) return;
      Object.keys(rc).forEach(function(k) { sum[k] = (sum[k] || 0) + (rc[k] || 0) * n; });
      tot += n;
    });
    var out = {};
    Object.keys(sum).forEach(function(k) { out[k] = tot ? Math.round(sum[k] / tot * 10) / 10 : 0; });
    return out;
  });
}
function nationalExtra() {
  return memo('extra', function() {
    var ex = getData('extra') || {};
    return nationalSum(Object.keys(ex).map(function(c) { return ex[c]; }));
  });
}
// Le rang d'un indice de fréquence parmi les secteurs NAF 5 publiés, du plus exposé au moins exposé.
function rankOf(view, value) {
  var list = memo('if-' + view, function() {
    var store = (getData(view) || {}).by_naf5 || {};
    return Object.keys(store).map(function(c) { return (store[c].stats || {}).indice_frequence; }).filter(function(x) { return x != null; });
  });
  return { rank: 1 + list.filter(function(x) { return x > value; }).length, of: list.length };
}
function causeRows(entry, natShares) {
  return Object.keys((entry || {}).risk_causes || {}).map(function(k) {
    return { key: k, label: CAUSE_LABELS[k] || k, pct: entry.risk_causes[k], nat: natShares[k] };
  }).filter(function(r) { return r.pct > 0 && r.key !== 'Autres risques'; })
    .sort(function(a, b) { return b.pct - a.pct; }).slice(0, 6);
}

// ── Partie 1, les accidents du travail ──

// Votre position : votre fréquence face au secteur en tête de page, les quatre repères, le rang
// parmi les secteurs, et vingt ans de fréquence nationale avec les dix ans du secteur.
// La sinistralité par taille d'établissement, le graphique de l'outil : la part des accidents et
// celle des salariés par tranche, la fréquence de chaque tranche. Les chiffres du secteur seuls,
// l'entreprise se lit dans les quatre repères au-dessus (José 2026-10-01). Une tranche sans
// salarié publié ne se dessine pas.
function sizeBlock(d) {
  var bands = (d.bands || []).filter(function(b) { return b.part_salaries > 0; }), out = { html: '', txt: null };
  if (bands.length < 2 || !d.stats.indice_frequence) return out;
  // Sans accident publié, la fréquence de la tranche reste vide plutôt que de se lire comme un zéro.
  var ifs = bands.map(function(b) { return b.part_accidents > 0 ? Math.round(b.part_accidents / b.part_salaries * d.stats.indice_frequence * 10) / 10 : null; });
  var you = d.bandIndex != null ? bands.indexOf(d.bands[d.bandIndex]) : -1;
  out.html = fig(null, 'Sinistralité par taille d\'établissement',
    { type: 'size', aria: 'Part des accidents, part des salariés et fréquence par taille d\'établissement', labels: bands.map(function(b) { return b.label; }),
      acc: bands.map(function(b) { return b.part_accidents; }), sal: bands.map(function(b) { return b.part_salaries; }), ifs: ifs }, 6);
  if (you >= 0 && ifs[you] != null) out.txt = 'Avec ' + frNum(d.effectif) + ' salariés, vous êtes dans la tranche ' + bands[you].label + ', où la fréquence du secteur est de ' + fmt1(ifs[you]) +
    ' accidents pour 1 000 salariés. Votre entreprise est à ' + fmt1(d.at.co) + '. Une tranche dont la part des accidents dépasse la part des salariés est plus exposée que la moyenne du secteur.';
  return out;
}
// Le positionnement de l'outil : chaque secteur NAF 5 est un point placé selon sa fréquence, le
// secteur dans la couleur de la partie, l'entreprise en bleu Ayming, la moyenne nationale en trait.
// L'échelle s'arrête au 99e centile pour qu'un secteur extrême n'écrase pas les autres, un point
// au-delà se pose au bord.
function positionStrip(d) {
  var store = (getData('at') || {}).by_naf5 || {};
  // Les mêmes activités que le rang cité à côté (rankOf) : toutes celles dont l'indice est publié.
  var all = Object.keys(store).map(function(c) { return store[c].stats; }).filter(function(s) { return s && s.indice_frequence != null; })
    .map(function(s) { return s.indice_frequence; }).sort(function(a, b) { return a - b; });
  if (all.length < 20) return '';
  var max = Math.max(all[Math.floor(all.length * 0.99)], d.at.sec, d.at.co) * 1.04;
  var x = function(v) { return Math.min(100, v / max * 100); };
  var dots = all.map(function(v) { return '<i style="left:' + x(v).toFixed(2) + '%"></i>'; }).join('');
  var mark = function(v, cls, label) { return '<span class="rp-strip-mark ' + cls + '" style="left:' + x(v).toFixed(2) + '%"><b>' + label + '</b></span>'; };
  return '<div class="rp-figure"><p class="rp-find">Votre secteur parmi les ' + all.length + ' activités</p>' +
    '<p class="rp-why">Chaque point est une activité, placée selon ses accidents avec arrêt pour 1 000 salariés.</p>' +
    '<div class="rp-strip"><div class="rp-strip-track">' + dots + '</div>' +
      mark(d.at.nat, 'is-nat', 'France ' + fmt1(d.at.nat)) + mark(d.at.sec, 'is-sec', 'Votre secteur ' + fmt1(d.at.sec)) + mark(d.at.co, 'is-co', 'Vous ' + fmt1(d.at.co)) +
    '</div><p class="rp-strip-axis"><span>Les moins exposées</span><span>Les plus exposées</span></p></div>';
}
// « 1er », puis « 2e », « 3e »…
function ordSup(n) { return '<sup>' + (n === 1 ? 'er' : 'e') + '</sup>'; }
function atPosition(v, d) {
  var rows = [['Votre entreprise', d.at.co], ['Votre secteur', d.at.sec], d.at.peer != null ? ['Établissements de votre taille', d.at.peer] : null, ['Moyenne nationale', d.at.nat]].filter(Boolean);
  var sec = rankOf('at', d.at.sec), co = rankOf('at', d.at.co);
  var strip = positionStrip(d);
  var peer = d.at.peer > 0 ? d.at.co / d.at.peer : null;
  var hero = vsHero(fmt1(d.at.co), 'accidents avec arrêt pour 1 000 salariés, votre entreprise', fmt1(d.at.sec), 'la même mesure pour votre secteur, ' + esc(lowerFirst(d.sectorLib)), d.at.ratio);
  var html = cols(fig(rows.length > 3 ? 'Quatre repères' : 'Trois repères', 'Accidents avec arrêt pour 1 000 salariés.',
        { type: 'hbar', aria: 'Votre indice de fréquence face au secteur', labels: rows.map(function(r) { return twoLines(r[0]); }), values: rows.map(function(r) { return r[1]; }), you: 0, fmt: '1' }, rows.length),
      meaning([
        'Votre secteur se classe au <strong>' + sec.rank + ordSup(sec.rank) + ' rang</strong> des ' + sec.of + ' activités, de la plus exposée à la moins exposée. À votre fréquence, votre entreprise se placerait au ' + co.rank + ordSup(co.rank) + '.',
        peer == null || d.at.ratio <= 1.05 ? null : peer > 1.05 ? 'Vous êtes aussi ' + gap(peer).replace(/de$/, 'des') + ' établissements de votre taille, la taille de votre établissement n\'explique donc pas l\'écart.'
          : 'Face aux établissements de votre taille, votre fréquence est ' + gap(peer) + ' la leur, la taille explique donc une part de l\'écart.'
      ])) +
    strip +
    // Mieux placée que son secteur, l'entreprise lit ce que cette avance vaut, avec le même modèle.
    punch(!d.est || d.est.mode === 'collectif' ? null
      : d.at.ratio > 1.05 ? 'Revenir à la fréquence de votre secteur réduirait votre ' + kw('cotisations', 'cotisation AT/MP') + ' d\'environ ' + fmtEur(d.est.gap) + ' par an.'
      : d.at.ratio < 0.95 && -d.est.gap > d.est.cotisation * 0.02 ? 'À la fréquence de votre secteur, votre ' + kw('cotisations', 'cotisation AT/MP') + ' serait plus élevée d\'environ ' + fmtEur(-d.est.gap) + ' par an.'
      : null);
  return [{ id: 'position', title: 'Votre position|face à votre métier', html: html, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Votre position face à votre métier', fill: ['article-taux', 'guide-arrets', 'webinaire-prevention'] }];
}

// La gravité : le tableau de bord du secteur, votre entreprise en face, puis ce qu'un accident
// coûte. Le chapitre de la déclaration, là où chaque dossier se construit.
// La cascade de gravité de l'outil, en pyramide : les décès en haut, les accidents avec arrêt à la
// base, et entre deux marches la part des sinistres qui passe à la marche du dessus.
function cascadeFig(s) {
  var steps = [['Décès', s.deces, 'is-dc', 'un décès'], ['Incapacités permanentes', s.nouvelles_ip, 'is-ip', 'une incapacité permanente'],
    ['Arrêts de 4 jours et plus', s.at_4j_arret, 'is-4j', 'un arrêt de 4 jours et plus'], ['Accidents avec arrêt', s.at_1er_reglement, 'is-all']].filter(function(x) { return x[1] != null; });
  if (steps.length < 3 || !(s.at_1er_reglement > 0)) return '';
  var n = steps.length;
  var html = steps.map(function(x, i) {
    var below = steps[i + 1];
    return '<div class="rp-cascade-bar ' + x[2] + '" style="width:' + Math.round((i + 1) / n * 100) + '%"><span>' + x[0] + '</span><strong>' + frNum(x[1]) + '</strong></div>' +
      (below ? '<p class="rp-cascade-rate">' + (below[1] > 0 && x[1] <= below[1] ? fmt1(x[1] / below[1] * 100) + ' % donnent lieu à ' + x[3] : frNum(x[1]) + ' ' + lowerFirst(x[0]) + ' pour ' + frNum(below[1]) + ' ' + lowerFirst(below[0])) + '</p>' : '');
  }).join('');
  return '<div class="rp-figure"><p class="rp-find">Cascade de gravité dans votre secteur</p><div class="rp-cascade">' + html + '</div></div>';
}
function atGravite(v, d, T) {
  var s = d.stats, n = getData('at').meta.national;
  var perCase = function(x) { return x.at_1er_reglement ? x.journees_it / x.at_1er_reglement : null; };
  var ipRate = function(x) { return x.at_1er_reglement ? x.nouvelles_ip / x.at_1er_reglement * 100 : null; };
  var dcRate = function(x) { return x.at_1er_reglement ? x.deces / x.at_1er_reglement * 10000 : null; };
  var row = function(label, def, co, sec, nat, fmt) {
    var bad = isWorse(sec, nat);
    return '<tr><td><strong>' + label + '</strong><span class="rp-def">' + def + '</span></td><td>' + (co == null ? '<span class="rp-na">—</span>' : fmt(co)) + '</td><td' + (bad ? ' class="is-worse"' : '') + '>' + fmt(sec) + '</td><td>' + fmt(nat) + '</td></tr>';
  };
  var table = '<div class="rp-figure"><p class="rp-find">Vos indicateurs face à votre secteur</p><table class="rp-kpis"><thead><tr><th>Indicateur</th><th>Vous</th><th>Secteur</th><th>National</th></tr></thead><tbody>' +
    row('Indice de fréquence', 'Accidents pour 1 000 salariés', d.at.co, s.indice_frequence, n.indice_frequence, fmt1) +
    row('Journées d\'arrêt par accident', 'Durée moyenne de l\'incapacité temporaire', d.days ? d.days.co : null, perCase(s), perCase(n), fmt1) +
    row('Taux de gravité', 'Journées perdues pour 1 000 heures travaillées', null, s.taux_gravite, n.taux_gravite, fmt2) +
    row('Incapacités permanentes', 'Pour 100 accidents, des séquelles définitives', null, ipRate(s), ipRate(n), fmt1) +
    row('Décès', 'Pour 10 000 accidents', null, dcRate(s), dcRate(n), fmt1) +
    '</tbody></table></div>';
  if (isWorse(ipRate(s), ipRate(n))) noteGap('Les incapacités permanentes', ipRate(s) / ipRate(n), { label: 'Pour 100 accidents', a: ipRate(s), b: ipRate(n), unit: '' });
  var perAcc = accidentCost(d);
  var every = d.accidents > 0 ? Math.max(1, Math.round(220 / d.accidents)) : null;
  var html = '<div class="rp-grid-casc">' + cascadeFig(s) + meaning([
      'C\'est à la ' + kw('dat', 'déclaration') + ' que le dossier se construit. L\'employeur déclare dans les 48 heures et peut motiver des réserves sur les circonstances. ' +
        (v.reserves === 'oui' ? 'Vous indiquez en motiver quand les faits le justifient.' : v.reserves === 'non' ? 'Sans réserves, chaque accident reconnu entre dans votre taux tel qu\'il a été déclaré.' : v.reserves === 'nsp' ? 'Savoir si des réserves sont émises chez vous est un premier point simple à vérifier.' : '')
    ]) + '</div>' + table + guideOf(T.refus, d);
  var hero = heroFigs([
    every ? [every + ' jours', 'ouvrés en moyenne entre deux accidents chez vous'] : null,
    perAcc ? [fmtEur(perAcc), 'de cotisations par accident de plus, sur trois taux'] : null
  ]);
  return [{ id: 'refus', title: 'Chaque accident,|de sa gravité à sa déclaration', html: html, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Chaque accident, de sa gravité à sa déclaration' }];
}

// Comment l'accident survient : les causes, ce qui a dérapé, l'agent matériel, et une piste de
// prévention par grande cause. Puis la silhouette, ce que faisait la victime et comment elle
// s'est blessée. Chaque grande cause devient une piste à inscrire au document unique.
function atMecanismes(v, d, T) {
  var causes = causeRows(d.entry, nationalCauses('at', 'at_1er_reglement'));
  var fa = d.src && d.src.ficheAt;
  var dev = fa ? ficheShares('at', 'deviation')(fa).slice(0, 4) : [];
  var agent = fa ? ficheShares('at', 'agent_materiel_de_la_deviation')(fa).slice(0, 4) : [];
  var dims = Object.assign({ nat: nationalExtra() }, d.extra || {});
  var activite = keyedBars('activite_physique', DIMENSION_LABELS.activite)(dims).slice(0, 4);
  var modalite = keyedBars('modalite_blessure', DIMENSION_LABELS.modalite)(dims).slice(0, 4);
  var body = siegeFigure((d.extra || {}).siege_lesions, 'Siège des lésions dans votre secteur');
  var top = causes.filter(function(c) { return c.pct >= 10 && CAUSE_LEVERS[c.key]; }).slice(0, 3);
  // Trois graphiques en pleine largeur, une seule légende sous le dernier.
  var page1 = shareFig(causes.slice(0, 5), 'Les causes des accidents du secteur, en % de ceux dont la cause est connue', null, { noLegend: true }) +
    shareFig(dev, 'Ce qui a dérapé', null, { wide: true, noLegend: true }) + shareFig(agent, 'L\'agent matériel en cause', null, { wide: true }) +
    (top.length ? '<h3 class="rp-h3">Ce que cela veut dire pour vous</h3><div class="rp-levers">' + top.map(function(c) {
      return '<div><strong>' + c.label + ', ' + Math.round(c.pct) + ' %</strong><p>' + CAUSE_LEVERS[c.key] + '</p></div>';
    }).join('') + '</div>' + punch('Les protections collectives passent avant les équipements individuels. Chaque piste retenue s\'inscrit dans votre ' + kw('duerp', 'document unique') + ', daté et suivi.') : '');
  var page2 = (body ? cols('<div class="rp-fig"><p class="rp-find">Où se situe la lésion</p><p class="rp-why">Part des accidents du secteur, par partie du corps.</p>' + body + '</div>',
        shareFig(activite, 'Ce que faisait la victime') + shareFig(modalite, 'Comment la blessure est survenue'))
      : cols(shareFig(activite, 'Ce que faisait la victime'), shareFig(modalite, 'Comment la blessure est survenue')));
  page2 += meaning([
    'Les presqu\'accidents annoncent ces accidents avant qu\'ils n\'arrivent, et les recenser par cause permet d\'agir avant eux.',
    'Ces causes et ces lésions sont la matière de votre document unique' + (d.effectif >= 11 ? ', à mettre à jour chaque année à partir de 11 salariés' : '') + (d.effectif >= 50 ? ', avec son programme annuel de prévention à partir de 50' : '') + '.'
  ]);
  page2 += guideOf(T.prevention, d);
  return [
    { id: 'prevention', title: 'Comment|l\'accident survient', html: page1, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Comment l\'accident survient' },
    { id: 'at-lesions', title: 'Les lésions|et les gestes en cause', html: page2, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Les lésions et les gestes en cause', fill: ['webinaire-prevention', 'article-declaration', 'barometre-absenteisme', 'guide-arrets'] }
  ];
}

// Qui est touché : trois repères en tête, le sexe et l'âge des victimes, et la fréquence par taille
// d'établissement, la tranche de l'entreprise mise en avant.
function atPopulation(v, d) {
  var demo = (d.entry && d.entry.demographics) || {}, natDemo = nationalDemographics('at') || {};
  var sex = demoShares(demo.sex, natDemo.sex, SEX_GROUPS), age = demoShares(demo.age, natDemo.age, AGE_GROUPS);
  var young = age.filter(function(a) { return /Moins de 20|20 à 24|25 à 29/.test(a.label); }).reduce(function(s, a) { return s + (a.pct || 0); }, 0);
  var youngNat = age.filter(function(a) { return /Moins de 20|20 à 24|25 à 29/.test(a.label); }).reduce(function(s, a) { return s + (a.nat || 0); }, 0);
  var topSex = sex.filter(function(r) { return r.pct != null; }).sort(function(a, b) { return b.pct - a.pct; })[0];
  var hero = heroFigs([
    topSex ? [Math.round(topSex.pct) + ' %', 'des sinistres du secteur touchent des ' + (/homme/i.test(topSex.label) ? 'hommes' : 'femmes') + (topSex.nat != null ? ', contre ' + Math.round(topSex.nat) + ' % au national' : '')] : null,
    young > 0 ? [Math.round(young) + ' %', 'touchent des moins de 30 ans, contre ' + Math.round(youngNat) + ' % au national'] : null
  ]);
  // Le sexe prend la hauteur de l'âge, ses deux barres plus épaisses, comme dans l'outil.
  var ageRows = age.filter(function(r) { return r.pct != null; }).length;
  var size = sizeBlock(d);
  var html = cols(shareFig(sex, 'Selon le sexe de la victime', null, { rows: ageRows, thick: 'fill' }), shareFig(age, 'Selon l\'âge de la victime')) +
    size.html + meaning([size.txt,
      young > 0 ? (isWorse(young, youngNat) ? 'L\'accueil des nouveaux et des jeunes, les premières semaines au poste, est un levier direct.' : 'Les plus anciens pèsent davantage, leurs arrêts sont aussi les plus longs.') : null]);
  return [{ id: 'at-population', title: 'Qui est|touché dans votre secteur', html: html, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Qui est touché' }];
}

// Les arrêts : vos jours par accident face au secteur, les jours par sinistre selon la lésion et
// l'agent matériel, puis ce que la durée change au coût imputé, et les indemnités à suivre.
function atArrets(v, d, T) {
  var fa = d.src && d.src.ficheAt;
  var nature = fa ? ficheDays('at', 'nature_des_lesions')(fa).slice(0, 5) : [];
  var ages = fa ? ficheDays('at', 'age_de_la_victime', true)(fa) : [];
  var agent = fa ? ficheDays('at', 'agent_materiel_de_la_deviation')(fa).slice(0, 5) : [];
  var bar = baremeFor(d.sector);
  var s = d.stats, secDays = s.at_1er_reglement ? s.journees_it / s.at_1er_reglement : null;
  var natStats = getData('at').meta.national, natDays = natStats.at_1er_reglement ? natStats.journees_it / natStats.at_1er_reglement : null;
  var ijNote = v.ijRecup === 'oui' ? 'Vous indiquez rapprocher déjà les IJ avancées et remboursées.' : v.ijRecup ? 'Le rapprochement des IJ avancées et remboursées n\'est pas en place, ou pas vérifié.' : null;
  // Les âges se lisent en une phrase : la tranche qui s'arrête le plus longtemps.
  var oldest = ages.filter(function(r) { return r.value > 0 && r.nat; }).sort(function(a, b) { return b.value - a.value; })[0];
  var hero = d.days && secDays ? vsHero(fmt1(d.days.co), 'jours d\'arrêt par accident, votre entreprise', fmt1(secDays), 'dans votre secteur' + (natDays ? ', ' + fmt1(natDays) + ' en France entière' : ''), d.days.co / secDays) : '';
  // Le siège des lésions en jours sur la silhouette et les âges, les deux autres dimensions des
  // arrêts que l'outil dessine.
  var siege = fa ? siegeDays('at')(fa) : [], sDays = {}, sWorse = {};
  siege.forEach(function(r) { sDays[r.key] = r.value; if (isWorse(r.value, r.nat)) sWorse[r.key] = true; });
  var siegeFig = siege.length >= 2 ? '<div class="rp-fig"><p class="rp-find">Selon le siège des lésions</p><p class="rp-why">Journées d\'arrêt par sinistre, en rouge au-dessus du national.</p>' + daysFigure(sDays, 'Journées d\'arrêt par siège des lésions', sWorse) + '</div>' : '';
  var page1 = cols(daysFig(nature, 'Selon la nature des lésions'), daysFig(agent, 'Selon l\'agent matériel')) +
    cols(siegeFig, daysFig(ages, 'Selon l\'âge de la victime')) +
    (oldest ? '<p class="rp-p rp-note-line">Dans votre secteur, un salarié accidenté ' + (/^de /.test(oldest.label.toLowerCase()) ? '' : 'de ') + esc(oldest.label.toLowerCase()) + ' s\'arrête ' + frNum(oldest.value) + ' jours, contre ' + frNum(oldest.nat) + ' au national.</p>' : '');
  var labels = ['3 j et moins', '4 à 15 j', '16 à 45 j', '46 à 90 j', '91 à 150 j', 'plus de 150 j'];
  var threshold = bar ? '<div class="rp-figure"><p class="rp-find">Le coût imputé passe de ' + fmtEur(bar.it3) + ' à ' + fmtEur(bar.it4) + ' au-delà de 45 jours</p>' +
      '<p class="rp-why">Coût moyen imputé à votre compte selon la durée de l\'arrêt, comité technique ' + ctnForNaf(d.sector) + '.</p>' +
      '<div class="rp-steps45">' + [bar.it1, bar.it2, bar.it3, bar.it4, bar.it5, bar.it6].map(function(x, i) {
        return '<div class="' + (i >= 3 ? 'is-long' : '') + '" style="--s:' + i + '"><strong>' + fmtEur(x) + '</strong><span>' + labels[i] + '</span></div>';
      }).join('') + '</div><p class="rp-steps45-k">Seuil de 45 jours</p></div>' : '';
  var facts = [
    '<div><strong>' + frNum(v.joursArret != null ? v.joursArret : d.accidents) + '</strong><p>' +
      (v.joursArret != null ? 'jours d\'arrêt sur l\'année, autant de jours d\'' : (d.accidents > 1 ? 'accidents avec arrêt, chacun ouvre des jours d\'' : 'accident avec arrêt, qui ouvre des jours d\'')) +
      kw(v.ijRecup === 'oui' ? 'ijss' : 'ij', 'indemnités journalières') + ' à rapprocher de ce que la caisse verse.' + (ijNote ? ' ' + ijNote : '') + '</p></div>',
    v.arrets45 > 0 ? '<div class="is-worse"><strong>' + frNum(v.arrets45) + '</strong><p>' + (v.arrets45 > 1 ? 'de vos accidents ont' : 'de vos accidents a') + ' dépassé 45 jours d\'arrêt, le seuil où le coût imputé change de palier. Un ' + kw('arrets', 'suivi des arrêts longs') + ' et une reprise préparée y ont le plus d\'effet.</p></div>'
      : v.suivi45 === 'non' ? '<div><p>Les arrêts de plus de 45 jours ne sont pas suivis chez vous. C\'est le seuil où le coût imputé change de palier.</p></div>' : ''
  ];
  var page2 = threshold + '<div class="rp-facts">' + facts.join('') + '</div>' +
    guideOf(T.arrets, d, ASSISTANT_ECARTS.followups['collecte-arrets'].text[0]);
  return [
    { id: 'arrets', title: 'Combien de jours|coûte chaque accident', html: page1, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Combien de jours coûte chaque accident' },
    { id: 'arrets-2', title: 'Les arrêts|et les indemnités journalières', html: page2, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Les arrêts et les indemnités journalières' }
  ];
}

// Dix ans de causes, puis l'encadré du trajet, qui ferme la partie des accidents. Les trois
// premières causes du secteur sur dix ans, en parts des accidents dont la cause est connue. Le
// trajet reste hors de la valeur du risque : la majoration forfaitaire M1 le couvre pour toutes
// les entreprises, il pèse sur les absences et les IJ, pas sur le taux.
function nationalTrajetCauses(sub) {
  return memo('trajet-' + sub, function() {
    var store = (getData('trajet') || {}).by_naf5 || {}, sum = {}, tot = 0;
    Object.keys(store).forEach(function(c) {
      var e = store[c], n = (e.stats || {}).trajet_count || 0, rc = (e.trajet_causes || {})[sub] || {};
      if (!n) return;
      Object.keys(rc).forEach(function(k) { if (rc[k] != null) sum[k] = (sum[k] || 0) + rc[k] * n; });
      tot += n;
    });
    var out = {};
    Object.keys(sum).forEach(function(k) { out[k] = tot ? Math.round(sum[k] / tot * 1000) / 10 : 0; });
    return out;
  });
}
// Dix ans d'évolution, la grille de l'outil (js/history.js) : la fréquence, les jours d'arrêt par
// sinistre, les incapacités permanentes et les décès, puis les quatre premières causes (AT) ou les
// groupes de maladies (MP, en nombres de cas), chaque courbe nommée à son bout, en rouge une
// cause ou un groupe dont la part dépasse le national la dernière année.
var GROUP_SHORT = { 'Troubles musculosquelettiques': 'TMS', 'Maladies professionnelles hors tableau': 'Hors tableau',
  'Autres tableaux de maladies professionnelles': 'Autres tableaux', 'Pathologies liées à l\'amiante': 'Amiante' };
function decadeFigs(hist, code, mp) {
  var y = hist.meta.years, h = hist.h, nat = hist.national, last = y.length - 1, figs = [], notes = {};
  var perCase = function(o) { return o.j.map(function(x, i) { return x != null && o.n[i] ? Math.round(x / o.n[i]) : null; }); };
  var since = ' depuis ' + y[0], none = ' publié pour votre secteur' + since + '.';
  var draw = function(ok, html, topic, text) { figs.push(ok ? html : noDataFig(topic, text, 7)); };
  if (h['if']) draw(published(h['if']), fig(null, 'Indice de fréquence' + since, { type: 'decade', aria: 'Indice de fréquence du secteur et du national', years: y, fmt: mp ? '1' : 'int',
    series: [{ label: code, data: h['if'], tone: 'part' }, { label: 'National', data: nat['if'], tone: 'nat' }] }, 7),
    'Indice de fréquence' + since, (mp ? 'Aucune maladie professionnelle' : 'Aucun accident avec arrêt') + none);
  if (h.j && h.n) {
    var dSec = perCase(h), dNat = perCase(nat);
    notes.days = { from: dSec[0], to: dSec[last], natFrom: dNat[0], natTo: dNat[last] };
    draw(published(dSec), fig(null, 'Journées d\'arrêt par ' + (mp ? 'maladie' : 'sinistre') + since, { type: 'decade', aria: 'Journées d\'arrêt par ' + (mp ? 'maladie' : 'sinistre'), years: y, fmt: 'int', unit: ' j',
      series: [{ label: code, data: dSec, tone: 'part' }, { label: 'National', data: dNat, tone: 'nat' }] }, 7),
      'Journées d\'arrêt par ' + (mp ? 'maladie' : 'sinistre') + since, 'Aucune journée d\'arrêt publiée pour votre secteur' + since + '.');
  }
  if (h.ip) {
    var ipTopic = h.dc ? 'Incapacités permanentes et décès' : 'Nouvelles incapacités permanentes';
    draw(published(h.ip) || published(h.dc), fig(null, ipTopic, { type: 'ipdc', aria: 'Incapacités permanentes et décès du secteur', years: y, ip: h.ip, dc: h.dc || null }, 7),
      ipTopic, (h.dc ? 'Aucune incapacité permanente ni aucun décès publiés' : 'Aucune incapacité permanente publiée') + ' pour votre secteur' + since + '.');
    var firstDc = h.dc ? h.dc.findIndex(function(x) { return x != null; }) : -1;
    if (firstDc > 0) notes.dcSince = y[firstDc];
  }
  // Les causes sont des parts, les groupes des nombres de cas : l'écart au national se lit en part
  // des sinistres de la dernière année.
  var block = (mp ? h.groupes : h.causes) || {}, natBlock = (mp ? nat.groupes : nat.causes) || {};
  var share = function(v, o) { return v == null ? null : mp ? (o.n[last] ? v / o.n[last] * 100 : null) : v * 100; };
  var top = Object.keys(block).filter(function(k) { return block[k][last] > 0; }).sort(function(a, b) { return block[b][last] - block[a][last]; }).slice(0, 4);
  if (top.length >= 2) {
    var val = function(x) { return x == null ? null : mp ? x : Math.round(x * 1000) / 10; };
    figs.push(fig(null, mp ? 'Maladies reconnues par groupe' : 'Principales causes, en % des sinistres dont la cause est connue',
      { type: 'decade', aria: mp ? 'Les maladies reconnues du secteur par groupe' : 'Les principales causes des accidents du secteur', years: y, fmt: mp ? 'int' : 'pct',
      series: top.map(function(k) {
        var label = GROUP_SHORT[k] || (k.length > 20 ? k.slice(0, 19) + '…' : k);
        return { label: label, data: block[k].map(val), tone: natBlock[k] && isWorse(share(block[k][last], h), share(natBlock[k][last], nat)) ? 'worse' : 'part' };
      }) }, 7));
    notes.top = { label: GROUP_SHORT[top[0]] || top[0], from: val(block[top[0]].find(function(x) { return x != null; })), to: val(block[top[0]][last]) };
  }
  return { figs: figs, notes: notes };
}
// La page des dix ans d'une partie, ses trois chiffres en tête et ce qu'ils veulent dire.
function decadePage(hist, d, mp) {
  if (!hist || !hist.h['if']) return null;
  var y = hist.meta.years, last = y.length - 1, dec = decadeFigs(hist, d.sector, mp), f = dec.figs, nt = dec.notes;
  var evo = function(a) { return a[0] > 0 && a[last] != null ? Math.round((a[last] / a[0] - 1) * 100) : null; };
  var eSec = evo(hist.h['if']), eNat = evo(hist.national['if']), dn = nt.days;
  var signed = function(e) { return (e > 0 ? '+' : '−') + Math.abs(e) + ' %'; };
  var hero = heroFigs([
    eSec != null && eNat != null ? [signed(eSec), 'de fréquence ' + (mp ? 'des maladies ' : '') + 'pour votre secteur depuis ' + y[0] + ', ' + signed(eNat) + ' en France'] : null,
    dn && dn.to != null && dn.from != null ? [frNum(dn.to) + ' j', 'd\'arrêt par ' + (mp ? 'maladie' : 'sinistre') + ' en ' + y[last] + ' dans votre secteur, ' + frNum(dn.from) + ' en ' + y[0]] : null,
    nt.top ? (mp ? [frNum(nt.top.to), 'maladies reconnues du groupe « ' + esc(nt.top.label) + ' » en ' + y[last] + ', ' + frNum(nt.top.from) + ' en ' + y[0]]
      : [Math.round(nt.top.to) + ' %', 'des sinistres relèvent de « ' + esc(nt.top.label) + ' », ' + Math.round(nt.top.from) + ' % en ' + y[0]]) : null
  ]);
  var html = (f.length > 2 ? cols(f[0], f[1]) + cols(f[2], f[3]) : cols(f[0], f[1])) +
    '<p class="rp-legend"><span><i class="is-part"></i>Votre secteur</span><span><i class="is-tick is-dash"></i>France entière</span><span><i class="is-worse"></i>' + (mp ? 'Groupe' : 'Cause') + ' au-dessus du national en ' + y[last] + '</span>' +
      (nt.dcSince ? '<span>Décès publiés depuis ' + nt.dcSince + '</span>' : '') + '</p>' +
    meaning([
      eSec != null && eNat != null ? 'Depuis ' + y[0] + ', la fréquence ' + (mp ? 'des maladies professionnelles ' : '') + 'de votre secteur a ' + (eSec < 0 ? 'baissé' : 'augmenté') + ' de ' + Math.abs(eSec) + ' %, contre ' + Math.abs(eNat) + ' % ' + (eNat < 0 ? 'de baisse' : 'de hausse') + ' en France.' : null,
      dn && dn.to != null && dn.from != null ? 'Dans le même temps, ' + (mp ? 'une maladie y est passée' : 'un sinistre y est passé') + ' de ' + frNum(dn.from) + ' à ' + frNum(dn.to) + ' jours d\'arrêt, et de ' + frNum(dn.natFrom) + ' à ' + frNum(dn.natTo) + ' en France. Votre taux suit la durée des arrêts autant que leur nombre.' : null
    ]);
  return { id: mp ? 'mp-dix-ans' : 'at-dix-ans', title: 'Dix ans|d\'évolution', html: html, hero: hero,
    kicker: mp ? 'Partie 2, maladies professionnelles' : 'Partie 1, accidents du travail', part: mp ? 'mp' : 'at', toc: 'Dix ans d\'évolution',
    fill: mp ? ['guide-mp', 'guide-qrp'] : ['webinaire-prevention', 'article-taux', 'barometre-absenteisme', 'guide-arrets'] };
}
function atDixAns(v, d) {
  var out = [], dec = decadePage(d.src && d.src.histAt, d, false);
  if (dec) out.push(dec);
  // Le trajet, sa page à la fin de la partie : hors de la valeur du risque, la majoration
  // forfaitaire M1 le couvre pour toutes les entreprises, il pèse sur les absences et les IJ.
  var tr = getData('trajet'), te = resolveEntry(d.sector, 'trajet');
  var ts = te && te.entry.stats, tn = tr && tr.meta.national;
  if (ts && tn && ts.trajet_count > 0 && ts.indice_frequence != null) {
    var year = tr.meta.years[tr.meta.years.length - 1];
    var days = ts.journees_it / ts.trajet_count, natDays = tn.trajet_count ? tn.journees_it / tn.trajet_count : null;
    var m1 = d.est && d.est.masseSalariale > 0 ? MAJORATIONS.M1 * (1 + MAJORATIONS.M2) / 100 * d.est.masseSalariale : null;
    // Les causes et le véhicule en cause, comme la vue Trajet de l'outil, en parts déjà publiées.
    var trRows = function(sub) {
      var nat = nationalTrajetCauses(sub), rc = (te.entry.trajet_causes || {})[sub] || {};
      return Object.keys(rc).filter(function(k) { return rc[k] > 0 && !/^Autres/.test(k); })
        .map(function(k) { return { label: API_LABELS[k] || k, pct: Math.round(rc[k] * 1000) / 10, nat: nat[k] }; })
        .sort(function(a, b) { return b.pct - a.pct; }).slice(0, 4);
    };
    // Le trajet ne rejoint pas « L'essentiel », qui ne porte que les accidents du travail et les maladies.
    var n0 = NOTES.length;
    var causesTr = shareFig(trRows('causes'), 'Ce qui cause les accidents de trajet du secteur');
    var vehTr = shareFig(trRows('vehicules'), 'Le véhicule, quand le conducteur en perd le contrôle');
    NOTES.length = n0;
    var hTr = d.src && d.src.histTrajet, decTr = hTr && hTr.h['if'] ? decadeFigs(hTr, d.sector).figs.slice(0, 2) : [];
    var heroTr = heroFigs([[fmt1(ts.indice_frequence), 'accidents de trajet pour 1 000 salariés dans le secteur, ' + fmt1(tn.indice_frequence) + ' en France entière'],
      natDays ? [frNum(days) + ' j', 'd\'arrêt par accident de trajet dans le secteur, ' + frNum(natDays) + ' en France'] : null,
      m1 ? [fmtEur(m1), 'de votre cotisation annuelle couvrent le trajet, quel que soit le nombre de vos accidents'] : null]);
    var trajetHtml = cols(causesTr, vehTr) + (decTr.length ? cols(decTr[0], decTr[1]) : '') + meaning([
      'Entre le domicile et le travail, votre secteur compte ' + plural(ts.trajet_count, 'accident de trajet', 'accidents de trajet') + ' en ' + year + ', ' + fmt1(ts.indice_frequence) + ' pour 1 000 salariés contre ' + fmt1(tn.indice_frequence) + ' en France entière.',
      'Ils n\'entrent pas dans la valeur du risque de votre taux. Une majoration forfaitaire, la même pour toutes les entreprises, les couvre' + (m1 ? ', environ ' + fmtEur(m1) + ' de votre ' + kw('cotisations', 'cotisation') + ' par an.' : '.'),
      natDays ? 'Ils pèsent en revanche sur vos absences, ' + frNum(days) + ' jours d\'arrêt par accident de trajet dans votre secteur contre ' + frNum(natDays) + ' au national, autant de jours d\'' + kw('ij', 'indemnités journalières') + ' à suivre.' : null
    ]);
    out.push({ id: 'at-trajet', title: 'Les accidents|de trajet', html: trajetHtml, hero: heroTr, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Les accidents de trajet' });
  }
  return out;
}

// ── Partie 2, les maladies professionnelles ──
// Présente quand le secteur ou l'entreprise en compte. Par famille, les TMS d'abord, puis les
// maladies reconnues et leur tableau, psychiques et hors tableau, et la durée des arrêts.
function mpPart(v, d, T) {
  if (!T.mp || !d.mp || !d.mp.entry) return [];
  var entry = d.mp.entry, s = entry.stats || {};
  // Sans maladie reconnue dans le secteur, rien ne situe l'entreprise : pas de partie.
  if (!(s.mp_1er_reglement > 0)) return [];
  var fams = causeRows(entry, nationalCauses('mp', 'mp_1er_reglement'));
  var dims = Object.assign({ nat: nationalExtra() }, d.extra || {});
  var prof = keyedBars('mp_profession', DIMENSION_LABELS.profession)(dims).filter(function(r) { return r.label !== 'Non précisé'; }).slice(0, 5);
  var duree = keyedBars('mp_duree_exposition', DIMENSION_LABELS.duree, true)(dims).filter(function(r) { return r.label !== 'Non précisé'; });
  var diseases = ((d.extra || {}).mp_diseases || []).filter(function(r) { return r.nb > 0; }).slice(0, 5);
  var tms = entry.tms && entry.tms.nb_tms > 0 ? entry.tms : null;
  var fm = d.src && d.src.ficheMp;
  var daysDis = fm ? ficheDays('mp', 'maladie')(fm).slice(0, 5) : [];
  var tmsFam = fams.filter(function(f) { return /^TMS/.test(f.label); })[0];
  var hero = d.mp.co != null && d.mp.sec ? vsHero(fmt1(d.mp.co), 'maladies reconnues pour 1 000 salariés, votre entreprise' + (v.mp != null ? ', soit ' + frNum(v.mp) + ' sur l\'année' : ''),
      fmt1(d.mp.sec), 'dans votre secteur, ' + fmt1(d.mp.nat) + ' en moyenne nationale', d.mp.co / d.mp.sec) : '';
  var page1 = shareFig(fams, 'Les familles de maladies du secteur') +
    meaning([
      'Votre secteur compte ' + frNum(s.mp_1er_reglement || 0) + ' maladies professionnelles reconnues, ' + gap(d.mp.sec / d.mp.nat) + ' la moyenne nationale rapportée aux salariés.',
      (tmsFam ? 'Les troubles musculosquelettiques en font ' + Math.round(tmsFam.pct) + ' %.' : '') + (diseases.length ? ' La plus fréquente, « ' + esc(diseases[0].libelle) + ' », compte ' + frNum(diseases[0].nb) + ' cas.' : '')
    ]) +
    (diseases.length ? '<div class="rp-figure"><p class="rp-find">Les maladies reconnues dans votre secteur</p><table class="rp-roles rp-mptable"><thead><tr><th>Tableau</th><th>Maladie</th><th>Cas</th><th>Part</th><th>IP</th><th>Journées</th></tr></thead><tbody>' +
      diseases.map(function(r) { return '<tr><td>' + (/hors/i.test(r.code) ? '' : esc(r.code)) + '</td><td>' + esc(r.libelle) + '</td><td>' + frNum(r.nb) + '</td><td>' + Math.round(r.pct || 0) + ' %</td><td>' + frNum(r.ip || 0) + '</td><td>' + frNum(r.journees || 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '');
  var psy = psyYearBars(null, entry);
  var psyTotal = psy.reduce(function(t, r) { return t + r.value; }, 0);
  var psyFig = psyTotal > 0 ? fig(frNum(psyTotal) + ' maladie' + (psyTotal > 1 ? 's psychiques reconnues' : ' psychique reconnue') + ' depuis ' + psy[0].label, 'Chaque année dans votre secteur. Aucun tableau ne les couvre, elles sont reconnues au cas par cas.',
      { type: 'vbar', aria: 'Maladies psychiques reconnues par année', labels: psy.map(function(r) { return r.label; }), values: psy.map(function(r) { return r.value; }), you: -1, fmt: 'int' }, 4) : '';
  var longest = duree.filter(function(r) { return /10 ans/.test(r.label) && /plus/i.test(r.label); })[0];
  var page2 = cols(tms ? '<div class="rp-fig"><p class="rp-find">Les TMS, par partie du corps</p><p class="rp-why">' + frNum(tms.nb_tms) + ' TMS reconnus dans le secteur.</p>' + sharesFigure(tms.tous, 'TMS du secteur par partie du corps') + '</div>' : '',
      shareFig(duree, 'Durée d\'exposition avant la reconnaissance') + shareFig(prof, 'Profession de la victime'));
  var daysMp = daysFig(daysDis, 'Journées d\'arrêt par maladie, dans votre secteur');
  // Les maladies psychiques accompagnent les journées d'arrêt s'il y en a, sinon la réponse à la caisse.
  if (daysMp) page2 += psyFig;
  if (longest && longest.pct >= 30) page2 += '<p class="rp-p rp-note-line">' + Math.round(longest.pct) + ' % des maladies du secteur sont reconnues après plus de 10 ans d\'exposition. La réponse à la caisse s\'appuie sur ce que vous savez des postes, souvent sur de longues années.</p>';
  var hors = mpApiSentences(entry).filter(function(t) { return /hors tableaux/.test(t); })[0] || null;
  var page3 = (daysMp || psyFig) +
    '<div class="rp-facts">' + (hors ? '<div><p>' + hors + '</p></div>' : '') +
      '<div><strong>30 jours</strong><p>pour répondre au ' + kw('mp', 'questionnaire') + ' que la caisse vous adresse pour chaque maladie déclarée.</p></div></div>' +
    guideOf(T.mp, d, 'La réponse s\'appuie sur ce que vous savez des postes et des expositions, souvent sur de longues années. Un dossier documenté dès ce stade compte pour toute la suite de l\'instruction.');
  // Sans journées publiées pour ses maladies, le secteur n'a pas de page des arrêts : la réponse
  // à la caisse rejoint la page précédente.
  var mp3 = daysMp || psyFig ? [{ id: 'mp-3', title: daysMp ? 'Les arrêts,|et la réponse à la caisse' : 'Les maladies psychiques,|et la réponse à la caisse', html: page3, kicker: 'Partie 2, maladies professionnelles', part: 'mp', toc: daysMp ? 'Les arrêts, et la réponse à la caisse' : 'Les maladies psychiques, et la réponse à la caisse' }] : [];
  if (!mp3.length) page2 += page3;
  // La page qui montre les maladies psychiques propose d'abord le guide santé mentale.
  var psyFill = psyFig ? ['guide-sante-mentale'] : [];
  if (mp3.length) mp3[0].fill = (daysMp ? [] : psyFill).concat(['guide-qrp', 'guide-mp']);
  return [
    { id: 'mp', title: 'Les maladies professionnelles|de votre métier', html: page1, hero: hero, kicker: 'Partie 2, maladies professionnelles', part: 'mp', toc: 'Les maladies professionnelles de votre métier', fill: ['guide-mp', 'guide-qrp'] },
    { id: 'mp-2', title: 'Qui est touché,|et après combien de temps', html: page2, kicker: 'Partie 2, maladies professionnelles', part: 'mp', toc: 'Qui est touché, et après combien de temps',
      fill: (daysMp || !mp3.length ? psyFill : []).concat(['guide-qrp', 'guide-mp']) }
  ].concat(mp3, [decadePage(d.src && d.src.histMp, d, true)].filter(Boolean));
}

// Ce que les sinistres d'une année coûtent, avant toute comparaison. Leur valeur du risque (AT
// et MP, barème des coûts moyens) entre pour un tiers dans chacun des trois taux notifiés deux,
// trois et quatre ans plus tard, majorée de M2 et limitée à la part du taux qui suit la
// sinistralité de l'entreprise. Sous 20 salariés cette part est nulle : le coût passe par les
// arrêts, et le chapitre ouvre sur eux.
export function yearCostSplit(d, now) {
  if (!d.est || !(d.est.partIndividuelle > 0) || !(d.est.imputedCost > 0)) return null;
  var total = d.est.imputedCost * (1 + MAJORATIONS.M2) * d.est.partIndividuelle;
  var year = now.getFullYear() - 1;
  return { year: year, total: total, taux: [2, 3, 4].map(function(k) { return { year: year + k, cost: total / 3 }; }) };
}
// La phrase qui chiffre l'année, partagée par le premier écran du diagnostic et le rapport.
export function yearCostSentence(v, d, y) {
  var parts = [];
  if (d.accidents > 0) parts.push(d.accidents > 1 ? 'vos ' + frNum(d.accidents) + ' accidents avec arrêt' : 'votre accident avec arrêt');
  if (v.mp > 0) parts.push(v.mp > 1 ? 'vos ' + frNum(v.mp) + ' maladies professionnelles' : 'votre maladie professionnelle');
  var who = parts.join(' et ');
  var plural = d.accidents + (v.mp > 0 ? v.mp : 0) > 1;
  return who.charAt(0).toUpperCase() + who.slice(1) + ' de l\'année vous coût' + (plural ? 'ent' : 'e') + ' environ ' + fmtEur(y.total) + ' sur vos trois prochains taux';
}
function yearCost(v, d, now) {
  if (d.est.mode === 'collectif') {
    return '<p class="rp-lead">Vos accidents ne changent pas ce taux. Ils vous coûtent ' +
      (v.joursArret > 0 ? frNum(v.joursArret) + ' jours d\'arrêt sur l\'année' : 'des jours d\'arrêt') +
      ', des absences à remplacer et des indemnités journalières à suivre jusqu\'à leur versement.</p>';
  }
  var y = yearCostSplit(d, now);
  if (!y) return '';
  var years = y.taux.map(function(t) { return t.year; });
  return '<div class="rp-cost"><strong>' + fmtEur(y.total) + '</strong><p>Ce que ' + lowerFirst(yearCostSentence(v, d, y)).replace(/ environ (.*) sur/, ', environ, sur') + '.</p></div>' +
    '<div class="rp-cost-years">' + y.taux.map(function(t) { return '<div><span>Taux ' + t.year + '</span><strong>' + fmtEur(t.cost) + '</strong></div>'; }).join('') + '</div>' +
    '<p class="rp-small">Si ces chiffres sont ceux de ' + y.year + ', ils pèsent sur vos taux ' + years[0] + ', ' + years[1] + ' et ' + years[2] + ', environ ' + fmtEur(y.taux[0].cost) + ' dans chacun.</p>';
}

// ── Le taux et la cotisation, où les accidents et les maladies se rejoignent ──
function tauxChapter(v, d, T) {
  if (!d.est || !T.taux) return [];
  var mode = d.est.mode, collectif = mode === 'collectif', st = d.steps;
  var step = function(label, value, cls) { return '<div' + (cls ? ' class="' + cls + '"' : '') + '><span>' + label + '</span><strong>' + value + '</strong></div>'; };
  var steps = [
    collectif ? step('Valeur du risque à la sinistralité moyenne du secteur', fmtEur(d.est.imputedCostRef)) : step('Valeur du risque, coût moyen de vos sinistres', fmtEur(d.est.imputedCost)),
    step('Taux brut, puis majorations nationales', fmt2(st.brut) + ' % + ' + fmt2(st.net - st.brut) + ' %', 'is-small'),
    mode === 'mixte' ? step('Part du taux qui suit votre sinistralité', Math.round(d.est.partIndividuelle * 100) + ' %') : null,
    step(collectif ? 'Taux collectif estimé' : mode === 'mixte' ? 'Taux mixte estimé' : 'Taux net estimé', fmt2(d.est.tauxNet) + ' %'),
    step('Cotisation estimée', fmtEur(d.est.cotisation) + ' / an', 'is-total')
  ].filter(Boolean);
  var formation = '<div class="rp-figure rp-formation"><p class="rp-find">Comment se forme votre cotisation</p>' +
    '<div class="rp-formation-steps" style="--n:' + steps.length + '">' + steps.join('') + '</div>' +
    (!collectif && d.est.cotisationRef != null ? '<p class="rp-formation-ref"><span>À la sinistralité moyenne du secteur</span><strong>' + fmtEur(d.est.cotisationRef) + ' / an</strong></p>' : '') + '</div>';
  var above = v.tauxNotifie != null && !collectif && v.tauxNotifie > d.est.tauxNet * 1.15;
  var notified = v.tauxNotifie != null ? '<div class="rp-vs rp-vs-small"><div><strong>' + fmt2(v.tauxNotifie) + ' %</strong><span>taux notifié</span></div><span class="rp-vs-mid">VS</span><div><strong>' + fmt2(d.est.tauxNet) + ' %</strong><span>taux estimé</span></div></div>' : '';
  var html = yearCost(v, d, new Date()) + formation +
    '<div class="rp-grid-side">' + meaning([
      'Votre taux se calcule sur vos trois dernières années connues, il est notifié début janvier et peut être discuté dans les deux mois. ' + modeNote(d.est),
      v.tauxNotifie == null ? null : collectif ? 'Votre taux notifié est de ' + fmt2(v.tauxNotifie) + ' %, le taux collectif de votre activité, soit une cotisation réelle de ' + fmtEur(v.tauxNotifie / 100 * d.est.masseSalariale) + ' par an.'
        : above ? 'L\'écart entre le taux notifié et le taux estimé justifie de relire les sinistres imputés à votre ' + kw('cotisations', 'compte AT/MP') + '.' : null,
      collectif ? null : 'Reste à relire un par un les sinistres imputés à votre compte AT/MP, à chaque notification. C\'est ce que fait l\'échange de 30 minutes proposé à la fin de ce rapport.'
    ]) + notified + '</div>' + guideOf(T.taux, d, null);
  return [{ id: 'taux', cls: 'rp-taux-page', title: 'Votre taux|et votre cotisation', html: html, kicker: 'Partie 3, taux et cotisation', part: 'taux', toc: collectif ? 'Comment se forme votre cotisation' : 'Ce que vos accidents coûtent sur trois taux' }];
}

// Tous les chapitres, dans l'ordre des documents officiels : les accidents, puis les maladies,
// puis le taux où ils se rejoignent. Les thèmes (buildThemes) leur donnent statut, verdict,
// actions, offres et ressource, les mêmes que l'instantané et la feuille de route.
function buildChapters(v, d, themes) {
  NOTES = [];
  var T = {};
  themes.forEach(function(t) { T[t.id] = t; });
  PART = 'Accidents du travail';
  var pages = [].concat(atPosition(v, d), atGravite(v, d, T), atMecanismes(v, d, T), atPopulation(v, d), atArrets(v, d, T), atDixAns(v, d));
  PART = 'Maladies professionnelles';
  pages = pages.concat(mpPart(v, d, T));
  pages = pages.concat(tauxChapter(v, d, T));
  // Un chapitre dont aucune donnée n'est publiée pour le secteur ne garde que son titre : il disparaît.
  pages = pages.filter(function(pg) { return /<(canvas|svg|img|table)\b/.test(pg.html) || pg.html.replace(/<[^>]*>/g, '').trim(); });
  return { pages: pages, notes: NOTES.slice().sort(function(a, b) { return b.ratio - a.ratio; }) };
}

// ── Le rapport ──
// Les offres Ayming dans l'ordre du parcours, pour la page qui les présente.

function stepNum(n) { return '<span class="rp-num">' + n + '</span>'; }
function plural(n, one, many) { return frNum(n) + ' ' + (n > 1 ? many : one); }

// Les trois parties, dans l'ordre des documents officiels. Chacune ouvre sur un intercalaire en
// aplat de sa couleur, qui annonce ses chiffres et ses pages.
var PARTS = {
  at: { title: 'Vos accidents|du travail', label: 'Vos accidents du travail',
    lede: 'Votre position, la gravité, les causes, les victimes, les arrêts et le trajet, face aux statistiques de votre secteur.' },
  mp: { title: 'Vos maladies|professionnelles', label: 'Vos maladies professionnelles',
    lede: 'Les maladies reconnues dans votre métier, qui elles touchent, après combien d\'années, et ce qu\'elles coûtent en arrêts.' },
  taux: { title: 'Votre taux|et votre cotisation', label: 'Votre taux et votre cotisation',
    lede: 'Ce que les sinistres de l\'année coûtent sur vos trois prochains taux, et comment se forme votre cotisation.' },
  action: { title: 'Passer|à l\'action', label: 'Passer à l\'action',
    lede: 'Les actions à engager dans l\'ordre, les questions qu\'on vous posera, et ce qu\'Ayming peut faire avec vous.' }
};

// L'édito, le même dans chaque rapport : le problème, Ayming en guide, ce que le rapport donne.
// Aucun chiffre de secteur, il ne se personnalise pas.
// L'édito, le même dans chaque rapport : un constat national tiré des séries, à la manière des
// baromètres d'Ayming, que l'introduction ne reprend pas. Les chiffres viennent du fichier
// d'historique, l'édito les attend et se redessine avec le rapport.
function editoParas(hist) {
  var nat = hist && hist.national, y = hist && hist.meta.years;
  var perAcc = function(i) { return nat.n[i] ? nat.j[i] / nat.n[i] : null; };
  var last = y ? y.length - 1 : 0;
  var facts = nat && nat['if'] && nat['if'][0] && perAcc(0) && perAcc(last)
    ? 'Depuis ' + y[0] + ', la fréquence des accidents du travail a baissé de ' + Math.round((1 - nat['if'][last] / nat['if'][0]) * 100) + ' % en France, de ' + fmt1(nat['if'][0]) + ' à ' + fmt1(nat['if'][last]) +
      ' accidents pour 1 000 salariés. Sur la même période, un accident est passé de ' + frNum(perAcc(0)) + ' à ' + frNum(perAcc(last)) + ' jours d\'arrêt en moyenne.'
    : null;
  return [
    facts,
    '<strong>On pourrait s\'en satisfaire. Ce serait une erreur.</strong>',
    'Votre taux de cotisation suit la gravité autant que le nombre. Au-delà de 45 jours d\'arrêt, un accident change de palier dans le barème, et chaque sinistre pèse sur les trois taux qui suivent. Une entreprise peut avoir moins d\'accidents et payer davantage.',
    '<strong>La différence se joue dans les premiers jours.</strong>',
    'La déclaration, le suivi de l\'arrêt, la reprise préparée. Nos équipes suivent plus de 35 000 accidents du travail chaque année, et ce qu\'elles en retiennent tient en une phrase. Un dossier bien tenu dès le premier jour pèse moins lourd trois ans plus tard.',
    'Ce rapport vous donne le repère de votre métier, pour savoir où regarder.'
  ].filter(Boolean);
}

export function buildReport(v, d) {
  resetReportCharts();
  var c = v.contact || {};
  var now = new Date();
  var company = c.societe ? esc(c.societe) : 'Votre entreprise';
  var date = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  var themes = buildThemes(v, d, now);
  var main = themes;
  var chapters = buildChapters(v, d, themes);
  var actions = [];
  main.forEach(function(t) { t.actions.forEach(function(a) { actions.push(a); }); });
  actions.sort(function(a, b) { return (WHEN_ORDER[a.when] - WHEN_ORDER[b.when]) || (b.quick - a.quick); });
  var collectifMode = d.est && d.est.mode === 'collectif';
  // Les parties se numérotent dans l'ordre où elles sont là : un secteur sans maladie reconnue n'a
  // pas de partie 2, et le taux devient alors la partie 2.
  var partN = {};
  chapters.pages.concat([{ part: 'action' }]).forEach(function(pg) { if (pg.part && !partN[pg.part]) partN[pg.part] = Object.keys(partN).length + 1; });

  // Les pages sont d'abord décrites, puis numérotées : le sommaire et les intercalaires renvoient
  // à des pages qui ne sont connues qu'une fois toutes posées. Un contenu peut donc être une
  // fonction, appelée au rendu avec le numéro de sa page. opts.group range la page au sommaire.
  var specs = [];
  function add(id, title, inner, opts) { specs.push({ id: id, title: title, inner: inner, opts: opts || {} }); }
  function numOf(id) { for (var i = 0; i < specs.length; i++) if (specs[i].id === id) return i + 2; return null; }
  function inGroup(g) { return specs.filter(function(sp) { return sp.opts.group === g && sp.opts.toc; }); }
  function tocRow(sp) { return '<li><span>' + sp.opts.toc + '</span><span data-ref="' + sp.id + '">' + numOf(sp.id) + '</span></li>'; }

  // 2. L'édito, un panneau bleu nuit à gauche, signé.
  add('edito', null, function(n) {
    return '<section class="rp-page rp-edito">' +
      '<div class="rp-edito-panel">' +
        '<div class="rp-edito-logo"><img src="assets/ayming-logo.png" alt="Ayming"></div>' +
        '<h2>Édito</h2>' +
        '<p class="rp-edito-lead">Moins d\'accidents.<br>Des arrêts plus longs.</p>' +
        editoParas(d.src && d.src.histAt).map(function(t) { return '<p>' + t + '</p>'; }).join('') +
        '<p class="rp-edito-sign">L\'équipe Ayming</p>' +
        '<span class="rp-edito-n">' + n + '</span>' +
      '</div>' +
      '<div class="rp-edito-side"><span class="rp-edito-k">Propos introductifs</span><p>' + FOOT + '</p></div>' +
    '</section>';
  }, { raw: true, group: 'front', toc: 'Édito' });

  // 3. Introduction et méthodologie : le problème, le guide, puis d'où viennent les chiffres.
  var mpEntry = d.mp && d.mp.entry, secMp = mpEntry && mpEntry.stats ? mpEntry.stats.mp_1er_reglement : null;
  var answers = [plural(d.effectif, 'salarié', 'salariés'), plural(d.accidents, 'accident avec arrêt', 'accidents avec arrêt'),
    v.joursArret != null ? plural(v.joursArret, 'jour d\'arrêt', 'jours d\'arrêt') + (v.arrets45 > 0 ? ' dont ' + plural(v.arrets45, 'arrêt', 'arrêts') + ' de plus de 45 jours' : '') : null,
    v.mp != null ? plural(v.mp, 'maladie professionnelle', 'maladies professionnelles') : null,
    v.tauxNotifie != null ? 'un taux notifié de ' + fmt2(v.tauxNotifie) + ' %' : null].filter(Boolean);
  add('intro', 'Pourquoi tant d\'entreprises|subissent leur sinistralité',
    '<p class="rp-intro-lead">' + motifLead(v) + '</p>' +
    '<div class="rp-grid2 rp-intro-cols">' +
      '<p class="rp-p">Vous répondez de la santé de vos équipes et de ce qu\'elle coûte, mais le quotidien laisse peu de place au recul. Une déclaration d\'accident se fait dans l\'urgence, en 48 heures. Un questionnaire de maladie professionnelle arrive avec 30 jours pour répondre. En janvier, un taux arrive, calculé sur trois ans.</p>' +
      '<p class="rp-p">Chaque dossier traité dans l\'urgence coûte ainsi deux fois, une fois en absences et en désorganisation, une seconde fois dans votre taux, pendant trois ans. Ce rapport vous situe face à votre métier, avec les statistiques officielles de votre secteur, et relie chaque dossier à ce qu\'il vous coûte.</p>' +
    '</div>' +
    '<h3 class="rp-h3">Deux raisons expliquent qu\'une entreprise subisse sa sinistralité</h3>' +
    '<div class="rp-reasons">' +
      '<div>' + stepNum(1) + '<p>Elle n\'a pas de point de comparaison. Ses chiffres ne lui disent pas s\'ils sont hauts ou bas pour son métier.</p></div>' +
      '<div>' + stepNum(2) + '<p>Elle traite chaque dossier seul. C\'est pourtant leur somme, sur trois ans, qui fait la cotisation.</p></div>' +
    '</div>' +
    '<p class="rp-p rp-intro-guide">Ayming accompagne les équipes RH, paie et prévention sur chacun de ces dossiers, du terrain jusqu\'au taux.</p>' +
    '<div class="rp-proofs"><div><strong>35 000</strong><span>accidents du travail suivis chaque année pour nos clients</span></div>' +
      '<div><strong>250 000</strong><span>documents d\'arrêt collectés chaque année</span></div>' +
      '<div><strong>30 M€</strong><span>d\'indemnités journalières déclarées chaque année</span></div></div>' +
    '<div class="rp-navy rp-method"><h3>Méthodologie</h3><div class="rp-grid2">' +
      '<div><strong>Les chiffres de votre secteur</strong>Statistiques AT/MP 2024 de l\'Assurance Maladie pour le code NAF ' + esc(d.sector) + ', soit ' +
        plural(d.stats.at_1er_reglement || 0, 'accident avec arrêt', 'accidents avec arrêt') + (secMp ? ' et ' + plural(secMp, 'maladie professionnelle reconnue', 'maladies professionnelles reconnues') : '') + ' dans votre secteur.</div>' +
      '<div><strong>Vos réponses</strong>' + answers.join(', ') + '.</div>' +
    '</div></div>',
    { kicker: 'Introduction', ring: 'green', group: 'front', toc: 'Introduction et méthodologie' });

  // 4. Le sommaire, une barre de couleur par partie.
  add('sommaire', 'Sommaire', function() {
    var parts = ['at', 'mp', 'taux', 'action'].filter(function(k) { return numOf('part-' + k); });
    return '<p class="rp-toc-lead">Lisez-le dans l\'ordre, ou commencez par L\'essentiel, le rapport résumé en une page.</p>' +
      '<ol class="rp-toc">' + inGroup('front').map(tocRow).join('') + '</ol>' +
      parts.map(function(k) {
        return '<div class="rp-toc-part rp-part-' + k + '"><div class="rp-toc-head"><span>Partie ' + partN[k] + '</span><span data-ref="part-' + k + '">' + numOf('part-' + k) + '</span></div>' +
          '<strong>' + PARTS[k].label + '</strong><ol>' + inGroup(k).map(tocRow).join('') + '</ol></div>';
      }).join('') +
      '<ol class="rp-toc rp-toc-end">' + inGroup('end').map(tocRow).join('') + '</ol>';
  }, { kicker: 'Sommaire', ring: 'green', cls: 'rp-sommaire' });

  // L'économie possible dit ce qui la fait : une fréquence d'accidents basse peut cohabiter avec
  // des maladies professionnelles ou des arrêts plus coûteux que ceux du secteur.
  function savingDriver(d) {
    var e = d.est;
    var mpExcess = e.withMp && e.mpCostRef != null ? e.mpCost - e.mpCostRef : 0;
    var atExcess = e.atCostRef != null ? e.atCost - e.atCostRef : 0;
    if (mpExcess > atExcess) return 'par an environ, si vos maladies professionnelles rejoignaient la moyenne de votre secteur';
    if (d.at.ratio != null && d.at.ratio > 1.05) return 'par an environ, à la fréquence de votre secteur';
    return 'par an environ, si le coût de vos arrêts rejoignait la moyenne de votre secteur';
  }
  // 5. L'essentiel, la page que vous transmettez à votre direction
  var who = c.societe ? esc(c.societe) : 'l\'entreprise';
  var deWho = (/^[aeiouyhàâéèêîïôû]/i.test(who) ? 'd\'' : 'de ') + who;
  var perAcc = accidentCost(d);
  var tiles = [
    d.est ? ['Cotisation estimée', fmtEur(d.est.cotisation), 'par an, taux ' + (collectifMode ? 'collectif' : 'net') + ' estimé ' + fmt2(d.est.tauxNet) + ' %'] : null,
    collectifMode ? ['Taux', 'collectif', 'fixé pour le secteur, les accidents ne le modifient pas sous 20 salariés'] :
      (d.est && d.est.gap > d.est.cotisation * 0.02) ? ['Économie possible', fmtEur(d.est.gap), savingDriver(d)] :
      (d.est && d.est.gap != null ? ['Écart au secteur', fmtEur(Math.abs(d.est.gap)), d.est.gap < 0 ? 'par an d\'avance sur une entreprise moyenne' : d.est.gap > 0 ? 'par an de plus qu\'une entreprise moyenne' : 'par an, comme une entreprise moyenne'] : null),
    perAcc ? ['Un accident de plus', fmtEur(perAcc), 'de cotisations environ, sur les trois taux qui suivent'] : null
  ].filter(Boolean);
  var noteMax = function(n) { return Math.max(n.a, n.b) || 1; };
  add('essentiel', 'L\'essentiel,|en une page',
    '<p class="rp-p">' + (d.at.ratio != null
      ? 'Votre fréquence d\'accidents est ' + gap(d.at.ratio) + ' la moyenne de votre secteur' + (d.at.peer > 0 ? ', et ' + gap(d.at.co / d.at.peer) + ' celle des établissements de votre taille' : '')
      : 'Votre secteur ne compte aucun accident avec arrêt dans les dernières statistiques publiées, sa moyenne ne permet donc pas de situer votre fréquence') + '. Cette page résume le rapport, ce que cela coûte à ' + who + ' et ce qui ressort de votre secteur.</p>' +
    '<div class="rp-tiles rp-tiles-' + tiles.length + '">' + tiles.map(function(t) {
      return '<div class="rp-tile"><span class="rp-tile-k">' + t[0] + '</span><span class="rp-tile-n">' + t[1] + '</span><span class="rp-tile-l">' + t[2] + '</span></div>';
    }).join('') + '</div>' +
    (chapters.notes.length ? '<h3 class="rp-h3">Ce qui ressort de votre secteur</h3><div class="rp-notes">' +
      chapters.notes.slice(0, 5).map(function(n) {
        var u = n.unit === '%' ? ' %' : n.unit === 'j' ? ' j' : '';
        return '<div class="rp-note rp-part-' + n.part + '"><p><strong>' + n.head + '.</strong> ' + n.label + '</p><div class="rp-note-bars">' +
          '<div><i style="width:' + Math.round(n.a / noteMax(n) * 100) + '%"></i><b>' + fmtNote(n.a, n.unit) + u + '</b></div>' +
          '<div class="is-ref"><i style="width:' + Math.round(n.b / noteMax(n) * 100) + '%"></i><span>' + fmtNote(n.b, n.unit) + u + ' en France</span></div></div></div>';
      }).join('') + '</div><p class="rp-small">Votre secteur, comparé à la France entière.</p>' : '') +
    (collectifMode ? '<p class="rp-small">Sous 20 salariés, le taux est celui du secteur, et les accidents ' + deWho + ' ne le modifient pas. Ils coûtent en absences, et ils compteront dans le taux dès 20 salariés.</p>' : '') +
    '<p class="rp-small">Estimations établies avec le barème officiel des coûts moyens et les majorations nationales. Votre notification de taux fait foi.</p>',
    { kicker: 'Pour votre direction', ring: 'green', group: 'front', toc: 'L\'essentiel, pour votre direction', fill: ['article-taux', 'webinaire-prevention'] });

  // 6 à 19. Les trois parties, chacune derrière son intercalaire : les données du secteur
  // appliquées à l'entreprise, puis ce qu'elle peut faire.
  var partFigures = {
    action: function() {
      return [[String(actions.length), actions.length > 1 ? 'actions dans votre feuille de route' : 'action dans votre feuille de route'],
        [String(HUB_CARDS.length), 'offres Ayming, de la prévention à la cotisation'],
        ['30 min', collectifMode ? 'pour relire vos arrêts avec un consultant' : 'pour relire votre compte AT/MP avec un consultant']];
    },
    at: function() {
      var secDays = d.stats.at_1er_reglement ? d.stats.journees_it / d.stats.at_1er_reglement : null;
      var every = d.accidents > 0 ? Math.max(1, Math.round(220 / d.accidents)) : null;
      return [[fmt1(d.at.co), 'accidents avec arrêt pour 1 000 salariés, contre ' + fmt1(d.at.sec) + ' dans votre secteur'],
        [frNum(d.accidents), (d.accidents > 1 ? 'accidents reconnus' : 'accident reconnu') + ' avec arrêt sur l\'année' + (every ? ', un tous les ' + every + ' jours ouvrés' : '')],
        d.days && secDays ? [fmt1(d.days.co), 'jours d\'arrêt par accident, contre ' + fmt1(secDays) + ' dans votre secteur'] : null];
    },
    mp: function() {
      return [v.mp != null ? [frNum(v.mp), (v.mp > 1 ? 'maladies professionnelles reconnues' : 'maladie professionnelle reconnue') + ' chez vous sur l\'année'] : null,
        d.mp.co != null && d.mp.sec != null ? [fmt1(d.mp.co), 'maladies pour 1 000 salariés, contre ' + fmt1(d.mp.sec) + ' dans votre secteur'] : null,
        secMp ? [frNum(secMp), 'maladies reconnues dans votre secteur, ' + gap(d.mp.sec / d.mp.nat) + ' la moyenne nationale'] : null];
    },
    taux: function() {
      var y = collectifMode ? null : yearCostSplit(d, now), mode = d.est.mode;
      return [y ? [fmtEur(y.total), 'sur vos trois prochains taux, environ, pour les sinistres de l\'année'] : null,
        [fmtEur(d.est.cotisation), 'de cotisation AT/MP estimée par an'],
        [fmt2(d.est.tauxNet) + ' %', 'taux ' + (collectifMode ? 'collectif' : mode === 'mixte' ? 'mixte' : 'net') + ' estimé' + (v.tauxNotifie != null ? ', contre ' + fmt2(v.tauxNotifie) + ' % notifié' : '')]];
    }
  };
  function divider(k) {
    return function(n) {
      var p = PARTS[k], figs = partFigures[k]().filter(Boolean);
      return '<section class="rp-page rp-divider rp-part-' + k + '">' +
        '<div class="rp-head"><span class="rp-divider-logo"><img src="assets/ayming-logo.png" alt="Ayming"></span><span class="rp-divider-k">Partie ' + partN[k] + '</span></div>' +
        '<div class="rp-divider-title"><span>Partie ' + partN[k] + '</span><h2>' + p.title.replace('|', '<br>') + '</h2></div>' +
        '<p class="rp-divider-lede">' + p.lede + '</p>' +
        (figs.length ? '<div class="rp-divider-figs">' + figs.map(function(f) { return '<div><strong>' + f[0] + '</strong><span>' + f[1] + '</span></div>'; }).join('') + '</div>' : '') +
        '<div class="rp-divider-in"><span>Dans cette partie</span><ol' + (inGroup(k).length > 3 ? ' class="is-2col" style="grid-template-rows:repeat(' + Math.ceil(inGroup(k).length / 2) + ',auto)"' : '') + '>' +
          inGroup(k).map(function(sp) { return '<li><span>' + sp.opts.toc + '</span><i></i><b data-ref="' + sp.id + '">' + numOf(sp.id) + '</b></li>'; }).join('') + '</ol></div>' +
        '<div class="rp-foot"><span>' + FOOT + '</span><span class="rp-pn">' + n + '</span></div>' +
      '</section>';
    };
  }
  var seen = {};
  chapters.pages.forEach(function(pg) {
    if (pg.part && !seen[pg.part]) { seen[pg.part] = true; add('part-' + pg.part, null, divider(pg.part), { raw: true }); }
    add(pg.id, pg.title, pg.html, { toc: pg.toc, kicker: pg.kicker && pg.kicker.replace(/^Partie \d+/, 'Partie ' + partN[pg.part]), part: pg.part, group: pg.part, hero: pg.hero, cls: pg.cls, fill: pg.fill });
  });

  // 9. La feuille de route : toutes les actions, dans l'ordre où les engager
  var followUp = new Date(now.getFullYear(), now.getMonth() + 6, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  // Les actions groupées par échéance, chaque échéance sur sa pastille au dégradé sombre.
  var byWhen = [];
  actions.forEach(function(a) { var g = byWhen[byWhen.length - 1]; if (!g || g.label !== a.whenLabel) byWhen.push(g = { label: a.whenLabel, list: [] }); g.list.push(a); });
  add('part-action', null, divider('action'), { raw: true });
  add('feuille', 'Votre|feuille de route',
    '<p class="rp-p">Toutes les actions du diagnostic, dans l\'ordre où les engager. La dernière colonne indique où Ayming peut vous aider.</p>' +
    '<div class="rp-roadmap"><span class="rp-roadmap-h">Action</span><span class="rp-roadmap-h">Qui</span><span class="rp-roadmap-h">Ayming vous aide</span>' +
      byWhen.map(function(g) {
        return '<p class="rp-roadmap-when"><span>' + g.label + '</span></p>' + g.list.map(function(a) {
          return '<span>' + a.text + '</span><strong>' + a.owner.split(',')[0] + '</strong><span>' + (a.offer ? offerLink(a.offer) : '') + '</span>';
        }).join('');
      }).join('') + '</div>' +
    punch('Refaites ce diagnostic en ' + followUp + ', avec les chiffres de l\'année, pour mesurer l\'écart parcouru.'),
    { toc: 'Votre feuille de route', group: 'action', kicker: 'Passer à l\'action' });

  // 10. Les questions qu'on vous posera
  var qas = main.filter(function(t) { return t.objection; }).map(function(t) { return t.objection; }).concat([
    ['« Ces estimations sont-elles fiables ? »', 'Les montants reposent sur le barème officiel des coûts moyens et les majorations nationales, appliqués à vos chiffres. Le taux exact dépend de votre code risque et de vos trois dernières années. Votre notification et votre attestation font foi.'],
    ['« Nous avons déjà un expert-comptable et un avocat. »', 'Ils sécurisent vos comptes et vos litiges. Le suivi des accidents et des arrêts, dossier par dossier, est un autre travail, qui se mène avec eux. Quand une expertise juridique s\'impose, elle est confiée à un cabinet d\'avocats indépendants, choisi d\'un commun accord.'],
    ['« Pourquoi se faire aider sur ce travail ? »', 'Parce qu\'il demande du volume, des délais tenus et une expertise pointue, dossier après dossier. Ayming vous aide sur l\'exécution, votre équipe garde le pilotage et les décisions, et gagne le temps de s\'y consacrer.'],
    ['« Que deviennent les chiffres saisis ? »', 'Le calcul se fait dans votre navigateur et rien n\'est envoyé tant que vous ne demandez pas votre diagnostic. Pour ce document, vos coordonnées, votre secteur, vos chiffres et vos réponses ont été transmis à Ayming, qui vous recontacte à son sujet.']
  ]);
  add('questions', 'Les questions|qu\'on vous posera',
    '<p class="rp-intro-lead">On nous pose ces questions à presque chaque rendez-vous, que ce soit la direction, l\'expert-comptable ou les équipes. Voici ce que nous répondons.</p>' +
    '<div class="rp-qa">' + qas.map(function(q) { return '<div><h4>' + q[0] + '</h4><p>' + q[1] + '</p></div>'; }).join('') + '</div>',
    { toc: 'Les questions qu\'on vous posera', group: 'action', kicker: 'Passer à l\'action' });

  // 11. Comment Ayming vous accompagne : le parcours, une offre par étape
  add('ayming', 'Comment Ayming|peut vous aider',
    '<div class="rp-offers">' + HUB_CARDS.map(function(c) {
      return '<a class="rp-offer-card" href="' + offerHref(OFFERS[c[0]]) + '" target="_blank" rel="noopener">' +
        '<img src="assets/report/offres/' + c[0] + '.jpg" alt="">' +
        '<span class="rp-offer-body"><strong>' + c[2] + '</strong><span class="rp-offer-t">' + c[3] + '</span>' +
        '<span class="rp-offer-cta">Voir l\'offre</span></span></a>';
    }).join('') + '</div>',
    { toc: 'Comment Ayming peut vous aider', group: 'action', kicker: 'Passer à l\'action', cls: 'rp-offers-page' });

  // 12. Le rendez-vous, juste après les offres : ce que le rapport ne peut pas faire seul, relire
  // les sinistres du compte AT/MP un par un (GTM/market-research.yaml). Un bandeau bleu nuit, une
  // carte avec le bouton et son code QR, les trois étapes, puis les chiffres des consultants.
  add('rdv', null, function(n) {
    return '<section class="rp-page rp-rdv">' +
      '<header class="rp-rdv-band">' +
        '<span class="rp-divider-logo"><img src="assets/ayming-logo.png" alt="Ayming"></span>' +
        (collectifMode
          ? '<h2><span>Relisons ensemble</span><span>vos arrêts, en 30 minutes</span></h2>' +
            '<p>Ce rapport compare votre entreprise à son secteur. Sous 20 salariés, votre taux est celui du secteur, et vos accidents pèsent d\'abord sur vos arrêts et vos indemnités journalières. Un consultant Ayming reprend avec vous vos déclarations d\'accident, vos arrêts et vos IJ, et vous montre où agir en premier.</p>'
          : '<h2><span>Relisons ensemble</span><span>votre compte AT/MP, en 30 minutes</span></h2>' +
            '<p>Ce rapport compare votre entreprise à son secteur. Il ne voit pas vos accidents un par un, ils sont dans votre compte AT/MP sur ' + netEntreprisesLink('net-entreprises') + '. Un consultant Ayming l\'ouvre avec vous, chiffre ce que chaque sinistre pèse sur vos trois prochains taux et relève les points à vérifier.</p>') +
      '</header>' +
      '<div class="rp-rdv-card"><div><strong>Prenons rendez-vous</strong><p>Citez ce diagnostic, un consultant vous rappelle.</p>' +
        '<a class="rp-rdv-btn" href="' + CONTACT_URL + '&utm_content=rapport" target="_blank" rel="noopener">Prendre rendez-vous</a>' +
        '<p class="rp-rdv-url">www.ayming.fr/contactez-nous</p></div>' + qrSvg(CONTACT_URL + '&utm_content=rapport-qr') + '</div>' +
      '<div class="rp-body"><h3 class="rp-h3">Comment se passe la suite</h3><ol class="rp-timeline">' +
        '<li><span class="rp-num">1</span><p>Vous prenez rendez-vous sur ayming.fr, en citant ce diagnostic.</p></li>' +
        (collectifMode
          ? '<li><span class="rp-num">2</span><p>En 30 minutes, un consultant relit avec vous vos déclarations, vos arrêts et vos indemnités journalières.</p></li>'
          : '<li><span class="rp-num">2</span><p>En 30 minutes, un consultant relit avec vous votre compte AT/MP et chiffre ce que chaque sinistre pèse sur vos trois prochains taux.</p></li>') +
        '<li><span class="rp-num">3</span><p>Vous choisissez ce qu\'Ayming vous aide à mener.</p></li>' +
      '</ol><div class="rp-rdv-proofs"><span class="rp-todo-k">Ce que nos consultants suivent chaque année</span>' + PROOFS + '</div></div>' +
      foot(n) +
    '</section>';
  }, { raw: true, group: 'action', toc: 'Relisons ensemble votre compte AT/MP' });

  // 13. La postface, un mot de fin signé, repris des chiffres du rapport.
  var recap = [
    'Ce rapport a posé des chiffres sur votre sinistralité. ' + fmt1(d.at.co) + ' accidents pour 1 000 salariés quand votre secteur en compte ' + fmt1(d.at.sec) +
      (d.est ? ', une cotisation estimée à ' + fmtEur(d.est.cotisation) + ' par an' : '') + (perAcc ? ', et environ ' + fmtEur(perAcc) + ' de plus pour chaque accident, sur trois taux' : '') + '.',
    'Chacun de ces chiffres dépend de gestes précis. Un accident se prévient sur le terrain et se déclare dans les 48 heures. Un arrêt long se suit, une indemnité se rapproche, un taux se relit à chaque notification. Chacun de ces gestes pèse sur les trois années qui suivent.',
    'Commencez par la première action de votre feuille de route. Refaites ce diagnostic en ' + followUp + ', avec les chiffres de l\'année, pour mesurer l\'écart parcouru.'
  ];
  // Le modèle retenu : pas de bandeau, un grand panneau bleu nuit qui file jusqu'au bord droit, et
  // l'anneau en bas à gauche.
  add('postface', null, function(n) {
    return '<section class="rp-page rp-postface-page">' +
      '<div class="rp-head"><img src="assets/ayming-logo.png" alt="Ayming" class="rp-logo"></div>' +
      '<div class="rp-postface"><h2>Postface</h2><p class="rp-postface-sub">Ce que vous pouvez faire dès demain</p>' +
        recap.map(function(t) { return '<p>' + t + '</p>'; }).join('') + '<p class="rp-edito-sign">L\'équipe Ayming</p></div>' +
      foot(n) +
    '</section>';
  }, { raw: true, toc: 'Postface', group: 'end' });

  // 13. À lire et à revoir
  var res = [];
  main.forEach(function(t) { (RESOURCES[t.id] || []).forEach(function(r) { if (res.indexOf(r) < 0) res.push(r); }); });
  res = RESOURCES.all.concat(res).slice(0, 8).concat(RESOURCES.podcasts);
  add('ressources', 'À lire|et à revoir',
    '<p class="rp-p">Les guides, articles, webinaires et podcasts d\'Ayming sur les sujets de votre diagnostic, en accès libre. Scannez le code pour ouvrir chacun d\'eux.</p>' +
    '<div class="rp-res-grid">' + res.map(function(r) { return resourceCard(r, false, true); }).join('') + '</div>',
    { toc: 'À lire et à revoir', group: 'end', kicker: 'Pour aller plus loin' });

  // 14. Méthode et sources
  var GLOSSARY = [['Indice de fréquence', 'Accidents avec arrêt pour 1 000 salariés'], ['Journées par accident', 'Durée moyenne de l\'incapacité temporaire'],
    ['Taux de gravité', 'Journées perdues pour 1 000 heures travaillées'], ['Incapacités permanentes', 'Pour 100 accidents, des séquelles définitives'], ['Décès', 'Pour 10 000 accidents']];
  add('methode', 'Méthode|et sources',
    '<div class="rp-method-text">' +
    '<p class="rp-p"><strong>Les chiffres.</strong> Ceux de votre entreprise sont ceux que vous avez indiqués. Ceux du secteur et de la France entière sont les statistiques AT/MP 2024 de l\'Assurance Maladie, pour votre code NAF. Les répartitions sectorielles (causes, lésions, âges) décrivent votre secteur, jamais votre entreprise.</p>' +
    '<p class="rp-p"><strong>La fréquence.</strong> L\'indice de fréquence rapporte les accidents ayant donné lieu à un premier règlement à 1 000 salariés. La comparaison aux établissements de même taille dérive de la répartition des accidents et des salariés par taille d\'établissement publiée pour votre secteur.</p>' +
    (d.est ? '<p class="rp-p"><strong>La cotisation.</strong> Elle est estimée avec le barème des coûts moyens de votre comité technique (' + d.est.ctn + ') et les majorations ' + MAJORATIONS.year + '. La valeur du risque additionne, pour chaque sinistre, le coût moyen de son incapacité temporaire selon la durée de l\'arrêt, et celui d\'une incapacité permanente ou d\'un décès quand il y en a (article D242-6-6 du code de la sécurité sociale). La part individuelle du taux mixte suit l\'article D242-6-13. ' + BAREME_SOURCE + '</p>' : '') +
    '<p class="rp-p"><strong>Un accident de plus.</strong> C\'est un accident au profil moyen de votre secteur, multiplié par la majoration M2 et par la part de votre taux qui suit votre sinistralité. Le taux reposant sur trois années, ce coût se répartit sur trois taux.</p>' +
    '</div><div class="rp-figure"><p class="rp-find">Les indicateurs de ce rapport</p><dl class="rp-glossary">' +
      GLOSSARY.map(function(g) { return '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>'; }).join('') + '</dl></div>' +
    '<p class="rp-legal">Ce document est un diagnostic comparatif. Il ne constitue ni un audit, ni un conseil juridique.</p>',
    { toc: 'Méthode et sources', group: 'end', kicker: 'Diagnostic de sinistralité' });

  // Rendu : la couverture est la page 1, les autres suivent dans l'ordre des specs.
  var body = specs.map(function(sp, i) {
    var inner = typeof sp.inner === 'function' ? sp.inner(i + 2) : sp.inner;
    if (sp.opts.raw) return inner.replace('<section class="rp-page', '<section data-id="' + sp.id + '" class="rp-page');
    return page(i + 2, sp.title, inner, Object.assign({ id: sp.id }, sp.opts));
  }).join('');


  // La dernière page, une quatrième de couverture : la marque, l'entreprise, la date et la mention
  // qui borne le document, sous le même dégradé que la couverture, pris en miroir.
  var closing = '<section class="rp-page rp-back">' +
    '<div class="rp-back-art" aria-hidden="true"></div>' +
    '<div class="rp-back-body">' +
      '<img src="assets/ayming-logo.png" alt="Ayming" class="rp-back-logo">' +
      '<p class="rp-back-title">Rapport de sinistralité AT/MP</p>' +
      '<p class="rp-back-company">' + company + ', ' + date + '</p>' +
      '<a class="rp-back-url" href="https://www.ayming.fr/' + utm('dos-de-couverture') + '" target="_blank" rel="noopener">www.ayming.fr</a>' +
      '<p class="rp-back-note">Ce document est un diagnostic comparatif, établi à partir des chiffres que vous avez indiqués et des statistiques publiées pour votre secteur. Il ne constitue ni un audit, ni un conseil juridique.</p>' +
    '</div>' +
  '</section>';

  // 1. La couverture : la marque, le rapport, l'entreprise, puis le rapport éclaté de la page
  // d'accueil, rempli avec les chiffres de l'entreprise, sur une diagonale au dégradé de marque.
  var cover = '<section class="rp-page rp-cover">' +
    '<div class="rp-cover-top">' +
      '<img src="assets/ayming-logo.png" alt="Ayming" class="rp-cover-logo">' +
      '<p class="rp-cover-brand">Ayming</p>' +
      '<h1>Rapport de sinistralité AT/MP</h1>' +
      '<p class="rp-cover-for">Votre rapport personnalisé</p>' +
      '<p class="rp-cover-company">' + company + '</p>' +
      '<p class="rp-cover-meta">' + esc(d.sector) + ' · ' + esc(d.sectorLib) + ' · ' + frNum(d.effectif) + ' salariés · ' + date + '</p>' +
    '</div>' +
    '<div class="rp-cover-art" aria-hidden="true">' + coverStack(d, main) + '</div>' +
    '<p class="rp-cover-foot">' + (c.prenom ? 'Établi pour ' + esc(c.prenom) + ' ' + esc(c.nom) + ', à partir' : 'Établi à partir') +
      ' de vos réponses et des statistiques AT/MP 2024 de l\'Assurance Maladie.</p>' +
  '</section>';
  return cover + body + closing;
}

// Un chapitre ne montre que ce que ses données portent, si bien qu'un secteur peu documenté laisse
// des pages à moitié vides. Après le rendu, une page de chapitre marquée data-join rejoint la page
// précédente de la même partie quand les deux tiennent sur une A4, son titre devenu intertitre. Le
// sommaire, les intercalaires et les pieds de page sont ensuite renumérotés dans l'ordre final.
// Sur un écran étroit, la page n'a pas sa largeur A4 : la mesure ne vaudrait rien pour le PDF.
export function packPages(root) {
  var report = root.querySelector('#diag-report');
  var mm = 96 / 25.4, a4 = 297 * mm;
  var pages = report ? [].slice.call(report.querySelectorAll('.rp-page')) : [];
  if (!pages.length || pages[0].offsetWidth < 209 * mm) return;
  var prev = null;
  pages.forEach(function(pg) {
    var part = pg.getAttribute('data-part');
    if (prev && part && prev.getAttribute('data-part') === part && pg.hasAttribute('data-join')) {
      var from = pg.querySelector('.rp-body');
      var joined = document.createElement('div');
      joined.className = 'rp-joined';
      joined.setAttribute('data-id', pg.getAttribute('data-id'));
      var h = document.createElement('h3');
      h.className = 'rp-h3 rp-joined-h';
      h.textContent = pg.getAttribute('data-join');
      joined.appendChild(h);
      while (from.firstChild) joined.appendChild(from.firstChild);
      prev.querySelector('.rp-body').appendChild(joined);
      if (prev.offsetHeight <= a4 + 1) { pg.remove(); return; }
      while (joined.lastChild !== h) from.insertBefore(joined.lastChild, from.firstChild);
      joined.remove();
    }
    prev = part ? pg : null;
  });
  report.querySelectorAll('.rp-page[data-fill]').forEach(function(pg) { fillPage(pg, report, mm, a4); });
  var num = {};
  report.querySelectorAll('.rp-page').forEach(function(pg, i) {
    var n = i + 1;
    num[pg.getAttribute('data-id')] = n;
    pg.querySelectorAll('.rp-joined').forEach(function(j) { num[j.getAttribute('data-id')] = n; });
    pg.querySelectorAll('.rp-pn, .rp-edito-n').forEach(function(s) { s.textContent = n; });
  });
  report.querySelectorAll('[data-ref]').forEach(function(s) {
    var n = num[s.getAttribute('data-ref')];
    if (n) s.textContent = n;
  });
}

// Une page à moitié vide reçoit un encart « Pour aller plus loin » : le premier guide de sa liste
// absent du rapport, sinon le rendez-vous. Vide se mesure comme dans tests/report-check.cjs, du bas
// du dernier bloc au pied de page. L'encart ne reste que s'il tient dans la page.
function fillPage(pg, report, mm, a4) {
  var body = pg.querySelector('.rp-body'), last = body && body.lastElementChild, ft = pg.querySelector('.rp-foot');
  if (!last || !ft || (ft.getBoundingClientRect().top - last.getBoundingClientRect().bottom) / mm < FILL_MIN_MM) return;
  var pick = pg.getAttribute('data-fill').split(' ').map(function(k) { return FILL[k]; }).filter(function(r) {
    // La liste de fin « À lire et à revoir » récapitule : seul un doublon dans les pages compte.
    return r && !Array.prototype.some.call(report.querySelectorAll('a[href^="' + AYMING + r.path + '"]'), function(a) { return !a.closest('[data-id="ressources"]'); });
  })[0];
  var mp = /^mp/.test(pg.getAttribute('data-id')), tag = mp ? 'rapport-mp' : 'rapport-at';
  var box = document.createElement('div');
  box.className = 'rp-fill';
  box.innerHTML = '<span class="rp-block-k">Pour aller plus loin</span>' + (pick
    ? '<p class="rp-p">' + (FILL_LEAD[pick.kind] || 'La ressource') + ' d\'Ayming, en accès libre. Scannez le code pour l\'ouvrir.</p>' + resourceCard(pick, true, true)
    : '<a class="rp-res is-wide" href="' + CONTACT_URL + '&utm_content=' + tag + '" target="_blank" rel="noopener"><img src="assets/report/contact.jpg" alt="">' +
      '<span class="rp-res-body"><span class="rp-res-k">Rendez-vous</span><span class="rp-res-t">Échanger avec un consultant Ayming sur ' + (mp ? 'vos maladies professionnelles' : 'vos accidents du travail') + '</span></span>' +
      qrSvg(CONTACT_URL + '&utm_content=' + tag + '-qr') + '</a>');
  body.appendChild(box);
  if (pg.offsetHeight > a4 + 1) box.remove();
}

// Le rapport éclaté de la couverture, quatre feuillets comme sur la page d'accueil, écrits avec
// les chiffres et les thèmes de l'entreprise : la cotisation si elle est estimée, sinon la fréquence.
function coverStack(d, main) {
  var lib = d.sectorLib.length > 30 ? d.sectorLib.slice(0, 29).replace(/\s+\S*$/, '') + '…' : d.sectorLib;
  var band = d.est
    ? '<div class="l-big">' + fmtEur(d.est.cotisation) + '</div><div class="l-cap">cotisation AT/MP estimée par an</div>'
    : '<div class="l-big">' + fmt1(d.at.co) + '</div><div class="l-cap">accidents avec arrêt pour 1 000 salariés</div>';
  var rows = [['Votre secteur', d.at.sec], ['Même taille', d.at.peer], ['France entière', d.at.nat]].filter(function(r) { return r[1] != null; });
  return '<div class="rp-stack">' +
      '<div class="layer-shadow"></div>' +
      '<div class="layer navy" style="--i:0"><div class="l-kicker">Votre cotisation</div><div class="l-title">Ce que votre risque vous coûte</div><div class="l-ring"></div></div>' +
      '<div class="layer" style="--i:1"><div class="l-kicker">Où agir</div><div class="l-title">Thème par thème</div>' +
        main.slice(0, 5).map(function(t, i) { return '<div class="l-lever"><b>' + (i + 1) + '</b><span>' + t.short + '</span></div>'; }).join('') + '</div>' +
      '<div class="layer" style="--i:2"><div class="l-kicker">Votre position</div><div class="l-title">Face à votre secteur</div>' +
        '<div class="l-big">' + fmt1(d.at.co) + '</div><div class="l-cap">accidents avec arrêt pour 1 000 salariés</div>' +
        rows.map(function(r) { return '<div class="l-row"><span>' + r[0] + '</span><b>' + fmt1(r[1]) + '</b></div>'; }).join('') + '</div>' +
      '<div class="layer" style="--i:3"><div class="l-bar"></div><div class="l-kicker">Rapport personnalisé</div><div class="l-title">Rapport de sinistralité</div>' +
        '<span class="l-code">' + esc(d.sector) + ' · ' + esc(lib) + '</span>' +
        '<div class="l-cover-band">' + band + '</div></div>' +
    '</div>';
}

// ── Le message pour en parler en interne, à l'écran seulement ──
// Rédigé à la première personne, pour être envoyé par le lecteur et non par Ayming.
export function shareMessage(v, d, department, position) {
  var c = v.contact || {};
  var isHse = /hygi|sécurité|securite|hse|prévention|prevention/i.test(position || '');
  var to = department === 'Finance' ? 'la direction générale'
    : department === 'Executive Management' ? 'le responsable RH'
    : isHse ? 'la DRH et la direction financière' : 'la direction financière';
  var themes = buildThemes(v, d, new Date());
  var acts = [];
  themes.forEach(function(t) { (t.actions || []).forEach(function(a) { if (a.quick) acts.push(a); }); });
  acts.sort(function(a, b) { return WHEN_ORDER[a.when] - WHEN_ORDER[b.when]; });
  // Construit comme une demande qui obtient un oui : l'objectif de l'entreprise, la source et
  // pourquoi s'y fier, ce que dit le diagnostic, ce que cela coûte, ce que l'on en attend.
  var collectif = d.est && d.est.mode === 'collectif';
  var saving = d.est && !collectif && d.est.gap > d.est.cotisation * 0.02 ? d.est.gap : null;
  var lines = [
    'Objet : ' + (saving ? 'notre cotisation AT/MP, environ ' + fmtEur(saving) + ' par an en jeu' : 'notre sinistralité AT/MP face à notre secteur'),
    '',
    'Bonjour,',
    '',
    (d.est && !collectif
      ? 'Nos accidents du travail pèsent directement sur notre taux de cotisation AT/MP, donc sur nos charges. Pour voir où nous en sommes, j\'ai établi un diagnostic comparatif de notre sinistralité.'
      : 'Nos accidents du travail se traduisent en arrêts, en remplacements et en désorganisation. Pour voir où nous en sommes, j\'ai établi un diagnostic comparatif de notre sinistralité.'),
    '',
    'Il compare nos chiffres aux statistiques officielles de l\'Assurance Maladie pour notre secteur (' + d.sector + ', ' + d.sectorLib + '), qui couvrent les accidents déclarés par toutes les entreprises de ce secteur. En résumé :',
    d.at.ratio != null
      ? '- notre fréquence d\'accidents du travail est ' + gap(d.at.ratio) + ' la moyenne du secteur (' + fmt1(d.at.co) + ' contre ' + fmt1(d.at.sec) + ' pour 1 000 salariés)'
      : '- notre secteur ne compte aucun accident avec arrêt dans les statistiques publiées, nous en sommes à ' + fmt1(d.at.co) + ' pour 1 000 salariés'
  ];
  if (d.est) {
    lines.push('- notre cotisation AT/MP est estimée à ' + fmtEur(d.est.cotisation) + ' par an');
    if (collectif) lines.push('- notre taux est le taux collectif du secteur, nos accidents ne le modifient pas tant que nous restons sous 20 salariés');
    var per = accidentCost(d);
    if (per && !collectif) lines.push('- chaque accident avec arrêt supplémentaire ajoute environ ' + fmtEur(per) + ' de cotisations sur les trois prochains taux');
  }
  if (acts.length) {
    lines.push('', 'Commencer ne demande pas de budget. Je propose ' + (acts.length > 1 ? 'ces premières actions' : 'cette première action') + ' :');
    // Les actions sont rédigées pour le lecteur du guide ; dans le message, c'est l'entreprise qui parle.
    var ours = function(t) { return t.replace(/\bvotre\b/g, 'notre').replace(/\bvos\b/g, 'nos'); };
    acts.slice(0, 3).forEach(function(a) { lines.push('- ' + ours(a.text.charAt(0).toLowerCase() + a.text.slice(1)) + ', ' + a.whenLabel.toLowerCase()); });
  }
  lines.push('', saving
    ? 'Revenir à la moyenne de notre secteur réduirait notre cotisation d\'environ ' + fmtEur(saving) + ' par an, une fois ce niveau atteint sur les trois années qui servent au calcul de notre taux.'
    : 'L\'objectif est de réduire nos arrêts et de garder la main sur ce qui fait évoluer notre taux.');
  lines.push('', 'Le diagnostic complet est joint, sa page « L\'essentiel, pour votre direction » se lit en une minute. Pouvons-nous en parler cette semaine ?', '', (c.prenom ? c.prenom + ' ' + (c.nom || '') : '').trim());
  return { to: to, text: lines.join('\n') };
}
