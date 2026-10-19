// ── Mon entreprise : l'autodiagnostic, une question par écran ──
// À gauche, le rapport se construit : chaque question pose une nouvelle page sur la pile, et la
// réponse s'y inscrit à mesure qu'on la tape. Les comparaisons de la page restent floues, « en
// calcul », jusqu'au rapport. Au contact, la pile se referme sous sa couverture, glisse dans une
// pochette dont l'étiquette se remplit, puis le panneau des questions s'efface pour le merci.
// Le rapport lui-même s'ouvre dans la vue diagnostic (diagnostic.js), imprimable en PDF.
// Les réponses vivent dans state.views.compare (vs()), que lisent computeDiagnostic et le rapport.

import { state } from './state.js?v=be98175';
import { el, esc, fmt1, frNum } from './utils.js?v=be98175';
import { hasFlag } from './route.js?v=be98175';
import { getData } from './data.js?v=be98175';
import { getProfile } from './profile.js?v=be98175';
import { markStep } from './checklist.js?v=be98175';
import { vs, resolveEntry, selectSector, bindSectorSearch, parseCount, flagInput } from './compare.js?v=be98175';
import { bindCompany, bindPosition } from './lead.js?v=be98175';
import { contactError, submitLead, openReport } from './diagnostic.js?v=be98175';
import { CAUSE_LABELS } from './report.js?v=be98175';

var STEPS = ['intro', 'societe', 'secteur', 'effectif', 'accidents', 'arrets', 'causes', 'mp', 'pratiques', 'contact', 'merci'];
var QUESTIONS = 8;   // de « societe » à « pratiques », ce que compte « Question n sur 8 »

// Les pages du rapport que les questions remplissent, et la teinte que chacune garde sur la pile.
var PAGE_OF = { societe: 0, secteur: 0, effectif: 1, accidents: 2, arrets: 3, causes: 4, mp: 5, pratiques: 6 };
var TINTS = ['#1D6FA3', '#E3F6F0', '#004A76', '#FCEDEA', '#EAF7FD', '#00B08B', '#FFF4DE'];
var PAGE_NAMES = ['Couverture', 'Votre profil', 'Votre position face à votre secteur', 'La gravité de vos arrêts',
  'D\'où viennent vos accidents', 'Vos maladies professionnelles', 'Votre feuille de route'];
var TRACK = [['Couverture', ['societe', 'secteur']], ['Profil', ['effectif']], ['Position', ['accidents']],
  ['Gravité', ['arrets']], ['Causes', ['causes']], ['Maladies', ['mp']], ['Pratiques', ['pratiques']], ['Envoi', ['contact']]];

var PRACTICES = [
  ['reserves', 'Vous émettez des réserves motivées quand les circonstances d\'un accident le justifient', [['oui', 'Oui'], ['non', 'Non'], ['nsp', 'Je ne sais pas']]],
  ['suivi45', 'Vous suivez les arrêts de plus de 45 jours', [['oui', 'Oui'], ['non', 'Non']]],
  ['ijRecup', 'Vous rapprochez les IJ avancées et remboursées', [['oui', 'Oui'], ['non', 'Non'], ['nsp', 'Je ne sais pas']]]
];

var lastPage = null;   // la page affichée au dernier rendu : la même page ne retombe pas sur la pile

function stepOf(v) { return STEPS[v.flowStep] || 'intro'; }
function entry(v) { var r = v.sector ? resolveEntry(v.sector) : null; return r ? r.entry : null; }
function causeLabel(k) { return k === 'Autres risques' ? 'Autre ou je ne sais pas' : (CAUSE_LABELS[k] || k); }

// ── Rendu ──
export function renderFlow() {
  var shell = el('flow-shell');
  if (!shell) return;
  var v = vs();
  if (v.flowStep == null) v.flowStep = 0;
  var step = stepOf(v);
  // Le merci se joue sur la page déjà là : la redessiner casserait le plan continu.
  if (step === 'merci' && shell.querySelector('.flow.is-thanks')) return;
  if (step === 'merci') { v.flowStep = STEPS.indexOf('contact'); step = 'contact'; }
  var page = step === 'contact' ? 'pack' : (PAGE_OF[step] != null ? PAGE_OF[step] : null);
  var lands = page !== lastPage;
  lastPage = page;
  // La couverture en attente devient la vraie sans coupe : elle part de l'inclinaison exacte où
  // flottait la fantôme, et son gris se fond dans le bleu (.flow-unghost).
  var ghost = page === 0 ? shell.querySelector('.flow-ghost') : null;
  var from = ghost ? getComputedStyle(ghost).transform : null;
  shell.innerHTML = '<div class="flow">' +
    '<div class="flow-left">' + track(step) +
      '<div class="flow-stage">' + stage(v, step, lands) + '</div>' +
      '<p class="flow-pageline">' + pageLine(step) + '</p>' +
    '</div>' +
    '<div class="flow-right">' + question(v, step) + '</div>' +
  '</div>';
  if (ghost) {
    var cover = shell.querySelector('.flow-cover');
    cover.classList.remove('flow-land-t');
    cover.style.setProperty('--from', from && from !== 'none' ? from : 'none');
    cover.classList.add('flow-unghost');
  }
  bind(step);
}

// Après le chargement d'un jeu de données : on redessine seulement si personne n'est en train de taper.
export function refreshFlow() {
  var shell = el('flow-shell');
  if (!shell || state.activeView !== 'compare') return;
  if (shell.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  renderFlow();
}

function goTo(i) {
  var v = vs();
  v.flowStep = Math.max(0, Math.min(STEPS.length - 1, i));
  renderFlow();
  // Sur téléphone, on remonte voir la page se poser, sans ouvrir le clavier.
  if (window.innerWidth <= 760) { el('flow-shell').scrollIntoView({ block: 'start' }); return; }
  var first = document.querySelector('#flow-shell .flow-q input:not([type=checkbox])');
  if (first) first.focus({ preventScroll: true });
}

// ── Le suivi en haut, une étape par page du rapport ──
function track(step) {
  var cur = -1;
  TRACK.forEach(function(t, i) { if (t[1].indexOf(step) >= 0) cur = i; });
  if (step === 'merci') cur = TRACK.length;
  var w = cur <= 0 ? 0 : Math.min(cur, TRACK.length - 1) / (TRACK.length - 1) * 100;
  return '<div class="flow-track"><div class="flow-track-line"><span style="width:' + w + '%"></span></div>' +
    '<ol>' + TRACK.map(function(t, i) {
      var st = i < cur ? 'done' : i === cur ? 'cur' : 'todo';
      return '<li class="is-' + st + '"><span class="flow-track-dot">' +
        (st === 'done' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>' : (i + 1)) +
        '</span><span class="flow-track-label">' + t[0] + '</span></li>';
    }).join('') + '</ol></div>';
}

function pageLine(step) {
  if (step === 'intro') return 'Votre rapport attend vos réponses';
  if (step === 'contact') return 'Votre rapport est prêt';
  return 'En cours · ' + PAGE_NAMES[PAGE_OF[step]];
}

// ── La scène : la pile, la page en cours, ou la pochette ──
function stage(v, step, lands) {
  if (step === 'intro') return ghostCover();
  if (step === 'contact') return pack(v);
  var idx = PAGE_OF[step];
  var under = '';
  for (var k = 0; k < idx; k++) {
    var d = idx - k;
    under += '<div class="flow-under" style="z-index:' + (10 - d) + ';background:' + TINTS[k] +
      ';transform:translate(' + (d * 6) + 'px,' + (d * 5) + 'px) rotate(' + ((k % 2 ? 1 : -1) * (0.8 + d * 0.5)).toFixed(1) + 'deg)"></div>';
  }
  var land = lands ? ' flow-land-' + ['t', 'r', 'l', 'r', 'l', 'r', 'l'][idx] : '';
  return under + PAGES[idx](v, land);
}

function caret() { return '<span class="flow-caret" aria-hidden="true"></span>'; }
// Une place du rapport que la saisie remplit : data-spot reçoit le texte, en clair ou en attente.
function spot(key, value, ghost) {
  var has = value != null && String(value).trim() !== '';
  return '<span class="flow-spot' + (has ? '' : ' is-ghost') + '" data-spot="' + key + '" data-ghost="' + esc(ghost) + '">' +
    esc(has ? String(value) : ghost) + '</span>';
}
function blurBars(heights, color, soft) {
  return '<div class="flow-bars flow-blur">' + heights.map(function(h, i) {
    return '<span style="height:' + h + '%;background:' + (i === 2 ? color : soft) + '"></span>';
  }).join('') + '</div>';
}
function calc(text, color) {
  return '<p class="flow-calc"' + (color ? ' style="color:' + color + '"' : '') + '><span class="flow-spin"></span>' + text + '</p>';
}
function lines(widths) {
  return '<div class="flow-lines">' + widths.map(function(w) { return '<span style="width:' + w + '%"></span>'; }).join('') + '</div>';
}

function ghostCover() {
  return '<div class="flow-sheet flow-ghost">' +
    '<div class="flow-cover-top"><strong>ayming</strong><span>Diagnostic de sinistralité</span></div>' +
    '<div class="flow-cover-mid"><span class="flow-cover-for">Rapport préparé pour</span>' +
      '<span class="flow-ghost-bar" style="width:72%;height:34px"></span><span class="flow-ghost-bar" style="width:52%;height:26px"></span></div>' +
    '<div class="flow-cover-bottom"><span>Vos réponses vont le remplir</span></div>' +
  '</div>';
}

function coverInner(v, typing) {
  var sectorTxt = v.sector ? v.sector + ' · ' + (v.sectorLib || '') : '';
  return '<div class="flow-cover-top"><strong>ayming</strong><span>Diagnostic de sinistralité</span></div>' +
    '<div class="flow-cover-mid"><span class="flow-cover-for">Rapport préparé pour</span>' +
      '<div class="flow-cover-name">' + spot('societe', (v.contact || {}).societe, 'Votre entreprise') + (typing === 'societe' ? caret() : '') + '</div>' +
      (typing === 'secteur' || v.sector ? '<div class="flow-cover-chip">' + spot('secteur', sectorTxt, 'Votre métier') + (typing === 'secteur' && !v.sector ? caret() : '') + '</div>' : '') +
    '</div>' +
    '<div class="flow-cover-bottom"><span>Accidents du travail et maladies professionnelles</span></div>';
}

var PAGES = [
  function cover(v, land) {
    return '<div class="flow-sheet flow-cover' + land + '">' + coverInner(v, stepOf(v)) + '</div>';
  },
  function profil(v, land) {
    return '<div class="flow-sheet flow-p-profil' + land + '">' +
      '<div class="flow-band" style="background:#E3F6F0">' +
        '<span class="flow-kick" style="color:#00936F">Votre profil</span>' +
        '<h3 class="flow-pt">Votre entreprise et sa taille</h3>' +
        '<div class="flow-giant">' + spot('effectif', v.effectif, '0') + caret() + '</div>' +
        '<p class="flow-giant-l">salariés</p>' +
      '</div>' +
      '<div class="flow-body"><p class="flow-small">Les accidents de votre secteur, par taille d\'entreprise</p>' +
        '<div class="flow-chart">' + blurBars([70, 45, 55, 30, 20], '#00B08B', '#B9E6D9') + '<span class="flow-scan"></span></div>' +
        calc('Comparaison aux entreprises de votre taille, en calcul', '#068367') + '</div>' +
    '</div>';
  },
  function position(v, land) {
    var dots = '';
    for (var j = 0; j < 56; j++) {
      dots += '<span style="left:' + ((j * 37 % 100) * 0.96 + 1) + '%;bottom:' + Math.min(6 + ((j * 53) % 50) + (j % 5) * 3, 70) + '%"></span>';
    }
    return '<div class="flow-sheet flow-p-position' + land + '">' +
      '<div class="flow-body">' +
        '<span class="flow-kick" style="color:#6FD3F7">Partie 1 · Vos accidents du travail</span>' +
        '<h3 class="flow-pt">Votre position face à votre secteur</h3>' +
        '<p class="flow-sentence">Chez vous, <span class="flow-pill">' + spot('accidents', v.accidents, '0') + caret() + '</span> accidents avec arrêt sur douze mois.</p>' +
      '</div>' +
      '<div class="flow-dots"><div class="flow-blur"><i></i>' + dots + '</div><span class="flow-scan"></span>' +
        '<em>Les entreprises de votre secteur, et vous</em></div>' +
      '<div class="flow-body">' + calc('Votre fréquence d\'accidents, en calcul', '#6FD3F7') + '</div>' +
    '</div>';
  },
  function gravite(v, land) {
    return '<div class="flow-sheet flow-p-gravite' + land + '">' +
      '<div class="flow-body">' +
        '<span class="flow-kick" style="color:#DC533A">Partie 1 · Vos accidents du travail</span>' +
        '<h3 class="flow-pt">La gravité de vos arrêts</h3>' +
        '<div class="flow-two">' +
          '<div class="flow-redcard"><span>Chez vous</span><div class="flow-redcard-n">' + spot('joursArret', v.joursArret, '0') + caret() + '</div><p>jours d\'arrêt sur l\'année</p>' +
            '<p class="flow-redcard-s">' + spot('arrets45', v.arrets45, '…') + ' de plus de 45 jours</p></div>' +
          '<div><div class="flow-chart flow-chart-tall">' + blurBars([40, 85, 62], '#DC533A', '#F2B4A6') + '<span class="flow-scan"></span></div>' +
            calc('Jours par accident, en calcul', '#B23E28') + '</div>' +
        '</div>' + lines([92, 66]) +
      '</div>' +
    '</div>';
  },
  function causes(v, land) {
    var picked = (v.causes || []);
    return '<div class="flow-sheet flow-p-causes' + land + '">' +
      '<div class="flow-body">' +
        '<span class="flow-kick" style="color:#0072B6">Partie 1 · Vos accidents du travail</span>' +
        '<h3 class="flow-pt">D\'où viennent vos accidents</h3>' +
        '<div class="flow-donut-wrap"><span class="flow-donut flow-blur"></span>' + calc('Les causes de votre secteur, en calcul') + '</div>' +
        '<div class="flow-chipbox"><span class="flow-small">Chez vous</span><div class="flow-chips" data-spot-chips>' +
          (picked.length ? picked.map(function(k) { return '<span class="flow-chip">' + esc(causeLabel(k)) + '</span>'; }).join('')
            : '<span class="flow-chips-empty">Cochez vos causes à droite' + caret() + '</span>') +
        '</div></div>' +
      '</div>' +
    '</div>';
  },
  function mp(v, land) {
    return '<div class="flow-sheet flow-p-mp' + land + '">' +
      '<div class="flow-band" style="background:linear-gradient(120deg,#00936F,#00B08B);color:#fff">' +
        '<span class="flow-kick" style="color:#D2F5EA">Partie 2 · Vos maladies professionnelles</span>' +
        '<h3 class="flow-pt">Les maladies reconnues dans votre métier</h3>' +
      '</div>' +
      '<div class="flow-body flow-two flow-two-mp">' +
        '<div class="flow-ring"><div class="flow-ring-n">' + spot('mp', v.mp, '?') + '</div><span>chez vous, sur l\'année</span></div>' +
        '<div><div class="flow-hbars flow-blur"><span style="width:92%"></span><span style="width:64%"></span><span style="width:42%"></span><span style="width:24%"></span></div>' +
          calc('Votre fréquence face à votre secteur, en calcul', '#068367') + '</div>' +
      '</div>' + '<div class="flow-body">' + lines([90, 62]) + '</div>' +
    '</div>';
  },
  function route(v, land) {
    var ICON = { oui: '✓', non: '✗', nsp: '?' };
    return '<div class="flow-sheet flow-p-route' + land + '">' +
      '<div class="flow-body">' +
        '<span class="flow-kick" style="color:#B7791F">Passer à l\'action</span>' +
        '<h3 class="flow-pt">Votre feuille de route</h3>' +
        '<ol class="flow-steps">' + PRACTICES.map(function(p, i) {
          var a = v[p[0]];
          return '<li><span class="flow-step-n" data-spot-practice="' + p[0] + '" data-state="' + (a || '') + '">' + (a ? ICON[a] : (i + 1)) + '</span>' +
            '<span class="flow-step-t">' + ['Les réserves motivées', 'Le suivi des arrêts longs', 'Le rapprochement des IJ'][i] + '</span></li>';
        }).join('') + '</ol>' +
        calc('L\'ordre de vos actions, en calcul', '#B7791F') + lines([88, 70, 54]) +
      '</div>' +
    '</div>';
  }
];

// La pochette : la pile s'aligne, la couverture se referme, le rapport glisse dedans, le rabat se
// ferme, la pochette se retourne et son étiquette attend les coordonnées.
function pack(v) {
  var c = v.contact || {};
  var gather = '';
  for (var g = 0; g < 6; g++) {
    var d = 6 - g;
    gather += '<div class="flow-rp-page" style="z-index:' + (g + 1) + ';background:' + TINTS[g] +
      ';--from:translate(' + (d * 6) + 'px,' + (d * 5) + 'px) rotate(' + ((g % 2 ? 1 : -1) * (0.8 + d * 0.5)).toFixed(1) + 'deg)"></div>';
  }
  return '<div class="flow-pk">' +
      '<div class="flow-pk-back"></div>' +
      '<div class="flow-rp">' + gather +
        '<div class="flow-rp-page" style="z-index:9;background:#FFF4DE"></div>' +
        '<div class="flow-rp-cover flow-cover">' + coverInner(v, null) + '</div>' +
      '</div>' +
      '<div class="flow-pk-front"></div>' +
      '<div class="flow-pk-flap"></div>' +
    '</div>' +
    '<div class="flow-pkf">' +
      '<button type="button" class="flow-pkf-open" data-flow-open aria-label="Ouvrir mon rapport" tabindex="-1"></button>' +
      '<div class="flow-pk-front flow-pkf-face">' +
        '<div class="flow-label">' +
          '<span class="flow-label-bar"></span>' +
          '<span class="flow-label-t">Diagnostic de sinistralité</span>' +
          '<span class="flow-label-k">À l\'attention de</span>' +
          '<span class="flow-label-who">' + spot('who', [c.prenom || getProfile().prenom, c.nom].filter(Boolean).join(' '), 'Votre nom') + '</span>' +
          '<span class="flow-label-fn">' + spot('fonction', c.fonction, 'Votre fonction') + '</span>' +
          '<span class="flow-label-co">' + esc(c.societe || 'Votre entreprise') + '</span>' +
          '<span class="flow-label-mail">' + spot('email', c.email, 'votre.adresse@entreprise.fr') + '</span>' +
        '</div>' +
        '<span class="flow-pk-brand">ayming</span>' +
      '</div>' +
    '</div>';
}

// ── Les questions ──
function facts(v) {
  var e = entry(v);
  if (!e) return {};
  var s = e.stats || {};
  var out = {};
  if (s.indice_frequence != null) out.accidents = 'Dans votre métier, on compte ' + fmt1(s.indice_frequence) + ' accidents avec arrêt pour 1 000 salariés.';
  if (s.at_1er_reglement > 0) out.arrets = 'Dans votre métier, un accident entraîne en moyenne ' + frNum(Math.round(s.journees_it / s.at_1er_reglement)) + ' jours d\'arrêt.';
  var rc = e.risk_causes || {};
  var top = Object.keys(rc).filter(function(k) { return k !== 'Autres risques'; }).sort(function(a, b) { return rc[b] - rc[a]; })[0];
  if (top && rc[top] > 0) out.causes = 'Dans votre métier, la première cause d\'accident est « ' + causeLabel(top) + ' », ' + Math.round(rc[top]) + ' % des accidents.';
  var mpData = getData('mp');
  var mpRes = mpData ? resolveEntry(v.sector, 'mp') : null;
  var mpN = mpRes && mpRes.entry.stats ? mpRes.entry.stats.mp_1er_reglement : null;
  if (mpN != null) out.mp = 'Dans votre métier, ' + frNum(mpN) + ' maladie' + (mpN > 1 ? 's' : '') + ' professionnelle' + (mpN > 1 ? 's ont' : ' a') + ' été reconnue' + (mpN > 1 ? 's' : '') + ' en un an.';
  return out;
}

function qHead(step, fact, title, lead) {
  var n = STEPS.indexOf(step);
  return '<div class="flow-progress"><span>Question ' + n + ' sur ' + QUESTIONS + '</span>' +
      '<span class="flow-progress-bar"><span style="width:' + Math.round(n / QUESTIONS * 100) + '%"></span></span></div>' +
    (fact ? '<p class="flow-fact">' + fact + '</p>' : '') +
    '<h2 class="flow-title">' + title + '</h2>' +
    (lead ? '<p class="flow-lead">' + lead + '</p>' : '');
}
function navBtns(label) {
  return '<p class="flow-error" id="flow-error" role="alert" hidden></p>' +
    '<div class="flow-nav"><button type="submit" class="flow-go">' + (label || 'Continuer') + ' <span aria-hidden="true">→</span></button>' +
    '<button type="button" class="flow-back" data-flow-back>Retour</button></div>';
}
function numField(id, key, label, value, placeholder, opts) {
  opts = opts || {};
  return '<label class="flow-label-f" for="' + id + '">' + label + '</label>' +
    '<input class="flow-field' + (opts.small ? ' is-small' : '') + '" id="' + id + '" type="text" inputmode="numeric" autocomplete="off"' +
      ' placeholder="' + placeholder + '" data-num="' + key + '" value="' + (value == null ? '' : esc(frNum(value))) + '">';
}

function question(v, step) {
  var f = facts(v);
  var c = v.contact || {};
  var body;
  switch (step) {
    case 'intro':
      return '<form class="flow-q flow-intro" data-flow-form>' +
        (v.sector ? '<p class="flow-fact">Votre métier, ' + esc(v.sector) + ' ' + esc(v.sectorLib || '') + '</p>' : '') +
        '<h1 class="flow-h1">Votre entreprise face à votre secteur, en huit questions.</h1>' +
        '<p class="flow-lead">Chaque réponse remplit une page de votre rapport, et ses comparaisons se calculent à mesure. Accidents, arrêts, causes et maladies professionnelles, face à votre métier.</p>' +
        '<ul class="flow-badges"><li>Environ deux minutes</li><li>Gratuit</li><li>Sans compte</li></ul>' +
        '<div class="flow-nav"><button type="submit" class="flow-go">Commencer <span aria-hidden="true">→</span></button></div>' +
      '</form>';
    case 'societe':
      body = qHead(step, null, 'Pour qui prépare-t-on ce rapport ?') +
        '<label class="flow-label-f" for="diag-societe">Nom de votre entreprise</label>' +
        '<div class="diag-picker flow-picker"><input class="flow-field" id="diag-societe" type="text" autocomplete="organization" placeholder="Ex. Maisons Durand" data-text="societe" value="' + esc(c.societe || '') + '">' +
        '<div class="autocomplete" id="diag-societe-ac"></div></div>' + navBtns();
      break;
    case 'secteur':
      body = qHead(step, null, 'Quel est votre métier ?', 'Votre code NAF ou quelques mots. Votre secteur sert de repère dans tout le rapport.') +
        (v.sector
          ? '<div class="flow-picked"><span class="flow-picked-code">' + esc(v.sector) + '</span><span>' + esc(v.sectorLib || '') + '</span>' +
              '<button type="button" class="flow-back" data-flow-sector-clear>Changer</button></div>'
          : '<label class="flow-label-f" for="flow-sector">Code NAF ou activité</label>' +
            '<div class="search-wrapper flow-picker"><input class="flow-field" id="flow-sector" type="text" autocomplete="off" placeholder="Ex. 4120A ou maisons individuelles" value="' + esc(v.sectorQuery || '') + '">' +
            '<div class="autocomplete" id="flow-sector-ac"></div></div>') +
        navBtns();
      break;
    case 'effectif':
      body = qHead(step, 'Nous vous comparons aussi aux entreprises de votre taille, pas seulement à votre secteur.', 'Combien de salariés comptez-vous ?') +
        numField('flow-effectif', 'effectif', 'Effectif moyen de l\'année', v.effectif, 'Ex. 80') + navBtns();
      break;
    case 'accidents':
      body = qHead(step, f.accidents, 'Et chez vous, combien d\'accidents avec arrêt sur l\'année ?') +
        numField('flow-accidents', 'accidents', 'Accidents du travail reconnus avec arrêt', v.accidents, 'Ex. 6') +
        '<p class="flow-hint">Ceux que la caisse a pris en charge avec un arrêt indemnisé, hors trajet et hors maladies professionnelles. Ils figurent sur votre compte AT/MP.</p>' + navBtns();
      break;
    case 'arrets':
      body = qHead(step, f.arrets, 'Combien de jours d\'arrêt ces accidents ont-ils représentés ?', 'Une estimation suffit. Chaque réponse est facultative.') +
        numField('flow-jours', 'joursArret', 'Jours d\'arrêt sur l\'année', v.joursArret, 'Ex. 290') +
        '<div class="flow-row">' +
          '<div>' + numField('flow-arrets45', 'arrets45', 'Dont accidents arrêtés plus de 45 jours', v.arrets45, 'Ex. 2', { small: true }) + '</div>' +
          '<div>' + numField('flow-deces', 'deces', 'Décès, s\'il y en a eu', v.deces, 'Ex. 0', { small: true }) + '</div>' +
        '</div>' +
        '<p class="flow-warn" id="flow-warn" hidden></p>' + navBtns();
      break;
    case 'causes':
      var e = entry(v) || {};
      var rc = e.risk_causes || {};
      var keys = Object.keys(rc).filter(function(k) { return k !== 'Autres risques' && rc[k] > 0; })
        .sort(function(a, b) { return rc[b] - rc[a]; }).slice(0, 6).concat(['Autres risques']);
      body = qHead(step, f.causes, 'D\'où viennent les vôtres ?', 'Plusieurs réponses possibles.') +
        '<div class="flow-opts" role="group" aria-label="Vos causes d\'accidents">' + keys.map(function(k, i) {
          var on = (v.causes || []).indexOf(k) >= 0;
          return '<button type="button" class="flow-opt' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-cause="' + esc(k) + '">' +
            '<span class="flow-key">' + 'ABCDEFG'[i] + '</span>' + esc(causeLabel(k)) + '</button>';
        }).join('') + '</div>' + navBtns();
      break;
    case 'mp':
      body = qHead(step, f.mp, 'Combien de maladies professionnelles reconnues chez vous, sur l\'année ?') +
        numField('flow-mp', 'mp', 'Maladies professionnelles reconnues', v.mp, 'Ex. 1') +
        '<div class="flow-quick"><button type="button" class="flow-opt is-inline" data-set-num="mp" data-value="0">Aucune</button></div>' + navBtns();
      break;
    case 'pratiques':
      body = qHead(step, 'Vos réponses ordonnent votre feuille de route.', 'Où en êtes-vous sur ces trois points ?') +
        PRACTICES.map(function(p) {
          return '<div class="flow-choice"><p>' + p[1] + '</p><div class="flow-choice-opts" role="group">' + p[2].map(function(o) {
            var on = v[p[0]] === o[0];
            return '<button type="button" class="flow-opt is-inline' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-choice="' + p[0] + '" data-value="' + o[0] + '">' + o[1] + '</button>';
          }).join('') + '</div></div>';
        }).join('') + navBtns();
      break;
    case 'contact':
      var prenom = c.prenom || getProfile().prenom || '';
      body = '<h2 class="flow-title">Vos résultats sont calculés.</h2>' +
        '<p class="flow-lead">À qui adresse-t-on votre rapport ? Il s\'ouvre aussitôt, à lire ici et à télécharger en PDF.</p>' +
        '<div class="flow-row">' +
          '<div><label class="flow-label-f" for="diag-prenom">Prénom' + (getProfile().prenom ? ' <span class="flow-from">repris de votre accueil</span>' : '') + '</label>' +
            '<input class="flow-field is-small" id="diag-prenom" type="text" autocomplete="given-name" data-text="prenom" data-live-to="who" value="' + esc(prenom) + '"></div>' +
          '<div><label class="flow-label-f" for="diag-nom">Nom</label>' +
            '<input class="flow-field is-small" id="diag-nom" type="text" autocomplete="family-name" data-text="nom" data-live-to="who" value="' + esc(c.nom || '') + '"></div>' +
        '</div>' +
        '<label class="flow-label-f" for="diag-fonction">Fonction</label>' +
        '<div class="diag-picker flow-picker opens-up"><input class="flow-field is-small" id="diag-fonction" type="text" autocomplete="off" placeholder="Ex. DRH, Responsable prévention" data-text="fonction" value="' + esc(c.fonction || '') + '">' +
          '<div class="autocomplete" id="diag-fonction-ac"></div></div>' +
        '<label class="flow-label-f" for="diag-email">E-mail professionnel</label>' +
        '<input class="flow-field is-small" id="diag-email" type="email" inputmode="email" autocomplete="email" data-text="email" value="' + esc(c.email || '') + '">' +
        // Piège à robots : hors écran et hors tabulation, seul un robot le remplit (submitLead).
        '<div class="diag-trap" aria-hidden="true"><label for="diag-site">Site web</label><input type="text" id="diag-site" name="site_web" tabindex="-1" autocomplete="off"></div>' +
        '<label class="diag-consent flow-consent"><input type="checkbox" id="diag-consent"' + (c.consent ? ' checked' : '') + '>' +
          '<span>J\'accepte qu\'Ayming me recontacte au sujet de ce diagnostic.</span></label>' +
        '<p class="diag-privacy">Vos réponses et vos coordonnées sont transmises à Ayming pour ce seul échange. ' +
          '<a href="https://www.ayming.fr/politique-de-protection-des-donnees-personnelles/" target="_blank" rel="noopener">Protection des données</a></p>' +
        navBtns('Voir mon rapport');
      break;
    default:
      return '';
  }
  return '<form class="flow-q" data-flow-form novalidate>' + body + '</form>';
}

// ── Saisie en direct ──
function setSpot(key, text) {
  document.querySelectorAll('#flow-shell [data-spot="' + key + '"]').forEach(function(s) {
    var has = text != null && String(text).trim() !== '';
    s.textContent = has ? String(text) : s.getAttribute('data-ghost');
    s.classList.toggle('is-ghost', !has);
  });
}
function contactOf(v) { if (!v.contact) v.contact = {}; return v.contact; }

function bind(step) {
  var shell = el('flow-shell');
  var v = vs();
  shell.querySelectorAll('input[data-num]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var n = parseCount(this.value);
      flagInput(this, n, 'Un nombre entier, par exemple 12.');
      v[this.dataset.num] = n;
      setSpot(this.dataset.num, this.value.trim() === '' ? '' : (n == null ? this.value : frNum(n)));
      if (step === 'arrets') warnArrets();
    });
  });
  shell.querySelectorAll('input[data-text]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var c = contactOf(v);
      c[this.dataset.text] = this.value.trim();
      if (this.dataset.liveTo === 'who') setSpot('who', [c.prenom, c.nom].filter(Boolean).join(' '));
      else setSpot(this.dataset.text, this.value);
    });
  });
  if (step === 'societe') bindCompany(el('diag-societe'), el('diag-societe-ac'), function(siret) {
    v.siret = siret;
    setTimeout(function() { var inp = el('diag-societe'); if (inp) { contactOf(v).societe = inp.value.trim(); setSpot('societe', inp.value); } }, 0);
  });
  if (step === 'contact') {
    var c = contactOf(v);
    if (!c.prenom && getProfile().prenom) c.prenom = getProfile().prenom;
    bindPosition(el('diag-fonction'), el('diag-fonction-ac'));
    el('diag-fonction').addEventListener('change', function() { contactOf(v).fonction = this.value.trim(); setSpot('fonction', this.value); });
    markStep('company');
  }
  if (step === 'secteur') {
    var si = el('flow-sector');
    if (si) {
      si.addEventListener('input', function() { v.sectorQuery = this.value; setSpot('secteur', this.value); });
      bindSectorSearch(si, el('flow-sector-ac'), function(code) { selectSector(code); v.sectorQuery = ''; renderFlow(); });
      if (v.sectorQuery) setSpot('secteur', v.sectorQuery);
    }
  }
}

function warnArrets() {
  var v = vs();
  var box = el('flow-warn');
  if (!box) return;
  var msg = null;
  if (v.accidents != null && ((v.arrets45 != null && v.arrets45 > v.accidents) || (v.deces != null && v.deces > v.accidents))) {
    msg = 'Ces chiffres dépassent vos ' + frNum(v.accidents) + ' accidents avec arrêt. Pensez à les vérifier.';
  } else if (v.joursArret != null && v.arrets45 > 0 && v.joursArret < 46 * v.arrets45) {
    msg = 'Un arrêt de plus de 45 jours en compte au moins 46. Cela fait au moins ' + frNum(46 * v.arrets45) + ' jours, plus que les ' + frNum(v.joursArret) + ' indiqués.';
  }
  box.hidden = !msg;
  box.textContent = msg || '';
}

// Ce qu'une question exige avant de passer à la suivante. Le reste est facultatif.
function stepError(step, v) {
  if (step === 'societe' && !(v.contact && v.contact.societe) && !hasFlag('demo')) return 'Indiquez le nom de votre entreprise, il figure sur la couverture de votre rapport.';
  if (step === 'secteur' && !v.sector) return 'Choisissez votre métier dans la liste.';
  if (step === 'effectif' && !(v.effectif > 0)) return 'Indiquez votre effectif, un nombre entier.';
  if (step === 'accidents' && v.accidents == null) return 'Indiquez vos accidents avec arrêt, 0 s\'il n\'y en a pas eu.';
  if (step === 'contact') {
    readContact();
    return contactError(v.contact);
  }
  return null;
}

function readContact() {
  var c = contactOf(vs());
  ['prenom', 'nom', 'email', 'fonction'].forEach(function(k) { var i = el('diag-' + k); if (i) c[k] = (i.value || '').trim(); });
  c.consent = !!(el('diag-consent') && el('diag-consent').checked);
  c.siret = vs().siret || '';
  c.trap = ((el('diag-site') || {}).value || '').trim();
  return c;
}

// ── Le merci : le panneau des questions s'efface, la pochette se centre, les confettis partent ──
function thanks() {
  var shell = el('flow-shell');
  var flow = shell.querySelector('.flow');
  var c = vs().contact || {};
  vs().flowStep = STEPS.indexOf('merci');
  var prenom = c.prenom || getProfile().prenom || '';
  // La hauteur reste celle de l'écran du contact : la pochette ne bouge que vers le centre.
  flow.style.height = flow.offsetHeight + 'px';
  var stageEl = flow.querySelector('.flow-stage');
  if (stageEl) stageEl.style.width = stageEl.offsetWidth + 'px';
  flow.classList.add('is-thanks');
  var left = flow.querySelector('.flow-left');
  left.insertAdjacentHTML('afterbegin', '<div class="flow-thanks-head"><h2>Merci' + (prenom ? ', ' + esc(prenom) : '') + ' !</h2>' +
    '<p>Votre rapport est prêt. Ouvrez-le pour le lire, et téléchargez-le en PDF.</p></div>');
  left.insertAdjacentHTML('beforeend', '<div class="flow-thanks-foot"><button type="button" class="flow-go" data-flow-open>Ouvrir mon rapport <span aria-hidden="true">→</span></button></div>');
  var open = flow.querySelector('.flow-pkf-open');
  if (open) open.removeAttribute('tabindex');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) shell.insertAdjacentHTML('beforeend', confetti());
  var btn = flow.querySelector('.flow-thanks-foot .flow-go');
  if (btn) setTimeout(function() { btn.focus({ preventScroll: true }); }, 900);
}

function confetti() {
  var COL = ['#00AEEF', '#00B08B', '#F6A85A', '#004A76', '#6FD3F7', '#DC533A', '#F5C344'];
  var SH = ['', ' is-dot', ' is-ribbon'];
  var out = '';
  for (var i = 0; i < 140; i++) {
    var leftSide = i % 2 === 0;
    var px = (leftSide ? 1 : -1) * (120 + (i * 53) % 520), py = -(380 + (i * 71) % 420);
    out += '<span class="flow-cf' + SH[i % 3] + '" style="' + (leftSide ? 'left:' : 'right:') + (2 + (i * 37) % 8) + '%;background:' + COL[i % 7] +
      ';--px:' + px + 'px;--py:' + py + 'px;--ex:' + Math.round(px * 1.5) + 'px;--rot:' + ((i * 97) % 900 + 200) + 'deg' +
      ';animation-duration:' + (2.6 + (i % 9) * 0.22).toFixed(2) + 's;animation-delay:' + (0.45 + (i % 20) * 0.03 + (i >= 70 ? 0.9 : 0)).toFixed(2) + 's"></span>';
  }
  return '<div class="flow-confetti" aria-hidden="true">' + out + '</div>';
}

// ── Événements ──
export function initFlow() {
  var shell = el('flow-shell');
  if (!shell) return;
  shell.addEventListener('submit', function(e) {
    if (!e.target.closest('[data-flow-form]')) return;
    e.preventDefault();
    var v = vs();
    var step = stepOf(v);
    var err = stepError(step, v);
    var box = el('flow-error');
    if (err) { if (box) { box.textContent = err; box.hidden = false; } return; }
    if (step === 'contact') { submitLead(v); thanks(); return; }
    goTo(v.flowStep + 1);
  });
  shell.addEventListener('click', function(e) {
    var t = e.target.closest('button');
    if (!t) return;
    var v = vs();
    if (t.hasAttribute('data-flow-back')) { goTo(v.flowStep - 1); return; }
    if (t.hasAttribute('data-flow-open')) { openReport(); return; }
    if (t.hasAttribute('data-flow-sector-clear')) {
      v.sector = null; v.sectorLevel = null; v.sectorLib = null;
      renderFlow();
      var si = el('flow-sector'); if (si) si.focus();
      return;
    }
    if (t.dataset.cause) {
      var list = (v.causes || []).slice();
      var k = t.dataset.cause, at = list.indexOf(k);
      if (at >= 0) list.splice(at, 1); else list.push(k);
      v.causes = list;
      t.classList.toggle('is-on', at < 0);
      t.setAttribute('aria-pressed', String(at < 0));
      var box = shell.querySelector('[data-spot-chips]');
      if (box) box.innerHTML = list.length ? list.map(function(c) { return '<span class="flow-chip">' + esc(causeLabel(c)) + '</span>'; }).join('')
        : '<span class="flow-chips-empty">Cochez vos causes à droite<span class="flow-caret" aria-hidden="true"></span></span>';
      return;
    }
    if (t.dataset.choice) {
      v[t.dataset.choice] = t.dataset.value;
      t.parentNode.querySelectorAll('.flow-opt').forEach(function(b) {
        var on = b === t;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      var mark = shell.querySelector('[data-spot-practice="' + t.dataset.choice + '"]');
      if (mark) { mark.textContent = { oui: '✓', non: '✗', nsp: '?' }[t.dataset.value]; mark.setAttribute('data-state', t.dataset.value); }
      return;
    }
    if (t.dataset.setNum) {
      v[t.dataset.setNum] = parseInt(t.dataset.value, 10);
      var input = shell.querySelector('input[data-num="' + t.dataset.setNum + '"]');
      if (input) input.value = t.dataset.value;
      setSpot(t.dataset.setNum, t.dataset.value);
    }
  });
  window.addEventListener('benchsector', function() {
    if (state.activeView === 'compare' && ['intro', 'secteur'].indexOf(stepOf(vs())) >= 0) renderFlow();
  });
}

// Arrivée depuis la landing (?q=) ou secteur repris de l'accueil : un code connu est choisi d'emblée,
// un mot-clé attend dans la question du métier.
export function prefillSector(query) {
  var q = (query || '').trim();
  var code = q.toUpperCase().replace(/[.\s]/g, '');
  if (!(code && selectSector(code))) vs().sectorQuery = q;
  renderFlow();
}

// ?test remplit tout le parcours et ouvre le rapport. Il vaut mode démonstration (diagnostic.js) :
// rien ne part vers Pardot. ?demo seul reste vide, car en rendez-vous on saisit les chiffres du prospect.
var TEST_ANSWERS = {
  effectif: 120, accidents: 9, joursArret: 540, arrets45: 3, deces: 0, mp: 1, motif: 'hausse',
  causes: ['Manutention manuelle', 'Chutes de hauteur'], reserves: 'non', suivi45: 'non', ijRecup: 'nsp',
  contact: { prenom: 'Test', nom: 'Ayming', email: 'test@ayming.com', societe: 'AYMING', fonction: 'Responsable Prévention', consent: true }
};
var testApplied = false;
export function prefillTest() {
  if (testApplied || !hasFlag('test')) return false;
  testApplied = true;
  var v = vs();
  if (!v.sector) selectSector('4120A');
  Object.keys(TEST_ANSWERS).forEach(function(k) { if (v[k] == null) v[k] = TEST_ANSWERS[k]; });
  v.flowStep = STEPS.indexOf('contact');
  return true;
}
