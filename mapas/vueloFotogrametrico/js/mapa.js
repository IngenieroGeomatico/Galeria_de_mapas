/* =====================================================================
   Visualizador de Vuelo Fotogramétrico
   --------------------------------------------------------------------
   Sigue el patrón del resto de "mapas": define mapa() (OpenLayers) y
   mapa2() (Cesium), y usa el plugin miPlugin_cambioImpl para alternar
   entre ambas implementaciones (2D / 3D).

   La funcionalidad de importación y visualización de vuelos la aporta el
   plugin miPlugin_vueloFotogrametrico, que se añade al mapa en ambas
   implementaciones y detecta por sí mismo cuál está activa (OL o Cesium).

   Arranca en OpenLayers; el botón del plugin cambioImpl (arriba a la
   izquierda) pasa a Cesium 3D y viceversa.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = (event) => {
  SVGCarga.hidden = true;
};

// Configura las capas base (callejero + imagen) para ambas implementaciones.
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

// Implementación OpenLayers (2D).
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

  // Encuadre inicial sobre España peninsular.
  encuadreInicial(mapajs);

  // Plugin de cambio de implementación (OL <-> Cesium).
  mapajs.addPlugin(pluginCambioImplFunc());
  // Plugin de vuelo fotogramétrico (detecta OL y activa su motor).
  mapajs.addPlugin(pluginVueloFotogrametricoFunc());

  SVGCarga.hidden = true;
  return mapajs;
}

// Fija el encuadre inicial (España peninsular) SOLO cuando no hay datos de vuelo
// cargados. Actúa como respaldo para el arranque en frío; si ya hay datos
// importados (p.ej. al volver de Cesium a OL), NO toca la vista: de eso se
// encargan cambioImpl (shareView) y el zoomToData del plugin de vuelo. Así se
// evita que este encuadre machaque la vista compartida en cada swap.
function encuadreInicial(m) {
  // Si ya hay un vuelo importado, respeta la vista (shareView / zoomToData).
  const hayDatos = !!(window.__vueloSharedData && window.__vueloSharedData.rows &&
    window.__vueloSharedData.rows.length);
  if (hayDatos) return;

  const aplicar = function () {
    // Reevalúa por si los datos llegaron entre el registro y el disparo.
    const hayDatosAhora = !!(window.__vueloSharedData && window.__vueloSharedData.rows &&
      window.__vueloSharedData.rows.length);
    if (hayDatosAhora) return;
    try {
      const impl = m.getMapImpl();
      // Implementación OpenLayers: reproyecta lon/lat a la proyección del mapa.
      if (impl && typeof impl.getView === "function") {
        const v = impl.getView();
        const c = window.ol.proj.fromLonLat([-3.7, 40.4], v.getProjection().getCode());
        v.setCenter(c);
        v.setZoom(6);
      }
    } catch (e) { /* si falla, se queda con la vista por defecto */ }
  };
  try { m.on(IDEE.evt.COMPLETED, aplicar); } catch (e) {}
}

// Implementación Cesium (3D real).
function mapa2() {
  SVGCarga.hidden = false;

  updateConfigBaseLayer();

  mapajs2 = IDEE.map({
    container: "mapaDIV"
  });

  mapajs2.addPlugin(pluginCambioImplFunc());
  mapajs2.addPlugin(pluginVueloFotogrametricoFunc());

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

function pluginVueloFotogrametricoFunc() {
  // Usamos el global directo (window.miPlugin_vueloFotogrametrico): el plugin
  // cambioImpl recarga el bundle de la API al cambiar de implementación y
  // reinicializa IDEE.plugin, borrando el registro dentro del namespace. El
  // global directo persiste.
  return new miPlugin_vueloFotogrametrico();
}

// Arranque: implementación OpenLayers.
mapajs_0 = mapa();
