/* =====================================================================
   WMTS
   ---------------------------------------------------------------------
   Teselas pregeneradas. La capa es la ortofoto PNOA del IGN sobre el fondo
   callejero de la API: se ve perfectamente que es una capa superpuesta.
   ===================================================================== */

function mapa() {
  // El WMTS del IGN manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 11,
    center: { x: -413064, y: 4927841 },
  });

  const capa = new IDEE.layer.WMTS({
    url: 'https://www.ign.es/wmts/pnoa-ma?',
    name: 'OI.OrthoimageCoverage',
    matrixSet: 'GoogleMapsCompatible',
    legend: 'Ortofoto PNOA (WMTS)',
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
