# Plantilla de Plugin Estándar para API-IDEE / API-CNIG

Esta plantilla sirve como base oficial para crear extensiones y plugins nuevos dentro del directorio `ext/` del repositorio **Galeria_de_mapas**.

Está basada en la clase transversal **`miPlugin_base`** (`ext/pluginBase/pluginBase.js`), la cual se **importa automáticamente** desde el código del plugin sin requerir etiquetas adicionales en el HTML del visor.

---

## 1. Patrones Heredados de `miPlugin_base`

Al extender de `miPlugin_base`, la plantilla incluye de serie y sin duplicar código:

1. **Importación Automática**: El script del plugin autocarga `pluginBase.js` y `pluginBase.css` de forma transparente.
2. **Resolución Dual de la API**: `this.api()` devuelve `window.IDEE || window.M`.
3. **Constructor Estándar**: Soporte para `position` ('TL', 'TR', 'BL', 'BR'), `collapsible`, `order` en flex column, `color1/2/3` y `icon` (SVG, data-URI o URL).
4. **Montaje Estándar (`_addToBase`)**: Panel lateral (`g-panel-lateral`), inyección de variables CSS `--g-plugin-*` y máscara `--g-plugin-icon-mask`.
5. **Contrato de Supraplugin (`getSupraElement`)**: Se puede colgar directamente de una barra supraplugin (`supra.addItem(plugin)`).
6. **Contrato de Estado 2D / 3D (`getState` / `setState`)**: Preserva el panel abierto/colapsado entre swaps y delega en `getCustomState()` y `setCustomState()`.
7. **Helpers Recursivos de Capas**: `_findLayerByIdInMap`, `_findLayerByLegendInMap` y `_findLayer` para resolver capas aunque `idLayer` cambie tras el swap.
8. **Ayuda Integrada (`getHelp`)**: Compatible con el gestor de ayuda de la API.
9. **Ciclo de Vida (`destroy`)**: Limpieza de panel, supraplugin y referencias.
10. **Registro Global Triple**: `miPlugin_base.registrar(Clase, 'miPlugin_nombre')`.

---

## 2. Estructura de la Plantilla

```
ext/plantilla_plugin/
├── plantilla_plugin.js   # Subclase ES6 que importa y hereda de miPlugin_base
├── plantilla_plugin.css  # Estilos específicos de la vista interna
└── README.md             # Esta documentación
```

---

## 3. Pasos para Crear un Plugin Nuevo

1. **Copiar la carpeta:**
   ```text
   ext/plantilla_plugin/  ->  ext/miHerramienta/
   ```

2. **Renombrar los ficheros:**
   - `ext/miHerramienta/plantilla_plugin.js` -> `ext/miHerramienta/miHerramienta.js`
   - `ext/miHerramienta/plantilla_plugin.css` -> `ext/miHerramienta/miHerramienta.css`

3. **Editar `miHerramienta.js`**:
   - Cambiar `class miPlugin_plantilla` a `class miPlugin_miHerramienta`.
   - Asignar `this.name = 'miPlugin_miHerramienta'`.
   - Configurar `_addToBase(map, 'tools_miHerramienta', 'control_miHerramienta', 'g-herramienta_miHerramienta')`.
   - Modificar `_buildUI()` con el HTML del plugin.
   - Definir `getCustomState()` y `setCustomState(state, map)` si se necesitan variables persistentes.
   - Registrar con `miPlugin_base.registrar(miPlugin_miHerramienta, 'miPlugin_miHerramienta')`.

---

## 4. Integración en un Visualizador

En `mapas/<visualizador>/index.html` (solo necesitas importar tu plugin, la base se importa sola):

```html
<!-- Solo tu plugin (el plugin se encarga de importar la base y los estilos estructurales) -->
<link rel="stylesheet" href="../../ext/miHerramienta/miHerramienta.css" />
<script type="text/javascript" src="../../ext/miHerramienta/miHerramienta.js"></script>
```

En `mapas/<visualizador>/js/mapa.js`:

```js
const pluginHerramienta = new IDEE.plugin.miPlugin_miHerramienta({
  position: 'TL',
  collapsible: true,
  order: 1,
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
  icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="..."/></svg>'
});

mapajs.addPlugin(pluginHerramienta);
```

---

## 5. Validación de Sintaxis

```bash
node --check ext/miHerramienta/miHerramienta.js
```
