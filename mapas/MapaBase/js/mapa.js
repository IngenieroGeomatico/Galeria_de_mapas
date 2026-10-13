/* =====================================================================
   Visualizador base
   ---------------------------------------------------------------------
   Mapa base con los plugins de selección de capas (base + overlay).
   Sirve como plantilla mínima y banco de pruebas de ext/selectorCapas.
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

  // ── Plugin selector de capas base (grid de imágenes) ──────────────
  var baseLayerPlugin = new IDEE.plugin.miPlugin_baseLayer({
    // Una única fila (todas las capas base en línea). Parametrizable:
    // aumentar rows agrupa las miniaturas en columnas más anchas.
    rows: 1,
    noBaseLayer: true,
    title: "Capas base",
    // Capa base activa al iniciar. Puede ser el id ("imagen") o la
    // posición (0 = primera capa base; la última es "sin mapa base").
    initActiveLayer: "imagen",
  });
  mapajs.addPlugin(baseLayerPlugin);

  // ── Plugin selector de capas overlay (checkboxes) ─────────────────
  var layerSwitcherPlugin = new IDEE.plugin.miPlugin_layerSwitcher();
  mapajs.addPlugin(layerSwitcherPlugin);

  // ── Lectura de escala y nivel de zoom ──────────────────────────────
  // Sustituye al control 'scale' de la API: en 2D da el nivel de zoom y la
  // escala 1:n, y en 3D la altura de la cámara y la escala calculada desde el
  // campo de visión (ver ext/mapInfo). Va en la banda de areaControls, que es
  // un div a todo el ancho donde esta lectura ancha sí encaja.
  mapajs.addPlugin(new IDEE.plugin.miPlugin_mapInfo({ order: 0, openPosition: 'bottom' }));

  // ── Catálogo de servicios y capas ──────────────────────────────────
  // Listado predefinido por tipo de catálogo (IDEE, STAC, OGC API Records) y
  // botón de "Añadir por URL". Ver ext/catalogo.
  // Va en la esquina TR (arriba a la derecha) con order 2. La barra de título
  // la deja a todo ancho el bloque "PANEL EN LA ESQUINA TR" que llevan las
  // hojas de los plugins (en TR el API mete el botón dentro del panel y sin
  // eso la cabecera sale partida).
  //
  // El icono es el "collect" de svgrepo (libros apilados), guardado en
  // img/iconos/collect.svg. La ruta es relativa al DOCUMENTO (la máscara se
  // resuelve desde el CSS de la página, no desde este .js), y el color lo pone
  // el propio plugin como máscara (--g-plugin-icon-mask).
  //
  // `catalogos` son los catálogos que usa este visualizador, en datos planos.
  // Se suman a los de serie (IDEE, STAC, OGC API Records) y quedan colgados en
  // IDEE.catalog.custom, así que también se leen desde aquí con
  // IDEE.catalog.custom.propio.
  //
  // El tipo de cada servicio NO se pone: lo deduce el plugin de la URL, que es
  // lo que sabe distinguir un WMS de un GeoJSON o de una plantilla de teselas.
  // Un nodo puede llevar servicios y subnodos, y se pinta como un árbol de
  // desplegables. Con `soloCatalogos: true` se quedaría solo con estos.
  mapajs.addPlugin(new IDEE.plugin.miPlugin_catalogo({
    position: 'TR',
    order: 2,
    icon: '../../img/iconos/collect.svg',
    catalogos: {
      propio: {
        nombre: 'Servicios del visor',
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
      }
    }
  }));

  // ── Plugin cambio de implementación (OL <-> Cesium) ───────────────
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
