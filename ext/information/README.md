# Información del punto

Plugin local para API-IDEE/API-CNIG que consulta qué hay en el punto clicado. No tiene panel: es un único botón que se queda activado mientras la herramienta está en uso. Cada clic abre un popup con una vista por capa y, dentro de cada vista, tantos elementos como haya en ese punto. Si hay varias capas, un selector en la cabecera permite cambiar de capa sin scroll horizontal.

## Características

- **Botón circular**: 40x40, sin panel, con `color1` (fondo), `color2` (borde) y `color3` (icono). El icono es el SVG `img/iconos/icono-informacion.svg` (cursor con insignia de información, pack «Modern UI Icons» de SVG Repo), en línea para que herede `color3` por `currentColor`.
- **Cursor de consulta**: una cruz de precisión con insignia «i» (`img/iconos/cursor-informacion.svg`) y `help` como respaldo nativo.
- **WMS**: pide `GetCapabilities` y usa `GetFeatureInfo`. Si el servicio declara JSON y HTML, el popup permite alternar entre los dos sin volver a pinchar. Si no declara ninguno de los dos, se usan texto o XML como respaldo.
- **Bandas en WMS ráster**: si la respuesta de `GetFeatureInfo` es ráster (no trae features con geometría), se añade la pestaña `Bandas`. Muestra los canales **RGBA de la imagen renderizada** en el píxel pulsado, no el valor numérico de `GetFeatureInfo`. Para ello pide un `GetMap` de 3×3 píxeles centrado en el clic, con el mismo `BBOX` y resolución que la consulta, y lee el píxel central del PNG. La petición es perezosa: se lanza al activar la pestaña, no en el clic inicial de todas las capas. En capas WMS vectoriales no aparece, porque el píxel es el símbolo y no una banda.
- **Capas vectoriales**: lee los features que caen bajo el clic en 2D y, cuando la implementación los dibuja, también en 3D.
- **GeoTIFF**: lee los valores reales de las bandas en el punto. En 2D usa las imágenes que ya tiene abiertas el origen `GeoTIFF` de OpenLayers; en 3D usa el `LectorGeoTIFF` de `ext/geotiffLayer`. El valor se presenta como un elemento con una propiedad por banda y funciona con las plantillas `ficha`, `tabla` y `json`.
- **Capa base**: lee el color RGB(A) del píxel de la capa base (TMS, WMTS, XYZ, OSM o el grupo Híbrido). En 2D usa la tesela que pinta OpenLayers; en 3D el `imageryProvider` de Cesium. En los grupos se componen las hijas visibles de abajo arriba.
- **Sin información, sin capa en el popup**: se omite la capa si no devuelve features, si `GetFeatureInfo` responde vacío, si el GeoTIFF da un píxel transparente o todo nodata, o si la capa base es transparente en ese punto.
- **Orden de capas**: de mayor a menor z-index, para que la primera sea la capa que se ve arriba. La capa base se considera siempre el fondo y queda al final.
- **Varias capas y varios elementos**: todas las capas aparecen en el selector de la cabecera y todos los features (o los canales RGBA de la imagen WMS) del punto se listan dentro de la capa elegida.
- **Plantillas configurables**: `ficha`, `tabla` y `json` de serie; se pueden añadir o sustituir por constructor o con `registrarPlantilla()`.
- **`extract` sincronizado**: mientras el plugin está añadido al mapa, las capas vectoriales llevan `extract=false` si la herramienta está desactivada y `extract=true` si está activa. Las capas añadidas después se sincronizan con `ADDED_LAYER`/`ADDED_LAYERGROUP`; `destroy()` restaura el valor original.
- **Estado 2D/3D**: implementa `getState()`/`setState(state, map)` para conservar la activación, las preferencias por capa y el popup abierto al cambiar de implementación.

## Archivos

| Archivo | Descripción |
|---|---|
| `information.js` | Clase `miPlugin_information`: botón, consulta WMS/vectorial/GeoTIFF, canales RGBA de la imagen WMS, popup, plantillas, `extract` y contrato de estado. |
| `information.css` | Botón de 40x40, cursor de consulta, selector de capa del popup, fichas, tablas y salida JSON/HTML. |
| `../../img/iconos/icono-informacion.svg` | Icono del botón: cursor con insignia de información. Se copia en línea en el DOM para que tome `color3` por `currentColor`. |
| `../../img/iconos/cursor-informacion.svg` | Cursor de cruz con insignia «i». Los colores son fijos porque el navegador lo pinta como imagen de cursor. |

## Integración

```html
<link rel="stylesheet" href="../../../../ext/information/information.css">
<script src="../../../../ext/information/information.js"></script>
```

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_information({
  position: 'TL',
  order: 2,
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
}));
```

El plugin se expone como `IDEE.plugin.miPlugin_information`, `M.plugin.miPlugin_information` y `window.miPlugin_information`.

## Parámetros del constructor

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TL'` | Esquina de la barra de herramientas (`'TL'`, `'TR'`, `'BL'`, `'BR'`). |
| `order` | `number` | `2` | Orden dentro de la esquina. |
| `buttonTitle` | `string` | `'Consultar información del punto'` | `title` y `aria-label` del botón. |
| `color1` | `string \| Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Fondo del botón. |
| `color2` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Borde del botón. |
| `color3` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color del icono. |
| `plantillas` | `Array \| Object` | `[]` | Plantillas extra o que sustituyen a las de serie por `id`. |
| `plantillaPorDefecto` | `string` | `'ficha'` | Plantilla inicial. |
| `mostrarVacios` | `boolean` | `false` | Muestra los campos vacíos en las plantillas. |
| `camposOcultos` | `Array<string>` | `[]` | Campos que no se listan. |
| `etiquetas` | `Object` | `{}` | Mapa `campo -> etiqueta visible`. |
| `maxFeatures` | `number` | `10` | `FEATURE_COUNT` de `GetFeatureInfo`. |
| `buffer` | `number` | `5` | Tolerancia en píxeles de la consulta. |
| `titulo` | `string` | `'Información'` | Título de las pestañas de aviso y de carga. |
| `activo` | `boolean` | `false` | Arranca con la herramienta activada. |
| `debug` | `boolean` | `false` | Muestra errores de consulta por consola. |

## Plantillas

Una plantilla es un objeto `{ id, nombre, descripcion, render(elemento, contexto) }`. `render` devuelve HTML (o un nodo con `outerHTML`). Las tres plantillas de serie son `ficha`, `tabla` y `json`.

`elemento` contiene:

- `propiedades`: objeto con los campos originales.
- `campos`: array de `{ clave, etiqueta, valor, texto }` ya filtrado por `camposOcultos` y `mostrarVacios`.
- `titulo`: nombre legible del elemento.
- `id`: identificador del feature, si lo tiene.
- `geometria`: `{ tipo, coordenadas }` o `{ tipo }` cuando la implementación 3D no expone las coordenadas; en los GeoTIFF es `null` y el punto queda solo en `crudo`.
- `crudo`: feature GeoJSON original, si está disponible.
- `fuente`: `'wms'`, `'vector'` o `'raster'`.
- `capa`: `{ name, legend, type, idLayer }`.

En los GeoTIFF, `propiedades` y `campos` contienen una entrada por banda (`Banda 1`, `Banda 2`, …) con el valor real leído en el píxel. `crudo` es un `Feature` sintético con esas propiedades, el `SRC`, el píxel y el tamaño de la imagen.

En WMS ráster, la pestaña `Bandas` construye un elemento `Canales de la imagen` con las propiedades `R`, `G`, `B`, `A` y `Hex`, y `fuente: 'wms'`. Los cuatro canales son los del PNG que el servicio pinta en ese punto; `A` puede ser `0` si el píxel es transparente. El valor numérico de origen (`GRAY_INDEX`, `value_0`…) sigue disponible en las pestañas `JSON` y `HTML` de `GetFeatureInfo`.

`contexto` ofrece:

- `escapar(texto)`: escapa HTML.
- `texto(valor)`: convierte un valor a texto legible.
- `etiqueta(clave)`: etiqueta configurada o nombre humanizado.
- `campo(clave)`: valor de un campo concreto.
- `json()`: JSON formateado del elemento.
- `indice`, `total`, `capa`, `formato`, `plantilla` y `plugin`.

Ejemplo de plantilla propia:

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_information({
  plantillas: [{
    id: 'compacta',
    nombre: 'Compacta',
    descripcion: 'Solo el nombre del elemento.',
    render: function (elemento, ctx) {
      return '<p class="mi-compacta">' + ctx.escapar(elemento.titulo) + '</p>';
    },
  }],
}));
```

También se puede añadir en caliente:

```js
const info = mapajs.getPlugins().find((p) => p.name === 'miPlugin_information');
info.registrarPlantilla({
  id: 'solo-json',
  nombre: 'Solo JSON',
  render: function (elemento, ctx) {
    return '<pre>' + ctx.escapar(ctx.json()) + '</pre>';
  },
});
```

## Capas consultables

- `WMS` mediante `GetFeatureInfo`. Si la respuesta es ráster, se añade la pestaña `Bandas` con los canales RGBA de la imagen WMS; si trae features vectoriales, se muestran sus atributos y no se ofrece `Bandas`.
- La **capa base** (TMS, WMTS, XYZ, OSM, MBTiles ráster o un grupo como Híbrido) leyendo el color RGB(A) del píxel. Si el color tiene alfa 0 o la tesela no se puede leer, no se añade la capa al popup.
- `GeoTIFF` leyendo las bandas del fichero en el píxel del clic. La lectura usa la transformación afín completa (`ModelTransformation`), no solo el origen y la resolución, para no desviar el píxel en los GeoTIFF rotados.
- `GeoJSON`, `Vector`, `KML`, `WFS`, `OGCAPIFeatures`, `MVT`, `MBTilesVector`, `MapLibre`, `GenericVector` y `WKT` como capas vectoriales.

En 3D la consulta vectorial depende de que la implementación dibuje la capa y de que sus entidades estén en la posición correcta. `MVT`, por ejemplo, no se dibuja en Cesium en esta versión de la API y el popup mostrará que no hay información. La ficha `mapas/tiposDeCapas/capas/vector` declara sus geometrías en EPSG:3857; Cesium las interpreta como grados, así que en 3D la capa no está en Madrid y la consulta no encuentra esos elementos. Es una limitación de esa ficha/API, no del plugin.

Los servicios de teselas (`TMS`, `WMTS`, `XYZ`, `OSM`) no permiten pedir una imagen concreta de una capa en un punto, así que no ofrecen la pestaña `Bandas`. En WMS sí: la pestaña lee los canales RGBA de la imagen que el servicio renderiza en el píxel pulsado, no el color compuesto de la pantalla. El valor numérico de origen, si el servicio lo publica, sigue en `GetFeatureInfo` (JSON/HTML). La lectura de la imagen necesita CORS en el `GetMap`, igual que `GetFeatureInfo`.

### `extract` y popups de la API

La API abre su propio popup cuando pincha una capa vectorial con `extract=true`. El plugin sincroniza esa propiedad para que el comportamiento sea el esperado:

- plugin **desactivado** → `extract=false` en todas las capas vectoriales; el clic no abre nada.
- plugin **activado** → `extract=true`; la API sigue extrayendo y el plugin retira el popup de la API para dejar el suyo.
- capas añadidas después → se sincronizan con `ADDED_LAYER` y `ADDED_LAYERGROUP`.
- `destroy()` → devuelve a cada capa el `extract` que tenía antes de entrar el plugin.

La consulta propia del plugin no usa `extract`: lee los features por su cuenta, así que sigue funcionando con `extract=false`.

## Estado 2D/3D

`getState()` devuelve:

```js
{
  activo: boolean,
  preferencias: {
    'legend|name': { formato: 'json' | 'html' | 'bandas' | 'vector', plantilla: 'ficha' }
  },
  popupAbierto: boolean,
  ultimoPunto: { lon, lat, altura },
  tabActiva: number
}
```

`setState(state, map)` reactiva el botón, recupera las preferencias por capa y reabre el popup en el último punto cuando el mapa nuevo termina de colocarse. Las preferencias se guardan por `legend|name`, nunca por `idLayer`, porque los identificadores de capa cambian al recrear el mapa.

## Notas

- El servicio WMS debe permitir CORS para que el navegador pueda leer `GetCapabilities`, `GetFeatureInfo` y la imagen `GetMap` de la pestaña `Bandas` (se lee con `<img crossorigin="anonymous">` y canvas).
- Si no se pueden leer las capacidades, el plugin prueba JSON y HTML, que son las salidas más habituales.
- La API abre su propio popup al pinchar capas vectoriales con `extract=true`. El plugin sincroniza `extract` (false con la herramienta apagada) y, cuando está activo, retira los popups nuevos de ese clic y conserva el suyo.
