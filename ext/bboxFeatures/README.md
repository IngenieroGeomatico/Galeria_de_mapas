# 🧩 ext/bboxFeatures (objetos geográficos por BBOX y por páginas en WFS y OGC API Features)

> Extensión sin interfaz propia que enseña a las capas **WFS** y **OGC API Features** a pedir al servicio solo los objetos geográficos de la vista, **una página de objetos cada vez** (límite + desplazamiento resueltos en el servidor) y a renovarlos al mover el mapa, en 2D y en 3D.

La API-IDEE 1.1.0 descarga los objetos de una capa vectorial **una sola vez, sin extensión y sin paginar**: el loader de features llama siempre a `service_.getFeatureUrl(null, proyección)`, es decir, con el extent a `null`. En una capa nacional eso son todos los registros del servicio (o el `limit` que tenga), se mire donde se mire el mapa. Este plugin escribe el BBOX de la vista, el límite y la página en el impl de la capa y la recarga **sin tocar el bundle de la API**. Los controles («todas» / «la vista», límite y paginado) los pinta el selector de capas (`ext/selectorCapas/ext_layerSwitcher.js`) **dentro de la ventana de información**, sobre la tabla de atributos, y delega aquí a través de `window.miBBoxFeatures`.

---

## ✨ Características

- **Dos modos por capa**: `todas` (una sola petición, sin filtro por extensión) y `vista` (petición con el BBOX de lo que se está mirando).
- **Límite de objetos por página** (`limit`, **100 por defecto**), aplicado **en los dos modos**: sin él, una capa nacional se trae todos los registros del servicio de golpe.
- **Paginado en el servidor**: `count` + `startIndex` en WFS, `limit` + `offset` en OGC API Features, así que **el mapa y la tabla muestran siempre la misma página**.
- **Renovación al mover el mapa**: escucha `moveend` del impl de OpenLayers en 2D y `camera.moveEnd` de Cesium en 3D, con 350 ms de agrupación y sin repetir la petición si la petición (extensión + límite + página) no ha cambiado. Al mover, en modo `vista` se **vuelve a la primera página**.
- **Sin UI propia**: el plugin solo publica `window.miBBoxFeatures`; la barra «Objetos geográficos» (Todas / La vista, Límite y paginado) vive en la ventana de información del selector, junto a la tabla de atributos.
- **Reproyección automática**: el BBOX se calcula en la proyección viva del mapa (EPSG:3857 en 2D, grados en 3D) y se convierte a la que espera cada servicio con `IDEE.utils.reproject`.
- **Conserva el valor previo del BBOX**: si la capa ya traía un `bbox` (vendor de WFS o propiedad del impl de OGC API), se guarda y se restituye al volver a `todas`.
- **Sin petición de más al arrancar**: si la capa se creó ya con el mismo límite (los visores pasan `count: 100` / `limit: 100`), el plugin detecta que la petición es la misma y no la repite.
- **Funciona dentro de grupos** de capas anidados (`_capas` recorre el árbol).
- **Contrato de estado 2D/3D** (`getState`/`setState`): modo, límite y página de cada capa se guardan por `legend`/`name`, porque los `idLayer` se regeneran en cada reinicio del mapa.
- **Espera a la primera carga** antes de aplicar, para que la respuesta inicial (sin BBOX) no pise la petición filtrada cuando termina más tarde.

---

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `bboxFeatures.js` | Clase `miPlugin_bboxFeatures`: escucha del movimiento, cálculo del BBOX, escritura en el impl (`options.vendor.getFeature.bbox`/`count`/`startIndex` en WFS, `impl.bbox`/`limit`/`offset` en OGC API), `refresh(true)`, estado 2D/3D y exposición triple del global. |

---

## 🔧 Integración en un visualizador

La capa WFS u OGC API Features se crea como siempre; el plugin se añade **después del mapa y antes del selector de capas**:

```html
<script src="../../ext/bboxFeatures/bboxFeatures.js" type="text/javascript"></script>
<script src="../../ext/selectorCapas/ext_layerSwitcher.js" type="text/javascript"></script>
```

```js
mapajs = M.map({
  container: 'map',
  center: { x: -130000, y: 5290000 },
  zoom: 8,
  layers: [
    new M.layer.WFS({
      url: 'https://idena.navarra.es/ogc/wfs',
      name: 'IDENA:PATRIM_Sym_BICArqueo',
      legend: 'Yacimientos arqueologicos',
      namespace: 'IDENA',
      epsg: 'EPSG:3857',
      geometry: 'POINT',
    }, {
      // El impl del WFS crea su servicio con `options.vendor`, NO con el
      // tercer argumento del constructor: aquí va el límite de la primera
      // petición (si no, el plugin la repite al terminar la primera carga).
      vendor: { getFeature: { count: 100 } },
    }),
  ],
});

// Sin UI propia: habilita la barra "Objetos geográficos" de la ventana de
// información del selector (tabla de atributos).
mapajs.addPlugin(new IDEE.plugin.miPlugin_bboxFeatures({}));
mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());
```

Con OGC API Features el límite va en las propias opciones de la capa y el servicio lo usa en la primera petición:

```js
new M.layer.OGCAPIFeatures({
  url: 'https://api-features.idee.es/collections/',
  name: 'falls',
  limit: 100,
  legend: 'Cascadas',
});
```

En el visor de tipos de capa se activa con una opción de `anadirPluginsTipos` (`mapas/tiposDeCapas/js/comun.js`), que ya lo registra antes del selector:

```js
anadirPluginsTipos(mapajs, mapa, { bboxFeatures: true });
```

Los dos visores que lo usan son `mapas/tiposDeCapas/capas/wfs/` (WFS de IDENA, 1187 objetos) y `mapas/tiposDeCapas/capas/ogcapi/` (colección `falls` de `api-features.idee.es`, 251 objetos).

---

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_bboxFeatures(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `retardo` | `number` | `350` | Milisegundos de espera tras el último movimiento del mapa antes de pedir los objetos. Sirve para agrupar la ráfaga de eventos de una rueda o de un `flyTo` sin que se note el retraso en la capa. |

Constantes internas: `LIMITE_POR_DEFECTO = 100` y `LIMITES = [25, 50, 100, 200, 500]` (los tamaños de página que ofrece el desplegable de la ventana de información).

---

## 🔌 API pública

`window.miBBoxFeatures` (la escribe `addTo`; `destroy` la retira si sigue siendo la de esa instancia):

| Método | Descripción |
|---|---|
| `soporta(capa)` | `true` si la capa es WFS u OGC API Features y la extensión sabe pedirla. Es la guarda que usa el selector para pintar la barra. |
| `getModo(capa)` | `'vista'` o `'todas'` (por defecto). |
| `setModo(capa, modo)` | Cambia el modo, vuelve a la página 1 y recarga la capa con o sin BBOX. Si la capa aún está en su primera descarga, la aplicación se programa para cuando termine. |
| `getLimite(capa)` | Objetos por página (100 si no se ha tocado). |
| `setLimite(capa, n)` | Cambia el límite y vuelve a la página 1. |
| `setPagina(capa, pagina)` | Salta a una página (1..n): pide al servicio el desplazamiento `(pagina - 1) * limite`. |
| `getEstado(capa)` | `{ modo, limite, offset, pagina, hayAnterior, haySiguiente, objetos }`, lo que necesita la barra para pintarse. |
| `limites()` | Tamaños de página que ofrece la ventana de información. |
| `aplicarTodo(forzar)` | Vuelve a aplicar el modo de todas las capas filtrables del mapa. Con `forzar` recarga aunque la petición no haya cambiado. |
| `tipos()` | Tipos de capa que atiende: `['WFS', 'OGCAPIFeatures']`. |
| `plugin` | La instancia que atiende ahora mismo (para depurar desde la consola). |

El plugin se expone también como `IDEE.plugin.miPlugin_bboxFeatures` y `M.plugin.miPlugin_bboxFeatures` (con reintento, porque al cambiar 2D/3D la API recarga su bundle y reinicializa ambos globales).

---

## 🧪 Cómo se inyecta la petición (medido sobre la API 1.1.0)

La API no deja parametrizar ni el BBOX ni la página en el constructor de la capa, pero los valores se pueden escribir en el impl y refrescar. El resto de la recarga (borrar objetos, rehacer el formateador, crear la fuente nueva) lo hace la propia API con `refresh(true)`; aquí no se reimplementa nada.

| Tipo de capa | Dónde se escribe | Recarga | URL resultante |
|---|---|---|---|
| WFS | `impl.options.vendor.getFeature.bbox = 'minx,miny,maxx,maxy,EPSG:3857'`<br>`impl.options.vendor.getFeature.count = 100`<br>`impl.options.vendor.getFeature.startIndex = 200` | `impl.refresh(true)` | `...&srsname=EPSG:3857&count=100&bbox=-204583.9,5270000,...,EPSG:3857&startIndex=200` (2D) / `...&srsname=EPSG:4326&count=100&bbox=...,EPSG:3857&startIndex=200` (3D) |
| OGC API Features | `impl.bbox = 'lonMin,latMin,lonMax,latMax'`<br>`impl.limit = 100`<br>`impl.offset = 200` | `impl.refresh(true)` | `.../collections/falls/items?f=json&limit=100&offset=200&bbox=-1.07,42.4,0.27,42.9&` |

Detalles que costaron medirlos:

- **El vendor de WFS se mezcla al final de la URL** de `GetFeature`, y el servicio se reconstruye en cada refresco leyendo `this.options.vendor`, así que vale igual en 2D (servicio de OpenLayers) y en 3D (servicio de Cesium). **El tercer argumento del constructor (`vendorOptions`) NO llega al servicio WFS**: el impl usa `options.vendor`, y por eso el visor pone ahí el `count` inicial.
- **La versión del WFS decide el nombre del parámetro**: WFS 2.0 usa `count` y WFS 1.1 `maxFeatures` (los dos con `startIndex`). Se lee de `capa.version` con `_versionWfs()`; si no se puede averiguar se asume 2.0.
- **WFS siempre en EPSG:3857**, nunca en 4326: en WFS 2.0 el orden de ejes de 4326 es lat,lon y hay servidores que lo aplican (el WFS de IDENA devuelve **0 objetos** con `bbox=lat,lon,EPSG:4326` y los **862** esperados con `lon,lat`; con 3857 no hay ambigüedad). El `srsname` de la respuesta lo sigue poniendo la API.
- **OGC API Features siempre en longitud,latitud** (CRS84), que es lo que exige la especificación; el servicio de la API no admite `bbox-crs`.
- **No basta con poner el valor a `null`** para volver a «todas»: se envía `bbox=null` literal y el servicio devuelve 0 objetos. Hay que **borrar** la propiedad (`delete`) o restituir el valor original guardado en `impl._bboxFeaturesOriginal`.
- **`startIndex` solo se escribe cuando hay página que saltar** (offset > 0), para no ensuciar la URL de la primera.

---

## 🗺️ Vista sin filtro

`_bbox(tipo)` devuelve `null` (y por tanto se piden los objetos sin filtro por extensión, pero **con el límite de página**) cuando no hay una extensión expresable en un solo BBOX:

- el mapa está en la vista del mundo entero;
- la vista cruza el **antimeridiano** (no se puede escribir en un `minx,miny,maxx,maxy`);
- la proyección del mapa no se puede reproyectar con `IDEE.utils.reproject`;
- la extensión es degenerada (`max <= min`).

En 3D el encuadre es una cámara en perspectiva: el BBOX que devuelve `map.getBbox()` es el del frustum proyectado sobre el suelo, así que en vistas muy inclinadas incluye bastante terreno que no se ve.

---

## 📄 Paginado

- **El total de páginas no se puede mostrar**: los servicios sí devuelven `numberMatched`/`totalFeatures`, pero la API los tira al leer la respuesta (verificado en los dos bundles). La barra muestra «Página N» y usa la **regla de la página llena**: si la página trae menos objetos que el límite, no hay siguiente.
- **Al mover el mapa** en modo `vista` se vuelve a la página 1: la extensión es otra y la página N puede no existir.
- **Al cambiar de modo o de límite** también se vuelve a la página 1.
- **Tras un cambio 2D/3D** se conservan el modo y el límite; la página vuelve a 1 porque el encuadre se restaura y el movimiento del mapa la reinicia.

---

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ vista: string[], limite: {ident: n}, offset: {ident: n} }`, con los identificadores estables (`legend`, o `name` si la leyenda es el `idLayer`) de cada capa. `limite` y `offset` solo incluyen las capas que no están en el valor por defecto. |
| `setState(state, map)` | Rehidrata `_vista`, `_limite` y `_offset` en la instancia nueva, reinstala la escucha del mapa nuevo y programa la aplicación a las capas recién creadas. Resuelve por `legend`/`name`, así que no necesita los `idLayer` viejos. |

El estado vive en `window.EstadoPlugins` (`ext/cambioImpl/cambioImpl.js`), que se captura **antes** de destruir el mapa y se restaura **después** de recrearlo, de forma diferida (evento `COMPLETED` + 1200 ms).

La ventana de información **se cierra** al cambiar de implementación (`setState` y `destroy` del selector llaman a `window.closeSheet()`): la hoja vive en `document.body`, no dentro del div del mapa, así que sobrevivía al reinicio con la tabla y los `idLayer` viejos.

---

## ⚠️ Limitaciones y comportamiento esperado

- **La primera carga del visor ya va acotada** si el visualizador pasa `count`/`limit` en la capa (los dos visores de `tiposDeCapas` lo hacen). Si no lo hace, el plugin recarga con el límite en cuanto la capa pinta su primera respuesta.
- **Espera a la primera carga** (40 × 500 ms = 20 s) antes de aplicar BBOX/límite: si refrescara mientras la petición inicial sigue viva, la respuesta vieja llegaría después y dejaría la capa con todos los objetos. En **3D** la espera puede ser de varios segundos: Cesium añade los objetos por lotes y esperando a que el globo tenga las teselas, y `impl.isLoaded()` no sirve de señal porque el impl de Cesium lo pone a `true` antes de añadirlas.
- **Si la capa no carga nunca** (servicio caído, colección vacía) se aplica igualmente al agotar el plazo, para que el modo no se quede sin efecto.
- **Refrescos solapados**: si el usuario mueve el mapa mientras una petición filtrada está en vuelo, la respuesta anterior puede llegar después y pintar objetos de la vista previa hasta el siguiente movimiento. Es el mismo comportamiento que tiene la API con sus propios refrescos.
- **Una capa nueva** añadida después del plugin no queda en modo «vista»; hay que llamar a `window.miBBoxFeatures.setModo(capa, 'vista')`. El límite sí se le aplica en cuanto carga.
- **Doble petición en 3D**: un `flyTo` puede emitir dos `camera.moveEnd` separados más de 350 ms, y entonces se hacen dos peticiones con encuadres ligeramente distintos. Es inocuo, pero se ve en la pestaña de red.
- **La tabla se rehace con el evento `load`** de la capa (impl y fachada, con 150 ms de rebote). Si el servicio no dispara `load` (capa vacía), la tabla se queda como estaba hasta la siguiente recarga.
- **No toca** `ext/layergroup_cesium/` ni el bundle de la API.

---

## ✅ Comprobado a mano

Con `mapas/tiposDeCapas/capas/wfs/` (IDENA, 1187 objetos) y `mapas/tiposDeCapas/capas/ogcapi/` (colección `falls`, 251 objetos), midiendo en el navegador:

| Caso | Resultado |
|---|---|
| Arranque WFS 2D | Primera y única petición con `count=100` (antes: 1187 objetos y una segunda petición). |
| Arranque OGC API 2D | Primera y única petición con `limit=100`. |
| Página siguiente (WFS 2D) | `count=100&startIndex=100`, 100 objetos distintos y la tabla rehecha. |
| Límite 25 desde la ventana de información | `count=25`, página 1 y 25 filas. |
| «La vista» + página 2 + mover el mapa | Petición con `bbox` y `startIndex`; al mover, `startIndex` desaparece y la tabla vuelve a la página 1. |
| WFS 3D | `count=100` en el arranque (el servicio lee `options.vendor` también en Cesium) y `startIndex` + `bbox=...,EPSG:3857` al paginar. |
| OGC API 3D | `limit`/`offset` + `bbox` de la cámara; tabla y paginado correctos. |
| Cambio 2D/3D con la ventana de información abierta | La ventana se cierra, el modo y el límite se conservan y la página vuelve a 1. |
| Tabla de OGC API Features | Ahora existe: `getLayerKind` reconoce `ogcapifeatures` (antes se trataba como ráster). |

> Para medir peticiones en 3D hay que subir el búfer de Resource Timing (`performance.setResourceTimingBufferSize(20000)`): Cesium llena las 250 entradas por defecto con teselas y las peticiones de features no llegan a registrarse.
