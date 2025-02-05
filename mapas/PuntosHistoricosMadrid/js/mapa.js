

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

tms_2 = {
  "base": "QUICK*Base_IGNBaseTodo_TMS_2"
}

M.config("tms", tms_2)
M.config.MOVE_MAP_EXTRACT = false

M.proxy(false)
M.config.POPUP_INTELLIGENCE.activate = false

mapajs = M.map({
  container: "mapa",
  zoom: 12,
  center: { x: -413064.3575507956, y: 4927841.089710372 },
  controls: ['attributions'],
  layers: []
});

mapajs.addAttribution({
  name: "Autor:",
  description: " <a style='color: #0000FF' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
})

mapajs.addQuickLayers('Base_IGNBaseTodo_TMS_2')


// Estilos

let clusterOptionsMonumentos = {
  ranges: [{
    min: 2,
    max: 5,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#79daf7',
        },
        radius: 15
      }
    })
  }, {
    min: 5,
    max: 9,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#46a5c2',
        },
        radius: 25
      }
    })
  }, {
    min: 10,
    max: 49,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#157a99',
        },
        radius: 30
      }
    })
  }, {
    min: 50,
    max: 9999,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#034357',
        },
        radius: 40
      }
    })
  }
  ],
  animated: true,
  hoverInteraction: true,
  displayAmount: true,
  selectInteraction: true,
  distance: 80,
  label: {
    font: 'bold 19px Comic Sans MS',
    color: '#FFFFFF'
  }
};
let vendorParameters = {
  distanceSelectFeatures: 25,
  convexHullStyle: {
    fill: {
      color: '#000000',
      opacity: 0.5
    },
    stroke: {
      color: '#000000',
      width: 1
    }
  }
}
//generamos un cluster personalizado
let styleCluster_Monumentos = new M.style.Cluster(clusterOptionsMonumentos, vendorParameters);

let estilo_base_Monumentos = new M.style.Generic({
  point: {
    icon: {
      // Forma del fontsymbol.
      // BAN(cículo)|BLAZON(diálogo cuadrado)|BUBBLE(diálogo redondo)|CIRCLE(círculo)|LOZENGE(diamante)|MARKER(diálogo redondeado)
      // NONE(ninguno)|SHIELD(escudo)|SIGN(triángulo)|SQUARE(cuadrado)|TRIANGLE(triángulo invertido)
      form: M.style.form.SHIELD,
      // Tamaño de la fuente
      fontsize: 0.7,
      // Clase fuente
      class: 'M',
      // Tamaño del radio
      radius: 15,
      // Giro del icono en radianes
      rotation: 0,
      // Activar rotación con dispositivo
      rotate: false,
      // Desplazamiento en píxeles en los ejes x,y
      color: 'red', // Hexadecimal, nominal
      // Desplazamiento
      offset: [0, 0],
      // Color de relleno. Hexadecimal, nominal
      fill: 'orange',
      // Transparencia. 0(transparente)|1(opaco) 
      opacity: 0.9,
    },
  }
});

let compositeMonumentos = styleCluster_Monumentos.add(estilo_base_Monumentos);



let clusterOptionsPlacas = {
  ranges: [{
    min: 2,
    max: 5,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#BABD5E',
        },
        radius: 15
      }
    })
  }, {
    min: 5,
    max: 9,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#C1C33E',
        },
        radius: 25
      }
    })
  }, {
    min: 10,
    max: 49,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#808006',
        },
        radius: 30
      }
    })
  }, {
    min: 50,
    max: 9999,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#8C7300',
        },
        radius: 40
      }
    })
  }
  ],
  animated: true,
  hoverInteraction: true,
  displayAmount: true,
  selectInteraction: true,
  distance: 80,
  label: {
    font: 'bold 19px Comic Sans MS',
    color: '#FFFFFF'
  }
};

//generamos un cluster personalizado
let styleCluster_Placas= new M.style.Cluster(clusterOptionsPlacas, vendorParameters);

let estilo_base_Placas = new M.style.Generic({
  point: {
    icon: {
      // Forma del fontsymbol.
      // BAN(cículo)|BLAZON(diálogo cuadrado)|BUBBLE(diálogo redondo)|CIRCLE(círculo)|LOZENGE(diamante)|MARKER(diálogo redondeado)
      // NONE(ninguno)|SHIELD(escudo)|SIGN(triángulo)|SQUARE(cuadrado)|TRIANGLE(triángulo invertido)
      form: M.style.form.LOZENGE,
      // Tamaño de la fuente
      fontsize: 0.7,
      // Clase fuente
      class: 'P',
      // Tamaño del radio
      radius: 15,
      // Giro del icono en radianes
      rotation: 0,
      // Activar rotación con dispositivo
      rotate: false,
      // Desplazamiento en píxeles en los ejes x,y
      color: 'black', // Hexadecimal, nominal
      // Desplazamiento
      offset: [0, 0],
      // Color de relleno. Hexadecimal, nominal
      fill: '#FFD600',
      // Transparencia. 0(transparente)|1(opaco) 
      opacity: 0.9,
    },
  }
});

let compositePlacas = styleCluster_Placas.add(estilo_base_Placas);



let clusterOptionsStonh = {
  ranges: [{
    min: 2,
    max: 5,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#BD9D5E',
        },
        radius: 15
      }
    })
  }, {
    min: 5,
    max: 9,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#AC8F3E',
        },
        radius: 25
      }
    })
  }, {
    min: 10,
    max: 49,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#9B821F',
        },
        radius: 30
      }
    })
  }, {
    min: 50,
    max: 9999,
    style: new M.style.Generic({
      point: {
        stroke: {
          color: '#5789aa'
        },
        fill: {
          color: '#8A7500',
        },
        radius: 40
      }
    })
  }
  ],
  animated: true,
  hoverInteraction: true,
  displayAmount: true,
  selectInteraction: true,
  distance: 80,
  label: {
    font: 'bold 19px Comic Sans MS',
    color: '#FFFFFF'
  }
};

//generamos un cluster personalizado
let styleCluster_Stonh = new M.style.Cluster(clusterOptionsStonh, vendorParameters);

let estilo_base_Stonh = new M.style.Generic({
  point: {
    icon: {
      // Forma del fontsymbol.
      // BAN(cículo)|BLAZON(diálogo cuadrado)|BUBBLE(diálogo redondo)|CIRCLE(círculo)|LOZENGE(diamante)|MARKER(diálogo redondeado)
      // NONE(ninguno)|SHIELD(escudo)|SIGN(triángulo)|SQUARE(cuadrado)|TRIANGLE(triángulo invertido)
      form: M.style.form.SQUARE,
      // Tamaño de la fuente
      fontsize: 0.7,
      // Clase fuente
      class: 'S',
      // Tamaño del radio
      radius: 15,
      // Giro del icono en radianes
      rotation: 0,
      // Activar rotación con dispositivo
      rotate: false,
      // Desplazamiento en píxeles en los ejes x,y
      color: 'black', // Hexadecimal, nominal
      // Desplazamiento
      offset: [0, 0],
      // Color de relleno. Hexadecimal, nominal
      fill: '#c9be1c',
      // Transparencia. 0(transparente)|1(opaco) 
      opacity: 0.9,
    },
  }
});

let compositeStonh= styleCluster_Stonh.add(estilo_base_Stonh);


geojsonData = myFunction_GetData()
geojsonData.then(() => {

  // creamos la capa
  // console.log("1: ",geojsonDataAsync.geoJson_Monumentos)
  const capaMonumentos = new M.layer.GeoJSON({
    name: "Monumentos",
    source: geojsonDataAsync.geoJson_Monumentos,
    extract: true,
    legend: "Monumentos",
    filterID: "Monumentos",
    attribution: {
      name: "Monumentos:",
      description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    }
  }, {
    visibility:true,
    // style:estiloEstacion
  })
  capaMonumentos.filterID = "Monumentos"
  capaMonumentos.setStyle(styleCluster_Monumentos)
  capaMonumentos.on(M.evt.SELECT_FEATURES, function (features, evt) {
    // se puede comprobar si el elemento seleccionado es un cluster o no
    if (features[0] instanceof M.ClusteredFeature) {
      console.log('Es un cluster');
      mapajs.getPopup().hide()
    }
  });
  mapajs.addLayers(capaMonumentos)


  const capaPlacas = new M.layer.GeoJSON({
    name: "Placas conmemorativas",
    source: geojsonDataAsync.geoJson_Placas,
    extract: true,
    legend: "Placas conmemorativas",
    filterID: "Placas conmemorativas",
    attribution: {
      name: "Placas conmemorativas:",
      description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    }
  }, {
    visibility:false,
    // style:estiloEstacion
  })
  // capaPlacas.setStyle(styleCluster_Monumentos)
  // capaPlacas.on(M.evt.SELECT_FEATURES, function (features, evt) {
  //   // se puede comprobar si el elemento seleccionado es un cluster o no
  //   if (features[0] instanceof M.ClusteredFeature) {
  //     console.log('Es un cluster');
  //     mapajs.getPopup().hide()
  //   }
  // });
  capaPlacas.filterID = "Placas conmemorativas"
  capaPlacas.setStyle(styleCluster_Placas)
  capaPlacas.on(M.evt.SELECT_FEATURES, function (features, evt) {
    // se puede comprobar si el elemento seleccionado es un cluster o no
    if (features[0] instanceof M.ClusteredFeature) {
      console.log('Es un cluster');
      mapajs.getPopup().hide()
    }
  });
  mapajs.addLayers(capaPlacas)


  const capaStolpersteine = new M.layer.GeoJSON({
    name: "Placas Stolpersteine",
    source: geojsonDataAsync.geoJson_Stolpersteine,
    extract: true,
    legend: "Placas Stolpersteine",
    filterID: "Placas Stolpersteine",
    attribution: {
      name: "Placas Stolpersteine:",
      description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    }
  }, {
    visibility:false,
    // style:estiloEstacion
  })
  // capaPlacas.setStyle(styleCluster_Monumentos)
  // capaPlacas.on(M.evt.SELECT_FEATURES, function (features, evt) {
  //   // se puede comprobar si el elemento seleccionado es un cluster o no
  //   if (features[0] instanceof M.ClusteredFeature) {
  //     console.log('Es un cluster');
  //     mapajs.getPopup().hide()
  //   }
  // });
  capaStolpersteine.filterID = "Placas Stolpersteine"
  capaStolpersteine.setStyle(styleCluster_Stonh)
  capaStolpersteine.on(M.evt.SELECT_FEATURES, function (features, evt) {
    // se puede comprobar si el elemento seleccionado es un cluster o no
    if (features[0] instanceof M.ClusteredFeature) {
      console.log('Es un cluster');
      mapajs.getPopup().hide()
    }
  });
  mapajs.addLayers(capaStolpersteine)

})





async function myFunction_GetData() {

  geojsonDataAsync = {}

  let myPromise_Monumentos = new Promise(function (resolve) {

    M.proxy(true)
    M.remote.get("https://datos.madrid.es/egob/catalogo/300356-0-monumentos-ciudad-madrid.json",).then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(res.text)
      });
  });
  value_Monumentos = await myPromise_Monumentos;
  confJSON_LD = { type: "Point", field: "location", long: "longitude", lat: "latitude" }
  geoJson_Monumentos = convertJsonLdToGeoJson(JSON.parse(value_Monumentos), confJSON_LD);
  geojsonDataAsync.geoJson_Monumentos = geoJson_Monumentos


  let myPromise_Placas = new Promise(function (resolve) {

    M.proxy(true)
    M.remote.get("https://datos.madrid.es/egob/catalogo/300329-1-placas-conmemorativas-madrid.csv",).then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(res.text)
      });
  });
  value_placas = await myPromise_Placas;
  geojsonPlacas = csvToGeoJson({csvString:value_placas, long : "longitud", lat : "latitud", advancedParse : true})
  geojsonDataAsync.geoJson_Placas = geojsonPlacas



  let myPromise_Stolpersteine = new Promise(function (resolve) {

    M.proxy(true)
    M.remote.get("https://datos.madrid.es/egob/catalogo/300453-2-placas-stolpersteine.csv",).then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(res.text)
      });
  });
  value_Stolpersteine = await myPromise_Stolpersteine;
  geojsonStolpersteine = csvToGeoJson({csvString:value_Stolpersteine, long : "longitud", lat : "latitud"})
  geojsonDataAsync.geoJson_Stolpersteine = geojsonStolpersteine

  // console.log('0 :',geojsonDataAsync)
  return geojsonDataAsync

}



// Extensiones
const ext_LayerSwitcher = new M.plugin.Layerswitcher({
  collapsed: true,
  position: 'TR',
  collapsible: true,
  isDraggable: true,
  modeSelectLayers: 'radio',
  tools: ['transparency', 'zoom', 'information', 'delete'],
  isMoveLayers: true,
  https: true,
  http: true,
  showCatalog: false,
  displayLabel: false,
});
mapajs.addPlugin(ext_LayerSwitcher);


M.proxy(false)
const ext_Modal = new M.plugin.Modal({
  position: 'BL',
  helpLink: {
    es: '../../html/modal_PuntosHistoricosMadrid.html'
  }
});
M.proxy(false)
mapajs.addPlugin(ext_Modal);

mapajs.addPlugin(miPlugin)



