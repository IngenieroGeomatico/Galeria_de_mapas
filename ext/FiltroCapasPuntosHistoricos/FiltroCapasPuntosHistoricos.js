// Plugins de Puntos Históricos de Madrid para API-IDEE.
// Siguen el protocolo de ext_backgorundLayers.js: clases con constructor +
// getHelp + addTo(map) que crean el panel con IDEE.ui.Panel + IDEE.Control +
// map.addPanels. Se instancian con mapajs.addPlugin(new miPlugin_X()).
//
// El objeto global de la API puede llamarse IDEE (builds api-idee) o M (builds
// api-core). Elegimos el que tenga la API REALMENTE cargada (con .ui/.map): el
// bloque de exposición de este mismo archivo crea un window.IDEE vacío como
// namespace de plugins, así que no basta con comprobar que IDEE exista.
function api_filtroCapas() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

const valueOri_filtroCapas = "-- Seleccione una capa para filtrar --";

// ===================================================================
//  Plugin: Filtrar capas de puntos históricos
// ===================================================================
class miPlugin_filtroCapas {
  constructor(options = {}) {
    this.name = 'miPlugin_filtroCapas';
    this.options = options || {};
    this.map = null;
    this.panel = null;
  }

  getHelp() {
    const IDEE = api_filtroCapas();
    return {
      title: 'Filtrar capas',
      content: new Promise((success) => {
        let html = '<div><p>Filtra por texto las capas de puntos de interés ' +
          'histórico de Madrid (placas, monumentos...).</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;
    const IDEE = api_filtroCapas();
    const self = this;

    const panelExtra = new IDEE.ui.Panel('toolsExtra_filtroCapas', {
      collapsible: true,
      collapsed: false,
      className: 'g-herramienta',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    const htmlPanel = `
      <div aria-label="Filtrar capas" role="menuitem" id="div-contenedor-herramienta-filtroCapas" class="m-control m-container m-herramienta">
          <header
              role="heading"
              tabindex="0"
              id="m-herramienta-title-filtroCapas"
              class="m-herramienta-header">
                Filtrar capas
          </header>
          <section id="m-herramienta-previews-filtroCapas" class="m-herramienta-previews"></section>
          <div id="m-herramienta-contents-filtroCapas"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlFiltroCapas');
    control.createView = () => document.createElement('div');

    panelExtra.addControls(control);
    this.panel = panelExtra;

    map.addPanels(panelExtra);
    document.querySelector('.g-herramienta .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents-filtroCapas').appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-filtroCapas');

    control.activate = () => { };
    control.deactivate = () => { };

    const htmlControl = `
        <h4> Selector de capa: </h4>
        <div id="selectorWrapperID">
        <select class="seleccionCapasClass" id="seleccionCapasID" name="seleccionCapas">
            <option value="1">----</option>
            <option value="2">....</option>
        </select>
         <h4> Filtrado de capa por </h4>
         <input type="text" id="nameSearch" name="nameSearch" placeholder="Texto a buscar" required />
        </div>
         <button id="botonCalcular" type="button">Filtrar</button>
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
          .filter(capa => capa.displayInLayerSwitcher && capa.isBase == false && capa.filterID)
          .map(capa => capa.getImpl().legend).reverse();
        const selector = self.panel.getTemplatePanel().querySelector("#seleccionCapasID");
        selector.innerHTML = "";

        let option = document.createElement("option");
        option.text = valueOri_filtroCapas;
        option.value = valueOri_filtroCapas;
        selector.add(option);
        legends.forEach((element) => {
          if (element.includes(' -//- ')) {
            // pass
          } else {
            const opt = document.createElement("option");
            opt.text = element;
            opt.value = element;
            selector.add(opt);
          }
        });
      })();

      document.querySelector('#m-herramienta-previews-filtroCapas').innerHTML = htmlControl;
      const boton = document.getElementById('botonCalcular');
      if (boton) boton.addEventListener('click', () => self.myFunctionFilterLayer());
    });
  }

  async myFunctionFilterLayer() {
    const IDEE = api_filtroCapas();
    const map = this.map;
    if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = false;

    IDEE.toast.warning('Filtrando capa . . .', null, 2000);
    await new Promise(resolve => setTimeout(resolve, 100));

    const selector = this.panel.getTemplatePanel().querySelector("#seleccionCapasID");
    const value = selector.value;
    if (value == valueOri_filtroCapas) {
      IDEE.toast.warning('Seleccione una capa para realizar un filtro', null, 2000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }
    const capaSeleccionada = map.getLayers().filter(capa => capa.getImpl().legend == value)[0];

    // se crea un filtro personalizado
    const textoaBuscar = document.getElementById("nameSearch").value;

    let filter = new IDEE.filter.Function(feature => {
      if (capaSeleccionada.filterID == "Placas Stolpersteine") {
        return feature.getAttribute('nombre_completo').indexOf(textoaBuscar) >= 0;
      } else if (capaSeleccionada.filterID == "Placas conmemorativas") {
        return feature.getAttribute('Comentario').indexOf(textoaBuscar) >= 0;
      } else if (capaSeleccionada.filterID == "Monumentos") {
        return feature.getAttribute('organization')['organization-desc'].indexOf(textoaBuscar) >= 0;
      }
    });

    let Filtrados = filter.execute(capaSeleccionada.getFeatures());
    const capaVectorial = new IDEE.layer.Vector({
      name: capaSeleccionada.legend + ' - ' + textoaBuscar,
      legend: capaSeleccionada.legend + ' - ' + textoaBuscar,
      extract: true,
      attribution: {
        name: capaSeleccionada.legend + " :",
        description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
      }
    });

    map.addLayers(capaVectorial);
    for (const elemento of Filtrados) {
      capaVectorial.addFeatures([elemento]);
    }

    try {
      document.querySelector(`[value="Vector-${capaVectorial.legend}"]`).click();
    } catch (error) {
      console.error(error);
    }

    map.getLayers()
      .filter(objeto => objeto.isBase === false)
      .forEach(objeto => {
        objeto.setVisible(false);
      });

    if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
    capaVectorial.setVisible(true);

    if (typeof ext_LayerSwitcher !== 'undefined' && ext_LayerSwitcher.collapsed == false) {
      while (!`[value="Vector-${capaVectorial.legend}"]`) {
        console.log("Esperando el elemento...");
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        document.querySelector(`[value="Vector-${capaVectorial.legend}"]`).click();
      } catch (error) {
        console.error(error);
      }
    }
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
    const IDEE = api_filtroCapas();
    return {
      title: 'Leyenda',
      content: new Promise((success) => {
        let html = '<div><p>Muestra la leyenda del visor.</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;
    const IDEE = api_filtroCapas();

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
  window.miPlugin_filtroCapas = miPlugin_filtroCapas;
  window.miPlugin_leyenda = miPlugin_leyenda;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_filtroCapas = miPlugin_filtroCapas;
  window.IDEE.plugin.miPlugin_leyenda = miPlugin_leyenda;
}
