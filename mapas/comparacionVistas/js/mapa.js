/* =====================================================================
   Visualizador de Comparación de vistas
   --------------------------------------------------------------------
   La funcionalidad de comparación la aporta miPlugin_comparacionVistas,
   un item de un SUPRAPLUGIN (miPlugin_supraplugin): una barra transversal
   situada sobre el visualizador.

   CADA VISTA ES UN <iframe> (mapas/comparacionVistas/vista.html) que carga
   la API-IDEE en 2D (OpenLayers) o 3D (Cesium) de forma independiente. Así
   pueden coexistir una vista 2D y otra 3D a la vez —cosa imposible en un
   mismo documento, porque la API usa un único objeto global `IDEE` ligado a
   un solo bundle—. La sincronización de encuadre entre vistas se hace por
   postMessage (ver js/vista.js y el plugin comparacionVistas).

   El mapa principal aquí es mínimo: sólo sirve de anfitrión para añadir el
   supraplugin (barra). El área del visualizador la ocupan los iframes de las
   vistas gestionados por el comparador.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = (event) => {
  SVGCarga.hidden = true;
};

function mapa() {
  SVGCarga.hidden = false;

  // Mapa anfitrión mínimo (no se ve: el comparador cubre el área con iframes).
  mapajs = IDEE.map({ container: "mapaDIV" });

  // Supraplugin (barra) con el comparador de vistas dentro.
  const supra = new miPlugin_supraplugin({
    id: 'supra-comparacion',
    position: 'top',
    title: 'Comparación de vistas',
  });

  const comparador = new miPlugin_comparacionVistas({
    id: 'comparador-principal',
    vistaUrl: './vista.html',
    lon: -3.70,
    lat: 40.42,
    zoom: 12,
  });

  supra.addItem(comparador);
  mapajs.addPlugin(supra);

  SVGCarga.hidden = true;
  return mapajs;
}

// Arranque.
mapajs_0 = mapa();
