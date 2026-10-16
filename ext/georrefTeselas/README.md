# 🧩 Georreferenciador de teselas (miPlugin_georrefTeselas)

> Dibuja en el mapa la rejilla de una tesela TMS, XYZ o H3 a partir de sus índices.

Plugin con panel que convierte los índices de una tesela (`z/x/y` de una TMS o una XYZ, o el identificador de una celda H3) en GeoJSON y la añade al mapa como una capa `IDEE.layer.GeoJSON` con relleno rojo translúcido, borde naranja y la etiqueta de la tesela en el centro. Funciona igual en 2D y en 3D: las teselas grandes (zoom 0-1) se trocean en franjas antes de entrar en la escena para que Cesium, que no sabe pintar polígonos de más de 90° de longitud, las dibuje enteras y sin costuras.

## ✨ Características

- **Tres modos de malla** en un `<select>` (`TMS`, `XYZ`, `H3`), cada uno con sus propios campos de entrada, que se montan y desmontan al cambiar de modo.
- **TMS con `{-y}` y XYZ con `{y}`**: son ejes distintos (TMS va con el eje Y invertido) y el plugin usa la función de conversión correspondiente a cada uno.
- **h3-js bajo demanda**: solo se carga la primera vez que se usa el modo H3, desde el CDN (`h3-js@4`, build UMD que expone `window.h3`), cacheado en `window.__georrefH3Promise` y compartido entre instancias. Si la red falla, se avisa con `IDEE.toast.error` y no se intenta dibujar nada.
- **Recorte de los extremos** (`recortarExtremos`): todo valor que toque el límite del mundo (±180 en longitud, ±90 en latitud) se lleva a ±179.99999 / ±89.99999, para que el anillo no caiga justo sobre la línea internacional de cambio de fecha ni sobre los polos, donde el motor 3D invierte el relleno o lo descarta.
- **Troceado para Cesium** (`trocearParaCesium`): una tesela de más de 90° de ancho se parte en franjas verticales de ≤ 60° (un solo polígono, sin tocar las pequeñas), interpolando vértices cada 5° para que no queden arcos largos.
- **Etiqueta y contorno sin costuras**: las teselas grandes se devuelven como una `FeatureCollection` de tres tipos de geometría — N polígonos con **solo relleno**, 1 `LineString` con el contorno exterior y 1 `Point` en el centro con la etiqueta —, y el estilo se aplica por tipo. Si se devolvieran N polígonos sueltos, la API pondría una etiqueta por trozo y dibujaría líneas internas en la tesela.
- **Clave de agrupación `_grupo`** (`CLAVE_GRUPO_TESELA`): las N partes de una tesela grande comparten valor (`properties.label`, p. ej. `"0/0/0"`), para que la tabla de atributos del selector de capas las muestre como **una sola fila** en vez de una por franja.
- **Encuadre automático**: al terminar de cargar la capa se hace `map.setBbox(layer.getFeaturesExtent())`.
- **Nombre propio de la capa** (`Tesela <label>` o `Tesela georreferenciada`), no el genérico `layer_<n>`, porque el selector de capas excluye esas por considerarlas auxiliares de Mapea.
- **Contrato de estado 2D/3D** (`getState`/`setState`): conserva el tipo de malla, los valores de los campos y el estado abierto/plegado del panel.
- **Poblado doble del panel**: se rellena en el acto y también con `IDEE.evt.COMPLETED`, porque la build de Cesium no dispara `COMPLETED` (medido: en 15 s no llegó ni una vez) y el panel se quedaba vacío en 3D.
- **Icono como máscara**: `img/iconos/tile-layer.svg` (pack *Calcite Sharp Line Icons* de Esri) pintado con `--g-plugin-icon-color`, y colores por variables CSS (`color1/color2/color3`), sin colores escritos en la hoja.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `georrefTeselas.js` | El plugin: clase `miPlugin_georrefTeselas`, las funciones `recortarExtremos()` y `trocearParaCesium()`, la carga bajo demanda de h3-js (`ensureH3_georrefTeselas`) y el contrato de estado. |
| `georrefTeselas .css` | Estilos del panel y del botón colapsado (ojo: el nombre del fichero lleva un espacio antes de `.css`). Cromática por variables `--g-plugin-*`, icono por máscara y rejilla de campos `.gr-fila` / `.gr-etiqueta` para alinear las etiquetas con los inputs. |

## 🔧 Integración en un visualizador

```html
<!-- Transformaciones de tesela a GeoJSON (tmsTileToGeoJSON, xyzTileToGeoJSON, h3ToGeoJSON).
     En el repositorio viven en js/lib/transforms/DGGS.js y son OBLIGATORIAS. -->
<script type="text/javascript" src="../../js/lib/transforms/DGGS.js"></script>

<link href="../../ext/georrefTeselas/georrefTeselas .css" rel="stylesheet" />
<script type="text/javascript" src="../../ext/georrefTeselas/georrefTeselas.js"></script>
```

h3-js **no** hay que declararlo: lo carga el propio plugin bajo demanda, solo en modo H3.

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_georrefTeselas(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TL'` | Esquina del panel, clave de `IDEE.ui.position` (`'TL'`, `'TR'`, `'BL'`, `'BR'`…). |
| `collapsible` | `boolean` | `true` | Si el panel se puede plegar. |
| `collapsed` | `boolean` | `undefined` | Si el panel nace plegado. Sin valor **no se le pasa la opción al panel** (no es lo mismo que pasarla como `undefined`), así que manda el default de la API: plegado, con el botón naranja, como `layerSwitcher` y `baseLayer`. |
| `tooltip` | `string` | `'Georreferenciar teselas'` | Texto del tooltip del botón. |
| `className` | `string` | `undefined` | Clase **adicional** para el panel. La clase base `g-herramienta_georrefTeselas` se conserva siempre (es la que usan las reglas del CSS); esta opción sirve para afinar el estilo desde fuera. |
| `order` | `number` | `null` | Valor CSS `order` del panel dentro del área de botones (no un índice; los paneles sin `order` valen 0). Se deriva: solo se guarda si no es `undefined`, ni `null`, ni `NaN`. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo (acepta `'#rgb'` o `{active, deactive}`). |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde (botón + panel). |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono y de la flecha de plegado. |

> Internamente el panel se crea como `new IDEE.ui.Panel('toolsExtra_georrefTeselas', {...})` con `collapsedButtonClass: 'm-tools'` y el control `new IDEE.Control(new IDEE.impl.Control(), 'controlGeorrefTeselas')`, cuyo `equals` es **estricto** (`other === this`): un `equals` laxo desregistraría también los controles de los demás plugins al quitar este.

## 🎨 Colores

Los colores del panel entran por el constructor (`color1/color2/color3`) y se inyectan como **seis** variables CSS en el panel:

| Variable | Origen |
|---|---|
| `--g-plugin-bg-color` / `--g-plugin-bg-color-active` | `color1.deactive` / `color1.active` |
| `--g-plugin-border-color` / `--g-plugin-border-color-active` | `color2.deactive` / `color2.active` |
| `--g-plugin-icon-color` / `--g-plugin-icon-color-active` | `color3.deactive` / `color3.active` |

Los colores de la **capa generada** van escritos en el plugin, en el `IDEE.style.Generic`:

| Elemento | Estilo |
|---|---|
| Relleno de la tesela | `fill: {color: 'red', opacity: 0.2}` |
| Borde (tesela pequeña) | `stroke: {color: 'orange', width: 4}` |
| Contorno (tesela grande) | `line: {stroke: {color: 'orange', width: 4}}` |
| Etiqueta | `text: '{{label}}'`, `scale: 5`, `color: 'white'`, `align: CENTER`, `baseline: MIDDLE` |

## 🚀 Ejemplo de uso

Real (`mapas/georrefGrids/js/mapa.js`):

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_georrefTeselas());
```

Con todas las opciones disponibles:

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_georrefTeselas({
  position: 'TL',
  collapsible: true,
  collapsed: false,          // si no se pasa, manda el default de la API (plegado)
  tooltip: 'Georreferenciar teselas',
  order: -1,                 // por delante del resto de la esquina
  className: 'mi-clase-extra',
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
}));
```

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Crea el panel y el control, aplica los colores, inyecta el HTML del formulario, hace arrastrable la cabecera (`IDEE.utils.draggabillyPlugin`) y puebla los controles (en el acto y en `evt.COMPLETED`). |
| `myFunctionGetGrid()` | `async`. Es la acción del botón **Georreferenciar**: lee el modo y los campos, calcula el GeoJSON, lo recorta, lo trocea si hace falta, crea la capa `IDEE.layer.GeoJSON` con su estilo y la añade al mapa. Devuelve `undefined`. |
| `getHelp()` | `{ title: 'Georreferenciar teselas', content: Promise<html> }`. |
| `resolveColor(c)` | Traduce un color simple u objeto a `{active, deactive}`. |
| `destroy()` | Suelta el control del mapa (`map.removeControls([...])`) y anula las referencias. **Obligatorio**: `map.removePlugins()` de la API lanza `"t.destroy is not a function"` y aborta el resto del lote si falta. No toca el `<script>` de h3-js, que es una caché global intencionada. |

### Funciones auxiliares

| Función | Descripción |
|---|---|
| `recortarExtremos(gjson)` | Lleva los extremos del polígono a ±179.99999 / ±89.99999. No trocea: devuelve una sola feature. |
| `trocearParaCesium(gjson)` | Si el ancho es ≤ 90° devuelve la feature tal cual; si no, devuelve una `FeatureCollection` con N franjas (≤ 60°), 1 `LineString` de contorno y 1 `Point` de etiqueta, todas con la clave de grupo. |
| `ensureH3_georrefTeselas()` | `Promise<window.h3>`. Carga la build UMD de h3-js si no está. |
| `api_georrefTeselas()` | Devuelve el objeto global que tenga la API realmente cargada (`IDEE` si tiene `.ui` y `.map`, si no `M`). Hace falta porque el propio fichero crea un `window.IDEE` vacío como espacio de nombres de plugins. |

### Dependencias que debe aportar el visualizador

`tmsTileToGeoJSON(z, x, y)`, `xyzTileToGeoJSON(z, x, y)` y `h3ToGeoJSON(h3Index)` son **globales** y en el repositorio viven en `js/lib/transforms/DGGS.js`. Sin ese script el plugin no puede construir ninguna tesela.

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{gridType, inputs, panelCollapsed}`. `gridType` sale del `<select>` (`'TMS'` por defecto); `inputs` es un objeto con los campos no vacíos de los siete identificadores posibles (`TMS_z`, `TMS_x`, `TMS_y`, `XYZ_z`, `XYZ_x`, `XYZ_y`, `H3_id`); `panelCollapsed` se lee de `panel._collapsed` y, si no, de la clase `collapsed` del elemento. Devuelve `null` si falla la lectura. |
| `setState(state, map)` | Restaura el estado abierto/plegado del panel (`open()`/`collapse()`), guarda el estado en `_pendingState` y llama a `_applyState()`, que cambia el `<select>` (disparando su `change`) y rellena los campos (disparando `input` y `change`). |

## ✅ Notas y limitaciones

- **Cesium no sabe pintar polígonos de más de 90° de longitud**: el relleno sale recortado, invertido (pinta el complemento) o directamente no sale. Medido con la build `apiidee-1.1.0.cesium`: un rectángulo de 90° de ancho pinta igual que uno de 358°, y el polígono global de la tesela `0/0/0` no pinta nada. Es la limitación conocida del *projection to tangent plane* (blog oficial «Large Polygons in CesiumJS» e issue `CesiumGS/cesium#4871`), y la recomendación oficial es partir el polígono en trozos de ≤ 90°; aquí se parte en franjas de ≤ 60° por margen de seguridad.
- **La interpolación de vértices cada 5°** evita el otro fallo del motor: con dos vértices muy separados (180° o 360°), la granularidad de arco caía por debajo del mínimo que admite Cesium (0.0125 rad) y lanzaba `DeveloperError: Expected value to be greater than or equal to 0.0125`, parando el render.
- **Los estilos no van en línea**: todo se define en `georrefTeselas .css`. Con `style="font-size: large"` en cada etiqueta el texto quedaba enorme y a distinta escala del desplegable, y `style="width:auto"` dejaba los inputs encogidos.
- **El panel se puebla dos veces a propósito**: en el acto (que es lo que arregla el 3D) y otra vez con `evt.COMPLETED` (que es lo que llega en 2D). Repoblarlo es inocuo: se reescribe el `innerHTML` y la selección previa se lee antes de sobrescribir.
- **Los elementos del DOM se buscan dentro del panel de la instancia** (`grEl`), no con un `querySelector` global: al cambiar de implementación el panel anterior sigue un momento en el DOM y el selector global se lo podía encontrar.
- **`collapsed` no se pasa como `undefined`**: la API comprueba `options.collapsed !== undefined` en sitios, así que se construye el objeto de opciones sin esa propiedad cuando el visualizador no la pide.
- **La etiqueta de una tesela grande va en un `Point` propio**: el centro de una franja no es el centro de la tesela, así que la etiqueta no puede ir sobre el polígono del trozo.
- **Menor acoplamiento con el mapa**: el plugin no guarda ids de capa; cada pulsación de **Georreferenciar** añade una capa nueva, sin borrar la anterior.
