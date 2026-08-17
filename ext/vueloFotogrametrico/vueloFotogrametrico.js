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

   El panel de importación (#vuelo-controls) se inyecta en document.body
   (position:absolute), de modo que SOBREVIVE al ciclo destruir/recrear del
   div del mapa que hace miPlugin_cambioImpl al alternar OL <-> Cesium.
   Cada vez que cambioImpl recrea el mapa se instancia de nuevo este plugin;
   un singleton guard (window.__vueloActivePlugin) reengancha el panel al
   nuevo mapa y RE-PINTA los datos ya importados (que viven en memoria en el
   propio plugin), sin volver a pedir el fichero.

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

  // ###################################################################
  //  SHELL DEL PLUGIN
  // ###################################################################
  function miPlugin_vueloFotogrametrico(options) {
    this.name = "miPlugin_vueloFotogrametrico";
    this.options = options || {};
    this.map = null;
    this.panel = null;

    // Estado de datos importados (persiste entre swaps OL<->Cesium).
    // rows: array de objetos {col: valor}. headers: nombres de columna.
    // mapping: {campoLogico: nombreColumna}. crs: código EPSG origen.
    // footprint: parámetros de cámara/altura para el rectángulo.
    this.data = (window.__vueloSharedData) || {
      rows: null,
      headers: null,
      mapping: {},
      crs: "EPSG:25830",
      footprint: { focal_mm: 100, sensor_w_mm: 53.4, sensor_h_mm: 40.0, altura_m: 3000, usarZ: true },
      visible: { puntos: true, lineas: true, footprints: false }
    };
    // Compartimos el estado a nivel de ventana para que sobreviva a la
    // recreación de la instancia por cambioImpl.
    window.__vueloSharedData = this.data;

    this._layers = { puntos: null, lineas: null, footprints: null };
  }

  // Nota: todo el render y el encuadre usan EXCLUSIVAMENTE métodos de API-IDEE
  // (IDEE.layer.GeoJSON, setStyle, extract, map.setBbox, layer.getFeaturesExtent),
  // que están abstraídos por la API => el comportamiento es idéntico en las dos
  // implementaciones (OpenLayers 2D y Cesium 3D) sin código específico por motor.

  miPlugin_vueloFotogrametrico.prototype.addTo = function (map) {
    this.map = map;

    // Singleton guard: limpia la instancia anterior (cambioImpl crea una nueva
    // por cada cambio de implementación y deja la anterior colgada).
    if (window.__vueloActivePlugin && window.__vueloActivePlugin !== this) {
      try { window.__vueloActivePlugin.cleanup(); } catch (e) { /* ignora */ }
    }
    window.__vueloActivePlugin = this;

    this.createOrReusePanel();
    this.bindPanelEvents();
    this.syncUIFromData();

    // Si ya había datos importados (venimos de un swap), re-pinta al estar listo.
    var self = this;
    var IDEE = api();
    var repintar = function () { self.render(); };
    try { this.map.on(IDEE.evt.COMPLETED, repintar); } catch (e) { /* ignora */ }
    // Reintento por si COMPLETED ya se disparó.
    setTimeout(repintar, 800);
  };

  // ---- Panel: se crea una sola vez en document.body y se reutiliza. --------
  miPlugin_vueloFotogrametrico.prototype.createOrReusePanel = function () {
    var panel = document.getElementById("vuelo-controls");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "vuelo-controls";
      panel.innerHTML = this.buildPanelHTML();
      document.body.appendChild(panel);
    }
    this.panel = panel;
    // El popup de los fotogramas lo aporta la propia API-IDEE (extract:true al
    // crear las capas GeoJSON), que funciona igual en OpenLayers y en Cesium.
    // No necesitamos un popup propio ni tratar cada implementación por separado.
  };

  miPlugin_vueloFotogrametrico.prototype.buildPanelHTML = function () {
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
      '<div class="vuelo-header">' +
      '  <span class="vuelo-title">Vuelo fotogramétrico</span>' +
      '  <button type="button" id="vf-collapse" class="vuelo-collapse" title="Contraer/expandir">▾</button>' +
      '</div>' +
      '<div class="vuelo-body" id="vf-body">' +
      '  <div class="vuelo-drop" id="vf-drop">' +
      '    Arrastra aquí un <strong>CSV</strong> o <strong>Excel</strong><br>o haz clic para elegir archivo' +
      '    <input type="file" id="vf-file" accept=".csv,.txt,.xlsx,.xls">' +
      '  </div>' +
      '  <div class="vuelo-status" id="vf-status"></div>' +

      '  <div class="vuelo-section" id="vf-section-map" hidden>' +
      '    <span class="vuelo-section-title">Mapeo de columnas</span>' +
      '    <div class="vuelo-row">' +
      '      <label for="vf-crs">CRS origen</label>' +
      '      <select id="vf-crs">' + crsOptions + '</select>' +
      '    </div>' +
      mapRows +
      '  </div>' +

      '  <div class="vuelo-section" id="vf-section-fp" hidden>' +
      '    <span class="vuelo-section-title">Huella / footprint</span>' +
      '    <div class="vuelo-row"><label for="vf-fp-focal">Focal (mm)</label><input type="number" id="vf-fp-focal" step="1" min="1"></div>' +
      '    <div class="vuelo-row"><label for="vf-fp-sw">Sensor ancho (mm)</label><input type="number" id="vf-fp-sw" step="0.1" min="0.1"></div>' +
      '    <div class="vuelo-row"><label for="vf-fp-sh">Sensor alto (mm)</label><input type="number" id="vf-fp-sh" step="0.1" min="0.1"></div>' +
      '    <div class="vuelo-row"><label for="vf-fp-alt">Altura vuelo AGL (m)</label><input type="number" id="vf-fp-alt" step="10" min="1"></div>' +
      '    <label class="vuelo-check"><input type="checkbox" id="vf-fp-usez"> Usar Z del dato como altura si existe</label>' +
      '  </div>' +

      '  <div class="vuelo-section" id="vf-section-layers" hidden>' +
      '    <span class="vuelo-section-title">Capas</span>' +
      '    <label class="vuelo-check"><input type="checkbox" id="vf-lyr-puntos" checked> Centros de fotograma</label>' +
      '    <label class="vuelo-check"><input type="checkbox" id="vf-lyr-lineas" checked> Líneas de pasada</label>' +
      '    <label class="vuelo-check"><input type="checkbox" id="vf-lyr-footprints"> Huellas de fotograma</label>' +
      '  </div>' +

      '  <div class="vuelo-section" id="vf-section-actions" hidden>' +
      '    <button type="button" id="vf-render" class="vuelo-btn primary">Visualizar vuelo</button>' +
      '    <button type="button" id="vf-clear" class="vuelo-btn">Limpiar</button>' +
      '  </div>' +
      '</div>';
  };

  // ---- Enlace de eventos del panel ---------------------------------------
  miPlugin_vueloFotogrametrico.prototype.bindPanelEvents = function () {
    var self = this;
    var p = this.panel;

    // Clonamos nodos interactivos antes de reenganchar, para no acumular
    // listeners de instancias previas tras un swap.
    function rebind(id, evt, handler) {
      var el = p.querySelector("#" + id);
      if (!el) return null;
      var fresh = el.cloneNode(true);
      el.parentNode.replaceChild(fresh, el);
      fresh.addEventListener(evt, handler);
      return fresh;
    }

    rebind("vf-collapse", "click", function () {
      var body = p.querySelector("#vf-body");
      if (!body) return;
      var hidden = body.hasAttribute("hidden");
      if (hidden) { body.removeAttribute("hidden"); this.textContent = "▾"; }
      else { body.setAttribute("hidden", ""); this.textContent = "▸"; }
    });

    var drop = rebind("vf-drop", "click", function () {
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

    rebind("vf-file", "change", function () {
      if (this.files && this.files.length) self.handleFile(this.files[0]);
    });

    rebind("vf-crs", "change", function () { self.data.crs = this.value; });

    // Selects de mapeo de columnas.
    CAMPOS.forEach(function (c) {
      rebind("vf-col-" + c.key, "change", function () {
        self.data.mapping[c.key] = this.value || null;
      });
    });

    // Parámetros de footprint.
    rebind("vf-fp-focal", "change", function () { self.data.footprint.focal_mm = parseFloat(this.value) || 0; });
    rebind("vf-fp-sw", "change", function () { self.data.footprint.sensor_w_mm = parseFloat(this.value) || 0; });
    rebind("vf-fp-sh", "change", function () { self.data.footprint.sensor_h_mm = parseFloat(this.value) || 0; });
    rebind("vf-fp-alt", "change", function () { self.data.footprint.altura_m = parseFloat(this.value) || 0; });
    rebind("vf-fp-usez", "change", function () { self.data.footprint.usarZ = this.checked; });

    // Visibilidad de capas.
    rebind("vf-lyr-puntos", "change", function () { self.data.visible.puntos = this.checked; self.applyVisibility(); });
    rebind("vf-lyr-lineas", "change", function () { self.data.visible.lineas = this.checked; self.applyVisibility(); });
    rebind("vf-lyr-footprints", "change", function () { self.data.visible.footprints = this.checked; self.applyVisibility(); });

    // Acciones.
    rebind("vf-render", "click", function () { self.render(); });
    rebind("vf-clear", "click", function () { self.clearData(); });
  };

  // Refleja el estado de datos en la UI (tras un swap, o al reabrir).
  miPlugin_vueloFotogrametrico.prototype.syncUIFromData = function () {
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
    var vp = p.querySelector("#vf-lyr-puntos"); if (vp) vp.checked = !!d.visible.puntos;
    var vl = p.querySelector("#vf-lyr-lineas"); if (vl) vl.checked = !!d.visible.lineas;
    var vf = p.querySelector("#vf-lyr-footprints"); if (vf) vf.checked = !!d.visible.footprints;

    // Si ya hay cabeceras cargadas (venimos de un swap), rellena los selects.
    if (d.headers && d.headers.length) {
      this.fillColumnSelects(d.headers, d.mapping);
      this.showConfigSections(true);
    }
  };

  // ---- Estado / mensajes -------------------------------------------------
  miPlugin_vueloFotogrametrico.prototype.setStatus = function (msg, cls) {
    var el = this.panel && this.panel.querySelector("#vf-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "vuelo-status" + (cls ? " " + cls : "");
  };

  miPlugin_vueloFotogrametrico.prototype.showConfigSections = function (on) {
    var ids = ["#vf-section-map", "#vf-section-fp", "#vf-section-layers", "#vf-section-actions"];
    var p = this.panel;
    ids.forEach(function (id) {
      var el = p.querySelector(id);
      if (el) { if (on) el.removeAttribute("hidden"); else el.setAttribute("hidden", ""); }
    });
  };

  // ###################################################################
  //  CARGA Y PARSEO DE FICHERO (solo cliente)
  // ###################################################################
  miPlugin_vueloFotogrametrico.prototype.handleFile = function (file) {
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
  miPlugin_vueloFotogrametrico.prototype.parseCSV = function (text) {
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
  miPlugin_vueloFotogrametrico.prototype.ingestMatrix = function (matrix) {
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
  miPlugin_vueloFotogrametrico.prototype.autodetectMapping = function (headers) {
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
  miPlugin_vueloFotogrametrico.prototype.fillColumnSelects = function (headers, mapping) {
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
  //  CONSTRUCCIÓN DE GEOJSON (reproyección + geometrías)
  // ###################################################################

  // Reproyecta [x,y] del CRS origen a [lon,lat] WGS84. Si el CRS es 4326,
  // devuelve tal cual. Requiere proj4 para CRS proyectados.
  miPlugin_vueloFotogrametrico.prototype.toLonLat = function (x, y, crs) {
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
  miPlugin_vueloFotogrametrico.prototype.buildGeoJSON = function () {
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

      puntos.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: props
      });

      if (!pasadas[pasadaVal]) pasadas[pasadaVal] = [];
      pasadas[pasadaVal].push([lon, lat]);

      // Footprint (rectángulo aproximado alrededor del centro).
      var fp = self.footprintPolygon(lon, lat, z, i);
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
  miPlugin_vueloFotogrametrico.prototype.footprintPolygon = function (lon, lat, z, index) {
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

    // Conversión metros -> grados en el punto (aprox. esférica).
    var mPerDegLat = 111320.0;
    var mPerDegLon = 111320.0 * Math.cos(lat * Math.PI / 180);
    if (mPerDegLon < 1e-6) mPerDegLon = 1e-6;

    var dLon = halfX / mPerDegLon;
    var dLat = halfY / mPerDegLat;

    return [
      [lon - dLon, lat - dLat],
      [lon + dLon, lat - dLat],
      [lon + dLon, lat + dLat],
      [lon - dLon, lat + dLat],
      [lon - dLon, lat - dLat]
    ];
  };

  // Color por pasada (índice cíclico en la paleta).
  miPlugin_vueloFotogrametrico.prototype.colorForPasada = function (pasadaId, pasadaIds) {
    var idx = pasadaIds.indexOf(pasadaId);
    if (idx < 0) idx = 0;
    return PALETA[idx % PALETA.length];
  };

  // ###################################################################
  //  RENDER EN EL MAPA (capas GeoJSON API-IDEE)
  // ###################################################################
  miPlugin_vueloFotogrametrico.prototype.render = function () {
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
  miPlugin_vueloFotogrametrico.prototype.zoomToData = function (capaPuntos) {
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

  miPlugin_vueloFotogrametrico.prototype.applyVisibility = function () {
    var d = this.data;
    if (this._layers.puntos) try { this._layers.puntos.setVisible(!!d.visible.puntos); } catch (e) {}
    if (this._layers.lineas) try { this._layers.lineas.setVisible(!!d.visible.lineas); } catch (e) {}
    if (this._layers.footprints) try { this._layers.footprints.setVisible(!!d.visible.footprints); } catch (e) {}
  };

  miPlugin_vueloFotogrametrico.prototype.removeLayers = function () {
    var self = this;
    ["footprints", "lineas", "puntos"].forEach(function (k) {
      var lyr = self._layers[k];
      if (lyr) {
        try { self.map.removeLayers(lyr); } catch (e) { /* ignora */ }
        self._layers[k] = null;
      }
    });
  };

  miPlugin_vueloFotogrametrico.prototype.clearData = function () {
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
  // cleanup: se llama cuando cambioImpl recrea el mapa. Quitamos las capas del
  // mapa antiguo (el nuevo mapa las re-pintará), pero conservamos los DATOS en
  // memoria (this.data / window.__vueloSharedData) y el panel en el DOM.
  miPlugin_vueloFotogrametrico.prototype.cleanup = function () {
    this.removeLayers();
  };

  miPlugin_vueloFotogrametrico.prototype.destroy = function () {
    this.cleanup();
    if (window.__vueloActivePlugin === this) window.__vueloActivePlugin = null;
  };

  miPlugin_vueloFotogrametrico.prototype.getAPIRest = function () { return ""; };

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
