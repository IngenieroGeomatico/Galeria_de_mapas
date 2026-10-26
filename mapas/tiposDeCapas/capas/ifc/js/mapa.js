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

  // Parametros de la capa IFC. La posicion se deriva del propio IFC (IfcSite);
  // si se omite, el modelo se georreferencia solo.
  const parametrosIFC = {
    url: URL_IFC,
    name: 'ModeloIFC',
    legend: 'Modelo IFC (3D)',
    // Conversión a GLB en memoria (recomendado para visualización profesional).
    convertir: true,
    // Modo directo (web-ifc) experimental: true para evitar la conversión.
    directo: false,
    scale: 1,
    visible: true,
    opacity: 1,
  };

  const capa = new IDEE.layer.IFC(parametrosIFC, {
    style: new IDEE.style.Generic({
      polygon: {
        fill: { color: '#e11d48', opacity: 0.25 },
        stroke: { color: '#9f1239', width: 2 },
      },
    }),
  });

  mapajs.addLayers(capa);
  window.capaIFC = capa;

  // ------------------------------------------------------------------
  // Otros IFC de ejemplo (https://github.com/youshengCode/IfcSampleFiles).
  // Se dejan comentados para no cargarlos todos a la vez; cambia
  // `visualizacion: false` a `true` (o descomenta el bloque) para usarlos.
  // ------------------------------------------------------------------
  // const capasIFCExtra = [
  //   new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_Revit_ARC.ifc', name: 'RevitARC', legend: 'Revit ARC (IFC4)', visualizacion: false, directo: false, scale: 1 }, {}),
  //   new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_Revit_MEP.ifc', name: 'RevitMEP', legend: 'Revit MEP (IFC4)', visualizacion: false, directo: false, scale: 1 }, {}),
  //   new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_Revit_STR.ifc', name: 'RevitSTR', legend: 'Revit STR (IFC4)', visualizacion: false, directo: false, scale: 1 }, {}),
  //   new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_Duplex_MEP.ifc', name: 'DuplexMEP', legend: 'Duplex MEP (IFC2x3)', visualizacion: false, directo: false, scale: 1 }, {}),
  //   new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_SampleCastle.ifc', name: 'SampleCastle', legend: 'Sample Castle (IFC2x3)', visualizacion: false, directo: false, scale: 1 }, {}),
  // ];
  // capasIFCExtra.forEach(function (c) { if (c && c._ifcVisualizacion !== false) mapajs.addLayers(c); });

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
