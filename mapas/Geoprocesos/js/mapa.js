'use strict';

/* =====================================================================
   GEOPROCESOS · visualizador de la herramienta de geoprocesos
   ---------------------------------------------------------------------
   Mapa 2D/3D con las capas base del IGN y tres capas vectoriales de
   ejemplo para que la pestaña Vector del plugin `ext/geoprocesos` tenga
   con qué trabajar desde el primer momento:

     · Distritos de Madrid  → polígonos (buffer, dissolve, área, centroide…)
     · Puntos de interés    → puntos   (voronoi, nearestPoint, isobands…)
     · Ruta de ejemplo      → línea    (along, length, buffer, simplify…)

   Cada capa tiene UN solo tipo de geometría a propósito: mezclar puntos,
   líneas y polígonos en la misma capa rompe algunas exportaciones de
   gdal3.js (Shapefile, CSV) y no aporta nada a los geoprocesos.

   `cambioImpl` vuelve a llamar a `mapa()` al alternar 2D/3D, así que la
   función tiene que crear el mapa y TODAS las capas desde cero cada vez,
   sin fiarse de nada de la ejecución anterior.
   ===================================================================== */

/* Variables globales de la configuración de capas base. Se declaran aquí
   porque este fichero va en modo estricto y `updateConfigBaseLayer()` las
   asigna sin `var`. */
var Base_IGNBaseTodo_TMS_2;
var tms_2;

const SVGCarga = document.getElementById('cargaSVG');
window.onload = function () {
  if (SVGCarga) SVGCarga.hidden = true;
};

/**
 * Arranque del visualizador. Es también la función que `cambioImpl` vuelve
 * a ejecutar tras recargar el bundle de la API.
 * @returns {Object} El mapa de la API.
 */
function mapa() {
  if (SVGCarga) SVGCarga.hidden = false;
  updateConfigBaseLayer();

  const mapajs = M.map({
    container: 'mapaID',
    zoom: 11,
    center: { x: -408000, y: 4925000 },
    layers: [],
  });
  // Los scripts de los pasos y la consola trabajan con `window.mapajs`.
  window.mapajs = mapajs;

  anadirCapasEjemplo(mapajs);

  /* ── Plugins ──────────────────────────────────────────────────────── */

  mapajs.addPlugin(new M.plugin.miPlugin_cambioImpl({
    buttonTitle: 'Cambiar implementación',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true,
  }));

  // GeoTIFF en 3D: la pestaña Ráster añade capas IDEE.layer.GeoTIFF y el
  // bundle de Cesium no trae su implementación. En 2D no hace nada.
  if (M.plugin.miPlugin_geotiffLayer) {
    mapajs.addPlugin(new M.plugin.miPlugin_geotiffLayer());
  }

  mapajs.addPlugin(new M.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new M.plugin.miPlugin_layerSwitcher());

  // La herramienta, en la esquina superior izquierda: las capas y sus
  // grupos viven en la derecha y la escala/atribuciones abajo.
  // Colores del panel (color1 = fondo, color2 = borde/acento, color3 = icono y
  // texto), en naranja como el resto de la barra de herramientas del mapa.
  mapajs.addPlugin(new M.plugin.miPlugin_geoprocesos({
    position: 'TL',
    collapsed: true,
    collapsible: true,
    color1: { active: '#ffffff', deactive: 'orangered' },
    color2: { active: 'orangered', deactive: '#ffffff' },
    color3: { active: 'orangered', deactive: '#ffffff' },
  }));

  if (SVGCarga) SVGCarga.hidden = true;
  return mapajs;
}

/**
 * Añade las capas vectoriales de ejemplo al mapa.
 * @param {Object} mapajs Mapa de la API.
 */
function anadirCapasEjemplo(mapajs) {
  // ── Polígonos: distritos de Madrid (GeoJSON local del repositorio) ──
  mapajs.addLayers(new M.layer.GeoJSON({
    name: 'DistritosMadrid',
    legend: 'Distritos de Madrid',
    url: '../../datos/madrid_distritos.geojson',
    extract: true,
  }, {
    style: new M.style.Generic({
      polygon: {
        fill: { color: '#71A7D3', opacity: 0.25 },
        stroke: { color: '#2b6a9b', width: 1.5 },
      },
    }),
  }, {}));

  // ── Puntos: ocho sitios de Madrid, en EPSG:4326 ─────────────────────
  const puntos = {
    type: 'FeatureCollection',
    features: [
      ['Puerta del Sol', -3.70379, 40.41678],
      ['Plaza Mayor', -3.70745, 40.41551],
      ['Palacio Real', -3.71431, 40.41795],
      ['Museo del Prado', -3.69283, 40.41379],
      ['Parque del Retiro', -3.68443, 40.41526],
      ['Templo de Debod', -3.71779, 40.42402],
      ['Santiago Bernabéu', -3.68835, 40.45306],
      ['Estadio Metropolitano', -3.59947, 40.43620],
    ].map(function (p, i) {
      return {
        type: 'Feature',
        properties: { id: i + 1, nombre: p[0] },
        geometry: { type: 'Point', coordinates: [p[1], p[2]] },
      };
    }),
  };

  mapajs.addLayers(new M.layer.GeoJSON({
    name: 'PuntosInteres',
    legend: 'Puntos de interés',
    source: puntos,
    extract: true,
  }, {
    style: new M.style.Generic({
      point: {
        radius: 6,
        fill: { color: '#e8590c', opacity: 0.9 },
        stroke: { color: '#ffffff', width: 2 },
      },
    }),
  }, {}));

  // ── Línea: un recorrido de ejemplo por el centro ────────────────────
  const ruta = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { nombre: 'Ruta de ejemplo', distancia_km: 4.8 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-3.71431, 40.41795], // Palacio Real
          [-3.70745, 40.41551], // Plaza Mayor
          [-3.70379, 40.41678], // Puerta del Sol
          [-3.69283, 40.41379], // Museo del Prado
          [-3.68443, 40.41526], // Retiro
        ],
      },
    }],
  };

  mapajs.addLayers(new M.layer.GeoJSON({
    name: 'RutaEjemplo',
    legend: 'Ruta de ejemplo',
    source: ruta,
    extract: true,
  }, {
    style: new M.style.Generic({
      line: {
        stroke: { color: '#7048e8', width: 4 },
      },
    }),
  }, {}));
}

/* =====================================================================
   Configuración de las capas base
   ---------------------------------------------------------------------
   Se registra el TMS del IGN como capa rápida y se dejan dos fondos en el
   selector: callejero (IGNBaseTodo) e imagen (PNOA). `miPlugin_baseLayer`
   los pinta con estas miniaturas.
   ===================================================================== */
function updateConfigBaseLayer() {
  Base_IGNBaseTodo_TMS_2 = new M.layer.TMS({
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

  M.addQuickLayers({
    Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2,
  });

  tms_2 = {
    base: 'QUICK*Base_IGNBaseTodo_TMS_2',
  };

  M.config('tms', tms_2);

  M.config.backgroundlayers = [
    {
      id: 'mapa',
      title: 'Callejero',
      imgPreview: 'img/IGNBase.png',
      layers: ['QUICK*Base_IGNBaseTodo_TMS_2'],
    },
    {
      id: 'imagen',
      title: 'Imagen',
      imgPreview: 'img/imagen.png',
      layers: ['QUICK*BASE_PNOA_MA_TMS'],
    },
  ];

  M.proxy(false);
}

mapa();
