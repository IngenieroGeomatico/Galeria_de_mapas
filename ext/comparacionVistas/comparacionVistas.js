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
     - Molde              -> una figura (SVG clip-path) recorta la vista
                             superior y por la abertura se ve la inferior.
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

  // URL base de ESTE plugin (carpeta ext/comparacionVistas/). Se detecta al
  // cargar el script y sirve para el <base href> del srcdoc de las vistas y
  // para resolver recursos relativos (spinner, cambioImpl.css) desde el iframe.
  var PLUGIN_BASE = (function () {
    try {
      var s = document.currentScript;
      if (!s) {
        var scripts = document.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; i--) {
          if (scripts[i].src && /comparacionVistas\.js(\?|$)/.test(scripts[i].src)) { s = scripts[i]; break; }
        }
      }
      if (s && s.src) {
        // Carpeta del script (con barra final): .../ext/comparacionVistas/
        return s.src.replace(/[^/]*$/, "");
      }
    } catch (e) {}
    return "";
  })();

  // Máximo común divisor / mínimo común múltiplo (para el nº de columnas base
  // del CSS Grid cuando las filas tienen distinto número de celdas).
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }

  // =====================================================================
  //  Documento de VISTA (antes: vista.html + vista.js). Ahora se genera
  //  dinámicamente y se inyecta en cada iframe vía srcdoc, para que el
  //  plugin sea AUTOCONTENIDO (no depende de ficheros en mapas/).
  //  --------------------------------------------------------------------
  //  _vistaBoot es la lógica que corre DENTRO de cada iframe. Se serializa
  //  con .toString() y se incrusta en el srcdoc. Lee sus parámetros de
  //  window.__CMPV_PARAMS (inyectados por el padre en el propio srcdoc), NO
  //  de location.search (el srcdoc no tiene query string).
  //
  //  Comunicación con el padre por postMessage (idéntica que antes):
  //    Recibe: cmpv:setView, cmpv:setControls, cmpv:setConfig, cmpv:getView
  //    Emite : cmpv:ready, cmpv:view, cmpv:implChange
  //  El cambio 2D/3D ya NO recarga por location: emite cmpv:implChange y el
  //  padre regenera el srcdoc con la otra implementación.
  // =====================================================================
  function _vistaBoot() {
    "use strict";

    // Parámetros inyectados por el padre en el srcdoc.
    var P = window.__CMPV_PARAMS || {};
    var IMPL = (P.impl === "cesium") ? "cesium" : "ol";
    var VP_ID = P.vp || "vista";
    var INIT_LON = (typeof P.lon === "number") ? P.lon : parseFloat(P.lon);
    var INIT_LAT = (typeof P.lat === "number") ? P.lat : parseFloat(P.lat);
    var INIT_ZOOM = (typeof P.zoom === "number") ? P.zoom : parseFloat(P.zoom);
    if (isNaN(INIT_LON)) INIT_LON = -3.70;
    if (isNaN(INIT_LAT)) INIT_LAT = 40.42;
    if (isNaN(INIT_ZOOM)) INIT_ZOOM = 12;

    var BASE_HOST = "https://componentes.idee.es/api-idee";
    var SVGCarga = document.getElementById("cargaSVG");

    // --- Carga dinámica de la API según implementación --------------------
    function loadCSS(href) {
      return new Promise(function (resolve) {
        var l = document.createElement("link");
        l.rel = "stylesheet"; l.href = href;
        l.onload = function () { resolve(); };
        l.onerror = function () { resolve(); };
        document.head.appendChild(l);
      });
    }
    function loadJS(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error("No se pudo cargar " + src)); };
        document.head.appendChild(s);
      });
    }
    function bundleSuffix() { return IMPL === "cesium" ? "cesium" : "ol"; }
    async function loadApi() {
      var suf = bundleSuffix();
      await loadCSS(BASE_HOST + "/assets/css/apiidee." + suf + ".min.css");
      await loadJS(BASE_HOST + "/vendor/browser-polyfill.js");
      await loadJS(BASE_HOST + "/js/apiidee." + suf + ".min.js");
      await loadJS(BASE_HOST + "/js/configuration.js");
      await waitFor(function () { return window.IDEE && window.IDEE.map; }, 8000);
    }
    function waitFor(cond, timeoutMs) {
      return new Promise(function (resolve, reject) {
        var t0 = Date.now();
        (function poll() {
          try { if (cond()) return resolve(); } catch (e) {}
          if (Date.now() - t0 > timeoutMs) return reject(new Error("timeout"));
          setTimeout(poll, 60);
        })();
      });
    }

    // --- Capas base IGN ---------------------------------------------------
    function configBaseLayers() {
      var IDEE = window.IDEE;
      try {
        var base = new IDEE.layer.TMS({
          url: "https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg",
          legend: "IGNBaseTodo", visible: true, isBase: true, tileGridMaxZoom: 17,
          name: "IGNBaseTodo_cmpv",
          attribution: '<p><b>Mapa base</b>: <a style="color:#0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>',
        }, { crossOrigin: "anonymous", displayInLayerSwitcher: false });
        IDEE.addQuickLayers({ IGNBaseTodo_cmpv: base });
        IDEE.config("tms", { base: "QUICK*IGNBaseTodo_cmpv" });
        IDEE.config.backgroundlayers = [
          { id: "mapa", title: "Callejero", layers: ["QUICK*IGNBaseTodo_cmpv"] },
          { id: "imagen", title: "Imagen", layers: ["QUICK*BASE_PNOA_MA_TMS"] },
        ];
        IDEE.proxy(false);
      } catch (e) { /* usa config por defecto */ }
    }

    // --- Conversión de encuadre ------------------------------------------
    function altitudeForZoom(z) { var base = 40075016.686; return (base / Math.pow(2, z)) * 1.0; }
    function zoomForAltitude(alt) { var base = 40075016.686; return Math.log2(base / Math.max(1, alt)); }

    // Lee el extent visible actual en grados.
    function readExtent(map) {
      try {
        var impl = map.getMapImpl();
        if (impl && typeof impl.getView === "function") {
          var view = impl.getView();
          var size = impl.getSize();
          if (!size || !size[0] || !size[1]) return null;
          var ext = view.calculateExtent(size);
          var code = view.getProjection().getCode();
          var sw = window.ol.proj.toLonLat([ext[0], ext[1]], code);
          var ne = window.ol.proj.toLonLat([ext[2], ext[3]], code);
          return { west: sw[0], south: sw[1], east: ne[0], north: ne[1] };
        } else if (impl && impl.scene && impl.camera) {
          var C = window.Cesium;
          var rect = impl.camera.computeViewRectangle(impl.scene.globe.ellipsoid);
          if (!rect) {
            var carto = impl.camera.positionCartographic;
            var lon = C.Math.toDegrees(carto.longitude);
            var lat = C.Math.toDegrees(carto.latitude);
            var half = (carto.height / 40075016.686) * 180;
            return { west: lon - half, south: lat - half, east: lon + half, north: lat + half };
          }
          return {
            west: C.Math.toDegrees(rect.west), south: C.Math.toDegrees(rect.south),
            east: C.Math.toDegrees(rect.east), north: C.Math.toDegrees(rect.north),
          };
        }
      } catch (e) {}
      return null;
    }

    function applyExtent(map, ext) {
      if (!ext) return false;
      try {
        var impl = map.getMapImpl();
        if (impl && typeof impl.getView === "function") {
          var view = impl.getView();
          var size = impl.getSize();
          var code = view.getProjection().getCode();
          var min = window.ol.proj.fromLonLat([ext.west, ext.south], code);
          var max = window.ol.proj.fromLonLat([ext.east, ext.north], code);
          var olExt = [
            Math.min(min[0], max[0]), Math.min(min[1], max[1]),
            Math.max(min[0], max[0]), Math.max(min[1], max[1]),
          ];
          view.fit(olExt, { size: size, duration: 0, constrainResolution: false });
          return true;
        } else if (impl && impl.scene && impl.camera) {
          var C = window.Cesium;
          var rect = C.Rectangle.fromDegrees(ext.west, ext.south, ext.east, ext.north);
          impl.camera.setView({ destination: rect });
          return true;
        }
      } catch (e) {}
      return false;
    }

    function readCenterZoom(map) {
      try {
        var impl = map.getMapImpl();
        if (impl && typeof impl.getView === "function") {
          var view = impl.getView();
          var c = view.getCenter();
          var ll = window.ol.proj.toLonLat(c, view.getProjection().getCode());
          return { lon: ll[0], lat: ll[1], zoom: view.getZoom() };
        } else if (impl && impl.scene && impl.camera) {
          var C = window.Cesium;
          var carto = impl.camera.positionCartographic;
          return { lon: C.Math.toDegrees(carto.longitude), lat: C.Math.toDegrees(carto.latitude), zoom: zoomForAltitude(carto.height) };
        }
      } catch (e) {}
      return null;
    }

    function applyView(map, v) {
      try {
        var impl = map.getMapImpl();
        if (impl && typeof impl.getView === "function") {
          var view = impl.getView();
          var c = window.ol.proj.fromLonLat([v.lon, v.lat], view.getProjection().getCode());
          view.setCenter(c);
          if (typeof v.zoom === "number") view.setZoom(v.zoom);
          return true;
        } else if (impl && impl.scene && impl.camera) {
          var C = window.Cesium;
          // Si no viene zoom, conservar la altitud actual de la cámara.
          var alt = (typeof v.zoom === "number")
            ? altitudeForZoom(v.zoom)
            : impl.camera.positionCartographic.height;
          impl.camera.setView({
            destination: C.Cartesian3.fromDegrees(v.lon, v.lat, alt),
            orientation: { heading: 0.0, pitch: -C.Math.PI_OVER_TWO, roll: 0.0 },
          });
          return true;
        }
      } catch (e) {}
      return false;
    }

    // --- postMessage con el padre ----------------------------------------
    function postToParent(msg) {
      try { window.parent.postMessage(Object.assign({ vpId: VP_ID, source: "cmpv-vista" }, msg), "*"); } catch (e) {}
    }

    var _map = null;
    var _prog = 0;
    var _controlsVisible = true;
    var _configApplied = false;

    function onNativeChange() {
      if (_prog > 0) return;
      var msg = { type: "cmpv:view" };
      var ext = readExtent(_map);
      if (ext) msg.extent = ext;
      var cz = readCenterZoom(_map);
      if (cz) { msg.lon = cz.lon; msg.lat = cz.lat; msg.zoom = cz.zoom; }
      if (ext || cz) postToParent(msg);
    }

    function wireContinuousSync() {
      var impl = _map.getMapImpl();
      if (impl && typeof impl.getView === "function") {
        var view = impl.getView();
        view.on("change:center", onNativeChange);
        view.on("change:resolution", onNativeChange);
      } else if (impl && impl.scene && impl.camera) {
        impl.camera.percentageChanged = 0.001;
        impl.camera.changed.addEventListener(onNativeChange);
      }
    }

    function handleParentMessage(ev) {
      var d = ev.data;
      if (!d || typeof d.type !== "string") return;
      if (d.type === "cmpv:setView") {
        _prog += 1;
        if (d.extent) applyExtent(_map, d.extent);
        else applyView(_map, { lon: d.lon, lat: d.lat, zoom: d.zoom });
        setTimeout(function () { _prog = Math.max(0, _prog - 1); }, 0);
      } else if (d.type === "cmpv:getView") {
        var ext = readExtent(_map);
        if (ext) postToParent({ type: "cmpv:view", extent: ext });
      } else if (d.type === "cmpv:setControls") {
        applyControlsVisibility(d.visible !== false);
      } else if (d.type === "cmpv:setConfig") {
        applyConfig(d.config);
      } else if (d.type === "cmpv:updateSize") {
        // El padre acaba de mostrar esta vista (o cambiar su tamaño). Forzar
        // que el mapa recalcule su viewport para que pinte correctamente.
        try {
          if (_map) {
            var impl = _map.getMapImpl();
            var isCesium = !!(impl && impl.scene && impl.camera);
            if (impl && typeof impl.updateSize === "function") impl.updateSize();        // OpenLayers
            else if (isCesium && typeof impl.resize === "function") impl.resize();       // Cesium
            // Después de redimensionar, enviar el extent ACTUAL al padre.
            // OpenLayers es síncrono (updateSize actualiza de inmediato), pero
            // Cesium renderiza de forma asíncrona: el globo necesita tiempo para
            // cargar teselas y actualizar la vista. Usamos un delay mayor para
            // Cesium y uno corto para OL.
            var delay = isCesium ? 300 : 0;
            setTimeout(function () {
              var msg = { type: "cmpv:view" };
              var ext = readExtent(_map);
              if (ext) msg.extent = ext;
              var cz = readCenterZoom(_map);
              if (cz) { msg.lon = cz.lon; msg.lat = cz.lat; msg.zoom = cz.zoom; }
              if (ext || cz) postToParent(msg);
            }, delay);
          }
        } catch (e) {}
      }
    }

    // Reconstruye capas/plugins/controles serializados con el IDEE del iframe.
    function applyConfig(cfg) {
      if (!cfg || _configApplied || !_map) return;
      _configApplied = true;
      var IDEE = window.IDEE;
      try {
        var layers = [];
        (cfg.layers || []).forEach(function (l) {
          if (!l) return;
          if (l.kind === "string") { layers.push(l.def); }
          else if (l.kind === "object" && l.type && IDEE.layer && IDEE.layer[l.type]) {
            try { layers.push(new IDEE.layer[l.type](l.params || {})); }
            catch (e) { console.warn("[vista] Layer " + l.type + " no reconstruible:", e); }
          }
        });
        if (layers.length) _map.addLayers(layers);
      } catch (e) { console.warn("[vista] Error añadiendo capas:", e); }
      try {
        if (cfg.controls && cfg.controls.length && _map.addControls) _map.addControls(cfg.controls.slice());
      } catch (e) { console.warn("[vista] Error añadiendo controles:", e); }
      try {
        (cfg.plugins || []).forEach(function (p) {
          if (!p || !p.name) return;
          if (IDEE.plugin && IDEE.plugin[p.name]) {
            try { _map.addPlugin(new IDEE.plugin[p.name](p.params || {})); }
            catch (e) { console.warn("[vista] Plugin " + p.name + " no reconstruible:", e); }
          } else { console.warn("[vista] Plugin no disponible en este iframe:", p.name); }
        });
      } catch (e) { console.warn("[vista] Error añadiendo plugins:", e); }
      applyControlsVisibility(_controlsVisible);
    }

    // Oculta/muestra el chrome del mapa (controles/plugins IDEE + botón 2D/3D).
    function applyControlsVisibility(visible) {
      _controlsVisible = (visible !== false);
      var areas = document.querySelectorAll(".m-area");
      for (var i = 0; i < areas.length; i++) areas[i].style.display = _controlsVisible ? "" : "none";
      var camb = document.querySelector(".cmpv-cambimpl");
      if (camb) camb.style.display = _controlsVisible ? "" : "none";
    }

    // --- Arranque ---------------------------------------------------------
    (async function boot() {
      try { await loadApi(); }
      catch (e) { console.error("[vista] No se pudo cargar la API-IDEE (" + IMPL + "):", e); return; }
      var IDEE = window.IDEE;
      if (IMPL === "cesium") { try { IDEE.config.DPI = 25.4 / 0.28; } catch (e) {} }
      configBaseLayers();

      _map = IDEE.map({ container: "mapaDIV" });
      window._cmpvMap = _map;
      window.mapajs = _map;

      var applyInitial = function () {
        _prog += 1;
        applyView(_map, { lon: INIT_LON, lat: INIT_LAT, zoom: INIT_ZOOM });
        setTimeout(function () { _prog = Math.max(0, _prog - 1); }, 0);
      };
      try { _map.on(IDEE.evt.COMPLETED, applyInitial); } catch (e) {}
      setTimeout(applyInitial, 1200);

      waitFor(function () {
        try {
          var impl = _map.getMapImpl();
          return impl && ((typeof impl.getView === "function") || (impl.scene && impl.camera));
        } catch (e) { return false; }
      }, 12000).then(function () {
        applyInitial();
        wireContinuousSync();
        if (SVGCarga) SVGCarga.hidden = true;
        buildCambioImplButton();
        postToParent({ type: "cmpv:ready", impl: IMPL });
        // Para Cesium: el globo carga teselas de forma asíncrona. El primer
        // cmpv:ready se envía cuando scene+camera existen, pero el globo puede
        // no estar texturizado aún. Escuchamos postRender para enviar el extent
        // REAL cuando Cesium haya terminado su primer render completo.
        if (IMPL === "cesium") {
          try {
            var impl = _map.getMapImpl();
            var onceRendered = false;
            impl.scene.postRender.addEventListener(function () {
              if (onceRendered) return;
              onceRendered = true;
              var msg = { type: "cmpv:view" };
              var ext = readExtent(_map);
              if (ext) msg.extent = ext;
              var cz = readCenterZoom(_map);
              if (cz) { msg.lon = cz.lon; msg.lat = cz.lat; msg.zoom = cz.zoom; }
              if (ext || cz) postToParent(msg);
            });
          } catch (e) {}
        }
      }).catch(function () {
        if (SVGCarga) SVGCarga.hidden = true;
        buildCambioImplButton();
        postToParent({ type: "cmpv:ready", impl: IMPL, warning: "map-not-detected" });
      });

      window.addEventListener("message", handleParentMessage);
    })();

    // Botón 🌐 2D/3D. Ya NO recarga por location: emite cmpv:implChange y el
    // padre regenera el srcdoc del iframe con la otra implementación.
    function buildCambioImplButton() {
      if (document.getElementById("cmpv-cambimpl-btn")) return;
      var wrap = document.createElement("div");
      wrap.className = "cmpv-cambimpl m-herramienta-container_cambImpl";
      var btn = document.createElement("button");
      btn.id = "cmpv-cambimpl-btn";
      btn.className = "buttonHerramienta_cambImpl";
      btn.title = "Cambiar a " + (IMPL === "cesium" ? "2D (OpenLayers)" : "3D (Cesium)");
      if (IMPL === "cesium") btn.classList.add("activated");
      wrap.appendChild(btn);
      document.body.appendChild(wrap);
      btn.addEventListener("click", function () {
        var target = (IMPL === "cesium") ? "ol" : "cesium";
        var st = readCenterZoom(_map) || { lon: INIT_LON, lat: INIT_LAT, zoom: INIT_ZOOM };
        postToParent({ type: "cmpv:implChange", impl: target, lon: st.lon, lat: st.lat, zoom: st.zoom });
      });
      applyControlsVisibility(_controlsVisible);
    }
  }

  class miPlugin_comparacionVistas {
    /**
     * @param {Object} options
     * @param {string} [options.id]
     *
     * El documento de cada vista (iframe) se genera dinámicamente vía srcdoc
     * (el plugin es autocontenido; ya no depende de vista.html/vista.js).
     *
     * --- Configuración de comparación INICIAL (arranca en cualquier modo) ---
     * @param {("single"|"swipe"|"mirror")} [options.mode="single"] Modo inicial.
     * @param {Object} [options.swipe] Cortinilla: { layout:"1x1"|"2x1"|"1x2"|"2x2" }.
     * @param {Object} [options.layout] Espejo: { type:"grid", rows, cols } o { type:"custom", spec:[1,3,1] }.
     * @param {boolean} [options.sync=true] Sincronizar encuadre entre vistas.
     * @param {boolean} [options.showControls=true] Mostrar controles/plugins de IDEE + botón 2D/3D.
     *
     * --- Vistas iniciales (cada una con su config de mapa) ---
     * @param {Array<Object>} [options.views] Lista de vistas. Cada vista:
     *   {
     *     name?: string,
     *     implementation?: "2D"|"3D"|"ol"|"cesium",   // acepta ambos formatos
     *     center?: [lon,lat] | {lon,lat}, zoom?: number,
     *     isPrimary?: boolean,                         // vista principal (clonada al "Crear")
     *     layers?: Array<IDEE.layer.* | string>,       // objetos IDEE.layer o strings API
     *     plugins?: Array<IDEE.plugin.* | {name,params}>,
     *     controls?: Array<string>                     // p.ej. ["scale","panzoom"]
     *   }
     *   NOTA: no se aceptan objetos IDEE.map (el motor OL/Cesium es único por
     *   documento). Sí se aceptan IDEE.layer / IDEE.plugin: se serializan aquí y
     *   se reconstruyen dentro de cada iframe.
     * @param {Array<number|string>} [options.slots] Qué vista ocupa cada slot
     *   inicial (por índice o id). Opcional.
     *
     * --- Retrocompatibilidad ---
     * @param {number} [options.lon] Centro inicial (lon). Def. -3.70
     * @param {number} [options.lat] Centro inicial (lat). Def. 40.42
     * @param {number} [options.zoom] Zoom inicial. Def. 12
     */
    constructor(options = {}) {
      this.name = "miPlugin_comparacionVistas";
      this.options = options || {};
      this.id = this.options.id || ("comparacionVistas-" + nextUid());
      this.initLon = (typeof this.options.lon === "number") ? this.options.lon : -3.70;
      this.initLat = (typeof this.options.lat === "number") ? this.options.lat : 40.42;
      this.initZoom = (typeof this.options.zoom === "number") ? this.options.zoom : 12;

      this.supra = null;
      this.ui = null;
      this._workArea = null;

      // view = { id, name, impl:'ol'|'cesium', iframe, div, ready, lastView,
      //          _progUpdates, config:{layers,plugins,controls} }
      this.views = [];
      // Modo inicial (single/swipe/mirror/molde). Retrocompat: single.
      this.mode = (["single", "swipe", "mirror", "molde"].indexOf(this.options.mode) !== -1)
        ? this.options.mode : "single";
      this.sync = (this.options.sync !== false);
      this.syncMode = (this.options.syncMode === "center") ? "center" : "extent";
      this.showControls = (this.options.showControls !== false);
      this.activeViewId = null;

      // Cortinilla: divisor vertical siempre presente (izq|der). Opcionalmente,
      // cada lado se subdivide con un divisor horizontal propio.
      //   "1x1" = 2 vistas:  izq | der
      //   "2x1" = 3 vistas:  izq | (der-arr / der-abj)
      //   "1x2" = 3 vistas:  (izq-arr / izq-abj) | der
      //   "2x2" = 4 vistas:  (izq-arr / izq-abj) | (der-arr / der-abj)
      // slots[] es un array plano de viewIds en orden:
      //   [izq (o izq-arr), izq-abj?, der (o der-arr), der-abj?]
      var sw = this.options.swipe || {};
      this.swipe = {
        layout: sw.layout || "1x1",       // "1x1"|"2x1"|"1x2"|"2x2"
        slots: [],                         // [viewId, ...]
        posV: 0.5,                         // posición divisor vertical (0..1)
        posHL: 0.5,                        // posición divisor horizontal izquierdo (0..1)
        posHR: 0.5,                        // posición divisor horizontal derecho (0..1)
      };

      // Estilo de los divisores (barras y tirador).
      this._divStyle = {
        visible: true,
        color: "#ffffff",
        width: 4,
        handleColor: "#f57105",
        handleSize: 32,
      };

      // Espejo: array de FILAS (cada fila = array de viewIds). Grid irregular
      // permitido. Se inicializa al entrar en modo espejo si está vacío.
      this.grid = [];
      // Tipo de disposición del espejo y su especificación inicial.
      var lay = this.options.layout || {};
      this.layoutType = (lay.type === "custom") ? "custom" : "grid";
      this._initGridRows = (typeof lay.rows === "number") ? lay.rows : 1;
      this._initGridCols = (typeof lay.cols === "number") ? lay.cols : 2;
      this.customSpec = Array.isArray(lay.spec) && lay.spec.length ? lay.spec.slice() : [1, 2];

      // Molde(s): vistas superpuestas; la SUPERIOR de cada molde se recorta con
      // una figura (SVG clip-path) y por la abertura se ve la vista BASE.
      //   molds[] = array de moldes; cada uno recorta SU PROPIA vista superior
      //   (topId) con su figura; la base es COMPARTIDA por todos (moldBaseId).
      //   moldSelId = molde activo en el panel de configuración
      //   cx/cy     = centro de la figura en % del stage
      //   radius    = radio de la figura en % del lado menor del stage
      //   angle     = rotación de la figura en grados
      var mo = this.options.mold;
      var moldList = Array.isArray(mo) ? mo : (mo ? [mo] : [{}]);
      this.molds = [];
      moldList.forEach(function (m, i) {
        this.molds.push({
          id: "m" + ((m && m.id != null) ? m.id : (i + 1)),
          shape: (m && m.shape) || "circle",  // circle|ellipse|rect|triangle|diamond|pentagon|hexagon|octagon|star|heart|duck
          topId: null,
          cx: (m && typeof m.cx === "number") ? m.cx : 50,
          cy: (m && typeof m.cy === "number") ? m.cy : 50,
          radius: (m && typeof m.radius === "number") ? m.radius : 25,
          angle: (m && typeof m.angle === "number") ? m.angle : 0,
        });
      }, this);
      if (!this.molds.length) {
        this.molds.push({ id: "m1", shape: "circle", topId: null, cx: 50, cy: 50, radius: 25, angle: 0 });
      }
      this._moldSeq = this.molds.length;   // ids únicos al añadir moldes en runtime
      this.moldBaseId = null;
      this.moldSelId = this.molds[0].id;

      // Config de vistas iniciales (serializada, lista para consumir en addTo).
      this._initialViews = this._normalizeInitialViews(this.options.views);
      this._initialSlots = Array.isArray(this.options.slots) ? this.options.slots.slice() : null;

      // Vistas que esperan sincronización inicial (la ref no ha reportado extent).
      this._pendingSyncViews = new Set();

      // Escucha global de mensajes de los iframes.
      var self = this;
      this._onMessage = function (ev) { self._handleViewMessage(ev); };
      window.addEventListener("message", this._onMessage);
    }

    // =====================================================================
    //  Normalización / serialización de configuración
    // =====================================================================
    // Acepta "2D"/"3D" y "ol"/"cesium"; devuelve siempre "ol"|"cesium".
    _normalizeImpl(impl) {
      if (impl === "cesium" || impl === "3D" || impl === "3d") return "cesium";
      return "ol"; // "2D","ol" y cualquier otro -> ol
    }

    // Extrae {lon,lat} de center:[lon,lat] | {lon,lat}.
    _normalizeCenter(center) {
      if (Array.isArray(center) && center.length >= 2) {
        return { lon: Number(center[0]), lat: Number(center[1]) };
      }
      if (center && typeof center === "object" && typeof center.lon === "number") {
        return { lon: center.lon, lat: center.lat };
      }
      return null;
    }

    // Serializa un layer para transportarlo al iframe y reconstruirlo allí.
    // Acepta: string (definición API-IDEE) u objeto IDEE.layer.* (usa su
    // constructorParameters). Devuelve { kind, ... } o null si no se puede.
    _serializeLayer(layer) {
      if (!layer) return null;
      if (typeof layer === "string") return { kind: "string", def: layer };
      // Objeto IDEE.layer.*: type ("WMS","GeoJSON","TMS"...) + constructorParameters.
      try {
        var type = layer.type || (layer.constructorParameters && layer.constructorParameters.type);
        var cp = layer.constructorParameters;
        if (type && cp) {
          // WMS usa {userParameters}, otros usan {parameters}. Unificamos.
          var params = cp.userParameters || cp.parameters || cp;
          // Sólo si es JSON-serializable (evita referencias a impl/map).
          var safe = JSON.parse(JSON.stringify(params));
          return { kind: "object", type: type, params: safe };
        }
      } catch (e) { /* no serializable: se ignora abajo */ }
      console.warn("[comparacionVistas] Layer no serializable, se omite:", layer);
      return null;
    }

    // Serializa un plugin: acepta objeto IDEE.plugin.* (usa name + params/options)
    // o { name, params }. Devuelve { name, params } o null.
    _serializePlugin(plugin) {
      if (!plugin) return null;
      if (typeof plugin === "object" && plugin.name && !plugin.addTo) {
        // Ya es una definición { name, params }.
        try { return { name: plugin.name, params: JSON.parse(JSON.stringify(plugin.params || {})) }; }
        catch (e) { return { name: plugin.name, params: {} }; }
      }
      try {
        var name = plugin.name;
        var raw = plugin.options || plugin.params || {};
        var params = JSON.parse(JSON.stringify(raw));
        if (name) return { name: name, params: params };
      } catch (e) { /* no serializable */ }
      console.warn("[comparacionVistas] Plugin no serializable, se omite:", plugin);
      return null;
    }

    // Normaliza la lista de vistas del constructor a una forma interna estable:
    // [{ name?, impl, center?, zoom?, isPrimary, config:{layers,plugins,controls} }]
    _normalizeInitialViews(views) {
      var self = this;
      if (!Array.isArray(views) || !views.length) return null;
      var out = views.map(function (v, i) {
        v = v || {};
        var center = self._normalizeCenter(v.center);
        var layers = Array.isArray(v.layers)
          ? v.layers.map(function (l) { return self._serializeLayer(l); }).filter(Boolean) : [];
        var plugins = Array.isArray(v.plugins)
          ? v.plugins.map(function (p) { return self._serializePlugin(p); }).filter(Boolean) : [];
        var controls = Array.isArray(v.controls) ? v.controls.slice() : [];
        return {
          name: v.name || ("Vista " + (i + 1)),
          impl: self._normalizeImpl(v.implementation),
          lon: center ? center.lon : undefined,
          lat: center ? center.lat : undefined,
          zoom: (typeof v.zoom === "number") ? v.zoom : undefined,
          isPrimary: !!v.isPrimary,
          config: { layers: layers, plugins: plugins, controls: controls },
        };
      });
      // Garantiza exactamente una principal: la marcada, o la primera.
      if (!out.some(function (v) { return v.isPrimary; })) out[0].isPrimary = true;
      return out;
    }

    // --- Contrato de item del supraplugin ----------------------------------
    getSupraElement(supra) {
      this.supra = supra;
      this._resolveWorkArea();
      this._adoptPrimaryView();
      this.ui = this._buildUI();
      // Aplica la configuración de comparación INICIAL (modo + swipe/grid).
      this._applyInitialComparison();
      this._refreshUI();
      return this.ui;
    }

    // Aplica el modo inicial y su configuración específica (swipe/layout). Si el
    // constructor no indicó nada, equivale a arrancar en "single" (retrocompat).
    _applyInitialComparison() {
      if (this.mode === "mirror") {
        // Prepara el grid según el layout inicial antes de entrar en el modo.
        if (this.layoutType === "custom") {
          this._setGridCustom(this.customSpec);
        } else {
          this._setGridRegular(this._initGridRows, this._initGridCols);
        }
        this.setMode("mirror");
      } else if (this.mode === "swipe") {
        // swipe.layout ya viene del constructor.
        this.setMode("swipe");
      } else if (this.mode === "molde") {
        // mold.shape ya viene del constructor.
        this.setMode("molde");
      } else {
        this.setMode("single");
      }
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

      // Si el constructor trajo vistas iniciales, créalas todas con su config.
      if (this._initialViews && this._initialViews.length) {
        var self = this;
        var firstPrimaryId = null;
        this._initialViews.forEach(function (vc) {
          var v = self._makeView({
            name: vc.name,
            impl: vc.impl,
            isPrimary: vc.isPrimary,
            lon: (typeof vc.lon === "number") ? vc.lon : self.initLon,
            lat: (typeof vc.lat === "number") ? vc.lat : self.initLat,
            zoom: (typeof vc.zoom === "number") ? vc.zoom : self.initZoom,
            config: vc.config,
          });
          if (vc.isPrimary && !firstPrimaryId) firstPrimaryId = v.id;
        });
        this.activeViewId = firstPrimaryId || (this.views[0] && this.views[0].id);
        return;
      }

      // Retrocompat: una sola vista OL con el encuadre lon/lat/zoom clásicos.
      var primary = this._makeView({
        name: "Vista 1",
        impl: "ol",
        isPrimary: true,
        lon: this.initLon, lat: this.initLat, zoom: this.initZoom,
      });
      this.activeViewId = primary.id;
    }

    // Devuelve la vista principal (isPrimary) o, en su defecto, la primera.
    _getPrimaryView() {
      for (var i = 0; i < this.views.length; i++) if (this.views[i].isPrimary) return this.views[i];
      return this.views[0] || null;
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
      div.appendChild(iframe);
      this._workArea.appendChild(div);
      // El iframe ya está en el DOM (about:blank): escribimos su documento.
      this._writeIframeDoc(iframe, id, impl, lon, lat, zoom);

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
        _extentReported: false,
        // Config de mapa de la vista (capas/plugins/controles serializados),
        // que se envía al iframe cuando esté listo y se clona al "Crear".
        config: opts.config || { layers: [], plugins: [], controls: [] },
      };
      this.views.push(view);
      return view;
    }

    // Genera el documento COMPLETO de una vista para inyectarlo en iframe.srcdoc.
    // Antes esto era vista.html + vista.js; ahora el plugin es autocontenido.
    //  - <base href> apunta a la carpeta del plugin (PLUGIN_BASE), para que las
    //    rutas relativas (spinner ../../img, cambioImpl.css) resuelvan.
    //  - Los parámetros van en window.__CMPV_PARAMS (no en query string).
    //  - El script de la vista es _vistaBoot serializado con .toString().
    _buildVistaSrcdoc(vpId, impl, lon, lat, zoom) {
      var params = {
        impl: impl, vp: vpId,
        lon: Number(lon), lat: Number(lat), zoom: Number(zoom),
      };
      // IMPORTANTE: NO usamos <base href>. Un <base> rompe la carga de los Web
      // Workers de CesiumJS (resuelve mal sus rutas de worker/asset), dejando el
      // globo 3D en negro aunque las teselas se descarguen. En su lugar, TODAS
      // nuestras rutas de recursos se hacen ABSOLUTAS contra PLUGIN_BASE.
      // PLUGIN_BASE = .../ext/comparacionVistas/  →  resolvemos con new URL().
      var abs = function (rel) {
        try { return new URL(rel, PLUGIN_BASE || location.href).href; }
        catch (e) { return rel; }
      };
      var cssCambioImpl = abs("../cambioImpl/cambioImpl.css");   // ext/cambioImpl/
      var spinner = abs("../../img/iconos/gear-spinner.svg");    // img/iconos/
      return "" +
        "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0\">" +
        "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">" +
        "<meta name=\"cnig\" content=\"yes\">" +
        "<title>Vista (comparación)</title>" +
        // Estilo del botón 🌐 (reutiliza el del plugin cambioImpl), ruta absoluta.
        "<link type=\"text/css\" rel=\"stylesheet\" href=\"" + cssCambioImpl + "\">" +
        // Estilos de la vista (antes vista.css), ahora inline.
        "<style>" +
        "html,body{margin:0;padding:0;height:100%;width:100%;overflow:hidden}" +
        "#mapaDIV{width:100%;height:100%;position:relative}" +
        "#cargaSVG{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.85);pointer-events:none}" +
        "#cargaSVG[hidden]{display:none}#cargaSVG img{width:64px;height:64px}" +
        ".cmpv-cambimpl{position:absolute;top:10px;left:10px;z-index:40}" +
        ".cmpv-cambimpl .buttonHerramienta_cambImpl{width:40px;height:40px;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;box-sizing:border-box}" +
        ".cmpv-cambimpl .buttonHerramienta_cambImpl:before{display:block;line-height:1;margin:0}" +
        "</style></head><body>" +
        "<div id=\"cargaSVG\"><img src=\"" + spinner + "\"></div>" +
        "<div id=\"mapaDIV\"></div>" +
        "<script>window.__CMPV_PARAMS=" + JSON.stringify(params) + ";</scr" + "ipt>" +
        "<script>(" + _vistaBoot.toString() + ")();</scr" + "ipt>" +
        "</body></html>";
    }

    // Escribe el documento de la vista DENTRO de un iframe about:blank vía
    // document.write. Es el único mecanismo que cumple las 3 restricciones:
    //  - El iframe about:blank modificado por el padre HEREDA el origin real del
    //    padre (no "null" como srcdoc, no opaco como blob:). Esto es CRÍTICO:
    //    CesiumJS crea Web Workers para procesar la imaginería; con origin null
    //    u opaco los workers fallan en silencio → globo NEGRO. Con origin real
    //    funcionan y el globo se texturiza.
    //  - Hereda la URL base del padre, así las rutas relativas de datos del
    //    usuario (p.ej. ../../datos/x.geojson) resuelven correctamente.
    //  - Autocontenido: el HTML se genera aquí, sin ficheros externos.
    _writeIframeDoc(iframe, vpId, impl, lon, lat, zoom) {
      var html = this._buildVistaSrcdoc(vpId, impl, lon, lat, zoom);
      var write = function () {
        try {
          var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
          if (!doc) return false;
          doc.open();
          doc.write(html);
          doc.close();
          return true;
        } catch (e) { return false; }
      };
      // El iframe recién insertado ya tiene un about:blank document listo.
      if (!write()) {
        // Respaldo defensivo: reintenta tras el load de about:blank.
        iframe.addEventListener("load", function onL() {
          iframe.removeEventListener("load", onL);
          write();
        });
      }
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
        // Envía la config de mapa (capas/plugins/controles) para que el iframe
        // la reconstruya con su propio IDEE (antes del encuadre).
        this._sendConfig(v);
        // Encuadre a aplicar cuando la vista queda lista. Si la sincronización
        // está activa, alineamos SIEMPRE con la vista de referencia (la activa),
        // no con el encuadre propio: así una vista que acaba de cargar (nueva, o
        // recargada por 2D/3D, o que estaba oculta) aparece YA sincronizada sin
        // necesidad de mover el mapa.
        //
        // Si la referencia NO ha reportado su extent aún (p.ej. es Cesium y el
        // globo aún carga tiles), NO sincronizamos: su lastView podría ser un
        // extent basado en dimensiones antiguas. En su lugar, encolamos la vista
        // y esperamos a que la ref reporte cmpv:view con el extent real.
        var deferred = false;
        if (this.sync) {
          var ref = this.getView(this.activeViewId) || this.views[0];
          if (ref && ref !== v && ref._extentReported && ref.lastView) {
            this._sendSetView(v, ref.lastView);
          } else if (ref && ref !== v && !ref._extentReported) {
            // La ref aún no ha reportado: encola para sincronizar después.
            this._pendingSyncViews.add(v.id);
            deferred = true;
          }
        }
        if (!deferred) {
          var stateToApply = v.lastView;
          if (stateToApply) this._sendSetView(v, stateToApply);
        }
        // Aplica el estado actual de visibilidad de controles/plugins (para
        // vistas nuevas o recargadas tras un cambio 2D/3D).
        this._sendControls(v);
        this._refreshUI();
        return;
      }

      // El botón 🌐 dentro de la vista pidió cambiar su implementación (2D<->3D).
      // Con srcdoc, el iframe NO se recarga solo: lo regeneramos aquí con la otra
      // implementación, preservando el encuadre que nos envió.
      if (d.type === "cmpv:implChange") {
        var newImpl = (d.impl === "ol" || d.impl === "cesium") ? d.impl
          : ((v.impl === "cesium") ? "ol" : "cesium");
        v.impl = newImpl;
        if (typeof d.lon === "number") v.lastView = { lon: d.lon, lat: d.lat, zoom: d.zoom };
        v.ready = false;
        var cz = this._centerZoomFromState(v.lastView);
        this._setIframeDoc(v, newImpl, cz.lon, cz.lat, cz.zoom);
        this._refreshUI();
        return;
      }

      if (d.type === "cmpv:view") {
        // Guardamos AMBOS formatos (extent y center+zoom) para que
        // _sendSetView pueda elegir según syncMode.
        v.lastView = {};
        if (d.extent) v.lastView.extent = d.extent;
        if (typeof d.lon === "number") { v.lastView.lon = d.lon; v.lastView.lat = d.lat; v.lastView.zoom = d.zoom; }
        // Marcar que esta vista ya ha reportado su extent real. El primer
        // cmpv:view es el más importante: si hay vistas encoladas esperando
        // sincronizarse con esta, les enviamos el extent fresco AHORA.
        if (!v._extentReported) {
          v._extentReported = true;
          this._flushPendingSyncs(v);
        }
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
        // "extent": sync total (misma área visible).
        // "center": solo sincroniza el centro, cada vista conserva su zoom.
        if (this.syncMode === "center" && typeof state.lon === "number") {
          msg.lon = state.lon; msg.lat = state.lat;
          // NO enviamos zoom: cada vista mantiene el suyo.
        } else if (state.extent) {
          msg.extent = state.extent;
        } else if (typeof state.lon === "number") {
          msg.lon = state.lon; msg.lat = state.lat; msg.zoom = state.zoom;
        }
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

    // Envía el extent fresco de una vista a todas las vistas que estaban
    // esperando (encoladas en cmpv:ready porque la ref no había reportado).
    _flushPendingSyncs(sourceView) {
      if (!this._pendingSyncViews || !this._pendingSyncViews.size) return;
      var self = this;
      var ids = Array.from(this._pendingSyncViews);
      this._pendingSyncViews.clear();
      ids.forEach(function (id) {
        var v = self.getView(id);
        if (!v || !v.ready || !sourceView.lastView) return;
        self._sendSetView(v, sourceView.lastView);
      });
    }

    // Envía a una vista su config de mapa (capas/plugins/controles serializados)
    // para que la reconstruya con su propio IDEE dentro del iframe.
    _sendConfig(v) {
      if (!v || !v.iframe || !v.iframe.contentWindow || !v.config) return;
      var cfg = v.config;
      if (!(cfg.layers && cfg.layers.length) &&
          !(cfg.plugins && cfg.plugins.length) &&
          !(cfg.controls && cfg.controls.length)) return; // nada que enviar
      try {
        v.iframe.contentWindow.postMessage(
          { type: "cmpv:setConfig", target: v.id, config: cfg }, "*");
      } catch (e) {}
    }

    // Envía a una vista el estado de visibilidad de controles/plugins.
    _sendControls(v) {
      if (!v || !v.iframe || !v.iframe.contentWindow) return;
      try {
        v.iframe.contentWindow.postMessage(
          { type: "cmpv:setControls", target: v.id, visible: this.showControls }, "*");
      } catch (e) {}
    }

    // Difunde el estado de controles/plugins a TODAS las vistas.
    _broadcastControls() {
      var self = this;
      this.views.forEach(function (v) { self._sendControls(v); });
    }

    // Envía a una vista el aviso de que su contenedor cambió de tamaño y debe
    // recalcular el viewport del mapa (OpenLayers updateSize / Cesium resize).
    _sendUpdateSize(v) {
      if (!v || !v.iframe || !v.iframe.contentWindow) return;
      try { v.iframe.contentWindow.postMessage({ type: "cmpv:updateSize", target: v.id }, "*"); }
      catch (e) {}
    }

    // Avisa a TODAS las vistas visibles de que deben redimensionar su mapa.
    _broadcastUpdateSize() {
      var self = this;
      this.views.forEach(function (v) {
        if (v.div && v.div.style.display !== "none") self._sendUpdateSize(v);
      });
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
        '  <button type="button" class="cmpv-tool" data-act="molde" title="Comparar con molde (una figura recorta la vista superior)">' +
        '    <span class="cmpv-ico">🔷</span><span class="cmpv-lbl">Molde</span></button>' +
        '  <button type="button" class="cmpv-tool cmpv-tool--cfg" data-act="opciones" title="Opciones / configuración">' +
        '    <span class="cmpv-ico">⚙</span><span class="cmpv-lbl">Opciones</span></button>' +
        '</div>' +
        '<div class="cmpv-sidenav" data-role="sidenav">' +
        '  <div class="cmpv-sidenav__header">' +
        '    <span>Configuración de la comparación</span>' +
        '    <button type="button" class="cmpv-sidenav__close" data-role="close-cfg" title="Cerrar">&times;</button>' +
        '  </div>' +
        '  <div class="cmpv-sidenav__body">' +
        // ── Acordeón: Opciones ──
        '    <div class="cmpv-accordion" data-role="acc-opciones">' +
        '      <div class="cmpv-accordion__header" role="button" tabindex="0" aria-expanded="true">' +
        '        <span class="cmpv-sidenav__subtitle cmpv-accordion__title">Opciones</span>' +
        '        <span class="cmpv-accordion__chevron">▸</span>' +
        '      </div>' +
        '      <div class="cmpv-accordion__body">' +
        '        <label class="cmpv-field"><input type="checkbox" data-role="sync" checked> Sincronizar encuadre</label>' +
        '        <label class="cmpv-field" data-role="sync-mode-field" data-only="mirror">Tipo de sincronización' +
        '          <select class="cmpv-select" data-role="sync-mode">' +
        '            <option value="extent">Extensión (sincronización total)</option>' +
        '            <option value="center">Solo centro (zoom independiente)</option>' +
        '          </select></label>' +
        '        <label class="cmpv-field"><input type="checkbox" data-role="controls" checked> Mostrar controles</label>' +
        '        <div class="cmpv-field--sep"></div>' +
        '        <span class="cmpv-field__title">Apariencia de los divisores</span>' +
        '        <label class="cmpv-field"><input type="checkbox" data-role="div-visible" checked> Mostrar barras de división</label>' +
        '        <label class="cmpv-field">Color barra <input type="color" data-role="div-color" value="#ffffff" class="cmpv-color"></label>' +
        '        <label class="cmpv-field">Ancho barra <input type="range" data-role="div-width" min="1" max="12" value="4" class="cmpv-range"> <span data-role="div-width-val">4</span>px</label>' +
        '        <label class="cmpv-field">Color tirador <input type="color" data-role="handle-color" value="#f57105" class="cmpv-color"></label>' +
        '        <label class="cmpv-field">Tamaño tirador <input type="range" data-role="handle-size" min="16" max="56" value="32" class="cmpv-range"> <span data-role="handle-size-val">32</span>px</label>' +
        '      </div>' +
        '    </div>' +
        // ── Acordeón: Mapas de comparación ──
        '    <div class="cmpv-accordion" data-role="acc-comparacion">' +
        '      <div class="cmpv-accordion__header" role="button" tabindex="0" aria-expanded="true">' +
        '        <span class="cmpv-sidenav__subtitle cmpv-accordion__title">Mapas de comparación</span>' +
        '        <span class="cmpv-accordion__chevron">▸</span>' +
        '      </div>' +
        '      <div class="cmpv-accordion__body">' +
        '        <label class="cmpv-field" data-only="swipe">Disposición' +
        '          <select class="cmpv-select" data-role="swipe-layout">' +
        '            <option value="1x1">Izq | Der</option>' +
        '            <option value="2x1">Izq | Der ÷ 2</option>' +
        '            <option value="1x2">Izq ÷ 2 | Der</option>' +
        '            <option value="2x2">Izq ÷ 2 | Der ÷ 2</option>' +
        '          </select></label>' +
        '        <div class="cmpv-field cmpv-field--grid" data-only="mirror">' +
        '          <span class="cmpv-grid__title">Disposición (espejo)</span>' +
        '          <label class="cmpv-grid-type">Tipo' +
        '            <select class="cmpv-select" data-role="layout-type">' +
        '              <option value="grid">Filas × columnas</option>' +
        '              <option value="custom">Grid (irregular)</option>' +
        '            </select>' +
        '          </label>' +
        '          <div class="cmpv-grid-inputs" data-role="grid-inputs">' +
        '            <label>Filas <input type="number" class="cmpv-num" data-role="rows" min="1" max="6" value="1"></label>' +
        '            <label>Columnas <input type="number" class="cmpv-num" data-role="cols" min="1" max="6" value="2"></label>' +
        '          </div>' +
        '          <div class="cmpv-custom" data-role="custom-inputs" style="display:none">' +
        '            <div class="cmpv-custom__hint">Define cada fila y cuántas celdas (vistas) tiene. Cada fila reparte su ancho entre sus celdas.</div>' +
        '            <div class="cmpv-custom__rows" data-role="custom-rows"></div>' +
        '            <button type="button" class="cmpv-custom__add" data-role="add-row">➕ Añadir fila</button>' +
        '          </div>' +
        '        </div>' +
        '        <div class="cmpv-field cmpv-field--grid" data-only="molde">' +
        '          <div class="cmpv-moldbar">' +
        '            <span class="cmpv-grid__title">Moldes</span>' +
        '            <div class="cmpv-moldbar__row">' +
        '              <select class="cmpv-select cmpv-moldbar__sel" data-role="mold-select" title="Molde activo"></select>' +
        '              <button type="button" class="cmpv-moldbar__btn" data-role="mold-add" title="Añadir molde">➕</button>' +
        '            </div>' +
        '            <button type="button" class="cmpv-moldbar__btn cmpv-moldbar__del" data-role="mold-del" title="Eliminar el molde activo">🗑 Eliminar molde</button>' +
        '          </div>' +
        '          <span class="cmpv-grid__title">Figura del molde</span>' +
        '          <label class="cmpv-field">Figura' +
        '            <select class="cmpv-select" data-role="mold-shape">' +
        '              <option value="circle">Círculo</option>' +
        '              <option value="ellipse">Elipse</option>' +
        '              <option value="rect">Rectángulo</option>' +
        '              <option value="triangle">Triángulo</option>' +
        '              <option value="diamond">Rombo</option>' +
        '              <option value="pentagon">Pentágono</option>' +
        '              <option value="hexagon">Hexágono</option>' +
        '              <option value="octagon">Octágono</option>' +
        '              <option value="star">Estrella</option>' +
        '              <option value="heart">Corazón</option>' +
        '              <option value="duck">Patito de goma</option>' +
        '            </select>' +
        '          </label>' +
        '          <div class="cmpv-grid-inputs">' +
        '            <label>Tamaño <input type="range" class="cmpv-range" data-role="mold-size" min="8" max="60" value="25"> <span data-role="mold-size-val">25</span>%</label>' +
        '            <label>Giro <input type="range" class="cmpv-range" data-role="mold-angle" min="0" max="360" value="0"> <span data-role="mold-angle-val">0</span>°</label>' +
        '          </div>' +
        '        </div>' +
        '        <div class="cmpv-slots__hint">Elige qué vista se muestra en cada mapa.</div>' +
        '        <div class="cmpv-slots" data-role="slots"></div>' +
        '      </div>' +
        '    </div>' +
        // ── Acordeón: Gestión de vistas ──
        '    <div class="cmpv-accordion" data-role="acc-vistas">' +
        '      <div class="cmpv-accordion__header" role="button" tabindex="0" aria-expanded="true">' +
        '        <span class="cmpv-sidenav__subtitle cmpv-accordion__title">Gestión de vistas</span>' +
        '        <span class="cmpv-accordion__chevron">▸</span>' +
        '      </div>' +
        '      <div class="cmpv-accordion__body">' +
        '        <table class="cmpv-table">' +
        '          <thead><tr><th>Vista</th><th>Modo</th><th></th><th></th></tr></thead>' +
        '          <tbody data-role="lista"></tbody></table>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      root.querySelectorAll(".cmpv-tool").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var act = btn.getAttribute("data-act");
          if (act === "crear") self.crearVista();
          else if (act === "cortinilla") self.setMode("swipe");
          else if (act === "espejo") self.setMode("mirror");
          else if (act === "single") self.setMode("single");
          else if (act === "molde") self.setMode("molde");
          else if (act === "opciones") self.toggleOpciones();
        });
      });
      root.querySelector('[data-role="close-cfg"]').addEventListener("click", function () { self.toggleOpciones(false); });
      var syncModeField = root.querySelector('[data-role="sync-mode-field"]');
      var syncModeSel = root.querySelector('[data-role="sync-mode"]');
      root.querySelector('[data-role="sync"]').addEventListener("change", function () {
        self.sync = this.checked;
        if (syncModeField) syncModeField.style.display = self.sync ? "" : "none";
        if (self.sync) self._resyncFromActive();
      });
      if (syncModeSel) syncModeSel.addEventListener("change", function () {
        self.syncMode = this.value;
        if (self.sync) self._resyncFromActive();
      });
      root.querySelector('[data-role="controls"]').addEventListener("change", function () {
        self.showControls = this.checked; self._broadcastControls();
      });

      // --- Disposición de la cortinilla: selector de layout ---
      var swipeLayoutSel = root.querySelector('[data-role="swipe-layout"]');
      if (swipeLayoutSel) swipeLayoutSel.addEventListener("change", function () {
        self.swipe.layout = this.value;
        if (self.mode === "swipe") {
          self._initSwipeSlots();
          self._relayout();
          self._refreshUI();
        }
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

      // --- Controles de apariencia de divisores ---
      var applyStyle = function () { self._applyDivisorStyle(); };
      var divVisibleCb = root.querySelector('[data-role="div-visible"]');
      var divColorIn = root.querySelector('[data-role="div-color"]');
      var divWidthIn = root.querySelector('[data-role="div-width"]');
      var divWidthVal = root.querySelector('[data-role="div-width-val"]');
      var handleColorIn = root.querySelector('[data-role="handle-color"]');
      var handleSizeIn = root.querySelector('[data-role="handle-size"]');
      var handleSizeVal = root.querySelector('[data-role="handle-size-val"]');

      if (divVisibleCb) divVisibleCb.addEventListener("change", function () {
        self._divStyle.visible = this.checked; applyStyle();
      });
      if (divColorIn) divColorIn.addEventListener("input", function () {
        self._divStyle.color = this.value; applyStyle();
      });
      if (divWidthIn) divWidthIn.addEventListener("input", function () {
        self._divStyle.width = parseInt(this.value, 10); if (divWidthVal) divWidthVal.textContent = this.value; applyStyle();
      });
      if (handleColorIn) handleColorIn.addEventListener("input", function () {
        self._divStyle.handleColor = this.value; applyStyle();
      });
      if (handleSizeIn) handleSizeIn.addEventListener("input", function () {
        self._divStyle.handleSize = parseInt(this.value, 10); if (handleSizeVal) handleSizeVal.textContent = this.value; applyStyle();
      });

      // --- Controles de la figura del molde ACTIVO ---
      var moldShapeSel = root.querySelector('[data-role="mold-shape"]');
      var moldSizeIn = root.querySelector('[data-role="mold-size"]');
      var moldSizeVal = root.querySelector('[data-role="mold-size-val"]');
      var moldAngleIn = root.querySelector('[data-role="mold-angle"]');
      var moldAngleVal = root.querySelector('[data-role="mold-angle-val"]');

      if (moldShapeSel) moldShapeSel.addEventListener("change", function () {
        var m = self._curMold();
        if (!m) return;
        m.shape = this.value;
        if (self.mode === "molde") self._applyMoldGeometry(m);
      });
      if (moldSizeIn) moldSizeIn.addEventListener("input", function () {
        var m = self._curMold();
        if (!m) return;
        m.radius = parseInt(this.value, 10);
        if (moldSizeVal) moldSizeVal.textContent = this.value;
        if (self.mode === "molde") self._applyMoldGeometry(m);
      });
      if (moldAngleIn) moldAngleIn.addEventListener("input", function () {
        var m = self._curMold();
        if (!m) return;
        m.angle = parseInt(this.value, 10);
        if (moldAngleVal) moldAngleVal.textContent = this.value;
        if (self.mode === "molde") self._applyMoldGeometry(m);
      });

      // --- Moldbar: selector de molde activo / añadir / quitar ---
      var moldSelEl = root.querySelector('[data-role="mold-select"]');
      var moldAddBtn = root.querySelector('[data-role="mold-add"]');
      var moldDelBtn = root.querySelector('[data-role="mold-del"]');
      if (moldSelEl) moldSelEl.addEventListener("change", function () { self._selectMold(this.value); });
      if (moldAddBtn) moldAddBtn.addEventListener("click", function () { self._addMold(); });
      if (moldDelBtn) moldDelBtn.addEventListener("click", function () { self._removeMold(self._curMold()); });

      // --- Toggle de todos los acordeones ---
      root.querySelectorAll(".cmpv-accordion").forEach(function (acc) {
        var hdr = acc.querySelector(".cmpv-accordion__header");
        if (!hdr) return;
        var toggle = function () {
          var collapsed = acc.classList.toggle("cmpv-accordion--collapsed");
          hdr.setAttribute("aria-expanded", String(!collapsed));
        };
        hdr.addEventListener("click", toggle);
        hdr.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        });
      });

      return root;
    }

    _refreshUI() {
      if (!this.ui) return;
      var self = this;
      this.ui.querySelectorAll(".cmpv-tool[data-act]").forEach(function (btn) {
        var act = btn.getAttribute("data-act");
        var on = (act === "single" && self.mode === "single")
          || (act === "cortinilla" && self.mode === "swipe")
          || (act === "espejo" && self.mode === "mirror")
          || (act === "molde" && self.mode === "molde");
        btn.classList.toggle("cmpv-tool--active", on);
      });
      this.ui.querySelectorAll("[data-only]").forEach(function (el) {
        el.style.display = (el.getAttribute("data-only") === self.mode) ? "" : "none";
      });
      this._renderSlotsComparacion();
      this._renderListaVistas();
      this._renderMoldSelect();
      if (self.mode === "molde") this._selectMold(this.moldSelId);
    }

    toggleOpciones(force) {
      var nav = this.ui.querySelector('[data-role="sidenav"]');
      if (!nav) return;
      var open = (typeof force === "boolean") ? force : !nav.classList.contains("cmpv-sidenav--open");
      nav.classList.toggle("cmpv-sidenav--open", open);
      var cfgBtn = this.ui.querySelector('.cmpv-tool--cfg');
      if (cfgBtn) cfgBtn.classList.toggle("cmpv-tool--active", open);
    }

    // =====================================================================
    //  Slots de comparación
    //  --------------------------------------------------------------------
    //  Un "slot" es una posición ESTABLE de la comparación (un mapa concreto
    //  que se está comparando): un lado del divisor en cortinilla, o una celda
    //  del grid en espejo. La vista que ocupa el slot es intercambiable.
    //
    //  _getSlots() devuelve la lista ORDENADA de slots del modo actual, cada
    //  uno con { label, viewId, set(newViewId) }. El setter muta la estructura
    //  interna correspondiente (this.swipe / this.grid) y re-aplica el layout.
    // =====================================================================
    _getSlots() {
      var self = this;
      var slots = [];
      if (this.mode === "swipe") {
        // Slots de la cortinilla: array plano de viewIds.
        var labels = { "1x1": ["Izquierda", "Derecha"],
          "2x1": ["Izquierda", "Derecha (arriba)", "Derecha (abajo)"],
          "1x2": ["Izquierda (arriba)", "Izquierda (abajo)", "Derecha"],
          "2x2": ["Izq. arriba", "Izq. abajo", "Der. arriba", "Der. abajo"] };
        var lbls = labels[self.swipe.layout] || labels["1x1"];
        (this.swipe.slots || []).forEach(function (viewId, i) {
          slots.push({
            label: lbls[i] || ("Mapa " + (i + 1)),
            viewId: viewId,
            _idx: i,
            set: function (newViewId) {
              self.swipe.slots[i] = newViewId;
              self._layoutSwipe();
              self._resyncFromActive();
            },
          });
        });
      } else if (this.mode === "mirror") {
        var n = 0;
        (this.grid || []).forEach(function (row, ri) {
          row.forEach(function (viewId, ci) {
            n += 1;
            slots.push({
              label: "Mapa " + n,
              viewId: viewId,
              _ri: ri, _ci: ci,
              set: function (newViewId) {
                self.grid[ri][ci] = newViewId;
                self._layoutMirror();
                self._resyncFromActive();
              },
            });
          });
        });
      } else if (this.mode === "molde") {
        // Base (compartida, se ve fuera de las figuras) + un slot por molde.
        slots.push({
          label: "Base (abajo)",
          viewId: this.moldBaseId,
          set: function (newViewId) {
            self.moldBaseId = newViewId;
            self._layoutMold();
            self._resyncFromActive();
          },
        });
        this.molds.forEach(function (m, i) {
          slots.push({
            label: "Molde " + (i + 1) + " (arriba)",
            viewId: m.topId,
            set: function (newViewId) {
              m.topId = newViewId;
              self._layoutMold();
              self._resyncFromActive();
            },
          });
        });
      } else {
        // single: un único slot = la vista activa.
        slots.push({
          label: "Mapa 1",
          viewId: this.activeViewId || (this.views[0] && this.views[0].id),
          set: function (viewId) {
            self.activeViewId = viewId;
            self._layoutSingle();
            self._resyncFromActive();
          },
        });
      }
      return slots;
    }

    // Pinta la sección "Mapas de comparación": una fila por slot con un
    // selector de qué vista mostrar. Visible en cortinilla/espejo/molde.
    _renderSlotsComparacion() {
      var self = this;
      var cont = this.ui.querySelector('[data-role="slots"]');
      if (!cont) return;

      var show = (this.mode === "swipe" || this.mode === "mirror" || this.mode === "molde");
      if (!show) { cont.innerHTML = ""; return; }

      var slots = this._getSlots();
      cont.innerHTML = "";
      slots.forEach(function (slot) {
        var row = document.createElement("div");
        row.className = "cmpv-slot";

        var lbl = document.createElement("span");
        lbl.className = "cmpv-slot__lbl";
        lbl.textContent = slot.label;

        var sel = document.createElement("select");
        sel.className = "cmpv-select cmpv-slot__select";
        self.views.forEach(function (v) {
          var opt = document.createElement("option");
          opt.value = v.id;
          opt.textContent = v.name + (v.impl === "cesium" ? " (3D)" : " (2D)");
          if (v.id === slot.viewId) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", function () {
          slot.set(this.value);
          self._refreshUI();
        });

        row.appendChild(lbl);
        row.appendChild(sel);
        cont.appendChild(row);
      });
    }

    _renderListaVistas() {
      var self = this;
      var lista = this.ui.querySelector('[data-role="lista"]');
      if (!lista) return;

      // La columna ojo (seleccionar vista activa) sólo aparece en modo "ver".
      var showEye = (this.mode === "single");

      // Actualiza la cabecera de la tabla según el modo.
      var thead = lista.closest("table").querySelector("thead tr");
      if (thead) {
        thead.innerHTML = "<th>Vista</th><th>Modo</th>" +
          (showEye ? "<th></th>" : "") +
          "<th></th>";
      }

      lista.innerHTML = "";
      this.views.forEach(function (v) {
        var row = document.createElement("tr");

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

        // Botón ojo: selecciona esta vista como activa (solo modo "ver").
        if (showEye) {
          var tdEye = document.createElement("td");
          var eye = document.createElement("button");
          eye.type = "button";
          eye.className = "cmpv-eye" + (v.id === self.activeViewId ? " cmpv-eye--active" : "");
          eye.textContent = "👁";
          eye.title = "Mostrar esta vista";
          eye.addEventListener("click", function () { self.verVista(v.id); });
          tdEye.appendChild(eye);
          row.appendChild(tdEye);
        }

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
      // El encuadre se toma de la vista activa (o la primera) para no descuadrar.
      var ref = this.getView(this.activeViewId) || this.views[0];
      var cz = this._centerZoomFromState(ref && ref.lastView);
      // Las vistas creadas SIEMPRE clonan la config e implementación de la vista
      // PRINCIPAL (isPrimary): capas, plugins, controles y motor 2D/3D.
      var primary = this._getPrimaryView();
      var clonedConfig = primary && primary.config
        ? this._cloneConfig(primary.config)
        : { layers: [], plugins: [], controls: [] };
      var impl = opts.impl || (primary ? primary.impl : "ol");
      var view = this._makeView({
        name: opts.name || ("Vista " + (this.views.length + 1)),
        impl: impl,
        lon: cz.lon, lat: cz.lat, zoom: cz.zoom,
        config: clonedConfig,
      });
      // Hereda el encuadre de la referencia (extent) para sincronizar al estar listo.
      if (ref && ref.lastView) view.lastView = ref.lastView;
      this._refreshUI();
      this._relayout();
      return view;
    }

    // Copia profunda (JSON) de una config de vista serializable.
    _cloneConfig(cfg) {
      try { return JSON.parse(JSON.stringify(cfg)); }
      catch (e) { return { layers: [], plugins: [], controls: [] }; }
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
      if (this.mode === "swipe") this._initSwipeSlots();
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
      // Regenera el documento del iframe con la nueva implementación y el encuadre
      // preservado. El nuevo documento emitirá cmpv:ready y el padre le reenviará
      // config + encuadre + estado de controles automáticamente.
      this._setIframeDoc(v, newImpl, cz.lon, cz.lat, cz.zoom);
      this._refreshUI();
    }

    // Reescribe el documento del iframe de una vista (para cambiar 2D<->3D).
    // Recreamos el iframe para partir de un about:blank limpio (evita restos del
    // motor anterior en el mismo documento).
    _setIframeDoc(v, impl, lon, lat, zoom) {
      var old = v.iframe;
      var iframe = document.createElement("iframe");
      iframe.className = "cmpv-iframe";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allow", "fullscreen");
      if (old && old.parentNode) old.parentNode.replaceChild(iframe, old);
      else if (v.div) v.div.appendChild(iframe);
      v.iframe = iframe;
      this._writeIframeDoc(iframe, v.id, impl, lon, lat, zoom);
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
      if (mode === "swipe") {
        this._initSwipeSlots();
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
      if (mode === "molde") {
        // Necesita al menos 2 vistas: base (abajo) y una por molde (arriba).
        if (this.views.length < 2) this.crearVista();
        if (!this.getView(this.moldBaseId)) this.moldBaseId = this.views[0].id;
        var self = this;
        this.molds.forEach(function (m) {
          if (!self.getView(m.topId)) m.topId = self._nextMoldTopId();
        });
        if (!this.getMold(this.moldSelId)) this.moldSelId = this.molds[0].id;
      }
      this.mode = mode;
      this._relayout();
      this._refreshUI();
    }

    // Nº de vistas del layout actual.
    _swipeSlotCount() {
      var l = this.swipe.layout;
      if (l === "2x2") return 4;
      if (l === "2x1" || l === "1x2") return 3;
      return 2; // "1x1"
    }

    // Inicializa los slots de la cortinilla según el layout.
    // Crea las vistas que falten y rellena swipe.slots.
    _initSwipeSlots() {
      var total = this._swipeSlotCount();
      while (this.views.length < total) this.crearVista();
      // Reutiliza los slots existentes si son válidos; completa con vistas nuevas.
      var ids = this.views.map(function (v) { return v.id; });
      var slots = (this.swipe.slots || []).filter(function (id) { return ids.indexOf(id) !== -1; });
      var idx = 0;
      while (slots.length < total) {
        if (slots.indexOf(ids[idx]) === -1) slots.push(ids[idx]);
        idx += 1;
        if (idx >= ids.length) break;
      }
      this.swipe.slots = slots.slice(0, total);
    }

    _relayout() {
      if (this.mode === "single") this._layoutSingle();
      else if (this.mode === "swipe") this._layoutSwipe();
      else if (this.mode === "mirror") this._layoutMirror();
      else if (this.mode === "molde") this._layoutMold();
      // Tras mostrar/ocultar vistas, forzar que sus mapas recalcule el viewport
      // (OpenLayers updateSize / Cesium resize). Sin esto, un mapa que estaba
      // oculto (display:none) no pinta hasta que el usuario lo mueve.
      var self = this;
      setTimeout(function () { self._broadcastUpdateSize(); }, 50);
      // Tras dimensionar, reenvía el encuadre de la activa al resto. Con varios
      // reintentos escalonados porque las vistas nuevas/ocultas o las 3D (Cesium)
      // pueden tardar en estar listas; así no hace falta mover el mapa para que
      // se sincronicen. Cada vista, además, se realinea al emitir cmpv:ready.
      this._scheduleResync();
    }

    // Reenvía el encuadre de la vista activa al resto varias veces (0/150/500/
    // 1200/2500 ms). Cubre la ventana en la que las vistas terminan de cargar.
    _scheduleResync() {
      var self = this;
      if (this._resyncTimers) this._resyncTimers.forEach(function (t) { clearTimeout(t); });
      this._resyncTimers = [0, 150, 500, 1200, 2500].map(function (ms) {
        return setTimeout(function () { self._resyncFromActive(); }, ms);
      });
    }

    // Deja el stage en modo posicionamiento ABSOLUTO (single/swipe) y limpia
    // cualquier estilo de CSS Grid, tanto del stage como de las vistas.
    _resetViewDivs() {
      var stage = this._workArea;
      if (stage) {
        stage.style.display = "";           // vuelve a block (posición absoluta)
        stage.style.gridTemplateColumns = "";
        stage.style.gridTemplateRows = "";
        stage.style.gap = "";
        stage.style.background = "";
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
      this._removeDivisors();
      this._removeMolds();
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
      var self = this;
      var slots = this.swipe.slots || [];
      if (!slots.length) return;

      // Todas las vistas ocupan TODA la pantalla (absolute, inset:0).
      // Se recortan con clip-path según la posición de los divisores.
      slots.forEach(function (viewId) {
        var v = self.getView(viewId);
        if (!v || !v.div) return;
        v.div.style.display = "";
        v.div.style.zIndex = "2";
        v.div.classList.add("cmpv-view--overlay");
      });

      this._applySwipeClip();
      this._buildDivisors();
    }

    // Calcula el clip-path de cada slot de la cortinilla.
    // Todas las vistas ocupan inset:0 (pantalla completa) y se recortan.
    //
    // Modelo de árbol:
    //   "1x1" slots: [izq, der]
    //        izq  → inset(0  R%  0  0)     con R = 100-posV*100
    //        der  → inset(0  0   0  L%)    con L = posV*100
    //   "2x1" slots: [izq, der-arr, der-abj]
    //        izq      → inset(0  R%  0  0)
    //        der-arr  → inset(0  0   B%  L%)   con B = 100-posHR*100
    //        der-abj  → inset(T%  0  0   L%)   con T = posHR*100
    //   "1x2" slots: [izq-arr, izq-abj, der]
    //        izq-arr  → inset(0  R%  B%  0)    con B = 100-posHL*100
    //        izq-abj  → inset(T%  R%  0  0)    con T = posHL*100
    //        der      → inset(0  0   0  L%)
    //   "2x2" slots: [izq-arr, izq-abj, der-arr, der-abj]
    //        izq-arr  → inset(0     R%  B_L%  0)
    //        izq-abj  → inset(T_L%  R%  0     0)
    //        der-arr  → inset(0     0   B_R%  L%)
    //        der-abj  → inset(T_R%  0   0     L%)
    _applySwipeClip() {
      var self = this;
      var slots = this.swipe.slots || [];
      var lay = this.swipe.layout;
      var V = this.swipe.posV * 100;       // % del divisor vertical
      var HL = this.swipe.posHL * 100;     // % del divisor horizontal izquierdo
      var HR = this.swipe.posHR * 100;     // % del divisor horizontal derecho
      var L = V, R = 100 - V;             // left% y right-inset%

      // Calcula los límites (top%, right%, bottom%, left%) de cada slot.
      var rects = [];
      if (lay === "1x1") {
        rects = [
          [0, R, 0, 0],          // izq
          [0, 0, 0, L],          // der
        ];
      } else if (lay === "2x1") {
        rects = [
          [0, R, 0, 0],          // izq
          [0, 0, 100 - HR, L],   // der-arr
          [HR, 0, 0, L],         // der-abj
        ];
      } else if (lay === "1x2") {
        rects = [
          [0, R, 100 - HL, 0],   // izq-arr
          [HL, R, 0, 0],         // izq-abj
          [0, 0, 0, L],          // der
        ];
      } else if (lay === "2x2") {
        rects = [
          [0, R, 100 - HL, 0],   // izq-arr
          [HL, R, 0, 0],         // izq-abj
          [0, 0, 100 - HR, L],   // der-arr
          [HR, 0, 0, L],         // der-abj
        ];
      }

      rects.forEach(function (r, i) {
        var v = self.getView(slots[i]);
        if (!v || !v.div) return;
        var clip = "inset(" +
          r[0].toFixed(2) + "% " + r[1].toFixed(2) + "% " +
          r[2].toFixed(2) + "% " + r[3].toFixed(2) + "%)";
        v.div.style.clipPath = clip;
        v.div.style.webkitClipPath = clip;
      });

      this._positionDivisors();
    }

    // Crea los divisores arrastrables de la cortinilla:
    //  - Siempre 1 divisor VERTICAL que cruza toda la pantalla (posV).
    //  - Si el lado izquierdo está dividido ("1x2"|"2x2"): 1 divisor
    //    HORIZONTAL en la mitad izquierda (posHL), de 0 a posV.
    //  - Si el lado derecho está dividido ("2x1"|"2x2"): 1 divisor
    //    HORIZONTAL en la mitad derecha (posHR), de posV a 100%.
    _buildDivisors() {
      this._removeDivisors();
      var self = this;
      this._divisors = [];
      this._divisorCleanups = [];
      var lay = this.swipe.layout;

      function addDrag(div, onMove, stopProp) {
        var dragging = false;
        var start = function (e) { dragging = true; e.preventDefault(); if (stopProp) e.stopPropagation(); self._setIframePointerEvents(false); };
        var end = function () { if (dragging) { dragging = false; self._setIframePointerEvents(true); } };
        var move = function (e) {
          if (!dragging) return;
          var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
          onMove(p.clientX, p.clientY);
        };
        div.addEventListener("mousedown", start);
        div.addEventListener("touchstart", start, { passive: false });
        window.addEventListener("mousemove", move);
        window.addEventListener("touchmove", move, { passive: false });
        window.addEventListener("mouseup", end);
        window.addEventListener("touchend", end);
        self._divisorCleanups.push(function () {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("touchmove", move);
          window.removeEventListener("mouseup", end);
          window.removeEventListener("touchend", end);
        });
      }

      function makeDivisor(cls, axis) {
        var div = document.createElement("div");
        div.className = "cmpv-divisor " + cls;
        div.setAttribute("data-axis", axis);
        var handle = document.createElement("div");
        handle.className = "cmpv-divisor__handle";
        div.appendChild(handle);
        self._workArea.appendChild(div);
        self._divisors.push(div);
        return div;
      }

      // Divisor vertical (siempre): cruza toda la pantalla.
      // - Arrastrar la BARRA → solo mueve X (posV).
      // - Arrastrar el HANDLE (círculo naranja) → mueve X+Y (omnidireccional).
      var divV = makeDivisor("cmpv-divisor--vertical", "v");
      var handleV = divV.querySelector(".cmpv-divisor__handle");

      // Drag de la barra (solo X).
      addDrag(divV, function (x) {
        var rect = self._workArea.getBoundingClientRect();
        self.swipe.posV = Math.max(0.05, Math.min(0.95, (x - rect.left) / rect.width));
        self._applySwipeClip();
      });

      // Drag del handle (X + Y) — solo si hay horizontales.
      if (handleV && lay !== "1x1") {
        handleV.style.cursor = "move";
        addDrag(handleV, function (x, y) {
          var rect = self._workArea.getBoundingClientRect();
          var clamp = function (v) { return Math.max(0.05, Math.min(0.95, v)); };
          self.swipe.posV = clamp((x - rect.left) / rect.width);
          var posY = clamp((y - rect.top) / rect.height);
          if (lay === "1x2" || lay === "2x2") self.swipe.posHL = posY;
          if (lay === "2x1" || lay === "2x2") self.swipe.posHR = posY;
          self._applySwipeClip();
        }, true);
      }

      // Divisores horizontales: se crean para la línea visual, pero SIN
      // tirador propio — el arrastre se hace desde el tirador del vertical.
      // Siguen siendo arrastrables individualmente en Y como alternativa.
      if (lay === "1x2" || lay === "2x2") {
        var divHL = makeDivisor("cmpv-divisor--horizontal", "hl");
        addDrag(divHL, function (x, y) {
          var rect = self._workArea.getBoundingClientRect();
          self.swipe.posHL = Math.max(0.05, Math.min(0.95, (y - rect.top) / rect.height));
          self._applySwipeClip();
        });
      }

      if (lay === "2x1" || lay === "2x2") {
        var divHR = makeDivisor("cmpv-divisor--horizontal", "hr");
        addDrag(divHR, function (x, y) {
          var rect = self._workArea.getBoundingClientRect();
          self.swipe.posHR = Math.max(0.05, Math.min(0.95, (y - rect.top) / rect.height));
          self._applySwipeClip();
        });
      }

      this._positionDivisors();
      this._applyDivisorStyle();
    }

    // Posiciona los divisores visuales y sus tiradores (handles) en la
    // intersección entre el divisor vertical y los horizontales.
    _positionDivisors() {
      if (!this._divisors) return;
      var self = this;
      var lay = this.swipe.layout;
      var pV = this.swipe.posV;
      var pHL = this.swipe.posHL;
      var pHR = this.swipe.posHR;

      // Posición Y del handle del divisor vertical: en la intersección.
      var handleY;
      if (lay === "2x2") handleY = ((pHL + pHR) / 2 * 100).toFixed(2) + "%";
      else if (lay === "1x2") handleY = (pHL * 100).toFixed(2) + "%";
      else if (lay === "2x1") handleY = (pHR * 100).toFixed(2) + "%";
      else handleY = "50%";

      this._divisors.forEach(function (div) {
        var axis = div.getAttribute("data-axis");
        var handle = div.querySelector(".cmpv-divisor__handle");
        if (axis === "v") {
          div.style.left = (pV * 100).toFixed(2) + "%";
          div.style.top = "0";
          div.style.width = "";
          div.style.height = "100%";
          // Tirador en la intersección con los horizontales.
          if (handle) handle.style.top = handleY;
        } else if (axis === "hl") {
          div.style.top = (pHL * 100).toFixed(2) + "%";
          div.style.left = "0";
          div.style.width = (pV * 100).toFixed(2) + "%";
          // Tirador en el extremo derecho (donde toca el vertical).
          if (handle) { handle.style.left = "100%"; handle.style.display = "none"; }
        } else if (axis === "hr") {
          div.style.top = (pHR * 100).toFixed(2) + "%";
          div.style.left = (pV * 100).toFixed(2) + "%";
          div.style.width = ((1 - pV) * 100).toFixed(2) + "%";
          // Tirador en el extremo izquierdo (donde toca el vertical).
          if (handle) { handle.style.left = "0%"; handle.style.display = "none"; }
        }
      });
    }

    // Durante el arrastre del divisor, desactiva los eventos de puntero de los
    // iframes para que el ratón no lo capture el mapa de dentro.
    _setIframePointerEvents(on) {
      this.views.forEach(function (v) {
        if (v.iframe) v.iframe.style.pointerEvents = on ? "" : "none";
      });
    }

    // Aplica el estilo visual (color, ancho, visibilidad, tirador) a todos
    // los divisores existentes en el DOM y al gap del grid espejo.
    _applyDivisorStyle() {
      var s = this._divStyle;
      // --- Divisores de la cortinilla ---
      if (this._divisors) this._divisors.forEach(function (div) {
        var axis = div.getAttribute("data-axis");
        var isV = (axis === "v");
        // Barra: color, ancho, visibilidad.
        div.style.background = s.visible ? s.color : "transparent";
        div.style.boxShadow = s.visible ? "0 0 4px rgba(0,0,0,0.5)" : "none";
        if (isV) { div.style.width = s.width + "px"; div.style.transform = "translateX(-" + (s.width / 2) + "px)"; }
        else { div.style.height = s.width + "px"; div.style.transform = "translateY(-" + (s.width / 2) + "px)"; }
        // Tirador (handle): oculto si las barras no son visibles.
        var handle = div.querySelector(".cmpv-divisor__handle");
        if (handle) {
          handle.style.background = s.handleColor;
          handle.style.width = s.handleSize + "px";
          handle.style.height = s.handleSize + "px";
          if (handle.style.display !== "none") {
            handle.style.visibility = s.visible ? "" : "hidden";
          }
        }
      });
      // --- Grid espejo: gap + background del stage ---
      var stage = this._workArea;
      if (stage && this.mode === "mirror") {
        var gap = s.visible ? s.width + "px" : "0";
        stage.style.gap = gap;
        stage.style.background = s.visible ? s.color : "";
      }
      // --- Molde(s): contorno (barra) + tirador (solo el activo lo muestra) ---
      if (this.mode === "molde") {
        var self = this;
        this.molds.forEach(function (m) {
          if (!m.vis) return;
          m.vis.style.stroke = s.visible ? s.color : "transparent";
          m.vis.style.strokeWidth = s.visible ? s.width + "px" : "0px";
          // Zona de agarre: siempre algo más ancha que el trazo visible.
          m.hit.style.strokeWidth = (s.width + 14) + "px";
          m.hit.style.display = s.visible ? "" : "none";
          if (m.handle) {
            m.handle.style.fill = s.handleColor;
            m.handle.style.stroke = s.visible ? "#fff" : "transparent";
            var hs = s.handleSize;
            m.handle.setAttribute("r", (hs / 2) + "px");
          }
        });
      }
    }

    _removeDivisors() {
      if (this._divisorCleanups) {
        this._divisorCleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
        this._divisorCleanups = [];
      }
      if (this._divisors) {
        this._divisors.forEach(function (d) { if (d && d.parentNode) d.parentNode.removeChild(d); });
        this._divisors = [];
      }
    }

    // =====================================================================
    //  MODO MOLDE
    //  --------------------------------------------------------------------
    //  Vistas superpuestas: la INFERIOR (base) se ve a través de las FIGURAS
    //  (SVG clip-path) que recortan a las SUPERIORES (moldes). Cada molde
    //  recorta SU PROPIA vista superior con SU figura; todos comparten la
    //  misma base. El contorno de la figura es arrastrable (mover) y un
    //  tirador en su esquina inferior-derecha la escala y rota.
    // =====================================================================

    getMold(id) {
      var found = null;
      this.molds.forEach(function (m) { if (m.id === id) found = m; });
      return found;
    }

    // Molde activo: el que controlan el panel y el tirador visible.
    _curMold() {
      return this.getMold(this.moldSelId) || this.molds[0];
    }

    // Vista libre para un molde nuevo: distinta de la base y de los topId en
    // uso; crea una vista nueva si todas están ocupadas.
    _nextMoldTopId() {
      var used = {};
      if (this.moldBaseId) used[this.moldBaseId] = true;
      var self = this;
      this.molds.forEach(function (m) { if (m.topId) used[m.topId] = true; });
      var free = null;
      this.views.forEach(function (v) { if (!used[v.id] && !free) free = v.id; });
      if (!free) { this.crearVista(); free = this.views[this.views.length - 1].id; }
      return free;
    }

    // Selecciona un molde: sincroniza el selector del panel, los sliders de
    // forma/tamaño/giro y el tirador visible en el stage.
    _selectMold(id) {
      var m = this.getMold(id);
      if (!m) return;
      this.moldSelId = m.id;
      if (!this.ui) return;
      var selEl = this.ui.querySelector('[data-role="mold-select"]');
      if (selEl) selEl.value = m.id;
      var shapeSel = this.ui.querySelector('[data-role="mold-shape"]');
      if (shapeSel) shapeSel.value = m.shape;
      var sizeIn = this.ui.querySelector('[data-role="mold-size"]');
      if (sizeIn) sizeIn.value = m.radius;
      var sizeVal = this.ui.querySelector('[data-role="mold-size-val"]');
      if (sizeVal) sizeVal.textContent = m.radius;
      var angIn = this.ui.querySelector('[data-role="mold-angle"]');
      if (angIn) angIn.value = m.angle;
      var angVal = this.ui.querySelector('[data-role="mold-angle-val"]');
      if (angVal) angVal.textContent = m.angle;
      this._updateMoldSelection();
    }

    // Resalta el molde activo: el tirador solo se muestra en él (los demás
    // moldes conservan su contorno arrastrable; arrastrar también selecciona).
    _updateMoldSelection() {
      var self = this;
      this.molds.forEach(function (m) {
        var sel = (m.id === self.moldSelId);
        if (m.svg) m.svg.classList.toggle("cmpv-mold--sel", sel);
        if (m.handle) m.handle.style.display = sel ? "" : "none";
      });
    }

    // Puebla el selector de moldes del panel (y el estado del botón quitar).
    _renderMoldSelect() {
      var selEl = this.ui && this.ui.querySelector('[data-role="mold-select"]');
      if (!selEl) return;
      selEl.innerHTML = "";
      var self = this;
      this.molds.forEach(function (m, i) {
        var opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = "Molde " + (i + 1);
        selEl.appendChild(opt);
      });
      selEl.value = (this.getMold(this.moldSelId) ? this.moldSelId : this.molds[0].id);
      var delBtn = this.ui.querySelector('[data-role="mold-del"]');
      if (delBtn) delBtn.disabled = (this.molds.length <= 1);
    }

    // Añade un molde nuevo (con una vista libre para recortar) y lo activa.
    _addMold() {
      this._moldSeq += 1;
      var m = {
        id: "m" + this._moldSeq,
        shape: "circle",
        topId: this._nextMoldTopId(),
        cx: 50,
        cy: 50,
        radius: 25,
        angle: 0,
      };
      this.molds.push(m);
      this.moldSelId = m.id;
      if (this.mode === "molde") {
        this._layoutMold();
        this._refreshUI();
      }
      this._selectMold(m.id);
    }

    // Datos de la figura en espacio normalizado (centro 0,0, radio ~100):
    // { d: path-data, maxX, maxY, gx, gy } — maxX/maxY = extensión del bbox;
    // (gx,gy) = punto SOBRE el contorno donde se coloca el tirador (esquina
    // inferior-derecha de la propia figura, no del bbox).
    _moldPathData(shape) {
      var R = 105;
      function poly(n, r, startDeg, innerR) {
        var pts = [];
        for (var i = 0; i < n; i++) {
          var a = (startDeg + i * 360 / n) * Math.PI / 180;
          var rr = (innerR && (i % 2 === 1)) ? innerR : r;
          pts.push(rr * Math.cos(a), rr * Math.sin(a));
        }
        return pts;
      }
      function toD(pts) {
        var s = "M " + pts[0].toFixed(2) + " " + pts[1].toFixed(2);
        for (var i = 2; i < pts.length; i += 2) s += " L " + pts[i].toFixed(2) + " " + pts[i + 1].toFixed(2);
        return s + " Z";
      }
      var pts, d;
      switch (shape) {
        case "ellipse":
          d = "M 140 0 A 140 80 0 1 1 -140 0 A 140 80 0 1 1 140 0 Z";
          return { d: d, maxX: 140, maxY: 80, gx: 99, gy: 56.6 };
        case "rect":
          d = "M 110 58 A 12 12 0 0 1 98 70 L -98 70 A 12 12 0 0 1 -110 58 L -110 -58 A 12 12 0 0 1 -98 -70 L 98 -70 A 12 12 0 0 1 110 -58 Z";
          return { d: d, maxX: 110, maxY: 70, gx: 98, gy: 58 };
        case "triangle":
          return { d: toD(poly(3, 120, -90)), maxX: 104, maxY: 60, gx: 104, gy: 60 };
        case "diamond":
          return { d: toD(poly(4, 130, -90)), maxX: 95, maxY: 130, gx: 47.5, gy: 65 };
        case "pentagon":
          return { d: toD(poly(5, R, -90)), maxX: 100, maxY: 105, gx: 61.7, gy: 84.9 };
        case "hexagon":
          return { d: toD(poly(6, R, -90)), maxX: 91, maxY: 105, gx: 90.9, gy: 52.5 };
        case "octagon":
          return { d: toD(poly(8, R, -67.5)), maxX: 97, maxY: 97, gx: 97, gy: 40.2 };
        case "star": {
          pts = [];
          for (var i = 0; i < 5; i++) {
            var o = (-90 + i * 72) * Math.PI / 180;
            var inn = (o + 36 * Math.PI / 180); // punto interior en el punto medio del arco (estrella simétrica)
            pts.push(105 * Math.cos(o), 105 * Math.sin(o));
            pts.push(42 * Math.cos(inn), 42 * Math.sin(inn));
          }
          return { d: toD(pts), maxX: 100, maxY: 105, gx: 61.7, gy: 84.9 };
        }
        case "heart":
          d = "M 0 40 C 0 0 -20 -45 -55 -45 C -90 -45 -95 -10 -95 25 C -95 65 -55 95 0 140 C 55 95 95 65 95 25 C 95 -10 90 -45 55 -45 C 20 -45 0 0 0 40 Z";
          return { d: d, maxX: 95, maxY: 140, gx: 75, gy: 70 };
        case "duck":
          // Patito de goma de perfil (cabeza y pico a la derecha, cola arriba
          // a la izquierda). Trazado normalizado: bbox ~ -84..88 x, -88..78 y.
          d = "M -72 -46 C -80 -34 -84 -20 -82 -4 C -80 18 -70 48 -40 64 " +
            "C -12 78 28 78 50 62 C 68 48 70 24 64 2 C 60 -14 54 -24 52 -34 " +
            "C 51 -42 52 -50 62 -54 C 76 -58 86 -60 88 -66 C 88 -74 78 -76 64 -78 " +
            "C 52 -80 44 -86 34 -88 C 20 -88 8 -80 4 -68 C 0 -58 2 -50 -6 -42 " +
            "C -14 -34 -34 -30 -58 -34 C -64 -35 -68 -40 -72 -46 Z";
          return { d: d, maxX: 88, maxY: 88, gx: 66, gy: 35 };
        default: // circle
          return { d: "M 100 0 A 100 100 0 1 1 -100 0 A 100 100 0 1 1 100 0 Z", maxX: 100, maxY: 100, gx: 70.7, gy: 70.7 };
      }
    }

    // Construye el recorte (clip-path) y el contorno arrastrable de UN molde.
    // Se re-aplica en cada movimiento/escala/rotación actualizando atributos
    // SVG (barato), sin recrear nodos. Cada molde tiene SU PROPIO SVG y su
    // propio clipPath (id único), por lo que puede recortar una vista distinta.
    _applyMoldGeometry(m) {
      var self = this;
      var stage = this._workArea;
      var top = this.getView(m.topId);
      if (!stage || !top || !top.div) return;
      var W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      var minDim = Math.min(W, H);

      var g = this._moldPathData(m.shape);
      var k = (m.radius / 100 * minDim) / 100;  // escala: radio normalizado ~100
      var ang = m.angle;

      // Centro en px, recortado para que la figura no se salga del stage.
      function clampToFit(c, half, max) {
        if (half >= max / 2) return max / 2;
        return Math.max(half, Math.min(max - half, c));
      }
      var cxPx = clampToFit(m.cx / 100 * W, g.maxX * k, W);
      var cyPx = clampToFit(m.cy / 100 * H, g.maxY * k, H);

      var trans = "translate(" + cxPx.toFixed(1) + " " + cyPx.toFixed(1) +
        ") rotate(" + ang + ") scale(" + k.toFixed(3) + ")";

      var SVGNS = "http://www.w3.org/2000/svg";
      if (!m.svg) {
        var svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("class", "cmpv-mold");
        svg.setAttribute("xmlns", SVGNS);
        // Defs con el clipPath (misma geometría que el contorno).
        var defs = document.createElementNS(SVGNS, "defs");
        var clp = document.createElementNS(SVGNS, "clipPath");
        var clipId = this.id + "-moldshape-" + m.id;
        clp.setAttribute("id", clipId);
        clp.setAttribute("clipPathUnits", "userSpaceOnUse");
        var clipPathEl = document.createElementNS(SVGNS, "path");
        clp.appendChild(clipPathEl);
        defs.appendChild(clp);
        svg.appendChild(defs);
        // Ruta "gorda" transparente: zona de agarre para MOVER el molde.
        var hit = document.createElementNS(SVGNS, "path");
        hit.setAttribute("class", "cmpv-mold__hit");
        svg.appendChild(hit);
        // Ruta visible: contorno (color/ancho = apariencia de divisores).
        var vis = document.createElementNS(SVGNS, "path");
        vis.setAttribute("class", "cmpv-mold__vis");
        vis.setAttribute("fill", "none");
        svg.appendChild(vis);
        // Tirador: esquina inferior-derecha del bbox (escala + rota).
        var handle = document.createElementNS(SVGNS, "circle");
        handle.setAttribute("class", "cmpv-mold__handle");
        svg.appendChild(handle);
        stage.appendChild(svg);

        m.svg = svg;
        m.clipId = clipId;
        m.clipEl = clipPathEl;
        m.hit = hit;
        m.vis = vis;
        m.handle = handle;

        // ---- Drag: mover el molde arrastrando el contorno ----
        // Geometría FRESCA en cada evento (el estado puede cambiar por el
        // slider o por otro drag: nunca usar capturas de la primera llamada).
        var getGeom = function () {
          var st = self._workArea;
          var W = st.clientWidth, H = st.clientHeight;
          var minDim = Math.min(W, H);
          var k = (m.radius / 100 * minDim) / 100;
          var g = self._moldPathData(m.shape);
          // Mismo recorte que el render (clampToFit): el tirador renderizado
          // usa cxPx/cyPx recortados, así el punto de agarre coincide.
          function clampToFit(c, half, max) {
            if (half >= max / 2) return max / 2;
            return Math.max(half, Math.min(max - half, c));
          }
          return {
            W: W, H: H,
            minDim: minDim,
            k: k,
            g: g,
            ang: m.angle,
            cx: clampToFit(m.cx / 100 * W, g.maxX * k, W),
            cy: clampToFit(m.cy / 100 * H, g.maxY * k, H),
          };
        };
        var moving = false;
        var sCx, sCy, sPX, sPY;
        var startMove = function (e) {
          self._selectMold(m.id);   // arrastrar un molde también lo activa
          moving = true;
          e.preventDefault();
          var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
          sCx = m.cx; sCy = m.cy; sPX = p.clientX; sPY = p.clientY;
          self._setIframePointerEvents(false);
        };
        var moveMove = function (e) {
          if (!moving) return;
          var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
          m.cx = Math.max(0, Math.min(100, sCx + (p.clientX - sPX) / stage.clientWidth * 100));
          m.cy = Math.max(0, Math.min(100, sCy + (p.clientY - sPY) / stage.clientHeight * 100));
          self._applyMoldGeometry(m);
        };
        var endMove = function () { if (moving) { moving = false; self._setIframePointerEvents(true); } };
        hit.addEventListener("mousedown", startMove);
        hit.addEventListener("touchstart", startMove, { passive: false });
        window.addEventListener("mousemove", moveMove);
        window.addEventListener("touchmove", moveMove, { passive: false });
        window.addEventListener("mouseup", endMove);
        window.addEventListener("touchend", endMove);

        // ---- Drag: tirador (escala + rotación) ----
        var siz = false;
        var sDist, sK, sAng, sPX0, sPY0;
        var startSize = function (e) {
          self._selectMold(m.id);
          siz = true;
          e.preventDefault();
          e.stopPropagation();
          var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
          var gm = getGeom();
          sPX0 = p.clientX; sPY0 = p.clientY;
          // Referencia estable: distancia del puntero al CENTRO (el centro no
          // se mueve al escalar; el agarre sí, lo que realimentaba el cálculo).
          sDist = Math.hypot(sPX0 - gm.cx, sPY0 - gm.cy) || 1;
          sK = gm.k; sAng = gm.ang;
          self._setIframePointerEvents(false);
        };
        var moveSize = function (e) {
          if (!siz) return;
          var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
          var gm = getGeom();
          // Distancia del puntero al CENTRO: crece/shrink radial y de forma
          // estable al arrastrar hacia fuera/dentro (sin realimentación).
          var dist = Math.hypot(p.clientX - gm.cx, p.clientY - gm.cy) || 1;
          var kNew = sK * (dist / sDist);
          m.radius = Math.max(8, Math.min(60, kNew * 10000 / gm.minDim));
          // Rotación: delta angular del puntero alrededor del CENTRO.
          var a0 = Math.atan2(sPY0 - gm.cy, sPX0 - gm.cx);
          var a1 = Math.atan2(p.clientY - gm.cy, p.clientX - gm.cx);
          m.angle = (sAng + (a1 - a0) * 180 / Math.PI + 360) % 360;
          self._applyMoldGeometry(m);
        };
        var endSize = function () { if (siz) { siz = false; self._setIframePointerEvents(true); } };
        handle.addEventListener("mousedown", startSize);
        handle.addEventListener("touchstart", startSize, { passive: false });
        window.addEventListener("mousemove", moveSize);
        window.addEventListener("touchmove", moveSize, { passive: false });
        window.addEventListener("mouseup", endSize);
        window.addEventListener("touchend", endSize);

        // Redimensionar el stage (ventana) re-cuadra la geometría.
        m.onResize = function () { if (self.mode === "molde") self._applyMoldGeometry(m); };
        window.addEventListener("resize", m.onResize);
        m.cleanups = [
          function () {
            window.removeEventListener("mousemove", moveMove);
            window.removeEventListener("touchmove", moveMove);
            window.removeEventListener("mouseup", endMove);
            window.removeEventListener("touchend", endMove);
            window.removeEventListener("mousemove", moveSize);
            window.removeEventListener("touchmove", moveSize);
            window.removeEventListener("mouseup", endSize);
            window.removeEventListener("touchend", endSize);
            if (m.onResize) window.removeEventListener("resize", m.onResize);
          },
        ];
      }

      // El clipPath del div top se re-aplica en CADA llamada: los layouts
      // (_resetViewDivs) limpian los clipPaths, así que hay que reponerlo.
      top.div.style.clipPath = "url(#" + m.clipId + ")";
      top.div.style.webkitClipPath = "url(#" + m.clipId + ")";

      // Actualiza geometría (posición en px del tirador, con rotación).
      var rad = ang * Math.PI / 180;
      var cos = Math.cos(rad), sin = Math.sin(rad);
      var hx = cxPx + k * (g.gx * cos - g.gy * sin);
      var hy = cyPx + k * (g.gx * sin + g.gy * cos);

      m.svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      m.svg.style.width = W + "px";
      m.svg.style.height = H + "px";
      m.clipEl.setAttribute("d", g.d);
      m.clipEl.setAttribute("transform", trans);
      m.hit.setAttribute("d", g.d);
      m.hit.setAttribute("transform", trans);
      m.vis.setAttribute("d", g.d);
      m.vis.setAttribute("transform", trans);
      m.handle.setAttribute("cx", hx.toFixed(1));
      m.handle.setAttribute("cy", hy.toFixed(1));

      this._applyDivisorStyle();
      this._updateMoldSelection();
    }

    // Suelta los nodos SVG, drags y el clip-path de UN molde (sin tocar la lista).
    _teardownMold(m) {
      if (!m) return;
      if (m.cleanups) {
        m.cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
        m.cleanups = null;
      }
      var top = this.getView(m.topId);
      if (top && top.div && m.clipId) {
        top.div.style.clipPath = "";
        top.div.style.webkitClipPath = "";
      }
      if (m.svg && m.svg.parentNode) m.svg.parentNode.removeChild(m.svg);
      m.svg = null;
      m.clipId = null; m.clipEl = null; m.hit = null; m.vis = null; m.handle = null;
      m.onResize = null;
    }

    // Teardown de TODOS los moldes (al resetear el layout / salir del modo).
    _removeMolds() {
      var self = this;
      this.molds.forEach(function (m) { self._teardownMold(m); });
    }

    // Elimina un molde de la lista y reconstruye el layout (botón "Quitar").
    _removeMold(m) {
      if (!m || this.molds.length <= 1) return;
      var idx = this.molds.indexOf(m);
      this._teardownMold(m);
      if (idx !== -1) this.molds.splice(idx, 1);
      if (this.moldSelId === m.id) {
        this.moldSelId = this.molds[Math.max(0, idx - 1)].id;
      }
      if (this.mode === "molde") {
        this._layoutMold();
        this._refreshUI();
      }
      this._selectMold(this.moldSelId);
    }

    _layoutMold() {
      this._resetViewDivs();
      var base = this.getView(this.moldBaseId);
      if (!base) return;

      // La vista base ocupa toda la pantalla (se ve FUERA de las figuras);
      // cada molde superpone SU vista recortada por su figura.
      base.div.style.display = "";
      base.div.style.zIndex = "1";
      base.div.classList.add("cmpv-view--overlay");

      var self = this;
      this.molds.forEach(function (m) {
        var top = self.getView(m.topId);
        if (!top) return;
        top.div.style.display = "";
        top.div.style.zIndex = "2";
        top.div.classList.add("cmpv-view--overlay");
        self._applyMoldGeometry(m);
      });
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

      this._applyDivisorStyle();
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
            "<li><strong>Molde</strong>: una o varias figuras (círculo, estrella, patito de goma...) recortan vistas distintas sobre la base.</li>" +
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
