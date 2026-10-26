/* =====================================================================
   COPC
   ---------------------------------------------------------------------
   Una nube de puntos LAZ/COPC leida directamente por HTTP Range:

   - 3D: ext/copcLayer carga copcesium y crea un CopcDataSource sobre el
     viewer de Cesium. La capa extiende IDEE.layer.Vector para que el
     selector de capas, la visibilidad, la opacidad y el zoom funcionen
     como en cualquier otra capa.
   - 2D: OpenLayers no lee COPC; se dibuja la huella del bbox. Los puntos
     solo aparecen al pulsar el boton 2D/3D.

   El ejemplo es el COPC publico de Autzen (Oregon), 10,6 millones de
   puntos. La pagina limita el numero de puntos y de nodos para que el
   visor de la galeria no se coma la memoria.
   ===================================================================== */

const URL_COPC = 'https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz';

// Autzen Stadium (Eugene, Oregon), en EPSG:4326.
const BBOX_COPC = [-123.075542, 44.049719, -123.061960, 44.062780];
const CENTRO_4326 = { x: -123.066412, y: 44.056302 };

// El mismo centro en EPSG:3857, que es lo que espera el mapa en 2D.
const CENTRO_3857 = { x: -13699690.3666, y: 5474159.2597 };

/**
 * Implementacion activa, igual que en el resto de visualizadores.
 * @returns {'cesium'|'ol'}
 */
function checkImpl() {
  const impl = mapajs && typeof mapajs.getMapImpl === 'function' ? mapajs.getMapImpl() : null;
  return (impl && impl.scene && impl.scene.camera && typeof Cesium !== 'undefined')
    ? 'cesium'
    : 'ol';
}

function mapa() {
  // El COPC esta en un bucket S3 publico con CORS y Range: se lee sin proxy.
  prepararFondo();

  // Antes de crear el mapa: en 3D el bundle nuevo ya esta cargado y el centro
  // se pasa en EPSG:4326; en 2D, en EPSG:3857.
  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 14,
    center: es3D ? CENTRO_4326 : CENTRO_3857,
  });

  // La extension puede haberse instalado antes de que exista el mapa, pero
  // se fuerza otra vez por si el bundle se ha recargado (cambio 2D/3D).
  if (window.copcLayer && typeof window.copcLayer.instalar === 'function') {
    window.copcLayer.instalar();
  }

  const capa = new IDEE.layer.COPC({
    url: URL_COPC,
    bbox: BBOX_COPC,
    name: 'AutzenCOPC',
    legend: 'Autzen (COPC, solo 3D)',
    copc: {
      // Valores de la prueba de concepto: cargan los primeros nodos rapido y
      // dejan margen para mover la camara sin bajar el arbol completo.
      maxPoints: 500000,
      maxVisibleNodes: 40,
      maxCacheNodes: 80,
      concurrency: 3,
      pixelSize: 2,
      sseThreshold: 300,
      colorMode: 'rgb',
      autoFrame: false,
    },
  }, {
    style: new IDEE.style.Generic({
      polygon: {
        fill: { color: '#5eead4', opacity: 0.12 },
        stroke: { color: '#0f766e', width: 2 },
      },
    }),
  });

  mapajs.addLayers(capa);
  window.capaCOPC = capa;

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
