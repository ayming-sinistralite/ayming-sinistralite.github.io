// Articles (pages écrites par scripts/articles.py) : le panneau sous le bouton « Me comparer à
// mon secteur ». Il s'ouvre une fois, sur ordinateur, quelques secondes après l'arrivée, et ne
// revient pas une fois fermé (clé sinistralite-article-pop, listée dans cookies.html).
(function () {
  var KEY = 'sinistralite-article-pop';
  var seen = function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  var remember = function () { try { localStorage.setItem(KEY, '1'); } catch (e) {} };

  document.addEventListener('DOMContentLoaded', function () {
    var pop = document.getElementById('aPop');
    if (!pop || seen() || !window.matchMedia('(min-width: 961px)').matches) return;
    var close = function () { pop.hidden = true; remember(); };
    pop.querySelector('.a-pop-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) close(); });
    pop.querySelector('.a-btn').addEventListener('click', remember);
    setTimeout(function () { pop.hidden = false; }, 2500);
  });
})();
