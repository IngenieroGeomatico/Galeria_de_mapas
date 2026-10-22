# 🗺️ MapLibre (maplibreLayer)

> Da soporte 3D a `IDEE.layer.MapLibre`, que en el bundle de Cesium está declarada pero sin implementación.

Parche de arranque sin interfaz: sustituye `IDEE.layer.MapLibre` por una fachada propia que hereda de la **misma** clase base que la del bundle y le pasa una implementación que sí pinta. En 3D esa implementación monta un `maplibregl.Map` en un div absoluto sobre el canvas del globo y lo deja sincronizado con la cámara en `scene.preRender` (antes de que Cesium pinte el frame), y proyecta ese canvas sobre la superficie del terreno con un `PostProcessStage` (drape). En 2D la capa la implementa la propia API, pero el plugin **le añade la reproyección**: MapLibre solo pinta Web Mercator y, con el mapa en otro SRS, el canvas se repinta en un canvas propio reproyectado a la vista (ver «2D en otra proyección»).

## ✨ Características

- **Misma solución que OpenLayers, medida en `apiidee-1.1.0.ol.min.js`**: OL no mete las teselas en una capa de OL, monta un `maplibregl.Map` propio con `interactive: false`, `attributionControl: false` y `trackResize: false`, y en cada frame hace `jumpTo({center, zoom: zoomOL - 1, bearing: -rotation})` (el `-1` es porque MapLibre cuenta con teselas de 512 px y OL con 256). Aquí se hace lo mismo, pero el mapa de fuera es Cesium.
- **El porqué de la fachada**: el constructor de `IDEE.layer.MapLibre` pide su implementación al módulo de webpack `6149`, que en `apiidee.cesium.min.js` es `()=>{}`, un stub vacío (por eso el bundle avisa «La implementación usada no puede crear capas MapLibre»). Registrar la clase en `IDEE.impl.layer` o en `M.layer` no arregla nada, porque `__webpack_require__` no se expone en la ventana. Tampoco vale heredar de la fachada del bundle: su constructor siempre pide el módulo vacío.
- **El tipo `MapLibre` hay que enrutarlo**: `IDEE.impl.Map.addLayers` solo tiene rama para WMS, WMTS, KML, WFS, OGCAPIFeatures, MBTiles, XYZ, TMS, Tiles3D y Terrain; para el resto hace `know(tipo) || addUnknowLayers_(...)`, y `MapLibre` está en la lista de `know` **sin rama**, así que la capa se ignora en silencio (medido: no aparece en `getLayers()`, no se llama a su `addTo`). El parche mete esas capas por la vía de las no clasificadas (`addUnknowLayers_` + `facadeMap_.addUnknowLayers_`), las saca igual en `removeLayers` (`removeUnknowLayers_`, que sí llama a `destroy()`) y las incluye en `getUnknowLayers_` para que salgan en `getLayers()`.
- **`getUnknowLayers_` respeta el filtro para las MapLibre**: el impl de Cesium devuelve todas las capas de tipo desconocido aunque se le pase un filtro. Medido: `getLayers(baseTMS)` incluía la capa MapLibre, y el selector de capas base, al hacer `removeLayers(base)`, se la llevaba por delante al cambiar de base. Ahora las MapLibre se filtran por `name`, `type`, `legend` o `idLayer` (y por cadena), de modo que `getLayers(otraCapa)` devuelve solo lo que casa.
- **La librería se trae sola**: MapLibre GL JS **no** va en el bundle de Cesium (medido: de `maplibre` solo queda el nombre de la clase `maplibregl-canvas` en un helper de impresión), así que se carga de jsDelivr (`maplibre-gl@5.24.0`, js + css) la primera vez que se añade una capa, con una promesa compartida y reintento si el CDN falla.
- **Sincronización en `preRender`**: la vista se actualiza antes de que Cesium pinte, no en `postRender`; medido con un vuelo de cámara, la posición de la cámara ya es la definitiva en `preRender` y el overlay va un frame por delante.
- **Pintado síncrono del canvas**: actualizar el `jumpTo` no basta, porque MapLibre repinta en su propio `requestAnimationFrame`, que llega *después* del `preRender`; el canvas —y con él la textura del drape— iba un frame por detrás. Después de cada `jumpTo` y de cada `resize` se llama a `map.redraw()` (API pública): pinta en el acto y además **aborta** el repintado ya programado. Medido con la cámara desplazándose 4 px por frame: 4,5 px de retraso sin el pintado síncrono y **0,00 px** con él, sin pérdida de fps (21,3 frente a 20,7). Con `_render()` a secas MapLibre pintaba dos veces por frame (1,95 renders/frame) porque no cancela el frame pendiente; con `redraw()` el segundo repintado solo ocurre cuando hay teselas nuevas, que es lo correcto. Cuesta ~14 ms por pintado, ya contados en el frame.
- **Inclinaciones y FOV**: `maxPitch` de MapLibre a 85 (su máximo) y `pitch = 90 + pitchCesium`: un pitch de Cesium de -20° llega a 70° en MapLibre (antes se quedaba en 60°). El FOV vertical de MapLibre se iguala al `fovy` del frustum de Cesium (`setVerticalFieldOfView`), que es lo que evita que el overlay se separe al inclinar. Medido a 50° de inclinación: el error máximo pasa de 10 px a 4,8 px.
- **Sincronización medida**: 0-2 px con inclinaciones de hasta 60° (pitch de Cesium -30°) y 0-5 px a 40° de pitch de MapLibre (Cesium -50°), en puntos de hasta 7 km del centro. A 70° de pitch (Cesium -20°) el overlay plano no puede seguir la curvatura del globo: error máximo ~18 px en los bordes. Se mide comparando `map.project()` con el punto de terreno bajo cada píxel (`scene.globe.pick`); si se compara a altura 0 aparece un 3,4 % de error de escala que es pura paralaje (el terreno de Madrid está a ~650 m).
- **Drape sobre el MDT** (`drape`, por defecto activo): el canvas de MapLibre no se pinta en un plano de pantalla, se proyecta sobre el terreno real. Un `PostProcessStage` reconstruye por píxel el punto del globo desde la profundidad de Cesium (`czm_unpackDepth` + `czm_windowToEyeCoordinates` + los ejes de la cámara y el vector cámara−origen por uniforms, en doble: **no** `czm_inverseView`, que traslada en float32 y se lleva ~0,5 m) y lo lleva al canvas con `map.transform.mercatorMatrix`, que es la matriz con la que MapLibre pinta (medido: `map.project()` y la matriz dan el mismo píxel con 52° de pitch). Detalles que costaron medirlos:
  - Se entra con **uniform propio `u_globeDepth`** y una textura nula 1×1 de respaldo, no con `czm_globeDepthTexture`: si el sampler se queda sin enlazar en el primer frame el render revienta (`TypeError ... reading '_target'`).
  - **Del ECEF a mercator, dos caminos según el zoom** (`ZOOM_DRAPE_EXACTO = 11`):
    - **Zoom alto (lo normal), sin trigonometría**: Web Mercator es conforme, así que alrededor del centro de la vista se pasa a mercator midiendo el desplazamiento en este y norte (producto escalar con los ejes de la base geodésica del centro) y escalándolo con `1/(2πN cos φ)` y `−1/(2πM cos φ)`. Lo calcula `referenciaDrape_` en JavaScript en doble precisión y entra por uniforms. Con la fórmula exacta en el shader (`atan`/`tan`/`log` + Bowring) los drivers se desvían ~1e-6 en mercator —unos 40 m— y el drape se iba de sitio: en una vista cenital el píxel central caía 39 m al este y 63 m al norte de su vertical. Con la linealización el error a 10 km del centro es de ~6 m.
    - **Zoom bajo (globo entero), fórmula exacta**: la linealización es de primer orden y su error crece con el cuadrado de la distancia. Medido con una rejilla de pantalla contra `map.project`: 0 px a 900 m y 5 km, 7 px a 300 km, 43 px a 1.500 km, 235 px a 5.000 km y 853 px a 20.000 km, con la UV saliéndose del canvas —ese era el recorte al mirar el globo—. Ahí se calcula la mercator **absoluta** con `atan`/`log` (`u_global`), donde la cuantización de float32 ya no importa porque las entradas de la matriz también son pequeñas (a zoom 11 el ULP vale 0,03 px frente a los 4 px de zoom 18), y la X se lleva a la copia del mundo más cercana al centro (`floor(u_mercCentroX − mercX + 0,5)`) para que el antimeridiano no se vaya a la copia de al lado. Medido con la misma rejilla: **0 px** a 20.000, 5.000 y 1.500 km.
    - El corte está en el zoom 11 (unos 40 km de altura), donde los dos caminos se equivocan ≤0,7 px; medido en el entorno del cruce: 60 km → 0 px, 40 km → 0,1 px, 30 km → 0,7 px, 15 km → 0,4 px. El salto al conmutar es invisible.
  - **La mercator que entra en la matriz es la relativa al centro**: la absoluta (~0,4) tiene un ULP de 3e-8 en float32 y, multiplicada por los 2,3e8 de `mercatorMatrix`, ese último bit vale ~4 px. Medido: con la mercator absoluta la capa se veía **pixelada, a bloques de 4×4 px** (la UV avanzaba 0,0,0,4 en horizontal); con la relativa —el clip del centro (`u_clipCentro`) lo calcula `referenciaDrape_` en doble— la UV avanza exactamente un texel por píxel, el centro cae en (0,500, 0,500) y la nitidez medida (laplaciano) iguala a la del overlay plano (9,41 frente a 9,53 en el centro y 8,77 frente a 8,9 en una zona de etiquetas; antes 7,31 y 2,92).
  - **No se invierte la Y**: Cesium sube el canvas tal cual (texel `v=0` = fila inferior). Con una etapa de identidad, `texture(u_overlay, v_textureCoordinates)` da diferencia media 0,67 y 0 % de píxeles distintos contra el overlay plano; invirtiendo la Y se iba a 61,13 y 52 %.
  - **Cobertura del canvas** (`zoomConCobertura_`): el zoom sale de la escala en el centro, pero el canvas solo contiene `alto / (512 · 2^zoom)` de mercator en vertical. Al ver el globo entero la pantalla abarca más y las latitudes altas no tenían textura: medido a 20.000 km, el drape llegaba hasta lat 73° y el casquete polar se veía sin capa (una banda recta de ~30 px), y con más zoom se salían 6/68 puntos de la rejilla a 20.000 km y 22/209 a 5.000 km. Se baja el zoom de MapLibre lo justo para que el canvas cubra el mercator visible (las **esquinas** piden más latitud que los bordes) y nunca más de `MAX_NIVELES_COBERTURA`; la correspondencia no cambia, porque la UV sale de la matriz con la que MapLibre ha pintado, solo se pierde resolución. Resultado: 1,73 → 0,35 a 20.000 km, 2,35 → 0,73 a 10.000 km, 3,72 → 3,16 a 5.000 km y nada por debajo de 2.000 km; **0 puntos fuera de rango en todas las alturas** y error ≤0,1 px. Verificado también en el antimeridiano (lon 179, −179, 0 y 100 → 0 fuera).
  - `preserveDrawingBuffer: true` en `canvasContextAttributes` (MapLibre 5) para poder copiar el canvas a la textura; solo cuando el drape está activo.
  - El canvas se copia solo cuando MapLibre ha vuelto a pintar (`render`), no en cada frame de Cesium.
- **El overlay plano sigue ahí como respaldo**: el div se oculta (`visibility: hidden`, nunca `display: none`) solo en el primer frame con profundidad de globo real (`drapeListo_`), de modo que en los primeros frames se ve el overlay de siempre y no un hueco. Se vuelve al plano si falta `PostProcessStage`, `Context.depthTexture` o `Matrix4`, y también en caliente con `drapeUtilizable_()`: si el zoom que pide la cámara pasa del `maxZoom` de MapLibre (vistas a pie de calle) o la inclinación de MapLibre pasa de 76° (casi horizonte, donde la proyección 2D no puede seguir al globo), el stage se apaga y reaparece el div.
- **Precisión del drape**: a 52° de inclinación y 1,4 km de altura el contenido sigue el relieve y llena la pantalla sin costuras; a vista vertical el desplazamiento residual contra el overlay plano es de ~1 px (se busca el que minimiza la diferencia: sale (1,1) px, unos 20 cm a 900 m, la fase subpíxel del remuestreo bilineal). Además, ~1 % de error de distancia en el centro de la pantalla (dentro de ±12 m a 1,2 km) y 3-4 % fuera del centro con 38° de inclinación y 1,4 km de altura (unos 40 px en el borde), que es el límite de la precisión de la profundidad del globo. Se mide pintando marcadores en MapLibre en lon/lat conocidas y comparando dónde los deja el drape con `SceneTransforms.worldToWindowCoordinates` sobre la altura real del terreno.
- **Coste del drape**: ~1 fps de 27 a 651 m con el horizonte a la vista (27,2 fps con drape, 28,2 con el stage apagado, 26,3 otra vez con drape), más la copia del canvas cuando MapLibre repinta.
- **Sin coste cuando no hace falta**: una sola intersección con el terreno por frame (el centro); la escala sale del `fovy` y el rumbo de `camera.up`, sin rayos laterales. El resto de frames se sale con una comparación de posición/rumbo/inclinación/alabeo. Medido en un vuelo: ~2,4 ms de media por frame (máx. 8,5 ms) incluyendo el `jumpTo`.
- **No se congela mirando al horizonte**: si el rayo central no toca el globo se conserva el último centro válido y se siguen actualizando rumbo e inclinación; las intersecciones de la cara opuesta del elipsoide se descartan (`puntoVisible_`). Al saltar de vista el terreno puede tardar en cargar y `globe.pick` devolver todavía el elipsoide (un punto válido pero mucho más lejos, con lo que el zoom se quedaba clavado en el valor anterior): mientras eso pase, `sincronizar_` reintenta hasta 90 frames (`REINTENTOS_SUELO`), sin esperar a que la cámara se mueva. Medido: salto a 1,4 km/-38°, zoom 16,082 calculado 16,099 tras converger.
- **`disableBackgroundColor` como en 2D**: pone la capa `background` del estilo en `transparent` (true) o `#f2f2f2` (false). Si el estilo no tiene capa de fondo no se hace nada; medido: el estilo de BTN Completa no la tiene (0 de 337), y en 2D eso le revienta a la implementación de OpenLayers, que hace `.find(...).id` sin comprobar el resultado.
- **Reproyección en 2D** (`pintarReproyectado`, solo si el SRS de la vista no es Web Mercator): MapLibre GL JS solo pinta mercator y la capa de la librería (`@geoblocks/ol-maplibre-layer`) entrega su canvas como elemento de capa, así que OL lo compone tal cual. Medido en Madrid con `setProjection('EPSG:25830')`: el canvas se quedaba a zoom 3,13 con el centro en −9,98 / 59,50, en mitad del Atlántico. Ahora, en cada frame: (1) MapLibre se lleva a la vista mercator que **cubre** lo que se ve (centro y zoom del rectángulo mercator de las cuatro esquinas de la pantalla, sin rumbo ni inclinación) y se pinta en el acto con `redraw()`; (2) ese canvas se repinta en un canvas propio troceado en 6×6, cada trozo con la transformación afín que lleva su esquina de pantalla al píxel correspondiente de MapLibre; (3) el canvas propio es el que se devuelve a OL, que lo compone como cualquier otro elemento de capa. El contenedor de MapLibre se cuelga oculto del nuestro (`visibility: hidden`) para que MapLibre siga midiendo su canvas y para que no se vea mercator sin reproyectar por los huecos.
  - **Error de la rejilla** medido contra `toLonLat` + `map.project` en 324 puntos interiores (9 por trozo): 0,053 px de media y 0,103 px el peor a zoom 11,4; 0,459 / 0,928 con 500 m/px (zoom 8,3); 0,033 / 0,064 con la vista girada 0,35 rad. Mercator, UTM y las geográficas son proyecciones suaves y dentro de un trozo la transformación es casi afín; por eso 6×6 basta.
  - **Alineación contra el mismo mapa en mercator**: capturas a la misma resolución de suelo y el mismo centro (Madrid, zoom 11) y correlación de la diferencia: desplazamiento óptimo **(0, 0) px** en el centro y ±1 px en las mitades superior e inferior; diferencia media 22/255, casi toda de la colocación de etiquetas (el zoom de MapLibre difiere en la milésima).
  - **Coste por frame** (`renderSync`, medido): 1,26 ms con la vista quieta en UTM (solo el `drawImage` de los 36 trozos; las afines se guardan por vista), 2,39 ms con la vista girada y 8,46 ms en mercator, donde la librería repinta MapLibre en cada frame. Al mover la vista se suma ese repintado, el mismo que ya hace la librería en mercator.
  - **Geográficas y rotación**: probado con el mapa en grados (0,000686°/px, el mismo suelo que 76,437 m/px en mercator) y con `view.setRotation(0,35)`: centro y escala de MapLibre correctos y el contenido girado con el mapa, sin tocar el `bearing` de MapLibre (la rotación la mete la rejilla).

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

La instalación es idempotente: se intenta al cargar el script, cada 10 ms mientras la build de Cesium no exista y al terminar de ejecutarse el `<script>` de la build (el cambio 2D/3D la reemplaza y `window.IDEE` es un objeto nuevo). En 3D hace falta que exista `IDEE.impl.cesium`.

En 2D el script tiene que estar cargado **antes** de que se cree la capa, porque lo que se engancha es `IDEE.impl.layer.MapLibre.prototype.addTo` (para envolver el renderer y devolver el canvas reproyectado). En el visualizador de MapLibre se carga con el resto de `ext/`:

```html
<script src="../../../../ext/maplibreLayer/maplibreLayer.js"></script>
```

Si el script llegara más tarde, el intervalo de arranque también prepara las capas `MapLibre` que ya estén en `window.mapajs` (la página puede haberse montado antes). Tras un ciclo 2D→3D→2D el prototipo de la build nueva se vuelve a parchear solo: medido, `__maplibreReproyeccion2D` queda en el prototipo nuevo y el renderer de la capa, envuelto.

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

- **En el globo entero el drape baja de resolución**: para cubrir el casquete polar el canvas tiene que contener el mundo entero, así que `zoomConCobertura_` baja el zoom de MapLibre (1,4 niveles a 20.000 km). El contenido sigue en su sitio —la UV sale de la matriz con la que se pintó—, pero se muestrea a menos texeles por píxel; en esas vistas el estilo son países y no texto, y no se nota. Es el precio de que una ventana 2D cubra una esfera: los polos están en el infinito de Mercator.
- **Casi al horizonte se vuelve al overlay plano**: el drape solo vale mientras la proyección 2D de MapLibre pueda representar la vista. Con más de 76° de inclinación de MapLibre (Cesium por encima de -14°) o cuando el zoom necesario pasa del `maxZoom` de MapLibre, el contenido se estira y el stage se apaga solo (`drapeUtilizable_`). Es el límite de apoyarse en una proyección 2D: un drape exacto a ras de suelo exigiría reproducir la perspectiva del globo en el shader. Con el overlay plano, en esas vistas la sincronización tampoco cuadra con la curvatura a partir de ~60° de pitch (a 70°, ~18 px medidos).
- **No atiende clics** (`interactive: false`, igual que en OL) y el div lleva `pointer-events: none`: Cesium sigue recibiendo clic, rueda y arrastre. El overlay va dentro del contenedor del widget de Cesium, así que un clic sobre el mapa llega al globo aunque esté pintado encima.
- **Una capa = un `maplibregl.Map`**, con su propia descarga y decodificación de teselas. Dos capas MapLibre son dos mapas de MapLibre; en 2D pasa lo mismo.
- **El overlay tapa visualmente lo que Cesium dibuje encima del terreno** (entidades, rásters) allí donde el estilo pinte. Al ser transparente por defecto solo se nota con estilos con fondo opaco.
- **El orden lo da el DOM**: la capa añadida después queda encima. `setZIndex` se guarda pero no se usa, porque el overlay no vive en `imageryLayers`.
- **En 2D la capa se pinta con un canvas de más**: la reproyección necesita su propio canvas (1280×649 en las pruebas, ~3,3 MB) y se repinta en cada frame, porque las teselas que va cargando MapLibre tienen que entrar por ahí. Con la vista quieta no se vuelve a pedir nada a MapLibre: solo se repintan los trozos con las afines ya calculadas.
- **Fuera de mercator se pierde algo de resolución, no posición**: el encuadre de MapLibre es el rectángulo mercator que cubre la pantalla y manda el lado que más aprieta. En Madrid con 25830 el zoom de MapLibre queda en 9,97 frente al 11,39 de OL —son pirámides distintas: 512 px frente a 256 y metros de mercator frente a metros de UTM—, y aun así las capturas contra el mismo mapa en mercator dan (0, 0) px de desplazamiento en el centro y ±1 px en los bordes.
- **Si el rectángulo mercator se sale del mundo** (vista que pasa de ±85° de latitud o del `minZoom` de MapLibre) el encuadre se recorta: los trozos que no se pueden mapear se quedan sin pintar (transparentes) en vez de romper el frame, y el resto de la capa se sigue viendo.
- **`setProjection` de la API no conserva el centro**: medido, `mapajs.setProjection('EPSG:25830')` deja la vista en `105571, 6616798` con zoom 4,13. No es de esta capa, le pasa a todo el mapa; `ext/mapInfo` lo compensa en `_cambiarProyeccion` y quien llame al método a pelo tiene que reponer centro y resolución igual que allí. La reproyección de la capa no depende de eso: sigue al SRS de la vista.
- **La extracción de atributos no cambia**: la capa de la librería convierte el clic a lon/lat con `toLonLat` y pregunta a MapLibre por `map.project(...)`, que es independiente del encuadre; como el encuadre siempre cubre la pantalla, el punto cae dentro del canvas.
