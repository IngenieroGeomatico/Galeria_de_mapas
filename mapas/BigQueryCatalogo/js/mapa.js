'use strict';

/* =====================================================================
   BIGQUERY CON CATÁLOGO Y SELECTORES DE CAPAS — visualizador de ejemplo
   ---------------------------------------------------------------------
   Combina:
     - el plugin de BigQuery (login Google, listado de recursos, carga de
       tablas como GeoJSON o capa alfanumérica),
     - el catálogo de servicios y capas (añadir por URL/IDEE/STAC/OGC),
     - los selectores de capas base y superpuestas,
     - el cambio de implementación 2D/3D.

   Sirve para ver cómo una capa cargada desde BigQuery aparece en el
   selector de capas (si tiene geometría se añade con map.addLayers y sale
   en el switcher; si no, queda como capa alfanumérica registrada).
   ===================================================================== */

var Base_IGNBaseTodo_TMS_2;
var tms_2;

const SVGCarga = document.getElementById('cargaSVG');
window.onload = function () {
  if (SVGCarga) SVGCarga.hidden = true;
};

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

  M.addQuickLayers({ Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2 });

  tms_2 = { base: 'QUICK*Base_IGNBaseTodo_TMS_2' };
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

function leerClientIdDeLaUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const deUrl = (params.get('clientId') || '').trim();
    if (deUrl) return deUrl;
  } catch (e) { /* navegador antiguo */ }
  try {
    return (window.localStorage.getItem('idee.bigquery.clientId') || '').trim();
  } catch (e) {
    return '';
  }
}

function mapa() {
  if (SVGCarga) SVGCarga.hidden = false;
  updateConfigBaseLayer();

  if (window.AlphanumericLayer && typeof window.AlphanumericLayer.instalar === 'function') {
    window.AlphanumericLayer.instalar();
  }

  const mapajs = M.map({
    container: 'mapaID',
    zoom: 11,
    center: { x: -408000, y: 4925000 },
    layers: [],
  });
  window.mapajs = mapajs;

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

  // Catálogo de servicios y capas.
  const catalogos = [
    new IDEE.catalog.IDEE(),
    new IDEE.catalog.STAC({
      nombre: 'STAC (Earth Search)',
      descripcion: 'Catálogo STAC de imágenes de satélite',
      url: 'https://earth-search.aws.element84.com/v1/collections'
    }),
    new IDEE.catalog.OGCAPIRecords({
      nombre: 'Catálogo de ejemplo (cubeWerx)',
      descripcion: 'Registros de metadatos en un OGC API Records',
      url: 'https://test.cubewerx.com/cubewerx/cubeserv/default/ogcapi/catalogues/collections?f=json'
    }),
    new IDEE.catalog.custom({
      nombre: 'Servicios personalizados',
      descripcion: 'Catálogo de ejemplo declarado desde mapa.js.',
      nodos: [
        {
          nombre: 'Ráster',
          servicios: [
            { nombre: 'Callejero (WMS)', url: 'https://www.ign.es/wms-inspire/ign-base', descripcion: 'Callejero y toponimia de España' },
            { nombre: 'Ortofoto PNOA (WMS)', url: 'https://www.ign.es/wms-inspire/pnoa-ma', descripcion: 'Ortofotos del Plan Nacional' }
          ]
        },
        {
          nombre: 'Organismo',
          nodos: [
            {
              nombre: 'Servicios base',
              servicios: [
                { nombre: 'Base de España', url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg' }
              ]
            }
          ]
        }
      ]
    })
  ];

  const catalogoPlugin = new IDEE.plugin.miPlugin_catalogo({
    position: 'TR',
    order: 2,
    icon: '../../img/iconos/collect.svg',
    catalogos: catalogos
  });
  mapajs.addPlugin(catalogoPlugin);

  // Herramienta de BigQuery, en la esquina superior izquierda.
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

mapa();
