/* =====================================================================
   Comparación de vistas — supraplugin para API-IDEE (modelo IFRAME)
   --------------------------------------------------------------------
   Reimplementación (sin dependencia de "virgilio" ni de ol-ext) del
   comparador de mapas. Es un SUPRAPLUGIN: vive en una barra transversal
   (miPlugin_supraplugin) sobre el visualizador y gestiona VARIAS "vistas".

   CADA VISTA ES UN <iframe> que carga mapas/comparacionVistas/vista.html
   con ?impl=ol|cesium. Motivo: la API-IDEE usa UN objeto global `IDEE`
   ligado a UN bundle (OpenLayers o Cesium); no admite ambos motores vivos
   a la vez en el mismo documento. Aislando cada vista en su propio iframe,
   cada una tiene su `IDEE` independiente y PUEDEN COEXISTIR una vista 2D
   (OpenLayers) y otra 3D (Cesium) en la misma pantalla.

   La sincronización de encuadre se hace por postMessage:
     - El iframe emite  { type:'cmpv:view',  lon, lat, zoom } en continuo.
     - El padre reenvía  { type:'cmpv:setView', lon, lat, zoom } al resto.
   Un guard per-vista (`_progUpdates`) evita bucles de realimentación.

   Herramientas:
     - Crear vista        -> nueva vista (iframe) clonando el encuadre actual.
     - Ver vista          -> elige qué vista ocupa el área principal.
     - Cortinilla (swipe) -> dos vistas superpuestas + divisor (clip-path).
     - Espejo             -> N vistas en rejilla lado a lado, sincronizadas.
     - Opciones           -> gestión de vistas (renombrar, eliminar, 2D/3D
                             por vista, nº columnas, sincronización on/off).

   Integración (ver mapas/comparacionVistas/js/mapa.js):
     const supra = new miPlugin_supraplugin({ id:'supra-top', position:'top' });
     const comp  = new miPlugin_comparacionVistas({ vistaUrl:'./vista.html' });
     supra.addItem(comp);
     mapajs.addPlugin(supra);
   ===================================================================== */
(function () {
  "use strict";

  function api() { return window.IDEE || window.M; }

  var _uid = 0;
  function nextUid() { _uid += 1; return _uid; }

  // Máximo común divisor / mínimo común múltiplo (para el nº de columnas base
  // del CSS Grid cuando las filas tienen distinto número de celdas).
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }

  class miPlugin_comparacionVistas {
    /**
     * @param {Object} options
     * @param {string} [options.vistaUrl] URL de la página de vista (iframe).
     *        Por defecto "./vista.html" relativo al visualizador.
     * @param {number} [options.lon] Centro inicial (lon). Def. -3.70
     * @param {number} [options.lat] Centro inicial (lat). Def. 40.42
     * @param {number} [options.zoom] Zoom inicial. Def. 12
     * @param {string} [options.id]
     */
    constructor(options = {}) {
      this.name = "miPlugin_comparacionVistas";
      this.options = options || {};
      this.id = this.options.id || ("comparacionVistas-" + nextUid());
      this.vistaUrl = this.options.vistaUrl || "./vista.html";
      this.initLon = (typeof this.options.lon === "number") ? this.options.lon : -3.70;
      this.initLat = (typeof this.options.lat === "number") ? this.options.lat : 40.42;
      this.initZoom = (typeof this.options.zoom === "number") ? this.options.zoom : 12;

      this.supra = null;
      this.ui = null;
      this._workArea = null;

      // view = { id, name, impl:'ol'|'cesium', iframe, div, ready, lastView, _progUpdates }
      this.views = [];
      this.mode = "single";          // "single" | "swipe" | "mirror"
      this.sync = true;
      this.activeViewId = null;
      this.swipe = { a: null, b: null, pos: 0.5, orientation: "vertical" };
      // Estructura del grid de espejo: array de FILAS; cada fila es un array de
      // viewIds (celdas). Permite grid IRREGULAR (filas con distinto nº de
      // celdas). Se inicializa al entrar en modo espejo si está vacío.
      this.grid = [];
      // Tipo de disposición del espejo: "grid" (regular, filas × columnas) o
      // "custom" (irregular: cada fila tiene su propio nº de celdas).
      this.layoutType = "grid";
      // Especificación del grid irregular: array con el nº de celdas por fila.
      // p.ej. [1, 3, 2] = fila1 con 1 celda, fila2 con 3, fila3 con 2.
      this.customSpec = [1, 2];
      this._divisor = null;

      // Escucha global de mensajes de los iframes.
      var self = this;
      this._onMessage = function (ev) { self._handleViewMessage(ev); };
      window.addEventListener("message", this._onMessage);
    }

    // --- Contrato de item del supraplugin ----------------------------------
    getSupraElement(supra) {
      this.supra = supra;
      this._resolveWorkArea();
      this._adoptPrimaryView();
      this.ui = this._buildUI();
      this._refreshUI();
      // Coloca la vista inicial.
      this._relayout();
      return this.ui;
    }

    // Área de trabajo: un stage que llena #mapaDIV y aloja los iframes de vistas.
    _resolveWorkArea() {
      var host = document.getElementById("mapaDIV") || document.getElementById("mapa");
      if (!host && this.supra && this.supra._host) host = this.supra._host;
      if (!host) return;
      var cs = window.getComputedStyle(host);
      if (cs.position === "static") host.style.position = "relative";
      host.style.overflow = "hidden";
      this._host = host;

      var stage = host.querySelector(":scope > .cmpv-stage");
      if (!stage) {
        stage = document.createElement("div");
        stage.className = "cmpv-stage";
        host.appendChild(stage);
      }
      this._workArea = stage;
    }

    // La vista primaria también es un iframe (así todas son homogéneas y el 3D
    // por-vista funciona igual para todas). El mapa original de #mapaDIV no se usa
    // como vista: el comparador toma el control del área con sus iframes.
    _adoptPrimaryView() {
      if (this.views.length) return;
      var primary = this._makeView({
        name: "Vista 1",
        impl: "ol",
        isPrimary: true,
        lon: this.initLon, lat: this.initLat, zoom: this.initZoom,
      });
      this.activeViewId = primary.id;
    }

    // Crea el objeto vista + su iframe dentro del stage.
    _makeView(opts) {
      opts = opts || {};
      var id = "vista-" + nextUid();
      var div = document.createElement("div");
      div.className = "cmpv-view";
      div.id = "cmpv-view-" + id;

      var iframe = document.createElement("iframe");
      iframe.className = "cmpv-iframe";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allow", "fullscreen");
      var lon = (typeof opts.lon === "number") ? opts.lon : this.initLon;
      var lat = (typeof opts.lat === "number") ? opts.lat : this.initLat;
      var zoom = (typeof opts.zoom === "number") ? opts.zoom : this.initZoom;
      var impl = (opts.impl === "cesium") ? "cesium" : "ol";
      iframe.src = this._buildVistaUrl(id, impl, lon, lat, zoom);
      div.appendChild(iframe);
      this._workArea.appendChild(div);

      var view = {
        id: id,
        name: opts.name || ("Vista " + (this.views.length + 1)),
        impl: impl,
        iframe: iframe,
        div: div,
        isPrimary: !!opts.isPrimary,
        ready: false,
        lastView: { lon: lon, lat: lat, zoom: zoom },
        _progUpdates: 0,
      };
      this.views.push(view);
      return view;
    }

    _buildVistaUrl(vpId, impl, lon, lat, zoom) {
      var q = "?impl=" + impl + "&vp=" + encodeURIComponent(vpId) +
        "&lon=" + encodeURIComponent(lon) +
        "&lat=" + encodeURIComponent(lat) +
        "&zoom=" + encodeURIComponent(zoom);
      return this.vistaUrl + q;
    }

    _viewByFrame(win) {
      for (var i = 0; i < this.views.length; i++) {
        if (this.views[i].iframe && this.views[i].iframe.contentWindow === win) return this.views[i];
      }
      return null;
    }
    getView(id) {
      for (var i = 0; i < this.views.length; i++) if (this.views[i].id === id) return this.views[i];
      return null;
    }

    // =====================================================================
    //  Mensajería con los iframes (sincronización)
    // =====================================================================
    _handleViewMessage(ev) {
      var d = ev.data;
      if (!d || d.source !== "cmpv-vista" || typeof d.type !== "string") return;
      var v = this._viewByFrame(ev.source) || (d.vpId ? this.getView(d.vpId) : null);
      if (!v) return;

      if (d.type === "cmpv:ready") {
        v.ready = true;
        // El iframe informa de su implementación real al estar listo.
        if (d.impl === "ol" || d.impl === "cesium") v.impl = d.impl;
        // Reaplica el último encuadre conocido por si el iframe arrancó en otro.
        if (v.lastView) this._sendSetView(v, v.lastView);
        this._refreshUI();
        return;
      }

      // El botón 🌐 dentro de la vista cambió su implementación (2D<->3D). El
      // iframe se recargará solo; aquí actualizamos estado y badge de inmediato.
      if (d.type === "cmpv:implChange") {
        if (d.impl === "ol" || d.impl === "cesium") v.impl = d.impl;
        if (typeof d.lon === "number") v.lastView = { lon: d.lon, lat: d.lat, zoom: d.zoom };
        v.ready = false;
        this._refreshUI();
        return;
      }

      if (d.type === "cmpv:view") {
        // Guardamos el encuadre como EXTENT (área visible) si viene; si no,
        // como centro+zoom (compatibilidad con el arranque).
        v.lastView = d.extent ? { extent: d.extent } : { lon: d.lon, lat: d.lat, zoom: d.zoom };
        if (!this.sync) return;
        if (v._progUpdates > 0) return;   // eco de un setView que enviamos: ignora
        this._broadcast(v, v.lastView);
      }
    }

    // Envía un encuadre a una vista (marcándolo como programático para que su
    // eco no vuelva a difundirse: el propio iframe ya ignora _prog, pero además
    // marcamos aquí para el caso de que el 'view' llegue antes de asentar).
    _sendSetView(v, state) {
      if (!v || !v.iframe || !v.iframe.contentWindow || !state) return;
      v._progUpdates += 1;
      try {
        var msg = { type: "cmpv:setView", target: v.id };
        if (state.extent) msg.extent = state.extent;       // sincronización por área visible
        else { msg.lon = state.lon; msg.lat = state.lat; msg.zoom = state.zoom; }
        v.iframe.contentWindow.postMessage(msg, "*");
      } catch (e) {}
      // Libera el guard tras un margen (el iframe emite su 'view' de eco poco después).
      setTimeout(function () { v._progUpdates = Math.max(0, v._progUpdates - 1); }, 120);
    }

    // Difunde el encuadre de `src` a las demás vistas.
    _broadcast(src, state) {
      var self = this;
      this.views.forEach(function (v) {
        if (v === src) return;
        self._sendSetView(v, state);
      });
    }

    // Re-sincroniza todas las vistas desde la activa (o la primera).
    _resyncFromActive() {
      if (!this.sync) return;
      var ref = this.getView(this.activeViewId) || this.views[0];
      if (!ref || !ref.lastView) return;
      this._broadcast(ref, ref.lastView);
    }

    // =====================================================================
    //  UI (barra + sidenav) — estilo QGIS2API-IDEE
    // =====================================================================
    _buildUI() {
      var self = this;
      var root = document.createElement("div");
      root.className = "cmpv";

      root.innerHTML =
        '<div class="cmpv-tools" role="toolbar" aria-label="Comparación de vistas">' +
        '  <button type="button" class="cmpv-tool" data-act="crear" title="Crear una vista nueva">' +
        '    <span class="cmpv-ico">➕</span><span class="cmpv-lbl">Crear</span></button>' +
        '  <button type="button" class="cmpv-tool" data-act="single" title="Ver una sola vista">' +
        '    <span class="cmpv-ico">👁</span><span class="cmpv-lbl">Ver</span></button>' +
        '  <button type="button" class="cmpv-tool" data-act="cortinilla" title="Comparar con cortinilla">' +
        '    <span class="cmpv-ico">🪟</span><span class="cmpv-lbl">Cortinilla</span></button>' +
        '  <button type="button" class="cmpv-tool" data-act="espejo" title="Comparar en espejo">' +
        '    <span class="cmpv-ico">🪞</span><span class="cmpv-lbl">Espejo</span></button>' +
        '  <button type="button" class="cmpv-tool cmpv-tool--cfg" data-act="opciones" title="Opciones / configuración">' +
        '    <span class="cmpv-ico">⚙</span><span class="cmpv-lbl">Opciones</span></button>' +
        '</div>' +
        '<div class="cmpv-sidenav" data-role="sidenav">' +
        '  <div class="cmpv-sidenav__header">' +
        '    <span>Configuración de la comparación</span>' +
        '    <button type="button" class="cmpv-sidenav__close" data-role="close-cfg" title="Cerrar">&times;</button>' +
        '  </div>' +
        '  <div class="cmpv-sidenav__body">' +
        '    <label class="cmpv-field"><input type="checkbox" data-role="sync" checked> Sincronizar encuadre entre vistas</label>' +
        '    <label class="cmpv-field" data-only="swipe">Orientación de la cortinilla' +
        '      <select class="cmpv-select" data-role="orientation">' +
        '        <option value="vertical">Vertical</option>' +
        '        <option value="horizontal">Horizontal</option></select></label>' +
        '    <div class="cmpv-field cmpv-field--grid" data-only="mirror">' +
        '      <span class="cmpv-grid__title">Disposición (espejo)</span>' +
        '      <label class="cmpv-grid-type">Tipo' +
        '        <select class="cmpv-select" data-role="layout-type">' +
        '          <option value="grid">Filas × columnas</option>' +
        '          <option value="custom">Grid (irregular)</option>' +
        '        </select>' +
        '      </label>' +
        '      <div class="cmpv-grid-inputs" data-role="grid-inputs">' +
        '        <label>Filas <input type="number" class="cmpv-num" data-role="rows" min="1" max="6" value="1"></label>' +
        '        <label>Columnas <input type="number" class="cmpv-num" data-role="cols" min="1" max="6" value="2"></label>' +
        '      </div>' +
        '      <div class="cmpv-custom" data-role="custom-inputs" style="display:none">' +
        '        <div class="cmpv-custom__hint">Define cada fila y cuántas celdas (vistas) tiene. Cada fila reparte su ancho entre sus celdas.</div>' +
        '        <div class="cmpv-custom__rows" data-role="custom-rows"></div>' +
        '        <button type="button" class="cmpv-custom__add" data-role="add-row">➕ Añadir fila</button>' +
        '      </div>' +
        '    </div>' +
        '    <div class="cmpv-sidenav__subtitle">Gestión de vistas</div>' +
        '    <table class="cmpv-table">' +
        '      <thead><tr><th data-role="th-eye" title="Vista visible en modo Ver">👁</th><th>Vista</th><th>Modo</th><th></th></tr></thead>' +
        '      <tbody data-role="lista"></tbody></table>' +
        '  </div>' +
        '</div>';

      root.querySelectorAll(".cmpv-tool").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var act = btn.getAttribute("data-act");
          if (act === "crear") self.crearVista();
          else if (act === "cortinilla") self.setMode("swipe");
          else if (act === "espejo") self.setMode("mirror");
          else if (act === "single") self.setMode("single");
          else if (act === "opciones") self.toggleOpciones();
        });
      });
      root.querySelector('[data-role="close-cfg"]').addEventListener("click", function () { self.toggleOpciones(false); });
      root.querySelector('[data-role="sync"]').addEventListener("change", function () {
        self.sync = this.checked; if (self.sync) self._resyncFromActive();
      });
      root.querySelector('[data-role="orientation"]').addEventListener("change", function () {
        self.swipe.orientation = this.value; if (self.mode === "swipe") self._layoutSwipe();
      });

      // --- Disposición del espejo: selector de tipo (regular | irregular) ---
      var typeSel = root.querySelector('[data-role="layout-type"]');
      var gridInputs = root.querySelector('[data-role="grid-inputs"]');
      var customInputs = root.querySelector('[data-role="custom-inputs"]');
      var rowsInput = root.querySelector('[data-role="rows"]');
      var colsInput = root.querySelector('[data-role="cols"]');
      var addRowBtn = root.querySelector('[data-role="add-row"]');
      this._customRowsEl = root.querySelector('[data-role="custom-rows"]');

      // Aplica la disposición REGULAR (filas × columnas).
      var applyGrid = function () {
        var r = parseInt(rowsInput.value, 10) || 1;
        var c = parseInt(colsInput.value, 10) || 1;
        self._setGridRegular(r, c);
        self.setMode("mirror");   // aplica el layout y crea vistas si faltan
      };

      // Muestra los inputs del tipo activo (regular vs irregular) y, al pasar a
      // "custom", vuelca la disposición actual al editor de filas.
      var syncTypeUI = function () {
        var t = typeSel ? typeSel.value : "grid";
        self.layoutType = t;
        if (gridInputs) gridInputs.style.display = (t === "grid") ? "" : "none";
        if (customInputs) customInputs.style.display = (t === "custom") ? "" : "none";
        if (t === "custom") self._renderCustomEditor();
      };
      this._syncTypeUI = syncTypeUI;

      if (typeSel) typeSel.addEventListener("change", function () {
        syncTypeUI();
        if (typeSel.value === "custom") self._applyCustomFromEditor();
        else applyGrid();
      });
      if (rowsInput) rowsInput.addEventListener("change", applyGrid);
      if (colsInput) colsInput.addEventListener("change", applyGrid);
      if (addRowBtn) addRowBtn.addEventListener("click", function () {
        self._customSpecPush(1);        // añade una fila nueva con 1 celda
        self._renderCustomEditor();
        self._applyCustomFromEditor();
      });
      syncTypeUI();

      return root;
    }

    _refreshUI() {
      if (!this.ui) return;
      var self = this;
      this.ui.querySelectorAll(".cmpv-tool[data-act]").forEach(function (btn) {
        var act = btn.getAttribute("data-act");
        var on = (act === "single" && self.mode === "single")
          || (act === "cortinilla" && self.mode === "swipe")
          || (act === "espejo" && self.mode === "mirror");
        btn.classList.toggle("cmpv-tool--active", on);
      });
      this.ui.querySelectorAll("[data-only]").forEach(function (el) {
        el.style.display = (el.getAttribute("data-only") === self.mode) ? "" : "none";
      });
      this._renderListaVistas();
    }

    toggleOpciones(force) {
      var nav = this.ui.querySelector('[data-role="sidenav"]');
      if (!nav) return;
      var open = (typeof force === "boolean") ? force : !nav.classList.contains("cmpv-sidenav--open");
      nav.classList.toggle("cmpv-sidenav--open", open);
      var cfgBtn = this.ui.querySelector('.cmpv-tool--cfg');
      if (cfgBtn) cfgBtn.classList.toggle("cmpv-tool--active", open);
    }

    _renderListaVistas() {
      var self = this;
      var lista = this.ui.querySelector('[data-role="lista"]');
      if (!lista) return;

      // El selector de vista visible (ojo) sólo tiene sentido en modo "Ver"
      // (una única vista). En cortinilla/espejo se ocultan la columna y su
      // cabecera.
      var eyeOn = (this.mode === "single");
      var th = this.ui.querySelector('[data-role="th-eye"]');
      if (th) th.style.display = eyeOn ? "" : "none";

      lista.innerHTML = "";
      this.views.forEach(function (v) {
        var row = document.createElement("tr");

        // Ojo de visualización activa: marca la vista visible en modo "Ver".
        if (eyeOn) {
          var tdEye = document.createElement("td");
          var eye = document.createElement("button");
          eye.type = "button";
          var isActive = (v.id === self.activeViewId);
          eye.className = "cmpv-eye" + (isActive ? " cmpv-eye--active" : "");
          eye.textContent = isActive ? "👁" : "👁‍🗨";
          eye.title = isActive ? "Vista visible en modo Ver" : "Mostrar esta vista (modo Ver)";
          eye.setAttribute("aria-pressed", isActive ? "true" : "false");
          eye.addEventListener("click", function () {
            self.activeViewId = v.id;
            self.setMode("single");   // activa modo Ver mostrando esta vista
          });
          tdEye.appendChild(eye);
          row.appendChild(tdEye);
        }

        var tdName = document.createElement("td");
        var name = document.createElement("input");
        name.type = "text"; name.className = "cmpv-vname"; name.value = v.name;
        name.addEventListener("change", function () { v.name = this.value || v.name; self._refreshUI(); });
        tdName.appendChild(name);

        // Conmutador 2D/3D POR VISTA.
        var tdMode = document.createElement("td");
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "cmpv-mode cmpv-mode--" + (v.impl === "cesium" ? "d3" : "d2");
        toggle.textContent = v.impl === "cesium" ? "3D" : "2D";
        toggle.title = "Cambiar entre 2D (OpenLayers) y 3D (Cesium)";
        toggle.addEventListener("click", function () { self.toggleImpl(v.id); });
        tdMode.appendChild(toggle);

        var tdDel = document.createElement("td");
        var del = document.createElement("button");
        del.type = "button"; del.className = "cmpv-vdel"; del.textContent = "🗑";
        del.title = "Eliminar vista";
        del.disabled = v.isPrimary;
        del.addEventListener("click", function () { self.eliminarVista(v.id); });
        tdDel.appendChild(del);

        row.appendChild(tdName); row.appendChild(tdMode); row.appendChild(tdDel);
        lista.appendChild(row);
      });
    }

    // =====================================================================
    //  Herramientas
    // =====================================================================
    // Deriva un centro+zoom aproximado de un estado (que puede ser {extent} o
    // {lon,lat,zoom}). Se usa sólo para el ENCUADRE INICIAL de un iframe nuevo;
    // la sincronización fina posterior va por extent vía postMessage.
    _centerZoomFromState(state) {
      if (!state) return { lon: this.initLon, lat: this.initLat, zoom: this.initZoom };
      if (typeof state.lon === "number") {
        return { lon: state.lon, lat: state.lat, zoom: (typeof state.zoom === "number") ? state.zoom : this.initZoom };
      }
      if (state.extent) {
        var e = state.extent;
        var lon = (e.west + e.east) / 2;
        var lat = (e.south + e.north) / 2;
        // zoom aproximado a partir del ancho del extent (grados -> nivel tesela).
        var spanLon = Math.abs(e.east - e.west) || 0.01;
        var zoom = Math.log2(360 / spanLon);
        if (!isFinite(zoom)) zoom = this.initZoom;
        return { lon: lon, lat: lat, zoom: Math.max(1, Math.min(20, zoom)) };
      }
      return { lon: this.initLon, lat: this.initLat, zoom: this.initZoom };
    }

    crearVista(opts = {}) {
      if (!this._workArea) this._resolveWorkArea();
      var ref = this.getView(this.activeViewId) || this.views[0];
      var cz = this._centerZoomFromState(ref && ref.lastView);
      var view = this._makeView({
        name: opts.name || ("Vista " + (this.views.length + 1)),
        impl: opts.impl || "ol",
        lon: cz.lon, lat: cz.lat, zoom: cz.zoom,
      });
      // Hereda el encuadre de la referencia (extent) para sincronizar al estar listo.
      if (ref && ref.lastView) view.lastView = ref.lastView;
      this._refreshUI();
      this._relayout();
      return view;
    }

    verVista(id) {
      this.activeViewId = id;
      if (this.mode === "single") this._layoutSingle();
      this._refreshUI();
    }

    eliminarVista(id) {
      var v = this.getView(id);
      if (!v || v.isPrimary) return;
      if (v.div && v.div.parentNode) v.div.parentNode.removeChild(v.div);
      this.views = this.views.filter(function (x) { return x.id !== id; });
      if (this.activeViewId === id) this.activeViewId = this.views[0] && this.views[0].id;
      if (this.swipe.a === id || this.swipe.b === id) this._pickSwipePair();
      this._relayout();
      this._refreshUI();
    }

    // Cambia el motor (2D/3D) de UNA vista: recarga su iframe con la otra
    // implementación, preservando el encuadre actual.
    toggleImpl(id) {
      var v = this.getView(id);
      if (!v) return;
      var newImpl = (v.impl === "cesium") ? "ol" : "cesium";
      v.impl = newImpl;
      v.ready = false;
      var cz = this._centerZoomFromState(v.lastView);
      // Recarga el iframe con la nueva implementación y el encuadre preservado.
      v.iframe.src = this._buildVistaUrl(v.id, newImpl, cz.lon, cz.lat, cz.zoom);
      this._refreshUI();
    }

    // =====================================================================
    //  Modos de comparación / layout
    // =====================================================================
    // Construye un grid REGULAR de rows×cols: crea las vistas que falten
    // (reutilizando las existentes) y rellena this.grid. Límite de seguridad 16.
    _setGridRegular(rows, cols) {
      rows = Math.max(1, Math.min(rows | 0, 6));
      cols = Math.max(1, Math.min(cols | 0, 6));
      var total = Math.min(rows * cols, 16);
      // Crea vistas hasta cubrir el total.
      while (this.views.length < total) this.crearVista();
      // Distribuye las primeras `total` vistas en la rejilla.
      var grid = [];
      var idx = 0;
      for (var r = 0; r < rows && idx < total; r++) {
        var row = [];
        for (var c = 0; c < cols && idx < total; c++) {
          row.push(this.views[idx].id);
          idx += 1;
        }
        grid.push(row);
      }
      this.grid = grid;
    }

    // ---- Grid IRREGULAR (editor por filas) --------------------------------
    // this.customSpec es un array con el nº de celdas por fila. Estos helpers
    // sanean, mutan y aplican esa especificación.
    _normalizeCustomSpec() {
      var spec = (this.customSpec || []).map(function (n) {
        n = parseInt(n, 10) || 1;
        return Math.max(1, Math.min(n, 6));   // 1..6 celdas por fila
      }).filter(function (n) { return n > 0; });
      if (!spec.length) spec = [1, 2];
      // Límite de seguridad: nº total de celdas <= 16.
      var acc = 0, out = [];
      for (var i = 0; i < spec.length; i++) {
        if (acc + spec[i] > 16) { var room = 16 - acc; if (room > 0) out.push(room); break; }
        out.push(spec[i]); acc += spec[i];
      }
      this.customSpec = out.length ? out : [1, 2];
      return this.customSpec;
    }

    _customSpecTotal() {
      return this._normalizeCustomSpec().reduce(function (a, b) { return a + b; }, 0);
    }

    _customSpecPush(cells) {
      this.customSpec = (this.customSpec || []).slice();
      this.customSpec.push(Math.max(1, Math.min(parseInt(cells, 10) || 1, 6)));
      this._normalizeCustomSpec();
    }

    _customSpecRemove(index) {
      this.customSpec = (this.customSpec || []).slice();
      if (this.customSpec.length > 1) this.customSpec.splice(index, 1);
      this._normalizeCustomSpec();
    }

    // Construye this.grid a partir de customSpec, creando/reutilizando vistas.
    _setGridCustom(spec) {
      if (spec) this.customSpec = spec.slice();
      var s = this._normalizeCustomSpec();
      var total = this._customSpecTotal();
      while (this.views.length < total) this.crearVista();
      var grid = [];
      var idx = 0;
      for (var r = 0; r < s.length && idx < total; r++) {
        var row = [];
        for (var c = 0; c < s[r] && idx < total; c++) {
          row.push(this.views[idx].id);
          idx += 1;
        }
        if (row.length) grid.push(row);
      }
      this.grid = grid;
    }

    // Pinta el editor de filas (un control por fila con su nº de celdas).
    _renderCustomEditor() {
      var self = this;
      var cont = this._customRowsEl;
      if (!cont) return;
      this._normalizeCustomSpec();
      cont.innerHTML = "";
      this.customSpec.forEach(function (cells, i) {
        var row = document.createElement("div");
        row.className = "cmpv-custom__row";

        var lbl = document.createElement("span");
        lbl.className = "cmpv-custom__lbl";
        lbl.textContent = "Fila " + (i + 1);

        var input = document.createElement("input");
        input.type = "number";
        input.className = "cmpv-num";
        input.min = "1"; input.max = "6";
        input.value = String(cells);
        input.setAttribute("aria-label", "Celdas de la fila " + (i + 1));
        input.addEventListener("change", function () {
          var v = Math.max(1, Math.min(parseInt(this.value, 10) || 1, 6));
          self.customSpec[i] = v;
          self._applyCustomFromEditor();
          self._renderCustomEditor();
        });

        var cellsLbl = document.createElement("span");
        cellsLbl.className = "cmpv-custom__unit";
        cellsLbl.textContent = "celdas";

        var del = document.createElement("button");
        del.type = "button";
        del.className = "cmpv-custom__del";
        del.textContent = "🗑";
        del.title = "Eliminar fila";
        del.disabled = (self.customSpec.length <= 1);
        del.addEventListener("click", function () {
          self._customSpecRemove(i);
          self._renderCustomEditor();
          self._applyCustomFromEditor();
        });

        row.appendChild(lbl);
        row.appendChild(input);
        row.appendChild(cellsLbl);
        row.appendChild(del);
        cont.appendChild(row);
      });
    }

    // Aplica la especificación del editor al layout de espejo.
    _applyCustomFromEditor() {
      this._setGridCustom();
      this.setMode("mirror");
    }

    setMode(mode) {
      if (mode === "swipe" && this.views.length < 2) {
        this.crearVista();
      }
      if (mode === "mirror") {
        // Inicializa el grid si está vacío, respetando el tipo activo.
        if (!this.grid || !this.grid.length) {
          if (this.layoutType === "custom") {
            this._setGridCustom();
          } else {
            if (this.views.length < 2) this.crearVista();
            this.grid = [this.views.slice(0, 2).map(function (v) { return v.id; })];
          }
        }
      }
      this.mode = mode;
      this._relayout();
      this._refreshUI();
    }

    _relayout() {
      if (this.mode === "single") this._layoutSingle();
      else if (this.mode === "swipe") this._layoutSwipe();
      else if (this.mode === "mirror") this._layoutMirror();
      // Tras dimensionar, reenvía el encuadre de la activa al resto.
      var self = this;
      setTimeout(function () { self._resyncFromActive(); }, 120);
      setTimeout(function () { self._resyncFromActive(); }, 400);
    }

    // Deja el stage en modo posicionamiento ABSOLUTO (single/swipe) y limpia
    // cualquier estilo de CSS Grid, tanto del stage como de las vistas.
    _resetViewDivs() {
      var stage = this._workArea;
      if (stage) {
        stage.style.display = "";           // vuelve a block (posición absoluta)
        stage.style.gridTemplateColumns = "";
        stage.style.gridTemplateRows = "";
      }
      this.views.forEach(function (v) {
        var d = v.div;
        if (!d) return;
        d.classList.remove("cmpv-view--tile", "cmpv-view--overlay", "cmpv-view--cell");
        d.style.clipPath = ""; d.style.webkitClipPath = "";
        d.style.left = ""; d.style.top = ""; d.style.width = ""; d.style.height = "";
        d.style.gridColumn = ""; d.style.gridRow = "";
        d.style.zIndex = "";
        d.style.position = "absolute";
        d.style.inset = "0";
        d.style.display = "none";
      });
      this._removeDivisor();
    }

    _layoutSingle() {
      this._resetViewDivs();
      var active = this.getView(this.activeViewId) || this.views[0];
      this.views.forEach(function (v) {
        var show = (v === active);
        v.div.style.display = show ? "" : "none";
        v.div.style.zIndex = show ? "2" : "0";
      });
    }

    _layoutSwipe() {
      this._resetViewDivs();
      this._pickSwipePair();
      var a = this.getView(this.swipe.a);
      var b = this.getView(this.swipe.b);
      if (!a || !b) return;
      [a, b].forEach(function (v, i) {
        v.div.style.display = "";
        v.div.style.zIndex = String(2 + i);
      });
      b.div.classList.add("cmpv-view--overlay");
      this._applySwipeClip();
      this._buildDivisor();
    }

    _pickSwipePair() {
      var ids = this.views.map(function (v) { return v.id; });
      if (ids.indexOf(this.swipe.a) === -1) this.swipe.a = ids[0] || null;
      if (ids.indexOf(this.swipe.b) === -1 || this.swipe.b === this.swipe.a) {
        var a = this.swipe.a;
        this.swipe.b = ids.filter(function (id) { return id !== a; })[0] || null;
      }
    }

    _applySwipeClip() {
      var b = this.getView(this.swipe.b);
      if (!b) return;
      var pos = Math.max(0, Math.min(1, this.swipe.pos));
      var pct = (pos * 100).toFixed(2) + "%";
      var clip = (this.swipe.orientation === "horizontal")
        ? "inset(0 0 " + (100 - pos * 100).toFixed(2) + "% 0)"
        : "inset(0 " + (100 - pos * 100).toFixed(2) + "% 0 0)";
      b.div.style.clipPath = clip;
      b.div.style.webkitClipPath = clip;
      if (this._divisor) {
        if (this.swipe.orientation === "horizontal") { this._divisor.style.top = pct; this._divisor.style.left = "0"; }
        else { this._divisor.style.left = pct; this._divisor.style.top = "0"; }
      }
    }

    _buildDivisor() {
      this._removeDivisor();
      var self = this;
      var div = document.createElement("div");
      div.className = "cmpv-divisor cmpv-divisor--" + this.swipe.orientation;
      var handle = document.createElement("div");
      handle.className = "cmpv-divisor__handle";
      div.appendChild(handle);
      this._workArea.appendChild(div);
      this._divisor = div;

      var dragging = false;
      var onMove = function (x, y) {
        var rect = self._workArea.getBoundingClientRect();
        var pos = (self.swipe.orientation === "horizontal")
          ? (y - rect.top) / rect.height
          : (x - rect.left) / rect.width;
        self.swipe.pos = Math.max(0, Math.min(1, pos));
        self._applySwipeClip();
      };
      var start = function (e) { dragging = true; e.preventDefault(); self._setIframePointerEvents(false); };
      var end = function () { if (dragging) { dragging = false; self._setIframePointerEvents(true); } };
      var move = function (e) { if (!dragging) return; var p = (e.touches && e.touches[0]) ? e.touches[0] : e; onMove(p.clientX, p.clientY); };
      div.addEventListener("mousedown", start);
      div.addEventListener("touchstart", start, { passive: false });
      window.addEventListener("mousemove", move);
      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("mouseup", end);
      window.addEventListener("touchend", end);
      this._divisorCleanup = function () {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("touchmove", move);
        window.removeEventListener("mouseup", end);
        window.removeEventListener("touchend", end);
      };
      this._applySwipeClip();
    }

    // Durante el arrastre del divisor, desactiva los eventos de puntero de los
    // iframes para que el ratón no lo capture el mapa de dentro.
    _setIframePointerEvents(on) {
      this.views.forEach(function (v) {
        if (v.iframe) v.iframe.style.pointerEvents = on ? "" : "none";
      });
    }

    _removeDivisor() {
      if (this._divisorCleanup) { try { this._divisorCleanup(); } catch (e) {} this._divisorCleanup = null; }
      if (this._divisor && this._divisor.parentNode) this._divisor.parentNode.removeChild(this._divisor);
      this._divisor = null;
    }

    // Distribuye las vistas con CSS GRID nativo según this.grid (array de FILAS;
    // cada fila es un array de viewIds = celdas). Soporta grid IRREGULAR: el
    // stage usa un nº de columnas = mínimo común múltiplo de las longitudes de
    // fila, y cada celda ocupa (mcm / nºceldas) columnas con grid-column: span.
    // Así cada fila reparte su ancho entre sus celdas aunque tengan distinto nº.
    _layoutMirror() {
      this._resetViewDivs();
      var self = this;
      var rows = (this.grid || []).filter(function (r) { return r && r.length; });
      if (!rows.length) return;

      // Nº de columnas base del grid = mcm de las longitudes de fila.
      var lengths = rows.map(function (r) { return r.length; });
      var baseCols = lengths.reduce(function (a, b) { return lcm(a, b); }, 1);

      var stage = this._workArea;
      stage.style.display = "grid";
      stage.style.gridTemplateColumns = "repeat(" + baseCols + ", 1fr)";
      stage.style.gridTemplateRows = "repeat(" + rows.length + ", 1fr)";

      rows.forEach(function (row, ri) {
        var span = baseCols / row.length;  // columnas que ocupa cada celda de esta fila
        row.forEach(function (viewId, ci) {
          var v = self.getView(viewId);
          if (!v || !v.div) return;
          v.div.style.display = "";
          v.div.style.position = "";       // el grid gestiona la posición
          v.div.style.inset = "";
          v.div.style.gridRow = (ri + 1) + " / span 1";
          v.div.style.gridColumn = (ci * span + 1) + " / span " + span;
          v.div.style.zIndex = "2";
          v.div.classList.add("cmpv-view--cell");
        });
      });
    }

    getHelp() {
      var IDEE = api();
      return {
        title: "Comparación de vistas",
        content: new Promise(function (success) {
          var html =
            "<div><p>Compara varias <strong>vistas</strong> del territorio. Cada vista " +
            "es un mapa independiente y puede estar en <strong>2D</strong> (OpenLayers) o " +
            "<strong>3D</strong> (Cesium), incluso a la vez.</p>" +
            "<ul><li><strong>Crear</strong>: nueva vista con el encuadre actual.</li>" +
            "<li><strong>Cortinilla</strong>: divisor arrastrable entre dos vistas.</li>" +
            "<li><strong>Espejo</strong>: vistas lado a lado sincronizadas.</li>" +
            "<li><strong>Opciones</strong>: renombrar/eliminar vistas y cambiar 2D/3D por vista.</li></ul></div>";
          try { html = IDEE.utils.stringToHtml(html); } catch (e) {}
          success(html);
        }),
      };
    }
  }

  if (typeof window !== "undefined") {
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_comparacionVistas = miPlugin_comparacionVistas;
    window.miPlugin_comparacionVistas = miPlugin_comparacionVistas;
  }
})();
