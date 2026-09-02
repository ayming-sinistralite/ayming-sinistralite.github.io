// ── Modèle de coût social AT/MP ──
// Estime le coût social des accidents du travail et des maladies professionnelles
// à partir du barème officiel des « coûts moyens » de la branche AT/MP
// (par CTN et catégorie de gravité).
// Source : Arrêté du 27 décembre 2023 (tarification 2024). Le barème est indexé
// par CTN (et non par code NAF) ; on rattache donc chaque NAF à son CTN.
// NB : approximation NAF2 → CTN (l'imputation officielle se fait au numéro de risque).
//
// Règles de calcul, article D242-6-6 du code de la sécurité sociale.
//  - La valeur du risque additionne les AT ET les MP, un même barème sert aux deux.
//  - Un sinistre porte un coût moyen d'incapacité temporaire, et EN PLUS un coût moyen
//    d'incapacité permanente s'il a donné lieu à une IP notifiée ou à un décès.
//  - Les accidents de trajet n'entrent pas dans la valeur du risque, la majoration M1
//    les couvre forfaitairement.

export var BAREME_YEAR = 2024;
export var BAREME_SOURCE = 'Barème des coûts moyens AT/MP 2024 (arrêté du 27 décembre 2023).';

export var CTN_LABELS = {
  A: 'Métallurgie',
  B: 'Bâtiment et travaux publics',
  C: 'Transports, eau, gaz, électricité, communication',
  D: 'Services, commerces et industries de l\'alimentation',
  E: 'Industries de la chimie, du caoutchouc, de la plasturgie',
  F: 'Bois, ameublement, papier-carton, textile, cuirs et peaux, pierres et terres à feu',
  G: 'Commerce non alimentaire',
  H: 'Activités de services I (banque, assurance, conseil, administration)',
  I: 'Activités de services II et travail temporaire (santé, social, nettoyage, intérim)'
};

// Barème 2024 : coûts moyens (€) par CTN.
// it1..it6 = incapacité temporaire par durée d'arrêt :
//   it1 ≤3 j · it2 4-15 j · it3 16-45 j · it4 46-90 j · it5 91-150 j · it6 >150 j
// ip1..ip4 = incapacité permanente :
//   ip1 <10% · ip2 10-19% · ip3 20-39% · ip4 ≥40% ou décès
var BAREME = {
  A: { it1: 287, it2: 522, it3: 1758, it4: 4770, it5: 8924, it6: 40783, ip1: 2226, ip2: 65734, ip3: 133102, ip4: 676026 },
  // BTP : les IP ≥10% sont fusionnées par sous-activité dans le barème métropole.
  // On retient la variante par tranche (Alsace-Moselle) pour garder un gradient de
  // gravité cohérent avec les autres CTN (estimation v1).
  B: { it1: 288, it2: 488, it3: 1597, it4: 4367, it5: 8210, it6: 38740, ip1: 2317, ip2: 63037, ip3: 119707, ip4: 541156 },
  C: { it1: 225, it2: 540, it3: 1714, it4: 4525, it5: 8555, it6: 35963, ip1: 2248, ip2: 64153, ip3: 123543, ip4: 549962 },
  D: { it1: 305, it2: 440, it3: 1414, it4: 3876, it5: 7222, it6: 32497, ip1: 2253, ip2: 55550, ip3: 108472, ip4: 460652 },
  E: { it1: 386, it2: 556, it3: 1787, it4: 5030, it5: 9369, it6: 40793, ip1: 2239, ip2: 65434, ip3: 137062, ip4: 728203 },
  F: { it1: 375, it2: 506, it3: 1677, it4: 4302, it5: 8143, it6: 36752, ip1: 2256, ip2: 60861, ip3: 117806, ip4: 618356 },
  G: { it1: 230, it2: 481, it3: 1539, it4: 4246, it5: 7817, it6: 35127, ip1: 2224, ip2: 60935, ip3: 125210, ip4: 567087 },
  H: { it1: 169, it2: 411, it3: 1318, it4: 3805, it5: 7281, it6: 37082, ip1: 2160, ip2: 61960, ip3: 131740, ip4: 579607 },
  I: { it1: 161, it2: 376, it3: 1249, it4: 3427, it5: 6408, it6: 29196, ip1: 2206, ip2: 51844, ip3: 102984, ip4: 429443 }
};

// Rattachement NAF → CTN issu du document officiel CNAM « Part de chacun des 9 CTN
// dans le code NAF (année 2019) » (étude 2020-226) : pour chaque NAF, le CTN MAJORITAIRE
// en effectifs salariés, tel que déterminé par l'Assurance Maladie (et non recalculé).
// 6 codes NAF récents absents du doc 2019 retombent sur un calcul 2023 équivalent.
// Chargé depuis data/naf-ctn.json ; { naf5: {code: 'A'..'I'}, naf2: {...} }.
var CTN_MAP = null;
export async function loadCtnMap() {
  try {
    var resp = await fetch('./data/naf-ctn.json');
    if (resp.ok) CTN_MAP = await resp.json();
  } catch (e) { /* on retombe sur l'approximation NAF2 ci-dessous */ }
}

// Approximation NAF2 → CTN (repli si le jeu officiel n'est pas chargé).
var NAF2_CTN = {
  '01': 'D', '02': 'D', '03': 'D',
  '05': 'F', '06': 'E', '07': 'F', '08': 'F', '09': 'F',
  '10': 'D', '11': 'D', '12': 'D',
  '13': 'F', '14': 'F', '15': 'F', '16': 'F', '17': 'F',
  '18': 'C',
  '19': 'E', '20': 'E', '21': 'E', '22': 'E',
  '23': 'F',
  '24': 'A', '25': 'A', '26': 'A', '27': 'A', '28': 'A', '29': 'A', '30': 'A',
  '31': 'F', '32': 'F', '33': 'A',
  '35': 'C', '36': 'C', '37': 'C', '38': 'C', '39': 'C',
  '41': 'B', '42': 'B', '43': 'B',
  '45': 'G', '46': 'G', '47': 'G',
  '49': 'C', '50': 'C', '51': 'C', '52': 'C', '53': 'C',
  '55': 'D', '56': 'D',
  '58': 'C', '59': 'C', '60': 'C',
  '61': 'H', '62': 'H', '63': 'H',
  '64': 'H', '65': 'H', '66': 'H', '68': 'H',
  '69': 'H', '70': 'H', '71': 'H', '72': 'H', '73': 'H', '74': 'H', '75': 'H',
  '77': 'I', '78': 'I', '79': 'I', '80': 'I', '81': 'I', '82': 'I',
  '84': 'H', '85': 'H',
  '86': 'I', '87': 'I', '88': 'I',
  '90': 'I', '91': 'I', '92': 'I', '93': 'I',
  '94': 'I', '95': 'I', '96': 'I', '97': 'I', '98': 'I', '99': 'H'
};
var DEFAULT_CTN = 'G';

export function ctnForNaf(code) {
  code = code || '';
  var naf2 = code.substring(0, 2);
  // 1) jeu officiel : NAF5 exact, sinon majoritaire du NAF2
  if (CTN_MAP) {
    if (code.length >= 5 && CTN_MAP.naf5 && CTN_MAP.naf5[code]) return CTN_MAP.naf5[code];
    if (CTN_MAP.naf2 && CTN_MAP.naf2[naf2]) return CTN_MAP.naf2[naf2];
  }
  // 2) repli : approximation NAF2
  return NAF2_CTN[naf2] || DEFAULT_CTN;
}

// ── Répartition des durées d'arrêt ──
// Un secteur ne se résume pas à sa durée moyenne. Les arrêts sont très étalés :
// 74 % des AT se règlent en moins de 46 jours, mais une queue de 11 % dépasse
// 150 jours et tire la moyenne à 92 jours. Classer TOUS les sinistres dans la
// catégorie de la moyenne surestime donc le coût (de 1,46x sur les AT, 1,57x sur
// les MP). On calcule à la place l'espérance du coût sur la distribution.
//
// Source : Rapport annuel 2023 de l'Assurance Maladie Risques professionnels,
// Figure 50 p. 76. Cohorte des sinistres ayant connu un 1er arrêt en 2019, suivis
// jusqu'en 2023, avec « durée d'arrêt = cumul du nombre d'IJ 2019-2023 du
// sinistre », c'est-à-dire exactement la durée que l'article D242-6-6 CSS classe
// en catégories. Les deux tranches publiées au-delà de 150 jours (150 j à 1 an,
// 1 an et plus) relèvent toutes deux de la catégorie it6, on les additionne.
// Durées moyennes publiées p. 3 du même rapport.
var IT_BOUNDS = [3, 15, 45, 90, 150];
var IT_KEYS = ['it1', 'it2', 'it3', 'it4', 'it5', 'it6'];
var IT_MIN_DAYS = 1;
var IT_DISTRIBUTION = {
  at: { shares: [0.09, 0.39, 0.26, 0.10, 0.05, 0.11], meanDays: 92 },
  mp: { shares: [0.00, 0.03, 0.12, 0.14, 0.11, 0.59], meanDays: 321 }
};

function itEdges(maxDays) { return [IT_MIN_DAYS].concat(IT_BOUNDS, [maxDays]); }

// Moyenne de la distribution, les durées étant supposées log-uniformes à
// l'intérieur de chaque tranche.
function itDistMean(shares, maxDays) {
  var edges = itEdges(maxDays), m = 0;
  for (var i = 0; i < shares.length; i++) {
    var a = edges[i], b = edges[i + 1];
    if (b > a) m += shares[i] * (b - a) / Math.log(b / a);
  }
  return m;
}

// La dernière tranche publiée est ouverte (« 1 an et plus »). On résout sa borne
// haute pour que la moyenne de la distribution reproduise la durée moyenne
// publiée, ce qui évite d'inventer une valeur de queue.
function itSolveMaxDays(shares, meanDays) {
  var lo = IT_BOUNDS[IT_BOUNDS.length - 1] + 1, hi = 200000;
  for (var i = 0; i < 200; i++) {
    var mid = (lo + hi) / 2;
    if (itDistMean(shares, mid) < meanDays) lo = mid; else hi = mid;
  }
  return lo;
}

function itDistFor(kind) {
  var d = IT_DISTRIBUTION[kind] || IT_DISTRIBUTION.at;
  if (d.maxDays == null) d.maxDays = itSolveMaxDays(d.shares, d.meanDays);
  return d;
}

function itCdf(d, x) {
  if (!(x > IT_MIN_DAYS)) return 0;
  if (x >= d.maxDays) return 1;
  var edges = itEdges(d.maxDays), c = 0;
  for (var i = 0; i < d.shares.length; i++) {
    var a = edges[i], b = edges[i + 1];
    if (x >= b) { c += d.shares[i]; continue; }
    return c + d.shares[i] * Math.log(x / a) / Math.log(b / a);
  }
  return c;
}

// Parts par catégorie du barème pour un secteur dont l'arrêt moyen vaut avgDays.
// Hypothèse : la distribution nationale est dilatée du facteur r = avgDays / moyenne
// nationale (les arrêts du secteur durent r fois ceux de la moyenne). À r = 1 elle
// reproduit exactement la publication CNAM, et la moyenne se met bien à l'échelle.
export function itShares(kind, avgDays) {
  var d = itDistFor(kind);
  var r = (avgDays > 0) ? avgDays / d.meanDays : 1;
  var out = [], prev = 0, i;
  for (i = 0; i < IT_BOUNDS.length; i++) {
    var c = itCdf(d, IT_BOUNDS[i] / r);
    out.push(c - prev);
    prev = c;
  }
  out.push(1 - prev);
  return out;
}

// Coût IT espéré par sinistre, moyenne du barème pondérée par la distribution.
function itCostForDays(b, kind, avgDays) {
  var s = itShares(kind, avgDays), cost = 0;
  for (var i = 0; i < IT_KEYS.length; i++) cost += b[IT_KEYS[i]] * s[i];
  return cost;
}

// Valeur du risque d'une famille de sinistres (AT ou MP), article D242-6-6 CSS.
// Deux termes s'ADDITIONNENT, ils ne s'excluent pas :
//   1. tout sinistre reconnu porte un coût moyen d'incapacité temporaire ;
//   2. celui qui donne lieu à une IP notifiée ou à un décès porte EN PLUS un coût moyen d'IP.
// « Un même sinistre peut relever de chacune de ces deux grandes catégories (CCM IT / CCM IP) »
// (notice d'information compte AT/MP, CARSAT).
// profile : { avgDays, ipMinorRate, ipMajorRate, deathRate } rapportés au nombre de sinistres.
function valeurDuRisque(b, count, profile) {
  var vide = { count: 0, ipMinor: 0, ipMajor: 0, deaths: 0, itCost: 0, ipCost: 0, deathCost: 0, direct: 0 };
  if (!(count > 0)) return vide;

  var deaths = count * profile.deathRate;
  var ipMinor = count * profile.ipMinorRate;
  var ipMajor = count * profile.ipMajorRate;

  var itCost = count * itCostForDays(b, profile.kind, profile.avgDays);
  var ipCost = ipMinor * b.ip1 + ipMajor * b.ip2;   // ip2 = borne basse des IP ≥ 10 %, hypothèse prudente
  var deathCost = deaths * b.ip4;

  return {
    count: count, ipMinor: ipMinor, ipMajor: ipMajor, deaths: deaths,
    itCost: itCost, ipCost: ipCost, deathCost: deathCost,
    direct: itCost + ipCost + deathCost
  };
}

// Profil de gravité des AT du secteur. Les fiches ne ventilent pas le taux d'IP côté AT,
// on classe donc toutes les IP en catégorie 1 (< 10 %), hypothèse prudente.
// Faute de données, on retient la durée moyenne nationale, soit un secteur à la
// moyenne, plutôt qu'une valeur arbitraire.
function atProfile(s) {
  var n = s.at_4j_arret || s.at_1er_reglement || 0;
  return {
    kind: 'at',
    avgDays: (n > 0 && s.journees_it) ? (s.journees_it / n) : IT_DISTRIBUTION.at.meanDays,
    ipMinorRate: n > 0 ? (s.nouvelles_ip || 0) / n : 0,
    ipMajorRate: 0,
    deathRate: n > 0 ? (s.deces || 0) / n : 0
  };
}

// Profil de gravité des MP du secteur. Ici les fiches ventilent les IP (< 10 % / ≥ 10 %),
// on exploite donc la ventilation réelle. Les décès sont retirés des IP ≥ 10 % pour
// qu'un même sinistre ne porte pas deux coûts moyens d'IP.
export function mpProfile(s) {
  var n = s.mp_1er_reglement || 0;
  if (!(n > 0)) return null;
  var deces = s.deces || 0;
  return {
    kind: 'mp',
    avgDays: s.journees_it ? (s.journees_it / n) : IT_DISTRIBUTION.mp.meanDays,
    ipMinorRate: (s.ip_taux_inf_10 || 0) / n,
    ipMajorRate: Math.max((s.ip_taux_sup_10 || 0) - deces, 0) / n,
    deathRate: deces / n
  };
}

// Estime le coût social des AT d'une entreprise.
// naf          : code NAF du secteur de l'entreprise (pour le rattachement CTN)
// sectorStats  : stats AT du secteur { at_4j_arret, at_1er_reglement, journees_it, nouvelles_ip, deces }
// company      : { accidents, ip?, deces? }  (ip/deces optionnels → estimés via le secteur)
// indirectMult : multiplicateur des coûts indirects (0 = directs seuls ; 4 = ratio Heinrich)
// Retourne null si le CTN n'a pas de barème.
export function estimateCoutSocial(naf, sectorStats, company, indirectMult) {
  var ctn = ctnForNaf(naf);
  var b = BAREME[ctn];
  if (!b || !company || !(company.accidents > 0)) return null;

  var A = company.accidents;
  var profile = atProfile(sectorStats);
  // Un décès ou une IP saisis par l'entreprise priment sur le profil du secteur.
  if (company.ip != null) { profile.ipMinorRate = company.ip / A; profile.ipMajorRate = 0; }
  if (company.deces != null) profile.deathRate = company.deces / A;

  var v = valeurDuRisque(b, A, profile);
  var mult = indirectMult || 0;

  return {
    ctn: ctn, ctnLabel: CTN_LABELS[ctn], hasBareme: true,
    avgDays: profile.avgDays, ipCount: v.ipMinor + v.ipMajor, deathCount: v.deaths, itCount: v.count,
    itCost: v.itCost, ipCost: v.ipCost, deathCost: v.deathCost,
    direct: v.direct, indirect: v.direct * mult, total: v.direct * (1 + mult)
  };
}

// Valeur du risque des MP d'une entreprise, même barème que les AT (D242-6-6).
export function estimateCoutMp(naf, mpSectorStats, mpCount) {
  var b = BAREME[ctnForNaf(naf)];
  var profile = mpSectorStats ? mpProfile(mpSectorStats) : null;
  if (!b || !profile || !(mpCount > 0)) return null;
  return valeurDuRisque(b, mpCount, profile);
}

// Vrai si le secteur dispose d'un barème de coûts (sinon B/F non encore renseignés).
export function hasBareme(naf) {
  return !!BAREME[ctnForNaf(naf)];
}

// ── Cotisation AT/MP estimée + économie potentielle ──
// Majorations 2024 (arrêté du 27/12/2023) appliquées au taux brut :
// taux net = (taux brut + M1) × (1 + M2) + M3 + M4
//   M1 = majoration trajet (forfait) · M2 = charges générales · M3 = compte spécial · M4 = pénibilité
export var MAJORATIONS = { M1: 0.17, M2: 0.58, M3: 0.16, M4: 0.03, year: 2024 };
// Salaire annuel brut moyen (secteur privé, INSEE 2024) — défaut si masse salariale non saisie.
export var AVG_SALARY = 41252;

function tauxNetFromBrut(tauxBrut) {
  var m = MAJORATIONS;
  return (tauxBrut + m.M1) * (1 + m.M2) + m.M3 + m.M4;
}

// Mode de tarification selon l'effectif de l'entreprise.
export function tarificationMode(effectif) {
  if (effectif >= 150) return 'individuel';
  if (effectif >= 20) return 'mixte';
  return 'collectif';
}

// Estime la cotisation AT/MP annuelle (part liée à la sinistralité) et l'économie
// potentielle si la sinistralité rejoignait la moyenne du secteur.
// La « valeur du risque » (taux brut) = coûts moyens imputés ÷ masse salariale × 100.
// Elle additionne les AT et les MP (D242-6-6, « accidents du travail OU maladies
// professionnelles »). Les accidents de trajet n'y entrent pas, ils sont couverts
// par la majoration forfaitaire M1.
// mpSectorStats et company.mp sont optionnels. Quand l'entreprise ne renseigne pas ses MP,
// on les exclut des deux côtés, de son coût réel comme de la référence sectorielle.
export function estimateCotisation(naf, sectorStats, company, masseSalariale, effectif, mpSectorStats) {
  var ms = (masseSalariale > 0) ? masseSalariale : (effectif > 0 ? effectif * AVG_SALARY : 0);
  if (!ms) return null;
  var est = estimateCoutSocial(naf, sectorStats, company, 0);
  if (!est) return null;

  var mpCount = (company.mp != null && company.mp >= 0) ? company.mp : null;
  var withMp = (mpCount != null && mpSectorStats != null);
  var mpEst = withMp ? estimateCoutMp(naf, mpSectorStats, mpCount) : null;
  var mpCost = mpEst ? mpEst.direct : 0;

  var imputed = est.direct + mpCost;
  var tauxBrut = imputed / ms * 100;
  var tn = tauxNetFromBrut(tauxBrut);
  var cotisation = tn / 100 * ms;

  // Référence : même entreprise mais à la sinistralité moyenne de son secteur,
  // sur le même périmètre de risques que celui saisi par l'entreprise.
  var expectedAcc = (sectorStats.indice_frequence || 0) * effectif / 1000;
  var estRef = estimateCoutSocial(naf, sectorStats, { accidents: expectedAcc }, 0);
  var cotisationRef = null, tnRef = null;
  if (estRef) {
    var refCost = estRef.direct;
    if (withMp) {
      var expectedMp = (mpSectorStats.indice_frequence || 0) * effectif / 1000;
      var mpRef = estimateCoutMp(naf, mpSectorStats, expectedMp);
      if (mpRef) refCost += mpRef.direct;
    }
    tnRef = tauxNetFromBrut(refCost / ms * 100);
    cotisationRef = tnRef / 100 * ms;
  }

  return {
    ctn: est.ctn, ctnLabel: est.ctnLabel,
    masseSalariale: ms, estimatedMs: !(masseSalariale > 0),
    imputedCost: imputed,
    atCost: est.direct, mpCost: mpCost, withMp: withMp,
    tauxNet: tn, cotisation: cotisation,
    tauxNetRef: tnRef, cotisationRef: cotisationRef,
    gap: cotisationRef != null ? cotisation - cotisationRef : null,
    mode: tarificationMode(effectif)
  };
}
