const SVGCarga = document.getElementById("cargaSVG")
// window.onload = (event) => {
//   SVGCarga.hidden = true
// };


mapajs = IDEE.map({
  container: "mapa",
  center: { x: -512140.0194987538, y: 4552625.8998558065 },
  controls:["attributions"],
  zoom: 5
});

mapajs.addAttribution({
  name: "Autor:",
  description: " <a style='color: #0000FF' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
})


const capaMVT_Municipios = new IDEE.layer.MVT({
  url: "https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf",
  name: 'Municipios',
  layers: 'municipio',
  visibility: true,
  extract: false,
  attribution: {
        name: "Municipios:",
        description: "<a style='color: #0000FF' href='https://www.ign.es/web/ign/portal' target='_blank'>Instituto Geográfico Nacional</a>"
      }
});

mapajs.addLayers(capaMVT_Municipios);

const capa1 = new IDEE.layer.GeoJSON({
  source:{},
  attribution: {
        name: "Paro:",
        description: "<a style='color: #0000FF' href='https://www.sepe.es/HomeSepe/es/' target='_blank'>SEPE</a>"
      }
});
mapajs.addLayers(capa1);

const capa2 = new IDEE.layer.GeoJSON({
  source:{},
  attribution: {
        name: "Población:",
        description: "<a style='color: #0000FF' href='https://www.ine.es/' target='_blank'>INE</a>"
      }
});
mapajs.addLayers(capa2);

CSV = myFunction_CSV()
CSV.then((data) => {

  capaMVT_Municipios.on(IDEE.evt.SELECT_FEATURES, (features, m) => {
    codMuni = features[0].getAttributes().nationalcode.slice(-5)
    filtrado = data.filter(obj => obj["Codigo Municipio"] === codMuni)

    const escape = (s) => String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const filas = Object.entries(filtrado[0])
      .map(([k, v], i) => {

        if (k == "Total") {
          k = "Población Total"
        } else if (k == "Sexo") {
          k = "Población Sexo"
        } else if (k == "Periodo") {
          k = "Población Periodo"
        }

        return `
    <tr style="background:${i % 2 ? '#f7f7f7' : 'white'};">
      <th style="text-align:left; padding:8px 12px; border-bottom:1px solid #ddd;">
        ${escape(k)}
      </th>
      <td style="padding:8px 12px; border-bottom:1px solid #ddd;">
        ${escape(v)}
      </td>
    </tr>
  `})
      .join("");


    const featureTabOpts = {
      icon: 'g-cartografia-pin',
      title: 'Paro por Municipios',
      content: `
      <table style="border:1px solid #ccc; border-radius:6px; max-height:250px; width:100%; border-collapse:collapse; font-family:Arial,sans-serif; font-size:14px;">
        <thead>
          <tr>
            <th
              style="
                background:#e9e9e9;
                padding:10px 12px;
                text-align:left;
                border-bottom:1px solid #ccc;
                position:sticky;
                top:0;
                z-index:10;
              "
            >
              Propiedad
            </th>
            <th
              style="
                background:#e9e9e9;
                padding:10px 12px;
                text-align:left;
                border-bottom:1px solid #ccc;
                position:sticky;
                top:0;
                z-index:10;
              "
            >
              Valor
            </th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>

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
      porcParo = element["porcParo"]

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

  let estilo_Municipios = new IDEE.style.Polygon({
    fill: {
      color: (feature) => {
        codMuni = feature.getAttributes().nationalcode.slice(-5)

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
  SVGCarga.hidden = true



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

    // https://datos.gob.es/es/catalogo/ea0041513-paro-registrado-por-municipios
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
            const bytes = new Uint8Array([...res.text].map(ch => ch.charCodeAt(0)));
            text = new TextDecoder('utf-8').decode(bytes);
            const data = csvToJson(text, id = false, headerRow = 1);
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

  const propsAEliminar = ["mes", "Paro mujer edad >=45", "Paro mujer edad < 25", "Paro mujer edad 25 -45",
    "Paro hombre edad >=45", "Paro hombre edad < 25", "Paro hombre edad 25 -45",
    "Paro Sin empleo Anterior", , , ,];
  dataParoFiltrado.forEach(obj => {
    propsAEliminar.forEach(p => delete obj[p]);
  });



  const myPromise_poblo_prov = new Promise(function (resolve, reject) {
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

        if (data.length === 0) {
          // Si da problemas de CORS, activar extensión y pillar el array de data.
          data = [
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2855.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2856.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2857.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2854.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2886.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2858.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2859.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2860.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2861.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2905.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2862.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2863.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2864.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2893.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2865.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2866.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2901.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2868.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2869.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2873.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2870.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2871.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2872.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2874.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2875.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2876.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2877.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2878.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2880.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2881.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2882.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2883.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2884.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2885.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2888.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2889.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2890.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2879.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2891.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2892.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2894.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2895.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2896.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2900.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2899.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2902.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2903.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2904.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2906.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2907.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2908.csv?nocab=1",
            "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/2909.csv?nocab=1"
          ]
        }
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
    dataPoblacionFiltrado = csv.filter(obj => obj["Periodo"] === `${añoCSV - 1}`).filter(obj => obj["Sexo"] === `Total`)
  }

  const byIdA = new Map(dataParoFiltrado.map(o => [o["Codigo Municipio"], o]));
  for (const objB of dataPoblacionFiltrado) {
    const objA = byIdA.get(objB["Municipios"].split(" ")[0]);
    if (objA) {
      Object.assign(objB, objA); // añade/actualiza propiedades en B
    }
  }


  const CSV = dataPoblacionFiltrado.map(obj => {

    totalPobl = obj["Total"].replaceAll(".", "")
    try {
      totalParo = obj["total Paro Registrado"].replace("<", "")
    } catch {
      totalParo = 0
    }
    porcParo = Number(totalParo) / Number(totalPobl) * 100
    porParo = porcParo.toFixed(2)


    return { porcParo, ...obj };
  });

  if (!dataParoFiltrado[0]["C�digo mes"]) {
    IDEE.toast.error('Error al obtener los datos del paro', null, 8000);
    console.error('------ 0 ---------- : Error paro')
  }
  if (!dataPoblacionFiltrado[0]["Sexo"]) {
    IDEE.toast.error('Error al obtener los datos de población', null, 8000);
    console.error('------ 1 ---------- : Error población')
  }

  return CSV
}
