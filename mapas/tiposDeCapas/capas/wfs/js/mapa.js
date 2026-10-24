/* =====================================================================
   WFS
   ---------------------------------------------------------------------
   Entidades de un WFS. La API descarga el DescribeFeatureType para conocer
   la geometria y luego pide las entidades, que se dibujan en el cliente.
   ===================================================================== */

function mapa() {
  // El WFS de IDENA manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 9,
    center: { x: -183000, y: 5281000 },
  });

  const capa = new IDEE.layer.WFS({
    url: 'https://idena.navarra.es/ogc/wfs?',
    namespace: 'IDENA',
    name: 'PATRIM_Sym_BICarqueo',
    legend: 'Yacimientos arqueologicos (WFS)',
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa, { bboxFeatures: true });
  return mapajs;
}

mapa();
