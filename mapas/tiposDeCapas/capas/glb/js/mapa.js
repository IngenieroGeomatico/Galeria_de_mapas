/* =====================================================================
   GLB (modelos glTF/GLB no georreferenciados)
   ---------------------------------------------------------------------
   Un .glb es solo una malla 3D: no trae ni posición ni orientación. La
   extension ext/glbLayer anade a la API IDEE.layer.glb, que coloca el
   modelo con `position` (lon/lat/cota + giro + escala) o con un `bbox`
   que sustituye al punto de colocación.

   En 3D (Cesium) se carga el modelo con Cesium.Model; en 2D la API no
   pinta mallas, asi que se dibuja la huella: el bbox si lo hay, o la
   extension real del modelo leida del JSON del glTF (solo los primeros
   bytes del .glb, por HTTP Range).

   Los dos modelos de la pagina son de dominio publico y se sirven desde
   GitHub con CORS abierto.
   ===================================================================== */

const URL_PATO = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';
const URL_GLOBO = 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumBalloon/CesiumBalloon.glb';

// Plaza del Pilar, Zaragoza. Centro del encuadre.
const CENTRO_3857 = { x: -97805, y: 5109633 };
const CENTRO_4326 = { x: -0.8786, y: 41.6563 };

function mapa() {
  prepararFondo();

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  mapajs = IDEE.map({
    container: 'mapaDIV',
    // Con este zoom entran las dos huellas en 2D y los dos modelos en 3D.
    zoom: 18,
    center: es3D ? CENTRO_4326 : CENTRO_3857,
  });

  if (window.glbLayer && typeof window.glbLayer.instalar === 'function') {
    window.glbLayer.instalar();
  }

  // 1) Colocacion por PUNTO: position + heading + scale.
  mapajs.addLayers(new IDEE.layer.glb({
    url: URL_PATO,
    name: 'PatoGLB',
    legend: 'Pato (GLB) colocado por position',
    position: { lon: -0.8793, lat: 41.6566, height: 0 },
    heading: 20,
    scale: 0.35,
    baseAlSuelo: true,
  }));

  // 2) Colocacion por BBOX: el rectangulo sustituye a position y, ademas,
  //    es la huella 2D. `ajustarABbox` escala el modelo para encajarlo.
  mapajs.addLayers(new IDEE.layer.glb({
    url: URL_GLOBO,
    name: 'GloboGLB',
    legend: 'Globo (GLB) colocado por bbox',
    bbox: [-0.8780, 41.6559, -0.8777, 41.6561],
    heading: -30,
    ajustarABbox: true,
    baseAlSuelo: true,
  }));

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
