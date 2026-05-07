class miPlugin_baseLayer {
  constructor(options = {}) {
    this.name = 'miPlugin_baseLayer';
    this.options = options || {};
  }

  getHelp() {
    return {
      title: 'Selector de capas base',
      content: new Promise((success) => {
        let html = '<div><p>Información del plugin</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    const panelExtra2 = new IDEE.ui.Panel('toolsExtra_baseLayer', {
      collapsible: true,
      className: 'g-herramienta_baseLayer',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    const htmlPanel2 = `
      <div aria-label="cambio capa base" role="menuitem" id="div-contenedor-herramienta-baseLayer" class="m-control m-container m-herramienta">
        <header 
          role="heading" 
          tabindex="0" 
          id="m-herramienta-title-baseLayer"
          class="m-herramienta-header">
            Selector de capas base
        </header>
        <section id="m-herramienta-baseLayer" class="m-herramienta-baseLayer"></section>
        <div id="m-herramienta-contents-baseLayer"></div>
      </div>
    `;

    const controlBackgroundLayer = new IDEE.Control(new IDEE.impl.Control(), 'controlBackgroundLayer');

    controlBackgroundLayer.createView = (m) => {
      const contenedor2 = document.createElement('div');
      return contenedor2;
    };

    panelExtra2.addControls(controlBackgroundLayer);
    map.addPanels(panelExtra2);
    document.querySelector('.g-herramienta_baseLayer .m-panel-controls').innerHTML = htmlPanel2;
    document.querySelector('#m-herramienta-contents-baseLayer').appendChild(controlBackgroundLayer.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra2, '#m-herramienta-title-baseLayer');

    // Capas base (radio buttons)
    const baseLayers = IDEE.config.backgroundlayers || [];
    const htmlBaseLayers = baseLayers.map((layer) => {
      return `
        <li>
          <label>
            <input id="${layer.id}_baseLayerID" type="radio" name="baseLayer_name" value="${layer.id}" onchange="changeBaseLayer('${layer.id}')">
            ${layer.title}
          </label>
        </li>
      `;
    }).join('');

    const htmlBaseLayerSelector = `
      <div class="base-layer-selector">
        <ul>${htmlBaseLayers}</ul>
      </div>
    `;

    controlBackgroundLayer.htmlView = `
      ${htmlBaseLayerSelector}
    `;

    // Función para cambiar la capa base
    window.changeBaseLayer = function (layerId) {
      const selected = IDEE.config.backgroundlayers.find(l => l.id === layerId);
      if (!selected) return;

      // Ocultar todas las capas base y añadir la seleccionada
      map.removeLayers(map.getBaseLayers()[0]);
      map.addLayers(selected.layers);
      localStorage.setItem('baseLayer_ID', `${layerId}_baseLayerID`);
    };

    controlBackgroundLayer.activate = () => {
      document.querySelector('#m-herramienta-baseLayer').innerHTML = controlBackgroundLayer.htmlView;
      const container = document.querySelector('#m-herramienta-baseLayer');
      container.innerHTML = controlBackgroundLayer.htmlView;

      // Obtener id guardado o usar el primer radio como fallback
      let value = localStorage.getItem('baseLayer_ID');
      if (!value) {
        const firstInput = container.querySelector('input[name=baseLayer_name]');
        if (firstInput) {
          value = firstInput.id;
          localStorage.setItem('baseLayer_ID', value);
        }
      }

      // Buscar el elemento dentro del contenedor y hacer click de forma segura
      const safeQuery = (id) => {
        if (!id) return null;
        try {
          if (window.CSS && CSS.escape) return container.querySelector('#' + CSS.escape(id));
        } catch (e) { }
        // Fallback simple (escapa comillas y espacios básicos)
        const escaped = id.replace(/"|'|\s/g, '_');
        return container.querySelector('#' + escaped) || document.getElementById(id);
      };

      const target = safeQuery(value);
      if (target) {
        // Defer al siguiente frame para garantizar que el navegador haya renderizado los nodos
        requestAnimationFrame(() => target.click());
      }

    };

    controlBackgroundLayer.deactivate = () => {
      // no-op por ahora
    };

    controlBackgroundLayer.activate();
  }
}

// Exponer la clase en el namespace `IDEE.plugin.miPlugin_baseLayer`
if (typeof window !== 'undefined') {
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_baseLayer = miPlugin_baseLayer;
}
