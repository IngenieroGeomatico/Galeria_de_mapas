// Plugin Georreferenciador de teselas para API-IDEE.
// Sigue el protocolo de ext_backgorundLayers.js: clase con constructor + getHelp
// + addTo(map) que crea el panel con IDEE.ui.Panel + IDEE.Control + map.addPanels.
// Se instancia con mapajs.addPlugin(new miPlugin_georrefTeselas()).
//
// El objeto global de la API puede llamarse IDEE (builds api-idee) o M (builds
// api-core). Elegimos el que tenga la API REALMENTE cargada (con .ui/.map): el
// bloque de exposición de este mismo archivo crea un window.IDEE vacío como
// namespace de plugins, así que no basta con comprobar que IDEE exista.
function api_georrefTeselas() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

const valueOri_georrefTeselas = "-- Seleccione un tipo de malla --";

// ===================================================================
//  Carga bajo demanda de h3-js (solo para el modo H3)
//  --------------------------------------------------------------------
//  El georreferenciador de teselas solo necesita h3-js cuando se georreferencia
//  una tesela H3 (h3ToGeoJSON usa la global `h3`). En vez de cargar h3 por
//  <script> en el index.html, se inyecta bajo demanda desde aquí la primera vez
//  que se usa el modo H3. La carga se cachea en window.__georrefH3Promise para no
//  reinyectar. Se usa la build UMD (expone window.h3). TMS/XYZ no cargan nada.
// ===================================================================
const H3_CDN_URL_GT = "https://cdn.jsdelivr.net/npm/h3-js@4/dist/h3-js.umd.js";
function ensureH3_georrefTeselas() {
  if (typeof window.h3 !== "undefined") return Promise.resolve(window.h3);
  if (window.__georrefH3Promise) return window.__georrefH3Promise;
  window.__georrefH3Promise = new Promise(function (resolve, reject) {
    var existing = document.querySelector('script[data-lib="gt-h3"]');
    var script = existing || document.createElement("script");
    var onOk = function () {
      if (typeof window.h3 !== "undefined") resolve(window.h3);
      else reject(new Error("h3-js cargó pero no expuso window.h3"));
    };
    var onErr = function () { window.__georrefH3Promise = null; reject(new Error("No se pudo cargar h3-js")); };
    script.addEventListener("load", onOk);
    script.addEventListener("error", onErr);
    if (!existing) {
      script.src = H3_CDN_URL_GT;
      script.async = true;
      script.setAttribute("data-lib", "gt-h3");
      document.head.appendChild(script);
    }
  });
  return window.__georrefH3Promise;
}

class miPlugin_georrefTeselas {
  constructor(options = {}) {
    this.name = 'miPlugin_georrefTeselas';
    this.options = options || {};
    this.map = null;
    // Colores configurables. Cada uno puede ser un color (string) o un
    // objeto {active, deactive}:
    //   color1 = fondo, color2 = borde (botón+panel), color3 = icono/flecha.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
  }

  // Devuelve {active, deactive} a partir de un color simple o un objeto.
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
  }

  getHelp() {
    const IDEE = api_georrefTeselas();
    return {
      title: 'Georreferenciar teselas',
      content: new Promise((success) => {
        let html = '<div><p>Georreferencia teselas TMS, XYZ o H3 sobre el mapa a ' +
          'partir de sus índices.</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;
    const IDEE = api_georrefTeselas();

    const panelExtra = new IDEE.ui.Panel('toolsExtra_georrefTeselas', {
      collapsible: true,
      collapsed: false,
      className: 'g-herramienta',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    const htmlPanel = `
      <div aria-label="Georreferenciar teselas" role="menuitem" id="div-contenedor-herramienta-georrefTeselas" class="m-control m-container m-herramienta">
          <header
              role="heading"
              tabindex="0"
              id="m-herramienta-title-georrefTeselas"
              class="m-herramienta-header">
                Georreferenciar Teselas
          </header>
          <section id="m-herramienta-previews-georrefTeselas" class="m-herramienta-previews"></section>
          <div id="m-herramienta-contents-georrefTeselas"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlGeorrefTeselas');
    control.createView = () => document.createElement('div');

    panelExtra.addControls(control);
    map.addPanels(panelExtra);

    // Aplicar colores configurables (color1=fondo, color2=borde, color3=icono)
    // al panel. Se inyectan 6 variables CSS (estado normal y ".opened/active").
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const grEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta');
    if (grEl) {
      grEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      grEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      grEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      grEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      grEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      grEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

    document.querySelector('.g-herramienta .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents-georrefTeselas').appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-georrefTeselas');

    control.activate = () => { };
    control.deactivate = () => { };

    const htmlControl = `
        <h4> Selector de malla: </h4>
        <div id="selectorWrapperID">
        <select class="seleccionCapasClass" id="seleccionCapasID" name="seleccionCapas">
            <option value="TMS">TMS</option>
            <option value="XYZ">XYZ</option>
            <option value="H3">H3</option>
        </select>
         <h4> Selección de tesela</h4>
         <div id="teselaWrapperID">
         </div>
        <div style="text-align: center;margin: 10px;">
            <button id="botonCalcular" type="button">Georreferenciar</button>
        </div>
    `;

    map.on(IDEE.evt.COMPLETED, () => {
      // Guarda la selección actual antes de sobrescribir el HTML
      let selectedValue = "TMS";
      const selectorOld = document.getElementById('seleccionCapasID');
      if (selectorOld) {
        selectedValue = selectorOld.value;
      }

      document.querySelector('#m-herramienta-contents-georrefTeselas').innerHTML = htmlControl;

      const selector = document.querySelector('.seleccionCapasClass');
      const teselaWrapper = document.getElementById('teselaWrapperID');
      if (selector && teselaWrapper) {
        // Restaura la selección previa
        selector.value = selectedValue;

        selector.addEventListener('change', function (e) {
          switch (e.target.value) {
            case 'TMS':
              teselaWrapper.innerHTML = ` <div>
                                              <label style="font-size: large; display: block;">{z} :  <input id="TMS_z" type="text" placeholder="valor z de la tesela" style="width:auto;"></label>
                                              <label style="font-size: large; display: block;">{x} :  <input id="TMS_x" type="text" placeholder="valor x de la tesela" style="width:auto;"></label>
                                              <label style="font-size: large; display: block;">{-y}: <input id="TMS_y" type="text" placeholder="valor -y de la tesela" style="width:auto;"></label>
                                          </div>`;
              break;
            case 'XYZ':
              teselaWrapper.innerHTML = ` <div>
                                              <label style="font-size: large; display: block;">{z}: <input id="XYZ_z" type="text" placeholder="valor z de la tesela" style="width:auto;"></label>
                                              <label style="font-size: large; display: block;">{x}: <input id="XYZ_x" type="text" placeholder="valor x de la tesela" style="width:auto;"></label>
                                              <label style="font-size: large; display: block;">{y}: <input id="XYZ_y" type="text" placeholder="valor y de la tesela" style="width:auto;"></label>
                                          </div>`;
              break;
            case 'H3':
              teselaWrapper.innerHTML = '<label style="font-size: large; display: block;">H3: <input id="H3_id" type="text" placeholder="ID de la tesela H3" style="width:auto;"></label>';
              break;
            default:
              teselaWrapper.innerHTML = '';
          }
        });
        // Trigger para valor inicial (con la selección restaurada)
        selector.dispatchEvent(new Event('change'));
      }

      document.getElementById('botonCalcular').addEventListener('click', () => this.myFunctionGetGrid());
    });
  }

  async myFunctionGetGrid() {
    const map = this.map;
    const IDEE = api_georrefTeselas();
    let gjson;
    const gridType = document.getElementById("seleccionCapasID").value;
    switch (gridType) {
      case 'TMS': {
        const z = parseInt(document.getElementById("TMS_z").value);
        const x = parseInt(document.getElementById("TMS_x").value);
        const y = parseInt(document.getElementById("TMS_y").value);
        gjson = tmsTileToGeoJSON(z, x, y);
        break;
      }
      case 'XYZ': {
        const z = parseInt(document.getElementById("XYZ_z").value);
        const x = parseInt(document.getElementById("XYZ_x").value);
        const y = parseInt(document.getElementById("XYZ_y").value);
        gjson = xyzTileToGeoJSON(z, x, y);
        break;
      }
      case 'H3': {
        // h3-js se carga bajo demanda solo para el modo H3 (h3ToGeoJSON usa la
        // global `h3`). Si falla la red, avisa y aborta.
        try {
          await ensureH3_georrefTeselas();
        } catch (e) {
          IDEE.toast.error('No se pudo cargar la librería h3-js.', null, 3000);
          return;
        }
        const h3Index = document.getElementById("H3_id").value;
        gjson = h3ToGeoJSON(h3Index);
        break;
      }
      default:
        break;
    }
    const layer = new IDEE.layer.GeoJSON({
      source: gjson,
      extract: true,
    });
    const estilo = new IDEE.style.Generic({
      polygon: {
        fill: {
          color: 'red',
          opacity: 0.2,
        },
        stroke: {
          color: 'orange',
          width: 4
        },
        label: {
          // Texto etiqueta. fijo|función|atributo
          text: '{{label}}',
          scale: 5,
          color: 'white',
          align: IDEE.style.align.CENTER,
          baseline: IDEE.style.baseline.MIDDLE,
        }
      }
    });

    layer.setStyle(estilo);

    map.addLayers(layer);

    layer.on(IDEE.evt.LOAD, () => {
      map.setBbox(layer.getFeaturesExtent());
    });

    return;
  }
}

// Exponer la clase en el namespace IDEE.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_georrefTeselas = miPlugin_georrefTeselas;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_georrefTeselas = miPlugin_georrefTeselas;
}
