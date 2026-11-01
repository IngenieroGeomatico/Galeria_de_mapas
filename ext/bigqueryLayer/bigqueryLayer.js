/* =====================================================================
   miPlugin_bigqueryLayer
   ---------------------------------------------------------------------
   Conecta con BigQuery desde el navegador (sin servidor propio) usando
   Google Identity Services + la API REST de BigQuery, que SÍ admite CORS.

   Qué hace
   --------
   1. Login OAuth 2.0 con la cuenta de Google del usuario (token model).
   2. Lista los proyectos, datasets y tablas a los que tiene acceso.
   3. Lee el esquema de la tabla y detecta la columna GEOGRAPHY (o lat/lon).
   4. Estima los bytes que costará la consulta (dryRun) antes de lanzarla.
   5. Carga el resultado en el mapa:
        - con geometría  -> IDEE.layer.GeoJSON
        - sin geometría  -> IDEE.layer.Alphanumeric
   6. Permite además cargar un CSV/JSON/XLSX local como capa alfanumérica.

   Requisitos
   ----------
   - Un OAuth Client ID de tipo "Aplicación web" con el origen de la página
     en "Orígenes JavaScript autorizados" (p. ej. http://localhost:8765).
     El Client ID es público: se puede escribir en el panel y se guarda en
     localStorage. NO se usa ninguna clave de service account.
   - Scope: https://www.googleapis.com/auth/bigquery.readonly
   - La cuenta necesita `bigquery.jobs.create` en el proyecto y permiso de
     lectura sobre el dataset (roles/bigquery.jobUser + dataViewer).

   Aviso de coste
   --------------
   Cada consulta se factura al proyecto del usuario. `LIMIT` NO reduce los
   bytes escaneados. El plugin usa `maximumBytesBilled` si se configura y
   ofrece `dryRun` para ver el coste antes de ejecutar.

   Contrato de estado (cambio 2D/3D)
   ---------------------------------
   El token se guarda en una variable de módulo, que sobrevive a la recarga
   del bundle de la API. `getState()` guarda la selección y la definición de
   las capas; `setState()` las vuelve a consultar y recrear en el mapa nuevo.
   ===================================================================== */

(function () {
  'use strict';

  /** Espacio de nombres activo de la API. */
  function api() {
    return window.IDEE || window.M;
  }

  const API_BASE = 'https://bigquery.googleapis.com/bigquery/v2';
  const SCOPE = 'https://www.googleapis.com/auth/bigquery.readonly';
  const GIS_URL = 'https://accounts.google.com/gsi/client';
  const LS_CLIENT_ID = 'idee.bigquery.clientId';

  /**
   * Estado de autenticación a nivel de módulo: sobrevive al cambio 2D/3D
   * porque solo se recarga el bundle de la API, no este fichero.
   */
  const auth = { token: null, expira: 0, clientId: null };

  /** Promesa de carga de Google Identity Services (una sola vez). */
  let gisPromesa = null;

  // -------------------------------------------------------------------
  // Autenticación
  // -------------------------------------------------------------------

  /**
   * Carga el script de Google Identity Services.
   * @returns {Promise<void>}
   */
  function cargarGIS() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    if (gisPromesa) return gisPromesa;
    gisPromesa = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = GIS_URL;
      s.async = true;
      s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        gisPromesa = null;
        reject(new Error('No se pudo cargar Google Identity Services'));
      };
      document.head.appendChild(s);
    });
    return gisPromesa;
  }

  /**
   * Pide un token de acceso a Google.
   * @param {string} clientId OAuth Client ID.
   * @returns {Promise<Object>} Estado de autenticación.
   */
  function conectar(clientId) {
    return cargarGIS().then(function () {
      return new Promise(function (resolve, reject) {
        let terminado = false;
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: function (resp) {
            if (terminado) return;
            terminado = true;
            if (resp && resp.error) {
              reject(new Error(resp.error_description || resp.error));
              return;
            }
            if (!resp || !resp.access_token) {
              reject(new Error('Google no devolvió ningún token'));
              return;
            }
            auth.token = resp.access_token;
            auth.expira = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
            auth.clientId = clientId;
            resolve(auth);
          },
          error_callback: function (err) {
            if (terminado) return;
            terminado = true;
            reject(new Error((err && (err.message || err.type)) || 'Error de autenticación con Google'));
          },
        });
        client.requestAccessToken();
      });
    });
  }

  /**
   * ¿Hay token y sigue vivo?
   * @returns {boolean}
   */
  function tokenValido() {
    return !!(auth.token && Date.now() < auth.expira);
  }

  /**
   * Cierra la sesión local (no revoca el token en Google).
   */
  function desconectar() {
    auth.token = null;
    auth.expira = 0;
  }

  /**
   * Lee el Client ID guardado en localStorage.
   * @returns {string}
   */
  function leerClientId() {
    try {
      return window.localStorage.getItem(LS_CLIENT_ID) || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Guarda el Client ID en localStorage.
   * @param {string} clientId Client ID.
   */
  function guardarClientId(clientId) {
    try {
      window.localStorage.setItem(LS_CLIENT_ID, clientId);
    } catch (e) { /* modo privado */ }
  }

  // -------------------------------------------------------------------
  // HTTP contra BigQuery
  // -------------------------------------------------------------------

  /**
   * Petición autenticada a la API de BigQuery.
   * @param {string} ruta Ruta relativa (empieza por /) o URL completa.
   * @param {Object} [opciones] { method, body }
   * @returns {Promise<Object>}
   */
  function bqFetch(ruta, opciones) {
    const o = opciones || {};
    if (!tokenValido()) {
      return Promise.reject(new Error('La sesión de Google ha caducado. Vuelve a conectar.'));
    }
    const url = ruta.indexOf('http') === 0 ? ruta : (API_BASE + ruta);
    const init = {
      method: o.method || 'GET',
      headers: { Authorization: 'Bearer ' + auth.token },
    };
    if (o.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(o.body);
    }
    return fetch(url, init).then(function (r) {
      return r.text().then(function (texto) {
        let json = null;
        try { json = texto ? JSON.parse(texto) : null; } catch (e) { json = null; }
        if (!r.ok) {
          const mensaje = (json && json.error && (json.error.message || json.error.status))
            || ('HTTP ' + r.status);
          const err = new Error(mensaje);
          err.status = r.status;
          err.detalle = json;
          throw err;
        }
        return json;
      });
    });
  }

  /**
   * Recorre una lista paginada de la API.
   * @param {string} ruta Ruta.
   * @param {string} clave Clave del array en la respuesta.
   * @param {Object} [params] Parámetros de query.
   * @returns {Promise<Array<Object>>}
   */
  function listarTodo(ruta, clave, params) {
    const items = [];
    function paso(pageToken) {
      const q = Object.assign({}, params || {});
      if (pageToken) q.pageToken = pageToken;
      const query = new URLSearchParams(q).toString();
      return bqFetch(ruta + (query ? ('?' + query) : '')).then(function (j) {
        (j[clave] || []).forEach(function (x) { items.push(x); });
        if (j.nextPageToken) return paso(j.nextPageToken);
        return items;
      });
    }
    return paso(null);
  }

  /** @returns {Promise<Array<Object>>} Proyectos con rol. */
  function listarProyectos() {
    return listarTodo('/projects', 'projects');
  }

  /**
   * @param {string} proyecto Id del proyecto.
   * @returns {Promise<Array<Object>>} Datasets legibles.
   */
  function listarDatasets(proyecto) {
    return listarTodo('/projects/' + encodeURIComponent(proyecto) + '/datasets', 'datasets');
  }

  /**
   * @param {string} proyecto Id del proyecto.
   * @param {string} dataset Id del dataset.
   * @returns {Promise<Array<Object>>} Tablas.
   */
  function listarTablas(proyecto, dataset) {
    return listarTodo(
      '/projects/' + encodeURIComponent(proyecto) + '/datasets/' + encodeURIComponent(dataset) + '/tables',
      'tables'
    );
  }

  /**
   * Metadatos y esquema de una tabla.
   * @param {string} proyecto Proyecto.
   * @param {string} dataset Dataset.
   * @param {string} tabla Tabla.
   * @returns {Promise<Object>}
   */
  function getTabla(proyecto, dataset, tabla) {
    return bqFetch(
      '/projects/' + encodeURIComponent(proyecto)
      + '/datasets/' + encodeURIComponent(dataset)
      + '/tables/' + encodeURIComponent(tabla)
    );
  }

  // -------------------------------------------------------------------
  // Resultados
  // -------------------------------------------------------------------

  /**
   * Convierte el formato `{ f: [{ v }] }` de BigQuery en objetos planos.
   * @param {Object} schema Esquema.
   * @param {Array<Object>} rows Filas.
   * @returns {Array<Object>}
   */
  function filasAObjetos(schema, rows) {
    const campos = (schema && schema.fields) || [];
    return (rows || []).map(function (row) {
      return filaAObjeto(campos, row);
    });
  }

  /**
   * @param {Array<Object>} campos Campos.
   * @param {Object} row Fila.
   * @returns {Object}
   */
  function filaAObjeto(campos, row) {
    const obj = {};
    const celdas = (row && row.f) || [];
    campos.forEach(function (campo, i) {
      obj[campo.name] = valorCelda(campo, celdas[i]);
    });
    return obj;
  }

  /**
   * @param {Object} campo Campo.
   * @param {Object} celda Celda.
   * @returns {*}
   */
  function valorCelda(campo, celda) {
    if (!celda || celda.v === undefined || celda.v === null) return null;
    if (campo.mode === 'REPEATED') {
      return (celda.v || []).map(function (v) { return valorSimple(campo, v); });
    }
    return valorSimple(campo, celda.v);
  }

  /**
   * @param {Object} campo Campo.
   * @param {*} v Valor bruto.
   * @returns {*}
   */
  function valorSimple(campo, v) {
    if (v === null || v === undefined) return null;
    if (campo.type === 'RECORD' || campo.type === 'STRUCT') {
      const sub = campo.fields || [];
      const f = (v && v.f) || [];
      const obj = {};
      sub.forEach(function (c, i) { obj[c.name] = valorCelda(c, f[i]); });
      return obj;
    }
    if (campo.type === 'INTEGER' || campo.type === 'INT64') return Number(v);
    if (campo.type === 'FLOAT' || campo.type === 'FLOAT64') return Number(v);
    if (campo.type === 'NUMERIC' || campo.type === 'BIGNUMERIC') return Number(v);
    if (campo.type === 'BOOLEAN' || campo.type === 'BOOL') return v === true || v === 'true';
    return v;
  }

  // -------------------------------------------------------------------
  // Consultas
  // -------------------------------------------------------------------

  /**
   * Escapa un identificador de BigQuery.
   * @param {string} nombre Nombre.
   * @returns {string}
   */
  function citarIdentificador(nombre) {
    const s = String(nombre);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s;
    return '`' + s.replace(/`/g, '\\`') + '`';
  }

  /**
   * Construye el SELECT de una tabla. Si hay columna GEOGRAPHY, añade
   * `ST_ASGEOJSON(...) AS __idee_geojson`.
   * @param {string} proyecto Proyecto.
   * @param {string} dataset Dataset.
   * @param {string} tabla Tabla.
   * @param {Object} schema Esquema.
   * @param {Object} [opciones] { geoField, limit }
   * @returns {string}
   */
  function construirSQL(proyecto, dataset, tabla, schema, opciones) {
    const o = opciones || {};
    const ref = '`' + [proyecto, dataset, tabla].join('.') + '`';
    const campos = (schema && schema.fields) || [];
    const limite = Math.max(1, Math.min(Number(o.limit) || 10000, 100000));
    let select = '*';
    if (o.geoField) {
      const except = [citarIdentificador(o.geoField)];
      if (campos.some(function (c) { return c.name === '__idee_geojson'; })) {
        except.push('__idee_geojson');
      }
      select = '* EXCEPT (' + except.join(', ') + '), ST_ASGEOJSON('
        + citarIdentificador(o.geoField) + ') AS __idee_geojson';
    }
    return 'SELECT ' + select + ' FROM ' + ref + ' LIMIT ' + limite;
  }

  /**
   * Ejecuta una consulta. Con `dryRun` solo devuelve la estimación.
   * @param {string} proyecto Proyecto.
   * @param {string} sql SQL.
   * @param {Object} [opciones] { maxResults, timeoutMs, dryRun, maximumBytesBilled }
   * @returns {Promise<Object>}
   */
  function ejecutarConsulta(proyecto, sql, opciones) {
    const o = opciones || {};
    const cuerpo = {
      query: sql,
      useLegacySql: false,
      timeoutMs: o.timeoutMs || 10000,
    };
    if (o.dryRun) {
      cuerpo.dryRun = true;
    } else {
      cuerpo.maxResults = o.maxResults || 10000;
      if (o.maximumBytesBilled) {
        cuerpo.maximumBytesBilled = String(o.maximumBytesBilled);
      }
    }
    return bqFetch('/projects/' + encodeURIComponent(proyecto) + '/queries', {
      method: 'POST',
      body: cuerpo,
    }).then(function (j) {
      if (o.dryRun || j.jobComplete !== false) return j;
      return esperarJob(proyecto, j, o);
    });
  }

  /**
   * Sondea un job hasta que termina y acumula las páginas.
   * @param {string} proyecto Proyecto.
   * @param {Object} primer Primera respuesta.
   * @param {Object} opciones Opciones.
   * @returns {Promise<Object>}
   */
  function esperarJob(proyecto, primer, opciones) {
    const jobId = primer.jobReference && primer.jobReference.jobId;
    const location = primer.jobReference && primer.jobReference.location;
    if (!jobId) return Promise.resolve(primer);

    const filas = (primer.rows || []).slice();
    const schema = primer.schema;
    const maxFilas = Number(opciones.maxResults) || 10000;
    let pageToken = primer.pageToken || null;
    let intentos = 0;

    function paso() {
      const q = { timeoutMs: 10000 };
      if (location) q.location = location;
      if (pageToken) q.pageToken = pageToken;
      return bqFetch(
        '/projects/' + encodeURIComponent(proyecto)
        + '/queries/' + encodeURIComponent(jobId)
        + '?' + new URLSearchParams(q).toString()
      ).then(function (j) {
        if (j.jobComplete === false) {
          intentos += 1;
          if (intentos > 60) throw new Error('La consulta tarda demasiado; reduce el límite');
          return new Promise(function (res) { setTimeout(res, 500); }).then(paso);
        }
        (j.rows || []).forEach(function (r) { filas.push(r); });
        if (j.pageToken && filas.length < maxFilas) {
          pageToken = j.pageToken;
          return paso();
        }
        return {
          schema: j.schema || schema,
          rows: filas,
          totalRows: j.totalRows,
          jobComplete: true,
        };
      });
    }
    return paso();
  }

  /**
   * Detecta columnas de geometría en el esquema.
   * @param {Object} schema Esquema.
   * @returns {{geoField: string|null, latField: string|null, lonField: string|null}}
   */
  function detectarColumnasGeo(schema) {
    const campos = (schema && schema.fields) || [];
    const geo = campos.filter(function (c) { return c.type === 'GEOGRAPHY'; })[0];
    const lat = campos.filter(function (c) { return /^(lat|latitud|latitude|y)$/i.test(c.name); })[0];
    const lon = campos.filter(function (c) { return /^(lon|lng|long|longitud|longitude|x)$/i.test(c.name); })[0];
    return {
      geoField: geo ? geo.name : null,
      latField: lat ? lat.name : null,
      lonField: lon ? lon.name : null,
    };
  }

  /**
   * Construye un FeatureCollection a partir de los objetos devueltos.
   * @param {Array<Object>} objetos Filas.
   * @param {Object} meta { geometryField, latField, lonField, idField }
   * @returns {Object}
   */
  /**
   * Detecta columnas de geometría en los resultados de una consulta.
   * Busca campos cuyo valor sea GeoJSON válido, campos con nombre de
   * geometría y pares lat/lon.
   * @param {Array<Object>} objetos Filas devueltas por BigQuery.
   * @returns {{geoField: string|null, latField: string|null, lonField: string|null, candidatos: Array<string>}}
   */
  function detectarCamposGeoEnResultados(objetos) {
    const resultado = { geoField: null, latField: null, lonField: null, candidatos: [] };
    if (!Array.isArray(objetos) || !objetos.length) return resultado;
    const campos = Object.keys(objetos[0]);
    const nombresGeo = /^(geojson|geometry|geom|the_geom|shape|geo|location|coordinates|coord|wkt|wkb|st_asgeojson)$/i;
    const nombresLat = /^(lat|latitud|latitude|y)$/i;
    const nombresLon = /^(lon|lng|long|longitud|longitude|x)$/i;
    const geoJsonCampos = [];
    campos.forEach(function (c) {
      let esGeo = false;
      for (let i = 0; i < Math.min(objetos.length, 5); i++) {
        const v = objetos[i][c];
        if (typeof v === 'string' && v.trim().charAt(0) === '{') {
          try {
            const g = JSON.parse(v);
            if (g && typeof g.type === 'string' && /^(Point|LineString|Polygon|MultiPoint|MultiLineString|MultiPolygon|GeometryCollection|Feature|FeatureCollection)$/i.test(g.type)) {
              esGeo = true; break;
            }
          } catch (e) { /* no es GeoJSON */ }
        }
        if (v && typeof v === 'object' && typeof v.type === 'string' && /^(Point|LineString|Polygon|MultiPoint|MultiLineString|MultiPolygon|GeometryCollection)$/i.test(v.type)) {
          esGeo = true; break;
        }
      }
      if (esGeo) geoJsonCampos.push(c);
    });
    const nombreGeoCampos = campos.filter(function (c) { return nombresGeo.test(c); });
    const candidatosSet = new Set();
    geoJsonCampos.forEach(function (c) { candidatosSet.add(c); });
    nombreGeoCampos.forEach(function (c) { candidatosSet.add(c); });
    resultado.candidatos = Array.from(candidatosSet);
    if (geoJsonCampos.length) resultado.geoField = geoJsonCampos[0];
    else if (nombreGeoCampos.length) resultado.geoField = nombreGeoCampos[0];
    const lat = campos.filter(function (c) { return nombresLat.test(c); })[0];
    const lon = campos.filter(function (c) { return nombresLon.test(c); })[0];
    if (lat && lon) { resultado.latField = lat; resultado.lonField = lon; }
    if (!resultado.latField) {
      campos.forEach(function (c1) {
        campos.forEach(function (c2) {
          if (c1 === c2 || resultado.latField) return;
          let okLat = true, okLon = true, n = 0;
          for (let i = 0; i < Math.min(objetos.length, 10); i++) {
            const v1 = Number(objetos[i][c1]);
            const v2 = Number(objetos[i][c2]);
            if (!isFinite(v1) || !isFinite(v2)) { okLat = false; okLon = false; break; }
            if (Math.abs(v1) > 90) okLat = false;
            if (Math.abs(v2) > 180) okLon = false;
            n++;
          }
          if (n > 0 && okLat && okLon) { resultado.latField = c1; resultado.lonField = c2; }
        });
      });
    }
    return resultado;
  }

  function construirFeatureCollection(objetos, meta) {
    const m = meta || {};
    let campoGeo = m.geometryField || null;
    if (!campoGeo) {
      const det = detectarCamposGeoEnResultados(objetos);
      campoGeo = det.geoField || '__idee_geojson';
    }
    const features = [];
    objetos.forEach(function (o) {
      let geom = null;
      if (o[campoGeo]) {
        try {
          const g = typeof o[campoGeo] === 'string' ? JSON.parse(o[campoGeo]) : o[campoGeo];
          if (g && typeof g.type === 'string') geom = g;
        } catch (e) { geom = null; }
      }
      if (!geom && m.latField && m.lonField) {
        const lat = Number(o[m.latField]);
        const lon = Number(o[m.lonField]);
        if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          geom = { type: 'Point', coordinates: [lon, lat] };
        }
      }
      if (!geom) return;
      const props = {};
      Object.keys(o).forEach(function (k) {
        if (k !== campoGeo) props[k] = o[k];
      });
      const f = { type: 'Feature', properties: props, geometry: geom };
      if (m.idField && o[m.idField] !== undefined) f.id = o[m.idField];
      features.push(f);
    });
    return { type: 'FeatureCollection', features: features };
  }

  // -------------------------------------------------------------------
  // Formato
  // -------------------------------------------------------------------

  /**
   * Formatea bytes de forma legible.
   * @param {number|string} n Bytes.
   * @returns {string}
   */
  function formatearBytes(n) {
    let v = Number(n) || 0;
    const unidades = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0;
    while (v >= 1024 && i < unidades.length - 1) {
      v /= 1024;
      i += 1;
    }
    const decimales = i === 0 ? 0 : (v >= 100 ? 0 : (v >= 10 ? 1 : 2));
    return v.toFixed(decimales).replace('.', ',') + ' ' + unidades[i];
  }

  /**
   * Formatea un número con separador de miles español.
   * @param {number|string} n Número.
   * @returns {string}
   */
  function formatearNumero(n) {
    const v = Number(n);
    if (!isFinite(v)) return String(n);
    return new Intl.NumberFormat('es-ES').format(v);
  }

  // -------------------------------------------------------------------
  // Plugin
  // -------------------------------------------------------------------

  class miPlugin_bigqueryLayer {

    /**
     * @param {Object} [options]
     * @param {string} [options.position] Esquina del panel (TL, TR, BL, BR).
     * @param {number} [options.order] Orden CSS dentro de la esquina.
     * @param {boolean} [options.collapsible] Panel plegable.
     * @param {string} [options.clientId] OAuth Client ID.
     * @param {number} [options.limit] Límite de filas por defecto.
     * @param {number} [options.maxBytesBilled] Tope de bytes facturados por consulta.
     * @param {string|Object} [options.color1] Fondo del panel (o { active, deactive }).
     * @param {string|Object} [options.color2] Borde del panel.
     * @param {string|Object} [options.color3] Color del icono y del texto.
     */
    constructor(options) {
      const o = options || {};
      this.name = 'miPlugin_bigqueryLayer';
      this.options = o;
      this.position = o.position || 'TL';
      this.order = (o.order === undefined) ? null : o.order;
      this.collapsible = o.collapsible !== false;
      this.clientId = o.clientId || leerClientId();
      this.limite = Math.max(1, Math.min(Number(o.limit) || 10000, 100000));
      this.maxBytesBilled = Number(o.maxBytesBilled) || 0;

      // Paleta por defecto: el azul de Google. Los colores NO se escriben en
      // el CSS: entran por aquí y se aplican como variables CSS en el panel
      // (--g-plugin-bg-color, --g-plugin-border-color, --g-plugin-icon-color).
      this.color1 = o.color1 || '#1a73e8';
      this.color2 = o.color2 || '#ffffff';
      this.color3 = o.color3 || '#ffffff';

      this._map = null;
      this._panel = null;
      this._control = null;
      this._el = null;
      this._arrastrable = false;
      this._pendientes = [];
      this._procesandoPendientes = false;
      this._sql = '';

      this._proyectos = [];
      this._datasets = [];
      this._tablas = [];
      this._proyecto = '';
      this._dataset = '';
      this._tabla = '';
      this._tablaDetalle = null;
      this._capas = [];
      this._ocupado = false;
    }

    // -------------------- ciclo de vida --------------------

    /**
     * Normaliza un color: admite un valor suelto o `{ active, deactive }`.
     * @param {string|Object} c Color.
     * @returns {{active: string, deactive: string}}
     */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    getHelp() {
      const A = api();
      const html = ''
        + '<div class="bq-ayuda">'
        + '<p><strong>BigQuery</strong> permite cargar tablas de Google BigQuery en el mapa '
        + 'sin servidor propio: el usuario se autentica con su cuenta de Google y la consulta '
        + 'se factura a su proyecto.</p>'
        + '<ol>'
        + '<li>Crea un proyecto en Google Cloud y activa la API de BigQuery.</li>'
        + '<li>En <em>Credenciales</em>, crea un <strong>OAuth Client ID</strong> de tipo '
        + '<em>Aplicación web</em> y añade el origen de esta página en '
        + '<em>Orígenes JavaScript autorizados</em>.</li>'
        + '<li>Pega el Client ID en el panel y pulsa <em>Conectar</em>.</li>'
        + '<li>Elige proyecto, dataset y tabla. Si la tabla tiene una columna '
        + '<code>GEOGRAPHY</code> se carga como capa GeoJSON; si no, como capa alfanumérica.</li>'
        + '</ol>'
        + '<p>El scope usado es <code>bigquery.readonly</code>. No se guarda ninguna '
        + 'credencial de servicio en el navegador.</p>'
        + '</div>';
      return {
        title: 'BigQuery',
        content: new Promise(function (resolve) {
          if (A && A.utils && typeof A.utils.stringToHtml === 'function') {
            resolve(A.utils.stringToHtml(html));
          } else {
            resolve(html);
          }
        }),
      };
    }

    /**
     * Monta el panel en el mapa.
     * @param {Object} map Mapa de la API-IDEE.
     */
    addTo(map) {
      this._map = map;
      const IDEE = api();
      if (!IDEE || !IDEE.ui || !IDEE.Control) {
        console.error(this.name + ': no se encontró el objeto global de la API (IDEE/M).');
        return;
      }

      // Tras el cambio 2D/3D la API recrea IDEE.layer: reinstalamos la capa.
      const AL = window.AlphanumericLayer;
      if (AL && typeof AL.instalar === 'function') AL.instalar();

      const pos = (IDEE.ui.position && IDEE.ui.position[this.position])
        ? IDEE.ui.position[this.position]
        : (IDEE.ui.position ? IDEE.ui.position.TL : 'TL');

      const panel = new IDEE.ui.Panel('tools_bigquery', {
        collapsible: this.collapsible,
        className: 'g-herramienta_bigquery g-panel-lateral',
        collapsedButtonClass: 'm-tools',
        position: pos,
        order: this.order,
      });
      this._panel = panel;

      const control = new IDEE.Control(new IDEE.impl.Control(), 'controlBigQuery');
      this._control = control;
      control.equals = function (other) {
        return other === this;
      };
      const self = this;
      control.createView = function () {
        const vista = self._construirUI();
        // La API inserta la vista en el panel después de este retorno: el
        // arrastre se engancha en el siguiente turno, cuando la cabecera ya
        // está en el DOM.
        setTimeout(function () { self._hacerArrastrable(); }, 0);
        return vista;
      };

      panel.addControls(control);
      map.addPanels(panel);

      // Colores del constructor -> variables CSS del panel (mismo patrón que
      // ext/geoprocesos y ext/plantilla_plugin).
      try {
        const c1 = this.resolveColor(this.color1);
        const c2 = this.resolveColor(this.color2);
        const c3 = this.resolveColor(this.color3);
        const panelEl = (typeof panel.getElement === 'function')
          ? panel.getElement()
          : document.querySelector('.m-panel.g-herramienta_bigquery');
        if (panelEl && panelEl.style) {
          panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
          panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
          panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
          panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
          panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
          panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
        }
      } catch (e) { /* el elemento aún no está en el DOM */ }

      this._hacerArrastrable();
      try { control.activate(); } catch (e) { /* noop */ }
    }

    /**
     * Engancha la cabecera del panel al arrastre de la API.
     * Es idempotente: tras el cambio 2D/3D la vista se recrea y se vuelve a
     * llamar, pero el panel es nuevo y no hay que duplicar nada.
     */
    _hacerArrastrable() {
      const IDEE = api();
      if (!this._panel || !IDEE || !IDEE.utils || typeof IDEE.utils.draggabillyPlugin !== 'function') return;
      const cabecera = document.getElementById('m-herramienta-title-bigquery');
      if (!cabecera || this._arrastrable) return;
      this._arrastrable = true;
      try {
        IDEE.utils.draggabillyPlugin(this._panel, '#m-herramienta-title-bigquery');
      } catch (e) {
        this._arrastrable = false;
        console.warn(this.name + ': no se pudo hacer arrastrable la barra de título.', e);
      }
    }

    destroy() {
      if (this._panel && typeof this._panel.close === 'function') {
        try { this._panel.close(); } catch (e) { /* noop */ }
      }
      this._panel = null;
      this._control = null;
      this._el = null;
      this._map = null;
    }

    // -------------------- contrato de estado --------------------

    getState() {
      return {
        clientId: this.clientId,
        proyecto: this._proyecto,
        dataset: this._dataset,
        tabla: this._tabla,
        limite: this.limite,
        sql: this._sql || '',
        capas: this._capas.map(function (c) {
          const def = {
            nombre: c.nombre,
            tipo: c.tipo,
            sql: c.sql,
            proyecto: c.proyecto,
            dataset: c.dataset,
            tabla: c.tabla,
            limite: c.limite,
            latField: c.latField || null,
            lonField: c.lonField || null,
            geometryField: c.geometryField || null,
          };
          // Las capas locales no tienen SQL que volver a consultar: se lleva
          // el dato completo, que es lo único que permite recrearlas. El
          // estado vive en memoria (`window.EstadoPlugins`), no se serializa
          // a disco, así que no hay problema de tamaño.
          if (!c.sql && c.capa && typeof c.capa.toJSON === 'function') {
            def.datos = c.capa.toJSON();
          }
          return def;
        }),
      };
    }

    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      if (map) this._map = map;
      this.clientId = state.clientId || this.clientId;
      this.limite = Math.max(1, Math.min(Number(state.limite) || this.limite, 100000));
      this._proyecto = state.proyecto || '';
      this._dataset = state.dataset || '';
      this._tabla = state.tabla || '';
      this._sql = state.sql || '';

      if (this._el) {
        this._el.clientId.value = this.clientId || '';
        this._el.limite.value = this.limite;
        this._el.sql.value = this._sql;
        this._pintarEstadoAuth();
      }

      if (tokenValido()) {
        this._cargarProyectos({
          proyecto: this._proyecto,
          dataset: this._dataset,
          tabla: this._tabla,
        }).catch(function () { /* la UI ya muestra el error */ });
      }
      // Las capas locales se recrean con sus datos; las de BigQuery se
      // vuelven a consultar (y si no hay token quedan en cola hasta conectar).
      (state.capas || []).forEach((c) => {
        if (c && c.datos) this._recrearCapaLocal(c);
        else this._recrearCapa(c);
      });
      this._pintarCapas();
    }

    // -------------------- UI --------------------

    /**
     * Construye la vista del panel.
     * @returns {HTMLElement}
     */
    _construirUI() {
      const cont = document.createElement('div');
      cont.className = 'm-control m-container m-herramienta bq-container';
      cont.setAttribute('role', 'region');
      cont.setAttribute('aria-label', 'BigQuery');

      cont.innerHTML = ''
        + '<header role="heading" aria-level="3" tabindex="0" id="m-herramienta-title-bigquery" '
        + '  class="m-herramienta-header bq-header">'
        + '  <span>BigQuery</span>'
        + '</header>'
        + '<div class="m-herramienta-contents bq-body">'

        + '  <section class="bq-bloque">'
        + '    <label class="bq-label" for="bq-client-id">Client ID de Google</label>'
        + '    <div class="bq-fila">'
        + '      <input id="bq-client-id" class="bq-input" type="text" spellcheck="false" '
        + '        placeholder="1234567890-xxxx.apps.googleusercontent.com" data-campo="clientId">'
        + '    </div>'
        + '    <div class="bq-fila bq-fila-botones">'
        + '      <button type="button" class="bq-btn bq-btn-primario" data-accion="conectar">Conectar</button>'
        + '      <button type="button" class="bq-btn" data-accion="desconectar" hidden>Salir</button>'
        + '    </div>'
        + '    <p class="bq-estado" data-estado="auth">Sin sesión</p>'
        + '  </section>'

        + '  <section class="bq-bloque" data-bloque="recursos" hidden>'
        + '    <label class="bq-label">Proyecto</label>'
        + '    <select class="bq-select" data-campo="proyecto"></select>'
        + '    <label class="bq-label">Dataset</label>'
        + '    <select class="bq-select" data-campo="dataset"></select>'
        + '    <label class="bq-label">Tabla</label>'
        + '    <input class="bq-input" type="search" placeholder="Filtrar tablas..." data-campo="filtroTabla">'
        + '    <select class="bq-select bq-select-lista" data-campo="tabla" size="6"></select>'
        + '    <div class="bq-detalle" data-detalle="tabla"></div>'
        + '    <div class="bq-fila bq-fila-limite">'
        + '      <label class="bq-label-inline">Límite'
        + '        <input class="bq-input bq-input-num" type="number" min="1" max="100000" '
        + '          step="1000" data-campo="limite">'
        + '      </label>'
        + '      <button type="button" class="bq-btn" data-accion="estimar">Estimar</button>'
        + '    </div>'
        + '    <p class="bq-estado" data-estado="coste"></p>'
        + '    <button type="button" class="bq-btn bq-btn-primario bq-btn-ancho" data-accion="cargar">'
        + '      Cargar en el mapa'
        + '    </button>'
        + '  </section>'

        + '  <section class="bq-bloque">'
        + '    <button type="button" class="bq-btn bq-btn-plegable" data-accion="toggle-sql">'
        + '      Consulta SQL'
        + '    </button>'
        + '    <div class="bq-plegable" data-bloque="sql" hidden>'
        + '      <textarea class="bq-textarea" rows="5" spellcheck="false" data-campo="sql" '
        + '        placeholder="SELECT * FROM `proyecto.dataset.tabla` LIMIT 1000"></textarea>'
        + '      <div class="bq-fila bq-fila-botones">'
        + '        <button type="button" class="bq-btn" data-accion="generar-sql">Generar desde tabla</button>'
        + '        <button type="button" class="bq-btn" data-accion="estimar-sql">Estimar</button>'
        + '        <button type="button" class="bq-btn bq-btn-primario" data-accion="ejecutar-sql">'
        + '          Ejecutar y cargar'
        + '        </button>'
        + '      </div>'
        + '      <p class="bq-estado" data-estado="coste-sql"></p>'
        + '    </div>'
        + '  </section>'

        + '  <section class="bq-bloque">'
        + '    <button type="button" class="bq-btn bq-btn-plegable" data-accion="toggle-local">'
        + '      Datos locales (CSV, JSON, XLSX)'
        + '    </button>'
        + '    <div class="bq-plegable" data-bloque="local" hidden>'
        + '      <input type="file" class="bq-file" data-campo="fichero" '
        + '        accept=".csv,.tsv,.txt,.json,.geojson,.xlsx">'
        + '      <button type="button" class="bq-btn bq-btn-ancho" data-accion="cargar-local">'
        + '        Cargar fichero como capa alfanumérica'
        + '      </button>'
        + '      <p class="bq-estado" data-estado="local"></p>'
        + '    </div>'
        + '  </section>'

        + '  <section class="bq-bloque">'
        + '    <h4 class="bq-subtitulo">Capas cargadas</h4>'
        + '    <ul class="bq-capas" data-lista="capas"></ul>'
        + '    <p class="bq-vacio" data-vacio="capas">Todavía no hay capas.</p>'
        + '  </section>'

        + '</div>';

      this._el = {
        root: cont,
        clientId: cont.querySelector('[data-campo="clientId"]'),
        btnConectar: cont.querySelector('[data-accion="conectar"]'),
        btnDesconectar: cont.querySelector('[data-accion="desconectar"]'),
        estadoAuth: cont.querySelector('[data-estado="auth"]'),
        recursos: cont.querySelector('[data-bloque="recursos"]'),
        proyecto: cont.querySelector('[data-campo="proyecto"]'),
        dataset: cont.querySelector('[data-campo="dataset"]'),
        filtroTabla: cont.querySelector('[data-campo="filtroTabla"]'),
        tabla: cont.querySelector('[data-campo="tabla"]'),
        detalle: cont.querySelector('[data-detalle="tabla"]'),
        limite: cont.querySelector('[data-campo="limite"]'),
        estadoCoste: cont.querySelector('[data-estado="coste"]'),
        btnCargar: cont.querySelector('[data-accion="cargar"]'),
        sql: cont.querySelector('[data-campo="sql"]'),
        estadoCosteSql: cont.querySelector('[data-estado="coste-sql"]'),
        fichero: cont.querySelector('[data-campo="fichero"]'),
        estadoLocal: cont.querySelector('[data-estado="local"]'),
        listaCapas: cont.querySelector('[data-lista="capas"]'),
        vacioCapas: cont.querySelector('[data-vacio="capas"]'),
      };

      this._bind();
      this._pintarTodo();
      return cont;
    }

    /**
     * Engancha los eventos de la UI.
     */
    _bind() {
      const el = this._el;
      const self = this;

      el.btnConectar.addEventListener('click', function () { self._conectar(); });
      el.btnDesconectar.addEventListener('click', function () {
        desconectar();
        self._pintarEstadoAuth();
        self._pintarTodo();
      });

      el.proyecto.addEventListener('change', function () {
        self._proyecto = el.proyecto.value;
        self._cargarDatasets();
      });
      el.dataset.addEventListener('change', function () {
        self._dataset = el.dataset.value;
        self._cargarTablas();
      });
      el.filtroTabla.addEventListener('input', function () { self._pintarTablas(); });
      el.tabla.addEventListener('change', function () { self._seleccionarTabla(); });

      el.root.querySelector('[data-accion="estimar"]').addEventListener('click', function () {
        self._estimarSeleccion();
      });
      el.btnCargar.addEventListener('click', function () { self._cargarSeleccion(); });

      el.root.querySelector('[data-accion="toggle-sql"]').addEventListener('click', function () {
        const b = el.root.querySelector('[data-bloque="sql"]');
        b.hidden = !b.hidden;
      });
      const btnGenerar = el.root.querySelector('[data-accion="generar-sql"]');
      if (btnGenerar) {
        btnGenerar.addEventListener('click', function () { self._generarSqlDesdeTabla(); });
      }
      el.sql.addEventListener('input', function () { self._sql = el.sql.value; });
      el.root.querySelector('[data-accion="toggle-local"]').addEventListener('click', function () {
        const b = el.root.querySelector('[data-bloque="local"]');
        b.hidden = !b.hidden;
      });

      el.root.querySelector('[data-accion="estimar-sql"]').addEventListener('click', function () {
        const sql = (el.sql.value || '').trim();
        if (!sql) { self._setEstado(el.estadoCosteSql, 'Escribe una consulta', 'error'); return; }
        self._estimar(sql, el.estadoCosteSql);
      });
      el.root.querySelector('[data-accion="ejecutar-sql"]').addEventListener('click', function () {
        const sql = (el.sql.value || '').trim();
        if (!sql) { self._setEstado(el.estadoCosteSql, 'Escribe una consulta', 'error'); return; }
        self._ejecutarYcargar(sql, {
          nombre: 'Consulta BigQuery',
          proyecto: self._proyecto,
          dataset: null,
          tabla: null,
          limite: self.limite,
          geometryField: null,
          tipo: 'auto',
        });
      });

      el.root.querySelector('[data-accion="cargar-local"]').addEventListener('click', function () {
        self._cargarLocal();
      });

      el.listaCapas.addEventListener('click', function (ev) {
        const btn = ev.target.closest('[data-quitar]');
        if (!btn) return;
        self._quitarCapa(Number(btn.getAttribute('data-quitar')));
      });
    }

    /**
     * Repinta todo lo que depende del estado interno.
     */
    _pintarTodo() {
      if (!this._el) return;
      this._el.clientId.value = this.clientId || '';
      this._el.limite.value = this.limite;
      this._el.sql.value = this._sql || '';
      this._pintarEstadoAuth();
      this._pintarCapas();
      if (tokenValido()) {
        if (this._proyectos.length === 0) {
          this._cargarProyectos({ proyecto: this._proyecto });
        }
        this._procesarPendientes();
      }
    }

    /**
     * Pinta el estado de la sesión y habilita/oculta los recursos.
     */
    _pintarEstadoAuth() {
      if (!this._el) return;
      const valido = tokenValido();
      this._el.recursos.hidden = !valido;
      this._el.btnDesconectar.hidden = !valido;
      this._el.btnConectar.textContent = valido ? 'Reconectar' : 'Conectar';
      if (!valido) {
        this._setEstado(this._el.estadoAuth, auth.token
          ? 'La sesión ha caducado. Vuelve a conectar.'
          : 'Sin sesión', auth.token ? 'aviso' : '');
        return;
      }
      const minutos = Math.max(0, Math.round((auth.expira - Date.now()) / 60000));
      this._setEstado(this._el.estadoAuth, 'Conectado · caduca en ' + minutos + ' min', 'ok');
    }

    /**
     * Conecta con Google.
     */
    _conectar() {
      const clientId = (this._el.clientId.value || '').trim();
      if (!clientId) {
        this._setEstado(this._el.estadoAuth, 'Falta el Client ID de Google', 'error');
        return;
      }
      this._setEstado(this._el.estadoAuth, 'Conectando con Google...', 'info');
      this.clientId = clientId;
      conectar(clientId).then(() => {
        guardarClientId(clientId);
        this._pintarEstadoAuth();
        this._procesarPendientes();
        return this._cargarProyectos({ proyecto: this._proyecto });
      }).catch((err) => {
        this._setEstado(this._el.estadoAuth, err.message, 'error');
      });
    }

    /**
     * Carga proyectos y, si se indica, restaura la selección.
     * @param {Object} [seleccion] { proyecto, dataset, tabla }
     * @returns {Promise<void>}
     */
    _cargarProyectos(seleccion) {
      if (!this._el) return Promise.resolve();
      const sel = seleccion || {};
      this._setEstado(this._el.estadoAuth, 'Cargando proyectos...', 'info');
      return listarProyectos().then((proyectos) => {
        this._proyectos = proyectos;
        const select = this._el.proyecto;
        select.innerHTML = '';
        proyectos.forEach(function (p) {
          const id = p.id || (p.projectReference && p.projectReference.projectId);
          const op = document.createElement('option');
          op.value = id;
          op.textContent = p.friendlyName && p.friendlyName !== id ? (p.friendlyName + ' (' + id + ')') : id;
          select.appendChild(op);
        });
        const objetivo = sel.proyecto || this._proyecto || (proyectos[0] && (proyectos[0].id || proyectos[0].projectReference.projectId)) || '';
        if (objetivo) {
          select.value = objetivo;
          this._proyecto = select.value;
        }
        this._pintarEstadoAuth();
        return this._cargarDatasets(sel);
      }).catch((err) => {
        this._setEstado(this._el.estadoAuth, err.message, 'error');
      });
    }

    /**
     * Carga datasets del proyecto seleccionado.
     * @param {Object} [seleccion]
     * @returns {Promise<void>}
     */
    _cargarDatasets(seleccion) {
      if (!this._el) return Promise.resolve();
      const sel = seleccion || {};
      const proyecto = this._el.proyecto.value || this._proyecto;
      if (!proyecto) return Promise.resolve();
      this._proyecto = proyecto;
      return listarDatasets(proyecto).then((datasets) => {
        this._datasets = datasets;
        const select = this._el.dataset;
        select.innerHTML = '';
        datasets.forEach(function (d) {
          const id = d.datasetReference ? d.datasetReference.datasetId : d.id;
          const op = document.createElement('option');
          op.value = id;
          op.textContent = d.friendlyName && d.friendlyName !== id ? (d.friendlyName + ' (' + id + ')') : id;
          select.appendChild(op);
        });
        const objetivo = sel.dataset || this._dataset || (datasets[0] && (datasets[0].datasetReference ? datasets[0].datasetReference.datasetId : datasets[0].id)) || '';
        if (objetivo) {
          select.value = objetivo;
          this._dataset = select.value;
        }
        return this._cargarTablas(sel);
      }).catch((err) => {
        this._setEstado(this._el.estadoAuth, err.message, 'error');
      });
    }

    /**
     * Carga las tablas del dataset seleccionado.
     * @param {Object} [seleccion]
     * @returns {Promise<void>}
     */
    _cargarTablas(seleccion) {
      if (!this._el) return Promise.resolve();
      const sel = seleccion || {};
      const proyecto = this._proyecto;
      const dataset = this._el.dataset.value || this._dataset;
      if (!proyecto || !dataset) return Promise.resolve();
      this._dataset = dataset;
      this._tablas = [];
      this._pintarTablas();
      return listarTablas(proyecto, dataset).then((tablas) => {
        this._tablas = tablas;
        this._pintarTablas();
        const objetivo = sel.tabla || this._tabla;
        if (objetivo) {
          const existe = Array.from(this._el.tabla.options).some(function (o) { return o.value === objetivo; });
          if (existe) {
            this._el.tabla.value = objetivo;
            this._tabla = objetivo;
            return this._seleccionarTabla();
          }
        }
        return null;
      }).catch((err) => {
        this._setEstado(this._el.estadoAuth, err.message, 'error');
      });
    }

    /**
     * Pinta el desplegable de tablas aplicando el filtro.
     */
    _pintarTablas() {
      if (!this._el) return;
      const filtro = (this._el.filtroTabla.value || '').toLowerCase();
      const select = this._el.tabla;
      const valorPrevio = select.value || this._tabla;
      select.innerHTML = '';
      this._tablas.forEach(function (t) {
        const id = t.tableReference ? t.tableReference.tableId : t.id;
        if (filtro && id.toLowerCase().indexOf(filtro) === -1) return;
        const op = document.createElement('option');
        op.value = id;
        op.textContent = id;
        select.appendChild(op);
      });
      if (valorPrevio && Array.from(select.options).some(function (o) { return o.value === valorPrevio; })) {
        select.value = valorPrevio;
      }
    }

    /**
     * Lee el esquema de la tabla seleccionada.
     * @returns {Promise<void>}
     */
    _seleccionarTabla() {
      if (!this._el) return Promise.resolve();
      const tabla = this._el.tabla.value;
      if (!tabla) {
        this._tablaDetalle = null;
        this._pintarDetalle();
        return Promise.resolve();
      }
      this._tabla = tabla;
      this._setEstado(this._el.estadoCoste, 'Leyendo esquema...', 'info');
      return getTabla(this._proyecto, this._dataset, tabla).then((t) => {
        this._tablaDetalle = t;
        this._pintarDetalle();
        this._setEstado(this._el.estadoCoste, '', '');
      }).catch((err) => {
        this._setEstado(this._el.estadoCoste, err.message, 'error');
      });
    }

    /**
     * Pinta la ficha de la tabla: filas, tamaño, campos y geometría.
     */
    _pintarDetalle() {
      if (!this._el) return;
      const cont = this._el.detalle;
      const t = this._tablaDetalle;
      if (!t) {
        cont.innerHTML = '';
        return;
      }
      const campos = (t.schema && t.schema.fields) || [];
      const geo = detectarColumnasGeo(t.schema);
      const filas = t.numRows ? formatearNumero(t.numRows) : '?';
      const bytes = t.numBytes ? formatearBytes(t.numBytes) : '?';
      const ref = [this._proyecto, this._dataset, this._tabla].join('.');

      let html = ''
        + '<p class="bq-ref" title="' + ref + '">' + ref + '</p>'
        + '<p class="bq-meta">' + filas + ' filas · ' + bytes + '</p>'
        + '<details class="bq-campos">'
        + '<summary>' + campos.length + ' campos</summary>'
        + '<ul>';
      campos.forEach(function (c) {
        const tipo = c.mode === 'REPEATED' ? (c.type + '[]') : c.type;
        html += '<li><span class="bq-campo-nombre">' + c.name + '</span>'
          + '<span class="bq-campo-tipo">' + tipo + '</span></li>';
      });
      html += '</ul></details>';

      const opcionesGeo = [];
      opcionesGeo.push('<option value="">Ninguno (solo datos)</option>');
      campos.forEach(function (c) {
        const esGeo = c.type === 'GEOGRAPHY';
        const esGeoJson = /geojson|geometry|geom|the_geom|shape|geo|location|coordinates/i.test(c.name);
        const etiqueta = esGeo ? (c.name + ' (GEOGRAPHY)') : (esGeoJson ? (c.name + ' (GeoJSON)') : c.name);
        opcionesGeo.push('<option value="campo:' + c.name + '">' + etiqueta + '</option>');
      });
      if (geo.latField && geo.lonField) {
        opcionesGeo.push('<option value="latlon:' + geo.latField + ',' + geo.lonField + '">'
          + geo.latField + ' + ' + geo.lonField + ' (lat/lon)</option>');
      }
      const valorPorDefecto = geo.geoField
        ? ('campo:' + geo.geoField)
        : (geo.latField && geo.lonField ? ('latlon:' + geo.latField + ',' + geo.lonField) : '');
      html += '<label class="bq-label" for="bq-campo-geo">Campo de geometría</label>';
      html += '<select class="bq-select" data-campo="campoGeo">';
      opcionesGeo.forEach(function (o) { html += o; });
      html += '</select>';
      cont.innerHTML = html;
      const selectGeo = cont.querySelector('[data-campo="campoGeo"]');
      if (selectGeo && valorPorDefecto) {
        selectGeo.value = valorPorDefecto;
        if (selectGeo.value !== valorPorDefecto) {
          const opt = document.createElement('option');
          opt.value = valorPorDefecto;
          opt.textContent = valorPorDefecto;
          selectGeo.appendChild(opt);
          selectGeo.value = valorPorDefecto;
        }
      }
      if (!geo.geoField && !(geo.latField && geo.lonField)) {
        const aviso = document.createElement('p');
        aviso.className = 'bq-aviso';
        aviso.textContent = 'Sin geometría detectada: se cargará como capa alfanumérica.';
        cont.appendChild(aviso);
      }
    }

    /**
     * Estima el coste de la selección actual.
     */
    /**
     * Genera una sentencia SQL a partir de la tabla seleccionada, con
     * ST_ASGEOJSON sobre la columna GEOGRAPHY si la hay, y la coloca en
     * el editor para que el usuario la edite y ejecute. Permite crear
     * sentencias SQL para la capa con la geometría que se quiera.
     */
    _generarSqlDesdeTabla() {
      const t = this._tablaDetalle;
      if (!t) {
        this._setEstado(this._el.estadoCosteSql, 'Selecciona una tabla primero', 'error');
        return;
      }
      const geo = detectarColumnasGeo(t.schema);
      const selectGeo = this._el.detalle.querySelector('[data-campo="campoGeo"]');
      const seleccion = selectGeo ? selectGeo.value : '';
      let geoField = null;
      if (seleccion.startsWith('campo:')) {
        const nombre = seleccion.slice(6);
        if (geo.geoField === nombre) geoField = nombre;
      }
      const limite = Math.max(1, Math.min(Number(this._el.limite.value) || this.limite, 100000));
      const sql = construirSQL(this._proyecto, this._dataset, this._tabla, t.schema, {
        limit: limite,
        geoField: geoField,
      });
      this._el.sql.value = sql;
      this._sql = sql;
      const bloque = this._el.root.querySelector('[data-bloque="sql"]');
      if (bloque) bloque.hidden = false;
      this._setEstado(this._el.estadoCosteSql, 'SQL generada. Puedes editarla y ejecutar.', 'ok');
    }

    _estimarSeleccion() {
      const t = this._tablaDetalle;
      if (!t) {
        this._setEstado(this._el.estadoCoste, 'Selecciona una tabla', 'error');
        return;
      }
      const geo = detectarColumnasGeo(t.schema);
      const selectGeo = this._el.detalle.querySelector('[data-campo="campoGeo"]');
      const seleccion = selectGeo ? selectGeo.value : '';
      let geoField = null;
      if (seleccion.startsWith('campo:')) {
        const nombre = seleccion.slice(6);
        if (geo.geoField === nombre) geoField = nombre;
      }
      const sql = construirSQL(this._proyecto, this._dataset, this._tabla, t.schema, {
        limit: this._el.limite.value,
        geoField: geoField,
      });
      this._estimar(sql, this._el.estadoCoste);
    }

    /**
     * Ejecuta un dryRun y muestra los bytes estimados.
     * @param {string} sql SQL.
     * @param {HTMLElement} destino Elemento de estado.
     */
    _estimar(sql, destino) {
      if (!tokenValido()) {
        this._setEstado(destino, 'Conecta con Google primero', 'error');
        return;
      }
      if (!this._proyecto) {
        this._setEstado(destino, 'Selecciona un proyecto', 'error');
        return;
      }
      this._setEstado(destino, 'Estimando...', 'info');
      ejecutarConsulta(this._proyecto, sql, { dryRun: true }).then((j) => {
        const bytes = Number(j.totalBytesProcessed) || 0;
        this._setEstado(destino, 'Coste estimado: ' + formatearBytes(bytes), 'ok');
      }).catch((err) => {
        this._setEstado(destino, err.message, 'error');
      });
    }

    /**
     * Carga la tabla seleccionada.
     */
    _cargarSeleccion() {
      const t = this._tablaDetalle;
      if (!t) {
        this._setEstado(this._el.estadoCoste, 'Selecciona una tabla', 'error');
        return;
      }
      const geo = detectarColumnasGeo(t.schema);
      const selectGeo = this._el.detalle.querySelector('[data-campo="campoGeo"]');
      const seleccion = selectGeo ? selectGeo.value : '';
      let usarGeo = false;
      let campoGeoSeleccionado = null;
      let usarLatLon = false;
      let latSel = null, lonSel = null;
      if (seleccion.startsWith('campo:')) {
        campoGeoSeleccionado = seleccion.slice(6);
        usarGeo = !!campoGeoSeleccionado;
      } else if (seleccion.startsWith('latlon:')) {
        const partes = seleccion.slice(7).split(',');
        latSel = partes[0]; lonSel = partes[1];
        usarLatLon = !!(latSel && lonSel);
      }
      const limite = Math.max(1, Math.min(Number(this._el.limite.value) || this.limite, 100000));

      // Si se eligió un campo GEOGRAPHY, se convierte con ST_ASGEOJSON en el SQL.
      const geoFieldParaSql = (usarGeo && geo.geoField === campoGeoSeleccionado) ? campoGeoSeleccionado : null;
      const sql = construirSQL(this._proyecto, this._dataset, this._tabla, t.schema, {
        limit: limite,
        geoField: geoFieldParaSql,
      });

      this._ejecutarYcargar(sql, {
        nombre: this._proyecto + '.' + this._dataset + '.' + this._tabla,
        proyecto: this._proyecto,
        dataset: this._dataset,
        tabla: this._tabla,
        limite: limite,
        latField: usarLatLon ? latSel : null,
        lonField: usarLatLon ? lonSel : null,
        geometryField: usarGeo ? (geoFieldParaSql ? '__idee_geojson' : campoGeoSeleccionado) : null,
        tipo: (usarGeo || usarLatLon) ? 'geojson' : 'alphanumeric',
      });
    }

    /**
     * Ejecuta el SQL y crea la capa correspondiente.
     * @param {string} sql SQL.
     * @param {Object} meta Metadatos de la capa.
     * @returns {Promise<void>}
     */
    _ejecutarYcargar(sql, meta) {
      if (this._ocupado) return Promise.resolve();
      if (!tokenValido()) {
        this._setEstado(this._el.estadoCoste, 'Conecta con Google primero', 'error');
        return Promise.resolve();
      }
      if (!this._proyecto) {
        this._setEstado(this._el.estadoCoste, 'Selecciona un proyecto', 'error');
        return Promise.resolve();
      }
      this._ocupado = true;
      this._setEstado(this._el.estadoCoste, 'Ejecutando consulta...', 'info');

      return ejecutarConsulta(this._proyecto, sql, {
        maxResults: meta.limite || this.limite,
        maximumBytesBilled: this.maxBytesBilled || undefined,
      }).then((res) => {
        const objetos = filasAObjetos(res.schema, res.rows);
        if (!objetos.length) throw new Error('La consulta no devolvió filas');

        let tipo = meta.tipo;
        if (tipo === 'auto') {
          const det = detectarCamposGeoEnResultados(objetos);
          const tieneGeo = !!(det.geoField || det.latField);
          tipo = tieneGeo ? 'geojson' : 'alphanumeric';
          if (tieneGeo && !meta.geometryField) {
            meta.geometryField = det.geoField || null;
            if (!meta.latField && det.latField) meta.latField = det.latField;
            if (!meta.lonField && det.lonField) meta.lonField = det.lonField;
          }
        }

        if (tipo === 'geojson') {
          const fc = construirFeatureCollection(objetos, meta);
          if (!fc.features.length) throw new Error('No se pudo construir ninguna geometría');
          const A = api();
          const capa = new A.layer.GeoJSON({
            name: meta.nombre,
            legend: meta.nombre,
            source: fc,
            extract: true,
          });
          this._map.addLayers(capa);
          this._registrarCapa(meta, tipo, sql, capa, fc.features.length);
        } else {
          const AL = window.AlphanumericLayer;
          if (!AL) throw new Error('Falta ext/alphanumericLayer/alphanumericLayer.js');
          AL.instalar();
          const Clase = (window.BigQueryLayer) ? window.BigQueryLayer : AL;
          const capa = new Clase({
            name: meta.nombre,
            legend: meta.nombre,
            records: objetos,
            sql: sql,
            proyecto: meta.proyecto,
            dataset: meta.dataset,
            tabla: meta.tabla,
            limite: meta.limite,
            latField: meta.latField || null,
            lonField: meta.lonField || null,
            geometryField: meta.geometryField || null,
            source: {
              type: 'bigquery',
              proyecto: meta.proyecto,
              dataset: meta.dataset,
              tabla: meta.tabla,
            },
          });
          capa.addTo(this._map);
          this._registrarCapa(meta, tipo, sql, capa, objetos.length);
        }
        this._setEstado(this._el.estadoCoste, 'Cargados ' + formatearNumero(objetos.length) + ' registros', 'ok');
      }).catch((err) => {
        this._setEstado(this._el.estadoCoste, err.message, 'error');
      }).then(() => {
        this._ocupado = false;
      });
    }

    /**
     * Guarda la definición de la capa y repinta la lista.
     * @param {Object} meta Metadatos.
     * @param {string} tipo geojson|alphanumeric
     * @param {string} sql SQL ejecutado.
     * @param {Object} capa Capa creada.
     * @param {number} filas Número de registros.
     */
    _registrarCapa(meta, tipo, sql, capa, filas) {
      this._capas.push({
        nombre: meta.nombre,
        tipo: tipo,
        sql: sql,
        proyecto: meta.proyecto,
        dataset: meta.dataset,
        tabla: meta.tabla,
        limite: meta.limite,
        latField: meta.latField || null,
        lonField: meta.lonField || null,
        geometryField: meta.geometryField || null,
        capa: capa,
        filas: filas,
      });
      this._pintarCapas();
    }

    /**
     * Recrea una capa local (CSV/JSON/XLSX) con los datos guardados en el
     * estado, sin volver a leer el fichero.
     * @param {Object} def Definición con `datos` (resultado de `toJSON()`).
     */
    _recrearCapaLocal(def) {
      const AL = window.AlphanumericLayer;
      if (!AL || !def || !def.datos) return;
      AL.instalar();
      const capa = new AL(def.datos);
      capa.addTo(this._map);
      this._capas.push({
        nombre: capa.getName(),
        tipo: 'alphanumeric',
        sql: null,
        proyecto: null,
        dataset: null,
        tabla: null,
        limite: null,
        latField: def.latField || null,
        lonField: def.lonField || null,
        geometryField: def.geometryField || null,
        capa: capa,
        filas: capa.getCount(),
      });
    }

    /**
     * Recrea una capa tras el cambio 2D/3D: la deja en cola y la procesa.
     * @param {Object} def Definición guardada en getState().
     */
    _recrearCapa(def) {
      if (!def || !def.sql) return;
      this._pendientes = this._pendientes || [];
      this._pendientes.push(def);
      this._procesarPendientes();
    }

    /**
     * Ejecuta en serie la cola de capas pendientes de recrear. En serie y no
     * en paralelo porque cada recreación es una consulta facturada y porque
     * `_ejecutarYcargar` es de un solo uso a la vez (`_ocupado`).
     */
    _procesarPendientes() {
      if (!this._pendientes || !this._pendientes.length) return;
      if (this._ocupado || this._procesandoPendientes) return;
      if (!tokenValido()) return;
      this._procesandoPendientes = true;
      const def = this._pendientes.shift();
      const self = this;
      Promise.resolve(this._ejecutarYcargar(def.sql, {
        nombre: def.nombre,
        proyecto: def.proyecto,
        dataset: def.dataset,
        tabla: def.tabla,
        limite: def.limite || this.limite,
        latField: def.latField,
        lonField: def.lonField,
        geometryField: def.geometryField,
        tipo: def.tipo === 'geojson' ? 'geojson' : 'alphanumeric',
      })).catch(function (e) {
        console.warn(self.name + ': no se pudo recrear la capa ' + def.nombre, e);
      }).then(function () {
        self._procesandoPendientes = false;
        self._procesarPendientes();
      });
    }

    /**
     * Pinta la lista de capas cargadas.
     */
    _pintarCapas() {
      if (!this._el) return;
      const lista = this._el.listaCapas;
      lista.innerHTML = '';
      this._el.vacioCapas.hidden = this._capas.length > 0;
      this._capas.forEach(function (c, i) {
        const li = document.createElement('li');
        li.className = 'bq-capa';
        const etiqueta = c.tipo === 'geojson' ? 'GeoJSON' : 'Datos';
        li.innerHTML = '<span class="bq-capa-tipo">' + etiqueta + '</span>'
          + '<span class="bq-capa-nombre" title="' + c.nombre + '">' + c.nombre + '</span>'
          + '<span class="bq-capa-filas">' + formatearNumero(c.filas || 0) + '</span>'
          + '<button type="button" class="bq-capa-quitar" data-quitar="' + i + '" '
          + 'title="Quitar capa" aria-label="Quitar capa"></button>';
        lista.appendChild(li);
      });
    }

    /**
     * Quita una capa del mapa y de la lista.
     * @param {number} indice Índice.
     */
    _quitarCapa(indice) {
      const item = this._capas[indice];
      if (!item) return;
      try {
        if (item.tipo === 'geojson' && this._map && typeof this._map.removeLayers === 'function') {
          this._map.removeLayers(item.capa);
        } else if (item.capa && typeof item.capa.destroy === 'function') {
          item.capa.destroy();
        }
      } catch (e) {
        console.warn(this.name + ': no se pudo quitar la capa', e);
      }
      this._capas.splice(indice, 1);
      this._pintarCapas();
    }

    /**
     * Carga un fichero local como capa alfanumérica.
     */
    _cargarLocal() {
      const input = this._el.fichero;
      const fichero = input.files && input.files[0];
      if (!fichero) {
        this._setEstado(this._el.estadoLocal, 'Elige un fichero', 'error');
        return;
      }
      const AL = window.AlphanumericLayer;
      if (!AL) {
        this._setEstado(this._el.estadoLocal, 'Falta ext/alphanumericLayer/alphanumericLayer.js', 'error');
        return;
      }
      AL.instalar();
      const nombre = fichero.name.replace(/\.[^.]+$/, '');
      const ext = (fichero.name.split('.').pop() || '').toLowerCase();
      this._setEstado(this._el.estadoLocal, 'Leyendo ' + fichero.name + '...', 'info');

      let promesa;
      if (ext === 'xlsx' || ext === 'xlsm') {
        promesa = AL.fromXLSX(fichero, { name: nombre });
      } else {
        promesa = fichero.text().then(function (texto) {
          if (ext === 'json' || ext === 'geojson') return AL.fromJSON(texto, { name: nombre });
          return AL.fromCSV(texto, { name: nombre });
        });
      }

      promesa.then((capa) => {
        // Si el fichero trae columnas lat/lon, se detectan para que
        // `toGeoJSON()` pueda construir puntos sin configurar nada.
        const latlon = capa.detectarCamposLatLon();
        if (latlon.latField && latlon.lonField) {
          capa.setGeoFields(latlon);
        }
        capa.addTo(this._map);
        this._capas.push({
          nombre: capa.getName(),
          tipo: 'alphanumeric',
          sql: null,
          proyecto: null,
          dataset: null,
          tabla: null,
          limite: null,
          latField: null,
          lonField: null,
          geometryField: null,
          capa: capa,
          filas: capa.getCount(),
        });
        this._pintarCapas();
        this._setEstado(this._el.estadoLocal,
          'Cargados ' + formatearNumero(capa.getCount()) + ' registros', 'ok');
      }).catch((err) => {
        this._setEstado(this._el.estadoLocal, err.message, 'error');
      });
    }

    /**
     * Escribe un mensaje de estado.
     * @param {HTMLElement} el Elemento.
     * @param {string} texto Texto.
     * @param {string} [tipo] ''|info|ok|aviso|error
     */
    _setEstado(el, texto, tipo) {
      if (!el) return;
      el.textContent = texto || '';
      el.className = 'bq-estado' + (tipo ? (' bq-estado-' + tipo) : '');
    }
  }

  // -------------------------------------------------------------------
  // Exposición triple
  // -------------------------------------------------------------------

  if (typeof window !== 'undefined') {
    window.miPlugin_bigqueryLayer = miPlugin_bigqueryLayer;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_bigqueryLayer = miPlugin_bigqueryLayer;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_bigqueryLayer = miPlugin_bigqueryLayer;

    // Utilidades puras, útiles para depurar y para pruebas.
    window.BigQueryUtil = {
      listarProyectos: listarProyectos,
      listarDatasets: listarDatasets,
      listarTablas: listarTablas,
      getTabla: getTabla,
      ejecutarConsulta: ejecutarConsulta,
      filasAObjetos: filasAObjetos,
      construirSQL: construirSQL,
      detectarColumnasGeo: detectarColumnasGeo,
      construirFeatureCollection: construirFeatureCollection,
      detectarCamposGeoEnResultados: detectarCamposGeoEnResultados,
      formatearBytes: formatearBytes,
      formatearNumero: formatearNumero,
      estadoAuth: function () { return { valido: tokenValido(), expira: auth.expira }; },
    };
  }
})();
