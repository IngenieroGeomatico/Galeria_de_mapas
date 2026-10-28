/*
 * glbLayer: `IDEE.layer.glb`, capa para modelos glTF/GLB que NO llevan
 * georreferenciación propia.
 *
 * QUÉ HAY AQUÍ
 *
 * Un `.glb` es una malla 3D y nada más: no guarda ni dónde va ni cómo se
 * orienta. Esta extensión añade a la API una capa que coloca el modelo con
 * los parámetros de siempre (posición, giro, escala y cota) y, en 2D, dibuja
 * su huella.
 *
 * USO
 *
 *   new IDEE.layer.glb({
 *     url: 'modelo.glb',                            // .glb o .gltf
 *     position: { lon: -3.7038, lat: 40.4168, height: 650 },
 *     bbox: [-3.7045, 40.4163, -3.7031, 40.4173],   // alternativa a position
 *     heading: 30, pitch: 0, roll: 0,               // grados
 *     scale: 1,                                     // número o {x, y, z}
 *     heightOffset: 0,                              // metros
 *     clampToGround: true,                          // cota relativa al terreno
 *     ajustarABbox: false,                          // escala el modelo para encajar en bbox
 *     baseAlSuelo: true,                            // apoya la base del modelo en la cota
 *     huellaReal: true,                             // lee el AABB del glTF para la huella 2D
 *     name, legend, visible, opacity,
 *     glb: {},                                      // opciones de Cesium.Model
 *   });
 *
 * PRECEDENCIA DE `bbox` SOBRE `position`
 *
 * Si llegan los dos, manda el `bbox`: su centro es el punto de colocación y
 * el propio `bbox` es la huella. De `position` solo se aprovecha la altura
 * (`position.height`), porque un rectángulo en 2D no dice a qué cota va el
 * modelo. Lo mismo con el parámetro suelto `height`.
 *
 * ORIENTACIÓN Y ESCALA
 *
 * `heading` gira en el plano con el convenio de Cesium (positivo = horario
 * desde el norte) y se aplica igual en 2D y en 3D, para que la huella y el
 * modelo no se separen al cambiar de implementación. `pitch` y `roll` solo
 * existen en 3D: en 2D la huella se dibuja como si el modelo estuviera plano.
 *
 * HUELLA EN 2D
 *
 * Se calcula, por este orden:
 *   1. Del `bbox`, si lo hay (escala y giro se aplican sobre su centro).
 *   2. Del AABB real del modelo, leído del JSON del glTF (los accessors
 *      POSITION traen `min`/`max`). Del GLB se piden solo los primeros bytes
 *      con `Range`, no el fichero entero. El AABB se pasa de glTF (Y arriba)
 *      a Cesium (Z arriba): la horizontal es (x, -z) y la vertical, y.
 *   3. Si no hay ni bbox ni AABB legible, un cuadrado de 0,0006° alrededor
 *      de la posición, que es lo que hace `IDEE.layer.IFC`.
 *
 * El AABB ignora las matrices de los nodos (solo usa `min`/`max` de los
 * accessors), así que es exacto en modelos con la escena sin transformar y
 * aproximado en los que reparten la malla con `nodes`. Para la huella sobra.
 *
 * EN 3D
 *
 * `Cesium.Model` con una `modelMatrix` construida con
 * `Transforms.headingPitchRollToFixedFrame` (marco ENU en la posición) por la
 * escala. Con `baseAlSuelo: true` (por defecto) la Y mínima del glTF se apoya
 * en `position.height + heightOffset`, que es lo que se espera al colocar un
 * edificio sobre el terreno; con `baseAlSuelo: false` se coloca el origen
 * local del modelo.
 *
 * `position.height` es una cota RELATIVA al suelo cuando `clampToGround` está
 * activo (por defecto): se suma la altura del terreno del punto, así que
 * `height: 0` deja el modelo apoyado en el suelo. Con `clampToGround: false`
 * la cota es absoluta (elipsoide), como en el resto de capas de la API.
 *
 * CONTRATO DE ESTADO (cambio 2D/3D)
 *
 * `getState()` / `setState()` conservan visibilidad, opacidad, posición,
 * bbox, giro, escala y cota. Los visualizadores que recrean la capa desde
 * `mapa()` no lo necesitan (los parámetros se vuelven a leer), pero sí los
 * que añaden capas en caliente.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

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

  function esFinito(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /**
   * Altura del terreno en un punto, en metros. Primero se le pregunta al
   * globo (barato, pero solo contesta si la tesela ya está cargada) y, si no
   * la sabe, se le pide al proveedor de terreno. Sin terreno devuelve 0, que
   * es la cota del elipsoide.
   *
   * Hace falta porque un modelo sin georreferenciar llega con cota relativa
   * al suelo: `height: 0` tiene que dejarlo apoyado en el terreno, no 200 m
   * por debajo (que es lo que hay en media España).
   */
  async function alturaDelTerreno(map, lon, lat) {
    var Cesium = window.Cesium;
    if (!Cesium || !Cesium.Cartographic) return 0;

    var viewer = null;
    try { viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null; } catch (e) { viewer = null; }
    var globo = viewer && viewer.scene ? viewer.scene.globe : null;
    if (!globo) return 0;

    var cartografico = Cesium.Cartographic.fromDegrees(lon, lat);
    var altura = (typeof globo.getHeight === 'function') ? globo.getHeight(cartografico) : undefined;
    if (esFinito(altura)) return altura;

    try {
      var proveedor = viewer.scene.terrainProvider;
      if (proveedor && typeof Cesium.sampleTerrainMostDetailed === 'function') {
        var muestras = await Cesium.sampleTerrainMostDetailed(proveedor, [cartografico.clone()]);
        if (muestras && muestras[0] && esFinito(muestras[0].height)) return muestras[0].height;
      }
    } catch (e) { /* sin terreno disponible: cota 0 */ }
    return 0;
  }

  function normalizarOpacidad(valor, porDefecto) {
    var n = Number(valor);
    if (!isFinite(n)) return porDefecto;
    return Math.max(0, Math.min(1, n));
  }

  function lonLatA3857(lon, lat) {
    var x = (lon * 20037508.34) / 180;
    var latAcotada = Math.max(-89.9, Math.min(89.9, lat));
    var y = Math.log(Math.tan(((90 + latAcotada) * Math.PI) / 360)) / (Math.PI / 180);
    y = (y * 20037508.34) / 180;
    return [x, y];
  }

  function xyA4326(x, y) {
    var lon = (x / 20037508.34) * 180;
    var lat = (y / 20037508.34) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
    return [lon, lat];
  }

  function bbox4326A3857(bbox) {
    if (!Array.isArray(bbox) || bbox.length < 4) return null;
    var suroeste = lonLatA3857(bbox[0], bbox[1]);
    var noreste = lonLatA3857(bbox[2], bbox[3]);
    return [
      Math.min(suroeste[0], noreste[0]),
      Math.min(suroeste[1], noreste[1]),
      Math.max(suroeste[0], noreste[0]),
      Math.max(suroeste[1], noreste[1]),
    ];
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
      var alt = (typeof pos.height === 'number') ? pos.height
        : (typeof pos.z === 'number' ? pos.z : (typeof pos.alt === 'number' ? pos.alt : 0));
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

  /** Escala uniforme (número) o por ejes ({x, y, z} o [x, y, z]). */
  function normalizarEscala(valor) {
    if (esFinito(valor) && valor !== 0) return { x: valor, y: valor, z: valor };
    if (Array.isArray(valor) && valor.length >= 3) {
      var ax = Number(valor[0]), ay = Number(valor[1]), az = Number(valor[2]);
      if (esFinito(ax) && esFinito(ay) && esFinito(az) && ax !== 0 && ay !== 0 && az !== 0) {
        return { x: ax, y: ay, z: az };
      }
    }
    if (valor && typeof valor === 'object') {
      var ox = (typeof valor.x === 'number') ? valor.x : 1;
      var oy = (typeof valor.y === 'number') ? valor.y : 1;
      var oz = (typeof valor.z === 'number') ? valor.z : 1;
      if (esFinito(ox) && esFinito(oy) && esFinito(oz) && ox !== 0 && oy !== 0 && oz !== 0) {
        return { x: ox, y: oy, z: oz };
      }
    }
    return { x: 1, y: 1, z: 1 };
  }

  /**
   * Gira un desplazamiento local (este, norte) por un heading en grados con el
   * convenio de Cesium: positivo = sentido horario desde el norte. Se usa el
   * mismo en 2D y en 3D para que huella y modelo coincidan.
   */
  function rotarEnPlano(este, norte, heading) {
    var a = (Number(heading) || 0) * Math.PI / 180;
    var c = Math.cos(a);
    var s = Math.sin(a);
    return [c * este + s * norte, -s * este + c * norte];
  }

  function centroDeBbox(bbox) {
    return {
      lon: (bbox[0] + bbox[2]) / 2,
      lat: (bbox[1] + bbox[3]) / 2,
    };
  }

  /** Ancho y alto de un bbox en metros, en el paralelo de su centro. */
  function anchoAltoDeBbox(bbox) {
    var c = centroDeBbox(bbox);
    var metrosPorGradoLon = 111320 * Math.cos(c.lat * Math.PI / 180);
    return {
      ancho: Math.abs(bbox[2] - bbox[0]) * Math.max(1, metrosPorGradoLon),
      alto: Math.abs(bbox[3] - bbox[1]) * 110574,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Extensión del modelo, sin Cesium                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Une los `min`/`max` de los accessors POSITION del JSON de un glTF. No
   * necesita los buffers: el estándar obliga a que los accessors de posición
   * declaren `min` y `max`.
   */
  function aabbDeGltfJSON(json) {
    if (!json || typeof json !== 'object') return null;
    var accesores = json.accessors || [];
    var min = [Infinity, Infinity, Infinity];
    var max = [-Infinity, -Infinity, -Infinity];
    var encontrado = false;
    var mallas = json.meshes || [];

    for (var i = 0; i < mallas.length; i++) {
      var primitivas = (mallas[i] && mallas[i].primitives) || [];
      for (var j = 0; j < primitivas.length; j++) {
        var atributos = primitivas[j] && primitivas[j].attributes;
        var indice = atributos ? atributos.POSITION : undefined;
        if (indice === undefined || indice === null) continue;
        var accesor = accesores[indice];
        if (!accesor || !Array.isArray(accesor.min) || !Array.isArray(accesor.max)) continue;
        for (var k = 0; k < 3; k++) {
          if (esFinito(accesor.min[k]) && accesor.min[k] < min[k]) min[k] = accesor.min[k];
          if (esFinito(accesor.max[k]) && accesor.max[k] > max[k]) max[k] = accesor.max[k];
        }
        encontrado = true;
      }
    }
    if (!encontrado) return null;
    return { min: min, max: max };
  }

  /**
   * Lee el chunk JSON de un GLB pidiendo solo los primeros bytes. Si el
   * servidor no atiende `Range` devuelve el fichero entero, que es lo peor
   * que puede pasar; el JSON sigue estando al principio.
   */
  async function aabbDeGLB(url) {
    var LIMITE_JSON = 8 * 1024 * 1024;

    var respuesta = await fetch(url, { mode: 'cors', headers: { Range: 'bytes=0-19' } });
    if (!respuesta.ok && respuesta.status !== 206) throw new Error('HTTP ' + respuesta.status);
    var buffer = await respuesta.arrayBuffer();
    if (buffer.byteLength < 20) return null;

    var vista = new DataView(buffer);
    if (vista.getUint32(0, true) !== 0x46546C67) return null; // no es GLB
    var longitudJSON = vista.getUint32(12, true);
    var tipoJSON = vista.getUint32(16, true);
    if (tipoJSON !== 0x4E4F534A || longitudJSON <= 0 || longitudJSON > LIMITE_JSON) return null;

    if (buffer.byteLength < 20 + longitudJSON) {
      var respuesta2 = await fetch(url, {
        mode: 'cors',
        headers: { Range: 'bytes=0-' + (20 + longitudJSON - 1) },
      });
      if (!respuesta2.ok && respuesta2.status !== 206) throw new Error('HTTP ' + respuesta2.status);
      buffer = await respuesta2.arrayBuffer();
    }
    if (buffer.byteLength < 20 + longitudJSON) return null;

    var texto = new TextDecoder('utf-8').decode(new Uint8Array(buffer, 20, longitudJSON));
    return aabbDeGltfJSON(JSON.parse(texto));
  }

  // Una lectura por URL: varias capas con el mismo modelo no repiten petición.
  var cacheAABB = Object.create(null);

  function leerAABBDeModelo(url) {
    if (!url) return Promise.resolve(null);
    if (cacheAABB[url]) return cacheAABB[url];

    cacheAABB[url] = (async function () {
      try {
        var esGltfSuelto = /\.gltf(\?|#|$)/i.test(url) && !/\.glb(\?|#|$)/i.test(url);
        if (esGltfSuelto) {
          var respuesta = await fetch(url, { mode: 'cors' });
          if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
          return aabbDeGltfJSON(await respuesta.json());
        }
        return await aabbDeGLB(url);
      } catch (e) {
        console.warn('GLB: no se pudo leer la extensión de ' + url + ' (' + (e && e.message ? e.message : e) + ')');
        return null;
      }
    })();

    return cacheAABB[url];
  }

  /* ------------------------------------------------------------------ */
  /* Huellas (anillo en EPSG:3857)                                       */
  /* ------------------------------------------------------------------ */

  function anilloDesdeEsquinas(esquinas, centro3857, heading) {
    var anillo = [];
    for (var i = 0; i < esquinas.length; i++) {
      var girada = rotarEnPlano(esquinas[i][0], esquinas[i][1], heading);
      anillo.push([centro3857[0] + girada[0], centro3857[1] + girada[1]]);
    }
    anillo.push(anillo[0].slice());
    return anillo;
  }

  function huellaDeBbox(bbox, escala, heading) {
    var c = centroDeBbox(bbox);
    var centro3857 = lonLatA3857(c.lon, c.lat);
    var medidas = anchoAltoDeBbox(bbox);
    var hx = Math.max(0.5, medidas.ancho / 2) * escala.x;
    var hy = Math.max(0.5, medidas.alto / 2) * escala.z;
    return anilloDesdeEsquinas([[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]], centro3857, heading);
  }

  function huellaDeAABB(aabb, escala, heading, centro3857) {
    // glTF es Y-arriba: en el marco ENU de Cesium, la horizontal es (x, -z).
    var oeste = aabb.min[0] * escala.x;
    var este = aabb.max[0] * escala.x;
    var sur = -aabb.max[2] * escala.z;
    var norte = -aabb.min[2] * escala.z;
    if (!(este > oeste) || !(norte > sur)) return null;
    return anilloDesdeEsquinas([[oeste, sur], [este, sur], [este, norte], [oeste, norte]], centro3857, heading);
  }

  function huellaGenerica(centro, escala) {
    var centro3857 = lonLatA3857(centro.lon, centro.lat);
    var d = 0.0006 * Math.max(1, Math.abs(escala.x || 1));
    var oeste = lonLatA3857(centro.lon - d, centro.lat)[0];
    var este = lonLatA3857(centro.lon + d, centro.lat)[0];
    var sur = lonLatA3857(centro.lon, centro.lat - d)[1];
    var norte = lonLatA3857(centro.lon, centro.lat + d)[1];
    return [[oeste, sur], [este, sur], [este, norte], [oeste, norte], [oeste, sur]];
  }

  function extentDeAnillo(anillo) {
    if (!anillo || !anillo.length) return null;
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (var i = 0; i < anillo.length; i++) {
      if (anillo[i][0] < x1) x1 = anillo[i][0];
      if (anillo[i][1] < y1) y1 = anillo[i][1];
      if (anillo[i][0] > x2) x2 = anillo[i][0];
      if (anillo[i][1] > y2) y2 = anillo[i][1];
    }
    return [x1, y1, x2, y2];
  }

  function bboxDeAnillo(anillo) {
    var extent = extentDeAnillo(anillo);
    if (!extent) return null;
    var suroeste = xyA4326(extent[0], extent[1]);
    var noreste = xyA4326(extent[2], extent[3]);
    return [suroeste[0], suroeste[1], noreste[0], noreste[1]];
  }

  /* ------------------------------------------------------------------ */
  /* Clase                                                               */
  /* ------------------------------------------------------------------ */

  var claseGLB = null;
  var baseVector = null;
  var contadorHuellas = 0;

  function crearClase(IDEE) {
    var Base = IDEE.layer.Vector;

    class GLBLayer extends Base {
      constructor(parametros, opciones) {
        var p = parametros || {};
        var o = opciones || {};
        var baseParams = Object.assign({}, p);
        var estilo = o.style || p.style;
        var ext = p.bbox || p.bounds || null;

        var CLAVES_PROPIAS = [
          'url', 'bbox', 'bounds', 'position', 'modelOrigin', 'heading', 'pitch', 'roll',
          'modelOrientation', 'scale', 'heightOffset', 'height', 'altura', 'clampToGround',
          'ajustarABbox', 'baseAlSuelo', 'huellaReal', 'glb', 'glbOptions', 'style',
        ];
        for (var i = 0; i < CLAVES_PROPIAS.length; i++) delete baseParams[CLAVES_PROPIAS[i]];

        if (!baseParams.name && !baseParams.legend) {
          baseParams.name = 'GLB';
          baseParams.legend = 'GLB';
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
                  fill: { color: '#7c3aed', opacity: 0.22 },
                  stroke: { color: '#5b21b6', width: 2 },
                },
              }));
            }
          } catch (e) { /* noop */ }
        }

        var orient = normalizarOrientacion(p);
        var posObj = (p && typeof p.position === 'object' && !Array.isArray(p.position)) ? p.position : {};
        var escalaEntrada = (p.scale !== undefined) ? p.scale
          : (posObj.scale !== undefined ? posObj.scale : 1);
        var alturaSuelta = (typeof p.height === 'number') ? p.height
          : ((typeof p.altura === 'number') ? p.altura : null);

        this._glb = true;
        this._glbUrl = String(p.url || '');
        this._glbBbox = bboxValida(ext);
        this._glbPosition = normalizarPosicion(p.position || p.modelOrigin);
        this._glbAltura = alturaSuelta;
        this._glbHeading = orient.heading;
        this._glbPitch = orient.pitch;
        this._glbRoll = orient.roll;
        this._glbEscala = normalizarEscala(escalaEntrada);
        this._glbEscalaEfectiva = normalizarEscala(escalaEntrada);
        this._glbHeightOffset = (typeof p.heightOffset === 'number') ? p.heightOffset
          : ((typeof posObj.heightOffset === 'number') ? posObj.heightOffset : 0);
        this._glbAjustarABbox = (p.ajustarABbox === true);
        this._glbBaseAlSuelo = (p.baseAlSuelo !== false);
        this._glbClampToGround = (p.clampToGround !== false);
        this._glbHuellaReal = (p.huellaReal !== false);
        this._glbOpciones = Object.assign({}, p.glb || p.glbOptions || {});
        this._glbVisible = (p.visible !== false);
        this._glbOpacity = normalizarOpacidad(p.opacity, 1);

        this._glbAabb = null;
        this._glbHuella = null;
        this._glbCalculo = null;
        this._glbFeature = false;
        this._glbIdHuella = 'huella-glb-' + (++contadorHuellas);
        this._glbObjeto = null;
        this._glbBlobUrl = null;
        this._glbIniciado = false;
        this._glbProgramado = false;
        this._glbDestruido = false;
        this._glbEs3D = false;
        this._glbError = null;
        this._glbGeorreferenciado = Boolean(this._glbPosition || this._glbBbox);
        this._glbToken = 0;
        this._glbListenerMap = null;
        this._glbOnRemoved = null;
      }

      /* ---------------------- consulta ---------------------- */

      estaGeorreferenciado() {
        return Boolean(this._glbGeorreferenciado || this._glbPosition || this._glbBbox);
      }

      /** Punto de colocación: centro del bbox si lo hay, si no `position`. */
      _glbCentro() {
        if (this._glbBbox) {
          var c = centroDeBbox(this._glbBbox);
          var altura = 0;
          if (this._glbPosition && esFinito(this._glbPosition.height)) altura = this._glbPosition.height;
          else if (esFinito(this._glbAltura)) altura = this._glbAltura;
          return { lon: c.lon, lat: c.lat, height: altura };
        }
        if (this._glbPosition) {
          return {
            lon: this._glbPosition.lon,
            lat: this._glbPosition.lat,
            height: this._glbPosition.height,
          };
        }
        return null;
      }

      /**
       * Cota del origen local del modelo: `position.height` + `heightOffset`,
       * más la altura del terreno si `clampToGround` está activo, menos la Y
       * mínima del modelo cuando `baseAlSuelo` lo apoya por su base.
       */
      async _glbAlturaOrigen(centro) {
        var altura = (centro ? centro.height : 0) + this._glbHeightOffset;
        if (this._glbClampToGround && centro) {
          altura += await alturaDelTerreno(this.map_, centro.lon, centro.lat);
        }
        if (this._glbBaseAlSuelo && this._glbAabb) {
          // glTF es Y-arriba: la base del modelo es su Y mínima.
          altura -= this._glbAabb.min[1] * this._glbEscalaEfectiva.y;
        }
        return altura;
      }

      _glbActualizarEscalaEfectiva() {
        var escala = this._glbEscala;
        this._glbEscalaEfectiva = { x: escala.x, y: escala.y, z: escala.z };
        if (!this._glbAjustarABbox || !this._glbBbox || !this._glbAabb) return;

        var anchoModelo = (this._glbAabb.max[0] - this._glbAabb.min[0]) * escala.x;
        var altoModelo = (this._glbAabb.max[2] - this._glbAabb.min[2]) * escala.z;
        if (!(anchoModelo > 0) || !(altoModelo > 0)) return;

        var medidas = anchoAltoDeBbox(this._glbBbox);
        var ajuste = Math.min(medidas.ancho / anchoModelo, medidas.alto / altoModelo);
        if (esFinito(ajuste) && ajuste > 0) {
          this._glbEscalaEfectiva = {
            x: escala.x * ajuste,
            y: escala.y * ajuste,
            z: escala.z * ajuste,
          };
        }
      }

      /**
       * Calcula (una sola vez) la huella en EPSG:3857. Devuelve la promesa
       * para que la usen tanto el 2D (para pintarla) como el 3D (para que el
       * selector pueda encuadrar la capa).
       */
      _glbCalcularHuella() {
        if (this._glbHuella) return Promise.resolve(this._glbHuella);
        if (this._glbCalculo) return this._glbCalculo;

        var self = this;
        this._glbCalculo = (async function () {
          try {
            var centro = self._glbCentro();
            if (!centro) return null;

            if (self._glbBbox) {
              if (self._glbAjustarABbox && self._glbHuellaReal && !self._glbAabb) {
                self._glbAabb = await leerAABBDeModelo(self._glbUrl);
              }
              self._glbActualizarEscalaEfectiva();
              self._glbHuella = huellaDeBbox(self._glbBbox, self._glbEscalaEfectiva, self._glbHeading);
              return self._glbHuella;
            }

            if (self._glbHuellaReal && !self._glbAabb) {
              self._glbAabb = await leerAABBDeModelo(self._glbUrl);
            }
            self._glbActualizarEscalaEfectiva();
            var centro3857 = lonLatA3857(centro.lon, centro.lat);
            self._glbHuella = self._glbAabb
              ? huellaDeAABB(self._glbAabb, self._glbEscalaEfectiva, self._glbHeading, centro3857)
              : null;
            if (!self._glbHuella) {
              self._glbHuella = huellaGenerica(centro, self._glbEscalaEfectiva);
            }
            return self._glbHuella;
          } catch (e) {
            console.warn('GLB: no se pudo calcular la huella (' + (e && e.message ? e.message : e) + ')');
            return null;
          } finally {
            self._glbCalculo = null;
          }
        })();

        return this._glbCalculo;
      }

      /* ---------------------- ciclo de vida ---------------------- */

      setMap(map) {
        var anterior = this.map_;
        var cambiaMapa = (map !== anterior);
        if (cambiaMapa) this._glbToken++;
        super.setMap(map);
        if (cambiaMapa && anterior) this._glbSoltarRemocion(anterior);
        if (!map) {
          this._glbIniciado = false;
          this._glbDestruirObjeto();
          return;
        }
        this._glbEngancharRemocion(map);
        if (cambiaMapa) {
          this._glbIniciado = false;
          if (this._glbVisible) this._glbProgramarArranque(map, 0);
        }
      }

      _glbEngancharRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || this._glbListenerMap === map || !evt || typeof map.on !== 'function') return;
        var self = this;
        this._glbOnRemoved = function (capas) {
          var lista = Array.isArray(capas) ? capas : (capas ? [capas] : []);
          for (var i = 0; i < lista.length; i++) {
            if (lista[i] === self) {
              self._glbAlQuitarDelMapa();
              break;
            }
          }
        };
        try {
          map.on(evt, this._glbOnRemoved);
          this._glbListenerMap = map;
        } catch (e) {
          this._glbOnRemoved = null;
        }
      }

      _glbSoltarRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || !evt || !this._glbOnRemoved) return;
        try {
          if (typeof map.un === 'function') map.un(evt, this._glbOnRemoved);
        } catch (e) { /* noop */ }
        if (this._glbListenerMap === map) this._glbListenerMap = null;
        this._glbOnRemoved = null;
      }

      _glbAlQuitarDelMapa() {
        this._glbToken++;
        this._glbIniciado = false;
        this._glbDestruirObjeto();
        this._glbSoltarRemocion(this._glbListenerMap);
        this.map_ = null;
      }

      addTo(map, e) {
        var salida = super.addTo ? super.addTo(map, e) : undefined;
        if (this._glbVisible) this._glbProgramarArranque(map, 0);
        return salida;
      }

      _glbProgramarArranque(map, intento) {
        var self = this;
        if (this._glbIniciado || this._glbProgramado || this._glbDestruido) return;
        this._glbProgramado = true;
        var token = this._glbToken;
        var ESPERAS = [0, 120, 400, 900];
        var espera = ESPERAS[Math.min(intento, ESPERAS.length - 1)];

        setTimeout(function () {
          self._glbProgramado = false;
          if (self._glbDestruido || self._glbIniciado) return;
          if (token !== self._glbToken || self.map_ !== map) {
            if (self.map_ && !self._glbIniciado && self._glbVisible) self._glbProgramarArranque(self.map_, 0);
            return;
          }
          var impl = null;
          try { impl = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null; } catch (ex) { impl = null; }
          if (!impl && intento < ESPERAS.length - 1) {
            self._glbProgramarArranque(map, intento + 1);
            return;
          }
          self._glbIniciar(map);
        }, espera);
      }

      _glbIniciar(map) {
        if (this._glbIniciado || this._glbDestruido || this.map_ !== map) return;
        this._glbIniciado = true;
        this._glbEs3D = esCesium(map);

        if (!this._glbUrl) {
          this._glbError = new Error('GLB: falta la URL del modelo');
          console.warn('GLB: ' + this._glbError.message);
          return;
        }
        if (!this._glbPosition && !this._glbBbox) {
          this._glbError = new Error('GLB no georreferenciado: falta `position` o `bbox`');
          this._glbGeorreferenciado = false;
          console.warn('GLB: ' + this._glbError.message);
          return;
        }

        if (this._glbEs3D) this._glbCargar3D(map);
        else this._glbPintarHuella();
      }

      /* ---------------------- 2D ---------------------- */

      async _glbPintarHuella() {
        var IDEE = api();
        var token = this._glbToken;
        if (!IDEE || this._glbFeature) return;

        await this._glbCalcularHuella();
        if (this._glbDestruido || token !== this._glbToken || !this.map_ || this._glbEs3D) return;
        if (!this._glbHuella || this._glbFeature) return;

        var bbox = this.getBoundingBox() || [0, 0, 0, 0];
        this._glbFeature = true;
        try {
          this.addFeatures([new IDEE.Feature(this._glbIdHuella, {
            type: 'Feature',
            id: this._glbIdHuella,
            geometry: {
              type: 'Polygon',
              coordinates: [this._glbHuella],
            },
            properties: {
              nombre: this.legend || this.name || 'Modelo GLB',
              formato: 'glTF/GLB',
              url: this._glbUrl,
              oeste: bbox[0], sur: bbox[1], este: bbox[2], norte: bbox[3],
              nota: 'Modelo 3D visualizable en 3D (Cesium); huella calculada a partir de '
                + (this._glbBbox ? 'el bbox' : 'la extensión del modelo'),
            },
          })]);
        } catch (e) {
          this._glbFeature = false;
          console.warn('GLB: no se pudo añadir la huella', e);
        }
      }

      /* ---------------------- 3D ---------------------- */

      async _glbUrlParaCesium() {
        if (this._glbBlobUrl) return this._glbBlobUrl;
        // Se sirve el modelo como blob: evita problemas de Content-Type y de
        // streaming en Cesium. Si el fetch falla, se usa la URL original.
        try {
          var respuesta = await fetch(this._glbUrl, { mode: 'cors' });
          if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
          var datos = await respuesta.arrayBuffer();
          var blob = new Blob([datos], { type: 'model/gltf-binary' });
          this._glbBlobUrl = URL.createObjectURL(blob);
          return this._glbBlobUrl;
        } catch (e) {
          return this._glbUrl;
        }
      }

      async _glbCargar3D(map) {
        var token = this._glbToken;
        var Cesium = window.Cesium;
        try {
          var viewer = map.getMapImpl();
          if (!viewer || !viewer.scene) throw new Error('GLB: visor Cesium no disponible');

          await this._glbCalcularHuella();
          if (this._glbDestruido || token !== this._glbToken || this.map_ !== map) return;

          var centro = this._glbCentro();
          if (!centro) throw new Error('GLB: sin punto de colocación');

          var urlModelo = await this._glbUrlParaCesium();
          if (this._glbDestruido || token !== this._glbToken || this.map_ !== map) return;

          var altura = await this._glbAlturaOrigen(centro);
          if (this._glbDestruido || token !== this._glbToken || this.map_ !== map) return;
          var origen = Cesium.Cartesian3.fromDegrees(centro.lon, centro.lat, altura);
          var hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(this._glbHeading || 0),
            Cesium.Math.toRadians(this._glbPitch || 0),
            Cesium.Math.toRadians(this._glbRoll || 0)
          );
          var escala = this._glbEscalaEfectiva;
          var marco = Cesium.Transforms.headingPitchRollToFixedFrame(origen, hpr);
          var matriz = Cesium.Matrix4.multiply(
            marco,
            Cesium.Matrix4.fromScale(new Cesium.Cartesian3(escala.x, escala.y, escala.z)),
            new Cesium.Matrix4()
          );

          var opcionesModelo = Object.assign({
            url: urlModelo,
            modelMatrix: matriz,
            minimumPixelSize: 32,
            silhouetteColor: Cesium.Color.WHITE.withAlpha(0.6),
            silhouetteSize: 1.5,
          }, this._glbOpciones);

          var objeto3D = null;
          if (Cesium.Model.fromGltfAsync) {
            objeto3D = await Cesium.Model.fromGltfAsync(opcionesModelo);
          } else if (Cesium.Model.fromGltf) {
            objeto3D = Cesium.Model.fromGltf(opcionesModelo);
          }
          if (!objeto3D) throw new Error('Cesium no sabe cargar modelos glTF');

          if (this._glbDestruido || token !== this._glbToken || this.map_ !== map) {
            try { if (typeof objeto3D.destroy === 'function') objeto3D.destroy(); } catch (ex) { /* noop */ }
            return;
          }

          viewer.scene.primitives.add(objeto3D);
          this._glbObjeto = objeto3D;
          this._glbAplicarEstado();
        } catch (error) {
          if (!this._glbDestruido && token === this._glbToken) {
            this._glbError = error;
            console.warn('GLB 3D: error al cargar ' + this._glbUrl, error);
          }
        }
      }

      _glbAplicarEstado() {
        var obj = this._glbObjeto;
        if (!obj) return;
        var Cesium = window.Cesium;
        try {
          if (typeof obj.show !== 'undefined') obj.show = !!this._glbVisible;
          if (Cesium && typeof obj.color !== 'undefined' && typeof Cesium.Color !== 'undefined') {
            obj.color = Cesium.Color.WHITE.withAlpha(this._glbOpacity);
            if (typeof Cesium.ColorBlendMode !== 'undefined') {
              obj.colorBlendMode = Cesium.ColorBlendMode.MIX;
              obj.colorBlendAmount = 1.0 - this._glbOpacity;
            }
          }
        } catch (e) {
          console.warn('GLB: no se pudo aplicar el estado visual', e);
        }
        var map = this.map_;
        var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
        if (viewer && viewer.scene && typeof viewer.scene.requestRender === 'function') {
          try { viewer.scene.requestRender(); } catch (e) { /* noop */ }
        }
      }

      _glbDestruirObjeto() {
        if (this._glbBlobUrl) {
          try { URL.revokeObjectURL(this._glbBlobUrl); } catch (e) { /* noop */ }
          this._glbBlobUrl = null;
        }
        if (!this._glbObjeto) return;
        try {
          var map = this.map_;
          var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
          if (viewer && viewer.scene && typeof viewer.scene.primitives !== 'undefined') {
            try { viewer.scene.primitives.remove(this._glbObjeto); } catch (e) { /* noop */ }
          }
          if (typeof this._glbObjeto.destroy === 'function') this._glbObjeto.destroy();
        } catch (e) { /* noop */ }
        this._glbObjeto = null;
      }

      /* ---------------------- estado y extensión ---------------------- */

      setVisible(visible) {
        this._glbVisible = (visible !== false);
        if (super.setVisible) super.setVisible(this._glbVisible);
        if (this._glbVisible && !this._glbIniciado && this.map_) this._glbIniciar(this.map_);
        this._glbAplicarEstado();
      }

      setOpacity(opacity) {
        this._glbOpacity = normalizarOpacidad(opacity, 1);
        if (super.setOpacity) super.setOpacity(this._glbOpacity);
        this._glbAplicarEstado();
      }

      getBoundingBox() {
        if (this._glbBbox) return this._glbBbox.slice();
        if (this._glbHuella) return bboxDeAnillo(this._glbHuella);
        return null;
      }

      getMaxExtent(user) {
        var es3D = this._glbEs3D;
        if (!es3D) {
          try { es3D = esCesium(this.map_); } catch (e) { es3D = false; }
        }
        var bbox = this.getBoundingBox();
        if (es3D && bbox) return bbox.slice();
        if (!es3D && this._glbHuella) {
          var extent = extentDeAnillo(this._glbHuella);
          if (extent) return extent;
        }
        return super.getMaxExtent(user);
      }

      destroy() {
        this._glbDestruido = true;
        this._glbToken++;
        this._glbSoltarRemocion(this._glbListenerMap);
        this._glbDestruirObjeto();
        super.destroy();
      }

      getState() {
        return {
          visible: this._glbVisible,
          opacity: this._glbOpacity,
          url: this._glbUrl,
          position: this._glbPosition,
          bbox: this._glbBbox,
          heading: this._glbHeading,
          pitch: this._glbPitch,
          roll: this._glbRoll,
          scale: this._glbEscala,
          heightOffset: this._glbHeightOffset,
          clampToGround: this._glbClampToGround,
          baseAlSuelo: this._glbBaseAlSuelo,
          ajustarABbox: this._glbAjustarABbox,
        };
      }

      setState(state, map) {
        if (!state || typeof state !== 'object') return;
        var recalcular = false;

        if (!this._glbBbox && Array.isArray(state.bbox)) {
          var bbox = bboxValida(state.bbox);
          if (bbox) { this._glbBbox = bbox; recalcular = true; }
        }
        if (!this._glbPosition && state.position) {
          this._glbPosition = normalizarPosicion(state.position);
          recalcular = recalcular || Boolean(this._glbPosition);
        }
        if (typeof state.heading === 'number' && state.heading !== this._glbHeading) {
          this._glbHeading = state.heading;
          recalcular = true;
        }
        if (typeof state.pitch === 'number' && state.pitch !== this._glbPitch) {
          this._glbPitch = state.pitch;
          recalcular = true;
        }
        if (typeof state.roll === 'number' && state.roll !== this._glbRoll) {
          this._glbRoll = state.roll;
          recalcular = true;
        }
        if (state.scale !== undefined) {
          var escala = normalizarEscala(state.scale);
          if (escala.x !== this._glbEscala.x || escala.y !== this._glbEscala.y || escala.z !== this._glbEscala.z) {
            this._glbEscala = escala;
            recalcular = true;
          }
        }
        if (typeof state.heightOffset === 'number' && state.heightOffset !== this._glbHeightOffset) {
          this._glbHeightOffset = state.heightOffset;
          recalcular = true;
        }
        if (typeof state.clampToGround === 'boolean') this._glbClampToGround = state.clampToGround;
        if (typeof state.baseAlSuelo === 'boolean') this._glbBaseAlSuelo = state.baseAlSuelo;
        if (typeof state.ajustarABbox === 'boolean' && state.ajustarABbox !== this._glbAjustarABbox) {
          this._glbAjustarABbox = state.ajustarABbox;
          recalcular = true;
        }

        if (recalcular) {
          this._glbHuella = null;
          this._glbActualizarEscalaEfectiva();
          this._glbReiniciar();
        }
        if (typeof state.visible === 'boolean') this.setVisible(state.visible);
        if (typeof state.opacity === 'number') this.setOpacity(state.opacity);
        this._glbAplicarEstado();
      }

      /**
       * Rehace lo ya pintado tras un cambio de estado. `setState` llega
       * normalmente sobre una instancia recién creada (sin iniciar), pero si
       * la capa ya estaba en el mapa se quita y se vuelve a montar, sin
       * duplicar ni la huella ni el modelo.
       */
      _glbReiniciar() {
        if (!this._glbIniciado) return;
        if (this._glbFeature) {
          try { this.removeFeatures([this._glbIdHuella]); } catch (e) { /* noop */ }
          this._glbFeature = false;
        }
        this._glbIniciado = false;
        this._glbDestruirObjeto();
        if (this._glbVisible && this.map_) this._glbProgramarArranque(this.map_, 0);
      }
    }

    return GLBLayer;
  }

  /* ------------------------------------------------------------------ */
  /* Instalación                                                         */
  /* ------------------------------------------------------------------ */

  function instalar() {
    var IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.Vector) return false;

    var baseActual = IDEE.layer.Vector;
    if (claseGLB === null || baseVector !== baseActual) {
      claseGLB = crearClase(IDEE);
      baseVector = baseActual;
    }

    if (IDEE.layer.glb === claseGLB) return true;

    IDEE.layer.glb = claseGLB;
    IDEE.layer.GLB = claseGLB;
    if (window.IDEE && window.IDEE.layer) {
      window.IDEE.layer.glb = claseGLB;
      window.IDEE.layer.GLB = claseGLB;
    }
    if (window.M && window.M.layer) {
      window.M.layer.glb = claseGLB;
      window.M.layer.GLB = claseGLB;
    }
    return true;
  }

  function GLBLayer(parametros, opciones) {
    if (!claseGLB) instalar();
    if (!claseGLB) throw new Error('glbLayer: IDEE.layer.glb no está instalada');
    return new claseGLB(parametros, opciones);
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
    if (!IDEE || !IDEE.layer || !IDEE.layer.glb) {
      throw new Error('glbLayer: IDEE.layer.glb no está instalada');
    }
    var params = Object.assign({}, opts, { url: url });
    var estilo = params.style;
    delete params.style;
    return new IDEE.layer.glb(params, estilo ? { style: estilo } : {});
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
      if (objetivo && objetivo.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(objetivo.src || '')) {
        instalar();
      }
    }, true);
  }

  if (typeof window !== 'undefined') {
    window.glbLayer = {
      version: VERSION,
      crearCapa: crearCapa,
      anadirCapa: anadirCapa,
      instalar: instalar,
      cuandoInstalado: cuandoInstalado,
      clase: function () { return GLBLayer; },
      claseBase: function () { return claseGLB; },
    };
    window.miGLB = window.glbLayer;
    window.miGLBLayer = window.glbLayer;
  }
})();
