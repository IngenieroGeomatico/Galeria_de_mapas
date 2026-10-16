# 🧩 cambioImpl — motor del cambio de implementación 2D/3D

> Recarga el bundle de la API y recrea el mapa para alternar entre OpenLayers (2D) y Cesium (3D).

Es el **motor y coordinador** del cambio de implementación 2D/3D de este repositorio. Pone un botón (un `miPlugin_*` que se registra en el mapa) que, al pulsarlo, sustituye el `<script>` de la build activa de la API por el de la implementación contraria, reemplaza el `<div>` del mapa y vuelve a ejecutar la función de arranque (`mapa()`), de forma que todas las capas y plugins se recrean desde cero. Además expone el coordinador global `window.EstadoPlugins`, el único punto que ve el mapa viejo (al capturar) y el mapa nuevo (al restaurar), y que define el contrato `getState()`/`setState(state, map)` que implementan los demás plugins para no perder su estado en el swap.

## ✨ Características

- Alterna **OpenLayers ⇄ Cesium** recargando el bundle `apiidee.ol.min.js` / `apiidee.cesium.min.js` (y su CSS) y re-ejecutando la función de arranque del visualizador.
- **Engranaje de carga** propio (`img/iconos/gear-spinner.svg`) que aparece en el mismo frame del clic, oculta el mapa viejo con `visibility: hidden` y se quita cuando el mapa nuevo está listo (teselas del globo cargadas en Cesium, `evt.COMPLETED` en OL, con tope de seguridad).
- **Coordinador global `window.EstadoPlugins`**: captura el estado de los plugins antes del swap y lo restaura (de forma diferida) sobre el mapa nuevo mediante el contrato `getState()`/`setState(state, map)`.
- **Transferencia opcional de capas** (`shareLayers`) y de la **vista** (`shareView`, centro/zoom/altitud reproyectados entre EPSG:3857 y EPSG:4326).
- **Repoblado de los namespaces** `IDEE.plugin` / `M.plugin` tras cada swap (`reRegistrarPluginsTrasSwap`), porque la build nueva recrea `window.IDEE` desde cero.
- Colores configurables (`color1`/`color2`/`color3`) y botón integrable en la barra del supraplugin.
- `destroy()` limpio: retira control, panel, `<style>` de colores, engranaje y el item del supraplugin.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `cambioImpl.js` | Define la clase `miPlugin_cambioImpl`, el coordinador `window.EstadoPlugins`, `reRegistrarPluginsTrasSwap()` y la resolución de la ruta del engranaje (`URL_ENGRANAJE`). |
| `cambioImpl.css` | Estilos del botón (círculo con el icono como máscara SVG), del panel y del engranaje de carga; también el icono del item del supraplugin. |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/cambioImpl/cambioImpl.css" />
<script type="text/javascript" src="../../ext/cambioImpl/cambioImpl.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_cambioImpl(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `buttonTitle` | `string` | `'Herramienta'` | Texto del `title`/`aria-label` del botón 2D/3D. |
| `mapsFunction` | `function` \| `{same, ol, Cesium}` | `{ ol: undefined, Cesium: undefined }` | Función(es) de arranque del mapa. Si se pasa una función única se asigna a `mapsFunction.same`; si es objeto, se leen `ol` y `Cesium` (cada uno puede ser función). Con `sameMap: true` se invoca `mapsFunction.same()`. |
| `sameMap` | `boolean` | `true` (`opts.sameMap ?? true`) | Si es `true`, el reinicio llama siempre a `mapsFunction.same()` (una sola función de arranque que se adapta). Si es `false`, se llama a `mapsFunction.ol()` o `mapsFunction.Cesium()` según el destino. |
| `shareLayers` | `boolean` | `false` (`opts.shareLayers ?? false`) | Transfiere las capas overlay (y base) del mapa viejo al nuevo al cambiar de implementación. En 3D añade `extrudedHeight` a los polígonos vectoriales y reaplica el orden `z` de las capas. |
| `shareView` | `boolean` | `false` (`opts.shareView ?? false`) | Conserva la vista (centro y zoom/altitud) reproyectando entre EPSG:3857 y EPSG:4326. |
| `order` | `number` | `null` | Valor CSS `order` del botón dentro del área de botones (`null` deja el orden por defecto de la API). Si no es un número válido, queda `null`. |
| `color1` | `string` \| `{active, deactive}` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de **fondo** del botón/panel. |
| `color2` | `string` \| `{active, deactive}` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **borde** del botón/panel. |
| `color3` | `string` \| `{active, deactive}` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color del **icono**. |

## 🚀 Ejemplo de uso

```js
// Arranque único (la misma función sirve para 2D y 3D) y cambio de vista + capas.
mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
  buttonTitle: 'cambiar impl :)',
  mapsFunction: mapa,          // se asigna a mapsFunction.same
  sameMap: true,
  shareView: true,
  shareLayers: true
}));

// Arranques separados para cada implementación.
mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
  buttonTitle: 'Cambiar implementación (2D/3D)',
  mapsFunction: { same: mapa, ol: mapa, Cesium: mapa2 },
  sameMap: false,
  shareView: true,
  shareLayers: false
}));
```

## 🧩 API pública / Métodos

| Miembro | Descripción |
|---|---|
| `name` | `'miPlugin_cambioImpl'`. Identificador con el que se registra y con el que se le excluye de la captura de estado. |
| `addTo(map)` | Invocado por `mapajs.addPlugin()`. Crea el panel, el control `Control_cambImpl` con `activate`/`deactivate` y el botón `#APIIDEE-herramienta-button`. |
| `mostrarCarga(mensaje)` | Muestra el engranaje de carga (idempotente). `mensaje` solo se usa como `title`/`aria-label`. |
| `ocultarCarga()` | Quita el engranaje de carga (idempotente). |
| `resolveColor(c)` | Normaliza un color `string` u objeto a `{active, deactive}`. |
| `getSupraElement(supra)` | Devuelve el nodo del botón para colgarlo de la barra del supraplugin (`supra.addItem(plugin)`); oculta el botón del mapa y sincroniza el estado `activated`. |
| `destroy()` | Desmonta el plugin: quita control, panel, `<style>` de colores, engranaje, item del supraplugin y `window.control_cambImpl`. |

> El método interno del control `control_cambImpl.activate()` cambia a **Cesium** y `control_cambImpl.deactivate()` vuelve a **OpenLayers**. El botón alterna entre ambos según la clase `activated`.

## 🔄 Contrato de estado 2D/3D (`window.EstadoPlugins`)

El plugin recarga el bundle de la API al alternar, así que **todos los plugins se re-instancian desde cero**. Para no perder su estado, este plugin publica `window.EstadoPlugins` (que sobrevive al swap porque solo se recarga la build de la API, no `window`):

- `EstadoPlugins.capturarTodo(mapViejo)` → `{ nombrePlugin: estado }`. Llama a `plugin.getState()` si existe; si no, busca un adaptador registrado con `EstadoPlugins.registrar()`. Se salta siempre al propio `miPlugin_cambioImpl`.
- `EstadoPlugins.restaurarTodo(mapNuevo, estados, diferido)` → llama a `plugin.setState(estado, mapNuevo)`. Con `diferido: true` espera al evento `evt.COMPLETED` del mapa nuevo y, además, reintenta a los 1200 ms por si el evento ya se disparó o no llega.
- `EstadoPlugins.registrar(nombre, { capturar(plugin) → state, restaurar(plugin, state, map) })` → adaptador externo para plugins que no implementan el contrato o que no se pueden tocar.

**Contrato que debe cumplir cada plugin**:

```js
// Devuelve un objeto SERIALIZABLE con el estado MÍNIMO de la UI.
getState() { return { /* ... */ }; }

// Rehidrata la instancia nueva. NO asumir que los idLayer antiguos existen:
// resolver por id con fallback por legend/name.
setState(state, map) { /* ... */ }
```

Los plugins sin contrato se ignoran sin error (migración incremental). Al guardar un id de capa, guardar también su `legend`/`name` y resolver en `setState` por id con fallback por legend (patrón `_findLayerByIdInMap`/`_findLayerByLegendInMap` de `ext/selectorCapas/ext_layerSwitcher.js`).

## 🌐 Globales

| Global | Descripción |
|---|---|
| `window.miPlugin_cambioImpl` | Global directo de la clase. Es el que sobrevive al reinicio de `window.IDEE` y la fuente que usa `reRegistrarPluginsTrasSwap()` para repoblar los namespaces. |
| `window.IDEE.plugin.miPlugin_cambioImpl` / `window.M.plugin.miPlugin_cambioImpl` | Registro en los namespaces de la API (se pierden al recargar el bundle y se repueblan en cada swap). |
| `window.control_cambImpl` | El control (`M.Control`) de esta instancia, compartido por el visor; se retira en `destroy()`. |
| `window.EstadoPlugins` | Coordinador de estado entre implementaciones (definido aquí). |
| `reRegistrarPluginsTrasSwap()` | Repuebla `IDEE.plugin`/`M.plugin` con los `window.miPlugin_*` y ejecuta el método `exponer()` de los globales `window.mi*` que lo tengan (para re-registros colgados aparte, p. ej. `window.IDEE.catalog`). |
| `IDEE` / `M` | Alias intercambiables del global de la API; `cambioImpl()` hace `M = IDEE` antes de reiniciar. |

## ✅ Notas / Limitaciones

- **No modificar `ext/layergroup_cesium/`** como parte de este plugin: es una utilidad aparte que, sin embargo, se apoya en el momento del swap (su parche se re-aplica cada 10 ms porque `cambioImpl` recrea `window.IDEE`).
- El propio plugin **no expone `getState()`/`setState()`**: se excluye siempre de la captura (su UI se reconstruye completa en cada swap).
- El mapa viejo se oculta con `visibility: hidden` (no se vacía) en el mismo frame: vaciarlo rompería `reiniciarMapa()`, que localiza el `<div>` del mapa subiendo por `parentElement.parentElement.id`.
- El engranaje se cuelga del **padre** del nodo del mapa, que es lo único que sobrevive al reinicio.
- `shareView` usa `localStorage.setItem('EPSG_OL', ...)` para recordar la proyección origen y `map.zoom_meters` para convertir zoom↔altitud.
- El plugin está pensado para alternar builds de la API que **recrean `window.IDEE`** al ejecutarse: de ahí el sondeo de `loadConfig(tipo)` cada 100 ms esperando `IDEE.impl.cesium`/`IDEE.impl.ol`.
