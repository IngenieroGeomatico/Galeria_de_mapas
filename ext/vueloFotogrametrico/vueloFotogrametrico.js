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

  // ###################################################################
  //  ensureTurf() — carga bajo demanda de turf.js (geometría de polígonos)
  //  --------------------------------------------------------------------
  //  El modo Cálculo con recorte a una feature necesita operaciones de geometría
  //  de polígonos (buffer, intersección huella∩área, envolvente). En vez de
  //  añadir turf al index.html, el plugin lo inyecta bajo demanda: la primera vez
  //  que se necesita, añade el <script> de turf al <head> y cachea la promesa en
  //  window.__vueloTurfPromise, de modo que NO se reinyecta en cada swap
  //  OL<->Cesium (el global window.turf sobrevive al swap; la promesa también, al
  //  vivir en window). Resuelve con el objeto turf; rechaza si falla la red (el
  //  llamador degrada a recorte por bbox y avisa por el estado del panel).
  // ###################################################################
  var TURF_CDN_URL = "https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js";
  function ensureTurf() {
    // Ya disponible (cargado antes, o entre swaps): resuelve inmediato.
    if (typeof window.turf !== "undefined") return Promise.resolve(window.turf);
    // Carga en curso o completada previamente: reutiliza la misma promesa.
    if (window.__vueloTurfPromise) return window.__vueloTurfPromise;

    window.__vueloTurfPromise = new Promise(function (resolve, reject) {
      // Si ya hay un <script> de turf en el DOM (p.ej. inyectado por otra
      // instancia antes de resolver), engánchate a sus eventos en vez de duplicar.
      var existing = document.querySelector('script[data-vuelo-turf="1"]');
      var script = existing || document.createElement("script");
      var onOk = function () {
        if (typeof window.turf !== "undefined") resolve(window.turf);
        else reject(new Error("turf cargó pero no expuso window.turf"));
      };
      var onErr = function () {
        // Permite reintentar en una llamada futura (no deja la promesa envenenada).
        window.__vueloTurfPromise = null;
        reject(new Error("No se pudo cargar turf.js desde el CDN"));
      };
      script.addEventListener("load", onOk);
      script.addEventListener("error", onErr);
      if (!existing) {
        script.src = TURF_CDN_URL;
        script.async = true;
        script.setAttribute("data-vuelo-turf", "1");
        document.head.appendChild(script);
      }
    });
    return window.__vueloTurfPromise;
  }

  // ###################################################################
  //  VueloGeo — utilidades geométricas PURAS (sin estado, sin mapa, sin DOM)
  //  --------------------------------------------------------------------
  //  Funciones de geodesia/álgebra reutilizadas por el generador demo, el
  //  planificador de cálculo, el constructor de huellas y la animación del
  //  avión. Todas son deterministas y no dependen del estado del plugin ni de
  //  la implementación activa (OpenLayers/Cesium), por lo que se extraen aquí
  //  para poder razonarlas y probarlas de forma aislada. Los métodos del plugin
  //  delegan en este objeto conservando exactamente sus firmas y su semántica.
  // ###################################################################
  var VueloGeo = {
    // Metros por grado de latitud (aprox. esférica) — constante usada en todas
    // las conversiones metros<->grados del plugin.
    M_PER_DEG_LAT: 111320.0,

    // Metros por grado de longitud a una latitud dada (grados). Se acota a un
    // mínimo positivo para evitar divisiones por cero cerca de los polos.
    mPerDegLon: function (lat) {
      var v = VueloGeo.M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180);
      return v < 1e-6 ? 1e-6 : v;
    },

    // Recorta un valor al rango [lo, hi].
    clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },

    // Desplaza [lon,lat] `dist` metros con rumbo `bearingDeg` (0=N, 90=E).
    // Cálculo plano local (aprox. esférica), suficiente para las distancias del
    // plugin. Devuelve [lon, lat].
    offsetLonLat: function (lon, lat, dist, bearingDeg) {
      var rad = bearingDeg * Math.PI / 180;
      var dNorte = dist * Math.cos(rad); // componente norte (m)
      var dEste = dist * Math.sin(rad);  // componente este (m)
      var mLat = VueloGeo.M_PER_DEG_LAT;
      var mLon = VueloGeo.mPerDegLon(lat);
      return [lon + dEste / mLon, lat + dNorte / mLat];
    },

    // Distancia plana aproximada (m) entre dos coords [lon,lat(,z)] (solo XY).
    // Usa turf.distance si está disponible; si no, cálculo manual.
    segMetros: function (a, b) {
      if (typeof turf !== "undefined" && turf.distance) {
        try { return turf.distance([a[0], a[1]], [b[0], b[1]], { units: "meters" }); }
        catch (e) { /* cae al cálculo manual */ }
      }
      var mLat = VueloGeo.M_PER_DEG_LAT;
      var mLon = VueloGeo.mPerDegLon(a[1]);
      var dx = (b[0] - a[0]) * mLon;
      var dy = (b[1] - a[1]) * mLat;
      return Math.sqrt(dx * dx + dy * dy);
    },

    // Rumbo (radianes, horario desde el norte) entre dos coords [lon,lat].
    // Usa turf.bearing si está disponible; si no, cálculo manual (esférico).
    bearingRad: function (a, b) {
      if (typeof turf !== "undefined" && turf.bearing) {
        try { return turf.bearing([a[0], a[1]], [b[0], b[1]]) * Math.PI / 180; }
        catch (e) { /* cae al cálculo manual */ }
      }
      var y = Math.sin((b[0] - a[0]) * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180);
      var x = Math.cos(a[1] * Math.PI / 180) * Math.sin(b[1] * Math.PI / 180) -
        Math.sin(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) *
        Math.cos((b[0] - a[0]) * Math.PI / 180);
      return Math.atan2(y, x);
    },

    // Matriz de rotación fotogramétrica R = Rz(kappa)·Ry(phi)·Rx(omega) que lleva
    // vectores del marco de la cámara al marco del terreno (X=Este, Y=Norte,
    // Z=arriba). Convención estándar (Kraus / manual del IGN de orientación
    // externa). Ángulos en radianes. Devuelve una matriz 3x3 (array de arrays).
    rotationMatrix: function (omega, phi, kappa) {
      var co = Math.cos(omega), so = Math.sin(omega);
      var cp = Math.cos(phi), sp = Math.sin(phi);
      var ck = Math.cos(kappa), sk = Math.sin(kappa);
      return [
        [cp * ck, -cp * sk, sp],
        [co * sk + so * sp * ck, co * ck - so * sp * sk, -so * cp],
        [so * sk - co * sp * ck, so * ck + co * sp * sk, co * cp]
      ];
    }
  };

  // ###################################################################
  //  FlightState — forma y fábrica del ESTADO COMPARTIDO del plugin
  //  --------------------------------------------------------------------
  //  Este estado es el objeto que vive en window.__vueloSharedData y que DEBE
  //  sobrevivir a los swaps OL<->Cesium (cambioImpl recrea el mapa y reinstancia
  //  el plugin en cada cambio; la nueva instancia re-hidrata desde aquí). Por eso
  //  SOLO contiene datos serializables: nada de capas del mapa, entidades de
  //  Cesium, nodos DOM ni instancias de servicios (esos son per-instancia y viven
  //  en propiedades del Shell). getInitialState() centraliza la forma del estado
  //  (antes era un objeto literal gigante en el constructor).
  //
  //    mode: 'hecho' (vuelo ya realizado) | 'demo' | 'calculo'.
  //    source: origen de datos dentro de 'hecho': 'csv' | 'ogc' (o 'demo').
  //    rows: array de objetos {col: valor}. headers: nombres de columna.
  //    mapping: {campoLogico: nombreColumna}. crs: código EPSG origen.
  //    footprint: parámetros de cámara (focal + sensor + nº de píxeles) para
  //      dimensionar la huella y derivar la altura en modo Cálculo.
  //    visible: visibilidad por capa (la gestiona el layerswitcher externo).
  //    ogc/demo/calc: estado propio de cada modo/fuente (ver comentarios inline).
  //    vuelos/vueloSel: lista y selección de la última búsqueda OGC.
  //    anim: progreso de la animación del avión (persiste entre swaps).
  //    zoomDone: ya se encuadró la vista a los datos una vez (respeta la vista
  //      en swaps posteriores en vez de re-encuadrar).
  // ###################################################################
  var FlightState = {
    getInitialState: function () {
      return {
        mode: "hecho",
        source: "ogc",
        rows: null,
        headers: null,
        mapping: {},
        crs: "EPSG:25830",
        // Cámara: focal + tamaño de sensor (mm) y nº de píxeles del sensor (px_w
        // across-track = ancho; px_h along-track = alto). Los píxeles se usan en el
        // modo Cálculo para derivar altura de vuelo desde el GSD (pixel pitch =
        // sensor_mm/n_px; H = GSD·focal/pixel_pitch). Por defecto, Phase One IXU 1000.
        footprint: { focal_mm: 100, sensor_w_mm: 53.4, sensor_h_mm: 40.0, px_w: 11608, px_h: 8708 },
        // Todas las capas visibles por defecto; su visibilidad la gestiona el
        // plugin externo de gestión de capas (layerswitcher).
        visible: { puntos: true, lineas: true, footprints: true },
        ogc: { fechaDesde: "", fechaHasta: "" },
        // Fuente DEMO: generador de vuelo sintético fotograma a fotograma. El
        // primer fotograma de cada pasada se coloca en el CENTRO de la pantalla en
        // ese momento; los siguientes se van añadiendo según rumbo + separación.
        //   params: parámetros de generación (rumbo, separaciones, giros...).
        //   frames: array de {lon,lat,z,pasada,omega,phi,kappa,id} generados.
        //   pasada: índice de pasada actual (empieza en 1); nFrame: contador de
        //   fotogramas de la pasada actual (para el ID legible).
        //   lastPassStart: [lon,lat] del primer fotograma de la pasada actual
        //   (origen para desplazar lateralmente la siguiente "nueva pasada").
        demo: {
          params: {
            rumbo: 0,          // dirección de avance de la pasada (grados, 0=N, 90=E)
            sepFoto: 500,      // separación entre fotogramas consecutivos (m)
            sepPasada: 800,    // separación lateral entre pasadas (m)
            z: 1500,           // altura de vuelo (m) para dimensionar la huella
            omega: 0,          // giro omega por fotograma (grados)
            phi: 0,            // giro phi por fotograma (grados)
            kappa: 0,          // giro kappa por fotograma (grados) -> rota la huella
            // Lado hacia el que se van colocando las pasadas (respecto al rumbo
            // BASE): "der" (rumbo+90) o "izq" (rumbo-90). Determinante para que las
            // pasadas avancen SIEMPRE hacia el mismo lado (evita que la 3ª vuelva
            // sobre la 1ª pese al serpenteo de sentido de vuelo).
            lado: "der"
          },
          frames: [],
          pasada: 1,
          nFrame: 0,
          lastPassStart: null
        },
        // Modo CÁLCULO: planificación de un vuelo nuevo. A partir del área (BBOX de
        // la pantalla o polígono de un feature de capa), el GSD deseado, los solapes
        // y la cámara (footprint), calcula la altura de vuelo y la malla de pasadas
        // y fotogramas que cubren el área, y la dibuja (fotocentros, huellas, líneas).
        //   areaSrc: "bbox" (área visible) | "feature" (polígono de capa).
        //   capa: nombre de la capa elegida cuando areaSrc="feature".
        //   gsd: tamaño de píxel en el terreno deseado (cm).
        //   solapeLong/solapeTrans: solapes longitudinal (entre fotogramas) y
        //   transversal (entre pasadas) en % (0..99).
        //   rumbo: dirección de las pasadas (grados). resultados: última salida.
        calc: {
          areaSrc: "bbox",
          capa: "",
          feature: "",      // índice del feature elegido dentro de la capa ("" = toda)
          gsd: 25,          // cm/píxel deseado en el terreno
          solapeLong: 60,   // % solape longitudinal (entre fotogramas de una pasada)
          solapeTrans: 30,  // % solape transversal (entre pasadas)
          rumbo: 0,         // dirección de las pasadas (grados, 0 = Norte) - override manual
          rumboAuto: true,  // true: rumbo óptimo automático; false: usa 'rumbo' manual
          tolGsd: 10,       // tolerancia de GSD (%) para dividir pasadas a distinta altura
          bufferPct: 10,    // buffer del área (%) al recortar el vuelo a una feature
          resultados: null  // {altura, sepFoto, sepPasada, nPasadas, nFotos, ...}
        },
        // Modo OGC: lista de vuelos agrupados de la última búsqueda y clave del
        // vuelo seleccionado (persisten entre swaps OL<->Cesium).
        vuelos: null,
        vueloSel: null,
        // Animación del avión sobre la línea de vuelo. Persiste entre swaps:
        //   playing: reproduciendo; t: progreso 0..1 a lo largo de la línea.
        anim: { playing: false, t: 0 },
        // zoomDone: ya se ha encuadrado la vista a los datos una vez. Persiste
        // entre swaps OL<->Cesium (vive en window.__vueloSharedData) para que al
        // cambiar de implementación se respete la vista (shareView) en vez de
        // re-encuadrar. Se resetea al cargar/limpiar datos.
        zoomDone: false,
        // Estado de la UI que persiste entre swaps (p.ej. secciones del panel
        // abiertas/cerradas).
        ui: {
          accordion: {}
        }
      };
    }
  };

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

  // ---------------------------------------------------------------------
  //  CÁMARAS FOTOGRAMÉTRICAS predefinidas para el desplegable de preset.
  //  --------------------------------------------------------------------
  //  Los pliegos técnicos del PNOA (IGN/CNIG) NO imponen un modelo de cámara:
  //  fijan el GSD del vuelo y requisitos de rendimiento, y cada empresa declara
  //  marca/modelo con su certificado de calibración. Estos presets son las
  //  cámaras matriciales de gran formato más habituales en campañas PNOA
  //  (familias Vexcel UltraCam y Z/I·Leica DMC) más un par de equipos de formato
  //  medio/UAV. Valores derivados de cameras.json del plugin QGIS flight_planner
  //  de J. M. Garrido (JMG30), autor de las especificaciones técnicas del PNOA:
  //    sensor_mm = nº_píxeles * tamaño_píxel(µm)/1000
  //    ancho = across-track (perpendicular al vuelo); alto = along-track (vuelo).
  //  focal_mm = distancia focal de la lente instalada. El usuario puede editar
  //  cualquier valor tras elegir un preset, o añadir cámaras propias (que se
  //  guardan en localStorage) desde el botón "Añadir cámara".
  // Cada preset lleva ademas el numero de pixeles del sensor (px_w = across-track
  // = ancho; px_h = along-track = alto), necesario para el modo Calculo: el
  // tamano de pixel = sensor_mm / n_pixeles, y la altura de vuelo H = GSD * focal
  // / pixel_pitch. Valores de cameras.json del plugin flight_planner (JMG30).
  var CAMARA_PRESETS = [
    { name: "Vexcel UltraCam-D",        focal_mm: 100, sensor_w_mm: 103.5, sensor_h_mm: 67.5, px_w: 11500, px_h: 7500 },
    { name: "Vexcel UltraCam-X",        focal_mm: 100, sensor_w_mm: 103.9, sensor_h_mm: 67.8, px_w: 14430, px_h: 9420 },
    { name: "Vexcel UltraCam-Xp",       focal_mm: 100, sensor_w_mm: 103.9, sensor_h_mm: 67.9, px_w: 17310, px_h: 11310 },
    { name: "Vexcel UltraCam Eagle 80mm",  focal_mm: 80,  sensor_w_mm: 104.1, sensor_h_mm: 68.0, px_w: 20010, px_h: 13080 },
    { name: "Vexcel UltraCam Eagle 210mm", focal_mm: 210, sensor_w_mm: 104.1, sensor_h_mm: 68.0, px_w: 20010, px_h: 13080 },
    { name: "Z/I·Leica DMC II 140",     focal_mm: 92,  sensor_w_mm: 87.1,  sensor_h_mm: 80.6, px_w: 12096, px_h: 11200 },
    { name: "Z/I·Leica DMC II 230",     focal_mm: 92,  sensor_w_mm: 87.1,  sensor_h_mm: 79.2, px_w: 15552, px_h: 14140 },
    { name: "Z/I·Leica DMC II 250",     focal_mm: 92,  sensor_w_mm: 93.9,  sensor_h_mm: 78.5, px_w: 16768, px_h: 14016 },
    { name: "Leica DMC III",            focal_mm: 92,  sensor_w_mm: 100.3, sensor_h_mm: 56.9, px_w: 25728, px_h: 14592 },
    { name: "Phase One IXU 1000",       focal_mm: 55,  sensor_w_mm: 53.4,  sensor_h_mm: 40.1, px_w: 11608, px_h: 8708 },
    { name: "DJI Zenmuse P1 (35mm)",    focal_mm: 35,  sensor_w_mm: 36.0,  sensor_h_mm: 24.0, px_w: 8192,  px_h: 5460 }
  ];

  // Clave de localStorage donde se guardan las cámaras que añade el usuario.
  var CAMARA_STORE_KEY = "vueloFotogrametrico:camarasUsuario";

  // ###################################################################
  //  CameraStore — persistencia y catálogo de cámaras fotogramétricas
  //  --------------------------------------------------------------------
  //  Encapsula el acceso a localStorage para las cámaras que añade el usuario y
  //  la combinación con los presets fijos (CAMARA_PRESETS). No toca el mapa ni el
  //  DOM: es un servicio sin estado propio (la única fuente de verdad de las
  //  cámaras de usuario es localStorage). La UI del plugin (fillCameraSelect,
  //  applyCameraPreset, saveNewCamera) consulta este servicio.
  // ###################################################################
  var CameraStore = {
    // Lee del localStorage el array de cámaras añadidas por el usuario (o []).
    loadUser: function () {
      try {
        var raw = window.localStorage.getItem(CAMARA_STORE_KEY);
        var arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },

    // Persiste en localStorage el array de cámaras añadidas por el usuario.
    saveUser: function (arr) {
      try { window.localStorage.setItem(CAMARA_STORE_KEY, JSON.stringify(arr || [])); }
      catch (e) { /* almacenamiento no disponible: se ignora */ }
    },

    // Todas las cámaras disponibles: presets fijos + las del usuario (marcadas
    // con user:true). Normaliza la forma de las de usuario para uniformidad.
    getAll: function () {
      var user = CameraStore.loadUser().map(function (c) {
        return { name: c.name, focal_mm: c.focal_mm, sensor_w_mm: c.sensor_w_mm, sensor_h_mm: c.sensor_h_mm, px_w: c.px_w, px_h: c.px_h, user: true };
      });
      return CAMARA_PRESETS.concat(user);
    }
  };

  // Compatibilidad: las funciones libres delegan en CameraStore (varios métodos
  // del plugin las invocan directamente). Mantienen la misma firma y semántica.
  function loadUserCameras() { return CameraStore.loadUser(); }
  function saveUserCameras(arr) { return CameraStore.saveUser(arr); }

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
  //  OgcClient — lógica PURA del proceso OGC API bsq-fotogramas del IGN
  //  --------------------------------------------------------------------
  //  Aísla el conocimiento del dominio del servicio OGC del IGN: nomenclatura de
  //  la Fototeca (nom_fichero), agrupación de fotogramas por vuelo, etiquetas
  //  legibles, detección del huso UTM de la salida y formato de fecha del proceso.
  //  No toca el mapa, el DOM ni el estado del plugin: es determinista. Los métodos
  //  del plugin que hacen fetch / pintan (fetchOGCFotogramas, onOGCResponse,
  //  fillVueloSelect, seleccionarVuelo, mapOGCToRows) delegan aquí la lógica pura.
  // ###################################################################
  var OgcClient = {
    // Descompone un nom_fichero (p.ej. "h50_0778_fot_54-2670_cog") en sus tokens
    // según la nomenclatura de la Fototeca del IGN:
    //   h50   -> escala de hoja MTN 1:50.000
    //   0778  -> número de hoja MTN50
    //   fot_54 -> número de vuelo/pasada
    //   2670  -> número de fotograma (para ordenar la secuencia de captura)
    // Devuelve { prefijo, num, hoja, vuelo } donde prefijo="h50_0778_fot_54".
    // Si el nombre no encaja con el patrón, hoja/vuelo quedan null (fallback).
    parseNom: function (nom) {
      if (!nom) return { prefijo: "sin vuelo", num: null, hoja: null, vuelo: null };
      var s = String(nom);
      // Patrón completo IGN: h<escala>_<hoja>_fot_<vuelo>-<fotograma>...
      var full = s.match(/^h(\d+)_(\w+?)_fot_(\w+?)-(\d+)/i);
      if (full) {
        return {
          prefijo: "h" + full[1] + "_" + full[2] + "_fot_" + full[3],
          num: parseInt(full[4], 10),
          hoja: full[2],
          vuelo: full[3]
        };
      }
      // Fallback: prefijo = todo antes del "-<número>".
      var m = s.match(/^(.*?)-(\d+)/);
      if (m) return { prefijo: m[1], num: parseInt(m[2], 10), hoja: null, vuelo: null };
      return { prefijo: s, num: null, hoja: null, vuelo: null };
    },

    // Clave única de un vuelo = prefijo del nom_fichero + fecha del fotograma.
    vueloKey: function (prefijo, fecha) { return (prefijo || "sin vuelo") + "||" + (fecha || "sin fecha"); },

    // Compone la etiqueta legible de un vuelo para el selector. Si se decodifican
    // hoja y vuelo del nom_fichero, muestra "MTN50 Hoja <hoja> · Vuelo <vuelo> ·
    // <fecha> (<n> fotogramas)"; si no, cae al prefijo crudo + fecha.
    vueloLabel: function (vuelo) {
      var fecha = vuelo.fecha || "sin fecha";
      var n = vuelo.fotogramas.length;
      var cuenta = " (" + n + " fotograma" + (n === 1 ? "" : "s") + ")";
      if (vuelo.hoja && vuelo.vuelo) {
        return "MTN50 Hoja " + vuelo.hoja + " · Vuelo " + vuelo.vuelo +
          " · " + fecha + cuenta;
      }
      return (vuelo.prefijo || "sin vuelo") + " · " + fecha + cuenta;
    },

    // Agrupa los fotogramas crudos de la respuesta por vuelo (prefijo + fecha),
    // los ordena (por fecha y luego por prefijo) y les asigna etiqueta legible.
    // Devuelve el array de vuelos [{ key, prefijo, hoja, vuelo, fecha, label,
    // fotogramas: [] }]. Lógica pura extraída de onOGCResponse.
    groupByFlight: function (fotogramas) {
      var grupos = {};
      for (var i = 0; i < fotogramas.length; i++) {
        var f = fotogramas[i] || {};
        var nom = f.nom_fichero != null ? String(f.nom_fichero) : "";
        var p = OgcClient.parseNom(nom);
        var fecha = f.fecha_fotograma || null;
        var key = OgcClient.vueloKey(p.prefijo, fecha);
        if (!grupos[key]) {
          grupos[key] = {
            key: key, prefijo: p.prefijo, hoja: p.hoja, vuelo: p.vuelo,
            fecha: fecha, fotogramas: []
          };
        }
        grupos[key].fotogramas.push(f);
      }
      var vuelos = Object.keys(grupos).map(function (k) { return grupos[k]; });
      vuelos.sort(function (a, b) {
        var fa = a.fecha || "", fb = b.fecha || "";
        if (fa !== fb) return fa < fb ? -1 : 1;
        return (a.prefijo || "") < (b.prefijo || "") ? -1 : 1;
      });
      vuelos.forEach(function (v) { v.label = OgcClient.vueloLabel(v); });
      return vuelos;
    },

    // Autodetecta el huso UTM ETRS89 (EPSG:25828..25831) a partir del centro del
    // bbox de búsqueda (en 3857). La SALIDA del proceso viene en UTM ETRS89, no en
    // 3857; el huso no se declara en la respuesta y se deduce por la longitud.
    detectUTMZone: function (bbox3857) {
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
    },

    // Convierte una fecha de <input type="date"> (yyyy-mm-dd) al formato dd/mm/yyyy
    // que espera el proceso bsq-fotogramas.
    toApiDate: function (isoDate) {
      if (!isoDate) return "";
      var p = String(isoDate).split("-");
      if (p.length !== 3) return "";
      return p[2] + "/" + p[1] + "/" + p[0];
    }
  };

  // ---------------------------------------------------------------------
  //  MDT del IGN vía WCS GeoTIFF. Se usa para obtener la COTA DEL TERRENO
  //  en cada esquina de la huella (footprint), de modo que la huella se
  //  dibuje sobre el terreno y no a la altitud de vuelo. Mismo servicio,
  //  cobertura y bounds que el visualizador de estereoscopía (probado).
  //  La cobertura Elevacion4326_1000 devuelve el MDT en EPSG:4326.
  //  (Además queda como base reutilizable para la futura fase de CÁLCULO.)
  // ---------------------------------------------------------------------
  var MDT_WCS_URL = "https://servicios.idee.es/wcs-inspire/mdt";
  // Cobertura del MDT. El muestreo asume el ráster en EPSG:4326 (se indexa por
  // lon/lat), por lo que se usa una cobertura 4326. En 4326 el WCS solo ofrece
  // paso 1000 y 500 m; las de mayor resolución (200/25/5 m) están en EPSG:4258
  // o 25830 y requerirían reproyectar el ráster. Para más detalle bastaría con
  // "Elevacion4326_500". (Coberturas del WCS servicios.idee.es/wcs-inspire/mdt.)
  var MDT_COVERAGE = "Elevacion4326_1000";
  var MDT_COV_BOUNDS = { minLon: -18.22, minLat: 27.63, maxLon: 4.94, maxLat: 43.95 };
  // Extensión mínima de la petición WCS (grados) para no pedir un área nula.
  var MDT_MIN_REQUEST_DEG = 0.12;
  // Margen que se añade al bbox de los datos antes de pedir el MDT (grados),
  // para cubrir las esquinas de las huellas que sobresalen de los fotocentros.
  var MDT_MARGIN_DEG = 0.05;
  // Valor de nodata del MDT: cotas <= este umbral se consideran inválidas.
  var MDT_NODATA = -1000;

  // ---------------------------------------------------------------------
  //  AVIÓN ANIMADO que recorre la línea de vuelo.
  //  - En OpenLayers (2D) se dibuja como icono SVG rotado por el rumbo.
  //  - En Cesium (3D) se dibuja como modelo glTF orientado por la velocidad.
  //  El símbolo se elige según la implementación activa en tiempo de ejecución.
  // ---------------------------------------------------------------------
  var AVION_SVG = "../../img/iconos/plane.svg";       // icono 2D (nariz al norte)
  // Modelo 3D (glTF binario). Se sirve desde el repositorio oficial de CesiumGS
  // vía jsDelivr (el antiguo KhronosGroup/glTF-Sample-Models fue archivado y su
  // ruta CesiumAir.glb devuelve 404). Este "Cesium_Air.glb" es el avión clásico
  // de los ejemplos de Cesium. Su morro apunta a +X (Este) en el marco local, por
  // lo que al orientar por rumbo se aplica un desfase de -90° (ver AVION_GLB_HEADING_OFFSET).
  var AVION_GLB = "https://cdn.jsdelivr.net/gh/CesiumGS/cesium@main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb"; // modelo 3D
  // Duración fija (ms) para recorrer la línea completa, independiente de su
  // longitud (UX predecible: el vuelo se ve entero en ~este tiempo).
  var AVION_DURACION_MS = 20000;
  var AVION_SVG_SCALE = 0.5;      // escala del icono 2D
  var AVION_GLB_SCALE = 1.0;      // escala del modelo 3D
  var AVION_GLB_MINPX = 64;       // tamaño mínimo en píxeles del modelo 3D
  // Desfase de rumbo del modelo: el Cesium_Air.glb apunta a +X (Este) por defecto;
  // para que el morro siga el rumbo (0 = Norte) hay que girarlo -90°.
  var AVION_GLB_HEADING_OFFSET = -Math.PI / 2;
  // Id fijo del Cesium.Entity del avión (gestionado directamente en el viewer,
  // no por la capa GeoJSON). Permite recuperarlo/eliminarlo de forma fiable.
  var AVION_ENTITY_ID = "vueloFotogrametrico-avion-3d";

  // ###################################################################
  //  FlightPath — interpolación PURA de la trayectoria del avión
  //  --------------------------------------------------------------------
  //  Dada la línea de vuelo (array de coords [lon,lat(,z)]), precalcula las
  //  longitudes acumuladas (m) e interpola el estado del avión (posición, altitud
  //  y rumbo) por progreso t (0..1). Sin estado ni efectos: el llamador guarda el
  //  precálculo (cum/total) y la línea, y la usa cada frame de la animación.
  // ###################################################################
  var FlightPath = {
    // Precalcula las longitudes acumuladas (en metros, planas) de la línea de
    // vuelo para poder interpolar por progreso t (0..1). Devuelve { cum, total };
    // si la línea es inválida (<2 vértices) devuelve { cum: null, total: 0 }.
    precompute: function (line) {
      if (!line || line.length < 2) return { cum: null, total: 0 };
      var cum = [0];
      var total = 0;
      for (var i = 1; i < line.length; i++) {
        var d = VueloGeo.segMetros(line[i - 1], line[i]);
        total += d;
        cum.push(total);
      }
      return { cum: cum, total: total };
    },

    // Interpola el estado del avión en el progreso t (0..1) a lo largo de la línea.
    // line: coords [lon,lat(,z)]; cum/total: salida de precompute. Devuelve
    // { lon, lat, z, headingRad } o null si no hay línea/precálculo válidos.
    interpolate: function (line, cum, total, t) {
      if (!line || line.length < 2 || !cum || total <= 0) return null;
      t = Math.max(0, Math.min(1, t));
      var target = t * total;

      // Localiza el segmento [i-1, i] que contiene la distancia target.
      var i = 1;
      while (i < cum.length && cum[i] < target) i++;
      if (i >= line.length) i = line.length - 1;
      var a = line[i - 1], b = line[i];
      var segLen = cum[i] - cum[i - 1];
      var frac = segLen > 0 ? (target - cum[i - 1]) / segLen : 0;

      var lon = a[0] + (b[0] - a[0]) * frac;
      var lat = a[1] + (b[1] - a[1]) * frac;
      // Interpola Z (altitud de vuelo) linealmente entre los dos vértices.
      var za = (a.length > 2 && !isNaN(a[2])) ? a[2] : 0;
      var zb = (b.length > 2 && !isNaN(b[2])) ? b[2] : 0;
      var z = za + (zb - za) * frac;

      // Rumbo entre los vértices del segmento (dirección de avance).
      var headingRad = VueloGeo.bearingRad(a, b);
      return { lon: lon, lat: lat, z: z, headingRad: headingRad };
    }
  };

  // ###################################################################
  //  MdtService — descarga del MDT del IGN (WCS GeoTIFF) para las huellas
  //  --------------------------------------------------------------------
  //  Encapsula la construcción de la petición WCS GetCoverage, el aseguramiento
  //  de una extensión mínima, y la descarga+decodificación del GeoTIFF a un objeto
  //  de elevación { raster, width, height, extent4326, min, max }. Usa las
  //  constantes MDT_* y las librerías GeoTIFF/fetch. No toca mapa/DOM/estado;
  //  el muestreo puntual de la cota lo hace FootprintBuilder.sampleCota.
  // ###################################################################
  var MdtService = {
    // Construye la URL WCS GetCoverage para el bbox pedido (en EPSG:4326),
    // recortado a la cobertura del MDT. Devuelve { url, ext } donde ext es el
    // bbox realmente solicitado (necesario para geolocalizar el ráster).
    buildUrl: function (ext4326) {
      var minLon = VueloGeo.clamp(ext4326[0], MDT_COV_BOUNDS.minLon, MDT_COV_BOUNDS.maxLon);
      var minLat = VueloGeo.clamp(ext4326[1], MDT_COV_BOUNDS.minLat, MDT_COV_BOUNDS.maxLat);
      var maxLon = VueloGeo.clamp(ext4326[2], MDT_COV_BOUNDS.minLon, MDT_COV_BOUNDS.maxLon);
      var maxLat = VueloGeo.clamp(ext4326[3], MDT_COV_BOUNDS.minLat, MDT_COV_BOUNDS.maxLat);
      var params = [
        "SERVICE=WCS", "VERSION=2.0.1", "REQUEST=GetCoverage",
        "COVERAGEID=" + MDT_COVERAGE,
        "SUBSET=Lat(" + minLat + "," + maxLat + ")",
        "SUBSET=Long(" + minLon + "," + maxLon + ")",
        "FORMAT=image/tiff"
      ];
      return { url: MDT_WCS_URL + "?" + params.join("&"), ext: [minLon, minLat, maxLon, maxLat] };
    },

    // Garantiza una extensión mínima alrededor del centro del bbox (grados), para
    // que la petición WCS no sea degenerada cuando los datos ocupan poca área.
    ensureMinExtent: function (ext) {
      var cLon = (ext[0] + ext[2]) / 2, cLat = (ext[1] + ext[3]) / 2;
      var w = ext[2] - ext[0], h = ext[3] - ext[1];
      var halfW = Math.max(w, MDT_MIN_REQUEST_DEG) / 2;
      var halfH = Math.max(h, MDT_MIN_REQUEST_DEG) / 2;
      return [cLon - halfW, cLat - halfH, cLon + halfW, cLat + halfH];
    },

    // Descarga y decodifica el MDT (GeoTIFF) del WCS para el bbox [minLon,minLat,
    // maxLon,maxLat] en EPSG:4326. Devuelve una Promise que resuelve con el objeto
    // de elevación { raster, width, height, extent4326, min, max } o null si la
    // zona está fuera de cobertura / falta la librería GeoTIFF / hay error de red.
    fetch: function (bbox4326) {
      if (typeof GeoTIFF === "undefined") {
        console.warn("[vueloFotogrametrico] Falta la librería GeoTIFF; la huella no seguirá el terreno.");
        return Promise.resolve(null);
      }
      // Fuera de la cobertura peninsular/insular del MDT: no hay dato.
      if (bbox4326[2] < MDT_COV_BOUNDS.minLon || bbox4326[0] > MDT_COV_BOUNDS.maxLon ||
          bbox4326[3] < MDT_COV_BOUNDS.minLat || bbox4326[1] > MDT_COV_BOUNDS.maxLat) {
        console.warn("[vueloFotogrametrico] Datos fuera de la cobertura del MDT del IGN.");
        return Promise.resolve(null);
      }
      var req = MdtService.buildUrl(MdtService.ensureMinExtent(bbox4326));
      return fetch(req.url)
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
        .then(function (buf) { return GeoTIFF.fromArrayBuffer(buf); })
        .then(function (tiff) { return tiff.getImage(); })
        .then(function (image) {
          var w = image.getWidth(), h = image.getHeight();
          return image.readRasters().then(function (rasters) {
            var raster = rasters[0], min = Infinity, max = -Infinity;
            for (var i = 0; i < raster.length; i++) {
              var z = raster[i];
              if (z <= MDT_NODATA || isNaN(z)) continue;
              if (z < min) min = z;
              if (z > max) max = z;
            }
            if (min === Infinity) { min = 0; max = 0; }
            return { raster: raster, width: w, height: h, extent4326: req.ext, min: min, max: max };
          });
        })
        .catch(function (err) {
          console.error("[vueloFotogrametrico] Error descargando el MDT:", err.message);
          return null;
        });
    }
  };

  // ###################################################################
  //  ProjUtil — reproyección de coordenadas (proj4) PURA
  //  --------------------------------------------------------------------
  //  Aísla la reproyección [x,y] del CRS origen a lon/lat WGS84 usando los
  //  presets de CRS_PRESETS y proj4 (cargado por CDN). Sin estado ni efectos.
  // ###################################################################
  var ProjUtil = {
    // Reproyecta [x,y] del CRS origen a [lon,lat] WGS84. Si el CRS es 4326,
    // devuelve tal cual. Requiere proj4 para CRS proyectados.
    toLonLat: function (x, y, crs) {
      if (crs === "EPSG:4326") return [x, y];
      if (typeof proj4 === "undefined") return [x, y]; // sin proj4, asume ya lon/lat
      var preset = CRS_PRESETS.filter(function (c) { return c.code === crs; })[0];
      if (!preset || !preset.def) return [x, y];
      try {
        return proj4(preset.def, "EPSG:4326", [x, y]);
      } catch (e) {
        return [x, y];
      }
    }
  };

  // ###################################################################
  //  FootprintBuilder — geometría PURA de la huella del fotograma
  //  --------------------------------------------------------------------
  //  Proyecta el fotograma al suelo a partir de la geometría de la cámara y la
  //  orientación externa (omega/phi/kappa), situando cada esquina sobre el MDT.
  //  Servicio sin estado: recibe los parámetros de cámara (footprint), la posición
  //  y ángulos del fotograma, y el ráster MDT (mdtData). No toca mapa/DOM/estado.
  // ###################################################################
  var FootprintBuilder = {
    // Muestrea la cota del terreno (m) en (lon,lat) sobre el ráster del MDT.
    // Nearest-neighbour con clamp; devuelve null si cae fuera del ráster o si el
    // valor es nodata (para que el llamador decida el respaldo).
    sampleCota: function (mdtData, lon, lat) {
      if (!mdtData) return null;
      var e = mdtData.extent4326;
      var u = (lon - e[0]) / (e[2] - e[0]);
      var v = (lat - e[1]) / (e[3] - e[1]);
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      var col = VueloGeo.clamp(Math.round(u * (mdtData.width - 1)), 0, mdtData.width - 1);
      var row = VueloGeo.clamp(Math.round((1 - v) * (mdtData.height - 1)), 0, mdtData.height - 1);
      var z = mdtData.raster[row * mdtData.width + col];
      if (z <= MDT_NODATA || isNaN(z)) return null;
      return z;
    },

    // Calcula la huella (proyección del fotograma en el SUELO) según la geometría
    // de una cámara fotogramétrica. Cada esquina del sensor define un rayo desde el
    // centro de proyección; el rayo se orienta con la matriz de rotación de la
    // orientación externa R(omega, phi, kappa) y se interseca con el plano del
    // suelo (a la altura de vuelo). Con la cámara nadiral (0,0,0) la huella es un
    // rectángulo centrado de tamaño:
    //   S_x = altura * sensor_w / focal ;  S_y = altura * sensor_h / focal
    // Con omega (balanceo) / phi (cabeceo) la huella se inclina y deforma en
    // trapecio (efecto "keystone") y se desplaza; kappa la rota en el plano.
    // La huella se dibuja SOBRE EL TERRENO: cada esquina toma su cota del MDT
    // (mdtData) como Z absoluta. Criterio all-or-nothing: si alguna esquina no
    // tiene cota del MDT, el anillo se devuelve 2D (el llamador lo pega al terreno
    // con CLAMP en Cesium). Devuelve { ring, hasZ, cotaTerreno } (ring = anillo
    // cerrado de 5 vértices) o null si no puede calcularse.
    build: function (fp, lon, lat, z, omega, phi, kappa, mdtData) {
      if (!fp || !fp.focal_mm) return null;
      // La ALTURA para dimensionar la huella se toma SIEMPRE de la Z del dato
      // (altitud de vuelo). Sin Z no se puede dimensionar la huella.
      var altura = (z !== null && z !== undefined && !isNaN(z) && z > 0) ? z : 0;
      if (!altura || altura <= 0) return null;

      // Semiejes del sensor en unidades de la focal (mm). Un rayo a la esquina del
      // sensor, en el marco de la cámara, es (±sw/2, ±sh/2, -focal): eje Z hacia el
      // objeto (abajo). Trabajamos con la focal como unidad para proyectar al suelo.
      var f = fp.focal_mm;
      var hx = (fp.sensor_w_mm / 2), hy = (fp.sensor_h_mm / 2);

      // Ángulos de orientación externa (radianes); ausentes => 0 (nadiral).
      var o = (omega !== null && omega !== undefined && !isNaN(omega)) ? omega : 0;
      var ph = (phi !== null && phi !== undefined && !isNaN(phi)) ? phi : 0;
      var k = (kappa !== null && kappa !== undefined && !isNaN(kappa)) ? kappa : 0;

      // Matriz de rotación fotogramétrica R = Rz(kappa)·Ry(phi)·Rx(omega) que lleva
      // vectores del marco de la cámara al marco del terreno (X=Este, Y=Norte,
      // Z=arriba). (Delega en VueloGeo.rotationMatrix.)
      var R = VueloGeo.rotationMatrix(o, ph, k);

      // Esquinas del sensor en el marco de la cámara: (x, y, -f). El eje Z del
      // marco cámara apunta al objeto; al rotar con R (marco terreno) el rayo tendrá
      // componente Z<0 (hacia abajo) para la cámara mirando al suelo.
      var sensorCorners = [
        [-hx, -hy, -f],
        [hx, -hy, -f],
        [hx, hy, -f],
        [-hx, hy, -f]
      ];

      // Proyecta cada rayo al suelo: la esquina en el suelo respecto al centro
      // (en metros) es altura * (Rr_x / -Rr_z, Rr_y / -Rr_z), con Rr = R·rayo.
      // -Rr_z>0 porque el rayo apunta hacia abajo. Si algún rayo no apunta hacia
      // abajo (inclinación extrema), se descarta la huella (cae al horizonte).
      var corners = [];
      for (var s = 0; s < sensorCorners.length; s++) {
        var v = sensorCorners[s];
        var rx = R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2];
        var ry = R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2];
        var rz = R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2];
        if (rz >= -1e-6) return null; // rayo no mira al suelo: huella inválida
        var scale = altura / (-rz);
        // Nota: X=Este, Y=Norte. Aplicamos la convención de que un kappa positivo
        // gira la huella en horario sobre el mapa (coherente con el comportamiento
        // previo); la matriz R ya orienta X/Y en el marco terreno.
        corners.push([rx * scale, ry * scale]);
      }

      // Conversión metros -> grados en el punto (aprox. esférica).
      var mPerDegLat = VueloGeo.M_PER_DEG_LAT;
      var mPerDegLon = VueloGeo.mPerDegLon(lat);

      // Cota del TERRENO bajo el centro del fotograma (MDT). Sirve de respaldo
      // para las esquinas que no caigan sobre el ráster (coherencia all-or-nothing:
      // NUNCA se usa la Z de vuelo para una esquina, pues generaría un polígono
      // deforme de miles de metros de altura).
      var cotaCentro = FootprintBuilder.sampleCota(mdtData, lon, lat);

      // Primero calculamos las posiciones planas y la cota de cada esquina.
      var planas = [];      // [ [pLon, pLat, cotaOrNull], ... ]
      var todasConCota = true;
      for (var ci = 0; ci < corners.length; ci++) {
        var pLon = lon + corners[ci][0] / mPerDegLon;
        var pLat = lat + corners[ci][1] / mPerDegLat;
        var cota = FootprintBuilder.sampleCota(mdtData, pLon, pLat);
        if (cota === null) cota = cotaCentro; // respaldo: cota del centro (MDT)
        if (cota === null || isNaN(cota)) todasConCota = false;
        planas.push([pLon, pLat, cota]);
      }

      // All-or-nothing: si TODAS las esquinas tienen cota del MDT, anillo 3D a la
      // cota del terreno; si falta alguna (sin MDT), anillo 2D (Cesium lo pega al
      // terreno visible). Se guarda la cota media en props para el cálculo futuro.
      var ring = [];
      var hasZ = todasConCota;
      for (var j = 0; j < planas.length; j++) {
        ring.push(hasZ ? [planas[j][0], planas[j][1], planas[j][2]]
                       : [planas[j][0], planas[j][1]]);
      }
      ring.push(ring[0].slice()); // cierra el anillo
      return { ring: ring, hasZ: hasZ, cotaTerreno: cotaCentro };
    }
  };

  // ###################################################################
  //  GeoJsonBuilder — construcción PURA de las FeatureCollections GeoJSON
  //  --------------------------------------------------------------------
  //  Convierte los datos importados (data.rows + data.mapping + data.crs +
  //  data.footprint + data.source) en tres FeatureCollections (puntos, líneas de
  //  pasada y huellas) más metadatos para el render y la animación. Servicio sin
  //  estado: recibe el estado de datos y el ráster MDT, y usa ProjUtil/FootprintBuilder.
  // ###################################################################
  var GeoJsonBuilder = {
    // Color por pasada (índice cíclico en la paleta).
    colorForPasada: function (pasadaId, pasadaIds) {
      var idx = pasadaIds.indexOf(pasadaId);
      if (idx < 0) idx = 0;
      return PALETA[idx % PALETA.length];
    },

    // Convierte los datos importados en tres FeatureCollections GeoJSON.
    // data: estado de datos (rows, mapping, crs, footprint, source). mdtData
    // (opcional): ráster de elevación del MDT para situar las huellas sobre el
    // terreno. Si es null, la huella cae a la cota de vuelo (respaldo).
    build: function (data, mdtData) {
      var d = data;
      var m = d.mapping;
      if (!d.rows || !m.x || !m.y) {
        return { error: "Debes mapear al menos las columnas X e Y." };
      }

      var fpParams = d.footprint;
      var puntos = [];       // features Point
      var pasadas = {};      // pasadaId -> array de coords [lon,lat(,z)] ordenados
      var footprints = [];   // features Polygon
      var invalid = 0;
      var anyZ = false;      // ¿algún punto/línea tiene componente Z? (3D vuelo)
      var fpAnyZ = false;    // ¿alguna huella tiene Z de terreno (MDT)? (3D suelo)

      for (var i = 0; i < d.rows.length; i++) {
        var row = d.rows[i];
        var x = parseFloat(String(row[m.x]).replace(",", "."));
        var y = parseFloat(String(row[m.y]).replace(",", "."));
        if (isNaN(x) || isNaN(y)) { invalid++; continue; }

        var ll = ProjUtil.toLonLat(x, y, d.crs);
        var lon = ll[0], lat = ll[1];
        if (isNaN(lon) || isNaN(lat)) { invalid++; continue; }

        var z = m.z ? parseFloat(String(row[m.z]).replace(",", ".")) : NaN;
        var idVal = m.id ? row[m.id] : String(i + 1);
        var pasadaVal = m.pasada ? String(row[m.pasada]) : "sin pasada";

        // Coordenada 3D del centro: [lon, lat, z] con la altitud REAL de vuelo si
        // existe, o [lon, lat] (2D) si la fila no trae Z. En Cesium las geometrías
        // 2D se pegan al terreno; con Z se dibujan a la altura de vuelo real.
        var hasZ = !isNaN(z);
        var coord = hasZ ? [lon, lat, z] : [lon, lat];
        if (hasZ) anyZ = true;

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
          geometry: { type: "Point", coordinates: coord },
          properties: props
        });

        if (!pasadas[pasadaVal]) pasadas[pasadaVal] = [];
        pasadas[pasadaVal].push(coord);

        // Footprint: proyección del fotograma en el suelo. Si el dato trae los
        // giros de orientación externa (omega/phi/kappa, en radianes), la huella se
        // inclina/rota en consecuencia (kappa gira; omega y phi la deforman en
        // trapecio). La huella se sitúa sobre el TERRENO usando la cota del MDT.
        var readAng = function (key) {
          return (m[key] && row[m[key]] != null && row[m[key]] !== "")
            ? parseFloat(String(row[m[key]]).replace(",", "."))
            : null;
        };
        var omega = readAng("omega");
        var phi = readAng("phi");
        var kappa = readAng("kappa");
        var fp = FootprintBuilder.build(fpParams, lon, lat, z, omega, phi, kappa, mdtData);
        if (fp) {
          if (fp.hasZ) fpAnyZ = true;
          // Propiedades de la huella: las del punto + la cota del terreno bajo el
          // centro (MDT), útil para consulta y para la futura fase de cálculo.
          var fpProps = Object.assign({}, props, { cota_terreno: fp.cotaTerreno });
          footprints.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [fp.ring] }, properties: fpProps });
        }
      }

      // Líneas de pasada. Dos comportamientos:
      //  - DEMO: UNA sola polilínea CONTINUA que serpentea por todas las pasadas en
      //    el orden en que se generaron los fotogramas (boustrophedon): sube por la
      //    pasada 1, cruza al inicio de la pasada 2, baja por la 2, etc. Esa misma
      //    línea es la "línea de vuelo" que recorre el avión.
      //  - OGC/CSV: una línea POR pasada (agrupada), como hasta ahora; la línea de
      //    vuelo para el avión es la más larga.
      var lineas = [];
      var flightCoords = null;
      if (d.source === "demo") {
        // Los puntos ya están en orden de generación (fila i = fotograma i). La
        // línea continua une TODOS los centros en ese orden.
        var serpiente = puntos.map(function (ft) { return ft.geometry.coordinates; });
        if (serpiente.length >= 2) {
          lineas.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: serpiente },
            properties: { pasada: "vuelo" }
          });
          flightCoords = serpiente;
        }
      } else {
        Object.keys(pasadas).forEach(function (pid) {
          var coords = pasadas[pid];
          if (coords.length >= 2) {
            lineas.push({
              type: "Feature",
              geometry: { type: "LineString", coordinates: coords },
              properties: { pasada: pid }
            });
            if (!flightCoords || coords.length > flightCoords.length) flightCoords = coords;
          }
        });
      }

      return {
        puntos: { type: "FeatureCollection", features: puntos },
        lineas: { type: "FeatureCollection", features: lineas },
        footprints: { type: "FeatureCollection", features: footprints },
        pasadaIds: Object.keys(pasadas),
        invalid: invalid,
        count: puntos.length,
        is3D: anyZ,
        footprints3D: fpAnyZ,
        // Coordenadas [lon,lat(,z)] de la línea de vuelo para la animación.
        flightCoords: flightCoords
      };
    }
  };

  // ###################################################################
  //  FlightPlanner — planificación PURA de vuelo fotogramétrico
  //  --------------------------------------------------------------------
  //  Servicio sin estado, sin mapa ni DOM. Calcula la geometría de un plan de
  //  vuelo (rumbo óptimo, malla de pasadas/fotogramas) a partir del área de vuelo
  //  (anillo lon/lat), la cámara y los parámetros de cálculo. Trabaja en un plano
  //  local métrico (equirectangular) centrado en el área, suficiente para las
  //  extensiones de un vuelo. El Shell (calcularVuelo) le pasa los datos y vuelca
  //  los frames resultantes al pipeline de render.
  //
  //  Convención de ejes: se proyecta cada punto sobre el eje "along" (dirección
  //  del rumbo) y el eje "across" (rumbo+90). El nº de pasadas depende de la
  //  extensión "across" del área; el nº de fotogramas por pasada, de la "along".
  // ###################################################################
  var FlightPlanner = {
    // Convierte un anillo [[lon,lat],...] a puntos métricos locales {x:este,
    // y:norte} relativos al centro del área (aprox. equirectangular). Devuelve
    // { pts, center:[lon,lat], mLon, mLat } para poder revertir a lon/lat luego.
    ringToLocalMeters: function (ring) {
      var minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
      for (var i = 0; i < ring.length; i++) {
        var p = ring[i];
        if (p[0] < minLon) minLon = p[0];
        if (p[1] < minLat) minLat = p[1];
        if (p[0] > maxLon) maxLon = p[0];
        if (p[1] > maxLat) maxLat = p[1];
      }
      var cLon = (minLon + maxLon) / 2, cLat = (minLat + maxLat) / 2;
      var mLat = VueloGeo.M_PER_DEG_LAT;
      var mLon = VueloGeo.mPerDegLon(cLat);
      var pts = ring.map(function (p) {
        return { x: (p[0] - cLon) * mLon, y: (p[1] - cLat) * mLat };
      });
      return { pts: pts, center: [cLon, cLat], mLon: mLon, mLat: mLat };
    },

    // Proyecta un conjunto de puntos locales sobre los ejes along/across de un
    // rumbo dado (grados, 0=N, 90=E) y devuelve las extensiones (m) en cada eje.
    //   along  = dirección del vuelo (unitario: [sin r, cos r])
    //   across = perpendicular (rumbo+90):        [cos r, -sin r]
    // Devuelve { alongMin, alongMax, acrossMin, acrossMax, alongExt, acrossExt }.
    projectExtents: function (pts, rumboDeg) {
      var r = rumboDeg * Math.PI / 180;
      var ax = Math.sin(r), ay = Math.cos(r);   // eje along (dir. de vuelo)
      var cx = Math.cos(r), cy = -Math.sin(r);  // eje across (rumbo+90)
      var alMin = Infinity, alMax = -Infinity, acMin = Infinity, acMax = -Infinity;
      for (var i = 0; i < pts.length; i++) {
        var al = pts[i].x * ax + pts[i].y * ay;
        var ac = pts[i].x * cx + pts[i].y * cy;
        if (al < alMin) alMin = al;
        if (al > alMax) alMax = al;
        if (ac < acMin) acMin = ac;
        if (ac > acMax) acMax = ac;
      }
      return {
        alongMin: alMin, alongMax: alMax, acrossMin: acMin, acrossMax: acMax,
        alongExt: alMax - alMin, acrossExt: acMax - acMin
      };
    },

    // Rumbo óptimo (grados 0..179) que MINIMIZA el nº de pasadas para cubrir el
    // área. El nº de pasadas es proporcional a la extensión "across"; por eso el
    // óptimo suele alinear el vuelo con el eje LARGO del área (minimiza el ancho a
    // barrer). A: separación entre pasadas (m). stepDeg: paso del barrido.
    // Desempata por menor extensión "across" (área a cubrir más estrecha).
    // Devuelve { rumbo, nPasadas, acrossExt }.
    optimalHeading: function (ring, A, stepDeg) {
      var lm = FlightPlanner.ringToLocalMeters(ring);
      var step = stepDeg || 2;
      var best = null;
      for (var deg = 0; deg < 180; deg += step) {
        var ext = FlightPlanner.projectExtents(lm.pts, deg);
        var nPas = Math.max(1, Math.ceil(ext.acrossExt / A) + 1);
        if (!best || nPas < best.nPasadas ||
            (nPas === best.nPasadas && ext.acrossExt < best.acrossExt)) {
          best = { rumbo: deg, nPasadas: nPas, acrossExt: ext.acrossExt };
        }
      }
      return best;
    },

    // Ajusta la ALTURA de cada pasada al terreno para mantener el GSD objetivo.
    // El GSD depende de la altura SOBRE EL TERRENO: GSD = (H - Zterreno)·pitch/focal.
    // Una pasada vuela a altura absoluta CONSTANTE; para que su GSD medio sea el
    // objetivo, su altura = cota_media_de_la_franja + alturaSobreTerreno, donde
    //   alturaSobreTerreno = GSD_obj · focal / pitch  (metros).
    // Para cada pasada se muestrea el MDT en sus fotocentros (cota media) y se fija
    // la Z absoluta de todos sus frames a esa altura. Se calcula además el GSD real
    // por fotograma (con su cota local) y se marca la pasada como "fuera de
    // tolerancia" si algún fotograma se desvía > tolPct del GSD objetivo.
    //
    //   frames: array de {lon,lat,z,pasadaNum,...} (modifica z in situ).
    //   opts.sampleCota(lon,lat) -> cota terreno (m) o null.
    //   opts.gsdObjM: GSD objetivo (m/píxel). opts.focal_mm, opts.pitch_mm.
    //   opts.tolPct: tolerancia (0..1) sobre el GSD objetivo.
    // Devuelve { pasadas: [{pasadaNum, cotaMedia, altura, gsdMin, gsdMax, fueraTol}],
    //   nAlturas, algunaFueraTol, sinCotaCount }.
    applyPerPassHeights: function (frames, opts) {
      var alturaSobreTerreno = opts.gsdObjM * opts.focal_mm / opts.pitch_mm; // m
      // Agrupa índices de frame por pasada.
      var byPass = {};
      for (var i = 0; i < frames.length; i++) {
        var pn = frames[i].pasadaNum;
        if (!byPass[pn]) byPass[pn] = [];
        byPass[pn].push(i);
      }
      // 1ª fase: cota media (y cotas locales) por pasada, sin fijar aún la altura.
      var sinCotaCount = 0;
      var passInfo = {}; // pasadaNum -> { idxs, cotaMedia, cotas }
      var cotaGlobalMin = Infinity, cotaGlobalMax = -Infinity;
      Object.keys(byPass).forEach(function (pnKey) {
        var idxs = byPass[pnKey];
        var suma = 0, n = 0, cotas = [];
        for (var j = 0; j < idxs.length; j++) {
          var fr = frames[idxs[j]];
          var cota = opts.sampleCota(fr.lon, fr.lat);
          if (cota === null || isNaN(cota)) { sinCotaCount++; cotas.push(null); continue; }
          suma += cota; n++; cotas.push(cota);
        }
        var cotaMedia = n > 0 ? suma / n : 0;
        if (cotaMedia < cotaGlobalMin) cotaGlobalMin = cotaMedia;
        if (cotaMedia > cotaGlobalMax) cotaGlobalMax = cotaMedia;
        passInfo[pnKey] = { idxs: idxs, cotaMedia: cotaMedia, cotas: cotas };
      });

      // UNIFICACIÓN: si TODAS las pasadas pueden volar a UNA altura común sin que
      // ninguna se salga de la tolerancia de GSD, se usa una sola altura (evita
      // fragmentar el vuelo en terreno casi plano). La altura común se calcula
      // sobre la cota media global; el desnivel tolerable (m) que mantiene el GSD
      // dentro de tol es: dH_max = alturaSobreTerreno · tolPct.
      var dHtol = alturaSobreTerreno * opts.tolPct;
      var rangoCotas = (cotaGlobalMax - cotaGlobalMin);
      var alturaUnica = isFinite(rangoCotas) && rangoCotas <= dHtol;
      var cotaComun = (isFinite(cotaGlobalMin) && isFinite(cotaGlobalMax))
        ? (cotaGlobalMin + cotaGlobalMax) / 2 : 0;

      // 2ª fase: fija la altura de cada pasada (común o propia) y evalúa tolerancia.
      var pasadas = [];
      var algunaFueraTol = false;
      Object.keys(passInfo).forEach(function (pnKey) {
        var info = passInfo[pnKey];
        var altura = alturaUnica
          ? (cotaComun + alturaSobreTerreno)
          : (info.cotaMedia + alturaSobreTerreno);
        var gsdMin = Infinity, gsdMax = -Infinity, fueraTol = false;
        for (var k = 0; k < info.idxs.length; k++) {
          var f2 = frames[info.idxs[k]];
          f2.z = altura;
          var cotaLocal = (info.cotas[k] !== null && !isNaN(info.cotas[k])) ? info.cotas[k] : info.cotaMedia;
          var hSobre = altura - cotaLocal;
          var gsdReal = hSobre * opts.pitch_mm / opts.focal_mm;
          if (gsdReal < gsdMin) gsdMin = gsdReal;
          if (gsdReal > gsdMax) gsdMax = gsdReal;
          if (Math.abs(gsdReal - opts.gsdObjM) / opts.gsdObjM > opts.tolPct) fueraTol = true;
        }
        if (fueraTol) algunaFueraTol = true;
        pasadas.push({
          pasadaNum: parseInt(pnKey, 10),
          cotaMedia: info.cotaMedia, altura: altura,
          gsdMin: gsdMin, gsdMax: gsdMax, fueraTol: fueraTol
        });
      });
      // nAlturas: nº de alturas distintas (redondeadas a 1 m) usadas.
      var alturasSet = {};
      pasadas.forEach(function (p) { alturasSet[Math.round(p.altura)] = true; });
      return {
        pasadas: pasadas,
        nAlturas: Object.keys(alturasSet).length,
        algunaFueraTol: algunaFueraTol,
        sinCotaCount: sinCotaCount
      };
    },

    // ---- Recorte a la feature (requiere turf) --------------------------------

    // Bufferea un anillo [[lon,lat],...] un porcentaje de su "dimensión
    // característica" (sqrt del área en m²). Devuelve un turf Polygon/MultiPolygon
    // (Feature) o null si turf no puede. pct en % (p.ej. 10 = 10%).
    bufferArea: function (turf, ring, pct) {
      try {
        var closed = ring.slice();
        // turf exige anillo cerrado (primer punto == último).
        var a = closed[0], b = closed[closed.length - 1];
        if (a[0] !== b[0] || a[1] !== b[1]) closed.push([a[0], a[1]]);
        var poly = turf.polygon([closed]);
        if (!pct || pct <= 0) return poly;
        var areaM2 = turf.area(poly);                 // m²
        var dimChar = Math.sqrt(Math.max(areaM2, 1)); // m (lado equivalente)
        var distKm = (dimChar * (pct / 100)) / 1000;  // turf.buffer usa km por defecto
        var buffered = turf.buffer(poly, distKm, { units: "kilometers" });
        return buffered || poly;
      } catch (e) { return null; }
    },

    // Construye un turf Polygon con la huella de un fotograma a partir de su anillo
    // [[lon,lat(,z)],...] (el que produce FootprintBuilder.build). Ignora la Z.
    footprintPoly: function (turf, ring) {
      try {
        var coords = ring.map(function (p) { return [p[0], p[1]]; });
        var a = coords[0], b = coords[coords.length - 1];
        if (a[0] !== b[0] || a[1] !== b[1]) coords.push([a[0], a[1]]);
        return turf.polygon([coords]);
      } catch (e) { return null; }
    },

    // Recorta la lista de frames al área (turf polygon ya bufferado): conserva solo
    // los fotogramas cuya HUELLA intersecta el área. Para cada frame se calcula su
    // huella con buildFootprint(frame) -> anillo lon/lat. Devuelve
    //   { kept, removed, coverageOk, minCoverage }
    // donde coverageOk indica si todo el área queda cubierta por >=2 huellas
    // (verificado por muestreo de puntos internos del área).
    clipToFeature: function (turf, frames, areaPoly, buildFootprint) {
      var kept = [];
      var footPolys = [];
      for (var i = 0; i < frames.length; i++) {
        var ring = buildFootprint(frames[i]);
        if (!ring) continue;
        var fpPoly = FlightPlanner.footprintPoly(turf, ring);
        if (!fpPoly) continue;
        var hits = false;
        try { hits = turf.booleanIntersects(fpPoly, areaPoly); } catch (e) { hits = true; }
        if (hits) { kept.push(frames[i]); footPolys.push(fpPoly); }
      }
      // Verifica doble cobertura muestreando puntos dentro del área (rejilla sobre
      // su bbox, filtrando los que caen dentro del área). Para cada punto cuenta
      // cuántas huellas conservadas lo contienen; coverageOk si todos tienen >=2.
      var cov = FlightPlanner._checkDoubleCoverage(turf, areaPoly, footPolys);
      return { kept: kept, removed: frames.length - kept.length,
        coverageOk: cov.ok, minCoverage: cov.min, nSampled: cov.n };
    },

    // Comprueba que todo el área tenga >=2 huellas: muestrea una rejilla de puntos
    // dentro del área y cuenta huellas que contienen cada punto. Devuelve
    //   { ok, min, n } (min = cobertura mínima encontrada; n = puntos muestreados).
    _checkDoubleCoverage: function (turf, areaPoly, footPolys) {
      try {
        var bbox = turf.bbox(areaPoly); // [minLon,minLat,maxLon,maxLat]
        var N = 12; // rejilla NxN
        var dx = (bbox[2] - bbox[0]) / (N + 1);
        var dy = (bbox[3] - bbox[1]) / (N + 1);
        var min = Infinity, n = 0;
        for (var ix = 1; ix <= N; ix++) {
          for (var iy = 1; iy <= N; iy++) {
            var lon = bbox[0] + dx * ix;
            var lat = bbox[1] + dy * iy;
            var pt = turf.point([lon, lat]);
            if (!turf.booleanPointInPolygon(pt, areaPoly)) continue;
            n++;
            var cnt = 0;
            for (var k = 0; k < footPolys.length; k++) {
              if (turf.booleanPointInPolygon(pt, footPolys[k])) cnt++;
              if (cnt >= 2) break;
            }
            if (cnt < min) min = cnt;
          }
        }
        if (n === 0) return { ok: true, min: 0, n: 0 };
        return { ok: min >= 2, min: (min === Infinity ? 0 : min), n: n };
      } catch (e) { return { ok: true, min: 0, n: 0 }; }
    }
  };

  // ###################################################################
  //  PanelTemplate — plantilla HTML PURA del panel de importación
  //  --------------------------------------------------------------------
  //  Construye el string HTML del panel (modos hecho/demo/cálculo, sub-pestañas de
  //  fuente, mapeo de columnas, sección cámara, acciones y animación). Solo depende
  //  de las constantes CRS_PRESETS y CAMPOS. No toca el DOM ni el estado; el Shell
  //  inyecta el resultado en el panel y engancha los eventos (bindPanelEvents).
  // ###################################################################
  var PanelTemplate = {
    build: function () {
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

        // --- Selector de MODO: Vuelo ya hecho / Demo / Cálculo --------------
        '  <div class="vuelo-modes" id="vf-modes">' +
        '    <button type="button" class="vuelo-mode" data-mode="hecho">Vuelo ya hecho</button>' +
        '    <button type="button" class="vuelo-mode" data-mode="demo">Demo</button>' +
        '    <button type="button" class="vuelo-mode" data-mode="calculo">Cálculo</button>' +
        '  </div>' +

        // ==================== MODO: VUELO YA HECHO ==========================
        '  <div class="vuelo-mode-panel" id="vf-mode-hecho">' +
        // --- Contenedor de Origen de datos (acordeón) ---
        '    <div class="vuelo-section vf-accordion" data-acc="source">' +
        '      <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '        <span class="vuelo-section-title">Origen de datos</span>' +
        '        <span class="vuelo-chevron">▸</span>' +
        '      </div>' +
        '      <div class="vuelo-accordion-body">' +
        '        <div class="vuelo-tabs" id="vf-tabs">' +
        '          <button type="button" class="vuelo-tab" data-source="ogc">OGC API IGN</button>' +
        '          <button type="button" class="vuelo-tab" data-source="csv">CSV / Excel</button>' +
        '        </div>' +
        '        <div class="vuelo-tab-panel" id="vf-tab-ogc">' +
        '          <p class="vuelo-hint">Busca fotogramas PNOA del IGN en el área visible del mapa y un rango de fechas. Devuelve los parámetros de orientación externa (fotocentros y giros).</p>' +
        '          <div class="vuelo-row"><label for="vf-ogc-desde">Fecha desde</label><input type="date" id="vf-ogc-desde"></div>' +
        '          <div class="vuelo-row"><label for="vf-ogc-hasta">Fecha hasta</label><input type="date" id="vf-ogc-hasta"></div>' +
        '          <label class="vuelo-check"><input type="checkbox" id="vf-ogc-usarvista" checked> Usar el área visible del mapa</label>' +
        '          <button type="button" id="vf-ogc-buscar" class="vuelo-btn primary">Buscar vuelos</button>' +
        '        </div>' +
        '        <div class="vuelo-tab-panel" id="vf-tab-csv" hidden>' +
        '          <div class="vuelo-drop" id="vf-drop">' +
        '            Arrastra aquí un <strong>CSV</strong> o <strong>Excel</strong><br>o haz clic para elegir archivo' +
        '            <input type="file" id="vf-file" accept=".csv,.txt,.xlsx,.xls">' +
        '          </div>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +

        // ---- Selector de VUELOS (acordeón) ----------
        '    <div class="vuelo-section vf-accordion" id="vf-section-vuelos" data-acc="vuelos" hidden>' +
        '      <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '        <span class="vuelo-section-title">Vuelo</span>' +
        '        <span class="vuelo-chevron">▸</span>' +
        '      </div>' +
        '      <div class="vuelo-accordion-body">' +
        '        <select id="vf-ogc-vuelos" class="vuelo-select-vuelo"><option value="">— Elige un vuelo —</option></select>' +
        '      </div>' +
        '    </div>' +

        // ---- Mapeo de columnas (acordeón) --
        '    <div class="vuelo-section vf-accordion" id="vf-section-map" data-acc="map" hidden>' +
        '      <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '        <span class="vuelo-section-title">Mapeo de columnas</span>' +
        '        <span class="vuelo-chevron">▸</span>' +
        '      </div>' +
        '      <div class="vuelo-accordion-body">' +
        '        <div class="vuelo-row">' +
        '          <label for="vf-crs">CRS origen</label>' +
        '          <select id="vf-crs">' + crsOptions + '</select>' +
        '        </div>' +
        mapRows +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        // ==================== MODO: DEMO (generador sintético) =============
        '  <div class="vuelo-mode-panel" id="vf-mode-demo" hidden>' +
        '    <div class="vuelo-section vf-accordion" data-acc="demo">' +
        '      <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '        <span class="vuelo-section-title">Parámetros de la demo</span>' +
        '        <span class="vuelo-chevron">▸</span>' +
        '      </div>' +
        '      <div class="vuelo-accordion-body">' +
        '        <p class="vuelo-hint">Genera un vuelo sintético <strong>fotograma a fotograma</strong>. El primer fotograma se coloca en el centro del mapa; cada nuevo fotograma se añade según el rumbo y la separación indicados.</p>' +
        '        <div id="vf-cam-anchor-demo"></div>' +
        '        <div class="vuelo-row"><label for="vf-demo-rumbo">Rumbo (°)</label><input type="number" id="vf-demo-rumbo" step="1" min="0" max="360"></div>' +
        '        <div class="vuelo-row"><label for="vf-demo-sepfoto">Sep. fotogramas (m)</label><input type="number" id="vf-demo-sepfoto" step="10" min="1"></div>' +
        '        <div class="vuelo-row"><label for="vf-demo-seppasada">Sep. pasadas (m)</label><input type="number" id="vf-demo-seppasada" step="10" min="1"></div>' +
        '        <div class="vuelo-row"><label for="vf-demo-lado">Lado pasadas</label>' +
        '          <select id="vf-demo-lado"><option value="der">Derecha</option><option value="izq">Izquierda</option></select>' +
        '        </div>' +
        '        <div class="vuelo-row"><label for="vf-demo-z">Altura Z (m)</label><input type="number" id="vf-demo-z" step="10" min="1"></div>' +
        '        <div class="vuelo-row"><label for="vf-demo-omega">Omega (°)</label><input type="number" id="vf-demo-omega" step="0.1"></div>' +
        '        <div class="vuelo-row"><label for="vf-demo-phi">Phi (°)</label><input type="number" id="vf-demo-phi" step="0.1"></div>' +
        '        <div class="vuelo-row"><label for="vf-demo-kappa">Kappa (°)</label><input type="number" id="vf-demo-kappa" step="0.1"></div>' +
        '        <div class="vuelo-anim-controls">' +
        '          <button type="button" id="vf-demo-add" class="vuelo-btn primary" title="Añadir un fotograma">＋ Añadir fotograma</button>' +
        '          <button type="button" id="vf-demo-newpass" class="vuelo-btn" title="Empezar una nueva pasada">↵ Nueva pasada</button>' +
        '        </div>' +
        '        <button type="button" id="vf-demo-clear" class="vuelo-btn">Limpiar demo</button>' +
        '        <p class="vuelo-hint" id="vf-demo-info"></p>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        // ==================== MODO: CÁLCULO (planificación) ================
        '  <div class="vuelo-mode-panel" id="vf-mode-calculo" hidden>' +
        '    <div class="vuelo-section vf-accordion" data-acc="calculo">' +
        '      <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '        <span class="vuelo-section-title">Parámetros de cálculo</span>' +
        '        <span class="vuelo-chevron">▸</span>' +
        '      </div>' +
        '      <div class="vuelo-accordion-body">' +
        '        <p class="vuelo-hint">Planifica un vuelo nuevo a partir del <strong>GSD</strong> deseado, los solapes y la cámara. Define el área con el encuadre del mapa o un polígono de una capa.</p>' +
        '        <div id="vf-cam-anchor-calc"></div>' +
        '        <div class="vuelo-row">' +
        '          <label for="vf-calc-areasrc">Área</label>' +
        '          <select id="vf-calc-areasrc">' +
        '            <option value="bbox">Encuadre del mapa</option>' +
        '            <option value="feature">Polígono de capa</option>' +
        '          </select>' +
        '        </div>' +
        '        <div class="vuelo-row" id="vf-calc-capa-row" hidden>' +
        '          <label for="vf-calc-capa">Capa</label>' +
        '          <select id="vf-calc-capa" class="vuelo-select-vuelo"><option value="">— Elige una capa —</option></select>' +
        '        </div>' +
        '        <div class="vuelo-row" id="vf-calc-feature-row" hidden>' +
        '          <label for="vf-calc-feature">Elemento</label>' +
        '          <select id="vf-calc-feature" class="vuelo-select-vuelo"><option value="">— Toda la capa —</option></select>' +
        '        </div>' +
        '        <div class="vuelo-row"><label for="vf-calc-gsd">GSD (cm/píxel)</label><input type="number" id="vf-calc-gsd" step="1" min="1"></div>' +
        '        <div class="vuelo-row"><label for="vf-calc-solapel">Solape long. (%)</label><input type="number" id="vf-calc-solapel" step="5" min="0" max="95"></div>' +
        '        <div class="vuelo-row"><label for="vf-calc-solapet">Solape trans. (%)</label><input type="number" id="vf-calc-solapet" step="5" min="0" max="95"></div>' +
        // Tolerancia de GSD (%): si el relieve hace variar el GSD más que esto, se
        // vuela por pasadas a distinta altura (según la cota media de cada franja).
        '        <div class="vuelo-row"><label for="vf-calc-tolgsd">Tolerancia GSD (%)</label><input type="number" id="vf-calc-tolgsd" step="1" min="1" max="100"></div>' +
        // Rumbo: automático (minimiza pasadas) o manual. El input se habilita solo
        // cuando se desmarca "automático".
        '        <label class="vuelo-check"><input type="checkbox" id="vf-calc-rumboauto" checked> Rumbo automático (óptimo)</label>' +
        '        <div class="vuelo-row"><label for="vf-calc-rumbo">Rumbo pasadas (°)</label><input type="number" id="vf-calc-rumbo" step="1" min="0" max="360" disabled></div>' +
        // Buffer del área (%): solo relevante al recortar a una feature. Su fila se
        // muestra/oculta según el origen del área (applyCalcAreaSrc).
        '        <div class="vuelo-row" id="vf-calc-buffer-row" hidden><label for="vf-calc-buffer">Buffer área (%)</label><input type="number" id="vf-calc-buffer" step="5" min="0" max="100"></div>' +
        '        <button type="button" id="vf-calc-run" class="vuelo-btn primary">Calcular vuelo</button>' +
        '        <button type="button" id="vf-calc-clear" class="vuelo-btn">Limpiar</button>' +
        '        <div class="vuelo-calc-results" id="vf-calc-results" hidden></div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        // ==================== SECCIONES COMPARTIDAS (hecho + demo) =========
        '  <div class="vuelo-status" id="vf-status"></div>' +
        '  <div id="vf-cam-home"></div>' +

        // ---- Cámara / Footprint (acordeón) ----------
        '  <div class="vuelo-section vf-accordion" id="vf-section-fp" data-acc="camara" hidden>' +
        '    <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '      <span class="vuelo-section-title">Cámara</span>' +
        '      <span class="vuelo-chevron">▸</span>' +
        '    </div>' +
        '    <div class="vuelo-accordion-body">' +
        '      <div class="vuelo-row">' +
        '        <label for="vf-cam-preset">Modelo</label>' +
        '        <select id="vf-cam-preset"></select>' +
        '      </div>' +
        '      <div class="vuelo-row"><label for="vf-fp-focal">Focal (mm)</label><input type="number" id="vf-fp-focal" step="1" min="1"></div>' +
        '      <div class="vuelo-row"><label for="vf-fp-sw">Sensor ancho (mm)</label><input type="number" id="vf-fp-sw" step="0.1" min="0.1"></div>' +
        '      <div class="vuelo-row"><label for="vf-fp-sh">Sensor alto (mm)</label><input type="number" id="vf-fp-sh" step="0.1" min="0.1"></div>' +
        '      <div class="vuelo-row"><label for="vf-fp-pxw">Píxeles ancho</label><input type="number" id="vf-fp-pxw" step="1" min="1"></div>' +
        '      <div class="vuelo-row"><label for="vf-fp-pxh">Píxeles alto</label><input type="number" id="vf-fp-pxh" step="1" min="1"></div>' +
        '      <button type="button" id="vf-cam-add-toggle" class="vuelo-btn">＋ Añadir cámara</button>' +
        '      <div class="vuelo-cam-form" id="vf-cam-form" hidden>' +
        '        <div class="vuelo-row"><label for="vf-cam-name">Nombre</label><input type="text" id="vf-cam-name" placeholder="Mi cámara"></div>' +
        '        <div class="vuelo-row"><label for="vf-cam-focal">Focal (mm)</label><input type="number" id="vf-cam-focal" step="1" min="1"></div>' +
        '        <div class="vuelo-row"><label for="vf-cam-sw">Sensor ancho (mm)</label><input type="number" id="vf-cam-sw" step="0.1" min="0.1"></div>' +
        '        <div class="vuelo-row"><label for="vf-cam-sh">Sensor alto (mm)</label><input type="number" id="vf-cam-sh" step="0.1" min="0.1"></div>' +
        '        <div class="vuelo-row"><label for="vf-cam-pxw">Píxeles ancho</label><input type="number" id="vf-cam-pxw" step="1" min="1"></div>' +
        '        <div class="vuelo-row"><label for="vf-cam-pxh">Píxeles alto</label><input type="number" id="vf-cam-pxh" step="1" min="1"></div>' +
        '        <div class="vuelo-anim-controls">' +
        '          <button type="button" id="vf-cam-save" class="vuelo-btn primary">Guardar cámara</button>' +
        '          <button type="button" id="vf-cam-cancel" class="vuelo-btn">Cancelar</button>' +
        '        </div>' +
        '        <p class="vuelo-hint" id="vf-cam-msg"></p>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        // ---- Acciones (acordeón) -------------------------------------------
        '  <div class="vuelo-section vf-accordion" id="vf-section-actions" data-acc="acciones" hidden>' +
        '    <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '      <span class="vuelo-section-title">Acciones</span>' +
        '      <span class="vuelo-chevron">▸</span>' +
        '    </div>' +
        '    <div class="vuelo-accordion-body">' +
        '      <button type="button" id="vf-render" class="vuelo-btn primary">Visualizar vuelo</button>' +
        '      <button type="button" id="vf-clear" class="vuelo-btn">Limpiar</button>' +
        '    </div>' +
        '  </div>' +

        // ---- Animación del avión (acordeón) ----------------
        '  <div class="vuelo-section vf-accordion" id="vf-section-anim" data-acc="anim" hidden>' +
        '    <div class="vuelo-accordion-header" role="button" tabindex="0">' +
        '      <span class="vuelo-section-title">Animación del vuelo</span>' +
        '      <span class="vuelo-chevron">▸</span>' +
        '    </div>' +
        '    <div class="vuelo-accordion-body">' +
        '      <div class="vuelo-anim-controls">' +
        '        <button type="button" id="vf-anim-play" class="vuelo-btn primary" title="Reproducir / Pausar">▶ Reproducir</button>' +
        '        <button type="button" id="vf-anim-restart" class="vuelo-btn" title="Reiniciar">⏮ Reiniciar</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '</div>';
    }
  };

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

    // Estado de datos importados (persiste entre swaps OL<->Cesium). Si ya existe
    // en window.__vueloSharedData (venimos de un swap), se re-hidrata; si no, se
    // crea el estado inicial con la fábrica FlightState.getInitialState(). La
    // forma completa del estado y sus campos están documentados en FlightState.
    this.data = window.__vueloSharedData || FlightState.getInitialState();
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

  // Construye el HTML del panel. (Delega en PanelTemplate.build; la plantilla es
  // pura y solo depende de las constantes CRS_PRESETS y CAMPOS.)
  buildPanelHTML() { return PanelTemplate.build(); };

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

    // Selector de modo (Vuelo ya hecho / Demo / Cálculo).
    var modeBtns = p.querySelectorAll(".vuelo-mode");
    for (var mi = 0; mi < modeBtns.length; mi++) {
      modeBtns[mi].addEventListener("click", function () {
        var mode = this.getAttribute("data-mode");
        self.data.mode = mode;
        // Sincroniza la fuente de datos con el modo elegido: en 'demo' la fuente
        // es el generador sintético; en 'hecho' se restaura a una fuente válida
        // del modo (ogc por defecto, o csv si ya se estaba usando).
        if (mode === "demo") {
          self.data.source = "demo";
        } else if (mode === "hecho") {
          if (self.data.source !== "csv") self.data.source = "ogc";
        }
        window.__vueloSharedData = self.data;
        self.applyMode();
        // applySource solo aplica a las sub-pestañas del modo 'hecho'. En 'demo'
        // y 'calculo' no hay sub-pestañas y no debe re-mostrar las secciones de
        // configuración (applyMode ya decide su visibilidad para esos modos).
        if (mode === "hecho") self.applySource();
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
    bind("vf-ogc-buscar", "click", function () { self.fetchOGCFotogramas(); });
    // Selector de vuelos: al cambiar, muestra los fotogramas del vuelo elegido
    // (reemplazando las capas del vuelo anterior).
    bind("vf-ogc-vuelos", "change", function () { self.seleccionarVuelo(this.value); });

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

    // Campos y botones del modo DEMO (generador sintético).
    var bindDemoParam = function (id, key, isInt) {
      bind(id, "change", function () {
        var v = isInt ? parseInt(this.value, 10) : parseFloat(this.value);
        self.data.demo.params[key] = isNaN(v) ? 0 : v;
        window.__vueloSharedData = self.data;
      });
    };
    bindDemoParam("vf-demo-rumbo", "rumbo", false);
    bindDemoParam("vf-demo-sepfoto", "sepFoto", false);
    bindDemoParam("vf-demo-seppasada", "sepPasada", false);
    bindDemoParam("vf-demo-z", "z", false);
    bindDemoParam("vf-demo-omega", "omega", false);
    bindDemoParam("vf-demo-phi", "phi", false);
    bindDemoParam("vf-demo-kappa", "kappa", false);
    // Lado de las pasadas (select der/izq).
    bind("vf-demo-lado", "change", function () {
      self.data.demo.params.lado = this.value;
      window.__vueloSharedData = self.data;
    });
    bind("vf-demo-add", "click", function () { self.addDemoFotograma(); });
    bind("vf-demo-newpass", "click", function () { self.nuevaPasadaDemo(); });
    bind("vf-demo-clear", "click", function () { self.clearDemo(); });

    bind("vf-crs", "change", function () { self.data.crs = this.value; });

    // Selects de mapeo de columnas.
    CAMPOS.forEach(function (c) {
      bind("vf-col-" + c.key, "change", function () {
        self.data.mapping[c.key] = this.value || null;
      });
    });

    // Parámetros de cámara (para dimensionar la huella). La altura de vuelo se
    // toma siempre de la Z del dato y el giro kappa se aplica si el dato lo trae.
    // Al editar un campo manualmente, el preset pasa a "Personalizada".
    bind("vf-fp-focal", "change", function () { self.data.footprint.focal_mm = parseFloat(this.value) || 0; self.markCustomPreset(); });
    bind("vf-fp-sw", "change", function () { self.data.footprint.sensor_w_mm = parseFloat(this.value) || 0; self.markCustomPreset(); });
    bind("vf-fp-sh", "change", function () { self.data.footprint.sensor_h_mm = parseFloat(this.value) || 0; self.markCustomPreset(); });
    bind("vf-fp-pxw", "change", function () { self.data.footprint.px_w = parseInt(this.value, 10) || 0; self.markCustomPreset(); });
    bind("vf-fp-pxh", "change", function () { self.data.footprint.px_h = parseInt(this.value, 10) || 0; self.markCustomPreset(); });

    // Desplegable de preset de cámara: al elegir un modelo rellena focal + sensor.
    bind("vf-cam-preset", "change", function () { self.applyCameraPreset(this.value); });

    // Alta de cámara nueva (se guarda en localStorage).
    bind("vf-cam-add-toggle", "click", function () { self.toggleCameraForm(); });
    bind("vf-cam-save", "click", function () { self.saveNewCamera(); });
    bind("vf-cam-cancel", "click", function () { self.toggleCameraForm(false); });

    // Parámetros del modo CÁLCULO.
    bind("vf-calc-areasrc", "change", function () { self.data.calc.areaSrc = this.value; self.applyCalcAreaSrc(); window.__vueloSharedData = self.data; });
    // Refresca el listado de capas al desplegar el select (por si se cargaron
    // capas después). mousedown salta antes de abrir; focus cubre el teclado.
    var capaSel = p.querySelector("#vf-calc-capa");
    if (capaSel) {
      var refrescarCapas = function () { self.fillCapaSelect(self.data.calc.capa || ""); };
      capaSel.addEventListener("mousedown", refrescarCapas);
      capaSel.addEventListener("focus", refrescarCapas);
    }
    // Al elegir capa: guarda, resetea el feature y puebla el selector de features.
    bind("vf-calc-capa", "change", function () {
      self.data.calc.capa = this.value;
      self.data.calc.feature = "";
      window.__vueloSharedData = self.data;
      self.fillFeatureSelect("");
    });
    bind("vf-calc-feature", "change", function () { self.data.calc.feature = this.value; window.__vueloSharedData = self.data; });
    bind("vf-calc-gsd", "change", function () { self.data.calc.gsd = parseFloat(this.value) || 0; window.__vueloSharedData = self.data; });
    bind("vf-calc-solapel", "change", function () { self.data.calc.solapeLong = parseFloat(this.value) || 0; window.__vueloSharedData = self.data; });
    bind("vf-calc-solapet", "change", function () { self.data.calc.solapeTrans = parseFloat(this.value) || 0; window.__vueloSharedData = self.data; });
    bind("vf-calc-tolgsd", "change", function () { self.data.calc.tolGsd = parseFloat(this.value) || 0; window.__vueloSharedData = self.data; });
    // Rumbo automático (checkbox): al marcar, deshabilita el input de rumbo manual.
    bind("vf-calc-rumboauto", "change", function () {
      self.data.calc.rumboAuto = !!this.checked;
      var rin = self.panel.querySelector("#vf-calc-rumbo");
      if (rin) rin.disabled = self.data.calc.rumboAuto;
      window.__vueloSharedData = self.data;
    });
    bind("vf-calc-rumbo", "change", function () { self.data.calc.rumbo = parseFloat(this.value) || 0; window.__vueloSharedData = self.data; });
    bind("vf-calc-buffer", "change", function () { self.data.calc.bufferPct = parseFloat(this.value) || 0; window.__vueloSharedData = self.data; });
    bind("vf-calc-run", "click", function () { self.calcularVuelo(); });
    bind("vf-calc-clear", "click", function () { self.clearCalc(); });

    // La visibilidad de las capas la gestiona el plugin externo de gestión de
    // capas (layerswitcher); el plugin ya no expone checks de visibilidad.

    // Acciones.
    bind("vf-render", "click", function () { self.render(); });
    bind("vf-clear", "click", function () { self.clearData(); });

    // Controles de animación del avión.
    bind("vf-anim-play", "click", function () { self.togglePlay(); });
    bind("vf-anim-restart", "click", function () { self.restartAnimation(); });

    // --- Acordeones ---
    var headers = p.querySelectorAll(".vuelo-accordion-header");
    var toggleAccordion = function(header) {
        var section = header.closest('.vf-accordion');
        if (!section) return;
        var key = section.getAttribute("data-acc");
        var isCollapsed = section.classList.toggle("collapsed");
        if (!self.data.ui) self.data.ui = { accordion: {} };
        self.data.ui.accordion[key] = isCollapsed;
        window.__vueloSharedData = self.data;
    };

    for (var hi = 0; hi < headers.length; hi++) {
      headers[hi].addEventListener("click", function () {
        toggleAccordion(this);
      });
      headers[hi].addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleAccordion(this);
        }
      });
    }
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
    set("#vf-fp-pxw", fp.px_w);
    set("#vf-fp-pxh", fp.px_h);

    // Puebla el desplegable de cámaras (presets + cámaras del usuario) y marca
    // el preset que coincida con los valores actuales (o "Personalizada").
    this.fillCameraSelect();
    this.selectMatchingPreset();

    // Campos del modo CÁLCULO (persisten entre swaps).
    if (d.calc) {
      var c = d.calc;
      set("#vf-calc-areasrc", c.areaSrc || "bbox");
      set("#vf-calc-gsd", c.gsd);
      set("#vf-calc-solapel", c.solapeLong);
      set("#vf-calc-solapet", c.solapeTrans);
      set("#vf-calc-tolgsd", c.tolGsd != null ? c.tolGsd : 10);
      set("#vf-calc-rumbo", c.rumbo);
      set("#vf-calc-buffer", c.bufferPct != null ? c.bufferPct : 10);
      // Estado del checkbox de rumbo automático + habilitado del input manual.
      var rumboAuto = (c.rumboAuto !== false);
      var chkAuto = p.querySelector("#vf-calc-rumboauto");
      if (chkAuto) chkAuto.checked = rumboAuto;
      var rin = p.querySelector("#vf-calc-rumbo");
      if (rin) rin.disabled = rumboAuto;
      this.fillCapaSelect(c.capa || "");
      this.applyCalcAreaSrc();
      if (c.resultados) this.renderCalcResults(c.resultados);
    }

    // Campos del modo OGC.
    if (d.ogc) {
      set("#vf-ogc-desde", d.ogc.fechaDesde || "");
      set("#vf-ogc-hasta", d.ogc.fechaHasta || "");
    }

    // Campos del generador DEMO (persisten entre swaps OL<->Cesium).
    if (d.demo && d.demo.params) {
      var dp = d.demo.params;
      set("#vf-demo-rumbo", dp.rumbo);
      set("#vf-demo-sepfoto", dp.sepFoto);
      set("#vf-demo-seppasada", dp.sepPasada);
      set("#vf-demo-z", dp.z);
      set("#vf-demo-omega", dp.omega);
      set("#vf-demo-phi", dp.phi);
      set("#vf-demo-kappa", dp.kappa);
      set("#vf-demo-lado", dp.lado || "der");
    }

    // Restaura la lista de vuelos y la selección tras un swap OL<->Cesium.
    if (d.vuelos && d.vuelos.length) {
      this.fillVueloSelect(d.vuelos, d.vueloSel || null);
    }

    // Restaura modo y fuente activos (persisten entre swaps OL<->Cesium).
    this.applyMode();
    this.applySource();

    // Si ya hay cabeceras cargadas (venimos de un swap), rellena los selects.
    if (d.headers && d.headers.length) {
      this.fillColumnSelects(d.headers, d.mapping);
      this.showConfigSections(true);
    }

    // Restaura el estado de los acordeones.
    var accState = (d.ui && d.ui.accordion) ? d.ui.accordion : {};
    var sections = p.querySelectorAll(".vf-accordion");
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      var key = section.getAttribute("data-acc");
      // Por defecto, todas las secciones colapsadas, a menos que el estado diga lo contrario.
      var isCollapsed = accState[key] !== false;
      section.classList.toggle("collapsed", isCollapsed);
    }
  };

  // ###################################################################
  //  CÁMARA: presets predefinidos + cámaras del usuario (localStorage)
  // ###################################################################

  // Todas las cámaras disponibles: presets fijos + las que el usuario ha añadido
  // (guardadas en localStorage). (Delega en CameraStore.getAll.)
  getAllCameras() {
    return CameraStore.getAll();
  };

  // Rellena el <select> de cámara con "Personalizada" + presets + cámaras del
  // usuario. Las del usuario van en un optgroup aparte para distinguirlas.
  fillCameraSelect() {
    var p = this.panel;
    var sel = p && p.querySelector("#vf-cam-preset");
    if (!sel) return;
    var esc = function (s) { return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); };
    var html = '<option value="custom">— Personalizada —</option>';
    CAMARA_PRESETS.forEach(function (c) {
      html += '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>";
    });
    var user = loadUserCameras();
    if (user.length) {
      html += '<optgroup label="Mis cámaras">';
      user.forEach(function (c) {
        html += '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>";
      });
      html += "</optgroup>";
    }
    sel.innerHTML = html;
  };

  // Aplica un preset de cámara por nombre: rellena focal + sensor en data y en
  // los inputs. "custom" no cambia los valores (edición manual libre).
  applyCameraPreset(name) {
    if (!name || name === "custom") return;
    var cam = this.getAllCameras().filter(function (c) { return c.name === name; })[0];
    if (!cam) return;
    var fp = this.data.footprint;
    fp.focal_mm = cam.focal_mm;
    fp.sensor_w_mm = cam.sensor_w_mm;
    fp.sensor_h_mm = cam.sensor_h_mm;
    if (cam.px_w) fp.px_w = cam.px_w;
    if (cam.px_h) fp.px_h = cam.px_h;
    window.__vueloSharedData = this.data;
    var p = this.panel;
    var set = function (id, v) { var el = p.querySelector(id); if (el) el.value = v; };
    set("#vf-fp-focal", fp.focal_mm);
    set("#vf-fp-sw", fp.sensor_w_mm);
    set("#vf-fp-sh", fp.sensor_h_mm);
    set("#vf-fp-pxw", fp.px_w);
    set("#vf-fp-pxh", fp.px_h);
  };

  // Marca en el desplegable el preset cuyos valores coinciden con los actuales
  // de la cámara; si ninguno coincide, selecciona "Personalizada".
  selectMatchingPreset() {
    var p = this.panel;
    var sel = p && p.querySelector("#vf-cam-preset");
    if (!sel) return;
    var fp = this.data.footprint;
    var eq = function (a, b) { return Math.abs((a || 0) - (b || 0)) < 1e-6; };
    var match = this.getAllCameras().filter(function (c) {
      return eq(c.focal_mm, fp.focal_mm) && eq(c.sensor_w_mm, fp.sensor_w_mm) && eq(c.sensor_h_mm, fp.sensor_h_mm);
    })[0];
    sel.value = match ? match.name : "custom";
  };

  // Fuerza el desplegable a "Personalizada" (tras editar un campo a mano).
  markCustomPreset() {
    var sel = this.panel && this.panel.querySelector("#vf-cam-preset");
    if (sel) sel.value = "custom";
  };

  // Muestra/oculta el mini-formulario de alta de cámara. Si se pasa force
  // (booleano) fuerza el estado; si no, alterna. Al abrir, precarga el formulario
  // con los valores actuales de la cámara para facilitar variantes.
  toggleCameraForm(force) {
    var p = this.panel;
    var form = p && p.querySelector("#vf-cam-form");
    var toggle = p && p.querySelector("#vf-cam-add-toggle");
    if (!form) return;
    var show = (typeof force === "boolean") ? force : form.hasAttribute("hidden");
    if (show) {
      form.removeAttribute("hidden");
      if (toggle) toggle.textContent = "✕ Cerrar";
      var fp = this.data.footprint;
      var set = function (id, v) { var el = p.querySelector(id); if (el) el.value = v; };
      set("#vf-cam-name", "");
      set("#vf-cam-focal", fp.focal_mm || "");
      set("#vf-cam-sw", fp.sensor_w_mm || "");
      set("#vf-cam-sh", fp.sensor_h_mm || "");
      set("#vf-cam-pxw", fp.px_w || "");
      set("#vf-cam-pxh", fp.px_h || "");
      this.setCamMsg("");
    } else {
      form.setAttribute("hidden", "");
      if (toggle) toggle.textContent = "＋ Añadir cámara";
    }
  };

  // Mensaje del formulario de cámara (validación / confirmación).
  setCamMsg(msg, cls) {
    var el = this.panel && this.panel.querySelector("#vf-cam-msg");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "vuelo-hint" + (cls ? " " + cls : "");
  };

  // Valida y guarda una cámara nueva en localStorage, la añade al desplegable,
  // la selecciona y aplica sus parámetros. Nombres duplicados se sobrescriben.
  saveNewCamera() {
    var p = this.panel;
    var val = function (id) { var el = p.querySelector(id); return el ? el.value : ""; };
    var name = String(val("#vf-cam-name") || "").trim();
    var focal = parseFloat(val("#vf-cam-focal"));
    var sw = parseFloat(val("#vf-cam-sw"));
    var sh = parseFloat(val("#vf-cam-sh"));
    var pxw = parseInt(val("#vf-cam-pxw"), 10);
    var pxh = parseInt(val("#vf-cam-pxh"), 10);

    if (!name) { this.setCamMsg("Indica un nombre para la cámara.", "error"); return; }
    if (isNaN(focal) || focal <= 0) { this.setCamMsg("Focal inválida.", "error"); return; }
    if (isNaN(sw) || sw <= 0) { this.setCamMsg("Sensor ancho inválido.", "error"); return; }
    if (isNaN(sh) || sh <= 0) { this.setCamMsg("Sensor alto inválido.", "error"); return; }
    if (isNaN(pxw) || pxw <= 0) { this.setCamMsg("Píxeles ancho inválidos.", "error"); return; }
    if (isNaN(pxh) || pxh <= 0) { this.setCamMsg("Píxeles alto inválidos.", "error"); return; }

    // Evita colisión con un nombre de preset fijo.
    var esPreset = CAMARA_PRESETS.some(function (c) { return c.name === name; });
    if (esPreset) { this.setCamMsg("Ese nombre ya existe como preset. Usa otro.", "error"); return; }

    var user = loadUserCameras();
    var idx = user.findIndex(function (c) { return c.name === name; });
    var cam = { name: name, focal_mm: focal, sensor_w_mm: sw, sensor_h_mm: sh, px_w: pxw, px_h: pxh };
    if (idx >= 0) user[idx] = cam; else user.push(cam);
    saveUserCameras(user);

    // Refresca el desplegable, selecciona la nueva cámara y aplica sus valores.
    this.fillCameraSelect();
    var sel = p.querySelector("#vf-cam-preset");
    if (sel) sel.value = name;
    this.applyCameraPreset(name);
    this.toggleCameraForm(false);
    this.setStatus("Cámara \u201c" + name + "\u201d guardada.", "ok");
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
    var ids = ["#vf-section-fp", "#vf-section-actions"];
    var p = this.panel;
    ids.forEach(function (id) {
      var el = p.querySelector(id);
      if (el) { if (on) el.removeAttribute("hidden"); else el.setAttribute("hidden", ""); }
    });
    var mapSec = p.querySelector("#vf-section-map");
    if (mapSec) {
      // El mapeo de columnas solo aplica al modo 'hecho' con fuente CSV.
      var showMap = on && this.data.mode === "hecho" && this.data.source === "csv";
      if (showMap) mapSec.removeAttribute("hidden"); else mapSec.setAttribute("hidden", "");
    }
  };

  // Muestra el modo activo (hecho / demo / calculo) y marca su botón. El modo
  // 'calculo' es un placeholder para la fase de planificación. Las secciones
  // compartidas (estado, cámara, acciones, animación) se muestran en los modos
  // que producen datos (hecho y demo) y se ocultan en 'calculo'.
  applyMode() {
    var p = this.panel;
    var mode = this.data.mode || "hecho";
    var panels = { hecho: "#vf-mode-hecho", demo: "#vf-mode-demo", calculo: "#vf-mode-calculo" };
    Object.keys(panels).forEach(function (key) {
      var el = p.querySelector(panels[key]);
      if (el) { if (mode === key) el.removeAttribute("hidden"); else el.setAttribute("hidden", ""); }
    });
    var btns = p.querySelectorAll(".vuelo-mode");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-mode") === mode);
    }

    // Visibilidad de las secciones compartidas según el modo:
    //  - 'calculo': la CÁMARA es necesaria (el GSD depende de ella), así que se
    //    muestra; se ocultan acciones (usa su propio botón Calcular) y animación;
    //    el estado se muestra. Si ya hay un plan renderizado, se ve la animación.
    //  - 'hecho'/'demo': lo decide showConfigSections según haya datos.
    if (mode === "calculo") {
      var st0 = p.querySelector("#vf-status");
      if (st0) st0.removeAttribute("hidden");
      var fpc = p.querySelector("#vf-section-fp");
      if (fpc) fpc.removeAttribute("hidden"); // cámara visible (GSD la necesita)
      var acc = p.querySelector("#vf-section-actions");
      if (acc) acc.setAttribute("hidden", "");
      this.updateAnimUI(); // muestra animación solo si hay línea de vuelo (plan)
    } else {
      var st = p.querySelector("#vf-status");
      if (st) st.removeAttribute("hidden");
      this.showConfigSections(!!(this.data.rows && this.data.rows.length));
      this.updateAnimUI();
    }

    // Reubica la sección Cámara según el modo: en 'demo' se coloca ARRIBA (para
    // elegir la cámara antes de generar) y se muestra siempre; en el resto vuelve
    // a su posición compartida y su visibilidad la decide showConfigSections.
    this.positionCameraSection(mode);
  };

  // Mueve el nodo de la sección Cámara (#vf-section-fp) entre su ancla compartida
  // (#vf-cam-home) y el ancla del panel Demo (#vf-cam-anchor-demo). Reutiliza el
  // mismo nodo (conserva los listeners ya enlazados). En 'demo' además la muestra
  // siempre, porque la cámara dimensiona la huella y debe elegirse antes.
  positionCameraSection(mode) {
    var p = this.panel;
    var fpSec = p.querySelector("#vf-section-fp");
    if (!fpSec) return;
    if (mode === "demo") {
      var anchorDemo = p.querySelector("#vf-cam-anchor-demo");
      if (anchorDemo && anchorDemo.nextSibling !== fpSec) {
        anchorDemo.parentNode.insertBefore(fpSec, anchorDemo.nextSibling);
      }
      fpSec.removeAttribute("hidden"); // en demo, la cámara siempre visible
    } else if (mode === "calculo") {
      // En cálculo la cámara se coloca ARRIBA del panel (el GSD la necesita).
      var anchorCalc = p.querySelector("#vf-cam-anchor-calc");
      if (anchorCalc && anchorCalc.nextSibling !== fpSec) {
        anchorCalc.parentNode.insertBefore(fpSec, anchorCalc.nextSibling);
      }
      fpSec.removeAttribute("hidden");
    } else {
      var home = p.querySelector("#vf-cam-home");
      if (home && home.nextSibling !== fpSec) {
        home.parentNode.insertBefore(fpSec, home.nextSibling);
      }
      // En 'hecho' la visibilidad la fija showConfigSections.
    }
  };

  // Muestra la fuente activa dentro del modo 'hecho' (ogc / csv) y marca su tab.
  // La fuente 'demo' se maneja como MODO aparte (no como sub-pestaña), por lo que
  // aquí solo se contemplan las fuentes del modo 'hecho'.
  applySource() {
    var p = this.panel;
    // Si la fuente activa es 'demo' (modo Demo), no hay sub-pestaña que resaltar;
    // usa 'ogc' como valor visual por defecto para el modo 'hecho'.
    var src = (this.data.source === "csv") ? "csv" : "ogc";
    var panels = { csv: "#vf-tab-csv", ogc: "#vf-tab-ogc" };
    Object.keys(panels).forEach(function (key) {
      var el = p.querySelector(panels[key]);
      if (el) { if (src === key) el.removeAttribute("hidden"); else el.setAttribute("hidden", ""); }
    });
    var tabs = p.querySelectorAll(".vuelo-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-source") === src);
    }
    // Reevalúa qué secciones de configuración se muestran (map solo en CSV).
    var hayDatos = !!(this.data.rows && this.data.rows.length);
    this.showConfigSections(hayDatos);
    // Refresca el texto informativo del generador demo (nº de fotogramas/pasada).
    this.updateDemoInfo();
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
    this._mdtCache = undefined; // nuevos datos: fuerza re-descarga del MDT
    this.data.zoomDone = false; // nuevos datos: re-encuadra a la nueva extensión
    this.data.anim = { playing: false, t: 0 }; // nuevos datos: reinicia animación
    this._stopRAF();
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

  // Autodetecta el huso UTM ETRS89 a partir del centro del bbox de búsqueda.
  // (Delega en OgcClient.detectUTMZone.)
  detectUTMZone(bbox3857) { return OgcClient.detectUTMZone(bbox3857); };

  // Convierte una fecha ISO (yyyy-mm-dd) al formato dd/mm/yyyy del proceso.
  // (Delega en OgcClient.toApiDate.)
  toApiDate(isoDate) { return OgcClient.toApiDate(isoDate); };

  // Lanza la búsqueda contra el proceso OGC bsq-fotogramas con el área visible
  // y el rango de fechas del panel. Al recibir la respuesta, agrupa los
  // fotogramas por vuelo y puebla el selector. Maneja errores de red/CORS.
  fetchOGCFotogramas() {
    var self = this;
    var d = this.data;

    var desde = this.toApiDate(d.ogc.fechaDesde);
    var hasta = this.toApiDate(d.ogc.fechaHasta);
    if (!desde || !hasta) {
      this.setStatus("Indica el rango de fechas (desde y hasta).", "error");
      return;
    }

    // Nueva búsqueda: limpia los vuelos y las capas del vuelo anterior.
    d.vuelos = null;
    d.vueloSel = null;
    this.removeLayers();
    this.showConfigSections(false);
    this.fillVueloSelect([], null);
    window.__vueloSharedData = d;

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

  // ---- Utilidades de nombre de fotograma / vuelo -------------------------

  // Descompone un nom_fichero en sus tokens (nomenclatura Fototeca IGN).
  // (Delega en OgcClient.parseNom.)
  vfParseNom(nom) { return OgcClient.parseNom(nom); };

  // Clave única de un vuelo = prefijo del nom_fichero + fecha del fotograma.
  // (Delega en OgcClient.vueloKey.)
  vueloKey(prefijo, fecha) { return OgcClient.vueloKey(prefijo, fecha); };

  // Etiqueta legible de un vuelo para el selector. (Delega en OgcClient.vueloLabel.)
  vueloLabel(vuelo) { return OgcClient.vueloLabel(vuelo); };

  // Procesa la respuesta del proceso: extrae los fotogramas, los AGRUPA POR VUELO
  // (prefijo del nom_fichero + fecha) y puebla el selector de vuelos. NO pinta
  // todavía: el usuario elige un vuelo y solo entonces se visualizan sus
  // fotogramas. La respuesta es { id, fotogramas: [ {...} ] }.
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

    var d = this.data;

    // Agrupa los fotogramas por vuelo (prefijo + fecha), ordena y etiqueta.
    // (Lógica pura delegada en OgcClient.groupByFlight.)
    var vuelos = OgcClient.groupByFlight(fot);

    // Guarda los vuelos en el estado (persisten entre swaps) y puebla el selector.
    d.vuelos = vuelos;
    d.vueloSel = null;
    window.__vueloSharedData = d;
    this.fillVueloSelect(vuelos, null);

    this.setStatus(fot.length + " fotogramas en " + vuelos.length +
      " vuelo(s). Elige un vuelo para visualizarlo.", "ok");
  };

  // Rellena el <select> de vuelos con la lista agrupada y muestra la sección.
  // selKey: clave del vuelo a marcar como seleccionado (o null para el placeholder).
  fillVueloSelect(vuelos, selKey) {
    var p = this.panel;
    var sel = p && p.querySelector("#vf-ogc-vuelos");
    var sec = p && p.querySelector("#vf-section-vuelos");
    if (!sel) return;
    var opts = ['<option value="">— Elige un vuelo —</option>'];
    (vuelos || []).forEach(function (v) {
      opts.push('<option value="' + v.key.replace(/"/g, "&quot;") + '">' + v.label + "</option>");
    });
    sel.innerHTML = opts.join("");
    if (selKey) sel.value = selKey;
    if (sec) {
      if (vuelos && vuelos.length) sec.removeAttribute("hidden");
      else sec.setAttribute("hidden", "");
    }
  };

  // Selecciona un vuelo por su clave: filtra sus fotogramas, los normaliza a
  // filas internas (ordenados por número de fotograma) y re-pinta el mapa
  // (reemplazando las capas del vuelo anterior).
  seleccionarVuelo(key) {
    var d = this.data;
    if (!d.vuelos) return;
    if (!key) { // volver al placeholder: limpia las capas pintadas
      d.vueloSel = null;
      window.__vueloSharedData = d;
      this.removeLayers();
      this.showConfigSections(false);
      this.setStatus("Elige un vuelo para visualizarlo.");
      return;
    }
    var vuelo = null;
    for (var i = 0; i < d.vuelos.length; i++) {
      if (d.vuelos[i].key === key) { vuelo = d.vuelos[i]; break; }
    }
    if (!vuelo) return;

    d.vueloSel = key;
    this.mapOGCToRows(vuelo.fotogramas);
    this.setStatus("Vuelo " + (vuelo.fecha || "") + ": " +
      vuelo.fotogramas.length + " fotogramas. Visualizando…", "ok");
    this.render();
  };

  // Normaliza un conjunto de fotogramas OGC (los de UN vuelo) al modelo interno
  // de filas, reutilizando el pipeline de render del CSV. Los fotogramas se
  // ORDENAN por número (secuencia de captura) para que la línea del vuelo una
  // los centros en orden. La 'pasada' es única por vuelo (una sola línea).
  mapOGCToRows(fotogramas) {
    var self = this;
    var d = this.data;
    var COL = {
      id: "id", pasada: "pasada", x: "x", y: "y", z: "z",
      fecha: "fecha", sensor: "sensor", nom_fichero: "nom_fichero",
      omega: "omega", phi: "phi", kappa: "kappa"
    };

    // Ordena por número de fotograma (asc) para trazar la línea del vuelo en el
    // orden de captura. Los que no tengan número van al final, en orden estable.
    var orden = fotogramas.slice().sort(function (a, b) {
      var na = self.vfParseNom(a && a.nom_fichero).num;
      var nb = self.vfParseNom(b && b.nom_fichero).num;
      if (na === null && nb === null) return 0;
      if (na === null) return 1;
      if (nb === null) return -1;
      return na - nb;
    });

    var rows = [];
    for (var i = 0; i < orden.length; i++) {
      var f = orden[i] || {};
      var nom = f.nom_fichero != null ? String(f.nom_fichero) : "";
      var pref = this.vfParseNom(nom).prefijo;
      rows.push({
        id: f.id_copia_digital != null ? f.id_copia_digital : (nom || (i + 1)),
        // Una sola pasada por vuelo = el prefijo del nom_fichero (todos iguales
        // dentro de un vuelo), así se dibuja UNA línea que une sus centros.
        pasada: pref,
        x: f.x_fotocentro_at,
        y: f.y_fotocentro_at,
        z: f.z_fotocentro_at,
        fecha: f.fecha_fotograma || null,
        sensor: null,
        nom_fichero: nom,
        // Orientación externa del IGN en RADIANES (omega/phi/kappa).
        omega: (typeof f.giro_o_at === "number") ? f.giro_o_at : null,
        phi: (typeof f.giro_p_at === "number") ? f.giro_p_at : null,
        kappa: (typeof f.giro_k_at === "number") ? f.giro_k_at : null
      });
    }

    // Modelo interno: fuente OGC con mapeo 1:1 (columnas ya normalizadas).
    d.source = "ogc";
    d.headers = Object.keys(COL);
    d.rows = rows;
    d.mapping = COL;
    this._mdtCache = undefined; // nuevo vuelo: fuerza re-descarga del MDT
    d.zoomDone = false;         // nuevo vuelo: re-encuadra a su extensión
    d.anim = { playing: false, t: 0 }; // nuevo vuelo: reinicia la animación
    this._stopRAF();
    window.__vueloSharedData = d;

    // Muestra las secciones de configuración (cámara, acciones). El mapeo de
    // columnas se mantiene oculto en OGC (columnas ya normalizadas).
    this.showConfigSections(true);
  };

  // ###################################################################
  //  MODO DEMO: generador de vuelo sintético fotograma a fotograma
  //  --------------------------------------------------------------------
  //  El primer fotograma de cada pasada se sitúa en el CENTRO de la pantalla
  //  en ese instante (lon/lat). Cada "Añadir fotograma" coloca el siguiente a
  //  `sepFoto` metros en la dirección `rumbo`. "Nueva pasada" desplaza el origen
  //  lateralmente (perpendicular al rumbo) `sepPasada` metros y reinicia la
  //  pasada tomando de nuevo el centro actual del mapa como referencia. Los
  //  datos se generan directamente en EPSG:4326 (sin proj4).
  // ###################################################################

  // Centro actual del mapa en [lon, lat] (EPSG:4326). Usa la vista de OpenLayers
  // cuando está disponible (implementación activa) reproyectando desde la
  // proyección del mapa; como respaldo usa map.getCenter() de API-IDEE.
  getMapCenterLonLat() {
    // 1) Vía OpenLayers directa: centro de la vista -> reproyectar a 4326.
    try {
      var impl = this.map.getMapImpl();
      if (impl && typeof impl.getView === "function" && window.ol) {
        var view = impl.getView();
        var c = view.getCenter();
        if (c) {
          var code = view.getProjection().getCode();
          if (code === "EPSG:4326") return [c[0], c[1]];
          return window.ol.proj.transform([c[0], c[1]], code, "EPSG:4326");
        }
      }
    } catch (e) { /* cae al respaldo */ }

    // 2) Respaldo: centro de API-IDEE. getCenter() devuelve {x,y} en la
    //    proyección del mapa; se reproyecta a 4326 si hace falta.
    try {
      var center = this.map.getCenter();
      if (center) {
        var proj = this.map.getProjection && this.map.getProjection();
        var pcode = proj && proj.code ? proj.code : "EPSG:3857";
        if (pcode === "EPSG:4326") return [center.x, center.y];
        if (window.ol) return window.ol.proj.transform([center.x, center.y], pcode, "EPSG:4326");
        return [center.x, center.y];
      }
    } catch (e) { /* nada */ }
    return null;
  };

  // Desplaza [lon,lat] `dist` metros con rumbo `bearingDeg` (0=N, 90=E). Cálculo
  // plano local (aprox. esférica), suficiente para las distancias de una demo.
  // (Delega en VueloGeo.offsetLonLat.)
  offsetLonLat(lon, lat, dist, bearingDeg) {
    return VueloGeo.offsetLonLat(lon, lat, dist, bearingDeg);
  };

  // Reconstruye las filas internas (d.rows) a partir de los fotogramas demo y
  // deja el modelo listo para render() (mapping 1:1, CRS 4326, fuente 'demo').
  rebuildDemoRows() {
    var d = this.data;
    var COL = {
      id: "id", pasada: "pasada", x: "x", y: "y", z: "z",
      fecha: "fecha", sensor: "sensor", omega: "omega", phi: "phi", kappa: "kappa"
    };
    var rows = d.demo.frames.map(function (f) {
      return {
        id: f.id, pasada: f.pasada, x: f.lon, y: f.lat, z: f.z,
        fecha: null, sensor: null,
        // omega/phi/kappa en RADIANES (la orientación de la huella los espera así).
        omega: f.omega, phi: f.phi, kappa: f.kappa
      };
    });
    d.source = "demo";
    d.crs = "EPSG:4326"; // ya en lon/lat: toLonLat los devuelve tal cual
    d.headers = Object.keys(COL);
    d.rows = rows;
    d.mapping = COL;
    // Cámara para dimensionar la huella (footprintPolygon usa d.footprint).
    this._mdtCache = undefined; // nuevos datos: fuerza re-descarga del MDT
    // En DEMO el usuario coloca los fotogramas desde el centro de SU vista actual,
    // así que NO se re-encuadra: marcamos zoomDone=true para respetar la vista y
    // que "Añadir fotograma" no provoque un salto de zoom.
    d.zoomDone = true;
    d.anim = { playing: false, t: 0 };
    this._stopRAF();
    window.__vueloSharedData = d;
  };

  // Rumbo efectivo (grados) de una pasada. Las pasadas alternan sentido para
  // simular el serpenteo real del vuelo (boustrophedon): la pasada 1 vuela en el
  // rumbo base; la 2, en rumbo+180; la 3, en rumbo base; etc. (según paridad).
  demoHeadingForPass(pasadaNum) {
    var base = this.data.demo.params.rumbo || 0;
    return ((pasadaNum - 1) % 2 === 0) ? base : base + 180;
  };

  // Añade un fotograma a la pasada actual del generador demo. El primero de la
  // pasada toma el centro de la pantalla; los siguientes se colocan a `sepFoto`
  // metros en la dirección efectiva de la pasada (que alterna por serpenteo).
  addDemoFotograma() {
    var d = this.data, dm = d.demo, pr = dm.params;
    var lon, lat;

    // Último fotograma de la pasada actual (si lo hay) para encadenar.
    var prev = null;
    for (var i = dm.frames.length - 1; i >= 0; i--) {
      if (dm.frames[i].pasadaNum === dm.pasada) { prev = dm.frames[i]; break; }
    }

    // Rumbo efectivo de esta pasada (alterna por serpenteo). El giro kappa de la
    // huella se orienta también con este rumbo, de modo que la huella "mira" en la
    // dirección de vuelo de la pasada (kappa del panel se suma como ajuste fino).
    var heading = this.demoHeadingForPass(dm.pasada);
    var kappaRad = (pr.kappa + heading) * Math.PI / 180;

    if (!prev) {
      // Primer fotograma de la pasada: centro actual del mapa.
      var c = this.getMapCenterLonLat();
      if (!c) { this.setStatus("No se pudo obtener el centro del mapa.", "error"); return; }
      lon = c[0]; lat = c[1];
      dm.lastPassStart = [lon, lat];
    } else {
      // Siguiente fotograma: desplaza desde el anterior según el rumbo efectivo.
      var off = this.offsetLonLat(prev.lon, prev.lat, pr.sepFoto, heading);
      lon = off[0]; lat = off[1];
    }

    dm.nFrame = (prev ? dm.nFrame : 0) + 1;
    dm.frames.push({
      id: "P" + dm.pasada + "-F" + dm.nFrame,
      pasada: "Pasada " + dm.pasada,
      pasadaNum: dm.pasada,
      lon: lon, lat: lat, z: pr.z,
      heading: heading, // rumbo efectivo de la pasada (grados)
      // omega/phi/kappa se guardan en RADIANES (la orientación de la huella los
      // espera así). Los inputs del panel están en grados.
      omega: pr.omega * Math.PI / 180,
      phi: pr.phi * Math.PI / 180,
      kappa: kappaRad
    });

    this.rebuildDemoRows();
    this.showConfigSections(true);
    this.updateDemoInfo();
    this.render();
  };

  // Inicia una nueva pasada en SENTIDO INVERSO (serpenteo). El primer fotograma
  // de la nueva pasada se coloca AL LADO del ÚLTIMO fotograma de la pasada
  // anterior (desplazamiento perpendicular = sep. pasadas), de modo que el vuelo
  // "gira en U" y la línea continua se une por ese lado. Si no había pasada
  // previa, arranca desde el centro del mapa.
  nuevaPasadaDemo() {
    var d = this.data, dm = d.demo, pr = dm.params;

    // Último fotograma de la pasada actual (extremo por el que se hace el giro).
    var last = null;
    for (var i = dm.frames.length - 1; i >= 0; i--) {
      if (dm.frames[i].pasadaNum === dm.pasada) { last = dm.frames[i]; break; }
    }

    // Dirección de desplazamiento entre pasadas: SIEMPRE respecto al rumbo BASE
    // (no al heading alterno de cada pasada), para que todas las pasadas avancen
    // hacia el MISMO lado. "der" = rumbo+90; "izq" = rumbo-90. Si se usara el
    // heading efectivo (que alterna 0/180), la 3ª pasada volvería sobre la 1ª.
    var lado = (pr.lado === "izq") ? -90 : 90;
    var dirPasada = (pr.rumbo || 0) + lado;

    var start;
    if (!last) {
      // Pasada actual vacía: arranca la nueva desde el centro del mapa.
      var c = this.getMapCenterLonLat();
      if (!c) { this.setStatus("No se pudo obtener el centro del mapa.", "error"); return; }
      start = c;
    } else {
      // Desplaza la separación entre pasadas hacia el lado elegido, partiendo del
      // ÚLTIMO fotograma de la pasada actual (giro en U con unión por ese lado).
      start = this.offsetLonLat(last.lon, last.lat, pr.sepPasada, dirPasada);
    }

    dm.pasada += 1;
    dm.nFrame = 1;
    dm.lastPassStart = start;

    // La nueva pasada vuela en sentido inverso: su kappa se orienta con el nuevo
    // rumbo efectivo (rumbo base + 180 por paridad).
    var heading = this.demoHeadingForPass(dm.pasada);
    dm.frames.push({
      id: "P" + dm.pasada + "-F1",
      pasada: "Pasada " + dm.pasada,
      pasadaNum: dm.pasada,
      lon: start[0], lat: start[1], z: pr.z,
      heading: heading,
      // omega/phi/kappa en RADIANES (los inputs del panel están en grados).
      omega: pr.omega * Math.PI / 180,
      phi: pr.phi * Math.PI / 180,
      kappa: (pr.kappa + heading) * Math.PI / 180
    });

    this.rebuildDemoRows();
    this.showConfigSections(true);
    this.updateDemoInfo();
    this.render();
  };

  // Limpia todos los fotogramas generados en el modo demo (reinicia el estado
  // del generador) y quita las capas pintadas.
  clearDemo() {
    var d = this.data;
    d.demo.frames = [];
    d.demo.pasada = 1;
    d.demo.nFrame = 0;
    d.demo.lastPassStart = null;
    this.removeLayers();
    d.rows = null;
    d.headers = null;
    d.mapping = {};
    this._mdtCache = undefined;
    d.zoomDone = false;
    this._stopRAF();
    d.anim = { playing: false, t: 0 };
    this._flightLine = null;
    this.updateAnimUI();
    window.__vueloSharedData = d;
    this.showConfigSections(false);
    this.updateDemoInfo();
    this.setStatus("Demo limpiada. Añade fotogramas para generar un vuelo.");
  };

  // Actualiza el texto informativo del generador demo (nº de fotogramas y de
  // pasadas actuales). Solo visible en la pestaña demo.
  updateDemoInfo() {
    var p = this.panel;
    var el = p && p.querySelector("#vf-demo-info");
    if (!el) return;
    var dm = this.data.demo;
    var n = dm.frames.length;
    if (!n) { el.textContent = "Sin fotogramas. Pulsa “Añadir fotograma”."; return; }
    var pasadas = {};
    dm.frames.forEach(function (f) { pasadas[f.pasadaNum] = true; });
    var np = Object.keys(pasadas).length;
    el.textContent = n + " fotograma" + (n === 1 ? "" : "s") + " en " +
      np + " pasada" + (np === 1 ? "" : "s") + " (pasada actual: " + dm.pasada + ").";
  };

  // ###################################################################
  //  MODO CÁLCULO: planificación de vuelo (GSD + solapes + cámara -> malla)
  //  --------------------------------------------------------------------
  //  Fórmulas fotogramétricas (cámara matricial, vista nadiral):
  //    pixel_pitch = sensor_mm / n_píxeles           (tamaño de píxel en el sensor)
  //    H (altura de vuelo) = GSD * focal / pixel_pitch
  //    huella en suelo:  Wx = GSD * px_w ;  Wy = GSD * px_h
  //    avance entre fotogramas (base): B = Wy * (1 - solapeLong)
  //    separación entre pasadas:       A = Wx * (1 - solapeTrans)
  //  Con eso se teselan el área en una malla de pasadas (dirección = rumbo) y de
  //  fotogramas por pasada, y se genera un vuelo serpenteante reutilizando el
  //  pipeline de render (fotocentros + huellas + líneas + animación del avión).
  // ###################################################################

  // Muestra/oculta el selector de capa según el origen de área elegido.
  applyCalcAreaSrc() {
    var p = this.panel;
    var row = p && p.querySelector("#vf-calc-capa-row");
    var frow = p && p.querySelector("#vf-calc-feature-row");
    // La fila del buffer solo es relevante al recortar a una feature.
    var brow = p && p.querySelector("#vf-calc-buffer-row");
    if (!row) return;
    if (this.data.calc.areaSrc === "feature") {
      row.removeAttribute("hidden");
      if (frow) frow.removeAttribute("hidden");
      if (brow) brow.removeAttribute("hidden");
      // Refresca la lista de capas al mostrarla y puebla los features de la capa
      // seleccionada (puede haberse cargado la capa después de abrir el modo).
      this.fillCapaSelect(this.data.calc.capa || "");
      this.fillFeatureSelect(this.data.calc.feature || "");
    } else {
      row.setAttribute("hidden", "");
      if (frow) frow.setAttribute("hidden", "");
      if (brow) brow.setAttribute("hidden", "");
    }
  };

  // Enumera las capas VECTORIALES del mapa (vía API-IDEE, que expone el NOMBRE
  // real de cada capa) que tienen features de polígono, para el selector de área
  // por feature. Excluye las capas internas del propio plugin y la de dibujo.
  // Devuelve [{name, olLayer}]. (El modo cálculo se usa en 2D.)
  listVectorLayers() {
    var out = [];
    // Nombres de capas propias del plugin a excluir del selector.
    var PROPIAS = { "Huellas de fotograma": 1, "Líneas de pasada": 1, "Centros de fotograma": 1, "Avión": 1, "__draw__": 1 };
    try {
      var capas = (this.map && typeof this.map.getLayers === "function") ? this.map.getLayers() : [];
      for (var i = 0; i < capas.length; i++) {
        var capa = capas[i];
        try {
          var nombre = capa && (capa.name || capa.legend);
          if (!nombre || PROPIAS[nombre]) continue;
          // Obtiene el ol.Layer subyacente para leer sus features.
          var olLayer = capa.getImpl && capa.getImpl().getLayer && capa.getImpl().getLayer();
          var src = olLayer && olLayer.getSource && olLayer.getSource();
          if (!src || typeof src.getFeatures !== "function") continue; // no vectorial
          var feats = src.getFeatures();
          if (!feats || !feats.length) continue;
          var hasPoly = feats.some(function (f) {
            var g = f.getGeometry && f.getGeometry();
            var t = g && g.getType && g.getType();
            return t === "Polygon" || t === "MultiPolygon";
          });
          if (!hasPoly) continue;
          // Nombre único (por si hubiera capas homónimas).
          var base = String(nombre), uniq = base, k = 2;
          while (out.some(function (o) { return o.name === uniq; })) { uniq = base + " (" + (k++) + ")"; }
          out.push({ name: uniq, olLayer: olLayer });
        } catch (e) { /* ignora esta capa */ }
      }
    } catch (e) { /* nada */ }
    return out;
  };

  // Rellena el <select> de capas con las capas vectoriales de polígonos. Es
  // IDEMPOTENTE: solo reconstruye el <select> si la lista de capas cambió respecto
  // a las opciones actuales. Esto evita que el refresco al desplegar el select
  // (mousedown/focus) reconstruya el DOM en pleno gesto y anule la selección.
  fillCapaSelect(selName) {
    var p = this.panel;
    var sel = p && p.querySelector("#vf-calc-capa");
    if (!sel) return;
    var capas = this.listVectorLayers();
    var nuevos = capas.map(function (c) { return c.name; });

    // Opciones actuales (sin el placeholder) para comparar.
    var actuales = [];
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value !== "") actuales.push(sel.options[i].value);
    }
    var iguales = actuales.length === nuevos.length &&
      actuales.every(function (v, idx) { return v === nuevos[idx]; });
    if (iguales) {
      // Sin cambios: no tocar el DOM (preserva la selección/apertura del usuario).
      if (selName !== undefined && selName !== null && selName !== "") sel.value = selName;
      return;
    }

    var esc = function (s) { return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); };
    var html = '<option value="">— Elige una capa —</option>';
    capas.forEach(function (c) { html += '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>"; });
    sel.innerHTML = html;
    if (selName) sel.value = selName;
  };

  // Devuelve los features de POLÍGONO de la capa elegida (ol.Feature[]), en el
  // orden de la fuente. Vacío si no hay capa seleccionada o no es válida.
  getCapaFeatures() {
    var d = this.data.calc;
    if (!d.capa) return [];
    var capa = this.listVectorLayers().filter(function (c) { return c.name === d.capa; })[0];
    if (!capa) return [];
    try {
      var feats = capa.olLayer.getSource().getFeatures() || [];
      return feats.filter(function (f) {
        var g = f.getGeometry && f.getGeometry();
        var t = g && g.getType && g.getType();
        return t === "Polygon" || t === "MultiPolygon";
      });
    } catch (e) { return []; }
  };

  // Etiqueta legible de un feature: usa un atributo con nombre si lo tiene
  // (name/nombre/NOMBRE/id...), o "Elemento N" como respaldo.
  featureLabel(f, i) {
    try {
      var props = (f.getProperties && f.getProperties()) || {};
      var keys = ["nombre", "name", "NOMBRE", "Nombre", "NAME", "id", "ID", "gid", "cod", "codigo"];
      for (var k = 0; k < keys.length; k++) {
        if (props[keys[k]] != null && props[keys[k]] !== "") return String(props[keys[k]]);
      }
    } catch (e) { /* nada */ }
    return "Elemento " + (i + 1);
  };

  // Rellena el <select> de features (elementos) de la capa elegida. La opción
  // vacía significa "toda la capa" (envolvente de todos los polígonos).
  fillFeatureSelect(selIdx) {
    var p = this.panel;
    var sel = p && p.querySelector("#vf-calc-feature");
    if (!sel) return;
    var self = this;
    var feats = this.getCapaFeatures();
    var esc = function (s) { return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); };
    var html = '<option value="">— Toda la capa —</option>';
    feats.forEach(function (f, i) {
      html += '<option value="' + i + '">' + esc(self.featureLabel(f, i)) + "</option>";
    });
    sel.innerHTML = html;
    if (selIdx !== undefined && selIdx !== null && selIdx !== "") sel.value = String(selIdx);
  };

  // Devuelve el área de vuelo como un anillo de coords [lon,lat] (EPSG:4326):
  //  - areaSrc "bbox": rectángulo del encuadre visible del mapa.
  //  - areaSrc "feature": envolvente (bbox) del/los polígono(s) de la capa elegida.
  // Se usa el bbox del feature (no el polígono exacto) para teselar la malla; el
  // recorte fino al polígono queda como mejora futura. Devuelve null si no puede.
  getAreaExtent4326() {
    var d = this.data.calc;
    if (d.areaSrc === "feature") {
      var capas = this.listVectorLayers();
      var capa = capas.filter(function (c) { return c.name === d.capa; })[0];
      if (!capa) return null;
      try {
        var ext;
        // Si hay un feature concreto elegido, se usa su envolvente; si no ("toda
        // la capa"), la envolvente de toda la capa.
        if (d.feature !== "" && d.feature !== null && d.feature !== undefined) {
          var feats = this.getCapaFeatures();
          var f = feats[parseInt(d.feature, 10)];
          if (!f || !f.getGeometry) return null;
          ext = f.getGeometry().getExtent();
        } else {
          ext = capa.olLayer.getSource().getExtent();
        }
        if (!ext || !isFinite(ext[0])) return null;
        return this._extentToLonLat(ext);
      } catch (e) { return null; }
    }
    // bbox del encuadre visible.
    try {
      var impl = this.map.getMapImpl();
      if (impl && typeof impl.getView === "function" && window.ol) {
        var view = impl.getView();
        var size = impl.getSize();
        if (size && size[0] && size[1]) {
          var e = view.calculateExtent(size);
          return this._extentToLonLat(e, view.getProjection().getCode());
        }
      }
    } catch (e) { /* respaldo abajo */ }
    return null;
  };

  // Devuelve el ANILLO del área de vuelo como coords [[lon,lat],...] en EPSG:4326.
  //  - areaSrc "feature": el anillo exterior del/los polígono(s). Si se elige un
  //    feature concreto, su anillo exterior; si "toda la capa", se concatenan los
  //    vértices de todos los polígonos (envolvente aproximada por sus vértices).
  //  - areaSrc "bbox": las 4 esquinas del encuadre visible.
  // Se usa para calcular el rumbo óptimo (proyección sobre ejes) y, en fases
  // posteriores, el recorte real. Devuelve null si no puede.
  getAreaRing4326() {
    var d = this.data.calc;
    var self = this;
    // Extrae los anillos exteriores (coords en la proyección del mapa) de una
    // geometría OL (Polygon o MultiPolygon) y los reproyecta a lon/lat.
    var geomToRings = function (geom) {
      var rings = [];
      try {
        var t = geom.getType && geom.getType();
        if (t === "Polygon") {
          rings.push(geom.getCoordinates()[0]);
        } else if (t === "MultiPolygon") {
          geom.getCoordinates().forEach(function (poly) { rings.push(poly[0]); });
        }
      } catch (e) { /* nada */ }
      return rings;
    };
    if (d.areaSrc === "feature") {
      try {
        var proj = this.map.getMapImpl().getView().getProjection().getCode();
        var rings = [];
        if (d.feature !== "" && d.feature !== null && d.feature !== undefined) {
          var feats = this.getCapaFeatures();
          var f = feats[parseInt(d.feature, 10)];
          if (!f || !f.getGeometry) return null;
          rings = geomToRings(f.getGeometry());
        } else {
          var all = this.getCapaFeatures();
          all.forEach(function (ft) {
            if (ft.getGeometry) rings = rings.concat(geomToRings(ft.getGeometry()));
          });
        }
        if (!rings.length) return null;
        // Concatena los vértices de todos los anillos, reproyectados a lon/lat.
        var out = [];
        rings.forEach(function (ring) {
          ring.forEach(function (xy) {
            if (proj === "EPSG:4326") out.push([xy[0], xy[1]]);
            else out.push(window.ol.proj.transform([xy[0], xy[1]], proj, "EPSG:4326"));
          });
        });
        return out.length ? out : null;
      } catch (e) { return null; }
    }
    // bbox del encuadre visible -> 4 esquinas.
    var ext = this.getAreaExtent4326();
    if (!ext) return null;
    return [
      [ext[0], ext[1]], [ext[2], ext[1]],
      [ext[2], ext[3]], [ext[0], ext[3]], [ext[0], ext[1]]
    ];
  };

  // Convierte un extent [minx,miny,maxx,maxy] de la proyección del mapa a
  // [minLon,minLat,maxLon,maxLat] en EPSG:4326.
  _extentToLonLat(ext, code) {
    var proj = code;
    if (!proj) {
      try { proj = this.map.getMapImpl().getView().getProjection().getCode(); }
      catch (e) { proj = "EPSG:3857"; }
    }
    if (proj === "EPSG:4326") return [ext[0], ext[1], ext[2], ext[3]];
    var mn = window.ol.proj.transform([ext[0], ext[1]], proj, "EPSG:4326");
    var mx = window.ol.proj.transform([ext[2], ext[3]], proj, "EPSG:4326");
    return [mn[0], mn[1], mx[0], mx[1]];
  };

  // Calcula el plan de vuelo a partir del GSD, solapes y cámara, teselando el
  // área en una malla de pasadas (dirección = rumbo) y fotogramas. Genera los
  // frames en el estado demo (reutiliza su pipeline de render y animación) y
  // muestra los resultados numéricos.
  calcularVuelo() {
    var c = this.data.calc;
    var fp = this.data.footprint;

    // Validaciones de cámara (necesita píxeles para derivar el GSD->altura).
    if (!fp.focal_mm || !fp.sensor_w_mm || !fp.sensor_h_mm) {
      this.setStatus("Completa los parámetros de la cámara (focal y sensor).", "error"); return;
    }
    if (!fp.px_w || !fp.px_h) {
      this.setStatus("La cámara necesita nº de píxeles (ancho y alto) para calcular el GSD.", "error"); return;
    }
    if (!c.gsd || c.gsd <= 0) { this.setStatus("Indica un GSD válido (cm/píxel).", "error"); return; }

    var ext = this.getAreaExtent4326();
    if (!ext) { this.setStatus("No se pudo obtener el área de vuelo.", "error"); return; }

    // --- Fórmulas fotogramétricas ---
    var gsd_m = c.gsd / 100;                       // GSD en metros/píxel
    var pitch_w = fp.sensor_w_mm / fp.px_w;        // tamaño de píxel (mm) ancho
    // Altura de vuelo: H = GSD * focal / pixel_pitch (todo coherente en mm).
    var altura = gsd_m * fp.focal_mm / pitch_w;    // metros
    var Wx = gsd_m * fp.px_w;                      // huella en suelo, ancho (m)
    var Wy = gsd_m * fp.px_h;                      // huella en suelo, alto (m)
    var sl = Math.min(Math.max(c.solapeLong, 0), 95) / 100;
    var st = Math.min(Math.max(c.solapeTrans, 0), 95) / 100;
    var B = Wy * (1 - sl);                         // avance entre fotogramas (m)
    var A = Wx * (1 - st);                         // separación entre pasadas (m)
    if (B <= 0 || A <= 0) { this.setStatus("Solapes demasiado altos: reduce los porcentajes.", "error"); return; }

    // --- Orientación del vuelo (rumbo) ---
    // Anillo real del área (polígono de la feature o esquinas del bbox). Se usa
    // para elegir el rumbo óptimo y para teselar según las extensiones REALES
    // proyectadas (no la diagonal del bbox, que sobreestima el nº de fotogramas).
    var ring = this.getAreaRing4326();
    if (!ring || ring.length < 3) {
      // Respaldo: 4 esquinas del bbox si no hay anillo.
      ring = [[ext[0], ext[1]], [ext[2], ext[1]], [ext[2], ext[3]], [ext[0], ext[3]]];
    }

    // Rumbo: automático (minimiza nº de pasadas) u override manual del panel.
    var rumbo;
    var rumboOptimo = null;
    if (c.rumboAuto === false) {
      rumbo = c.rumbo || 0;
    } else {
      var opt = FlightPlanner.optimalHeading(ring, A, 2);
      rumbo = opt ? opt.rumbo : (c.rumbo || 0);
      rumboOptimo = rumbo;
    }

    // --- Extensiones reales del área proyectadas sobre los ejes del rumbo ---
    var lm = FlightPlanner.ringToLocalMeters(ring);
    var extP = FlightPlanner.projectExtents(lm.pts, rumbo);
    var largoPasada = extP.alongExt;                 // longitud de cada pasada (m)
    var anchoTotal = extP.acrossExt;                 // ancho a cubrir con pasadas (m)

    var nFotosPorPasada = Math.max(2, Math.ceil(largoPasada / B) + 1);
    var nPasadas = Math.max(1, Math.ceil(anchoTotal / A) + 1);

    // Punto de arranque: centro del área desplazado media malla en along/across,
    // de modo que la malla (centrada) cubra toda la extensión proyectada.
    var centro = lm.center;
    var media = { along: (nFotosPorPasada - 1) * B / 2, across: (nPasadas - 1) * A / 2 };
    // Esquina inicial = centro - media_along*dir - media_across*perp.
    var startCorner = this._offsetMeters(centro, -media.along, rumbo);
    startCorner = this._offsetMeters(startCorner, -media.across, rumbo + 90);

    // Métricas del bbox (para el bloque de resultados / compatibilidad).
    var cLat = (ext[1] + ext[3]) / 2;
    var anchoAreaM = (ext[2] - ext[0]) * VueloGeo.mPerDegLon(cLat);
    var altoAreaM = (ext[3] - ext[1]) * VueloGeo.M_PER_DEG_LAT;

    // --- Genera los frames serpenteantes en el estado demo ---
    var frames = [];
    var kappaBase = rumbo * Math.PI / 180;
    for (var pi = 0; pi < nPasadas; pi++) {
      // Origen de la pasada pi: desde startCorner, desplazado pi*A en transversal.
      var passStart = this._offsetMeters(startCorner, pi * A, rumbo + 90);
      // Sentido serpenteante: pasadas pares en rumbo, impares en rumbo+180.
      var inverse = (pi % 2 !== 0);
      var heading = inverse ? rumbo + 180 : rumbo;
      var hkappa = heading * Math.PI / 180;
      for (var fi = 0; fi < nFotosPorPasada; fi++) {
        var idx = inverse ? (nFotosPorPasada - 1 - fi) : fi;
        var pos = this._offsetMeters(passStart, idx * B, rumbo);
        frames.push({
          id: "P" + (pi + 1) + "-F" + (fi + 1),
          pasada: "Pasada " + (pi + 1),
          pasadaNum: pi + 1,
          lon: pos[0], lat: pos[1], z: altura,
          heading: heading,
          omega: 0, phi: 0, kappa: hkappa
        });
      }
    }

    // Metadatos comunes del plan (para los resultados numéricos).
    var meta = {
      altura: altura, gsd: c.gsd, Wx: Wx, Wy: Wy, B: B, A: A,
      nPasadas: nPasadas, nFotosPorPasada: nFotosPorPasada,
      nFotos: frames.length, anchoAreaM: anchoAreaM, altoAreaM: altoAreaM,
      rumbo: rumbo, rumboOptimo: rumboOptimo
    };

    // --- GSD variable con el terreno (altura por pasada según cota media) ---
    // El GSD real depende de la altura sobre el terreno. Para respetar el GSD
    // objetivo, cada pasada vuela a una altura absoluta = cota_media_franja +
    // GSD·focal/pitch. Se descarga el MDT del área y se ajustan las alturas por
    // pasada. Si el MDT no está disponible / fuera de cobertura, se mantiene la
    // altura fija (respaldo) y se avisa.
    var self = this;
    var gsdObjM = gsd_m;
    var pitch_mm = pitch_w;
    var tolPct = (typeof c.tolGsd === "number" && c.tolGsd > 0) ? (c.tolGsd / 100) : 0.10;

    // ¿Recorte a feature? Solo si el área es un polígono de capa.
    var recortar = (c.areaSrc === "feature");
    var bufferPct = (typeof c.bufferPct === "number" && c.bufferPct >= 0) ? c.bufferPct : 10;

    var bbox = this.dataBBox4326FromRing(ring);
    this.setStatus("Descargando el modelo digital del terreno (MDT) para ajustar alturas…");
    MdtService.fetch(bbox).then(function (mdt) {
      // Guarda el MDT para reutilizarlo en el recorte (huellas sobre el terreno).
      self._calcMDT = mdt || null;
      if (mdt) {
        var res = FlightPlanner.applyPerPassHeights(frames, {
          sampleCota: function (lon, lat) { return FootprintBuilder.sampleCota(mdt, lon, lat); },
          gsdObjM: gsdObjM, focal_mm: fp.focal_mm, pitch_mm: pitch_mm, tolPct: tolPct
        });
        meta.nAlturas = res.nAlturas;
        meta.algunaFueraTol = res.algunaFueraTol;
        meta.tolPct = tolPct;
        meta.alturaVariable = res.nAlturas > 1;
      } else {
        meta.nAlturas = 1;
        meta.algunaFueraTol = false;
        meta.alturaVariable = false;
        meta.sinMDT = true;
      }
      if (!recortar) {
        self._finalizarCalculo(frames, meta, nPasadas, nFotosPorPasada);
        return;
      }
      // Recorte a la feature (requiere turf, carga bajo demanda).
      self.setStatus("Recortando el vuelo al área (cargando turf.js)…");
      ensureTurf().then(function (turf) {
        var areaPoly = FlightPlanner.bufferArea(turf, ring, bufferPct);
        if (!areaPoly) { // sin geometría válida: no recorta
          meta.recorteAplicado = false;
          self._finalizarCalculo(frames, meta, nPasadas, nFotosPorPasada);
          return;
        }
        var mdtRef = self._calcMDT;
        var buildFootprint = function (frame) {
          var r = FootprintBuilder.build(fp, frame.lon, frame.lat, frame.z,
            frame.omega, frame.phi, frame.kappa, mdtRef);
          return r ? r.ring : null;
        };
        var clip = FlightPlanner.clipToFeature(turf, frames, areaPoly, buildFootprint);
        meta.recorteAplicado = true;
        meta.bufferPct = bufferPct;
        meta.nFotosRecortados = clip.removed;
        meta.coberturaOk = clip.coverageOk;
        meta.coberturaMin = clip.minCoverage;
        meta.nFotos = clip.kept.length;
        // Recalcula pasadas presentes tras el recorte (algunas pueden quedar vacías).
        var passSet = {};
        clip.kept.forEach(function (f) { passSet[f.pasadaNum] = true; });
        var nPasFinal = Object.keys(passSet).length;
        self._finalizarCalculo(clip.kept, meta, nPasFinal, nFotosPorPasada);
      }).catch(function () {
        // turf no disponible: degrada sin recorte, avisando.
        meta.recorteAplicado = false;
        meta.turfError = true;
        self._finalizarCalculo(frames, meta, nPasadas, nFotosPorPasada);
      });
    }).catch(function () {
      // Error de red del MDT: respaldo a altura fija, sin recorte.
      meta.nAlturas = 1; meta.alturaVariable = false; meta.sinMDT = true;
      self._finalizarCalculo(frames, meta, nPasadas, nFotosPorPasada);
    });
  };

  // Finaliza el cálculo: vuelca los frames al estado demo, guarda resultados y
  // re-renderiza. Separado de calcularVuelo para poder invocarse tras la descarga
  // asíncrona del MDT (ajuste de alturas por pasada).
  _finalizarCalculo(frames, meta, nPasadas, nFotosPorPasada) {
    var c = this.data.calc;
    var dm = this.data.demo;
    dm.frames = frames;
    dm.pasada = nPasadas;
    dm.nFrame = nFotosPorPasada;
    dm.lastPassStart = null;
    this.rebuildDemoRows();

    c.resultados = meta;
    window.__vueloSharedData = this.data;

    this.renderCalcResults(meta);
    this.updateAnimUI();
    this.render();

    var extraAlt = meta.alturaVariable
      ? (" · " + meta.nAlturas + " alturas por relieve")
      : (meta.sinMDT ? " · altura fija (sin MDT)" : " · altura uniforme");
    var extraRec = meta.recorteAplicado
      ? (" · recortado al área (buffer " + meta.bufferPct + "%, " + meta.nFotosRecortados + " descartados)")
      : (meta.turfError ? " · sin recorte (turf no disponible)" : "");
    var avisoTol = meta.algunaFueraTol
      ? " Aviso: alguna pasada supera la tolerancia de GSD por relieve interno." : "";
    var avisoCob = (meta.recorteAplicado && meta.coberturaOk === false)
      ? " Aviso: hay zonas del área con menos de 2 huellas (sube el solape o el buffer)." : "";
    this.setStatus("Plan calculado: " + frames.length + " fotogramas en " +
      nPasadas + " pasadas" + extraAlt + extraRec + "." + avisoTol + avisoCob,
      (avisoTol || avisoCob) ? "" : "ok");
  };

  // bbox [minLon,minLat,maxLon,maxLat] (EPSG:4326) de un anillo [[lon,lat],...],
  // con el margen del MDT para cubrir las esquinas de las huellas.
  dataBBox4326FromRing(ring) {
    var minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (var i = 0; i < ring.length; i++) {
      var p = ring[i];
      if (p[0] < minLon) minLon = p[0];
      if (p[1] < minLat) minLat = p[1];
      if (p[0] > maxLon) maxLon = p[0];
      if (p[1] > maxLat) maxLat = p[1];
    }
    return [minLon - MDT_MARGIN_DEG, minLat - MDT_MARGIN_DEG,
            maxLon + MDT_MARGIN_DEG, maxLat + MDT_MARGIN_DEG];
  };

  // Desplaza [lon,lat] `dist` metros con rumbo `bearingDeg` (0=N, 90=E). Igual
  // que offsetLonLat (demo), replicado aquí para claridad del bloque de cálculo.
  _offsetMeters(ll, dist, bearingDeg) {
    return this.offsetLonLat(ll[0], ll[1], dist, bearingDeg);
  };

  // Muestra los resultados numéricos del cálculo en el panel.
  renderCalcResults(r) {
    var p = this.panel;
    var el = p && p.querySelector("#vf-calc-results");
    if (!el || !r) return;
    var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString("es-ES"); };
    var f0 = function (n) { return Math.round(n).toLocaleString("es-ES"); };
    // Etiqueta de rumbo: indica si es óptimo (auto) o manual.
    var rumboTxt = (r.rumbo != null) ? f0(r.rumbo) + "°" : "—";
    if (r.rumboOptimo != null) rumboTxt += " (óptimo)";
    // Etiqueta de altura: fija o variable por relieve.
    var alturaTxt;
    if (r.alturaVariable) {
      alturaTxt = f0(r.altura) + " m (var.: " + r.nAlturas + " alturas)";
    } else {
      alturaTxt = f0(r.altura) + " m" + (r.sinMDT ? " (sin MDT)" : "");
    }
    // Fila de cobertura (solo con recorte a feature).
    var coberturaRow = "";
    if (r.recorteAplicado) {
      var cobTxt = (r.coberturaOk ? "≥2 huellas ✓" : "< 2 en zonas ✗") +
        (r.coberturaMin != null ? " (mín. " + f0(r.coberturaMin) + ")" : "");
      coberturaRow =
        '<div class="vuelo-calc-row"><span>Recorte al área</span><strong>buffer ' + f0(r.bufferPct) + '%</strong></div>' +
        '<div class="vuelo-calc-row"><span>Cobertura</span><strong>' + cobTxt + '</strong></div>';
    }
    el.innerHTML =
      '<div class="vuelo-calc-row"><span>Rumbo del vuelo</span><strong>' + rumboTxt + '</strong></div>' +
      '<div class="vuelo-calc-row"><span>Altura de vuelo</span><strong>' + alturaTxt + '</strong></div>' +
      '<div class="vuelo-calc-row"><span>Huella (ancho × alto)</span><strong>' + f0(r.Wx) + ' × ' + f0(r.Wy) + ' m</strong></div>' +
      '<div class="vuelo-calc-row"><span>Sep. entre fotogramas</span><strong>' + f1(r.B) + ' m</strong></div>' +
      '<div class="vuelo-calc-row"><span>Sep. entre pasadas</span><strong>' + f1(r.A) + ' m</strong></div>' +
      '<div class="vuelo-calc-row"><span>Nº de pasadas</span><strong>' + f0(r.nPasadas) + '</strong></div>' +
      '<div class="vuelo-calc-row"><span>Fotogramas/pasada</span><strong>' + f0(r.nFotosPorPasada) + '</strong></div>' +
      '<div class="vuelo-calc-row"><span>Fotogramas totales</span><strong>' + f0(r.nFotos) + '</strong></div>' +
      coberturaRow;
    el.removeAttribute("hidden");
  };

  // Limpia el plan calculado: quita capas, resetea frames y resultados, y deja
  // el panel de cálculo listo para recalcular (mantiene los parámetros y la
  // cámara visible, ya que seguimos en modo cálculo).
  clearCalc() {
    this.removeLayers();
    this.data.rows = null;
    this.data.headers = null;
    this.data.mapping = {};
    this._mdtCache = undefined;
    this.data.zoomDone = false;
    this._stopRAF();
    this.data.anim = { playing: false, t: 0 };
    this._flightLine = null;
    this.data.demo.frames = [];
    this.data.calc.resultados = null;
    window.__vueloSharedData = this.data;
    var el = this.panel && this.panel.querySelector("#vf-calc-results");
    if (el) { el.innerHTML = ""; el.setAttribute("hidden", ""); }
    this.updateAnimUI();
    this.setStatus("Plan limpiado. Ajusta los parámetros y pulsa “Calcular vuelo”.");
  };

  // ###################################################################
  //  CONSTRUCCIÓN DE GEOJSON (reproyección + geometrías)
  // ###################################################################

  // Reproyecta [x,y] del CRS origen a [lon,lat] WGS84. (Delega en ProjUtil.toLonLat.)
  toLonLat(x, y, crs) { return ProjUtil.toLonLat(x, y, crs); };

  // ###################################################################
  //  MDT DEL IGN (WCS GeoTIFF) — cota del terreno para las huellas
  // ###################################################################

  // Recorta un valor al rango [lo, hi]. (Delega en VueloGeo.clamp.)
  clampVal(v, lo, hi) { return VueloGeo.clamp(v, lo, hi); }

  // Construye la URL WCS GetCoverage para el bbox pedido. (Delega en MdtService.buildUrl.)
  buildMDTUrl(ext4326) { return MdtService.buildUrl(ext4326); };

  // Garantiza una extensión mínima alrededor del centro del bbox (grados).
  // (Delega en MdtService.ensureMinExtent.)
  ensureMinExtent(ext) { return MdtService.ensureMinExtent(ext); };

  // Descarga y decodifica el MDT (GeoTIFF) del WCS. (Delega en MdtService.fetch.)
  fetchMDT(bbox4326) { return MdtService.fetch(bbox4326); };

  // Muestrea la cota del terreno (m) en (lon,lat) sobre el ráster del MDT.
  // (Delega en FootprintBuilder.sampleCota.)
  sampleCota(mdtData, lon, lat) { return FootprintBuilder.sampleCota(mdtData, lon, lat); };

  // ###################################################################
  //  CONSTRUCCIÓN DE GEOJSON (reproyección + geometrías)
  // ###################################################################

  // Convierte los datos importados en tres FeatureCollections GeoJSON.
  // mdtData (opcional): ráster de elevación del MDT para situar las huellas
  // sobre el terreno. (Delega en GeoJsonBuilder.build con this.data.)
  buildGeoJSON(mdtData) { return GeoJsonBuilder.build(this.data, mdtData); };

  // Calcula la huella (proyección del fotograma en el SUELO) de un fotograma.
  // (Delega en FootprintBuilder.build con la cámara actual this.data.footprint.)
  footprintPolygon(lon, lat, z, index, omega, phi, kappa, mdtData) {
    return FootprintBuilder.build(this.data.footprint, lon, lat, z, omega, phi, kappa, mdtData);
  };

  // Color por pasada (índice cíclico en la paleta). (Delega en GeoJsonBuilder.)
  colorForPasada(pasadaId, pasadaIds) { return GeoJsonBuilder.colorForPasada(pasadaId, pasadaIds); };

  // ###################################################################
  //  RENDER EN EL MAPA (capas GeoJSON API-IDEE)
  // ###################################################################

  // Calcula el bbox [minLon,minLat,maxLon,maxLat] en EPSG:4326 de los centros de
  // fotograma, con un pequeño margen para cubrir las esquinas de las huellas.
  // Devuelve null si no hay filas válidas con coordenadas.
  dataBBox4326() {
    var d = this.data, m = d.mapping;
    if (!d.rows || !m.x || !m.y) return null;
    var minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (var i = 0; i < d.rows.length; i++) {
      var row = d.rows[i];
      var x = parseFloat(String(row[m.x]).replace(",", "."));
      var y = parseFloat(String(row[m.y]).replace(",", "."));
      if (isNaN(x) || isNaN(y)) continue;
      var ll = this.toLonLat(x, y, d.crs);
      var lon = ll[0], lat = ll[1];
      if (isNaN(lon) || isNaN(lat)) continue;
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
    if (minLon === Infinity) return null;
    return [minLon - MDT_MARGIN_DEG, minLat - MDT_MARGIN_DEG,
            maxLon + MDT_MARGIN_DEG, maxLat + MDT_MARGIN_DEG];
  };

  // Orquesta el pintado: primero descarga el MDT del área de los datos (para
  // situar las huellas sobre el terreno) y luego pinta las capas. La descarga
  // es asíncrona; si falla o no hay cobertura, se pinta igualmente con las
  // huellas en la cota de vuelo (respaldo). Se cachea el MDT en this._mdtCache
  // para no re-descargarlo en cada swap OL<->Cesium ni en cada re-render.
  render() {
    var IDEE = api();
    if (!this.map || !IDEE) return;
    if (!this.data.rows) return; // nada importado todavía

    var self = this;

    // Reutiliza el MDT ya descargado si sigue cubriendo los mismos datos.
    if (this._mdtCache !== undefined) {
      this._renderWithMDT(this._mdtCache);
      return;
    }

    // Guard de concurrencia: evita descargas/render solapados si render() se
    // invoca varias veces seguidas (p.ej. COMPLETED + setTimeout tras un swap).
    if (this._fetchingMDT) return;

    var bbox = this.dataBBox4326();
    if (!bbox) { this._renderWithMDT(null); return; }

    this._fetchingMDT = true;
    this.setStatus("Descargando el modelo digital del terreno (MDT)…");
    this.fetchMDT(bbox).then(function (mdtData) {
      self._fetchingMDT = false;
      self._mdtCache = mdtData; // puede ser null (respaldo: huella pegada al terreno)
      self._renderWithMDT(mdtData);
    }).catch(function (err) {
      self._fetchingMDT = false;
      console.error("[vueloFotogrametrico] Error en render con MDT:", err && err.message);
      self._mdtCache = null;
      self._renderWithMDT(null);
    });
  };

  // Lee el texto de estado actual (para restaurarlo tras la descarga del MDT).
  _statusText() {
    var el = this.panel && this.panel.querySelector("#vf-status");
    return el ? el.textContent : "";
  };

  // Pinta las capas GeoJSON en el mapa a partir de los datos importados y del
  // MDT (opcional) para las huellas. Es la lógica de render original.
  _renderWithMDT(mdtData) {
    var IDEE = api();
    if (!this.map || !IDEE) return;
    if (!this.data.rows) return;

    var gj = this.buildGeoJSON(mdtData);
    if (gj.error) { this.setStatus(gj.error, "error"); return; }

    this.removeLayers();

    var self = this;

    // Referencias de altura para Cesium (en OpenLayers 2D se ignoran):
    //  - NONE = altura ABSOLUTA: usa la Z de la geometría tal cual. Se usa en
    //    puntos y líneas (Z = altitud de vuelo) y en huellas con cota del MDT.
    //  - CLAMP_TO_GROUND = pega la geometría al terreno visible. Se usa como
    //    respaldo en las huellas cuando NO hay MDT (así quedan sobre el terreno
    //    en vez de al nivel del mar). Resueltos de forma defensiva.
    var hr = (IDEE.style && IDEE.style.heightReference) ? IDEE.style.heightReference : {};
    var heightRefAbs = (hr.NONE !== undefined) ? hr.NONE : "NONE";
    var heightRefClamp = (hr.CLAMP_TO_GROUND !== undefined) ? hr.CLAMP_TO_GROUND : "CLAMP_TO_GROUND";

    // --- Capa de footprints (debajo de las líneas y puntos) ---
    if (gj.footprints.features.length) {
      var capaFP = new IDEE.layer.GeoJSON({
        name: "Huellas de fotograma",
        source: gj.footprints,
        legend: "Huellas de fotograma",
        extract: true
      }, { visibility: !!this.data.visible.footprints });
      // Si las huellas tienen cota del MDT (3D) -> altura ABSOLUTA a esa cota
      // (perPositionHeight sigue el relieve). Si no hay MDT (2D) -> CLAMP: Cesium
      // las pega al terreno visible en vez de dejarlas al nivel del mar.
      capaFP.setStyle(new IDEE.style.Generic({
        polygon: {
          fill: { color: "#3b6fd4", opacity: 0.08 },
          stroke: { color: "#3b6fd4", width: 1, opacity: 0.6 },
          heightReference: gj.footprints3D ? heightRefAbs : heightRefClamp,
          perPositionHeight: !!gj.footprints3D
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
        line: {
          stroke: { color: "#e6194b", width: 2, opacity: 0.9 },
          // Altura ABSOLUTA: la línea de pasada se dibuja a la Z real de vuelo.
          heightReference: heightRefAbs,
          clampToGround: false
        }
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
        stroke: { color: "#7a3b00", width: 1 },
        // Altura ABSOLUTA: el centro de fotograma se sitúa a la Z real de vuelo.
        heightReference: heightRefAbs
      }
    }));
    this.map.addLayers(capaPtos);
    this._layers.puntos = capaPtos;

    // --- Línea de vuelo + capa del avión (animación) ---
    // Guarda la línea de vuelo para interpolar la posición del avión.
    this._flightLine = (gj.flightCoords && gj.flightCoords.length >= 2)
      ? gj.flightCoords.slice() : null;
    this._precomputeFlightLine(); // longitudes acumuladas para interpolar
    this.crearCapaAvion();        // capa GeoJSON del avión (punto móvil)
    this.updateAnimUI();          // habilita/inhabilita controles según haya línea

    // Si veníamos reproduciendo (p.ej. tras un swap OL<->Cesium), reanuda.
    if (this._flightLine && this.data.anim && this.data.anim.playing) {
      this.startAnimation(true /* reanudar desde data.anim.t */);
    } else if (this._flightLine) {
      // Coloca el avión en la posición inicial (t actual) aunque esté en pausa.
      // En Cesium el entity puede no existir aún tras recrear el mapa (swap
      // OL<->Cesium): reintenta unas veces hasta que el modelo quede adjunto, para
      // que el avión se vea sin necesidad de reproducir la animación.
      this.placeAvionInicial(this.data.anim ? this.data.anim.t : 0);
    }

    // Encuadre a los datos SOLO la primera vez que se visualiza un vuelo. En los
    // swaps OL<->Cesium posteriores se respeta la vista (cambioImpl/shareView),
    // en vez de re-encuadrar y perder la posición del usuario. El flag zoomDone
    // persiste entre swaps (vive en window.__vueloSharedData).
    if (!this.data.zoomDone) this.zoomToData(capaPtos);

    var extra = gj.invalid ? (" (" + gj.invalid + " filas sin coordenadas válidas)") : "";
    // Aviso si las huellas no pudieron tomar cota del MDT (quedan pegadas al
    // terreno visible mediante CLAMP en Cesium, sin cota numérica para cálculo).
    var avisoMDT = (gj.footprints.features.length && !gj.footprints3D)
      ? " Huellas pegadas al terreno (sin cota del MDT)." : "";
    this.setStatus("Vuelo visualizado: " + gj.count + " fotogramas, " +
      gj.pasadaIds.length + " pasadas" + extra + "." + avisoMDT,
      avisoMDT ? "" : "ok");
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
        // Marca el encuadre como hecho: los swaps posteriores respetan la vista.
        self.data.zoomDone = true;
        window.__vueloSharedData = self.data;
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

  // ###################################################################
  //  ANIMACIÓN DEL AVIÓN SOBRE LA LÍNEA DE VUELO
  //  --------------------------------------------------------------------
  //  El avión recorre la línea de vuelo (this._flightLine, coords [lon,lat,z]
  //  ordenadas por número de fotograma) en un tiempo fijo (AVION_DURACION_MS).
  //  El progreso t (0..1) persiste en data.anim para sobrevivir a los swaps
  //  OL<->Cesium. En cada frame se interpola posición + altitud + rumbo y se
  //  actualiza el avión: en OL como icono SVG rotado; en Cesium como modelo glTF
  //  orientado por su velocidad.
  // ###################################################################

  // Precalcula las longitudes acumuladas (m) de la línea de vuelo y las guarda en
  // propiedades de instancia (this._flightCum/_flightTotal) para interpolar por
  // progreso t. (Delega el cálculo en FlightPath.precompute.)
  _precomputeFlightLine() {
    var pre = FlightPath.precompute(this._flightLine);
    this._flightCum = pre.cum;
    this._flightTotal = pre.total;
  };

  // Distancia plana aproximada (m) entre dos coords [lon,lat(,z)] (solo XY).
  // (Delega en VueloGeo.segMetros.)
  _segMetros(a, b) {
    return VueloGeo.segMetros(a, b);
  };

  // Interpola el estado del avión en el progreso t (0..1) a lo largo de la línea.
  // Devuelve { lon, lat, z, headingRad } o null. (Delega en FlightPath.interpolate.)
  getInterpolatedState(t) {
    return FlightPath.interpolate(this._flightLine, this._flightCum, this._flightTotal, t);
  };

  // Rumbo (radianes, horario desde el norte) entre dos coords [lon,lat].
  // (Delega en VueloGeo.bearingRad.)
  _bearingRad(a, b) {
    return VueloGeo.bearingRad(a, b);
  };

  // Prepara el avión móvil. En OpenLayers (2D) se usa una capa GeoJSON de 1 punto
  // estilizada como icono SVG (funciona bien). En Cesium (3D) NO se usa capa
  // GeoJSON (su DataSource no materializa el entity de forma fiable tras el swap):
  // el modelo glTF se gestiona como Cesium.Entity propio en _updateAvionCesium.
  crearCapaAvion() {
    var IDEE = api();
    if (!IDEE || !this.map || !this._flightLine) return;

    // En Cesium no se crea capa GeoJSON: el entity del avión lo gestiona el viewer
    // directamente (ver _updateAvionCesium). Solo aseguramos el estado limpio.
    if (this._isCesium()) {
      this._removeAvionCesiumEntity();
      this._layers.avion = null;
      return;
    }

    var start = this._flightLine[0];
    var src = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: start.slice() },
        properties: { avion: true }
      }]
    };
    var hr = (IDEE.style && IDEE.style.heightReference) ? IDEE.style.heightReference : {};
    var heightRefAbs = (hr.NONE !== undefined) ? hr.NONE : "NONE";

    var capa = new IDEE.layer.GeoJSON({
      name: "Avión",
      source: src,
      legend: "Avión",
      extract: false
    }, { visibility: true });
    capa.setStyle(new IDEE.style.Generic({
      point: {
        icon: { src: AVION_SVG, scale: AVION_SVG_SCALE, rotate: true, rotation: 0 },
        heightReference: heightRefAbs
      }
    }));
    this.map.addLayers(capa);
    this._layers.avion = capa;
    this._avionEntityReady = false;
  };

  // Devuelve true si la implementación activa es Cesium (3D).
  _isCesium() {
    try {
      var impl = this.map.getMapImpl();
      return !!(impl && impl.scene && impl.camera);
    } catch (e) { return false; }
  };

  // Coloca el avión en el progreso t (0..1): interpola estado y actualiza la
  // geometría/orientación en la implementación activa (OL icono / Cesium modelo).
  updateAvionAt(t) {
    var st = this.getInterpolatedState(t);
    if (!st) return;
    if (this._isCesium()) {
      // En Cesium el avión es un entity propio del viewer (no la capa GeoJSON).
      this._updateAvionCesium(st);
    } else {
      if (!this._layers.avion) return;
      this._updateAvionOL(st);
    }
  };

  // Coloca el avión en su posición inicial. En OL pinta el icono al momento; en
  // Cesium crea (si no existe) y posiciona el entity propio del avión de forma
  // síncrona en updateAvionAt, por lo que no hace falta sondear la materialización
  // de ninguna capa. Se reintenta un par de veces por si el viewer aún no está
  // listo justo tras recrear el mapa en el swap.
  placeAvionInicial(t) {
    var self = this;
    this.updateAvionAt(t);
    if (!this._isCesium()) return; // en OL el icono se pinta al momento
    if (this._avionInitPoll) { clearTimeout(this._avionInitPoll); this._avionInitPoll = null; }
    var tries = 8;
    (function poll() {
      if (self._avionEntity || (self.data.anim && self.data.anim.playing) || --tries <= 0) {
        self._avionInitPoll = null;
        return;
      }
      self.updateAvionAt(t);
      self._avionInitPoll = setTimeout(poll, 200);
    })();
  };

  // Actualiza el avión en OpenLayers: mueve el punto y rota el icono por rumbo.
  // Se asigna un estilo ol.Style DIRECTO al feature (más robusto que depender
  // del estilo de capa de API-IDEE, que puede no exponer getImage()). El icono
  // SVG apunta al norte por defecto, así que la rotación = rumbo (radianes).
  _updateAvionOL(st) {
    try {
      var olLayer = this._layers.avion.getImpl().getLayer();
      var feats = olLayer.getSource().getFeatures();
      if (!feats || !feats.length) return;
      var f = feats[0];
      var proj = this.map.getProjection ? this.map.getProjection().code : "EPSG:3857";
      var xy = window.ol.proj.transform([st.lon, st.lat], "EPSG:4326", proj);
      f.getGeometry().setCoordinates(xy);
      // Reutiliza el ol.style.Icon del feature y solo actualiza su rotación; si
      // no existe todavía, lo crea una vez (evita recrear el estilo cada frame).
      var style = f.getStyle && typeof f.getStyle === "function" ? f.getStyle() : null;
      var img = style && style.getImage && style.getImage();
      if (img && img.setRotation) {
        img.setRotation(st.headingRad);
      } else {
        f.setStyle(new window.ol.style.Style({
          image: new window.ol.style.Icon({
            src: AVION_SVG,
            scale: AVION_SVG_SCALE,
            rotation: st.headingRad,
            rotateWithView: true
          })
        }));
      }
      f.changed && f.changed();
    } catch (e) { /* la capa puede no estar lista todavía */ }
  };

  // Actualiza el avión en Cesium gestionando un Cesium.Entity PROPIO a través del
  // viewer (map.getMapImpl() es el Cesium.Viewer en este wrapper). No se usa el
  // entity autogenerado por la capa GeoJSON porque el DataSource no lo materializa
  // de forma fiable tras el swap OL<->Cesium (entities.values queda vacío). Se crea
  // el entity una vez (con id fijo) y en cada frame se mueve y ORIENTA por rumbo.
  // La orientación se calcula con Transforms.headingPitchRollQuaternion (marco ENU);
  // no se usa VelocityOrientationProperty porque la posición es estática por frame.
  _updateAvionCesium(st) {
    try {
      if (typeof Cesium === "undefined") return;
      var viewer = this.map.getMapImpl(); // en este wrapper, el impl ES el Viewer
      if (!viewer || !viewer.entities) return;

      var ent = this._avionEntity;
      if (!ent) {
        // Reutiliza uno previo con el mismo id si quedara (defensivo), o créalo.
        ent = viewer.entities.getById(AVION_ENTITY_ID) ||
          viewer.entities.add({
            id: AVION_ENTITY_ID,
            model: new Cesium.ModelGraphics({
              uri: AVION_GLB,
              scale: AVION_GLB_SCALE,
              minimumPixelSize: AVION_GLB_MINPX
            })
          });
        this._avionEntity = ent;
        this._avionEntityReady = true;
      }

      var position = Cesium.Cartesian3.fromDegrees(st.lon, st.lat, st.z || 0);
      ent.position = position;

      // Orientación por rumbo: heading en radianes (horario desde el norte). El
      // modelo Cesium_Air apunta a +X (Este) por defecto => desfase -90°.
      var heading = (st.headingRad || 0) + AVION_GLB_HEADING_OFFSET;
      var hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
      var quat = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
      ent.orientation = new Cesium.ConstantProperty(quat);
    } catch (e) { /* impl aún no lista */ }
  };

  // Elimina el entity propio del avión del viewer de Cesium (si existe). Se llama
  // al quitar capas y en cleanup para no duplicar el avión tras cada swap.
  _removeAvionCesiumEntity() {
    try {
      if (typeof Cesium === "undefined") return;
      var viewer = this.map && this.map.getMapImpl();
      if (viewer && viewer.entities && viewer.entities.getById) {
        var prev = viewer.entities.getById(AVION_ENTITY_ID);
        if (prev) viewer.entities.remove(prev);
      }
    } catch (e) { /* el viewer puede haberse destruido en el swap */ }
    this._avionEntity = null;
    this._avionEntityReady = false;
  };

  // Arranca la animación (rAF). Si resume=true, continúa desde data.anim.t.
  startAnimation(resume) {
    if (!this._flightLine || this._flightLine.length < 2) return;
    var d = this.data;
    if (!d.anim) d.anim = { playing: false, t: 0 };
    if (!resume && d.anim.t >= 1) d.anim.t = 0; // reinicia si estaba al final
    d.anim.playing = true;
    window.__vueloSharedData = d;
    this.updateAnimUI();

    var self = this;
    this._animLast = (typeof performance !== "undefined" ? performance.now() : Date.now());
    this._stopRAF();
    var step = function (now) {
      if (!self.data.anim || !self.data.anim.playing) return;
      var dt = now - (self._animLast || now);
      self._animLast = now;
      self.data.anim.t += dt / AVION_DURACION_MS;
      if (self.data.anim.t >= 1) {
        self.data.anim.t = 1;
        self.updateAvionAt(1);
        self.stopAnimation();       // se detiene al final; Reiniciar vuelve a t=0
        return;
      }
      window.__vueloSharedData = self.data;
      self.updateAvionAt(self.data.anim.t);
      self._animRAF = requestAnimationFrame(step);
    };
    this._animRAF = requestAnimationFrame(step);
  };

  // Pausa la animación conservando el progreso (no cancela el estado, solo rAF).
  pauseAnimation() {
    if (this.data.anim) { this.data.anim.playing = false; window.__vueloSharedData = this.data; }
    this._stopRAF();
    this.updateAnimUI();
  };

  // Detiene la animación (marca playing=false y cancela rAF). Mantiene t.
  stopAnimation() {
    if (this.data.anim) { this.data.anim.playing = false; window.__vueloSharedData = this.data; }
    this._stopRAF();
    this.updateAnimUI();
  };

  // Reinicia la animación al comienzo de la línea (t=0) y la reproduce.
  restartAnimation() {
    if (this.data.anim) this.data.anim.t = 0;
    this.updateAvionAt(0);
    this.startAnimation(false);
  };

  // Alterna reproducir/pausar según el estado actual.
  togglePlay() {
    if (this.data.anim && this.data.anim.playing) this.pauseAnimation();
    else this.startAnimation(true);
  };

  // Cancela el requestAnimationFrame en curso (sin tocar el estado playing/t).
  _stopRAF() {
    if (this._animRAF) { try { cancelAnimationFrame(this._animRAF); } catch (e) {} this._animRAF = null; }
  };

  // Habilita/inhabilita los controles de animación y actualiza el texto del botón.
  updateAnimUI() {
    var p = this.panel;
    if (!p) return;
    var sec = p.querySelector("#vf-section-anim");
    var play = p.querySelector("#vf-anim-play");
    var restart = p.querySelector("#vf-anim-restart");
    var hayLinea = !!(this._flightLine && this._flightLine.length >= 2);
    if (sec) { if (hayLinea) sec.removeAttribute("hidden"); else sec.setAttribute("hidden", ""); }
    var playing = !!(this.data.anim && this.data.anim.playing);
    if (play) {
      play.disabled = !hayLinea;
      play.textContent = playing ? "⏸ Pausar" : "▶ Reproducir";
    }
    if (restart) restart.disabled = !hayLinea;
  };

  applyVisibility() {
    var d = this.data;
    if (this._layers.puntos) try { this._layers.puntos.setVisible(!!d.visible.puntos); } catch (e) {}
    if (this._layers.lineas) try { this._layers.lineas.setVisible(!!d.visible.lineas); } catch (e) {}
    if (this._layers.footprints) try { this._layers.footprints.setVisible(!!d.visible.footprints); } catch (e) {}
  };

  removeLayers() {
    var self = this;
    // Detiene la animación (rAF) antes de quitar la capa del avión, sin borrar
    // el estado playing/t (para poder reanudar tras un swap).
    this._stopRAF();
    if (this._avionInitPoll) { try { clearTimeout(this._avionInitPoll); } catch (e) {} this._avionInitPoll = null; }
    ["footprints", "lineas", "puntos", "avion"].forEach(function (k) {
      var lyr = self._layers[k];
      if (lyr) {
        try { self.map.removeLayers(lyr); } catch (e) { /* ignora */ }
        self._layers[k] = null;
      }
    });
    // Elimina también el entity propio del avión en Cesium (el que gestiona el
    // viewer directamente), para no duplicarlo tras el swap/re-render.
    this._removeAvionCesiumEntity();
  };

  clearData() {
    this.removeLayers();
    this.data.rows = null;
    this.data.headers = null;
    this.data.mapping = {};
    this._mdtCache = undefined; // sin datos: invalida el MDT cacheado
    this.data.zoomDone = false; // sin datos: el próximo vuelo re-encuadrará
    // Detiene y reinicia la animación del avión.
    this._stopRAF();
    this.data.anim = { playing: false, t: 0 };
    this._flightLine = null;
    this.updateAnimUI();
    // Deselecciona el vuelo pero conserva la lista de vuelos encontrados, para
    // poder elegir otro sin repetir la búsqueda. En CSV no hay vuelos.
    this.data.vueloSel = null;
    var selV = this.panel && this.panel.querySelector("#vf-ogc-vuelos");
    if (selV) selV.value = "";
    window.__vueloSharedData = this.data;
    this.showConfigSections(false);
    var input = this.panel && this.panel.querySelector("#vf-file");
    if (input) input.value = "";
    this.setStatus(this.data.source === "ogc"
      ? "Vuelo ocultado. Elige otro vuelo de la lista."
      : "Datos limpiados. Carga un nuevo archivo.");
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
