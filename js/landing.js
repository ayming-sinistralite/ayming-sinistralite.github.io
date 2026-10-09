// Comportements de la landing (index.html), chargé en fin de <body>.
// Icônes et thème. icons.js est en defer, on attend donc DOMContentLoaded.
document.addEventListener('DOMContentLoaded', function () { lucide.createIcons(); });
document.getElementById('themeToggle').addEventListener('click', function () {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  try { localStorage.setItem('sinistralite-theme', isDark ? 'light' : 'dark'); } catch (e) {}
});

var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Le champ de secteur ouvre l'accueil de l'outil (/accueil/?q=<saisie>, lu par js/route.js) : la question
// du secteur de l'accueil s'ouvre remplie (tour.js). L'accueil d'abord, pour qu'une seule visite guidée s'ouvre.
document.querySelectorAll('form[data-start]').forEach(function (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = form.querySelector('input').value.trim();
    window.location.href = './accueil/' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
});
// Le bonus mène aussi à l'accueil de l'outil (/accueil/?q=<saisie>) : un code NAF5 préremplit la question
// du secteur, un mot-clé y ouvre la liste. Une seule visite guidée, l'accueil (tour.js).
document.getElementById('searchForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var q = document.getElementById('searchInput').value.trim();
  window.location.href = './accueil/' + (q ? '?q=' + encodeURIComponent(q) : '');
});

// Barre de lecture et ombre de la navigation.
var nav = document.getElementById('nav');
var progress = document.getElementById('progress');
var ticking = false;
function onScroll() {
  var max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
  nav.classList.toggle('scrolled', window.scrollY > 8);
  ticking = false;
}
window.addEventListener('scroll', function () {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
onScroll();

// Compteur animé, formaté à la française.
function fmt(v, d) { return v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function countUp(el, to, decimals, duration) {
  if (reduced) { el.textContent = fmt(to, decimals); return; }
  var start = performance.now();
  function tick(now) {
    var p = Math.min((now - start) / duration, 1);
    el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)), decimals);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Apparition au défilement, une seule fois par élément. Le retard d'apparition est
// retiré ensuite, sinon il ralentirait aussi les survols.
var io = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (!entry.isIntersecting) return;
    var el = entry.target;
    el.classList.add('in');
    setTimeout(function () { el.style.setProperty('--d', '0ms'); }, 1200);
    var n = el.querySelector('.stat-number[data-target]');
    if (n) countUp(n, parseInt(n.dataset.target, 10), 0, 1400);
    io.unobserve(el);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal, #pages').forEach(function (el) { io.observe(el); });

// Le rapport en relief : les pages s'écartent à l'arrivée, puis suivent la souris.
var stack = document.getElementById('stack');
function openStack() { setTimeout(function () { stack.classList.add('open'); }, reduced ? 0 : 500); }
if (!reduced && window.matchMedia('(pointer: fine)').matches) {
  var hero = document.querySelector('.hero');
  hero.addEventListener('mousemove', function (e) {
    var r = hero.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    stack.style.setProperty('--rz', (-36 + x * 10) + 'deg');
    stack.style.setProperty('--rx', (56 - y * 8) + 'deg');
    stack.style.setProperty('--gap', (84 + x * 16) + 'px');
  });
  hero.addEventListener('mouseleave', function () {
    stack.style.removeProperty('--rz'); stack.style.removeProperty('--rx'); stack.style.removeProperty('--gap');
  });
}

// La démonstration, sur les chiffres relevés dans l'outil pour 4120A, 120 salariés,
// 9 accidents et 4,8 M€ de masse salariale. L'étape 1 tape les chiffres, l'étape 2
// construit le résultat, chacune quand elle entre à l'écran.
var fields = Array.prototype.slice.call(document.querySelectorAll('.f-field'));
var bars = Array.prototype.slice.call(document.querySelectorAll('.bar-fill'));
var money = Array.prototype.slice.call(document.querySelectorAll('.money'));
var ifEl = document.getElementById('demoIf');
var gap = document.getElementById('demoGap');
var replay = document.getElementById('demoReplay');
var timers = [];
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

function playForm() {
  if (reduced) { fields.forEach(function (f) { f.querySelector('output').textContent = f.dataset.value; }); return; }
  var t = 200;
  fields.forEach(function (f) {
    var out = f.querySelector('output');
    var text = f.dataset.value;
    out.textContent = '';
    later(function () { f.classList.add('typing'); }, t);
    for (var i = 1; i <= text.length; i++) {
      (function (n) { later(function () { out.textContent = text.slice(0, n); }, t + 90 + n * 70); })(i);
    }
    t += 90 + text.length * 70 + 260;
    later(function () { f.classList.remove('typing'); }, t - 120);
  });
}
function resetResult() {
  bars.forEach(function (b) { b.style.transition = 'none'; b.style.transform = 'scaleX(0)'; });
  money.forEach(function (m) { m.classList.remove('show'); });
  gap.classList.remove('show'); replay.classList.remove('show');
  ifEl.textContent = '0,0';
  void document.body.offsetWidth;
}
function playResult() {
  resetResult();
  if (reduced) {
    bars.forEach(function (b) { b.style.transform = 'scaleX(' + (parseFloat(b.dataset.w) / 100) + ')'; });
    money.forEach(function (m) { m.classList.add('show'); });
    gap.classList.add('show'); ifEl.textContent = '75,0';
    return;
  }
  countUp(ifEl, 75, 1, 1100);
  bars.forEach(function (b, i) {
    b.style.transition = '';
    later(function () { b.style.transform = 'scaleX(' + (parseFloat(b.dataset.w) / 100) + ')'; }, i * 110);
  });
  later(function () { gap.classList.add('show'); }, 900);
  later(function () { money[0].classList.add('show'); }, 1200);
  later(function () { money[1].classList.add('show'); }, 1400);
  later(function () { replay.classList.add('show'); }, 2000);
}
replay.addEventListener('click', playResult);

function whenSeen(el, fn) {
  var o = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) { o.disconnect(); setTimeout(fn, reduced ? 0 : 400); }
  }, { threshold: 0.5 });
  o.observe(el);
}

openStack();
whenSeen(document.getElementById('demoForm'), playForm);
whenSeen(document.getElementById('demoResult'), playResult);
