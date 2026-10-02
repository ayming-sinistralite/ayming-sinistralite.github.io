// ── Routage par chemin ──
//
// Chaque vue a son adresse : /accidents-du-travail/4711d-supermarches/, /autodiagnostic/, etc.
// Le déploiement écrit une copie de app.html à l'adresse de chaque secteur NAF 5
// (scripts/prerender.py), 404.html sert toutes les autres. Seul le code avant le premier tiret
// compte, sans égard à la casse : un ancien libellé, un code sans libellé ou une autre casse
// ouvrent le même secteur, et le routeur réécrit l'adresse avec replaceState.
// Les anciennes ancres (app.html#at/4711D, #compare, un code nu) sont lues ici aussi.
// Le libellé, le découpage du slug et le titre sont recopiés dans scripts/prerender.py :
// tests/route.test.js vérifie que les deux donnent les mêmes adresses pour tous les secteurs.

export var VIEW_PATHS = {
  at: 'accidents-du-travail',
  mp: 'maladies-professionnelles',
  trajet: 'trajet',
  compare: 'autodiagnostic',
  diagnostic: 'autodiagnostic/rapport'
};

var VIEW_TITLES = {
  at: 'accidents du travail',
  mp: 'maladies professionnelles',
  trajet: 'accidents de trajet'
};
var SITE_TITLE = 'Sinistralité France';
var SLUG_MAX = 60;
var SLUG_TAIL = ['de', 'du', 'des', 'a', 'l', 'et'];
var SECTOR_VIEWS = ['at', 'mp', 'trajet'];

// Le libellé en minuscules, sans accents, chaque suite d'autres caractères devenue un tiret.
export function slugify(text) {
  return String(text || '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Le segment d'un secteur : le code puis le libellé, coupé au dernier mot sous 60 caractères,
// sans mot vide en queue (« ...-a-l-exception-du-riz » et non « ...-du-riz-de »).
export function sectorSegment(code, libelle) {
  var seg = slugify(code + ' ' + (libelle || ''));
  if (seg.length > SLUG_MAX) {
    seg = seg.slice(0, SLUG_MAX + 1);
    seg = seg.slice(0, seg.lastIndexOf('-'));
  }
  var words = seg.split('-');
  while (words.length > 1 && SLUG_TAIL.indexOf(words[words.length - 1]) >= 0) words.pop();
  return words.join('-');
}

// Chemin relatif à la base du site, toujours terminé par une barre.
export function routePath(view, code, libelle) {
  var root = VIEW_PATHS[view] || VIEW_PATHS.compare;
  if (!code || SECTOR_VIEWS.indexOf(view) < 0) return root + '/';
  return root + '/' + (libelle ? sectorSegment(code, libelle) : String(code).toLowerCase()) + '/';
}

export function pageTitle(view, code, libelle) {
  if (view === 'compare' || view === 'diagnostic') return 'Autodiagnostic AT/MP | ' + SITE_TITLE;
  var what = VIEW_TITLES[view] || VIEW_TITLES.at;
  if (code && libelle) return libelle + ' (' + code + '), ' + what + ' | ' + SITE_TITLE;
  return what.charAt(0).toUpperCase() + what.slice(1) + ' par secteur | ' + SITE_TITLE;
}

function decode(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

// Code d'un segment : ce qui précède le premier tiret, en majuscules.
function codeOf(segment) {
  var code = decode(segment || '').split('-')[0].trim().toUpperCase();
  return code || null;
}

// Ancienne ancre : #at/CODE, #mp/CODE, #trajet/CODE, #compare, #compare/<saisie>,
// #diagnostic, une vue nue, ou un code nu qui désigne l'AT.
function parseLegacyHash(hash) {
  var h = String(hash || '').replace(/^#/, '').trim();
  if (!h || h === 'compare') return { view: 'compare', code: null, query: '' };
  if (h.indexOf('compare/') === 0) return { view: 'compare', code: null, query: decode(h.substring(8)) };
  if (h === 'diagnostic') return { view: 'diagnostic', code: null, query: '' };
  var slash = h.indexOf('/');
  var head = slash < 0 ? h : h.substring(0, slash);
  if (SECTOR_VIEWS.indexOf(head) >= 0) {
    return { view: head, code: slash < 0 ? null : codeOf(h.substring(slash + 1)), query: '' };
  }
  return { view: 'at', code: codeOf(h), query: '' };
}

// Lit une adresse ({ pathname, search, hash }) relative à basePath ('/' ou '/sinistralite-france/').
// Renvoie { view, code, query, legacy }. Une adresse inconnue ouvre l'autodiagnostic.
export function parseRoute(loc, basePath) {
  var base = basePath || '/';
  var path = loc.pathname || '/';
  var rel = path.indexOf(base) === 0 ? path.substring(base.length) : path.replace(/^\/+/, '');
  var parts = rel.split('/').filter(function(p) { return p; });
  var route;
  if (parts.length === 1 && parts[0] === 'app.html') {
    route = parseLegacyHash(loc.hash);
    route.legacy = true;
    return route;
  }
  var params = new URLSearchParams(loc.search || '');
  var view = null;
  for (var v in VIEW_PATHS) {
    if (VIEW_PATHS[v] === parts[0] && SECTOR_VIEWS.indexOf(v) >= 0) view = v;
  }
  if (view) {
    // Une vue sans secteur accepte ?q= (la landing) : la recherche s'ouvre remplie.
    var noCode = parts.length < 2;
    return { view: view, code: noCode ? null : codeOf(parts[1]), query: noCode ? (params.get('q') || '').trim() : '', legacy: false };
  }
  if (parts[0] === 'autodiagnostic' && parts[1] === 'rapport') return { view: 'diagnostic', code: null, query: '', legacy: false };
  return { view: 'compare', code: null, query: (params.get('q') || '').trim(), legacy: false };
}

// ── Côté navigateur ──

// Fournit le libellé d'un code pour une vue (branché par app.js sur les jeux chargés).
var lookup = function() { return ''; };
export function setLibelleLookup(fn) { lookup = fn; }

export function basePath() {
  return new URL(document.baseURI).pathname;
}

export function currentRoute() {
  return parseRoute(window.location, basePath());
}

export function titleFor(route) {
  return pageTitle(route.view, route.code, route.code ? lookup(route.view, route.code) : '');
}

// La chaîne de requête suit chaque navigation (?demo, utm_*), sauf la saisie ?q= déjà servie.
function keptSearch() {
  var params = new URLSearchParams(window.location.search);
  params.delete('q');
  var s = params.toString().replace(/=(?=&|$)/g, '');
  return s ? '?' + s : '';
}

// pushState ou replaceState vers un chemin relatif à la base. Comme une ancre modifiée,
// un pushState émet ensuite « routechange » (de façon asynchrone, comme hashchange) ;
// un replaceState n'émet rien. Une adresse inchangée ne fait rien du tout.
export function navigate(path, opts) {
  var replace = !!(opts && opts.replace);
  var url = new URL(path + keptSearch(), document.baseURI);
  var here = window.location;
  if (url.pathname === here.pathname && url.search === here.search && !here.hash) return;
  if (replace) history.replaceState(null, '', url.href);
  else history.pushState(null, '', url.href);
  document.title = titleFor(currentRoute());
  if (!replace) setTimeout(function() { window.dispatchEvent(new Event('routechange')); }, 0);
}

// Va à une vue (et un secteur). Rester sur la même vue et le même code ne fait que corriger
// l'adresse (slug, casse, ancienne ancre) sans nouvelle entrée d'historique.
export function goTo(view, code) {
  var here = currentRoute();
  var same = here.view === view && (here.code || '') === (code ? String(code).toUpperCase() : '');
  navigate(routePath(view, code, code ? lookup(view, code) : ''), { replace: same });
}

// Le retour et l'avance du navigateur parlent le même langage que navigate().
export function initRouter() {
  window.addEventListener('popstate', function() {
    window.dispatchEvent(new Event('routechange'));
  });
  // Un lien interne vers une vue de l'outil change de vue sans recharger la page.
  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    var url = new URL(a.href, document.baseURI);
    var base = basePath();
    if (url.origin !== window.location.origin || url.pathname.indexOf(base) !== 0) return;
    var head = url.pathname.substring(base.length).split('/')[0];
    var known = false;
    for (var v in VIEW_PATHS) if (VIEW_PATHS[v].split('/')[0] === head) known = true;
    if (!known) return;
    e.preventDefault();
    navigate(url.pathname.substring(base.length));
  });
}
