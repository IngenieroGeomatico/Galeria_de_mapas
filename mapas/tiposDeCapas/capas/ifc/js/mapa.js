/* =====================================================================
   IFC / BIM (Modelos 3D y huellas 2D)
   ---------------------------------------------------------------------
   Capa base para visualización de modelos BIM en estándar IFC / 3D.
   ===================================================================== */

// Centro por defecto de la Península Ibérica
const CENTRO_4326 = { x: -3.69, y: 40.42 };
const CENTRO_3857 = { x: -410815, y: 4927230 };

function mapa() {
  prepararFondo();

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: es3D ? 6 : 6,
    center: es3D ? CENTRO_4326 : CENTRO_3857,
  });

  if (window.ifcLayer && typeof window.ifcLayer.instalar === 'function') {
    window.ifcLayer.instalar();
  }

  // Actualmente sin capas IFC activas por defecto (a la espera de modelo oficial)

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
