# 🧩 Vuelo Fotogramétrico

> Importa vuelos fotogramétricos ya realizados y visualízalos en 2D y 3D.

Plugin de API-IDEE que importa vuelos fotogramétricos desde ficheros CSV/Excel o desde el servicio OGC API Processes del IGN (proceso `bsq-fotogramas`), y los visualiza sobre el mapa generando hasta tres capas GeoJSON: centros de fotograma (puntos coloreados por pasada), líneas de pasada y huellas de fotograma calculadas a partir de focal, altura de vuelo y tamaño de sensor sobre el MDT del IGN. También incluye un generador de vuelos sintéticos (Demo) y un planificador de vuelos nuevos (Cálculo). Es compatible con OpenLayers (2D) y Cesium (3D), reutilizando `miPlugin_cambioImpl`.

## ✨ Características

- **Tres modos de trabajo**: Vuelo ya hecho (importación), Demo (generador sintético) y Cálculo (planificación).
- **Tres fuentes de datos**: OGC API IGN (búsqueda por área y fechas), CSV/Excel (con mapeo de columnas) y generador Demo.
- **Hasta tres capas GeoJSON**: puntos de centros de fotograma, líneas de pasada y huellas (footprints) calculadas con geometría fotogramétrica real (matriz de rotación omega/phi/kappa).
- **Huellas sobre el terreno**: usa el MDT del IGN (WCS GeoTIFF) para situar cada huella a la cota real del terreno.
- **Animación del avión**: recorre la línea de vuelo con velocidad configurable (10–5000 km/h); en 2D es un icono SVG rotado, en 3D un modelo glTF.
- **Cámaras predefinidas**: 11 presets de cámaras fotogramétricas PNOA (Vexcel UltraCam, Z/I·Leica DMC, Phase One, DJI) + guardado de cámaras propias en localStorage.
- **CRS configurables**: 7 presets de sistemas de referencia (ETRS89 UTM 28–31, REGCAN95, EPSG:4326, Web Mercator).
- **Persistencia entre swaps 2D/3D**: el estado importado vive en `window.__vueloSharedData` y sobrevive a los cambios de implementación.
- **Contrato de estado**: `getState()`/`setState(state, map)` para el coordinador `window.EstadoPlugins`.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `vueloFotogrametrico.js` | Lógica del plugin (clase `miPlugin_vueloFotogrametrico`). Incluye utilidades geométricas puras (`VueloGeo`, `FootprintBuilder`, `FlightPlanner`, `GeoJsonBuilder`), servicios (`OgcClient`, `MdtService`, `CameraStore`, `ProjUtil`), plantilla del panel (`PanelTemplate`) y el shell del plugin con el protocolo API-IDEE. |
| `vueloFotogrametrico.css` | Estilos del panel de importación y de los controles (acordeones, pestañas, selectores, botones, animación). Usa variables CSS `--g-plugin-*` para los colores configurables. |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/vueloFotogrametrico/vueloFotogrametrico.css" />
<script type="text/javascript" src="../../ext/vueloFotogrametrico/vueloFotogrametrico.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_vueloFotogrametrico(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TR'` | Esquina de la API donde se coloca el panel (clave de `IDEE.ui.position`: `'TL'`, `'TR'`, `'BL'`, `'BR'`). |
| `collapsible` | `boolean` | `true` | Si el panel se puede plegar. |
| `collapsed` | `boolean` | *(sin valor)* | Si el panel nace plegado. Si no se indica, no se pasa la opción al panel y manda el default de la API (plegado). |
| `tooltip` | `string` | `'Vuelo fotogrametrico'` | Texto del tooltip del botón. |
| `className` | `string` | *(sin valor)* | Clase CSS adicional para el panel. La clase base `g-herramienta_vuelo` se conserva siempre (es la que usan los estilos del plugin). |
| `order` | `number` | `null` | Posición del panel dentro del área de botones (valor CSS `order`, no un índice; los paneles sin `order` valen 0). `-1` = por delante de todos, `0` = primera posición, `99` = al final. |
| `color1` | `string \| Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de fondo del botón/panel. Puede ser un string o un objeto `{ active, deactive }`. |
| `color2` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de borde. Mismo formato que `color1`. |
| `color3` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de icono/texto. Mismo formato que `color1`. |

## 🚀 Ejemplo de uso

```js
const plugin = new IDEE.plugin.miPlugin_vueloFotogrametrico({
  position: 'TR',
  collapsed: true,
  tooltip: 'Vuelo fotogramétrico'
});
mapajs.addPlugin(plugin);
```

## 🔄 Estado 2D/3D

El plugin implementa el contrato `getState()`/`setState(state, map)` para el coordinador `window.EstadoPlugins`. El estado capturado incluye:

- `mode`: modo activo (`'hecho'`, `'demo'`, `'calculo'`).
- `rows` / `headers` / `mapping` / `crs`: datos importados y mapeo de columnas.
- `footprint`: parámetros de cámara (focal, sensor, píxeles).
- `visible`: visibilidad de cada capa (puntos, líneas, huellas).
- `vuelos` / `vueloSel`: lista y selección de la última búsqueda OGC.
- `anim`: progreso de la animación del avión.
- `zoomDone`: si ya se encuadró la vista a los datos.
- `ui.accordion`: estado abierto/cerrado de los acordeones del panel.

Los datos importados persisten en `window.__vueloSharedData`, que sobrevive al swap de implementación. Al cambiar de implementación (`miPlugin_cambioImpl`), se crea una nueva instancia del plugin que re-hidrata desde ese estado y re-pinta los datos sin volver a pedir el fichero.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Enganche al mapa (lo invoca `mapajs.addPlugin()`). Construye el panel, enlaza eventos y re-pinta si hay datos previos. |
| `getHelp()` | Devuelve `{ title, content }` para el gestor de ayuda de la API-IDEE. |
| `resolveColor(c)` | Devuelve `{ active, deactive }` a partir de un color simple u objeto. |
| `cleanup()` | Limpia la instancia anterior (usado por el singleton guard). |
| `destroy()` | Suelta el control del mapa y limpia referencias. |

## ✅ Notas / Limitaciones

- **Dependencias externas**: carga bajo demanda `turf.js` (CDN) y `geotiff.js` para operaciones de geometría y decodificación del MDT. Si no están disponibles, degrada a cálculos manuales o huellas sin cota de terreno.
- **Fases futuras**: la arquitectura deja preparados los ganchos para planificación de vuelos (GSD, solape, cámara, altura, dirección) y exportación (GeoJSON/CSV/KML). En esta v1 solo está el importador.
- **Singleton guard**: `window.__vueloActivePlugin` asegura que solo hay una instancia activa; al crearse una nueva, se limpia la anterior.
- **Persistencia de cámaras**: las cámaras personalizadas se guardan en `localStorage` con la clave `vueloFotogrametrico:camarasUsuario`.
