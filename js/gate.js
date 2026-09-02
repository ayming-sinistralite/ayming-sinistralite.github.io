// Portail d'accès (niveau 1 : rideau côté client, pas un verrou serveur).
// Le contenu reste techniquement présent dans le DOM et le réseau ; ce gate écarte
// un visiteur ordinaire, il n'empêche pas une inspection technique. Voir CLAUDE.md.
// Le mot de passe n'est PAS stocké en clair : on compare son empreinte SHA-256.
// Pour le changer, demander à Claude de régénérer l'empreinte ci-dessous.
(function () {
  'use strict';
  var STORAGE_KEY = 'sinistralite-gate';
  var PASSWORD_HASH = '5fc3d9d51cf996ac3aace35b937d4a65b5f0ea41bfc6d91c2589b64ec02ed06a';

  var overlay = document.getElementById('gateOverlay');
  if (!overlay) return;

  function unlock() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  var already = false;
  try { already = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}
  if (already) { unlock(); return; }

  function sha256Hex(str) {
    var bytes = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', bytes).then(function (digest) {
      return Array.prototype.map.call(new Uint8Array(digest), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  var input = document.getElementById('gateInput');
  var button = document.getElementById('gateBtn');
  var errorEl = document.getElementById('gateErr');

  function attempt() {
    if (errorEl) errorEl.style.display = 'none';
    sha256Hex(input.value || '').then(function (hex) {
      if (hex === PASSWORD_HASH) {
        unlock();
      } else if (errorEl) {
        errorEl.style.display = 'block';
        input.value = '';
        input.focus();
      }
    });
  }

  if (button) button.addEventListener('click', attempt);
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); attempt(); }
    });
    input.focus();
  }
})();
