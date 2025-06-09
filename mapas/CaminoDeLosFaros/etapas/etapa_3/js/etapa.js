
// Configuración del mapa
const mapjs = IDEE.map({
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
      color: 'orange',
      width: 3,
      opacity: 0.5,
    },
    // borde exterior de la linea
    'stroke': {
      color: 'red',
      width: 5,
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
      color: '#006CFF' || 'blue', // Hexadecimal, nominal
      offset: [0, 0],
      fill: 'blue',
    }
  }
});



ruta.setStyle(estilo_ruta);
PuntosInteres.setStyle(estilo_PDI);
indicaciones.setStyle(estilo_indicacion);



mapjs.addLayers([ruta]);
mapjs.addLayers([PuntosInteres]);
mapjs.addLayers([indicaciones]);


ruta.on(IDEE.evt.LOAD, (features) => {
  rutaExt = ruta.getMaxExtent()
  mapjs.setBbox(rutaExt);
  mapjs.setZoom(mapjs.getZoom() - 0.5);
});




// Configuración de los plugins
const mp8 = new IDEE.plugin.Layerswitcher({
    collapsed: true,
    collapsible: true,
});
mapjs.addPlugin(mp8);