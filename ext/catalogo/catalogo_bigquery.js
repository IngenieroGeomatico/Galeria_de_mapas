/* =====================================================================
   Formulario de BigQuery del plugin catálogo
   ---------------------------------------------------------------------
   El catálogo no debe abrir el panel de otro plugin: cuando la URL que se
   analiza es de BigQuery, el formulario de conexión, listado y carga de
   tablas se monta DENTRO de la pestaña "Añadir capa".

   Este módulo se carga desde catalogo.js y se apoya en:
     - ext/alphanumericLayer/alphanumericLayer.js (capa de datos y BigQueryLayer)
     - ext/bigqueryLayer/bigqueryLayer.js (BigQueryUtil: login y API REST)

   No crea ningún panel de la API ni registra miPlugin_bigqueryLayer. Todo
   lo que pinta vive en el contenedor que le pasa el catálogo.
   ===================================================================== */

(function () {
  'use strict';

  /** URL de este propio fichero, para resolver las dependencias vecinas. */
  const RUTA_PROPIA = (function () {
    const s = document.currentScript;
    if (s && s.src) return s.src;
    const lista = document.getElementsByTagName('script');
    for (let i = lista.length - 1; i >= 0; i--) {
      const src = lista[i].src || '';
      if (/catalogo\/catalogo_bigquery\.js(\?|#|$)/.test(src)) return src;
    }
    return '';
  })();

  /** Promesa de carga de las dependencias (solo se piden una vez). */
  let _cargaDependencias = null;

  /**
   * Carga un script y resuelve cuando está listo.
   * @param {string} url URL absoluta.
   * @returns {Promise<void>}
   */
  function cargarScript(url) {
    return new Promise(function (resolver, rechazar) {
      const s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.onload = function () { resolver(); };
      s.onerror = function () { rechazar(new Error('No se pudo cargar ' + url)); };
      document.head.appendChild(s);
    });
  }

  /**
   * Asegura la capa alfanumérica y las utilidades de BigQuery.
   * @returns {Promise<void>}
   */
  function cargarDependencias() {
    if (_cargaDependencias) return _cargaDependencias;
    const base = RUTA_PROPIA || document.baseURI;
    _cargaDependencias = (async function () {
      if (!window.AlphanumericLayer) {
        await cargarScript(new URL('../alphanumericLayer/alphanumericLayer.js', base).href);
      }
      if (!window.BigQueryUtil) {
        await cargarScript(new URL('../bigqueryLayer/bigqueryLayer.js', base).href);
      }
      if (window.AlphanumericLayer && typeof window.AlphanumericLayer.instalar === 'function') {
        window.AlphanumericLayer.instalar();
      }
    })().catch(function (err) {
      // Si falla, se permite reintentar al volver a pintar el formulario.
      _cargaDependencias = null;
      throw err;
    });
    return _cargaDependencias;
  }

  /** Escapa texto para meterlo en HTML. */
  function esc(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Deduce proyecto, dataset y tabla de la URL de BigQuery.
   * @param {string} url URL analizada.
   * @returns {{proyecto: string, dataset: string, tabla: string}}
   */
  function leerSeleccionDeUrl(url) {
    const salida = { proyecto: '', dataset: '', tabla: '' };
    try {
      const u = new URL(url);
      const q = u.searchParams;
      salida.proyecto = q.get('project') || q.get('proyecto') || q.get('p') || '';
      salida.dataset = q.get('dataset') || q.get('d') || '';
      salida.tabla = q.get('table') || q.get('tabla') || q.get('t') || '';
    } catch (e) { /* URL no parseable: se queda vacío */ }
    return salida;
  }

  /** Clase del formulario embebido. */
  class FormularioBigQuery {

    /**
     * @param {HTMLElement} contenedor Contenedor donde se monta.
     * @param {Object} [opciones]
     * @param {Object} [opciones.map] Mapa de la API.
     * @param {string} [opciones.url] URL de BigQuery analizada.
     * @param {string} [opciones.clientId] Client ID inicial.
     * @param {Object} [opciones.estado] Estado previo (cambio 2D/3D).
     * @param {Function} [opciones.onAviso] Mensajes para el catálogo.
     */
    constructor(contenedor, opciones) {
      const o = opciones || {};
      this._contenedor = contenedor;
      this._map = o.map || null;
      this._url = o.url || '';
      this._onAviso = (typeof o.onAviso === 'function') ? o.onAviso : null;
      this._destruido = false;
      this._el = null;
      this._ocupado = false;

      const deUrl = leerSeleccionDeUrl(this._url);
      this._clientId = o.clientId || '';
      this._proyecto = deUrl.proyecto;
      this._dataset = deUrl.dataset;
      this._tablaActiva = deUrl.tabla;
      this._tablasSeleccionadas = deUrl.tabla ? [deUrl.tabla] : [];
      this._limite = 10000;
      this._sql = '';
      this._campoGeo = '';
      this._tablaDetalle = null;
      this._tablas = [];
      this._proyectos = [];
      this._datasets = [];
      this._estadoPendiente = o.estado || null;
    }

    /** Monta el formulario y carga sus dependencias. */
    montar() {
      const self = this;
      this._contenedor.innerHTML = '';
      const espera = document.createElement('p');
      espera.className = 'catalogo__bq-estado';
      espera.textContent = 'Cargando el formulario de BigQuery…';
      this._contenedor.appendChild(espera);

      cargarDependencias().then(function () {
        if (self._destruido) return;
        self._construir();
      }).catch(function (err) {
        if (self._destruido) return;
        self._contenedor.innerHTML = '';
        const fallo = document.createElement('p');
        fallo.className = 'catalogo__bq-estado catalogo__bq-estado--error';
        fallo.textContent = 'No se pudo cargar BigQuery: ' + (err && err.message ? err.message : err);
        self._contenedor.appendChild(fallo);
        self._avisar(fallo.textContent, 'error');
      });
    }

    /** Construye el DOM del formulario. */
    _construir() {
      const origen = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
      this._contenedor.innerHTML = ''
        + '<div class="catalogo__bq">'
        + '  <p class="catalogo__bq-intro">Conecta con tu cuenta de Google y elige una o varias tablas. Las tablas con geometría se cargan como capa GeoJSON; las que no la tienen, como capa alfanumérica de BigQuery.</p>'

        + '  <section class="catalogo__bq-bloque">'
        + '    <label class="catalogo__bq-label" for="catalogo-bq-client-id">Client ID de Google</label>'
        + '    <input id="catalogo-bq-client-id" class="catalogo__bq-input" type="text" spellcheck="false" '
        + '      placeholder="1234567890-xxxx.apps.googleusercontent.com" data-campo="clientId">'
        + '    <div class="catalogo__bq-fila catalogo__bq-fila--botones">'
        + '      <button type="button" class="catalogo__bq-btn catalogo__bq-btn--primario" data-accion="conectar">Conectar</button>'
        + '      <button type="button" class="catalogo__bq-btn" data-accion="desconectar" hidden>Salir</button>'
        + '    </div>'
        + '    <p class="catalogo__bq-estado" data-estado="auth"></p>'
        + '    <details class="catalogo__bq-ayuda">'
        + '      <summary>¿No tienes Client ID? Crear uno (2 min)</summary>'
        + '      <ol class="catalogo__bq-pasos">'
        + '        <li>Abre <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console ↗</a>.</li>'
        + '        <li>Crea un proyecto y habilita la <strong>API de BigQuery</strong>.</li>'
        + '        <li>En "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth".</li>'
        + '        <li>Tipo: <strong>Aplicación web</strong>. Añade este origen en "Orígenes JavaScript autorizados": <code>' + esc(origen) + '</code></li>'
        + '        <li>Copia el Client ID y pégalo aquí. Pulsa "Conectar": aparecerá la ventana de Google para elegir tu cuenta.</li>'
        + '      </ol>'
        + '      <p class="catalogo__bq-aviso">El Client ID es público (no es una contraseña). El login se hace con tu cuenta de Google.</p>'
        + '    </details>'
        + '  </section>'

        + '  <section class="catalogo__bq-bloque" data-bloque="recursos" hidden>'
        + '    <label class="catalogo__bq-label">Proyecto</label>'
        + '    <select class="catalogo__bq-select" data-campo="proyecto"></select>'
        + '    <label class="catalogo__bq-label">Dataset</label>'
        + '    <select class="catalogo__bq-select" data-campo="dataset"></select>'
        + '    <label class="catalogo__bq-label">Tablas</label>'
        + '    <input class="catalogo__bq-input" type="search" placeholder="Filtrar tablas…" data-campo="filtroTabla">'
        + '    <div class="catalogo__bq-tablas" data-lista="tablas"></div>'
        + '    <p class="catalogo__bq-estado" data-estado="tablas"></p>'
        + '    <div class="catalogo__bq-detalle" data-detalle="tabla"></div>'
        + '    <div class="catalogo__bq-fila">'
        + '      <label class="catalogo__bq-label-inline">Límite'
        + '        <input class="catalogo__bq-input catalogo__bq-input--num" type="number" min="1" max="100000" step="1000" data-campo="limite">'
        + '      </label>'
        + '      <button type="button" class="catalogo__bq-btn" data-accion="estimar">Estimar coste</button>'
        + '    </div>'
        + '    <p class="catalogo__bq-estado" data-estado="coste"></p>'
        + '    <button type="button" class="catalogo__bq-btn catalogo__bq-btn--primario catalogo__bq-btn--ancho" data-accion="cargar">Cargar tablas seleccionadas</button>'
        + '  </section>'

        + '  <section class="catalogo__bq-bloque">'
        + '    <button type="button" class="catalogo__bq-btn catalogo__bq-btn--plegable" data-accion="toggle-sql">Consulta SQL</button>'
        + '    <div class="catalogo__bq-plegable" data-bloque="sql" hidden>'
        + '      <textarea class="catalogo__bq-textarea" rows="5" spellcheck="false" data-campo="sql" '
        + '        placeholder="SELECT * FROM `proyecto.dataset.tabla` LIMIT 1000"></textarea>'
        + '      <div class="catalogo__bq-fila catalogo__bq-fila--botones">'
        + '        <button type="button" class="catalogo__bq-btn" data-accion="generar-sql">Generar desde tabla</button>'
        + '        <button type="button" class="catalogo__bq-btn" data-accion="estimar-sql">Estimar</button>'
        + '        <button type="button" class="catalogo__bq-btn catalogo__bq-btn--primario" data-accion="ejecutar-sql">Ejecutar y cargar</button>'
        + '      </div>'
        + '      <p class="catalogo__bq-estado" data-estado="coste-sql"></p>'
        + '    </div>'
        + '  </section>'

        + '  <p class="catalogo__bq-estado" data-estado="general"></p>'
        + '</div>';

      const raiz = this._contenedor.querySelector('.catalogo__bq');
      this._el = {
        raiz: raiz,
        clientId: raiz.querySelector('[data-campo="clientId"]'),
        btnConectar: raiz.querySelector('[data-accion="conectar"]'),
        btnDesconectar: raiz.querySelector('[data-accion="desconectar"]'),
        estadoAuth: raiz.querySelector('[data-estado="auth"]'),
        recursos: raiz.querySelector('[data-bloque="recursos"]'),
        proyecto: raiz.querySelector('[data-campo="proyecto"]'),
        dataset: raiz.querySelector('[data-campo="dataset"]'),
        filtroTabla: raiz.querySelector('[data-campo="filtroTabla"]'),
        tablas: raiz.querySelector('[data-lista="tablas"]'),
        estadoTablas: raiz.querySelector('[data-estado="tablas"]'),
        detalle: raiz.querySelector('[data-detalle="tabla"]'),
        limite: raiz.querySelector('[data-campo="limite"]'),
        estadoCoste: raiz.querySelector('[data-estado="coste"]'),
        btnCargar: raiz.querySelector('[data-accion="cargar"]'),
        sql: raiz.querySelector('[data-campo="sql"]'),
        estadoCosteSql: raiz.querySelector('[data-estado="coste-sql"]'),
        estadoGeneral: raiz.querySelector('[data-estado="general"]'),
      };

      this._bind();
      this._pintarTodo();
    }

    /** Engancha los eventos de la interfaz. */
    _bind() {
      const el = this._el;
      const self = this;

      el.btnConectar.addEventListener('click', function () { self._conectar(); });
      el.btnDesconectar.addEventListener('click', function () {
        if (window.BigQueryUtil) window.BigQueryUtil.desconectar();
        self._tablaDetalle = null;
        self._pintarEstadoAuth();
        self._pintarTablas();
        self._pintarDetalle();
      });

      el.proyecto.addEventListener('change', function () {
        self._proyecto = el.proyecto.value;
        self._tablasSeleccionadas = [];
        self._tablaActiva = '';
        self._tablaDetalle = null;
        self._campoGeo = '';
        self._pintarDetalle();
        self._cargarDatasets();
      });
      el.dataset.addEventListener('change', function () {
        self._dataset = el.dataset.value;
        self._tablasSeleccionadas = [];
        self._tablaActiva = '';
        self._tablaDetalle = null;
        self._campoGeo = '';
        self._pintarDetalle();
        self._cargarTablas();
      });
      el.filtroTabla.addEventListener('input', function () { self._pintarTablas(); });

      el.tablas.addEventListener('change', function (ev) {
        const input = ev.target.closest('input[type="checkbox"]');
        if (!input) return;
        const tabla = input.value;
        if (input.checked) {
          if (self._tablasSeleccionadas.indexOf(tabla) === -1) self._tablasSeleccionadas.push(tabla);
          self._seleccionarTabla(tabla);
        } else {
          self._tablasSeleccionadas = self._tablasSeleccionadas.filter(function (t) { return t !== tabla; });
          if (self._tablaActiva === tabla) {
            self._tablaActiva = self._tablasSeleccionadas[0] || '';
            if (self._tablaActiva) self._seleccionarTabla(self._tablaActiva);
            else { self._tablaDetalle = null; self._pintarDetalle(); }
          }
        }
        self._pintarTablas();
      });

      el.limite.addEventListener('input', function () {
        self._limite = Math.max(1, Math.min(Number(el.limite.value) || 10000, 100000));
      });

      el.raiz.querySelector('[data-accion="estimar"]').addEventListener('click', function () {
        self._estimarSeleccion();
      });
      el.btnCargar.addEventListener('click', function () { self._cargarSeleccion(); });

      el.raiz.querySelector('[data-accion="toggle-sql"]').addEventListener('click', function () {
        const b = el.raiz.querySelector('[data-bloque="sql"]');
        b.hidden = !b.hidden;
      });
      el.raiz.querySelector('[data-accion="generar-sql"]').addEventListener('click', function () {
        self._generarSqlDesdeTabla();
      });
      el.raiz.querySelector('[data-accion="estimar-sql"]').addEventListener('click', function () {
        const sql = (el.sql.value || '').trim();
        if (!sql) { self._setEstado(el.estadoCosteSql, 'Escribe una consulta', 'error'); return; }
        self._estimar(sql, el.estadoCosteSql);
      });
      el.raiz.querySelector('[data-accion="ejecutar-sql"]').addEventListener('click', function () {
        const sql = (el.sql.value || '').trim();
        if (!sql) { self._setEstado(el.estadoCosteSql, 'Escribe una consulta', 'error'); return; }
        self._ejecutarYcargar(sql, {
          nombre: 'Consulta BigQuery',
          proyecto: self._proyecto,
          dataset: null,
          tabla: null,
          limite: self._limite,
          geometryField: null,
          tipo: 'auto',
        }).catch(function (err) {
          self._setEstado(el.estadoCosteSql, err.message || String(err), 'error');
        });
      });
      el.sql.addEventListener('input', function () { self._sql = el.sql.value; });
    }

    /** Pinta el estado inicial completo. */
    _pintarTodo() {
      if (!this._el) return;
      this._clientId = this._clientId || (window.BigQueryUtil ? window.BigQueryUtil.leerClientId() : '');
      this._el.clientId.value = this._clientId || '';
      this._el.limite.value = this._limite;
      this._el.sql.value = this._sql || '';
      this._pintarEstadoAuth();
      this._pintarTablas();
      this._pintarDetalle();

      if (this._estadoPendiente) {
        this.setState(this._estadoPendiente);
      } else if (window.BigQueryUtil && window.BigQueryUtil.tokenValido()) {
        this._cargarProyectos({ proyecto: this._proyecto, dataset: this._dataset, tabla: this._tablaActiva });
      }
    }

    /** Pinta la sesión y muestra u oculta los recursos. */
    _pintarEstadoAuth() {
      if (!this._el) return;
      const util = window.BigQueryUtil;
      const estado = util ? util.estadoAuth() : { valido: false, expira: 0 };
      this._el.recursos.hidden = !estado.valido;
      this._el.btnDesconectar.hidden = !estado.valido;
      this._el.btnConectar.textContent = estado.valido ? 'Reconectar' : 'Conectar';
      if (!estado.valido) {
        this._setEstado(this._el.estadoAuth, 'Sin sesión', '');
        return;
      }
      const minutos = Math.max(0, Math.round((estado.expira - Date.now()) / 60000));
      this._setEstado(this._el.estadoAuth, 'Conectado · caduca en ' + minutos + ' min', 'ok');
    }

    /** Conecta con Google y carga los proyectos. */
    _conectar() {
      const util = window.BigQueryUtil;
      if (!util) return;
      const clientId = (this._el.clientId.value || '').trim();
      if (!clientId) {
        this._setEstado(this._el.estadoAuth, 'Falta el Client ID de Google', 'error');
        return;
      }
      this._clientId = clientId;
      this._setEstado(this._el.estadoAuth, 'Conectando con Google…', 'info');
      util.conectar(clientId).then(() => {
        util.guardarClientId(clientId);
        this._pintarEstadoAuth();
        return this._cargarProyectos({
          proyecto: this._proyecto,
          dataset: this._dataset,
          tabla: this._tablaActiva,
        });
      }).catch((err) => {
        if (this._destruido || !this._el) return;
        this._setEstado(this._el.estadoAuth, err.message || String(err), 'error');
      });
    }

    /**
     * Carga los proyectos del usuario.
     * @param {Object} [seleccion]
     * @returns {Promise<void>}
     */
    _cargarProyectos(seleccion) {
      const util = window.BigQueryUtil;
      if (!this._el || !util || !util.tokenValido()) return Promise.resolve();
      const sel = seleccion || {};
      this._setEstado(this._el.estadoAuth, 'Cargando proyectos…', 'info');
      return util.listarProyectos().then((proyectos) => {
        if (this._destruido || !this._el) return;
        this._proyectos = proyectos || [];
        const select = this._el.proyecto;
        select.innerHTML = '';
        this._proyectos.forEach(function (p) {
          const id = p.id || (p.projectReference && p.projectReference.projectId);
          if (!id) return;
          const op = document.createElement('option');
          op.value = id;
          op.textContent = p.friendlyName && p.friendlyName !== id ? (p.friendlyName + ' (' + id + ')') : id;
          select.appendChild(op);
        });
        const objetivo = sel.proyecto || this._proyecto || (this._proyectos[0] && (this._proyectos[0].id || this._proyectos[0].projectReference.projectId)) || '';
        const existe = objetivo && Array.from(select.options).some(function (o) { return o.value === objetivo; });
        if (existe) select.value = objetivo;
        else if (select.options.length) select.selectedIndex = 0;
        this._proyecto = select.value || '';
        this._pintarEstadoAuth();
        return this._cargarDatasets(sel);
      }).catch((err) => {
        if (this._destruido || !this._el) return;
        this._setEstado(this._el.estadoAuth, err.message || String(err), 'error');
      });
    }

    /**
     * Carga los datasets del proyecto seleccionado.
     * @param {Object} [seleccion]
     * @returns {Promise<void>}
     */
    _cargarDatasets(seleccion) {
      const util = window.BigQueryUtil;
      if (!this._el || !util || !util.tokenValido()) return Promise.resolve();
      const sel = seleccion || {};
      const proyecto = this._el.proyecto.value || this._proyecto;
      if (!proyecto) return Promise.resolve();
      this._proyecto = proyecto;
      return util.listarDatasets(proyecto).then((datasets) => {
        if (this._destruido || !this._el) return;
        this._datasets = datasets || [];
        const select = this._el.dataset;
        select.innerHTML = '';
        this._datasets.forEach(function (d) {
          const id = d.datasetReference ? d.datasetReference.datasetId : d.id;
          if (!id) return;
          const op = document.createElement('option');
          op.value = id;
          op.textContent = d.friendlyName && d.friendlyName !== id ? (d.friendlyName + ' (' + id + ')') : id;
          select.appendChild(op);
        });
        const objetivo = sel.dataset || this._dataset || (this._datasets[0] && (this._datasets[0].datasetReference ? this._datasets[0].datasetReference.datasetId : this._datasets[0].id)) || '';
        const existe = objetivo && Array.from(select.options).some(function (o) { return o.value === objetivo; });
        if (existe) select.value = objetivo;
        else if (select.options.length) select.selectedIndex = 0;
        this._dataset = select.value || '';
        return this._cargarTablas(sel);
      }).catch((err) => {
        if (this._destruido || !this._el) return;
        this._setEstado(this._el.estadoAuth, err.message || String(err), 'error');
      });
    }

    /**
     * Carga las tablas del dataset seleccionado.
     * @param {Object} [seleccion]
     * @returns {Promise<void>}
     */
    _cargarTablas(seleccion) {
      const util = window.BigQueryUtil;
      if (!this._el || !util || !util.tokenValido()) return Promise.resolve();
      const sel = seleccion || {};
      const proyecto = this._proyecto;
      const dataset = this._el.dataset.value || this._dataset;
      if (!proyecto || !dataset) return Promise.resolve();
      this._dataset = dataset;
      this._tablas = [];
      this._pintarTablas();
      this._setEstado(this._el.estadoTablas, 'Cargando tablas…', 'info');
      return util.listarTablas(proyecto, dataset).then((tablas) => {
        if (this._destruido || !this._el) return;
        this._tablas = tablas || [];
        this._setEstado(this._el.estadoTablas, '', '');

        // Restaura la selección guardada por el cambio 2D/3D.
        const pend = this._estadoPendiente;
        if (pend) {
          const ids = this._tablas.map(function (t) {
            return t.tableReference ? t.tableReference.tableId : t.id;
          });
          this._tablasSeleccionadas = (Array.isArray(pend.tablas) ? pend.tablas : []).filter(function (id) {
            return ids.indexOf(id) !== -1;
          });
          this._tablaActiva = (pend.tablaActiva && ids.indexOf(pend.tablaActiva) !== -1) ? pend.tablaActiva : '';
          this._campoGeo = pend.geometry || '';
          this._limite = Math.max(1, Math.min(Number(pend.limite) || this._limite, 100000));
          this._sql = pend.sql || '';
          this._el.limite.value = this._limite;
          this._el.sql.value = this._sql;
          this._estadoPendiente = null;
        }

        this._pintarTablas();
        const objetivo = sel.tabla || this._tablaActiva;
        if (objetivo && this._tablas.some(function (t) {
          return (t.tableReference ? t.tableReference.tableId : t.id) === objetivo;
        })) {
          if (this._tablasSeleccionadas.indexOf(objetivo) === -1) this._tablasSeleccionadas.push(objetivo);
          this._seleccionarTabla(objetivo);
        }
        return null;
      }).catch((err) => {
        if (this._destruido || !this._el) return;
        this._setEstado(this._el.estadoTablas, err.message || String(err), 'error');
      });
    }

    /** Pinta la lista de tablas con su filtro. */
    _pintarTablas() {
      if (!this._el) return;
      const filtro = (this._el.filtroTabla.value || '').toLowerCase();
      const cont = this._el.tablas;
      cont.innerHTML = '';
      const visibles = this._tablas.filter(function (t) {
        const id = t.tableReference ? t.tableReference.tableId : t.id;
        return !filtro || String(id).toLowerCase().indexOf(filtro) !== -1;
      });
      if (!visibles.length) {
        const vacio = document.createElement('p');
        vacio.className = 'catalogo__bq-vacio';
        vacio.textContent = this._tablas.length ? 'Ninguna tabla coincide con el filtro.' : 'Este dataset no tiene tablas.';
        cont.appendChild(vacio);
        return;
      }
      visibles.forEach(function (t) {
        const id = t.tableReference ? t.tableReference.tableId : t.id;
        const label = document.createElement('label');
        label.className = 'catalogo__bq-tabla';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = id;
        input.checked = this._tablasSeleccionadas.indexOf(id) !== -1;
        const texto = document.createElement('span');
        texto.textContent = id;
        label.appendChild(input);
        label.appendChild(texto);
        cont.appendChild(label);
      }, this);
    }

    /**
     * Selecciona una tabla y pinta su ficha.
     * @param {string} tabla Id de la tabla.
     * @returns {Promise<void>}
     */
    _seleccionarTabla(tabla) {
      const util = window.BigQueryUtil;
      if (!this._el || !util || !tabla) return Promise.resolve();
      if (this._tablaActiva && this._tablaActiva !== tabla) this._campoGeo = '';
      this._tablaActiva = tabla;
      if (this._tablasSeleccionadas.indexOf(tabla) === -1) this._tablasSeleccionadas.push(tabla);
      this._pintarTablas();
      this._setEstado(this._el.estadoCoste, 'Leyendo esquema de ' + tabla + '…', 'info');
      return util.getTabla(this._proyecto, this._dataset, tabla).then((t) => {
        if (this._destruido || !this._el || this._tablaActiva !== tabla) return;
        this._tablaDetalle = t;
        this._pintarDetalle();
        this._setEstado(this._el.estadoCoste, '', '');
      }).catch((err) => {
        if (this._destruido || !this._el) return;
        this._setEstado(this._el.estadoCoste, err.message || String(err), 'error');
      });
    }

    /** Pinta la ficha de la tabla activa. */
    _pintarDetalle() {
      if (!this._el) return;
      const cont = this._el.detalle;
      const t = this._tablaDetalle;
      cont.innerHTML = '';
      if (!t) return;

      const util = window.BigQueryUtil;
      const campos = (t.schema && t.schema.fields) || [];
      const geo = util.detectarColumnasGeo(t.schema);
      const filas = t.numRows ? util.formatearNumero(t.numRows) : '?';
      const bytes = t.numBytes ? util.formatearBytes(t.numBytes) : '?';
      const ref = [this._proyecto, this._dataset, this._tablaActiva].join('.');

      const cabecera = document.createElement('p');
      cabecera.className = 'catalogo__bq-ref';
      cabecera.title = ref;
      cabecera.textContent = ref;
      cont.appendChild(cabecera);

      const meta = document.createElement('p');
      meta.className = 'catalogo__bq-meta';
      meta.textContent = filas + ' filas · ' + bytes;
      cont.appendChild(meta);

      const details = document.createElement('details');
      details.className = 'catalogo__bq-campos';
      const summary = document.createElement('summary');
      summary.textContent = campos.length + ' campos';
      details.appendChild(summary);
      const ul = document.createElement('ul');
      campos.forEach(function (c) {
        const li = document.createElement('li');
        const nombre = document.createElement('span');
        nombre.className = 'catalogo__bq-campo-nombre';
        nombre.textContent = c.name;
        const tipo = document.createElement('span');
        tipo.className = 'catalogo__bq-campo-tipo';
        tipo.textContent = c.mode === 'REPEATED' ? (c.type + '[]') : c.type;
        li.appendChild(nombre);
        li.appendChild(tipo);
        ul.appendChild(li);
      });
      details.appendChild(ul);
      cont.appendChild(details);

      const label = document.createElement('label');
      label.className = 'catalogo__bq-label';
      label.textContent = 'Campo de geometría';
      const select = document.createElement('select');
      select.className = 'catalogo__bq-select';
      select.setAttribute('data-campo', 'campoGeo');

      const opciones = [];
      opciones.push({ value: '', text: 'Ninguno (solo datos)' });
      campos.forEach(function (c) {
        const esGeo = c.type === 'GEOGRAPHY';
        const esGeoJson = /geojson|geometry|geom|the_geom|shape|geo|location|coordinates/i.test(c.name);
        if (esGeo || esGeoJson) {
          opciones.push({
            value: 'campo:' + c.name,
            text: c.name + (esGeo ? ' (GEOGRAPHY)' : ' (GeoJSON)')
          });
        }
      });
      if (geo.latField && geo.lonField) {
        opciones.push({
          value: 'latlon:' + geo.latField + ',' + geo.lonField,
          text: geo.latField + ' + ' + geo.lonField + ' (lat/lon)'
        });
      }
      opciones.forEach(function (o) {
        const op = document.createElement('option');
        op.value = o.value;
        op.textContent = o.text;
        select.appendChild(op);
      });

      const porDefecto = geo.geoField
        ? ('campo:' + geo.geoField)
        : (geo.latField && geo.lonField ? ('latlon:' + geo.latField + ',' + geo.lonField) : '');
      if (this._campoGeo && opciones.some(function (o) { return o.value === this._campoGeo; }, this)) {
        select.value = this._campoGeo;
      } else if (porDefecto) {
        select.value = porDefecto;
        this._campoGeo = porDefecto;
      }
      const self = this;
      select.addEventListener('change', function () { self._campoGeo = select.value; });
      label.appendChild(select);
      cont.appendChild(label);

      if (!geo.geoField && !(geo.latField && geo.lonField)) {
        const aviso = document.createElement('p');
        aviso.className = 'catalogo__bq-aviso';
        aviso.textContent = 'Sin geometría detectada: se cargará como capa alfanumérica.';
        cont.appendChild(aviso);
      }
    }

    /**
     * Construye el SQL de la tabla activa.
     * @param {Object} tablaDetalle Metadatos de la tabla.
     * @param {string} campoGeo Selección de geometría.
     * @param {number} limite Límite de filas.
     * @returns {string}
     */
    _sqlDeTabla(tablaDetalle, campoGeo, limite) {
      const util = window.BigQueryUtil;
      const schema = tablaDetalle && tablaDetalle.schema;
      const campos = (schema && schema.fields) || [];
      let geoField = null;
      if (campoGeo && campoGeo.indexOf('campo:') === 0) {
        const nombre = campoGeo.slice(6);
        const campo = campos.filter(function (c) { return c.name === nombre; })[0];
        if (campo && campo.type === 'GEOGRAPHY') geoField = nombre;
      }
      return util.construirSQL(this._proyecto, this._dataset, this._tablaActiva, schema, {
        limit: limite,
        geoField: geoField,
      });
    }

    /** Estima el coste de la tabla activa. */
    _estimarSeleccion() {
      const t = this._tablaDetalle;
      if (!t) {
        this._setEstado(this._el.estadoCoste, 'Selecciona una tabla', 'error');
        return;
      }
      const sql = this._sqlDeTabla(t, this._campoGeo, this._limite);
      this._estimar(sql, this._el.estadoCoste);
    }

    /**
     * Ejecuta un dryRun y muestra los bytes estimados.
     * @param {string} sql Consulta.
     * @param {HTMLElement} destino Elemento de estado.
     */
    _estimar(sql, destino) {
      const util = window.BigQueryUtil;
      if (!util || !util.tokenValido()) {
        this._setEstado(destino, 'Conecta con Google primero', 'error');
        return;
      }
      if (!this._proyecto) {
        this._setEstado(destino, 'Selecciona un proyecto', 'error');
        return;
      }
      this._setEstado(destino, 'Estimando…', 'info');
      util.ejecutarConsulta(this._proyecto, sql, { dryRun: true }).then((j) => {
        const bytes = Number(j.totalBytesProcessed) || 0;
        this._setEstado(destino, 'Coste estimado: ' + util.formatearBytes(bytes) + ' (LIMIT no reduce los bytes escaneados)', 'ok');
      }).catch((err) => {
        this._setEstado(destino, err.message || String(err), 'error');
      });
    }

    /** Carga las tablas marcadas. */
    _cargarSeleccion() {
      const tablas = this._tablasSeleccionadas.slice();
      if (!tablas.length) {
        this._setEstado(this._el.estadoCoste, 'Marca al menos una tabla', 'error');
        return;
      }
      if (!window.BigQueryUtil || !window.BigQueryUtil.tokenValido()) {
        this._setEstado(this._el.estadoCoste, 'Conecta con Google primero', 'error');
        return;
      }
      if (this._ocupado) return;
      this._ocupado = true;

      const self = this;
      let cargadas = 0;
      const fallos = [];
      const siguiente = function (indice) {
        if (indice >= tablas.length) {
          self._ocupado = false;
          const texto = 'Cargadas ' + cargadas + ' de ' + tablas.length + ' tabla(s)' +
            (fallos.length ? ' · ' + fallos.length + ' error(es)' : '');
          if (!self._destruido && self._el) {
            self._setEstado(self._el.estadoCoste, texto, fallos.length ? 'aviso' : 'ok');
          }
          self._avisar(texto, fallos.length ? 'aviso' : 'ok');
          return;
        }
        const tabla = tablas[indice];
        const campoGeo = (tablas.length === 1) ? self._campoGeo : '';
        self._setEstado(self._el.estadoCoste, 'Cargando ' + tabla + '…', 'info');
        self._cargarTabla(tabla, campoGeo).then(function () {
          cargadas += 1;
        }).catch(function (err) {
          fallos.push(tabla + ': ' + (err && err.message ? err.message : err));
        }).then(function () {
          siguiente(indice + 1);
        });
      };
      siguiente(0);
    }

    /**
     * Carga una tabla de BigQuery en el mapa.
     * @param {string} tabla Id de la tabla.
     * @param {string} campoGeo Selección de geometría (vacío = automática).
     * @returns {Promise<void>}
     */
    async _cargarTabla(tabla, campoGeo) {
      const util = window.BigQueryUtil;
      const t = await util.getTabla(this._proyecto, this._dataset, tabla);
      const schema = t && t.schema;
      const geo = util.detectarColumnasGeo(schema);
      const seleccion = campoGeo || '';
      let usarGeo = false;
      let usarLatLon = false;
      let campoGeoSeleccionado = null;
      let latSel = null;
      let lonSel = null;

      if (seleccion.indexOf('campo:') === 0) {
        campoGeoSeleccionado = seleccion.slice(6);
        usarGeo = !!campoGeoSeleccionado;
      } else if (seleccion.indexOf('latlon:') === 0) {
        const partes = seleccion.slice(7).split(',');
        latSel = partes[0] || null;
        lonSel = partes[1] || null;
        usarLatLon = !!(latSel && lonSel);
      }

      // Sin selección explícita se usa la geometría detectada: GEOGRAPHY,
      // GeoJSON o par lat/lon. Si no hay nada, la capa es alfanumérica.
      if (!seleccion) {
        if (geo.geoField) {
          campoGeoSeleccionado = geo.geoField;
          usarGeo = true;
        } else if (geo.latField && geo.lonField) {
          latSel = geo.latField;
          lonSel = geo.lonField;
          usarLatLon = true;
        }
      }

      const geoFieldParaSql = (usarGeo && geo.geoField === campoGeoSeleccionado) ? campoGeoSeleccionado : null;
      const sql = util.construirSQL(this._proyecto, this._dataset, tabla, schema, {
        limit: this._limite,
        geoField: geoFieldParaSql,
      });

      const nombre = tabla;
      await this._ejecutarYcargar(sql, {
        nombre: nombre,
        proyecto: this._proyecto,
        dataset: this._dataset,
        tabla: tabla,
        limite: this._limite,
        latField: usarLatLon ? latSel : null,
        lonField: usarLatLon ? lonSel : null,
        geometryField: usarGeo ? (geoFieldParaSql ? '__idee_geojson' : campoGeoSeleccionado) : null,
        tipo: (usarGeo || usarLatLon) ? 'geojson' : 'alphanumeric',
      });
    }

    /**
     * Ejecuta el SQL y crea la capa correspondiente.
     * @param {string} sql Consulta.
     * @param {Object} meta Metadatos de la capa.
     * @returns {Promise<void>}
     */
    async _ejecutarYcargar(sql, meta) {
      const util = window.BigQueryUtil;
      if (!util || !util.tokenValido()) throw new Error('Conecta con Google primero');
      if (!this._proyecto) throw new Error('Selecciona un proyecto');
      if (!this._map) throw new Error('El catálogo no tiene mapa');

      const res = await util.ejecutarConsulta(this._proyecto, sql, {
        maxResults: meta.limite || this._limite,
      });
      const objetos = util.filasAObjetos(res.schema, res.rows);
      if (!objetos.length) throw new Error('La consulta no devolvió filas');

      let tipo = meta.tipo;
      if (tipo === 'auto') {
        const det = util.detectarCamposGeoEnResultados(objetos);
        const tieneGeo = !!(det.geoField || det.latField);
        tipo = tieneGeo ? 'geojson' : 'alphanumeric';
        if (tieneGeo && !meta.geometryField) {
          meta.geometryField = det.geoField || null;
          if (!meta.latField && det.latField) meta.latField = det.latField;
          if (!meta.lonField && det.lonField) meta.lonField = det.lonField;
        }
      }

      if (tipo === 'geojson') {
        const fc = util.construirFeatureCollection(objetos, meta);
        if (!fc.features.length) throw new Error('No se pudo construir ninguna geometría');
        const A = window.IDEE || window.M;
        const capa = new A.layer.GeoJSON({
          name: meta.nombre,
          legend: meta.nombre,
          source: fc,
          extract: true,
        });
        this._map.addLayers(capa);
      } else {
        const AL = window.AlphanumericLayer;
        if (!AL) throw new Error('Falta ext/alphanumericLayer/alphanumericLayer.js');
        AL.instalar();
        const Clase = window.BigQueryLayer ? window.BigQueryLayer : AL;
        const capa = new Clase({
          name: meta.nombre,
          legend: meta.nombre,
          records: objetos,
          sql: sql,
          proyecto: meta.proyecto || this._proyecto,
          dataset: meta.dataset || null,
          tabla: meta.tabla || null,
          limite: meta.limite || this._limite,
          latField: meta.latField || null,
          lonField: meta.lonField || null,
          geometryField: meta.geometryField || null,
          source: {
            type: 'bigquery',
            proyecto: meta.proyecto || this._proyecto,
            dataset: meta.dataset || null,
            tabla: meta.tabla || null,
          },
        });
        capa.addTo(this._map);
      }

      this._setEstado(this._el.estadoCoste, 'Cargados ' + util.formatearNumero(objetos.length) + ' registros de ' + meta.nombre, 'ok');
      this._avisar('Capa cargada: ' + meta.nombre + ' (' + util.formatearNumero(objetos.length) + ' registros)', 'ok');
    }

    /** Genera el SQL de la tabla activa y lo deja en el editor. */
    _generarSqlDesdeTabla() {
      const t = this._tablaDetalle;
      if (!t) {
        this._setEstado(this._el.estadoCosteSql, 'Selecciona una tabla primero', 'error');
        return;
      }
      const sql = this._sqlDeTabla(t, this._campoGeo, this._limite);
      this._el.sql.value = sql;
      this._sql = sql;
      const bloque = this._el.raiz.querySelector('[data-bloque="sql"]');
      if (bloque) bloque.hidden = false;
      this._setEstado(this._el.estadoCosteSql, 'SQL generada. Puedes editarla y ejecutar.', 'ok');
    }

    /**
     * Aplica un estado guardado (cambio 2D/3D).
     * @param {Object} estado Estado.
     */
    setState(estado) {
      if (!estado || typeof estado !== 'object') return;
      this._estadoPendiente = estado;
      if (estado.clientId) this._clientId = estado.clientId;
      if (typeof estado.proyecto === 'string') this._proyecto = estado.proyecto;
      if (typeof estado.dataset === 'string') this._dataset = estado.dataset;
      if (typeof estado.tablaActiva === 'string') this._tablaActiva = estado.tablaActiva;
      if (Array.isArray(estado.tablas)) this._tablasSeleccionadas = estado.tablas.slice();
      if (typeof estado.geometry === 'string') this._campoGeo = estado.geometry;
      if (estado.limite) this._limite = Math.max(1, Math.min(Number(estado.limite) || this._limite, 100000));
      if (typeof estado.sql === 'string') this._sql = estado.sql;
      if (!this._el) return;
      this._el.clientId.value = this._clientId || '';
      this._el.limite.value = this._limite;
      this._el.sql.value = this._sql || '';
      this._pintarEstadoAuth();
      if (window.BigQueryUtil && window.BigQueryUtil.tokenValido()) {
        this._cargarProyectos({
          proyecto: this._proyecto,
          dataset: this._dataset,
          tabla: this._tablaActiva,
        });
      }
    }

    /** Devuelve el estado serializable del formulario. */
    getState() {
      return {
        clientId: this._clientId || '',
        proyecto: this._proyecto || '',
        dataset: this._dataset || '',
        tablas: this._tablasSeleccionadas.slice(),
        tablaActiva: this._tablaActiva || '',
        geometry: this._campoGeo || '',
        limite: this._limite,
        sql: this._sql || '',
      };
    }

    /** Suelta el formulario. */
    destroy() {
      this._destruido = true;
      this._el = null;
      this._contenedor.innerHTML = '';
    }

    /**
     * Escribe un mensaje de estado en un nodo.
     * @param {HTMLElement} el Nodo.
     * @param {string} texto Texto.
     * @param {string} [clase] ok|aviso|error|info.
     */
    _setEstado(el, texto, clase) {
      if (!el) return;
      el.textContent = texto || '';
      el.className = 'catalogo__bq-estado' + (clase ? (' catalogo__bq-estado--' + clase) : '');
    }

    /**
     * Avisa al catálogo.
     * @param {string} texto Texto.
     * @param {string} [clase] Clase.
     */
    _avisar(texto, clase) {
      if (this._onAviso) this._onAviso(texto, clase || '');
    }
  }

  if (typeof window !== 'undefined') {
    window.CatalogoBigQuery = {
      /**
       * Crea el formulario dentro de un contenedor.
       * @param {HTMLElement} contenedor Contenedor.
       * @param {Object} [opciones] Opciones.
       * @returns {FormularioBigQuery}
       */
      crear: function (contenedor, opciones) {
        const form = new FormularioBigQuery(contenedor, opciones);
        form.montar();
        return form;
      },
    };
  }
})();
