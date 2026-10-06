---
name: crear-plugin-idee
description: "Crear o modificar plugins de API-IDEE/API-CNIG en este repositorio (ext/): aplica el contrato de estado getState/setState, la exposición triple del global, los helpers de resolución de capas por legend/name y, para herramientas transversales, la plantilla de item del supraplugin. Usar cuando se pida 'crear un plugin', 'nuevo plugin', 'añadir herramienta', 'supraplugin', 'plantilla de plugin' o cualquier extensión de ext/."
---

# Crear o Modificar Plugins de API-IDEE / API-CNIG en Galeria_de_mapas

Este skill documenta el proceso y los convenios para crear, estructurar y registrar plugins en el directorio `ext/` del repositorio **Galeria_de_mapas** (basado en la API-CNIG / API-IDEE con soporte de doble implementación OpenLayers 2D y Cesium 3D mediante `cambioImpl`).

---

## 1. Cuándo usar este skill

Utiliza este skill cuando se requiera:
- Crear un nuevo plugin o extensión en `ext/` (por ejemplo, herramientas de análisis, selectores, controles de visualización, reproductores de ruta, etc.).
- Modificar un plugin existente adaptándolo a las convenciones de estado (`getState`/`setState`) o de doble implementación 2D/3D.
- Añadir un nuevo control o herramienta transversal que deba integrarse en la barra del **supraplugin** (`ext/supraplugin/`).

### Decisión clave: Plugin Estándar vs. Item de Supraplugin
- **Plugin estándar (`ext/plantilla_plugin/`)**: Es una herramienta autocontenida que añade paneles, botones flotantes o lógica de mapa propia y se registra directamente mediante `mapajs.addPlugin(...)`.
- **Item de supraplugin (`ext/plantilla_supraplugin/`)**: Es una herramienta o panel transversal que se aloja dentro de la barra flotante común del supraplugin (ej. comparación de vistas, utilidades globales). Su interfaz se encapsula devolviendo un elemento DOM mediante el contrato de items del supraplugin.

---

## 2. Contexto del Repositorio y Arquitectura

El repositorio organiza sus visualizadores y extensiones bajo la siguiente estructura:
- **`mapas/<Nombre>/`**: Directorio de cada visualizador. Contiene su `index.html` y `js/mapa.js`, donde se inicializa el mapa (`M.map`) y se configuran capas base, temáticas y registros de plugins.
- **`ext/<Plugin>/`**: Directorio de extensiones. Cada plugin se implementa como una clase ES6 (`miPlugin_*`) en su propio subdirectorio, acompañada de sus ficheros de estilo (`.css`).
- **El motor dual (2D / 3D)**: La API permite alternar en caliente entre OpenLayers (2D, EPSG:3857) y Cesium (3D, EPSG:4326) mediante el plugin `cambioImpl`. 

### Ciclo de Vida del Cambio de Implementación (`cambioImpl`)
Cuando el usuario activa el cambio de implementación:
1. Se captura el estado actual de los plugins registrados mediante `window.EstadoPlugins.capturarTodo(mapViejo)`.
2. Se recarga el bundle de la API y se re-ejecuta la función `mapa()` del visor.
3. **Se destruyen y recrean todas las capas y plugins desde cero**. Los identificadores de capa (`idLayer`, como `WMS15667420497092266nunezMadrid`) se **regeneran** con prefijos temporales distintos.
4. Se re-registran los plugins y se restaura el estado de la UI de forma diferida en cuanto se dispara el evento `COMPLETED` del mapa nuevo junto con un retardo de `setTimeout(..., 1200)`.
5. El plugin `miPlugin_cambioImpl` se **excluye** siempre de la captura/restauración. Los plugins que no implementen el contrato se ignoran silenciosamente sin causar errores.

---

## 3. Plantilla de Plugin Estándar (`ext/plantilla_plugin/`)

Cada plugin estándar sigue una estructura de clase ES6 específica que garantiza su correcta instanciación, acoplamiento al mapa y destrucción.

### Estructura de la Clase
El esquema real del repo (ver `ext/plantilla_plugin/plantilla_plugin.js`) usa **`IDEE.ui.Panel` con identificador + opciones**, un **control con `createView`** y el registro con `panel.addControls(control)` + `map.addPanels(panel)`:

```js
class miPlugin_miNombre {
  constructor(options) {
    this.name = 'miPlugin_miNombre';
    this.options = options || {};
    this._map = null;
    this._panel = null;
    this._control = null;
  }

  getHelp() {
    const IDEE = api();
    return {
      title: 'Mi Herramienta',
      content: new Promise((resolve) => {
        let html = '<div><p>Descripción de la funcionalidad.</p></div>';
        if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
          html = IDEE.utils.stringToHtml(html);
        }
        resolve(html);
      }),
    };
  }

  addTo(map) {
    this._map = map;
    const IDEE = api();

    // 1) Construcción del panel con identificador + opciones
    this._panel = new IDEE.ui.Panel('tools_miNombre', {
      collapsible: true,
      className: 'g-herramienta_miNombre',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    // 2) Creación del control y su vista (DOM)
    this._control = new IDEE.Control(new IDEE.impl.Control(), 'control_miNombre');
    this._control.createView = () => {
      const container = document.createElement('div');
      container.className = 'm-control m-container m-herramienta';
      container.innerHTML = '<header class="m-herramienta-header">Mi Herramienta</header>';
      // AQUÍ VA LA UI DEL PLUGIN
      return container;
    };

    // 3) Registro del control en el panel y el panel en el mapa
    this._panel.addControls(this._control);
    map.addPanels(this._panel);

    // 4) Activación defensiva del control
    try { this._control.activate(); } catch (e) { /* ignora */ }
  }

  destroy() {
    if (this._panel && typeof this._panel.close === 'function') {
      try { this._panel.close(); } catch (e) { /* ignora */ }
    }
    this._panel = null;
    this._control = null;
    this._map = null;
  }

  // Contrato de Estado para el cambio 2D/3D
  getState() {
    return {
      // Añadir propiedades de estado serializables de la UI (filtros, selecciones, etc.)
    };
  }

  setState(state, map) {
    if (!state || typeof state !== 'object') return;
    // Rehidrata la instancia YA montada (addTo ya se ejecutó tras el swap);
    // no vuelvas a construir la UI aquí.
  }
}
```

### Exposición Triple Obligatoria
Para asegurar que los plugins sobrevivan a la recarga del bundle de la API al cambiar entre 2D y 3D, cada fichero de plugin debe exponer la clase en tres ámbitos globales distintos al final del script (patrón exacto de `ext/selectorCapas/ext_layerSwitcher.js`):
```js
if (typeof window !== 'undefined') {
  window.miPlugin_miNombre = miPlugin_miNombre;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_miNombre = miPlugin_miNombre;
  window.M = window.M || {};
  window.M.plugin = window.M.plugin || {};
  window.M.plugin.miPlugin_miNombre = miPlugin_miNombre;
}
```
*Motivo*: El coordinador de cambio de implementación reinicializa `IDEE.plugin` al recargar el bundle, mientras que el global directo (`window.miPlugin_*`) persiste en la ventana.

### Resolución Global de la API y Helpers de Capas
- **Acceso a la API**: Utilizar siempre el resolvedor `function api() { return window.IDEE || window.M; }` (patrón del repo) en lugar de referirse a `IDEE`/`M` en duro.
- **Resolución de Capas por Legend/Name**: Puesto que los `idLayer` cambian en cada ejecución de `mapa()`, nunca guardes referencias directas a IDs en el estado. Implementa una búsqueda por identificadores estables (`legend` o `name`) **recorriendo también los grupos anidados**, con fallback por `idLayer`. La implementación completa ya está en la plantilla: copia `_findLayerByIdInMap(mapRef, id)` y `_findLayerByLegendInMap(mapRef, ident)` de `ext/plantilla_plugin/plantilla_plugin.js` (líneas 165-242). Esquema (los grupos se detectan por `type === 'LayerGroup'` / `_type === 'LayerGroup'` / tener `getLayers`):
```js
_findLayerByLegendInMap(mapRef, ident) {
  if (!mapRef || typeof mapRef.getLayers !== 'function' || !ident) return null;
  const isGroup = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
  const coincide = (c) => !!c && (
    (c.legend && String(c.legend) === String(ident)) ||
    (c.name && String(c.name) === String(ident))
  );
  const pila = [];
  for (const l of (mapRef.getLayers() || [])) {
    if (coincide(l)) return l;
    if (isGroup(l)) pila.push(l);
  }
  while (pila.length) {
    const g = pila.pop();
    for (const h of (typeof g.getLayers === 'function' ? g.getLayers() : [])) {
      if (coincide(h)) return h;
      if (isGroup(h)) pila.push(h);
    }
  }
  return null;
}
```

---

## 4. Pasos para Crear un Plugin Nuevo

Sigue esta checklist rigurosa para crear un plugin nuevo en el repositorio:

1. **Copiar la plantilla**: Copiar la carpeta `ext/plantilla_plugin/` a un nuevo directorio `ext/<nombre_plugin>/`.
2. **Renombrar ficheros y clases**: Renombrar los ficheros `.js` y `.css` y cambiar el nombre de la clase a `miPlugin_<nombre_plugin>`.
3. **Actualizar la identidad en los 7 puntos clave**:
   - Nombre de la clase (`class miPlugin_<nombre>`)
   - Propiedad `this.name = 'miPlugin_<nombre>'`
   - Exposición global directa: `window.miPlugin_<nombre> = miPlugin_<nombre>`
   - Exposición en IDEE: `window.IDEE.plugin.miPlugin_<nombre> = miPlugin_<nombre>`
   - Exposición en M: `window.M.plugin.miPlugin_<nombre> = miPlugin_<nombre>`
   - Registro en `mapas/<visualizador>/js/mapa.js`: `mapajs.addPlugin(new IDEE.plugin.miPlugin_<nombre>({ ... }))`
4. **Implementar el contrato de estado**: Añadir los métodos `getState()` y `setState(state, map)` si el plugin mantiene estado interactivo en la interfaz de usuario.
5. **Estilar con CSS**: Definir las reglas CSS específicas en el fichero de estilos del plugin (evitando colisiones de nombres mediante prefijos de clase coherentes).
6. **Vincular en el visualizador**: Cargar el fichero CSS y el fichero JS en el `index.html` del visualizador correspondiente (`mapas/<visualizador>/index.html`), asegurándose de cargarlos **después** de la API y **antes** del script `mapa.js`.
7. **Registrar en el mapa**: Instanciar y añadir el plugin dentro de la función `mapa()` del visualizador:
   ```js
   mapajs.addPlugin(new IDEE.plugin.miPlugin_<nombre>({ ... }));
   ```
8. **Validar sintaxis**: Ejecutar comprobación estática con `node --check ruta/al/fichero.js` en todos los scripts modificados o creados.

---

## 5. Plantilla de Item para el Supraplugin (`ext/plantilla_supraplugin/`)

Las herramientas transversales o paneles flotantes globales se agrupan frecuentemente en la barra de control superior gestionada por el **supraplugin** (`ext/supraplugin/`).

### Qué es un Supraplugin
Es un contenedor de herramientas flotante (`miPlugin_supraplugin`) ubicado en `ext/supraplugin/supraplugin.js`. Permite inyectar elementos de menú o botones de acceso rápido de manera modular. Ejemplos reales en el repositorio incluyen `ext/comparacionVistas/`. El visualizador de referencia para su uso se encuentra en `mapas/plantilla_supra/`.

### Contrato de Item del Supraplugin
Cualquier módulo que desee aportar un elemento a la barra del supraplugin expone una clase cuyo elemento visual se obtiene mediante el método `getSupraElement(supra)`:

```js
class miPlugin_itemSupraEjemplo {
  constructor(options) {
    this.name = 'miPlugin_itemSupraEjemplo';
    this.options = options || {};
    this._element = null;
  }

  getSupraElement(supra) {
    // Este método es re-invocado cada vez que se monta o refresca la barra
    const btn = document.createElement('button');
    btn.className = 'supra-item-btn';
    btn.textContent = 'Herramienta Supra';
    btn.onclick = () => {
      // Lógica de acción de la herramienta
    };
    this._element = btn;
    return btn;
  }

  // El contrato de estado getState/setState también aplica a nivel de item si mantiene UI abierta
  getState() {
    return { active: false };
  }

  setState(state, map) {
    // Restauración de estado
  }
}
```

### Cómo se Cuelga y Registra
1. El elemento se añade al gestor del supraplugin llamando a `supra.addItem(new miPlugin_itemSupraEjemplo())`.
2. El propio `supraplugin` se añade al mapa como un plugin estándar:
   ```js
   const supra = new IDEE.plugin.miPlugin_supraplugin();
   mapajs.addPlugin(supra);
   ```

---

## 6. Validación y Pruebas

Para garantizar la estabilidad del proyecto tras la creación o modificación de un plugin:
1. **Comprobación estática**: Ejecutar `node --check <fichero.js>` en cada archivo JavaScript creado o modificado.
2. **Verificación visual y funcional**: Levantar un servidor local estático en la raíz del repositorio (por ejemplo, con `python -m http.server 8765`) y abrir el visualizador correspondiente en el navegador.
3. **Prueba de doble implementación (2D / 3D)**:
   - Localizar el botón del cambio de implementación en la interfaz (el botón real corresponde al selector con selector CSS `#APIIDEE-herramienta-button` que posee la clase `buttonHerramienta_cambImpl activated`).
   - Alternar entre OpenLayers (2D) y Cesium (3D) para comprobar que el plugin se reinicializa correctamente, que no se producen errores fatales de consola bloqueantes y que el estado de la UI se recupera mediante `getState`/`setState`.
   *(Nota: Los avisos de consola originados en `apiidee.cesium.min.js` sobre índices de capas son internos de la librería externa y deben ignorarse).*

---

## 7. Convenciones del Proyecto

- **Idioma**: Todo el código nuevo, comentarios y mensajes de commit deben redactarse estrictamente en **español**.
- **Estilo de Commits**: Mensajes planos (`PLAIN`) sin co-autores, encabezados con prefijo temático claro (ej. `ext:`, `plantilla:`, `storymap:`, etc.).
- **Restricciones de Ficheros**: No modificar bajo ningún concepto el directorio `ext/layergroup_cesium/` salvo orden expresa.
- **Calidad de Código**: Asegurar que ningún script nuevo genere errores de sintaxis (`node --check`).

---

## 8. Iconos de los Plugins

Hay dos fuentes, y el orden de preferencia es este:

### 8.1. La fuente de iconos de la propia API (`g-cartografia`)

Es la primera opción cuando el icono representa algo que la API ya tiene (brujula, giroscopio, flechas, lupa...). Se pinta con `content` en el CSS del plugin:

```css
.mi-boton::before {
  content: "\e950";
  font-family: g-cartografia;
}
```

**Aviso medido (no saltarse esto)**: NO pongas una clase `g-cartografia-*` en un botón propio dentro de `.m-areas > .m-area > .m-panel`. `g-cartografia-flecha-izquierda` es la clase de la flecha de plegado del panel y el botón se queda con los estilos del panel (medido: 40x82, fondo blanco, saliéndose del botón). El glifo va siempre con `content` en el CSS del plugin.

### 8.2. SVG Repo (https://www.svgrepo.com/)

Para iconos que la API no tiene, o cuando el usuario traiga una URL de ahí. Es un buscador de SVG gratuitos, organizados en packs, y es la fuente que se ha pedido usar para los iconos nuevos.

**Cómo sacar el SVG a partir del ejemplo que da el usuario.**

Si el usuario pasa una URL de la **ficha**, `https://www.svgrepo.com/svg/<id>/<nombre>` (por ejemplo `.../svg/480720/compass`), el SVG de verdad está en la **de descarga**, que se obtiene cambiando `/svg/` por `/download/` y añadiendo `.svg`:

```
Ficha:    https://www.svgrepo.com/svg/480720/compass
Descarga: https://www.svgrepo.com/download/480720/compass.svg
```

Esa de descarga **sí** se puede pedir por automation. Tabla de lo medido:

| Vía | Resultado medido |
|---|---|
| `https://www.svgrepo.com/download/<id>/<nombre>.svg` | **LA QUE FUNCIONA**: 200, `content-type: image/svg+xml`, el SVG completo (compass 480720: 913 car.). Es la que hay que usar. |
| La ficha `https://www.svgrepo.com/svg/<id>/<nombre>` con `webfetch` o `fetch` | **HTTP 429**, "Vercel Security Checkpoint". |
| La ficha con Chrome headless (Playwright) | **Checkpoint**: "No se pudo verificar tu navegador", código 21, y 0 `<svg>` en el DOM. |
| La de descarga, pero devuelve 429 | Hay límite de peticiones. Medido con `globe-alt` (509123): falló 3 veces seguidas, con 45 s de espera entre medias y desde dos clientes distintos (el `fetch` del sandbox e `Invoke-WebRequest`). Reintentar pasado un rato y, si sigue, **pedírselo al usuario**. |
| Proxy de texto `https://r.jina.ai/https://www.svgrepo.com/svg/<id>/<nombre>` | Sirve para leer la **descripción** del icono y el **nombre del pack** (ej. "Orchid Line Interface Icons", "Transportation Icooon Mono"), que es lo que permite buscar el mismo dibujo en su origen. |

Pasos una vez descargado:

1. Guardarlo en `img/iconos/<nombre>.svg` y dejar en un comentario el **origen** (la ficha), la **URL de descarga** y el **pack**.
2. Limpiarlo: quitar el `<?xml ...?>`, el `<!DOCTYPE ...>` y el bloque `<style>` con las clases de color (`.st0{fill:#000000;}`); dejar el `viewBox` y el `path` tal cual, y poner `fill="currentColor"` para que el mismo fichero valga en línea (hereda de `color`) y como máscara (donde solo cuenta el alfa).
3. Usarlo según el caso: con el parámetro `icon` de la plantilla si es el icono de un botón; en línea en el DOM si además tiene que girar o moverse.

Si aun así no se consigue el `path`/`d`: pedir al usuario que lo pegue, o buscar el mismo icono en el **pack de origen** que ha dicho el proxy, o en otro repositorio de iconos libres del mismo estilo.

**Reglas al usar un SVG de ahí:**

- **En línea en el DOM**, nunca `<img>`: una `<img>` no puede tomar las variables CSS de color del plugin.
  ```js
  const icono = document.createElement('span');
  icono.className = 'mi-boton-icono';
  icono.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="..."/></svg>';
  ```
- **El color, solo de variables**: `fill: var(--g-plugin-icon-color)` o `currentColor`, y **ningún color escrito en el CSS** (los colores entran por el constructor como `color1/color2/color3`).
- **Conservar el `viewBox`** del original y ajustar el tamaño en el CSS (un `viewBox="0 0 24 24"` va bien a 18-20 px dentro de un botón de 40x40).
- **Dejar el SVG sea del color que sea el tema**: si trae `fill="#000"` fijo, pasarlo a `currentColor` para que siga la paleta del plugin.
- **Licencia**: muchos packs son CC0/CC-BY/MIT; comprobar la ficha del pack y dejar el origen en un comentario.
- Si el icono sustituye a otro que ya estaba (un glifo de la API), **quitar el anterior**: medido, al dejar los dos se ven los dos.

---

## 9. Referencias Documentales del Repositorio

Consulta las guías técnicas detalladas en `.opencode/docs/` para profundizar en aspectos concretos de la API:
- `.opencode/docs/API-IDEE.md`: Guía general de uso de la API-CNIG/IDEE, configuración de fondos, eventos y métodos globales.
- `.opencode/docs/OpenLayers.md`: Particularidades de la implementación 2D y manipulación de capas en OpenLayers.
- `.opencode/docs/Cesium.md`: Particularidades de la implementación 3D, cámara de Cesium y gestión de alturas sobre terreno.
- `.opencode/agent/api-idee-visualizador.md`: Definición operativa del agente especializado en visualizadores cartográficos.
