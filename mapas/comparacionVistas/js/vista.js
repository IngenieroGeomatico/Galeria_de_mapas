/* =====================================================================
   Vista del comparador (documento de iframe)
   --------------------------------------------------------------------
   Carga la API-IDEE en la implementación indicada por ?impl=ol|cesium,
   crea un IDEE.map con las capas base del IGN y se comunica con la página
   padre (el plugin comparacionVistas) por postMessage:

     Recibe:  { type:'cmpv:init',   vpId, impl }         (handshake)
              { type:'cmpv:setView', lon, lat, zoom }    (aplicar encuadre)
              { type:'cmpv:setBase', base:'mapa'|'imagen' }

     Emite:   { type:'cmpv:ready',  vpId }
              { type:'cmpv:view',   vpId, lon, lat, zoom } (continuo)

   El encuadre común entre motores se expresa SIEMPRE en lon/lat (EPSG:4326)
   + un zoom "lógico" comparable (nivel de zoom estándar de teselas web).
   ===================================================================== */
(function () {
  "use strict";

  // --- Parámetros ---------------------------------------------------------
  var params = new URLSearchParams(window.location.search);
  var IMPL = (params.get("impl") === "cesium") ? "cesium" : "ol";
  var VP_ID = params.get("vp") || "vista";
  var INIT_LON = parseFloat(params.get("lon"));
  var INIT_LAT = parseFloat(params.get("lat"));
  var INIT_ZOOM = parseFloat(params.get("zoom"));
  if (isNaN(INIT_LON)) INIT_LON = -3.70;
  if (isNaN(INIT_LAT)) INIT_LAT = 40.42;
  if (isNaN(INIT_ZOOM)) INIT_ZOOM = 12;

  var BASE_HOST = "https://componentes.idee.es/api-idee";

  var SVGCarga = document.getElementById("cargaSVG");

  // --- Carga dinámica de la API según implementación ----------------------
  function loadCSS(href) {
    return new Promise(function (resolve) {
      var l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
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
    // Espera a que IDEE quede disponible.
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

  // --- Capas base IGN -----------------------------------------------------
  function configBaseLayers() {
    var IDEE = window.IDEE;
    try {
      var base = new IDEE.layer.TMS({
        url: "https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg",
        legend: "IGNBaseTodo",
        visible: true,
        isBase: true,
        tileGridMaxZoom: 17,
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

  // --- Conversión de encuadre --------------------------------------------
  // Tabla zoom->altitud (m) para Cesium, análoga a map.zoom_meters de cambioImpl.
  // Aproximación estándar de teselas web; suficiente para sincronizar.
  function altitudeForZoom(z) {
    // Altitud de cámara ~ circunferencia ecuatorial / 2^z, escalada.
    var base = 40075016.686; // circunferencia (m)
    return (base / Math.pow(2, z)) * 1.0;
  }
  function zoomForAltitude(alt) {
    var base = 40075016.686;
    return Math.log2(base / Math.max(1, alt));
  }

  // =====================================================================
  //  Encuadre por EXTENT (bounding box geográfico en grados)
  //  --------------------------------------------------------------------
  //  Sincronizar por extent (y no por centro+zoom) iguala el ÁREA REALMENTE
  //  VISIBLE entre motores distintos: el campo de visión de la cámara 3D no
  //  cubre lo mismo que el viewport 2D a igual "zoom", así que centro+zoom
  //  daba extensiones distintas. El extent es el común denominador correcto.
  //  Formato: { west, south, east, north } en grados (EPSG:4326).
  // =====================================================================

  // Lee el extent visible actual en grados.
  function readExtent(map) {
    try {
      var impl = map.getMapImpl();
      if (impl && typeof impl.getView === "function") {
        // OpenLayers: extent del viewport en la proj del mapa -> a lon/lat.
        var view = impl.getView();
        var size = impl.getSize();
        if (!size || !size[0] || !size[1]) return null;
        var ext = view.calculateExtent(size); // [minx,miny,maxx,maxy] en proj
        var code = view.getProjection().getCode();
        var sw = window.ol.proj.toLonLat([ext[0], ext[1]], code);
        var ne = window.ol.proj.toLonLat([ext[2], ext[3]], code);
        return { west: sw[0], south: sw[1], east: ne[0], north: ne[1] };
      } else if (impl && impl.scene && impl.camera) {
        // Cesium: rectángulo del globo realmente visible.
        var C = window.Cesium;
        var rect = impl.camera.computeViewRectangle(impl.scene.globe.ellipsoid);
        if (!rect) {
          // Cámara mirando fuera del globo: aproxima desde el punto central.
          var carto = impl.camera.positionCartographic;
          var lon = C.Math.toDegrees(carto.longitude);
          var lat = C.Math.toDegrees(carto.latitude);
          var half = (carto.height / 40075016.686) * 180; // grosero
          return { west: lon - half, south: lat - half, east: lon + half, north: lat + half };
        }
        return {
          west: C.Math.toDegrees(rect.west),
          south: C.Math.toDegrees(rect.south),
          east: C.Math.toDegrees(rect.east),
          north: C.Math.toDegrees(rect.north),
        };
      }
    } catch (e) {}
    return null;
  }

  // Aplica un extent (grados). El guard programático lo gestiona el llamador.
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
        // fit ajusta centro+resolución para mostrar exactamente ese extent.
        view.fit(olExt, { size: size, duration: 0, constrainResolution: false });
        return true;
      } else if (impl && impl.scene && impl.camera) {
        var C = window.Cesium;
        var rect = C.Rectangle.fromDegrees(ext.west, ext.south, ext.east, ext.north);
        // setView con un Rectangle encuadra la cámara (cenital) sobre ese área.
        impl.camera.setView({ destination: rect });
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Lee centro (lon/lat) y zoom aproximado. Se usa para preservar el encuadre
  // al recargar el iframe con el botón 🌐 (la sincronización fina va por extent).
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
        return {
          lon: C.Math.toDegrees(carto.longitude),
          lat: C.Math.toDegrees(carto.latitude),
          zoom: zoomForAltitude(carto.height),
        };
      }
    } catch (e) {}
    return null;
  }

  // Compatibilidad: encuadre inicial por centro+zoom (para el arranque).
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
        var alt = altitudeForZoom(v.zoom);
        impl.camera.setView({
          destination: C.Cartesian3.fromDegrees(v.lon, v.lat, alt),
          orientation: { heading: 0.0, pitch: -C.Math.PI_OVER_TWO, roll: 0.0 },
        });
        return true;
      }
    } catch (e) {}
    return false;
  }

  // --- postMessage con el padre ------------------------------------------
  function postToParent(msg) {
    try { window.parent.postMessage(Object.assign({ vpId: VP_ID, source: "cmpv-vista" }, msg), "*"); } catch (e) {}
  }

  var _map = null;
  var _prog = 0; // guard: >0 mientras aplicamos un encuadre recibido del padre

  function onNativeChange() {
    if (_prog > 0) return;         // el cambio lo provocó el padre: no reenviar
    var ext = readExtent(_map);
    if (ext) postToParent({ type: "cmpv:view", extent: ext });
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
    if (!d || d.target !== VP_ID && d.broadcast !== true && d.vpTarget !== VP_ID) {
      // aceptamos mensajes dirigidos a esta vista o difundidos
    }
    if (!d || typeof d.type !== "string") return;
    if (d.type === "cmpv:setView") {
      _prog += 1;
      // Prioriza extent (área visible); si no llega, usa centro+zoom (arranque).
      if (d.extent) applyExtent(_map, d.extent);
      else applyView(_map, { lon: d.lon, lat: d.lat, zoom: d.zoom });
      setTimeout(function () { _prog = Math.max(0, _prog - 1); }, 0);
    } else if (d.type === "cmpv:setBase") {
      try {
        // Cambia la capa base activa (callejero/imagen) si la API lo soporta.
        if (window.IDEE && IDEE.config && IDEE.config.backgroundlayers) {
          // No-op robusto: el layerswitcher del propio mapa lo gestiona.
        }
      } catch (e) {}
    } else if (d.type === "cmpv:getView") {
      var ext = readExtent(_map);
      if (ext) postToParent({ type: "cmpv:view", extent: ext });
    }
  }

  // --- Arranque -----------------------------------------------------------
  (async function boot() {
    try {
      await loadApi();
    } catch (e) {
      console.error("[vista] No se pudo cargar la API-IDEE (" + IMPL + "):", e);
      return;
    }
    var IDEE = window.IDEE;
    if (IMPL === "cesium") { try { IDEE.config.DPI = 25.4 / 0.28; } catch (e) {} }
    configBaseLayers();

    _map = IDEE.map({ container: "mapaDIV" });
    // Referencia accesible desde el padre/QA (útil para depuración).
    window._cmpvMap = _map;
    window.mapajs = _map;

    // Encuadre inicial una vez listo.
    var applyInitial = function () {
      _prog += 1;
      applyView(_map, { lon: INIT_LON, lat: INIT_LAT, zoom: INIT_ZOOM });
      setTimeout(function () { _prog = Math.max(0, _prog - 1); }, 0);
    };
    try { _map.on(IDEE.evt.COMPLETED, applyInitial); } catch (e) {}
    setTimeout(applyInitial, 1200);

    // Espera a que el mapa nativo exista, engancha sync continua y avisa al padre.
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
    }).catch(function () {
      if (SVGCarga) SVGCarga.hidden = true;
      buildCambioImplButton();
      postToParent({ type: "cmpv:ready", impl: IMPL, warning: "map-not-detected" });
    });

    window.addEventListener("message", handleParentMessage);
  })();

  // --- Botón de cambio de implementación (🌐 2D/3D) dentro de la vista -----
  // Reutiliza el estilo del plugin cambioImpl (clases .buttonHerramienta_cambImpl).
  // Al pulsarlo, recarga ESTA vista (el iframe) con la otra implementación,
  // preservando el encuadre actual, y avisa al padre para que actualice su
  // estado (badge 2D/3D y sincronización).
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
      // Avisa al padre del cambio (para que actualice v.impl y la sync).
      postToParent({ type: "cmpv:implChange", impl: target, lon: st.lon, lat: st.lat, zoom: st.zoom });
      // Recarga la vista con la otra implementación, preservando encuadre.
      var q = "?impl=" + target + "&vp=" + encodeURIComponent(VP_ID) +
        "&lon=" + encodeURIComponent(st.lon) +
        "&lat=" + encodeURIComponent(st.lat) +
        "&zoom=" + encodeURIComponent(st.zoom);
      window.location.search = q;
    });
  }
})();
