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

  capaMVT_Municipios.on(IDEE.evt.SELECT_FEATURES, (features, m) => {
    codMuni = features[0].getAttributes().nationalcode.slice(-5)
    console.log(codMuni);
    console.log(features[0].getAttributes())
    filtrado = data.filter(obj => obj["Codigo Municipio"] === codMuni)
    console.log(filtrado[0])

    totalPobl = filtrado[0]["Total"].replaceAll(".", "")
    try{
      totalParo = filtrado[0]["total Paro Registrado"].replace("<", "")
    }catch{
      totalParo = 0
    }
    porcParo = Number(totalParo) / Number(totalPobl) * 100
    
    filtrado[0] = { ["Paro"]: porcParo, ...filtrado[0]  };


    
    const escape = (s) => String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
        
    const filas = Object.entries(filtrado[0])
        .map(([k, v]) => `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`)
        .join("");



    const featureTabOpts = {
      'icon': 'g-cartografia-pin', // icono para mostrar en la pestaña
      'title': 'Título de la pestaña', // título de la pestaña
      'content': 
                `<table class="tabla-objeto">
                      <thead><tr><th>Propiedad</th><th>Valor</th></tr></thead>
                      <tbody>${filas}</tbody>
                    </table>
                  `
    };
    // Creamos el popup
    popup = new IDEE.Popup();
    // Añadimos la pestaña al popup
    popup.addTab(featureTabOpts);
    // Añadimos el popup en las coordenadas devueltas por el evento click
    mapajs.addPopup(popup, m.coord);
  });

  function createStyleforMVT() {

    paroStyle = {}
    for (const element of data) {
      codMuni = element["Municipios"].split(" ")[0];
      totalPobl = element["Total"].replaceAll(".", "")
      try{
        totalParo = element["total Paro Registrado"].replace("<", "")
      }catch{
        totalParo = 0
      }
      porcParo = Number(totalParo) / Number(totalPobl) * 100

      if (porcParo < 1) {
        color = "rgba(241, 248, 236, 1)"
      } else if (porcParo < 3) {
        color = "rgba(155, 253, 90, 1)"
      } else if (porcParo < 5) {
        color = "rgba(215, 253, 42, 1)"
      } else if (porcParo < 7) {
        color = "rgba(253, 221, 42, 1)"
      } else if (porcParo < 10) {
        color = "rgba(253, 169, 42, 1)"
      } else {
        color = "rgba(253, 74, 42, 1)"
      }

      paroStyle[codMuni] = { "color": color }

    };

    return paroStyle

  }
  estilo = createStyleforMVT()
  // console.log(estilo)

  let estilo_Municipios = new IDEE.style.Polygon({
    fill: {
      color: (feature) => {
        codMuni = feature.getAttributes().nationalcode.slice(-5)
        // console.log(codMuni)
        // console.log(estilo[codMuni])
        try {
          color = estilo[codMuni].color
        } catch {
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
    const urlParo_1 = `https://sede.sepe.gob.es/es/portaltrabaja/resources/sede/datos_abiertos/datos/Paro_por_municipios_${añoCSV - 1}_csv.csv`;
    M.remote.get(urlParo).then(function (res) {
      try {
        const data = csvToJson(res.text, id = false, headerRow = 1);
        resolve(data);
      } catch (e) {
        M.remote.get(urlParo_1).then(function (res) {
          mesCSV = 12
          añoCSV = añoCSV - 1
          try {
            const data = csvToJson(res.text, id = false, headerRow = 1);
            resolve(data);
          } catch (e) {
            reject(e);
          } finally {
            //
          }
        })
      }
    }).catch(err => {
      reject(err);
    })
  });

  dataParo = await myPromise_1_CSV;
  dataParoFiltrado = dataParo.filter(obj => obj["C�digo mes"] === `${añoCSV}${mesCSV}`)
  if (dataParoFiltrado.length === 0) {
    dataParoFiltrado = dataParo.filter(obj => obj["C�digo mes"] === `${añoCSV}${mesCSV - 1}`)
  }


  const myPromise_poblo_prov= new Promise(function (resolve, reject) {
    const urlPoblacion = `https://www.ine.es/dynt3/inebase/index.htm?padre=525`;
    M.remote.get(urlPoblacion).then(async function (res) {
      try {

        const parser = new DOMParser();
        const doc = parser.parseFromString(res.text, 'text/html')


        // Capturamos todos los <a href="...">
        const hrefs = Array.from(doc.querySelectorAll('a[href]'))
          .map(a => a.getAttribute('href'))
          .filter(Boolean)
          .map(h => h.trim())
          .filter(h => h.includes('dlgExport'))

        // Normalizar: decodificar entidades y trim
        const normalizados = hrefs
          .filter(Boolean)
          .map(h => h.trim().replace(/&amp;/g, '&'));

        // Pasar a absoluta y extraer parámetro 't'
        const ids = normalizados.map(href => {
          try {
            BASE = 'https://www.ine.es';
            const abs = new URL(href, BASE);        // relativo -> absoluto
            const t = abs.searchParams.get('t');    // parámetro principal
            // Validar: debe ser un número
            return t;
          } catch {
            return null;
          }
        }).filter(Boolean);

        // Construir la URL final CSV
        const csvUrls = ids.map(id => new URL(`/jaxiT3/files/t/es/csv_bdsc/${id}.csv?nocab=1`, BASE).href);
        data = [...new Set(csvUrls)];

        dataPobl = []
        const Pobl = await Promise.all(
              data.map(async (provUrl) => {
                const r = await M.remote.get(provUrl);
                // Ajusta firma de csvToJson si es necesario
                csv = csvToJson(r.text, false, 0);
                // csv = csv.filter(obj => obj["Periodo"] === `${añoCSV}`).filter(obj => obj["Sexo"] === `Total`)
                // if (csv.length === 0) {
                //   dataParoFiltrado = csv.filter(obj => obj["Periodo"] === `${añoCSV-1}`).filter(obj => obj["Sexo"] === `Total`)
                // }
                dataPobl.push(...csv)
                return
              })
            );


        resolve(dataPobl);
      } catch (e) {
        reject(e);
      } finally {
        //
      }
    }).catch(err => {
      reject(err);
    });
  });
  dataPoblacionFiltrado = await myPromise_poblo_prov;
  dataPoblacionFiltrado = dataPoblacionFiltrado.filter(obj => obj["Periodo"] === `${añoCSV}`).filter(obj => obj["Sexo"] === `Total`)
  if (csv.length === 0) {
    dataPoblacionFiltrado = csv.filter(obj => obj["Periodo"] === `${añoCSV-1}`).filter(obj => obj["Sexo"] === `Total`)
  }

  const byIdA  = new Map(dataParoFiltrado.map(o => [o["Codigo Municipio"], o]));
    for (const objB of dataPoblacionFiltrado) {
      const objA = byIdA.get(objB["Municipios"].split(" ")[0]);
      if (objA) {
        Object.assign(objB, objA); // añade/actualiza propiedades en B
      }
    }

  CSV = dataPoblacionFiltrado

  return CSV
}
