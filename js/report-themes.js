// ── Le rapport : les thèmes ──
// Un thème par sujet du parcours (déclaration, questionnaires, arrêts, IJ), avec son statut, sa règle, ses actions.

import { CAUSE_LABELS } from './report-constants.js?v=e9f97a8';
import { frNum, fmt1 } from './utils.js?v=e9f97a8';
import { whenLabel } from './report-base.js?v=e9f97a8';
import { RESOURCES } from './report-offers.js?v=e9f97a8';

// ── Les thèmes, chacun renvoie null quand il ne vous concerne pas ──
export function buildThemes(v, d, now) {
  var list = [];
  function act(text, owner, when, quick, offer) { return { text: text, owner: owner, when: when, quick: !!quick, offer: offer || null, whenLabel: whenLabel(when, now) }; }

  // 1. Chaque accident, jusqu'à la décision de prise en charge
  if (d.accidents > 0) {
    list.push({ id: 'refus', title: 'Chaque accident, jusqu\'à la décision de prise en charge', short: 'Déclarations et réserves', forWho: 'RH et paie',
      status: v.reserves === 'oui' ? 'ok' : 'todo',
      verdict: v.reserves === 'oui' ? 'Des réserves sont motivées quand les circonstances le justifient.'
        : v.reserves === 'non' ? 'L\'employeur déclare dans les 48 heures et peut formuler des réserves sur les circonstances dans les 10 jours. Savoir si vous en formulez est un point à connaître.'
        : v.reserves === 'nsp' ? 'L\'employeur déclare dans les 48 heures et peut formuler des réserves sur les circonstances dans les 10 jours. Savoir si elles sont formulées chez vous est un point à connaître.'
        : 'Chaque accident se joue au moment de sa déclaration.',
      actions: [act('Écrire la procédure de déclaration, en précisant qui recueille les faits, qui déclare et qui remplace en cas d\'absence', 'RH', 'm1', true, 'terrain'),
        act('Écrire la procédure de déclaration\u00A0: qui recueille les faits, qui déclare, dans quel délai', 'RH, avec le manager concerné', 'now', true, 'dat')],
      // À partir de 20 salariés, le taux prend la place de la remontée terrain, déjà proposée par la
      // prévention, pour que la page tienne en A4.
      offers: d.effectif >= 20 ? ['dat', 'taux'] : ['terrain', 'dat'],
      objection: ['«\u00A0Émettre des réserves, c\'est suspecter nos salariés.\u00A0»', 'Une réserve porte sur les circonstances, jamais sur la personne. Elle ne se justifie que lorsque les faits le demandent.'],
      resource: RESOURCES.refus[0] });
  }

  // 2. La prévention
  // Le document unique et les presqu'accidents se lisent dans les données du secteur, jamais dans
  // une réponse : chaque grande cause est un risque à y inscrire.
  var topCause = Object.keys((d.entry || {}).risk_causes || {}).filter(function(k) { return k !== 'Autres risques'; })
    .map(function(k) { return { label: CAUSE_LABELS[k] || k, value: d.entry.risk_causes[k] }; })
    .sort(function(a, b) { return b.value - a.value; })[0];
  if (topCause && !(topCause.value > 0)) topCause = null;
  var prevStatus = topCause ? 'todo' : 'watch';
  var prevActs = [act('Mettre en place un signalement simple des presqu\'accidents et des situations dangereuses, depuis le terrain', 'HSE, avec les managers', 'm1', true, 'terrain'),
    act('Confronter les causes et les lésions de votre secteur à votre document unique, et dater la mise à jour', 'HSE, avec la direction', 'm1', true, 'duerp')];
  list.push({ id: 'prevention', title: 'La prévention, avant l\'accident', short: 'Prévention et DUERP', forWho: 'HSE et RH',
    status: prevStatus,
    verdict: topCause ? '«\u00A0' + topCause.label + '\u00A0» cause ' + Math.round(topCause.value) + ' % des accidents de votre secteur, le premier risque à inscrire dans votre document unique.'
      : 'Les causes des accidents de votre secteur sont la matière de votre document unique.',
    actions: prevActs,
    offers: ['terrain', 'duerp'],
    objection: ['«\u00A0La prévention coûte plus qu\'elle ne rapporte.\u00A0»',
      'Chaque accident évité épargne des jours d\'arrêt, un remplacement et une désorganisation, et plus l\'arrêt aurait été long, plus l\'économie est grande.'],
    resource: RESOURCES.prevention[0] });

  // 3. Les maladies professionnelles
  if (v.mp > 0 || (d.mp && d.mp.sec > d.mp.nat)) {
    list.push({ id: 'mp', title: 'Les maladies professionnelles', short: 'Maladies professionnelles', forWho: 'RH et HSE',
      status: v.mp > 0 ? 'todo' : 'watch',
      verdict: v.mp > 0 ? 'Vous avez eu ' + frNum(v.mp) + ' maladie' + (v.mp > 1 ? 's professionnelles reconnues' : ' professionnelle reconnue') + ' sur l\'année.'
        : 'Votre secteur compte plus de maladies professionnelles que la moyenne nationale.',
      actions: [act('Désigner qui répond aux questionnaires de la caisse, et tenir à jour les expositions par poste', 'RH, avec HSE', 'm1', true, 'mp')],
      offers: ['mp'],
      objection: ['«\u00A0Nos RH connaissent les postes et peuvent répondre seuls.\u00A0»', 'Parfois. La difficulté tient aux expositions anciennes et aux archives incomplètes, et au délai de 30 jours qui laisse peu de temps pour les reconstituer.'],
      resource: RESOURCES.mp[0] });
  }

  // 4. Les arrêts et les indemnités journalières
  if (d.accidents > 0) {
    // La durée des arrêts n'est pas publiée par secteur : les arrêts de plus de 45 jours se lisent
    // sur les seuls chiffres de l'entreprise, dans l'action qui les suit, sans moyenne sectorielle.
    var longAction = v.arrets45 > 0
      ? 'Suivre ' + (v.arrets45 > 1 ? 'vos ' + frNum(v.arrets45) + ' arrêts' : 'votre arrêt') + ' de plus de 45 jours, avec un référent pour ' + (v.arrets45 > 1 ? 'chacun' : 'lui')
      : 'Recenser les arrêts de plus de 45 jours en cours et désigner un référent pour chacun';
    var arretsOffers = ['collecte'];
    if (v.suivi45 === 'non' || v.arrets45 > 0) arretsOffers.push('arrets');
    arretsOffers.push(v.ijRecup === 'oui' ? 'ijss' : 'ij');
    list.push({ id: 'arrets', title: 'Les arrêts et les indemnités journalières', short: 'Arrêts et IJSS', forWho: 'RH et paie',
      status: (v.ijRecup === 'non' || v.ijRecup === 'nsp' || v.suivi45 === 'non' || (d.days && d.days.ratio > 1.05)) ? 'todo' : v.ijRecup === 'oui' ? 'ok' : 'watch',
      verdict: d.days ? 'Vos arrêts durent en moyenne ' + fmt1(d.days.co) + ' jours par accident, contre ' + fmt1(d.days.sec) + ' dans votre secteur.'
        : v.ijRecup === 'oui' ? 'Vous rapprochez déjà les IJ avancées et remboursées.' : 'Le rapprochement des IJ avancées et remboursées n\'est pas en place, ou pas vérifié.',
      actions: [act('Centraliser les arrêts et leurs justificatifs, et contrôler qu\'ils sont complets avant la paie', 'Paie', 'm1', true, 'collecte'),
        act(longAction, 'RH', 'm1', true, 'arrets'),
        // Sans subrogation, la caisse paie le salarié et l'employeur n'a rien à rapprocher.
        act('Si vous pratiquez la subrogation, rapprocher chaque mois les IJ attendues et les IJ reçues, arrêt par arrêt', 'Paie', 'm1', true, 'ijss'),
        d.days && d.days.ratio > 1.05 ? act('Rapprocher les IJ attendues et reçues sur les arrêts de l\'année', 'Paie', 'm6', false, 'ij') : null].filter(Boolean),
      offers: arretsOffers,
      objection: ['«\u00A0Notre paie s\'en charge.\u00A0»', 'La paie calcule ce qui est dû. Elle ne vérifie pas que la caisse l\'a versé, ni qu\'un arrêt long reste cohérent avec son motif.'],
      // Le podcast des arrêts longs quand l'entreprise en a, ou ne les suit pas, sinon la subrogation.
      resource: arretsOffers.indexOf('arrets') >= 0 ? RESOURCES.arretsPodcast : RESOURCES.arrets[1] });
  }

  // L'ordre du parcours Ayming : la prévention d'abord, les arrêts en dernier.
  var ORDER = ['prevention', 'refus', 'mp', 'arrets'];
  return list.sort(function(a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
}

// ── Les chapitres : les données, ce qu'elles veulent dire pour vous, ce que vous pouvez faire ──
// Chaque chapitre reprend une bande des vues sectorielles de l'app, appliquée à l'entreprise :
// son chiffre prend la place de la référence nationale quand elle l'a, l'analyse du secteur reste
// entière quand elle ne l'a pas. Puis deux ou trois phrases qui lisent ces données avec les
// chiffres et les réponses de l'entreprise, puis ce qu'elle peut faire, avec l'aide d'Ayming là
// où la donnée la justifie (lien sur le mot, ressource quand la place le permet).
