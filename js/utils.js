// ── Helpers ──

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

export function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
// sélectionné. Chaque vue ne couvre pas le même périmètre (Trajet publie 629 secteurs
// contre 729 pour AT), donc on partage la liste sans jamais la modifier ici : un code
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

export var CAUSE_COLORS = [
  '#7c6ef0','#4e9af5','#3fb950','#e8bc6a',
  '#e5534b','#d94fa0','#5bc0be','#f0883e'
];

// ── DOM helpers ──
export function el(id) { return document.getElementById(id); }
export function viewEl(viewId, suffix) { return el(viewId + '-' + suffix); }

// ── Piège de focus (partagé par le tiroir Partager et le panneau assistant) ──
var FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function trapFocus(container) {
  var focusable = Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE));
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  container._trapHandler = function(e) {
    if (e.key !== 'Tab' || !first) return;
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
