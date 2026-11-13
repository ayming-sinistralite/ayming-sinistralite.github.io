// ── Le rapport : l'assemblage des chapitres ──

import { resetNotes, setPart, sortedNotes } from './report-figs.js?v=e9f97a8';
import { atPosition, atGravite, atMecanismes, atPopulation, atArrets, atDixAns } from './report-at.js?v=e9f97a8';
import { mpPart } from './report-mp.js?v=e9f97a8';

// Tous les chapitres, dans l'ordre des documents officiels : les accidents, puis les maladies.
// Les thèmes (buildThemes) leur donnent statut, verdict,
// actions, offres et ressource, les mêmes que l'instantané et la feuille de route.
export function buildChapters(v, d, themes) {
  resetNotes();
  var T = {};
  themes.forEach(function(t) { T[t.id] = t; });
  setPart('Accidents du travail');
  var pages = [].concat(atPosition(v, d), atGravite(v, d, T), atMecanismes(v, d, T), atPopulation(v, d), atArrets(v, d, T), atDixAns(v, d));
  setPart('Maladies professionnelles');
  pages = pages.concat(mpPart(v, d, T));
  // Un chapitre dont aucune donnée n'est publiée pour le secteur ne garde que son titre : il disparaît.
  pages = pages.filter(function(pg) { return /<(canvas|svg|img|table)\b/.test(pg.html) || pg.html.replace(/<[^>]*>/g, '').trim(); });
  return { pages: pages, notes: sortedNotes() };
}
