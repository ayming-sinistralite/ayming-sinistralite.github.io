// ── Le rapport personnalisé, et l'envoi du lead ──
// Les questions se posent dans « Mon entreprise » (flow.js). Cette vue affiche le rapport lui-même,
// dont l'impression produit le PDF, et porte l'envoi des coordonnées vers Pardot.
// Les réponses vivent dans state.views.compare, partagé avec le parcours.
// Les chiffres viennent tous de computeDiagnostic(), pour que l'écran et le PDF concordent.

import { state } from './state.js?v=5f667a9';
import { el, esc, fmt1, frNum, copyText, ensureStyle } from './utils.js?v=5f667a9';
import { switchView } from './nav.js?v=5f667a9';
import { isDemo } from './route.js?v=5f667a9';
import { computeDiagnostic, vs } from './compare.js?v=5f667a9';
import { ficheFor, historyFor } from './history.js?v=5f667a9';
import { CONTACT_URL, MOTIFS, CAUSE_LABELS } from './report-constants.js?v=5f667a9';
import { getProfile } from './profile.js?v=5f667a9';
import { saveReport } from './reports.js?v=5f667a9';
import { openShare } from './share.js?v=5f667a9';
import { sendLead, canonicalPosition, positionDepartment } from './lead.js?v=5f667a9';



// ── Le rapport, chargé à la demande ──
// report.js (120 Ko), report-charts.js et report.css ne partent qu'au premier rapport : le rapport se
// dessine une fois les trois là. Le tampon de version que deploy.sh pose sur ce module (?v=) est repris
// pour les deux imports dynamiques, que son perl ne voit pas : sans lui, report.js et report-charts.js
// auraient une autre adresse que celle de leurs imports statiques entre eux, et deux copies.
var REPORT = null, reportLoading = null;
export function loadReport() {
  if (REPORT) return Promise.resolve(REPORT);
  if (!reportLoading) {
    var stamp = new URL(import.meta.url).search;
    reportLoading = Promise.all([ensureStyle('styles/report.css'), import('./report.js' + stamp), import('./report-charts.js' + stamp)]).then(function(r) {
      REPORT = { report: r[1], charts: r[2] };
      return REPORT;
    }, function(err) { reportLoading = null; throw err; });
  }
  return reportLoading;
}

// ── Le rapport ──
// Sans réponses suffisantes ni coordonnées valides, la vue renvoie au parcours de « Mon entreprise ».
export function renderDiagnostic() {
  var shell = el('diag-shell');
  if (!shell) return;
  var v = vs();
  var d = computeDiagnostic(v);
  if (!d || !canSeeReport(v)) { switchView('compare'); return; }
  if (!REPORT) {
    loadReport().then(function() { if (state.activeView === 'diagnostic') renderDiagnostic(); }, function() {
      shell.innerHTML = '<p class="diag-noprint" role="alert">Le rapport n\'a pas pu se charger. Vérifiez votre connexion puis rechargez la page.</p>';
    });
    return;
  }
  if (!v.motif && !isDemo()) v.motif = getProfile().motif || null;

  d.src = sourcesOf(d.sector);
  REPORT.charts.destroyReportCharts();
  shell.innerHTML = reportScreen(v, d);
  REPORT.charts.mountReportCharts(shell); REPORT.report.packPages(shell); saveReport(v);
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
      if (state.activeView === 'diagnostic' && vs().sector === code) renderDiagnostic();
    });
  }
  return SOURCES[code];
}

function reportScreen(v, d) {
    return '<div class="diag-actions diag-noprint">' +
        '<button type="button" class="diag-link" data-diag-prev>Modifier mes réponses</button>' +
        '<div class="diag-actions-right">' +
          '<button type="button" class="diag-outline-btn" data-diag-peer><i data-lucide="users"></i>Inviter un pair</button>' +
          '<a class="diag-outline-btn" href="' + CONTACT_URL + '" target="_blank" rel="noopener">Échanger avec un consultant</a>' +
          '<button type="button" class="bench-primary-btn" data-diag-print>Télécharger le PDF</button>' +
        '</div>' +
      '</div>' +
      '<p class="diag-print-hint diag-noprint">Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF ».</p>' +
      '<div id="diag-report">' + REPORT.report.buildReport(v, d) + '</div>' +
      shareBlock(v, d);
}

// Un modèle de message, écrit à la première personne, pour transmettre le diagnostic en interne.
function shareBlock(v, d) {
  var c = v.contact || {};
  var position = canonicalPosition(c.fonction || '') || c.fonction || '';
  var m = REPORT.report.shareMessage(v, d, positionDepartment(position), position);
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

// ── Coordonnées ──
// Elles partent vers Pardot (js/lead.js) au passage vers le rapport, et nomment le rapport.
export function contactError(c) {
  if (isDemo()) return null;
  if (!c.prenom || !c.nom || !c.societe || !c.fonction) return 'Merci de renseigner tous les champs.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return 'Merci d\'indiquer une adresse e-mail valide.';
  if (!canonicalPosition(c.fonction)) return 'Merci de choisir votre fonction dans la liste proposée.';
  if (!c.consent) return 'Cochez la case pour que nous puissions vous contacter.';
  return null;
}

// Le résumé qui accompagne le lead, dans le champ message : de quoi rappeler avec le contexte.
// Il arrive dans la Description de Salesforce, du texte brut : la mise en forme tient aux seuls
// retours à la ligne, un titre en capitales par bloc, une ligne vide entre les blocs.
function leadMessage(v, d) {
  var ANSWERS = { oui: 'oui', non: 'non', nsp: 'ne sait pas' };
  var motif = MOTIFS.filter(function(m) { return m.key === v.motif; })[0];
  var lines = [
    'DIAGNOSTIC SINISTRALITÉ AT/MP',
    // Salesforce n'enregistre pas ce qui amène le prospect : le message le porte.
    'Motif : ' + (motif ? motif.label : 'non précisé'),
    'Secteur : ' + v.sector + ' ' + (v.sectorLib || ''),
    'Effectif : ' + frNum(d.effectif) + ' salariés',
    '',
    'ACCIDENTS DU TRAVAIL',
    '- AT avec arrêt sur l\'année : ' + d.accidents,
    '- Indice de fréquence : ' + fmt1(d.at.co),
    '   secteur ' + fmt1(d.at.sec) + ' | même taille ' + fmt1(d.at.peer) + ' | national ' + fmt1(d.at.nat)
  ];
  if (d.days) lines.push('- Jours d\'arrêt par accident : ' + fmt1(d.days.co) + ' (secteur ' + fmt1(d.days.sec) + ')');
  if (v.arrets45 != null) lines.push('- Arrêts de plus de 45 jours : ' + v.arrets45);
  if (v.causes && v.causes.length) lines.push('- Causes citées : ' + v.causes.map(function(k) { return CAUSE_LABELS[k] || k; }).join(', '));
  if (d.mp) lines.push('', 'MALADIES PROFESSIONNELLES',
    '- Sur l\'année : ' + v.mp,
    '- Fréquence : ' + fmt1(d.mp.co) + ' (secteur ' + fmt1(d.mp.sec) + ')');
  var practices = [['reserves', 'Réserves motivées'], ['suivi45', 'Suivi des arrêts > 45 j'], ['ijRecup', 'Rapprochement des IJ']]
    .filter(function(p) { return v[p[0]]; })
    .map(function(p) { return '- ' + p[1] + ' : ' + (ANSWERS[v[p[0]]] || v[p[0]]); });
  if (practices.length) lines.push('', 'PRATIQUES');
  return lines.concat(practices).join('\n');
}

// Envoyé une fois par jeu de réponses : revenir en arrière puis repasser ne double pas le lead,
// changer une réponse le renvoie à jour.
export function submitLead(v) {
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

// Ouvre le rapport, depuis le merci du parcours, l'accueil (un rapport gardé) ou ?test.
export function openReport() {
  switchView('diagnostic');
  renderDiagnostic();
}

// ── Événements ──
export function initDiagnostic() {
  var shell = el('diag-shell');
  if (!shell) return;
  shell.addEventListener('click', function(e) {
    // Une ligne du sommaire : défiler jusqu'à la page sans toucher à l'adresse, que lit le routeur.
    var toc = e.target.closest('a.rp-toc-a');
    if (toc) {
      var to = document.getElementById(toc.getAttribute('href').split('#')[1]);
      if (to) { e.preventDefault(); to.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    var t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-diag-print')) { window.print(); return; }
    if (t.hasAttribute('data-diag-peer')) { openShare(vs().sector); return; }
    if (t.hasAttribute('data-diag-copy')) {
      var ta = el('diag-shareText');
      var done = function() { t.textContent = 'Message copié'; };
      copyText(ta.value).then(done, function() { ta.select(); });
      return;
    }
    if (t.hasAttribute('data-diag-prev')) {
      // Revenir aux questions, sur la première, réponses gardées.
      vs().flowStep = 1;
      switchView('compare');
    }
  });
}
