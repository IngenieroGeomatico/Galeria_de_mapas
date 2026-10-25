/* =====================================================================
   FlatGeobuf
   ---------------------------------------------------------------------
   Un fichero .fgb de los barrios de Madrid, leido en 2D y en 3D a traves
   de ext/flatgeobufLayer como IDEE.layer.FlatGeobuf (capa vectorial
   nativa). Arranca en modo "La vista": solo pide las features del bbox
   visible con HTTP Range (indice espacial del .fgb), sin descargar el
   fichero entero. El boton "Todas" del panel de la capa descarga el resto
   bajo demanda.
   ===================================================================== */

function mapa() {
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 11,
    center: { x: -413064, y: 4927841 },
  });

  // La extension se instala al cargarse, pero se vuelve a pedir aqui por si
  // el cambio 2D/3D acaba de recargar el bundle de la API.
  if (window.flatgeobufLayer && typeof window.flatgeobufLayer.instalar === 'function') {
    window.flatgeobufLayer.instalar();
  }

  const estilo = new IDEE.style.Generic({
    polygon: {
      fill: { color: '#5eead4', opacity: 0.35 },
      stroke: { color: '#0f766e', width: 2 },
    },
  });

  // Como cualquier capa vectorial de la API: el fichero .fgb se indica con
  // `url` y el CRS de sus coordenadas con `crs`. La primera carga (solo el
  // bbox de la vista) la dispara la propia capa al anadirse al mapa.
  const capa = new IDEE.layer.FlatGeobuf({
    url: '../../../../datos/Madrid_barrios.fgb',
    name: 'Barrios de Madrid',
    legend: 'Barrios de Madrid (FlatGeobuf)',
    // Los .fgb de ejemplo estan en EPSG:3857 (el bbox del mapa tambien).
    crs: 'EPSG:3857',
  }, {
    style: estilo,
  });

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa, { bboxFeatures: true });

  return mapajs;
}

// bboxFeatures se carga desde aqui, no desde el index.html: aporta el panel
// "Todas / La vista" de la capa y refresca el bbox al mover el mapa en 2D.
// Si el script no llega a cargarse, el mapa se monta igualmente (la capa
// conserva su carga inicial por vista).
cargarBboxFeatures().catch(function (e) {
  console.warn(e && e.message ? e.message : e);
}).then(function () {
  mapa();
});
