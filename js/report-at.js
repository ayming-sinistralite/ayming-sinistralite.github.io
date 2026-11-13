// ── Le rapport : la partie accidents du travail ──
// Position, gravité, mécanismes, victimes, arrêts, trajet et dix ans d'historique.

import { fmt1, esc, frNum, fmt2 } from './utils.js?v=e9f97a8';
import { getData } from './data.js?v=e9f97a8';
import { isWorse } from './findings.js?v=e9f97a8';
import { CAUSE_LABELS } from './report-constants.js?v=e9f97a8';
import { ficheShares, ficheDays, siegeDays } from './history.js?v=e9f97a8';
import { keyedBars, DIMENSION_LABELS, nationalDemographics, demoShares, SEX_GROUPS, AGE_GROUPS, API_LABELS } from './charts.js?v=e9f97a8';
import { siegeFigure, daysFigure } from './body.js?v=e9f97a8';
import { ASSISTANT_ECARTS } from './assistant-content.js?v=e9f97a8';
import { resolveEntry } from './compare.js?v=e9f97a8';
import { rankOf, positionStrip, vsHero, lowerFirst, cols, fig, twoLines, meaning, noteGap, kw, guideOf, heroFigs, causeRows, nationalCauses, nationalExtra, shareFig, punch, sizeBlock, daysFig, noteCount, trimNotes } from './report-figs.js?v=e9f97a8';
import { gap, pct, TIERS_CAUSES } from './report-offers.js?v=e9f97a8';
import { CAUSE_LEVERS, plural } from './report-base.js?v=e9f97a8';
import { decadePage, nationalTrajetCauses, decadeFigs } from './report-decade.js?v=e9f97a8';

// « 1er », puis « 2e », « 3e »…
function ordSup(n) { return '<sup>' + (n === 1 ? 'er' : 'e') + '</sup>'; }

export function atPosition(v, d) {
  var rows = [['Votre entreprise', d.at.co], ['Votre secteur', d.at.sec], d.at.peer != null ? ['Établissements de votre taille', d.at.peer] : null, ['Moyenne nationale', d.at.nat]].filter(Boolean);
  var sec = rankOf('at', d.at.sec), co = rankOf('at', d.at.co);
  var strip = positionStrip(d);
  var peer = d.at.peer > 0 ? d.at.co / d.at.peer : null;
  var hero = vsHero(fmt1(d.at.co), 'accidents avec arrêt pour 1 000 salariés, votre entreprise', fmt1(d.at.sec), 'la même mesure pour votre secteur, ' + esc(lowerFirst(d.sectorLib)), d.at.ratio);
  var html = cols(fig(rows.length + ' repères', 'Accidents avec arrêt pour 1 000 salariés.',
        { type: 'hbar', aria: 'Votre indice de fréquence face au secteur', labels: rows.map(function(r) { return twoLines(r[0]); }), values: rows.map(function(r) { return r[1]; }), you: 0, fmt: '1' }, rows.length),
      meaning([
        'Votre secteur se classe au <strong>' + sec.rank + ordSup(sec.rank) + ' rang</strong> des ' + sec.of + ' activités, de la plus exposée à la moins exposée. À votre fréquence, votre entreprise se placerait au ' + co.rank + ordSup(co.rank) + '.',
        peer == null || d.at.ratio <= 1.05 ? null : peer > 1.05 ? 'Vous êtes aussi ' + gap(peer).replace(/de$/, 'des') + ' établissements de votre taille, la taille de votre établissement n\'explique donc pas l\'écart.'
          : 'Face aux établissements de votre taille, votre fréquence est ' + gap(peer) + ' la leur, la taille explique donc une part de l\'écart.'
      ])) +
    strip;
  return [{ id: 'position', title: 'Votre position|face à votre métier', html: html, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Votre position face à votre métier', fill: ['guide-arrets', 'webinaire-prevention'] }];
}

// La gravité : le tableau de bord du secteur, votre entreprise en face, puis ce qu'un accident
// pèse. Le chapitre de la déclaration, là où chaque dossier se construit.
// La cascade de gravité de l'outil, en pyramide : les décès en haut, les accidents avec arrêt à la
// base, et entre deux marches la part des sinistres qui passe à la marche du dessus.
function cascadeFig(s) {
  var steps = [['Décès', s.deces, 'is-dc', 'un décès'], ['Incapacités permanentes', s.nouvelles_ip, 'is-ip', 'une incapacité permanente'],
    ['Arrêts de 4 jours et plus', s.at_4j_arret, 'is-4j', 'un arrêt de 4 jours et plus'], ['Accidents avec arrêt', s.at_1er_reglement, 'is-all']].filter(function(x) { return x[1] != null; });
  if (steps.length < 3 || !(s.at_1er_reglement > 0)) return '';
  var n = steps.length;
  var html = steps.map(function(x, i) {
    var below = steps[i + 1];
    return '<div class="rp-cascade-bar ' + x[2] + '" style="width:' + Math.round((i + 1) / n * 100) + '%"><span>' + x[0] + '</span><strong>' + frNum(x[1]) + '</strong></div>' +
      (below ? '<p class="rp-cascade-rate">' + (below[1] > 0 && x[1] <= below[1] ? fmt1(x[1] / below[1] * 100) + ' % donnent lieu à ' + x[3] : frNum(x[1]) + ' ' + lowerFirst(x[0]) + ' pour ' + frNum(below[1]) + ' ' + lowerFirst(below[0])) + '</p>' : '');
  }).join('');
  return '<div class="rp-figure"><p class="rp-find">Cascade de gravité dans votre secteur</p><div class="rp-cascade">' + html + '</div></div>';
}

export function atGravite(v, d, T) {
  var s = d.stats, n = getData('at').meta.national;
  var perCase = function(x) { return x.at_1er_reglement ? x.journees_it / x.at_1er_reglement : null; };
  var ipRate = function(x) { return x.at_1er_reglement ? x.nouvelles_ip / x.at_1er_reglement * 100 : null; };
  var dcRate = function(x) { return x.at_1er_reglement ? x.deces / x.at_1er_reglement * 10000 : null; };
  var row = function(label, def, co, sec, nat, fmt) {
    var bad = isWorse(sec, nat);
    return '<tr><td><strong>' + label + '</strong><span class="rp-def">' + def + '</span></td><td>' + (co == null ? '<span class="rp-na">—</span>' : fmt(co)) + '</td><td' + (bad ? ' class="is-worse"' : '') + '>' + fmt(sec) + '</td><td>' + fmt(nat) + '</td></tr>';
  };
  var table = '<div class="rp-figure"><p class="rp-find">Vos indicateurs face à votre secteur</p><table class="rp-kpis rp-kpis-n"><thead><tr><th>Indicateur</th><th>Vous</th><th>Secteur</th><th>National</th></tr></thead><tbody>' +
    row('Indice de fréquence', 'Accidents pour 1 000 salariés', d.at.co, s.indice_frequence, n.indice_frequence, fmt1) +
    row('Journées d\'arrêt par accident', 'Durée moyenne de l\'incapacité temporaire', d.days ? d.days.co : null, perCase(s), perCase(n), fmt1) +
    row('Taux de gravité', 'Journées perdues pour 1 000 heures travaillées', null, s.taux_gravite, n.taux_gravite, fmt2) +
    row('Incapacités permanentes', 'Pour 100 accidents, des séquelles définitives', null, ipRate(s), ipRate(n), fmt1) +
    row('Décès', 'Pour 10 000 accidents', null, dcRate(s), dcRate(n), fmt1) +
    '</tbody></table></div>';
  if (isWorse(ipRate(s), ipRate(n))) noteGap('Les incapacités permanentes', ipRate(s) / ipRate(n), { label: 'Pour 100 accidents', a: ipRate(s), b: ipRate(n), unit: '' });
  var every = d.accidents > 0 ? Math.max(1, Math.round(220 / d.accidents)) : null;
  var html = '<div class="rp-grid-casc">' + cascadeFig(s) + meaning([
      'C\'est à la ' + kw('dat', 'déclaration') + ' que le dossier se construit. L\'employeur déclare dans les 48 heures et peut motiver des réserves sur les circonstances. ' +
        (v.reserves === 'oui' ? 'Vous indiquez en motiver quand les faits le justifient.' : v.reserves === 'non' ? 'Sans réserves, le dossier est instruit sur la déclaration seule.' : v.reserves === 'nsp' ? 'Savoir si des réserves sont émises chez vous est un premier point simple à vérifier.' : '')
    ]) + '</div>' + table + guideOf(T.refus, d);
  var hero = heroFigs([
    every ? (every > 1 ? [every + ' jours', 'ouvrés en moyenne entre deux accidents chez vous'] : [Math.round(d.accidents / 220) + ' par jour', (d.accidents >= 330 ? 'accidents' : 'accident') + ' chez vous en moyenne, chaque jour ouvré']) : null
  ]);
  return [{ id: 'refus', title: 'Chaque accident,|de sa gravité à sa déclaration', html: html, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Chaque accident, de sa gravité à sa déclaration' }];
}

// Les causes que l'entreprise a nommées, chacune avec sa part dans les accidents du secteur, et la
// première cause du secteur. Absent quand l'entreprise n'en a nommé aucune (v.causes, des clés de
// risk_causes, « Autres risques » comprise). Les libellés sont ceux du rapport (CAUSE_LABELS).
function causesNamed(v, d) {
  var rc = (d.entry || {}).risk_causes || {};
  var picked = (v.causes || []).filter(function(k) { return k !== 'Autres risques' && rc[k] != null; });
  if (!picked.length) return '';
  var first = Object.keys(rc).filter(function(k) { return k !== 'Autres risques'; }).sort(function(a, b) { return rc[b] - rc[a]; })[0];
  var firstLabel = first && rc[first] > 0 ? CAUSE_LABELS[first] || first : null;
  // Une phrase, pas un tableau : le graphique juste dessous donne déjà la part de chaque cause.
  var named = picked.map(function(k) {
    return '<strong>' + esc(CAUSE_LABELS[k] || k) + '</strong>' + (rc[k] > 0 ? ' (' + fmt1(rc[k]) + ' % dans votre secteur)' : '');
  });
  var list = named.length > 1 ? named.slice(0, -1).join(', ') + ' et ' + named[named.length - 1] : named[0];
  var inFirst = first && picked.indexOf(first) >= 0;
  var line = !firstLabel ? '' : inFirst
    ? ' La première, «\u00A0' + esc(firstLabel) + '\u00A0», est aussi celle de votre secteur.'
    : ' La première cause de votre secteur, «\u00A0' + esc(firstLabel) + '\u00A0», n\'en fait pas partie.';
  return '<p class="rp-p rp-note-line">Vous citez ' + list + '.' + line + '</p>';
}

// Comment l'accident survient : les causes, ce qui a dérapé, l'agent matériel, et une piste de
// prévention par grande cause. Puis la silhouette, ce que faisait la victime et comment elle
// s'est blessée. Chaque grande cause devient une piste à inscrire au document unique.
export function atMecanismes(v, d, T) {
  var causes = causeRows(d.entry, nationalCauses('at', 'at_1er_reglement'));
  var fa = d.src && d.src.ficheAt;
  var dev = fa ? ficheShares('at', 'deviation')(fa).slice(0, 4) : [];
  var agent = fa ? ficheShares('at', 'agent_materiel_de_la_deviation')(fa).slice(0, 4) : [];
  var dims = Object.assign({ nat: nationalExtra() }, d.extra || {});
  var activite = keyedBars('activite_physique', DIMENSION_LABELS.activite)(dims).slice(0, 4);
  var modalite = keyedBars('modalite_blessure', DIMENSION_LABELS.modalite)(dims).slice(0, 4);
  var body = siegeFigure((d.extra || {}).siege_lesions, 'Siège des lésions dans votre secteur');
  var top = causes.filter(function(c) { return c.pct >= 10 && CAUSE_LEVERS[c.key]; }).slice(0, 3);
  var tiersCause = top.filter(function(c) { return TIERS_CAUSES.indexOf(c.key) >= 0; })[0];
  var named = causesNamed(v, d);
  // Trois graphiques en pleine largeur, une seule légende sous le dernier. La phrase sur les causes
  // citées prend la place d'une barre par graphique, pour que la page tienne en A4.
  var n = named ? 1 : 0;
  var page1 = named +
    shareFig(causes.slice(0, 5 - n), 'Les causes des accidents du secteur, en\u00A0% de ceux dont la cause est connue', null, { noLegend: true }) +
    shareFig(dev.slice(0, 4 - n), 'Ce qui a dérapé', null, { wide: true, noLegend: true }) + shareFig(agent.slice(0, 4 - n), 'L\'agent matériel en cause', null, { wide: true }) +
    (top.length ? '<h3 class="rp-h3">Ce que cela veut dire pour vous</h3><div class="rp-levers">' + top.map(function(c) {
      // Le renvoi aux accidents causés par un tiers, sous la première cause où un tiers est en jeu.
      var tiers = c === tiersCause ? ' Si un tiers est responsable, ' + kw('tiers', 'une part des coûts peut se récupérer à l\'amiable') + '.' : '';
      return '<div><strong>' + c.label + ', ' + Math.round(c.pct) + ' %</strong><p>' + CAUSE_LEVERS[c.key] + tiers + '</p></div>';
    }).join('') + '</div>' + punch('Les protections collectives passent avant les équipements individuels. Chaque piste retenue s\'inscrit dans votre ' + kw('duerp', 'document unique') + ', daté et suivi.') : '');
  var page2 = (body ? cols('<div class="rp-fig"><p class="rp-find">Où se situe la lésion</p><p class="rp-why">Part des accidents du secteur, par partie du corps.</p>' + body + '</div>',
        shareFig(activite, 'Ce que faisait la victime') + shareFig(modalite, 'Comment la blessure est survenue'))
      : cols(shareFig(activite, 'Ce que faisait la victime'), shareFig(modalite, 'Comment la blessure est survenue')));
  page2 += meaning([
    'Les presqu\'accidents annoncent ces accidents avant qu\'ils n\'arrivent, et les recenser par cause permet d\'agir avant eux.',
    'Ces causes et ces lésions sont la matière de votre document unique' + (d.effectif >= 11 ? ', à mettre à jour chaque année à partir de 11 salariés' : '') + (d.effectif >= 50 ? ', avec son programme annuel de prévention à partir de 50' : '') + '.'
  ]);
  page2 += guideOf(T.prevention, d);
  return [
    { id: 'prevention', title: 'Comment|l\'accident survient', html: page1, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Comment l\'accident survient' },
    { id: 'at-lesions', title: 'Les lésions|et les gestes en cause', html: page2, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Les lésions et les gestes en cause', fill: ['webinaire-prevention', 'article-declaration', 'barometre-absenteisme', 'guide-arrets'] }
  ];
}

// Qui est touché : trois repères en tête, le sexe et l'âge des victimes, et la fréquence par taille
// d'établissement, la tranche de l'entreprise mise en avant.
export function atPopulation(v, d) {
  var demo = (d.entry && d.entry.demographics) || {}, natDemo = nationalDemographics('at') || {};
  var sex = demoShares(demo.sex, natDemo.sex, SEX_GROUPS), age = demoShares(demo.age, natDemo.age, AGE_GROUPS);
  var young = age.filter(function(a) { return /Moins de 20|20 à 24|25 à 29/.test(a.label); }).reduce(function(s, a) { return s + (a.pct || 0); }, 0);
  var youngNat = age.filter(function(a) { return /Moins de 20|20 à 24|25 à 29/.test(a.label); }).reduce(function(s, a) { return s + (a.nat || 0); }, 0);
  var topSex = sex.filter(function(r) { return r.pct != null; }).sort(function(a, b) { return b.pct - a.pct; })[0];
  var hero = heroFigs([
    topSex ? [Math.round(topSex.pct) + ' %', 'des sinistres du secteur touchent des ' + (/homme/i.test(topSex.label) ? 'hommes' : 'femmes') + (topSex.nat != null ? ', contre ' + Math.round(topSex.nat) + ' % au national' : '')] : null,
    young > 0 ? [Math.round(young) + ' %', 'touchent des moins de 30 ans, contre ' + Math.round(youngNat) + ' % au national'] : null
  ]);
  // Le sexe prend la hauteur de l'âge, ses deux barres plus épaisses, comme dans l'outil.
  var ageRows = age.filter(function(r) { return r.pct != null; }).length;
  var size = sizeBlock(d);
  var html = cols(shareFig(sex, 'Selon le sexe de la victime', null, { rows: ageRows, thick: 'fill' }), shareFig(age, 'Selon l\'âge de la victime')) +
    size.html + meaning([size.txt,
      young > 0 ? (isWorse(young, youngNat) ? 'L\'accueil des nouveaux et des jeunes, les premières semaines au poste, mérite une attention particulière.' : 'Les jeunes ne sont pas surreprésentés dans les accidents de votre secteur.') : null]);
  return [{ id: 'at-population', title: 'Qui est|touché dans votre secteur', html: html, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Qui est touché' }];
}

// Les arrêts : vos jours par accident face au secteur, les jours par sinistre selon la lésion et
// l'agent matériel, puis les arrêts longs et les indemnités à suivre.
export function atArrets(v, d, T) {
  var fa = d.src && d.src.ficheAt;
  var nature = fa ? ficheDays('at', 'nature_des_lesions')(fa).slice(0, 5) : [];
  var ages = fa ? ficheDays('at', 'age_de_la_victime', true)(fa) : [];
  var agent = fa ? ficheDays('at', 'agent_materiel_de_la_deviation')(fa).slice(0, 5) : [];
  var s = d.stats, secDays = s.at_1er_reglement ? s.journees_it / s.at_1er_reglement : null;
  var natStats = getData('at').meta.national, natDays = natStats.at_1er_reglement ? natStats.journees_it / natStats.at_1er_reglement : null;
  var ijNote = v.ijRecup === 'oui' ? 'Vous indiquez rapprocher déjà les IJ avancées et remboursées.' : v.ijRecup ? 'Le rapprochement des IJ avancées et remboursées n\'est pas en place, ou pas vérifié.' : null;
  // Les âges se lisent en une phrase : la tranche qui s'arrête le plus longtemps.
  var oldest = ages.filter(function(r) { return r.value > 0 && r.nat; }).sort(function(a, b) { return b.value - a.value; })[0];
  var hero = d.days && secDays ? vsHero(fmt1(d.days.co), 'jours d\'arrêt par accident, votre entreprise', fmt1(secDays), 'dans votre secteur' + (natDays ? ', ' + fmt1(natDays) + ' en France entière' : ''), d.days.co / secDays) : '';
  // Le siège des lésions en jours sur la silhouette et les âges, les deux autres dimensions des
  // arrêts que l'outil dessine.
  var siege = fa ? siegeDays('at')(fa) : [], sDays = {}, sWorse = {};
  siege.forEach(function(r) { sDays[r.key] = r.value; if (isWorse(r.value, r.nat)) sWorse[r.key] = true; });
  var siegeFig = siege.length >= 2 ? '<div class="rp-fig"><p class="rp-find">Selon le siège des lésions</p><p class="rp-why">Journées d\'arrêt par sinistre, en rouge au-dessus du national.</p>' + daysFigure(sDays, 'Journées d\'arrêt par siège des lésions', sWorse) + '</div>' : '';
  var page1 = cols(daysFig(nature, 'Selon la nature des lésions'), daysFig(agent, 'Selon l\'agent matériel')) +
    cols(siegeFig, daysFig(ages, 'Selon l\'âge de la victime')) +
    (oldest ? '<p class="rp-p rp-note-line">Dans votre secteur, un salarié accidenté ' + (/^de /.test(oldest.label.toLowerCase()) ? '' : 'de ') + esc(oldest.label.toLowerCase()) + ' s\'arrête ' + frNum(oldest.value) + ' jours, contre ' + frNum(oldest.nat) + ' au national.</p>' : '');
  var facts = [
    '<div><strong>' + frNum(v.joursArret != null ? v.joursArret : d.accidents) + '</strong><p>' +
      (v.joursArret != null ? 'jours d\'arrêt sur l\'année, autant de jours d\'' : (d.accidents > 1 ? 'accidents avec arrêt, chacun ouvre des jours d\'' : 'accident avec arrêt, qui ouvre des jours d\'')) +
      kw(v.ijRecup === 'oui' ? 'ijss' : 'ij', 'indemnités journalières') + ' à rapprocher de ce que la caisse verse.' + (ijNote ? ' ' + ijNote : '') + '</p></div>',
    v.arrets45 > 0 ? '<div class="is-worse"><strong>' + frNum(v.arrets45) + '</strong><p>' + (v.arrets45 > 1 ? 'de vos accidents ont' : 'de vos accidents a') + ' dépassé 45 jours d\'arrêt, le seuil des arrêts longs. Un ' + kw('arrets', 'suivi des arrêts longs') + ' et une reprise préparée sont les premiers leviers à regarder.</p></div>'
      : v.suivi45 === 'non' ? '<div><p>Les arrêts de plus de 45 jours ne sont pas suivis chez vous. C\'est le seuil des arrêts longs.</p></div>' : ''
  ];
  var page2 = '<div class="rp-facts">' + facts.join('') + '</div>' +
    guideOf(T.arrets, d, ASSISTANT_ECARTS.followups['collecte-arrets'].text[0]);
  return [
    { id: 'arrets', title: 'Combien de jours|coûte chaque accident', html: page1, hero: hero, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Combien de jours coûte chaque accident' },
    { id: 'arrets-2', title: 'Les arrêts|et les indemnités journalières', html: page2, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Les arrêts et les indemnités journalières' }
  ];
}

export function atDixAns(v, d) {
  var out = [], dec = decadePage(d.src && d.src.histAt, d, false);
  if (dec) out.push(dec);
  // Le trajet, sa page à la fin de la partie : il pèse sur les absences et les IJ.
  var tr = getData('trajet'), te = resolveEntry(d.sector, 'trajet');
  var ts = te && te.entry.stats, tn = tr && tr.meta.national;
  if (ts && tn && ts.trajet_count > 0 && ts.indice_frequence != null) {
    var year = tr.meta.years[tr.meta.years.length - 1];
    var days = ts.journees_it / ts.trajet_count, natDays = tn.trajet_count ? tn.journees_it / tn.trajet_count : null;
    // Les causes et le véhicule en cause, comme la vue Trajet de l'outil, en parts déjà publiées.
    var trRows = function(sub) {
      var nat = nationalTrajetCauses(sub), rc = (te.entry.trajet_causes || {})[sub] || {};
      return Object.keys(rc).filter(function(k) { return rc[k] > 0 && !/^Autres/.test(k); })
        .map(function(k) { return { label: API_LABELS[k] || k, pct: Math.round(rc[k] * 1000) / 10, nat: nat[k] }; })
        .sort(function(a, b) { return b.pct - a.pct; }).slice(0, 4);
    };
    // Le trajet ne rejoint pas « L'essentiel », qui ne porte que les accidents du travail et les maladies.
    var n0 = noteCount();
    var causesTr = shareFig(trRows('causes'), 'Ce qui cause les accidents de trajet du secteur');
    var vehTr = shareFig(trRows('vehicules'), 'Le véhicule, quand le conducteur en perd le contrôle');
    trimNotes(n0);
    var hTr = d.src && d.src.histTrajet, decTr = hTr && hTr.h['if'] ? decadeFigs(hTr, d.sector).figs.slice(0, 2) : [];
    var heroTr = heroFigs([[fmt1(ts.indice_frequence), 'accidents de trajet pour 1 000 salariés dans le secteur, ' + fmt1(tn.indice_frequence) + ' en France entière'],
      natDays ? [frNum(days) + ' j', 'd\'arrêt par accident de trajet dans le secteur, ' + frNum(natDays) + ' en France'] : null]);
    var trajetHtml = cols(causesTr, vehTr) + (decTr.length ? cols(decTr[0], decTr[1]) : '') + meaning([
      'Entre le domicile et le travail, votre secteur compte ' + plural(ts.trajet_count, 'accident de trajet', 'accidents de trajet') + ' en ' + year + ', ' + fmt1(ts.indice_frequence) + ' pour 1 000 salariés contre ' + fmt1(tn.indice_frequence) + ' en France entière.',
      natDays ? 'Ils pèsent en revanche sur vos absences, ' + frNum(days) + ' jours d\'arrêt par accident de trajet dans votre secteur contre ' + frNum(natDays) + ' au national, autant de jours d\'' + kw('ij', 'indemnités journalières') + ' à suivre.' : null
    ]);
    out.push({ id: 'at-trajet', title: 'Les accidents|de trajet', html: trajetHtml, hero: heroTr, kicker: 'Partie 1, accidents du travail', part: 'at', toc: 'Les accidents de trajet' });
  }
  return out;
}
