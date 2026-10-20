/* =====================================================================
   GeoJSON
   ---------------------------------------------------------------------
   Un GeoJSON local: los barrios de Madrid, que ya estan en datos/ en la raiz
   del repositorio. El estilo se pasa en las opciones de la capa.
   ===================================================================== */

function mapa() {
  // El fichero es local: no hay servicio que consultar.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 11,
    center: { x: -413064, y: 4927841 },
  });

  const capa = new IDEE.layer.GeoJSON({
    url: '../../../../datos/madrid_barrios.geojson',
    name: 'Barrios de Madrid',
    legend: 'Barrios de Madrid (GeoJSON)',
  }, {
    style: new IDEE.style.Generic({
      polygon: {
        fill: { color: '#5eead4', opacity: 0.35 },
        stroke: { color: '#0f766e', width: 2 },
      },
    }),
  });

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
