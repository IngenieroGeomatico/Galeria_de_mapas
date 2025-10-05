

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

ISSPosition = function (centerMap = false, onlyPosition=false) {

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

    if(!onlyPosition){
      layerISS.setSource(ISS);
    }

    
    let checkVar = setInterval(() => {

      layerISS_Cesium = layerISS.getImpl().getLayer()
      if (typeof layerISS_Cesium !== 'undefined' && layerISS_Cesium !== null && layerISS_Cesium.entities.values.length > 0) {

        entity = layerISS_Cesium.entities.values[0]
        
        if(onlyPosition){
          entity.position = Cesium.Cartesian3.fromDegrees(jsonParser.longitude, jsonParser.latitude,alturaISS);
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

mapajs.addLayers(layerISS);
mapajs.addLayers(layerOrbit);
OrbitISS()
ISSPosition(centerMap = true)

mapajs.addPlugin(miPlugin)
mapajs.addPlugin(miPlugin2)


let iter = 0;
setInterval(() => {

  if (iter >= 60) { // cada 120 s recalculamos órbita (1 hora antes / 1 hora después)
    iter = 0;
    OrbitISS()
  }
  iter += 1
  ISSPosition(centerMap = false, onlyPosition=true)

},5*1000);


SVGCarga.hidden = true
