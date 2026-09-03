// Reemplazamos la API basada en variables globales por una clase-plugin
class miPlugin_layerSwitcher {
  constructor(options = {}) {
    this.name = 'miPlugin_layerSwitcher';
    this.options = options || {};
    // idLayer de la capa cuyo desplegable de opciones (transparencia) está
    // abierto. Se conserva entre re-renders para no cerrarlo al alternar
    // la visibilidad de otra capa.
    this._optionsOpen = null;
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
    // Referencia a la instancia para los handlers globales que necesitan
    // acceder a this._optionsOpen.
    const self = this;
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
        const htmlList = visibleLayers.map(layer => {
          const layerName = layer.legend || layer.name || 'Sin nombre';
          const index = layer.idLayer;
          const visible = layer.isVisible ? layer.isVisible() : true;
          // icono de ojo: abierto = capa visible, tachado/cerrado = oculta
          const eyeIcon = visible ? '👁' : '🚫';
          // Transparencia actual en % (100 = totalmente transparente).
          // La API usa opacidad 0..1, asi que transparencia = (1 - opacity).
          let opacity = 1;
          try { if (layer.getOpacity !== undefined) opacity = layer.getOpacity() || 0; } catch (e) { /* ignorar */ }
          const transpPct = Math.round((1 - opacity) * 100);
          const optionsOpen = this._optionsOpen === index;
          // Gradiente del track del slider: representa la OPACIDAD (lo que
          // queda visible). 0% de transparencia (opaco) => relleno hasta la
          // derecha (100%); 100% de transparencia => riel vacio (0%).
          const fillPct = 100 - transpPct;
          const sliderFill = `linear-gradient(to right, #0078d4 0%, #0078d4 ${fillPct}%, #d7dde7 ${fillPct}%, #d7dde7 100%)`;
          return `
            <li>
              <label>
                <span class="ls-nombre">${layerName}</span>
                <button type="button" class="ls-eye ${visible ? 'ls-eye-on' : 'ls-eye-off'}" data-id="${index}" title="${visible ? 'Ocultar capa' : 'Mostrar capa'}" onclick="toggleLayerVisibility('${index}')">${eyeIcon}</button>
                <button type="button" class="ls-options ${optionsOpen ? 'ls-options-open' : ''}" data-id="${index}" title="Opciones de la capa" onclick="toggleLayerOptions('${index}')">▾</button>
              </label>
              <div class="ls-options-panel ${optionsOpen ? 'open' : ''}">
                <div class="ls-option-row">
                  <span class="ls-option-label" title="Transparencia de la capa">Transparencia</span>
                  <input type="range" min="0" max="100" value="${transpPct}" class="ls-opacity-slider" style="background:${sliderFill}" aria-label="Transparencia de ${layerName}" oninput="setLayerOpacity('${index}', this.value, this)">
                  <span class="ls-option-value">${transpPct}%</span>
                </div>
              </div>
            </li>`;
        }).join('');

        control.htmlView = `<ul class="overlay-layer-selector">${htmlList}</ul>`;
        const preview = document.querySelector('#m-herramienta-previews-layerSwitcher');
        if (preview) preview.innerHTML = control.htmlView;
      } catch (e) {
        console.warn('layerSwitcher: error rendering layer list', e);
      }
    };

    // Expone el re-render para que los controles (ojito) refresquen
    // la lista y el estado de visibilidad tras cada cambio.
    window.renderLayerList = async () => { await renderLayerList(); };

    control.activate = async () => {
      await renderLayerList();
    };

    control.deactivate = () => { };

    window.toggleLayerVisibility = function (index) {
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      if (!layer || typeof layer.setVisible !== 'function') return;

      // El ojito es el unico control de visibilidad: alterna la capa de forma
      // independiente (varias capas pueden estar visibles a la vez).
      layer.setVisible(!layer.isVisible());
      // Actualiza el ojito (estado visible/oculto) tras el cambio.
      if (window.renderLayerList && typeof window.renderLayerList === 'function') {
        window.renderLayerList();
      } else if (layer && layer.isVisible) {
        const eye = document.querySelector('.g-herramienta_selectorCapa .ls-eye[data-id="' + index + '"]');
        const visible = layer.isVisible();
        if (eye) {
          eye.textContent = visible ? '👁' : '🚫';
          eye.classList.toggle('ls-eye-on', visible);
          eye.classList.toggle('ls-eye-off', !visible);
          eye.title = visible ? 'Ocultar capa' : 'Mostrar capa';
        }
      }
    };

    // ── Desplegable de opciones por capa ────────────────────────────────
    // Abre/cierra el panel de opciones de una capa (por ahora transparencia).
    // Conserva en self._optionsOpen que capa tiene el panel abierto para no
    // cerrarlo al re-renderizar (p.ej. al alternar la visibilidad de otra).
    window.toggleLayerOptions = function (index) {
      self._optionsOpen = self._optionsOpen === index ? null : index;
      renderLayerList();
    };

    // ── Slider de transparencia ─────────────────────────────────────────
    // transpPct es 0..100 (0 = opaco, 100 = totalmente transparente). La API
    // usa opacidad 0..1, asi que transladamos: opacity = 1 - transp/100.
    window.setLayerOpacity = function (index, transpPct, sliderEl) {
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      const pct = Math.max(0, Math.min(100, Number(transpPct) || 0));
      if (layer && layer.setOpacity) {
        layer.setOpacity(1 - pct / 100);
      }
      // Actualiza solo el texto del valor y el relleno del track del slider,
      // sin re-render (re-renderizar perderia el foco mientras se arrastra).
      // El relleno representa la opacidad (100 - transparencia): 0% de
      // transparencia => relleno al 100%, 100% de transp. => vacio.
      if (sliderEl) {
        const fillPct = 100 - pct;
        sliderEl.style.background =
          `linear-gradient(to right, #0078d4 0%, #0078d4 ${fillPct}%, #d7dde7 ${fillPct}%, #d7dde7 100%)`;
        if (sliderEl.parentElement) {
          const val = sliderEl.parentElement.querySelector('.ls-option-value');
          if (val) val.textContent = pct + '%';
        }
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

