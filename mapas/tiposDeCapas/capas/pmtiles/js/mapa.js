/* =====================================================================
   PMTiles
   ---------------------------------------------------------------------
   Dos ficheros PMTiles de los barrios de Madrid, leidos en 2D y en 3D a
   traves de ext/pmtilesLayer como IDEE.layer.PMTiles:

   - Madrid_barrios.pmtiles        -> teselas vectoriales MVT (z0..14).
   - Madrid_barrios_raster.pmtiles -> teselas PNG (z0..13).

   En 2D se anaden las dos: el raster debajo y el vectorial encima. En 3D
   solo se anade la raster: la fachada MVT de Cesium (ext/MVTLayer) conserva
   la capa pero no dibuja teselas vectoriales.
   ===================================================================== */

/**
 * Implementacion activa, igual que en el resto de visualizadores.
 * @returns {'cesium'|'ol'}
 */
function checkImpl() {
  const impl = mapajs.getMapImpl();
  return (impl && impl.scene && impl.scene.camera && typeof Cesium !== 'undefined')
    ? 'cesium'
    : 'ol';
}

function mapa() {
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 12,
    center: { x: -413064, y: 4927841 },
  });

  // La extension se instala al cargarse, pero se vuelve a pedir aqui por si
  // el cambio 2D/3D acaba de recargar el bundle de la API.
  if (window.pmtilesLayer && typeof window.pmtilesLayer.instalar === 'function') {
    window.pmtilesLayer.instalar();
  }

  const esCesium = checkImpl() === 'cesium';

  // Raster: vale en 2D y en 3D. Va primero para que el vectorial quede encima.
  const capaRaster = new IDEE.layer.PMTiles({
    url: '../../../../datos/Madrid_barrios_raster.pmtiles',
    type: 'raster',
    name: 'Barrios (ráster)',
    legend: 'Barrios de Madrid (PMTiles ráster)',
    minZoom: 0,
    maxZoom: 13,
    opacity: 0.9,
  }, {});

  mapajs.addLayers(capaRaster);

  // Vectorial: solo 2D.
  if (!esCesium) {
    const estilo = new IDEE.style.Generic({
      polygon: {
        fill: { color: '#5eead4', opacity: 0.25 },
        stroke: { color: '#0f766e', width: 2 },
      },
    });

    const capaVector = new IDEE.layer.PMTiles({
      url: '../../../../datos/Madrid_barrios.pmtiles',
      type: 'vector',
      layers: 'barrios',
      name: 'Barrios (vectorial)',
      legend: 'Barrios de Madrid (PMTiles vectorial)',
      minZoom: 0,
      maxZoom: 14,
    }, {
      style: estilo,
    });

    mapajs.addLayers(capaVector);
  }

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
