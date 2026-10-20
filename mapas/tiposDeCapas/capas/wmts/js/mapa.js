/* =====================================================================
   WMTS
   ---------------------------------------------------------------------
   Teselas pregeneradas. Aqui se usa el WMTS de potencial solar del IGN:

     https://wmts-potencial-solar.idee.es/potencial-solar

   El servicio publica dos capas: el potencial solar global y el de las
   cubiertas de los edificios. Se anaden las dos al mapa y el arbol de
   capas permite encenderlas por separado. El servicio implementa
   GetFeatureInfo y devuelve el valor de potencial solar del punto.
   ===================================================================== */

const URL_POTENCIAL_SOLAR = 'https://wmts-potencial-solar.idee.es/potencial-solar?';

// `name` es el identificador que viaja en la peticion WMTS; `legend` es el
// texto que se ve en el arbol de capas.
const CAPAS_POTENCIAL_SOLAR = [
  {
    name: 'potencial-solar-global',
    legend: 'Potencial solar global',
    visible: true,
  },
  {
    name: 'potencial-solar',
    legend: 'Potencial solar de edificios',
    visible: false,
  },
];

function mapa() {
  // El WMTS de potencial solar manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    // Madrid, en una zona urbana con cubiertas de edificios y datos de
    // potencial solar. El zoom deja ver el detalle de las teselas.
    zoom: 16,
    center: { x: -412305, y: 4926697 },
  });

  CAPAS_POTENCIAL_SOLAR.forEach(function (capa) {
    mapajs.addLayers(new IDEE.layer.WMTS({
      url: URL_POTENCIAL_SOLAR,
      name: capa.name,
      matrixSet: 'GoogleMapsCompatible',
      legend: capa.legend,
    }, {
      // Solo el potencial global esta visible al arrancar. La capa de
      // edificios se enciende desde el arbol de capas.
      visibility: capa.visible,
      // Una pizca de transparencia deja intuir el callejero que hay debajo.
      opacity: 0.9,
      // El servicio sirve teselas y GetFeatureInfo hasta el nivel 17, aunque
      // sus capacidades anuncien matrices superiores: por encima responde 400.
      maxZoom: 17,
    }));
  });

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
