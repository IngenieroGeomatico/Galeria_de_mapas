/* =====================================================================
   MapLibre
   ---------------------------------------------------------------------
   Un estilo completo de MapLibre: la Base Topografica Nacional. La capa se
   declara con la URL del style.json y ya trae dentro capas y colores.
   ===================================================================== */

function mapa() {
  // El estilo y sus teselas mandan CORS: se leen directamente.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 11,
    center: { x: -413064, y: 4927841 },
  });

  const capa = new IDEE.layer.MapLibre({
    url: 'https://vt-btn.idee.es/files/styles/BTN_Completa.json',
    name: 'BTN',
    legend: 'Base Topografica Nacional (MapLibre)',
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
