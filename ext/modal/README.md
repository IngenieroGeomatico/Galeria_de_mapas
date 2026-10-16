# 🧩 Modal

> Abre una ventana modal dentro del visualizador mostrando información relevante.

Plugin local para API-IDEE compatible con OpenLayers (2D) y Cesium (3D). Sigue el patrón `miPlugin_*` del repositorio: clase con constructor + `getHelp` + `addTo`. Es una versión local del plugin Modal oficial de la CDN, diseñada para sobrevivir a los cambios de implementación 2D/3D (`miPlugin_cambioImpl`) sin depender de la CDN de componentes.idee.es. El contenido del modal puede ser una URL remota, un string HTML inline o el contenido de un `<template>` presente en el DOM.

## ✨ Características

- **Tres fuentes de contenido**: URL remota (con fallback a plantillas por defecto), string HTML inline (`content`) y selector de un `<template>` en el DOM (`contentSelector`).
- **Plantillas por defecto bilingües**: en español e inglés, usadas como fallback si no hay URL o si falla la petición de red.
- **Compatible con `file://`**: si se abre el visualizador desde el sistema de archivos sin servidor, usa las plantillas por defecto en lugar de bloquearse por CORS.
- **Cierre con Escape**: listener global (registrado una sola vez) que cierra el modal al pulsar la tecla Escape.
- **Colores configurables**: color1 (fondo), color2 (borde) y color3 (icono/texto), con estados `active` y `deactive`.
- **Contrato de estado**: `getState()`/`setState(state, map)` para conservar el estado entre swaps 2D/3D.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `modal.js` | Lógica del plugin (clase `miPlugin_modal`). Incluye las plantillas por defecto (EN/ES), la resolución de la URL según idioma y el método `addTo` que construye el panel con el control del modal. |
| `modal.css` | Estilos del panel modal: botón colapsado con icono SVG de ventana, panel abierto centrado en pantalla, botón de cierre (X), área de contenido con scroll y adaptación responsive. |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/modal/modal.css" />
<script type="text/javascript" src="../../ext/modal/modal.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_modal(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TR'` | Posición del panel (`'TL'`, `'TR'`, `'BL'`, `'BR'`). |
| `collapsed` | `boolean` | `true` | Estado inicial colapsado. |
| `collapsible` | `boolean` | `true` | Permite colapsar el panel. |
| `helpLink` | `Object` | *(sin valor)* | URLs por idioma. Ej: `{ es: 'ruta.html', en: 'ruta_en.html' }`. Tiene prioridad sobre `url_es`/`url_en`. |
| `url_es` | `string` | *(sin valor)* | URL alternativa en español para el contenido del modal. |
| `url_en` | `string` | *(sin valor)* | URL alternativa en inglés para el contenido del modal. |
| `content` | `string` | `null` | Contenido HTML inline directo. Tiene prioridad sobre `contentSelector` y las URLs remotas. |
| `contentSelector` | `string` | `null` | Selector CSS de un `<template>` cuyo `innerHTML` se usará como contenido. |
| `tooltip` | `string` | `'Más información'` | Tooltip del botón. |
| `order` | `number` | `null` | Posición del panel dentro del área de botones (valor CSS `order`, no un índice; los paneles sin `order` valen 0). `-1` = por delante de todos, `0` = primera posición, `99` = al final. |
| `color1` | `string \| Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de fondo. Puede ser un string o un objeto `{ active, deactive }`. |
| `color2` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de borde. Mismo formato que `color1`. |
| `color3` | `string \| Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de icono/texto. Mismo formato que `color1`. |

## 🚀 Ejemplo de uso

```js
// Con URL remota de contenido
const plugin = new IDEE.plugin.miPlugin_modal({
  position: 'BL',
  contentSelector: '#modal-popup-madrid',
  helpLink: {
    es: '../../html/modal_CalidadAireMadridTiempoReal.html'
  }
});
mapajs.addPlugin(plugin);

// Con contenido inline
const plugin2 = new IDEE.plugin.miPlugin_modal({
  position: 'TR',
  content: '<h3>Hola</h3><p>Contenido del modal</p>',
  tooltip: 'Más información'
});
mapajs.addPlugin(plugin2);
```

## 🔄 Estado 2D/3D

El plugin implementa el contrato `getState()`/`setState(state, map)`:

```js
// Estado capturado
{
  collapsed: boolean,  // Si el panel está colapsado
  popupOpen: boolean   // Si el popup está abierto
}
```

Al restaurar, `setState` rehidrata el colapso del panel y reabre el popup si estaba abierto.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Enganche al mapa (lo invoca `mapajs.addPlugin()`). Construye el control y el panel modal, y aplica los colores configurados. |
| `getHelp()` | Devuelve `{ title, content }` para el gestor de ayuda de la API-IDEE. |
| `resolveColor(c)` | Devuelve `{ active, deactive }` a partir de un color simple u objeto. |
| `_aplicarColores()` | Vuelca los colores configurados a las variables CSS del panel. |
| `destroy()` | Limpia controles y referencias asociados al mapa. |

## ✅ Notas / Limitaciones

- **Resolución de idioma**: la URL del contenido se resuelve según `IDEE.language.getLang()`; si no está disponible, usa `'es'`.
- **Prioridad de contenido**: `content` (inline) > `contentSelector` (`<template>`) > URL remota > plantilla por defecto.
- **Listener Escape global**: se registra una sola vez a nivel de documento (`window.__miPluginModalEscapeBound`), de modo que no se duplica al alternar 2D/3D.
