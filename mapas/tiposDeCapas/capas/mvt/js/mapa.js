/* =====================================================================
   MVT
   ---------------------------------------------------------------------
   Teselas vectoriales del IGN, capa "municipio" de la tesela. En 3D la
   fachada la aporta ext/MVTLayer, y hay que instalarla antes de crear la capa.
   ===================================================================== */

function mapa() {
  // El servicio de teselas vectoriales manda CORS: se lee directamente.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 10,
    center: { x: -413064, y: 4927841 },
  });

  // La fachada de MVT en Cesium la registra ext/MVTLayer. Se instala antes de
  // crear la capa porque el constructor del bundle lanza si no esta puesta.
  if (IDEE.impl && IDEE.impl.cesium) {
    mapajs.addPlugin(new IDEE.plugin.miPlugin_MVTLayer());
  }

  const capa = new IDEE.layer.MVT({
    url: 'https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf',
    name: 'Municipios',
    legend: 'Municipios (MVT)',
    layers: 'municipio',
    extract: false,
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
