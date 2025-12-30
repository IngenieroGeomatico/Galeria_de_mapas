mapajs = IDEE.map({
  container: "mapa",
  center: { x: -512140.0194987538, y: 4552625.8998558065 },
  zoom: 5
});

const capaMVT_Municipios = new IDEE.layer.MVT({
  url: "https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf",
  name: 'Municipios',
  layers: 'municipio',
  visibility: true,
  extract: false,
});

mapajs.addLayers(capaMVT_Municipios);

CSV = myFunction_CSV()
CSV.then((data) => {

  dataPAro = data[0]
  dataPoblacion =data[1]

  // console.log(dataPAro)
  // console.log(dataPoblacion)



  capaMVT_Municipios.on(IDEE.evt.SELECT_FEATURES, (features, m) => {
    codMuni = features[0].getAttributes().nationalcode.slice(-5)
    console.log(codMuni);
    console.log(features[0].getAttributes())
    filtradoParo = dataPAro.filter(obj => obj["Codigo Municipio"] === codMuni)
    console.log(filtradoParo[0])
    filtradoPoblacion = dataPoblacion.filter(obj => obj["Municipio de inscripción"].includes(codMuni))
    console.log(filtradoPoblacion[0])


    const featureTabOpts = {
      'icon': 'g-cartografia-pin', // icono para mostrar en la pestaña
      'title': 'Título de la pestaña', // título de la pestaña
      'content': filtradoParo[0] // contenido para mostrar
    };
    // Creamos el popup
    popup = new IDEE.Popup();
    // Añadimos la pestaña al popup
    popup.addTab(featureTabOpts);
    // Añadimos el popup en las coordenadas devueltas por el evento click
    mapajs.addPopup(popup, m.coord);
  });

  function createStyleforMVT(){

      paroStyle = {}
      for (const element of dataPoblacion){
        codMuni = element["Municipio de inscripción"].split("-")[0];
        total = element["Total"].replace(".","")
        filtradoParo = dataPAro.filter(obj => obj["Codigo Municipio"] === codMuni)[0]
        if (!filtradoParo){
          continue
        }
        totalParo = filtradoParo["total Paro Registrado"].replace("<","")
        porcParo = Number(totalParo) / Number(total) *100
        
        if(porcParo<5){ 
          color = "rgba(241, 248, 236, 1)"
        } else if (porcParo<10){
          color = "rgba(155, 253, 90, 1)"
        } else if (porcParo<10){
          color = "rgba(215, 253, 42, 1)"
        } else if (porcParo<20){
          color = "rgba(253, 221, 42, 1)"
        } else if (porcParo<30){
          color = "rgba(253, 169, 42, 1)"
        } else {
          color = "rgba(253, 74, 42, 1)"
        }

        paroStyle[codMuni] = {"color":color}
    
      };

      return paroStyle

  }
  estilo = createStyleforMVT()
  console.log(estilo)

  let estilo_Municipios = new IDEE.style.Polygon({
      fill: {
          color: (feature) => {
              codMuni = feature.getAttributes().nationalcode.slice(-5)
              console.log(codMuni)
              console.log(estilo[codMuni])
              try{
                color = estilo[codMuni].color
              } catch{
                color = "white"
              }
              return color;
          },
      },
      stroke: {
          color: 'grey',
          width: 1,
      },
  });
  capaMVT_Municipios.setStyle(estilo_Municipios)


})


// Funciones necesarias para el visualizador
async function myFunction_CSV() {

  const myPromise_1_CSV = new Promise(function (resolve, reject) {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;

    mesCSV = mes - 1
    if (mesCSV <= 0) {
      añoCSV = año - 1
      mesCSV = 12
    }
    else {
      añoCSV = año
    }


    const urlParo = `https://sede.sepe.gob.es/es/portaltrabaja/resources/sede/datos_abiertos/datos/Paro_por_municipios_${añoCSV}_csv.csv`;
    M.remote.get(urlParo).then(function (res) {
      try {
        const data = csvToJson(res.text, id = false, headerRow = 1);
        resolve(data);
      } catch (e) {
        reject(e);
      } finally {
        //
      }
    }).catch(err => {
      reject(err);
    });
  });

  dataParo = await myPromise_1_CSV;
  const dataParoFiltrado = dataParo.filter(obj => obj["C�digo mes"] === `${añoCSV}${mesCSV}`)

  // https://www.ine.es/dynt3/inebase/index.htm?padre=525
  const myPromise_2_CSV = new Promise(function (resolve, reject) {
    const urlPoblacion = `https://www.ine.es/jaxi/files/tpx/csv_bdsc/74755.csv`;
    M.remote.get(urlPoblacion).then(function (res) {
      try {
        const data = csvToJson(res.text, id = false, headerRow = 0);
        resolve(data);
      } catch (e) {
        reject(e);
      } finally {
        //
      }
    }).catch(err => {
      reject(err);
    });
  });

  dataPolacion = await myPromise_2_CSV;
  dataPoblacionFiltrado = dataPolacion.filter(obj => obj["Sexo"] === "Ambos sexos")
  dataPoblacionFiltrado = dataPoblacionFiltrado.filter(obj => obj["Municipio de inscripción"].includes("-"))

  CSV = [
    dataParoFiltrado,
    dataPoblacionFiltrado
  ]
    

  return CSV
}
