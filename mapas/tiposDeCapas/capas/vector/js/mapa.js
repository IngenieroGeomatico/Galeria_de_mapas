/* =====================================================================
   Vector
   ---------------------------------------------------------------------
   Capa vectorial sin servicio detras: se crea vacia y se le anaden tres
   entidades con addFeatures. Las coordenadas van en EPSG:3857.
   ===================================================================== */

function mapa() {
  // Sin servicio: no hay nada que pedir a la red.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 12,
    center: { x: -413064, y: 4927841 },
  });

  const capa = new IDEE.layer.Vector({
    name: 'Vector',
    legend: 'Geometrias en memoria',
  }, {
    style: new IDEE.style.Generic({
      polygon: {
        fill: { color: '#ffb257', opacity: 0.35 },
        stroke: { color: '#b45309', width: 2 },
      },
      point: {
        radius: 7,
        fill: { color: '#5eead4' },
        stroke: { color: '#0f766e', width: 2 },
      },
    }),
  });
  mapajs.addLayers(capa);

  capa.addFeatures([
    new IDEE.Feature('cibeles', {
      type: 'Feature',
      id: 'cibeles',
      geometry: { type: 'Point', coordinates: [-412105, 4928833] },
      properties: { nombre: 'Cibeles' },
    }),
    new IDEE.Feature('retiro', {
      type: 'Feature',
      id: 'retiro',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-410500, 4923000],
          [-403500, 4923000],
          [-403500, 4928500],
          [-410500, 4928500],
          [-410500, 4923000],
        ]],
      },
      properties: { nombre: 'Parque del Retiro' },
    }),
  ]);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
