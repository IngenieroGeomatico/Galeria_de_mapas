/* =====================================================================
   IDEE.layer.join / M.layer.join (JoinLayer)
   ---------------------------------------------------------------------
   Capa y extensión universal para realizar uniones (Joins) entre
   CUALQUIER tipo de capa vectorial (WFS, OGC API Features, KML, GeoJSON,
   FlatGeobuf, GeoParquet, Shapefile, Vector, Alphanumeric/CSV, etc.)
   en la API-IDEE / API-CNIG.

   QUÉ HACE
   --------
   Combina los registros y geometrías de una Capa 1 (target/base) con los
   atributos de una Capa 2 (source/origen), soportando cualquier tipo de
   capa vectorial de la API y permitiendo dos modos de operación:
     1. Capa resultante independiente (instancia `JoinLayer` en el mapa).
     2. Enriquecimiento in-situ (`inplace: true` o `applyToTarget()`), que
        inyecta los atributos directamente en las features de la capa base
        existente para que su tabla de atributos, popups y estilos los
        adopten de inmediato.

   TIPOS DE JOIN SOPORTADOS
   ------------------------
   - 'left' (o 'left_outer', por defecto):
       Mantiene todos los elementos de la Capa 1. Si hay coincidencia en
       la Capa 2, incorpora sus atributos; si no, quedan a null.
   - 'inner':
       Mantiene únicamente los elementos de la Capa 1 que tengan una
       coincidencia en la Capa 2. Los no coincidentes se descartan.
   - 'right' (o 'right_outer'):
       Mantiene todos los registros de la Capa 2. Si coinciden con Capa 1,
       toman su geometría y atributos combinados; si no, se generan con
       los atributos de Capa 2 (y los de Capa 1 a null).
   - 'full' (o 'full_outer', 'outer'):
       Mantiene todos los elementos de ambas capas. Los coincidentes se
       combinan; los no coincidentes de Capa 1 o Capa 2 se preservan
       rellenando los atributos de la otra capa con null.
   - 'semi' (o 'left_semi', 'exists'):
       Filtro relacional: conserva solo las features de Capa 1 que
       existen en Capa 2, pero sin agregar los atributos de Capa 2.
   - 'anti' (o 'left_anti', 'not_exists'):
       Conserva únicamente las features de Capa 1 que NO existen en Capa 2.

   MODOS DE UNIÓN
   --------------
   - 'attribute' (por defecto):
       Unión relacional por claves de atributos (`key1` en Capa 1 y `key2`
       en Capa 2).
   - 'spatial':
       Unión espacial por relaciones geométricas ('intersects', 'contains',
       'within', 'touches', 'crosses', 'overlaps', 'nearest').
   - 'auto':
       Detecta automáticamente si usar clave o relación espacial.

   COMPATIBILIDAD
   --------------
   - Compatible con 2D (OpenLayers) y 3D (Cesium).
   - Compatible con todas las capas vectoriales: WFS, OGCAPIFeatures, KML,
     GeoJSON, FlatGeobuf, GeoParquet, Shapefile, Vector, Alphanumeric, etc.
   - Reactivo ante capas vectoriales que cargan datos de forma asíncrona
     o dinámica (WFS, BBoxFeatures, etc.).
   - Contrato de estado 2D/3D (`getState()` / `setState(state, map)`).
   ===================================================================== */

(function () {
  'use strict';

  var VERSION = '1.0.0';

  /** Devuelve el global de la API (M o IDEE). */
  function api() {
    return window.IDEE || window.M || null;
  }

  /** Normaliza strings para comparación de claves de unión. */
  function normalizarClave(val, caseSensitive) {
    if (val === null || val === undefined) return '';
    var str = String(val).trim();
    return caseSensitive ? str : str.toLowerCase();
  }

  /** Clona profundamente un objeto JSON simple. */
  function clonarSimple(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      var arr = [];
      for (var i = 0; i < obj.length; i++) arr.push(clonarSimple(obj[i]));
      return arr;
    }
    var res = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        res[k] = clonarSimple(obj[k]);
      }
    }
    return res;
  }

  /** Bounding box [minX, minY, maxX, maxY] de una geometría GeoJSON. */
  function calcularBBoxGeometria(geom) {
    if (!geom || !geom.coordinates) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function recorrer(coords) {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        var x = coords[0], y = coords[1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        return;
      }
      for (var i = 0; i < coords.length; i++) recorrer(coords[i]);
    }
    recorrer(geom.coordinates);
    if (minX === Infinity) return null;
    return [minX, minY, maxX, maxY];
  }

  /** Comprueba si dos BBoxes se intersecan. */
  function bboxesSeTocan(b1, b2) {
    if (!b1 || !b2) return false;
    return !(b1[2] < b2[0] || b1[0] > b2[2] || b1[3] < b2[1] || b1[1] > b2[3]);
  }

  /** Centroide aproximado de un BBox [x, y]. */
  function centroideBBox(bbox) {
    if (!bbox) return [0, 0];
    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  }

  /** Distancia euclídea entre dos puntos [x, y]. */
  function distanciaPuntos(p1, p2) {
    var dx = p1[0] - p2[0];
    var dy = p1[1] - p2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Comprueba si un punto [x, y] está dentro de un anillo de polígono (Ray Casting). */
  function puntoEnAnillo(pt, ring) {
    var inside = false;
    var x = pt[0], y = pt[1];
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1];
      var xj = ring[j][0], yj = ring[j][1];
      var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** Predicado geométrico para GeoJSONs en navegador. */
  function evaluarPredicadoEspacial(geom1, geom2, predicado, maxDistance) {
    if (!geom1 || !geom2) return false;
    var b1 = calcularBBoxGeometria(geom1);
    var b2 = calcularBBoxGeometria(geom2);
    if (!b1 || !b2) return false;

    var pred = (predicado || 'intersects').toLowerCase();

    if (pred === 'nearest' || pred === 'distance') {
      var c1 = centroideBBox(b1);
      var c2 = centroideBBox(b2);
      var dist = distanciaPuntos(c1, c2);
      if (maxDistance !== undefined && maxDistance !== null && maxDistance >= 0) {
        return dist <= maxDistance;
      }
      return true;
    }

    if (!bboxesSeTocan(b1, b2)) return false;

    if (geom1.type === 'Point' && geom2.type === 'Point') {
      return geom1.coordinates[0] === geom2.coordinates[0] && geom1.coordinates[1] === geom2.coordinates[1];
    }

    if (geom1.type === 'Polygon' && geom2.type === 'Point') {
      var inRing = puntoEnAnillo(geom2.coordinates, geom1.coordinates[0]);
      if (pred === 'contains' || pred === 'intersects') return inRing;
      if (pred === 'within') return false;
    }
    if (geom1.type === 'Point' && geom2.type === 'Polygon') {
      var inRing2 = puntoEnAnillo(geom1.coordinates, geom2.coordinates[0]);
      if (pred === 'within' || pred === 'intersects') return inRing2;
      if (pred === 'contains') return false;
    }

    return bboxesSeTocan(b1, b2);
  }

  /** Extrae de forma universal las features crudas de cualquier capa vectorial. */
  function obtenerFeaturesCrudasDeCapa(capa) {
    if (!capa) return [];
    var features = [];

    // 1) Desde OpenLayers VectorSource
    try {
      var impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
      var olLayer = (impl && impl.olLayer) ? impl.olLayer : (capa.olLayer || impl);
      if (olLayer && typeof olLayer.getSource === 'function' && olLayer.getSource()) {
        var src = olLayer.getSource();
        if (typeof src.getFeatures === 'function') {
          features = src.getFeatures() || [];
        }
      }
    } catch (e) { features = []; }

    // 2) Desde la fachada de la API (getFeatures())
    if (!features.length) {
      try {
        if (typeof capa.getFeatures === 'function') features = capa.getFeatures() || [];
        else if (capa.getImpl && typeof capa.getImpl().getFeatures === 'function') features = capa.getImpl().getFeatures() || [];
      } catch (e) { features = []; }
    }

    // 3) Desde Cesium DataSource (3D)
    if (!features.length) {
      try {
        var impl3D = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
        var ds = (impl3D && impl3D.dataSource) ? impl3D.dataSource : null;
        if (ds && ds.entities && ds.entities.values) {
          features = ds.entities.values || [];
        }
      } catch (e) { /* noop */ }
    }

    return features;
  }

  /** Extrae de forma normalizada las propiedades y geometría de una feature nativa (OL, Cesium, IDEE). */
  function normalizarFeatureNativa(f, idx) {
    if (!f) return null;

    var props = {};
    try {
      if (typeof f.getProperties === 'function') {
        props = f.getProperties() || {};
      } else if (typeof f.getAttributes === 'function') {
        props = f.getAttributes() || {};
      } else if (f.properties) {
        props = f.properties;
      } else if (f.attributes) {
        props = f.attributes;
      }
    } catch (e) { props = {}; }

    // Limpiar propiedades internas de OpenLayers (como 'geometry')
    var cleanProps = {};
    for (var k in props) {
      if (k === 'geometry' || (typeof k === 'string' && k.charAt(0) === '_')) continue;
      cleanProps[k] = props[k];
    }

    var geom = null;
    try {
      if (typeof f.getGeometry === 'function') {
        var g = f.getGeometry();
        if (g && typeof g.getCoordinates === 'function' && typeof g.getType === 'function') {
          geom = { type: g.getType(), coordinates: g.getCoordinates() };
        }
      } else if (f.geometry) {
        geom = f.geometry;
      }
    } catch (e) { geom = null; }

    var id = '';
    try {
      id = (typeof f.getId === 'function') ? f.getId() : (f.id || ('f_' + idx));
    } catch (e) { id = 'f_' + idx; }

    return {
      rawFeature: f,
      id: id,
      properties: cleanProps,
      geometry: geom
    };
  }

  /**
   * Extrae la lista de features normalizadas de cualquier fuente:
   * (WFS, OGC API Features, KML, GeoJSON, FlatGeobuf, Alphanumeric, URL, etc.).
   */
  function extraerElementosDeFuente(fuente, mapRef) {
    if (!fuente) return Promise.resolve([]);

    // 1. Si es string con URL (WFS GetFeature, GeoJSON, JSON, CSV)
    if (typeof fuente === 'string' && (/^https?:\/\//i.test(fuente) || /\.(json|geojson|csv|tsv)$/i.test(fuente) || /service=wfs/i.test(fuente))) {
      return fetch(fuente)
        .then(function (res) {
          if (!res.ok) throw new Error('Error HTTP ' + res.status + ' al pedir ' + fuente);
          var ct = res.headers.get('content-type') || '';
          if (ct.includes('json') || /\.(json|geojson)$/i.test(fuente)) return res.json();
          return res.text();
        })
        .then(function (data) {
          return extraerElementosDeFuente(data, mapRef);
        })
        .catch(function (err) {
          console.warn('JoinLayer: fallo al cargar URL:', err);
          return [];
        });
    }

    // 2. Si es string con identificador de capa en el mapa (ID, legend o name)
    if (typeof fuente === 'string' && mapRef) {
      var capa = resolverCapaEnMapa(mapRef, fuente);
      if (capa) return extraerElementosDeFuente(capa, mapRef);
    }

    // 3. Si es un Array de objetos o features
    if (Array.isArray(fuente)) {
      var arrElementos = fuente.map(function (item, idx) {
        if (!item || typeof item !== 'object') return null;
        if (item.type === 'Feature' || item.geometry || item.properties) {
          return {
            rawFeature: item,
            id: item.id !== undefined ? item.id : ('item_' + idx),
            properties: clonarSimple(item.properties || {}),
            geometry: item.geometry || null
          };
        }
        return {
          rawFeature: item,
          id: item.id !== undefined ? item.id : ('row_' + idx),
          properties: clonarSimple(item),
          geometry: null
        };
      }).filter(Boolean);
      return Promise.resolve(arrElementos);
    }

    // 4. Si es un GeoJSON FeatureCollection
    if (fuente && fuente.type === 'FeatureCollection' && Array.isArray(fuente.features)) {
      return Promise.resolve(fuente.features.map(function (f, idx) {
        return {
          rawFeature: f,
          id: f.id !== undefined ? f.id : ('fc_' + idx),
          properties: clonarSimple(f.properties || {}),
          geometry: f.geometry || null
        };
      }));
    }

    // 5. Si es una capa alfanumérica (IDEE.layer.Alphanumeric / BigQuery)
    if (fuente && typeof fuente.getRecords === 'function') {
      var recs = fuente.getRecords() || [];
      var elementosAlfanumericos = recs.map(function (r, idx) {
        return {
          rawFeature: r,
          id: r.id !== undefined ? r.id : ('rec_' + idx),
          properties: clonarSimple(r),
          geometry: (fuente.hasGeometry && fuente.hasGeometry()) ? (fuente.getRecordGeometry ? fuente.getRecordGeometry(idx) : null) : null
        };
      });
      return Promise.resolve(elementosAlfanumericos);
    }

    // 6. Si es una capa vectorial cualquiera de la API (WFS, OGCAPI, KML, GeoJSON, Vector, FlatGeobuf, etc.)
    if (fuente && (typeof fuente.getFeatures === 'function' || typeof fuente.getImpl === 'function' || typeof fuente.getSource === 'function' || typeof fuente.getOL3Layer === 'function')) {
      var feats = obtenerFeaturesCrudasDeCapa(fuente);
      var elementos = [];
      for (var i = 0; i < feats.length; i++) {
        var norm = normalizarFeatureNativa(feats[i], i);
        if (norm) elementos.push(norm);
      }
      return Promise.resolve(elementos);
    }

    return Promise.resolve([]);
  }

  /** Busca una capa en el mapa por idLayer, legend o name (recursivo en grupos). */
  function resolverCapaEnMapa(mapa, idOrName) {
    if (!mapa || typeof mapa.getLayers !== 'function' || !idOrName) return null;
    try {
      var layers = mapa.getLayers() || [];
      var stack = layers.slice();
      while (stack.length > 0) {
        var l = stack.pop();
        if (!l) continue;
        if (String(l.idLayer) === String(idOrName) ||
            String(l.legend) === String(idOrName) ||
            String(l.name) === String(idOrName)) {
          return l;
        }
        if (l.type === 'LayerGroup' || typeof l.getLayers === 'function') {
          var hijos = l.getLayers() || [];
          for (var i = 0; i < hijos.length; i++) stack.push(hijos[i]);
        }
      }
    } catch (e) { /* silencioso */ }
    return null;
  }

  /** Aplica funciones de agregación sobre un conjunto de valores. */
  function calcularAgregacion(valores, operacion) {
    if (!valores || !valores.length) return null;
    var op = (operacion || 'first').toLowerCase();
    if (op === 'count') return valores.length;
    if (op === 'first') return valores[0];
    if (op === 'last') return valores[valores.length - 1];
    if (op === 'list' || op === 'concat') return valores.join(', ');

    var nums = valores.map(function (v) { return Number(v); }).filter(function (n) { return !Number.isNaN(n); });
    if (!nums.length) return null;

    if (op === 'sum') {
      var s = 0;
      for (var i = 0; i < nums.length; i++) s += nums[i];
      return s;
    }
    if (op === 'avg' || op === 'mean') {
      var sum = 0;
      for (var j = 0; j < nums.length; j++) sum += nums[j];
      return sum / nums.length;
    }
    if (op === 'min') return Math.min.apply(null, nums);
    if (op === 'max') return Math.max.apply(null, nums);

    return valores[0];
  }

  /* ------------------------------------------------------------------ */
  /* Clase Principal JoinLayer                                          */
  /* ------------------------------------------------------------------ */

  var claseJoin = null;
  var baseGeoJSON = null;

  function crearClase(IDEE) {
    var BaseLayer = (IDEE.layer && (IDEE.layer.Vector || IDEE.layer.GeoJSON)) || Object;

    const JoinLayer = class extends BaseLayer {
      /**
       * Constructor de la capa JoinLayer.
       * @param {Object} options Opciones del join y de la capa.
       * @param {Object} [layerOptions] Opciones adicionales de estilo/capa.
       */
      constructor(options, layerOptions) {
        var opts = Object.assign({}, options || {}, layerOptions || {});
        var name = opts.name || opts.legend || 'Join_Layer';
        var legend = opts.legend || opts.name || 'Unión de Capas';

        // Tipo de Join: 'left' | 'inner' | 'right' | 'full' | 'semi' | 'anti'
        var joinType = (opts.type || opts.joinType || 'left').toLowerCase();
        if (joinType === 'left_outer' || joinType === 'leftouter') joinType = 'left';
        if (joinType === 'right_outer' || joinType === 'rightouter') joinType = 'right';
        if (joinType === 'full_outer' || joinType === 'fullouter' || joinType === 'outer') joinType = 'full';
        if (joinType === 'left_semi' || joinType === 'exists') joinType = 'semi';
        if (joinType === 'left_anti' || joinType === 'not_exists') joinType = 'anti';

        // Parámetros limpios para la capa base nativa de la API
        var baseParams = Object.assign({}, opts);
        var CLAVES_JOIN = [
          'type', 'joinType', 'layer1', 'layer2', 'target', 'source', 'targetLayer',
          'sourceLayer', 'joinLayer', 'key1', 'key2', 'field1', 'field2', 'targetField',
          'sourceField', 'spatial', 'spatialPredicate', 'distance', 'maxDistance', 'mode',
          'fields', 'fields2', 'columns', 'exclude', 'exclude2', 'prefix', 'prefix2',
          'overwrite', 'nullValue', 'caseSensitive', 'cardinality', 'cardinalidad',
          'aggregations', 'agregaciones', 'inplace', 'inPlace', 'mutateTarget'
        ];
        for (var i = 0; i < CLAVES_JOIN.length; i++) delete baseParams[CLAVES_JOIN[i]];

        baseParams.name = name;
        baseParams.legend = legend;
        if (!baseParams.source) {
          baseParams.source = { type: 'FeatureCollection', features: [] };
        }

        super(baseParams, layerOptions || {});

        this.name = name;
        this.legend = legend;
        this._isJoinLayer = true;
        this._joinType = joinType;

        // Capas de entrada
        this._layer1 = opts.layer1 || opts.targetLayer || opts.target || null;
        this._layer2 = opts.layer2 || opts.sourceLayer || opts.joinLayer || opts.source || null;

        // Campos clave
        this._key1 = opts.key1 || opts.field1 || opts.targetField || null;
        this._key2 = opts.key2 || opts.field2 || opts.sourceField || this._key1 || null;

        // Modo de Join: 'attribute' | 'spatial' | 'auto'
        this._mode = (opts.mode || (opts.spatial ? 'spatial' : 'attribute')).toLowerCase();
        this._spatialPredicate = opts.spatialPredicate || (typeof opts.spatial === 'string' ? opts.spatial : 'intersects');
        this._maxDistance = (opts.maxDistance !== undefined) ? Number(opts.maxDistance) : ((opts.distance !== undefined) ? Number(opts.distance) : null);

        // Columnas, prefijos y aliases
        this._prefix = (opts.prefix !== undefined) ? String(opts.prefix) : ((opts.prefix2 !== undefined) ? String(opts.prefix2) : '');
        this._fields = opts.fields || opts.fields2 || opts.columns || null;
        this._exclude = Array.isArray(opts.exclude || opts.exclude2) ? (opts.exclude || opts.exclude2) : [];
        this._overwrite = Boolean(opts.overwrite);
        this._nullValue = (opts.nullValue !== undefined) ? opts.nullValue : null;
        this._caseSensitive = Boolean(opts.caseSensitive);

        // Cardinalidad y agregación
        this._cardinality = (opts.cardinality || opts.cardinalidad || 'one-to-one').toLowerCase();
        this._aggregations = opts.aggregations || opts.agregaciones || null;

        // Modo in-situ (modificar directamente las features de Capa 1)
        this._inplace = Boolean(opts.inplace || opts.inPlace || opts.mutateTarget);

        // Estado del cálculo
        this._stats = {
          type: this._joinType,
          mode: this._mode,
          layer1Count: 0,
          layer2Count: 0,
          matchedCount: 0,
          unmatched1Count: 0,
          unmatched2Count: 0,
          resultCount: 0,
          executionTimeMs: 0
        };

        this._unmatched1 = [];
        this._unmatched2 = [];
        this._joinedFeatures = [];
        this._iniciado = false;
        this._mapa = null;
        this._targetBackup = new WeakMap();

        if (this._layer1 && this._layer2) {
          this.recalculate();
        }
      }

      /**
       * Se ejecuta al añadir la capa al mapa (o mediante plugin).
       * @param {Object} map Instancia del mapa API-IDEE.
       */
      addTo(map) {
        this._mapa = map;
        if (super.addTo) {
          try { super.addTo(map); } catch (e) { /* noop */ }
        }
        this._conectarEventosMapa(map);
        this.recalculate();
      }

      /** Escucha la carga asíncrona de capas vectoriales (WFS, BBoxFeatures, etc.). */
      _conectarEventosMapa(map) {
        if (!map || this._eventosConectados) return;
        this._eventosConectados = true;
        var self = this;

        // Escuchar capas añadidas al mapa
        if (typeof map.on === 'function') {
          map.on('addLayer', function () {
            self.recalculate();
          });
        }

        // Si la capa 1 es una capa vectorial con fuente OL, escuchar eventos de carga
        this._engancharEventosCapaVectorial(this._resolverCapa(this._layer1));
      }

      _engancharEventosCapaVectorial(capa) {
        if (!capa || capa._joinListenerHooked) return;
        capa._joinListenerHooked = true;
        var self = this;

        try {
          var impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
          var olLayer = (impl && impl.olLayer) ? impl.olLayer : (capa.olLayer || impl);
          if (olLayer && typeof olLayer.getSource === 'function' && olLayer.getSource()) {
            var src = olLayer.getSource();
            if (typeof src.on === 'function') {
              src.on('featuresloadend', function () { self.recalculate(); });
              src.on('change', function () {
                if (src.getState && src.getState() === 'ready') self.recalculate();
              });
            }
          }
        } catch (e) { /* noop */ }
      }

      _resolverCapa(capaOrId) {
        if (typeof capaOrId === 'string' && this._mapa) {
          return resolverCapaEnMapa(this._mapa, capaOrId);
        }
        return capaOrId;
      }

      /**
       * Recalcula la unión de las dos capas a partir de las fuentes configuradas.
       * @returns {Promise<Array<Object>>} Features resultantes del join.
       */
      async recalculate() {
        var t0 = Date.now();
        var mapRef = this._mapa || (this.map_ || null);

        var capa1Obj = this._resolverCapa(this._layer1);
        var capa2Obj = this._resolverCapa(this._layer2);

        this._engancharEventosCapaVectorial(capa1Obj);
        this._engancharEventosCapaVectorial(capa2Obj);

        var [elem1, elem2] = await Promise.all([
          extraerElementosDeFuente(capa1Obj || this._layer1, mapRef),
          extraerElementosDeFuente(capa2Obj || this._layer2, mapRef)
        ]);

        var count1 = elem1.length;
        var count2 = elem2.length;
        var matchedCount = 0;
        var unmatched1 = [];
        var unmatched2 = [];
        var matchedIndices2 = new Set();
        var resultado = [];

        var joinType = this._joinType;
        var isSpatial = (this._mode === 'spatial') || (this._mode === 'auto' && !this._key1 && !this._key2);

        // Preparamos índice de atributos para Capa 2 si es unión por clave
        var index2 = new Map();
        if (!isSpatial && this._key2) {
          for (var i2 = 0; i2 < elem2.length; i2++) {
            var item2 = elem2[i2];
            var val2 = item2.properties ? item2.properties[this._key2] : undefined;
            var k2 = normalizarClave(val2, this._caseSensitive);
            if (k2 !== '') {
              if (!index2.has(k2)) index2.set(k2, []);
              index2.get(k2).push({ index: i2, item: item2 });
            }
          }
        }

        // --- 1. PROCESAR ELEMENTOS DE CAPA 1 ---
        for (var i1 = 0; i1 < elem1.length; i1++) {
          var f1 = elem1[i1];
          var props1 = f1.properties || {};
          var geom1 = f1.geometry || null;
          var matches2 = [];

          if (isSpatial) {
            for (var s2 = 0; s2 < elem2.length; s2++) {
              var f2_sp = elem2[s2];
              if (evaluarPredicadoEspacial(geom1, f2_sp.geometry, this._spatialPredicate, this._maxDistance)) {
                matches2.push({ index: s2, item: f2_sp });
              }
            }
          } else {
            var k1 = normalizarClave(props1[this._key1], this._caseSensitive);
            if (k1 !== '' && index2.has(k1)) {
              matches2 = index2.get(k1);
            }
          }

          if (matches2.length > 0) {
            matchedCount++;
            for (var m = 0; m < matches2.length; m++) {
              matchedIndices2.add(matches2[m].index);
            }

            if (joinType === 'anti') continue;

            if (joinType === 'semi') {
              resultado.push({
                rawFeature: f1.rawFeature,
                type: 'Feature',
                id: f1.id || ('join_' + resultado.length),
                properties: clonarSimple(props1),
                geometry: geom1
              });
              continue;
            }

            if (this._cardinality === 'one-to-many' && matches2.length > 1) {
              for (var om = 0; om < matches2.length; om++) {
                var propsJoinedOM = this._combinarPropiedades(props1, matches2[om].item.properties);
                resultado.push({
                  rawFeature: f1.rawFeature,
                  type: 'Feature',
                  id: (f1.id || ('feat_' + i1)) + '_' + om,
                  properties: propsJoinedOM,
                  geometry: geom1
                });
              }
            } else if (this._cardinality === 'aggregate' && this._aggregations) {
              var propsAgg = this._combinarPropiedadesAgregadas(props1, matches2.map(function (x) { return x.item.properties; }));
              resultado.push({
                rawFeature: f1.rawFeature,
                type: 'Feature',
                id: f1.id || ('join_' + resultado.length),
                properties: propsAgg,
                geometry: geom1
              });
            } else {
              var matchElegido = (this._cardinality === 'last') ? matches2[matches2.length - 1].item : matches2[0].item;
              var propsJoined = this._combinarPropiedades(props1, matchElegido.properties);
              resultado.push({
                rawFeature: f1.rawFeature,
                type: 'Feature',
                id: f1.id || ('join_' + resultado.length),
                properties: propsJoined,
                geometry: geom1
              });
            }
          } else {
            unmatched1.push(f1);

            if (joinType === 'left' || joinType === 'full' || joinType === 'anti') {
              var propsSolo1 = this._rellenarPropiedadesNulas(props1, elem2[0] ? elem2[0].properties : {});
              resultado.push({
                rawFeature: f1.rawFeature,
                type: 'Feature',
                id: f1.id || ('join_' + resultado.length),
                properties: propsSolo1,
                geometry: geom1
              });
            }
          }
        }

        // --- 2. PROCESAR ELEMENTOS DE CAPA 2 NO COINCIDENTES (Para 'right' y 'full') ---
        for (var j2 = 0; j2 < elem2.length; j2++) {
          if (!matchedIndices2.has(j2)) {
            var f2_unmatched = elem2[j2];
            unmatched2.push(f2_unmatched);

            if (joinType === 'right' || joinType === 'full') {
              var propsSolo2 = this._rellenarPropiedadesDesdeCapa2(elem1[0] ? elem1[0].properties : {}, f2_unmatched.properties);
              resultado.push({
                rawFeature: f2_unmatched.rawFeature,
                type: 'Feature',
                id: f2_unmatched.id || ('join_right_' + j2),
                properties: propsSolo2,
                geometry: f2_unmatched.geometry || null
              });
            }
          }
        }

        this._stats = {
          type: this._joinType,
          mode: this._mode,
          layer1Count: count1,
          layer2Count: count2,
          matchedCount: matchedCount,
          unmatched1Count: unmatched1.length,
          unmatched2Count: unmatched2.length,
          resultCount: resultado.length,
          executionTimeMs: Date.now() - t0
        };

        this._unmatched1 = unmatched1;
        this._unmatched2 = unmatched2;
        this._joinedFeatures = resultado;
        this._iniciado = true;

        // Si se pide modo in-situ, aplicar directamente a las features de Capa 1
        if (this._inplace && capa1Obj) {
          this.applyToTarget();
        }

        // Aplicar a la capa resultante independiente
        this._aplicarFeaturesAlMapa(resultado);

        return resultado;
      }

      /**
       * Inyecta los atributos combinados directamente en las features de la Capa 1 original
       * (válido para WFS, OGCAPI, KML, GeoJSON, Vector, etc.).
       */
      applyToTarget() {
        var capa1Obj = this._resolverCapa(this._layer1);
        if (!capa1Obj || !this._joinedFeatures.length) return false;

        for (var i = 0; i < this._joinedFeatures.length; i++) {
          var item = this._joinedFeatures[i];
          var raw = item.rawFeature;
          if (!raw) continue;

          var props = item.properties || {};

          // OpenLayers feature
          if (typeof raw.setProperties === 'function') {
            try { raw.setProperties(props); } catch (e) { /* noop */ }
          } else if (typeof raw.set === 'function') {
            for (var k in props) {
              try { raw.set(k, props[k]); } catch (e) { /* noop */ }
            }
          }

          // API-IDEE feature
          if (raw.attributes && typeof raw.attributes === 'object') {
            Object.assign(raw.attributes, props);
          }
          if (raw.properties && typeof raw.properties === 'object') {
            Object.assign(raw.properties, props);
          }
        }
        return true;
      }

      /** Combina propiedades de Capa 1 y Capa 2 aplicando prefijos, filtros y exclusiones. */
      _combinarPropiedades(props1, props2) {
        var res = clonarSimple(props1 || {});
        var p2 = props2 || {};
        var prefijo = this._prefix;

        for (var k in p2) {
          if (!Object.prototype.hasOwnProperty.call(p2, k)) continue;
          if (this._exclude.includes(k)) continue;
          if (this._fields && !this._campoPermitido(k)) continue;

          var nombreDestino = this._obtenerNombreColumnaDestino(k, prefijo);

          if (res[nombreDestino] !== undefined && !this._overwrite && !prefijo) {
            nombreDestino = nombreDestino + '_2';
          }
          res[nombreDestino] = p2[k];
        }
        return res;
      }

      _campoPermitido(campo) {
        if (!this._fields) return true;
        if (Array.isArray(this._fields)) return this._fields.includes(campo);
        if (typeof this._fields === 'object') return Object.prototype.hasOwnProperty.call(this._fields, campo);
        return true;
      }

      _obtenerNombreColumnaDestino(campo, prefijo) {
        if (this._fields && typeof this._fields === 'object' && !Array.isArray(this._fields)) {
          if (this._fields[campo]) return this._fields[campo];
        }
        return (prefijo || '') + campo;
      }

      _combinarPropiedadesAgregadas(props1, listaProps2) {
        var res = clonarSimple(props1 || {});
        var aggs = this._aggregations || {};
        var prefijo = this._prefix;

        for (var col in aggs) {
          if (!Object.prototype.hasOwnProperty.call(aggs, col)) continue;
          var op = aggs[col];
          var valores = [];
          for (var i = 0; i < listaProps2.length; i++) {
            if (listaProps2[i][col] !== undefined) valores.push(listaProps2[i][col]);
          }
          var nombreDest = this._obtenerNombreColumnaDestino(col, prefijo);
          res[nombreDest] = calcularAgregacion(valores, op);
        }
        return res;
      }

      _rellenarPropiedadesNulas(props1, muestraProps2) {
        var res = clonarSimple(props1 || {});
        var p2 = muestraProps2 || {};
        var prefijo = this._prefix;

        for (var k in p2) {
          if (!Object.prototype.hasOwnProperty.call(p2, k)) continue;
          if (this._exclude.includes(k)) continue;
          if (this._fields && !this._campoPermitido(k)) continue;
          var nombreDestino = this._obtenerNombreColumnaDestino(k, prefijo);
          if (res[nombreDestino] === undefined) {
            res[nombreDestino] = this._nullValue;
          }
        }
        return res;
      }

      _rellenarPropiedadesDesdeCapa2(muestraProps1, props2) {
        var res = {};
        var p1 = muestraProps1 || {};
        var p2 = props2 || {};
        var prefijo = this._prefix;

        for (var k1 in p1) {
          if (Object.prototype.hasOwnProperty.call(p1, k1)) {
            res[k1] = this._nullValue;
          }
        }
        for (var k2 in p2) {
          if (!Object.prototype.hasOwnProperty.call(p2, k2)) continue;
          if (this._exclude.includes(k2)) continue;
          if (this._fields && !this._campoPermitido(k2)) continue;
          var nombreDestino = this._obtenerNombreColumnaDestino(k2, prefijo);
          res[nombreDestino] = p2[k2];
        }
        return res;
      }

      _aplicarFeaturesAlMapa(features) {
        var IDEE = api();
        if (!IDEE) return;

        try {
          if (typeof this.clear === 'function') this.clear();
          else if (typeof this.removeFeatures === 'function' && typeof this.getFeatures === 'function') {
            var existentes = this.getFeatures() || [];
            if (existentes.length) this.removeFeatures(existentes);
          }
        } catch (e) { /* noop */ }

        try {
          var fc = { type: 'FeatureCollection', features: features };
          if (typeof this.addFeatures === 'function') {
            var featObjects = features.map(function (f, idx) {
              return new IDEE.Feature(f.id || ('feat_' + idx), f);
            });
            this.addFeatures(featObjects);
          } else if (this.options && this.options.source) {
            this.options.source = fc;
          }
        } catch (e) {
          try {
            if (typeof this.setData === 'function') this.setData(fc);
          } catch (ex) { /* noop */ }
        }
      }

      /* ---------------- Métodos públicos ---------------- */

      getJoinStats() {
        return Object.assign({}, this._stats);
      }

      getJoinOptions() {
        return {
          layer1: this._layer1,
          layer2: this._layer2,
          key1: this._key1,
          key2: this._key2,
          type: this._joinType,
          mode: this._mode,
          spatialPredicate: this._spatialPredicate,
          maxDistance: this._maxDistance,
          prefix: this._prefix,
          fields: this._fields,
          exclude: this._exclude,
          overwrite: this._overwrite,
          cardinality: this._cardinality,
          aggregations: this._aggregations,
          inplace: this._inplace,
          nullValue: this._nullValue,
          caseSensitive: this._caseSensitive
        };
      }

      setJoinOptions(newOptions) {
        if (!newOptions || typeof newOptions !== 'object') return;
        if (newOptions.layer1 !== undefined) this._layer1 = newOptions.layer1;
        if (newOptions.layer2 !== undefined) this._layer2 = newOptions.layer2;
        if (newOptions.key1 !== undefined) this._key1 = newOptions.key1;
        if (newOptions.key2 !== undefined) this._key2 = newOptions.key2;
        if (newOptions.type !== undefined || newOptions.joinType !== undefined) {
          this._joinType = (newOptions.type || newOptions.joinType).toLowerCase();
        }
        if (newOptions.mode !== undefined) this._mode = newOptions.mode.toLowerCase();
        if (newOptions.spatialPredicate !== undefined) this._spatialPredicate = newOptions.spatialPredicate;
        if (newOptions.maxDistance !== undefined) this._maxDistance = Number(newOptions.maxDistance);
        if (newOptions.prefix !== undefined) this._prefix = String(newOptions.prefix);
        if (newOptions.fields !== undefined) this._fields = newOptions.fields;
        if (newOptions.exclude !== undefined) this._exclude = newOptions.exclude;
        if (newOptions.cardinality !== undefined) this._cardinality = newOptions.cardinality;
        if (newOptions.aggregations !== undefined) this._aggregations = newOptions.aggregations;
        if (newOptions.inplace !== undefined) this._inplace = Boolean(newOptions.inplace);
        if (newOptions.nullValue !== undefined) this._nullValue = newOptions.nullValue;
        if (newOptions.caseSensitive !== undefined) this._caseSensitive = Boolean(newOptions.caseSensitive);

        return this.recalculate();
      }

      getUnmatchedFeatures(layerIndex) {
        return (layerIndex === 2) ? this._unmatched2.slice() : this._unmatched1.slice();
      }

      toGeoJSON() {
        return {
          type: 'FeatureCollection',
          features: clonarSimple(this._joinedFeatures)
        };
      }

      getRecords() {
        return this._joinedFeatures.map(function (f) {
          return clonarSimple(f.properties || {});
        });
      }

      /* ---------------- Contrato de Estado (Cambio 2D / 3D) ---------------- */

      getState() {
        return {
          name: this.name,
          legend: this.legend,
          visible: (typeof this.isVisible === 'function') ? this.isVisible() : true,
          options: this.getJoinOptions()
        };
      }

      setState(state, map) {
        if (!state || typeof state !== 'object') return;
        if (state.options) {
          this.setJoinOptions(state.options);
        }
        if (map) this.addTo(map);
      }
    }

    /**
     * Utilidad estática para aplicar el join directamente in-situ sobre una capa vectorial existente.
     * @param {Object|string} targetLayer Capa vectorial base (WFS, OGCAPI, KML, GeoJSON, etc.).
     * @param {Object|string} sourceLayer Capa origen con los atributos a unir.
     * @param {Object} [joinOptions] Opciones del join (key1, key2, type, prefix, fields...).
     * @returns {Promise<JoinLayer>} Instancia JoinLayer creada.
     */
    JoinLayer.apply = function (targetLayer, sourceLayer, joinOptions) {
      var opts = Object.assign({}, joinOptions || {}, {
        layer1: targetLayer,
        layer2: sourceLayer,
        inplace: true
      });
      var join = new JoinLayer(opts);
      return join.recalculate().then(function () {
        return join;
      });
    };

    return JoinLayer;
  }

  /* ------------------------------------------------------------------ */
  /* Instalación en M / IDEE                                            */
  /* ------------------------------------------------------------------ */

  function instalar() {
    var IDEE = api();
    if (!IDEE || !IDEE.layer) return false;

    var baseActual = (IDEE.layer.GeoJSON || IDEE.layer.Vector || Object);
    if (claseJoin === null || baseGeoJSON !== baseActual) {
      claseJoin = crearClase(IDEE);
      baseGeoJSON = baseActual;
    }

    // Función factoría que permite invocar con o sin 'new'
    function FactoriaJoin(options, layerOptions) {
      return new claseJoin(options, layerOptions);
    }
    Object.setPrototypeOf(FactoriaJoin, claseJoin);
    FactoriaJoin.prototype = claseJoin.prototype;
    FactoriaJoin.apply = claseJoin.apply;

    // Instalación en IDEE.layer y M.layer
    IDEE.layer.Join = claseJoin;
    IDEE.layer.join = FactoriaJoin;

    if (window.IDEE && window.IDEE.layer) {
      window.IDEE.layer.Join = claseJoin;
      window.IDEE.layer.join = FactoriaJoin;
    }
    if (window.M && window.M.layer) {
      window.M.layer.Join = claseJoin;
      window.M.layer.join = FactoriaJoin;
    }

    // Instalación como plugin en IDEE.plugin y M.plugin
    if (!IDEE.plugin) IDEE.plugin = {};
    IDEE.plugin.miPlugin_joinLayer = claseJoin;
    if (window.M && window.M.plugin) window.M.plugin.miPlugin_joinLayer = claseJoin;

    // Global en window
    window.JoinLayer = claseJoin;
    window.miPlugin_joinLayer = claseJoin;

    return true;
  }

  instalar();
  var intentos = 0;
  var temporizador = setInterval(function () {
    if (instalar() || ++intentos > 200) clearInterval(temporizador);
  }, 10);

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      var obj = e && e.target;
      if (obj && obj.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(obj.src || '')) {
        instalar();
      }
    }, true);
  }
})();
