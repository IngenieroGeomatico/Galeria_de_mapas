# API-IDEE / API-CNIG en este repositorio

Guía específica del uso de la **API-CNIG/API-IDEE** en `Galeria_de_mapas`. Botón de referencia
de la arquitectura `ext/`, del bootstrap de visualizadores (`mapas/`) y del cambio de
implementación 2D/3D. Para las particularidades de cada motor, ver `OpenLayers.md` y `Cesium.md`.

## El global `M` (alias `IDEE`)

La API se carga con el global **`M`**, pero en el código convive el alias **`IDEE`**
(p. ej. `M.map(...)` ≡ `IDEE.map(...)`, `M.layer.WMS` ≡ `IDEE.layer.WMS`,
`mapajs.addPlugin(new IDEE.plugin.miPlugin_*())`). Como regla práctica del proyecto:

- El constructor de mapa y la mayoría del código usa `M.*`.
- `IDEE.*` aparece en: `IDEE.config.backgroundlayers`, `IDEE.utils.reproject`,
  `IDEE.plugin.miPlugin_*` y en el coordinador `(window.IDEE || window.M)?.evt`.
- `window` se mantiene entre swaps 2D/3D (solo se recarga el bundle de la API).

## Bootstrap de un visualizador (`mapas/<Nombre>/js/mapa.js`)

```js
function mapa() {
  // 1) Capa base de teselas (TMS del IGN/SCNE) registrada como QUICK layer
  const base = new M.layer.TMS({
    url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
    legend: 'IGNBaseTodo_2', name: 'IGNBaseTodo_2', visible: true, isBase: true,
    tileGridMaxZoom: 17,
    attribution: '<p><b>Mapa base</b>: <a href="...">SCNE</a></p>',
  }, { crossOrigin: 'anonymous', displayInLayerSwitcher: false });

  M.addQuickLayers({ Base_IGNBaseTodo_TMS_2: base });
  M.config("tms", { "base": "QUICK*Base_IGNBaseTodo_TMS_2" });

  // 2) Fondos alternativos (selector de fondo del visor)
  IDEE.config.backgroundlayers = [
    { id: "mapa", title: "Callejero", imgPreview: "img/IGNBase.png",
      layers: ["QUICK*Base_IGNBaseTodo_TMS_2"] },
    { id: "imagen", title: "Imagen", imgPreview: "img/imagen.png",
      layers: ["QUICK*BASE_PNOA_MA_TMS"] }
  ];

  M.proxy(false); // sin proxy, CORS directo

  // 3) El mapa: centro SIEMPRE en EPSG:3857
  mapajs = M.map({
    container: "mapa",
    zoom: 12,
    center: { x: -413064.3575507956, y: 4927841.089710372 },
    layers: []
  });

  // 4) Capas temáticas: WMS, GeoJSON...
  const capa = new M.layer.WMS({
    url: 'https://www.ign.es/wms/planos',
    name: 'nunezMadrid', legend: 'Nuñez Granés 1910',
    tiled: true, visibility: true, attribution: '<p>IGN</p>',
  }, {});

  // 5) Registro de plugins ext/ (ver seccion Plugins)
  mapajs.addPlugin(new IDEE.plugin.miPlugin_storymap({ ... }));
  mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({ ... }));
  // ...
}
mapa();
```

### Patrones habituales de capa y eventos

- **TMS**: `new M.layer.TMS({ url, legend, name, visible, isBase, tileGridMaxZoom, attribution }, opts)`.
- **WMS**: `new M.layer.WMS({ url, name, legend, tiled, visibility, attribution }, opts)`.
- **GeoJSON**: `new M.layer.GeoJSON(url_or_object, { name, legend, ... })`.
- **Estilos**: `new M.style.Generic({ fill, stroke, radius, ... })`; se aplican vía `capa.setStyle()`.
- **Eventos de capa**: `capa.on(M.evt.LOAD, () => ...)` — recurrente en `storyMAp.js`.
- **Evento de mapa (mapa listo)**: `mapajs.on(evt.COMPLETED, ...)` con
  `const evt = (window.IDEE || window.M).evt`.

## Plugins de `ext/` — clases `miPlugin_*`

Cada carpeta de `ext/` contiene 1-2 clases `miPlugin_*` (una clase por plugin):

| Carpeta `ext/` | Clase(s) | `this.name` |
|---|---|---|
| `storymap` | `miPlugin_storymap` | `miPlugin_storymap` |
| `selectorCapas` | `miPlugin_layerSwitcher`, `miPlugin_baseLayer` | `miPlugin_layerSwitcher`, `miPlugin_baseLayer` |
| `cambioImpl` | `miPlugin_cambioImpl` | `miPlugin_cambioImpl` |
| `modal` | `miPlugin_modal` | `miPlugin_modal` |
| `attribution` | `miPlugin_attribution` | `miPlugin_attribution` |
| `supraplugin` | `miPlugin_supraplugin` | `miPlugin_supraplugin` |
| `estereoscopia` | `miPlugin_estereoscopia` | `miPlugin_estereoscopia` |
| `controlClampToGroundLayers` | `miPlugin_clampToGround` | `miPlugin_clampToGround` |
| `georrefTeselas` | `miPlugin_georrefTeselas` | `miPlugin_georrefTeselas` |
| `CalidadAireMadridTiempoReal` | `miPlugin_calidadAire`, `miPlugin_leyenda` | `miPlugin_calidadAire`, `miPlugin_leyenda` |
| `FiltroCapasPuntosHistoricos` | `miPlugin_filtroCapas`, `miPlugin_leyenda` | `miPlugin_filtroCapas`, `miPlugin_leyenda` |
| `comparacionVistas` | `miPlugin_comparacionVistas` | `miPlugin_comparacionVistas` |
| `vueloFotogrametrico` | `miPlugin_vueloFotogrametrico` | `miPlugin_vueloFotogrametrico` |
| `layergroup_cesium` | NO registrado en el mapa (solo agrupa capas Cesium) | — |

### Estructura de un plugin

```js
class miPlugin_ejemplo {
  constructor(opciones) { this.name = 'miPlugin_ejemplo'; this.opciones = opciones; }
  add(map) { /* construir UI, colgar listeners, guardar this._map = map */ }
  destroy() { /* limpiar UI y listeners */ }
  // Contrato de estado (opcional): getState()/setState(state, map)
}
```

Se registran en el mapa del visor con `mapajs.addPlugin(new IDEE.plugin.miPlugin_ejemplo({...}))`.

## Cambio de implementación 2D/3D (`ext/cambioImpl/cambioImpl.js`)

Al alternar entre OpenLayers y Cesium:

1. `capturarTodo(map)` — **captura el estado de los plugins ANTES** de destruir el mapa.
2. `captureShareViewState(mode)` — guarda centro/zoom/rotación del mapa viejo.
3. `cambioImpl(tipo)` — reinicia el bundle de la API y re-ejecuta `mapa()`: esto **recrea
   TODAS las capas y re-instancia TODOS los plugins desde cero** (los `idLayer` se regeneran:
   `WMS15667420497092266nunezMadrid`, `GeoJSON<ts>layer...`).
4. `applyShareViewState(newMap, state, mode)` — restaura la vista de cámara en el mapa nuevo.
5. `transferOverlayLayers(newMap, Overlaylayers, { addExtrusion })` — transfiere capas solapadas.
6. `reRegistrarPluginsTrasSwap()` — re-registra plugins que viven en `window`.
7. `restaurarTodo(newMap, estados, true)` — **restaura el estado de los plugins DESPUÉS**,
   de forma diferida.

### Coordinador de estado `window.EstadoPlugins`

Definido en `cambioImpl.js` (guarda en `window` porque sobrevive a la recarga del bundle).
API completa:

- `EstadoPlugins.registrar(nombre, { capturar(plugin), restaurar(plugin, state, map) })` —
  adaptadores externos para plugins sin el contrato directo.
- `EstadoPlugins.capturarTodo(mapViejo)` → `{ nombrePlugin: estado }`. Llama a
  `plugin.getState()` si existe; si no, usa el adapter; **excluye siempre a
  `miPlugin_cambioImpl`/`cambioImpl`**; plugins sin contrato se ignoran sin error.
- `EstadoPlugins.restaurarTodo(mapNuevo, estados, diferido)` → `plugin.setState(state, mapNuevo)`
  (o adapter). Con `diferido=true` espera `evt.COMPLETED` del mapa nuevo + `setTimeout(1200)`.

**Contrato por plugin**:

```js
getState() { // -> objeto serializable con el estado MÍNIMO de la UI
  return { clave: valor, ... };
}
setState(state, map) { // rehidrata la instancia nueva (map es el mapa recién creado)
  ...
}
```

**CRÍTICO — los `idLayer` no son estables entre implementaciones.** `mapa()` regenera los ids
con prefijos temporales; al restaurar hay que resolver la capa por su `legend`/`name`
(identificadores estables) con fallback por id (ver `_findLayerByIdInMap` /
`_findLayerByLegendInMap` en `ext/selectorCapas/ext_layerSwitcher.js`).

## Helpers de implementación (patrón del proyecto)

En `mapas/LucesdeBohemia/js/mapa.js`:

```js
function checkImpl() {
  const mapImpl = mapajs.getMapImpl();
  return (mapImpl && mapImpl.scene && mapImpl.scene.camera &&
    typeof Cesium !== 'undefined') ? 'cesium' : 'ol';
}

function centrarStorymap(coord3857) {          // centre en EPSG:3857
  if (checkImpl() === 'cesium') {
    const [lon, lat] = IDEE.utils.reproject([coord3857.x, coord3857.y], 'EPSG:3857', 'EPSG:4326');
    mapajs.setCenter({ x: lon, y: lat });     // Cesium espera EPSG:4326
  } else {
    mapajs.setCenter(coord3857);              // OL trabaja en EPSG:3857
  }
}

function aplicaAlturaSobreTerrenoSiCesium(capa, metros) { /* setInterval + checkImpl() */ }
```

- `checkImpl()`: `getMapImpl()` devuelve el impl nativo; Cesium expone `scene.camera`, OL no.
- `centrarStorymap(coord3857)`: expuesto en `window` porque lo usan los scripts de los pasos
  del storymap; `IDEE.utils.reproject` es síncrona (los pasos no admiten `await`).

## Convenciones de validación

- Tras editar cualquier `.js`: `node --check <fichero>` en cada fichero tocado.
- Pruebas manuales: servidor local (p. ej. `python -m http.server 8765`) + Playwright sobre
  `http://localhost:8765/mapas/LucesdeBohemia/index.html`; el botón real del cambio 2D/3D es
  `#APIIDEE-herramienta-button` (clase `buttonHerramienta_cambImpl activated`).
- Al hacer swap 2D/3D pueden aparecer errores de consola de `apiidee.cesium.min.js`
  («El índice debe ser menor o igual al número de capas»): preexistentes de la librería,
  NO relacionados con los cambios del proyecto.

## Enlaces de referencia

- README del proyecto (licencia CC BY-NC, estructura).
- **Documentación oficial API-IDEE**: <https://github.com/Desarrollos-IDEE/API-IDEE> (código fuente) y
  <https://componentes.idee.es/api-idee/doc/> (documentación de la API).
- <https://deepwiki.com/Desarrollos-IDEE/API-IDEE> — análisis del código de la API.
- Ver también: `OpenLayers.md` (impl 2D) y `Cesium.md` (impl 3D) en esta carpeta `docs/`.