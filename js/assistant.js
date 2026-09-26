// ── Assistant « Virginie » : générateur de conversation + moteur de chat ──
//
// Deux moitiés :
//   1. buildConversation(...) : PUR. À partir des données d'un secteur, il construit
//      l'arbre de conversation (bulles d'intro, sujets, questions de suivi, offres),
//      remplit les chiffres, choisit les formulations (hash du NAF) et dessine les
//      illustrations inline. Aucun accès au DOM, testable hors navigateur.
//   2. Le moteur d'UI (bas du fichier) : rend cet arbre dans le panneau flottant,
//      gère la frappe, les puces, la navigation focalisée et le renvoi Mon entreprise.
//
// Le discours vit dans js/assistant-content.js. La logique (chiffres, gating, variantes)
// vit ici. Style ES5 volontaire (var, function expressions), cohérent avec le reste.

import { ASSISTANT_VIEWS, ASSISTANT_OFFERS, ASSISTANT_UTM, ASSISTANT_PERSONA, ASSISTANT_COMPARE, ASSISTANT_BASE_URL } from './assistant-content.js';
import { fmt, el, trapFocus, releaseFocus } from './utils.js';
import { state } from './state.js';
import { getStore, getData } from './data.js';
import { switchView } from './nav.js';
import { selectSector } from './compare.js';

// ══════════════════════════════════════════════════════════════════════════
// 1. GÉNÉRATEUR (pur)
// ══════════════════════════════════════════════════════════════════════════

// Hash déterministe d'une chaîne. Sert à choisir une variante stable par secteur.
function hashStr(str) {
  var h = 0;
  str = String(str);
  for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

// Choix de variante déterministe : même (secteur, tag) -> même formulation.
function pick(arr, code, tag) {
  if (!arr || !arr.length) return '';
  return arr[(hashStr(code) + hashStr(tag)) % arr.length];
}

function fmt1(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(1).replace('.', ',');
}

var UNITS = ['une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
function unitWord(k) { return (k >= 1 && k <= 10) ? UNITS[k - 1] : String(k); }

// « près de quatre fois », « deux fois », « deux fois et demie »... pour un multiple.
function foisWord(r) {
  if (r < 1.15) return 'à peu près autant';
  var lo = Math.floor(r);
  var frac = r - lo;
  if (Math.abs(r - Math.round(r)) <= 0.12 && Math.round(r) >= 2) return unitWord(Math.round(r)) + ' fois';
  if (frac >= 0.6) return 'près de ' + unitWord(lo + 1) + ' fois';
  if (frac <= 0.3 && lo >= 2) return 'un peu plus de ' + unitWord(lo) + ' fois';
  if (lo >= 2) return unitWord(lo) + ' fois et demie';
  return 'près d\'une fois et demie';
}

// Nombre arrondi « joli », préfixé « près de » quand on a arrondi vers le bas.
function approxNumber(n) {
  if (n == null || isNaN(n)) return '';
  if (n >= 10000) {
    var r = Math.round(n / 1000) * 1000;
    return (r < n ? 'près de ' : r > n ? 'environ ' : '') + '<b>' + fmt(r) + '</b>';
  }
  if (n >= 1000) {
    var r2 = Math.round(n / 100) * 100;
    return (r2 !== n ? 'près de ' : '') + '<b>' + fmt(r2) + '</b>';
  }
  return '<b>' + fmt(n) + '</b>';
}

// Part exprimée en mots quand un dénominateur simple tombe juste, sinon en pourcent.
function partWord(pct) {
  var p = Math.round(pct);
  if (p >= 48 && p <= 52) return 'la moitié';
  if (p >= 30 && p <= 36) return 'un tiers';
  if (p >= 23 && p <= 27) return 'un quart';
  if (p >= 64 && p <= 69) return 'les deux tiers';
  if (p >= 73 && p <= 77) return 'les trois quarts';
  if (p >= 18 && p <= 22) return 'un cinquième';
  return p + ' %';
}

function magnitudeWord(absDelta) {
  var p = Math.round(absDelta * 100);
  if (p >= 45 && p <= 55) return 'de moitié';
  if (p >= 30 && p <= 36) return 'd\'un tiers';
  if (p >= 22 && p <= 28) return 'd\'un quart';
  if (p >= 17 && p <= 22) return 'd\'environ un cinquième';
  if (p >= 8 && p <= 12) return 'd\'environ un dixième';
  return 'd\'environ ' + p + ' %';
}

// Libellés de causes mis en forme (article + accents). Clé = libellé brut du JSON.
var CAUSE_NICE = {
  'Manutention manuelle': { a: 'la manutention manuelle', A: 'La manutention manuelle' },
  'Chutes de plain-pied': { a: 'les chutes de plain-pied', A: 'Les chutes de plain-pied' },
  'Chutes de hauteur': { a: 'les chutes de hauteur', A: 'Les chutes de hauteur' },
  'Risque routier': { a: 'le risque routier', A: 'Le risque routier' },
  'Risque machines': { a: 'le risque machine', A: 'Le risque machine' },
  'Outillage a main': { a: 'l\'outillage à main', A: 'L\'outillage à main' },
  'Risque physique': { a: 'le risque physique', A: 'Le risque physique' },
  'Agressions': { a: 'les agressions', A: 'Les agressions' },
  'Manutention mecanique': { a: 'la manutention mécanique', A: 'La manutention mécanique' },
  'Risque chimique': { a: 'le risque chimique', A: 'Le risque chimique' },
  'Autres vehicules': { a: 'les autres véhicules', A: 'Les autres véhicules' },
  'Autres risques': { a: 'les autres risques', A: 'Les autres risques' }
};
function causeNice(label, cap) {
  var n = CAUSE_NICE[label];
  if (n) return cap ? n.A : n.a;
  return cap ? label : label.toLowerCase();
}

// ── Illustrations inline, dessinées depuis les vraies valeurs ──
function bar(label, widthPct, color, valTxt) {
  return '<div class="ib"><span class="ibl">' + label + '</span>' +
    '<span class="itrack"><span class="ibar" style="width:' + widthPct + '%;background:' + color + '"></span></span>' +
    '<span class="ibv">' + valTxt + '</span></div>';
}

// Couleur de la barre secteur selon l'écart : rouge si franchement au-dessus,
// accent si modérément au-dessus, vert si sous la moyenne. Évite le « tout rouge ».
function sevColor(ratio) {
  return ratio >= 2 ? 'var(--danger)' : ratio >= 1.15 ? 'var(--accent)' : 'var(--safe)';
}

// Deux barres comparées, ANCRÉES sur la moyenne nationale (barre de référence à
// environ un quart de la piste). La longueur de la barre secteur traduit alors
// l'écart réel et varie d'un secteur à l'autre, au lieu d'être toujours pleine.
function twoBar(a, b, ratio, caption) {
  var ref = Math.max(a, b * 4, 0.0001);
  return '<div class="illus">' +
    bar('Ce secteur', Math.max(3, Math.min(100, Math.round(a / ref * 100))), sevColor(ratio), fmt1(a)) +
    bar('Moyenne France', Math.max(3, Math.min(100, Math.round(b / ref * 100))), 'var(--text-dim)', fmt1(b)) +
    '<div class="icap">' + caption + '</div></div>';
}

function illusIfBars(ctx) {
  return twoBar(ctx.s.indice_frequence || 0, ctx.nat.indice_frequence || 0, ctx.ifRatio,
    'Indice de fréquence, accidents pour 1 000 salariés');
}

function illusGravBars(ctx) {
  return twoBar(ctx.s.taux_gravite || 0, ctx.nat.taux_gravite || 0, ctx.tgRatio,
    'Taux de gravité, journées perdues pour 1 000 heures');
}

function illusCauseBar(ctx) {
  var sorted = ctx.causesSorted;
  if (!sorted.length) return '';
  var top = sorted[0];
  var second = sorted[1];
  // Part sur cent : une cause à 32 % occupe 32 % de la piste (lecture honnête).
  var html = '<div class="illus">' +
    bar(causeNice(top[0], true), Math.max(3, Math.min(100, Math.round(top[1]))), 'var(--accent)', Math.round(top[1]) + ' %');
  if (second) html += bar(causeNice(second[0], true), Math.max(3, Math.min(100, Math.round(second[1]))), 'var(--text-dim)', Math.round(second[1]) + ' %');
  html += '<div class="icap">Part des accidents du secteur, par cause</div></div>';
  return html;
}

function illusSpark(ctx) {
  var series = ctx.trendSeries;
  if (!series || series.length < 2) return '';
  var min = Math.min.apply(null, series);
  var max = Math.max.apply(null, series);
  var span = (max - min) || 1;
  var n = series.length;
  var pts = series.map(function (v, i) {
    var x = 4 + i * (112 / (n - 1));
    var y = 30 - ((v - min) / span) * 26;
    return (Math.round(x * 10) / 10) + ',' + (Math.round(y * 10) / 10);
  });
  var last = pts[pts.length - 1].split(',');
  var col = ctx.trendBand === 'good' ? 'var(--safe)' : ctx.trendBand === 'bad' ? 'var(--danger)' : 'var(--accent)';
  return '<div class="illus">' +
    '<svg class="spark" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="' + col + '"></circle>' +
    '</svg>' +
    '<div class="icap">' + ctx.sparkCaption + '</div></div>';
}

var ILLUS_FN = { ifBars: illusIfBars, gravBars: illusGravBars, causeBar: illusCauseBar, spark: illusSpark };

// ── Lien offre avec UTM complets ──
function offerLink(offerKey, code) {
  var o = ASSISTANT_OFFERS[offerKey];
  if (!o) return '';
  var U = ASSISTANT_UTM;
  var href = ASSISTANT_BASE_URL + o.url +
    '?utm_source=' + U.source + '&utm_medium=' + U.medium + '&utm_campaign=' + U.campaign +
    '&utm_content=' + offerKey + '&utm_term=' + encodeURIComponent(code);
  return '<span class="offer-wrap"><a class="offer-link" href="' + href + '" target="_blank" rel="noopener">' +
    o.title + ' <span class="arr">&rarr;</span></a></span>';
}

// ── Remplissage des placeholders ──
function fillVars(str, vars) {
  return str.replace(/\{(\w+)\}/g, function (m, key) {
    return (vars[key] != null) ? vars[key] : m;
  });
}

// Résout le texte d'une bulle (tableau de variantes ou objet par bande), puis remplit.
function resolveBubble(bubble, ctx, tag) {
  var arr;
  if (bubble.text) {
    arr = bubble.text;
  } else if (bubble.textByBand) {
    var keyset = bubble.textByBand;
    var bandKey = (keyset.good !== undefined || keyset.bad !== undefined) ? ctx.trendBand : ctx.sevBand;
    arr = keyset[bandKey] || keyset[Object.keys(keyset)[0]];
  } else {
    arr = [''];
  }
  var raw = pick(arr, ctx.code, tag);
  var html = fillVars(raw, ctx.vars);
  // Le niveau (bordure colorée) suit la bande : rouge pour une exposition ou une
  // hausse marquée, vert pour une baisse, neutre sinon. Un secteur proche de la
  // moyenne ne porte pas de bordure d'alerte.
  var level = bubble.level || null;
  if (bubble.textByBand) {
    var bk = (bubble.textByBand.good !== undefined || bubble.textByBand.bad !== undefined) ? ctx.trendBand : ctx.sevBand;
    if (bk === 'good') level = 'good';
    else if (bk === 'bad' || bk === 'severe' || bk === 'high') level = 'alert';
    else level = null;
  }
  var illusHtml = (bubble.illus && ILLUS_FN[bubble.illus]) ? ILLUS_FN[bubble.illus](ctx) : '';
  return { html: html, level: level, illusHtml: illusHtml };
}

// Une bulle de contenu, puis (si une illustration l'accompagne) une bulle légère
// dédiée au graphique. La séparer allège la bulle de texte, le graphique respire.
function expand(bubble, ctx, tag) {
  var r = resolveBubble(bubble, ctx, tag);
  var out = [{ html: r.html, level: r.level }];
  if (r.illusHtml) out.push({ html: r.illusHtml, level: null, illus: true });
  return out;
}

// ── Gating : un sujet ne s'affiche que si sa donnée le justifie ──
function gateOk(topic, ctx) {
  var g = topic.gate;
  var s = ctx.s;
  switch (g) {
    case 'always':
      // « always » reste conditionné à l'existence d'une valeur à raconter.
      if (topic.key === 'journees') return (s.journees_it || 0) > 0;
      if (topic.key === 'declarations') return ctx.eventCount > 0;
      if (topic.key === 'reconnaissance') return ctx.eventCount > 0;
      if (topic.key === 'volume') return ctx.eventCount > 0;
      return true;
    case 'ifHigh': return ctx.ifRatio >= 1.3;
    case 'gravHigh': return !!s.taux_gravite && ctx.tgRatio >= 1.3;
    case 'hasCause': return ctx.causesSorted.length > 0 && ctx.causesSorted[0][1] >= 30;
    case 'hasTrend': return ctx.hasTrend;
    case 'hasIp': return (s.nouvelles_ip || 0) > 0;
    case 'severeMp': return ctx.eventCount > 0 && (s.ip_taux_sup_10 || 0) / ctx.eventCount >= 0.08;
    case 'hasTiers': return ctx.eventCount >= 200;
    default: return true;
  }
}

// Construit le contexte de calcul commun à toutes les bulles.
function buildContext(viewId, s, nat, causes, cfg, yearly, code, libelle, years) {
  var ifRatio = (nat && nat.indice_frequence > 0) ? s.indice_frequence / nat.indice_frequence : 1;
  var tgRatio = (s.taux_gravite && nat && nat.taux_gravite > 0) ? s.taux_gravite / nat.taux_gravite : 0;
  var eventCount = s[cfg.eventKey] || 0;

  var causesSorted = causes
    ? Object.keys(causes).map(function (k) { return [k, causes[k]]; })
        .filter(function (p) { return p[1] > 0; })
        .sort(function (a, b) { return b[1] - a[1]; })
    : [];

  var firstYr = (years && years.length) ? years[0] : null;
  var lastYr = (years && years.length) ? years[years.length - 1] : null;

  // Série de tendance : IF pour l'AT, volume d'événements pour MP et trajet.
  var trendSeries = null, trendDelta = 0, hasTrend = false;
  if (yearly && years && years.length >= 2) {
    var metric = (viewId === 'at') ? 'indice_frequence' : 'events';
    trendSeries = years.map(function (y) {
      var yr = yearly[y];
      if (!yr) return null;
      return (metric === 'events') ? (yr.events != null ? yr.events : yr.indice_frequence) : yr.indice_frequence;
    });
    if (trendSeries.indexOf(null) === -1) {
      var f = trendSeries[0], l = trendSeries[trendSeries.length - 1];
      if (f > 0) { trendDelta = (l - f) / f; hasTrend = Math.abs(trendDelta) >= 0.10; }
    } else {
      trendSeries = null;
    }
  }
  var trendBand = trendDelta <= -0.05 ? 'good' : trendDelta >= 0.05 ? 'bad' : 'flat';

  var sevBand = ifRatio >= 3 ? 'severe' : ifRatio >= 1.6 ? 'high' : ifRatio >= 1.3 ? 'elevated' : 'moderate';

  var sparkCaptionMap = {
    at: 'Fréquence des accidents, ' + firstYr + ' à ' + lastYr,
    mp: 'Maladies reconnues, ' + firstYr + ' à ' + lastYr,
    trajet: 'Accidents de trajet, ' + firstYr + ' à ' + lastYr
  };

  var top = causesSorted[0], second = causesSorted[1];

  var vars = {
    sector: libelle || code,
    ifWord: '<b>' + foisWord(ifRatio) + '</b>',
    ifPct: '<b>' + Math.round((ifRatio - 1) * 100) + ' %</b>',
    gravWord: 'de <b>' + foisWord(tgRatio) + '</b>',
    topCause: top ? causeNice(top[0], true) : '',
    secondCause: second ? causeNice(second[0], false) : 'les autres',
    topCausePct: top ? '<b>' + partWord(top[1]) + '</b>' : '',
    atCount: approxCount(eventCount),
    mpCount: approxCount(eventCount),
    trajetCount: approxCount(eventCount),
    journeesWord: approxNumber(s.journees_it || 0),
    ipCount: approxCount(s.nouvelles_ip || 0),
    trendWord: '<b>' + magnitudeWord(Math.abs(trendDelta)) + '</b>',
    trendDir: trendDelta <= -0.02 ? 'en recul' : trendDelta >= 0.02 ? 'en hausse' : 'globalement stable',
    firstYr: firstYr
  };

  return {
    viewId: viewId, s: s, nat: nat, code: code, cfg: cfg,
    ifRatio: ifRatio, tgRatio: tgRatio, eventCount: eventCount,
    causesSorted: causesSorted,
    trendSeries: trendSeries, trendDelta: trendDelta, hasTrend: hasTrend, trendBand: trendBand,
    sevBand: sevBand, sparkCaption: sparkCaptionMap[viewId], vars: vars
  };
}

// Petits comptes exacts (en gras), gros comptes arrondis.
function approxCount(n) {
  if (n >= 1000) return approxNumber(n);
  return '<b>' + fmt(n) + '</b>';
}

// Point d'entrée du générateur. Retourne l'arbre prêt à rendre.
export function buildConversation(viewId, s, nat, causes, cfg, yearly, code, libelle, years) {
  var content = ASSISTANT_VIEWS[viewId];
  if (!content) return null;
  var ctx = buildContext(viewId, s, nat, causes, cfg, yearly, code, libelle, years);

  var intro = [];
  content.intro.forEach(function (b, i) { intro = intro.concat(expand(b, ctx, 'intro' + i)); });

  var topics = content.topics.filter(function (t) { return gateOk(t, ctx); }).map(function (t) {
    var bubbles = [];
    t.bubbles.forEach(function (b, i) { bubbles = bubbles.concat(expand(b, ctx, t.key + '.b' + i)); });
    var followups = (t.followups || []).map(function (fu, fi) {
      var fbubbles = [];
      fu.bubbles.forEach(function (b, i) { fbubbles = fbubbles.concat(expand(b, ctx, t.key + '.f' + fi + '.b' + i)); });
      var help = fu.help ? fillVars(pick(fu.help, ctx.code, t.key + '.f' + fi + '.help'), ctx.vars) : '';
      var tail = help + (fu.offer ? offerLink(fu.offer, code) : '');
      return {
        key: t.key + '.f' + fi,
        chip: pick(fu.chip, ctx.code, t.key + '.f' + fi + '.chip'),
        q: pick(fu.q, ctx.code, t.key + '.f' + fi + '.q'),
        bubbles: fbubbles,
        tail: tail,
        offer: fu.offer || null
      };
    });
    return {
      key: t.key,
      chip: pick(t.chip, ctx.code, t.key + '.chip'),
      q: pick(t.q, ctx.code, t.key + '.q'),
      bubbles: bubbles,
      followups: followups
    };
  });

  return {
    persona: ASSISTANT_PERSONA,
    code: code,
    libelle: libelle || code,
    intro: intro,
    topics: topics,
    compare: {
      chip: ASSISTANT_COMPARE.chip,
      invite: pick(ASSISTANT_COMPARE.invite, ctx.code, 'invite'),
      handoff: pick(ASSISTANT_COMPARE.handoff, ctx.code, 'handoff')
    }
  };
}


// ══════════════════════════════════════════════════════════════════════════
// 2. MOTEUR D'UI (panneau flottant + lanceur)
// ══════════════════════════════════════════════════════════════════════════

var els = null;          // références DOM, mises en cache à l'init
var tree = null;         // arbre de conversation du secteur courant
var nodeMap = {};        // id -> noeud (sujet d'entrée ou question de suivi)
var isOpen = false;
var reduce = false;
var timers = [];
var visited = {};        // sujets et questions déjà vus
var pool = null;         // entonnoir courant : ids des suivis d'un sujet
var teaserShown = false; // la bulle d'accroche ne s'affiche qu'une fois par session
var entriesExpanded = false; // « Plus de sujets » déplié ? (pied allégé au départ)
var browsing = false;    // l'utilisateur a demandé « Autres sujets » (menu d'entrée)
var ENTRY_SHOWN = 4;     // nombre de sujets d'entrée montrés avant le dépliage

function cacheEls() {
  els = {
    launcher: el('assistantLauncher'),
    teaser: el('assistantTeaser'),
    teaserX: el('assistantTeaserX'),
    launchBtn: el('assistantLaunchBtn'),
    launchBadge: el('assistantLaunchBadge'),
    panel: el('assistantPanel'),
    closeBtn: el('assistantClose'),
    body: el('assistantBody'),
    foot: el('assistantFoot')
  };
}

// ── Frappe et bulles ──
function wait(ms) { return new Promise(function (res) { var t = setTimeout(res, reduce ? 0 : ms); timers.push(t); }); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function scrollBottom() { if (els.body) els.body.scrollTop = els.body.scrollHeight; }

function avatarTag() { return '<img class="va-av" src="' + ASSISTANT_PERSONA.avatar + '" alt="">'; }

function botMsg(html, level, illus) {
  var m = document.createElement('div');
  m.className = 'va-msg va-bot' + (level ? ' ' + level : '') + (illus ? ' va-illusonly' : '');
  m.innerHTML = avatarTag() + '<div class="va-bubble">' + html + '</div>';
  els.body.appendChild(m); scrollBottom();
}
function userMsg(text) {
  var m = document.createElement('div');
  m.className = 'va-msg va-user';
  m.innerHTML = '<div class="va-bubble"></div>';
  m.querySelector('.va-bubble').textContent = text;
  els.body.appendChild(m); scrollBottom();
}
function typingIndicator() {
  var t = document.createElement('div');
  t.className = 'va-typing';
  t.innerHTML = avatarTag() + '<div class="va-dots"><span></span><span></span><span></span></div>';
  els.body.appendChild(t); scrollBottom();
  return t;
}
function wordCount(html) {
  var text = html.replace(/<[^>]*>/g, ' ');
  var w = text.trim().split(/\s+/);
  return (w.length === 1 && w[0] === '') ? 0 : w.length;
}
// Durée « en train d'écrire » proportionnelle à la longueur, bornée pour ne pas traîner.
function typingMs(html) {
  var ms = 480 + wordCount(html) * 55;
  return Math.max(750, Math.min(ms, 2800));
}
function botTurn(html, level, illus) {
  var t = typingIndicator();
  // Un graphique ne se « tape » pas : on l'affiche vite, sans long temps de lecture.
  var ms = illus ? 520 : typingMs(html);
  return wait(ms).then(function () {
    t.remove();
    botMsg(html, level, illus);
    return wait(illus ? 200 : 260 + Math.min(wordCount(html) * 10, 480));
  });
}

// ── Puces de réponse (navigation focalisée) ──
function makeChip(id, label, primary) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'va-chip' + (primary ? ' va-contact' : '');
  b.textContent = label;
  if (primary) b.insertAdjacentHTML('beforeend', ' <span class="arr">&rarr;</span>');
  b.addEventListener('click', function () { id === 'compare' ? onCompare() : onNode(id); });
  return b;
}
function makeBreakout() {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'va-chip va-alt';
  b.textContent = 'Autres sujets';
  b.addEventListener('click', function () { browsing = true; pool = null; showChips(); });
  return b;
}

// Dans un sujet, on ne montre que ses questions de fond (l'entonnoir) plus une
// sortie discrète. Sujet terminé, retour aux sujets d'entrée. Puce Comparer toujours là.
function showChips() {
  els.foot.innerHTML = '';
  var avail = (pool || []).filter(function (id) { return !visited[id]; });
  if (avail.length) {
    // Mi-parcours : les questions de fond du sujet, une sortie, puis le CTA.
    var lead = document.createElement('span');
    lead.className = 'va-hint';
    lead.textContent = 'Pour aller plus loin';
    els.foot.appendChild(lead);
    avail.forEach(function (id) { els.foot.appendChild(makeChip(id, nodeMap[id].chip)); });
    els.foot.appendChild(makeBreakout());
    els.foot.appendChild(makeChip('compare', tree.compare.chip, true));
  } else if (browsing || !Object.keys(visited).length) {
    // Menu des sujets d'entrée (au démarrage, ou après « Autres sujets »).
    pool = null;
    var lead2 = document.createElement('span');
    lead2.className = 'va-hint';
    var others = tree.topics.map(function (t) { return t.key; }).filter(function (id) { return !visited[id]; });
    lead2.textContent = Object.keys(visited).length ? 'Autre sujet ?' : 'Questions fréquentes';
    els.foot.appendChild(lead2);
    // Pied allégé : on ne montre que quelques sujets, le reste derrière « Plus de sujets ».
    var shown = entriesExpanded ? others : others.slice(0, ENTRY_SHOWN);
    shown.forEach(function (id) { els.foot.appendChild(makeChip(id, nodeMap[id].chip)); });
    if (!entriesExpanded && others.length > shown.length) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'va-chip va-alt';
      more.textContent = 'Plus de sujets';
      more.addEventListener('click', function () { entriesExpanded = true; showChips(); });
      els.foot.appendChild(more);
    }
    els.foot.appendChild(makeChip('compare', tree.compare.chip, true));
  } else {
    // Fin d'entonnoir : deux options, le CTA à gauche et les autres sujets à droite.
    els.foot.appendChild(makeChip('compare', tree.compare.chip, true));
    els.foot.appendChild(makeBreakout());
  }
  els.foot.hidden = false;
  scrollBottom();
}

function onNode(id) {
  var n = nodeMap[id];
  if (!n) return;
  els.foot.hidden = true;
  userMsg(n.q);
  var chain = wait(300);
  n.bubbles.forEach(function (b) {
    chain = chain.then(function () { return botTurn(b.html, b.level, b.illus); });
  });
  if (n.type === 'leaf' && n.tail) {
    chain = chain.then(function () { return botTurn(n.tail); });
  }
  chain.then(function () {
    visited[id] = true;
    if (n.type === 'entry') {
      pool = (n.followups || []).slice();
      browsing = false;
    }
    // Fin d'entonnoir : après une offre, quand il ne reste plus de question de fond,
    // Virginie invite à comparer, puis on présente les deux options.
    var remaining = (pool || []).filter(function (rid) { return !visited[rid]; });
    if (n.type === 'leaf' && !remaining.length) {
      botTurn(tree.compare.invite).then(showChips);
      return;
    }
    showChips();
  });
}

function onCompare() {
  els.foot.hidden = true;
  userMsg(tree.compare.chip);
  wait(320).then(handoff);
}

function handoff() {
  botTurn(tree.compare.handoff).then(function () {
    var card = document.createElement('div');
    card.className = 'va-msg va-bot';
    card.innerHTML = avatarTag() +
      '<div class="va-handoff">' +
        '<div class="va-h-app">Mon entreprise</div>' +
        '<div class="va-h-lbl">Secteur de référence</div>' +
        '<div class="va-h-ref"></div>' +
        '<div class="va-h-fields">' +
          '<div class="va-h-f"><span>Effectif</span><i>ex. 500</i></div>' +
          '<div class="va-h-f"><span>AT avec arrêt</span><i>ex. 20</i></div>' +
        '</div>' +
        '<button class="va-h-open" type="button">Ouvrir Mon entreprise</button>' +
      '</div>';
    // Le libellé du secteur passe par textContent (pas d'injection de données en HTML).
    card.querySelector('.va-h-ref').textContent = tree.code + ' · ' + tree.libelle;
    els.body.appendChild(card); scrollBottom();
    card.querySelector('.va-h-open').addEventListener('click', doHandoff);
    showChips();
  });
}

// Renvoi vers « Mon entreprise » avec le secteur courant chargé comme référence.
function doHandoff() {
  var code = tree.code;
  closeAssistant();
  switchView('compare');
  selectSector(code);
}

function buildNodeMap() {
  nodeMap = {};
  tree.topics.forEach(function (t) {
    nodeMap[t.key] = { type: 'entry', chip: t.chip, q: t.q, bubbles: t.bubbles, followups: t.followups.map(function (f) { return f.key; }) };
    t.followups.forEach(function (f) {
      nodeMap[f.key] = { type: 'leaf', chip: f.chip, q: f.q, bubbles: f.bubbles, tail: f.tail };
    });
  });
}

function runConversation() {
  clearTimers();
  els.body.innerHTML = '';
  els.foot.hidden = true; els.foot.innerHTML = '';
  visited = {}; pool = null; entriesExpanded = false; browsing = false;
  buildNodeMap();
  var chain = wait(400);
  tree.intro.forEach(function (b) {
    chain = chain.then(function () { return botTurn(b.html, b.level, b.illus); });
  });
  chain.then(showChips);
}

// ── Ouverture / fermeture ──
export function isAssistantOpen() { return isOpen; }

export function openAssistant() {
  if (!tree || isOpen) return;
  isOpen = true;
  if (els.launcher) els.launcher.style.display = 'none';
  els.panel.hidden = false;
  if (!reduce) els.panel.classList.add('va-panel-appear');
  trapFocus(els.panel);
  if (els.closeBtn) els.closeBtn.focus();
  runConversation();
}

export function closeAssistant() {
  if (!isOpen) return;
  isOpen = false;
  clearTimers();
  els.panel.hidden = true;
  els.panel.classList.remove('va-panel-appear');
  releaseFocus(els.panel);
  if (tree && els.launcher) els.launcher.style.display = 'flex';
  if (els.launchBtn) els.launchBtn.focus();
}

export function toggleAssistant() {
  if (!tree) return;
  isOpen ? closeAssistant() : openAssistant();
}

// Met à jour la pastille du bouton insights de la vue (logique de badge conservée).
function updateViewBadge(viewId, count) {
  var badgeId = viewId === 'at' ? 'insightsBadge' : viewId + '-insightsBadge';
  var btnId = viewId === 'at' ? 'insightsBtn' : viewId + '-insightsBtn';
  var btn = el(btnId), badge = el(badgeId);
  if (!btn || !badge) return;
  btn.classList.remove('has-insights');
  badge.classList.remove('visible');
  if (count > 0) {
    badge.textContent = count;
    badge.classList.add('visible');
    void btn.offsetWidth;
    btn.classList.add('has-insights');
  }
}

// Appelé à chaque rendu de secteur (app.js). Construit l'arbre et réveille le lanceur.
export function setAssistantContext(viewId, s, nat, causes, cfg, yearly) {
  if (!els) return;
  var vs = state.views[viewId];
  var code = vs && vs.code;
  if (!code) {
    tree = null;
    if (isOpen) closeAssistant();
    if (els.launcher) els.launcher.style.display = 'none';
    return;
  }
  var store = getStore(viewId, vs.level);
  var entry = store ? store[code] : null;
  var libelle = entry ? entry.libelle : code;
  var meta = getData(viewId).meta;
  var years = (meta && meta.years) ? meta.years : null;

  tree = buildConversation(viewId, s, nat, causes, cfg, yearly, code, libelle, years);
  if (!tree) return;

  updateViewBadge(viewId, tree.topics.length);
  if (els.launchBadge) {
    els.launchBadge.textContent = tree.topics.length;
    els.launchBadge.style.display = tree.topics.length > 0 ? 'block' : 'none';
  }
  if (els.launcher && !isOpen) els.launcher.style.display = 'flex';
  if (els.launchBtn && !reduce) els.launchBtn.classList.add('va-pulse');

  // Accroche discrète, une seule fois, le temps que le lanceur soit remarqué.
  if (!teaserShown && els.teaser) {
    teaserShown = true;
    setTimeout(function () {
      if (!isOpen && els.teaser) els.teaser.hidden = false;
    }, reduce ? 0 : 1400);
  }

  // Si le panneau est ouvert pendant un changement de secteur, on rejoue la lecture.
  if (isOpen) runConversation();
}

export function initAssistant() {
  reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cacheEls();
  if (!els.launchBtn) return;

  els.launchBtn.addEventListener('click', openAssistant);
  // Les clics à l'intérieur du panneau et du lanceur ne doivent pas atteindre le
  // gestionnaire de clic extérieur : une puce qui reconstruit le pied se détache du
  // DOM avant que ce gestionnaire ne s'exécute, et fermait le panneau à tort.
  els.panel.addEventListener('click', function (e) { e.stopPropagation(); });
  els.launcher.addEventListener('click', function (e) { e.stopPropagation(); });
  if (els.teaser) els.teaser.addEventListener('click', function (e) { if (e.target !== els.teaserX) openAssistant(); });
  if (els.teaserX) els.teaserX.addEventListener('click', function (e) { e.stopPropagation(); els.teaser.hidden = true; });
  if (els.closeBtn) els.closeBtn.addEventListener('click', closeAssistant);

  // Clic hors du panneau : fermeture (le lanceur est masqué quand le panneau est ouvert).
  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    if (els.panel.contains(e.target)) return;
    if (els.launcher && els.launcher.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.action-btn')) return;
    closeAssistant();
  });

  // L'assistant vit sur les vues secteur (AT / MP / Trajet). Sur « Mon entreprise »,
  // où Virginie renvoie justement, on masque le lanceur et on ferme le panneau.
  // Le retour vers une vue secteur relance setAssistantContext (via le rendu) qui
  // réaffiche le lanceur.
  window.addEventListener('hashchange', hideOnCompare);
  hideOnCompare();
}

function hideOnCompare() {
  if (!els) return;
  var hash = window.location.hash.replace('#', '').trim();
  if (hash === 'compare') {
    if (isOpen) closeAssistant();
    if (els.launcher) els.launcher.style.display = 'none';
  }
}
