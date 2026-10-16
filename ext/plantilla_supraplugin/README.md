# 🧩 Plantilla de item de supraplugin

> Item modelo (botón con contador) para colgar de una barra `miPlugin_supraplugin`.

Item de ejemplo y **plantilla de partida** para crear items de la barra supraplugin
(`ext/supraplugin/`). Encapsula su UI en una clase ES6 que implementa el contrato de item
`getSupraElement(supra)` y el contrato de estado `getState()`/`setState()`, de modo que el item se
reconstruye solo cuando la barra se vuelve a montar (por ejemplo tras un cambio 2D/3D con
`cambioImpl`). Su UI es mínima a propósito: un botón con icono, texto y contador que se alterna entre
activo e inactivo, para que el esqueleto quede claro sin ruido.

## ✨ Características

- **Contrato de item completo**: `getSupraElement(supra)` devuelve el nodo raíz y se re-invoca en cada montaje.
- **Contrato de estado** `getState()`/`setState(state, map)` con guardas defensivas.
- **Botón con mutación**: cada click incrementa el contador y alterna `activo` (`aria-pressed` + clase `--activo`).
- **Callback `onClick(itemInstancia, evento)`** opcional.
- **`order`** para colocarse en una posición concreta de la barra (lo lee el supraplugin al montar).
- **Colores heredados de la barra** si el item no declara `color1`/`color2`/`color3` propios.
- **Administración en caliente**: `setTexto()` y `resetContador()` refrescan la UI ya construida.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `plantilla_item.js` | Clase `miPlugin_plantillaItem` dentro de una IIFE: constructor con opciones, contrato de item y de estado, construcción/refresco de UI y utilidades (`getMap`, `setTexto`, `resetContador`, `destroy`). Expuesta como global directo y en `IDEE.plugin` / `M.plugin`. |
| `plantilla_item.css` | Estilos del item (`.plantillaItem`, `.plantillaItem__boton`, `__icono`, `__texto`, `__contador` y el estado `--activo`). El contenedor, la barra, el tirador y los botones de barras anidadas los aporta `supraplugin.css`; este fichero solo estila la UI del item, leyendo el color de marca de `--supra-accent` y los `--g-plugin-*` que escribe el constructor. |

**Dependencia**: la barra que lo aloja (`ext/supraplugin/supraplugin.css` + `supraplugin.js`).

## 🔧 Integración en un visualizador

```html
<!-- Dependencia: la barra que lo aloja -->
<link rel="stylesheet" href="../../ext/supraplugin/supraplugin.css" />
<script type="text/javascript" src="../../ext/supraplugin/supraplugin.js"></script>

<!-- Item -->
<link rel="stylesheet" href="../../ext/plantilla_supraplugin/plantilla_item.css" />
<script type="text/javascript" src="../../ext/plantilla_supraplugin/plantilla_item.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_plantillaItem(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `id` | `string` | `"plantillaItem-" + N` | Identificador único del item (contador interno del IIFE). |
| `texto` | `string` | `'Botón de ejemplo'` | Texto inicial del botón. |
| `vecesPulsado` | `number` | `0` | Contador inicial de pulsaciones. |
| `activo` | `boolean` | `false` | Estado activo/inactivo inicial. |
| `order` | `number` \| `null` | `null` | Posición dentro de la barra (CSS `order` sobre su ranura; las ranuras sin `order` valen `0`): `-1` por delante de todos, `0` primera posición, `2` detrás de los de `0`, `99` al final. `null` = orden natural de `addItem`. Lo lee el supraplugin al montar. |
| `onClick` | `function` | `null` | Callback invocado al pulsar: `onClick(itemInstancia, evento)`. |
| `color1` | `string` \| `{active,deactive}` | `{ active:'#ffffff', deactive:'orangered' }` | Color de **fondo**. |
| `color2` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **borde**. |
| `color3` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **icono y texto**. |

## 🚀 Ejemplo de uso

Basado en `mapas/plantilla_supra/js/mapa.js`:

```js
// 1. La barra que aloja el item.
const supra = new IDEE.plugin.miPlugin_supraplugin({
  id: 'supra-plantilla',
  position: 'top',
  title: 'Plantilla supraplugin',
  collapsed: true,
  pinned: false,
});

// 2. El item, colgado con addItem().
const itemPlantilla = new IDEE.plugin.miPlugin_plantillaItem({
  texto: 'Botón de ejemplo',
  vecesPulsado: 0,
  activo: false,
  onClick: function (itemInstancia, evento) {
    console.log('[plantilla_supra] Item pulsado:', itemInstancia.getState());
  },
});

supra.addItem(itemPlantilla);       // sin `order`: orden natural de addItem
supra.addSeparator();               // separador vertical entre items
supra.addItem(controlHTML());       // también vale un HTMLElement suelto

// 3. Con posición explícita dentro de la barra.
supra.addItem(new IDEE.plugin.miPlugin_plantillaItem({ texto: 'Herramienta anidada', order: 0 }));

// 4. Al mapa solo se registra la barra: el item se monta a través de ella.
mapajs.addPlugin(supra);
```

> El item **no** se registra con `mapajs.addPlugin()`: no implementa `addTo`, lo monta la barra al
> llamar a `addItem()` (y `getState()`/`setState()` los gestiona el propio supraplugin).

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `getSupraElement(supra)` | **Contrato de item.** Guarda `this.supra = supra`, construye la UI (`_buildUI`), aplica colores y refresca, y devuelve el nodo raíz (`.plantillaItem`). Se re-invoca en cada montaje de la barra. |
| `getState()` | Devuelve `{ texto, vecesPulsado, activo }` (puro y serializable). |
| `setState(state, map)` | Rehidrata `texto`, `vecesPulsado` y `activo` con guardas (`if (!state || typeof state !== "object") return;`) y refresca la UI si ya está construida. El `map` no se usa: el item no depende del mapa. |
| `getMap()` | Devuelve el mapa actual del supraplugin anfitrión (`supra.getMap()`) o `null`. |
| `setTexto(nuevoTexto)` | Cambia el texto del botón y refresca la UI. |
| `resetContador()` | Pone `vecesPulsado = 0` y `activo = false`, y refresca la UI. |
| `resolveColor(c)` | Devuelve `{active, deactive}` a partir de un color simple o de un objeto. |
| `destroy()` | Desmonta el contenedor y anula referencias (`container`, `_btn`, `_textoSpan`, `_badgeSpan`, `supra`). Lo llama el supraplugin al hacer `remove()`/`destroy()`. |

Helpers internos: `_buildUI()` (crea el DOM y el listener del botón; objetos `_btn`, `_textoSpan`,
`_badgeSpan`), `_updateUI()` (texto, contador y estado `--activo`/`aria-pressed`) y `_aplicarColores()`.

## 🧱 Contrato de item

Un item de supraplugin es cualquier componente que se cuelga de la barra con `supra.addItem(item)`. Las
formas admitidas por la barra son: `HTMLElement`, `string` (HTML), `{ getSupraElement(supra) }`,
`miPlugin_supraplugin` (barra anidada) y separador (`addSeparator()`).

La vía recomendada —la que implementa esta plantilla— es la clase con dos métodos:

1. **`getSupraElement(supra)`**
   - Recibe la instancia del supraplugin anfitrión y debe **guardar la referencia** (`this.supra = supra`).
   - Devuelve un `HTMLElement` o una `Promise<HTMLElement>`.
   - Se re-invoca automáticamente **cada vez que la barra se monta o se reconstruye** (incluido el
     cambio 2D/3D de `cambioImpl`), así que la UI debe poder construirse de cero en cada llamada.

2. **`getState()` / `setState(state, map)`**
   - `getState()` devuelve un objeto **JSON-serializable** con el estado mínimo de la UI (textos,
     contadores, flags…).
   - `setState(state, map)` recibe el estado capturado y la instancia del **mapa nuevo**; debe aplicar
     guardas defensivas y rehidratar **sin asumir que las referencias al mapa o a capas anteriores
     siguen vivas**. Aquí solo se rehidratan valores escalares, por eso el `map` no se usa.

Además, si el item implementa `destroy()`, la barra lo llama al desmontarse de verdad
(`supra.remove()` / `supra.destroy()`), que es donde se sueltan oyentes y temporizadores.

## 🎨 Colores

`_aplicarColores()` escribe las seis variables del esquema común **en el nodo raíz del item**:

| Opción | Variables CSS |
|---|---|
| `color1` | `--g-plugin-bg-color` (`deactive`), `--g-plugin-bg-color-active` (`active`) |
| `color2` | `--g-plugin-border-color`, `--g-plugin-border-color-active` |
| `color3` | `--g-plugin-icon-color`, `--g-plugin-icon-color-active` |

Regla de herencia: si el item está dentro de un supraplugin y **no** declara colores propios (nada de
`color1`/`color2`/`color3` en el constructor), no escribe nada y **hereda los de la barra**; así cambiar
el color de la barra cambia el de todos sus items de golpe. Si el item escribe sus propias variables, el
cambio de la barra no le llega.

## 🔄 Estado 2D/3D

```js
getState() {           // puro, sin efectos secundarios
  return { texto: this._texto, vecesPulsado: this._vecesPulsado, activo: this._activo };
}

setState(state, map) {
  if (!state || typeof state !== 'object') return;
  if (typeof state.texto === 'string') this._texto = state.texto;
  if (typeof state.vecesPulsado === 'number' && !isNaN(state.vecesPulsado)) this._vecesPulsado = state.vecesPulsado;
  if (typeof state.activo === 'boolean') this._activo = state.activo;
  if (this.container) this._updateUI();
}
```

Como el item vive en la barra, es el **supraplugin** quien captura y reparte el estado de sus items
(`getState().plugins` / `setState(...)`); los plugins que están registrados en `map.getPlugins()` los
restaura aparte el coordinador `window.EstadoPlugins` de `cambioImpl`.

## ✅ Notas

- Los 7 sitios clave a sustituir al crear un item nuevo a partir de esta plantilla:
  1. nombre de la clase: `class miPlugin_<nombre>`;
  2. `this.name = 'miPlugin_<nombre>'`;
  3. exposición global directa: `window.miPlugin_<nombre> = ...`;
  4. registro en `window.IDEE.plugin.miPlugin_<nombre>`;
  5. registro en `window.M.plugin.miPlugin_<nombre>`;
  6. clases y selectores CSS en `<nombre>.css` y en `_buildUI()`;
  7. instanciación en `mapas/<visualizador>/js/mapa.js` y `<script>` en `index.html`.
- El icono del item es un marcador de posición (`"•"`): sustitúyelo por un SVG en línea o una imagen,
  sin emojis (ver las convenciones de iconos del repositorio).
- La barra monta el item dentro de una ranura `.supra-bar__ranura`; el `order` se aplica **a la ranura**,
  con prioridad `opts.order` de `addItem` > `item.order` > `order` de la barra.
- Validación de sintaxis tras editar: `node --check ext/plantilla_supraplugin/plantilla_item.js`.
