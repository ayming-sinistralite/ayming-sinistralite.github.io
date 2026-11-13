// Chargé en synchrone en tête de index.html et app.html, avant js/gtm.js.
// Provenance de la visite, pour le formulaire (Pardot) et pour GA4, avec les règles d'ayming.fr.
// Les listes llm, search, social, internal, referred, skip et clickIds sont écrites par
// marketing-attribution/attribution-rules/generate.py --sinistralite <ce fichier>, depuis rules.json :
// on les change là-bas, jamais ici.
//
// Pardot (clé localStorage sinistralite-attribution, relue par js/lead.js), dernier contact non direct :
// - des paramètres d'URL (UTM, identifiants de clic) remplacent ce qui est enregistré ; un
//   identifiant de clic sans utm_source donne sa source et son medium (gclid : google / cpc) ;
// - sinon un référent externe le remplace aussi : classé (assistant IA, moteur, réseau social, hôte
//   Ayming), ayming.fr en ayming / referral, tout autre domaine en referral ;
// - un accès direct, une navigation interne ou un hôte ignoré (skip) ne changent rien. Sans rien
//   d'enregistré, lead.js envoie direct / none.
// GA4 (dataLayer, lu par les variables Data Layer du conteneur GTM-KC5XLKJ2) : referrer_source et
// referrer_medium pour la page chargée, sans utm_source dans l'adresse et pour un référent classé
// seulement, comme les variables « JS - Referrer Source/Medium Override » d'ayming.fr. ayming.fr n'y
// figure pas : la visite reste une seule session. traffic_type vaut internal en démo (?demo, ?test)
// ou sur un navigateur marqué par ?interne=1 (?interne=0 retire la marque, clé ga_internal).
(function (root) {
  var KEY = 'sinistralite-attribution';
  var INTERNAL_KEY = 'ga_internal';
  var PARAMS = { utm_source: 'ga_source', utm_medium: 'ga_medium', utm_campaign: 'ga_campaign',
    utm_content: 'ga_content', utm_term: 'ga_term', gclid: 'gclid', gbraid: 'gbraid',
    wbraid: 'wbraid', msclkid: 'msclkid', fbclid: 'fbclid', li_fat_id: 'li_fat_id' };

  var llm = [
    ['chatgpt.com','chatgpt'],['chat.openai.com','chatgpt'],
    ['claude.ai','claude'],
    ['gemini.google.com','gemini'],['bard.google.com','gemini'],
    ['copilot.microsoft.com','copilot'],['copilot.cloud.microsoft','copilot'],['copilot.com','copilot'],
    ['perplexity.ai','perplexity'],
    ['chat.mistral.ai','mistral'],['le-chat.mistral.ai','mistral'],['mistral.ai','mistral'],
    ['deepseek.com','deepseek'],
    ['meta.ai','meta-ai'],
    ['you.com','you'],
    ['poe.com','poe'],
    ['phind.com','phind'],
    ['blackbox.ai','blackbox'],
    ['iask.ai','iask'],
    ['chat.chaton.ai','chaton'],
    ['mammouth.ai','mammouth'],
    ['notebooklm.google.com','notebooklm'],['notebook.google.com','notebooklm'],['notebooklm.cloud.google.com','notebooklm'],
    ['vertexaisearch.cloud.google.com','vertex-ai'],['vertexaisearch.cloud.google','vertex-ai']
  ];
  var search = [
    ['bing.com','bing'],
    ['duckduckgo.com','duckduckgo'],
    ['search.brave.com','brave'],
    ['qwant.com','qwant'],
    ['ecosia.org','ecosia'],
    ['lilo.org','lilo'],
    ['petalsearch.com','petalsearch'],
    ['metacrawler.com','metacrawler'],
    ['google.','google'],
    ['yahoo.','yahoo'],
    ['lycos.','lycos']
  ];
  var social = [
    ['linkedin.com','linkedin'],['lnkd.in','linkedin'],
    ['m.facebook.com','facebook'],['l.facebook.com','facebook'],['lm.facebook.com','facebook'],['facebook.com','facebook'],['fb.com','facebook'],
    ['twitter.com','twitter'],['x.com','twitter'],['t.co','twitter'],
    ['youtube.com','youtube'],
    ['reddit.com','reddit'],
    ['instagram.com','instagram'],
    ['xing.com','xing'],
    ['tiktok.com','tiktok'],
    ['pinterest.com','pinterest'],['pinterest.fr','pinterest'],['pin.it','pinterest'],
    ['snapchat.com','snapchat'],
    ['quora.com','quora'],
    ['t.me','telegram'],['web.telegram.org','telegram']
  ];
  var internal = [
    ['analyses-innovation.ayming.com','ayming'],['ayming.com','ayming'],['ayming.co.uk','ayming'],['ayming.de','ayming'],['ayming.be','ayming'],['ayming.es','ayming'],['ayming.it','ayming'],['ayming.pt','ayming'],['ayming.ca','ayming'],['ayming.ie','ayming'],['ayming.pl','ayming'],['ayming.sk','ayming'],['ayming.cz','ayming'],['aymingusa.com','ayming'],
    ['ayming.lightning.force.com','salesforce'],
    ['myayming.almacg.com','myayming'],['myayming.almacg','myayming']
  ];
  var referred = [
    ['statics.teams.cdn.office.net','microsoft'],['statics.teams.cdn.office','microsoft']
  ];
  var skip = [
    'go.ayming',
    'tagmanager.google',
    'tagassistant.google',
    'analytics.google',
    'ads.google'
  ];
  var clickIds = {
    'gclid|gbraid|wbraid': 'google/cpc',
    'msclkid': 'bing/cpc',
    'fbclid': 'facebook/cpc',
    'li_fat_id': 'linkedin/cpc'
  };

  // Un domaine entier ou l'un de ses sous-domaines, jamais un fragment ; une marque finie par un
  // point (google.) vaut pour un libellé d'hôte qui commence par elle (www.google.co.uk).
  function hostMatches(h, d) {
    return h === d || h.slice(-(d.length + 1)) === '.' + d;
  }
  function markerMatches(h, m) {
    if (m.charAt(m.length - 1) !== '.') return hostMatches(h, m);
    return h.indexOf(m) === 0 || h.indexOf('.' + m) > -1;
  }

  // Le référent classé, dans l'ordre d'ayming.fr (les assistants IA d'abord), ou null.
  // null for a skipped host (Pardot's go.ayming), which GA4 also ignores as a referrer.
  function classify(host) {
    for (var k = 0; k < skip.length; k++) if (host.indexOf(skip[k]) > -1) return null;
    var groups = [[llm, 'llm'], [search, 'organic'], [social, 'social'], [internal, 'internal'],
      [referred, 'referral'], [[['ausha.co', 'ausha']], 'podcast']];
    for (var g = 0; g < groups.length; g++) {
      for (var i = 0; i < groups[g][0].length; i++) {
        if (markerMatches(host, groups[g][0][i][0])) return { source: groups[g][0][i][1], medium: groups[g][1] };
      }
    }
    return null;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; }
  }

  // Ce que la visite apprend à Pardot de son référent : null pour un accès direct, une page du
  // même site ou un hôte ignoré.
  function fromReferrer(referrer, ownHost) {
    var host = hostOf(referrer);
    if (!host || hostMatches(host, ownHost)) return null;
    for (var i = 0; i < skip.length; i++) if (host.indexOf(skip[i]) > -1) return null;
    var c = classify(host);
    if (c) return c;
    if (hostMatches(host, 'ayming.fr')) return { source: 'ayming', medium: 'referral' };
    return { source: host, medium: 'referral' };
  }

  // Les paramètres d'URL de provenance, ou null. Un identifiant de clic sans utm_source porte sa
  // source et son medium (clickIds).
  function fromParams(params) {
    var found = {}, any = false;
    Object.keys(PARAMS).forEach(function (k) {
      var v = params.get(k);
      if (v) { found[PARAMS[k]] = v.slice(0, 255); any = true; }
    });
    if (!any) return null;
    if (!found.ga_source) {
      Object.keys(clickIds).forEach(function (ids) {
        if (found.ga_source) return;
        if (ids.split('|').some(function (id) { return found[id]; })) {
          var pair = clickIds[ids].split('/');
          found.ga_source = pair[0];
          if (!found.ga_medium) found.ga_medium = pair[1];
        }
      });
    }
    return found;
  }

  root.SinistraliteAttribution = { classify: classify, fromReferrer: fromReferrer, fromParams: fromParams };
  if (typeof document === 'undefined') return;

  var params = new URLSearchParams(window.location.search);
  var ownHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  var touch = fromParams(params);
  if (!touch) {
    var r = fromReferrer(document.referrer, ownHost);
    if (r) touch = { ga_source: r.source, ga_medium: r.medium };
  }
  var internalFlag = false;
  try {
    if (touch) localStorage.setItem(KEY, JSON.stringify(touch));
    if (params.get('interne') === '1') localStorage.setItem(INTERNAL_KEY, '1');
    if (params.get('interne') === '0') localStorage.removeItem(INTERNAL_KEY);
    internalFlag = localStorage.getItem(INTERNAL_KEY) === '1';
  } catch (e) { /* stockage indisponible */ }

  var push = {};
  if (internalFlag || params.has('demo') || params.has('test')) push.traffic_type = 'internal';
  if (!params.get('utm_source')) {
    var refHost = hostOf(document.referrer);
    var c = refHost && !hostMatches(refHost, ownHost) ? classify(refHost) : null;
    if (c) { push.referrer_source = c.source; push.referrer_medium = c.medium; }
  }
  if (Object.keys(push).length) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(push);
  }
})(typeof window !== 'undefined' ? window : globalThis);
