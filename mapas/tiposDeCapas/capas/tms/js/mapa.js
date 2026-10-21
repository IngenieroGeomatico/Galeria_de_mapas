/* =====================================================================
   TMS
   ---------------------------------------------------------------------
   Teselas con la fila invertida. El servicio TMS del IGN numera las filas
   desde abajo, de ahi el {-y} de la plantilla. Ofrece cuatro mapas base:
   IGNBaseGris, IGNBaseOrto, IGNBaseSimplificado e IGNBaseTodo.
   ===================================================================== */

const TMS_BASE_URL = 'https://tms-ign-base.idee.es/1.0.0/';

// `name` es el identificador de la capa; `legend` es el texto del arbol;
// `visible` dice si se enciende al cargar la pagina.
const CAPAS_TMS = [
  { name: 'IGNBaseGris', legend: 'IGNBaseGris', visible: false },
  { name: 'IGNBaseOrto', legend: 'IGNBaseOrto', visible: false },
  { name: 'IGNBaseSimplificado', legend: 'IGNBaseSimplificado', visible: false },
  { name: 'IGNBaseTodo', legend: 'IGNBaseTodo', visible: true },
];

function mapa() {
  // El TMS del IGN manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    // Encuadre de España para ver los cuatro mapas.
    zoom: 6,
    center: { x: -280000, y: 4150000 },
  });

  CAPAS_TMS.forEach(function (capa) {
    const esPng = (capa.name === 'IGNBaseOrto' || capa.name === 'IGNBaseSimplificado');
    const tms = new IDEE.layer.TMS({
      url: TMS_BASE_URL + capa.name + '/{z}/{x}/{-y}.' + (esPng ? 'png' : 'jpeg'),
      name: capa.name,
      legend: capa.legend,
      // Capa superpuesta: se enciende y apaga desde el arbol de capas.
      isBase: false,
      tileGridMaxZoom: 17,
      visible: capa.visible,
    }, {
      displayInLayerSwitcher: true,
      crossOrigin: 'anonymous',
    });
    // El constructor de TMS no aplica `visible`; se fuerza con setVisible para
    // que el ojo del arbol empiece en el estado correcto.
    tms.setVisible(capa.visible);
    mapajs.addLayers(tms);
  });

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
