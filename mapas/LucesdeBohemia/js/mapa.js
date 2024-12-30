

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

M.proxy(false)

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




const layer_1910 = new M.layer.WMS({
  url: 'https://www.ign.es/wms/planos',
  name: 'nunezMadrid',
  legend: 'Nuñez Granés 1910',
  tiled: true,
  visibility: true,
  attribution: '<p><b>Nuñez Granés 1910</b>: <a style="color: #0000FF" href="https://www.ign.es" target="_blank">IGN</a></p>',
}, {})

const layer_1929 = new M.layer.WMS({
  url: 'https://www.ign.es/wms/planos',
  name: 'ayuntamientoMadrid',
  legend: 'Parcelario 1929',
  tiled: true,
  visibility: false,
  attribution: '<p><b>Parcelario 1929</b>: <a style="color: #0000FF" href="https://www.ign.es" target="_blank">IGN</a></p>',
}, {})

// La añadimos al mapa
mapajs.addLayers([layer_1929, layer_1910]);






estilo1_1 = new M.style.Generic({
  point: {
    // Definición atributos para puntos
    radius: 7,

    fill: {
      color: 'orange',
      opacity: 0.9,//Transparencia del punto
    },
    //Borde exterior
    stroke: {
      color: 'red',
      width: 3,
    },
  },
  polygon: {
    // Definición atributos para polígonos
    // Polígono rosa semitransparente con borde rojo de grosor dos
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 0.9
    }
  },
  line: {
    // Definición atributos para líneas
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 4
    }
  }
});


estilo2_2 = new M.style.Generic({
  point: {
    // Definición atributos para puntos
    radius: 7,

    fill: {
      color: 'blue',
      opacity: 0.9,//Transparencia del punto
    },
    //Borde exterior
    stroke: {
      color: 'rgb(0,0,100)',
      width: 3,
    },
  },
  polygon: {
    // Definición atributos para polígonos
    // Polígono rosa semitransparente con borde rojo de grosor dos
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 0.9
    }
  },
  line: {
    // Definición atributos para líneas
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 4
    }
  }
});


gjsonVectorialGJSON_Libro = { 
  "type": "FeatureCollection", 
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.7124,
          40.4147
        ]
      },
      "properties": {
        "Dirección": "Calle Pretil de los consejos",
        "Descripción": "Calle donde se encuentra la cueva de Zaratrusta"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -3.712288591136168,
            40.414747353466254
          ],
          [
            -3.712315413226317,
            40.41494340029118
          ],
          [
            -3.712057921160887,
            40.41522113231537
          ],
          [
            -3.710056993235777,
            40.41562955968021
          ],
          [
            -3.7087051598922707,
            40.41590728887215
          ],
          [
            -3.707326504458617,
            40.416176848462186
          ],
          [
            -3.7049071519271832,
            40.416511754327246
          ],
          [
            -3.7039147345916725,
            40.41663836464687
          ],
          [
            -3.70373770879669,
            40.41690383712421
          ],
          [
            -3.703169080485533,
            40.4170549517589
          ],
          [
            -3.7023161380187957,
            40.418468061374966
          ]
        ]
      },
      "properties": {
        "Dirección": "Calle Pretil de los consejos -> Calle Montera",
        "Descripción": "Camino desde la cueva de Zaratustra hasta la taberna de Picalagartos"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.7022,
          40.4186
        ]
      },
      "properties": {
        "Dirección": "Calle Montera",
        "Descripción": "Calle donde se encuentra la taberna de Picalagartos"
      }
    },
    {
      "type": "Feature",
      "id": "mapea_feature_672989354390284",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -3.7023912398712144,
            40.41851707042457
          ],
          [
            -3.7031422583953844,
            40.41727549683284
          ],
          [
            -3.703657242526244,
            40.41722648687892
          ],
          [
            -3.704376074542235,
            40.41686707945914
          ],
          [
            -3.704665753115844,
            40.41684257433792
          ],
          [
            -3.7065218417541486,
            40.41722648687892
          ],
          [
            -3.706682774295043,
            40.4168834162017
          ]
        ]
      },
      "properties": {
        "Dirección": "Calle Montera -> Pasadizo de San Ginés",
        "Descripción": "Camino desde la taberna de Picalagartos hasta la Buñolería Modernista"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.7068,
          40.4168
        ]
      },
      "properties": {
        "Dirección": "Pasadizo de San Ginés",
        "Descripción": "La Buñolería Modernista"
      }
    },
    {
      "type": "Feature",
      "id": "mapea_feature_8152059935467802",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -3.706948312987518,
            40.416720048597625
          ],
          [
            -3.70688393997116,
            40.416327964729646
          ],
          [
            -3.7040582327739724,
            40.416662869842554
          ],
          [
            -3.703921440114213,
            40.41664244884677
          ]
        ]
      },
      "properties": {
        "Dirección": "San Ginés -> Puerta del Sol",
        "Descripción": "Camino desde La Buñolería Modernista hasta el Ministerio de gobernación"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-3.7038,40.4166]
      },
      "properties": {
        "Dirección": "Puerta del Sol",
        "Descripción": "Ministerio de gobernación"
      }
    }
  ] 
};

const layerVectorialGJSON_Libro = new M.layer.GeoJSON(
  {
    name: "layerVectorialGJSON_L",
    legend: "Recorrido de Bohemia",
    source: gjsonVectorialGJSON_Libro,
    extract: true,
  }, {
    displayInLayerSwitcher: true,
    visibility: true,
}
);
layerVectorialGJSON_Libro.setStyle(estilo1_1)
mapajs.addLayers(layerVectorialGJSON_Libro);

gjsonVectorialGJSON_Madrid = { 
  "type": "FeatureCollection", 
  "features": [
    {
      "type": "Feature",
      "properties": {
        "Dirección": "Calle Conde Duque, 7",
        "Descripción": "Casa de Alejandro Sawa"
      },
      "geometry": {
        "coordinates": [
          -3.711318,
          40.426273
        ],
        "type": "Point"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.7043,
          40.4195
        ]
      },
      "properties": {
        "Dirección": "Calle Mayor, 79",
        "Descripción": "Palacio de los Consejos."
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.7043,
          40.4195
        ]
      },
      "properties": {
        "Dirección": "Calle Mesoneros Romanos",
        "Descripción": "Calle donde se encontraba una de las librerías de Pueyo"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.712399,
          40.415125, 
        ]
      },
      "properties": {
        "Dirección": "Calle Mayor",
        "Descripción": "Monumento a Victoria Eugenia y Alfonso XIII"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.70682,
          40.41683, 
        ]
      },
      "properties": {
        "Dirección": "Pasadizo de San Ginés, 5",
        "Descripción": "Chocolatería San Ginés"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-3.7036,40.4166]
      },
      "properties": {
        "Dirección": "Puerta del Sol, 7",
        "Descripción": "Casa real de correos"
      }
    }
  ] 
};

const layerVectorialGJSON_Madrid = new M.layer.GeoJSON(
  {
    name: "layerVectorialGJSON_M",
    legend: "Puntos de interés Madrid",
    source: gjsonVectorialGJSON_Madrid,
    extract: true,
  }, {
    displayInLayerSwitcher: true,
    visibility: true,
}
);
layerVectorialGJSON_Madrid.setStyle(estilo2_2)

mapajs.addLayers(layerVectorialGJSON_Madrid);

estilo1 = new M.style.Generic({
  point: {
    // Definición atributos para puntos
    radius: 11,

    fill: {
      color: 'orange',
      opacity: 0.4,//Transparencia del punto
    },
    //Borde exterior
    stroke: {
      color: 'cyan',
      width: 3,
    },
  },
  polygon: {
    // Definición atributos para polígonos
    // Polígono rosa semitransparente con borde rojo de grosor dos
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 0.9
    }
  },
  line: {
    // Definición atributos para líneas
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 4
    }
  }
});


estilo2 = new M.style.Generic({
  point: {
    // Definición atributos para puntos
    radius: 11,

    fill: {
      color: 'blue',
      opacity: 0.4,//Transparencia del punto
    },
    //Borde exterior
    stroke: {
      color: 'orange',
      width: 3,
    },
  },
  polygon: {
    // Definición atributos para polígonos
    // Polígono rosa semitransparente con borde rojo de grosor dos
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 0.9
    }
  },
  line: {
    // Definición atributos para líneas
    fill: {
      color: 'red',
      opacity: 0.7,
    },
    stroke: {
      color: '#FF0000',
      width: 4
    }
  }
});

const layerVectorialGJSON = new M.layer.GeoJSON(
  {
    name: "layerVectorialGJSON",
    source: {},
    extract: false
  }, {
  displayInLayerSwitcher: false
}
);
mapajs.addLayers(layerVectorialGJSON);





const ext_LayerSwitcher = new M.plugin.Layerswitcher({
  collapsed: true,
  position: 'TL',
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


const mp_StoryMap = new M.plugin.StoryMap({
  collapsed: false,
  collapsible: true,
  position: 'TR',
  content: {
    es: StoryMapJSON,
  },
  indexInContent: {
    title: 'Luces de bohemia',
    subtitle: 'Ramón María del Valle-Inclán',
    js: "console.log('BLAAAAAAAAAAA');",
  },
  delay: 2000,
});

mapajs.addPlugin(mp_StoryMap);



const mpp = new M.plugin.VectorsManagement({
  position: 'TR',
  collapsible: true,
  collapsed: true,
  selection: true,
  addlayer: true,
  creation: true,
  edition: true,
  style: true,
  analysis: true,
  download: true,
  help: true,
});

mapajs.addPlugin(mpp);


// https://www.lucesdebohemia.es/
// https://enzapatillas.es/luces-de-bohemia/
// http://carmengarciahilo.blogspot.com/p/rutaluces-de-bohemia.html
