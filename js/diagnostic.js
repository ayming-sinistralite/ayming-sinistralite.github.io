// ── Diagnostic personnalisé : parcours question par question, puis le rapport ──
// Le calculateur de « Mon entreprise » donne les quatre premiers chiffres. Ici, chaque
// écran pose une ou deux questions et rend aussitôt un éclairage, puis viennent les
// coordonnées et le rapport lui-même, dont l'impression produit le PDF.
// Les réponses vivent dans state.views.compare, partagé avec le calculateur.
// Les chiffres viennent tous de computeDiagnostic(), pour que l'écran et le PDF concordent.

import { state } from './state.js';
import { el } from './utils.js';
import { switchView } from './nav.js';
import { computeDiagnostic, parseCount, parseRate, ratioClass } from './compare.js';
import { MAJORATIONS, BAREME_SOURCE } from './cost-model.js';
import { sendLead, bindCompany, bindPosition, canonicalPosition, positionDepartment } from './lead.js';

function vs() { return state.views.compare; }

// ── Formatage ──
function frNum(n) { return Math.round(n).toLocaleString('fr-FR'); }
function fmt1(n) { return (n == null || isNaN(n)) ? '—' : n.toFixed(1).replace('.', ','); }
function fmt2(n) { return (n == null || isNaN(n)) ? '—' : n.toFixed(2).replace('.', ','); }
function pct(x) { return Math.round(x * 100) + ' %'; }
function fmtEur(n) {
  n = Math.round(n);
  if (n >= 1000000) return (Math.round(n / 100000) / 10).toLocaleString('fr-FR') + ' M€';
  if (n >= 10000) return frNum(n / 1000) + ' k€';
  return frNum(n) + ' €';
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function gap(ratio) {
  if (ratio == null) return '';
  var p = Math.round(Math.abs(ratio - 1) * 100);
  return ratio > 1.05 ? p + ' % au-dessus de' : ratio < 0.95 ? p + ' % en dessous de' : 'au niveau de';
}

// Les commerciaux en démonstration n'ont pas à saisir de coordonnées : ?demo dans l'URL.
function isDemo() { return /[?&]demo\b/.test(window.location.search); }

var AYMING = 'https://www.ayming.fr/ressources-humaines/';
function offerUrl(path, campaign) {
  return AYMING + path + '?utm_source=sinistralite&utm_medium=referral&utm_campaign=' + campaign;
}
var CONTACT_URL = 'https://www.ayming.fr/contactez-nous/?utm_source=sinistralite&utm_medium=referral&utm_campaign=diagnostic';

// ── Les écrans ──
var STEPS = ['start', 'arrets', 'mp', 'trajet', 'taux', 'pratiques', 'contact', 'report'];
var QUESTION_STEPS = 6;   // de « arrets » à « contact », ce que compte la barre de progression

export function renderDiagnostic() {
  var shell = el('diag-shell');
  if (!shell) return;
  var v = vs();
  var d = computeDiagnostic(v);
  if (!d) { shell.innerHTML = renderMissing(); return; }
  var step = STEPS[v.diagStep] || 'start';
  if (step === 'report' && !canSeeReport(v)) { v.diagStep = STEPS.indexOf('contact'); step = 'contact'; }

  var body = SCREENS[step](v, d);
  shell.innerHTML = (step === 'report' ? '' : progress(v.diagStep)) + body;
  bindScreen(step);
  if (window.lucide) window.lucide.createIcons();
  window.scrollTo(0, 0);
}

function progress(i) {
  if (i === 0) return '';
  var pctDone = Math.round(i / QUESTION_STEPS * 100);
  return '<div class="diag-progress" aria-label="Étape ' + i + ' sur ' + QUESTION_STEPS + '">' +
    '<div class="diag-progress-head"><span>Étape ' + i + ' sur ' + QUESTION_STEPS + '</span>' +
    '<button type="button" class="diag-link" data-diag-back-calc>Revenir au calcul</button></div>' +
    '<div class="diag-progress-track"><span style="width:' + pctDone + '%"></span></div></div>';
}

function renderMissing() {
  return '<div class="diag-card diag-center">' +
    '<h2 class="diag-title">Commencez par le calcul</h2>' +
    '<p class="diag-lead">Le diagnostic reprend votre secteur, votre effectif et vos accidents avec arrêt. Renseignez-les d\'abord dans « Mon entreprise ».</p>' +
    '<button type="button" class="bench-primary-btn" data-diag-back-calc>Faire le calcul</button>' +
  '</div>';
}

function nav(nextLabel, opts) {
  opts = opts || {};
  return '<div class="diag-nav">' +
    '<button type="button" class="diag-link" data-diag-prev>Retour</button>' +
    '<button type="button" class="bench-primary-btn" data-diag-next' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' + nextLabel + '</button>' +
  '</div>';
}

function field(id, label, value, opts) {
  opts = opts || {};
  return '<div class="bench-field">' +
    '<label for="' + id + '">' + label + '</label>' +
    '<input type="' + (opts.type || 'text') + '" id="' + id + '" inputmode="' + (opts.mode || 'numeric') + '"' +
      ' placeholder="' + (opts.placeholder || '') + '" autocomplete="' + (opts.autocomplete || 'off') + '"' +
      ' value="' + (value == null ? '' : esc(value)) + '"' + (opts.field ? ' data-field="' + opts.field + '"' : '') + '>' +
    (opts.hint ? '<span class="bench-field-hint">' + opts.hint + '</span>' : '') +
  '</div>';
}

// Un champ texte doublé d'une liste de suggestions (entreprise, fonction), branchée par bindScreen.
function pickerField(id, label, value, placeholder, autocomplete) {
  return '<div class="bench-field">' +
    '<label for="' + id + '">' + label + '</label>' +
    '<div class="diag-picker">' +
      '<input type="text" id="' + id + '" placeholder="' + placeholder + '" autocomplete="' + autocomplete + '"' +
        ' value="' + (value == null ? '' : esc(value)) + '">' +
      '<div class="autocomplete" id="' + id + '-ac"></div>' +
    '</div>' +
  '</div>';
}

function choice(key, label, options) {
  var cur = vs()[key];
  return '<div class="diag-choice"><p class="diag-choice-label">' + label + '</p><div class="diag-chips" role="group">' +
    options.map(function(o) {
      var on = cur === o[0];
      return '<button type="button" class="diag-chip' + (on ? ' active' : '') + '" aria-pressed="' + on + '" data-choice="' + key + '" data-value="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div></div>';
}

function screen(eyebrow, title, lead, inner) {
  return '<div class="diag-card">' +
    '<p class="diag-eyebrow">' + eyebrow + '</p>' +
    '<h2 class="diag-title">' + title + '</h2>' +
    (lead ? '<p class="diag-lead">' + lead + '</p>' : '') +
    inner + '</div>';
}

var SCREENS = {
  start: function(v, d) {
    var r = d.at.ratio;
    return '<div class="diag-card diag-center">' +
      '<span class="bench-chip-brand">Diagnostic de sinistralité personnalisé</span>' +
      '<h2 class="diag-title">Votre fréquence d\'accidents est ' + gap(r) + ' votre secteur</h2>' +
      '<div class="diag-kpis">' +
        kpi(fmt1(d.at.co), 'votre indice de fréquence') +
        kpi(fmt1(d.at.sec), 'celui de votre secteur') +
        (d.est ? kpi(fmtEur(d.est.cotisation), 'cotisation AT/MP estimée par an') : '') +
      '</div>' +
      '<p class="diag-lead">Six courtes étapes, environ deux minutes, pour construire votre diagnostic complet : durée des arrêts, maladies professionnelles, taux notifié et pratiques de prévention. Chaque réponse est facultative.</p>' +
      '<button type="button" class="bench-primary-btn" data-diag-next>Commencer</button>' +
      '<p class="diag-recap">' + esc(d.sector) + ' ' + esc(d.sectorLib) + ' · ' + frNum(d.effectif) + ' salariés · ' + frNum(d.accidents) + ' AT avec arrêt' +
        ' · <button type="button" class="diag-link" data-diag-back-calc>modifier</button></p>' +
    '</div>';
  },

  arrets: function(v) {
    return screen('Durée des arrêts', 'Combien de jours d\'arrêt ont entraîné vos accidents ?',
      'Au-delà de 45 jours, un arrêt change de catégorie de coût moyen et pèse davantage sur votre taux.',
      '<div class="bench-fields diag-fields">' +
        field('diag-jours', 'Jours d\'arrêt liés aux AT, sur l\'année', v.joursArret, { field: 'joursArret', placeholder: 'ex. 540' }) +
        field('diag-45', 'Dont accidents arrêtés plus de 45 jours', v.arrets45, { field: 'arrets45', placeholder: 'ex. 2' }) +
      '</div>' +
      '<p class="diag-where">Ces chiffres figurent dans votre paie ou sur votre compte AT/MP (net-entreprises.fr).</p>' +
      '<div class="diag-insight" id="diag-insight"></div>' + nav('Continuer'));
  },

  mp: function(v) {
    return screen('Maladies professionnelles', 'Combien de maladies professionnelles ont été reconnues ?',
      'Sur l\'année, pour votre entreprise.',
      '<div class="bench-fields diag-fields diag-fields-one">' +
        field('diag-mp', 'Maladies professionnelles reconnues', v.mp, { field: 'mp', placeholder: 'ex. 1' }) +
      '</div>' +
      '<button type="button" class="diag-chip" data-set="mp" data-set-value="0">Aucune</button>' +
      '<div class="diag-insight" id="diag-insight"></div>' + nav('Continuer'));
  },

  trajet: function(v) {
    return screen('Trajet et gravité', 'Et les accidents de trajet ?',
      'Ils n\'entrent pas dans votre taux, mais ils pèsent sur vos absences.',
      '<div class="bench-fields diag-fields">' +
        field('diag-trajet', 'Accidents de trajet', v.trajet, { field: 'trajet', placeholder: 'ex. 2' }) +
        field('diag-deces', 'Décès, s\'il y en a eu', v.deces, { field: 'deces', placeholder: 'ex. 0' }) +
      '</div>' +
      '<div class="diag-insight" id="diag-insight"></div>' + nav('Continuer'));
  },

  taux: function(v) {
    return screen('Votre taux', 'Connaissez-vous votre taux AT/MP notifié ?',
      'Il figure sur la notification annuelle de votre CARSAT et sur net-entreprises.fr.',
      choice('knowsTaux', '', [['oui', 'Oui'], ['non', 'Non']]) +
      '<div class="bench-fields diag-fields diag-fields-one" id="diag-tauxField"' + (v.knowsTaux === 'oui' ? '' : ' hidden') + '>' +
        field('diag-taux', 'Taux AT/MP notifié (%)', v.tauxNotifie != null ? fmt2(v.tauxNotifie) : null, { mode: 'decimal', placeholder: 'ex. 2,35' }) +
      '</div>' +
      '<div class="diag-insight" id="diag-insight"></div>' + nav('Continuer'));
  },

  pratiques: function() {
    return screen('Vos pratiques', 'Où en êtes-vous sur ces quatre points ?',
      'Vos réponses ordonnent le plan d\'action de votre diagnostic.',
      choice('duerp', 'Votre DUERP a été mis à jour', [['recent', 'Il y a moins d\'un an'], ['old', 'Il y a plus d\'un an'], ['unknown', 'Je ne sais pas']]) +
      choice('suivi45', 'Vous suivez les arrêts de plus de 45 jours', [['oui', 'Oui'], ['non', 'Non']]) +
      choice('tauxVerifie', 'Vous avez déjà vérifié votre taux AT/MP', [['oui', 'Oui'], ['non', 'Non'], ['nsp', 'Je ne sais pas']]) +
      choice('ijRecup', 'Vous rapprochez les IJ avancées et remboursées', [['oui', 'Oui'], ['non', 'Non'], ['nsp', 'Je ne sais pas']]) +
      nav('Continuer'));
  },

  contact: function(v) {
    var c = v.contact || {};
    var demo = isDemo();
    return screen('Dernière étape', 'Votre diagnostic est prêt',
      'Complétez ces quelques informations pour le consulter aussitôt et le télécharger en PDF.',
      (demo ? '<p class="diag-demo">Mode démonstration : les coordonnées sont facultatives.</p>' : '') +
      '<div class="diag-contact">' +
        '<div class="bench-fields diag-fields">' +
          field('diag-prenom', 'Prénom', c.prenom, { mode: 'text', autocomplete: 'given-name' }) +
          field('diag-nom', 'Nom', c.nom, { mode: 'text', autocomplete: 'family-name' }) +
          field('diag-email', 'E-mail professionnel', c.email, { type: 'email', mode: 'email', autocomplete: 'email' }) +
          pickerField('diag-societe', 'Entreprise', c.societe, 'Nom de votre entreprise', 'organization') +
          pickerField('diag-fonction', 'Fonction', c.fonction, 'ex. DRH, Directeur financier', 'off') +
        '</div>' +
        '<label class="diag-consent"><input type="checkbox" id="diag-consent"' + (c.consent ? ' checked' : '') + '>' +
          '<span>J\'accepte qu\'Ayming me recontacte au sujet de ce diagnostic.</span></label>' +
        '<p class="diag-error" id="diag-error" hidden></p>' +
        '<ul class="bench-report-list diag-contents">' +
          '<li><i data-lucide="check"></i><span>Votre comparatif détaillé face à votre secteur, aux établissements de votre taille et à la moyenne nationale</span></li>' +
          '<li><i data-lucide="check"></i><span>Le détail de votre cotisation AT/MP</span></li>' +
          '<li><i data-lucide="check"></i><span>Les leviers prioritaires pour votre entreprise, selon vos réponses</span></li>' +
        '</ul>' +
      '</div>' + nav('Voir mon diagnostic complet'));
  },

  report: function(v, d) {
    return '<div class="diag-actions diag-noprint">' +
        '<button type="button" class="diag-link" data-diag-prev>Modifier mes réponses</button>' +
        '<div class="diag-actions-right">' +
          '<a class="diag-outline-btn" href="' + CONTACT_URL + '" target="_blank" rel="noopener">Échanger avec un consultant</a>' +
          '<button type="button" class="bench-primary-btn" data-diag-print>Télécharger le PDF</button>' +
        '</div>' +
      '</div>' +
      '<p class="diag-print-hint diag-noprint">Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF ».</p>' +
      '<div id="diag-report">' + buildReport(v, d) + '</div>';
  }
};

function kpi(value, label) {
  return '<div class="diag-kpi"><span class="diag-kpi-n">' + value + '</span><span class="diag-kpi-l">' + label + '</span></div>';
}

// ── Éclairages en direct sous les questions ──
var INSIGHTS = {
  arrets: function(v, d) {
    var out = [];
    if (d.days) out.push('Vos arrêts durent en moyenne <strong>' + fmt1(d.days.co) + ' jours</strong> par accident, contre ' + fmt1(d.days.sec) + ' dans votre secteur.');
    if (d.over45) out.push('<strong>' + pct(d.over45.co) + '</strong> de vos accidents dépassent 45 jours d\'arrêt, contre environ ' + pct(d.over45.sec) + ' dans votre secteur.');
    return out;
  },
  mp: function(v, d) {
    var out = [];
    if (d.mp && d.mp.sec != null) out.push('Votre fréquence de maladies professionnelles est de <strong>' + fmt1(d.mp.co) + '</strong> pour 1 000 salariés, contre ' + fmt1(d.mp.sec) + ' dans votre secteur.');
    var dis = d.extra && d.extra.mp_diseases && d.extra.mp_diseases[0];
    if (dis && dis.pct) out.push('Dans votre secteur, ' + Math.round(dis.pct) + ' % des maladies professionnelles relèvent de : ' + esc(dis.libelle).toLowerCase() + '.');
    return out;
  },
  trajet: function(v, d) {
    return (d.trajet && d.trajet.sec != null)
      ? ['Votre fréquence d\'accidents de trajet est de <strong>' + fmt1(d.trajet.co) + '</strong> pour 1 000 salariés, contre ' + fmt1(d.trajet.sec) + ' dans votre secteur.']
      : [];
  },
  taux: function(v, d) {
    if (!d.est) return ['Ajoutez votre masse salariale dans le calcul pour comparer votre taux à notre estimation.'];
    var out = ['Notre estimation de votre taux net : <strong>' + fmt2(d.est.tauxNet) + ' %</strong>.'];
    if (v.knowsTaux === 'oui' && v.tauxNotifie != null) {
      var r = v.tauxNotifie / d.est.tauxNet;
      if (r > 1.15) out.push('Votre taux notifié la dépasse de <strong>' + pct(r - 1) + '</strong>. Un tel écart mérite une vérification de votre compte employeur.');
      else out.push('Votre taux notifié est cohérent avec notre estimation.');
    }
    return out;
  }
};

function renderInsight(step) {
  var box = el('diag-insight');
  if (!box || !INSIGHTS[step]) return;
  var d = computeDiagnostic(vs());
  var lines = d ? INSIGHTS[step](vs(), d) : [];
  box.hidden = !lines.length;
  box.innerHTML = lines.length ? '<i data-lucide="lightbulb"></i><div>' + lines.map(function(l) { return '<p>' + l + '</p>'; }).join('') + '</div>' : '';
  if (window.lucide) window.lucide.createIcons();
}

function bindScreen(step) {
  var shell = el('diag-shell');
  shell.querySelectorAll('input[data-field]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      vs()[this.dataset.field] = parseCount(this.value);
      renderInsight(step);
    });
  });
  var taux = el('diag-taux');
  if (taux) taux.addEventListener('input', function() { vs().tauxNotifie = parseRate(this.value); renderInsight(step); });
  if (step === 'contact') {
    bindCompany(el('diag-societe'), el('diag-societe-ac'), function(siret) { vs().siret = siret; });
    bindPosition(el('diag-fonction'), el('diag-fonction-ac'));
  }
  renderInsight(step);
  var first = shell.querySelector('.diag-card input');
  if (first && step !== 'contact') first.focus({ preventScroll: true });
}

// ── Coordonnées ──
// Elles partent vers Pardot (js/lead.js) au passage vers le rapport, et nomment le rapport.
function readContact() {
  var c = {
    prenom: (el('diag-prenom').value || '').trim(),
    nom: (el('diag-nom').value || '').trim(),
    email: (el('diag-email').value || '').trim(),
    societe: (el('diag-societe').value || '').trim(),
    fonction: (el('diag-fonction').value || '').trim(),
    consent: el('diag-consent').checked,
    siret: vs().siret || ''
  };
  vs().contact = c;
  return c;
}

function contactError(c) {
  if (isDemo()) return null;
  if (!c.prenom || !c.nom || !c.societe || !c.fonction) return 'Merci de renseigner tous les champs.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return 'Merci d\'indiquer une adresse e-mail valide.';
  if (!canonicalPosition(c.fonction)) return 'Merci de choisir votre fonction dans la liste proposée.';
  if (!c.consent) return 'Merci d\'accepter d\'être recontacté pour recevoir votre diagnostic.';
  return null;
}

// Le résumé qui accompagne le lead, dans le champ message : de quoi rappeler avec le contexte.
function leadMessage(v, d) {
  var ANSWERS = { recent: 'moins d\'un an', old: 'plus d\'un an', unknown: 'ne sait pas', oui: 'oui', non: 'non', nsp: 'ne sait pas' };
  var lines = [
    'Diagnostic sinistralité AT/MP',
    'Secteur : ' + v.sector + ' ' + (v.sectorLib || ''),
    'Effectif : ' + frNum(d.effectif) + ' salariés, ' + d.accidents + ' AT avec arrêt sur l\'année',
    'Indice de fréquence : ' + fmt1(d.at.co) + ' (secteur ' + fmt1(d.at.sec) + ', même taille ' + fmt1(d.at.peer) + ', national ' + fmt1(d.at.nat) + ')'
  ];
  if (d.est) {
    lines.push('Cotisation AT/MP estimée : ' + fmtEur(d.est.cotisation) + ' / an, taux net estimé ' + fmt2(d.est.tauxNet) + ' %');
    if (d.est.gap != null) lines.push((d.est.gap >= 0 ? 'Économie potentielle en revenant à la moyenne : ' : 'Avance sur la moyenne : ') + fmtEur(Math.abs(d.est.gap)) + ' / an');
  }
  if (v.tauxNotifie != null) lines.push('Taux notifié déclaré : ' + fmt2(v.tauxNotifie) + ' %');
  var practices = [['duerp', 'DUERP mis à jour'], ['suivi45', 'Suivi des arrêts > 45 j'], ['tauxVerifie', 'Taux déjà vérifié'], ['ijRecup', 'Rapprochement des IJ']]
    .filter(function(p) { return v[p[0]]; })
    .map(function(p) { return p[1] + ' : ' + (ANSWERS[v[p[0]]] || v[p[0]]); });
  if (practices.length) lines.push(practices.join(' ; '));
  return lines.join('\n');
}

// Envoyé une fois par jeu de réponses : revenir en arrière puis repasser ne double pas le lead,
// changer une réponse le renvoie à jour.
function submitLead(v) {
  if (isDemo()) return;
  var c = v.contact, d = computeDiagnostic(v);
  if (!c || !d) return;
  var position = canonicalPosition(c.fonction);
  var fields = {
    prenom: c.prenom, nom: c.nom, email: c.email, societe: c.societe, siret: c.siret,
    position: position, departement: positionDepartment(position),
    consent: c.consent ? 'true' : '', message: leadMessage(v, d)
  };
  var sig = JSON.stringify(fields);
  if (sig === v.leadSent) return;
  if (sendLead(fields)) v.leadSent = sig;
}

function canSeeReport(v) { return isDemo() || (v.contact && !contactError(v.contact)); }

function goTo(i) {
  var v = vs();
  v.diagStep = Math.max(0, Math.min(STEPS.length - 1, i));
  renderDiagnostic();
}

// ── Plan d'action : chaque levier est déclenché par une réponse ou un écart ──
function leversFor(v, d) {
  var eff = d.effectif, levers = [];
  var mode = d.est ? d.est.mode : null;

  var cot = 0, cotWhy = '';
  if (v.tauxNotifie != null && d.est && v.tauxNotifie > d.est.tauxNet * 1.15) {
    cot = 3; cotWhy = 'Votre taux notifié (' + fmt2(v.tauxNotifie) + ' %) dépasse de ' + pct(v.tauxNotifie / d.est.tauxNet - 1) + ' notre estimation (' + fmt2(d.est.tauxNet) + ' %).';
  } else if (v.tauxVerifie === 'non' || v.tauxVerifie === 'nsp') {
    cot = 3; cotWhy = 'Votre taux n\'a pas encore été vérifié. Il repose sur trois années de sinistres, chaque imputation contestable pèse donc trois fois.';
  } else if (d.at.ratio > 1.05 && mode !== 'collectif') {
    cot = 2; cotWhy = 'Votre fréquence est ' + gap(d.at.ratio) + ' votre secteur, et votre tarification ' + mode + ' répercute votre sinistralité sur votre taux.';
  }
  if (cot) levers.push({ score: cot, title: 'Maîtriser vos cotisations AT/MP', why: cotWhy, offer: 'Cotisations AT/MP', url: offerUrl('couts-rh/cotisations-at-mp/', 'cotisations-atmp') });

  var ald = 0, aldWhy = '';
  if (d.over45 && d.over45.co > 0) { ald = d.over45.ratio > 1.05 ? 3 : 2; aldWhy = pct(d.over45.co) + ' de vos accidents dépassent 45 jours d\'arrêt, contre environ ' + pct(d.over45.sec) + ' dans votre secteur. Au-delà, le coût moyen imputé change de catégorie.'; }
  else if (v.suivi45 === 'non') { ald = 3; aldWhy = 'Vos arrêts de plus de 45 jours ne font pas l\'objet d\'un suivi dédié. Ce sont eux qui pèsent le plus sur votre taux.'; }
  else if (d.days && d.days.ratio > 1.05) { ald = 2; aldWhy = 'Vos arrêts durent ' + fmt1(d.days.co) + ' jours en moyenne, contre ' + fmt1(d.days.sec) + ' dans votre secteur.'; }
  if (v.suivi45 === 'non' && ald) ald = 3;
  if (ald) levers.push({ score: ald, title: 'Piloter vos arrêts de longue durée', why: aldWhy, offer: 'Arrêts longue durée', url: offerUrl('arrets-de-travail/piloter-les-arrets-longue-duree/', 'pilotage-arrets-longue-duree') });

  if (d.at.ratio > 1.05 || d.accidents >= 15) {
    levers.push({ score: d.at.ratio > 1.05 ? 2 : 1, title: 'Sécuriser chaque déclaration d\'accident',
      why: 'Avec ' + frNum(d.accidents) + ' accidents avec arrêt par an, chaque déclaration compte : délai de 48 heures, réserves motivées quand elles se justifient.',
      offer: 'Déclaration des accidents du travail', url: offerUrl('atmp/declarer-un-accident-du-travail/', 'declarer-un-accident-du-travail') });
  }
  if (v.mp > 0) {
    levers.push({ score: (d.mp && d.mp.ratio > 1.05) ? 3 : 2, title: 'Répondre aux questionnaires de maladie professionnelle',
      why: 'Vous comptez ' + frNum(v.mp) + ' maladie' + (v.mp > 1 ? 's' : '') + ' professionnelle' + (v.mp > 1 ? 's' : '') + ' reconnue' + (v.mp > 1 ? 's' : '') + '. Chaque questionnaire de la CPAM appelle une réponse argumentée dans les délais.',
      offer: 'Questionnaires de maladie professionnelle', url: offerUrl('atmp/questionnaires-de-maladie-professionnelle/', 'questionnaires-de-maladie-professionnelle') });
  }
  if (v.trajet > 0) {
    levers.push({ score: 1, title: 'Récupérer le coût des accidents causés par un tiers',
      why: 'Vous déclarez ' + frNum(v.trajet) + ' accident' + (v.trajet > 1 ? 's' : '') + ' de trajet. Quand un tiers est responsable, les salaires maintenus et les charges se récupèrent auprès de son assureur.',
      offer: 'Accidents causés par un tiers', url: offerUrl('atmp/accidents-causes-par-un-tiers/', 'accidents-tiers') });
  }
  if (v.duerp === 'old' || v.duerp === 'unknown') {
    levers.push({ score: v.duerp === 'old' ? 3 : 2, title: 'Faire vivre votre DUERP',
      why: (v.duerp === 'old' ? 'Votre DUERP date de plus d\'un an. ' : 'La date de votre dernier DUERP n\'est pas connue. ') +
        (eff >= 11 ? 'Il doit être mis à jour au moins chaque année dans une entreprise de 11 salariés et plus.' : 'Il doit être mis à jour à chaque changement important des conditions de travail.'),
      offer: 'DUERP et Acciline+', url: offerUrl('prevention-et-sante-au-travail/evaluer-les-risques-professionnels-duerp/', 'duerp') });
  }
  if (v.ijRecup === 'non' || v.ijRecup === 'nsp') {
    levers.push({ score: v.ijRecup === 'non' ? 3 : 2, title: 'Récupérer les IJ non perçues',
      why: 'Les indemnités journalières avancées en subrogation ne sont pas toujours remboursées. Un rapprochement régulier évite que les écarts s\'accumulent.',
      offer: 'Récupérer les IJ', url: offerUrl('arrets-de-travail/recuperer-les-ij/', 'recuperer-ij') });
  }
  return levers.sort(function(a, b) { return b.score - a.score; }).slice(0, 5);
}

var OTHER_OFFERS = [
  ['Remboursements IJSS et prévoyance', 'arrets-de-travail/remboursements-ijss-et-prevoyance/', 'remboursements-ijss'],
  ['Collecte des arrêts de travail', 'arrets-de-travail/collecter-les-arrets-de-travail/', 'collecte-arrets'],
  ['Visites médicales', 'prevention-et-sante-au-travail/externaliser-visites-medicales/', 'visites-medicales'],
  ['Charges sociales', 'couts-rh/charges-sociales/', 'charges-sociales'],
  ['Contrôle URSSAF', 'couts-rh/controle-urssaf/', 'controle-urssaf'],
  ['Aides à l\'apprentissage', 'couts-rh/aides-apprentissage/', 'aides-apprentissage']
];

// ── Libellés sectoriels ──
var CAUSE_LABELS = {
  'Outillage a main': 'Outillage à main', 'Manutention mecanique': 'Manutention mécanique',
  'Autres vehicules': 'Autres véhicules', 'Risque machines': 'Risque machine'
};
var SIEGE_LABELS = {
  tete: 'Tête', cou: 'Cou', dos: 'Dos', torse: 'Torse', membres_superieurs: 'Membres supérieurs',
  membres_inferieurs: 'Membres inférieurs', corps_entier: 'Corps entier', autres: 'Autres'
};

function bars(rows, fmt) {
  var max = Math.max.apply(null, rows.map(function(r) { return r.value || 0; })) || 1;
  return '<div class="rp-bars">' + rows.map(function(r) {
    return '<div class="rp-bar' + (r.you ? ' is-you' : '') + '"><span class="rp-bar-l">' + r.label + '</span>' +
      '<span class="rp-bar-t"><span style="width:' + Math.max(2, Math.round((r.value || 0) / max * 100)) + '%"></span></span>' +
      '<span class="rp-bar-v">' + fmt(r.value) + '</span></div>';
  }).join('') + '</div>';
}

function page(n, title, inner, opts) {
  opts = opts || {};
  return '<section class="rp-page' + (opts.cls ? ' ' + opts.cls : '') + '">' +
    (opts.bare ? '' : '<header class="rp-head"><img src="assets/ayming-logo.png" alt="Ayming" class="rp-logo"><span>Diagnostic de sinistralité AT/MP</span></header>') +
    (title ? '<h2 class="rp-h">' + title + '</h2>' : '') + inner +
    (opts.bare ? '' : '<div class="rp-foot"><span>Diagnostic comparatif établi à partir de vos réponses et des statistiques de l\'Assurance Maladie 2024</span><span>' + n + '</span></div>') +
  '</section>';
}

// ── Le rapport ──
function buildReport(v, d) {
  var c = v.contact || {};
  var company = c.societe ? esc(c.societe) : 'Votre entreprise';
  var date = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  var levers = leversFor(v, d);
  var p = 1, html = '';

  // 1. Couverture
  html += '<section class="rp-page rp-cover">' +
    '<img src="assets/ayming-logo.png" alt="Ayming" class="rp-cover-logo">' +
    '<div class="rp-cover-body">' +
      '<span class="bench-chip-brand">Diagnostic comparatif</span>' +
      '<h1>Diagnostic de sinistralité AT/MP</h1>' +
      '<p class="rp-cover-company">' + company + '</p>' +
      '<p class="rp-cover-meta">' + esc(d.sector) + ' · ' + esc(d.sectorLib) + '<br>' + frNum(d.effectif) + ' salariés · ' + date + '</p>' +
    '</div>' +
    '<p class="rp-cover-foot">Établi à partir de vos réponses et des statistiques AT/MP 2024 de l\'Assurance Maladie' +
      (c.prenom ? ', pour ' + esc(c.prenom) + ' ' + esc(c.nom) : '') + '.</p>' +
  '</section>';

  // 2. Synthèse
  var tiles = [
    ['Fréquence des accidents', fmt1(d.at.co), 'pour 1 000 salariés, ' + gap(d.at.ratio) + ' votre secteur (' + fmt1(d.at.sec) + ')', ratioClass(d.at.ratio)],
    d.est ? ['Cotisation AT/MP estimée', fmtEur(d.est.cotisation), 'par an, taux net estimé ' + fmt2(d.est.tauxNet) + ' %', ''] : null,
    (d.est && d.est.gap > d.est.cotisation * 0.02) ? ['Économie potentielle', '≈ ' + fmtEur(d.est.gap), 'par an, en revenant à la moyenne de votre secteur', 'above'] :
      (d.est ? ['Écart à votre secteur', d.est.gap < 0 ? '≈ ' + fmtEur(-d.est.gap) : 'proche de zéro', d.est.gap < 0 ? 'par an d\'avance sur une entreprise moyenne' : 'votre cotisation suit la moyenne', 'below'] : null),
    d.days ? ['Durée moyenne des arrêts', fmt1(d.days.co) + ' j', 'par accident, contre ' + fmt1(d.days.sec) + ' dans votre secteur', ratioClass(d.days.ratio)] : null
  ].filter(Boolean);
  var findings = [];
  findings.push('Votre fréquence d\'accidents du travail est ' + gap(d.at.ratio) + ' la moyenne de votre secteur' +
    (d.at.peer != null ? ', et ' + gap(d.at.co / d.at.peer) + ' celle des établissements de votre taille.' : '.'));
  if (d.est) findings.push(d.est.gap > d.est.cotisation * 0.02
    ? 'Revenir à la sinistralité moyenne de votre secteur représenterait environ ' + fmtEur(d.est.gap) + ' de cotisation en moins chaque année.'
    : 'Votre cotisation estimée est au niveau ou en dessous de celle d\'une entreprise moyenne de votre secteur.');
  if (levers[0]) findings.push('Premier levier identifié : ' + levers[0].title.charAt(0).toLowerCase() + levers[0].title.slice(1) + '.');
  html += page(++p, 'Ce que révèle votre diagnostic',
    '<div class="rp-tiles">' + tiles.map(function(t) {
      return '<div class="rp-tile ' + t[3] + '"><span class="rp-tile-k">' + t[0] + '</span><span class="rp-tile-n">' + t[1] + '</span><span class="rp-tile-l">' + t[2] + '</span></div>';
    }).join('') + '</div>' +
    '<ul class="rp-findings">' + findings.map(function(f) { return '<li>' + f + '</li>'; }).join('') + '</ul>');

  // 3. Fréquence et gravité
  var freq = [
    { label: 'Votre entreprise', value: d.at.co, you: true },
    { label: 'Votre secteur', value: d.at.sec },
    d.at.peer != null ? { label: 'Établissements de même taille', value: d.at.peer } : null,
    { label: 'Moyenne nationale', value: d.at.nat }
  ].filter(Boolean);
  var grav = '';
  if (d.days) grav += '<h3 class="rp-h3">Durée moyenne des arrêts, en jours par accident</h3>' +
    bars([{ label: 'Votre entreprise', value: d.days.co, you: true }, { label: 'Votre secteur', value: d.days.sec }], fmt1);
  if (d.over45) grav += '<h3 class="rp-h3">Part des accidents arrêtés plus de 45 jours</h3>' +
    bars([{ label: 'Votre entreprise', value: d.over45.co * 100, you: true }, { label: 'Votre secteur (estimation)', value: d.over45.sec * 100 }], function(x) { return Math.round(x) + ' %'; });
  var others = '';
  if (d.mp || d.trajet) {
    others = '<h3 class="rp-h3">Maladies professionnelles et trajet, pour 1 000 salariés</h3><table class="rp-table"><thead><tr><th></th><th>Vous</th><th>Secteur</th><th>National</th></tr></thead><tbody>' +
      (d.mp ? '<tr><td>Maladies professionnelles</td><td>' + fmt1(d.mp.co) + '</td><td>' + fmt1(d.mp.sec) + '</td><td>' + fmt1(d.mp.nat) + '</td></tr>' : '') +
      (d.trajet ? '<tr><td>Accidents de trajet</td><td>' + fmt1(d.trajet.co) + '</td><td>' + fmt1(d.trajet.sec) + '</td><td>' + fmt1(d.trajet.nat) + '</td></tr>' : '') +
      '</tbody></table>';
  }
  html += page(++p, 'Votre fréquence et la gravité de vos arrêts',
    '<p class="rp-p">L\'indice de fréquence ramène vos accidents avec arrêt à 1 000 salariés, pour vous comparer à des entreprises de toute taille. Votre secteur est calculé de la même façon par l\'Assurance Maladie.</p>' +
    '<h3 class="rp-h3">Indice de fréquence des accidents du travail</h3>' + bars(freq, fmt1) + grav + others);

  // 4. Cotisation
  if (d.est) {
    var st = d.steps;
    var tauxNote = (v.tauxNotifie != null)
      ? '<p class="rp-callout ' + (v.tauxNotifie > d.est.tauxNet * 1.15 ? 'above' : '') + '">Votre taux notifié est de ' + fmt2(v.tauxNotifie) + ' %, pour un taux net estimé à ' + fmt2(d.est.tauxNet) + ' %.' +
        (v.tauxNotifie > d.est.tauxNet * 1.15 ? ' Cet écart mérite une vérification de votre compte employeur, un taux pouvant être contesté dans les deux mois suivant sa notification.' : '') + '</p>'
      : '';
    var modeNote = d.est.mode === 'individuel' ? 'Avec 150 salariés et plus, votre tarification est individuelle : votre taux reflète directement votre sinistralité.'
      : d.est.mode === 'mixte' ? 'Entre 20 et 149 salariés, votre tarification est mixte : une partie de votre taux dépend de votre sinistralité.'
      : 'En dessous de 20 salariés, votre taux est collectif et fixé pour votre secteur.';
    html += page(++p, 'Votre cotisation AT/MP',
      '<p class="rp-p">' + modeNote + '</p>' +
      '<div class="rp-lines">' +
        rpLine('Valeur du risque (coût moyen de vos sinistres)', fmtEur(d.est.imputedCost)) +
        rpLine('Taux brut (valeur du risque ÷ masse salariale)', fmt2(st.brut) + ' %') +
        rpLine('Majoration M1, accidents de trajet', '+ ' + fmt2(st.m1) + ' %') +
        rpLine('Majoration M2, charges générales', '+ ' + fmt2(st.m2) + ' %') +
        rpLine('Majorations M3 et M4, compte spécial et pénibilité', '+ ' + fmt2(st.m3 + st.m4) + ' %') +
        rpLine('Taux net estimé', fmt2(d.est.tauxNet) + ' %', 'is-total') +
        rpLine('Cotisation estimée', fmtEur(d.est.cotisation) + ' / an', 'is-total') +
        (d.est.cotisationRef != null ? rpLine('Cotisation à la sinistralité moyenne de votre secteur', fmtEur(d.est.cotisationRef) + ' / an') : '') +
      '</div>' + tauxNote +
      '<p class="rp-small">La valeur du risque additionne, pour chaque sinistre, le coût moyen de son incapacité temporaire selon la durée de l\'arrêt, et celui d\'une incapacité permanente ou d\'un décès quand il y en a (article D242-6-6 du code de la sécurité sociale). ' +
        'Comité technique ' + d.est.ctn + ', majorations ' + MAJORATIONS.year + '. ' + BAREME_SOURCE + ' Estimation indicative, le taux exact dépend de votre code risque.</p>');
  }

  // 5. Où cibler la prévention (données du secteur)
  var causes = Object.keys(d.entry.risk_causes || {}).map(function(k) { return { label: CAUSE_LABELS[k] || k, value: d.entry.risk_causes[k] }; })
    .sort(function(a, b) { return b.value - a.value; }).slice(0, 6);
  var sectorPage = '<p class="rp-p">Ces répartitions décrivent les accidents de <strong>votre secteur</strong>, pas ceux de votre entreprise. Elles indiquent où les accidents surviennent le plus souvent dans votre activité, pour savoir où regarder en premier.</p>';
  if (causes.length) sectorPage += '<h3 class="rp-h3">Principales causes d\'accidents du travail dans votre secteur</h3>' + bars(causes, function(x) { return fmt1(x) + ' %'; });
  var siege = d.extra && d.extra.siege_lesions;
  if (siege) {
    var tot = 0; Object.keys(siege).forEach(function(k) { if (k !== 'non_determine') tot += siege[k]; });
    var rows = Object.keys(siege).filter(function(k) { return SIEGE_LABELS[k] && tot > 0; })
      .map(function(k) { return { label: SIEGE_LABELS[k], value: siege[k] / tot * 100 }; })
      .sort(function(a, b) { return b.value - a.value; }).slice(0, 5);
    if (rows.length) sectorPage += '<h3 class="rp-h3">Siège des lésions</h3>' + bars(rows, function(x) { return Math.round(x) + ' %'; });
  }
  html += page(++p, 'Où cibler la prévention, sur votre secteur', sectorPage);

  // 6. Plan d'action
  html += page(++p, 'Votre plan d\'action',
    (levers.length
      ? '<p class="rp-p">Vos leviers, classés selon vos réponses et les écarts relevés par ce diagnostic.</p><ol class="rp-levers">' + levers.map(function(l) {
          return '<li><h3>' + l.title + '</h3><p>' + l.why + '</p><a href="' + l.url + '" target="_blank" rel="noopener">' + l.offer + ' avec Ayming</a></li>';
        }).join('') + '</ol>'
      : '<p class="rp-p">Votre sinistralité est proche ou en dessous de votre secteur, et vos pratiques couvrent les points clés. Un échange avec nos consultants permet d\'aller plus loin sur votre compte employeur.</p>') +
    '<h3 class="rp-h3">Au-delà des AT/MP</h3><p class="rp-p">' + OTHER_OFFERS.map(function(o) {
      return '<a href="' + offerUrl(o[1], o[2]) + '" target="_blank" rel="noopener">' + o[0] + '</a>';
    }).join(' · ') + '</p>');

  // 7. Étape suivante et méthode
  html += page(++p, 'Et maintenant ?',
    '<div class="rp-next"><h3>Échangez avec l\'un de nos consultants</h3>' +
      '<p>Ensemble, nous examinons votre compte employeur, vos taux notifiés et vos arrêts longs, puis nous chiffrons vos leviers.</p>' +
      '<a href="' + CONTACT_URL + '" target="_blank" rel="noopener">www.ayming.fr/contactez-nous</a></div>' +
    '<h3 class="rp-h3">Méthode et sources</h3>' +
    '<p class="rp-small">Les chiffres de votre entreprise sont ceux que vous avez déclarés. Les chiffres sectoriels et nationaux proviennent des statistiques AT/MP 2024 de l\'Assurance Maladie, par code NAF. L\'indice de fréquence rapporte les accidents ayant donné lieu à un premier règlement à 1 000 salariés. La comparaison aux établissements de même taille dérive de la répartition des accidents et des salariés par taille d\'établissement publiée pour votre secteur. La cotisation est estimée avec le barème officiel des coûts moyens et les majorations nationales.</p>' +
    '<p class="rp-small">Ce document est un diagnostic comparatif. Il ne constitue ni un audit, ni un conseil juridique.</p>');
  return html;
}

function rpLine(label, value, cls) {
  return '<div class="rp-line' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><strong>' + value + '</strong></div>';
}

// ── Événements ──
export function initDiagnostic() {
  var shell = el('diag-shell');
  if (!shell) return;
  shell.addEventListener('click', function(e) {
    var t = e.target.closest('button');
    if (!t) return;
    var v = vs();
    var step = STEPS[v.diagStep];
    if (t.hasAttribute('data-diag-back-calc')) { switchView('compare'); return; }
    if (t.hasAttribute('data-diag-print')) { window.print(); return; }
    if (t.hasAttribute('data-diag-prev')) { goTo(step === 'report' ? 1 : v.diagStep - 1); return; }
    if (t.hasAttribute('data-diag-next')) {
      if (step === 'contact') {
        var err = contactError(readContact());
        var box = el('diag-error');
        if (err) { box.textContent = err; box.hidden = false; return; }
        submitLead(v);
      }
      goTo(v.diagStep + 1);
      return;
    }
    if (t.dataset.choice) {
      v[t.dataset.choice] = t.dataset.value;
      t.parentNode.querySelectorAll('.diag-chip').forEach(function(b) {
        var on = b === t;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      if (t.dataset.choice === 'knowsTaux') {
        var f = el('diag-tauxField');
        if (f) f.hidden = t.dataset.value !== 'oui';
        if (t.dataset.value !== 'oui') v.tauxNotifie = null;
        var inp = el('diag-taux'); if (inp && t.dataset.value === 'oui') inp.focus();
      }
      renderInsight(step);
      return;
    }
    if (t.dataset.set) {
      v[t.dataset.set] = parseInt(t.dataset.setValue, 10);
      var input = el('diag-' + t.dataset.set);
      if (input) input.value = t.dataset.setValue;
      renderInsight(step);
    }
  });
}
