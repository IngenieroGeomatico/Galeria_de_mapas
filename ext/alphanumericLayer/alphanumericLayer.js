/* =====================================================================
   IDEE.layer.Alphanumeric
   ---------------------------------------------------------------------
   Capa de datos TEMÁTICOS SIN GEOMETRÍA.

   Para qué sirve
   --------------
   Guardar y consultar registros tabulares (CSV, JSON, XLSX, resultados de
   BigQuery...) dentro del ecosistema de la API, sin pintar nada en el mapa.
   Es el contenedor que usan las herramientas que necesitan datos "de
   atributos": tablas, gráficos, uniones por campo con capas vectoriales,
   filtros, etc.

   Por qué NO hereda de una capa de la API
   ---------------------------------------
   `IDEE.layer.Layer` no se expone en el bundle (solo `IDEE.layer.type`), y
   `map.addLayers()` exige que el objeto sea instancia de la clase interna
   (`t instanceof A.Z`) o un string DSL. Una capa sin geometría tampoco tiene
   nada que añadir al impl de OpenLayers/Cesium. Por eso esta clase:

     - implementa el contrato "de fachada" que esperan las herramientas
       (`type`, `name`, `legend`, `addTo`, `destroy`, `equals`, `getLegend`),
     - se registra en un registro propio del mapa (`map.getAlphanumericLayers()`),
     - y NO entra en `map.getLayers()` ni en el selector de capas.

   Uso
   ---
     const capa = new IDEE.layer.Alphanumeric({
       name: 'Población por municipio',
       legend: 'Población',
       records: [{ municipio: 'Madrid', poblacion: 3332035 }, ...],
       fields: [{ name: 'municipio', type: 'string' }, ...],
       idField: 'municipio',
     });
     capa.addTo(mapajs);

     // O desde fichero:
     const capa2 = IDEE.layer.Alphanumeric.fromCSV(texto, { name: 'CSV' });
     const capa3 = await IDEE.layer.Alphanumeric.fromXLSX(arrayBuffer, { name: 'Excel' });

     // Y si hay columnas lat/lon o un campo GeoJSON:
     const fc = capa.toGeoJSON({ latField: 'lat', lonField: 'lon' });

   Alias
   -----
   Se instala como `IDEE.layer.Alphanumeric` y `IDEE.layer.alphanumeric`
   (y lo mismo en `M.layer`), para que valga la grafía que se prefiera.
   ===================================================================== */

(function () {
  'use strict';

  /**
   * Convierte un texto WKT en un objeto GeoJSON.
   * Soporta POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING,
   * MULTIPOLYGON y GEOMETRYCOLLECTION. Devuelve null si no se reconoce.
   * @param {string} wkt Texto WKT.
   * @returns {Object|null}
   */
  function wktAGeoJSON(wkt) {
    if (!wkt || typeof wkt !== 'string') return null;
    const t = wkt.trim();
    // Normaliza espacios.
    const m = /^([A-Z]+)(Z|M|ZM)?\s*\((.*)\)\s*$/i.exec(t);
    if (!m) return null;
    const tipo = m[1].toUpperCase();
    const cuerpo = m[3];
    function parsearPunto(s) {
      const partes = s.trim().split(/\s+/);
      if (partes.length < 2) return null;
      const x = Number(partes[0]);
      const y = Number(partes[1]);
      if (!isFinite(x) || !isFinite(y)) return null;
      return [x, y];
    }
    function parsearLista(s, nivel) {
      // Devuelve array de puntos [x,y].
      const pts = [];
      // Separa por comas de primer nivel.
      let prof = 0;
      let actual = '';
      const trozos = [];
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(') { prof++; actual += c; }
        else if (c === ')') { prof--; actual += c; }
        else if (c === ',' && prof === 0) { trozos.push(actual); actual = ''; }
        else { actual += c; }
      }
      if (actual.trim()) trozos.push(actual);
      return trozos.map(function (x) { return x.trim(); }).filter(Boolean);
    }

    if (tipo === 'POINT') {
      const p = parsearPunto(cuerpo);
      return p ? { type: 'Point', coordinates: p } : null;
    }
    if (tipo === 'LINESTRING') {
      const coords = parsearLista(cuerpo, 0).map(parsearPunto).filter(Boolean);
      return coords.length >= 2 ? { type: 'LineString', coordinates: coords } : null;
    }
    if (tipo === 'POLYGON') {
      const anillos = parsearLista(cuerpo, 0);
      const coords = anillos.map(function (a) {
        // a viene como "(...)" -> quitamos paréntesis externos
        const inner = a.trim().replace(/^\(/, '').replace(/\)$/, '');
        return parsearLista(inner, 0).map(parsearPunto).filter(Boolean);
      });
      return { type: 'Polygon', coordinates: coords };
    }
    if (tipo === 'MULTIPOINT') {
      const coords = parsearLista(cuerpo, 0).map(function (a) {
        const inner = a.trim().replace(/^\(/, '').replace(/\)$/, '');
        return parsearPunto(inner);
      }).filter(Boolean);
      return { type: 'MultiPoint', coordinates: coords };
    }
    if (tipo === 'MULTILINESTRING') {
      const lineas = parsearLista(cuerpo, 0);
      const coords = lineas.map(function (a) {
        const inner = a.trim().replace(/^\(/, '').replace(/\)$/, '');
        return parsearLista(inner, 0).map(parsearPunto).filter(Boolean);
      });
      return { type: 'MultiLineString', coordinates: coords };
    }
    if (tipo === 'MULTIPOLYGON') {
      const pols = parsearLista(cuerpo, 0);
      const coords = pols.map(function (a) {
        const inner = a.trim().replace(/^\(/, '').replace(/\)$/, '');
        const anillos = parsearLista(inner, 0);
        return anillos.map(function (b) {
          const binner = b.trim().replace(/^\(/, '').replace(/\)$/, '');
          return parsearLista(binner, 0).map(parsearPunto).filter(Boolean);
        });
      });
      return { type: 'MultiPolygon', coordinates: coords };
    }
    return null;
  }

  /**
   * Devuelve true si el valor parece un texto WKT.
   * @param {*} v Valor.
   * @returns {boolean}
   */
  function esWKT(v) {
    if (typeof v !== 'string') return false;
    const t = v.trim().replace(/^SRID\s*=\s*\d+\s*;\s*/i, '');
    return /^\s*(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i.test(t);
  }

  // -------------------------------------------------------------------
  // CRS y reproyección
  // -------------------------------------------------------------------

  function normalizarCRS(crs) {
    if (!crs) return 'EPSG:4326';
    let c = String(crs).trim();
    if (!c) return 'EPSG:4326';
    if (/^(ogc:)?crs84$/i.test(c)) return 'EPSG:4326';
    if (/urn:ogc:def:crs:OGC:(1\.3:)?CRS84/i.test(c)) return 'EPSG:4326';
    if (/CRS84$/i.test(c) && /opengis\.net/i.test(c)) return 'EPSG:4326';
    const urn = /urn:ogc:def:crs:([^:]+):[^:]*:([^:]+)$/i.exec(c);
    if (urn) return urn[1].toUpperCase() + ':' + urn[2];
    const uri = /opengis\.net\/def\/crs\/([^\/]+)\/[^\/]*\/([^\/]+)$/i.exec(c);
    if (uri) {
      const fam = uri[1].toUpperCase();
      const code = uri[2];
      if (fam === 'OGC' && /crs84/i.test(code)) return 'EPSG:4326';
      return fam + ':' + code;
    }
    if (/^\d+$/.test(c)) return 'EPSG:' + c;
    if (/^epsg:\d+$/i.test(c)) return 'EPSG:' + c.split(':')[1];
    return c;
  }

  function reproyectarPunto(xy, desde, hasta) {
    if (!Array.isArray(xy) || xy.length < 2) return null;
    const d = normalizarCRS(desde);
    const h = normalizarCRS(hasta || 'EPSG:4326');
    if (d === h) return [Number(xy[0]), Number(xy[1])];
    if (typeof window !== 'undefined' && typeof window.proj4 === 'function') {
      try {
        if (!window.proj4.defs('EPSG:3035')) {
          window.proj4.defs('EPSG:3035', '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
        }
      } catch (e) { /* noop */ }
    }
    let r = null;
    try {
      const api = (typeof window !== 'undefined') ? (window.IDEE || window.M) : null;
      if (api && api.utils && typeof api.utils.reproject === 'function') {
        const out = api.utils.reproject([xy[0], xy[1]], d, h);
        if (Array.isArray(out) && isFinite(out[0]) && isFinite(out[1])) r = out;
      }
    } catch (e) { r = null; }
    if (!r && typeof window !== 'undefined' && typeof window.proj4 === 'function') {
      try {
        const out = window.proj4(d, h, [xy[0], xy[1]]);
        if (Array.isArray(out) && isFinite(out[0]) && isFinite(out[1])) r = out;
      } catch (e) { r = null; }
    }
    if (!r) return null;
    return xy.length > 2 ? [r[0], r[1], xy[2]] : [r[0], r[1]];
  }

  function reproyectarGeometria(geom, desde, hasta) {
    if (!geom || typeof geom !== 'object' || typeof geom.type !== 'string') return null;
    const d = normalizarCRS(desde);
    const h = normalizarCRS(hasta || 'EPSG:4326');
    if (geom.type === 'GeometryCollection') {
      const geoms = (geom.geometries || []).map(function (g) { return reproyectarGeometria(g, d, h); });
      if (geoms.some(function (g) { return !g; })) return null;
      return { type: 'GeometryCollection', geometries: geoms };
    }
    if (!Array.isArray(geom.coordinates)) return geom;
    function rec(coords) {
      if (typeof coords[0] === 'number') {
        const r = reproyectarPunto(coords, d, h);
        if (!r) return null;
        return coords.length > 2 ? [r[0], r[1], coords[2]] : [r[0], r[1]];
      }
      const salida = [];
      for (let i = 0; i < coords.length; i++) {
        const c = rec(coords[i]);
        if (c === null) return null;
        salida.push(c);
      }
      return salida;
    }
    const nuevas = rec(geom.coordinates);
    if (nuevas === null) return null;
    return { type: geom.type, coordinates: nuevas };
  }

  function crsDeCoordRefSys(v) {
    if (!v) return null;
    if (Array.isArray(v)) return v.length ? crsDeCoordRefSys(v[0]) : null;
    if (typeof v === 'string') return normalizarCRS(v);
    if (typeof v === 'object' && v.id) return normalizarCRS(v.id);
    return null;
  }

  function parsearWKTConCRS(wkt) {
    if (typeof wkt !== 'string') return null;
    let t = wkt.trim();
    let crs = null;
    const m = /^SRID\s*=\s*(\d+)\s*;\s*(.*)$/i.exec(t);
    if (m) { crs = 'EPSG:' + m[1]; t = m[2].trim(); }
    const g = wktAGeoJSON(t);
    if (!g) return null;
    return { geometry: g, crs: crs };
  }

  /**
   * Extrae una geometría GeoJSON de un valor que puede ser un objeto
   * GeoJSON (geometría, Feature o FeatureCollection), su texto JSON o
   * una cadena WKT (incluido EWKT con SRID=). Devuelve la geometría en
   * EPSG:4326, reproyectando si hace falta.
   * @param {*} valor Valor del campo.
   * @param {string} [crsPorDefecto] CRS por defecto para `place`/coordenadas.
   * @returns {Object|null}
   */
  function geometriaDeValor(valor, crsPorDefecto) {
    if (valor === null || valor === undefined) return null;
    let obj = valor;
    if (typeof obj === 'string') {
      const t = obj.trim();
      if (!t) return null;
      // Comprobar si parece texto WKT (p. ej. POINT(..), POLYGON(..), SRID=...;POINT(..))
      if (esWKT(t)) {
        const parsed = parsearWKTConCRS(t);
        if (parsed) {
          const origen = parsed.crs || crsPorDefecto || 'EPSG:4326';
          return reproyectarGeometria(parsed.geometry, origen, 'EPSG:4326');
        }
      }
      try { obj = JSON.parse(t); } catch (e) { return null; }
    }
    if (!obj || typeof obj !== 'object') return null;
    // FeatureCollection: toma la primera geometría que se pueda resolver.
    if (obj.type === 'FeatureCollection') {
      const crs = crsDeCoordRefSys(obj.coordRefSys) || crsPorDefecto || 'EPSG:4326';
      const feats = Array.isArray(obj.features) ? obj.features : [];
      for (let i = 0; i < feats.length; i++) {
        const g = geometriaDeValor(feats[i], crs);
        if (g) return g;
      }
      return null;
    }
    // Feature: `geometry` (CRS84) tiene prioridad; si no, `place` (CRS del coordRefSys).
    if (obj.type === 'Feature') {
      const crs = crsDeCoordRefSys(obj.coordRefSys) || crsPorDefecto || 'EPSG:4326';
      if (obj.geometry && typeof obj.geometry.type === 'string') {
        return reproyectarGeometria(obj.geometry, 'EPSG:4326', 'EPSG:4326') || obj.geometry;
      }
      if (obj.place && typeof obj.place.type === 'string') {
        const r = reproyectarGeometria(obj.place, crs, 'EPSG:4326');
        return r || obj.place;
      }
      return null;
    }
    // Geometría suelta estándar (Point, MultiPoint, LineString, Polygon, etc.) o GeoJSON-FG.
    if (typeof obj.type === 'string' && (Array.isArray(obj.coordinates) || Array.isArray(obj.geometries))) {
      const crs = crsDeCoordRefSys(obj.coordRefSys) || crsPorDefecto || 'EPSG:4326';
      return reproyectarGeometria(obj, crs, 'EPSG:4326') || obj;
    }
    const crs = crsDeCoordRefSys(obj.coordRefSys) || crsPorDefecto || 'EPSG:4326';
    return reproyectarGeometria(obj, crs, 'EPSG:4326');
  }
  let contador = 0;

  /**
   * Devuelve el espacio de nombres activo de la API (IDEE o M).
   * @returns {Object}
   */
  function api() {
    return window.IDEE || window.M;
  }

  /**
   * ¿Es un objeto plano (no null, no array)?
   * @param {*} v Valor.
   * @returns {boolean}
   */
  function esObjeto(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // -------------------------------------------------------------------
  // Utilidades de datos
  // -------------------------------------------------------------------

  /**
   * Copia los registros para no compartir referencias con quien construye.
   * @param {Array<Object>} entrada Registros.
   * @returns {Array<Object>}
   */
  function normalizarRegistros(entrada) {
    if (!Array.isArray(entrada)) return [];
    return entrada.filter(esObjeto).map(function (r) {
      return Object.assign({}, r);
    });
  }

  /**
   * Infiere el tipo de un valor.
   * @param {*} valor Valor.
   * @returns {string} string|integer|number|boolean|date
   */
  function inferirTipo(valor) {
    if (valor === null || valor === undefined || valor === '') return 'string';
    if (typeof valor === 'number') {
      return Number.isInteger(valor) ? 'integer' : 'number';
    }
    if (typeof valor === 'boolean') return 'boolean';
    const s = String(valor).trim();
    // Los ceros a la izquierda se respetan como texto (códigos, CP, teléfonos).
    if (/^-?\d+$/.test(s) && !/^-?0\d+/.test(s)) return 'integer';
    if (/^-?\d*\.\d+$/.test(s)) return 'number';
    if (/^(true|false)$/i.test(s)) return 'boolean';
    if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(s)) return 'date';
    return 'string';
  }

  /**
   * Construye la lista de campos a partir de los registros.
   * @param {Array<Object>} registros Registros.
   * @returns {Array<Object>} [{ name, type }]
   */
  function inferirCampos(registros) {
    const nombres = [];
    const vistos = Object.create(null);
    registros.forEach(function (r) {
      Object.keys(r).forEach(function (k) {
        if (!vistos[k]) {
          vistos[k] = true;
          nombres.push(k);
        }
      });
    });
    return nombres.map(function (n) {
      let tipo = 'string';
      for (let i = 0; i < registros.length; i++) {
        const t = inferirTipo(registros[i][n]);
        if (t !== 'string') {
          tipo = t;
          break;
        }
      }
      return { name: n, type: tipo };
    });
  }

  /**
   * Convierte un valor de texto a número/booleano cuando es seguro hacerlo.
   * @param {string} s Valor en texto.
   * @returns {*}
   */
  function convertirValor(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).trim();
    if (t === '') return null;
    if (/^-?\d+$/.test(t) && !/^-?0\d+/.test(t)) return Number(t);
    if (/^-?\d*\.\d+$/.test(t)) return Number(t);
    if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
    return s;
  }

  /**
   * Detecta el separador de un CSV mirando la primera línea.
   * @param {string} texto Contenido.
   * @returns {string}
   */
  function detectarSeparador(texto) {
    const primera = (texto.split(/\r?\n/)[0] || '');
    const candidatos = [',', ';', '\t', '|'];
    let mejor = ',';
    let max = -1;
    candidatos.forEach(function (c) {
      const n = primera.split(c).length;
      if (n > max) {
        max = n;
        mejor = c;
      }
    });
    return mejor;
  }

  /**
   * Parser CSV RFC 4180: respeta comillas dobles, comillas escapadas ("")
   * y saltos de línea dentro de un campo.
   * @param {string} texto Contenido.
   * @param {string} [separador] Separador; si falta se detecta.
   * @returns {Array<Array<string>>} Matriz de filas.
   */
  function parsearCSV(texto, separador) {
    if (!texto) return [];
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    const sep = separador || detectarSeparador(texto);
    const filas = [];
    let fila = [];
    let campo = '';
    let entreComillas = false;

    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (entreComillas) {
        if (c === '"') {
          if (texto[i + 1] === '"') {
            campo += '"';
            i++;
          } else {
            entreComillas = false;
          }
        } else {
          campo += c;
        }
      } else if (c === '"') {
        entreComillas = true;
      } else if (c === sep) {
        fila.push(campo);
        campo = '';
      } else if (c === '\n') {
        fila.push(campo);
        campo = '';
        filas.push(fila);
        fila = [];
      } else if (c !== '\r') {
        campo += c;
      }
    }
    // Última fila sin salto final.
    if (campo !== '' || fila.length) {
      fila.push(campo);
      filas.push(fila);
    }
    // Quita filas completamente vacías al final.
    while (filas.length && filas[filas.length - 1].every(function (v) { return v === ''; })) {
      filas.pop();
    }
    return filas;
  }

  /**
   * Convierte una matriz (cabecera + filas) en registros.
   * @param {Array<Array<*>>} filas Matriz.
   * @param {Function} convertir Función de conversión de celda.
   * @returns {{ registros: Array<Object>, campos: Array<Object> }}
   */
  function matrizARegistros(filas, convertir) {
    if (!filas.length) return { registros: [], campos: [] };
    const cabecera = filas[0].map(function (h, i) {
      const nombre = String(h === null || h === undefined ? '' : h).trim();
      return nombre || ('col' + (i + 1));
    });
    const registros = [];
    for (let i = 1; i < filas.length; i++) {
      const f = filas[i];
      if (!f || (f.length === 1 && (f[0] === '' || f[0] === null || f[0] === undefined))) continue;
      const r = {};
      cabecera.forEach(function (h, j) {
        r[h] = convertir(f[j]);
      });
      registros.push(r);
    }
    return { registros: registros, campos: inferirCampos(registros) };
  }

  /**
   * Normaliza una geometría que puede venir como objeto o como texto JSON.
   * @param {*} valor Valor del campo.
   * @returns {Object|null}
   */
  function normalizarGeometria(valor) {
    if (!valor) return null;
    if (esObjeto(valor) && typeof valor.type === 'string') return valor;
    if (typeof valor === 'string') {
      const t = valor.trim();
      if (!t) return null;
      try {
        const g = JSON.parse(t);
        if (g && typeof g.type === 'string') return g;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------
  // XLSX (sin dependencias salvo JSZip, que ya trae el repositorio)
  // -------------------------------------------------------------------

  /**
   * Convierte una referencia de celda (A1, BC12) en índice de columna.
   * @param {string} ref Referencia.
   * @returns {number} Índice 0-based o -1.
   */
  function letraAColumna(ref) {
    const m = /^([A-Z]+)/i.exec(ref || '');
    if (!m) return -1;
    let n = 0;
    const letras = m[1].toUpperCase();
    for (let i = 0; i < letras.length; i++) {
      n = n * 26 + (letras.charCodeAt(i) - 64);
    }
    return n - 1;
  }

  /**
   * Parsea un XML con DOMParser.
   * @param {string} texto XML.
   * @returns {Document}
   */
  function parsearXml(texto) {
    return new DOMParser().parseFromString(texto, 'application/xml');
  }

  /**
   * Lee la tabla de cadenas compartidas de un XLSX.
   * @param {string} xml Contenido de xl/sharedStrings.xml.
   * @returns {Array<string>}
   */
  function leerSharedStrings(xml) {
    if (!xml) return [];
    const doc = parsearXml(xml);
    return Array.from(doc.getElementsByTagName('si')).map(function (si) {
      // Un <si> puede tener varios <t> (texto enriquecido).
      return Array.from(si.getElementsByTagName('t'))
        .map(function (t) { return t.textContent || ''; })
        .join('');
    });
  }

  /**
   * Lee una hoja de cálculo y devuelve la matriz de celdas.
   * @param {string} xml Contenido de xl/worksheets/sheetN.xml.
   * @param {Array<string>} shared Cadenas compartidas.
   * @returns {Array<Array<*>>}
   */
  function leerHoja(xml, shared) {
    const doc = parsearXml(xml);
    const filas = [];
    Array.from(doc.getElementsByTagName('row')).forEach(function (row, indiceFila) {
      const r = Number(row.getAttribute('r'));
      const posFila = (isFinite(r) && r > 0) ? (r - 1) : indiceFila;
      const celdas = [];
      Array.from(row.getElementsByTagName('c')).forEach(function (c) {
        const col = letraAColumna(c.getAttribute('r'));
        const tipo = c.getAttribute('t');
        let valor = '';
        if (tipo === 'inlineStr') {
          valor = Array.from(c.getElementsByTagName('t'))
            .map(function (t) { return t.textContent || ''; })
            .join('');
        } else {
          const v = c.getElementsByTagName('v')[0];
          const bruto = v ? (v.textContent || '') : '';
          if (tipo === 's') {
            valor = shared[Number(bruto)] || '';
          } else if (tipo === 'b') {
            valor = bruto === '1';
          } else if (tipo === 'e') {
            valor = '';
          } else {
            valor = bruto;
          }
        }
        celdas[col >= 0 ? col : celdas.length] = valor;
      });
      filas[posFila >= 0 ? posFila : filas.length] = celdas;
    });
    // Rellena huecos (filas saltadas en el XML).
    for (let i = 0; i < filas.length; i++) {
      if (!filas[i]) filas[i] = [];
    }
    return filas;
  }

  // -------------------------------------------------------------------
  // Clase
  // -------------------------------------------------------------------

  class AlphanumericLayer {

    /**
     * @param {Object} [options]
     * @param {string} [options.name] Nombre de la capa.
     * @param {string} [options.legend] Leyenda (por defecto el nombre).
     * @param {string|Object} [options.source] Origen de los datos (CSV en string, FeatureCollection o configuración { data, idField, ... }).
     * @param {string} [options.url] URL remota de origen de los datos (CSV, JSON, GeoJSON, XLSX).
     * @param {Object} [options.metadata] Metadatos libres.
     */
    constructor(options) {
      const o = options || {};
      contador += 1;
      this.type = 'Alphanumeric';
      this.name = o.name || ('Datos ' + contador);
      this.legend = o.legend || this.name;
      this.id = o.id || ('ALPHANUMERIC_' + Date.now() + '_' + contador);
      this.idLayer = this.id;
      this.isBase = false;
      this.displayInLayerSwitcher = true;

      // Determinación de registros, campos y geometría
      let records = [];
      let geometryField = null;
      let fields = null;
      let idField = null;
      let latField = null;
      let lonField = null;
      let xField = null;
      let yField = null;
      let wktField = null;
      let crs = 'EPSG:4326';

      let config = o;

      // Si se pasa 'source' en el constructor (CSV en string, array, FeatureCollection o config de source)
      if (o.source !== undefined && o.source !== null) {
        let src = o.source;

        // Si source es un objeto de configuración que envuelve la propiedad 'data'
        if (typeof src === 'object' && !Array.isArray(src) && src.type !== 'FeatureCollection' && src.data !== undefined) {
          config = Object.assign({}, o, src);
          src = src.data;
        }

        if (typeof src === 'string') {
          try {
            const parsed = JSON.parse(src);
            const resJSON = AlphanumericLayer._parseJSONData(parsed, config);
            records = resJSON.records;
            if (resJSON.geometryField) geometryField = resJSON.geometryField;
          } catch (e) {
            const resCSV = AlphanumericLayer._parseCSVData(src, config);
            records = resCSV.records;
            if (resCSV.fields) fields = fields || resCSV.fields;
          }
        } else if (Array.isArray(src)) {
          const resJSON = AlphanumericLayer._parseJSONData(src, config);
          records = resJSON.records;
          if (resJSON.geometryField) geometryField = resJSON.geometryField;
        } else if (typeof src === 'object') {
          const resJSON = AlphanumericLayer._parseJSONData(src, config);
          records = resJSON.records;
          if (resJSON.geometryField) geometryField = resJSON.geometryField;
        }
      } else {
        // Fallback clásico: si no se usa source sino direct options
        records = o.records || o.data || [];
        geometryField = o.geometryField || null;
        fields = o.fields || null;
      }

      // Consolidar campos de configuración desde 'config'
      idField = config.idField || null;
      latField = config.latField || null;
      lonField = config.lonField || null;
      xField = config.xField || null;
      yField = config.yField || null;
      wktField = config.wktField || null;
      if (config.geometryField) {
        geometryField = config.geometryField;
      }
      if (config.fields) {
        fields = config.fields;
      }
      crs = config.crs || 'EPSG:4326';

      this._records = normalizarRegistros(records);
      this._fields = Array.isArray(fields) && fields.length
        ? fields.map(function (f) { return { name: f.name, type: f.type || 'string' }; })
        : inferirCampos(this._records);

      this._idField = idField;
      this._latField = latField;
      this._lonField = lonField;
      this._xField = xField;
      this._yField = yField;
      this._wktField = wktField;
      this._geometryField = geometryField;
      this._source = o.source || null;
      this._metadata = o.metadata || {};
      this._crs = crs;
      this._visible = o.visible !== false;
      this._style = o.style || null;
      this._vectorLayer = null;
      this._map = null;

      // Si se pasa 'url' en el constructor, se auto-carga e inicializa asíncronamente
      if (o.url) {
        this.url = o.url;
        const self = this;
        this.ready = fetch(o.url).then(function (r) {
          if (!r.ok) throw new Error('No se pudo descargar ' + o.url + ' (HTTP ' + r.status + ')');
          const ext = (o.url.split('?')[0].split('.').pop() || '').toLowerCase();
          if (ext === 'xlsx' || ext === 'xlsm' || ext === 'ods') {
            return r.arrayBuffer().then(function (b) {
              return AlphanumericLayer.fromXLSX(b, o);
            });
          }
          return r.text().then(function (t) {
            if (ext === 'json' || ext === 'geojson') return AlphanumericLayer.fromJSON(t, o);
            if (ext === 'tsv' || ext === 'txt') return AlphanumericLayer.fromCSV(t, Object.assign({}, o, { separator: '\t' }));
            return AlphanumericLayer.fromCSV(t, o);
          });
        }).then(function (capaInstancia) {
          self._records = capaInstancia.getRecords();
          self._fields = capaInstancia.getFields();
          if (capaInstancia.getGeometryField()) self._geometryField = capaInstancia.getGeometryField();
          try {
            if (self._map) {
              self._renderVectorLayer();
              self._map.fire('alphanumeric:loaded', [self]);
              if (typeof window !== 'undefined' && typeof window.renderLayerList === 'function') {
                window.renderLayerList();
              }
            }
          } catch (e) {}
          return self;
        }).catch(function (e) {
          console.error('[AlphanumericLayer] Error cargando URL:', e);
          try {
            if (self._map) self._map.fire('alphanumeric:error', [self, e]);
          } catch (err) {}
        });
      }
    }

    // -------------------- capa visual interna --------------------

    /**
     * @private
     * Crea o actualiza la capa vectorial asociada en el mapa si la capa tiene geometría.
     */
    _renderVectorLayer() {
      if (!this._map) return;
      const IDEE = api();
      if (!IDEE || !IDEE.layer || !IDEE.layer.GeoJSON) return;

      if (this._vectorLayer) {
        try {
          if (typeof this._map.removeLayers === 'function') {
            this._map.removeLayers(this._vectorLayer);
          }
        } catch (e) { /* noop */ }
        this._vectorLayer = null;
      }

      let fc = null;
      try {
        fc = this.toGeoJSON();
      } catch (e) { fc = null; }

      if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) {
        return;
      }

      const estilo = this._style || (IDEE.style && IDEE.style.Generic ? new IDEE.style.Generic({
        point: { radius: 7, fill: { color: '#0078d4' }, stroke: { color: '#ffffff', width: 2 } }
      }) : null);

      const optsGeoJSON = {
        name: this.name + '__visual',
        legend: this.legend,
        displayInLayerSwitcher: false,
        extract: true,
        source: fc
      };

      try {
        this._vectorLayer = new IDEE.layer.GeoJSON(optsGeoJSON, estilo ? { style: estilo } : undefined);
        this._vectorLayer.displayInLayerSwitcher = false;
        if (typeof this._map.addLayers === 'function') {
          this._map.addLayers(this._vectorLayer);
        }
        if (this._visible === false && typeof this._vectorLayer.setVisible === 'function') {
          this._vectorLayer.setVisible(false);
        }
      } catch (e) {
        console.warn('[AlphanumericLayer] No se pudo instanciar capa vectorial interna:', e);
      }
    }

    // -------------------- contrato de capa --------------------

    /**
     * Registra la capa en el mapa y renderiza sus geometrías si las tiene.
     * @param {Object} map Mapa de la API-IDEE.
     * @returns {AlphanumericLayer}
     */
    addTo(map) {
      if (!map) return this;
      const registro = registroDe(map);
      const yaEsta = registro.some(function (c) {
        return c === this || (c && c.id === this.id);
      }, this);
      if (!yaEsta) registro.push(this);
      this._map = map;
      try {
        map.fire('alphanumeric:added', [this]);
      } catch (e) { /* la API antigua puede no tener fire */ }

      // Si tiene geometría, pintar en el mapa
      this._renderVectorLayer();

      // Avisa al selector de capas para que se repinte.
      try {
        if (typeof window !== 'undefined' && typeof window.renderLayerList === 'function') {
          window.renderLayerList();
        }
      } catch (e) { /* el selector puede no estar montado */ }
      return this;
    }

    /**
     * Quita la capa del registro del mapa y destruye su capa visual.
     * @returns {AlphanumericLayer}
     */
    destroy() {
      if (this._map) {
        if (this._vectorLayer) {
          try {
            if (typeof this._map.removeLayers === 'function') {
              this._map.removeLayers(this._vectorLayer);
            }
          } catch (e) { /* noop */ }
          this._vectorLayer = null;
        }
        const registro = registroDe(this._map);
        const i = registro.indexOf(this);
        if (i >= 0) registro.splice(i, 1);
        try {
          this._map.fire('alphanumeric:removed', [this]);
        } catch (e) { /* noop */ }
      }
      this._map = null;
      try {
        if (typeof window !== 'undefined' && typeof window.renderLayerList === 'function') {
          window.renderLayerList();
        }
      } catch (e) { /* noop */ }
      return this;
    }

    /**
     * Compara por identidad o por id.
     * @param {*} other Otra capa.
     * @returns {boolean}
     */
    equals(other) {
      return other === this || (!!other && other.id === this.id);
    }

    /**
     * Leyenda de la capa.
     * @returns {string}
     */
    getLegend() {
      return this.legend;
    }

    /**
     * Nombre de la capa.
     * @returns {string}
     */
    getName() {
      return this.name;
    }

    /**
     * Id de la capa.
     * @returns {string}
     */
    getId() {
      return this.id;
    }

    /**
     * Visibilidad de la capa (y de su representación en el mapa).
     * @param {boolean} visible Visibilidad.
     * @returns {AlphanumericLayer}
     */
    setVisible(visible) {
      this._visible = visible !== false;
      if (this._vectorLayer && typeof this._vectorLayer.setVisible === 'function') {
        this._vectorLayer.setVisible(this._visible);
      }
      return this;
    }

    /**
     * @returns {boolean}
     */
    isVisible() {
      return this._visible !== false;
    }

    /**
     * Establece el estilo de la representación vectorial en el mapa.
     * @param {*} style Objeto de estilo IDEE.style.*
     * @returns {AlphanumericLayer}
     */
    setStyle(style) {
      this._style = style;
      if (this._vectorLayer && typeof this._vectorLayer.setStyle === 'function') {
        this._vectorLayer.setStyle(style);
      }
      return this;
    }

    /**
     * Estilo actual.
     * @returns {*}
     */
    getStyle() {
      return this._style;
    }

    /**
     * Extensión de la capa.
     * @returns {Array<number>|null}
     */
    getMaxExtent() {
      if (this._vectorLayer && typeof this._vectorLayer.getMaxExtent === 'function') {
        const e = this._vectorLayer.getMaxExtent();
        if (e) return e;
      }
      return this.getGeoExtent();
    }

    /**
     * Implementación nativa: devuelve el impl de la capa vectorial si la tiene.
     * @returns {*|null}
     */
    getImpl() {
      if (this._vectorLayer && typeof this._vectorLayer.getImpl === 'function') {
        return this._vectorLayer.getImpl();
      }
      return null;
    }

    /**
     * z-index: no aplica (no se pinta). Se devuelve null para que los
     * selectores la ordenen al final.
     * @returns {null}
     */
    getZIndex() {
      return null;
    }

    /**
     * No-op: una capa alfanumérica no se pinta, no tiene z-index.
     * @returns {AlphanumericLayer}
     */
    setZIndex() {
      return this;
    }

    /**
     * Una capa sin geometría no tiene extensión en el mapa.
     * @returns {null}
     */
    getOpacity() {
      return 1;
    }

    setOpacity() {
      return this;
    }

    /**
     * Una capa sin geometría no tiene extensión en el mapa.
     * @returns {null}
     */
    getExtent() {
      return null;
    }

    // -------------------- datos --------------------

    /**
     * Registros de la capa.
     * @returns {Array<Object>}
     */
    getRecords() {
      return this._records;
    }

    /**
     * Un registro por índice.
     * @param {number} i Índice.
     * @returns {Object|null}
     */
    getRecord(i) {
      return this._records[i] || null;
    }

    /**
     * Número de registros.
     * @returns {number}
     */
    getCount() {
      return this._records.length;
    }

    /**
     * Campos [{ name, type }].
     * @returns {Array<Object>}
     */
    getFields() {
      return this._fields.map(function (f) { return Object.assign({}, f); });
    }

    /**
     * Nombres de los campos.
     * @returns {Array<string>}
     */
    getFieldNames() {
      return this._fields.map(function (f) { return f.name; });
    }

    /**
     * Origen de los datos (informativo).
     * @returns {Object|null}
     */
    getSource() {
      return this._source;
    }

    /**
     * Metadatos libres.
     * @returns {Object}
     */
    getMetadata() {
      return this._metadata;
    }

    /**
     * ¿Tiene columnas para construir geometrías?
     * @returns {boolean}
     */
    hasGeometry() {
      return !!(this._geometryField || this._wktField || this._xField || this._yField || (this._latField && this._lonField));
    }

    /**
     * Fija las columnas con las que construir geometrías. Es lo que usan las
     * herramientas que cargan un fichero sin saber de antemano si trae
     * lat/lon o un GeoJSON en un campo.
     * @param {Object} campos
     * @param {string} [campos.latField] Campo de latitud (EPSG:4326).
     * @param {string} [campos.lonField] Campo de longitud (EPSG:4326).
     * @param {string} [campos.xField] Campo X (longitud).
     * @param {string} [campos.yField] Campo Y (latitud).
     * @param {string} [campos.wktField] Campo con geometría en WKT.
     * @param {string} [campos.geometryField] Campo con geometría GeoJSON.
     * @returns {AlphanumericLayer}
     */
    setGeoFields(campos) {
      const c = campos || {};
      if (c.latField !== undefined) this._latField = c.latField || null;
      if (c.lonField !== undefined) this._lonField = c.lonField || null;
      if (c.xField !== undefined) this._xField = c.xField || null;
      if (c.yField !== undefined) this._yField = c.yField || null;
      if (c.wktField !== undefined) this._wktField = c.wktField || null;
      if (c.geometryField !== undefined) this._geometryField = c.geometryField || null;
      if (c.crs !== undefined) this._crs = c.crs || this._crs || 'EPSG:4326';
      this._renderVectorLayer();
      return this;
    }

    /**
     * Busca columnas de latitud/longitud por su nombre.
     * @returns {{latField: string|null, lonField: string|null}}
     */
    detectarCamposLatLon() {
      const nombres = this.getFieldNames();
      const lat = nombres.filter(function (n) {
        return /^(lat|latitud|latitude|y)$/i.test(n);
      })[0];
      const lon = nombres.filter(function (n) {
        return /^(lon|lng|long|longitud|longitude|x)$/i.test(n);
      })[0];
      return {
        latField: lat || null,
        lonField: lon || null,
      };
    }

    /**
     * Detecta automáticamente las columnas que pueden convertirse en
     * geometría: GeoJSON, WKT, lat/lon y X/Y.
     * @returns {{geometryField: string|null, wktField: string|null, latField: string|null, lonField: string|null, xField: string|null, yField: string|null}}
     */
    detectarCamposGeo() {
      const nombres = this.getFieldNames();
      const registros = this.getRecords();
      let geometryField = null;
      let wktField = null;

      // 1. Prioridad por nombre estándar si existe y tiene contenido válido
      const camposGeoCandidatos = nombres.filter(function (n) {
        return /^(geometry|geom|the_geom|geojson|__idee_geojson)$/i.test(n);
      });
      for (let k = 0; k < camposGeoCandidatos.length; k++) {
        const n = camposGeoCandidatos[k];
        for (let i = 0; i < Math.min(registros.length, 5); i++) {
          const v = registros[i] && registros[i][n];
          if (v && (typeof v === 'object' || (typeof v === 'string' && (v.trim().charAt(0) === '{' || esWKT(v))))) {
            geometryField = n;
            break;
          }
        }
        if (geometryField) break;
      }

      // 2. Si no se detectó por nombre, explorar todos los campos buscando GeoJSON (objeto o string JSON)
      if (!geometryField) {
        nombres.forEach(function (n) {
          if (geometryField) return;
          for (let i = 0; i < Math.min(registros.length, 5); i++) {
            const v = registros[i] && registros[i][n];
            if (v && typeof v === 'object' && typeof v.type === 'string') {
              geometryField = n;
              return;
            }
            if (typeof v === 'string' && v.trim().charAt(0) === '{') {
              try {
                const g = JSON.parse(v);
                if (g && typeof g.type === 'string') { geometryField = n; return; }
              } catch (e) { /* noop */ }
            }
          }
        });
      }

      // 3. WKT: buscar por nombre candidato (wkt) o por contenido WKT
      const camposWktCandidatos = nombres.filter(function (n) { return /^wkt$/i.test(n); });
      if (camposWktCandidatos.length > 0) {
        wktField = camposWktCandidatos[0];
      }
      if (!geometryField && !wktField) {
        nombres.forEach(function (n) {
          if (wktField) return;
          for (let i = 0; i < Math.min(registros.length, 5); i++) {
            const v = registros[i] && registros[i][n];
            if (esWKT(v)) { wktField = n; return; }
          }
        });
      }

      const latLon = this.detectarCamposLatLon();
      // X/Y por nombre.
      const x = nombres.filter(function (n) { return /^(x|coordx|coord_x|longitud_x)$/i.test(n); })[0];
      const y = nombres.filter(function (n) { return /^(y|coordy|coord_y|latitud_y)$/i.test(n); })[0];
      return {
        geometryField: geometryField,
        wktField: wktField,
        latField: latLon.latField,
        lonField: latLon.lonField,
        xField: x || null,
        yField: y || null,
      };
    }

    /**
     * Añade un campo calculado `__idee_geojson` a los registros a partir
     * de las columnas X/Y (coordenadas en el CRS indicado, por defecto
     * EPSG:4326). Devuelve this para encadenar.
     * @param {string} xField Campo X (longitud).
     * @param {string} yField Campo Y (latitud).
     * @param {Object} [opciones]
     * @param {string} [opciones.crs] CRS de las coordenadas (por defecto EPSG:4326).
     * @returns {AlphanumericLayer}
     */
    anadirGeometriaDesdeXY(xField, yField, opciones) {
      const o = opciones || {};
      this._xField = xField || this._xField;
      this._yField = yField || this._yField;
      const xf = this._xField;
      const yf = this._yField;
      if (!xf || !yf) return this;
      const crs = o.crs || this._crs || 'EPSG:4326';
      this._crs = crs;
      this._records.forEach(function (r) {
        const x = Number(r[xf]);
        const y = Number(r[yf]);
        if (!isFinite(x) || !isFinite(y)) return;
        let lon = x, lat = y;
        if (normalizarCRS(crs) !== 'EPSG:4326') {
          const p = reproyectarPunto([x, y], crs, 'EPSG:4326');
          if (!p) return;
          lon = p[0]; lat = p[1];
        } else if (!(Math.abs(x) <= 180 && Math.abs(y) <= 90)) {
          return;
        }
        r.__idee_geojson = JSON.stringify({ type: 'Point', coordinates: [lon, lat] });
      });
      this._geometryField = '__idee_geojson';
      this._fields = inferirCampos(this._records);
      this._renderVectorLayer();
      return this;
    }

    /**
     * Añade un campo calculado `__idee_geojson` a partir de un campo WKT.
     * @param {string} campo Campo con texto WKT.
     * @returns {AlphanumericLayer}
     */
    anadirGeometriaDesdeWKT(campo, opciones) {
      const o = opciones || {};
      if (!campo) return this;
      this._wktField = campo;
      const crsPorDefecto = o.crs || this._crs || 'EPSG:4326';
      this._crs = crsPorDefecto;
      this._records.forEach(function (r) {
        const g = geometriaDeValor(r[campo], crsPorDefecto);
        if (g) r.__idee_geojson = JSON.stringify(g);
      });
      this._geometryField = '__idee_geojson';
      this._fields = inferirCampos(this._records);
      this._renderVectorLayer();
      return this;
    }

    /**
     * Añade un campo calculado `__idee_geojson` a partir de un campo que
     * ya contiene GeoJSON (lo normaliza si viene como objeto).
     * @param {string} campo Campo con GeoJSON.
     * @returns {AlphanumericLayer}
     */
    anadirGeometriaDesdeGeoJSON(campo, opciones) {
      const o = opciones || {};
      if (!campo) return this;
      const crsPorDefecto = o.crs || this._crs || 'EPSG:4326';
      this._crs = crsPorDefecto;
      this._records.forEach(function (r) {
        const g = geometriaDeValor(r[campo], crsPorDefecto);
        if (g) r.__idee_geojson = JSON.stringify(g);
      });
      this._geometryField = '__idee_geojson';
      this._fields = inferirCampos(this._records);
      this._renderVectorLayer();
      return this;
    }

    /**
     * Convierte uno o varios campos en geometría, según el formato indicado.
     * @param {string} formato 'xy' | 'wkt' | 'geojson' | 'auto' | 'none'
     * @param {Object} [opciones]
     * @param {string} [opciones.xField] Campo X (para 'xy').
     * @param {string} [opciones.yField] Campo Y (para 'xy').
     * @param {string} [opciones.field] Campo origen (para 'wkt'/'geojson').
     * @returns {AlphanumericLayer}
     */
    convertirCampoAGeometria(formato, opciones) {
      const o = opciones || {};
      if (formato === 'none' || formato === '') {
        this._xField = null;
        this._yField = null;
        this._latField = null;
        this._lonField = null;
        this._wktField = null;
        this._geometryField = null;
        this._records.forEach(function (r) {
          if (r.__idee_geojson) delete r.__idee_geojson;
        });
        this._fields = inferirCampos(this._records);
        this._renderVectorLayer();
        return this;
      }
      if (formato === 'xy') {
        return this.anadirGeometriaDesdeXY(o.xField, o.yField, { crs: o.crs });
      }
      if (formato === 'wkt') {
        return this.anadirGeometriaDesdeWKT(o.field, { crs: o.crs });
      }
      if (formato === 'geojson') {
        return this.anadirGeometriaDesdeGeoJSON(o.field, { crs: o.crs });
      }
      if (formato === 'auto') {
        const det = this.detectarCamposGeo();
        if (det.geometryField) return this.anadirGeometriaDesdeGeoJSON(det.geometryField, { crs: o.crs });
        if (det.wktField) return this.anadirGeometriaDesdeWKT(det.wktField, { crs: o.crs });
        if (det.xField && det.yField) return this.anadirGeometriaDesdeXY(det.xField, det.yField, { crs: o.crs });
        if (det.latField && det.lonField) return this.anadirGeometriaDesdeXY(det.lonField, det.latField, { crs: o.crs });
        return this;
      }
      return this;
    }

    /**
     * Devuelve una copia filtrada de la capa.
     * @param {Function} fn Predicado (registro, índice).
     * @returns {AlphanumericLayer}
     */
    filter(fn) {
      const registros = this._records.filter(fn);
      return new AlphanumericLayer({
        name: this.name,
        legend: this.legend,
        records: registros,
        fields: this.getFields(),
        idField: this._idField,
        latField: this._latField,
        lonField: this._lonField,
        geometryField: this._geometryField,
        xField: this._xField,
        yField: this._yField,
        wktField: this._wktField,
        crs: this._crs,
        source: this._source,
        metadata: this._metadata,
      });
    }

    /**
     * Construye un FeatureCollection a partir de los registros.
     *
     * Orden de resolución de la geometría por registro:
     *   1. campo GeoJSON o WKT (objeto o texto),
     *   2. columnas lat/lon o X/Y (EPSG:4326 o CRS configurado).
     *
     * @param {Object} [opciones]
     * @param {string} [opciones.geometryField] Campo con GeoJSON/WKT.
     * @param {string} [opciones.wktField] Campo con WKT.
     * @param {string} [opciones.latField] Campo de latitud.
     * @param {string} [opciones.lonField] Campo de longitud.
     * @returns {Object} FeatureCollection.
     */
    toGeoJSON(opciones) {
      const o = opciones || {};
      let campoGeo = o.geometryField || this._geometryField || null;
      let campoLat = o.latField || this._latField || o.yField || this._yField || null;
      let campoLon = o.lonField || this._lonField || o.xField || this._xField || null;
      let campoWKT = o.wktField || this._wktField || null;
      const idField = o.idField || this._idField;
      const crsPorDefecto = o.crs || this._crs || 'EPSG:4326';
      const crsXY = o.crs || this._crs || 'EPSG:4326';
      const features = [];

      // Auto-detección si no se configuró ningún campo
      if (!campoGeo && !campoWKT && !(campoLat && campoLon)) {
        const auto = this.detectarCamposGeo();
        if (auto.geometryField) campoGeo = auto.geometryField;
        else if (auto.wktField) campoWKT = auto.wktField;
        else if (auto.latField && auto.lonField) {
          campoLat = auto.latField;
          campoLon = auto.lonField;
        } else if (auto.xField && auto.yField) {
          campoLon = auto.xField;
          campoLat = auto.yField;
        }
      }
      if (!campoGeo) campoGeo = '__idee_geojson';

      this._records.forEach(function (r) {
        // 1) GeoJSON o WKT en el campo de geometría (geometriaDeValor soporta ambos).
        let geometria = geometriaDeValor(r[campoGeo], crsPorDefecto);
        // 2) Si no, comprobar propiedades directas estándar como geometry / geom / the_geom
        if (!geometria && r.geometry !== undefined) {
          geometria = geometriaDeValor(r.geometry, crsPorDefecto);
        }
        if (!geometria && r.geom !== undefined) {
          geometria = geometriaDeValor(r.geom, crsPorDefecto);
        }
        // 3) WKT
        if (!geometria && campoWKT && r[campoWKT]) {
          geometria = geometriaDeValor(r[campoWKT], crsPorDefecto);
        }
        if (!geometria && r.wkt !== undefined) {
          geometria = geometriaDeValor(r.wkt, crsPorDefecto);
        }
        // 4) Lat/lon (EPSG:4326) o X/Y (CRS elegido).
        if (!geometria && campoLat && campoLon) {
          const a = Number(r[campoLat]);
          const b = Number(r[campoLon]);
          // Distingue lat/lon (rango pequeño) de X/Y proyectadas.
          if (isFinite(a) && isFinite(b)) {
            if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
              geometria = { type: 'Point', coordinates: [b, a] };
            } else if (normalizarCRS(crsXY) !== 'EPSG:4326') {
              const p = reproyectarPunto([b, a], crsXY, 'EPSG:4326');
              if (p) geometria = { type: 'Point', coordinates: [p[0], p[1]] };
            }
          }
        }
        if (!geometria) return;
        const propiedades = {};
        Object.keys(r).forEach(function (k) {
          if (k !== campoGeo && k !== '__idee_geojson' && k !== '__idee_id' && k !== 'geometry' && k !== 'geom') {
            propiedades[k] = r[k];
          }
        });
        const f = { type: 'Feature', properties: propiedades, geometry: geometria };
        if (idField && r[idField] !== undefined && r[idField] !== null) {
          f.id = r[idField];
        } else if (r.__idee_id !== undefined && r.__idee_id !== null) {
          f.id = r.__idee_id;
        }
        features.push(f);
      });

      return { type: 'FeatureCollection', features: features };
    }

    /**
     * Extensión de las geometrías en CRS84 (lon/lat), si las hay.
     * @returns {Array<number>|null} [minx, miny, maxx, maxy]
     */
    getGeoExtent() {
      const fc = this.toGeoJSON();
      let minx = Infinity;
      let miny = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      function recorrer(coords) {
        if (typeof coords[0] === 'number') {
          minx = Math.min(minx, coords[0]);
          maxx = Math.max(maxx, coords[0]);
          miny = Math.min(miny, coords[1]);
          maxy = Math.max(maxy, coords[1]);
          return;
        }
        coords.forEach(recorrer);
      }
      fc.features.forEach(function (f) {
        if (f.geometry && f.geometry.coordinates) recorrer(f.geometry.coordinates);
      });
      if (!isFinite(minx)) return null;
      return [minx, miny, maxx, maxy];
    }

    /**
     * Serializa la capa a CSV (RFC 4180).
     * @param {Object} [opciones]
     * @param {string} [opciones.separator] Separador.
     * @returns {string}
     */
    toCSV(opciones) {
      const sep = (opciones && opciones.separator) || ',';
      const nombres = this.getFieldNames();
      function celda(v) {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        if (s.indexOf(sep) >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }
      const lineas = [nombres.map(celda).join(sep)];
      this._records.forEach(function (r) {
        lineas.push(nombres.map(function (n) { return celda(r[n]); }).join(sep));
      });
      return lineas.join('\n');
    }

    /**
     * Representación serializable (para el contrato de estado).
     * @returns {Object}
     */
    toJSON() {
      return {
        name: this.name,
        legend: this.legend,
        records: this._records,
        fields: this.getFields(),
        idField: this._idField,
        latField: this._latField,
        lonField: this._lonField,
        geometryField: this._geometryField,
        xField: this._xField,
        yField: this._yField,
        wktField: this._wktField,
        crs: this._crs,
        source: this._source,
        metadata: this._metadata,
      };
    }

    /**
     * @private
     */
    static _parseCSVData(texto, o) {
      const filas = parsearCSV(texto, o.separator);
      const res = matrizARegistros(filas, convertirValor);
      return {
        records: res.registros,
        fields: res.campos
      };
    }

    /**
     * @private
     */
    static _parseJSONData(datos, o) {
      let obj = datos;
      if (typeof obj === 'string') obj = JSON.parse(obj);
      let registros = [];
      let geometryField = o.geometryField || null;

      if (Array.isArray(obj)) {
        // Comprobar si los elementos parecen GeoJSON Features estándar
        const areFeatures = obj.length > 0 && obj.every(function (f) {
          return f && (f.type === 'Feature' || (f.properties !== undefined && f.geometry !== undefined));
        });

        if (areFeatures) {
          geometryField = geometryField || '__idee_geojson';
          registros = obj.map(function (f) {
            const props = Object.assign({}, f.properties || {});
            if (f.geometry && typeof f.geometry.type === 'string') {
              props.__idee_geojson = JSON.stringify(f.geometry);
            } else if (f.place && typeof f.place.type === 'string') {
              const crsFC = o.crs || 'EPSG:4326';
              const gg = reproyectarGeometria(f.place, crsDeCoordRefSys(f.coordRefSys) || crsFC, 'EPSG:4326');
              if (gg) props.__idee_geojson = JSON.stringify(gg);
            }
            if (f.id !== undefined) props.__idee_id = f.id;
            return props;
          });
        } else {
          registros = obj;
          // Si los registros planos traen campo geometry, geom o wkt y no se especificó geometryField
          if (!geometryField && obj.length > 0) {
            for (let i = 0; i < Math.min(obj.length, 5); i++) {
              const item = obj[i];
              if (item && item.geometry !== undefined) { geometryField = 'geometry'; break; }
              if (item && item.geom !== undefined) { geometryField = 'geom'; break; }
              if (item && item.wkt !== undefined) { geometryField = 'wkt'; break; }
            }
          }
        }
      } else if (obj && obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
        geometryField = geometryField || '__idee_geojson';
        registros = obj.features.map(function (f) {
          const props = Object.assign({}, f.properties || {});
          if (f.geometry && typeof f.geometry.type === 'string') props.__idee_geojson = JSON.stringify(f.geometry);
          else if (f.place && typeof f.place.type === 'string') {
            const crsFC = crsDeCoordRefSys(obj.coordRefSys) || o.crs || 'EPSG:4326';
            const gg = reproyectarGeometria(f.place, crsDeCoordRefSys(f.coordRefSys) || crsFC, 'EPSG:4326');
            if (gg) props.__idee_geojson = JSON.stringify(gg);
          }
          if (f.id !== undefined) props.__idee_id = f.id;
          return props;
        });
      } else if (obj && Array.isArray(obj.records || obj.data || obj.rows)) {
        registros = obj.records || obj.data || obj.rows;
      } else {
        throw new Error('JSON no reconocido: se espera un array, un FeatureCollection o { records }');
      }

      return {
        records: registros,
        geometryField: geometryField
      };
    }

    // -------------------- constructores estáticos --------------------

    /**
     * Crea una capa desde un CSV.
     * @param {string} texto Contenido.
     * @param {Object} [opciones]
     * @returns {AlphanumericLayer}
     */
    static fromCSV(texto, opciones) {
      const o = opciones || {};
      const res = AlphanumericLayer._parseCSVData(texto, o);
      if (!res.records.length) {
        throw new Error('El CSV no contiene filas de datos');
      }
      return new AlphanumericLayer({
        name: o.name,
        legend: o.legend,
        records: res.records,
        fields: res.fields,
        idField: o.idField,
        latField: o.latField,
        lonField: o.lonField,
        xField: o.xField,
        yField: o.yField,
        wktField: o.wktField,
        geometryField: o.geometryField,
        crs: o.crs,
        source: o.source,
      });
    }

    /**
     * Crea una capa desde JSON:: array de objetos, { records }, o GeoJSON.
     * @param {string|Object} datos JSON o texto.
     * @param {Object} [opciones]
     * @returns {AlphanumericLayer}
     */
    static fromJSON(datos, opciones) {
      const o = opciones || {};
      const res = AlphanumericLayer._parseJSONData(datos, o);
      return new AlphanumericLayer({
        name: o.name,
        legend: o.legend,
        records: res.records,
        fields: o.fields,
        idField: o.idField,
        latField: o.latField,
        lonField: o.lonField,
        geometryField: res.geometryField,
        xField: o.xField,
        yField: o.yField,
        wktField: o.wktField,
        crs: o.crs,
        source: o.source,
      });
    }

    /**
     * Crea una capa desde un XLSX (primera hoja o la indicada).
     * Necesita JSZip cargado en la página (`window.JSZip`).
     * @param {ArrayBuffer|Blob} fichero Contenido del .xlsx.
     * @param {Object} [opciones]
     * @returns {Promise<AlphanumericLayer>}
     */
    static fromXLSX(fichero, opciones) {
      const o = opciones || {};
      const JSZip = window.JSZip;
      if (!JSZip) {
        return Promise.reject(new Error('Falta JSZip: carga js/jsZIP/jszip.min.js para leer XLSX'));
      }
      const promesaBuffer = (fichero instanceof Blob)
        ? fichero.arrayBuffer()
        : Promise.resolve(fichero);

      return promesaBuffer.then(function (buffer) {
        return JSZip.loadAsync(buffer);
      }).then(function (zip) {
        // Hoja: por nombre/ruta si se indica, si no la primera del libro.
        let rutaHoja = o.sheet ? String(o.sheet) : null;
        const tareaWorkbook = zip.file('xl/workbook.xml');
        const tareaRels = zip.file('xl/_rels/workbook.xml.rels');

        const leerWorkbook = tareaWorkbook ? tareaWorkbook.async('string') : Promise.resolve('');
        const leerRels = tareaRels ? tareaRels.async('string') : Promise.resolve('');

        return Promise.all([leerWorkbook, leerRels]).then(function (partes) {
          if (!rutaHoja && partes[0]) {
            const doc = parsearXml(partes[0]);
            const hojas = Array.from(doc.getElementsByTagName('sheet'));
            const indice = Math.max(0, Number(o.sheetIndex) || 0);
            const hoja = hojas[indice];
            if (hoja) {
              const rid = hoja.getAttribute('r:id')
                || hoja.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
              if (rid && partes[1]) {
                const relsDoc = parsearXml(partes[1]);
                const rel = Array.from(relsDoc.getElementsByTagName('Relationship')).filter(function (r) {
                  return r.getAttribute('Id') === rid;
                })[0];
                if (rel) {
                  const destino = rel.getAttribute('Target') || '';
                  rutaHoja = destino.charAt(0) === '/'
                    ? destino.slice(1)
                    : ('xl/' + destino.replace(/^\.\//, ''));
                }
              }
            }
          }
          if (!rutaHoja) rutaHoja = 'xl/worksheets/sheet1.xml';

          const tareaShared = zip.file('xl/sharedStrings.xml');
          const tareaHoja = zip.file(rutaHoja);
          if (!tareaHoja) {
            throw new Error('No se encontró la hoja ' + rutaHoja + ' en el XLSX');
          }
          return Promise.all([
            tareaShared ? tareaShared.async('string') : Promise.resolve(''),
            tareaHoja.async('string'),
          ]);
        });
      }).then(function (partes) {
        const shared = leerSharedStrings(partes[0]);
        const filas = leerHoja(partes[1], shared);
        const res = matrizARegistros(filas, convertirValor);
        if (!res.registros.length) {
          throw new Error('El XLSX no contiene filas de datos');
        }
        return new AlphanumericLayer({
          name: o.name,
          legend: o.legend,
          records: res.registros,
          fields: res.campos,
          idField: o.idField,
          latField: o.latField,
          lonField: o.lonField,
          geometryField: o.geometryField,
          xField: o.xField,
          yField: o.yField,
          wktField: o.wktField,
          crs: o.crs,
          source: o.source,
        });
      });
    }

    /**
     * Crea una capa desde una URL (CSV, JSON, GeoJSON o XLSX).
     * @param {string} url URL.
     * @param {Object} [opciones]
     * @returns {Promise<AlphanumericLayer>}
     */
    static fromURL(url, opciones) {
      const o = opciones || {};
      const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('No se pudo descargar ' + url + ' (HTTP ' + r.status + ')');
        if (ext === 'xlsx' || ext === 'xlsm' || ext === 'ods') return r.arrayBuffer().then(function (b) { return AlphanumericLayer.fromXLSX(b, o); });
        return r.text().then(function (t) {
          if (ext === 'json' || ext === 'geojson') return AlphanumericLayer.fromJSON(t, o);
          if (ext === 'tsv' || ext === 'txt') return AlphanumericLayer.fromCSV(t, Object.assign({}, o, { separator: '\\t' }));
          return AlphanumericLayer.fromCSV(t, o);
        });
      });
    }
  }

  // -------------------------------------------------------------------
  // Registro de capas alfanuméricas por mapa
  // -------------------------------------------------------------------

  /**
   * Devuelve (y crea si hace falta) el registro del mapa, parcheando en la
   * instancia los métodos de acceso. No se toca el prototipo de la API.
   * @param {Object} map Mapa.
   * @returns {Array<AlphanumericLayer>}
   */
  function registroDe(map) {
    if (!map.__alphanumericLayers) {
      map.__alphanumericLayers = [];
      if (typeof map.getAlphanumericLayers !== 'function') {
        map.getAlphanumericLayers = function () {
          return (this.__alphanumericLayers || []).slice();
        };
      }
      if (typeof map.addAlphanumericLayer !== 'function') {
        map.addAlphanumericLayer = function (capa) {
          if (capa && typeof capa.addTo === 'function') capa.addTo(this);
          return this;
        };
      }
      if (typeof map.removeAlphanumericLayer !== 'function') {
        map.removeAlphanumericLayer = function (capa) {
          if (capa && typeof capa.destroy === 'function') capa.destroy();
          return this;
        };
      }
    }
    return map.__alphanumericLayers;
  }

  // -------------------------------------------------------------------
  // IDEE.layer.BigQuery: capa alfanumérica con origen BigQuery
  // -------------------------------------------------------------------
  // Una capa alfanumérica cuyos registros vienen de BigQuery. Además de
  // los datos, guarda la sentencia SQL y los parámetros de conexión, y
  // ofrece `ejecutarSQL(sql, token)` para volver a consultar (con una SQL
  // nueva o la misma) y actualizar los registros.
  class BigQueryLayer extends AlphanumericLayer {
    constructor(options) {
      const o = options || {};
      super(Object.assign({}, o, {
        source: Object.assign({ type: 'bigquery' }, o.source || {}),
      }));
      this.type = 'BigQuery';
      this.sql = o.sql || '';
      this.proyecto = o.proyecto || '';
      this.dataset = o.dataset || '';
      this.tabla = o.tabla || '';
      this.limite = Math.max(1, Math.min(Number(o.limite) || 10000, 100000));
      this.latField = o.latField || this._latField || null;
      this.lonField = o.lonField || this._lonField || null;
      this.geometryField = o.geometryField || this._geometryField || null;
      if (this.latField) this._latField = this.latField;
      if (this.lonField) this._lonField = this.lonField;
      if (this.geometryField) this._geometryField = this.geometryField;
    }

    getSQL() { return this.sql; }
    setSQL(sql) { this.sql = sql || ''; return this; }

    /**
     * Ejecuta una sentencia SQL contra BigQuery y actualiza los registros
     * de la capa. Necesita un token de acceso válido.
     * @param {string} [sql] SQL a ejecutar (por defecto la guardada).
     * @param {string} [token] Token de acceso de Google.
     * @param {Object} [opciones] { maxResults, geometryField }
     * @returns {Promise<BigQueryLayer>}
     */
    ejecutarSQL(sql, token, opciones) {
      const self = this;
      const o = opciones || {};
      const sqlFinal = sql || this.sql;
      if (!sqlFinal) return Promise.reject(new Error('Falta la sentencia SQL'));
      if (!token) return Promise.reject(new Error('Falta el token de acceso de Google'));
      if (!this.proyecto) return Promise.reject(new Error('Falta el proyecto de BigQuery'));

      const cuerpo = {
        query: sqlFinal,
        useLegacySql: false,
        maxResults: o.maxResults || this.limite,
        timeoutMs: 10000,
      };
      return fetch('https://bigquery.googleapis.com/bigquery/v2/projects/'
        + encodeURIComponent(this.proyecto) + '/queries', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      }).then(function (r) {
        return r.text().then(function (texto) {
          let j = null;
          try { j = texto ? JSON.parse(texto) : null; } catch (e) { j = null; }
          if (!r.ok) {
            const msg = (j && j.error && (j.error.message || j.error.status)) || ('HTTP ' + r.status);
            throw new Error(msg);
          }
          return j;
        });
      }).then(function (res) {
        // Convierte las filas al formato { f: [{v}] } -> objetos.
        const campos = (res.schema && res.schema.fields) || [];
        const filas = (res.rows || []).map(function (row) {
          const obj = {};
          const celdas = (row && row.f) || [];
          campos.forEach(function (campo, i) {
            let v = celdas[i] ? celdas[i].v : null;
            if (campo.type === 'INTEGER' || campo.type === 'INT64' || campo.type === 'FLOAT' || campo.type === 'FLOAT64') {
              if (v !== null && v !== undefined) v = Number(v);
            }
            obj[campo.name] = v;
          });
          return obj;
        });
        // Actualiza los registros y campos de la capa.
        self._records = filas.map(function (r) { return Object.assign({}, r); });
        self._fields = campos.length ? campos.map(function (c) { return { name: c.name, type: (c.type || 'string').toLowerCase() }; }) : inferirCampos(self._records);
        self.sql = sqlFinal;
        // Geometría: si hay campo GeoJSON o lat/lon, se deja preparado.
        if (o.geometryField) self._geometryField = o.geometryField;
        if (o.latField) self._latField = o.latField;
        if (o.lonField) self._lonField = o.lonField;
        return self;
      });
    }
  }

  // Instalación de BigQueryLayer
  function instalarBigQueryLayer() {
    const targets = [];
    if (window.IDEE) targets.push(window.IDEE);
    if (window.M && window.M !== window.IDEE) targets.push(window.M);
    if (!targets.length) return false;
    targets.forEach(function (A) {
      if (!A.layer) A.layer = {};
      A.layer.BigQuery = BigQueryLayer;
      A.layer.bigQuery = BigQueryLayer;
    });
    return true;
  }
  BigQueryLayer.instalar = instalarBigQueryLayer;
  instalarBigQueryLayer();
  let intentosBQ = 0;
  const temporizadorBQ = setInterval(function () {
    if (instalarBigQueryLayer() || ++intentosBQ > 200) clearInterval(temporizadorBQ);
  }, 10);

  /**
   * Instala la clase en `IDEE.layer` / `M.layer`. Es idempotente y hay que
   * volver a llamarla después de cada recarga del bundle (cambio 2D/3D),
   * porque la API recrea su espacio de nombres.
   * @returns {boolean}
   */
  function instalar() {
    const targets = [];
    if (window.IDEE) targets.push(window.IDEE);
    if (window.M && window.M !== window.IDEE) targets.push(window.M);
    if (!targets.length) return false;
    targets.forEach(function (A) {
      if (!A.layer) A.layer = {};
      A.layer.Alphanumeric = AlphanumericLayer;
      A.layer.alphanumeric = AlphanumericLayer;
    });
    return true;
  }

  AlphanumericLayer.instalar = instalar;
  AlphanumericLayer.registroDe = registroDe;

  // Instalación inmediata y reintento breve por si el bundle aún no está.
  instalar();
  let intentos = 0;
  const temporizador = setInterval(function () {
    if (instalar() || ++intentos > 200) clearInterval(temporizador);
  }, 10);

  // Reinstalación cuando el bundle de la API se recarga (cambio 2D/3D): el
  // espacio de nombres IDEE/M se recrea desde cero y hay que volver a colgar
  // la clase como IDEE.layer (y M.layer), nunca como plugin.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      const obj = e && e.target;
      if (obj && obj.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(obj.src || '')) {
        instalar();
        instalarBigQueryLayer();
      }
    }, true);
  }

  // Exposición triple (window + IDEE + M).
  if (typeof window !== 'undefined') {
    window.AlphanumericLayer = AlphanumericLayer;
    window.BigQueryLayer = BigQueryLayer;
    window.IDEE = window.IDEE || {};
    window.IDEE.layer = window.IDEE.layer || {};
    window.IDEE.layer.Alphanumeric = AlphanumericLayer;
    window.IDEE.layer.alphanumeric = AlphanumericLayer;
    window.IDEE.layer.BigQuery = BigQueryLayer;
    window.IDEE.layer.bigQuery = BigQueryLayer;
    window.M = window.M || {};
    window.M.layer = window.M.layer || {};
    window.M.layer.Alphanumeric = AlphanumericLayer;
    window.M.layer.alphanumeric = AlphanumericLayer;
    window.M.layer.BigQuery = BigQueryLayer;
    window.M.layer.bigQuery = BigQueryLayer;
  }

  if (typeof window !== 'undefined') {
    window.AlphanumericTestables = window.AlphanumericTestables || {};
    Object.assign(window.AlphanumericTestables, {
      wktAGeoJSON: (typeof wktAGeoJSON === 'function') ? wktAGeoJSON : undefined,
      esWKT: (typeof esWKT === 'function') ? esWKT : undefined,
      normalizarCRS: (typeof normalizarCRS === 'function') ? normalizarCRS : undefined,
      reproyectarPunto: (typeof reproyectarPunto === 'function') ? reproyectarPunto : undefined,
      geometriaDeValor: (typeof geometriaDeValor === 'function') ? geometriaDeValor : undefined,
      inferirTipo: (typeof inferirTipo === 'function') ? inferirTipo : undefined,
      inferirCampos: (typeof inferirCampos === 'function') ? inferirCampos : undefined,
      normalizarRegistros: (typeof normalizarRegistros === 'function') ? normalizarRegistros : undefined,
      detectarSeparador: (typeof detectarSeparador === 'function') ? detectarSeparador : undefined,
      parsearCSV: (typeof parsearCSV === 'function') ? parsearCSV : undefined,
      matrizARegistros: (typeof matrizARegistros === 'function') ? matrizARegistros : undefined,
      convertirValor: (typeof convertirValor === 'function') ? convertirValor : undefined,
      normalizarGeometria: (typeof normalizarGeometria === 'function') ? normalizarGeometria : undefined,
      crsDeCoordRefSys: (typeof crsDeCoordRefSys === 'function') ? crsDeCoordRefSys : undefined
    });
  }
})();
