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

  /** Contador para ids estables dentro de la sesión. */
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
     * @param {Array<Object>} [options.records] Registros.
     * @param {Array<Object>} [options.fields] Campos [{ name, type }].
     * @param {string} [options.idField] Campo identificador.
     * @param {string} [options.latField] Campo de latitud (EPSG:4326).
     * @param {string} [options.lonField] Campo de longitud (EPSG:4326).
     * @param {string} [options.geometryField] Campo con geometría GeoJSON.
     * @param {Object} [options.source] Origen de los datos (informativo).
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
      this._records = normalizarRegistros(o.records || o.data || []);
      this._fields = Array.isArray(o.fields) && o.fields.length
        ? o.fields.map(function (f) { return { name: f.name, type: f.type || 'string' }; })
        : inferirCampos(this._records);
      this._idField = o.idField || null;
      this._latField = o.latField || null;
      this._lonField = o.lonField || null;
      this._geometryField = o.geometryField || null;
      this._source = o.source || null;
      this._metadata = o.metadata || {};
      this._crs = o.crs || 'EPSG:4326';
      this._visible = o.visible !== false;
      this._map = null;
    }

    // -------------------- contrato de capa --------------------

    /**
     * Registra la capa en el mapa. No pinta nada: es una capa de datos.
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
      return this;
    }

    /**
     * Quita la capa del registro del mapa.
     * @returns {AlphanumericLayer}
     */
    destroy() {
      if (this._map) {
        const registro = registroDe(this._map);
        const i = registro.indexOf(this);
        if (i >= 0) registro.splice(i, 1);
        try {
          this._map.fire('alphanumeric:removed', [this]);
        } catch (e) { /* noop */ }
      }
      this._map = null;
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
     * Visibilidad lógica (no hay nada que ocultar en el mapa).
     * @param {boolean} visible Visibilidad.
     * @returns {AlphanumericLayer}
     */
    setVisible(visible) {
      this._visible = visible !== false;
      return this;
    }

    /**
     * @returns {boolean}
     */
    isVisible() {
      return this._visible;
    }

    /**
     * Implementación nativa: una capa alfanumérica no tiene impl en
     * OpenLayers ni en Cesium (no se pinta en el mapa). Devuelve null para
     * que los selectores de capas la traten como capa de datos.
     * @returns {null}
     */
    getImpl() {
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
      return !!(this._geometryField || (this._latField && this._lonField));
    }

    /**
     * Fija las columnas con las que construir geometrías. Es lo que usan las
     * herramientas que cargan un fichero sin saber de antemano si trae
     * lat/lon o un GeoJSON en un campo.
     * @param {Object} campos
     * @param {string} [campos.latField] Campo de latitud (EPSG:4326).
     * @param {string} [campos.lonField] Campo de longitud (EPSG:4326).
     * @param {string} [campos.geometryField] Campo con geometría GeoJSON.
     * @returns {AlphanumericLayer}
     */
    setGeoFields(campos) {
      const c = campos || {};
      if (c.latField !== undefined) this._latField = c.latField || null;
      if (c.lonField !== undefined) this._lonField = c.lonField || null;
      if (c.geometryField !== undefined) this._geometryField = c.geometryField || null;
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
        source: this._source,
        metadata: this._metadata,
      });
    }

    /**
     * Construye un FeatureCollection a partir de los registros.
     *
     * Orden de resolución de la geometría por registro:
     *   1. campo GeoJSON (objeto o texto),
     *   2. columnas lat/lon (EPSG:4326).
     *
     * @param {Object} [opciones]
     * @param {string} [opciones.geometryField] Campo con GeoJSON.
     * @param {string} [opciones.latField] Campo de latitud.
     * @param {string} [opciones.lonField] Campo de longitud.
     * @returns {Object} FeatureCollection.
     */
    toGeoJSON(opciones) {
      const o = opciones || {};
      const campoGeo = o.geometryField || this._geometryField || '__idee_geojson';
      const campoLat = o.latField || this._latField;
      const campoLon = o.lonField || this._lonField;
      const idField = o.idField || this._idField;
      const features = [];

      this._records.forEach(function (r) {
        let geometria = normalizarGeometria(r[campoGeo]);
        if (!geometria && campoLat && campoLon) {
          const lat = Number(r[campoLat]);
          const lon = Number(r[campoLon]);
          if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            geometria = { type: 'Point', coordinates: [lon, lat] };
          }
        }
        if (!geometria) return;
        const propiedades = {};
        Object.keys(r).forEach(function (k) {
          if (k !== campoGeo) propiedades[k] = r[k];
        });
        const f = { type: 'Feature', properties: propiedades, geometry: geometria };
        if (idField && r[idField] !== undefined && r[idField] !== null) {
          f.id = r[idField];
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
        source: this._source,
        metadata: this._metadata,
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
      const filas = parsearCSV(texto, o.separator);
      const res = matrizARegistros(filas, convertirValor);
      if (!res.registros.length) {
        throw new Error('El CSV no contiene filas de datos');
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
        source: o.source,
      });
    }

    /**
     * Crea una capa desde JSON: array de objetos, { records }, o GeoJSON.
     * @param {string|Object} datos JSON o texto.
     * @param {Object} [opciones]
     * @returns {AlphanumericLayer}
     */
    static fromJSON(datos, opciones) {
      const o = opciones || {};
      let obj = datos;
      if (typeof obj === 'string') obj = JSON.parse(obj);
      let registros = [];
      let geometryField = o.geometryField || null;

      if (Array.isArray(obj)) {
        registros = obj;
      } else if (obj && obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
        geometryField = geometryField || '__idee_geojson';
        registros = obj.features.map(function (f) {
          const props = Object.assign({}, f.properties || {});
          if (f.geometry) props.__idee_geojson = JSON.stringify(f.geometry);
          if (f.id !== undefined) props.__idee_id = f.id;
          return props;
        });
      } else if (obj && Array.isArray(obj.records || obj.data || obj.rows)) {
        registros = obj.records || obj.data || obj.rows;
      } else {
        throw new Error('JSON no reconocido: se espera un array, un FeatureCollection o { records }');
      }

      return new AlphanumericLayer({
        name: o.name,
        legend: o.legend,
        records: registros,
        fields: o.fields,
        idField: o.idField,
        latField: o.latField,
        lonField: o.lonField,
        geometryField: geometryField,
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
        if (ext === 'xlsx' || ext === 'xlsm') return r.arrayBuffer().then(function (b) { return AlphanumericLayer.fromXLSX(b, o); });
        return r.text().then(function (t) {
          if (ext === 'json' || ext === 'geojson') return AlphanumericLayer.fromJSON(t, o);
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
  // Instalación en la API
  // -------------------------------------------------------------------

  /**
   * Instala la clase en `IDEE.layer` / `M.layer`. Es idempotente y hay que
   * volver a llamarla después de cada recarga del bundle (cambio 2D/3D),
   * porque la API recrea su espacio de nombres.
   * @returns {boolean}
   */
  function instalar() {
    const A = api();
    if (!A) return false;
    if (!A.layer) A.layer = {};
    A.layer.Alphanumeric = AlphanumericLayer;
    A.layer.alphanumeric = AlphanumericLayer;
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

  // Exposición triple (window + IDEE + M).
  if (typeof window !== 'undefined') {
    window.AlphanumericLayer = AlphanumericLayer;
    window.IDEE = window.IDEE || {};
    window.IDEE.layer = window.IDEE.layer || {};
    window.IDEE.layer.Alphanumeric = AlphanumericLayer;
    window.IDEE.layer.alphanumeric = AlphanumericLayer;
    window.M = window.M || {};
    window.M.layer = window.M.layer || {};
    window.M.layer.Alphanumeric = AlphanumericLayer;
    window.M.layer.alphanumeric = AlphanumericLayer;
  }
})();
