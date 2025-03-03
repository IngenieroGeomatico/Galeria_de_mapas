var fileUpload = document.querySelector(".upload");
var filesObj = {}
var n = 1
var gdal;  // Variable global

function readUrl(input) {

  const file = input.files[0];

  if (file && gdal) {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = async () => {
      const arrayBuffer = reader.result;
      let imgName = file.name

      try {
        if (input.value.includes('zip')) {
          gdal.Module.FS.writeFile('/input/' + imgName, new Int8Array(arrayBuffer));
          dataset = await gdal.open('/input/' + imgName, [], ['vsizip'])
        }
        else {
          gdal.Module.FS.writeFile('/input/' + imgName, new Int8Array(arrayBuffer));
          dataset = await gdal.open('/input/' + imgName)
        }
      } catch (error) {
        console.error(error);
        setTimeout(() => fileUpload.classList.add("fail"), 1000);
        setTimeout(() => fileUpload.classList.remove("fail"), 3000);
        setTimeout(() => fileUpload.classList.remove("drop"), 3000);
        return
      }

      dataset.name = imgName
      groupLayerName = imgName.split(".")[0]

      // layerGroup = new M.layer.LayerGroup({
      //   name: groupLayerName,           // Nombre del grupo de capas
      //   legend: groupLayerName,  // Leyenda asociada al grupo
      //   layers: layers    // Capas que pertenecen al grupo
      // });
      // mapajs.addLayers(layerGroup)

      layersName = dataset.datasets[0].info.layers.map(item => item.name).filter(name => name !== undefined);

      if (dataset.datasets[0].type = "vector") {

        layersName.forEach(name => {
          const options = [
            '-f', 'GeoJSON',
            '-t_srs', 'EPSG:4326',
            '-sql', 'SELECT * from ' + name
          ];
          outputName = "gjson_" + groupLayerName + "_" + name
          const filePathExportGJSON = gdal.ogr2ogr(dataset.datasets[0], options, outputName);

          filePathExportGJSON.then((OUTPUT) => {
            // dataset.gjson = OUTPUT.local

            decoder = new TextDecoder('utf-8');

            gjson_file = JSON.parse(decoder.decode(gdal.Module.FS.readFile(OUTPUT.local)))

            capa = new M.layer.GeoJSON({
              name: name,
              legend: groupLayerName + "_" + name,
              source: gjson_file,
              extract: true
            })
            function rndInt0_255() { return (Math.floor(Math.random() * 255) + 1).toString(); };
            estilo1 = new M.style.Generic({
              point: {
                // Definición atributos para puntos
                radius: 7,

                fill: {
                  color: 'rgba(' + rndInt0_255() + ',' + rndInt0_255() + ',' + rndInt0_255() + ',0.8)',
                  opacity: 0.8,//Transparencia del punto
                },
                //Borde exterior
                stroke: {
                  color: 'rgba(' + rndInt0_255() + ',' + rndInt0_255() + ',' + rndInt0_255() + ',0.8)',
                  width: 2, // Grosor en pixeles
                  opacity: 1
                },
              },
              polygon: {
                // Definición atributos para polígonos
                // Polígono rosa semitransparente con borde rojo de grosor dos
                fill: {
                  color: 'rgba(' + rndInt0_255() + ',' + rndInt0_255() + ',' + rndInt0_255() + ',0.8)',
                  opacity: 0.8,
                },
                stroke: {
                  color: 'rgba(' + rndInt0_255() + ',' + rndInt0_255() + ',' + rndInt0_255() + ',0.8)',
                  width: 2,
                  opacity: 1
                }
              },
              line: {
                // Definición atributos para líneas
                fill: {
                  color: 'rgba(' + rndInt0_255() + ',' + rndInt0_255() + ',' + rndInt0_255() + ',0.8)',
                  opacity: 0.8,
                },
                stroke: {
                  color: 'rgba(' + rndInt0_255() + ',' + rndInt0_255() + ',' + rndInt0_255() + ',0.8)',
                  width: 2,
                  opacity: 1
                }

              }
            });
            capa.setStyle(estilo1)
            mapajs.addLayers(capa)
            // layerGroup.addLayers(capa)

          })

        });

      }



      filesObj[n] = dataset
      n += 1

      divAccordionFiles = document.getElementById("accordionFiles");

      // Crear los elementos
      const button = document.createElement("button");
      button.className = "accordion";
      button.textContent = dataset.datasets[0].type + " - " + imgName;
      button.addEventListener("click", function () {
        this.classList.toggle("active");
        var panel = this.nextElementSibling;
        if (panel.style.maxHeight) {
          panel.style.maxHeight = null;
        } else {
          panel.style.maxHeight = panel.scrollHeight + "px";
        }
      });



      const panel = document.createElement("div");
      panel.className = "panel";

      const table = document.createElement("table");

      var fila = table.insertRow();

      var cabecera1 = document.createElement("th");
      var cabecera2 = document.createElement("th");
      var cabecera3 = document.createElement("th");
      var cabecera4 = document.createElement("th");
      var cabecera5 = document.createElement("th");

      cabecera1.innerHTML = "Capa";
      cabecera2.innerHTML = "Tipo de geometría";
      cabecera3.innerHTML = "S.G.R.";
      cabecera4.innerHTML = "Número de objetos geográficos";
      cabecera5.innerHTML = "Número de atributos";

      // Agregamos las celdas de cabecera a la fila
      fila.appendChild(cabecera1);
      fila.appendChild(cabecera2);
      fila.appendChild(cabecera3);
      fila.appendChild(cabecera4);
      fila.appendChild(cabecera5);

      for (let capa_n in dataset.datasets[0].info.layers) {
        capa = dataset.datasets[0].info.layers[capa_n]
        if (capa.name) {
          var fila_n = table.insertRow();
          var celda1 = fila_n.insertCell(0);
          var celda2 = fila_n.insertCell(1);
          var celda3 = fila_n.insertCell(2);
          var celda4 = fila_n.insertCell(3);
          var celda5 = fila_n.insertCell(4);

          // Asignar contenido a las celdas
          celda1.innerHTML = capa.name;
          celda2.innerHTML = capa.geometryFields[0].type;
          celda3.innerHTML = capa.geometryFields[0].coordinateSystem.projjson.id.authority + ":" + capa.geometryFields[0].coordinateSystem.projjson.id.code;
          celda5.innerHTML = capa.featureCount;
          celda4.innerHTML = capa.fields.length;
        }

      }
      var fila_0 = table.insertRow();
      var celda_0 = document.createElement("td");
      celda_0.colSpan = 5
      fila_0.appendChild(celda_0);

      var fila_cabeceraExp = table.insertRow();
      var celda_cabExp = document.createElement("th");
      celda_cabExp.colSpan = 5
      celda_cabExp.style = "text-align: center;"
      celda_cabExp.innerHTML = "Opciones de exportación";

      var fila_1 = table.insertRow();
      var celda_1 = document.createElement("td");
      celda_1.colSpan = 5
      fila_cabeceraExp.appendChild(celda_cabExp);
      fila_1.appendChild(celda_1);

      var fila_Exp = table.insertRow();
      var celda_Exp_1 = document.createElement("th");
      var celda_Exp_2 = document.createElement("th");
      var celda_Exp_3 = document.createElement("th");
      celda_Exp_1.colSpan = 2
      celda_Exp_2.colSpan = 2
      celda_Exp_3.colSpan = 1
      celda_Exp_1.innerHTML = "Formato exportación";
      celda_Exp_2.innerHTML = "S.G.R. Exportación";
      celda_Exp_3.innerHTML = "Exportar";
      fila_Exp.appendChild(celda_Exp_1);
      fila_Exp.appendChild(celda_Exp_2);
      fila_Exp.appendChild(celda_Exp_3);

      var fila_ExpOpt = table.insertRow();
      var celda_opt_1 = fila_ExpOpt.insertCell(0);
      var celda_opt_2 = fila_ExpOpt.insertCell(1);
      var celda_opt_3 = fila_ExpOpt.insertCell(2);

      var selectFormat = document.createElement('select');
      vectores = gdal.drivers.vector
      raster = gdal.drivers.raster
      if (dataset.datasets[0].type == "raster") {
        for (let format in raster) {
          console.log(raster[format].longName)
          option = document.createElement('option');
          option.value = format;
          option.textContent = raster[format].longName;
          selectFormat.appendChild(option);
        }
      } else if (dataset.datasets[0].type == "vector") {
        for (let format in vectores) {
          option = document.createElement('option');
          option.value = format;
          option.textContent = vectores[format].longName;
          if (format == "GeoJSON") {
            option.selected = true;
          }
          if (vectores[format].isWritable == true) {
            selectFormat.appendChild(option);
          }
        }
      }

      celda_opt_1.appendChild(selectFormat);
      celda_opt_1.colSpan = 2
      celda_opt_1.id = "outputFormat_" + (n - 1)

      var inputTextEPSG = document.createElement('input');
      inputTextEPSG.type = 'text';
      inputTextEPSG.value = 'EPSG:4326';
      inputTextEPSG.id = "InputTextEpsg_" + (n - 1)
      celda_opt_2.appendChild(inputTextEPSG);
      celda_opt_2.colSpan = 2
      celda_opt_2.colSpan = 2

      let botonExp = document.createElement('button');
      botonExp.textContent = 'Exportar';
      botonExp.id = "buttonExport_" + (n - 1)

      botonExp.onclick = function (e) {
        id = e.target.id.split("_")[1]
        datasetInExport = filesObj[id]
        console.log("datasetInExport: ", datasetInExport)

        EPSG_out = document.getElementById("InputTextEpsg_" + id).value
        console.log("EPSG_out: ", EPSG_out)

        format_out = document.getElementById("outputFormat_" + id).children[0].value
        console.log("format_out: ", format_out)


        // Función para generar un archivo y descargarlo
        function descargarArchivo(contenido, EPSG, format) {
          nameFile = contenido.name.split(".")[0];
          layersName = contenido.datasets[0].info.layers.map(item => item.name).filter(name => name !== undefined);
          filesExport = [];

          if (contenido.datasets[0].type === "vector") {
            const options = [
              '-f', format,
              '-t_srs', EPSG,
            ];
            outputName = contenido.name.split(".")[0];

            try {

              // mandar un error si hay más de un archivo en all
              
              const filePathExport = gdal.ogr2ogr(contenido.datasets[0], options, outputName);
              filePathExport.then((OUTPUT) => {
                fileExport = gdal.Module.FS.readFile(OUTPUT.local);

                // Crear un Blob con el contenido que quieres exportar
                const blob = new Blob([fileExport], { type: 'text/plain' });

                // Crear una URL para el Blob
                const url = URL.createObjectURL(blob);

                // Crear un enlace de descarga
                const enlace = document.createElement('a');
                enlace.href = url;
                outname = OUTPUT.local.replace("/output/", "")
                enlace.download = outname;  // Establecer el nombre del archivo de descarga

                // Hacer clic en el enlace para iniciar la descarga
                enlace.click();

                // Liberar el objeto URL después de usarlo
                URL.revokeObjectURL(url);
              }).catch(error => {
                console.error("Error en la promesa de exportación:", error);
                manejarErrorExportacion(layersName, contenido, EPSG, format);
              });
            } catch (error) {
              console.error("Error en el bloque try:", error);
              manejarErrorExportacion(layersName, contenido, EPSG, format);
            }
          }
        }

        function manejarErrorExportacion(layersName, contenido, EPSG, format) {
          layersName.forEach(name => {
            const options = [
              '-f', format,
              '-t_srs', EPSG,
              '-sql', 'SELECT * from ' + name
            ];
            outputName = contenido.name.split(".")[0];
            const filePathExport = gdal.ogr2ogr(contenido.datasets[0], options, name);

            filePathExport.then((OUTPUT) => {

              if (OUTPUT.all.length === 1) {
                const fileExport = gdal.Module.FS.readFile(OUTPUT.local);
                const fileExportFormat = OUTPUT.local.split(".")[OUTPUT.local.split(".").length - 1]

                // Crear un Blob con el contenido que quieres exportar
                const blob2 = new Blob([fileExport], { type: 'text/plain' });

                filesExport.push({ name: name + "." + fileExportFormat, blob: blob2 });

              }
              else {
                OUTPUT.all.forEach(element => {
                  elementLayer = element.local.split("/")[element.local.split("/").length - 1]

                  if (elementLayer.includes(name)) {
                    const fileExport = gdal.Module.FS.readFile(element.local);
                    const fileExportFormat = element.local.split(".")[element.local.split(".").length - 1]

                    // Crear un Blob con el contenido que quieres exportar
                    const blob2 = new Blob([fileExport], { type: 'text/plain' });

                    filesExport.push({ name: name + "." + fileExportFormat, blob: blob2 });
                  }
                });

              }

              const nombresUnicos = filesExport
                .map(archivo => archivo.name.split('.')[0])  // Dividir por el punto y quedarnos con el primer valor (sin extensión)
                .filter((value, index, self) => self.indexOf(value) === index);  // Filtrar los valores únicos


              if (filesExport.length === layersName.length) {
                crearYDescargarZip(filesExport);
              } else if (nombresUnicos.length === layersName.length) {
                crearYDescargarZip(filesExport);
              }


            }).catch(error => {
              console.error("Error en la promesa de exportación por capa:", error);
            });
          });
        }

        function crearYDescargarZip(filesExport) {
          const zip = new JSZip();

          filesExport.forEach(file => {
            zip.file(file.name, file.blob);
          });

          zip.generateAsync({ type: 'blob' }).then(content => {
            const url = URL.createObjectURL(content);
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.download = outputName + '.zip';
            enlace.click();
            URL.revokeObjectURL(url);
          }).catch(error => {
            console.error("Error al generar el archivo ZIP:", error);
          });
        }

        // Llamada a la función para descargar el archivo
        descargarArchivo(datasetInExport, EPSG_out, format_out);
      };

      celda_opt_3.appendChild(botonExp);
      celda_opt_3.colSpan = 1

      panel.appendChild(table);

      // Añadir el contenido al div
      divAccordionFiles.appendChild(button);
      divAccordionFiles.appendChild(panel);

      setTimeout(() => fileUpload.classList.add("done"), 1000);
      setTimeout(() => fileUpload.classList.remove("done"), 3000);
      setTimeout(() => fileUpload.classList.remove("drop"), 3000);

    };

    reader.onerror = () => {
      console.error("Error al leer el archivo");
    };
  }

}


fileUpload.addEventListener("dragover", function () {
  this.classList.add("drag");
  this.classList.remove("drop", "done");
});

fileUpload.addEventListener("dragleave", function () {
  this.classList.remove("drag");
});

fileUpload.addEventListener("drop", start, false);
fileUpload.addEventListener("change", start, false);

function start() {
  this.classList.remove("drag");
  this.classList.add("drop");

}


async function initGdalJS() {
  // Esperamos a que gdal se haya inicializado
  await initGdalJs({ path: 'https://cdn.jsdelivr.net/npm/gdal3.js@2.8.1/dist/package', useWorker: false })
    .then((Gdal) => {
      gdal = Gdal;
      // const count = Object.keys(Gdal.drivers.raster).length + Object.keys(Gdal.drivers.vector).length;
      // console.log(count);
      // console.log(Gdal.drivers);
    })
    .catch((err) => {
      console.error("Error al inicializar GDAL:", err);
    });

  const SVGCarga = document.getElementById("cargaSVG")
  SVGCarga.hidden = true
  SVGCarga.style.visibility = "hidden"
  console.log('o- - - - -', gdal);  // Aquí ya puedes acceder a la variable gdal
}

initGdalJS()
