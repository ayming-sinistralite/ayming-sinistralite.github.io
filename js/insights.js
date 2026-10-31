// ── Tiroir « Partager » ──
//
// Ce fichier tient le tiroir « Partager » et la copie du lien de la vue affichée.

import { el, viewEl, copyText } from './utils.js?v=5f667a9';
import { trapFocus, releaseFocus } from './utils.js?v=5f667a9';
import { state } from './state.js?v=5f667a9';
import { closeAssistant, isAssistantOpen } from './assistant.js?v=5f667a9';

function setAllBtns(suffix, cls, val) {
  ['at', 'mp', 'trajet'].forEach(function(v) {
    var b = viewEl(v, suffix);
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
    drawer.setAttribute('aria-modal', 'true');
    trapFocus(drawer);
    var closeBtn = drawer.querySelector('.close-btn');
    if (closeBtn) closeBtn.focus();
  } else {
    drawer.removeAttribute('aria-modal');
    releaseFocus(drawer);
    var trigger = viewEl(state.activeView, 'shareBtn');
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

export function copyLink() {
  copyText(window.location.href).then(function() {
    flashCopyLabel('Copié !');
  }, function() {
    flashCopyLabel('Copie impossible');
  });
}
