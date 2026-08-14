/* =====================================================================
   Visualizador de Estereoscopía
   --------------------------------------------------------------------
   Sigue el patrón del resto de "mapas": define mapa() (OpenLayers) y
   mapa2() (Cesium), y usa el plugin miPlugin_cambioImpl para alternar
   entre ambas implementaciones (igual que GJSONdesdeURL).

   La funcionalidad de estereoscopía (anaglifo / vista partida) la aporta
   el plugin miPlugin_estereoscopia, que se añade al mapa en ambas
   implementaciones y detecta por sí mismo cuál está activa (OL o Cesium)
   para activar el motor correspondiente.

   Arranca en OpenLayers; el botón del plugin cambioImpl (🌐, arriba a la
   izquierda) pasa a Cesium 3D y viceversa.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = (event) => {
  SVGCarga.hidden = true;
};

// Configura las capas base (callejero + imagen) para ambas implementaciones.
// crossOrigin:'anonymous' es imprescindible: el motor OL captura el canvas del
// mapa como textura WebGL y sin CORS el canvas quedaría "tainted".
function updateConfigBaseLayer() {
  const Base_IGNBaseTodo_TMS_2 = new IDEE.layer.TMS({
    url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
    legend: 'IGNBaseTodo_2',
    visible: true,
    isBase: true,
    tileGridMaxZoom: 17,
    name: 'IGNBaseTodo_2',
    attribution: '<p><b>Mapa base</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>',
  }, {
    crossOrigin: 'anonymous',
    displayInLayerSwitcher: false,
  });

  IDEE.addQuickLayers({
    Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2
  });

  const tms_2 = {
    "base": "QUICK*Base_IGNBaseTodo_TMS_2"
  };

  IDEE.config("tms", tms_2);
  IDEE.config.backgroundlayers = [
    {
      "id": "mapa",
      "title": "Callejero",
      "layers": ["QUICK*Base_IGNBaseTodo_TMS_2"]
    },
    {
      "id": "imagen",
      "title": "Imagen",
      "layers": ["QUICK*BASE_PNOA_MA_TMS"]
    }
  ];

  IDEE.proxy(false);
  return;
}

// Implementación OpenLayers (2D + estereoscopía sintética por shader).
function mapa() {
  SVGCarga.hidden = false;

  updateConfigBaseLayer();

  mapajs = IDEE.map({
    container: "mapaDIV"
  });

  mapajs.addAttribution({
    name: "Autor:",
    description: " <a style='color: #0000FF' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
  });

  // Encuadre inicial sobre los Pirineos (zona con relieve para apreciar la
  // estereoscopía). El center/zoom del constructor IDEE.map lo ignora esta API,
  // así que lo fijamos tras COMPLETED reproyectando de lon/lat a la proyección
  // del mapa.
  encuadreInicial(mapajs);

  // Plugin de cambio de implementación (OL <-> Cesium).
  mapajs.addPlugin(pluginCambioImplFunc());
  // Plugin de estereoscopía (detecta OL y activa su motor).
  mapajs.addPlugin(pluginEstereoscopiaFunc());

  SVGCarga.hidden = true;
  return mapajs;
}

// Fija el encuadre inicial sobre los Pirineos una vez el mapa está listo.
function encuadreInicial(m) {
  const aplicar = function () {
    try {
      const impl = m.getMapImpl();
      // Implementación OpenLayers: reproyecta lon/lat a la proyección del mapa.
      if (impl && typeof impl.getView === "function") {
        const v = impl.getView();
        const c = window.ol.proj.fromLonLat([0.65, 42.55], v.getProjection().getCode());
        v.setCenter(c);
        v.setZoom(11);
      }
    } catch (e) { /* si falla, se queda con la vista por defecto */ }
  };
  try { m.on(IDEE.evt.COMPLETED, aplicar); } catch (e) {}
  // Reintento por si COMPLETED ya se disparó.
  setTimeout(aplicar, 1500);
}

// Implementación Cesium (relieve 3D real + estereoscopía nativa).
function mapa2() {
  SVGCarga.hidden = false;

  updateConfigBaseLayer();

  mapajs2 = IDEE.map({
    container: "mapaDIV"
  });

  mapajs2.addPlugin(pluginCambioImplFunc());
  mapajs2.addPlugin(pluginEstereoscopiaFunc());

  SVGCarga.hidden = true;
  return mapajs2;
}

// Definición de funciones de extensiones
function pluginCambioImplFunc() {
  return new miPlugin_cambioImpl({
    buttonTitle: 'Cambiar implementación (2D/3D)',
    mapsFunction: { same: mapa, ol: mapa, Cesium: mapa2 },
    sameMap: false,
    shareView: true,
    shareLayers: false
  });
}

function pluginEstereoscopiaFunc() {
  // Usamos el global directo (window.miPlugin_estereoscopia) en lugar de
  // IDEE.plugin.miPlugin_estereoscopia: el plugin cambioImpl recarga el bundle
  // de la API al cambiar de implementación y reinicializa IDEE.plugin, borrando
  // el registro dentro del namespace. El global directo persiste.
  return new miPlugin_estereoscopia();
}

// Arranque: implementación OpenLayers.
mapajs_0 = mapa();
