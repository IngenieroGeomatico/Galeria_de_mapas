/* =====================================================================
   GeoTIFF
   ---------------------------------------------------------------------
   Un COG (Cloud Optimized GeoTIFF) del PNOA 2021 sobre la costa de
   Cataluna. El fichero pesa 300 MB, pero al estar teselado el navegador
   solo pide los trozos del encuadre.

   En 3D la fachada de IDEE.layer.GeoTIFF no viene en el bundle: la aporta
   ext/geotiffLayer. Se instala antes de crear la capa y se espera a que
   este lista; si no, el constructor de Cesium lanza.
   ===================================================================== */

function mapa() {
  // El COG del CNIG se sirve por https y con CORS: se lee sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 14,
    center: { x: 309721, y: 5231184 },
  });

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);
  if (es3D) {
    mapajs.addPlugin(new IDEE.plugin.miPlugin_geotiffLayer());
  }
  anadirCapaGeoTIFF(mapajs, es3D);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

/**
 * Crea la capa GeoTIFF.
 *
 * @param {Object} map Mapa recien creado.
 * @param {boolean} es3D Si la implementacion es Cesium.
 */
async function anadirCapaGeoTIFF(map, es3D) {
  if (es3D && typeof window.geotiffLayerCuandoInstalado === 'function') {
    await window.geotiffLayerCuandoInstalado();
  }

  const capa = new IDEE.layer.GeoTIFF({
    url: 'https://ftpcdd.cnig.es/Vuelos_2021/Vuelos_2021/catalunya_2021/Costa/01.VF/01.08_PNOA_2021_CAT_COSTA_22cm_VF_img8c_rgb_hu31/h50_0219_fot_002-0001_cog.tif',
    name: 'PNOA Costa Cataluna',
    legend: 'PNOA 2021 Costa Cataluna (GeoTIFF)',
  }, {
    nodata: 0,
  });

  map.addLayers(capa);
}

mapa();
