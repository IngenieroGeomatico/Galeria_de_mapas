

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

let alturaISS = 0; // metros (solo marcador puntual, no para órbita)

ISSPosition = function (centerMap = false) {

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
    layerISS.setSource(ISS);
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

layerISS = new IDEE.layer.GeoJSON({
  name: "layerISS",
  legend: "layerISS",
  source: {},
}, {
  clampToGround: false,
});

layerOrbit = new IDEE.layer.GeoJSON({
  name: "layerOrbit",
  legend: "layerOrbit",
  source: {},
}, {
  clampToGround: false,
});

mapajs.addLayers(layerISS);
mapajs.addLayers(layerOrbit);
ISSPosition(centerMap = true)
OrbitISS()


let iter = 0;
setInterval(() => {

  if (iter >= 60) { // cada 120 s recalculamos órbita (1 hora antes / 1 hora después)
    iter = 0;
    OrbitISS()
  }
  iter += 1
  ISSPosition()

}, 2000);


SVGCarga.hidden = true
