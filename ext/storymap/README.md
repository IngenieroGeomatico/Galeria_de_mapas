# 🧩 StoryMap

> Relato guiado capítulo a capítulo sobre el mapa, en 2D y en 3D.

Versión local del plugin StoryMap de la CDN de API-IDEE, autocontenida y adaptada al patrón
`miPlugin_*` del repositorio. Se reescribió en local porque al alternar 2D/3D (`cambioImpl`) se
recarga el bundle de la API y se reinicializa `window.IDEE`, con lo que desaparecen los registros
previos en `IDEE.plugin.StoryMap`; instanciar la clase directamente y resolver el global con
`api_storymap()` permite que el plugin sobreviva y funcione igual en OpenLayers y en Cesium.

El panel muestra los capítulos (`.chapters`, `id="capN"`) y, dentro de cada uno, los pasos
(`.step`, `id="stepN"`), con navegación por puntos, reproducción automática (autoplay) con control
de velocidad y avance por scroll o rueda. Los scripts de cada paso se inyectan en ámbito global, así
que **el visualizador debe exponer en `window` las variables que usen** (p. ej. las capas), igual que
en el plugin oficial.

## ✨ Características

- **Contenido por idioma**: `content: { es: {...}, en: {...} }`; se resuelve con `IDEE.language.getLang()`
  y cae a `es`.
- **Tarjeta de índice inicial** opcional (`indexInContent`) con título, subtítulo, JS y `<ol id="indexContent">` navegable.
- **Autoplay** con velocidades 0.5x, 1x, 2x, 3x y 5x; el tiempo de cada paso es proporcional al número
  de bloques de texto (`countStrings`) y el motor avanza solo (scroll/wheel quedan bloqueados durante la reproducción).
- **Navegación por puntos** de capítulos (`#navPointer`) y de pasos (`#navStep`), con efecto de resalte.
- **Avance por scroll y por rueda**: al llegar al final del texto se pasa al paso siguiente, y con
  **tres gestos consecutivos de rueda** en el borde cuando el paso no genera scroll.
- **`waitForLayers`**: espera a que las capas indicadas tengan features antes de ejecutar el JS de un paso
  (evita que el paso filtre sobre un GeoJSON aún vacío y recentre el mapa en el extent mundial).
- **Contrato de estado** `getState()`/`setState()`: conserva capítulo, paso, scroll, velocidad y plegado
  al alternar 2D/3D.
- **Panel arrastrable** opcional y gestión móvil (≤ 772 px) que oculta el resto de paneles al abrirse.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `storymap.js` | Clase `miPlugin_storymap` y helper `api_storymap()`. Construye el `IDEE.ui.Panel('panelStoryMap')` con el control `StoryMapControl` y toda la lógica de capítulos, pasos, autoplay, scroll y estado. Se expone como global directo y en `IDEE.plugin` / `M.plugin`. |
| `storymap.css` | Estilos del panel (`m-plugin-storymap` plegado/abierto, botón con glifo `content:"📖"`), cabecera, reproductor, menú de velocidad, contenido de capítulos/pasos, puntos de navegación y flecha de scroll. Colores vía `--g-plugin-*`. |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/storymap/storymap.css" />
<script type="text/javascript" src="../../ext/storymap/storymap.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_storymap(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TR'` | Posición del panel: `'TL'`, `'TR'`, `'BL'`, `'BR'` (se traduce con `IDEE.ui.position[position]`). |
| `collapsed` | `boolean` | `false` | Estado inicial plegado. |
| `collapsible` | `boolean` | `true` | Permite plegar el panel. |
| `tooltip` | `string` | `'Story Map'` | Tooltip del botón del panel. |
| `content` | `Object` | `{}` | Contenido por idioma: `{ es: { cap: [ { title, subtitle, steps: [ { html, js } ] } ] } }`. Se usa `content[lang]` con fallback a `content.es` y, si no hay, `{ cap: [] }`. |
| `delay` | `number` | `2000` | Retardo base del autoplay en **ms** (ritmo a 1x; entra en el multiplicador de velocidad). |
| `indexInContent` | `Object` \| `false` | `false` | Tarjeta de índice inicial: `{ title, subtitle, js }`. Se antepone como capítulo 0 y no muta el JSON original (copia superficial de `cap`). |
| `waitForLayers` | `string[]` | `[]` | Nombres de variables expuestas en `window` (p. ej. `'layerVectorialGJSON_Libro'`) que deben tener features cargadas antes de ejecutar el `js` de un paso. Solo entran las que tengan `getFeatures`. |
| `isDraggable` | `boolean` | `false` | Habilita el arrastre del panel por su cabecera (`IDEE.utils.draggabillyPlugin`). |
| `order` | `number` | `null` | Posición del panel dentro del área de botones (valor CSS `order`): `-1` por delante de todos, `0` primera posición, `2` detrás de los de `0`, `99` al final. `null` = sin valor explícito. |
| `color1` | `string` \| `{active,deactive}` | `{ active:'#ffffff', deactive:'orangered' }` | Color de **fondo**. |
| `color2` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **borde**. |
| `color3` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **icono y texto**. |

## 🚀 Ejemplo de uso

Basado en `mapas/LucesdeBohemia/js/mapa.js`:

```js
const mp_StoryMap = new IDEE.plugin.miPlugin_storymap({
  collapsed: false,
  collapsible: true,
  position: 'TR',
  content: {
    es: StoryMapJSON,          // { head, cap: [ { title, subtitle, steps: [ {html, js} ] } ] }
  },
  indexInContent: {
    title: 'Luces de bohemia',
    subtitle: 'Ramón María del Valle-Inclán',
    js: "console.log('BLAAAAAAAAAAA');",
  },
  waitForLayers: ['layerVectorialGJSON_Libro', 'layerVectorialGJSON_Madrid'],
  delay: 10000,
});

mapajs.addPlugin(mp_StoryMap);
```

> El plugin fija `window.map` y `window.mapjs` con el mapa anfitrión, porque los scripts de los pasos
> se inyectan en ámbito global y los usa ese contrato heredado del plugin oficial.

## 🎨 Colores

`resolveColor()` normaliza cada color (string o `{active, deactive}`) y `addTo()` inyecta las seis
variables del esquema común **en el panel**:

| Opción | Variables CSS |
|---|---|
| `color1` | `--g-plugin-bg-color` (`deactive`), `--g-plugin-bg-color-active` (`active`) |
| `color2` | `--g-plugin-border-color`, `--g-plugin-border-color-active` |
| `color3` | `--g-plugin-icon-color`, `--g-plugin-icon-color-active` |

## 🔄 Estado 2D/3D

Contrato `getState()` / `setState(state, map)` (coordinado por `window.EstadoPlugins` en `cambioImpl`):

- `getState()` devuelve `{ capIndex, stepIndex, isAutoPlaying, speed, collapsed, scrollTop }`.
  - `capIndex`/`stepIndex` salen de `control.capIndex()` (capítulo y paso visibles);
  - `speed` se lee de la opción activa de `#speedMenu` y, si no, se deriva del atributo `speed` de `#buttonDelay`;
  - `collapsed` se lee de `panel.isCollapsed()` con fallback a las clases `collapsed`/`opened` del panel;
  - `scrollTop` es el scroll del paso activo. Si no hay control, devuelve `null`.
- `setState(state, map)` rehidrata la instancia nueva: actualiza `window.map`/`window.mapjs`, acota
  `capIndex`/`stepIndex` a los capítulos/pasos reales, muestra el capítulo y el paso, recrea los puntos
  de navegación, refresca efectos y título/subtítulo, restaura `scrollTop`, **re-ejecuta el `js` del paso
  sobre el mapa nuevo** (`addJSCap`), restaura la velocidad y el plegado, y **deja el autoplay pausado**
  a propósito (para no competir con la carga asíncrona de capas/teselas).

## 🧩 Métodos y contrato DOM

Métodos de la clase:

| Método | Descripción |
|---|---|
| `addTo(map)` | Alta en el mapa: crea el control `StoryMapControl`, el panel `panelStoryMap` (clase `m-plugin-storymap`, `collapsedButtonClass:'icon-capas2'`) y lo registra con `map.addPanels([panel])`. Aplica colores, arrastre opcional y gestión móvil. |
| `getHelp()` | Ayuda para el gestor de la API: `{ title:'Story Map', content: Promise<html> }`. |
| `getState()` / `setState(state, map)` | Ver «Estado 2D/3D». |
| `destroy()` | Limpia temporizadores (`clearTimers`), retira el control del mapa (`map.removeControls`) y anula referencias. |
| `resolveColor(c)` | Devuelve `{active, deactive}` a partir de un color simple o de un objeto. |

Métodos del control (accesibles como `plugin.control` / `plugin.control_`, **sobrescribibles desde el visualizador**):

| Método | Descripción |
|---|---|
| `capIndex(idContainer, idElement)` | Devuelve el índice del elemento visible (`display:block`) o `false`. Sustituible desde el visualizador (`mp_StoryMap.control.capIndex = function(){...}`). |
| `createView(mapInstance)` | Construye el DOM completo del panel (cabecera, reproductor, `#navPointer`, `#navStep`, `#contentStoryMap`, flecha de scroll) y enlaza todos los eventos. |
| `createContent(html, indexInContent)` | Genera los capítulos y pasos desde el JSON; antepone la tarjeta de índice si procede. |
| `addJSCap(indexCap, indexStep)` | Inyecta el `js` del paso como `<script id="storyMap_jsCap">` global, esperando a `waitForLayers` si es necesario (evento `LOAD`/`on`/`once` + sondeo cada 150 ms y red de seguridad a 5 s). |
| `avanzarPaso()` / `retrocederPaso()` | Cambian de paso (o de capítulo) y devuelven `true` si hubo cambio. |
| `timeCap()` | Motor del autoplay; devuelve el token de reproducción. `stopAutoplay()` lo detiene limpio (token, rAF y timers). |
| `buttonDelay(html)` | Botón y menú de velocidad (`.speed-option`, `data-value` 0.5/1/2/3/5). Bajo `.speed-label` y `aria-expanded`. |
| `disableCap` / `disableStep` / `changeTitleSubtitle` / `createNavPointer` / `createPointerSteps` / `effectPointer` / `resetScroll` / `handleMovil` / `clearTimers` | Piezas de navegación y presentación del panel. |

Contrato DOM esperado (necesario para que el visualizador pueda redefinir `control.capIndex`):

| Selector | Contenido |
|---|---|
| `#contentStoryMap` | Contenedor de capítulos. |
| `.chapters` (`id="capN"`) | Un `div` por capítulo (`display: block/none`). |
| `.step` (`id="stepN"`) | Un `div` por paso dentro de cada capítulo (`display: block/none`). |
| `#title_contentStoryMap`, `#subtitle_contentStoryMap` | Título y subtítulo del capítulo activo. |
| `#navPointer`, `#navStep` | Puntos de navegación de capítulos y de pasos. |
| `#play`, `#pause`, `#buttonDelay`, `#speedMenu` | Controles del reproductor. |
| `.arrowScroll` | Flecha de «seguir leyendo» (baja el primer paso al pasar el ratón). |
| `#indexContent` | Índice de capítulos de la tarjeta inicial. |

## ✅ Notas

- No implementa `getSupraElement()`, así que **no es un item de supraplugin**: se monta con
  `mapajs.addPlugin(...)` como plugin de botón y panel.
- El panel vive dentro del área de paneles de la API (`IDEE.ui.Panel`), con la clase `m-plugin-storymap`.
- Al reejecutarse `mapa()` tras un cambio 2D/3D, el JSON de contenido no se muta (la tarjeta de índice
  se antepone a una copia de `cap`).
- Validación de sintaxis tras editar: `node --check ext/storymap/storymap.js`.
