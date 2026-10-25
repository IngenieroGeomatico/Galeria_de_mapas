# ext/flatgeobufLayer (capas FlatGeobuf en 2D y 3D)

Extension que anade soporte para ficheros **FlatGeobuf** (`.fgb`) al visualizador como una capa vectorial nativa: `IDEE.layer.FlatGeobuf`. El formato no viene en el bundle de la API-IDEE (ni en OpenLayers ni en Cesium), asi que la extension aporta el lector (`flatgeobuf-geojson`, vendorizado en esta carpeta) y una clase que hereda de `IDEE.layer.GeoJSON` para pintar en las dos implementaciones.

La capa funciona **teselada desde el arranque**: al anadirla al mapa solo se piden las features del **bbox visible** mediante peticiones HTTP `Range` (aprovechando el indice espacial del `.fgb`). El fichero completo solo se descarga cuando se pide el modo **«Todas»** en el panel de la capa (lo aporta `ext/bboxFeatures`).

---

## Archivos

| Archivo | Descripcion |
|---|---|
| `flatgeobuf-geojson.min.js` | Lector vendorizado de FlatGeobuf 4.6.1 (UMD, incluye flatbuffers). Licencia BSD-3-Clause (flatgeobuf) + Apache-2.0 (flatbuffers). Lleva **un parche**: `_extraRequestThreshold` de 256 KB a 32 KB (ver nota al final). |
| `flatgeobufLayer.js` | Unico JS de la extension: instala `IDEE.layer.FlatGeobuf` (subclase de `IDEE.layer.GeoJSON`), carga el lector y expone los ayudantes `window.flatgeobufLayer` / `window.miFlatGeobuf`. |
| `README.md` | Este documento. |

El lector **no** se incluye con un `<script>` en el visualizador: `flatgeobufLayer.js` lo descarga en paralelo desde su misma carpeta al cargarse.

---

## Uso

En el `index.html` del visualizador basta un unico script:

```html
<script src="../../../../ext/flatgeobufLayer/flatgeobufLayer.js"></script>
```

En `js/mapa.js` se usa como cualquier capa de la API:

```js
const capa = new IDEE.layer.FlatGeobuf({
  url: '../../../../datos/Madrid_barrios.fgb',
  name: 'Barrios de Madrid',
  legend: 'Barrios de Madrid (FlatGeobuf)',
  // CRS en el que estan las coordenadas del .fgb. Por defecto EPSG:3857.
  crs: 'EPSG:3857',
}, {
  style: new IDEE.style.Generic({
    polygon: {
      fill: { color: '#5eead4', opacity: 0.35 },
      stroke: { color: '#0f766e', width: 2 },
    },
  }),
});

mapajs.addLayers(capa); // la carga inicial (bbox de la vista) la hace la capa en addTo
```

`mapajs.addLayers(capa)` no devuelve una promesa: la capa se crea al instante con `source` vacio y `addTo` dispara la primera carga por bbox. A partir de ahi la capa se refresca sola con el bbox visible (en 3D al terminar de mover la camara).

Tambien se puede llamar a `window.flatgeobufLayer.crearCapa(url, opciones)` para crear la capa sin anadirla, a `anadirCapa(mapajs, url, opciones)` para crear y anadir en un paso, o a `cargar(url)` / `cargarBbox(url, rect, crs)` para obtener solo el `FeatureCollection`. `window.miFlatGeobuf` es un alias del mismo objeto que consume `ext/bboxFeatures`.

### bboxFeatures

`ext/bboxFeatures` aporta el panel «Todas / La vista» y refresca el bbox al mover el mapa en 2D. Se carga desde el `js/mapa.js` de la capa, no desde el `index.html`:

```js
cargarBboxFeatures().then(function () {
  mapa();
});
```

`cargarBboxFeatures()` vive en `mapas/tiposDeCapas/js/comun.js` y pide `ext/bboxFeatures/bboxFeatures.js` una sola vez. Despues, en `mapa()`:

```js
anadirPluginsTipos(mapajs, mapa, { bboxFeatures: true });
```

Sin `bboxFeatures` la capa sigue funcionando, pero solo con la carga inicial por vista (no se refresca al mover el mapa en 2D ni aparece el boton «Todas»).

---

## Comportamiento

- **Teselado por defecto («La vista»)**: la capa guarda su modo (`_fgbModo`) y el ultimo bbox cargado (`_fgbBbox`). La recarga se hace con `_recargar(modo, map, forzar)`, que es idempotente: si el modo y el bbox no cambian, no pide nada.
- **2D**: al moverse el mapa, `ext/bboxFeatures` recalcula el bbox y llama a `capa._recargar('vista', map, false)`.
- **3D**: ademas, la propia capa escucha `camera.moveEnd` de Cesium (con un reintento hasta que la escena esta lista) y recarga el bbox. En ambos casos el bbox se convierte de la proyeccion del mapa (`EPSG:3857` en OpenLayers, lon/lat en Cesium) a la CRS del fichero.
- **«Todas»**: descarga el fichero completo (una sola peticion) y lo deja cargado. Volver a «La vista» recarga solo el bbox. El selector lo pinta `ext/bboxFeatures` en la ficha de la capa; la capa solo expone `_recargar`.
- **Servidores sin `Range`**: `flatgeobuf.deserialize(url, {rect})` descarga lo que pueda pero sigue filtrando por bbox, asi que el resultado es correcto (solo menos eficiente). Con `Range` se piden unicamente las porciones necesarias del indice y de las features.
- **CRS**: el lector devuelve las coordenadas tal cual estan en el fichero. La capa las reproyecta a `EPSG:4326` antes de pasarlas como `source` (la API espera lon/lat). El CRS de origen se indica con la opcion `crs`; si no se indica se asume `EPSG:3857`. Conviene indicarlo siempre: el `.fgb` puede no llevar CRS en la cabecera y entonces no se puede deducir.
- **Formato**: la capa resultante es una `IDEE.layer.FlatGeobuf` (subclase de `IDEE.layer.GeoJSON`), por lo que hereda estilo, tabla de atributos, informacion del punto y compatibilidad con el cambio 2D/3D. Se marca con `_flatgeobuf = true` para que `ext/bboxFeatures` la reconozca.

---

## Instalacion y cambio 2D/3D

`flatgeobufLayer.js` no es un plugin: es un parche de arranque, como `maplibreLayer`. Instala `IDEE.layer.FlatGeobuf` en cuanto la API esta disponible y la reinstala cada 10 ms (y al terminar de cargarse un bundle de la API). Hace falta porque el cambio 2D/3D recarga el bundle y `IDEE.layer.GeoJSON` pasa a ser otra clase: la extension crea entonces una subclase nueva sobre la base nueva. El visualizador no cambia nada: sigue escribiendo `new IDEE.layer.FlatGeobuf(...)`.

---

## Nota sobre el parche del vendor

El lector de FlatGeobuf agrupa las features que va a leer y, si el hueco entre dos consecutivas es menor que `Config.extraRequestThreshold`, las lee en un solo rango continuo (de la primera a la ultima). El valor por defecto es **256 KB**, que en ficheros pequenos hace que cualquier bbox acabe leyendo casi todo el fichero. Se ha bajado a **32 KB** para que el teselado sea efectivo en ficheros de decenas o cientos de KB a costa de unas pocas peticiones `Range` mas. El cambio es una sola constante en el minificado:

```
_extraRequestThreshold=262144  ->  _extraRequestThreshold=32768
```

Al actualizar el vendor hay que volver a aplicar el parche.

---

## Licencias del vendor

- `flatgeobuf`: BSD-3-Clause.
- `flatbuffers`: Apache-2.0.
