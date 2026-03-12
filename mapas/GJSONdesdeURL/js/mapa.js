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

  mapajs = M.map({
    container: "mapaDIV"
  });


  const layer1 = new IDEE.layer.GeoJSON({
    name: "capa_gjson",
    url: gjsonUrl
  }, {
    // aplica un estilo a la capa
    style: new IDEE.style.Generic({
      polygon: {
        fill: {
          color: 'orange',
          opacity: 0.6
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
  mapajs.addLayers(layer1)


  // Añadir el plugin correctamente al mapa
  mapajs.addPlugin(pluginCamioImplFunc());

  SVGCarga.hidden = true
  console.log("--------------------------------------, 1")
  return mapajs

}


function mapa2() {

  SVGCarga.hidden = false

  const gjsonUrl = getQueryParam('gjson_url');

  mapajs2 = M.map({
    container: "mapaDIV"
  });


  const layer1 = new IDEE.layer.GeoJSON({
    name: "capa_gjson",
    url: gjsonUrl
  }, {
    // aplica un estilo a la capa
    style: new IDEE.style.Generic({
      polygon: {
        fill: {
          color: 'orange',
          opacity: 0.6
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




  // Añadir el plugin correctamente al mapa
  mapajs2.addPlugin(pluginCamioImplFunc());

  SVGCarga.hidden = true
  console.log("--------------------------------------, 2")
  return mapajs2

}

function pluginCamioImplFunc() {
  return pluglinCambioImpl = new miPlugin_cambioImpl({
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

mapajs_0 = mapa()


mapajs_0.getMapImpl().on('rendercomplete', () => {
  capa = mapajs_0.getOverlayLayers()[0]
  mapajs_0.setBbox(capa.getFeaturesExtent())
  mapajs_0.setZoom(mapajs_0.getZoom() - 0.5)
});

