/*
 * paroEspMun: coropleta de paro municipal.
 *
 * NOTAS DE DATOS (medido, para no volver a tropezar)
 *
 * - El CSV del SEPE está en LATIN-1. `M.remote.get` devuelve solo `res.text`, ya
 *   decodificado como UTF-8, e ignora `responseType` (medido: sus claves son
 *   `text`, `xml`, `headers`, `error`, `code`). Los acentos llegaban rotos,
 *   "C?digo mes". No se puede arreglar del texto roto porque los bytes originales
 *   ya no están, así que ese CSV se baja con `fetch()` y se decodifica el
 *   `ArrayBuffer` en Latin-1 por trozos de 8 KB. Los CSV de población (INE) sí
 *   siguen con `M.remote.get`: vienen en UTF-8 y no tienen el problema.
 *
 * - El CSV trae la fila de cabecera también como dato. Al ordenar los valores
 *   como cadenas esa cabecera ganaba (empieza por C) y el filtro se quedaba con
 *   una fila de basura; el año salía `undefined` y el filtro de la población,
 *   que compara contra ese año, se caía también. Por eso los periodos se eligen
 *   por forma (/^\d{6}$/) y el periodo de la población se saca de los propios
 *   datos.
 *
 * - De las filas del CSV, 52 tienen códigos de 2 dígitos del INE: son agregados
 *   ("Sin_distribuir"), no municipios, y por eso no tienen correspondencia en el
 *   MVT. Al revés, las entidades del MVT sin fila en el CSV son 84 de 9 199 y
 *   todas tienen código 53xxx, o sea mancomunidades y entidades singulares, que
 *   el INE no publica como municipios.
 *
 * - El `nationalcode` del MVT mide siempre 11 caracteres ('34' + '07' + '37354'),
 *   y el código municipal son los 5 últimos. Por eso `slice(-5)` siempre acierta.
 *
 * - El MVT en 3D lo lleva `ext/MVTLayer`, que tiene su propia cabecera con el
 *   diagnóstico de por qué hace falta una fachada propia y qué queda por hacer.
 */

const SVGCarga = document.getElementById("cargaSVG")
// window.onload = (event) => {
//   SVGCarga.hidden = true
// };

/**
 * Color de cada municipio a partir del CSV del SEPE: clave = código municipal de
 * 5 cifras, valor = color del ramp. Lo usan las dos implementaciones: en 2D lo
 * mete el `IDEE.style.Polygon` y en 3D lo lee `ext/MVTLayer` al construir las
 * primitivas, así que el ramp es el mismo en los dos.
 *
 * Los municipios que no están en el CSV salen en gris (COLOR_SIN_DATO en el
 * plugin). Medido: son 84 de 9 199 y todos tienen código 53xxx, o sea
 * mancomunidades y entidades singulares, que el INE no publica como municipios.
 * @param {Array} data Filas ya transformadas por myFunction_CSV.
 * @returns {Object} {"28092": "rgba(253, 169, 42, 0.75)", ...}
 */
function crearColorPorCodigo(data) {
  const colorPorCodigo = {};
  for (const fila of data) {
    const codigo = String(fila["Municipios"]).split(" ")[0];
    const porcParo = fila["porcParo"];
    let color;
    if (porcParo < 1.5) {
      color = "rgba(202, 247, 170, 0.75)";
    } else if (porcParo < 3) {
      color = "rgba(126, 247, 45, 0.75)";
    } else if (porcParo < 5) {
      color = "rgba(215, 253, 42, 0.75)";
    } else if (porcParo < 8) {
      color = "rgba(253, 221, 42, 0.75)";
    } else if (porcParo < 15) {
      color = "rgba(253, 169, 42, 0.75)";
    } else {
      color = "rgba(253, 74, 42, 0.75)";
    }
    colorPorCodigo[codigo] = color;
  }
  return colorPorCodigo;
}


function mapa() {

  updateConfigBaseLayer()

  mapajs = IDEE.map({
    container: "mapa",
    center: { x: -512140.0194987538, y: 4552625.8998558065 },
    // Los créditos no se piden como control: los pone ext/attribution, que es
    // como lo hacen los demás visualizadores y además sobrevive al cambio de
    // implementación (el control de la API solo es de 2D).
    controls: [],
    zoom: 5
  });

  // Autor del visualizador, como el resto de visualizadores: boton en el rail y
  // barra de creditos abajo, con lo que declaren las capas (SEPE, INE, IGN).
  const ext_Attribution = new IDEE.plugin.miPlugin_attribution({
    position: 'BR',
    mode: 'lite',
    attributions: [{
      name: 'Autor:',
      description: " <a style='color: #0000FF' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
    }]
  });
  mapajs.addPlugin(ext_Attribution);

  // ext/upgradeLibs ya NO se usa aqui. Se cargo hasta que se vio que sobra:
  // la API-CNIG ya trae OpenLayers 10.7.0 en su bundle (su package.json lo fija),
  // asi que no aporta una version mas nueva; y su Cesium 1.145 estorba, porque
  // construir con esa copia objetos que van a la escena de la API falla. Para el
  // 3D se usa window.Cesium, la de la API. Ver notas en
  // .opencode/docs/paroEspMun-3D-vectorTile.md.

  mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: 'cambiar impl :)',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: false
  }));
  mapajs.addPlugin(new IDEE.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());

  // Da soporte 3D a IDEE.layer.MVT. En 2D no hace nada (la API ya trae esa
  // implementación); en 3D registra la de Cesium, que es la que falta.
  mapajs.addPlugin(new IDEE.plugin.miPlugin_MVTLayer());

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  const capa1 = new IDEE.layer.GeoJSON({
    source: {},
    attribution: {
      name: "Paro:",
      description: "<a style='color: #0000FF' href='https://www.sepe.es/HomeSepe/es/' target='_blank'>SEPE</a>"
    }
  });
  mapajs.addLayers(capa1);

  const capa2 = new IDEE.layer.GeoJSON({
    source: {},
    attribution: {
      name: "Población:",
      description: "<a style='color: #0000FF' href='https://www.ine.es/' target='_blank'>INE</a>"
    }
  });
  mapajs.addLayers(capa2);

  // UNA SOLA CAPA PARA 2D Y 3D.
  //
  // IDEE.layer.MVT ya existe en la API. En 2D la implementa OpenLayers; en 3D la
  // implementa ext/MVTLayer, que se registra justo antes. Por eso aqui no hay
  // ningun `if (es3D)` para la capa: solo cambia como se le da el color y como
  // se escucha el click, que es donde las dos implementaciones no coinciden.
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

  CSV.then((data) => {
    // El color de cada municipio, el mismo ramp en las dos implementaciones.
    const colorPorCodigo = window.crearColorPorCodigo(data);

    // El click es IGUAL en las dos implementaciones: el evento SELECT_FEATURES
    // llega con `features[0].getAttributes().nationalcode` y `coord`, tanto si
    // lo ha emitido OpenLayers (2D) como ext/MVTLayer (3D, que dispara el evento
    // a mano porque la API no llega a detectar el click en Cesium).
    const alSeleccionar = (features, m) => {
      // La API dispara SELECT_FEATURES también cuando el click NO ha caído sobre
      // nada, y entonces llega con la lista vacía de verdad (medido: el gestor de
      // selección compara `seleccionado[0] === clicked[0]` y con los dos a
      // `undefined` da "son el mismo municipio", así que entra por ahí). Sin esta
      // comprobación, `features[0]` es `undefined` y revienta el oyente.
      if (!features || !features.length || !features[0]) return;
      const codMuni = features[0].getAttributes().nationalcode.slice(-5);
      const filtrado = data.filter(obj => obj["Codigo Municipio"] === codMuni);
      if (!filtrado.length) return;
      mostrarPopupParo(filtrado[0], m.coord);
    };

    if (!es3D) {
      // 2D: el estilo es un IDEE.style.Polygon con función.
      capaMVT_Municipios.on(IDEE.evt.SELECT_FEATURES, alSeleccionar);

      capaMVT_Municipios.setStyle(new IDEE.style.Polygon({
        fill: {
          color: (feature) => {
            try {
              return colorPorCodigo[feature.getAttributes().nationalcode.slice(-5)];
            } catch {
              // Sin fila en el CSV: en la practica son mancomunidades (53xxx),
              // que no son municipios. Ver COLOR_SIN_DATO en ext/MVTLayer.
              return "rgba(150, 150, 150, 1)";
            }
          },
        },
        stroke: { color: 'grey', width: 1 },
      }));
    } else {
      // 3D: la capa se crea con la misma definición que en 2D porque ext/MVTLayer
      // registra una fachada propia de `IDEE.layer.MVT` (ver la cabecera del
      // plugin: el bundle de Cesium deja su implementación como un módulo
      // vacío, así que no había nada que registrar).
      //
      // El color se lo da el lector de ext/MVTLayer, que rasteriza la tesela a
      // canvas para dejarla drapeada sobre el MDT. Con `cargar(z, x, y)` se
      // sigue teniendo acceso a la lectura desde la consola.
      capaMVT_Municipios.on(IDEE.evt.SELECT_FEATURES, alSeleccionar);

      const impl = capaMVT_Municipios.impl_;
      if (impl && typeof impl.setColorFunction === 'function') {
        impl.setColorFunction((codigo) => colorPorCodigo[codigo]);
      }
    }

    SVGCarga.hidden = true;
  });

  return mapajs;
}

/**
 * Muestra el popup con los datos de paro de un municipio. Lo usan tanto el
 * click en 2D como el de 3D, para que la tabla sea la misma.
 * @param {Object} fila Fila del CSV del municipio.
 * @param {Array} [coord] [lon, lat] donde ponerlo.
 */
function mostrarPopupParo(fila, coord) {
  if (!fila) return;

  const escape = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const filas = Object.entries(fila)
    .map(([k, v], i) => {
      if (k === "Total") k = "Población Total";
      else if (k === "Sexo") k = "Población Sexo";
      else if (k === "Periodo") k = "Población Periodo";

      return `
        <tr style="background:${i % 2 ? '#f7f7f7' : 'white'};">
          <th style="text-align:left; padding:8px 12px; border-bottom:1px solid #ddd;">
            ${escape(k)}
          </th>
          <td style="padding:8px 12px; border-bottom:1px solid #ddd;">
            ${escape(v)}
          </td>
        </tr>`;
    }).join("");

  const featureTabOpts = {
    icon: 'g-cartografia-pin',
    title: 'Paro por Municipios',
    content: `
      <table style="border:1px solid #ccc; border-radius:6px; max-height:250px; width:100%; border-collapse:collapse; font-family:Arial,sans-serif; font-size:14px;">
        <thead>
          <tr>
            <th style="background:#e9e9e9; padding:10px 12px; text-align:left; border-bottom:1px solid #ccc; position:sticky; top:0; z-index:10;">
              Propiedad
            </th>
            <th style="background:#e9e9e9; padding:10px 12px; text-align:left; border-bottom:1px solid #ccc; position:sticky; top:0; z-index:10;">
              Valor
            </th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>`
  };

  const popup = new IDEE.Popup();
  popup.addTab(featureTabOpts);

  if (Array.isArray(coord)) {
    mapajs.addPopup(popup, coord);
  } else {
    // Sin coordenadas: se abre centrado en la vista.
    mapajs.addPopup(popup);
  }
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

const CSV = myFunction_CSV();
CSV.catch(function (err) {
  console.error('No se pudieron obtener los datos del paro:', err);
  IDEE.toast.error('No se pudieron obtener los datos del SEPE. Prueba desde la versión publicada en GitHub Pages.', null, 10000);
  SVGCarga.hidden = true;
});

mapa();

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
    // Intenta descargar el CSV de paro; si falla o el contenido no es
    // un CSV válido del SEPE, prueba con el año anterior.
    function _esCsvParo(data) {
      return data.length > 0 &&
        Object.keys(data[0]).some(function (k) { return /c.digo\s*mes/i.test(k); });
    }
    function _parsearParo(res) {
      // El CSV del SEPE está en Latin-1. Decodificado como UTF-8 (que es lo que
      // hace M.remote.get) los acentos salen rotos: "C�digo mes" en vez de
      // "Código mes". No se arregla desde el texto roto, porque los bytes
      // originales ya no están: hay que decodificar el buffer en Latin-1.
      var texto = _latin1DesdeBuffer(res.buffer);
      if (!texto) throw new Error('no se ha podido leer el CSV del SEPE');
      return csvToJson(texto, id = false, headerRow = 1);
    }
    // Decodifica un ArrayBuffer como Latin-1 (ISO-8859-1).
    function _latin1DesdeBuffer(buffer) {
      if (!buffer || !buffer.byteLength) return null;
      var bytes = new Uint8Array(buffer);
      var texto = '';
      // Por trozos: el CSV del SEPE son varios MB y no entra cómodo en un
      // apply() con miles de argumentos.
      for (var i = 0; i < bytes.length; i += 8192) {
        texto += String.fromCharCode.apply(
          null, bytes.subarray(i, Math.min(i + 8192, bytes.length)));
      }
      return texto;
    }

    // Se baja con fetch() y no con M.remote.get porque este ultimo solo
    // devuelve res.text, ya decodificado como UTF-8, e ignora el responseType
    // (medido: las claves de la respuesta son text, xml, headers, error, code).
    // Con los bytes si se puede decodificar en Latin-1, que es la codificacion
    // real del CSV del SEPE.
    function _bajarCsv(url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer().then(function (buffer) {
          return { buffer: buffer };
        });
      });
    }

    _bajarCsv(urlParo).then(function (res) {
      try {
        var data = _parsearParo(res);
        if (_esCsvParo(data)) { resolve(data); return; }
      } catch (_) { /* cae al fallback */ }

      // Fallback: año anterior
      _bajarCsv(urlParo_1).then(function (res2) {
        try {
          var data2 = _parsearParo(res2);
          if (_esCsvParo(data2)) { resolve(data2); return; }
          reject(new Error('CSV del SEPE no contiene columna de mes'));
        } catch (e) { reject(e); }
      }).catch(function (err) { reject(err); });

    }).catch(function () {
      // M.remote.get rechazó (red caída, etc.): intentar año anterior
      _bajarCsv(urlParo_1).then(function (res2) {
        try {
          var data2 = _parsearParo(res2);
          if (_esCsvParo(data2)) { resolve(data2); return; }
          reject(new Error('CSV del SEPE no contiene columna de mes'));
        } catch (e) { reject(e); }
      }).catch(function (err) { reject(err); });
    })
  });

  dataParo = await myPromise_1_CSV;

  // Detectar la clave de mes: puede ser "Código mes", "Codigo mes" o
  // la variante corrupta con U+FFFD, según la codificación del CSV.
  const keyCodMes = dataParo.length > 0
    ? Object.keys(dataParo[0]).find(k => /c.digo\s*mes/i.test(k)) || "Codigo mes"
    : "Codigo mes";

  // Buscar el último mes con datos disponible en el CSV (el SEPE
  // publica con retraso variable, no podemos asumir mes-1).
  // Solo los periodos de verdad: seis digitos, AAAAMM. hace falta porque el
  // conversor mete la fila de cabecera tambien como dato, y al ordenar las
  // cadenas ese valor ("Código mes", que empieza por C) se queda el ultimo:
  // era el que se elegia, de modo que el filtro se quedaba con una sola fila,
  // el año salia undefined y de ahi que no llegaran ni el color ni el aviso
  // (medido: 65.081 filas y nueve valores distintos en esa columna, uno de
  // ellos la cabecera con una fila).
  const esPeriodo = function (v) {
    return typeof v === 'string' && /^\d{6}$/.test(v.trim());
  };
  const mesesDisponibles = [...new Set(
    dataParo.map(obj => obj[keyCodMes]).filter(esPeriodo)
  )].sort();
  const ultimoMes = mesesDisponibles.length > 0
    ? mesesDisponibles[mesesDisponibles.length - 1]
    : null;

  if (ultimoMes) {
    añoCSV = parseInt(ultimoMes.slice(0, 4), 10);
    mesCSV = parseInt(ultimoMes.slice(4), 10);
  }

  dataParoFiltrado = ultimoMes
    ? dataParo.filter(obj => obj[keyCodMes] === ultimoMes)
    : [];

  const propsAEliminar = ["Paro mujer edad >=45", "Paro mujer edad < 25", "Paro mujer edad 25 -45",
    "Paro hombre edad >=45", "Paro hombre edad < 25", "Paro hombre edad 25 -45",
    "Paro Sin empleo Anterior", , , ,];
  dataParoFiltrado.forEach(obj => {
    propsAEliminar.forEach(p => delete obj[p]);
  });


  // URLs de población por provincia (fallback si CORS bloquea el índice del INE).
  const CSV_POBLACION_FALLBACK = [
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
  ];

  // Descarga y parsea un array de URLs CSV de población del INE.
  async function _descargarPoblacion(urls) {
    var dataPobl = [];
    await Promise.all(
      urls.map(async function (provUrl) {
        var r = await M.remote.get(provUrl);
        var csv = csvToJson(r.text, false, 0);
        dataPobl.push(...csv);
      })
    );
    return dataPobl;
  }

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
            const abs = new URL(href, BASE);
            const t = abs.searchParams.get('t');
            return t;
          } catch {
            return null;
          }
        }).filter(Boolean);

        // Construir la URL final CSV
        const csvUrls = ids.map(id => new URL(`/jaxiT3/files/t/es/csv_bdsc/${id}.csv?nocab=1`, BASE).href);
        var data = [...new Set(csvUrls)];
        if (data.length === 0) data = CSV_POBLACION_FALLBACK;

        resolve(await _descargarPoblacion(data));
      } catch (e) {
        reject(e);
      }
    }).catch(async function () {
      // CORS bloquea el índice del INE: usar URLs hardcodeadas directamente.
      try {
        resolve(await _descargarPoblacion(CSV_POBLACION_FALLBACK));
      } catch (e) {
        reject(e);
      }
    });
  });
  dataPoblacion = await myPromise_poblo_prov;

  // El periodo de la poblacion se saca de los propios datos y no del ano del
  // paro. Antes se comparaba con `añoCSV`, asi que si el paro venia mal la
  // poblacion se quedaba vacia aunque estuviera descargada y entera: 736.920
  // filas que se quedaban en cero y el aviso decia que faltaba la poblacion, que no
  // era verdad (medido).
  const periodosPoblacion = [...new Set(
    dataPoblacion.map(obj => String(obj["Periodo"]).trim()).filter(Boolean)
  )].sort();
  const periodoPoblacion = periodosPoblacion.length > 0
    ? periodosPoblacion[periodosPoblacion.length - 1]
    : '';
  dataPoblacionFiltrado = periodoPoblacion
    ? dataPoblacion.filter(obj => String(obj["Periodo"]).trim() === periodoPoblacion)
      .filter(obj => obj["Sexo"] === `Total`)
    : [];


  const myPromise_poblo_TOTAL = new Promise(function (resolve, reject) {
    const urlPoblacion = `https://servicios.ine.es/wstempus/js/es/DATOS_TABLA/56935?tip=AM&`;
    M.remote.get(urlPoblacion).then(async function (res) {
      try {
        dataPoblEsp = JSON.parse(res.text)[0]["Data"][0]["Valor"] 
        resolve(dataPoblEsp);
      } catch (e) {
        reject(e);
      } finally {
        //
      }
    }).catch(err => {
      reject(err);
    });
  });
  dataPoblacionEsp = await myPromise_poblo_TOTAL;
  console.log(dataPoblacionEsp)


    const myPromise_poblo_activa = new Promise(function (resolve, reject) {
    const urlPoblacion = `https://servicios.ine.es/wstempus/jsCache/es/DATOS_TABLA/65949?tip=AM&`;
    M.remote.get(urlPoblacion).then(async function (res) {
      try {
        dataPoblEspAct = JSON.parse(res.text)[0]["Data"][0]["Valor"] *1000
        resolve(dataPoblEspAct);
      } catch (e) {
        reject(e);
      } finally {
        //
      }
    }).catch(err => {
      reject(err);
    });
  });
  dataPoblacionEspActiva = await myPromise_poblo_activa;
  console.log(dataPoblacionEspActiva)

  const porcPobAct = dataPoblacionEspActiva/dataPoblacionEsp







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
    porParo = Number(totalParo) / (Number(totalPobl) * porcPobAct )* 100
    porcParo = Math.trunc(porParo * 100) / 100;

    return { porcParo, ...obj };
  });

  if (!dataParoFiltrado.length || !dataParoFiltrado[0][keyCodMes]) {
    IDEE.toast.error('Error al obtener los datos del paro', null, 8000);
    console.error('------ 0 ---------- : Error paro')
  }
  if (!dataPoblacionFiltrado.length || !dataPoblacionFiltrado[0]["Sexo"]) {
    IDEE.toast.error('Error al obtener los datos de población', null, 8000);
    console.error('------ 1 ---------- : Error población')
  }

  return CSV
}

