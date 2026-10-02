// ── Diagnostic personnalisé : parcours question par question, puis le rapport ──
// Le calculateur de « Mon entreprise » donne les quatre premiers chiffres. Ici, chaque
// écran pose une ou deux questions et rend aussitôt un éclairage, puis viennent les
// coordonnées et le rapport lui-même, dont l'impression produit le PDF.
// Les réponses vivent dans state.views.compare, partagé avec le calculateur.
// Les chiffres viennent tous de computeDiagnostic(), pour que l'écran et le PDF concordent.

import { state } from './state.js?v=58f7592';
import { el, esc, fmt1, frNum, fmtEur } from './utils.js?v=58f7592';
import { switchView } from './nav.js?v=58f7592';
import { computeDiagnostic, parseCount, parseRate, flagInput, vs } from './compare.js?v=58f7592';
import { mountReportCharts, destroyReportCharts } from './report-charts.js?v=58f7592';
import { ficheFor, historyFor } from './history.js?v=58f7592';
import { buildReport, shareMessage, fmt2, pct, gap, CONTACT_URL, MOTIFS, yearCostSplit, yearCostSentence, accidentCost } from './report.js?v=58f7592';
import { sendLead, bindCompany, bindPosition, canonicalPosition, positionDepartment } from './lead.js?v=58f7592';


// Les commerciaux en démonstration n'ont pas à saisir de coordonnées : ?demo dans l'URL.
// ?test (compare.js, prefillTest) vaut démonstration : coordonnées facultatives, aucun envoi.
function isDemo() { return /[?&](demo|test)\b/.test(window.location.search); }

// ── Les écrans ──
var STEPS = ['start', 'arrets', 'mp', 'taux', 'pratiques', 'contact', 'report'];
var QUESTION_STEPS = 5;   // de « arrets » à « contact », ce que compte la barre de progression

export function renderDiagnostic() {
  var shell = el('diag-shell');
  if (!shell) return;
  var v = vs();
  var d = computeDiagnostic(v);
  if (!d) { shell.innerHTML = renderMissing(); return; }
  var step = STEPS[v.diagStep] || 'start';
  if (step === 'report' && !canSeeReport(v)) { v.diagStep = STEPS.indexOf('contact'); step = 'contact'; }

  d.src = sourcesOf(d.sector);
  destroyReportCharts();
  var body = SCREENS[step](v, d);
  shell.innerHTML = (step === 'report' ? '' : progress(v.diagStep)) + body;
  bindScreen(step);
  if (step === 'report') mountReportCharts(shell);
  if (window.lucide) window.lucide.createIcons();
  window.scrollTo(0, 0);
}

// Les données que le rapport lit en plus du diagnostic : les fiches AT et MP (répartitions et
// journées perdues, avec leur référence nationale) et les séries sur dix ans. Chargées à la
// demande dès le premier écran, le rapport se redessine si elles arrivent après lui. Un fichier
// qui manque laisse son champ à null, et les pages qui en dépendent s'effacent.
var SOURCES = {};
function sourcesOf(code) {
  if (!code) return null;
  if (!(code in SOURCES)) {
    SOURCES[code] = null;
    var safe = function(p) { return p.catch(function() { return null; }); };
    Promise.all([safe(ficheFor('at', code)), safe(ficheFor('mp', code)), safe(historyFor('at', code)), safe(historyFor('mp', code)), safe(historyFor('trajet', code))]).then(function(r) {
      SOURCES[code] = { ficheAt: r[0], ficheMp: r[1], histAt: r[2], histMp: r[3], histTrajet: r[4] };
      if (STEPS[vs().diagStep] === 'report' && vs().sector === code) renderDiagnostic();
    });
  }
  return SOURCES[code];
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

// La raison de la visite, en liste déroulante : elle choisit l'ouverture du rapport.
function motifSelect(cur) {
  return '<div class="bench-field diag-motif">' +
    '<label for="diag-motif">Qu\'est-ce qui vous amène aujourd\'hui ?</label>' +
    '<select id="diag-motif">' +
      '<option value=""' + (cur ? '' : ' selected') + '>Choisissez une réponse</option>' +
      MOTIFS.map(function(m) { return '<option value="' + m.key + '"' + (cur === m.key ? ' selected' : '') + '>' + m.label + '</option>'; }).join('') +
    '</select>' +
  '</div>';
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
    // Le diagnostic promet ce que chaque accident coûte sur trois taux. Sans ce chiffre (taux
    // collectif, pas de masse salariale, aucun sinistre), il ouvre sur la fréquence du secteur.
    var y = yearCostSplit(d, new Date());
    var perAcc = y ? accidentCost(d) : null;
    var title = y ? yearCostSentence(v, d, y) : 'Votre fréquence d\'accidents est ' + gap(d.at.ratio) + ' votre secteur';
    var kpis = y
      ? kpi(fmtEur(y.taux[0].cost), 'par taux, de ' + y.taux[0].year + ' à ' + y.taux[2].year) +
        (perAcc ? kpi(fmtEur(perAcc), 'par accident de plus') : '') +
        kpi(fmt1(d.at.co), 'votre fréquence, ' + fmt1(d.at.sec) + ' dans le secteur')
      : kpi(fmt1(d.at.co), 'votre indice de fréquence') +
        kpi(fmt1(d.at.sec), 'celui de votre secteur') +
        (d.est ? kpi(fmtEur(d.est.cotisation), 'cotisation AT/MP estimée par an') : '');
    return '<div class="diag-card diag-center">' +
      '<span class="bench-chip-brand">Diagnostic de sinistralité personnalisé</span>' +
      '<h2 class="diag-title">' + title + '</h2>' +
      '<div class="diag-kpis">' + kpis + '</div>' +
      '<p class="diag-lead">Cinq courtes étapes, environ deux minutes, pour construire votre rapport sur vos déclarations d\'accident, la prévention, les maladies professionnelles, les arrêts et votre taux. Chaque réponse est facultative.</p>' +
      motifSelect(v.motif) +
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
        field('diag-deces', 'Décès, s\'il y en a eu', v.deces, { field: 'deces', placeholder: 'ex. 0' }) +
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

  taux: function(v) {
    return screen('Votre taux', 'Quel est votre taux AT/MP notifié ?',
      'Il figure sur la notification annuelle de votre CARSAT, sur net-entreprises.fr et sur vos bulletins de paie. Laissez vide si vous ne l\'avez pas sous la main.',
      '<div class="bench-fields diag-fields diag-fields-one">' +
        field('diag-taux', 'Taux AT/MP notifié (%)', v.tauxNotifie != null ? fmt2(v.tauxNotifie) : null, { mode: 'decimal', placeholder: 'ex. 2,35' }) +
      '</div>' +
      '<div class="diag-insight" id="diag-insight"></div>' + nav('Continuer'));
  },

  pratiques: function() {
    return screen('Vos pratiques', 'Où en êtes-vous sur ces trois points ?',
      'Vos réponses ordonnent le plan d\'action de votre diagnostic.',
      choice('reserves', 'Vous émettez des réserves motivées quand les circonstances d\'un accident le justifient', [['oui', 'Oui'], ['non', 'Non'], ['nsp', 'Je ne sais pas']]) +
      choice('suivi45', 'Vous suivez les arrêts de plus de 45 jours', [['oui', 'Oui'], ['non', 'Non']]) +
      choice('ijRecup', 'Vous rapprochez les IJ avancées et remboursées', [['oui', 'Oui'], ['non', 'Non'], ['nsp', 'Je ne sais pas']]) +
      nav('Continuer'));
  },

  contact: function(v) {
    var c = v.contact || {};
    var demo = isDemo();
    return screen('Dernière étape', 'Votre diagnostic est prêt',
      'Complétez ces quelques informations pour le consulter aussitôt et le télécharger en PDF.',
      (demo ? '<p class="diag-demo">En mode démonstration, les coordonnées sont facultatives.</p>' : '') +
      '<div class="diag-contact">' +
        '<div class="bench-fields diag-fields">' +
          field('diag-prenom', 'Prénom', c.prenom, { mode: 'text', autocomplete: 'given-name' }) +
          field('diag-nom', 'Nom', c.nom, { mode: 'text', autocomplete: 'family-name' }) +
          field('diag-email', 'E-mail professionnel', c.email, { type: 'email', mode: 'email', autocomplete: 'email' }) +
          pickerField('diag-societe', 'Entreprise', c.societe, 'Nom de votre entreprise', 'organization') +
          pickerField('diag-fonction', 'Fonction', c.fonction, 'ex. DRH, Directeur financier', 'off') +
        '</div>' +
        // Piège à robots : hors écran et hors tabulation, seul un robot le remplit (submitLead).
        '<div class="diag-trap" aria-hidden="true"><label for="diag-site">Site web</label>' +
          '<input type="text" id="diag-site" name="site_web" tabindex="-1" autocomplete="off"></div>' +
        '<label class="diag-consent"><input type="checkbox" id="diag-consent"' + (c.consent ? ' checked' : '') + '>' +
          '<span>J\'accepte qu\'Ayming me recontacte au sujet de ce diagnostic.</span></label>' +
        '<p class="diag-privacy">Vos réponses et vos coordonnées sont transmises à Ayming pour ce seul échange. ' +
          '<a href="https://www.ayming.fr/politique-de-protection-des-donnees-personnelles/" target="_blank" rel="noopener">Protection des données</a></p>' +
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
      '<div id="diag-report">' + buildReport(v, d) + '</div>' +
      shareBlock(v, d);
  }
};

// Un modèle de message, écrit à la première personne, pour transmettre le diagnostic en interne.
function shareBlock(v, d) {
  var c = v.contact || {};
  var position = canonicalPosition(c.fonction || '') || c.fonction || '';
  var m = shareMessage(v, d, positionDepartment(position), position);
  var subject = m.text.split('\n')[0].replace(/^Objet : /, '');
  var body = m.text.split('\n').slice(2).join('\n');
  return '<details class="diag-share diag-noprint">' +
    '<summary class="diag-outline-btn">Préparer un message pour votre direction</summary>' +
    '<p>Un modèle de message à adapter, à envoyer à ' + esc(m.to) + ' avec le PDF. Il est rédigé en votre nom, avec vos chiffres.</p>' +
    '<textarea id="diag-shareText" aria-label="Modèle de message">' + esc(m.text) + '</textarea>' +
    '<div class="diag-share-actions">' +
      '<button type="button" class="bench-primary-btn" data-diag-copy>Copier le message</button>' +
      '<a class="diag-outline-btn" href="mailto:?subject=' + encodeURIComponent(subject) + '&amp;body=' + encodeURIComponent(body) + '">Ouvrir dans ma messagerie</a>' +
    '</div>' +
  '</details>';
}

function kpi(value, label) {
  return '<div class="diag-kpi"><span class="diag-kpi-n">' + value + '</span><span class="diag-kpi-l">' + label + '</span></div>';
}

// ── Éclairages en direct sous les questions ──
var INSIGHTS = {
  arrets: function(v, d) {
    var out = [];
    if (d.days) out.push('Vos arrêts durent en moyenne <strong>' + fmt1(d.days.co) + ' jours</strong> par accident, contre ' + fmt1(d.days.sec) + ' dans votre secteur.');
    if (d.over45) out.push('<strong>' + pct(d.over45.co) + '</strong> de vos accidents dépassent 45 jours d\'arrêt.');
    if (v.accidents != null && ((v.arrets45 != null && v.arrets45 > v.accidents) || (v.deces != null && v.deces > v.accidents))) {
      out.push('Ces chiffres dépassent les <strong>' + frNum(v.accidents) + '</strong> accidents avec arrêt déclarés dans « Mon entreprise ». Pensez à les vérifier.');
    }
    return out;
  },
  mp: function(v, d) {
    var out = [];
    if (d.est && d.est.mpMissing) out.push('Les données de maladies professionnelles de votre secteur ne sont pas disponibles. Vos maladies professionnelles n\'entrent donc pas dans l\'estimation de votre cotisation.');
    if (d.mp && d.mp.sec != null) out.push('Votre fréquence de maladies professionnelles est de <strong>' + fmt1(d.mp.co) + '</strong> pour 1 000 salariés, contre ' + fmt1(d.mp.sec) + ' dans votre secteur.');
    var dis = d.extra && d.extra.mp_diseases && d.extra.mp_diseases[0];
    if (dis && dis.pct) out.push('Dans votre secteur, ' + Math.round(dis.pct) + ' % des maladies professionnelles relèvent du tableau « ' + esc(dis.libelle) + ' ».');
    return out;
  },
  taux: function(v, d) {
    if (!d.est) return ['Ajoutez votre masse salariale dans le calcul pour comparer votre taux à notre estimation.'];
    if (d.est.mode === 'collectif') {
      // Sous 20 salariés le taux notifié est le taux collectif de l'activité : c'est le vrai chiffre, pas un écart à vérifier.
      return v.tauxNotifie != null
        ? ['Sous 20 salariés, ce taux est celui de votre activité, fixé pour tout le secteur. Votre cotisation AT/MP réelle est de <strong>' + fmtEur(v.tauxNotifie / 100 * d.est.masseSalariale) + '</strong> par an.']
        : ['Nous estimons le taux collectif de votre secteur à <strong>' + fmt2(d.est.tauxNet) + ' %</strong>.'];
    }
    var out = ['Nous estimons votre taux net à <strong>' + fmt2(d.est.tauxNet) + ' %</strong>.'];
    if (v.tauxNotifie != null) {
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
      var n = parseCount(this.value);
      flagInput(this, n, 'Un nombre entier, par exemple 12.');
      vs()[this.dataset.field] = n;
      renderInsight(step);
    });
  });
  var taux = el('diag-taux');
  if (taux) taux.addEventListener('input', function() {
    var r = parseRate(this.value);
    flagInput(this, r, 'Un pourcentage, par exemple 2,35.');
    vs().tauxNotifie = r;
    renderInsight(step);
  });
  var motif = el('diag-motif');
  if (motif) motif.addEventListener('change', function() { vs().motif = this.value || null; });
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
    siret: vs().siret || '',
    trap: (el('diag-site').value || '').trim()
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
  var ANSWERS = { oui: 'oui', non: 'non', nsp: 'ne sait pas' };
  var motif = MOTIFS.filter(function(m) { return m.key === v.motif; })[0];
  var lines = [
    'Diagnostic sinistralité AT/MP',
    // Salesforce n'enregistre pas ce qui amène le prospect : le message le porte.
    'Motif : ' + (motif ? motif.label : 'non précisé'),
    'Secteur : ' + v.sector + ' ' + (v.sectorLib || ''),
    'Effectif : ' + frNum(d.effectif) + ' salariés, ' + d.accidents + ' AT avec arrêt sur l\'année',
    'Indice de fréquence : ' + fmt1(d.at.co) + ' (secteur ' + fmt1(d.at.sec) + ', même taille ' + fmt1(d.at.peer) + ', national ' + fmt1(d.at.nat) + ')'
  ];
  if (d.est) {
    lines.push('Cotisation AT/MP estimée : ' + fmtEur(d.est.cotisation) + ' / an, taux net estimé ' + fmt2(d.est.tauxNet) + ' %');
    if (d.est.mode === 'collectif') lines.push('Tarification collective, taux fixé pour le secteur');
    else if (d.est.gap != null) lines.push((d.est.gap >= 0 ? 'Économie potentielle en revenant à la moyenne : ' : 'Avance sur la moyenne : ') + fmtEur(Math.abs(d.est.gap)) + ' / an');
  }
  if (v.tauxNotifie != null) lines.push('Taux notifié déclaré : ' + fmt2(v.tauxNotifie) + ' %');
  var practices = [['reserves', 'Réserves motivées'], ['suivi45', 'Suivi des arrêts > 45 j'], ['ijRecup', 'Rapprochement des IJ']]
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
  // Le champ piège rempli trahit un robot : rien ne part, et le parcours continue comme si de rien.
  if (!c || !d || c.trap) return;
  var position = canonicalPosition(c.fonction);
  var fields = {
    prenom: c.prenom, nom: c.nom, email: c.email, societe: c.societe, siret: c.siret,
    position: position, departement: positionDepartment(position),
    consent: c.consent ? 'true' : '', message: leadMessage(v, d)
  };
  var sig = JSON.stringify(fields);
  if (sig === v.leadSent || sig === v.leadPending) return;
  // En vol, la signature est tenue pour envoyée : un second passage n'envoie pas en double.
  // Un échec réseau la libère, le prochain passage par l'étape contact réessaie.
  v.leadPending = sig;
  sendLead(fields).then(function(ok) {
    if (v.leadPending === sig) v.leadPending = null;
    if (ok) v.leadSent = sig;
  });
}

function canSeeReport(v) { return isDemo() || (v.contact && !contactError(v.contact)); }

// ?test ouvre le rapport directement (app.js), toutes les réponses déjà remplies.
export function openReport() {
  vs().diagStep = STEPS.indexOf('report');
  switchView('diagnostic');
}

function goTo(i) {
  var v = vs();
  v.diagStep = Math.max(0, Math.min(STEPS.length - 1, i));
  renderDiagnostic();
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
    if (t.hasAttribute('data-diag-copy')) {
      var ta = el('diag-shareText');
      var done = function() { t.textContent = 'Message copié'; };
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, function() { ta.select(); });
      else { ta.select(); }
      return;
    }
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
