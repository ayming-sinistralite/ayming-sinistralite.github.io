// Page écrite par scripts/prerender.py à l'adresse d'un secteur sans son libellé
// (/accidents-du-travail/4711d/) : elle renvoie vers l'adresse canonique en gardant la
// requête (UTM, ?demo) et l'ancre, pour que ces liens répondent 200 au lieu de 404.html.
(function() {
  var link = document.querySelector('link[rel="canonical"]');
  if (link) location.replace(link.href + location.search + location.hash);
})();
