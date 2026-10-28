# 🧩 miPlugin_leyenda (leyenda de capas)

> Panel con la leyenda de las capas del visualizador: servicios OGC, capas vectoriales y ráster.

Muestra **una tarjeta de leyenda por cada capa marcada** en una lista de casillas. La leyenda no se
inventa: se pide al servicio cuando la publica y, si no, se dibuja a partir de lo que la API ya sabe
de la capa (su estilo o sus bandas).

Es un **plugin estándar** (no un item de supraplugin): se registra con `map.addPlugin()` y pinta su
propio panel con el botón en la barra de herramientas.

## ✨ Características

- **Varias leyendas a la vez**: la lista es de casillas, no de opción única; cada capa marcada tiene
  su tarjeta y se puede quitar desde la propia tarjeta.
- **De dónde sale cada leyenda**:
  - **WMS / WMTS**: de la leyenda publicada por el servicio (`getLegendURL()`, es decir el
    `GetLegendGraphic` en WMS y la `LegendURL` de las capacidades en WMTS). Si la capa WMS no trae
    leyenda propia, el plugin construye la petición `GetLegendGraphic` a mano.
  - **Vectoriales**: del estilo de la API (`IDEE.style.*`). Se recorren sus entradas cuando el
    estilo las expone (categorías, rangos de agrupación, intervalos de coropletas, composición de
    estilos...) y, si no, se usa la imagen del estilo completo (`toImage()`).
  - **Ráster (GeoTIFF / COG)**: de las bandas del fichero. Una banda se dibuja como rampa de
    grises; tres o cuatro, como canales RGB y alfa, indicando el NoData si lo hay.
  - **Teselas (TMS / XYZ / MBTiles / PMTiles)**: no publican leyenda; la tarjeta lo dice.
- **Reintentos**: el canvas de un estilo y las capacidades de un OGC no están listos en el instante
  en que se monta el panel. Los resultados «sin leyenda» **no se cachean** y se reintentan hasta 3
  veces cada 1,5 s.
- **Se refresca sola** cuando cambian las capas del mapa (eventos `ADDED_*`, `REMOVED_LAYER`,
  `COMPLETED`) y tiene un botón de actualización manual.
- **Contrato de estado 2D/3D**: conserva la selección y el plegado del panel al alternar
  OpenLayers ↔ Cesium.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `leyenda.js` | Clase `miPlugin_leyenda`: enumeración de capas, resolución de la leyenda por tipo, pintado de tarjetas, contrato `getState`/`setState`, panel y `destroy`. |
| `leyenda.css` | Panel, icono del botón (glifo de la API), lista de casillas, tarjetas, entradas y canales de banda, ajuste del panel en la esquina TR y responsive. |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/leyenda/leyenda.css" />
<script type="text/javascript" src="../../ext/leyenda/leyenda.js"></script>
```

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_leyenda({
  position: 'TR',
  title: 'Leyenda',
}));
```

La hoja de estilos va **antes** del script y después de la de la API. El plugin no necesita nada más:
si el visualizador lleva `ext/cambioImpl`, el estado viaja solo.

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_leyenda(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TR'` | Esquina del panel: `'TL'`, `'TR'`, `'BL'` o `'BR'`. |
| `order` | `number` | `null` | Valor CSS `order` del panel dentro de su esquina (no es un índice). |
| `collapsible` | `boolean` | `true` | Si el panel se puede plegar a botón. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Fondo del botón. |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Borde del botón. |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color del icono y del texto. |
| `icon` | `string` | `null` | Icono propio del botón: SVG completo, solo su contenido interior o una URL. Sin él se usa el glifo `g-cartografia-lista` de la API. |
| `title` | `string` | `'Leyenda'` | Título de la cabecera del panel. |
| `autoVisible` | `boolean` | `true` | Marca al arrancar las capas que ya están visibles. |
| `excluir` | `Array<string>` | `[]` | `name` o `legend` de capas que no deben aparecer en la lista. |
| `incluirCapasBase` | `boolean` | `false` | Si se listan también las capas base. |

> **Por qué TR por defecto**: en la esquina inferior izquierda los visores suelen colgar la barra de
> escala y coordenadas de `ext/mapInfo`, que tapaba el pie del panel (medido en GeoTIFF y en WMS).

### Qué capas se listan

Se recorren las capas del mapa **aplanando los grupos** (la etiqueta del grupo se añade al nombre) y
se ordenan por `z-index` descendente, con la capa superior arriba. Quedan fuera:

- las capas base (`isBase`, o su impl `isBase`) salvo con `incluirCapasBase: true`;
- las que llevan `displayInLayerSwitcher: false`;
- las capas de terreno;
- las internas del dibujo y del propio mapa (`__draw__`, `layer_<n>`);
- las que el constructor recibe en `excluir`.

El identificador de la selección es el `legend` y, si no lo hay, el `name`; nunca el `idLayer`, que
se regenera al cambiar de implementación.

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ seleccion: [{ ident, legend, name, idLayer }], panelCollapsed }` |
| `setState(state, map)` | Rehidrata la instancia nueva: resuelve cada capa **primero por `legend`**, luego por `name` y como último recurso por `idLayer`; repone el plegado del panel y repinta la lista en el siguiente tick. |

Se guardan los tres identificadores a propósito: los `idLayer` cambian con el swap
(`WMS15667420497092266nunezMadrid`), pero `legend`/`name` no. El contrato lo captura y restaura
`window.EstadoPlugins` desde `ext/cambioImpl`.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Monta el panel, el control y los listeners de capas. |
| `getState()` | Estado serializable para el cambio 2D/3D. |
| `setState(state, map)` | Restaura el estado en la instancia nueva. |
| `resolveColor(c)` | Traduce un color simple u objeto a `{active, deactive}`. |
| `getHelp()` | `{ title: 'Leyenda de capas', content: Promise<html> }`. |
| `destroy()` | Suelta listeners, control y panel, limpia caché y temporizadores. |

## ✅ Notas

- **Ojo con el nombre**: en `ext/CalidadAireMadridTiempoReal/CalidadAireMadridTiempoReal.js` existe
  otra clase `miPlugin_leyenda` (la leyenda fija de ese visor). Si se cargan los dos ficheros en la
  misma página, la segunda exposición global pisa a la primera: **no conviene cargar ambos en el
  mismo visor**.
- La exposición es triple (`window.miPlugin_leyenda`, `IDEE.plugin.miPlugin_leyenda` y
  `M.plugin.miPlugin_leyenda`) para sobrevivir a la recarga del bundle de la API en el swap 2D/3D.
- `getLegendURL()` de WMS devuelve al principio la imagen genérica `legend-default.png` mientras no
  han llegado las capacidades. El plugin la descarta, construye el `GetLegendGraphic` y, si aún no
  hay respuesta, lo reintenta.
- Las URLs de leyenda relativas se resuelven contra `document.baseURI`, para que funcionen igual en
  la raíz del repositorio que dentro de una carpeta de visualizador.
- Los colores del panel entran por el constructor (`color1`/`color2`/`color3`); en el CSS no hay
  ningún color de icono escrito a mano, solo `var(--g-plugin-icon-color)`.
