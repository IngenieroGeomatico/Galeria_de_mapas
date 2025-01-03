

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
        "crs": {
          "type": "name",
          "properties": {
            "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
          }
        },
        "features": [
          {
            "type": "Feature",
            "id": "geojson_8101551973134157",
            "geometry": {
              "type": "Point",
              "coordinates": [
                -3.7124,
                40.41470000000001
              ]
            },
            "properties": {
              "Dirección": "Calle Pretil de los consejos",
              "Descripción": "Calle donde se encuentra la cueva de Zaratrusta"
            }
          },
          {
            "type": "Feature",
            "id": "geojson_2093348857222318",
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
                  40.41590728887212
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
                  -3.704028670876216,
                  40.41661956166689
                ],
                [
                  -3.7038567988702957,
                  40.416640653807605
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
                  -3.7029394833872034,
                  40.41723286018359
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
            "id": "geojson_7774117787491664",
            "geometry": {
              "type": "Point",
              "coordinates": [
                -3.7029,
                40.41729999999998
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
                  -3.702966305477353,
                  40.4172859542937
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
                  -3.70664972820282,
                  40.41689566695956
                ],
                [
                  -3.7067650631904594,
                  40.416830319977436
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
            "id": "geojson_8021865701253958",
            "geometry": {
              "type": "Point",
              "coordinates": [
                -3.7068,
                40.416799999999995
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
                  -3.7068559254974187,
                  40.41678385854769
                ],
                [
                  -3.706906887468702,
                  40.4167328061385
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
                  -3.7038836209604447,
                  40.41663656960762
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
            "id": "geojson_5424750712071147",
            "geometry": {
              "type": "Point",
              "coordinates": [
                -3.7038,
                40.41660000000002
              ]
            },
            "properties": {
              "Dirección": "Puerta del Sol",
              "Descripción": "Ministerio de gobernación"
            }
          },
          {
            "type": "Feature",
            "id": "mapea_feature_24962348808471813",
            "geometry": {
              "type": "LineString",
              "coordinates": [
                [
                  -3.703835341198177,
                  40.41663656960762
                ],
                [
                  -3.702724906666011,
                  40.416697832581576
                ],
                [
                  -3.7022426775932313,
                  40.41708347733726
                ],
                [
                  -3.700408046627045,
                  40.41747555680254
                ]
              ]
            },
            "properties": {
              "Dirección": "Ministerio de gobernación -> Café Colón",
              "Descripción": "Camino desde gobernación hasta el Café Colón"
            }
          },
          {
            "type": "Feature",
            "id": "geojson_8439027846743228",
            "geometry": {
              "type": "Point",
              "coordinates": [
                -3.7004000000000006,
                40.41739999999996
              ]
            },
            "properties": {
              "Dirección": "Calle San Jerónimo, 4",
              "Descripción": "Café Colón"
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
          -3.7068,
          40.4168
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
        "coordinates": [-3.7038,40.4166]
      },
      "properties": {
        "Dirección": "Puerta del Sol, 7",
        "Descripción": "Casa real de correos"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -3.7022999999999997,
          40.4169
        ]
      },
      "properties": {
        "Dirección": "Calle de Alcalá, 14",
        "Descripción": "Café Universal"
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
layerVectorialGJSON.setZIndex(100)





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
