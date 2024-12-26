

const SVGCarga = document.getElementById("cargaSVG")
window.onload = (event) => {
  SVGCarga.hidden = true
};


Base_IGNBaseTodo_TMS_2 = new M.layer.TMS({
  url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
  legend: 'IGNBaseTodo_2',
  visible: true,
  isBase: true,
  tileGridMaxZoom: 17,
  name: 'IGNBaseTodo_2',
  attribution: '<p><b>Mapa base</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>',
}, {
  crossOrigin: 'anonymous',
  displayInLayerSwitcher: false,
})

M.addQuickLayers({
  Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2
})

tms_2= {
  "base": "QUICK*Base_IGNBaseTodo_TMS_2"
}

M.config("tms",tms_2) 

M.proxy(false)

mapajs = M.map({
  container: "mapa",
  zoom: 12,
  center: { x: -413064.3575507956, y: 4927841.089710372 },
  controls: ['attributions'],
  layers: []
});

mapajs.addAttribution({
  name: "Autor:",
  description: " <a style='color: #0000FF' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
})

mapajs.addQuickLayers('Base_IGNBaseTodo_TMS_2')




const layer_1910 = new M.layer.WMS({
  url: 'https://www.ign.es/wms/planos',
  name: 'nunezMadrid',
  legend: 'Nuñez Granés 1910',
  tiled: true,
  visibility: true,
  attribution: '<p><b>Nuñez Granés 1910</b>: <a style="color: #0000FF" href="https://www.ign.es" target="_blank">IGN</a></p>',
}, {})

const layer_1929 = new M.layer.WMS({
  url: 'https://www.ign.es/wms/planos',
  name: 'ayuntamientoMadrid',
  legend: 'Parcelario 1929',
  tiled: true,
  visibility: false,
  attribution: '<p><b>Parcelario 1929</b>: <a style="color: #0000FF" href="https://www.ign.es" target="_blank">IGN</a></p>',
}, {})

// La añadimos al mapa
mapajs.addLayers([layer_1929,layer_1910]);





const ext_LayerSwitcher = new M.plugin.Layerswitcher({
  collapsed: true,
  position: 'TL',
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


const mp_SM = new M.plugin.StoryMap({
  collapsed: false,
  collapsible: true,
  position: 'TR',
  content: {
    es: StoryMapJSON,
  },
  indexInContent: {
    title: 'Luces de bohemia',
    subtitle: 'Ramón María del Valle-Inclán',
    js: "console.log('BLAAAAAAAAAAA');",
  },
  delay: 2000,
});

mapajs.addPlugin(mp_SM);
