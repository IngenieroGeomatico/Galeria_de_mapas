miPlugin = new IDEE.Plugin();
miPlugin.name = "MiPlugin";

miPlugin.getHelp = () => {
  return {
    title: "Mi Plugin Personalizado",
    content: new Promise((success) => {
      let html = "<div><p>Información del plugin</p></div>";
      html = IDEE.utils.stringToHtml(html);
      success(html);
    }),
  };
};

panelExtra = new IDEE.ui.Panel("toolsExtra", {
  collapsible: true,
  className: "g-herramienta",
  collapsedButtonClass: "m-tools",
  position: IDEE.ui.position.TL,
});

htmlPanel = `
              <div aria-label="Plugin View Management" role="menuitem" id="div-contenedor-herramienta" class="m-control m-container m-herramienta">
                  <header 
                      role="heading" 
                      tabindex="0" 
                      id="m-herramienta-title"
                      class="m-herramienta-header">
                        Selector de capas
                  </header>
                  <section id="m-herramienta-previews" class="m-herramienta-previews">

                  </section>
                  <div id="m-herramienta-contents"></div>
              </div>
              `;

controlLayer = new IDEE.Control(new IDEE.impl.Control(), "controlLayer");

controlLayer.createView = (map) => {
  contenedor = document.createElement("div");
  return contenedor;
};

miPlugin.addTo = (map) => {
  panelExtra.addControls(controlLayer);

  map.addPanels(panelExtra);
  document.querySelector(".g-herramienta .m-panel-controls").innerHTML = htmlPanel;
  document
    .querySelector("#m-herramienta-contents")
    .appendChild(controlLayer.getElement());

  // Para hacer movible el panel desde el título
  IDEE.utils.draggabillyPlugin(panelExtra, "#m-herramienta-title");

  
visibleLayers = mapajs.getLayers().filter(layer => {
  return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true;
});

htmlList = visibleLayers.map((layer) => {
  layerName = layer.legend || layer.name || 'Sin nombre';
  index = layer.idLayer
  isChecked = layer.isVisible() ? 'checked' : '';
  return `
    <li>
      <label>
        <input id="${layerName}" type="checkbox" ${isChecked} onchange="toggleLayerVisibility('${index}')">
        ${layerName}
      </label>
    </li>
  `;
}).join('');

controlLayer.htmlView = `<ul>${htmlList}</ul>`;

window.toggleLayerVisibility = function(index) {
  visibleLayers = mapajs.getLayers().filter(layer => layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index);
  layer = visibleLayers[0];
  if (layer) {
    if(layer.isVisible()){
      layer.setVisible(false);
    } else{
      layer.setVisible(true);
    }
    
  }
};




  controlLayer.activate = () => {
    console.log("Activado control");
    document.querySelector('#m-herramienta-previews').innerHTML = controlLayer.htmlView
  };

  controlLayer.deactivate = () => {
    console.log("Desactivado control");
  };

  panelExtra.addControls(controlLayer);
  controlLayer.activate()

};
