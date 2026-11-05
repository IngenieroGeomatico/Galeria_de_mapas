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

    // Capa base TMS de la API (raster).
    const capa = new IDEE.layer.TMS({
      url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      name: name,
      legend: legend
    });

    let db = null;
    let meta = {};
    let formato = 'png';

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
    function configurar3D() {
      try {
        const Cesium = window.Cesium;
        if (!Cesium) return;
        const impl = capa.getImpl();
        if (!impl) return;
        // Reemplazar el ImageryLayer si existe.
        const provider = new Cesium.UrlTemplateImageryProvider({ url: '' });
        // Cesium exige url; usamos un provider custom mínimo.
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
        if (impl.imageryLayer && typeof impl.imageryLayer.destroy === 'function') {
          try { impl.imageryLayer.destroy(); } catch (e) { /* noop */ }
        }
        if (impl.map && impl.map.scene && typeof impl.map.scene.imageryLayers !== 'undefined') {
          impl.imageryLayer = impl.map.scene.imageryLayers.addImageryProvider(customProvider);
        }
      } catch (e) { console.warn('MBTiles: no se pudo configurar 3D', e); }
    }

    // Configurar cuando la capa se añada al mapa.
    const originalAddTo = capa.addTo.bind(capa);
    capa.addTo = function (map) {
      const r = originalAddTo(map);
      setTimeout(function () {
        if (window.Cesium && map && map.scene) configurar3D();
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
    if (!IDEE.layer.MBTiles2) {
      IDEE.layer.MBTiles2 = function (o, lo) { return crearCapa(Object.assign({}, o || {}, lo || {})); };
    }
    IDEE.layer.MBTilesTiled = IDEE.layer.MBTiles2;
    if (window.IDEE && window.IDEE.layer) { window.IDEE.layer.MBTiles2 = IDEE.layer.MBTiles2; window.IDEE.layer.MBTilesTiled = IDEE.layer.MBTiles2; }
    if (window.M && window.M.layer) { window.M.layer.MBTiles2 = IDEE.layer.MBTiles2; window.M.layer.MBTilesTiled = IDEE.layer.MBTiles2; }
    if (!window.mbtilesLayer) window.mbtilesLayer = {};
    window.mbtilesLayer.crear = crearCapa;
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
