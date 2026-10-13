# Referencia de OpenLayers en Galeria_de_mapas

Esta guía documenta cómo se integra y utiliza **OpenLayers** (como implementación 2D subyacente de la **API-CNIG / API-IDEE**) dentro del repositorio `Galeria_de_mapas`. No pretende ser una introducción general a OpenLayers, sino un manual estrictamente anclado en los patrones reales observados en el código fuente de este proyecto.

---

## 1. Relación entre API-CNIG (`M` / `IDEE`) e Implementación OpenLayers

El visualizador se inicializa utilizando los objetos globales de la API del CNIG (`M` y el alias `IDEE`). La función constructora principal crea el mapa en 2D por defecto a través de `M.map({...})`:

```javascript
// Ruta: mapas/LucesdeBohemia/js/mapa.js
mapajs = M.map({
  container: "mapa",
  zoom: 12,
  center: { x: -413064.3575507956, y: 4927841.089710372 },
  layers: []
});
```

### El objeto MapImpl y la diferenciación 2D / 3D (`checkImpl`)
Para saber si el visualizador se encuentra ejecutando la implementación OpenLayers (2D) o Cesium (3D), el repositorio utiliza la función auxiliar `checkImpl()` examinando la presencia de `scene.camera` en el objeto devuelto por `mapajs.getMapImpl()`:

```javascript
// Ruta: mapas/LucesdeBohemia/js/mapa.js
function checkImpl() {
  let mapImpl = null;
  try {
    if (typeof mapajs !== 'undefined' && mapajs && typeof mapajs.getMapImpl === 'function') {
      mapImpl = mapajs.getMapImpl();
    }
  } catch (e) { /* mapa aún no listo */ }
  return (mapImpl && mapImpl.scene && mapImpl.scene.camera &&
    typeof Cesium !== 'undefined') ? 'cesium' : 'ol';
}
```
En OpenLayers (`'ol'`), `mapajs.getMapImpl()` devuelve la instancia interna de OpenLayers y **no** expone propiedades de cámara 3D como `scene.camera`.

---

## 2. Sistema de Coordenadas y Proyecciones

- **Centro del mapa y navegación**: Las coordenadas de centro pasadas tanto al constructor `M.map` como a los métodos de movimiento (`mapajs.setCenter()`) se expresan **siempre en EPSG:3857** (coordenadas planas métricas tipo `{x, y}`), tal como se observa en `mapas/LucesdeBohemia/js/mapa.js`:
  ```javascript
  center: { x: -413064.3575507956, y: 4927841.089710372 }
  ```
- **Datos GeoJSON**: Las geometrías dentro de las colecciones `GeoJSON` de las capas vectoriales se definen habitualmente en coordenadas geográficas estándar (EPSG:4326 `[lon, lat]`), encargándose OpenLayers/Mapea de su reproyección y representación espacial en el visor.

---

## 3. Tipos de Capas y Estilos

El código del proyecto instancia diversos tipos de capas soportados por la API sobre OpenLayers:

### Capas TMS y WMS

#### `wrapX`: que la capa dé la vuelta al mundo

Con `wrapX` a `true` una fuente de teselas **pinta el mundo en bucle**: al cruzar el
antimeridiano se ve el planeta repetido, que es lo normal en un mapa generalista. Con
`false`, al otro lado de ±180 no hay nada.

**El valor por defecto NO es el mismo en todas las fuentes**, y la API no lo unifica:

| Fuente OpenLayers | Qué la usa | Defecto de `wrapX` |
|---|---|---|
| `ol.source.TileImage` | `TMS`, `XYZ` (heredan de ella) | `options.wrapX !== false` → **true** |
| `ol.source.TileWMTS` | `WMTS` | sin valor por defecto → **false** |
| `ol.source.TileWMS` | `WMS` | sin valor por defecto → **false** |

Medido en `mapas/MapaBase`: la capa base «Imagen» (`BASE_PNOA_MA_TMS`) sale con
`wrapX=true` y «Callejero» (`BASE_MapaBase_IGNBaseTodo_WMTS`) con `wrapX=false`, sin
que el visualizador haya pedido ninguna de las dos cosas.

Doswege que **no** funcionan:

```javascript
// 1) La API no deja pasar la opción: solo reenvía crossOrigin al impl.
new IDEE.layer.TMS({ url: '...', wrapX: false });   // sigue saliendo wrapX=true

// 2) OpenLayers lee el CAMPO wrapX_, no la propiedad observable.
fuente.set('wrapX', false);
//    -> fuente.get('wrapX') === false  pero  fuente.wrapX_ === true (no cambia nada)
```

El que sí funciona es tocar el campo, y hay que avisar con `changed()` para que repinte:

```javascript
// La implementación vive en ext/selectorCapas/ext_layerSwitcher.js
const fuente = capa.getImpl().olLayer.getSource();
fuente.wrapX_ = true;
fuente.changed();
```

Para ponerlo a **todas** las capas de una vez está `window.miWrapX`, que define
`ext/selectorCapas/ext_layerSwitcher.js` — el plugin que gestiona las capas, así que
**no hay que cargar ningún script aparte**: los 28 visualizadores del repositorio ya
cargan ese fichero, y `miPlugin_layerSwitcher.addTo()` ya llama a `miWrapX.aplica(map)`
por su cuenta.

```javascript
miWrapX.aplica(mapa);   // por si se quiere llamar a mano
```

Recorre la colección de capas (incluidos los grupos), pone `wrapX_ = true` a toda fuente
que lo tenga —las vectoriales no lo tienen y se dejan como están— y se queda escuchando
altas y bajas, de modo que también tapa las capas que se añadan después. Es idempotente.
En 3D no hace nada: el impl de Cesium no tiene `getLayers()`.

Además de definarla, el plugin la usa; y la usan con guardia (si el fichero no está
cargado, la llamada se salta) otros tres sitios: `ext/selectorCapas/ext_backgorundLayers.js`
(tras `addLayers` de la capa base), `ext/catalogo/catalogo_url.js` (en `cargar()`, tras
`mapa.addLayers(capas)`) y `ext/mapInfo/mapInfo.js` (al arrancar).

Ojo: esto es **la mitad** del asunto. La otra mitad es la extensión de la capa, que
también recorta las copias del mundo repetido, y de eso se encarga `mapInfo`, con su
modo global (ver `_recortarCapas` en `ext/mapInfo/mapInfo.js`). Sin las dos, el mapa se
corta en ±180.

#### Ejemplos

```javascript
// Ruta: mapas/LucesdeBohemia/js/mapa.js
Base_IGNBaseTodo_TMS_2 = new M.layer.TMS({
  url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
  legend: 'IGNBaseTodo_2',
  visible: true,
  isBase: true,
  tileGridMaxZoom: 17,
  name: 'IGNBaseTodo_2',
}, {
  crossOrigin: 'anonymous',
  displayInLayerSwitcher: false,
});

const layer_1910 = new M.layer.WMS({
  url: 'https://www.ign.es/wms/planos',
  name: 'nunezMadrid',
  legend: 'Nuñez Granés 1910',
  tiled: true,
  visibility: true,
}, {});
```

### Capas GeoJSON y Estilos genéricos (`M.style.Generic`)
Las capas vectoriales cargan colecciones GeoJSON y aplican simbología mediante `M.style.Generic` para puntos, líneas y polígonos:
```javascript
// Ruta: mapas/LucesdeBohemia/js/mapa.js
estilo1_1 = new M.style.Generic({
  point: {
    radius: 7,
    fill: { color: 'orange', opacity: 0.9 },
    stroke: { color: 'red', width: 3 },
  },
  polygon: {
    fill: { color: 'red', opacity: 0.7 },
    stroke: { color: '#FF0000', width: 0.9 }
  },
  line: {
    fill: { color: 'red', opacity: 0.7 },
    stroke: { color: '#FF0000', width: 4 }
  }
});

const layerVectorialGJSON_Libro = new M.layer.GeoJSON({
  name: "layerVectorialGJSON_L",
  legend: "Recorrido de Bohemia",
  source: gjsonVectorialGJSON_Libro,
  extract: true,
}, {
  displayInLayerSwitcher: true,
  visibility: true,
});
layerVectorialGJSON_Libro.setStyle(estilo1_1);
mapajs.addLayers(layerVectorialGJSON_Libro);
```

---

## 4. Gestión de Identificadores y Grupos de Capas (`LayerSwitcher`)

Un aspecto crucial en la integración del proyecto con el selector de capas personalizado (`ext/selectorCapas/ext_layerSwitcher.js`) es cómo se identifican y recorren las capas:

- **Identificadores dinámicos vs estables**: La propiedad `idLayer` se autogenera o regenera con prefijos temporales (por ejemplo, `GeoJSON<timestamp>layer...`) cada vez que se reinicia el mapa mediante la función `mapa()`. 
- **Búsqueda por leyenda/nombre**: Para mantener referencias estables entre recargas y cambios de implementación, el selector de capas busca las capas barriendo recursivamente el mapa utilizando `legend` o `name` como clave estable:
  ```javascript
  // Ruta: ext/selectorCapas/ext_layerSwitcher.js
  _findLayerByLegendInMap(mapRef, ident) {
    if (!mapRef || typeof mapRef.getLayers !== 'function' || !ident) return null;
    try {
      const isGroup = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
      const coincide = (c) => !!c && (
        (c.legend && String(c.legend) === String(ident)) ||
        (c.name && String(c.name) === String(ident))
      );
      const allLayers = mapRef.getLayers() || [];
      const stack = [];
      for (const l of allLayers) {
        if (coincide(l)) return l;
        if (isGroup(l)) stack.push(l);
      }
      while (stack.length) {
        const g = stack.pop();
        let hijos = [];
        try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
        for (const h of hijos) {
          if (coincide(h)) return h;
          if (isGroup(h)) stack.push(h);
        }
      }
    } catch (e) { /* sin coincidencia */ }
    return null;
  }
  ```
- **Grupos de capas**: Cualquier contenedor de capas que exponga el método `getLayers()` es tratado como un grupo de capas anidadas dentro del recorrido recursivo del plugin de capas.

---

## 5. Eventos y Ciclo de Vida

- **Evento de carga de capa**: Las capas vectoriales emiten eventos de carga que se escuchan mediante la constante de eventos de la API (`M.evt.LOAD`):
  ```javascript
  // Ruta: mapas/LucesdeBohemia/js/mapa.js
  capa.on(M.evt.LOAD, () => {
    // Acciones tras la carga de entidades de la capa
  });
  ```
- **Interacción con StoryMaps**: En los pasos interactivos del story map (`mapas/LucesdeBohemia/js/storyMAp.js`), se limpian y recargan fuentes vectoriales dinámicamente:
  ```javascript
  // Ruta: mapas/LucesdeBohemia/js/storyMAp.js
  layerVectorialGJSON.clear();
  layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null;
  layerVectorialGJSON.setSource(gjson);
  layerVectorialGJSON.on(M.evt.LOAD, () => {
      mapjs.setBbox(layerVectorialGJSON.getMaxExtent());
      mapajs.setZoom(17);
  });
  ```
  > ⚠️ Nota: el código real de `storyMAp.js` llama a `mapjs.setBbox(...)` pero la variable global del mapa es `mapajs` (`mapjs` no está definida en el proyecto): se trata de un bug preexistente en el storymap, no de una convención.

---

## 6. Referencias oficiales de OpenLayers

- Código fuente: <https://github.com/openlayers/openlayers>
- Documentación de la API (última versión): <https://openlayers.org/en/latest/apidoc/>
