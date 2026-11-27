// Page écrite par scripts/prerender.py à l'adresse d'un secteur sans son libellé
// (/accidents-du-travail/4711d/) : elle renvoie vers l'adresse canonique en gardant la
// requête (UTM, ?demo) et l'ancre, pour que ces liens répondent 200 au lieu de 404.html.
// La page d'une carte de « Mes cartes » garde sa propre adresse en canonique, pour l'aperçu LinkedIn,
// et nomme sa destination dans data-to.
(function() {
  var link = document.querySelector('link[rel="canonical"]');
  var root = document.documentElement;
  var to = root.getAttribute('data-to') || (link && link.href);
  // Le lien d'une carte arrive sans UTM, sa page fournit les siens.
  var q = location.search || (root.getAttribute('data-utm') ? '?' + root.getAttribute('data-utm') : '');
  if (to) location.replace(to + q + location.hash);
})();
