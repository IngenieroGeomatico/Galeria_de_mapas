# 🧩 Botón de ubicación (Mi ubicación)

> Botón de GPS que pide la posición al navegador y centra el mapa sobre ella, en 2D y en 3D.

El control de ubicación (`location`) del constructor `IDEE.map({ controls })` lo dibuja la propia API como un botón con icono GPS en las áreas de esquina, pero **Cesium (3D) no sabe construirlo**: lanza `"La implementación usada no puede crear controles Location"` y aborta la creación del mapa al conmutar 2D/3D.

Este plugin resuelve el problema sin reimplementar la geolocalización en 2D, donde no hace falta: reutiliza el control nativo `IDEE.control.Location` y lo cuelga en el mapa **en caliente**. Añadirlo en caliente (y no en `IDEE.map({ controls })`) es justo lo que permite decidir la implementación antes de crearlo. En 3D, donde el control nativo no existe, el plugin dibuja el mismo panel a mano y mueve la cámara y la marca con la API de Cesium.

## ✨ Características

- 📍 **Un solo botón, dos motores**: control nativo de la API en 2D y panel propio en 3D, con la misma apariencia.
- 🔁 **Seguimiento opcional** de la posición: `watchPosition` continuo (`tracking`) o una sola lectura con `getCurrentPosition`.
- 🎥 **Cámara inteligente en 3D**: baja a una altura de ciudad si se está viendo el mundo entero y respeta la altura actual si ya se está más cerca.
- 🟣 **Marca de posición** en 3D mediante una entidad de Cesium, con `trackedEntity` cuando hay seguimiento.
- 🧭 **Posicionamiento en la misma esquina** que en 2D (`.m-area.m-bottom.m-right`) y con el mismo `order` dentro de la columna.
- 🎨 **Colores configurables** (`color1`, `color2`, `color3`) inyectados como variables CSS.
- 💾 **Contrato de estado** `getState()` / `setState()` para sobrevivir al cambio de implementación 2D/3D.
- 🔌 **Exposición triple** del global (`window`, `IDEE.plugin`, `M.plugin`) para sobrevivir a la recarga del bundle de la API.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `controlLocation.js` | Clase `miPlugin_controlLocation`: resolución de la implementación activa, montaje del control nativo en 2D, panel y geolocalización propios en 3D, colores, contrato de estado y ciclo de vida (`addTo` / `destroy`). |
| `controlLocation.css` | Estilos del botón (`IDEE.control.Location` en 2D o copia propia en 3D): oculta la flecha de plegado, fuerza fondo, borde y color de icono del esquema con las variables `--g-plugin-*`. |

## 🔧 Integración en un visualizador

Vincula los recursos **después** de la API-IDEE y **antes** de `js/mapa.js`:

```html
<!-- Estilos -->
<link type="text/css" rel="stylesheet" href="../../ext/controlLocation/controlLocation.css">
<!-- Script -->
<script src="../../ext/controlLocation/controlLocation.js" type="text/javascript"></script>
```

> En las etapas de `CaminoDeLosFaros` las rutas llevan un nivel más: `../../../../ext/controlLocation/...`

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_controlLocation(options)`

El constructor **funciona sin argumentos**: todas las opciones son opcionales.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `visible` | `boolean` | `true` | Estado inicial de visibilidad del botón. |
| `order` | `number` | `undefined` (sin valor) | Orden dentro de la columna de esquina (es el `order` CSS del panel de la API, aplicado con `control.setOrder(order)`). Si no se pasa, el panel queda al final. No se aplica si el valor no es numérico. |
| `tracking` | `boolean` | `true` | El control nativo distingue si **sigue** la posición de forma continua o solo centra una vez. Por defecto `true`, que es el comportamiento del control `location` de la API. En 3D el seguimiento se implementa con `watchPosition` y `trackedEntity`. |
| `altura3D` | `number` | `1500` | Altura de cámara en metros a la que se baja al localizar estando muy alto (vista de mundo). Solo se acepta si es mayor que 0. |
| `alturaMinima3D` | `number` | `20000` | Por debajo de esta altura de cámara (m) no se cambia la altura: se va a la posición con la que se está, que es lo esperado al pulsar el botón a escala de ciudad. Solo se acepta si es mayor que 0. |
| `color1` | `string\|Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de **fondo**. |
| `color2` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **borde**. |
| `color3` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **icono y texto**. |

## 🚀 Ejemplo de uso

Ejemplo real del repositorio (`mapas/CaminoDeLosFaros/etapas/*/js/etapa.js`), ampliado con las opciones disponibles:

```js
// Botón "mi ubicación". En 2D se apoya en el control nativo de la API y en 3D
// lo dibuja el propio plugin, porque Cesium no sabe construir ese control.
mapjs.addPlugin(new IDEE.plugin.miPlugin_controlLocation());

// Con opciones:
mapjs.addPlugin(new IDEE.plugin.miPlugin_controlLocation({
  visible: true,
  order: -1,          // primer botón de la columna de esquina
  tracking: true,     // seguir la posición de forma continua
  altura3D: 1500,     // altura de ciudad al localizar desde la vista de mundo
  alturaMinima3D: 20000,
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' }
}));
```

## 🎨 Colores configurables

Los colores se aceptan como color suelto (`'#ffffff'`) o como objeto `{ active, deactive }`. El plugin los escribe **en línea** sobre el panel del control como variables CSS, que consume `controlLocation.css`:

| Variable CSS | Origen |
|---|---|
| `--g-plugin-bg-color` / `--g-plugin-bg-color-active` | `color1.deactive` / `color1.active` |
| `--g-plugin-border-color` / `--g-plugin-border-color-active` | `color2.deactive` / `color2.active` |
| `--g-plugin-icon-color` / `--g-plugin-icon-color-active` | `color3.deactive` / `color3.active` |

El botón no se abre ni se cierra, por lo que lo que se ve es el **estado de reposo** (`deactive`); el `active` queda declarado por si un visualizador quiere distinguirlo.

## 🔄 Estado 2D/3D y comportamiento por implementación

| Aspecto | 2D (OpenLayers) | 3D (Cesium) |
|---|---|---|
| Montaje | `new IDEE.control.Location(tracking, false, {})` + `map.addControls([control])` | Panel propio `.m-panel.m-location.opened.no-collapsible.g-controlLocation` en `.m-area.m-bottom.m-right`, con el botón `#m-location-button` |
| Geolocalización | La pone el control nativo de la API | `navigator.geolocation` con `watchPosition` si `tracking`, si no `getCurrentPosition` (opciones: `enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 300000`) |
| Cámara | No aplica (la gestiona la API) | `camera.flyTo({ destination, duration: 2 })`, con `setView` como respaldo |
| Marca | No aplica | Entidad de Cesium (`point` de 12 px, `HeightReference.CLAMP_TO_GROUND`) y `trackedEntity` si `tracking` |

El plugin implementa el contrato **`getState()` / `setState(state, map)`** de `ext/cambioImpl`:

- `getState()` devuelve `{ visible: boolean, tracking: boolean }`.
- `setState(state, map)` reaplica visibilidad y `tracking` sobre la instancia nueva y vuelve a montar el panel (propio en 3D, el de la API en 2D).

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `constructor(options)` | Construye el plugin; funciona sin argumentos. |
| `addTo(map)` | Enganche al mapa invocado por `mapajs.addPlugin(...)`. Detecta la implementación y monta el control o el panel propio. |
| `getHelp()` | Devuelve `{ title: 'Mi ubicación', content: Promise }` para el gestor de ayuda. |
| `setVisible(visible)` / `getVisible()` | Muestra u oculta el botón. |
| `setTracking(tracking)` / `getTracking()` | Activa o desactiva el seguimiento continuo de la posición. |
| `resolveColor(c)` | Normaliza un color a `{ active, deactive }`. |
| `getState()` / `setState(state, map)` | Contrato de estado para el cambio 2D/3D. |
| `destroy()` | Suelta listeners DOM y de la API, detiene el `watchPosition`, quita la entidad y el panel propios y retira el control del mapa. |

## ✅ Notas / Limitaciones

- **Detección de implementación**: se prefiere `map.getImplementation()` (`'ol'` / `'cesium'`), que es la que usa la propia API, y se cae al patrón canónico del repositorio (`getMapImpl()` con `scene.camera`) si ese método no existe.
- **Permisos del navegador**: la primera vez el navegador pedirá permiso para compartir la ubicación. Si se deniega, el mapa **no se mueve** (mismo comportamiento que el control de la API); el motivo queda anotado en el `title` del botón.
- El **seguimiento** en 3D se apoya en `mapa.trackedEntity`. Si se pulsa el botón dos veces no se acumulan escuchas: la anterior se suelta antes de abrir la nueva.
- En 3D nunca se baja por debajo de la **precisión** que informa el navegador (`coords.accuracy`), para no meter la cámara bajo el suelo.
- `Cesium` se comprueba a través de `Cesium.Cartesian3.fromDegrees` (el atajo `Cesium.fromDegrees` no está exportado en el bundle que trae la API).
