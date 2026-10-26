/*
 * ifcLayer: capa IFC (Industry Foundation Classes) para 3D.
 *
 * QUE HACE
 *
 *   new IDEE.layer.IFC({
 *     url,                 // URL del IFC (o de su conversion a glTF/3D Tiles)
 *     bbox,                // [oeste, sur, este, norte] en EPSG:4326 (huella en 2D)
 *     name, legend,        // como cualquier capa de la API
 *     position,            // { lon, lat, height } anclaje del modelo en 3D
 *     heading, scale,      // orientacion y escala del modelo en 3D
 *   }, { style });
 *
 * IFC no se pinta de serie en Cesium ni en OpenLayers. Esta extension ofrece
 * una fachada `IDEE.layer.IFC` (subclase de `IDEE.layer.Vector`) que:
 *
 * - En 2D dibuja la huella del modelo (bbox) con la propia capa Vector.
 * - En 3D carga el recurso indicado por `url` sobre el viewer de Cesium. Si la
 *   URL apunta a un `tileset.json` se carga como `Cesium3DTileset`; en caso
 *   contrario se intenta como modelo glTF/GLB con `Cesium.Model`. Es el camino
 *   habitual para publicar un IFC en la web (convertido a 3D Tiles o glTF).
 *
 * La fachada extiende `IDEE.layer.Vector` a proposito: es la clase de la API
 * que funciona en 2D y en 3D y la que entiende el selector (visibilidad,
 * opacidad, zoom a la capa y destroy).
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';

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

  var claseIFC = null;
  var baseVector = null;

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
        delete baseParams.heading;
        delete baseParams.scale;
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

        // Estilo por defecto para que la huella sea visible en 2D si el
        // visualizador no pasa uno propio.
        if (!estilo) {
          try {
            var IDEE0 = api();
            if (IDEE0 && IDEE0.style && IDEE0.style.Generic) {
              this.setStyle(new IDEE0.style.Generic({
                polygon: {
                  fill: { color: '#e11d48', opacity: 0.25 },
                  stroke: { color: '#9f1239', width: 2 },
                },
              }));
            }
          } catch (e) { /* noop */ }
        }

        this._ifc = true;
        this._ifcUrl = String(p.url || '');
        this._ifcBbox = Array.isArray(ext) && ext.length === 4 ? ext.slice() : null;
        this._ifcPosition = p.position || null;
        this._ifcHeading = (typeof p.heading === 'number') ? p.heading : 0;
        this._ifcScale = (typeof p.scale === 'number') ? p.scale : 1;
        this._ifcOpciones = Object.assign({}, p.ifc || p.ifcOptions || {});
        this._ifcVisible = (p.visible !== false);
        this._ifcOpacity = normalizarOpacidad(p.opacity, 1);
        this._ifcObjeto = null;
        this._ifcIniciado = false;
        this._ifcProgramado = false;
        this._ifcDestruido = false;
        this._ifcEs3D = false;
        this._ifcError = null;
        this._ifcFeature = false;
        this._ifcExtent3857 = null;
        this._ifcToken = 0;
        this._ifcListenerMap = null;
        this._ifcOnRemoved = null;
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
          this._ifcProgramarArranque(map, 0);
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
        this._ifcProgramarArranque(map, 0);
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
            if (self.map_ && !self._ifcIniciado) self._ifcProgramarArranque(self.map_, 0);
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

        if (!this._ifcEs3D) {
          this._ifcPintarHuella();
          return;
        }

        if (!this._ifcUrl) {
          this._ifcError = new Error('IFC: falta la URL del fichero');
          return;
        }
        this._ifcCargar(map);
      }

      async _ifcPintarHuella() {
        var IDEE = api();
        var token = this._ifcToken;
        if (!IDEE || !this._ifcBbox || this._ifcFeature) return;

        var o = this._ifcBbox[0];
        var s = this._ifcBbox[1];
        var e = this._ifcBbox[2];
        var n = this._ifcBbox[3];

        try {
          var sw = await IDEE.utils.reproject([o, s], 'EPSG:4326', 'EPSG:3857');
          var ne = await IDEE.utils.reproject([e, n], 'EPSG:4326', 'EPSG:3857');
          var x1 = sw[0];
          var y1 = sw[1];
          var x2 = ne[0];
          var y2 = ne[1];

          this._ifcExtent3857 = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];

          if (this._ifcDestruido || token !== this._ifcToken || !this.map_) return;
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
              nombre: 'Huella IFC',
              formato: 'IFC',
              url: this._ifcUrl,
              oeste: o,
              sur: s,
              este: e,
              norte: n,
              nota: 'El modelo IFC se carga solo en 3D',
            },
          })]);
          this._ifcFeature = true;
        } catch (error) {
          console.warn('IFC: no se pudo dibujar la huella', error);
        }
      }

      async _ifcCargar(map) {
        var self = this;
        var token = this._ifcToken;
        var Cesium = window.Cesium;
        try {
          var viewer = map.getMapImpl();
          if (!viewer || !viewer.scene) throw new Error('IFC: el viewer de Cesium no esta listo');

          var url = this._ifcUrl;
          var glb = await this._ifcConvertir(url);

          if (this._ifcDestruido || token !== this._ifcToken || this.map_ !== map) return;

          var blob = new Blob([glb], { type: 'model/gltf-binary' });
          var blobUrl = URL.createObjectURL(blob);

          var opcionesModelo = {
            url: blobUrl,
            scale: this._ifcScale,
            minimumPixelSize: 64,
          };
          if (this._ifcPosition) {
            var origin = Cesium.Cartesian3.fromDegrees(
              this._ifcPosition.lon || this._ifcPosition.x || 0,
              this._ifcPosition.lat || this._ifcPosition.y || 0,
              this._ifcPosition.height || this._ifcPosition.z || 0
            );
            var hpr = new Cesium.HeadingPitchRoll(
              (this._ifcHeading || 0) * Math.PI / 180, 0, 0
            );
            opcionesModelo.modelMatrix = Cesium.Matrix4.multiply(
              Cesium.Transforms.headingPitchRollToFixedFrame(origin, hpr),
              Cesium.Matrix4.fromScale(new Cesium.Cartesian3(this._ifcScale, this._ifcScale, this._ifcScale)),
              new Cesium.Matrix4()
            );
          }

          var objeto = await Cesium.Model.fromGltfAsync(opcionesModelo);

          try { URL.revokeObjectURL(blobUrl); } catch (e) { /* noop */ }

          if (this._ifcDestruido || token !== this._ifcToken || this.map_ !== map) {
            try { if (objeto && typeof objeto.destroy === 'function') objeto.destroy(); } catch (ex) { /* noop */ }
            return;
          }

          this._ifcObjeto = objeto;
          this._ifcAplicarEstado();
        } catch (error) {
          if (!this._ifcDestruido && token === this._ifcToken) {
            this._ifcError = error;
            console.warn('IFC: no se pudo cargar ' + this._ifcUrl, error);
          }
        }
      }

      async _ifcConvertir(url) {
        var respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error('IFC: no se pudo descargar ' + url);
        var datos = new Uint8Array(await respuesta.arrayBuffer());

        var geometryMod = await import('https://cdn.jsdelivr.net/npm/@ifc-lite/geometry@1.2.1/+esm');
        var exportMod = await import('https://cdn.jsdelivr.net/npm/@ifc-lite/export@1.2.1/+esm');
        var wasmMod = await import('https://cdn.jsdelivr.net/npm/@ifc-lite/wasm@1.2.1/+esm');
        var initWasm = wasmMod.default || wasmMod.initWasm || wasmMod;
        var wasmUrl = 'https://cdn.jsdelivr.net/npm/@ifc-lite/wasm@1.2.1/pkg/ifc-lite_bg.wasm';
        try { await initWasm({ module_or_path: wasmUrl }); } catch (e) { /* ya inicializado */ }

        var GeometryProcessor = geometryMod.GeometryProcessor;
        var GLTFExporter = exportMod.GLTFExporter || exportMod.GltfExporter || exportMod.GLTFExporter;
        var processor = new GeometryProcessor();
        await processor.init();
        var result = await processor.process(datos);
        var exporter = new GLTFExporter(result);
        var glb = exporter.exportGLB();
        try { processor.dispose(); } catch (e) { /* noop */ }
        if (!glb || !glb.byteLength) throw new Error('IFC: la conversion no produjo geometria');
        return glb;
      }

      _ifcAplicarEstado() {
        var obj = this._ifcObjeto;
        if (!obj) return;
        try {
          if (typeof obj.show !== 'undefined') obj.show = !!this._ifcVisible;
          if (typeof obj.style !== 'undefined' && obj.style) {
            // no-op: el estilo depende del formato cargado
          }
        } catch (error) {
          console.warn('IFC: no se pudo aplicar visibilidad', error);
        }
        var map = this.map_;
        var viewer = map && typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
        if (viewer && viewer.scene && typeof viewer.scene.requestRender === 'function') {
          try { viewer.scene.requestRender(); } catch (e) { /* noop */ }
        }
      }

      _ifcDestruirObjeto() {
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
        this._ifcVisible = (visible !== false);
        if (super.setVisible) super.setVisible(this._ifcVisible);
        this._ifcAplicarEstado();
      }

      setOpacity(opacity) {
        this._ifcOpacity = normalizarOpacidad(opacity, 1);
        if (super.setOpacity) super.setOpacity(this._ifcOpacity);
      }

      getMaxExtent(user) {
        if (this._ifcBbox) {
          var es3D = this._ifcEs3D;
          if (!es3D) {
            try { es3D = esCesium(this.map_); } catch (e) { es3D = false; }
          }
          if (es3D) return this._ifcBbox.slice();
          if (this._ifcExtent3857) return this._ifcExtent3857.slice();
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
        };
      }

      setState(state, map) {
        if (!state || typeof state !== 'object') return;
        if (typeof state.visible === 'boolean') this.setVisible(state.visible);
        if (typeof state.opacity === 'number') this.setOpacity(state.opacity);
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
  setInterval(instalar, 10);

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      var objetivo = e && e.target;
      if (objetivo && objetivo.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(objetivo.src || '')) {
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
