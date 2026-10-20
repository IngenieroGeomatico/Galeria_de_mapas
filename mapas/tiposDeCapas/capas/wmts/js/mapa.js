/* =====================================================================
   WMTS
   ---------------------------------------------------------------------
   Teselas pregeneradas. Aqui se usa el WMTS de los modelos digitales de
   elevaciones de la DANA (29/10/2024) publicado por el IGN:

     https://wmts-mde-dana.idee.es/dana

   El servicio publica cuatro capas: MDT y MDS, en la version preevento y
   en la del Barranc de Torrent (11/11/2024). Se anaden las cuatro al mapa
   y el arbol de capas permite encenderlas por separado para compararlas.
   ===================================================================== */

const URL_MDE_DANA = 'https://wmts-mde-dana.idee.es/dana?';

// `name` es el identificador que viaja en la peticion WMTS; `legend` es el
// texto que se ve en el arbol de capas.
const CAPAS_MDE_DANA = [
  {
    name: 'RectifiedGridCoveragePre',
    legend: 'MDS Preevento',
    visible: false,
  },
  {
    name: 'RectifiedGridCoverageBncTorrent',
    legend: 'MDS Barranc de Torrent (11/11/2024)',
    visible: true,
  },
  {
    name: 'EL.ElevationGridCoveragePre',
    legend: 'MDT Preevento',
    visible: false,
  },
  {
    name: 'EL.ElevationGridCoverageBncTorrent',
    legend: 'MDT Barranc de Torrent (11/11/2024)',
    visible: false,
  },
];

function mapa() {
  // El WMTS de la DANA manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    // Centro de la zona cubierta por el vuelo: Paiporta, Torrent y el
    // entorno del barranco. El encuadre deja ver toda la cobertura.
    zoom: 14,
    center: { x: -47289, y: 4783396 },
  });

  CAPAS_MDE_DANA.forEach(function (capa) {
    mapajs.addLayers(new IDEE.layer.WMTS({
      url: URL_MDE_DANA,
      name: capa.name,
      matrixSet: 'GoogleMapsCompatible',
      legend: capa.legend,
    }, {
      // Solo el MDS postevento esta visible al arrancar. Las otras tres se
      // encienden desde el arbol de capas, una cada vez, para comparar.
      visibility: capa.visible,
      // Las teselas son opacas dentro de la cobertura; una pizca de
      // transparencia deja intuir el callejero que hay debajo.
      opacity: 0.9,
    }));
  });

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
