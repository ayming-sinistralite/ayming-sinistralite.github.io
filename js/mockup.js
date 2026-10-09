// ── Maquette de l'outil, en HTML (styles/mockup.css, classes mk-*) ──
// Une petite fenêtre de l'outil : sa barre du haut, son menu avec les vraies icônes, l'entrée de la
// vue allumée, et l'esquisse de ce que la vue montre. Les tuiles de l'accueil (home.js) et les
// bulles des visites guidées (tour.js) la partagent. focus allume la partie dont on parle :
//   'home' | 'compare' | 'tabs'        une entrée du menu, ou les trois onglets de données
//   'resources'                        l'entrée Ressources et son menu
//   'bot'                              Virginie, en bas à droite
//   'search' | 'kpis' | 'chart' | 'add'   la recherche, les chiffres clés, le graphique, la comparaison
//   'sector' | 'fields' | 'result' | 'cta' le secteur, les trois chiffres, le résultat, le rapport
// Aucun texte ni chiffre : la maquette ne date pas.

var RAIL = [['home', 'house'], ['compare', 'building-2'], ['at', 'hard-hat'], ['mp', 'thermometer'], ['trajet', 'car']];
var DATA_VIEWS = ['at', 'mp', 'trajet'];

function on(focus, key) { return focus === key ? ' is-focus' : ''; }

function sketch(view, focus) {
  if (view === 'home') {
    return '<span class="mk-hero"><i></i><b></b></span>' +
      '<span class="mk-tiles"><span class="mk-tile is-main"></span><span class="mk-tile"></span><span class="mk-tile"></span><span class="mk-tile"></span></span>';
  }
  if (view === 'compare') {
    return '<span class="mk-split">' +
      '<span class="mk-form"><i></i><span class="mk-field' + on(focus, 'sector') + '"></span>' +
        '<span class="mk-fields' + on(focus, 'fields') + '"><span class="mk-field"></span><span class="mk-field"></span><span class="mk-field"></span></span></span>' +
      '<span class="mk-result' + on(focus, 'result') + '"><i></i><b class="mk-big"></b><span class="mk-gauge"></span>' +
        '<span class="mk-cta' + on(focus, 'cta') + '"></span></span>' +
    '</span>';
  }
  var chart = {
    at: '<span class="mk-chart mk-bars' + on(focus, 'chart') + '"><b style="height:45%"></b><b style="height:70%"></b><b style="height:35%"></b><b style="height:90%"></b><b style="height:60%"></b><b style="height:50%"></b></span>',
    mp: '<span class="mk-chart mk-rows' + on(focus, 'chart') + '"><span><em></em><i style="width:72%"></i></span><span><em></em><i style="width:54%"></i></span><span><em></em><i style="width:38%"></i></span><span><em></em><i style="width:24%"></i></span></span>',
    trajet: '<span class="mk-chart mk-donut-wrap' + on(focus, 'chart') + '"><span class="mk-donut"></span><span class="mk-legend"><i></i><i></i><i></i></span></span>'
  }[view];
  return '<span class="mk-row"><span class="mk-input' + on(focus, 'search') + '"></span><span class="mk-add' + on(focus, 'add') + '"></span></span>' +
    '<span class="mk-kpis' + on(focus, 'kpis') + '"><span class="mk-kpi"><i></i><b></b></span><span class="mk-kpi"><i></i><b></b></span><span class="mk-kpi"><i></i><b></b></span></span>' +
    chart;
}

export function mockup(view, focus) {
  var rail = RAIL.map(function(r) {
    var lit = r[0] === view || (focus === 'tabs' && DATA_VIEWS.indexOf(r[0]) >= 0);
    var spot = focus === r[0] || (focus === 'tabs' && DATA_VIEWS.indexOf(r[0]) >= 0);
    return '<span class="mk-ico' + (lit ? ' is-on' : '') + (spot ? ' is-focus' : '') + '"><i data-lucide="' + r[1] + '"></i></span>';
  }).join('');
  var res = '<span class="mk-ico mk-res' + on(focus, 'resources') + '"><i data-lucide="book-open"></i></span>';
  return '<span class="mk-window' + (focus ? ' has-focus' : '') + '">' +
    '<span class="mk-top"><span class="mk-search"></span></span>' +
    '<span class="mk-rail">' + rail + '<span class="mk-gap"></span>' + res + '</span>' +
    '<span class="mk-main">' + sketch(view, focus) + '</span>' +
    (focus === 'resources' ? '<span class="mk-pop"><i></i><i></i><i></i><i></i></span>' : '') +
    (focus === 'bot' ? '<span class="mk-bot is-focus"><img src="assets/consultant-brossier.webp" alt=""></span>' : '') +
  '</span>';
}
