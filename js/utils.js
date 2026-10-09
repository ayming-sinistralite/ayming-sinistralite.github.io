// ── Helpers ──

// Échappe un texte qui ne vient pas de data/*.json avant de l'insérer par innerHTML.
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Lien vers la page du compte AT/MP sur net-entreprises.fr, là où l'employeur trouve ses accidents et son taux.
export var NET_ENTREPRISES_URL = 'https://www.net-entreprises.fr/declaration/compte-entreprise-service-de-depot-de-pj/#compte-at-mp';
export function netEntreprisesLink(label) {
  return '<a class="net-link" href="' + NET_ENTREPRISES_URL + '" target="_blank" rel="noopener">' + (label || 'net-entreprises.fr') + '</a>';
}

// Nombres et euros à la française, arrondis à l'unité.
export function frNum(n) { return Math.round(n).toLocaleString('fr-FR'); }
export function fmtEur(n) {
  n = Math.round(n);
  if (n >= 1000000) return (Math.round(n / 100000) / 10).toLocaleString('fr-FR') + ' M€';
  if (n >= 10000) return frNum(n / 1000) + ' k€';
  return frNum(n) + ' €';
}
export function fmt1(n) { return (n == null || isNaN(n)) ? '—' : n.toFixed(1).replace('.', ','); }

export function fmt(n) {
  if (n === undefined || n === null) return '-';
  return n.toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, ' ');
}

export function fmtCompact(n) {
  if (n === undefined || n === null) return { text: '-', compact: false };
  if (n >= 1000000) return { text: (n / 1000000).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'M', compact: true };
  if (n >= 1000) return { text: (n / 1000).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'K', compact: true };
  return { text: fmt(n), compact: false };
}

export var KPI_HELP = {
  'AT en 1er règlement': 'Accidents du travail ayant donné lieu à un premier règlement (indemnisation) par la CPAM.',
  'MP en 1er règlement': 'Maladies professionnelles ayant donné lieu à un premier règlement (indemnisation) par la CPAM.',
  'Accidents de trajet': 'Accidents survenus pendant le trajet domicile-travail ou travail-restaurant.',
  'Indice de fréquence': 'Nombre d\'accidents avec arrêt pour 1 000 salariés. Permet de comparer des secteurs de tailles différentes.',
  'Journées perdues': 'Total des journées d\'incapacité temporaire (arrêts de travail) imputées au secteur.',
  'Incapacités permanentes': 'Nouvelles incapacités permanentes (IP) reconnues dans l\'année. Mesure la gravité des séquelles.',
  'Salariés': 'Nombre de salariés couverts par le régime général dans ce secteur.',
  'Décès': '',
};

export function badgeHTML(secteur, national, invert) {
  if (!national || national === 0) return '';
  var pct = ((secteur - national) / national * 100);
  var sign = pct >= 0 ? '+' : '';
  var cls = pct > 5 ? 'up' : pct < -5 ? 'down' : 'neutral';
  if (invert) cls = cls === 'up' ? 'down' : cls === 'down' ? 'up' : 'neutral';
  return '<span class="badge ' + cls + '">' + sign + pct.toFixed(0) + '% vs national</span>';
}

// Pourcentage à la française : virgule décimale et espace avant le signe. Les données
// arrivent en nombres JS, dont le rendu par défaut donne « 90.5 % ».
export function pctFr(n, digits) {
  if (n === undefined || n === null || isNaN(n)) return '-';
  var d = digits === undefined ? 1 : digits;
  return n.toFixed(d).replace(/\.0$/, '').replace('.', ',') + ' %';
}

// Sans accent, en minuscules, les ligatures d\u00e9pli\u00e9es (\u00ab \u0153uf \u00bb se cherche \u00ab oeuf \u00bb) et la
// ponctuation en espace (\u00ab boulangerie-p\u00e2tisserie \u00bb contient le mot \u00ab patisserie \u00bb).
export function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae').replace(/[-'\u2019.,;:/()]/g, ' ');
}

// Une saisie qui commence par un chiffre est un code NAF : \u00ab 47.11D \u00bb et \u00ab 4711 d \u00bb valent 4711D.
export function codeQuery(raw) {
  var c = (raw || '').replace(/[\s.]/g, '').toUpperCase();
  return /^[0-9]/.test(c) ? c : null;
}

// Vrai quand chaque mot d'un des termes (expandQuery) se trouve dans le code ou le libell\u00e9,
// dans n'importe quel ordre.
export function matchesTerms(entry, terms) {
  var hay = normalize(entry.code) + ' ' + normalize(entry.libelle);
  return terms.some(function(t) {
    var words = t.split(/\s+/).filter(Boolean);
    return words.length > 0 && words.every(function(w) { return hay.indexOf(w) !== -1; });
  });
}

// ── Synonymes de recherche ──
// Les libellés NAF utilisent la terminologie officielle (« Activités hospitalières »,
// « Restauration »), pas le vocabulaire courant. Cette table relie un terme usuel
// à un ou plusieurs fragments qui matchent le libellé officiel. Les clés sont déjà
// normalisées (sans accent, minuscules) puisque la recherche compare des chaînes
// normalisées.
var SEARCH_SYNONYMS = {
  'hopital': ['hospital'],
  'clinique': ['hospital'],
  'resto': ['restauration'],
  'restau': ['restauration'],
  'batiment': ['construction'],
  'info': ['programmation'],
  'informatique': ['programmation'],
  'transport routier': ['transports routiers'],
  'interim': ['travail temporaire']
};

// Étend une requête utilisateur en une liste de termes normalisés à tester contre
// un libellé. Le premier terme est toujours la requête normalisée elle-même,
// les suivants sont les synonymes dont la clé apparaît dans la requête.
export function expandQuery(q) {
  var nq = normalize(q || '');
  var terms = [nq];
  Object.keys(SEARCH_SYNONYMS).forEach(function(key) {
    if (nq.indexOf(key) !== -1) {
      SEARCH_SYNONYMS[key].forEach(function(term) {
        if (terms.indexOf(term) === -1) terms.push(term);
      });
    }
  });
  return terms;
}

// ── Comparaison de secteurs, partagée par les vues AT, MP et Trajet ──
// La liste des secteurs comparés est unique pour les trois vues, comme le secteur
// sélectionné. Chaque vue ne couvre pas le même périmètre (Trajet publie
// moins de secteurs que l'AT), donc on partage la liste sans jamais la modifier ici : un code
// que la vue courante ne couvre pas passe dans « missing » et reste comparé ailleurs.
// hasCode(code) dit si la vue courante connaît ce secteur.
export function splitCompareCodes(compareCodes, currentCode, hasCode) {
  var visible = [], missing = [];
  (compareCodes || []).forEach(function(c) {
    if (c === currentCode) return;
    if (hasCode(c)) visible.push(c);
    else missing.push(c);
  });
  return { visible: visible, missing: missing };
}

// Niveau NAF d'un code d'après sa longueur : une lettre est une section (NAF 1), deux chiffres
// une division, quatre une sous-classe, le reste un code NAF 5.
export function levelOfCode(code) {
  var n = String(code || '').length;
  return n === 1 ? 'naf1' : n === 2 ? 'naf2' : n === 4 ? 'naf4' : 'naf5';
}

// Section (lettre) d'une division : le jeu la porte sur chaque entrée NAF 2, sauf la division
// fantôme du fichier MP qui n'en a pas.
export function naf1Of(data, naf2) {
  var e = data && data.by_naf2 && data.by_naf2[naf2];
  return (e && e.naf1) || null;
}

// Code équivalent de `code` au niveau cible, ou null quand le jeu ne le couvre pas. Descendre
// d'une section prend sa première division, puis la logique habituelle s'applique.
export function adaptCodeToLevel(data, code, targetLevel) {
  var store = (data && data['by_' + targetLevel]) || {};
  if (store[code]) return code;
  if (levelOfCode(code) === 'naf1') {
    var section = (data && data.by_naf1 || {})[code];
    if (!section || !section.codes_naf2 || !section.codes_naf2.length) return null;
    code = section.codes_naf2[0];
    if (store[code]) return code;
  }
  if (targetLevel === 'naf1') {
    var letter = naf1Of(data, code.substring(0, 2));
    return letter && store[letter] ? letter : null;
  }
  if (targetLevel === 'naf4' && code.length >= 4) return store[code.substring(0, 4)] ? code.substring(0, 4) : null;
  if (targetLevel === 'naf2') return store[code.substring(0, 2)] ? code.substring(0, 2) : null;
  var match = Object.keys(store).find(function(k) { return k.startsWith(code); });
  return match || null;
}

// Palette de la charte, déclarée dans tokens.css et relue à chaque rendu pour suivre le thème.
// Ordonnée pour que deux parts voisines ne soient jamais deux bleus proches.
export function causeColors() {
  return ['--c-2', '--c-1', '--c-3', '--c-orange', '--c-6', '--c-7', '--c-5', '--c-8'].map(themeColor);
}

// Chart.js ne comprend pas var(--x) : on résout la variable au moment de dessiner.
export function cssColor(c) {
  var m = /^var\((--[\w-]+)\)$/.exec(c || '');
  return m ? themeColor(m[1]) : c;
}

// ── DOM helpers ──
export function el(id) { return document.getElementById(id); }
export function viewEl(viewId, suffix) { return el(viewId + '-' + suffix); }

// ── Piège de focus (partagé par le tiroir Partager et le panneau assistant) ──
var FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// La liste se relit à chaque Tab : un contenu ajouté après l'ouverture (les puces de Virginie)
// reste atteignable.
export function trapFocus(container) {
  container._trapHandler = function(e) {
    if (e.key !== 'Tab') return;
    var focusable = Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE), function(n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (!first) return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  container.addEventListener('keydown', container._trapHandler);
}

export function releaseFocus(container) {
  if (container._trapHandler) container.removeEventListener('keydown', container._trapHandler);
}

export function themeColor(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

// Motif ARIA combobox d'un champ et de sa liste de suggestions. Les enfants porteurs de
// data-code sont les options, les autres (aide, compteur, message) sont de présentation.
export function comboAria(input, box) {
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', box.id);
  box.setAttribute('role', 'listbox');
  return {
    opened: function() {
      Array.prototype.forEach.call(box.children, function(it, i) {
        if (!it.dataset.code) { it.setAttribute('role', 'presentation'); return; }
        it.setAttribute('role', 'option');
        it.setAttribute('aria-selected', 'false');
        it.id = box.id + '-opt' + i;
      });
      input.setAttribute('aria-expanded', 'true');
      input.removeAttribute('aria-activedescendant');
    },
    closed: function() {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    },
    active: function(items, index) { comboActive(input, items, index); }
  };
}

function comboActive(input, items, index) {
  items.forEach(function(it, i) { it.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
  if (items[index]) input.setAttribute('aria-activedescendant', items[index].id);
  else input.removeAttribute('aria-activedescendant');
}

// Clavier d'un champ de suggestions : flèches, Entrée, Échap. Ce qui change d'un champ à l'autre :
//   items()       les options courantes (tableau-like, déjà filtrées)
//   index() / setIndex(n)   où vit l'index actif
//   onEnter(items)   facultatif, appelé avant le clic par défaut, renvoie true s'il a tout traité
//   onEscape()    ce que fait Échap
// Entrée sans option active clique la première, et sans option ne fait rien.
export function comboKeys(input, opts) {
  input.addEventListener('keydown', function(e) {
    var items = Array.prototype.slice.call(opts.items());
    var idx;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      idx = e.key === 'ArrowDown' ? Math.min(opts.index() + 1, items.length - 1) : Math.max(opts.index() - 1, 0);
      opts.setIndex(idx);
      items.forEach(function(it, i) { it.classList.toggle('active', i === idx); });
      comboActive(input, items, idx);
      if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (opts.onEnter && opts.onEnter(items)) return;
      if (items.length) items[opts.index() >= 0 ? opts.index() : 0].click();
    } else if (e.key === 'Escape') {
      opts.onEscape();
    }
  });
}
