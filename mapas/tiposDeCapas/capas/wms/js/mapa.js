/* =====================================================================
   WMS
   ---------------------------------------------------------------------
   Capa de un servicio OGC que sirve el mapa como imagen. Se dibuja sobre
   el fondo por defecto de la API (callejero del IGN).
   ===================================================================== */

function mapa() {
  // Servicios publicos con CORS: se leen directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 6,
    center: { x: -412000, y: 4929000 },
  });

  const capa = new IDEE.layer.WMS({
    url: 'https://www.ign.es/wms-inspire/unidades-administrativas?',
    name: 'AU.AdministrativeUnit',
    legend: 'Unidades administrativas',
    tiled: false,
  }, {});
  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
