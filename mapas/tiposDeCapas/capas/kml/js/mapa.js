/* =====================================================================
   KML
   ---------------------------------------------------------------------
   Un KML con los arboles singulares de la provincia de Sevilla. La API lo
   descarga y lo dibuja con los estilos que trae el propio fichero.
   ===================================================================== */

function mapa() {
  // El KML de los estaticos del IGN manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 12,
    center: { x: -621500, y: 4550000 },
  });

  const capa = new IDEE.layer.KML({
    url: 'https://componentes.idee.es/estaticos/Datos/KML/arbda_sing_se.kml',
    name: 'KML',
    legend: 'Arboles singulares de Sevilla (KML)',
  }, {});

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
