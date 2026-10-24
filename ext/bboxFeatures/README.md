# 🧩 ext/bboxFeatures (entidades por BBOX en WFS y OGC API Features)

> Extensión sin interfaz propia que enseña a las capas **WFS** y **OGC API Features** a pedir al servicio solo las entidades de la vista y a renovarlas al mover el mapa, en 2D y en 3D.

La API-IDEE 1.1.0 descarga las entidades de una capa vectorial **una sola vez y sin extensión**: el loader de features llama siempre a `service_.getFeatureUrl(null, proyección)`, es decir, con el extent a `null`. En una capa nacional eso son todos los registros del servicio (o el `limit` que tenga), se mire donde se mire el mapa. Este plugin escribe el BBOX de la vista en el impl de la capa y la recarga cada vez que el mapa se mueve, **sin tocar el bundle de la API**. El control para elegir entre «todas» y «solo la vista» lo pinta el selector de capas (`ext/selectorCapas/ext_layerSwitcher.js`), que delega aquí a través de `window.miBBoxFeatures`.

---

## ✨ Características

- **Dos modos por capa**: `todas` (comportamiento de la API, una sola petición sin filtro) y `vista` (petición con el BBOX de lo que se está mirando).
- **Renovación al mover el mapa**: escucha `moveend` del impl de OpenLayers en 2D y `camera.moveEnd` de Cesium en 3D, con 350 ms de agrupación y sin repetir la petición si el BBOX no ha cambiado.
- **Sin UI propia**: el plugin solo publica `window.miBBoxFeatures`; los botones «Todas / La vista» van en el desplegable de opciones de cada capa WFS u OGC API Features del selector.
- **Reproyección automática**: el BBOX se calcula en la proyección viva del mapa (EPSG:3857 en 2D, grados en 3D) y se convierte a la que espera cada servicio con `IDEE.utils.reproject`.
- **Conserva el valor previo**: si la capa ya traía un `bbox` (vendor de WFS o propiedad del impl de OGC API), se guarda y se restituye al volver a `todas`.
- **Funciona dentro de grupos** de capas anidados (`_capas` recorre el árbol).
- **Contrato de estado 2D/3D** (`getState`/`setState`): el modo de cada capa se guarda por `legend`/`name`, porque los `idLayer` se regeneran en cada reinicio del mapa.
- **Espera a la primera carga** antes de filtrar, para que la respuesta inicial (sin BBOX) no pise la petición filtrada cuando termina más tarde.

---

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `bboxFeatures.js` | Clase `miPlugin_bboxFeatures`: escucha del movimiento, cálculo del BBOX, escritura en el impl (`options.vendor.getFeature.bbox` en WFS, `impl.bbox` en OGC API), `refresh(true)`, estado 2D/3D y exposición triple del global. |

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
    }),
  ],
});

// Sin UI propia: habilita el control "Entidades: Todas / La vista" del selector.
mapajs.addPlugin(new IDEE.plugin.miPlugin_bboxFeatures({}));
mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());
```

En el visor de tipos de capa se activa con una opción de `anadirPluginsTipos` (`mapas/tiposDeCapas/js/comun.js`), que ya lo registra antes del selector:

```js
anadirPluginsTipos(mapajs, mapa, { bboxFeatures: true });
```

Los dos visores que lo usan son `mapas/tiposDeCapas/capas/wfs/` (WFS de IDENA) y `mapas/tiposDeCapas/capas/ogcapi/` (colección `falls` de `api-features.idee.es`).

---

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_bboxFeatures(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `retardo` | `number` | `350` | Milisegundos de espera tras el último movimiento del mapa antes de pedir las entidades. Sirve para agrupar la ráfaga de eventos de una rueda o de un `flyTo` sin que se note el retraso en la capa. |

---

## 🔌 API pública

`window.miBBoxFeatures` (la escribe `addTo`; `destroy` la retira si sigue siendo la de esa instancia):

| Método | Descripción |
|---|---|
| `soporta(capa)` | `true` si la capa es WFS u OGC API Features y la extensión sabe filtrarla. Es la guarda que usa el selector para pintar la fila del control. |
| `getModo(capa)` | `'vista'` o `'todas'` (por defecto). |
| `setModo(capa, modo)` | Cambia el modo y recarga la capa con o sin BBOX. Si la capa aún está en su primera descarga, la aplicación se programa para cuando termine. |
| `aplicarTodo(forzar)` | Vuelve a aplicar el modo de todas las capas filtrables del mapa. Con `forzar` recarga aunque el BBOX no haya cambiado. |
| `tipos()` | Tipos de capa que atiende: `['WFS', 'OGCAPIFeatures']`. |
| `plugin` | La instancia que atiende ahora mismo (para depurar desde la consola). |

El plugin se expone también como `IDEE.plugin.miPlugin_bboxFeatures` y `M.plugin.miPlugin_bboxFeatures` (con reintento, porque al cambiar 2D/3D la API recarga su bundle y reinicializa ambos globales).

---

## 🧪 Cómo se inyecta el BBOX (medido sobre la API 1.1.0)

La API no deja parametrizar el BBOX en el constructor de la capa, pero el valor se puede escribir en el impl y refrescar. El resto de la recarga (borrar entidades, rehacer el formateador, crear la fuente nueva) lo hace la propia API con `refresh(true)`; aquí no se reimplementa nada.

| Tipo de capa | Dónde se escribe | Recarga | URL resultante |
|---|---|---|---|
| WFS | `impl.options.vendor.getFeature.bbox = 'minx,miny,maxx,maxy,EPSG:3857'` | `impl.refresh(true)` | `...&srsname=EPSG:3857&bbox=-204583.9,5270000,...,EPSG:3857` (2D) / `...&srsname=EPSG:4326&bbox=...,EPSG:3857` (3D) |
| OGC API Features | `impl.bbox = 'lonMin,latMin,lonMax,latMax'` | `impl.refresh(true)` | `.../collections/falls/items?f=json&limit=300&bbox=-1.07,42.4,0.27,42.9&` |

Detalles que costaron medirlos:

- **El vendor de WFS se mezcla al final de la URL** de `GetFeature`, y el servicio se reconstruye en cada refresco leyendo `this.options.vendor`, así que vale igual en 2D (servicio de OpenLayers) y en 3D (servicio de Cesium).
- **WFS siempre en EPSG:3857**, nunca en 4326: en WFS 2.0 el orden de ejes de 4326 es lat,lon y hay servidores que lo aplican (el WFS de IDENA devuelve **0 entidades** con `bbox=lat,lon,EPSG:4326` y las **862** esperadas con `lon,lat`; con 3857 no hay ambigüedad). El `srsname` de la respuesta lo sigue poniendo la API.
- **OGC API Features siempre en longitud,latitud** (CRS84), que es lo que exige la especificación; el servicio de la API no admite `bbox-crs`.
- **No basta con poner el valor a `null`** para volver a «todas»: se envía `bbox=null` literal y el servicio devuelve 0 entidades. Hay que **borrar** la propiedad (`delete`) o restituir el valor original guardado en `impl._bboxFeaturesOriginal`.

---

## 🗺️ Vista sin filtro

`_bbox(tipo)` devuelve `null` (y por tanto se piden todas las entidades) cuando no hay una extensión expresable en un solo BBOX:

- el mapa está en la vista del mundo entero;
- la vista cruza el **antimeridiano** (no se puede escribir en un `minx,miny,maxx,maxy`);
- la proyección del mapa no se puede reproyectar con `IDEE.utils.reproject`;
- la extensión es degenerada (`max <= min`).

En 3D el encuadre es una cámara en perspectiva: el BBOX que devuelve `map.getBbox()` es el del frustum proyectado sobre el suelo, así que en vistas muy inclinadas incluye bastante terreno que no se ve.

---

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ vista: string[] }`, con los identificadores estables (`legend`, o `name` si la leyenda es el `idLayer`) de las capas en modo «solo la vista». |
| `setState(state, map)` | Rehidrata el objeto `_vista` en la instancia nueva, reinstala la escucha del mapa nuevo y programa la aplicación del BBOX a las capas recién creadas. Resuelve por `legend`/`name`, así que no necesita los `idLayer` viejos. |

El estado vive en `window.EstadoPlugins` (`ext/cambioImpl/cambioImpl.js`), que se captura **antes** de destruir el mapa y se restaura **después** de recrearlo, de forma diferida (evento `COMPLETED` + 1200 ms). El repintado de la lista del selector (`window.renderLayerList`) se fuerza al terminar para que los botones «Todas / La vista» aparezcan con el modo correcto.

---

## ⚠️ Limitaciones y comportamiento esperado

- **La primera carga siempre es completa.** Al arrancar el visor (o al cambiar 2D/3D, que recrea las capas desde cero) la capa lanza su petición inicial sin BBOX. Si el plugin refrescara con BBOX mientras esa petición sigue viva, la respuesta vieja llegaría después y dejaría la capa con todas las entidades aunque el botón dijera «La vista». Por eso `_aplicarCuandoCargue` sondea la capa (40 × 500 ms) y aplica el BBOX cuando ya ha pintado entidades. En **3D** la espera puede ser de varios segundos: Cesium añade las entidades por lotes y esperando a que el globo tenga las teselas (medido: ~14 s con 1000 entidades), y `impl.isLoaded()` no sirve de señal porque el impl de Cesium lo pone a `true` antes de añadirlas.
- **Si la capa no carga nunca** (servicio caído, colección vacía) el BBOX se aplica igualmente al agotar el plazo de 20 s, para que el modo no se quede sin efecto.
- **Refrescos solapados**: si el usuario mueve el mapa mientras una petición filtrada está en vuelo, la respuesta anterior puede llegar después y pintar entidades de la vista previa hasta el siguiente movimiento. Es el mismo comportamiento que tiene la API con sus propios refrescos.
- **Una capa nueva** añadida después del plugin no queda en modo «vista»; hay que llamar a `window.miBBoxFeatures.setModo(capa, 'vista')` (el selector ya pinta su fila).
- **Doble petición en 3D**: un `flyTo` puede emitir dos `camera.moveEnd` separados más de 350 ms, y entonces se hacen dos peticiones con encuadres ligeramente distintos. Es inocuo, pero se ve en la pestaña de red.
- **No toca** `ext/layergroup_cesium/` ni el bundle de la API.

---

## ✅ Comprobado a mano

Con `mapas/tiposDeCapas/capas/wfs/` (IDENA, 1000 entidades) y `mapas/tiposDeCapas/capas/ogcapi/` (colección `falls`, 251 entidades), midiendo en el navegador:

| Caso | Resultado |
|---|---|
| WFS 2D «La vista» | 1000 → 12–1000 entidades según el encuadre; URL con `bbox=...,EPSG:3857`. |
| WFS 2D al mover el mapa | Petición nueva con el BBOX nuevo y solo las entidades de esa vista. |
| WFS 2D «Todas» | Se borra el vendor `bbox`, URL sin `bbox` y vuelven las 1000. |
| WFS 3D tras el cambio | Modo conservado; tras la carga inicial (1000) se aplica el BBOX; `flyTo` → petición con `srsname=EPSG:4326&bbox=...,EPSG:3857`. |
| WFS 3D → 2D | Modo conservado, `vendor.getFeature.bbox` en 3857 y botón «La vista» activo. |
| OGC API 2D | 251 → 29 con BBOX; `impl.bbox` en lon/lat; movimiento → petición nueva. |
| OGC API 3D | Modo conservado tras el cambio, `impl.bbox` con el encuadre de la cámara en lon/lat y nueva petición al `flyTo`. |
| OGC API 3D «Todas» | `impl.bbox` vuelve a `undefined`, URL sin `bbox` y 251 entidades. |

> Para medir peticiones en 3D hay que subir el búfer de Resource Timing (`performance.setResourceTimingBufferSize(20000)`): Cesium llena las 250 entradas por defecto con teselas y las peticiones de features no llegan a registrarse.
