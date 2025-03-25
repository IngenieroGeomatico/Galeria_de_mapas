var mapajs = M.map({
    container: "mapaID",
    zoom:2,
  });

  const ext_LayerSwitcher = new M.plugin.Layerswitcher({
    collapsed: true,
    position: 'TR',
    collapsible: true,
    isDraggable: true,
    modeSelectLayers: 'eyes',
    tools: ['transparency', 'zoom', 'information', 'delete'],
    isMoveLayers: true,
    https: true,
    http: true,
    showCatalog: false,
    displayLabel: false,
  });
  mapajs.addPlugin(ext_LayerSwitcher);
  


