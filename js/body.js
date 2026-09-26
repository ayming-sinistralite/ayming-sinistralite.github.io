// ── Silhouettes : répartition par partie du corps ──
// Une silhouette dessinée pour l'outil, une bulle par partie du corps dont l'aire suit la
// part des cas. Deux sources : les TMS du volet MP (champ tms de mp-data.json, tiré de l'API
// Ameli par le pipeline) et le siège des lésions des fiches pour AT et Trajet (extra-dimensions.json).

import { fmt, pctFr, viewEl } from './utils.js';
import { buildCompareColumns } from './charts.js';

// Contour lissé (Catmull-Rom) et symétrique, axe en x = 150, du crâne (y 6) aux pieds (y 356).
var OUTLINE = 'M150.0 6.0 C153.3 6.0 157.3 6.3 160.0 8.0 C162.7 9.7 164.7 12.7 166.0 16.0 C167.3 19.3 167.8 24.0 168.0 28.0 C168.2 32.0 167.8 36.3 167.0 40.0 C166.2 43.7 164.5 47.3 163.0 50.0 C161.5 52.7 159.0 53.8 158.0 56.0 C157.0 58.2 156.3 61.0 157.0 63.0 C157.7 65.0 159.2 66.5 162.0 68.0 C164.8 69.5 170.2 70.5 174.0 72.0 C177.8 73.5 182.0 74.7 185.0 77.0 C188.0 79.3 190.3 82.2 192.0 86.0 C193.7 89.8 194.2 94.7 195.0 100.0 C195.8 105.3 196.3 111.7 197.0 118.0 C197.7 124.3 198.2 131.7 199.0 138.0 C199.8 144.3 201.0 150.0 202.0 156.0 C203.0 162.0 204.0 168.0 205.0 174.0 C206.0 180.0 207.0 187.2 208.0 192.0 C209.0 196.8 210.2 199.5 211.0 203.0 C211.8 206.5 212.8 209.5 213.0 213.0 C213.2 216.5 212.8 221.0 212.0 224.0 C211.2 227.0 209.3 230.2 208.0 231.0 C206.7 231.8 205.0 231.0 204.0 229.0 C203.0 227.0 202.7 222.7 202.0 219.0 C201.3 215.3 201.0 211.8 200.0 207.0 C199.0 202.2 197.3 196.2 196.0 190.0 C194.7 183.8 193.2 176.7 192.0 170.0 C190.8 163.3 190.0 156.7 189.0 150.0 C188.0 143.3 187.0 136.0 186.0 130.0 C185.0 124.0 183.8 114.3 183.0 114.0 C182.2 113.7 181.7 122.7 181.0 128.0 C180.3 133.3 179.2 140.3 179.0 146.0 C178.8 151.7 179.3 156.7 180.0 162.0 C180.7 167.3 182.2 172.3 183.0 178.0 C183.8 183.7 184.8 188.7 185.0 196.0 C185.2 203.3 184.5 213.7 184.0 222.0 C183.5 230.3 182.5 239.3 182.0 246.0 C181.5 252.7 181.2 256.7 181.0 262.0 C180.8 267.3 181.3 271.7 181.0 278.0 C180.7 284.3 180.0 292.7 179.0 300.0 C178.0 307.3 176.0 316.0 175.0 322.0 C174.0 328.0 172.8 332.3 173.0 336.0 C173.2 339.7 174.3 341.7 176.0 344.0 C177.7 346.3 182.2 348.0 183.0 350.0 C183.8 352.0 184.0 355.0 181.0 356.0 C178.0 357.0 168.2 357.2 165.0 356.0 C161.8 354.8 162.3 352.0 162.0 349.0 C161.7 346.0 163.0 343.2 163.0 338.0 C163.0 332.8 162.3 325.7 162.0 318.0 C161.7 310.3 161.3 300.7 161.0 292.0 C160.7 283.3 160.5 274.7 160.0 266.0 C159.5 257.3 158.8 248.7 158.0 240.0 C157.2 231.3 156.3 220.0 155.0 214.0 C153.7 208.0 151.7 204.0 150.0 204.0 C148.3 204.0 146.3 208.0 145.0 214.0 C143.7 220.0 142.8 231.3 142.0 240.0 C141.2 248.7 140.5 257.3 140.0 266.0 C139.5 274.7 139.3 283.3 139.0 292.0 C138.7 300.7 138.3 310.3 138.0 318.0 C137.7 325.7 137.0 332.8 137.0 338.0 C137.0 343.2 138.3 346.0 138.0 349.0 C137.7 352.0 138.2 354.8 135.0 356.0 C131.8 357.2 122.0 357.0 119.0 356.0 C116.0 355.0 116.2 352.0 117.0 350.0 C117.8 348.0 122.3 346.3 124.0 344.0 C125.7 341.7 126.8 339.7 127.0 336.0 C127.2 332.3 126.0 328.0 125.0 322.0 C124.0 316.0 122.0 307.3 121.0 300.0 C120.0 292.7 119.3 284.3 119.0 278.0 C118.7 271.7 119.2 267.3 119.0 262.0 C118.8 256.7 118.5 252.7 118.0 246.0 C117.5 239.3 116.5 230.3 116.0 222.0 C115.5 213.7 114.8 203.3 115.0 196.0 C115.2 188.7 116.2 183.7 117.0 178.0 C117.8 172.3 119.3 167.3 120.0 162.0 C120.7 156.7 121.2 151.7 121.0 146.0 C120.8 140.3 119.7 133.3 119.0 128.0 C118.3 122.7 117.8 113.7 117.0 114.0 C116.2 114.3 115.0 124.0 114.0 130.0 C113.0 136.0 112.0 143.3 111.0 150.0 C110.0 156.7 109.2 163.3 108.0 170.0 C106.8 176.7 105.3 183.8 104.0 190.0 C102.7 196.2 101.0 202.2 100.0 207.0 C99.0 211.8 98.7 215.3 98.0 219.0 C97.3 222.7 97.0 227.0 96.0 229.0 C95.0 231.0 93.3 231.8 92.0 231.0 C90.7 230.2 88.8 227.0 88.0 224.0 C87.2 221.0 86.8 216.5 87.0 213.0 C87.2 209.5 88.2 206.5 89.0 203.0 C89.8 199.5 91.0 196.8 92.0 192.0 C93.0 187.2 94.0 180.0 95.0 174.0 C96.0 168.0 97.0 162.0 98.0 156.0 C99.0 150.0 100.2 144.3 101.0 138.0 C101.8 131.7 102.3 124.3 103.0 118.0 C103.7 111.7 104.2 105.3 105.0 100.0 C105.8 94.7 106.3 89.8 108.0 86.0 C109.7 82.2 112.0 79.3 115.0 77.0 C118.0 74.7 122.2 73.5 126.0 72.0 C129.8 70.5 135.2 69.5 138.0 68.0 C140.8 66.5 142.3 65.0 143.0 63.0 C143.7 61.0 143.0 58.2 142.0 56.0 C141.0 53.8 138.5 52.7 137.0 50.0 C135.5 47.3 133.8 43.7 133.0 40.0 C132.2 36.3 131.8 32.0 132.0 28.0 C132.2 24.0 132.7 19.3 134.0 16.0 C135.3 12.7 137.3 9.7 140.0 8.0 C142.7 6.3 146.7 6.0 150.0 6.0 Z';

// Ancre de chaque partie sur la silhouette, et côté de son libellé : les membres à
// droite, l'axe du corps à gauche.
var ANCHORS = {
  tete:               { x: 150, y: 30,  side: 'left'  },
  cou:                { x: 150, y: 63,  side: 'left'  },
  epaule:             { x: 187, y: 86,  side: 'right' },
  torse:              { x: 150, y: 108, side: 'left'  },
  membres_superieurs: { x: 194, y: 145, side: 'right' },
  coude:              { x: 195, y: 150, side: 'right' },
  dos:                { x: 150, y: 152, side: 'left'  },
  poignet_main:       { x: 207, y: 216, side: 'right' },
  membres_inferieurs: { x: 171, y: 262, side: 'right' },
  genou:              { x: 171, y: 265, side: 'right' },
  cheville_pied:      { x: 169, y: 340, side: 'right' }
};

var LABELS = {
  tete: 'Tête', cou: 'Cou', epaule: 'Épaule', torse: 'Torse', coude: 'Coude',
  membres_superieurs: 'Membres|supérieurs', dos: 'Dos', poignet_main: 'Poignet, main',
  genou: 'Genou', membres_inferieurs: 'Membres|inférieurs', cheville_pied: 'Cheville, pied',
  plusieurs: 'Plusieurs syndromes', corps_entier: 'Corps entier', autres: 'Autres'
};

var LEFT_X = 66, RIGHT_X = 236;

// Un « | » coupe un libellé long sur deux lignes, le texte continu le rejoint ailleurs.
function plain(key) { return LABELS[key].replace('|', ' '); }

// shares : { partie: part entre 0 et 1, null quand elle n'est pas diffusée }.
function figureSVG(shares, title) {
  var bubbles = '', labels = '', extras = [];
  // Les grosses bulles d'abord, pour qu'une petite voisine reste visible par-dessus.
  var keys = Object.keys(shares).sort(function(a, b) { return (shares[b] || 0) - (shares[a] || 0); });
  keys.forEach(function(key) {
    var value = shares[key];
    var a = ANCHORS[key];
    var text = value == null ? 'NC' : pctFr(value * 100, 0);
    if (!a) {
      if (value) extras.push(plain(key) + ' : ' + text);
      return;
    }
    var r = value ? 3.5 + 18 * Math.sqrt(value) : 3;
    bubbles += value
      ? '<circle class="bf-halo" cx="' + a.x + '" cy="' + a.y + '" r="' + (r + 4).toFixed(1) + '"/>' +
        '<circle class="bf-bubble" cx="' + a.x + '" cy="' + a.y + '" r="' + r.toFixed(1) + '"/>'
      : '<circle class="bf-empty" cx="' + a.x + '" cy="' + a.y + '" r="' + r + '"/>';
    var right = a.side === 'right';
    var lx = right ? RIGHT_X : LEFT_X;
    var edge = right ? a.x + r + 2 : a.x - r - 2;
    labels +=
      '<line class="bf-lead" x1="' + edge.toFixed(1) + '" y1="' + a.y + '" x2="' + (right ? lx - 5 : lx + 5) + '" y2="' + a.y + '"/>' +
      '<text class="bf-label' + (value ? '' : ' bf-zero') + '" x="' + lx + '" y="' + (a.y - 3) + '" text-anchor="' + (right ? 'start' : 'end') + '">' +
        LABELS[key].split('|').map(function(line, i) {
          return '<tspan class="bf-name"' + (i ? ' x="' + lx + '" dy="13"' : '') + '>' + line + '</tspan>';
        }).join('') +
        '<tspan class="bf-val" x="' + lx + '" dy="15">' + text + '</tspan>' +
      '</text>';
  });
  var summary = keys
    .filter(function(k) { return shares[k]; })
    .map(function(k) { return plain(k) + ' ' + pctFr(shares[k] * 100, 0); })
    .join(', ');
  return '<svg class="bf-svg" viewBox="14 0 306 364" role="img" aria-label="' + title + ' : ' + (summary || 'aucune donnée') + '">' +
      '<path class="bf-body" d="' + OUTLINE + '"/>' + labels + bubbles +
    '</svg>' +
    (extras.length ? '<p class="bf-extra">' + extras.join(' · ') + '</p>' : '');
}

function figureCard(heading, shares, note) {
  return '<div class="bf-card">' +
      (heading ? '<div class="bf-head">' + heading + '</div>' : '') +
      (shares ? figureSVG(shares, heading || 'Répartition par partie du corps') : '<p class="bf-nc">' + note + '</p>') +
    '</div>';
}

// Dessine la section : une rangée de cartes pour un secteur seul, une colonne par secteur
// en comparaison. spec.single(sec) rend { sub, cards: [{ heading, shares, note }] },
// spec.column(sec) rend { heading, shares } ou null quand le secteur n'a pas de données.
function renderSection(viewId, suffix, sectors, spec) {
  var section = viewEl(viewId, suffix + 'Section');
  if (!section) return;
  if (!sectors.some(function(s) { return spec.column(s); })) { section.style.display = 'none'; return; }
  section.style.display = '';
  var grid = viewEl(viewId, suffix + 'Grid');
  var sub = viewEl(viewId, suffix + 'Sub');

  if (sectors.length < 2) {
    var single = spec.single(sectors[0]);
    sub.textContent = single.sub;
    grid.classList.remove('cmp-cols', 'cmp-cols-1', 'cmp-cols-2', 'cmp-cols-3');
    grid.classList.add('bf-grid', 'bf-grid-' + single.cards.length);
    grid.innerHTML = single.cards.map(function(c) { return figureCard(c.heading, c.shares, c.note); }).join('');
    return;
  }
  sub.textContent = spec.compareSub;
  grid.classList.remove('bf-grid', 'bf-grid-1', 'bf-grid-3');
  buildCompareColumns(grid, sectors, function(sec, idx, body) {
    var col = spec.column(sec);
    body.innerHTML = col ? figureCard(col.heading, col.shares) : '<p class="cmp-nodata">' + spec.empty + '</p>';
  });
}

// ── Volet MP : TMS par partie du corps (API Ameli) ──

// meta : celle du jeu de la vue, dont api_ameli porte l'année des données de l'API.
export function renderTmsBody(viewId, sectors, meta) {
  if (!meta.api_ameli) return;
  var year = meta.api_ameli.annee;
  var tmsOf = function(sec) {
    var e = sec.entry;
    return e && e.tms && e.tms.nb_tms > 0 ? e : null;
  };
  var nc = 'Non diffusé (secret statistique).';
  var sexCard = function(tms, sexe, label) {
    var part = tms['part_' + sexe];
    return { heading: label + (part ? ', ' + pctFr(part * 100, 0) + ' des TMS' : ''), shares: part ? tms[sexe] : null, note: nc };
  };
  renderSection(viewId, 'body', sectors, {
    empty: 'Aucun TMS reconnu.',
    compareSub: 'Part des troubles musculosquelettiques reconnus en ' + year + ' par partie du corps, tous sexes confondus.',
    column: function(sec) {
      var e = tmsOf(sec);
      return e ? { heading: fmt(e.tms.nb_tms) + ' TMS', shares: e.tms.tous } : null;
    },
    single: function(sec) {
      var e = tmsOf(sec);
      var tms = e.tms;
      var mp = sec.entry && sec.entry.stats && sec.entry.stats.mp_1er_reglement;
      return {
        sub: fmt(tms.nb_tms) + ' troubles musculosquelettiques reconnus en ' + year +
          (mp ? ', soit ' + pctFr(tms.nb_tms / mp * 100, 0) + ' des maladies professionnelles du secteur' : '') +
          '. Part des TMS par partie du corps, pour l\'ensemble puis selon le sexe.' +
          (e.api_calcule ? ' Niveau recalculé à partir des codes NAF 5.' : ''),
        cards: [{ heading: 'Ensemble', shares: tms.tous }, sexCard(tms, 'hommes', 'Hommes'), sexCard(tms, 'femmes', 'Femmes')]
      };
    }
  });
}

// ── AT et Trajet : siège des lésions (fiches PDF) ──

var SIEGE_KEYS = ['tete', 'cou', 'torse', 'dos', 'membres_superieurs', 'membres_inferieurs', 'corps_entier', 'autres'];

// Les fiches donnent des effectifs ; on les ramène en parts, « non déterminé » exclu.
function siegeShares(raw) {
  if (!raw) return null;
  var total = SIEGE_KEYS.reduce(function(s, k) { return s + (raw[k] || 0); }, 0);
  if (!total) return null;
  var shares = {};
  SIEGE_KEYS.forEach(function(k) { shares[k] = (raw[k] || 0) / total; });
  return shares;
}

export function renderSiegeBody(viewId, sectors, key, sinistreLabel) {
  if (!key) return;
  var sharesOf = function(sec) { return siegeShares(sec.dims && sec.dims[key]); };
  renderSection(viewId, 'siege', sectors, {
    empty: 'Siège des lésions indisponible.',
    compareSub: 'Où se situe la lésion. Part des ' + sinistreLabel + ' du secteur, valeurs « non déterminées » exclues.',
    column: function(sec) { var s = sharesOf(sec); return s ? { heading: '', shares: s } : null; },
    single: function(sec) {
      return {
        sub: 'Où se situe la lésion. Part des ' + sinistreLabel + ' du secteur, valeurs « non déterminées » exclues.',
        cards: [{ heading: '', shares: sharesOf(sec) }]
      };
    }
  });
}
