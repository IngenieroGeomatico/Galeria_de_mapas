var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
    } 
  });
}

async function waitForDefined() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (gdal !== undefined ) {
                clearInterval(interval);
                resolve(gdal);
            }
        }, 1000); // Comprobamos cada 100ms
    });
}
waitForDefined().then(() => {
    console.log("La variable está definida:", gdal);
    var tablaVector = document.getElementById("tablaVectorID");
    var tablaRaster = document.getElementById("tablaRasterID");
    vectores = gdal.drivers.vector
    raster = gdal.drivers.raster


    for (let format in vectores) {
         // Crear una nueva fila (tr)
        var fila = tablaVector.insertRow();

        // Crear celdas (td) en la fila
        var celda1 = fila.insertCell(0);
        var celda2 = fila.insertCell(1);
        var celda3 = fila.insertCell(2);
        var celda4 = fila.insertCell(3);

        // Asignar contenido a las celdas
        celda1.innerHTML = vectores[format].longName;
        celda2.innerHTML = vectores[format].shortName;
        celda3.innerHTML = vectores[format].isReadable;
        celda4.innerHTML = vectores[format].isWritable;
    }

    for (let format in raster) {
       // Crear una nueva fila (tr)
      var fila = tablaRaster.insertRow();

      // Crear celdas (td) en la fila
      var celda1 = fila.insertCell(0);
      var celda2 = fila.insertCell(1);
      var celda3 = fila.insertCell(2);
      var celda4 = fila.insertCell(3);

      // Asignar contenido a las celdas
      celda1.innerHTML = raster[format].longName;
      celda2.innerHTML = raster[format].shortName;
      celda3.innerHTML = raster[format].isReadable;
      celda4.innerHTML = raster[format].isWritable;
  }
   

});

