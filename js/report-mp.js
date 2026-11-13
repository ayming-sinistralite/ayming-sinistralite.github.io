// ── Le rapport : la partie maladies professionnelles ──

import { keyedBars, DIMENSION_LABELS, psyYearBars } from './charts.js?v=e9f97a8';
import { ficheDays } from './history.js?v=e9f97a8';
import { fmt1, frNum, esc } from './utils.js?v=e9f97a8';
import { sharesFigure } from './body.js?v=e9f97a8';
import { causeRows, nationalCauses, nationalExtra, vsHero, shareFig, meaning, fig, cols, daysFig, kw, guideOf } from './report-figs.js?v=e9f97a8';
import { gap } from './report-offers.js?v=e9f97a8';
import { mpApiSentences } from './report-base.js?v=e9f97a8';
import { decadePage } from './report-decade.js?v=e9f97a8';

// ── Partie 2, les maladies professionnelles ──
// Présente quand le secteur ou l'entreprise en compte. Par famille, les TMS d'abord, puis les
// maladies reconnues et leur tableau, psychiques et hors tableau, et la durée des arrêts.
export function mpPart(v, d, T) {
  if (!T.mp || !d.mp || !d.mp.entry) return [];
  var entry = d.mp.entry, s = entry.stats || {};
  // Sans maladie reconnue dans le secteur, rien ne situe l'entreprise : pas de partie.
  if (!(s.mp_1er_reglement > 0)) return [];
  var fams = causeRows(entry, nationalCauses('mp', 'mp_1er_reglement'));
  var dims = Object.assign({ nat: nationalExtra() }, d.extra || {});
  var prof = keyedBars('mp_profession', DIMENSION_LABELS.profession)(dims).filter(function(r) { return r.label !== 'Non précisé'; }).slice(0, 5);
  var duree = keyedBars('mp_duree_exposition', DIMENSION_LABELS.duree, true)(dims).filter(function(r) { return r.label !== 'Non précisé'; });
  var diseases = ((d.extra || {}).mp_diseases || []).filter(function(r) { return r.nb > 0; }).slice(0, 5);
  var tms = entry.tms && entry.tms.nb_tms > 0 ? entry.tms : null;
  var fm = d.src && d.src.ficheMp;
  var daysDis = fm ? ficheDays('mp', 'maladie')(fm).slice(0, 5) : [];
  var tmsFam = fams.filter(function(f) { return /^TMS/.test(f.label); })[0];
  var hero = d.mp.co != null && d.mp.sec ? vsHero(fmt1(d.mp.co), 'maladies reconnues pour 1 000 salariés, votre entreprise' + (v.mp != null ? ', soit ' + frNum(v.mp) + ' sur l\'année' : ''),
      fmt1(d.mp.sec), 'dans votre secteur, ' + fmt1(d.mp.nat) + ' en moyenne nationale', d.mp.co / d.mp.sec) : '';
  var page1 = shareFig(fams, 'Les familles de maladies du secteur') +
    meaning([
      'Votre secteur compte ' + frNum(s.mp_1er_reglement || 0) + ' maladies professionnelles reconnues, ' + gap(d.mp.sec / d.mp.nat) + ' la moyenne nationale rapportée aux salariés.',
      (tmsFam ? 'Les troubles musculosquelettiques en font ' + Math.round(tmsFam.pct) + ' %.' : '') + (diseases.length ? ' La plus fréquente, «\u00A0' + esc(diseases[0].libelle) + '\u00A0», compte ' + frNum(diseases[0].nb) + ' cas.' : '')
    ]) +
    (diseases.length ? '<div class="rp-figure"><p class="rp-find">Les maladies reconnues dans votre secteur</p><table class="rp-roles rp-mptable"><thead><tr><th>Tableau</th><th>Maladie</th><th>Cas</th><th>Part</th><th>IP</th><th>Journées</th></tr></thead><tbody>' +
      diseases.map(function(r) { return '<tr><td>' + (/hors/i.test(r.code) ? '' : esc(r.code)) + '</td><td>' + esc(r.libelle) + '</td><td>' + frNum(r.nb) + '</td><td>' + Math.round(r.pct || 0) + ' %</td><td>' + frNum(r.ip || 0) + '</td><td>' + frNum(r.journees || 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '');
  var psy = psyYearBars(null, entry);
  var psyTotal = psy.reduce(function(t, r) { return t + r.value; }, 0);
  var psyFig = psyTotal > 0 ? fig(frNum(psyTotal) + ' maladie' + (psyTotal > 1 ? 's psychiques reconnues' : ' psychique reconnue') + ' depuis ' + psy[0].label, 'Chaque année dans votre secteur. Aucun tableau ne les couvre, elles sont reconnues au cas par cas.',
      { type: 'vbar', aria: 'Maladies psychiques reconnues par année', labels: psy.map(function(r) { return r.label; }), values: psy.map(function(r) { return r.value; }), you: -1, fmt: 'int' }, 4) : '';
  var longest = duree.filter(function(r) { return /10 ans/.test(r.label) && /plus/i.test(r.label); })[0];
  var page2 = cols(tms ? '<div class="rp-fig"><p class="rp-find">Les TMS, par partie du corps</p><p class="rp-why">' + frNum(tms.nb_tms) + ' TMS reconnus dans le secteur.</p>' + sharesFigure(tms.tous, 'TMS du secteur par partie du corps') + '</div>' : '',
      shareFig(duree, 'Durée d\'exposition avant la reconnaissance') + shareFig(prof, 'Profession de la victime'));
  var daysMp = daysFig(daysDis, 'Journées d\'arrêt par maladie, dans votre secteur');
  // Les maladies psychiques accompagnent les journées d'arrêt s'il y en a, sinon la réponse à la caisse.
  if (daysMp) page2 += psyFig;
  if (longest && longest.pct >= 30) page2 += '<p class="rp-p rp-note-line">' + Math.round(longest.pct) + ' % des maladies du secteur sont reconnues après plus de 10 ans d\'exposition. La réponse à la caisse s\'appuie sur ce que vous savez des postes, souvent sur de longues années.</p>';
  var hors = mpApiSentences(entry).filter(function(t) { return /hors tableaux/.test(t); })[0] || null;
  var page3 = (daysMp || psyFig) +
    '<div class="rp-facts">' + (hors ? '<div><p>' + hors + '</p></div>' : '') +
      '<div><strong>30 jours</strong><p>pour répondre au ' + kw('mp', 'questionnaire') + ' que la caisse vous adresse pour chaque maladie déclarée.</p></div></div>' +
    guideOf(T.mp, d, 'La réponse s\'appuie sur ce que vous savez des postes et des expositions, souvent sur de longues années. Un dossier documenté dès ce stade compte pour toute la suite de l\'instruction.');
  // Sans journées publiées pour ses maladies, le secteur n'a pas de page des arrêts : la réponse
  // à la caisse rejoint la page précédente.
  var mp3 = daysMp || psyFig ? [{ id: 'mp-3', title: daysMp ? 'Les arrêts,|et la réponse à la caisse' : 'Les maladies psychiques,|et la réponse à la caisse', html: page3, kicker: 'Partie 2, maladies professionnelles', part: 'mp', toc: daysMp ? 'Les arrêts, et la réponse à la caisse' : 'Les maladies psychiques, et la réponse à la caisse' }] : [];
  if (!mp3.length) page2 += page3;
  // La page de la réponse à la caisse porte déjà le guide des questionnaires dans son panneau : un
  // second contenu y ferait trop, elle ne reçoit pas d'encart.
  return [
    { id: 'mp', title: 'Les maladies professionnelles|de votre métier', html: page1, hero: hero, kicker: 'Partie 2, maladies professionnelles', part: 'mp', toc: 'Les maladies professionnelles de votre métier', fill: ['guide-mp', 'guide-qrp'] },
    { id: 'mp-2', title: 'Qui est touché,|et après combien de temps', html: page2, kicker: 'Partie 2, maladies professionnelles', part: 'mp', toc: 'Qui est touché, et après combien de temps',
      fill: mp3.length ? ['guide-qrp', 'guide-mp'] : null }
  ].concat(mp3, [decadePage(d.src && d.src.histMp, d, true)].filter(Boolean));
}
