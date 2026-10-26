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
  // Todos los IFC de https://github.com/youshengCode/IfcSampleFiles
  // Se anaden como capas (visualizacion:false => no cargan hasta activarlas).
  // ------------------------------------------------------------------
  const capasIFCExtra = [
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2s3_Duplex_Electrical.ifc', name: 'Ifc2s3_Duplex_Electrical', legend: 'Ifc2s3_Duplex_Electrical (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_Duplex_Architecture.ifc', name: 'Ifc2x3_Duplex_Architecture', legend: 'Ifc2x3_Duplex_Architecture (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_Duplex_MEP.ifc', name: 'Ifc2x3_Duplex_MEP', legend: 'Ifc2x3_Duplex_MEP (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_Duplex_Mechanical.ifc', name: 'Ifc2x3_Duplex_Mechanical', legend: 'Ifc2x3_Duplex_Mechanical (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_Duplex_Plumbing.ifc', name: 'Ifc2x3_Duplex_Plumbing', legend: 'Ifc2x3_Duplex_Plumbing (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_SampleCastle.ifc', name: 'Ifc2x3_SampleCastle', legend: 'Ifc2x3_SampleCastle (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_BasinFacetedBrep.ifc', name: 'Ifc4_BasinFacetedBrep', legend: 'Ifc4_BasinFacetedBrep (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_CubeAdvancedBrep.ifc', name: 'Ifc4_CubeAdvancedBrep', legend: 'Ifc4_CubeAdvancedBrep (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_Revit_ARC.ifc', name: 'Ifc4_Revit_ARC', legend: 'Ifc4_Revit_ARC (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_Revit_ARC_FireRatingAdded.ifc', name: 'Ifc4_Revit_ARC_FireRatingAdded', legend: 'Ifc4_Revit_ARC_FireRatingAdded (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_Revit_MEP.ifc', name: 'Ifc4_Revit_MEP', legend: 'Ifc4_Revit_MEP (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_Revit_STR.ifc', name: 'Ifc4_Revit_STR', legend: 'Ifc4_Revit_STR (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_SampleHouse.ifc', name: 'Ifc4_SampleHouse', legend: 'Ifc4_SampleHouse (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_SampleHouse_0_GroundFloor.ifc', name: 'Ifc4_SampleHouse_0_GroundFloor', legend: 'Ifc4_SampleHouse_0_GroundFloor (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_SampleHouse_1_Roof.ifc', name: 'Ifc4_SampleHouse_1_Roof', legend: 'Ifc4_SampleHouse_1_Roof (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_SampleHouse_IfcWallStandardCase.ifc', name: 'Ifc4_SampleHouse_IfcWallStandardCase', legend: 'Ifc4_SampleHouse_IfcWallStandardCase (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_SampleHouse_IfcWindow.ifc', name: 'Ifc4_SampleHouse_IfcWindow', legend: 'Ifc4_SampleHouse_IfcWindow (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
    new IDEE.layer.IFC({ url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc4_WallElementedCase.ifc', name: 'Ifc4_WallElementedCase', legend: 'Ifc4_WallElementedCase (IFC)', visualizacion: false, directo: false, scale: 1 }, {}),
  ];
  capasIFCExtra.forEach(function (c) { mapajs.addLayers(c); });

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
