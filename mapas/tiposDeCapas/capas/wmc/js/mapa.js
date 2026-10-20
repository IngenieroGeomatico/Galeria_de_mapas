/* =====================================================================
   WMC
   ---------------------------------------------------------------------
   Un contexto WMC: un XML que ya trae las capas montadas y el encuadre.
   Al anadirlo al mapa, la API lo lee, crea las capas que describe y lleva
   la vista al BoundingBox del contexto.
   ===================================================================== */

function mapa() {
  // El contexto es local y la capa que describe es un WMS con CORS: se leen
  // directamente, sin proxy.
  prepararFondo();

  // Resoluciones estandar de Web Mercator (EPSG:3857) para los 29 niveles.
  // Hacen falta porque, al anadir un WMC, la API recalcula las resoluciones del
  // mapa y en esta build la vista se queda sin zoom (resolucion 0).
  const resoluciones = Array.from({ length: 29 }, (_, z) => 156543.03392804097 / (2 ** z));

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 6,
    center: { x: -412000, y: 4928000 },
    // Al declarar la proyeccion, el mapa deja de tener la "de por defecto" y el
    // WMC respeta la suya en vez de cambiar a la que traiga el contexto.
    projection: 'EPSG:3857',
    resolutions: resoluciones,
  });

  const capa = new IDEE.layer.WMC({
    url: '../../datos/contexto.xml',
    name: 'Contexto',
    legend: 'Contexto WMC',
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
