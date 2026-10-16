# 🧩 Atribución y créditos

> Panel o barra de créditos unificado para 2D y 3D, con las atribuciones del visualizador y de sus capas.

El control nativo de atribución de la API-IDEE solo existe en la implementación 2D (OpenLayers); en Cesium (3D) no está disponible y, además, su banner aparece con el título en inglés ("Attributions") y con un estilo poco integrado en el visualizador.

Este plugin sustituye a ese control con una implementación propia que funciona igual en 2D y en 3D: recopila tanto las atribuciones **estáticas** que declara el visualizador como las **dinámicas** asociadas a las capas cargadas en el mapa, y las presenta con el aspecto del resto de herramientas del repositorio.

## ✨ Características

- 🖥️ **Compatible con 2D (OpenLayers) y 3D (Cesium)**: unifica la experiencia en ambas implementaciones.
- 🗂️ **Atribuciones estáticas + dinámicas**: combina las que se pasan por constructor (`attributions`) con las que declaran las capas del mapa (`layer.attribution`).
- 🧹 **Deduplicación automática** por `name` + `description`, y normalización del color inline `#0000FF` a `inherit`.
- 🧲 **Dos modos de presentación**: panel colapsable arrastrable (`full`) o botón estándar en el rail con barra horizontal de créditos (`lite`).
- 🔄 **Refresco automático**: escucha los eventos de alta y baja de capas y vuelve a pintar el contenido.
- ⌨️ **Cierre con Escape** en ambos modos.
- 🎨 **Colores configurables** (`color1`, `color2`, `color3`) inyectados como variables CSS.
- 💾 **Contrato de estado** `getState()` / `setState()` para sobrevivir al cambio de implementación 2D/3D.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `attribution.js` | Clase `miPlugin_attribution`: recopilación de atribuciones, construcción del panel (modo `full`) o de la barra inferior (modo `lite`), colores, contrato de estado y ciclo de vida (`addTo` / `destroy`). |
| `attribution.css` | Estilos del botón © (máscara SVG), del panel `g-herramienta_attribution`, de la barra `m-attribution-bar` del modo `lite` y de las variables de color del esquema. |

## 🔧 Integración en un visualizador

Vincula los recursos **después** de la API-IDEE y **antes** de `js/mapa.js`:

```html
<!-- Estilos -->
<link href="../../ext/attribution/attribution.css" rel="stylesheet" />
<!-- Script -->
<script type="text/javascript" src="../../ext/attribution/attribution.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_attribution(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'BR'` | Posición del panel (clave de `IDEE.ui.position`): `'TL'`, `'TR'`, `'BL'` o `'BR'`. En modo `lite` no se usa: el botón se fuerza a `BL` (rail estándar). |
| `mode` | `string` | `'full'` | Modo de presentación. `'full'` = panel colapsable de la API-IDEE con cabecera arrastrable; `'lite'` = botón `m-tools` en el rail y barra de créditos a lo largo de la base. Cualquier valor distinto de `'lite'` cae en `'full'`. |
| `collapsed` | `boolean` | `true` | Estado inicial colapsado del panel. |
| `collapsible` | `boolean` | `true` | Permite colapsar el panel. |
| `tooltip` | `string` | `'Atribución y créditos'` | Tooltip del botón. |
| `order` | `number` | `null` (sin valor explícito) | Valor CSS `order` dentro del área de botones; **no es un índice** (los paneles sin `order` valen 0): `-1` por delante de todos, `0` primera posición, `2` detrás de los de `0`, `99` al final. Si no se pasa (o no es numérico) queda `null` y no se escribe. En modo `lite`, si es `null` la barra se cuelga con `order: 0`. |
| `openPosition` | `string` | `'bottom'` | Banda donde se despliega la barra del modo `lite`: `'bottom'` o `'top'`. Cualquier otro valor cae en `'bottom'`. |
| `attributions` | `Array<Object\|string>` | `[]` | Atribuciones estáticas a nivel de mapa. Cada entrada puede ser un `string` (solo descripción) o un objeto `{ name, description }`. |
| `color1` | `string\|Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de **fondo** (variable `--g-plugin-bg-color`). |
| `color2` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **borde** (variable `--g-plugin-border-color`). |
| `color3` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **icono** (variable `--g-plugin-icon-color`). |

## 🚀 Ejemplo de uso

Ejemplo real del repositorio (`mapas/LucesdeBohemia/js/mapa.js`, `mapas/CalidadAireMadrid/js/mapa.js`, `mapas/PuntosHistoricosMadrid/js/mapa.js`), ampliado con las opciones disponibles:

```js
// Los créditos no se piden como control de la API: los pone ext/attribution.
const ext_Attribution = new IDEE.plugin.miPlugin_attribution({
  position: 'BR',
  // Modo de presentación de los créditos:
  //   'full' => panel colapsable de la API-IDEE con cabecera arrastrable (por defecto)
  //   'lite' => botón estándar m-tools en el rail + barra de atribuciones a lo
  //             largo de la base del visualizador
  mode: 'lite',
  collapsed: true,
  collapsible: true,
  tooltip: 'Atribución y créditos',
  openPosition: 'bottom',
  order: -1,
  attributions: [{
    name: 'Autor:',
    description: " <a style='color: #0B57D0' href='https://github.com/IngenieroGeomatico' target='_blank'>IngenieroGeomático</a> "
  }]
});

mapajs.addPlugin(ext_Attribution);
```

## 🎨 Colores configurables

Los colores pueden pasarse como un color suelto (`'#ffffff'`) o como un objeto de dos estados (`{ active, deactive }`). El plugin los vuelca en línea sobre el panel como variables CSS, con estos nombres:

| Variable CSS | Origen | Uso |
|---|---|---|
| `--g-plugin-bg-color` | `color1.deactive` | Fondo en reposo. |
| `--g-plugin-bg-color-active` | `color1.active` | Fondo activo. |
| `--g-plugin-border-color` | `color2.deactive` | Borde en reposo. |
| `--g-plugin-border-color-active` | `color2.active` | Borde activo. |
| `--g-plugin-icon-color` | `color3.deactive` | Icono en reposo. |
| `--g-plugin-icon-color-active` | `color3.active` | Icono activo. |

## 🔄 Estado 2D/3D

El plugin implementa el contrato **`getState()` / `setState(state, map)`** que usa `ext/cambioImpl` al alternar entre OpenLayers y Cesium:

- `getState()` devuelve `{ collapsed: boolean, opened: boolean }`, leyendo el estado real del panel (`opened` / `collapsed`) del DOM del modo correspondiente (`.m-panel.m-attribution-lite` en `lite`, `.m-panel.g-herramienta_attribution` en `full`).
- `setState(state, map)` rehidrata el panel recién creado: si el estado capturado estaba abierto y no lo está, pulsa el botón `m-panel-btn` (y al revés).

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `constructor(options)` | Construye el plugin y resuelve los parámetros y colores. |
| `addTo(map)` | Enganche al mapa invocado por `mapajs.addPlugin(...)`; monta el modo `full` o `lite`. |
| `getHelp()` | Devuelve `{ title: 'Atribución', content: Promise }` para el gestor de ayuda de la API-IDEE. |
| `buildAttributionsHTML(mapInstance?)` | Genera el HTML de créditos (estáticas + capas del mapa), deduplicado. |
| `refresh(mapInstance?)` | Vuelve a pintar el contenido del panel/barra si ya está montado. |
| `resolveColor(c)` | Normaliza un color a `{ active, deactive }`. |
| `getState()` / `setState(state, map)` | Contrato de estado para el cambio 2D/3D. |
| `destroy()` | Suelta listeners de la API, desconecta el `MutationObserver`, desmonta la barra del modo `lite` y quita el control del mapa. |

## ✅ Notas / Limitaciones

- El botón se pinta con una **máscara SVG** del símbolo © definida en el CSS, y hereda el color de icono del esquema.
- En modo `lite`, la barra de créditos se cuelga en la **banda compartida de controles** (`ext/areaControls`, `miPlugin_areaControls`) si esa extensión está cargada; si no lo está, se ancla al pie del contenedor del mapa y el plugin sigue funcionando por sí solo.
- En 3D (Cesium) `getMapImpl()` no expone `getViewport()` ni `getTargetElement()`, por lo que el contenedor se resuelve contra `.m-api-idee-container` (o `document.body` como último recurso).
- El plugin escucha `ADDED_LAYER`, `ADDED_QUICK_LAYERS`, `ADDED_VECTOR_TILE`, `ADDED_WFS`, `ADDED_WMS`, `ADDED_WMTS`, `ADDED_XYZ`, `ADDED_TMS` y `REMOVED_LAYER` para refrescar el contenido.
- Las capas sin propiedad `attribution` simplemente no aportan entradas.
