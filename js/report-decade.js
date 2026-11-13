// ── Le rapport : la décennie ──
// Les causes nationales du trajet et les figures de dix ans, partagées par les accidents et les maladies.

import { getData } from './data.js?v=e9f97a8';
import { isWorse } from './findings.js?v=e9f97a8';
import { frNum, esc } from './utils.js?v=e9f97a8';
import { memo, noDataFig, published, fig, heroFigs, cols, meaning } from './report-figs.js?v=e9f97a8';
import { block } from './report-base.js?v=e9f97a8';

// Dix ans de causes, puis l'encadré du trajet, qui ferme la partie des accidents. Les trois
// premières causes du secteur sur dix ans, en parts des accidents dont la cause est connue.
export function nationalTrajetCauses(sub) {
  return memo('trajet-' + sub, function() {
    var store = (getData('trajet') || {}).by_naf5 || {}, sum = {}, tot = 0;
    Object.keys(store).forEach(function(c) {
      var e = store[c], n = (e.stats || {}).trajet_count || 0, rc = (e.trajet_causes || {})[sub] || {};
      if (!n) return;
      Object.keys(rc).forEach(function(k) { if (rc[k] != null) sum[k] = (sum[k] || 0) + rc[k] * n; });
      tot += n;
    });
    var out = {};
    Object.keys(sum).forEach(function(k) { out[k] = tot ? Math.round(sum[k] / tot * 1000) / 10 : 0; });
    return out;
  });
}

// Dix ans d'évolution, la grille de l'outil (js/history.js) : la fréquence, les jours d'arrêt par
// sinistre, les incapacités permanentes et les décès, puis les quatre premières causes (AT) ou les
// groupes de maladies (MP, en nombres de cas), chaque courbe nommée à son bout, en rouge une
// cause ou un groupe dont la part dépasse le national la dernière année.
var GROUP_SHORT = { 'Troubles musculosquelettiques': 'TMS', 'Maladies professionnelles hors tableau': 'Hors tableau',
  'Autres tableaux de maladies professionnelles': 'Autres tableaux', 'Pathologies liées à l\'amiante': 'Amiante' };

export function decadeFigs(hist, code, mp) {
  var y = hist.meta.years, h = hist.h, nat = hist.national, last = y.length - 1, figs = [], notes = {};
  var perCase = function(o) { return o.j.map(function(x, i) { return x != null && o.n[i] ? Math.round(x / o.n[i]) : null; }); };
  var since = ' depuis ' + y[0], none = ' publié pour votre secteur' + since + '.';
  var draw = function(ok, html, topic, text) { figs.push(ok ? html : noDataFig(topic, text, 7)); };
  if (h['if']) draw(published(h['if']), fig(null, 'Indice de fréquence' + since, { type: 'decade', aria: 'Indice de fréquence du secteur et du national', years: y, fmt: mp ? '1' : 'int',
    series: [{ label: code, data: h['if'], tone: 'part' }, { label: 'National', data: nat['if'], tone: 'nat' }] }, 7),
    'Indice de fréquence' + since, (mp ? 'Aucune maladie professionnelle' : 'Aucun accident avec arrêt') + none);
  if (h.j && h.n) {
    var dSec = perCase(h), dNat = perCase(nat);
    notes.days = { from: dSec[0], to: dSec[last], natFrom: dNat[0], natTo: dNat[last] };
    draw(published(dSec), fig(null, 'Journées d\'arrêt par ' + (mp ? 'maladie' : 'sinistre') + since, { type: 'decade', aria: 'Journées d\'arrêt par ' + (mp ? 'maladie' : 'sinistre'), years: y, fmt: 'int', unit: ' j',
      series: [{ label: code, data: dSec, tone: 'part' }, { label: 'National', data: dNat, tone: 'nat' }] }, 7),
      'Journées d\'arrêt par ' + (mp ? 'maladie' : 'sinistre') + since, 'Aucune journée d\'arrêt publiée pour votre secteur' + since + '.');
  }
  if (h.ip) {
    var ipTopic = h.dc ? 'Incapacités permanentes et décès' : 'Nouvelles incapacités permanentes';
    draw(published(h.ip) || published(h.dc), fig(null, ipTopic, { type: 'ipdc', aria: 'Incapacités permanentes et décès du secteur', years: y, ip: h.ip, dc: h.dc || null }, 7),
      ipTopic, (h.dc ? 'Aucune incapacité permanente ni aucun décès publiés' : 'Aucune incapacité permanente publiée') + ' pour votre secteur' + since + '.');
    var firstDc = h.dc ? h.dc.findIndex(function(x) { return x != null; }) : -1;
    if (firstDc > 0) notes.dcSince = y[firstDc];
  }
  // Les causes sont des parts, les groupes des nombres de cas : l'écart au national se lit en part
  // des sinistres de la dernière année.
  var block = (mp ? h.groupes : h.causes) || {}, natBlock = (mp ? nat.groupes : nat.causes) || {};
  var share = function(v, o) { return v == null ? null : mp ? (o.n[last] ? v / o.n[last] * 100 : null) : v * 100; };
  var top = Object.keys(block).filter(function(k) { return block[k][last] > 0; }).sort(function(a, b) { return block[b][last] - block[a][last]; }).slice(0, 4);
  if (top.length >= 2) {
    var val = function(x) { return x == null ? null : mp ? x : Math.round(x * 1000) / 10; };
    figs.push(fig(null, mp ? 'Maladies reconnues par groupe' : 'Principales causes, en\u00A0% des sinistres dont la cause est connue',
      { type: 'decade', aria: mp ? 'Les maladies reconnues du secteur par groupe' : 'Les principales causes des accidents du secteur', years: y, fmt: mp ? 'int' : 'pct',
      series: top.map(function(k) {
        var label = GROUP_SHORT[k] || (k.length > 20 ? k.slice(0, 19) + '…' : k);
        return { label: label, data: block[k].map(val), tone: natBlock[k] && isWorse(share(block[k][last], h), share(natBlock[k][last], nat)) ? 'worse' : 'part' };
      }) }, 7));
    notes.top = { label: GROUP_SHORT[top[0]] || top[0], from: val(block[top[0]].find(function(x) { return x != null; })), to: val(block[top[0]][last]) };
  }
  return { figs: figs, notes: notes };
}

// La page des dix ans d'une partie, ses trois chiffres en tête et ce qu'ils veulent dire.
export function decadePage(hist, d, mp) {
  if (!hist || !hist.h['if']) return null;
  var y = hist.meta.years, last = y.length - 1, dec = decadeFigs(hist, d.sector, mp), f = dec.figs, nt = dec.notes;
  var evo = function(a) { return a[0] > 0 && a[last] != null ? Math.round((a[last] / a[0] - 1) * 100) : null; };
  var eSec = evo(hist.h['if']), eNat = evo(hist.national['if']), dn = nt.days;
  var signed = function(e) { return (e > 0 ? '+' : '−') + Math.abs(e) + ' %'; };
  var hero = heroFigs([
    eSec != null && eNat != null ? [signed(eSec), 'de fréquence ' + (mp ? 'des maladies ' : '') + 'pour votre secteur depuis ' + y[0] + ', ' + signed(eNat) + ' en France'] : null,
    dn && dn.to != null && dn.from != null ? [frNum(dn.to) + ' j', 'd\'arrêt par ' + (mp ? 'maladie' : 'sinistre') + ' en ' + y[last] + ' dans votre secteur, ' + frNum(dn.from) + ' en ' + y[0]] : null,
    nt.top ? (mp ? [frNum(nt.top.to), 'maladies reconnues du groupe «\u00A0' + esc(nt.top.label) + '\u00A0» en ' + y[last] + ', ' + frNum(nt.top.from) + ' en ' + y[0]]
      : [Math.round(nt.top.to) + ' %', 'des sinistres relèvent de «\u00A0' + esc(nt.top.label) + '\u00A0», ' + Math.round(nt.top.from) + ' % en ' + y[0]]) : null
  ]);
  var html = (f.length > 2 ? cols(f[0], f[1]) + cols(f[2], f[3]) : cols(f[0], f[1])) +
    '<p class="rp-legend"><span><i class="is-part"></i>Votre secteur</span><span><i class="is-tick is-dash"></i>France entière</span><span><i class="is-worse"></i>' + (mp ? 'Groupe' : 'Cause') + ' au-dessus du national en ' + y[last] + '</span>' +
      (nt.dcSince ? '<span>Décès publiés depuis ' + nt.dcSince + '</span>' : '') + '</p>' +
    meaning([
      eSec != null && eNat != null ? 'Depuis ' + y[0] + ', la fréquence ' + (mp ? 'des maladies professionnelles ' : '') + 'de votre secteur a ' + (eSec < 0 ? 'baissé' : 'augmenté') + ' de ' + Math.abs(eSec) + ' %, contre ' + Math.abs(eNat) + ' % ' + (eNat < 0 ? 'de baisse' : 'de hausse') + ' en France.' : null,
      dn && dn.to != null && dn.from != null ? 'Dans le même temps, ' + (mp ? 'une maladie y est passée' : 'un sinistre y est passé') + ' de ' + frNum(dn.from) + ' à ' + frNum(dn.to) + ' jours d\'arrêt, et de ' + frNum(dn.natFrom) + ' à ' + frNum(dn.natTo) + ' en France. La durée des arrêts pèse autant que leur nombre.' : null
    ]);
  return { id: mp ? 'mp-dix-ans' : 'at-dix-ans', title: 'Dix ans|d\'évolution', html: html, hero: hero,
    kicker: mp ? 'Partie 2, maladies professionnelles' : 'Partie 1, accidents du travail', part: mp ? 'mp' : 'at', toc: 'Dix ans d\'évolution',
    fill: mp ? ['guide-mp', 'guide-qrp'] : ['webinaire-prevention', 'barometre-absenteisme', 'guide-arrets'] };
}
