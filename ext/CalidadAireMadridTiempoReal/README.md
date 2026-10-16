# 🧩 Calidad del Aire Madrid (tiempo real)

> Interpola/extrapola por kriging los datos de las estaciones de calidad del aire.

Plugin de API-IDEE para visualizar en tiempo real la calidad del aire en Madrid. Interpola/extrapola los datos de las estaciones de medición mediante kriging y genera isobandas (curvas de nivel) que se pintan sobre el mapa. El plugin es autosuficiente: carga bajo demanda las librerías de cálculo (turf.js para geometría y kriging.js para interpolación) sin necesidad de añadirlas al index.html. Incluye además un plugin de leyenda (`miPlugin_leyenda`) que muestra la escala de colores de calidad del aire.

## ✨ Características

- **Interpolación por kriging**: calcula la distribución espacial de un contaminante a partir de los datos de las estaciones, generando isobandas recortadas al municipio.
- **Librerías bajo demanda**: carga turf.js (CDN) y kriging.js (copia local) solo cuando se pulsa "Calcular", cacheando la promesa para no reinyectar.
- **Selector de capas automático**: puebla el desplegable con las capas GeoJSON de estaciones (excluyendo las capas auxiliares de municipio y estaciones base).
- **Inyección robusta de controles**: patrón COMPLETED + polling para evitar el race condition en Cesium.
- **Colores configurables**: color1 (fondo), color2 (borde) y color3 (icono), con estados `active` y `deactive`.
- **Leyenda integrada**: plugin `miPlugin_leyenda` que muestra la leyenda SVG de calidad del aire.
- **Contrato de estado**: `getState()`/`setState(state, map)` para conservar el gas seleccionado entre swaps 2D/3D.
- **Límites por magnitud**: rangos de isobandas predefinidos para 13 magnitudes distintas (NO₂, SO₂, O₃, PM10, PM2.5, benceno, etc.).

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `CalidadAireMadridTiempoReal.js` | Lógica de los plugins. Incluye la clase principal `miPlugin_calidadAire` (interpolación por kriging) y la clase `miPlugin_leyenda` (leyenda de calidad del aire). |
| `CalidadAireMadridTiempoReal.css` | Estilos de los paneles: icono de anillos concéntricos (isopletas), cabeceras, botones de controles y reglas genéricas del botón plegable. |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/CalidadAireMadridTiempoReal/CalidadAireMadridTiempoReal.css" />
<script type="text/javascript" src="../../ext/CalidadAireMadridTiempoReal/CalidadAireMadridTiempoReal.js"></script>
```

## ⚙️ Parámetros de construcción

### `miPlugin_calidadAire`

`new IDEE.plugin.miPlugin_calidadAire(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `BBox_Gjson` | `string` | *(sin valor)* | Ruta `"objetoGlobal.propiedad"` al FeatureCollection GeoJSON de recorte (p. ej. `"geojsonJoin.municipio"`). Se resuelve contra `window`. |
| `gridValue` | `number` | *(sin valor)* | Tamaño de la rejilla de interpolación en grados (p. ej. `0.3`). |
| `alpha` | `number` | *(sin valor)* | Parámetro `alpha` del modelo de variograma de kriging. |
| `sigma2` | `number` | *(sin valor)* | Parámetro `sigma2` del modelo de variograma de kriging. |
| `order` | `number` | `null` | Posición del panel dentro del área de botones (valor CSS `order`, no un índice; los paneles sin `order` valen 0). `-1` = por delante de todos, `0` = primera posición, `99` = al final. |
| `color1` | `string \| Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de fondo. Puede ser un string o un objeto `{ active, deactive }`. |
| `color2` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de borde. Mismo formato que `color1`. |
| `color3` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de icono. Mismo formato que `color1`. |

### `miPlugin_leyenda`

`new IDEE.plugin.miPlugin_leyenda(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `order` | `number` | `null` | Posición del panel dentro del área de botones (valor CSS `order`). |
| `color1` | `string \| Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de fondo. |
| `color2` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de borde. |
| `color3` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de icono. |

## 🚀 Ejemplo de uso

```js
// Plugin de interpolación
mapajs.addPlugin(new IDEE.plugin.miPlugin_calidadAire({
  BBox_Gjson: "geojsonJoin.municipio",
  gridValue: 0.3,
  alpha: 100,
  sigma2: 0
}));

// Plugin de leyenda
mapajs.addPlugin(new IDEE.plugin.miPlugin_leyenda());
```

## 🔄 Estado 2D/3D

El plugin `miPlugin_calidadAire` implementa el contrato `getState()`/`setState(state, map)`:

```js
// Estado capturado
{
  selectedGas: string | null,  // Gas seleccionado en el desplegable
  collapsed: boolean,          // Panel colapsado/abierto
  interpolate: boolean         // Si se ha realizado alguna interpolación
}
```

Al restaurar, `setState` repone el gas seleccionado en el desplegable (si existe como opción) y el estado de colapso del panel. El plugin `miPlugin_leyenda` también implementa el contrato con `{ collapsed }`.

## 🧩 Métodos públicos

### `miPlugin_calidadAire`

| Método | Descripción |
|---|---|
| `addTo(map)` | Enganche al mapa (lo invoca `mapajs.addPlugin()`). Construye el panel, el control y asegura la inyección de controles. |
| `getHelp()` | Devuelve `{ title, content }` para el gestor de ayuda de la API-IDEE. |
| `detectImpl()` | Devuelve `'ol'`, `'cesium'` o `null` según la implementación activa. |
| `myFunctionInterpolateExtrapolate()` | Ejecuta la interpolación por kriging: carga las librerías, lee el gas seleccionado, calcula las isobandas y actualiza la capa. |
| `resolveColor(c)` | Devuelve `{ active, deactive }` a partir de un color simple u objeto. |
| `destroy()` | Detiene el sondeo, suelta el control y limpia referencias. |

### `miPlugin_leyenda`

| Método | Descripción |
|---|---|
| `addTo(map)` | Enganche al mapa. Construye el panel con la imagen de la leyenda. |
| `getHelp()` | Devuelve `{ title, content }` para el gestor de ayuda. |
| `resolveColor(c)` | Devuelve `{ active, deactive }` a partir de un color simple u objeto. |
| `destroy()` | Suelta el control y limpia referencias. |

## ✅ Notas / Limitaciones

- **Librerías de cálculo**: turf.js se carga desde CDN; kriging.js se carga desde `../../js/kriging/kriging.js` (copia local adaptada). Si la red falla, la interpolación se aborta con un mensaje de error.
- **Capas requiere**: el plugin espera que el mapa tenga capas GeoJSON con la propiedad `displayInLayerSwitcher` y campos `MAGNITUD`/`magnitud` y `H{hora}`/`V{hora}` (validados) en sus features.
- **Decisión sobre interpolación**: al restaurar el estado 2D/3D, el gas seleccionado se repone en el desplegable pero no se re-ejecuta automáticamente el kriging (para evitar renderizados duplicados o condiciones de carrera durante la carga de capas).
- **Persistencia**: el estado capturado incluye el gas seleccionado y el estado de colapso, pero no los resultados de la interpolación.
