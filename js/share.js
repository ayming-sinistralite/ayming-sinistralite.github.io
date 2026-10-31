// ── Partager l'autodiagnostic à un pair ──
// Le rapport reste sur l'appareil : ce qui part, c'est une invitation à faire son propre
// diagnostic, sur le même secteur (/accueil/?q=<code>, que l'accueil pose à la question du secteur). Le lien porte le canal dans ses
// UTM (utm_medium=referral, utm_campaign=partage-rapport), que lead.js garde et transmet avec le
// lead : chaque visite et chaque diagnostic venus d'un partage se comptent, d'où le coefficient
// viral. Le message reste modifiable avant l'envoi. Texte saisi : jamais réinjecté en HTML.

import { el, copyText } from './utils.js?v=5f667a9';
import { getProfile } from './profile.js?v=5f667a9';
import { markStep } from './checklist.js?v=5f667a9';

var SUBJECT = 'Un autodiagnostic de sinistralité à faire en deux minutes';
var MESSAGE = 'Bonjour,\n\n' +
  'Je viens de faire le point sur la sinistralité de notre entreprise avec l\'autodiagnostic d\'Ayming. ' +
  'En quatre chiffres, on voit sa fréquence d\'accidents face à son secteur, la durée de ses arrêts et par où commencer.\n\n' +
  'C\'est gratuit, et vos chiffres restent dans votre navigateur jusqu\'à votre demande de rapport. Le vôtre se fait en deux minutes.';

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
// Un envoi, par e-mail, LinkedIn ou lien copié, coche « Inviter un pair », la dernière étape des premiers pas (checklist.js).
function sent(msg) { status(msg); markStep('invite'); }

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
    sent('Votre messagerie s\'ouvre avec le message.');
  });
  // LinkedIn ne reçoit qu'une adresse : le message part dans le presse-papiers, à coller.
  el('peerShareLinkedin').addEventListener('click', function() {
    var text = message('linkedin');
    copyText(text).then(function() { sent('Message copié, collez-le dans votre publication.'); }, function() { markStep('invite'); });
    window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(link('linkedin')), '_blank', 'noopener');
  });
  el('peerShareCopy').addEventListener('click', function() {
    copyText(message('lien')).then(
      function() { sent('Message et lien copiés.'); },
      function() { status('Copie refusée par le navigateur, sélectionnez le texte.'); });
  });
}
