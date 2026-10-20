/* =====================================================================
   TMS
   ---------------------------------------------------------------------
   Teselas con la fila invertida. El servicio de la ortofoto PNOA del IGN
   numera las filas desde abajo, de ahi el {-y} de la plantilla.
   ===================================================================== */

function mapa() {
  // El TMS del IGN manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 12,
    center: { x: -413064, y: 4927841 },
  });

  const capa = new IDEE.layer.TMS({
    url: 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg',
    name: 'PNOA_MA',
    legend: 'Ortofoto PNOA (TMS)',
    tileGridMaxZoom: 19,
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
