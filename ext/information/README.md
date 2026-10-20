# Información del punto

Plugin local para API-IDEE/API-CNIG que consulta qué hay en el punto clicado. No tiene panel: es un único botón que se queda activado mientras la herramienta está en uso. Cada clic abre un popup con una pestaña por capa y, dentro de cada pestaña, tantos elementos como haya en ese punto.

## Características

- **WMS**: pide `GetCapabilities` y usa `GetFeatureInfo`. Si el servicio declara JSON y HTML, el popup permite alternar entre los dos sin volver a pinchar. Si no declara ninguno de los dos, se usan texto o XML como respaldo.
- **Capas vectoriales**: lee los features que caen bajo el clic en 2D y, cuando la implementación los dibuja, también en 3D.
- **Varias capas y varios elementos**: una pestaña por capa y todos los features del punto dentro de la pestaña.
- **Plantillas configurables**: `ficha`, `tabla` y `json` de serie; se pueden añadir o sustituir por constructor o con `registrarPlantilla()`.
- **Estado 2D/3D**: implementa `getState()`/`setState(state, map)` para conservar la activación, las preferencias por capa y el popup abierto al cambiar de implementación.

## Archivos

| Archivo | Descripción |
|---|---|
| `information.js` | Clase `miPlugin_information`: botón, consulta WMS/vectorial, popup, plantillas y contrato de estado. |
| `information.css` | Botón de 40x40, pestañas del popup, fichas, tablas y salida JSON/HTML. |

## Integración

```html
<link rel="stylesheet" href="../../../../ext/information/information.css">
<script src="../../../../ext/information/information.js"></script>
```

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_information({
  position: 'TL',
  order: 2,
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
}));
```

El plugin se expone como `IDEE.plugin.miPlugin_information`, `M.plugin.miPlugin_information` y `window.miPlugin_information`.

## Parámetros del constructor

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TL'` | Esquina de la barra de herramientas (`'TL'`, `'TR'`, `'BL'`, `'BR'`). |
| `order` | `number` | `2` | Orden dentro de la esquina. |
| `buttonTitle` | `string` | `'Consultar información del punto'` | `title` y `aria-label` del botón. |
| `color1` | `string \| Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Fondo del botón. |
| `color2` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Borde del botón. |
| `color3` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color del icono. |
| `plantillas` | `Array \| Object` | `[]` | Plantillas extra o que sustituyen a las de serie por `id`. |
| `plantillaPorDefecto` | `string` | `'ficha'` | Plantilla inicial. |
| `mostrarVacios` | `boolean` | `false` | Muestra los campos vacíos en las plantillas. |
| `camposOcultos` | `Array<string>` | `[]` | Campos que no se listan. |
| `etiquetas` | `Object` | `{}` | Mapa `campo -> etiqueta visible`. |
| `maxFeatures` | `number` | `10` | `FEATURE_COUNT` de `GetFeatureInfo`. |
| `buffer` | `number` | `5` | Tolerancia en píxeles de la consulta. |
| `titulo` | `string` | `'Información'` | Título de las pestañas de aviso y de carga. |
| `activo` | `boolean` | `false` | Arranca con la herramienta activada. |
| `debug` | `boolean` | `false` | Muestra errores de consulta por consola. |

## Plantillas

Una plantilla es un objeto `{ id, nombre, descripcion, render(elemento, contexto) }`. `render` devuelve HTML (o un nodo con `outerHTML`). Las tres plantillas de serie son `ficha`, `tabla` y `json`.

`elemento` contiene:

- `propiedades`: objeto con los campos originales.
- `campos`: array de `{ clave, etiqueta, valor, texto }` ya filtrado por `camposOcultos` y `mostrarVacios`.
- `titulo`: nombre legible del elemento.
- `id`: identificador del feature, si lo tiene.
- `geometria`: `{ tipo, coordenadas }` o `{ tipo }` cuando la implementación 3D no expone las coordenadas.
- `crudo`: feature GeoJSON original, si está disponible.
- `fuente`: `'wms'` o `'vector'`.
- `capa`: `{ name, legend, type, idLayer }`.

`contexto` ofrece:

- `escapar(texto)`: escapa HTML.
- `texto(valor)`: convierte un valor a texto legible.
- `etiqueta(clave)`: etiqueta configurada o nombre humanizado.
- `campo(clave)`: valor de un campo concreto.
- `json()`: JSON formateado del elemento.
- `indice`, `total`, `capa`, `formato`, `plantilla` y `plugin`.

Ejemplo de plantilla propia:

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_information({
  plantillas: [{
    id: 'compacta',
    nombre: 'Compacta',
    descripcion: 'Solo el nombre del elemento.',
    render: function (elemento, ctx) {
      return '<p class="mi-compacta">' + ctx.escapar(elemento.titulo) + '</p>';
    },
  }],
}));
```

También se puede añadir en caliente:

```js
const info = mapajs.getPlugins().find((p) => p.name === 'miPlugin_information');
info.registrarPlantilla({
  id: 'solo-json',
  nombre: 'Solo JSON',
  render: function (elemento, ctx) {
    return '<pre>' + ctx.escapar(ctx.json()) + '</pre>';
  },
});
```

## Capas consultables

- `WMS` mediante `GetFeatureInfo`.
- `GeoJSON`, `Vector`, `KML`, `WFS`, `OGCAPIFeatures` y `MVT` como capas vectoriales.

En 3D la consulta vectorial depende de que la implementación dibuje la capa y de que sus entidades estén en la posición correcta. `MVT`, por ejemplo, no se dibuja en Cesium en esta versión de la API y el popup mostrará que no hay información. La ficha `mapas/tiposDeCapas/capas/vector` declara sus geometrías en EPSG:3857; Cesium las interpreta como grados, así que en 3D la capa no está en Madrid y la consulta no encuentra esos elementos. Es una limitación de esa ficha/API, no del plugin.

## Estado 2D/3D

`getState()` devuelve:

```js
{
  activo: boolean,
  preferencias: {
    'legend|name': { formato: 'json' | 'html' | 'vector', plantilla: 'ficha' }
  },
  popupAbierto: boolean,
  ultimoPunto: { lon, lat, altura },
  tabActiva: number
}
```

`setState(state, map)` reactiva el botón, recupera las preferencias por capa y reabre el popup en el último punto cuando el mapa nuevo termina de colocarse. Las preferencias se guardan por `legend|name`, nunca por `idLayer`, porque los identificadores de capa cambian al recrear el mapa.

## Notas

- El servicio WMS debe permitir CORS para que el navegador pueda leer `GetCapabilities` y `GetFeatureInfo`.
- Si no se pueden leer las capacidades, el plugin prueba JSON y HTML, que son las salidas más habituales.
- La API abre su propio popup al pinchar capas vectoriales. El plugin retira los popups nuevos de ese clic y conserva el suyo.
