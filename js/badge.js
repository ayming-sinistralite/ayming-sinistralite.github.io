// ── L'étiquette de l'accueil ──
// À l'accueil (tour.js), l'étiquette « Bonjour, je m'appelle » se remplit pendant que la personne
// tape son prénom puis choisit son secteur. Les cartes gagnées ensuite vivent dans badges.js.
// Le prénom et le secteur viennent du profil (profile.js) et ne quittent pas l'appareil.
// Textes posés par textContent, jamais en HTML.

import { libelleOf } from './data.js?v=36466a3';

var BRAND = 'Sinistralité';

export function sectorLabel(code) { return code ? libelleOf('at', code) || '' : ''; }

function today() {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Monte l'étiquette dans `box` (une fois), puis la remplit : { prenom, sector }.
export function renderTag(box, t) {
  if (!box) return;
  if (!box.firstChild) {
    box.innerHTML = '<figure class="name-tag" aria-hidden="true">' +
      '<div class="name-tag-top"><span class="name-tag-hello">Bonjour</span><span class="name-tag-sub">je m\'appelle</span></div>' +
      '<div class="name-tag-body"><span class="name-tag-name"></span><span class="name-tag-sector"><small>Secteur</small><span></span></span></div>' +
      '<div class="name-tag-foot"><span>' + BRAND + '</span><span class="name-tag-date"></span></div>' +
    '</figure>';
  }
  var name = box.querySelector('.name-tag-name');
  if (name.textContent !== (t.prenom || '')) {
    name.textContent = t.prenom || '';
    // Chaque lettre tapée fait « vivre » l'étiquette : elle rebondit, puis se redresse une fois remplie.
    name.classList.remove('pop');
    void name.offsetWidth;
    name.classList.add('pop');
  }
  box.firstChild.classList.toggle('is-filled', !!(t.prenom || t.sector));
  var sector = sectorLabel(t.sector);
  box.querySelector('.name-tag-sector span').textContent = sector;
  box.querySelector('.name-tag-sector').hidden = !sector;
  box.querySelector('.name-tag-date').textContent = today();
}
