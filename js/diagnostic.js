// ── Le rapport personnalisé, et l'envoi du lead ──
// Les questions se posent dans « Mon entreprise » (flow.js). Cette vue affiche le rapport lui-même,
// dont l'impression produit le PDF, et porte l'envoi des coordonnées vers Pardot.
// Les réponses vivent dans state.views.compare, partagé avec le parcours.
// Les chiffres viennent tous de computeDiagnostic(), pour que l'écran et le PDF concordent.

import { state } from './state.js?v=be98175';
import { el, esc, fmt1, frNum, copyText } from './utils.js?v=be98175';
import { switchView } from './nav.js?v=be98175';
import { isDemo } from './route.js?v=be98175';
import { computeDiagnostic, vs } from './compare.js?v=be98175';
import { mountReportCharts, destroyReportCharts } from './report-charts.js?v=be98175';
import { ficheFor, historyFor } from './history.js?v=be98175';
import { buildReport, packPages, shareMessage, CONTACT_URL, MOTIFS, CAUSE_LABELS } from './report.js?v=be98175';
import { getProfile } from './profile.js?v=be98175';
import { saveReport } from './reports.js?v=be98175';
import { openShare } from './share.js?v=be98175';
import { sendLead, canonicalPosition, positionDepartment } from './lead.js?v=be98175';



// ── Le rapport ──
// Sans réponses suffisantes ni coordonnées valides, la vue renvoie au parcours de « Mon entreprise ».
export function renderDiagnostic() {
  var shell = el('diag-shell');
  if (!shell) return;
  var v = vs();
  var d = computeDiagnostic(v);
  if (!d || !canSeeReport(v)) { switchView('compare'); return; }
  if (!v.motif && !isDemo()) v.motif = getProfile().motif || null;

  d.src = sourcesOf(d.sector);
  destroyReportCharts();
  shell.innerHTML = reportScreen(v, d);
  mountReportCharts(shell); packPages(shell); saveReport(v);
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
      '<div id="diag-report">' + buildReport(v, d) + '</div>' +
      shareBlock(v, d);
}

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

// ── Coordonnées ──
// Elles partent vers Pardot (js/lead.js) au passage vers le rapport, et nomment le rapport.
export function contactError(c) {
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
  if (d.days) lines.push('Jours d\'arrêt par accident : ' + fmt1(d.days.co) + ' (secteur ' + fmt1(d.days.sec) + ')');
  if (v.arrets45 != null) lines.push('Arrêts de plus de 45 jours : ' + v.arrets45);
  if (d.mp) lines.push('Maladies professionnelles : ' + v.mp + ' sur l\'année, fréquence ' + fmt1(d.mp.co) + ' (secteur ' + fmt1(d.mp.sec) + ')');
  if (v.causes && v.causes.length) lines.push('Causes citées : ' + v.causes.map(function(k) { return CAUSE_LABELS[k] || k; }).join(', '));
  var practices = [['reserves', 'Réserves motivées'], ['suivi45', 'Suivi des arrêts > 45 j'], ['ijRecup', 'Rapprochement des IJ']]
    .filter(function(p) { return v[p[0]]; })
    .map(function(p) { return p[1] + ' : ' + (ANSWERS[v[p[0]]] || v[p[0]]); });
  if (practices.length) lines.push(practices.join(' ; '));
  return lines.join('\n');
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
