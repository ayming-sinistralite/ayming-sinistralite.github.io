// ── Mots du quotidien vers le(s) code(s) NAF qu'un RH vise ──
// « plombier » ne figure dans aucun libellé NAF : le secteur s'appelle « Travaux d'installation
// d'eau et de gaz ». Chaque mot (accents et casse ignorés, voir tradeCodes) mène aux codes qui
// passent avant tout résultat par libellé. Un code d'une lettre est une section, deux chiffres
// une division. Tests/search.test.js vérifie que chaque code existe dans le jeu de données.

import { normalize } from './utils.js?v=e9f97a8';

export var TRADE_WORDS = {
  // Bâtiment
  'plombier': ['4322A'], 'plombiers': ['4322A'], 'plomberie': ['4322A'],
  'chauffagiste': ['4322B'], 'chauffagistes': ['4322B'], 'chauffage': ['4322B'], 'climatisation': ['4322B'],
  'electricien': ['4321A'], 'electriciens': ['4321A'], 'electricienne': ['4321A'], 'electricite': ['4321A'],
  'btp': ['F'], 'batiment': ['F'], 'construction': ['F'], 'chantier': ['F'],
  'macon': ['4399C'], 'macons': ['4399C'], 'maconnerie': ['4399C'],
  'menuisier': ['4332A'], 'menuisiers': ['4332A'], 'menuiserie': ['4332A'],
  'peintre': ['4334Z'], 'peintres': ['4334Z'], 'peinture': ['4334Z'],
  'couvreur': ['4391B'], 'couvreurs': ['4391B'], 'couverture': ['4391B'], 'toiture': ['4391B'],
  // Commerce
  'pharmacie': ['4773Z'], 'pharmacies': ['4773Z'], 'pharmacien': ['4773Z'], 'pharmaciens': ['4773Z'], 'pharmacienne': ['4773Z'],
  'boucherie': ['4722Z'], 'boucheries': ['4722Z'], 'boucher': ['4722Z'], 'bouchers': ['4722Z'], 'bouchere': ['4722Z'],
  'boulangerie': ['1071C'], 'boulangeries': ['1071C'], 'boulanger': ['1071C'], 'boulangers': ['1071C'], 'boulangere': ['1071C'],
  'supermarche': ['4711D'], 'supermarches': ['4711D'], 'grande distribution': ['4711D', '4711F'], 'hypermarche': ['4711F'],
  'garage': ['4520A'], 'garages': ['4520A'], 'garagiste': ['4520A'], 'garagistes': ['4520A'],
  'carrossier': ['4520A'], 'carrossiers': ['4520A'], 'carrosserie': ['4520A'],
  'imprimerie': ['1812Z'], 'imprimeries': ['1812Z'], 'imprimeur': ['1812Z'], 'imprimeurs': ['1812Z'],
  'pressing': ['9601B'], 'pressings': ['9601B'],
  // Restauration, hôtellerie
  'restaurant': ['5610A'], 'restaurants': ['5610A'], 'restauration': ['5610A', '5610C'],
  'hotel': ['5510Z'], 'hotels': ['5510Z'], 'hotellerie': ['5510Z'],
  'bar': ['5630Z'], 'bars': ['5630Z'], 'cafe': ['5630Z'], 'cafes': ['5630Z'], 'brasserie': ['5630Z'],
  'traiteur': ['5621Z'], 'traiteurs': ['5621Z'],
  // Santé, social
  'creche': ['8891A'], 'creches': ['8891A'], 'petite enfance': ['8891A'],
  'ehpad': ['8710A'], 'maison de retraite': ['8710A'],
  'hopital': ['8610Z'], 'hopitaux': ['8610Z'], 'clinique': ['8610Z'], 'cliniques': ['8610Z'],
  'ambulance': ['8690A'], 'ambulances': ['8690A'], 'ambulancier': ['8690A'], 'ambulanciers': ['8690A'],
  'kine': ['8690E'], 'kines': ['8690E'], 'kinesitherapeute': ['8690E'], 'kinesitherapeutes': ['8690E'],
  'dentiste': ['8623Z'], 'dentistes': ['8623Z'], 'cabinet dentaire': ['8623Z'],
  'veterinaire': ['7500Z'], 'veterinaires': ['7500Z'],
  'aide a domicile': ['8810A'], 'aide menagere': ['8810A'], 'aides a domicile': ['8810A'],
  'ecole': ['8520Z'], 'ecoles': ['8520Z'],
  'auto ecole': ['8553Z'], 'auto ecoles': ['8553Z'],
  // Transport, logistique
  'logistique': ['5210B'], 'entrepot': ['5210B'], 'entrepots': ['5210B'],
  'transporteur': ['4941A', '4941B'], 'transporteurs': ['4941A', '4941B'], 'transport routier': ['4941A', '4941B'],
  'demenagement': ['4942Z'], 'demenageur': ['4942Z'], 'demenageurs': ['4942Z'],
  'taxi': ['4932Z'], 'taxis': ['4932Z'], 'vtc': ['4932Z'],
  'livraison': ['5320Z'], 'livreur': ['5320Z'], 'livreurs': ['5320Z'], 'coursier': ['5320Z'],
  // Services
  'coiffeur': ['9602A'], 'coiffeurs': ['9602A'], 'coiffeuse': ['9602A'], 'coiffeuses': ['9602A'], 'coiffure': ['9602A'],
  'nettoyage': ['8121Z'], 'menage': ['8121Z', '9700Z'],
  'securite': ['8010Z'], 'gardiennage': ['8010Z'], 'agent de securite': ['8010Z'],
  'interim': ['7820Z'], 'travail temporaire': ['7820Z'],
  'centre d appel': ['8220Z'], 'centres d appel': ['8220Z'], 'call center': ['8220Z'],
  'paysagiste': ['8130Z'], 'paysagistes': ['8130Z'], 'espaces verts': ['8130Z'], 'jardinier': ['8130Z'],
  'informatique': ['6202A'], 'developpeur': ['6202A'], 'esn': ['6202A'],
  'agence immobiliere': ['6831Z'], 'immobilier': ['6831Z'], 'agent immobilier': ['6831Z'],
  'syndic': ['6832A'],
  'avocat': ['6910Z'], 'avocats': ['6910Z'], 'cabinet d avocats': ['6910Z'],
  'expert comptable': ['6920Z'], 'experts comptables': ['6920Z'], 'comptable': ['6920Z'], 'comptabilite': ['6920Z'],
  'banque': ['6419Z'], 'banques': ['6419Z'],
  'assurance': ['6512Z'], 'assurances': ['6512Z'], 'assureur': ['6512Z'],
  // Loisirs
  'salle de sport': ['9313Z'], 'salles de sport': ['9313Z'], 'fitness': ['9313Z'],
  'cinema': ['5914Z'], 'cinemas': ['5914Z'],
  // Agriculture
  'agriculture': ['0111Z', '0150Z'], 'agriculteur': ['0111Z', '0150Z'], 'agriculteurs': ['0111Z', '0150Z'],
  'viticulture': ['0121Z'], 'viticulteur': ['0121Z'], 'viticulteurs': ['0121Z'], 'vigneron': ['0121Z'], 'vignerons': ['0121Z']
};

// Les codes visés par une saisie. Une saisie de trois lettres ou plus vaut aussi pour les mots qui
// commencent par elle (« plomb » trouve plombier), sans toucher aux mots plus courts.
export function tradeCodes(query) {
  var q = normalize(query || '').replace(/\s+/g, ' ').trim();
  if (!q) return [];
  var out = [];
  function add(list) { list.forEach(function (c) { if (out.indexOf(c) === -1) out.push(c); }); }
  // Clé propre seulement : « constructor » ou « __proto__ » ne sont pas des métiers.
  if (Object.prototype.hasOwnProperty.call(TRADE_WORDS, q)) add(TRADE_WORDS[q]);
  if (q.length >= 3) {
    Object.keys(TRADE_WORDS).forEach(function (w) {
      if (w !== q && w.indexOf(q) === 0) add(TRADE_WORDS[w]);
    });
  }
  return out;
}

// Place en tête de `matches` les entrées de `index` que la saisie désigne par un mot du quotidien,
// puis garde le reste dans son ordre, sans doublon. `accept(entry)` limite les niveaux admis.
export function putTradeFirst(matches, index, query, accept) {
  var codes = tradeCodes(query);
  if (!codes.length) return matches;
  var first = [];
  codes.forEach(function (c) {
    index.forEach(function (e) {
      if (e.code === c && (!accept || accept(e)) && first.indexOf(e) === -1) first.push(e);
    });
  });
  if (!first.length) return matches;
  return first.concat(matches.filter(function (e) { return first.indexOf(e) === -1; }));
}
