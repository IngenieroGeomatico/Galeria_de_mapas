/* =====================================================================
   ext/madridOpenDataLayer/madridOpenDataLayer.js
   ---------------------------------------------------------------------
   Plugin/utilidad para consultar el portal de Datos Abiertos del
   Ayuntamiento de Madrid (https://datos.madrid.es) y crear capas
   IDEE.layer.Alphanumeric (y, si hay geometría, GeoJSON) a partir de sus
   datasets/recursos (API CKAN v3).

   API CKAN v3 (base: https://datos.madrid.es/api/3/action/)
   -----------------------------------------------------------
   - package_search?q=...&rows=...&start=...   buscar datasets
   - package_show?id=...                       metadatos de un dataset
   - resource_show?id=...                      metadatos de un recurso
   - datastore_search?resource_id=...&limit=...&offset=...&q=...
   - datastore_search_sql?sql=...

   El portal permite CORS (*), así que la petición se hace desde el navegador.

   Uso
   ---
     // Buscar datasets
     const lista = await window.Madrid.buscarDatasets('población distrito');

     // Cargar un dataset por su id/name (usa su primer recurso)
     const capa = await window.Madrid.cargarDataset('300557-0-poblacion-distrito-barrio');

     // Cargar directamente un recurso del DataStore
     const capa2 = await window.Madrid.cargarRecurso('200085-1-censo-locales', { limit: 500 });

   También: IDEE.layer.Alphanumeric.fromMadrid(resourceId, opciones)
   ===================================================================== */

(function () {
  'use strict';

  function api() { return window.IDEE || window.M || null; }

  const BASE_URL = 'https://datos.madrid.es/api/3/action';

  async function ckansCall(accion, params) {
    const url = new URL(BASE_URL + '/' + accion);
    if (params) {
      for (const k in params) {
        if (Object.prototype.hasOwnProperty.call(params, k) && params[k] != null && params[k] !== '') {
          url.searchParams.set(k, params[k]);
        }
      }
    }
    const res = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Madrid: error HTTP ' + res.status + ' en ' + accion);
    const json = await res.json();
    if (!json || json.success !== true) {
      throw new Error('Madrid: respuesta no exitosa en ' + accion + (json && json.error ? (' — ' + JSON.stringify(json.error)) : ''));
    }
    return json.result;
  }

  /**
   * Busca datasets en el catálogo.
   * @param {string} texto Texto de búsqueda.
   * @param {Object} [opciones] { rows, start }
   * @returns {Promise<Array>} Lista de datasets (con id, title, resources...).
   */
  async function buscarDatasets(texto, opciones) {
    const o = opciones || {};
    const result = await ckansCall('package_search', {
      q: texto || '*:*',
      rows: o.rows || 20,
      start: o.start || 0
    });
    return (result && Array.isArray(result.results)) ? result.results : [];
  }

  /**
   * Obtiene los metadatos de un dataset.
   * @param {string} idOrName Id o name del dataset.
   * @returns {Promise<Object>}
   */
  async function obtenerDataset(idOrName) {
    return ckansCall('package_show', { id: idOrName });
  }

  /**
   * Obtiene los metadatos de un recurso.
   * @param {string} resourceId Id del recurso.
   * @returns {Promise<Object>}
   */
  async function obtenerRecurso(resourceId) {
    return ckansCall('resource_show', { id: resourceId });
  }

  /**
   * Descarga un recurso (CSV/JSON) por su URL y lo convierte en registros.
   * @param {Object} recurso Metadatos del recurso (debe tener .url y .format).
   * @returns {Promise<Array<Object>>}
   */
  async function descargarRecurso(recurso) {
    if (!recurso || !recurso.url) throw new Error('Madrid: el recurso no tiene URL');
    const res = await fetch(recurso.url);
    if (!res.ok) throw new Error('Madrid: error HTTP ' + res.status + ' al descargar el recurso');
    const formato = String(recurso.format || '').toLowerCase();
    const texto = await res.text();
    const IDEE = api();
    if (formato === 'json' || formato === 'geojson') {
      let obj;
      try { obj = JSON.parse(texto); } catch (e) { throw new Error('Madrid: el recurso no es JSON válido'); }
      if (IDEE && IDEE.layer && IDEE.layer.Alphanumeric && IDEE.layer.Alphanumeric.fromJSON) {
        const capa = IDEE.layer.Alphanumeric.fromJSON(obj, { source: { tipo: 'Madrid', recurso: recurso.id } });
        return capa.getRecords();
      }
      return Array.isArray(obj) ? obj : (obj.records || obj.data || obj.rows || []);
    }
    // CSV por defecto
    if (IDEE && IDEE.layer && IDEE.layer.Alphanumeric && IDEE.layer.Alphanumeric.fromCSV) {
      const capa = IDEE.layer.Alphanumeric.fromCSV(texto, { source: { tipo: 'Madrid', recurso: recurso.id } });
      return capa.getRecords();
    }
    // Respaldo: parseo mínimo
    return [];
  }

  /**
   * Carga un recurso del DataStore como capa Alphanumeric.
   * Si el recurso no está en el DataStore, intenta descargarlo por su URL.
   * @param {string} resourceId Id del recurso.
   * @param {Object} [opciones] { limit, offset, q, name, legend, columnas, series }
   * @returns {Promise<IDEE.layer.Alphanumeric>}
   */
  async function cargarRecurso(resourceId, opciones) {
    const o = opciones || {};
    const IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.Alphanumeric) {
      throw new Error('Madrid: IDEE.layer.Alphanumeric no disponible');
    }

    let registros = [];
    let campos = null;
    let desdeDatastore = false;

    try {
      // Intentar DataStore con paginación.
      const limit = o.limit || 1000;
      let offset = o.offset || 0;
      let total = Infinity;
      while (offset < total && registros.length < (o.maxRegistros || 50000)) {
        const r = await ckansCall('datastore_search', {
          resource_id: resourceId,
          limit: limit,
          offset: offset,
          q: o.q || ''
        });
        const recs = (r && Array.isArray(r.records)) ? r.records : [];
        if (campos == null && Array.isArray(r.fields)) {
          campos = r.fields.map(function (f) { return { name: f.id, type: f.type || 'string' }; });
        }
        registros = registros.concat(recs);
        total = (typeof r.total === 'number') ? r.total : recs.length;
        offset += recs.length;
        if (!recs.length) break;
      }
      desdeDatastore = true;
    } catch (e) {
      // El recurso puede no estar en el DataStore: se descarga por URL.
      desdeDatastore = false;
    }

    if (!desdeDatastore || !registros.length) {
      const recurso = await obtenerRecurso(resourceId);
      const recs = await descargarRecurso(recurso);
      registros = recs;
      if (!campos && registros.length) {
        campos = Object.keys(registros[0]).map(function (k) { return { name: k, type: 'string' }; });
      }
    }

    if (o.series) {
      registros = filtrarFilas(registros, o.series);
    }
    if (Array.isArray(o.columnas) && o.columnas.length) {
      const permitidas = {};
      o.columnas.forEach(function (c) { permitidas[String(c)] = true; });
      registros = registros.map(function (r) {
        const out = {};
        for (const k in r) {
          if (Object.prototype.hasOwnProperty.call(r, k) && permitidas[k]) out[k] = r[k];
        }
        return out;
      });
    }

    if (!registros.length) throw new Error('Madrid: el recurso ' + resourceId + ' no devolvió datos');

    const nombre = o.name || o.legend || ('Madrid recurso ' + resourceId);
    const capa = new IDEE.layer.Alphanumeric({
      name: nombre,
      legend: o.legend || nombre,
      records: registros,
      fields: campos || undefined,
      source: { tipo: 'Madrid', recurso: resourceId }
    });
    return capa;
  }

  function filtrarFilas(registros, criterio) {
    if (!Array.isArray(registros) || criterio == null || criterio === '') return registros;
    let fn;
    if (typeof criterio === 'function') fn = criterio;
    else {
      const lista = Array.isArray(criterio) ? criterio : [criterio];
      fn = function (r) {
        const texto = JSON.stringify(r || {}).toLowerCase();
        return lista.some(function (c) {
          if (c instanceof RegExp) return c.test(texto);
          return texto.indexOf(String(c).toLowerCase()) !== -1;
        });
      };
    }
    return registros.filter(fn);
  }

  /**
   * Carga un dataset por su id/name: usa su primer recurso disponible.
   * @param {string} idOrName Id o name del dataset.
   * @param {Object} [opciones]
   * @returns {Promise<IDEE.layer.Alphanumeric>}
   */
  async function cargarDataset(idOrName, opciones) {
    const o = opciones || {};
    const ds = await obtenerDataset(idOrName);
    const recursos = (ds && Array.isArray(ds.resources)) ? ds.resources : [];
    if (!recursos.length) throw new Error('Madrid: el dataset no tiene recursos');
    // Preferir un recurso con datastore_active o formato tabular.
    let recurso = recursos.find(function (r) { return r.datastore_active === true; });
    if (!recurso) recurso = recursos.find(function (r) { const f = String(r.format || '').toLowerCase(); return f === 'csv' || f === 'json' || f === 'geojson'; });
    if (!recurso) recurso = recursos[0];
    const capa = await cargarRecurso(recurso.id, Object.assign({}, o, {
      name: o.name || (ds.title || ds.name || idOrName)
    }));
    return capa;
  }

  function instalarFactory() {
    const IDEE = api();
    if (IDEE && IDEE.layer && IDEE.layer.Alphanumeric && !IDEE.layer.Alphanumeric.fromMadrid) {
      IDEE.layer.Alphanumeric.fromMadrid = function (resourceId, opciones) {
        return cargarRecurso(resourceId, opciones);
      };
    }
    try {
      if (window.IDEE && window.IDEE.layer && window.IDEE.layer.Alphanumeric) window.IDEE.layer.Alphanumeric.fromMadrid = IDEE.layer.Alphanumeric.fromMadrid;
    } catch (e) { /* noop */ }
    try {
      if (window.M && window.M.layer && window.M.layer.Alphanumeric) window.M.layer.Alphanumeric.fromMadrid = IDEE.layer.Alphanumeric.fromMadrid;
    } catch (e) { /* noop */ }
  }

  function crearPlugin(IDEE) {
    return class miPlugin_madridOpenDataLayer {
      constructor(options) { this.options = options || {}; this.name = 'miPlugin_madridOpenDataLayer'; this.map = null; }
      add(map) {
        this.map = map;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Madrid';
        btn.title = 'Cargar un dataset/recurso de Datos Abiertos de Madrid';
        btn.style.cssText = 'position:absolute;top:10px;left:60px;z-index:1000;padding:6px 10px;cursor:pointer;';
        const self = this;
        btn.addEventListener('click', async function () {
          const id = window.prompt('Id o nombre de dataset (ej. 300557-0-poblacion-distrito-barrio) o resource_id:', '300557-0-poblacion-distrito-barrio');
          if (!id) return;
          btn.disabled = true; btn.textContent = 'Cargando…';
          try {
            let capa;
            // Si parece un resource_id de datastore, intentar directo; si no, tratar como dataset.
            try { capa = await cargarRecurso(id, { name: 'Madrid ' + id }); }
            catch (e) { capa = await cargarDataset(id, { name: 'Madrid ' + id }); }
            capa.addTo(map);
            if (typeof window.renderLayerList === 'function') window.renderLayerList();
            window.alert('Capa Madrid cargada: ' + capa.legend);
          } catch (e) {
            window.alert('Error Madrid: ' + (e && e.message ? e.message : e));
          } finally {
            btn.disabled = false; btn.textContent = 'Madrid';
          }
        });
        const cont = (typeof map.getContainer === 'function') ? map.getContainer() : null;
        (cont || document.body).appendChild(btn);
        this._btn = btn;
      }
      destroy() { if (this._btn && this._btn.parentNode) this._btn.parentNode.removeChild(this._btn); this._btn = null; }
      getState() { return {}; }
      setState() { /* noop */ }
    };
  }

  function instalar() {
    const IDEE = api();
    if (!IDEE) return false;
    instalarFactory();
    if (IDEE.plugin && !IDEE.plugin.miPlugin_madridOpenDataLayer) {
      try { IDEE.plugin.miPlugin_madridOpenDataLayer = crearPlugin(IDEE); } catch (e) { /* noop */ }
    }
    try { if (window.IDEE && window.IDEE.plugin && IDEE.plugin.miPlugin_madridOpenDataLayer) window.IDEE.plugin.miPlugin_madridOpenDataLayer = IDEE.plugin.miPlugin_madridOpenDataLayer; } catch (e) {}
    try { if (window.M && window.M.plugin && IDEE.plugin.miPlugin_madridOpenDataLayer) window.M.plugin.miPlugin_madridOpenDataLayer = IDEE.plugin.miPlugin_madridOpenDataLayer; } catch (e) {}
    if (!window.Madrid) window.Madrid = {};
    window.Madrid.buscarDatasets = buscarDatasets;
    window.Madrid.obtenerDataset = obtenerDataset;
    window.Madrid.obtenerRecurso = obtenerRecurso;
    window.Madrid.cargarRecurso = cargarRecurso;
    window.Madrid.cargarDataset = cargarDataset;
    window.Madrid.BASE_URL = BASE_URL;
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
