

const SVGCarga = document.getElementById("cargaSVG")
// window.onload = (event) => {
//   SVGCarga.hidden = true
// };


function mapa() {

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

IDEE.config.backgroundlayers = [
  {
    "id": "mapa",
    "title": "Callejero",
    "imgPreview": "img/IGNBase.png",
    "layers": [
      "QUICK*Base_IGNBaseTodo_TMS_2"
    ]
  },
  {
    "id": "imagen",
    "title": "Imagen",
    "imgPreview": "img/imagen.png",
    "layers": [
      "QUICK*BASE_PNOA_MA_TMS"
    ]
  }
]

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


geojsonJoin = myFunction_JoinData_CM()
geojsonJoin.then(()=>{

  // Estilos:
  let estiloEstacion = new M.style.Generic({
    point: {
      icon: {
        src: '../../img/iconos/house_wifi.png',
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

  let estiloEstacionesMedidas_1 = new M.style.Generic({
    polygon: {
      fill: {
        opacity: 0.6,
        color: function(feature) {
          v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
          // valores = v.split("-");
          // 0, 5, 11, 23, 35, 75, 185, 304, 604, Infinity

          return  v == "304-604"? 'rgb(143,63,151)' : // Muy poco saludable
                  v == "185-304"? 'rgb(255,0,0)' : // No saludable
                  v == "75-185"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v == "35-75"? 'rgb(255,255,0)' : // Moderado
                  v == "23-35"? '#00E400' :  // Bien
                  v == "11-23" ? '#7AF37A' :  // Muy Bien
                  v == "5-11" ? '#B7FBB7' :  // Muy Muy Bien
                  v == "0-5" ? '#E2FEE2':   // Muy Muy Muy Bien
                                'rgb(126,0,35)'; // Peligroso
                  
        },
      },
      stroke: {
        color: '#616161',
        width: 4
      }
    },
    point:{
      radius: 8,
      // Relleno
      fill: {
        // Color de relleno. Hexadecimal, nominal
        color: function(feature) {
          v = feature.getAttribute('ultimoValor')
          // 0, 5, 11, 23, 35, 75, 185, 304, 604, Infinity
          return  v >= 604? 'rgb(126,0,35)' : // Peligroso
                  v >= 304 ? 'rgb(143,63,151)' : // Muy poco saludable
                  v >= 185 ? 'rgb(255,0,0)' : // No saludable
                  v >= 75 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v >= 35 ? 'rgb(255,255,0)' : // Moderado
                  v >= 23? '#00E400' :  // Bien
                  v >= 11? '#7AF37A' :  // Muy Bien
                  v >= 5 ? '#B7FBB7' :  // Muy Muy Bien
                  v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                           'black';     // Inicial
                 
        },
        // Transparencia. 0(transparente)|1(opaco)
        opacity: 0.9,
      },
      // Borde exterior
      stroke: {
        // Color del borde. Hexadecimal, nominal
        color: 'rgb(0, 0, 0)',
        // Grosor en pixeles
        width: 2,
      },
      label: {
        // Texto a escribir
        text: 'SO2',
        // Fuente y características
        font: 'bold 19px Comic Sans MS',
        // Color de la fuente. Hexadecimal, nominal
        color: 'white',
        // Factor de escala de la fuente
        scale: 0.9,
        // Halo de la fuente
        stroke: {
          // Color de relleno del halo. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en píxeles del halo
          width: 2,
        },
        align: M.style.align.CENTER,
        baseline: M.style.baseline.BOTTOM,
      }
    }
  });

  let estiloEstacionesMedidas_6 = new M.style.Generic({
    polygon: {
      fill: {
        opacity: 0.6,
        color: function(feature) {
          v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
          // valores = v.split("-");
          // 0, 0.75, 1.46, 2.93, 4.4 , 9.4, 12.4, 15.4, 30.4, Infinity

          return  v == "15.4-30.4"? 'rgb(143,63,151)' : // Muy poco saludable
                  v == "12.4-15.4"? 'rgb(255,0,0)' : // No saludable
                  v == "9.4-12.4"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v == "4.4-9.4"? 'rgb(255,255,0)' : // Moderado
                  v == "2.93-4.4"? '#00E400' :  // Bien
                  v == "1.46-2.93" ? '#7AF37A' :  // Muy Bien
                  v == "0.75-1.46" ? '#B7FBB7' :  // Muy Muy Bien
                  v == "0-0.75" ? '#E2FEE2':   // Muy Muy Muy Bien
                                'rgb(126,0,35)'; // Peligroso
                  
        },
      },
      stroke: {
        color: '#616161',
        width: 4
      }
    },
    point:{
      radius: 8,
      // Relleno
      fill: {
        // Color de relleno. Hexadecimal, nominal
        color: function(feature) {
          v = feature.getAttribute('ultimoValor')
          // 0, 0.75, 1.46, 2.93, 4.4 , 9.4, 12.4, 15.4, 30.4, Infinity
          return  v >= 30.4? 'rgb(126,0,35)' : // Peligroso
                  v >= 15.4 ? 'rgb(143,63,151)' : // Muy poco saludable
                  v >= 12.4 ? 'rgb(255,0,0)' : // No saludable
                  v >= 9.4 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v >= 4.4 ? 'rgb(255,255,0)' : // Moderado
                  v >= 2.93? '#00E400' :  // Bien
                  v >= 1.46? '#7AF37A' :  // Muy Bien
                  v >= 0.75 ? '#B7FBB7' :  // Muy Muy Bien
                  v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                          'black';     // Inicial
                
        },
        // Transparencia. 0(transparente)|1(opaco)
        opacity: 0.9,
      },
      // Borde exterior
      stroke: {
        // Color del borde. Hexadecimal, nominal
        color: 'rgb(0, 0, 0)',
        // Grosor en pixeles
        width: 2,
      },
      label: {
        // Texto a escribir
        text: 'CO',
        // Fuente y características
        font: 'bold 19px Comic Sans MS',
        // Color de la fuente. Hexadecimal, nominal
        color: 'white',
        // Factor de escala de la fuente
        scale: 0.9,
        // Halo de la fuente
        stroke: {
          // Color de relleno del halo. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en píxeles del halo
          width: 2,
        },
        align: M.style.align.CENTER,
        baseline: M.style.baseline.BOTTOM,
      }
    }
  });

  let estiloEstacionesMedidas_7 = new M.style.Generic({
    polygon: {
      fill: {
        opacity: 0.6,
        color: function(feature) {
          v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
          // valores = v.split("-");
          // 0, 3, 6, 12.5, 25, 50, 75, 100, 200, Infinity

          return  v == "100-200"? 'rgb(143,63,151)' : // Muy poco saludable
                  v == "75-100"? 'rgb(255,0,0)' : // No saludable
                  v == "50-75"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v == "25-50"? 'rgb(255,255,0)' : // Moderado
                  v == "12.5-25"? '#00E400' :  // Bien
                  v == "6-12.5" ? '#7AF37A' :  // Muy Bien
                  v == "3-6" ? '#B7FBB7' :  // Muy Muy Bien
                  v == "0-3" ? '#E2FEE2':   // Muy Muy Muy Bien
                                'rgb(126,0,35)'; // Peligroso
                  
        },
      },
      stroke: {
        color: '#616161',
        width: 4
      }
    },
    point:{
      radius: 8,
      // Relleno
      fill: {
        // Color de relleno. Hexadecimal, nominal
        color: function(feature) {
          v = feature.getAttribute('ultimoValor')
          // 0, 3, 6, 12.5, 25, 50, 75, 100, 200, Infinity
          return  v >= 200 ? 'rgb(126,0,35)' : // Peligroso
                  v >= 100 ? 'rgb(143,63,151)' : // Muy poco saludable
                  v >= 75 ? 'rgb(255,0,0)' : // No saludable
                  v >= 50 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v >= 25 ? 'rgb(255,255,0)' : // Moderado
                  v >= 12.5 ? '#00E400' :  // Bien
                  v >= 6 ? '#7AF37A' :  // Muy Bien
                  v >= 3 ? '#B7FBB7' :  // Muy Muy Bien
                  v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                           'black';     // Inicial
                 
        },
        // Transparencia. 0(transparente)|1(opaco)
        opacity: 0.9,
      },
      // Borde exterior
      stroke: {
        // Color del borde. Hexadecimal, nominal
        color: 'rgb(0, 0, 0)',
        // Grosor en pixeles
        width: 2,
      },
      label: {
        // Texto a escribir
        text: 'NO',
        // Fuente y características
        font: 'bold 19px Comic Sans MS',
        // Color de la fuente. Hexadecimal, nominal
        color: 'white',
        // Factor de escala de la fuente
        scale: 0.9,
        // Halo de la fuente
        stroke: {
          // Color de relleno del halo. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en píxeles del halo
          width: 2,
        },
        align: M.style.align.CENTER,
        baseline: M.style.baseline.BOTTOM,
      }
    }
  });

  let estiloEstacionesMedidas_8 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 6, 12.5, 25, 50, 100, 360, 650, 1250, Infinity

            return  v == "650-1250"? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "360-650"? 'rgb(255,0,0)' : // No saludable
                    v == "100-360"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "50-100"? 'rgb(255,255,0)' : // Moderado
                    v == "25-50"? '#00E400' :  // Bien
                    v == "12.5-25" ? '#7AF37A' :  // Muy Bien
                    v == "6-12.5" ? '#B7FBB7' :  // Muy Muy Bien
                    v == "0-6" ? '#E2FEE2':   // Muy Muy Muy Bien
                                  'rgb(126,0,35)'; // Peligroso
                    
          },
        },
        stroke: {
          color: '#616161',
          width: 4
        }
      },
      point:{
        radius: 8,
        // Relleno
        fill: {
          // Color de relleno. Hexadecimal, nominal
          color: function(feature) {
            v = feature.getAttribute('ultimoValor')
            // 0, 6, 12.5, 25, 50, 100, 360, 650, 1250, Infinity
            return  v >= 1250 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 650 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 360 ? 'rgb(255,0,0)' : // No saludable
                    v >= 100 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v >= 50 ? 'rgb(255,255,0)' : // Moderado
                    v >= 25 ? '#00E400' :  // Bien
                    v >= 12.5 ? '#7AF37A' :  // Muy Bien
                    v >= 6 ? '#B7FBB7' :  // Muy Muy Bien
                    v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                            'black';     // Inicial
                  
          },
          // Transparencia. 0(transparente)|1(opaco)
          opacity: 0.9,
        },
        // Borde exterior
        stroke: {
          // Color del borde. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en pixeles
          width: 2,
        },
        label: {
          // Texto a escribir
          text: 'NO2',
          // Fuente y características
          font: 'bold 19px Comic Sans MS',
          // Color de la fuente. Hexadecimal, nominal
          color: 'white',
          // Factor de escala de la fuente
          scale: 0.9,
          // Halo de la fuente
          stroke: {
            // Color de relleno del halo. Hexadecimal, nominal
            color: 'rgb(0, 0, 0)',
            // Grosor en píxeles del halo
            width: 2,
          },
          align: M.style.align.CENTER,
          baseline: M.style.baseline.BOTTOM,
        }
      }
  });

  let estiloEstacionesMedidas_9 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 1, 2.25, 4.5, 9, 35, 55, 125, 225, Infinity


            return  v == "125-225"? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "55-125"? 'rgb(255,0,0)' : // No saludable
                    v == "35-55"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "9-35"? 'rgb(255,255,0)' : // Moderado
                    v == "4.5-9"? '#00E400' :  // Bien
                    v == "2.25-4.5" ? '#7AF37A' :  // Muy Bien
                    v == "1-2.25" ? '#B7FBB7' :  // Muy Muy Bien
                    v == "0-1" ? '#E2FEE2':   // Muy Muy Muy Bien
                                  'rgb(126,0,35)'; // Peligroso
                    
          },
        },
        stroke: {
          color: '#616161',
          width: 4
        }
      },
      point:{
        radius: 8,
        // Relleno
        fill: {
          // Color de relleno. Hexadecimal, nominal
          color: function(feature) {
            v = feature.getAttribute('ultimoValor')
            //  0, 1, 2.25, 4.5, 9, 35, 55, 125, 225, Infinity

            return  v >= 225 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 125 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 55 ? 'rgb(255,0,0)' : // No saludable
                    v >= 35 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v >= 9 ? 'rgb(255,255,0)' : // Moderado
                    v >= 4.5 ? '#00E400' :  // Bien
                    v >= 2.25 ? '#7AF37A' :  // Muy Bien
                    v >= 1 ? '#B7FBB7' :  // Muy Muy Bien
                    v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                            'black';     // Inicial
                  
          },
          // Transparencia. 0(transparente)|1(opaco)
          opacity: 0.9,
        },
        // Borde exterior
        stroke: {
          // Color del borde. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en pixeles
          width: 2,
        },
        label: {
          // Texto a escribir
          text: '< 2.5 μm',
          // Fuente y características
          font: 'bold 19px Comic Sans MS',
          // Color de la fuente. Hexadecimal, nominal
          color: 'white',
          // Factor de escala de la fuente
          scale: 0.9,
          // Halo de la fuente
          stroke: {
            // Color de relleno del halo. Hexadecimal, nominal
            color: 'rgb(0, 0, 0)',
            // Grosor en píxeles del halo
            width: 2,
          },
          align: M.style.align.CENTER,
          baseline: M.style.baseline.BOTTOM,
        }
      }
  });

  let estiloEstacionesMedidas_10 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 6, 12.5, 25, 55, 155, 255, 350, 425, Infinity

            return  v == "350-425"? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "255-350"? 'rgb(255,0,0)' : // No saludable
                    v == "155-255"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "55-155"? 'rgb(255,255,0)' : // Moderado
                    v == "25-55"? '#00E400' :  // Bien
                    v == "12.5-25" ? '#7AF37A' :  // Muy Bien
                    v == "6-12.5" ? '#B7FBB7' :  // Muy Muy Bien
                    v == "0-6" ? '#E2FEE2':   // Muy Muy Muy Bien
                                  'rgb(126,0,35)'; // Peligroso
                    
          }
        },
        stroke: {
          color: '#616161',
          width: 4
        }
      },
      point:{
        radius: 8,
        // Relleno
        fill: {
          // Color de relleno. Hexadecimal, nominal
          color: function(feature) {
            v = feature.getAttribute('ultimoValor')
            //  // 0, 6, 12.5, 25, 55, 155, 255, 350, 425, Infinity

            return  v >= 425 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 350 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 255 ? 'rgb(255,0,0)' : // No saludable
                    v >= 155 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v >= 55 ? 'rgb(255,255,0)' : // Moderado
                    v >= 25 ? '#00E400' :  // Bien
                    v >= 12.5 ? '#7AF37A' :  // Muy Bien
                    v >= 6 ? '#B7FBB7' :  // Muy Muy Bien
                    v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                            'black';     // Inicial
                  
          },
          // Transparencia. 0(transparente)|1(opaco)
          opacity: 0.9,
        },
        // Borde exterior
        stroke: {
          // Color del borde. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en pixeles
          width: 2,
        },
        label: {
          // Texto a escribir
          text: '< 10 μm',
          // Fuente y características
          font: 'bold 19px Comic Sans MS',
          // Color de la fuente. Hexadecimal, nominal
          color: 'white',
          // Factor de escala de la fuente
          scale: 0.9,
          // Halo de la fuente
          stroke: {
            // Color de relleno del halo. Hexadecimal, nominal
            color: 'rgb(0, 0, 0)',
            // Grosor en píxeles del halo
            width: 2,
          },
          align: M.style.align.CENTER,
          baseline: M.style.baseline.BOTTOM,
        }
      }
  });

  let estiloEstacionesMedidas_12 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 6, 12.5, 25, 50, 100, 150, 200, 300, Infinity

            return  v == "200-300"? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "150-200"? 'rgb(255,0,0)' : // No saludable
                    v == "100-150"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "50-100"? 'rgb(255,255,0)' : // Moderado
                    v == "25-50"? '#00E400' :  // Bien
                    v == "12.5-25" ? '#7AF37A' :  // Muy Bien
                    v == "6-12.5" ? '#B7FBB7' :  // Muy Muy Bien
                    v == "0-6" ? '#E2FEE2':   // Muy Muy Muy Bien
                                  'rgb(126,0,35)'; // Peligroso
                    
          }
        },
        stroke: {
          color: '#616161',
          width: 4
        }
      },
      point:{
        radius: 8,
        // Relleno
        fill: {
          // Color de relleno. Hexadecimal, nominal
          color: function(feature) {
            v = feature.getAttribute('ultimoValor')
            //  /0, 6, 12.5, 25, 50, 100, 150, 200, 300, Infinity

            return  v >= 300 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 200 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 150 ? 'rgb(255,0,0)' : // No saludable
                    v >= 100 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v >= 50 ? 'rgb(255,255,0)' : // Moderado
                    v >= 25 ? '#00E400' :  // Bien
                    v >= 12.5 ? '#7AF37A' :  // Muy Bien
                    v >= 6 ? '#B7FBB7' :  // Muy Muy Bien
                    v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                            'black';     // Inicial
                  
          },
          // Transparencia. 0(transparente)|1(opaco)
          opacity: 0.9,
        },
        // Borde exterior
        stroke: {
          // Color del borde. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en pixeles
          width: 2,
        },
        label: {
          // Texto a escribir
          text: 'NOx',
          // Fuente y características
          font: 'bold 19px Comic Sans MS',
          // Color de la fuente. Hexadecimal, nominal
          color: 'white',
          // Factor de escala de la fuente
          scale: 0.9,
          // Halo de la fuente
          stroke: {
            // Color de relleno del halo. Hexadecimal, nominal
            color: 'rgb(0, 0, 0)',
            // Grosor en píxeles del halo
            width: 2,
          },
          align: M.style.align.CENTER,
          baseline: M.style.baseline.BOTTOM,
        }
      }
  });

  let estiloEstacionesMedidas_14 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 6, 12.5, 25, 50, 70, 80, 100, 200, Infinity

            return  v == "100-200"? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "80-100"? 'rgb(255,0,0)' : // No saludable
                    v == "70-80"? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "50-70"? 'rgb(255,255,0)' : // Moderado
                    v == "25-50"? '#00E400' :  // Bien
                    v == "12.5-25" ? '#7AF37A' :  // Muy Bien
                    v == "6-12.5" ? '#B7FBB7' :  // Muy Muy Bien
                    v == "0-6" ? '#E2FEE2':   // Muy Muy Muy Bien
                                  'rgb(126,0,35)'; // Peligroso
                    
          }
        },
        stroke: {
          color: '#616161',
          width: 4
        }
      },
      point:{
        radius: 8,
        // Relleno
        fill: {
          // Color de relleno. Hexadecimal, nominal
          color: function(feature) {
            v = feature.getAttribute('ultimoValor')
            //  0, 6, 12.5, 25, 50, 70, 80, 100, 200, Infinity

            return  v >= 200 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 100 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 80 ? 'rgb(255,0,0)' : // No saludable
                    v >= 70 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v >= 50 ? 'rgb(255,255,0)' : // Moderado
                    v >= 25 ? '#00E400' :  // Bien
                    v >= 12.5 ? '#7AF37A' :  // Muy Bien
                    v >= 6 ? '#B7FBB7' :  // Muy Muy Bien
                    v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                            'black';     // Inicial
                  
          },
          // Transparencia. 0(transparente)|1(opaco)
          opacity: 0.9,
        },
        // Borde exterior
        stroke: {
          // Color del borde. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en pixeles
          width: 2,
        },
        label: {
          // Texto a escribir
          text: 'O3',
          // Fuente y características
          font: 'bold 19px Comic Sans MS',
          // Color de la fuente. Hexadecimal, nominal
          color: 'white',
          // Factor de escala de la fuente
          scale: 0.9,
          // Halo de la fuente
          stroke: {
            // Color de relleno del halo. Hexadecimal, nominal
            color: 'rgb(0, 0, 0)',
            // Grosor en píxeles del halo
            width: 2,
          },
          align: M.style.align.CENTER,
          baseline: M.style.baseline.BOTTOM,
        }
      }
  });

  let estiloEstacionesMedidas_20 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 10, 25, 100, 400, 1000, 2500, 10000, 20000, Infinity

            return  v == "10000-20000" ? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "2500-10000" ? 'rgb(255,0,0)' : // No saludable
                    v == "1000-2500" ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "400-1000" ? 'rgb(255,255,0)' : // Moderado
                    v == "100-400" ? '#00E400' :  // Bien
                    v == "25-100" ? '#7AF37A' :  // Muy Bien
                    v == "10-25" ? '#B7FBB7' :  // Muy Muy Bien
                    v == "0-10" ? '#E2FEE2':   // Muy Muy Muy Bien
                                  'rgb(126,0,35)'; // Peligroso
                    
          }
        },
        stroke: {
          color: '#616161',
          width: 4
        }
      },
      point:{
        radius: 8,
        // Relleno
        fill: {
          // Color de relleno. Hexadecimal, nominal
          color: function(feature) {
            v = feature.getAttribute('ultimoValor')
            // 0, 10, 25, 100, 400, 1000, 2500, 10000, 20000, Infinity

            return  v >= 20000 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 10000 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 2500 ? 'rgb(255,0,0)' : // No saludable
                    v >= 1000 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v >= 400 ? 'rgb(255,255,0)' : // Moderado
                    v >= 100 ? '#00E400' :  // Bien
                    v >= 25 ? '#7AF37A' :  // Muy Bien
                    v >= 10 ? '#B7FBB7' :  // Muy Muy Bien
                    v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                            'black';     // Inicial
                  
          },
          // Transparencia. 0(transparente)|1(opaco)
          opacity: 0.9,
        },
        // Borde exterior
        stroke: {
          // Color del borde. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en pixeles
          width: 2,
        },
        label: {
          // Texto a escribir
          text: 'TOL',
          // Fuente y características
          font: 'bold 19px Comic Sans MS',
          // Color de la fuente. Hexadecimal, nominal
          color: 'white',
          // Factor de escala de la fuente
          scale: 0.9,
          // Halo de la fuente
          stroke: {
            // Color de relleno del halo. Hexadecimal, nominal
            color: 'rgb(0, 0, 0)',
            // Grosor en píxeles del halo
            width: 2,
          },
          align: M.style.align.CENTER,
          baseline: M.style.baseline.BOTTOM,
        }
      }
  });

  let estiloEstacionesMedidas_42 = new M.style.Generic({
    polygon: {
      fill: {
        opacity: 0.6,
        color: function(feature) {
          v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
          // valores = v.split("-");
          // 0, 0.4, 0.75, 1.25, 2.5, 5, 10, 20, 50, Infinity

          return  v == "20-50" ? 'rgb(143,63,151)' : // Muy poco saludable
                  v == "10-20" ? 'rgb(255,0,0)' : // No saludable
                  v == "5-10" ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v == "2.5-5" ? 'rgb(255,255,0)' : // Moderado
                  v == "1.25-2.5" ? '#00E400' :  // Bien
                  v == "0.75-1.25" ? '#7AF37A' :  // Muy Bien
                  v == "0.4-0.75" ? '#B7FBB7' :  // Muy Muy Bien
                  v == "0-0.4" ? '#E2FEE2':   // Muy Muy Muy Bien
                                'rgb(126,0,35)'; // Peligroso
                  
        }
      },
      stroke: {
        color: '#616161',
        width: 4
      }
    },
    point:{
      radius: 8,
      // Relleno
      fill: {
        // Color de relleno. Hexadecimal, nominal
        color: function(feature) {
          v = feature.getAttribute('ultimoValor')
          // 0, 0.4, 0.75, 1.25, 2.5, 5, 10, 20, 50, Infinity

          return  v >= 50 ? 'rgb(126,0,35)' : // Peligroso
                  v >= 20 ? 'rgb(143,63,151)' : // Muy poco saludable
                  v >= 10 ? 'rgb(255,0,0)' : // No saludable
                  v >= 5 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v >= 2.5 ? 'rgb(255,255,0)' : // Moderado
                  v >= 1.25 ? '#00E400' :  // Bien
                  v >= 0.75 ? '#7AF37A' :  // Muy Bien
                  v >= 0.4 ? '#B7FBB7' :  // Muy Muy Bien
                  v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                          'black';     // Inicial
                
        },
        // Transparencia. 0(transparente)|1(opaco)
        opacity: 0.9,
      },
      // Borde exterior
      stroke: {
        // Color del borde. Hexadecimal, nominal
        color: 'rgb(0, 0, 0)',
        // Grosor en pixeles
        width: 2,
      },
      label: {
        // Texto a escribir
        text: 'COVs',
        // Fuente y características
        font: 'bold 19px Comic Sans MS',
        // Color de la fuente. Hexadecimal, nominal
        color: 'white',
        // Factor de escala de la fuente
        scale: 0.9,
        // Halo de la fuente
        stroke: {
          // Color de relleno del halo. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en píxeles del halo
          width: 2,
        },
        align: M.style.align.CENTER,
        baseline: M.style.baseline.BOTTOM,
      }
    }
  });

  let estiloEstacionesMedidas_44 = new M.style.Generic({
    polygon: {
      fill: {
        opacity: 0.6,
        color: function(feature) {
          v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
          // valores = v.split("-");
          // 0, 0.4, 0.75, 1.25, 2.5, 5, 10, 20, 50, Infinity

          return  v == "20-50" ? 'rgb(143,63,151)' : // Muy poco saludable
                  v == "10-20" ? 'rgb(255,0,0)' : // No saludable
                  v == "5-10" ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v == "2.5-5" ? 'rgb(255,255,0)' : // Moderado
                  v == "1.25-2.5" ? '#00E400' :  // Bien
                  v == "0.75-1.25" ? '#7AF37A' :  // Muy Bien
                  v == "0.4-0.75" ? '#B7FBB7' :  // Muy Muy Bien
                  v == "0-0.4" ? '#E2FEE2':   // Muy Muy Muy Bien
                                'rgb(126,0,35)'; // Peligroso
                  
        }
      },
      stroke: {
        color: '#616161',
        width: 4
      }
    },
    point:{
      radius: 8,
      // Relleno
      fill: {
        // Color de relleno. Hexadecimal, nominal
        color: function(feature) {
          v = feature.getAttribute('ultimoValor')
          // 0, 0.4, 0.75, 1.25, 2.5, 5, 10, 20, 50, Infinity

          return  v >= 50 ? 'rgb(126,0,35)' : // Peligroso
                  v >= 20 ? 'rgb(143,63,151)' : // Muy poco saludable
                  v >= 10 ? 'rgb(255,0,0)' : // No saludable
                  v >= 5 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v >= 2.5 ? 'rgb(255,255,0)' : // Moderado
                  v >= 1.25 ? '#00E400' :  // Bien
                  v >= 0.75 ? '#7AF37A' :  // Muy Bien
                  v >= 0.4 ? '#B7FBB7' :  // Muy Muy Bien
                  v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                          'black';     // Inicial
                
        },
        // Transparencia. 0(transparente)|1(opaco)
        opacity: 0.9,
      },
      // Borde exterior
      stroke: {
        // Color del borde. Hexadecimal, nominal
        color: 'rgb(0, 0, 0)',
        // Grosor en pixeles
        width: 2,
      },
      label: {
        // Texto a escribir
        text: 'HAPs',
        // Fuente y características
        font: 'bold 19px Comic Sans MS',
        // Color de la fuente. Hexadecimal, nominal
        color: 'white',
        // Factor de escala de la fuente
        scale: 0.9,
        // Halo de la fuente
        stroke: {
          // Color de relleno del halo. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en píxeles del halo
          width: 2,
        },
        align: M.style.align.CENTER,
        baseline: M.style.baseline.BOTTOM,
      }
    }
  });

  let estiloEstacionesMedidas_431 = new M.style.Generic({
    polygon: {
      fill: {
        opacity: 0.6,
        color: function(feature) {
          v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
          // valores = v.split("-");
          // 0, 12.5, 25, 50, 100, 200, 400, 800, 1600

          return  v == "800-1600" ? 'rgb(143,63,151)' : // Muy poco saludable
                  v == "400-800" ? 'rgb(255,0,0)' : // No saludable
                  v == "200-400" ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v == "100-200" ? 'rgb(255,255,0)' : // Moderado
                  v == "50-100" ? '#00E400' :  // Bien
                  v == "25-50" ? '#7AF37A' :  // Muy Bien
                  v == "12.5-25" ? '#B7FBB7' :  // Muy Muy Bien
                  v == "0-12.5" ? '#E2FEE2':   // Muy Muy Muy Bien
                                'rgb(126,0,35)'; // Peligroso
                  
        }
      },
      stroke: {
        color: '#616161',
        width: 4
      }
    },
    point:{
      radius: 8,
      // Relleno
      fill: {
        // Color de relleno. Hexadecimal, nominal
        color: function(feature) {
          v = feature.getAttribute('ultimoValor')
          // 0, 12.5, 25, 50, 100, 200, 400, 800, 1600, Infinity

          return  v >= 1600 ? 'rgb(126,0,35)' : // Peligroso
                  v >= 800 ? 'rgb(143,63,151)' : // Muy poco saludable
                  v >= 400 ? 'rgb(255,0,0)' : // No saludable
                  v >= 200 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                  v >= 100 ? 'rgb(255,255,0)' : // Moderado
                  v >= 50 ? '#00E400' :  // Bien
                  v >= 25 ? '#7AF37A' :  // Muy Bien
                  v >= 12.5 ? '#B7FBB7' :  // Muy Muy Bien
                  v >= 0 ? '#E2FEE2':   // Muy Muy Muy Bien
                          'black';     // Inicial
                
        },
        // Transparencia. 0(transparente)|1(opaco)
        opacity: 0.9,
      },
      // Borde exterior
      stroke: {
        // Color del borde. Hexadecimal, nominal
        color: 'rgb(0, 0, 0)',
        // Grosor en pixeles
        width: 2,
      },
      label: {
        // Texto a escribir
        text: 'm,p-Xileno',
        // Fuente y características
        font: 'bold 19px Comic Sans MS',
        // Color de la fuente. Hexadecimal, nominal
        color: 'white',
        // Factor de escala de la fuente
        scale: 0.9,
        // Halo de la fuente
        stroke: {
          // Color de relleno del halo. Hexadecimal, nominal
          color: 'rgb(0, 0, 0)',
          // Grosor en píxeles del halo
          width: 2,
        },
        align: M.style.align.CENTER,
        baseline: M.style.baseline.BOTTOM,
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
        description: "<a style='color: #0000FF' href='https://www.comunidad.madrid/gobierno/datos-abiertos' target='_blank'>Comunidad de Madrid</a>"
      }
    },{
      style:estiloEstacion,
      clampToGround: true
  })

  const capaCM = new M.layer.GeoJSON({
    name: "Comunidad de Madrid",
    source: geojsonJoin_CM.ComunidadAutonoma,
    extract: true,
    legend: "Comunidad de Madrid",
    attribution: {
      name: "Comunidad de Madrid:",
      description: "<a style='color: #0000FF' href='https://api-features.ign.es/collections/administrativeunit/items?limit=1&nameunit=Comunidad%20de%20Madrid&nationallevelname=Comunidad autónoma' target='_blank'>IGN</a>"
    }
  },{
    style: estiloComunidadAutonoma,
    clampToGround: true
  })

  const capaEstacionesMedidas_1 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_1",
    source: geojsonJoin_CM.Medida_1,
    extract: true,
    legend: "Dióxido de Azufre",
    visibility:false,
  },{
    visibility:false,
    style: estiloEstacionesMedidas_1,
    clampToGround: true
  })
  capaEstacionesMedidas_1.filterLayer = true


  const capaEstacionesMedidas_6 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_6",
    source: geojsonJoin_CM.Medida_6,
    extract: true,
    legend: "Monóxido de Carbono ",
    visibility:false,
  },{visibility:false, style: estiloEstacionesMedidas_6, clampToGround: true})
  capaEstacionesMedidas_6.filterLayer = true


  const capaEstacionesMedidas_7 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_7",
    source: geojsonJoin_CM.Medida_7,
    extract: true,
    legend: "Monóxido de Nitrógeno",
    visibility:false,
  },{visibility:false, style:estiloEstacionesMedidas_7, clampToGround: true})
  capaEstacionesMedidas_7.filterLayer = true


  const capaEstacionesMedidas_8 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_8",
    source: geojsonJoin_CM.Medida_8,
    extract: true,
    legend: "Dióxido de Nitrógeno",
    visibility:false,
  },{visibility:false, style:estiloEstacionesMedidas_8, clampToGround: true})
  capaEstacionesMedidas_8.filterLayer = true


  const capaEstacionesMedidas_9 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_9",
    source: geojsonJoin_CM.Medida_9,
    extract: true,
    legend: "Partículas < 2.5 μm ",
    visibility:false,
  },{visibility:false, style:estiloEstacionesMedidas_9, clampToGround: true})
  capaEstacionesMedidas_9.filterLayer = true


  const capaEstacionesMedidas_10 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_10",
    source: geojsonJoin_CM.Medida_10,
    extract: true,
    legend: "Partículas < 10 μm",
    visibility:false,
  },{visibility:false, style:estiloEstacionesMedidas_10, clampToGround: true})
  capaEstacionesMedidas_10.filterLayer = true


  const capaEstacionesMedidas_12 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_12",
    source: geojsonJoin_CM.Medida_12,
    extract: true,
    legend: "Óxidos de Nitrógeno",
    visibility:false,
  },{visibility:false, style:estiloEstacionesMedidas_12, clampToGround: true})
  capaEstacionesMedidas_12.filterLayer = true

  const capaEstacionesMedidas_14 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_14",
    source: geojsonJoin_CM.Medida_14,
    extract: true,
    legend: "Ozono",
    visibility:false,
    },{visibility:false, style:estiloEstacionesMedidas_14, clampToGround: true})
    capaEstacionesMedidas_14.filterLayer = true


    const capaEstacionesMedidas_20 = new M.layer.GeoJSON({
      name: "capaEstacionesMedidas_20",
      source: geojsonJoin_CM.Medida_20,
      extract: true,
      legend: "Tolueno",
      visibility:false,
    },{visibility:false, style:estiloEstacionesMedidas_20, clampToGround: true})
    capaEstacionesMedidas_20.filterLayer = true


    const capaEstacionesMedidas_22 = new M.layer.GeoJSON({
      name: "capaEstacionesMedidas_22",
      source: geojsonJoin_CM.Medida_22,
      extract: true,
      legend: "Black Carbon",
      visibility:false,
    },{
      visibility:false, 
      // style:estiloEstacionesMedidas_22
    })
    capaEstacionesMedidas_22.filterLayer = true


    const capaEstacionesMedidas_30 = new M.layer.GeoJSON({
      name: "capaEstacionesMedidas_30",
      source: geojsonJoin_CM.Medida_22,
      extract: true,
      legend: "Benceno",
      visibility:false,
    },{
      visibility:false, 
      // style:estiloEstacionesMedidas_30
    })
    capaEstacionesMedidas_30.filterLayer = true


    const capaEstacionesMedidas_42 = new M.layer.GeoJSON({
      name: "capaEstacionesMedidas_42",
      source: geojsonJoin_CM.Medida_42,
      extract: true,
      legend: "Hidrocarburos totales",
      visibility:false,
    },{
      visibility:false, 
      style:estiloEstacionesMedidas_42,
      clampToGround: true
    })
    capaEstacionesMedidas_42.filterLayer = true

    const capaEstacionesMedidas_44 = new M.layer.GeoJSON({
      name: "capaEstacionesMedidas_44",
      source: geojsonJoin_CM.Medida_44,
      extract: true,
      legend: "Hidrocarburos no metánicos",
      visibility:false,
    },{
      visibility:false, 
      style:estiloEstacionesMedidas_44,
      clampToGround: true
    })
    capaEstacionesMedidas_44.filterLayer = true

    const capaEstacionesMedidas_431 = new M.layer.GeoJSON({
      name: "capaEstacionesMedidas_431",
      source: geojsonJoin_CM.Medida_431,
      extract: true,
      legend: "MetaParaXileno",
      visibility:false,
    },{
      visibility:false, 
      style:estiloEstacionesMedidas_431,
      clampToGround: true
    })
    capaEstacionesMedidas_431.filterLayer = true

  arrayLayers = [
    capaEstaciones,
    capaCM,      
    capaEstacionesMedidas_1, capaEstacionesMedidas_6, capaEstacionesMedidas_7, capaEstacionesMedidas_8, 
    capaEstacionesMedidas_9, capaEstacionesMedidas_10, capaEstacionesMedidas_12, capaEstacionesMedidas_14,
    capaEstacionesMedidas_20, 
    
    // capaEstacionesMedidas_22, capaEstacionesMedidas_30, 
    
    capaEstacionesMedidas_42, capaEstacionesMedidas_44,capaEstacionesMedidas_431
  ]

  // y la añadimos al mapa
  mapajs.addLayers(arrayLayers.reverse());

  // Modelo 3D (GLB) que sustituye al icono 2D de las estaciones en 3D. El
  // billboard de Cesium daba problemas: el icono no aparecía hasta forzar un
  // redibujado de la capa y la conversión de la API dejaba además un point
  // negro (pixelSize 5 con relleno y contorno negros) que se veía como un
  // punto suelto en mitad del icono. El modelo evita ambas cosas: es geometría
  // real, no una textura que cargar, y no arrastra el point. Es el mismo patrón
  // que usa la ISS en mapas/satelites/js/mapa.js (sustituir billboard y point
  // por entity.model). Solo afecta a la implementación Cesium: en 2D
  // OpenLayers la capa sigue pintando el icono con su estilo.
  // El GLB (mástil meteorológico de 3,1 m a escala real, colores de vértice sin
  // texturas) se escala x1.6 para que lea mejor como elemento del mapa, y
  // minimumPixelSize mantiene el mástil visible al alejar la cámara, donde 3 m
  // serían invisibles: con 60 px de ancho mínimo las estaciones se distinguen
  // incluso en la vista regional de toda la Comunidad de Madrid.
  const MODELO_ESTACION_3D = {
    uri: './img/estacion_3d.glb',
    scale: 1.6,
    minimumPixelSize: 60
  };

  // Condicional por implementación: si el mapa es Cesium (3D) se fuerza
  // clampToGround en las entidades de las capas (la impl Cesium no propaga la
  // opción clampToGround de la capa GeoJSON a los polígonos). En OpenLayers
  // (2D) no es necesario y la función no hace nada.
  mapajs.getLayers().forEach((capa) => {
    // La Comunidad de Madrid se extruye 2000 m (≥1) porque su relleno es
    // transparente: el clampToGround crearía un GroundPrimitive que ignora el
    // borde. Las demás capas (medidas con relleno opaco) mantienen el
    // clampToGround.
    const esEstaciones = capa.name === 'Estaciones calidad del aire';
    aplicaClampGroundSiCesium(capa, capa.name === 'Comunidad de Madrid' ? 2000 : 0,
      esEstaciones ? MODELO_ESTACION_3D : null);
  });

  // Arranque en 3D (Cesium): el center/zoom inicial de M.map() no se respeta
  // y la cámara va a la Antártida. Forzamos la vista con setBbox() usando la
  // extensión de la capa de Comunidad de Madrid (EPSG:4326, la misma que
  // BBox_Gjson del plugin de interpolación). Solo se aplica en 3D (Cesium);
  // en 2D (OpenLayers) se respeta el center/zoom inicial de M.map().
  const mapImpl = mapajs.getMapImpl();
  const bboxArranque = bboxFromGjson(geojsonJoin_CM.ComunidadAutonoma);
  if (mapImpl && mapImpl.scene && mapImpl.scene.camera &&
      typeof mapajs.setBbox === 'function' && bboxArranque && isFinite(bboxArranque[0])) {
    mapajs.setBbox(bboxArranque);
  }

  SVGCarga.hidden = true
})


// Calcula la extensión [minX, minY, maxX, maxY] de un GeoJSON en EPSG:4326
// recorriendo recursivamente las coordenadas de sus geometrías (Point,
// Polygon, MultiPolygon, etc.). No depende de turf para poder usarse en el
// arranque del mapa.
function bboxFromGjson(gjson) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  gjson.features.forEach((feature) => {
    const walk = (coords) => {
      if (typeof coords[0] === 'number') {
        minX = Math.min(minX, coords[0]);
        maxX = Math.max(maxX, coords[0]);
        minY = Math.min(minY, coords[1]);
        maxY = Math.max(maxY, coords[1]);
      } else {
        coords.forEach(walk);
      }
    };
    walk(feature.geometry.coordinates);
  });
  return [minX, minY, maxX, maxY];
}

// Aplica clampToGround a las entidades de una capa cuando el mapa se ejecuta
// en Cesium (3D). La implementación Cesium de la API no propaga la opción
// clampToGround de la capa GeoJSON a los polígonos (la propiedad queda
// undefined), por lo que la geometría se dibuja a altitud 0 y queda enterrada
// bajo el terreno. Se fuerza a nivel de entidad solo si la implementación
// activa es Cesium; en OpenLayers (2D) no es necesario.
// Si se pasa alturaExtrusionMetros (>0), los polígonos NO se clampan: se
// extruyen esa altura con heightReference RELATIVE_TO_GROUND, el mismo patrón
// del visualizador de añoNuevo. Hace falta porque el GroundPrimitive del
// clampToGround ignora el outline y, con un relleno casi transparente (caso
// de la Comunidad de Madrid), el polígono desaparece en 3D: la extrusión
// genera geometría 3D real en la que el borde sí se dibuja.
// Si se pasa modelo3D (objeto {uri, scale, minimumPixelSize}), las entidades
// puntuales sustituyen su point y su billboard por entity.model, de forma que
// en 3D se dibuja geometría real en lugar de una textura 2D.
function aplicaClampGroundSiCesium(capa, alturaExtrusionMetros, modelo3D) {
  const nombreCapa = (capa && capa.name) || null;

  // Busca la dataSource Cesium real de la capa. Los dataSources con
  // entidades están en mapImpl.dataSources (registrados por nombre al
  // añadir la capa); capa.getImpl().getLayer() devuelve un contenedor
  // vacío, así que no sirve.
  const buscarDS = (mapImpl, capa) => {
    const nombre = (capa && capa.name) || nombreCapa;
    if (mapImpl.dataSources && mapImpl.dataSources._dataSources) {
      const encontrado = mapImpl.dataSources._dataSources.find(
        (d) => d.name === nombre
      );
      if (encontrado) return encontrado;
    }
    try {
      const dsCapa = capa.getImpl().getLayer();
      if (dsCapa && dsCapa.entities) return dsCapa;
    } catch (e) { /* no hacer nada */ }
    return null;
  };

  const aplicar = (ds) => {
    const constanteTrue = new Cesium.ConstantProperty(true);
    const constanteFalse = new Cesium.ConstantProperty(false);
    const alturaClamp = new Cesium.ConstantProperty(
      (Cesium.HeightReference && Cesium.HeightReference.CLAMP_TO_GROUND !== undefined)
        ? Cesium.HeightReference.CLAMP_TO_GROUND
        : 1
    );
    // Altura de extrusión (m) para que el borde del polígono se vea en 3D.
    // El clampToGround de Cesium crea un GroundPrimitive que ignora el
    // outline: con un relleno transparente (Comunidad de Madrid) el cierre
    // desaparece. La extrusión fuerza geometría 3D real donde el outline sí
    // se dibuja (mismo patrón que el visualizador de añoNuevo).
    const alturaExtrusion = (typeof alturaExtrusionMetros === 'number' &&
      alturaExtrusionMetros > 0)
      ? new Cesium.ConstantProperty(alturaExtrusionMetros)
      : null;
    const alturaRelativa = new Cesium.ConstantProperty(
      (Cesium.HeightReference && Cesium.HeightReference.RELATIVE_TO_GROUND !== undefined)
        ? Cesium.HeightReference.RELATIVE_TO_GROUND
        : 2
    );
    const entidades = ds.entities.values;
    for (let i = 0; i < entidades.length; i++) {
      const ent = entidades[i];
      if (ent.polygon) {
        if (alturaExtrusion) {
          // Extrusión relativa al terreno: la geometría se dibuja sobre el
          // suelo (con altura 0 relativa y elevación de la extrusión), de
          // modo que el outline del polígono queda visible como una pared.
          ent.polygon.clampToGround = constanteFalse;
          ent.polygon.perPositionHeight = constanteFalse;
          ent.polygon.heightReference = alturaRelativa;
          ent.polygon.extrudedHeight = alturaExtrusion;
        } else {
          ent.polygon.clampToGround = constanteTrue;
          ent.polygon.perPositionHeight = constanteFalse;
        }
      }
      if (ent.polyline) {
        ent.polyline.clampToGround = constanteTrue;
      }
      if (ent.point) {
        ent.point.heightReference = alturaClamp;
      }
      if (ent.billboard) {
        ent.billboard.heightReference = alturaClamp;
      }
      // Sustitución del icono 2D por el modelo 3D: se quitan point y billboard
      // (el point que añade la conversión de la API es un punto negro que se
      // ve a través de las zonas transparentes del icono) y se crea el model.
      // La base del GLB está en Y=0, así que con CLAMP_TO_GROUND apoya en el
      // terreno. minimumPixelSize impide que desaparezca al alejar la cámara.
      if (modelo3D && ent.point && !ent.polygon && !ent.polyline) {
        ent.point = undefined;
        ent.billboard = undefined;
        ent.model = {
          uri: modelo3D.uri,
          scale: modelo3D.scale,
          minimumPixelSize: modelo3D.minimumPixelSize,
          heightReference: alturaClamp
        };
      }
    }
    if (ds.changedEvent && ds.changedEvent.raiseEvent) {
      ds.changedEvent.raiseEvent();
    }
  };

  // La dataSource Cesium y sus entidades se crean de forma asíncrona tras
  // añadir la capa (al cambiar de implementación el mapa se reconstruye y la
  // carga de entidades puede tardar más de 15 s, observado hasta ~45 s). Se
  // sondea para cubrir la carga completa con margen: si la dataSource no
  // existe a los 30 s (capas de base, terreno o dibujo, que no generan
  // dataSource vectorial) se abandona; si existe, se espera a que lleguen
  // las entidades hasta un máximo de 120 s.
  const t0 = Date.now();
  const iv = setInterval(() => {
    const mapImpl = (typeof mapajs !== 'undefined' && mapajs.getMapImpl)
      ? mapajs.getMapImpl()
      : null;
    const esCesium = !!mapImpl && !!mapImpl.scene && !!mapImpl.scene.camera &&
      typeof Cesium !== 'undefined';
    if (!esCesium) {
      // Sin Cesium: margen corto por si el impl está cambiando y luego se rinde.
      if (Date.now() - t0 > 5000) {
        clearInterval(iv);
      }
      return;
    }
    const ds = buscarDS(mapImpl, capa);
    if (Date.now() - t0 > 120000) {
      // Fin del margen de espera: se aplica el clamp con lo que haya
      // llegado y se deja de sondear.
      clearInterval(iv);
      if (ds && ds.entities && ds.entities.values.length > 0) aplicar(ds);
      return;
    }
    if (!ds) {
      // Capas sin dataSource vectorial (base, terreno, dibujo): 30 s bastan.
      if (Date.now() - t0 > 30000) {
        clearInterval(iv);
      }
      return;
    }
    if (ds.entities.values.length > 0) {
      clearInterval(iv);
      aplicar(ds);
    }
  }, 500);
}

// Funciones necesarias para el visualizador
async function myFunction_JoinData_CM() {
  geojsonJoin_CM = {}

  let myPromise_1_CM = new Promise(function (resolve) {
    //M.proxy(true)
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

  if(value_1__gjson_ComunidadMadrid.features.length == 0){
    M.dialog.info("Necesita tener activada la extensión del navegador CORS para poder cargar los datos")
  }



  let myPromise_2_Estaciones= new Promise(function (resolve) {
    //M.proxy(true)
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


  let myPromise_3_Medidas= new Promise(function (resolve) {
    //M.proxy(true)
    M.remote.get("https://datos.comunidad.madrid/catalogo/dataset/3dacd589-ecca-485c-81b9-a61606b7199f/resource/93bed3f0-3ba5-4b00-90bf-1c81951bab24/download/calidad_aire_datos_dia.json").then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(JSON.parse(res.text))
      });
  });

  value_3__json_Medidas = await myPromise_3_Medidas;
  for (f in value_3__json_Medidas["data"]) {
      if(value_3__json_Medidas["data"][f]["punto_muestreo"] ){
        value_3__json_Medidas["data"][f]["punto_muestreo_ID"] = parseInt( value_3__json_Medidas["data"][f]["punto_muestreo"].split("_")[0] )
      }
  }
  jsonEstacionesMedidas = joinJsonAndGeoJson(value_3__json_Medidas["data"], geojsonEstaciones, 'punto_muestreo_ID', 'estacion_codigo')
  geojsonJoinMedidas = jsonToGeoJson(jsonEstacionesMedidas, geometry = "geometry")

  geojsonJoin_CM.Medida_1 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "1")
  geojsonJoin_CM.Medida_6 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "6")
  geojsonJoin_CM.Medida_7 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "7")
  geojsonJoin_CM.Medida_8 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "8")
  geojsonJoin_CM.Medida_9 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "9")
  geojsonJoin_CM.Medida_10 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "10")
  geojsonJoin_CM.Medida_12 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "12")
  geojsonJoin_CM.Medida_14 = filterGeoJSON(geojsonJoinMedidas, "magnitud", "14")
  geojsonJoin_CM.Medida_20= filterGeoJSON(geojsonJoinMedidas, "magnitud", "20")
  geojsonJoin_CM.Medida_22= filterGeoJSON(geojsonJoinMedidas, "magnitud", "22")
  geojsonJoin_CM.Medida_30= filterGeoJSON(geojsonJoinMedidas, "magnitud", "30")
  geojsonJoin_CM.Medida_42= filterGeoJSON(geojsonJoinMedidas, "magnitud", "42")
  geojsonJoin_CM.Medida_44= filterGeoJSON(geojsonJoinMedidas, "magnitud", "44")
  geojsonJoin_CM.Medida_431= filterGeoJSON(geojsonJoinMedidas, "magnitud", "431")


  return geojsonJoin_CM
}


// Extensiones
M.proxy(false)
const ext_Modal = new M.plugin.Modal({
  position: 'BL',
  helpLink: {
    es: '../../html/modal_CalidadAireComunidadMadridTiempoReal.html'
  }
});

M.proxy(false)
mapajs.addPlugin(ext_Modal);
M.proxy(false)

mapajs.addPlugin(new miPlugin_calidadAire({
  BBox_Gjson: "geojsonJoin_CM.ComunidadAutonoma",
  gridValue: 0.3,
  alpha: 100,
  sigma2: 0.02,
}))

mapajs.addPlugin(new miPlugin_leyenda())

mapajs.addPlugin(new miPlugin_cambioImpl({
  buttonTitle: 'cambiar impl :)',
  mapsFunction: mapa,
  sameMap: true,
  shareView: true,
  shareLayers: true
}));
mapajs.addPlugin(new miPlugin_baseLayer({ rows: 1 }));
mapajs.addPlugin(new miPlugin_layerSwitcher());

return geojsonJoin.then(() => mapajs)

}

mapa()
