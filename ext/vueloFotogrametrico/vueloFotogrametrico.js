/* =====================================================================
   Plugin de Vuelo Fotogramétrico para API-IDEE
   --------------------------------------------------------------------
   Importa vuelos fotogramétricos ya realizados desde un fichero CSV o
   Excel (p.ej. centros de fotograma del IGN) y los visualiza sobre el
   mapa en las DOS implementaciones de API-IDEE: OpenLayers (2D) y Cesium
   (3D), reutilizando el plugin miPlugin_cambioImpl para alternar.

   Genera hasta TRES capas GeoJSON:
     - Centros de fotograma (puntos), coloreados por pasada.
     - Líneas de pasada (une los centros de cada pasada por orden).
     - Huella / footprint de cada fotograma (rectángulo en el suelo),
       calculado a partir de focal + altura de vuelo + tamaño de sensor.

   El panel de importación se crea con el sistema de paneles de API-IDEE
   (IDEE.ui.Panel + IDEE.Control + map.addPanels), siguiendo el protocolo de
   ext_backgorundLayers.js. Cada vez que miPlugin_cambioImpl recrea el mapa al
   alternar OL <-> Cesium se instancia de nuevo este plugin y se reconstruye el
   panel; un singleton guard (window.__vueloActivePlugin) limpia la instancia
   anterior y RE-PINTA los datos ya importados (que persisten en memoria en
   window.__vueloSharedData), sin volver a pedir el fichero.

   NOTA (fases futuras): la arquitectura deja preparados los ganchos para
   PLANIFICACIÓN de vuelos nuevos (GSD, solape, cámara, altura, dirección) y
   EXPORTACIÓN (GeoJSON / CSV / KML). En esta v1 solo está el importador.
   ===================================================================== */
(function () {
  "use strict";

  // El objeto global de la API puede llamarse IDEE (builds nuevas) o M (alias
  // en ejemplos antiguos). Resolvemos el que exista en cada momento.
  function api() {
    return window.IDEE || window.M;
  }

  // ---------------------------------------------------------------------
  //  Sistemas de referencia predefinidos para el desplegable de CRS. proj4
  //  se carga por CDN en el index.html. WGS84 geográficas es el destino.
  // ---------------------------------------------------------------------
  var CRS_PRESETS = [
    { code: "EPSG:4326", label: "WGS84 geográficas (lon/lat)", def: null /* nativo proj4 */ },
    { code: "EPSG:25830", label: "ETRS89 / UTM 30N (Península)", def: "+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs" },
    { code: "EPSG:25829", label: "ETRS89 / UTM 29N", def: "+proj=utm +zone=29 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs" },
    { code: "EPSG:25831", label: "ETRS89 / UTM 31N", def: "+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs" },
    { code: "EPSG:25828", label: "ETRS89 / UTM 28N (Canarias)", def: "+proj=utm +zone=28 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs" },
    { code: "EPSG:3828", label: "REGCAN95 / UTM 28N (Canarias)", def: "+proj=utm +zone=28 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs" },
    { code: "EPSG:3857", label: "Web Mercator", def: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs" }
  ];

  // Campos lógicos que el usuario mapea a columnas del fichero. required indica
  // los imprescindibles para poder pintar los puntos.
  var CAMPOS = [
    { key: "id", label: "ID fotograma", required: false },
    { key: "pasada", label: "Pasada / línea", required: false },
    { key: "x", label: "X / Longitud", required: true },
    { key: "y", label: "Y / Latitud", required: true },
    { key: "z", label: "Z / Altitud (m)", required: false },
    { key: "fecha", label: "Fecha", required: false },
    { key: "sensor", label: "Sensor / cámara", required: false }
  ];

  // Heurísticas de autodetección: para cada campo lógico, posibles nombres de
  // columna (en minúsculas, sin acentos). Se busca coincidencia por inclusión.
  var AUTODETECT = {
    id: ["id", "foto", "fotograma", "photo", "frame", "imagen", "image"],
    pasada: ["pasada", "linea", "line", "strip", "vuelo_pasada", "flightline"],
    x: ["x", "lon", "long", "longitud", "longitude", "x_coord", "este", "easting"],
    y: ["y", "lat", "latitud", "latitude", "y_coord", "norte", "northing"],
    z: ["z", "alt", "altitud", "altitude", "height", "cota", "z_coord", "elev"],
    fecha: ["fecha", "date", "dia", "day", "datetime"],
    sensor: ["sensor", "camara", "camera", "instrument"]
  };

  // Paleta cíclica para colorear por pasada.
  var PALETA = [
    "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4",
    "#f032e6", "#bfef45", "#fabed4", "#469990", "#dcbeff", "#9a6324",
    "#800000", "#808000", "#000075", "#a9a9a9"
  ];

  // ---------------------------------------------------------------------
  //  OGC API - Processes del IGN: proceso "bsq-fotogramas". Busca fotogramas
  //  PNOA (analógicos y digitales) y devuelve sus parámetros de orientación
  //  externa (fotocentros X/Y/Z y giros omega/phi/kappa en radianes) además
  //  del nom_fichero. La entrada geom va en EPSG:3857; la SALIDA (fotocentros)
  //  viene en UTM ETRS89 (verificado empíricamente: el huso se autodetecta a
  //  partir de la longitud del área buscada). Solo admite ejecución síncrona.
  //  Doc: https://blog-idee.blogspot.com/2024/07/servicio-de-ogc-api-de-procesos-proceso.html
  // ---------------------------------------------------------------------
  var OGC_URL = "https://api-processes.idee.es/processes/bsq-fotogramas/execution";

  // Base para localizar un fotograma en la Fototeca Digital por su nom_fichero.
  // (Gancho para el futuro visor de la imagen COG; hoy solo enlace de consulta.)
  var FOTOTECA_URL = "https://fototeca.cnig.es/fototeca/";

  // Máximo de fotogramas a pintar de una búsqueda OGC (evita saturar el mapa;
  // una búsqueda amplia puede devolver miles). Configurable en el panel.
  var OGC_MAX_DEFAULT = 2000;

  // ###################################################################
  //  SHELL DEL PLUGIN
  //  --------------------------------------------------------------------
  //  Definido como CLASE ES6 (constructor + addTo) igual que
  //  miPlugin_cambioImpl, para poder instanciarse e importarse con
  //  mapajs.addPlugin(new miPlugin_vueloFotogrametrico()).
  //  Nota: todo el render y el encuadre usan EXCLUSIVAMENTE métodos de
  //  API-IDEE (IDEE.layer.GeoJSON, setStyle, extract, map.setBbox,
  //  layer.getFeaturesExtent), abstraídos por la API => el comportamiento es
  //  idéntico en las dos implementaciones (OpenLayers 2D y Cesium 3D) sin
  //  código específico por motor.
  // ###################################################################
  class miPlugin_vueloFotogrametrico {
    constructor(options = {}) {
    this.name = "miPlugin_vueloFotogrametrico";
    this.options = options || {};
    this.map = null;
    this.panel = null;

    // Estado de datos importados (persiste entre swaps OL<->Cesium).
    // mode: 'hecho' (vuelo ya realizado) | 'calculo' (planificación, futuro).
    // source: origen de datos dentro de 'hecho': 'csv' | 'ogc'.
    // rows: array de objetos {col: valor}. headers: nombres de columna.
    // mapping: {campoLogico: nombreColumna}. crs: código EPSG origen.
    // footprint: parámetros de cámara/altura para el rectángulo.
    // ogc: parámetros del modo OGC API bsq-fotogramas (rango de fechas).
    // rotarKappa: aplica el giro kappa al footprint (fuente OGC trae giro_k).
    this.data = (window.__vueloSharedData) || {
      mode: "hecho",
      source: "csv",
      rows: null,
      headers: null,
      mapping: {},
      crs: "EPSG:25830",
      footprint: { focal_mm: 100, sensor_w_mm: 53.4, sensor_h_mm: 40.0, altura_m: 3000, usarZ: true },
      visible: { puntos: true, lineas: true, footprints: false },
      ogc: { fechaDesde: "", fechaHasta: "" },
      rotarKappa: true
    };
    // Compartimos el estado a nivel de ventana para que sobreviva a la
    // recreación de la instancia por cambioImpl.
    window.__vueloSharedData = this.data;

    this._layers = { puntos: null, lineas: null, footprints: null };
  }

  // Ayuda del plugin (protocolo API-IDEE: getHelp devuelve {title, content}).
  getHelp() {
    const IDEE = api();
    return {
      title: 'Vuelo fotogramétrico',
      content: new Promise((success) => {
        let html =
          '<div>' +
          '<p>Importa un vuelo fotogramétrico ya realizado desde un fichero ' +
          '<strong>CSV</strong> o <strong>Excel</strong> (p.ej. centros de fotograma del IGN) ' +
          'y lo visualiza sobre el mapa en 2D (OpenLayers) y 3D (Cesium).</p>' +
          '<p>Genera hasta tres capas: centros de fotograma, líneas de pasada y ' +
          'huellas de fotograma (calculadas con focal, altura de vuelo y tamaño de sensor).</p>' +
          '</div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;

    // Singleton guard: limpia la instancia anterior (cambioImpl crea una nueva
    // por cada cambio de implementación y deja la anterior colgada).
    if (window.__vueloActivePlugin && window.__vueloActivePlugin !== this) {
      try { window.__vueloActivePlugin.cleanup(); } catch (e) { /* ignora */ }
    }
    window.__vueloActivePlugin = this;

    this.buildPanel(map);
    this.bindPanelEvents();
    this.syncUIFromData();

    // Si ya había datos importados (venimos de un swap), re-pinta al estar listo.
    var self = this;
    var IDEE = api();
    var repintar = function () { self.render(); };
    try { this.map.on(IDEE.evt.COMPLETED, repintar); } catch (e) { /* ignora */ }
    // Reintento por si COMPLETED ya se disparó.
    setTimeout(repintar, 800);
  }

  // ---- Panel: se crea con el sistema de paneles de API-IDEE (protocolo) -----
  //  Sigue el patrón de ext_backgorundLayers.js: IDEE.ui.Panel + IDEE.Control +
  //  map.addPanels, con la estructura de clases del framework (m-control /
  //  m-container / m-herramienta + header). El panel se reconstruye en cada
  //  addTo (cambioImpl recrea el mapa al alternar OL<->Cesium); el estado
  //  importado vive en window.__vueloSharedData y se re-hidrata en syncUIFromData.
  buildPanel(map) {
    const IDEE = api();

    const panelVuelo = new IDEE.ui.Panel('toolsExtra_vuelo', {
      collapsible: true,
      collapsed: false,
      className: 'g-herramienta_vuelo',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TR,
      order: 1,
    });

    const htmlPanel =
      '<div aria-label="Vuelo fotogramétrico" role="menuitem" ' +
      'id="div-contenedor-herramienta-vuelo" class="m-control m-container m-herramienta">' +
      '  <header role="heading" tabindex="0" id="m-herramienta-title-vuelo" ' +
      '          class="m-herramienta-header">Vuelo fotogramétrico</header>' +
      '  <div id="m-herramienta-contents-vuelo"></div>' +
      '</div>';

    const controlVuelo = new IDEE.Control(new IDEE.impl.Control(), 'controlVuelo');
    controlVuelo.createView = () => document.createElement('div');

    panelVuelo.addControls(controlVuelo);
    map.addPanels(panelVuelo);

    document.querySelector('.g-herramienta_vuelo .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents-vuelo').appendChild(controlVuelo.getElement());

    IDEE.utils.draggabillyPlugin(panelVuelo, '#m-herramienta-title-vuelo');

    // Contenido dinámico del plugin dentro del elemento del control. A partir de
    // aquí, this.panel es la raíz sobre la que consultan el resto de métodos
    // (querySelector('#id')), igual que antes con el div de body.
    const contenido = controlVuelo.getElement();
    contenido.innerHTML = this.buildPanelHTML();
    this.panel = contenido;
    this._iueePanel = panelVuelo;
  }

  buildPanelHTML() {
    var crsOptions = CRS_PRESETS.map(function (c) {
      return '<option value="' + c.code + '">' + c.label + "</option>";
    }).join("");

    var mapRows = CAMPOS.map(function (c) {
      return '' +
        '<div class="vuelo-row">' +
        '  <label for="vf-col-' + c.key + '">' + c.label + (c.required ? " *" : "") + '</label>' +
        '  <select id="vf-col-' + c.key + '" data-campo="' + c.key + '"><option value="">—</option></select>' +
        '</div>';
    }).join("");

    return '' +
      '<div class="vuelo-body" id="vf-body">' +

      // --- Selector de MODO: Vuelo ya hecho / Cálculo (planificación) ------
      '  <div class="vuelo-modes" id="vf-modes">' +
      '    <button type="button" class="vuelo-mode" data-mode="hecho">Vuelo ya hecho</button>' +
      '    <button type="button" class="vuelo-mode" data-mode="calculo">Cálculo</button>' +
      '  </div>' +

      // ==================== MODO: VUELO YA HECHO ==========================
      '  <div class="vuelo-mode-panel" id="vf-mode-hecho">' +

      // --- Sub-pestañas de FUENTE: CSV / OGC API IGN --------------------
      '    <div class="vuelo-tabs" id="vf-tabs">' +
      '      <button type="button" class="vuelo-tab" data-source="csv">CSV / Excel</button>' +
      '      <button type="button" class="vuelo-tab" data-source="ogc">OGC API IGN</button>' +
      '    </div>' +

      // ---- Fuente CSV / Excel -----------------------------------------
      '    <div class="vuelo-tab-panel" id="vf-tab-csv">' +
      '      <div class="vuelo-drop" id="vf-drop">' +
      '        Arrastra aquí un <strong>CSV</strong> o <strong>Excel</strong><br>o haz clic para elegir archivo' +
      '        <input type="file" id="vf-file" accept=".csv,.txt,.xlsx,.xls">' +
      '      </div>' +
      '    </div>' +

      // ---- Fuente OGC API IGN (bsq-fotogramas) ------------------------
      '    <div class="vuelo-tab-panel" id="vf-tab-ogc" hidden>' +
      '      <p class="vuelo-hint">Busca fotogramas PNOA del IGN en el área visible del mapa y un rango de fechas. Devuelve los parámetros de orientación externa (fotocentros y giros).</p>' +
      '      <div class="vuelo-row"><label for="vf-ogc-desde">Fecha desde</label><input type="date" id="vf-ogc-desde"></div>' +
      '      <div class="vuelo-row"><label for="vf-ogc-hasta">Fecha hasta</label><input type="date" id="vf-ogc-hasta"></div>' +
      '      <label class="vuelo-check"><input type="checkbox" id="vf-ogc-usarvista" checked> Usar el área visible del mapa</label>' +
      '      <div class="vuelo-row"><label for="vf-ogc-max">Máx. fotogramas</label><input type="number" id="vf-ogc-max" step="100" min="1" value="' + OGC_MAX_DEFAULT + '"></div>' +
      '      <button type="button" id="vf-ogc-buscar" class="vuelo-btn primary">Buscar fotogramas</button>' +
      '    </div>' +

      '    <div class="vuelo-status" id="vf-status"></div>' +

      // ---- Mapeo de columnas (solo relevante para CSV; oculto en OGC) --
      '    <div class="vuelo-section" id="vf-section-map" hidden>' +
      '      <span class="vuelo-section-title">Mapeo de columnas</span>' +
      '      <div class="vuelo-row">' +
      '        <label for="vf-crs">CRS origen</label>' +
      '        <select id="vf-crs">' + crsOptions + '</select>' +
      '      </div>' +
      mapRows +
      '    </div>' +

      // ---- Huella / footprint (común a ambas fuentes) -----------------
      '    <div class="vuelo-section" id="vf-section-fp" hidden>' +
      '      <span class="vuelo-section-title">Huella / footprint</span>' +
      '      <div class="vuelo-row"><label for="vf-fp-focal">Focal (mm)</label><input type="number" id="vf-fp-focal" step="1" min="1"></div>' +
      '      <div class="vuelo-row"><label for="vf-fp-sw">Sensor ancho (mm)</label><input type="number" id="vf-fp-sw" step="0.1" min="0.1"></div>' +
      '      <div class="vuelo-row"><label for="vf-fp-sh">Sensor alto (mm)</label><input type="number" id="vf-fp-sh" step="0.1" min="0.1"></div>' +
      '      <div class="vuelo-row"><label for="vf-fp-alt">Altura vuelo AGL (m)</label><input type="number" id="vf-fp-alt" step="10" min="1"></div>' +
      '      <label class="vuelo-check"><input type="checkbox" id="vf-fp-usez"> Usar Z del dato como altura si existe</label>' +
      '      <label class="vuelo-check" id="vf-fp-kappa-row"><input type="checkbox" id="vf-fp-kappa"> Rotar huella con el giro kappa (OGC)</label>' +
      '    </div>' +

      // ---- Capas visibles --------------------------------------------
      '    <div class="vuelo-section" id="vf-section-layers" hidden>' +
      '      <span class="vuelo-section-title">Capas</span>' +
      '      <label class="vuelo-check"><input type="checkbox" id="vf-lyr-puntos" checked> Centros de fotograma</label>' +
      '      <label class="vuelo-check"><input type="checkbox" id="vf-lyr-lineas" checked> Líneas de pasada</label>' +
      '      <label class="vuelo-check"><input type="checkbox" id="vf-lyr-footprints"> Huellas de fotograma</label>' +
      '    </div>' +

      // ---- Acciones ---------------------------------------------------
      '    <div class="vuelo-section" id="vf-section-actions" hidden>' +
      '      <button type="button" id="vf-render" class="vuelo-btn primary">Visualizar vuelo</button>' +
      '      <button type="button" id="vf-clear" class="vuelo-btn">Limpiar</button>' +
      '    </div>' +
      '  </div>' +

      // ==================== MODO: CÁLCULO (placeholder) ==================
      '  <div class="vuelo-mode-panel" id="vf-mode-calculo" hidden>' +
      '    <p class="vuelo-hint">Planificación de vuelos nuevos (GSD, solape, cámara, altura y dirección de pasadas). <strong>Próximamente.</strong></p>' +
      '  </div>' +

      '</div>';
  };

  // ---- Enlace de eventos del panel ---------------------------------------
  bindPanelEvents() {
    var self = this;
    var p = this.panel;

    // El panel se reconstruye fresco en cada addTo (el sistema de paneles de
    // API-IDEE lo recrea al recargar el mapa en cambioImpl), así que basta con
    // enganchar listeners directamente: no hay nodos previos con listeners.
    function bind(id, evt, handler) {
      var el = p.querySelector("#" + id);
      if (!el) return null;
      el.addEventListener(evt, handler);
      return el;
    }

    // Selector de modo (Vuelo hecho / Cálculo).
    var modeBtns = p.querySelectorAll(".vuelo-mode");
    for (var mi = 0; mi < modeBtns.length; mi++) {
      modeBtns[mi].addEventListener("click", function () {
        self.data.mode = this.getAttribute("data-mode");
        window.__vueloSharedData = self.data;
        self.applyMode();
      });
    }

    // Sub-pestañas de fuente (CSV / OGC API IGN).
    var tabBtns = p.querySelectorAll(".vuelo-tab");
    for (var ti = 0; ti < tabBtns.length; ti++) {
      tabBtns[ti].addEventListener("click", function () {
        self.data.source = this.getAttribute("data-source");
        window.__vueloSharedData = self.data;
        self.applySource();
      });
    }

    // Campos del modo OGC.
    bind("vf-ogc-desde", "change", function () { self.data.ogc.fechaDesde = this.value; });
    bind("vf-ogc-hasta", "change", function () { self.data.ogc.fechaHasta = this.value; });
    bind("vf-ogc-max", "change", function () { self.data.ogc.max = parseInt(this.value, 10) || OGC_MAX_DEFAULT; });
    bind("vf-ogc-buscar", "click", function () { self.fetchOGCFotogramas(); });

    var drop = bind("vf-drop", "click", function () {
      var input = p.querySelector("#vf-file");
      if (input) input.click();
    });
    if (drop) {
      drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("dragover"); });
      drop.addEventListener("dragleave", function () { drop.classList.remove("dragover"); });
      drop.addEventListener("drop", function (e) {
        e.preventDefault(); drop.classList.remove("dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          self.handleFile(e.dataTransfer.files[0]);
        }
      });
    }

    bind("vf-file", "change", function () {
      if (this.files && this.files.length) self.handleFile(this.files[0]);
    });

    bind("vf-crs", "change", function () { self.data.crs = this.value; });

    // Selects de mapeo de columnas.
    CAMPOS.forEach(function (c) {
      bind("vf-col-" + c.key, "change", function () {
        self.data.mapping[c.key] = this.value || null;
      });
    });

    // Parámetros de footprint.
    bind("vf-fp-focal", "change", function () { self.data.footprint.focal_mm = parseFloat(this.value) || 0; });
    bind("vf-fp-sw", "change", function () { self.data.footprint.sensor_w_mm = parseFloat(this.value) || 0; });
    bind("vf-fp-sh", "change", function () { self.data.footprint.sensor_h_mm = parseFloat(this.value) || 0; });
    bind("vf-fp-alt", "change", function () { self.data.footprint.altura_m = parseFloat(this.value) || 0; });
    bind("vf-fp-usez", "change", function () { self.data.footprint.usarZ = this.checked; });
    bind("vf-fp-kappa", "change", function () { self.data.rotarKappa = this.checked; });

    // Visibilidad de capas.
    bind("vf-lyr-puntos", "change", function () { self.data.visible.puntos = this.checked; self.applyVisibility(); });
    bind("vf-lyr-lineas", "change", function () { self.data.visible.lineas = this.checked; self.applyVisibility(); });
    bind("vf-lyr-footprints", "change", function () { self.data.visible.footprints = this.checked; self.applyVisibility(); });

    // Acciones.
    bind("vf-render", "click", function () { self.render(); });
    bind("vf-clear", "click", function () { self.clearData(); });
  }

  // Refleja el estado de datos en la UI (tras un swap, o al reabrir).
  syncUIFromData() {
    var p = this.panel;
    var d = this.data;
    var crs = p.querySelector("#vf-crs"); if (crs) crs.value = d.crs;
    var fp = d.footprint;
    var set = function (id, v) { var el = p.querySelector(id); if (el) el.value = v; };
    set("#vf-fp-focal", fp.focal_mm);
    set("#vf-fp-sw", fp.sensor_w_mm);
    set("#vf-fp-sh", fp.sensor_h_mm);
    set("#vf-fp-alt", fp.altura_m);
    var usez = p.querySelector("#vf-fp-usez"); if (usez) usez.checked = !!fp.usarZ;
    var kap = p.querySelector("#vf-fp-kappa"); if (kap) kap.checked = !!d.rotarKappa;
    var vp = p.querySelector("#vf-lyr-puntos"); if (vp) vp.checked = !!d.visible.puntos;
    var vl = p.querySelector("#vf-lyr-lineas"); if (vl) vl.checked = !!d.visible.lineas;
    var vf = p.querySelector("#vf-lyr-footprints"); if (vf) vf.checked = !!d.visible.footprints;

    // Campos del modo OGC.
    if (d.ogc) {
      set("#vf-ogc-desde", d.ogc.fechaDesde || "");
      set("#vf-ogc-hasta", d.ogc.fechaHasta || "");
      if (d.ogc.max) set("#vf-ogc-max", d.ogc.max);
    }

    // Restaura modo y fuente activos (persisten entre swaps OL<->Cesium).
    this.applyMode();
    this.applySource();

    // Si ya hay cabeceras cargadas (venimos de un swap), rellena los selects.
    if (d.headers && d.headers.length) {
      this.fillColumnSelects(d.headers, d.mapping);
      this.showConfigSections(true);
    }
  };

  // ---- Estado / mensajes -------------------------------------------------
  setStatus(msg, cls) {
    var el = this.panel && this.panel.querySelector("#vf-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "vuelo-status" + (cls ? " " + cls : "");
  };

  showConfigSections(on) {
    // El mapeo de columnas solo aplica a la fuente CSV. Para OGC, los campos
    // llegan ya normalizados desde la API, así que esa sección se mantiene
    // oculta aunque haya datos.
    var ids = ["#vf-section-fp", "#vf-section-layers", "#vf-section-actions"];
    var p = this.panel;
    ids.forEach(function (id) {
      var el = p.querySelector(id);
      if (el) { if (on) el.removeAttribute("hidden"); else el.setAttribute("hidden", ""); }
    });
    var mapSec = p.querySelector("#vf-section-map");
    if (mapSec) {
      var showMap = on && this.data.source === "csv";
      if (showMap) mapSec.removeAttribute("hidden"); else mapSec.setAttribute("hidden", "");
    }
    // La opción de rotar por kappa solo tiene sentido con datos OGC (traen giro_k).
    var kappaRow = p.querySelector("#vf-fp-kappa-row");
    if (kappaRow) {
      if (this.data.source === "ogc") kappaRow.removeAttribute("hidden");
      else kappaRow.setAttribute("hidden", "");
    }
  };

  // Muestra el modo activo (hecho / calculo) y marca su botón. El modo
  // 'calculo' es un placeholder para la fase de planificación.
  applyMode() {
    var p = this.panel;
    var mode = this.data.mode || "hecho";
    var hecho = p.querySelector("#vf-mode-hecho");
    var calc = p.querySelector("#vf-mode-calculo");
    if (hecho) { if (mode === "hecho") hecho.removeAttribute("hidden"); else hecho.setAttribute("hidden", ""); }
    if (calc) { if (mode === "calculo") calc.removeAttribute("hidden"); else calc.setAttribute("hidden", ""); }
    var btns = p.querySelectorAll(".vuelo-mode");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-mode") === mode);
    }
  };

  // Muestra la fuente activa dentro del modo 'hecho' (csv / ogc) y marca su tab.
  applySource() {
    var p = this.panel;
    var src = this.data.source || "csv";
    var csv = p.querySelector("#vf-tab-csv");
    var ogc = p.querySelector("#vf-tab-ogc");
    if (csv) { if (src === "csv") csv.removeAttribute("hidden"); else csv.setAttribute("hidden", ""); }
    if (ogc) { if (src === "ogc") ogc.removeAttribute("hidden"); else ogc.setAttribute("hidden", ""); }
    var tabs = p.querySelectorAll(".vuelo-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-source") === src);
    }
    // Reevalúa qué secciones de configuración se muestran (map solo en CSV).
    var hayDatos = !!(this.data.rows && this.data.rows.length);
    this.showConfigSections(hayDatos);
  };

  // ###################################################################
  //  CARGA Y PARSEO DE FICHERO (solo cliente)
  // ###################################################################
  handleFile(file) {
    var self = this;
    if (!file) return;
    var name = (file.name || "").toLowerCase();
    this.setStatus("Leyendo " + file.name + "…");

    var reader = new FileReader();
    reader.onerror = function () { self.setStatus("No se pudo leer el archivo.", "error"); };

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      if (typeof XLSX === "undefined") {
        this.setStatus("Falta la librería XLSX (SheetJS) para leer Excel.", "error");
        return;
      }
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: "array" });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var arr = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
          self.ingestMatrix(arr);
        } catch (err) {
          self.setStatus("Error leyendo Excel: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = function (e) {
        try {
          var matrix = self.parseCSV(e.target.result);
          self.ingestMatrix(matrix);
        } catch (err) {
          self.setStatus("Error leyendo CSV: " + err.message, "error");
        }
      };
      reader.readAsText(file);
    }
  };

  // Parser CSV propio: detecta separador (coma / punto y coma / tabulador),
  // respeta comillas dobles y saltos de línea entre comillas. Devuelve matriz
  // de filas (array de arrays de strings).
  parseCSV(text) {
    // Quita BOM.
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    // Detecta separador contando ocurrencias fuera de comillas en la 1ª línea.
    var firstLine = text.split(/\r?\n/)[0] || "";
    var candidates = [";", ",", "\t"];
    var sep = ",", best = -1;
    candidates.forEach(function (c) {
      var n = firstLine.split(c).length;
      if (n > best) { best = n; sep = c; }
    });

    var rows = [];
    var row = [];
    var field = "";
    var i = 0, inQuotes = false;
    var n = text.length;
    while (i < n) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === sep) { row.push(field); field = ""; i++; continue; }
      if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      if (ch === "\r") { i++; continue; }
      field += ch; i++;
    }
    // Último campo/fila.
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  };

  // Recibe una matriz [ [cabeceras...], [fila1...], ... ], monta headers + rows
  // (objetos), autodetecta el mapeo de columnas y muestra la configuración.
  ingestMatrix(matrix) {
    if (!matrix || matrix.length < 2) {
      this.setStatus("El archivo no tiene datos suficientes (cabecera + filas).", "error");
      return;
    }
    var headers = matrix[0].map(function (h) { return String(h).trim(); });
    var rows = [];
    for (var r = 1; r < matrix.length; r++) {
      var raw = matrix[r];
      if (!raw || !raw.length) continue;
      // Salta filas totalmente vacías.
      var allEmpty = raw.every(function (v) { return v === "" || v === null || v === undefined; });
      if (allEmpty) continue;
      var obj = {};
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = (raw[c] !== undefined ? raw[c] : "");
      rows.push(obj);
    }
    this.data.source = "csv";
    this.data.headers = headers;
    this.data.rows = rows;
    window.__vueloSharedData = this.data;

    var mapping = this.autodetectMapping(headers);
    this.data.mapping = mapping;

    this.fillColumnSelects(headers, mapping);
    this.showConfigSections(true);
    this.setStatus(rows.length + " filas leídas. Revisa el mapeo y pulsa \u201cVisualizar vuelo\u201d.", "ok");
  };

  // Autodetección de columnas por nombre (sin acentos, minúsculas).
  autodetectMapping(headers) {
    function norm(s) {
      return String(s).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    }
    var normHeaders = headers.map(function (h) { return { raw: h, n: norm(h) }; });
    var mapping = {};
    Object.keys(AUTODETECT).forEach(function (key) {
      var cands = AUTODETECT[key];
      var found = null;
      // 1) coincidencia exacta.
      for (var i = 0; i < normHeaders.length && !found; i++) {
        if (cands.indexOf(normHeaders[i].n) !== -1) found = normHeaders[i].raw;
      }
      // 2) coincidencia por inclusión.
      if (!found) {
        for (var j = 0; j < normHeaders.length && !found; j++) {
          for (var k = 0; k < cands.length && !found; k++) {
            if (normHeaders[j].n.indexOf(cands[k]) !== -1) found = normHeaders[j].raw;
          }
        }
      }
      if (found) mapping[key] = found;
    });
    return mapping;
  };

  // Rellena los <select> de mapeo con las cabeceras y aplica el mapping actual.
  fillColumnSelects(headers, mapping) {
    var p = this.panel;
    CAMPOS.forEach(function (c) {
      var sel = p.querySelector("#vf-col-" + c.key);
      if (!sel) return;
      var opts = ['<option value="">—</option>'];
      headers.forEach(function (h) {
        opts.push('<option value="' + h.replace(/"/g, "&quot;") + '">' + h + "</option>");
      });
      sel.innerHTML = opts.join("");
      if (mapping && mapping[c.key]) sel.value = mapping[c.key];
    });
  };

  // ###################################################################
  //  MODO OGC API - Processes: bsq-fotogramas (IGN)
  // ###################################################################

  // Devuelve el extent visible del mapa como bbox [xmin,ymin,xmax,ymax] en
  // EPSG:3857 (el CRS que exige el parámetro geom del proceso). Usa la API de
  // OpenLayers cuando está disponible (implementación activa) y reproyecta el
  // bbox de la vista a 3857. Como respaldo intenta map.getBbox() de API-IDEE.
  getMapBBox3857() {
    var IDEE = api();
    // 1) Vía OpenLayers directa: extent de la vista -> reproyectar a 3857.
    try {
      var impl = this.map.getMapImpl();
      if (impl && typeof impl.getView === "function" && window.ol) {
        var view = impl.getView();
        var size = impl.getSize();
        if (size && size[0] && size[1]) {
          var ext = view.calculateExtent(size); // en la proyección del mapa
          var code = view.getProjection().getCode();
          if (code === "EPSG:3857") return ext;
          var min = window.ol.proj.transform([ext[0], ext[1]], code, "EPSG:3857");
          var max = window.ol.proj.transform([ext[2], ext[3]], code, "EPSG:3857");
          return [min[0], min[1], max[0], max[1]];
        }
      }
    } catch (e) { /* cae al respaldo */ }

    // 2) Respaldo: bbox de API-IDEE (suele venir en lon/lat o en la proj del
    //    mapa según la impl). Lo tratamos como lon/lat y reproyectamos a 3857.
    try {
      var b = this.map.getBbox();
      if (b && window.ol) {
        var mn = window.ol.proj.transform([b.x.min, b.y.min], "EPSG:4326", "EPSG:3857");
        var mx = window.ol.proj.transform([b.x.max, b.y.max], "EPSG:4326", "EPSG:3857");
        return [mn[0], mn[1], mx[0], mx[1]];
      }
    } catch (e) { /* nada */ }
    return null;
  };

  // Autodetecta el huso UTM ETRS89 (EPSG:25828..25831) a partir del centro del
  // bbox de búsqueda (en 3857). La SALIDA del proceso viene en UTM ETRS89, no en
  // 3857; el huso no se declara en la respuesta y se deduce por la longitud.
  detectUTMZone(bbox3857) {
    var lonC = 0;
    try {
      if (bbox3857 && window.ol) {
        var cx = (bbox3857[0] + bbox3857[2]) / 2;
        var cy = (bbox3857[1] + bbox3857[3]) / 2;
        var ll = window.ol.proj.transform([cx, cy], "EPSG:3857", "EPSG:4326");
        lonC = ll[0];
      }
    } catch (e) { lonC = -3; /* por defecto, centro peninsular */ }
    // Huso UTM estándar y recorte a los husos usados en España (28..31).
    var zone = Math.floor((lonC + 180) / 6) + 1;
    if (zone < 28) zone = 28;
    if (zone > 31) zone = 31;
    return "EPSG:" + (25800 + zone);
  };

  // Convierte una fecha de <input type="date"> (yyyy-mm-dd) al formato dd/mm/yyyy
  // que espera el proceso bsq-fotogramas.
  toApiDate(isoDate) {
    if (!isoDate) return "";
    var p = String(isoDate).split("-");
    if (p.length !== 3) return "";
    return p[2] + "/" + p[1] + "/" + p[0];
  };

  // Lanza la búsqueda contra el proceso OGC bsq-fotogramas con el área visible
  // y el rango de fechas del panel. Al recibir la respuesta, normaliza los
  // fotogramas a filas internas y pinta el vuelo. Maneja errores de red/CORS.
  fetchOGCFotogramas() {
    var self = this;
    var d = this.data;

    var desde = this.toApiDate(d.ogc.fechaDesde);
    var hasta = this.toApiDate(d.ogc.fechaHasta);
    if (!desde || !hasta) {
      this.setStatus("Indica el rango de fechas (desde y hasta).", "error");
      return;
    }

    var bbox = this.getMapBBox3857();
    if (!bbox) {
      this.setStatus("No se pudo obtener el área visible del mapa.", "error");
      return;
    }

    // Huso detectado para interpretar la salida (fotocentros en UTM ETRS89).
    d.crs = this.detectUTMZone(bbox);

    var body = {
      inputs: {
        completo: true,
        fecha: desde + "-" + hasta,
        formatogeom: "bbox",
        geom: [bbox[0], bbox[1], bbox[2], bbox[3]]
      }
    };

    this.setStatus("Buscando fotogramas en el IGN…");
    var btn = this.panel && this.panel.querySelector("#vf-ogc-buscar");
    if (btn) btn.disabled = true;

    fetch(OGC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.text().then(function (t) {
            throw new Error("HTTP " + resp.status + (t ? " - " + t.slice(0, 200) : ""));
          });
        }
        return resp.json();
      })
      .then(function (data) {
        self.onOGCResponse(data);
      })
      .catch(function (err) {
        self.setStatus("Error consultando el IGN: " + err.message +
          " (puede ser CORS o el servicio no disponible).", "error");
      })
      .then(function () {
        if (btn) btn.disabled = false;
      });
  };

  // Procesa la respuesta del proceso: extrae el array de fotogramas, lo mapea a
  // filas internas y renderiza. La respuesta es { id, fotogramas: [ {...} ] }.
  onOGCResponse(data) {
    var fot = data && data.fotogramas;
    if (!Array.isArray(fot)) {
      this.setStatus("Respuesta inesperada del servicio (sin 'fotogramas').", "error");
      return;
    }
    if (!fot.length) {
      this.setStatus("No se han encontrado fotogramas para esa zona y fechas.", "error");
      return;
    }

    var max = this.data.ogc.max || OGC_MAX_DEFAULT;
    var recortado = fot.length > max;
    var usados = recortado ? fot.slice(0, max) : fot;

    this.mapOGCToRows(usados);

    var aviso = recortado ? (" (mostrando los primeros " + max + " de " + fot.length + ")") : "";
    this.setStatus(usados.length + " fotogramas recibidos" + aviso + ". Visualizando…", "ok");
    this.render();
  };

  // Normaliza los fotogramas OGC (campos del IGN) al modelo interno de filas,
  // reutilizando el mismo pipeline de render que el CSV. La 'pasada' se deriva
  // del nom_fichero (prefijo antes del número de fotograma), y se conserva el
  // giro kappa (radianes) para la rotación opcional de la huella.
  mapOGCToRows(fotogramas) {
    var d = this.data;
    var COL = {
      id: "id", pasada: "pasada", x: "x", y: "y", z: "z",
      fecha: "fecha", sensor: "sensor", nom_fichero: "nom_fichero", kappa: "kappa"
    };
    var rows = [];
    for (var i = 0; i < fotogramas.length; i++) {
      var f = fotogramas[i] || {};
      var nom = f.nom_fichero != null ? String(f.nom_fichero) : "";
      rows.push({
        id: f.id_copia_digital != null ? f.id_copia_digital : (nom || (i + 1)),
        pasada: self_pasadaFromNom(nom),
        x: f.x_fotocentro_at,
        y: f.y_fotocentro_at,
        z: f.z_fotocentro_at,
        fecha: f.fecha_fotograma || null,
        sensor: null,
        nom_fichero: nom,
        kappa: (typeof f.giro_k_at === "number") ? f.giro_k_at : null
      });
    }

    // Modelo interno: fuente OGC con mapeo 1:1 (columnas ya normalizadas).
    d.source = "ogc";
    d.headers = Object.keys(COL);
    d.rows = rows;
    d.mapping = COL;
    window.__vueloSharedData = d;

    // Muestra las secciones de configuración (footprint, capas, acciones). El
    // mapeo de columnas se mantiene oculto en OGC (columnas ya normalizadas).
    this.showConfigSections(true);

    // Deriva "pasada" desde el nombre del fotograma: quita el sufijo del número
    // de fotograma para agrupar por línea de vuelo (heurística sobre nom_fichero).
    function self_pasadaFromNom(nom) {
      if (!nom) return "sin pasada";
      // p.ej. h50_0778_fot_54-2670_cog -> pasada "h50_0778_fot_54"
      var m = nom.match(/^(.*?)-\d+/);
      return m ? m[1] : nom;
    }
  };

  // ###################################################################
  //  CONSTRUCCIÓN DE GEOJSON (reproyección + geometrías)
  // ###################################################################

  // Reproyecta [x,y] del CRS origen a [lon,lat] WGS84. Si el CRS es 4326,
  // devuelve tal cual. Requiere proj4 para CRS proyectados.
  toLonLat(x, y, crs) {
    if (crs === "EPSG:4326") return [x, y];
    if (typeof proj4 === "undefined") return [x, y]; // sin proj4, asume ya lon/lat
    var preset = CRS_PRESETS.filter(function (c) { return c.code === crs; })[0];
    if (!preset || !preset.def) return [x, y];
    try {
      return proj4(preset.def, "EPSG:4326", [x, y]);
    } catch (e) {
      return [x, y];
    }
  };

  // Convierte los datos importados en tres FeatureCollections GeoJSON.
  buildGeoJSON() {
    var d = this.data;
    var m = d.mapping;
    if (!d.rows || !m.x || !m.y) {
      return { error: "Debes mapear al menos las columnas X e Y." };
    }

    var self = this;
    var puntos = [];       // features Point
    var pasadas = {};      // pasadaId -> array de [lon,lat] ordenados
    var footprints = [];   // features Polygon
    var invalid = 0;

    for (var i = 0; i < d.rows.length; i++) {
      var row = d.rows[i];
      var x = parseFloat(String(row[m.x]).replace(",", "."));
      var y = parseFloat(String(row[m.y]).replace(",", "."));
      if (isNaN(x) || isNaN(y)) { invalid++; continue; }

      var ll = self.toLonLat(x, y, d.crs);
      var lon = ll[0], lat = ll[1];
      if (isNaN(lon) || isNaN(lat)) { invalid++; continue; }

      var z = m.z ? parseFloat(String(row[m.z]).replace(",", ".")) : NaN;
      var idVal = m.id ? row[m.id] : String(i + 1);
      var pasadaVal = m.pasada ? String(row[m.pasada]) : "sin pasada";

      var props = {
        id: idVal,
        pasada: pasadaVal,
        z: isNaN(z) ? null : z,
        fecha: m.fecha ? row[m.fecha] : null,
        sensor: m.sensor ? row[m.sensor] : null
      };

      // Datos específicos de la fuente OGC (fotogramas del IGN): nombre del
      // fichero y enlace a la Fototeca Digital para consultarlo/descargarlo.
      // (Gancho para el futuro visor de la imagen COG.)
      if (m.nom_fichero && row[m.nom_fichero]) {
        var nom = String(row[m.nom_fichero]);
        props.nom_fichero = nom;
        props.fototeca = FOTOTECA_URL;
      }
      if (m.kappa && row[m.kappa] != null && row[m.kappa] !== "") {
        props.kappa = row[m.kappa];
      }

      puntos.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: props
      });

      if (!pasadas[pasadaVal]) pasadas[pasadaVal] = [];
      pasadas[pasadaVal].push([lon, lat]);

      // Footprint (rectángulo aproximado alrededor del centro). Si la fuente es
      // OGC y el usuario lo pide, se rota con el giro kappa del fotograma.
      var kappa = (m.kappa && row[m.kappa] != null && row[m.kappa] !== "")
        ? parseFloat(String(row[m.kappa]).replace(",", "."))
        : null;
      var fp = self.footprintPolygon(lon, lat, z, i, kappa);
      if (fp) footprints.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [fp] }, properties: props });
    }

    // Líneas de pasada.
    var lineas = [];
    Object.keys(pasadas).forEach(function (pid) {
      var coords = pasadas[pid];
      if (coords.length >= 2) {
        lineas.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: { pasada: pid }
        });
      }
    });

    return {
      puntos: { type: "FeatureCollection", features: puntos },
      lineas: { type: "FeatureCollection", features: lineas },
      footprints: { type: "FeatureCollection", features: footprints },
      pasadaIds: Object.keys(pasadas),
      invalid: invalid,
      count: puntos.length
    };
  };

  // Calcula el rectángulo de huella en el suelo. Tamaño en el suelo:
  //   S_x = altura * sensor_w / focal ;  S_y = altura * sensor_h / focal
  // Devuelve un anillo cerrado de 5 puntos [lon,lat] centrado en (lon,lat).
  footprintPolygon(lon, lat, z, index, kappa) {
    var fp = this.data.footprint;
    if (!fp || !fp.focal_mm) return null;
    var altura = fp.altura_m;
    // Si el dato trae Z y el usuario lo permite, aproximamos AGL con Z (no hay
    // MDT en cliente; el usuario controla la altura base). Mantener simple: si
    // usarZ y hay Z, usamos Z como altura de vuelo (interpretación conservadora).
    if (fp.usarZ && z !== null && z !== undefined && !isNaN(z) && z > 0) altura = z;
    if (!altura || altura <= 0) return null;

    var Sx = altura * (fp.sensor_w_mm / fp.focal_mm); // metros ancho total
    var Sy = altura * (fp.sensor_h_mm / fp.focal_mm); // metros alto total
    var halfX = Sx / 2, halfY = Sy / 2;

    // Esquinas del rectángulo en metros respecto al centro (antes de rotar).
    var corners = [
      [-halfX, -halfY],
      [halfX, -halfY],
      [halfX, halfY],
      [-halfX, halfY]
    ];

    // Rotación en plano por el giro kappa (radianes) si procede. Solo se aplica
    // cuando hay kappa (fuente OGC) y el usuario lo ha activado. Convención
    // fotogramétrica: kappa es el giro alrededor del eje vertical; para orientar
    // la huella en el suelo aplicamos la rotación 2D inversa (-kappa) de modo
    // que un kappa positivo gire la huella en sentido horario sobre el mapa.
    var useKappa = this.data.rotarKappa && this.data.source === "ogc" &&
      (kappa !== null && kappa !== undefined && !isNaN(kappa));
    if (useKappa) {
      var ang = -kappa;
      var cs = Math.cos(ang), sn = Math.sin(ang);
      for (var c = 0; c < corners.length; c++) {
        var mx = corners[c][0], my = corners[c][1];
        corners[c] = [mx * cs - my * sn, mx * sn + my * cs];
      }
    }

    // Conversión metros -> grados en el punto (aprox. esférica).
    var mPerDegLat = 111320.0;
    var mPerDegLon = 111320.0 * Math.cos(lat * Math.PI / 180);
    if (mPerDegLon < 1e-6) mPerDegLon = 1e-6;

    var ring = [];
    for (var k = 0; k < corners.length; k++) {
      ring.push([lon + corners[k][0] / mPerDegLon, lat + corners[k][1] / mPerDegLat]);
    }
    ring.push(ring[0].slice()); // cierra el anillo
    return ring;
  };

  // Color por pasada (índice cíclico en la paleta).
  colorForPasada(pasadaId, pasadaIds) {
    var idx = pasadaIds.indexOf(pasadaId);
    if (idx < 0) idx = 0;
    return PALETA[idx % PALETA.length];
  };

  // ###################################################################
  //  RENDER EN EL MAPA (capas GeoJSON API-IDEE)
  // ###################################################################
  render() {
    var IDEE = api();
    if (!this.map || !IDEE) return;
    if (!this.data.rows) return; // nada importado todavía

    var gj = this.buildGeoJSON();
    if (gj.error) { this.setStatus(gj.error, "error"); return; }

    this.removeLayers();

    var self = this;

    // --- Capa de footprints (debajo de las líneas y puntos) ---
    if (gj.footprints.features.length) {
      var capaFP = new IDEE.layer.GeoJSON({
        name: "Huellas de fotograma",
        source: gj.footprints,
        legend: "Huellas de fotograma",
        extract: true
      }, { visibility: !!this.data.visible.footprints });
      capaFP.setStyle(new IDEE.style.Generic({
        polygon: {
          fill: { color: "#3b6fd4", opacity: 0.08 },
          stroke: { color: "#3b6fd4", width: 1, opacity: 0.6 }
        }
      }));
      this.map.addLayers(capaFP);
      this._layers.footprints = capaFP;
    }

    // --- Capa de líneas de pasada ---
    if (gj.lineas.features.length) {
      var capaLin = new IDEE.layer.GeoJSON({
        name: "Líneas de pasada",
        source: gj.lineas,
        legend: "Líneas de pasada",
        extract: true
      }, { visibility: !!this.data.visible.lineas });
      capaLin.setStyle(new IDEE.style.Generic({
        line: { stroke: { color: "#e6194b", width: 2, opacity: 0.9 } }
      }));
      this.map.addLayers(capaLin);
      this._layers.lineas = capaLin;
    }

    // --- Capa de centros de fotograma (puntos) ---
    var capaPtos = new IDEE.layer.GeoJSON({
      name: "Centros de fotograma",
      source: gj.puntos,
      legend: "Centros de fotograma",
      extract: true
    }, { visibility: !!this.data.visible.puntos });
    capaPtos.setStyle(new IDEE.style.Generic({
      point: {
        radius: 4,
        fill: { color: "#f58231", opacity: 0.9 },
        stroke: { color: "#7a3b00", width: 1 }
      }
    }));
    this.map.addLayers(capaPtos);
    this._layers.puntos = capaPtos;

    // Encuadre a los datos usando SOLO la API-IDEE (uniforme en OL y Cesium).
    this.zoomToData(capaPtos);

    var extra = gj.invalid ? (" (" + gj.invalid + " filas sin coordenadas válidas)") : "";
    this.setStatus("Vuelo visualizado: " + gj.count + " fotogramas, " +
      gj.pasadaIds.length + " pasadas" + extra + ".", "ok");
  };

  // Ajusta la vista al extent de la capa de puntos con la API-IDEE. El mismo
  // código vale para OpenLayers y Cesium: map.setBbox + layer.getFeaturesExtent
  // están abstraídos por la API (patrón usado en GJSONdesdeURL / CaminoDeLosFaros).
  zoomToData(capaPuntos) {
    if (!this.map || !capaPuntos) return;
    var self = this;
    var doFit = function () {
      try {
        var ext = capaPuntos.getFeaturesExtent();
        if (!ext) return false;
        self.map.setBbox(ext);
        self.map.setZoom(self.map.getZoom() - 0.5);
        return true;
      } catch (e) { return false; }
    };
    // Las features pueden tardar en cargarse en la capa; reintenta unas veces.
    if (doFit()) return;
    var tries = 20;
    (function poll() {
      if (doFit() || --tries <= 0) return;
      setTimeout(poll, 250);
    })();
  };

  applyVisibility() {
    var d = this.data;
    if (this._layers.puntos) try { this._layers.puntos.setVisible(!!d.visible.puntos); } catch (e) {}
    if (this._layers.lineas) try { this._layers.lineas.setVisible(!!d.visible.lineas); } catch (e) {}
    if (this._layers.footprints) try { this._layers.footprints.setVisible(!!d.visible.footprints); } catch (e) {}
  };

  removeLayers() {
    var self = this;
    ["footprints", "lineas", "puntos"].forEach(function (k) {
      var lyr = self._layers[k];
      if (lyr) {
        try { self.map.removeLayers(lyr); } catch (e) { /* ignora */ }
        self._layers[k] = null;
      }
    });
  };

  clearData() {
    this.removeLayers();
    this.data.rows = null;
    this.data.headers = null;
    this.data.mapping = {};
    window.__vueloSharedData = this.data;
    this.showConfigSections(false);
    var input = this.panel && this.panel.querySelector("#vf-file");
    if (input) input.value = "";
    this.setStatus("Datos limpiados. Carga un nuevo archivo.");
  };

  // ---- Ciclo de vida ------------------------------------------------------
  // cleanup: se llama cuando cambioImpl recrea el mapa. Quitamos las capas y el
  // panel del mapa antiguo (el nuevo mapa/instancia los re-crea), pero
  // conservamos los DATOS en memoria (this.data / window.__vueloSharedData),
  // que la nueva instancia re-hidrata en syncUIFromData.
  cleanup() {
    this.removeLayers();
    // Soltar el panel del mapa anterior (protocolo: como destroy de layerswitcher).
    try {
      if (this.map && this._iueePanel && this.map.removePanel) {
        this.map.removePanel(this._iueePanel);
      }
    } catch (e) { /* el div del mapa suele destruirse con el swap; ignora */ }
    this._iueePanel = null;
  }

  destroy() {
    this.cleanup();
    if (window.__vueloActivePlugin === this) window.__vueloActivePlugin = null;
  }

  getAPIRest() { return ""; }
  }

  // Exponer la clase como GLOBAL DIRECTO (window.miPlugin_vueloFotogrametrico):
  // el plugin cambioImpl recarga el bundle de la API al alternar OL<->Cesium, lo
  // que reinicializa IDEE.plugin (borrando este registro). El global directo NO
  // se borra con el swap, así mapa.js puede instanciarlo tras el cambio.
  window.miPlugin_vueloFotogrametrico = miPlugin_vueloFotogrametrico;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_vueloFotogrametrico = miPlugin_vueloFotogrametrico;
  if (window.M) {
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_vueloFotogrametrico = miPlugin_vueloFotogrametrico;
  }
})();
