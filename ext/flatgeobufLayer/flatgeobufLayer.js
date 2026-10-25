/*
 * flatgeobufLayer: capa nativa IDEE.layer.FlatGeobuf (2D y 3D).
 *
 * QUE HACE
 *
 * Anade al visualizador una capa vectorial cuyo origen es un fichero
 * FlatGeobuf (.fgb). Como el resto de extensiones de capa del repositorio
 * (maplibreLayer, geotiffLayer), ocupa el nombre de una clase de la API:
 *
 *   new IDEE.layer.FlatGeobuf({ url, name, legend, crs }, { style })
 *
 * La clase extiende IDEE.layer.GeoJSON, que es la capa vectorial nativa
 * (ol.layer.Vector en 2D y DataSource en Cesium en 3D), asi que hereda
 * estilo, tabla de atributos, informacion del punto y el cambio 2D/3D. No
 * se "pasa por GeoJSON" a nivel de API: el fichero se deserializa a features
 * porque es lo que cualquier capa vectorial necesita en memoria.
 *
 * TESELADO
 *
 * La capa arranca en modo "La vista": al anadirse al mapa pide solo las
 * features del bbox visible con peticiones HTTP Range (indice espacial del
 * .fgb). El fichero completo solo se descarga cuando se pide el modo
 * "Todas" desde el panel de la capa (lo pinta ext/bboxFeatures). La carga se
 * concentra en `_recargar(modo, map, forzar)`, que es idempotente.
 *
 *    2D: ext/bboxFeatures recalcula el bbox al mover el mapa y llama a
 *        `_recargar('vista', map, false)`.
 *    3D: ademas de bboxFeatures, la propia capa escucha `camera.moveEnd` de
 *        Cesium (con reintento hasta que la escena esta lista).
 *
 * USO
 *
 * En el index.html del visualizador basta un unico script (el lector del
 * formato se descarga solo, en paralelo, desde esta misma carpeta):
 *
 *   <script src="../../../../ext/flatgeobufLayer/flatgeobufLayer.js"></script>
 *
 * En js/mapa.js:
 *
 *   const capa = new IDEE.layer.FlatGeobuf({
 *     url: '../../../../datos/Madrid_barrios.fgb',
 *     name: 'Barrios de Madrid',
 *     legend: 'Barrios de Madrid (FlatGeobuf)',
 *     crs: 'EPSG:3857',   // CRS de las coordenadas del .fgb
 *   }, {
 *     style: new IDEE.style.Generic({ ... }),
 *   });
 *   mapajs.addLayers(capa);   // la carga inicial (bbox de la vista) va en addTo
 *
 * Los ayudantes `window.flatgeobufLayer` y `window.miFlatGeobuf` (alias)
 * exponen `cargar`, `cargarBbox`, `crearCapa` y `anadirCapa` para quien
 * prefiera no construir la clase a mano. `ext/bboxFeatures` usa el alias.
 *
 * INSTALACION
 *
 * `IDEE.layer.FlatGeobuf` se instala al cargar este script y se reinstala
 * cada 10 ms (y al terminar de cargar un bundle de la API) porque el cambio
 * 2D/3D recarga el bundle y la clase base IDEE.layer.GeoJSON es otra. Asi la
 * extension sobrevive al swap sin registrarse como plugin.
 */
(function () {
  'use strict';

  const VERSION = '4.6.1';

  /**
   * URL de este mismo script. `document.currentScript` solo es valido
   * durante la ejecucion del <script>, asi que se resuelve aqui arriba.
   * @returns {string}
   */
  function urlDeEsteScript() {
    try {
      if (document.currentScript && document.currentScript.src) return document.currentScript.src;
    } catch (e) { /* sin currentScript */ }
    // Respaldo: el ultimo <script> cuyo src sea este fichero.
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const src = scripts[i].src || '';
        if (/flatgeobufLayer\.js(\?|$)/.test(src)) return src;
      }
    } catch (e) { /* sin DOM */ }
    return '';
  }

  /**
   * URL del lector vendorizado, hermana de este script.
   * @type {string}
   */
  const URL_VENDOR = (function () {
    const propio = urlDeEsteScript();
    if (propio) {
      try {
        return new URL('flatgeobuf-geojson.min.js', propio).href;
      } catch (e) { /* sigue abajo */ }
    }
    return 'flatgeobuf-geojson.min.js';
  })();

  /**
   * API activa. El cambio 2D/3D reemplaza window.IDEE, por eso se consulta
   * cada vez y no se guarda en una constante.
   * @returns {Object|undefined}
   */
  function api() {
    const IDEE = window.IDEE;
    if (IDEE && IDEE.map) return IDEE;
    const M = window.M;
    if (M && M.map) return M;
    return IDEE || M;
  }

  // ---------- Carga del lector (vendor) ----------

  let promesaVendor = null;

  /**
   * Carga `flatgeobuf-geojson.min.js` una sola vez. Si ya esta en window,
   * devuelve la biblioteca sin tocar el DOM.
   * @returns {Promise<Object>}
   */
  function cargarVendor() {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('FlatGeobuf: sin ventana donde cargar el lector'));
    }
    if (window.flatgeobuf && typeof window.flatgeobuf.deserialize === 'function') {
      return Promise.resolve(window.flatgeobuf);
    }
    if (promesaVendor) return promesaVendor;

    promesaVendor = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = URL_VENDOR;
      script.async = true;
      script.onload = function () {
        if (window.flatgeobuf && typeof window.flatgeobuf.deserialize === 'function') {
          resolve(window.flatgeobuf);
        } else {
          promesaVendor = null;
          reject(new Error('FlatGeobuf: el lector no expone window.flatgeobuf'));
        }
      };
      script.onerror = function () {
        promesaVendor = null;
        reject(new Error('FlatGeobuf: no se pudo cargar ' + URL_VENDOR));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return promesaVendor;
  }

  // ---------- Descarga ----------

  function descargarBytes(url) {
    return fetch(url).then(function (respuesta) {
      if (!respuesta.ok) throw new Error('FlatGeobuf: HTTP ' + respuesta.status + ' al leer ' + url);
      return respuesta.arrayBuffer();
    }).then(function (ab) {
      return new Uint8Array(ab);
    });
  }

  // ---------- Deserializacion ----------

  function deserializar(bytes, fg) {
    const lector = fg || window.flatgeobuf;
    if (!lector || typeof lector.deserialize !== 'function') {
      throw new Error('FlatGeobuf: la libreria flatgeobuf-geojson no esta cargada.');
    }
    const salida = { type: 'FeatureCollection', features: [] };
    const resultado = lector.deserialize(bytes);
    if (resultado && typeof resultado[Symbol.asyncIterator] === 'function') {
      return (async function () {
        for await (const f of resultado) salida.features.push(f);
        return salida;
      })();
    }
    if (resultado && typeof resultado.then === 'function') {
      return resultado.then(function (r) {
        if (r && typeof r[Symbol.asyncIterator] === 'function') {
          return (async function () {
            for await (const f of r) salida.features.push(f);
            return salida;
          })();
        }
        if (Array.isArray(r)) { salida.features = r.slice(); return salida; }
        if (r && Array.isArray(r.features)) { salida.features = r.features.slice(); return salida; }
        return salida;
      });
    }
    if (Array.isArray(resultado)) { salida.features = resultado.slice(); return Promise.resolve(salida); }
    if (resultado && Array.isArray(resultado.features)) { salida.features = resultado.features.slice(); return Promise.resolve(salida); }
    return Promise.resolve(salida);
  }

  // ---------- Deteccion y reproyeccion de CRS ----------

  function reproyectarCoordenada(coord, desde, hasta) {
    if (!Array.isArray(coord)) return coord;
    if (typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
        !Array.isArray(coord[0]) && coord.length <= 4) {
      try {
        const IDEE = api();
        if (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function') {
          const p = IDEE.utils.reproject([coord[0], coord[1]], desde, hasta);
          if (p && isFinite(p[0]) && isFinite(p[1])) {
            const out = [p[0], p[1]];
            if (coord.length > 2) out.push(coord[2]);
            if (coord.length > 3) out.push(coord[3]);
            return out;
          }
        }
      } catch (e) { /* sin reproyeccion */ }
      return coord;
    }
    return coord.map(function (c) { return reproyectarCoordenada(c, desde, hasta); });
  }

  function reproyectarGeometria(geom, desde, hasta) {
    if (!geom || !geom.type || !geom.coordinates) return geom;
    return Object.assign({}, geom, {
      coordinates: reproyectarCoordenada(geom.coordinates, desde, hasta)
    });
  }

  function reproyectarFeature(f, desde, hasta) {
    if (!f) return f;
    const copia = Object.assign({}, f);
    if (f.geometry) copia.geometry = reproyectarGeometria(f.geometry, desde, hasta);
    return copia;
  }

  function reproyectarFC(fc, desde, hasta) {
    if (desde === hasta) return fc;
    const salida = Object.assign({}, fc);
    salida.features = (fc.features || []).map(function (f) {
      return reproyectarFeature(f, desde, hasta);
    });
    return salida;
  }

  // ---------- Carga de features ----------

  /**
   * Descarga el fichero completo y lo devuelve como FeatureCollection.
   * @param {string} url
   * @returns {Promise<Object>}
   */
  function cargar(url) {
    return cargarVendor().then(function (fg) {
      return descargarBytes(url).then(function (bytes) {
        return deserializar(bytes, fg);
      });
    });
  }

  /**
   * Pide al lector solo las features del rectangulo indicado (HTTP Range).
   * Devuelve siempre EPSG:4326, que es lo que espera la capa.
   * @param {string} url
   * @param {{minX:number,minY:number,maxX:number,maxY:number}} rect
   * @param {string} [crsOrigen='EPSG:4326'] CRS del fichero.
   * @returns {Promise<Object>}
   */
  function cargarBbox(url, rect, crsOrigen) {
    const crs = crsOrigen || 'EPSG:4326';
    return cargarVendor().then(function (fg) {
      return (async function () {
        const features = [];
        const it = fg.deserialize(url, { rect: rect });
        for await (const f of it) features.push(f);
        const fc = { type: 'FeatureCollection', features: features };
        return (crs !== 'EPSG:4326') ? reproyectarFC(fc, crs, 'EPSG:4326') : fc;
      })();
    });
  }

  // ---------- Capa nativa IDEE.layer.FlatGeobuf ----------

  let claseInstalada = null;
  let baseInstalada = null;

  /**
   * Crea la clase para el bundle actual. No se cachea entre 2D y 3D porque
   * IDEE.layer.GeoJSON es una clase distinta en cada bundle.
   * @param {Object} IDEE API activa.
   * @returns {Function}
   */
  function crearClase(IDEE) {
    const FlatGeobuf = class FlatGeobuf extends IDEE.layer.GeoJSON {
      constructor(t, e, i) {
        // Acepta tres formas:
        //   new IDEE.layer.FlatGeobuf('fichero.fgb')
        //   new IDEE.layer.FlatGeobuf({ url, name, legend, crs })
        //   new IDEE.layer.FlatGeobuf(featureCollection, { style })
        let params;
        if (typeof t === 'string') {
          params = { url: t };
        } else if (t && (t.type === 'FeatureCollection' || Array.isArray(t.features))) {
          params = Object.assign({}, e || {});
          params.source = t;
        } else {
          params = Object.assign({}, t || {});
        }

        const url = params.url || params._flatgeobufUrl || null;
        if (!params.source) {
          params.source = { type: 'FeatureCollection', features: [] };
        }

        super(params, e || {}, i || {});

        this._flatgeobuf = true;
        this._flatgeobufUrl = url;
        this._flatgeobufCRS = params._flatgeobufCRS || params.crs || null;

        // Estado del teselado por vista.
        this._fgbModo = 'vista';
        this._fgbBbox = null;
        this._fgbCargando = false;
        this._fgbPendiente = null;
        this._fgbInicial = false;
        this._fgbTimer3D = null;
        this._fgbRetryTimer = null;
        this._fgbMoveEnd = null;

        // Solo se auto-carga si hay url y no vienen features ya resueltas.
        const conFeatures = !!(params.source && params.source.features && params.source.features.length);
        this._fgbAutoCarga = !!(url && !conFeatures);
      }

      addTo(t, e) {
        super.addTo(t, e);
        if (!this._fgbAutoCarga || this._fgbInicial) return;
        this._fgbInicial = true;
        const map = t;
        // Primera carga: solo el bbox de la vista (HTTP Range si el servidor
        // lo soporta). Nunca se descarga el fichero completo al arrancar.
        this._recargar('vista', map, false);
        // En 3D el bbox cambia al mover la camara: recargar al terminar.
        this._escucharCamara3D(map);
      }

      destroy() {
        try {
          if (this._fgbTimer3D) clearTimeout(this._fgbTimer3D);
          if (this._fgbRetryTimer) clearTimeout(this._fgbRetryTimer);
        } catch (ex) { /* noop */ }
        this._fgbTimer3D = null;
        this._fgbRetryTimer = null;
        try {
          if (this._fgbMoveEnd && this._fgbMoveEnd.camara && this._fgbMoveEnd.cola) {
            this._fgbMoveEnd.camara.moveEnd.removeEventListener(this._fgbMoveEnd.cola);
          }
        } catch (ex) { /* noop */ }
        this._fgbMoveEnd = null;
        if (typeof super.destroy === 'function') super.destroy();
      }

      /**
       * Solo en 3D (Cesium): al terminar de mover la camara se recalcula el
       * bbox visible y se recarga la capa (si el modo es "la vista").
       * @param {Object} map Mapa de la API.
       */
      _escucharCamara3D(map) {
        if (!map) return;
        const self = this;
        let intentos = 0;
        const intentar = function () {
          intentos += 1;
          let impl = null;
          try { impl = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null; } catch (ex) { impl = null; }
          if (!impl || !impl.scene || !impl.scene.camera || !impl.scene.camera.moveEnd) {
            // En el arranque la escena de Cesium puede no estar lista (o el
            // mapa aun es el de OpenLayers durante el cambio 2D/3D).
            if (intentos < 60) self._fgbRetryTimer = setTimeout(intentar, 500);
            return;
          }
          const camara = impl.scene.camera;
          const cola = function () {
            try {
              if (self._fgbTimer3D) clearTimeout(self._fgbTimer3D);
              self._fgbTimer3D = setTimeout(function () {
                self._recargar(self._fgbModo, map, false);
              }, 300);
            } catch (ex) { /* noop */ }
          };
          try {
            camara.moveEnd.addEventListener(cola);
            self._fgbMoveEnd = { camara: camara, cola: cola };
          } catch (ex) { /* noop */ }
        };
        intentar();
      }

      /**
       * Recarga la capa en el modo pedido. Idempotente: si ya esta cargada
       * justo esa peticion, no hace nada.
       * @param {string} modo 'vista' (bbox visible) o 'todas' (fichero entero).
       * @param {Object} map Mapa de la API (para calcular el bbox).
       * @param {boolean} forzar Si true, recarga aunque el bbox sea el mismo.
       * @returns {Promise}
       */
      _recargar(modo, map, forzar) {
        const self = this;
        const url = this._flatgeobufUrl;
        if (!url) return Promise.resolve();
        modo = (modo === 'todas') ? 'todas' : 'vista';
        const crsFg = this._flatgeobufCRS || 'EPSG:3857';

        let rect = null;
        let clave = '';
        if (modo === 'vista') {
          const vista = this._bboxVista(map, crsFg);
          if (vista) {
            rect = vista.rect;
            clave = vista.clave;
          }
        }

        if (!forzar && this._fgbModo === modo && this._fgbBbox === clave) {
          return Promise.resolve();
        }
        if (this._fgbCargando) {
          // Hay una carga en curso: apuntar el modo pendiente y salir; al
          // terminar la carga en curso se encadena la ultima peticion.
          this._fgbPendiente = { modo: modo, map: map };
          return Promise.resolve();
        }

        this._fgbCargando = true;
        let promesa;
        if (rect) {
          // cargarBbox ya devuelve las features en EPSG:4326.
          promesa = cargarBbox(url, rect, crsFg);
        } else {
          // Modo "todas" (o vista del mundo entero): fichero completo.
          promesa = cargar(url).then(function (fc) {
            return (crsFg && crsFg !== 'EPSG:4326')
              ? reproyectarFC(fc, crsFg, 'EPSG:4326')
              : fc;
          });
        }

        return promesa.then(function (fc) {
          self._flatgeobufCRS = crsFg;
          self._fgbModo = modo;
          self._fgbBbox = clave;
          self._fgbCargando = false;
          try {
            if (typeof self.setSource === 'function') self.setSource(fc);
          } catch (ex) { /* noop */ }
          const pendiente = self._fgbPendiente;
          self._fgbPendiente = null;
          if (pendiente) {
            const modoPend = pendiente.modo;
            const mapPend = pendiente.map;
            setTimeout(function () {
              // `false`: si la carga que acaba de terminar ya dejo el mismo
              // bbox, no se repite (evita peticiones de mas).
              self._recargar(modoPend, mapPend, false);
            }, 0);
          }
          return fc;
        }).catch(function (e) {
          self._fgbCargando = false;
          self._fgbPendiente = null;
          console.warn('FlatGeobuf: recarga', e);
        });
      }

      /**
       * bbox de la vista en la CRS del fichero.
       * @param {Object} map Mapa de la API.
       * @param {string} crsFg CRS del fichero ('EPSG:3857' | 'EPSG:4326').
       * @returns {{rect: Object, clave: string}|null}
       */
      _bboxVista(map, crsFg) {
        if (!map || typeof map.getBbox !== 'function') return null;
        let b = null;
        try { b = map.getBbox(); } catch (ex) { return null; }
        if (!b || !b.x || !b.y) return null;
        const minx = Number(b.x.min);
        const miny = Number(b.y.min);
        const maxx = Number(b.x.max);
        const maxy = Number(b.y.max);
        if (!isFinite(minx) || !isFinite(miny) || !isFinite(maxx) || !isFinite(maxy)) return null;
        if (maxx <= minx || maxy <= miny) return null;

        let proj = {};
        try { proj = map.getProjection() || {}; } catch (ex) { proj = {}; }
        const code = String(proj.code || '');
        const grados = (String(proj.units || '') === 'd') ||
          code === 'EPSG:4326' || code === 'EPSG:4979';

        // Vista del mundo entero: no tiene sentido filtrar.
        if (grados) {
          if ((maxx - minx) >= 359 || (maxy - miny) >= 179) return null;
        } else if ((maxx - minx) >= 40075016.686) {
          return null;
        }

        const aFichero = function (x, y) {
          if (crsFg === 'EPSG:4326') {
            if (grados) return [x, y];
            try {
              const p = api().utils.reproject([x, y], code || 'EPSG:3857', 'EPSG:4326');
              return (p && isFinite(p[0]) && isFinite(p[1])) ? [p[0], p[1]] : null;
            } catch (ex) { return null; }
          }
          // Fichero en 3857.
          if (!grados && code === 'EPSG:3857') return [x, y];
          try {
            const p = api().utils.reproject([x, y], code || 'EPSG:4326', 'EPSG:3857');
            return (p && isFinite(p[0]) && isFinite(p[1])) ? [p[0], p[1]] : null;
          } catch (ex) { return null; }
        };

        const sw = aFichero(minx, miny);
        const ne = aFichero(maxx, maxy);
        if (!sw || !ne) return null;
        return {
          rect: { minX: sw[0], minY: sw[1], maxX: ne[0], maxY: ne[1] },
          clave: [sw[0], sw[1], ne[0], ne[1]].join(',')
        };
      }
    };

    return FlatGeobuf;
  }

  /**
   * Instala (o reinstala) `IDEE.layer.FlatGeobuf` sobre el bundle activo.
   * Es idempotente y no hace nada mientras la API no tenga su clase base.
   * @returns {boolean} Si la clase esta instalada.
   */
  function instalar() {
    const IDEE = api();
    if (!IDEE || !IDEE.layer || typeof IDEE.layer.GeoJSON !== 'function') return false;

    const yaEsta = claseInstalada &&
      baseInstalada === IDEE.layer.GeoJSON &&
      IDEE.layer.FlatGeobuf === claseInstalada;
    if (yaEsta) return true;

    const Clase = crearClase(IDEE);
    claseInstalada = Clase;
    baseInstalada = IDEE.layer.GeoJSON;

    IDEE.layer.FlatGeobuf = Clase;
    if (window.IDEE && window.IDEE.layer) window.IDEE.layer.FlatGeobuf = Clase;
    if (window.M && window.M.layer) window.M.layer.FlatGeobuf = Clase;

    return true;
  }

  /**
   * Espera a que la clase este instalada y el lector cargado.
   * @param {number} [timeout=5000] Tope en milisegundos.
   * @returns {Promise<boolean>}
   */
  function cuandoInstalado(timeout) {
    const tope = (typeof timeout === 'number') ? timeout : 5000;
    return new Promise(function (resolve) {
      const inicio = Date.now();
      (function comprobar() {
        if (instalar() && window.flatgeobuf) return resolve(true);
        if (Date.now() - inicio >= tope) return resolve(false);
        setTimeout(comprobar, 25);
      })();
    });
  }

  // ---------- Ayudantes de carga (compatibles) ----------

  /**
   * Crea una capa FlatGeobuf sin anadirla al mapa.
   * @param {string} url
   * @param {Object} [opts] Opciones de la capa (`name`, `legend`, `style`, `crs`...).
   * @returns {Object} Instancia de IDEE.layer.FlatGeobuf.
   */
  function crearCapa(url, opts) {
    opts = opts || {};
    instalar();
    const IDEE = api();
    const Clase = (IDEE && IDEE.layer && IDEE.layer.FlatGeobuf) || null;
    if (!Clase) throw new Error('flatgeobufLayer: IDEE.layer.FlatGeobuf no esta instalada');

    const params = Object.assign({}, opts, { url: url });
    const estilo = params.style;
    delete params.style;

    const capa = new Clase(params, estilo ? { style: estilo } : {});
    if (estilo && typeof capa.setStyle === 'function') {
      try { capa.setStyle(estilo); } catch (e) { /* noop */ }
    }
    return capa;
  }

  /**
   * Crea la capa y la anade al mapa.
   * @param {Object} mapa Mapa de la API.
   * @param {string} url
   * @param {Object} [opts]
   * @returns {Object} La capa creada.
   */
  function anadirCapa(mapa, url, opts) {
    const capa = crearCapa(url, opts);
    if (mapa && typeof mapa.addLayers === 'function') mapa.addLayers(capa);
    return capa;
  }

  // ---------- Arranque ----------

  // El lector se pide en paralelo nada mas cargar la extension; las cargas de
  // capa esperan a `cargarVendor()`, asi que no hay carrera.
  cargarVendor().catch(function (e) {
    console.warn(e && e.message ? e.message : e);
  });

  instalar();
  // El cambio 2D/3D recarga el bundle y cambia IDEE.layer.GeoJSON: se vigila
  // como hace maplibreLayer para reinstalar la clase en el bundle nuevo.
  setInterval(instalar, 10);

  // Cuando termina de ejecutarse un <script> de la API (swap 2D/3D), se
  // reinstala de inmediato y se recorta la carrera con la re-ejecucion de mapa().
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      const objetivo = e && e.target;
      if (objetivo && objetivo.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(objetivo.src || '')) {
        instalar();
      }
    }, true);
  }

  // ---------- Exposicion ----------

  if (typeof window !== 'undefined') {
    const extension = {
      version: VERSION,
      urlVendor: URL_VENDOR,
      cargarVendor: cargarVendor,
      cargar: cargar,
      cargarBbox: cargarBbox,
      crearCapa: crearCapa,
      anadirCapa: anadirCapa,
      instalar: instalar,
      cuandoInstalado: cuandoInstalado,
      clase: function () { return claseInstalada; }
    };
    window.flatgeobufLayer = extension;
    // Alias que consume ext/bboxFeatures (y las versiones anteriores).
    window.miFlatGeobuf = extension;
  }
})();
