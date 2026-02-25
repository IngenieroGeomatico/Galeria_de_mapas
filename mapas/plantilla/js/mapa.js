const SVGCarga = document.getElementById("cargaSVG")
window.onload = (event) => {
  SVGCarga.hidden = true
};

function mapa() {

  SVGCarga.hidden = false

  mapajs = M.map({
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


  // Añadir el plugin correctamente al mapa
  mapajs.addPlugin(pluginCamioImplFunc());

  SVGCarga.hidden = true
  console.log("--------------------------------------, 1")
  return mapajs

}


function mapa2() {

  SVGCarga.hidden = false

  mapajs2 = M.map({
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

  SVGCarga.hidden = true
  console.log("--------------------------------------, 2")
  return mapajs2

}

function pluginCamioImplFunc(){
  return pluglinCambioImpl = new miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    // Pasar la referencia a la función sin paréntesis para evitar su ejecución inmediata
    mapsFunction: {same:mapa, ol: mapa, Cesium: mapa2 },
    // o usar la misma función para ambos: mapsFunction: mapa
    // mapsFunction: mapa,
    sameMap: false,
    shareView: true,
    shareLayers: false
  });
}

mapa() 
