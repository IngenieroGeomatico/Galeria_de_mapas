# 🧩 miPlugin_clampToGround (proyección de geometrías)

> Alterna entre pegar las geometrías al terreno (clamp to ground) o situarlas sobre la esfera celeste.

Plugin específico del visor de constelaciones (Cesium 3D). Al activarse, sube los puntos al terreno muestreando el MDT (`Cesium.sampleTerrainMostDetailed`), activa `clampToGround` en polilíneas y polígonos y pone `HeightReference.CLAMP_TO_GROUND` en los billboards; además recoloca el «shell» de estrellas a altura 0 y recalcula planetas y Sol/Luna sobre la Tierra. Al desactivarse hace lo contrario: restaura la altura original de los puntos, apaga los `clampToGround` y manda el shell de estrellas a `1.0e9`. Todo el panel es un único botón con estado `activated`.

## ✨ Características

- Un solo botón con dos estados (`controlC1.activate()` / `controlC1.deactivate()`), con la clase CSS `activated` como indicador.
- Actuación **solo sobre capas proyectables**: `map.getLayers().filter(obj => obj.hasOwnProperty('proj'))`, usando su capa Cesium (`layer.getImpl().getLayer()`).
- Guarda la altura original de cada punto (`e._originalHeight`) la primera vez que se activa, para poder restaurarla exactamente al desactivar.
- Avisos por toast en cada transición (`IDEE.toast.success` / `IDEE.toast.info`).
- Contrato de estado 2D/3D: conserva el valor activo/inactivo, y en 2D lo guarda sin aplicarlo para que siga valiendo al volver a Cesium.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `ext.js` | Clase `miPlugin_clampToGround`: panel `m-herramientaC1` con el botón `#m-herramienta-button`, el control auxiliar (`activate`/`deactivate`), `setClampToGroundForLayers(layers, clampValue)` y el contrato de estado. |
| `ext.css` | Estilos del botón (`.buttonHerramienta`, círculo con `:before` para el icono, y `.buttonHerramienta.activated`), el contenedor `.m-herramienta-container` y el ajuste del panel en la esquina TR. |

## 🔧 Integración en un visualizador

```html
<link type="text/css" rel="stylesheet" href="../../ext/controlClampToGroundLayers/ext.css" />
<script src="../../ext/controlClampToGroundLayers/ext.js" type="text/javascript"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_clampToGround(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `order` | `number` | `null` | `order` CSS del panel dentro del área de botones (área `.m-area`, que la API monta como flex column). Los paneles sin `order` valen 0 y quedan por delante; `null` o un valor no numérico deja el botón donde lo coloca la API por defecto (el orden de `addPanels` / `addPlugin`). |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo del botón y del panel. |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde (botón + panel). |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono. |

> El panel se fija internamente en `IDEE.ui.position.TL` con la clase `m-herramientaC1`. Las seis variables CSS se escriben tanto en el panel como en el botón, para que sobrevivan a los re-renders del botón.

## 🚀 Ejemplo de uso

Ejemplo real (`mapas/constelaciones/index.html`, donde el plugin se añade **después** de `js/mapa.js`, que es quien crea `mapajs`):

```html
<script type="text/javascript" src="./js/mapa.js"></script>

<link type="text/css" rel="stylesheet" href="../../ext/controlClampToGroundLayers/ext.css">
<script src="../../ext/controlClampToGroundLayers/ext.js" type="text/javascript"></script>
<script type="text/javascript">
  mapajs.addPlugin(new IDEE.plugin.miPlugin_clampToGround());
</script>
```

Con las opciones disponibles:

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_clampToGround({
  order: -1,                       // el botón por delante del resto de la esquina TL
  color1: { active: '#ffffff', deactive: 'orangered' },
  color2: { active: '#71A7D3', deactive: '#ffffff' },
  color3: { active: '#71A7D3', deactive: '#ffffff' },
}));
```

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ active }`, leído de la clase `activated` del botón (`.m-herramientaC1 .buttonHerramienta`) y, si no hay botón, del último valor guardado en `_activeState`. Devuelve `null` si falla la lectura. |
| `setState(state, map)` | Guarda `_activeState` y, **solo si el mapa actual es Cesium** (se detecta por `impl.scene` + `impl.camera`), llama a `activate()` o `deactivate()` según difiera del estado real del botón. En OpenLayers no aplica nada y conserva el valor para el siguiente cambio a 3D. |

## 🧩 Métodos públicos

| Método | Descripción |
|---|---|
| `addTo(map)` | Crea el panel con `map.addPanels`, inyecta el botón, aplica los colores y monta el control auxiliar (`manageActivation`). |
| `setClampToGroundForLayers(layers, clampValue)` | Recorre las capas recibidas, extrae sus entidades (`getEntities()` / `entities.values` / `source.entities.values`) y, con `clampValue = true`, guarda la altura original de los puntos y los pega al terreno con `sampleTerrainMostDetailed`, además de activar `polyline.clampToGround`, `polygon.clampToGround` y `billboard.heightReference`. Con `false`, restaura `_originalHeight` y apaga esos tres. |
| `resolveColor(c)` | Traduce un color simple u objeto a `{active, deactive}`. |
| `getHelp()` | `{ title: 'Proyección de geometrías', content: Promise<html> }`. |
| `destroy()` | Desactiva el control (para no dejar hover sobre el terreno), baja el panel con `map.removePanel` (aquí **no** se cuelga ningún `IDEE.Control`, así que `removeControls` no sirve) y limpia `window.controlC1` si sigue siendo el de esta instancia. |

## ✅ Notas

- **Depende del visor que lo hospeda.** El `activate`/`deactivate` usan globales que define el visualizador de constelaciones: `Cesium`, `viewer`, `window.SHELL_ALT_METERS`, `layerEstrellas`, `layerPlanetas`, `rawPlanetas`, `buildStarsGeojsonAtTime_withMatrix(...)`, `getPlanetsGeoJSON(...)` y `actualizarSolYLuna(...)`. Sin ellos el plugin no funciona: no es reutilizable tal cual en otro visor.
- Solo se proyectan las capas que tienen propiedad propia `proj`; el resto se ignoran.
- El plugin comparte el control con el resto del visor a través de `window.controlC1` (compatibilidad medida con el `mapa.js` de constelaciones).
- Es un plugin de 3D: en 2D el botón se puede pulsar, pero las tareas de activación dependen de Cesium y el estado no se aplica.
- `destroy()` es obligatorio: `map.removePlugins()` de la API lanza `"t.destroy is not a function"` y **aborta** el resto del lote de plugins si falta.
