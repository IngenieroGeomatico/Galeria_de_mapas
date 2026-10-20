/* =====================================================================
   WMC
   ---------------------------------------------------------------------
   Un contexto WMC: un XML que ya trae las capas montadas y el encuadre.
   Al anadirlo al mapa, la API lo lee, crea las capas que describe y lleva
   la vista a su sitio.

   En 3D la implementacion de Cesium de esta build no trae la clase WMC:
   si se intenta crear, el constructor lanza y `mapa()` aborta antes de
   montar los plugins. Por eso en 3D se deja el globo (con el fondo) y se
   avisa en la ficha.
   ===================================================================== */

function mapa() {
  // El contexto es local y la capa que describe es un WMS con CORS: se leen
  // directamente, sin proxy.
  prepararFondo();

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  const opciones = {
    container: 'mapaDIV',
    zoom: 6,
    // En 3D el centro se da en EPSG:4326 (lon/lat); en 2D, en EPSG:3857.
    center: es3D ? { x: -3.7106, y: 40.4246 } : { x: -412000, y: 4928000 },
  };

  if (!es3D) {
    // Resoluciones estandar de Web Mercator (EPSG:3857) para los 29 niveles.
    // Hacen falta porque, al anadir un WMC, la API recalcula las resoluciones
    // del mapa y en esta build la vista se queda sin zoom (resolucion 0).
    opciones.resolutions = Array.from({ length: 29 }, (_, z) => 156543.03392804097 / (2 ** z));

    // Al declarar la proyeccion, el mapa deja de tener la "de por defecto" y el
    // WMC respeta la suya en vez de cambiar a la que traiga el contexto.
    opciones.projection = 'EPSG:3857';
  }

  mapajs = IDEE.map(opciones);

  if (!es3D) {
    mapajs.addLayers(new IDEE.layer.WMC({
      url: '../../datos/contexto.xml',
      name: 'Contexto',
      legend: 'Contexto WMC',
    }, {}));
  }

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
