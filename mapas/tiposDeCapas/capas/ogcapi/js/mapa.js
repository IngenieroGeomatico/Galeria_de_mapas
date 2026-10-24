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
    // Objetos geográficos por página. El límite por defecto es 100 (el de
    // la extensión bboxFeatures); se pone aquí para que la PRIMERA petición
    // ya venga acotada. El límite y la página se cambian desde la ventana de
    // información de la capa, que pide al servicio con `limit` y `offset`.
    limit: 100,
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

  anadirPluginsTipos(mapajs, mapa, { bboxFeatures: true });
  return mapajs;
}

mapa();
