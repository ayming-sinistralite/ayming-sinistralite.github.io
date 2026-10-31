// ── Routage par chemin ──
//
// Chaque vue a son adresse : /accueil/, /accidents-du-travail/4711d-supermarches/, /autodiagnostic/, etc.
// Le déploiement écrit une copie de app.html à l'adresse de chaque secteur NAF 5
// (scripts/prerender.py), 404.html sert toutes les autres. Seul le code avant le premier tiret
// compte, sans égard à la casse : un ancien libellé, un code sans libellé ou une autre casse
// ouvrent le même secteur, et le routeur réécrit l'adresse avec replaceState.
// Les anciennes ancres (app.html#at/4711D, #compare, un code nu) sont lues ici aussi. Une adresse
// inconnue, et app.html sans ancre, ouvrent l'accueil de l'outil.
// Le libellé, le découpage du slug et le titre (avec son chiffre) sont recopiés dans scripts/prerender.py :
// tests/route.test.js vérifie que les deux donnent les mêmes adresses pour tous les secteurs.

import { getData, shortNameOf } from './data.js?v=5f667a9';

export var VIEW_PATHS = {
  home: 'accueil',
  at: 'accidents-du-travail',
  mp: 'maladies-professionnelles',
  trajet: 'trajet',
  compare: 'autodiagnostic',
  diagnostic: 'autodiagnostic/rapport'
};

export var VIEW_TITLES = {
  at: 'accidents du travail',
  mp: 'maladies professionnelles',
  trajet: 'accidents de trajet'
};
var SITE_TITLE = 'Sinistralité France';
var TITLE_SUFFIX = ' | ' + SITE_TITLE;
var TITLE_MAX = 65;
var EVENT_KEYS = { at: 'at_1er_reglement', mp: 'mp_1er_reglement', trajet: 'trajet_count' };
var HOW_MANY = {
  at: 'combien d\'accidents du travail ?',
  mp: 'combien de maladies professionnelles ?',
  trajet: 'combien d\'accidents de trajet ?'
};
export var SMALL_SAMPLE = 10;
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
  var root = VIEW_PATHS[view] || VIEW_PATHS.home;
  if (!code || SECTOR_VIEWS.indexOf(view) < 0) return root + '/';
  return root + '/' + (libelle ? sectorSegment(code, libelle) : String(code).toLowerCase()) + '/';
}

// Le titre d'un secteur commence par son métier et finit par un verdict lu dans les données,
// sans année. facts = { indice, national, events }, et sous SMALL_SAMPLE cas, ou sans chiffre,
// le titre pose la question à la place. Le méta de partage n'est écrit que par prerender.py.
function fr1(v) { return v.toFixed(1).replace('.', ','); }

export function shortLibelle(code, libelle) {
  return String(libelle || '').replace(/\s*\([^)]*\)/g, '').trim() || 'Secteur ' + code;
}

// L'écart à la moyenne, sur les chiffres arrondis que la page affiche.
export function verdict(ind, nat) {
  ind = Math.round(ind * 10) / 10; nat = Math.round(nat * 10) / 10;
  var ratio = Math.round(ind / nat * 10) / 10;
  if (ratio >= 2) return 'à ' + fr1(ratio).replace(',0', '') + ' fois la moyenne';
  var pct = Math.round((ind / nat - 1) * 100);
  if (pct >= 10) return pct + ' % au-dessus de la moyenne';
  if (pct <= -10) return (-pct) + ' % sous la moyenne';
  return 'dans la moyenne';
}

// Le métier tel que les titres et descriptions le nomment : le nom court tenu à la main
// (data/pipeline/short_names.py), sinon le libellé officiel sans ses parenthèses.
export function tradeName(code, libelle) {
  return shortNameOf(code) || shortLibelle(code, libelle);
}

export function pageTitle(view, code, libelle, facts) {
  if (view === 'home') return 'Accueil | ' + SITE_TITLE;
  if (view === 'compare' || view === 'diagnostic') return 'Autodiagnostic AT/MP | ' + SITE_TITLE;
  var what = VIEW_TITLES[view] || VIEW_TITLES.at;
  if (!code) return what.charAt(0).toUpperCase() + what.slice(1) + ' par secteur | ' + SITE_TITLE;
  var lib = tradeName(code, libelle);
  var f = facts || {};
  var title = f.indice != null && f.national && (f.events || 0) >= SMALL_SAMPLE
    ? lib + ', ' + what + ' ' + verdict(f.indice, f.national)
    : lib + ', ' + HOW_MANY[view];
  if (title.length + TITLE_SUFFIX.length <= TITLE_MAX) title += TITLE_SUFFIX;
  return title;
}

// La description d'un secteur : les mots qu'un acheteur tape d'abord, puis l'écart à la moyenne,
// puis les effectifs. facts = { indice, national, events, salaries, year }. Recopiée dans
// scripts/prerender.py (sector_description), tests/route.test.js compare les deux.
var EVENT_NOUNS = {
  at: ['accident du travail', 'accidents du travail'],
  mp: ['maladie professionnelle', 'maladies professionnelles'],
  trajet: ['accident de trajet', 'accidents de trajet']
};
var RATE_NOUNS = { at: 'accidents avec arrêt', mp: 'maladies professionnelles', trajet: 'accidents de trajet' };
var CTA = 'Comparez votre entreprise à son secteur.';
export var VIEW_DESCRIPTIONS = {
  home: 'Retrouvez la sinistralité de votre secteur d\'activité en France, accidents du travail, maladies professionnelles et accidents de trajet, par code NAF. ' + CTA,
  compare: 'Répondez à quelques questions sur votre entreprise et situez-la face à la sinistralité de son secteur, accidents du travail et maladies professionnelles. ' + CTA,
  at: 'Indice de fréquence, causes et évolution des accidents du travail de chaque secteur d\'activité en France. ' + CTA,
  mp: 'Indice de fréquence, types de maladies et évolution des maladies professionnelles de chaque secteur d\'activité en France. ' + CTA,
  trajet: 'Indice de fréquence, causes et évolution des accidents de trajet de chaque secteur d\'activité en France. ' + CTA
};

function frInt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

export function pageDescription(view, code, libelle, facts) {
  if (!code || SECTOR_VIEWS.indexOf(view) < 0) return VIEW_DESCRIPTIONS[view === 'diagnostic' ? 'compare' : view] || VIEW_DESCRIPTIONS.home;
  var f = facts || {};
  var what = VIEW_TITLES[view];
  var head = 'Statistiques ' + what + ' du secteur ' + tradeName(code, libelle) + ' (NAF ' + code + ')';
  if (f.indice == null) return head + ' : ' + EVENT_NOUNS[view][1] + ' et indice de fréquence pour 1 000 salariés, selon les derniers chiffres officiels. ' + CTA;
  var out = head + ' : ' + fr1(f.indice) + ' ' + RATE_NOUNS[view] + ' pour 1 000 salariés';
  if (f.national) {
    out += ' contre ' + fr1(f.national) + ' en France';
    if ((f.events || 0) >= SMALL_SAMPLE) out += ', ' + verdict(f.indice, f.national);
  }
  out += '.';
  if (f.events != null) {
    out += ' ' + frInt(f.events) + ' ' + EVENT_NOUNS[view][f.events === 1 ? 0 : 1];
    if (f.salaries) out += ' pour ' + frInt(f.salaries) + ' salariés';
    out += '.';
  }
  return out + ' ' + CTA;
}

// L'indice national est la somme des secteurs NAF 5, comme dans prerender.py (aucun jeu ne
// porte de ligne nationale). Gardé par jeu chargé.
var nationalCache = new WeakMap();
function nationalIndex(data, view) {
  if (nationalCache.has(data)) return nationalCache.get(data);
  var ev = 0, sal = 0, key = EVENT_KEYS[view];
  Object.keys(data.by_naf5 || {}).forEach(function (c) {
    var st = data.by_naf5[c].stats || {};
    if (st[key] != null && st.nb_salaries) { ev += st[key]; sal += st.nb_salaries; }
  });
  var nat = sal ? Math.round(ev / sal * 10000) / 10 : null;
  nationalCache.set(data, nat);
  return nat;
}

// Les chiffres du titre pour un code d'un jeu, quel que soit son niveau NAF.
export function sectorFacts(data, view, code) {
  var levels = ['naf5', 'naf4', 'naf2', 'naf1'];
  for (var i = 0; i < levels.length; i++) {
    var e = (data['by_' + levels[i]] || {})[code];
    if (e) {
      var st = e.stats || {};
      var years = (data.meta || {}).years || [];
      return { indice: st.indice_frequence, national: nationalIndex(data, view), events: st[EVENT_KEYS[view]], salaries: st.nb_salaries, year: years[years.length - 1] };
    }
  }
  return null;
}

function factsOf(view, code) {
  var d = getData(view);
  return d && d.by_naf5 ? sectorFacts(d, view, code) : null;
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
  if (!h) return { view: 'home', code: null, query: '' };
  if (h === 'compare') return { view: 'compare', code: null, query: '' };
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
// Renvoie { view, code, query, legacy }. Une adresse inconnue ouvre l'accueil.
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
  if (parts[0] === 'autodiagnostic') return { view: 'compare', code: null, query: (params.get('q') || '').trim(), legacy: false };
  return { view: 'home', code: null, query: (params.get('q') || '').trim(), legacy: false };
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
  var facts = route.code && SECTOR_VIEWS.indexOf(route.view) >= 0 ? factsOf(route.view, route.code) : null;
  return pageTitle(route.view, route.code, route.code ? lookup(route.view, route.code) : '', facts);
}

export function descriptionFor(route) {
  var facts = route.code && SECTOR_VIEWS.indexOf(route.view) >= 0 ? factsOf(route.view, route.code) : null;
  return pageDescription(route.view, route.code, route.code ? lookup(route.view, route.code) : '', facts);
}

// Une balise du <head> par sélecteur, créée quand le gabarit ne l'a pas.
function headTag(selector, tag, attr, value) {
  var el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  return el;
}

// Le titre, la description, l'adresse canonique et les balises de partage suivent la page affichée :
// sans cela, la première page chargée garde ses valeurs pour toute la visite. L'origine du canonical
// est celle que prerender.py a écrite, à défaut celle de la page.
export function applyPageMeta(route) {
  var title = titleFor(route);
  var desc = descriptionFor(route);
  var canonical = headTag('link[rel="canonical"]', 'link', 'rel', 'canonical');
  var origin;
  try { origin = new URL(canonical.getAttribute('href') || document.baseURI, document.baseURI).origin; }
  catch (e) { origin = new URL(document.baseURI).origin; }
  var path = routePath(route.view, route.code, route.code ? lookup(route.view, route.code) : '');
  var url = origin + basePath() + path;
  document.title = title;
  canonical.setAttribute('href', url);
  headTag('meta[name="description"]', 'meta', 'name', 'description').setAttribute('content', desc);
  headTag('meta[property="og:title"]', 'meta', 'property', 'og:title').setAttribute('content', title);
  headTag('meta[property="og:description"]', 'meta', 'property', 'og:description').setAttribute('content', desc);
  headTag('meta[property="og:url"]', 'meta', 'property', 'og:url').setAttribute('content', url);
}

// La chaîne de requête suit chaque navigation (?demo, utm_*), sauf la saisie ?q= déjà servie.
function keptSearch() {
  var params = new URLSearchParams(window.location.search);
  params.delete('q');
  var s = params.toString().replace(/=(?=&|$)/g, '');
  return s ? '?' + s : '';
}

// Les drapeaux de l'adresse. ?test (prefillTest, compare.js) remplit tout le parcours et vaut
// démonstration : coordonnées facultatives, aucun envoi vers Pardot, pas de visite guidée.
export function hasFlag(name) { return new URLSearchParams(window.location.search).has(name); }
export function isDemo() { return hasFlag('demo') || hasFlag('test'); }

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
  applyPageMeta(currentRoute());
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
