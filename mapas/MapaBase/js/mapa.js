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
  // Cada entrada incluye imgPreview para el selector visual. Las miniaturas
  // son imágenes LOCALES del visualizador (carpeta img/), relativas a la
  // página index.html.
  IDEE.config.backgroundlayers = [
    {
      id: "mapa",
      title: "Callejero",
      imgPreview: "img/IGNBase.png",
      layers: ["QUICK*BASE_MapaBase_IGNBaseTodo_WMTS"],
    },
    {
      id: "imagen",
      title: "Imagen",
      imgPreview: "img/imagen.png",
      layers: ["QUICK*BASE_PNOA_MA_TMS"],
    },
    {
      id: "hibrido",
      title: "Híbrido",
      imgPreview: "img/hibrido.png",
      // Grupo de capas oficial = ortofoto PNOA + nomenclátor IGNBaseOrto.
      layers: ["QUICK*BASE_HIBRIDO_LayerGroup"],
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
    // 3 filas → 2 columnas de miniaturas grandes (texto legible al pie).
    rows: 3,
    noBaseLayer: true,
    title: "Capas base",
    // Capa base activa al iniciar. Puede ser el id ("imagen") o la
    // posición (0 = primera capa base; la última es "sin mapa base").
    initActiveLayer: "imagen",
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
