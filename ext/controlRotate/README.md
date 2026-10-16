# 🧩 Dial de rotación (brújula)

> Brújula que gira la orientación del mapa, con el aspecto y el tamaño de los botones de herramienta de la API.

El control de rotación (`rotate`) del constructor `IDEE.map({ controls })` lo dibuja la propia API como un panel `.m-panel.m-rotate` dentro de las áreas de esquina (`.m-area .m-top .m-left`). Este plugin **no dibuja un dial propio**: reutiliza ese control nativo (`IDEE.control.Rotate`) y lo cuelga en el mapa **en caliente**, que es lo que permite decidir la implementación antes de crearlo y retocarlo después.

Sobre el control nativo el plugin añade tres cosas: lo deja con el tamaño y el aspecto de los botones de plugin (**40×40**, sombra incluida) en vez de los 43,2 px de serie; quita el botón "Girar al norte" que el nativo lleva dentro (el norte se orienta con **doble clic**, que es la interacción habitual en los visores de la CNIG); y oculta la flecha de plegado, inútil en paneles no plegables. Además incorpora una **rosa de los vientos** que gira con la vista, porque el dial nativo solo pinta un punto blanco que orbita cerca del borde.

## ✨ Características

- 🧭 **Dial nativo retocado**: reutiliza `IDEE.control.Rotate` añadido en caliente y lo integra con el resto de herramientas.
- 🎯 **Doble clic = norte**: orienta el mapa a 0 grados con una transición suave, con el camino de giro más corto.
- 🖱️ **Arrastre con el puntero**: lo gestiona el propio control nativo en 2D.
- 🎡 **Rueda del ratón**: gira en saltos configurables (`step`), por defecto 15°.
- ⌨️ **Teclado**: flechas izquierda/derecha (y arriba/abajo) giran; `Inicio` (Home) vuelve al norte.
- 🌹 **Rosa de los vientos** en el centro del disco, en SVG en línea con `currentColor` para que tome el color del esquema.
- 🔄 **Bolita del dial sincronizada**: mantiene al día el marcador del control nativo aunque el giro lo provoque el plugin (doble clic, rueda, teclas).
- 🧊 **Montaje también en 3D**: sobre el control nativo de Cesium pinta una **copia del dial de 2D** y un **átomo** que actúa como palanca de giro e inclinación de la cámara.
- 🎨 **Colores configurables** (`color1`, `color2`, `color3`) inyectados como variables CSS.
- 💾 **Contrato de estado** `getState()` / `setState()`: la rotación no la conserva la API al recrear el mapa, así que el plugin la guarda y la reaplica sobre la vista nueva.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `controlRotate.js` | Clase `miPlugin_controlRotate`: montaje y retoque del control nativo, rosa de los vientos, gestos de ratón/teclado, dial y gestos propios de 3D (giro e inclinación con marco ENU), colores, contrato de estado y ciclo de vida (`addTo` / `destroy`). |
| `controlRotate.css` | Estilos del dial: tamaño configurable con `--g-controlRotate-lado` (40 px por defecto), ocultación del botón de norte (`.g-controlRotate--sinNorte`) y de la flecha de plegado, clases de la copia de 3D (`g-controlRotate--3D`, `g-controlRotate-girando`, `g-controlRotate-inclinando`) y colores del esquema. |

## 🔧 Integración en un visualizador

Vincula los recursos **después** de la API-IDEE y **antes** de `js/mapa.js`:

```html
<!-- Estilos -->
<link type="text/css" rel="stylesheet" href="../../ext/controlRotate/controlRotate.css">
<!-- Script -->
<script src="../../ext/controlRotate/controlRotate.js" type="text/javascript"></script>
```

> En las etapas de `CaminoDeLosFaros` las rutas llevan un nivel más: `../../../../ext/controlRotate/...`

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_controlRotate(options)`

El constructor **funciona sin argumentos**: todas las opciones son opcionales.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `visible` | `boolean` | `true` | Estado inicial de visibilidad del dial. |
| `order` | `number` | `undefined` (sin valor) | Orden dentro de la columna de esquina (es el `order` CSS del panel de la API). Por defecto, al final. No se aplica si el valor no es numérico. |
| `norte` | `boolean` | `false` | Mostrar el botón "Girar al norte" que trae el control nativo. Por defecto `false`: el doble clic sobre el dial hace lo mismo y el botón se quita (clase `g-controlRotate--sinNorte`). |
| `size` | `number` | `40` | Lado del dial en píxeles (el mismo que los botones de herramientas de la API). Solo se acepta si es mayor que 0. Se escribe en la variable CSS `--g-controlRotate-lado` y aplica la clase `g-controlRotate--tam` salvo que valga exactamente 43,2 (el tamaño de serie de la API). |
| `step` | `number` | `15` | Salto de giro con la rueda del ratón, **en grados**. Internamente se convierte a radianes con el valor absoluto (`Math.abs(grados) * π / 180`). Si no es numérico se usa 15. |
| `rotation` | `number` | `0` | Rotación inicial, **en radianes**, con sentido horario como OpenLayers. Si no es numérico se usa 0. |
| `color1` | `string\|Object` | `{ active: '#ffffff', deactive: 'orangered' }` | Color de **fondo**. |
| `color2` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **borde**. |
| `color3` | `string\|Object` | `{ active: '#71A7D3', deactive: '#ffffff' }` | Color de **icono y texto**. |

> ⚠️ **Ojo con las unidades**: `step` se expresa en **grados** y `rotation` (`setRotation`, `getRotation`) en **radianes**.

## 🚀 Ejemplo de uso

Ejemplo real del repositorio (`mapas/CaminoDeLosFaros/etapas/*/js/etapa.js`), ampliado con las opciones disponibles:

```js
// Rotación del mapa. El dial lo pone la API; el plugin lo deja con el aspecto
// de los botones de herramienta y le añade doble clic al norte y rueda.
mapjs.addPlugin(new IDEE.plugin.miPlugin_controlRotate({ order: -1 }));

// Con todas las opciones:
mapjs.addPlugin(new IDEE.plugin.miPlugin_controlRotate({
  visible: true,
  order: -1,      // primer botón de la columna de esquina
  norte: false,   // sin el botón nativo "Girar al norte" (lo hace el doble clic)
  size: 40,       // lado del dial en píxeles
  step: 15,       // salto de la rueda, en grados
  rotation: 0,    // rotación inicial, en radianes
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' }
}));
```

## 🎨 Colores configurables

Los colores se aceptan como color suelto (`'#ffffff'`) o como objeto `{ active, deactive }`. El plugin los escribe **en línea** sobre el panel del dial como variables CSS, que consume `controlRotate.css` con `var(--g-plugin-bg-color, orangered)` y compañía:

| Variable CSS | Origen |
|---|---|
| `--g-plugin-bg-color` / `--g-plugin-bg-color-active` | `color1.deactive` / `color1.active` |
| `--g-plugin-border-color` / `--g-plugin-border-color-active` | `color2.deactive` / `color2.active` |
| `--g-plugin-icon-color` / `--g-plugin-icon-color-active` | `color3.deactive` / `color3.active` |

El dial no se abre ni se cierra, así que solo se ve el **estado de reposo** (`deactive`); el `active` queda declarado por si un visualizador quiere distinguirlo. La rosa de los vientos toma su color de `--g-plugin-icon-color` (SVG en línea con `fill="currentColor"`, nunca un `<img>`).

## 🔄 Estado 2D/3D y comportamiento por implementación

| Aspecto | 2D (OpenLayers) | 3D (Cesium) |
|---|---|---|
| Montaje | `new IDEE.control.Rotate({ help: true, order? })` + `map.addControls([control])` | Igual: también se añade el control nativo (su variante de Cesium trae su propia brújula) |
| Dial visible | El panel nativo retocado, con la rosa añadida en el centro | Se pinta una **copia** del dial de 2D dentro del panel (`.g-controlRotate--3D`) y se **borra** la brújula grande de la API |
| Giro | `view.setRotation(radianes)` sobre la vista de OpenLayers | `camera.rotateRight` dentro de un marco **ENU** del punto mirado (`lookAtTransform` antes y después) |
| Inclinación | No aplica | El **átomo** actúa como palanca: `rotateUp` en el mismo marco ENU |
| Norte (doble clic) | `view.animate({ rotation: 0 })` | Vuelo de la cámara a rumbo 0 e inclinación −90° a trozos |
| Sincronización | Evento `change:rotation` de la vista de OpenLayers + `CHANGE_ROTATION` de la API | `scene.postRender`: la rosa y la bolita siguen el `heading` de la cámara |

El plugin implementa el contrato **`getState()` / `setState(state, map)`** de `ext/cambioImpl`:

- `getState()` devuelve `{ visible: boolean, rotacion: number }` (en radianes) y sincroniza antes con la vista para no perder la rotación si el mapa ha cambiado por otra vía (por ejemplo, el gesto de dos dedos).
- `setState(state, map)` reaplica la rotación **sobre el mapa nuevo** (no asume nada del anterior), vuelve a enlazar la vista y restaura la visibilidad. En 3D se conserva el valor interno para que la rotación se recupere al volver a 2D, sin tocar la cámara de Cesium.

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `constructor(options)` | Construye el plugin; funciona sin argumentos. |
| `addTo(map)` | Enganche al mapa invocado por `mapajs.addPlugin(...)`. Añade el control nativo, prepara el panel y engancha los gestos. |
| `getHelp()` | Devuelve `{ title: 'Rotación del mapa', content: Promise }` para el gestor de ayuda. |
| `getRotation()` | Devuelve la rotación actual del plugin, **en radianes**. |
| `setRotation(radianes)` | Fija la rotación del mapa directamente (en 3D solo conserva el valor interno). |
| `setVisible(visible)` / `getVisible()` | Muestra u oculta el dial. |
| `resolveColor(c)` | Normaliza un color a `{ active, deactive }`. |
| `getState()` / `setState(state, map)` | Contrato de estado para el cambio 2D/3D. |
| `destroy()` | Suelta listeners DOM, de la API y de la vista, cancela animaciones y temporizadores, quita el panel propio de 3D y retira el control del mapa. |

## ✅ Notas / Limitaciones

- **Detección de implementación**: se prefiere `map.getImplementation()` (`'ol'` / `'cesium'`) y se cae al patrón canónico (`getMapImpl()` con `scene.camera`) si ese método no existe.
- **La rosa de los vientos** es un SVG de <https://www.svgrepo.com> (pack `compass`, id 480720), copiado también en `img/iconos/compass.svg`. El icono de *hover* (átomo) es del pack "Minimal UI Icons" (`img/iconos/atom-1298.svg`). Los dos van **en línea** en el DOM y no como `<img>` ni `url()` de máscara, porque la rosa gira con la vista y tiene que tomar el color de `--g-plugin-icon-color`.
- En 3D, el giro e inclinación de la cámara se hacen dentro de un **marco ENU** (`eastNorthUpToFixedFrame`) con `rotateRight` / `rotateUp`, que es la receta que usa la propia API. Llamar a la cámara "a pelo" no sirve: la cámara va montada con `lookAt` y `rotateUp`, `rotateLeft` y `setView` con `orientation` no la mueven correctamente.
- El signo del giro está invertido a propósito: `rotateRight` con ángulo positivo baja el rumbo, pero en una cámara que mira hacia abajo eso haría girar el terreno al revés que la bolita. Se aplica el ángulo del puntero cambiado de signo para que bolita y mapa giren en el mismo sentido que en 2D.
- El **átomo** de 3D es una **palanca de velocidad**, no un valor: mientras está descentrado, la vista sigue girando o inclinando frame a frame; al soltarlo vuelve solo al centro y el bucle se detiene cuando llega. Doble clic sobre el átomo devuelve rumbo e inclinación al origen.
- El comentario de cabecera del fichero y parte del texto de `getHelp()` describen una versión anterior en la que el dial **no se montaba en 3D**; el `addTo()` actual sí añade el control nativo en ambas implementaciones y, en 3D, pinta encima su propia copia del dial.
