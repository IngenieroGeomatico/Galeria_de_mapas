# 🧩 Comparación de vistas

> Compara varias instancias de mapa (2D y 3D) en la misma pantalla, sincronizadas.

Reimplementación sin dependencias externas (ni `virgilio` ni `ol-ext`) del comparador de mapas
clásico de la API-IDEE. La clave de su arquitectura es que **cada vista es un `<iframe>`** cuyo
documento genera el propio plugin vía `srcdoc` y que carga su propia API-IDEE en 2D (OpenLayers) o
3D (Cesium): la API usa un único global `IDEE` ligado a un bundle, así que solo aislando cada vista
en su iframe pueden convivir una vista 2D y otra 3D a la vez. El encuadre se sincroniza entre ellos
por `postMessage`, y la ventana sincronizada (pestaña o popup) por `BroadcastChannel`.

Es un **item de supraplugin**: la clase implementa `getSupraElement(supra)`, y además construye su
**propia barra** `miPlugin_supraplugin` al abrirse (por eso el visualizador debe cargar también
`ext/supraplugin/`).

## ✨ Características

- **Vistas en iframe autocontenidas**: `srcdoc` generado en caliente; no hay `vista.html`/`vista.js`.
- **2D y 3D conviviendo**: cada celda puede llevar OpenLayers o Cesium, indistintamente.
- **Sincronización de encuadre** por centro + resolución real (m/px) + orientación (rotación 2D,
  `heading`/`pitch`/`roll` en Cesium), con guard anti-eco por vista (`_progUpdates`).
- **Cuatro modos**: `single` (una vista), `swipe` (cortinilla con divisor), `mirror` (rejilla
  sincronizada) y `molde` (una figura SVG recorta la vista superior y por la abertura se ve la base).
- **Gestión de vistas** en el panel de opciones: crear (clonando el encuadre activo), renombrar,
  eliminar, cambiar 2D/3D por vista, nº de columnas y sincronización on/off.
- **Ventana sincronizada**: abre una pestaña o popup (opción `windowKind`) que refleja la sesión.
- **Barra propia con cierre y supraplugins anidados**: el botón del área abre/cierra el comparador;
  `addSupraplugin()` permite colgar barras hijas en cascada.
- **Contrato de estado** `getState()`/`setState()` para sobrevivir al cambio 2D/3D de `cambioImpl`.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `comparacionVistas.js` | Clase `miPlugin_comparacionVistas` (IIFE). Incluye el motor de las vistas (`_vistaBoot`, serializado a `srcdoc`), el de la ventana sincronizada (`_ventanaBoot`), la UI de la barra y el panel de opciones. Expone la clase como global directo y en `IDEE.plugin.*` / `M.plugin.*`. |
| `comparacionVistas.css` | Estilos del botón del área, la barra de comparación, el escenario con las celdas/iframes, los divisores (cortinilla), el «molde», el spinner de carga y el sidenav de opciones. Paleta propia `--cmpv-*` para divisores y tirador. |

**Dependencia obligatoria**: `ext/supraplugin/supraplugin.css` y `ext/supraplugin/supraplugin.js`.
El comparador crea su barra con `API.plugin.miPlugin_supraplugin`; sin ese script, al abrir avisa por
consola («no hay miPlugin_supraplugin: el comparador no abre su barra») y no monta nada.

## 🔧 Integración en un visualizador

```html
<!-- Dependencia: la barra que usa el comparador -->
<link rel="stylesheet" href="../../ext/supraplugin/supraplugin.css" />
<script type="text/javascript" src="../../ext/supraplugin/supraplugin.js"></script>

<!-- Comparador de vistas -->
<link rel="stylesheet" href="../../ext/comparacionVistas/comparacionVistas.css" />
<script type="text/javascript" src="../../ext/comparacionVistas/comparacionVistas.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_comparacionVistas(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `id` | `string` | `"comparacionVistas-" + N` | Identificador único del comparador (contador interno del IIFE). |
| `mode` | `"single"` \| `"swipe"` \| `"mirror"` \| `"molde"` | `"single"` | Modo de comparación con el que arranca. Cualquier otro valor cae a `"single"`. |
| `swipe` | `Object` | `{ layout: "1x1" }` | Configuración de la cortinilla. `layout`: `"1x1"` (2 vistas: izq \| der), `"2x1"` (3), `"1x2"` (3) o `"2x2"` (4). |
| `layout` | `Object` | `{ type: "grid", rows: 1, cols: 2 }` | Reparto del espejo. `{ type:"grid", rows, cols }` o `{ type:"custom", spec:[1,3,1] }` (celdas por fila). |
| `views` | `Array<Object>` | sin definir | Vistas iniciales. Si **no** se declara, las deriva del mapa anfitrión (implementación, encuadre y capas; ver `_capturarMapaVivo`). Ver «Vistas iniciales» abajo. |
| `slots` | `Array<number\|string>` | sin definir | Qué vista ocupa cada slot inicial (por índice o por id). |
| `sync` | `boolean` | `true` | Sincronizar el encuadre entre vistas (`options.sync !== false`). |
| `syncMode` | `"extent"` \| `"center"` | `"extent"` | Estrategia de sincronización. Cualquier valor distinto de `"center"` usa `"extent"`. |
| `showControls` | `boolean` | `true` | Mostrar controles/plugins de IDEE y el botón 2D/3D dentro de cada vista. |
| `windowKind` | `"tab"` \| `"popup"` | `"tab"` | Cómo abrir la ventana sincronizada: pestaña reutilizable o ventana nueva. |
| `mold` | `Object` \| `Array<Object>` | `[{}]` | Molde(s). Cada uno: `id`, `shape` (`circle`, `ellipse`, `rect`, `triangle`, `diamond`, `pentagon`, `hexagon`, `octagon`, `star`, `heart`, `duck`), `topId` (vista recortada), `cx`, `cy` (% del escenario), `radius` (% del lado menor), `angle` (grados), `followPointer`, `zoom` (aumentos de lupa). Por defecto `shape:"circle"`, `cx:50`, `cy:50`, `radius:25`, `angle:0`. |
| `lon` | `number` | `-3.70` | Centro inicial (longitud). Retrocompatibilidad. |
| `lat` | `number` | `40.42` | Centro inicial (latitud). Retrocompatibilidad. |
| `zoom` | `number` | `12` | Zoom inicial. Retrocompatibilidad. |
| `icon` / `icono` / `svg` | `string` | `null` | Icono del botón del área (SVG en línea o ruta/URL). Se pinta como máscara en `--g-plugin-icon-mask`. |
| `color1` | `string` \| `{active,deactive}` | `{ active:'#ffffff', deactive:'orangered' }` | Color de **fondo**. |
| `color2` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **borde**. |
| `color3` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **icono y texto**. |
| `tituloBarra` | `string` | `"Comparación de vistas"` | Título de la barra propia que construye al abrirse. |

### Vistas iniciales (`options.views`)

Cada entrada admite:

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | `string` | Nombre de la vista. Por defecto `"Vista N"`. |
| `implementation` | `"2D"` \| `"3D"` \| `"ol"` \| `"cesium"` | Motor de la vista. Se normaliza a `"ol"` o `"cesium"` (`_normalizeImpl`); todo lo que no sea `cesium`/`3D` cae a `"ol"`. |
| `center` | `[lon,lat]` \| `{lon,lat}` | Centro en **grados** (EPSG:4326). |
| `zoom` | `number` | Zoom inicial de esa vista. |
| `isPrimary` | `boolean` | Vista principal (la que se clona al pulsar «Crear vista»). Si ninguna la declara, se marca la primera. |
| `layers` | `Array<IDEE.layer.* \| string>` | Capas, como objeto `IDEE.layer.*` (se serializan con `constructorParameters`) o como string de definición API-IDEE. |
| `plugins` | `Array<IDEE.plugin.* \| {name, params}>` | Plugins a instanciar dentro de la vista. |
| `controls` | `Array<string>` | Controles API-IDEE (`["scale","panzoom", ...]`). |

> No se aceptan objetos `IDEE.map`: el motor OL/Cesium es único por documento. Sí se aceptan
> `IDEE.layer` / `IDEE.plugin`, que se serializan y se reconstruyen dentro de cada iframe.

## 🚀 Ejemplo de uso

### Suelto, como plugin del área (el visualizador es el mapa principal)

```js
mapajs = IDEE.map({
  container: 'mapaDIV',
  center: { x: -411882.1, y: 4927164.5 },  // Madrid (EPSG:3857)
  zoom: 12,
});

// SIN vistas: el comparador las deriva de este mapa (implementación, encuadre
// y capas). El reparto lo pone `layout` y cada celda lleva un motor distinto.
const comparador = new IDEE.plugin.miPlugin_comparacionVistas({
  id: 'comparador-principal',
  mode: 'mirror',
  layout: { type: 'grid', rows: 1, cols: 2 },
  sync: true,
  showControls: true,
  icon: '../../img/iconos/compare-map.svg',
});

mapajs.addPlugin(comparador);   // pinta su botón en el área; al pulsarlo abre su barra
```

### Como item de la barra de herramientas del visualizador

```js
const supra = new IDEE.plugin.miPlugin_supraplugin({
  id: 'supra-visualizador2', position: 'top', title: 'Herramientas',
  collapsed: true, pinned: false, collapsible: true, peek: true,
});

const comparador = new IDEE.plugin.miPlugin_comparacionVistas({
  id: 'comparador',
  mode: 'mirror',
  layout: { type: 'grid', rows: 1, cols: 2 },
  sync: true,
  showControls: true,
  icon: '../../img/iconos/compare-map.svg',
});

supra.addItem(comparador);      // el botón de la barra alterna el sidenav del comparador
mapajs.addPlugin(comparador);   // registrarlo es lo que conserva su estado en el cambio 2D/3D
```

### Con vistas declaradas y configuración externa por URL

```js
const comparador = new IDEE.plugin.miPlugin_comparacionVistas({
  id: 'comparador-dos-vistas',
  mode: 'swipe',
  swipe: { layout: '1x1' },
  sync: true,
  showControls: false,
  views: [
    {
      name: 'Madrid 2D',
      implementation: '2D',
      center: [-3.7038, 40.4168],
      zoom: 12,
      isPrimary: true,
      controls: ['scale'],
      layers: [
        { type: 'TMS', params: { url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg', legend: 'IGNBaseTodo' } },
      ],
    },
    {
      name: 'Madrid 3D',
      implementation: '3D',
      center: [-3.7038, 40.4168],
      zoom: 12,
    },
  ],
});
mapajs.addPlugin(comparador);
```

El visualizador `mapas/comparacionVistas/` añade además una **configuración externa por URL**: el
parámetro GET `configViewsJSON` acepta la URL de un JSON con la misma estructura que `options`.
La lectura del parámetro y la rehidratación de capas planas (`{type,params}` → `new IDEE.layer.<type>(params)`)
se hacen en `js/mapa.js` del visualizador, no en el plugin:

```text
index.html?configViewsJSON=./config-ejemplo.json
index.html?configViewsJSON=https://mi-servidor/mi-config.json
```

## 🎨 Colores

- `color1`/`color2`/`color3` se normalizan con `resolveColor()` (acepta string o `{active, deactive}`)
  y se escriben **en línea** como variables del esquema común del repositorio: `--g-plugin-bg-color(-active)`,
  `--g-plugin-border-color(-active)` y `--g-plugin-icon-color(-active)`.
- Se aplican al **botón del área** en `addTo()` (el panel del mapa las propaga) y al **contenedor de la
  barra** al montarse, de modo que los items de la barra que no declaren color propio las heredan.
- El comparador tiene además su propia paleta `--cmpv-*` en `comparacionVistas.css` para la barra de
  división y su tirador; los valores por defecto del divisor son `color:"#ffffff"`, `width:4`,
  `handleColor:"#f57105"`, `handleSize:32`.

## 🔄 Estado 2D/3D

Implementa el contrato `getState()` / `setState(state, map)` coordinado por `window.EstadoPlugins` en
`cambioImpl`:

- `getState()` → `_snapshot()`: objeto serializable con `views` (id, nombre, impl, `isPrimary`,
  `lastView` —lon/lat/zoom/resolution/rotation/heading/pitch/roll/extent—, `config` serializada),
  `mode`, `activeViewId`, `sync`, `syncMode`, `showControls`, `swipe` (layout, slots y posiciones de
  los tres divisores), `grid`, `layoutType`, `customSpec`, `divStyle`, `mold` (base, seleccionado y
  lista de moldes), `syncWinKind`, `syncViewId` y `syncSid`. Si algo falla, devuelve `null`.
- `setState(state, map)` → `_applySnapshot(state)`: recrea vistas, re-aplica modo, divisores y
  sincronización. Es no bloqueante (los iframes se rehidratan por `postMessage`, sin esperar respuestas).

Los `idLayer` **no** se guardan: en cada swap las capas se recrean desde `config`, que guarda la
definición serializable del plugin (tipo + parámetros) o el string API-IDEE.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Alta en el mapa: monta el botón del área (panel `toolsExtra_comparacion`, control propio con `equals` estricto). Devuelve `this`. |
| `getSupraElement(supra)` | Contrato de item. Montado en **su propia** barra devuelve la UI completa (herramientas + `_refreshUI`); montado en la barra de **otro** supraplugin devuelve solo un botón que alterna el sidenav. |
| `addSupraplugin(supra)` | Cuelga un supraplugin anidado en cascada (antes o después de abrir la barra). |
| `abrirBarra()` / `cerrarBarra()` / `barraVisible()` / `alternarBarra()` | Ciclo de la barra propia: la crea la primera vez (con `cerrar:true` y `onCerrar`), enseña/oculta el escenario y el botón del área. |
| `crearVista(opts)` | Crea una vista clonando el encuadre y la config de la activa. |
| `verVista(id)` / `eliminarVista(id)` / `getView(id)` / `toggleImpl(id)` | Elige la vista principal, elimina una vista, obtiene el registro interno de una vista o alterna su motor 2D↔3D. |
| `toggleOpciones(force)` | Abre/cierra el sidenav de opciones. |
| `abrirVentanaSincronizada(vid)` | Abre la ventana (pestaña o popup según `windowKind`) sincronizada con la sesión. |
| `getState()` / `setState(state, map)` | Contrato de estado (ver arriba). |

## ✅ Notas

- El plugin es **autocontenido**: no depende de `vista.html`, `vista.js` ni de la CDN de componentes
  (los iframes cargan la API desde `https://componentes.idee.es/api-idee` y aplican su propia
  configuración de capas base IGN, `IDEE.proxy(false)` y `IDEE.config.backgroundlayers`).
- La sincronización es **centro + resolución (m/px) + orientación**, no por extent: con la cámara
  rotada o inclinada, el extent es la caja que envuelve el área girada y encajarla no replica la
  imagen. En Cesium la resolución se mide sobre el terreno y se convierte a altitud descontando la
  elevación (`cesiumGroundHeight`), con convergencia diferida en `postRender`.
- El botón 2D/3D de cada vista **no recarga por `location`**: emite `cmpv:implChange` y el padre
  regenera el `srcdoc` con la otra implementación.
- Mensajes internos por `postMessage`: recibe `cmpv:setView`, `cmpv:getView`, `cmpv:setControls`,
  `cmpv:setConfig`, `cmpv:updateSize`; emite `cmpv:ready`, `cmpv:view`, `cmpv:implChange`. La ventana
  sincronizada usa `cmpvSync:hello`, `cmpvSync:state` y `cmpvSync:view` (BroadcastChannel, o
  `postMessage` con `window.opener` bajo `file://`, donde el origen opaco impide el canal).
- El visualizador debe exponer en `window` lo que necesiten las vistas heredadas del mapa vivo
  (las capas las serializa el propio plugin con `constructorParameters`).
- Validación de sintaxis tras editar: `node --check ext/comparacionVistas/comparacionVistas.js`.
