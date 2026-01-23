const SVGCarga = document.getElementById("cargaSVG")
window.onload = (event) => {
  SVGCarga.hidden = true
};

function mapa() {  

  SVGCarga.hidden = false
 
  mapajs = M.map({
    container: "mapaDIV"
  });

  mapajs.addPlugin(miPlugin_cambioImpl)

  SVGCarga.hidden = true

 }

 mapa() 
