/*
 * geoparquetLayer: capa nativa IDEE.layer.GeoParquet (2D y 3D).
 *
 * QUE HACE
 *
 *   new IDEE.layer.GeoParquet({ url, name, legend, crs }, { style })
 *
 * La clase extiende IDEE.layer.GeoJSON, que es la capa vectorial nativa de la
 * API, asi que en 2D la pinta OpenLayers y en 3D Cesium sin nada especial.
 * Lo propio de esta extension es LEER el .parquet:
 *
 *   - El footer se pide con HTTP Range (solo los ultimos kilobytes).
 *   - Si el GeoParquet trae la columna de cobertura `bbox` (GeoParquet 1.1)
 *     o estadisticas por row group, se eligen SOLO los row groups que caen
 *     en la vista y se piden esos rangos. El resto del fichero no se toca.
 *   - Las geometrias vienen en WKB; hyparquet las decodifica a GeoJSON y, si
 *     no lo hiciera, se decodifican aqui.
 *
 * La recarga por vista esta en `_recargar(modo, map, forzar)`, que es
 * idempotente, igual que en ext/flatgeobufLayer. ext/bboxFeatures la usa para
 * el panel "Todas / La vista":
 *
 *   capa._recargar('vista', map, false);   // solo el bbox visible
 *   capa._recargar('todas', map, false);   // fichero entero
 *
 * USO
 *
 *   const capa = new IDEE.layer.GeoParquet({
 *     url: 'datos/Madrid_barrios.parquet',
 *     name: 'Barrios de Madrid',
 *     legend: 'Barrios de Madrid (GeoParquet)',
 *     crs: 'EPSG:4326',              // opcional: si no, se lee del metadata
 *   }, { style: estilo });
 *   mapajs.addLayers(capa);
 *
 * Los ayudantes `window.geoparquetLayer` y `window.miGeoParquet` quedan
 * expuestos para poder crear la capa desde la consola.
 *
 * CAMBIO 2D/3D
 *
 * El cambio recarga la build de la API y `IDEE.layer.GeoJSON` es otra clase.
 * Por eso la extension se reinstala sola (setInterval + evento load del
 * bundle). Las instancias nuevas se rehidratan al ejecutarse mapa().
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
        if (/geoparquetLayer\.js(\?|$)/.test(src)) return src;
      }
    } catch (e) { /* sin DOM */ }
    return '';
  }

  /**
   * URL del bundle de hyparquet, hermana de este script.
   * @type {string}
   */
  const URL_VENDOR = (function () {
    const propio = urlDeEsteScript();
    if (propio) {
      try {
        return new URL('hyparquet.min.js', propio).href;
      } catch (e) { /* sigue abajo */ }
    }
    return 'hyparquet.min.js';
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

  /**
   * URL del descompresor ZSTD, hermano de este script.
   * @type {string}
   */
  const URL_FZSTD = (function () {
    const propio = urlDeEsteScript();
    if (propio) {
      try { return new URL('fzstd.min.js', propio).href; } catch (e) { /* sigue */ }
    }
    return 'fzstd.min.js';
  })();
  let promesaVendor = null;

  /**
   * Carga `hyparquet.min.js` una sola vez.
   * @returns {Promise<Object>}
   */
  function cargarVendor() {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('GeoParquet: sin ventana donde cargar el lector'));
    }
    if (window.hyparquet && typeof window.hyparquet.parquetMetadataAsync === 'function') {
      return Promise.resolve(window.hyparquet);
    }
    if (promesaVendor) return promesaVendor;

    if (typeof window !== 'undefined' && !window.fzstd) {
      const scriptZstd = document.createElement('script');
      scriptZstd.src = URL_FZSTD;
      scriptZstd.async = false;
      (document.head || document.documentElement).appendChild(scriptZstd);
    }


    promesaVendor = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = URL_VENDOR;
      script.async = true;
      script.onload = function () {
        if (window.hyparquet && typeof window.hyparquet.parquetMetadataAsync === 'function') {
          resolve(window.hyparquet);
        } else {
          promesaVendor = null;
          reject(new Error('GeoParquet: el lector no expone window.hyparquet'));
        }
      };
      script.onerror = function () {
        promesaVendor = null;
        reject(new Error('GeoParquet: no se pudo cargar ' + URL_VENDOR));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return promesaVendor;
  }

  // ---------- Ayudantes de metadatos ----------

  /**
   * Normaliza el CRS que trae el metadata `geo` de GeoParquet.
   * @param {*} crs Valor `crs` de la columna de geometria.
   * @returns {string|null} Codigo tipo 'EPSG:4326', o null si no se sabe.
   */
  function crsDeGeo(crs) {
    if (crs === null || crs === undefined) return 'EPSG:4326';
    if (typeof crs === 'string') {
      if (/CRS84/i.test(crs)) return 'EPSG:4326';
      return crs;
    }
    if (typeof crs !== 'object') return null;

    function deId(id) {
      if (!id) return null;
      let autoridad = id.authority || id.auth_name || id.name;
      let codigo = id.code !== undefined ? id.code : id.id;
      if (!autoridad || codigo === undefined) return null;
      autoridad = String(autoridad).toUpperCase();
      if (autoridad === 'OGC' && String(codigo) === 'CRS84') return 'EPSG:4326';
      return autoridad + ':' + codigo;
    }

    const directo = deId(crs.id);
    if (directo) return directo;
    if (Array.isArray(crs.ids) && crs.ids.length) {
      const primero = deId(crs.ids[0]);
      if (primero) return primero;
    }
    if (crs.name && /WGS\s*84|CRS84/i.test(String(crs.name))) return 'EPSG:4326';
    return null;
  }

  /**
   * Lee el metadata `geo` del fichero.
   * @param {Object} metadata FileMetaData de hyparquet.
   * @returns {Object|null}
   */
  function geoDeMetadata(metadata) {
    try {
      const kv = (metadata && metadata.key_value_metadata) || [];
      for (let i = 0; i < kv.length; i += 1) {
        if (kv[i] && kv[i].key === 'geo' && kv[i].value) return JSON.parse(kv[i].value);
      }
    } catch (e) { /* metadata invalido */ }
    return null;
  }

  /**
   * Nombres de las columnas de primer nivel del esquema, saltando los hijos
   * de los structs (por ejemplo `bbox`).
   * @param {Object} metadata FileMetaData.
   * @returns {string[]}
   */
  function columnasDeMetadata(metadata) {
    const salida = [];
    const schema = (metadata && metadata.schema) || [];
    for (let i = 1; i < schema.length; i += 1) {
      const el = schema[i];
      if (!el || !el.name) continue;
      salida.push(el.name);
      const hijos = Number(el.num_children || 0);
      if (hijos > 0) i += hijos;
    }
    return salida;
  }

  /**
   * Columnas que hay que pedir al lector: geometria y propiedades, sin la
   * columna de cobertura `bbox` ni las columnas internas que empiezan por `_`.
   * @param {Object} metadata FileMetaData.
   * @param {string} primaria Nombre de la columna de geometria.
   * @param {string[]} [pedidas] Lista explicita de propiedades.
   * @param {Object} [covering] Cobertura `bbox` del metadata.
   * @param {Object} [where] Condiciones alfanumericas para asegurar que se lean.
   * @returns {string[]}
   */
  function columnasDeLectura(metadata, primaria, pedidas, covering, where) {
    const todas = columnasDeMetadata(metadata);
    const bboxTop = new Set(['bbox']);
    if (covering) {
      ['xmin', 'ymin', 'xmax', 'ymax'].forEach(function (k) {
        const ruta = covering[k];
        if (Array.isArray(ruta) && ruta.length) bboxTop.add(String(ruta[0]));
      });
    }
    let props = todas.filter(function (n) {
      return n !== primaria && !bboxTop.has(n) && String(n).charAt(0) !== '_';
    });
    if (Array.isArray(pedidas) && pedidas.length) {
      const set = new Set(pedidas.map(String));
      if (where && typeof where === 'object') {
        Object.keys(where).forEach(function (wCol) { set.add(String(wCol)); });
      }
      props = props.filter(function (n) { return set.has(n); });
    }
    return [primaria].concat(props);
  }

  /**
   * Extrae el valor numerico o textual de una estadistica.
   * @param {Object} stat
   * @param {boolean} esMax
   * @returns {*}
   */
  function valorEstadistica(stat, esMax) {
    if (!stat) return undefined;
    if (esMax) {
      return stat.max !== undefined && stat.max !== null ? stat.max : stat.max_value;
    }
    return stat.min !== undefined && stat.min !== null ? stat.min : stat.min_value;
  }

  /**
   * Busca las estadisticas de una columna en un row group.
   * @param {Object} rg Row group.
   * @param {string} nombreColumna
   * @returns {Object|null}
   */
  function estadisticasDeColumna(rg, nombreColumna) {
    if (!rg || !Array.isArray(rg.columns) || !nombreColumna) return null;
    const nombre = String(nombreColumna).toLowerCase();
    for (let i = 0; i < rg.columns.length; i += 1) {
      const col = rg.columns[i] || {};
      const md = col.meta_data || col;
      const path = md.path_in_schema || md.pathInSchema || [];
      if (path.length && String(path[path.length - 1]).toLowerCase() === nombre) {
        return md.statistics || null;
      }
    }
    return null;
  }

  /**
   * Evalua si las estadisticas de un row group permiten descartarlo segun
   * condiciones alfanumericas (pushdown predicate).
   * @param {Object} rg Row group.
   * @param {Object} where Condiciones, ej: { poblacion: { min: 5000 }, provincia: 'Madrid' }
   * @returns {{descartar:boolean, evaluado:boolean}}
   */
  function evaluarEstadisticasRowGroup(rg, where) {
    if (!where || typeof where !== 'object') return { descartar: false, evaluado: false };
    const campos = Object.keys(where);
    let evaluado = false;

    for (let i = 0; i < campos.length; i += 1) {
      const campo = campos[i];
      const condicion = where[campo];
      if (condicion === undefined || condicion === null) continue;

      const stats = estadisticasDeColumna(rg, campo);
      if (!stats) continue;

      const sMin = valorEstadistica(stats, false);
      const sMax = valorEstadistica(stats, true);
      if (sMin === undefined && sMax === undefined) continue;

      evaluado = true;

      // Igualdad simple directa
      if (typeof condicion !== 'object' || condicion instanceof Date) {
        const target = (condicion instanceof Date) ? condicion.toISOString() : condicion;
        if (sMin !== undefined && typeof target === 'number' && Number(target) < Number(sMin)) return { descartar: true, evaluado: true };
        if (sMax !== undefined && typeof target === 'number' && Number(target) > Number(sMax)) return { descartar: true, evaluado: true };
        if (sMin !== undefined && typeof target === 'string' && String(target) < String(sMin)) return { descartar: true, evaluado: true };
        if (sMax !== undefined && typeof target === 'string' && String(target) > String(sMax)) return { descartar: true, evaluado: true };
        continue;
      }

      // Operadores: { $gt, $gte, $lt, $lte, $eq, $in, min, max, gt, gte, lt, lte, eq, in }
      const gt = condicion.$gt !== undefined ? condicion.$gt : condicion.gt;
      const gte = condicion.$gte !== undefined ? condicion.$gte : (condicion.gte !== undefined ? condicion.gte : condicion.min);
      const lt = condicion.$lt !== undefined ? condicion.$lt : condicion.lt;
      const lte = condicion.$lte !== undefined ? condicion.$lte : (condicion.lte !== undefined ? condicion.lte : condicion.max);
      const eq = condicion.$eq !== undefined ? condicion.$eq : condicion.eq;
      const inList = Array.isArray(condicion.$in) ? condicion.$in : (Array.isArray(condicion.in) ? condicion.in : null);

      if (gt !== undefined && sMax !== undefined) {
        if (Number(sMax) <= Number(gt)) return { descartar: true, evaluado: true };
      }
      if (gte !== undefined && sMax !== undefined) {
        if (Number(sMax) < Number(gte)) return { descartar: true, evaluado: true };
      }
      if (lt !== undefined && sMin !== undefined) {
        if (Number(sMin) >= Number(lt)) return { descartar: true, evaluado: true };
      }
      if (lte !== undefined && sMin !== undefined) {
        if (Number(sMin) > Number(lte)) return { descartar: true, evaluado: true };
      }
      if (eq !== undefined) {
        if (sMin !== undefined && Number(eq) < Number(sMin)) return { descartar: true, evaluado: true };
        if (sMax !== undefined && Number(eq) > Number(sMax)) return { descartar: true, evaluado: true };
      }
      if (inList && inList.length) {
        let algunoEntra = false;
        for (let j = 0; j < inList.length; j += 1) {
          const item = inList[j];
          const dentroMin = (sMin === undefined) || (typeof item === 'number' ? Number(item) >= Number(sMin) : String(item) >= String(sMin));
          const dentroMax = (sMax === undefined) || (typeof item === 'number' ? Number(item) <= Number(sMax) : String(item) <= String(sMax));
          if (dentroMin && dentroMax) {
            algunoEntra = true;
            break;
          }
        }
        if (!algunoEntra) return { descartar: true, evaluado: true };
      }
    }

    return { descartar: false, evaluado: evaluado };
  }

  /**
   * Evalua una fila concreta frente al predicado where.
   * @param {Object} props
   * @param {Object} where
   * @returns {boolean}
   */
  function cumplePredicadoFila(props, where) {
    if (!where || typeof where !== 'object') return true;
    const campos = Object.keys(where);
    for (let i = 0; i < campos.length; i += 1) {
      const campo = campos[i];
      const condicion = where[campo];
      if (condicion === undefined || condicion === null) continue;
      const val = props[campo];

      if (typeof condicion !== 'object' || condicion instanceof Date) {
        if (val !== condicion) return false;
        continue;
      }

      const gt = condicion.$gt !== undefined ? condicion.$gt : condicion.gt;
      const gte = condicion.$gte !== undefined ? condicion.$gte : (condicion.gte !== undefined ? condicion.gte : condicion.min);
      const lt = condicion.$lt !== undefined ? condicion.$lt : condicion.lt;
      const lte = condicion.$lte !== undefined ? condicion.$lte : (condicion.lte !== undefined ? condicion.lte : condicion.max);
      const eq = condicion.$eq !== undefined ? condicion.$eq : condicion.eq;
      const inList = Array.isArray(condicion.$in) ? condicion.$in : (Array.isArray(condicion.in) ? condicion.in : null);

      if (gt !== undefined && !(val > gt)) return false;
      if (gte !== undefined && !(val >= gte)) return false;
      if (lt !== undefined && !(val < lt)) return false;
      if (lte !== undefined && !(val <= lte)) return false;
      if (eq !== undefined && val !== eq) return false;
      if (inList && !inList.includes(val)) return false;
    }
    return true;
  }

  /**
   * Busca las estadisticas de una ruta de columna en un row group.
   * @param {Object} rg Row group.
   * @param {string[]} ruta Ruta, por ejemplo ['bbox','xmin'].
   * @returns {Object|null}
   */
  function estadisticasDe(rg, ruta) {
    if (!rg || !Array.isArray(rg.columns) || !Array.isArray(ruta)) return null;
    const clave = ruta.join('.');
    for (let i = 0; i < rg.columns.length; i += 1) {
      const col = rg.columns[i] || {};
      const md = col.meta_data || col;
      const path = md.path_in_schema || md.pathInSchema || [];
      if (path.join('.') === clave) return md.statistics || null;
    }
    return null;
  }

  /**
   * Bbox de un row group a partir de las estadisticas de la columna de
   * cobertura. Es conservador: el minimo de xmin y el maximo de xmax pueden
   * venir de filas distintas, pero el rectangulo contiene al row group.
   * @param {Object} rg Row group.
   * @param {Object} covering Cobertura del metadata.
   * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
   */
  function bboxDeRowGroup(rg, covering) {
    if (!covering) return null;
    const sxmin = estadisticasDe(rg, covering.xmin);
    const symin = estadisticasDe(rg, covering.ymin);
    const sxmax = estadisticasDe(rg, covering.xmax);
    const symax = estadisticasDe(rg, covering.ymax);
    if (!sxmin || !symin || !sxmax || !symax) return null;
    const minX = Number(sxmin.min !== undefined && sxmin.min !== null ? sxmin.min : sxmin.min_value);
    const minY = Number(symin.min !== undefined && symin.min !== null ? symin.min : symin.min_value);
    const maxX = Number(sxmax.max !== undefined && sxmax.max !== null ? sxmax.max : sxmax.max_value);
    const maxY = Number(symax.max !== undefined && symax.max !== null ? symax.max : symax.max_value);
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  /**
   * Precomputa, para cada row group, su rango de filas y su extent espacial
   * a partir de las estadisticas de cobertura (bbox).
   * @param {Object} metadata FileMetaData.
   * @param {Object} covering Cobertura declarada en metadata.
   * @returns {Array<{index:number, rowStart:number, rowEnd:number, extent:{minX:number,minY:number,maxX:number,maxY:number}|null}>}
   */
  function precomputarExtentsRowGroups(metadata, covering) {
    const grupos = (metadata && metadata.row_groups) || [];
    const resultado = [];
    let fila = 0;
    for (let i = 0; i < grupos.length; i += 1) {
      const rg = grupos[i];
      const num = Number(rg && rg.num_rows ? rg.num_rows : 0);
      const bb = covering ? bboxDeRowGroup(rg, covering) : null;
      resultado.push({
        index: i,
        rowStart: fila,
        rowEnd: fila + num,
        extent: bb
      });
      fila += num;
    }
    return resultado;
  }

  /**
   * Row groups que caen en el rectangulo visible y cumplen los predicados
   * alfanumericos.
   * @param {Object} metadata FileMetaData.
   * @param {Array<Object>} extentsPrecomputados Array precalculado de extents de row groups.
   * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect
   * @param {Object} [covering] Cobertura del metadata.
   * @param {Object} [where] Condiciones alfanumericas.
   * @returns {{indices:number[], rangos:Array<{inicio:number,fin:number}>, conStats:boolean}}
   */
  function gruposParaCarga(metadata, extentsPrecomputados, rect, covering, where) {
    const grupos = (metadata && metadata.row_groups) || [];
    const indices = [];
    const rangos = [];
    let conStats = false;
    let abierto = null;

    for (let i = 0; i < grupos.length; i += 1) {
      const rg = grupos[i];
      const infoRg = extentsPrecomputados ? extentsPrecomputados[i] : null;
      const fila = infoRg ? infoRg.rowStart : 0;
      const num = Number(rg && rg.num_rows ? rg.num_rows : 0);
      let entra = true;

      if (rect && covering) {
        const bb = infoRg ? infoRg.extent : bboxDeRowGroup(rg, covering);
        if (bb) {
          conStats = true;
          entra = !(bb.maxX < rect.minX || bb.minX > rect.maxX ||
            bb.maxY < rect.minY || bb.minY > rect.maxY);
        }
      }

      if (entra && where && typeof where === 'object') {
        const evaluacion = evaluarEstadisticasRowGroup(rg, where);
        if (evaluacion.descartar) {
          entra = false;
        }
        if (evaluacion.evaluado) {
          conStats = true;
        }
      }

      if (entra) {
        indices.push(i);
        const rowStart = infoRg ? infoRg.rowStart : fila;
        const rowEnd = infoRg ? infoRg.rowEnd : (fila + num);
        if (abierto && abierto.fin === rowStart) {
          abierto.fin = rowEnd;
        } else {
          abierto = { inicio: rowStart, fin: rowEnd };
          rangos.push(abierto);
        }
      } else {
        abierto = null;
      }
    }

    return { indices: indices, rangos: rangos, conStats: conStats };
  }

  // ---------- Ayudantes espaciales y visibilidad ----------

  function esCapaVisible(capa) {
    if (!capa) return true;
    try {
      const impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
      if (impl) {
        if (typeof impl.isVisible === 'function') return !!impl.isVisible();
        if (typeof impl.getVisible === 'function') return !!impl.getVisible();
        const olLayer = (typeof impl.getLayer === 'function') ? impl.getLayer() : (impl.layer_ || null);
        if (olLayer && typeof olLayer.getVisible === 'function') return !!olLayer.getVisible();
      }
    } catch (e) { /* noop */ }
    if (typeof capa.isVisible === 'function') {
      try { return !!capa.isVisible(); } catch (e) { /* noop */ }
    }
    if (typeof capa.getVisible === 'function') {
      try { return !!capa.getVisible(); } catch (e) { /* noop */ }
    }
    if (capa.options && capa.options.visibility !== undefined) {
      return !!capa.options.visibility;
    }
    if (capa.visibility !== undefined) {
      return !!capa.visibility;
    }
    return true;
  }

  function bboxDeGeometria(geom) {
    if (!geom || !geom.coordinates) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const recorrer = function (c) {
      if (typeof c[0] === 'number') {
        const x = c[0], y = c[1];
        if (isFinite(x) && isFinite(y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        return;
      }
      for (let i = 0; i < c.length; i += 1) recorrer(c[i]);
    };
    recorrer(geom.coordinates);
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function geometriaTocaRect(geom, rect) {
    if (!geom || !rect) return true;
    if (geom.type === 'Point') {
      const c = geom.coordinates;
      if (!c || typeof c[0] !== 'number') return false;
      return c[0] >= rect.minX && c[0] <= rect.maxX && c[1] >= rect.minY && c[1] <= rect.maxY;
    }
    const bb = bboxDeGeometria(geom);
    if (!bb) return true;
    return !(bb.maxX < rect.minX || bb.minX > rect.maxX || bb.maxY < rect.minY || bb.minY > rect.maxY);
  }

  // ---------- Reproyeccion ----------

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
    if (!geom || !geom.type) return geom;
    if (geom.type === 'GeometryCollection') {
      return Object.assign({}, geom, {
        geometries: (geom.geometries || []).map(function (g) {
          return reproyectarGeometria(g, desde, hasta);
        })
      });
    }
    if (!geom.coordinates) return geom;
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

  // ---------- Valores de propiedades ----------

  /**
   * Sanea un objeto de propiedades para que sea JSON-serializable limpio y
   * compatible con los estilos y renderizadores de OpenLayers / Cesium
   * (sin BigInt, sin buffers o typed arrays en memoria).
   * @param {Object} props
   * @returns {Object}
   */
  function sanitizarPropiedades(props) {
    if (!props || typeof props !== 'object') return {};
    const salida = {};
    const claves = Object.keys(props);
    for (let i = 0; i < claves.length; i += 1) {
      const k = claves[i];
      const v = props[k];
      if (v === undefined || v === null) continue;
      if (typeof v === 'bigint') {
        const n = Number(v);
        salida[k] = Number.isSafeInteger(n) ? n : String(v);
      } else if (v instanceof Uint8Array || ArrayBuffer.isView(v)) {
        continue; // Descarta buffers binarios auxiliares no utilizables en UI
      } else if (v instanceof Date) {
        salida[k] = v.toISOString();
      } else if (typeof v === 'object') {
        try {
          salida[k] = JSON.parse(JSON.stringify(v, function (key, val) {
            if (typeof val === 'bigint') return Number(val);
            if (val instanceof Uint8Array || ArrayBuffer.isView(val)) return undefined;
            return val;
          }));
        } catch (e) {
          salida[k] = String(v);
        }
      } else {
        salida[k] = v;
      }
    }
    return salida;
  }

  function normalizarValor(valor) {
    if (typeof valor === 'bigint') {
      const n = Number(valor);
      return Number.isSafeInteger(n) ? n : String(valor);
    }
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'object' && valor !== null) {
      if (valor.type && valor.coordinates) return valor; // geometria
      if (valor instanceof Uint8Array) return Array.from(valor);
      try { return JSON.stringify(valor); } catch (e) { return String(valor); }
    }
    return valor;
  }

  // ---------- Lector WKB de respaldo ----------

  /**
   * Decodifica WKB a GeoJSON. Solo se usa si hyparquet no lo ha hecho ya.
   * @param {Uint8Array|ArrayBuffer} datos
   * @param {Object} hy Biblioteca hyparquet.
   * @returns {Object|null}
   */
  function wkbAGeoJSON(datos, hy) {
    try {
      let bytes = datos;
      if (datos instanceof ArrayBuffer) bytes = new Uint8Array(datos);
      if (!(bytes instanceof Uint8Array)) return null;
      if (hy && typeof hy.wkbToGeojson === 'function') {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return hy.wkbToGeojson({ view: view, offset: 0 });
      }
    } catch (e) { /* WKB no soportado */ }
    return null;
  }

  // ---------- Capa nativa IDEE.layer.GeoParquet ----------

  let claseInstalada = null;
  let baseInstalada = null;

  /**
   * Crea la clase para el bundle actual (IDEE.layer.GeoJSON cambia entre 2D y 3D).
   * @param {Object} IDEE API activa.
   * @returns {Function}
   */
  function crearClase(IDEE) {
    const GeoParquet = class GeoParquet extends IDEE.layer.GeoJSON {
      constructor(t, e, i) {
        // Acepta:
        //   new IDEE.layer.GeoParquet('fichero.parquet')
        //   new IDEE.layer.GeoParquet({ url, name, legend, crs, columns })
        //   new IDEE.layer.GeoParquet(featureCollection, { style })
        let params;
        if (typeof t === 'string') {
          params = { url: t };
        } else if (t && (t.type === 'FeatureCollection' || Array.isArray(t.features))) {
          params = Object.assign({}, e || {});
          params.source = t;
        } else {
          params = Object.assign({}, t || {});
        }

        const url = params.url || params._geoparquetUrl || null;
        if (!params.source) {
          params.source = { type: 'FeatureCollection', features: [] };
        }

        super(params, e || {}, i || {});

        let filterOpt = params.filter !== undefined ? params.filter : params.filtro;
        let whereOpt = params.where !== undefined ? params.where : null;
        if (filterOpt && typeof filterOpt === 'object' && !Array.isArray(filterOpt)) {
          whereOpt = Object.assign({}, whereOpt || {}, filterOpt);
          filterOpt = null;
        }

        this._geoparquet = true;
        this._geoparquetUrl = url;
        this._geoparquetCRS = params._geoparquetCRS || params.crs || null;
        this._gpColumnas = Array.isArray(params.columns) ? params.columns.slice() : null;
        this._gpFilter = (typeof filterOpt === 'function') ? filterOpt : null;
        this._gpWhere = (whereOpt && typeof whereOpt === 'object') ? Object.assign({}, whereOpt) : null;
        this._gpRequestInit = params.requestInit || (params.headers ? { headers: params.headers } : null);
        this._gpByteLength = typeof params.byteLength === 'number' ? params.byteLength : null;
        this._gpLimit = typeof params.limit === 'number' && params.limit > 0
          ? Math.round(params.limit)
          : (typeof params.maxFeatures === 'number' && params.maxFeatures > 0 ? Math.round(params.maxFeatures) : null);
        this._gpMinZoom = typeof params.minZoom === 'number' && params.minZoom >= 0 ? params.minZoom : null;
        this._gpMaxZoom = typeof params.maxZoom === 'number' && params.maxZoom >= 0 ? params.maxZoom : null;

        // Estado del teselado por bbox y filtros.
        this._gpModo = 'vista';
        this._gpBbox = null;
        this._gpCargando = false;
        this._gpPendiente = null;
        this._gpInicial = false;
        this._gpTimer3D = null;
        this._gpRetryTimer = null;
        this._gpMoveEnd = null;

        // Cache de la fuente: { url, file, metadata, geo, primaria, crs,
        // covering, columnas }.
        this._gpInfo = null;
        this._gpPromesaFuente = null;

        const conFeatures = !!(params.source && params.source.features && params.source.features.length);
        this._gpAutoCarga = !!(url && !conFeatures);
      }

      /**
       * `map.addLayers()` llama a `setMap()` en la fachada antes de anadir el
       * impl al mapa (no llama a `addTo()` de la fachada). Se usa este hook
       * para disparar la primera carga, ya con el mapa asignado.
       * @param {Object} map Mapa de la API-IDEE.
       */
      setMap(map) {
        const nuevo = map !== this.map_;
        super.setMap(map);
        if (!nuevo || !map || !this._gpAutoCarga || this._gpInicial) return;
        this._gpInicial = true;
        const self = this;
        // Token de la carga inicial: si antes de este turno llega otra
        // peticion (por ejemplo, el modo "todas" restaurado por
        // ext/bboxFeatures tras un cambio 2D/3D), la inicial ya no manda y
        // no debe pisarla.
        const token = (this._gpTokenInicial = (this._gpTokenInicial || 0) + 1);
        // Se difiere un turno para que `map.addLayers()` termine de enganchar
        // el impl antes de que `setSource()` cambie su fuente.
        setTimeout(function () {
          if (self._gpTokenInicial !== token) return;
          self._recargar('vista', map, false);
          // En 3D el bbox cambia al mover la camara.
          self._escucharCamara3D(map);
        }, 0);
      }

      addTo(t, e) {
        super.addTo(t, e);
        if (!this._gpAutoCarga || this._gpInicial) return;
        this._gpInicial = true;
        const map = t;
        // Arranque en "La vista": footer + solo los row groups visibles.
        this._recargar('vista', map, false);
        // En 3D el bbox cambia al mover la camara.
        this._escucharCamara3D(map);
      }

      destroy() {
        try {
          if (this._gpTimer3D) clearTimeout(this._gpTimer3D);
          if (this._gpRetryTimer) clearTimeout(this._gpRetryTimer);
        } catch (ex) { /* noop */ }
        this._gpTimer3D = null;
        this._gpRetryTimer = null;
        try {
          if (this._gpMoveEnd && this._gpMoveEnd.camara && this._gpMoveEnd.cola) {
            this._gpMoveEnd.camara.moveEnd.removeEventListener(this._gpMoveEnd.cola);
          }
        } catch (ex) { /* noop */ }
        this._gpMoveEnd = null;
        if (typeof super.destroy === 'function') super.destroy();
      }

      /**
       * Cambia la visibilidad de la capa y dispara la recarga si se hace visible por primera vez.
       * @param {boolean} visible
       */
      setVisible(visible) {
        if (typeof super.setVisible === 'function') {
          try { super.setVisible(visible); } catch (e) { /* noop */ }
        }
        try {
          const impl = (typeof this.getImpl === 'function') ? this.getImpl() : null;
          if (impl && typeof impl.setVisible === 'function') {
            impl.setVisible(visible);
          }
        } catch (e) { /* noop */ }
        if (this.options) this.options.visibility = !!visible;
        this.visibility = !!visible;

        if (visible && this.map_) {
          this._recargar(this._gpModo, this.map_, true);
        }
      }

      /**
       * Obtiene los metadatos estructurados de GeoParquet del fichero.
       * @returns {Promise<Object>}
       */
      getGeoParquetMetadata() {
        const self = this;
        if (!this._geoparquetUrl) return Promise.reject(new Error('GeoParquet: sin URL definida'));
        return this._prepararFuente(this._geoparquetUrl).then(function (info) {
          const geo = info.geo || {};
          const primaria = info.primaria || 'geometry';
          const colGeo = (geo.columns && geo.columns[primaria]) || {};
          return {
            url: info.url,
            version: geo.version || null,
            primaryColumn: primaria,
            crs: info.crs,
            geometryTypes: colGeo.geometry_types || [],
            bbox: colGeo.bbox || null,
            covering: info.covering || null,
            columns: columnasDeMetadata(info.metadata),
            loadedColumns: info.columnas ? info.columnas.slice() : [],
            numRows: Number(info.metadata && info.metadata.num_rows ? info.metadata.num_rows : 0),
            numRowGroups: (info.metadata && info.metadata.row_groups) ? info.metadata.row_groups.length : 0,
            rawGeo: geo,
            rawMetadata: info.metadata
          };
        });
      }

      /**
       * Obtiene el filtro alfanumerico activo.
       * @returns {Function|null}
       */
      getFilter() {
        return this._gpFilter;
      }

      /**
       * Establece un filtro alfanumerico (predicado `(properties, feature) => boolean`
       * o bien un objeto de condiciones where) y recarga la capa.
       * @param {Function|Object|null} filtro
       * @returns {Promise}
       */
      setFilter(filtro) {
        if (typeof filtro === 'function') {
          this._gpFilter = filtro;
        } else if (filtro && typeof filtro === 'object') {
          this._gpWhere = Object.assign({}, filtro);
          this._gpFilter = null;
        } else {
          this._gpFilter = null;
          this._gpWhere = null;
        }
        if (this._gpInfo) {
          this._gpInfo.columnas = columnasDeLectura(
            this._gpInfo.metadata,
            this._gpInfo.primaria,
            this._gpColumnas,
            this._gpInfo.covering,
            this._gpWhere
          );
        }
        return this._recargar(this._gpModo, this.map_, true);
      }

      /**
       * Obtiene las condiciones alfanumericas where activas para pushdown.
       * @returns {Object|null}
       */
      getWhere() {
        return this._gpWhere ? Object.assign({}, this._gpWhere) : null;
      }

      /**
       * Establece condiciones alfanumericas declarativas para pushdown en footer
       * y filtrado exacto fila a fila.
       * @param {Object|null} where
       * @returns {Promise}
       */
      setWhere(where) {
        this._gpWhere = (where && typeof where === 'object') ? Object.assign({}, where) : null;
        if (this._gpInfo) {
          this._gpInfo.columnas = columnasDeLectura(
            this._gpInfo.metadata,
            this._gpInfo.primaria,
            this._gpColumnas,
            this._gpInfo.covering,
            this._gpWhere
          );
        }
        return this._recargar(this._gpModo, this.map_, true);
      }

      /**
       * Obtiene la lista de columnas solicitadas.
       * @returns {string[]|null}
       */
      getColumns() {
        return this._gpColumnas ? this._gpColumnas.slice() : null;
      }

      /**
       * Define las columnas alfanumericas a solicitar y recarga la capa.
       * @param {string[]|null} columnas
       * @returns {Promise}
       */
      setColumns(columnas) {
        this._gpColumnas = Array.isArray(columnas) ? columnas.slice() : null;
        if (this._gpInfo) {
          this._gpInfo.columnas = columnasDeLectura(
            this._gpInfo.metadata,
            this._gpInfo.primaria,
            this._gpColumnas,
            this._gpInfo.covering,
            this._gpWhere
          );
        }
        return this._recargar(this._gpModo, this.map_, true);
      }

      /**
       * Obtiene el limite maximo de features a cargar.
       * @returns {number|null}
       */
      getLimit() {
        return this._gpLimit;
      }

      /**
       * Establece un limite maximo de features y recarga la capa.
       * @param {number|null} limite
       * @returns {Promise}
       */
      setLimit(limite) {
        this._gpLimit = typeof limite === 'number' && limite > 0 ? Math.round(limite) : null;
        return this._recargar(this._gpModo, this.map_, true);
      }

      /**
       * Obtiene el zoom minimo de visualizacion.
       * @returns {number|null}
       */
      getMinZoom() {
        return this._gpMinZoom;
      }

      /**
       * Establece el zoom minimo para pedir datos.
       * @param {number|null} zoom
       * @returns {Promise}
       */
      setMinZoom(zoom) {
        this._gpMinZoom = typeof zoom === 'number' && zoom >= 0 ? zoom : null;
        return this._recargar(this._gpModo, this.map_, true);
      }

      /**
       * Obtiene el zoom maximo de visualizacion.
       * @returns {number|null}
       */
      getMaxZoom() {
        return this._gpMaxZoom;
      }

      /**
       * Establece el zoom maximo para pedir datos.
       * @param {number|null} zoom
       * @returns {Promise}
       */
      setMaxZoom(zoom) {
        this._gpMaxZoom = typeof zoom === 'number' && zoom >= 0 ? zoom : null;
        return this._recargar(this._gpModo, this.map_, true);
      }

      /**
       * Fuerza la recarga de la capa.
       * @returns {Promise}
       */
      reload() {
        return this._recargar(this._gpModo, this.map_, true);
      }

      /**
       * En 3D, recarga al terminar de mover la camara (modo vista).
       * @param {Object} map
       */
      _escucharCamara3D(map) {
        if (!map) return;
        // En 2D no hay escena ni camara: no se programa ningun reintento.
        let inicial = null;
        try { inicial = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null; } catch (ex) { inicial = null; }
        if (!inicial || !inicial.scene) return;
        const self = this;
        let intentos = 0;
        const intentar = function () {
          intentos += 1;
          let impl = null;
          try { impl = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null; } catch (ex) { impl = null; }
          if (!impl || !impl.scene || !impl.scene.camera || !impl.scene.camera.moveEnd) {
            if (intentos < 60) self._gpRetryTimer = setTimeout(intentar, 500);
            return;
          }
          const camara = impl.scene.camera;
          const cola = function () {
            try {
              if (self._gpTimer3D) clearTimeout(self._gpTimer3D);
              self._gpTimer3D = setTimeout(function () {
                self._recargar(self._gpModo, map, false);
              }, 300);
            } catch (ex) { /* noop */ }
          };
          try {
            camara.moveEnd.addEventListener(cola);
            self._gpMoveEnd = { camara: camara, cola: cola };
          } catch (ex) { /* noop */ }
        };
        intentar();
      }

      /**
       * Prepara (y cachea) la fuente: vendor, AsyncBuffer con Range, footer y
       * metadata `geo`.
       * @param {string} url
       * @returns {Promise<Object>}
       */
      _prepararFuente(url) {
        if (this._gpInfo && this._gpInfo.url === url) return Promise.resolve(this._gpInfo);
        if (this._gpPromesaFuente && this._gpPromesaFuente.url === url) {
          return this._gpPromesaFuente.promesa;
        }

        const self = this;
        const promesa = cargarVendor().then(function (hy) {
          function finalizar(file, metadata) {
            const geo = geoDeMetadata(metadata);
            const primaria = (geo && geo.primary_column) || 'geometry';
            const col = (geo && geo.columns && geo.columns[primaria]) || {};
            let covering = (col.covering && col.covering.bbox) || null;
            if (!covering) {
              const schema = (metadata && metadata.schema) || [];
              const nombres = new Set(schema.map(function (s) { return s && s.name; }));
              if (nombres.has('bbox') && nombres.has('minx') && nombres.has('miny') && nombres.has('maxx') && nombres.has('maxy')) {
                covering = {
                  xmin: ['bbox', 'minx'],
                  ymin: ['bbox', 'miny'],
                  xmax: ['bbox', 'maxx'],
                  ymax: ['bbox', 'maxy']
                };
              } else if (nombres.has('bbox') && nombres.has('xmin') && nombres.has('ymin') && nombres.has('xmax') && nombres.has('ymax')) {
                covering = {
                  xmin: ['bbox', 'xmin'],
                  ymin: ['bbox', 'ymin'],
                  xmax: ['bbox', 'xmax'],
                  ymax: ['bbox', 'ymax']
                };
              }
            }
            const crs = self._geoparquetCRS || crsDeGeo(col.crs) || 'EPSG:4326';
            const columnas = columnasDeLectura(metadata, primaria, self._gpColumnas, covering, self._gpWhere);
            const rowGroupExtents = precomputarExtentsRowGroups(metadata, covering);
            const info = {
              url: url,
              file: file,
              metadata: metadata,
              geo: geo,
              primaria: primaria,
              crs: crs,
              covering: covering,
              columnas: columnas,
              rowGroupExtents: rowGroupExtents,
              hy: hy
            };
            self._geoparquetCRS = crs;
            self._gpInfo = info;
            return info;
          }

          // Camino normal: footer y row groups por HTTP Range.
          const bufferOpts = { url: url };
          if (self._gpRequestInit) bufferOpts.requestInit = self._gpRequestInit;
          if (self._gpByteLength) bufferOpts.byteLength = self._gpByteLength;

          return hy.asyncBufferFromUrl(bufferOpts).then(function (crudo) {
            const file = hy.cachedAsyncBuffer(crudo, { minSize: 0 });
            return hy.parquetMetadataAsync(file, { initialFetchSize: 32768 }).then(function (metadata) {
              return finalizar(file, metadata);
            });
          }).catch(function () {
            // Algunos servidores estaticos (GitHub Pages) sirven el .parquet con
            // Content-Encoding: gzip. Un fetch completo se descomprime bien, pero
            // las peticiones por rangos reciben bytes comprimidos y el footer deja
            // de ser "PAR1". Se recurre entonces a descargar el fichero entero.
            return fetch(url, self._gpRequestInit || {}).then(function (res) {
              if (!res.ok) throw new Error('GeoParquet: fetch ' + res.status);
              return res.arrayBuffer();
            }).then(function (buf) {
              const file = {
                byteLength: buf.byteLength,
                slice: function (inicio, fin) {
                  return Promise.resolve(buf.slice(inicio, fin));
                }
              };
              const metadata = hy.parquetMetadata(buf);
              return finalizar(file, metadata);
            });
          });
        });
        this._gpPromesaFuente = { url: url, promesa: promesa };
        promesa.catch(function () {
          if (self._gpPromesaFuente && self._gpPromesaFuente.promesa === promesa) {
            self._gpPromesaFuente = null;
          }
        });
        return promesa;
      }

      /**
       * Recarga la capa en el modo pedido. Idempotente por modo + bbox.
       * @param {string} modo 'vista' o 'todas'.
       * @param {Object} map Mapa de la API.
       * @param {boolean} forzar
       * @returns {Promise}
       */
      /**
       * Extension de la capa para "zoom a la capa", en EPSG:3857.
       *
       * Se calcula a partir de las estadisticas de cobertura (`bbox`) del
       * metadata de GeoParquet, que da el rectangulo de cada row group. Asi
       * el boton encuadra todos los datos del fichero, no solo los que ya se
       * han cargado en la vista actual.
       * @returns {Array<number>|null} [x0, y0, x1, y1] o null.
       */
      _extensionParaZoom() {
        const info = this._gpInfo;
        if (!info) return null;

        const desde = info.crs || 'EPSG:4326';
        const API = (typeof window !== 'undefined') ? (window.IDEE || window.M) : null;

        function re座標(minX, minY, maxX, maxY) {
          if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
          if (maxX <= minX || maxY <= minY) return null;
          let oeste = [minX, minY];
          let este = [maxX, maxY];
          if (desde && desde !== 'EPSG:3857' && API && API.utils && typeof API.utils.reproject === 'function') {
            try {
              oeste = API.utils.reproject([minX, minY], desde, 'EPSG:3857');
              este = API.utils.reproject([maxX, maxY], desde, 'EPSG:3857');
            } catch (e) { return null; }
          }
          if (!Array.isArray(oeste) || !Array.isArray(este)) return null;
          if (!isFinite(oeste[0]) || !isFinite(oeste[1]) || !isFinite(este[0]) || !isFinite(este[1])) return null;
          return [oeste[0], oeste[1], este[0], este[1]];
        }

        // 1. Si el metadata geo trae bbox directo:
        const geo = info.geo;
        const col = (geo && geo.columns && geo.columns[info.primaria || 'geometry']) || {};
        if (Array.isArray(col.bbox) && col.bbox.length === 4) {
          const extGeo = re座標(Number(col.bbox[0]), Number(col.bbox[1]), Number(col.bbox[2]), Number(col.bbox[3]));
          if (extGeo) return extGeo;
        }

        // 2. Si hay estadisticas de cobertura en los row groups:
        const b = info.covering;
        if (!b || !Array.isArray(b.xmin)) return null;
        
        const xminPath = b.xmin;
        const yminPath = b.ymin;
        const xmaxPath = b.xmax;
        const ymaxPath = b.ymax;
        if (!Array.isArray(xminPath) || !Array.isArray(yminPath) ||
            !Array.isArray(xmaxPath) || !Array.isArray(ymaxPath)) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let hay = false;
        const grupos = (info.metadata && info.metadata.row_groups) || [];
        for (let i = 0; i < grupos.length; i += 1) {
          const rg = grupos[i];
          const sx = estadisticasDe(rg, xminPath);
          const sy = estadisticasDe(rg, yminPath);
          const sxmax = estadisticasDe(rg, xmaxPath);
          const symax = estadisticasDe(rg, ymaxPath);
          const vxMin = sx ? (sx.min !== undefined && sx.min !== null ? sx.min : sx.min_value) : undefined;
          const vyMin = sy ? (sy.min !== undefined && sy.min !== null ? sy.min : sy.min_value) : undefined;
          const vxMax = sxmax ? (sxmax.max !== undefined && sxmax.max !== null ? sxmax.max : sxmax.max_value) : undefined;
          const vyMax = symax ? (symax.max !== undefined && symax.max !== null ? symax.max : symax.max_value) : undefined;
          if (vxMin !== undefined && isFinite(Number(vxMin))) { minX = Math.min(minX, Number(vxMin)); hay = true; }
          if (vyMin !== undefined && isFinite(Number(vyMin))) { minY = Math.min(minY, Number(vyMin)); hay = true; }
          if (vxMax !== undefined && isFinite(Number(vxMax))) { maxX = Math.max(maxX, Number(vxMax)); hay = true; }
          if (vyMax !== undefined && isFinite(Number(vyMax))) { maxY = Math.max(maxY, Number(vyMax)); hay = true; }
        }
        if (!hay) return null;
        return re座標(minX, minY, maxX, maxY);
      }
      /**
       * Extension de la capa cuando no hay cobertura bbox: lee todas las filas
       * y calcula su caja. Solo se usa como plan B para ficheros pequenos o sin
       * metadata de cobertura.
       * @returns {Promise<Array<number>|null>}
       */
      async _extensionParaZoomCompleta() {
        const info = this._gpInfo;
        if (!info) return null;
        const total = Number(info.metadata && info.metadata.num_rows ? info.metadata.num_rows : 0);
        if (!total || total > 200000) return null;
        try {
          const filas = await info.hy.parquetReadObjects({
            file: info.file,
            metadata: info.metadata,
            rowStart: 0,
            rowEnd: total,
            columns: info.columnas
          });
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          let hay = false;
          const primaria = info.primaria;
          for (let i = 0; i < filas.length; i += 1) {
            let geom = filas[i] ? filas[i][primaria] : null;
            if (geom && !(geom.type && geom.coordinates)) {
              geom = wkbAGeoJSON(geom, info.hy);
            }
            if (!geom || !geom.coordinates) continue;
            const recorrer = function (coords) {
              if (typeof coords[0] === 'number') {
                const x = coords[0];
                const y = coords[1];
                if (isFinite(x) && isFinite(y)) {
                  minX = Math.min(minX, x);
                  minY = Math.min(minY, y);
                  maxX = Math.max(maxX, x);
                  maxY = Math.max(maxY, y);
                  hay = true;
                }
                return;
              }
              for (let k = 0; k < coords.length; k += 1) recorrer(coords[k]);
            };
            recorrer(geom.coordinates);
          }
          if (!hay || maxX <= minX || maxY <= minY) return null;
          const desde = info.crs || 'EPSG:4326';
          const API = (typeof window !== 'undefined') ? (window.IDEE || window.M) : null;
          let oeste = [minX, minY];
          let este = [maxX, maxY];
          if (desde && desde !== 'EPSG:3857' && API && API.utils && typeof API.utils.reproject === 'function') {
            try {
              oeste = API.utils.reproject([minX, minY], desde, 'EPSG:3857');
              este = API.utils.reproject([maxX, maxY], desde, 'EPSG:3857');
            } catch (e) { return null; }
          }
          if (!Array.isArray(oeste) || !Array.isArray(este)) return null;
          if (!isFinite(oeste[0]) || !isFinite(oeste[1]) || !isFinite(este[0]) || !isFinite(este[1])) return null;
          return [oeste[0], oeste[1], este[0], este[1]];
        } catch (e) {
          return null;
        }
      }
      _recargar(modo, map, forzar) {
        const self = this;
        const url = this._geoparquetUrl;
        if (!url) return Promise.resolve();
        if (!esCapaVisible(this)) {
          return Promise.resolve();
        }

        // Comprobacion de umbral de escala / zoom
        if (map && typeof map.getZoom === 'function') {
          let zoomActual = null;
          try { zoomActual = map.getZoom(); } catch (e) { zoomActual = null; }
          if (zoomActual !== null) {
            if (this._gpMinZoom !== null && zoomActual < this._gpMinZoom) {
              try { if (typeof this.setSource === 'function') this.setSource({ type: 'FeatureCollection', features: [] }); } catch (e) {}
              this._gpCargando = false;
              return Promise.resolve({ saltado: true, fueraDeEscala: true });
            }
            if (this._gpMaxZoom !== null && zoomActual > this._gpMaxZoom) {
              try { if (typeof this.setSource === 'function') this.setSource({ type: 'FeatureCollection', features: [] }); } catch (e) {}
              this._gpCargando = false;
              return Promise.resolve({ saltado: true, fueraDeEscala: true });
            }
          }
        }

        modo = (modo === 'todas') ? 'todas' : 'vista';
        // Cualquier peticion invalida una carga inicial que aun no haya
        // arrancado (ver setMap): la ultima intencion es la que manda.
        this._gpTokenInicial = (this._gpTokenInicial || 0) + 1;

        if (this._gpCargando) {
          this._gpPendiente = { modo: modo, map: map };
          return Promise.resolve();
        }

        this._gpCargando = true;
        let promesa;

        // La primera vez hay que leer el footer para saber el CRS y la
        // cobertura; despues `_prepararFuente` devuelve la cache.
        promesa = this._prepararFuente(url).then(function (info) {
          let rect = null;
          let clave = '';
          if (modo === 'vista') {
            const vista = self._bboxVista(map, info.crs);
            if (vista) {
              rect = vista.rect;
              clave = vista.clave;
            }
          }

          const whereClave = self._gpWhere ? JSON.stringify(self._gpWhere) : '';
          const filterClave = self._gpFilter ? String(self._gpFilter) : '';
          const claveCompleta = modo + '|' + clave + '|w:' + whereClave + '|f:' + filterClave;

          if (!forzar && self._gpModo === modo && self._gpBbox === claveCompleta) {
            return { saltado: true, features: null, info: info, seleccion: null };
          }

          let seleccion;
          if ((rect && info.covering) || self._gpWhere) {
            seleccion = gruposParaCarga(info.metadata, info.rowGroupExtents, rect, info.covering, self._gpWhere);
            // Sin estadisticas utiles no se puede podar: se lee todo.
            if (!seleccion.conStats) seleccion = null;
          }
          if (!seleccion) {
            const total = Number(info.metadata.num_rows || 0);
            const limite = (modo === 'vista' && total > 50000) ? 50000 : total;
            seleccion = { indices: null, rangos: [{ inicio: 0, fin: limite }], conStats: false };
          }

          const rangos = (seleccion && seleccion.rangos) || [];

          // En modo vista con límite, para evitar descargar bloques masivos innecesarios,
          // acotamos los rangos a descargar al límite configurado.
          let rangosParaLeer = rangos;
          if (modo === 'vista' && self._gpLimit && rangos.length > 0) {
            let acumulado = 0;
            const rangosAcotados = [];
            for (let r = 0; r < rangos.length; r += 1) {
              const rg = rangos[r];
              const tam = rg.fin - rg.inicio;
              rangosAcotados.push(rg);
              acumulado += tam;
              // Si el tamaño de filas seleccionadas supera el límite x 2, no pedimos más bloques
              if (acumulado >= Math.max(self._gpLimit * 2, 2000)) break;
            }
            rangosParaLeer = rangosAcotados;
          }

          const lecturas = rangosParaLeer.map(function (rango) {
            return info.hy.parquetReadObjects({
              file: info.file,
              metadata: info.metadata,
              rowStart: rango.inicio,
              rowEnd: rango.fin,
              columns: info.columnas
            }).then(function (filas) {
              return { rango: rango, filas: filas || [] };
            });
          });

          return Promise.all(lecturas).then(function (bloques) {
            const features = [];
            let limiteAlcanzado = false;

            for (let b = 0; b < bloques.length; b += 1) {
              if (limiteAlcanzado) break;
              const rango = bloques[b].rango;
              const filas = bloques[b].filas;
              for (let i = 0; i < filas.length; i += 1) {
                if (self._gpLimit && features.length >= self._gpLimit) {
                  limiteAlcanzado = true;
                  break;
                }

                const fila = filas[i];
                let geom = fila[info.primaria];
                if (geom && !(geom.type && geom.coordinates)) {
                  geom = wkbAGeoJSON(geom, info.hy);
                }
                if (!geom || !geom.type) continue;
                if (modo === 'vista' && rect && !geometriaTocaRect(geom, rect)) continue;

                const props = {};
                const claves = Object.keys(fila);
                for (let k = 0; k < claves.length; k += 1) {
                  const nombre = claves[k];
                  if (nombre === info.primaria) continue;
                  if (String(nombre).charAt(0) === '_') continue;
                  if (info.covering) {
                    let esCobertura = false;
                    ['xmin', 'ymin', 'xmax', 'ymax'].forEach(function (kk) {
                      const ruta = info.covering[kk];
                      if (Array.isArray(ruta) && String(ruta[0]) === String(nombre)) esCobertura = true;
                    });
                    if (esCobertura) continue;
                  }
                  props[nombre] = fila[nombre];
                }

                if (self._gpWhere && !cumplePredicadoFila(props, self._gpWhere)) {
                  continue;
                }

                const propsLimpias = sanitizarPropiedades(props);

                const feature = {
                  type: 'Feature',
                  id: rango.inicio + i,
                  geometry: geom,
                  properties: propsLimpias
                };
                if (typeof self._gpFilter === 'function') {
                  let pasa = false;
                  try {
                    pasa = self._gpFilter(props, feature);
                  } catch (ef) {
                    pasa = true;
                  }
                  if (!pasa) continue;
                }
                features.push(info.crs !== 'EPSG:4326'
                  ? reproyectarFeature(feature, info.crs, 'EPSG:4326')
                  : feature);
              }
            }
            return { saltado: false, features: features, info: info, seleccion: seleccion, claveCompleta: claveCompleta };
          });
        }).then(function (resultado) {
          self._gpCargando = false;
          if (!resultado.saltado) {
            self._gpModo = modo;
            self._gpBbox = resultado.claveCompleta || '';
            try {
              if (typeof self.setSource === 'function') {
                self.setSource({ type: 'FeatureCollection', features: resultado.features || [] });
              }
            } catch (ex) { /* noop */ }
            if (resultado.seleccion) {
              self._gpUltimaSeleccion = {
                modo: modo,
                rowGroups: resultado.seleccion.indices,
                rangos: resultado.seleccion.rangos,
                conStats: resultado.seleccion.conStats
              };
            }
          }

          const pendiente = self._gpPendiente;
          self._gpPendiente = null;
          if (pendiente) {
            setTimeout(function () {
              self._recargar(pendiente.modo, pendiente.map, false);
            }, 0);
          }
          return resultado;
        }).catch(function (e) {
          self._gpCargando = false;
          self._gpPendiente = null;
          console.warn('GeoParquet: recarga', e);
        });

        return promesa;
      }

      /**
       * bbox de la vista en la CRS del fichero.
       * @param {Object} map
       * @param {string} crsFg
       * @returns {{rect:Object, clave:string}|null}
       */
      _bboxVista(map, crsFg) {
        if (!map) return null;
        const destino = crsFg || 'EPSG:4326';
        const API = api();

        // 1. Intentar obtener el BBOX exacto directamente de OpenLayers si está disponible
        let olMap = null;
        try { olMap = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null; } catch (e) { olMap = null; }
        if (olMap && olMap.getView && olMap.getSize && window.ol && window.ol.proj) {
          try {
            const size = olMap.getSize();
            const view = olMap.getView();
            if (size && view) {
              const extent = view.calculateExtent(size);
              const mapProj = (view.getProjection && view.getProjection().getCode()) || 'EPSG:3857';
              let extentDest = extent;
              if (mapProj !== destino) {
                extentDest = window.ol.proj.transformExtent(extent, mapProj, destino);
              }
              if (Array.isArray(extentDest) && extentDest.length === 4 &&
                  isFinite(extentDest[0]) && isFinite(extentDest[1]) &&
                  isFinite(extentDest[2]) && isFinite(extentDest[3])) {
                return {
                  rect: { minX: extentDest[0], minY: extentDest[1], maxX: extentDest[2], maxY: extentDest[3] },
                  clave: extentDest.map(function (n) { return Math.round(n * 10000) / 10000; }).join(',')
                };
              }
            }
          } catch (e) { /* fallback a getBbox de la API */ }
        }

        // 2. Fallback estándar para Cesium 3D o mapas genéricos
        if (typeof map.getBbox !== 'function') return null;
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
          try {
            if ((destino === 'EPSG:4326' && grados) ||
                (destino === 'EPSG:3857' && !grados && code === 'EPSG:3857')) {
              return [x, y];
            }
            const desde = grados ? 'EPSG:4326' : (code || 'EPSG:3857');
            const p = API.utils.reproject([x, y], desde, destino);
            return (p && isFinite(p[0]) && isFinite(p[1])) ? [p[0], p[1]] : null;
          } catch (ex) { return null; }
        };

        const sw = aFichero(minx, miny);
        const ne = aFichero(maxx, maxy);
        if (!sw || !ne) return null;
        return {
          rect: { minX: sw[0], minY: sw[1], maxX: ne[0], maxY: ne[1] },
          clave: [Math.round(sw[0] * 10000) / 10000, Math.round(sw[1] * 10000) / 10000, Math.round(ne[0] * 10000) / 10000, Math.round(ne[1] * 10000) / 10000].join(',')
        };
      }
    };

    return GeoParquet;
  }

  /**
   * Instala (o reinstala) IDEE.layer.GeoParquet sobre el bundle activo.
   * @returns {boolean}
   */
  function instalar() {
    const IDEE = api();
    if (!IDEE || !IDEE.layer || typeof IDEE.layer.GeoJSON !== 'function') return false;

    const yaEsta = claseInstalada &&
      baseInstalada === IDEE.layer.GeoJSON &&
      IDEE.layer.GeoParquet === claseInstalada;
    if (yaEsta) return true;

    const Clase = crearClase(IDEE);
    claseInstalada = Clase;
    baseInstalada = IDEE.layer.GeoJSON;

    IDEE.layer.GeoParquet = Clase;
    if (window.IDEE && window.IDEE.layer) window.IDEE.layer.GeoParquet = Clase;
    if (window.M && window.M.layer) window.M.layer.GeoParquet = Clase;

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
        if (instalar() && window.hyparquet) return resolve(true);
        if (Date.now() - inicio >= tope) return resolve(false);
        setTimeout(comprobar, 25);
      })();
    });
  }

  // ---------- Ayudantes de carga ----------

  /**
   * Crea una capa GeoParquet sin anadirla al mapa.
   * @param {string} url
   * @param {Object} [opts]
   * @returns {Object}
   */
  function crearCapa(url, opts) {
    opts = opts || {};
    instalar();
    const IDEE = api();
    const Clase = (IDEE && IDEE.layer && IDEE.layer.GeoParquet) || null;
    if (!Clase) throw new Error('geoparquetLayer: IDEE.layer.GeoParquet no esta instalada');

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
  // El cambio 2D/3D recarga el bundle y cambia IDEE.layer.GeoJSON.
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
      clase: function () { return claseInstalada; }
    };
    window.geoparquetLayer = extension;
    // Alias que consume ext/bboxFeatures (y las versiones anteriores).
    window.miGeoParquet = extension;
  }
})();
