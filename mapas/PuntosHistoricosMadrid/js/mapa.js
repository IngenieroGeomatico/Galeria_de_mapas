

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
  center: { x: -413064.3575507956, y: 4927841.089710372 },
  layers: []
});


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
      src: 'https://cdn-icons-png.flaticon.com/512/984/984106.png', // Ponerlo en relatvo
      // Tamaño de la fuente
      fontsize: 0.7,
      scale: 0.08,
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
      src: 'https://cdn-icons-png.flaticon.com/512/3897/3897579.png',
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
      src: 'https://cdn-icons-png.flaticon.com/512/5854/5854013.png',
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
    activarClusteringCesium("Monumentos", 40, 2, 5000);
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
    activarClusteringCesium("Placas conmemorativas", 40, 2, 5000);
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
    activarClusteringCesium("Placas Stolpersteine", 40, 2, Number.POSITIVE_INFINITY);
  }

  // Barrido final de seguridad para deduplicación: asegurar que sólo queda una capa por filterID
  try {
    const targetIDs = ["Monumentos", "Placas conmemorativas", "Placas Stolpersteine"];
    if (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getLayers === 'function') {
      const allLayers = mapajs.getLayers();
      if (Array.isArray(allLayers)) {
        targetIDs.forEach(fid => {
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

  // Oculta el spinner de carga cuando ya están añadidas todas las capas.
  SVGCarga.hidden = true

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
    SVGCarga.hidden = true
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

function activarClusteringCesium(nombreCapa, pixelRange = 40, minimumClusterSize = 2, depthTestDistance = undefined) {
  if (typeof Cesium === 'undefined') return;

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

      // Configurar disableDepthTestDistance en entidades individuales
      const updateEntityDepthTest = (ent) => {
        if (ent && ent.billboard && depthTestDistance !== undefined) {
          ent.billboard.disableDepthTestDistance = depthTestDistance;
        }
      };

      if (ds.entities) {
        if (ds.entities.values) {
          ds.entities.values.forEach(updateEntityDepthTest);
        }
        if (ds.entities.collectionChanged && typeof ds.entities.collectionChanged.addEventListener === 'function') {
          ds.entities.collectionChanged.addEventListener((collection, added) => {
            if (added && Array.isArray(added)) {
              added.forEach(updateEntityDepthTest);
            }
          });
        }
      }

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



