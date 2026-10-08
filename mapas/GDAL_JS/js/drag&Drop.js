'use strict';

(function () {
  const fileUpload = document.querySelector('.upload');
  const filesObj = {};
  let fileIndex = 1;

  // Variables globales compartidas
  window.gdalWorker = window.gdalWorker !== undefined ? window.gdalWorker : true;
  window.gdal = window.gdal || null;

  // Utilidades para aleatoriedad de estilos
  function rndInt0_255() {
    return (Math.floor(Math.random() * 255) + 1).toString();
  }

  function createRandomStyle() {
    const r1 = rndInt0_255();
    const r2 = rndInt0_255();
    const r3 = rndInt0_255();
    const colorFill = `rgba(${r1},${r2},${r3},0.8)`;
    const colorStroke = `rgba(${r1},${r2},${r3},0.8)`;

    return new M.style.Generic({
      point: {
        radius: 7,
        fill: {
          color: colorFill,
          opacity: 0.8,
        },
        stroke: {
          color: colorStroke,
          width: 2,
          opacity: 1,
        },
      },
      polygon: {
        fill: {
          color: colorFill,
          opacity: 0.8,
        },
        stroke: {
          color: colorStroke,
          width: 2,
          opacity: 1,
        },
      },
      line: {
        fill: {
          color: colorFill,
          opacity: 0.8,
        },
        stroke: {
          color: colorStroke,
          width: 2,
          opacity: 1,
        },
      },
    });
  }

  // Modal para solicitar EPSG cuando no está disponible
  function showModalAndGetEPSG() {
    return new Promise((resolve) => {
      const modal = document.getElementById('epsgModal');
      if (!modal) {
        resolve('EPSG:4326');
        return;
      }

      const closeBtn = modal.querySelector('.close');
      const acceptButton = document.getElementById('acceptButton');
      const inputEPSG = document.getElementById('inputTextEPSG');

      modal.style.display = 'block';

      function closeModal() {
        modal.style.display = 'none';
        if (closeBtn) closeBtn.removeEventListener('click', closeModal);
        window.removeEventListener('click', onWindowClick);
        if (acceptButton) acceptButton.removeEventListener('click', onAccept);
      }

      function onWindowClick(event) {
        if (event.target === modal) {
          closeModal();
        }
      }

      function onAccept() {
        const epsgValue = inputEPSG ? inputEPSG.value.trim() : 'EPSG:4326';
        closeModal();
        resolve(epsgValue || 'EPSG:4326');
      }

      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      window.addEventListener('click', onWindowClick);
      if (acceptButton) acceptButton.addEventListener('click', onAccept);
    });
  }

  // Lee bytes de salida según worker/no-worker
  async function readOutputBytes(output) {
    if (!output || !output.local) return null;

    if (window.gdalWorker) {
      try {
        return await window.gdal.getFileBytes(output.local);
      } catch (error) {
        console.error('Error al obtener bytes con getFileBytes:', error);
        return null;
      }
    } else {
      try {
        return window.gdal.Module.FS.readFile(output.local);
      } catch (error) {
        console.error('Error al leer FS:', error);
        return null;
      }
    }
  }

  // Inicialización de GDAL.js
  async function initGdalJS_() {
    let useWorker = window.gdalWorker;

    if (location.protocol === 'file:') {
      useWorker = false;
    } else {
      try {
        const workerData = await fetch('../../js/gdal/gdal3.js');
        await workerData.blob();
      } catch (e) {
        console.warn('No se pudo crear blob URL del worker, ejecutando sin worker:', e);
        useWorker = false;
      }
    }

    window.gdalWorker = useWorker;

    const path = 'https://cdn.jsdelivr.net/npm/gdal3.js@2.8.1/dist/package';
    const pathsConfig = {
      wasm: `${path}/gdal3WebAssembly.wasm`,
      data: `${path}/gdal3WebAssembly.data`,
      js: '../../js/gdal/gdal3.js',
    };

    try {
      const Gdal = await initGdalJs({
        paths: pathsConfig,
        useWorker: window.gdalWorker,
      });

      window.gdal = Gdal;
      // Notificar a otros scripts que GDAL está listo (compat con navegadores antiguos)
      try {
        document.dispatchEvent(new CustomEvent('gdal-ready', { detail: { gdal: Gdal } }));
      } catch (e) {
        const ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('gdal-ready', false, false, { gdal: Gdal });
        document.dispatchEvent(ev);
      }
    } catch (err) {
      console.error('Error al inicializar GDAL:', err);
    }

    const SVGCarga = document.getElementById('cargaSVG');
    if (SVGCarga) {
      SVGCarga.hidden = true;
      SVGCarga.style.visibility = 'hidden';
    }
    // Asegurar que info.js pueda leer drivers tras init
    try {
      if (window.gdal) {
        document.dispatchEvent(new CustomEvent('gdal-ready', { detail: { gdal: window.gdal } }));
      }
    } catch (e) {}
  }

  // Procesado de datasets para mostrar capas en mapa y construir UI
  async function processDataset(dataset, imgName, epsgInput) {
    const ds0 = dataset.datasets && dataset.datasets[0];
    if (!ds0) return;

    if (ds0.type === 'vector') {
      dataset.name = imgName;
      const groupLayerName = imgName.split('.')[0];
      const layersInfo = ds0.info && ds0.info.layers ? ds0.info.layers : [];
      let layersName = layersInfo.map((item) => item.name).filter((name) => name !== undefined);
      // Fallback: si no hay capas con nombre, intentar obtener info general o usar nombre base
      if (layersName.length === 0 && ds0.info && ds0.info.dataset) {
        // intentar
      }
      if (layersName.length === 0) {
        layersName = [groupLayerName];
      }

      const promisesVec = layersName.map((name) => {
        const safeName = name.replace(/"/g, '""');
        const optionsExport = [
        '-f',
        'GeoJSON',
        '-t_srs',
        'EPSG:4326',
      ];
        const outputNameGjson = `gjson_${groupLayerName}_${safeName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        return window.gdal.ogr2ogr(ds0, optionsExport, outputNameGjson)
          .then(async (OUTPUT) => {
            try {
              const decoder = new TextDecoder('utf-8');
              let gjsonFile;

              if (window.gdalWorker) {
                const newDatasetBytes = await window.gdal.getFileBytes(OUTPUT.local);
                gjsonFile = JSON.parse(decoder.decode(newDatasetBytes));
              } else {
                const fsData = window.gdal.Module.FS.readFile(OUTPUT.local);
                gjsonFile = JSON.parse(decoder.decode(fsData));
              }

              const capaGeoJSON = new M.layer.GeoJSON({
                name: name,
                legend: `${groupLayerName}_${name}`,
                source: gjsonFile,
                extract: true,
              });

              const estilo1 = createRandomStyle();
              capaGeoJSON.setStyle(estilo1);
              const mapRef = window.mapajs || (typeof mapajs !== 'undefined' ? mapajs : null);
              if (mapRef && typeof mapRef.addLayers === 'function') {
                mapRef.addLayers(capaGeoJSON);
              }
              // Ir a mapa tras añadir capa
              try {
                const mapaLink = document.getElementById('Mapa');
                if (mapaLink) mapaLink.click();
              } catch (e) {}
            } catch (e) {
              console.error('Error parseando GeoJSON exportado:', e);
            }
          })
          .catch((error) => {
            console.error('Error al exportar a GeoJSON:', error);
          });
      });
      await Promise.allSettled(promisesVec);
    } else if (ds0.type === 'raster') {
      dataset.name = imgName.split('.')[0];
      if (!ds0.info) ds0.info = {};
      ds0.info.layers = [];
      ds0.info.layers.push({ name: imgName.split('.')[0] });

      let optionsWarp = [
        '-of',
        'GTiff',
      ];
      // Solo asignar s_srs si es válido; para muchos COG el CRS puede leerse internamente
      if (epsgInput && String(epsgInput).trim() !== '') {
        const srs = String(epsgInput).trim();
        if (!srs.match(/^(unknown|undefined)$/i)) {
          optionsWarp.push('-s_srs', srs);
        }
      }
      // No forzamos -t_srs para evitar reproyecciones problemáticas con COG; si falla, probamos con EPSG:3857
      const optionsWarpT3857 = ['-of', 'GTiff', '-t_srs', 'EPSG:3857'];
      if (optionsWarp.includes('-s_srs')) {
        optionsWarpT3857.push('-s_srs', optionsWarp[optionsWarp.indexOf('-s_srs') + 1]);
      }
      const outputNameGTiff = `GTiff_${dataset.name}`;

      try {
        let filePathExportWarp;
        try {
          // Intento 1: solo convertir a GTiff (sin reproyectar) - más robusto para COG
          filePathExportWarp = await window.gdal.gdalwarp(ds0, ['-of', 'GTiff'], outputNameGTiff);
        } catch (e1) {
          try {
            // Intento 2: sin forzar s_srs, con t_srs opcional fuera
            filePathExportWarp = await window.gdal.gdalwarp(ds0, optionsWarp, outputNameGTiff);
          } catch (e2) {
            try {
              // Intento 3: forzar EPSG:3857 como destino
              filePathExportWarp = await window.gdal.gdalwarp(ds0, optionsWarpT3857, outputNameGTiff);
            } catch (e3) {
              throw e3;
            }
          }
        }
        let blobFile;
        if (window.gdalWorker) {
          const newDatasetBytes = await window.gdal.getFileBytes(filePathExportWarp.local);
          blobFile = new Blob([newDatasetBytes], { type: 'application/octet-stream' });
        } else {
          const fsData = window.gdal.Module.FS.readFile(filePathExportWarp.local);
          blobFile = new Blob([fsData], { type: 'application/octet-stream' });
        }

        const olLayer = new ol.layer.WebGLTile({
          source: new ol.source.GeoTIFF({
            sources: [
              {
                blob: blobFile,
              },
            ],
          }),
        });

        const genericRaster = new M.layer.GenericRaster(
          {
            name: dataset.name,
            legend: dataset.name,
          },
          {},
          olLayer
        );

        const mapRef = window.mapajs || (typeof mapajs !== 'undefined' ? mapajs : null);
        if (mapRef && typeof mapRef.addLayers === 'function') {
          mapRef.addLayers(genericRaster);
        }
        // Intentar añadir también como capa Cesium si el visor está en modo 3D
        try {
          const impl = mapRef && mapRef.getMapImpl ? mapRef.getMapImpl() : null;
          if (impl && impl.scene && typeof Cesium !== 'undefined') {
            // Añadir inmediatamente y volver a intentar tras cambio de implementación si aplica
            async function addToCesium() {
              let provider = null;
              try {
                if (Cesium.GeoTIFFImageryProvider) {
                  if (typeof Cesium.GeoTIFFImageryProvider.fromBlob === 'function') {
                    provider = await Cesium.GeoTIFFImageryProvider.fromBlob(blobFile);
                  } else if (typeof Cesium.GeoTIFFImageryProvider.fromUrlOrBlob === 'function') {
                    provider = await Cesium.GeoTIFFImageryProvider.fromUrlOrBlob(blobFile);
                  }
                }
              } catch (provErr) {
                provider = null;
                console.warn('Error creando GeoTIFFImageryProvider:', provErr);
              }
              if (provider) {
                try {
                  impl.imageryLayers.addImageryProvider(provider);
                } catch (addErr) {
                  console.warn('Error añadiendo imageryProvider a Cesium:', addErr);
                }
              }
            }
            await addToCesium();
            setTimeout(addToCesium, 1200);
          }
        } catch (cesErr) {
          // Silencioso: solo afecta a 3D
        }
        try {
          const mapaLink = document.getElementById('Mapa');
          if (mapaLink) mapaLink.click();
        } catch (e) {}
      } catch (error) {
        console.error('Error al reproyectar ráster:', error);
      }
    }
  }

  // Construye acordeón de archivos subidos
  function buildAccordionFiles(dataset, imgName, epsgInput) {
    const divAccordionFiles = document.getElementById('accordionFiles');
    if (!divAccordionFiles) return;

    const ds0 = dataset.datasets && dataset.datasets[0];
    if (!ds0) return;

    // Botón acordeón
    const buttonAcc = document.createElement('button');
    buttonAcc.className = 'accordion';
    buttonAcc.textContent = `${ds0.type} - ${imgName}`;
    buttonAcc.addEventListener('click', function () {
      this.classList.toggle('active');
      const panel = this.nextElementSibling;
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });

    // Panel
    const panelAcc = document.createElement('div');
    panelAcc.className = 'panel';

    const table = document.createElement('table');

    // Cabeceras
    const filaCab = table.insertRow();
    if (ds0.type === 'raster') {
      const cab1 = document.createElement('th');
      const cab2 = document.createElement('th');
      const cab3 = document.createElement('th');
      const cab4 = document.createElement('th');
      const cab5 = document.createElement('th');
      cab1.innerHTML = 'Capa';
      cab2.innerHTML = 'Númuero de píxeles';
      cab3.innerHTML = 'S.G.R.';
      cab4.innerHTML = 'Número de bandas';
      cab5.innerHTML = 'Compresión';
      filaCab.appendChild(cab1);
      filaCab.appendChild(cab2);
      filaCab.appendChild(cab3);
      filaCab.appendChild(cab4);
      filaCab.appendChild(cab5);

      const filaN = table.insertRow();
      const c1 = filaN.insertCell(0);
      const c2 = filaN.insertCell(1);
      const c3 = filaN.insertCell(2);
      const c4 = filaN.insertCell(3);
      const c5 = filaN.insertCell(4);
      c1.innerHTML = imgName;
      c2.innerHTML = `${ds0.info.size[0]} x ${ds0.info.size[1]}`;
      c3.innerHTML = epsgInput;
      c4.innerHTML = ds0.info.bands.length;
      c5.innerHTML = ds0.info.metadata && ds0.info.metadata.IMAGE_STRUCTURE ? ds0.info.metadata.IMAGE_STRUCTURE.COMPRESSION : '-';
    } else if (ds0.type === 'vector') {
      const cab1 = document.createElement('th');
      const cab2 = document.createElement('th');
      const cab3 = document.createElement('th');
      const cab4 = document.createElement('th');
      const cab5 = document.createElement('th');
      cab1.innerHTML = 'Capa';
      cab2.innerHTML = 'Tipo de geometría';
      cab3.innerHTML = 'S.G.R.';
      cab4.innerHTML = 'Número de objetos geográficos';
      cab5.innerHTML = 'Número de atributos';
      filaCab.appendChild(cab1);
      filaCab.appendChild(cab2);
      filaCab.appendChild(cab3);
      filaCab.appendChild(cab4);
      filaCab.appendChild(cab5);

      const layersInfoV = ds0.info && ds0.info.layers ? ds0.info.layers : [];
      for (let capaN = 0; capaN < layersInfoV.length; capaN++) {
        const capa = layersInfoV[capaN];
        if (capa.name) {
          const filaN = table.insertRow();
          const c1 = filaN.insertCell(0);
          const c2 = filaN.insertCell(1);
          const c3 = filaN.insertCell(2);
          const c4 = filaN.insertCell(3);
          const c5 = filaN.insertCell(4);
          c1.innerHTML = capa.name;
          const geomField = capa.geometryFields && capa.geometryFields[0];
          c2.innerHTML = geomField ? geomField.type : 'Sin geometría';
          try {
            const projjson = geomField.coordinateSystem.projjson;
            c3.innerHTML = `${projjson.id.authority}:${projjson.id.code}`;
          } catch (_) {
            c3.innerHTML = '-';
          }
          c4.innerHTML = capa.featureCount;
          c5.innerHTML = capa.fields ? capa.fields.length : 0;
        }
      }
    }

    // Separador y cabecera exportación
    const filaSep = table.insertRow();
    const celdaSep = document.createElement('td');
    celdaSep.colSpan = 5;
    filaSep.appendChild(celdaSep);

    const filaCabExp = table.insertRow();
    const celdaCabExp = document.createElement('th');
    celdaCabExp.colSpan = 5;
    celdaCabExp.style.textAlign = 'center';
    celdaCabExp.innerHTML = 'Opciones de exportación';
    filaCabExp.appendChild(celdaCabExp);

    const filaExp = table.insertRow();
    const celdaExp1 = document.createElement('th');
    const celdaExp2 = document.createElement('th');
    const celdaExp3 = document.createElement('th');
    celdaExp1.colSpan = 2;
    celdaExp2.colSpan = 2;
    celdaExp3.colSpan = 1;
    celdaExp1.innerHTML = 'Formato exportación';
    celdaExp2.innerHTML = 'S.G.R. Exportación';
    celdaExp3.innerHTML = 'Exportar';
    filaExp.appendChild(celdaExp1);
    filaExp.appendChild(celdaExp2);
    filaExp.appendChild(celdaExp3);

    const filaExpOpt = table.insertRow();
    const celdaOpt1 = filaExpOpt.insertCell(0);
    const celdaOpt2 = filaExpOpt.insertCell(1);
    const celdaOpt3 = filaExpOpt.insertCell(2);

    // Select formato
    const selectFormat = document.createElement('select');
    const vectoresDrivers = window.gdal.drivers.vector;
    const rasterDrivers = window.gdal.drivers.raster;

    if (ds0.type === 'raster') {
      for (const format in rasterDrivers) {
        if (Object.prototype.hasOwnProperty.call(rasterDrivers, format)) {
          const option = document.createElement('option');
          option.value = format;
          option.textContent = rasterDrivers[format].longName;
          selectFormat.appendChild(option);
        }
      }
    } else if (ds0.type === 'vector') {
      for (const format in vectoresDrivers) {
        if (Object.prototype.hasOwnProperty.call(vectoresDrivers, format)) {
          const option = document.createElement('option');
          option.value = format;
          option.textContent = vectoresDrivers[format].longName;
          if (format === 'GeoJSON') {
            option.selected = true;
          }
          if (vectoresDrivers[format].isWritable === true) {
            selectFormat.appendChild(option);
          }
        }
      }
    }

    celdaOpt1.appendChild(selectFormat);
    celdaOpt1.colSpan = 2;
    celdaOpt1.id = `outputFormat_${fileIndex - 1}`;

    const inputTextEPSGOut = document.createElement('input');
    inputTextEPSGOut.type = 'text';
    inputTextEPSGOut.value = 'EPSG:4326';
    inputTextEPSGOut.id = `InputTextEpsg_${fileIndex - 1}`;
    inputTextEPSGOut.style.textAlign = 'center';
    celdaOpt2.appendChild(inputTextEPSGOut);
    celdaOpt2.colSpan = 2;

    const botonExp = document.createElement('button');
    botonExp.textContent = 'Exportar';
    botonExp.id = `buttonExport_${fileIndex - 1}`;
    botonExp.classList = 'custom-btn btn-7 btn-exp';

    botonExp.onclick = function (e) {
      const idExport = e.target.id.split('_')[1];
      const datasetInExport = filesObj[idExport];
      if (!datasetInExport) return;

      const epsgOutEl = document.getElementById(`InputTextEpsg_${idExport}`);
      const formatOutEl = document.getElementById(`outputFormat_${idExport}`);
      const epsgOut = epsgOutEl ? epsgOutEl.value : 'EPSG:4326';
      const formatOut = formatOutEl && formatOutEl.children[0] ? formatOutEl.children[0].value : 'GeoJSON';

      downloadDataset(datasetInExport, epsgOut, formatOut, imgName);
    };

    celdaOpt3.appendChild(botonExp);
    celdaOpt3.colSpan = 1;

    panelAcc.appendChild(table);
    divAccordionFiles.appendChild(buttonAcc);
    divAccordionFiles.appendChild(panelAcc);
  }

  // Exportación y descarga (incluye manejo ZIP)
  function crearYDescargarZip(filesExportList, outputBaseName) {
    const zip = new JSZip();
    filesExportList.forEach((file) => {
      zip.file(file.name, file.blob);
    });
    zip.generateAsync({ type: 'blob' }).then((content) => {
      const url = URL.createObjectURL(content);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${outputBaseName}.zip`;
      enlace.click();
      URL.revokeObjectURL(url);
    }).catch((error) => {
      console.error('Error al generar el archivo ZIP:', error);
    });
  }

  async function manejarErrorExportacion_Raster(OUTPUT, outputBaseName) {
    const filesExportList = [];
    if (OUTPUT.all && OUTPUT.all.length > 1) {
      for (const element of OUTPUT.all) {
        const parts = element.local.split('/');
        const elementLayer = parts[parts.length - 1];
        let fileExportBlob;
        if (window.gdalWorker) {
          const newDatasetBytes = await window.gdal.getFileBytes(element.local);
          fileExportBlob = new Blob([newDatasetBytes], { type: 'application/octet-stream' });
        } else {
          fileExportBlob = await window.gdal.Module.FS.readFile(element.local);
        }
        filesExportList.push({ name: elementLayer, blob: fileExportBlob });
      }
      await crearYDescargarZip(filesExportList, outputBaseName);
    }
  }

  async function manejarErrorExportacion_Vector(layersName, contenido, EPSG, format, outputBaseName) {
    const filesExportList = [];
    const ds0 = contenido.datasets && contenido.datasets[0];
    if (!ds0) return;

    for (const name of layersName) {
      try {
        const optionsSql = [
          '-f',
          format,
          '-t_srs',
          EPSG,
          '-sql',
          `SELECT * from "${name}"`,
        ];
        const filePathExport = await window.gdal.ogr2ogr(ds0, optionsSql, name);

        if (filePathExport.all.length === 1) {
          let fileExportData;
          if (window.gdalWorker) {
            fileExportData = await window.gdal.getFileBytes(filePathExport.local);
          } else {
            fileExportData = await window.gdal.Module.FS.readFile(filePathExport.local);
          }
          const extParts = filePathExport.local.split('.');
          const fileExportFormat = extParts[extParts.length - 1];
          const blob2 = new Blob([fileExportData], { type: 'application/octet-stream' });
          filesExportList.push({ name: `${name}.${fileExportFormat}`, blob: blob2 });
        } else {
          for (const element of filePathExport.all) {
            const parts = element.local.split('/');
            const elementLayer = parts[parts.length - 1];
            if (elementLayer.includes(name)) {
              let fileExportData;
              if (window.gdalWorker) {
                fileExportData = await window.gdal.getFileBytes(element.local);
              } else {
                fileExportData = await window.gdal.Module.FS.readFile(element.local);
              }
              const extParts = element.local.split('.');
              const fileExportFormat = extParts[extParts.length - 1];
              const blob2 = new Blob([fileExportData], { type: 'application/octet-stream' });
              filesExportList.push({ name: `${name}.${fileExportFormat}`, blob: blob2 });
            }
          }
        }

        const nombresUnicos = filesExportList
          .map((archivo) => archivo.name.split('.')[0])
          .filter((value, index, self) => self.indexOf(value) === index);

        if (filesExportList.length === layersName.length || nombresUnicos.length === layersName.length) {
          crearYDescargarZip(filesExportList, outputBaseName);
        }
      } catch (error) {
        console.error('Error en la exportación por capa:', error);
      }
    }
  }

  async function obtenerFilePathExport(dataset, options1, options2, outputName) {
    try {
      return await window.gdal.gdalwarp(dataset.datasets[0], options1, outputName);
    } catch (error) {
      try {
        return await window.gdal.gdalwarp(dataset.datasets[0], options2, outputName);
      } catch (error2) {
        throw error2;
      }
    }
  }

  function downloadDataset(datasetInExport, epsgOut, formatOut, imgName) {
    const ds0Exp = datasetInExport.datasets && datasetInExport.datasets[0];
    if (!ds0Exp) return;

    const outputBaseName = datasetInExport.name ? datasetInExport.name.split('.')[0] : imgName.split('.')[0];

    if (ds0Exp.type === 'vector') {
      const optionsVec = [
        '-f',
        formatOut,
        '-t_srs',
        epsgOut,
      ];
      const outputNameVec = outputBaseName;

      try {
        const filePathExportVec = window.gdal.ogr2ogr(ds0Exp, optionsVec, outputNameVec);
        filePathExportVec
          .then(async (OUTPUT) => {
            const layersInfoV = ds0Exp.info && ds0Exp.info.layers ? ds0Exp.info.layers : [];
            const layersNameV = layersInfoV.map((item) => item.name).filter((name) => name !== undefined);

            if (OUTPUT.all && OUTPUT.all.length > 1) {
              await manejarErrorExportacion_Vector(layersNameV, datasetInExport, epsgOut, formatOut, outputBaseName);
              return;
            }

            let fileExportData;
            if (window.gdalWorker) {
              fileExportData = await window.gdal.getFileBytes(OUTPUT.local);
            } else {
              fileExportData = window.gdal.Module.FS.readFile(OUTPUT.local);
            }

            const blobExp = new Blob([fileExportData], { type: 'application/octet-stream' });
            const urlExp = URL.createObjectURL(blobExp);
            const enlaceExp = document.createElement('a');
            enlaceExp.href = urlExp;
            const outname = OUTPUT.local.replace('/output/', '');
            enlaceExp.download = outname;
            enlaceExp.click();
            URL.revokeObjectURL(urlExp);
          })
          .catch(async (error) => {
            console.error('Error en exportación vectorial:', error);
            const layersInfoV = ds0Exp.info && ds0Exp.info.layers ? ds0Exp.info.layers : [];
            const layersNameV = layersInfoV.map((item) => item.name).filter((name) => name !== undefined);
            await manejarErrorExportacion_Vector(layersNameV, datasetInExport, epsgOut, formatOut, outputBaseName);
          });
      } catch (error) {
        console.error('Error bloque try vector:', error);
      }
    } else if (ds0Exp.type === 'raster') {
      const options1R = [
        '-of',
        formatOut,
        '-t_srs',
        epsgOut,
        '-co',
        'WORLDFILE=YES',
      ];
      const options2R = [
        '-of',
        formatOut,
        '-t_srs',
        epsgOut,
      ];
      const outputNameR = outputBaseName;

      try {
        const filePathExportR = obtenerFilePathExport(datasetInExport, options1R, options2R, outputNameR);
        filePathExportR
          .then(async (OUTPUT) => {
            if (OUTPUT.all && OUTPUT.all.length > 1) {
              await manejarErrorExportacion_Raster(OUTPUT, outputBaseName);
              return;
            }

            let fileExportData;
            if (window.gdalWorker) {
              fileExportData = await window.gdal.getFileBytes(OUTPUT.local);
            } else {
              fileExportData = window.gdal.Module.FS.readFile(OUTPUT.local);
            }

            const blobExp = new Blob([fileExportData], { type: 'application/octet-stream' });
            const urlExp = URL.createObjectURL(blobExp);
            const enlaceExp = document.createElement('a');
            enlaceExp.href = urlExp;
            const outname = OUTPUT.local.replace('/output/', '');
            enlaceExp.download = outname;
            enlaceExp.click();
            URL.revokeObjectURL(urlExp);
          })
          .catch((error) => {
            console.error('Error en exportación ráster:', error);
          });
      } catch (error) {
        console.error('Error bloque try ráster:', error);
      }
    }
  }

  // Lectura y procesamiento de archivo
  async function readUrl(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file) return;
    // Asegurarse de que GDAL esté inicializado antes de continuar
    if (!window.gdal) {
      try {
        await initGdalJS_();
      } catch (e) {
        console.error('Error inicializando GDAL:', e);
        if (fileUpload) {
          setTimeout(() => fileUpload.classList.add('fail'), 100);
          setTimeout(() => fileUpload.classList.remove('fail'), 2500);
          setTimeout(() => fileUpload.classList.remove('drop'), 2500);
        }
        return;
      }
    }

    const imgName = file.name;
    let datasetResult = null;
    let epsgInputResult = null;

    try {
      if (window.gdalWorker) {
        // Modo worker
        const isZip = input.value.toLowerCase().includes('.zip') || file.name.toLowerCase().endsWith('.zip');
        if (isZip) {
          try {
            datasetResult = await window.gdal.open(file, [], ['vsizip']);
          } catch (errorZipTry) {
            datasetResult = null;
          }
          if (datasetResult) {
            const ds0w = datasetResult.datasets && datasetResult.datasets[0];
            if (ds0w && ds0w.info && ds0w.info.stac && ds0w.info.stac['proj:epsg']) {
              epsgInputResult = ds0w.info.stac['proj:epsg'];
            } else if (ds0w && ds0w.type === 'raster') {
              epsgInputResult = await showModalAndGetEPSG();
          } else if (ds0f && ds0f.type === 'raster') {
            // Intentar no forzar s_srs si no se pudo obtener
            epsgInputResult = undefined;
            } else {
              epsgInputResult = undefined;
            }
          } else {
            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            await new Promise((resolve, reject) => {
              reader.onload = async () => {
                try {
                  const zip = await JSZip.loadAsync(reader.result);
                  const zipList = [];
                  const promisesZip = [];
                  zip.forEach((relativePath, zipEntry) => {
                    if (zipEntry.dir) return;
                    const p = zipEntry.async('blob').then((content) => {
                      const blobZ = new Blob([content], { type: 'application/octet-stream' });
                      const fileZ = new File([blobZ], relativePath);
                      zipList.push(fileZ);
                    });
                    promisesZip.push(p);
                  });
                  await Promise.all(promisesZip);
                  datasetResult = await window.gdal.open(zipList);
                  const ds0z = datasetResult.datasets && datasetResult.datasets[0];
                  if (ds0z && ds0z.info && ds0z.info.stac && ds0z.info.stac['proj:epsg']) {
                    epsgInputResult = ds0z.info.stac['proj:epsg'];
                  } else if (ds0z && ds0z.type === 'raster') {
                    epsgInputResult = await showModalAndGetEPSG();
          } else if (ds0f && ds0f.type === 'raster') {
            // Intentar no forzar s_srs si no se pudo obtener
            epsgInputResult = undefined;
                  }
                  resolve();
                } catch (e) {
                  reject(e);
                }
              };
            });
          }
        } else {
          try {
            datasetResult = await window.gdal.open(file);
          } catch (e) {
            datasetResult = null;
          }
          if (datasetResult) {
            const ds0f = datasetResult.datasets && datasetResult.datasets[0];
            if (ds0f && ds0f.info && ds0f.info.stac && ds0f.info.stac['proj:epsg']) {
              epsgInputResult = ds0f.info.stac['proj:epsg'];
            } else if (ds0f && ds0f.type === 'raster') {
              epsgInputResult = await showModalAndGetEPSG();
          } else if (ds0f && ds0f.type === 'raster') {
            // Intentar no forzar s_srs si no se pudo obtener
            epsgInputResult = undefined;
            }
          }
        }
      } else {
        // Modo sin worker
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        const arrayBuffer = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
        });

        if (!arrayBuffer) throw new Error('Error al leer archivo');

        const isZip2 = input.value.toLowerCase().includes('.zip') || file.name.toLowerCase().endsWith('.zip');
        if (isZip2) {
          try {
            window.gdal.Module.FS.writeFile(`/input/${imgName}`, new Int8Array(arrayBuffer));
            datasetResult = await window.gdal.open(`/input/${imgName}`, [], ['vsizip']);
            const ds0s = datasetResult.datasets && datasetResult.datasets[0];
            if (ds0s && ds0s.info && ds0s.info.stac && ds0s.info.stac['proj:epsg']) {
              epsgInputResult = ds0s.info.stac['proj:epsg'];
            } else if (ds0s && ds0s.type === 'raster') {
              epsgInputResult = await showModalAndGetEPSG();
          } else if (ds0f && ds0f.type === 'raster') {
            // Intentar no forzar s_srs si no se pudo obtener
            epsgInputResult = undefined;
            }
          } catch (errorZip2) {
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(arrayBuffer);
            const fileNamesZip = Object.keys(zipContent.files);
            for (const fileNameZ of fileNamesZip) {
              if (fileNameZ.endsWith('/')) continue;
              const fileDataZ = await zipContent.files[fileNameZ].async('arraybuffer');
              window.gdal.Module.FS.writeFile(`/input/${fileNameZ}`, new Int8Array(fileDataZ));
            }
            for (const fileNameZ of fileNamesZip) {
              try {
                datasetResult = await window.gdal.open(`/input/${fileNameZ}`);
                const ds0sz = datasetResult.datasets && datasetResult.datasets[0];
                if (ds0sz && ds0sz.info && ds0sz.info.stac && ds0sz.info.stac['proj:epsg']) {
                  epsgInputResult = ds0sz.info.stac['proj:epsg'];
                } else if (ds0sz && ds0sz.type === 'raster') {
                  epsgInputResult = await showModalAndGetEPSG();
          } else if (ds0f && ds0f.type === 'raster') {
            // Intentar no forzar s_srs si no se pudo obtener
            epsgInputResult = undefined;
                }
                break;
              } catch (e) {
                // continuar
              }
            }
          }
        } else {
          try {
            try {
              window.gdal.Module.FS.writeFile(`/input/${imgName}`, new Int8Array(arrayBuffer));
            } catch (fe) {}
            try {
              datasetResult = await window.gdal.open(`/input/${imgName}`);
            } catch (e) {
              datasetResult = null;
            }
          } catch (outer) {
            datasetResult = null;
          }
          if (datasetResult) {
            const ds0sn = datasetResult.datasets && datasetResult.datasets[0];
            if (ds0sn && ds0sn.info && ds0sn.info.stac && ds0sn.info.stac['proj:epsg']) {
              epsgInputResult = ds0sn.info.stac['proj:epsg'];
            } else if (ds0sn && ds0sn.type === 'raster') {
              epsgInputResult = await showModalAndGetEPSG();
          } else if (ds0f && ds0f.type === 'raster') {
            // Intentar no forzar s_srs si no se pudo obtener
            epsgInputResult = undefined;
            }
          }
        }
      }

      // Procesar dataset
      if (datasetResult) {
        try {
          await processDataset(datasetResult, imgName, epsgInputResult || 'EPSG:4326');

          // Guardar y construir UI
          filesObj[fileIndex] = datasetResult;
          fileIndex += 1;

          buildAccordionFiles(datasetResult, imgName, epsgInputResult || 'EPSG:4326');

          // Animación éxito
          if (fileUpload) {
            fileUpload.classList.remove('drop');
            setTimeout(() => fileUpload.classList.add('done'), 100);
            setTimeout(() => fileUpload.classList.remove('done'), 2500);
          }
          // Mostrar acordeón de archivos y asegurar que pestaña Archivos esté activa
          try {
            const archivosLink = document.getElementById('Arhivos');
            if (archivosLink) archivosLink.click();
          } catch (e) {}
          // Limpiar input para permitir subir mismo archivo
          try { input.value = ''; } catch (e) {}
        } catch (procErr) {
          console.error('Error procesando dataset:', procErr);
          if (fileUpload) {
            setTimeout(() => fileUpload.classList.add('fail'), 100);
            setTimeout(() => fileUpload.classList.remove('fail'), 2500);
            setTimeout(() => fileUpload.classList.remove('drop'), 2500);
          }
        }
      } else {
        if (fileUpload) {
          fileUpload.classList.remove('drop');
          setTimeout(() => fileUpload.classList.add('fail'), 100);
          setTimeout(() => fileUpload.classList.remove('fail'), 2500);
        }
      }
    } catch (error) {
      console.error('Error al procesar el archivo:', error);
      if (fileUpload) {
        setTimeout(() => fileUpload.classList.add('fail'), 100);
        setTimeout(() => fileUpload.classList.remove('fail'), 2500);
        setTimeout(() => fileUpload.classList.remove('drop'), 2500);
      }
    }
  }

  // Exponer readUrl globalmente (usado en HTML)
  window.readUrl = readUrl;

  // Eventos drag & drop
  if (fileUpload) {
    fileUpload.addEventListener('dragover', function (e) {
      e.preventDefault();
      this.classList.add('drag');
      this.classList.remove('drop', 'done', 'fail');
    });

    fileUpload.addEventListener('dragleave', function () {
      this.classList.remove('drag');
    });

    fileUpload.addEventListener('drop', function (e) {
      e.preventDefault();
      this.classList.remove('drag', 'done', 'fail');
      this.classList.add('drop');
      // Leer archivo dropeado
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const inputFile = document.getElementById('inputFile');
        if (inputFile) {
          try {
            // Asignar archivos al input
            inputFile.files = e.dataTransfer.files;
          } catch (err) {
            // En algunos navegadores falla la asignación; seguimos con el archivo
          }
          // Llamar directamente
          readUrl(inputFile);
        }
      }
    }, false);

    fileUpload.addEventListener('change', function () {
      this.classList.remove('drag', 'done', 'fail');
      this.classList.add('drop');
      const inputFile = document.getElementById('inputFile');
      if (inputFile && inputFile.files && inputFile.files.length > 0) {
        readUrl(inputFile);
      }
    }, false);
  }

  // Inicialización
  async function init() {
    await initGdalJS_();
  }

  init();
})();
