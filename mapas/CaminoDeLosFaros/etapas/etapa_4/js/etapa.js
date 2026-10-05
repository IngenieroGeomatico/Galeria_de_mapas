
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

/*
 * Pega al terreno las geometrias de una capa vectorial cuando la implementacion
 * es Cesium.
 *
 * En OpenLayers no hace falta nada, pero en Cesium las entidades nacen a altura 0
 * sobre el elipsoide y el MDT del IGN las tapa, de modo que ruta, puntos e
 * indicaciones desaparecen al pasar a 3D. Se fija CLAMP_TO_GROUND en los puntos y
 * clampToGround en las lineas, y se anula el recorte por profundidad para que los
 * marcadores no se corten contra el terreno.
 *
 * OJO con el momento: al cambiar de implementacion el GeoJSON se vuelve a pedir y
 * las entidades de Cesium tardan decenas de segundos en crearse (se midio en torno
 * a 40-50 s). Por eso no basta con aplicar el clamp en el acto: hay que engancharse
 * al IDEE.evt.LOAD de la capa y ademas reintentar durante un rato por si el LOAD se
 * hubiera perdido.
 *
 * Patron equivalente al de mapas/LucesdeBohemia/js/mapa.js.
 */
function pegaAlTerrenoSiCesium(capa) {
  if (typeof window.Cesium === 'undefined') return; // 2D: no hace nada

  const localizaDataSource = () => {
    try {
      const ds = mapjs.getMapImpl().dataSources;
      const lista = (ds && ds._dataSources) || [];
      for (const d of lista) {
        if (d && d.name === capa.name) return d;
      }
    } catch (e) { /* todavia no esta la escena */ }
    return null;
  };

  const aplicar = () => {
    const ds = localizaDataSource();
    const entidades = (ds && ds.entities) ? ds.entities.values : null;
    if (!entidades || !entidades.length) return false;

    let n = 0;
    entidades.forEach((e) => {
      if (e.polyline) {
        e.polyline.clampToGround = new window.Cesium.ConstantProperty(true);
        n++;
      }
      if (e.point) {
        e.point.heightReference = new window.Cesium.ConstantProperty(
          window.Cesium.HeightReference.CLAMP_TO_GROUND
        );
        e.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        n++;
      }
      if (e.polygon) {
        e.polygon.heightReference = new window.Cesium.ConstantProperty(
          window.Cesium.HeightReference.CLAMP_TO_GROUND
        );
        n++;
      }
    });
    return n > 0;
  };

  // Al crearse las entidades...
  try {
    capa.on(IDEE.evt.LOAD, aplicar);
  } catch (e) { /* si el evento no existe, siguen los reintentos */ }

  // ...y por si acaso, reintentos hasta que haya geometria (tarda ~40-50 s).
  let intentos = 0;
  const temporizador = setInterval(() => {
    intentos++;
    if (aplicar() || intentos > 90) clearInterval(temporizador);
  }, 2000);
}

function mapa() {

updateConfigBaseLayer()

// La escala, las coordenadas y la rotacion NO se piden como `controls` del mapa:
// Cesium no puede crear los controles de OpenLayers ('scale' lanza "La
// implementacion usada no puede crear controles Scale" y aborta la creacion del
// mapa), y ademas esos controles solo existen en 2D. Se añaden como plugins de
// ext/, que saben esconderse en 3D y sobreviven al cambio de implementacion.
// El selector de base de capas lo aporta miPlugin_baseLayer.

// Configuración del mapa
mapjs = IDEE.map({
    container: 'mapjs', //id del contenedor del mapa
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

// En 3D las geometrias tienen que ir pegadas al MDT o el terreno las tapa.
pegaAlTerrenoSiCesium(ruta);
pegaAlTerrenoSiCesium(PuntosInteres);
pegaAlTerrenoSiCesium(indicaciones);


ruta.on(IDEE.evt.LOAD, (features) => {
  rutaExt = ruta.getMaxExtent()
  mapjs.setBbox(rutaExt);
  mapjs.setZoom(mapjs.getZoom() - 0.5);
});




// Configuración de los plugins
  mapjs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true
  }));
  mapjs.addPlugin(new IDEE.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapjs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());

  // Controles 2D como plugins, en el sitio que ocupaba cada uno en el mapa: el
  // dial de rotacion y el boton de ubicacion se cuelgan en las columnas de las
  // areas de esquina de la API, igual que los botones de las demas herramientas,
  // y la lectura de escala (1:n y nivel de zoom) va en la banda de areaControls,
  // porque es un div ancho que en la columna estorba. En la banda, `order` fija
  // la posicion de izquierda a derecha y `openPosition` elige si la banda se
  // abre arriba o abajo.
  mapjs.addPlugin(new IDEE.plugin.miPlugin_mapInfo({ order: 0, openPosition: 'bottom' }));
  mapjs.addPlugin(new IDEE.plugin.miPlugin_controlLocation());
  mapjs.addPlugin(new IDEE.plugin.miPlugin_controlRotate({ order: -1 }));

  return mapjs

}

mapa()
