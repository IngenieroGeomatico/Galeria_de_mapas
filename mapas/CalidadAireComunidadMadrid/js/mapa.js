

const SVGCarga = document.getElementById("cargaSVG")
window.onload = (event) => {
  SVGCarga.hidden = true
};


Base_IGNBaseTodo_TMS_2 = new M.layer.TMS({
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

M.addQuickLayers({
  Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2
})

tms_2= {
  "base": "QUICK*Base_IGNBaseTodo_TMS_2"
}

M.config("tms",tms_2) 

M.proxy(false)

mapajs = M.map({
  container: "mapa",
  zoom: 8,
  center: {x: -424083.9690092861, y: 4934857.956984267},
  controls: ['attributions'],
  layers: []
});

mapajs.addAttribution({
  name: "Autor:",
  description: " <a style='color: #0000FF' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
})

mapajs.addQuickLayers('Base_IGNBaseTodo_TMS_2')


geojsonJoin = myFunction_JoinData_CM()
geojsonJoin.then(()=>{

  // Estilos:
  let estiloEstacion = new M.style.Generic({
    point: {
      icon: {
        src: '../../img/iconos/house_wifi.svg',
        scale: 0.06,
      },

    }
  });

  let estiloComunidadAutonoma = new M.style.Generic({
    polygon: {
      fill: {
        opacity: 0.2,
      },
      stroke: {
        color: '#ff3c00',
        width: 4
      }
    }
  });



  // Capas:

  const capaEstaciones = new M.layer.GeoJSON({
      name: "Estaciones calidad del aire",
      source: geojsonJoin_CM.geojsonEstaciones,
      extract: true,
      legend: "Estaciones calidad del aire",
      attribution: {
        name: "Estaciones:",
        description: " <a style='color: #0000FF' href='https://www.comunidad.madrid/gobierno/datos-abiertos' target='_blank'>Comunidad de Madrid</a> "
      }
    },{
      style:estiloEstacion
  })

  const capaCM = new M.layer.GeoJSON({
    name: "Comunidad de Madrid",
    source: geojsonJoin_CM.ComunidadAutonoma,
    extract: true,
    legend: "Comunidad de Madrid",
    attribution: {
      name: "Comunidad de Madrid:",
      description: " <a style='color: #0000FF' href='https://api-features.ign.es/collections/administrativeunit/items?limit=1&nameunit=Comunidad%20de%20Madrid&nationallevelname=Comunidad autónoma' target='_blank'>IGN</a> "
    }
  },{
    style: estiloComunidadAutonoma
  })






  arrayLayers = [
    capaEstaciones,
    capaCM,      
    // capaEstacionesMedidas_1, capaEstacionesMedidas_6, 
    // capaEstacionesMedidas_7, capaEstacionesMedidas_8, capaEstacionesMedidas_9,
    // capaEstacionesMedidas_10, capaEstacionesMedidas_12, capaEstacionesMedidas_14,
    // capaEstacionesMedidas_20, capaEstacionesMedidas_30, capaEstacionesMedidas_35,

    // capaEstacionesMedidas_37, capaEstacionesMedidas_38, capaEstacionesMedidas_39,
    // capaEstacionesMedidas_42, capaEstacionesMedidas_43, capaEstacionesMedidas_44,
    // capaEstacionesMedidas_431
  ]


  // y la añadimos al mapa
  mapajs.addLayers(arrayLayers.reverse());

})


// Funciones necesarias para el visualizador
async function myFunction_JoinData_CM() {
  geojsonJoin_CM = {}

  let myPromise_1_CM = new Promise(function (resolve) {
    M.proxy(true)
    M.remote.get("https://api-features.ign.es/collections/administrativeunit/items?limit=1&nameunit=Comunidad%20de%20Madrid&nationallevelname=Comunidad%20aut%C3%B3noma&f=json").then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(JSON.parse(res.text))
      });
  });
  value_1__gjson_ComunidadMadrid = await myPromise_1_CM;

  geojsonJoin_CM.ComunidadAutonoma = value_1__gjson_ComunidadMadrid


  let myPromise_2_Estaciones= new Promise(function (resolve) {
    M.proxy(true)
    M.remote.get("https://datos.comunidad.madrid/catalogo/dataset/4cd076a3-e602-48da-b834-58de39d3125c/resource/0aa62bb9-9fad-42df-826d-72ae903e3bd6/download/calidad_aire_estaciones.json").then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(JSON.parse(res.text))
      });
  });
  value_2__gjson_Estaciones = await myPromise_2_Estaciones;

  for (f in value_2__gjson_Estaciones["data"]) {
      value_2__gjson_Estaciones["data"][f]["estacion_coord_latitud"] = convertGmsToDecimal(value_2__gjson_Estaciones["data"][f]["estacion_coord_latitud"])
      value_2__gjson_Estaciones["data"][f]["estacion_coord_longitud"] = convertGmsToDecimal(value_2__gjson_Estaciones["data"][f]["estacion_coord_longitud"])
  }

  geojsonEstaciones = jsonToGeoJson_fromLongLat(value_2__gjson_Estaciones["data"], "estacion_coord_longitud","estacion_coord_latitud")
  geojsonJoin_CM.geojsonEstaciones = geojsonEstaciones


  return geojsonJoin_CM
}



// Extensiones
M.proxy(false)
const ext_Modal = new M.plugin.Modal({
  position: 'BL',
  helpLink: {
    es: '../../html/modal_CalidadAireMadridTiempoReal.html'
  }
});
M.proxy(false)
mapajs.addPlugin(ext_Modal);

const ext_LayerSwitcher = new M.plugin.Layerswitcher({
  collapsed: true,
  position: 'TR',
  collapsible: true,
  isDraggable: true,
  modeSelectLayers: 'eyes',
  tools: ['transparency', 'zoom', 'information', 'delete'],
  isMoveLayers: true,
  https: true,
  http: true,
  showCatalog: false,
  displayLabel: false,
});
mapajs.addPlugin(ext_LayerSwitcher);
M.proxy(false)


mapajs.addPlugin(miPlugin)

mapajs.addPlugin(miPlugin_leyenda)
