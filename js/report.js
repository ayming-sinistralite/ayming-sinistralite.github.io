// ── Le rapport : un guide personnalisé, pas une plaquette ──
// Il s'adresse au responsable RH et paie, ou au DRH, qui le lit et le porte : il lui donne le
// quoi et le pourquoi, et de quoi défendre un plan devant sa direction (la page « L'essentiel » se transmet
// telle quelle). Les thèmes suivent le parcours de travail d'Ayming : la
// prévention, la déclaration de chaque accident, la réponse aux questionnaires de maladie
// professionnelle, la collecte des arrêts et les IJ, puis les indemnités journalières.
// Chaque thème ouvre sur son statut, donne la règle, votre situation, puis ce que vous pouvez
// faire, en interne et avec Ayming. Un thème n'apparaît que s'il vous concerne.
// Conception sur le modèle du StoryBrand
// Marketing Report et le système de marque Ayming. Les textes clients passent le validateur de
// vocabulaire juridique d'Ayming.

import { resetReportCharts } from './report-charts.js?v=e9f97a8';
import { esc, aymingUrl, frNum, AYMING, fmt1 } from './utils.js?v=e9f97a8';
import { DATA_YEAR } from './state.js?v=e9f97a8';
import { CONTACT_URL } from './report-constants.js?v=e9f97a8';
import { buildThemes } from './report-themes.js?v=e9f97a8';
import { buildChapters } from './report-chapters.js?v=e9f97a8';
import { WHEN_ORDER } from './report-base.js?v=e9f97a8';
import { newPlan, addEdito, addEssentiel, addIntro, addSommaire, addParts, addFeuille, addQuestions, addAyming, addRdv, addRessources, renderPages } from './report-pages.js?v=e9f97a8';
import { ACCILINE, utm, FILL_MIN_MM, FILL, FILL_LEAD, FILL_VERB, resourceCard, qrSvg, gap } from './report-offers.js?v=e9f97a8';

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
  // Les parties se numérotent dans l'ordre où elles sont là : un secteur sans maladie reconnue n'a
  // pas de partie 2, et le passage à l'action devient alors la partie 2.
  var partN = {};
  chapters.pages.concat([{ part: 'action' }]).forEach(function(pg) { if (pg.part && !partN[pg.part]) partN[pg.part] = Object.keys(partN).length + 1; });

  var r = newPlan(v, d, now, main, chapters, actions, partN);
  addEdito(r);
  addEssentiel(r);
  addIntro(r);
  addSommaire(r);
  addParts(r);
  addFeuille(r);
  addQuestions(r);
  addAyming(r);
  addRdv(r);
  addRessources(r);
  var body = renderPages(r);
  var closing = closingPage(company, date);
  return coverPage(c, d, main, company, date) + body + closing;
}

// La dernière page, une quatrième de couverture : les deux marques et leurs sites, l'entreprise, la date et la mention
// qui borne le document, sous le même dégradé que la couverture, pris en miroir.
function closingPage(company, date) {
  return '<section class="rp-page rp-back">' +
    '<div class="rp-back-art" aria-hidden="true"></div>' +
    '<div class="rp-back-body">' +
      '<div class="rp-cover-logos">' +
        '<img src="assets/ayming-logo.png" alt="Ayming">' +
        '<img src="assets/acciline-logo.png" alt="Acciline+">' +
      '</div>' +
      '<p class="rp-back-title">Rapport de sinistralité AT/MP</p>' +
      '<p class="rp-back-company">' + company + ', ' + date + '</p>' +
      '<div class="rp-back-urls">' +
        '<a class="rp-back-url" href="' + aymingUrl('', 'dos-de-couverture', 'rapport') + '" target="_blank" rel="noopener">www.ayming.fr</a>' +
        '<a class="rp-back-url" href="' + ACCILINE + utm('dos-de-couverture') + '" target="_blank" rel="noopener">www.acciline.com</a>' +
      '</div>' +
      '<p class="rp-back-note">Ce document est un diagnostic comparatif, établi à partir des chiffres que vous avez indiqués et des statistiques publiées pour votre secteur. Il ne constitue ni un audit, ni un conseil juridique.</p>' +
    '</div>' +
  '</section>';
}

// La couverture : les deux marques côte à côte, le rapport, l'entreprise, puis le rapport éclaté de la page
// d'accueil, rempli avec les chiffres de l'entreprise, sur une diagonale au dégradé de marque.
function coverPage(c, d, main, company, date) {
  return '<section class="rp-page rp-cover">' +
    '<div class="rp-cover-top">' +
      '<div class="rp-cover-logos">' +
        '<img src="assets/ayming-logo.png" alt="Ayming">' +
        '<img src="assets/acciline-logo.png" alt="Acciline+">' +
      '</div>' +
      '<h1>Rapport de sinistralité AT/MP</h1>' +
      '<p class="rp-cover-for">Votre rapport personnalisé</p>' +
      '<p class="rp-cover-company">' + company + '</p>' +
      '<p class="rp-cover-meta">' + esc(d.sector) + ' · ' + esc(d.sectorLib) + ' · ' + frNum(d.effectif) + ' salariés · ' + date + '</p>' +
    '</div>' +
    '<div class="rp-cover-art" aria-hidden="true">' + coverStack(d, main) + '</div>' +
    '<p class="rp-cover-foot">' + (c.prenom ? 'Établi pour ' + esc(c.prenom) + ' ' + esc(c.nom) + ', à partir' : 'Établi à partir') +
      ' de vos réponses et des statistiques AT/MP ' + DATA_YEAR + ' de l\'Assurance Maladie.</p>' +
  '</section>';
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
      // La page rejointe garde son ancre : le sommaire mène à son intertitre.
      if (prev.offsetHeight <= a4 + 1) { pg.remove(); joined.id = pg.id; return; }
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
    ? '<p class="rp-p">' + (FILL_LEAD[pick.kind] || 'La ressource') + ' d\'Ayming, en accès libre. Scannez le code pour ' + (FILL_VERB[pick.kind] || 'le télécharger') + '.</p>' + resourceCard(pick, true, true)
    : '<a class="rp-res is-wide" href="' + CONTACT_URL + '&utm_content=' + tag + '" target="_blank" rel="noopener"><img src="assets/report/contact.jpg" alt="">' +
      '<span class="rp-res-body"><span class="rp-res-k">Rendez-vous</span><span class="rp-res-t">Échanger avec un consultant Ayming sur ' + (mp ? 'vos maladies professionnelles' : 'vos accidents du travail') + '</span></span>' +
      qrSvg(CONTACT_URL + '&utm_content=' + tag + '-qr') + '</a>');
  body.appendChild(box);
  if (pg.offsetHeight > a4 + 1) box.remove();
}

// Le rapport éclaté de la couverture, quatre feuillets comme sur la page d'accueil, écrits avec
// les chiffres et les thèmes de l'entreprise.
function coverStack(d, main) {
  var lib = d.sectorLib.length > 30 ? d.sectorLib.slice(0, 29).replace(/\s+\S*$/, '') + '…' : d.sectorLib;
  var band = '<div class="l-big">' + fmt1(d.at.co) + '</div><div class="l-cap">accidents avec arrêt pour 1 000 salariés</div>';
  var rows = [['Votre secteur', d.at.sec], ['Même taille', d.at.peer], ['France entière', d.at.nat]].filter(function(r) { return r[1] != null; });
  return '<div class="rp-stack">' +
      '<div class="layer-shadow"></div>' +
      '<div class="layer navy" style="--i:0"><div class="l-kicker">Le comparatif</div><div class="l-title">Votre entreprise face à son secteur</div><div class="l-ring"></div></div>' +
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
  // pourquoi s'y fier, ce que dit le diagnostic, ce que l'on en attend.
  var lines = [
    'Objet\u00A0: notre sinistralité AT/MP face à notre secteur',
    '',
    'Bonjour,',
    '',
    'Les accidents du travail et les arrêts qui en découlent pèsent sur notre organisation. Pour voir où nous en sommes, j\'ai établi un diagnostic comparatif de notre sinistralité.',
    '',
    'Il compare nos chiffres aux statistiques officielles de l\'Assurance Maladie pour notre secteur (' + d.sector + ', ' + d.sectorLib + '), qui couvrent les accidents déclarés par toutes les entreprises de ce secteur. En résumé\u00A0:',
    d.at.ratio != null
      ? '- notre fréquence d\'accidents du travail est ' + gap(d.at.ratio) + ' la moyenne du secteur (' + fmt1(d.at.co) + ' contre ' + fmt1(d.at.sec) + ' pour 1 000 salariés)'
      : '- notre secteur ne compte aucun accident avec arrêt dans les statistiques publiées, nous en sommes à ' + fmt1(d.at.co) + ' pour 1 000 salariés'
  ];
  if (acts.length) {
    lines.push('', 'Je propose de commencer par ' + (acts.length > 1 ? 'ces premières actions' : 'cette première action') + ' :');
    // Les actions sont rédigées pour le lecteur du guide ; dans le message, c'est l'entreprise qui parle.
    var ours = function(t) { return t.replace(/\bvotre\b/g, 'notre').replace(/\bvos\b/g, 'nos'); };
    acts.slice(0, 3).forEach(function(a) { lines.push('- ' + ours(a.text.charAt(0).toLowerCase() + a.text.slice(1)) + ', ' + a.whenLabel.toLowerCase()); });
  }
  lines.push('', 'L\'objectif est de réduire nos arrêts et de prévenir nos accidents là où notre secteur est le plus touché.');
  lines.push('', 'Le diagnostic complet est joint, sa page «\u00A0L\'essentiel, pour votre direction\u00A0» se lit en une minute. Pouvons-nous en parler cette semaine\u00A0?', '', (c.prenom ? c.prenom + ' ' + (c.nom || '') : '').trim());
  return { to: to, text: lines.join('\n') };
}
