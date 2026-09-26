// ── Le lead du diagnostic : ce qui part vers Pardot, et les champs qui le préparent ──
// Même contrat que les formulaires d'ayming.fr (skill pardot-api, handler modèle « Guide AT/MP
// - 2025 ») : mêmes noms de paramètres, donc mêmes champs Pardot et Salesforce. Trois pièces :
// la provenance (UTM et identifiants de clic, gardés depuis l'arrivée), l'entreprise retrouvée
// par l'API publique Recherche d'entreprises (qui donne le SIRET), et la fonction choisie dans
// la liste que Salesforce accepte.

import { POSITIONS, DEPT_SYNONYMS } from './positions.js';

// Form handler Pardot 14630 « Diagnostic sinistralité AT/MP - Outil sinistralité », campagne
// « FR 2026 - WHT - Diagnostic sinistralité AT/MP » (Salesforce 701W500001CzvoNIAR).
var HANDLER_URL = 'https://go.ayming.fr/l/183052/2026-09-25/blwn7h';

// ── Provenance ──
// Le paramètre d'URL et le nom attendu par le handler (les UTM y portent un préfixe ga_).
var TRACKING = {
  utm_source: 'ga_source', utm_medium: 'ga_medium', utm_campaign: 'ga_campaign',
  utm_content: 'ga_content', utm_term: 'ga_term',
  gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid', msclkid: 'msclkid', fbclid: 'fbclid', li_fat_id: 'li_fat_id'
};
var ATTR_KEY = 'sinistralite-attribution';

// La dernière visite arrivée avec des paramètres l'emporte, une visite sans paramètre ne
// l'efface pas. La landing (index.html) écrit la même clé avec le même code.
export function captureAttribution() {
  var params = new URLSearchParams(window.location.search);
  var found = {}, any = false;
  Object.keys(TRACKING).forEach(function(k) {
    var val = params.get(k);
    if (val) { found[TRACKING[k]] = val.slice(0, 255); any = true; }
  });
  if (!any) return;
  try { localStorage.setItem(ATTR_KEY, JSON.stringify(found)); } catch (e) { /* stockage indisponible */ }
}

function readAttribution() {
  try { return JSON.parse(localStorage.getItem(ATTR_KEY)) || {}; } catch (e) { return {}; }
}

// ── Envoi ──
// Pardot ne renvoie aucun en-tête CORS : la requête part en no-cors, sa réponse est illisible.
// La preuve de réception se lit donc sur le prospect, jamais ici.
export function sendLead(fields) {
  if (!HANDLER_URL) return false;
  var all = Object.assign({}, readAttribution(), fields);
  var body = new URLSearchParams();
  Object.keys(all).forEach(function(k) {
    if (all[k] != null && all[k] !== '') body.append(k, String(all[k]));
  });
  try {
    fetch(HANDLER_URL, { method: 'POST', mode: 'no-cors', body: body, keepalive: true }).catch(function() {});
  } catch (e) { return false; }
  return true;
}

// ── Recherche utilitaire ──
function norm(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Une liste déroulante branchée sur un champ : search(query, done) fournit les options
// {label, sub, value}, onPick reçoit l'option choisie. Clavier : flèches, Entrée, Échap.
function attachPicker(input, box, search, onPick) {
  var items = [], index = -1, seq = 0, timer;

  function close() { box.classList.remove('open'); index = -1; }
  function paint() {
    box.querySelectorAll('.ac-item').forEach(function(it, i) { it.classList.toggle('active', i === index); });
  }
  function render(list) {
    items = list;
    index = -1;
    if (!list.length) { close(); return; }
    box.innerHTML = list.map(function(o, i) {
      return '<div class="ac-item" data-i="' + i + '"><span class="libelle">' + esc(o.label) + '</span>' +
        (o.sub ? '<span class="ac-sub">' + esc(o.sub) + '</span>' : '') + '</div>';
    }).join('');
    box.classList.add('open');
  }
  function run() {
    var mine = ++seq;
    search(input.value, function(list) { if (mine === seq) render(list); });
  }

  input.addEventListener('input', function() { clearTimeout(timer); timer = setTimeout(run, 220); });
  input.addEventListener('keydown', function(e) {
    if (!box.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); index = Math.min(index + 1, items.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); index = Math.max(index - 1, 0); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(index >= 0 ? index : 0); }
    else if (e.key === 'Escape') { close(); }
  });
  // mousedown plutôt que click : le choix passe avant que le champ ne perde le focus.
  box.addEventListener('mousedown', function(e) {
    var it = e.target.closest('.ac-item');
    if (!it) return;
    e.preventDefault();
    pick(parseInt(it.dataset.i, 10));
  });
  input.addEventListener('blur', function() { setTimeout(close, 120); });

  function pick(i) {
    var o = items[i];
    if (!o) return;
    input.value = o.label;
    close();
    onPick(o);
  }
}

// ── Entreprise, via l'API Recherche d'entreprises (la même que le site ayming.fr) ──
var COMPANY_API = 'https://recherche-entreprises.api.gouv.fr/search';

function searchCompanies(q, done) {
  q = (q || '').trim();
  if (q.length < 3) { done([]); return; }
  fetch(COMPANY_API + '?q=' + encodeURIComponent(q) + '&per_page=25&etat_administratif=A')
    .then(function(r) { return r.ok ? r.json() : { results: [] }; })
    .then(function(d) {
      // L'API rapproche aussi par dirigeant ou établissement : ne garder que les noms qui
      // contiennent chaque mot tapé, sauf si aucun ne le fait.
      var toks = norm(q).split(' ').filter(Boolean);
      var all = d.results || [];
      var named = all.filter(function(r) {
        var n = norm((r.nom_complet || '') + ' ' + (r.nom_raison_sociale || ''));
        return toks.every(function(t) { return n.indexOf(t) >= 0; });
      });
      done((named.length ? named : all).slice().sort(function(a, b) { return companyRank(b) - companyRank(a); }).slice(0, 8).map(function(r) {
        var s = r.siege || {};
        return {
          label: r.nom_complet || r.nom_raison_sociale || '',
          sub: [s.code_postal, s.libelle_commune].filter(Boolean).join(' '),
          value: s.siret || ''
        };
      }).filter(function(o) { return o.label; }));
    })
    .catch(function() { done([]); });   // l'API muette laisse un champ libre, jamais un blocage
}

// Même classement que la balise GTM du site : les grandes entreprises d'abord, les sociétés
// immobilières (NAF 68, souvent des holdings de murs) en dernier. Le tri de l'API est stable
// à score égal, donc sa pertinence départage le reste.
function companyRank(r) {
  var size = { GE: 3, ETI: 2, PME: 1 }[r.categorie_entreprise] || 0;
  return size * 4 - ((r.activite_principale || '').indexOf('68') === 0 ? 25 : 0);
}

// Le SIRET suit le nom choisi dans la liste ; retoucher le nom le détache.
export function bindCompany(input, box, onSiret) {
  attachPicker(input, box, searchCompanies, function(o) { onSiret(o.value); });
  input.addEventListener('input', function() { onSiret(''); });
}

// ── Fonction, dans la liste Salesforce ──
var POS_INDEX = Object.keys(POSITIONS).map(function(p) {
  var d = POSITIONS[p] || '';
  var words = norm(p).split(' ');
  var ini = {};
  for (var a = 0; a < words.length; a++) {
    var acc = '';
    for (var b = a; b < words.length; b++) { acc += words[b].charAt(0); if (b > a) ini[acc] = 1; }
  }
  return { p: p, name: norm(p), ctx: norm(d + ' ' + (DEPT_SYNONYMS[d] || '')), ini: ini };
});
var POS_VALID = {};
POS_INDEX.forEach(function(o) { POS_VALID[o.name] = o.p; });

// Un sigle (« DRH », « DAF ») compte plus qu'un mot du nom, qui compte plus qu'un mot du département.
function searchPositions(q, done) {
  var toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) { done([]); return; }
  var out = [];
  POS_INDEX.forEach(function(o) {
    var score = 0, hit = 0;
    toks.forEach(function(t) {
      if (o.ini[t]) { score += 3; hit++; }
      else if (o.name.indexOf(t) >= 0) { score += 2; hit++; }
      else if (o.ctx.indexOf(t) >= 0) { score += 1; hit++; }
    });
    if (hit === toks.length) out.push({ label: o.p, s: score });
  });
  out.sort(function(a, b) { return b.s - a.s || a.label.length - b.label.length; });
  done(out.slice(0, 10));
}

export function bindPosition(input, box) {
  attachPicker(input, box, searchPositions, function() {});
}

// La fonction telle que Salesforce l'attend, ou null si la saisie n'est pas dans la liste.
export function canonicalPosition(value) { return POS_VALID[norm(value)] || null; }
export function positionDepartment(position) { return POSITIONS[position] || ''; }
