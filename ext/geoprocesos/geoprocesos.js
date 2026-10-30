/* =====================================================================
   GEOPROCESOS · API-IDEE / API-CNIG
   =====================================================================

   Plugin con dos pestañas:

     · Vector  — catálogo completo de funciones de Turf 7.0.0. El desplegable
                 se genera desde ext/geoprocesos/catalogo-turf.js (que se
                 regenera desde los tipos de npm, no se mantiene a mano) y el
                 formulario se construye con los parámetros de cada función.
                 Cuando un parámetro es una capa, se ofrece un desplegable con
                 las capas vectoriales del mapa y el modo de entrega: la capa
                 completa, todas las entidades o solo la primera.

     · Ráster  — fuente GeoTIFF (capa del mapa, fichero local o captura de un
                 servicio del mapa con el encuadre actual: GetMap a un WMS o
                 mosaico de teselas de un TMS/XYZ), calculadora de bandas
                 sobre GeoTIFF (expresión con B1, B2…, presets
                 NDVI/NDWI/umbral/escala) y geoprocesos con gdal3.js
                 (reproyectar, recortar, redimensionar, convertir formato).

   LIBRERÍAS (se cargan BAJO DEMANDA, la primera vez que se usan):

     js/turf/turf_7.0.0.min.js.js   global `turf`
     js/geotiff/geotiff.js          global `GeoTIFF` (solo lectura de píxeles)
     js/gdal/gdal3.js + wasm/data   global `initGdalJs`
     js/jsZIP/jszip.min.js          global `JSZip` (solo salidas multi-fichero)

   Las rutas se resuelven desde la URL de ESTE fichero (document.currentScript),
   así que el plugin funciona desde cualquier profundidad de mapas/<visor>/.

   POR QUÉ SE ESCRIBE EL GEOTIFF A MANO:
   `GeoTIFF.writeArrayBuffer` de geotiff.js 2.1.3 solo escribe 8 bits (reserva
   `width * height * SamplesPerPixel` bytes), así que un Float32 se trunca y el
   fichero sale corrupto. El resultado de la calculadora tiene que conservar los
   valores, así que se usa `geotiff-escritor.js`, que genera un TIFF mínimo de
   una banda Float32 con sus GeoKeys.

   ESTADO ENTRE IMPLEMENTACIONES:
   getState()/setState() conservan la pestaña, la función elegida y el estado
   del panel. No se guardan resultados: los geoprocesos se reejecutan, y las
   capas creadas las transfiere cambioImpl como cualquier otra capa.
   ===================================================================== */

(function () {
  'use strict';

  /* =================================================================== *
   * 1. RUTAS Y CARGA BAJO DEMANDA DE LIBRERÍAS
   * =================================================================== */

  // URL de este fichero: de ahí cuelga todo lo demás. Se resuelve una sola vez,
  // al cargar el script, porque `document.currentScript` deja de valer en
  // cuanto se sale del contexto de ejecución del <script>.
  var SRC_PLUGIN = (document.currentScript && document.currentScript.src) || '';
  var BASE_PLUGIN = SRC_PLUGIN ? SRC_PLUGIN.replace(/[^/]*$/, '') : '';
  var BASE_REPO = BASE_PLUGIN + '../../';
  var URL_JS = BASE_REPO + 'js/';

  /**
   * Inyecta la hoja de estilos del plugin una sola vez. Así el visualizador
   * solo tiene que cargar el .js y no hay que acordarse del <link>.
   */
  function inyectarCss() {
    var href = BASE_PLUGIN + 'geoprocesos.css';
    if (!href || document.querySelector('link[data-geoprocesos-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-geoprocesos-css', '1');
    document.head.appendChild(link);
  }

  /**
   * Carga un script y resuelve cuando el global esperado está disponible.
   * @param {string} url URL absoluta del script.
   * @param {Function} comprobar Devuelve true cuando la librería ya está lista.
   * @returns {Promise<void>}
   */
  function cargarScript(url, comprobar) {
    if (comprobar()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () {
        if (comprobar()) resolve();
        else reject(new Error('El script se ha cargado pero no expone lo esperado: ' + url));
      };
      s.onerror = function () {
        reject(new Error('No se ha podido cargar ' + url));
      };
      document.head.appendChild(s);
    });
  }

  // Cada librería se cachea con una promesa a nivel de window para que dos
  // instancias del plugin (o un swap 2D/3D) no la carguen dos veces.

  function cargarTurf() {
    if (window.__gpTurf) return Promise.resolve(window.__gpTurf);
    if (!window.__gpTurfPromesa) {
      window.__gpTurfPromesa = cargarScript(URL_JS + 'turf/turf_7.0.0.min.js.js', function () {
        return typeof window.turf !== 'undefined' && typeof window.turf.buffer === 'function';
      }).then(function () {
        window.__gpTurf = window.turf;
        return window.turf;
      }).catch(function (e) {
        window.__gpTurfPromesa = null;
        throw e;
      });
    }
    return window.__gpTurfPromesa;
  }

  function cargarGeoTIFF() {
    if (window.__gpGeoTIFF) return Promise.resolve(window.__gpGeoTIFF);
    if (!window.__gpGeoTIFFPromesa) {
      window.__gpGeoTIFFPromesa = cargarScript(URL_JS + 'geotiff/geotiff.js', function () {
        return typeof window.GeoTIFF !== 'undefined' && typeof window.GeoTIFF.fromBlob === 'function';
      }).then(function () {
        window.__gpGeoTIFF = window.GeoTIFF;
        return window.GeoTIFF;
      }).catch(function (e) {
        window.__gpGeoTIFFPromesa = null;
        throw e;
      });
    }
    return window.__gpGeoTIFFPromesa;
  }

  function cargarEscritorGeoTIFF() {
    if (window.GeoprocesosGeoTIFF) return Promise.resolve(window.GeoprocesosGeoTIFF);
    if (!window.__gpEscritorPromesa) {
      window.__gpEscritorPromesa = cargarScript(BASE_PLUGIN + 'geotiff-escritor.js', function () {
        return typeof window.GeoprocesosGeoTIFF !== 'undefined';
      }).then(function () {
        return window.GeoprocesosGeoTIFF;
      }).catch(function (e) {
        window.__gpEscritorPromesa = null;
        throw e;
      });
    }
    return window.__gpEscritorPromesa;
  }

  /**
   * Rampa viridis (la de matplotlib) en anclas RGB.
   *
   * Sirve para pintar en el mapa los resultados de una sola banda. La capa
   * `ol.source.GeoTIFF` de la API no estira bien un Float32 de una banda y lo
   * deja negro, así que el ráster se coloriza solo para la capa: el GeoTIFF
   * que se descarga conserva los valores originales.
   */
  var RAMPA_VIRIDIS = [
    [68, 1, 84], [72, 26, 108], [71, 47, 125], [65, 68, 135], [57, 86, 140],
    [49, 104, 142], [42, 120, 142], [35, 136, 142], [31, 152, 139], [34, 168, 132],
    [44, 183, 121], [59, 197, 109], [84, 210, 94], [116, 221, 79], [153, 230, 60],
    [191, 238, 42], [230, 244, 26], [253, 231, 37],
  ];

  /**
   * Color de la rampa para un valor normalizado.
   * @param {number} t 0 = mínimo, 1 = máximo.
   * @returns {Array<number>} [R, G, B] de 0 a 255.
   */
  function colorRampa(t) {
    var x = Math.max(0, Math.min(1, t)) * (RAMPA_VIRIDIS.length - 1);
    var i = Math.floor(x);
    var f = x - i;
    var a = RAMPA_VIRIDIS[i];
    var b = RAMPA_VIRIDIS[Math.min(i + 1, RAMPA_VIRIDIS.length - 1)];
    return [
      Math.round(a[0] + ((b[0] - a[0]) * f)),
      Math.round(a[1] + ((b[1] - a[1]) * f)),
      Math.round(a[2] + ((b[2] - a[2]) * f)),
    ];
  }

  /** Gradiente CSS de la rampa, para la leyenda del resultado. */
  function gradienteRampa() {
    var paradas = RAMPA_VIRIDIS.map(function (c, i) {
      var pct = Math.round((i / (RAMPA_VIRIDIS.length - 1)) * 100);
      return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ') ' + pct + '%';
    });
    return 'linear-gradient(90deg, ' + paradas.join(', ') + ')';
  }

  /**
   * Lee GDAL_NODATA del FileDirectory del TIFF.
   * @param {Object} fd FileDirectory de geotiff.js.
   * @returns {number|null} NaN para «nan», o null si no hay nodata.
   */
  function leerNodata(fd) {
    var nodataTxt = fd && fd.GDAL_NODATA;
    if (nodataTxt === undefined || nodataTxt === null) return null;
    var limpio = String(nodataTxt).replace(/\0/g, '').trim();
    if (/^nan$/i.test(limpio)) return NaN;
    var nodata = Number(limpio);
    return Number.isNaN(nodata) ? null : nodata;
  }

  function cargarCatalogo() {
    if (Array.isArray(window.CATALOGO_TURF)) return Promise.resolve(window.CATALOGO_TURF);
    if (!window.__gpCatalogoPromesa) {
      window.__gpCatalogoPromesa = cargarScript(BASE_PLUGIN + 'catalogo-turf.js', function () {
        return Array.isArray(window.CATALOGO_TURF);
      }).then(function () {
        return window.CATALOGO_TURF;
      }).catch(function (e) {
        window.__gpCatalogoPromesa = null;
        throw e;
      });
    }
    return window.__gpCatalogoPromesa;
  }

  /**
   * Inicializa gdal3.js con el wasm y el data LOCALES del repositorio.
   *
   * `useWorker: false` a propósito: el worker obliga a resolver rutas relativas
   * al blob y en varios visualizadores del repositorio eso acaba en un 404. Sin
   * worker, `getFileBytes` lee directamente de `Module.FS`, que es lo único que
   * se necesita aquí. El precio es que la compilación bloquea el hilo principal
   * mientras carga los 28 MB de wasm, y por eso se avisa en el estado.
   */
  function cargarGdal() {
    if (window.__gpGdal) return Promise.resolve(window.__gpGdal);
    if (!window.__gpGdalPromesa) {
      window.__gpGdalPromesa = cargarScript(URL_JS + 'gdal/gdal3.js', function () {
        return typeof window.initGdalJs === 'function';
      }).then(function () {
        return window.initGdalJs({
          paths: {
            wasm: URL_JS + 'gdal/gdal3WebAssembly.wasm',
            data: URL_JS + 'gdal/gdal3WebAssembly.data',
            js: URL_JS + 'gdal/gdal3.js',
          },
          useWorker: false,
        });
      }).then(function (gdal) {
        window.__gpGdal = gdal;
        return gdal;
      }).catch(function (e) {
        window.__gpGdalPromesa = null;
        throw e;
      });
    }
    return window.__gpGdalPromesa;
  }

  function cargarJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!window.__gpZipPromesa) {
      window.__gpZipPromesa = cargarScript(URL_JS + 'jsZIP/jszip.min.js', function () {
        return typeof window.JSZip !== 'undefined';
      }).then(function () {
        return window.JSZip;
      }).catch(function (e) {
        window.__gpZipPromesa = null;
        throw e;
      });
    }
    return window.__gpZipPromesa;
  }

  /* =================================================================== *
   * 2. UTILIDADES
   * =================================================================== */

  function api() {
    return window.IDEE || window.M;
  }

  /** Crea una <option> en una línea. */
  function opcion(valor, texto) {
    var o = document.createElement('option');
    o.value = valor;
    o.textContent = texto;
    return o;
  }

  var TIPOS_GEOMETRIA = /^(Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon|GeometryCollection)$/;

  function esGeometria(o) {
    return !!o && typeof o.type === 'string' && TIPOS_GEOMETRIA.test(o.type);
  }

  /**
   * Normaliza cualquier resultado de Turf a una FeatureCollection.
   * Acepta Feature, FeatureCollection, geometría suelta y arrays de todo eso.
   * Devuelve null si no hay nada con geometría.
   * @param {*} o Resultado de Turf.
   * @returns {Object|null}
   */
  function aFeatureCollection(o) {
    if (!o) return null;
    if (o.type === 'FeatureCollection' && Array.isArray(o.features)) return o;
    if (o.type === 'Feature') return { type: 'FeatureCollection', features: [o] };
    if (esGeometria(o)) {
      return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: o }] };
    }
    if (Array.isArray(o)) {
      var features = [];
      o.forEach(function (x) {
        var fc = aFeatureCollection(x);
        if (fc) features = features.concat(fc.features);
      });
      return features.length ? { type: 'FeatureCollection', features: features } : null;
    }
    return null;
  }

  /** Descarga un Blob con un nombre de fichero. */
  function descargarBlob(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre || 'descarga';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Se revoca tarde: si se revoca en el mismo tick, Safari cancela la descarga.
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
  }

  /** Nombre de fichero de una ruta de gdal3 ('/output/x.geojson' -> 'x.geojson'). */
  function nombreDeRuta(ruta) {
    // `ogr2ogr`/`gdal_translate` devuelven objetos { local, real } en `all`.
    var texto = (ruta && typeof ruta === 'object') ? (ruta.local || ruta.real || '') : ruta;
    var trozos = String(texto || '').split('/');
    return trozos[trozos.length - 1] || 'salida';
  }

  /** Quita las comillas de un valor por defecto documentado en el JSDoc. */
  function sinComillas(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    var m = /^'(.*)'$/.exec(s) || /^"(.*)"$/.exec(s);
    return m ? m[1] : s;
  }

  var ETIQUETAS_CATEGORIA = {
    superposicion: 'Superposición',
    medicion: 'Medición y geometría',
    relaciones: 'Relaciones espaciales',
    transformacion: 'Transformación',
    agregacion: 'Agregación',
    interpolacion: 'Interpolación',
    datos: 'Datos y metadatos',
    otros: 'Otras',
  };

  var UNIDADES = [
    'meters', 'kilometers', 'miles', 'nauticalmiles', 'inches', 'yards',
    'feet', 'centimeters', 'millimeters', 'degrees', 'radians',
  ];

  var OPS_RASTER = [
    { id: 'reproyectar', etiqueta: 'Reproyectar a otro SRC' },
    { id: 'recortar', etiqueta: 'Recortar a una extensión' },
    { id: 'redimensionar', etiqueta: 'Redimensionar (outsize)' },
    { id: 'formato', etiqueta: 'Convertir formato' },
  ];

  /* =================================================================== *
   * 3. CLASE DEL PLUGIN
   * =================================================================== */

  class miPlugin_geoprocesos {
    /**
     * @param {Object} [options] Opciones del plugin.
     * @param {string} [options.position='TL'] Esquina del panel (TL, TR, BL, BR).
     * @param {boolean} [options.collapsible=true] Permite plegar el panel.
     * @param {boolean} [options.collapsed=true] Arranca plegado.
     * @param {number|null} [options.order=null] Orden CSS del panel dentro del área.
     * @param {Object|string} [options.color1] Fondo del botón y de la cabecera
     *   ({ active, deactive } o un color único). Por defecto blanco abierto y
     *   naranja cerrado, como el resto de plugins del repositorio.
     * @param {Object|string} [options.color2] Borde y color de acento (botones
     *   principales, pestaña activa, foco). Por defecto naranja.
     * @param {Object|string} [options.color3] Icono y texto de la cabecera. Por
     *   defecto naranja.
     * @param {string} [options.icon] SVG en línea o URL del icono del botón.
     */
    constructor(options) {
      var o = options || {};
      this.name = 'miPlugin_geoprocesos';
      this.options = o;

      this._map = null;
      this._panel = null;
      this._control = null;
      this._raiz = null;

      this.position = o.position || 'TL';
      this.collapsible = (o.collapsible !== undefined) ? Boolean(o.collapsible) : true;
      // Arranca plegado: la herramienta vive sobre el mapa y lo que interesa
      // al entrar es ver el mapa, no un panel de 380 px.
      this.collapsed = (o.collapsed !== undefined) ? Boolean(o.collapsed) : true;
      this.order = (o.order !== undefined && o.order !== null && !Number.isNaN(Number(o.order)))
        ? Number(o.order)
        : null;

      // Colores del panel con el mismo esquema que el resto de plugins
      // (color1 = fondo, color2 = borde/acento, color3 = icono y texto), pero
      // en naranja como el resto de la barra de herramientas del visualizador.
      this.color1 = (o.color1 !== undefined) ? o.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (o.color2 !== undefined) ? o.color2 : { active: 'orangered', deactive: '#ffffff' };
      this.color3 = (o.color3 !== undefined) ? o.color3 : { active: 'orangered', deactive: '#ffffff' };
      this.icon = o.icon || o.icono || o.svg || null;

      // Pestaña activa y función de Turf elegida (es lo único que se conserva
      // entre implementaciones: los resultados no, se reejecutan).
      this._pestana = o.pestana || 'vector';
      this._fnNombre = o.funcion || 'buffer';

      // Estado de las secciones plegables (data-seccion -> abierta) y bandera
      // del arrastre del panel. Ambos se conservan en el cambio 2D/3D.
      this._secciones = {};
      this._arrastrable = false;

      // Catálogo, formulario y capas.
      this._catalogo = [];
      this._fn = null;
      this._lectores = {};
      this._capasPorId = {};
      this._capasResultado = [];

      // Ráster.
      this._ficheroRaster = null;
      this._raster = null;
      this._resultadoRaster = null;
      this._urlsRaster = [];

      this._el = {};
    }

    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    getHelp() {
      var IDEE = api();
      return {
        title: 'Geoprocesos',
        content: new Promise(function (resolve) {
          var html = '<div>'
            + '<p>Herramienta de análisis con cuatro pestañas.</p>'
            + '<p><strong>Vector</strong>: elige cualquiera de las funciones de Turf 7.0.0; '
            + 'el formulario se construye con los parámetros de la función. Cuando un parámetro '
            + 'pide una capa puedes pasar la capa completa, todas las entidades (la función se '
            + 'aplica entidad a entidad) o solo la primera.</p>'
            + '<p><strong>Ráster</strong>: calculadora de bandas sobre GeoTIFF con expresiones '
            + 'del tipo <code>(B4 - B3) / (B4 + B3)</code> y geoprocesos de gdal3.js '
            + '(reproyectar, recortar, redimensionar y convertir formato).</p>'
            + '<p><strong>Importar</strong>: elige la fuente ráster, ya sea una capa GeoTIFF del '
            + 'mapa, un fichero local o una captura de un servicio WMS o TMS del mapa.</p>'
            + '<p><strong>Exportar</strong>: descarga una capa vectorial en los formatos de escritura '
            + 'de gdal3.js (GeoJSON, KML, GeoPackage, Shapefile, GML…) y el último GeoTIFF generado.</p>'
            + '<p>Los resultados se añaden al mapa como capa nueva y, en el caso de los ráster, '
            + 'también se pueden descargar como GeoTIFF con sus valores. Si el resultado tiene una '
            + 'sola banda (un índice, un umbral, una reclasificación), en el mapa se pinta con una '
            + 'rampa de color; el fichero que se descarga conserva los valores originales.</p>'
            + '</div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            try { html = IDEE.utils.stringToHtml(html); } catch (e) { /* se queda el HTML tal cual */ }
          }
          resolve(html);
        }),
      };
    }

    /* ---------------------------------------------------------------- *
     * Búsqueda de capas (los idLayer cambian en cada swap 2D/3D)
     * ---------------------------------------------------------------- */

    _findLayerByIdInMap(mapRef, id) {
      if (!mapRef || typeof mapRef.getLayers !== 'function' || id === null || id === undefined) return null;
      try {
        var esGrupo = function (l) {
          return Boolean(l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function'));
        };
        var pila = [];
        var capas = mapRef.getLayers() || [];
        for (var i = 0; i < capas.length; i += 1) {
          if (capas[i] && String(capas[i].idLayer) === String(id)) return capas[i];
          if (esGrupo(capas[i])) pila.push(capas[i]);
        }
        while (pila.length) {
          var g = pila.pop();
          var hijos = [];
          try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
          for (var j = 0; j < hijos.length; j += 1) {
            if (hijos[j] && String(hijos[j].idLayer) === String(id)) return hijos[j];
            if (esGrupo(hijos[j])) pila.push(hijos[j]);
          }
        }
      } catch (e) { /* sin coincidencia */ }
      return null;
    }

    _findLayerByLegendInMap(mapRef, ident) {
      if (!mapRef || typeof mapRef.getLayers !== 'function' || !ident) return null;
      try {
        var esGrupo = function (l) {
          return Boolean(l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function'));
        };
        var coincide = function (c) {
          return Boolean(c && (
            (c.legend && String(c.legend) === String(ident)) ||
            (c.name && String(c.name) === String(ident))
          ));
        };
        var pila = [];
        var capas = mapRef.getLayers() || [];
        for (var i = 0; i < capas.length; i += 1) {
          if (coincide(capas[i])) return capas[i];
          if (esGrupo(capas[i])) pila.push(capas[i]);
        }
        while (pila.length) {
          var g = pila.pop();
          var hijos = [];
          try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
          for (var j = 0; j < hijos.length; j += 1) {
            if (coincide(hijos[j])) return hijos[j];
            if (esGrupo(hijos[j])) pila.push(hijos[j]);
          }
        }
      } catch (e) { /* sin coincidencia */ }
      return null;
    }

    /* ---------------------------------------------------------------- *
     * Contrato de estado
     * ---------------------------------------------------------------- */

    getState() {
      var panelCollapsed = true;
      if (this._panel) {
        if (this._panel._collapsed !== undefined) {
          panelCollapsed = !!this._panel._collapsed;
        } else if (typeof this._panel.getElement === 'function') {
          var el = this._panel.getElement();
          panelCollapsed = el ? el.classList.contains('collapsed') : true;
        }
      }
      return {
        pestana: this._pestana,
        funcion: this._fnNombre,
        // Estado abierto/cerrado de cada sección plegable.
        secciones: Object.assign({}, this._secciones),
        panelCollapsed: panelCollapsed,
      };
    }

    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      if (state.panelCollapsed !== undefined && this._panel) {
        try {
          if (state.panelCollapsed && typeof this._panel.collapse === 'function') this._panel.collapse();
          else if (!state.panelCollapsed && typeof this._panel.open === 'function') this._panel.open();
        } catch (e) { /* el panel puede no estar montado todavía */ }
      }
      if (state.secciones && typeof state.secciones === 'object') {
        this._secciones = Object.assign({}, this._secciones, state.secciones);
        this._aplicarSecciones();
      }
      if (typeof state.pestana === 'string'
        && ['vector', 'raster', 'importar', 'exportar'].indexOf(state.pestana) >= 0) {
        this._pestana = state.pestana;
        this._cambiarPestana(state.pestana);
      }
      if (typeof state.funcion === 'string' && state.funcion) {
        this._fnNombre = state.funcion;
        if (this._catalogo.length) this._seleccionarFuncion(state.funcion);
      }
      void map;
    }

    /* ---------------------------------------------------------------- *
     * Montaje
     * ---------------------------------------------------------------- */

    _aplicarIcono(panelEl) {
      if (!panelEl || !panelEl.style || !this.icon) return;
      var limpio = String(this.icon).trim();
      if (!limpio) return;
      var esUrl = /^(data:|https?:|blob:|file:|\/|\.\/|\.\.\/)/i.test(limpio) || /\.svg(?:[?#].*)?$/i.test(limpio);
      var url;
      if (esUrl) {
        url = 'url("' + limpio.replace(/"/g, '%22').replace(/\s/g, '%20') + '")';
      } else {
        var traeSvg = /<svg[\s>]/i.test(limpio);
        var svg = traeSvg ? limpio : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' + limpio + '</svg>';
        url = 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27') + '")';
      }
      try { panelEl.style.setProperty('--g-plugin-icon-mask', url); } catch (e) { /* nada */ }
    }

    addTo(map) {
      this._map = map;
      var IDEE = api();
      if (!IDEE || !IDEE.ui || !IDEE.Control) {
        console.error(this.name + ': no se ha encontrado el objeto global de la API (IDEE/M).');
        return;
      }

      inyectarCss();

      var pos = (IDEE.ui.position && IDEE.ui.position[this.position])
        ? IDEE.ui.position[this.position]
        : (IDEE.ui.position ? IDEE.ui.position.TL : 'TL');

      var panel = new IDEE.ui.Panel('tools_geoprocesos', {
        collapsible: this.collapsible,
        collapsed: this.collapsed,
        className: 'g-herramienta_geoprocesos g-panel-lateral',
        collapsedButtonClass: 'm-tools',
        position: pos,
        order: this.order,
      });
      this._panel = panel;

      var control = new IDEE.Control(new IDEE.impl.Control(), 'controlGeoprocesos');
      this._control = control;

      // Identidad estricta: la API llama a equals() en las dos direcciones al
      // retirar controles, y un equals laxo desregistra los de los demás.
      control.equals = function (other) { return other === this; };

      var self = this;
      control.createView = function () {
        var vista = self._crearVista();
        // La API inserta la vista en el panel después de este retorno: el
        // arrastre se engancha en el siguiente turno, cuando la cabecera ya
        // está en el DOM.
        setTimeout(function () { self._hacerArrastrable(); }, 0);
        return vista;
      };

      panel.addControls(control);
      map.addPanels(panel);

      // Si la API ya hubiera creado la vista (algunas versiones lo hacen en
      // addControls), el enganche se hace igualmente: _hacerArrastrable es
      // idempotente.
      this._hacerArrastrable();
      setTimeout(function () { self._vigilarAperturaPanel(); }, 0);

      try {
        var c1 = this.resolveColor(this.color1);
        var c2 = this.resolveColor(this.color2);
        var c3 = this.resolveColor(this.color3);
        var panelEl = (typeof panel.getElement === 'function')
          ? panel.getElement()
          : document.querySelector('.m-panel.g-herramienta_geoprocesos');
        if (panelEl && panelEl.style) {
          panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
          panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
          panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
          panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
          panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
          panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
          this._aplicarIcono(panelEl);
        }
      } catch (e) { /* el elemento aún no está en el DOM */ }

      try { if (control && typeof control.activate === 'function') control.activate(); } catch (e) { /* nada */ }
    }

    /* ---------------------------------------------------------------- *
     * Vista
     * ---------------------------------------------------------------- */

    _crearVista() {
      var self = this;
      var cont = document.createElement('div');
      cont.className = 'm-control m-container m-herramienta gp-container';
      cont.setAttribute('role', 'region');
      cont.setAttribute('aria-label', 'Geoprocesos');

      // Cabecera y secciones siguen el protocolo del resto de paneles del
      // repositorio: la barra de título es .m-herramienta-header (la engancha
      // IDEE.utils.draggabillyPlugin desde addTo) y TODAS las secciones son
      // <details class="gp-seccion"> plegables.
      cont.innerHTML = [
        '<header role="heading" aria-level="3" tabindex="0" id="m-herramienta-title-geoprocesos" class="m-herramienta-header gp-header"><span>Geoprocesos</span></header>',
        '<div class="m-herramienta-contents gp-body">',
        '  <div class="gp-tabs" role="tablist">',
        '    <button type="button" role="tab" class="gp-tab gp-tab--activa" data-tab="vector" aria-selected="true">Vector</button>',
        '    <button type="button" role="tab" class="gp-tab" data-tab="raster" aria-selected="false">Ráster</button>',
        '    <button type="button" role="tab" class="gp-tab" data-tab="importar" aria-selected="false">Importar</button>',
        '    <button type="button" role="tab" class="gp-tab" data-tab="exportar" aria-selected="false">Exportar</button>',
        '  </div>',

        /* ---------------------------- VECTOR ---------------------------- */
        '  <section class="gp-panel" data-panel="vector" role="tabpanel">',
        '    <div class="gp-aviso gp-aviso-impl gp-oculto"></div>',
        '    <details class="gp-seccion" data-seccion="vector-funcion" open>',
        '      <summary class="gp-seccion-titulo">Función de Turf</summary>',
        '      <div class="gp-seccion-cuerpo">',
        '        <div class="gp-bloque">',
        '          <label class="gp-etiqueta" for="gp-funcion">Función de Turf</label>',
        '          <input type="search" class="gp-buscador" placeholder="Buscar función…" aria-label="Buscar función de Turf">',
        '          <select class="gp-select gp-funcion" id="gp-funcion"></select>',
        '          <p class="gp-descripcion"></p>',
        '        </div>',
        '      </div>',
        '    </details>',
        '    <details class="gp-seccion" data-seccion="vector-parametros" open>',
        '      <summary class="gp-seccion-titulo">Parámetros</summary>',
        '      <div class="gp-seccion-cuerpo">',
        '        <form class="gp-formulario" autocomplete="off"></form>',
        '      </div>',
        '    </details>',
        '    <div class="gp-acciones">',
        '      <button type="button" class="gp-btn gp-btn--principal gp-ejecutar">Ejecutar</button>',
        '      <button type="button" class="gp-btn gp-limpiar">Quitar resultados</button>',
        '    </div>',
        '    <div class="gp-estado gp-oculto" role="status" aria-live="polite"></div>',
        '  </section>',

        /* ---------------------------- RÁSTER ---------------------------- */
        '  <section class="gp-panel gp-oculto" data-panel="raster" role="tabpanel">',
        '    <div class="gp-bloque gp-ras-sin-fuente">',
        '      <p class="gp-ayuda">No hay ninguna fuente ráster cargada. En la pestaña <strong>Importar</strong> '
          + 'puedes elegir una capa GeoTIFF del mapa, abrir un fichero o capturar un servicio WMS o TMS.</p>',
        '      <button type="button" class="gp-btn gp-btn--mini gp-ir-importar">Ir a Importar</button>',
        '    </div>',
        '    <details class="gp-seccion gp-oculto gp-ras-calc" data-seccion="raster-calculadora" open>',
        '      <summary class="gp-seccion-titulo">Calculadora de bandas</summary>',
        '      <div class="gp-seccion-cuerpo">',
        '        <div class="gp-bloque">',
        '          <div class="gp-presets">',
        '            <button type="button" class="gp-chip" data-exp="(B4 - B3) / (B4 + B3)">NDVI</button>',
        '            <button type="button" class="gp-chip" data-exp="(B2 - B4) / (B2 + B4)">NDWI</button>',
        '            <button type="button" class="gp-chip" data-exp="B1 > 0 ? 1 : 0">Umbral</button>',
        '            <button type="button" class="gp-chip" data-exp="B1 * 0.0001">Escala</button>',
        '            <button type="button" class="gp-chip" data-exp="(B1 - B2) / (B1 + B2)">Índice</button>',
        '          </div>',
        '          <textarea class="gp-expresion" rows="2" spellcheck="false" placeholder="(B4 - B3) / (B4 + B3)"></textarea>',
        '          <p class="gp-ayuda">B1 es la primera banda, B2 la segunda… <code>Math</code> está disponible. '
          + 'Si el resultado tiene una sola banda, en el mapa se pinta con una rampa de color.</p>',
        '          <button type="button" class="gp-btn gp-btn--principal gp-calcular">Calcular y añadir al mapa</button>',
        '        </div>',
        '      </div>',
        '    </details>',
        '    <details class="gp-seccion gp-oculto gp-ras-gdal" data-seccion="raster-gdal" open>',
        '      <summary class="gp-seccion-titulo">Geoprocesos ráster (gdal3.js)</summary>',
        '      <div class="gp-seccion-cuerpo">',
        '        <div class="gp-bloque">',
        '          <select class="gp-select gp-ras-op"></select>',
        '          <div class="gp-ras-params"></div>',
        '          <button type="button" class="gp-btn gp-ras-ejecutar">Ejecutar</button>',
        '        </div>',
        '      </div>',
        '    </details>',
        '    <div class="gp-estado gp-ras-estado gp-oculto" role="status" aria-live="polite"></div>',
        '  </section>',

        /* --------------------------- IMPORTAR --------------------------- */
        '  <section class="gp-panel gp-oculto" data-panel="importar" role="tabpanel">',
        '    <details class="gp-seccion" data-seccion="raster-fuente" open>',
        '      <summary class="gp-seccion-titulo">Importar ráster (GeoTIFF, WMS o TMS)</summary>',
        '      <div class="gp-seccion-cuerpo">',
        '        <div class="gp-bloque">',
        '          <label class="gp-etiqueta" for="gp-ras-fuente">Capa GeoTIFF del mapa</label>',
        '          <select class="gp-select gp-ras-fuente" id="gp-ras-fuente"></select>',
        '          <label class="gp-etiqueta">…o un fichero local</label>',
        '          <input type="file" class="gp-ras-file" accept=".tif,.tiff,image/tiff">',
        '        </div>',
        '        <div class="gp-bloque gp-ras-servicio-bloque">',
        '          <label class="gp-etiqueta" for="gp-ras-servicio">…o capturar un servicio del mapa (WMS o TMS)</label>',
        '          <select class="gp-select gp-ras-servicio" id="gp-ras-servicio"></select>',
        '          <label class="gp-etiqueta" for="gp-ras-tamano">Tamaño de la captura (lado mayor)</label>',
        '          <select class="gp-select gp-ras-tamano" id="gp-ras-tamano">',
        '            <option value="1024">1024 px</option>',
        '            <option value="2048">2048 px</option>',
        '            <option value="512">512 px</option>',
        '          </select>',
        '          <button type="button" class="gp-btn gp-ras-capturar">Capturar la vista como GeoTIFF</button>',
        '          <p class="gp-ayuda">Pide al servicio el encuadre actual: GetMap a un WMS (en EPSG:3857, '
          + 'con vuelta a EPSG:4326 si no admite Web Mercator) o mosaico de teselas a un TMS. Lo deja '
          + 'cargado para calcular y geoprocesar en la pestaña Ráster y descargarlo desde Exportar. Son '
          + 'los píxeles que pinta el servicio, no los datos originales: para valores reales hace falta '
          + 'un WCS o el GeoTIFF del proveedor.</p>',
        '        </div>',
        '        <dl class="gp-meta gp-ras-meta gp-oculto"></dl>',
        '      </div>',
        '    </details>',
        '    <div class="gp-estado gp-ras-estado-importar gp-oculto" role="status" aria-live="polite"></div>',
        '  </section>',

        /* --------------------------- EXPORTAR --------------------------- */
        '  <section class="gp-panel gp-oculto" data-panel="exportar" role="tabpanel">',
        '    <details class="gp-seccion" data-seccion="vector-exportar" open>',
        '      <summary class="gp-seccion-titulo">Exportar capa vectorial</summary>',
        '      <div class="gp-seccion-cuerpo">',
        '        <div class="gp-bloque">',
        '          <label class="gp-etiqueta">Capa</label>',
        '          <select class="gp-select gp-exp-capa"></select>',
        '          <label class="gp-etiqueta">Formato (gdal3.js)</label>',
        '          <select class="gp-select gp-exp-formato"></select>',
        '          <button type="button" class="gp-btn gp-exp-btn">Exportar y descargar</button>',
        '          <div class="gp-estado gp-exp-estado gp-oculto" role="status" aria-live="polite"></div>',
        '        </div>',
        '      </div>',
        '    </details>',
        '    <details class="gp-seccion gp-oculto gp-ras-resultado" data-seccion="raster-resultado" open>',
        '      <summary class="gp-seccion-titulo">Resultado ráster (GeoTIFF)</summary>',
        '      <div class="gp-seccion-cuerpo">',
        '        <div class="gp-bloque">',
        '          <p class="gp-resumen"></p>',
        '          <button type="button" class="gp-btn gp-ras-descargar">Descargar GeoTIFF</button>',
        '          <div class="gp-rampa gp-oculto">',
        '            <div class="gp-rampa-barra"></div>',
        '            <p class="gp-rampa-texto gp-ayuda"></p>',
        '          </div>',
        '        </div>',
        '      </div>',
        '    </details>',
        '  </section>',
        '</div>',
      ].join('\n');

      this._raiz = cont;
      var qs = function (sel) { return cont.querySelector(sel); };
      this._el = {
        tabs: cont.querySelectorAll('.gp-tab'),
        paneles: cont.querySelectorAll('.gp-panel'),
        avisoImpl: qs('.gp-aviso-impl'),
        buscador: qs('.gp-buscador'),
        funcion: qs('.gp-funcion'),
        descripcion: qs('.gp-descripcion'),
        formulario: qs('.gp-formulario'),
        ejecutar: qs('.gp-ejecutar'),
        limpiar: qs('.gp-limpiar'),
        estado: qs('.gp-estado'),
        expCapa: qs('.gp-exp-capa'),
        expFormato: qs('.gp-exp-formato'),
        expBtn: qs('.gp-exp-btn'),
        expEstado: qs('.gp-exp-estado'),
        rasFuente: qs('.gp-ras-fuente'),
        rasFile: qs('.gp-ras-file'),
        rasServicio: qs('.gp-ras-servicio'),
        rasTamano: qs('.gp-ras-tamano'),
        rasCapturar: qs('.gp-ras-capturar'),
        rasMeta: qs('.gp-ras-meta'),
        rasSinFuente: qs('.gp-ras-sin-fuente'),
        rasEstadoImportar: qs('.gp-ras-estado-importar'),
        rasCalc: qs('.gp-ras-calc'),
        expresion: qs('.gp-expresion'),
        calcular: qs('.gp-calcular'),
        rasGdal: qs('.gp-ras-gdal'),
        rasOp: qs('.gp-ras-op'),
        rasParams: qs('.gp-ras-params'),
        rasEjecutar: qs('.gp-ras-ejecutar'),
        rasEstado: qs('.gp-ras-estado'),
        rasResultado: qs('.gp-ras-resultado'),
        rasResumen: qs('.gp-resumen'),
        rasDescargar: qs('.gp-ras-descargar'),
        rasRampa: qs('.gp-rampa'),
        rasRampaBarra: qs('.gp-rampa-barra'),
        rasRampaTexto: qs('.gp-rampa-texto'),
      };

      // Pestañas.
      Array.prototype.forEach.call(this._el.tabs, function (tab) {
        tab.addEventListener('click', function () { self._cambiarPestana(tab.getAttribute('data-tab')); });
      });
      // Atajo de la pestaña Ráster cuando todavía no hay fuente cargada.
      var irImportar = qs('.gp-ir-importar');
      if (irImportar) {
        irImportar.addEventListener('click', function () { self._cambiarPestana('importar'); });
      }

      // Vector.
      this._el.buscador.addEventListener('input', function () {
        self._rellenarFunciones(self._el.buscador.value);
      });
      this._el.funcion.addEventListener('change', function () {
        self._seleccionarFuncion(self._el.funcion.value);
      });
      this._el.ejecutar.addEventListener('click', function () { self._ejecutarVector(); });
      this._el.limpiar.addEventListener('click', function () { self._limpiarResultados(); });
      this._el.expBtn.addEventListener('click', function () { self._exportarVector(); });

      // Ráster.
      this._el.rasFuente.addEventListener('change', function () {
        self._ficheroRaster = null;
        self._cargarFuenteRaster();
      });
      this._el.rasFile.addEventListener('change', function () {
        var f = self._el.rasFile.files && self._el.rasFile.files[0];
        self._ficheroRaster = f || null;
        if (f) self._el.rasFuente.value = '';
        self._cargarFuenteRaster();
      });
      this._el.rasCapturar.addEventListener('click', function () { self._capturarServicioRaster(); });
      Array.prototype.forEach.call(cont.querySelectorAll('.gp-chip'), function (chip) {
        chip.addEventListener('click', function () {
          self._el.expresion.value = chip.getAttribute('data-exp') || '';
          self._el.expresion.focus();
        });
      });
      this._el.calcular.addEventListener('click', function () { self._calcularRaster(); });
      this._el.rasOp.addEventListener('change', function () { self._pintarParamsRaster(); });
      this._el.rasEjecutar.addEventListener('click', function () { self._ejecutarGdalRaster(); });
      this._el.rasDescargar.addEventListener('click', function () { self._descargarResultadoRaster(); });

      // La exportación necesita GDAL (28 MB): se empieza a cargar al abrir la
      // sección, no al montar el plugin, para no castigar al que solo quiere
      // un buffer.
      var detalles = cont.querySelector('[data-seccion="vector-exportar"]');
      this._el.expDetalles = detalles;
      if (detalles) {
        detalles.addEventListener('toggle', function () {
          if (detalles.open) self._cargarDriversVector();
        });
      }

      // Secciones plegables: se recuerda su estado para conservarlo en el
      // cambio 2D/3D (getState/setState) y se reaplica el que hubiera.
      Array.prototype.forEach.call(cont.querySelectorAll('.gp-seccion[data-seccion]'), function (det) {
        var clave = det.getAttribute('data-seccion');
        det.addEventListener('toggle', function () {
          if (clave) self._secciones[clave] = det.open;
        });
      });
      this._aplicarSecciones();

      this._cambiarPestana(this._pestana);
      this._actualizarAvisoImpl();
      this._refrescarCapas();

      return cont;
    }

    _cambiarPestana(nombre) {
      if (['vector', 'raster', 'importar', 'exportar'].indexOf(nombre) < 0) return;
      this._pestana = nombre;
      // La vista puede no estar creada todavía (setState llega antes de que la
      // API construya el control); _crearVista vuelve a llamar aquí al final.
      if (!this._el.tabs) return;
      var self = this;
      Array.prototype.forEach.call(this._el.tabs, function (t) {
        var activa = t.getAttribute('data-tab') === nombre;
        t.classList.toggle('gp-tab--activa', activa);
        t.setAttribute('aria-selected', activa ? 'true' : 'false');
      });
      Array.prototype.forEach.call(this._el.paneles, function (p) {
        p.classList.toggle('gp-oculto', p.getAttribute('data-panel') !== nombre);
      });
      if (nombre === 'vector') {
        if (!this._catalogo.length) this._cargarCatalogoYFunciones();
        else this._refrescarCapas();
      }
      if (nombre === 'raster') {
        if (!this._el.rasOp.options.length) this._inicializarRaster();
        this._refrescarCapas();
        // El aviso de «sin fuente» depende solo de si hay un GeoTIFF abierto.
        if (this._el.rasSinFuente) this._el.rasSinFuente.classList.toggle('gp-oculto', !!this._raster);
      }
      if (nombre === 'importar' || nombre === 'exportar') {
        // Las listas de capas y de servicios se rehacen al entrar: el mapa
        // puede haber ganado capas desde la última vez que se abrió la pestaña.
        this._refrescarCapas();
      }
      void self;
    }

    /**
     * Reaplica el estado guardado de las secciones plegables.
     *
     * Se llama al construir la vista (para recuperar lo que haya en
     * `this._secciones`) y desde `setState` tras el cambio 2D/3D. Las secciones
     * sin estado guardado se quedan como las deje el HTML (`open` o cerradas).
     */
    _aplicarSecciones() {
      if (!this._raiz) return;
      var self = this;
      Array.prototype.forEach.call(this._raiz.querySelectorAll('.gp-seccion[data-seccion]'), function (det) {
        var clave = det.getAttribute('data-seccion');
        if (clave && self._secciones[clave] !== undefined) det.open = !!self._secciones[clave];
      });
    }

    /**
     * Engancha el arrastre del panel a su barra de título.
     *
     * El protocolo del repositorio es el de baseLayer/catalogo:
     * `IDEE.utils.draggabillyPlugin(panel, selectorDeLaCabecera)`. Se difiere
     * al siguiente turno porque la API inserta en el DOM la vista que devuelve
     * `control.createView()` DESPUÉS de que esta función retorne.
     */
    _hacerArrastrable() {
      var IDEE = api();
      if (!this._panel || !IDEE || !IDEE.utils || typeof IDEE.utils.draggabillyPlugin !== 'function') return;
      var cabecera = document.getElementById('m-herramienta-title-geoprocesos');
      if (!cabecera) return;
      // Si la vista se recrea, el panel ya está enganchado: no se duplica.
      if (this._arrastrable) return;
      this._arrastrable = true;
      try {
        IDEE.utils.draggabillyPlugin(this._panel, '#m-herramienta-title-geoprocesos');
      } catch (e) {
        this._arrastrable = false;
        console.warn(this.name + ': no se pudo hacer arrastrable la barra de título.', e);
      }
    }

    /**
     * Rehace la lista de servicios WMS/TMS al abrir el panel.
     *
     * Los fondos del mapa (la capa base) se crean al aplicar la configuración,
     * que puede ser después de montar el plugin: sin esto, la primera vez que
     * se abre la pestaña Importar el desplegable puede no tener todavía el TMS
     * de la capa base.
     */
    _vigilarAperturaPanel() {
      if (this._escuchaPanel) return;
      var panelEl = (this._panel && typeof this._panel.getElement === 'function')
        ? this._panel.getElement()
        : document.querySelector('.m-panel.g-herramienta_geoprocesos');
      if (!panelEl) return;
      this._escuchaPanel = true;
      var self = this;
      panelEl.addEventListener('click', function (evt) {
        var destino = evt.target;
        if (destino && typeof destino.closest === 'function' && destino.closest('.m-panel-btn')) {
          self._refrescarServicios();
        }
      });
    }

    /** Detecta Cesium sin depender del bundle cargado. */
    _esCesium() {
      try {
        var impl = this._map && typeof this._map.getMapImpl === 'function' ? this._map.getMapImpl() : null;
        return !!(impl && impl.scene && impl.scene.camera && typeof Cesium !== 'undefined');
      } catch (e) {
        return false;
      }
    }

    _actualizarAvisoImpl() {
      if (!this._el.avisoImpl) return;
      if (this._esCesium()) {
        this._el.avisoImpl.textContent = 'Estás en 3D (Cesium). Los geoprocesos vectoriales leen las entidades '
          + 'con getFeatures(), que en Cesium devuelve vacío: cambia a 2D para procesar capas vectoriales. '
          + 'Las pestañas Importar y Ráster funcionan igual.';
        this._el.avisoImpl.classList.remove('gp-oculto');
        this._el.ejecutar.disabled = true;
      } else {
        this._el.avisoImpl.classList.add('gp-oculto');
        this._el.ejecutar.disabled = false;
      }
    }

    /** Rehace las listas de capas de los dos selectores. */
    _refrescarCapas() {
      this._snapshotForm();
      this._capasPorId = {};
      var vectoriales = this._capasVectoriales();
      var raster = this._capasRaster();

      var selExp = this._el.expCapa;
      var previo = selExp.value;
      selExp.innerHTML = '';
      vectoriales.forEach(function (c) {
        selExp.appendChild(opcion(this._idCapa(c), this._nombreCapa(c)));
      }, this);
      if (previo && this._capaPorId(previo)) selExp.value = previo;

      var selRas = this._el.rasFuente;
      var previoRas = selRas.value;
      selRas.innerHTML = '';
      selRas.appendChild(opcion('', '— elige una capa GeoTIFF —'));
      raster.forEach(function (c) {
        selRas.appendChild(opcion(this._idCapa(c), this._nombreCapa(c)));
      }, this);
      if (previoRas && this._capaPorId(previoRas)) selRas.value = previoRas;

      this._refrescarServicios();

      // Si el formulario ya estaba pintado, se repintan sus desplegables de capa.
      if (this._fn && this._el.formulario) this._renderFormulario(this._fn);
    }

    /**
     * Rehace solo el desplegable de servicios WMS/TMS.
     *
     * Va aparte de `_refrescarCapas` porque el mapa puede ganar la capa base
     * después de montar el plugin (los fondos se crean al aplicar la
     * configuración del mapa) y la pestaña Importar tiene que verla sin esperar a
     * que cambie nada más.
     */
    _refrescarServicios() {
      var selServ = this._el && this._el.rasServicio;
      if (!selServ) return;
      var servicios = this._capasServicioRaster();
      var previoServ = selServ.value;
      selServ.innerHTML = '';
      selServ.appendChild(opcion('', servicios.length
        ? '— elige un servicio WMS o TMS —'
        : '— el mapa no tiene capas WMS ni TMS —'));
      servicios.forEach(function (c) {
        selServ.appendChild(opcion(this._idCapa(c), this._nombreCapa(c)));
      }, this);
      if (previoServ && this._capaPorId(previoServ)) selServ.value = previoServ;
      if (this._el.rasCapturar) this._el.rasCapturar.disabled = !servicios.length;
    }

    /* ---------------------------------------------------------------- *
     * Capas
     * ---------------------------------------------------------------- */

    _capasVectoriales() {
      var out = [];
      var self = this;
      var recorrer = function (l) {
        if (!l) return;
        var esGrupo = (l.type === 'LayerGroup' || l._type === 'LayerGroup') && typeof l.getLayers === 'function';
        if (esGrupo && typeof l.getFeatures !== 'function') {
          (l.getLayers() || []).forEach(recorrer);
          return;
        }
        if (self._esVectorial(l)) out.push(l);
      };
      try { (this._map.getLayers() || []).forEach(recorrer); } catch (e) { /* mapa no listo */ }
      // `__draw__` es la capa interna de dibujo de la API: no es del usuario y
      // no tiene sentido ofrecerla para geoprocesos ni para exportar.
      return out.filter(function (l) {
        return String(l.name || '') !== '__draw__' && String(l.legend || '') !== '__draw__';
      });
    }

    _esVectorial(capa) {
      if (!capa) return false;
      if (typeof capa.getFeatures === 'function') return true;
      return /GeoJSON|WFS|KML|Vector|MVT|MBTilesVector|OGCAPI|GeoPackage/i.test(String(capa.type || ''));
    }

    _capasRaster() {
      var out = [];
      var self = this;
      var recorrer = function (l) {
        if (!l) return;
        var esGrupo = (l.type === 'LayerGroup' || l._type === 'LayerGroup') && typeof l.getLayers === 'function';
        if (esGrupo && typeof l.getFeatures !== 'function') {
          (l.getLayers() || []).forEach(recorrer);
          return;
        }
        if (self._esRaster(l)) out.push(l);
      };
      try { (this._map.getLayers() || []).forEach(recorrer); } catch (e) { /* mapa no listo */ }
      return out;
    }

    _esRaster(capa) {
      if (!capa) return false;
      var t = String(capa.type || '');
      if (/GeoTIFF|GenericRaster/i.test(t)) return true;
      // Cualquier otra capa con un fichero ráster en `blob` (extensiones).
      // No vale con que tenga `url`: un TMS o un WMS también la tienen y no
      // son un fichero que se pueda abrir con geotiff.js.
      return !!(capa.options && capa.options.blob);
    }

    /**
     * Capas de servicio ráster del mapa. No se abren como fichero, pero sí se
     * les puede pedir un GeoTIFF del encuadre actual: GetMap a un WMS
     * (`_getMapServicio`) o mosaico de teselas a un TMS (`_capturarTms`).
     * @returns {Array<Object>} Capas WMS/TMS.
     */
    _capasServicioRaster() {
      var out = [];
      var self = this;
      var recorrer = function (l) {
        if (!l) return;
        var esGrupo = (l.type === 'LayerGroup' || l._type === 'LayerGroup') && typeof l.getLayers === 'function';
        if (esGrupo && typeof l.getFeatures !== 'function') {
          (l.getLayers() || []).forEach(recorrer);
          return;
        }
        if (self._esServicioRaster(l)) out.push(l);
      };
      try { (this._map.getLayers() || []).forEach(recorrer); } catch (e) { /* mapa no listo */ }
      return out.filter(function (l) {
        return String(l.name || '') !== '__draw__' && String(l.legend || '') !== '__draw__';
      });
    }

    /** ¿Es un servicio del que se puede obtener un GeoTIFF del encuadre? */
    _esServicioRaster(capa) {
      return !!(capa && /^(WMS|TMS|XYZ)$/i.test(String(capa.type || '')));
    }

    /** ¿Se resuelve con mosaico de teselas (TMS/XYZ) y no con GetMap? */
    _esServicioTeselado(capa) {
      return !!(capa && /^(TMS|XYZ)$/i.test(String(capa.type || '')));
    }

    /**
     * Fichero de una capa ráster: Blob o URL, mire donde lo mire la capa.
     * `IDEE.layer.GeoTIFF` lo guarda en `options.blob` y en la implementación.
     * @param {Object} capa Capa de la API.
     * @returns {Blob|string|null}
     */
    _fuenteDeCapa(capa) {
      if (!capa) return null;
      if (capa.blob !== undefined && capa.blob !== null) return capa.blob;
      if (capa.options && capa.options.blob) return capa.options.blob;
      try {
        var impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
        if (impl && impl.blob) return impl.blob;
      } catch (e) { /* sin implementación accesible */ }
      if (capa.url && /GeoTIFF|GenericRaster/i.test(String(capa.type || ''))) return capa.url;
      return null;
    }

    _idCapa(capa) {
      return String(capa.idLayer || capa.legend || capa.name || '');
    }

    _nombreCapa(capa) {
      return String(capa.legend || capa.name || capa.idLayer || 'capa');
    }

    _capaPorId(id) {
      if (!id) return null;
      if (this._capasPorId[id]) return this._capasPorId[id];
      var capa = this._findLayerByIdInMap(this._map, id) || this._findLayerByLegendInMap(this._map, id);
      if (capa) this._capasPorId[id] = capa;
      return capa;
    }

    /**
     * GeoJSON de una capa vectorial, normalizado a FeatureCollection y en
     * EPSG:4326 (que es lo que espera Turf).
     *
     * Se intenta `toGeoJSON()` (algunas capas lo traen), luego `getFeatures()`
     * (lo normal en la API) y por último un `geojson`/`source` propio.
     * @param {Object} capa Capa de la API.
     * @returns {Object|null} FeatureCollection o null.
     */
    _geoJSONDeCapa(capa) {
      if (!capa) return null;
      var bruto = null;
      try {
        if (typeof capa.toGeoJSON === 'function') bruto = capa.toGeoJSON();
      } catch (e) { bruto = null; }
      if (!bruto || !bruto.type) {
        try {
          if (typeof capa.getFeatures === 'function') {
            var feats = capa.getFeatures() || [];
            if (feats.length) {
              bruto = {
                type: 'FeatureCollection',
                features: feats.map(function (f) {
                  if (f && typeof f.getGeoJSON === 'function') return f.getGeoJSON();
                  return f;
                }),
              };
            }
          }
        } catch (e) { bruto = null; }
      }
      if (!bruto || !bruto.type) {
        if (capa.geojson) bruto = capa.geojson;
        else if (capa.source && typeof capa.source === 'object') bruto = capa.source;
      }
      var fc = aFeatureCollection(bruto);
      if (!fc) return null;
      return this._asegurar4326(fc);
    }

    /**
     * Red de seguridad de proyección: si las coordenadas no son grados
     * (|x| > 180 o |y| > 90) se reproyectan de 3857 a 4326. Así Turf nunca
     * recibe metros por accidente.
     * @param {Object} fc FeatureCollection.
     * @returns {Object} La misma colección, reproyectada si hacía falta.
     */
    _asegurar4326(fc) {
      var primera = null;
      var buscar = function (geom) {
        if (!geom || primera) return;
        if (geom.type === 'GeometryCollection') {
          (geom.geometries || []).forEach(buscar);
          return;
        }
        var c = geom.coordinates;
        while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
        if (Array.isArray(c) && c.length >= 2) primera = c;
      };
      (fc.features || []).forEach(function (f) { buscar(f && f.geometry); });
      if (!primera) return fc;
      if (Math.abs(primera[0]) <= 180 && Math.abs(primera[1]) <= 90) return fc;

      var IDEE = api();
      if (!IDEE || !IDEE.utils || typeof IDEE.utils.reproject !== 'function') return fc;

      var reproyectar = function (geom) {
        if (!geom) return geom;
        if (geom.type === 'GeometryCollection') {
          return {
            type: 'GeometryCollection',
            geometries: (geom.geometries || []).map(reproyectar),
          };
        }
        var transformar = function (c) {
          if (!Array.isArray(c)) return c;
          if (typeof c[0] === 'number') {
            try { return IDEE.utils.reproject(c, 'EPSG:3857', 'EPSG:4326'); } catch (e) { return c; }
          }
          return c.map(transformar);
        };
        return { type: geom.type, coordinates: transformar(geom.coordinates) };
      };

      return {
        type: 'FeatureCollection',
        features: (fc.features || []).map(function (f) {
          return {
            type: 'Feature',
            id: f.id,
            properties: f.properties || {},
            geometry: reproyectar(f.geometry),
          };
        }),
      };
    }

    /* =================================================================== *
     * 4. PESTAÑA VECTOR · CATÁLOGO Y FORMULARIO
     * =================================================================== */

    /** Pinta un mensaje de estado en un contenedor `.gp-estado`. */
    _estado(el, texto, tipo) {
      if (!el) return;
      el.textContent = texto || '';
      el.classList.remove('gp-estado--info', 'gp-estado--ok', 'gp-estado--error', 'gp-estado--cargando');
      if (tipo) el.classList.add('gp-estado--' + tipo);
      el.classList.toggle('gp-oculto', !texto);
    }

    /** Busca una función ejecutable del catálogo por nombre. */
    _buscarFuncion(nombre) {
      for (var i = 0; i < this._catalogo.length; i += 1) {
        var f = this._catalogo[i];
        if (f.nombre === nombre) return f.noEjecutable ? null : f;
      }
      return null;
    }

    async _cargarCatalogoYFunciones() {
      if (this._catalogo.length) return;
      try {
        this._estado(this._el.estado, 'Cargando el catálogo de Turf…', 'cargando');
        var catalogo = await cargarCatalogo();
        this._catalogo = catalogo.slice();
        this._rellenarFunciones('');
        var inicial = this._buscarFuncion(this._fnNombre) ? this._fnNombre : (this._el.funcion.value || '');
        if (inicial) this._seleccionarFuncion(inicial);
        this._estado(this._el.estado, '', '');
      } catch (e) {
        this._estado(this._el.estado, 'No se ha podido cargar el catálogo de Turf: ' + e.message, 'error');
      }
    }

    /**
     * Rellena el desplegable de funciones, agrupadas por categoría.
     * @param {string} filtro Texto de búsqueda (nombre o descripción).
     */
    _rellenarFunciones(filtro) {
      var sel = this._el.funcion;
      if (!sel) return;
      var texto = String(filtro || '').trim().toLowerCase();
      var previo = sel.value || this._fnNombre;
      var grupos = {};
      var orden = [];

      sel.innerHTML = '';
      this._catalogo.forEach(function (f) {
        if (f.noEjecutable) return;
        if (texto) {
          var nombre = String(f.nombre).toLowerCase();
          var desc = String(f.descripcion || '').toLowerCase();
          if (nombre.indexOf(texto) < 0 && desc.indexOf(texto) < 0) return;
        }
        var cat = f.categoria || 'otros';
        if (!grupos[cat]) {
          grupos[cat] = document.createElement('optgroup');
          grupos[cat].label = ETIQUETAS_CATEGORIA[cat] || cat;
          orden.push(cat);
        }
        grupos[cat].appendChild(opcion(f.nombre, f.nombre));
      });
      orden.forEach(function (c) { sel.appendChild(grupos[c]); });

      if (!orden.length) {
        sel.appendChild(opcion('', '— sin resultados —'));
        sel.value = '';
        this._el.descripcion.textContent = '';
        this._el.formulario.innerHTML = '';
        this._el.ejecutar.disabled = true;
        return;
      }

      var existe = false;
      for (var i = 0; i < sel.options.length; i += 1) {
        if (sel.options[i].value === previo) { existe = true; break; }
      }
      if (existe) sel.value = previo;
      else sel.selectedIndex = 0;

      if (sel.value !== this._fnNombre) this._seleccionarFuncion(sel.value);
      else this._actualizarDescripcion();
    }

    _actualizarDescripcion() {
      var f = this._fn;
      if (!f || !this._el.descripcion) return;
      var trozos = [];
      if (f.descripcion && f.descripcion !== f.nombre) trozos.push(f.descripcion);
      if (f.paquete) trozos.push(f.paquete);
      if (f.retorno) trozos.push('devuelve ' + f.retorno);
      this._el.descripcion.textContent = trozos.join(' · ');
    }

    /**
     * Selecciona una función y pinta su formulario. Es el punto de entrada
     * también desde `setState`, por eso comprueba que exista el DOM.
     * @param {string} nombre Nombre de la función de Turf.
     */
    _seleccionarFuncion(nombre) {
      var f = this._buscarFuncion(nombre);
      if (!f) return;
      if (this._fnNombre !== nombre) this._valoresFn = null;
      this._fnNombre = nombre;
      this._fn = f;
      if (this._el.funcion && this._el.funcion.value !== nombre) this._el.funcion.value = nombre;
      this._actualizarDescripcion();
      if (this._el.formulario) this._renderFormulario(f);
    }

    /** Valor inicial de un parámetro, a partir del JSDoc del catálogo. */
    _valorInicial(p) {
      var d = sinComillas(p.porDefecto);
      if (d === null || d === undefined || d === '' || d === 'undefined' || d === 'null') return '';
      if (d === 'true') return true;
      if (d === 'false') return false;
      return d;
    }

    /**
     * Modo de entrega por defecto de un parámetro que pide una capa.
     *
     * La regla que se acordó para el panel:
     *   · si el tipo declara FeatureCollection → la capa completa;
     *   · si es la única capa de la función y no es FC → entidad a entidad;
     *   · si hay varias capas → solo la primera entidad (así no se multiplica
     *     el trabajo por accidente cuando la función es binaria, p. ej.
     *     pointToLineDistance).
     */
    _modoPorDefecto(p, f) {
      var cuantas = 0;
      (f.parametros || []).forEach(function (x) { if (x.tipoControl === 'capa') cuantas += 1; });
      if (/FeatureCollection/.test(String(p.tipo || ''))) return 'fc';
      return cuantas > 1 ? 'entidad' : 'todas';
    }

    /** Valor guardado de un control (para no perderlo al repintar el form). */
    _valorGuardado(param, rol) {
      var v = this._valoresFn;
      if (!v || v.funcion !== this._fnNombre || !v.valores[param]) return undefined;
      return v.valores[param][rol];
    }

    /**
     * Pinta el formulario de una función a partir de sus parámetros.
     * @param {Object} f Entrada del catálogo.
     */
    _renderFormulario(f) {
      var form = this._el.formulario;
      if (!form) return;
      var self = this;
      form.innerHTML = '';

      var tieneCallback = false;
      (f.parametros || []).forEach(function (p) {
        if (p.tipoControl === 'funcion') { tieneCallback = true; return; }

        var campo = document.createElement('div');
        campo.className = 'gp-campo gp-campo--' + p.tipoControl;
        campo.setAttribute('data-param', p.nombre);
        campo.setAttribute('data-control', p.tipoControl);

        var etiqueta = document.createElement('label');
        etiqueta.className = 'gp-etiqueta';
        etiqueta.textContent = p.nombre + (p.opcional ? ' (opcional)' : '');
        campo.appendChild(etiqueta);
        campo.appendChild(self._controlPara(p, f));

        if (p.descripcion && p.descripcion !== f.nombre) {
          var ayuda = document.createElement('p');
          ayuda.className = 'gp-ayuda';
          ayuda.textContent = p.descripcion;
          campo.appendChild(ayuda);
        }
        form.appendChild(campo);
      });

      if (!form.children.length) {
        var vacio = document.createElement('p');
        vacio.className = 'gp-ayuda';
        vacio.textContent = 'Esta función no necesita parámetros.';
        form.appendChild(vacio);
      }

      if (tieneCallback) {
        var aviso = document.createElement('p');
        aviso.className = 'gp-aviso';
        aviso.textContent = 'Esta función necesita una función de callback: no se puede ejecutar desde el panel.';
        form.appendChild(aviso);
      }

      this._el.ejecutar.disabled = tieneCallback || this._esCesium();
    }

    /** Crea un <select> con opciones [valor, texto]. */
    _selectSimple(rol, opcionesLista, seleccionado, clase) {
      var sel = document.createElement('select');
      sel.className = clase || 'gp-select';
      sel.setAttribute('data-rol', rol);
      opcionesLista.forEach(function (o) {
        var op = opcion(o[0], o[1]);
        if (String(seleccionado) === String(o[0])) op.selected = true;
        sel.appendChild(op);
      });
      return sel;
    }

    /** Crea un <input> con su rol. */
    _inputSimple(rol, tipo, valor, attrs) {
      var inp = document.createElement('input');
      inp.className = 'gp-input';
      inp.type = tipo;
      inp.setAttribute('data-rol', rol);
      if (valor !== undefined && valor !== null) inp.value = String(valor);
      Object.keys(attrs || {}).forEach(function (k) { inp.setAttribute(k, attrs[k]); });
      return inp;
    }

    /**
     * Devuelve el control (o los controles) de un parámetro.
     * Todos los controles llevan `data-rol`, que es lo que leen
     * `_leerCampo` y `_snapshotForm`.
     * @param {Object} p Parámetro del catálogo.
     * @param {Object} f Función a la que pertenece.
     * @returns {DocumentFragment}
     */
    _controlPara(p, f) {
      var self = this;
      var frag = document.createDocumentFragment();
      var guardado = this._valorGuardado(p.nombre, 'valor');

      switch (p.tipoControl) {
        case 'capa': {
          var sel = document.createElement('select');
          sel.className = 'gp-select';
          sel.setAttribute('data-rol', 'capa');
          var capas = this._capasVectoriales();
          var idPrevio = this._valorGuardado(p.nombre, 'capa');
          if (!idPrevio) {
            idPrevio = this._ultimaCapaId && this._capaPorId(this._ultimaCapaId) ? this._ultimaCapaId : '';
          }
          // Un parámetro opcional (p. ej. `options.mask` de hexGrid) empieza sin
          // capa: si se preseleccionara la primera, Turf recibiría una máscara
          // que nadie ha pedido y fallaría.
          if (p.opcional) sel.appendChild(opcion('', '— ninguna —'));
          if (!capas.length) {
            sel.appendChild(opcion('', '— no hay capas vectoriales en el mapa —'));
          } else {
            capas.forEach(function (c) {
              var op = opcion(self._idCapa(c), self._nombreCapa(c));
              if (idPrevio && String(idPrevio) === String(self._idCapa(c))) op.selected = true;
              sel.appendChild(op);
            });
            if (!sel.value && !p.opcional) sel.selectedIndex = 0;
          }
          frag.appendChild(sel);

          var modo = this._selectSimple('modo', [
            ['fc', 'Capa completa'],
            ['todas', 'Entidad a entidad'],
            ['entidad', 'Solo la primera entidad'],
          ], this._valorGuardado(p.nombre, 'modo') || this._modoPorDefecto(p, f), 'gp-select gp-select--modo');
          frag.appendChild(modo);
          break;
        }

        case 'capas': {
          var selM = document.createElement('select');
          selM.className = 'gp-select gp-select--multiple';
          selM.setAttribute('data-rol', 'valor');
          selM.multiple = true;
          selM.size = 4;
          var previos = this._valorGuardado(p.nombre, 'valor') || [];
          var capasM = this._capasVectoriales();
          if (!capasM.length) selM.appendChild(opcion('', '— no hay capas vectoriales —'));
          capasM.forEach(function (c) {
            var op = opcion(self._idCapa(c), self._nombreCapa(c));
            if (previos.indexOf(String(self._idCapa(c))) >= 0) op.selected = true;
            selM.appendChild(op);
          });
          frag.appendChild(selM);
          var notaM = document.createElement('p');
          notaM.className = 'gp-ayuda';
          notaM.textContent = 'Ctrl/Cmd + clic para elegir varias capas.';
          frag.appendChild(notaM);
          break;
        }

        case 'numero': {
          var vNum = guardado !== undefined ? guardado : this._valorInicial(p);
          frag.appendChild(this._inputSimple('valor', 'number', vNum, { step: 'any', placeholder: 'número' }));
          break;
        }

        case 'texto': {
          var vTxt = guardado !== undefined ? guardado : this._valorInicial(p);
          frag.appendChild(this._inputSimple('valor', 'text', vTxt, { placeholder: 'texto' }));
          break;
        }

        case 'booleano': {
          var etiquetaCb = document.createElement('label');
          etiquetaCb.className = 'gp-check';
          var cb = this._inputSimple('valor', 'checkbox', '', {});
          cb.checked = guardado === true || (guardado === undefined && this._valorInicial(p) === true);
          etiquetaCb.appendChild(cb);
          var txt = document.createElement('span');
          txt.textContent = 'activar' + (p.porDefecto ? ' (por defecto: ' + sinComillas(p.porDefecto) + ')' : '');
          etiquetaCb.appendChild(txt);
          frag.appendChild(etiquetaCb);
          break;
        }

        case 'unidades': {
          var vUni = guardado !== undefined ? guardado : sinComillas(p.porDefecto);
          var lista = UNIDADES.map(function (u) { return [u, u]; });
          if (vUni && UNIDADES.indexOf(vUni) < 0) lista.unshift([vUni, vUni]);
          frag.appendChild(this._selectSimple('valor', lista, vUni || 'kilometers'));
          break;
        }

        case 'coordenada': {
          var cx = this._valorGuardado(p.nombre, 'x');
          var cy = this._valorGuardado(p.nombre, 'y');
          var fila = document.createElement('div');
          fila.className = 'gp-fila';
          fila.appendChild(this._inputSimple('x', 'number', cx !== undefined ? cx : '', { step: 'any', placeholder: 'longitud' }));
          fila.appendChild(this._inputSimple('y', 'number', cy !== undefined ? cy : '', { step: 'any', placeholder: 'latitud' }));
          frag.appendChild(fila);
          break;
        }

        case 'bbox': {
          var filaB = document.createElement('div');
          filaB.className = 'gp-fila gp-fila--bbox';
          [['minx', 'mín. X'], ['miny', 'mín. Y'], ['maxx', 'máx. X'], ['maxy', 'máx. Y']].forEach(function (par) {
            var v = self._valorGuardado(p.nombre, par[0]);
            filaB.appendChild(self._inputSimple(par[0], 'number', v !== undefined ? v : '', { step: 'any', placeholder: par[1] }));
          });
          frag.appendChild(filaB);
          var btnB = document.createElement('button');
          btnB.type = 'button';
          btnB.className = 'gp-btn gp-btn--mini';
          btnB.textContent = 'Usar la vista actual';
          btnB.addEventListener('click', function () {
            var b = self._bboxVista();
            if (!b) return;
            ['minx', 'miny', 'maxx', 'maxy'].forEach(function (rol, i) {
              var inp = filaB.querySelector('[data-rol="' + rol + '"]');
              if (inp) inp.value = b[i];
            });
            self._snapshotForm();
          });
          frag.appendChild(btnB);
          break;
        }

        case 'numeros': {
          var vArr = guardado !== undefined ? guardado : this._valorInicial(p);
          frag.appendChild(this._inputSimple('valor', 'text', vArr, { placeholder: '1, 2, 3' }));
          var notaN = document.createElement('p');
          notaN.className = 'gp-ayuda';
          notaN.textContent = 'Lista de números separados por comas.';
          frag.appendChild(notaN);
          break;
        }

        case 'opciones': {
          var fieldset = document.createElement('fieldset');
          fieldset.className = 'gp-opciones';
          var legend = document.createElement('legend');
          legend.textContent = p.nombre;
          fieldset.appendChild(legend);

          var subcampos = p.subcampos || [];
          if (!subcampos.length) {
            var notaO = document.createElement('p');
            notaO.className = 'gp-ayuda';
            notaO.textContent = 'Objeto libre: se escribe como JSON.';
            fieldset.appendChild(this._inputSimple('valor', 'text', '', { placeholder: '{"clave": "valor"}' }));
          }
          subcampos.forEach(function (sub) {
            var cont = document.createElement('div');
            cont.className = 'gp-subcampo';
            cont.setAttribute('data-sub', sub.nombre);
            var et = document.createElement('label');
            et.className = 'gp-etiqueta gp-etiqueta--sub';
            et.textContent = sub.nombre;
            cont.appendChild(et);

            var subParam = {
              nombre: p.nombre + '.' + sub.nombre,
              tipo: sub.tipo,
              tipoControl: sub.tipoControl,
              opcional: true,
              porDefecto: sub.porDefecto,
              descripcion: sub.descripcion,
            };
            var previoSub = self._valorGuardado(p.nombre, 'sub:' + sub.nombre);
            var previoModo = self._valorGuardado(p.nombre, 'sub:' + sub.nombre + ':modo');
            // Un subcampo que pide una capa suele querer una sola geometría
            // (mask de hexGrid, obstacles de shortestPath): por defecto se le
            // pasa la primera entidad, no la colección entera.
            var modoSub = previoModo || (/FeatureCollection/.test(String(sub.tipo || '')) ? 'fc' : 'entidad');
            cont.appendChild(self._controlParaCon(subParam, f, previoSub, modoSub));
            fieldset.appendChild(cont);
          });
          frag.appendChild(fieldset);
          break;
        }

        case 'json': {
          var ta = document.createElement('textarea');
          ta.className = 'gp-textarea';
          ta.setAttribute('data-rol', 'valor');
          ta.rows = 2;
          ta.spellcheck = false;
          ta.placeholder = 'JSON o texto';
          var vJson = guardado !== undefined ? guardado : this._valorInicial(p);
          ta.value = (vJson === true || vJson === false) ? String(vJson) : vJson;
          frag.appendChild(ta);
          break;
        }

        default: {
          frag.appendChild(this._inputSimple('valor', 'text', guardado !== undefined ? guardado : '', { placeholder: 'valor' }));
          break;
        }
      }

      return frag;
    }

    /**
     * Igual que `_controlPara`, pero para un subcampo de `options`, donde el
     * valor guardado ya viene resuelto y el control no necesita el modo de capa.
     */
    _controlParaCon(p, f, valorPrevio, modoPrevio) {
      // Se reutiliza el control normal inyectando el valor guardado como si
      // fuera el del formulario: es más simple que duplicar cada caso.
      var antes = this._valoresFn;
      if (valorPrevio !== undefined) {
        this._valoresFn = {
          funcion: this._fnNombre,
          valores: (antes && antes.funcion === this._fnNombre) ? antes.valores : {},
        };
        this._valoresFn.valores[p.nombre] = {
          valor: valorPrevio,
          capa: valorPrevio,
          modo: modoPrevio,
        };
      }
      var frag = this._controlPara(p, f);
      this._valoresFn = antes;
      return frag;
    }

    /** Extensión de la vista actual en EPSG:4326, para el control bbox. */
    _bboxVista() {
      var IDEE = api();
      try {
        var ext = (this._map && typeof this._map.getBbox === 'function') ? this._map.getBbox() : null;
        if (!ext) return null;
        // La API devuelve { x: { min, max }, y: { min, max } }, pero algunas
        // versiones y los grupos devuelven [minX, minY, maxX, maxY].
        var caja;
        if (Array.isArray(ext) && ext.length >= 4) caja = ext;
        else if (ext.x && ext.y) caja = [ext.x.min, ext.y.min, ext.x.max, ext.y.max];
        else return null;
        if (Math.abs(caja[0]) > 180 || Math.abs(caja[2]) > 180) {
          if (!IDEE || !IDEE.utils || typeof IDEE.utils.reproject !== 'function') return null;
          var a = IDEE.utils.reproject([caja[0], caja[1]], 'EPSG:3857', 'EPSG:4326');
          var b = IDEE.utils.reproject([caja[2], caja[3]], 'EPSG:3857', 'EPSG:4326');
          return [a[0], a[1], b[0], b[1]];
        }
        return caja;
      } catch (e) {
        return null;
      }
    }

    /* ------------------------------------------------------------------ *
     * Lectura de los controles
     * ------------------------------------------------------------------ */

    /** Guarda en memoria los valores del formulario antes de repintarlo. */
    _snapshotForm() {
      var form = this._el.formulario;
      if (!form || !this._fnNombre) return;
      var valores = {};
      Array.prototype.forEach.call(form.querySelectorAll('.gp-campo[data-param]'), function (campo) {
        var nombre = campo.getAttribute('data-param');
        var v = {};
        Array.prototype.forEach.call(campo.querySelectorAll('[data-rol]'), function (el) {
          var rol = el.getAttribute('data-rol');
          // Los controles de un subcampo de `options` se guardan con el prefijo
          // `sub:<nombre>`, para que no choquen con los del parámetro padre.
          var sub = (typeof el.closest === 'function') ? el.closest('.gp-subcampo') : null;
          var clave = rol;
          if (sub) {
            var sn = sub.getAttribute('data-sub');
            clave = (rol === 'modo') ? 'sub:' + sn + ':modo' : 'sub:' + sn;
          }
          if (el.tagName === 'SELECT' && el.multiple) {
            v[clave] = Array.prototype.filter.call(el.options, function (o) { return o.selected; })
              .map(function (o) { return o.value; });
          } else if (el.type === 'checkbox') {
            v[clave] = !!el.checked;
          } else {
            v[clave] = el.value;
          }
        });
        valores[nombre] = v;
      });
      this._valoresFn = { funcion: this._fnNombre, valores: valores };
    }

    /**
     * Lee un parámetro del formulario.
     * @param {Element} contenedor `.gp-campo` o `.gp-subcampo`.
     * @param {Object} p Parámetro.
     * @returns {*} Valor listo para Turf, o `undefined` si está vacío.
     */
    _leerCampo(contenedor, p) {
      var self = this;
      if (!contenedor) return undefined;
      var leer = function (rol) {
        var el = contenedor.querySelector('[data-rol="' + rol + '"]');
        return el ? el : null;
      };

      switch (p.tipoControl) {
        case 'capa': {
          var sel = leer('capa');
          if (!sel || !sel.value) return undefined;
          this._ultimaCapaId = sel.value;
          var fc = this._geoJSONDeCapa(this._capaPorId(sel.value));
          if (!fc || !fc.features.length) return undefined;
          var modoEl = leer('modo');
          var modo = modoEl ? modoEl.value : 'fc';
          if (modo === 'entidad') return fc.features[0];
          return fc;
        }

        case 'capas': {
          var selM = leer('valor');
          if (!selM) return undefined;
          var ids = Array.prototype.filter.call(selM.options, function (o) { return o.selected; })
            .map(function (o) { return o.value; });
          if (!ids.length) return undefined;
          var colecciones = ids.map(function (id) { return self._geoJSONDeCapa(self._capaPorId(id)); })
            .filter(function (c) { return !!c; });
          if (!colecciones.length) return undefined;
          if (/Geometry/i.test(String(p.tipo || ''))) {
            var geoms = [];
            colecciones.forEach(function (c) {
              c.features.forEach(function (ft) { if (ft.geometry) geoms.push(ft.geometry); });
            });
            return geoms.length ? geoms : undefined;
          }
          var feats = [];
          colecciones.forEach(function (c) { feats = feats.concat(c.features); });
          return feats.length ? feats : undefined;
        }

        case 'numero': {
          var inp = leer('valor');
          if (!inp) return undefined;
          var t = String(inp.value).trim();
          if (t === '') return undefined;
          var n = Number(t.replace(',', '.'));
          return Number.isNaN(n) ? NaN : n;
        }

        case 'texto': {
          var inp2 = leer('valor');
          if (!inp2) return undefined;
          var v = String(inp2.value).trim();
          return v === '' ? undefined : v;
        }

        case 'booleano': {
          var cb = leer('valor');
          if (!cb) return undefined;
          return cb.checked ? true : undefined;
        }

        case 'unidades': {
          var selU = leer('valor');
          if (!selU || !selU.value) return undefined;
          return selU.value;
        }

        case 'coordenada': {
          var ix = leer('x');
          var iy = leer('y');
          if (!ix || !iy) return undefined;
          var vx = String(ix.value).trim();
          var vy = String(iy.value).trim();
          if (vx === '' || vy === '') return undefined;
          var nx = Number(vx.replace(',', '.'));
          var ny = Number(vy.replace(',', '.'));
          if (Number.isNaN(nx) || Number.isNaN(ny)) return NaN;
          return [nx, ny];
        }

        case 'bbox': {
          var roles = ['minx', 'miny', 'maxx', 'maxy'];
          var out = [];
          for (var i = 0; i < roles.length; i += 1) {
            var el2 = leer(roles[i]);
            if (!el2) return undefined;
            var txt = String(el2.value).trim();
            if (txt === '') return undefined;
            var num = Number(txt.replace(',', '.'));
            if (Number.isNaN(num)) return NaN;
            out.push(num);
          }
          return out;
        }

        case 'numeros': {
          var el3 = leer('valor');
          if (!el3) return undefined;
          var txtN = String(el3.value).trim();
          if (txtN === '') return undefined;
          var partes = txtN.split(/[,;\s]+/).filter(function (x) { return x !== ''; });
          var nums = partes.map(function (x) { return Number(String(x).replace(',', '.')); });
          if (nums.some(function (x) { return Number.isNaN(x); })) return NaN;
          return nums;
        }

        case 'opciones': {
          var objeto = {};
          var hay = false;
          var subcampos = p.subcampos || [];
          if (!subcampos.length) {
            var elJ = leer('valor');
            var txtJ = elJ ? String(elJ.value).trim() : '';
            if (!txtJ) return undefined;
            try { return JSON.parse(txtJ); } catch (e) { return NaN; }
          }
          subcampos.forEach(function (sub) {
            var cont = contenedor.querySelector('.gp-subcampo[data-sub="' + sub.nombre + '"]');
            var subParam = {
              nombre: sub.nombre,
              tipo: sub.tipo,
              tipoControl: sub.tipoControl,
              opcional: true,
              porDefecto: sub.porDefecto,
              descripcion: sub.descripcion,
              subcampos: sub.subcampos,
            };
            var valor = self._leerCampo(cont, subParam);
            if (valor !== undefined) {
              objeto[sub.nombre] = valor;
              hay = true;
            }
          });
          return hay ? objeto : undefined;
        }

        case 'json': {
          var el4 = leer('valor');
          if (!el4) return undefined;
          var txt4 = String(el4.value).trim();
          if (txt4 === '') return undefined;
          try { return JSON.parse(txt4); } catch (e) { return NaN; }
        }

        default:
          return undefined;
      }
    }

    /**
     * Construye la lista de argumentos de una función.
     * @param {Object} f Función del catálogo.
     * @param {Object} [sustituir] `{ nombre, valor }` para forzar un parámetro.
     * @returns {{args: Array, pendientes: Array<string>, invalidos: Array<string>}}
     */
    _argumentos(f, sustituir) {
      var self = this;
      var args = [];
      var pendientes = [];
      var invalidos = [];

      (f.parametros || []).forEach(function (p) {
        var cont = self._el.formulario
          ? self._el.formulario.querySelector('.gp-campo[data-param="' + p.nombre + '"]')
          : null;
        var valor;
        if (sustituir && sustituir.nombre === p.nombre) {
          valor = sustituir.valor;
        } else {
          valor = self._leerCampo(cont, p);
        }

        if (valor === undefined) {
          if (!p.opcional) pendientes.push(p.nombre);
          args.push(undefined);
        } else if (typeof valor === 'number' && Number.isNaN(valor)) {
          invalidos.push(p.nombre);
          args.push(undefined);
        } else if (Array.isArray(valor) && valor.some(function (x) { return typeof x === 'number' && Number.isNaN(x); })) {
          invalidos.push(p.nombre);
          args.push(undefined);
        } else {
          args.push(valor);
        }
      });

      while (args.length && args[args.length - 1] === undefined) args.pop();
      return { args: args, pendientes: pendientes, invalidos: invalidos };
    }

    /** Nombre del primer parámetro de capa con modo "entidad a entidad". */
    _parametroEntidad(f) {
      var form = this._el.formulario;
      if (!form) return null;
      for (var i = 0; i < (f.parametros || []).length; i += 1) {
        var p = f.parametros[i];
        if (p.tipoControl !== 'capa') continue;
        var cont = form.querySelector('.gp-campo[data-param="' + p.nombre + '"]');
        var modoEl = cont ? cont.querySelector('[data-rol="modo"]') : null;
        if (modoEl && modoEl.value === 'todas') return p;
      }
      return null;
    }

    /* =================================================================== *
     * 5. PESTAÑA VECTOR · EJECUCIÓN
     * =================================================================== */

    /** Valida lo leído del formulario y lanza un error legible si falta algo. */
    _comprobarArgs(leido) {
      if (leido.invalidos && leido.invalidos.length) {
        throw new Error('Hay valores no válidos en: ' + leido.invalidos.join(', ') + '.');
      }
      if (leido.pendientes && leido.pendientes.length) {
        throw new Error('Faltan parámetros obligatorios: ' + leido.pendientes.join(', ') + '.');
      }
    }

    async _ejecutarVector() {
      var f = this._fn;
      if (!f) {
        this._estado(this._el.estado, 'Elige primero una función de Turf.', 'error');
        return;
      }
      if (this._esCesium()) {
        this._estado(this._el.estado, 'En 3D (Cesium) no se pueden leer las entidades de las capas vectoriales. Cambia a 2D.', 'error');
        return;
      }

      var boton = this._el.ejecutar;
      boton.disabled = true;
      try {
        this._snapshotForm();
        this._estado(this._el.estado, 'Cargando Turf…', 'cargando');
        var turf = await cargarTurf();
        var fn = turf[f.nombre];
        if (typeof fn !== 'function') throw new Error('Turf no expone la función «' + f.nombre + '».');

        var paramEntidad = this._parametroEntidad(f);
        var salidas;
        if (paramEntidad) {
          salidas = await this._ejecutarPorEntidad(turf, f, paramEntidad);
        } else {
          var leido = this._argumentos(f);
          this._comprobarArgs(leido);
          this._estado(this._el.estado, 'Ejecutando ' + f.nombre + '…', 'cargando');
          var salida = await Promise.resolve(fn.apply(turf, leido.args));
          salidas = [{ salida: salida, etiqueta: f.nombre }];
        }

        this._procesarResultado(salidas, f);
      } catch (e) {
        console.error('[geoprocesos] ' + f.nombre, e);
        this._estado(this._el.estado, 'Error en ' + f.nombre + ': ' + (e && e.message ? e.message : e), 'error');
      } finally {
        boton.disabled = this._esCesium();
      }
    }

    /**
     * Aplica la función entidad a entidad sobre la capa elegida y junta los
     * resultados. Es el modo "entidad a entidad" del formulario.
     * @param {Object} turf Global de Turf.
     * @param {Object} f Función del catálogo.
     * @param {Object} paramEntidad Parámetro de capa con modo "todas".
     * @returns {Promise<Array<{salida: *, etiqueta: string}>>}
     */
    async _ejecutarPorEntidad(turf, f, paramEntidad) {
      var self = this;
      var cont = this._el.formulario.querySelector('.gp-campo[data-param="' + paramEntidad.nombre + '"]');
      var sel = cont ? cont.querySelector('[data-rol="capa"]') : null;
      if (!sel || !sel.value) throw new Error('Elige una capa en «' + paramEntidad.nombre + '».');

      var fc = this._geoJSONDeCapa(this._capaPorId(sel.value));
      if (!fc || !fc.features.length) throw new Error('La capa «' + sel.options[sel.selectedIndex].textContent + '» no tiene entidades.');

      // Primero se valida el resto del formulario, sin ejecutar nada.
      var prueba = this._argumentos(f, { nombre: paramEntidad.nombre, valor: fc });
      this._comprobarArgs(prueba);

      var fn = turf[f.nombre];
      var salidas = [];
      var fallos = 0;
      var primerError = null;
      var total = fc.features.length;

      for (var i = 0; i < total; i += 1) {
        var args = this._argumentos(f, { nombre: paramEntidad.nombre, valor: fc.features[i] });
        if (args.pendientes.length || args.invalidos.length) {
          this._comprobarArgs(args);
        }
        try {
          var salida = await Promise.resolve(fn.apply(turf, args.args));
          salidas.push({ salida: salida, etiqueta: f.nombre + ' · ' + (i + 1) });
        } catch (e) {
          fallos += 1;
          if (!primerError) primerError = e;
        }

        if ((i + 1) % 25 === 0 || i + 1 === total) {
          this._estado(this._el.estado, 'Procesando ' + (i + 1) + ' de ' + total + ' entidades…', 'cargando');
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }

      if (!salidas.length) {
        throw new Error('Ninguna entidad ha producido resultado' + (primerError ? ': ' + primerError.message : '.'));
      }
      if (fallos) {
        this._estado(this._el.estado, fallos + ' de ' + total + ' entidades han fallado y se han omitido.', 'info');
      }
      void self;
      return salidas;
    }

    /** Texto corto para resultados que no son geometrías. */
    _textoResultado(v) {
      if (v === null || v === undefined) return 'sin resultado';
      if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
      if (typeof v === 'string' || typeof v === 'boolean') return String(v);
      if (Array.isArray(v)) {
        if (!v.length) return '[]';
        if (typeof v[0] === 'number') return '[' + v.map(function (x) { return Number(Number(x).toFixed(6)); }).join(', ') + ']';
        return v.length + ' elementos';
      }
      if (v.type === 'Feature' || v.type === 'FeatureCollection' || esGeometria(v)) return '';
      try {
        var s = JSON.stringify(v);
        return s.length > 200 ? s.slice(0, 200) + '…' : s;
      } catch (e) {
        return String(v);
      }
    }

    /**
     * Junta las salidas en una capa y pinta el resumen.
     * @param {Array<{salida: *, etiqueta: string}>} salidas Resultados de Turf.
     * @param {Object} f Función ejecutada.
     */
    _procesarResultado(salidas, f) {
      var self = this;
      var features = [];
      var textos = [];

      salidas.forEach(function (s) {
        var fc = aFeatureCollection(s.salida);
        if (fc) features = features.concat(fc.features);
        else {
          var t = self._textoResultado(s.salida);
          if (t) textos.push(salidas.length > 1 ? s.etiqueta + ': ' + t : t);
        }
      });

      if (features.length) {
        var nombre = 'GP ' + f.nombre + (salidas.length > 1 ? ' (' + features.length + ')' : '');
        this._anadirCapaGeoJSON(features, nombre);
        var resumen = features.length + ' entidad' + (features.length === 1 ? '' : 'es') + ' en la capa «' + nombre + '».';
        if (textos.length) resumen += ' ' + textos.slice(0, 3).join(' | ') + (textos.length > 3 ? ' …' : '');
        this._estado(this._el.estado, resumen, 'ok');
        // `capa.getFeaturesExtent()` devuelve la extensión MÁXIMA del mapa
        // justo después de añadir la capa (medido), así que la caja se calcula
        // aquí a partir de las propias entidades, que Turf devuelve en 4326.
        try {
          var caja = this._bboxDeFeatures(features);
          if (caja) this._map.setBbox(caja);
        } catch (e) { /* la vista no es imprescindible */ }
        return;
      }

      if (!textos.length) {
        this._estado(this._el.estado, 'La función no ha devuelto nada.', 'info');
        return;
      }
      var texto = textos.join('\n');
      this._estado(this._el.estado, texto.length > 600 ? texto.slice(0, 600) + '…' : texto, 'ok');
    }

    /**
     * Extensión de una lista de entidades, en EPSG:3857, para encuadrarlas.
     *
     * Turf trabaja siempre en 4326, así que la caja se calcula ahí y se
     * reproyecta a la proyección del mapa. Si la caja es degenerada (una
     * sola entidad puntual) se abre un poco para no acabar en el zoom
     * máximo sobre un punto.
     *
     * @param {Array<Object>} features Entidades GeoJSON en EPSG:4326.
     * @returns {Array<number>|null} [minX, minY, maxX, maxY] en EPSG:3857.
     */
    _bboxDeFeatures(features) {
      var minx = Infinity;
      var miny = Infinity;
      var maxx = -Infinity;
      var maxy = -Infinity;

      var recorrer = function (coords) {
        if (!Array.isArray(coords) || !coords.length) return;
        if (typeof coords[0] === 'number') {
          var x = coords[0];
          var y = coords[1];
          if (!isFinite(x) || !isFinite(y)) return;
          if (x < minx) minx = x;
          if (y < miny) miny = y;
          if (x > maxx) maxx = x;
          if (y > maxy) maxy = y;
          return;
        }
        coords.forEach(recorrer);
      };

      (features || []).forEach(function (f) {
        if (f && f.geometry) recorrer(f.geometry.coordinates);
      });
      if (!isFinite(minx) || !isFinite(miny)) return null;

      // Caja degenerada (un punto, o todos en la misma coordenada): se abre
      // 0,02° (unos 2,2 km) alrededor para que el encuadre enseñe el entorno
      // y no acabe en el zoom máximo sobre un punto.
      var delta = 0.02;
      if (maxx - minx < delta) {
        var cx = (maxx + minx) / 2;
        minx = cx - delta;
        maxx = cx + delta;
      }
      if (maxy - miny < delta) {
        var cy = (maxy + miny) / 2;
        miny = cy - delta;
        maxy = cy + delta;
      }

      var IDEE = api();
      if (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function') {
        try {
          var a = IDEE.utils.reproject([minx, miny], 'EPSG:4326', 'EPSG:3857');
          var b = IDEE.utils.reproject([maxx, maxy], 'EPSG:4326', 'EPSG:3857');
          if (a && b && isFinite(a[0]) && isFinite(b[0])) return [a[0], a[1], b[0], b[1]];
        } catch (e) { /* se devuelve la caja tal cual */ }
      }
      return [minx, miny, maxx, maxy];
    }

    /**
     * Añade una FeatureCollection al mapa como capa GeoJSON nueva.
     * @param {Array<Object>} features Entidades (EPSG:4326, como las devuelve Turf).
     * @param {string} nombre Nombre y leyenda de la capa.
     * @returns {Object|null} La capa añadida.
     */
    _anadirCapaGeoJSON(features, nombre) {
      var IDEE = api();
      if (!IDEE || !IDEE.layer || !IDEE.layer.GeoJSON) {
        throw new Error('La API no expone IDEE.layer.GeoJSON.');
      }
      var c = this.resolveColor(this.color2);
      var estilo = null;
      if (IDEE.style && IDEE.style.Generic) {
        estilo = new IDEE.style.Generic({
          point: { radius: 5, fill: { color: c.active, opacity: 0.85 }, stroke: { color: c.deactive, width: 1 } },
          line: { stroke: { color: c.active, width: 3 } },
          polygon: { fill: { color: c.active, opacity: 0.25 }, stroke: { color: c.active, width: 2 } },
        });
      }

      var parametros = {
        name: nombre,
        legend: nombre,
        source: { type: 'FeatureCollection', features: features },
        extract: true,
      };
      if (estilo) parametros.style = estilo;

      var capa = new IDEE.layer.GeoJSON(parametros);
      if (typeof this._map.addLayers === 'function') this._map.addLayers(capa);
      else this._map.addLayer(capa);

      this._capasResultado.push({ id: capa.idLayer, legend: nombre });
      this._refrescarCapas();
      return capa;
    }

    /** Quita del mapa todas las capas creadas por el plugin. */
    _limpiarResultados() {
      var self = this;
      var quitadas = 0;
      this._capasResultado.forEach(function (r) {
        var capa = self._findLayerByIdInMap(self._map, r.id) || self._findLayerByLegendInMap(self._map, r.legend);
        if (!capa) return;
        try {
          if (typeof self._map.removeLayers === 'function') self._map.removeLayers(capa);
          else if (typeof self._map.removeLayer === 'function') self._map.removeLayer(capa);
          quitadas += 1;
        } catch (e) { /* ya no estaba */ }
      });
      this._capasResultado = [];
      this._refrescarCapas();
      this._estado(this._el.estado, quitadas ? quitadas + ' capa(s) de resultado eliminadas.' : 'No había resultados que quitar.', 'info');
    }

    /* =================================================================== *
     * 6. PESTAÑA IMPORTAR · LECTURA DEL GEOTIFF
     * =================================================================== */

    _inicializarRaster() {
      if (!this._el.rasOp.options.length) {
        var self = this;
        OPS_RASTER.forEach(function (op) { self._el.rasOp.appendChild(opcion(op.id, op.etiqueta)); });
        this._el.rasOp.value = 'reproyectar';
      }
      this._pintarParamsRaster();
    }

    /** Resuelve la fuente elegida (capa del mapa o fichero local) y la abre. */
    async _cargarFuenteRaster() {
      var id = this._el.rasFuente.value;
      var fichero = this._ficheroRaster;
      if (!id && !fichero) {
        this._raster = null;
        this._pintarMeta();
        this._mostrarBloquesRaster(false);
        return;
      }
      // Si se elige un GeoTIFF, la captura WMS deja de ser la fuente.
      if (this._el.rasServicio) this._el.rasServicio.value = '';
      var token = (this._tokenRaster = (this._tokenRaster || 0) + 1);
      try {
        this._estado(this._el.rasEstadoImportar, 'Abriendo el GeoTIFF…', 'cargando');
        var fuente = fichero;
        if (!fuente) {
          var capa = this._capaPorId(id);
          if (!capa) throw new Error('No se encuentra la capa seleccionada.');
          fuente = this._fuenteDeCapa(capa);
          if (!fuente) throw new Error('La capa no expone el fichero (blob/url).');
        }
        var datos = await this._bytesDeFuente(fuente);
        if (token !== this._tokenRaster) return;
        await this._abrirRaster(datos);
        if (token !== this._tokenRaster) return;
        this._pintarMeta();
        this._mostrarBloquesRaster(true);
        this._estado(this._el.rasEstadoImportar, '', '');
      } catch (e) {
        console.error('[geoprocesos] ráster', e);
        this._raster = null;
        this._pintarMeta();
        this._mostrarBloquesRaster(false);
        this._estado(this._el.rasEstadoImportar, 'No se ha podido abrir el GeoTIFF: ' + (e && e.message ? e.message : e), 'error');
      }
    }

    /** Devuelve los bytes de un Blob, un File o una URL (incluida blob:). */
    async _bytesDeFuente(fuente) {
      if (fuente instanceof Blob) return fuente.arrayBuffer();
      var respuesta = await fetch(String(fuente));
      if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status + ' al descargar el GeoTIFF.');
      return respuesta.arrayBuffer();
    }

    /* =================================================================== *
     * 6 bis. PESTAÑA IMPORTAR · SERVICIOS WMS · captura de la vista como GeoTIFF
     * =================================================================== */

    /**
     * Extensión de la vista actual, en EPSG:3857.
     *
     * En 2D sale de la vista de OpenLayers; en 3D, del rectángulo que ve la
     * cámara de Cesium (que viene en radianes 4326 y se reproyecta). Si no hay
     * forma de leerla, se calcula alrededor del centro con la resolución del
     * zoom, que es lo que hace un mapa de 1024 × 768.
     *
     * @returns {{bbox: Array<number>, ancho: number, alto: number}}
     */
    _bboxVista() {
      var impl = null;
      try { impl = this._map.getMapImpl(); } catch (e) { impl = null; }

      // 2D (OpenLayers): la vista ya está en 3857.
      if (impl && typeof impl.getView === 'function' && typeof impl.getSize === 'function') {
        try {
          var tam = impl.getSize();
          var ext = impl.getView().calculateExtent(tam);
          if (ext && ext.length === 4 && ext.every(function (v) { return isFinite(v); })
            && ext[2] > ext[0] && ext[3] > ext[1]) {
            return { bbox: [ext[0], ext[1], ext[2], ext[3]], ancho: tam[0], alto: tam[1] };
          }
        } catch (e) { /* sigue con el respaldo */ }
      }

      // 3D (Cesium): `computeViewRectangle` devuelve radianes en 4326.
      if (impl && impl.scene && impl.scene.camera && typeof Cesium !== 'undefined') {
        try {
          var rect = impl.scene.camera.computeViewRectangle();
          if (rect) {
            var IDEE = api();
            var oeste = Cesium.Math.toDegrees(rect.west);
            var sur = Cesium.Math.toDegrees(rect.south);
            var este = Cesium.Math.toDegrees(rect.east);
            var norte = Cesium.Math.toDegrees(rect.north);
            var sw = IDEE.utils.reproject([oeste, sur], 'EPSG:4326', 'EPSG:3857');
            var ne = IDEE.utils.reproject([este, norte], 'EPSG:4326', 'EPSG:3857');
            var bbox = [sw[0], sw[1], ne[0], ne[1]];
            // Una cámara mirando al horizonte abarca medio mundo: no sirve.
            if (bbox.every(function (v) { return isFinite(v); })
              && (bbox[2] - bbox[0]) < 4e7 && (bbox[3] - bbox[1]) < 4e7) {
              var lienzo = impl.scene.canvas;
              return {
                bbox: bbox,
                ancho: (lienzo && lienzo.clientWidth) || 1024,
                alto: (lienzo && lienzo.clientHeight) || 768,
              };
            }
          }
        } catch (e) { /* sigue con el respaldo */ }
      }

      // Respaldo: centro y zoom del mapa, como si fuera una pantalla 1024 × 768.
      var centro = { x: 0, y: 0 };
      try { centro = this._map.getCenter() || centro; } catch (e) { /* sin centro */ }
      var zoom = 10;
      try { zoom = Number(this._map.getZoom()); } catch (e) { zoom = 10; }
      if (!isFinite(zoom)) zoom = 10;
      var resolucion = 156543.03392804097 / Math.pow(2, zoom);
      var ancho = 1024;
      var alto = 768;
      return {
        bbox: [
          centro.x - (ancho * resolucion) / 2,
          centro.y - (alto * resolucion) / 2,
          centro.x + (ancho * resolucion) / 2,
          centro.y + (alto * resolucion) / 2,
        ],
        ancho: ancho,
        alto: alto,
      };
    }

    /**
     * Pide al servicio WMS un GeoTIFF del encuadre actual y lo abre como
     * fuente ráster: a partir de ahí se puede calcular, geoprocesar con
     * gdal3.js y descargar como cualquier otro GeoTIFF.
     *
     * Lo que se obtiene son los píxeles que el servicio pinta (colorizado),
     * no los datos originales: para valores reales hace falta un WCS o el
     * GeoTIFF de descarga del proveedor.
     */
    async _capturarServicioRaster() {
      var estado = this._el.rasEstadoImportar;
      // Antes de leer la selección se rehace la lista: así entra la capa base
      // aunque el mapa la haya creado después de abrir el panel.
      this._refrescarServicios();
      var id = this._el.rasServicio ? this._el.rasServicio.value : '';
      if (!id) {
        this._estado(estado, 'Elige un servicio WMS o TMS de la lista.', 'error');
        return;
      }
      var capa = this._capaPorId(id);
      if (!capa) {
        this._estado(estado, 'No se encuentra el servicio seleccionado.', 'error');
        return;
      }

      // La captura sustituye a la fuente anterior: se limpia el GeoTIFF elegido
      // y el fichero local para que la interfaz no muestre dos fuentes a la vez.
      if (this._el.rasFuente) this._el.rasFuente.value = '';
      if (this._el.rasFile) this._el.rasFile.value = '';
      this._ficheroRaster = null;

      var boton = this._el.rasCapturar;
      var token = (this._tokenRaster = (this._tokenRaster || 0) + 1);
      if (boton) boton.disabled = true;
      try {
        var vista = this._bboxVista();
        var lado = Number(this._el.rasTamano && this._el.rasTamano.value) || 1024;
        // Se mantiene la proporción de la pantalla y se limita el lado mayor.
        var aspecto = vista.ancho / vista.alto;
        var ancho = aspecto >= 1 ? lado : Math.max(1, Math.round(lado * aspecto));
        var alto = aspecto >= 1 ? Math.max(1, Math.round(lado / aspecto)) : lado;

        var respuesta;
        if (this._esServicioTeselado(capa)) {
          this._estado(estado, 'Descargando las teselas de la vista…', 'cargando');
          respuesta = await this._capturarTms(capa, vista, lado);
        } else {
          this._estado(estado, 'Pidiendo el GeoTIFF al servicio (' + ancho + ' × ' + alto + ')…', 'cargando');
          respuesta = await this._getMapServicio(capa, vista.bbox, ancho, alto);
        }
        if (token !== this._tokenRaster) return;

        await this._abrirRaster(respuesta.buffer);
        if (token !== this._tokenRaster) return;

        // La georreferenciación buena es la que se ha pedido: si el servicio no
        // escribe GeoKeys, el fichero se queda sin SRC y no se puede ni añadir
        // al mapa ni reproyectar.
        this._completarGeoRaster(respuesta.bbox, respuesta.epsg);
        this._pintarMeta();
        this._mostrarBloquesRaster(true);

        // La fuente capturada ya es un fichero descargable de por sí.
        var nombre = 'GP captura ' + (this._contadorResultados = (this._contadorResultados || 0) + 1);
        var tamano = this._raster.ancho + ' × ' + this._raster.alto;
        this._mostrarResultadoRaster(respuesta.buffer, nombre + '.tif',
          tamano + ' · ' + respuesta.formato);
        this._estado(estado, 'Captura lista: ' + tamano + ' px de «'
          + this._nombreCapa(capa) + '» (' + respuesta.formato + '). El fichero se descarga desde '
          + 'la pestaña Exportar.', 'ok');
      } catch (e) {
        if (token !== this._tokenRaster) return;
        console.error('[geoprocesos] captura de servicio', e);
        this._estado(estado, 'No se ha podido capturar el servicio: ' + (e && e.message ? e.message : e), 'error');
      } finally {
        if (boton) boton.disabled = false;
      }
    }

    /**
     * GetMap de un servicio WMS con el bbox pedido.
     *
     * Se usa WMS 1.1.1 a propósito: en 1.1.1 el bbox va siempre en el orden
     * x,y, mientras que en 1.3.0 EPSG:4326 se pide en lat,lon y es una fuente
     * de errores silenciosos. Se prueban los formatos que sí devuelven datos
     * (image/geotiff y image/tiff; un PNG solo daría una imagen sin valores) y,
     * si el servicio no admite Web Mercator, se reintenta en EPSG:4326.
     *
     * @param {Object} capa Capa WMS de la API.
     * @param {Array<number>} bbox3857 Encuadre en EPSG:3857.
     * @param {number} ancho Ancho en píxeles.
     * @param {number} alto Alto en píxeles.
     * @returns {Promise<{buffer: ArrayBuffer, formato: string, epsg: number, bbox: Array<number>}>}
     */
    async _getMapServicio(capa, bbox3857, ancho, alto) {
      var partes = this._separarUrlWms(capa.url);
      var base = partes.base;
      var capas = Array.isArray(capa.name) ? capa.name.join(',') : String(capa.name || '');
      if (!base || !capas) {
        throw new Error('la capa no expone la URL o el nombre de capa del servicio');
      }
      var estilos = (capa.options && capa.options.styles) ? String(capa.options.styles) : String(capa.styles || '');
      var extra = partes.extra.map(function (p) { return '&' + p; }).join('');

      var intentos = [{ epsg: 3857, bbox: bbox3857.slice() }];
      var bbox4326 = this._a4326(bbox3857);
      if (bbox4326) intentos.push({ epsg: 4326, bbox: bbox4326 });

      var formatos = ['image/geotiff', 'image/tiff'];
      var ultimoError = null;
      for (var i = 0; i < intentos.length; i += 1) {
        for (var f = 0; f < formatos.length; f += 1) {
          var url = base + '?service=WMS&version=1.1.1&request=GetMap'
            + '&layers=' + encodeURIComponent(capas)
            + '&styles=' + encodeURIComponent(estilos)
            + '&srs=EPSG:' + intentos[i].epsg
            + '&bbox=' + intentos[i].bbox.map(function (v) { return Number(v).toFixed(6); }).join(',')
            + '&width=' + ancho + '&height=' + alto
            + '&format=' + encodeURIComponent(formatos[f])
            + extra;
          var respuesta;
          try {
            respuesta = await fetch(url);
          } catch (e) {
            throw new Error('el servicio no admite peticiones desde el navegador (CORS): ' + base);
          }
          var buffer = await respuesta.arrayBuffer();
          if (this._esTiff(buffer)) {
            return { buffer: buffer, formato: formatos[f], epsg: intentos[i].epsg, bbox: intentos[i].bbox };
          }
          ultimoError = (await this._mensajeExcepcion(respuesta, buffer))
            || ('HTTP ' + respuesta.status + ' con «' + (respuesta.headers.get('content-type') || 'sin tipo') + '»');
          // Si el servicio no admite el SRC, no tiene sentido probar más
          // formatos con ese mismo SRC.
          if (/srs|projection|crs|proyecci/i.test(String(ultimoError))) break;
        }
      }
      throw new Error(ultimoError || 'el servicio no ha devuelto ningún GeoTIFF');
    }

    /**
     * Captura un TMS/XYZ de la vista: descarga las teselas del encuadre, las
     * pega en un lienzo, recorta al bbox y escribe un GeoTIFF RGB de 8 bits.
     *
     * Un TMS no tiene GetMap, así que el encuadre se consigue juntando las
     * teselas del nivel de zoom que dé el tamaño pedido. Se descargan como
     * blob (no con `<img>`) para que el lienzo no quede contaminado y se
     * puedan leer los píxeles.
     *
     * @param {Object} capa Capa TMS/XYZ.
     * @param {{bbox: Array<number>, ancho: number, alto: number}} vista Encuadre.
     * @param {number} lado Lado mayor del fichero, en píxeles.
     * @returns {Promise<{buffer: ArrayBuffer, formato: string, epsg: number, bbox: Array<number>}>}
     */
    async _capturarTms(capa, vista, lado) {
      var plantilla = String(capa.url || '');
      if (!/\{z\}/.test(plantilla) || !/\{x\}/.test(plantilla)) {
        throw new Error('la URL de la capa no es una plantilla XYZ/TMS ({z}/{x}/{y})');
      }
      var EXTENTE = 20037508.342789244;
      var LADO = 256;
      var RES0 = (2 * EXTENTE) / LADO;
      var bbox = vista.bbox;

      // Nivel de zoom a partir de la resolución que se quiere en el fichero,
      // sin pasarse del máximo que anuncie la capa (los TMS del IGN suelen
      // terminar en 17–20).
      var resObjetivo = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]) / lado;
      var zMax = Number((capa.options && capa.options.tileGridMaxZoom) || capa.tileGridMaxZoom);
      if (!isFinite(zMax) || zMax <= 0) zMax = 22;
      var z = Math.round(Math.log(RES0 / resObjetivo) / Math.LN2);
      z = Math.max(0, Math.min(zMax, z));

      var n, res, minX, maxX, minY, maxY, total;
      for (;;) {
        n = Math.pow(2, z);
        res = RES0 / n;
        minX = Math.max(0, Math.floor((bbox[0] + EXTENTE) / (res * LADO)));
        maxX = Math.min(n - 1, Math.floor((bbox[2] + EXTENTE) / (res * LADO)));
        minY = Math.max(0, Math.floor((EXTENTE - bbox[3]) / (res * LADO)));
        maxY = Math.min(n - 1, Math.floor((EXTENTE - bbox[1]) / (res * LADO)));
        total = (maxX - minX + 1) * (maxY - minY + 1);
        if (total <= 64 || z === 0) break;
        z -= 1;
      }
      if (minX > maxX || minY > maxY) {
        throw new Error('el encuadre queda fuera de la cobertura del servicio');
      }

      var columnas = maxX - minX + 1;
      var filas = maxY - minY + 1;
      var lienzo = document.createElement('canvas');
      lienzo.width = columnas * LADO;
      lienzo.height = filas * LADO;
      var contexto = lienzo.getContext('2d');
      if (!contexto) throw new Error('el navegador no ha dado un lienzo 2D');

      var fallos = 0;
      for (var y = minY; y <= maxY; y += 1) {
        for (var x = minX; x <= maxX; x += 1) {
          var url = plantilla
            .replace(/\{z\}/g, z)
            .replace(/\{x\}/g, x)
            .replace(/\{-y\}/g, (n - 1 - y))
            .replace(/\{y\}/g, y);
          try {
            var respuesta = await fetch(url);
            if (!respuesta.ok) { fallos += 1; continue; }
            var mapa = await createImageBitmap(await respuesta.blob());
            contexto.drawImage(mapa, (x - minX) * LADO, (y - minY) * LADO, LADO, LADO);
            if (typeof mapa.close === 'function') mapa.close();
          } catch (e) {
            fallos += 1;
          }
        }
        this._estado(this._el.rasEstadoImportar, 'Descargando teselas… '
          + Math.round(((y - minY + 1) / filas) * 100) + ' %', 'cargando');
      }
      if (fallos >= total) {
        throw new Error('no se ha podido descargar ninguna tesela (CORS, cobertura o URL)');
      }

      // Recorte al encuadre pedido y paso a RGB: las teselas transparentes se
      // funden sobre blanco para que no salgan negras. El tamaño final es el
      // que pidió el usuario (lado mayor), aunque las teselas se hayan
      // descargado a la resolución nativa del nivel elegido.
      var x0 = -EXTENTE + (minX * res * LADO);
      var y1 = EXTENTE - (minY * res * LADO);
      var anchoNativo = Math.max(1, Math.round((bbox[2] - bbox[0]) / res));
      var altoNativo = Math.max(1, Math.round((bbox[3] - bbox[1]) / res));
      var aspecto = vista.ancho / vista.alto;
      var anchoPx = aspecto >= 1 ? lado : Math.max(1, Math.round(lado * aspecto));
      var altoPx = aspecto >= 1 ? Math.max(1, Math.round(lado / aspecto)) : lado;
      var recorte = document.createElement('canvas');
      recorte.width = anchoPx;
      recorte.height = altoPx;
      var ctx2 = recorte.getContext('2d');
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, anchoPx, altoPx);
      ctx2.drawImage(
        lienzo,
        (bbox[0] - x0) / res,
        (y1 - bbox[3]) / res,
        anchoNativo,
        altoNativo,
        0, 0, anchoPx, altoPx
      );
      var rgba = ctx2.getImageData(0, 0, anchoPx, altoPx).data;

      var rgb = new Uint8Array(anchoPx * altoPx * 3);
      for (var i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        var alfa = rgba[i + 3] / 255;
        var blanco = 255 * (1 - alfa);
        rgb[j] = Math.round(rgba[i] * alfa + blanco);
        rgb[j + 1] = Math.round(rgba[i + 1] * alfa + blanco);
        rgb[j + 2] = Math.round(rgba[i + 2] * alfa + blanco);
      }

      var escritor = await cargarEscritorGeoTIFF();
      var buffer = escritor.escribirGeoTIFFUInt8({
        ancho: anchoPx,
        alto: altoPx,
        bandas: 3,
        datos: rgb,
        origenX: bbox[0],
        origenY: bbox[3],
        resX: (bbox[2] - bbox[0]) / anchoPx,
        resY: (bbox[3] - bbox[1]) / altoPx,
        epsg: 3857,
      });

      return {
        buffer: buffer,
        formato: 'mosaico TMS z' + z + ' · ' + columnas + ' × ' + filas + ' teselas',
        epsg: 3857,
        bbox: bbox.slice(),
      };
    }

    /**
     * Separa la URL de un WMS de los parámetros que ya traiga.
     *
     * No vale `split('?')[0]` a secas: hay servicios que cuelgan de un
     * parámetro (`?map=/ruta/al/mapfile`) o de un token, y perderlo deja la
     * petición sin servicio. Se descartan solo los parámetros de GetMap que se
     * van a volver a escribir.
     *
     * @param {string} url URL de la capa.
     * @returns {{base: string, extra: Array<string>}} URL sin consulta y
     *   parámetros que hay que conservar.
     */
    _separarUrlWms(url) {
      var trozos = String(url || '').split('?');
      var base = trozos[0];
      var extra = [];
      if (trozos.length > 1) {
        var sobra = ['service', 'version', 'request', 'layers', 'styles', 'srs', 'crs',
          'bbox', 'width', 'height', 'format', 'transparent', 'exceptions'];
        trozos.slice(1).join('?').split('&').forEach(function (par) {
          if (!par) return;
          var clave = par.split('=')[0].toLowerCase();
          if (sobra.indexOf(clave) === -1) extra.push(par);
        });
      }
      return { base: base, extra: extra };
    }

    /** ¿Los bytes empiezan como un TIFF (II*\0 o MM\0*)? */
    _esTiff(buffer) {
      if (!buffer || buffer.byteLength < 4) return false;
      var b = new Uint8Array(buffer, 0, 4);
      return (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00)
        || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a);
    }

    /**
     * Texto de un ServiceExceptionReport del WMS, si la respuesta es XML.
     * Los WMS devuelven el error con HTTP 200, así que no basta con `ok`.
     * @returns {Promise<string|null>}
     */
    async _mensajeExcepcion(respuesta, buffer) {
      var tipo = String(respuesta.headers.get('content-type') || '');
      if (!/xml|text/i.test(tipo)) return null;
      try {
        var bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4000));
        var texto = new TextDecoder('utf-8').decode(bytes);
        var coincidencia = texto.match(/<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>/i);
        var mensaje = (coincidencia ? coincidencia[1] : texto)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return mensaje ? mensaje.slice(0, 300) : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Bbox de 3857 a 4326 (esquina SW y NE), para los servicios que no
     * admiten Web Mercator.
     * @param {Array<number>} bbox Encuadre en 3857.
     * @returns {Array<number>|null}
     */
    _a4326(bbox) {
      var IDEE = api();
      if (!IDEE || !IDEE.utils || typeof IDEE.utils.reproject !== 'function') return null;
      try {
        var sw = IDEE.utils.reproject([bbox[0], bbox[1]], 'EPSG:3857', 'EPSG:4326');
        var ne = IDEE.utils.reproject([bbox[2], bbox[3]], 'EPSG:3857', 'EPSG:4326');
        if (!sw || !ne || !isFinite(sw[0]) || !isFinite(ne[1])) return null;
        return [sw[0], sw[1], ne[0], ne[1]];
      } catch (e) {
        return null;
      }
    }

    /**
     * Fija la georreferenciación del ráster capturado con el bbox que se pidió.
     * Es más fiable que la que traiga el fichero: hay servicios (IGNBaseTodo)
     * que escriben ModelTransformation en vez de ModelTiepoint + PixelScale.
     * @param {Array<number>} bbox Encuadre del GetMap, en el SRC pedido.
     * @param {number} epsg SRC del bbox.
     */
    _completarGeoRaster(bbox, epsg) {
      var r = this._raster;
      if (!r || !bbox) return;
      r.origenX = bbox[0];
      r.origenY = bbox[3];
      r.resX = (bbox[2] - bbox[0]) / r.ancho;
      r.resY = (bbox[3] - bbox[1]) / r.alto;
      r.bbox = bbox.slice();
      if (!r.epsg) r.epsg = epsg;
    }

    /**
     * Abre el GeoTIFF con geotiff.js y guarda en `this._raster` lo que hace
     * falta para calcular y para volver a escribirlo.
     * @param {ArrayBuffer} buffer Bytes del fichero.
     */
    async _abrirRaster(buffer) {
      var GeoTIFF = await cargarGeoTIFF();
      var tiff = await GeoTIFF.fromArrayBuffer(buffer);
      var image = await tiff.getImage();

      var fd = image.getFileDirectory() || {};
      var geoKeys = {};
      try { geoKeys = image.getGeoKeys() || {}; } catch (e) { geoKeys = {}; }

      var epsg = geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey || null;
      var origen = [0, 0, 0];
      var resolucion = [0, 0, 0];
      var bbox = null;
      try { origen = image.getOrigin(); } catch (e) { origen = [0, 0, 0]; }
      try { resolucion = image.getResolution(); } catch (e) { resolucion = [0, 0, 0]; }
      try { bbox = image.getBoundingBox(); } catch (e) { bbox = null; }

      var nodata = leerNodata(fd);

      this._raster = {
        buffer: buffer,
        tiff: tiff,
        image: image,
        ancho: image.getWidth(),
        alto: image.getHeight(),
        bandas: image.getSamplesPerPixel(),
        tipoDato: this._tipoDato(fd),
        epsg: epsg,
        origenX: origen[0],
        origenY: origen[1],
        resX: resolucion[0],
        resY: Math.abs(resolucion[1]),
        bbox: bbox,
        nodata: nodata,
      };
    }

    /** 'Float32', 'UInt16'… a partir del FileDirectory del TIFF. */
    _tipoDato(fd) {
      var bits = fd.BitsPerSample && fd.BitsPerSample[0] !== undefined ? fd.BitsPerSample[0] : fd.BitsPerSample;
      var formato = fd.SampleFormat && fd.SampleFormat[0] !== undefined ? fd.SampleFormat[0] : fd.SampleFormat;
      var prefijo = formato === 2 ? 'Int' : (formato === 3 ? 'Float' : 'UInt');
      if (!bits) return '—';
      return prefijo + bits;
    }

    _pintarMeta() {
      var dl = this._el.rasMeta;
      if (!dl) return;
      dl.innerHTML = '';
      var r = this._raster;
      if (!r) {
        dl.classList.add('gp-oculto');
        return;
      }
      var filas = [
        ['Tamaño', r.ancho + ' × ' + r.alto + ' px'],
        ['Bandas', String(r.bandas)],
        ['Tipo', r.tipoDato],
        ['SRC', r.epsg ? 'EPSG:' + r.epsg : 'sin georreferenciar'],
        ['Extensión', r.bbox
          ? r.bbox.map(function (v) { return Number(Number(v).toFixed(4)); }).join(', ')
          : '—'],
      ];
      filas.forEach(function (fila) {
        var dt = document.createElement('dt');
        dt.textContent = fila[0];
        var dd = document.createElement('dd');
        dd.textContent = fila[1];
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      dl.classList.remove('gp-oculto');
    }

    _mostrarBloquesRaster(visible) {
      this._el.rasCalc.classList.toggle('gp-oculto', !visible);
      this._el.rasGdal.classList.toggle('gp-oculto', !visible);
      // El aviso de «sin fuente» solo se enseña mientras no haya GeoTIFF.
      if (this._el.rasSinFuente) this._el.rasSinFuente.classList.toggle('gp-oculto', !!visible);
      // Al cambiar de fuente, el resultado anterior ya no corresponde.
      this._el.rasResultado.classList.add('gp-oculto');
    }

    /* =================================================================== *
     * 7. PESTAÑA RÁSTER · CALCULADORA DE BANDAS
     * =================================================================== */

    async _calcularRaster() {
      var r = this._raster;
      var estado = this._el.rasEstado;
      if (!r) {
        this._estado(estado, 'Carga primero un GeoTIFF.', 'error');
        return;
      }
      var expresion = String(this._el.expresion.value || '').trim();
      if (!expresion) {
        this._estado(estado, 'Escribe una expresión, por ejemplo (B1 - B2) / (B1 + B2).', 'error');
        return;
      }
      var total = r.ancho * r.alto;
      if (total > 16000000) {
        this._estado(estado, 'La imagen es demasiado grande para calcular en el navegador ('
          + r.ancho + '×' + r.alto + '). Recórtala antes con el geoproceso «Recortar».', 'error');
        return;
      }

      var boton = this._el.calcular;
      boton.disabled = true;
      try {
        this._estado(estado, 'Leyendo las bandas…', 'cargando');
        var bandas = await r.image.readRasters();
        var nBandas = bandas.length;
        if (!nBandas) throw new Error('El GeoTIFF no tiene bandas.');

        // B1..Bn y las funciones de Math sueltas (sqrt, log, abs…) además de
        // Math.xxx. Se generan los nombres de argumento según el número de bandas.
        var nombres = [];
        for (var i = 1; i <= nBandas; i += 1) nombres.push('B' + i);
        var cuerpo = 'var abs=Math.abs,sqrt=Math.sqrt,pow=Math.pow,log=Math.log,exp=Math.exp,'
          + 'min=Math.min,max=Math.max,round=Math.round,floor=Math.floor,ceil=Math.ceil,'
          + 'atan2=Math.atan2,sign=Math.sign,PI=Math.PI,E=Math.E;return (' + expresion + ');';
        var fn;
        try {
          fn = new Function(nombres.join(','), 'Math', cuerpo);
        } catch (e) {
          throw new Error('La expresión no es válida: ' + e.message);
        }

        var datos = new Float32Array(total);
        var nodata = r.nodata;
        var args = new Array(nBandas + 1);
        var bloque = 500000;

        for (var inicio = 0; inicio < total; inicio += bloque) {
          var fin = Math.min(total, inicio + bloque);
          for (var p = inicio; p < fin; p += 1) {
            var omitir = false;
            for (var b = 0; b < nBandas; b += 1) {
              var v = bandas[b][p];
              if (nodata !== null && !Number.isNaN(nodata) && v === nodata) { omitir = true; break; }
              args[b] = v;
            }
            if (omitir) { datos[p] = NaN; continue; }
            args[nBandas] = Math;
            var res;
            try { res = fn.apply(null, args); } catch (e) { datos[p] = NaN; continue; }
            datos[p] = (typeof res === 'number' && isFinite(res)) ? res : NaN;
          }
          if (fin < total) {
            this._estado(estado, 'Calculando… ' + Math.round((fin / total) * 100) + ' %', 'cargando');
            await new Promise(function (ok) { setTimeout(ok, 0); });
          }
        }

        var escritor = await cargarEscritorGeoTIFF();
        var buffer = escritor.escribirGeoTIFFFloat32({
          ancho: r.ancho,
          alto: r.alto,
          datos: datos,
          origenX: r.origenX,
          origenY: r.origenY,
          resX: r.resX || 1,
          resY: r.resY || 1,
          epsg: r.epsg || 4326,
        });

        var nombre = 'GP cálculo ' + (this._contadorResultados = (this._contadorResultados || 0) + 1);
        this._mostrarResultadoRaster(buffer, nombre + '.tif', r.ancho + ' × ' + r.alto);
        if (r.epsg) await this._anadirRasterAlMapa(buffer, nombre);
        this._estado(estado, r.epsg
          ? 'Resultado calculado y añadido al mapa.'
          : 'Resultado calculado. El GeoTIFF de origen no tiene georreferenciación: no se puede añadir al mapa, solo descargar.', r.epsg ? 'ok' : 'info');
      } catch (e) {
        console.error('[geoprocesos] calculadora', e);
        this._estado(estado, 'Error en el cálculo: ' + (e && e.message ? e.message : e), 'error');
      } finally {
        boton.disabled = false;
      }
    }

    /**
     * Guarda el resultado para descargarlo y lo pinta en el bloque de resultado.
     * @param {ArrayBuffer} buffer GeoTIFF.
     * @param {string} nombreFichero Nombre con extensión.
     * @param {string} detalle Texto de tamaño para el resumen.
     */
    _mostrarResultadoRaster(buffer, nombreFichero, detalle) {
      var blob = new Blob([buffer], { type: 'image/tiff' });
      this._resultadoRaster = { blob: blob, nombre: nombreFichero };
      this._el.rasResumen.textContent = nombreFichero + (detalle ? ' · ' + detalle : '');
      // La leyenda de la rampa solo vale para el resultado que se acaba de
      // añadir al mapa; si el nuevo no se coloriza, se queda oculta.
      if (this._el.rasRampa) this._el.rasRampa.classList.add('gp-oculto');
      this._el.rasResultado.classList.remove('gp-oculto');
      // Si el usuario había plegado la sección, se abre para que vea el
      // resultado recién generado.
      this._el.rasResultado.open = true;
    }

    /** Descarga el último resultado ráster. */
    _descargarResultadoRaster() {
      if (!this._resultadoRaster) {
        this._estado(this._el.rasEstado, 'Todavía no hay ningún resultado.', 'info');
        return;
      }
      descargarBlob(this._resultadoRaster.blob, this._resultadoRaster.nombre);
    }

    /**
     * Coloriza un GeoTIFF de una sola banda con la rampa viridis.
     *
     * Solo se usa para la capa del mapa: `ol.source.GeoTIFF` pinta negro un
     * Float32 de una banda (aunque se le pida `normalize`), así que un índice,
     * un umbral o una reclasificación no se verían. Se estira el rango de los
     * píxeles válidos (sin NaN ni nodata) a 0–255 y se escribe un RGB de 8 bits
     * con la georreferenciación del propio fichero, porque el resultado de
     * gdal3.js no pasa por `_abrirRaster`. El GeoTIFF original no se toca: es
     * el que se descarga.
     *
     * @param {ArrayBuffer} buffer GeoTIFF de origen.
     * @returns {Promise<Object|null>} `{ buffer, minimo, maximo }` o null si no
     *   procede (varias bandas, paleta, sin SRC o sin valores).
     */
    async _colorizarRaster(buffer) {
      var GeoTIFF = await cargarGeoTIFF();
      var tiff = await GeoTIFF.fromArrayBuffer(buffer);
      var image = await tiff.getImage();
      if (image.getSamplesPerPixel() !== 1) return null;

      var fd = image.getFileDirectory() || {};
      // Un TIFF con tabla de color ya trae su propia paleta: no se pisa.
      if (fd.ColorMap) return null;

      var ancho = image.getWidth();
      var alto = image.getHeight();
      var total = ancho * alto;
      if (!(total > 0) || total > 16000000) return null;

      var nodata = leerNodata(fd);
      var rasters = await image.readRasters();
      var datos = rasters[0];
      if (!datos || datos.length !== total) return null;

      // Rango real de los píxeles válidos: es lo que se estira a la rampa.
      var minimo = Infinity;
      var maximo = -Infinity;
      for (var i = 0; i < total; i += 1) {
        var v = datos[i];
        if (!isFinite(v)) continue;
        if (nodata !== null && !Number.isNaN(nodata) && v === nodata) continue;
        if (v < minimo) minimo = v;
        if (v > maximo) maximo = v;
      }
      if (!isFinite(minimo) || !isFinite(maximo)) return null;

      var rango = maximo - minimo;
      var rgb = new Uint8Array(total * 3);
      for (var p = 0; p < total; p += 1) {
        var val = datos[p];
        var nulo = !isFinite(val)
          || (nodata !== null && !Number.isNaN(nodata) && val === nodata);
        var j = p * 3;
        if (nulo) {
          // Sin dato en blanco: sobre un fondo claro se lee como hueco.
          rgb[j] = 255;
          rgb[j + 1] = 255;
          rgb[j + 2] = 255;
        } else {
          var c = colorRampa(rango > 0 ? (val - minimo) / rango : 0.5);
          rgb[j] = c[0];
          rgb[j + 1] = c[1];
          rgb[j + 2] = c[2];
        }
      }

      var geoKeys = {};
      try { geoKeys = image.getGeoKeys() || {}; } catch (e) { geoKeys = {}; }
      var epsg = geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey || null;
      if (!epsg) return null;

      var origen = [0, 0, 0];
      var resolucion = [0, 0, 0];
      try { origen = image.getOrigin(); } catch (e) { origen = [0, 0, 0]; }
      try { resolucion = image.getResolution(); } catch (e) { resolucion = [0, 0, 0]; }
      if (!(Math.abs(resolucion[0]) > 0) || !(Math.abs(resolucion[1]) > 0)) return null;

      var escritor = await cargarEscritorGeoTIFF();
      return {
        buffer: escritor.escribirGeoTIFFUInt8({
          ancho: ancho,
          alto: alto,
          bandas: 3,
          datos: rgb,
          origenX: origen[0],
          origenY: origen[1],
          resX: Math.abs(resolucion[0]),
          resY: Math.abs(resolucion[1]),
          epsg: epsg,
        }),
        minimo: minimo,
        maximo: maximo,
      };
    }

    /**
     * Añade un GeoTIFF en memoria al mapa.
     *
     * `IDEE.layer.GeoTIFF` en 2D hace `fetch(this.blob)`, así que se le pasa una
     * URL de objeto; en 3D la fachada de `ext/geotiffLayer` lee el Blob
     * directamente. `normalize: true` estira los valores al rango visible, que es
     * lo que hace falta para un índice o un umbral.
     *
     * Si el resultado tiene una sola banda se coloriza antes de crear la capa
     * (ver `_colorizarRaster`) y se avisa en el bloque de resultado; el buffer
     * que se descarga sigue siendo el original.
     *
     * @param {ArrayBuffer} buffer GeoTIFF.
     * @param {string} nombre Nombre de la capa.
     * @returns {Promise<Object|null>} Capa creada o null.
     */
    async _anadirRasterAlMapa(buffer, nombre) {
      var IDEE = api();
      if (!IDEE || !IDEE.layer || !IDEE.layer.GeoTIFF) {
        this._estado(this._el.rasEstado, 'La API no expone IDEE.layer.GeoTIFF en esta implementación.', 'error');
        return null;
      }

      var paraMapa = buffer;
      var rango = null;
      try {
        var colorizado = await this._colorizarRaster(buffer);
        if (colorizado) {
          paraMapa = colorizado.buffer;
          rango = { minimo: colorizado.minimo, maximo: colorizado.maximo };
        }
      } catch (e) {
        console.warn('[geoprocesos] no se ha podido colorizar el ráster', e);
      }

      var blob = new Blob([paraMapa], { type: 'image/tiff' });
      var url = URL.createObjectURL(blob);
      this._urlsRaster.push(url);
      try {
        var opciones = {
          name: nombre,
          legend: nombre,
          normalize: true,
        };
        // En 2D `IDEE.layer.GeoTIFF` hace `fetch(this.blob)` y necesita la URL;
        // en 3D la fachada de `ext/geotiffLayer` llama a `this.blob.arrayBuffer()`
        // y necesita el Blob de verdad.
        opciones.blob = this._esCesium() ? blob : url;
        var capa = new IDEE.layer.GeoTIFF(opciones);
        if (typeof this._map.addLayers === 'function') this._map.addLayers(capa);
        else this._map.addLayer(capa);
        this._capasResultado.push({ id: capa.idLayer, legend: nombre });
        this._pintarLeyendaRampa(rango);
        this._refrescarCapas();
        return capa;
      } catch (e) {
        console.error('[geoprocesos] capa GeoTIFF', e);
        this._estado(this._el.rasEstado, 'No se ha podido añadir la capa GeoTIFF'
          + (this._esCesium() ? ' en 3D (hace falta ext/geotiffLayer)' : '') + ': ' + (e && e.message ? e.message : e), 'error');
        return null;
      }
    }

    /**
     * Muestra u oculta la leyenda de la rampa en el bloque de resultado.
     * @param {Object|null} rango `{ minimo, maximo }` o null si no hay rampa.
     */
    _pintarLeyendaRampa(rango) {
      var caja = this._el.rasRampa;
      if (!caja) return;
      if (!rango) {
        caja.classList.add('gp-oculto');
        return;
      }
      var fmt = function (v) {
        return Number(v.toPrecision(4)).toLocaleString('es-ES', { maximumFractionDigits: 4 });
      };
      if (this._el.rasRampaBarra) this._el.rasRampaBarra.style.background = gradienteRampa();
      if (this._el.rasRampaTexto) {
        this._el.rasRampaTexto.textContent = 'Una banda: en el mapa se pinta con esta rampa, de '
          + fmt(rango.minimo) + ' a ' + fmt(rango.maximo)
          + '. El GeoTIFF descargado conserva los valores.';
      }
      caja.classList.remove('gp-oculto');
    }

    /* =================================================================== *
     * 8. PESTAÑA RÁSTER · GEOPROCESOS CON GDAL3.JS
     * =================================================================== */

    /** Pinta los parámetros del geoproceso ráster elegido. */
    _pintarParamsRaster() {
      var cont = this._el.rasParams;
      if (!cont) return;
      var self = this;
      var op = this._el.rasOp.value;
      cont.innerHTML = '';

      if (op === 'reproyectar') {
        cont.appendChild(this._selectSimple('epsg', [
          ['3857', 'EPSG:3857 · Web Mercator'],
          ['4326', 'EPSG:4326 · WGS 84'],
          ['25830', 'EPSG:25830 · ETRS89 / UTM 30N'],
          ['25831', 'EPSG:25831 · ETRS89 / UTM 31N'],
          ['32630', 'EPSG:32630 · WGS 84 / UTM 30N'],
          ['32631', 'EPSG:32631 · WGS 84 / UTM 31N'],
          ['4258', 'EPSG:4258 · ETRS89'],
        ], this._raster && this._raster.epsg === 3857 ? '4326' : '3857'));
        var fila = document.createElement('div');
        fila.className = 'gp-fila';
        fila.appendChild(this._inputSimple('epsgManual', 'number', '', { placeholder: 'otro EPSG', step: '1' }));
        cont.appendChild(fila);
        var nota = document.createElement('p');
        nota.className = 'gp-ayuda';
        nota.textContent = 'Si escribes un código EPSG, manda sobre la lista.';
        cont.appendChild(nota);
        return;
      }

      if (op === 'recortar') {
        var filaB = document.createElement('div');
        filaB.className = 'gp-fila gp-fila--bbox';
        [['minx', 'mín. X'], ['miny', 'mín. Y'], ['maxx', 'máx. X'], ['maxy', 'máx. Y']].forEach(function (par) {
          filaB.appendChild(self._inputSimple(par[0], 'number', '', { step: 'any', placeholder: par[1] }));
        });
        cont.appendChild(filaB);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gp-btn gp-btn--mini';
        btn.textContent = 'Usar la vista actual';
        btn.addEventListener('click', function () {
          var b = self._bboxVista();
          if (!b) return;
          ['minx', 'miny', 'maxx', 'maxy'].forEach(function (rol, i) {
            var inp = filaB.querySelector('[data-rol="' + rol + '"]');
            if (inp) inp.value = b[i];
          });
        });
        cont.appendChild(btn);
        var notaB = document.createElement('p');
        notaB.className = 'gp-ayuda';
        notaB.textContent = 'La extensión se interpreta en EPSG:4326.';
        cont.appendChild(notaB);
        return;
      }

      if (op === 'redimensionar') {
        var filaR = document.createElement('div');
        filaR.className = 'gp-fila';
        filaR.appendChild(this._inputSimple('ancho', 'number', '', { step: '1', min: '0', placeholder: 'ancho' }));
        filaR.appendChild(this._inputSimple('alto', 'number', '', { step: '1', min: '0', placeholder: 'alto' }));
        cont.appendChild(filaR);
        var notaR = document.createElement('p');
        notaR.className = 'gp-ayuda';
        notaR.textContent = 'Deja 0 en un lado para que se calcule proporcional.';
        cont.appendChild(notaR);
        return;
      }

      // formato
      cont.appendChild(this._selectSimple('formato', [
        ['GTiff', 'GeoTIFF (.tif)'],
        ['PNG', 'PNG (.png)'],
        ['JPEG', 'JPEG (.jpg)'],
        ['BMP', 'BMP (.bmp)'],
        ['AAIGrid', 'AAIGrid (.asc)'],
        ['XYZ', 'XYZ (.xyz)'],
      ], 'GTiff'));
      var notaF = document.createElement('p');
      notaF.className = 'gp-ayuda';
      notaF.textContent = 'Solo GeoTIFF se puede volver a añadir al mapa; el resto se descarga.';
      cont.appendChild(notaF);
    }

    /** Lee los parámetros del geoproceso ráster. */
    _leerParamsRaster() {
      var cont = this._el.rasParams;
      var val = function (rol) {
        var el = cont ? cont.querySelector('[data-rol="' + rol + '"]') : null;
        return el ? String(el.value).trim() : '';
      };
      var num = function (rol) {
        var t = val(rol).replace(',', '.');
        return t === '' ? null : Number(t);
      };
      var manual = val('epsgManual');
      return {
        epsg: manual ? Number(manual) : Number(val('epsg') || 3857),
        bbox: [num('minx'), num('miny'), num('maxx'), num('maxy')],
        ancho: num('ancho') || 0,
        alto: num('alto') || 0,
        formato: val('formato') || 'GTiff',
      };
    }

    async _ejecutarGdalRaster() {
      var r = this._raster;
      var estado = this._el.rasEstado;
      if (!r) {
        this._estado(estado, 'Carga primero un GeoTIFF.', 'error');
        return;
      }
      var op = this._el.rasOp.value;
      var p = this._leerParamsRaster();
      var boton = this._el.rasEjecutar;
      boton.disabled = true;

      try {
        if (op === 'recortar' && p.bbox.some(function (v) { return v === null || Number.isNaN(v); })) {
          throw new Error('Indica las cuatro coordenadas de la extensión.');
        }
        if (op === 'redimensionar' && !p.ancho && !p.alto) {
          throw new Error('Indica al menos el ancho o el alto en píxeles.');
        }

        this._estado(estado, 'Cargando GDAL… (28 MB la primera vez)', 'cargando');
        var gdal = await cargarGdal();
        this._estado(estado, 'Ejecutando ' + op + '…', 'cargando');

        var fichero = new File([new Uint8Array(r.buffer)], 'gp_entrada_' + Date.now() + '.tif', { type: 'image/tiff' });
        var abierto = await gdal.open(fichero);
        var ds = abierto.datasets && abierto.datasets[0];
        if (!ds) throw new Error('GDAL no ha podido abrir el GeoTIFF de origen.');

        var nombreSalida = 'gp_' + op + '_' + Date.now();
        var salida;
        if (op === 'reproyectar') {
          salida = await gdal.gdalwarp(ds, ['-of', 'GTiff', '-t_srs', 'EPSG:' + p.epsg], nombreSalida);
        } else if (op === 'recortar') {
          salida = await gdal.gdalwarp(ds, [
            '-of', 'GTiff',
            '-te', String(p.bbox[0]), String(p.bbox[1]), String(p.bbox[2]), String(p.bbox[3]),
            '-te_srs', 'EPSG:4326',
          ], nombreSalida);
        } else if (op === 'redimensionar') {
          salida = await gdal.gdal_translate(ds, ['-of', 'GTiff', '-outsize', String(p.ancho), String(p.alto)], nombreSalida);
        } else {
          var driver = gdal.drivers && gdal.drivers.raster ? gdal.drivers.raster[p.formato] : null;
          if (!driver) throw new Error('GDAL no tiene el driver ráster «' + p.formato + '».');
          salida = await gdal.gdal_translate(ds, ['-of', p.formato], nombreSalida);
        }

        try { await gdal.close(ds); } catch (e) { /* ya cerrado */ }

        var bytes = await gdal.getFileBytes(salida.local);
        var buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        var extension = nombreDeRuta(salida.local).split('.').pop();
        var nombre = 'GP ' + op + ' ' + (this._contadorResultados = (this._contadorResultados || 0) + 1);

        if (extension === 'tif' || extension === 'tiff') {
          this._mostrarResultadoRaster(buffer, nombre.replace(/\s+/g, '_') + '.tif', 'gdal3.js · ' + op);
          await this._anadirRasterAlMapa(buffer, nombre);
          this._estado(estado, 'Geoproceso terminado y añadido al mapa.', 'ok');
        } else {
          descargarBlob(new Blob([buffer]), nombre.replace(/\s+/g, '_') + '.' + extension);
          this._estado(estado, 'Geoproceso terminado. El fichero se ha descargado (.' + extension + ').', 'ok');
        }
      } catch (e) {
        console.error('[geoprocesos] gdal', e);
        this._estado(estado, 'Error en el geoproceso: ' + this._mensajeGdal(e), 'error');
      } finally {
        boton.disabled = false;
      }
    }

    /* =================================================================== *
     * 9. PESTAÑA EXPORTAR · EXPORTACIÓN VECTORIAL CON GDAL3.JS
     * =================================================================== */

    /**
     * Carga GDAL (solo la primera vez) y rellena el desplegable de formatos
     * con los drivers vectoriales de escritura que trae la compilación.
     */
    async _cargarDriversVector() {
      if (this._driversVector) return;
      if (this._cargandoDrivers) return;
      this._cargandoDrivers = true;
      try {
        this._estado(this._el.expEstado, 'Cargando GDAL… (28 MB la primera vez)', 'cargando');
        var gdal = await cargarGdal();
        var drv = (gdal.drivers && gdal.drivers.vector) || {};
        this._driversVector = Object.keys(drv)
          .filter(function (k) { return drv[k] && drv[k].isWritable !== false; })
          .map(function (k) {
            return {
              nombre: k,
              etiqueta: drv[k].longName || k,
              extension: drv[k].extension || '',
            };
          })
          .sort(function (a, b) { return a.etiqueta.localeCompare(b.etiqueta); });
        this._rellenarFormatos();
        this._estado(this._el.expEstado, '', '');
      } catch (e) {
        console.error('[geoprocesos] drivers', e);
        this._estado(this._el.expEstado, 'No se ha podido cargar GDAL: ' + (e && e.message ? e.message : e), 'error');
      } finally {
        this._cargandoDrivers = false;
      }
    }

    _rellenarFormatos() {
      var sel = this._el.expFormato;
      if (!sel) return;
      var previo = sel.value || 'GeoJSON';
      sel.innerHTML = '';
      (this._driversVector || []).forEach(function (d) {
        var o = opcion(d.nombre, d.etiqueta + (d.extension ? ' (.' + d.extension + ')' : ''));
        if (d.nombre === previo) o.selected = true;
        sel.appendChild(o);
      });
      if (!sel.options.length) {
        sel.appendChild(opcion('', '— sin formatos —'));
        return;
      }
      if (!sel.value) sel.value = 'GeoJSON';
    }

    /** Nombre de fichero seguro a partir del nombre de la capa. */
    _nombreFicheroSeguro(nombre) {
      return String(nombre || 'capa')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'capa';
    }

    /** Traduce los errores de gdal3 más habituales a algo accionable. */
    _mensajeGdal(e) {
      var txt = (e && e.message) ? e.message : String(e);
      // Los dos mensajes con los que gdal3 se rompe cuando el formato de salida
      // no admite la mezcla de geometrías de la capa (Shapefile, CSV...).
      if (/memory access out of bounds|GDALGetFileList|is NULL/i.test(txt)) {
        return 'GDAL no ha podido crear el fichero. Suele pasar cuando la capa mezcla puntos, líneas y '
          + 'polígonos y el formato de salida no lo admite (Shapefile, CSV…). Prueba con GeoJSON, GPKG '
          + 'o KML, o divide la capa por tipo de geometría. Detalle: ' + txt;
      }
      if (/not supported|unsupported|does not support/i.test(txt)) {
        return 'El formato no admite estos datos: ' + txt;
      }
      return txt;
    }

    async _exportarVector() {
      var estado = this._el.expEstado;
      var id = this._el.expCapa.value;
      if (!id) {
        this._estado(estado, 'Elige la capa que quieres exportar.', 'error');
        return;
      }
      var capa = this._capaPorId(id);
      var fc = this._geoJSONDeCapa(capa);
      if (!fc || !fc.features.length) {
        this._estado(estado, 'La capa no tiene entidades que exportar.', 'error');
        return;
      }
      var driver = this._el.expFormato.value;
      if (!driver) {
        this._estado(estado, 'Elige un formato de salida.', 'error');
        return;
      }

      var boton = this._el.expBtn;
      boton.disabled = true;
      try {
        this._estado(estado, 'Cargando GDAL… (28 MB la primera vez)', 'cargando');
        var gdal = await cargarGdal();
        if (!this._driversVector) await this._cargarDriversVector();
        if (!gdal.drivers || !gdal.drivers.vector || !gdal.drivers.vector[driver]) {
          throw new Error('GDAL no tiene el driver «' + driver + '».');
        }

        var nombreBase = this._nombreFicheroSeguro(this._nombreCapa(capa));
        this._estado(estado, 'Exportando a ' + driver + '…', 'cargando');

        var fichero = new File([JSON.stringify(fc)], nombreBase + '.geojson', { type: 'application/geo+json' });
        var abierto = await gdal.open(fichero);
        var ds = abierto.datasets && abierto.datasets[0];
        if (!ds) throw new Error('GDAL no ha podido abrir la capa.');

        var salida = await gdal.ogr2ogr(
          ds,
          ['-f', driver, '-t_srs', 'EPSG:4326'],
          nombreBase + '_' + Date.now()
        );
        try { await gdal.close(ds); } catch (e) { /* ya cerrado */ }

        var rutas = (salida && salida.all && salida.all.length) ? salida.all : [salida.local];
        var ficheros = [];
        for (var i = 0; i < rutas.length; i += 1) {
          var ruta = (rutas[i] && typeof rutas[i] === 'object') ? rutas[i].local : rutas[i];
          if (!ruta) continue;
          var bytes = await gdal.getFileBytes(ruta);
          if (!bytes || !bytes.length) continue;
          ficheros.push({ nombre: nombreDeRuta(ruta), bytes: bytes });
        }
        if (!ficheros.length) throw new Error('GDAL no ha generado ningún fichero.');

        if (ficheros.length === 1) {
          descargarBlob(new Blob([ficheros[0].bytes]), ficheros[0].nombre);
          this._estado(estado, 'Exportado: ' + ficheros[0].nombre, 'ok');
        } else {
          // Shapefile y compañía generan varios ficheros: se empaquetan en zip.
          var JSZip = await cargarJSZip();
          var zip = new JSZip();
          ficheros.forEach(function (f) { zip.file(f.nombre, f.bytes); });
          var blobZip = await zip.generateAsync({ type: 'blob' });
          descargarBlob(blobZip, nombreBase + '_' + driver.replace(/[^a-zA-Z0-9_-]+/g, '_') + '.zip');
          this._estado(estado, 'Exportado en zip: ' + ficheros.map(function (f) { return f.nombre; }).join(', '), 'ok');
        }
      } catch (e) {
        console.error('[geoprocesos] exportación', e);
        this._estado(estado, 'Error al exportar: ' + this._mensajeGdal(e), 'error');
      } finally {
        boton.disabled = false;
      }
    }

    /* =================================================================== *
     * 10. DESMONTAJE
     * =================================================================== */

    destroy() {
      try {
        if (this._panel && this._map && typeof this._map.removePanels === 'function') {
          this._map.removePanels(this._panel);
        }
      } catch (e) { /* el panel ya no estaba */ }
      (this._urlsRaster || []).forEach(function (u) {
        try { URL.revokeObjectURL(u); } catch (e) { /* nada */ }
      });
      this._urlsRaster = [];
      this._resultadoRaster = null;
      this._raster = null;
      this._el = {};
      this._panel = null;
      this._control = null;
      this._raiz = null;
    }
  }

  /* =================================================================== *
   * 4. EXPOSICIÓN TRIPLE GLOBAL
   * =================================================================== */

  if (typeof window !== 'undefined') {
    window.miPlugin_geoprocesos = miPlugin_geoprocesos;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_geoprocesos = miPlugin_geoprocesos;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_geoprocesos = miPlugin_geoprocesos;
  }
})();
