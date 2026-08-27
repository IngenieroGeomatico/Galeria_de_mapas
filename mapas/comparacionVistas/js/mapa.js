/* =====================================================================
   Visualizador de Comparación de vistas
   --------------------------------------------------------------------
   La funcionalidad de comparación la aporta miPlugin_comparacionVistas,
   un item de un SUPRAPLUGIN (miPlugin_supraplugin): una barra transversal
   situada sobre el visualizador.

   CADA VISTA ES UN <iframe> cuyo documento genera dinámicamente el propio
   plugin (srcdoc): carga la API-IDEE en 2D (OpenLayers) o 3D (Cesium) de forma
   independiente. Así pueden coexistir una vista 2D y otra 3D a la vez —cosa
   imposible en un mismo documento, porque la API usa un único objeto global
   `IDEE` ligado a un solo bundle—. La sincronización de encuadre entre vistas
   se hace por postMessage. El plugin es AUTOCONTENIDO: ya no hay vista.html /
   vista.js (el código de la vista vive dentro de comparacionVistas.js).

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

  // Ejemplo del constructor ampliado: arranca en una configuración concreta
  // (modo espejo 1×2), con dos vistas de config propia —una 2D y otra 3D— y una
  // capa WMS de ejemplo en la vista principal (se clona al pulsar "Crear").
  // Se pueden pasar objetos IDEE.layer.* / IDEE.plugin.*: el comparador los
  // serializa y los reconstruye dentro de cada iframe (no se admiten IDEE.map).
  const comparador = new miPlugin_comparacionVistas({
    id: 'comparador-principal',

    // Configuración de comparación inicial.
    mode: 'mirror',
    layout: { type: 'grid', rows: 1, cols: 2 },
    sync: true,
    showControls: true,

    // Vistas iniciales, cada una con su propia configuración de mapa.
    views: [
      {
        name: 'Callejero 2D',
        implementation: '2D',
        center: [-3.70, 40.42],
        zoom: 12,
        isPrimary: true,
        // Objeto IDEE.layer: se serializa y se recrea dentro del iframe.
        // GeoJSON local del repo (sin CORS) con los barrios de Madrid.
        layers: [
          new IDEE.layer.GeoJSON({
            name: 'Barrios de Madrid',
            url: '../../datos/madrid_barrios.geojson',
            legend: 'Barrios (GeoJSON)',
          }),
        ],
      },
      {
        name: 'Relieve 3D',
        implementation: '3D',
        center: { lon: -3.70, lat: 40.42 },
        zoom: 12,
      },
    ],
  });

  supra.addItem(comparador);
  mapajs.addPlugin(supra);

  SVGCarga.hidden = true;
  return mapajs;
}

// Arranque.
mapajs_0 = mapa();
