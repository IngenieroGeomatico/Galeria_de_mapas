# 🧩 miPlugin_areaControls (banda de controles)

> Banda a todo el ancho, arriba o abajo, donde viven en fila los plugins de tipo control.

La API-CNIG coloca los paneles en cuatro áreas de esquina (`.m-area`, cada una un flex **column**), así que solo permite pedir TL, TR, BL y BR. Eso deja fuera dos casos: los paneles que deben abrirse **centrados** arriba o abajo (lecturas de escala, barras de atribución) y los que necesitan ordenarse **en horizontal** (dentro de una esquina, `order` solo apila en vertical). Esta extensión crea (una sola vez) un div `position:absolute` a todo el ancho con los plugins metidos en fila; como es un flex **row**, aquí `order` sí ordena de izquierda a derecha. No es un plugin de herramienta: no pinta panel propio y normalmente lo instancian otros plugins (ver `ext/mapInfo` y `ext/attribution`).

## ✨ Características

- Área compartida: varias instancias del mismo mapa reutilizan el mismo div (y también el de un mapa anterior tras el cambio 2D/3D).
- Banda transparente y sin panel: el mapa se ve por detrás; solo ocupa lo que miden sus hijos (`pointer-events: none` en la banda, `auto` en cada control).
- Margen lateral automático: mide el rail de botones de la API (`.m-areas > .m-area`) y se aparta lo justo del panel de la esquina que comparta banda, con tope del 40 % del ancho. Se recalcula con `resize` y con un `MutationObserver` sobre `.m-areas` (el rail se puebla de forma asíncrona y cambia al conmutar 2D/3D).
- Colores por herencia: reparte las seis variables CSS del esquema en el div de la banda, de modo que **todos** los plugins colgados la heredan sin tocar sus hojas de estilo.
- Contrato de estado 2D/3D: conserva la banda (`openPosition`) al alternar OpenLayers ↔ Cesium.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `areaControls.js` | Clase `miPlugin_areaControls`: crea la banda, resuelve el anfitrión (`.m-api-idee-container`, igual en 2D y en 3D), calcula los márgenes laterales y expone `monta`/`desmonta`/`reordena`. |
| `areaControls.css` | Estilos de `.g-areaControls` (flex row, `gap`, `z-index: 850`, transparencia, `pointer-events`) y los modificadores `--top` / `--bottom`, más el ajuste del panel en la esquina TR. |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/areaControls/areaControls.css" />
<script type="text/javascript" src="../../ext/areaControls/areaControls.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_areaControls(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `openPosition` | `string` | `'bottom'` | Banda donde se abre: `'top'` o `'bottom'`. Cualquier otro valor cae a `'bottom'`. |
| `order` | `number` | `0` | `order` CSS por defecto de los hijos que se cuelguen sin el suyo. |
| `className` | `string` | `'g-areaControls'` | Prefijo de clase de la banda. Permite tener más de una banda en el mismo mapa (las clases son `<className>` y `<className>--top` / `<className>--bottom`). |
| `padLeft` | `number` | automático | Margen izquierdo en píxeles. Si se omite, se calcula midiendo el rail de la API. |
| `padRight` | `number` | automático | Margen derecho en píxeles. Si se omite, se calcula midiendo el rail de la API. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo (variable `--g-plugin-bg-color` / `...-active`). |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde (`--g-plugin-border-color` / `...-active`). |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono y texto (`--g-plugin-icon-color` / `...-active`). |

> El constructor funciona sin argumentos: `new miPlugin_areaControls()` deja la banda abajo y sin `order` explícito.
> Los colores se leen con la misma traducción que el resto de plugins: un color simple vale para los dos estados, un objeto `{active, deactive}` los separa.

## 🚀 Ejemplo de uso

Colgar una lectura propia en la banda (patrón real de `ext/mapInfo`, que además guarda la instancia para poder soltarla en `destroy()`):

```js
// La banda es una extensión aparte: si no está cargada, el plugin sigue
// funcionando con su anclaje a esquina.
const Clase = window.miPlugin_areaControls;
const area = new Clase({ openPosition: 'bottom' });
area.addTo(mapajs);

const lectura = document.createElement('div');
lectura.textContent = '1:25.000';
area.monta(lectura, { order: 0 });   // 0 = izquierda; mayor = más a la derecha
```

Y un visualizador que la registre como plugin del mapa (tiene `addTo`, `getHelp` y `destroy`, así que soporta `addPlugin`), con el resto de opciones:

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_areaControls({
  openPosition: 'top',        // banda arriba
  order: 2,                   // order por defecto de los hijos
  className: 'g-areaControls',// prefijo de clase (varias bandas)
  padLeft: 60,                // fijos; si se omiten, se miden solos
  padRight: 60,
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
}));
```

## 🎨 Colores

La banda **no se pinta** (es transparente para que se vea el mapa detrás): lo que hace es dejar puestas en su div las seis variables del esquema, que los plugins colgados heredan por cascada. Un plugin que traiga sus propios colores se los pone encima y manda él.

| Variable | Origen |
|---|---|
| `--g-plugin-bg-color` / `--g-plugin-bg-color-active` | `color1.deactive` / `color1.active` |
| `--g-plugin-border-color` / `--g-plugin-border-color-active` | `color2.deactive` / `color2.active` |
| `--g-plugin-icon-color` / `--g-plugin-icon-color-active` | `color3.deactive` / `color3.active` |

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ openPosition }` |
| `setState(state, map)` | Reaplica `openPosition` (si cambia de banda suelta la anterior y crea la nueva), vuelve a resolver el div del DOM y reprograma el ajuste de márgenes. |

El **estado de los hijos** (qué plugin está colgado y con qué `order`) no viaja aquí: cada plugin que se cuelga se re-monta por su cuenta al recrearse en el mapa nuevo.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Registra el mapa y prepara la banda. No dibuja nada por sí mismo. |
| `monta(elemento, {order})` | Cuelga el elemento de un plugin dentro de la banda. Fuerza `position: static` y anula `left/right/top/bottom/margin` (dentro de la banda manda el flujo) y le pone `order` CSS. Devuelve el elemento o `null`. |
| `desmonta(elemento)` | Saca el elemento de la banda. |
| `reordena(elemento, orden)` | Cambia el `order` de un elemento ya montado. |
| `resolveColor(c)` | Traduce un color simple u objeto a `{active, deactive}`. |
| `getHelp()` | `{ title: 'Area de controles', content: Promise<html> }`. |
| `destroy()` | Suelta referencias y escuchadores. **No borra el div**: lo comparten varios plugins y cada uno se desmonta a su ritmo. |

## ✅ Notas

- El anfitrión se busca subiendo hasta `.m-api-idee-container`, que es el único nodo que existe igual en 2D y en 3D. Anclarlo a `map.getContainer()` no vale: en OpenLayers devuelve `.ol-overlaycontainer-stopevent`, que no existe en Cesium.
- El plugin que se cuelga debe dejar de anclarse a una esquina con `position:absolute`: al entrar en la banda se le resetea a `static`.
- Compatibilidad con degradación: `ext/mapInfo` y `ext/attribution` comprueban `typeof window.miPlugin_areaControls === 'function'` y, si no está cargada, anclan su elemento por su cuenta.
- CSS: el bloque del panel en la esquina TR es **genérico** (`.m-areas > div.m-area > div.m-panel > div.m-panel-controls > div`) y está repetido en la hoja de cada plugin, así que entre hojas con el mismo selector gana la **última** cargada. Cualquier variación para un plugin concreto tiene que ir en su propio selector, con más especificidad.
