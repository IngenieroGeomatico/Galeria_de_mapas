'use strict';

/* =====================================================================
   BIGQUERY — visualizador de demostración
   ---------------------------------------------------------------------
   Mapa 2D/3D con dos plugins:

     - `ext/bigqueryLayer`: login con la cuenta de Google, listado de
       proyectos/datasets/tablas de BigQuery y carga del resultado en el
       mapa (GeoJSON si la tabla tiene geometría, capa alfanumérica si no).
       También carga ficheros locales CSV, JSON y XLSX como capa
       alfanumérica.

     - `ext/alphanumericLayer`: el contenedor de datos sin geometría que
       usa el plugin anterior (`IDEE.layer.Alphanumeric`).

   El OAuth Client ID se puede pasar por la URL, que es lo cómodo para
   probar sin tocar código:

       index.html?clientId=1234567890-xxxx.apps.googleusercontent.com

   Si no se pasa, se lee el que el usuario haya guardado en el panel (se
   persiste en localStorage). El Client ID es público: no hay ninguna
   clave secreta en la página.

   `cambioImpl` vuelve a llamar a `mapa()` al alternar 2D/3D, así que la
   función tiene que crear el mapa y TODAS las capas desde cero cada vez,
   sin fiarse de nada de la ejecución anterior.
   ===================================================================== */

/* Variables globales de la configuración de capas base. Se declaran aquí
   porque este fichero va en modo estricto y `updateConfigBaseLayer()` las
   asigna sin `var`. */
var Base_IGNBaseTodo_TMS_2;
var tms_2;

/** Clave de localStorage donde el plugin guarda el Client ID. */
const LS_CLIENT_ID = 'idee.bigquery.clientId';

const SVGCarga = document.getElementById('cargaSVG');
window.onload = function () {
  if (SVGCarga) SVGCarga.hidden = true;
};

/**
 * Lee el OAuth Client ID de la URL (`?clientId=`) o de localStorage.
 * @returns {string}
 */
function leerClientIdDeLaUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const deUrl = (params.get('clientId') || '').trim();
    if (deUrl) return deUrl;
  } catch (e) { /* navegador antiguo */ }
  try {
    return (window.localStorage.getItem(LS_CLIENT_ID) || '').trim();
  } catch (e) {
    return '';
  }
}

/**
 * Arranque del visualizador. Es también la función que `cambioImpl` vuelve
 * a ejecutar tras recargar el bundle de la API.
 * @returns {Object} El mapa de la API.
 */
function mapa() {
  if (SVGCarga) SVGCarga.hidden = false;
  updateConfigBaseLayer();

  // Tras el cambio 2D/3D la API recrea su espacio de nombres (`IDEE.layer`),
  // así que hay que volver a instalar la capa alfanumérica en el bundle nuevo.
  if (window.AlphanumericLayer && typeof window.AlphanumericLayer.instalar === 'function') {
    window.AlphanumericLayer.instalar();
  }

  const mapajs = M.map({
    container: 'mapaID',
    zoom: 11,
    center: { x: -408000, y: 4925000 },
    layers: [],
  });
  // La consola y los scripts de prueba trabajan con `window.mapajs`.
  window.mapajs = mapajs;

  anadirCapaAlfanumericaDeEjemplo(mapajs);

  /* ---- Plugins ------------------------------------------------------ */

  mapajs.addPlugin(new M.plugin.miPlugin_cambioImpl({
    buttonTitle: 'Cambiar implementación',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true,
  }));

  mapajs.addPlugin(new M.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new M.plugin.miPlugin_layerSwitcher());

  // La herramienta, en la esquina superior izquierda: las capas viven en la
  // derecha y la escala/atribuciones abajo.
  // Colores del panel (color1 = fondo, color2 = borde/acento, color3 = icono
  // y texto), en el azul de Google para distinguirla del resto de la barra.
  mapajs.addPlugin(new M.plugin.miPlugin_bigqueryLayer({
    position: 'TL',
    collapsible: true,
    clientId: leerClientIdDeLaUrl(),
    color1: { active: '#ffffff', deactive: '#1a73e8' },
    color2: { active: '#1a73e8', deactive: '#ffffff' },
    color3: { active: '#1a73e8', deactive: '#ffffff' },
  }));

  if (SVGCarga) SVGCarga.hidden = true;
  return mapajs;
}

/**
 * Añade una capa alfanumérica de ejemplo, sin geometría, para que se vea
 * desde el primer momento qué es una capa de datos y para poder probar
 * `mapajs.getAlphanumericLayers()` sin conectarse a BigQuery.
 * @param {Object} mapajs Mapa de la API.
 */
function anadirCapaAlfanumericaDeEjemplo(mapajs) {
  const AL = window.AlphanumericLayer;
  if (!AL) {
    console.warn('BigQuery: falta ext/alphanumericLayer/alphanumericLayer.js');
    return;
  }
  const csv = [
    'municipio,provincia,poblacion,lat,lon',
    'Madrid,Madrid,3332035,40.4168,-3.7038',
    'Barcelona,Barcelona,1660122,41.3874,2.1686',
    'Valencia,Valencia,807693,39.4699,-0.3763',
    'Sevilla,Sevilla,681998,37.3891,-5.9845',
    'Zaragoza,Zaragoza,681877,41.6488,-0.8891',
  ].join('\n');

  const capa = AL.fromCSV(csv, {
    name: 'Municipios de ejemplo',
    legend: 'Municipios de ejemplo',
    latField: 'lat',
    lonField: 'lon',
    idField: 'municipio',
  });
  capa.addTo(mapajs);
  // Expuesta para las pruebas manuales desde la consola.
  window.capaAlfanumericaEjemplo = capa;
}

/* =====================================================================
   Configuración de las capas base
   ---------------------------------------------------------------------
   Se registra el TMS del IGN como capa rápida y se dejan dos fondos en el
   selector: callejero (IGNBaseTodo) e imagen (PNOA).
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
