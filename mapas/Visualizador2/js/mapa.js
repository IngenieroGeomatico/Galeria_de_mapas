/* =====================================================================
   Visualizador con barra de herramientas: los plugins de botón y panel
   cuelgan de un supraplugin
   ---------------------------------------------------------------------
   Homólogo a Visualizador, pero los plugins de botón y panel (selector
   de capas base, selector de capas overlay y catálogo) tienen su botón
   en una barra transversal, el supraplugin, en lugar de en el área del
   mapa. La barra es al estilo de Ubuntu, con tirador para plegar y
   desplegar.

   Cada uno se registra además con mapajs.addPlugin(), que es lo que hace
   que la API monte su panel y lo que hace que conserve su estado al pasar
   a 3D. La barra solo le pone el botón delante y esconde el del mapa.

   El plugin que NO es de botón y panel se registra directamente en el mapa:
   - mapInfo: es un plugin-control que vive en la banda inferior y no
     sigue la filosofía de los plugins de botón y panel.
   - cambioImpl: sí está en la barra, pero además en el mapa, porque el
     intercambio de implementación necesita del mapa vivo.
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
  //
  // Cada uno se registra además con mapajs.addPlugin(). No es redundante: lo
  // que se registra en el mapa es lo que la API inicializa (panel, control y
  // capas) y lo que el coordinador de estado recorre al cambiar 2D/3D. La barra
  // solo le pone el botón delante y esconde el que la API pinta en el área, así
  // que el plugin queda con un único mando, el de la barra.
  const supra = new IDEE.plugin.miPlugin_supraplugin({
    id: 'supra-visualizador2',
    position: 'top',
    title: 'Herramientas',
    collapsed: true,
    pinned: false,
    collapsible: true,
    peek: true
  });

  // ── Comparador de vistas (2D/3D) ─────────────────────────────────────
  // Se anade al mapa: lo que sale en el area es su boton, y al pulsarlo se
  // esconde y aparece su barra, con su panel de configuracion al lado. La
  // barra se la lleva el comparador: no hace falta compartir la de las demas.
  //
  // Cada vista es un iframe srcdoc con su propia API (2D o 3D). Aquí se montan
  // dos: una en OpenLayers y otra en Cesium.
  const comparador = new IDEE.plugin.miPlugin_comparacionVistas({
    id: 'comparador',
    mode: 'mirror',
    layout: { type: 'grid', rows: 1, cols: 2 },
    sync: true,
    showControls: true,
    icon: '../../img/iconos/compare-map.svg',
    views: [
      {
        name: 'Callejero 2D',
        implementation: '2D',
        isPrimary: true,
        center: [-3.70, 40.42],
        zoom: 12,
        layers: [
          new IDEE.layer.TMS({
            url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
            legend: 'Callejero IGN',
          }),
        ],
      },
      {
        name: 'Callejero 3D',
        implementation: 'Cesium',
        center: [-3.70, 40.42],
        zoom: 12,
        layers: [
          new IDEE.layer.TMS({
            url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
            legend: 'Callejero IGN',
          }),
        ],
      },
    ],
  });
  mapajs.addPlugin(comparador);

  // ── Plugin selector de capas base (grid de imágenes) ──────────────
  const baseLayerPlugin = new IDEE.plugin.miPlugin_baseLayer({
    rows: 1,
    noBaseLayer: true,
    title: "Capas base",
    initActiveLayer: "imagen",
  });
  supra.addItem(baseLayerPlugin);
  mapajs.addPlugin(baseLayerPlugin);

  // ── Plugin selector de capas overlay (checkboxes) ─────────────────
  const layerSwitcherPlugin = new IDEE.plugin.miPlugin_layerSwitcher();
  supra.addItem(layerSwitcherPlugin);
  mapajs.addPlugin(layerSwitcherPlugin);

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
  mapajs.addPlugin(catalogoPlugin);

  // ── Cambio de implementación (OL <-> Cesium) ───────────────────────
  // También cuelga de la barra: su botón del mapa se esconde y el de la
  // barra queda como único mando. El botón de la barra no repite la lógica
  // del swap, llama al del mapa (ver _construirSupraUI en cambioImpl.js).
  const cambioImplPlugin = new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: 'Cambiar entre 2D y 3D',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true
  });
  supra.addItem(cambioImplPlugin);
  mapajs.addPlugin(cambioImplPlugin);

  // ── Registro del supraplugin en el mapa ───────────────────────────
  // El supraplugin SÍ se registra en el mapa con addPlugin(): es la barra
  // contenedora, y los items que contiene se gestionan a través de ella.
  mapajs.addPlugin(supra);

  // ── Plugins que NO van en el supraplugin ──────────────────────────
  // mapInfo es un plugin-control que vive en la banda inferior y no sigue
  // la filosofía de los plugins de botón y panel. Se registra directamente
  // en el mapa.
  mapajs.addPlugin(new IDEE.plugin.miPlugin_mapInfo({ order: 0, openPosition: 'bottom' }));

  SVGCarga.hidden = true;
  return mapajs;
}

// Arranque.
mapajs_0 = mapa();
