# Cesium 3D en Galería de Mapas

Guía de referencia específica sobre cómo se integra y gestiona **Cesium** (la implementación 3D de la API-CNIG/API-IDEE) dentro de este repositorio `Galeria_de_mapas`. Este documento no es una guía genérica de Cesium, sino una referencia exacta anclada en el código y patrones locales del proyecto.

---

## 1. Detección de la implementación Cesium y el patrón `checkImpl()`

El visor permite alternar en tiempo de ejecución entre la implementación 2D (OpenLayers) y 3D (Cesium) mediante el plugin de cambio de implementación ubicado en `ext/cambioImpl/cambioImpl.js`. 

Para saber si el mapa activo está renderizando en Cesium, el código de los visualizadores (como en `mapas/LucesdeBohemia/js/mapa.js`) utiliza la función estándar `checkImpl()`:

```js
// mapas/LucesdeBohemia/js/mapa.js
function checkImpl() {
  const mapImpl = mapajs.getMapImpl();
  return (mapImpl && mapImpl.scene && mapImpl.scene.camera &&
    typeof Cesium !== 'undefined') ? 'cesium' : 'ol';
}
```

* **Detección nativa:** `mapajs.getMapImpl()` devuelve el objeto motor subyacente. En Cesium este motor expone la propiedad `scene.camera`, mientras que OpenLayers carece de ella.
* **Persistencia del entorno:** El objeto global `window` sobrevive al intercambio de implementación. Al cambiar de 2D a 3D, el bundle de la API se recarga y se re-instancian los plugins, pero las variables globales de estado se preservan.

---

## 2. Diferencia de proyección en `setCenter` y solución (`EPSG:3857` vs `EPSG:4326`)

Una diferencia crítica entre los motores en este repositorio es el sistema de referencia de coordenadas esperado al centrar la vista:

* **OpenLayers (2D):** Trabaja nativamente con coordenadas métricas proyectadas en **EPSG:3857** (Web Mercator).
* **Cesium (3D):** Requiere coordenadas geodésicas en **EPSG:4326** (Longitud y Latitud en grados decimales).

Para evitar fallos de posicionamiento o saltos erróneos de cámara al interactuar con storymaps o scripts de navegación, el proyecto implementa una función de retransición síncrona basada en `IDEE.utils.reproject`:

```js
// mapas/LucesdeBohemia/js/mapa.js
function centrarStorymap(coord3857) {
  if (checkImpl() === 'cesium') {
    const [lon, lat] = IDEE.utils.reproject([coord3857.x, coord3857.y], 'EPSG:3857', 'EPSG:4326');
    mapajs.setCenter({ x: lon, y: lat });     // Cesium espera EPSG:4326
  } else {
    mapajs.setCenter(coord3857);              // OL trabaja en EPSG:3857
  }
}
```

---

## 3. Plugins específicos de Cesium en el repositorio

El directorio `ext/` contiene extensiones modulares (`miPlugin_*`) diseñadas para enriquecer o adaptar el comportamiento en el entorno 3D de Cesium:

### A. Fijación al terreno (`ext/controlClampToGroundLayers/ext.js`)
* **Clase:** `miPlugin_clampToGround`
* **Propósito:** Permite alternar la proyección de las geometrías vectoriales entre pegadas al terreno (*clamp to ground*) y proyectadas sobre la esfera celeste o flotantes. Itera sobre las capas proyectables del mapa obteniendo sus implementaciones de Cesium (`layer.getImpl().getLayer()`) y ajustando su comportamiento espacial.

### B. Estereoscopía sintética (`ext/estereoscopia/estereoscopia.js`)
* **Clase:** `miPlugin_estereoscopia`
* **Propósito:** Ofrece modos de visión estereoscópica (anaglifo rojo/cian y vista partida tipo *side-by-side*) aprovechando los *PostProcessStages* nativos de Cesium y el relieve 3D real del MDT del IGN. Gestiona además el cálculo de cotas y el plano de referencia de posado.

### C. Vuelo fotogramétrico (`ext/vueloFotogrametrico/vueloFotogrametrico.js`)
* **Clase:** `miPlugin_vueloFotogrametrico`
* **Propósito:** Importa centros de fotogramas, líneas de pasada y huellas (*footprints*) a partir de ficheros de datos geospaciales. Visualiza las geometrías tanto en el visor 2D como sobre el relieve 3D de Cesium utilizando matrices de rotación fotogramétrica y cálculos de orientaciones espaciales.

### D. Altura de puntos sobre el terreno (`aplicaAlturaSobreTerrenoSiCesium`)
* **Patrón de código:** Definido en `mapas/LucesdeBohemia/js/mapa.js` para que los marcadores puntuales se eleven sobre el modelo digital de elevaciones en 3D (`ALTURA_PUNTOS_SOBRE_TERRENO = 2` m por defecto). Su mecánica real:
  1. **Localiza la dataSource Cesium** de la capa: primero `mapajs.getMapImpl().dataSources._dataSources` buscando por `d.name === capa.name` (la dataSource se registra por nombre al añadir la capa); en su defecto, `capa.getImpl().getLayer()` si tiene `entities`.
  2. **Aplica a cada entidad**: `Cesium.HeightReference.RELATIVE_TO_GROUND` como `heightReference`, la altura solicitada como `height` (`Cesium.ConstantProperty`) y `disableDepthTestDistance = Number.POSITIVE_INFINITY` para que los marcadores no se recorten contra el terreno y se vean enteros "flotando" sobre él.
  3. **Reintentos**: usa un bucle `setInterval` con timeout de 5 s para aplicar la altura cuando la escena Cesium esté lista y no esté a mitad de un cambio de implementación (`checkImpl()`).

### E. Transferencia de capas y extrusión (`ext/cambioImpl/cambioImpl.js`)
Cuando se efectúa el cambio de implementación hacia Cesium, el gestor invoca la función interna de transferencia:
* `transferOverlayLayers(newMap, Overlaylayers, { addExtrusion: true })`
* Activa explícitamente el parámetro `addExtrusion: true` para permitir la representación volumétrica y la correcta elevación de las capas superpuestas sobre el globo virtual.

---

## 4. Notas operativas y advertencias de consola

* **Avisos de librería externa:** Durante el intercambio dinámico entre OpenLayers y Cesium, la consola del navegador puede registrar mensajes emitidos por el núcleo compilado de la API (`apiidee.cesium.min.js`) del tipo: *"El índice debe ser menor o igual al número de capas"*. Se trata de un comportamiento interno y preexistente de la fachada de capas de la librería al reordenar índices de renderizado, el cual no bloquea la ejecución ni afecta a la estabilidad visual del visor.
* **Validación de cambios:** Tras modificar cualquier fichero de extensión relacionado con Cesium, comprobar la sintaxis con `node --check <fichero>` y verificar las interacciones visuales ejecutando el visor en un servidor local de desarrollo.

---

## 5. Referencias oficiales de CesiumJS

- Código fuente: <https://github.com/CesiumGS/cesium>
- Documentación de la API (CesiumJS): <https://cesium.com/learn/cesiumjs/ref-doc/>
