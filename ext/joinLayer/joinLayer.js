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
   - FlatGeobuf: se fuerza la carga completa del fichero (modo "todas") antes del
     join, de modo que se usan TODAS las features y no solo las del bbox visible
     (modo "vista" por defecto).
   - MVT: no existe un fichero unico que descargar; solo se usan las features de
     las teselas del viewport actual. En 3D (ext/MVTLayer) getFeatures() devuelve
     [] y el join no aporta datos. La geometria no se expone, asi que los joins
     espaciales no tienen correspondencias.
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
  async function extraerElementosDeFuente(fuente, mapRef) {
    if (!fuente) return [];

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

    // 5b. FlatGeobuf: forzar la carga COMPLETA del fichero (modo "todas") antes de
    // extraer, para que el join use TODAS las features y no solo las del bbox
    // visible (modo "vista" por defecto de la capa). `_recargar` devuelve promesa.
    var esFlatGeobuf = !!(fuente && (fuente._flatgeobuf === true ||
      String(fuente.type || fuente._type || '').toLowerCase() === 'flatgeobuf'));
    if (esFlatGeobuf) {
      if (typeof fuente._recargar === 'function') {
        try {
          await fuente._recargar('todas', mapRef, true);
        } catch (e) {
          console.warn('JoinLayer: no se pudo cargar el FlatGeobuf completo:', e);
        }
      } else {
        console.warn('JoinLayer: capa FlatGeobuf sin _recargar; se usan las features ya cargadas (posiblemente solo el viewport).');
      }
      // En 3D (Cesium) setSource() carga el DataSource de forma asincrona: se
      // espera a que getFeatures() devuelva datos antes de seguir.
      var esperaFgb = 0;
      while (esperaFgb < 8000) {
        var featsFgb = obtenerFeaturesCrudasDeCapa(fuente);
        if (featsFgb && featsFgb.length) break;
        await new Promise(function (res) { setTimeout(res, 250); });
        esperaFgb += 250;
      }
    }

    // 5c. MVT: las features solo existen dentro de las teselas del viewport y no
    // se exponen como features de la capa (ni en 2D ni en 3D). No hay un fichero
    // unico que descargar, asi que el join NO puede cargar "todo el fichero".
    // Se documenta la limitacion y se devuelve lo que haya (normalmente []).
    var esMVT = !!(fuente && String(fuente.type || fuente._type || '').toLowerCase() === 'mvt');
    if (!esMVT && fuente && fuente.getImpl) {
      try {
        var implMvt = fuente.getImpl();
        if (implMvt && implMvt.lector && typeof implMvt.lector.capas !== 'undefined') esMVT = true;
      } catch (e) { /* no es MVT */ }
    }
    if (esMVT) {
      console.warn('JoinLayer: las capas MVT solo exponen las features de las teselas del viewport actual (no existe un fichero unico que descargar); el join se limita a esas features. En 3D (ext/MVTLayer) getFeatures() devuelve [] y el join no aporta datos. La geometria no se expone, por lo que los joins espaciales no tendran correspondencias.');
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
    // La base es `GeoJSON` y no `Vector` a propósito: la capa resultante se
    // rellena con `setSource(featureCollection)`, que es el único camino que
    // pinta features en las dos implementaciones (medido: en `Vector`, el
    // `source` del constructor se ignora y `addFeatures` de la fachada no
    // puebla la fuente OpenLayers, así que no se dibuja nada). `GeoJSON`
    // reproyecta de EPSG:4326 a la proyección del mapa, que es lo que esperan
    // los atributos y las geometrías que salen de un join.
    var BaseLayer = (IDEE.layer && (IDEE.layer.GeoJSON || IDEE.layer.Vector)) || Object;

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

        // Una `source` que ya sea un FeatureCollection es el dato inicial de la
        // capa resultante; si no lo es, se interpreta como la capa 2 del join.
        var sourceEsColeccion = !!(opts.source && opts.source.type === 'FeatureCollection');
        var capa2 = opts.layer2 || opts.sourceLayer || opts.joinLayer ||
          (sourceEsColeccion ? null : opts.source) || null;

        // Parámetros limpios para la capa base nativa de la API.
        // Se quitan TODAS las claves propias del join para que `M.format.layer`
        // no confunda `type: 'left'` con el tipo de capa de la API.
        var baseParams = Object.assign({}, opts);
        var CLAVES_JOIN = [
          'type', 'joinType', 'layer1', 'layer2', 'target', 'targetLayer',
          'sourceLayer', 'joinLayer', 'key1', 'key2', 'field1', 'field2', 'targetField',
          'sourceField', 'spatial', 'spatialPredicate', 'distance', 'maxDistance', 'mode',
          'fields', 'fields2', 'columns', 'exclude', 'exclude2', 'prefix', 'prefix2',
          'overwrite', 'nullValue', 'caseSensitive', 'cardinality', 'cardinalidad',
          'aggregations', 'agregaciones', 'inplace', 'inPlace', 'mutateTarget'
        ];
        for (var i = 0; i < CLAVES_JOIN.length; i++) delete baseParams[CLAVES_JOIN[i]];

        baseParams.name = name;
        baseParams.legend = legend;
        if (!sourceEsColeccion) {
          baseParams.source = { type: 'FeatureCollection', features: [] };
        }

        super(baseParams, layerOptions || {});

        this.name = name;
        this.legend = legend;
        // NO se toca `this.type`: la API lo valida de forma diferida contra el
        // tipo real de la capa base (GeoJSON) y renombrarlo hace saltar
        // "El tipo de capa debe ser 'GeoJSON' pero se ha especificado ...".
        this._isJoinLayer = true;
        this._joinType = joinType;

        // Capas de entrada
        this._layer1 = opts.layer1 || opts.targetLayer || opts.target || null;
        this._layer2 = capa2;

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
        this._resultadoOriginal = null;
        this._iniciado = false;
        this._recalcTimer = null;
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
        var self = this;
        // `setSource` peta si se llama sincrónicamente en `addTo` (impl aún
        // no está listo: "Cannot read properties of null (reading 'write')").
        // Se difiere para que la fuente se pueble una vez el impl esté vivo.
        setTimeout(function () {
          if (self._resultadoOriginal && self._resultadoOriginal.length) {
            self._aplicarFeaturesAlMapa(self._resultadoOriginal);
          }
          self.recalculate();
        }, 0);
        return this;
      }

      /** Escucha la carga asíncrona de capas vectoriales (WFS, BBoxFeatures, etc.). */
      _conectarEventosMapa(map) {
        if (!map || this._eventosConectados) return;
        this._eventosConectados = true;
        var self = this;

        // Escuchar capas añadidas al mapa (con debounce para evitar recálculos
        // masivos en capas teeladas que emiten change en cada movimiento).
        if (typeof map.on === 'function') {
          map.on('addLayer', function () {
            self._programarRecalculo();
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
              src.on('featuresloadend', function () { self._programarRecalculo(); });
              src.on('change', function () {
                if (src.getState && src.getState() === 'ready') self._programarRecalculo();
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
      _programarRecalculo() {
        if (this._recalcTimer) { try { clearTimeout(this._recalcTimer); } catch (e) { /* noop */ } }
        var self = this;
        this._recalcTimer = setTimeout(function () {
          self._recalcTimer = null;
          try { self.recalculate(); } catch (e) { console.warn('joinLayer: recálculo programado falló', e); }
        }, 300);
      }

      async recalculate() {
        if (this._recalcTimer) { try { clearTimeout(this._recalcTimer); } catch (e) { /* noop */ } this._recalcTimer = null; }
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
          // MVT del bundle (y otras features con getAttributes()): inyectar en el
          // objeto de atributos devuelto por getAttributes().
          try {
            if (typeof raw.getAttributes === 'function') {
              var attrsMvt = raw.getAttributes();
              if (attrsMvt && typeof attrsMvt === 'object') Object.assign(attrsMvt, props);
            }
          } catch (e) { /* noop */ }
          try {
            if (typeof raw.setAttribute === 'function') {
              for (var kk in props) { try { raw.setAttribute(kk, props[kk]); } catch (e2) {} }
            }
          } catch (e) { /* noop */ }
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

      /**
       * Vuelca el resultado en la capa. `setSource` es el camino bueno (lo usa
       * ext/flatgeobufLayer con el mismo problema): rehace la fuente de la capa
       * y se ve al instante. Solo se puede llamar cuando la capa ya está en el
       * mapa, así que antes de eso el resultado se guarda para `addTo`.
       */
      _reproyectarGeomParaGeoJSON(geom, esOL) {
        if (!geom || !esOL) return geom;
        var IDEE = api();
        if (!IDEE || !IDEE.utils || typeof IDEE.utils.reproject !== 'function') return geom;
        var t = geom.type;
        var rep = function (p) {
          try {
            var c = IDEE.utils.reproject([p[0], p[1]], 'EPSG:3857', 'EPSG:4326');
            return [c[0], c[1]];
          } catch (e) { return [p[0], p[1]]; }
        };
        if (t === 'Point') {
          var c = rep(geom.coordinates);
          return { type: t, coordinates: [c[0], c[1]] };
        }
        if (t === 'MultiPoint' || t === 'LineString') {
          return { type: t, coordinates: (geom.coordinates || []).map(rep) };
        }
        if (t === 'MultiLineString' || t === 'Polygon') {
          return { type: t, coordinates: (geom.coordinates || []).map(function (ring) {
            return (ring || []).map(rep);
          }) };
        }
        if (t === 'MultiPolygon') {
          return { type: t, coordinates: (geom.coordinates || []).map(function (poly) {
            return (poly || []).map(function (ring) { return (ring || []).map(rep); });
          }) };
        }
        if (t === 'GeometryCollection') {
          return { type: t, geometries: (geom.geometries || []).map(function (g) {
            return this._reproyectarGeomParaGeoJSON(g, esOL);
          }, this) };
        }
        return geom;
      }

      _aplicarFeaturesAlMapa(features) {
        var impl = null;
        try { impl = (typeof this.getImpl === 'function') ? this.getImpl() : null; } catch (e) { impl = null; }
        // En 2D (OpenLayers) la geometría nativa viene en EPSG:3857 y la capa
        // GeoJSON espera EPSG:4326; en 3D (Cesium) ya viene en 4326.
        // Heurística robusta: si las coordenadas están fuera del rango lon/lat,
        // vienen en metros (EPSG:3857, típico de OpenLayers) y hay que
        // reproyectarlas a EPSG:4326 para la capa GeoJSON.
        var esOL = false;
        try {
          var c0 = (features && features[0] && features[0].geometry && features[0].geometry.coordinates) || null;
          var x0 = Array.isArray(c0) ? (Array.isArray(c0[0]) ? c0[0][0] : c0[0]) : null;
          if (typeof x0 === 'number' && (Math.abs(x0) > 180)) esOL = true;
        } catch (e) { esOL = false; }

        // Guardamos los originales para poder re-volcarlos desde `addTo` sin
        // re-proyectar dos veces.
        this._resultadoOriginal = (features || []).slice();

        var featuresGeoJSON = (features || []).map(function (f) {
          var copia = Object.assign({}, f);
          if (f.geometry) copia.geometry = this._reproyectarGeomParaGeoJSON(f.geometry, esOL);
          return copia;
        }, this);

        var fc = { type: 'FeatureCollection', features: featuresGeoJSON };

        // Sin impl completo (fuente OL viva) `setSource` peta. Se aplicará
        // desde `addTo`/`setTimeout`, donde el impl ya está listo.
        var fuenteOL = null;
        try { fuenteOL = impl && impl.olLayer ? impl.olLayer.getSource() : null; } catch (e) { fuenteOL = null; }
        if (!fuenteOL) return;

        try {
          if (typeof this.setSource === 'function') {
            this.setSource(fc);
            return;
          }
        } catch (e) {
          console.warn('joinLayer: no se pudo volcar el resultado con setSource', e);
        }

        try {
          if (typeof this.clear === 'function') this.clear();
        } catch (e2) { /* noop */ }
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
        // Se excluye `rawFeature` (puede ser un objeto nativo no clonable, con
        // referencias circulares, como las features MVT del bundle) para evitar
        // desbordamiento de pila en clonarSimple.
        var seguros = (this._joinedFeatures || []).map(function (f) {
          return {
            type: f.type || 'Feature',
            id: f.id,
            properties: clonarSimple(f.properties || {}),
            geometry: clonarSimple(f.geometry || null)
          };
        });
        return {
          type: 'FeatureCollection',
          features: seguros
        };
      }

      getRecords() {
        return this._joinedFeatures.map(function (f) {
          return clonarSimple(f.properties || {});
        });
      }

      /* ---------------- Contrato de Estado (Cambio 2D / 3D) ---------------- */

      _identificadorEstableCapa(capaOrId) {
        if (capaOrId === null || capaOrId === undefined) return null;
        if (typeof capaOrId === 'string') return capaOrId;
        if (typeof capaOrId === 'object') {
          try {
            if (capaOrId.legend && String(capaOrId.legend) !== String(capaOrId.idLayer)) return capaOrId.legend;
          } catch (e) { /* noop */ }
          try { if (capaOrId.name) return capaOrId.name; } catch (e) { /* noop */ }
          try { if (capaOrId.idLayer) return capaOrId.idLayer; } catch (e) { /* noop */ }
        }
        return null;
      }

      _resolverCapaEnMapaNuevo(map, capaOrId) {
        if (!capaOrId) return capaOrId;
        if (typeof capaOrId === 'string') {
          try {
            var res = resolverCapaEnMapa(map, capaOrId);
            if (res) return res;
          } catch (e) { /* noop */ }
          return capaOrId;
        }
        if (typeof capaOrId === 'object') {
          var ident = this._identificadorEstableCapa(capaOrId);
          if (ident) {
            try {
              var res2 = resolverCapaEnMapa(map, ident);
              if (res2) return res2;
            } catch (e) { /* noop */ }
          }
          try {
            if (capaOrId.idLayer) {
              var res3 = resolverCapaEnMapa(map, capaOrId.idLayer);
              if (res3) return res3;
            }
          } catch (e) { /* noop */ }
        }
        return capaOrId;
      }

      getState() {
        var opts = this.getJoinOptions();
        return {
          name: this.name,
          legend: this.legend,
          visible: (typeof this.isVisible === 'function') ? this.isVisible() : true,
          options: opts,
          layer1Ident: this._identificadorEstableCapa(this._layer1),
          layer2Ident: this._identificadorEstableCapa(this._layer2)
        };
      }

      setState(state, map) {
        if (!state || typeof state !== 'object') return;
        if (state.options) {
          this.setJoinOptions(state.options);
        }
        if (state.layer1Ident && map) {
          try {
            var c1 = resolverCapaEnMapa(map, state.layer1Ident);
            if (c1) this._layer1 = c1;
          } catch (e) { /* noop */ }
        }
        if (state.layer2Ident && map) {
          try {
            var c2 = resolverCapaEnMapa(map, state.layer2Ident);
            if (c2) this._layer2 = c2;
          } catch (e) { /* noop */ }
        }
        if (map) {
          this._layer1 = this._resolverCapaEnMapaNuevo(map, this._layer1);
          this._layer2 = this._resolverCapaEnMapaNuevo(map, this._layer2);
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
    window.instalarJoinLayer = instalar;
    claseJoin.instalar = instalar;

    return true;
  }

  instalar();
  setInterval(instalar, 10);

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('load', function (e) {
      var obj = e && e.target;
      if (obj && obj.tagName === 'SCRIPT' && /apiidee.*\.js/i.test(obj.src || '')) {
        instalar();
      }
    }, true);
  }
})();
