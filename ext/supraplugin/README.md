# 🧩 Supraplugin

> Barra transversal (estilo Ubuntu) que aloja herramientas por encima del visualizador.

Un **supraplugin** es un contenedor TRANSVERSAL a un mapa: se coloca arriba o abajo del
visualizador y aloja objetos que operan **sobre** el mapa (controles, plugins, HTML suelto e incluso
otros supraplugins). La motivación es que algunos plugins —como el comparador de vistas— no son «de un
mapa» sino «sobre un mapa» (crean o gestionan varias instancias de mapa a la vez), y un `IDEE.ui.Panel`
vive confinado dentro del viewport de UN mapa. Para resolverlo, el supraplugin construye su propia
barra como **hermana** del contenedor del visualizador, en un *dock* que flota y reparte la altura con
el mapa.

La barra se compone de **cabecera** (el *tirador*, una línea de 10 px siempre visible en el borde que
mira al mapa, por donde se pliega y se agarra para cerrarla) y **cuerpo** (título + items, lo que se
pliega). Su plegado no es un simple mostrar/ocultar, sino un juego de tres estados (abierta, plegada y
asomando) más el bandillo del fijado.

## ✨ Características

- **Dos posiciones**: `top` (por defecto) o `bottom`, apilando el dock como hermano del mapa.
- **Plegado con tirador** y tres estados: abierta, plegada y **asomando** (peek: se despliega mientras
  el puntero está encima y se repliega al salir).
- **Fijado (`pinned`)**: decide si el estado plegado es definitivo (click) o solo provisional (hover).
- **Cualquier item**: `HTMLElement`, HTML en string, objeto con `getSupraElement(supra)` (o
  `Promise<HTMLElement>`) y **supraplugins anidados** (barra hermana apilada en el mismo dock).
- **Separadores** entre items y **orden** por ranura (CSS `order`).
- **Temas de superficie** `light` / `dark` y colores de superficie cambiables en caliente
  (`setTheme`, `setSurface`), además del esquema común `color1`/`color2`/`color3`.
- **Asa de cierre** opcional (`cerrar` + `onCerrar`).
- **Idempotencia frente al cambio 2D/3D**: registro global `window.__supraplugins` por `id`, y
  contrato `getState()`/`setState()`.
- **Aviso al mapa**: `ResizeObserver` sobre la barra para reencuadrar el mapa cuando cambia el alto.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `supraplugin.js` | Clase `miPlugin_supraplugin`: construye el dock y la barra, monta los items, gestiona plegado/fijado/asomado, temas y superficies, supraplugins anidados, ciclo de vida y estado. Expone la clase como global directo y en `IDEE.plugin` / `M.plugin`. |
| `supraplugin.css` | Estilos del layout `.supra-layout`, el dock, la barra, la cabecera/tirador, el cuerpo, las ranuras de item, los separadores, los botones de barras anidadas y el aspa de cierre. Los colores **no** están aquí: se escriben en línea desde el JS como variables `--supra-*` (aquí solo hay valores de reserva). |

## 🔧 Integración en un visualizador

```html
<link rel="stylesheet" href="../../ext/supraplugin/supraplugin.css" />
<script type="text/javascript" src="../../ext/supraplugin/supraplugin.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_supraplugin(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `id` | `string` | `"supraplugin-" + N` | Id único. Se usa para la idempotencia entre reinicios y como clave del estado (registro `window.__supraplugins`). |
| `position` | `"top"` \| `"bottom"` | `"top"` | Lado del visualizador donde se coloca el dock. Cualquier valor distinto de `"bottom"` cae a `"top"`. |
| `title` | `string` | `""` | Título de la barra (si está vacío no se pinta el nodo de título). |
| `icon` | `string` | `""` | Glifo `g-cartografia` que precede al título. |
| `className` | `string` | `""` | Clase CSS extra de la barra. |
| `items` | `Array` | sin definir | Items iniciales (mismo contrato que `addItem`). Cada entrada puede ser el item tal cual, o `{ item, order }` para colocarlo en una posición concreta. |
| `order` | `number` \| `null` | `null` | Orden **por defecto** de los items que no declaren el suyo (CSS `order` sobre su ranura). Si no es numérico, queda `null`. |
| `collapsible` | `boolean` | `true` | Si la barra tiene tirador y se puede plegar. |
| `collapsed` | `boolean` | `false` | Si **arranca** plegada (solo se ve el tirador). |
| `cerrar` | `boolean` | `false` | Si la barra lleva aspa para cerrarse. Al cerrarla se esconde y se llama a `onCerrar`. |
| `onCerrar` | `function` | `null` | Callback invocado al pulsar el aspa (`onCerrar(supra)`). Solo si es función. |
| `pinned` | `boolean` | `true` | Si el estado plegado es **fijo** (click) o **de hover** (asoma con el puntero). |
| `peek` | `boolean` | `true` | Si el hover despliega la barra plegada mientras el puntero esté encima (solo tiene efecto si `collapsible`). |
| `theme` | `"light"` \| `"dark"` | `"light"` | Paleta de superficie de la barra. `dark` es la paleta «Ambiance» (gris carbón con acento naranja). Se puede cambiar en caliente con `setTheme()`. Si no se declara, `_themePropio` queda a `false` y la barra heredará el tema del padre cuando sea anidada. |
| `surface` | `Object` | paleta del tema | Colores de superficie de la barra: `{ bg, bgSolid, fg, fgDim, border, hover, shadow, sheen }`. También se pueden dar sueltos como opciones de primer nivel (`bg`, `fg`, `border`, `hover`, `shadow`…). Lo que no se declare sale del tema. |
| `color1` | `string` \| `{active,deactive}` | `{ active:'#ffffff', deactive:'orangered' }` | Color de **fondo** del esquema común. |
| `color2` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **borde**. |
| `color3` | `string` \| `{active,deactive}` | `{ active:'#71A7D3', deactive:'#ffffff' }` | Color de **icono y texto**. |

### El plegado en detalle

Estados de la barra:

| Estado | Qué se ve | Cómo se llega |
|---|---|---|
| **Abierta** | Cabecera + cuerpo | Uso normal; `collapsed:false` al arrancar. |
| **Plegada** | Solo la cabecera (el tirador) | Click en el tirador con la barra fijada, o `setCollapsed(true)`. |
| **Asomando** (peek) | Plegada pero desplegada mientras el puntero está encima | Hover, solo si `collapsible && peek && !pinned`. |
| **Fijada** | — (bandillo, no estado visual) | `pinned:true` o el primer click en el tirador. |

Click en el tirador (`_onClickTirador`):

1. si **no** está fijada → se fija **abierta** (el click «corta» el modo hover);
2. si está fijada → **alterna** abierta ↔ cerrada.

Con los valores por defecto (`pinned:true`) la barra aparece abierta y fijada; un click la cierra de
verdad y hay que volver a clicar el tirador para abrirla. Para el juego de «asoma al pasar por encima»
se construye con `pinned:false` (o `pinned:false, collapsed:true`, que es la barra oculta de Ubuntu).

## 🚀 Ejemplo de uso

Basado en `mapas/plantilla_supra/js/mapa.js`:

```js
// 1. Barra principal: pinned:false la deja en modo hover (plegada y asomando).
const supra = new IDEE.plugin.miPlugin_supraplugin({
  id: 'supra-plantilla',
  position: 'top',
  title: 'Plantilla supraplugin',
  collapsed: true,
  pinned: false,
  collapsible: true,
  peek: true,
});

// 2. Items: un plugin del repositorio, un separador y un control HTML suelto.
const itemPlantilla = new IDEE.plugin.miPlugin_plantillaItem({
  texto: 'Botón de ejemplo',
  onClick: function (itemInstancia) { console.log(itemInstancia.getState()); },
});
supra.addItem(itemPlantilla);
supra.addSeparator();
supra.addItem(controlHTML());   // HTMLElement directo

// 3. Supraplugin ANIDADO: botón en la barra del padre y barra hermana en el dock.
const supraHerramientas = new IDEE.plugin.miPlugin_supraplugin({
  id: 'supra-plantilla-hijas',
  position: 'top',
  title: 'Herramientas',
  collapsed: false,
  pinned: true,
});
supraHerramientas.addItem(new IDEE.plugin.miPlugin_plantillaItem({ texto: 'Herramienta anidada', order: 0 }));
supra.addSupraplugin(supraHerramientas);   // equivale a supra.addItem(supraHerramientas)

// 4. Al mapa solo se registra el supraplugin raíz.
mapajs.addPlugin(supra);
```

### Plugins de la API como items (patrón de `mapas/Visualizador2/js/mapa.js`)

```js
const supra = new IDEE.plugin.miPlugin_supraplugin({
  id: 'supra-visualizador2', position: 'top', title: 'Herramientas',
  collapsed: true, pinned: false, collapsible: true, peek: true,
});

const baseLayerPlugin = new IDEE.plugin.miPlugin_baseLayer({ rows: 1 });
supra.addItem(baseLayerPlugin);
mapajs.addPlugin(baseLayerPlugin);   // NO es redundante: la API lo inicializa (panel,
                                     // control y capas) y el coordinador de estado lo
                                     // recorre al cambiar 2D/3D. La barra solo le pone
                                     // el botón delante y esconde el del área.

mapajs.addPlugin(supra);
```

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Alta en el mapa. Es idempotente por `id`: si hay un supraplugin vivo con el mismo id, hereda sus items, limpia la barra anterior y reutiliza la lista. Construye dock, barra, items y llama a `addTo()` de los items que lo necesiten. |
| `addItem(item, opts)` | Añade un item (ver «Contrato de item»). `opts.order` es la posición en la barra. Si la barra ya está montada, monta el item en caliente. Devuelve `this`. |
| `addSeparator(opts)` | Añade un separador vertical entre items. Devuelve `this`. |
| `addSupraplugin(subSupra)` | Anida otro supraplugin (se monta como botón + barra hermana en el dock). Devuelve `this`. |
| `getContainer()` | `HTMLElement` de la barra raíz (`.supra-bar`). |
| `getItemsContainer()` | `HTMLElement` donde se montan los items (`.supra-bar__items`). |
| `getMap()` | Mapa API-IDEE actual. |
| `getPosition()` | `"top"` o `"bottom"`. |
| `getDock()` | `HTMLElement` del dock donde se apilan esta barra y las hijas. |
| `setCollapsed(force)` | Pliega o despliega. Con booleano fija el estado; sin argumento, alterna. Devuelve `this`. |
| `toggleCollapsed(force)` | Alias histórico: alterna el plegado (acepta `force`). Devuelve `this`. |
| `isCollapsed()` | `boolean`. |
| `setPinned(force)` | Fija el estado de plegado (`true`) o lo deja en modo hover (`false`). Sin argumento, alterna. Devuelve `this`. |
| `isPinned()` | `boolean`. |
| `setTheme(tema, enCascada = true)` | Cambia la superficie en caliente (`"light"`/`"dark"`); en cascada a las barras anidadas sin tema propio. Devuelve `this`. |
| `setSurface(parcial, enCascada = true)` | Cambia en caliente los colores de superficie indicados (el resto sigue igual); en cascada a hijas sin superficie propia. Devuelve `this`. |
| `getTheme()` | `"light"` o `"dark"`. |
| `setVisible(v)` / `isVisible()` | Muestra u esconde la barra entera (y el dock); `setVisible(true)` avisa al mapa para que se reencuadre. |
| `cerrar()` | Esconde la barra y llama a `onCerrar`. Devuelve `this`. |
| `abrirHijo(sub)` / `cerrarHijo(sub)` / `toggleHijo(sub)` | Abre, cierra o alterna la barra hermana de un supraplugin anidado. Devuelven `this`. |
| `isHijoAbierto(sub)` | `boolean`: si la barra hermana de ese supraplugin está abierta. |
| `getHelp()` | Ayuda para el gestor de la API: `{ title, content: Promise<html> }`. |
| `getState()` / `setState(state, map)` | Contrato de estado (ver «Estado 2D/3D»). |
| `remove()` | Desmonta la barra del DOM y limpia el registro global `window.__supraplugins`. |
| `destroy()` | Requerido por `map.removePlugins()` de la API (sin él la API aborta el lote de plugins). Llama a `remove()` y anula referencias. |

## 🧱 Contrato de item

Un item puede tomar cualquiera de estas formas:

| Forma | Qué hace el supraplugin |
|---|---|
| `HTMLElement` | Lo inserta tal cual en su ranura. |
| `string` (HTML) | Lo parsea dentro de un `div.supra-bar__html` y lo inserta. |
| `{ getSupraElement(supra) }` | **Vía recomendada.** Llama al método con la instancia del supraplugin y monta lo que devuelva: un `HTMLElement` o una `Promise<HTMLElement>`. Se **re-invoca en cada montaje** (incluido tras un cambio 2D/3D). |
| `miPlugin_supraplugin` | Barra anidada: botón en esta barra + barra hermana apilada en el mismo dock. |
| Separador (`addSeparator()`) | Inserta una ranura con `.supra-bar__separador` (marca interna `_supraSeparador`). |

Detalles de comportamiento:

- **`getSupraElement` + `addTo`**: si un item trae `getSupraElement` y además `addTo`/`add`, el
  supraplugin le pasa el mapa con `addTo(map)` para que monte su panel/controles/capas, y la barra solo
  le pone el botón. Los items autocontenidos (solo `getSupraElement`) se saltan ese paso.
- **Item ya registrado en el mapa**: si el item está en `map.getPlugins()`, la API ya le llamó a
  `addTo()`, así que la barra **no** vuelve a llamarlo (crearía un segundo panel) y se limita a esconder
  el botón del mapa y a poner el suyo. Lo mismo aplica a `addSupraplugin`: a una barra anidada se le
  pasa el mapa a sus items, pero sin volver a `addTo()` de la barra entera.
- **Orden**: la ranura recibe `order` con esta prioridad: `opts.order` de `addItem` > `item.order` del
  propio item > `order` de la barra. Las ranuras sin `order` valen `0`.

## 🔄 Estado 2D/3D

Contrato `getState()` / `setState(state, map)` para preservar la UI entre implementaciones:

- `getState()` → `{ plegada, fijada, hijos: { idHijo: { abierta, plegada, fijada } }, plugins: { nombre: estado } }`.
  - `plugins` es la captura del **árbol entero** de items con `getState()`: los de esta barra y los de
    las anidadas (clave `idHijo/nombre`). Los items que están registrados en `map.getPlugins()` se
    **saltan**, porque de ésos ya se encarga el coordinador `window.EstadoPlugins` y capturarlos aquí
    aplicaría su estado dos veces.
- `setState(state, map)` restaura plegado, fijado y estado de las barras hijas (incluida su visibilidad),
  refresca las clases de la barra y reparte el estado capturado a los items
  (`_restaurarItems`), con tolerancia a la clave antigua `collapsed`.

## 🎨 Colores y superficie

- El esquema común `color1`/`color2`/`color3` se normaliza con `resolveColor()` y se escribe en línea
  como las seis variables `--g-plugin-bg-color(-active)`, `--g-plugin-border-color(-active)` y
  `--g-plugin-icon-color(-active)`: como se ponen **en la barra**, los items que no declaren color
  propio los heredan por CSS (una barra con un solo color).
- En la barra, `color1` actúa además como **color de marca** (`--supra-accent`): tirador en hover,
  botones activos y raya de las barras anidadas.
- La **superficie** sale de la paleta del `theme` (`PALETAS.light` / `PALETAS.dark`) y se pisa con
  `surface` o con las opciones sueltas. Se escribe en las variables `--supra-bg`, `--supra-bg-solid`,
  `--supra-fg`, `--supra-fg-dim`, `--supra-border`, `--supra-hover`, `--supra-shadow` y `--supra-sheen`
  (mapeo explícito camelCase → kebab-case).
- Los `color1`/`color2`/`color3` **solo** afectan a la superficie de la barra si el visualizador los
  declara: sin ellos, la barra se queda con la paleta del tema (los naranjas por defecto del esquema son
  de panel y darían una franja naranja que nadie ha pedido).

## ✅ Notas

- La barra se inserta como **hermana** del contenedor raíz del visualizador (dentro de `.supra-layout`),
  no dentro del viewport del mapa: así es transversal y sobrevive al mapa. El dock se coloca antes del
  host (`top`) o después (`bottom`), y el mapa recibe la altura restante (`flex: 1 1 auto`).
- Los supraplugins anidados **no** se registran con `addPlugin()`: los monta la barra que los contiene
  (su barra comparte el dock del padre y se apila debajo, o encima si el dock va abajo).
- La barra avisa al mapa cuando cambia de alto (`ResizeObserver` → `updateSize()` en OL o
  `scene.requestRender()` en Cesium + `resize` de ventana) porque el alto cambia sin que se lo pidan:
  al plegarse, al asomarse, al abrir una barra hija y cuando los items envuelven.
- `remove()` **no** destruye los items por defecto: en el cambio 2D/3D el supraplugin anterior entrega
  sus items al nuevo, y destruirlos aquí haría que el nuevo montara items ya desmontados. Solo
  `remove()`/`destroy()` los destruyen de verdad (los que implementen `destroy()`).
- Validación de sintaxis tras editar: `node --check ext/supraplugin/supraplugin.js`.
