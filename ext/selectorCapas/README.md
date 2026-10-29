# 🧩 ext/selectorCapas (selector de capas base y de capas superpuestas)

> Dos plugins de gestión de capas que se cargan juntos: el grid de capas base y el árbol de capas superpuestas.

Esta carpeta agrupa los dos selectores de capas del repositorio, cada uno en su propio fichero y con su propia clase: `miPlugin_baseLayer` (fichero `ext_backgorundLayers.js`), un grid de miniaturas que hace de radiobutton para cambiar la capa base, y `miPlugin_layerSwitcher` (fichero `ext_layerSwitcher.js`), el árbol de capas superpuestas con visibilidad, transparencia, renombrado, reordenación por drag & drop, grupos, tabla de atributos y ficha de capa. Están separados a propósito: las capas base se gestionan desde el primero y quedan fuera del segundo. El fichero del layer switcher define además los ayudantes globales que usan los dos (`window.miWrapX` para envolver el mundo y `window.miBaseAbajo` para dejar la base debajo de las superpuestas en 3D).

---

# 🧩 miPlugin_baseLayer

> Grid de miniaturas que funciona como radiobutton para elegir la capa base del mapa.

Muestra la lista de capas base como imágenes cuadradas en un grid; al marcar una se quita la capa base actual, se añade la nueva y se iguala el `wrapX` de todas las capas ráster. La selección se guarda en `localStorage` (`baseLayer_ID`), de modo que el visor recuerda la última capa base elegida entre recargas.

## ✨ Características

- Lista por defecto la del catálogo de la API (`IDEE.config.backgroundlayers`) si no se le pasa `layers`.
- Grid de columnas de ancho **fijo** (110 px): cada miniatura mide siempre lo mismo y el panel se ensancha o se encoge según el número de capas.
- Opción «Sin mapa base» (`noBaseLayer`), que se coloca **siempre al final** de la lista (id interno `__none__`).
- Elección de la capa base inicial por `id` o por **posición**, con prioridad sobre lo guardado en `localStorage`.
- Aplica `window.miWrapX.aplica(map)` tras cada cambio, para que todas las capas base den la vuelta al mundo (las TMS vienen con `wrapX` a `true` por defecto y las WMTS a `false`), y `window.miBaseAbajo.programa(map, capas)` para que en 3D la base recién puesta quede debajo de las superpuestas (las hijas de un grupo base no llevan `isBase` y se añadían encima).
- Contrato de estado 2D/3D: conserva la capa base activa y el estado abierto/colapsado del panel.
- Se puede colgar de la barra del supraplugin (`getSupraElement`), ocultando entonces el botón redondo que la API pinta en el área.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `ext_backgorundLayers.js` | Clase `miPlugin_baseLayer`: construye el panel (`toolsExtra_baseLayer`), el control (`controlBackgroundLayer`), el grid, la función interna `changeBase(layerId)` y el contrato de estado. |
| `ext_backgorundLayers.css` | Estilos del grid (`.bl-grid`, `.bl-item`, `.bl-thumb`, `.bl-title`, `.bl-img`), del botón del panel (color1/color2/color3 vía variables) y del botón de la barra (`.bl-supra__*`). |

## 🔧 Integración en un visualizador

```html
<link type="text/css" rel="stylesheet" href="../../ext/selectorCapas/ext_backgorundLayers.css" />
<script src="../../ext/selectorCapas/ext_backgorundLayers.js" type="text/javascript"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_baseLayer(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `layers` | `Array<Object>` | `IDEE.config.backgroundlayers` | Capas base. Cada elemento es `{ id, title, layers, imgPreview }`: `id` lo usa `initActiveLayer` y el `localStorage`, `title` es la etiqueta, `layers` es lo que se pasa a `map.addLayers()` y `imgPreview` es la URL de la miniatura. Si el array está vacío o no es un array, se usa el catálogo de la API. |
| `rows` | `number` | `1` | Número de filas del grid. Solo se acepta si es un número `>= 1`. Las columnas se calculan como `Math.ceil(items.length / rows)`. |
| `noBaseLayer` | `boolean\|Object` | — (no se añade) | Añade la opción «Sin mapa base». Con `true` usa una imagen blanca 1×1 en base64 y el título `'Sin mapa base'`; con un objeto admite `{ imgPreview, title }`. Va siempre al final de la lista. |
| `position` | `string` | `IDEE.ui.position.TL` | Esquina del panel. |
| `title` | `string` | `'Capas base'` | Título de la cabecera del panel. |
| `initActiveLayer` | `string\|number` | — | Capa base activa al iniciar: el `id` de una capa (`string`) o su **posición** (`number`, `0` = primera). La opción «Sin mapa base», si existe, es la última posición. **Gana sobre** la selección guardada en `localStorage`. |
| `order` | `number` | `null` | `order` CSS del panel dentro del área de esquina. Los paneles sin `order` valen 0; `null` deja el valor que ponga la API. |
| `tituloBarra` | `string` | `title` o `'Capas base'` | Etiqueta del botón cuando el plugin se cuelga de la barra del supraplugin. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo (cabecera y botón). |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde (botón + panel). |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono y texto. |

## 🚀 Ejemplo de uso

Ejemplo real (`mapas/Visualizador/js/mapa.js`), con la lista de capas declarada a mano:

```js
const capasBase = [
  { id: 'mapa',   title: 'Callejero', imgPreview: 'img/IGNBase.png', layers: ['QUICK*BASE_MapaBase_IGNBaseTodo_WMTS'] },
  { id: 'imagen', title: 'Imagen',    imgPreview: 'img/imagen.png',  layers: ['QUICK*BASE_PNOA_MA_TMS'] },
];

const baseLayerPlugin = new IDEE.plugin.miPlugin_baseLayer({
  rows: 1,                  // una sola fila (todas en línea)
  noBaseLayer: true,        // añade "Sin mapa base" al final
  title: 'Capas base',
  initActiveLayer: 'imagen' // por id; también valdría 1 (posición)
});
mapajs.addPlugin(baseLayerPlugin);
```

Y el patrón para colgarlo de la barra del supraplugin, con las capas del catálogo de la API (`mapas/Visualizador2/js/mapa.js`):

```js
const baseLayerPlugin = new IDEE.plugin.miPlugin_baseLayer({
  rows: 1,
  noBaseLayer: true,
  title: 'Capas base',
  initActiveLayer: 'imagen',
});
supra.addItem(baseLayerPlugin);         // el botón pasa a la barra
mapajs.addPlugin(baseLayerPlugin);      // el panel sigue en el mapa
```

## 🎨 Colores

Se inyectan en un bloque `<style>` con ámbito al panel del plugin (sobrevive a los re-renders que la API hace del panel, cosa que el estilo en línea no garantiza). En el estado abierto (`.opened`) los seis valores pasan a la variante `active`.

| Variable | Origen |
|---|---|
| `--g-plugin-bg-color` / `--g-plugin-bg-color-active` | `color1.deactive` / `color1.active` |
| `--g-plugin-border-color` / `--g-plugin-border-color-active` | `color2.deactive` / `color2.active` |
| `--g-plugin-icon-color` / `--g-plugin-icon-color-active` | `color3.deactive` / `color3.active` |

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ activeLayerId, panelCollapsed }`. Si no hay id en memoria, lo lee del radio marcado (`.bl-radio:checked`) y, si tampoco, de `localStorage.getItem('baseLayer_ID')`. |
| `setState(state, map)` | Restaura el plegado del panel y vuelve a seleccionar la capa base: marca el radio y dispara su evento `change`; si la UI aún no está montada, llama a `_changeBase(id)`; y como último recurso quita las capas base actuales y añade las del item elegido directamente al mapa (dejando también el `localStorage` al día). |

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Construye el panel, el control y el grid, y dispara la activación (que resuelve qué radio marcar). |
| `getSupraElement(supra)` | Devuelve el botón para la barra del supraplugin, oculta el botón propio del panel (clase `g-panel-en-barra`) y sincroniza su estado con el panel. |
| `resolveColor(c)` | Traduce un color simple u objeto a `{active, deactive}`. |
| `getHelp()` | `{ title: 'Selector de capas base', content: Promise<html> }`. |
| `destroy()` | Suelta el botón de la barra, retira el control del mapa (la API se lleva el panel con él) y anula las referencias. |

## ✅ Notas

- `initActiveLayer` numérico se interpreta como **índice** sobre la lista de radios ya renderizada, así que permite seleccionar la opción «Sin mapa base» si está en esa posición.
- La precedencia de la elección al iniciar es: `initActiveLayer` → `localStorage` (`baseLayer_ID`) → primer item de la lista.
- La resolución del radio ocurre en `requestAnimationFrame`, con el evento `change` disparado a mano, porque el grid se reconstruye en cada `activate`.
- `destroy()` es obligatorio: `map.removePlugins()` de la API lanza `"t.destroy is not a function"` y aborta el resto del lote de plugins si falta. El `control.equals` estricto (`other === this`) evita desregistrar los controles de los demás plugins.

---

# 🧩 miPlugin_layerSwitcher

> Árbol de capas superpuestas: visibilidad, transparencia, renombrado, reordenación y consulta de datos.

Es el gestor de las capas superpuestas del mapa (las capas base quedan fuera, las lleva `miPlugin_baseLayer`). Lista las capas y los grupos `IDEE.layer.LayerGroup` en forma de árbol ordenado por **z-index descendente** (la capa que se dibuja encima va arriba), con un ojo para la visibilidad, un desplegable de opciones por capa y arrastre por asa para reordenar. Es también el punto de entrada a la tabla de atributos / estadísticas (panel inferior) y a la ficha de construcción de la capa.

## ✨ Características

- **Visibilidad**: ojo por capa (y también el propio nombre es clicable). Alterna la capa de forma independiente; en un grupo alterna el grupo completo (OpenLayers oculta el render de todas sus hijas sin tocar su estado individual). El ojo tiene **tres estados**: abierto (visible), tachado (oculta) y abierto con una insignia «!» en ámbar (**encendida, pero ahora mismo no se ve**: el zoom actual queda fuera de su `minZoom`/`maxZoom` o su cobertura no cae en la vista). Ese tercer estado se recalcula al terminar de mover el mapa (evento de la implementación: `moveend` en 2D, `camera.moveEnd` en 3D) repintando solo los ojos, sin rehacer la lista, y se apoya únicamente en datos locales (nada de red); en MVT y MapLibre no se comprueba la extensión porque su bbox en el cliente no es la cobertura real.
- **Transparencia**: desplegable por capa con un slider 0–100 % (la API usa opacidad `0..1`, así que `opacity = 1 − transparencia/100`). En **Cesium** una capa vectorial con coordenadas 2D se dibuja como `GroundPrimitive` y su material no se reconstruye solo, así que el plugin rehace las entidades del `dataSource` (agrupando ráfagas cada 150 ms, con límite de 5000 entidades, avisando por consola por encima de ese límite).
- **Renombrado en línea** (Enter o blur guarda; Escape cancela), persistido en la fachada (`legend` y `name`) y en el impl de OpenLayers (`name`/`title`) para que lo vean los demás paneles.
- **Drag & drop por asa** (`ls-drag-handle`) para reordenar: reasigna el **z-index real** del impl de OpenLayers (el renderer pinta por `zIndex`, no por orden de colección) y permite mover capas **entre grupos y la raíz**, con guarda anti-ciclo para no meter un grupo dentro de sí mismo o de un descendiente.
- **Grupos** (`IDEE.layer.LayerGroup`): nodos padre plegables, con subgrupos y el estado de colapso recordado entre re-renderizados; el nombre visible sale de `legend`, del `title` del constructor o de `name` (se descartan los nombres internos `layer_<n>`).
- **Zoom a la capa**: encuadra la extensión de la capa o del grupo (unión de las extensiones de sus hijas). En 2D con `view.fit(...)`; en 3D con `camera.flyTo` y `Cesium.Rectangle.fromDegrees`. La extensión se busca en `getMaxExtent()`, en la rejilla de la fuente (GeoTIFF) y, en 3D, en `impl.getBoundingBox()`, descartando el «mundo entero» de relleno.
- **Panel inferior (bottom sheet)** con la tabla de atributos de las capas vectoriales (con sincronía tabla ↔ mapa: pulsar una fila localiza y resalta el feature, y el clic en el mapa marca la fila) o con las estadísticas de las ráster. Las capas MapLibre/MVT abren además un selector de sub-capas.
- **Ficha de la capa**: modal con un **editor de parámetros** (formulario y, en las capas de colocación, interacción con el mapa) y, plegados, los parámetros de construcción (`constructorParameters.userParameters` o `.parameters`, más `options` y `vendorOptions`, y la `url` resuelta) y el documento del servicio (`getCapabilities()` en WMS/WMTS; `tileset.json` / `metadata.json` en servicios de teselas, validando que sea JSON y no binario).
- **Objetos geográficos (WFS y OGC API Features)**: en la **ventana de información** (la que abre la tabla de atributos) hay una barra sobre la tabla con el modo «Todas / La vista», el límite de objetos por página (25, 50, 100, 200, 500; 100 por defecto) y el paginado «‹ Página N ›», que se resuelve en el servidor. Es un control **prestado**: lo pinta el selector y lo ejecuta `ext/bboxFeatures/bboxFeatures.js` a través de `window.miBBoxFeatures` (si la extensión no está cargada, la barra no se pinta). La tabla se rehace sola cuando la capa termina de cargar (evento `load`).
- **Filtro de capas listables**: quedan fuera las capas base, las marcadas con `displayInLayerSwitcher: false`, las de terreno y las internas autogeneradas (`layer_<n>`, salvo los grupos).
- **Contrato de estado 2D/3D** completo (panel, desplegable abierto y grupos plegados), resolviendo por `legend` cuando el `idLayer` se regenera.
- Aplica `window.miWrapX.aplica(map)` en `addTo`, de modo que el visor no tiene que cargar ningún script aparte.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `ext_layerSwitcher.js` | Los ayudantes globales `window.miWrapX` (`aplica`, `envuelve`, `olDe`) y `window.miBaseAbajo` (`aplica`, `programa`), y la clase `miPlugin_layerSwitcher`, con todo el árbol, los handlers globales del panel, el bottom sheet y la ficha. |
| `ext_layerSwitcher.css` | Estilos del panel y de la lista (`.overlay-layer-selector`, `.ls-row`, `.ls-eye`, `.ls-radio` del modo «una capa a la vez», `.ls-options-panel`, `.ls-opacity-slider`, `.ls-drag-handle`, `.ls-group`, `.ls-children`, marcas de drop), de la barra de objetos geográficos (`.ls-objetos`, `.ls-objetos__btn`, `.ls-objetos__limite`, `.ls-objetos__pager`), del bottom sheet (`.ls-sheet-*`, `.ls-attr-table`), de la ficha (`.ls-ficha-*`) y del botón de la barra (`.ls-supra__*`, icono por máscara). |

## 🔧 Integración en un visualizador

```html
<link type="text/css" rel="stylesheet" href="../../ext/selectorCapas/ext_layerSwitcher.css" />
<script src="../../ext/selectorCapas/ext_layerSwitcher.js" type="text/javascript"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_layerSwitcher(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `order` | `number` | `null` | `order` CSS del panel dentro del área de esquina. Los paneles sin `order` valen 0; `null` deja el valor que ponga la API. |
| `tituloBarra` | `string` | `'Selector de capas'` | Etiqueta del botón cuando el plugin se cuelga de la barra del supraplugin. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo. |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde (botón + panel, estado normal y `.opened`). |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono y flecha. |
| `seleccionUnica` | `boolean\|Array` | `false` | Modo «una capa a la vez». `true` convierte todas las capas del selector en un grupo de radio (solo una visible; encender una apaga las demás) y un array deja dentro del grupo solo las capas cuyo `legend`, `name` o `idLayer` esté en la lista, para que las superposiciones (una ortofoto, un seamark) sigan funcionando como casilla independiente. Ojo: los `idLayer` se regeneran en cada reinicio de mapa, así que en un visualizador conviene pasar `legend`. |

> El panel se fija internamente en `IDEE.ui.position.TL` (`IDEE.ui.Panel('toolsExtra_layerSwitcher')`, `collapsible: true`, clase `g-herramienta_selectorCapa`) con el control `controlLayer_layerSwitcher`; no hay opción de posición ni de título de panel. Según el propio código, `addTo` lo crea plegado y el estado abierto solo se recupera vía `setState`.

## 🚀 Ejemplo de uso

Ejemplo real mínimo (la mayoría de visores del repositorio):

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());
```

Con las opciones disponibles y colgado de la barra del supraplugin (`mapas/Visualizador2/js/mapa.js`):

```js
const layerSwitcherPlugin = new IDEE.plugin.miPlugin_layerSwitcher({
  order: 0,                       // posición dentro de la esquina TL
  tituloBarra: 'Capas',           // etiqueta del botón en la barra
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
});
supra.addItem(layerSwitcherPlugin);      // el botón pasa a la barra
mapajs.addPlugin(layerSwitcherPlugin);   // el panel sigue en el mapa
```

Modo «una capa a la vez» (visor de XYZ: dieciocho fondos y un seamark encima):

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher({
  order: 1,
  // Los que van en la lista se comportan como un radio; OpenSeaMap, que no
  // está, se sigue encendiendo y apagando con el ojito encima del elegido.
  seleccionUnica: ['OpenStreetMap', 'OpenTopoMap', 'Esri imágenes (satélite)'],
}));
```

## 🎨 Colores

Las seis variables se escriben **en línea** sobre el panel del plugin (no en un `<style>`).

| Variable | Origen |
|---|---|
| `--g-plugin-bg-color` / `--g-plugin-bg-color-active` | `color1.deactive` / `color1.active` |
| `--g-plugin-border-color` / `--g-plugin-border-color-active` | `color2.deactive` / `color2.active` |
| `--g-plugin-icon-color` / `--g-plugin-icon-color-active` | `color3.deactive` / `color3.active` |

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ panelCollapsed, optionsOpen, optionsOpenLegend, groupCollapsed, groupCollapsedLegends, radioVisibleLegend, ordenZ }`. Además del `idLayer` de la capa con el desplegable abierto y del mapa `idLayer → bool` de los grupos plegados, guarda su `legend`/`name` como identificador **estable** (los `idLayer` se regeneran con prefijos temporales en cada reinicio de mapa). `radioVisibleLegend` es la capa elegida en el modo «una capa a la vez»: la visibilidad de las capas no viaja por aquí (la recrea el visor), pero la elección sí se conserva. `ordenZ` es el orden de apilado de arriba abajo (`legend`/`name` de cada capa con z, incluidas las bases y las hijas de grupos, sin vectores ni terreno). |
| `setState(state, map)` | Restaura el plegado del panel, resuelve el desplegable abierto y los grupos plegados **primero por `idLayer`** y, si esa capa ya no existe, **por `legend`/`name`** (patrón `_findLayerByIdInMap` / `_findLayerByLegendInMap`, ambos recursivos dentro de grupos anidados), filtra defensivamente los identificadores que ya no están, reaplica el orden de apilado (`ordenZ`), vuelve a encender la capa elegida del grupo radio y fuerza un re-render de la lista. |

El estado de **las capas** (visibilidad, opacidad, renombrado) no viaja por aquí: reside en las propias capas y lo transfiere directamente `cambioImpl`. La **excepción es el orden de apilado**: en cada reinicio de mapa las capas se recrean en el orden que declara el visualizador (y en Cesium se anaden al final de `imageryLayers`), así que el orden del selector se guarda en `getState()` y se reaplica en `setState()`.

**Cómo se reaplica el orden** (`_restaurarOrdenZ`): se resuelven las capas por `legend`/`name` en el mapa nuevo, se leen los z que ya tienen y se **permutan** esos mismos valores entre ellas, de abajo arriba. Así no se invade el rango de las capas que el selector no gestiona ni se chocan las constantes `Z_INDEX` de la API. En 2D se escribe el `zIndex` del `olLayer` (fuente de verdad del renderer); en 3D se llama a la fachada, que quita la capa de `imageryLayers` y la reinserta en esa posición (índice 0 = la de abajo). No se miran las banderas `isBase` de la instancia nueva porque en Cesium `isBase` significa «la primera capa visible» y cambia según lo que se encienda.

## 🔲 Objetos geográficos: modo, límite y paginado en la ventana de información

Las capas **WFS** y **OGC API Features** muestran una barra sobre la tabla de atributos, dentro de la **ventana de información** (el panel inferior que abre el botón de la tabla):

```
Objetos geográficos  [ Todas ] [ La vista ]      Límite [ 100 ▾ ]   ‹  Página 2  ›
```

- **Todas**: comportamiento de la API, sin filtro por extensión (pero con el límite de página).
- **La vista**: el servicio recibe el BBOX de lo que se está mirando y la petición se repite al mover el mapa.
- **Límite**: cuántos objetos geográficos se piden por página (25, 50, 100, 200, 500; **100 por defecto**). Se aplica en **los dos modos** y al cambiarlo se vuelve a la página 1.
- **Página**: el paginado se resuelve **en el servidor** (`count`/`startIndex` en WFS, `limit`/`offset` en OGC API Features), así que el mapa y la tabla muestran siempre la misma página. Como los servicios no informan del total (la API tira `numberMatched`), la flecha de siguiente se apaga cuando la página viene incompleta.

El selector solo **pinta y delega**: no sabe nada de BBOX ni de paginación. Todo el trabajo (calcular la extensión, escribirla en el impl, refrescar, escuchar el movimiento y guardar el estado 2D/3D) está en `ext/bboxFeatures/bboxFeatures.js`, que publica `window.miBBoxFeatures`. Por eso:

- La barra se pinta solo si `window.miBBoxFeatures.soporta(layer)` existe y devuelve `true`; si la extensión no está cargada, no aparece nada.
- Los controles llaman a `window.setBBoxModo(idLayer, modo)`, `window.setBBoxLimite(idLayer, n)` y `window.setBBoxPagina(idLayer, pagina)`, que resuelven la capa, delegan en `window.miBBoxFeatures` y repintan la barra sin esperar a la respuesta.
- **El estado no viaja por el estado del selector**: lo guarda `miPlugin_bboxFeatures` en su propio `getState()`/`setState()` (`{ vista, limite, offset }`).
- La tabla se **rehace sola** cuando la capa termina de cargar: `bindSheetReload(layer)` escucha el evento `load` en el impl y en la fachada (en 2D lo dispara el impl y en 3D la fachada) y, con 150 ms de rebote, vuelve a pintar la barra y la tabla. `unbindSheetReload()` se llama al cerrar la hoja y en `destroy()`.
- La hoja se **cierra** al destruir el plugin y al rehidratar la instancia nueva (`setState`), porque vive en `document.body` y no se la lleva el reinicio del div del mapa.
- `destroy()` retira también `setBBoxModo`, `setBBoxLimite` y `setBBoxPagina` de `window` (están en la lista `GLOBALES`).

En el visualizador hay que registrar la extensión **antes** del selector (`mapas/tiposDeCapas/js/comun.js`, opción `bboxFeatures`), de modo que el límite ya esté aplicado cuando se abra la ventana de información.

El panel del desplegable de opciones vuelve a tener `max-height: 220px` cuando está abierto: la fila de objetos geográficos ya no vive ahí.

La tabla de atributos reconoce también las capas **OGC API Features** (`getLayerKind` incluye `ogcapifeatures` en `vectorTypes`); antes se trataban como ráster y no tenían ni tabla ni barra. Las columnas cuyos valores son objetos (por ejemplo la geometría que algunos servicios devuelven dentro de las propiedades) se omiten, para no llenar la tabla de `[object Object]`.

## ✏️ Editor de parámetros de la ficha

El botón de información de cada capa (`.ls-action-ficha`) abre un modal con un formulario editable. Arriba va el editor y debajo, dentro de un `<details>`, la tabla de parámetros en solo lectura (la de antes) y el documento del servicio.

Los campos salen de `constructorParameters` (`userParameters` en servicios, `parameters` en datos) filtrados por la lista blanca `CLAVES_EDITABLES` (`url`, `name`, `legend`, `attribution`, `layers`, `styles`, `format`, `version`, `transparent`, `tiled`, `namespace`, `outputFormat`, `crs`, `maxFeatures`, `minZoom`, `maxZoom`, `tileGridMaxZoom`). Lo que no está en la lista se sigue viendo en la tabla, pero no se toca (un `source` ya consumido, los `vendorOptions` del servicio...). Siempre se ofrecen además `legend`, `attribution` (solo si es texto), `opacity` (%) y `visible`. Las capas de extensión (GLB, Imagen, IFC) borran sus claves propias antes de llamar al constructor base, así que la `url` se recupera de `getState()`.

Se aplican de dos maneras:

- **En caliente**, sin recrear nada: `opacity` y `visible` llaman a `setOpacity()`/`setVisible()`.
- **Reconstruyendo la capa**: el resto de campos forma parte del constructor, así que se crea una instancia nueva con `new capa.constructor(params, opciones)` y se sustituye a la vieja **en su mismo grupo y con su mismo z** (`_sustituirCapa`), conservando la opacidad y el estilo elegido (`window.setLayerStyle`). Si la creación o la sustitución fallan, se deja la capa vieja donde estaba y se avisa en el propio formulario. Después se repinta la lista (`window.renderLayerList`) y el editor se vuelve a montar sobre la capa nueva, actualizando también la cabecera del modal.

### Colocación con el mapa (GLB, Imagen e IFC)

El bloque de colocación se genera solo si la capa cumple el contrato `getState()`/`setState()` y su estado trae `position` y/o `bbox`. De ese estado se conservan únicamente las claves de colocación (`position`, `bbox`, `heading`, `pitch`, `roll`, `scale`, `heightOffset`, `ancho`, `alto`, `metrosPorPixel`, `clampToGround`, `baseAlSuelo`, `ajustarABbox`): `url`, `visible` y `opacity` se editan en su propio campo y no deben pisarse al aplicar.

| Acción | 2D (OpenLayers) | 3D (Cesium) |
|---|---|---|
| **Punto** | Longitud, latitud y cota | Igual |
| **Centro del mapa** | Centro de la vista reproyectado a 4326 | `getCenter()` de la fachada (ya en grados) |
| **Pinchar en el mapa** | `singleclick` del impl | `ScreenSpaceEventHandler` + rayos al globo |
| **Rectángulo** | Oeste, sur, este y norte | Igual |
| **Vista actual** | Extensión de la vista reproyectada | `camera.computeViewRectangle()` y, si falla, rayos en las esquinas |
| **Dibujar rectángulo** | Marquesina con arrastre (`pointerdown` en captura para que el mapa no se mueva) | No se ofrece: avisa y pide coordenadas o «Vista actual» |
| **Giro** | Número y deslizador −180°…180° sincronizados, botón `0°` | Igual |

Mientras se pincha o se dibuja, el modal pasa a `ls-ficha--pick`: el overlay deja pasar el ratón al mapa (`pointer-events: none`), se aparta a la izquierda y el panel sigue siendo interactivo. `Esc` cancela la captura sin cerrar la ficha; el `Esc` que no está capturando sí cierra el modal. La marquesina (`.ls-ficha-marco`) se cuelga del `body` en coordenadas de pantalla y con `z-index` por encima del modal.

Las ediciones de colocación **sí sobreviven al cambio 2D/3D**, porque `cambioImpl` reconstruye GLB/Imagen/IFC a partir de `getState()`. Las de URL, nombre o capas del servicio no: las capas se recrean desde `mapa()`.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Aplica `miWrapX`, crea el panel y el control, inyecta el HTML, construye el árbol y engancha los eventos. Expone `window.renderLayerList()` y el resto de ayudantes que el HTML del panel llama en línea. |
| `getSupraElement(supra)` | Devuelve el botón para la barra del supraplugin, oculta el botón propio del panel (`g-panel-en-barra`) y lo mantiene sincronizado con el estado plegado real del panel. |
| `resolveColor(c)` | Traduce un color simple u objeto a `{active, deactive}`. |
| `getHelp()` | `{ title: 'Selector de capas', content: Promise<html> }`. |
| `destroy()` | Suelta el botón de la barra, desengancha el clic del mapa y el listener `ADDED_LAYER`, retira el control del mapa y borra de `window` los ayudantes que define el plugin (no toca la clase en `window.IDEE.plugin`). |

## ✅ Notas

- **Ayudantes globales**: el plugin deja en `window` las funciones que usa el HTML en línea del panel (`renderLayerList`, `toggleLayerVisibility`, `toggleLayerOptions`, `toggleGroup`, `startRenameLayer`, `setLayerOpacity`, `zoomToLayer`, `deleteLayer`, `getLayerKind`, `openLayerInfo`, `openLayerFicha`, `closeSheet`, `locateFeature`, `setBBoxModo`, `setBBoxLimite`, `setBBoxPagina`, `handleDragStart/DragOver/Drop/DragEnd`...). `destroy()` las retira.
- **Reordenación**: se aplica **reasignando z-index** (`recordZ` → `_escribirZ`), no moviendo la colección. En 2D se escribe el `zIndex` del impl de OpenLayers (el renderer pinta por `zIndex`, no por orden de colección); en 3D se escribe en la fachada, que delega en el impl de Cesium (quita la capa de `imageryLayers` y la reinserta en ese índice). Se indexan solo las capas «listables» de cada contenedor, dejando intactos el z y el intercalado de las auxiliares (por ejemplo `__draw__`) y de las bases. La invariante es que las hijas de un grupo nunca superan el z del grupo.
- **Base siempre debajo de las superpuestas (3D)**: `window.miBaseAbajo.aplica(mapa, capas)` baja al fondo de `imageryLayers` las capas de una base recién puesta, conservando su orden relativo y sin tocar nada si ya están abajo; `programa(...)` lo reintenta a 0, 400 y 1500 ms porque la API da de alta las capas de forma asíncrona. En 2D no hace nada. Es necesario porque en Cesium una base simple se inserta en el índice 0 (lleva `isBase`), pero las **hijas de un grupo base** (el Híbrido) no llevan `isBase` y se añadían **encima** de las superpuestas (medido: las dos hijas del Híbrido en los índices 19 y 20 con 19 fondos XYZ debajo, o sea que el fondo tapaba la capa elegida). `miPlugin_baseLayer` lo llama tras `addLayers()` en `changeBase` y en el respaldo de `setState`.
- **Envolver el mundo (`wrapX`)**: `window.miWrapX.aplica(mapa)` pone `wrapX_ = true` en todas las fuentes ráster (las vectoriales no lo tienen) y se queda escuchando altas y bajas de la colección de capas, así que cubre también las capas añadidas después. Hay que tocar el **campo** `wrapX_` y avisar con `changed()`: la API no deja pasar la opción y `source.set('wrapX', false)` no surte efecto en esta versión de OpenLayers. En 3D no hace nada (el impl de Cesium no tiene `getLayers()`).
- `ext_backgorundLayers.js` y `ext/mapInfo` usan `window.miWrapX` **con guardia**, y `miWrapX` se define en `ext_layerSwitcher.js`, así que los dos ficheros de la carpeta se cargan juntos (el orden entre ellos no es crítico por la guardia).
- El botón redondo que la API pinta en el área se esconde (`g-panel-en-barra`) cuando el plugin vive en la barra del supraplugin, para no dejar dos puertas al mismo panel.
