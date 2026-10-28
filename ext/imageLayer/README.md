# ext/imageLayer (Imágenes no georreferenciadas)

Extensión que añade soporte para **imágenes ráster** (PNG, JPEG, WebP) que no llevan georreferenciación propia como capa nativa de la API: `IDEE.layer.image` (alias `IDEE.layer.Image`).

Una imagen estándar no contiene metadatos de coordenadas ni tamaño en metros. Esta extensión permite georreferenciarla mediante un punto (`position`) con dimensiones en metros o mediante un rectángulo (`bbox`), orientarla (`heading`, `pitch`, `roll`), escalarla (`scale`) y fijar su cota.

- **2D (OpenLayers)**: la capa se implementa sobre `IDEE.layer.Vector` con una entidad polígono y un estilo personalizado con `renderer`. El motor dibuja la imagen directamente sobre las cuatro esquinas de la huella en píxeles del canvas mediante transformaciones afines, manteniendo nitidez en rotación, escala y zoom.
- **3D (Cesium)**:
  - **Tumbada en el terreno** (sin `pitch` ni `roll`): polígono con `ImageMaterialProperty`, `stRotation` para la orientación de la textura y `heightReference: RELATIVE_TO_GROUND`.
  - **Inclinada** (con `pitch` o `roll`): entidad de tipo `PlaneGraphics` tridimensional levantada del suelo y orientada mediante un cuaternión de Euler.

---

## Archivos

| Archivo | Descripción |
|---|---|
| `imageLayer.js` | Único JS de la extensión: instala `IDEE.layer.image` (subclase de `IDEE.layer.Vector`), aplica el renderer 2D afín sobre canvas y gestiona las entidades polígono / plano en Cesium 3D. Expone `window.imageLayer` y `window.miImagen`. |
| `README.md` | Este documento. |

---

## Uso

En el `index.html` del visualizador:

```html
<script src="../../../../ext/imageLayer/imageLayer.js"></script>
```

En `js/mapa.js`:

```js
// 1) Georreferenciada por BBOX y girada
const capaPlano = new IDEE.layer.image({
  url: '../../../../img/georrefTeselas.png',
  name: 'PlanoBbox',
  legend: 'Plano por bbox, girado 25 grados',
  bbox: [-0.8795, 41.6560, -0.8777, 41.6566], // [oeste, sur, este, norte] EPSG:4326
  heading: 25,       // grados, horario desde el norte
  scale: 1,
});

// 2) Georreferenciada por POSICION puntual, tamaño en metros e inclinación 3D
const capaCartel = new IDEE.layer.image({
  url: '../../../../img/georrefTeselas.png',
  name: 'CartelInclinado',
  legend: 'Cartel inclinado 35 grados (plano 3D)',
  position: { lon: -0.8768, lat: 41.6554, height: 0 },
  ancho: 70,         // metros
  alto: 30,          // metros
  heading: 90,
  pitch: 35,         // inclina la imagen como plano vertical/oblicuo en 3D
  scale: 0.8,
});

mapajs.addLayers(capaPlano);
mapajs.addLayers(capaCartel);
```

También se pueden usar las funciones de fábrica:

```js
const capa = window.imageLayer.crearCapa(url, opciones);
window.imageLayer.anadirCapa(mapajs, url, opciones);
```

---

## Parámetros del constructor

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | `string` | *(obligatorio)* | Ruta o URL de la imagen. |
| `position` | `Object` \| `Array` | `null` | Centro de la imagen: `{ lon, lat, height }`, `{ x, y, z }` o `[lon, lat, height]` en EPSG:4326. |
| `bbox` | `Array<number>` | `null` | Rectángulo `[oeste, sur, este, norte]` en EPSG:4326. **Tiene precedencia sobre `position`**. |
| `heading` | `number` | `0` | Giro en el plano horizontal (grados, horario desde el norte). Se aplica sobre el centro del `bbox` o de la `position`. |
| `pitch` | `number` | `0` | Inclinación vertical (grados). En 3D levanta la imagen como plano 3D; en 2D se dibuja la huella plana. |
| `roll` | `number` | `0` | Alabeo lateral (grados). |
| `scale` | `number` \| `Object` | `1` | Factor de escala uniforme o por ejes `{ x, y }`. **Se aplica tanto con `position` como con `bbox`**. |
| `ancho` | `number` | `null` | Anchura en metros (solo si no se usa `bbox`). Si solo se da uno de los dos, el otro se calcula con la relación de aspecto natural de la imagen. |
| `alto` | `number` | `null` | Altura en metros (solo si no se usa `bbox`). |
| `metrosPorPixel` | `number` | `1` | Resolución en metros/píxel cuando no se especifican `ancho`, `alto` ni `bbox`. |
| `heightOffset` | `number` | `0` | Desplazamiento vertical en metros. |
| `clampToGround` | `boolean` | `true` | Si es `true`, la cota se interpreta relativa al terreno. Con `false` es cota absoluta sobre el elipsoide WGS84. |
| `crossOrigin` | `string` | `'anonymous'` | Atributo CORS para la carga de la imagen (usa fallback automático sin CORS si falla). |
| `visible` | `boolean` | `true` | Visibilidad inicial. |
| `opacity` | `number` | `1` | Opacidad entre 0 y 1. |

---

## Precedencia de `bbox` sobre `position`

Si se especifican ambos:

1. El **`bbox` define la posición horizontal y las dimensiones iniciales** de la imagen.
2. De `position` solo se aprovecha la cota (`position.height`).
3. **La rotación (`heading`) y la escala (`scale`) se siguen aplicando** sobre el centro del rectángulo.

---

## Funcionamiento en 2D (OpenLayers)

La imagen no se tesela ni se rasteriza en un canvas intermedio fuera de vista:

1. Se genera un polígono con las cuatro esquinas de la huella en EPSG:3857 (SO, SE, NE, NO, SO).
2. El estilo asigna una función `renderer(pixelCoords, state)` que recibe las cuatro esquinas ya transformadas a coordenadas píxel por OpenLayers.
3. Se aplica `ctx.transform(...)` afín sobre el contexto 2D y se dibuja el `HTMLImageElement` mediante `ctx.drawImage`.
4. El renderizado es multiplicativo con el `pixelRatio` y la rotación nativa del visor, manteniendo nitidez en cualquier nivel de zoom.

---

## Cambio 2D / 3D

`IDEE.layer.image` implementa el contrato de estado `getState()` / `setState(state, map)` coordinado por `window.EstadoPlugins`, preservando todas sus propiedades al alternar entre OpenLayers y Cesium con `cambioImpl`.
