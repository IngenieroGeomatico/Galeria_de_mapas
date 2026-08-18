/* =====================================================================
   Plugin de Estereoscopía para API-IDEE
   --------------------------------------------------------------------
   Encapsula TODA la funcionalidad de estereoscopía sintética (anaglifo
   rojo/cian y vista partida side-by-side) para las DOS implementaciones
   de API-IDEE: OpenLayers (2D + shader WebGL sobre el MDT del IGN) y
   Cesium (relieve 3D real + PostProcessStage / useWebVR nativos).

   El plugin:
     - Crea el panel de controles con el sistema de paneles de API-IDEE
       (IDEE.ui.Panel + IDEE.Control + map.addPanels), siguiendo el protocolo
       de ext_backgorundLayers.js. El panel se reconstruye en cada _boot cuando
       miPlugin_cambioImpl recrea el div del mapa al alternar OL <-> Cesium; los
       ajustes persisten en AppConfig (localStorage) y se re-hidratan.
     - Los overlays del mapa (canvas WebGL del anaglifo, segundo mapa del ojo
       derecho y retículas SVG) se cuelgan del body/viewport (position:absolute)
       y los gestiona el motor; NO forman parte del panel.
     - Detecta la implementación activa mirando el mapa nativo
       (map.getMapImpl()): ol.Map -> tiene getView(); Cesium.Viewer -> tiene
       scene/camera.
     - Instancia el "motor" (Strategy) adecuado y delega en él todas las
       acciones del panel.

   Diseño (patrón Strategy + singleton guard), recomendado por el Oracle:
     miPlugin_estereoscopia   -> shell: panel, detección, ciclo de vida.
     OlStereoEngine           -> motor OpenLayers (Anaglyph WebGL + Elevation).
     CesiumStereoEngine       -> motor Cesium (Anaglyph PostProcess + SplitView
                                 + Cotas).

   Cada vez que cambioImpl recrea el mapa, se crea una nueva instancia del
   plugin; el singleton guard (window.__estereoActivePlugin) limpia la
   instancia anterior (rAF, listeners, canvas, segundo mapa, stages Cesium).
   ===================================================================== */
(function () {
  "use strict";

  // El objeto global de la API puede llamarse IDEE (builds nuevas). Algunos
  // ejemplos del repo usan M como alias. Resolvemos el que exista.
  function api() {
    return window.IDEE || window.M;
  }

  // =====================================================================
  //  Configuración de usuario (persistida en localStorage). Compartida por
  //  ambos motores: límites del slider de exageración y paso/sensibilidad
  //  del posado. (v2: en Cesium posadoStep es sensibilidad, no metros fijos.)
  // =====================================================================
  var AppConfig = (function () {
    var STORAGE_KEY = "estereoscopia.config.v2";
    var DEFAULTS = { exagMin: 0, exagMax: 2, posadoStep: 25 };
    var cfg = Object.assign({}, DEFAULTS);

    function load() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (typeof parsed.exagMin === "number") cfg.exagMin = parsed.exagMin;
          if (typeof parsed.exagMax === "number") cfg.exagMax = parsed.exagMax;
          if (typeof parsed.posadoStep === "number") cfg.posadoStep = parsed.posadoStep;
        }
      } catch (e) { /* localStorage no disponible: usamos defaults */ }
    }
    function save() {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
      catch (e) { /* ignorar */ }
    }
    load();
    return {
      get exagMin() { return cfg.exagMin; },
      get exagMax() { return cfg.exagMax; },
      get posadoStep() { return cfg.posadoStep; },
      set: function (k, v) { cfg[k] = v; save(); },
      reset: function () { cfg = Object.assign({}, DEFAULTS); save(); },
      defaults: DEFAULTS
    };
  })();

  // HTML del panel de controles (idéntico en ambas implementaciones). Los
  // handlers NO se enlazan con onclick inline: se enlazan por JS a métodos de
  // la instancia del plugin (bindPanelEvents), para no depender de globals.
  var PANEL_HTML =
    '<div class="stereo-header">' +
    '  <span class="stereo-title">Estereoscopía</span>' +
    '  <button type="button" id="btn-settings" class="settings-btn" title="Configuración" aria-label="Configuración">⚙</button>' +
    '</div>' +
    '<button type="button" id="btn-anaglyph" class="stereo-btn">Anaglifo (rojo/cian)</button>' +
    '<button type="button" id="btn-split" class="stereo-btn">Vista partida</button>' +
    '<div id="settings-panel" class="settings-panel" hidden>' +
    '  <div class="settings-row">' +
    '    <label for="cfg-exag-min">Exageración mín.</label>' +
    '    <input type="number" id="cfg-exag-min" step="0.05" min="0" value="0">' +
    '  </div>' +
    '  <div class="settings-row">' +
    '    <label for="cfg-exag-max">Exageración máx.</label>' +
    '    <input type="number" id="cfg-exag-max" step="0.05" min="0.1" value="2">' +
    '  </div>' +
    '  <div class="settings-row">' +
    '    <label for="cfg-posado-step">Paso/sensibilidad posado</label>' +
    '    <input type="number" id="cfg-posado-step" step="1" min="1" value="25">' +
    '  </div>' +
    '  <button type="button" class="stereo-btn settings-reset" id="btn-settings-reset">Restaurar valores</button>' +
    '</div>' +
    '<div class="exag-control">' +
    '  <label for="exag-range">Exageración vertical</label>' +
    '  <div class="exag-row">' +
    '    <input type="range" id="exag-range" min="0" max="2" step="0.05" value="0.5">' +
    '    <span id="exag-value">0.50</span>' +
    '  </div>' +
    '</div>' +
    '<div class="exag-control">' +
    '  <label>Posado (plano de referencia)</label>' +
    '  <div class="exag-row cota-row">' +
    '    <span class="cota-label">Altitud del plano:</span>' +
    '    <span id="plano-altitud-value">—</span>' +
    '    <button type="button" id="btn-plano-lock" class="plano-lock" title="Bloquear el plano (no cambia al hacer pan)" aria-pressed="false">🔓</button>' +
    '  </div>' +
    '  <div class="exag-row cota-row">' +
    '    <span class="cota-label">offset al plano de referencia:</span>' +
    '    <span id="posado-value">0 m</span>' +
    '    <button type="button" id="btn-posado-reset" class="stereo-btn posado-reset">Centrar</button>' +
    '  </div>' +
    '  <div class="exag-row cota-row">' +
    '    <span class="cota-label">Cota en el Terreno:</span>' +
    '    <span id="cursor-cota-value">—</span>' +
    '  </div>' +
    '  <div class="exag-row cota-row">' +
    '    <span class="cota-label">Cota en el Posado:</span>' +
    '    <span id="posado-cota-value">—</span>' +
    '  </div>' +
    '  <span class="posado-hint">Shift + rueda del ratón para subir/bajar</span>' +
    '</div>' +
    '<div class="exag-control">' +
    '  <label class="exag-row" style="font-weight:400;cursor:pointer;">' +
    '    <input type="checkbox" id="chk-debug-elev">' +
    '    <span>Ver MDT (alineación)</span>' +
    '  </label>' +
    '</div>';

  // SVG de las dos retículas centrales (vista partida). Se añaden a body junto
  // al panel; su visibilidad la gobierna el motor activo.
  var CURSORS_HTML =
    '<svg class="center-cursor" id="center-cursor-left" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
    '<line x1="13" y1="2" x2="13" y2="9"/><line x1="13" y1="17" x2="13" y2="24"/>' +
    '<line x1="2" y1="13" x2="9" y2="13"/><line x1="17" y1="13" x2="24" y2="13"/>' +
    '<circle cx="13" cy="13" r="1.5"/></svg>' +
    '<svg class="center-cursor" id="center-cursor-right" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
    '<line x1="13" y1="2" x2="13" y2="9"/><line x1="13" y1="17" x2="13" y2="24"/>' +
    '<line x1="2" y1="13" x2="9" y2="13"/><line x1="17" y1="13" x2="24" y2="13"/>' +
    '<circle cx="13" cy="13" r="1.5"/></svg>';

  // ###################################################################
  //  Motores (Strategy) — se definen más abajo con OlStereoEngine y
  //  CesiumStereoEngine. Cada uno expone la MISMA interfaz que el shell del
  //  plugin invoca:
  //    activate(), deactivate()
  //    toggleAnaglyph(), toggleSplitView()
  //    setExaggeration(v), setDebugElev(on)
  //    resetPosado(), togglePlanoLock()
  //    isAnaglyph(), isSplit()
  // ###################################################################

  // Placeholder: las definiciones reales se inyectan al final del archivo.
  var OlStereoEngine, CesiumStereoEngine;

  // ###################################################################
  //  SHELL DEL PLUGIN
  //  --------------------------------------------------------------------
  //  Definido como CLASE ES6 (constructor + addTo) igual que
  //  miPlugin_cambioImpl, para poder instanciarse e importarse con
  //  mapajs.addPlugin(new miPlugin_estereoscopia()).
  // ###################################################################
  class miPlugin_estereoscopia {
    constructor(options = {}) {
    this.name = "miPlugin_estereoscopia";
    this.options = options || {};
    this.map = null;
    this.engine = null;
    this.panel = null;         // contenido del control dentro del IDEE.ui.Panel
    this.cursorsInjected = false;
  }

  // Detecta la implementación activa a partir del mapa nativo. Es lo más
  // robusto: no depende del timing de carga de scripts ni de IDEE.impl (que
  // puede quedar obsoleto durante el swap asíncrono de cambioImpl).
  detectImpl() {
    var impl = null;
    try { impl = this.map.getMapImpl(); } catch (e) { impl = null; }
    if (!impl) return null;
    if (typeof impl.getView === "function") return "ol";      // ol.Map
    if (impl.scene && impl.camera) return "cesium";           // Cesium.Viewer
    return null;
  };

  addTo(map) {
    this.map = map;

    // --- Singleton guard: limpia la instancia anterior (cambioImpl crea una
    //     nueva por cada cambio de implementación y deja la anterior colgada).
    if (window.__estereoActivePlugin && window.__estereoActivePlugin !== this) {
      try { window.__estereoActivePlugin.cleanup(); } catch (e) { /* ignora */ }
    }
    window.__estereoActivePlugin = this;

    var impl = this.detectImpl();
    // En Cesium el viewer puede no estar listo aún en addTo; el motor Cesium
    // hace su propio polling/espera de eventos. Si no se detecta, asumimos que
    // el mapa nativo aún no existe y reintentamos brevemente.
    if (!impl) {
      var self = this;
      var tries = 40;
      (function poll() {
        var d = self.detectImpl();
        if (d) { self._boot(d); return; }
        if (--tries <= 0) {
          console.warn("[estereoscopia] No se pudo detectar la implementación del mapa.");
          return;
        }
        setTimeout(poll, 150);
      })();
      return;
    }
    this._boot(impl);
  };

  // Ayuda del plugin (protocolo API-IDEE: getHelp devuelve {title, content}).
  getHelp() {
    var IDEE = api();
    return {
      title: 'Estereoscopía',
      content: new Promise(function (success) {
        var html =
          '<div>' +
          '<p>Visualización estereoscópica del relieve en <strong>anaglifo</strong> ' +
          '(rojo/cian) y <strong>vista partida</strong>, tanto en 2D (OpenLayers, ' +
          'estereoscopía sintética sobre el MDT del IGN) como en 3D (Cesium, relieve real).</p>' +
          '<p>Ajusta la exageración vertical y el plano de posado; usa ' +
          '<em>Shift + rueda</em> para subir/bajar el plano de referencia. ' +
          'El modo anaglifo requiere gafas rojo/cian.</p>' +
          '</div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  _boot(impl) {
    this.buildPanel(this.map);
    if (impl === "ol") {
      this.engine = new OlStereoEngine(this, AppConfig);
    } else if (impl === "cesium") {
      this.engine = new CesiumStereoEngine(this, AppConfig);
    } else {
      console.warn("[estereoscopia] Implementación no soportada:", impl);
      return;
    }
    this.bindPanelEvents();
    this.applyConfigToUI();
    this.engine.activate();
    console.log("[estereoscopia] Plugin activo. Implementación:", impl);
  };

  // ---- Panel: se crea con el sistema de paneles de API-IDEE (protocolo) -----
  //  Sigue el patrón de ext_backgorundLayers.js: IDEE.ui.Panel + IDEE.Control +
  //  map.addPanels, con la estructura de clases del framework (m-control /
  //  m-container / m-herramienta + header). El panel se reconstruye en cada
  //  _boot (cambioImpl recrea el mapa al alternar OL<->Cesium); los ajustes se
  //  re-hidratan desde AppConfig (localStorage) en applyConfigToUI.
  //  Los overlays del mapa (canvas del anaglifo y retículas SVG) NO forman parte
  //  del panel: los gestiona el motor / se cuelgan del body (position:absolute).
  buildPanel(map) {
    var IDEE = api();

    var panelEstereo = new IDEE.ui.Panel('toolsExtra_estereo', {
      collapsible: true,
      collapsed: false,
      className: 'g-herramienta_estereo',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TR,
      order: 0,
    });

    var htmlPanel =
      '<div aria-label="Estereoscopía" role="menuitem" ' +
      'id="div-contenedor-herramienta-estereo" class="m-control m-container m-herramienta">' +
      '  <header role="heading" tabindex="0" id="m-herramienta-title-estereo" ' +
      '          class="m-herramienta-header">Estereoscopía</header>' +
      '  <div id="m-herramienta-contents-estereo"></div>' +
      '</div>';

    var controlEstereo = new IDEE.Control(new IDEE.impl.Control(), 'controlEstereo');
    controlEstereo.createView = function () { return document.createElement('div'); };

    panelEstereo.addControls(controlEstereo);
    map.addPanels(panelEstereo);

    document.querySelector('.g-herramienta_estereo .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents-estereo').appendChild(controlEstereo.getElement());

    IDEE.utils.draggabillyPlugin(panelEstereo, '#m-herramienta-title-estereo');

    // Contenido dinámico del plugin dentro del elemento del control. A partir de
    // aquí, this.panel es la raíz sobre la que consultan el resto de métodos y
    // los motores (this.$('id') / this.panel.querySelector).
    var contenido = controlEstereo.getElement();
    contenido.innerHTML = PANEL_HTML;
    this.panel = contenido;
    this._iueePanel = panelEstereo;

    // Retículas centrales de la vista partida: son OVERLAYS del mapa (no del
    // panel). Se inyectan una sola vez en el body con position:absolute; su
    // visibilidad la gobierna el motor activo.
    if (!document.getElementById("center-cursor-left")) {
      var wrap = document.createElement("div");
      wrap.innerHTML = CURSORS_HTML;
      while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    }
    this.cursorsInjected = true;
  };

  // Enlaza los controles del panel a métodos de ESTA instancia. El panel se
  // reconstruye fresco en cada _boot (el sistema de paneles de API-IDEE lo
  // recrea al recargar el mapa en cambioImpl), así que basta con enganchar
  // listeners directamente: no hay nodos previos con listeners que acumular.
  bindPanelEvents() {
    var self = this;
    var p = this.panel;

    function bind(id, evt, handler) {
      var el = p.querySelector("#" + id);
      if (!el) return null;
      el.addEventListener(evt, handler);
      return el;
    }

    bind("btn-anaglyph", "click", function () { self.engine.toggleAnaglyph(); });
    bind("btn-split", "click", function () { self.engine.toggleSplitView(); });
    bind("btn-settings", "click", function () { self.toggleSettings(); });
    bind("btn-settings-reset", "click", function () { self.resetSettings(); });
    bind("btn-posado-reset", "click", function () { self.engine.resetPosado(); });
    bind("btn-plano-lock", "click", function () { self.engine.togglePlanoLock(); });
    bind("exag-range", "input", function () { self.setExaggeration(this.value); });
    bind("chk-debug-elev", "change", function () { self.engine.setDebugElev(this.checked); });

    // Inputs del panel de ajustes (persistencia en vivo).
    bind("cfg-exag-min", "change", function () {
      var v = parseFloat(this.value);
      if (!isNaN(v) && v >= 0) { AppConfig.set("exagMin", v); self.applyConfigToUI(); }
    });
    bind("cfg-exag-max", "change", function () {
      var v = parseFloat(this.value);
      if (!isNaN(v) && v > 0) { AppConfig.set("exagMax", v); self.applyConfigToUI(); }
    });
    bind("cfg-posado-step", "change", function () {
      var v = parseFloat(this.value);
      if (!isNaN(v) && v >= 1) AppConfig.set("posadoStep", v);
    });
  };

  // ---- Handlers de UI comunes (no dependen del motor) ---------------------
  setExaggeration(value) {
    var v = parseFloat(value);
    if (isNaN(v)) return;
    var lbl = this.panel.querySelector("#exag-value");
    if (lbl) lbl.textContent = v.toFixed(2);
    if (this.engine) this.engine.setExaggeration(v);
  };

  applyConfigToUI() {
    var range = this.panel.querySelector("#exag-range");
    if (!range) return;
    var minV = AppConfig.exagMin, maxV = AppConfig.exagMax;
    if (maxV <= minV) maxV = minV + 0.05;
    range.min = minV;
    range.max = maxV;
    var cur = parseFloat(range.value);
    var clamped = Math.min(maxV, Math.max(minV, cur));
    if (clamped !== cur) range.value = clamped;
    this.syncSettingsInputs();
    this.setExaggeration(range.value);
  };

  syncSettingsInputs() {
    var min = this.panel.querySelector("#cfg-exag-min");
    var max = this.panel.querySelector("#cfg-exag-max");
    var step = this.panel.querySelector("#cfg-posado-step");
    if (min) min.value = AppConfig.exagMin;
    if (max) max.value = AppConfig.exagMax;
    if (step) step.value = AppConfig.posadoStep;
  };

  toggleSettings() {
    var panel = this.panel.querySelector("#settings-panel");
    var btn = this.panel.querySelector("#btn-settings");
    if (!panel) return;
    var willShow = panel.hasAttribute("hidden");
    if (willShow) { panel.removeAttribute("hidden"); this.syncSettingsInputs(); }
    else panel.setAttribute("hidden", "");
    if (btn) btn.classList.toggle("active", willShow);
  };

  resetSettings() {
    AppConfig.reset();
    this.applyConfigToUI();
  }

  // Utilidades para que los motores actualicen el panel sin acceder al DOM
  // global (usan el panel de la instancia).
  $(id) {
    return this.panel ? this.panel.querySelector("#" + id) : null;
  }

  // ---- Ciclo de vida ------------------------------------------------------
  cleanup() {
    if (this.engine) {
      try { this.engine.deactivate(); } catch (e) { /* ignora */ }
      this.engine = null;
    }
    // Soltar el panel del mapa anterior (protocolo: como destroy de layerswitcher).
    // El nuevo _boot crea un panel nuevo; los ajustes persisten en AppConfig.
    try {
      if (this.map && this._iueePanel && this.map.removePanel) {
        this.map.removePanel(this._iueePanel);
      }
    } catch (e) { /* el div del mapa suele destruirse con el swap; ignora */ }
    this._iueePanel = null;
    // Las retículas SVG (overlays del mapa) se dejan en el DOM: las reutiliza la
    // próxima instancia y su visibilidad la gobierna el motor.
  };

  // API-IDEE puede invocar destroy() al eliminar el plugin en algunos flujos.
  destroy() {
    this.cleanup();
    if (window.__estereoActivePlugin === this) window.__estereoActivePlugin = null;
  }

  getAPIRest() { return ""; }
  }

  // Exponer la clase. IMPORTANTE: el plugin cambioImpl recarga el bundle de la
  // API al alternar OL<->Cesium, lo que REINICIALIZA IDEE.plugin (borrando este
  // registro, que solo corre una vez al cargar el <script>). Por eso exponemos
  // también un GLOBAL DIRECTO (window.miPlugin_estereoscopia), igual que hacen
  // miPlugin_cambioImpl / miPlugin_baseLayer: el global directo NO se borra con
  // el swap, así mapa.js puede instanciarlo tras cambiar de implementación.
  window.miPlugin_estereoscopia = miPlugin_estereoscopia;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_estereoscopia = miPlugin_estereoscopia;
  if (window.M) {
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_estereoscopia = miPlugin_estereoscopia;
  }

  // Exponer helpers a los motores (definidos en archivos/segmentos siguientes
  // dentro de este mismo IIFE).
  window.__estereoInternals = {
    api: api,
    setOlEngine: function (ctor) { OlStereoEngine = ctor; },
    setCesiumEngine: function (ctor) { CesiumStereoEngine = ctor; }
  };
})();



/* =====================================================================
   MOTOR OPENLAYERS � OlStereoEngine
   Portado de html/index_ol.html. Estereoscop�a SINT�TICA: canvas WebGL
   superpuesto que, en cada postrender del ol.Map, toma el canvas del mapa
   como textura y compone anaglifo (rojo/cian) o vista partida usando el
   paralaje derivado del MDT del IGN (WCS GeoTIFF).

   Adaptaciones respecto al index original:
     - No usa IDs fijos #map / #map-right: obtiene el contenedor real del
       mapa con map.getContainer() y crea #map-right como hermano.
     - Los indicadores del panel se actualizan v�a la instancia del plugin
       (plugin.$('id')), no con document.getElementById global.
     - Todo el estado vive en la instancia (nada global), para que el
       singleton guard pueda limpiarlo al cambiar de implementaci�n.
   ===================================================================== */
(function () {
  "use strict";
  var internals = window.__estereoInternals;
  if (!internals) return;

  function OlStereoEngine(plugin, AppConfig) {
    this.plugin = plugin;
    this.AppConfig = AppConfig;
    this.map = plugin.map;
    this.IDEE = internals.api();

    this.olMap = null;          // ol.Map principal (ojo izquierdo)
    this.mapRightDiv = null;    // div del segundo mapa (ojo derecho)
    this.mapRight = null;       // IDEE.map del ojo derecho
    this.olMapRight = null;     // ol.Map del ojo derecho

    this.currentMode = null;    // "anaglyph" | "split" | null
    this._wheelHandler = null;
    this._wheelTarget = null;
    this._pointerMoveHandler = null;
    this._pointerLeaveHandler = null;
    this._resizeHandler = null;
    this._moveEndPanelHandler = null;

    // Motor WebGL (subm�dulo Anaglyph) y MDT (subm�dulo Elevation).
    this.Anaglyph = null;
    this.Elevation = null;
  }

  // ---- Interfaz p�blica que invoca el shell del plugin --------------------
  OlStereoEngine.prototype.isAnaglyph = function () { return this.currentMode === "anaglyph"; };
  OlStereoEngine.prototype.isSplit = function () { return this.currentMode === "split"; };
  OlStereoEngine.prototype.isStereoActive = function () {
    return this.currentMode === "anaglyph" || this.currentMode === "split";
  };

  OlStereoEngine.prototype.activate = function () {
    var self = this;
    var IDEE = this.IDEE;
    // Espera a que el mapa OL est� COMPLETED para tener canvas y vista.
    var boot = function () {
      if (self._booted) return;
      try { if (!self.map.getMapImpl()) return; } catch (e) { return; }
      self._booted = true;
      self._setup();
    };
    try { this.map.on(IDEE.evt.COMPLETED, boot); } catch (e) { /* ignora */ }
    // Sondeo por si COMPLETED ya se dispar�.
    (function poll(tries) {
      if (self._booted) return;
      boot();
      if (self._booted || tries <= 0) return;
      setTimeout(function () { poll(tries - 1); }, 200);
    })(40);
  };

  OlStereoEngine.prototype._setup = function () {
    this.olMap = this.map.getMapImpl();
    this._buildRightMap();
    this._initAnaglyph();
    this._initElevation();

    var self = this;
    // Indicadores del panel al mover / puntero.
    this._moveEndPanelHandler = function () {
      setTimeout(function () {
        self._updatePlanoAltitud();
        if (self.currentMode === "split") self._updateCursorCota(null, null);
      }, 400);
    };
    this.olMap.on("moveend", this._moveEndPanelHandler);

    this._pointerMoveHandler = function (evt) {
      if (evt.dragging) return;
      self._updateCursorCota(evt.pixel, evt.coordinate);
    };
    this.olMap.on("pointermove", this._pointerMoveHandler);

    var mapDiv = this._container();
    this._pointerLeaveHandler = function () {
      if (self.currentMode !== "split") self._clearCursorCota();
    };
    if (mapDiv) mapDiv.addEventListener("pointerleave", this._pointerLeaveHandler);

    this._resizeHandler = function () {
      if (self.currentMode === "split") self._updateCenterCursors();
    };
    window.addEventListener("resize", this._resizeHandler);

    this._updatePlanoAltitud();
  };

  // Devuelve el DIV RAÍZ del mapa (el que contiene .ol-viewport). OJO:
  // map.getContainer() en esta API devuelve .ol-overlaycontainer-stopevent
  // (contenedor interno de controles), NO el div raíz. El canvas del anaglifo
  // debe insertarse como hermano de .ol-layers dentro de .ol-viewport, así que
  // subimos desde el nodo que devuelve la API hasta el ancestro que aloja el
  // .ol-viewport. Cacheamos el resultado.
  OlStereoEngine.prototype._container = function () {
    if (this._rootDiv && document.body.contains(this._rootDiv)) return this._rootDiv;
    var el = null;
    try { el = this.map.getContainer(); } catch (e) { el = null; }
    if (!el) return null;
    // Si el propio nodo ya contiene el viewport, es el raíz.
    var root = el;
    // Sube hasta encontrar el ancestro que contiene .ol-viewport directamente,
    // o hasta el div con clase m-api-idee-container.
    var node = el;
    while (node && node !== document.body) {
      if (node.querySelector && node.querySelector(".ol-viewport")) { root = node; }
      if (node.classList && node.classList.contains("m-api-idee-container")) { root = node; break; }
      node = node.parentElement;
    }
    this._rootDiv = root;
    return root;
  };

  // Crea el segundo mapa (ojo derecho) como hermano del contenedor principal.
  OlStereoEngine.prototype._buildRightMap = function () {
    var IDEE = this.IDEE;
    var mainDiv = this._container();
    if (!mainDiv) return;
    var id = "map-right";
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    var div = document.createElement("div");
    div.id = id;
    div.setAttribute("aria-hidden", "true");
    mainDiv.parentNode.appendChild(div);
    this.mapRightDiv = div;

    try {
      this.mapRight = IDEE.map({ container: id });
      var capaPNOA = new IDEE.layer.WMTS({
        url: "https://www.ign.es/wmts/pnoa-ma",
        name: "OI.OrthoimageCoverage",
        legend: "PNOA Ortofoto",
        matrixSet: "GoogleMapsCompatible",
        format: "image/jpeg"
      }, { isBase: true });
      this.mapRight.addLayers([capaPNOA]);
      var self = this;
      // Comparte la vista con el principal cuando ambos est�n listos.
      var share = function () {
        try {
          self.olMapRight = self.mapRight.getMapImpl();
          self.olMapRight.setView(self.olMap.getView());
          self.olMapRight.updateSize();
        } catch (e) { /* reintenta en poll */ }
      };
      try { this.mapRight.on(IDEE.evt.COMPLETED, share); } catch (e) { /* ignora */ }
      (function poll(t) {
        if (self.olMapRight) return;
        share();
        if (self.olMapRight || t <= 0) return;
        setTimeout(function () { poll(t - 1); }, 200);
      })(40);
    } catch (e) {
      console.error("[estereoscopia] No se pudo crear el mapa derecho:", e);
    }
  };

  // ---- Cambio de modo -----------------------------------------------------
  OlStereoEngine.prototype._setMode = function (mode) {
    var p = this.plugin;
    ["anaglyph", "split"].forEach(function (m) {
      var btn = p.$("btn-" + m);
      if (btn) btn.classList.toggle("active", m === mode);
    });
    this.currentMode = mode;
    var stereoOn = (mode === "anaglyph" || mode === "split");
    this.Anaglyph.setSplitView(mode === "split");
    this.Anaglyph.setEnabled(stereoOn);
    this.Elevation.setActive(stereoOn);
    this._updatePlanoAltitud();
    this._clearCenterCursors();
    if (mode === "split") this._updateCenterCursors();
    this._updateCursorCota(null, null);
  };

  OlStereoEngine.prototype.toggleAnaglyph = function () {
    this._setMode(this.currentMode === "anaglyph" ? null : "anaglyph");
  };
  OlStereoEngine.prototype.toggleSplitView = function () {
    this._setMode(this.currentMode === "split" ? null : "split");
  };
  OlStereoEngine.prototype.setExaggeration = function (v) {
    if (this.Anaglyph) this.Anaglyph.setExaggeration(v);
  };
  OlStereoEngine.prototype.setDebugElev = function (on) {
    if (this.Anaglyph) this.Anaglyph.setDebugElev(on);
  };
  OlStereoEngine.prototype.resetPosado = function () {
    if (!this.Anaglyph) return;
    var off = this.Anaglyph.resetPosado();
    if (!this.Anaglyph.isZRefLocked()) this.Elevation.recomputeZRef();
    this._updatePosadoLabel(off);
  };
  OlStereoEngine.prototype.togglePlanoLock = function () {
    if (!this.Anaglyph) return;
    var locked = !this.Anaglyph.isZRefLocked();
    this.Anaglyph.setZRefLocked(locked);
    var btn = this.plugin.$("btn-plano-lock");
    if (btn) {
      btn.textContent = locked ? "\uD83D\uDD12" : "\uD83D\uDD13";
      btn.setAttribute("aria-pressed", locked ? "true" : "false");
      btn.title = locked
        ? "Plano bloqueado (no cambia al hacer pan). Clic para desbloquear."
        : "Bloquear el plano (no cambia al hacer pan)";
    }
  };

  // ---- Indicadores del panel ---------------------------------------------
  OlStereoEngine.prototype._updatePosadoLabel = function (offset) {
    var el = this.plugin.$("posado-value");
    if (el) {
      var v = Math.round(offset);
      el.textContent = (v > 0 ? "+" : "") + v + " m";
    }
    this._updatePlanoAltitud();
  };

  OlStereoEngine.prototype._updatePlanoAltitud = function () {
    var el = this.plugin.$("plano-altitud-value");
    var elCota = this.plugin.$("posado-cota-value");
    if (!el) return;
    if (!this.isStereoActive() || !this.Elevation || !this.Elevation.getData()) {
      el.textContent = "\u2014";
      if (elCota) elCota.textContent = "\u2014";
      return;
    }
    var zRef = this.Anaglyph.getEffectiveZRef();
    el.textContent = Math.round(zRef) + " m";
    if (elCota) elCota.textContent = Math.round(zRef - this.Anaglyph.getPosado()) + " m";
  };

  OlStereoEngine.prototype._updateCursorCota = function (pixel, coord3857) {
    var el = this.plugin.$("cursor-cota-value");
    if (!el) return;
    if (!this.isStereoActive()) { el.textContent = "\u2014"; return; }
    var cota;
    if (this.currentMode === "split") {
      if (!this.Elevation.getData()) { el.textContent = "\u2014"; return; }
      cota = this.Elevation.sampleCota3857(this.olMap.getView().getCenter());
    } else {
      cota = this.Elevation.sampleCota3857(coord3857);
    }
    el.textContent = (cota === null || cota === undefined) ? "\u2014" : Math.round(cota) + " m";
  };

  OlStereoEngine.prototype._clearCursorCota = function () {
    var el = this.plugin.$("cursor-cota-value");
    if (el) el.textContent = "\u2014";
  };

  OlStereoEngine.prototype._updateCenterCursors = function () {
    var cL = document.getElementById("center-cursor-left");
    var cR = document.getElementById("center-cursor-right");
    if (!cL || !cR) return;
    if (this.currentMode !== "split") { cL.style.display = "none"; cR.style.display = "none"; return; }
    var mapDiv = this._container();
    if (!mapDiv) return;
    var rect = mapDiv.getBoundingClientRect();
    var W = mapDiv.clientWidth, H = mapDiv.clientHeight;
    cL.style.left = (rect.left + W * 0.25) + "px"; cL.style.top = (rect.top + H / 2) + "px";
    cL.style.display = "block";
    cR.style.left = (rect.left + W * 0.75) + "px"; cR.style.top = (rect.top + H / 2) + "px";
    cR.style.display = "block";
  };

  OlStereoEngine.prototype._clearCenterCursors = function () {
    var cL = document.getElementById("center-cursor-left");
    var cR = document.getElementById("center-cursor-right");
    if (cL) cL.style.display = "none";
    if (cR) cR.style.display = "none";
  };

  // ---- Subm�dulo Anaglyph (motor WebGL) ----------------------------------
  OlStereoEngine.prototype._initAnaglyph = function () {
    var engine = this;
    var mapDiv = this._container();

    var VERT_SRC = [
      "attribute vec2 a_pos;",
      "varying vec2 v_uv;",
      "void main() {",
      "  v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5);",
      "  gl_Position = vec4(a_pos, 0.0, 1.0);",
      "}"
    ].join("\n");

    var FRAG_SRC = [
      "precision highp float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_map;",
      "uniform sampler2D u_mapRight;",
      "uniform sampler2D u_elev;",
      "uniform vec4 u_mapExt;",
      "uniform vec4 u_elevExt;",
      "uniform vec2 u_zRange;",
      "uniform float u_zRef;",
      "uniform float u_metersPerPixel;",
      "uniform float u_magnification;",
      "uniform vec2 u_viewport;",
      "uniform float u_debugElev;",
      "uniform float u_hasElev;",
      "uniform float u_splitView;",
      "uniform float u_rotation;",
      "const float PI = 3.14159265358979;",
      "const float R = 6378137.0;",
      "float mercY2lat(float y) { return degrees(2.0 * atan(exp(y / R)) - PI * 0.5); }",
      "float mercX2lon(float x) { return degrees(x / R); }",
      "float sampleElev(vec2 uv) {",
      "  float mx = mix(u_mapExt.x, u_mapExt.z, uv.x);",
      "  float my = mix(u_mapExt.w, u_mapExt.y, uv.y);",
      "  float lon = mercX2lon(mx);",
      "  float lat = mercY2lat(my);",
      "  vec2 elevUV = vec2((lon - u_elevExt.x) / (u_elevExt.z - u_elevExt.x),",
      "                     (lat - u_elevExt.y) / (u_elevExt.w - u_elevExt.y));",
      "  if (elevUV.x < 0.0 || elevUV.x > 1.0 || elevUV.y < 0.0 || elevUV.y > 1.0) return u_zRef;",
      "  float n = texture2D(u_elev, vec2(elevUV.x, 1.0 - elevUV.y)).r;",
      "  return mix(u_zRange.x, u_zRange.y, n);",
      "}",
      "void main() {",
      "  if (u_hasElev < 0.5) { gl_FragColor = texture2D(u_map, v_uv); return; }",
      "  float z = sampleElev(v_uv);",
      "  if (u_debugElev > 0.5) {",
      "    float g = clamp((z - u_zRange.x) / max(u_zRange.y - u_zRange.x, 1.0), 0.0, 1.0);",
      "    vec4 base = texture2D(u_map, v_uv);",
      "    gl_FragColor = vec4(mix(base.rgb, vec3(1.0, 0.0, 0.0), g * 0.6), 1.0); return;",
      "  }",
      "  if (u_splitView > 0.5) {",
       // Para facilitar el posado en free-viewing dejamos la mitad IZQUIERDA FIJA
       // como referencia (eyeSign = 0) y aplicamos TODO el paralaje a la mitad
       // derecha (eyeSign = 2). Antes cada ojo llevaba +/-1 (mitad cada uno); al
       // anclar la izquierda y duplicar la derecha se conserva la MISMA disparidad
       // relativa entre las dos vistas, pero con un ancla visual estable.
       "    float eyeSign = (v_uv.x < 0.5) ? 0.0 : 2.0;",
       "    float halfX = (v_uv.x < 0.5) ? 0.0 : 0.5;",
       "    float localX = (v_uv.x - halfX) * 2.0;",
       "    vec2 uv = vec2(0.25 + localX * 0.5, v_uv.y);",
       "    float zc = sampleElev(uv);",
       // Cota del CENTRO de la ventana (retícula), a la misma altura de fila.
       // Sirve de ancla: el paralaje se separa en (relieve relativo al centro)
       // + (paralaje absoluto del centro respecto al plano de referencia).
       "    float zCenter = sampleElev(vec2(0.5, v_uv.y));",
       // Relieve del píxel respecto al centro (esto es lo que da profundidad).
       "    float spRelief = (zc - zCenter) * u_magnification / max(u_metersPerPixel, 0.0001);",
       // Paralaje del punto central respecto al plano de referencia (posado):
       // al posar, el centro deja de estar a paralaje 0 y el par converge en
       // otra cota => el efecto del posado SÍ se percibe (no es un pan uniforme).
       "    float spCenter = (zCenter - u_zRef) * u_magnification / max(u_metersPerPixel, 0.0001);",
       // Paralaje total por ojo. Se divide por 2 para igualar la intensidad del
       // anaglifo (en split cada mitad ocupa media pantalla mostrando una ventana
       // UV de ancho 0.5 => 1 UV = 1 px de viewport completo, el doble que en el
       // anaglifo; por eso /2 iguala la sensación de profundidad).
       "    float sp = spRelief + spCenter;",
       "    float sU = sp / (2.0 * u_viewport.x);",
       "    vec2 sampleUV = vec2(uv.x + eyeSign * sU, uv.y);",
       "    if (v_uv.x < 0.5) { gl_FragColor = texture2D(u_map, sampleUV); }",
       "    else { gl_FragColor = texture2D(u_mapRight, sampleUV); }",
       "    return;",
       "  }",
      "  float shiftPx = (z - u_zRef) * u_magnification / max(u_metersPerPixel, 0.0001);",
      "  float c = cos(u_rotation);",
      "  float s = sin(u_rotation);",
      "  vec2 dirPx = vec2(c, -s);",
      "  vec2 dPx = dirPx * shiftPx * 0.5;",
      "  vec2 dUV = vec2(dPx.x / u_viewport.x, dPx.y / u_viewport.y);",
      "  vec4 left  = texture2D(u_map, v_uv - dUV);",
      "  vec4 right = texture2D(u_map, v_uv + dUV);",
      "  gl_FragColor = vec4(left.r, right.g, right.b, 1.0);",
      "}"
    ].join("\n");

    var canvas, gl, program, texture, textureRight, elevTexture, quadBuffer;
    var aPosLoc, U = {};
    var enabled = false, initialized = false, debugElev = false, splitView = false, hasElev = false;
    var composeCanvas = document.createElement("canvas");
    var composeCtx = composeCanvas.getContext("2d");
    var composeCanvasRight = document.createElement("canvas");
    var composeCtxRight = composeCanvasRight.getContext("2d");
    var BASE_MAGNIFICATION = 5.0;
    var exaggeration = 0.5;
    var zRefBase = 0.0, zRefOffset = 0.0, zRefLocked = false;
    var elevExt = [0, 0, 0, 0], zRange = [0, 1];
    var _wheelHandler = null, _wheelTarget = null, _rafHooked = false;
    function effectiveZRef() { return zRefBase + zRefOffset; }

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("Shader: " + gl.getShaderInfoLog(sh));
      return sh;
    }

    function initGL() {
      canvas = document.createElement("canvas");
      canvas.id = "anaglyph-canvas";
      var olLayers = mapDiv.querySelector(".ol-layers");
      if (olLayers) { olLayers.insertAdjacentElement("afterend", canvas); }
      else { var vp = mapDiv.querySelector(".ol-viewport") || mapDiv; vp.appendChild(canvas); }
      gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) { console.error("[estereoscopia] WebGL no disponible."); return false; }
      var vs = compile(gl.VERTEX_SHADER, VERT_SRC);
      var fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Program: " + gl.getProgramInfoLog(program));
      aPosLoc = gl.getAttribLocation(program, "a_pos");
      ["u_map","u_mapRight","u_elev","u_mapExt","u_elevExt","u_zRange","u_zRef",
       "u_metersPerPixel","u_magnification","u_viewport","u_debugElev","u_hasElev",
       "u_splitView","u_rotation"].forEach(function (n) { U[n] = gl.getUniformLocation(program, n); });
      quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      textureRight = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, textureRight);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      elevTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, elevTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      initialized = true;
      return true;
    }

    function uploadElevation(data) {
      if (!initialized || !data) return;
      var w = data.width, h = data.height, raster = data.raster;
      var min = data.min, max = data.max, range = (max - min) || 1;
      var bytes = new Uint8Array(w * h);
      for (var i = 0; i < w * h; i++) {
        var z = raster[i];
        if (z <= -1000 || isNaN(z)) z = min;
        bytes[i] = Math.round(((z - min) / range) * 255);
      }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, elevTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
      elevExt = data.extent4326.slice(); zRange = [min, max]; hasElev = true;
      if (enabled && engine.olMap) engine.olMap.render();
    }

    function syncToOLCanvas(olCanvas) {
      if (canvas.width !== olCanvas.width || canvas.height !== olCanvas.height) {
        canvas.width = olCanvas.width; canvas.height = olCanvas.height;
      }
      var cs = window.getComputedStyle(olCanvas);
      canvas.style.width = olCanvas.style.width || (olCanvas.clientWidth + "px");
      canvas.style.height = olCanvas.style.height || (olCanvas.clientHeight + "px");
      canvas.style.transformOrigin = cs.transformOrigin;
      canvas.style.transform = olCanvas.style.transform || "none";
    }

    function flattenContainer(div, outCanvas, outCtx) {
      if (!div) return null;
      var all = div.querySelectorAll("canvas");
      if (!all.length) return null;
      var canvases = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i] === canvas) continue;
        if (all[i].width === 0 || all[i].height === 0) continue;
        canvases.push(all[i]);
      }
      if (!canvases.length) return null;
      var dpr = window.devicePixelRatio || 1;
      var w = Math.round(div.clientWidth * dpr), h = Math.round(div.clientHeight * dpr);
      if (w === 0 || h === 0) return null;
      if (outCanvas.width !== w || outCanvas.height !== h) { outCanvas.width = w; outCanvas.height = h; }
      outCtx.clearRect(0, 0, w, h);
      for (var j = 0; j < canvases.length; j++) {
        var c = canvases[j];
        var op = parseFloat(c.style.opacity);
        outCtx.globalAlpha = isNaN(op) ? 1 : op;
        outCtx.drawImage(c, 0, 0, w, h);
      }
      outCtx.globalAlpha = 1;
      return outCanvas;
    }
    function flattenMapCanvases() { return flattenContainer(engine._container(), composeCanvas, composeCtx); }
    function flattenMapCanvasesRight() { return flattenContainer(engine.mapRightDiv, composeCanvasRight, composeCtxRight); }

    function getOLCanvas() {
      var div = engine._container();
      if (!div) return null;
      var cs = div.querySelectorAll(".ol-layer > canvas");
      for (var i = 0; i < cs.length; i++) {
        if (cs[i] !== canvas && cs[i].width > 0 && cs[i].height > 0) return cs[i];
      }
      var all = div.querySelectorAll("canvas");
      for (var k = 0; k < all.length; k++) {
        if (all[k] !== canvas && !all[k].classList.contains("maplibregl-canvas") && all[k].width > 0) return all[k];
      }
      return null;
    }

    function render() {
      if (!initialized || !enabled) return;
      var src = flattenMapCanvases(); if (!src) return;
      var olCanvas = getOLCanvas(); if (!olCanvas) return;
      syncToOLCanvas(olCanvas);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform1i(U.u_map, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, elevTexture);
      gl.uniform1i(U.u_elev, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textureRight);
      if (splitView && engine.olMapRight) {
        try { engine.olMapRight.renderSync(); } catch (e) { /* ignora */ }
        var srcR = flattenMapCanvasesRight();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcR || src);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      }
      gl.uniform1i(U.u_mapRight, 2);
      var view = engine.olMap.getView();
      var center = view.getCenter(), res = view.getResolution(), size = engine.olMap.getSize();
      var halfW = size[0] * res / 2, halfH = size[1] * res / 2;
      var mapExt = [center[0]-halfW, center[1]-halfH, center[0]+halfW, center[1]+halfH];
      var metersPerPixelBacking = (size[0] * res) / canvas.width;
      gl.uniform4f(U.u_mapExt, mapExt[0], mapExt[1], mapExt[2], mapExt[3]);
      gl.uniform4f(U.u_elevExt, elevExt[0], elevExt[1], elevExt[2], elevExt[3]);
      gl.uniform2f(U.u_zRange, zRange[0], zRange[1]);
      gl.uniform1f(U.u_zRef, effectiveZRef());
      gl.uniform1f(U.u_metersPerPixel, metersPerPixelBacking);
      gl.uniform1f(U.u_magnification, BASE_MAGNIFICATION * exaggeration);
      gl.uniform2f(U.u_viewport, canvas.width, canvas.height);
      gl.uniform1f(U.u_debugElev, debugElev ? 1.0 : 0.0);
      gl.uniform1f(U.u_hasElev, hasElev ? 1.0 : 0.0);
      gl.uniform1f(U.u_splitView, splitView ? 1.0 : 0.0);
      gl.uniform1f(U.u_rotation, view.getRotation());
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function zoomSplitAtCenter(deltaY) {
      var view = engine.olMap.getView();
      var factor = deltaY > 0 ? 1.0 / 1.15 : 1.15;
      var res = view.getResolution();
      var newRes = view.constrainResolution ? view.constrainResolution(res / factor) : res / factor;
      view.setResolution(newRes);
      if (enabled && engine.olMap) engine.olMap.render();
    }

    function attachPosadoWheel() {
      var viewport = engine._container().querySelector(".ol-viewport") || engine._container();
      _wheelTarget = viewport;
      _wheelHandler = function (e) {
        if (!enabled) return;
        if (e.shiftKey) {
          e.preventDefault(); e.stopImmediatePropagation();
          var step = (engine.AppConfig && engine.AppConfig.posadoStep) || 25;
          var dir = e.deltaY > 0 ? -1 : 1;
          zRefOffset += dir * step;
          if (enabled && engine.olMap) engine.olMap.render();
          engine._updatePosadoLabel(zRefOffset);
          return;
        }
        if (splitView) {
          e.preventDefault(); e.stopImmediatePropagation();
          zoomSplitAtCenter(e.deltaY); return;
        }
      };
      viewport.addEventListener("wheel", _wheelHandler, { capture: true, passive: false });
    }

    function attachToOL() {
      if (_rafHooked) return;
      engine.olMap.on("postrender", function () { if (enabled) render(); });
      attachPosadoWheel();
      _rafHooked = true;
    }

    this.Anaglyph = {
      init: function () { if (initialized) return; if (!initGL()) return; attachToOL(); },
      setEnabled: function (on) {
        enabled = !!on;
        if (!canvas) return;
        canvas.style.display = enabled ? "block" : "none";
        if (enabled && engine.olMap) engine.olMap.render();
      },
      setExaggeration: function (v) { exaggeration = v; if (enabled && engine.olMap) engine.olMap.render(); },
      uploadElevation: uploadElevation,
      setDebugElev: function (on) { debugElev = !!on; if (enabled && engine.olMap) engine.olMap.render(); },
      setSplitView: function (on) { splitView = !!on; if (enabled && engine.olMap) engine.olMap.render(); },
      setZRef: function (z) { if (zRefLocked) return; zRefBase = z; if (enabled && engine.olMap) engine.olMap.render(); },
      setZRefLocked: function (on) { zRefLocked = !!on; },
      isZRefLocked: function () { return zRefLocked; },
      nudgePosado: function (d) { zRefOffset += d; if (enabled && engine.olMap) engine.olMap.render(); return zRefOffset; },
      getPosado: function () { return zRefOffset; },
      getEffectiveZRef: function () { return effectiveZRef(); },
      resetPosado: function () { zRefOffset = 0.0; if (enabled && engine.olMap) engine.olMap.render(); return zRefOffset; },
      _teardown: function () {
        try { if (_wheelTarget && _wheelHandler) _wheelTarget.removeEventListener("wheel", _wheelHandler, { capture: true }); } catch (e) {}
        try { if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); } catch (e) {}
      }
    };
    this.Anaglyph.init();
  };

  // ---- Subm�dulo Elevation (MDT del IGN v�a WCS GeoTIFF) -----------------
  OlStereoEngine.prototype._initElevation = function () {
    var engine = this;
    var WCS_URL = "https://servicios.idee.es/wcs-inspire/mdt";
    var COVERAGE = "Elevacion4326_1000";
    var COV_BOUNDS = { minLon: -18.22, minLat: 27.63, maxLon: 4.94, maxLat: 43.95 };
    var MIN_REQUEST_DEG = 0.12;
    var lastData = null, pending = false;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function buildUrl(ext) {
      var minLon = clamp(ext[0], COV_BOUNDS.minLon, COV_BOUNDS.maxLon);
      var minLat = clamp(ext[1], COV_BOUNDS.minLat, COV_BOUNDS.maxLat);
      var maxLon = clamp(ext[2], COV_BOUNDS.minLon, COV_BOUNDS.maxLon);
      var maxLat = clamp(ext[3], COV_BOUNDS.minLat, COV_BOUNDS.maxLat);
      var params = ["SERVICE=WCS","VERSION=2.0.1","REQUEST=GetCoverage",
        "COVERAGEID=" + COVERAGE, "SUBSET=Lat(" + minLat + "," + maxLat + ")",
        "SUBSET=Long(" + minLon + "," + maxLon + ")", "FORMAT=image/tiff"];
      return { url: WCS_URL + "?" + params.join("&"), ext: [minLon, minLat, maxLon, maxLat] };
    }

    function sampleAt(data, lon, lat) {
      var e = data.extent4326;
      var u = (lon - e[0]) / (e[2] - e[0]);
      var v = (lat - e[1]) / (e[3] - e[1]);
      if (u < 0 || u > 1 || v < 0 || v > 1) return (data.min + data.max) / 2;
      var col = clamp(Math.round(u * (data.width - 1)), 0, data.width - 1);
      var row = clamp(Math.round((1 - v) * (data.height - 1)), 0, data.height - 1);
      var z = data.raster[row * data.width + col];
      if (z <= -1000 || isNaN(z)) z = (data.min + data.max) / 2;
      return z;
    }

    function sampleViewportCenter(data) {
      var c3857 = engine.olMap.getView().getCenter();
      var c4326 = window.ol.proj.transform(c3857, "EPSG:3857", "EPSG:4326");
      return sampleAt(data, c4326[0], c4326[1]);
    }

    function ensureMinExtent(ext) {
      var cLon = (ext[0]+ext[2])/2, cLat = (ext[1]+ext[3])/2;
      var w = ext[2]-ext[0], h = ext[3]-ext[1];
      var halfW = Math.max(w, MIN_REQUEST_DEG)/2, halfH = Math.max(h, MIN_REQUEST_DEG)/2;
      return [cLon-halfW, cLat-halfH, cLon+halfW, cLat+halfH];
    }

    function update() {
      if (pending || !engine.olMap) return;
      var view = engine.olMap.getView();
      var ext3857 = view.calculateExtent(engine.olMap.getSize());
      var ext4326 = window.ol.proj.transformExtent(ext3857, "EPSG:3857", "EPSG:4326");
      if (ext4326[2] < COV_BOUNDS.minLon || ext4326[0] > COV_BOUNDS.maxLon ||
          ext4326[3] < COV_BOUNDS.minLat || ext4326[1] > COV_BOUNDS.maxLat) {
        console.warn("[estereoscopia] Vista fuera de la cobertura del MDT."); return;
      }
      var req = buildUrl(ensureMinExtent(ext4326));
      pending = true;
      fetch(req.url)
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
        .then(function (buf) { return GeoTIFF.fromArrayBuffer(buf); })
        .then(function (tiff) { return tiff.getImage(); })
        .then(function (image) {
          var w = image.getWidth(), h = image.getHeight();
          return image.readRasters().then(function (rasters) {
            var raster = rasters[0], min = Infinity, max = -Infinity;
            for (var i = 0; i < raster.length; i++) {
              var z = raster[i];
              if (z <= -1000 || isNaN(z)) continue;
              if (z < min) min = z; if (z > max) max = z;
            }
            if (min === Infinity) { min = 0; max = 1; }
            lastData = { raster: raster, width: w, height: h, extent4326: req.ext, min: min, max: max };
            engine.Anaglyph.uploadElevation(lastData);
            var zRef = sampleViewportCenter(lastData);
            engine.Anaglyph.setZRef(zRef);
            engine._updatePlanoAltitud();
            pending = false;
          });
        })
        .catch(function (err) { pending = false; console.error("[estereoscopia] Error MDT:", err.message); });
    }

    var moveHandler = function () { if (engine.isStereoActive()) update(); };
    engine.olMap.on("moveend", moveHandler);
    this._elevMoveHandler = moveHandler;

    this.Elevation = {
      setActive: function (on) { if (on) update(); },
      getData: function () { return lastData; },
      sampleCota3857: function (coord3857) {
        if (!lastData || !coord3857) return null;
        var ll = window.ol.proj.transform(coord3857, "EPSG:3857", "EPSG:4326");
        var e = lastData.extent4326;
        if (ll[0] < e[0] || ll[0] > e[2] || ll[1] < e[1] || ll[1] > e[3]) return null;
        return sampleAt(lastData, ll[0], ll[1]);
      },
      recomputeZRef: function () {
        if (!lastData) { update(); return; }
        engine.Anaglyph.setZRef(sampleViewportCenter(lastData));
      }
    };
  };

  // ---- Desactivaci�n / limpieza ------------------------------------------
  OlStereoEngine.prototype.deactivate = function () {
    // Apaga el modo est�reo y desmonta el motor WebGL.
    try { if (this.Anaglyph) { this.Anaglyph.setEnabled(false); this.Anaglyph._teardown(); } } catch (e) {}
    // Listeners del ol.Map principal.
    try {
      if (this.olMap) {
        if (this._moveEndPanelHandler) this.olMap.un("moveend", this._moveEndPanelHandler);
        if (this._pointerMoveHandler) this.olMap.un("pointermove", this._pointerMoveHandler);
        if (this._elevMoveHandler) this.olMap.un("moveend", this._elevMoveHandler);
      }
    } catch (e) {}
    // Listeners del DOM/ventana.
    try {
      var mapDiv = this._container();
      if (mapDiv && this._pointerLeaveHandler) mapDiv.removeEventListener("pointerleave", this._pointerLeaveHandler);
    } catch (e) {}
    try { if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler); } catch (e) {}
    // Segundo mapa (ojo derecho).
    try { if (this.mapRight && this.mapRight.destroy) this.mapRight.destroy(); } catch (e) {}
    try { if (this.mapRightDiv && this.mapRightDiv.parentNode) this.mapRightDiv.parentNode.removeChild(this.mapRightDiv); } catch (e) {}
    // Ret�culas.
    this._clearCenterCursors();
    this.currentMode = null;
  };

  internals.setOlEngine(OlStereoEngine);
})();

/* =====================================================================
   MOTOR CESIUM � CesiumStereoEngine
   Portado de html/index_cesium.html. Relieve 3D REAL con c�mara perspectiva:
   el paralaje estereosc�pico es f�sico. Anaglifo = doble render +
   PostProcessStage; vista partida = scene.useWebVR nativo; cotas/posado con
   scene.pickPosition y verticalExaggerationRelativeHeight.

   Adaptaciones: estado en la instancia (no global), panel v�a plugin.$(),
   deactivate() limpia stage/useWebVR/handlers/rAF para el singleton guard.
   ===================================================================== */
(function () {
  "use strict";
  var internals = window.__estereoInternals;
  if (!internals) return;

  function CesiumStereoEngine(plugin, AppConfig) {
    this.plugin = plugin;
    this.AppConfig = AppConfig;
    this.map = plugin.map;
    this.IDEE = internals.api();

    this.viewer = null; this.scene = null; this.camera = null; this.globe = null;
    this.currentMode = null;
    this._init = false;

    this.EXAG_MAX_FACTOR = 5.0;
    this.MAX_BG_PARALLAX_FRAC = 0.04;
    this.COMFORT_PARALLAX_FRAC = 0.03;
    this.TARGET_PARALLAX_PX_MIN = 8.0;
    this.TARGET_PARALLAX_PX_MAX = 22.0;

    this._wheelHandler = null;
    this._moveEndHandler = null;
    this._resizeHandler = null;
    this._loadTerrainHandler = null;

    this.Anaglyph = null; this.SplitView = null; this.Cotas = null;
    this._splitHitStage = null;   // PostProcessStage HIT del posado en vista partida
  }

  CesiumStereoEngine.prototype.isAnaglyph = function () { return this.currentMode === "anaglyph"; };
  CesiumStereoEngine.prototype.isSplit = function () { return this.currentMode === "split"; };
  CesiumStereoEngine.prototype.isStereoActive = function () {
    return this.currentMode === "anaglyph" || this.currentMode === "split";
  };
  CesiumStereoEngine.prototype._container = function () {
    try { return this.map.getContainer(); } catch (e) { return null; }
  };

  CesiumStereoEngine.prototype.activate = function () {
    var self = this, IDEE = this.IDEE;
    var boot = function () { self._initEstereo(); };
    try { this.map.on(IDEE.evt.COMPLETED, boot); } catch (e) {}
    (function poll(tries) {
      if (self._init) return;
      if (self._initEstereo()) return;
      if (tries <= 0) { console.warn("[estereoscopia] Viewer Cesium no disponible."); return; }
      setTimeout(function () { poll(tries - 1); }, 250);
    })(40);
  };

  CesiumStereoEngine.prototype._initEstereo = function () {
    if (this._init) return true;
    var v;
    try { v = this.map.getMapImpl(); } catch (e) { return false; }
    if (!v || !v.scene || !v.camera) return false;
    this.viewer = v; this.scene = v.scene; this.camera = v.camera; this.globe = v.scene.globe;
    this._init = true;
    this.scene.depthTestAgainstTerrain = true;

    this._buildSubmodules();

    var self = this, IDEE = this.IDEE, C = window.Cesium;

    // Posado: Shift + rueda.
    // El posado ya NO mueve el terreno (verticalExaggerationRelativeHeight usa
    // solo la cota base). Ahora el posado es una TRASLACION HORIZONTAL DE IMAGEN
    // (HIT: Horizontal Image Translation), el metodo estandar de control de
    // convergencia estereoscopica: desplaza el plano de paralaje cero en
    // PIXELES de disparidad, empujando toda la escena "hacia dentro" o "hacia
    // fuera" de la pantalla sin deformar la geometria. posadoStep es el control
    // de sensibilidad (compartido con OpenLayers, donde son metros); en Cesium lo
    // escalamos a PIXELES de disparidad por muesca con POSADO_PX_PER_STEP.
    var POSADO_PX_PER_STEP = 0.2;   // sens 25 (default) -> 5 px/muesca
    this._wheelHandler = function (e) {
      if (!self.isStereoActive()) return;
      if (!e.shiftKey) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var sens = (self.AppConfig && self.AppConfig.posadoStep) || 25;
      var stepPx = sens * POSADO_PX_PER_STEP;
      var dir = e.deltaY > 0 ? -1 : 1;
      self.Cotas.nudgePosado(dir * stepPx);
      self._applyReferencePlane();
      if (self.Anaglyph && self.Anaglyph.markDirty) self.Anaglyph.markDirty();
      self.SplitView.refresh();
    };
    this.scene.canvas.addEventListener("wheel", this._wheelHandler, { capture: true, passive: false });

    this._moveEndHandler = function () {
      if (self.isStereoActive()) { self.Cotas.onMoveEnd(); self._applyReferencePlane(); }
    };
    this.camera.moveEnd.addEventListener(this._moveEndHandler);

    // Terreno IGN as�ncrono.
    try {
      this._loadTerrainHandler = function () {
        self.setExaggeration(self.plugin.$("exag-range").value);
      };
      this.map.on(IDEE.evt.LOAD_TERRAIN, this._loadTerrainHandler);
    } catch (e) {}

    (function waitTerrain(tries) {
      var t = self.viewer.terrainProvider;
      var flat = !t || (C && t instanceof C.EllipsoidTerrainProvider);
      if (!flat) { self.setExaggeration(self.plugin.$("exag-range").value); return; }
      if (tries <= 0) return;
      setTimeout(function () { waitTerrain(tries - 1); }, 300);
    })(40);

    this._resizeHandler = function () { self._updateCenterCursors(); };
    window.addEventListener("resize", this._resizeHandler);

    return true;
  };

  // ---- Exageraci�n y plano de referencia ---------------------------------
  CesiumStereoEngine.prototype._sliderToExagFactor = function (sliderValue) {
    var range = this.plugin.$("exag-range");
    var maxSlider = parseFloat(range.max) || 2;
    var v = parseFloat(sliderValue); if (isNaN(v)) v = 0;
    var t = maxSlider > 0 ? v / maxSlider : 0;
    return 1.0 + t * (this.EXAG_MAX_FACTOR - 1.0);
  };

  CesiumStereoEngine.prototype._applyReferencePlane = function () {
    if (!this.scene) return;
    // El pivote de la exageracion vertical (verticalExaggerationRelativeHeight)
    // usa SOLO la cota base del terreno en el centro (zRefBase), NUNCA el posado
    // (zRefOffset). Cesium transforma la cota como h' = (h - r) * s + r, de modo
    // que cambiar r con s>1 reescala/mueve TODO el terreno alrededor del nuevo
    // pivote. Si aqui incluyeramos el posado, cada Shift+rueda desplazaria el
    // plano/terreno (bug reportado). El posado debe afectar UNICAMENTE al plano
    // de convergencia (paralaje) via _convergencePlaneInvDepth(), que ya consume
    // Cotas.posadoMeters(). Asi el terreno queda fijo y el posado solo hace
    // paralaje.
    var zRef = 0.0;
    if (this.Cotas && this.Cotas.hasBase && this.Cotas.hasBase()) {
      var zBase = this.Cotas.zRefBase();
      if (zBase !== null && isFinite(zBase)) zRef = zBase;
    }
    this.scene.verticalExaggerationRelativeHeight = zRef;
  };

  CesiumStereoEngine.prototype.setExaggeration = function (value) {
    var v = parseFloat(value); if (isNaN(v)) return;
    if (this.scene) {
      this.scene.verticalExaggeration = this._sliderToExagFactor(v);
      this._applyReferencePlane();
      this.scene.requestRender && this.scene.requestRender();
      if (this.Anaglyph && this.Anaglyph.markDirty) this.Anaglyph.markDirty();
      if (this.SplitView && this.SplitView.refresh) this.SplitView.refresh();
    }
  };

  // ---- Cambio de modo -----------------------------------------------------
  CesiumStereoEngine.prototype._setMode = function (mode) {
    var p = this.plugin;
    ["anaglyph", "split"].forEach(function (m) {
      var btn = p.$("btn-" + m);
      if (btn) btn.classList.toggle("active", m === mode);
    });
    this.currentMode = mode;
    if (mode !== "anaglyph") this.Anaglyph.setEnabled(false);
    if (mode !== "split") this.SplitView.setEnabled(false);
    if (mode === "anaglyph") this.Anaglyph.setEnabled(true);
    if (mode === "split") this.SplitView.setEnabled(true);
    this.Cotas.setActive(this.isStereoActive());
    if (this.isStereoActive()) this._applyReferencePlane();
    else if (this.scene) this.scene.verticalExaggerationRelativeHeight = 0.0;
    this._updateCenterCursors();
  };

  CesiumStereoEngine.prototype.toggleAnaglyph = function () {
    this._setMode(this.currentMode === "anaglyph" ? null : "anaglyph");
  };
  CesiumStereoEngine.prototype.toggleSplitView = function () {
    this._setMode(this.currentMode === "split" ? null : "split");
  };
  CesiumStereoEngine.prototype.setDebugElev = function (on) {
    console.log("[estereoscopia] Ver MDT:", on, "(no aplica en Cesium 3D)");
  };
  CesiumStereoEngine.prototype.resetPosado = function () {
    this.Cotas.resetPosado();
    this._applyReferencePlane();
    this.SplitView.refresh();
  };
  CesiumStereoEngine.prototype.togglePlanoLock = function () {
    var locked = this.Cotas.toggleLock();
    var btn = this.plugin.$("btn-plano-lock");
    if (btn) {
      btn.setAttribute("aria-pressed", locked ? "true" : "false");
      btn.textContent = locked ? "\uD83D\uDD12" : "\uD83D\uDD13";
    }
    this._applyReferencePlane();
    this.SplitView.refresh();
  };

  CesiumStereoEngine.prototype._updateCenterCursors = function () {
    var cL = document.getElementById("center-cursor-left");
    var cR = document.getElementById("center-cursor-right");
    if (!cL || !cR) return;
    if (this.currentMode !== "split") { cL.style.display = "none"; cR.style.display = "none"; return; }
    var mapDiv = this._container(); if (!mapDiv) return;
    var rect = mapDiv.getBoundingClientRect();
    var W = mapDiv.clientWidth, H = mapDiv.clientHeight;
    cL.style.left = (rect.left + W * 0.25) + "px"; cL.style.top = (rect.top + H / 2) + "px";
    cL.style.display = "block";
    cR.style.left = (rect.left + W * 0.75) + "px"; cR.style.top = (rect.top + H / 2) + "px";
    cR.style.display = "block";
  };

  // ---- Geometr�a de convergencia (compartida) ----------------------------
  CesiumStereoEngine.prototype._terrainDepthAtCenter = function () {
    var C = window.Cesium, scene = this.scene, camera = this.camera;
    var w = scene.canvas.clientWidth, h = scene.canvas.clientHeight;
    var center = new C.Cartesian2(w / 2, h / 2);
    var ray = camera.getPickRay(center); if (!ray) return null;
    var ground = null;
    try { ground = scene.pickPosition(center); } catch (e) { ground = null; }
    if (!C.defined(ground)) {
      var hit = C.IntersectionTests.rayEllipsoid(ray, scene.globe.ellipsoid);
      if (hit) ground = C.Ray.getPoint(ray, hit.start);
    }
    if (!C.defined(ground)) return null;
    var toG = C.Cartesian3.subtract(ground, camera.positionWC, new C.Cartesian3());
    var d = C.Cartesian3.dot(toG, camera.directionWC);
    return (d > 1 && isFinite(d)) ? d : null;
  };

  CesiumStereoEngine.prototype._stereoIOD = function (Dref) {
    var scene = this.scene, camera = this.camera;
    var exag = scene ? (scene.verticalExaggeration || 1) : 1;
    var maxExag = this.EXAG_MAX_FACTOR;
    var t = maxExag > 1 ? (exag - 1) / (maxExag - 1) : 0;
    t = Math.max(0, Math.min(1, t));
    var targetPx = this.TARGET_PARALLAX_PX_MIN + t * (this.TARGET_PARALLAX_PX_MAX - this.TARGET_PARALLAX_PX_MIN);
    var f = camera.frustum;
    var fov = (f && f.fov) ? f.fov : 0.6;
    var aspect = (f && f.aspectRatio) ? f.aspectRatio : 1;
    var wPx = (scene.canvas && scene.canvas.width) ? scene.canvas.width :
              (scene.context ? scene.context.drawingBufferWidth : 1000);
    var metersPerPixelAtD = (2 * Dref * Math.tan(fov / 2) * aspect) / wPx;
    return targetPx * metersPerPixelAtD;
  };

  CesiumStereoEngine.prototype._convergencePlaneInvDepth = function () {
    var C = window.Cesium, scene = this.scene, camera = this.camera;
    if (!this.Cotas || !this.Cotas.hasBase()) return null;
    var w = scene.canvas.clientWidth, h = scene.canvas.clientHeight;
    var center = new C.Cartesian2(w / 2, h / 2);
    var ray = camera.getPickRay(center); if (!ray) return null;
    var ground = null;
    try { ground = scene.pickPosition(center); } catch (e) { ground = null; }
    if (!C.defined(ground)) {
      var hit = C.IntersectionTests.rayEllipsoid(ray, scene.globe.ellipsoid);
      if (hit) ground = C.Ray.getPoint(ray, hit.start);
    }
    if (!C.defined(ground)) return null;
    var toG = C.Cartesian3.subtract(ground, camera.positionWC, new C.Cartesian3());
    var Dterr = C.Cartesian3.dot(toG, camera.directionWC);
    if (!(Dterr > 1) || !isFinite(Dterr)) return null;
    var invTerr = 1 / Dterr;

    // Esta funcion devuelve UNICAMENTE la convergencia derivada del RELIEVE del
    // terreno (invTerr), con su clamp de seguridad para que el fondo lejano no
    // diverja. El posado del usuario NO entra aqui: se aplica aparte como una
    // traslacion horizontal de imagen (HIT) en pixeles, independiente del zoom
    // y sin este clamp (ver _posadoShiftUV y computeShiftUV / SplitView).
    var f = camera.frustum;
    var IODref = this._stereoIOD(Dterr);
    var fovX = 2 * Math.atan(Math.tan(f.fov / 2) * (f.aspectRatio || 1));
    var wPx = (scene.canvas && scene.canvas.clientWidth) ? scene.canvas.clientWidth :
              ((scene.canvas && scene.canvas.width) ? scene.canvas.width : 1000);
    var K = wPx / (2 * Math.tan(fovX / 2));
    var maxParallaxPx = wPx * this.MAX_BG_PARALLAX_FRAC;
    var maxInvD = (IODref > 0 && K > 0) ? maxParallaxPx / (IODref * K)
      : 1 / Math.max(Dterr * 0.05, f.near || 1);
    var invD = invTerr;
    if (invD > maxInvD) invD = maxInvD;
    if (invD < -maxInvD) invD = -maxInvD;
    return invD;
  };

  // Posado como TRASLACION HORIZONTAL DE IMAGEN (HIT). Devuelve el desplazamiento
  // de convergencia en unidades UV (fraccion del ancho), EXACTAMENTE posadoPx/wPx:
  // es independiente del zoom (no depende de Dterr) y NO pasa por el clamp del
  // relieve, de modo que el posado se conserva al hacer zoom y responde de forma
  // lineal a la rueda.
  CesiumStereoEngine.prototype._posadoShiftUV = function () {
    var posadoPx = (this.Cotas && this.Cotas.posadoMeters) ? this.Cotas.posadoMeters() : 0;
    if (Math.abs(posadoPx) < 1e-2) return 0;
    var wPx = (this.scene && this.scene.canvas && this.scene.canvas.clientWidth)
      ? this.scene.canvas.clientWidth : 0;
    if (wPx < 1) return 0;
    return posadoPx / wPx;
  };

  // ---- Subm�dulos Cesium (Anaglyph / SplitView / Cotas) ------------------
  CesiumStereoEngine.prototype._buildSubmodules = function () {
    var engine = this;
    var C = window.Cesium;
    var scene = this.scene, camera = this.camera;

    // ===== Anaglyph (doble render + PostProcessStage) =====================
    this.Anaglyph = (function () {
      var enabled = false, stage = null, leftEyeTexture = null;
      var texW = 0, texH = 0, rafId = null, savedFrustum = null;
      var FS = [
        "uniform sampler2D colorTexture;",
        "uniform sampler2D u_leftEye;",
        "uniform float u_shift;",
        "in vec2 v_textureCoordinates;",
        "void main() {",
        "  vec2 leftUV = v_textureCoordinates + vec2(u_shift, 0.0);",
        "  vec4 right = texture(colorTexture, v_textureCoordinates);",
        "  vec4 left  = texture(u_leftEye, leftUV);",
        "  out_FragColor = vec4(left.r, right.g, right.b, 1.0);",
        "}"
      ].join("\n");
      var shiftUV = 0.0;

      function markDirty() { /* no-op: render continuo */ }

      function interocular() {
        var Dref = engine._terrainDepthAtCenter();
        if (Dref !== null) return engine._stereoIOD(Dref);
        var h = camera.positionCartographic ? camera.positionCartographic.height : 1000;
        return engine._stereoIOD(h);
      }

      function ensureLeftTexture() {
        var ctx = scene.context;
        var w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
        if (!w || !h) return false;
        if (leftEyeTexture && (texW !== w || texH !== h)) { leftEyeTexture.destroy(); leftEyeTexture = null; }
        if (!leftEyeTexture) {
          leftEyeTexture = new C.Texture({
            context: ctx, width: w, height: h,
            pixelFormat: C.PixelFormat.RGBA, pixelDatatype: C.PixelDatatype.UNSIGNED_BYTE
          });
          texW = w; texH = h;
        }
        return true;
      }

      function captureLeftEye() {
        if (!ensureLeftTexture()) return;
        leftEyeTexture.copyFrom({ source: scene.canvas });
      }

      function computeShiftUV(iod) {
        var f = camera.frustum;
        if (!(f instanceof C.PerspectiveFrustum)) return 0;
        // 1) Paralaje del RELIEVE (clampeado) -> UV.
        var invD = engine._convergencePlaneInvDepth();
        if (invD === null) invD = 0;
        var tanHalfFovY = Math.tan(f.fov / 2);
        var aspect = f.aspectRatio || 1;
        var baseUV = (iod * invD) / (2 * tanHalfFovY * aspect);
        var terrainShiftUV = isFinite(baseUV) ? -baseUV : 0;
        // 2) Posado del usuario (HIT, independiente del zoom) -> UV.
        var posadoShiftUV = engine._posadoShiftUV();
        // 3) Combinar y aplicar clamp de CONFORT sobre el paralaje total (evita
        //    fatiga visual), permitiendo que el posado mueva toda la ventana de
        //    confort en vez de quedar recortado por el limite del relieve.
        var totalShiftUV = terrainShiftUV - posadoShiftUV;
        var COMFORT = engine.COMFORT_PARALLAX_FRAC || 0.03;
        if (totalShiftUV > COMFORT) totalShiftUV = COMFORT;
        if (totalShiftUV < -COMFORT) totalShiftUV = -COMFORT;
        return totalShiftUV;
      }

      function frame() {
        if (!enabled) { rafId = null; return; }
        scene.initializeFrame();
        var dbw = scene.drawingBufferWidth, dbh = scene.drawingBufferHeight;
        if (dbw > 0 && dbh > 0) camera.frustum.aspectRatio = dbw / dbh;
        var iod = interocular();
        shiftUV = computeShiftUV(iod);
        if (stage && stage.uniforms) stage.uniforms.u_shift = shiftUV;
        if (stage) stage.enabled = false;
        camera.moveRight(-iod / 2);
        scene.render();
        captureLeftEye();
        if (stage) stage.enabled = true;
        camera.moveRight(iod);
        scene.render();
        camera.moveRight(-iod / 2);
        rafId = requestAnimationFrame(frame);
      }

      return {
        setEnabled: function (on) {
          if (!scene) return;
          on = !!on;
          if (on === enabled) return;
          enabled = on;
          if (enabled) {
            savedFrustum = camera.frustum;
            var dbw = scene.drawingBufferWidth, dbh = scene.drawingBufferHeight;
            var aspect = (dbw > 0 && dbh > 0) ? dbw / dbh : 1;
            camera.frustum = new C.PerspectiveFrustum({
              fov: (savedFrustum && savedFrustum.fov) ? savedFrustum.fov : C.Math.toRadians(60),
              aspectRatio: aspect,
              near: (savedFrustum && savedFrustum.near) ? savedFrustum.near : 0.1,
              far: (savedFrustum && savedFrustum.far) ? savedFrustum.far : 1e10
            });
            scene.requestRenderMode = true;
            if (!stage) {
              stage = scene.postProcessStages.add(new C.PostProcessStage({
                name: "anaglyph", fragmentShader: FS,
                uniforms: { u_leftEye: function () { return leftEyeTexture; }, u_shift: 0.0 }
              }));
            }
            stage.enabled = true;
            scene.postProcessStages.enabled = true;
            if (!rafId) frame();
          } else {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            if (stage) stage.enabled = false;
            if (savedFrustum) { camera.frustum = savedFrustum; savedFrustum = null; }
            scene.requestRenderMode = false;
            scene.requestRender && scene.requestRender();
          }
        },
        markDirty: markDirty,
        _teardown: function () {
          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
          try { if (stage) { scene.postProcessStages.remove(stage); stage = null; } } catch (e) {}
          try { if (leftEyeTexture) { leftEyeTexture.destroy(); leftEyeTexture = null; } } catch (e) {}
          if (savedFrustum) { try { camera.frustum = savedFrustum; } catch (e) {} savedFrustum = null; }
          try { scene.requestRenderMode = false; } catch (e) {}
        }
      };
    })();

    // ===== SplitView (useWebVR nativo) ===================================
    this.SplitView = (function () {
      var enabled = false, removeListener = null;

      // PostProcessStage que aplica el POSADO como traslacion horizontal de
      // imagen (HIT) sobre el framebuffer YA dividido por useWebVR: la mitad
      // izquierda (x<0.5) es el ojo izquierdo y la derecha (x>=0.5) el derecho.
      // Para facilitar el posado en free-viewing dejamos la mitad IZQUIERDA FIJA
      // como referencia y movemos SOLO la derecha con el desplazamiento completo.
      // u_posadoShiftUV = posadoPx/wPx (UV sobre el ANCHO COMPLETO); al aplicarlo
      // integro a la mitad derecha, esta se traslada posadoPx px => disparidad
      // total percibida = posadoPx, igual que el anaglifo. Es independiente del
      // zoom (UV puro) y no toca la geometria del terreno.
      var HIT_FS = [
        "uniform sampler2D colorTexture;",
        "uniform float u_posadoShiftUV;",
        "in vec2 v_textureCoordinates;",
        "void main() {",
        "  vec2 uv = v_textureCoordinates;",
        "  if (uv.x >= 0.5) { uv.x = uv.x + u_posadoShiftUV; }",
        "  out_FragColor = texture(colorTexture, uv);",
        "}"
      ].join("\n");
      if (!engine._splitHitStage) {
        try {
          engine._splitHitStage = scene.postProcessStages.add(new C.PostProcessStage({
            name: "posadoSplitHIT",
            fragmentShader: HIT_FS,
            uniforms: { u_posadoShiftUV: 0.0 }
          }));
          engine._splitHitStage.enabled = false;
        } catch (e) { engine._splitHitStage = null; }
      }

      function computeEyeSeparation() {
        var Dref = engine._terrainDepthAtCenter();
        if (Dref !== null) return engine._stereoIOD(Dref);
        var h = camera.positionCartographic ? camera.positionCartographic.height : 1000;
        return engine._stereoIOD(h);
      }
      function computeFocalLength() {
        // focalLength (useWebVR) fija SOLO la convergencia base del relieve. El
        // posado NO se aplica aqui: en Cesium el control de convergencia via
        // focalLength es poco fiable (no produce un HIT perceptible). El posado se
        // aplica como PostProcessStage que traslada horizontalmente cada mitad
        // (ver _splitHitStage), garantizando el mismo efecto que en el anaglifo,
        // independiente del zoom.
        var near = camera.frustum && camera.frustum.near ? camera.frustum.near : 1;
        var invD = engine._convergencePlaneInvDepth();
        if (invD === null) return 5.0;
        var MIN_INV_D = 1e-6;
        if (invD < MIN_INV_D) invD = MIN_INV_D;
        var Dplane = 1 / invD;
        var focal = Dplane / near;
        return isFinite(focal) && focal > 0 ? focal : 5.0;
      }
      function applyStereoParams() {
        if (!scene) return;
        scene.eyeSeparation = computeEyeSeparation();
        scene.focalLength = computeFocalLength();
        // Posado como HIT (traslacion horizontal de cada mitad), independiente
        // del zoom. Mismo signo/magnitud que el anaglifo para una experiencia
        // consistente entre modos.
        if (engine._splitHitStage) {
          engine._splitHitStage.uniforms.u_posadoShiftUV = engine._posadoShiftUV();
        }
      }
      return {
        setEnabled: function (on) {
          if (!scene) return;
          on = !!on;
          if (on === enabled) return;
          enabled = on;
          if (enabled) {
            applyStereoParams();
            scene.useWebVR = true;
            if (engine._splitHitStage) engine._splitHitStage.enabled = true;
            if (!removeListener) removeListener = scene.preRender.addEventListener(applyStereoParams);
          } else {
            if (removeListener) { removeListener(); removeListener = null; }
            if (engine._splitHitStage) engine._splitHitStage.enabled = false;
            scene.useWebVR = false;
          }
        },
        refresh: function () { if (enabled) applyStereoParams(); },
        _teardown: function () {
          if (removeListener) { try { removeListener(); } catch (e) {} removeListener = null; }
          try { if (enabled) scene.useWebVR = false; } catch (e) {}
          try {
            if (engine._splitHitStage) {
              engine._splitHitStage.enabled = false;
              scene.postProcessStages.remove(engine._splitHitStage);
              engine._splitHitStage = null;
            }
          } catch (e) { engine._splitHitStage = null; }
          enabled = false;
        }
      };
    })();

    // ===== Cotas / posado ================================================
    this.Cotas = (function () {
      var zRefBase = null, zRefOffset = 0.0, zRefLocked = false, handler = null;
      function fmt(z) {
        return (z === null || z === undefined || isNaN(z)) ? "\u2014" : (Math.round(z) + " m");
      }
      function cotaAtPixel(pixel) {
        if (!scene || !scene.pickPositionSupported) return null;
        try {
          var cart = scene.pickPosition(pixel);
          if (!C.defined(cart)) return null;
          var carto = C.Cartographic.fromCartesian(cart);
          return carto ? carto.height : null;
        } catch (e) { return null; }
      }
      function cotaAtCenter() {
        if (!scene) return null;
        var w = scene.canvas.clientWidth, h = scene.canvas.clientHeight;
        return cotaAtPixel(new C.Cartesian2(w / 2, h / 2));
      }
      function effectiveZRef() { return (zRefBase === null ? 0 : zRefBase) + zRefOffset; }
      function recomputeZRefBase() {
        if (zRefLocked) return;
        var z = cotaAtCenter();
        if (z !== null) zRefBase = z;
      }
      function updatePlanoAltitud() {
        var planoEl = engine.plugin.$("plano-altitud-value");
        var posadoCotaEl = engine.plugin.$("posado-cota-value");
        var posadoEl = engine.plugin.$("posado-value");
        var stereoOn = engine.isStereoActive();
        if (!stereoOn || zRefBase === null) {
          if (planoEl) planoEl.textContent = "\u2014";
          if (posadoCotaEl) posadoCotaEl.textContent = "\u2014";
        } else {
          if (planoEl) planoEl.textContent = fmt(zRefBase + zRefOffset);
          if (posadoCotaEl) posadoCotaEl.textContent = fmt(zRefBase);
        }
        if (posadoEl) {
          var v = Math.round(zRefOffset);
          posadoEl.textContent = (v > 0 ? "+" : "") + v + " m";
        }
      }
      function updateCursorCota(pixel) {
        var el = engine.plugin.$("cursor-cota-value");
        if (!el) return;
        if (!engine.isStereoActive()) { el.textContent = "\u2014"; return; }
        var split = engine.currentMode === "split";
        var z = (split || !pixel) ? cotaAtCenter() : cotaAtPixel(pixel);
        el.textContent = fmt(z);
      }
      return {
        setActive: function (on) {
          if (on) {
            recomputeZRefBase();
            if (!handler && scene) {
              handler = new C.ScreenSpaceEventHandler(scene.canvas);
              handler.setInputAction(function (movement) { updateCursorCota(movement.endPosition); },
                C.ScreenSpaceEventType.MOUSE_MOVE);
            }
            updatePlanoAltitud(); updateCursorCota(null);
          } else {
            if (handler) { handler.destroy(); handler = null; }
            updatePlanoAltitud(); updateCursorCota(null);
          }
        },
        onMoveEnd: function () { recomputeZRefBase(); updatePlanoAltitud(); updateCursorCota(null); },
        nudgePosado: function (d) { zRefOffset += d; updatePlanoAltitud(); },
        resetPosado: function () { zRefOffset = 0.0; updatePlanoAltitud(); },
        toggleLock: function () { zRefLocked = !zRefLocked; if (!zRefLocked) recomputeZRefBase(); updatePlanoAltitud(); return zRefLocked; },
        isLocked: function () { return zRefLocked; },
        refresh: function () { updatePlanoAltitud(); },
        effectiveZRef: function () { return effectiveZRef(); },
        zRefBase: function () { return zRefBase; },
        posadoMeters: function () { return zRefOffset; },
        hasBase: function () { return zRefBase !== null; },
        _teardown: function () { if (handler) { try { handler.destroy(); } catch (e) {} handler = null; } }
      };
    })();
  };

  // ---- Desactivaci�n / limpieza ------------------------------------------
  CesiumStereoEngine.prototype.deactivate = function () {
    try { if (this.Anaglyph) { this.Anaglyph.setEnabled(false); this.Anaglyph._teardown(); } } catch (e) {}
    try { if (this.SplitView) this.SplitView._teardown(); } catch (e) {}
    try { if (this.Cotas) this.Cotas._teardown(); } catch (e) {}
    try { if (this.scene && this._wheelHandler) this.scene.canvas.removeEventListener("wheel", this._wheelHandler, { capture: true }); } catch (e) {}
    try { if (this.camera && this._moveEndHandler) this.camera.moveEnd.removeEventListener(this._moveEndHandler); } catch (e) {}
    try { if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler); } catch (e) {}
    try { if (this.scene) this.scene.verticalExaggerationRelativeHeight = 0.0; } catch (e) {}
    this._clearCenterCursors();
    this.currentMode = null;
  };

  CesiumStereoEngine.prototype._clearCenterCursors = function () {
    var cL = document.getElementById("center-cursor-left");
    var cR = document.getElementById("center-cursor-right");
    if (cL) cL.style.display = "none";
    if (cR) cR.style.display = "none";
  };

  internals.setCesiumEngine(CesiumStereoEngine);
})();
