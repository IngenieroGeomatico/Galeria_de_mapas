const SVGCarga = document.getElementById("cargaSVG")

function mapa() {  

  SVGCarga.hidden = false
 
  mapajs = M.map({
    container: "mapaDIV"
  });

  mapajs.addPlugin(miPlugin_cambioImpl)

  SVGCarga.hidden = true

 }

 mapa() 
