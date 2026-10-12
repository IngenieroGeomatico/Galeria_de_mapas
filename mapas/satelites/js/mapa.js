

const SVGCarga = document.getElementById("cargaSVG")
// window.onload = (event) => {
//   SVGCarga.hidden = true
// };

// ===================================================================
//  Carga bajo demanda de satellite.js (propagación orbital SGP4)
//  ------------------------------------------------------------------
//  Este visualizador usa satellite.js para propagar las órbitas de la ISS y los
//  satélites Galileo. En vez de cargarlo por <script> en el index.html, se
//  inyecta bajo demanda desde aquí antes de calcular la primera órbita. La carga
//  se cachea en window.__satellitePromise para no reinyectar.
// ===================================================================
const SATELLITE_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/satellite.js/1.3.0/satellite.min.js";
function ensureSatellite() {
  if (typeof window.satellite !== "undefined") return Promise.resolve(window.satellite);
  if (window.__satellitePromise) return window.__satellitePromise;
  window.__satellitePromise = new Promise(function (resolve, reject) {
    var existing = document.querySelector('script[data-lib="satellite-js"]');
    var script = existing || document.createElement("script");
    var onOk = function () {
      if (typeof window.satellite !== "undefined") resolve(window.satellite);
      else reject(new Error("satellite.js cargó pero no expuso window.satellite"));
    };
    var onErr = function () { window.__satellitePromise = null; reject(new Error("No se pudo cargar satellite.js")); };
    script.addEventListener("load", onOk);
    script.addEventListener("error", onErr);
    if (!existing) {
      script.src = SATELLITE_CDN_URL;
      script.async = true;
      script.setAttribute("data-lib", "satellite-js");
      document.head.appendChild(script);
    }
  });
  return window.__satellitePromise;
}


// ===================================================================
//  Trazas orbitales sin el salto del antimeridiano
//  ------------------------------------------------------------------
//  Las órbitas se propagan en longitud [-180, 180], así que al pasar de +179.9
//  a -179.9 la polilínea recorre todo el mapa de lado a lado (en 2D, una línea
//  horizontal que no es real) y en 3D da un salto por encima del globo. Aquí se
//  parte la traza en ese salto y cada tramo se cierra con el punto interpolado
//  exacto del meridiano ±180 (para no dejar hueco), devolviendo una
//  MultiLineString; si la órbita no cruza el antimeridiano, una LineString.
// ===================================================================
function geometriaTrazaSinSalto(positions) {
  if (!positions || positions.length < 2) {
    return { type: "LineString", coordinates: positions || [] }
  }

  const partes = []
  let parte = [positions[0]]

  for (let i = 1; i < positions.length; i++) {
    const anterior = positions[i - 1]
    const actual = positions[i]
    const salto = actual[0] - anterior[0]

    if (Math.abs(salto) > 180) {
      // Longitud "desenvuelta" del punto siguiente y meridiano donde se corta.
      const destino = actual[0] + (salto > 0 ? -360 : 360)
      const meridiano = salto > 0 ? -180 : 180
      const f = (meridiano - anterior[0]) / (destino - anterior[0])
      const latCorte = anterior[1] + f * (actual[1] - anterior[1])
      // El tramo que llega se cierra en el meridiano por su lado (+180 si venía
      // de longitudes positivas) y el siguiente arranca en la otra representación
      // del mismo meridiano (-180), que es su orilla correspondiente. Así ningún
      // tramo cruza de -180 a +180.
      const corteFinal = [meridiano, latCorte]
      const corteInicial = [meridiano + (salto > 0 ? 360 : -360), latCorte]
      if (anterior.length > 2 && actual.length > 2) {
        const altCorte = anterior[2] + f * (actual[2] - anterior[2])
        corteFinal.push(altCorte)
        corteInicial.push(altCorte)
      }
      parte.push(corteFinal)
      partes.push(parte)
      parte = [corteInicial]
    }

    parte.push(actual)
  }
  partes.push(parte)

  if (partes.length === 1) {
    return { type: "LineString", coordinates: partes[0] }
  }
  return { type: "MultiLineString", coordinates: partes }
}

// ===================================================================
//  Capas base del visualizador (capa rápida + config.backgroundlayers)
//  ------------------------------------------------------------------
//  Esto se define en una función y se vuelve a aplicar en CADA creación del
//  mapa, porque mapa() se ejecuta otra vez en cada cambio 2D/3D y el swap
//  recarga el bundle de la API. Al recargarlo, cambioImpl conserva el objeto
//  IDEE.config (hace IDEE.config = config_c), así que config.backgroundlayers
//  sí sobrevive, pero el REGISTRO de capas rápidas no: el mapa nuevo intenta
//  resolver `QUICK*Base_IGNBaseTodo_TMS_2` y falla con "No se encuentra
//  definida Base_IGNBaseTodo_TMS_2 como capa rápida", quedándose sin capa base.
//  Por eso hay que registrar la capa rápida con el IDEE de la implementación
//  activa ANTES de IDEE.map(), que es quien resuelve los `QUICK*`.
// ===================================================================
function configurarCapasBase() {
  Base_IGNBaseTodo_TMS_2 = new IDEE.layer.TMS({
    url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
    legend: 'IGNBaseTodo_2',
    visible: true,
    isBase: true,
    tileGridMaxZoom: 17,
    name: 'IGNBaseTodo_2',
    attribution: '<p><b>Mapa base</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>',
  }, {
    crossOrigin: 'anonymous',
    displayInLayerSwitcher: false,
  })

  IDEE.addQuickLayers({
    Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2
  })

  tms_2 = {
    "base": "QUICK*Base_IGNBaseTodo_TMS_2"
  }

  IDEE.config("tms", tms_2)
  // Selector de capas base (ext/selectorCapas/ext_backgorundLayers.js): las
  // miniaturas son rutas relativas a este index.html.
  IDEE.config.backgroundlayers = [
    {
      "id": "mapa",
      "title": "Callejero",
      "imgPreview": "img/IGNBase.png",
      "layers": [
        "QUICK*Base_IGNBaseTodo_TMS_2"
      ]
    },
    {
      "id": "imagen",
      "title": "Imagen",
      "imgPreview": "img/imagen.png",
      "layers": [
        "QUICK*BASE_PNOA_MA_TMS"
      ]
    }
  ]
}

// Configuración del mapa
IDEE.proxy(false);

let alturaISS = 0; // metros (solo marcador puntual, no para órbita)

ISSPosition = function (centerMap = false, onlyPosition = false) {

  IDEE.remote.get("https://api.wheretheiss.at/v1/satellites/25544",
    {}
  ).then(function (res) {
    const jsonParser = JSON.parse(res.text);
    alturaISS = jsonParser.altitude * 1000; // km -> m (solo punto actual)
    const ISS = {
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "properties": { "name": "ISS" },
        "geometry": {
          "type": "Point",
          "coordinates": [jsonParser.longitude, jsonParser.latitude, alturaISS]
        }
      }]
    };

    // En OL la capa no tiene entidades 3D que mover (solo-posición Cesium):
    // el punto ISS se refresca siempre vía setSource.
    if (!onlyPosition || !(mapaCesium && mapaCesium.scene)) {
      layerISS.setSource(ISS);
    }


    let checkVar = setInterval(() => {

      // El seguimiento del modelo 3D de la ISS solo aplica en la implementación
      // Cesium; en OL la capa GeoJSON ya dibuja el punto con su estilo.
      if (!(mapaCesium && mapaCesium.scene)) {
        clearInterval(checkVar);
        return;
      }

      layerISS_Cesium = layerISS.getImpl().getLayer()
      if (typeof layerISS_Cesium !== 'undefined' && layerISS_Cesium !== null && layerISS_Cesium.entities.values.length > 0) {

        entity = layerISS_Cesium.entities.values[0]

        if (onlyPosition) {
          entity.position = Cesium.Cartesian3.fromDegrees(jsonParser.longitude, jsonParser.latitude, alturaISS);
          clearInterval(checkVar);
          return
        }

        if (typeof entity.model !== undefined && entity.model !== null) {
          entity.billboard = undefined;
          entity.point = undefined;
          entity.model = {
            uri: './img/ISS_stationary.glb',    // tu modelo GLB o GLTF
            scale: 10000,       // ajusta al tamaño del globo
            minimumPixelSize: 50
          }
          // Parar el intervalo
          clearInterval(checkVar);
        }
      }

    }, 500);

    if (centerMap) {
      mapajs.setCenter({ x: jsonParser.longitude, y: jsonParser.latitude });
    }
  })

};

OrbitISS = function () {
  // Ahora calculamos la altura con satellite.js para cada instante
  IDEE.remote.get("https://api.wheretheiss.at/v1/satellites/25544/tles",
    {}
  ).then(function (res) {
    const jsonParser = JSON.parse(res.text);
    const satrec = satellite.twoline2satrec(jsonParser.line1, jsonParser.line2);


    // Ventana -60 min a +60 min (120 muestras por minuto)
    const startDate = new Date(Date.now() - 60 * 60 * 1000);
    const positions = [];

    for (let i = 0; i < 120; i++) {
      const time = new Date(startDate.getTime() + i * 60 * 1000);
      const pv = satellite.propagate(satrec, time);
      const positionEci = pv.position;
      if (!positionEci) continue;

      const gmst = satellite.gstimeFromDate(time);
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);
      const longitude = satellite.degreesLong(positionGd.longitude);
      const latitude = satellite.degreesLat(positionGd.latitude);
      // positionGd.height está en km -> convertir a metros
      const altitudeMeters = positionGd.height * 1000;
      positions.push([longitude, latitude, altitudeMeters]);
    }

    const geojson = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: geometriaTrazaSinSalto(positions),
        properties: { name: "ISS", id: "25544" }
      }]
    };
    layerOrbit.setSource(geojson)
  })
}

// ===================================================================
//  Galileo: datos, posiciones y órbitas
//  ------------------------------------------------------------------
//  Los TLE son Obligatorios: son las dos líneas que satellite.js necesita para
//  propagar. El JSON es un PLUS (metadatos para la tabla de atributos): si
//  falla, se sigue dibujando todo con lo que traen los TLE, en vez de perder
//  los 32 satélites entero.
//
//  La órbita se traza durante UNA REVOLUCIÓN COMPLETA, no en una ventana de
//  tiempo fija. Antes eran 600 muestras de un minuto desde una hora antes (10 h)
//  y, como el período de Galileo es de unas 14,5 h, la traza se quedaba en el
//  71% de la elipse: ninguna órbita cerraba, todas quedaban como un arco ancho
//  (medido: 600 puntos, lat -57,2..57,2, lon -180..180 y sin cerrar). Ahora el
//  período sale del movimiento medio de cada satélite (satrec.no va en
//  radianes/minuto), se reparte en un número fijo de muestras y se cierra el
//  anillo con el punto de partida.
// ===================================================================
const GALILEO_TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle";
const GALILEO_JSON_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=json";
// Muestras por órbita: ~1,25° de arco en Galileo, de sobra para la elipse y la
// mitad de propagaciones que antes.
const GALILEO_MUESTRAS_ORBITA = 360;

jsonGalileo = [];
tleGalileo = [];
tleMap = {};

/** satrec de un objeto de Galileo, o null si le faltan las líneas del TLE. */
function satrecDeObjeto(obj) {
  if (!obj || !obj.line1 || !obj.line2) return null;
  try {
    return satellite.twoline2satrec(obj.line1, obj.line2);
  } catch (e) {
    console.warn("[satelites] TLE inválido en", obj.OBJECT_NAME, e && e.message);
    return null;
  }
}

/**
 * Posición [lon, lat, altura_m] de un satélite en un instante dado.
 * @param {Object} satrec
 * @param {Date} fecha
 * @param {number} [gmst] Si se pasa, se usa ESE giro terrestre para todos los
 *   puntos en vez del correspondiente a la fecha. Es lo que permite congelar el
 *   marco (ver orbitaCompleta).
 */
function posicionDeSatelite(satrec, fecha, gmst) {
  const pv = satellite.propagate(satrec, fecha);
  if (!pv || !pv.position) return null;
  const g = (gmst === undefined || gmst === null) ? satellite.gstimeFromDate(fecha) : gmst;
  const geod = satellite.eciToGeodetic(pv.position, g);
  if (!geod) return null;
  return [
    satellite.degreesLong(geod.longitude),
    satellite.degreesLat(geod.latitude),
    geod.height * 1000 // km -> m
  ];
}

/**
 * Órbita completa de un satélite: una revolución a partir de ahora, muestreada
 * en `muestras` puntos y cerrada con el punto de partida (i va hasta `muestras`
 * inclusive), para que la elipse quede cerrada y no un arco.
 *
 * MARCO CONGELADO. La revolución es INERCIAL: en los 14 h 05 min que tarda un
 * Galileo en dar una vuelta, la Tierra gira 211°, así que si cada punto se
 * convierte con el giro terrestre de SU instante, la traza sobre el suelo no se
 * cierra nunca (medido: vuelta completa con 148° de longitud entre el primer y
 * el último punto, con la latitud y la altura clavadas): sale un roseta, que en
 * el mapa parece una órbita rota. Para dibujar la ÓRBITA se usa un único
 * gmst, el del instante inicial, que es el marco en el que la elipse es una
 * elipse: el mismo criterio con el que se dibujan los diagramas de forma
 * orbital. El punto del satélite sigue siendo su posición real, de modo que
 * queda sobre su elipse (con el desfase del Earth rotation de los segundos
 * transcurridos desde el último refresco de la órbita, 0,5° como mucho).
 *
 * @returns {{periodoMin:number, pasoMin:number, posiciones:Array<Array<number>>}}
 */
function orbitaCompleta(satrec, muestras = GALILEO_MUESTRAS_ORBITA) {
  const revPorMinuto = satrec.no / (2 * Math.PI); // satrec.no va en radianes/minuto
  const periodoMin = revPorMinuto > 0 ? 1 / revPorMinuto : 90;
  const pasoMin = periodoMin / muestras;
  const ahora = new Date();
  const gmstInicial = satellite.gstimeFromDate(ahora);
  const posiciones = [];
  for (let i = 0; i <= muestras; i++) {
    const fecha = new Date(ahora.getTime() + i * pasoMin * 60 * 1000);
    const pos = posicionDeSatelite(satrec, fecha, gmstInicial);
    if (pos) posiciones.push(pos);
  }
  return { periodoMin, pasoMin, posiciones };
}

/** FeatureCollection con una órbita completa por satélite. */
function construirOrbitasGalileo(objetos) {
  const fc = { type: "FeatureCollection", features: [] };
  (objetos || []).forEach(function (obj) {
    const satrec = satrecDeObjeto(obj);
    if (!satrec) return;
    const orbita = orbitaCompleta(satrec);
    if (orbita.posiciones.length < 2) return;
    fc.features.push({
      type: "Feature",
      geometry: geometriaTrazaSinSalto(orbita.posiciones),
      properties: obj
    });
  });
  return fc;
}

/** Trocea el texto TLE de Celestrak ennombre + línea1 + línea2. */
function parseTLEtoJSON(tleText) {
  const lines = String(tleText || "").trim().split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i += 3) {
    const name = lines[i].trim();
    const line1 = (lines[i + 1] || '').trim();
    const line2 = (lines[i + 2] || '').trim();
    if (name && line1 && line2) {
      result.push({ name, line1, line2 });
    }
  }
  return result;
}

/** Descarga los TLE (y el JSON si puede) y pinta las capas. */
GalileoPosition = function (Orbit = false) {

  IDEE.remote.get(GALILEO_TLE_URL, {})
    .then(function (resTle) {
      tleGalileo = parseTLEtoJSON(resTle.text);
      // Mapa para emparejar rápido por nombre.
      tleMap = {};
      tleGalileo.forEach(function (tle) {
        tleMap[tle.name.trim()] = tle;
      });

      // El JSON solo aporta metadatos: si falla, seguimos con los TLE.
      return IDEE.remote.get(GALILEO_JSON_URL, {})
        .then(function (resJson) {
          jsonGalileo = JSON.parse(resJson.text);
        })
        .catch(function (err) {
          console.warn("[satelites] No se pudo leer el JSON de Galileo; se dibuja solo con los TLE:", err && err.message);
          jsonGalileo = [];
        });
    })
    .then(function () {
      // Añadimos line1 y line2 a cada objeto del JSON si hay coincidencia.
      (jsonGalileo || []).forEach(function (obj) {
        const tle = tleMap[String(obj.OBJECT_NAME || "").trim()];
        if (tle) {
          obj.line1 = tle.line1;
          obj.line2 = tle.line2;
        }
      });
      // Sin JSON, los propios TLE dan la lista de satélites.
      if (!jsonGalileo || !jsonGalileo.length) {
        jsonGalileo = tleGalileo.map(function (tle) {
          return {
            OBJECT_NAME: tle.name,
            OBJECT_ID: tle.line1.slice(2, 7),
            line1: tle.line1,
            line2: tle.line2
          };
        });
      }
      GalileoPositionByTime(Orbit);
    })
    .catch(function (err) {
      console.error("[satelites] No se pudieron descargar los TLE de Galileo:", err && err.message);
    });

}

/**
 * Pinta las posiciones (y, si se pide, las órbitas) con lo ya descargado. Se
 * llama cada 5 s para las posiciones y cada 120 s para las órbitas.
 */
GalileoPositionByTime = function (Orbit = false) {
  if (!jsonGalileo || !jsonGalileo.length) return;

  const ahora = new Date();
  geojsonGalileo = {
    type: "FeatureCollection",
    features: []
  };

  jsonGalileo.forEach(function (obj) {
    const satrec = satrecDeObjeto(obj);
    if (!satrec) return;
    const pos = posicionDeSatelite(satrec, ahora);
    if (!pos) return;
    geojsonGalileo.features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: pos },
      properties: obj
    });
  });

  layerGalileo.setSource(geojsonGalileo);

  // La colección de órbitas solo se rehace cuando toca (cada 120 s). Antes se
  // vaciaba aquí en cada pasada de 5 s aunque no se recalculara nada, así que la
  // variable global quedaba con 0 features y no se podía ni inspeccionar.
  if (Orbit) {
    geojsonGalileoOrbit = construirOrbitasGalileo(jsonGalileo);
    layerGalileoOrbit.setSource(geojsonGalileoOrbit);
  }

}

// ===================================================================
//  Arranque/refresco de los cálculos orbitales
//  ------------------------------------------------------------------
//  Se llama al final de mapa(), es decir, también cada vez que se recrea el
//  mapa al cambiar de implementación (2D<->3D). Las capas GeoJSON se recrean
//  vacías en el mapa nuevo y las de órbita solo se recalculan cada 120 s en el
//  intervalo de refresco, así que sin este arranque al pasar a 2D desaparecen
//  los satélites y las dos órbitas hasta el siguiente recálculo.
//  La primera vez la vista se centra en la ISS; en las recreaciones no, porque
//  cambioImpl restaura después el centro y el zoom que tenía el mapa anterior.
//  El segundo parámetro de ISSPosition (soloPosicion) va siempre a false: en
//  Cesium hay que recrear la fuente en cada mapa nuevo para que se cree otra
//  vez la entidad con el modelo 3D de la ISS (con soloPosicion=true el
//  intervalo de refresco únicamente mueve una entidad que ya no existe y la
//  ISS desaparece al volver de 2D a 3D).
// ===================================================================
function arrancarCalculosOrbitales() {
  ensureSatellite().then(function () {
    const primeraVez = !window.__satelitesArrancados;
    window.__satelitesArrancados = true;

    OrbitISS()
    ISSPosition(primeraVez, false)
    GalileoPosition(true)

    SVGCarga.hidden = true
  }).catch(function (err) {
    console.error("[satelites] No se pudo cargar satellite.js:", err && err.message);
    SVGCarga.hidden = true
  });
}

function mapa() {

// Las capas rápidas de la API no sobreviven al cambio 2D/3D: se registran con
// el IDEE de la implementación activa antes de crear el mapa (ver
// configurarCapasBase).
configurarCapasBase();

mapajs = IDEE.map({
  container: "mapa", //id del contenedor del mapa
  center: { x: -5.401192785534927, y: 38.76089860530802 },
  zoom: 7,
});


mapaCesium = mapajs.getMapImpl();
// Solo la implementación Cesium dispone de escena 3D (globo)
if (mapaCesium.scene) {
  mapaCesium.scene.globe.depthTestAgainstTerrain = true;
}

layerISS = new IDEE.layer.GeoJSON({
  name: "layerISS",
  legend: "Estación Espacial Internacional (ISS)",
  source: {},
}, {
  clampToGround: false,
});
let estilo_ISS = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
    stroke: {
      color: 'red',
      width: 5,
    },
    radius: 4,
    // icon: {
    //   src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/ISS_spacecraft_model_1.png/960px-ISS_spacecraft_model_1.png?20200411071338',
    //   scale: 0.2,
    // }
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas
  }
});
layerISS.setStyle(estilo_ISS);


layerOrbit = new IDEE.layer.GeoJSON({
  name: "layerOrbit",
  legend: "Órbita ISS",
  source: {},
}, {
  clampToGround: false,
});

let estilo_orbISS = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas
    stroke: {
      color: 'orange',
      width: 5,
    }
  }
});
layerOrbit.setStyle(estilo_orbISS);


layerGalileo = new IDEE.layer.GeoJSON({
  name: "Satélites Galileo",
  legend: "Satélites Galileo",
  source: {},
}, {
  clampToGround: false,
});
let estilo_galileo = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
    stroke: {
      color: 'blue',
      width: 5,
    },
    radius: 4,
    // icon: {
    //   src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/ISS_spacecraft_model_1.png/960px-ISS_spacecraft_model_1.png?20200411071338',
    //   scale: 0.2,
    // }
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas
  }
});
layerGalileo.setStyle(estilo_galileo);


layerGalileoOrbit = new IDEE.layer.GeoJSON({
  name: "Órbita Satélites Galileo",
  legend: "Órbita Satélites Galileo",
  source: {},
}, {
  clampToGround: false,
});
let estilo_orbGalileo = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas
    // 32 elipses superpuestas, así que van finas y semitransparentes. El color
    // va en la familia del punto del satélite (azul) y no en blanco: sobre el
    // mapa base claro, blanco al 30% no se veía casi nada (medido: los píxeles
    // que pintaba la capa salían 224,224,224, casi el propio color del mapa).
    stroke: {
      color: '#2f6fd0',
      width: 2,
      opacity: 0.45
    }
  }
});
layerGalileoOrbit.setStyle(estilo_orbGalileo);


mapajs.addLayers(layerISS);
mapajs.addLayers(layerOrbit);
mapajs.addLayers(layerGalileo);
mapajs.addLayers(layerGalileoOrbit);

pluglinCambioCapaBase = new IDEE.plugin.miPlugin_baseLayer({ rows: 1 })
mapajs.addPlugin(pluglinCambioCapaBase)
pluginCapasSuperpuestas = new IDEE.plugin.miPlugin_layerSwitcher()
mapajs.addPlugin(pluginCapasSuperpuestas)

mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
  buttonTitle: 'cambiar impl :)',
  mapsFunction: mapa,
  sameMap: true,
  shareView: true,
  shareLayers: true
}));


if (mapaCesium.scene) {
  mapaCesium.terrainProvider = new Cesium.EllipsoidTerrainProvider();
}

// Deja los satélites y las órbitas dibujados sobre las capas recién creadas.
arrancarCalculosOrbitales();

return mapajs;

}

mapajs_0 = mapa();

// Refresco continuo (una sola vez por página): cada 5 s actualiza las
// posiciones y cada 120 s recalcula las órbitas (la ISS en su ventana de 2 h y
// las de Galileo en una revolución completa). El intervalo no se recrea al
// cambiar de implementación y siempre trabaja con las variables globales de
// capa, que mapa() reasigna a las capas nuevas, así que sigue apuntando a las
// capas vigentes tras un cambio 2D/3D.
ensureSatellite().then(function () {
  let iter = 0;
  setInterval(() => {

    if (iter >= 60) { // cada 120 s recalculamos la órbita de la ISS y las de Galileo
      iter = 0;
      OrbitISS()
      GalileoPositionByTime(true)
    }
    iter += 1
    ISSPosition(false, true)
    GalileoPositionByTime(false)

  }, 5 * 1000);
}).catch(function (err) {
  console.error("[satelites] No se pudo cargar satellite.js:", err && err.message);
  SVGCarga.hidden = true
});
