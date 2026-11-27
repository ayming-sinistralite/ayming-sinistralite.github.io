// ── « Parler à un consultant » : la fenêtre de demande de contact ──
// Les liens marqués data-consult (menu latéral, barre du haut) mènent à la page Contactez-nous RH
// d'ayming.fr. Dans l'outil, un clic ouvre plutôt cette fenêtre, prénom et e-mail repris de l'accueil,
// et la demande part vers le form handler Pardot du consultant (CONSULT_HANDLER_URL dans lead.js),
// copie de celui du site : mêmes noms de champs, même alerte à l'équipe RH. Sans handler, ou en démo,
// le lien garde sa page. Ce qui part est écrit dans la FAQ « Mes données sont-elles enregistrées ».

import { el, trackEvent, isEmail } from './utils.js?v=36466a3';
import { isDemo, currentRoute } from './route.js?v=36466a3';
import { getProfile } from './profile.js?v=36466a3';
import { sendLead, bindCompany, CONSULT_HANDLER_URL } from './lead.js?v=36466a3';

// Le message commence toujours par sa provenance, pour l'équipe RH qui le lit.
export var CONSULT_PREFIX = 'Demande de contact depuis l\'application Sinistralité';
export function consultMessage(text) {
  var t = (text || '').trim().slice(0, 2000);
  return t ? CONSULT_PREFIX + '\n\n' + t : CONSULT_PREFIX;
}

// La société se choisit dans la liste, comme sur ayming.fr (balise GTM 302) : elle apporte son SIRET
// et le code postal de son siège, que Salesforce utilise pour enrichir la piste, et le formulaire ne
// les demande jamais. Seuls « Je ne trouve pas mon entreprise » ou une recherche revenue vide
// (société absente, annuaire muet) laissent partir le nom tapé, sans SIRET ni code postal, que le
// handler n'exige pas.
var picked = { siret: '', cp: '', none: false };

function setError(msg) { el('consultErr').textContent = msg; }
function val(id) { return el(id).value.replace(/\s+/g, ' ').trim(); }

function open(e) {
  var dlg = el('consultDialog');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  e.preventDefault();
  var p = getProfile();
  if (!el('consultFirst').value) el('consultFirst').value = p.prenom;
  if (!el('consultLast').value) el('consultLast').value = p.nom;
  if (!el('consultEmail').value) el('consultEmail').value = p.email;
  el('consultForm').hidden = false;
  el('consultDone').hidden = true;
  setError('');
  if (!dlg.open) dlg.showModal();
  var first = ['consultFirst', 'consultLast', 'consultEmail', 'consultPhone', 'consultCompany']
    .filter(function(id) { return !el(id).value; })[0] || 'consultText';
  setTimeout(function() { el(first).focus(); }, 0);
  trackEvent('consult_open_atmp', { method: e.currentTarget.classList.contains('sb-consult') ? 'sidebar' : 'topbar' });
}

function submit(e) {
  e.preventDefault();
  var f = {
    prenom: val('consultFirst'), nom: val('consultLast'), email: el('consultEmail').value.trim(),
    telephone: val('consultPhone'), societe: val('consultCompany')
  };
  var err = !f.prenom ? 'Indiquez votre prénom.'
    : !f.nom ? 'Indiquez votre nom.'
    : !isEmail(f.email) ? 'Cette adresse e-mail semble incomplète, par exemple prenom.nom@entreprise.fr.'
    : (f.telephone.replace(/\D/g, '').length < 9) ? 'Indiquez un numéro de téléphone complet.'
    : !f.societe ? 'Indiquez votre société.'
    : !picked.cp && !picked.none ? 'Choisissez votre société dans la liste, ou « Je ne trouve pas mon entreprise » si elle n\'y figure pas.' : '';
  f.siret = picked.siret;
  f.cp = picked.cp;
  setError(err);
  if (err) return;
  // Le champ piège rempli trahit un robot : il voit le merci, rien ne part.
  if (el('consultSite').value) { done(); return; }
  f.message = consultMessage(el('consultText').value);
  // Case cochée : consent=true. Décochée : aucun consent, pour que Pardot garde l'accord déjà donné
  // à l'accueil ou sur ayming.fr (un false l'effaçait). sendLead laisse tomber les champs vides.
  f.consent = el('consultOptin').checked ? 'true' : '';
  // Le secteur affiché, sinon celui donné à l'accueil, et l'adresse de la page, sans sa requête (UTM).
  f.secteur = currentRoute().code || getProfile().sector || '';
  f.page = location.origin + location.pathname;
  var btn = el('consultSend');
  btn.disabled = true;
  // La réponse de Pardot est opaque et n'apprend rien de plus : passé 1,5 s sans refus du réseau,
  // la demande est partie et la confirmation s'affiche sans attendre la fin de l'échange.
  Promise.race([
    sendLead(f, CONSULT_HANDLER_URL),
    new Promise(function(ok) { setTimeout(function() { ok(true); }, 1500); })
  ]).then(function(ok) {
    btn.disabled = false;
    if (!ok) {
      setError('L\'envoi n\'a pas abouti. Vérifiez votre connexion et réessayez.');
      trackEvent('error_atmp', { step: 'consult_send' });
      return;
    }
    trackEvent('generate_lead', { method: 'consult' });
    el('consultText').value = '';
    done();
  });
}

function done() {
  el('consultForm').hidden = true;
  el('consultDone').hidden = false;
  el('consultDoneClose').focus();
}

export function initConsult() {
  var dlg = el('consultDialog');
  if (!dlg || !CONSULT_HANDLER_URL || isDemo()) return;
  document.querySelectorAll('[data-consult]').forEach(function(a) { a.addEventListener('click', open); });
  el('consultClose').addEventListener('click', function() { dlg.close(); });
  el('consultDoneClose').addEventListener('click', function() { dlg.close(); });
  dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
  bindCompany(el('consultCompany'), el('consultCompanyAc'), function(siret, cp) {
    picked.siret = siret || '';
    picked.cp = cp || '';
  }, 'Entreprise introuvable, votre demande partira avec ce nom.',
  function(none) { picked.none = none; });
  el('consultForm').addEventListener('submit', submit);
}
