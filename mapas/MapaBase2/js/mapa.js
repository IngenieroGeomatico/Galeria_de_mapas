/* =====================================================================
   Visualizador base 2: MapaBase con los plugins de botón y panel en un
   supraplugin
   ---------------------------------------------------------------------
   Homólogo a MapaBase, pero los plugins de botón y panel (selector de
   capas base, selector de capas overlay y catálogo) se añaden a un
   supraplugin en lugar de directamente al mapa. El supraplugin es una
   barra transversal al estilo de Ubuntu, con tirador para plegar y
   desplegar.

   Los plugins que NO son de botón y panel se registran directamente en
   el mapa:
   - mapInfo: es un plugin-control que vive en la banda inferior y no
     sigue la filosofía de los plugins de botón y panel.
   - cambioImpl: es el plugin que alterna entre 2D y 3D y necesita
     acceso directo al mapa.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = function () { SVGCarga.hidden = true; };

function mapa() {
  SVGCarga.hidden = false;

  // ── Configuración de capas base ───────────────────────────────────
  // Cada entrada incluye imgPreview para el selector visual. Las miniaturas
  // son imágenes LOCALES del visualizador (carpeta img/), relativas a la
  // página index.html.
  IDEE.config.backgroundlayers = [
    {
      id: "mapa",
      title: "Callejero",
      imgPreview: "img/IGNBase.png",
      layers: ["QUICK*BASE_MapaBase_IGNBaseTodo_WMTS"],
    },
    {
      id: "imagen",
      title: "Imagen",
      imgPreview: "img/imagen.png",
      layers: ["QUICK*BASE_PNOA_MA_TMS"],
    },
    {
      id: "hibrido",
      title: "Híbrido",
      imgPreview: "img/hibrido.png",
      // Grupo de capas oficial = ortofoto PNOA + nomenclátor IGNBaseOrto.
      layers: ["QUICK*BASE_HIBRIDO_LayerGroup"],
    },
  ];

  IDEE.proxy(false);

  // ── Mapa ──────────────────────────────────────────────────────────
  // Sin controls: el control 'scale' de la API lo pide el visualizador, pero
  // Cesium no sabe construirlo y lanza "La implementación usada no puede crear
  // controles Scale", abortando la creación del mapa al pasar a 3D. La lectura
  // de escala y nivel de zoom la pone el plugin mapInfo (ver abajo).
  mapajs = IDEE.map({
    container: "mapaDIV",
  });

  // ── Supraplugin: barra transversal para los plugins de botón y panel ──
  // Los plugins de botón y panel (selector de capas base, selector de capas
  // overlay y catálogo) se añaden a esta barra en lugar de directamente al
  // mapa. El supraplugin es una barra al estilo de Ubuntu, con tirador para
  // plegar y desplegar.
  const supra = new IDEE.plugin.miPlugin_supraplugin({
    id: 'supra-mapabase2',
    position: 'top',
    title: 'Herramientas',
    collapsed: true,
    pinned: false,
    collapsible: true,
    peek: true
  });

  // ── Plugin selector de capas base (grid de imágenes) ──────────────
  const baseLayerPlugin = new IDEE.plugin.miPlugin_baseLayer({
    rows: 1,
    noBaseLayer: true,
    title: "Capas base",
    initActiveLayer: "imagen",
  });
  supra.addItem(baseLayerPlugin);

  // ── Plugin selector de capas overlay (checkboxes) ─────────────────
  const layerSwitcherPlugin = new IDEE.plugin.miPlugin_layerSwitcher();
  supra.addItem(layerSwitcherPlugin);

  // ── Catálogo de servicios y capas ──────────────────────────────────
  // Listado predefinido por tipo de catálogo (IDEE, STAC, OGC API Records) y
  // botón de "Añadir por URL". Ver ext/catalogo.
  const catalogos = [
    new IDEE.catalog.IDEE(),

    new IDEE.catalog.STAC({
      nombre: 'STAC (Earth Search)',
      descripcion: 'Catálogo STAC de imágenes de satélite',
      url: 'https://earth-search.aws.element84.com/v1/collections'
    }),

    new IDEE.catalog.OGCAPIRecords({
      nombre: 'Catálogo de ejemplo (cubeWerx)',
      descripcion: 'Registros de metadatos en un OGC API Records',
      url: 'https://test.cubewerx.com/cubewerx/cubeserv/default/ogcapi/catalogues/collections?f=json'
    }),

    new IDEE.catalog.custom({
      nombre: 'Servicios personalizados',
      descripcion: 'Catálogo de ejemplo declarado desde mapa.js.',
      nodos: [
        {
          nombre: 'Ráster',
          servicios: [
            {
              nombre: 'Callejero (WMS)',
              url: 'https://www.ign.es/wms-inspire/ign-base',
              descripcion: 'Callejero y toponimia de España'
            },
            {
              nombre: 'Ortofoto PNOA (WMS)',
              url: 'https://www.ign.es/wms-inspire/pnoa-ma',
              descripcion: 'Ortofotos del Plan Nacional'
            }
          ]
        },
        {
          nombre: 'Organismo',
          nodos: [
            {
              nombre: 'Servicios base',
              servicios: [
                {
                  nombre: 'Base de España',
                  url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg'
                }
              ]
            }
          ]
        }
      ]
    })
  ];

  const catalogoPlugin = new IDEE.plugin.miPlugin_catalogo({
    position: 'TR',
    order: 2,
    icon: '../../img/iconos/collect.svg',
    catalogos: catalogos
  });
  supra.addItem(catalogoPlugin);

  // ── Registro del supraplugin en el mapa ───────────────────────────
  // El supraplugin SÍ se registra en el mapa con addPlugin(): es la barra
  // contenedora, y los items que contiene se gestionan a través de ella.
  mapajs.addPlugin(supra);

  // ── Plugins que NO van en el supraplugin ──────────────────────────
  // mapInfo es un plugin-control que vive en la banda inferior y no sigue
  // la filosofía de los plugins de botón y panel. Se registra directamente
  // en el mapa.
  mapajs.addPlugin(new IDEE.plugin.miPlugin_mapInfo({ order: 0, openPosition: 'bottom' }));

  // cambioImpl es el plugin que alterna entre 2D y 3D y necesita acceso
  // directo al mapa. También se registra directamente.
  mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true
  }));

  SVGCarga.hidden = true;
  return mapajs;
}

// Arranque.
mapajs_0 = mapa();
