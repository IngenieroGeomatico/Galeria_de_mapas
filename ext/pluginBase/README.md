# Plugin Base Semilla (`ext/pluginBase`)

Clase base (`miPlugin_base`) y hoja de estilos transversal (`pluginBase.css`) para crear y refactorizar plugins en el repositorio **Galeria_de_mapas** (API-IDEE / API-CNIG).

---

## 🎯 Objetivo

Evitar la replicación de código transversal en cada plugin (constructor, resolución dual de API, normalización de colores e icono, montaje de paneles, integración con Supraplugin, contrato de estado 2D/3D, búsqueda recursiva de capas, estilos de panel lateral y botones).

Al realizar un cambio o mejora transversal en el comportamiento de los plugins, solo se modifica `ext/pluginBase/` y repercute automáticamente en todos los plugins que hereden de ella.

---

## 📦 Elementos Transversales Incluidos

1. **Resolución Dual de la API**: `this.api()` devuelve `window.IDEE || window.M`.
2. **Constructor Completo y Defensivo**:
   - `position` (`'TL'`, `'TR'`, `'BL'`, `'BR'`, por defecto `'TL'`).
   - `collapsible` (booleano, por defecto `true`).
   - `order` (CSS order numérico o `null` para áreas flex).
   - `color1`, `color2`, `color3` con normalización `{ active, deactive }`.
   - `icon` / `icono` / `svg` (SVG en string, path suelto, Data URI o URL).
   - `title` / `titulo` / `tooltip` / `tituloBarra`.
3. **Montaje Estándar de Panel (`_addToBase`)**:
   - Crea `IDEE.ui.Panel` con clases base y `g-panel-lateral`.
   - Crea `IDEE.Control`.
   - Inyecta variables CSS (`--g-plugin-bg-color`, `--g-plugin-border-color`, `--g-plugin-icon-color`, `--g-plugin-icon-mask`).
   - Asocia el panel al mapa y el control al panel.
4. **Contrato de Supraplugin (`getSupraElement`) de Serie**:
   - Construye el botón de la barra de supraplugin.
   - Sincroniza estado abierto/plegado y clics en el documento.
   - Oculta el botón nativo del mapa (`.g-panel-en-barra`).
5. **Contrato de Estado 2D / 3D (`getState` / `setState`)**:
   - Captura y restaura `panelCollapsed`.
   - Expone los hooks `getCustomState()` y `setCustomState(state, map)` para que las subclases solo declaren sus variables internas.
6. **Búsqueda Recursiva de Capas (2D / 3D)**:
   - `_findLayerByIdInMap(map, id)`
   - `_findLayerByLegendInMap(map, ident)`
   - `_findLayer(map, idOrIdent)`
   - `_getAllLayersFlat(map)`
7. **Ayuda Integrada (`getHelp`)**: Devuelve `{ title, content }` encapsulado en una Promise.
8. **Ciclo de Vida (`destroy`)**: Limpia supraplugin, paneles y referencias.
9. **Registro Global Triple Simplificado**: `miPlugin_base.registrar(Clase, 'miPlugin_nombre')`.

---

## 🚀 Cómo Usar en un Plugin

### 1. Cargar en el HTML del visor (`index.html`)

```html
<!-- Base transversal (siempre antes de los plugins hijos) -->
<link rel="stylesheet" href="../../ext/pluginBase/pluginBase.css" />
<script type="text/javascript" src="../../ext/pluginBase/pluginBase.js"></script>

<!-- Plugin concreto -->
<link rel="stylesheet" href="../../ext/miHerramienta/miHerramienta.css" />
<script type="text/javascript" src="../../ext/miHerramienta/miHerramienta.js"></script>
```

### 2. Estructura del Plugin (`miHerramienta.js`)

```js
(function () {
  "use strict";

  class miPlugin_miHerramienta extends miPlugin_base {
    constructor(options = {}) {
      super(options); // Inicializa todos los transversales
      this.name = 'miPlugin_miHerramienta';

      // Variables específicas de este plugin
      this._capaSeleccionada = options.capa || null;
    }

    addTo(map) {
      // 1. Montaje común de panel y control
      this._addToBase(map, 'tools_miHerramienta', 'control_miHerramienta', 'g-herramienta_miHerramienta');

      // 2. Definir la UI interior
      this._control.createView = (html) => this._buildUI(html);
    }

    _buildUI(html) {
      const container = document.createElement('div');
      container.className = 'mi-herramienta__container';
      container.innerHTML = '<p>Contenido propio del plugin</p>';
      return container;
    }

    // 3. Estado específico (opcional)
    getCustomState() {
      return {
        capaSeleccionada: this._capaSeleccionada,
      };
    }

    setCustomState(state, map) {
      if (state && state.capaSeleccionada) {
        this._capaSeleccionada = state.capaSeleccionada;
      }
    }
  }

  // Registro global triple automático
  miPlugin_base.registrar(miPlugin_miHerramienta, 'miPlugin_miHerramienta');
})();
```

---

## 🎨 Estilos Específicos del Plugin (`miHerramienta.css`)

Gracias a `pluginBase.css`, la hoja del plugin **solo** necesita definir los estilos de su vista interna:

```css
/* Solo definimos el interior del plugin; el panel, botón, máscara y panel lateral ya vienen de la base */
.mi-herramienta__container {
  padding: 12px;
  min-width: 260px;
  background: #ffffff;
}
```

---

## 🔍 Validación de Sintaxis

```bash
node --check ext/pluginBase/pluginBase.js
```
