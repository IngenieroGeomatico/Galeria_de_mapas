# 🧩 Información del mapa (escala, zoom y sistema de referencia)

> Lectura de escala 1:n, nivel de zoom (o altura de cámara) y coordenadas del puntero, con selector de proyección.

El control `scale*true` del constructor `IDEE.map({ controls })` pintaba en la esquina inferior derecha un cuadro con el nivel de zoom y la escala, pero tenía dos problemas: **Cesium (3D) no sabe construirlo** (lanza `"La implementación usada no puede crear controles Scale"` y aborta la creación del mapa) y su panel colgaba del área de esquina, una columna estrecha de botones, mientras que esta lectura es un `div` ancho que se cruzaba con el resto de herramientas.

Este plugin sustituye a ese control con una lectura propia colgada en la **banda reservada de controles** (`ext/areaControls`), que es un `div` a todo el ancho donde este tipo de lecturas sí encaja. Todo va en **una sola tira**, la misma línea, y solo baja a una segunda línea si no cabe en el ancho del visualizador.

## ✨ Características

- 📏 **Escala 1:n correcta en cualquier S.C.R.**: la conversión usa la resolución en el punto (`getPointResolution`), el patrón canónico de OpenLayers, así que el número vale igual en Mercator, en geográficas o en una cónica.
- 🔍 **Nivel de zoom en 2D** y **altura de cámara sobre el elipsoide en 3D**, con la escala calculada a partir del campo de visión y el tamaño del lienzo.
- 🖱️ **Coordenadas del puntero** en el EPSG del visualizador: en 2D las entrega OpenLayers en las unidades de la vista; en 3D se leen con `camera.pickEllipsoid` más la altura del terreno (`globe.getHeight`).
- ✍️ **Edición a mano**: pulsa sobre el número, escribe el nuevo nivel de zoom o la escala y pulsa Intro. Se admiten `25000`, `1:25000`, `1 : 25.000`, con coma o punto decimal. Escape deshace; con Alt y las flechas salta de diez en diez.
- 🎬 **Transición animada en 2D** (`view.animate`, 550 ms, `easeOut`), animando la **resolución** y no el zoom para que el número escrito sea el que acaba puesta.
- 🌍 **Selector de proyección** en una **ventana modal** con la lista de S.C.R. utilizables, con el rótulo `Nombre (EPSG:n)`.
- ✂️ **Casilla de "recortar"**: decide si el visor se recorta a la extensión de la proyección o se deja en global.
- ➕ **Alta de un EPSG nuevo** pegando su WKT (`PROJCS`), sin depender de un servicio de definiciones por red.
- 🔁 **Repetición lateral** del mapa al pasar de ±180°, con la extensión de las capas ajustada y `wrapX` igualado.
- 🎨 **Colores configurables** (`color1`, `color2`, `color3`) inyectados como variables CSS.
- 💾 **Contrato de estado** `getState()` / `setState()`: la proyección, el recorte y el modo de vista 3D sobreviven al cambio 2D/3D.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `mapInfo.js` | Clase `miPlugin_mapInfo`: construcción de la tira de lectura, cálculo de escala y nivel, lectura de coordenadas, ventana modal de proyección (lista filtrada, casilla de recorte, alta por WKT), repetición lateral de capas, colores, contrato de estado y ciclo de vida (`addTo` / `destroy`). |
| `mapInfo.css` | Estilos de la lectura (réplica del control de escala de la API: fondo azul, borde blanco, esquinas redondeadas, texto de 12 px), de los campos editables, de la barra de la banda de controles y de la ventana modal. |

## 🔧 Integración en un visualizador

Vincula los recursos **después** de la API-IDEE y **antes** de `js/mapa.js`:

```html
<!-- Estilos -->
<link type="text/css" rel="stylesheet" href="../../ext/mapInfo/mapInfo.css">
<!-- Script -->
<script src="../../ext/mapInfo/mapInfo.js" type="text/javascript"></script>
```

> En las etapas de `CaminoDeLosFaros` las rutas llevan un nivel más: `../../../../ext/mapInfo/...`

Conviene **no** pedir el control `scale*true` en `IDEE.map({ controls })` y dejar los créditos y la escala a estas extensiones.

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_mapInfo(options)`

El constructor **funciona sin argumentos**: todas las opciones son opcionales.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `visible` | `boolean` | `true` | Estado inicial de visibilidad de la lectura. |
| `openPosition` | `string` | `'bottom'` | Banda donde se abre (`'bottom'` o `'top'`). Cualquier otro valor cae en `'bottom'`. |
| `order` | `number` | `0` | Orden dentro de la banda. La banda es un `flex row`, así que este `order` ordena **de izquierda a derecha**. Si no se pasa (o no es numérico) queda `0`. |
| `useArea` | `boolean` | `true` | Colgar la lectura en la banda reservada de controles (`miPlugin_areaControls`). Si la banda no está cargada, la lectura se ancla abajo a la izquierda del mapa (clase `g-mapInfo--suelto`). |
| `color1` | `string\|Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de **fondo**. |
| `color2` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **borde**. |
| `color3` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **icono y texto**. |

## 🚀 Ejemplo de uso

Ejemplo real del repositorio (`mapas/Visualizador/js/mapa.js`, `mapas/CaminoDeLosFaros/etapas/*/js/etapa.js`), ampliado con las opciones disponibles:

```js
// La lectura de escala sustituye al control 'scale*true' de la API (que ademas
// Cesium no sabe construir). Va en la banda de areaControls.
mapajs.addPlugin(new IDEE.plugin.miPlugin_mapInfo({ order: 0, openPosition: 'bottom' }));

// Con todas las opciones:
mapajs.addPlugin(new IDEE.plugin.miPlugin_mapInfo({
  visible: true,
  openPosition: 'bottom',
  order: 0,        // orden de izquierda a derecha dentro de la banda
  useArea: true,   // colgar en la banda de ext/areaControls si esta cargada
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' }
}));
```

## 🎨 Colores configurables

Los colores se aceptan como color suelto (`'#ffffff'`) o como objeto `{ active, deactive }`. El plugin escribe las seis variables del esquema **en línea** sobre el contenedor de la tira y también sobre la ventana modal (que cuelga del `body` y no las heredaría):

| Variable CSS | Origen |
|---|---|
| `--g-plugin-bg-color` / `--g-plugin-bg-color-active` | `color1.deactive` / `color1.active` |
| `--g-plugin-border-color` / `--g-plugin-border-color-active` | `color2.deactive` / `color2.active` |
| `--g-plugin-icon-color` / `--g-plugin-icon-color-active` | `color3.deactive` / `color3.active` |

La lectura solo se pinta en un estado (no es un botón que se abra y se cierre), así que lo que se ve es el **estado de reposo** (`deactive`).

## 🌍 Proyecciones y selector

El botón `S.C.R. EPSG:n` de la tira abre una **ventana modal** (no un desplegable: los nombres largos obligaban a 26 em de ancho y el desplegable acababa abriéndose hacia arriba, sobre el mapa).

- La lista se **filtra al montar** con dos condiciones, ambas comprobadas: que `ol.proj.get()` devuelva la proyección y que exista transform entre ella y `EPSG:3857` (la que usan las capas de la API). Un EPSG que la API no conozca deja el mapa **en blanco** (`No transform available between EPSG:2154 and EPSG:3857`).
- Los códigos candidatos son una lista fija (`EPSG_A_FILTRAR`: 3857, 4326, CRS:84, 4269, 4230, 4258, 25829, 25830, 32629, 32630, 23028, 23029, 23030, 26929, 26930, 3395, 27700, 2154, 2065, 3875); OpenLayers no tiene forma de enumerar las proyecciones registradas.
- Los rótulos salen de la tabla `NOMBRES_EPSG`, con los nombres oficiales del EPSG (los de `<gml:name>` del servicio de definiciones del OGC), porque el objeto `Projection` de OpenLayers no guarda su nombre.
- `map.setProjection(codigo)` **no conserva la vista**: la deja en (0,0). El plugin lo arregla midiendo los metros de suelo por píxel antes del cambio y repartiéndolos en la resolución de la vista nueva.
- **En 3D** el globo es geodésico y siempre `EPSG:4979`: el botón aparece **deshabilitado** con la explicación en el título, y la casilla de recorte se deshabilita con él. Solo se ofrecen `EPSG:4326` (modo *globo*) y `EPSG:3857` (modo *plano*).

### Alta de un EPSG nuevo

En la parte inferior de la ventana hay dos campos —código y definición— y un botón **"Añadir y usar"**. El código y la definición también se admiten juntos en el campo de la definición separados por una barra vertical.

- Se apoya en `IDEE.utils.parseCRSWKTtoJSON(wkt)` para sacar el nombre y los `PARAMETER`, y registra a mano la transformación con `addProjection` y `addCoordinateTransforms`.
- Se cubren **Mercator, Mercator Auxiliar, Transversal de Mercator y Cónica Conforme de Lambert**. Si el WKT trae otra proyección, se avisa y no se registra nada.
- Cada alta hace su propia **comprobación de ida y vuelta** antes de darse por buena.
- `ol.proj.proj4.register()` de la API **no funciona** en este bundle (`Could not parse to valid json: defaultDatum`), por eso la vía de registro es la propia.

## 🔄 Estado 2D/3D

El plugin implementa el contrato **`getState()` / `setState(state, map)`** de `ext/cambioImpl`:

- `getState()` devuelve `{ visible: boolean, epsg: string|null, recortar: boolean, epsg3D: string }`. La proyección entra porque el mapa nuevo vuelve a `EPSG:3857`; el recorte, porque es una manera de ver el mapa; y `epsg3D` viaja aparte porque `epsg` es lo de 2D y el modo de vista 3D solo existe en 3D.
- `setState(state, map)` restaura la visibilidad, el recorte **antes** de cambiar la proyección, devuelve el mapa a la proyección elegida conservando la vista, y restaura el modo de la vista de Cesium (`globo` / `plano`) cuando el mapa es 3D.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `constructor(options)` | Construye el plugin; funciona sin argumentos. |
| `addTo(map)` | Enganche al mapa invocado por `mapajs.addPlugin(...)`. Construye la tira, engancha los vigilantes (vista OL o cámara, puntero, capas) y hace el primer pintado. |
| `getHelp()` | Devuelve `{ title: 'Información del mapa', content: Promise }` para el gestor de ayuda. |
| `setVisible(visible)` / `getVisible()` | Muestra u oculta la lectura. |
| `resolveColor(c)` | Normaliza un color a `{ active, deactive }`. |
| `_resolverNombresOficiales()` | Resuelve por red los nombres oficiales de los EPSG contra el servicio de definiciones del OGC (queda como método a mano: el servicio no manda cabecera CORS y fallar no rompe nada). |
| `getState()` / `setState(state, map)` | Contrato de estado para el cambio 2D/3D. |
| `destroy()` | Suelta listeners, devuelve a cada capa la extensión que tenía, desmonta la tira de la banda (y la banda si queda vacía) y quita la ventana modal del `body`. |

## ✅ Notas / Limitaciones

- **Detección de implementación**: se prefiere `map.getImplementation()` (`'ol'` / `'cesium'`) y se cae al patrón canónico (`getMapImpl()` con `scene.camera`) si ese método no existe.
- **Píxeles a 72 dpi**: el plugin usa el píxel de la API (`0,0254 / 72`) en 2D y en 3D a propósito, para que su escala y la de la API coincidan en el ecuador, que es el único punto contrastable.
- **La escala es del suelo**, no del plano: por eso no coincide con la de la API salvo en el ecuador (a 49,6° N marca unos dos tercios). El nivel de zoom, en cambio, **no** lleva el factor de la proyección: no se mueve por irte al norte, solo al cambiar de proyección.
- **En 3D** la escala es la del **punto mirado** (en perspectiva no es constante en toda la vista).
- **Precisión del puntero en 3D**: se usa `camera.pickEllipsoid()`. `scene.pickPosition()` devuelve siempre el centro del mapa y `globe.pick()` devuelve un objeto sin `longitude`/`latitude` en este bundle, así que ninguno de los dos sirve. La altura es la del terreno (`globe.getHeight`, síncrona y dependiente de las teselas ya descargadas); si no hay dato, se muestra la del elipsoide.
- Los valores se validan y topan **antes** de llamar a la API (escala entre 1 y 10⁹; altura de cámara entre 1 y 2·10⁷ m) y se relee del mapa lo que ha quedado de verdad, porque la API no siempre acierta (`setToClosestScale(50000)` deja 49999).
- En 2D el nivel de zoom es el de OpenLayers (`log2(resolución máxima / resolución de la vista)`), el mismo número que devuelve `map.getZoom()` y el que usan `minZoom`/`maxZoom`.
- La repetición lateral se arregla en dos frentes: la extensión de las capas (`_recortarCapas`, con `setExtent`) y el `wrapX` de las fuentes (a través de `window.miWrapX` de `ext_layerSwitcher`, si está cargado). Las capas dentro de un grupo necesitan una extensión explícita: se les da de 11 mundos de ancho por uno de alto.
