# 🗺️ MapLibre (maplibreLayer)

> Da soporte 3D a `IDEE.layer.MapLibre`, que en el bundle de Cesium está declarada pero sin implementación.

Parche de arranque sin interfaz: sustituye `IDEE.layer.MapLibre` por una fachada propia que hereda de la **misma** clase base que la del bundle y le pasa una implementación que sí pinta. En 3D esa implementación monta un `maplibregl.Map` en un div absoluto sobre el canvas del globo y lo deja sincronizado con la cámara en `scene.postRender`, que es el equivalente del `renderFrame` que usa OpenLayers. En 2D no se toca nada: ahí la capa la implementa la propia API.

## ✨ Características

- **Misma solución que OpenLayers, medida en `apiidee-1.1.0.ol.min.js`**: OL no mete las teselas en una capa de OL, monta un `maplibregl.Map` propio con `interactive: false`, `attributionControl: false` y `trackResize: false`, y en cada frame hace `jumpTo({center, zoom: zoomOL - 1, bearing: -rotation})` (el `-1` es porque MapLibre cuenta con teselas de 512 px y OL con 256). Aquí se hace lo mismo, pero el mapa de fuera es Cesium.
- **El porqué de la fachada**: el constructor de `IDEE.layer.MapLibre` pide su implementación al módulo de webpack `6149`, que en `apiidee.cesium.min.js` es `()=>{}`, un stub vacío (por eso el bundle avisa «La implementación usada no puede crear capas MapLibre»). Registrar la clase en `IDEE.impl.layer` o en `M.layer` no arregla nada, porque `__webpack_require__` no se expone en la ventana. Tampoco vale heredar de la fachada del bundle: su constructor siempre pide el módulo vacío.
- **El tipo `MapLibre` hay que enrutarlo**: `IDEE.impl.Map.addLayers` solo tiene rama para WMS, WMTS, KML, WFS, OGCAPIFeatures, MBTiles, XYZ, TMS, Tiles3D y Terrain; para el resto hace `know(tipo) || addUnknowLayers_(...)`, y `MapLibre` está en la lista de `know` **sin rama**, así que la capa se ignora en silencio (medido: no aparece en `getLayers()`, no se llama a su `addTo`). El parche mete esas capas por la vía de las no clasificadas (`addUnknowLayers_` + `facadeMap_.addUnknowLayers_`), las saca igual en `removeLayers` (`removeUnknowLayers_`, que sí llama a `destroy()`) y las incluye en `getUnknowLayers_` para que salgan en `getLayers()`.
- **La librería se trae sola**: MapLibre GL JS **no** va en el bundle de Cesium (medido: de `maplibre` solo queda el nombre de la clase `maplibregl-canvas` en un helper de impresión), así que se carga de jsDelivr (`maplibre-gl@5.24.0`, js + css) la primera vez que se añade una capa, con una promesa compartida y reintento si el CDN falla.
- **Sincronización medida**: 0-1 px en vista vertical, 0-2 px girando 40° y 0-1 px con 52° de inclinación, en puntos de hasta 7 km del centro. Se mide comparando `map.project()` con `Cesium.SceneTransforms.worldToWindowCoordinates()` **sobre el MDT** (`globe.getHeight`): si se compara a altura 0 aparece un 3,4 % de error de escala que es pura paralaje (el terreno de Madrid está a ~650 m).
- **Sin coste cuando no hace falta**: el trabajo pesado (tres rayos contra el terreno) solo se hace si la cámara se ha movido; el resto de frames se sale con una comparación de posición/rumbo/inclinación.
- **`disableBackgroundColor` como en 2D**: pone la capa `background` del estilo en `transparent` (true) o `#f2f2f2` (false). Si el estilo no tiene capa de fondo no se hace nada; medido: el estilo de BTN Completa no la tiene (0 de 337), y en 2D eso le revienta a la implementación de OpenLayers, que hace `.find(...).id` sin comprobar el resultado.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `maplibreLayer.js` | Todo el parche: la carga de la librería, la implementación (`MapLibreImplCesium`), la fachada (`FachadaMapLibre`), el enrutado del tipo en el impl del mapa y la instalación. Expone `window.maplibreLayer`. |

No hay hoja de estilos: el overlay no tiene interfaz (el CSS que necesita MapLibre lo carga la propia librería).

## 🔧 Integración

No se añade como plugin: es un parche de arranque y lo carga `cambioImpl` en `EXTENSIONES_CAPAS_3D` **antes** de recargar el bundle, porque puede haber capas `MapLibre` creadas dentro de `mapa()` (las base y las rápidas se resuelven ahí).

```
{ ruta: 'maplibreLayer/maplibreLayer.js' }
```

La instalación es idempotente: se intenta al cargar el script, cada 10 ms mientras la build de Cesium no exista y al terminar de ejecutarse el `<script>` de la build (el cambio 2D/3D la reemplaza y `window.IDEE` es un objeto nuevo). En 2D no se toca nada (`IDEE.impl.cesium` tiene que existir).

## ⚙️ Parámetros de la capa

`new IDEE.layer.MapLibre(parameters, options, vendorOptions)` — las mismas claves que en 2D.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | `string` | — | URL del estilo. Ejemplo medido: `https://vt-btn.idee.es/files/styles/BTN_Completa.json`. |
| `maplibrestyle` | `string\|Object` | — | Estilo ya resuelto (tiene prioridad sobre `url`). |
| `style` | `string` | — | Estilo serializado en base64 (enlaces compartidos); se decodifica y se usa como estilo. |
| `name` / `legend` | `string` | — | Nombre del servicio y nombre visible en el selector. |
| `extract` | `boolean` | `true` | Extracción de atributos. |
| `visible` | `boolean` | `true` | Visibilidad inicial (clave propia de la API; la base de Cesium mira `visibility`, se respetan las dos). |
| `options.disableBackgroundColor` | `boolean` | `undefined` | `true` deja el fondo transparente (pinta sobre el mapa de Cesium), `false` lo pone opaco (funciona como capa base). |
| `vendorOptions.mapLibreOptions` | `Object` | `{}` | Opciones que se pasan tal cual a `maplibregl.Map`; su `style` tiene prioridad sobre todo lo demás. |

## 🧩 Métodos públicos

### De la fachada

| Método | Descripción |
|---|---|
| `getMapLibreStyleFromId(ids)` | Capas del estilo (todas, o las de `ids`). |
| `setPaintProperty(capa, propiedad, valor)` / `setLayoutProperty(...)` | Atajos a `maplibregl.Map`. |
| `setMapLibreStyleFromId(lista)` | `[{id, paint: [{property, value}], layout: [...]}]`. |
| `setStyleMap(estilo)` / `set url` / `set maplibrestyle` | Cambian el estilo (`setStyle`); el fondo se reaplica en `style.load`. |
| `getProjection()` | `EPSG:3857` (el que declara la capa). |
| `getFeatures()` / `getFeatureById(id)` | Entidades de MapLibre (`queryRenderedFeatures`), no de la API. |
| `getGeometryType()` | `null`. |
| `equals(otra)` | Compara `url`, `name`, `idLayer` y `template`. |

### De la implementación (capa 3D)

| Método | Descripción |
|---|---|
| `addTo(map)` / `destroy()` | Crean y desmontan el overlay (MapLibre, div, escucha de `postRender`). |
| `setVisible(visible)` / `isVisible()` | `display` del overlay. |
| `setOpacity(op)` / `getOpacity()` | `opacity` del canvas de MapLibre. |
| `getUnknowLayers_` / `addLayers` / `removeLayers` | Parcheados en el impl del mapa (ver «Características»). |

## 🚀 Ejemplo de uso

```js
// La capa rápida del catálogo de la API ya la usa: QUICK*BTN_Completa_MapLibre.
mapajs.addLayers(['QUICK*BTN_Completa_MapLibre']);

// O a mano, con la misma definición que en 2D:
const btn = new IDEE.layer.MapLibre({
  url: 'https://vt-btn.idee.es/files/styles/BTN_Completa.json',
  name: 'BTN_Completa',
  legend: 'BTN Completa',
  extract: true
}, { disableBackgroundColor: false });
mapajs.addLayers([btn]);

btn.setOpacity(0.6);
btn.setVisible(false);
mapajs.removeLayers([btn]);   // quita el overlay y destruye el mapa de MapLibre
```

Desde la consola: `window.maplibreLayer.fachada()` devuelve la fachada instalada y `window.maplibreLayer.cargar()` la promesa de la librería.

## ✅ Notas y limitaciones

- **No drapea sobre el MDT**: el overlay es un mapa plano pintado por encima del terreno. Es el precio de usar el mismo enfoque que OpenLayers; una capa vectorial 3D de verdad exigiría teselar y proyectar a mano.
- **No atiende clics** (`interactive: false`, igual que en OL) y el div lleva `pointer-events: none`: Cesium sigue recibiendo clic, rueda y arrastre. El overlay va dentro del contenedor del widget de Cesium, así que un clic sobre el mapa llega al globo aunque esté pintado encima.
- **Una capa = un `maplibregl.Map`**, con su propia descarga y decodificación de teselas. Dos capas MapLibre son dos mapas de MapLibre; en 2D pasa lo mismo.
- **El overlay tapa visualmente lo que Cesium dibuje encima del terreno** (entidades, rásters) allí donde el estilo pinte. Al ser transparente por defecto solo se nota con estilos con fondo opaco.
- **El orden lo da el DOM**: la capa añadida después queda encima. `setZIndex` se guarda pero no se usa, porque el overlay no vive en `imageryLayers`.
