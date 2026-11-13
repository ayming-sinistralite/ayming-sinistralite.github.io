// ── Le rapport : l'ossature d'une page ──
// Les motifs de visite, les échéances, les phrases des maladies, le pied de page et le cadre d'une page.

import { MOTIFS } from './report-constants.js?v=e9f97a8';
import { frNum, esc } from './utils.js?v=e9f97a8';
import { DATA_YEAR } from './state.js?v=e9f97a8';
import { OFFERS, offerLink } from './report-offers.js?v=e9f97a8';

// ── Échéances, relatives à la date du rapport ──
export function motifLead(v) {
  var m = MOTIFS.filter(function(x) { return x.key === v.motif; })[0];
  return m && m.lead ? m.lead : 'Si vous êtes en charge des ressources humaines, de la paie ou de la prévention, et que vous voulez agir sur la sinistralité de votre entreprise, ce rapport est fait pour vous.';
}

function nextNotificationYear(now) { return now.getMonth() === 0 && now.getDate() < 5 ? now.getFullYear() : now.getFullYear() + 1; }

export var WHEN_ORDER = { now: 0, m1: 1, jan: 2, m6: 3 };

export function whenLabel(w, now) {
  return w === 'now' ? 'Dès maintenant' : w === 'm1' ? 'Sous 30 jours' : w === 'jan' ? 'Janvier ' + nextNotificationYear(now) : 'Sous 6 mois';
}

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
    out.push(frNum(horsTotal) + ' maladie' + (horsTotal > 1 ? 's' : '') + ' hors tableaux' + (last ? ' en ' + last : '') + ', surtout «\u00A0' + esc(hors[0].libelle) + '\u00A0» (' + frNum(hors[0].nb) + ').');
  }
  return out;
}

// Des pistes de prévention pour chaque grande cause d'accident du secteur, en mots simples. Elles
// suivent l'ordre des principes de prévention (L4121-2 du code du travail) : agir à la source et
// protéger collectivement (EPC) avant d'équiper chacun (EPI), puis former.
export var CAUSE_LEVERS = {
  'Manutention manuelle': 'Équiper les postes d\'aides à la manutention adaptées à l\'activité, chariots, tables élévatrices ou lève-personnes, organiser le travail pour limiter les charges, et former aux gestes et postures.',
  'Chutes de hauteur': 'Sécuriser les accès en hauteur, quais, marchepieds, escabeaux et plateformes, protéger les zones par des garde-corps, puis former, avec un harnais quand la protection collective ne suffit pas.',
  'Chutes de plain-pied': 'Dégager, entretenir et éclairer les sols et les passages, signaler les zones glissantes, et choisir des chaussures adaptées à l\'activité.',
  'Outillage à main': 'Choisir des outils adaptés et bien entretenus, et fournir les protections adaptées à chaque tâche, comme des gants anti-coupure.',
  'Risque machines': 'Vérifier les protecteurs des machines, couper l\'énergie avant toute intervention, et former les opérateurs.',
  'Manutention mécanique': 'Séparer les piétons des engins là où le site le permet, et former et habiliter chaque conducteur.',
  'Autres véhicules': 'Organiser les circulations et les zones de manœuvre, et séparer piétons et véhicules là où c\'est possible.',
  'Risque routier': 'Organiser les trajets et les temps de conduite, entretenir les véhicules, et former à la conduite et aux situations à risque.',
  'Risque physique': 'Limiter l\'exposition au bruit, aux vibrations, à la chaleur et au froid, par le matériel, les horaires et les pauses, puis compléter par des équipements de protection adaptés.',
  'Risque chimique': 'Remplacer les produits dangereux quand c\'est possible, limiter l\'exposition par le dosage, la ventilation et le stockage, puis fournir des équipements de protection adaptés.',
  'Agressions': 'Organiser le contact avec le public et le travail isolé, et former les équipes aux situations difficiles.'
};

// ── Mise en page ──
// Chaque page ouvre sur un bandeau teinté : le logo, la pastille de la partie, le titre en deux
// temps (« Votre position|face à votre métier », une ligne légère puis une ligne grasse) et un
// anneau en haut à droite, vert pour l'ouverture et les maladies, bleu ailleurs. opts.part donne
// sa couleur à la page (at, mp), que les graphiques lisent aussi. opts.hero se pose dans le
// bandeau, sous le titre.
export var FOOT = 'Diagnostic comparatif établi à partir de vos réponses et des statistiques de l\'Assurance Maladie ' + DATA_YEAR;

function pageTitle(title) {
  var t = title.split('|');
  return t.length > 1 ? '<span class="rp-h-l">' + t[0] + '</span><span class="rp-h-b">' + t[1] + '</span>' : '<span class="rp-h-b">' + title + '</span>';
}

export function foot(n) { return '<div class="rp-foot"><span>' + FOOT + '</span><span class="rp-pn">' + n + '</span></div>'; }

export function page(n, title, inner, opts) {
  opts = opts || {};
  var ring = opts.ring || (opts.part === 'mp' ? 'green' : 'blue');
  // data-join : une page de chapitre sans chiffre d'ouverture peut rejoindre la précédente (packPages).
  var join = opts.part && !opts.hero && title ? ' data-part="' + opts.part + '" data-join="' + esc(title.replace('|', ' ')) + '"' : (opts.part ? ' data-part="' + opts.part + '"' : '');
  var fill = opts.fill ? ' data-fill="' + opts.fill.join(' ') + '"' : '';
  return '<section id="rp-' + opts.id + '" class="rp-page' + (opts.part ? ' rp-part-' + opts.part : '') + (opts.cls ? ' ' + opts.cls : '') + '" data-id="' + opts.id + '"' + join + fill + '>' +
    '<header class="rp-band rp-ring-' + ring + '">' +
      '<div class="rp-head"><img src="assets/ayming-logo.png" alt="Ayming" class="rp-logo"><span class="rp-pill">' + (opts.kicker || 'Diagnostic de sinistralité') + '</span></div>' +
      (title ? '<h2 class="rp-h">' + pageTitle(title) + '</h2>' : '') + (opts.hero || '') +
    '</header>' +
    '<div class="rp-body">' + inner + '</div>' + foot(n) +
  '</section>';
}

export function block(k, inner, cls) { return '<div class="rp-block' + (cls ? ' ' + cls : '') + '"><span class="rp-block-k">' + k + '</span>' + inner + '</div>'; }

// Une page de thème : le statut et le verdict d'abord, puis un court paragraphe qui dit pourquoi
// c'est important, écrit comme un rapport et non dans un encadré, votre
// situation, et le panneau bleu « Ce que vous pouvez faire » : vos actions, puis comment Ayming
// peut vous aider, une ligne par offre, puis la ressource.
// Une ligne par offre, une phrase simple qui dit ce qu'Ayming peut faire pour vous (« Nous vous
// fournissons », « Nous pouvons »), le nom de l'offre en lien au bout :
// trois puces sur deux colonnes prenaient une demi-page, le contenu doit rester le plus gros).
export function helpLine(k, d) { return '<li>' + OFFERS[k].line(d) + ' ' + offerLink(k) + '</li>'; }

// ── Le rapport ──
// Les offres Ayming dans l'ordre du parcours, pour la page qui les présente.

export function stepNum(n) { return '<span class="rp-num">' + n + '</span>'; }

export function plural(n, one, many) { return frNum(n) + ' ' + (n > 1 ? many : one); }
