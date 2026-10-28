/*
 * ifcLayer: Capa IFC (Industry Foundation Classes) y BIM para Cesium 3D y OpenLayers 2D.
 *
 * VALIDACIÓN Y GEORREFERENCIACIÓN AUTOMÁTICA DEL IFC:
 *   Los modelos IFC deben estar georreferenciados en el propio archivo mediante
 *   `IfcSite` (RefLatitude, RefLongitude, RefElevation) o `IfcMapConversion`.
 *   El plugin extrae automáticamente la posición geográfica nativa del archivo IFC:
 *   - Si el archivo IFC está georreferenciado, se ubica automáticamente en sus coordenadas reales.
 *   - Si el archivo IFC NO contiene georreferenciación, se marca como no válido
 *     y no se posiciona en el mapa.
 *
 * USO:
 *   new IDEE.layer.IFC({
 *     url,                 // URL del archivo .ifc (o .glb/.gltf / 3D Tiles)
 *     heading, pitch, roll,// Orientación del modelo en 3D (en grados, p. ej. heading: 90)
 *     scale,               // Escala del modelo (por defecto 1)
 *     heightOffset,        // Ajuste fino de cota Z en metros
 *     clampToGround,       // true para ajustar la base al terreno
 *     name, legend,        // Metadatos de capa para selectores y leyendas
 *     visible,             // Visibilidad inicial (true por defecto)
 *     opacity,             // Opacidad inicial (0 a 1)
 *   }, { style });
 *
 * HUELLA EN 2D (y extensión de la capa en 3D):
 *   - IFC: se deduce de `IfcSite` / `IfcMapConversion` y del AABB del modelo.
 *   - 3D Tiles: se lee `root.boundingVolume` del `tileset.json` (`region`, o
 *     `box` + `transform`). Si el tileset no está georreferenciado (sin
 *     `transform` y con el `box` en coordenadas locales) no hay huella.
 *   - glTF/GLB: el formato no lleva georreferenciación; solo con `position`.
 */
(function () {
  'use strict';

  var VERSION = '2.5.0';

  function api() {
    return window.IDEE || window.M || null;
  }

  function esCesium(map) {
    try {
      var impl = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
      return !!(impl && impl.scene && impl.scene.camera && typeof window.Cesium !== 'undefined');
    } catch (e) {
      return false;
    }
  }

  function normalizarOpacidad(valor, porDefecto) {
    var n = Number(valor);
    if (!isFinite(n)) return porDefecto;
    return Math.max(0, Math.min(1, n));
  }

  function lonLatA3857(lon, lat) {
    var x = (lon * 20037508.34) / 180;
    var latClamped = Math.max(-89.9, Math.min(89.9, lat));
    var y = Math.log(Math.tan(((90 + latClamped) * Math.PI) / 360)) / (Math.PI / 180);
    y = (y * 20037508.34) / 180;
    return [x, y];
  }

  function bbox4326A3857(bbox) {
    if (!Array.isArray(bbox) || bbox.length < 4) return null;
    var sw = lonLatA3857(bbox[0], bbox[1]);
    var ne = lonLatA3857(bbox[2], bbox[3]);
    return [
      Math.min(sw[0], ne[0]),
      Math.min(sw[1], ne[1]),
      Math.max(sw[0], ne[0]),
      Math.max(sw[1], ne[1]),
    ];
  }

  /* ---------------------------------------------------------------------
   * Huella 2D de un tileset 3D Tiles.
   *
   * Un `tileset.json` describe su volumen con `root.boundingVolume`, que
   * puede ser:
   *   - `region`: [oeste, sur, este, norte, alturaMin, alturaMax] en radianes.
   *   - `box`: 12 números (centro + 3 semiejes) en el sistema local de la
   *     tesela; hay que aplicarles `root.transform` (matriz 4x4 column-major
   *     que pasa a ECEF) y convertir las esquinas a geodésicas.
   *
   * Si no hay `region` ni `transform` el `box` está en coordenadas locales
   * (típicamente centrado en 0,0,0) y no hay forma de georreferenciarlo: se
   * devuelve null y la capa se queda sin huella.
   * ------------------------------------------------------------------- */

  function esFinito(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function bboxValida(bbox) {
    if (!Array.isArray(bbox) || bbox.length < 4) return null;
    var o = Number(bbox[0]);
    var s = Number(bbox[1]);
    var e = Number(bbox[2]);
    var n = Number(bbox[3]);
    if (!esFinito(o) || !esFinito(s) || !esFinito(e) || !esFinito(n)) return null;
    if (o < -180 || e > 180 || s < -90 || n > 90) return null;
    if (e <= o || n <= s) return null;
    return [o, s, e, n];
  }

  /** Punto ECEF (WGS84) a [lon, lat] en grados. Formula cerrada de Bowring. */
  function ecefALonLat(x, y, z) {
    if (!esFinito(x) || !esFinito(y) || !esFinito(z)) return null;
    var a = 6378137;
    var f = 1 / 298.257223563;
    var e2 = f * (2 - f);
    var b = a * (1 - f);
    var ep2 = (a * a - b * b) / (b * b);
    var p = Math.sqrt(x * x + y * y);
    if (p < 1) return null;
    var theta = Math.atan2(a * z, b * p);
    var sen = Math.sin(theta);
    var cos = Math.cos(theta);
    var lat = Math.atan2(z + ep2 * b * sen * sen * sen, p - e2 * a * cos * cos * cos);
    var lon = Math.atan2(y, x);
    return [lon * 180 / Math.PI, lat * 180 / Math.PI];
  }

  /** Matriz 4x4 column-major (como `root.transform`) por un punto [x, y, z]. */
  function aplicarMatriz4(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
    ];
  }

  function bboxDeRegion(region) {
    var o = region[0] * 180 / Math.PI;
    var s = region[1] * 180 / Math.PI;
    var e = region[2] * 180 / Math.PI;
    var n = region[3] * 180 / Math.PI;
    if (!esFinito(o) || !esFinito(s) || !esFinito(e) || !esFinito(n)) return null;
    // Region que cruza el antimeridiano (o viene expresada fuera de rango):
    // se abre al mundo entero, que es lo unico representable en [o, s, e, n].
    if (o > e || o < -180 || e > 180) { o = -180; e = 180; }
    return bboxValida([o, s, e, n]);
  }

  function bboxDeBox(box, transform) {
    var identidad = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    var T = (Array.isArray(transform) && transform.length === 16) ? transform : identidad;

    // Centro en ECEF: si no cae cerca de la superficie terrestre, el box esta
    // en coordenadas locales y no se puede georreferenciar.
    var centro = aplicarMatriz4(T, [box[0], box[1], box[2]]);
    var radio = Math.sqrt(centro[0] * centro[0] + centro[1] * centro[1] + centro[2] * centro[2]);
    if (!esFinito(radio) || radio < 6.0e6 || radio > 7.0e6) return null;

    var semi = [
      [box[3], box[4], box[5]],
      [box[6], box[7], box[8]],
      [box[9], box[10], box[11]],
    ];

    var o = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (var i = -1; i <= 1; i += 2) {
      for (var j = -1; j <= 1; j += 2) {
        for (var k = -1; k <= 1; k += 2) {
          var local = [
            box[0] + i * semi[0][0] + j * semi[1][0] + k * semi[2][0],
            box[1] + i * semi[0][1] + j * semi[1][1] + k * semi[2][1],
            box[2] + i * semi[0][2] + j * semi[1][2] + k * semi[2][2],
          ];
          var p = aplicarMatriz4(T, local);
          var ll = ecefALonLat(p[0], p[1], p[2]);
          if (!ll) continue;
          if (ll[0] < o) o = ll[0];
          if (ll[0] > e) e = ll[0];
          if (ll[1] < s) s = ll[1];
          if (ll[1] > n) n = ll[1];
        }
      }
    }
    return bboxValida([o, s, e, n]);
  }

  function bboxDeTilesetJSON(json, base, nivel) {
    if (!json || typeof json !== 'object') return null;
    var raiz = json.root || (json.tileset && json.tileset.root) || null;
    if (!raiz) return null;

    var bv = raiz.boundingVolume;
    if (bv) {
      if (Array.isArray(bv.region) && bv.region.length >= 4) {
        var porRegion = bboxDeRegion(bv.region);
        if (porRegion) return porRegion;
      }
      if (Array.isArray(bv.box) && bv.box.length >= 12) {
        var porBox = bboxDeBox(bv.box, raiz.transform);
        if (porBox) return porBox;
      }
    }

    // Tileset externo: la raiz apunta a otro `tileset.json` (un solo salto).
    if (nivel < 1 && raiz.content && typeof raiz.content.uri === 'string' && /\.json(\?|#|$)/i.test(raiz.content.uri)) {
      return descargarHuellaDeTileset(raiz.content.uri, base, nivel + 1);
    }
    return null;
  }

  async function descargarHuellaDeTileset(url, base, nivel) {
    var absoluta = url;
    try {
      absoluta = base ? new URL(url, base).href : new URL(url, document.baseURI).href;
    } catch (e) { /* se deja tal cual */ }

    var respuesta = await fetch(absoluta, { mode: 'cors' });
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status + ' al leer ' + absoluta);
    var json = await respuesta.json();
    return bboxDeTilesetJSON(json, absoluta, nivel || 0);
  }

  /** Huella [oeste, sur, este, norte] en EPSG:4326 de un `tileset.json`, o null. */
  function huellaDeTileset(url) {
    return descargarHuellaDeTileset(url, null, 0);
  }

  function normalizarPosicion(pos) {
    if (!pos) return null;
    if (Array.isArray(pos)) {
      return {
        lon: Number(pos[0]) || 0,
        lat: Number(pos[1]) || 0,
        height: Number(pos[2]) || 0,
      };
    }
    if (typeof pos === 'object') {
      var lon = (typeof pos.lon === 'number') ? pos.lon : (typeof pos.x === 'number' ? pos.x : 0);
      var lat = (typeof pos.lat === 'number') ? pos.lat : (typeof pos.y === 'number' ? pos.y : 0);
      var alt = (typeof pos.height === 'number') ? pos.height : (typeof pos.z === 'number' ? pos.z : (typeof pos.alt === 'number' ? pos.alt : 0));
      return { lon: lon, lat: lat, height: alt };
    }
    return null;
  }

  function normalizarOrientacion(p) {
    var h = 0, pt = 0, r = 0;
    var posObj = (p && typeof p.position === 'object' && !Array.isArray(p.position)) ? p.position : {};

    if (Array.isArray(p.modelOrientation)) {
      h = Number(p.modelOrientation[0]) || 0;
      pt = Number(p.modelOrientation[1]) || 0;
      r = Number(p.modelOrientation[2]) || 0;
    } else if (Array.isArray(posObj.orientation)) {
      h = Number(posObj.orientation[0]) || 0;
      pt = Number(posObj.orientation[1]) || 0;
      r = Number(posObj.orientation[2]) || 0;
    } else if (Array.isArray(posObj.rotation)) {
      h = Number(posObj.rotation[0]) || 0;
      pt = Number(posObj.rotation[1]) || 0;
      r = Number(posObj.rotation[2]) || 0;
    } else {
      if (typeof p.heading === 'number') h = p.heading;
      else if (typeof posObj.heading === 'number') h = posObj.heading;
      else if (typeof posObj.yaw === 'number') h = posObj.yaw;

      if (typeof p.pitch === 'number') pt = p.pitch;
      else if (typeof posObj.pitch === 'number') pt = posObj.pitch;

      if (typeof p.roll === 'number') r = p.roll;
      else if (typeof posObj.roll === 'number') r = posObj.roll;
    }
    return { heading: h, pitch: pt, roll: r };
  }

  /**
   * Extrae la georreferenciación de IfcSite directamente del texto STEP del fichero IFC.
   * Formato ISO 10303-21: IFCSITE(...,(lat_deg,lat_min,lat_sec,lat_micro),(lon_deg,lon_min,lon_sec,lon_micro),elevation,...)
   */
  function extraerIfcSiteDeTexto(buffer) {
    try {
      var maxLen = Math.min(buffer.length, 512 * 1024);
      var dec = new TextDecoder('utf-8');
      var texto = dec.decode(buffer.subarray(0, maxLen));

      var regex = /IFCSITE\s*\([^;]+?\(([-0-9\s.,]+)\)\s*,\s*\(([-0-9\s.,]+)\)\s*(?:,\s*([-0-9.+-]+|\$))?/i;
      var match = texto.match(regex);
      if (match) {
        var parseDMS = function (str) {
          var partes = str.split(',').map(function (s) { return parseFloat(s.trim()); }).filter(function (n) { return !isNaN(n); });
          if (partes.length === 0) return null;
          var deg = partes[0] || 0;
          var min = (partes.length > 1) ? partes[1] : 0;
          var sec = (partes.length > 2) ? partes[2] : 0;
          var micro = (partes.length > 3) ? partes[3] : 0;
          var signo = (deg < 0 || Object.is(deg, -0)) ? -1 : 1;
          var total = Math.abs(deg) + (min / 60) + ((sec + (micro / 1000000)) / 3600);
          return total * signo;
        };
        var lat = parseDMS(match[1]);
        var lon = parseDMS(match[2]);
        var alt = (match[3] && match[3] !== '$') ? parseFloat(match[3]) : 0;
        if (typeof lat === 'number' && typeof lon === 'number' &&
            Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
            (lat !== 0 || lon !== 0)) {
          return { lon: lon, lat: lat, height: isNaN(alt) ? 0 : alt };
        }
      }
    } catch (e) {
      /* fallback silencioso */
    }
    return null;
  }

  function parsearDMSObjeto(valor) {
    if (valor === null || typeof valor === 'undefined') return null;
    if (typeof valor === 'number') return valor;
    var lista = null;
    if (Array.isArray(valor)) {
      lista = valor;
    } else if (Array.isArray(valor.value)) {
      lista = valor.value;
    } else if (typeof valor.value === 'number') {
      return valor.value;
    }
    if (!lista || lista.length === 0) return null;

    var nums = [];
    for (var i = 0; i < lista.length; i++) {
      var item = lista[i];
      if (typeof item === 'number') {
        nums.push(item);
      } else if (item && typeof item.value === 'number') {
        nums.push(item.value);
      } else if (item && typeof item._representationValue === 'number') {
        nums.push(item._representationValue);
      } else if (item !== null && typeof item !== 'undefined') {
        var n = parseFloat(item);
        if (!isNaN(n)) nums.push(n);
      }
    }

    if (nums.length === 0) return null;
    var deg = nums[0] || 0;
    var min = (nums.length > 1) ? nums[1] : 0;
    var sec = (nums.length > 2) ? nums[2] : 0;
    var micro = (nums.length > 3) ? nums[3] : 0;
    var signo = (deg < 0 || Object.is(deg, -0)) ? -1 : 1;
    var total = Math.abs(deg) + (min / 60) + ((sec + (micro / 1000000)) / 3600);
    return total * signo;
  }

  /**
   * Genera un binario GLB (glTF 2.0) a partir de mallas con vértices, normales,
   * índices y colores de materiales.
   */
  function crearGLBDesdeMallas(mallas, aabb) {
    if (!mallas || mallas.length === 0) return null;

    var buffersBinarios = [];
    var bufferViews = [];
    var accessors = [];
    var materials = [];
    var primitives = [];
    var offsetActual = 0;

    function agregarBufferView(arrayBuffer, target) {
      var byteLength = arrayBuffer.byteLength;
      var padding = (4 - (byteLength % 4)) % 4;
      var totalLength = byteLength + padding;

      bufferViews.push({
        buffer: 0,
        byteOffset: offsetActual,
        byteLength: byteLength,
        target: target,
      });

      buffersBinarios.push(arrayBuffer);
      if (padding > 0) {
        buffersBinarios.push(new Uint8Array(padding));
      }

      offsetActual += totalLength;
      return bufferViews.length - 1;
    }

    for (var i = 0; i < mallas.length; i++) {
      var m = mallas[i];
      if (!m.positions || m.positions.length === 0 || !m.indices || m.indices.length === 0) continue;

      var numVertices = m.positions.length / 3;
      var minPos = [Infinity, Infinity, Infinity];
      var maxPos = [-Infinity, -Infinity, -Infinity];

      for (var p = 0; p < m.positions.length; p += 3) {
        var x = m.positions[p];
        var y = m.positions[p + 1];
        var z = m.positions[p + 2];
        if (x < minPos[0]) minPos[0] = x;
        if (y < minPos[1]) minPos[1] = y;
        if (z < minPos[2]) minPos[2] = z;
        if (x > maxPos[0]) maxPos[0] = x;
        if (y > maxPos[1]) maxPos[1] = y;
        if (z > maxPos[2]) maxPos[2] = z;
      }

      // BufferView y Accessor de Posiciones
      var bvPos = agregarBufferView(m.positions.buffer, 34962);
      var accPos = accessors.length;
      accessors.push({
        bufferView: bvPos,
        byteOffset: 0,
        componentType: 5126,
        count: numVertices,
        type: 'VEC3',
        min: minPos,
        max: maxPos,
      });

      // BufferView y Accessor de Normales
      var accNorm = null;
      if (m.normals && m.normals.length === m.positions.length) {
        var bvNorm = agregarBufferView(m.normals.buffer, 34962);
        accNorm = accessors.length;
        accessors.push({
          bufferView: bvNorm,
          byteOffset: 0,
          componentType: 5126,
          count: numVertices,
          type: 'VEC3',
        });
      }

      // BufferView y Accessor de Índices
      var esUint32 = m.indices instanceof Uint32Array;
      var bvInd = agregarBufferView(m.indices.buffer, 34963);
      var accInd = accessors.length;
      accessors.push({
        bufferView: bvInd,
        byteOffset: 0,
        componentType: esUint32 ? 5125 : 5123,
        count: m.indices.length,
        type: 'SCALAR',
      });

      // Material PBR con soporte de transparencia
      var col = m.color || { r: 0.8, g: 0.8, b: 0.8, a: 1.0 };
      var r = typeof col.r === 'number' ? Math.max(0, Math.min(1, col.r)) : 0.8;
      var g = typeof col.g === 'number' ? Math.max(0, Math.min(1, col.g)) : 0.8;
      var b = typeof col.b === 'number' ? Math.max(0, Math.min(1, col.b)) : 0.8;
      var a = typeof col.a === 'number' ? Math.max(0, Math.min(1, col.a)) : 1.0;

      var matIdx = materials.length;
      materials.push({
        name: 'Mat_' + matIdx,
        pbrMetallicRoughness: {
          baseColorFactor: [r, g, b, a],
          metallicFactor: 0.1,
          roughnessFactor: 0.7,
        },
        alphaMode: a < 0.99 ? 'BLEND' : 'OPAQUE',
        doubleSided: true,
      });

      var prim = {
        attributes: {
          POSITION: accPos,
        },
        indices: accInd,
        material: matIdx,
        mode: 4,
      };
      if (accNorm !== null) prim.attributes.NORMAL = accNorm;

      primitives.push(prim);
    }

    if (primitives.length === 0) return null;

    var gltfJSON = {
      asset: { version: '2.0', generator: 'IDEE.layer.IFC - web-ifc GLB Pipeline' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: primitives }],
      materials: materials,
      accessors: accessors,
      bufferViews: bufferViews,
      buffers: [{ byteLength: offsetActual }],
    };

    var jsonStr = JSON.stringify(gltfJSON);
    var jsonEncoder = new TextEncoder();
    var jsonBytes = jsonEncoder.encode(jsonStr);
    var jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4;
    var jsonChunkLength = jsonBytes.byteLength + jsonPadding;

    var binChunkLength = offsetActual;
    var totalGLBLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

    var glbBuffer = new ArrayBuffer(totalGLBLength);
    var dataView = new DataView(glbBuffer);
    var uint8View = new Uint8Array(glbBuffer);

    // Header GLB (12 bytes)
    dataView.setUint32(0, 0x46546C67, true);
    dataView.setUint32(4, 2, true);
    dataView.setUint32(8, totalGLBLength, true);

    // Chunk 0: JSON
    var byteOffset = 12;
    dataView.setUint32(byteOffset, jsonChunkLength, true);
    dataView.setUint32(byteOffset + 4, 0x4E4F534A, true);
    byteOffset += 8;
    uint8View.set(jsonBytes, byteOffset);
    byteOffset += jsonBytes.byteLength;
    for (var pj = 0; pj < jsonPadding; pj++) {
      uint8View[byteOffset++] = 0x20;
    }

    // Chunk 1: BIN
    dataView.setUint32(byteOffset, binChunkLength, true);
    dataView.setUint32(byteOffset + 4, 0x004E4942, true);
    byteOffset += 8;

    for (var b = 0; b < buffersBinarios.length; b++) {
      var chunk = new Uint8Array(buffersBinarios[b]);
      uint8View.set(chunk, byteOffset);
      byteOffset += chunk.byteLength;
    }

    return glbBuffer;
  }

  var claseIFC = null;
  var baseVector = null;
  var moduloWebIFC = null;
  var promesaModuloWebIFC = null;

  async function obtenerModuloWebIFC() {
    if (moduloWebIFC) return moduloWebIFC;
    if (promesaModuloWebIFC) return promesaModuloWebIFC;

    promesaModuloWebIFC = (async function () {
      var mod = await import('https://cdn.jsdelivr.net/npm/web-ifc@0.0.77/+esm');
      moduloWebIFC = mod;
      return moduloWebIFC;
    })();

    return promesaModuloWebIFC;
  }

  function crearClase(IDEE) {
    var Base = IDEE.layer.Vector;

    class IFCLayer extends Base {
      constructor(parametros, opciones) {
        var p = parametros || {};
        var o = opciones || {};
        var baseParams = Object.assign({}, p);
        var estilo = o.style || p.style;
        var ext = p.bbox || p.bounds || null;

        delete baseParams.url;
        delete baseParams.bbox;
        delete baseParams.bounds;
        delete baseParams.position;
        delete baseParams.modelOrigin;
        delete baseParams.heading;
        delete baseParams.pitch;
        delete baseParams.roll;
        delete baseParams.modelOrientation;
        delete baseParams.scale;
        delete baseParams.heightOffset;
        delete baseParams.clampToGround;
        delete baseParams.visualizacion;
        delete baseParams.ifc;
        delete baseParams.ifcOptions;
        delete baseParams.style;

        if (!baseParams.name && !baseParams.legend) {
          baseParams.name = 'IFC';
          baseParams.legend = 'IFC';
        } else if (!baseParams.legend) {
          baseParams.legend = baseParams.name;
        } else if (!baseParams.name) {
          baseParams.name = baseParams.legend;
        }

        var opcionesBase = Object.assign({}, o);
        if (estilo) opcionesBase.style = estilo;

        super(baseParams, opcionesBase);

        if (!estilo) {
          try {
            var IDEE0 = api();
            if (IDEE0 && IDEE0.style && IDEE0.style.Generic) {
              this.setStyle(new IDEE0.style.Generic({
                polygon: {
                  fill: { color: '#0284c7', opacity: 0.3 },
                  stroke: { color: '#0369a1', width: 2 },
                },
              }));
            }
          } catch (e) { /* noop */ }
        }

        var orient = normalizarOrientacion(p);
        var posObj = (p && typeof p.position === 'object' && !Array.isArray(p.position)) ? p.position : {};
        var escalaDef = 1;
        if (typeof p.scale === 'number') escalaDef = p.scale;
        else if (typeof posObj.scale === 'number') escalaDef = posObj.scale;

        this._ifc = true;
        this._ifcUrl = String(p.url || '');
        this._ifcBbox = Array.isArray(ext) && ext.length === 4 ? ext.slice() : null;
        this._ifcPosition = normalizarPosicion(p.position || p.modelOrigin);
        this._ifcHeading = orient.heading;
        this._ifcPitch = orient.pitch;
        this._ifcRoll = orient.roll;
        this._ifcScale = escalaDef;
        this._ifcHeightOffset = (typeof p.heightOffset === 'number') ? p.heightOffset : ((typeof posObj.heightOffset === 'number') ? posObj.heightOffset : 0);
        this._ifcClampToGround = (p.clampToGround === true);
        this._ifcOpciones = Object.assign({}, p.ifc || p.ifcOptions || {});
        this._ifcVisible = (p.visible !== false && p.visualizacion !== false);
        this._ifcOpacity = normalizarOpacidad(p.opacity, 1);
        this._ifcObjeto = null;
        this._ifcBlobUrl = null;
        this._ifcIniciado = false;
        this._ifcProgramado = false;
        this._ifcDestruido = false;
        this._ifcEs3D = false;
        this._ifcError = null;
        this._ifcFeature = false;
        this._ifcGeorreferenciado = Boolean(this._ifcPosition);
        this._ifcExtent3857 = this._ifcBbox ? bbox4326A3857(this._ifcBbox) : null;
        this._ifcFuenteHuella = this._ifcBbox ? 'parametros' : null;
        this._ifcToken = 0;
        this._ifcListenerMap = null;
        this._ifcOnRemoved = null;

        this._ifcCalcularBboxSiFalta();
      }

      _ifcCalcularBboxSiFalta() {
        if (!this._ifcBbox && this._ifcPosition) {
          var lon = this._ifcPosition.lon || 0;
          var lat = this._ifcPosition.lat || 0;
          var d = 0.0006;
          this._ifcBbox = [lon - d, lat - d, lon + d, lat + d];
        }
        if (this._ifcBbox && !this._ifcExtent3857) {
          this._ifcExtent3857 = bbox4326A3857(this._ifcBbox);
        }
        return this._ifcBbox;
      }

      estaGeorreferenciado() {
        return Boolean(this._ifcGeorreferenciado || this._ifcPosition);
      }

      setMap(map) {
        var anterior = this.map_;
        var cambiaMapa = (map !== anterior);
        if (cambiaMapa) this._ifcToken++;
        super.setMap(map);
        if (cambiaMapa && anterior) this._ifcSoltarRemocion(anterior);
        if (!map) {
          this._ifcIniciado = false;
          this._ifcDestruirObjeto();
          return;
        }
        this._ifcEngancharRemocion(map);
        if (cambiaMapa) {
          this._ifcIniciado = false;
          if (this._ifcVisible) {
            this._ifcProgramarArranque(map, 0);
          }
        }
      }

      _ifcEngancharRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || this._ifcListenerMap === map || !evt || typeof map.on !== 'function') return;
        var self = this;
        this._ifcOnRemoved = function (capas) {
          var lista = Array.isArray(capas) ? capas : (capas ? [capas] : []);
          for (var i = 0; i < lista.length; i++) {
            if (lista[i] === self) {
              self._ifcAlQuitarDelMapa();
              break;
            }
          }
        };
        try {
          map.on(evt, this._ifcOnRemoved);
          this._ifcListenerMap = map;
        } catch (e) {
          this._ifcOnRemoved = null;
        }
      }

      _ifcSoltarRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || !evt || !this._ifcOnRemoved) return;
        try {
          if (typeof map.un === 'function') map.un(evt, this._ifcOnRemoved);
        } catch (e) { /* noop */ }
        if (this._ifcListenerMap === map) this._ifcListenerMap = null;
        this._ifcOnRemoved = null;
      }

      _ifcAlQuitarDelMapa() {
        this._ifcToken++;
        this._ifcIniciado = false;
        this._ifcDestruirObjeto();
        this._ifcSoltarRemocion(this._ifcListenerMap);
        this.map_ = null;
      }

      addTo(map, e) {
        var salida = super.addTo ? super.addTo(map, e) : undefined;
        if (this._ifcVisible) {
          this._ifcProgramarArranque(map, 0);
        }
        return salida;
      }

      _ifcProgramarArranque(map, intento) {
        var self = this;
        if (this._ifcIniciado || this._ifcProgramado || this._ifcDestruido) return;
        this._ifcProgramado = true;
        var token = this._ifcToken;
        var ESPERAS = [0, 120, 400, 900];
        var espera = ESPERAS[Math.min(intento, ESPERAS.length - 1)];

        setTimeout(function () {
          self._ifcProgramado = false;
          if (self._ifcDestruido || self._ifcIniciado) return;
          if (token !== self._ifcToken || self.map_ !== map) {
            if (self.map_ && !self._ifcIniciado && self._ifcVisible) self._ifcProgramarArranque(self.map_, 0);
            return;
          }
          var impl = null;
          try { impl = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null; } catch (ex) { impl = null; }
          if (!impl && intento < ESPERAS.length - 1) {
            self._ifcProgramarArranque(map, intento + 1);
            return;
          }
          self._ifcIniciar(map);
        }, espera);
      }

      _ifcIniciar(map) {
        if (this._ifcIniciado || this._ifcDestruido || this.map_ !== map) return;
        this._ifcIniciado = true;
        this._ifcEs3D = esCesium(map);

        if (!this._ifcUrl) {
          this._ifcError = new Error('IFC: falta la URL del fichero');
          return;
        }

        if (!this._ifcEs3D) {
          this._ifcPintarHuella();
          return;
        }

        this._ifcCargar3D(map);
      }

      /**
       * Procesa el archivo IFC de forma aislada e independiente con una instancia de web-ifc:
       */
      async _ifcProcesarIFC(url) {
        var respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error('IFC: no se pudo descargar ' + url);
        var datos = new Uint8Array(await respuesta.arrayBuffer());

        // 1. Extraer georreferenciación de IfcSite directamente del texto STEP si está disponible
        var posDetectada = extraerIfcSiteDeTexto(datos);

        var WebIFC = await obtenerModuloWebIFC();
        var IfcAPI = WebIFC.IfcAPI || (WebIFC.default && WebIFC.default.IfcAPI);
        var apiIfc = new IfcAPI();
        if (typeof apiIfc.SetWasmPath === 'function') {
          apiIfc.SetWasmPath('https://cdn.jsdelivr.net/npm/web-ifc@0.0.77/', true);
        }
        await apiIfc.Init();

        var modelID = apiIfc.OpenModel(datos);

        // 2. Si no se detectó por texto, intentar a través de la API estructurada de web-ifc
        if (!posDetectada) {
          try {
            var sites = apiIfc.GetLineIDsWithType(modelID, WebIFC.IFCSITE);
            if (sites && sites.size && sites.size() > 0) {
              var site = apiIfc.GetLine(modelID, sites.get(0), true);
              var parsedLat = parsearDMSObjeto(site.RefLatitude);
              var parsedLon = parsearDMSObjeto(site.RefLongitude);
              var height = 0;
              if (typeof parsedLat === 'number' && typeof parsedLon === 'number' &&
                  Math.abs(parsedLat) <= 90 && Math.abs(parsedLon) <= 180 &&
                  (parsedLat !== 0 || parsedLon !== 0)) {
                if (site.RefElevation && typeof site.RefElevation._representationValue === 'number') {
                  height = site.RefElevation._representationValue;
                } else if (site.RefElevation && typeof site.RefElevation.value === 'number') {
                  height = site.RefElevation.value;
                } else if (typeof site.RefElevation === 'number') {
                  height = site.RefElevation;
                }
                posDetectada = { lon: parsedLon, lat: parsedLat, height: height };
              }
            }
          } catch (e) { /* sin IfcSite */ }
        }

        // 3. Extraer IfcMapConversion si existe (IFC4)
        if (!posDetectada && WebIFC.IFCMAPCONVERSION) {
          try {
            var convs = apiIfc.GetLineIDsWithType(modelID, WebIFC.IFCMAPCONVERSION);
            if (convs && convs.size && convs.size() > 0) {
              var mc = apiIfc.GetLine(modelID, convs.get(0), true);
              if (mc && typeof mc.Eastings === 'number' && typeof mc.Northings === 'number') {
                var cHeight = (typeof mc.OrthogonalHeight === 'number') ? mc.OrthogonalHeight : 0;
                // Coordenadas proyectadas
              }
            }
          } catch (e) { /* sin IfcMapConversion */ }
        }

        var mallasGLB = [];
        var minX = Infinity, minY = Infinity, minZ = Infinity;
        var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        apiIfc.StreamAllMeshes(modelID, function (mesh) {
          for (var i = 0; i < mesh.geometries.size(); i++) {
            var pg = mesh.geometries.get(i);
            var geom = apiIfc.GetGeometry(modelID, pg.geometryExpressID);
            var rawVerts = apiIfc.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
            var rawInds = apiIfc.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());

            if (!rawVerts || rawVerts.length === 0 || !rawInds || rawInds.length === 0) continue;

            var numVerts = rawVerts.length / 6;
            var positions = new Float32Array(numVerts * 3);
            var normals = new Float32Array(numVerts * 3);
            var m = pg.flatTransformation || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

            for (var v = 0; v < numVerts; v++) {
              var idx6 = v * 6;
              var idx3 = v * 3;
              var lx = rawVerts[idx6];
              var ly = rawVerts[idx6 + 1];
              var lz = rawVerts[idx6 + 2];
              var lnx = rawVerts[idx6 + 3];
              var lny = rawVerts[idx6 + 4];
              var lnz = rawVerts[idx6 + 5];

              var wx = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
              var wy = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
              var wz = m[2] * lx + m[6] * ly + m[10] * lz + m[14];

              var wnx = m[0] * lnx + m[4] * lny + m[8] * lnz;
              var wny = m[1] * lnx + m[5] * lny + m[9] * lnz;
              var wnz = m[2] * lnx + m[6] * lny + m[10] * lnz;
              var nlen = Math.hypot(wnx, wny, wnz) || 1.0;

              positions[idx3] = wx;
              positions[idx3 + 1] = wz;
              positions[idx3 + 2] = -wy;

              normals[idx3] = wnx / nlen;
              normals[idx3 + 1] = wnz / nlen;
              normals[idx3 + 2] = -wny / nlen;

              if (wx < minX) minX = wx;
              if (wy < minY) minY = wy;
              if (wz < minZ) minZ = wz;
              if (wx > maxX) maxX = wx;
              if (wy > maxY) maxY = wy;
              if (wz > maxZ) maxZ = wz;
            }

            var col = pg.color || { x: 0.8, y: 0.8, z: 0.8, w: 1.0 };
            var indices = (numVerts > 65535) ? new Uint32Array(rawInds) : new Uint16Array(rawInds);

            mallasGLB.push({
              positions: positions,
              normals: normals,
              indices: indices,
              color: { r: col.x, g: col.y, b: col.z, a: (typeof col.w === 'number' ? col.w : 1.0) },
            });
          }
        });

        try { apiIfc.CloseModel(modelID); } catch (e) { /* noop */ }

        var aabb = {
          minX: isFinite(minX) ? minX : 0,
          minY: isFinite(minY) ? minY : 0,
          minZ: isFinite(minZ) ? minZ : 0,
          maxX: isFinite(maxX) ? maxX : 0,
          maxY: isFinite(maxY) ? maxY : 0,
          maxZ: isFinite(maxZ) ? maxZ : 0,
        };

        var glbBuffer = crearGLBDesdeMallas(mallasGLB, aabb);
        return {
          glb: glbBuffer,
          position: posDetectada,
          aabb: aabb,
        };
      }

      /**
       * Completa `_ifcBbox` leyendo la huella del `tileset.json` cuando la capa
       * apunta a un 3D Tiles. No dibuja nada: deja la extensión lista para que
       * el selector pueda encuadrar la capa y para pintar la huella en 2D.
       * Si falla (CORS, red, tileset con coordenadas locales) se mantiene el
       * comportamiento anterior: `position` manual o ninguna huella.
       */
      async _ifcHuellaDeTilesetSiFalta() {
        if (this._ifcBbox || this._ifcDestruido || !this._ifcUrl) return;
        var token = this._ifcToken;
        try {
          var bbox = await huellaDeTileset(this._ifcUrl);
          if (!bbox || this._ifcDestruido || token !== this._ifcToken) return;
          this._ifcBbox = bbox;
          this._ifcExtent3857 = bbox4326A3857(bbox);
          this._ifcGeorreferenciado = true;
          this._ifcFuenteHuella = 'tileset';
        } catch (e) {
          console.warn('IFC: no se pudo leer la huella del 3D Tiles (' + (e && e.message ? e.message : e) + ')');
        }
      }

      async _ifcPintarHuella() {
        var IDEE = api();
        var token = this._ifcToken;
        if (!IDEE || this._ifcFeature) return;

        var urlLower = this._ifcUrl.toLowerCase();
        var esIfc = urlLower.indexOf('.ifc') !== -1;
        var esTileset = !esIfc && (urlLower.indexOf('tileset.json') !== -1 ||
          urlLower.indexOf('3dtiles') !== -1 || urlLower.indexOf('3d-tiles') !== -1);
        var formato = esTileset
          ? '3D Tiles'
          : ((urlLower.indexOf('.glb') !== -1 || urlLower.indexOf('.gltf') !== -1) ? 'glTF' : 'IFC');

        // 3D Tiles: la huella real sale del propio `tileset.json` (region o box + transform).
        if (esTileset && !this._ifcBbox) {
          await this._ifcHuellaDeTilesetSiFalta();
          if (this._ifcDestruido || token !== this._ifcToken) return;
        }

        if (esIfc && (!this._ifcPosition || !this._ifcBbox)) {
          try {
            var proc = await this._ifcProcesarIFC(this._ifcUrl);
            if (proc.position && !this._ifcPosition) {
              this._ifcPosition = proc.position;
              this._ifcGeorreferenciado = true;
            }
            if (proc.aabb && this._ifcPosition) {
              var anchoM = Math.max(10, proc.aabb.maxX - proc.aabb.minX);
              var altoM = Math.max(10, proc.aabb.maxY - proc.aabb.minY);
              var pos = this._ifcPosition;
              var lon = pos.lon || 0;
              var lat = pos.lat || 0;
              var mPorGradoLat = 111320;
              var mPorGradoLon = 111320 * Math.cos(lat * Math.PI / 180);
              var dLat = Math.max(0.0002, (altoM / 2) / mPorGradoLat);
              var dLon = Math.max(0.0002, (anchoM / 2) / mPorGradoLon);
              this._ifcBbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
            }
          } catch (e) {
            console.warn('IFC: ' + (e && e.message ? e.message : e));
          }
        }

        // VALIDACIÓN DE GEORREFERENCIACIÓN ESTRICTA
        // En 3D Tiles la huella puede venir del propio tileset, sin `position`.
        if (!this._ifcPosition && !this._ifcBbox) {
          this._ifcGeorreferenciado = false;
          this._ifcError = new Error('IFC no georreferenciado: el modelo no declara IfcSite (RefLatitude/RefLongitude) ni IfcMapConversion, y el tileset no publica una huella (region o box + transform). No se puede ubicar en el mapa.');
          console.warn('IFC: ' + this._ifcError.message);
          return;
        }

        this._ifcCalcularBboxSiFalta();
        if (!this._ifcBbox) return;

        var o = this._ifcBbox[0];
        var s = this._ifcBbox[1];
        var e = this._ifcBbox[2];
        var n = this._ifcBbox[3];

        var ext3857 = this._ifcExtent3857 || bbox4326A3857(this._ifcBbox);
        this._ifcExtent3857 = ext3857;
        var x1 = ext3857[0], y1 = ext3857[1];
        var x2 = ext3857[2], y2 = ext3857[3];

        if (this._ifcDestruido || token !== this._ifcToken || !this.map_) return;
        try {
          this.addFeatures([new IDEE.Feature('huella-ifc', {
            type: 'Feature',
            id: 'huella-ifc',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [x1, y1],
                [x2, y1],
                [x2, y2],
                [x1, y2],
                [x1, y1],
              ]],
            },
            properties: {
              nombre: this.legend || this.name || 'Modelo IFC',
              formato: formato,
              url: this._ifcUrl,
              oeste: o, sur: s, este: e, norte: n,
              nota: esTileset
                ? 'Conjunto 3D Tiles visualizable en 3D (Cesium); huella leída del tileset.json'
                : 'Modelo BIM visualizable en 3D (Cesium)',
            },
          })]);
          this._ifcFeature = true;
        } catch (error) {
          console.warn('IFC: error al dibujar huella 2D', error);
        }
      }

      async _ifcCargar3D(map) {
        var token = this._ifcToken;
        var Cesium = window.Cesium;
        try {
          var viewer = map.getMapImpl();
          if (!viewer || !viewer.scene) throw new Error('IFC: visor Cesium no disponible');

          var url = this._ifcUrl;
          var urlLower = url.toLowerCase();
          var esTileset = urlLower.indexOf('tileset.json') !== -1 || urlLower.indexOf('3dtiles') !== -1;
          var esGltf = urlLower.indexOf('.glb') !== -1 || urlLower.indexOf('.gltf') !== -1;
          var esIfc = !esTileset && !esGltf;

          var objeto3D = null;
          var lon = 0, lat = 0, alt = 0;

          // 1. MODO 3D TILES (OGC 3D Tiles)
          if (esTileset) {
            var tilesetOpts = Object.assign({ url: url }, this._ifcOpciones);
            if (Cesium.Cesium3DTileset.fromUrl) {
              objeto3D = await Cesium.Cesium3DTileset.fromUrl(url, tilesetOpts);
            } else {
              objeto3D = new Cesium.Cesium3DTileset(tilesetOpts);
            }
            if (this._ifcDestruido || token !== this._ifcToken || this.map_ !== map) {
              try { if (objeto3D.destroy) objeto3D.destroy(); } catch (e) { /* noop */ }
              return;
            }
            viewer.scene.primitives.add(objeto3D);
            this._ifcObjeto = objeto3D;
            this._ifcAplicarEstado();
            // Huella para que el selector pueda encuadrar la capa (no se dibuja en 3D).
            this._ifcHuellaDeTilesetSiFalta();
            return;
          }

          // 2. MODO IFC O GLTF/GLB
          var glbUrl = url;
          var minZLocal = 0;

          if (esIfc) {
            var resultadoIFC = await this._ifcProcesarIFC(url);
            if (this._ifcDestruido || token !== this._ifcToken || this.map_ !== map) return;

            if (resultadoIFC.position && !this._ifcPosition) {
              this._ifcPosition = resultadoIFC.position;
              this._ifcGeorreferenciado = true;
            }

            // VALIDACIÓN DE GEORREFERENCIACIÓN ESTRICTA
            if (!this._ifcPosition) {
              this._ifcGeorreferenciado = false;
              this._ifcError = new Error('IFC no georreferenciado: el modelo no declara IfcSite (RefLatitude/RefLongitude) ni IfcMapConversion. No se puede posicionar en el mapa.');
              console.warn('IFC: ' + this._ifcError.message);
              return;
            }

            if (resultadoIFC.aabb) {
              if (isFinite(resultadoIFC.aabb.minZ)) {
                minZLocal = resultadoIFC.aabb.minZ;
              }
              var anchoM = Math.max(10, resultadoIFC.aabb.maxX - resultadoIFC.aabb.minX);
              var altoM = Math.max(10, resultadoIFC.aabb.maxY - resultadoIFC.aabb.minY);
              var pLat = this._ifcPosition.lat || 0;
              var pLon = this._ifcPosition.lon || 0;
              var mLat = 111320;
              var mLon = 111320 * Math.cos(pLat * Math.PI / 180);
              var dLat = Math.max(0.0002, (altoM / 2) / mLat);
              var dLon = Math.max(0.0002, (anchoM / 2) / mLon);
              this._ifcBbox = [pLon - dLon, pLat - dLat, pLon + dLon, pLat + dLat];
              this._ifcExtent3857 = bbox4326A3857(this._ifcBbox);
            }

            var blob = new Blob([resultadoIFC.glb], { type: 'model/gltf-binary' });
            this._ifcBlobUrl = URL.createObjectURL(blob);
            glbUrl = this._ifcBlobUrl;
          } else if (esGltf) {
            // Intentar precargar el GLB como Blob URL para evitar problemas de CORS y bloqueos de streaming en el motor de Cesium
            try {
              var respGlb = await fetch(url, { mode: 'cors' });
              if (respGlb.ok) {
                var abGlb = await respGlb.arrayBuffer();
                var blobGlb = new Blob([abGlb], { type: 'model/gltf-binary' });
                this._ifcBlobUrl = URL.createObjectURL(blobGlb);
                glbUrl = this._ifcBlobUrl;
              }
            } catch (errBlob) {
              // Si falla fetch directo (ej. CORS estricto en cliente sin cabeceras), se usa la URL original
              glbUrl = url;
            }
          }

          if (!this._ifcPosition) {
            this._ifcGeorreferenciado = false;
            this._ifcError = new Error('IFC no georreferenciado: falta posición geográfica');
            console.warn('IFC: ' + this._ifcError.message);
            return;
          }

          this._ifcCalcularBboxSiFalta();

          lon = (typeof this._ifcPosition.lon === 'number') ? this._ifcPosition.lon : (this._ifcPosition.x || 0);
          lat = (typeof this._ifcPosition.lat === 'number') ? this._ifcPosition.lat : (this._ifcPosition.y || 0);
          alt = (typeof this._ifcPosition.height === 'number') ? this._ifcPosition.height : (this._ifcPosition.z || 0);

          alt = alt - minZLocal + this._ifcHeightOffset;

          var origin = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
          var hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(this._ifcHeading || 0),
            Cesium.Math.toRadians(this._ifcPitch || 0),
            Cesium.Math.toRadians(this._ifcRoll || 0)
          );

          var modelMatrix = Cesium.Matrix4.multiply(
            Cesium.Transforms.headingPitchRollToFixedFrame(origin, hpr),
            Cesium.Matrix4.fromScale(new Cesium.Cartesian3(this._ifcScale, this._ifcScale, this._ifcScale)),
            new Cesium.Matrix4()
          );

          var modelOptions = {
            url: glbUrl,
            modelMatrix: modelMatrix,
            scale: this._ifcScale,
            minimumPixelSize: 32,
            silhouetteColor: Cesium.Color.WHITE.withAlpha(0.6),
            silhouetteSize: 1.5,
          };

          if (Cesium.Model.fromGltfAsync) {
            objeto3D = await Cesium.Model.fromGltfAsync(modelOptions);
          } else if (Cesium.Model.fromGltf) {
            objeto3D = Cesium.Model.fromGltf(modelOptions);
          }

          if (this._ifcDestruido || token !== this._ifcToken || this.map_ !== map) {
            try { if (objeto3D && typeof objeto3D.destroy === 'function') objeto3D.destroy(); } catch (ex) { /* noop */ }
            return;
          }

          viewer.scene.primitives.add(objeto3D);
          this._ifcObjeto = objeto3D;
          this._ifcAplicarEstado();

          // Volar al modelo si la capa está visible
          if (this._ifcVisible && this._ifcPosition && viewer.camera) {
            try {
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt + 120),
                orientation: {
                  heading: Cesium.Math.toRadians(0),
                  pitch: Cesium.Math.toRadians(-45),
                  roll: 0,
                },
                duration: 1.2,
              });
            } catch (e) { /* noop */ }
          }
        } catch (error) {
          if (!this._ifcDestruido && token === this._ifcToken) {
            this._ifcError = error;
            console.warn('IFC 3D: error al cargar ' + this._ifcUrl, error);
          }
        }
      }

      _ifcAplicarEstado() {
        var obj = this._ifcObjeto;
        if (!obj) return;
        var Cesium = window.Cesium;

        try {
          if (typeof obj.show !== 'undefined') obj.show = !!this._ifcVisible;

          // Opacidad en Cesium.Model
          if (Cesium && typeof obj.color !== 'undefined' && typeof Cesium.Color !== 'undefined') {
            obj.color = Cesium.Color.WHITE.withAlpha(this._ifcOpacity);
            if (typeof Cesium.ColorBlendMode !== 'undefined') {
              obj.colorBlendMode = Cesium.ColorBlendMode.MIX;
              obj.colorBlendAmount = 1.0 - this._ifcOpacity;
            }
          }

          // Opacidad en Cesium3DTileset
          if (Cesium && typeof obj.style !== 'undefined' && Cesium.Cesium3DTileStyle) {
            obj.style = new Cesium.Cesium3DTileStyle({
              color: 'color() * rgba(1, 1, 1, ' + this._ifcOpacity + ')',
            });
          }
        } catch (error) {
          console.warn('IFC: error al aplicar estado visual', error);
        }

        var map = this.map_;
        var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
        if (viewer && viewer.scene && typeof viewer.scene.requestRender === 'function') {
          try { viewer.scene.requestRender(); } catch (e) { /* noop */ }
        }
      }

      _ifcDestruirObjeto() {
        if (this._ifcBlobUrl) {
          try { URL.revokeObjectURL(this._ifcBlobUrl); } catch (e) { /* noop */ }
          this._ifcBlobUrl = null;
        }
        if (!this._ifcObjeto) return;
        try {
          var map = this.map_;
          var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
          if (viewer && viewer.scene && typeof viewer.scene.primitives !== 'undefined') {
            try { viewer.scene.primitives.remove(this._ifcObjeto); } catch (e) { /* noop */ }
          }
          if (typeof this._ifcObjeto.destroy === 'function') this._ifcObjeto.destroy();
        } catch (e) { /* noop */ }
        this._ifcObjeto = null;
      }

      setVisible(visible) {
        var antes = this._ifcVisible;
        this._ifcVisible = (visible !== false);
        if (super.setVisible) super.setVisible(this._ifcVisible);
        if (this._ifcVisible && !this._ifcIniciado && this.map_) {
          this._ifcIniciar(this.map_);
        }
        this._ifcAplicarEstado();
      }

      setOpacity(opacity) {
        this._ifcOpacity = normalizarOpacidad(opacity, 1);
        if (super.setOpacity) super.setOpacity(this._ifcOpacity);
        this._ifcAplicarEstado();
      }

      getBoundingBox() {
        this._ifcCalcularBboxSiFalta();
        return this._ifcBbox ? this._ifcBbox.slice() : null;
      }

      getMaxExtent(user) {
        this._ifcCalcularBboxSiFalta();
        var es3D = this._ifcEs3D;
        if (!es3D) {
          try { es3D = esCesium(this.map_); } catch (e) { es3D = false; }
        }
        if (es3D && this._ifcBbox) {
          return this._ifcBbox.slice();
        }
        if (!es3D && this._ifcExtent3857) {
          return this._ifcExtent3857.slice();
        }
        return super.getMaxExtent(user);
      }

      destroy() {
        this._ifcDestruido = true;
        this._ifcToken++;
        this._ifcSoltarRemocion(this._ifcListenerMap);
        this._ifcDestruirObjeto();
        super.destroy();
      }

      getState() {
        return {
          visible: this._ifcVisible,
          opacity: this._ifcOpacity,
          url: this._ifcUrl,
          position: this._ifcPosition,
          heading: this._ifcHeading,
          pitch: this._ifcPitch,
          roll: this._ifcRoll,
          scale: this._ifcScale,
        };
      }

      setState(state, map) {
        if (!state || typeof state !== 'object') return;
        if (typeof state.visible === 'boolean') this.setVisible(state.visible);
        if (typeof state.opacity === 'number') this.setOpacity(state.opacity);
        if (state.position) this._ifcPosition = normalizarPosicion(state.position);
        if (typeof state.heading === 'number') this._ifcHeading = state.heading;
        if (typeof state.pitch === 'number') this._ifcPitch = state.pitch;
        if (typeof state.roll === 'number') this._ifcRoll = state.roll;
        if (typeof state.scale === 'number') this._ifcScale = state.scale;
      }
    }

    return IFCLayer;
  }

  function instalar() {
    var IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.Vector) return false;

    var baseActual = IDEE.layer.Vector;
    if (claseIFC === null || baseVector !== baseActual) {
      claseIFC = crearClase(IDEE);
      baseVector = baseActual;
    }

    if (IDEE.layer.IFC === claseIFC) return true;

    IDEE.layer.IFC = claseIFC;
    if (window.IDEE && window.IDEE.layer) window.IDEE.layer.IFC = claseIFC;
    if (window.M && window.M.layer) window.M.layer.IFC = claseIFC;
    return true;
  }

  function IFCLayer(parametros, opciones) {
    if (!claseIFC) instalar();
    if (!claseIFC) throw new Error('ifcLayer: IDEE.layer.IFC no esta instalada');
    return new claseIFC(parametros, opciones);
  }

  function cuandoInstalado(timeout) {
    var tope = typeof timeout === 'number' ? timeout : 5000;
    return new Promise(function (resolve) {
      var inicio = Date.now();
      (function comprobar() {
        if (instalar()) return resolve(true);
        if (Date.now() - inicio >= tope) return resolve(false);
        setTimeout(comprobar, 25);
      })();
    });
  }

  function crearCapa(url, opts) {
    opts = opts || {};
    instalar();
    var IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.IFC) {
      throw new Error('ifcLayer: IDEE.layer.IFC no esta instalada');
    }
    var params = Object.assign({}, opts, { url: url });
    var estilo = params.style;
    delete params.style;
    return new IDEE.layer.IFC(params, estilo ? { style: estilo } : {});
  }

  function anadirCapa(mapa, url, opts) {
    var capa = crearCapa(url, opts);
    if (mapa && typeof mapa.addLayers === 'function') mapa.addLayers(capa);
    return capa;
  }

  instalar();

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      var objetivo = e && e.target;
      if (objetivo && objetivo.tagName === 'SCRIPT' && /apiidee.*\\.js/i.test(objetivo.src || '')) {
        instalar();
      }
    }, true);
  }

  if (typeof window !== 'undefined') {
    window.ifcLayer = {
      version: VERSION,
      crearCapa: crearCapa,
      anadirCapa: anadirCapa,
      instalar: instalar,
      cuandoInstalado: cuandoInstalado,
      clase: function () { return IFCLayer; },
      claseBase: function () { return claseIFC; },
    };
    window.miIFC = window.ifcLayer;
    window.miIFCLayer = window.ifcLayer;
  }
})();
