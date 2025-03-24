var fileUpload = document.querySelector(".upload");
var filesObj = {}
var n = 1
var gdal;  // Variable global
var gdalWorker = true;  // Variable global


async function readUrl(input) {

  const file = input.files[0];
  var EPSG_input

  if (file && gdal) {

    let imgName = file.name

    if (!gdalWorker) {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);

      reader.onload = async () => {

        const arrayBuffer = reader.result;


        try {
          if (input.value.includes('zip')) {
            try {
              gdal.Module.FS.writeFile('/input/' + imgName, new Int8Array(arrayBuffer));
              dataset = await gdal.open('/input/' + imgName, [], ['vsizip']);
              if (dataset.datasets[0] && dataset.datasets[0].info && dataset.datasets[0].info.stac && dataset.datasets[0].info.stac["proj:epsg"]) {
                EPSG_input = dataset.datasets[0]?.info?.stac?.["proj:epsg"];
                // Aquí puedes usar EPSG_input si no es undefined
              } else {
                // Mostrar el modal y esperar a que el usuario haga clic en "Aceptar"
                if (dataset.datasets[0].type == "raster") {
                  EPSG_input = await showModalAndGetEPSG();
                }

              }
            } catch (error) {
              console.error("Error al abrir el archivo comprimido:", error);
              const zip = new JSZip();
              const zipContent = await zip.loadAsync(arrayBuffer);
              const fileNames = Object.keys(zipContent.files);

              for (const fileName of fileNames) {
                const fileData = await zipContent.files[fileName].async("arraybuffer");
                gdal.Module.FS.writeFile('/input/' + fileName, new Int8Array(fileData));
              }
              for (const fileName of fileNames) {
                try {
                  dataset = await gdal.open('/input/' + fileName)
                  if (dataset.datasets[0] && dataset.datasets[0].info && dataset.datasets[0].info.stac && dataset.datasets[0].info.stac["proj:epsg"]) {
                    EPSG_input = dataset.datasets[0]?.info?.stac?.["proj:epsg"];
                    // Aquí puedes usar EPSG_input si no es undefined
                  } else {
                    // Mostrar el modal y esperar a que el usuario haga clic en "Aceptar"
                    if (dataset.datasets[0].type == "raster") {
                      EPSG_input = await showModalAndGetEPSG();
                    }
                  }
                  continue

                } catch (error) {
                  console.error("Error al abrir el archivo comprimido:", error);
                }
              }
            }
          }
          else {
            gdal.Module.FS.writeFile('/input/' + imgName, new Int8Array(arrayBuffer));
            dataset = await gdal.open('/input/' + imgName)

            if (dataset.datasets[0] && dataset.datasets[0].info && dataset.datasets[0].info.stac && dataset.datasets[0].info.stac["proj:epsg"]) {
              EPSG_input = dataset.datasets[0]?.info?.stac?.["proj:epsg"];
              // Aquí puedes usar EPSG_input si no es undefined
            } else {
              // Mostrar el modal y esperar a que el usuario haga clic en "Aceptar"
              if (dataset.datasets[0].type == "raster") {
                EPSG_input = await showModalAndGetEPSG();
              }
            }
          }
        } catch (error) {
          console.error(error);
          setTimeout(() => fileUpload.classList.add("fail"), 1000);
          setTimeout(() => fileUpload.classList.remove("fail"), 3000);
          setTimeout(() => fileUpload.classList.remove("drop"), 3000);
          return
        }
      }

      reader.onerror = () => {
        console.error("Error al leer el archivo");
      };


    } else {
      try {
        if (input.value.includes('zip')) {
          try {
            dataset = await gdal.open(file, [], ['vsizip']);
            datasetInfo = await gdal.getInfo(dataset.datasets[0]);
            if (dataset.datasets[0] && dataset.datasets[0].info && dataset.datasets[0].info.stac && dataset.datasets[0].info.stac["proj:epsg"]) {
              EPSG_input = dataset.datasets[0]?.info?.stac?.["proj:epsg"];
              // Aquí puedes usar EPSG_input si no es undefined
            } else {
              // Mostrar el modal y esperar a que el usuario haga clic en "Aceptar"
              if (dataset.datasets[0].type == "raster") {
                EPSG_input = await showModalAndGetEPSG();
              }
            }
          } catch (error) {
            console.error(error);
            const reader = new FileReader();
            reader.readAsArrayBuffer(file);

            // Usar promesas para manejar el flujo asincrónico
            await new Promise((resolve, reject) => {
              reader.onload = async () => {
                try {
                  const zip = await JSZip.loadAsync(reader.result);

                  // Extraer todos los archivos
                  let zipList = [];
                  let promises = [];

                  zip.forEach((relativePath, zipEntry) => {
                    const promise = zipEntry.async("blob").then(function (content) {
                      // Aquí, "content" será el archivo descomprimido
                      blob = new Blob([content], { type: "application/octet-stream" });
                      fileZip = new File([blob], relativePath);
                      zipList.push(fileZip);
                    });
                    promises.push(promise);
                  });

                  await Promise.all(promises);
                  dataset = await gdal.open(zipList);
                  datasetInfo = await gdal.getInfo(dataset.datasets[0]);
                  if (dataset.datasets[0] && dataset.datasets[0].info && dataset.datasets[0].info.stac && dataset.datasets[0].info.stac["proj:epsg"]) {
                    EPSG_input = dataset.datasets[0]?.info?.stac?.["proj:epsg"];
                    // Aquí puedes usar EPSG_input si no es undefined
                  } else {
                    // Mostrar el modal y esperar a que el usuario haga clic en "Aceptar"
                    if (dataset.datasets[0].type == "raster") {
                      EPSG_input = await showModalAndGetEPSG();
                    }
                  }

                  resolve();  // Resolviendo la promesa cuando termine
                } catch (error) {
                  console.error("Error al descomprimir el archivo ZIP:", error);
                  reject(error);  // Si hay un error, rechazamos la promesa
                }
              };
            });
          }
        } else {

          dataset = await gdal.open(file);
          datasetInfo = await gdal.getInfo(dataset.datasets[0]);
          if (dataset.datasets[0] && dataset.datasets[0].info && dataset.datasets[0].info.stac && dataset.datasets[0].info.stac["proj:epsg"]) {
            EPSG_input = dataset.datasets[0]?.info?.stac?.["proj:epsg"];
            // Aquí puedes usar EPSG_input si no es undefined
          } else {
            // Mostrar el modal y esperar a que el usuario haga clic en "Aceptar"
            if (dataset.datasets[0].type == "raster") {
              EPSG_input = await showModalAndGetEPSG();
            }
          }

        }

      } catch (error) {
        console.error(error);
        setTimeout(() => fileUpload.classList.add("fail"), 1000);
        setTimeout(() => fileUpload.classList.remove("fail"), 3000);
        setTimeout(() => fileUpload.classList.remove("drop"), 3000);
        return
      }

    }



    // layerGroup = new M.layer.LayerGroup({
    //   name: groupLayerName,           // Nombre del grupo de capas
    //   legend: groupLayerName,  // Leyenda asociada al grupo
    //   layers: layers    // Capas que pertenecen al grupo
    // });
    // mapajs.addLayers(layerGroup)

    if (dataset.datasets[0].type == "vector") {
      dataset.name = imgName
      groupLayerName = imgName.split(".")[0]
      layersName = dataset.datasets[0].info.layers.map(item => item.name).filter(name => name !== undefined);


      layersName.forEach(name => {
        const options = [
          '-f', 'GeoJSON',
          '-t_srs', 'EPSG:4326',
          '-sql', 'SELECT * from ' + name
        ];
        outputName = "gjson_" + groupLayerName + "_" + name
        const filePathExportGJSON = gdal.ogr2ogr(dataset.datasets[0], options, outputName);

        filePathExportGJSON.then(async (OUTPUT) => {
          // dataset.gjson = OUTPUT.local

          decoder = new TextDecoder('utf-8');



          if (gdalWorker) {

            newDataset = await gdal.getFileBytes(OUTPUT.local)
            gjson_file = JSON.parse(decoder.decode(newDataset))

          } else {
            gjson_file = JSON.parse(decoder.decode(gdal.Module.FS.readFile(OUTPUT.local)))
          }

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
    else if (dataset.datasets[0].type == "raster") {
      dataset.name = imgName.split(".")[0]
      dataset.datasets[0].info.layers = []
      dataset.datasets[0].info.layers.push({ name: imgName.split(".")[0] })

      // if (!String(EPSG_input).includes("EPSG")) {
      //   EPSG_input = "EPSG:"+EPSG_input
      // }
      const options = [
        '-of', 'GTiff',
        '-s_srs', EPSG_input,
        '-t_srs', 'EPSG:3857'
      ];
      outputName = "GTiff_" + dataset.name
      const filePathExportGJSON = gdal.gdalwarp(dataset.datasets[0], options, outputName);
      filePathExportGJSON.then(async (OUTPUT) => {

        if (gdalWorker) {

          newDataset = await gdal.getFileBytes(OUTPUT.local)
          blob_file_ = new Blob([newDataset], { type: 'application/octet-stream' });

        } else {
          blob_file_ = new Blob([gdal.Module.FS.readFile(OUTPUT.local)], { type: 'application/octet-stream' });
        }


        olLayer = new ol.layer.WebGLTile({
          source: new ol.source.GeoTIFF({
            sources: [
              {
                blob: blob_file_,
              },
            ],
          }),
        });

        GenericRaster = new M.layer.GenericRaster({
          name: dataset.name,
          legend: dataset.name,
        }, {}, olLayer);

        // La añadimos al mapa
        mapajs.addLayers(GenericRaster);
      })

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

    var cabecera1_v = document.createElement("th");
    var cabecera2_v = document.createElement("th");
    var cabecera3_v = document.createElement("th");
    var cabecera4_v = document.createElement("th");
    var cabecera5_v = document.createElement("th");

    var cabecera1_r = document.createElement("th");
    var cabecera2_r = document.createElement("th");
    var cabecera3_r = document.createElement("th");
    var cabecera4_r = document.createElement("th");
    var cabecera5_r = document.createElement("th");

    cabecera1_v.innerHTML = "Capa";
    cabecera2_v.innerHTML = "Tipo de geometría";
    cabecera3_v.innerHTML = "S.G.R.";
    cabecera4_v.innerHTML = "Número de objetos geográficos";
    cabecera5_v.innerHTML = "Número de atributos";

    cabecera1_r.innerHTML = "Capa";
    cabecera2_r.innerHTML = "Númuero de píxeles";
    cabecera3_r.innerHTML = "S.G.R.";
    cabecera4_r.innerHTML = "Número de bandas";
    cabecera5_r.innerHTML = "Compresión";




    if (dataset.datasets[0].type == "raster") {
      fila.appendChild(cabecera1_r);
      fila.appendChild(cabecera2_r);
      fila.appendChild(cabecera3_r);
      fila.appendChild(cabecera4_r);
      fila.appendChild(cabecera5_r);

      capa = dataset.datasets[0]
      var fila_n = table.insertRow();
      var celda1 = fila_n.insertCell(0);
      var celda2 = fila_n.insertCell(1);
      var celda3 = fila_n.insertCell(2);
      var celda4 = fila_n.insertCell(3);
      var celda5 = fila_n.insertCell(4);

      celda1.innerHTML = imgName;
      celda2.innerHTML = capa.info.size[0] + " x " + capa.info.size[1];
      celda3.innerHTML = EPSG_input;
      celda5.innerHTML = capa.info.bands.length;
      celda4.innerHTML = capa.info.metadata.IMAGE_STRUCTURE.COMPRESSION


    } else if (dataset.datasets[0].type == "vector") {

      // Agregamos las celdas de cabecera a la fila
      fila.appendChild(cabecera1_v);
      fila.appendChild(cabecera2_v);
      fila.appendChild(cabecera3_v);
      fila.appendChild(cabecera4_v);
      fila.appendChild(cabecera5_v);

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
    inputTextEPSG.style = "text-align: center;"
    celda_opt_2.appendChild(inputTextEPSG);
    celda_opt_2.colSpan = 2
    celda_opt_2.colSpan = 2

    let botonExp = document.createElement('button');
    botonExp.textContent = 'Exportar';
    botonExp.id = "buttonExport_" + (n - 1)
    botonExp.classList = "custom-btn btn-7 btn-exp"

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
            const filePathExport = gdal.ogr2ogr(contenido.datasets[0], options, outputName);
            filePathExport.then(async (OUTPUT) => {

              if (OUTPUT.all.length > 1) {
                manejarErrorExportacion_Vector(layersName, contenido, EPSG, format);
                return
              }

              if (gdalWorker) {

                newDataset = await gdal.getFileBytes(OUTPUT.local)
                fileExport = new Blob([newDataset], { type: 'application/octet-stream' });

              } else {
                fileExport = gdal.Module.FS.readFile(OUTPUT.local);
              }


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
              manejarErrorExportacion_Vector(layersName, contenido, EPSG, format);
            });
          } catch (error) {
            console.error("Error en el bloque try:", error);
            manejarErrorExportacion_Vector(layersName, contenido, EPSG, format);
          }
        } else if (contenido.datasets[0].type === "raster") {

          const options1 = [
            '-of', format,
            '-t_srs', EPSG,
            '-co', "WORLDFILE=YES"
          ];
          const options2 = [
            '-of', format,
            '-t_srs', EPSG,
          ];
          outputName = contenido.name.split(".")[0];

          try {
            const filePathExport = obtenerFilePathExport(contenido, options1, options2, outputName);

            filePathExport.then(async (OUTPUT) => {
              

              if (gdalWorker) {
                newDataset = await gdal.getFileBytes(OUTPUT.local)
                fileExport = new Blob([newDataset], { type: 'application/octet-stream' });

              } else {
                fileExport = gdal.Module.FS.readFile(OUTPUT.local);
              }

              console.log(OUTPUT)
              if (OUTPUT.all.length > 1) {
                console.log("más de un archivo")
                manejarErrorExportacion_Raster(OUTPUT);
                return
              }


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
            });
          } catch (error) {
            console.error("Error en el bloque try:", error);
          }




          async function obtenerFilePathExport(dataset, options1, options2, outputName) {
            let filePathExport;
          
            try {
              // Intentamos con opciones1
              filePathExport = await gdal.gdalwarp(dataset.datasets[0], options1, outputName);
            } catch (error) {
              console.log("Error con opciones1:", error);
              // Si falla, intentamos con opciones2
              try {
                filePathExport = await gdal.gdalwarp(dataset.datasets[0], options2, outputName);
              } catch (error) {
                console.log("Error con opciones2:", error);
                throw error;  // Lanzamos el error si ambas opciones fallan
              }
            }
          
            // Retornamos el resultado
            return filePathExport;
          }

        }
      }

      async function manejarErrorExportacion_Raster(OUTPUT) {
        if (OUTPUT.all.length > 1) {
          // Usamos un bucle for...of para esperar que cada operación asíncrona termine antes de pasar a la siguiente.
          for (const element of OUTPUT.all) {
            let elementLayer = await element.local.split("/")[element.local.split("/").length - 1];
      
            let fileExport;
            if (gdalWorker) {
              const newDataset = await gdal.getFileBytes(element.local);
              fileExport = new Blob([newDataset], { type: 'application/octet-stream' });
            } else {
              fileExport = await gdal.Module.FS.readFile(element.local);
            }
      
            const blob2 = new Blob([fileExport], { type: 'text/plain' });
      
            // Ahora se puede hacer push de manera segura
            await filesExport.push({ name: elementLayer, blob: blob2 });
      
            console.log(elementLayer, blob2);
          }
      
          // Una vez que todos los elementos han sido procesados, se crea y descarga el ZIP.
          await crearYDescargarZip(filesExport);
          filesExport = []; // Reiniciamos el arreglo de exportación.
        }
      }

      async function manejarErrorExportacion_Vector(layersName, contenido, EPSG, format) {

        filesExport = []; // Reiniciamos el arreglo de exportación.
    
        for (const name of layersName) {
            try {
                const options = [
                    '-f', format,
                    '-t_srs', EPSG,
                    '-sql', 'SELECT * from ' + name
                ];
    
                const outputName = contenido.name.split(".")[0];
    
                const filePathExport = await gdal.ogr2ogr(contenido.datasets[0], options, name);
    
                if (filePathExport.all.length === 1) {
                    const fileExport = await gdal.Module.FS.readFile(filePathExport.local);
                    const fileExportFormat = filePathExport.local.split(".")[filePathExport.local.split(".").length - 1];
    
                    // Crear un Blob con el contenido que quieres exportar
                    const blob2 = new Blob([fileExport], { type: 'text/plain' });
    
                    filesExport.push({ name: name + "." + fileExportFormat, blob: blob2 });
                } else {
                    for (const element of filePathExport.all) {
                        const elementLayer = await element.local.split("/")[element.local.split("/").length - 1];
    
                        if (elementLayer.includes(name)) {
                            let fileExport;
    
                            if (gdalWorker) {
                                const newDataset = await gdal.getFileBytes(element.local);
                                fileExport = new Blob([newDataset], { type: 'application/octet-stream' });
                            } else {
                                fileExport = await gdal.Module.FS.readFile(element.local);
                            }
    
                            const fileExportFormat = element.local.split(".")[element.local.split(".").length - 1];
    
                            // Crear un Blob con el contenido que quieres exportar
                            const blob2 = new Blob([fileExport], { type: 'text/plain' });
    
                            filesExport.push({ name: name + "." + fileExportFormat, blob: blob2 });
                        }
                    }
                }
    
                const nombresUnicos = filesExport
                    .map(archivo => archivo.name.split('.')[0])  // Dividir por el punto y quedarnos con el primer valor (sin extensión)
                    .filter((value, index, self) => self.indexOf(value) === index);  // Filtrar los valores únicos
    
    
                // Llamar a crearYDescargarZip cuando se haya exportado todo correctamente
                if (filesExport.length === layersName.length || nombresUnicos.length === layersName.length) {
                    crearYDescargarZip(filesExport);
                }
    
            } catch (error) {
                console.error("Error en la promesa de exportación por capa:", error);
            }
        }
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

  function showModalAndGetEPSG() {
    return new Promise((resolve) => {
      const modal = document.getElementById("epsgModal");
      const span = document.getElementsByClassName("close")[0];
      const acceptButton = document.getElementById("acceptButton");

      modal.style.display = "block";

      span.onclick = function () {
        modal.style.display = "none";
      };

      window.onclick = function (event) {
        if (event.target == modal) {
          modal.style.display = "none";
        }
      };

      acceptButton.onclick = function () {
        const EPSG_input = document.getElementById("inputTextEPSG").value;
        modal.style.display = "none";
        resolve(EPSG_input);
      };
    });
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


async function initGdalJS_() {

  const workerData = await fetch('../../js/gdal/gdal3.js');
  const workerUrl = window.URL.createObjectURL(await workerData.blob());

  const paths = {
    wasm: '../../js/gdal/gdal3WebAssembly.wasm',
    data: '../../js/gdal/gdal3WebAssembly.data',
    js: '../../js/gdal/gdal3.js',
    // js: '../../js/gdal/gdal3.node.js',
  };

  // Esperamos a que gdal se haya inicializado
  await initGdalJs({
    // path: '../../js/gdal',
    paths: paths,
    useWorker: gdalWorker
  })
    .then((Gdal) => {

      gdal = Gdal;

      // const count = Object.keys(Gdal.drivers.raster).length + Object.keys(Gdal.drivers.vector).length;
      // console.log(count);
      // console.log(Gdal)
      // console.log(Gdal.drivers);
      // console.log(gdal)
      // console.log(gdal.drivers);
    })
    .catch((err) => {
      console.error("Error al inicializar GDAL:", err);
    });



  const SVGCarga = document.getElementById("cargaSVG")
  SVGCarga.hidden = true
  SVGCarga.style.visibility = "hidden"
  console.log('o:   gdal - - - - -', gdal);  // Aquí ya puedes acceder a la variable gdal
}


initGdalJS_()
