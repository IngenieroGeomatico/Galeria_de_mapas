/* =====================================================================
   XYZ
   ---------------------------------------------------------------------
   Teselas XYZ. Sirve cualquier servicio que numere las teselas por zoom,
   columna y fila, sin las capacidades de un OGC de por medio.

   El catalogo son los proveedores de leaflet-providers
   (https://leaflet-extras.github.io/leaflet-providers/preview/) que cubren
   Espana y no piden clave. El filtro NO puede ser "que declaren su
   extension": en ese proyecto solo 11 proveedores traen `bounds` y ninguno
   es de Espana (Suiza, Francia, Austria, Chequia, Paises Bajos, Dinamarca,
   America, Singapur, Alemania...). Asi que se ha mirado la cobertura de
   verdad, pidiendo la tesela de Madrid a z=6 (x=31, y=24) el 24/10/2026 con
   curl: los fondos de esta pagina contestan 200 con imagen y mandan CORS *,
   que es lo que necesita `crossOrigin: anonymous`. Quedan fuera por lo
   medido: OpenRailwayMap y SafeCast (403), HikeBike (el dominio ya no
   existe), OpenSnowMap (404), OPNVKarte (404 y sin CORS), y Thunderforest,
   Jawg, MapTiler, MapBox, TomTom, HERE y AzureMaps, que piden clave. Fuera
   quedan tambien nlmaps, BasemapAT, SwissTopo, GeoportailFrance, USGS,
   OneMapSG, FreeMapSK, MtbMap, NLS y JusticeMap, que solo cubren su pais (no
   Espana).

   OJO CON CARTODB, que era el fondo de esta pagina: ya no sirve teselas sin
   clave y lo hace de la peor manera para un filtro automatico, con un 200 y
   una imagen que dice "API KEY REQUIRED" (medido: 2.049 B en Madrid y los
   mismos 2.049 B en mitad del Pacifico, o sea que el tamano no distingue una
   tesela de verdad de la del aviso). Por eso esta fuera del catalogo y el
   fondo claro por defecto es el gris de Esri.

   OJO CON STADIA (que ahora sirve tambien los estilos Stamen): si pide clave,
   pero la perdona cuando la peticion viene de localhost, que es como se abren
   estos visualizadores (medido: con Referer http://127.0.0.1 devuelve 200 y
   access-control-allow-origin: *, y sin Referer devuelve 401 con una imagen
   de aviso de 14.885 B). Para publicar la galeria en un dominio hay que pedir
   la clave y ponerla en STADIA_API_KEY.

   Los dieciocho fondos van en un grupo de radio del selector de capas: se ve
   uno cada vez, que es justo lo que hace falta para comparar dos fondos sin
   que el de abajo asome por los bordes. OpenSeaMap, que es una capa de
   balizas transparente y se superpone, queda FUERA de ese grupo para poder
   ponerla encima del fondo que se elija.
   ===================================================================== */

// Clave de Stadia Maps para cuando la pagina se publique fuera de localhost.
// Vacia = sin clave, que es lo que vale en local (ver el comentario de arriba).
const STADIA_API_KEY = '';

/**
 * Plantilla de teselas de Stadia Maps (o de los estilos Stamen que sirve).
 *
 * @param {string} variante alidade_smooth, outdoors, stamen_toner...
 * @param {string} [ext='png'] png o jpg (Stamen Watercolor va en jpg)
 * @returns {string} URL con {z}/{x}/{y}
 */
function urlStadia(variante, ext) {
  return 'https://tiles.stadiamaps.com/tiles/' + variante + '/{z}/{x}/{y}.' + (ext || 'png') +
    (STADIA_API_KEY ? '?api_key=' + STADIA_API_KEY : '');
}

// `name` es el identificador de la capa; `legend` es el texto del arbol (y
// tambien lo que se le pasa al selector como grupo de radio, asi que tiene
// que ser unico y estable: los idLayer cambian en cada reinicio de mapa).
// `visible` dice cual se enciende al cargar la pagina.
const CAPAS_XYZ = [
  {
    name: 'OSM',
    legend: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    visible: false,
  },
  {
    name: 'OSMAlemania',
    legend: 'OpenStreetMap Alemania',
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    visible: false,
  },
  {
    name: 'OSMFrancia',
    legend: 'OpenStreetMap Francia',
    url: 'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    visible: false,
  },
  {
    name: 'HOT',
    legend: 'OpenStreetMap Humanitario (HOT)',
    url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    visible: false,
  },
  {
    name: 'CyclOSM',
    legend: 'CyclOSM (rutas ciclistas)',
    url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    visible: false,
  },
  {
    name: 'OpenTopoMap',
    legend: 'OpenTopoMap (curvas de nivel)',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    visible: false,
  },
  // Stadia Maps (y los estilos Stamen que ahora sirve): sin clave desde
  // localhost, con STADIA_API_KEY fuera de el. Ver el comentario de cabecera.
  {
    name: 'StadiaAlidade',
    legend: 'Stadia Alidade (claro)',
    url: urlStadia('alidade_smooth', 'png'),
    visible: false,
  },
  {
    name: 'StadiaAlidadeOscuro',
    legend: 'Stadia Alidade (oscuro)',
    url: urlStadia('alidade_smooth_dark', 'png'),
    visible: false,
  },
  {
    name: 'StadiaOSMBright',
    legend: 'Stadia OSM Bright',
    url: urlStadia('osm_bright', 'png'),
    visible: false,
  },
  {
    name: 'StadiaOutdoors',
    legend: 'Stadia Outdoors',
    url: urlStadia('outdoors', 'png'),
    visible: false,
  },
  {
    name: 'StamenToner',
    legend: 'Stamen Toner (blanco y negro)',
    url: urlStadia('stamen_toner', 'png'),
    visible: false,
  },
  {
    name: 'StamenWatercolor',
    legend: 'Stamen Watercolor (acuarela)',
    // Unica de Stadia en jpg, y ademas se queda en el zoom 16.
    url: urlStadia('stamen_watercolor', 'jpg'),
    visible: false,
  },
  {
    name: 'StamenTerrain',
    legend: 'Stamen Terrain (relieve)',
    url: urlStadia('stamen_terrain', 'png'),
    visible: false,
  },
  {
    name: 'EsriGrisClaro',
    legend: 'Esri gris claro',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    visible: true,
  },
  {
    name: 'EsriGrisOscuro',
    legend: 'Esri gris oscuro',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    visible: false,
  },
  {
    name: 'EsriImagenes',
    legend: 'Esri imágenes (satélite)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    visible: false,
  },
  {
    name: 'EsriCalles',
    legend: 'Esri calles',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    visible: false,
  },
  {
    name: 'EsriTopografico',
    legend: 'Esri topográfico',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    visible: false,
  },
];

// Tesela transparente de balizas maritimas: se superpone a cualquiera de los
// fondos, asi que no entra en el grupo de radio y arranca apagada.
const CAPA_BALIZAS = {
  name: 'OpenSeaMap',
  legend: 'Balizas marítimas (OpenSeaMap)',
  url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
  visible: false,
};

/**
 * Crea una capa XYZ a partir de una ficha del catalogo.
 *
 * @param {Object} ficha {url, name, legend, visible}
 * @returns {Object} Capa IDEE.layer.XYZ ya en el estado pedido.
 */
function capaXYZ(ficha) {
  const capa = new IDEE.layer.XYZ({
    url: ficha.url,
    name: ficha.name,
    legend: ficha.legend,
    // Capa superpuesta: se enciende y apaga desde el arbol de capas.
    isBase: false,
    visible: ficha.visible,
  }, {
    displayInLayerSwitcher: true,
    crossOrigin: 'anonymous',
  });
  // El constructor de XYZ no siempre aplica `visible`; se fuerza con
  // setVisible para que el control del arbol empiece en el estado correcto
  // (mismo apaño que en el visor de TMS).
  capa.setVisible(ficha.visible);
  return capa;
}

function mapa() {
  // Todos estos servicios mandan CORS: se leen directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 11,
    center: { x: -413064, y: 4927841 },
  });

  // Se anaden del reves para que el primero del catalogo quede arriba del
  // todo en la pila: el arbol lista las capas de mayor a menor z-index, y asi
  // la lista del selector se lee en el mismo orden que este fichero.
  CAPAS_XYZ.slice().reverse().forEach(function (ficha) {
    mapajs.addLayers(capaXYZ(ficha));
  });

  // Las balizas van despues (encima de todos los fondos) y fuera del grupo de
  // radio del selector.
  mapajs.addLayers(capaXYZ(CAPA_BALIZAS));

  anadirPluginsTipos(mapajs, mapa, {
    selector: {
      // Solo una capa del grupo visible a la vez. Se identifican por `legend`
      // porque los idLayer se regeneran al cambiar de implementacion.
      seleccionUnica: CAPAS_XYZ.map(function (ficha) { return ficha.legend; }),
    },
  });
  return mapajs;
}

mapa();
