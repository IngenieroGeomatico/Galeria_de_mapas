/*
 * imageLayer: `IDEE.layer.image`, capa para imágenes que NO llevan
 * georreferenciación propia (escaneos, ortofotos sueltas, planos, carteles).
 *
 * QUÉ HAY AQUÍ
 *
 * Una imagen (PNG/JPEG/WebP) no sabe dónde va. Esta extensión añade a la API
 * una capa que la coloca con un punto (`position`) o con un rectángulo
 * (`bbox`), la gira (`heading`, `pitch`, `roll`) y la escala (`scale`).
 *
 * USO
 *
 *   new IDEE.layer.image({
 *     url: 'plano.jpg',
 *     position: { lon: -3.7038, lat: 40.4168, height: 650 },
 *     bbox: [-3.7045, 40.4163, -3.7031, 40.4173],   // alternativa a position
 *     heading: 30, pitch: 0, roll: 0,               // grados
 *     scale: 1,                                     // número o {x, y}
 *     heightOffset: 0,                              // metros
 *     ancho: 500, alto: 300,                        // metros (solo con position)
 *     metrosPorPixel: 1,                            // si no hay ancho/alto
 *     name, legend, visible, opacity,
 *   });
 *
 * PRECEDENCIA DE `bbox` SOBRE `position`
 *
 * Si llegan los dos, manda el `bbox`: su centro es el punto de colocación y
 * su ancho/alto, la extensión de la imagen. De `position` solo se aprovecha
 * la altura (`position.height`). La rotación y la escala se siguen aplicando
 * sobre ese rectángulo, alrededor de su centro.
 *
 * SIN `bbox`
 *
 * Hace falta un tamaño en metros, porque una imagen no lo trae:
 *   - `ancho` / `alto` en metros, o
 *   - `metrosPorPixel` (por defecto 1) por el tamaño natural de la imagen.
 * El punto de `position` es el CENTRO de la imagen.
 *
 * EN 2D (OpenLayers)
 *
 * La capa es vectorial: su única entidad es el polígono de la huella, y el
 * estilo es un `ol.style.Style` con `renderer`, que dibuja la imagen sobre
 * las cuatro esquinas del polígono ya proyectadas a píxeles. Así el giro, la
 * escala y el zoom salen nítidos sin teselar ni recortar la imagen, y la capa
 * se comporta como cualquier otra capa vectorial (selector, opacidad,
 * visibilidad, extensión).
 *
 * EN 3D (Cesium)
 *
 *   - Sin `pitch` ni `roll`: polígono con material de imagen, apoyado en el
 *     terreno (`RELATIVE_TO_GROUND`) y `stRotation` para que la textura gire
 *     con la huella.
 *   - Con `pitch` o `roll`: la imagen se sale del terreno y se dibuja en un
 *     plano 3D (`PlaneGraphics`) orientado con `headingPitchRollQuaternion`.
 *
 * `position.height` es una cota RELATIVA al suelo mientras `clampToGround`
 * esté activo (por defecto): se suma la altura del terreno del punto, así que
 * `height: 0` deja la imagen apoyada. Con `clampToGround: false` la cota es
 * absoluta (elipsoide), como en el resto de capas de la API.
 *
 * CONTRATO DE ESTADO (cambio 2D/3D)
 *
 * `getState()` / `setState()` conservan visibilidad, opacidad, posición,
 * bbox, giro, escala y cota.
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
   * globo y, si la tesela aún no está cargada, al proveedor de terreno. Sin
   * terreno devuelve 0 (cota del elipsoide).
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

    if (Array.isArray(p.orientation)) {
      h = Number(p.orientation[0]) || 0;
      pt = Number(p.orientation[1]) || 0;
      r = Number(p.orientation[2]) || 0;
    } else if (Array.isArray(posObj.orientation)) {
      h = Number(posObj.orientation[0]) || 0;
      pt = Number(posObj.orientation[1]) || 0;
      r = Number(posObj.orientation[2]) || 0;
    } else {
      if (typeof p.heading === 'number') h = p.heading;
      else if (typeof posObj.heading === 'number') h = posObj.heading;
      else if (typeof p.rotation === 'number') h = p.rotation;
      else if (typeof posObj.rotation === 'number') h = posObj.rotation;

      if (typeof p.pitch === 'number') pt = p.pitch;
      else if (typeof posObj.pitch === 'number') pt = posObj.pitch;

      if (typeof p.roll === 'number') r = p.roll;
      else if (typeof posObj.roll === 'number') r = posObj.roll;
    }
    return { heading: h, pitch: pt, roll: r };
  }

  function normalizarEscala(valor) {
    if (esFinito(valor) && valor !== 0) return { x: valor, y: valor };
    if (Array.isArray(valor) && valor.length >= 2) {
      var ax = Number(valor[0]), ay = Number(valor[1]);
      if (esFinito(ax) && esFinito(ay) && ax !== 0 && ay !== 0) return { x: ax, y: ay };
    }
    if (valor && typeof valor === 'object') {
      var ox = (typeof valor.x === 'number') ? valor.x : 1;
      var oy = (typeof valor.y === 'number') ? valor.y : 1;
      if (esFinito(ox) && esFinito(oy) && ox !== 0 && oy !== 0) return { x: ox, y: oy };
    }
    return { x: 1, y: 1 };
  }

  /** Giro en el plano con el convenio de Cesium: positivo = horario desde el norte. */
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

  function anchoAltoDeBbox(bbox) {
    var c = centroDeBbox(bbox);
    var metrosPorGradoLon = 111320 * Math.cos(c.lat * Math.PI / 180);
    return {
      ancho: Math.abs(bbox[2] - bbox[0]) * Math.max(1, metrosPorGradoLon),
      alto: Math.abs(bbox[3] - bbox[1]) * 110574,
    };
  }

  /**
   * Esquinas [oeste-sur, este-sur, este-norte, oeste-norte] en EPSG:4326, ya
   * escaladas y giradas alrededor del centro.
   */
  function esquinasLonLat(centro, ancho, alto, heading) {
    var metrosPorGradoLon = 111320 * Math.cos(centro.lat * Math.PI / 180);
    var hx = Math.max(0.5, ancho / 2);
    var hy = Math.max(0.5, alto / 2);
    var locales = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
    var esquinas = [];
    for (var i = 0; i < locales.length; i++) {
      var girada = rotarEnPlano(locales[i][0], locales[i][1], heading);
      esquinas.push([
        centro.lon + girada[0] / Math.max(1, metrosPorGradoLon),
        centro.lat + girada[1] / 110574,
      ]);
    }
    return esquinas;
  }

  function anillo3857(esquinas) {
    var anillo = [];
    for (var i = 0; i < esquinas.length; i++) {
      anillo.push(lonLatA3857(esquinas[i][0], esquinas[i][1]));
    }
    anillo.push(anillo[0].slice());
    return anillo;
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

  var claseImagen = null;
  var baseVector = null;
  var contadorHuellas = 0;

  function crearClase(IDEE) {
    var Base = IDEE.layer.Vector;

    class ImageLayer extends Base {
      constructor(parametros, opciones) {
        var p = parametros || {};
        var o = opciones || {};
        var baseParams = Object.assign({}, p);
        var ext = p.bbox || p.bounds || null;

        var CLAVES_PROPIAS = [
          'url', 'bbox', 'bounds', 'position', 'heading', 'pitch', 'roll', 'rotation',
          'orientation', 'scale', 'heightOffset', 'height', 'altura', 'ancho', 'alto',
          'metrosPorPixel', 'crossOrigin', 'clampToGround', 'opacity', 'visible',
        ];
        for (var i = 0; i < CLAVES_PROPIAS.length; i++) delete baseParams[CLAVES_PROPIAS[i]];

        if (!baseParams.name && !baseParams.legend) {
          baseParams.name = 'Imagen';
          baseParams.legend = 'Imagen';
        } else if (!baseParams.legend) {
          baseParams.legend = baseParams.name;
        } else if (!baseParams.name) {
          baseParams.name = baseParams.legend;
        }

        super(baseParams, o);

        var orient = normalizarOrientacion(p);
        var posObj = (p && typeof p.position === 'object' && !Array.isArray(p.position)) ? p.position : {};
        var escalaEntrada = (p.scale !== undefined) ? p.scale
          : (posObj.scale !== undefined ? posObj.scale : 1);
        var alturaSuelta = (typeof p.height === 'number') ? p.height
          : ((typeof p.altura === 'number') ? p.altura : null);

        this._img = true;
        this._imgUrl = String(p.url || '');
        this._imgBbox = bboxValida(ext);
        this._imgPosition = normalizarPosicion(p.position);
        this._imgAltura = alturaSuelta;
        this._imgHeading = orient.heading;
        this._imgPitch = orient.pitch;
        this._imgRoll = orient.roll;
        this._imgEscala = normalizarEscala(escalaEntrada);
        this._imgHeightOffset = (typeof p.heightOffset === 'number') ? p.heightOffset
          : ((typeof posObj.heightOffset === 'number') ? posObj.heightOffset : 0);
        this._imgAncho = esFinito(p.ancho) ? p.ancho : null;
        this._imgAlto = esFinito(p.alto) ? p.alto : null;
        this._imgMetrosPorPixel = esFinito(p.metrosPorPixel) && p.metrosPorPixel > 0 ? p.metrosPorPixel : 1;
        this._imgCrossOrigin = (p.crossOrigin === null) ? null : (p.crossOrigin || 'anonymous');
        this._imgClampToGround = (p.clampToGround !== false);
        this._imgVisible = (p.visible !== false);
        this._imgOpacity = normalizarOpacidad(p.opacity, 1);

        this._imgElemento = null;
        this._imgCargada = false;
        this._imgCarga = null;
        this._imgHuella = null;
        this._imgEsquinas = null;
        this._imgFeature = false;
        this._imgIdHuella = 'huella-imagen-' + (++contadorHuellas);
        this._imgEntidad = null;
        this._imgMaterial = null;
        this._imgIniciado = false;
        this._imgProgramado = false;
        this._imgDestruido = false;
        this._imgEs3D = false;
        this._imgError = null;
        this._imgToken = 0;
        this._imgListenerMap = null;
        this._imgOnRemoved = null;
      }

      /* ---------------------- consulta ---------------------- */

      estaGeorreferenciado() {
        return Boolean(this._imgPosition || this._imgBbox);
      }

      _imgCentro() {
        if (this._imgBbox) {
          var c = centroDeBbox(this._imgBbox);
          var altura = 0;
          if (this._imgPosition && esFinito(this._imgPosition.height)) altura = this._imgPosition.height;
          else if (esFinito(this._imgAltura)) altura = this._imgAltura;
          return { lon: c.lon, lat: c.lat, height: altura };
        }
        if (this._imgPosition) {
          return {
            lon: this._imgPosition.lon,
            lat: this._imgPosition.lat,
            height: this._imgPosition.height,
          };
        }
        return null;
      }

      /** Ancho y alto de la imagen en metros, con la escala aplicada. */
      _imgMedidas() {
        var escala = this._imgEscala;
        if (this._imgBbox) {
          var medidas = anchoAltoDeBbox(this._imgBbox);
          return { ancho: medidas.ancho * escala.x, alto: medidas.alto * escala.y };
        }
        var ancho = this._imgAncho;
        var alto = this._imgAlto;
        if (!ancho || !alto) {
          var natural = this._imgElemento
            ? { ancho: this._imgElemento.naturalWidth, alto: this._imgElemento.naturalHeight }
            : { ancho: 100, alto: 100 };
          if (!ancho && !alto) {
            ancho = natural.ancho * this._imgMetrosPorPixel;
            alto = natural.alto * this._imgMetrosPorPixel;
          } else if (!ancho) {
            ancho = alto * (natural.ancho / Math.max(1, natural.alto));
          } else if (!alto) {
            alto = ancho * (natural.alto / Math.max(1, natural.ancho));
          }
        }
        return { ancho: ancho * escala.x, alto: alto * escala.y };
      }

      /**
       * Calcula (una sola vez) las esquinas en EPSG:4326 y el anillo en
       * EPSG:3857. Necesita la imagen cargada cuando no hay `bbox`.
       */
      _imgCalcularHuella() {
        if (this._imgHuella) return this._imgHuella;
        var centro = this._imgCentro();
        if (!centro) return null;
        var medidas = this._imgMedidas();
        var esquinas = esquinasLonLat(centro, medidas.ancho, medidas.alto, this._imgHeading);
        this._imgEsquinas = esquinas;
        this._imgHuella = anillo3857(esquinas);
        return this._imgHuella;
      }

      /* ---------------------- carga de la imagen ---------------------- */

      _imgCargar() {
        if (this._imgCargada) return Promise.resolve(this._imgElemento);
        if (this._imgCarga) return this._imgCarga;

        var self = this;
        this._imgCarga = new Promise(function (resolve) {
          if (!self._imgUrl) return resolve(null);

          var intentos = [];
          if (self._imgCrossOrigin) intentos.push(self._imgCrossOrigin);
          intentos.push(null);

          var indice = 0;

          function probar() {
            if (indice >= intentos.length) return resolve(null);
            var crossOrigin = intentos[indice++];
            var img = new Image();
            if (crossOrigin) img.crossOrigin = crossOrigin;
            img.onload = function () {
              self._imgElemento = img;
              self._imgCargada = true;
              resolve(img);
            };
            img.onerror = function () {
              probar();
            };
            img.src = self._imgUrl;
          }

          probar();
        }).then(function (img) {
          self._imgCarga = null;
          if (!img && !self._imgDestruido) {
            self._imgError = new Error('Imagen: no se pudo cargar ' + self._imgUrl);
            console.warn('Imagen: ' + self._imgError.message);
          }
          return img;
        });

        return this._imgCarga;
      }

      /* ---------------------- ciclo de vida ---------------------- */

      setMap(map) {
        var anterior = this.map_;
        var cambiaMapa = (map !== anterior);
        if (cambiaMapa) this._imgToken++;
        super.setMap(map);
        if (cambiaMapa && anterior) this._imgSoltarRemocion(anterior);
        if (!map) {
          this._imgIniciado = false;
          this._imgDestruirObjeto();
          return;
        }
        this._imgEngancharRemocion(map);
        if (cambiaMapa) {
          this._imgIniciado = false;
          if (this._imgVisible) this._imgProgramarArranque(map, 0);
        }
      }

      _imgEngancharRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || this._imgListenerMap === map || !evt || typeof map.on !== 'function') return;
        var self = this;
        this._imgOnRemoved = function (capas) {
          var lista = Array.isArray(capas) ? capas : (capas ? [capas] : []);
          for (var i = 0; i < lista.length; i++) {
            if (lista[i] === self) {
              self._imgAlQuitarDelMapa();
              break;
            }
          }
        };
        try {
          map.on(evt, this._imgOnRemoved);
          this._imgListenerMap = map;
        } catch (e) {
          this._imgOnRemoved = null;
        }
      }

      _imgSoltarRemocion(map) {
        var IDEE = api();
        var evt = IDEE && IDEE.evt && IDEE.evt.REMOVED_LAYER;
        if (!map || !evt || !this._imgOnRemoved) return;
        try {
          if (typeof map.un === 'function') map.un(evt, this._imgOnRemoved);
        } catch (e) { /* noop */ }
        if (this._imgListenerMap === map) this._imgListenerMap = null;
        this._imgOnRemoved = null;
      }

      _imgAlQuitarDelMapa() {
        this._imgToken++;
        this._imgIniciado = false;
        this._imgDestruirObjeto();
        this._imgSoltarRemocion(this._imgListenerMap);
        this.map_ = null;
      }

      addTo(map, e) {
        var salida = super.addTo ? super.addTo(map, e) : undefined;
        if (this._imgVisible) this._imgProgramarArranque(map, 0);
        return salida;
      }

      _imgProgramarArranque(map, intento) {
        var self = this;
        if (this._imgIniciado || this._imgProgramado || this._imgDestruido) return;
        this._imgProgramado = true;
        var token = this._imgToken;
        var ESPERAS = [0, 120, 400, 900];
        var espera = ESPERAS[Math.min(intento, ESPERAS.length - 1)];

        setTimeout(function () {
          self._imgProgramado = false;
          if (self._imgDestruido || self._imgIniciado) return;
          if (token !== self._imgToken || self.map_ !== map) {
            if (self.map_ && !self._imgIniciado && self._imgVisible) self._imgProgramarArranque(self.map_, 0);
            return;
          }
          var impl = null;
          try { impl = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null; } catch (ex) { impl = null; }
          if (!impl && intento < ESPERAS.length - 1) {
            self._imgProgramarArranque(map, intento + 1);
            return;
          }
          self._imgIniciar(map);
        }, espera);
      }

      _imgIniciar(map) {
        if (this._imgIniciado || this._imgDestruido || this.map_ !== map) return;
        this._imgIniciado = true;
        this._imgEs3D = esCesium(map);

        if (!this._imgUrl) {
          this._imgError = new Error('Imagen: falta la URL');
          console.warn('Imagen: ' + this._imgError.message);
          return;
        }
        if (!this._imgPosition && !this._imgBbox) {
          this._imgError = new Error('Imagen no georreferenciada: falta `position` o `bbox`');
          console.warn('Imagen: ' + this._imgError.message);
          return;
        }

        if (this._imgEs3D) this._imgCargar3D(map);
        else this._imgCargar2D();
      }

      /* ---------------------- 2D ---------------------- */

      async _imgCargar2D() {
        var token = this._imgToken;
        var img = await this._imgCargar();
        if (this._imgDestruido || token !== this._imgToken || !this.map_ || this._imgEs3D) return;
        if (!img) return;
        this._imgPintar();
      }

      _imgPintar() {
        var IDEE = api();
        if (!IDEE || this._imgFeature) return;
        var anillo = this._imgCalcularHuella();
        if (!anillo) return;

        this._imgFeature = true;
        try {
          this.addFeatures([new IDEE.Feature(this._imgIdHuella, {
            type: 'Feature',
            id: this._imgIdHuella,
            geometry: { type: 'Polygon', coordinates: [anillo] },
            properties: {
              nombre: this.legend || this.name || 'Imagen',
              formato: 'Imagen',
              url: this._imgUrl,
              nota: 'Imagen georreferenciada por ' + (this._imgBbox ? 'bbox' : 'posición y escala'),
            },
          })]);
          this._imgAplicarEstilo2D();
        } catch (e) {
          this._imgFeature = false;
          console.warn('Imagen: no se pudo añadir la huella', e);
        }
      }

      /**
       * Estilo con `renderer`: dibuja la imagen sobre las cuatro esquinas del
       * polígono ya proyectadas a píxeles. El orden del anillo es
       * [SO, SE, NE, NO, SO]; en píxeles (y hacia abajo) eso es
       * [abajo-izq, abajo-der, arriba-der, arriba-izq].
       */
      _imgAplicarEstilo2D() {
        var ol = window.ol;
        var capa = this.getImpl && this.getImpl();
        var olLayer = capa && typeof capa.getOL3Layer === 'function' ? capa.getOL3Layer() : null;
        if (!ol || !ol.style || !ol.style.Style || !olLayer || !olLayer.setStyle) return;

        var self = this;
        var estilo = new ol.style.Style({
          renderer: function (pixelCoords, state) {
            var img = self._imgElemento;
            if (!img || !self._imgCargada) return;
            var anillo = pixelCoords && pixelCoords[0];
            if (!anillo || anillo.length < 5) return;

            var abajoIzq = anillo[0];
            var abajoDer = anillo[1];
            var arribaDer = anillo[2];
            var arribaIzq = anillo[3];

            var ancho = img.naturalWidth || img.width;
            var alto = img.naturalHeight || img.height;
            if (!ancho || !alto) return;

            var ctx = state.context;
            ctx.save();
            // `transform` multiplica la matriz actual: respeta el pixelRatio
            // que OpenLayers ya tenga aplicado al contexto.
            ctx.transform(
              (arribaDer[0] - arribaIzq[0]) / ancho, (arribaDer[1] - arribaIzq[1]) / ancho,
              (abajoIzq[0] - arribaIzq[0]) / alto, (abajoIzq[1] - arribaIzq[1]) / alto,
              arribaIzq[0], arribaIzq[1]
            );
            ctx.drawImage(img, 0, 0, ancho, alto);
            ctx.restore();
          },
        });

        try {
          olLayer.setStyle(estilo);
        } catch (e) {
          console.warn('Imagen: no se pudo aplicar el estilo', e);
        }
      }

      /* ---------------------- 3D ---------------------- */

      async _imgCargar3D(map) {
        var token = this._imgToken;
        var Cesium = window.Cesium;
        try {
          var viewer = map.getMapImpl();
          if (!viewer || !viewer.scene || !viewer.entities) throw new Error('Imagen: visor Cesium no disponible');

          var img = await this._imgCargar();
          if (!img) throw new Error('Imagen: no se pudo cargar ' + this._imgUrl);
          if (this._imgDestruido || token !== this._imgToken || this.map_ !== map) return;

          var centro = this._imgCentro();
          var anillo = this._imgCalcularHuella();
          if (!centro || !anillo || !this._imgEsquinas) throw new Error('Imagen: sin georreferenciación');

          var altura = centro.height + this._imgHeightOffset;
          if (this._imgClampToGround) {
            // `position.height` es relativa al suelo; para el plano inclinado
            // hay que resolverla aquí porque no admite heightReference.
            altura += await alturaDelTerreno(map, centro.lon, centro.lat);
          }
          var inclinada = (Math.abs(this._imgPitch) > 1e-6 || Math.abs(this._imgRoll) > 1e-6);
          // La imagen se pasa ya cargada: con una URL, Cesium la pide por su
          // cuenta y una imagen de otro dominio sin CORS deja el material en
          // blanco ("tainted" en WebGL).
          var material = new Cesium.ImageMaterialProperty({ image: img, transparent: true });
          this._imgMaterial = material;
          var entidad = new Cesium.Entity({
            id: 'imagen-' + this._imgIdHuella,
            show: this._imgVisible,
            name: this.legend || this.name || 'Imagen',
          });

          if (inclinada) {
            // Imagen inclinada: plano 3D en la posición, orientado con HPR.
            var medidas = this._imgMedidas();
            var origen = Cesium.Cartesian3.fromDegrees(centro.lon, centro.lat, altura);
            var hpr = new Cesium.HeadingPitchRoll(
              Cesium.Math.toRadians(this._imgHeading || 0),
              Cesium.Math.toRadians(this._imgPitch || 0),
              Cesium.Math.toRadians(this._imgRoll || 0)
            );
            entidad.position = origen;
            entidad.orientation = Cesium.Transforms.headingPitchRollQuaternion(origen, hpr);
            entidad.plane = {
              plane: new Cesium.Plane(Cesium.Cartesian3.UNIT_Z, 0),
              dimensions: new Cesium.Cartesian2(medidas.ancho, medidas.alto),
              material: material,
            };
          } else {
            // Imagen tumbada: polígono con la textura girada. Con
            // `clampToGround` (por defecto) se apoya en el terreno; si no, se
            // dibuja a la cota de `position.height + heightOffset`.
            var posiciones = [];
            for (var i = 0; i < this._imgEsquinas.length; i++) {
              posiciones.push(this._imgClampToGround
                ? Cesium.Cartesian3.fromDegrees(this._imgEsquinas[i][0], this._imgEsquinas[i][1])
                : Cesium.Cartesian3.fromDegrees(this._imgEsquinas[i][0], this._imgEsquinas[i][1], altura));
            }
            var poligono = {
              hierarchy: new Cesium.PolygonHierarchy(posiciones),
              material: material,
              // Cesium gira la textura en sentido antihorario; `heading` es
              // horario, de ahí el signo.
              stRotation: -Cesium.Math.toRadians(this._imgHeading || 0),
            };
            if (this._imgClampToGround) {
              // Cota relativa al terreno: `position.height: 0` queda apoyada.
              poligono.heightReference = Cesium.HeightReference.RELATIVE_TO_GROUND;
              poligono.height = centro.height + this._imgHeightOffset;
            } else {
              poligono.perPositionHeight = true;
            }
            entidad.polygon = poligono;
          }

          viewer.entities.add(entidad);
          this._imgEntidad = entidad;
          this._imgAplicarEstado();
        } catch (error) {
          if (!this._imgDestruido && token === this._imgToken) {
            this._imgError = error;
            console.warn('Imagen 3D: ' + (error && error.message ? error.message : error));
          }
        }
      }

      /** Aplica visibilidad y opacidad al objeto 3D ya creado. */
      _imgAplicarEstado() {
        var Cesium = window.Cesium;
        if (this._imgEntidad) {
          try { this._imgEntidad.show = !!this._imgVisible; } catch (e) { /* noop */ }
        }
        // En 2D la opacidad la lleva el propio `ol.layer.Vector`; en 3D hay
        // que teñir el material, porque el color multiplica la textura.
        if (this._imgMaterial && Cesium && Cesium.Color) {
          try {
            this._imgMaterial.color = Cesium.Color.WHITE.withAlpha(this._imgOpacity);
          } catch (e) { /* noop */ }
        }
        var map = this.map_;
        var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
        if (viewer && viewer.scene && typeof viewer.scene.requestRender === 'function') {
          try { viewer.scene.requestRender(); } catch (e) { /* noop */ }
        }
      }

      _imgDestruirObjeto() {
        this._imgMaterial = null;
        if (!this._imgEntidad) return;
        try {
          var map = this.map_;
          var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
          if (viewer && viewer.entities && typeof viewer.entities.remove === 'function') {
            viewer.entities.remove(this._imgEntidad);
          }
        } catch (e) { /* noop */ }
        this._imgEntidad = null;
      }

      /* ---------------------- estado y extensión ---------------------- */

      setVisible(visible) {
        this._imgVisible = (visible !== false);
        if (super.setVisible) super.setVisible(this._imgVisible);
        if (this._imgVisible && !this._imgIniciado && this.map_) this._imgIniciar(this.map_);
        this._imgAplicarEstado();
      }

      setOpacity(opacity) {
        this._imgOpacity = normalizarOpacidad(opacity, 1);
        if (super.setOpacity) super.setOpacity(this._imgOpacity);
        this._imgAplicarEstado();
      }

      getBoundingBox() {
        if (this._imgBbox) return this._imgBbox.slice();
        if (this._imgHuella) return bboxDeAnillo(this._imgHuella);
        return null;
      }

      getMaxExtent(user) {
        var es3D = this._imgEs3D;
        if (!es3D) {
          try { es3D = esCesium(this.map_); } catch (e) { es3D = false; }
        }
        var bbox = this.getBoundingBox();
        if (es3D && bbox) return bbox.slice();
        if (!es3D && this._imgHuella) {
          var extent = extentDeAnillo(this._imgHuella);
          if (extent) return extent;
        }
        return super.getMaxExtent(user);
      }

      destroy() {
        this._imgDestruido = true;
        this._imgToken++;
        this._imgSoltarRemocion(this._imgListenerMap);
        this._imgDestruirObjeto();
        super.destroy();
      }

      getState() {
        return {
          visible: this._imgVisible,
          opacity: this._imgOpacity,
          url: this._imgUrl,
          position: this._imgPosition,
          bbox: this._imgBbox,
          heading: this._imgHeading,
          pitch: this._imgPitch,
          roll: this._imgRoll,
          scale: this._imgEscala,
          heightOffset: this._imgHeightOffset,
          ancho: this._imgAncho,
          alto: this._imgAlto,
          metrosPorPixel: this._imgMetrosPorPixel,
          crossOrigin: this._imgCrossOrigin,
          clampToGround: this._imgClampToGround,
        };
      }

      setState(state, map) {
        if (!state || typeof state !== 'object') return;
        var recalcular = false;

        if (!this._imgBbox && Array.isArray(state.bbox)) {
          var bbox = bboxValida(state.bbox);
          if (bbox) { this._imgBbox = bbox; recalcular = true; }
        }
        if (!this._imgPosition && state.position) {
          this._imgPosition = normalizarPosicion(state.position);
          recalcular = recalcular || Boolean(this._imgPosition);
        }
        if (typeof state.heading === 'number' && state.heading !== this._imgHeading) {
          this._imgHeading = state.heading;
          recalcular = true;
        }
        if (typeof state.pitch === 'number' && state.pitch !== this._imgPitch) {
          this._imgPitch = state.pitch;
          recalcular = true;
        }
        if (typeof state.roll === 'number' && state.roll !== this._imgRoll) {
          this._imgRoll = state.roll;
          recalcular = true;
        }
        if (state.scale !== undefined) {
          var escala = normalizarEscala(state.scale);
          if (escala.x !== this._imgEscala.x || escala.y !== this._imgEscala.y) {
            this._imgEscala = escala;
            recalcular = true;
          }
        }
        if (typeof state.heightOffset === 'number' && state.heightOffset !== this._imgHeightOffset) {
          this._imgHeightOffset = state.heightOffset;
          recalcular = true;
        }
        if (state.ancho !== undefined && state.ancho !== this._imgAncho) {
          this._imgAncho = esFinito(state.ancho) ? state.ancho : null;
          recalcular = true;
        }
        if (state.alto !== undefined && state.alto !== this._imgAlto) {
          this._imgAlto = esFinito(state.alto) ? state.alto : null;
          recalcular = true;
        }
        if (typeof state.metrosPorPixel === 'number' && state.metrosPorPixel > 0
          && state.metrosPorPixel !== this._imgMetrosPorPixel) {
          this._imgMetrosPorPixel = state.metrosPorPixel;
          recalcular = true;
        }
        if (state.crossOrigin !== undefined) this._imgCrossOrigin = state.crossOrigin;
        if (typeof state.clampToGround === 'boolean') this._imgClampToGround = state.clampToGround;

        if (recalcular) {
          this._imgHuella = null;
          this._imgEsquinas = null;
          this._imgReiniciar();
        }
        if (typeof state.visible === 'boolean') this.setVisible(state.visible);
        if (typeof state.opacity === 'number') this.setOpacity(state.opacity);
      }

      /**
       * Vuelve a montar lo que ya estuviera pintado tras un cambio de estado.
       * En la práctica `setState` llega sobre una instancia recién creada (aún
       * sin iniciar), pero si ya estaba en el mapa se rehace sin duplicar.
       */
      _imgReiniciar() {
        if (!this._imgIniciado) return;
        if (this._imgFeature) {
          try { this.removeFeatures([this._imgIdHuella]); } catch (e) { /* noop */ }
          this._imgFeature = false;
        }
        this._imgIniciado = false;
        this._imgDestruirObjeto();
        if (this._imgVisible && this.map_) this._imgProgramarArranque(this.map_, 0);
      }
    }

    return ImageLayer;
  }

  /* ------------------------------------------------------------------ */
  /* Instalación                                                         */
  /* ------------------------------------------------------------------ */

  function instalar() {
    var IDEE = api();
    if (!IDEE || !IDEE.layer || !IDEE.layer.Vector) return false;

    var baseActual = IDEE.layer.Vector;
    if (claseImagen === null || baseVector !== baseActual) {
      claseImagen = crearClase(IDEE);
      baseVector = baseActual;
    }

    if (IDEE.layer.image === claseImagen) return true;

    IDEE.layer.image = claseImagen;
    IDEE.layer.Image = claseImagen;
    if (window.IDEE && window.IDEE.layer) {
      window.IDEE.layer.image = claseImagen;
      window.IDEE.layer.Image = claseImagen;
    }
    if (window.M && window.M.layer) {
      window.M.layer.image = claseImagen;
      window.M.layer.Image = claseImagen;
    }
    return true;
  }

  function ImageLayer(parametros, opciones) {
    if (!claseImagen) instalar();
    if (!claseImagen) throw new Error('imageLayer: IDEE.layer.image no está instalada');
    return new claseImagen(parametros, opciones);
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
    if (!IDEE || !IDEE.layer || !IDEE.layer.image) {
      throw new Error('imageLayer: IDEE.layer.image no está instalada');
    }
    return new IDEE.layer.image(Object.assign({}, opts, { url: url }));
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
    window.imageLayer = {
      version: VERSION,
      crearCapa: crearCapa,
      anadirCapa: anadirCapa,
      instalar: instalar,
      cuandoInstalado: cuandoInstalado,
      clase: function () { return ImageLayer; },
      claseBase: function () { return claseImagen; },
    };
    window.miImagen = window.imageLayer;
    window.miImageLayer = window.imageLayer;
  }
})();
