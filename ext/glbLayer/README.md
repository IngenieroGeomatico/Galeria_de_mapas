# ext/glbLayer (Modelos glTF/GLB no georreferenciados)

Extensión que añade soporte para modelos **glTF / GLB** que no llevan georreferenciación propia como capa nativa de la API: `IDEE.layer.glb` (alias `IDEE.layer.GLB`).

Un `.glb` es solo una malla 3D: no guarda ni dónde va ni cómo se orienta. Esta extensión permite colocarlo mediante un punto (`position`) o un rectángulo (`bbox`), orientarlo con los tres ángulos de Euler (`heading`, `pitch`, `roll`), escalarlo (`scale`) y fijar su cota (`heightOffset` y `clampToGround`).

- **3D (Cesium)**: se carga el modelo real mediante `Cesium.Model` con la matriz de transformación calculada a partir de los parámetros.
- **2D (OpenLayers)**: como 2D no dibuja mallas 3D, se calcula y dibuja la **huella** del modelo en el suelo (leída del `bbox` o del AABB real del glTF por HTTP `Range`).

La capa hereda de `IDEE.layer.Vector`, por lo que se integra automáticamente con el selector de capas (visibilidad, opacidad, encuadre `getMaxExtent`) y con el cambio de implementación 2D/3D (`cambioImpl`).

---

## Archivos

| Archivo | Descripción |
|---|---|
| `glbLayer.js` | Único JS de la extensión: instala `IDEE.layer.glb` (subclase de `IDEE.layer.Vector`), lee el AABB del glTF mediante HTTP Range, dibuja la huella en 2D y monta el `Cesium.Model` en 3D. Expone `window.glbLayer` y `window.miGLB`. |
| `README.md` | Este documento. |

---

## Uso

En el `index.html` del visualizador, cargar el JS de la extensión tras la API:

```html
<script src="../../../../ext/glbLayer/glbLayer.js"></script>
```

En `js/mapa.js`:

```js
// 1) Colocación por posición puntual
const capaPato = new IDEE.layer.glb({
  url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb',
  name: 'PatoGLB',
  legend: 'Pato (GLB) colocado por position',
  position: { lon: -0.8793, lat: 41.6566, height: 0 }, // EPSG:4326
  heading: 20,       // grados, horario desde el norte
  pitch: 0,
  roll: 0,
  scale: 0.35,       // número o { x, y, z }
  heightOffset: 0,   // metros sobre la base
  clampToGround: true, // cota relativa al terreno (por defecto true)
  baseAlSuelo: true,   // apoya la base del modelo en la cota (por defecto true)
});

// 2) Colocación por BBOX
const capaGlobo = new IDEE.layer.glb({
  url: 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumBalloon/CesiumBalloon.glb',
  name: 'GloboGLB',
  legend: 'Globo (GLB) colocado por bbox',
  bbox: [-0.8780, 41.6559, -0.8777, 41.6561], // [oeste, sur, este, norte] EPSG:4326
  heading: -30,
  ajustarABbox: true, // escala el modelo para encajar en el ancho/alto del bbox
});

mapajs.addLayers(capaPato);
mapajs.addLayers(capaGlobo);
```

También se pueden usar las funciones auxiliares de `window.glbLayer`:

```js
const capa = window.glbLayer.crearCapa(url, opciones);
window.glbLayer.anadirCapa(mapajs, url, opciones);
```

---

## Parámetros del constructor

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | `string` | *(obligatorio)* | URL del fichero `.glb` o `.gltf`. |
| `position` | `Object` \| `Array` | `null` | Coordenadas de colocación: `{ lon, lat, height }`, `{ x, y, z }` o `[lon, lat, height]` en EPSG:4326. |
| `bbox` | `Array<number>` | `null` | Rectángulo `[oeste, sur, este, norte]` en EPSG:4326. **Tiene precedencia sobre `position`**. |
| `heading` | `number` | `0` | Rotación en el plano horizontal (grados, positivo = horario desde el norte). Se aplica igual en 2D y 3D. |
| `pitch` | `number` | `0` | Inclinación vertical (grados). Solo aplica en 3D. |
| `roll` | `number` | `0` | Alabeo lateral (grados). Solo aplica en 3D. |
| `scale` | `number` \| `Object` | `1` | Factor de escala uniforme o por ejes (`{ x, y, z }`). |
| `heightOffset` | `number` | `0` | Desplazamiento vertical en metros. |
| `clampToGround` | `boolean` | `true` | Si es `true`, `position.height` se interpreta relativa al terreno (se consulta la cota real del suelo). Con `false` la cota es absoluta sobre el elipsoide WGS84. |
| `baseAlSuelo` | `boolean` | `true` | Si es `true`, se toma la `Y` mínima del glTF y se ajusta el origen para que la **base física** del modelo descanse exactamente en la cota de colocación. Con `false` se sitúa el origen local del glTF. |
| `ajustarABbox` | `boolean` | `false` | Solo con `bbox`: calcula automáticamente el factor de escala para encajar la anchura y profundidad del modelo dentro del rectángulo. |
| `huellaReal` | `boolean` | `true` | Si es `true`, intenta leer el AABB del glTF mediante HTTP `Range` para trazar la huella exacta en 2D. |
| `visible` | `boolean` | `true` | Visibilidad inicial. |
| `opacity` | `number` | `1` | Opacidad entre 0 y 1. |
| `glb` | `Object` | `{}` | Opciones adicionales directas para `Cesium.Model`. |

---

## Precedencia de `bbox` sobre `position`

Si se especifican tanto `bbox` como `position`:

1. El **centro del `bbox`** se usa como punto horizontal de colocación (`lon`/`lat`).
2. El **`bbox` es la huella 2D** (girada y escalada).
3. De `position` solo se aprovecha la altura (`position.height`), ya que el `bbox` 2D no aporta cota.
4. La rotación (`heading`) y la escala (`scale`) se aplican sobre el centro del rectángulo.

---

## Huella 2D (OpenLayers)

La huella vectorial en 2D se calcula por este orden de prioridad:

1. **Del `bbox`**, si se proporcionó.
2. **Del AABB del modelo glTF**: la extensión lee por HTTP `Range` solo la cabecera JSON del GLB (los primeros ~2 KB) y combina los `min`/`max` de los accessors `POSITION`. Los datos se transforman del convenio glTF (Y arriba) al marco ENU de Cesium (Z arriba), donde el plano horizontal es `(x, -z)`.
3. **Cuadrado genérico** de 0,0006° alrededor de `position` como fallback si no hay `bbox` ni se pudo leer el AABB.

---

## Cambio 2D / 3D

`IDEE.layer.glb` implementa el contrato de estado `getState()` / `setState(state, map)` coordinado por `window.EstadoPlugins`. Al alternar entre OpenLayers y Cesium con el plugin `cambioImpl`, la visibilidad, opacidad, escala, orientación y posición se preservan sin intervención del usuario.
