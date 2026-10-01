

const SVGCarga = document.getElementById("cargaSVG")

/* ===========================================================================
   CENTRO INICIAL DE LA VISTA
   ---------------------------------------------------------------------------
   Puerta del Sol, en EPSG:3857 (el sistema en el que trabaja el constructor de
   M.map y el resto del visualizador). Lo comparten el `center` del constructor y
   centrarVistaInicial().

   Es una constante y no un literal suelto porque ambos tienen que decir
   exactamente lo mismo: si divergieran, el mapa arrancaría en un sitio y
   se cuadraría en otro.
   =========================================================================== */
const CENTRO_MADRID = { x: -413064.3575507956, y: 4927841.089710372 };


/* ===========================================================================
   CUADRAR LA VISTA AL ARRANCAR
   ---------------------------------------------------------------------------
   El `center` del constructor de M.map va en EPSG:3857, que es lo que espera
   OpenLayers, pero Cesium trabaja en EPSG:4326 y no aplica ese valor. Al arrancar
   en 3D la cámara se quedaba en la vista por defecto de Cesium durante unos 3 s
   (medido: mar Rojo, lon 35.642 / lat 18.91, 82 km de altura) y hasta que
   cambioImpl aplicaba la vista guardada, con un salto visible. La posición final
   era correcta; el fallo era el arranque en falso.

   El detalle que hace que esto no sea trivial: cuando se ejecuta mapa() el
   bundle de Cesium AÚN NO se ha recargado, así que getMapImpl() sigue
   devolviendo el mapa 2D anterior y cualquier comprobación de implementación
   da "OpenLayers". Medido en carga limpia: el mapa 2D sigue siendo el que se ve
   hasta los ~1,7 s, y la escena de Cesium no existe hasta ese momento.

   Por eso no se decide una sola vez al arrancar, sino que se ESPERA a que la
   escena exista y se aplica el centro UNA vez, en ese instante. Un reintento con
   tope de intentos resultaba en un fallo silencioso: los primeros intentos se
   consumían mientras todavía no había escena y, para cuando aparecía, el bucle
   ya había terminado. Con la espera activa el centro se aplica en el mismo
   momento en que Cesium queda disponible y la cámara va directa a su sitio
   (medido: Madrid a los 1,7 s, sin pasar por la vista por defecto).

   El centro se pide en EPSG:4326 a setCenter porque el `center` del constructor
   va en EPSG:3857 (el que espera OpenLayers) y Cesium lo ignora. La
   reproyección usa IDEE.utils.reproject, que es síncrono, siguiendo el patrón de
   mapas/LucesdeBohemia/js/mapa.js.
   =========================================================================== */
function centrarVistaInicial() {
  if (!mapajs) return;
  const api = (typeof IDEE !== 'undefined' && IDEE) ? IDEE : M;

  const aplicar = () => {
    // getMapImpl se pide al mapa (mapajs), NO al bundle global: IDEE.getMapImpl
    // no existe y devuelve undefined, con lo que la comprobación de Cesium
    // fallaría siempre.
    const mapImpl = (typeof mapajs.getMapImpl === 'function') ? mapajs.getMapImpl() : null;
    if (!(mapImpl && mapImpl.scene && mapImpl.scene.camera && typeof Cesium !== 'undefined')) {
      return false;
    }
    try {
      const [lon, lat] = api.utils.reproject(
        [CENTRO_MADRID.x, CENTRO_MADRID.y], 'EPSG:3857', 'EPSG:4326');
      mapajs.setCenter({ x: lon, y: lat });
    } catch (e) {
      // Un fallo aquí no debe impedir que el mapa arranque: el constructor ya
      // dejó un centro razonable y cambioImpl acaba aplicando la vista.
      console.warn('centrarVistaInicial fallo', e);
    }
    return true;
  };

  // En 2D el constructor ya coloca bien el centro: se aplica y se termina.
  if (!aplicar()) {
    // Todavía no es Cesium (el bundle se está recargando). Se espera a que la
    // escena exista, con un tope generoso para no esperar indefinidamente si
    // algún día no llegara. 120 * 100ms = 12s.
    let intentos = 0;
    const esperar = () => {
      intentos++;
      if (intentos > 120) return;
      if (aplicar()) return;
      setTimeout(esperar, 100);
    };
    setTimeout(esperar, 100);
  }
}


/* ===========================================================================
   OVERLAY DE CARGA (2D <-> 3D)
   ---------------------------------------------------------------------------
   Antes el spinner se ocultaba en el callback OTHER, que se dispara cuando las
   capas se AÑADEN, no cuando están CARGADAS. Al cambiar de 2D a 3D eso dejaba
   al usuario mirando un mapa a medias durante varios segundos.

   Ahora el spinner se muestra al pulsar el botón de cambio (antes incluso de que
   se recargue el bundle) y se oculta sólo cuando las capas VISIBLES están
   listas. Las ocultas quedan fuera de la espera a propósito: en 2D la API no las
   carga hasta que se encienden, así que esperarlas dejaría el velo puesto
   siempre. Ver esperarCapasListas().

   `cargaToken` es lo que hace seguro esto: mapa() se re-ejecuta en cada cambio de
   implementación, así que sin él los timers de la ejecución anterior podrían
   cerrar el overlay de la nueva.
   =========================================================================== */

let cargaToken = 0;
let timerCarga = null;
// Token al que pertenece el timer vivo. El callback OTHER puede dispararse
// varias veces dentro de una misma ejecución de mapa(); sin esto, cada llamada
// reiniciaría el reloj del tope de seguridad y el velo no caería nunca.
let tokenTimer = null;

// Las tres capas de este visualizador. Se declara aquí (y no dentro del barrido
// de deduplicación) porque la necesitan tanto el barrido como la espera de carga.
const CAPAS_VISUALIZADOR = ["Monumentos", "Placas conmemorativas", "Placas Stolpersteine"];

// Tope de seguridad: si alguna capa no llega a cargar nunca (red caída, dataset
// vacío), el overlay se retira igualmente. El usuario no puede quedarse atrapado
// detrás de un velo opaco por una carga fallida.
const TIMEOUT_CARGA_MS = 45000;

function mostrarCarga() {
  cargaToken++
  if (timerCarga) {
    clearInterval(timerCarga)
    timerCarga = null
  }
  tokenTimer = null
  if (SVGCarga) SVGCarga.hidden = false
  return cargaToken
}

function ocultarCarga(token) {
  // Sólo la ejecución vigente puede cerrar el overlay: los timers de una
  // ejecución anterior de mapa() ya no valen.
  if (token !== cargaToken) return
  if (timerCarga) {
    clearInterval(timerCarga)
    timerCarga = null
  }
  tokenTimer = null
  if (SVGCarga) SVGCarga.hidden = true
}

/**
 * ¿Está la capa con sus entidades realmente disponibles?
 *
 * La señal NO es la misma en las dos implementaciones, y está medido:
 *  - 2D (OL): el impl expone `loaded_`, que sí significa "capa cargada".
 *  - 3D (Cesium): `loaded_` pasa a `true` con `features_` todavía vacío y
 *   _entities.length_ indefinido, porque la API crea un datasource placeholder
 *    y lo SUSTITUYE cuando llegan los features. Por eso aquí se resuelve el
 *    datasource vivo por nombre y se cuentan sus entidades, igual que hace
 *    activarClusteringCesium().
 */
function capaLista(capa) {
  if (!capa) return false
  const impl = typeof capa.getImpl === "function" ? capa.getImpl() : null
  if (!impl) return false

  if (typeof checkImpl === "function" && checkImpl() === "cesium") {
    try {
      const mapImpl = mapajs.getMapImpl()
      const nombre = capa.filterID || capa.name
      const ds = mapImpl.dataSources._dataSources.filter(d => d && d.name === nombre)[0]
      if (!ds || !ds.entities || !ds.entities.values) return false
      return ds.entities.values.length > 0
    } catch (e) {
      return false
    }
  }

  return impl.loaded_ === true
}

/** ¿Está la capa encendida? El flag real está en el impl (la fachada no lo expone). */
function capaVisible(capa) {
  if (!capa) return false
  const impl = typeof capa.getImpl === "function" ? capa.getImpl() : null
  if (impl && typeof impl.visibility === "boolean") return impl.visibility
  if (capa.options && typeof capa.options.visibility === "boolean") return capa.options.visibility
  return true
}

/** Espera a que las capas visibles estén listas y cierra el overlay. */
function esperarCapasListas(nombres, token) {
  // El callback OTHER puede invocarse más de una vez por ejecución de mapa().
  // Si ya hay un timer vivo para ESTE token, se respeta su reloj: reiniciarlo
  // en cada llamada dejaría el tope de seguridad sin efecto real.
  if (timerCarga && tokenTimer === token) return
  tokenTimer = token

  const inicio = Date.now()
  timerCarga = setInterval(() => {
    let pendiente = false
    try {
      const capas = mapajs.getLayers().filter(l => l && l.filterID)
      // Sólo se espera a las capas VISIBLES. Las ocultas no aportan nada a lo
      // que el usuario está mirando y en 2D la API ni siquiera las carga: las
      // resuelve de forma perezosa al encenderlas (source distinto, 0 features,
      // loading=false). Esperarlas dejaría el velo puesto hasta el tope de
      // seguridad en cada arranque y en cada cambio 2D/3D.
      // El subconjunto se recalcula en cada tick porque el plugin de filtrado
      // puede apagar capas justo después de que arranque la espera.
      const visibles = nombres
        .map(nombre => capas.filter(l => l.filterID === nombre)[0])
        .filter(c => capaVisible(c))
      // [] .every() === true: si no queda ninguna visible, no hay nada que esperar.
      pendiente = !visibles.every(c => capaLista(c))
    } catch (e) {
      pendiente = true
    }

    if (!pendiente || Date.now() - inicio > TIMEOUT_CARGA_MS) {
      ocultarCarga(token)
    }
  }, 300)
}

// El botón lo crea ext/cambioImpl/cambioImpl.js. Se escucha desde aquí para
// tapar el spinner en el clic, sin tocar el plugin compartido por todos los
// visualizadores y sin esperar a que se recargue el bundle y se re-ejecute mapa().
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("APIIDEE-herramienta-button")
  if (btn) btn.addEventListener("click", mostrarCarga)
})


function mapa() {

  // Cada re-ejecución (carga inicial y cada cambio 2D/3D) abre el overlay.
  const tokenCarga = mostrarCarga()


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
M.config.POPUP_INTELLIGENCE.activate = false

mapajs = M.map({
  container: "mapa",
  zoom: 12,
  center: CENTRO_MADRID,
  layers: []
});

// Cuadra la cámara nada más crear el mapa, antes de que se carguen las capas.
//
// Por qué hace falta: el `center` del constructor va en EPSG:3857, que es lo que
// espera OpenLayers, pero Cesium trabaja en EPSG:4326 y no aplica ese valor. Al
// arrancar el visualizador en 3D, la cámara se quedaba en la vista por defecto
// de Cesium (medido: mar Rojo, lon 35.642 / lat 18.91, 82 km) durante unos 3 s
// y hasta que `cambioImpl` aplicaba la vista guardada, lo que producía un salto
// visible. La posición final era correcta; lo que sobraba era el arranque en
// falso, así que se corrige fijando el centro en cuanto el mapa existe.
centrarVistaInicial();


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
      // form: M.style.form.SHIELD,
      // Icono LOCAL y relativo. Con la URL remota de flaticon, la API dejaba en
      // el billboard un valor de imagen NO utilizable
      // (["rgba(0,0,0,0)",50,"rgba(0,0,0,0)",0]) en las 1765 primitivas: al no
      // ser una imagen cargable no se generaba textura y el icono no se
      // dibujaba nunca. Verificado sobre carga limpia, sin tocar nada.
      src: '../../img/iconos/monumento.png',
      // Tamaño de la fuente
      fontsize: 0.7,
      scale: 0.1,
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
      // form: M.style.form.LOZENGE,
      // Icono local: con la URL remota de flaticon, la API dejaba en el
      // billboard un valor de imagen no utilizable (ver
      // activarClusteringCesium) y el icono no se dibujaba en 3D.
      src: '../../img/iconos/cuadradoAmarillo.png',
      // Tamaño de la fuente
      fontsize: 0.7,
      scale: 0.08,
      // Clase fuente
      // class: 'P',
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
      // form: M.style.form.SQUARE,
      // Icono local: con la URL remota de flaticon, la API dejaba en el
      // billboard un valor de imagen no utilizable (ver
      // activarClusteringCesium) y el icono no se dibujaba en 3D.
      src: '../../img/iconos/romboAmarillo.png',
      // Tamaño de la fuente
      fontsize: 0.7,
      scale: 0.06,
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

  const impl = checkImpl();

  // Helper para eliminar capas existentes con el mismo filterID o name (evita duplicación)
  const removerCapaExistente = (filterID) => {
    try {
      if (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getLayers === 'function') {
        const layers = mapajs.getLayers();
        if (Array.isArray(layers)) {
          const duplicadas = layers.filter(l => l && (l.filterID === filterID || l.name === filterID));
          if (duplicadas.length > 0) {
            mapajs.removeLayers(duplicadas);
          }
        }
      }
    } catch (e) {
      console.warn('Error al deduplicar capa ' + filterID, e);
    }
  };

  // 1. Capa Monumentos
  removerCapaExistente("Monumentos");
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
    visibility: true,
    // style:estiloEstacion
  })
  capaMonumentos.filterID = "Monumentos"
  capaMonumentos.setStyle(impl === 'cesium' ? estilo_base_Monumentos : compositeMonumentos)
  capaMonumentos.on(M.evt.SELECT_FEATURES, function (features, evt) {
    // se puede comprobar si el elemento seleccionado es un cluster o no
    if (features[0] instanceof M.ClusteredFeature) {
      console.log('Es un cluster');
      mapajs.getPopup().hide()
    }
  });
  mapajs.addLayers(capaMonumentos)
  if (impl === 'cesium') {
    // Sin depthTestDistance: la API ya aplica Infinity al crear el billboard del
    // estilo. Pasar 5000 la machacaba y dejaba los iconos con depth-test contra
    // el terreno (cámara a >5 km), por lo que quedaban enterrados.
    activarClusteringCesium("Monumentos", 40, 2, undefined, '../../img/iconos/monumento.png');
  }


  // 2. Capa Placas conmemorativas
  removerCapaExistente("Placas conmemorativas");
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
    visibility: false,
    // style:estiloEstacion
  })
  capaPlacas.filterID = "Placas conmemorativas"
  capaPlacas.setStyle(impl === 'cesium' ? estilo_base_Placas : styleCluster_Placas)
  capaPlacas.on(M.evt.SELECT_FEATURES, function (features, evt) {
    // se puede comprobar si el elemento seleccionado es un cluster o no
    if (features[0] instanceof M.ClusteredFeature) {
      console.log('Es un cluster');
      mapajs.getPopup().hide()
    }
  });
  mapajs.addLayers(capaPlacas)
  if (impl === 'cesium') {
    // Ver comentário en Monumentos: no sobrescribir el Infinity de la API.
    activarClusteringCesium("Placas conmemorativas", 40, 2, undefined, '../../img/iconos/cuadradoAmarillo.png');
  }


  // 3. Capa Placas Stolpersteine
  removerCapaExistente("Placas Stolpersteine");
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
    visibility: false,
    // style:estiloEstacion
  })
  capaStolpersteine.filterID = "Placas Stolpersteine"
  capaStolpersteine.setStyle(impl === 'cesium' ? estilo_base_Stonh : styleCluster_Stonh)
  capaStolpersteine.on(M.evt.SELECT_FEATURES, function (features, evt) {
    // se puede comprobar si el elemento seleccionado es un cluster o no
    if (features[0] instanceof M.ClusteredFeature) {
      console.log('Es un cluster');
      mapajs.getPopup().hide()
    }
  });
  mapajs.addLayers(capaStolpersteine)
  if (impl === 'cesium') {
    // Ver comentario en Monumentos: no sobrescribir el Infinity de la API.
    activarClusteringCesium("Placas Stolpersteine", 40, 2, undefined, '../../img/iconos/romboAmarillo.png');
  }

  // Barrido final de seguridad para deduplicación: asegurar que sólo queda una capa por filterID
  try {
    if (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getLayers === 'function') {
      const allLayers = mapajs.getLayers();
      if (Array.isArray(allLayers)) {
        CAPAS_VISUALIZADOR.forEach(fid => {
          const matched = allLayers.filter(l => l && (l.filterID === fid || l.name === fid));
          if (matched.length > 1) {
            const sobrantes = matched.slice(0, -1);
            mapajs.removeLayers(sobrantes);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Error en barrido final de deduplicación', e);
  }

  // El spinner se cierra cuando las tres capas están REALMENTE cargadas, no
  // cuando se han añadido: al volver de 3D, «añadida» no implica «pintada».
  esperarCapasListas(CAPAS_VISUALIZADOR, tokenCarga)

})





async function myFunction_GetData() {

  geojsonDataAsync = {}

  let myPromise_Monumentos = new Promise(function (resolve) {

    //M.proxy(true)
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

  if(value_Monumentos.length == 0){
    // Sin datos no hay nada que esperar: se cierra el overlay y se cancela el
    // timer, que si no seguiría sonando hasta el tope de seguridad.
    ocultarCarga(cargaToken)
    M.dialog.info("Necesita tener activada la extensión del navegador CORS para poder cargar los datos")
  }



  geoJson_Monumentos = convertJsonLdToGeoJson(JSON.parse(value_Monumentos), confJSON_LD);
  geojsonDataAsync.geoJson_Monumentos = geoJson_Monumentos

  

  let myPromise_Placas = new Promise(function (resolve) {

    //M.proxy(true)
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

    //M.proxy(true)
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
M.proxy(false)
const ext_Modal = new IDEE.plugin.miPlugin_modal({
  position: 'BL',
  helpLink: {
    es: '../../html/modal_PuntosHistoricosMadrid.html'
  }
});
M.proxy(false)
mapajs.addPlugin(ext_Modal);
M.proxy(false)
const ext_Attribution = new IDEE.plugin.miPlugin_attribution({
  position: 'BR',
  mode: 'lite',
  attributions: [{
    name: 'Autor:',
    description: " <a style='color: #0B57D0' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
  }]
});
M.proxy(false)
mapajs.addPlugin(ext_Attribution);
M.proxy(false)

mapajs.addPlugin(new IDEE.plugin.miPlugin_filtroCapas())

mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
  buttonTitle: 'cambiar impl :)',
  mapsFunction: mapa,
  sameMap: true,
  shareView: true,
  shareLayers: true
}));
mapajs.addPlugin(new IDEE.plugin.miPlugin_baseLayer({ rows: 1 }));
mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());

// Devolver una promesa que resuelve DESPUES de que geojsonData.then() haya
// añadido las capas, para que `await reiniciarMapa` (cambioImpl) espere a que
// existan y `reapplyOverlayOrder` pueda reordenarlas por su z de origen.
// Patron del commit 9745fb8 (CalidadAireMadrid/CalidadAireComunidadMadrid).
return geojsonData.then(() => mapajs)

}

function checkImpl() {
  let mapImpl = null;
  try {
    if (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getMapImpl === 'function') {
      mapImpl = mapajs.getMapImpl();
    }
  } catch (e) { /* mapa aún no listo */ }
  return (mapImpl && mapImpl.scene && mapImpl.scene.camera &&
    typeof Cesium !== 'undefined') ? 'cesium' : 'ol';
}

function activarClusteringCesium(nombreCapa, pixelRange = 40, minimumClusterSize = 2, depthTestDistance = undefined, iconoUrl = null) {
  if (typeof Cesium === 'undefined') return;

  // --- Icono de las features sueltas -----------------------------------------
  // La API NO consigue convertir el icono del estilo en una imagen válida para
  // las primitivas de las singles: les deja el valor serializado
  //   ["rgba(0,0,0,0)",50,"rgba(0,0,0,0)",0]
  // que no es una imagen cargable, así que no se genera textura y el icono no se
  // dibuja NUNCA. En los clusters sí escribe un data:image/png válido, y por eso
  // se veían los clusters pero no las features al hacer zoom.
  // Verificado sobre carga limpia: 1765/1765 con esa basura, 0 sub-regiones.
  // Cambiar el `src` del estilo no lo arregla (la API lo vuelve a pisar) y
  // `ddt`/`verticalOrigin` tampoco: la API los revierte a 0 en cada
  // reaplicación de estilo. Lo que SÍ persiste es escribir la imagen
  // directamente en la primitiva (1765/1765 sobreviven al estilo).
  let iconoSingles = null;
  if (iconoUrl) {
    try {
      const img = new Image();
      img.onload = () => { iconoSingles = img; };
      img.src = iconoUrl;
    } catch (e) { /* ignore */ }
  }

  // El valor bueno llega como objeto (Image/canvas) o como data URL / ruta.
  // La basura de la API viene como string que empieza por '['.
  const imagenUsable = (p) => {
    const v = p && p.image;
    if (!v) return false;
    if (typeof v === 'object') return true;
    if (typeof v !== 'string') return false;
    const ini = v.charAt(0);
    return ini !== '[' && ini !== '{';
  };

  let intentos = 0;
  const maxIntentos = 50; // 50 * 100ms = 5s

  const interval = setInterval(() => {
    intentos++;
    let ds = null;
    try {
      const mapImpl = (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getMapImpl === 'function')
        ? mapajs.getMapImpl()
        : null;
      if (mapImpl && mapImpl.dataSources && mapImpl.dataSources._dataSources) {
        ds = mapImpl.dataSources._dataSources.find(d => d.name === nombreCapa);
      }
    } catch (e) {
      // ignore
    }

    if (ds) {
      clearInterval(interval);
      if (!ds.clustering) return;

      ds.clustering.enabled = true;
      ds.clustering.pixelRange = pixelRange;
      ds.clustering.minimumClusterSize = minimumClusterSize;

      // Generación de marcadores de cluster circulares con degradado secuencial y tipografía nítida
      const dpr = 2; // Factor de alta densidad para máxima nitidez en billboards 3D

      const configBuckets = {
        '50+': { diametro: 50, c1: '#9F1239', c2: '#4C0519', font: 'bold 15px' },
        '40+': { diametro: 46, c1: '#9D174D', c2: '#500724', font: 'bold 14px' },
        '30+': { diametro: 42, c1: '#7C3AED', c2: '#3B0764', font: 'bold 13px' },
        '20+': { diametro: 38, c1: '#4F46E5', c2: '#1E1B4B', font: 'bold 13px' },
        '10+': { diametro: 34, c1: '#2563EB', c2: '#172554', font: 'bold 12px' },
        '5+':  { diametro: 30, c1: '#0284C7', c2: '#082F49', font: 'bold 12px' },
        '2+':  { diametro: 26, c1: '#0D9488', c2: '#042F2E', font: 'bold 11px' }
      };

      function crearIconoCluster(texto, cfg) {
        const diametro = cfg.diametro;
        const pad = 6;
        const total = diametro + pad * 2;
        const canvas = document.createElement('canvas');
        canvas.width = total * dpr;
        canvas.height = total * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { dataUrl: '', size: total };

        ctx.scale(dpr, dpr);

        const cx = total / 2;
        const cy = total / 2;
        const r = diametro / 2;

        // 1. Sombra exterior difusa para dar profundidad y despegar del terreno
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        // 2. Fondo circular con degradado elegante
        const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grad.addColorStop(0, cfg.c1);
        grad.addColorStop(1, cfg.c2);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // 3. Borde exterior blanco de alto contraste
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4. Anillo interior translúcido
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 5. Tipografía nítida con sombra de texto
        ctx.save();
        ctx.font = `${cfg.font} system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(texto, cx, cy + 0.5);
        ctx.restore();

        return {
          dataUrl: canvas.toDataURL('image/png'),
          size: total
        };
      }

      const pins = {};
      for (const k in configBuckets) {
        pins[k] = crearIconoCluster(k, configBuckets[k]);
      }

      ds.clustering.clusterEvent.addEventListener((entities, cluster) => {
        if (cluster.label.show) cluster.label.show = false;
        cluster.billboard.show = true;
        cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
        // CLAVE: sin estas dos propiedades los clusters quedan ENTERRADOS bajo el terreno:
        cluster.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
        cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        const count = entities.length;
        let texto = '2+';
        if (count >= 50) texto = '50+';
        else if (count >= 40) texto = '40+';
        else if (count >= 30) texto = '30+';
        else if (count >= 20) texto = '20+';
        else if (count >= 10) texto = '10+';
        else if (count >= 5) texto = '5+';
        const pinData = pins[texto] || pins['2+'];
        cluster.billboard.image = pinData.dataUrl;
        cluster.billboard.width = pinData.size;
        cluster.billboard.height = pinData.size;
      });

      // --- NO eliminar los `point` de cada entidad -----------------------------
      // tempting, pero NO se deben borrar los `point` (5px) que la API crea junto
      // al billboard: aunque quedan tapados por el icono y duplican primitivas
      // (~3530 en vez de 1765), son IMPRESCINDIBLES para el agrupado. El código
      // de cluster de la API lee `entity.point._billboard`, así que poner
      // `ent.point = undefined` revienta el render con:
      //   TypeError: Cannot read properties of undefined (reading '_billboard')
      //   at O (...) at Z.t [as _cluster] (...)
      //   -> "An error occurred while rendering. Rendering has stopped."
      // Verificado en navegador: al borrarlos en bloque, 1765 -> 0 y elCesium
      // deja de renderizar. Se conservan tal cual.
      //
      // --- CLAVE: las singles salían INVISIBLES al desclusterizar ---------------
      // No basta con el valor del graphics: la API deja Infinity en
      // `entity.billboard`, pero ese valor NO llega a la primitiva.
      // Medido en navegador a 300 m, ya desclusterizado (1765 singles, 0 ocultas):
      //   single : show=true, heightReference=1 (CLAMP_TO_GROUND), ddt=0
      //   cluster: show=true, heightReference=1 (CLAMP_TO_GROUND), ddt=Infinity
      // La única diferencia real es disableDepthTestDistance. Con el depth test
      // activo la primitiva entra en el z-buffer y el terreno la tapa: por eso se
      // veían los clusters (su clusterEvent sí fija Infinity sobre la
      // primitiva) y no las features sueltas al hacer zoom.
      const depthSingles = depthTestDistance !== undefined ? depthTestDistance : Number.POSITIVE_INFINITY;

      const ajustarEntidad = (ent) => {
        if (!ent) return;
        if (depthTestDistance !== undefined && ent.billboard) {
          ent.billboard.disableDepthTestDistance = depthTestDistance;
        }
      };

      // Repara directamente sobre las primitivas de las singles, igual que hace
      // el clusterEvent con las suyas. NO se toca `show`: ese lo gobierna el
      // agrupado y cambiarlo rompería el desclusterizado.
      //
      // NO se toca `height`. En Cesium el alto de un Billboard son PÍXELES, no
      // metros: fijarlo a 2 (para los "2 m sobre el terreno") convirtió los
      // iconos en barras de 50x2 px, invisibles. La elevación del icono se
      // resuelve con `verticalOrigin`, pero la API lo revierte a 0 en cada
      // reaplicación de estilo, así que ni se intenta (código muerto).
      //
      // Lo único que hay que reparar de verdad es `image`: es la causa raíz de
      // que las singles no se dibujen (ver cabecera de la función).
      //
      // Devuelve el nº de primitivas corregidas, o null si la colección todavía
      // no existe (las primitivas se crean al maquetar cada entidad).
      const ajustarPrimitivasSingles = (destino) => {
        let aplicados = 0;
        try {
          const cl = destino && destino._entityCluster;
          if (!cl || !cl._billboardCollection) return null;
          const cols = [cl._billboardCollection, cl._pointCollection];
          for (let c = 0; c < cols.length; c++) {
            const col = cols[c];
            if (!col || typeof col.length !== 'number' || typeof col.get !== 'function') continue;
            for (let i = 0; i < col.length; i++) {
              const p = col.get(i);
              if (!p) continue;
              let cambia = false;
              if (p.disableDepthTestDistance !== depthSingles) {
                p.disableDepthTestDistance = depthSingles;
                cambia = true;
              }
              if (iconoSingles && !imagenUsable(p)) {
                p.image = iconoSingles;
                cambia = true;
              }
              if (cambia) aplicados++;
            }
          }
        } catch (e) { /* ignore */ }
        return aplicados;
      };

      if (ds.entities) {
        if (ds.entities.values) {
          ds.entities.values.forEach(ajustarEntidad);
        }
        if (ds.entities.collectionChanged && typeof ds.entities.collectionChanged.addEventListener === 'function') {
          ds.entities.collectionChanged.addEventListener((collection, added) => {
            if (added && Array.isArray(added)) {
              added.forEach(ajustarEntidad);
            }
            ajustarPrimitivasSingles(ds);
          });
        }
      }

      // Las primitivas se crean de forma asíncrona conforme llegan los features
      // (medido: ~60 s en carga limpia, con 0 primitivas a los 30 s) y la API
      // reaplica su estilo DESPUÉS, así que hay que reintentarlo en background
      // durante un margen amplio. Se re-resuelve el datasource por nombre
      // porque la API lo sustituye al llegar los features (mismo motivo que en
      // la sincronización de visibilidad).
      //
      // El poller solo se autodetiene cuando la colección de primitivas ha
      // igualado al número de entidades Y además lleva 10 s sin cambios: si no,
      // se pararía en una ventana en la que aún no se ha maquetado todo y
      // quedarían iconos sin reparar.
      let ticksDepth = 0;
      let sinCambiosDepth = 0;
      const timerDepth = setInterval(() => {
        ticksDepth++;
        let completas = false;
        try {
          const mapImpl = (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getMapImpl === 'function')
            ? mapajs.getMapImpl() : null;
          const dsVivo = (mapImpl && mapImpl.dataSources && mapImpl.dataSources._dataSources)
            ? mapImpl.dataSources._dataSources.find(d => d && d.name === nombreCapa)
            : null;
          if (dsVivo) {
            const aplicados = ajustarPrimitivasSingles(dsVivo);
            // null = la colección aún no existe (siguen llegando features): NO
            // cuenta como "sin cambios", o el poller se autodetiene antes de que
            // se maqueten las primitivas y el arreglo no llega a aplicarse.
            if (aplicados !== null) {
              sinCambiosDepth = aplicados > 0 ? 0 : sinCambiosDepth + 1;
              const col = dsVivo._entityCluster._billboardCollection;
              const entidades = (dsVivo.entities && dsVivo.entities.values) ? dsVivo.entities.values.length : 0;
              completas = entidades > 0 && col.length >= entidades;
            }
          }
        } catch (e) { /* ignore */ }
        // Tope duro: 400 * 400ms = 160s, por si la carga se atasca.
        if ((completas && sinCambiosDepth >= 25) || ticksDepth >= 400) clearInterval(timerDepth);
      }, 400);


      // --- Optimización: las capas ocultas no deben renderizar -----------------
      // Nada propagaba la visibilidad de la capa a `ds.show`, así que Placas y
      // Stolpersteine seguían renderizando sus ~552 entidades estando apagadas.
      //
      // Importante: durante la carga, la API sustituye el datasource por otro
      // cuando llegan los features. Fijar `ds.show` una sola vez sobre el
      // datasource placeholder se pierde, así que se vuelve a resolver POR
      // NOMBRE en cada tick mientras la carga se asienta.
      try {
        const capa = (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getLayers === 'function')
          ? mapajs.getLayers().filter(l => l && (l.filterID === nombreCapa || l.name === nombreCapa))[0]
          : null;
        if (capa) {
          // La fachada de la capa NO expone getVisible/getVisibility/visible:
          // el flag real vive en la implementación. Sin esto, leerVisibilidad()
          // devolvía undefined y TODAS las capas quedaban visibles.
          const leerVisibilidad = () => {
            const impl = typeof capa.getImpl === 'function' ? capa.getImpl() : null;
            if (impl && typeof impl.visibility === 'boolean') return impl.visibility;
            if (capa.options && typeof capa.options.visibility === 'boolean') return capa.options.visibility;
            if (typeof capa.getVisible === 'function') return capa.getVisible();
            if (typeof capa.getVisibility === 'function') return capa.getVisibility();
            return true;
          };
          const visibleCapa = leerVisibilidad() !== false;
          ds.show = visibleCapa;

          // Resolver el datasource vivo por nombre (evita fijarlo en el que la
          // API va a descartar). Se acota: 20 * 400ms = 8s, y se autodetiene en
          // cuanto la visibilidad ya está sincronizada.
          let ticksVis = 0;
          const timerVis = setInterval(() => {
            ticksVis++;
            try {
              const mapImpl = (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getMapImpl === 'function')
                ? mapajs.getMapImpl() : null;
              const dsVivo = (mapImpl && mapImpl.dataSources && mapImpl.dataSources._dataSources)
                ? mapImpl.dataSources._dataSources.find(d => d && d.name === nombreCapa)
                : null;
              if (dsVivo) dsVivo.show = leerVisibilidad() !== false;
              const yaSincronizado = dsVivo && dsVivo.show === (leerVisibilidad() !== false);
              if (yaSincronizado || ticksVis >= 20) clearInterval(timerVis);
            } catch (e) {
              clearInterval(timerVis);
            }
          }, 400);

          // Interceptar setVisible para que el panel de capas siga funcionando.
          if (typeof capa.setVisible === 'function' && !capa.__syncShowCesium) {
            const original = capa.setVisible.bind(capa);
            capa.setVisible = function (visible) {
              const r = original(visible);
              try {
                const mapImpl = mapajs.getMapImpl();
                const dsVivo = (mapImpl && mapImpl.dataSources && mapImpl.dataSources._dataSources)
                  ? mapImpl.dataSources._dataSources.find(d => d && d.name === nombreCapa)
                  : null;
                (dsVivo || ds).show = visible !== false;
              } catch (e) {}
              return r;
            };
            capa.__syncShowCesium = true;
          }
        }
      } catch (e) { /* ignore */ }

      // Forzar recluster inicial cambiando pixelRange (dispara el recálculo):
      ds.clustering.pixelRange = 0;
      requestAnimationFrame(() => {
        ds.clustering.pixelRange = pixelRange;
        try {
          const mapImpl = (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getMapImpl === 'function')
            ? mapajs.getMapImpl()
            : null;
          if (mapImpl && mapImpl.scene) {
            mapImpl.scene.requestRender();
          }
        } catch (e) {}
      });
    } else if (intentos >= maxIntentos) {
      clearInterval(interval);
    }
  }, 100);
}

mapa()



