const SVGCarga = document.getElementById("cargaSVG")
window.onload = (event) => {
  SVGCarga.hidden = true
};

function mapa() {

  SVGCarga.hidden = false
  updateConfigBaseLayer()
  mapajs = IDEE.map({
    container: "mapaDIV"
  });

  const layer2 = new IDEE.layer.WMS({
    url: 'https://www.ign.es/wms-inspire/unidades-administrativas?',
    name: 'AU.AdministrativeUnit',
    legend: 'Unidades Administrativas',
    tiled: false,
    visibility: true,
  }, {})
  mapajs.addLayers(layer2)

  const layer1 = new IDEE.layer.GeoJSON({
    name: "Provincias",
    url: "https://api-features.ign.es/collections/nuc/items?f=json"
  }, {
    // aplica un estilo a la capa
    style: new IDEE.style.Generic({
      polygon: {
        fill: {
          color: 'red'
        }
      }
    })
  }, {
  });
  mapajs.addLayers(layer1)


  var js_Nuevacapaborrador = document.createElement("script");
  js_Nuevacapaborrador.type = "text/javascript";
  js_Nuevacapaborrador.async = false;
  js_Nuevacapaborrador.src = "../../datos/Nuevacapaborrador.js";
  document.head.appendChild(js_Nuevacapaborrador);
  js_Nuevacapaborrador.addEventListener('load', () => {

    const exists = (mapajs.getOverlayLayers() || []).some(l => {
      try {
        return l && (l.name === 'Nuevacapaborrador' && l.legend === 'Nuevacapaborrador' && l.constructorParameters.parameters.type === "GeoJSON")
      } catch (e) { return false; }
    });
    if (exists) return;


    mapajs.addLayers(
      new IDEE.layer.GeoJSON({
        source: Nuevacapaborrador,
        name: 'Nuevacapaborrador',
        legend: "Nuevacapaborrador",
        extract: true,
      }, {
        // aplica un estilo a la capa
        style: new IDEE.style.Generic({
          point: {
            fill: { color: 'rgb(141, 90, 153)', opacity: 1.0 },
            stroke: { color: 'rgb(35, 35, 35)', opacity: 1.0, width: 0.26 }
          },
          polygon: {
            fill: { color: 'rgb(141, 90, 153)', opacity: 1.0 },
            stroke: { color: 'rgb(35, 35, 35)', opacity: 1.0, width: 0.26 }
          },
          line: {
            fill: { color: 'rgb(141, 90, 153)', opacity: 1.0 },
            stroke: { color: 'rgb(35, 35, 35)', opacity: 1.0, width: 0.26 }
          }
        }),
        visibility: true,// capa no visible en el mapa

      }, {
        opacity: 1 // aplica opacidad a la capa
      })
    );

  });


  // Añadir el plugin correctamente al mapa
  mapajs.addPlugin(pluginCamioImplFunc());
  mapajs.addPlugin(pluginCapasBaseFunc());
  mapajs.addPlugin(pluginCapasSuperpuestasFunc());

  SVGCarga.hidden = true
  console.log("--------------------------------------, 1")
  return mapajs

}


function mapa2() {

  SVGCarga.hidden = false
  updateConfigBaseLayer()
  mapajs2 = IDEE.map({
    container: "mapaDIV"
  });


  const layer1 = new IDEE.layer.GeoJSON({
    name: "Provincias",
    url: "https://api-features.ign.es/collections/nuc/items?f=json"
  }, {
    // aplica un estilo a la capa
    style: new IDEE.style.Generic({
      polygon: {
        fill: {
          color: 'red'
        }
      }
    })
  }, {
  });
  mapajs2.addLayers(layer1)



  // Pasando opciones al plugin en el momento de registrarlo


  // Añadir el plugin correctamente al mapa
  mapajs2.addPlugin(pluginCamioImplFunc());
  mapajs2.addPlugin(pluginCapasBaseFunc());
  mapajs2.addPlugin(pluginCapasSuperpuestasFunc());

  SVGCarga.hidden = true
  console.log("--------------------------------------, 2")
  return mapajs2

}


function pluginCamioImplFunc() {
  return new miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    // Pasar la referencia a la función sin paréntesis para evitar su ejecución inmediata
    mapsFunction: { same: mapa, ol: mapa, Cesium: mapa2 },
    // o usar la misma función para ambos: mapsFunction: mapa
    // mapsFunction: mapa,
    sameMap: false,
    shareView: true,
    shareLayers: true
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
      "layers": [
        "QUICK*Base_IGNBaseTodo_TMS_2"
      ]
    },
    {
      "id": "imagen",
      "title": "Imagen",
      "layers": [
        "QUICK*BASE_PNOA_MA_TMS"
      ]
    }
  ]

  IDEE.proxy(false);

  return
}

mapa() 
