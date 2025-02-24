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
      console.log("Archivo cargado como ArrayBuffer:", arrayBuffer);


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
      console.log("dataset: ", dataset)
      groupLayerName = imgName.split(".")[0]

      // layerGroup = new M.layer.LayerGroup({
      //   name: groupLayerName,           // Nombre del grupo de capas
      //   legend: groupLayerName,  // Leyenda asociada al grupo
      //   layers: layers    // Capas que pertenecen al grupo
      // });
      // mapajs.addLayers(layerGroup)

      layersName = dataset.datasets[0].info.layers.map(item => item.name).filter(name => name !== undefined);

      layersName.forEach(name => {
        console.log(name);
        const options = [
          '-f', 'GeoJSON',
          '-t_srs', 'EPSG:4326',
          '-sql', 'SELECT * from ' + name
        ];
        outputName = "gjson_" + groupLayerName + "_" + name
        const filePathExportGJSON = gdal.ogr2ogr(dataset.datasets[0], options, outputName);

        filePathExportGJSON.then((OUTPUT) => {
          console.log(OUTPUT);
          // dataset.gjson = OUTPUT.local

          decoder = new TextDecoder('utf-8');

          gjson_file = JSON.parse(decoder.decode(gdal.Module.FS.readFile(OUTPUT.local)))

          console.log(gjson_file)

          capa = new M.layer.GeoJSON({
            name: name,
            legend: groupLayerName + "_" +name,
            source: gjson_file,
            extract: true
          })
          mapajs.addLayers(capa)
          // layerGroup.addLayers(capa)

        })

      });

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

      const ul = document.createElement("ul");
      ul.className = "a";

      const li = document.createElement("li");
      li.innerHTML = `La documentación de la librería gdaljs utilizada está disponible <a href="https://gdal3.js.org/docs/" target="_blank">aquí</a>`;

      ul.appendChild(li);
      panel.appendChild(ul);

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
