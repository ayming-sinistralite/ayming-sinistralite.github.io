// ── Partager ──
// Une seule fenêtre de partage, ouverte de deux endroits :
// - le rapport de l'autodiagnostic (openShare) : le rapport reste sur l'appareil, ce qui part est une
//   invitation à faire son propre diagnostic, sur le même secteur (/accueil/?q=<code>) ;
// - une page secteur (openSectorShare) : le lien de la page affichée.
// Chaque application reçoit le lien marqué de ses UTM (utm_source = l'application, utm_medium=referral,
// utm_campaign = partage-rapport ou partage-secteur), que lead.js garde et transmet avec le lead : d'où
// le coefficient viral. L'e-mail porte le message long (« Bonjour… »), les messageries et réseaux une
// phrase courte, leur aperçu montrant l'image og de la page. Rien ne part vers Ayming : la personne
// envoie elle-même, depuis son application.

import { el, esc, copyText, trackEvent } from './utils.js?v=36466a3';
import { VIEW_NOUN } from './state.js?v=36466a3';
import { getProfile } from './profile.js?v=36466a3';
import { markStep } from './checklist.js?v=36466a3';
import { earn } from './badges.js?v=36466a3';
import { currentRoute, libelleFor, slugify } from './route.js?v=36466a3';

// Logos des marques (Simple Icons, CC0), tracés pleins dans un carré de 24, dans la couleur du texte.
var LOGO = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  telegram: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  threads: 'M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z',
  bubble: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  reddit: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
  bluesky: 'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z',
};
// Teams et LinkedIn en blanc sur la couleur de leur marque, comme les autres : le logo Teams de 2025
// (Wikimedia Commons), le T découpé dans le violet Teams, et le « in » officiel de LinkedIn.
var ART = {
  teams: '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="4 4 36 38" fill="#fff"><path d="M21.9999 20h12c3.3137 0 6 2.6863 6 6v10c0 3.3137-2.6863 6-6 6s-6-2.6863-6-6V26c0-3.3137-2.6863-6-6-6"/><path d="M7.99988 24c0-3.3137 2.68632-6 6.00002-6h8c3.3137 0 6 2.6863 6 6v12c0 3.3137 2.6863 6 6 6l-16.0001-.0001c-5.5228 0-9.99992-4.4771-9.99992-10z"/><path d="M32.9999 18c2.7614 0 5-2.2386 5-5s-2.2386-5-5-5-5 2.2386-5 5 2.2386 5 5 5"/><path d="M17.9999 16c3.3137 0 6-2.6863 6-6 0-3.31371-2.6863-6-6-6s-6 2.68629-6 6c0 3.3137 2.6863 6 6 6"/><rect width="16" height="16" x="4" y="23" rx="3.25" stroke="#5B5FC7" stroke-width="1.5"/><path fill="#5B5FC7" d="M15.4792 28.1054h-2.4471v7.466h-2.0648v-7.466H8.52014v-1.6768h6.95906z"/></svg>',
  linkedin: '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="8 8 56 56" fill="#fff"><path d="M62,62 L51.315625,62 L51.315625,43.8021149 C51.315625,38.8127542 49.4197917,36.0245323 45.4707031,36.0245323 C41.1746094,36.0245323 38.9300781,38.9261103 38.9300781,43.8021149 L38.9300781,62 L28.6333333,62 L28.6333333,27.3333333 L38.9300781,27.3333333 L38.9300781,32.0029283 C38.9300781,32.0029283 42.0260417,26.2742151 49.3825521,26.2742151 C56.7356771,26.2742151 62,30.7644705 62,40.051212 L62,62 Z M16.349349,22.7940133 C12.8420573,22.7940133 10,19.9296567 10,16.3970067 C10,12.8643566 12.8420573,10 16.349349,10 C19.8566406,10 22.6970052,12.8643566 22.6970052,16.3970067 C22.6970052,19.9296567 19.8566406,22.7940133 16.349349,22.7940133 Z M11.0325521,62 L21.769401,62 L21.769401,27.3333333 L11.0325521,27.3333333 L11.0325521,62 Z"/></svg>'
};
// Pictos au trait (Lucide) pour ce qui n'est pas une marque.
var LINE = {
  lien: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  email: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'],
  appareil: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01']
};


function enc(s) { return encodeURIComponent(s); }
function open(url) { window.open(url, '_blank', 'noopener'); }
function touch() { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }

// Les applications, dans l'ordre affiché sur ordinateur comme sur téléphone. Chacune donne son
// utm_source (id) ; « logo » trace la marque, « line » un picto au trait. Messages n'existe que sur
// un téléphone. « Plus » ouvre sur un téléphone ou une tablette son menu de partage, qui liste les applications
// installées (Instagram, Messenger, Signal…) ; sur un ordinateur, ce menu ne liste que les applications de
// l'ordinateur (AirDrop, Mail, Notes), alors « Plus » y déplie Reddit et Bluesky.
// Slack et Instagram n'ont aucun lien de partage : ils passent par « Copier le lien ».
var APPS = [
  { id: 'lien', label: 'Copier le lien', line: LINE.lien,
    go: function(c) {
      copyText(c.link('lien')).then(function() { status('Lien copié.'); }, function() { status('Copie refusée par le navigateur.'); });
    } },
  { id: 'whatsapp', label: 'WhatsApp', logo: LOGO.whatsapp,
    go: function(c) { open('https://wa.me/?text=' + enc(c.short + '\n' + c.link('whatsapp'))); } },
  { id: 'email', label: 'E-mail', line: LINE.email,
    go: function(c) {
      window.location.href = 'mailto:?subject=' + enc(c.subject) + '&body=' + enc(c.body + '\n\n' + c.linkLead + '\n' + c.link('email') + c.signature);
      status('Votre messagerie s\'ouvre avec le message.');
    } },
  { id: 'linkedin', label: 'LinkedIn', art: ART.linkedin,
    // Un post vide où l'aperçu est déjà joint, sans phrase : le titre de la carte en dit assez, et l'adresse
    // (avec ses UTM) reste cachée dans la carte.
    go: function(c) { open('https://www.linkedin.com/sharing/share-offsite/?url=' + enc(c.link('linkedin'))); } },
  { id: 'sms', label: 'Messages', logo: LOGO.bubble, when: touch,
    go: function(c) { window.location.href = 'sms:?&body=' + enc(c.short + '\n' + c.link('sms')); } },
  { id: 'teams', label: 'Teams', art: ART.teams,
    go: function(c) { open('https://teams.microsoft.com/share?href=' + enc(c.link('teams')) + '&msgText=' + enc(c.short)); } },
  { id: 'telegram', label: 'Telegram', logo: LOGO.telegram,
    go: function(c) { open('https://t.me/share/url?url=' + enc(c.link('telegram')) + '&text=' + enc(c.short)); } },
  { id: 'x', label: 'X', logo: LOGO.x,
    go: function(c) { open('https://x.com/intent/tweet?text=' + enc(c.short) + '&url=' + enc(c.link('x'))); } },
  { id: 'facebook', label: 'Facebook', logo: LOGO.facebook,
    go: function(c) { open('https://www.facebook.com/sharer/sharer.php?u=' + enc(c.link('facebook'))); } },
  { id: 'threads', label: 'Threads', logo: LOGO.threads,
    go: function(c) { open('https://www.threads.com/intent/post?text=' + enc(c.short) + '&url=' + enc(c.link('threads'))); } },
  // Sur ordinateur, « Plus » déplie dans la fenêtre les réseaux qui suivent.
  { id: 'plus', label: 'Plus', line: LINE.appareil, when: function() { return !touch(); }, nav: true,
    go: function() { expanded = true; render(); } },
  { id: 'reddit', label: 'Reddit', logo: LOGO.reddit, extra: true,
    go: function(c) { open('https://www.reddit.com/submit?url=' + enc(c.link('reddit')) + '&title=' + enc(c.subject)); } },
  { id: 'bluesky', label: 'Bluesky', logo: LOGO.bluesky, extra: true,
    go: function(c) { open('https://bsky.app/intent/compose?text=' + enc(c.short + '\n' + c.link('bluesky'))); } },
  { id: 'appareil', label: 'Plus', line: LINE.appareil, when: function() { return touch() && typeof navigator.share === 'function'; },
    go: function(c) { navigator.share({ title: c.subject, text: c.short, url: c.link('appareil') }).catch(function() {}); } }
];

function svg(app) {
  if (app.art) return app.art;
  if (app.logo) return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="' + app.logo + '"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' + (app.line === LINE.appareil ? 3 : 2) +
    '" stroke-linecap="round" stroke-linejoin="round">' + app.line.map(function(d) { return '<path d="' + d + '"/>'; }).join('') + '</svg>';
}

// ── Les deux contenus partagés ──

function withUtm(url, channel, campaign) {
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', campaign);
  return url.href;
}

function signature() { var p = getProfile(); return p.prenom ? '\n\n' + p.prenom : ''; }

function reportContext(code) {
  return {
    kind: 'rapport',
    title: 'Invitez un pair à faire le sien',
    lead: 'Votre rapport reste chez vous. Le lien l\'invite à faire son propre autodiagnostic, sur le même secteur.',
    subject: 'Un autodiagnostic de sinistralité à faire en deux minutes',
    body: 'Bonjour,\n\n' +
      'Je viens de faire le point sur la sinistralité de notre entreprise avec l\'autodiagnostic d\'Ayming. ' +
      'En quatre chiffres, on voit sa fréquence d\'accidents face à son secteur, la durée de ses arrêts et par où commencer.\n\n' +
      'C\'est gratuit, et le vôtre se fait en deux minutes.',
    linkLead: 'Pour faire le vôtre :',
    short: 'J\'ai comparé notre sinistralité à celle de notre secteur, en deux minutes. Faites le vôtre, c\'est gratuit :',
    signature: signature(),
    link: function(channel) {
      var url = new URL('accueil/', document.baseURI);
      if (code) url.searchParams.set('q', code);
      return withUtm(url, channel, 'partage-rapport');
    },
    track: function(method) { trackEvent('invite_atmp', { method: method }); markStep('invite'); }
  };
}

function sectorContext(viewId, code) {
  var route = currentRoute();
  var lib = libelleFor(route);
  var what = VIEW_NOUN[route.view] ? VIEW_NOUN[route.view].replace(/^les /, 'des ') : 'de sinistralité';
  return {
    kind: 'secteur',
    title: 'Partager ce secteur',
    lead: 'Le lien ouvre la même page, sur le même secteur.',
    subject: lib ? 'La sinistralité du secteur « ' + lib + ' »' : 'La sinistralité par secteur',
    body: 'Bonjour,\n\n' +
      (lib ? 'Voici les chiffres ' + what + ' du secteur « ' + lib + ' », sur l\'outil gratuit d\'Ayming.'
           : 'Voici les chiffres de sinistralité par secteur, sur l\'outil gratuit d\'Ayming.') +
      ' On peut aussi y comparer son entreprise à son secteur.',
    linkLead: 'La page du secteur :',
    short: lib ? 'Les chiffres ' + what + ' du secteur « ' + lib + ' » :' : 'Les chiffres de sinistralité par secteur :',
    signature: signature(),
    // L'adresse de la page sans sa chaîne de requête (ni ?demo ni les UTM de l'arrivée).
    link: function(channel) { return withUtm(new URL(window.location.pathname, window.location.origin), channel, 'partage-secteur'); },
    track: function(method) { trackEvent('share_atmp', { content_type: 'secteur', method: method, view: viewId, sector: code || 'national' }); }
  };
}

// ── La fenêtre ──

var ctx = null;

function status(msg) { el('shareSheetStatus').textContent = msg; }

var expanded = false;

function visible(a) { return (!a.when || a.when()) && (!a.extra || expanded) && !(a.id === 'plus' && expanded); }

function render() {
  el('shareSheetApps').innerHTML = APPS.filter(visible).map(function(a) {
    return '<button type="button" class="share-app share-app-' + a.id + '" data-share-app="' + a.id + '">' +
      '<span class="share-app-icon">' + svg(a) + '</span><span class="share-app-label">' + a.label + '</span></button>';
  }).join('');
}

function show(context) {
  var dlg = el('shareSheet');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  ctx = context;
  expanded = false;
  el('shareSheetTitle').textContent = ctx.title;
  el('shareSheetLead').textContent = ctx.lead;
  el('shareSheetApps').hidden = false;
  el('shareSheetSteps').hidden = true;
  render();
  status('');
  if (!dlg.open) dlg.showModal();
}

// Le rapport de l'autodiagnostic (diagnostic.js), les premiers pas (checklist.js) et Virginie (assistant.js).
export function openShare(code) { show(reportContext(code || '')); }

// Le bouton « Partager » d'une page secteur.
export function openSectorShare(viewId, code) { show(sectorContext(viewId, code)); }

// ── Une carte de « Mes cartes », sur LinkedIn seulement ──
// Le clic télécharge l'image de la carte (assets/social/badges, celle de l'aperçu de sa page) et ouvre la fenêtre :
// « Partager sur LinkedIn » ouvre un post au texte prêt (feed/?shareActive&text=, sans doc officielle), dont le lien
// montre la carte en vignette. LinkedIn ne l'affiche en grand que jointe en photo, et son éditeur refuse une image
// collée ou glissée par script : une animation montre donc le geste (maquette validée le 26/11/2026,
// https://claude.ai/artifact/RG9eaYBXCJYufTPpYhbPZ2). Sur un téléphone qui sait partager un fichier, son menu de
// partage s'ouvre directement avec l'image. Le lien reste sans UTM visible : la page de la carte les ajoute
// (prerender.py), et #SinistraliteATMP retrouve tous les posts sur LinkedIn.

var cardJpg = {};
function badgeImg(id) { return 'assets/social/badges/' + id + '.jpg'; }
function badgeFile(name) { return 'carte-' + slugify(name) + '.jpg'; }
function badgeLink(name) { return new URL('badge/' + slugify(name) + '/', document.baseURI).href; }
function badgeText(name) {
  return 'J\'ai gagné la carte « ' + name + ' » sur Sinistralité AT/MP, l\'autodiagnostic gratuit d\'Ayming. ' +
    'À vous de jouer : ' + badgeLink(name) + '\n\n#SinistraliteATMP';
}
function liShareUrl(name) { return 'https://www.linkedin.com/feed/?shareActive=true&text=' + enc(badgeText(name)); }
function trackBadge(id, method) { trackEvent('share_atmp', { content_type: 'badge:' + id, method: method }); }

// À l'ouverture d'une carte, pour un téléphone : son partage exige le fichier déjà prêt au moment du clic.
export function prepareBadgeShare(id) {
  if (cardJpg[id] || !touch() || typeof navigator.canShare !== 'function') return;
  cardJpg[id] = {};
  fetch(badgeImg(id)).then(function(r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(function(b) { cardJpg[id].blob = b; }, function() {});
}

function phoneShare(id, name) {
  var b = cardJpg[id] && cardJpg[id].blob;
  if (!b) return false;
  var file = new File([b], badgeFile(name), { type: 'image/jpeg' });
  if (!navigator.canShare({ files: [file] })) return false;
  trackBadge(id, 'appareil');
  earn('social');
  navigator.share({ files: [file], text: badgeText(name) }).catch(function() {});
  return true;
}

function download(id, name) {
  var a = document.createElement('a');
  a.href = badgeImg(id);
  a.download = badgeFile(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

var LI_PHOTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';
// La rangée d'outils du post comme LinkedIn la montre : l'icône photo nette, les autres à moitié effacées.
var LI_SMILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>';
var LI_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>';
var LI_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
var LI_DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';
var LI_CURSOR = '<svg viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17 15 Z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

// Le geste à faire, en boucle : la carte se télécharge, on clique le lien vers LinkedIn, on ferme l'aperçu du lien (qui cache les icônes), l'icône photo ouvre la fenêtre de fichiers de l'ordinateur, on y choisit la carte,
// elle entre dans le post, on publie.
function demo(id, name) {
  var doc = '<i class="lia-doc"></i>';
  return '<div class="lia" aria-hidden="true"><div class="lia-in">' +
    '<div class="lia-bar"><i></i><i></i><i></i><span class="lia-url"><span class="lia-u1 lia-a">sinistralite.ayming.fr</span><span class="lia-u2 lia-a">linkedin.com</span></span><span class="lia-dl lia-a">' + LI_DL + '</span></div>' +
    '<div class="lia-dlpop lia-a"><img src="' + badgeImg(id) + '" alt=""><span><b>' + badgeFile(name) + '</b>Terminé</span></div>' +
    '<div class="lia-app lia-a"><b>Partager sur LinkedIn</b><span class="lia-app-l"></span><span class="lia-app-l" style="width:60%"></span><p><u>Cliquez ici</u> pour ouvrir LinkedIn.</p></div>' +
    '<div class="lia-post lia-a">' +
      '<span class="lia-av"></span><span class="lia-l1"></span><span class="lia-l2"></span>' +
      '<p class="lia-txt">J\'ai gagné la carte « ' + name + ' » sur Sinistralité AT/MP… <b>#SinistraliteATMP</b></p>' +
      '<span class="lia-slot lia-a"></span><span class="lia-sep"></span>' +
      '<span class="lia-prev lia-a"><img src="' + badgeImg(id) + '" alt=""><span><b>Carte « ' + name + ' » · Sinistralité AT/MP</b>sinistralite.ayming.fr</span><i>×</i></span>' +
      '<span class="lia-ic" style="left:10px">' + LI_SMILE + '</span>' +
      '<span class="lia-photo lia-a">' + LI_PHOTO + '</span>' +
      '<span class="lia-ic lia-tb lia-a" style="left:74px">' + LI_CAL + '</span>' +
      '<span class="lia-ic lia-tb lia-a" style="left:106px">' + LI_PLUS + '</span>' +
      '<span class="lia-react lia-a"><i>👍</i><i>👏</i><i>❤️</i><span>24</span></span>' +
      '<span class="lia-pub"><span class="lia-go lia-a">Publier</span><span class="lia-done lia-a">✓ Publié</span></span>' +
    '</div>' +
    '<div class="lia-files lia-a">' +
      '<div class="lia-files-bar"><i></i><i></i><i></i></div>' +
      '<div class="lia-side"><span>Bureau</span><span>Documents</span><span class="is-on">Téléchargements</span></div>' +
      '<span class="lia-file" style="left:98px">' + doc + 'rapport.pdf</span>' +
      '<span class="lia-file lia-pick lia-a" style="left:182px"><img src="' + badgeImg(id) + '" alt="">' + badgeFile(name) + '</span>' +
      '<span class="lia-file" style="left:266px">' + doc + 'photo.png</span>' +
      '<span class="lia-open lia-a">Ouvrir</span>' +
    '</div>' +
    '<img class="lia-fly lia-a" src="' + badgeImg(id) + '" alt="">' +
    '<span class="lia-bub lia-a" style="--x:-70px;animation-delay:0s">👍</span><span class="lia-bub lia-a" style="--x:-30px;animation-delay:0.25s">👏</span><span class="lia-bub lia-a" style="--x:10px;animation-delay:0.5s">❤️</span><span class="lia-bub lia-a" style="--x:50px;animation-delay:0.15s">🎉</span><span class="lia-bub lia-a" style="--x:85px;animation-delay:0.4s">👍</span><span class="lia-bub lia-a" style="--x:-100px;animation-delay:0.6s">👏</span>' +
    '<span class="lia-cursor lia-a">' + LI_CURSOR + '</span>' +
  '</div></div>';
}

// « Partager sur LinkedIn », depuis une carte ouverte de « Mes cartes ».
export function openBadgeShare(id, name) {
  if (phoneShare(id, name)) return;
  var dlg = el('shareSheet');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  ctx = { badge: id, name: name };
  // Dans le clic : la carte est sur l'ordinateur avant même que la fenêtre s'ouvre.
  download(id, name);
  el('shareSheetTitle').textContent = 'Partager sur LinkedIn';
  el('shareSheetLead').textContent = 'Ajoutez votre carte en photo, elle s\'affichera en grand.';
  el('shareSheetApps').hidden = true;
  el('shareSheetSteps').hidden = false;
  el('shareSheetSteps').innerHTML = demo(id, name) +
    '<ol class="share-steps">' +
      '<li class="is-done"><b>1</b><span>Votre carte est téléchargée.</span></li>' +
      // Le seul lien vers LinkedIn est dans l'étape 2 : on lit les étapes avant de partir.
      '<li><b>2</b><span><a href="' + esc(liShareUrl(name)) + '" target="_blank" rel="noopener" class="share-li-link" aria-label="Ouvrir LinkedIn (nouvel onglet)" data-badge-li>Cliquez ici</a> pour ouvrir LinkedIn.</span></li>' +
      '<li><b>3</b><span>Fermez l\'aperçu du lien (×).</span></li>' +
      '<li><b>4</b><span>Cliquez sur l\'icône photo, ajoutez la carte, puis publiez.</span></li>' +
    '</ol>';
  status('');
  if (!dlg.open) dlg.showModal();
}

// Les réseaux sociaux, par opposition aux messageries et au lien copié : leur partage gagne « Porte-voix ».
var SOCIAL = ['linkedin', 'x', 'facebook', 'threads', 'reddit', 'bluesky'];

export function initShare() {
  var dlg = el('shareSheet');
  if (!dlg) return;
  el('shareSheetClose').addEventListener('click', function() { dlg.close(); });
  dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
  el('shareSheetSteps').addEventListener('click', function(e) {
    // Le lien ouvre LinkedIn lui-même ; le clic ne fait que compter.
    if (!ctx || !ctx.badge || !e.target.closest('[data-badge-li]')) return;
    trackBadge(ctx.badge, 'linkedin');
    earn('social');
  });
  el('shareSheetApps').addEventListener('click', function(e) {
    var b = e.target.closest('[data-share-app]');
    if (!b || !ctx) return;
    var id = b.getAttribute('data-share-app');
    var app = APPS.filter(function(a) { return a.id === id; })[0];
    if (!app) return;
    if (!app.nav) ctx.track(id);
    if (SOCIAL.indexOf(id) >= 0) earn('social');
    app.go(ctx);
    // Le rond « Plus » a disparu : le focus passe au premier réseau déplié.
    if (app.nav) { var first = el('shareSheetApps').querySelector('.share-app-' + APPS.filter(function(a) { return a.extra; })[0].id); if (first) first.focus(); }
  });
}
