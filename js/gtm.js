// Chargé en synchrone en tête de index.html et app.html, avant tout autre script.
// Charge le conteneur Google Tag Manager du site, qui porte le bandeau CookieScript, GA4 et Clarity.
// Le consentement est géré dans le conteneur (Consent Mode v2, tout refusé par défaut) : ce fichier
// ne dépose rien lui-même. Ses hôtes sont listés dans la CSP des deux pages et sur cookies.html.
(function () {
  var GTM_ID = 'GTM-KC5XLKJ2';
  if (!GTM_ID) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
  // Bloqué (bloqueur de publicité) : pas de bandeau à attendre, l'accueil de l'outil s'ouvre aussitôt.
  s.onerror = function () { window.gtmBlocked = true; window.dispatchEvent(new Event('gtmblocked')); };
  document.head.appendChild(s);

  // « Gérer les cookies » rouvre le bandeau. Sans bandeau chargé, le lien mène à cookies.html.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (!a || !window.CookieScript || !window.CookieScript.instance) return;
    e.preventDefault();
    window.CookieScript.instance.show();
  });
})();
