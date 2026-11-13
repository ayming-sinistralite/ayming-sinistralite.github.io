// ── Le lead du diagnostic : ce qui part vers Pardot, et les champs qui le préparent ──
// Même contrat que les formulaires d'ayming.fr (handler modèle « Guide AT/MP
// - 2025 ») : mêmes noms de paramètres, donc mêmes champs Pardot et Salesforce. Trois pièces :
// la provenance (UTM et identifiants de clic, gardés depuis l'arrivée), l'entreprise retrouvée
// par l'API publique Recherche d'entreprises (qui donne le SIRET), et la fonction choisie dans
// la liste que Salesforce accepte.

import { POSITIONS, DEPT_SYNONYMS, POSITION_SYNONYMS } from './positions.js?v=e9f97a8';
import { esc, normalize, debounce } from './utils.js?v=e9f97a8';
import { setAccount } from './sidebar.js?v=e9f97a8';

// Form handler Pardot 14630 « Diagnostic sinistralité AT/MP - Outil sinistralité », campagne
// « FR 2026 - WHT - Diagnostic sinistralité AT/MP ».
var HANDLER_URL = 'https://go.ayming.fr/l/183052/2026-09-25/blwn7h';

// ── Provenance ──
// Écrite à l'arrivée par js/attribution.js (UTM, identifiants de clic, ou le référent), sous les
// noms qu'attend le handler. Sans rien d'enregistré, la visite est directe, comme sur ayming.fr.
var ATTR_KEY = 'sinistralite-attribution';
var ATTR_FIELDS = ['ga_source', 'ga_medium', 'ga_campaign', 'ga_content', 'ga_term',
  'gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid', 'li_fat_id'];

export function readAttribution() {
  var a = {}, stored = null;
  try { stored = JSON.parse(localStorage.getItem(ATTR_KEY)); } catch (e) { stored = null; }
  // Seuls les champs que js/attribution.js écrit partent, en texte : une valeur abîmée ou
  // ajoutée à la main dans le stockage ne devient pas un champ du formulaire.
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    ATTR_FIELDS.forEach(function(k) {
      if (typeof stored[k] === 'string' && stored[k]) a[k] = stored[k].slice(0, 255);
    });
  }
  if (!a.ga_source) { a.ga_source = 'direct'; a.ga_medium = a.ga_medium || 'none'; }
  var cid = typeof document !== 'undefined' ? gaClientId(document.cookie) : '';
  if (cid) a.ga_client_id = cid;
  return a;
}

// L'identifiant client GA4, lu dans le cookie _ga (GA1.1.123.456 donne 123.456), qui n'existe
// qu'après le consentement. Il relie le prospect Pardot à sa visite GA4, comme le champ 98
// des formulaires d'ayming.fr.
export function gaClientId(cookie) {
  var ga = ((cookie || '').match(/(?:^|;\s*)_ga=([^;]*)/) || [])[1] || '';
  var parts = ga.split('.');
  return parts.length >= 4 ? parts[2] + '.' + parts[3] : '';
}

// ── Envoi ──
// Pardot ne renvoie aucun en-tête CORS : la requête part en no-cors, sa réponse est illisible.
// Limite connue : toute requête qui aboutit côté réseau se résout, un refus 4xx ou 5xx compris.
// « Envoyé » veut donc dire « remis au navigateur », jamais « reçu par Pardot » : le diagnostic
// ne doit pas annoncer une réception confirmée. La preuve se lit sur le prospect, jamais ici.
// Renvoie une promesse : true quand la requête a quitté le navigateur (réponse opaque), false
// quand le réseau l'a refusée ou que rien n'est configuré. Pardot acceptera ou non, cela ne se lit pas.
export function sendLead(fields) {
  // L'étape contact nomme la personne : le menu latéral l'affiche, en mémoire seulement.
  setAccount(fields);
  if (!HANDLER_URL) return Promise.resolve(false);
  var all = Object.assign({}, readAttribution(), fields);
  var body = new URLSearchParams();
  Object.keys(all).forEach(function(k) {
    if (all[k] != null && all[k] !== '') body.append(k, String(all[k]));
  });
  try {
    return Promise.resolve(fetch(HANDLER_URL, { method: 'POST', mode: 'no-cors', body: body, keepalive: true }))
      .then(function() { return true; }, function() { return false; });
  } catch (e) { return Promise.resolve(false); }
}

// ── Recherche utilitaire ──
function norm(s) {
  return normalize(s || '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Une liste déroulante branchée sur un champ : search(query, done) fournit les options
// {label, sub, value}, onPick reçoit l'option choisie. Clavier : flèches, Entrée, Échap.
var pickerCount = 0;
// empty, facultatif : le message affiché quand une saisie ne trouve rien.
function attachPicker(input, box, search, onPick, empty, suggest) {
  var items = [], index = -1, seq = 0;
  if (!box.id) box.id = 'ac-' + (++pickerCount);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', box.id);
  box.setAttribute('role', 'listbox');

  function close() {
    box.classList.remove('open');
    index = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function paint() {
    box.querySelectorAll('.ac-item').forEach(function(it, i) {
      it.classList.toggle('active', i === index);
      it.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    if (index >= 0) input.setAttribute('aria-activedescendant', box.id + '-opt-' + index);
    else input.removeAttribute('aria-activedescendant');
  }
  function render(list) {
    items = list;
    index = -1;
    if (!list.length) {
      if (!empty || !input.value.trim()) { close(); return; }
      box.innerHTML = '<div class="ac-hint" role="presentation">' + empty + '</div>';
      box.classList.add('open');
      input.setAttribute('aria-expanded', 'true');
      input.removeAttribute('aria-activedescendant');
      return;
    }
    box.innerHTML = list.map(function(o, i) {
      return '<div class="ac-item" role="option" aria-selected="false" id="' + box.id + '-opt-' + i + '" data-i="' + i + '"><span class="libelle">' + esc(o.label) + '</span>' +
        (o.sub ? '<span class="ac-sub">' + esc(o.sub) + '</span>' : '') + '</div>';
    }).join('');
    box.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
  }
  function run() {
    var mine = ++seq;
    search(input.value, function(list) { if (mine === seq) render(list); });
  }

  // Champ vide : la liste courte s'ouvre d'elle-même, comme un menu déroulant.
  function open() { if (suggest && !input.value.trim()) { ++seq; render(suggest); } }
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  var later = debounce(run, 220);
  input.addEventListener('input', function() {
    later.cancel();
    if (!input.value.trim() && suggest) { open(); return; }
    later();
  });
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
  return { p: p, name: norm(p), ctx: norm(d + ' ' + (DEPT_SYNONYMS[d] || '') + ' ' + (POSITION_SYNONYMS[p] || '')), ini: ini };
});
var POS_VALID = {};
POS_INDEX.forEach(function(o) { POS_VALID[o.name] = o.p; });

var STOP_WORDS = { de: 1, du: 1, des: 1, d: 1, la: 1, le: 1, les: 1, l: 1, et: 1, en: 1, a: 1, au: 1, aux: 1 };

// Un sigle (« DRH », « DAF ») compte plus qu'un mot du nom, qui compte plus qu'un mot du département.
function searchPositions(q, done) {
  // Les mots vides (« Chargé de prévention ») ne doivent pas écarter une fonction.
  var toks = norm(q).split(' ').filter(function(t) { return t && !STOP_WORDS[t]; });
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

// Les fonctions de ceux qui remplissent le diagnostic, proposées avant toute saisie.
var TOP_POSITIONS = ['Directeur Ressources Humaines', 'Responsable RH', 'Directeur Hygiène et Sécurité',
  'Responsable Prévention', 'Responsable Qualité', 'Directeur Administratif et Financier',
  'Directeur Général', 'Gérant', 'Responsable Paie', 'Gestionnaire RH'];

export function bindPosition(input, box) {
  attachPicker(input, box, searchPositions, function() {},
    'Aucune fonction de notre liste ne correspond. Essayez un mot plus court, par exemple Prévention, Sécurité, RH, Paie ou Direction.',
    TOP_POSITIONS.map(function(p) { return { label: p }; }));
}

// La fonction telle que Salesforce l'attend, ou null si la saisie n'est pas dans la liste.
export function canonicalPosition(value) { return POS_VALID[norm(value)] || null; }
export function positionDepartment(position) { return POSITIONS[position] || ''; }
