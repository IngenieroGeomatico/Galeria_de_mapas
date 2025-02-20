var fileUpload = document.querySelector(".upload");
var filesObj={}
var n = 1
var gdal;  // Variable global

function readUrl(input) {
  
  const file = input.files[0];

  if (file && gdal) {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      
      reader.onload = async () =>{
          const arrayBuffer = reader.result;
          console.log("Archivo cargado como ArrayBuffer:", arrayBuffer);

          
          try {
            if(input.value.includes('zip' )){
              gdal.Module.FS.writeFile('/input/file.zip', new Int8Array(arrayBuffer) );
              dataset = await gdal.open('/input/file.zip',[],['vsizip'])
            }
            else{
                gdal.Module.FS.writeFile('/input/file.file', new Int8Array(arrayBuffer) );
                dataset = await gdal.open('/input/file.file')
            }
          } catch (error) {
            console.error(error);
            setTimeout(() => fileUpload.classList.add("fail"), 1000);
            setTimeout(() => fileUpload.classList.remove("fail"), 3000);
            setTimeout(() => fileUpload.classList.remove("drop"), 3000);
            return
          }

          console.log("dataset: ", dataset)

          let imgName = file.name
          arrayBuffer.name = imgName
          filesObj[n] = arrayBuffer
          n+=1

          setTimeout(() => fileUpload.classList.add("done"), 1000);
          setTimeout(() => fileUpload.classList.remove("done"), 3000);
          setTimeout(() => fileUpload.classList.remove("drop"), 3000);

      };

      reader.onerror = () => {
          console.error("Error al leer el archivo");
      };
  }

}


fileUpload.addEventListener("dragover", function() {
  this.classList.add("drag");
  this.classList.remove("drop", "done");
});

fileUpload.addEventListener("dragleave", function() {
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
