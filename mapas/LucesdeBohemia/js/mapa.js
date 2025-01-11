

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
            40.417475556802515
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
        "Dirección": "Calle de Alcalá, 14",
        "Descripción": "Café Colón"
      }
    },
    {
      "type": "Feature",
      "id": "geojson_83275856506504",
      "geometry": {
        "type": "MultiLineString",
        "coordinates": [
          [
            [
              -3.6936000000000004,
              40.41950000000003
            ],
            [
              -3.6936000000000004,
              40.41950000000003
            ],
            [
              -3.6936999999999998,
              40.419399999999996
            ]
          ],
          [
            [
              -3.6935,
              40.419700000000006
            ],
            [
              -3.6935,
              40.419700000000006
            ],
            [
              -3.6936000000000004,
              40.4196
            ],
            [
              -3.6936000000000004,
              40.41950000000003
            ]
          ],
          [
            [
              -3.6925,
              40.4196
            ],
            [
              -3.6925,
              40.419700000000006
            ],
            [
              -3.6925,
              40.419700000000006
            ],
            [
              -3.6924,
              40.419700000000006
            ],
            [
              -3.6924,
              40.419899999999984
            ],
            [
              -3.6923,
              40.420000000000016
            ],
            [
              -3.6922,
              40.4204
            ],
            [
              -3.6921,
              40.420500000000004
            ],
            [
              -3.6921,
              40.420500000000004
            ]
          ],
          [
            [
              -3.6921,
              40.420500000000004
            ],
            [
              -3.6918,
              40.42119999999997
            ]
          ],
          [
            [
              -3.6934000000000005,
              40.419700000000006
            ],
            [
              -3.6935,
              40.419700000000006
            ]
          ],
          [
            [
              -3.6927,
              40.419700000000006
            ],
            [
              -3.6926,
              40.42009999999999
            ]
          ],
          [
            [
              -3.6926,
              40.42009999999999
            ],
            [
              -3.6927,
              40.419899999999984
            ],
            [
              -3.6929,
              40.41980000000001
            ],
            [
              -3.6929,
              40.419700000000006
            ]
          ],
          [
            [
              -3.6924,
              40.421899999999994
            ],
            [
              -3.6924,
              40.421899999999994
            ],
            [
              -3.6925,
              40.42179999999999
            ],
            [
              -3.6925,
              40.42160000000001
            ],
            [
              -3.6927,
              40.4213
            ],
            [
              -3.6928,
              40.421099999999996
            ],
            [
              -3.6928,
              40.42090000000002
            ],
            [
              -3.6930000000000005,
              40.42070000000001
            ],
            [
              -3.6930000000000005,
              40.420500000000004
            ],
            [
              -3.6931,
              40.4203
            ],
            [
              -3.6932000000000005,
              40.42020000000002
            ],
            [
              -3.6934000000000005,
              40.41980000000001
            ],
            [
              -3.6934000000000005,
              40.41980000000001
            ],
            [
              -3.6934000000000005,
              40.41980000000001
            ],
            [
              -3.6934000000000005,
              40.419700000000006
            ]
          ],
          [
            [
              -3.6909,
              40.425099999999986
            ],
            [
              -3.691,
              40.42500000000001
            ],
            [
              -3.691,
              40.42490000000001
            ],
            [
              -3.6911,
              40.424800000000005
            ],
            [
              -3.6912,
              40.4246
            ],
            [
              -3.6913,
              40.42429999999999
            ],
            [
              -3.6916,
              40.423700000000025
            ],
            [
              -3.6916,
              40.42359999999999
            ],
            [
              -3.6918,
              40.42329999999998
            ],
            [
              -3.6918,
              40.42329999999998
            ]
          ],
          [
            [
              -3.6906,
              40.42469999999997
            ],
            [
              -3.6906,
              40.4246
            ],
            [
              -3.6906,
              40.424499999999995
            ],
            [
              -3.6906,
              40.424499999999995
            ],
            [
              -3.6906,
              40.424499999999995
            ],
            [
              -3.6907,
              40.42429999999999
            ]
          ],
          [
            [
              -3.6907,
              40.42429999999999
            ],
            [
              -3.6905,
              40.4246
            ],
            [
              -3.6904,
              40.42469999999997
            ]
          ],
          [
            [
              -3.6906,
              40.42469999999997
            ],
            [
              -3.6904,
              40.42490000000001
            ],
            [
              -3.6903,
              40.42500000000001
            ],
            [
              -3.6902,
              40.42519999999999
            ],
            [
              -3.6903,
              40.42539999999997
            ],
            [
              -3.6903,
              40.42560000000003
            ]
          ],
          [
            [
              -3.6918,
              40.42329999999998
            ],
            [
              -3.6919,
              40.4229
            ],
            [
              -3.692,
              40.42279999999997
            ],
            [
              -3.692,
              40.42269999999999
            ],
            [
              -3.6921,
              40.42259999999999
            ],
            [
              -3.6921,
              40.422500000000014
            ],
            [
              -3.6921,
              40.422500000000014
            ]
          ],
          [
            [
              -3.6907,
              40.42429999999999
            ],
            [
              -3.6907,
              40.424199999999985
            ],
            [
              -3.6908,
              40.42410000000001
            ],
            [
              -3.6909,
              40.4239
            ],
            [
              -3.6911,
              40.423400000000015
            ],
            [
              -3.6912,
              40.423100000000005
            ]
          ],
          [
            [
              -3.6909,
              40.423100000000005
            ],
            [
              -3.6909,
              40.423100000000005
            ],
            [
              -3.6909,
              40.42320000000001
            ],
            [
              -3.6908,
              40.42359999999999
            ],
            [
              -3.6905,
              40.424199999999985
            ],
            [
              -3.6904,
              40.42440000000002
            ],
            [
              -3.6904,
              40.42440000000002
            ],
            [
              -3.6904,
              40.42440000000002
            ],
            [
              -3.6904,
              40.4246
            ]
          ],
          [
            [
              -3.6918,
              40.42119999999997
            ],
            [
              -3.6917,
              40.421400000000034
            ],
            [
              -3.6916,
              40.42160000000001
            ],
            [
              -3.6915,
              40.42179999999999
            ],
            [
              -3.6914,
              40.422
            ],
            [
              -3.6913,
              40.42230000000001
            ]
          ],
          [
            [
              -3.6915,
              40.42239999999998
            ],
            [
              -3.6916,
              40.422200000000004
            ],
            [
              -3.6918,
              40.421899999999994
            ],
            [
              -3.6918,
              40.421899999999994
            ]
          ],
          [
            [
              -3.6918,
              40.421899999999994
            ],
            [
              -3.6919,
              40.42160000000001
            ],
            [
              -3.692,
              40.421400000000034
            ],
            [
              -3.6923,
              40.42070000000001
            ],
            [
              -3.6924,
              40.42060000000001
            ],
            [
              -3.6924,
              40.420500000000004
            ],
            [
              -3.6926,
              40.42009999999999
            ],
            [
              -3.6926,
              40.42009999999999
            ]
          ],
          [
            [
              -3.6921,
              40.422500000000014
            ],
            [
              -3.6922,
              40.42230000000001
            ],
            [
              -3.6923,
              40.42210000000003
            ],
            [
              -3.6924,
              40.421899999999994
            ],
            [
              -3.6924,
              40.421899999999994
            ]
          ],
          [
            [
              -3.6913,
              40.42230000000001
            ],
            [
              -3.6913,
              40.42239999999998
            ],
            [
              -3.6912,
              40.42239999999998
            ],
            [
              -3.6911,
              40.42269999999999
            ],
            [
              -3.6911,
              40.42279999999997
            ],
            [
              -3.6909,
              40.423100000000005
            ]
          ],
          [
            [
              -3.6912,
              40.423100000000005
            ],
            [
              -3.6912,
              40.423100000000005
            ],
            [
              -3.6914,
              40.42279999999997
            ],
            [
              -3.6915,
              40.42259999999999
            ],
            [
              -3.6915,
              40.422500000000014
            ],
            [
              -3.6915,
              40.422500000000014
            ],
            [
              -3.6915,
              40.42239999999998
            ]
          ]
        ]
      },
      "properties": {
        "Dirección": "Paseo de Recoletos",
        "Descripción": "Paseo con jardines"
      }
    },
    {
      "type": "Feature",
      "id": "mapea_feature_6945232892013126",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [
            -3.700382865142823,
            40.41747675554873
          ],
          [
            -3.6988432771682747,
            40.417913758085774
          ],
          [
            -3.695302761268616,
            40.41894294910807
          ],
          [
            -3.6939080125808728,
            40.41920432844802
          ],
          [
            -3.69372025794983,
            40.4193554379157
          ]
        ]
      },
      "properties": {
        "Dirección": "Café Colón -> Paseo con Jardines",
        "Descripción": "Camino desde  el Café Colón al paseo con jardines"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-3.6452,40.4242]
      },
      "properties": {
        "Dirección": "Avenida Daroca 96",
        "Descripción": "Cementerio de La Almudena"
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
          -3.7004000000000006,
          40.41739999999996
        ]
      },
      "properties": {
        "Dirección": "Calle de Alcalá, 14",
        "Descripción": "Café Universal"
      }
    },
    {
      "type": "Feature",
      "id": "geojson_8439027846743228",
      "geometry": {
        "type": "Point",
        "coordinates": [
          

          -3.7022999999999997,
          40.4169
        ]
      },
      "properties": {
        "Dirección": "Calle San Jerónimo, 4",
        "Descripción": "Café de la Montaña"
      }
    },
    {
      "type": "Feature",
      "geometry": {
          "type": "Point",
          "coordinates": [
              -3.691462,
              40.423551
          ]
      },
      "properties": {
        "Dirección": "Paseo de Recoletos 33",
        "Descripción": "Estatua de Valle Inclán"
      }
    },
    {
      "type": "Feature",
      "id": "geojson_22615447557309853",
      "geometry": {
        "type": "Point",
        "coordinates": [-3.7022,40.4152]
      },
      "properties": {
          "Dirección": "Calle Álvarez Gato 1",
          "Descripción": "Placa del callejón del Gato"
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
      width: 3,
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
mp_StoryMap.control.capIndex = function(idContainer, idElement) {
  const container = document.querySelector(idContainer);
  const divElement = container.querySelectorAll(idElement);
  // eslint-disable-next-line guard-for-in, no-restricted-syntax
  for (const key in divElement) {
    if (divElement[key].style.display === 'block' && !Number.isNaN(key)) {
      const id = divElement[key].id;
      console.log(id)
      console.log(Number.parseInt(id.match(/\d+/)[0], 10))
      return Number.parseInt(id.match(/\d+/)[0], 10);
    }
  }
  return false;
}



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
