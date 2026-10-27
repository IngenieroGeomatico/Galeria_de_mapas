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

  // PMTiles publicos de Protomaps (optimizados por HTTP Range). Se anaden como
  // capas vectoriales opcionales: quedan ocultas al arrancar para no tapar el
  // ejemplo de Madrid, y se pueden activar desde el selector de capas.
  if (!esCesium) {
    const estiloEdificiosNZ = new IDEE.style.Generic({
      polygon: {
        fill: { color: '#f97316', opacity: 0.45 },
        stroke: { color: '#7c2d12', width: 1 },
      },
    });
    const capaEdificiosNZ = new IDEE.layer.PMTiles({
      url: 'https://r2-public.protomaps.com/protomaps-sample-datasets/nz-buildings-v3.pmtiles',
      type: 'vector',
      name: 'Edificios NZ (PMTiles)',
      legend: 'Edificios de Nueva Zelanda (PMTiles)',
      minZoom: 0,
      maxZoom: 14,
      visible: false,
    }, { style: estiloEdificiosNZ });
    mapajs.addLayers(capaEdificiosNZ);

    const estiloPois = new IDEE.style.Generic({
      point: {
        radius: 4,
        fill: { color: '#2563eb', opacity: 0.85 },
        stroke: { color: '#1e3a8a', width: 1 },
      },
    });
    const capaPois = new IDEE.layer.PMTiles({
      url: 'https://r2-public.protomaps.com/protomaps-sample-datasets/overture-pois.pmtiles',
      type: 'vector',
      name: 'POIs Overture (PMTiles)',
      legend: 'POIs de Overture (PMTiles)',
      minZoom: 0,
      maxZoom: 14,
      visible: false,
    }, { style: estiloPois });
    mapajs.addLayers(capaPois);

    const estiloZcta = new IDEE.style.Generic({
      polygon: {
        fill: { color: '#a78bfa', opacity: 0.25 },
        stroke: { color: '#5b21b6', width: 1 },
      },
    });
    const capaZcta = new IDEE.layer.PMTiles({
      url: 'https://r2-public.protomaps.com/protomaps-sample-datasets/cb_2018_us_zcta510_500k.pmtiles',
      type: 'vector',
      name: 'ZIP codes EE. UU. (PMTiles)',
      legend: 'ZIP codes de EE. UU. (PMTiles)',
      minZoom: 0,
      maxZoom: 7,
      visible: false,
    }, { style: estiloZcta });
    mapajs.addLayers(capaZcta);

    // Overture Open Buildings global de Source Cooperative (cholmes/overture)
    const estiloOvertureGlobal = new IDEE.style.Generic({
      polygon: {
        fill: { color: '#fb923c', opacity: 0.35 },
        stroke: { color: '#c2410c', width: 1 },
      },
    });
    const capaOvertureGlobal = new IDEE.layer.PMTiles({
      url: 'https://data.source.coop/cholmes/overture/overture-buildings.pmtiles',
      type: 'vector',
      name: 'Edificios Overture Global (PMTiles)',
      legend: 'Edificios Overture Global (PMTiles - Source Cooperative)',
      minZoom: 0,
      maxZoom: 14,
      visible: false,
    }, { style: estiloOvertureGlobal });
    mapajs.addLayers(capaOvertureGlobal);
  }
  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
