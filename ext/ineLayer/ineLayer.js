/* =====================================================================
   ext/ineLayer/ineLayer.js
   ---------------------------------------------------------------------
   Plugin/utilidad para leer el servicio REST del INE (Instituto Nacional
   de Estadística) y crear una capa IDEE.layer.Alphanumeric a partir de una
   tabla de INEbase (base de datos Tempus3).

   API del INE usada
   -----------------
   GET https://servicios.ine.es/wstempus/js/es/DATOS_TABLA/{idTabla}
   (opcional ?nult=N para quedarse con los últimos N periodos)

   Respuesta: array de series, cada una con la forma
     { "Nombre": "Andalucía, RECURSOS: ...",
       "Data": [ { "NombrePeriodo": "2023 (P)", "Valor": 3.6e7, "Secreto": false }, ... ] }

   Se transforma a registros planos:
     { serie, periodo, valor, secreto }
   donde `serie` es el nombre de la serie y `periodo` el periodo (año).

   Uso
   ---
     // Desde código:
     const capa = await window.INE.cargarTabla('67301', { nult: 5, name: 'Renta CCAA' });
     capa.addTo(mapajs);

     // O como factory estática:
     const capa2 = await IDEE.layer.Alphanumeric.fromINE('67301', { nult: 5 });

   El servicio del INE permite CORS (access-control-allow-origin: *), así que
   la petición se hace directamente desde el navegador, sin proxy.
   ===================================================================== */

(function () {
  'use strict';

  function api() {
    return window.IDEE || window.M || null;
  }

  const BASE_URL = 'https://servicios.ine.es/wstempus/js/es';

  /**
   * Descarga una tabla de INEbase y la convierte en una capa Alphanumeric.
   * @param {string|number} tablaId Identificador de la tabla (ej. '67301').
   * @param {Object} [opciones]
   *   - nult: number   últimos periodos a traer
   *   - name, legend: nombre/leyenda de la capa
   *   - pivot: boolean si true, un registro por serie con una columna por periodo
   * @returns {Promise<IDEE.layer.Alphanumeric>}
   */
  async function cargarTabla(tablaId, opciones) {
    const o = opciones || {};
    const id = String(tablaId == null ? '' : tablaId).trim();
    if (!id) throw new Error('INE: falta el identificador de tabla');

    let url = BASE_URL + '/DATOS_TABLA/' + encodeURIComponent(id);
    if (o.nult != null && o.nult !== '') {
      url += '?nult=' + encodeURIComponent(o.nult);
    }

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('INE: error HTTP ' + res.status + ' al pedir ' + url);
    const data = await res.json();

    const IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.Alphanumeric) {
      throw new Error('INE: IDEE.layer.Alphanumeric no está disponible');
    }

    const registros = [];
    if (Array.isArray(data)) {
      if (o.pivot) {
        // Un registro por serie, con una columna por periodo.
        for (const serie of data) {
          if (!serie || !Array.isArray(serie.Data)) continue;
          const rec = { serie: serie.Nombre };
          for (const dp of serie.Data) {
            if (!dp) continue;
            const periodo = String(dp.NombrePeriodo || '').trim();
            rec[periodo] = (dp.Secreto ? null : dp.Valor);
          }
          registros.push(rec);
        }
      } else {
        // Forma larga: un registro por (serie, periodo).
        for (const serie of data) {
          if (!serie || !Array.isArray(serie.Data)) continue;
          for (const dp of serie.Data) {
            if (!dp) continue;
            registros.push({
              serie: serie.Nombre,
              periodo: dp.NombrePeriodo,
              valor: (dp.Secreto ? null : dp.Valor),
              secreto: !!dp.Secreto
            });
          }
        }
      }
    } else if (data && typeof data === 'object') {
      // Por si el endpoint devuelve un objeto envolvente.
      const arr = data.Data || data.data || data.Series || data.series || null;
      if (Array.isArray(arr)) {
        for (const dp of arr) registros.push(dp);
      }
    }

    if (!registros.length) {
      throw new Error('INE: la tabla ' + id + ' no devolvió datos');
    }

    const nombre = o.name || o.legend || ('INE tabla ' + id);
    const capa = new IDEE.layer.Alphanumeric({
      name: nombre,
      legend: o.legend || nombre,
      records: registros,
      idField: o.idField || null,
      source: { tipo: 'INE', tabla: id, url: url }
    });

    return capa;
  }

  function instalarFactory() {
    const IDEE = api();
    if (IDEE && IDEE.layer && IDEE.layer.Alphanumeric && !IDEE.layer.Alphanumeric.fromINE) {
      IDEE.layer.Alphanumeric.fromINE = function (tablaId, opciones) {
        return cargarTabla(tablaId, opciones);
      };
    }
    try {
      if (window.IDEE && window.IDEE.layer && window.IDEE.layer.Alphanumeric) {
        window.IDEE.layer.Alphanumeric.fromINE = IDEE.layer.Alphanumeric.fromINE;
      }
    } catch (e) { /* noop */ }
    try {
      if (window.M && window.M.layer && window.M.layer.Alphanumeric) {
        window.M.layer.Alphanumeric.fromINE = IDEE.layer.Alphanumeric.fromINE;
      }
    } catch (e) { /* noop */ }
  }

  function crearPlugin(IDEE) {
    return class miPlugin_ineLayer {
      constructor(options) {
        this.options = options || {};
        this.name = 'miPlugin_ineLayer';
        this.map = null;
      }
      add(map) {
        this.map = map;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'INE';
        btn.title = 'Cargar una tabla del INE (INEbase/Tempus3)';
        btn.style.cssText = 'position:absolute;top:10px;left:10px;z-index:1000;padding:6px 10px;cursor:pointer;';
        const self = this;
        btn.addEventListener('click', async function () {
          const id = window.prompt('Identificador de tabla INE (ej. 67301):', '67301');
          if (!id) return;
          btn.disabled = true;
          btn.textContent = 'Cargando…';
          try {
            const capa = await cargarTabla(id, { name: 'INE ' + id });
            capa.addTo(map);
            if (typeof window.renderLayerList === 'function') window.renderLayerList();
            window.alert('Capa INE cargada: ' + capa.legend);
          } catch (e) {
            window.alert('Error INE: ' + (e && e.message ? e.message : e));
          } finally {
            btn.disabled = false;
            btn.textContent = 'INE';
          }
        });
        const cont = (typeof map.getContainer === 'function') ? map.getContainer() : null;
        (cont || document.body).appendChild(btn);
        this._btn = btn;
      }
      destroy() {
        if (this._btn && this._btn.parentNode) this._btn.parentNode.removeChild(this._btn);
        this._btn = null;
      }
      getState() { return {}; }
      setState() { /* noop */ }
    };
  }

  function instalar() {
    const IDEE = api();
    if (!IDEE) return false;
    instalarFactory();
    if (IDEE.plugin && !IDEE.plugin.miPlugin_ineLayer) {
      try { IDEE.plugin.miPlugin_ineLayer = crearPlugin(IDEE); } catch (e) { /* noop */ }
    }
    try {
      if (window.IDEE && window.IDEE.plugin && IDEE.plugin.miPlugin_ineLayer) {
        window.IDEE.plugin.miPlugin_ineLayer = IDEE.plugin.miPlugin_ineLayer;
      }
    } catch (e) { /* noop */ }
    try {
      if (window.M && window.M.plugin && IDEE.plugin.miPlugin_ineLayer) {
        window.M.plugin.miPlugin_ineLayer = IDEE.plugin.miPlugin_ineLayer;
      }
    } catch (e) { /* noop */ }
    if (!window.INE) window.INE = {};
    window.INE.cargarTabla = cargarTabla;
    window.INE.BASE_URL = BASE_URL;
    return true;
  }

  instalar();

  // Reinstalación sin sondeo infinito.
  let reintentos = 0;
  const vigilante = setInterval(function () {
    reintentos += 1;
    if (instalar() || reintentos >= 100) {
      try { clearInterval(vigilante); } catch (e) { /* noop */ }
    }
  }, 50);

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      const obj = e && e.target;
      if (obj && obj.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(obj.src || '')) {
        instalar();
      }
    }, true);
  }
})();
