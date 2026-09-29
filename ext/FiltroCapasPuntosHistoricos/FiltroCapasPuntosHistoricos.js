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
    // Posición (índice, empezando en 0) del botón del plugin dentro del div
    // de botones (el m-area donde se colocan los paneles). Si se omite o no es
    // un número válido, el botón queda donde lo coloca Mapea por defecto (el
    // orden de addPanels / addPlugin). Ej: order:0 => primer botón del área.
    this.order = (options.order !== undefined) ? Number(options.order) : null;
    this.map = null;
    this.panel = null;
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

  // Lee la leyenda de una capa: primero la del impl y, si no existe, la del objeto capa.
  _capaLegend(capa) {
    let legend = null;
    try { legend = capa.getImpl ? capa.getImpl().legend : null; } catch (e) { legend = null; }
    if (legend === null || legend === undefined) legend = capa.legend || null;
    return legend;
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

    // ── Posicionar el botón del plugin (opción `order`) ────────────────
    if (this.order !== null && !Number.isNaN(this.order)) {
      const panelEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta');
      if (panelEl && panelEl.parentElement) {
        const area = Array.from(panelEl.parentElement.children).some(el => el === panelEl)
          ? panelEl.parentElement
          : panelEl.closest('.m-area');
        if (area) {
          const siblings = Array.from(area.children).filter(el =>
            el.classList && el.classList.contains('m-panel')
          );
          if (siblings.length > 1) {
            const target = Math.max(0, Math.min(this.order, siblings.length - 1));
            const current = siblings.indexOf(panelEl);
            if (current !== target) {
              const ref = (target >= siblings.length)
                ? null
                : siblings[target];
              if (ref && ref !== panelEl) {
                if (target > current) {
                  const next = siblings[target + 1] || null;
                  area.insertBefore(panelEl, next);
                } else {
                  area.insertBefore(panelEl, ref);
                }
              } else if (ref === null) {
                area.appendChild(panelEl);
              }
            }
          }
        }
      }
    }

    // Aplicar colores configurables (color1=fondo, color2=borde, color3=icono)
    // al panel. Se inyectan 6 variables CSS (estado normal y ".opened/active").
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const fcEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta');
    if (fcEl) {
      fcEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      fcEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      fcEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      fcEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      fcEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      fcEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

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

    const previewEl = document.querySelector('#m-herramienta-previews-filtroCapas');
    if (previewEl) {
      previewEl.innerHTML = htmlControl;
    }
    const boton = document.getElementById('botonCalcular');
    if (boton && !boton.dataset.filtroBound) {
      boton.addEventListener('click', () => self.myFunctionFilterLayer());
      boton.dataset.filtroBound = '1';
    }

    if (IDEE && IDEE.evt && IDEE.evt.COMPLETED) {
      map.on(IDEE.evt.COMPLETED, () => {
        self._populateSelector();
      });
    }

    // Repoblar cuando se añada cualquier capa (cubre la carga diferida de los
    // datos remotos y los reinicios sameMap OL<->Cesium donde COMPLETED no
    // vuelve a dispararse). Es idempotente: reescribe las opciones del select.
    if (IDEE && IDEE.evt && IDEE.evt.ADDED_LAYER) {
      map.on(IDEE.evt.ADDED_LAYER, () => {
        self._populateSelector();
      });
    }

    // Poblar de inmediato (el while-loop interno espera la estabilización de capas)
    this._populateSelector();
    // Fallback de seguridad adicional por si las capas se cargan de forma diferida sin evento COMPLETED
    setTimeout(() => {
      self._populateSelector();
    }, 1500);
  }

  // Poblado del selector de capas a partir de las capas presentes en el mapa
  async _populateSelector() {
    // Candado anti-concurrencia: evita que múltiples invocaciones (COMPLETED,
    // ADDED_LAYER, setTimeout) corran en paralelo y dupliquen capas filtradas.
    if (this._populatingSelector) return;
    this._populatingSelector = true;
    try {
      const map = this.map;
      if (!map || typeof map.getLayers !== 'function') return;

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
        .map(capa => this._capaLegend(capa))
        .filter(legend => legend != null && legend !== undefined && legend !== '')
        .reverse();
      const selector = (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector("#seleccionCapasID") : null) || document.querySelector("#seleccionCapasID");
      if (!selector) return;
      // Valor a restaurar en el selector: prioriza la selección restaurada
      // del estado y, si no la hay, conserva la selección actual (que se
      // pierde al reconstruir las opciones con innerHTML = "").
      const currentVal = this._restoredLayer || (selector.value !== valueOri_filtroCapas ? selector.value : null);
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

      const targetVal = (this._restoredState && this._restoredState.selectedLayer)
        ? this._restoredState.selectedLayer
        : currentVal;
      if (targetVal && Array.from(selector.options).some(opt => opt.value === targetVal)) {
        selector.value = targetVal;
      }

      // Rehidratar formulario si existía un estado restaurado
      if (this._restoredState) {
        const st = this._restoredState;
        const inputSearch = document.getElementById("nameSearch") || (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector("#nameSearch") : null);
        if (inputSearch && st.searchTerm !== undefined && st.searchTerm !== null && !inputSearch.value) {
          inputSearch.value = st.searchTerm;
        }
        if (st.applied && st.selectedLayer && st.searchTerm) {
          await this._reapplyFilterIfNeeded(st);
        }
      }
    } finally {
      this._populatingSelector = false;
    }
  }

  // Re-aplica el filtro restaurado UNA sola vez por restauración de estado.
  // El flag `_filterReapplied` se marca ANTES de crear la capa para que los
  // eventos ADDED_LAYER posteriores no vuelvan a entrar en cascada.
  async _reapplyFilterIfNeeded(st) {
    if (this._filterReapplied) return;
    if (!this.map || typeof this.map.getLayers !== 'function') return;

    const filteredName = st.selectedLayer + ' - ' + st.searchTerm;
    const layers = this.map.getLayers() || [];
    const alreadyExists = layers.some(l => l && (l.legend === filteredName || l.name === filteredName));
    if (alreadyExists) {
      this._filterReapplied = true;
      return;
    }

    const selector = (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector("#seleccionCapasID") : null) || document.querySelector("#seleccionCapasID");
    if (!selector || selector.value !== st.selectedLayer) return;

    this._filterReapplied = true; // marcar ANTES para evitar reentrada
    await this.myFunctionFilterLayer();
  }

  async myFunctionFilterLayer() {
    const IDEE = api_filtroCapas();
    const map = this.map;
    if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = false;

    IDEE.toast.warning('Filtrando capa . . .', null, 2000);
    await new Promise(resolve => setTimeout(resolve, 100));

    const selector = (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector("#seleccionCapasID") : null) || document.querySelector("#seleccionCapasID");
    const value = selector ? selector.value : valueOri_filtroCapas;
    if (value == valueOri_filtroCapas) {
      IDEE.toast.warning('Seleccione una capa para realizar un filtro', null, 2000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }
    const capaSeleccionada = map.getLayers().filter(capa => this._capaLegend(capa) == value)[0];
    if (!capaSeleccionada) {
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }

    // se crea un filtro personalizado
    const inputSearch = document.getElementById("nameSearch") || (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector("#nameSearch") : null);
    const textoaBuscar = inputSearch ? inputSearch.value : "";
    if (!textoaBuscar) {
      IDEE.toast.warning('Introduzca un texto para filtrar', null, 2000);
      if (typeof SVGCarga !== 'undefined' && SVGCarga) SVGCarga.hidden = true;
      return;
    }

    this._filterApplied = true;

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
      name: (capaSeleccionada.legend || value) + ' - ' + textoaBuscar,
      legend: (capaSeleccionada.legend || value) + ' - ' + textoaBuscar,
      extract: true,
      attribution: {
        name: (capaSeleccionada.legend || value) + " :",
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

  // ===================================================================
  //  Contrato de preservación de estado (getState / setState)
  //  Permite conservar los criterios de filtrado seleccionados, el texto
  //  de búsqueda y el estado del panel entre intercambios OL <-> Cesium.
  // ===================================================================
  getState() {
    const selector = (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector('#seleccionCapasID') : null) || document.querySelector('#seleccionCapasID');
    const selectedLayer = selector && selector.value && selector.value !== valueOri_filtroCapas ? selector.value : null;

    const inputSearch = document.getElementById('nameSearch') || (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector('#nameSearch') : null);
    const searchTerm = inputSearch && inputSearch.value ? inputSearch.value : '';

    let collapsed = false;
    if (this.panel) {
      if (this.panel._collapsed !== undefined) {
        collapsed = !!this.panel._collapsed;
      } else if (typeof this.panel.getElement === 'function') {
        const el = this.panel.getElement();
        collapsed = el ? el.classList.contains('collapsed') : false;
      }
    }

    const applied = !!this._filterApplied || (Boolean(selectedLayer) && Boolean(searchTerm));

    return {
      selectedLayer: selectedLayer || (this._restoredState ? this._restoredState.selectedLayer : null),
      searchTerm: searchTerm || (this._restoredState ? this._restoredState.searchTerm : ''),
      collapsed,
      applied
    };
  }

  setState(state, map) {
    if (!state || typeof state !== 'object') return;
    if (map) this.map = map;
    this._restoredState = state;
    if (state.selectedLayer) this._restoredLayer = state.selectedLayer;
    // Estado nuevo -> permitir re-aplicar el filtro restaurado una vez
    this._filterReapplied = false;

    // Restaurar estado de colapso del panel
    if (state.collapsed !== undefined && this.panel) {
      if (state.collapsed && typeof this.panel.collapse === 'function') {
        this.panel.collapse();
      } else if (!state.collapsed && typeof this.panel.open === 'function') {
        this.panel.open();
      }
    }

    // Restaurar input de búsqueda de texto
    const inputSearch = document.getElementById('nameSearch') || (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector('#nameSearch') : null);
    if (inputSearch && state.searchTerm !== undefined && state.searchTerm !== null) {
      inputSearch.value = state.searchTerm;
    }

    // Restaurar selector de capa
    const selector = (this.panel && typeof this.panel.getTemplatePanel === 'function' ? this.panel.getTemplatePanel().querySelector('#seleccionCapasID') : null) || document.querySelector('#seleccionCapasID');
    if (selector && state.selectedLayer) {
      const optExists = Array.from(selector.options || []).some(opt => opt.value === state.selectedLayer);
      if (optExists) {
        selector.value = state.selectedLayer;
        try { selector.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      }
    }

    // Si el filtro estaba aplicado, re-aplicarlo una única vez (guardia en _reapplyFilterIfNeeded)
    if (state.applied && state.selectedLayer && state.searchTerm) {
      this._reapplyFilterIfNeeded(state);
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
    // Posición (índice, empezando en 0) del botón del plugin dentro del div
    // de botones (el m-area donde se colocan los paneles). Si se omite o no es
    // un número válido, el botón queda donde lo coloca Mapea por defecto (el
    // orden de addPanels / addPlugin). Ej: order:0 => primer botón del área.
    this.order = (options.order !== undefined) ? Number(options.order) : null;
    this.map = null;
    this.panel = null;
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

    // ── Posicionar el botón del plugin (opción `order`) ────────────────
    if (this.order !== null && !Number.isNaN(this.order)) {
      const panelEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta_leyenda');
      if (panelEl && panelEl.parentElement) {
        const area = Array.from(panelEl.parentElement.children).some(el => el === panelEl)
          ? panelEl.parentElement
          : panelEl.closest('.m-area');
        if (area) {
          const siblings = Array.from(area.children).filter(el =>
            el.classList && el.classList.contains('m-panel')
          );
          if (siblings.length > 1) {
            const target = Math.max(0, Math.min(this.order, siblings.length - 1));
            const current = siblings.indexOf(panelEl);
            if (current !== target) {
              const ref = (target >= siblings.length)
                ? null
                : siblings[target];
              if (ref && ref !== panelEl) {
                if (target > current) {
                  const next = siblings[target + 1] || null;
                  area.insertBefore(panelEl, next);
                } else {
                  area.insertBefore(panelEl, ref);
                }
              } else if (ref === null) {
                area.appendChild(panelEl);
              }
            }
          }
        }
      }
    }

    // Aplicar colores configurables (color1=fondo, color2=borde, color3=icono)
    // al panel. Se inyectan 6 variables CSS (estado normal y ".opened/active").
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const lfEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta_leyenda');
    if (lfEl) {
      lfEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      lfEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      lfEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      lfEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      lfEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      lfEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

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

  // ===================================================================
  //  Contrato de preservación de estado (getState / setState)
  // ===================================================================
  getState() {
    let collapsed = true;
    if (this.panel) {
      if (this.panel._collapsed !== undefined) {
        collapsed = !!this.panel._collapsed;
      } else if (typeof this.panel.getElement === 'function') {
        const el = this.panel.getElement();
        collapsed = el ? el.classList.contains('collapsed') : true;
      }
    }
    return { collapsed };
  }

  setState(state, map) {
    if (!state || typeof state !== 'object') return;
    if (map) this.map = map;
    if (state.collapsed !== undefined && this.panel) {
      if (state.collapsed && typeof this.panel.collapse === 'function') {
        this.panel.collapse();
      } else if (!state.collapsed && typeof this.panel.open === 'function') {
        this.panel.open();
      }
    }
  }
}

// Exponer las clases en los namespaces IDEE.plugin y M.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_filtroCapas = miPlugin_filtroCapas;
  window.miPlugin_leyenda = miPlugin_leyenda;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_filtroCapas = miPlugin_filtroCapas;
  window.IDEE.plugin.miPlugin_leyenda = miPlugin_leyenda;
  window.M = window.M || {};
  window.M.plugin = window.M.plugin || {};
  window.M.plugin.miPlugin_filtroCapas = miPlugin_filtroCapas;
  window.M.plugin.miPlugin_leyenda = miPlugin_leyenda;
}
