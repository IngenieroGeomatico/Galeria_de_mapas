# ext/copcLayer (COPC en 3D y huella en 2D)

Extension que anade soporte para **COPC** (*Cloud Optimized Point Cloud*) como capa nativa de la API: `IDEE.layer.COPC`. COPC es un LAZ 1.4 organizado en un octree y con un directorio al principio del fichero, asi que el cliente solo pide por HTTP `Range` los nodos que necesita para el nivel de detalle de la vista. Cesium no lee COPC de serie: la extension usa `copcesium` (MIT) para convertir los nodos en primitivas de puntos del viewer.

- **3D**: se leen y pintan los puntos reales sobre Cesium.
- **2D**: OpenLayers no lee COPC; se dibuja solo la **huella** del `bbox` para que la capa se pueda listar, ocultar y encuadrar desde el selector.

La capa hereda de `IDEE.layer.Vector`, que es la clase de la API que funciona en 2D y en 3D y la que entiende el selector. `GenericVector` no sirve para esto (medido: su impl no tiene `setVisible` y `map.addLayers` falla).

---

## Archivos

| Archivo | Descripcion |
|---|---|
| `copcLayer.js` | Unico JS de la extension: instala `IDEE.layer.COPC` (subclase de `IDEE.layer.Vector`), dibuja la huella en 2D y carga `copcesium` solo cuando hay un mapa 3D. Expone `window.copcLayer` y `window.miCOPC`. |
| `copcesium.js` | Bundle vendorizado de **copcesium 1.4.0** (MIT), lector de COPC sobre CesiumJS. Transformado de ESM a script clasico y envuelto en una IIFE (ver [Vendor](#vendor-copcesiumjs)). |
| `THIRD_PARTY_LICENSES.md` | Licencias y avisos de copyright de las dependencias que incluye el bundle (`copc`, `laz-perf`, `proj4`, `mgrs`, `wkt-parser`, `cross-fetch`). |
| `README.md` | Este documento. |

`copcesium.js` no se incluye con un `<script>` en el visualizador. `copcLayer.js` lo descarga la primera vez que hay un mapa 3D.

---

## Uso

En el `index.html` del visualizador basta con cargar el JS de la extension despues de la API:

```html
<script src="../../../../ext/copcLayer/copcLayer.js"></script>
```

En `js/mapa.js` se crea como cualquier otra capa:

```js
const capa = new IDEE.layer.COPC({
  url: 'https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz',
  bbox: [-123.075542, 44.049719, -123.061960, 44.062780], // EPSG:4326
  name: 'AutzenCOPC',
  legend: 'Autzen (COPC, solo 3D)',
  copc: {
    maxPoints: 2500000,
    maxVisibleNodes: 120,
    maxCacheNodes: 150,
    concurrency: 5,
    pixelSize: 2,
    sseThreshold: 200,
    colorMode: 'rgb',
    autoFrame: false,
  },
}, {
  style: new IDEE.style.Generic({
    polygon: {
      fill: { color: '#5eead4', opacity: 0.12 },
      stroke: { color: '#0f766e', width: 2 },
    },
  }),
});

mapajs.addLayers(capa);
```

Tambien se puede usar la fabrica sin `new`:

```js
const capa = window.copcLayer.crearCapa(url, { bbox, name, legend, copc });
window.copcLayer.anadirCapa(mapajs, url, { bbox, name, legend, copc });
```

### Parametros de la capa

| Parametro | Tipo | Descripcion |
|---|---|---|
| `url` | `string` | URL del `.copc.laz`. El servidor debe permitir CORS y peticiones `Range`. |
| `bbox` | `[oeste, sur, este, norte]` | Extension en **EPSG:4326**. Necesaria para la huella y el zoom en 2D; en 3D los puntos se leen aunque falte. |
| `name` / `legend` | `string` | Identificadores de la capa en el selector. Si falta uno, se copia del otro. |
| `visible` | `boolean` | Visibilidad inicial. Por defecto `true`. |
| `opacity` | `number` | Opacidad inicial entre 0 y 1. Por defecto `1`. |
| `copc` | `Object` | Opciones que se pasan a `CopcDataSource.load`. Se mezclan con las conservadoras por defecto. |
| `style` | `IDEE.style.*` | Estilo de la huella en 2D. Tambien se puede pasar en el segundo argumento (`{ style }`). |

Opciones `copc` por defecto:

| Opcion | Valor | Para que sirve |
|---|---|---|
| `autoFrame` | `false` | No mover la camara al terminar de cargar. |
| `maxPoints` | `2500000` | Presupuesto global de puntos de la vista. |
| `maxVisibleNodes` | `120` | Nodos del octree visibles a la vez. |
| `maxCacheNodes` | `150` | Nodos en cache. |
| `concurrency` | `5` | Peticiones `Range` en paralelo. |
| `debounceMs` | `120` | Espera antes de recalcular el LoD al mover la camara. |
| `pixelSize` | `2` | Tamano de punto en pixeles. |
| `sseThreshold` | `200` | Umbral de error de pantalla para bajar de nivel. |
| `colorMode` | `'rgb'` | Color de los puntos a partir del RGB del LAZ. |
| `opacity` | `1` | Opacidad inicial del data source. |

Las opciones son las de `copcesium`; consultar su documentacion para el resto (`pointSize`, filtros, etc.).

El ejemplo de Autzen (10,6 millones de puntos) carga 56 nodos y unos 2,1 millones de puntos a 600 m de altura, suficiente para que la nube se vea como una ortofoto y no como puntos sueltos.

### Presupuesto de puntos y efecto de "tesela nitida"

`maxPoints` es un tope **global** de la vista, no por nodo. El recorrido del octree elige primero los nodos con mayor error de pantalla (los mas cercanos a la camara), los subdivide y acumula sus puntos. Cuando se agota el presupuesto, deja de visitar el resto de la cola: el nodo cercano queda en un nivel de detalle alto y el resto se queda en niveles altos del arbol. Visualmente aparece **una zona nitida rodeada de puntos gruesos**, que es exactamente el sintoma de un presupuesto corto.

Medido en el visor de Autzen a 600 m:

| `maxPoints` | Nodos | Puntos | Resultado |
|---|---|---|---|
| `500000` | 17 | 500.779 | Una tesela nitida y el resto grueso. |
| `1000000` | 30 | 1.013.057 | La tesela nitida sigue siendo visible. |
| `2000000` | 54 | 2.012.706 | Nube uniforme. |
| `2500000` | 56 | 2.110.575 | Nube uniforme, sin recortar el ultimo nodo. |
| `5000000` | 56 | 2.110.575 | Igual que 2,5M: no hay mas nodos que visitar en esa vista. |

El visor de referencia de copcesium usa `maxPoints: 5e6`, `maxVisibleNodes: 100` y `sseThreshold: 250` por defecto. En esta capa se baja a 2,5M porque es el punto en el que la vista de 600 m ya sale completa; subir mas solo reserva memoria que no se usa. Si se quiere priorizar velocidad o memoria en movil, bajar `maxPoints` a 1M y aceptar algo menos de detalle; si se quiere explorar muy de cerca, 2,5M sigue dando margen porque al reducirse el area visible tambien bajan los nodos necesarios.

---

## Comportamiento

- **2D**: al arrancar se reproyecta el `bbox` de `EPSG:4326` a `EPSG:3857` y se anade a la propia capa Vector un unico poligono con la huella. La pagina avisa de que los puntos solo aparecen en 3D. Sin `bbox` no hay huella; la capa sigue existiendo pero no se puede encuadrar.
- **3D**: `setMap()`/`addTo()` reintentan el arranque hasta que `mapajs.getMapImpl()` devuelve un viewer con `scene`. Entonces se carga `copcesium` y se crea un `CopcDataSource` enganchado al viewer. No se anade ninguna entidad vectorial en 3D: los puntos ya dan la posicion y una entidad podria quedar mal proyectada.
- **Visibilidad**: `CopcDataSource` no tiene `setVisible` publico. Ocultar la capa pone `ds.opacity = 0`; volver a mostrarla restaura la opacidad guardada. Asi no se toca el LoD ni se destruyen los nodos cargados.
- **Opacidad**: `setOpacity(0..1)` se aplica a `ds.opacity` (y a la capa Vector en 2D). El selector de capas la conserva al cambiar de implementacion.
- **Zoom a la capa**: `getMaxExtent()` devuelve el `bbox` en `EPSG:4326` cuando el mapa es 3D y la huella en `EPSG:3857` cuando es 2D. El boton de zoom del selector funciona en ambos casos.
- **Estado de depuracion**: `capa.getCopcStats()` devuelve `url`, `nodeCount`, `maxDepth`, `cacheSize`, `stats` y el ultimo error, o `null` si aun no hay data source.
- **Borrado**: `mapajs.removeLayers(capa)` la quita del mapa y, al recibir el evento `REMOVED_LAYER`, destruye el `CopcDataSource` y sus primitivas (medido en 3D: la escena pasa de 6 primitivas a 1). Si se vuelve a anadir la misma instancia, arranca de nuevo y recarga los puntos. `capa.destroy()` sigue disponible para liberar el data source al descartar la capa sin quitarla del mapa.

En 3D el selector muestra la ficha de la capa, pero su tabla de atributos queda vacia: no hay features vectoriales, solo puntos en el viewer. En 2D la tabla contiene la huella.

---

## Instalacion y cambio 2D/3D

`copcLayer.js` no es un plugin: es un parche de arranque, como `pmtilesLayer` o `flatgeobufLayer`. Instala `IDEE.layer.COPC` en cuanto la API esta disponible, la reinstala cada 10 ms y al terminar de cargarse un bundle de la API. Hace falta porque el cambio 2D/3D recarga el bundle y `IDEE.layer.Vector` pasa a ser otra clase: la extension crea entonces una subclase nueva sobre la base nueva. El visualizador no cambia nada: sigue escribiendo `new IDEE.layer.COPC(...)`.

Ademas, el vendor se carga de forma perezosa y se vuelve a pedir si cambia la instancia de `window.Cesium`:

- La primera vez que hay 3D se descarga `copcesium.js`.
- Si se pasa 3D -> 2D -> 3D, la API recarga Cesium y el vendor viejo tendria clases del bundle anterior. `copcLayer` comprueba `window.copcesium.__cesium === window.Cesium`; si no coincide, vuelve a pedir el fichero con cache-busting (`?v=...`).
- La IIFE del vendor es imprescindible: sin ella, al ejecutar el script por segunda vez choca el `const e` de nivel superior (`Identifier 'e' has already been declared`).

---

## Vendor (`copcesium.js`)

- **Origen**: <https://cdn.jsdelivr.net/npm/copcesium@1.4.0/dist/copc-cesium.mjs>
- **Proyecto**: <https://github.com/connormanning/copcesium>
- **Version**: 1.4.0
- **Licencia**: MIT (copcesium). Las dependencias del bundle se detallan en `THIRD_PARTY_LICENSES.md`.

Transformacion local, sin tocar el codigo de la libreria:

1. El bundle ESM se envuelve en una IIFE para poder recargarlo cuando la API cambia de bundle 2D/3D.
2. `import * as e from "cesium";` se sustituye por un parametro `e` de la envoltura, alimentado con `window.Cesium`. La API-IDEE carga Cesium como global.
3. `export { Vs as CopcDataSource, Ds as WorkerPool };` se sustituye por `window.copcesium = { CopcDataSource: Vs, WorkerPool: Ds };`.
4. El resto del bundle se conserva byte a byte.

Al actualizar el vendor hay que repetir la transformacion y revisar `THIRD_PARTY_LICENSES.md`. El bundle original se puede descargar del CDN y comparar con la copia local.

---

## Ejemplo de la galeria

- Visor: `mapas/tiposDeCapas/capas/copc/index.html`.
- Datos: COPC publico de **Autzen** (Eugene, Oregon), 10,6 millones de puntos:
  <https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz>
- `bbox` en `EPSG:4326`: `[-123.075542, 44.049719, -123.061960, 44.062780]`.
- Centro en `EPSG:4326`: `{ x: -123.066412, y: 44.056302 }`.
- Centro en `EPSG:3857`: `{ x: -13699690.3666, y: 5474159.2597 }`.

El fondo IGN no cubre Oregon: en 2D se ve la huella sobre un fondo vacio y en 3D los puntos sobre el globo. Es intencionado; el ejemplo sirve para comprobar la lectura por `Range`, no para contextualizar la nube.

---

## Validacion

```bash
node --check ext/copcLayer/copcLayer.js
node --check ext/copcLayer/copcesium.js
node --check mapas/tiposDeCapas/capas/copc/js/mapa.js
```

Prueba manual con el servidor local:

```text
http://localhost:8765/mapas/tiposDeCapas/capas/copc/index.html
```

1. En 2D se ve la huella y la capa aparece en el selector.
2. Al pulsar el boton 2D/3D (`#APIIDEE-herramienta-button`) se cargan los puntos.
3. El ojo y el deslizador de transparencia afectan a `capa._copcDs.opacity`.
4. Al volver a 2D y otra vez a 3D, el vendor se recarga sin errores y los puntos vuelven a cargarse.
5. `mapajs.removeLayers(capa)` en 3D deja `capa._copcDs` a `null` y retira las primitivas; volver a anadir la misma instancia recarga los puntos.
