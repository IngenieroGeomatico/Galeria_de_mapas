 IDEE = M 
 
 mapajs = M.map({
  container: "mapa"
});

mapaOL = mapajs.getMapImpl();

noticias = new M.layer.GeoJSON({
  name: "noticias",
  legend: "Noticias",
  url: "https://api.gdeltproject.org/api/v2/geo/geo?query=sourcelang:spanish&format=geojson",
  extract: false
})

let estiloSimpl = new IDEE.style.Generic({
  point: {
    fill: {  
      color: 'red',
    }
  }
});

let clusterOptions = {
    ranges: [{
        min: 2,
        max: 5,
        style: new IDEE.style.Generic({
          point: {
          stroke: {
            color: '#5789aa'
          },
          fill: {
            color: '#eca438ff',
          },
          radius: 15
        }})
      }, {
        min: 5,
        max: 10,
        style: new IDEE.style.Generic({
          point: {
          stroke: {
            color: '#5789aa'
          },
          fill: {
            color: '#e7823eff',
          },
          radius: 20
        }})
      }, {
        min: 11,
        max: 99999,
        style: new IDEE.style.Generic({
          point: {
            stroke: {
              color: '#5789aa'
            },
            fill: {
              color: '#ff6600ff',
            },
            radius: 30
        }})
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
let styleCluster = new M.style.Cluster(clusterOptions); 
noticias.setStyle(estiloSimpl);
noticias.setStyle(styleCluster);



mapajs.addLayers(noticias);



 noticias.on(M.evt.SELECT_FEATURES, function (features, evt) {
    // se puede comprobar si el elemento seleccionado es un cluster o no
    if (features[0] instanceof M.ClusteredFeature) {
      console.log('Es un cluster');
    }
    else{
      console.log(features[0].getAttributes());

      function crearPopupHTML(obj) {
        return `
          <div style="max-width:350px;">
            <h2 style="margin-top:0;">${obj.name}</h2>
            <img src="${obj.shareimage}" alt="${obj.name}" style="width:100%;border-radius:8px;margin-bottom:10px;">
            <div style="font-size:1em;line-height:1.5;">
              ${obj.html}
            </div>
          </div>
        `;
      }

      // Creamos un objeto Tab (pestaña)
      featureTabOpts = {
        'icon': 'g-cartografia-pin', // icono para mostrar en la pestaña
        'title': 'Título de la pestaña', // título de la pestaña
        'content': crearPopupHTML(features[0].getAttributes()), // contenido para mostrar
        'intelligence': true // activa la inteligencia para transformar el contenido en texto inteligente
        // Cuando hablamos de texto inteligente nos referimos a que es capaz de transformar un enlace de una imagen en una etiqueta HTML IMG 
        // permitiendo la visualización de la misma, para un video añadir la etiqueta HTML VIDEO, enlace PDF en etiqueta HTML IFRAME... (*)
      };
      // Creamos el Popup
      popup = new IDEE.Popup();
      // Añadimos la pestaña al popup
      popup.addTab(featureTabOpts);
      // Finalmente se añade al mapa, especificando las coordenadas
      mapajs.addPopup(popup, evt.coord);


    }
  });

