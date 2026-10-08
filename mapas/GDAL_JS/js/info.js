'use strict';

(function () {
  const acc = document.getElementsByClassName('accordion');
  for (let i = 0; i < acc.length; i++) {
    acc[i].addEventListener('click', function () {
      this.classList.toggle('active');
      const panel = this.nextElementSibling;
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  }

  async function waitForDefined() {
    return new Promise((resolve) => {
      // Comprobar si ya está definido
      if (typeof window.gdal !== 'undefined') {
        resolve(window.gdal);
        return;
      }
      // Escuchar evento de ready
      const onReady = (e) => {
        document.removeEventListener('gdal-ready', onReady);
        clearInterval(interval);
        resolve(e.detail && e.detail.gdal ? e.detail.gdal : window.gdal);
      };
      document.addEventListener('gdal-ready', onReady);
      // Fallback por polling
      const interval = setInterval(() => {
        if (typeof window.gdal !== 'undefined') {
          try { document.removeEventListener('gdal-ready', onReady); } catch (e) {}
          clearInterval(interval);
          resolve(window.gdal);
        }
      }, 200);
      // Safety timeout
      setTimeout(() => {
        try { document.removeEventListener('gdal-ready', onReady); } catch (e) {}
        clearInterval(interval);
        if (typeof window.gdal !== 'undefined') resolve(window.gdal);
      }, 15000);
    });
  }

  function populateDrivers(gdalInstance) {
    if (!gdalInstance) return false;
    if (!gdalInstance.drivers) return false;
    const tablaVector = document.getElementById('tablaVectorID');
    const tablaRaster = document.getElementById('tablaRasterID');

    const vectores = gdalInstance.drivers.vector || {};
    const raster = gdalInstance.drivers.raster || {};

    if (tablaVector && tablaVector.rows.length <= 1) {
      for (const format in vectores) {
        if (Object.prototype.hasOwnProperty.call(vectores, format)) {
          const fila = tablaVector.insertRow();
          const celda1 = fila.insertCell(0);
          const celda2 = fila.insertCell(1);
          const celda3 = fila.insertCell(2);
          const celda4 = fila.insertCell(3);
          celda1.textContent = vectores[format].longName || format;
          celda2.textContent = vectores[format].shortName || format;
          celda3.innerHTML = vectores[format].isReadable ? '<span style="color:#0a9e4d;">&#10003;</span>' : '<span style="color:#d93025;">&#10007;</span>';
          celda4.innerHTML = vectores[format].isWritable ? '<span style="color:#0a9e4d;">&#10003;</span>' : '<span style="color:#d93025;">&#10007;</span>';
          celda3.title = vectores[format].isReadable ? 'Sí' : 'No';
          celda4.title = vectores[format].isWritable ? 'Sí' : 'No';
          celda3.style.textAlign = 'center';
          celda4.style.textAlign = 'center';
          fila.addEventListener('click', function () {
            this.classList.toggle('selected');
          });
        }
      }
    }

    if (tablaRaster && tablaRaster.rows.length <= 1) {
      for (const format in raster) {
        if (Object.prototype.hasOwnProperty.call(raster, format)) {
          const fila = tablaRaster.insertRow();
          const celda1 = fila.insertCell(0);
          const celda2 = fila.insertCell(1);
          const celda3 = fila.insertCell(2);
          const celda4 = fila.insertCell(3);
          celda1.textContent = raster[format].longName || format;
          celda2.textContent = raster[format].shortName || format;
          celda3.innerHTML = raster[format].isReadable ? '<span style="color:#0a9e4d;">&#10003;</span>' : '<span style="color:#d93025;">&#10007;</span>';
          celda4.innerHTML = raster[format].isWritable ? '<span style="color:#0a9e4d;">&#10003;</span>' : '<span style="color:#d93025;">&#10007;</span>';
          celda3.title = raster[format].isReadable ? 'Sí' : 'No';
          celda4.title = raster[format].isWritable ? 'Sí' : 'No';
          celda3.style.textAlign = 'center';
          celda4.style.textAlign = 'center';
          fila.addEventListener('click', function () {
            this.classList.toggle('selected');
          });
        }
      }
    }
    return true;
  }

  waitForDefined().then((gdalInstance) => {
    populateDrivers(gdalInstance);
    // Reintento por si drivers llegan más tarde
    let tries = 0;
    const retry = setInterval(() => {
      tries++;
      if (populateDrivers(window.gdal) || tries > 20) {
        clearInterval(retry);
      }
    }, 300);
  }).catch((err) => {
    console.error('Error al cargar formatos GDAL:', err);
  });
})();
