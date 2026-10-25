/* =====================================================================
   WFS
   ---------------------------------------------------------------------
   Objetos geograficos de un WFS. La API descarga el DescribeFeatureType
   para conocer la geometria y luego pide los objetos, que se dibujan en el
   cliente.
   ===================================================================== */

function mapa() {
  // El WFS de IDENA manda CORS: se lee directamente, sin proxy.
  prepararFondo();

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 9,
    center: { x: -183000, y: 5281000 },
  });

  const capa = new IDEE.layer.WFS({
    url: 'https://idena.navarra.es/ogc/wfs?',
    namespace: 'IDENA',
    name: 'PATRIM_Sym_BICarqueo',
    legend: 'Yacimientos arqueologicos (WFS)',
  }, {
    // Objetos geograficos por pagina. El limite por defecto es 100 (el de la
    // extension bboxFeatures); se pone aqui porque el servicio tiene 1187
    // objetos y asi la PRIMERA peticion ya viene acotada. OJO con la clave:
    // el impl del WFS crea su servicio con `options.vendor`, NO con el tercer
    // argumento del constructor. El limite y la pagina se cambian desde la
    // ventana de informacion de la capa, que pide al servicio con `count` y
    // `startIndex`.
    vendor: { getFeature: { count: 100 } },
  });

  mapajs.addLayers(capa);

  anadirPluginsTipos(mapajs, mapa, { bboxFeatures: true });
  return mapajs;
}

// La extension bboxFeatures se carga desde este fichero, no desde el
// index.html: aporta el panel "Todas / La vista" y el paginado de la capa.
cargarBboxFeatures().catch(function (e) {
  console.warn(e && e.message ? e.message : e);
}).then(function () {
  mapa();
});
