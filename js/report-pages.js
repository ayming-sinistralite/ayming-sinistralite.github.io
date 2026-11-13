// ── Le rapport : les pages dans leur ordre ──
// Les parties, l'édito, puis une fonction par page ou groupe de pages, qui la pose dans le plan.

import { esc, fmt1, frNum } from './utils.js?v=e9f97a8';
import { CAUSE_LABELS, CONTACT_URL } from './report-constants.js?v=e9f97a8';
import { DATA_YEAR } from './state.js?v=e9f97a8';
import { gap, HUB_CARDS, offerLink, offerHref, OFFERS, qrSvg, PROOFS, RESOURCES, resourceCard } from './report-offers.js?v=e9f97a8';
import { plural, motifLead, stepNum, FOOT, foot, page } from './report-base.js?v=e9f97a8';
import { fmtNote, punch } from './report-figs.js?v=e9f97a8';

// Les parties, dans l'ordre des documents officiels. Chacune ouvre sur un intercalaire en
// aplat de sa couleur, qui annonce ses chiffres et ses pages.
var PARTS = {
  at: { title: 'Vos accidents|du travail', label: 'Vos accidents du travail',
    lede: 'Votre position, la gravité, les causes, les victimes, les arrêts et le trajet, face aux statistiques de votre secteur.' },
  mp: { title: 'Vos maladies|professionnelles', label: 'Vos maladies professionnelles',
    lede: 'Les maladies reconnues dans votre métier, qui elles touchent, après combien d\'années, et ce qu\'elles coûtent en arrêts.' },
  action: { title: 'Passer|à l\'action', label: 'Passer à l\'action',
    lede: 'Les actions à engager dans l\'ordre, les questions qu\'on vous posera, et ce qu\'Ayming peut faire avec vous.' }
};

// L'édito, le même dans chaque rapport, signé de l'équipe Ayming : pourquoi comprendre sa
// sinistralité, puis ce que le rapport donne. Le texte est celui du marketing (relecture du
// 27 octobre 2026), sans la cotisation, que le rapport n'aborde pas.
var EDITO = [
  'Comprendre sa sinistralité, c\'est aller au-delà du nombre d\'accidents du travail et de maladies professionnelles. C\'est prendre du recul sur ses indicateurs, observer leur évolution et les comparer à ceux de son secteur pour mieux cerner les risques auxquels son entreprise est exposée.',
  '<strong>Cette analyse est essentielle pour orienter les actions à mener.</strong>',
  'Une sinistralité élevée peut avoir des conséquences bien au-delà de la santé des salariés\u00A0: coûts liés aux absences, désorganisation des équipes ou encore temps consacré à la gestion des dossiers. Autant d\'enjeux qui nécessitent une approche globale, de la prévention des risques à la gestion des accidents.',
  '<strong>Encore faut-il savoir où agir en priorité.</strong>',
  'Ce rapport vous permet de situer vos indicateurs par rapport à ceux de votre secteur d\'activité, de repérer les écarts et de mieux comprendre les leviers à votre disposition. Des ressources complémentaires vous accompagnent pour approfondir ces sujets et nourrir votre réflexion.',
  'L\'objectif\u00A0: faire de vos données de sinistralité un point de départ pour orienter vos actions.'
];

// Les maladies reconnues du secteur (1er règlement), null quand l'entrée n'en publie pas.
export function sectorMpCount(d) {
  var mpEntry = d.mp && d.mp.entry;
  return mpEntry && mpEntry.stats ? mpEntry.stats.mp_1er_reglement : null;
}

// Les pages sont d'abord décrites, puis numérotées : le sommaire et les intercalaires renvoient
// à des pages qui ne sont connues qu'une fois toutes posées. Un contenu peut donc être une
// fonction, appelée au rendu avec le numéro de sa page. opts.group range la page au sommaire.
// Le plan porte les données du rapport (v, d, c, now, main, chapters, actions, partN) et les
// fonctions qui posent et retrouvent une page : chaque add* du module en pose une ou plusieurs.
export function newPlan(v, d, now, main, chapters, actions, partN) {
  var specs = [];
  function add(id, title, inner, opts) { specs.push({ id: id, title: title, inner: inner, opts: opts || {} }); }
  function numOf(id) { for (var i = 0; i < specs.length; i++) if (specs[i].id === id) return i + 2; return null; }
  function inGroup(g) { return specs.filter(function(sp) { return sp.opts.group === g && sp.opts.toc; }); }
  // Chaque ligne du sommaire mène à sa page, dans le PDF comme à l'écran. Chrome n'écrit un lien
  // interne au PDF que pour une ancre de l'adresse de base (<base href="/">), d'où le « #… » seul.
  // À l'écran, il mènerait à la page d'accueil : diagnostic.js fait défiler à sa place.
  function tocLink(id, inner) { return '<a class="rp-toc-a" href="#rp-' + id + '">' + inner + '</a>'; }
  function tocRow(sp) { return '<li>' + tocLink(sp.id, '<span>' + sp.opts.toc + '</span><span data-ref="' + sp.id + '">' + numOf(sp.id) + '</span>') + '</li>'; }
  return { v: v, d: d, c: v.contact || {}, now: now, main: main, chapters: chapters, actions: actions, partN: partN,
    specs: specs, add: add, numOf: numOf, inGroup: inGroup, tocLink: tocLink, tocRow: tocRow };
}

// L'édito, un panneau bleu nuit à gauche, signé.
export function addEdito(r) {
  var add = r.add;
  add('edito', null, function(n) {
    return '<section class="rp-page rp-edito">' +
      '<div class="rp-edito-panel">' +
        '<div class="rp-edito-logo"><img src="assets/ayming-logo.png" alt="Ayming"></div>' +
        '<h2>Édito</h2>' +
        '<p class="rp-edito-lead">Mieux comprendre sa sinistralité<br>pour mieux agir.</p>' +
        EDITO.map(function(t) { return '<p>' + t + '</p>'; }).join('') +
        '<p class="rp-edito-sign">L\'équipe Ayming</p>' +
        '<span class="rp-edito-n">' + n + '</span>' +
      '</div>' +
      '<div class="rp-edito-side"><span class="rp-edito-k">Propos introductifs</span></div>' +
    '</section>';
  }, { raw: true, group: 'front', toc: 'Édito' });
}

// L'essentiel, juste après l'édito : la page que vous transmettez à votre direction.
export function addEssentiel(r) {
  var v = r.v, c = r.c, d = r.d, chapters = r.chapters, add = r.add;
  var who = c.societe ? esc(c.societe) : 'l\'entreprise';
  var rowsE = [];
  // Une ligne par repère comparable : l'entreprise, son secteur, l'écart. L'écart se lit en rouge quand l'entreprise est au-dessus.
  // count : le nombre déclaré, sous un taux pour 1 000 qui gonfle dans une petite entreprise
  // (1 maladie pour 30 salariés se lit 33,3).
  function cmpRow(label, def, co, sec, ratio, f, count) {
    rowsE.push('<tr><td><strong>' + label + '</strong><span class="rp-def">' + def + '</span></td><td>' + f(co) + (count ? '<span class="rp-def">' + count + '</span>' : '') + '</td><td>' + f(sec) + '</td><td' + (ratio > 1.05 ? ' class="is-worse"' : '') + '>' + (ratio == null ? '<span class="rp-na">—</span>' : gap(ratio).replace(/ de$/, '').replace(/^au niveau$/, 'au niveau')) + '</td></tr>');
  }
  cmpRow('Fréquence d\'accidents', 'Accidents avec arrêt pour 1 000 salariés', d.at.co, d.at.sec, d.at.ratio, fmt1,
    'soit ' + plural(d.accidents, 'accident', 'accidents'));
  if (d.days && d.days.sec > 0) cmpRow('Jours d\'arrêt par accident', 'Durée moyenne de l\'arrêt', d.days.co, d.days.sec, d.days.co / d.days.sec, fmt1);
  var causeNames = (v.causes || []).filter(function(k) { return k !== 'Autres risques'; });
  var rcE = (d.entry || {}).risk_causes || {};
  var firstE = Object.keys(rcE).filter(function(k) { return k !== 'Autres risques'; }).sort(function(a, b) { return rcE[b] - rcE[a]; })[0];
  if (causeNames.length && firstE && rcE[firstE] > 0) {
    rowsE.push('<tr><td><strong>Causes principales</strong><span class="rp-def">Part des accidents du secteur</span></td><td>' + causeNames.map(function(k) { return esc(CAUSE_LABELS[k] || k); }).join(', ') + '</td><td>' +
      esc(CAUSE_LABELS[firstE] || firstE) + ', ' + fmt1(rcE[firstE]) + ' %</td><td' + (causeNames.indexOf(firstE) < 0 ? ' class="is-worse"' : '') + '>' + (causeNames.indexOf(firstE) >= 0 ? 'cause commune' : 'cause différente') + '</td></tr>');
  }
  if (d.mp && d.mp.co != null && d.mp.sec > 0) cmpRow('Maladies professionnelles', 'Maladies reconnues pour 1 000 salariés', d.mp.co, d.mp.sec, d.mp.co / d.mp.sec, fmt1,
    v.mp != null ? 'soit ' + plural(v.mp, 'maladie', 'maladies') : null);
  var noteMax = function(n) { return Math.max(n.a, n.b) || 1; };
  add('essentiel', 'L\'essentiel,|en une page',
    '<p class="rp-p">' + (d.at.ratio != null
      ? 'Votre <strong>fréquence d\'accidents est ' + gap(d.at.ratio) + ' la moyenne de votre secteur</strong>' + (d.at.peer > 0 ? ', et ' + gap(d.at.co / d.at.peer) + ' celle des établissements de votre taille' : '')
      : 'Votre secteur ne compte aucun accident avec arrêt dans les dernières statistiques publiées, sa moyenne ne permet donc pas de situer votre fréquence') + '. Cette page résume le rapport, ce qui distingue ' + who + ' de son secteur et ce qui ressort de votre secteur.</p>' +
    // Une petite entreprise ou peu d'accidents : un seul accident déplace le taux de 1 000 / effectif points.
    (d.at.ratio != null && d.effectif > 0 && (d.effectif < 100 || d.accidents < 10)
      ? '<p class="rp-small rp-smallnote">À cette taille, un seul accident déplace votre fréquence d\'environ ' + frNum(Math.max(1, Math.round(1000 / d.effectif))) + ' points : l\'écart donne un ordre de grandeur, pas un classement.</p>' : '') +
    '<div class="rp-figure"><p class="rp-find">Votre entreprise face à votre secteur</p><table class="rp-kpis rp-kpis-e"><thead><tr><th>Repère</th><th>Vous</th><th>Secteur</th><th>Écart</th></tr></thead><tbody>' + rowsE.join('') + '</tbody></table></div>' +
    (chapters.notes.length ? '<h3 class="rp-h3">Ce qui ressort de votre secteur</h3><div class="rp-notes">' +
      // Les cinq plus forts écarts, les accidents du travail d'abord et les maladies ensuite.
      chapters.notes.slice(0, 5).sort(function(a, b) { return (a.part === 'mp') - (b.part === 'mp'); }).map(function(n) {
        var u = n.unit === '%' ? ' %' : n.unit === 'j' ? ' j' : '';
        return '<div class="rp-note rp-part-' + n.part + '"><p><strong>' + n.head + ' :</strong> ' + n.label + '</p><div class="rp-note-bars">' +
          '<div><i style="width:' + Math.round(n.a / noteMax(n) * 100) + '%"></i><b>' + fmtNote(n.a, n.unit) + u + '</b></div>' +
          '<div class="is-ref"><i style="width:' + Math.round(n.b / noteMax(n) * 100) + '%"></i><span>' + fmtNote(n.b, n.unit) + u + ' en France</span></div></div></div>';
      }).join('') + '</div><p class="rp-small">Votre secteur, comparé à la France entière.</p>' : '') +
    '<p class="rp-small">Comparaison établie avec vos réponses et les statistiques publiées pour votre secteur.</p>',
    { kicker: 'Pour votre direction', ring: 'green', group: 'front', toc: 'L\'essentiel, pour votre direction', fill: ['webinaire-prevention'] });
}

// Introduction et méthodologie.
export function addIntro(r) {
  var v = r.v, d = r.d, add = r.add;
  // Les indicateurs du rapport, dans la méthodologie de l'introduction.
  var GLOSSARY = [['Indice de fréquence', 'Accidents avec arrêt pour 1 000 salariés'], ['Journées par accident', 'Durée moyenne de l\'incapacité temporaire'],
    ['Taux de gravité', 'Journées perdues pour 1 000 heures travaillées'], ['Incapacités permanentes', 'Pour 100 accidents, des séquelles définitives'], ['Décès', 'Pour 10 000 accidents']];
  // Introduction et méthodologie : le problème, puis d'où viennent les chiffres, comment les
  // lire et ce que le document n'est pas. Ce qu'Ayming fait et ses chiffres attendent la fin du
  // rapport (le rendez-vous).
  var secMp = sectorMpCount(d);
  var answers = [plural(d.effectif, 'salarié', 'salariés'), plural(d.accidents, 'accident avec arrêt', 'accidents avec arrêt'),
    v.joursArret != null ? plural(v.joursArret, 'jour d\'arrêt', 'jours d\'arrêt') + (v.arrets45 > 0 ? ' dont ' + plural(v.arrets45, 'arrêt', 'arrêts') + ' de plus de 45 jours' : '') : null,
    v.mp != null ? plural(v.mp, 'maladie professionnelle', 'maladies professionnelles') : null].filter(Boolean);
  add('intro', 'Pourquoi situer sa sinistralité|face à son métier',
    '<p class="rp-intro-lead">' + motifLead(v) + '</p>' +
    '<div class="rp-grid2 rp-intro-cols">' +
      '<p class="rp-p">Vous répondez de la santé de vos équipes et de ce qu\'elle coûte, mais le quotidien laisse peu de place au recul. Une déclaration d\'accident se fait dans l\'urgence, en 48 heures. Un questionnaire de maladie professionnelle arrive avec 30 jours pour répondre. Un arrêt long se découvre souvent quand il est déjà long.</p>' +
      '<p class="rp-p">Chaque dossier traité dans l\'urgence coûte ainsi en absences et en désorganisation. Ce rapport vous situe face à votre métier, avec les statistiques officielles de votre secteur, pour savoir où regarder en premier.</p>' +
    '</div>' +
    '<h3 class="rp-h3">Deux raisons expliquent qu\'une entreprise subisse sa sinistralité</h3>' +
    '<div class="rp-reasons">' +
      '<div>' + stepNum(1) + '<p>Elle n\'a pas de point de comparaison. Ses chiffres ne lui disent pas s\'ils sont hauts ou bas pour son métier.</p></div>' +
      '<div>' + stepNum(2) + '<p>Elle traite chaque dossier seul. C\'est pourtant leur ensemble qui dit où se situe l\'entreprise.</p></div>' +
    '</div>' +
    '<div class="rp-navy rp-method"><h3>Méthodologie</h3>' +
      '<p class="rp-method-lead">Ce diagnostic comparatif s\'appuie sur vos réponses au questionnaire et sur les statistiques de l\'Assurance Maladie relatives à l\'année ' + DATA_YEAR + '.</p>' +
      '<div class="rp-grid2">' +
      '<div><strong>Les chiffres de votre secteur</strong>Statistiques AT/MP ' + DATA_YEAR + ' de l\'Assurance Maladie pour le code NAF ' + esc(d.sector) + ', soit ' +
        plural(d.stats.at_1er_reglement || 0, 'accident avec arrêt', 'accidents avec arrêt') + (secMp ? ' et ' + plural(secMp, 'maladie professionnelle reconnue', 'maladies professionnelles reconnues') : '') + ' dans votre secteur. Les répartitions (causes, lésions, âges) décrivent votre secteur, jamais votre entreprise.</div>' +
      '<div><strong>Vos réponses</strong>' + answers.join(', ') + '. Rapportées à 1 000 salariés, elles se comparent à votre secteur et aux établissements de votre taille.</div>' +
      '</div>' +
      '<dl class="rp-glossary">' + GLOSSARY.map(function(g) { return '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>'; }).join('') + '</dl>' +
      '<p class="rp-legal">Ce document est un diagnostic comparatif. Il ne constitue ni un audit, ni un conseil juridique.</p>' +
    '</div>',
    { kicker: 'Introduction', ring: 'green', group: 'front', toc: 'Introduction et méthodologie' });
}

// Le sommaire, une barre de couleur par partie.
export function addSommaire(r) {
  var add = r.add, numOf = r.numOf, inGroup = r.inGroup, tocRow = r.tocRow, tocLink = r.tocLink, partN = r.partN;
  add('sommaire', 'Sommaire', function() {
    var parts = ['at', 'mp', 'action'].filter(function(k) { return numOf('part-' + k); });
    return '<p class="rp-toc-lead">Chaque ligne mène à sa page. L\'essentiel résume le rapport en une page.</p>' +
      '<ol class="rp-toc">' + inGroup('front').map(tocRow).join('') + '</ol>' +
      parts.map(function(k) {
        return '<div class="rp-toc-part rp-part-' + k + '"><div class="rp-toc-head">' + tocLink('part-' + k, '<span>Partie ' + partN[k] + '</span><span data-ref="part-' + k + '">' + numOf('part-' + k) + '</span>') + '</div>' +
          '<strong>' + PARTS[k].label + '</strong><ol>' + inGroup(k).map(tocRow).join('') + '</ol></div>';
      }).join('') +
      '<ol class="rp-toc rp-toc-end">' + inGroup('end').map(tocRow).join('') + '</ol>';
  }, { kicker: 'Sommaire', ring: 'green', cls: 'rp-sommaire' });
}

// L'intercalaire d'une partie, rendu avec le numéro de sa page.
function makeDivider(r) {
  var v = r.v, d = r.d, actions = r.actions, partN = r.partN, numOf = r.numOf, inGroup = r.inGroup;
  var secMp = sectorMpCount(d);
  var partFigures = {
    action: function() {
      return [[String(actions.length), actions.length > 1 ? 'actions dans votre feuille de route' : 'action dans votre feuille de route'],
        [String(HUB_CARDS.length), 'offres Ayming, de la prévention aux arrêts'],
        ['30 min', 'pour relire vos déclarations et vos arrêts avec un consultant']];
    },
    at: function() {
      var secDays = d.stats.at_1er_reglement ? d.stats.journees_it / d.stats.at_1er_reglement : null;
      var every = d.accidents > 0 ? Math.max(1, Math.round(220 / d.accidents)) : null;
      return [[fmt1(d.at.co), 'accidents avec arrêt pour 1 000 salariés, contre ' + fmt1(d.at.sec) + ' dans votre secteur'],
        [frNum(d.accidents), (d.accidents > 1 ? 'accidents reconnus' : 'accident reconnu') + ' avec arrêt sur l\'année' + (every > 1 ? ', un tous les ' + every + ' jours ouvrés' : every ? ', au moins un par jour ouvré' : '')],
        d.days && secDays ? [fmt1(d.days.co), 'jours d\'arrêt par accident, contre ' + fmt1(secDays) + ' dans votre secteur'] : null];
    },
    mp: function() {
      return [v.mp != null ? [frNum(v.mp), (v.mp > 1 ? 'maladies professionnelles reconnues' : 'maladie professionnelle reconnue') + ' chez vous sur l\'année'] : null,
        d.mp.co != null && d.mp.sec != null ? [fmt1(d.mp.co), 'maladies pour 1 000 salariés, contre ' + fmt1(d.mp.sec) + ' dans votre secteur'] : null,
        secMp ? [frNum(secMp), 'maladies reconnues dans votre secteur, ' + gap(d.mp.sec / d.mp.nat) + ' la moyenne nationale'] : null];
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
  return divider;
}

// Les trois parties, chacune derrière son intercalaire : les données du secteur
// appliquées à l'entreprise, puis ce qu'elle peut faire.
export function addParts(r) {
  var add = r.add, chapters = r.chapters, partN = r.partN, divider = makeDivider(r);
  var seen = {};
  chapters.pages.forEach(function(pg) {
    if (pg.part && !seen[pg.part]) { seen[pg.part] = true; add('part-' + pg.part, null, divider(pg.part), { raw: true }); }
    add(pg.id, pg.title, pg.html, { toc: pg.toc, kicker: pg.kicker && pg.kicker.replace(/^Partie \d+/, 'Partie ' + partN[pg.part]), part: pg.part, group: pg.part, hero: pg.hero, cls: pg.cls, fill: pg.fill });
  });
}

// La feuille de route : toutes les actions, dans l'ordre où les engager.
export function addFeuille(r) {
  var now = r.now, actions = r.actions, add = r.add, divider = makeDivider(r);
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
}

// Les questions qu'on vous posera.
export function addQuestions(r) {
  var main = r.main, add = r.add;
  var qas = main.filter(function(t) { return t.objection; }).map(function(t) { return t.objection; }).concat([
    ['«\u00A0Ces comparaisons sont-elles fiables\u00A0?\u00A0»', 'Elles reposent sur les statistiques officielles de l\'Assurance Maladie pour votre code NAF, mises en regard de vos chiffres. Un secteur réunit des entreprises très différentes, l\'écart se lit comme un repère pour savoir où regarder.'],
    ['«\u00A0Nous avons déjà nos conseils et nos comptables.\u00A0»', 'Ils sécurisent vos comptes et vos litiges. Le suivi des accidents et des arrêts, dossier par dossier, est un autre travail, qui se mène avec eux. Quand une expertise juridique s\'impose, elle est confiée à un cabinet d\'avocats indépendants, choisi d\'un commun accord.'],
    ['«\u00A0Pourquoi se faire aider sur ce travail\u00A0?\u00A0»', 'Parce qu\'il demande du volume, des délais tenus et une expertise pointue, dossier après dossier. Ayming vous aide sur l\'exécution, votre équipe garde le pilotage et les décisions, et gagne le temps de s\'y consacrer.'],
    ['«\u00A0Que deviennent les chiffres saisis\u00A0?\u00A0»', 'Le calcul se fait dans votre navigateur, et vos chiffres y restent tant que vous ne demandez pas votre rapport. Seule la recherche du nom de votre entreprise interroge l\'annuaire officiel des entreprises. Pour ce document, vos coordonnées, votre secteur, vos chiffres et vos réponses ont été transmis à Ayming, qui vous recontacte, elle ou sa filiale Acciline+, à son sujet.']
  ]);
  add('questions', 'Les questions|qu\'on vous posera',
    '<p class="rp-intro-lead">On nous pose ces questions à presque chaque rendez-vous, que ce soit la direction, l\'expert-comptable ou les équipes. Voici ce que nous répondons.</p>' +
    '<div class="rp-qa">' + qas.map(function(q) { return '<div><h4>' + q[0] + '</h4><p>' + q[1] + '</p></div>'; }).join('') + '</div>',
    { toc: 'Les questions qu\'on vous posera', group: 'action', kicker: 'Passer à l\'action' });
}

// Comment Ayming vous accompagne : le parcours, une offre par étape.
export function addAyming(r) {
  var add = r.add;
  add('ayming', 'Comment Ayming|peut vous aider',
    '<div class="rp-offers">' + HUB_CARDS.map(function(c) {
      return '<a class="rp-offer-card" href="' + offerHref(OFFERS[c[0]]) + '" target="_blank" rel="noopener">' +
        '<img src="assets/report/offres/' + c[0] + '.jpg" alt="">' +
        '<span class="rp-offer-body"><strong>' + c[2] + '</strong><span class="rp-offer-t">' + c[3] + '</span>' +
        '<span class="rp-offer-cta">Voir l\'offre</span></span></a>';
    }).join('') + '</div>',
    { toc: 'Comment Ayming peut vous aider', group: 'action', kicker: 'Passer à l\'action', cls: 'rp-offers-page' });
}

// Le rendez-vous.
export function addRdv(r) {
  var add = r.add;
  // Le rendez-vous, juste après les offres : ce que le rapport ne peut pas faire seul, relire
  // les déclarations et les arrêts un par un. Un bandeau bleu nuit, une
  // carte avec le bouton et son code QR, les trois étapes, puis les chiffres des consultants.
  add('rdv', null, function(n) {
    return '<section class="rp-page rp-rdv">' +
      '<header class="rp-rdv-band">' +
        '<span class="rp-divider-logo"><img src="assets/ayming-logo.png" alt="Ayming"></span>' +
        '<h2><span>Relisons ensemble</span><span>vos déclarations et vos arrêts, en 30 minutes</span></h2>' +
          '<p>Ce rapport compare votre entreprise à son secteur. Il ne voit pas vos accidents un par un. Un consultant Ayming reprend avec vous vos déclarations d\'accident, vos arrêts et vos IJ, et vous montre où agir en premier.</p>' +
      '</header>' +
      '<div class="rp-rdv-card"><div><strong>Prenons rendez-vous</strong><p>Citez ce diagnostic, un consultant vous rappelle.</p>' +
        '<a class="rp-rdv-btn" href="' + CONTACT_URL + '&utm_content=rapport" target="_blank" rel="noopener">Prendre rendez-vous</a>' +
        '<p class="rp-rdv-url">www.ayming.fr/contactez-nous</p></div>' + qrSvg(CONTACT_URL + '&utm_content=rapport-qr') + '</div>' +
      '<div class="rp-body"><h3 class="rp-h3">Comment se passe la suite</h3><ol class="rp-timeline">' +
        '<li><span class="rp-num">1</span><p>Vous prenez rendez-vous sur ayming.fr, en citant ce diagnostic.</p></li>' +
        '<li><span class="rp-num">2</span><p>En 30 minutes, un consultant relit avec vous vos déclarations, vos arrêts et vos indemnités journalières.</p></li>' +
        '<li><span class="rp-num">3</span><p>Vous choisissez ce qu\'Ayming vous aide à mener.</p></li>' +
      '</ol><div class="rp-rdv-proofs"><span class="rp-todo-k">Ce que nos consultants suivent chaque année</span>' + PROOFS + '</div></div>' +
      foot(n) +
    '</section>';
  }, { raw: true, group: 'action', toc: 'Relisons ensemble vos déclarations et vos arrêts' });
}

// À lire et à revoir.
export function addRessources(r) {
  var main = r.main, add = r.add;
  // À lire et à revoir : le livre blanc de la déclaration et le guide du taux, puis les ressources
  // des thèmes (celle des maladies figure déjà dans leur partie), le podcast et le guide des
  // accidents causés par un tiers, pour un nombre pair de cartes.
  var res = [];
  main.forEach(function(t) { (t.id === 'mp' ? [] : RESOURCES[t.id] || []).forEach(function(r) { if (res.indexOf(r) < 0) res.push(r); }); });
  res = RESOURCES.all.concat([RESOURCES.taux], res).slice(0, 8).concat(RESOURCES.podcasts, [RESOURCES.tiers]);
  add('ressources', 'À lire|et à revoir',
    '<p class="rp-p">Les guides, articles, webinaires et podcasts d\'Ayming sur les sujets de votre diagnostic, en accès libre. Scannez le code pour ouvrir chacun d\'eux.</p>' +
    '<div class="rp-res-grid">' + res.map(function(r) { return resourceCard(r, false, true); }).join('') + '</div>',
    { toc: 'À lire et à revoir', group: 'end', kicker: 'Pour aller plus loin' });
}

// Rendu : la couverture est la page 1, les autres suivent dans l'ordre des specs.
export function renderPages(r) {
  var specs = r.specs;
  return specs.map(function(sp, i) {
    var inner = typeof sp.inner === 'function' ? sp.inner(i + 2) : sp.inner;
    if (sp.opts.raw) return inner.replace('<section class="rp-page', '<section id="rp-' + sp.id + '" data-id="' + sp.id + '" class="rp-page');
    return page(i + 2, sp.title, inner, Object.assign({ id: sp.id }, sp.opts));
  }).join('');
}
