# 🗺️ MapLibre (maplibreLayer)

> Da soporte 3D a `IDEE.layer.MapLibre`, que en el bundle de Cesium está declarada pero sin implementación.

Parche de arranque sin interfaz: sustituye `IDEE.layer.MapLibre` por una fachada propia que hereda de la **misma** clase base que la del bundle y le pasa una implementación que sí pinta. En 3D esa implementación monta un `maplibregl.Map` en un div absoluto sobre el canvas del globo y lo deja sincronizado con la cámara en `scene.preRender` (antes de que Cesium pinte el frame), y proyecta ese canvas sobre la superficie del terreno con un `PostProcessStage` (drape). En 2D no se toca nada: ahí la capa la implementa la propia API.

## ✨ Características

- **Misma solución que OpenLayers, medida en `apiidee-1.1.0.ol.min.js`**: OL no mete las teselas en una capa de OL, monta un `maplibregl.Map` propio con `interactive: false`, `attributionControl: false` y `trackResize: false`, y en cada frame hace `jumpTo({center, zoom: zoomOL - 1, bearing: -rotation})` (el `-1` es porque MapLibre cuenta con teselas de 512 px y OL con 256). Aquí se hace lo mismo, pero el mapa de fuera es Cesium.
- **El porqué de la fachada**: el constructor de `IDEE.layer.MapLibre` pide su implementación al módulo de webpack `6149`, que en `apiidee.cesium.min.js` es `()=>{}`, un stub vacío (por eso el bundle avisa «La implementación usada no puede crear capas MapLibre»). Registrar la clase en `IDEE.impl.layer` o en `M.layer` no arregla nada, porque `__webpack_require__` no se expone en la ventana. Tampoco vale heredar de la fachada del bundle: su constructor siempre pide el módulo vacío.
- **El tipo `MapLibre` hay que enrutarlo**: `IDEE.impl.Map.addLayers` solo tiene rama para WMS, WMTS, KML, WFS, OGCAPIFeatures, MBTiles, XYZ, TMS, Tiles3D y Terrain; para el resto hace `know(tipo) || addUnknowLayers_(...)`, y `MapLibre` está en la lista de `know` **sin rama**, así que la capa se ignora en silencio (medido: no aparece en `getLayers()`, no se llama a su `addTo`). El parche mete esas capas por la vía de las no clasificadas (`addUnknowLayers_` + `facadeMap_.addUnknowLayers_`), las saca igual en `removeLayers` (`removeUnknowLayers_`, que sí llama a `destroy()`) y las incluye en `getUnknowLayers_` para que salgan en `getLayers()`.
- **`getUnknowLayers_` respeta el filtro para las MapLibre**: el impl de Cesium devuelve todas las capas de tipo desconocido aunque se le pase un filtro. Medido: `getLayers(baseTMS)` incluía la capa MapLibre, y el selector de capas base, al hacer `removeLayers(base)`, se la llevaba por delante al cambiar de base. Ahora las MapLibre se filtran por `name`, `type`, `legend` o `idLayer` (y por cadena), de modo que `getLayers(otraCapa)` devuelve solo lo que casa.
- **La librería se trae sola**: MapLibre GL JS **no** va en el bundle de Cesium (medido: de `maplibre` solo queda el nombre de la clase `maplibregl-canvas` en un helper de impresión), así que se carga de jsDelivr (`maplibre-gl@5.24.0`, js + css) la primera vez que se añade una capa, con una promesa compartida y reintento si el CDN falla.
- **Sincronización en `preRender`**: la vista se actualiza antes de que Cesium pinte, no en `postRender`; medido con un vuelo de cámara, la posición de la cámara ya es la definitiva en `preRender` y el overlay va un frame por delante.
- **Inclinaciones y FOV**: `maxPitch` de MapLibre a 85 (su máximo) y `pitch = 90 + pitchCesium`: un pitch de Cesium de -20° llega a 70° en MapLibre (antes se quedaba en 60°). El FOV vertical de MapLibre se iguala al `fovy` del frustum de Cesium (`setVerticalFieldOfView`), que es lo que evita que el overlay se separe al inclinar. Medido a 50° de inclinación: el error máximo pasa de 10 px a 4,8 px.
- **Sincronización medida**: 0-2 px con inclinaciones de hasta 60° (pitch de Cesium -30°) y 0-5 px a 40° de pitch de MapLibre (Cesium -50°), en puntos de hasta 7 km del centro. A 70° de pitch (Cesium -20°) el overlay plano no puede seguir la curvatura del globo: error máximo ~18 px en los bordes. Se mide comparando `map.project()` con el punto de terreno bajo cada píxel (`scene.globe.pick`); si se compara a altura 0 aparece un 3,4 % de error de escala que es pura paralaje (el terreno de Madrid está a ~650 m).
- **Drape sobre el MDT** (`drape`, por defecto activo): el canvas de MapLibre no se pinta en un plano de pantalla, se proyecta sobre el terreno real. Un `PostProcessStage` reconstruye por píxel el punto del globo desde la profundidad de Cesium (`czm_unpackDepth` + `czm_windowToEyeCoordinates` + `czm_inverseView`, el mismo patrón que usa el shader de translucidez del bundle) y lo lleva al canvas con `map.transform.mercatorMatrix`, que es la matriz con la que MapLibre pinta (medido: `map.project()` y la matriz dan el mismo píxel con 52° de pitch). Detalles que costaron medirlos:
  - Se entra con **uniform propio `u_globeDepth`** y una textura nula 1×1 de respaldo, no con `czm_globeDepthTexture`: si el sampler se queda sin enlazar en el primer frame el render revienta (`TypeError ... reading '_target'`).
  - **Del ECEF a mercator, sin trigonometría**: Web Mercator es conforme, así que alrededor del centro de la vista se pasa a mercator midiendo el desplazamiento en este y norte (producto escalar con los ejes de la base geodésica del centro) y escalándolo con `1/(2πN cos φ)` y `−1/(2πM cos φ)`. Lo calcula `referenciaDrape_` en JavaScript en doble precisión y entra por uniforms. Con la fórmula exacta en el shader (`atan`/`tan`/`log` + Bowring) los drivers se desvían ~1e-6 en mercator —unos 40 m— y el drape se iba de sitio: en una vista cenital el píxel central caía 39 m al este y 63 m al norte de su vertical. Con la linealización el UV del centro da (0,502, 0,502), las esquinas (0,1)/(1,0) y el error a 10 km del centro es de ~6 m.
  - **No se invierte la Y**: Cesium sube el canvas tal cual (texel `v=0` = fila inferior). Con una etapa de identidad, `texture(u_overlay, v_textureCoordinates)` da diferencia media 0,67 y 0 % de píxeles distintos contra el overlay plano; invirtiendo la Y se iba a 61,13 y 52 %.
  - `preserveDrawingBuffer: true` en `canvasContextAttributes` (MapLibre 5) para poder copiar el canvas a la textura; solo cuando el drape está activo.
  - El canvas se copia solo cuando MapLibre ha vuelto a pintar (`render`), no en cada frame de Cesium.
- **El overlay plano sigue ahí como respaldo**: el div se oculta (`visibility: hidden`, nunca `display: none`) solo en el primer frame con profundidad de globo real (`drapeListo_`), de modo que en los primeros frames se ve el overlay de siempre y no un hueco. Se vuelve al plano si falta `PostProcessStage`, `Context.depthTexture` o `Matrix4`, y también en caliente con `drapeUtilizable_()`: si el zoom que pide la cámara pasa del `maxZoom` de MapLibre (vistas a pie de calle) o la inclinación de MapLibre pasa de 76° (casi horizonte, donde la proyección 2D no puede seguir al globo), el stage se apaga y reaparece el div.
- **Precisión del drape**: a 52° de inclinación y 1,4 km de altura el contenido sigue el relieve y llena la pantalla sin costuras; a vista vertical queda a 0-2 px del overlay plano (se busca el desplazamiento que minimiza la diferencia: sale (0,2) px, es decir, medio metro a 900 m). Además, ~1 % de error de distancia en el centro de la pantalla (dentro de ±12 m a 1,2 km) y 3-4 % fuera del centro con 38° de inclinación y 1,4 km de altura (unos 40 px en el borde), que es el límite de la precisión de la profundidad del globo. Se mide pintando marcadores en MapLibre en lon/lat conocidas y comparando dónde los deja el drape con `SceneTransforms.worldToWindowCoordinates` sobre la altura real del terreno.
- **Coste del drape**: ~1 fps de 27 a 651 m con el horizonte a la vista (27,2 fps con drape, 28,2 con el stage apagado, 26,3 otra vez con drape), más la copia del canvas cuando MapLibre repinta.
- **Sin coste cuando no hace falta**: una sola intersección con el terreno por frame (el centro); la escala sale del `fovy` y el rumbo de `camera.up`, sin rayos laterales. El resto de frames se sale con una comparación de posición/rumbo/inclinación/alabeo. Medido en un vuelo: ~2,4 ms de media por frame (máx. 8,5 ms) incluyendo el `jumpTo`.
- **No se congela mirando al horizonte**: si el rayo central no toca el globo se conserva el último centro válido y se siguen actualizando rumbo e inclinación; las intersecciones de la cara opuesta del elipsoide se descartan (`puntoVisible_`). Al saltar de vista el terreno puede tardar en cargar y `globe.pick` devolver todavía el elipsoide (un punto válido pero mucho más lejos, con lo que el zoom se quedaba clavado en el valor anterior): mientras eso pase, `sincronizar_` reintenta hasta 90 frames (`REINTENTOS_SUELO`), sin esperar a que la cámara se mueva. Medido: salto a 1,4 km/-38°, zoom 16,082 calculado 16,099 tras converger.
- **`disableBackgroundColor` como en 2D**: pone la capa `background` del estilo en `transparent` (true) o `#f2f2f2` (false). Si el estilo no tiene capa de fondo no se hace nada; medido: el estilo de BTN Completa no la tiene (0 de 337), y en 2D eso le revienta a la implementación de OpenLayers, que hace `.find(...).id` sin comprobar el resultado.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `maplibreLayer.js` | Todo el parche: la carga de la librería, la implementación (`MapLibreImplCesium`), la fachada (`FachadaMapLibre`), el enrutado del tipo en el impl del mapa y la instalación. Expone `window.maplibreLayer`. |

No hay hoja de estilos: el overlay no tiene interfaz (el CSS que necesita MapLibre lo carga la propia librería).

## 🔧 Integración

No se añade como plugin: es un parche de arranque y lo carga `cambioImpl` en `EXTENSIONES_CAPAS_3D` **antes** de recargar el bundle, porque puede haber capas `MapLibre` creadas dentro de `mapa()` (las base y las rápidas se resuelven ahí).

```
{ ruta: 'maplibreLayer/maplibreLayer.js' }
```

La instalación es idempotente: se intenta al cargar el script, cada 10 ms mientras la build de Cesium no exista y al terminar de ejecutarse el `<script>` de la build (el cambio 2D/3D la reemplaza y `window.IDEE` es un objeto nuevo). En 2D no se toca nada (`IDEE.impl.cesium` tiene que existir).

## ⚙️ Parámetros de la capa

`new IDEE.layer.MapLibre(parameters, options, vendorOptions)` — las mismas claves que en 2D.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | `string` | — | URL del estilo. Ejemplo medido: `https://vt-btn.idee.es/files/styles/BTN_Completa.json`. |
| `maplibrestyle` | `string\|Object` | — | Estilo ya resuelto (tiene prioridad sobre `url`). |
| `style` | `string` | — | Estilo serializado en base64 (enlaces compartidos); se decodifica y se usa como estilo. |
| `name` / `legend` | `string` | — | Nombre del servicio y nombre visible en el selector. |
| `extract` | `boolean` | `true` | Extracción de atributos. |
| `visible` | `boolean` | `true` | Visibilidad inicial (clave propia de la API; la base de Cesium mira `visibility`, se respetan las dos). |
| `options.disableBackgroundColor` | `boolean` | `undefined` | `true` deja el fondo transparente (pinta sobre el mapa de Cesium), `false` lo pone opaco (funciona como capa base). |
| `vendorOptions.mapLibreOptions` | `Object` | `{}` | Opciones que se pasan tal cual a `maplibregl.Map`; su `style` tiene prioridad sobre todo lo demás. Si no se indica `maxPitch`, se pone 85 (el máximo de MapLibre) para que el overlay pueda inclinarse como Cesium. El FOV vertical se sincroniza con el de Cesium en cada frame. |
| `vendorOptions.mapLibreOptions.drape` | `boolean` | `true` | Proyecta el canvas sobre el terreno (ver «Drape sobre el MDT»). `false` deja el overlay plano de siempre; también se usa solo como fallback si la escena no lo soporta. No se pasa a MapLibre. |

## 🧩 Métodos públicos

### De la fachada

| Método | Descripción |
|---|---|
| `getMapLibreStyleFromId(ids)` | Capas del estilo (todas, o las de `ids`). |
| `setPaintProperty(capa, propiedad, valor)` / `setLayoutProperty(...)` | Atajos a `maplibregl.Map`. |
| `setMapLibreStyleFromId(lista)` | `[{id, paint: [{property, value}], layout: [...]}]`. |
| `setStyleMap(estilo)` / `set url` / `set maplibrestyle` | Cambian el estilo (`setStyle`); el fondo se reaplica en `style.load`. |
| `getProjection()` | `EPSG:3857` (el que declara la capa). |
| `getFeatures()` / `getFeatureById(id)` | Entidades de MapLibre (`queryRenderedFeatures`), no de la API. |
| `getGeometryType()` | `null`. |
| `equals(otra)` | Compara `url`, `name`, `idLayer` y `template`. |

### De la implementación (capa 3D)

| Método | Descripción |
|---|---|
| `addTo(map)` / `destroy()` | Crean y desmontan el overlay (MapLibre, div, escucha de `preRender`). |
| `setVisible(visible)` / `isVisible()` | `display` del overlay. |
| `setOpacity(op)` / `getOpacity()` | `opacity` del canvas de MapLibre. |
| `getUnknowLayers_` / `addLayers` / `removeLayers` | Parcheados en el impl del mapa (ver «Características»). |

## 🚀 Ejemplo de uso

```js
// La capa rápida del catálogo de la API ya la usa: QUICK*BTN_Completa_MapLibre.
mapajs.addLayers(['QUICK*BTN_Completa_MapLibre']);

// O a mano, con la misma definición que en 2D:
const btn = new IDEE.layer.MapLibre({
  url: 'https://vt-btn.idee.es/files/styles/BTN_Completa.json',
  name: 'BTN_Completa',
  legend: 'BTN Completa',
  extract: true
}, { disableBackgroundColor: false });
mapajs.addLayers([btn]);

btn.setOpacity(0.6);
btn.setVisible(false);
mapajs.removeLayers([btn]);   // quita el overlay y destruye el mapa de MapLibre
```

Desde la consola: `window.maplibreLayer.fachada()` devuelve la fachada instalada y `window.maplibreLayer.cargar()` la promesa de la librería.

## ✅ Notas y limitaciones

- **Casi al horizonte se vuelve al overlay plano**: el drape solo vale mientras la proyección 2D de MapLibre pueda representar la vista. Con más de 76° de inclinación de MapLibre (Cesium por encima de -14°) o cuando el zoom necesario pasa del `maxZoom` de MapLibre, el contenido se estira y el stage se apaga solo (`drapeUtilizable_`). Es el límite de apoyarse en una proyección 2D: un drape exacto a ras de suelo exigiría reproducir la perspectiva del globo en el shader. Con el overlay plano, en esas vistas la sincronización tampoco cuadra con la curvatura a partir de ~60° de pitch (a 70°, ~18 px medidos).
- **No atiende clics** (`interactive: false`, igual que en OL) y el div lleva `pointer-events: none`: Cesium sigue recibiendo clic, rueda y arrastre. El overlay va dentro del contenedor del widget de Cesium, así que un clic sobre el mapa llega al globo aunque esté pintado encima.
- **Una capa = un `maplibregl.Map`**, con su propia descarga y decodificación de teselas. Dos capas MapLibre son dos mapas de MapLibre; en 2D pasa lo mismo.
- **El overlay tapa visualmente lo que Cesium dibuje encima del terreno** (entidades, rásters) allí donde el estilo pinte. Al ser transparente por defecto solo se nota con estilos con fondo opaco.
- **El orden lo da el DOM**: la capa añadida después queda encima. `setZIndex` se guarda pero no se usa, porque el overlay no vive en `imageryLayers`.
