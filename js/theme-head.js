// Thème sombre appliqué avant le premier rendu : js/nav.js (module différé) arrive trop tard
// et laisserait un éclair clair. Même clé que nav.js. Sans choix enregistré, la préférence du système décide.
try {
  var saved = localStorage.getItem('sinistralite-theme');
  if (saved === 'dark' || (saved !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch (e) {}
