# 🧩 miPlugin_filtroCapas (filtro de capas de puntos históricos)

> Filtra por texto las capas de puntos de interés histórico de Madrid y crea una capa nueva con los resultados.

Plugin de panel para el visor de puntos históricos de Madrid: ofrece un selector con las capas filtrables presentes en el mapa y un campo de texto, y al pulsar **Filtrar** construye una `IDEE.layer.Vector` nueva con los elementos que cumplen el criterio. La capa original se oculta y solo queda visible el resultado del filtro. El fichero `FiltroCapasPuntosHistoricos.js` declara además una segunda clase (`miPlugin_leyenda`, documentada más abajo) porque las dos forman parte del mismo visor.

## ✨ Características

- Pobla el selector solo con las capas del mapa que cumplen las tres condiciones del visor: `displayInLayerSwitcher`, `isBase == false` y tener `filterID`.
- Descarta leyendas que contengan el separador `' -//- '` (marca interna) y espera a que el número de capas se estabilice para no listar a medias.
- Se repuebla sola en `IDEE.evt.COMPLETED` y en `IDEE.evt.ADDED_LAYER` (cubre la carga diferida de datos remotos y los reinicios OL ↔ Cesium, donde `COMPLETED` no vuelve a dispararse), con un `setTimeout` de 1500 ms como red de seguridad y un candado anti-concurrencia.
- Filtro por atributo **distinto según la capa**, elegido a partir de su `filterID` (ver *Notas*).
- Avisos al usuario con `IDEE.toast` (filtrando, falta de capa, falta de texto) y uso de la imagen de carga global `SVGCarga` si está definida.
- Contrato de estado 2D/3D: conserva capa seleccionada, texto de búsqueda, panel y si el filtro estaba aplicado, y **re-aplica** el filtro una sola vez tras el cambio de implementación.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `FiltroCapasPuntosHistoricos.js` | Clases `miPlugin_filtroCapas` y `miPlugin_leyenda`, con la exposición triple de ambas (`window.miPlugin_*`, `window.IDEE.plugin.*`, `window.M.plugin.*`) y el resolutor `api_filtroCapas()` que elige el global con la API realmente cargada. |
| `FiltroCapasPuntosHistoricos.css` | Estilos del panel (`.g-herramienta`), del formulario (`#selectorWrapperID`, `#seleccionCapasID`, `.seleccionCapasClass`, `#nameSearch`, `#botonCalcular`), del toast de carga (`#controlToast`, `#cargaSVG`) y los del panel de leyenda (`.g-herramienta_leyenda`). |

## 🔧 Integración en un visualizador

```html
<link href="../../ext/FiltroCapasPuntosHistoricos/FiltroCapasPuntosHistoricos.css" rel="stylesheet" />
<script type="text/javascript" src="../../ext/FiltroCapasPuntosHistoricos/FiltroCapasPuntosHistoricos.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_filtroCapas(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `order` | `number` | `null` | `order` CSS del panel dentro del área de esquina elegida (área `.m-area`, que la API monta como flex column). `-1` va por delante de todos, `0` es la primera posición empatada con los paneles que no llevan `order`, `2` va detrás de los que van en `0`, `99` al final; `null` deja el valor que ponga la API. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo. |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde (botón + panel). |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono y flecha. |

> El panel se fija internamente en `IDEE.ui.position.TL` con `collapsible: true` y `collapsed: false` (nace abierto); no hay opción de posición ni de título.

## 🚀 Ejemplo de uso

Ejemplo real (`mapas/PuntosHistoricosMadrid/js/mapa.js`), sin opciones:

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_filtroCapas());
```

Con las opciones disponibles:

```js
const filtro = new IDEE.plugin.miPlugin_filtroCapas({
  order: 0,                        // posición dentro de la esquina TL
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
});
mapajs.addPlugin(filtro);
```

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ selectedLayer, searchTerm, collapsed, applied }`. `selectedLayer` es la leyenda elegida en el selector (o `null` si sigue en el valor de reposo `"-- Seleccione una capa para filtrar --"`); `applied` es `true` si el filtro se llegó a pulsar o si hay capa y texto. |
| `setState(state, map)` | Guarda el mapa nuevo, recuerda el estado (`_restoredState`/`_restoredLayer`), restaura el plegado del panel, el texto del input y la opción del selector, y re-aplica el filtro una sola vez (guardia `_filterReapplied`, que se marca **antes** de crear la capa para que los `ADDED_LAYER` posteriores no entren en cascada). |

La capa filtrada se recrea desde cero (`mapa()` vuelve a construir todas las capas), así que la re-aplicación comprueba antes si ya existe una capa con la leyenda `<capa> - <texto>` para no duplicarla.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Crea el panel (`toolsExtra_filtroCapas`), el control (`controlFiltroCapas`), inyecta el formulario, engancha el botón y los eventos `COMPLETED` / `ADDED_LAYER`, y puebla el selector. |
| `myFunctionFilterLayer()` | Ejecuta el filtro: lee el selector y el texto, avisa por toast si falta algo, construye el `IDEE.filter.Function`, crea la capa `IDEE.layer.Vector` con los resultados (`extract: true` y atribución al Ayuntamiento de Madrid), la añade al mapa, oculta el resto de capas no base y deja visible solo la nueva. |
| `resolveColor(c)` | Traduce un color simple u objeto a `{active, deactive}`. |
| `getHelp()` | `{ title: 'Filtrar capas', content: Promise<html> }`. |
| `destroy()` | Suelta el control del mapa (la API se lleva el panel con él) y anula las referencias y los flags de estado. |

## ✅ Notas

- **Qué capas aparecen**: solo las que tienen `filterID` (además de `displayInLayerSwitcher` y `isBase == false`). El valor de `filterID` decide el atributo que se consulta:

  | `filterID` | Atributo filtrado |
  |---|---|
  | `Placas Stolpersteine` | `nombre_completo` |
  | `Placas conmemorativas` | `Comentario` |
  | `Monumentos` | `organization['organization-desc']` |

  Una capa con `filterID` distinto de esos tres no produce ningún resultado (el predicado del `filter` no devuelve nada).
- La capa resultante se llama y leyenda `<legend de la capa> - <texto buscado>`, y su atribución apunta a `datos.madrid.es`.
- Al filtrar, oculta todas las capas con `isBase === false`, no solo la filtrada.
- `destroy()` es obligatorio: `map.removePlugins()` de la API lanza `"t.destroy is not a function"` y aborta el resto del lote de plugins si falta. El `control.equals` estricto (`other === this`) evita que al quitarlo se desregistren los controles de los demás plugins.

## 🧩 Segunda clase del mismo fichero: `miPlugin_leyenda`

Panel que muestra la leyenda del visor (una imagen fija: `../../img/mapas/leyendaCalidadAire.svg`, ruta resuelta contra el documento que carga el mapa).

`new IDEE.plugin.miPlugin_leyenda(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `order` | `number` | `null` | `order` CSS del panel dentro del área de esquina, con el mismo criterio que el plugin anterior. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo. |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde (botón + panel). |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono y flecha. |

El panel se fija internamente en `IDEE.ui.position.BL` con `collapsible: true` (clase `g-herramienta_leyenda`, control `controlLeyenda`). Estado: `getState()` devuelve `{ collapsed }` y `setState(state, map)` lo reaplica. Ejemplo real (`mapas/CalidadAireMadrid/js/mapa.js`):

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_leyenda());
```
