
function updateConfigBaseLayer() {
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
      "imgPreview": "../../../../mapas/MapaBase/img/IGNBase.png",
      "layers": [
        "QUICK*Base_IGNBaseTodo_TMS_2"
      ]
    },
    {
      "id": "imagen",
      "title": "Imagen",
      "imgPreview": "../../../../mapas/MapaBase/img/imagen.png",
      "layers": [
        "QUICK*BASE_PNOA_MA_TMS"
      ]
    }
  ]

  IDEE.proxy(false);

  return
}

function mapa() {

updateConfigBaseLayer()

// Configuración del mapa
mapjs = IDEE.map({
  container: 'mapjs', //id del contenedor del mapa
  controls: ['scale*true', 'rotate', 'location', 'backgroundlayers'],
  zoom: 8,
  center: { x: -987492.7064936283, y: 5359858.7732718475 },
});
// Configuración de las capas


var ruta = new IDEE.layer.GeoJSON({
  legend: "Ruta",
  name: "Ruta",
  url: "./datos/ruta.geojson",
  extract: true
});

var atajos = new IDEE.layer.GeoJSON({
  legend: "Atajos",
  name: "Atajos",
  url: "./datos/atajos.geojson",
  extract: true
});

var PuntosInteres = new IDEE.layer.GeoJSON({
  legend: "Puntos de interés",
  name: "Puntos de interés",
  url: "./datos/PuntosDeInteres.geojson",
  extract: true
});

var indicaciones = new IDEE.layer.GeoJSON({
  legend: "Indicaciones",
  name: "Indicaciones",
  url: "./datos/Indicaciones.geojson",
  extract: true
});



let estilo_ruta = new IDEE.style.Generic({
  line: {
    'fill': {
      color: function (feature) {
        let p_d = feature.getAttributes().peligrosidad_dificultad; // Asigna un objeto vacío como valor inicial
        if (p_d.includes('p3') || p_d.includes('d3')) {
          return 'red'
        } else if (p_d.includes('p2') || p_d.includes('d2')) {
          return 'orange'
        } else if (p_d.includes('p1') || p_d.includes('d1')) {
          return 'yellow'
        } else {
          return 'blue'
        }
      },
      width: 3,
      opacity: 0.9,
    },
    // borde exterior de la linea
    'stroke': {
      color: 'darkblue',
      width: 8,
    },
  }
});

let estilo_atajos = new IDEE.style.Generic({
  line: {
    'fill': {
      color: function (feature) {
        let p_d = feature.getAttributes().peligrosidad_dificultad; // Asigna un objeto vacío como valor inicial
        if (p_d.includes('p3') || p_d.includes('d3')) {
          return 'red'
        } else if (p_d.includes('p2') || p_d.includes('d2')) {
          return 'orange'
        } else if (p_d.includes('p1') || p_d.includes('d1')) {
          return 'yellow'
        } else {
          return '#1aff00'
        }
      },
      width: 3,
      opacity: 0.9,
    },
    // borde exterior de la linea
    'stroke': {
      color: 'green',
      width: 8,
    },
  }
});


let estilo_PDI = new IDEE.style.Generic({
  point: {
    radius: 6,
    fill: {
      color: 'green',
      opacity: 0.8
    },
    stroke: {
      color: '#FF0000'
    }
  }
});

let estilo_indicacion = new IDEE.style.Generic({
  point: {
    radius: 5,
    fill: {
      color: 'blue',
      opacity: 0.9
    },
    stroke: {
      color: '#FF0000'
    },
    icon: {
      // Forma del fontsymbol.
      // BAN(cículo)|BLAZON(diálogo cuadrado)|BUBBLE(diálogo redondo)|CIRCLE(círculo)|LOZENGE(diamante)|MARKER(diálogo redondeado)
      // NONE(ninguno)|SHIELD(escudo)|SIGN(triángulo)|SQUARE(cuadrado)|TRIANGLE(triángulo invertido)
      form: IDEE.style.form.LOZENGE,
      class: 'g-cartografia-alerta',
      fontsize: 0.5,
      radius: 11,
      color: '#00ff80' || 'blue', // Hexadecimal, nominal
      offset: [0, 0],
      fill: '#00a151',
    }
  }
});



ruta.setStyle(estilo_ruta);
atajos.setStyle(estilo_atajos);
PuntosInteres.setStyle(estilo_PDI);
indicaciones.setStyle(estilo_indicacion);



mapjs.addLayers([ruta]);
mapjs.addLayers([atajos]);
mapjs.addLayers([PuntosInteres]);
mapjs.addLayers([indicaciones]);


ruta.on(IDEE.evt.LOAD, (features) => {
  rutaExt = ruta.getMaxExtent()
  mapjs.setBbox(rutaExt);
  mapjs.setZoom(mapjs.getZoom() - 0.5);
});




// Configuración de los plugins
  mapjs.addPlugin(new miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true
  }));
  mapjs.addPlugin(new miPlugin_baseLayer({ rows: 1 }));
  mapjs.addPlugin(new miPlugin_layerSwitcher());

  return mapjs

}

mapa()
