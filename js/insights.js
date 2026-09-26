// ── Tiroir « Partager » ──
//
// L'analyse du secteur vit désormais dans l'assistant conversationnel (js/assistant.js).
// Ce fichier ne garde que le tiroir Partager (copie du lien), qui reste indépendant.

import { el } from './utils.js';
import { trapFocus, releaseFocus } from './utils.js';
import { state } from './state.js';
import { closeAssistant, isAssistantOpen } from './assistant.js';

function setAllBtns(suffix, cls, val) {
  ['', 'mp-', 'trajet-'].forEach(function(p) {
    var b = el(p + suffix);
    if (b) {
      b.classList.toggle(cls, val);
      b.setAttribute('aria-expanded', val ? 'true' : 'false');
    }
  });
}

export function toggleShare() {
  // Ouvrir le partage ferme l'assistant s'il est ouvert : les deux surfaces
  // se chevauchent en bas à droite.
  if (isAssistantOpen()) closeAssistant();

  var drawer = el('shareDrawer');
  var isOpen = drawer.classList.toggle('open');
  setAllBtns('shareBtn', 'active', isOpen);
  if (isOpen) {
    trapFocus(drawer);
    var closeBtn = drawer.querySelector('.close-btn');
    if (closeBtn) closeBtn.focus();
  } else {
    releaseFocus(drawer);
    var prefix = state.activeView === 'at' ? '' : state.activeView + '-';
    var trigger = el(prefix + 'shareBtn');
    if (trigger) trigger.focus();
  }
}

// Affiche un message transitoire sur le bouton « Copier le lien ».
function flashCopyLabel(message) {
  var labels = document.querySelectorAll('#shareDrawer .share-option:first-child .share-option-label');
  labels.forEach(function(label) {
    var original = label.textContent;
    label.textContent = message;
    setTimeout(function() { label.textContent = original; }, 2000);
  });
}

// Repli manuel : l'API clipboard exige un contexte sécurisé et une permission,
// elle échoue en http:// et quand l'utilisateur la refuse.
function copyViaTextarea(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

export function copyLink() {
  var url = window.location.href;
  var fallback = function() {
    flashCopyLabel(copyViaTextarea(url) ? 'Copié !' : 'Copie impossible');
  };
  if (!navigator.clipboard || !navigator.clipboard.writeText) return fallback();
  navigator.clipboard.writeText(url).then(function() {
    flashCopyLabel('Copié !');
  }).catch(fallback);
}
