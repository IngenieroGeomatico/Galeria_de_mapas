

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

tms_2 = {
  "base": "QUICK*Base_IGNBaseTodo_TMS_2"
}

M.config("tms", tms_2)

M.proxy(false)
M.config.POPUP_INTELLIGENCE.activate = false

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


geojsonData = myFunction_GetData()
geojsonData.then(() => {

    // creamos la capa
    console.log("1: ",geojsonDataAsync.geoJson_Monumentos)
    const capaMonumentos = new M.layer.GeoJSON({
          name: "Monumentos",
          source: geojsonDataAsync.geoJson_Monumentos,
          extract: true,
          legend: "Monumentos",
          attribution: {
            name: "Monumentos:",
            description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
          }
        },{
          // style:estiloEstacion
    })
    mapajs.addLayers(capaMonumentos)
    // capaMonumentos.clear()
    // capaMonumentos.getImpl().loadFeaturesPromise_ = null
    // capaMonumentos.setSource(geojsonData.geoJson_Monumentos)

})
    

async function myFunction_GetData(){

  geojsonDataAsync = {}

  let myPromise_Monumentos = new Promise(function (resolve) {

    M.proxy(true)
    M.remote.get("https://datos.madrid.es/egob/catalogo/300356-0-monumentos-ciudad-madrid.json",).then(
      function (res) {
        // Muestra un diálogo informativo con el resultado de la petición get
        // console.log(res.text);
        M.proxy(false)
        resolve(res.text)
      });
  });
  value_Monumentos = await myPromise_Monumentos;
  confJSON_LD = { type: "Point", field: "location", long: "longitude", lat:"latitude" }
  geoJson_Monumentos = convertJsonLdToGeoJson(JSON.parse(value_Monumentos), confJSON_LD);
  geojsonDataAsync.geoJson_Monumentos = geoJson_Monumentos

  // console.log('0 :',geojsonDataAsync)
  return geojsonDataAsync

}



// Extensiones
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


M.proxy(false)
const ext_Modal = new M.plugin.Modal({
  position: 'BL',
  helpLink: {
    es: '../../html/modal_PuntosHistoricosMadrid.html'
  }
});
M.proxy(false)
mapajs.addPlugin(ext_Modal);

