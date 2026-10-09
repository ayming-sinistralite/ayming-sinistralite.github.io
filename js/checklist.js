// ── Premiers pas : la liste de ce qu'on veut voir faire pendant une visite ──
// Dans le menu latéral, à la place de l'annonce tant qu'elle n'est pas terminée, et sur l'accueil
// en mobile, où le menu latéral n'existe pas. Chaque étape se coche seule quand l'action a lieu :
// les modules concernés appellent markStep(). Un clic sur une étape mène à l'endroit où la faire.
// La progression reste sur l'appareil (localStorage), rien n'est envoyé. Masquée en démo.

import { state } from './state.js?v=f8b7846';
import { el, esc } from './utils.js?v=f8b7846';
import { goTo, isDemo } from './route.js?v=f8b7846';
import { openBadge } from './badge.js?v=f8b7846';
import { getProfile } from './profile.js?v=f8b7846';

var KEY = 'sinistralite-first-steps';

// Des étapes courtes, pour que la carte se gagne dans la première visite : le rapport, qui demande
// les coordonnées, n'en fait pas partie, il a son propre appel après l'évaluation.
// Le prénom et le secteur se cochent avec le profil (les questions de l'accueil, tour.js), les deux
// découvertes au lancement de la visite de la vue (tour.js), l'évaluation au premier résultat (compare.js).
function mySector() { return state.views.compare.sector || getProfile().sector; }
function askProfile() { window.dispatchEvent(new Event('openwelcome')); }
var STEPS = [
  { id: 'name', label: 'Donner mon prénom', go: askProfile },
  { id: 'mysector', label: 'Choisir mon secteur', go: askProfile },
  { id: 'company-tour', label: 'Découvrir Mon entreprise', go: function() { goTo('compare'); } },
  { id: 'sector', label: 'Découvrir les secteurs', go: function() { goTo('at', mySector()); } },
  { id: 'company', label: 'Faire ma première évaluation', go: function() { goTo('compare'); } }
];

// Le profil coche ses deux étapes, qu'il vienne de l'accueil ou du menu du compte.
function syncProfile() {
  var p = getProfile();
  if (p.prenom) markStep('name');
  if (p.sector) markStep('mysector');
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* stockage refusé, la liste vit sans */ }
}

// Vrai tant que la liste est à l'écran : le menu latéral garde alors son annonce cachée.
export function checklistActive() { return !isDemo() && !read().closed; }

// Vrai quand chaque étape est faite : la carte est gagnée, le menu latéral garde un accès vers elle.
export function checklistComplete() {
  var done = read().done || [];
  return STEPS.every(function(st) { return done.indexOf(st.id) >= 0; });
}

export function markStep(id) {
  var s = read();
  var done = s.done || [];
  if (done.indexOf(id) >= 0) return;
  done.push(id);
  s.done = done;
  write(s);
  renderChecklist();
  // La dernière étape cochée : le badge est gagné (badge.js).
  if (STEPS.every(function(st) { return done.indexOf(st.id) >= 0; })) window.dispatchEvent(new Event('checklistcomplete'));
}

function html(s, where) {
  var done = s.done || [];
  var count = STEPS.filter(function(st) { return done.indexOf(st.id) >= 0; }).length;
  var all = count === STEPS.length;
  var open = !s.folded;
  return '<button type="button" class="fs-head" data-fs-fold aria-expanded="' + open + '" aria-controls="fs-list-' + where + '">' +
      '<span class="fs-title">Premiers pas</span><i data-lucide="chevron-down" class="fs-chev"></i></button>' +
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
    (all && open ? '<button type="button" class="fs-done" data-fs-badge>Voir ma carte</button>' +
      '<button type="button" class="fs-done" data-fs-close>Terminé</button>' : '');
}

export function renderChecklist() {
  var s = read();
  var on = checklistActive();
  [['sbSteps', 'sb'], ['home-steps', 'home']].forEach(function(pair) {
    var box = el(pair[0]);
    if (!box) return;
    box.hidden = !on;
    box.innerHTML = on ? html(s, pair[1]) : '';
  });
  if (window.lucide) window.lucide.createIcons();
  window.dispatchEvent(new Event('checklistchange'));
}

export function initChecklist() {
  document.addEventListener('click', function(e) {
    var t = e.target.closest && e.target.closest('[data-fs-fold], [data-fs-step], [data-fs-close], [data-fs-badge]');
    if (!t) return;
    if (t.hasAttribute('data-fs-badge')) { openBadge(); return; }
    var s = read();
    if (t.hasAttribute('data-fs-fold')) { s.folded = !s.folded; write(s); renderChecklist(); return; }
    if (t.hasAttribute('data-fs-close')) { s.closed = true; write(s); renderChecklist(); return; }
    var step = STEPS.filter(function(st) { return st.id === t.getAttribute('data-fs-step'); })[0];
    if (step) step.go();
  });
  window.addEventListener('profilechange', syncProfile);
  renderChecklist();
  syncProfile();
}
