

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
  }
]

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

    if (!onlyPosition) {
      layerISS.setSource(ISS);
    }


    let checkVar = setInterval(() => {

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
        geometry: { type: "LineString", coordinates: positions },
        properties: { name: "ISS", id: "25544" }
      }]
    };
    layerOrbit.setSource(geojson)
  })
}

jsonGalileo = {}
tleGalileo = {}
tleMap = {};
GalileoPosition = function (Orbit = false) {

  function parseTLEtoJSON(tleText) {
    const lines = tleText.trim().split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i += 3) {
      const name = lines[i].trim();
      const line1 = lines[i + 1]?.trim();
      const line2 = lines[i + 2]?.trim();
      if (name && line1 && line2) {
        result.push({ name, line1, line2 });
      }
    }
    return result;
  }

  Promise.all([
    IDEE.remote.get("https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=json", {}),
    IDEE.remote.get("https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle", {})
  ]).then(([res1_json, res2_tle]) => {
    // Ambos resultados están disponibles aquí
    jsonGalileo = JSON.parse(res1_json.text);
    tleGalileo = parseTLEtoJSON(res2_tle.text);
    // Creamos un mapa para buscar rápido por nombre
    
    tleGalileo.forEach(tle => {
      tleMap[tle.name.trim()] = tle;
    });

    // Añadimos line1 y line2 a cada objeto del JSON si hay coincidencia
    geojsonGalileoOrbit = {
      type: "FeatureCollection",
      features: []
    };

    geojsonGalileo = {
      type: "FeatureCollection",
      features: []
    };

    jsonGalileo.forEach(obj => {
      const tle = tleMap[obj.OBJECT_NAME.trim()];
      if (tle) {
        obj.line1 = tle.line1;
        obj.line2 = tle.line2;
      }

      satrec = satellite.twoline2satrec(obj.line1, obj.line2);

      if (Orbit) {

        startDate = new Date(Date.now() - 60 * 60 * 1000);
        const positions = [];

        for (let i = 0; i < 120 * 5; i++) {
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
        feature = {
          type: "Feature",
          geometry: { type: "LineString", coordinates: positions },
          properties: obj
        }
        geojsonGalileoOrbit.features.push(feature)



      }

      DateNow = new Date(Date.now());
      const pv2 = satellite.propagate(satrec, DateNow);
      const positionEci2 = pv2.position;

      const gmst2 = satellite.gstimeFromDate(DateNow);
      const positionGd2 = satellite.eciToGeodetic(positionEci2, gmst2);
      const longitude2 = satellite.degreesLong(positionGd2.longitude);
      const latitude2 = satellite.degreesLat(positionGd2.latitude);
      // positionGd.height está en km -> convertir a metros
      const altitudeMeters2 = positionGd2.height * 1000;

      feature2 = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [longitude2, latitude2, altitudeMeters2] },
        properties: obj
      }
      geojsonGalileo.features.push(feature2)


    });


    if (Orbit) {
      layerGalileoOrbit.setSource(geojsonGalileoOrbit)
    }
    layerGalileo.setSource(geojsonGalileo)

  });

}

GalileoPositionByTime = function (Orbit = false) {

    // Añadimos line1 y line2 a cada objeto del JSON si hay coincidencia
    geojsonGalileoOrbit = {
      type: "FeatureCollection",
      features: []
    };

    geojsonGalileo = {
      type: "FeatureCollection",
      features: []
    };

    jsonGalileo.forEach(obj => {
      const tle = tleMap[obj.OBJECT_NAME.trim()];
      if (tle) {
        obj.line1 = tle.line1;
        obj.line2 = tle.line2;
      }

      satrec = satellite.twoline2satrec(obj.line1, obj.line2);

      if (Orbit) {

        startDate = new Date(Date.now() - 60 * 60 * 1000);
        const positions = [];

        for (let i = 0; i < 120 * 5; i++) {
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
        feature = {
          type: "Feature",
          geometry: { type: "LineString", coordinates: positions },
          properties: { name: "ISS", id: "25544" }
        }
        geojsonGalileoOrbit.features.push(feature)



      }

      DateNow = new Date(Date.now());
      const pv2 = satellite.propagate(satrec, DateNow);
      const positionEci2 = pv2.position;

      const gmst2 = satellite.gstimeFromDate(DateNow);
      const positionGd2 = satellite.eciToGeodetic(positionEci2, gmst2);
      const longitude2 = satellite.degreesLong(positionGd2.longitude);
      const latitude2 = satellite.degreesLat(positionGd2.latitude);
      // positionGd.height está en km -> convertir a metros
      const altitudeMeters2 = positionGd2.height * 1000;

      feature2 = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [longitude2, latitude2, altitudeMeters2] },
        properties: { name: "ISS", id: "25544" }
      }
      geojsonGalileo.features.push(feature2)


    });


    if (Orbit) {
      layerGalileoOrbit.setSource(geojsonGalileoOrbit)
    }
    layerGalileo.setSource(geojsonGalileo)


}

const mapajs = IDEE.map({
  container: "mapa", //id del contenedor del mapa
  center: { x: -5.401192785534927, y: 38.76089860530802 },
  zoom: 7,
});


var mapaCesium = mapajs.getMapImpl();
mapaCesium.scene.globe.depthTestAgainstTerrain = true;

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
    stroke: {
      color: 'white',
      width: 2,
      opacity: 0.3
    }
  }
});
layerGalileoOrbit.setStyle(estilo_orbGalileo);


mapajs.addLayers(layerISS);
mapajs.addLayers(layerOrbit);
mapajs.addLayers(layerGalileo);
mapajs.addLayers(layerGalileoOrbit);
OrbitISS()
ISSPosition(centerMap = true)
GalileoPosition(Orbit = true)

mapajs.addPlugin(miPlugin)
mapajs.addPlugin(miPlugin2)

mapaCesium.terrainProvider = new Cesium.EllipsoidTerrainProvider();


let iter = 0;
setInterval(() => {

  if (iter >= 60) { // cada 120 s recalculamos órbita (1 hora antes / 1 hora después)
    iter = 0;
    OrbitISS()
    GalileoPositionByTime(Orbit = true)
  }
  iter += 1
  ISSPosition(centerMap = false, onlyPosition = true)
  GalileoPositionByTime(Orbit = false)


}, 5 * 1000);


SVGCarga.hidden = true
