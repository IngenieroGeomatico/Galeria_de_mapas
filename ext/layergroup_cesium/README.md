# 🧩 layergroup_cesium

> Da soporte funcional a `IDEE.layer.LayerGroup` en la implementación 3D (Cesium).

La build de Cesium de la API-IDEE trae la **fachada** de `LayerGroup` igual que la de OpenLayers, pero su **impl** es un stub vacío del bundle: `new IDEE.layer.LayerGroup(...)` crea un grupo sin implementación y el primer `addLayers()` lanza un `TypeError`. Esta extensión sustituye `IDEE.layer.LayerGroup` por una fachada propia que delega en un impl funcional de Cesium y **parchea la fachada del Mapa** para que los grupos aparezcan en `map.getLayers()` (el impl de Cesium los descarta) y el selector de capas pueda montar su árbol. El parche solo se aplica cuando la implementación activa es Cesium.

> ⚠️ **Utilidad interna / protegida.** No es un plugin registrado en el mapa (`mapajs.addPlugin`) ni tiene interfaz ni opciones de construcción: se carga como `<script>` y se instala sola. Por convención del repositorio, **no modificar** ningún fichero de esta carpeta (salvo encargo explícito): solo añadir capas Cesium desde aquí.

## ✨ Características

- Sustituye `IDEE.layer.LayerGroup` por una fachada que extiende **la misma clase base** que la fachada original (la de `IDEE.layer.WMS`), para que `map.addLayers(grupo)` siga validando `instanceof`.
- Impl propio `CesiumLayerGroupImpl`: guarda las capas hijas (incluidos subgrupos), las registra en el impl del mapa (`mapImpl.layers_`) y llama a su `getImpl().addTo(map)`; en cascada aplica `setMap()`, `setVisible()` y `setOpacity()`.
- **Parchea `IDEE.map`** (solo en Cesium) para que `getLayers()` incluya los grupos registrados y `removeLayers()` los dé de baja.
- **Normaliza `setZIndex`** de los impls de capa al rango real de las colecciones Cesium (`imageryLayers` / `dataSources` / `scene.primitives`), porque Cesium posiciona por índice (0..len-1) y no por `z-index` de OpenLayers.
- Re-aplicación idempotente cada **10 ms** (la API recrea `window.IDEE` en cada build y el sondeo de `cambioImpl` es de 100 ms) y reaplicación inmediata al cargar un `<script>` de Cesium.
- Registro de grupos por mapa en un `WeakMap` (se libera solo al descartarse el mapa).

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `layergroup_cesium.js` | Fichero único de la extensión (IIFE): impl `CesiumLayerGroupImpl`, fachada `LayerGroup` (`buildLayerGroupClass`), parcheo de `IDEE.map` (`wrapMapFactory`, `patchMapPrototype`) y bucle de instalación (`applyPatch`, cada 10 ms). No tiene CSS. |

## 🔧 Integración en un visualizador

```html
<script type="text/javascript" src="../../ext/layergroup_cesium/layergroup_cesium.js"></script>
```

Se carga **después** de la API y **antes** de re-ejecutar `mapa()` (en la práctica, junto al resto de `ext/`, antes del `mapa.js` del visualizador). No requiere `addPlugin`.

## ⚙️ Parámetros de construcción

Esta extensión **no se instancia** y no tiene opciones propias: parchea `IDEE.map` y `IDEE.layer.LayerGroup` al cargarse. Lo que sí se construye, una vez instalada, es un grupo con la firma (idéntica a la fachada original):

`new IDEE.layer.LayerGroup(userParameters, options, vendorOptions)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `userParameters.legend` | `string` | — | Nombre visible del grupo en el selector de capas. |
| `userParameters.name` | `string` | generado (`'layer_' + (1000..9999)`) | Nombre interno; si no se pasa, se genera para que el `idLayer` sea único por grupo. |
| `userParameters.type` | `string` | `'LayerGroup'` | Forzado siempre a `'LayerGroup'`. |
| `userParameters.collapsed` | `boolean` | — | Si el grupo empieza plegado en el selector de capas (gestionado por el selector). |
| `userParameters.visibility` | `boolean` | `true` (impl: `params.visibility !== false`) | Visibilidad inicial del grupo. |
| `userParameters.display` | `boolean` | `true` | Se conserva como `this.display`. |
| `options` | `Object` | `{}` | Opciones de la fachada (guardadas en `constructorParameters.options`). |
| `vendorOptions` | `Object` | `{}` | Opciones de vendor (guardadas en `constructorParameters.vendorOptions`). |

## 🚀 Ejemplo de uso

Igual que en OpenLayers; el parche hace que también funcione en Cesium:

```js
// Grupo raíz y subgrupo anidado (mapas/plantilla/js/mapa.js).
const grupoEjemplo = new IDEE.layer.LayerGroup({
  legend: 'Grupo de capas de ejemplo',
  collapsed: false,
});
mapajs.addLayers(grupoEjemplo);

const subgrupoEjemplo = new IDEE.layer.LayerGroup({
  legend: 'Subgrupo vectorial',
  collapsed: false,
});

// La capa hija se añade SOLO a su contenedor (el grupo), nunca al mapa y al
// grupo a la vez: añadirla dos veces duplica el registro y el render.
subgrupoEjemplo.addLayers(new IDEE.layer.WMS({ /* ... */ }));
grupoEjemplo.addLayers(subgrupoEjemplo);
```

Las capas deben ir **solo** a su contenedor (el mapa o su grupo), nunca a ambos.

## 🧩 API pública / Métodos

Sobre la fachada `LayerGroup` instalada:

| Método | Descripción |
|---|---|
| `addLayers(...capas)` / `addLayers([capas])` | Añade hijas (o subgrupos) al grupo. También acepta un array. |
| `removeLayers(...capas)` / `removeLayers([capas])` | Quita hijas del grupo (no las destruye). |
| `getLayers()` | Devuelve las capas hijas. |
| `ungroup(capa, removeIt)` | Saca una capa (o array) del grupo; con `removeIt === false` la deja en la raíz del mapa. |
| `setMap(map)` | Engancha/desengancha el grupo del mapa y lo registra/desregistra en el `WeakMap` de grupos. |
| `equals(other)` | Comparación por instancia de `LayerGroup` + `name` + `idLayer`. |

Sobre el impl `CesiumLayerGroupImpl`: `getLayers`, `getMap`, `getLayer` (devuelve `null` a propósito), `setMap`, `addLayer`, `removeLayer`, `ungroup`, `setVisible`/`isVisible`, `setOpacity`/`getOpacity`, `getZIndex` (techo del grupo = máx. z de hijas + 1), `setZIndex`, `get olLayer` (sombra con `getZIndex`/`setZIndex` para el selector), `equals`, `destroy`.

## ✅ Notas / Limitaciones

- **No es un plugin**: no se registra con `mapajs.addPlugin()`, no tiene `name` ni contrato `getState()`/`setState()` (no hay instancia que rehidratar).
- El parche se aplica **solo cuando la implementación activa es Cesium** (`IDEE.impl.cesium` y `IDEE.layer.WMS` presentes); la build de OL ya trae grupos funcionales y no se toca.
- Todos los globales son privados de la IIFE (`groupsByMap`, `createdMaps`, `installedLayerGroupClass`, `wrappedMapFactory`): **no expone nada en `window`**.
- El `getLayer()` del impl devuelve `null` a propósito: un grupo no tiene capa Cesium propia, y así `refreshIndexAndBaseStatus_` del impl Map lo omite en silencio.
- El `z` (z-index) se acota al rango real de la colección Cesium para evitar el `index_error` y el flip de `_isBaseLayer` que produce pasar z de OpenLayers (que puede ser negativo, duplicado o fuera de rango).
- **No modificar ningún fichero existente de esta carpeta** salvo encargo explícito.
