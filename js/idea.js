// ── « Proposer une idée » : le bouton du menu latéral et sa fenêtre ──
// Un titre et une description, avec le prénom et l'e-mail repris de l'accueil (cachés quand ils y sont), partent vers le form
// handler Pardot des idées (IDEA_HANDLER_URL dans lead.js), dont l'e-mail de notification est la
// boîte des idées. Pas de vote, il faudrait un serveur. Sans handler configuré, ou en
// démo, le bouton reste caché. Ce qui part est écrit dans la FAQ « Mes données sont-elles enregistrées ».

import { el, trackEvent, isEmail } from './utils.js?v=36466a3';
import { isDemo } from './route.js?v=36466a3';
import { getProfile } from './profile.js?v=36466a3';
import { sendLead, IDEA_HANDLER_URL } from './lead.js?v=36466a3';

// Le titre, puis la description après une ligne vide quand le visiteur en a écrit une, sans libellé.
export function ideaText(title, text) {
  var out = title.slice(0, 120);
  return text ? out + '\n\n' + text.slice(0, 2000) : out;
}

function setError(msg) { el('ideaErr').textContent = msg; }

function open() {
  var dlg = el('ideaDialog');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var p = getProfile();
  if (!el('ideaName').value) el('ideaName').value = p.prenom;
  if (!el('ideaEmail').value) el('ideaEmail').value = p.email;
  // Prénom et e-mail déjà donnés à l'accueil : ils partent sans être montrés, la mention en pied le dit.
  el('ideaWho').hidden = !!(p.prenom.trim() && isEmail(p.email));
  el('ideaForm').hidden = false;
  el('ideaDone').hidden = true;
  setError('');
  if (!dlg.open) dlg.showModal();
  setTimeout(function() { el('ideaTitle').focus(); }, 0);
}

function submit(e) {
  e.preventDefault();
  var title = el('ideaTitle').value.trim();
  var text = el('ideaText').value.trim();
  var prenom = el('ideaName').value.replace(/\s+/g, ' ').trim();
  var email = el('ideaEmail').value.trim();
  var err = !title ? 'Donnez un titre à votre idée.'
    : !prenom ? 'Indiquez votre prénom.'
    : !isEmail(email) ? 'Cette adresse e-mail semble incomplète, par exemple prenom.nom@entreprise.fr.' : '';
  setError(err);
  if (err) return;
  // Le champ piège rempli trahit un robot : il voit le merci, rien ne part.
  if (el('ideaSite').value) { done(); return; }
  var btn = el('ideaSend');
  btn.disabled = true;
  // Un seul champ `idee` (« Idee proposee » dans Pardot). Jamais en `message`, qui écraserait la Description
  // Salesforce d'un prospect déjà diagnostiqué, et pas de consent : proposer une idée n'abonne à rien.
  sendLead({ prenom: prenom, email: email, idee: ideaText(title, text) }, IDEA_HANDLER_URL).then(function(ok) {
    btn.disabled = false;
    if (!ok) {
      setError('L\'envoi n\'a pas abouti. Vérifiez votre connexion et réessayez.');
      trackEvent('error_atmp', { step: 'idea_send' });
      return;
    }
    trackEvent('idea_submit_atmp', { method: 'sidebar' });
    el('ideaTitle').value = '';
    el('ideaText').value = '';
    done();
  });
}

function done() {
  el('ideaForm').hidden = true;
  el('ideaDone').hidden = false;
  el('ideaDoneClose').focus();
}

export function initIdea() {
  var btn = el('sbIdeaBtn'), dlg = el('ideaDialog');
  if (!btn || !dlg) return;
  if (!IDEA_HANDLER_URL || isDemo()) return;
  btn.hidden = false;
  btn.addEventListener('click', open);
  el('ideaClose').addEventListener('click', function() { dlg.close(); });
  el('ideaDoneClose').addEventListener('click', function() { dlg.close(); });
  dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
  el('ideaForm').addEventListener('submit', submit);
}
