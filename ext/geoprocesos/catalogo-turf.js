// CATALOGO DE FUNCIONES DE TURF 7.0.0
//
// Generado automaticamente desde los tipos publicados en npm
// (@turf/turf@7.0.0/dist/esm/index.d.ts y el index.d.ts de cada paquete).
// No editar a mano: para actualizar turf, regenerar con el script de
// mantenimiento y volver a comprobar el formulario dinamico.
//
// Cada entrada declara sus parametros para que el plugin construya el
// formulario: tipoControl decide el control (capa, capas, numero, texto,
// booleano, unidades, coordenada, numeros, opciones o json).

window.CATALOGO_TURF = [
 {
  "nombre": "clusterEach",
  "paquete": "@turf/clusters",
  "categoria": "agregacion",
  "descripcion": "clusterEach",
  "retorno": "void",
  "noEjecutable": true,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "FeatureCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Features"
   },
   {
    "nombre": "property",
    "tipo": "string|number",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON property key/value used to create clusters"
   },
   {
    "nombre": "callback",
    "tipo": "Function",
    "tipoControl": "funcion",
    "opcional": false,
    "porDefecto": "> void",
    "descripcion": "a method that takes (cluster, clusterValue, currentIndex)"
   }
  ]
 },
 {
  "nombre": "clusterReduce",
  "paquete": "@turf/clusters",
  "categoria": "agregacion",
  "descripcion": "Reduce clusters in GeoJSON Features, similar to Array.reduce()",
  "retorno": "void",
  "noEjecutable": true,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "FeatureCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Features"
   },
   {
    "nombre": "property",
    "tipo": "string|number",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON property key/value used to create clusters"
   },
   {
    "nombre": "callback",
    "tipo": "Function",
    "tipoControl": "funcion",
    "opcional": false,
    "porDefecto": "> void, initialValue?: any",
    "descripcion": "a method that takes (previousValue, cluster, clusterValue, currentIndex)"
   }
  ]
 },
 {
  "nombre": "clustersDbscan",
  "paquete": "@turf/clusters-dbscan",
  "categoria": "agregacion",
  "descripcion": "Takes a set of {@link Point|points} and partition them into clusters according to {@link DBSCAN's|https://en.wikipedia.org/wiki/DBSCAN} data clustering algorithm.",
  "retorno": "FeatureCollection<Point, DbscanProps>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to be clustered"
   },
   {
    "nombre": "maxDistance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Maximum Distance between any point of the cluster to generate the clusters (kilometers only)"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; minPoints?: number; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "minPoints",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "clustersKmeans",
  "paquete": "@turf/clusters-kmeans",
  "categoria": "agregacion",
  "descripcion": "Takes a set of {@link Point|points} and partition them into clusters using the k-mean . It uses the [k-means algorithm](https://en.wikipedia.org/wiki/K-means_clustering)",
  "retorno": "FeatureCollection<Point, KmeansProps>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to be clustered"
   },
   {
    "nombre": "options",
    "tipo": "{ numberOfClusters?: number; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "numberOfClusters",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "collect",
  "paquete": "@turf/collect",
  "categoria": "agregacion",
  "descripcion": "Merges a specified property from a FeatureCollection of points into a FeatureCollection of polygons. Given an `inProperty` on points and an `outProperty` for polygons, this finds every point that lies within each polygon, collects the `inProperty` values from those points, and adds them as an array to `outProperty` on the polygon.",
  "retorno": "FeatureCollection<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "polygons",
    "tipo": "FeatureCollection<Polygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "polygons with values on which to aggregate"
   },
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "points to be aggregated"
   },
   {
    "nombre": "inProperty",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "property to be nested from"
   },
   {
    "nombre": "outProperty",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "property to be nested into"
   }
  ]
 },
 {
  "nombre": "collectionOf",
  "paquete": "@turf/invariant",
  "categoria": "agregacion",
  "descripcion": "Enforce expectations about types of {@link FeatureCollection} inputs for Turf. Internally this uses {@link geojsonType} to judge geometry types.",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "featureCollection",
    "tipo": "FeatureCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "a FeatureCollection for which features will be judged"
   },
   {
    "nombre": "type",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "expected GeoJSON type"
   },
   {
    "nombre": "name",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "name of calling function"
   }
  ]
 },
 {
  "nombre": "coordEach",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "AllGeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( currentCoord: number[], coordIndex: number, featureIndex: number, multiFeatureIndex: number, geometryIndex: number )",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": "> void, excludeWrapCoord?: boolean",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "coordReduce",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "Reducer",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "AllGeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( previousValue: Reducer, currentCoord: number[], coordIndex: number, featureIndex: number, multiFeatureIndex: number, geometryIndex: number )",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": "> Reducer, initialValue?: Reducer",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "geomEach",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| Feature<G, P> | FeatureCollection<G, P> | G | GeometryCollection | Feature<GeometryCollection, P>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( currentGeometry: G, featureIndex: number, featureProperties: P, featureBBox: BBox, featureId: Id )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> void",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "geomReduce",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "Reducer",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| Feature<G, P> | FeatureCollection<G, P> | G | GeometryCollection | Feature<GeometryCollection, P>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( previousValue: Reducer, currentGeometry: G, featureIndex: number, featureProperties: P, featureBBox: BBox, featureId: Id )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> Reducer, initialValue?: Reducer",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "getCoord",
  "paquete": "@turf/invariant",
  "categoria": "datos",
  "descripcion": "Unwrap a coordinate from a Point Feature, Geometry or a single coordinate.",
  "retorno": "number[]",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coord",
    "tipo": "Array<number>|Geometry<Point>|Feature<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Point or an Array of numbers"
   }
  ]
 },
 {
  "nombre": "getCoords",
  "paquete": "@turf/invariant",
  "categoria": "datos",
  "descripcion": "Unwrap coordinates from a Feature, Geometry Object or an Array",
  "retorno": "any[]",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coords",
    "tipo": "Array<any>|Geometry|Feature",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Feature, Geometry Object or an Array"
   }
  ]
 },
 {
  "nombre": "getGeom",
  "paquete": "@turf/invariant",
  "categoria": "datos",
  "descripcion": "Get Geometry from Feature or Geometry Object",
  "retorno": "G",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Feature|Geometry",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry Object"
   }
  ]
 },
 {
  "nombre": "getType",
  "paquete": "@turf/invariant",
  "categoria": "datos",
  "descripcion": "Get GeoJSON object's type, Geometry type is prioritize.",
  "retorno": "string",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON object"
   },
   {
    "nombre": "_name",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": true,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "lineEach",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| FeatureCollection<Lines, P> | Feature<Lines, P> | Lines | Feature<GeometryCollection, P> | GeometryCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( currentLine: Feature<LineString, P>, featureIndex?: number, multiFeatureIndex?: number, geometryIndex?: number )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> void",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "lineReduce",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "Reducer",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| FeatureCollection<Lines, P> | Feature<Lines, P> | Lines | Feature<GeometryCollection, P> | GeometryCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( previousValue?: Reducer, currentLine?: Feature<LineString, P>, featureIndex?: number, multiFeatureIndex?: number, geometryIndex?: number )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> Reducer, initialValue?: Reducer",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "propEach",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Feature<any> | FeatureCollection<any> | Feature<GeometryCollection>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "(currentProperties: Props, featureIndex: number)",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": "> void",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "propReduce",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "Reducer",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Feature<any, P> | FeatureCollection<any, P> | Geometry",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( previousValue: Reducer, currentProperties: P, featureIndex: number )",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": "> Reducer, initialValue?: Reducer",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "segmentEach",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "AllGeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( currentSegment?: Feature<LineString, P>, featureIndex?: number, multiFeatureIndex?: number, segmentIndex?: number, geometryIndex?: number )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> void",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "segmentReduce",
  "paquete": "@turf/meta",
  "categoria": "datos",
  "descripcion": "",
  "retorno": "Reducer",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| FeatureCollection<Lines, P> | Feature<Lines, P> | Lines | Feature<GeometryCollection, P> | GeometryCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( previousValue?: Reducer, currentSegment?: Feature<LineString, P>, featureIndex?: number, multiFeatureIndex?: number, segmentIndex?: number, geometryIndex?: number )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> Reducer, initialValue?: Reducer",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "interpolate",
  "paquete": "@turf/interpolate",
  "categoria": "interpolacion",
  "descripcion": "",
  "retorno": "FeatureCollection<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "cellSize",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ gridType?: \"point\"; property?: string; units?: Units; weight?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "gridType",
      "tipo": "\"point\"",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "property",
      "tipo": "string",
      "tipoControl": "texto",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "weight",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "planepoint",
  "paquete": "@turf/planepoint",
  "categoria": "interpolacion",
  "descripcion": "",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "point",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "triangle",
    "tipo": "Feature<Polygon> | Polygon",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "along",
  "paquete": "@turf/along",
  "categoria": "medicion",
  "descripcion": "Takes a {@link LineString} and returns a {@link Point} at a specified distance along the line.",
  "retorno": "Feature<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line",
    "tipo": "Feature<LineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input line"
   },
   {
    "nombre": "distance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "distance along the line"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "angle",
  "paquete": "@turf/angle",
  "categoria": "medicion",
  "descripcion": "Finds the angle formed by two adjacent segments defined by 3 points. The result will be the (positive clockwise) angle with origin on the `startPoint-midPoint` segment, or its explementary angle if required.",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "startPoint",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Start Point Coordinates"
   },
   {
    "nombre": "midPoint",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Mid Point Coordinates"
   },
   {
    "nombre": "endPoint",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "End Point Coordinates"
   },
   {
    "nombre": "options",
    "tipo": "{ explementary?: boolean; mercator?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "explementary",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mercator",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "area",
  "paquete": "@turf/area",
  "categoria": "medicion",
  "descripcion": "Takes one or more features and returns their area in square meters.",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input GeoJSON feature(s)"
   }
  ]
 },
 {
  "nombre": "bbox",
  "paquete": "@turf/bbox",
  "categoria": "medicion",
  "descripcion": "Calculates the bounding box for any GeoJSON object, including FeatureCollection. Uses geojson.bbox if available and options.recompute is not set.",
  "retorno": "BBox",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any GeoJSON object"
   },
   {
    "nombre": "options",
    "tipo": "{ recompute?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "recompute",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "bboxClip",
  "paquete": "@turf/bbox-clip",
  "categoria": "medicion",
  "descripcion": "Takes a {@link Feature} and a bbox and clips the feature to the bbox using [lineclip](https://github.com/mapbox/lineclip). May result in degenerate edges when clipping Polygons.",
  "retorno": "Feature<LineString, P | {}> | Feature<MultiLineString, P | {}> | Feature<Polygon, P | {}> | Feature<MultiPolygon, P | {}>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature",
    "tipo": "Feature<LineString|MultiLineString|Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "feature to clip to the bbox"
   },
   {
    "nombre": "bbox",
    "tipo": "BBox",
    "tipoControl": "bbox",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "extent in [minX, minY, maxX, maxY] order"
   }
  ]
 },
 {
  "nombre": "bboxPolygon",
  "paquete": "@turf/bbox-polygon",
  "categoria": "medicion",
  "descripcion": "Takes a bbox and returns an equivalent {@link Polygon|polygon}.",
  "retorno": "Feature<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "BBox",
    "tipoControl": "bbox",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "extent in [minX, minY, maxX, maxY] order"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: P; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "bearing",
  "paquete": "@turf/bearing",
  "categoria": "medicion",
  "descripcion": "Takes two {@link Point|points} and finds the geographic bearing between them, i.e. the angle measured in degrees from the north line (0 degrees)",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "start",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "starting Point"
   },
   {
    "nombre": "end",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "ending Point"
   },
   {
    "nombre": "options",
    "tipo": "{ final?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "final",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "bearingToAzimuth",
  "paquete": "@turf/helpers",
  "categoria": "medicion",
  "descripcion": "Converts any bearing angle from the north line direction (positive clockwise) and returns an angle between 0-360 degrees (positive clockwise), 0 being the north line",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bearing",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "angle, between -180 and +180 degrees"
   }
  ]
 },
 {
  "nombre": "center",
  "paquete": "@turf/center",
  "categoria": "medicion",
  "descripcion": "Takes a {@link Feature} or {@link FeatureCollection} and returns the absolute center point of all features.",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON to be centered"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: P; bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "centerMean",
  "paquete": "@turf/center-mean",
  "categoria": "medicion",
  "descripcion": "Takes a {@link Feature} or {@link FeatureCollection} and returns the mean center. Can be weighted.",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON to be centered"
   }
  ]
 },
 {
  "nombre": "centerMedian",
  "paquete": "@turf/center-median",
  "categoria": "medicion",
  "descripcion": "Takes a {@link FeatureCollection} of points and calculates the median center, algorithimically. The median center is understood as the point that is requires the least total travel from all other points.",
  "retorno": "Feature<Point, {\n    medianCandidates: Array<Position>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "features",
    "tipo": "FeatureCollection<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Any GeoJSON Feature Collection"
   },
   {
    "nombre": "options",
    "tipo": "{ weight?: string; tolerance?: number; counter?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "weight",
      "tipo": "string",
      "tipoControl": "texto",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "tolerance",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "counter",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "centerOfMass",
  "paquete": "@turf/center-of-mass",
  "categoria": "medicion",
  "descripcion": "Takes any {@link Feature} or a {@link FeatureCollection} and returns its [center of mass](https://en.wikipedia.org/wiki/Center_of_mass) using this formula: [Centroid of Polygon](https://en.wikipedia.org/wiki/Centroid#Centroid_of_polygon).",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON to be centered"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "centroid",
  "paquete": "@turf/centroid",
  "categoria": "medicion",
  "descripcion": "Computes the centroid as the mean of all vertices within the object.",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON to be centered"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "destination",
  "paquete": "@turf/destination",
  "categoria": "medicion",
  "descripcion": "Takes a {@link Point} and calculates the location of a destination point given a distance in degrees, radians, miles, or kilometers; and bearing in degrees. This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "origin",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "starting point"
   },
   {
    "nombre": "distance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "distance from the origin point"
   },
   {
    "nombre": "bearing",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "ranging from -180 to 180"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "distance",
  "paquete": "@turf/distance",
  "categoria": "medicion",
  "descripcion": "Calculates the distance between two {@link Point|points} in degrees, radians, miles, or kilometers. This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "from",
    "tipo": "Coord | Point",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "origin point or coordinate"
   },
   {
    "nombre": "to",
    "tipo": "Coord | Point",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "destination point or coordinate"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "distanceWeight",
  "paquete": "@turf/distance-weight",
  "categoria": "medicion",
  "descripcion": "",
  "retorno": "number[][]",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "fc",
    "tipo": "FeatureCollection<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "FeatureCollection."
   },
   {
    "nombre": "options",
    "tipo": "{ threshold?: number; p?: number; binary?: boolean; alpha?: number; standardization?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "option object.",
    "subcampos": [
     {
      "nombre": "threshold",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "p",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "binary",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "alpha",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "standardization",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "greatCircle",
  "paquete": "@turf/great-circle",
  "categoria": "medicion",
  "descripcion": "",
  "retorno": "Feature<LineString | MultiLineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "start",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "end",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: GeoJsonProperties; npoints?: number; offset?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "npoints",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "offset",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "hexGrid",
  "paquete": "@turf/hex-grid",
  "categoria": "medicion",
  "descripcion": "Takes a bounding box and the diameter of the cell and returns a {@link FeatureCollection} of flat-topped hexagons or triangles ({@link Polygon} features) aligned in an \"odd-q\" vertical grid as described in [Hexagonal Grids](http://www.redblobgames.com/grids/hexagons/).",
  "retorno": "FeatureCollection<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "BBox",
    "tipoControl": "bbox",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "extent in [minX, minY, maxX, maxY] order"
   },
   {
    "nombre": "cellSide",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "length of the side of the the hexagons or triangles, in units. It will also coincide with the"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; triangles?: boolean; properties?: P; mask?: Feature<Polygon>; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "triangles",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mask",
      "tipo": "Feature<Polygon>",
      "tipoControl": "capa",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "length",
  "paquete": "@turf/length",
  "categoria": "medicion",
  "descripcion": "Takes a {@link GeoJSON} and measures its length in the specified units, {@link (Multi)Point}'s distance are ignored.",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Feature<LineString|MultiLineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON to measure"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lengthToDegrees",
  "paquete": "@turf/helpers",
  "categoria": "medicion",
  "descripcion": "Convert a distance measurement (assuming a spherical Earth) from a real-world unit into degrees Valid units: miles, nauticalmiles, inches, yards, meters, metres, centimeters, kilometres, feet",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "distance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "in real units"
   },
   {
    "nombre": "units",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": true,
    "porDefecto": "\"kilometers\"",
    "descripcion": "can be degrees, radians, miles, inches, yards, metres,"
   }
  ]
 },
 {
  "nombre": "lengthToRadians",
  "paquete": "@turf/helpers",
  "categoria": "medicion",
  "descripcion": "Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "distance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "in real units"
   },
   {
    "nombre": "units",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": true,
    "porDefecto": "\"kilometers\"",
    "descripcion": "can be degrees, radians, miles, inches, yards, metres,"
   }
  ]
 },
 {
  "nombre": "lineArc",
  "paquete": "@turf/line-arc",
  "categoria": "medicion",
  "descripcion": "Creates a circular arc, of a circle of the given radius and center point, between bearing1 and bearing2; 0 bearing is North of center point, positive clockwise.",
  "retorno": "Feature<LineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "center",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "center point"
   },
   {
    "nombre": "radius",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "radius of the circle"
   },
   {
    "nombre": "bearing1",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "angle, in decimal degrees, of the first radius of the arc"
   },
   {
    "nombre": "bearing2",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "angle, in decimal degrees, of the second radius of the arc"
   },
   {
    "nombre": "options",
    "tipo": "{ steps?: number; units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "steps",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lineChunk",
  "paquete": "@turf/line-chunk",
  "categoria": "medicion",
  "descripcion": "",
  "retorno": "FeatureCollection<LineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| Feature<T> | FeatureCollection<T> | T | GeometryCollection | Feature<GeometryCollection>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "segmentLength",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; reverse?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "reverse",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lineOffset",
  "paquete": "@turf/line-offset",
  "categoria": "medicion",
  "descripcion": "",
  "retorno": "Feature<T>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line",
    "tipo": "Feature<T> | T",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "distance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lineSlice",
  "paquete": "@turf/line-slice",
  "categoria": "medicion",
  "descripcion": "",
  "retorno": "Feature<LineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "startPt",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "stopPt",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "line",
    "tipo": "Feature<LineString> | LineString",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "lineSliceAlong",
  "paquete": "@turf/line-slice-along",
  "categoria": "medicion",
  "descripcion": "",
  "retorno": "Feature<LineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line",
    "tipo": "Feature<LineString> | LineString",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "startDist",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "stopDist",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "midpoint",
  "paquete": "@turf/midpoint",
  "categoria": "medicion",
  "descripcion": "",
  "retorno": "Feature<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "point1",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "point2",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "nearestPoint",
  "paquete": "@turf/nearest-point",
  "categoria": "medicion",
  "descripcion": "Takes a reference {@link Point|point} and a FeatureCollection of Features with Point geometries and returns the point from the FeatureCollection closest to the reference. This calculation is geodesic.",
  "retorno": "NearestPoint",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "targetPoint",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "the reference point"
   },
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "against input point set"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "nearestPointOnLine",
  "paquete": "@turf/nearest-point-on-line",
  "categoria": "medicion",
  "descripcion": "Takes a {@link Point} and a {@link LineString} and calculates the closest Point on the (Multi)LineString.",
  "retorno": "Feature<Point, {\n    dist: number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "lines",
    "tipo": "Geometry|Feature<LineString|MultiLineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "lines to snap to"
   },
   {
    "nombre": "pt",
    "tipo": "Geometry|Feature<Point>|number[]",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "point to snap from"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "pointGrid",
  "paquete": "@turf/point-grid",
  "categoria": "medicion",
  "descripcion": "Creates a {@link Point} grid from a bounding box, {@link FeatureCollection} or {@link Feature}.",
  "retorno": "FeatureCollection<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "extent in [minX, minY, maxX, maxY] order"
   },
   {
    "nombre": "cellSide",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "the distance between points, in units"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; mask?: Feature<Polygon | MultiPolygon>; properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mask",
      "tipo": "Feature<Polygon | MultiPolygon>",
      "tipoControl": "capa",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "pointOnFeature",
  "paquete": "@turf/point-on-feature",
  "categoria": "medicion",
  "descripcion": "Takes a Feature or FeatureCollection and returns a {@link Point} guaranteed to be on the surface of the feature.",
  "retorno": "Feature<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any Feature or FeatureCollection"
   }
  ]
 },
 {
  "nombre": "pointToLineDistance",
  "paquete": "@turf/point-to-line-distance",
  "categoria": "medicion",
  "descripcion": "Returns the minimum distance between a {@link Point} and a {@link LineString}, being the distance from a line the minimum distance between the point and any segment of the `LineString`.",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "pt",
    "tipo": "Feature<Point>|Array<number>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Feature or Geometry"
   },
   {
    "nombre": "line",
    "tipo": "Feature<LineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; method?: \"geodesic\" | \"planar\"; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "method",
      "tipo": "\"geodesic\" | \"planar\"",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "rhumbBearing",
  "paquete": "@turf/rhumb-bearing",
  "categoria": "medicion",
  "descripcion": "Takes two {@link Point|points} and finds the bearing angle between them along a Rhumb line i.e. the angle measured in degrees start the north line (0 degrees)",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "start",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "starting Point"
   },
   {
    "nombre": "end",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "ending Point"
   },
   {
    "nombre": "options",
    "tipo": "{ final?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "final",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "rhumbDestination",
  "paquete": "@turf/rhumb-destination",
  "categoria": "medicion",
  "descripcion": "Returns the destination {@link Point} having travelled the given distance along a Rhumb line from the origin Point with the (varant) given bearing.",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "origin",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "starting point"
   },
   {
    "nombre": "distance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "distance from the starting point"
   },
   {
    "nombre": "bearing",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "varant bearing angle ranging from -180 to 180 degrees from north"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "rhumbDistance",
  "paquete": "@turf/rhumb-distance",
  "categoria": "medicion",
  "descripcion": "Calculates the distance along a rhumb line between two {@link Point|points} in degrees, radians, miles, or kilometers.",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "from",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "origin point"
   },
   {
    "nombre": "to",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "destination point"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "squareGrid",
  "paquete": "@turf/square-grid",
  "categoria": "medicion",
  "descripcion": "Creates a square grid from a bounding box.",
  "retorno": "FeatureCollection<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "extent in [minX, minY, maxX, maxY] order"
   },
   {
    "nombre": "cellSide",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "of each cell, in units"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; properties?: P; mask?: Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mask",
      "tipo": "Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon",
      "tipoControl": "capa",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "triangleGrid",
  "paquete": "@turf/triangle-grid",
  "categoria": "medicion",
  "descripcion": "Takes a bounding box and a cell depth and returns a set of triangular {@link Polygon|polygons} in a grid.",
  "retorno": "FeatureCollection<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "extent in [minX, minY, maxX, maxY] order"
   },
   {
    "nombre": "cellSide",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "dimension of each cell"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; properties?: P; mask?: Feature<Polygon>; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mask",
      "tipo": "Feature<Polygon>",
      "tipoControl": "capa",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "applyFilter",
  "paquete": "@turf/clusters",
  "categoria": "otros",
  "descripcion": "Apply Filter",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "properties",
    "tipo": "any",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Properties"
   },
   {
    "nombre": "filter",
    "tipo": "any",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Filter"
   }
  ]
 },
 {
  "nombre": "convertArea",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "Converts a area to the requested unit. Valid units: kilometers, kilometres, meters, metres, centimetres, millimeters, acres, miles, yards, feet, inches, hectares",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "area",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to be converted"
   },
   {
    "nombre": "originalUnit",
    "tipo": "Units",
    "tipoControl": "unidades",
    "opcional": true,
    "porDefecto": "\"meters\"",
    "descripcion": "of the distance"
   },
   {
    "nombre": "finalUnit",
    "tipo": "Units",
    "tipoControl": "unidades",
    "opcional": true,
    "porDefecto": "\"kilometers\"",
    "descripcion": "returned unit"
   }
  ]
 },
 {
  "nombre": "convertLength",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "Converts a length to the requested unit. Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "length",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to be converted"
   },
   {
    "nombre": "originalUnit",
    "tipo": "Units",
    "tipoControl": "unidades",
    "opcional": true,
    "porDefecto": "\"kilometers\"",
    "descripcion": "of the length"
   },
   {
    "nombre": "finalUnit",
    "tipo": "Units",
    "tipoControl": "unidades",
    "opcional": true,
    "porDefecto": "\"kilometers\"",
    "descripcion": "returned unit"
   }
  ]
 },
 {
  "nombre": "coordAll",
  "paquete": "@turf/meta",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "number[][]",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "AllGeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "createBins",
  "paquete": "@turf/clusters",
  "categoria": "otros",
  "descripcion": "Create Bins",
  "retorno": "Record<string, number[]>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "FeatureCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Features"
   },
   {
    "nombre": "property",
    "tipo": "string|number",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Property values are used to create bins"
   }
  ]
 },
 {
  "nombre": "degreesToRadians",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "Converts an angle in degrees to radians",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "degrees",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "angle between 0 and 360 degrees"
   }
  ]
 },
 {
  "nombre": "ellipse",
  "paquete": "@turf/ellipse",
  "categoria": "otros",
  "descripcion": "Takes a {@link Point} and calculates the ellipse polygon given two semi-axes expressed in variable units and steps for precision.",
  "retorno": "Feature<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "center",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "center point"
   },
   {
    "nombre": "xSemiAxis",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "semi (major) axis of the ellipse along the x-axis"
   },
   {
    "nombre": "ySemiAxis",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "semi (minor) axis of the ellipse along the y-axis"
   },
   {
    "nombre": "options",
    "tipo": "{ steps?: number; units?: Units; angle?: number; pivot?: Coord; properties?: GeoJsonProperties; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "steps",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "angle",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "pivot",
      "tipo": "Coord",
      "tipoControl": "coordenada",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "envelope",
  "paquete": "@turf/envelope",
  "categoria": "otros",
  "descripcion": "Takes any number of features and returns a rectangular {@link Polygon} that encompasses all vertices.",
  "retorno": "Feature<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input features"
   }
  ]
 },
 {
  "nombre": "filterProperties",
  "paquete": "@turf/clusters",
  "categoria": "otros",
  "descripcion": "Filter Properties",
  "retorno": "any",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "properties",
    "tipo": "Record<string, any>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Properties"
   },
   {
    "nombre": "keys",
    "tipo": "Array<string>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Used to filter Properties"
   }
  ]
 },
 {
  "nombre": "findPoint",
  "paquete": "@turf/meta",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Feature<G, P> | FeatureCollection<G, P> | G",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ featureIndex?: number; multiFeatureIndex?: number; geometryIndex?: number; coordIndex?: number; properties?: P; bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "featureIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "multiFeatureIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "geometryIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "coordIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "findSegment",
  "paquete": "@turf/meta",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "Feature<LineString, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Feature<G, P> | FeatureCollection<G, P> | G",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ featureIndex?: number; multiFeatureIndex?: number; geometryIndex?: number; segmentIndex?: number; properties?: P; bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "featureIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "multiFeatureIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "geometryIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "segmentIndex",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "geojsonRbush",
  "paquete": "@turf/geojson-rbush",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "RBush<G, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "maxEntries",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": true,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "geojsonType",
  "paquete": "@turf/invariant",
  "categoria": "otros",
  "descripcion": "Enforce expectations about types of GeoJSON objects for Turf.",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "value",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any GeoJSON object"
   },
   {
    "nombre": "type",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "expected GeoJSON type"
   },
   {
    "nombre": "name",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "name of calling function"
   }
  ]
 },
 {
  "nombre": "geometry",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "Creates a GeoJSON {@link Geometry} from a Geometry string type & coordinates. For GeometryCollection type use `helpers.geometryCollection`",
  "retorno": "Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "type",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Geometry Type"
   },
   {
    "nombre": "coordinates",
    "tipo": "Array<any>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Coordinates"
   },
   {
    "nombre": "_options",
    "tipo": "Record<string, never>",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "getCluster",
  "paquete": "@turf/clusters",
  "categoria": "otros",
  "descripcion": "Get Cluster",
  "retorno": "FeatureCollection<G, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "FeatureCollection",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Features"
   },
   {
    "nombre": "filter",
    "tipo": "any",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Filter used on GeoJSON properties to get Cluster"
   }
  ]
 },
 {
  "nombre": "isNumber",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "isNumber",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "num",
    "tipo": "any",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Number to validate"
   }
  ]
 },
 {
  "nombre": "isObject",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "isObject",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "input",
    "tipo": "any",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "variable to validate"
   }
  ]
 },
 {
  "nombre": "lineSegment",
  "paquete": "@turf/line-segment",
  "categoria": "otros",
  "descripcion": "Creates a {@link FeatureCollection} of 2-vertex {@link LineString} segments from a {@link LineString|(Multi)LineString} or {@link Polygon|(Multi)Polygon}.",
  "retorno": "FeatureCollection<LineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Polygon or LineString"
   }
  ]
 },
 {
  "nombre": "lineSplit",
  "paquete": "@turf/line-split",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "FeatureCollection<T>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line",
    "tipo": "Feature<T> | T",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "splitter",
    "tipo": "Splitter",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "moranIndex",
  "paquete": "@turf/moran-index",
  "categoria": "otros",
  "descripcion": "Moran's I measures patterns of attribute values associated with features. The method reveal whether similar values tend to occur near each other, or whether high or low values are interspersed.",
  "retorno": "{\n    moranIndex: number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "fc",
    "tipo": "FeatureCollection<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "* @param {Object} options"
   },
   {
    "nombre": "options",
    "tipo": "{ inputField: string; threshold?: number; p?: number; binary?: boolean; alpha?: number; standardization?: boolean; }",
    "tipoControl": "opciones",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "inputField",
      "tipo": "string",
      "tipoControl": "texto",
      "opcional": false,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "threshold",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "p",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "binary",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "alpha",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "standardization",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "nearestNeighborAnalysis",
  "paquete": "@turf/nearest-neighbor-analysis",
  "categoria": "otros",
  "descripcion": "Nearest Neighbor Analysis calculates an index based the average distances between points in the dataset, thereby providing inference as to whether the data is clustered, dispersed, or randomly distributed within the study area.",
  "retorno": "NearestNeighborStudyArea",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "dataset",
    "tipo": "FeatureCollection<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "FeatureCollection (pref. of points) to study"
   },
   {
    "nombre": "options",
    "tipo": "{ studyArea?: Feature<Polygon>; units?: Units & AreaUnits; properties?: GeoJsonProperties; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "studyArea",
      "tipo": "Feature<Polygon>",
      "tipoControl": "capa",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units & AreaUnits",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "propertiesContainsFilter",
  "paquete": "@turf/clusters",
  "categoria": "otros",
  "descripcion": "Properties contains filter (does not apply deepEqual operations)",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "properties",
    "tipo": "any",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Properties"
   },
   {
    "nombre": "filter",
    "tipo": "any",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Filter"
   }
  ]
 },
 {
  "nombre": "quadratAnalysis",
  "paquete": "@turf/quadrat-analysis",
  "categoria": "otros",
  "descripcion": "Quadrat analysis lays a set of equal-size areas(quadrat) over the study area and counts the number of features in each quadrat and creates a frequency table. The table lists the number of quadrats containing no features, the number containing one feature, two features, and so on, all the way up to the quadrat containing the most features. The method then creates the frequency table for the random distribution, usually based on a Poisson distribution. The method uses the distribution to calculate the probability for 0 feature occuring, 1 feature occuring, 2 features, and so on, and lists these probabilities in the frequency table. By comparing the two frequency tables, you can see whether the features create a pattern. If the table for the observed distribution has more quadrats containing many features than the table for the random distribution dose, then the features create a clustered pattern.",
  "retorno": "QuadratAnalysisResult",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "pointFeatureSet",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "point set to study"
   },
   {
    "nombre": "options",
    "tipo": "{ studyBbox?: [number, number, number, number]; confidenceLevel?: 20 | 15 | 10 | 5 | 2 | 1; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "studyBbox",
      "tipo": "[number, number, number, number]",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "confidenceLevel",
      "tipo": "20 | 15 | 10 | 5 | 2 | 1",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "radiansToDegrees",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "Converts an angle in radians to degrees",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "radians",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "angle in radians"
   }
  ]
 },
 {
  "nombre": "radiansToLength",
  "paquete": "@turf/helpers",
  "categoria": "otros",
  "descripcion": "Convert a distance measurement (assuming a spherical Earth) from radians to a more friendly unit. Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "radians",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "in radians across the sphere"
   },
   {
    "nombre": "units",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": true,
    "porDefecto": "\"kilometers\"",
    "descripcion": "can be degrees, radians, miles, inches, yards, metres,"
   }
  ]
 },
 {
  "nombre": "randomLineString",
  "paquete": "@turf/random",
  "categoria": "otros",
  "descripcion": "Returns a random {@link linestring}.",
  "retorno": "FeatureCollection<LineString, any>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "count",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": true,
    "porDefecto": "1",
    "descripcion": "how many geometries will be generated"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; num_vertices?: number; max_length?: number; max_rotation?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "num_vertices",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "max_length",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "max_rotation",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "randomPoint",
  "paquete": "@turf/random",
  "categoria": "otros",
  "descripcion": "Returns a random {@link point}.",
  "retorno": "FeatureCollection<Point, any>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "count",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": true,
    "porDefecto": "1",
    "descripcion": "how many geometries will be generated"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "randomPolygon",
  "paquete": "@turf/random",
  "categoria": "otros",
  "descripcion": "Returns a random {@link polygon}.",
  "retorno": "FeatureCollection<Polygon, any>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "count",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": true,
    "porDefecto": "1",
    "descripcion": "how many geometries will be generated"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; num_vertices?: number; max_radial_length?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "num_vertices",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "max_radial_length",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "randomPosition",
  "paquete": "@turf/random",
  "categoria": "otros",
  "descripcion": "Returns a random position within a {@link bounding box}.",
  "retorno": "Position",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": true,
    "porDefecto": "[-180, -90, 180, 90",
    "descripcion": "] a bounding box inside of which positions are placed."
   }
  ]
 },
 {
  "nombre": "rectangleGrid",
  "paquete": "@turf/rectangle-grid",
  "categoria": "otros",
  "descripcion": "Creates a grid of rectangles from a bounding box, {@link Feature} or {@link FeatureCollection}.",
  "retorno": "FeatureCollection<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "extent in [minX, minY, maxX, maxY] order"
   },
   {
    "nombre": "cellWidth",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "of each cell, in units"
   },
   {
    "nombre": "cellHeight",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "of each cell, in units"
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; properties?: P; mask?: Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mask",
      "tipo": "Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon",
      "tipoControl": "capa",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "sector",
  "paquete": "@turf/sector",
  "categoria": "otros",
  "descripcion": "Creates a circular sector of a circle of given radius and center {@link Point}, between (clockwise) bearing1 and bearing2; 0 bearing is North of center point, positive clockwise.",
  "retorno": "Feature<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "center",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "center point"
   },
   {
    "nombre": "radius",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "radius of the circle"
   },
   {
    "nombre": "bearing1",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "angle, in decimal degrees, of the first radius of the sector"
   },
   {
    "nombre": "bearing2",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "angle, in decimal degrees, of the second radius of the sector"
   },
   {
    "nombre": "options",
    "tipo": "{ steps?: number; units?: Units; properties?: GeoJsonProperties; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "steps",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "square",
  "paquete": "@turf/square",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "BBox",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "BBox",
    "tipoControl": "bbox",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "standardDeviationalEllipse",
  "paquete": "@turf/standard-deviational-ellipse",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "StandardDeviationalEllipse",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: GeoJsonProperties; weight?: string; steps?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "weight",
      "tipo": "string",
      "tipoControl": "texto",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "steps",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "tesselate",
  "paquete": "@turf/tesselate",
  "categoria": "otros",
  "descripcion": "",
  "retorno": "FeatureCollection<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "polygon",
    "tipo": "Feature<Polygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "booleanClockwise",
  "paquete": "@turf/boolean-clockwise",
  "categoria": "relaciones",
  "descripcion": "Takes a ring and return true or false whether or not the ring is clockwise or counter-clockwise.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line",
    "tipo": "Feature<LineString>|LineString|Array<Array<number>>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to be evaluated"
   }
  ]
 },
 {
  "nombre": "booleanConcave",
  "paquete": "@turf/boolean-concave",
  "categoria": "relaciones",
  "descripcion": "Takes a polygon and return true or false as to whether it is concave or not.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "polygon",
    "tipo": "Feature<Polygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to be evaluated"
   }
  ]
 },
 {
  "nombre": "booleanContains",
  "paquete": "@turf/boolean-contains",
  "categoria": "relaciones",
  "descripcion": "Boolean-contains returns True if the second geometry is completely contained by the first geometry. The interiors of both geometries must intersect and, the interior and boundary of the secondary (geometry b) must not intersect the exterior of the primary (geometry a). Boolean-contains returns the exact opposite result of the `@turf/boolean-within`.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "booleanCrosses",
  "paquete": "@turf/boolean-crosses",
  "categoria": "relaciones",
  "descripcion": "Boolean-Crosses returns True if the intersection results in a geometry whose dimension is one less than the maximum dimension of the two source geometries and the intersection set is interior to both source geometries.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "booleanDisjoint",
  "paquete": "@turf/boolean-disjoint",
  "categoria": "relaciones",
  "descripcion": "Boolean-disjoint returns (TRUE) if the intersection of the two geometries is an empty set.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "booleanEqual",
  "paquete": "@turf/boolean-equal",
  "categoria": "relaciones",
  "descripcion": "Determine whether two geometries of the same type have identical X,Y coordinate values. See http://edndoc.esri.com/arcsde/9.0/general_topics/understand_spatial_relations.htm",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON input"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON input"
   },
   {
    "nombre": "options",
    "tipo": "{ precision?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "precision",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "booleanIntersects",
  "paquete": "@turf/boolean-intersects",
  "categoria": "relaciones",
  "descripcion": "Boolean-intersects returns (TRUE) two geometries intersect.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "booleanOverlap",
  "paquete": "@turf/boolean-overlap",
  "categoria": "relaciones",
  "descripcion": "Compares two geometries of the same dimension and returns true if their intersection set results in a geometry different from both but of the same dimension. It applies to Polygon/Polygon, LineString/LineString, Multipoint/Multipoint, MultiLineString/MultiLineString and MultiPolygon/MultiPolygon.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature<LineString|MultiLineString|Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature<LineString|MultiLineString|Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input"
   }
  ]
 },
 {
  "nombre": "booleanParallel",
  "paquete": "@turf/boolean-parallel",
  "categoria": "relaciones",
  "descripcion": "Boolean-Parallel returns True if each segment of `line1` is parallel to the correspondent segment of `line2`",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line1",
    "tipo": "Geometry|Feature<LineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "line2",
    "tipo": "Geometry|Feature<LineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "booleanPointInPolygon",
  "paquete": "@turf/boolean-point-in-polygon",
  "categoria": "relaciones",
  "descripcion": "Takes a {@link Point} and a {@link Polygon} or {@link MultiPolygon} and determines if the point resides inside the polygon. The polygon can be convex or concave. The function accounts for holes.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "point",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input point"
   },
   {
    "nombre": "polygon",
    "tipo": "Feature<Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input polygon or multipolygon"
   },
   {
    "nombre": "options",
    "tipo": "{ ignoreBoundary?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "ignoreBoundary",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "booleanPointOnLine",
  "paquete": "@turf/boolean-point-on-line",
  "categoria": "relaciones",
  "descripcion": "Returns true if a point is on a line. Accepts a optional parameter to ignore the start and end vertices of the linestring.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "pt",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Point"
   },
   {
    "nombre": "line",
    "tipo": "Feature<LineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON LineString"
   },
   {
    "nombre": "options",
    "tipo": "{ ignoreEndVertices?: boolean; epsilon?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "ignoreEndVertices",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "epsilon",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "booleanTouches",
  "paquete": "@turf/boolean-touches",
  "categoria": "relaciones",
  "descripcion": "Boolean-touches true if none of the points common to both geometries intersect the interiors of both geometries.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "booleanValid",
  "paquete": "@turf/boolean-valid",
  "categoria": "relaciones",
  "descripcion": "booleanValid checks if the geometry is a valid according to the OGC Simple Feature Specification.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "booleanWithin",
  "paquete": "@turf/boolean-within",
  "categoria": "relaciones",
  "descripcion": "Boolean-within returns true if the first geometry is completely within the second geometry. The interiors of both geometries must intersect and, the interior and boundary of the primary (geometry a) must not intersect the exterior of the secondary (geometry b). Boolean-within returns the exact opposite result of the `@turf/boolean-contains`.",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature1",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   },
   {
    "nombre": "feature2",
    "tipo": "Geometry|Feature<any>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Feature or Geometry"
   }
  ]
 },
 {
  "nombre": "containsNumber",
  "paquete": "@turf/invariant",
  "categoria": "relaciones",
  "descripcion": "Checks if coordinates contains a number",
  "retorno": "boolean",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<any>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Coordinates"
   }
  ]
 },
 {
  "nombre": "validateBBox",
  "paquete": "@turf/helpers",
  "categoria": "relaciones",
  "descripcion": "Validate BBox",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "bbox",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "BBox to validate"
   }
  ]
 },
 {
  "nombre": "validateId",
  "paquete": "@turf/helpers",
  "categoria": "relaciones",
  "descripcion": "Validate Id",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "id",
    "tipo": "string|number",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Id to validate"
   }
  ]
 },
 {
  "nombre": "bezierSpline",
  "paquete": "@turf/bezier-spline",
  "categoria": "superposicion",
  "descripcion": "Takes a {@link LineString|line} and returns a curved version by applying a [Bezier spline](http://en.wikipedia.org/wiki/B%C3%A9zier_spline) algorithm.",
  "retorno": "Feature<LineString, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line",
    "tipo": "Feature<LineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input LineString"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: P; resolution?: number; sharpness?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "resolution",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "sharpness",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "buffer",
  "paquete": "@turf/buffer",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "Feature<Polygon | MultiPolygon> | undefined",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature",
    "tipo": "| Feature<GeometryObject> | Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "radius",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": true,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "Options",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "steps",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "cleanCoords",
  "paquete": "@turf/clean-coords",
  "categoria": "superposicion",
  "descripcion": "Removes redundant coordinates from any GeoJSON Geometry.",
  "retorno": "any",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Geometry|Feature",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Feature or Geometry"
   },
   {
    "nombre": "options",
    "tipo": "{ mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "combine",
  "paquete": "@turf/combine",
  "categoria": "superposicion",
  "descripcion": "Combines a {@link FeatureCollection} of {@link Point}, {@link LineString}, or {@link Polygon} features into {@link MultiPoint}, {@link MultiLineString}, or {@link MultiPolygon} features.",
  "retorno": "FeatureCollection<MultiPoint | MultiLineString | MultiPolygon, {\n    collectedProperties: GeoJsonProperties[]",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "fc",
    "tipo": "FeatureCollection<Point|LineString|Polygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "a FeatureCollection of any type"
   }
  ]
 },
 {
  "nombre": "concave",
  "paquete": "@turf/concave",
  "categoria": "superposicion",
  "descripcion": "Takes a set of {@link Point|points} and returns a concave hull Polygon or MultiPolygon. Internally, this uses [turf-tin](https://github.com/Turfjs/turf-tin) to generate geometries.",
  "retorno": "Feature<Polygon | MultiPolygon> | null",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input points"
   },
   {
    "nombre": "options",
    "tipo": "{ maxEdge?: number; units?: Units; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "maxEdge",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "convex",
  "paquete": "@turf/convex",
  "categoria": "superposicion",
  "descripcion": "Takes a {@link Feature} or a {@link FeatureCollection} and returns a convex hull {@link Polygon}.",
  "retorno": "Feature<Polygon, P> | null",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input Feature or FeatureCollection"
   },
   {
    "nombre": "options",
    "tipo": "{ concavity?: number; properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "concavity",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "difference",
  "paquete": "@turf/difference",
  "categoria": "superposicion",
  "descripcion": "Finds the difference between multiple {@link Polygon|polygons} by clipping the subsequent polygon from the first.",
  "retorno": "Feature<Polygon | MultiPolygon> | null",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "features",
    "tipo": "FeatureCollection<Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input Polygon features"
   }
  ]
 },
 {
  "nombre": "dissolve",
  "paquete": "@turf/dissolve",
  "categoria": "superposicion",
  "descripcion": "Dissolves a FeatureCollection of {@link polygon} features, filtered by an optional property name:value. Note that {@link mulitpolygon} features within the collection are not supported",
  "retorno": "FeatureCollection<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "fc",
    "tipo": "FeatureCollection<Polygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ propertyName?: string; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "propertyName",
      "tipo": "string",
      "tipoControl": "texto",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "explode",
  "paquete": "@turf/explode",
  "categoria": "superposicion",
  "descripcion": "Takes a feature or set of features and returns all positions as {@link Point|points}.",
  "retorno": "FeatureCollection<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input features"
   }
  ]
 },
 {
  "nombre": "flatten",
  "paquete": "@turf/flatten",
  "categoria": "superposicion",
  "descripcion": "Flattens any {@link GeoJSON} to a {@link FeatureCollection} inspired by [geojson-flatten](https://github.com/tmcw/geojson-flatten).",
  "retorno": "FeatureCollection<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any valid GeoJSON Object"
   }
  ]
 },
 {
  "nombre": "flattenEach",
  "paquete": "@turf/meta",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| Feature<G, P> | FeatureCollection<G, P> | G | GeometryCollection | Feature<GeometryCollection, P>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( currentFeature: Feature<G, P>, featureIndex: number, multiFeatureIndex: number )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> void",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "flattenReduce",
  "paquete": "@turf/meta",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "Reducer",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| Feature<G, P> | FeatureCollection<G, P> | G | GeometryCollection | Feature<GeometryCollection, P>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( previousValue: Reducer, currentFeature: Feature<G, P>, featureIndex: number, multiFeatureIndex: number )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> Reducer, initialValue?: Reducer",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "intersect",
  "paquete": "@turf/intersect",
  "categoria": "superposicion",
  "descripcion": "Takes {@link Polygon|polygon} or {@link MultiPolygon|multi-polygon} geometries and finds their polygonal intersection. If they don't intersect, returns null.",
  "retorno": "Feature<Polygon | MultiPolygon, P> | null",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "features",
    "tipo": "FeatureCollection<Polygon | MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "the features to intersect"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "isobands",
  "paquete": "@turf/isobands",
  "categoria": "superposicion",
  "descripcion": "Takes a square or rectangular grid {@link FeatureCollection} of {@link Point} features with z-values and an array of value breaks and generates filled contour isobands.",
  "retorno": "FeatureCollection<MultiPolygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "pointGrid",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input points - must be square or rectangular"
   },
   {
    "nombre": "breaks",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "where to draw contours"
   },
   {
    "nombre": "options",
    "tipo": "{ zProperty?: string; commonProperties?: GeoJsonProperties; breaksProperties?: GeoJsonProperties[]; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "options on output",
    "subcampos": [
     {
      "nombre": "zProperty",
      "tipo": "string",
      "tipoControl": "texto",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "commonProperties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "breaksProperties",
      "tipo": "GeoJsonProperties[]",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "isolines",
  "paquete": "@turf/isolines",
  "categoria": "superposicion",
  "descripcion": "Takes a grid {@link FeatureCollection} of {@link Point} features with z-values and an array of value breaks and generates [isolines](https://en.wikipedia.org/wiki/Contour_line).",
  "retorno": "FeatureCollection<MultiLineString, GeoJsonProperties>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "pointGrid",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input points"
   },
   {
    "nombre": "breaks",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "values of `zProperty` where to draw isolines"
   },
   {
    "nombre": "options",
    "tipo": "{ zProperty?: string; commonProperties?: GeoJsonProperties; breaksProperties?: GeoJsonProperties[]; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "zProperty",
      "tipo": "string",
      "tipoControl": "texto",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "commonProperties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "breaksProperties",
      "tipo": "GeoJsonProperties[]",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lineIntersect",
  "paquete": "@turf/line-intersect",
  "categoria": "superposicion",
  "descripcion": "Takes any LineString or Polygon GeoJSON and returns the intersecting point(s).",
  "retorno": "FeatureCollection<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line1",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any LineString or Polygon"
   },
   {
    "nombre": "line2",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any LineString or Polygon"
   },
   {
    "nombre": "options",
    "tipo": "{ removeDuplicates?: boolean; ignoreSelfIntersections?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "removeDuplicates",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "ignoreSelfIntersections",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lineOverlap",
  "paquete": "@turf/line-overlap",
  "categoria": "superposicion",
  "descripcion": "Takes any LineString or Polygon and returns the overlapping lines between both features.",
  "retorno": "FeatureCollection<LineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "line1",
    "tipo": "Geometry|Feature<LineString|MultiLineString|Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any LineString or Polygon"
   },
   {
    "nombre": "line2",
    "tipo": "Geometry|Feature<LineString|MultiLineString|Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any LineString or Polygon"
   },
   {
    "nombre": "options",
    "tipo": "{ tolerance?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "tolerance",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lineToPolygon",
  "paquete": "@turf/line-to-polygon",
  "categoria": "superposicion",
  "descripcion": "Converts (Multi)LineString(s) to Polygon(s).",
  "retorno": "Feature<geojson.MultiPolygon, {\n    [name: string]: any",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "lines",
    "tipo": "FeatureCollection|Feature<LineString|MultiLineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Features to convert"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: GeoJsonProperties; autoComplete?: boolean; orderCoords?: boolean; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "GeoJsonProperties",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "autoComplete",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "orderCoords",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "mask",
  "paquete": "@turf/mask",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "Feature<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "poly",
    "tipo": "Feature<T> | FeatureCollection<T> | T",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "mask",
    "tipo": "Feature<Polygon> | Polygon",
    "tipoControl": "capa",
    "opcional": true,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "polygonize",
  "paquete": "@turf/polygonize",
  "categoria": "superposicion",
  "descripcion": "Polygonizes {@link LineString|(Multi)LineString(s)} into {@link Polygons}.",
  "retorno": "FeatureCollection<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geoJson",
    "tipo": "FeatureCollection|Geometry|Feature<LineString|MultiLineString>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Lines in order to polygonize"
   }
  ]
 },
 {
  "nombre": "polygonToLine",
  "paquete": "@turf/polygon-to-line",
  "categoria": "superposicion",
  "descripcion": "Converts a {@link Polygon} to {@link LineString|(Multi)LineString} or {@link MultiPolygon} to a {@link FeatureCollection} of {@link LineString|(Multi)LineString}.",
  "retorno": "Feature<LineString | MultiLineString, P> | FeatureCollection<LineString | MultiLineString, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "poly",
    "tipo": "Feature<Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Feature to convert"
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: any; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "any",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "rewind",
  "paquete": "@turf/rewind",
  "categoria": "superposicion",
  "descripcion": "Rewind {@link LineString|(Multi)LineString} or {@link Polygon|(Multi)Polygon} outer ring counterclockwise and inner rings clockwise (Uses {@link http://en.wikipedia.org/wiki/Shoelace_formula|Shoelace Formula}).",
  "retorno": "Geometry | Feature | FeatureCollection",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input GeoJSON Polygon"
   },
   {
    "nombre": "options",
    "tipo": "{ reverse?: boolean; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "reverse",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "sample",
  "paquete": "@turf/sample",
  "categoria": "superposicion",
  "descripcion": "Takes a {@link FeatureCollection} and returns a FeatureCollection with given number of {@link Feature|features} at random.",
  "retorno": "FeatureCollection<T>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "fc",
    "tipo": "FeatureCollection<T>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "num",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "number of features to select"
   }
  ]
 },
 {
  "nombre": "shortestPath",
  "paquete": "@turf/shortest-path",
  "categoria": "superposicion",
  "descripcion": "Returns the shortest {@link LineString|path} from {@link Point|start} to {@link Point|end} without colliding with any {@link Feature} in {@link FeatureCollection<Polygon>| obstacles}",
  "retorno": "Feature<LineString>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "start",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "point"
   },
   {
    "nombre": "end",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "point"
   },
   {
    "nombre": "options",
    "tipo": "{ obstacles?: Polygon | Feature<Polygon> | FeatureCollection<Polygon>; units?: Units; resolution?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "obstacles",
      "tipo": "Polygon | Feature<Polygon> | FeatureCollection<Polygon>",
      "tipoControl": "capa",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "resolution",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "simplify",
  "paquete": "@turf/simplify",
  "categoria": "superposicion",
  "descripcion": "Takes a {@link GeoJSON} object and returns a simplified version. Internally uses the 2d version of [simplify-js](http://mourner.github.io/simplify-js/) to perform simplification using the Ramer-Douglas-Peucker algorithm.",
  "retorno": "T",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "object to be simplified"
   },
   {
    "nombre": "options",
    "tipo": "{ tolerance?: number; highQuality?: boolean; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "tolerance",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "highQuality",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "tag",
  "paquete": "@turf/tag",
  "categoria": "superposicion",
  "descripcion": "Takes a set of {@link Point|points} and a set of {@link Polygon|polygons} and/or {@link MultiPolygon|multipolygons} and performs a spatial join.",
  "retorno": "FeatureCollection<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input points"
   },
   {
    "nombre": "polygons",
    "tipo": "FeatureCollection<Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input (multi)polygons"
   },
   {
    "nombre": "field",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "property in `polygons` to add to joined {<Point>} features"
   },
   {
    "nombre": "outField",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "property in `points` in which to store joined property from `polygons`"
   }
  ]
 },
 {
  "nombre": "tin",
  "paquete": "@turf/tin",
  "categoria": "superposicion",
  "descripcion": "Takes a set of {@link Point|points} and creates a [Triangulated Irregular Network](http://en.wikipedia.org/wiki/Triangulated_irregular_network), or a TIN for short, returned as a collection of Polygons. These are often used for developing elevation contour maps or stepped heat visualizations.",
  "retorno": "FeatureCollection<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input points"
   },
   {
    "nombre": "z",
    "tipo": "String",
    "tipoControl": "texto",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "name of the property from which to pull z values"
   }
  ]
 },
 {
  "nombre": "toWgs84",
  "paquete": "@turf/projection",
  "categoria": "superposicion",
  "descripcion": "Converts a Mercator (EPSG:900913) GeoJSON object into WGS84 projection",
  "retorno": "G",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON|Position",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Mercator GeoJSON object"
   },
   {
    "nombre": "options",
    "tipo": "{ mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "transformRotate",
  "paquete": "@turf/transform-rotate",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "T",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "T",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "angle",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ pivot?: Coord; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "pivot",
      "tipo": "Coord",
      "tipoControl": "coordenada",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "transformScale",
  "paquete": "@turf/transform-scale",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "T",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "T",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "factor",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ origin?: Corners | Coord; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "origin",
      "tipo": "Corners | Coord",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "transformTranslate",
  "paquete": "@turf/transform-translate",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "T",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "T",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "distance",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "direction",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ units?: Units; zTranslation?: number; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "zTranslation",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "truncate",
  "paquete": "@turf/truncate",
  "categoria": "superposicion",
  "descripcion": "Takes a GeoJSON Feature or FeatureCollection and truncates the precision of the geometry.",
  "retorno": "T",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "any GeoJSON Feature, FeatureCollection, Geometry or GeometryCollection."
   },
   {
    "nombre": "options",
    "tipo": "{ precision?: number; coordinates?: number; mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "precision",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "coordinates",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "union",
  "paquete": "@turf/union",
  "categoria": "superposicion",
  "descripcion": "Takes input {@link (Multi)Polygon(s)} and returns a combined polygon. If the input polygons are not contiguous, this function returns a {@link MultiPolygon} feature.",
  "retorno": "Feature<Polygon | MultiPolygon, P> | null",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "features",
    "tipo": "FeatureCollection<Polygon | MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "unkinkPolygon",
  "paquete": "@turf/unkink-polygon",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "FeatureCollection<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "Feature<T> | FeatureCollection<T> | T",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "voronoi",
  "paquete": "@turf/voronoi",
  "categoria": "superposicion",
  "descripcion": "",
  "retorno": "FeatureCollection<Polygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "FeatureCollection<Point>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "options",
    "tipo": "{ bbox: BBox }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": false,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "circle",
  "paquete": "@turf/circle",
  "categoria": "transformacion",
  "descripcion": "Takes a {@link Point} and calculates the circle polygon given a radius in degrees, radians, miles, or kilometers; and steps for precision.",
  "retorno": "Feature<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "center",
    "tipo": "Feature<Point>|number[]",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "center point"
   },
   {
    "nombre": "radius",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "radius of the circle"
   },
   {
    "nombre": "options",
    "tipo": "{ steps?: number; units?: Units; properties?: P; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "steps",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "units",
      "tipo": "Units",
      "tipoControl": "unidades",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "properties",
      "tipo": "P",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "clone",
  "paquete": "@turf/clone",
  "categoria": "transformacion",
  "descripcion": "Returns a cloned copy of the passed GeoJSON Object, including possible 'Foreign Members'. ~3-5x faster than the common JSON.parse + JSON.stringify combo method.",
  "retorno": "T",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Object"
   }
  ]
 },
 {
  "nombre": "cloneProperties",
  "paquete": "@turf/clone",
  "categoria": "transformacion",
  "descripcion": "Clone Properties",
  "retorno": "{\n    [key: string]: any",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "properties",
    "tipo": "GeoJsonProperties",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "GeoJSON Properties"
   }
  ]
 },
 {
  "nombre": "feature",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.",
  "retorno": "Feature<G, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geom",
    "tipo": "G | null",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "featureCollection",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.",
  "retorno": "FeatureCollection<G, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "features",
    "tipo": "Feature[]",
    "tipoControl": "capas",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input features"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "featureEach",
  "paquete": "@turf/meta",
  "categoria": "transformacion",
  "descripcion": "",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| Feature<G, P> | FeatureCollection<G, P> | Feature<GeometryCollection, P>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "(currentFeature: Feature<G, P>, featureIndex: number)",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> void",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "featureOf",
  "paquete": "@turf/invariant",
  "categoria": "transformacion",
  "descripcion": "Enforce expectations about types of {@link Feature} inputs for Turf. Internally this uses {@link geojsonType} to judge geometry types.",
  "retorno": "void",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "feature",
    "tipo": "Feature",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "a feature with an expected geometry type"
   },
   {
    "nombre": "type",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "expected GeoJSON type"
   },
   {
    "nombre": "name",
    "tipo": "string",
    "tipoControl": "texto",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "name of calling function"
   }
  ]
 },
 {
  "nombre": "featureReduce",
  "paquete": "@turf/meta",
  "categoria": "transformacion",
  "descripcion": "",
  "retorno": "Reducer",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "| Feature<G, P> | FeatureCollection<G, P> | Feature<GeometryCollection, P>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": ""
   },
   {
    "nombre": "callback",
    "tipo": "( previousValue: Reducer, currentFeature: Feature<G, P>, featureIndex: number )",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": "> Reducer, initialValue?: Reducer",
    "descripcion": ""
   }
  ]
 },
 {
  "nombre": "flip",
  "paquete": "@turf/flip",
  "categoria": "transformacion",
  "descripcion": "Takes input features and flips all of their coordinates from `[x, y]` to `[y, x]`.",
  "retorno": "T",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input features"
   },
   {
    "nombre": "options",
    "tipo": "{ mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "geometryCollection",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Feature<GeometryCollection>} based on a coordinate array. Properties can be added optionally.",
  "retorno": "Feature<GeometryCollection, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geometries",
    "tipo": "Array<Geometry>",
    "tipoControl": "capas",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of GeoJSON Geometries"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "kinks",
  "paquete": "@turf/kinks",
  "categoria": "transformacion",
  "descripcion": "Takes a {@link LineString|linestring}, {@link MultiLineString|multi-linestring}, {@link MultiPolygon|multi-polygon} or {@link Polygon|polygon} and returns {@link Point|points} at all self-intersections.",
  "retorno": "FeatureCollection<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "featureIn",
    "tipo": "Feature<LineString|MultiLineString|MultiPolygon|Polygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "input feature"
   }
  ]
 },
 {
  "nombre": "lineString",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link LineString} {@link Feature} from an Array of Positions.",
  "retorno": "Feature<LineString, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<number>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of Positions"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "lineStrings",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link LineString} {@link FeatureCollection} from an Array of LineString coordinates.",
  "retorno": "FeatureCollection<LineString, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<Array<number>>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of LinearRings"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "multiLineString",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Feature<MultiLineString>} based on a coordinate array. Properties can be added optionally.",
  "retorno": "Feature<MultiLineString, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<Array<number>>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of LineStrings"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "multiPoint",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Feature<MultiPoint>} based on a coordinate array. Properties can be added optionally.",
  "retorno": "Feature<MultiPoint, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<number>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of Positions"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "multiPolygon",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Feature<MultiPolygon>} based on a coordinate array. Properties can be added optionally.",
  "retorno": "Feature<MultiPolygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<Array<Array<number>>>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of Polygons"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "point",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Point} {@link Feature} from a Position.",
  "retorno": "Feature<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<number>",
    "tipoControl": "numeros",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "longitude, latitude position (each in decimal degrees)"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "points",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Point} {@link FeatureCollection} from an Array of Point coordinates.",
  "retorno": "FeatureCollection<Point, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<number>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of Points"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "Translate these properties to each Feature"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "pointsWithinPolygon",
  "paquete": "@turf/points-within-polygon",
  "categoria": "transformacion",
  "descripcion": "Finds {@link Points} or {@link MultiPoint} coordinate positions that fall within {@link (Multi)Polygon(s)}.",
  "retorno": "FeatureCollection<Point | MultiPoint, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "points",
    "tipo": "Feature|FeatureCollection<Point|MultiPoint>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Point(s) or MultiPoint(s) as input search"
   },
   {
    "nombre": "polygons",
    "tipo": "FeatureCollection|Geometry|Feature<Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "(Multi)Polygon(s) to check if points are within"
   }
  ]
 },
 {
  "nombre": "polygon",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.",
  "retorno": "Feature<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<Array<number>>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of LinearRings"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "polygons",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Creates a {@link Polygon} {@link FeatureCollection} from an Array of Polygon coordinates.",
  "retorno": "FeatureCollection<Polygon, P>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "coordinates",
    "tipo": "Array<Array<Array<Array<number>>>>",
    "tipoControl": "json",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "an array of Polygon coordinates"
   },
   {
    "nombre": "properties",
    "tipo": "P",
    "tipoControl": "json",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "an Object of key-value pairs to add as properties"
   },
   {
    "nombre": "options",
    "tipo": "{ bbox?: BBox; id?: Id; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "bbox",
      "tipo": "BBox",
      "tipoControl": "bbox",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     },
     {
      "nombre": "id",
      "tipo": "Id",
      "tipoControl": "json",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "polygonSmooth",
  "paquete": "@turf/polygon-smooth",
  "categoria": "transformacion",
  "descripcion": "Smooths a {@link Polygon} or {@link MultiPolygon}. Based on [Chaikin's algorithm](http://graphics.cs.ucdavis.edu/education/CAGDNotes/Chaikins-Algorithm/Chaikins-Algorithm.html). Warning: may create degenerate polygons.",
  "retorno": "FeatureCollection<Polygon | MultiPolygon>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "inputPolys",
    "tipo": "FeatureCollection<Polygon|MultiPolygon>|Feature<Polygon|MultiPolygon>|Polygon|MultiPolygon",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "(Multi)Polygon(s) to smooth"
   },
   {
    "nombre": "options",
    "tipo": "{ iterations?: number; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": "{}",
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "iterations",
      "tipo": "number",
      "tipoControl": "numero",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 },
 {
  "nombre": "polygonTangents",
  "paquete": "@turf/polygon-tangents",
  "categoria": "transformacion",
  "descripcion": "Finds the tangents of a {@link Polygon|(Multi)Polygon} from a {@link Point}.",
  "retorno": "FeatureCollection<Point>",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "pt",
    "tipo": "Coord",
    "tipoControl": "coordenada",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to calculate the tangent points from"
   },
   {
    "nombre": "polygon",
    "tipo": "Feature<Polygon|MultiPolygon>",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "to get tangents from"
   }
  ]
 },
 {
  "nombre": "round",
  "paquete": "@turf/helpers",
  "categoria": "transformacion",
  "descripcion": "Round number to precision",
  "retorno": "number",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "num",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "Number"
   },
   {
    "nombre": "precision",
    "tipo": "number",
    "tipoControl": "numero",
    "opcional": true,
    "porDefecto": "0",
    "descripcion": "Precision"
   }
  ]
 },
 {
  "nombre": "toMercator",
  "paquete": "@turf/projection",
  "categoria": "transformacion",
  "descripcion": "Converts a WGS84 GeoJSON object into Mercator (EPSG:900913) projection",
  "retorno": "G",
  "noEjecutable": false,
  "parametros": [
   {
    "nombre": "geojson",
    "tipo": "GeoJSON|Position",
    "tipoControl": "capa",
    "opcional": false,
    "porDefecto": null,
    "descripcion": "WGS84 GeoJSON object"
   },
   {
    "nombre": "options",
    "tipo": "{ mutate?: boolean; }",
    "tipoControl": "opciones",
    "opcional": true,
    "porDefecto": null,
    "descripcion": "",
    "subcampos": [
     {
      "nombre": "mutate",
      "tipo": "boolean",
      "tipoControl": "booleano",
      "opcional": true,
      "porDefecto": null,
      "descripcion": ""
     }
    ]
   }
  ]
 }
];
