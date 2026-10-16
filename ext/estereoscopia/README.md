# 🧩 Estereoscopía

> Visualización estereoscópica del relieve en anaglifo y vista partida, en 2D y 3D.

Plugin de API-IDEE que encapsula toda la funcionalidad de estereoscopía sintética (anaglifo rojo/cian y vista partida side-by-side) para las dos implementaciones de API-IDEE: OpenLayers (2D, con shader WebGL sobre el MDT del IGN) y Cesium (3D, con relieve real y PostProcessStage). Sigue un diseño de patrón Strategy con dos motores (`OlStereoEngine` y `CesiumStereoEngine`) que comparten la misma interfaz.

## ✨ Características

- **Modo Anaglifo (rojo/cian)**: en 2D, un canvas WebGL superpuesto compone el anaglifo usando el paralaje derivado del MDT del IGN; en 3D, usa PostProcessStage nativo de Cesium.
- **Vista partida (side-by-side)**: en 2D, un segundo mapa (ojo derecho) sincronizado con el principal; en 3D, división de pantalla con dos viewports.
- **Exageración vertical**: slider con rango configurable (límites `exagMin`/`exagMax` persistidos en localStorage).
- **Posado (plano de referencia)**: altitud del plano de referencia con bloqueo opcional (`Shift + rueda` para subir/bajar).
- **Indicadores en panel**: altitud del plano, offset al plano, cota del cursor y cota en el posado.
- **Depuración de MDT**: checkbox para visualizar el MDT y alinear la estereoscopía.
- **Persistencia de configuración**: los ajustes (límites de exageración y paso/sensibilidad del posado) se guardan en localStorage (`estereoscopia.config.v2`).
- **Contrato de estado**: `getState()`/`setState(state, map)` para conservar el estado entre swaps 2D/3D.
- **Detección de implementación robusta**: usa `map.getMapImpl()` para detectar OL (tiene `getView()`) vs Cesium (tiene `scene`/`camera`), con polling si el mapa nativo aún no está listo.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `estereoscopia.js` | Lógica del plugin (clase `miPlugin_estereoscopia`). Incluye `AppConfig` (persistencia de configuración), el HTML del panel y de las retículas SVG, el shell del plugin y los dos motores: `OlStereoEngine` (WebGL + MDT) y `CesiumStereoEngine` (PostProcess + SplitView + Cotas). |
| `estereoscopia.css` | Estilos del panel de controles (botones, slider de exageración, panel de configuración, indicadores) y de los overlays del mapa (canvas del anaglifo, retículas SVG de la vista partida). |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/estereoscopia/estereoscopia.css" />
<script type="text/javascript" src="../../ext/estereoscopia/estereoscopia.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_estereoscopia(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TR'` | Esquina de la API donde se coloca el panel (clave de `IDEE.ui.position`: `'TL'`, `'TR'`, `'BL'`, `'BR'`). |
| `collapsible` | `boolean` | `true` | Si el panel se puede plegar. |
| `collapsed` | `boolean` | *(sin valor)* | Si el panel nace plegado. Si no se indica, no se pasa la opción al panel y manda el default de la API (plegado). |
| `tooltip` | `string` | `'Estereoscopía'` | Texto del tooltip del botón. |
| `className` | `string` | *(sin valor)* | Clase CSS adicional para el panel. La clase base `g-herramienta_estereo` se conserva siempre (es la que usan los estilos del plugin). |
| `order` | `number` | `null` | Posición del panel dentro del área de botones (valor CSS `order`, no un índice; los paneles sin `order` valen 0). `-1` = por delante de todos, `0` = primera posición, `99` = al final. |
| `color1` | `string \| Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de fondo. Puede ser un string o un objeto `{ active, deactive }`. |
| `color2` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de borde. Mismo formato que `color1`. |
| `color3` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de icono. Mismo formato que `color1`. |

## 🚀 Ejemplo de uso

```js
const plugin = new IDEE.plugin.miPlugin_estereoscopia({
  position: 'TR',
  tooltip: 'Estereoscopía'
});
mapajs.addPlugin(plugin);
```

## 🔄 Estado 2D/3D

El plugin implementa el contrato `getState()`/`setState(state, map)`:

```js
// Estado capturado
{
  mode: 'anaglyph' | 'split' | null,  // Modo estereoscópico activo
  exagValue: number,                  // Valor del slider de exageración
  settingsPanelOpen: boolean,         // Panel de configuración abierto/cerrado
  planeLock: boolean,                 // Plano de referencia bloqueado
  debugElev: boolean,                 // Visualización del MDT activada
  panelCollapsed: boolean             // Panel contenedor colapsado
}
```

Al restaurar, `setState` rehidrata cada uno de estos valores en el panel y en el motor. Si el motor aún no está disponible (durante el swap), el estado se guarda en `_pendingState` y se aplica cuando el motor está listo.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Enganche al mapa (lo invoca `mapajs.addPlugin()`). Gestiona el singleton guard, detecta la implementación y arranca el motor correspondiente. |
| `getHelp()` | Devuelve `{ title, content }` para el gestor de ayuda de la API-IDEE. |
| `detectImpl()` | Devuelve `'ol'`, `'cesium'` o `null` según la implementación activa. |
| `resolveColor(c)` | Devuelve `{ active, deactive }` a partir de un color simple u objeto. |
| `buildPanel(map)` | Construye el panel de controles del protocolo API-IDEE. |
| `bindPanelEvents()` | Enlaza los listeners de los controles del panel a los métodos del motor. |
| `setExaggeration(value)` | Actualiza la exageración vertical (slider del panel). |
| `applyConfigToUI()` | Aplica la configuración persistida al slider y a los inputs del panel. |
| `toggleSettings()` | Muestra/oculta el panel de configuración. |
| `resetSettings()` | Restaura los valores por defecto de la configuración. |
| `$(id)` | Devuelve el elemento del panel con el `id` dado (helper para los motores). |
| `cleanup()` | Desactiva el motor y suelta el panel del mapa anterior (usado por el singleton guard). |
| `destroy()` | Limpia el motor, el control y las referencias. |

## ✅ Notas / Limitaciones

- **Dependencias externas**: en 2D, carga bajo demanda `geotiff.js` (CDN) para decodificar el MDT del IGN. Si no está disponible, la estereoscopía sigue funcionando pero sin paralaje basado en relieve.
- **Overlays fuera del panel**: el canvas WebGL del anaglifo, el segundo mapa de la vista partida y las retículas SVG se cuelgan del `body`/viewport (position:absolute) y los gestiona el motor, no el panel.
- **Singleton guard**: `window.__estereoActivePlugin` asegura que solo hay una instancia activa; al crearse una nueva, se limpia la anterior.
- **Persistencia de configuración**: los ajustes se guardan en `localStorage` con la clave `estereoscopia.config.v2`.
