/* =====================================================================
   Visualizador base
   ---------------------------------------------------------------------
   Mapa base con los plugins de selección de capas (base + overlay).
   Sirve como plantilla mínima y banco de pruebas de ext/selectorCapas.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = function () { SVGCarga.hidden = true; };

function mapa() {
  SVGCarga.hidden = false;

  // ── Configuración de capas base ───────────────────────────────────
  // Cada entrada incluye imgPreview para el selector visual.
  IDEE.config.backgroundlayers = [
    {
      id: "mapa",
      title: "Callejero",
      imgPreview: "https://componentes.idee.es/api-idee/assets/images/mapa.jpg",
      layers: ["QUICK*BASE_IGNBaseTodo_TMS"],
    },
    {
      id: "imagen",
      title: "Imagen",
      imgPreview: "https://componentes.idee.es/api-idee/assets/images/satelite.jpg",
      layers: ["QUICK*BASE_PNOA_MA_TMS"],
    },
    {
      id: "hibrido",
      title: "Híbrido",
      imgPreview: "https://componentes.idee.es/api-idee/assets/images/hibrido.jpg",
      layers: ["QUICK*BASE_LiDAR_TMS"],
    },
  ];

  IDEE.proxy(false);

  // ── Mapa ──────────────────────────────────────────────────────────
  mapajs = IDEE.map({
    container: "mapaDIV",
    controls: ["scale*true"],
  });

  // ── Plugin selector de capas base (grid de imágenes) ──────────────
  var baseLayerPlugin = new miPlugin_baseLayer({
    rows: 1,
    noBaseLayer: true,
    title: "Capas base",
  });
  mapajs.addPlugin(baseLayerPlugin);

  // ── Plugin selector de capas overlay (checkboxes) ─────────────────
  var layerSwitcherPlugin = new miPlugin_layerSwitcher();
  mapajs.addPlugin(layerSwitcherPlugin);

  SVGCarga.hidden = true;
  return mapajs;
}

// Arranque.
mapajs_0 = mapa();
