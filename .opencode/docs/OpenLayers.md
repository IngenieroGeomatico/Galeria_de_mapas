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
