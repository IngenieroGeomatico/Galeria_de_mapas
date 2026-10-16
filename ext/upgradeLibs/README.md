# 🧩 upgradeLibs

> Deja disponibles versiones nuevas de OpenLayers y de Cesium desde CDN, sin tocar las que lleva dentro la API.

Extensión de utilidades globales sin interfaz (solo código): carga versiones nuevas de **OpenLayers** y **Cesium** desde `jsDelivr` y las deja accesibles en `window.newOl` y `window.newCesium` (o encima de `window.ol` y `window.Cesium` si se pide). Sirve para que el **código del visualizador y de los plugins** dispongan de las librerías al día.

**Ojo (medido, no supuesto)**: la API-CNIG lleva sus propias copias de OpenLayers y Cesium **dentro de su bundle** y no lee los globales en tiempo de ejecución. Por eso sustituir `window.ol`/`window.Cesium` **no** hace que la API use las versiones nuevas: solo afecta al código que lee los globales (visualizador y plugins). Mezclar objetos de una copia y otra en el mismo visor es la forma de tener bugs raros.

## ✨ Características

- Carga `ol@<version>` (`/dist/ol.js`) y `cesium@<version>` (`/Build/Cesium/Cesium.js`) desde `cdn.jsdelivr.net`.
- Deja las librerías nuevas en **`window.newOl`** y **`window.newCesium`** (y en `plugin.nuevas.ol` / `plugin.nuevas.cesium`), apartando las de la API en lugar de perderlas.
- Carga **en serie** (una detrás de otra) para que dos librerías no se peleen por los mismos globales.
- Expone la promesa **`plugin.cargado`** para esperar con `await`.
- Opción `sobrescribirGlobales` para poner las nuevas **encima** de `window.ol`/`window.Cesium`.
- Sin interfaz: no crea panel ni botón.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `upgradeLibs.js` | Define la clase `miPlugin_upgradeLibs`, las URLs de CDN, los helpers de globales (`globalDe`, `dejaGlobal`) y la carga de scripts (`cargaScript`). Único fichero de la extensión (no tiene CSS). |

## 🔧 Integración en un visualizador

```html
<script type="text/javascript" src="../../ext/upgradeLibs/upgradeLibs.js"></script>
```

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_upgradeLibs(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `que` | `string` | `'ambos'` | Qué actualizar: `'ol'`, `'cesium'` o `'ambos'`. Cualquier otro valor cae en `'ambos'`. |
| `olVersion` | `string` | `'10.6.1'` | Versión de OpenLayers a cargar. |
| `cesiumVersion` | `string` | `'1.134'` | Versión de Cesium a cargar. |
| `sobrescribirGlobales` | `boolean` | `false` | Si es `true`, las librerías nuevas se dejan encima de `window.ol`/`window.Cesium`. Si es `false`, lo que hubiera se restituye y la nueva queda en `window.new*`. |
| `silencioso` | `boolean` | `false` | Sin aviso por consola (`console.info`) al terminar la carga. |

## 🚀 Ejemplo de uso

```js
const plugin = new IDEE.plugin.miPlugin_upgradeLibs({
  que: 'ambos',                  // 'ol' | 'cesium' | 'ambos'
  olVersion: '10.6.1',
  cesiumVersion: '1.134',
  sobrescribirGlobales: false    // true pone las nuevas en window.ol y window.Cesium
});
mapajs.addPlugin(plugin);

// Esperar a que terminen de cargar
await plugin.cargado;
console.log(plugin.getNuevas());   // { ol: <libreria>, cesium: <libreria> }
console.log(window.newOl, window.newCesium);
```

## 🧩 API pública / Métodos

| Miembro | Descripción |
|---|---|
| `name` | `'upgradeLibs'`. Identificador del plugin. |
| `addTo(map)` | Invocado por `mapajs.addPlugin(plugin)`. Lanza la carga y devuelve la propia instancia. |
| `cargado` | `Promise` que se resuelve con `{ ol, cesium }` cuando las librerías están listas. |
| `nuevas` | `{ ol: <libreria>, cesium: <libreria> }` con lo cargado. |
| `getNuevas()` | Devuelve `this.nuevas`. |
| `getNueva(nombre)` | Devuelve la librería nueva de `'ol'` o `'cesium'` (o `undefined` si no se pidió). |
| `destroy()` | Pone `this.map = null`. Las librerías ya cargadas **se quedan** puestas (recargarlas cada vez que se recrea el mapa al cambiar de implementación sería tirarlas sin motivo). |

## 🌐 Globales

| Global | Descripción |
|---|---|
| `window.miPlugin_upgradeLibs` | Global directo de la clase (sobrevive al swap 2D/3D). |
| `window.IDEE.plugin.miPlugin_upgradeLibs` / `window.M.plugin.miPlugin_upgradeLibs` | Registro en los namespaces de la API. |
| `window.newOl` | Librería OpenLayers nueva cargada (vive aquí por defecto). |
| `window.newCesium` | Librería Cesium nueva cargada (vive aquí por defecto). |
| `window.ol` / `window.Cesium` | Los globales "reales" de cada librería: solo apuntan a la versión nueva si `sobrescribirGlobales: true`. |

## ✅ Notas / Limitaciones

- **No cambia la versión de las librerías que usa la API**: su bundle lleva las suyas y no lee los globales. Este plugin solo sirve al código del visualizador y de los plugins.
- Si se usa `sobrescribirGlobales: true`, la copia de la API queda apartada en `window.newOl`/`window.newCesium`; mezclar objetos de las dos copias en el mismo visor provoca bugs difíciles de rastrear (p. ej. construir con una copia objetos que van a la escena de la API).
- En `mapas/paroEspMun/js/mapa.js` se dejó de usar: la API-CNIG ya trae OpenLayers 10.7.0 en su bundle y su Cesium 1.145 estorbaba para el 3D, así que allí se usa `window.Cesium` (la de la API).
