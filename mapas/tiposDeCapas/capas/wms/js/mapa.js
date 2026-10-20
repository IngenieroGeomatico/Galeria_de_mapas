/* =====================================================================
   WMS
   ---------------------------------------------------------------------
   Capa de un servicio OGC que sirve el mapa como imagen. Aqui se usa el
   WMS de vigilancia volcanica del IGN, con TODAS sus capas: redes de
   vigilancia, InSAR, geoquimica, geomagnetismo, erupciones y camaras.
   ===================================================================== */

// Servicio y catalogo de capas. `name` es el nombre que viaja en el
// parametro LAYERS de la peticion; `legend` es lo que muestra el arbol de
// capas, para no leer identificadores tecnicos en pantalla.
const URL_VOLCANOLOGIA = 'https://wms-volcanologia.ign.es/volcanologia?';

const CAPAS_VOLCANOLOGIA = [
  { name: 'sis', legend: 'Red de Vigilancia Volcánica' },
  { name: 'gps', legend: 'Control de deformaciones' },
  { name: 'displacement-asc', legend: 'InSAR' },
  { name: 'phase-asc', legend: 'Fase en órbita ascendente' },
  { name: 'coh-asc', legend: 'Coherencia en órbita ascendente' },
  { name: 'displacement-des', legend: 'Desplazamiento en órbita descendente' },
  { name: 'phase-des', legend: 'Fase en órbita descendente' },
  { name: 'coh-des', legend: 'Coherencia en órbita descendente' },
  { name: 'eto', legend: 'Estaciones totales' },
  { name: 'inc', legend: 'Inclinómetros' },
  { name: 'gqme', legend: 'Geoquímica' },
  { name: 'gqmp', legend: 'Puntos de muestreo' },
  { name: 'gra', legend: 'Gravimetría' },
  { name: 'rega', legend: 'Red Española de Gravimetría Absoluta REGA' },
  { name: 'mag', legend: 'Geomagnetismo' },
  { name: 'erupciones', legend: 'Geología - Erupciones' },
  { name: 'wcmv', legend: 'Imágenes en tiempo real' },
  { name: 'wcmt', legend: 'Cámara térmica (infrarrojo)' },
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
    }, {}));
  });

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
