miPlugin2 = new IDEE.Plugin();
miPlugin2.name = "miPlugin2";

miPlugin2.getHelp = () => {
  return {
    title: "Mi Plugin Personalizado 2",
    content: new Promise((success) => {
      let html = "<div><p>Información del plugin</p></div>";
      html = IDEE.utils.stringToHtml(html);
      success(html);
    }),
  };
};

panelExtra2 = new IDEE.ui.Panel("toolsExtra2", {
  collapsible: true,
  className: "g-herramienta2",
  collapsedButtonClass: "m-tools",
  position: IDEE.ui.position.TL,
});

htmlPanel2 = `
  <div aria-label="Plugin View Management" role="menuitem" id="div-contenedor2-herramienta2" class="m-control m-container m-herramienta">
    <header 
      role="heading" 
      tabindex="0" 
      id="m-herramienta-title2"
      class="m-herramienta-header">
        Selector de capas base
    </header>
    <section id="m-herramienta-previews2" class="m-herramienta-previews2"></section>
    <div id="m-herramienta-contents2"></div>
  </div>
`;

controlBackgroundLayer = new IDEE.Control(new IDEE.impl.Control(), "controlBackgroundLayer");

controlBackgroundLayer.createView = (map) => {
  contenedor2 = document.createElement("div");
  return contenedor2;
};

miPlugin2.addTo = (map) => {
  panelExtra2.addControls(controlBackgroundLayer);
  map.addPanels(panelExtra2);
  document.querySelector(".g-herramienta2 .m-panel-controls").innerHTML = htmlPanel2;
  document.querySelector("#m-herramienta-contents2").appendChild(controlBackgroundLayer.getElement());

  IDEE.utils.draggabillyPlugin(panelExtra2, "#m-herramienta-title2");


  // Capas base (radio buttons)
  baseLayers = IDEE.config.backgroundlayers;
  htmlBaseLayers = baseLayers.map((layer, index) => {
    return `
      <li>
        <label>
          <input id="${layer.id}" type="radio" name="baseLayer" value="${layer.id}" onchange="changeBaseLayer('${layer.id}')">
          ${layer.title}
        </label>
      </li>
    `;
  }).join('');

  htmlBaseLayerSelector = `
    <div class="base-layer-selector">
      <ul>${htmlBaseLayers}</ul>
    </div>
  `;

  controlBackgroundLayer.htmlView = `
    ${htmlBaseLayerSelector}
  `;


  // Función para cambiar la capa base
  window.changeBaseLayer = function(layerId) {
    selected = IDEE.config.backgroundlayers.find(l => l.id === layerId);
    if (!selected) return;

    console.log(selected.layers)

    // Ocultar todas las capas base
    mapajs.removeLayers(mapajs.getBaseLayers()[0])
    mapajs.addLayers(selected.layers)

  };

  controlBackgroundLayer.activate = () => {
    console.log("Activado control");
    document.querySelector('#m-herramienta-previews2').innerHTML = controlBackgroundLayer.htmlView;
    document.querySelector('#mapa').click()
  };

  controlBackgroundLayer.deactivate = () => {
    console.log("Desactivado control");
  };

  panelExtra2.addControls(controlBackgroundLayer);
  controlBackgroundLayer.activate();
};
