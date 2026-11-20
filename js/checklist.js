// ── Premiers pas : la liste de ce qu'on veut voir faire pendant une visite ──
// Dans le menu latéral, à la place de l'annonce tant qu'elle n'est pas terminée, et sur l'accueil
// en mobile, où le menu latéral n'existe pas. Chaque étape se coche seule quand l'action a lieu :
// les modules concernés appellent markStep(). Un clic sur une étape mène à l'endroit où la faire.
// La progression reste sur l'appareil (localStorage), rien n'est envoyé. Masquée en démo.

import { state } from './state.js?v=24ffa11';
import { el, esc, readJSON, writeJSON } from './utils.js?v=24ffa11';
import { goTo, isDemo } from './route.js?v=24ffa11';
import { openBadges, badgeCount } from './badges.js?v=24ffa11';
import { getProfile } from './profile.js?v=24ffa11';
import { openShare } from './share.js?v=24ffa11';

var KEY = 'sinistralite-first-steps';

// Des étapes courtes, pour que la carte se gagne dans la première visite : le rapport, qui demande
// les coordonnées, n'en fait pas partie, il a son propre appel après l'évaluation.
// Le prénom et le secteur se cochent avec le profil (les questions de l'accueil, tour.js), la découverte
// des secteurs au lancement de leur visite (tour.js), l'évaluation à l'étape contact du questionnaire (flow.js),
// l'invitation quand elle part (share.js). L'invitation vient en dernier : la carte récompense le geste qui
// amène quelqu'un d'autre, et s'ouvre une fois la fenêtre d'invitation fermée, pas à l'arrivée du rapport.
function mySector() { return state.views.compare.sector || getProfile().sector; }
function askProfile() { window.dispatchEvent(new Event('openwelcome')); }
function wantTour() { window.dispatchEvent(new Event('wanttour')); }
var STEPS = [
  { id: 'name', label: 'Donner mon prénom', go: askProfile },
  { id: 'mysector', label: 'Choisir mon secteur', go: askProfile },
  { id: 'sector', label: 'Découvrir les secteurs', go: function() { goTo('at', mySector()); wantTour(); } },
  { id: 'company', label: 'Faire mon autodiagnostic', go: function() { goTo('compare'); } },
  { id: 'invite', label: 'Inviter un pair', go: function() { openShare(mySector()); } }
];

// Le profil coche ses deux étapes, qu'il vienne de l'accueil ou du menu du compte.
function syncProfile() {
  var p = getProfile();
  if (p.prenom) markStep('name');
  if (p.sector) markStep('mysector');
}

function read() { return readJSON(KEY, {}); }
function write(s) { writeJSON(KEY, s); }

// Vrai tant que la liste est à l'écran : le menu latéral garde alors son annonce cachée.
export function checklistActive() { return !isDemo() && !read().closed; }

// Vrai quand chaque étape est faite : la carte est gagnée, le menu latéral garde un accès vers elle.
export function checklistComplete() {
  var done = read().done || [];
  return STEPS.every(function(st) { return done.indexOf(st.id) >= 0; });
}

// Chaque étape est aussi un badge de « Mes badges » (badges.js) : fait, ou à faire en un clic.
export function stepDone(id) { return (read().done || []).indexOf(id) >= 0; }
export function stepGo(id) {
  var step = STEPS.filter(function(st) { return st.id === id; })[0];
  if (step) step.go();
}

// La salle des badges fermée, les premiers pas finis quittent l'écran pour la ligne « Mes badges ».
export function closeChecklist() {
  var s = read();
  if (s.closed) return;
  s.closed = true;
  write(s);
  renderChecklist();
}

// « Mes badges » encore verrouillé ramène ici : la liste se déplie, se montre et attire l'œil
// le temps d'un battement, puis la première étape à faire prend le focus.
export function showChecklist() {
  var s = read();
  if (s.folded) { s.folded = false; write(s); renderChecklist(); }
  var box = firstShown(['sbSteps', 'home-steps']);
  if (!box) return;
  box.classList.remove('is-call');
  void box.offsetWidth;
  box.classList.add('is-call');
  clearTimeout(callTimer);
  callTimer = setTimeout(function() { box.classList.remove('is-call'); }, 1500);
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  var next = box.querySelector('.fs-step:not(.is-done)');
  if (next) next.focus({ preventScroll: true });
}
var callTimer;
function firstShown(ids) {
  for (var i = 0; i < ids.length; i++) {
    var b = el(ids[i]);
    if (b && !b.hidden && b.offsetParent) return b;
  }
  return null;
}

export function markStep(id) {
  var s = read();
  var done = s.done || [];
  if (done.indexOf(id) >= 0) return;
  done.push(id);
  s.done = done;
  write(s);
  renderChecklist();
}

// La liste finie ne s'ouvre pas d'elle-même : elle se change en célébration, au même endroit,
// et la personne ouvre ses badges quand elle veut. Les étincelles jouent une fois (fresh).
var SPARKS = [0, 60, 120, 180, 240, 300];
function win(prenom, fresh) {
  return '<div class="fs-win' + (fresh ? ' is-fresh' : '') + '" role="status">' +
      '<span class="fs-medal" aria-hidden="true"><span class="fs-shine"></span><i data-lucide="award"></i>' +
        SPARKS.map(function(a) { return '<span class="fs-spark" style="--a:' + a + 'deg"></span>'; }).join('') + '</span>' +
      '<span class="fs-win-txt"><strong>' + esc(prenom ? 'Bravo, ' + prenom + '\u00a0!' : 'Bravo\u00a0!') + '</strong>' +
        '<span>Vos premières cartes sont débloquées.</span></span>' +
    '</div>' +
    '<button type="button" class="fs-done" data-fs-badges>Voir mes badges</button>';
}

function html(s, where, fresh) {
  var done = s.done || [];
  var count = STEPS.filter(function(st) { return done.indexOf(st.id) >= 0; }).length;
  var all = count === STEPS.length;
  var open = !s.folded && !all;
  // Finie, la liste n'a plus rien à déplier : le titre reste seul.
  return (all ? '<div class="fs-head"><span class="fs-title">Premiers pas</span></div>'
    : '<button type="button" class="fs-head" data-fs-fold aria-expanded="' + open + '" aria-controls="fs-list-' + where + '">' +
      '<span class="fs-title">Premiers pas</span><i data-lucide="chevron-down" class="fs-chev"></i></button>') +
    '<div class="fs-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + count + '" aria-label="Premiers pas faits">' +
      '<span class="fs-fill" style="width:' + Math.round(count / STEPS.length * 100) + '%"></span></div>' +
    '<span class="fs-count">' + count + ' sur ' + STEPS.length + '</span>' +
    '<ul class="fs-list" id="fs-list-' + where + '"' + (open ? '' : ' hidden') + '>' +
      STEPS.map(function(st) {
        var ok = done.indexOf(st.id) >= 0;
        return '<li><button type="button" class="fs-step' + (ok ? ' is-done' : '') + '" data-fs-step="' + st.id + '"' +
            (ok ? ' aria-label="' + esc(st.label) + ', fait"' : '') + '>' +
          '<span class="fs-check" aria-hidden="true">' + (ok ? '<i data-lucide="check"></i>' : '') + '</span>' +
          '<span class="fs-label">' + esc(st.label) + '</span></button></li>';
      }).join('') +
    '</ul>' +
    // Tant que la liste n'est pas finie, la carte à gagner se montre, verrouillée.
    (!all && open ? '<div class="fs-unlock"><span class="fs-card" aria-hidden="true"><i data-lucide="lock"></i></span>' +
      '<span>Terminez ces étapes pour débloquer votre carte.</span></div>' : '') +
    (all ? win(getProfile().prenom, fresh) : '');
}

// Sur l'accueil en mobile, où le menu latéral n'existe pas, la liste rangée laisse une ligne vers les badges.
function homeLine() {
  return '<button type="button" class="fs-line" data-fs-badges><i data-lucide="award"></i><span>Mes badges</span>' +
    '<span class="fs-line-n">' + badgeCount() + '</span></button>';
}

function renderChecklist() {
  var s = read();
  var on = checklistActive();
  // La célébration joue une seule fois, au premier affichage de la liste finie.
  var fresh = on && checklistComplete() && !s.cheered;
  if (fresh) { s.cheered = true; write(s); }
  [['sbSteps', 'sb'], ['home-steps', 'home']].forEach(function(pair) {
    var box = el(pair[0]);
    if (!box) return;
    var line = !on && pair[1] === 'home' && !isDemo() && checklistComplete();
    box.hidden = !on && !line;
    box.classList.toggle('is-line', line);
    box.innerHTML = on ? html(s, pair[1], fresh) : line ? homeLine() : '';
  });
  if (window.lucide) window.lucide.createIcons();
  window.dispatchEvent(new Event('checklistchange'));
}

export function initChecklist() {
  document.addEventListener('click', function(e) {
    var t = e.target.closest && e.target.closest('[data-fs-fold], [data-fs-step], [data-fs-badges]');
    if (!t) return;
    if (t.hasAttribute('data-fs-badges')) { openBadges(); return; }
    var s = read();
    if (t.hasAttribute('data-fs-fold')) { s.folded = !s.folded; write(s); renderChecklist(); return; }
    var step = STEPS.filter(function(st) { return st.id === t.getAttribute('data-fs-step'); })[0];
    if (step) step.go();
  });
  window.addEventListener('profilechange', syncProfile);
  window.addEventListener('badgeschange', function() { if (!checklistActive()) renderChecklist(); });
  renderChecklist();
  syncProfile();
}
