/* =====================================================================
   OSM
   ---------------------------------------------------------------------
   OpenStreetMap. La API trae la URL, los niveles y la atribucion; la capa
   solo necesita nombre y leyenda.
   ===================================================================== */

function mapa() {
  // Las teselas de OSM mandan CORS: se leen directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 11,
    center: { x: -413064, y: 4927841 },
  });

  const capa = new IDEE.layer.OSM({
    name: 'OSM',
    legend: 'OpenStreetMap',
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
