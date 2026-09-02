// Reemplazamos la API basada en variables globales por una clase-plugin
class miPlugin_layerSwitcher {
  constructor(options = {}) {
    this.name = 'miPlugin_layerSwitcher';
    this.options = options || {};
    // Tipo de control para cada capa:
    //  - 'checkbox' (por defecto): cada capa se muestra/oculta de forma
    //    independiente (varias visibles a la vez).
    //  - 'radio': exclusivo, solo una capa visible a la vez (al marcar una
    //    se ocultan las demas). Parametrizable por visualizador.
    this.controlType = this.options.controlType === 'radio' ? 'radio' : 'checkbox';
    // En modo radio, al iniciar se fuerza que una sola capa quede visible
    // (excluyente) aunque el mapa las cree todas visibles.
    this._initialRadioApplied = false;
  }

  getHelp() {
    return {
      title: 'Selector de capas',
      content: new Promise((success) => {
        let html = '<div><p>Selector de capas visibles en el mapa</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    const panelExtra = new IDEE.ui.Panel('toolsExtra_layerSwitcher', {
      collapsible: true,
      className: 'g-herramienta_selectorCapa',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    const htmlPanel = `
      <div aria-label="Selector de capas" role="menuitem" id="div-contenedor-herramienta-layerSwitcher" class="m-control m-container m-herramienta">
        <header 
          role="heading" 
          tabindex="0" 
          id="m-herramienta-title-layerSwitcher"
          class="m-herramienta-header">
            Selector de capas
        </header>
        <section id="m-herramienta-previews-layerSwitcher" class="m-herramienta-previews"></section>
        <div id="m-herramienta-contents-layerSwitcher"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlLayer_layerSwitcher');
    control.createView = () => document.createElement('div');

    panelExtra.addControls(control);
    map.addPanels(panelExtra);
    const panelSelector = document.querySelector('.g-herramienta_selectorCapa .m-panel-controls');
    if (panelSelector) panelSelector.innerHTML = htmlPanel;
    const contents = document.querySelector('#m-herramienta-contents-layerSwitcher');
    if (contents) contents.appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-layerSwitcher');

    const renderLayerList = async () => {
      try {
        const allLayers = await map.getOverlayLayers();
        const visibleLayers = (allLayers || []).filter(l => {
          try {
            return !(l && (l._type === 'Terrain' || l.type === 'Terrain'));
          } catch (e) { return true; }
        });
        const isRadio = this.controlType === 'radio';
        // Modo radio excluyente: se fuerza que una sola capa quede visible.
        // Como las capas overlay se cargan de forma asincrona (varios eventos
        // ADDED_LAYER), se aplica con un "debounce": cuando dejan de llegar
        // cargas (~800ms de silencio), se deja visible solo la primera.
        if (isRadio && !this._initialRadioApplied) {
          clearTimeout(this._radioDebounce);
          this._radioDebounce = setTimeout(() => {
            try {
              const overlays = map.getOverlayLayers() || [];
              let primerVisible = true;
              overlays.forEach(function (l) {
                if (l.isVisible && l.isVisible()) {
                  if (primerVisible) { primerVisible = false; }
                  else if (l.setVisible) { l.setVisible(false); }
                }
              });
              this._initialRadioApplied = true;
              if (window.renderLayerList) window.renderLayerList();
            } catch (e) { /* ignorar */ }
          }, 800);
        }
        const htmlList = visibleLayers.map(layer => {
          const layerName = layer.legend || layer.name || 'Sin nombre';
          const index = layer.idLayer;
          const visible = layer.isVisible ? layer.isVisible() : true;
          const isChecked = visible ? 'checked' : '';
          const inputId = `layer_${index}_layerSwitcher`;
          // icono de ojo: abierto = capa visible, tachado/cerrado = oculta
          const eyeIcon = visible ? '👁' : '🚫';
          return `
            <li>
              <label>
                <input id="${inputId}" type="${isRadio ? 'radio' : 'checkbox'}" ${isChecked} onchange="toggleLayerVisibility('${index}', '${this.controlType}')">
                <span class="ls-nombre">${layerName}</span>
                <button type="button" class="ls-eye ${visible ? 'ls-eye-on' : 'ls-eye-off'}" data-id="${index}" title="${visible ? 'Ocultar capa' : 'Mostrar capa'}" onclick="toggleLayerVisibility('${index}', '${this.controlType}', true)">${eyeIcon}</button>
              </label>
            </li>`;
        }).join('');

        control.htmlView = `<ul class="overlay-layer-selector">${htmlList}</ul>`;
        const preview = document.querySelector('#m-herramienta-previews-layerSwitcher');
        if (preview) preview.innerHTML = control.htmlView;
      } catch (e) {
        console.warn('layerSwitcher: error rendering layer list', e);
      }
    };

    // Expone el re-render para que los controles (ojito/radio) refresquen
    // la lista y el estado de visibilidad tras cada cambio.
    window.renderLayerList = async () => { await renderLayerList(); };

    control.activate = async () => {
      await renderLayerList();
    };

    control.deactivate = () => { };

    window.toggleLayerVisibility = function (index, controlType, viaEye) {
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      if (!layer) return;

      if (controlType === 'radio' && !viaEye) {
        // Accion desde el radio: modo excluyente. Solo la capa que se marca
        // queda visible; se ocultan todas las demas capas overlay y se
        // muestra la seleccionada.
        const overlays = map.getOverlayLayers() || [];
        overlays.forEach(function (l) {
          try {
            if (l.idLayer != index && l.setVisible && l.isVisible && l.getImpl().displayInLayerSwitcher !== false) {
              l.setVisible(false);
            }
          } catch (e) { /* ignorar */ }
        });
        layer.setVisible(true);
      } else {
        // Accion desde el ojito (o checkbox): alterna la visibilidad de esa
        // capa concreta. En checkbox solo afecta a ella; en radio el ojito
        // tambien puede ocultar la capa activa (quedando ninguna visible).
        layer.setVisible(!layer.isVisible());
      }
      // Actualiza el ojito (estado visible/oculto) tras el cambio.
      if (window.renderLayerList && typeof window.renderLayerList === 'function') {
        window.renderLayerList();
      } else if (layer && layer.isVisible) {
        const eye = document.querySelector('.g-herramienta_selectorCapa .ls-eye[data-id="' + index + '"]');
        const cb = document.getElementById('layer_' + index + '_layerSwitcher');
        const visible = layer.isVisible();
        if (eye) {
          eye.textContent = visible ? '👁' : '🚫';
          eye.classList.toggle('ls-eye-on', visible);
          eye.classList.toggle('ls-eye-off', !visible);
          eye.title = visible ? 'Ocultar capa' : 'Mostrar capa';
        }
        if (cb) cb.checked = visible;
      }
    };

    // Update the list whenever a layer is added to the map
    try {
      if (map && typeof map.on === 'function' && IDEE && IDEE.evt) {
        map.on(IDEE.evt.ADDED_LAYER, async (capas) => {
          await renderLayerList();
        });
      }
    } catch (e) {
      console.warn('layerSwitcher: could not attach ADDED_LAYER listener', e);
    }

    control.activate();
  }
}

if (typeof window !== 'undefined') {
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_layerSwitcher = miPlugin_layerSwitcher;
}

