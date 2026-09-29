/* =====================================================================
   Visualizador de ejemplo: Plantilla de Supraplugin con Item modelo
   Repositorio: Galeria_de_mapas
   --------------------------------------------------------------------
   Este visualizador demuestra el montaje de una barra supraplugin
   (`miPlugin_supraplugin`) transversal al visualizador cartográfico y
   el acoplamiento de un item modelo (`miPlugin_plantillaItem`) mediante
   `supra.addItem(item)`.

   Incluye además los plugins estándar del repositorio:
   - `miPlugin_cambioImpl`: alternancia entre 2D (OpenLayers) y 3D (Cesium),
     demostrando la preservación de estado de la UI del item mediante
     el contrato `getState` / `setState` coordinado por `window.EstadoPlugins`.
   - `miPlugin_baseLayer`: selector de capas base IGN.
   - `miPlugin_layerSwitcher`: árbol y selector de capas temáticas.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = (event) => {
  SVGCarga.hidden = true;
};

/**
 * Función principal de arranque del mapa y plugins.
 * Se invoca al cargar la página y como callback (`mapsFunction`)
 * al alternar la implementación 2D/3D con `cambioImpl`.
 *
 * @returns {Object} Instancia del mapa API-IDEE creado (`mapajs`).
 */
function iniciar() {
  SVGCarga.hidden = false;

  // 1. Inicialización del mapa API-IDEE anfitrión
  mapajs = IDEE.map({
    container: "mapaDIV"
  });

  // 2. Creación de la barra supraplugin (posición superior con título)
  const supra = new IDEE.plugin.miPlugin_supraplugin({
    id: "supra-plantilla",
    position: "top",
    title: "Plantilla supraplugin"
  });

  // 3. Creación del item modelo y acoplamiento a la barra
  const itemPlantilla = new IDEE.plugin.miPlugin_plantillaItem({
    texto: "Botón de ejemplo",
    vecesPulsado: 0,
    activo: false,
    onClick: function (itemInstancia, evento) {
      console.log("[plantilla_supra] Item pulsado:", itemInstancia.getState());
    }
  });

  supra.addItem(itemPlantilla);

  // 4. Registro del supraplugin en el mapa
  mapajs.addPlugin(supra);

  // 5. Plugins adicionales estándar del repositorio
  mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: "cambiar impl :)",
    mapsFunction: iniciar,
    sameMap: true,
    shareView: true,
    shareLayers: true
  }));

  mapajs.addPlugin(new IDEE.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());

  // 6. Ocultación del indicador de carga
  SVGCarga.hidden = true;

  return mapajs;
}

// Arranque inicial al cargar el script
var mapajs_0 = iniciar();
