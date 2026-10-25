/*
 * pmtilesLayer: capa nativa IDEE.layer.PMTiles (2D y 3D).
 *
 * QUE HACE
 *
 *   new IDEE.layer.PMTiles({ url, type, name, legend, layers, maxZoom }, { style })
 *
 * PMTiles es un formato de teselas en un unico fichero que se lee por HTTP
 * Range: no hay servidor de teselas, el navegador pide el directorio y luego
 * solo las teselas visibles. Esta extension envuelve las capas nativas de la
 * API para que el visualizador no tenga que saber nada de PMTiles:
 *
 *   - type: 'vector'  -> IDEE.layer.MVT (solo 2D).
 *       La fuente MVT de la API se queda, pero su `tileLoadFunction` se
 *       sustituye por `pmtiles.getZxy(z, x, y)`. El formato MVT de la API
 *       (con su filtro `layers`) parsea los bytes y el estilo de siempre
 *       pinta las features.
 *   - type: 'raster'  -> IDEE.layer.TMS.
 *       2D: se cambia la fuente del `ol.layer.Tile` por un `ol.source.TileImage`
 *       con `tileLoadFunction` propio.
 *       3D: se cambia el `Cesium.ImageryLayer` del impl por uno con un
 *       `ImageryProvider` que pide las imagenes a `pmtiles.getZxy`.
 *
 * USO
 *
 *   const capa = new IDEE.layer.PMTiles({
 *     url: 'datos/Madrid_barrios.pmtiles',
 *     type: 'vector',              // 'vector' | 'raster'
 *     layers: 'barrios',           // nombre de la capa MVT (solo vector)
 *     name: 'Barrios',
 *     legend: 'Barrios de Madrid (PMTiles)',
 *     minZoom: 0,
 *     maxZoom: 14,
 *   }, { style: estilo });
 *   mapajs.addLayers(capa);
 *
 * Los ayudantes `window.pmtilesLayer` y `window.miPMTiles` quedan expuestos
 * para crear capas desde la consola.
 *
 * CAMBIO 2D/3D
 *
 * El cambio recarga el bundle de la API y cambia `IDEE.layer.MVT`/`TMS`.
 * La extension se reinstala sola (setInterval + evento load del bundle) y
 * cada capa se recrea al ejecutarse mapa(). Las capas de teselas no necesitan
 * contrato getState/setState: su visibilidad y opacidad las transferidas el
 * selector de capas por legend/name.
 *
 * NOTA SOBRE VECTOR EN 3D
 *
 * `IDEE.layer.MVT` en 3D es la fachada de ext/MVTLayer, que conserva la capa
 * pero no pinta teselas. Por eso el visor de ejemplo anade la capa vectorial
 * solo en 2D y deja la raster para los dos modos. La extension no impide
 * crearla en 3D (si la fachada existe), simplemente no dibuja.
 */
(function () {
  'use strict';

  const VERSION = '1.0.0';

  /**
   * URL de este mismo script.
   * @returns {string}
   */
  function urlDeEsteScript() {
    try {
      if (document.currentScript && document.currentScript.src) return document.currentScript.src;
    } catch (e) { /* sin currentScript */ }
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const src = scripts[i].src || '';
        if (/pmtilesLayer\.js(\?|$)/.test(src)) return src;
      }
    } catch (e) { /* sin DOM */ }
    return '';
  }

  /**
   * URL del UMD de pmtiles, hermana de este script.
   * @type {string}
   */
  const URL_VENDOR = (function () {
    const propio = urlDeEsteScript();
    if (propio) {
      try {
        return new URL('pmtiles.min.js', propio).href;
      } catch (e) { /* sigue abajo */ }
    }
    return 'pmtiles.min.js';
  })();

  /**
   * API activa. El cambio 2D/3D reemplaza window.IDEE: se consulta cada vez.
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
   * Carga `pmtiles.min.js` una sola vez.
   * @returns {Promise<Object>}
   */
  function cargarVendor() {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('PMTiles: sin ventana donde cargar el lector'));
    }
    if (window.pmtiles && typeof window.pmtiles.PMTiles === 'function') {
      return Promise.resolve(window.pmtiles);
    }
    if (promesaVendor) return promesaVendor;

    promesaVendor = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = URL_VENDOR;
      script.async = true;
      script.onload = function () {
        if (window.pmtiles && typeof window.pmtiles.PMTiles === 'function') {
          resolve(window.pmtiles);
        } else {
          promesaVendor = null;
          reject(new Error('PMTiles: el lector no expone window.pmtiles'));
        }
      };
      script.onerror = function () {
        promesaVendor = null;
        reject(new Error('PMTiles: no se pudo cargar ' + URL_VENDOR));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return promesaVendor;
  }

  // ---------- Ayudantes ----------

  /**
   * Normaliza los parametros del constructor: admite una URL suelta o un
   * objeto.
   * @param {string|Object} t
   * @param {Object} [e]
   * @returns {Object}
   */
  function normalizarParams(t) {
    if (typeof t === 'string') return { url: t };
    return Object.assign({}, t || {});
  }

  /**
   * MIME de una tesela segun `header.tileType` de PMTiles.
   * @param {number} tipo
   * @returns {string}
   */
  function mimeDeTileType(tipo) {
    const TT = (window.pmtiles && window.pmtiles.TileType) || {};
    if (tipo === TT.Mvt || tipo === 1) return 'application/x-protobuf';
    if (tipo === TT.Png || tipo === 2) return 'image/png';
    if (tipo === TT.Jpeg || tipo === 3) return 'image/jpeg';
    if (tipo === TT.Webp || tipo === 4) return 'image/webp';
    if (tipo === TT.Avif || tipo === 5) return 'image/avif';
    return 'application/octet-stream';
  }

  /**
   * Convierte un blob de imagen en un HTMLImageElement. Es el tipo que
   * entienden igual OpenLayers y Cesium, sin depender de createImageBitmap.
   * @param {Blob} blob
   * @returns {Promise<HTMLImageElement>}
   */
  function imagenDesdeBlob(blob) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('PMTiles: no se pudo decodificar la imagen'));
      };
      img.src = url;
    });
  }

  /**
   * Promesa con el lector y el header de un fichero PMTiles. Cada capa
   * conserva su PMTiles y su header.
   * @param {Object} capa Instancia PMTilesVector/PMTilesRaster.
   * @returns {Promise<{pm:Object, pmt:Object, header:Object}>}
   */
  function prepararPMTiles(capa) {
    if (capa._pmtilesPreparado) return capa._pmtilesPreparado;
    const url = capa._pmtilesUrl;

    capa._pmtilesPreparado = cargarVendor().then(function (pm) {
      const pmt = new pm.PMTiles(url);
      return pmt.getHeader().then(function (header) {
        capa._pmtilesObj = pmt;
        capa._pmtilesHeader = header;
        if (header && header.maxZoom !== undefined) capa._pmtilesMaxZoom = header.maxZoom;
        if (header && header.minZoom !== undefined) capa._pmtilesMinZoom = header.minZoom;
        return { pm: pm, pmt: pmt, header: header };
      });
    });

    capa._pmtilesPreparado.catch(function () {
      capa._pmtilesPreparado = null;
    });
    return capa._pmtilesPreparado;
  }

  // ---------- Capas ----------

  let claseVector = null;
  let claseRaster = null;
  let baseVector = null;
  let baseRaster = null;

  /**
   * Crea la clase vectorial para el bundle actual.
   * @param {Object} IDEE API activa.
   * @returns {Function|null}
   */
  function crearClaseVector(IDEE) {
    if (!IDEE || !IDEE.layer || typeof IDEE.layer.MVT !== 'function') return null;

    const PMTilesVector = class PMTilesVector extends IDEE.layer.MVT {
      constructor(t, e, i) {
        const params = normalizarParams(t);
        const url = params.url || params._pmtilesUrl || null;
        if (!url) throw new Error('PMTiles: falta el parametro url');

        // El MVT de la API necesita `url` y crea una fuente con plantilla
        // `{z}/{x}/{y}`; en `addTo` se sustituye su tileLoadFunction. El
        // `url` real es el .pmtiles (no hay servidor de teselas).
        //
        // `type` es nuestro ('vector'/'raster'), no un tipo de capa de la API:
        // los constructores nativos lo validan y lanzarian "No se reconoce el
        // tipo de capa vector". Se quita antes de llamar a super.
        const paramsNativos = Object.assign({}, params);
        delete paramsNativos.type;
        super(paramsNativos, e || {}, i || {});

        this._pmtiles = true;
        this._pmtilesTipo = 'vector';
        this._pmtilesUrl = url;
        this._pmtilesMinZoom = (params.minZoom !== undefined) ? Number(params.minZoom) : 0;
        this._pmtilesMaxZoom = (params.maxZoom !== undefined) ? Number(params.maxZoom) : 22;
        this._pmtilesObj = null;
        this._pmtilesHeader = null;
        this._pmtilesPreparado = null;
        this._pmtilesTileLoad = null;
        this._pmtilesSource = null;
        this._pmtilesInicializado = false;
      }

      /**
       * `map.addLayers()` llama a `setMap()` en la fachada antes de anadir el
       * impl; `addTo()` de la fachada no se invoca desde el mapa. Se usa
       * `setMap()` para disparar el enganche a la fuente MVT.
       * @param {Object} map Mapa de la API-IDEE.
       */
      setMap(map) {
        const nuevo = map !== this.map_;
        super.setMap(map);
        if (!nuevo || !map) return;
        const self = this;
        // Se difiere un turno para que el impl ya este creado y en el mapa.
        setTimeout(function () { self._pmtilesIniciar(map); }, 0);
      }

      addTo(map, e) {
        super.addTo(map, e);
        this._pmtilesIniciar(map);
      }

      /**
       * Engancha pmtiles a la fuente MVT de la API.
       * @param {Object} map Mapa de la API-IDEE.
       */
      _pmtilesIniciar(map) {
        if (this._pmtilesInicializado) return;
        // La fachada MVT de Cesium conserva la capa pero no pinta teselas
        // vectoriales. Se deja marcada para no reintentar en bucle.
        let mapaImpl = null;
        try { mapaImpl = (map && typeof map.getMapImpl === 'function') ? map.getMapImpl() : null; } catch (ex) { mapaImpl = null; }
        if (mapaImpl && mapaImpl.scene && mapaImpl.scene.camera) {
          this._pmtilesInicializado = true;
          return;
        }
        let impl = null;
        try { impl = this.getImpl(); } catch (ex) { impl = null; }
        if (!impl) {
          // El impl puede tardar un turno mas en el cambio 2D/3D.
          const self = this;
          setTimeout(function () { self._pmtilesIniciar(map); }, 50);
          return;
        }

        const source = impl.olLayer && impl.olLayer.getSource ? impl.olLayer.getSource() : null;
        this._pmtilesSource = source;
        if (!source) return;
        this._pmtilesInicializado = true;

        // La fuente MVT trae una tileUrlFunction que construiria URLs
        // `.../{z}/{x}/{y}.pbf`. La carga real la hace el tileLoadFunction,
        // pero OpenLayers usa la URL como clave de cache de teselas: tiene
        // que ser distinta para cada (z, x, y) o todas colisionan y solo se
        // carga una.
        try {
          if (typeof source.setTileUrlFunction === 'function') {
            source.setTileUrlFunction(function (tileCoord) {
              if (!tileCoord) return 'pmtiles';
              return 'pmtiles://' + tileCoord[0] + '/' + tileCoord[1] + '/' + tileCoord[2];
            });
          }
        } catch (ex) { /* noop */ }

        const self = this;
        const preparado = prepararPMTiles(this);

        this._pmtilesTileLoad = function (tile, src) {
          // OpenLayers entrega la extension y la proyeccion en el callback de
          // setLoader (no hay tile.getExtent()/getProjection() en esta build).
          // Es el mismo enganche que usa el impl MVT de la API.
          tile.setLoader(function (extent, resolution, projection) {
            let coord = null;
            try { coord = tile.getTileCoord(); } catch (ex) { coord = null; }
            if (!coord) {
              tile.setFeatures([]);
              tile.setState(2);
              return;
            }
            const z = coord[0];
            const x = coord[1];
            const y = coord[2];

            preparado.then(function (prep) {
              return prep.pmt.getZxy(z, x, y).then(function (res) {
                if (!res || !res.data) {
                  tile.setFeatures([]);
                  tile.setState(2);
                  return;
                }
                // El formato MVT (con el filtro `layers`) esta en la propia
                // tesela (`format_`), no en la fuente: source.getFormat()
                // devuelve null en esta build.
                let formato = null;
                try { formato = tile.format_ || null; } catch (ex) { formato = null; }
                if (!formato) {
                  try { formato = source.getFormat ? source.getFormat() : null; } catch (ex) { formato = null; }
                }
                if (!formato) {
                  tile.setFeatures([]);
                  tile.setState(2);
                  return;
                }
                let features = [];
                try {
                  features = formato.readFeatures(res.data, {
                    extent: extent,
                    featureProjection: projection,
                  }) || [];
                } catch (ex) {
                  console.warn('PMTiles: no se pudo leer la tesela MVT', z, x, y, ex);
                  tile.setFeatures([]);
                  tile.setState(3);
                  return;
                }
                tile.setFeatures(features);
                tile.setState(2);
              });
            }).catch(function (err) {
              console.warn('PMTiles vector:', err);
              tile.setFeatures([]);
              tile.setState(3);
            });
          });
        };

        try {
          if (typeof this.setTileLoadFunction === 'function') {
            this.setTileLoadFunction(this._pmtilesTileLoad);
          } else if (typeof source.setTileLoadFunction === 'function') {
            source.setTileLoadFunction(this._pmtilesTileLoad);
          }
        } catch (ex) {
          console.warn('PMTiles: no se pudo enganchar la carga de teselas', ex);
        }
      }

      destroy() {
        this._pmtilesPreparado = null;
        this._pmtilesObj = null;
        if (typeof super.destroy === 'function') super.destroy();
      }
    };

    return PMTilesVector;
  }

  /**
   * Crea la clase raster para el bundle actual.
   * @param {Object} IDEE API activa.
   * @returns {Function|null}
   */
  function crearClaseRaster(IDEE) {
    if (!IDEE || !IDEE.layer || typeof IDEE.layer.TMS !== 'function') return null;

    const PMTilesRaster = class PMTilesRaster extends IDEE.layer.TMS {
      constructor(t, e, i) {
        const params = normalizarParams(t);
        const url = params.url || params._pmtilesUrl || null;
        if (!url) throw new Error('PMTiles: falta el parametro url');

        // `type` es nuestro ('vector'/'raster'), no un tipo de capa de la API:
        // el constructor nativo lo valida y lanzaria "No se reconoce el tipo
        // de capa raster". Se quita antes de llamar a super.
        const paramsNativos = Object.assign({}, params);
        delete paramsNativos.type;
        super(paramsNativos, e || {}, i || {});

        this._pmtiles = true;
        this._pmtilesTipo = 'raster';
        this._pmtilesUrl = url;
        this._pmtilesMinZoom = (params.minZoom !== undefined) ? Number(params.minZoom) : 0;
        this._pmtilesMaxZoom = (params.maxZoom !== undefined) ? Number(params.maxZoom) : 22;
        this._pmtilesObj = null;
        this._pmtilesHeader = null;
        this._pmtilesPreparado = null;
        this._pmtilesCesium = null;
        this._pmtilesOLSource = null;
        this._pmtilesVisible = (typeof params.visible === 'boolean') ? params.visible : true;
        this._pmtilesAlpha = (params.opacity !== undefined && isFinite(Number(params.opacity)))
          ? Number(params.opacity) : 1;
        this._pmtilesInicializado = false;
      }

      /**
       * `map.addLayers()` llama a `setMap()` en la fachada antes de anadir el
       * impl; `addTo()` de la fachada no se invoca desde el mapa. Se usa
       * `setMap()` para cambiar la fuente (2D) o el ImageryLayer (3D).
       * @param {Object} map Mapa de la API-IDEE.
       */
      setMap(map) {
        const nuevo = map !== this.map_;
        super.setMap(map);
        if (!nuevo || !map) return;
        const self = this;
        setTimeout(function () { self._pmtilesIniciar(map); }, 0);
      }

      addTo(map, e) {
        super.addTo(map, e);
        this._pmtilesIniciar(map);
      }

      /**
       * Elige la implementacion y sustituye la fuente del TMS nativo.
       * @param {Object} map
       */
      _pmtilesIniciar(map) {
        if (this._pmtilesInicializado) return;
        let impl = null;
        try { impl = this.getImpl(); } catch (ex) { impl = null; }
        if (!impl) {
          const self = this;
          setTimeout(function () { self._pmtilesIniciar(map); }, 50);
          return;
        }
        this._pmtilesInicializado = true;

        const mapaImpl = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null;
        const esCesium = !!(mapaImpl && mapaImpl.scene && mapaImpl.scene.camera);

        if (esCesium) {
          // El TMS de la API ya creo un ImageryLayer con `pmtiles://...` como
          // plantilla. Se retira ya (no es una URL de teselas) y se pone el
          // nuestro en cuanto el header y el proveedor esten listos.
          try {
            if (impl.cesiumLayer && mapaImpl.imageryLayers) {
              mapaImpl.imageryLayers.remove(impl.cesiumLayer, false);
            }
          } catch (ex) { /* noop */ }
          impl.cesiumLayer = null;
          this._pmtilesIniciarCesium(map, impl);
        } else {
          this._pmtilesIniciarOL(map, impl);
        }
      }

      /**
       * Sustituye la fuente del ol.layer.Tile del TMS por una TileImage que
       * pide las teselas a PMTiles.
       * @param {Object} map
       * @param {Object} impl
       */
      _pmtilesIniciarOL(map, impl) {
        const ol = window.ol;
        if (!ol || !ol.source || !ol.source.TileImage || !ol.tilegrid) {
          console.warn('PMTiles: OpenLayers no expone TileImage/tilegrid');
          return;
        }
        if (!impl.olLayer || typeof impl.olLayer.setSource !== 'function') {
          console.warn('PMTiles: la capa TMS no tiene olLayer.setSource');
          return;
        }

        const self = this;
        const preparado = prepararPMTiles(this);
        const tileGrid = ol.tilegrid.createXYZ({
          minZoom: isFinite(this._pmtilesMinZoom) ? this._pmtilesMinZoom : 0,
          maxZoom: isFinite(this._pmtilesMaxZoom) ? this._pmtilesMaxZoom : 22,
          tileSize: 256,
        });

        const source = new ol.source.TileImage({
          projection: 'EPSG:3857',
          tileGrid: tileGrid,
          wrapX: false,
          tileUrlFunction: function (tileCoord) {
            if (!tileCoord) return 'pmtiles';
            return 'pmtiles://' + tileCoord[0] + '/' + tileCoord[1] + '/' + tileCoord[2];
          },
          tileLoadFunction: function (tile, src) {
            let coord = null;
            try { coord = tile.getTileCoord(); } catch (ex) { coord = null; }
            if (!coord) {
              tile.setState(2); // EMPTY
              return;
            }
            const z = coord[0];
            const x = coord[1];
            const y = coord[2];

            preparado.then(function (prep) {
              return prep.pmt.getZxy(z, x, y).then(function (res) {
                if (!res || !res.data) {
                  tile.setState(2); // EMPTY
                  return;
                }
                const mime = mimeDeTileType(prep.header ? prep.header.tileType : 0);
                const blob = new Blob([res.data], { type: mime });
                const url = URL.createObjectURL(blob);
                const img = tile.getImage();
                img.onload = function () { URL.revokeObjectURL(url); };
                img.onerror = function () {
                  URL.revokeObjectURL(url);
                  tile.setState(3); // ERROR
                };
                img.src = url;
              });
            }).catch(function (err) {
              console.warn('PMTiles raster:', err);
              tile.setState(3); // ERROR
            });
          },
        });

        impl.olLayer.setSource(source);
        this._pmtilesOLSource = source;
      }

      /**
       * Sustituye el ImageryLayer del TMS por uno con un ImageryProvider que
       * pide las imagenes a PMTiles.
       * @param {Object} map
       * @param {Object} impl
       */
      _pmtilesIniciarCesium(map, impl) {
        const Cesium = window.Cesium;
        if (!Cesium || !Cesium.ImageryLayer || !Cesium.WebMercatorTilingScheme) {
          console.warn('PMTiles: Cesium no expone ImageryLayer/WebMercatorTilingScheme');
          return;
        }
        const self = this;
        const preparado = prepararPMTiles(this);

        preparado.then(function (prep) {
          const header = prep.header || {};
          const viewer = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null;
          if (!viewer || !viewer.imageryLayers) return;

          const rectangle = Cesium.Rectangle.fromDegrees(
            Number(header.minLon),
            Number(header.minLat),
            Number(header.maxLon),
            Number(header.maxLat)
          );
          const tilingScheme = new Cesium.WebMercatorTilingScheme();
          const mime = mimeDeTileType(header.tileType);
          const minLevel = (header.minZoom !== undefined) ? header.minZoom : 0;
          const maxLevel = (header.maxZoom !== undefined) ? header.maxZoom : 22;

          const provider = {
            ready: true,
            readyPromise: Promise.resolve(true),
            rectangle: rectangle,
            tileWidth: 256,
            tileHeight: 256,
            minimumLevel: minLevel,
            maximumLevel: maxLevel,
            tilingScheme: tilingScheme,
            errorEvent: new Cesium.Event(),
            credit: undefined,
            hasAlphaChannel: true,
            // `this` no es fiable: Cesium puede llamar al proveedor desde la
            // capa. Los niveles se capturan en el cierre.
            requestImage: function (x, y, level) {
              if (level < minLevel || level > maxLevel) {
                return Promise.resolve(undefined);
              }
              return prep.pmt.getZxy(level, x, y).then(function (res) {
                if (!res || !res.data) return undefined;
                return imagenDesdeBlob(new Blob([res.data], { type: mime }));
              });
            },
          };

          const capaCesium = new Cesium.ImageryLayer(provider, {
            alpha: self._pmtilesAlpha,
            show: self._pmtilesVisible,
            rectangle: rectangle,
          });

          let indice = -1;
          try { indice = viewer.imageryLayers.indexOf(impl.cesiumLayer); } catch (ex) { indice = -1; }
          if (indice >= 0) viewer.imageryLayers.add(capaCesium, indice);
          else viewer.imageryLayers.add(capaCesium);

          impl.cesiumLayer = capaCesium;
          self._pmtilesCesium = capaCesium;
        }).catch(function (err) {
          console.warn('PMTiles raster 3D:', err);
        });
      }

      /**
       * Mantiene sincronizados el estado de la fachada y las dos
       * implementaciones (sobre todo mientras el ImageryLayer propio aun no
       * existe).
       * @param {boolean} visible
       */
      setVisible(visible) {
        this._pmtilesVisible = !!visible;
        try {
          if (typeof super.setVisible === 'function') super.setVisible(this._pmtilesVisible);
        } catch (ex) { /* el impl aun no tiene capa Cesium */ }
        if (this._pmtilesCesium) this._pmtilesCesium.show = this._pmtilesVisible;
      }

      /**
       * @param {number} opacidad
       */
      setOpacity(opacidad) {
        const n = Number(opacidad);
        this._pmtilesAlpha = isFinite(n) ? n : 1;
        try {
          if (typeof super.setOpacity === 'function') super.setOpacity(this._pmtilesAlpha);
        } catch (ex) { /* el impl aun no tiene capa Cesium */ }
        if (this._pmtilesCesium) this._pmtilesCesium.alpha = this._pmtilesAlpha;
      }

      destroy() {
        try {
          const viewer = (this.map_ && typeof this.map_.getMapImpl === 'function')
            ? this.map_.getMapImpl() : null;
          if (viewer && viewer.imageryLayers && this._pmtilesCesium) {
            viewer.imageryLayers.remove(this._pmtilesCesium, false);
          }
        } catch (ex) { /* noop */ }
        this._pmtilesCesium = null;
        this._pmtilesPreparado = null;
        this._pmtilesObj = null;
        if (typeof super.destroy === 'function') super.destroy();
      }
    };

    return PMTilesRaster;
  }

  /**
   * Fabrica que se instala como `IDEE.layer.PMTiles`. Segun `type` devuelve
   * una subclase de MVT (vector) o de TMS (raster).
   * @param {string|Object} t
   * @param {Object} [e]
   * @param {Object} [i]
   * @returns {Object}
   */
  function PMTiles(t, e, i) {
    const params = normalizarParams(t);
    const tipo = String(params.type || 'vector').toLowerCase();
    if (tipo === 'raster' || tipo === 'png' || tipo === 'image' || tipo === 'imagen') {
      if (!claseRaster) throw new Error('PMTiles: IDEE.layer.TMS no esta disponible');
      return new claseRaster(params, e, i);
    }
    if (tipo === 'vector' || tipo === 'mvt' || tipo === 'vectores') {
      if (!claseVector) {
        throw new Error('PMTiles: IDEE.layer.MVT no esta disponible (en 3D hace falta ext/MVTLayer)');
      }
      return new claseVector(params, e, i);
    }
    throw new Error('PMTiles: type debe ser "vector" o "raster"');
  }

  /**
   * Instala (o reinstala) IDEE.layer.PMTiles sobre el bundle activo.
   * @returns {boolean}
   */
  function instalar() {
    const IDEE = api();
    if (!IDEE || !IDEE.layer) return false;

    const mvtActual = IDEE.layer.MVT || null;
    const tmsActual = IDEE.layer.TMS || null;

    // Solo se recrean las clases cuando cambia la base (cambio 2D/3D). Si se
    // recrearan en cada vuelta del setInterval, cada capa nueva quedaria con
    // una clase distinta y el chequeo `yaEsta` nunca seria cierto.
    if (claseVector === null || baseVector !== mvtActual) {
      claseVector = crearClaseVector(IDEE);
      baseVector = mvtActual;
    }
    if (claseRaster === null || baseRaster !== tmsActual) {
      claseRaster = crearClaseRaster(IDEE);
      baseRaster = tmsActual;
    }

    const yaEsta = IDEE.layer.PMTiles === PMTiles;
    if (yaEsta) return true;

    PMTiles.vector = claseVector;
    PMTiles.raster = claseRaster;

    IDEE.layer.PMTiles = PMTiles;
    if (window.IDEE && window.IDEE.layer) window.IDEE.layer.PMTiles = PMTiles;
    if (window.M && window.M.layer) window.M.layer.PMTiles = PMTiles;

    return true;
  }

  /**
   * Espera a que la clase este instalada y el lector cargado.
   * @param {number} [timeout=5000]
   * @returns {Promise<boolean>}
   */
  function cuandoInstalado(timeout) {
    const tope = (typeof timeout === 'number') ? timeout : 5000;
    return new Promise(function (resolve) {
      const inicio = Date.now();
      (function comprobar() {
        if (instalar() && window.pmtiles) return resolve(true);
        if (Date.now() - inicio >= tope) return resolve(false);
        setTimeout(comprobar, 25);
      })();
    });
  }

  // ---------- Ayudantes de carga ----------

  /**
   * Crea una capa PMTiles sin anadirla al mapa.
   * @param {string} url
   * @param {Object} [opts]
   * @returns {Object}
   */
  function crearCapa(url, opts) {
    opts = opts || {};
    instalar();
    const IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.PMTiles) {
      throw new Error('pmtilesLayer: IDEE.layer.PMTiles no esta instalada');
    }
    const params = Object.assign({}, opts, { url: url });
    const estilo = params.style;
    delete params.style;
    const capa = new IDEE.layer.PMTiles(params, estilo ? { style: estilo } : {});
    if (estilo && typeof capa.setStyle === 'function') {
      try { capa.setStyle(estilo); } catch (e) { /* noop */ }
    }
    return capa;
  }

  /**
   * Crea la capa y la anade al mapa.
   * @param {Object} mapa
   * @param {string} url
   * @param {Object} [opts]
   * @returns {Object}
   */
  function anadirCapa(mapa, url, opts) {
    const capa = crearCapa(url, opts);
    if (mapa && typeof mapa.addLayers === 'function') mapa.addLayers(capa);
    return capa;
  }

  // ---------- Arranque ----------

  cargarVendor().catch(function (e) {
    console.warn(e && e.message ? e.message : e);
  });

  instalar();
  // El cambio 2D/3D recarga el bundle y cambia IDEE.layer.MVT/TMS.
  setInterval(instalar, 10);

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
      crearCapa: crearCapa,
      anadirCapa: anadirCapa,
      instalar: instalar,
      cuandoInstalado: cuandoInstalado,
      clase: function () { return PMTiles; },
      claseVector: function () { return claseVector; },
      claseRaster: function () { return claseRaster; },
    };
    window.pmtilesLayer = extension;
    window.miPMTiles = extension;
  }
})();
