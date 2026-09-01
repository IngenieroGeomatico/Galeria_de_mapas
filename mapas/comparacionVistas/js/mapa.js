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
window.onload = (event) => {
  SVGCarga.hidden = true;
};

// ── Configuración por defecto (embebida) ────────────────────────────
function configPorDefecto() {
  return {
    id: 'comparador-principal',
    mode: 'mirror',
    layout: { type: 'grid', rows: 1, cols: 2 },
    sync: true,
    showControls: true,
    views: [
      {
        name: 'Callejero 2D',
        implementation: '2D',
        center: [-3.70, 40.42],
        zoom: 12,
        isPrimary: true,
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
function iniciar(config) {
  SVGCarga.hidden = false;

  // Mapa anfitrión mínimo (no se ve: el comparador cubre el área con iframes).
  mapajs = IDEE.map({ container: "mapaDIV" });

  // Supraplugin (barra) con el comparador de vistas dentro.
  const supra = new miPlugin_supraplugin({
    id: 'supra-comparacion',
    position: 'top',
    title: 'Comparación de vistas',
  });

  const comparador = new miPlugin_comparacionVistas(config);
  supra.addItem(comparador);
  mapajs.addPlugin(supra);

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
