// ── Tiroir « Partager » ──
//
// Ce fichier tient le tiroir « Partager » de la vue affichée : le menu de l'appareil, l'e-mail,
// LinkedIn et la copie du lien.

import { el, viewEl, copyText, trackEvent } from './utils.js?v=e9f97a8';
import { trapFocus, releaseFocus } from './utils.js?v=e9f97a8';
import { state } from './state.js?v=e9f97a8';
import { currentRoute, libelleFor } from './route.js?v=e9f97a8';
import { getProfile } from './profile.js?v=e9f97a8';
import { closeAssistant, isAssistantOpen } from './assistant.js?v=e9f97a8';

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
    shareStatus('');
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

// ── Les canaux du partage ──
// Le lien partagé est l'adresse de la page sans sa chaîne de requête (ni ?demo ni les UTM de
// l'arrivée), plus les UTM du canal : utm_medium=referral comme les deux autres boucles
// (share.js, badge.js), utm_campaign=partage-secteur pour les compter à part.

var VIEW_NOUN = { at: 'des accidents du travail', mp: 'des maladies professionnelles', trajet: 'des accidents de trajet' };

function shareLink(channel) {
  var url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'partage-secteur');
  return url.href;
}

function shareSubject() {
  var lib = libelleFor(currentRoute());
  return lib ? 'La sinistralité du secteur « ' + lib + ' »' : 'La sinistralité par secteur';
}

// Le message sans le lien ni la signature : l'e-mail les ajoute, le menu de l'appareil passe le lien à part.
function shareText() {
  var route = currentRoute();
  var lib = libelleFor(route);
  var what = VIEW_NOUN[route.view] || 'de sinistralité';
  return 'Bonjour,\n\n' +
    (lib ? 'Voici les chiffres ' + what + ' du secteur « ' + lib + ' », sur l\'outil gratuit d\'Ayming.'
         : 'Voici les chiffres de sinistralité par secteur, sur l\'outil gratuit d\'Ayming.') +
    ' On peut aussi y comparer son entreprise à son secteur.';
}

function signature() { var p = getProfile(); return p.prenom ? '\n\n' + p.prenom : ''; }

function shareStatus(msg) { el('shareStatus').textContent = msg; }

export function copyLink() {
  copyText(shareLink('lien')).then(function() {
    shareStatus('Lien copié.');
  }, function() {
    shareStatus('Copie refusée par le navigateur.');
  });
}

function shareMail() {
  var body = shareText() + '\n\n' + shareLink('email') + signature();
  window.location.href = 'mailto:?subject=' + encodeURIComponent(shareSubject()) + '&body=' + encodeURIComponent(body);
  shareStatus('Votre messagerie s\'ouvre avec le message.');
}

function shareLinkedin() {
  window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareLink('linkedin')), '_blank', 'noopener');
}

// Le menu de partage de l'appareil (Teams, WhatsApp, Messages...), là où le navigateur l'offre.
function shareNative() {
  navigator.share({ title: shareSubject(), text: shareText() + signature(), url: shareLink('appareil') }).catch(function() {});
}

// Branche les boutons du tiroir ; « Partager avec une application » n'apparaît que si le navigateur le permet.
export function initShareDrawer() {
  var nativeBtn = el('shareNativeBtn');
  if (nativeBtn && typeof navigator.share === 'function') {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', shareNative);
  }
  var mail = el('shareMailBtn'), li = el('shareLinkedinBtn'), copy = el('copyLinkBtn');
  if (mail) mail.addEventListener('click', shareMail);
  if (li) li.addEventListener('click', shareLinkedin);
  if (copy) copy.addEventListener('click', copyLink);
  // Mesure GA4 : la page secteur partagée, par quel moyen.
  [[nativeBtn, 'appareil'], [mail, 'email'], [li, 'linkedin'], [copy, 'lien']].forEach(function(b) {
    if (b[0]) b[0].addEventListener('click', function() {
      var vs = state.views[state.activeView] || {};
      trackEvent('share_atmp', { content_type: 'secteur', method: b[1], view: state.activeView, sector: vs.code || 'national' });
    });
  });
}
