/* =====================================================================
   WMS
   ---------------------------------------------------------------------
   Capa de un servicio OGC que sirve el mapa como imagen. Aqui se usa el
   WMS de vigilancia volcanica del IGN, con TODAS sus capas: redes de
   vigilancia, InSAR, geoquimica, geomagnetismo, erupciones y camaras.
   Al arrancar solo esta visible la de erupciones; las demas se encienden
   desde el arbol de capas.
   ===================================================================== */

// Servicio y catalogo de capas. `name` es el nombre que viaja en el
// parametro LAYERS de la peticion; `legend` es lo que muestra el arbol de
// capas, para no leer identificadores tecnicos en pantalla; `visible` dice
// si la capa se enciende al cargar la pagina.
const URL_VOLCANOLOGIA = 'https://wms-volcanologia.ign.es/volcanologia?';

const CAPAS_VOLCANOLOGIA = [
  { name: 'sis', legend: 'Red de Vigilancia Volcánica', visible: false },
  { name: 'gps', legend: 'Control de deformaciones', visible: false },
  { name: 'displacement-asc', legend: 'InSAR', visible: false },
  { name: 'phase-asc', legend: 'Fase en órbita ascendente', visible: false },
  { name: 'coh-asc', legend: 'Coherencia en órbita ascendente', visible: false },
  { name: 'displacement-des', legend: 'Desplazamiento en órbita descendente', visible: false },
  { name: 'phase-des', legend: 'Fase en órbita descendente', visible: false },
  { name: 'coh-des', legend: 'Coherencia en órbita descendente', visible: false },
  { name: 'eto', legend: 'Estaciones totales', visible: false },
  { name: 'inc', legend: 'Inclinómetros', visible: false },
  { name: 'gqme', legend: 'Geoquímica', visible: false },
  { name: 'gqmp', legend: 'Puntos de muestreo', visible: false },
  { name: 'gra', legend: 'Gravimetría', visible: false },
  { name: 'rega', legend: 'Red Española de Gravimetría Absoluta REGA', visible: false },
  { name: 'mag', legend: 'Geomagnetismo', visible: false },
  { name: 'erupciones', legend: 'Geología - Erupciones', visible: true },
  { name: 'wcmv', legend: 'Imágenes en tiempo real', visible: false },
  { name: 'wcmt', legend: 'Cámara térmica (infrarrojo)', visible: false },
];

function mapa() {
  // Servicios publicos con CORS: se leen directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 8,
    // Canarias: es donde esta la mayor parte de la red de vigilancia.
    center: { x: -1736584, y: 3259000 },
  });

  // Una capa de la API por cada capa del servicio. Asi el arbol de capas las
  // enciende y apaga por separado, que es justo lo que demuestra el tipo WMS:
  // el servicio pinta cada capa en su imagen y la API las superpone.
  CAPAS_VOLCANOLOGIA.forEach(function (capa) {
    mapajs.addLayers(new IDEE.layer.WMS({
      url: URL_VOLCANOLOGIA,
      name: capa.name,
      legend: capa.legend,
      // Fondo transparente: las capas se superponen entre si y sobre el mapa
      // base. Sin esto, cada capa taparia a las anteriores.
      transparent: true,
      // Teselas de 256 px: con 18 capas es mucho mas llevadero al mover el
      // mapa, porque solo se piden las teselas nuevas.
      tiled: true,
    }, {
      // Solo las erupciones estan visibles al arrancar; las otras 17 se
      // activan desde el arbol de capas.
      visibility: capa.visible,
    }));
  });

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
