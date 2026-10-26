/* =====================================================================
   IFC
   ---------------------------------------------------------------------
   Un modelo BIM (IFC) publicado para la web como glTF/GLB o como 3D Tiles:
   en 3D se carga sobre Cesium con ext/ifcLayer; en 2D se dibuja la huella.
   ===================================================================== */

const URL_IFC = '../../../satelites/img/ISS_stationary.glb';

// Madrid, centro y huella aproximada del modelo.
const BBOX_IFC = [-3.71, 40.41, -3.69, 40.42];
const CENTRO_4326 = { x: -3.7038, y: 40.4168 };
const CENTRO_3857 = { x: -411882, y: 4926433 };

function mapa() {
  prepararFondo();

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 16,
    center: es3D ? CENTRO_4326 : CENTRO_3857,
  });

  if (window.ifcLayer && typeof window.ifcLayer.instalar === 'function') {
    window.ifcLayer.instalar();
  }

  const capa = new IDEE.layer.IFC({
    url: URL_IFC,
    bbox: BBOX_IFC,
    name: 'ModeloIFC',
    legend: 'Modelo IFC (3D)',
    position: { lon: CENTRO_4326.x, lat: CENTRO_4326.y, height: 100 },
    scale: 1,
  }, {
    style: new IDEE.style.Generic({
      polygon: {
        fill: { color: '#e11d48', opacity: 0.25 },
        stroke: { color: '#9f1239', width: 2 },
      },
    }),
  });

  mapajs.addLayers(capa);
  window.capaIFC = capa;

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
