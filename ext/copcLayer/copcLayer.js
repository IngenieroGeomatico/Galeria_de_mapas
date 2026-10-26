/*
 * copcLayer: capa COPC de lectura directa (3D) con huella en 2D.
 *
 * QUE HACE
 *
 *   new IDEE.layer.COPC({
 *     url,                 // URL del .copc.laz (HTTP Range y CORS)
 *     bbox,                // [oeste, sur, este, norte] en EPSG:4326
 *     name, legend,        // como cualquier capa de la API
 *     copc: { ... },       // opciones de copcesium (puntos, nodos, pixelSize...)
 *   }, { style });
 *
 * COPC es un LAZ ordenado en un octree y con un directorio al principio: el
 * cliente pide solo los nodos que necesita por HTTP Range. Cesium no lo lee de
 * serie, asi que esta extension usa `copcesium` (MIT) para convertirlo en
 * primitivas de puntos del viewer.
 *
 * - 3D: la capa se comporta como una capa de la API (selector, visibilidad,
 *   opacidad, zoom a la capa y destroy), pero los puntos viven en un
 *   `CopcDataSource` enganchado al viewer de Cesium.
 * - 2D: no hay lector de COPC en OpenLayers; se dibuja la huella del `bbox`
 *   con la propia capa Vector. La pagina avisa de que los puntos son solo 3D.
 *
 * La fachada extiende `IDEE.layer.Vector` a proposito: es la clase de la API
 * que funciona en 2D y en 3D y la que entiende el selector. `GenericVector` no
 * sirve (medido: su impl no tiene `setVisible` y `map.addLayers` falla).
 *
 * El vendor `copcesium.js` NO se carga al abrir la pagina: se pide la primera
 * vez que hay un mapa 3D, porque el bundle usa `window.Cesium` en el momento de
 * ejecutarse. Si se cambia 2D -> 3D -> 2D -> 3D, el global Cesium es otro y el
 * vendor se vuelve a cargar para no mezclar clases de dos bundles.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  var URL_VENDOR = (function () {
    try {
      var propio = (document.currentScript && document.currentScript.src) || '';
      return new URL('./copcesium.js', propio || location.href).href;
    } catch (e) {
      return '/ext/copcLayer/copcesium.js';
    }
  })();

  // Presupuesto de puntos pensado para que el LoD se reparta por toda la
  // vista. Con topes bajos (p. ej. 500k) el nodo mas cercano consume el cupo,
  // se subdivide solo el y el resto queda como una tesela gruesa alrededor:
  // se ve una zona nitida y el resto borroso. El COPC de Autzen tiene 10,6
  // millones de puntos; 2,5 millones bastan para una vista uniforme a 600 m
  // (56 nodos, ~2,1 millones de puntos, ~16 MB) sin bajar el arbol entero ni
  // disparar la memoria. El visor de copcesium usa 5M; por encima de 2,5M no
  // se anaden nodos en esa vista.
  var OPCIONES_COPC = {
    autoFrame: false,
    maxPoints: 2500000,
    maxVisibleNodes: 120,
    maxCacheNodes: 150,
    concurrency: 5,
    debounceMs: 120,
    pixelSize: 2,
    sseThreshold: 200,
    colorMode: 'rgb',
    opacity: 1,
  };

  // Retrasos del arranque: en 3D el impl del mapa puede existir antes que el
  // viewer este listo. Se reintenta sin bloquear el resto de la pagina.
  var ESPERAS_ARRANQUE = [0, 120, 400, 900];

  var claseCOPC = null;
  var baseVector = null;
  var promesaVendor = null;

  /**
   * API viva. En este repositorio conviven `IDEE` y `M` como alias.
   * @returns {Object|null}
   */
  function api() {
    return window.IDEE || window.M || null;
  }

  /**
   * Implementacion activa del mapa. El impl de Cesium tiene `scene.camera`;
   * el de OpenLayers no.
   * @param {Object} map
   * @returns {boolean}
   */
  function esCesium(map) {
    try {
      var impl = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
      return !!(impl && impl.scene && impl.scene.camera && typeof window.Cesium !== 'undefined');
    } catch (e) {
      return false;
    }
  }

  /**
   * Carga el bundle local de copcesium como script clasico.
   *
   * El bundle original es ESM y hace `import * as e from "cesium"`. La copia de
   * `copcesium.js` cambia ese import por `const e = window.Cesium`, por eso
   * solo se puede ejecutar cuando la API ya ha cargado Cesium (3D).
   *
   * @returns {Promise<Object>} `window.copcesium`.
   */
  function cargarVendor() {
    if (typeof window.Cesium === 'undefined') {
      return Promise.reject(new Error('COPC: los puntos solo estan disponibles en 3D (Cesium no cargado)'));
    }

    var actual = window.copcesium;
    if (actual && typeof actual.CopcDataSource === 'function' && actual.__cesium === window.Cesium) {
      return Promise.resolve(actual);
    }

    if (promesaVendor) return promesaVendor;

    var anterior = !!actual;
    var promesa = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      // Si habia un vendor de un ciclo anterior, se pide con cache-busting:
      // el navegador podria devolver el fichero viejo y dejaria las clases
      // Cesium antiguas enganchadas.
      script.src = URL_VENDOR + (anterior ? ('?v=' + Date.now()) : '');
      script.async = true;
      script.onload = function () {
        var lib = window.copcesium;
        if (lib && typeof lib.CopcDataSource === 'function') {
          lib.__cesium = window.Cesium;
          window.CopcDataSource = lib.CopcDataSource;
          resolve(lib);
        } else {
          reject(new Error('COPC: copcesium no se registro al cargar ' + URL_VENDOR));
        }
      };
      script.onerror = function () {
        reject(new Error('COPC: no se pudo cargar ' + URL_VENDOR));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    promesaVendor = promesa;
    promesa.then(function () {
      if (promesaVendor === promesa) promesaVendor = null;
    }, function () {
      if (promesaVendor === promesa) promesaVendor = null;
    });
    return promesa;
  }

  /**
   * Crea la clase de capa para el bundle activo de la API.
   *
   * @param {Object} IDEE
   * @returns {Function}
   */
  function crearClase(IDEE) {
    var Base = IDEE.layer.Vector;

    class COPCLayer extends Base {
      constructor(parametros, opciones) {
        var p = parametros || {};
        var o = opciones || {};
        var baseParams = Object.assign({}, p);
        var estilo = o.style || p.style;
        var ext = p.bbox || p.bounds || null;
        var opcionesCopc = p.copc || p.copcOptions || {};

        // Parametros propios: no se pasan al constructor de Vector, que podria
        // interpretar \`url\` como una fuente de datos.
        delete baseParams.url;
        delete baseParams.bbox;
        delete baseParams.bounds;
        delete baseParams.copc;
        delete baseParams.copcOptions;
        delete baseParams.style;

        if (!baseParams.name && !baseParams.legend) {
          baseParams.name = 'COPC';
          baseParams.legend = 'COPC';
        } else if (!baseParams.legend) {
          baseParams.legend = baseParams.name;
        } else if (!baseParams.name) {
          baseParams.name = baseParams.legend;
        }

        var opcionesBase = Object.assign({}, o);
        if (estilo) opcionesBase.style = estilo;

        super(baseParams, opcionesBase);

        this._copc = true;
        this._copcUrl = String(p.url || '');
        this._copcBbox = Array.isArray(ext) && ext.length === 4 ? ext.slice() : null;
        this._copcOpciones = Object.assign({}, OPCIONES_COPC, opcionesCopc);
        this._copcVisible = (p.visible !== false);
        this._copcOpacity = normalizarOpacidad(p.opacity, 1);
        this._copcDs = null;
        this._copcIniciado = false;
        this._copcProgramado = false;
        this._copcDestruido = false;
        this._copcEs3D = false;
        this._copcError = null;
        this._copcFeature = false;
        this._copcExtent3857 = null;
        this._copcToken = 0;
        this._copcListenerMap = null;
        this._copcOnRemoved = null;
      }

      /**
       * Enganche al mapa. La API llama a \`setMap()\` antes de \`addTo()\`; en 3D
       * el viewer puede no estar listo en ese instante, por eso se reintenta.
       */
      setMap(map) {
        var anterior = this.map_;
        var cambiaMapa = (map !== anterior);
        if (cambiaMapa) this._copcToken++;
        super.setMap(map);
        if (cambiaMapa && anterior) this._copcSoltarRemocion(anterior);
        if (!map) {
          this._copcIniciado = false;
          this._copcDestruirDs();
          return;
        }
        this._copcEngancharRemocion(map);
        if (cambiaMapa) {
          this._copcIniciado = false;
          this._copcProgramarArranque(map, 0);
        }
      }

      /**
       * `mapajs.removeLayers(capa)` no llama a `destroy()` en la fachada: quita
       * la capa de la implementacion y emite REMOVED_LAYER. Sin este listener,
       * el `CopcDataSource` seguiria pintando puntos en el viewer aunque la
       * capa ya no estuviera en la lista del selector.
       * @param {Object} map
       */
      _copcEngancharRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || this._copcListenerMap === map || !evt || typeof map.on !== 'function') return;

        var self = this;
        this._copcOnRemoved = function (capas) {
          var lista = Array.isArray(capas) ? capas : (capas ? [capas] : []);
          for (var i = 0; i < lista.length; i++) {
            if (lista[i] === self) {
              self._copcAlQuitarDelMapa();
              break;
            }
          }
        };
        try {
          map.on(evt, this._copcOnRemoved);
          this._copcListenerMap = map;
        } catch (e) {
          this._copcOnRemoved = null;
        }
      }

      /**
       * @param {Object} map
       */
      _copcSoltarRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || !evt || !this._copcOnRemoved) return;
        try {
          if (typeof map.un === 'function') map.un(evt, this._copcOnRemoved);
        } catch (e) { /* noop */ }
        if (this._copcListenerMap === map) this._copcListenerMap = null;
        this._copcOnRemoved = null;
      }

      /**
       * Limpieza al quitar la capa del mapa sin pasar por `destroy()`.
       */
      _copcAlQuitarDelMapa() {
        this._copcToken++;
        this._copcIniciado = false;
        this._copcDestruirDs();
        this._copcSoltarRemocion(this._copcListenerMap);
        // `removeLayers()` no toca `map_`: la fachada sigue apuntando al mapa
        // viejo. Se suelta para que un reenganche posterior vuelva a arrancar
        // y para que una carga en vuelo no se aplique a un mapa ya sin capa.
        this.map_ = null;
      }

      addTo(map, e) {
        var salida = super.addTo ? super.addTo(map, e) : undefined;
        this._copcProgramarArranque(map, 0);
        return salida;
      }

      /**
       * Reintenta el arranque hasta que \`getMapImpl()\` devuelve algo.
       * @param {Object} map
       * @param {number} intento
       */
      _copcProgramarArranque(map, intento) {
        var self = this;
        if (this._copcIniciado || this._copcProgramado || this._copcDestruido) return;
        this._copcProgramado = true;
        var token = this._copcToken;
        var espera = ESPERAS_ARRANQUE[Math.min(intento, ESPERAS_ARRANQUE.length - 1)];

        setTimeout(function () {
          self._copcProgramado = false;
          if (self._copcDestruido || self._copcIniciado) return;

          // La capa se quito o se volvio a anadir mientras corria la espera.
          if (token !== self._copcToken || self.map_ !== map) {
            if (self.map_ && !self._copcIniciado) self._copcProgramarArranque(self.map_, 0);
            return;
          }

          var impl = null;
          try { impl = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null; } catch (e) { impl = null; }
          if (!impl && intento < ESPERAS_ARRANQUE.length - 1) {
            self._copcProgramarArranque(map, intento + 1);
            return;
          }
          self._copcIniciar(map);
        }, espera);
      }

      /**
       * En 2D dibuja la huella. En 3D engancha el lector COPC.
       * @param {Object} map
       */
      _copcIniciar(map) {
        if (this._copcIniciado || this._copcDestruido || this.map_ !== map) return;
        this._copcIniciado = true;
        this._copcEs3D = esCesium(map);

        if (!this._copcEs3D) {
          this._copcPintarHuella();
          return;
        }

        if (!this._copcUrl) {
          this._copcError = new Error('COPC: falta la URL del fichero');
          return;
        }
        this._copcCargar(map);
      }

      /**
       * Dibuja el rectangulo del \`bbox\` en la capa Vector (solo 2D).
       * En 3D el propio sistema de puntos ya da la posicion; no se anade una
       * entidad vectorial que pueda quedar mal proyectada.
       */
      async _copcPintarHuella() {
        var IDEE = api();
        var token = this._copcToken;
        if (!IDEE || !this._copcBbox || this._copcFeature) return;

        var o = this._copcBbox[0];
        var s = this._copcBbox[1];
        var e = this._copcBbox[2];
        var n = this._copcBbox[3];

        try {
          var sw = await IDEE.utils.reproject([o, s], 'EPSG:4326', 'EPSG:3857');
          var ne = await IDEE.utils.reproject([e, n], 'EPSG:4326', 'EPSG:3857');
          var x1 = sw[0];
          var y1 = sw[1];
          var x2 = ne[0];
          var y2 = ne[1];

          this._copcExtent3857 = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];

          if (this._copcDestruido || token !== this._copcToken || !this.map_) return;
          this.addFeatures([new IDEE.Feature('huella-copc', {
            type: 'Feature',
            id: 'huella-copc',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [x1, y1],
                [x2, y1],
                [x2, y2],
                [x1, y2],
                [x1, y1],
              ]],
            },
            properties: {
              nombre: 'Huella COPC',
              formato: 'COPC',
              url: this._copcUrl,
              oeste: o,
              sur: s,
              este: e,
              norte: n,
              nota: 'Los puntos COPC se cargan solo en 3D',
            },
          })]);
          this._copcFeature = true;
        } catch (error) {
          console.warn('COPC: no se pudo dibujar la huella', error);
        }
      }

      /**
       * Carga el COPC sobre el viewer de Cesium.
       * @param {Object} map
       */
      async _copcCargar(map) {
        var self = this;
        var token = this._copcToken;
        try {
          var copcesium = await cargarVendor();
          if (this._copcDestruido || token !== this._copcToken || this.map_ !== map) return;

          var viewer = map.getMapImpl();
          if (!viewer || !viewer.scene) throw new Error('COPC: el viewer de Cesium no esta listo');

          var ds = await copcesium.CopcDataSource.load(this._copcUrl, viewer, this._copcOpciones);
          if (this._copcDestruido || token !== this._copcToken || this.map_ !== map) {
            try { ds.destroy(); } catch (e) { /* noop */ }
            return;
          }

          this._copcDs = ds;
          this._copcAplicarEstado();

          // CopcDataSource puede quedarse sin nodos visibles hasta que hay un
          // render. Se piden varios en los primeros compases del vuelo.
          [0, 60, 300, 1000].forEach(function (espera) {
            setTimeout(function () {
              if (self._copcDestruido || token !== self._copcToken) return;
              try { viewer.scene.requestRender(); } catch (e) { /* noop */ }
            }, espera);
          });
        } catch (error) {
          if (!this._copcDestruido && token === this._copcToken) {
            this._copcError = error;
            console.warn('COPC: no se pudo cargar ' + this._copcUrl, error);
          }
        }
      }

      /**
       * Aplica visibilidad y opacidad al lector COPC.
       * \`CopcDataSource\` no tiene setVisible publico, pero comparte \`style\` con
       * todas sus primitivas: opacidad 0 es la forma segura de ocultarlo sin
       * tocar el LoD ni destruir los nodos cargados.
       */
      _copcAplicarEstado() {
        if (!this._copcDs) return;
        try {
          // `CopcDataSource` expone `opacity` directamente; aplica el valor a
          // las primitivas y pide un render. No usar `style`: ese getter vive
          // en la primitiva de cada nodo, no en el data source.
          this._copcDs.opacity = this._copcVisible ? this._copcOpacity : 0;
          var map = this.map_;
          var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
          if (viewer && viewer.scene && typeof viewer.scene.requestRender === 'function') {
            viewer.scene.requestRender();
          }
        } catch (error) {
          console.warn('COPC: no se pudo aplicar visibilidad/opacidad', error);
        }
      }

      setVisible(visible) {
        this._copcVisible = (visible !== false);
        if (super.setVisible) super.setVisible(this._copcVisible);
        this._copcAplicarEstado();
      }

      setOpacity(opacity) {
        this._copcOpacity = normalizarOpacidad(opacity, 1);
        if (super.setOpacity) super.setOpacity(this._copcOpacity);
        this._copcAplicarEstado();
      }

      /**
       * Extension estable para el boton de zoom del selector. En 3D la API
       * trabaja en grados; en 2D, en EPSG:3857.
       * @param {boolean} [user]
       * @returns {Array<number>|null}
       */
      getMaxExtent(user) {
        var ext = this._copcExtension();
        if (ext) return ext;
        return super.getMaxExtent(user);
      }

      _copcExtension() {
        if (!this._copcBbox) return null;

        var es3D = this._copcEs3D;
        if (!es3D) {
          try { es3D = esCesium(this.map_); } catch (e) { es3D = false; }
        }
        if (es3D) return this._copcBbox.slice();
        if (this._copcExtent3857) return this._copcExtent3857.slice();

        var IDEE = api();
        if (!IDEE || !IDEE.utils || typeof IDEE.utils.reproject !== 'function') return null;
        try {
          var sw = IDEE.utils.reproject([this._copcBbox[0], this._copcBbox[1]], 'EPSG:4326', 'EPSG:3857');
          var ne = IDEE.utils.reproject([this._copcBbox[2], this._copcBbox[3]], 'EPSG:4326', 'EPSG:3857');
          if (sw && typeof sw.then === 'function') return null;   // no bloquear el selector
          this._copcExtent3857 = [
            Math.min(sw[0], ne[0]), Math.min(sw[1], ne[1]),
            Math.max(sw[0], ne[0]), Math.max(sw[1], ne[1]),
          ];
          return this._copcExtent3857.slice();
        } catch (error) {
          return null;
        }
      }

      /**
       * Datos utiles para depuracion o para una ficha externa.
       * @returns {Object|null}
       */
      getCopcStats() {
        var ds = this._copcDs;
        if (!ds) return null;
        try {
          return {
            url: this._copcUrl,
            nodeCount: ds.nodeCount,
            maxDepth: ds.maxDepth,
            cacheSize: ds.cacheSize,
            stats: ds.stats,
            error: this._copcError ? String(this._copcError.message || this._copcError) : null,
          };
        } catch (e) {
          return null;
        }
      }

      _copcDestruirDs() {
        if (!this._copcDs) return;
        try { this._copcDs.destroy(); } catch (e) { /* noop */ }
        this._copcDs = null;
      }

      destroy() {
        this._copcDestruido = true;
        this._copcToken++;
        this._copcSoltarRemocion(this._copcListenerMap);
        this._copcDestruirDs();
        super.destroy();
      }
    }

    return COPCLayer;
  }

  function normalizarOpacidad(valor, porDefecto) {
    var n = Number(valor);
    if (!isFinite(n)) return porDefecto;
    return Math.max(0, Math.min(1, n));
  }

  /**
   * Instala (o reinstala) IDEE.layer.COPC sobre el bundle activo.
   * @returns {boolean}
   */
  function instalar() {
    var IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.Vector) return false;

    var baseActual = IDEE.layer.Vector;
    if (claseCOPC === null || baseVector !== baseActual) {
      claseCOPC = crearClase(IDEE);
      baseVector = baseActual;
      COPCLayer.prototype = claseCOPC.prototype;
    }

    if (IDEE.layer.COPC === COPCLayer) return true;

    IDEE.layer.COPC = COPCLayer;
    if (window.IDEE && window.IDEE.layer) window.IDEE.layer.COPC = COPCLayer;
    if (window.M && window.M.layer) window.M.layer.COPC = COPCLayer;
    return true;
  }

  /**
   * Fabricante de capas. Mantiene el nombre `IDEE.layer.COPC` estable mientras
   * la clase interna se recrea en cada bundle (2D/3D).
   */
  function COPCLayer(parametros, opciones) {
    if (!claseCOPC) instalar();
    if (!claseCOPC) throw new Error('copcLayer: IDEE.layer.COPC no esta instalada');
    return new claseCOPC(parametros, opciones);
  }

  /**
   * Espera a que la extension este instalada.
   * @param {number} [timeout]
   * @returns {Promise<boolean>}
   */
  function cuandoInstalado(timeout) {
    var tope = typeof timeout === 'number' ? timeout : 5000;
    return new Promise(function (resolve) {
      var inicio = Date.now();
      (function comprobar() {
        if (instalar()) return resolve(true);
        if (Date.now() - inicio >= tope) return resolve(false);
        setTimeout(comprobar, 25);
      })();
    });
  }

  /**
   * Crea una capa COPC sin anadirla al mapa.
   * @param {string} url
   * @param {Object} [opts]
   * @returns {Object}
   */
  function crearCapa(url, opts) {
    opts = opts || {};
    instalar();
    var IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.COPC) {
      throw new Error('copcLayer: IDEE.layer.COPC no esta instalada');
    }
    var params = Object.assign({}, opts, { url: url });
    var estilo = params.style;
    delete params.style;
    return new IDEE.layer.COPC(params, estilo ? { style: estilo } : {});
  }

  /**
   * Crea la capa y la anade al mapa.
   * @param {Object} mapa
   * @param {string} url
   * @param {Object} [opts]
   * @returns {Object}
   */
  function anadirCapa(mapa, url, opts) {
    var capa = crearCapa(url, opts);
    if (mapa && typeof mapa.addLayers === 'function') mapa.addLayers(capa);
    return capa;
  }

  // La extension se instala sola; el vendor se queda esperando a que haya 3D.
  instalar();
  setInterval(instalar, 10);

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      var objetivo = e && e.target;
      if (objetivo && objetivo.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(objetivo.src || '')) {
        instalar();
      }
    }, true);
  }

  if (typeof window !== 'undefined') {
    window.copcLayer = {
      version: VERSION,
      urlVendor: URL_VENDOR,
      cargarVendor: cargarVendor,
      crearCapa: crearCapa,
      anadirCapa: anadirCapa,
      instalar: instalar,
      cuandoInstalado: cuandoInstalado,
      clase: function () { return COPCLayer; },
      claseBase: function () { return claseCOPC; },
    };
    window.miCOPC = window.copcLayer;
  }
})();
