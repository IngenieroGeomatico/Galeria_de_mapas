/* =====================================================================
   IFC
   ---------------------------------------------------------------------
   Un modelo BIM (IFC) publicado para la web como glTF/GLB o como 3D Tiles:
   en 3D se carga sobre Cesium con ext/ifcLayer; en 2D se dibuja la huella.
   ===================================================================== */

const URL_IFC = 'https://raw.githubusercontent.com/andrewisen/bim-whale-ifc-samples/main/SimpleWall/IFC/SimpleWall.ifc';

// Madrid, centro y huella aproximada del modelo.
const BBOX_IFC = undefined;
const CENTRO_4326 = { x: -71.059, y: 42.3587 };
const CENTRO_3857 = { x: -7912000, y: 5213000 };

function mapa() {
  prepararFondo();

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 18,
    center: es3D ? CENTRO_4326 : CENTRO_3857,
  });

  if (window.ifcLayer && typeof window.ifcLayer.instalar === 'function') {
    window.ifcLayer.instalar();
  }

  const capa = new IDEE.layer.IFC({
    url: URL_IFC,
    name: 'ModeloIFC',
    legend: 'Modelo IFC (3D)',
    scale: 1,
    directo: true,
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
