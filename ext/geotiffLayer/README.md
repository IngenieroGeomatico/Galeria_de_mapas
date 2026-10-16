# 🧩 GeoTIFF (miPlugin_geotiffLayer)

> Da soporte 3D a `IDEE.layer.GeoTIFF`, que en el bundle de Cesium está declarada pero sin implementación.

Plugin sin interfaz que hace que `new IDEE.layer.GeoTIFF({...})` funcione igual en 2D y en 3D. Incluye el lector (`LectorGeoTIFF`, sin dependencias de Cesium): abre el fichero (en memoria o por URL), lee su extensión y sus claves GeoTIFF, elige el escalón de la pirámide y lo pinta en un canvas. En Cesium lo dibuja con un `SingleTileImageryProvider` sobre el `Rectangle` que ocupa la imagen, que es el «clamp to ground» de un fichero suelto. En 2D no hace nada: ahí lo dibuja OpenLayers con `ol.source.GeoTIFF`.

## ✨ Características

- **Fachada propia para `IDEE.layer.GeoTIFF`**, registrada solo cuando la implementación activa es Cesium (`IDEE.impl.cesium`). En 2D la clase del bundle se deja intacta.
- **Hereda de la base de capas y de la implementación de `Vector` de Cesium**, no de la fachada `GeoTIFF` rota: su constructor lanza `throw IDEE.exception.geoTIFFlayer_method` y esa clave no existe en el bundle de Cesium, así que el error real es el string `"undefined"` con cualquier número de argumentos.
- **Instalación vigilada**: se sondea cada 100 ms hasta 30 intentos (~3 s), porque el bundle de Cesium reemplaza `window.IDEE` al terminar de cargar y la clase puesta antes se pierde.
- **`window.geotiffLayerCuandoInstalado(timeout)`**, la promesa que evita la carrera: si el visualizador crea la capa antes de que la fachada esté puesta, `new IDEE.layer.GeoTIFF(...)` sigue siendo la del bundle y lanza.
- **Lectura por URL con rangos**: desde una URL usa `fromUrl` de geotiff.js, que pide solo los trozos que necesita (64 KB para la cabecera) en vez de bajarse el fichero entero; desde un `Blob`, `fromArrayBuffer`. Medido sobre un COG de Sentinel-2 de 112 MB: unos pocos MB por URL frente a los 117 MB de bajarlo todo.
- **Selección del escalón de la pirámide**: geotiff.js no tiene `getOverview(n)`, cada escalón es una imagen más (`tif.getImage(n)`). Se elige el más bajo que aún cubra el tamaño del lienzo; medido sobre ese COG: 1,43 MB en 9 peticiones y 2,2 s frente a 82,05 MB en 242 peticiones y 53,5 s, con un dibujo indistinguible.
- **Estirado de rango a 0-255 por banda** (como `gdal_translate -scale`): sin él un GeoTIFF de 16 bits con valores 0-40000 sale casi negro.
- **Reproyección de la extensión** con fórmula cerrada para `4326` y `3857`/`900913`/`102100`/`3785`, y con `IDEE.utils.reproject` para cualquier otro SRC.
- **Techo de lienzo de 2048 px** (`LADO_MAXIMO`), el mismo tamaño que usa el visualizador en su `gdal_translate -outsize 2048 0`, para que las dos implementaciones se vean igual de nítidas.
- **Caché de las 3 últimas imágenes** por identidad del fichero (el propio `Blob` o la URL), con expulsión de la más vieja.
- **Contrato de estado 2D/3D** (`getState`/`setState`): sin UI que rehidratar; la instalación se vuelve a hacer en cada `addTo`.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `geotiffLayer.js` | Todo el plugin: la fachada de la capa, la implementación (`GeoTIFFImplRaster`), el lector (`LectorGeoTIFF`) y el dibujado en Cesium (`RenderGeoTIFF`). Expone `window.miPlugin_geotiffLayer`, `window.LectorGeoTIFF` y `window.geotiffLayerCuandoInstalado`. |

No hay hoja de estilos: el plugin no tiene interfaz.

## 🔧 Integración en un visualizador

```html
<script type="text/javascript" src="../../ext/geotiffLayer/geotiffLayer.js"></script>
```

No hace falta declarar ninguna dependencia: el plugin se trae geotiff.js con una importación dinámica a URL absoluta, así que no necesita `import map`.

## ⚙️ Parámetros de construcción

### El plugin

`new IDEE.plugin.miPlugin_geotiffLayer(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `options` | `Object` | `{}` | **No se lee ninguna propiedad**: se guarda en `this.options` y nada más. La configuración va en la capa, no aquí. |

### La clase de capa

`new IDEE.layer.GeoTIFF(parameters)` — las mismas claves que en 2D.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `name` | `string` | — | Nombre de la capa (la clave del servicio en el caso de un WMS). |
| `legend` | `string` | — | Nombre que se ve en el selector de capas. |
| `blob` | `Blob` | — | Fichero en memoria. Se lee con `fromArrayBuffer` (el fichero entero). |
| `url` | `string` | — | URL del fichero. Se lee con `fromUrl`, por rangos (lo que hace útil a un COG). |
| `minZoom` | `number` | `undefined` | Se copia a la fachada (`this.minZoom`). No lo usa el dibujado. |
| `maxZoom` | `number` | `undefined` | Se copia a la fachada (`this.maxZoom`). No lo usa el dibujado. |

> Si no hay ni `blob` ni `url`, el lector lanza `'El GeoTIFF no tiene ni blob ni url'`. Sin `bbox`, lanza `'El GeoTIFF no trae georreferenciación (sin bbox)'`.
>
> El campo `type` se deja como viene (normalmente `undefined`) **a propósito**: la base valida el tipo contra los tipos que declara la API y en el bundle de Cesium `'GeoTIFF'` no está, así que forzarlo deja la capa sin crear.

### El lector (`window.LectorGeoTIFF`)

`new LectorGeoTIFF({blob, url, ladoMaximo})`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `blob` | `Blob` | `null` | Fichero en memoria. |
| `url` | `string` | `null` | URL del fichero. |
| `ladoMaximo` | `number` | `2048` (`LADO_MAXIMO`) | Techo del lado mayor del lienzo. Es un techo, no un destino: un GeoTIFF de 20000x20000 se pinta en 2048 y se escala. |

## 🚀 Ejemplo de uso

Igual en 2D y en 3D (`mapas/GDAL_JS/js/drag&Drop.js`):

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_geotiffLayer());

// Esperar a que la fachada esté registrada antes de crear la capa (solo 3D).
// El plugin tarda hasta ~3 s en instalarse porque el bundle de Cesium reemplaza
// window.IDEE al cargar. Sin la espera, unas veces funciona y otras no.
if (typeof window.geotiffLayerCuandoInstalado === 'function') {
  await window.geotiffLayerCuandoInstalado();
}

const capaGeoTIFF = new IDEE.layer.GeoTIFF({
  name: item.name,
  legend: item.legend || item.name,
  blob: item.blobFile,
});
mapajs.addLayers(capaGeoTIFF);
```

Desde una URL (COG):

```js
const capa = new IDEE.layer.GeoTIFF({
  name: 'Escena Sentinel-2',
  legend: 'Escena Sentinel-2',
  url: 'https://bucket.s3.amazonaws.com/ruta/escena.tif'
});
mapajs.addLayers(capa);
```

## 🧩 Métodos públicos

### Del plugin

| Método | Descripción |
|---|---|
| `addTo(map)` | Guarda el mapa e instala la fachada (`_instalar()`). |
| `cuandoInstalado(timeout)` | `Promise<boolean>`. Con `timeout` por defecto `5000` ms. Comprueba cada 50 ms si `IDEE.layer.GeoTIFF === this._fachada`. |
| `getHelp()` | `{ title: 'GeoTIFF en 3D', content: Promise<html> }`. |
| `destroy()` | Suelta la referencia al mapa. |
| `getState()` / `setState(state, map)` | Contrato de estado: `{}` y reinstalación. |

### De la implementación (capa 3D)

| Método | Descripción |
|---|---|
| `refrescarGeoTIFF()` | Vuelve a leer y repintar. **El nombre no es `refresh` a propósito**: la clase base ya tiene un `refresh()` propio, que taparía al nuestro y la capa no se pintaría nunca. |
| `addTo(map)` / `destroy()` | Montan y desmontan el renderizador. |
| `setVisible(visible)` / `isVisible()` | Visibilidad de la capa de imágenes en Cesium (`imageryLayer.show`). |
| `getBoundingBox()` | Extensión en lon/lat del fichero, `[oeste, sur, este, norte]`, una vez leído (o `null`). |

### De la fachada

| Método | Descripción |
|---|---|
| `getImplGeoTIFF()` | La implementación, para iterar desde la consola. |
| `getFeatures()` / `getFeatureById()` | `[]` (es una capa ráster, no tiene entidades). |
| `getGeometryType()` | `null`. |

### Del lector

| Método | Descripción |
|---|---|
| `leer()` | `Promise<{canvas, rectangulo: [[o,s],[e,n]], ancho, alto, epsg, origen, escalonUsado, escalonesTotales, lienzo}>`. `origen` es `'blob'` o `'url'`. Cachea las 3 últimas imágenes. |

### Del renderizador (interno)

| Método | Descripción |
|---|---|
| `refrescar()` | Quita la capa anterior, lee el fichero, crea el `SingleTileImageryProvider` y lo añade a `scene.imageryLayers`. Aplica `impl.opacity` a `imageryLayer.alpha` y llama a `impl.onCargada(salida)` si existe. |
| `setVisible(visible)` / `isVisible()` | Visibilidad. |
| `diagnostico()` | `{hayEscena, hayCapa, visible, cargando, rectangulo, lienzo, error}`. Para depurar desde la consola. |
| `destroy()` | Quita la capa de imágenes y suelta las referencias. |

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{}`. El plugin no tiene UI que rehidratar. |
| `setState(state, map)` | Guarda el mapa si llega y llama a `_instalar()`. |

## ✅ Notas y limitaciones

- **Solo actúa en 3D**: la instalación exige `IDEE.impl.cesium`, `IDEE.layer` e `IDEE.impl.layer`. Si el bundle no trae `IDEE.impl.layer.GeoTIFF`, la fachada se registra (`!IDEE.impl.layer.GeoTIFF` es la condición que evita pisar una implementación buena).
- **Un COG necesita CORS y peticiones por rango**. En un bucket sin `Access-Control-Allow-Origin` no se puede leer desde el navegador de ninguna manera: el `fetch` se para en el CORS.
- **`tileWidth` y `tileHeight` son obligatorios** en el `SingleTileImageryProvider` del Cesium del bundle (1.134 de la API): sin ellos el constructor lanza `"Expected options.tileWidth to be typeof number…"`.
- **Un `SingleTileImageryProvider` y no una cuadrícula**: de los proveedores de imagen del bundle no están ni `GeoTIFFImageryProvider`, ni `ImageCanvasImageryProvider`, ni `CanvasImageryProvider`, ni `TiledImageryProvider`. Y es lo que corresponde: un GeoTIFF es un fichero único con extensión fija, no un servicio teselable.
- **La opacidad va por la capa de la API**, no por el proveedor: el `SingleTileImageryProvider` no lleva alpha, así que se aplica sobre `imageryLayer.alpha`.
- **Un fichero que no se puede pintar en 3D no es un fallo del visualizador**: se avisa por consola (`geotiffLayer: no se pudo pintar el GeoTIFF en 3D`) y se sigue, con el motivo en `render.diagnostico().error`.
- **Las dos esquinas se reproyectan por separado**, que es lo correcto: en Web Mercator las líneas de longitud constante se curvan, así que reproyectar solo el centro y aplicar la mitad del ancho por los lados daría error.
- `destroy()` es obligatorio para el protocolo de plugins de la API, aunque aquí solo suelte el mapa.
