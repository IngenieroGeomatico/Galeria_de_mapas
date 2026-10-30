/* =====================================================================
   ESCRITOR DE GEOTIFF · API-IDEE / API-CNIG
   =====================================================================

   POR QUÉ EXISTE ESTE FICHERO

   La calculadora de bandas del plugin `geoprocesos` produce valores
   reales (NDVI, índices, umbrales, reclasificaciones...) y el resultado
   tiene que ser un GeoTIFF que conserve esos valores, no una imagen de
   colores.

   `GeoTIFF.writeArrayBuffer` de geotiff.js 2.1.3 NO sirve para eso: en
   su `encodeImage` reserva

       new Uint8Array(numBytesInIfd + width * height * SamplesPerPixel)

   es decir, un byte por píxel y banda. Con un Float32 (4 bytes/píxel)
   el buffer se queda corto y el fichero sale truncado y corrupto. Está
   pensado solo para datos de 8 bits.

   Así que aquí se escribe un TIFF mínimo, little-endian, sin compresión,
   con las etiquetas de georreferenciación (ModelPixelScale +
   ModelTiepoint) y las GeoKeys del SRC. Es el mismo formato que produce
   `gdal_translate -of GTiff`, y se lee sin problemas con geotiff.js, con
   OpenLayers y con GDAL. Hay dos variantes:

       escribirGeoTIFFFloat32  una banda Float32 (resultados calculados)
       escribirGeoTIFFUInt8    1–4 bandas de 8 bits (capturas de servicios)

   ESTRUCTURA DEL FICHERO

       cabecera (8 bytes)
       IFD: nº de entradas + 12 bytes por etiqueta + offset de la
            siguiente IFD (0 = única)
       bloques de datos de las etiquetas que no caben en 4 bytes
       píxeles (un único strip, sin compresión)

   ETIQUETAS QUE SE ESCRIBEN

       256 ImageWidth            LONG  1
       257 ImageLength           LONG  1
       258 BitsPerSample         SHORT 1   (32)
       259 Compression           SHORT 1   (1 = sin compresión)
       262 PhotometricInterp.    SHORT 1   (1 = negro es cero)
       273 StripOffsets          LONG  1   (se rellena al final)
       277 SamplesPerPixel       SHORT 1   (1)
       278 RowsPerStrip          LONG  1   (alto)
       279 StripByteCounts       LONG  1   (ancho * alto * 4)
       284 PlanarConfiguration   SHORT 1   (1)
       339 SampleFormat          SHORT 1   (3 = IEEE float)
       33550 ModelPixelScale     DOUBLE 3
       33922 ModelTiepoint       DOUBLE 6
       34735 GeoKeyDirectory     SHORT 4 + 4*n
       42113 GDAL_NODATA         ASCII

   USO

       const buffer = escribirGeoTIFFFloat32({
         ancho: 1024, alto: 768,
         datos: new Float32Array(1024 * 768),
         origenX: -1000, origenY: 5000,   // esquina superior izquierda
         resX: 10, resY: 10,              // tamaño de píxel (positivo)
         epsg: 3857,                      // o 4326
         nodata: 'nan',
       });

       const rgb = escribirGeoTIFFUInt8({
         ancho: 1024, alto: 768, bandas: 3,
         datos: new Uint8Array(1024 * 768 * 3),  // R,G,B entrelazados
         origenX: -1000, origenY: 5000, resX: 10, resY: 10, epsg: 3857,
       });

   `datos` va en el orden de filas de arriba abajo, que es el de
   `readRasters` de geotiff.js y el de `ModelTiepoint` con escala
   positiva en Y.

   `escribirGeoTIFFFloat32` es para los resultados de la calculadora (valores
   reales) y `escribirGeoTIFFUInt8` para las capturas de servicios (píxeles
   de 8 bits, RGB o escala de grises).
   ===================================================================== */

(function () {
  'use strict';

  // Tipos de dato del TIFF (los que se usan aquí).
  var TIFF_ASCII = 2;
  var TIFF_SHORT = 3;
  var TIFF_LONG = 4;
  var TIFF_DOUBLE = 12;

  var TAM_TIPO = { 2: 1, 3: 2, 4: 4, 12: 8 };

  /**
   * Mete en un DataView los valores de una etiqueta, según su tipo.
   * @param {DataView} vista Destino.
   * @param {number} pos Posición de escritura.
   * @param {Object} entrada Etiqueta ({ tipo, valores } o { bytes }).
   */
  function escribirValores(vista, pos, entrada) {
    if (entrada.bytes) {
      for (var i = 0; i < entrada.bytes.length; i += 1) {
        vista.setUint8(pos + i, entrada.bytes[i]);
      }
      return;
    }
    var valores = entrada.valores || [];
    for (var j = 0; j < valores.length; j += 1) {
      var v = valores[j];
      if (entrada.tipo === TIFF_SHORT) {
        vista.setUint16(pos + (j * 2), v & 0xffff, true);
      } else if (entrada.tipo === TIFF_LONG) {
        vista.setUint32(pos + (j * 4), v >>> 0, true);
      } else if (entrada.tipo === TIFF_DOUBLE) {
        vista.setFloat64(pos + (j * 8), v, true);
      }
    }
  }

  /**
   * Directorio de GeoKeys del SRC.
   *
   * Formato: [version, revisión, minor, nºClaves] + 4 valores por clave
   * [KeyID, TIFFTagLocation, Count, ValueOffset]. Con Count 1 y
   * TIFFTagLocation 0 el valor va en línea.
   *
   * @param {number} epsg Código EPSG.
   * @param {boolean} proyectado Si es un SRC proyectado (3857) o geográfico (4326).
   * @returns {Array<number>} Directorio aplanado.
   */
  function directorioGeoKeys(epsg, proyectado) {
    var claves = [
      [1024, 0, 1, proyectado ? 1 : 2], // GTModelTypeGeoKey: 1 proyectado, 2 geográfico
      [1025, 0, 1, 1], // GTRasterTypeGeoKey: 1 = PixelIsArea
    ];
    if (proyectado) {
      claves.push([3072, 0, 1, epsg]); // ProjectedCSTypeGeoKey
    } else {
      claves.push([2048, 0, 1, epsg]); // GeographicTypeGeoKey
    }
    var salida = [1, 1, 0, claves.length];
    claves.forEach(function (c) {
      salida.push(c[0], c[1], c[2], c[3]);
    });
    return salida;
  }

  /**
   * Serializa un TIFF little-endian con las etiquetas dadas y un único strip
   * de píxeles sin compresión.
   *
   * El llamante solo tiene que montar `entradas` (en orden ascendente de tag,
   * con la 273 vacía) y pasar los bytes de píxeles ya empaquetados.
   *
   * @param {Array<Object>} entradas Etiquetas del IFD.
   * @param {Uint8Array} pixeles Bytes del strip de píxeles.
   * @returns {ArrayBuffer} Fichero TIFF.
   */
  function serializarTiff(entradas, pixeles) {
    var n = entradas.length;
    var tamIFD = 2 + (n * 12) + 4;

    // Primera pasada: tamaño de cada bloque y offsets de los que no caben
    // en los 4 bytes del campo de valor.
    var cursor = 8 + tamIFD;
    cursor += (8 - (cursor % 8)) % 8;

    entradas.forEach(function (e) {
      var tam = e.bytes ? e.bytes.length : e.cuenta * TAM_TIPO[e.tipo];
      e.tam = tam;
      if (tam > 4) {
        cursor += (8 - (cursor % 8)) % 8;
        e.offset = cursor;
        cursor += tam;
        if (cursor % 2 !== 0) cursor += 1; // alineación a palabra
      }
    });

    // Los píxeles van al final, alineados a 4 bytes.
    var offsetPixeles = cursor + ((4 - (cursor % 4)) % 4);
    entradas.forEach(function (e) {
      if (e.tag === 273) e.valores = [offsetPixeles]; // StripOffsets
    });

    var total = offsetPixeles + pixeles.byteLength;
    var buffer = new ArrayBuffer(total);
    var vista = new DataView(buffer);
    var bytes = new Uint8Array(buffer);

    // Cabecera: 'II' (little-endian), 42 y offset de la primera IFD.
    bytes[0] = 0x49;
    bytes[1] = 0x49;
    vista.setUint16(2, 42, true);
    vista.setUint32(4, 8, true);

    // IFD.
    vista.setUint16(8, n, true);
    var p = 10;
    entradas.forEach(function (e) {
      vista.setUint16(p, e.tag, true);
      vista.setUint16(p + 2, e.tipo, true);
      vista.setUint32(p + 4, e.cuenta, true);
      if (e.tam <= 4) {
        // Los valores cortos van en línea, alineados a la izquierda.
        var tmp = new DataView(new ArrayBuffer(4));
        escribirValores(tmp, 0, e);
        for (var k = 0; k < 4; k += 1) bytes[p + 8 + k] = tmp.getUint8(k);
      } else {
        vista.setUint32(p + 8, e.offset, true);
      }
      p += 12;
    });
    vista.setUint32(p, 0, true); // no hay más IFDs

    // Bloques de datos.
    entradas.forEach(function (e) {
      if (e.tam > 4) escribirValores(vista, e.offset, e);
    });

    // Píxeles: se copian los bytes tal cual.
    bytes.set(pixeles, offsetPixeles);

    return buffer;
  }

  /**
   * Construye un GeoTIFF de una banda Float32 con georreferenciación.
   *
   * @param {Object} o Opciones.
   * @param {number} o.ancho Ancho en píxeles.
   * @param {number} o.alto Alto en píxeles.
   * @param {Float32Array} o.datos Píxeles en orden de filas.
   * @param {number} o.origenX X de la esquina superior izquierda (SRC del fichero).
   * @param {number} o.origenY Y de la esquina superior izquierda (SRC del fichero).
   * @param {number} o.resX Tamaño de píxel en X (positivo).
   * @param {number} o.resY Tamaño de píxel en Y (positivo; el signo lo pone la escala).
   * @param {number} [o.epsg=4326] Código EPSG del fichero.
   * @param {string} [o.nodata='nan'] Valor de nodata declarado en GDAL_NODATA.
   * @returns {ArrayBuffer} Fichero GeoTIFF listo para un Blob.
   */
  function escribirGeoTIFFFloat32(o) {
    var ancho = Math.round(o.ancho);
    var alto = Math.round(o.alto);
    var datos = o.datos;

    if (!(ancho > 0) || !(alto > 0)) {
      throw new Error('escribirGeoTIFFFloat32: dimensiones no válidas');
    }
    if (!datos || datos.length !== ancho * alto) {
      throw new Error('escribirGeoTIFFFloat32: el número de píxeles no cuadra con las dimensiones');
    }

    var epsg = Number(o.epsg) || 4326;
    // 4326 y 4258 son geográficos; 3857 y el resto se tratan como proyectados.
    var proyectado = epsg !== 4326 && epsg !== 4258 && epsg !== 4269;
    var nodataTxt = (o.nodata === undefined || o.nodata === null) ? 'nan' : String(o.nodata);

    // GDAL_NODATA es ASCII y lleva el terminador nulo.
    var nodataBytes = new Uint8Array(nodataTxt.length + 1);
    for (var i = 0; i < nodataTxt.length; i += 1) {
      nodataBytes[i] = nodataTxt.charCodeAt(i) & 0xff;
    }

    var directorio = directorioGeoKeys(epsg, proyectado);

    // Las etiquetas TIFF van SIEMPRE en orden ascendente de código.
    var entradas = [
      { tag: 256, tipo: TIFF_LONG, cuenta: 1, valores: [ancho] },
      { tag: 257, tipo: TIFF_LONG, cuenta: 1, valores: [alto] },
      { tag: 258, tipo: TIFF_SHORT, cuenta: 1, valores: [32] },
      { tag: 259, tipo: TIFF_SHORT, cuenta: 1, valores: [1] },
      { tag: 262, tipo: TIFF_SHORT, cuenta: 1, valores: [1] },
      { tag: 273, tipo: TIFF_LONG, cuenta: 1, valores: [0] },
      { tag: 277, tipo: TIFF_SHORT, cuenta: 1, valores: [1] },
      { tag: 278, tipo: TIFF_LONG, cuenta: 1, valores: [alto] },
      { tag: 279, tipo: TIFF_LONG, cuenta: 1, valores: [ancho * alto * 4] },
      { tag: 284, tipo: TIFF_SHORT, cuenta: 1, valores: [1] },
      { tag: 339, tipo: TIFF_SHORT, cuenta: 1, valores: [3] },
      {
        tag: 33550,
        tipo: TIFF_DOUBLE,
        cuenta: 3,
        valores: [Math.abs(o.resX), Math.abs(o.resY), 0],
      },
      {
        tag: 33922,
        tipo: TIFF_DOUBLE,
        cuenta: 6,
        valores: [0, 0, 0, o.origenX, o.origenY, 0],
      },
      {
        tag: 34735,
        tipo: TIFF_SHORT,
        cuenta: directorio.length,
        valores: directorio,
      },
      { tag: 42113, tipo: TIFF_ASCII, cuenta: nodataBytes.length, bytes: nodataBytes },
    ];

    // Píxeles: se copian los bytes tal cual (la plataforma es little-endian,
    // igual que la cabecera que se acaba de escribir).
    var pixeles = new Uint8Array(datos.buffer, datos.byteOffset, datos.byteLength);
    return serializarTiff(entradas, pixeles);
  }

  /**
   * Construye un GeoTIFF de 8 bits y 1–4 bandas con georreferenciación.
   *
   * Es el que se usa para las capturas de servicios: un WMS o un TMS devuelve
   * píxeles de 8 bits (RGB), no medidas, y pasarlos por Float32 solo
   * engordaría el fichero. `datos` va entrelazado por píxel (R,G,B[,A]).
   *
   * @param {Object} o Opciones.
   * @param {number} o.ancho Ancho en píxeles.
   * @param {number} o.alto Alto en píxeles.
   * @param {Uint8Array} o.datos Píxeles entrelazados, en orden de filas.
   * @param {number} o.origenX X de la esquina superior izquierda.
   * @param {number} o.origenY Y de la esquina superior izquierda.
   * @param {number} o.resX Tamaño de píxel en X (positivo).
   * @param {number} o.resY Tamaño de píxel en Y (positivo).
   * @param {number} [o.bandas=3] Número de bandas (1 a 4).
   * @param {number} [o.epsg=4326] Código EPSG del fichero.
   * @param {number} [o.fotometrico] PhotometricInterpretation (por defecto 2
   *   para 3–4 bandas y 1 para 1 banda).
   * @returns {ArrayBuffer} Fichero GeoTIFF listo para un Blob.
   */
  function escribirGeoTIFFUInt8(o) {
    var ancho = Math.round(o.ancho);
    var alto = Math.round(o.alto);
    var bandas = Math.max(1, Math.min(4, Math.round(o.bandas || 3)));
    var datos = o.datos;

    if (!(ancho > 0) || !(alto > 0)) {
      throw new Error('escribirGeoTIFFUInt8: dimensiones no válidas');
    }
    if (!datos || datos.length !== ancho * alto * bandas) {
      throw new Error('escribirGeoTIFFUInt8: el número de píxeles no cuadra con las dimensiones');
    }

    var epsg = Number(o.epsg) || 4326;
    var proyectado = epsg !== 4326 && epsg !== 4258 && epsg !== 4269;
    var directorio = directorioGeoKeys(epsg, proyectado);
    var fotometrico = o.fotometrico || (bandas >= 3 ? 2 : 1);

    var bits = [];
    var formato = [];
    for (var i = 0; i < bandas; i += 1) {
      bits.push(8);
      formato.push(1); // 1 = entero sin signo
    }

    var entradas = [
      { tag: 256, tipo: TIFF_LONG, cuenta: 1, valores: [ancho] },
      { tag: 257, tipo: TIFF_LONG, cuenta: 1, valores: [alto] },
      { tag: 258, tipo: TIFF_SHORT, cuenta: bandas, valores: bits },
      { tag: 259, tipo: TIFF_SHORT, cuenta: 1, valores: [1] },
      { tag: 262, tipo: TIFF_SHORT, cuenta: 1, valores: [fotometrico] },
      { tag: 273, tipo: TIFF_LONG, cuenta: 1, valores: [0] },
      { tag: 277, tipo: TIFF_SHORT, cuenta: 1, valores: [bandas] },
      { tag: 278, tipo: TIFF_LONG, cuenta: 1, valores: [alto] },
      { tag: 279, tipo: TIFF_LONG, cuenta: 1, valores: [ancho * alto * bandas] },
      { tag: 284, tipo: TIFF_SHORT, cuenta: 1, valores: [1] },
      { tag: 339, tipo: TIFF_SHORT, cuenta: bandas, valores: formato },
      {
        tag: 33550,
        tipo: TIFF_DOUBLE,
        cuenta: 3,
        valores: [Math.abs(o.resX), Math.abs(o.resY), 0],
      },
      {
        tag: 33922,
        tipo: TIFF_DOUBLE,
        cuenta: 6,
        valores: [0, 0, 0, o.origenX, o.origenY, 0],
      },
      {
        tag: 34735,
        tipo: TIFF_SHORT,
        cuenta: directorio.length,
        valores: directorio,
      },
    ];

    return serializarTiff(entradas, datos);
  }

  // Exposición global: el plugin lo carga bajo demanda y lo usa desde ahí.
  // No se toca ningún espacio de nombres de la API.
  window.GeoprocesosGeoTIFF = {
    escribirGeoTIFFFloat32: escribirGeoTIFFFloat32,
    escribirGeoTIFFUInt8: escribirGeoTIFFUInt8,
  };
})();
