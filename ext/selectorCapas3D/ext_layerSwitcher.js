// Reemplazamos la API basada en variables globales por una clase-plugin
class miPlugin_layerSwitcher {
  constructor(options = {}) {
    this.name = 'miPlugin_layerSwitcher';
    this.options = options || {};
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

    control.activate = () => {
      const visibleLayers = mapajs.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true; } catch (e) { return false; }
      });

      const htmlList = visibleLayers.map(layer => {
        const layerName = layer.legend || layer.name || 'Sin nombre';
        const index = layer.idLayer;
        const isChecked = layer.isVisible() ? 'checked' : '';
        const inputId = `layer_${index}_layerSwitcher`;
        return `
          <li>
            <label>
              <input id="${inputId}" type="checkbox" ${isChecked} onchange="toggleLayerVisibility('${index}')">
              ${layerName}
            </label>
          </li>`;
      }).join('');

      control.htmlView = `<ul class="overlay-layer-selector">${htmlList}</ul>`;
      const preview = document.querySelector('#m-herramienta-previews-layerSwitcher');
      if (preview) preview.innerHTML = control.htmlView;
    };

    control.deactivate = () => { };

    window.toggleLayerVisibility = function (index) {
      const matches = mapajs.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      if (layer && layer.isVisible && layer.setVisible) layer.setVisible(!layer.isVisible());
    };

    control.activate();
  }
}

if (typeof window !== 'undefined') {
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_layerSwitcher = miPlugin_layerSwitcher;
}

