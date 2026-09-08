 
 IDEE = M;


 function meme2Gjson() {
  gjson = {}
  gjson.type = "FeatureCollection"
  gjson.features = []

  for (let i = 0; i < memes.length; i++) {
    gjson.features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [memes[i].long, memes[i].lat]
      },
      properties: {
        name: memes[i].name,
        url: memes[i].url
      }
    })
  }
  return gjson
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

function mapa() {

 updateConfigBaseLayer()

 mapajs = M.map({
  container: "mapa",
  center: {x: -795212.8838837037, y: 4429758.126314859},
  zoom: 5
});

const capa = new IDEE.layer.GeoJSON({
    name: "Memes",
    legend: "Memes",
    source: meme2Gjson(),
    extract: false
    });

let estilo = new IDEE.style.Generic({
  point: {
    radius: 5, 
    fill: {  
      color: 'orange',
      opacity: 0.8
    },
    stroke: {
      color: '#FF0000',
      stroke:5
    }
  }
});
capa.setStyle(estilo)
mapajs.addLayers(capa);

// Añadimos evento SELECT_FEATURE a la capa 
capa.on(IDEE.evt.SELECT_FEATURES, function(features,evt) {
  console.log('click en el feature' + features[0].getId()); // mostrará el ID del objeto espacial
  console.log('Coordenadas: ' + evt.coord); // y las coordenadas
  const rawUrl = features[0].getAttribute('url');
  const embedUrl = rawUrl.replace('watch?v=', 'embed/');
  // Creamos la pestaña
  const featureTabOpts = {
    'icon': 'g-cartografia-pin', // icono para mostrar en la pestaña
    'title': 'Meme', // título de la pestaña
    'content': `
          <h2>${features[0].getAttribute('name')}</h2>

          <iframe
            width="560" height="315"
            src="${embedUrl}" 
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            loading="lazy">
          </iframe>

    ` // contenido para mostrar
  };
  // Creamos el popup
  popup = new IDEE.Popup();
  // Añadimos la pestaña al popup
  popup.addTab(featureTabOpts);
  // Añadimos el popup en las coordenadas devueltas por el evento click
  mapajs.addPopup(popup, evt.coord);
})

  mapajs.addPlugin(new miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true
  }));
  mapajs.addPlugin(new miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new miPlugin_layerSwitcher());

  return mapajs

}

mapa()

