

const SVGCarga = document.getElementById("cargaSVG")
// window.onload = (event) => {
//   SVGCarga.hidden = true
// };


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

IDEE.config.backgroundlayers = [
  {
    "id": "mapa",
    "title": "Callejero",
    "layers": [
      "QUICK*Base_IGNBaseTodo_TMS_2"
    ]
  },
  {
    "id": "imagen",
    "title": "Imagen",
    "layers": [
      "QUICK*BASE_PNOA_MA_TMS"
    ]
  },
  {
    "id": "ning",
    "title": "Ninguno",
    "layers": [
      ""
    ]
  }
]


// Configuración del mapa
IDEE.proxy(false);


/**************************************************************************
         * CONFIG
**************************************************************************/
// Altura de la "capa celeste" donde se proyectan líneas y estrellas (m)
SHELL_ALT_METERS = 1.0e9;  // 1000 km

// Datos RA->lon (grados), Dec->lat (grados)
// https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/
const CONSTELLATION_URL =
  'https://cdn.jsdelivr.net/gh/dieghernan/celestial_data@main/data/constellations.lines.min.geojson';

const STARS_URL =
  'https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/stars.6.json'; // mag <= 8 (6,8,14)

const STAR_NAME_URL =
  "https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/starnames.json"

const PLANETAS_URL =
  'https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/planets.json'; // mag <= 8 (6,8,14)

/**************************************************************************
 * UTILIDADES: RA/Dec -> ICRF unitario; ICRF->ECEF; ECEF -> [lon,lat,h]
 **************************************************************************/

// RA/Dec (deg) -> vector unitario ICRF (x,y,z)
function raDecToUnitICRF(raDeg, decDeg) {
  const ra = Cesium.Math.toRadians(raDeg);
  const dec = Cesium.Math.toRadians(decDeg);
  return new Cesium.Cartesian3(
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec)
  );
}

// Usa una matriz R (ICRF->ECEF) para llevar la dirección a ECEF, proyectarla
// sobre una esfera a altura fija y devolver [lon_deg, lat_deg, altura_m]
function directionICRFtoLLHWithMatrix(dirICRF, R_icrf2ecef, shellAltMeters) {
  const dirECEF = Cesium.Matrix3.multiplyByVector(R_icrf2ecef, dirICRF, new Cesium.Cartesian3());
  const u = Cesium.Cartesian3.normalize(dirECEF, new Cesium.Cartesian3());
  const earthR = Cesium.Ellipsoid.WGS84.maximumRadius; // ~6378137 m
  const shellR = earthR + shellAltMeters;
  const onShellECEF = Cesium.Cartesian3.multiplyByScalar(u, shellR, new Cesium.Cartesian3());
  const carto = Cesium.Cartographic.fromCartesian(onShellECEF, Cesium.Ellipsoid.WGS84);
  return [
    Cesium.Math.toDegrees(carto.longitude),
    Cesium.Math.toDegrees(carto.latitude),
    shellAltMeters
  ];
}



const mapajs = IDEE.map({
  container: "mapa", //id del contenedor del mapa
  center: { x: -5.401192785534927, y: 38.76089860530802 },
  zoom: 0
});

const mapaCesium = mapajs.getMapImpl();
mapaCesium.terrainProvider = new Cesium.EllipsoidTerrainProvider();


// Skybox y ocultar Tierra/atmósfera
(function setupSky() {
  // mapaCesium.scene.skyBox = new Cesium.SkyBox({
  //   sources: {
  //     negativeX: "https://sandcastle.cesium.com/CesiumUnminified/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg",
  //     negativeY: "https://sandcastle.cesium.com/CesiumUnminified/Assets/Textures/SkyBox/tycho2t3_80_my.jpg",
  //     negativeZ: "https://sandcastle.cesium.com/CesiumUnminified/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg",
  //     positiveX: "https://sandcastle.cesium.com/CesiumUnminified/Assets/Textures/SkyBox/tycho2t3_80_px.jpg",
  //     positiveY: "https://sandcastle.cesium.com/CesiumUnminified/Assets/Textures/SkyBox/tycho2t3_80_py.jpg",
  //     positiveZ: "https://sandcastle.cesium.com/CesiumUnminified/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg",
  //   }
  // });
  mapaCesium.scene.globe.showGroundAtmosphere = false;
  mapaCesium.scene.skyAtmosphere = undefined;
  mapaCesium.scene.globe.show = true;
  mapaCesium.scene.backgroundColor = Cesium.Color.BLACK;
})();



/**************************************************************************
 * CAPAS GEOJSON (lon, lat, altura)
 **************************************************************************/
const layerConstelaciones = new IDEE.layer.GeoJSON({
  name: "layerConstelaciones",
  legend: "Constelaciones",
  source: {}
}, { clampToGround: false });
layerConstelaciones.proj = true

let estilo_layerConstelaciones = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas

    fill: {
      color: 'orange',
      width: 2,
      opacity: 1,
    },

  }
});
layerConstelaciones.setStyle(estilo_layerConstelaciones)

const layerEstrellas = new IDEE.layer.GeoJSON({
  name: "layerEstrellas",
  legend: "Estrellas (mag ≤ 6)",
  source: {}
}, { clampToGround: false });
layerEstrellas.proj = true

let estilo_layerEstrellas = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
    radius: 3,
    fill: {
      color: 'red',
      opacity: 0.8
    },
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas
  }
});
layerEstrellas.setStyle(estilo_layerEstrellas)


const layerEcuador = new IDEE.layer.GeoJSON({
  name: "layerEcuador",
  legend: "Ecuador",
  source: {}
}, {
  clampToGround: false
});
layerEcuador.proj = true

let estilo_layerEcuador = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas


    fill: {
      color: 'yellow',
      width: 2,
      opacity: 0.5,
    },
  }
});
layerEcuador.setStyle(estilo_layerEcuador);


const layerPlanetas = new IDEE.layer.GeoJSON({
  name: "layerPlanetas",
  legend: "Planetas",
  source: {}
}, { clampToGround: false });
layerPlanetas.proj = true

let estilo_layerPlanetas = new IDEE.style.Generic({
  point: {
    // Definición atributos para puntos
    radius: 10,
    fill: {
      color: 'blue',
      opacity: 1
    },
  },
  polygon: {
    // Definición atributos para polígonos
  },
  line: {
    // Definición atributos para líneas
  }
});
layerPlanetas.setStyle(estilo_layerPlanetas)



mapajs.addLayers([layerConstelaciones, layerEstrellas, layerEcuador,layerPlanetas]);

mapajs.addPlugin(miPlugin)
mapajs.addPlugin(miPlugin2)





/**************************************************************************
 * CARGA Y PREPARACIÓN DE DATOS (ICRF)
 **************************************************************************/
let constellationsICRF = null; // [{properties, segments: [[dirICRF,...], ...]}]
let starsICRF = null;          // [{properties, dirICRF}]
let equatorICRF = null; // <- nuevo (array de direcciones ICRF Dec=0)
let rawPlanetas = null

async function cargarConstelacionesICRF() {
  const res = await IDEE.remote.get(CONSTELLATION_URL, {});
  const raw = JSON.parse(res.text);
  delete raw.crs;

  constellationsICRF = (raw.features || []).map(f => {
    const props = f.properties || {};
    const geom = f.geometry || {};
    let segmentsLonLat;

    if (geom.type === "LineString") {
      segmentsLonLat = [geom.coordinates || []];
    } else if (geom.type === "MultiLineString") {
      segmentsLonLat = geom.coordinates || [];
    } else {
      segmentsLonLat = [];
    }

    const segments = segmentsLonLat.map(seg =>
      (seg || []).map(([lon, lat]) => raDecToUnitICRF(lon, lat))
    );
    return { properties: props, segments };
  });
}

async function cargarEstrellasICRF() {
  const res = await IDEE.remote.get(STARS_URL, {});
  const raw = JSON.parse(res.text);

  const res2 = await IDEE.remote.get(STAR_NAME_URL, {});
  const raw2 = JSON.parse(res2.text);

  raw.features.forEach(feature => {
    const id = feature.id || feature.properties.id;
    if (id && raw2[id]) {
      Object.assign(feature.properties, raw2[id]);
    }
  });

  // d3-celestial suele exponer FeatureCollection con Point [RAdeg, Decdeg]
  // (pero robustecemos por si viene anidado)
  const features = Array.isArray(raw?.features) ? raw.features
    : Array.isArray(raw?.objects?.stars?.geometries) ? raw.objects.stars.geometries // por si fuese TopoJSON simplificado
      : [];

  starsICRF = features.map(f => {
    // Compatibilidad: 'f.geometry.coordinates' o 'f.coordinates'
    const coords = f.geometry?.coordinates || f.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [raDeg, decDeg] = coords;   // RA->lon (deg), Dec->lat (deg)
    const dir = raDecToUnitICRF(raDeg, decDeg);

    // Magnitud y otros props si existen
    const mag = f.properties?.mag ?? f.mag;
    const props = Object.assign({}, f.properties || {}, { mag });

    return { properties: props, dirICRF: dir };
  }).filter(Boolean);
}

// Preparar ecuador celeste (Dec = 0°, RA 0..360)
function prepararEcuadorICRF(stepDeg = 1) {
  const dirs = [];
  for (let ra = 0; ra <= 360; ra += stepDeg) {
    dirs.push(raDecToUnitICRF(ra, 0));
  }
  equatorICRF = dirs;
}


async function cargarPlanetas() {
  const res = await IDEE.remote.get(PLANETAS_URL, {});
  rawPlanetas = JSON.parse(res.text);
  return rawPlanetas
}


function buildEquatorGeojsonAtTime_withMatrix(R_icrf2ecef, shellAlt) {
  if (!equatorICRF) return { type: "FeatureCollection", features: [] };
  const coords = equatorICRF.map(dir =>
    directionICRFtoLLHWithMatrix(dir, R_icrf2ecef, shellAlt)
  );
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: { name: "Ecuador celeste" }
    }]
  };
}

function getPlanetsGeoJSON(planetsObj, date = new Date(), alturaCero = false) {
  function planetPosition(elements, date) {
    const epoch = new Date(elements.ep + "T00:00:00Z");
    const t = (date - epoch) / (1000 * 60 * 60 * 24);

    const a = elements.a + (elements.da || 0) * t;
    const e = elements.e + (elements.de || 0) * t;
    const i = elements.i + (elements.di || 0) * t;
    let L = elements.L !== undefined
      ? elements.L + (elements.dL || 0) * t
      : (elements.M + (elements.n || 0) * t + (elements.w || 0));
    const W = elements.W !== undefined
      ? elements.W + (elements.dW || 0) * t
      : (elements.w || 0);
    const N = elements.N + (elements.dN || 0) * t;

    // Normaliza ángulos a 0-360
    const norm = x => ((x % 360) + 360) % 360;
    const iN = norm(i);
    const iL = norm(L);
    const iW = norm(W);
    const iNod = norm(N);

    const M = elements.L !== undefined
      ? norm(iL - iW)
      : norm(elements.M + (elements.n || 0) * t);
    const M_rad = Cesium.Math.toRadians(M);

    // Ecuación de Kepler para la anomalía excéntrica E
    let E = M_rad;
    for (let j = 0; j < 10; j++) {
      E = M_rad + e * Math.sin(E);
    }

    // Protege la raíz cuadrada
    const sqrtArg = 1 - e * e;
    const y_orb = a * (sqrtArg > 0 ? Math.sqrt(sqrtArg) : 0) * Math.sin(E);
    const x_orb = a * (Math.cos(E) - e);

    const i_rad = Cesium.Math.toRadians(iN);
    const W_rad = Cesium.Math.toRadians(iW);
    const N_rad = Cesium.Math.toRadians(iNod);

    const x_ec = (Math.cos(N_rad) * Math.cos(W_rad) - Math.sin(N_rad) * Math.sin(W_rad) * Math.cos(i_rad)) * x_orb
      + (-Math.cos(N_rad) * Math.sin(W_rad) - Math.sin(N_rad) * Math.cos(W_rad) * Math.cos(i_rad)) * y_orb;
    const y_ec = (Math.sin(N_rad) * Math.cos(W_rad) + Math.cos(N_rad) * Math.sin(W_rad) * Math.cos(i_rad)) * x_orb
      + (-Math.sin(N_rad) * Math.sin(W_rad) + Math.cos(N_rad) * Math.cos(W_rad) * Math.cos(i_rad)) * y_orb;
    const z_ec = (Math.sin(W_rad) * Math.sin(i_rad)) * x_orb + (Math.cos(W_rad) * Math.sin(i_rad)) * y_orb;

    const r = Math.sqrt(x_ec * x_ec + y_ec * y_ec + z_ec * z_ec);
    const lon = Cesium.Math.toDegrees(Math.atan2(y_ec, x_ec));
    const lat = Cesium.Math.toDegrees(Math.asin(z_ec / r));
    const UAtoMeters = 149597870700;
    const alt = SHELL_ALT_METERS;

    return [lon, lat, alt];
  }

  const features = Object.values(planetsObj)
    .filter(p => Array.isArray(p.elements) && p.elements.length > 0)
    .map(p => {
      const coords = planetPosition(p.elements[0], date);
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: coords // [lon, lat, alt]
        },
        properties: {
          id: p.id,
          name: p.name,
          desig: p.desig,
          date: date.toISOString()
        }
      };
    });

  return {
    type: "FeatureCollection",
    features
  };
}

// Construye GeoJSON (MultiLineString) para constelaciones
function buildConstellationsGeojsonAtTime_withMatrix(R_icrf2ecef, shellAlt) {
  if (!constellationsICRF) return { type: "FeatureCollection", features: [] };

  const features = constellationsICRF.map(f => {
    const coordsLLHSegments = f.segments.map(seg =>
      seg.map(dir => directionICRFtoLLHWithMatrix(dir, R_icrf2ecef, shellAlt))
    );
    return {
      type: "Feature",
      geometry: { type: "MultiLineString", coordinates: coordsLLHSegments },
      properties: f.properties
    };
  });

  return { type: "FeatureCollection", features };
}

// Construye GeoJSON (Point) para estrellas
function buildStarsGeojsonAtTime_withMatrix(R_icrf2ecef, shellAlt) {
  if (!starsICRF) return { type: "FeatureCollection", features: [] };

  const features = starsICRF.map(s => {
    const coords = directionICRFtoLLHWithMatrix(s.dirICRF, R_icrf2ecef, shellAlt);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: coords }, // [lon, lat, h]
      properties: s.properties || {}
    };
  });

  return { type: "FeatureCollection", features };
}

/**************************************************************************
 * ACTUALIZACIÓN (con polling si R no está lista)
 **************************************************************************/
let icrfPollId = null; // para no crear múltiples intervalos

function actualizarCielo(fechaJulian = null) {
  const t = fechaJulian || Cesium.JulianDate.now(); // Cesium.JulianDate
  console.log('t:', Cesium.JulianDate.toIso8601(t));
  const R = Cesium.Transforms.computeIcrfToFixedMatrix(t);

  if (Cesium.defined(R)) {
    if (icrfPollId !== null) { clearInterval(icrfPollId); icrfPollId = null; }

    if (constellationsICRF) {
      const gjsonC = buildConstellationsGeojsonAtTime_withMatrix(R, SHELL_ALT_METERS);
      layerConstelaciones.setSource(gjsonC);
    }
    if (starsICRF) {
      const gjsonS = buildStarsGeojsonAtTime_withMatrix(R, SHELL_ALT_METERS);
      layerEstrellas.setSource(gjsonS);
    }
    if (equatorICRF) {
      const gjsonE = buildEquatorGeojsonAtTime_withMatrix(R, SHELL_ALT_METERS);
      layerEcuador.setSource(gjsonE);
    }
    if (rawPlanetas) {
      geojsonPlanets = getPlanetsGeoJSON(rawPlanetas, new Date(), true); // altura 0
      layerPlanetas.setSource(geojsonPlanets);
    }
    return;
  }

  if (icrfPollId === null) {
    icrfPollId = setInterval(() => {
      const t2 = fechaJulian || mapaCesium.clock.currentTime;
      const R2 = Cesium.Transforms.computeIcrfToFixedMatrix(t2);
      if (!Cesium.defined(R2)) return;

      clearInterval(icrfPollId);
      icrfPollId = null;

      if (constellationsICRF) {
        const gjsonC2 = buildConstellationsGeojsonAtTime_withMatrix(R2, SHELL_ALT_METERS);
        layerConstelaciones.setSource(gjsonC2);
      }
      if (starsICRF) {
        const gjsonS2 = buildStarsGeojsonAtTime_withMatrix(R2, SHELL_ALT_METERS);
        layerEstrellas.setSource(gjsonS2);
      }
      if (equatorICRF) {
        const gjsonE2 = buildEquatorGeojsonAtTime_withMatrix(R2, SHELL_ALT_METERS);
        layerEcuador.setSource(gjsonE2);
      }
      if (rawPlanetas) {
        geojsonPlanets = getPlanetsGeoJSON(rawPlanetas, new Date(), true); // altura 0
        layerPlanetas.setSource(geojsonPlanets);
      }
    }, 1000);
  }
}

/**************************************************************************
 * INICIALIZACIÓN
 **************************************************************************/
(async function init() {
  await Promise.all([cargarConstelacionesICRF(), cargarEstrellasICRF(), cargarPlanetas()]);
  prepararEcuadorICRF(5); // resolución 5°

  // Bucle para ver la evolución cada hora durante 12 horas
  // const ahora = mapaCesium.clock.currentTime;
  // for (let i = 0; i <= 12; i++) {
  //   const fecha = Cesium.JulianDate.addHours(ahora, i, new Cesium.JulianDate());
  //   setTimeout(() => {
  //     actualizarCielo(fecha);
  //     // console.log(i, Cesium.JulianDate.toIso8601(fecha));
  //   }, 
  //   i * 20 * 1000); // <-- Multiplica por i para escalonar las ejecuciones
  // }
  mapaCesium.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  actualizarCielo();
  setInterval(actualizarCielo, 5 * 60 * 1000);
})();






SVGCarga.hidden = true
