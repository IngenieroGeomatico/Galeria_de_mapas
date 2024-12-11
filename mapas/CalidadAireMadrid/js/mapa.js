

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
  zoom: 11,
  center: { x: -409357.1616789646, y: 4929016.309020255 },
  controls: ['attributions'],
  layers: []
});

mapajs.addAttribution({
  name: "Autor:",
  description: " <a style='color: #0000FF' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
})

mapajs.addQuickLayers('Base_IGNBaseTodo_TMS_2')


// M.proxy(true)
// M.remote.get("https://datos.madrid.es/egob/catalogo/212629-1-estaciones-control-aire.csv",
//   {}
// ).then(function (res) {
//   // Muestra un diálogo informativo con el resultado de la petición get
//   console.log(res.text);
//   M.proxy(false)
// });


geojsonJoin = myFunction_JoinData()
geojsonJoin.then(() => {

  // Estilos
  let estiloEstacion = new M.style.Generic({
      point: {
        icon: {
          src: '../../img/iconos/house_wifi.svg',
          scale: 0.06,
        },

      }
    });
  
  let estiloMuncipio = new M.style.Generic({
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
  
  let estiloEstacionesMedidas_30 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 0.10, 0.25, 0.5, 1, 2, 3, 4, 5, Infinity

            return  v == "4-5" ? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "3-4" ? 'rgb(255,0,0)' : // No saludable
                    v == "2-3" ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "1-2" ? 'rgb(255,255,0)' : // Moderado
                    v == "0.5-1" ? '#00E400' :  // Bien
                    v == "0.25-0.5" ? '#7AF37A' :  // Muy Bien
                    v == "0.10-0.25" ? '#B7FBB7' :  // Muy Muy Bien
                    v == "0-0.10" ? '#E2FEE2':   // Muy Muy Muy Bien
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
            // 0, 0.10, 0.25, 0.5, 1, 2, 3, 4, 5, Infinity

            return  v >= 5 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 4 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 3 ? 'rgb(255,0,0)' : // No saludable
                    v >= 2 ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v >= 1 ? 'rgb(255,255,0)' : // Moderado
                    v >= 0.5 ? '#00E400' :  // Bien
                    v >= 0.25 ? '#7AF37A' :  // Muy Bien
                    v >= 0.1 ? '#B7FBB7' :  // Muy Muy Bien
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
          text: 'BEN',
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
  
  let estiloEstacionesMedidas_35 = new M.style.Generic({
      polygon: {
        fill: {
          opacity: 0.6,
          color: function(feature) {
            v = feature.getAttributes()[Object.keys(feature.getAttributes())[0]]
            // valores = v.split("-");
            // 0, 6, 12.5, 25, 50, 100, 200, 500, 1000, Infinity

            return  v == "500-1000" ? 'rgb(143,63,151)' : // Muy poco saludable
                    v == "200-500" ? 'rgb(255,0,0)' : // No saludable
                    v == "100-200" ? 'rgb(255,126,0)' : // No saludable para Grupos Sensibles
                    v == "50-100" ? 'rgb(255,255,0)' : // Moderado
                    v == "25-50" ? '#00E400' :  // Bien
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
            // 0, 6, 12.5, 25, 50, 100, 200, 500, 1000, Infinity

            return  v >= 1000 ? 'rgb(126,0,35)' : // Peligroso
                    v >= 500 ? 'rgb(143,63,151)' : // Muy poco saludable
                    v >= 200 ? 'rgb(255,0,0)' : // No saludable
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
          text: 'EBE',
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
  


  // creamos la capa
  const capaEstaciones = new M.layer.GeoJSON({
        name: "Estaciones calidad del aire",
        source: geojsonJoin.stations,
        extract: true,
        legend: "Estaciones calidad del aire",
        attribution: {
          name: "Estaciones:",
          description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
        }
      },{
        style:estiloEstacion
  })

  const capaMunicipio = new M.layer.GeoJSON({
        name: "Municipio Madrid",
        source: geojsonJoin.municipio,
        extract: true,
        legend: "Municipio Madrid",
        attribution: {
          name: "Municipio:",
          description: " <a style='color: #0000FF' href='https://api-features.ign.es//collections/administrativeunit/items?limit=1&nameunit=Madrid&nationallevelname=Municipio' target='_blank'>IGN</a> "
        }
      },{
        style: estiloMuncipio
  })

  
  const capaEstacionesMedidas_1 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_1",
    source: geojsonJoin.Medida_1,
    extract: true,
    legend: "Dióxido de Azufre",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{
    visibility:false,
    style: estiloEstacionesMedidas_1
  })

  const capaEstacionesMedidas_6 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_6",
    source: geojsonJoin.Medida_6,
    extract: true,
    legend: "Monóxido de Carbono ",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style: estiloEstacionesMedidas_6})

  const capaEstacionesMedidas_7 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_7",
    source: geojsonJoin.Medida_7,
    extract: true,
    legend: "Monóxido de Nitrógeno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_7})

  const capaEstacionesMedidas_8 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_8",
    source: geojsonJoin.Medida_8,
    extract: true,
    legend: "Dióxido de Nitrógeno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_8})

  const capaEstacionesMedidas_9 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_9",
    source: geojsonJoin.Medida_9,
    extract: true,
    legend: "Partículas < 2.5 μm ",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_9})

  const capaEstacionesMedidas_10 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_10",
    source: geojsonJoin.Medida_10,
    extract: true,
    legend: "Partículas < 10 μm",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_10})

  const capaEstacionesMedidas_12 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_12",
    source: geojsonJoin.Medida_12,
    extract: true,
    legend: "Óxidos de Nitrógeno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_12})

  const capaEstacionesMedidas_14 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_14",
    source: geojsonJoin.Medida_14,
    extract: true,
    legend: "Ozono",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
    },{visibility:false, style:estiloEstacionesMedidas_14})

  const capaEstacionesMedidas_20 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_20",
    source: geojsonJoin.Medida_20,
    extract: true,
    legend: "Tolueno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_20})

  const capaEstacionesMedidas_30 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_30",
    source: geojsonJoin.Medida_30,
    extract: true,
    legend: "Benceno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_30})


  const capaEstacionesMedidas_35 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_35",
    source: geojsonJoin.Medida_35,
    extract: true,
    legend: "Etilbenceno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false, style:estiloEstacionesMedidas_35})


  const capaEstacionesMedidas_37 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_37",
    source: geojsonJoin.Medida_37,
    extract: true,
    legend: "Metaxileno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false})

  const capaEstacionesMedidas_38 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_38",
    source: geojsonJoin.Medida_38,
    extract: true,
    legend: "Paraxileno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false})

  const capaEstacionesMedidas_39 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_39",
    source: geojsonJoin.Medida_39,
    extract: true,
    legend: "Ortoxileno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false})


  const capaEstacionesMedidas_42 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_42",
    source: geojsonJoin.Medida_42,
    extract: true,
    legend: "Hidrocarburos totales (hexano)",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false})

  const capaEstacionesMedidas_43 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_43",
    source: geojsonJoin.Medida_43,
    extract: true,
    legend: "Metano",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false})

  const capaEstacionesMedidas_44 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_44",
    source: geojsonJoin.Medida_44,
    extract: true,
    legend: "Hidrocarburos no metánicos (hexano)",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false})

  const capaEstacionesMedidas_431 = new M.layer.GeoJSON({
    name: "capaEstacionesMedidas_431",
    source: geojsonJoin.Medida_431,
    extract: true,
    legend: "Metaparaxileno",
    visibility:false,
    // attribution: {
    //   name: "Estaciones:",
    //   description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
    // }
  },{visibility:false})




  arrayLayers = [
                capaEstaciones,
                capaMunicipio,      
                capaEstacionesMedidas_1, capaEstacionesMedidas_6, 
                capaEstacionesMedidas_7, capaEstacionesMedidas_8, capaEstacionesMedidas_9,
                capaEstacionesMedidas_10, capaEstacionesMedidas_12, capaEstacionesMedidas_14,
                capaEstacionesMedidas_20, capaEstacionesMedidas_30, capaEstacionesMedidas_35,

                // capaEstacionesMedidas_37, capaEstacionesMedidas_38, capaEstacionesMedidas_39,
                // capaEstacionesMedidas_42, capaEstacionesMedidas_43, capaEstacionesMedidas_44,
                // capaEstacionesMedidas_431
  ]


  // y la añadimos al mapa
  mapajs.addLayers(arrayLayers.reverse());
})


// Funciones necesarias para el visualizador
async function myFunction_JoinData() {

  let myPromise = new Promise(function (resolve) {

    M.proxy(true)
    M.remote.get("https://datos.madrid.es/egob/catalogo/212629-1-estaciones-control-aire.csv",).then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(res.text)
      });
  });
  value1_estaciones = await myPromise;
  geojsonEstaciones = csvToGeoJson(value1_estaciones, long = "LONGITUD", lat = "LATITUD")


  let myPromise2 = new Promise(function (resolve) {

    M.proxy(true)
    M.remote.get("https://datos.madrid.es/egob/catalogo/212531-10515086-calidad-aire-tiempo-real.csv",).then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(res.text)
      });
  });
  value2_datos = await myPromise2;

  jsonEstaciones = csvToJson(value2_datos)

  let myPromise3 = new Promise(function (resolve) {
    M.proxy(true)
    M.remote.get("https://api-features.ign.es//collections/administrativeunit/items?f=json&limit=1&&nameunit=Madrid&&nationallevelname=Municipio",).then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(JSON.parse(res.text))
      });
  });
  value3_gjson_Madrid = await myPromise3;


  geojsonJoin = {}
  geojsonJoin.stations = geojsonEstaciones

  jsonEstacionesMedidas = joinJsonAndGeoJson(jsonEstaciones, geojsonEstaciones, 'ESTACION', 'CODIGO_CORTO')
  geojsonJoinMedidas = jsonToGeoJson(jsonEstacionesMedidas, geometry = "geometry")

  geojsonJoin.municipio = value3_gjson_Madrid

  geojsonJoin.Medidas = geojsonJoinMedidas
  geojsonJoin.Medida_1 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "1")
  geojsonJoin.Medida_6 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "6")
  geojsonJoin.Medida_7 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "7")
  geojsonJoin.Medida_8 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "8")
  geojsonJoin.Medida_9 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "9")
  geojsonJoin.Medida_10 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "10")
  geojsonJoin.Medida_12 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "12")
  geojsonJoin.Medida_14 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "14")
  geojsonJoin.Medida_20 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "20")
  geojsonJoin.Medida_30 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "30")
  geojsonJoin.Medida_35 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "35")
  geojsonJoin.Medida_37 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "37")
  geojsonJoin.Medida_38 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "38")
  geojsonJoin.Medida_39 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "39")
  geojsonJoin.Medida_42 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "42")
  geojsonJoin.Medida_43 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "43")
  geojsonJoin.Medida_44 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "44")
  geojsonJoin.Medida_431 = filterGeoJSON(geojsonJoinMedidas, "MAGNITUD", "431")
  // console.log(geojsonEstacionesMedidas)
  M.proxy(false)
  return geojsonJoin
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
