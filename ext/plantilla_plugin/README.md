# Plantilla de Plugin Estándar para API-IDEE / API-CNIG

Esta plantilla sirve como base oficial para crear extensiones y plugins nuevos dentro del directorio `ext/` del repositorio **Galeria_de_mapas**. Está diseñada en JavaScript vanilla (ES6), sin dependencias de frameworks externos, e integra todas las mejoras y convenciones arquitectónicas del repositorio.

---

## 1. Patrones Consolidados Incluidos

La plantilla incorpora de serie las mejores prácticas establecidas en el repositorio:

1. **Resolución Dual de la API**: Función `api()` que devuelve `window.IDEE || window.M`, garantizando compatibilidad con builds modernas y versiones anteriores de API-CNIG.
2. **Contrato de Estado 2D / 3D (`getState` / `setState`)**: Integración con el coordinador `window.EstadoPlugins` de `cambioImpl`. Permite conservar la configuración y selección de la UI al alternar en caliente entre OpenLayers (2D) y Cesium (3D).
3. **Búsqueda Recursiva de Capas por Identificador Estable**: Métodos `_findLayerByIdInMap` y `_findLayerByLegendInMap` con soporte para `LayerGroup`. Resuelven capas por `legend` o `name` cuando los `idLayer` se regeneran con prefijos temporales durante los reinicios de `mapa()`.
4. **Montaje Estándar con `IDEE.ui.Panel` e `IDEE.Control`**: Estructura de panel colapsable acoplada al mapa mediante `map.addPanels(panel)` y `control.createView`.
5. **Reordenación de Botones (`order`)**: Procesamiento defensivo de la opción `order` (índice 0-based) para ubicar el botón del plugin en una posición concreta del contenedor `.m-area`.
6. **Colores Configurables (`resolveColor`)**: Normalización de colores simples (`'#fff'`) u objetos (`{ active, deactive }`) aplicados mediante variables CSS al panel.
7. **Ayuda Integrada (`getHelp`)**: Devuelve `{ title, content }` encapsulado en una `Promise` usando `IDEE.utils.stringToHtml` con fallback defensivo.
8. **Método `destroy()`**: Esqueleto para desuscribir eventos y liberar referencias en el ciclo de vida del componente.
9. **Exposición Triple Global**: Registro simultáneo en `window.miPlugin_*`, `window.IDEE.plugin.miPlugin_*` e `window.M.plugin.miPlugin_*`. Esto asegurar que la clase sobreviva cuando `cambioImpl` recarga dinámicamente el bundle de la API al alternar dimensiones.
10. **Icono Configurable (`icon`)**: El icono del botón se pasa como SVG en el constructor. Si no se pasa, se queda el icono por defecto de la hoja de estilos.

---

## 2. Estructura de la Plantilla

```
ext/plantilla_plugin/
├── plantilla_plugin.js   # Clase ES6 del plugin autocontenida en IIFE
├── plantilla_plugin.css  # Estilos del panel, botón colapsado y máscara SVG
└── README.md             # Esta documentación
```

---

## 3. Guía Paso a Paso para Crear un Plugin Nuevo

Sigue esta lista de comprobación para instanciar un nuevo plugin a partir de la plantilla:

### Paso 1: Copiar la carpeta
Copia el directorio completo `ext/plantilla_plugin/` a una nueva carpeta con el nombre de tu extensión:
```text
ext/plantilla_plugin/  ->  ext/miHerramienta/
```

### Paso 2: Renombrar los ficheros
Renombra los ficheros `.js` y `.css` correspondientes:
- `ext/miHerramienta/plantilla_plugin.js` -> `ext/miHerramienta/miHerramienta.js`
- `ext/miHerramienta/plantilla_plugin.css` -> `ext/miHerramienta/miHerramienta.css`

### Paso 3: Checklist de Renombrado (7 Puntos Clave)
Abre `miHerramienta.js` y `miHerramienta.css` y sustituye los identificadores de la plantilla:

1. **Nombre de la clase**: `class miPlugin_miHerramienta { ... }`
2. **Propiedad de instancia**: `this.name = 'miPlugin_miHerramienta';`
3. **Identificadores del panel y control en `addTo`**:
   - `new IDEE.ui.Panel('tools_miHerramienta', ...)`
   - `new IDEE.Control(..., 'control_miHerramienta')`
4. **Clases CSS del panel**: `className: 'g-herramienta_miHerramienta'`
5. **Exposición global triple (al final de la IIFE)**:
   - `window.miPlugin_miHerramienta = miPlugin_miHerramienta;`
   - `window.IDEE.plugin.miPlugin_miHerramienta = miPlugin_miHerramienta;`
   - `window.M.plugin.miPlugin_miHerramienta = miPlugin_miHerramienta;`
6. **Selectores CSS**: Renombrar `.g-herramienta_plantilla` a `.g-herramienta_miHerramienta` en el fichero `.css`. El SVG de la máscara **no hace falta cambiarlo**: es el icono por defecto y se sustituye pasando `icon` al constructor (ver sección 4).
7. **Título y textos de ayuda**: Personalizar `getHelp()` con el nombre y descripción real de la herramienta.

### Paso 4: Diseñar la Interfaz de Usuario
Dentro del método `addTo(map)`, edita la función `control.createView` para construir el DOM necesario y asociar los oyentes de eventos (`addEventListener`).

### Paso 5: Implementar el Contrato de Estado
Define en `getState()` qué variables mínimas se deben conservar tras un reinicio de mapa (por ejemplo, filtros activos, capas seleccionadas) y restáuralas en `setState(state, map)`.

---

## 4. Integración en un Visualizador

Para utilizar el plugin en un visualizador cartográfico del repositorio (`mapas/<nombre>/`):

### 1. Vincular en `index.html`
Incluye las hojas de estilo y scripts **después** de la carga de la API-IDEE y **antes** del fichero `js/mapa.js`:

```html
<!-- Estilos del plugin -->
<link rel="stylesheet" href="../../ext/miHerramienta/miHerramienta.css" />

<!-- Script del plugin -->
<script type="text/javascript" src="../../ext/miHerramienta/miHerramienta.js"></script>

<!-- Script principal del mapa -->
<script type="text/javascript" src="js/mapa.js"></script>
```

### 2. Registrar en `js/mapa.js`
Instancia y añade el plugin dentro de la función `mapa()`:

```js
const pluginHerramienta = new IDEE.plugin.miPlugin_miHerramienta({
  position: 'TL',
  collapsible: true,
  order: 1,
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
  // Icono del botón. Admite el <svg> entero, solo su contenido interior
  // (<path/>, <circle/>...) o una URL. Si se omite, se usa el icono por
  // defecto de la hoja de estilos. También valen los alias `icono` y `svg`.
  icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="..."/></svg>'
});

mapajs.addPlugin(pluginHerramienta);
```

---

### 3. El icono del botón (`icon`)

El icono del botón plegado se pinta como **máscara** (`mask-image`), y el color sale de `background-color`, que es `var(--g-plugin-icon-color)`. De ahí dos cosas prácticas:

- El SVG puede traer los colores que quiera: en una máscara solo cuenta la parte opaca (el alfa), así que **siempre se ve con el color del plugin**.
- El SVG se inyecta en la variable CSS `--g-plugin-icon-mask`, no se toca el DOM del botón (que es de la API) ni se escribe ningún color en el CSS.

Acepta tres formas:

| Qué se pasa | Qué hace |
|---|---|
| `'<svg viewBox="0 0 24 24"><path d="..."/></svg>'` | Lo usa tal cual, con su `viewBox`. |
| `'<path d="..."/>'` (solo contenido) | Lo envuelve en un `<svg>` de 24x24. |
| `'/img/iconos/plane.svg'`, `'img/iconos/plane.svg'`, `'./icono.svg'`, `'data:...', 'https://...'` | Se usa como URL o ruta, tal cual. Medido: funcionan las cuatro, **incluido un dominio ajeno** (`https://upload.wikimedia.org/.../SVG_logo.svg`, respuesta 200). |
| Nada, o algo que no sea un SVG | Se queda el **icono por defecto** de la plantilla (una rueda dentada), con un aviso por consola. |

**Ojo con las rutas relativas**: se resuelven contra la URL de la **página que carga el mapa**, no contra el CSS del plugin. Desde `mapas/miVisor/index.html` hasta `img/iconos/plane.svg` hay que subir cinco niveles (`../../../../../img/...`), o mejor usar `/img/iconos/plane.svg`, que no depende de dónde esté la página.

Iconos: primero la fuente de la propia API (`g-cartografia`) y, para lo que no esté en ella, <https://www.svgrepo.com/>. Ejemplo real:

```js
new IDEE.plugin.miPlugin_miHerramienta({
  icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',
});
```

---

## 5. Validación de Sintaxis

Antes de finalizar la creación de un nuevo plugin, verifica la sintaxis de los ficheros creados:

```bash
node --check ext/miHerramienta/miHerramienta.js
```

---

## 6. Referencias Documentales

Para profundizar en la arquitectura y APIs disponibles en el proyecto, consulta:
- `.opencode/skills/crear-plugin-idee/`: Guía técnica y skill para la creación de plugins y supraplugins.
- `.opencode/docs/API-IDEE.md`: Métodos globales, eventos y gestión de capas de la API-IDEE.
- `.opencode/docs/OpenLayers.md`: Funcionamiento de la implementación 2D.
- `.opencode/docs/Cesium.md`: Funcionamiento de la implementación 3D.
