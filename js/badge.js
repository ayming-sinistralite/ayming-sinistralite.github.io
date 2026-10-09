// ── Le badge ──
// Deux formes. À l'accueil (tour.js), l'étiquette « Bonjour, je m'appelle » se remplit pendant
// que la personne tape son prénom puis choisit son secteur. À la fin des premiers pas
// (checklist.js), elle gagne sa carte, sur le modèle de celle d'Arc : une image, le prénom en
// grand, un titre qui la valorise selon la raison de sa visite, la marque « Sinistralité » et la
// date, le logo Ayming, et trois partages (LinkedIn, image, copie).
// Le prénom et le secteur viennent du profil (profile.js) et ne quittent l'appareil que si la
// personne partage l'image elle-même. Textes posés par textContent, jamais en HTML.

import { el } from './utils.js?v=f8b7846';
import { libelleOf } from './data.js?v=f8b7846';
import { isDemo } from './route.js?v=f8b7846';
import { state } from './state.js?v=f8b7846';
import { getProfile, setProfile } from './profile.js?v=f8b7846';
import { listReports } from './reports.js?v=f8b7846';

var SEEN = 'sinistralite-badge-seen';
var SHARE_UTM = '?utm_source=linkedin&utm_medium=referral&utm_campaign=badge';
var BRAND = 'Sinistralité';

// Le titre et l'emblème de la carte suivent la raison de la visite (MOTIFS, report.js), donnée à
// l'accueil (profile.js), sinon au diagnostic ou au dernier rapport gardé sur l'appareil (reports.js).
// Des titres qui valent pour tout le monde, sans accord à faire.
var TITLES = {
  hausse: 'Sentinelle du risque',
  accident: 'Esprit prévention',
  bilan: 'Vigie des indicateurs',
  certif: 'Référence sécurité'
};
var DEFAULT_TITLE = 'Vigie de la prévention';

// Les emblèmes, des icônes Lucide (1.18) en chemins SVG sur une grille de 24 : le même tracé sert à
// l'écran (svg) et dans l'image partagée (Path2D).
var EMBLEMS = {
  // radar
  hausse: ['M19.07 4.93A10 10 0 0 0 6.99 3.34', 'M4 6h.01', 'M2.29 9.62A10 10 0 1 0 21.31 8.35', 'M16.24 7.76A6 6 0 1 0 8.23 16.67',
    'M12 18h.01', 'M17.99 11.66A6 6 0 0 1 15.77 16.67', 'M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'm13.41 10.59 5.66-5.66'],
  // hard-hat
  accident: ['M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5', 'M14 6a6 6 0 0 1 6 6v3', 'M4 15v-3a6 6 0 0 1 6-6',
    'M3 15h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z'],
  // binoculars
  bilan: ['M10 10h4', 'M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3',
    'M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z', 'M22 16L2 16',
    'M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z', 'M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3'],
  // award
  certif: ['m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526',
    'M6 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0'],
  // shield-check, sans raison donnée
  '': ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    'm9 12 2 2 4-4']
};

// Chaque raison a sa couleur et son numéro, comme une carte de collection : la personne voit
// qu'il en existe d'autres. Le dernier, sans raison donnée.
var ORDER = ['hausse', 'accident', 'bilan', 'certif', ''];
var GRADS = {
  hausse: ['#00AEEF', '#004A76'],
  accident: ['#00B08B', '#055C49'],
  bilan: ['#7FD3F5', '#0072B6'],
  certif: ['#4D6B82', '#0B2233'],
  '': ['#004A76', '#00B08B']
};
function cardNumber(motif) { return 'N° ' + (ORDER.indexOf(motif) + 1) + ' / ' + ORDER.length; }

function badgeMotif() {
  var motif = getProfile().motif || (state.views.compare && state.views.compare.motif);
  if (!motif) {
    var last = listReports()[0];
    motif = last && last.answers && last.answers.motif;
  }
  return TITLES[motif] ? motif : '';
}

export function badgeTitle() { return TITLES[badgeMotif()] || DEFAULT_TITLE; }

export function sectorLabel(code) { return code ? libelleOf('at', code) || '' : ''; }

function today(short) {
  return new Date().toLocaleDateString('fr-FR', short
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── L'étiquette de l'accueil ──
// Monte l'étiquette dans `box` (une fois), puis la remplit : { prenom, sector }.
export function renderTag(box, t) {
  if (!box) return;
  if (!box.firstChild) {
    box.innerHTML = '<figure class="name-tag" aria-hidden="true">' +
      '<div class="name-tag-top"><span class="name-tag-hello">Bonjour</span><span class="name-tag-sub">je m\'appelle</span></div>' +
      '<div class="name-tag-body"><span class="name-tag-name"></span><span class="name-tag-sector"><small>Secteur</small><span></span></span></div>' +
      '<div class="name-tag-foot"><span>' + BRAND + '</span><span class="name-tag-date"></span></div>' +
    '</figure>';
  }
  var name = box.querySelector('.name-tag-name');
  if (name.textContent !== (t.prenom || '')) {
    name.textContent = t.prenom || '';
    // Chaque lettre tapée fait « vivre » l'étiquette : elle rebondit, puis se redresse une fois remplie.
    name.classList.remove('pop');
    void name.offsetWidth;
    name.classList.add('pop');
  }
  box.firstChild.classList.toggle('is-filled', !!(t.prenom || t.sector));
  var sector = sectorLabel(t.sector);
  box.querySelector('.name-tag-sector span').textContent = sector;
  box.querySelector('.name-tag-sector').hidden = !sector;
  box.querySelector('.name-tag-date').textContent = today();
}

// ── La carte gagnée ──
// L'image du haut : le dégradé de la raison de la visite, des anneaux et son emblème en blanc, le
// même à l'écran et dans l'image. Une scène de 132 × 100, recadrée au centre selon la place.
// À l'écran, les anneaux ondulent et l'emblème se dessine (tour.css) ; l'image reste fixe.
var ART_W = 132, ART_H = 100, RINGS = [[34, 0.22], [46, 0.12]], EMBLEM = 44;
function art(motif) {
  var k = EMBLEM / 24;
  var g = GRADS[motif];
  return '<svg class="arc-art" viewBox="0 0 ' + ART_W + ' ' + ART_H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    '<defs><linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + g[0] + '"/><stop offset="1" stop-color="' + g[1] + '"/>' +
    '</linearGradient></defs>' +
    '<rect x="-40" y="-40" width="' + (ART_W + 80) + '" height="' + (ART_H + 80) + '" fill="url(#arcGrad)"/>' +
    [0, 1, 2].map(function(i) {
      return '<circle class="arc-ring" style="animation-delay:' + (i * 1.2) + 's" cx="' + ART_W / 2 + '" cy="' + ART_H / 2 + '" r="30" fill="none" stroke="#FBFCFD" stroke-width="1.2"/>';
    }).join('') +
    '<g transform="translate(' + (ART_W - EMBLEM) / 2 + ' ' + (ART_H - EMBLEM) / 2 + ') scale(' + k + ')" fill="none" stroke="#FBFCFD" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      EMBLEMS[motif].map(function(d) { return '<path class="arc-stroke" pathLength="1" d="' + d + '"/>'; }).join('') +
    '</g></svg>' +
    '<span class="arc-num">' + cardNumber(motif) + '</span>';
}

// La même scène sur le canvas, recadrée comme le fait « slice ».
function drawArt(ctx, x, y, w, h, motif) {
  var k = Math.max(w / ART_W, h / ART_H);
  var cx = x + w / 2, cy = y + h / 2;
  var g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, GRADS[motif][0]); g.addColorStop(1, GRADS[motif][1]);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.clip();
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 1.5 * k;
  RINGS.forEach(function(r) {
    ctx.strokeStyle = 'rgba(251, 252, 253, ' + r[1] + ')';
    ctx.beginPath(); ctx.arc(cx, cy, r[0] * k, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.translate(cx - EMBLEM / 2 * k, cy - EMBLEM / 2 * k);
  ctx.scale(EMBLEM / 24 * k, EMBLEM / 24 * k);
  ctx.strokeStyle = '#FBFCFD'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  EMBLEMS[motif].forEach(function(d) { ctx.stroke(new Path2D(d)); });
  ctx.restore();
  // Le numéro de collection, en haut à droite
  ctx.save();
  ctx.fillStyle = 'rgba(251, 252, 253, 0.92)';
  ctx.font = '700 26px Lato, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(cardNumber(motif), x + w - 28, y + 46);
  ctx.restore();
}

function renderCard(box, c) {
  if (!box.firstChild) {
    box.innerHTML = '<figure class="arc-card" aria-hidden="true"><span class="arc-shine"></span><div class="arc-art-box"></div>' +
      '<div class="arc-name"></div><div class="arc-title"></div>' +
      '<div class="arc-sector"><small>Secteur</small><span></span></div>' +
      '<div class="arc-foot"><span class="arc-chip"><span>' + BRAND + '</span><i></i><span class="arc-date"></span></span>' +
        '<img src="assets/ayming-logo.png" alt="" width="70" height="28"></div>' +
    '</figure>';
  }
  box.querySelector('.arc-art-box').innerHTML = art(c.motif);
  box.querySelector('.arc-name').textContent = c.prenom || 'Votre prénom';
  box.querySelector('.arc-name').classList.toggle('is-empty', !c.prenom);
  box.querySelector('.arc-title').textContent = c.title;
  var sector = sectorLabel(c.sector);
  box.querySelector('.arc-sector span').textContent = sector;
  box.querySelector('.arc-sector').hidden = !sector;
  box.querySelector('.arc-date').textContent = today(true);
}

// ── L'image partagée : la carte, dessinée sur un canvas au format portrait de LinkedIn ──
function wrap(ctx, text, maxW) {
  var words = text.split(' '), lines = [], line = '';
  words.forEach(function(w) {
    var test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function loadLogo() {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function() { resolve(null); };
    img.src = 'assets/ayming-logo.png';
  });
}

function drawCard(p, title, motif) {
  return loadLogo().then(function(logo) {
    var W = 1080, H = 1350;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#0b2233';
    ctx.fillRect(0, 0, W, H);
    // La carte
    var x = 140, y = 110, w = 800, h = 1130, pad = 56;
    ctx.fillStyle = '#FBFCFD';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.fill();
    // L'image : le dégradé, les anneaux et l'emblème
    var ax = x + pad, ay = y + pad, aw = w - 2 * pad, ah = 520;
    drawArt(ctx, ax, ay, aw, ah, motif);
    // Le prénom, le titre, le secteur
    ctx.textAlign = 'left';
    ctx.fillStyle = '#004A76';
    ctx.font = '900 112px Lato, sans-serif';
    ctx.fillText(p.prenom, ax, ay + ah + 150, aw);
    ctx.fillStyle = '#00A07E';
    ctx.font = '700 46px Lato, sans-serif';
    ctx.fillText(title, ax, ay + ah + 222, aw);
    var sector = sectorLabel(p.sector);
    if (sector) {
      ctx.fillStyle = '#8a98a6';
      ctx.font = '700 24px Lato, sans-serif';
      ctx.fillText('SECTEUR', ax, ay + ah + 290);
      ctx.fillStyle = '#4a5b6b';
      ctx.font = '400 32px Lato, sans-serif';
      wrap(ctx, sector, aw).forEach(function(l, i) { ctx.fillText(l, ax, ay + ah + 334 + i * 42); });
    }
    // Le pied : la puce « Sinistralité | date », le logo à droite
    var fy = y + h - pad - 58;
    ctx.font = '700 28px Lato, sans-serif';
    var brandW = ctx.measureText(BRAND.toUpperCase()).width;
    var date = today(true).toUpperCase();
    var dateW = ctx.measureText(date).width;
    var chipW = 24 + brandW + 24 + 36 + 24 + dateW + 24;
    ctx.strokeStyle = '#0072B6'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(ax, fy, chipW, 58, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(0, 114, 182, 0.25)';
    ctx.fillRect(ax + 24 + brandW + 24, fy + 2, 36, 54);
    ctx.fillStyle = '#0072B6';
    ctx.fillText(BRAND.toUpperCase(), ax + 24, fy + 39);
    ctx.fillText(date, ax + 24 + brandW + 24 + 36 + 24, fy + 39);
    if (logo) {
      var lh = 64, lw = logo.width * lh / logo.height;
      ctx.drawImage(logo, ax + aw - lw, fy - 3, lw, lh);
    }
    return c;
  });
}

function status(msg) { var s = el('badgeStatus'); if (s) s.textContent = msg; }

function download() {
  drawCard(getProfile(), badgeTitle(), badgeMotif()).then(function(c) {
    var a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'badge-sinistralite.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    status('Image téléchargée.');
  });
}

function copy() {
  if (!navigator.clipboard || !window.ClipboardItem) { status('Votre navigateur ne copie pas les images, téléchargez-la.'); return; }
  // Le presse-papiers exige d'être appelé dans le clic : on lui passe une promesse d'image.
  var blob = drawCard(getProfile(), badgeTitle(), badgeMotif()).then(function(c) {
    return new Promise(function(resolve) { c.toBlob(resolve, 'image/png'); });
  });
  navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
    function() { status('Image copiée, collez-la où vous voulez.'); },
    function() { status('Copie refusée par le navigateur, téléchargez l\'image.'); });
}

// LinkedIn ne reçoit qu'une adresse : la landing, marquée pour compter ce qui revient du badge.
// L'image se joint à la main, après l'avoir téléchargée.
function shareLinkedin() {
  var url = new URL('./', document.baseURI).href + SHARE_UTM;
  window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url), '_blank', 'noopener');
  status('Téléchargez l\'image pour la joindre à votre publication.');
}

function paint() {
  var p = getProfile();
  renderCard(el('badgeTag'), { prenom: p.prenom, sector: p.sector, title: badgeTitle(), motif: badgeMotif() });
  el('badgeTitle').textContent = p.prenom ? 'Bravo, ' + p.prenom + ' !' : 'Bravo !';
  var ready = !!p.prenom;
  ['badgeLinkedin', 'badgeDownload', 'badgeCopy'].forEach(function(id) { el(id).disabled = !ready; });
}

export function openBadge() {
  var dlg = el('badgeDialog');
  if (!dlg || typeof dlg.showModal !== 'function' || dlg.open) return;
  try { localStorage.setItem(SEEN, '1'); } catch (e) {}
  var p = getProfile();
  el('badgeNameField').hidden = !!p.prenom;
  el('badgeName').value = p.prenom;
  status('');
  paint();
  if (window.lucide) window.lucide.createIcons();
  dlg.showModal();
}

export function initBadge() {
  var dlg = el('badgeDialog');
  if (!dlg) return;
  el('badgeClose').addEventListener('click', function() { dlg.close(); });
  dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
  el('badgeName').addEventListener('input', function() { setProfile({ prenom: this.value }); paint(); });
  el('badgeLinkedin').addEventListener('click', shareLinkedin);
  el('badgeDownload').addEventListener('click', download);
  el('badgeCopy').addEventListener('click', copy);
  // La carte s'ouvre seule une fois, quand la dernière étape des premiers pas se coche. Une étape
  // se coche au début de l'action (la visite qui démarre, le formulaire qui devient valide, le
  // profil validé dans l'accueil) : la carte attend donc une pause, la fin d'une visite, la
  // fermeture d'une fenêtre ou un changement de page, sans visite, fenêtre ni champ en cours.
  var pending = false;
  function attempt() {
    if (!pending) return;
    if (busy()) return;
    pending = false;
    openBadge();
  }
  function soon() { if (pending) setTimeout(attempt, 800); }
  window.addEventListener('checklistcomplete', function() {
    var seen = false;
    try { seen = localStorage.getItem(SEEN) === '1'; } catch (e) {}
    if (seen || isDemo()) return;
    pending = true;
    soon();
  });
  window.addEventListener('tourend', soon);
  window.addEventListener('routechange', soon);
  // « close » ne remonte pas : la capture sur document le reçoit de chaque <dialog>.
  document.addEventListener('close', soon, true);
}

// Une visite guidée, une fenêtre ouverte ou un champ en cours de saisie : la personne est occupée.
function busy() {
  if (document.querySelector('.driver-popover') || document.body.classList.contains('driver-active')) return true;
  if (document.querySelector('dialog[open]')) return true;
  var a = document.activeElement;
  return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
}
