/* =====================================================================
   XYZ
   ---------------------------------------------------------------------
   Teselas XYZ de Carto. Sirve cualquier servicio que numere las teselas por
   zoom, columna y fila, sin las capacidades de un OGC de por medio.
   ===================================================================== */

function mapa() {
  // Carto manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 11,
    center: { x: -413064, y: 4927841 },
  });

  const capa = new IDEE.layer.XYZ({
    url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    name: 'Carto',
    legend: 'Teselas XYZ (Carto)',
  }, { crossOrigin: 'anonymous' });

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
