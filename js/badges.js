// ── Mes badges : la salle des cartes ──
// Un badge par geste qu'on veut voir faire dans l'outil, sous la forme d'une carte à collectionner (maquette
// validée le 17 novembre 2026) : les étagères Vigilance, Initiative, Esprit d'équipe et Cartes
// secrètes, des cartes à l'objet en suède, cadre bronze, argent ou or, un numéro fixe comme un Pokédex, et au
// verso la fin de la vidéo. Les cinq premiers pas viennent de checklist.js, qui en reste la source ; les autres
// gestes appellent earn('<id>'). On ne montre jamais de total : la collection grandira.
// Tout reste sur l'appareil (localStorage) : changer de navigateur ou effacer ses données repart de zéro.
// Une carte gagnée hors des premiers pas s'annonce en haut à droite, comme un trophée. Masqué en démo.

import { el, esc, ensureStyle, readJSON, writeJSON } from './utils.js?v=24ffa11';
import { isDemo, currentRoute, goTo } from './route.js?v=24ffa11';
import { state } from './state.js?v=24ffa11';
import { getProfile } from './profile.js?v=24ffa11';
import { listReports } from './reports.js?v=24ffa11';
import { stepDone, stepGo, checklistComplete, closeChecklist } from './checklist.js?v=24ffa11';
import { openBadgeShare } from './share.js?v=24ffa11';

var KEY = 'sinistralite-badges';

// text : ce que la carte dit de celui qui la tient, au recto, pensé pour être partagé. Elle décrit le geste ou
// l'attention, jamais une compétence ni un résultat que le geste ne montre pas (relecture juridique du 17/11/2026).
// how : comment la personne l'a gagnée, sous la carte ouverte et dans l'alerte. todo : comment la gagner.
var CARDS = {
  sector: { name: 'Tour d\'horizon', text: 'A parcouru les secteurs pour situer le sien.', how: 'Vous avez découvert les secteurs.', todo: 'Découvrir les secteurs', tier: 'bronze', step: true },
  at: { name: 'Accidents du travail', text: 'S\'intéresse aux accidents du travail de son secteur.', how: 'Vous avez ouvert Accidents du travail.', todo: 'Ouvrir Accidents du travail', tier: 'bronze', view: 'at' },
  mp: { name: 'Maladies professionnelles', text: 'S\'intéresse aux maladies professionnelles de son secteur.', how: 'Vous avez ouvert Maladies professionnelles.', todo: 'Ouvrir Maladies professionnelles', tier: 'bronze', view: 'mp' },
  trajet: { name: 'Accidents de trajet', text: 'Pense aussi aux risques du trajet.', how: 'Vous avez ouvert Accidents de trajet.', todo: 'Ouvrir Accidents de trajet', tier: 'bronze', view: 'trajet' },
  mysector: { name: 'Point de repère', text: 'Sait d\'où part son entreprise.', how: 'Vous avez choisi votre secteur.', todo: 'Choisir mon secteur', tier: 'bronze', step: true },
  company: { name: 'Premier autodiagnostic', text: 'A fait son autodiagnostic face à son secteur.', how: 'Vous avez fait votre autodiagnostic.', todo: 'Faire mon autodiagnostic', tier: 'or', step: true },
  compare: { name: 'Regard croisé', text: 'Compare pour mieux comprendre.', how: 'Vous avez comparé deux secteurs.', todo: 'Comparer deux secteurs', tier: 'bronze' },
  rapports: { name: 'Collection de rapports', text: 'Suit ses autodiagnostics dans la durée.', how: 'Vous gardez trois rapports.', todo: 'Garder trois rapports', tier: 'argent' },
  name: { name: 'Faisons connaissance', text: 'Fait le premier pas.', how: 'Vous avez donné votre prénom.', todo: 'Donner mon prénom', tier: 'bronze', step: true },
  invite: { name: 'Prendre soin', text: 'Invite ses pairs à suivre leur sinistralité.', how: 'Vous avez invité un pair.', todo: 'Inviter un pair', tier: 'bronze', step: true },
  social: { name: 'Porte-voix', text: 'Fait connaître la sinistralité de son secteur.', how: 'Vous avez partagé sur un réseau social.', todo: 'Partager sur un réseau social', tier: 'argent' },
  virginie: { name: 'Nouvelle amie', text: 'Pose les bonnes questions.', how: 'Vous avez posé une question à Virginie.', todo: 'Poser une question à Virginie', tier: 'argent' },
  retour: { name: 'De retour', text: 'Revient faire le point.', how: 'Vous êtes revenu un autre jour.', todo: 'Revenir un autre jour', tier: 'argent', secret: true },
  fidele: { name: 'Fidèle au poste', text: 'Revient régulièrement suivre son secteur.', how: 'Vous êtes venu trois jours différents.', todo: 'Venir trois jours différents', tier: 'argent', secret: true }
};
// Chaque étagère a sa teinte, assez claire pour que l'objet s'y pose comme sur du blanc ; la troisième
// couleur sert au texte. Le numéro d'une carte suit cet ordre et ne change plus : une carte ajoutée prend la suite.
var GROUPS = [
  { key: 'vigilance', title: 'Vigilance', tint: ['#d9f3e9', '#b5e3d0'], ids: ['sector', 'at', 'mp', 'trajet'] },
  { key: 'initiative', title: 'Initiative', tint: ['#dcf1fb', '#b4def3'], ids: ['mysector', 'company', 'compare', 'rapports'] },
  { key: 'equipe', title: 'Esprit d\'équipe', tint: ['#fdebe2', '#f5cfbd'], ids: ['name', 'invite', 'social', 'virginie'] },
  { key: 'secret', title: 'Cartes secrètes', tint: ['#e6ecf2', '#c9d5e0'], ids: ['retour', 'fidele'] }
];
var ORDER = ['sector', 'at', 'mp', 'trajet', 'mysector', 'company', 'compare', 'rapports', 'name', 'invite', 'social', 'virginie', 'retour', 'fidele'];
var IDS = Object.keys(CARDS);
var TIER = { bronze: 'Bronze', argent: 'Argent', or: 'Or' };
var reduce = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function groupOf(id) { return GROUPS.filter(function(g) { return g.ids.indexOf(id) >= 0; })[0]; }
function num(id) { return 'N° ' + String(ORDER.indexOf(id) + 1).padStart(3, '0'); }
function img(id) { return 'assets/badges/' + id + '.jpg'; }

function read() { var s = readJSON(KEY, {}); return typeof s === 'object' ? s : {}; }
function write(s) { writeJSON(KEY, s); }
function day() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function hasBadge(id) {
  var c = CARDS[id];
  if (!c) return false;
  return c.step ? stepDone(id) : !!(read().got || {})[id];
}

// Le nombre de cartes gagnées, sans total.
export function badgeCount() { return IDS.filter(hasBadge).length; }

export function earn(id) {
  var c = CARDS[id];
  if (!c || c.step || isDemo() || hasBadge(id)) return;
  var s = read();
  s.got = s.got || {};
  s.got[id] = day();
  write(s);
  window.dispatchEvent(new Event('badgeschange'));
  notify(id);
}

// ── L'alerte « Carte débloquée » ──
// Pas pendant une visite guidée ni par-dessus une fenêtre : la carte est gagnée, elle attend sur son étagère.
function busy() {
  return !!document.querySelector('.driver-popover') || document.body.classList.contains('driver-active') ||
    !!document.querySelector('dialog[open]');
}

var toastTimer = null;
function notify(id) {
  if (busy()) return;
  var c = CARDS[id], g = groupOf(id);
  ensureStyle('styles/badges.css').catch(function() {}).then(function() {
    var t = el('badgeToast');
    if (!t) {
      t = document.createElement('button');
      t.type = 'button';
      t.id = 'badgeToast';
      t.addEventListener('click', function() { hideToast(); openBadges(); });
      document.body.appendChild(t);
    }
    t.className = 'badge-toast is-' + c.tier;
    t.style.cssText = '--g1:' + g.tint[0] + ';--g2:' + g.tint[1];
    t.innerHTML = '<span class="badge-toast-thumb"><span><img src="' + img(id) + '" alt=""></span></span>' +
      '<span class="badge-toast-txt"><span class="badge-toast-k">Carte débloquée · ' + TIER[c.tier] + '</span>' +
      '<strong>' + esc(c.name) + '</strong><small>' + esc(c.how) + '</small></span>';
    t.setAttribute('aria-label', 'Carte débloquée : ' + c.name + '. Voir mes badges');
    t.classList.remove('is-on');
    void t.offsetWidth;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  });
}
function hideToast() {
  var t = el('badgeToast');
  if (t) t.classList.remove('is-on');
}

// ── Une carte ──
function cardHTML(id, i) {
  var c = CARDS[id], g = groupOf(id), won = hasBadge(id);
  var label = won ? c.name + ', carte ' + TIER[c.tier] + ' gagnée' : (c.secret ? 'Carte secrète, face cachée' : c.name + ', à gagner : ' + c.todo);
  var twinkles = c.tier === 'or' ? [[12, 18, 0], [86, 30, 0.8], [20, 78, 1.6], [80, 84, 0.4]].map(function(p) {
    return '<span class="bc-twinkle" style="left:' + p[0] + '%;top:' + p[1] + '%;animation-delay:' + p[2] + 's"></span>';
  }).join('') : '';
  return '<button type="button" class="bc is-' + c.tier + (won ? '' : ' is-locked is-unwon') + '" data-bc="' + id + '" style="--i:' + i +
      ';--g1:' + g.tint[0] + ';--g2:' + g.tint[1] + '" aria-label="' + esc(label) + '">' +
    '<span class="bc-shadow"></span>' + twinkles + '<span class="bc-new">Nouveau</span>' +
    '<span class="bc-in">' +
      '<span class="bc-face bc-front"><span class="bc-front-in">' +
        '<span class="bc-title"><span class="bc-name">' + esc(c.name) + '</span></span>' +
        '<span class="bc-art"><span class="bc-obj"><img src="' + img(id) + '" alt="" loading="lazy"></span><span class="bc-foil"></span></span>' +
        '<span class="bc-text">' + esc(c.text) + '</span>' +
        '<span class="bc-foot"><span class="bc-chip"><span class="bc-app"><img src="assets/sinistralite-icon.png" alt="">Sinistralité <b>AT/MP</b></span><i></i><span>' + num(id) + '</span></span></span>' +
        '<span class="bc-shine"></span>' +
      '</span></span>' +
      '<span class="bc-face bc-back"><span class="bc-mid">' +
        '<span class="bc-medal">' + (!won && c.secret ? '<span class="bc-q">?</span>' : '<img src="assets/badges/back-logo.png" alt="">') + '</span>' +
        '<span class="bc-bname">Sinistralité <span>AT/MP</span></span>' +
        (won ? '' : '<span class="bc-lock"><i data-lucide="lock"></i>' + (c.secret ? 'Carte secrète' : 'À gagner') + '</span>' +
          '<span class="bc-todo">' + esc(c.secret ? 'Continuez d\'explorer l\'outil pour la trouver.' : c.todo) + '</span>') +
        '</span><span class="bc-by"><span class="bc-logos"><img src="assets/ayming-logo.png" alt="Ayming"><i></i><img class="bc-acc" src="assets/acciline-logo.png" alt="Acciline+"></span></span>' +
      '</span>' +
      '<span class="bc-glare"></span>' +
    '</span>' +
  '</button>';
}

// Le titre d'une carte tient sur une ligne : un nom long rétrécit.
function fitNames(root) {
  var names = root.querySelectorAll('.bc-name');
  for (var k = 0; k < names.length; k++) {
    var n = names[k], size = 6.2;
    n.style.fontSize = '';
    while (n.scrollWidth > n.clientWidth + 1 && size > 3.8) { size -= 0.2; n.style.fontSize = size + 'cqw'; }
  }
}

// ── La salle ──
function paint(animate) {
  var got = IDS.filter(hasBadge);
  el('badgesCount').innerHTML = got.length + ' <small>' + (got.length > 1 ? 'badges' : 'badge') + '</small>';
  el('badgesTiers').innerHTML = ['bronze', 'argent', 'or'].map(function(t) {
    return '<span><i class="room-dot is-' + t + '"></i><b>' + got.filter(function(id) { return CARDS[id].tier === t; }).length + '</b> ' + TIER[t].toLowerCase() + '</span>';
  }).join('');
  var i = 0;
  el('badgesGroups').innerHTML = GROUPS.map(function(g) {
    return '<section class="room-shelf"><h3>' + esc(g.title) + ' <span>' + g.ids.filter(hasBadge).length + '</span></h3><ul class="room-row">' +
      g.ids.map(function(id) { return '<li>' + cardHTML(id, i++) + '</li>'; }).join('') + '</ul></section>';
  }).join('');
  if (window.lucide) window.lucide.createIcons();
  fitNames(el('badgesGroups'));
  var cards = [].slice.call(el('badgesGroups').querySelectorAll('.bc'));
  cards.forEach(function(card) { tilt(card); });
  // Les cartes gagnées depuis la dernière visite de la salle se retournent en dernier, avec des étincelles.
  var s = read();
  var seen = s.seen || [];
  var fresh = got.filter(function(id) { return seen.indexOf(id) < 0; });
  s.seen = got;
  write(s);
  if (!animate || reduce) return;
  cards.forEach(function(c) { c.classList.add('deal'); if (hasBadge(c.getAttribute('data-bc'))) c.classList.add('is-locked'); });
  var dealt = cards.length * 55 + 600;
  var wonCards = cards.filter(function(c) { return hasBadge(c.getAttribute('data-bc')); });
  var plain = wonCards.filter(function(c) { return fresh.indexOf(c.getAttribute('data-bc')) < 0; });
  plain.forEach(function(c, k) { setTimeout(function() { flipUp(c, false); }, dealt + k * 90); });
  wonCards.filter(function(c) { return fresh.indexOf(c.getAttribute('data-bc')) >= 0; }).forEach(function(c, k) {
    setTimeout(function() { flipUp(c, true); }, dealt + plain.length * 90 + 450 + k * 300);
  });
}

function flipUp(card, isNew) {
  card.classList.remove('is-locked');
  card.classList.remove('is-drawing'); void card.offsetWidth; card.classList.add('is-drawing');
  if (isNew) { card.classList.add('is-new'); burst(card); }
}

function burst(card) {
  var colors = ['#00AEEF', '#00B08B', '#7FD3F5', '#FFFFFF', '#f6d2ac'];
  for (var k = 0; k < 16; k++) (function(k) {
    var s = document.createElement('span');
    s.className = 'bc-spark';
    s.style.setProperty('--a', (k * 22.5 + Math.random() * 10) + 'deg');
    s.style.setProperty('--r', -(70 + Math.random() * 60) + 'px');
    s.style.setProperty('--c', colors[k % colors.length]);
    card.appendChild(s);
    requestAnimationFrame(function() { s.classList.add('go'); });
    setTimeout(function() { s.remove(); }, 1100);
  })(k);
}

// Sur l'étagère, la carte suit la souris ; le reflet et l'irisation la suivent aussi.
function tilt(card) {
  card.addEventListener('pointermove', function(e) {
    if (reduce || e.pointerType === 'touch') return;
    var r = card.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.classList.add('is-tilting');
    card.style.setProperty('--ry', ((x - 0.5) * 24).toFixed(2) + 'deg');
    card.style.setProperty('--rx', ((0.5 - y) * 24).toFixed(2) + 'deg');
    card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });
  card.addEventListener('pointerleave', function() {
    card.classList.remove('is-tilting');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}

// En main, la carte tourne d'un côté sur l'autre, autour de son axe vertical seulement. Lâchée, elle se pose
// toujours sur une face, jamais de profil : le demi-tour le plus proche, poussé par l'élan, avec un ressort doux.
// La boîte autour d'elle, qui ne tourne pas, tient le pointeur : une carte tournée le perd dans Chrome.
function spin(card) {
  var host = card.parentElement;
  var ry = 0, vy = 0, last = null, raf = 0, target = 0;
  function set() {
    card.style.setProperty('--ry', ry.toFixed(1) + 'deg');
    var f = ((ry % 360) + 360) % 360;
    card.style.setProperty('--mx', (50 + Math.sin(f * Math.PI / 180) * 45).toFixed(1) + '%');
  }
  function settle() {
    vy += (target - ry) * 0.08;
    vy *= 0.78;
    ry += vy;
    set();
    if (Math.abs(target - ry) > 0.2 || Math.abs(vy) > 0.2) raf = requestAnimationFrame(settle);
    else { ry = target; set(); card.classList.remove('is-tilting'); }
  }
  card.addEventListener('pointerdown', function(e) {
    cancelAnimationFrame(raf);
    e.preventDefault();
    host.setPointerCapture(e.pointerId);
    card.classList.add('is-tilting');
    last = e.clientX;
    vy = 0;
  });
  host.addEventListener('pointermove', function(e) {
    if (last === null) return;
    var dx = e.clientX - last;
    ry += dx * 0.6;
    vy = dx * 0.6;
    last = e.clientX;
    set();
  });
  function up() {
    if (last === null) return;
    last = null;
    target = Math.round((ry + vy * 6) / 180) * 180;
    if (reduce) { ry = target; set(); card.classList.remove('is-tilting'); }
    else raf = requestAnimationFrame(settle);
  }
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
}

// ── La carte en main : elle vient de sa place sur l'étagère jusqu'au centre ──
var from = null;
function openCard(card) {
  var id = card.getAttribute('data-bc'), c = CARDS[id], won = hasBadge(id);
  var stage = el('badgeStage'), box = el('badgeStageCard');
  from = card;
  box.innerHTML = cardHTML(id, 0);
  var big = box.firstChild;
  var inner = big.querySelector('.bc-in');
  var float = document.createElement('span');
  float.className = 'bc-float';
  inner.parentNode.insertBefore(float, inner);
  float.appendChild(inner);
  big.removeAttribute('aria-label');
  big.setAttribute('tabindex', '-1');
  big.classList.add('is-drawing');
  if (window.lucide) window.lucide.createIcons();
  requestAnimationFrame(function() { fitNames(box); });
  spin(big);
  el('badgeStageName').textContent = won || !c.secret ? c.name : 'Carte secrète';
  var date = won && (read().got || {})[id];
  el('badgeStageHow').textContent = won
    ? c.how + ' Carte ' + TIER[c.tier].toLowerCase() + (date ? ', le ' + new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '') + '.'
    : (c.secret ? 'Elle se révèle quand vous la gagnez. Continuez d\'explorer l\'outil.' : 'Pour la gagner : ' + c.todo.charAt(0).toLowerCase() + c.todo.slice(1) + '.');
  el('badgeStageActs').innerHTML = won
    ? '<button type="button" class="room-act" data-bc-share="' + id + '"><i data-lucide="share-2"></i>Partager ma carte</button>'
    : (c.secret ? '' : '<button type="button" class="room-act" data-bc-go="' + id + '">Y aller</button>');
  if (window.lucide) window.lucide.createIcons();
  stage.hidden = false;
  var a = card.getBoundingClientRect(), b = big.getBoundingClientRect();
  if (!reduce && big.animate) {
    big.animate([
      { transform: 'translate(' + (a.left + a.width / 2 - b.left - b.width / 2) + 'px,' + (a.top + a.height / 2 - b.top - b.height / 2) + 'px) scale(' + (a.width / b.width) + ')' },
      { transform: 'none' }
    ], { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }
  card.style.visibility = 'hidden';
  requestAnimationFrame(function() { stage.classList.add('is-on'); });
  el('badgeStageClose').focus();
}

function closeCard() {
  var stage = el('badgeStage');
  if (!stage || stage.hidden) return false;
  stage.classList.remove('is-on');
  setTimeout(function() {
    stage.hidden = true;
    el('badgeStageCard').innerHTML = '';
    if (from) { from.style.visibility = ''; from.focus(); }
  }, reduce ? 0 : 300);
  return true;
}

// La salle s'ouvre comme une vue : à droite du menu latéral, qui reste visible et cliquable
// (show, pas showModal), « Mes badges » y prend l'état actif le temps qu'elle est ouverte.
var wasActive = [];
function markActive(on) {
  var btn = el('sbBadges');
  if (on) {
    wasActive = Array.prototype.slice.call(document.querySelectorAll('.sidebar .nav-item.active'));
    wasActive.forEach(function(n) { n.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-current', 'page'); }
  } else {
    if (btn) { btn.classList.remove('active'); btn.removeAttribute('aria-current'); }
    wasActive.forEach(function(n) { if (n.getAttribute('aria-current') === 'page') n.classList.add('active'); });
    wasActive = [];
  }
}
function onKey(e) {
  if (e.key !== 'Escape') return;
  if (!closeCard()) el('badgesDialog').close();
}

export function openBadges() {
  var dlg = el('badgesDialog');
  if (!dlg || typeof dlg.show !== 'function' || dlg.open) return;
  hideToast();
  ensureStyle('styles/badges.css').catch(function() {}).then(function() {
    if (dlg.open) return;
    dlg.show();
    dlg.scrollTop = 0;
    markActive(true);
    document.addEventListener('keydown', onKey);
    paint(true);
  });
}

function goEarn(id) {
  var c = CARDS[id];
  el('badgesDialog').close();
  if (c.step) stepGo(id);
  // Virginie s'ouvre par app.js, qui la porte : l'importer ici tirerait la visite guidée dans les tests.
  // Au tick suivant : le clic qui remonte encore la refermerait comme un clic à côté.
  else if (id === 'virginie') setTimeout(function() { window.dispatchEvent(new Event('openassistant')); }, 0);
  // Un domaine s'ouvre sur le secteur de la personne ; la comparaison se fait depuis la page d'un secteur.
  else goTo(c.view || 'at', state.views.compare.sector || getProfile().sector);
}

// ── Les gestes suivis ici : les pages ouvertes, les visites, les rapports gardés ──
function checkRoute() {
  var view = currentRoute().view;
  IDS.forEach(function(id) { if (CARDS[id].view === view) earn(id); });
}
function checkVisit() {
  var s = read();
  var days = s.days || [];
  var today = day();
  if (days[days.length - 1] !== today) {
    days.push(today);
    s.days = days.slice(-10);
    write(s);
  }
  if (days.length >= 2) earn('retour');
  if (days.length >= 3) earn('fidele');
}
function checkReports() { if (listReports().length >= 3) earn('rapports'); }

export function initBadges() {
  var dlg = el('badgesDialog');
  if (!dlg) return;
  el('badgesClose').addEventListener('click', function() { dlg.close(); });
  el('badgeStageClose').addEventListener('click', closeCard);
  // Échap ferme d'abord la carte en main, puis la salle (onKey). Une autre entrée du menu, son
  // logo ou la visite guidée la ferment aussi, même quand la vue sous elle est déjà la bonne.
  document.addEventListener('click', function(e) {
    if (dlg.open && e.target.closest && e.target.closest('.sidebar .sb-tabs .nav-item, .sidebar .sb-logo, .sidebar [data-tour-start]')) dlg.close();
  }, true);
  window.addEventListener('routechange', function() { if (dlg.open) dlg.close(); });
  dlg.addEventListener('click', function(e) {
    var t = e.target.closest && e.target.closest('[data-bc-share], [data-bc-go], .room-row .bc');
    if (!t) {
      if (e.target === el('badgeStage') || e.target.classList.contains('room-stage-box')) closeCard();
      return;
    }
    if (t.hasAttribute('data-bc-share')) { var sid = t.getAttribute('data-bc-share'); openBadgeShare(sid, CARDS[sid].name); return; }
    if (t.hasAttribute('data-bc-go')) { closeCard(); goEarn(t.getAttribute('data-bc-go')); return; }
    openCard(t);
  });
  // Les premiers pas finis, fermer la salle range la liste : le menu latéral garde « Mes badges ».
  dlg.addEventListener('close', function() {
    markActive(false);
    document.removeEventListener('keydown', onKey);
    var stage = el('badgeStage');
    if (stage) { stage.hidden = true; stage.classList.remove('is-on'); }
    if (checklistComplete()) closeChecklist();
  });
  if (isDemo()) return;
  checkVisit();
  checkReports();
  checkRoute();
  window.addEventListener('routechange', checkRoute);
  window.addEventListener('reportschange', checkReports);
}
