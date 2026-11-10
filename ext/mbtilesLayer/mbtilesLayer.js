/* =====================================================================
   ext/mbtilesLayer/mbtilesLayer.js
   ---------------------------------------------------------------------
   Plugin/capa para leer archivos .mbtiles como capas teseladas reales:
   solo se decodifican y pintan las teselas visibles en el zoom actual,
   en lugar de descargar/decodificar el contenedor entero.

   MBTiles es una base SQLite con tabla `tiles (zoom_level, tile_column,
   tile_row, tile_data)` y `metadata (name, value)`. Se lee en el navegador
   con sql.js (cargado desde CDN) y se expone como capa raster teselada:

     - 2D: IDEE.layer.TMS con tileLoadFunction propio.
     - 3D: Cesium.ImageryLayer con un ImageryProvider que pide las teselas
           a la base SQLite en memoria.

   Uso
   ---
     const capa = new IDEE.layer.MBTiles2({
       url: 'datos/ejemplo.mbtiles',
       name: 'MBTiles',
       legend: 'MBTiles de ejemplo'
     });
     mapajs.addLayers(capa);

   (Se registra como IDEE.layer.MBTiles2 y window.mbtilesLayer para no
   colisionar con la capa nativa IDEE.layer.MBTiles, que se mantiene.)
   ===================================================================== */

(function () {
  'use strict';

  function api() { return window.IDEE || window.M || null; }

  const SQLJS_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js';
  const SQLJS_WASM = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm';

  let sqlPromesa = null;
  function cargarSqlJs() {
    if (window.SQL) return Promise.resolve(window.SQL);
    if (sqlPromesa) return sqlPromesa;
    sqlPromesa = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = SQLJS_URL;
      s.async = true;
      s.onload = function () {
        if (!window.initSqlJs) { sqlPromesa = null; reject(new Error('sql.js no expone initSqlJs')); return; }
        window.initSqlJs({ locateFile: function () { return SQLJS_WASM; } })
          .then(function (SQL) { window.SQL = SQL; resolve(SQL); })
          .catch(function (e) { sqlPromesa = null; reject(e); });
      };
      s.onerror = function () { sqlPromesa = null; reject(new Error('No se pudo cargar sql.js')); };
      (document.head || document.documentElement).appendChild(s);
    });
    return sqlPromesa;
  }

  async function descargar(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('MBTiles: error HTTP ' + res.status);
    return res.arrayBuffer();
  }

  function abrirBase(buffer) {
    return cargarSqlJs().then(function (SQL) {
      return new SQL.Database(new Uint8Array(buffer));
    });
  }

  function metadata(db) {
    const out = {};
    try {
      const stmt = db.prepare('SELECT name, value FROM metadata');
      while (stmt.step()) {
        const r = stmt.getAsObject();
        out[r.name] = r.value;
      }
      stmt.free();
    } catch (e) { /* sin metadata */ }
    return out;
  }

  function leerTesela(db, z, x, y) {
    // MBTiles usa TMS: tile_row = (2^z - 1) - y
    const tmsY = (1 << z) - 1 - y;
    try {
      const stmt = db.prepare('SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?');
      stmt.bind([z, x, tmsY]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row.tile_data || null;
      }
      stmt.free();
    } catch (e) { /* noop */ }
    return null;
  }

  function crearCapa(opciones) {
    const o = opciones || {};
    const IDEE = api();
    const url = o.url;
    const name = o.name || 'MBTiles';
    const legend = o.legend || name;

    // Estado de visibilidad y opacidad. Se guarda aparte porque la capa puede
    // recibir `setVisible`/`setOpacity` del selector ANTES de que la escena
    // exista (el .mbtiles se descarga y se abre de forma asíncrona), y porque
    // en 3D quien pinta es una ImageryLayer propia, no el impl de la API.
    let opacidad = 1;
    if (o.opacity !== undefined) {
      const n = Number(o.opacity);
      opacidad = isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
    }
    let visible = o.visible !== false;

    // Capa base TMS de la API (raster).
    const capa = new IDEE.layer.TMS({
      url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      name: name,
      legend: legend,
      opacity: opacidad,
      visible: visible
    });

    let db = null;
    let meta = {};
    let formato = 'png';

    // Escena y capa de imágenes de Cesium, cuando existan.
    let escena3D = null;
    let capaImagen3D = null;

    async function asegurarBase() {
      if (db) return db;
      const buffer = await descargar(url);
      db = await abrirBase(buffer);
      meta = metadata(db);
      if (meta.format) formato = meta.format;
      return db;
    }

    // 2D: sustituir la fuente del ol.layer.Tile por una con tileLoadFunction propio.
    function configurar2D() {
      try {
        const impl = capa.getImpl();
        const olLayer = (impl && impl.olLayer) ? impl.olLayer : (capa.olLayer || impl);
        if (!olLayer || typeof olLayer.getSource !== 'function') return;
        const src = olLayer.getSource();
        if (!src || typeof src.setTileLoadFunction !== 'function') return;
        src.setTileLoadFunction(function (tile, tileSrc) {
          const z = tile.getTileCoord()[0];
          const x = tile.getTileCoord()[1];
          const y = tile.getTileCoord()[2];
          asegurarBase().then(function (base) {
            const data = leerTesela(base, z, x, y);
            if (!data) { tile.setState(3); return; } // 3 = ERROR
            const blob = new Blob([data], { type: 'image/' + formato });
            const objUrl = URL.createObjectURL(blob);
            tile.getImage().src = objUrl;
            tile.getImage().onload = function () { URL.revokeObjectURL(objUrl); };
          }).catch(function (e) {
            console.warn('MBTiles: error cargando tesela', e);
            tile.setState(3);
          });
        });
      } catch (e) { console.warn('MBTiles: no se pudo configurar 2D', e); }
    }

    // 3D: ImageryProvider personalizado.
    //
    // OJO: esta capa NO pinta con el impl de la API, sino con una capa de
    // imágenes propia. Por eso el `setVisible`/`setOpacity` del impl no la
    // tocan, y hay que llevarlos a `.show` y `.alpha` a mano (ver los envoltorios
    // de más abajo). Si no, el botón de visibilidad y el deslizador de opacidad
    // del selector se mueven y no pasa nada, sin error en consola.
    function configurar3D(escena) {
      try {
        const Cesium = window.Cesium;
        if (!Cesium || !escena) return;
        escena3D = escena;

        // Cesium exige `url` en el provider, pero las teselas se piden a la
        // base SQLite, así que no se usa.
        const customProvider = {
          _ready: false,
          ready: true,
          rectangle: Cesium.Rectangle.MAX_VALUE,
          tileWidth: 256,
          tileHeight: 256,
          maximumLevel: meta.maxzoom ? Number(meta.maxzoom) : 18,
          minimumLevel: meta.minzoom ? Number(meta.minzoom) : 0,
          tilingScheme: new Cesium.WebMercatorTilingScheme(),
          errorEvent: new Cesium.Event(),
          requestImage: function (x, y, level) {
            return asegurarBase().then(function (base) {
              const data = leerTesela(base, level, x, y);
              if (!data) return null;
              const blob = new Blob([data], { type: 'image/' + formato });
              return createImageBitmap(blob);
            });
          }
        };

        quitarCapa3D();
        if (escena.imageryLayers) {
          capaImagen3D = escena.imageryLayers.addImageryProvider(customProvider);
        }
        aplicarEstado3D();
      } catch (e) { console.warn('MBTiles: no se pudo configurar 3D', e); }
    }

    /**
     * Lleva visibilidad y opacidad a la capa de imágenes de Cesium.
     */
    function aplicarEstado3D() {
      if (!capaImagen3D) return;
      capaImagen3D.show = visible;
      capaImagen3D.alpha = opacidad;
      try {
        if (escena3D && typeof escena3D.requestRender === 'function') escena3D.requestRender();
      } catch (e) { /* escena ya destruida */ }
    }

    /**
     * Quita la capa de imágenes del 3D, si la hay.
     */
    function quitarCapa3D() {
      if (capaImagen3D && escena3D && escena3D.imageryLayers) {
        try { escena3D.imageryLayers.remove(capaImagen3D, true); } catch (e) { /* ya fuera */ }
      }
      capaImagen3D = null;
    }

    /**
     * Escena de Cesium del mapa, o null si el mapa es 2D.
     * La API no expone `scene` en el mapa: hay que pedir la implementación.
     * @param {Object} map Mapa de la API.
     * @returns {Object|null}
     */
    function escenaDe(map) {
      try {
        if (map && typeof map.getMapImpl === 'function') {
          const impl = map.getMapImpl();
          if (impl && impl.scene) return impl.scene;
          return null;
        }
        if (map && map.scene) return map.scene;
      } catch (e) { /* sin escena */ }
      return null;
    }

    // Envoltorios de visibilidad y opacidad. Se guarda el original para no
    // romper lo que haga la capa base (en 2D es su capa de teselas quien pinta).
    const setOpacityBase = (typeof capa.setOpacity === 'function') ? capa.setOpacity.bind(capa) : null;
    capa.setOpacity = function (valor) {
      const n = Number(valor);
      opacidad = isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
      if (setOpacityBase) { try { setOpacityBase(opacidad); } catch (e) { /* impl aun sin crear */ } }
      aplicarEstado3D();
    };
    capa.getOpacity = function () { return opacidad; };

    const setVisibleBase = (typeof capa.setVisible === 'function') ? capa.setVisible.bind(capa) : null;
    capa.setVisible = function (valor) {
      visible = valor !== false;
      if (setVisibleBase) { try { setVisibleBase(visible); } catch (e) { /* impl aun sin crear */ } }
      aplicarEstado3D();
    };
    capa.isVisible = function () { return visible; };

    const destroyBase = (typeof capa.destroy === 'function') ? capa.destroy.bind(capa) : null;
    capa.destroy = function () {
      quitarCapa3D();
      if (destroyBase) return destroyBase();
      return undefined;
    };

    // Configurar cuando la capa se añada al mapa.
    const originalAddTo = capa.addTo.bind(capa);
    capa.addTo = function (map) {
      const r = originalAddTo(map);
      setTimeout(function () {
        const escena = escenaDe(map);
        if (escena) configurar3D(escena);
        else configurar2D();
      }, 0);
      return r;
    };

    capa._mbtilesUrl = url;
    capa._mbtilesMeta = function () { return meta; };
    return capa;
  }

  function instalar() {
    const IDEE = api();
    if (!IDEE || !IDEE.layer) return false;
    // Guardar la implementación nativa (si existe) antes de sobrescribirla.
    if (IDEE.layer.MBTiles && !IDEE.layer.MBTilesNative && IDEE.layer.MBTiles !== crearCapa) {
      IDEE.layer.MBTilesNative = IDEE.layer.MBTiles;
    }
    const factory = function (o, lo) { return crearCapa(Object.assign({}, o || {}, lo || {})); };
    // Sobrescribir la capa nativa para que todos los visualizadores usen la
    // versión teselada sin cambiar su código.
    IDEE.layer.MBTiles = factory;
    IDEE.layer.MBTiles2 = factory;
    IDEE.layer.MBTilesTiled = factory;
    if (window.IDEE && window.IDEE.layer) {
      window.IDEE.layer.MBTiles = factory;
      window.IDEE.layer.MBTiles2 = factory;
      window.IDEE.layer.MBTilesTiled = factory;
      if (!window.IDEE.layer.MBTilesNative && IDEE.layer.MBTilesNative) window.IDEE.layer.MBTilesNative = IDEE.layer.MBTilesNative;
    }
    if (window.M && window.M.layer) {
      window.M.layer.MBTiles = factory;
      window.M.layer.MBTiles2 = factory;
      window.M.layer.MBTilesTiled = factory;
      if (!window.M.layer.MBTilesNative && IDEE.layer.MBTilesNative) window.M.layer.MBTilesNative = IDEE.layer.MBTilesNative;
    }
    if (!window.mbtilesLayer) window.mbtilesLayer = {};
    window.mbtilesLayer.crear = crearCapa;
    if (typeof window !== 'undefined') {
      window.miPlugin_mbtilesLayer = factory;
      window.IDEE = window.IDEE || {};
      window.IDEE.plugin = window.IDEE.plugin || {};
      window.IDEE.plugin.miPlugin_mbtilesLayer = factory;
      window.M = window.M || {};
      window.M.plugin = window.M.plugin || {};
      window.M.plugin.miPlugin_mbtilesLayer = factory;
    }
    return true;
  }

  instalar();
  let reintentos = 0;
  const vigilante = setInterval(function () {
    reintentos += 1;
    if (instalar() || reintentos >= 100) { try { clearInterval(vigilante); } catch (e) {} }
  }, 50);
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      const obj = e && e.target;
      if (obj && obj.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(obj.src || '')) instalar();
    }, true);
  }
})();
