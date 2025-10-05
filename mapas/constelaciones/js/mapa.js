

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

// Configuración del mapa
IDEE.proxy(false);


/**************************************************************************
         * CONFIG
**************************************************************************/
// Altura de la "capa celeste" donde se proyectan líneas y estrellas (m)
const SHELL_ALT_METERS = 1.0e9;  // 1000 km

// Datos RA->lon (grados), Dec->lat (grados)
const CONSTELLATION_URL =
  'https://cdn.jsdelivr.net/gh/dieghernan/celestial_data@main/data/constellations.lines.min.geojson';
const STARS_URL =
  'https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/stars.6.json'; // mag <= 6

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

const layerEstrellas = new IDEE.layer.GeoJSON({
  name: "layerEstrellas",
  legend: "Estrellas (mag ≤ 6)",
  source: {}
}, { clampToGround: false });

const layerEcuador = new IDEE.layer.GeoJSON({
  name: "layerEcuador",
  legend: "Ecuador celeste",
  source: {}
}, {
  clampToGround: false
  // Opcional: según la API podrías añadir estilo, p.ej. style: { color: '#ffaa00', width: 2 }
});

mapajs.addLayers([layerConstelaciones, layerEstrellas, layerEcuador]);

/**************************************************************************
 * CARGA Y PREPARACIÓN DE DATOS (ICRF)
 **************************************************************************/
let constellationsICRF = null; // [{properties, segments: [[dirICRF,...], ...]}]
let starsICRF = null;          // [{properties, dirICRF}]
let equatorICRF = null; // <- nuevo (array de direcciones ICRF Dec=0)


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
    }, 1000);
  }
}

/**************************************************************************
 * INICIALIZACIÓN
 **************************************************************************/
(async function init() {
  await Promise.all([cargarConstelacionesICRF(), cargarEstrellasICRF()]);
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

  actualizarCielo();
  setInterval(actualizarCielo, 5 * 60 * 1000);
})();






SVGCarga.hidden = true
