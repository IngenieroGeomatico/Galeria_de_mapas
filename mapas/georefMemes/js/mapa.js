 
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

