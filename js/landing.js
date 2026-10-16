// Comportements de la landing (index.html), chargé en fin de <body>. La page est en clair seulement.
// icons.js est en defer, on attend donc DOMContentLoaded.
document.addEventListener('DOMContentLoaded', function () { lucide.createIcons(); });
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function clamp(v) { return Math.max(0, Math.min(1, v)); }

// Le champ de secteur ouvre l'accueil de l'outil (/accueil/?q=<saisie>, lu par js/route.js) : la question
// du secteur de l'accueil s'ouvre remplie (tour.js). La CSP ferme form-action, d'où l'envoi en script.
document.querySelectorAll('form[data-start]').forEach(function (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = form.querySelector('input').value.trim();
    window.location.href = './accueil/' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
});

// « view » court de l'entrée par le bas de l'écran jusqu'aux deux tiers, « leave » dure pendant que le hero quitte l'écran.
// Les trois étapes ont leur propre progression, pendant qu'elles sont épinglées.
function prog(el, mode) {
  var r = el.getBoundingClientRect(), h = window.innerHeight;
  if (mode === 'pin') return clamp(-r.top / Math.max(1, r.height - h));
  if (mode === 'leave') return clamp(window.scrollY / (h * 0.8));
  return clamp((h - r.top) / (h * 0.7));
}
var scenes = [].slice.call(document.querySelectorAll('[data-scene]'));
var ticking = false;
function frame() {
  scenes.forEach(function (s) { s.style.setProperty('--p', (reduced ? 1 : prog(s, s.dataset.scene)).toFixed(4)); });
  if (how) howTarget(reduced ? 0.99 : prog(how, 'pin'));
  ticking = false;
}
window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
window.addEventListener('resize', frame);

// ── Comment ça marche. Le défilement fait avancer l'étape, et chaque étape sa démonstration à l'écran.
// Les coordonnées sont celles des captures de l'outil, en pixels d'une fenêtre de 1 440 x 900.
var how = document.getElementById('etapes'), screen = document.getElementById('screen'), laptop = document.getElementById('laptop'), mock = document.getElementById('mock');
var lid = laptop.querySelector('.lid'), howPhone = document.getElementById('howPhone'), howPdf = document.getElementById('howPdf'), howTexts = [].slice.call(document.querySelectorAll('.how-txt')), pdfPages = [].slice.call(document.querySelectorAll('#howPdf .rp'));
var views = {}; [].forEach.call(mock.querySelectorAll('.m-view'), function (v) { views[v.dataset.k] = v; });
var howProg = document.getElementById('howProg'), progDots = [].slice.call(howProg.querySelectorAll('i'));
var cursorEl = document.getElementById('cursor'), rippleEl = document.getElementById('ripple'), typedEl = document.getElementById('tSearch');

// Le questionnaire de Mon entreprise. Chaque question pose sa page sur la pile, comme dans l'outil (js/flow.js).
// L'écran est une maquette dessinée : les réponses sont des barres, jamais des chiffres, et rien ne se tape
// (José 2026-10-14). sk est la largeur de la barre de la réponse.
var QS = [
  { n: 1, track: 0, title: 'Pour qui prépare-t-on ce rapport ?', lab: 'Nom de votre entreprise', sk: 55, line: 'Couverture' },
  { n: 3, track: 1, title: 'Combien de salariés comptez-vous ?', lab: 'Effectif salarié', sk: 16, line: 'Votre profil' },
  { n: 4, track: 2, title: 'Et chez vous, combien d\'accidents avec arrêt sur l\'année ?', lab: 'Accidents du travail reconnus avec arrêt', sk: 9, line: 'Votre position face à votre secteur' },
  { n: 5, track: 3, title: 'Combien de jours d\'arrêt ces accidents ont-ils représentés ?', lab: 'Jours d\'arrêt sur l\'année', sk: 20, line: 'La gravité de vos arrêts' }
];
var CONTACT = { n: 8, track: 7, title: 'Vos résultats sont calculés.', lab: 'Votre prénom', sk: 30, line: 'Votre rapport est prêt', btn: 'Voir mon rapport →' };
var qEl = {
  title: document.getElementById('qTitle'), lab: document.getElementById('qLab'), sk: document.getElementById('qSk'),
  count: document.getElementById('qCount'), bar: document.getElementById('qBar'), btn: document.getElementById('qBtn'),
  line: document.getElementById('qLine'), track: [].slice.call(document.querySelectorAll('#qTrack li')),
  pages: [].slice.call(document.querySelectorAll('#qView [data-pg]'))
};
qEl.btn.textContent = 'Continuer →';

// Les cibles du curseur se lisent dans la maquette, en pixels de maquette.
var D = {};
function measure() {
  // La bande du titre prend la hauteur du plus long de ses textes, et le portable la place qui reste, pour que rien ne soit coupé.
  var topH = 0;
  howTexts.forEach(function (el) {
    var a = el.firstElementChild, b = el.lastElementChild;
    topH = Math.max(topH, b.offsetTop + b.offsetHeight - a.offsetTop + 22 + 28);
  });
  var stick = how.querySelector('.how-stick');
  stick.style.gridTemplateRows = Math.ceil(topH) + 'px 1fr';
  laptop.style.width = Math.round(Math.min(1100, window.innerWidth * 0.84, (stick.clientHeight - topH - 40) * 1.2)) + 'px';
  [].forEach.call(mock.querySelectorAll('[data-t]'), function (el) {
    var x = 0, y = 0, n = el;
    while (n && n !== mock) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    D[el.dataset.t] = { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2, l: x, t: y };
  });
  var W = laptop.offsetWidth, H = lid.offsetHeight;
  laptop.style.setProperty('--d', Math.max(4, W * 0.009).toFixed(1) + 'px');
  laptop.style.setProperty('--deck', H.toFixed(1) + 'px');
  laptop.style.setProperty('--bh', Math.max(8, W * 0.016).toFixed(1) + 'px');
  mock.style.transform = 'scale(' + (screen.clientWidth / 1440) + ')';
  [].forEach.call(document.querySelectorAll('.appview .mock'), function (m) { m.style.transform = 'scale(' + (m.parentNode.clientWidth / 1440) + ')'; });
  pdfPages.forEach(function (pg) { pg.firstElementChild.style.transform = 'scale(' + (pg.clientWidth / 794) + ')'; });
}
function seg(q, a, b) { return clamp((q - a) / (b - a)); }
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function mix(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

// Le texte du haut suit le défilement. Dans chaque étape, le défilement règle aussi la démonstration, en secondes d'animation,
// et la fin de l'étape tient l'image finale un moment. Comme sur la page du MacBook Neo, le portable fermé s'ouvre,
// grandit sur le questionnaire, puis tourne sur lui-même pour laisser venir le rapport.
// Les étapes finissent à 0,9 : le dernier dixième de la section tient l'image finale (le portable et le téléphone),
// pour que la scène ait fini avant que la page ne reparte.
// Votre entreprise reste courte (José 2026-10-16) : une question, un clic, puis le rapport.
var PHASES = [[0, 0.171, 0], [0.171, 0.392, 3.9], [0.392, 0.528, 2.0], [0.528, 0.761, 3.4], [0.761, 0.92, 2.0]];
function bigZoom() { return Math.max(1, Math.min(1.22, window.innerWidth * 0.94 / laptop.offsetWidth)); }
function howFrame(p) {
  var phase = 0; while (phase < PHASES.length - 1 && p >= PHASES[phase][1]) phase++;
  var ph = PHASES[phase];
  var t = reduced ? 99 : seg(p, ph[0], ph[1]) * ph[2] * 1.2;
  var open = reduced ? 1 : ease(seg(p, 0.02, 0.117));
  var st = { text: phase, view: 'at', sugg: false, typed: '', caret: false, cur: null, click: -1, zoom: 0, turn: 0, pdf: 0, fan: 0, pdfOut: 0, phone: 0, q: null };
  if (phase === 1) step1(t, st);
  else if (phase === 2) step2(t, st);
  else if (phase === 3) step3(t, st);
  else if (phase === 4) step4(t, st);
  howTexts.forEach(function (el, i) { el.classList.toggle('on', i === st.text); });
  // La ligne de progression : remplie jusqu'à la fin des étapes, un point par étape, l'étape en cours agrandie.
  howProg.style.setProperty('--hp', clamp(p / PHASES[PHASES.length - 1][1]).toFixed(4));
  howProg.style.setProperty('--hv', p > 0.06 ? 1 : 0);
  progDots.forEach(function (d, i) { d.classList.toggle('on', phase >= i + 1); d.classList.toggle('cur', phase === i + 1); });
  // Fermé, l'écran repose à plat sur le plateau, puis il se relève.
  laptop.style.setProperty('--lid', (-90 * (1 - open)).toFixed(2) + 'deg');
  howPhone.style.opacity = st.phone.toFixed(3);
  howPhone.style.transform = 'translateZ(calc(var(--deck) + 30px)) translateX(' + ((1 - st.phone) * 30).toFixed(2) + 'vw)';
  var z = 1 + (bigZoom() - 1) * st.zoom;
  // Le portable tourne sur lui-même, de profil on voit son épaisseur, puis il s'efface et le rapport finit le demi-tour.
  // Fermé, il n'a pas de hauteur, alors il remonte juste sous le titre, puis redescend à sa place en s'ouvrant.
  var lift = (1 - Math.cos((1 - open) * Math.PI / 2)) * lid.offsetHeight * 0.72;
  laptop.style.transform = 'translateY(' + (-lift).toFixed(1) + 'px) scale(' + z.toFixed(4) + ') rotateY(' + (st.turn * 90).toFixed(2) + 'deg)';
  laptop.style.setProperty('--fade', (1 - seg(st.turn, 0.97, 1)).toFixed(3));
  laptop.style.visibility = st.turn > 0.995 ? 'hidden' : '';
  var pdfTurn = st.pdfOut > 0 ? st.pdfOut : 1 - st.pdf;
  howPdf.style.opacity = pdfTurn > 0.995 ? 0 : 1;
  howPdf.style.transform = 'rotateY(' + (-90 * pdfTurn).toFixed(2) + 'deg)';
  pdfPages.forEach(function (im, i) {
    var side = i === 0 ? -1 : i === 1 ? 1 : 0;
    im.style.opacity = 1;
    im.style.transformOrigin = '50% 100%';
    im.style.transform = 'translate(' + (side * st.fan * 64) + '%,' + (side ? st.fan * 3 : -st.fan * 2) + '%) rotate(' + (side * st.fan * 6) + 'deg)';
  });
  drawScreen(st);
}

// Étape 1 : chercher « 4120 » et choisir le secteur, l'animation s'arrête sur sa page.
function step1(t, st) {
  var center = { x: 900, y: 640 }, target = { x: D.search.l + 260, y: D.search.y };
  st.cur = mix(center, target, ease(seg(t, 0.2, 1.0)));
  st.click = seg(t, 1.1, 1.4);
  st.typed = '4120'.slice(0, Math.round(seg(t, 1.4, 2.1) * 4)); st.caret = t > 1.2;
  if (t > 2.3) { st.sugg = true; st.caret = false; st.cur = mix(target, D.sugg, ease(seg(t, 2.5, 3.1))); st.click = seg(t, 3.2, 3.5); }
  if (t > 3.6) { st.view = 'sector'; st.sugg = false; st.click = -1; st.cur = null; }
}
// L'état du questionnaire : la question k, et les pages posées jusque-là.
// La pile garde les pages vues jusqu'à la question montrée, pour que rien n'y apparaisse sans s'être posé.
function quiz(k) {
  return { k: k, land: QS.map(function (q, j) { return j === 0 || j < Math.min(k, SHOWN + 1) ? 1 : 0; }) };
}
// Étape 2 : le portable grandit sur une seule question, la quatrième, réponse déjà donnée. Sa page se pose
// sur la pile, puis le curseur clique sur Continuer. Les autres questions ne se montrent pas (José 2026-10-16).
var SHOWN = 2;
function step2(t, st) {
  st.view = 'ent';
  st.zoom = ease(seg(t, 0, 0.9));
  st.zoom = ease(seg(t, 0, 0.7));
  st.q = quiz(SHOWN);
  st.q.land[SHOWN] = ease(seg(t, 0.5, 1.1));
  if (t > 1.0) { st.cur = mix({ x: D.btn.x + 60, y: D.btn.y + 140 }, D.btn, ease(seg(t, 1.0, 1.5))); st.click = seg(t, 1.6, 1.9); }
}
// Étape 3 : juste après le clic, le portable revient à sa taille, tourne sur lui-même, et le rapport
// apparaît en éventail. La phrase de l'étape ne vient qu'avec le rapport.
function step3(t, st) {
  st.view = 'ent'; st.text = 2;
  st.q = quiz(SHOWN + 1);
  st.zoom = 1 - ease(seg(t, 0, 0.8));
  // Un seul retournement, comme une carte : le portable tourne jusqu'à sa tranche, et le rapport repart
  // de la sienne au même instant. Rien ne s'efface en route, donc jamais d'écran blanc.
  var flip = ease(seg(t, 0.9, 1.9));
  st.turn = clamp(flip * 2);
  st.pdf = clamp(flip * 2 - 1);
  st.fan = ease(seg(t, 2.0, 2.8));
  if (st.pdf > 0.15) st.text = 3;
}
// Fin : le rapport refait le demi-tour, le portable revient sur l'outil et le téléphone le rejoint.
function step4(t, st) {
  st.view = 'ent'; st.pdf = 1; st.fan = 1 - ease(seg(t, 0, 0.4));
  st.q = quiz(QS.length);
  // Le même retournement à l'envers : le rapport rend la main au portable sur la tranche.
  var back = ease(seg(t, 0.3, 1.2));
  st.pdfOut = clamp(back * 2);
  st.turn = 1 - clamp(back * 2 - 1);
  st.phone = ease(seg(t, 1.0, 1.8));
}
function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
function drawQuiz(s) {
  var done = s.k >= QS.length, q = done ? CONTACT : QS[s.k];
  setText(qEl.title, q.title); setText(qEl.lab, q.lab); setText(qEl.line, done ? q.line : 'En cours · ' + q.line);
  setText(qEl.count, 'Question ' + q.n + ' sur 8'); qEl.bar.style.width = (q.n / 8 * 100) + '%';
  setText(qEl.btn, done ? CONTACT.btn : 'Continuer →');
  qEl.sk.style.width = q.sk + '%';
  qEl.track.forEach(function (li, i) { li.className = i < q.track ? 'done' : i === q.track ? 'cur' : ''; });
  qEl.pages.forEach(function (pg, j) {
    var p = s.land[j];
    // Opaque dès le premier tiers de sa course, comme dans l'outil, pour que la page du dessous ne transparaisse pas.
    pg.style.opacity = clamp(p * 3).toFixed(3);
    pg.style.transform = 'translate(' + ((1 - p) * 150).toFixed(1) + 'px,' + ((1 - p) * -100).toFixed(1) + 'px) rotate(calc(var(--r, 0deg) + ' + ((1 - p) * 8).toFixed(2) + 'deg))';
  });
}
function drawScreen(st) {
  mock.dataset.view = st.view;
  Object.keys(views).forEach(function (k) { views[k].classList.toggle('on', k === st.view); });
  views.at.classList.toggle('sugg', st.sugg);
  if (typedEl.textContent !== st.typed) typedEl.textContent = st.typed;
  typedEl.classList.toggle('caret', st.caret);
  if (st.q) drawQuiz(st.q);
  cursorEl.style.opacity = st.cur ? 1 : 0;
  if (st.cur) cursorEl.style.transform = 'translate(' + (st.cur.x - 6) + 'px,' + (st.cur.y - 3) + 'px) scale(' + (st.click > 0 && st.click < 1 ? 0.88 : 1) + ')';
  if (st.cur && st.click > 0 && st.click < 1) {
    rippleEl.style.left = st.cur.x + 'px'; rippleEl.style.top = st.cur.y + 'px';
    rippleEl.style.opacity = (1 - st.click).toFixed(2); rippleEl.style.transform = 'scale(' + (0.4 + st.click * 1.4) + ')';
  } else rippleEl.style.opacity = 0;
}
// Le défilement fixe un but, et la scène le rejoint en douceur à une vitesse plafonnée,
// pour qu'un coup de molette ou l'élan du pavé tactile ne fasse pas défiler la démonstration en accéléré.
var howP = null, howGoal = 0, howRaf = 0;
function howTarget(p) {
  howGoal = p;
  if (howP === null || reduced) { howP = p; howFrame(p); return; }
  if (!howRaf) howRaf = requestAnimationFrame(howStep);
}
// La scène avance toujours à la même vitesse, comptée en secondes et non en images, pour qu'un écran à 120 Hz n'aille pas
// deux fois plus vite et qu'un défilement brusque ne la fasse pas sauter. Toute la séquence dure une douzaine de secondes.
// Elle ne traîne jamais de plus d'un dixième derrière le défilement, sinon on quitterait la section avant la fin.
var HOW_SPEED = 0.098, HOW_LAG = 0.1, howLast = 0;
function howStep(ts) {
  howRaf = 0;
  var dt = howLast ? Math.min(0.05, (ts - howLast) / 1000) : 1 / 60;
  var d = howGoal - howP, stepMax = HOW_SPEED * dt;
  howP = Math.abs(d) <= stepMax ? howGoal : howP + (d > 0 ? stepMax : -stepMax);
  howP = Math.max(howGoal - HOW_LAG, Math.min(howGoal + HOW_LAG, howP));
  howFrame(howP);
  if (howP !== howGoal) { howLast = ts; howRaf = requestAnimationFrame(howStep); } else howLast = 0;
}
// Le frein (José 2026-10-16). Sans lui, un défilement rapide tire la scène par HOW_LAG et la fait jouer en accéléré.
// En descendant dans la section, la molette et le doigt n'emmènent pas la page plus de BRAKE devant la scène :
// elle avance alors à sa vitesse plafonnée, et la page suit. Remonter reste libre, la scène finie libère la page.
// La barre de défilement et le clavier ne passent pas par ici, HOW_LAG les rattrape.
var BRAKE = 0.03, END = PHASES[PHASES.length - 1][1];
function brakeLimit() {
  if (reduced || howP === null || howP >= END) return Infinity;
  var top = how.getBoundingClientRect().top + window.scrollY, range = how.offsetHeight - window.innerHeight;
  return top + (howP + BRAKE) * range;
}
function brake(e, dy) {
  if (dy <= 0) return;
  var hi = brakeLimit(), y = window.scrollY;
  if (y + dy <= hi) return;
  e.preventDefault();
  if (hi > y) window.scrollTo(0, hi);
}
window.addEventListener('wheel', function (e) { brake(e, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1)); }, { passive: false });
var touchY = null;
window.addEventListener('touchstart', function (e) { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchmove', function (e) {
  var y = e.touches[0].clientY, dy = touchY - y;
  touchY = y;
  if (dy > 0 && window.scrollY + dy > brakeLimit()) { e.preventDefault(); var hi = brakeLimit(); if (hi > window.scrollY) window.scrollTo(0, Math.min(hi, window.scrollY + dy)); }
}, { passive: false });

measure();
if (document.fonts) document.fonts.ready.then(function () { measure(); howFrame(howP === null ? 0 : howP); });
window.addEventListener('resize', function () { measure(); howFrame(howP === null ? 0 : howP); });
frame();

// La fenêtre du hero suit aussi la souris, doucement.
var hero = document.querySelector('.hero'), scene3d = document.getElementById('scene3d');
if (!reduced && window.matchMedia('(pointer: fine)').matches) {
  hero.addEventListener('mousemove', function (e) {
    var r = hero.getBoundingClientRect();
    scene3d.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    scene3d.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
}

// Les blocs entrent une fois, quand ils arrivent à l'écran.
var io = new IntersectionObserver(function (es) {
  es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.2 });
document.querySelectorAll('.rise, .from-right, .reveal-list, .tile').forEach(function (el) { io.observe(el); });

// Les chiffres des cartes montent jusqu'à leur valeur quand la carte arrive.
var countIo = new IntersectionObserver(function (es) {
  es.forEach(function (e) {
    if (!e.isIntersecting) return;
    countIo.unobserve(e.target);
    var el = e.target, to = parseFloat(el.dataset.count), dec = el.dataset.count.indexOf('.') > -1 ? 1 : 0, t0 = null;
    if (reduced) return;
    requestAnimationFrame(function step(now) {
      if (t0 === null) t0 = now;
      var k = ease(clamp((now - t0) / 1400));
      el.textContent = (to * k).toFixed(dec).replace('.', ',');
      if (k < 1) requestAnimationFrame(step);
    });
  });
}, { threshold: 0.4 });
document.querySelectorAll('[data-count]').forEach(function (el) { countIo.observe(el); });
