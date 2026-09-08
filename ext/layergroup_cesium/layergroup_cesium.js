/**
 * ============================================================================
 *  layergroup_cesium — Grupos de capas (IDEE.layer.LayerGroup) para Cesium
 * ============================================================================
 *
 *  La build de Cesium de la API-IDEE incluye la FACHADA de LayerGroup (la misma
 *  clase que la build de OL) pero su IMPL correspondiente es un stub vacio
 *  (en el bundle: `33286:()=>{}`). La fachada instancia ese stub como impl, asi
 *  que `new IDEE.layer.LayerGroup(...)` crea un grupo sin impl funcional y el
 *  primer `addLayers()` lanza un TypeError (`getImpl().addLayer` no existe).
 *
 *  Esta extension sustituye `IDEE.layer.LayerGroup` por una fachada propia que
 *  extiende la MISMA clase base (la que expone `IDEE.layer.WMS`, que a su vez
 *  es la que usa la fachada original de LayerGroup) y delega en un impl propio
 *  (CesiumLayerGroupImpl) que:
 *    - guarda las capas hijas (incluidos subgrupos),
 *    - registra cada hija en el impl del mapa (mapImpl.layers_) y llama a su
 *      getImpl().addTo(map), exactamente igual que hacen los add<Type> del impl
 *      Map de Cesium (addWMS, addKML, ...),
 *    - en cascada setMap()/setVisible()/opacidad a las hijas.
 *
 *  Ademas, el impl Map de Cesium descarta las capas de tipo 'LayerGroup' en su
 *  dispatch de addLayers() (know('LayerGroup') === true => short-circuit), asi
 *  que los grupos NUNCA aparecen en map.getLayers(). El selector de capas
 *  (ext_layerSwitcher) construye su arbol buscando los grupos en
 *  map.getLayers(), por lo que se parchea la fachada del Mapa (getLayers() y
 *  removeLayers()) para que los grupos registrados del mapa aparezcan como
 *  nodos y se den de baja al borrarlos.
 *
 *  El parche se aplica SOLO cuando la implementacion activa es Cesium y se
 *  re-aplica de forma idempotente cada 50 ms porque cada build de la API crea
 *  un objeto `window.IDEE` nuevo (window.IDEE=...) al ejecutarse. El intervalo
 *  de cambioImpl sondea cada 100 ms, asi que con 50 ms + orden de registro el
 *  parche siempre queda instalado antes de que se re-ejecute mapa().
 *
 * ============================================================================
 */
(function () {
  'use strict';

  // ── Registro de grupos por mapa ──────────────────────────────────────────
  // Los grupos "viven" en el mapa al que fueron anadidos (setMap). Se guardan
  // en un WeakMap claveado por la instancia de la fachada del Mapa: si el mapa
  // se descarta, el registro se libera solo.
  const groupsByMap = new WeakMap();

  // Mapas creados a traves del envoltorio: el barrido de applyPatch recorre
  // sus capas raiz para normalizar setZIndex (las capas de nivel raiz no
  // pasan por registerChild_). Un Set con instancias de la fachada del Mapa:
  // se libera solo cuando los mapas se descartan.
  const createdMaps = new Set();

  let installedLayerGroupClass = null; // ultima clase fachada instalada
  let wrappedMapFactory = null;        // ultimo envoltorio de IDEE.map instalado

  const isGroupLayer = (l) => !!(l && (l.type === 'LayerGroup' || l._type === 'LayerGroup'));

  const groupsOf = (map) => (map ? (groupsByMap.get(map) || []) : []);

  const registerGroup = (map, group) => {
    if (!map) return;
    const list = groupsByMap.get(map) || [];
    if (list.indexOf(group) === -1) list.push(group);
    groupsByMap.set(map, list);
  };

  const unregisterGroup = (map, group) => {
    if (!map) return;
    const list = groupsByMap.get(map);
    if (!list) return;
    const i = list.indexOf(group);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) groupsByMap.delete(map);
  };

  // ── Z-index en Cesium: indices posicionales ──────────────────────────────
  // El selector de capas (ext_layerSwitcher) reordena asignando z-index al
  // estilo OpenLayers: enteros arbitrarios que pueden ser negativos, duplicados
  // o superar el tamaño de la coleccion (p.ej. las hijas de un grupo reciben
  // techo-1-i y, si el grupo no expone "olLayer", techo=0 => z NEGATIVOS).
  //
  // Cesium NO tiene z-index: posiciona por INDICE dentro de sus colecciones
  // (imageryLayers / dataSources / scene.primitives, rango 0..len-1). Las
  // consecuencias de pasarle un z de OL eran:
  //   - raster con z fuera de rango: "index_error" del bundle y sin mover;
  //     con z NEGATIVO: guard del bundle pasa (-1 <= len-1), hace remove() y
  //     add(cesiumLayer, -1) => Cesium LANZA => la capa desaparece del mapa.
  //   - vector con z negativo: guard pasa y el delta (lower/raise) manda la
  //     capa al fondo absoluto (orden invertido).
  //   - Cesium recalcula _isBaseLayer cada frame (_update): la capa del
  //     indice 0 VISIBLE es la "base". Si una superpuesta llega al indice 0,
  //     se convierte en base y la base real deja de serlo => la base aparece
  //     en el selector de capas.
  //
  // Este parche envuelve el setZIndex del proto de cada impl de capa para
  // acotar el z pedido al rango real de su coleccion Cesium:
  //   [0, len-1]  (vector/Tiles3D)
  //   [1, len-1]  (raster superpuesto: el 0 de imageryLayers es de la base)
  //   [0, len-1]  (raster base: puede ocupar el 0)
  // El getZIndex de los impls ya es "vivo" (lee la posicion real de la
  // coleccion: _layerIndex / indexOf / findIndex), asi que no se toca.
  const buildClampedSetZIndex = (origSetZIndex) => {
    return function (z) {
      let target = z;
      try {
        const num = Number(z);
        if (Number.isFinite(num)) {
          const viewer = (this.map && typeof this.map.getMapImpl === 'function')
            ? this.map.getMapImpl()
            : null;
          const layer = (typeof this.getLayer === 'function') ? this.getLayer() : null;
          if (viewer && layer) {
            let len = null;
            let isImagery = false;
            if (viewer.imageryLayers && viewer.imageryLayers.contains(layer)) {
              len = viewer.imageryLayers.length;
              isImagery = true;
            } else if (viewer.dataSources && viewer.dataSources.indexOf(layer) !== -1) {
              len = viewer.dataSources.length;
            } else if (viewer.scene && viewer.scene.primitives && viewer.scene.primitives.contains(layer)) {
              len = viewer.scene.primitives.length;
            }
            if (len !== null && len > 0) {
              let min = 0;
              if (isImagery) {
                // El indice 0 de imageryLayers esta reservado a la capa base:
                // una superpuesta ahi provocaria el flip de _isBaseLayer.
                const isBase = !!(this.facadeLayer_ && this.facadeLayer_.isBase);
                if (!isBase && len > 1) min = 1;
              }
              target = Math.max(min, Math.min(Math.round(num), len - 1));
            }
          }
        }
      } catch (e) { /* defensivo: usar el z original */ }
      return origSetZIndex.call(this, target);
    };
  };

  // Envuelve el setZIndex del proto de un impl de capa (idempotente por proto,
  // todos los impls se registran con Object.getPrototypeOf desde un impl).
  const wrapImplPrototype = (impl) => {
    try {
      const proto = impl && Object.getPrototypeOf(impl);
      if (!proto || proto.__layergroupCesiumZClamped) return;
      const origSetZIndex = proto.setZIndex;
      if (typeof origSetZIndex !== 'function') return;
      proto.__layergroupCesiumZClamped = true;
      proto.setZIndex = buildClampedSetZIndex(origSetZIndex);
    } catch (e) { /* defensivo */ }
  };

  // Barrido de las capas raiz de un mapa: normaliza el setZIndex de los impls
  // que llegan por map.addLayers() sin pasar por registerChild_ (nivel raiz).
  // Idempotente por proto (los flags viven en el proto de cada build).
  const sweepLayerImpls = (map) => {
    try {
      if (!map || typeof map.getLayers !== 'function') return;
      const layers = map.getLayers();
      if (!Array.isArray(layers)) return;
      layers.forEach((l) => {
        if (isGroupLayer(l)) return;
        const childImpl = (typeof l.getImpl === 'function') ? l.getImpl() : null;
        wrapImplPrototype(childImpl);
      });
    } catch (e) { /* defensivo */ }
  };

  // ── Impl propio de LayerGroup para Cesium ────────────────────────────────
  // Expone la superficie que consume la clase base de capa (getters legend,
  // name, url, isBase, transparent, displayInLayerSwitcher + metodos) y la
  // logica de grupo (hijas, mapa, cascadas).
  function CesiumLayerGroupImpl(params) {
    this.layers = [];                                   // capas hijas (fachadas)
    this.name = params.name;
    this.legend = params.legend;
    this.url = params.url;
    this._type = 'LayerGroup';
    this.type = 'LayerGroup';
    this.transparent = true;                            // superpuesta (no base)
    this.isBase = false;
    this.displayInLayerSwitcher = true;
    this.visibility_ = params.visibility !== false;
    this.opacity_ = 1;
    this.zindex_ = null;
    this.map_ = null;
    this.legendURL_ = '';
  }

  CesiumLayerGroupImpl.prototype = {
    constructor: CesiumLayerGroupImpl,

    // ── API de grupo ───────────────────────────────────────────────────────

    getLayers() {
      return this.layers.slice();
    },

    getMap() {
      return this.map_;
    },

    // La capa de Cesium subyacente de un grupo no existe: un grupo es solo un
    // contenedor, no tiene objeto Cesium propio. refreshIndexAndBaseStatus_
    // del impl Map itera TODAS las capas de map.getLayers() (incluidos los
    // grupos que anade el parche) llamando a e.getImpl().getLayer() y
    // comprobando instanceof: devolver null hace que el grupo se omita en
    // silencio (ningun instanceof casa) sin tocar zindex_/isBase.
    getLayer() { return null; },

    // Al enganchar el grupo a un mapa (o desengancharlo) se propaga en cascada
    // a las hijas: los subgrupos se enganchan igual (recursivo) y las capas
    // normales se registran en el impl del mapa.
    setMap(map) {
      this.map_ = map || null;
      if (!this.map_) return;
      this.layers.slice().forEach((child) => {
        if (isGroupLayer(child)) {
          if (typeof child.setMap === 'function') child.setMap(this.map_);
        } else {
          this.registerChild_(child);
        }
      });
    },

    // Mismo protocolo que la fachada Map.addLayers del bundle: primero
    // setMap(map) en la fachada de la capa (necesario: calculateMaxExtent-
    // WithCapabilities lee this.map_.userMaxExtent y otros codigos internos
    // dependen de que map_ este poblado) y luego el addTo() del impl.
    registerChild_(child) {
      const map = this.map_;
      if (!map || !child) return;
      if (typeof child.setMap === 'function') {
        try { child.setMap(map); } catch (e) { /* defensivo */ }
      }
      const mapImpl = (typeof map.getImpl === 'function') ? map.getImpl() : null;
      if (!mapImpl || !mapImpl.layers_ || !Array.isArray(mapImpl.layers_)) return;
      if (mapImpl.layers_.indexOf(child) === -1) mapImpl.layers_.push(child);
      const childImpl = (typeof child.getImpl === 'function') ? child.getImpl() : null;
      if (childImpl && typeof childImpl.addTo === 'function') {
        try {
          childImpl.addTo(map);
        } catch (e) {
          console.warn('layergroup_cesium: no se pudo anadir la capa "' +
            ((child.name || child.legend) || '?') + '" al mapa Cesium', e);
        }
      }
      // Normaliza el setZIndex del impl de la hija (acota el z al rango de su
      // coleccion Cesium) para que el reordenado del selector funcione.
      wrapImplPrototype(childImpl);
    },

    addLayer(child) {
      if (!child) return child;
      if (this.layers.indexOf(child) === -1) this.layers.push(child);
      if (this.map_) {
        if (isGroupLayer(child)) {
          // el subgrupo se engancha al mapa: registra a sus propias hijas
          if (typeof child.setMap === 'function') child.setMap(this.map_);
        } else {
          this.registerChild_(child);
        }
      }
      return child;
    },

    removeLayer(child) {
      const i = this.layers.indexOf(child);
      if (i !== -1) this.layers.splice(i, 1);
      // Se desengancha del mapa pero NO se destruye: el borrado/limpieza real
      // lo hace map.removeLayers() (como hace el selector de capas).
      if (this.map_ && child && typeof child.setMap === 'function') {
        try { child.setMap(null); } catch (e) { /* defensivo */ }
      }
    },

    // Saca una capa del grupo; si removeIt es false la deja en la raiz del mapa.
    ungroup(child, removeIt) {
      const arr = Array.isArray(child) ? child : [child];
      arr.forEach((c) => {
        this.removeLayer(c);
        if (this.map_ && !removeIt) {
          if (isGroupLayer(c)) {
            if (typeof c.setMap === 'function') c.setMap(this.map_);
          } else {
            this.registerChild_(c);
          }
        }
      });
      return true;
    },

    // ── Visibilidad / opacidad (en cascada) ────────────────────────────────

    setVisible(v) {
      this.visibility_ = !!v;
      this.layers.slice().forEach((c) => {
        try { if (typeof c.setVisible === 'function') c.setVisible(!!v); } catch (e) { /* defensivo */ }
      });
      return this.visibility_;
    },

    isVisible() {
      return this.visibility_;
    },

    setOpacity(v) {
      this.opacity_ = (typeof v === 'number') ? v : 1;
      this.layers.slice().forEach((c) => {
        try { if (typeof c.setOpacity === 'function') c.setOpacity(this.opacity_); } catch (e) { /* defensivo */ }
      });
      return this.opacity_;
    },

    getOpacity() {
      return this.opacity_;
    },

    // ── Superficie minima exigida por la clase base de capa ────────────────

    isQueryable() { return false; },
    inRange() { return true; },

    getZIndex() {
      // El z de un grupo Cesium es su TEcho: el maximo z de sus hijas + 1.
      // Asi el selector reparte a las hijas techo-1, techo-2, ... (indices
      // posicionales validos dentro de sus colecciones) en lugar de z
      // negativos que rompen el reordenado de Cesium.
      if (this.zindex_ != null) return this.zindex_;
      let maxChild = -1;
      this.layers.slice().forEach((c) => {
        try {
          if (!c || typeof c.getZIndex !== 'function') return;
          const z = c.getZIndex();
          if (z != null && Number(z) > maxChild) maxChild = Number(z);
        } catch (e) { /* defensivo */ }
      });
      if (maxChild >= 0) return maxChild + 1;
      return this.zindex_;
    },

    setZIndex(z) { this.zindex_ = z; return z; },

    // Sombra de "olLayer" para el selector de capas: ext_layerSwitcher lee
    // el techo de un grupo desde impl.olLayer.getZIndex() (o lo escribe con
    // impl.olLayer.setZIndex()). Sin esta sombra el selector ve techo=0 y
    // reparte z negativos a las hijas del grupo.
    get olLayer() {
      const self = this;
      return {
        getZIndex: function () { return self.getZIndex(); },
        setZIndex: function (z) { return self.setZIndex(z); },
        // getLayers/contains NO: ext_layerSwitcher solo usa getZIndex/setZIndex
        // del olLayer (los demas accesos estan guardados por tipo de capa).
      };
    },

    getMinScale() { return 0; },
    setMinScale() { /* no-op */ },
    getMaxScale() { return 0; },
    setMaxScale() { /* no-op */ },
    setMinZoom() { /* no-op */ },
    setMaxZoom() { /* no-op */ },

    getLegendURL() { return this.legendURL_ || ''; },
    setLegendURL(url) { this.legendURL_ = url; },
    getNumZoomLevels() { return 0; },

    refresh() { /* no-op */ },
    destroy() { this.map_ = null; },

    equals(other) { return other === this; },
  };

  // ── Fachada propia de LayerGroup ─────────────────────────────────────────
  // Extiende la MISMA clase base que la fachada original (module 32157 del
  // bundle, la misma que extienden WMS/MBTiles/...): asi map.addLayers(grupo)
  // sigue validando `instanceof` contra esa base. Se construye por build porque
  // cada build de la API crea su propia jerarquia de clases.
  function buildLayerGroupClass(BaseLayer) {
    return class LayerGroup extends BaseLayer {
      constructor(userParameters = {}, options = {}, vendorOptions = {}) {
        // Paridad con la fachada original: el tipo es 'LayerGroup' y el name
        // interno (layer_<n>) se genera SIEMPRE aqui para que el idLayer
        // (derivado de tipo+nombre por la clase base) sea unico por grupo.
        const params = Object.assign({}, userParameters);
        params.type = 'LayerGroup';
        if (!params.name) {
          params.name = 'layer_' + (Math.floor(9000 * Math.random()) + 1000);
        }
        const impl = new CesiumLayerGroupImpl(params);
        super(params, impl);
        this.constructorParameters = {
          userParameters: userParameters,
          options: options,
          vendorOptions: vendorOptions,
        };
        this.layers = impl.layers;
        this.display = (params.display !== undefined) ? params.display : true;
        // Respaldo: el getter type() de la base devuelve _type y ninguna otra
        // clase de capa debe confundir a isGroupLayer del selector.
        this._type = 'LayerGroup';
      }

      setMap(map) {
        const impl = this.getImpl();
        const prevMap = (impl && typeof impl.getMap === 'function') ? impl.getMap() : null;
        super.setMap(map);
        if (impl && typeof impl.setMap === 'function') impl.setMap(map);
        if (prevMap) unregisterGroup(prevMap, this);
        if (map) registerGroup(map, this);
      }

      addLayers(...args) {
        const layers = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
        layers.forEach((child) => { this.getImpl().addLayer(child); });
        this.layers = this.getImpl().getLayers();
        return this;
      }

      removeLayers(...args) {
        const layers = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
        layers.forEach((child) => { this.getImpl().removeLayer(child); });
        this.layers = this.getImpl().getLayers();
        return this;
      }

      ungroup(...args) {
        const child = (args.length > 0) ? args[0] : null;
        const removeIt = args[1] === true;
        this.getImpl().ungroup(child, removeIt);
        this.layers = this.getImpl().getLayers();
        return this;
      }

      getLayers() {
        return this.getImpl().getLayers();
      }

      equals(other) {
        return !!(other && other instanceof LayerGroup &&
          other.name === this.name && other.idLayer === this.idLayer);
      }
    };
  }

  // ── Parche de la fachada del Mapa (solo cuando el impl activo es Cesium) ─
  // getLayers():  anade los grupos registrados del mapa al listado completo.
  //               (El impl Map de cesium ignora LayerGroup, asi que sin esto
  //               el selector de capas no veria los grupos para montar el
  //               arbol.)
  // removeLayers(): al borrar un grupo se da de baja del registro (y se
  //               desengancha del mapa); el borrado real de las hijas ya lo
  //               hace el selector de capas llamando a removeLayers por hija.
  function patchMapPrototype(proto) {
    if (!proto || proto.__layergroupCesiumPatched) return;
    proto.__layergroupCesiumPatched = true;

    const originalGetLayers = proto.getLayers;
    if (typeof originalGetLayers === 'function') {
      proto.getLayers = function (e) {
        const layers = originalGetLayers.apply(this, arguments);
        // Los grupos solo se anaden cuando se pide el listado completo.
        const emptyQuery = (e === undefined || e === null || (Array.isArray(e) && e.length === 0));
        if (!emptyQuery || !Array.isArray(layers)) return layers;
        const groups = groupsOf(this);
        if (groups.length === 0) return layers;
        const result = layers.slice();
        groups.forEach((g) => {
          if (g && result.indexOf(g) === -1) result.push(g);
        });
        return result;
      };
    }

    const originalRemoveLayers = proto.removeLayers;
    if (typeof originalRemoveLayers === 'function') {
      proto.removeLayers = function (layers) {
        const result = originalRemoveLayers.apply(this, arguments);
        try {
          const arr = (layers === undefined || layers === null)
            ? []
            : (Array.isArray(layers) ? layers : [layers]);
          arr.forEach((l) => {
            if (!isGroupLayer(l)) return;
            unregisterGroup(this, l);
            try { if (typeof l.setMap === 'function') l.setMap(null); } catch (e) { /* defensivo */ }
          });
        } catch (e) { /* defensivo */ }
        return result;
      };
    }
  }

  // ── Envoltorio de IDEE.map ───────────────────────────────────────────────
  // Parchea el prototipo de la fachada del Mapa justo cuando se crea la primera
  // instancia de la build activa (sin tocar la build de OL).
  function wrapMapFactory(IDEE) {
    const originalMap = IDEE.map;
    const wrapped = function (opts) {
      const map = originalMap(opts);
      try {
        if (map && typeof map.getLayers === 'function' && typeof map.removeLayers === 'function') {
          patchMapPrototype(Object.getPrototypeOf(map));
        }
      } catch (e) { /* defensivo */ }
      createdMaps.add(map);
      sweepLayerImpls(map);
      return map;
    };
    IDEE.map = wrapped;
    return wrapped;
  }

  // ── Aplicacion del parche (idempotente) ──────────────────────────────────
  function apiIDEE() {
    const IDEE = window.IDEE;
    if (IDEE && IDEE.impl && IDEE.layer && IDEE.map) return IDEE;
    return null;
  }

  function applyPatch() {
    const IDEE = apiIDEE();
    if (!IDEE) return false;
    // Solo cuando la implementacion activa es Cesium: la build de OL ya trae
    // grupos funcionales y no debe tocarse.
    if (!IDEE.impl.cesium || !IDEE.layer.WMS) return false;

    if (IDEE.layer.LayerGroup !== installedLayerGroupClass) {
      try {
        installedLayerGroupClass = buildLayerGroupClass(Object.getPrototypeOf(IDEE.layer.WMS));
        IDEE.layer.LayerGroup = installedLayerGroupClass;
      } catch (e) {
        console.warn('layergroup_cesium: no se pudo instalar la fachada LayerGroup', e);
        installedLayerGroupClass = null;
      }
    }

    if (IDEE.map !== wrappedMapFactory) {
      try {
        wrappedMapFactory = wrapMapFactory(IDEE);
      } catch (e) {
        console.warn('layergroup_cesium: no se pudo envolver IDEE.map', e);
        wrappedMapFactory = null;
      }
    }

    // Barrido de capas raiz: envuelve setZIndex de los impls anadidos al mapa
    // despues de su creacion (cambio de base, capas nuevas, ...).
    try {
      createdMaps.forEach((map) => sweepLayerImpls(map));
    } catch (e) { /* defensivo */ }

    return true;
  }

  // Arranque: parche inmediato (por si ya estamos en Cesium) + re-aplicacion
  // cada 10 ms (cada build de la API recrea window.IDEE al ejecutarse y el
  // polling de cambioImpl es de 100 ms, asi que el parche siempre llega antes
  // de que se re-ejecute mapa()).
  applyPatch();
  setInterval(applyPatch, 10);

  // Deteccion inmediata del cambio de build: miPlugin_cambioImpl reemplaza el
  // tag <script> de la build destino. Cuando ese script termina de ejecutarse,
  // window.IDEE YA es la build nueva (el eval termina antes del evento load),
  // asi que aplicar el parche ahi elimina la carrera con la re-ejecucion de
  // mapa() que hace el plugin justo despues (si el parche llega tarde, el
  // LayerGroup que usa mapa() es el stub vacio de la build de Cesium y
  // grupoEjemplo.addLayers() lanza un TypeError que aborta el resto de mapa()).
  if (document.addEventListener) {
    document.addEventListener('load', (e) => {
      try {
        const t = e.target;
        if (t && t.tagName === 'SCRIPT' && typeof t.src === 'string' &&
          /cesium[^/]*\.js/i.test(t.src)) {
          applyPatch();
        }
      } catch (err) { /* defensivo */ }
    }, true);
  }
})();