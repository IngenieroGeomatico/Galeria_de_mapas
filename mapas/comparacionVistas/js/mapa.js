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

   El mapa principal es el del VISUALIZADOR, y el comparador trabaja sobre él:
   aquí no se declara ninguna vista, así que al abrir su barra las deriva de
   este mapa (implementación, encuadre y capas; ver _capturarMapaVivo en el
   plugin). Lo que se compara es el mapa del visualizador, no una copia escrita
   a mano. El comparador toma el control del área y sus iframes la cubren.

   ── Configuración externa por URL ─────────────────────────────────────
   El parámetro GET "configViewsJSON" permite pasar la URL de un JSON con
   la configuración del comparador (vistas, modo, layout, etc.), de forma
   que el mismo visualizador pueda cargarse con distintas configuraciones
   sin tocar el código. Ejemplo:

     index.html?configViewsJSON=./config-ejemplo.json
     index.html?configViewsJSON=https://mi-servidor/mi-config.json

   El JSON tiene la misma estructura que el objeto options del constructor
   de miPlugin_comparacionVistas. Si el parámetro no está presente se usa
   la configuración por defecto embebida en este fichero.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
// Configuración con la que arrancó el visualizador (ver iniciar()).
var CONFIG_ARRANQUE = null;
window.onload = (event) => {
  SVGCarga.hidden = true;
};

// ── Configuración por defecto (embebida) ────────────────────────────
function configPorDefecto() {
  // SIN vistas: se derivan del mapa del visualizador (ver _capturarMapaVivo).
  // El reparto lo pone `layout` (espejo de 1x2) y cada celda lleva un motor
  // distinto: el del mapa y el otro, que es lo que se quiere comparar.
  return {
    id: 'comparador-principal',
    mode: 'mirror',
    layout: { type: 'grid', rows: 1, cols: 2 },
    sync: true,
    showControls: true,
  };
}

// ── Rehidratación de capas del JSON ─────────────────────────────────
// El JSON no puede contener `new IDEE.layer.WMS(...)`, sólo objetos planos
// { type: "WMS", params: { url, name, ... } }. Esta función recorre las
// vistas y sustituye cada definición plana por el objeto IDEE.layer.*
// correspondiente, de modo que el constructor del comparador reciba
// instancias reales — igual que cuando se hardcodean en JS.
function rehidratarCapas(config) {
  if (!config || !Array.isArray(config.views)) return config;
  config.views.forEach(function (v) {
    if (!Array.isArray(v.layers)) return;
    v.layers = v.layers.map(function (l) {
      // String → se deja tal cual (el plugin ya lo acepta).
      if (typeof l === "string") return l;
      // Objeto plano { type, params } → instanciar IDEE.layer.<type>(params).
      if (l && typeof l.type === "string" && l.params) {
        var Ctor = IDEE.layer[l.type];
        if (typeof Ctor === "function") {
          try { return new Ctor(l.params); } catch (e) {
            console.warn("[configViewsJSON] No se pudo crear IDEE.layer." + l.type + ":", e);
          }
        }
      }
      // Cualquier otro formato → se pasa tal cual al plugin.
      return l;
    });
  });
  return config;
}

// ── Arranque con configuración (embebida o remota) ──────────────────
//   La configuración del arranque se recuerda en CONFIG_ARRANQUE: al cambiar
//   2D/3D, miPlugin_cambioImpl con `sameMap: true` vuelve a llamar a iniciar()
//   SIN argumentos, y sin esto `config.icon` reventaba ("Cannot read properties
//   of undefined (reading 'icon')") antes de añadir el comparador, el propio
//   cambio de implementación y el resto de plugins, así que el mapa se quedaba
//   a medias: en Cesium y sin ninguna herramienta (medido: tras pulsar el botón
//   del cambio, getPlugins() devolvía [] y no había ni botón del cambio).
function iniciar(config) {
  if (config) CONFIG_ARRANQUE = config;
  config = CONFIG_ARRANQUE || configPorDefecto();
  SVGCarga.hidden = false;

  // Mapa del visualizador. El centro y el zoom son suyos, y sus capas son las
  // que hereda el comparador: al abrir la barra, las vistas se derivan de
  // aquí. La base es la de por defecto de la API (callejero IGN) y el overlay
  // es el de barrios, que también viaje a cada vista.
  mapajs = IDEE.map({
    container: "mapaDIV",
    center: { x: -411882.1, y: 4927164.5 },  // Madrid
    zoom: 12,
  });
  mapajs.addLayers([
    new IDEE.layer.GeoJSON({
      name: 'Barrios de Madrid',
      url: '../../datos/madrid_barrios.geojson',
      legend: 'Barrios (GeoJSON)',
    }),
  ]);

  // El comparador se anade al mapa: lo que sale en el area es su boton, y al
  // pulsarlo se esconde y aparece su barra. El icono es una opcion de
  // construccion; si el config remoto no trae una, se pone la de serie.
  if (!config.icon) config.icon = '../../img/iconos/compare-map.svg';

  const comparador = new IDEE.plugin.miPlugin_comparacionVistas(config);
  mapajs.addPlugin(comparador);

  mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    mapsFunction: iniciar,
    sameMap: true,
    shareView: true,
    shareLayers: true
  }));
  mapajs.addPlugin(new IDEE.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());

  SVGCarga.hidden = true;
  return mapajs;
}

// ── Lectura del parámetro GET y arranque ─────────────────────────────
(function () {
  var params = new URLSearchParams(location.search);
  var jsonUrl = params.get('configViewsJSON');

  if (!jsonUrl) {
    // Sin parámetro: usar la configuración por defecto embebida.
    mapajs_0 = iniciar(configPorDefecto());
    return;
  }

  // Con parámetro: cargar el JSON externo.
  SVGCarga.hidden = false;
  fetch(jsonUrl)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' al cargar ' + jsonUrl);
      return res.json();
    })
    .then(function (config) {
      // Asegurar un id si el JSON no lo trae.
      if (!config.id) config.id = 'comparador-principal';
      // Convertir { type, params } → new IDEE.layer.<type>(params).
      rehidratarCapas(config);
      mapajs_0 = iniciar(config);
    })
    .catch(function (err) {
      console.error('[comparacionVistas] Error al cargar configViewsJSON:', err);
      // Fallback: arrancar con la configuración por defecto.
      mapajs_0 = iniciar(configPorDefecto());
    });
})();
