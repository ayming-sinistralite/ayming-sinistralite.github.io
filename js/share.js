// ── Partager l'autodiagnostic à un pair ──
// Le rapport reste sur l'appareil : ce qui part, c'est une invitation à faire son propre
// diagnostic, sur le même secteur (/accueil/?q=<code>, que l'accueil pose à la question du secteur). Le lien porte le canal dans ses
// UTM (utm_medium=referral, utm_campaign=partage-rapport), que lead.js garde et transmet avec le
// lead : chaque visite et chaque diagnostic venus d'un partage se comptent, d'où le coefficient
// viral. Le message reste modifiable avant l'envoi. Texte saisi : jamais réinjecté en HTML.

import { el } from './utils.js?v=f8b7846';
import { getProfile } from './profile.js?v=f8b7846';

var SUBJECT = 'Un autodiagnostic de sinistralité à faire en deux minutes';
var MESSAGE = 'Bonjour,\n\n' +
  'Je viens de faire le point sur la sinistralité de notre entreprise avec l\'autodiagnostic d\'Ayming. ' +
  'En quatre chiffres, on voit sa fréquence d\'accidents face à son secteur, ce que coûtent ses accidents et par où commencer.\n\n' +
  'C\'est gratuit, et vos chiffres restent sur votre ordinateur tant que vous ne demandez pas le rapport. Le vôtre se fait en deux minutes.';

var sector = '';

function link(channel) {
  var url = new URL('accueil/', document.baseURI);
  if (sector) url.searchParams.set('q', sector);
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'partage-rapport');
  return url.href;
}

function message(channel) { return el('peerShareText').value.trim() + '\n\n' + link(channel); }

function status(msg) { el('peerShareStatus').textContent = msg; }

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('clipboard'));
}

export function openShare(code) {
  var dlg = el('peerShare');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  sector = code || '';
  var p = getProfile();
  el('peerShareText').value = MESSAGE + (p.prenom ? '\n\n' + p.prenom : '');
  el('peerShareLink').textContent = link('lien');
  status('');
  if (window.lucide) window.lucide.createIcons();
  if (!dlg.open) dlg.showModal();
}

export function initShare() {
  var dlg = el('peerShare');
  if (!dlg) return;
  el('peerShareClose').addEventListener('click', function() { dlg.close(); });
  dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
  el('peerShareMail').addEventListener('click', function() {
    window.location.href = 'mailto:?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(message('email'));
    status('Votre messagerie s\'ouvre avec le message.');
  });
  // LinkedIn ne reçoit qu'une adresse : le message part dans le presse-papiers, à coller.
  el('peerShareLinkedin').addEventListener('click', function() {
    var text = message('linkedin');
    copyText(text).then(function() { status('Message copié, collez-le dans votre publication.'); }, function() {});
    window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(link('linkedin')), '_blank', 'noopener');
  });
  el('peerShareCopy').addEventListener('click', function() {
    copyText(message('lien')).then(
      function() { status('Message et lien copiés.'); },
      function() { status('Copie refusée par le navigateur, sélectionnez le texte.'); });
  });
}
