// Plugins de Calidad del Aire (tiempo real) para API-IDEE.
// Siguen el protocolo de ext_backgorundLayers.js: clases con constructor +
// getHelp + addTo(map). Se instancian con mapajs.addPlugin(new miPlugin_X()).
//
// El objeto global de la API puede llamarse IDEE (builds api-idee) o M (builds
// api-core). Elegimos el que tenga la API REALMENTE cargada (con .ui/.map): el
// bloque de exposición de este mismo archivo crea un window.IDEE vacío como
// namespace de plugins, así que no basta con comprobar que IDEE exista.
function api_calidadAire() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

const valueOri_calidadAire = "-- Seleccione un gas --";

// ===================================================================
//  Carga bajo demanda de las librerías externas (turf + kriging)
//  --------------------------------------------------------------------
//  El plugin de interpolación necesita turf.js (geometría) y kriging.js
//  (interpolación). En vez de cargarlas por <script> en el index.html, se
//  inyectan bajo demanda desde aquí la primera vez que se usan (al pulsar
//  "Calcular"). Cada carga se cachea con una promesa a nivel de window para no
//  reinyectar. Así el plugin es autosuficiente: basta con incluir su .js.
// ===================================================================
const TURF_CDN_URL_CA = "https://cdn.jsdelivr.net/npm/@turf/turf@7.0.0/turf.min.js";
// kriging: NO existe un CDN UMD fiable (el de oeo4b es CommonJS y falla en
// navegador con "module is not defined"). El repo incluye una copia adaptada
// (module.exports comentado) que expone la global `kriging`. Se carga por ruta
// relativa desde este plugin: ext/CalidadAireMadridTiempoReal -> ../../js/kriging.
const KRIGING_URL_CA = "../../js/kriging/kriging.js";

// Inyecta un <script src=url> una sola vez; resuelve cuando globalName existe en
// window. Cachea la promesa en window[cacheKey]. Rechaza en error de red.
function loadScriptOnce_calidadAire(url, globalName, cacheKey, marker) {
  if (typeof window[globalName] !== "undefined") return Promise.resolve(window[globalName]);
  if (window[cacheKey]) return window[cacheKey];
  window[cacheKey] = new Promise(function (resolve, reject) {
    var existing = document.querySelector('script[data-lib="' + marker + '"]');
    var script = existing || document.createElement("script");
    var onOk = function () {
      if (typeof window[globalName] !== "undefined") resolve(window[globalName]);
      else reject(new Error(globalName + " cargó pero no expuso window." + globalName));
    };
    var onErr = function () { window[cacheKey] = null; reject(new Error("No se pudo cargar " + url)); };
    script.addEventListener("load", onOk);
    script.addEventListener("error", onErr);
    if (!existing) {
      script.src = url;
      script.async = true;
      script.setAttribute("data-lib", marker);
      document.head.appendChild(script);
    }
  });
  return window[cacheKey];
}

// Garantiza turf y kriging disponibles (en paralelo). Devuelve una Promise.
function ensureLibs_calidadAire() {
  return Promise.all([
    loadScriptOnce_calidadAire(TURF_CDN_URL_CA, "turf", "__caTurfPromise", "ca-turf"),
    loadScriptOnce_calidadAire(KRIGING_URL_CA, "kriging", "__caKrigingPromise", "ca-kriging")
  ]);
}

// ===================================================================
//  Plugin: Interpolar / extrapolar datos de calidad del aire
//  options: { BBox_Gjson, gridValue, alpha, sigma2 }
// ===================================================================
class miPlugin_calidadAire {
  constructor(options = {}) {
    this.name = 'miPlugin_calidadAire';
    this.options = options || {};
    this.map = null;
    this.panel = null;
    // Parámetros de configuración (antes se asignaban como propiedades sueltas
    // sobre la instancia global del plugin).
    this.BBox_Gjson = this.options.BBox_Gjson;
    this.gridValue = this.options.gridValue;
    this.alpha = this.options.alpha;
    this.sigma2 = this.options.sigma2;
  }

  getHelp() {
    const IDEE = api_calidadAire();
    return {
      title: 'Interpolar/extrapolar datos',
      content: new Promise((success) => {
        let html = '<div><p>Interpola/extrapola por kriging los datos de las ' +
          'estaciones de calidad del aire para el gas seleccionado.</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;
    const IDEE = api_calidadAire();
    const self = this;

    const panelExtra = new IDEE.ui.Panel('toolsExtra_calidadAire', {
      collapsible: true,
      collapsed: false,
      className: 'g-herramienta',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    const htmlPanel = `
      <div aria-label="Interpolar datos" role="menuitem" id="div-contenedor-herramienta-calidadAire" class="m-control m-container m-herramienta">
          <header
              role="heading"
              tabindex="0"
              id="m-herramienta-title-calidadAire"
              class="m-herramienta-header">
                Interpolar/extrapolar datos
          </header>
          <section id="m-herramienta-previews-calidadAire" class="m-herramienta-previews"></section>
          <div id="m-herramienta-contents-calidadAire"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlCalidadAire');
    control.createView = () => document.createElement('div');

    panelExtra.addControls(control);
    this.panel = panelExtra;

    map.addPanels(panelExtra);
    document.querySelector('.g-herramienta .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents-calidadAire').appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-calidadAire');

    control.activate = () => { };
    control.deactivate = () => { };

    const htmlControl = `
        <h4> Selector de capa: </h4>
        <div id="selectorWrapperID">
        <select class="seleccionCapasClass" id="seleccionCapasID" name="seleccionCapas">
            <option value="1">----</option>
            <option value="2">....</option>
        </select>
        </div>
         <button id="botonCalcular" type="button">Calcular</button>
    `;

    map.on(IDEE.evt.COMPLETED, () => {
      (async function checkForIncrease() {
        let flag = true;
        let previousValue = -99;
        while (flag) {
          const currentValue = map.getLayers().length;
          if (currentValue > previousValue) {
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            flag = false;
          }
          previousValue = currentValue;
        }

        const legends = map.getLayers()
          .filter(capa => capa.displayInLayerSwitcher && capa.isBase == false && capa.filterLayer)
          .map(capa => capa.getImpl().legend).reverse();
        const selector = self.panel.getTemplatePanel().querySelector("#seleccionCapasID");
        selector.innerHTML = "";

        let option = document.createElement("option");
        option.text = valueOri_calidadAire;
        option.value = valueOri_calidadAire;
        selector.add(option);
        legends.forEach((element) => {
          if (element == "Municipio Madrid" || element == "Estaciones calidad del aire") {
            // pass
          } else {
            const opt = document.createElement("option");
            opt.text = element;
            opt.value = element;
            selector.add(opt);
          }
        });
      })();

      document.querySelector('#m-herramienta-previews-calidadAire').innerHTML = htmlControl;
      const boton = document.getElementById('botonCalcular');
      if (boton) boton.addEventListener('click', () => self.myFunctionInterpolateExtrapolate());
    });
  }

  async myFunctionInterpolateExtrapolate() {
    const IDEE = api_calidadAire();
    const map = this.map;
    if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = false;

    // Carga bajo demanda de turf + kriging (autosuficiencia del plugin). Si falla
    // la red, avisa y aborta la operación.
    try {
      await ensureLibs_calidadAire();
    } catch (e) {
      IDEE.toast.error('No se pudieron cargar las librerías de cálculo (turf/kriging).', null, 3000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }

    // Espera un ciclo de evento para que el navegador actualice el DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    const selector = this.panel.getTemplatePanel().querySelector("#seleccionCapasID");
    const value = selector.value;
    if (value == valueOri_calidadAire) {
      IDEE.toast.warning('Seleccione una gas para mostrar su información', null, 2000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }
    const capaSeleccionada = map.getLayers().filter(capa => capa.getImpl().legend == value)[0];

    map.getLayers()
      .filter(objeto => objeto.isBase === false)
      .forEach(objeto => objeto.setVisible(false));

    await new Promise(resolve => setTimeout(resolve, 100));
    capaSeleccionada.setVisible(true);

    if (capaSeleccionada.interpolate) {
      IDEE.toast.warning('Ya se ha realizado la interpolación de esta capa', null, 2000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    } else {
      capaSeleccionada.interpolate = true;
    }

    // BBox_Gjson es una ruta "objetoGlobal.propiedad" al FeatureCollection de
    // recorte (mismo formato que antes: se resuelve contra window).
    const Bbox_GJSON = window[this.BBox_Gjson.split('.')[0]][this.BBox_Gjson.split('.')[1]];
    var bbox = turf.bbox(Bbox_GJSON);
    var grid = turf.pointGrid(bbox, this.gridValue);

    var t = [ /* Target variable */];
    var x = [ /* X-axis coordinates */];
    var y = [ /* Y-axis coordinates */];
    let gjsonCapaSeleccionada = capaSeleccionada.toGeoJSON();

    let atributoMagnitud, atributoH_0, atributoV_0, atributoH_1, atributoV_1, atributoH, valorMagnitud;
    try {
      let date = new Date();
      // Convertir la hora actual al huso horario de Madrid y restarle 1 hora
      let options = { timeZone: 'Europe/Madrid' };
      let madridTime = new Date(date.toLocaleString('en-US', options));
      madridTime.setHours(madridTime.getHours());

      let madridTime_1 = new Date(date.toLocaleString('en-US', options));
      madridTime_1.setHours(madridTime.getHours() - 1);

      // Formatear solo los dígitos de la hora sin AM/PM
      let Vs = madridTime.toLocaleTimeString('en-US', { hour: '2-digit', hourCycle: 'h23' });
      let Vs_1 = madridTime_1.toLocaleTimeString('en-US', { hour: '2-digit', hourCycle: 'h23' });
      console.log('La hora en Madrid restándole 1 hora es: ' + Vs);

      if (gjsonCapaSeleccionada.features[0].properties["MAGNITUD"]) {
        atributoMagnitud = "MAGNITUD";
        atributoH_0 = "H" + Vs;
        atributoV_0 = "V" + Vs;
        atributoH_1 = "H" + Vs_1;
        atributoV_1 = "V" + Vs_1;
      } else if (gjsonCapaSeleccionada.features[0].properties["magnitud"]) {
        atributoMagnitud = "magnitud";
        atributoH_0 = "h" + Vs;
        atributoV_0 = "v" + Vs;
        atributoH_1 = "h" + Vs_1;
        atributoV_1 = "v" + Vs_1;
      } else {
        IDEE.toast.error('No existen los suficientes datos para realizar la operaciónatributo magnitud', null, 2000);
        if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
        return;
      }

      valorMagnitud = gjsonCapaSeleccionada.features[0].properties[atributoMagnitud];
    } catch (error) {
      IDEE.toast.error('No existen los suficientes datos para realizar la operación', null, 2000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }

    gjsonCapaSeleccionada.features.forEach(feature => {
      let properties, geometry;
      if (feature.properties[atributoV_0] == 'V' || feature.properties[atributoV_0] == 'T') {
        properties = feature.properties;
        geometry = feature.geometry;
        t.push(parseFloat(properties[atributoH_0].replace(",", ".")));
        x.push(geometry.coordinates[0]); // Longitud
        y.push(geometry.coordinates[1]); // Latitud
        atributoH = atributoH_0;
      } else if (feature.properties[atributoV_1] == 'V' || feature.properties[atributoV_1] == 'T') {
        properties = feature.properties;
        geometry = feature.geometry;
        t.push(parseFloat(properties[atributoH_1].replace(",", ".")));
        x.push(geometry.coordinates[0]); // Longitud
        y.push(geometry.coordinates[1]); // Latitud
        atributoH = atributoH_1;
      } else {
        IDEE.toast.warning('No existen datos validados para la franja horaria actual', null, 2000);
        if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
        atributoH = atributoH_0;
      }

      feature.properties["ultimoValor"] = parseFloat(feature.properties[atributoH].replace(",", "."));
    });

    var model = "exponential";
    var sigma2 = this.sigma2, alpha = this.alpha;
    var variogram;
    try {
      variogram = kriging.train(t, x, y, model, sigma2, alpha);
    } catch (error) {
      IDEE.toast.error('No existen los suficientes datos para realizar la operación o no existen datos para la hora actual', null, 2000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }

    grid.features.forEach(feature => {
      const geometry = feature.geometry;
      const properties = feature.properties;
      var tpredicted = kriging.predict(geometry.coordinates[0], geometry.coordinates[1], variogram);
      properties[atributoH] = tpredicted;
    });

    // limites de cada magnitud
    let gridValues;
    if (valorMagnitud == "1") {
      gridValues = [0, 5, 11, 23, 35, 75, 185, 304, 604, Infinity];
    } else if (valorMagnitud == "6") {
      gridValues = [0, 0.75, 1.46, 2.93, 4.4, 9.4, 12.4, 15.4, 30.4, Infinity];
    } else if (valorMagnitud == "7") {
      gridValues = [0, 3, 6, 12.5, 25, 50, 75, 100, 200, 400, Infinity];
    } else if (valorMagnitud == "8") {
      gridValues = [0, 6, 12.5, 25, 50, 100, 360, 650, 1250, Infinity];
    } else if (valorMagnitud == "9") {
      gridValues = [0, 1, 2.25, 4.5, 9, 35, 55, 125, 225, Infinity];
    } else if (valorMagnitud == "10") {
      gridValues = [0, 6, 12.5, 25, 55, 155, 255, 350, 425, Infinity];
    } else if (valorMagnitud == "12") {
      gridValues = [0, 6, 12.5, 25, 50, 100, 150, 200, 300, Infinity];
    } else if (valorMagnitud == "14") {
      gridValues = [0, 6, 12.5, 25, 50, 70, 80, 100, 200, Infinity];
    } else if (valorMagnitud == "20") {
      gridValues = [0, 10, 25, 100, 400, 1000, 2500, 10000, 20000, Infinity];
    } else if (valorMagnitud == "30") {
      gridValues = [0, 0.10, 0.25, 0.5, 1, 2, 3, 4, 5, Infinity];
    } else if (valorMagnitud == "35") {
      gridValues = [0, 6, 12.5, 25, 50, 100, 200, 500, 1000, Infinity];
    } else if (valorMagnitud == "42") {
      gridValues = [0, 0.4, 0.75, 1.25, 2.5, 5, 10, 20, 50, Infinity];
    } else if (valorMagnitud == "44") {
      gridValues = [0, 0.4, 0.75, 1.25, 2.5, 5, 10, 20, 50, Infinity];
    } else if (valorMagnitud == "431") {
      gridValues = [0, 12.5, 25, 50, 100, 200, 400, 800, 1600, Infinity];
    } else {
      gridValues = [
        0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
        1, 2, 3, 4, 5, 6, 7, 8, 9,
        10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
        150, 200, 250, 300, 350, 400, 450, 500, Infinity
      ];
    }

    let isoband = turf.isobands(
      grid,
      gridValues,
      { zProperty: atributoH }
    );

    isoband.features.forEach(feature => {
      const intersection = turf.intersect(turf.featureCollection([feature, Bbox_GJSON.features[0]]));
      if (intersection) {
        feature.geometry = intersection.geometry;
      }
    });

    gjsonCapaSeleccionada.features.push.apply(gjsonCapaSeleccionada.features, isoband.features);
    capaSeleccionada.clear();
    capaSeleccionada.getImpl().loadFeaturesPromise_ = null;
    capaSeleccionada.setSource(gjsonCapaSeleccionada);
    map.getLayers()
      .filter(objeto => objeto.isBase === false)
      .forEach(objeto => objeto.setVisible(false));

    if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
    await new Promise(resolve => setTimeout(resolve, 100));
    capaSeleccionada.setVisible(true);
  }
}

// ===================================================================
//  Plugin: Leyenda
// ===================================================================
class miPlugin_leyenda {
  constructor(options = {}) {
    this.name = 'miPlugin_leyenda';
    this.options = options || {};
    this.map = null;
    this.panel = null;
  }

  getHelp() {
    const IDEE = api_calidadAire();
    return {
      title: 'Leyenda',
      content: new Promise((success) => {
        let html = '<div><p>Muestra la leyenda de calidad del aire.</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;
    const IDEE = api_calidadAire();

    const panelExtra = new IDEE.ui.Panel('toolsExtra_leyenda', {
      collapsible: true,
      className: 'g-herramienta_leyenda',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.BL,
    });
    this.panel = panelExtra;

    const htmlPanel = `
      <div aria-label="Leyenda" role="menuitem" id="div-contenedor-herramienta-leyenda" class="m-control m-container m-herramienta">
          <header
              role="heading"
              tabindex="0"
              id="m-herramienta-htmlPanel_leyenda"
              class="m-herramienta-header">
                Leyenda
          </header>
          <section id="m-herramienta-htmlPanel_leyenda_preview"></section>
          <div id="m-herramienta-contents_leyenda"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlLeyenda');
    control.createView = () => document.createElement('div');

    panelExtra.addControls(control);
    map.addPanels(panelExtra);
    document.querySelector('.g-herramienta_leyenda .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents_leyenda').appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-htmlPanel_leyenda');

    control.activate = () => { };
    control.deactivate = () => { };

    const htmlControl = `
         <img src="../../img/mapas/leyendaCalidadAire.svg" height="300px">
    `;
    document.querySelector('#m-herramienta-htmlPanel_leyenda_preview').innerHTML = htmlControl;
  }
}

// Exponer las clases en el namespace IDEE.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_calidadAire = miPlugin_calidadAire;
  window.miPlugin_leyenda = miPlugin_leyenda;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_calidadAire = miPlugin_calidadAire;
  window.IDEE.plugin.miPlugin_leyenda = miPlugin_leyenda;
}
