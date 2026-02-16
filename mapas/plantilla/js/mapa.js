const SVGCarga = document.getElementById("cargaSVG")
window.onload = (event) => {
  SVGCarga.hidden = true
};

function mapa() {

  SVGCarga.hidden = false

  mapajs = M.map({
    container: "mapaDIV"
  });

  // Pasando opciones al plugin en el momento de registrarlo
  const pluglinCambioImpl = new miPlugin_cambioImpl({
    buttonTitle: 'Herramienta',
    // Pasar la referencia a la función sin paréntesis para evitar su ejecución inmediata
    // mapsFunction: { ol: mapa, Cesium: mapa }
    // o usar la misma función para ambos: mapsFunction: mapa
    mapsFunction: mapa,
    sameMap: true
  });

  // Añadir el plugin correctamente al mapa
  mapajs.addPlugin(pluglinCambioImpl);

  SVGCarga.hidden = true

}

mapa() 
