/* =====================================================================
   Piezas comunes a las paginas de tipos de capa
   ---------------------------------------------------------------------
   Cada pagina hija solo declara SU capa (js/mapa.js). Aqui viven el
   arranque del mapa, el proxy y los plugins que se repiten:

   - miPlugin_cambioImpl: alterna 2D (OpenLayers) y 3D (Cesium). Al
     cambiar, la API recarga su bundle y vuelve a llamar a `mapa()`, por
     eso recibe la funcion como `mapsFunction`.
   - miPlugin_baseLayer: selector de capas base con miniaturas.
   - miPlugin_layerSwitcher: arbol de capas superpuestas, para encender y
     apagar la capa de la pagina sin recargar.
   - miPlugin_mapInfo: lectura de escala y coordenadas del puntero.
   - miPlugin_information: boton de informacion del punto. En WMS consulta
     GetFeatureInfo (HTML/JSON) y en capas vectoriales lista los elementos
     del clic con plantillas configurables.
   - miPlugin_modal: el boton que abre el codigo de la capa. El HTML del
     snippet esta en un <template id="codigo"> de cada index.html.
   ===================================================================== */

// La rueda de carga tapa el mapa hasta que la pagina (y con ella la API) ha
// terminado de cargar. Se oculta con el evento load, pero tambien al final de
// mapa(): una capa lenta (un WFS grande, por ejemplo) retrasa el load y
// dejaria la pagina en negro aunque el mapa ya estuviera montado.
const SVGCarga = document.getElementById('cargaSVG');

function ocultarCarga() {
  if (SVGCarga) SVGCarga.hidden = true;
}

if (SVGCarga) {
  window.addEventListener('load', ocultarCarga);
  document.addEventListener('DOMContentLoaded', ocultarCarga);
  // Tope de seguridad: ni un recurso externo colgado puede tapar el mapa.
  setTimeout(ocultarCarga, 4000);
}

/**
 * Capas base que ofrece el selector comun.
 *
 * `imgPreview` es una URL relativa al DOCUMENTO (la resuelve el <img> del
 * panel), por eso sube dos niveles hasta la carpeta img/ de tiposDeCapas.
 * `layers` usa la sintaxis QUICK* de la API: cada entrada del catalogo
 * `IDEE.config.quicklayers` se construye con su clase real (TMS, WMTS o grupo).
 */
const CAPAS_BASE_TIPOS = [
  {
    id: 'mapa',
    title: 'Callejero',
    imgPreview: '../../img/IGNBase.jpg',
    layers: ['QUICK*Base_IGNBaseTodo_TMS'],
  },
  {
    id: 'imagen',
    title: 'Imagen',
    imgPreview: '../../img/imagen.jpg',
    layers: ['QUICK*BASE_PNOA_MA_TMS'],
  },
  {
    id: 'hibrido',
    title: 'Hibrido',
    imgPreview: '../../img/hibrido.jpg',
    layers: ['QUICK*BASE_HIBRIDO_LayerGroup'],
  },
];

/**
 * Deja la API lista antes de crear el mapa.
 *
 * @param {Object} [opciones]
 * @param {boolean} [opciones.proxy=false] Usa el proxy de la API para leer los
 *   servicios. Solo lo necesita el WFS del IGN, que no manda cabecera CORS: el
 *   resto de servicios publicos se leen directamente.
 */
function prepararFondo(opciones) {
  const opts = opciones || {};
  // Sin proxy, cualquier servicio que no mande CORS falla y la capa no se
  // dibuja. Por eso el valor por defecto es "directo": es lo que hace el resto
  // de visualizadores del repositorio.
  IDEE.proxy(opts.proxy === true);
}

/**
 * Anade los plugins comunes al mapa recien creado.
 *
 * @param {Object} map Mapa de la API-IDEE.
 * @param {Function} recrear Funcion que vuelve a montar el mapa entero. Es la
 *   que usa el cambio 2D/3D tras recargar el bundle.
 */
function anadirPluginsTipos(map, recrear) {
  // El mapa ya existe: la rueda de carga puede irse.
  ocultarCarga();

  // 2D / 3D. `shareView` conserva el encuadre que el visitante tenia: la capa
  // se recrea desde cero, pero no se le mueve el mapa de sitio debajo.
  map.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: 'Cambiar entre 2D y 3D',
    mapsFunction: recrear,
    shareView: true,
  }));

  // Selector de capas base: una fila de miniaturas (Callejero / Imagen /
  // Hibrido). Va antes que el arbol en la esquina TL (`order`), que es el
  // orden natural: primero el fondo, despues lo que se superpone.
  map.addPlugin(new IDEE.plugin.miPlugin_baseLayer({
    layers: CAPAS_BASE_TIPOS,
    rows: 1,
    title: 'Capas base',
    order: 0,
  }));

  // Arbol de capas superpuestas: la capa de la pagina aparece con su leyenda y
  // se puede apagar para ver el fondo que hay debajo.
  map.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher({ order: 1 }));

  // Escala / nivel de zoom y coordenadas del puntero. Sustituye al control
  // 'scale' de la API, que Cesium no sabe construir y abortaria el 3D.
  map.addPlugin(new IDEE.plugin.miPlugin_mapInfo({
    order: 0,
    openPosition: 'bottom',
  }));

  // Informacion del punto. No tiene panel: solo un boton que se queda
  // activado mientras se consultan las capas. En WMS pregunta por
  // GetFeatureInfo y deja cambiar entre HTML y JSON; en vectoriales lista
  // todos los elementos del clic con plantillas (ficha, tabla o JSON).
  map.addPlugin(new IDEE.plugin.miPlugin_information({
    position: 'TL',
    order: 2,
    buttonTitle: 'Consultar información del punto',
    color1: { active: '#ffffff', deactive: 'orangered' },
    color2: { active: '#71A7D3', deactive: '#ffffff' },
    color3: { active: '#71A7D3', deactive: '#ffffff' },
  }));

  // Codigo de la capa. El contenido no viaja en el plugin: se lee del
  // <template id="codigo"> que hay en el propio index.html. El naranja de los
  // botones es el del resto de visualizadores; la ventana abierta se pinta con
  // la hoja de la pagina (css/capa.css).
  map.addPlugin(new IDEE.plugin.miPlugin_modal({
    position: 'TR',
    order: 2,
    tooltip: 'Ver el codigo de esta capa',
    contentSelector: '#codigo',
    color1: { active: '#ffffff', deactive: 'orangered' },
    color2: { active: '#ffd9c2', deactive: '#ffffff' },
    color3: { active: '#ffffff', deactive: '#ffffff' },
  }));
}
