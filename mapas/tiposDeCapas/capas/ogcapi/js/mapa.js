/* =====================================================================
   OGC API Features
   ---------------------------------------------------------------------
   Una coleccion OGC API Features: las cascadas de Espana. El nombre de la
   coleccion va en "name"; la API se encarga del formato y de la paginacion.
   ===================================================================== */

function mapa() {
  // El servicio OGC API de la IDEE manda CORS: se lee directamente.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 6,
    center: { x: -412000, y: 4928000 },
  });

  const capa = new IDEE.layer.OGCAPIFeatures({
    url: 'https://api-features.idee.es/collections/',
    name: 'falls',
    limit: 300,
    legend: 'Cascadas (OGC API Features)',
  }, {
    style: new IDEE.style.Generic({
      point: {
        radius: 5,
        fill: { color: '#2563eb' },
        stroke: { color: '#ffffff', width: 1 },
      },
    }),
  });

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
