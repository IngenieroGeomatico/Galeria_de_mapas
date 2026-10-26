/* =====================================================================
   GeoParquet
   ---------------------------------------------------------------------
   Un fichero .parquet de los barrios de Madrid, leido en 2D y en 3D a
   traves de ext/geoparquetLayer como IDEE.layer.GeoParquet (capa
   vectorial nativa, subclase de IDEE.layer.GeoJSON).

   Arranca en modo "La vista": pide el footer con HTTP Range, elige los
   row groups que caen en el bbox visible y descarga solo esos rangos. El
   boton "Todas" del panel de la capa descarga el fichero completo.
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
  if (window.geoparquetLayer && typeof window.geoparquetLayer.instalar === 'function') {
    window.geoparquetLayer.instalar();
  }

  const estilo = new IDEE.style.Generic({
    polygon: {
      fill: { color: '#93c5fd', opacity: 0.35 },
      stroke: { color: '#1d4ed8', width: 2 },
    },
  });

  // `url` apunta al .parquet y `crs` al CRS de sus geometrias. La primera
  // carga (solo el bbox de la vista) la dispara la propia capa al anadirse
  // al mapa: footer por Range + row groups que caen en la vista.
  const capa = new IDEE.layer.GeoParquet({
    url: '../../../../datos/Madrid_barrios.parquet',
    name: 'Barrios de Madrid',
    legend: 'Barrios de Madrid (GeoParquet)',
    // El .parquet de ejemplo esta en EPSG:4326. Si se omite, tambien se lee
    // del metadata `geo` del fichero.
    crs: 'EPSG:4326',
  }, {
    style: estilo,
  });

  mapajs.addLayers(capa);
  // GeoParquet publico de Source Cooperative (edificios Overture de Texas).
  // Se anade como capa adicional: en la vista inicial de Madrid no carga
  // features; al desplazarse a Texas lee solo los row groups del bbox visible.
  // GeoParquet publico con compresion sin soporte ZSTD en este lector: se usa
  // el fichero de paises de Natural Earth (sin comprimir, 177 filas) para que
  // el ejemplo funcione tambien al desplegarlo.
  const estiloPaises = new IDEE.style.Generic({
    polygon: {
      fill: { color: '#93c5fd', opacity: 0.35 },
      stroke: { color: '#1d4ed8', width: 1 },
    },
  });
  const capaPaises = new IDEE.layer.GeoParquet({
    url: 'https://raw.githubusercontent.com/geoarrow/geoarrow-data/v0.2.0/natural-earth/files/natural-earth_countries.parquet',
    name: 'Paises (GeoParquet)',
    legend: 'Paises Natural Earth (GeoParquet)',
    crs: 'EPSG:4326',
    columns: ['geometry', 'name', 'continent'],
  }, {
    style: estiloPaises,
  });
  mapajs.addLayers(capaPaises);


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
