/* =====================================================================
   MBTiles
   ---------------------------------------------------------------------
   Un .mbtiles real, el del proyecto node-mbtiles: el mundo entero entre los
   niveles 0 y 4. La API descarga el contenedor y lee las teselas con sql.js.
   ===================================================================== */

function mapa() {
  // El fichero se descarga de GitHub, que manda CORS: se lee directamente.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 4,
    center: { x: -412000, y: 4928000 },
  });

  const capa = new IDEE.layer.MBTiles({
    url: 'https://raw.githubusercontent.com/mapbox/node-mbtiles/master/test/fixtures/plain_1.mbtiles',
    name: 'MBTiles',
    legend: 'MBTiles de ejemplo (z0-4)',
    maxZoomLevel: 4,
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
