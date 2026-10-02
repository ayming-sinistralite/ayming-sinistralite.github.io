// Chargé en synchrone dans le <head> de la landing (index.html), avant le premier rendu.
// Thème appliqué avant le premier rendu, sinon la page clignote en clair.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('sinistralite-theme'); } catch (e) {}
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
// Provenance de la visite (UTM, identifiants de clic), relue par le formulaire du diagnostic
// dans app.html. Même règle et même clé que captureAttribution() dans js/lead.js.
(function () {
  var MAP = { utm_source: 'ga_source', utm_medium: 'ga_medium', utm_campaign: 'ga_campaign',
    utm_content: 'ga_content', utm_term: 'ga_term', gclid: 'gclid', gbraid: 'gbraid',
    wbraid: 'wbraid', msclkid: 'msclkid', fbclid: 'fbclid', li_fat_id: 'li_fat_id' };
  var params = new URLSearchParams(window.location.search), found = {}, any = false;
  Object.keys(MAP).forEach(function (k) {
    var v = params.get(k);
    if (v) { found[MAP[k]] = v.slice(0, 255); any = true; }
  });
  if (any) { try { localStorage.setItem('sinistralite-attribution', JSON.stringify(found)); } catch (e) {} }
})();
