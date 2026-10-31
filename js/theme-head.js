// Thème sombre appliqué avant le premier rendu : js/nav.js (module différé) arrive trop tard
// et laisserait un éclair clair. Même clé que nav.js.
try {
  if (localStorage.getItem('sinistralite-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
} catch (e) {}
