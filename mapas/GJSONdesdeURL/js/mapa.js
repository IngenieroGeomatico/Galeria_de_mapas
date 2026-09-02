const SVGCarga = document.getElementById("cargaSVG")
window.onload = (event) => {
  SVGCarga.hidden = true
};


function getQueryParam(name, defaultValue = null) {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get(name);
    return v === null ? defaultValue : decodeURIComponent(v);
  } catch (e) {
    return defaultValue;
  }
}

function mapa() {

  SVGCarga.hidden = false

  const gjsonUrl = getQueryParam('gjson_url');

  updateConfigBaseLayer()

  mapajs = IDEE.map({
    container: "mapaDIV"
  });

  if (gjsonUrl) {

    const layer1 = new IDEE.layer.GeoJSON({
      name: "capa_gjson",
      url: gjsonUrl
    }, {
      // aplica un estilo a la capa
      style: new IDEE.style.Generic({
        polygon: {
          fill: {
            color: 'orange',
            opacity: 0.4
          },
          stroke: {
            color: 'red',
            width: 2
          }
        },
        point: {
          radius: 5,
          fill: {
            color: 'orange',
            opacity: 0.5
          },
          stroke: {
            color: '#FF0000'
          }
        },
        line: {
          fill: {
            color: 'orange',
            width: 2
          }
        }
      })
    }, {
    });
    layer1.shareLayer = true
    lengthValue = mapajs.getLayers().filter(layer => layer.name == "capa_gjson").length
    mapajs.addLayers(layer1)
  }




  // Añadir el plugin correctamente al mapa
  mapajs.addPlugin(pluginCamioImplFunc());
  mapajs.addPlugin(pluginCapasBaseFunc());
  mapajs.addPlugin(pluginCapasSuperpuestasFunc());

  SVGCarga.hidden = true
  return mapajs

}

function mapa2() {

  SVGCarga.hidden = false

  const gjsonUrl = getQueryParam('gjson_url');

  updateConfigBaseLayer()

  mapajs2 = IDEE.map({
    container: "mapaDIV"
  });

  if (gjsonUrl) {
    const layer1 = new IDEE.layer.GeoJSON({
      name: "capa_gjson",
      url: gjsonUrl
    }, {
      // aplica un estilo a la capa
      style: new IDEE.style.Generic({
        polygon: {
          fill: {
            color: 'orange',
            opacity: 0.4
          },
          stroke: {
            color: 'red',
            width: 2
          },
          heightReference: IDEE.style.heightReference.RELATIVE_TO_GROUND,
          perPositionHeight: false,
          extrudedHeight: 20,
          extrudedHeightReference: IDEE.style.heightReference.RELATIVE_TO_GROUND
        },
        point: {
          radius: 5,
          fill: {
            color: 'orange',
            opacity: 0.5
          },
          stroke: {
            color: '#FF0000'
          }
        },
        line: {
          fill: {
            color: 'orange',
            width: 2
          }
        }
      })
    }, {
    });
    mapajs2.addLayers(layer1)
  }

  // Añadir el plugin correctamente al mapa
  mapajs2.addPlugin(pluginCamioImplFunc());
  mapajs2.addPlugin(pluginCapasBaseFunc());
  mapajs2.addPlugin(pluginCapasSuperpuestasFunc());


  SVGCarga.hidden = true
  console.log("--------------------------------------, 2")
  return mapajs2

}

mapajs_0 = mapa()

// # Definición de funciones de extensiones
function pluginCamioImplFunc() {
  return new miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    // Pasar la referencia a la función sin paréntesis para evitar su ejecución inmediata
    mapsFunction: { same: mapa, ol: mapa, Cesium: mapa2 },
    // o usar la misma función para ambos: mapsFunction: mapa
    // mapsFunction: mapa,
    sameMap: false,
    shareView: true,
    shareLayers: false
  });
}

function pluginCapasBaseFunc() {
  return new miPlugin_baseLayer()
}


function pluginCapasSuperpuestasFunc() {
  return new miPlugin_layerSwitcher()
}

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

  IDEE.proxy(false);

  return
}

function _onRenderComplete() {
  const impl = mapajs_0.getMapImpl();
  const capa = mapajs.getLayers().filter(layer => layer.name == "capa_gjson")[0];
  if (!capa) return;
  mapajs_0.setBbox(capa.getFeaturesExtent());
  mapajs_0.setZoom(mapajs_0.getZoom() - 0.5);

  if (impl && typeof impl.un === 'function') {
    impl.un('rendercomplete', _onRenderComplete);
    return;
  }
  if (impl && typeof impl.off === 'function') {
    impl.off('rendercomplete', _onRenderComplete);
    return;
  }
  if (impl && typeof impl.removeListener === 'function') {
    impl.removeListener('rendercomplete', _onRenderComplete);
    return;
  }
}

const _implForOn = mapajs_0.getMapImpl();
if (_implForOn && typeof _implForOn.on === 'function') {
  _implForOn.on('rendercomplete', _onRenderComplete);
} else if (_implForOn && typeof _implForOn.addEventListener === 'function') {
  _implForOn.addEventListener('rendercomplete', _onRenderComplete);
} else {
  console.warn('rendercomplete: no compatible add-listener method found on map impl');
}

