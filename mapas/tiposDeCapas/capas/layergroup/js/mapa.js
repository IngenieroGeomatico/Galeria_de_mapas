/* =====================================================================
   LayerGroup
   ---------------------------------------------------------------------
   Un grupo con dos capas: los limites administrativos del IGN y los barrios
   de Madrid. El grupo es una sola entrada en el arbol de capas.
   ===================================================================== */

function mapa() {
  // Las dos capas hijas se leen directamente: el WMS y el GeoJSON mandan CORS.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 10,
    center: { x: -413064, y: 4927841 },
  });

  const grupo = new IDEE.layer.LayerGroup({
    name: 'GrupoLimites',
    legend: 'Grupo: limites y barrios',
    collapsed: false,
  });
  mapajs.addLayers(grupo);

  grupo.addLayers(new IDEE.layer.WMS({
    url: 'https://www.ign.es/wms-inspire/unidades-administrativas?',
    name: 'AU.AdministrativeUnit',
    legend: 'Limites administrativos',
    tiled: false,
  }, {}));

  grupo.addLayers(new IDEE.layer.GeoJSON({
    url: '../../../../datos/madrid_barrios.geojson',
    name: 'Barrios de Madrid',
    legend: 'Barrios de Madrid',
  }, {
    style: new IDEE.style.Generic({
      polygon: {
        fill: { color: '#ffb257', opacity: 0.3 },
        stroke: { color: '#b45309', width: 2 },
      },
    }),
  }));

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
