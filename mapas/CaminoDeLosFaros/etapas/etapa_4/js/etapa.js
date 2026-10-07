
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


  MapaRaster_TMS = new IDEE.layer.TMS({
    url: 'https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{-y}.jpeg',
    legend: 'MapaRaster',
    // No visible de salida: solo hay una base activa a la vez y la de por
    // defecto es la de al lado (la tms_2 de mas abajo). El conmutador de bases
    // la enciende cuando se elige, y para eso visible a false es lo correcto.
    visible: false,
    isBase: true,
    // Zoom maximo medido del servicio: la tesela 17 contesta 200 y la 18 da
    // 403, el mismo limite que tiene la capa de al lado.
    tileGridMaxZoom: 17,
    name: 'MapaRaster',
    attribution: '<p><b>Mapa base</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>',
  }, {
    crossOrigin: 'anonymous',
    displayInLayerSwitcher: false,
  })

  IDEE.addQuickLayers({
    Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2,
    Base_MapaRaster_TMS: MapaRaster_TMS
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
    },
    {
      "id": "raster",
      "title": "Mapa Ráster",
      // Miniatura de la zona, puesta a mano: no es una tesela del servicio, sino un
      // recorte del Mapa Raster con la peninsula y el norte de Africa.
      "imgPreview": "../../../../mapas/MapaBase/img/Raster.png",
      "layers": [
        "QUICK*Base_MapaRaster_TMS"
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


/*
 * Pega al terreno los puntos en los modos planos de Cesium (el plano del EPSG:3857
 * y el 2D), donde el CLAMP_TO_GROUND no hace nada.
 *
 * En el globo (modo 3) el clampeo que pone pegaAlTerrenoSiCesium() vale, pero
 * Cesium lo ignora en cuanto la escena deja de ser 3D: el punto se queda en la
 * altura que trae, que aqui es 0 sobre el elipsoide, y se queda debajo del
 * terreno. Medido: al pasar el selector del mapInfo a 3857 los marcadores se
 * sueltan de la ruta y se ven a cientos de pixeles del suelo; doles la altura
 * que da el terreno en ese punto vuelven a quedar pegados, y al volver al globo
 * se les devuelve su posicion y el clampeo.
 *
 * El cambio de modo lo hace el mapInfo poniendo escena.mode = 1 a pelo, sin
 * morphTo2D y por tanto sin ningun evento al que engancharse, asi que aqui se
 * vigila el modo una vez por segundo. Poner la altura no se repite: cada punto
 * se toca una sola vez mientras siga en modo plano, y si el MDT todavia no esta
 * cargado se vuelve a intentarlo en la siguiente vuelta.
 */
const MODOS_PLANOS_CESIUM = [1, 2]; // Columbus y 2D; el 3 es el globo
const vigilantePlano = { capas: [], intervalo: null };

function pegaAlTerrenoEnPlanoSiCesium(capa) {
  if (typeof window.Cesium === 'undefined') return; // 2D: no hace nada
  if (vigilantePlano.capas.indexOf(capa) < 0) vigilantePlano.capas.push(capa);
  if (vigilantePlano.intervalo === null) {
    vigilantePlano.intervalo = setInterval(revisaAlturasEnPlanoSiCesium, 1000);
  }
}

/**
 * Una vuelta del vigilante: si la escena ya no es 3D, les da a los puntos la
 * altura del terreno; si vuelve a ser 3D, les devuelve la posicion de partida y
 * el clampeo.
 */
function revisaAlturasEnPlanoSiCesium() {
  let escena = null;
  try {
    escena = mapjs.getMapImpl().scene;
  } catch (e) {
    escena = null;
  }
  if (!escena) return; // aun no hay escena, o ya no es Cesium
  const plano = MODOS_PLANOS_CESIUM.indexOf(escena.mode) >= 0;
  vigilantePlano.capas.forEach((capa) => {
    aplicaAlturaSegunModo(capa, escena, plano);
  });
}

/**
 * Aplica o retira la altura explicita de una capa, entidad a entidad.
 * @param {Object} capa Capa IDEE de la que se saca la fuente de datos de Cesium.
 * @param {Object} escena Escena de Cesium.
 * @param {boolean} plano true si la escena no es 3D.
 */
function aplicaAlturaSegunModo(capa, escena, plano) {
  const C = window.Cesium;
  let fuente = null;
  try {
    const lista = (mapjs.getMapImpl().dataSources._dataSources) || [];
    for (const d of lista) {
      if (d && d.name === capa.name) {
        fuente = d;
        break;
      }
    }
  } catch (e) {
    return;
  }
  if (!fuente || !fuente.entities) return;
  const ahora = C.JulianDate.now();
  fuente.entities.values.forEach((e) => {
    const g = e.point || e.billboard;
    if (!g) return; // las lineas ya llevan su propio clampeo
    if (plano) {
      if (e.alturaPlana !== undefined) return; // ya pegada, no se vuelve a tocar
      const bruto = g.position || e.position;
      const pos = bruto && bruto.getValue ? bruto.getValue(ahora) : bruto;
      if (!pos) return;
      let cg = null;
      try {
        cg = C.Cartographic.fromCartesian(pos);
      } catch (e2) {
        cg = null;
      }
      if (!cg) return;
      let altura = null;
      try {
        altura = escena.globe.getHeight(cg);
      } catch (e3) {
        altura = null;
      }
      if (altura === null || altura === undefined) return; // el MDT aun no esta
      e.posicionEnGlobo = [cg.longitude, cg.latitude, cg.height];
      e.alturaPlana = altura;
      g.heightReference = new C.ConstantProperty(C.HeightReference.NONE);
      g.position = new C.ConstantPositionProperty(
        C.Cartesian3.fromRadians(cg.longitude, cg.latitude, altura)
      );
    } else if (e.alturaPlana !== undefined) {
      const origen = e.posicionEnGlobo;
      e.alturaPlana = undefined;
      e.posicionEnGlobo = undefined;
      if (origen) {
        g.position = new C.ConstantPositionProperty(
          C.Cartesian3.fromRadians(origen[0], origen[1], origen[2])
        );
      }
      g.heightReference = new C.ConstantProperty(C.HeightReference.CLAMP_TO_GROUND);
    }
  });
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



// La linea va mas gruesa en 3D: a ras de suelo el grosor de 2D casi no se ve.
// El estilo ya creado no sirve, porque sus numeros no se leen del objeto de
// entrada, asi que se crea uno nuevo cada vez que hace falta.
function estiloRuta() {
  const en3D = !!(window.IDEE && window.IDEE.impl && window.IDEE.impl.cesium);
  return new IDEE.style.Generic({
  line: {
    'fill': {
      color: 'orange',
      'width': en3D ? 6 : 3,
      opacity: 0.5,
    },
    // borde exterior de la linea
    'stroke': {
      color: 'red',
      'width': en3D ? 15 : 5,
    },
  }
});
}

// Igual que las indicaciones, el radio de los puntos de interes depende de la
// implementacion: en 3D se ven mas pequenos. El estilo ya creado no vale, porque
// sus numeros no se leen del objeto de entrada, asi que se crea uno nuevo cada vez.
function estiloPDI() {
  const en3D = !!(window.IDEE && window.IDEE.impl && window.IDEE.impl.cesium);
  return new IDEE.style.Generic({
  point: {
    radius: en3D ? 11 : 6, 
    fill: {  
      color: 'green',
      opacity: 0.8
    },
    stroke: {
      color: '#FF0000'
    }
  }
});
}

// El radio de los puntos de indicaciones depende de la implementacion: en 3D se
// ven mas pequenos y hay que agrandarlos. NO vale con cambiar el radio del
// estilo ya creado, porque sus numeros no se leen del objeto de entrada (medido:
// asignar estilo_indicacion.point.radius a mano y volver a pintar la capa no
// cambtaba nada), asi que se crea un estilo nuevo cada vez que hace falta.
function estiloIndicaciones() {
  const en3D = !!(window.IDEE && window.IDEE.impl && window.IDEE.impl.cesium);
  return new IDEE.style.Generic({
  point: {
    radius: en3D ? 9 : 5, 
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
      radius: en3D ? 19 : 11,
      color: '#006CFF' || 'blue', // Hexadecimal, nominal
      fill: 'blue',
    }
  }
});
}



ruta.setStyle(estiloRuta());
PuntosInteres.setStyle(estiloPDI());
indicaciones.setStyle(estiloIndicaciones());



mapjs.addLayers([ruta]);
mapjs.addLayers([PuntosInteres]);
mapjs.addLayers([indicaciones]);

// En 3D las geometrias tienen que ir pegadas al MDT o el terreno las tapa.
pegaAlTerrenoSiCesium(ruta);
pegaAlTerrenoSiCesium(PuntosInteres);
// En los modos planos de Cesium hace falta una altura real: ahi el clampeo no se aplica.
pegaAlTerrenoEnPlanoSiCesium(PuntosInteres);
pegaAlTerrenoSiCesium(indicaciones);
// En los modos planos de Cesium hace falta una altura real: ahi el clampeo no se aplica.
pegaAlTerrenoEnPlanoSiCesium(indicaciones);


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

  // En 3D los puntos de indicaciones se ven mas pequenos que en 2D, asi que su
  // radio sube solo con Cesium. Se ajusta aqui, dentro de mapa(), y no en la
  // definicion del estilo, porque mapa() se vuelve a ejecutar en cada cambio de
  // implementacion y para entonces la capa ya existe. IDEE.impl.cesium es como
  // lo mira la propia API.
  const en3D = !!(window.IDEE && window.IDEE.impl && window.IDEE.impl.cesium);
  // Al volver a pintar el mapa (o al cambiar de implementacion) el radio de
  // las indicaciones se recalcula, que en 3D es mayor.
  if (typeof indicaciones !== 'undefined' && indicaciones && indicaciones.setStyle) {
    indicaciones.setStyle(estiloIndicaciones());
    PuntosInteres.setStyle(estiloPDI());
    ruta.setStyle(estiloRuta());
  }

  return mapjs

}

mapa()
