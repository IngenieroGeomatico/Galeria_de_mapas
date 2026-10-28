# Mostrar en 2D las capas que en 3D son 3D

> Investigación (28/10/2026) sobre qué se puede hacer en la implementación OpenLayers con las capas que hoy
> solo tienen representación real en Cesium: COPC, IFC/glTF y 3D Tiles. Incluye medidas tomadas en navegador
> con la build `apiidee-1.1.0.ol.min.js` del repositorio.

---

## 1. Resumen ejecutivo

| Capa | Qué se pinta hoy en 2D | Qué se puede llegar a pintar | Coste |
|---|---|---|---|
| **COPC** (`ext/copcLayer`) | Huella (bbox del `info.cube`) | **Puntos reales**, con LOD por vista y presupuesto de ~60 k puntos | Medio: vendor de ~260 KB + pipeline de ~2 s |
| **IFC / glTF** (`ext/ifcLayer`) | Huella real si el IFC está georreferenciado (`IfcSite` / `IfcMapConversion`) | Nada mejor: el 2D no puede renderizar mallas | Ya resuelto |
| **3D Tiles** (vía `ifcLayer`, `url` con `tileset.json`) | **Nada**: sin `position` no se dibuja huella; con `position`, un cuadrado genérico de 0,0006° | **Huella real** leyendo `root.boundingVolume` (`region` o `box` + `transform`) | Bajo: una petición y ~90 líneas (**implementado**) |
| **Fotogrametría / vuelo** (`ext/vueloFotogrametrico`) | Ya es 2D nativo (huellas calculadas) | — | — |
| **Estereoscopía, clampToGround** | Son modos de cámara/terreno, no capas | — | — |

Dos conclusiones:

1. **COPC sí se puede leer en cliente y pintar en OL**, pero no con `copcesium.js` (depende de `window.Cesium` al
   evaluarse) ni con `IDEE.utils.reproject` para CRS exóticos. Necesita un vendor propio (`copc` + `laz-perf` +
   `proj4`) y un presupuesto de puntos agresivo: **~60 k puntos es el techo cómodo**, 131 k se mueve pero el
   redibujado completo tras un cambio de vista se va a 5–6 s.
2. **Para el resto, lo correcto no es leer el formato 3D en 2D**, sino publicar un **producto 2D derivado**
   (COG, GeoParquet/FlatGeobuf decimado o teselas vectoriales). El repositorio ya tiene plugins para los tres
   formatos, así que el trabajo es de datos, no de código.

---

## 2. Qué hay hoy en el repositorio

| Extensión | Tipo de capa | 2D | 3D |
|---|---|---|---|
| `ext/copcLayer` | `IDEE.layer.COPC` (subclase de `Vector`) | Huella | Puntos reales (`copcesium`) |
| `ext/ifcLayer` | `IDEE.layer.IFC` (subclase de `Vector`) | Huella | `Cesium3DTileset` / `Model.fromGltf` |
| `ext/layergroup_cesium` | Grupos | — | Sustituye `IDEE.layer.LayerGroup` (protegida, no tocar) |
| `ext/controlClampToGroundLayers` | Ajuste al terreno | — | Solo 3D |
| `ext/estereoscopia` | Modo de cámara | — | Solo 3D |
| `ext/vueloFotogrametrico` | Capa propia | Nativa | Nativa |

Y ya existen los consumidores de los productos 2D que se proponen en el punto 5:
`ext/geotiffLayer`, `ext/geoparquetLayer`, `ext/flatgeobufLayer`, `ext/pmtilesLayer`, `ext/MVTLayer`,
`ext/maplibreLayer`.

---

## 3. Qué permite la build OL 1.1.0

Comprobado sobre `js/api-idee/apiidee-1.1.0.ol.min.js`:

- **25 tipos de capa**: `GenericRaster`, `GenericVector`, `GeoJSON`, `GeoPackage`, `GeoPackageTile`, `GeoTIFF`,
  `KML`, `LayerGroup`, `MBTiles`, `MBTilesVector`, `MVT`, `MapLibre`, `OGCAPIFeatures`, `OSM`, `Section`, `TMS`,
  `Terrain`, `Tiles3D`, `Vector`, `WFS`, `WMC`, `WMS`, `WMTS`, `XYZ`, `type`.
- `IDEE.layer.Tiles3D` **existe en la fachada pero no en la impl OL**:
  `new IDEE.layer.Tiles3D({...})` lanza `La implementación usada no puede crear capas Tiles3D.`
- **No hay `WebGLPointsLayer`** en el bundle (`WebGLPoints` → no encontrado; `Heatmap` sí existe internamente).
  Es decir: los vectores se pintan con el renderer **canvas** de OL, sin aceleración WebGL. Eso explica el techo
  de ~60 k puntos.
- `mapajs.getMapImpl()` devuelve **el `ol/Map` directamente** (tiene `renderSync`, `getView`), no un wrapper con
  `getMap()`.
- `IDEE.utils.reproject` solo resuelve CRS que estén en el registro de proyecciones de la API:

  | Llamada | Resultado |
  |---|---|
  | `reproject([440000, 4470000], 'EPSG:25830', 'EPSG:4326')` | `[-3.7068, 40.3784]` ✔ |
  | `reproject([638865, 849280], 'EPSG:2992', 'EPSG:4326')` | `TypeError: Cannot read properties of null (reading 'getCode')` ✘ |
  | `reproject([x, y], wktCompuesto, 'EPSG:4326')` | mismo `TypeError` ✘ |

  Conclusión: para un COPC con un CRS que no esté en el registro (2992, un CRS local, un WKT compuesto…) hay que
  usar `proj4` propio.

---

## 4. COPC en 2D: sí, con puntos reales

### 4.1 Stack mínimo

| Pieza | Origen | Tamaño | Notas |
|---|---|---|---|
| `copc@0.0.8` | `https://esm.sh/copc@0.0.8` (o vendor) | 52 KB (33 módulos) | `Copc.create`, `loadHierarchyPage`, `loadPointDataView` |
| `laz-perf@0.0.7` | `https://cdn.jsdelivr.net/npm/laz-perf@0.0.7/lib/web/laz-perf.js` | 85 KB | Expone `window.createLazPerf`; el `.wasm` va embebido en base64, no hace falta fichero aparte |
| `proj4@2.20.9` | `https://cdn.jsdelivr.net/npm/proj4@2.20.9/dist/proj4.js` | 126 KB | Solo si el CRS del COPC no está en el registro de la API |

`copc` se puede cargar como ESM (`import()`), `laz-perf` **solo como `<script>` clásico** (es un build UMD/emscripten
con `createLazPerf` global). Total vendorizable ≈ 260 KB, en línea con lo que ya hay en `ext/` (`pmtiles.min.js`
20 KB, `hyparquet.min.js` 64 KB, `flatgeobuf-geojson.min.js` 61 KB). Las tres dependencias ya están inventariadas
en `ext/copcLayer/THIRD_PARTY_LICENSES.md` por ser la cadena de `copcesium`.

### 4.2 Los tres callejones sin salida (comprobados)

1. **`copcesium.js` en 2D** → `TypeError: Cannot read properties of undefined (reading 'Math')` en
   `copcesium.js:7932`. La IIFE se invoca con `window.Cesium` (`})(window.Cesium);`, línea 8759) y lo usa durante
   la evaluación, así que no basta con cargarlo antes: revienta al ejecutarse.
2. **Reutilizar `Fo.Copc` / `Eo.create` del bundle** → están en el ámbito de la IIFE, no se exportan
   (`window.copcesium = { CopcDataSource: Vs, WorkerPool: Ds }` es lo único que sale). Exponerlos obligaría a
   tocar el bundle vendorizado y a blindar todos los usos de `Cesium`; no compensa.
3. **`IDEE.utils.reproject` con WKT** → ver tabla del punto 3. Además el WKT de un COPC suele ser **compuesto**
   (`COMPD_CS[...]`), y proj4 tampoco lo acepta tal cual: hay que quedarse con la parte horizontal.

```js
// Extrae el CRS horizontal de un WKT compuesto contando corchetes.
function crsHorizontal(wkt) {
  const ini = wkt.search(/PROJCS\s*\[|GEOGCS\s*\[|GEOCCS\s*\[|GEOGCRS\s*\(|PROJCRS\s*\(/i);
  if (ini < 0) return wkt;
  let nivel = 0;
  for (let i = ini; i < wkt.length; i++) {
    const c = wkt[i];
    if (c === '[' || c === '(') nivel++;
    else if (c === ']' || c === ')') { nivel--; if (nivel === 0) return wkt.slice(ini, i + 1); }
  }
  return wkt;
}
const conv = proj4(crsHorizontal(copc.wkt), 'EPSG:4326');
```

### 4.3 Pipeline

```
Range GET cabecera  →  Copc.create            (info.cube = [cx, cy, cz, hx, hy, hz], wkt, spacing)
Range GET raíz      →  loadHierarchyPage      (278 nodos, claves "d-x-y-z")
                     ↓
     elegir nodos: profundidad según zoom + recorte por vista (bounds del nodo)
                     ↓
     loadPointDataView(nodo, { lazPerf })     → getter('X'|'Y'|'Z'|'Red'|'Green'|'Blue'|'Intensity')
                     ↓
     conv.forward([x, y])                     → lon/lat (EPSG:4326)
                     ↓
     IDEE.layer.GeoJSON({ source: {FeatureCollection} })  ← la API reproyecta sola a 3857
```

Tres detalles que cuestan tiempo si se descubren tarde:

- **`IDEE.layer.GeoJSON` espera EPSG:4326.** Si se le pasan coordenadas 3857 no falla, pero
  `getMaxExtent()` devuelve valores corruptos (~1,5e12) y `setBbox` deja el mapa en el océano.
- **Los nodos de `copc@0.0.8` no traen `key`**; la clave está en el nombre de la propiedad de `h.nodes`
  (`"0-0-0-0"`, `"3-2-1-0"`…). Hay que conservarla para calcular los bounds.
- **Bounds de un nodo** a partir de la clave (el cubo es centro + semiejes):

```js
const [cx, cy, cz, hx, hy, hz] = copc.info.cube;
function boundsDeNodo(key) {
  const [d, x, y] = key.split('-').map(Number);
  const s = 2 ** d;
  return {
    minx: cx + (hx * 2 * x) / s, maxx: cx + (hx * 2 * (x + 1)) / s,
    miny: cy + (hy * 2 * y) / s, maxy: cy + (hy * 2 * (y + 1)) / s,
  };
}
```

### 4.4 Medidas (Autzen, 10.653.336 puntos)

Fichero `https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz`, 278 nodos, `maxDepth` 5,
`info.cube` = `[635577.79, 848882.15, 406.14, 640233.3, 853537.66, 5061.65]` (pies, EPSG:2992 + NAVD88).

**Arranque**

| Paso | Tiempo | Bytes |
|---|---|---|
| `import()` de `copc` (esm.sh, primera vez) | 1.302 ms | — |
| `Copc.create` | 1.243 ms | 74.492 B de cabecera |
| `loadHierarchyPage` | 172 ms | — |
| `createLazPerf()` | 273 ms | — |
| Decodificar nodo raíz (61.201 pts) | 369–440 ms | 763.258 B |
| Reproyectar 61.201 puntos | 233 ms | — |
| `new IDEE.layer.GeoJSON` + `addLayers` | 1.211 ms | — |

→ **primera nube en pantalla en ~2 s**. Con la caché caliente se ahorran los 1,3 s del `import()`, pero el alta
de la capa `GeoJSON` (1,2 s) y la decodificación (0,4 s) no se recuperan: el suelo está en ~1,8 s.

**Interacción (renderer canvas)**

| Puntos | Pan/zoom animado | `renderSync` tras cambio de vista |
|---|---|---|
| 20.000 | 60 fps (mediana 17 ms, p90 17, pico 44) | ~2–4 ms |
| 61.201 | 60 fps (mediana 17 ms, p90 20, pico 930) | ~0,9 s |
| 131.060 | 60 fps (mediana 17 ms, p90 20, pico 76) | **5,2–6,2 s** |

La animación va bien incluso con 131 k porque OL reutiliza el canvas; lo que mata es el **redibujado completo**
(resize, cambio de zoom con recarga de teselas, `setBbox`). De ahí el presupuesto.

### 4.5 Pirámide de LOD: los dos primeros niveles son gratis

Coste de leer los nodos **de cada profundidad** que caen en una vista simulada (mitad este del cubo):

| Nivel | Nodos | Puntos | Bytes | Tiempo |
|---|---|---|---|---|
| 0 (raíz) | 1 | 61.201 | 763 KB | 440 ms |
| 1 | 1 | 25.629 | 330 KB | 70 ms |
| 2 | 4 | 175.721 | 1,81 MB | 1.078 ms |
| 3 | 16 | 575.126 | 5,36 MB | 6.198 ms |
| 4 | 64 | 2.756.610 | 20,1 MB | 20.409 ms |
| 5 | 14 | 146.034 | 1,17 MB | 3.512 ms |

Dos lecturas:

- **Raíz + nivel 1 = ~87 k puntos, 1,1 MB, ~0,5 s.** Es el paquete que cabe en el presupuesto y da una nube
  reconocible a cualquier zoom.
- A partir del nivel 2 el coste se dispara (1 s para 176 k, 6 s para 575 k) y además no cabría en el renderer.
  **No tiene sentido intentar «el COPC completo» en 2D**: para eso está la vista 3D.
- Las lecturas están hechas **en serie**; con 4–8 peticiones en paralelo el nivel 2 bajaría a ~300–400 ms, pero
  el cuello sigue siendo el renderer, no la red.

### 4.6 Estrategia recomendada si se implementa

1. **Presupuesto fijo** (`maxPuntos2D`, por defecto 60.000) y **LOD por vista**:
   - calcular los bounds de la vista en el CRS del COPC (una sola reproyección de las 4 esquinas);
   - recorrer la jerarquía y quedarse con los nodos que intersectan;
   - ordenar por profundidad y acumular `pointCount` hasta el presupuesto;
   - si un nodo no cabe entero, **submuestrear** con un `stride` (`for (i = 0; i < n; i += k)`), que es lo que
     hace `copcesium` con el `pointBudget`.
2. **Recarga diferida**: al `moveend`, si el conjunto de nodos cambia, decodificar en `requestIdleCallback` y
   sustituir la fuente (`clear()` + `addFeatures`), nunca acumular.
3. **Color**: `Red`/`Green`/`Blue` vienen en 16 bits; normalizar por el máximo del nodo (como hace `copcesium`)
   o pintar por `Classification`/`Intensity`. Un color plano con `IDEE.style.Generic` es 3–4 veces más rápido
   que un `style` por feature.
4. **No tocar la capa COPC original**: la nube de puntos debe ser una capa auxiliar aparte, porque
   `cambioImpl.transferOverlayLayers()` convierte **toda capa `type == "Vector"` a `GeoJSON`** al pasar a 3D
   (`ext/cambioImpl/cambioImpl.js`, líneas 784-837) y perdería la clase, el `bbox` y el lector. Si la capa de
   puntos es hija de la COPC, hay que **excluirla** de la transferencia o destruirla al cambiar de impl.

**Forma de la API propuesta** (encaja con el constructor actual de `ext/copcLayer`, que ya recibe `bbox`):

```js
new IDEE.layer.COPC({
  url: '...copc.laz',
  bbox: [-123.0755, 44.0497, -123.0620, 44.0628],  // opcional; si falta se lee de la cabecera
  modo2D: 'puntos',      // 'huella' (por defecto, comportamiento actual) | 'puntos'
  maxPuntos2D: 60000,    // presupuesto del renderer
  color2D: 'rgb',        // 'rgb' | 'classification' | 'intensity' | 'plano'
});
```

El modo `'puntos'` debería cargar el vendor **solo cuando se selecciona** (import dinámico), para no penalizar
los visores que solo usan la huella.

### 4.7 Alternativa sin vendor: «descargar y trocear» en el servidor

Si no se quiere meter 260 KB de dependencias en el cliente, el mismo resultado se obtiene publicando un
**GeoJSON/FlatGeobuf decimado** (ver punto 5) y dejando el COPC solo para 3D. Es menos espectacular (no hay
LOD real) pero es cero código nuevo.

---

## 5. Mejor que leer el 3D en el navegador: producto 2D derivado

Para nubes de puntos grandes y para fotogrametría, el patrón que funciona es **precalcular** una representación
2D y publicarla como capa normal. El repositorio ya sabe consumir todas estas:

| Producto | Extensión lista | Ventaja | Inconveniente |
|---|---|---|---|
| **COG** (GeoTIFF cloud-optimized) de intensidad, hillshade o densidad | `ext/geotiffLayer` | Una sola petición por tesela, render nativo, sin CPU en cliente | Es una imagen: no hay puntos ni consulta por feature |
| **Teselas vectoriales** (MVT/PMTiles) de puntos decimados o agregados (rejilla, H3) | `ext/MVTLayer`, `ext/pmtilesLayer`, `ext/maplibreLayer` | Miles de millones de puntos, streaming por tesela, estilos dinámicos | Requiere `tippecanoe`/`gdal` en la cadena de publicación |
| **GeoParquet** particionado por bbox | `ext/geoparquetLayer` | Consulta por extensión, compresión buena, columnar (clasificación, intensidad) | Carga el rango entero en memoria |
| **FlatGeobuf** con índice espacial | `ext/flatgeobufLayer` | Streaming por bbox sin servidor (solo `Range`) | Sin LOD: o entra todo o se decima antes |
| **GeoJSON** estático decimado | `IDEE.layer.GeoJSON` | Trivial | Pesado a partir de ~100 k features |

Regla práctica: **≤ 100 k puntos → GeoJSON/FlatGeobuf; más → MVT/PMTiles o COG**. Y el COG es la única opción
razonable cuando lo que se quiere mostrar es «el aspecto» de la nube (sombra, densidad, intensidad) y no los
puntos individuales.

---

## 6. 3D Tiles / IFC / glTF: la huella

### 6.1 `region`: el caso fácil

`root.boundingVolume.region = [oeste, sur, este, norte, minHeight, maxHeight]` en **radianes**. Se convierte a
grados y ya está; no hace falta `transform`.

### 6.2 `box` + `transform`: la huella real

`box` son 12 números: centro (3) + tres semiejes (3×3). Si el tileset trae `root.transform` (matriz 4×4
column-major, ECEF), la huella se obtiene transformando las 8 esquinas y convirtiéndolas a geodésicas.

Probado con `TilesetWithDiscreteLOD` de CesiumGS (raíz con `box` y `transform`):

```
centro ECEF   [1215107.76, -4736682.90, 4081926.10]
centro lon/lat  -75.612094, 40.042531   (altura 503,75 m)
bbox          [-75.620409, 40.039702, -75.603780, 40.045359]
alturas       0,05 m – 1007,55 m
```

Es una huella de ~1,4 km × 0,6 km en Filadelfia, coherente con el modelo. Nota: al pasar las 8 esquinas a
lon/lat y quedarse con la envolvente **geográfica** se sobreestima el área si el `box` está rotado; para una
huella de referencia es aceptable, para algo exacto habría que dibujar el paralelogramo proyectado.

ECEF → lon/lat sin Cesium: fórmula de Bowring (10 líneas) o `proj4('+proj=geocent +datum=WGS84 +units=m +no_defs', 'EPSG:4326')`,
que ya viene con el vendor del punto 4.

### 6.3 `box` sin `transform`: no hay nada que hacer

Si no hay `transform` ni `region`, el `box` está en coordenadas **locales** del modelo (típicamente centrado en
`0,0,0`), y no hay georreferenciación posible: en ese caso hay que seguir usando el `position` manual, o quedarse
sin huella. Es lo que pasa con buena parte de los tilesets de buildingSMART, que publican geometría sin
`transform` y dejan la ubicación al visor.

Ojo con el comportamiento actual de `ext/ifcLayer` en este caso: `_ifcPintarHuella()` solo parsea URLs `.ifc`;
para un `tileset.json` no hace nada y `_ifcCalcularBboxSiFalta()` **necesita `_ifcPosition`** para fabricar el
cuadrado de 0,0006°. Es decir, hoy un 3D Tiles sin `position` **no dibuja ninguna huella**: solo deja un
`console.warn` de «IFC no georreferenciado».

### 6.4 IFC y glTF

- **IFC**: ya resuelto. `_ifcProcesarIFC()` lee `IfcSite` (`RefLatitude`/`RefLongitude`/`RefElevation`) o
  `IfcMapConversion`, y `_ifcPintarHuella()` dibuja el AABB del modelo en metros convertido a grados.
- **glTF/GLB suelto**: el formato no lleva georreferenciación. Depende de `position`/`orientation` del constructor.
  La huella solo puede ser una caja del tamaño del modelo, que ni siquiera se conoce sin parsearlo: aceptable
  como marcador, no como huella.

### 6.5 Implementado en `ext/ifcLayer` (v2.5.0)

Antes, `_ifcPintarHuella()` solo tenía rama para `.ifc`, y `_ifcCalcularBboxSiFalta()` necesita `position`: un
3D Tiles sin `position` se quedaba sin huella. Ahora hay un camino propio:

- **Funciones de módulo**: `huellaDeTileset(url)` → `descargarHuellaDeTileset` → `bboxDeTilesetJSON`, con
  `bboxDeRegion`, `bboxDeBox`, `aplicarMatriz4`, `ecefALonLat` (Bowring) y `bboxValida`.
- **Método de capa** `_ifcHuellaDeTilesetSiFalta()`: rellena `_ifcBbox`, `_ifcExtent3857`, marca
  `_ifcGeorreferenciado` y anota el origen en `_ifcFuenteHuella = 'tileset'`.
- Se llama desde `_ifcPintarHuella()` (2D, antes de dibujar) y desde la rama de tileset de `_ifcCargar3D()`
  (3D, después de añadir la primitiva, sin bloquear la carga).
- La validación estricta pasa de `if (!this._ifcPosition)` a `if (!this._ifcPosition && !this._ifcBbox)`.

Comprobado en navegador:

| Caso | Resultado |
|---|---|
| `TilesetWithDiscreteLOD` (`box` + `transform`) | bbox `[-75.620409, 40.039702, -75.603780, 40.045359]`, 1 feature, `formato: '3D Tiles'` |
| `TilesetWithRequestVolume` (`region`) | bbox `[-75.614441, 40.040721, -75.609748, 40.044340]` |
| `tileset.json` con `box` local (sin `transform`) | sin huella, aviso «no georreferenciado» (comportamiento anterior) |
| 3D (Cesium) con el mismo tileset | bbox idéntico y `Cesium3DTileset` cargado |

Detalles que resuelve la implementación:

- **Sin `transform`**: se usa la identidad y se descarta el `box` si su centro en ECEF no cae entre 6,0 y 7,0 Mm
  del centro de la Tierra. Así se rechazan los `box` locales centrados en `0,0,0` sin falsos positivos.
- **`region` que cruza el antimeridiano** (`o > e`, o longitudes fuera de ±180°): se abre a `[-180, 180]`, que es
  lo único representable en un `[o, s, e, n]`.
- **Tileset externo**: si la raíz no trae `boundingVolume` pero su `content.uri` apunta a otro `.json`, se sigue
  un salto.
- **CORS o red caída**: se captura y se avisa por consola; la capa conserva el comportamiento anterior
  (`position` manual o sin huella).

Con esto los tilesets que sí están georreferenciados (`region`, o `box` + `transform`) dejan de depender de un
`position` manual y de un cuadrado de 0,0006° que no tiene nada que ver con la huella real. Es el caso de la
mayoría de los que se publican con `transform` (fotogrametría, IGN, etc.).

---

## 7. Recomendación

| Escenario | Qué hacer |
|---|---|
| Visor con COPC y necesidad de «ver algo» en 2D | **Huella actual** (coste cero) o **producto 2D derivado** (COG/MVT) si se quiere detalle |
| Visor donde el COPC es el protagonista y se cambia mucho 2D↔3D | **Puntos reales con LOD y presupuesto 60 k**, como capa auxiliar no transferible |
| 3D Tiles | **Leer `root.boundingVolume`**; es barato y arregla la huella (hoy ausente, o un cuadrado genérico si hay `position`) |
| IFC | Nada: ya está resuelto |
| Fotogrametría masiva | **COG** o **MVT**; nunca puntos sueltos en canvas |

Orden de esfuerzo/beneficio: **(1) huella de 3D Tiles** (implementada en `ext/ifcLayer` v2.5.0),
**(2) producto 2D derivado** (trabajo de datos, cero código), **(3) puntos COPC en 2D** (plugin nuevo, ~260 KB
de vendor y un presupuesto de puntos que hay que mantener).

---

## 8. Anexo: cómo reproducir las medidas

```js
// En la consola de cualquier visor 2D con la API cargada
await new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/laz-perf@0.0.7/lib/web/laz-perf.js';
  s.onload = res; s.onerror = rej;
  document.head.appendChild(s);
});
const { Copc } = await import('https://esm.sh/copc@0.0.8');
const url = 'https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz';
const getter = async (b, e) => new Uint8Array(await (await fetch(url, {
  headers: { Range: `bytes=${b}-${e - 1}` },
})).arrayBuffer());

const lazPerf = await window.createLazPerf();
const copc = await Copc.create(getter);
const jerarquia = await Copc.loadHierarchyPage(getter, copc.info.rootHierarchyPage);
const view = await Copc.loadPointDataView(getter, copc, jerarquia.nodes['0-0-0-0'], { lazPerf });
view.pointCount;            // 61201
view.getter('X')(0);        // primera X en el CRS del fichero
```

Datos de referencia del fichero: `info.cube` = centro + semiejes, `spacing` = 36,37 (unidades del CRS),
`wkt` = `COMPD_CS["NAD83 / Oregon GIC Lambert (ft) + NAVD88 height (ftUS)", ...]`.

Dependencias y licencias: `copc` (MIT), `laz-perf` (Apache-2.0, wasm embebido), `proj4` (MIT). Las tres ya están
inventariadas en `ext/copcLayer/THIRD_PARTY_LICENSES.md` por ser la cadena de dependencias de `copcesium`.
