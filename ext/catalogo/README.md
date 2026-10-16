# 🧩 Catálogo (miPlugin_catalogo)

> Catálogo de servicios y capas que se cargan en el visualizador, por listado predefinido o pegando una URL.

Plugin con panel que ofrece los servicios ya escritos de varios catálogos (IDEE, STAC, OGC API Records y los que declare el visualizador) para cargarlos en el mapa con un clic, y una pestaña «Añadir capa» donde se pega la URL de un servicio o de un fichero publicado por http/https: el plugin deduce el tipo, lee el documento de capacidades, deja elegir qué capas cargar y con qué nombre, y las añade al mapa.

## ✨ Características

- **Dos formas de cargar**: listado predefinido por catálogo (con `<select>`) y alta por URL con análisis previo (`Analizar` → tipo + capas + nombre).
- **Tres modos de listado**: `secciones` (catálogo de la IDEE, pedido por tipo de servicio con un segundo desplegable y buscador), `arbol` (nodos desplegables de profundidad libre) y `lista` (lista corta y fija).
- **Tres catálogos de serie**: `IDEE.catalog.IDEE`, `IDEE.catalog.STAC` y `IDEE.catalog.OGCAPIRecords`, más `IDEE.catalog.custom` para los propios del visualizador, todos parametrizables por el array `catalogos`.
- **Alta de catálogos por el usuario** (`CatalogoRegistro`): tipo `stac`, `ogcapi` o `json`, persistidos en `localStorage` (`galeria_catalogo_usuario`), con lista de bajas.
- **Catálogos consultados con árbol**: navegación por colecciones e items de un STAC (con migas y botón Volver), paginación de `/items` con el enlace `rel="next"`, búsqueda por zona (rectángulo de la vista, solo 2D) y por fechas.
- **Huella de elementos STAC**: botón `Huella` que dibuja en el mapa el `bbox`/`geometry` de una escena (con previsualización al pasar el ratón), para verla antes de descargarla.
- **Detección de tipo por URL** con tabla ordenada (ficheros → plantillas de teselas → parámetros OGC → WMS por defecto) y lectura del documento de capacidades (WMS 1.1.1/1.3.0, WMTS, WFS 1.x/2.0) sin depender de prefijos de espacio de nombres.
- **Aviso explícito de CORS**: los tipos que se cargan sin consultar nada se comprueban antes con `urlEsLegible()` (HEAD y, si falla, GET con `Range: bytes=0-0`).
- **Comprobación de CORS/`s3://`**: las direcciones `s3://cubo/ruta` se reescriben a la forma HTTPS *virtual-hosted* de S3.
- **Carga automática de los formatos que a la API de Cesium le faltan**: el propio plugin carga e inyecta `ext/MVTLayer/MVTLayer.js` y `ext/geotiffLayer/geotiffLayer.js` (rutas resueltas contra la del propio `catalogo.js`) y los registra en el mapa una sola vez por mapa (`WeakMap`).
- **Contrato de estado 2D/3D** (`getState`/`setState`): conserva catálogo elegido, URL escrita, mensaje de estado, pestaña, sección de servicio, grupos abiertos, filtro, análisis pendiente y estado del panel.
- **Persistencia de la selección**: recuerda en `localStorage` el catálogo (`galeria_catalogo_seleccion`) y el tipo de servicio (`galeria_catalogo_seccion`).
- **Paginación de 50 en 50** con paginador arriba y abajo y botón «Ver los N»; el filtro mira nombre y organismo, y solo la URL a partir de 6 caracteres.
- **Icono como máscara** (`--g-plugin-icon-mask`) y colores por variables CSS (`color1/color2/color3`), sin colores escritos en la hoja.
- **Integración con el supraplugin**: `getSupraElement()` añade el botón a la barra, oculta el botón propio de la API (`g-panel-en-barra`) y sincroniza el estado abierto/plegado.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `catalogo.js` | El plugin. Define `IDEE.catalog` (registro de tipos), las clases `CatalogoCustom`, `CatalogoRemoto`, `CatalogoSTAC`, `CatalogoOGCAPIRecords`, `CatalogoIDEE` y la clase `miPlugin_catalogo` (UI, análisis de URL, huellas STAC, paginación y contrato de estado). |
| `catalogo_idee.js` | Cliente del catálogo de la IDEE (adaptación de `serviciosIDEE2QGIS`). Expone `window.CatalogoIDEE`: `SECCIONES`, `PAGINA_CATALOGO`, `urlSeccion()`, `listarSeccion()`, `pedir()` y `limpiarCache()`. |
| `catalogo_url.js` | Detección del tipo de capa a partir de una URL, lectura del documento de capacidades y creación de la capa. Expone `window.CatalogoURL`. |
| `catalogo_registro.js` | Catálogos dados de alta por el usuario (alta, baja, persistencia) y sus lectores `stac` / `ogcapi` / `json`, con la navegación y paginación de nodos STAC. Expone `window.CatalogoRegistro`. |
| `catalogo.css` | Estilos del panel y del botón de la barra. Cromática por variables `--g-plugin-*` (inyectadas desde `color1/color2/color3`), icono por `--g-plugin-icon-mask`, y clases `catalogo__*` para el contenido. |
| `datos/<seccion>.js` | Copias locales de las tablas del catálogo de la IDEE (`wms.js`, `wmts.js`, `xyz.js`, `mvt.js`, `wfs.js`, `wcs.js`, `ogcapi.js`), volcadas en `window.CatalogoIDEE_Datos[id]`. Se cargan con una etiqueta `<script>` para que funcionen también en `file://`. |
| `generar_catalogo_idee.py` | Script que regenera `datos/*.js` pidiendo las tablas al portal de la IDEE de servidor a servidor (sin CORS). `python ext/catalogo/generar_catalogo_idee.py [seccion]`. |

## 🔧 Integración en un visualizador

```html
<link type="text/css" rel="stylesheet" href="../../ext/catalogo/catalogo.css" />
<!-- El orden importa: catalogo_idee.js se cuelga del registro IDEE.catalog que
     crea catalogo.js, y catalogo_url.js es el que resuelve las URLs. -->
<script src="../../ext/catalogo/catalogo_idee.js" type="text/javascript"></script>
<script src="../../ext/catalogo/catalogo_url.js" type="text/javascript"></script>
<script src="../../ext/catalogo/catalogo_registro.js" type="text/javascript"></script>
<script src="../../ext/catalogo/catalogo.js" type="text/javascript"></script>
```

Las dependencias de formato (`MVTLayer` y `geotiffLayer`) **no** hay que declararlas: `catalogo.js` las carga solo cuando hacen falta.

## ⚙️ Parámetros de construcción

`new IDEE.plugin.miPlugin_catalogo(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `string` | `'TR'` | Esquina del panel, clave de `IDEE.ui.position` (`'TL'`, `'TR'`, `'BL'`, `'BR'`…). |
| `collapsible` | `boolean` | `true` | Si el panel se pliega a botón. |
| `order` | `number` | `null` | Valor CSS `order` del panel dentro de la esquina. Se deriva: si no es `undefined`, ni `null`, ni `NaN`, se guarda como `Number`; en cualquier otro caso, `null`. |
| `color1` | `string\|Object` | `{active:'#ffffff', deactive:'orangered'}` | Color de fondo (acepta `'#rgb'` o `{active, deactive}`). |
| `color2` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de borde. |
| `color3` | `string\|Object` | `{active:'#71A7D3', deactive:'#ffffff'}` | Color de icono y texto. |
| `icon` | `string` | `null` | Icono del botón: SVG completo, contenido suelto (envuelto en `<svg viewBox="0 0 24 24">`) o URL/ruta. Alias: `icono`, `svg`. Se pinta como máscara CSS. |
| `title` | `string` | `'Catálogo'` | Texto de la cabecera del panel (`.m-herramienta-header`) y `aria-label` de la región. |
| `tituloBarra` | `string` | `'Catalogo'` | Texto y `title` del botón de la barra del supraplugin (`getSupraElement()`). |
| `catalogos` | `Array\|Object` | `null` | Catálogos del visualizador. Cada entrada puede ser un catálogo ya hecho (con `listar()`), sus datos planos (`{nombre, modo, servicios[], nodos[], secciones[]}`) o el contenedor `IDEE.catalog.propios`. Los ids se suman a los de serie y, si coinciden, los pisan. Se admite también la forma antigua de objeto con un catálogo por clave. |
| `soloCatalogos` | `boolean` | `false` | Con `catalogos` presente, deja **solo** los del visualizador y quita los tres de serie. |
| `catalogoPorDefecto` | `string` | — | Id del catálogo con el que se abre el panel. Orden de resolución: `catalogoPorDefecto` → selección guardada → primero disponible. |
| `seccion` | `string` | — | Id del tipo de servicio (sección) que se abre en el catálogo de la IDEE. Si no se pasa, se usa el de `localStorage`. |
| `filtro` | `string` | `''` | Texto inicial del buscador. |
| `grupos` | `Array<string>` | `['disponibles','nuevo']` | Grupos plegables que arrancan abiertos en la pestaña de catálogos. |
| `pestana` | `string` | `'catalogos'` | Pestaña activa al abrir (`'catalogos'` o `'capa'`). |

## 🚀 Ejemplo de uso

```js
// Catálogos propios (se declaran antes de crear el plugin).
const catalogos = [
  new IDEE.catalog.IDEE(),                       // el de serie, por secciones
  new IDEE.catalog.STAC({
    nombre: 'STAC (Earth Search)',
    url: 'https://earth-search.aws.element84.com/v1/collections'
  }),
  new IDEE.catalog.OGCAPIRecords({
    nombre: 'Catálogo de ejemplo',
    url: 'https://test.cubewerx.com/cubewerx/cubeserv/default/ogcapi/catalogues/collections?f=json'
  }),
  new IDEE.catalog.custom({
    nombre: 'Servicios personalizados',
    descripcion: 'Catálogo declarado desde mapa.js.',
    nodos: [
      { nombre: 'Ráster', servicios: [
        { nombre: 'Callejero (WMS)', url: 'https://www.ign.es/wms-inspire/ign-base' }
      ] },
      { nombre: 'Organismo', nodos: [{ nombre: 'Base', servicios: [
        { nombre: 'Base de España', url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg' }
      ] }] }
    ]
  })
];

mapajs.addPlugin(new IDEE.plugin.miPlugin_catalogo({
  position: 'TR',
  order: 2,
  icon: '../../img/iconos/collect.svg',
  catalogos: catalogos
}));
```

## 🧩 API pública

### Registro de catálogos — `IDEE.catalog` (alias `M.catalog`)

`catalogo.js` crea el registro al cargarse. Lo vuelve a colgar `miPlugin_cambioImpl` tras el swap 2D/3D a través de `window.miCatalogos.exponer()`, porque al recargar el bundle `window.IDEE` pasa a ser un objeto nuevo.

| Miembro | Descripción |
|---|---|
| `tipos` | Catálogos de serie, indexados por id (`'idee'`, `'stac'`, `'ogcapi-records'`). Los propios se añaden también aquí, que es la lista de la que se pinta el `<select>`. |
| `propios` | Catálogos declarados por los visualizadores, ya construidos. |
| `custom` | Clase `CatalogoCustom`: `new IDEE.catalog.custom({...})`. |
| `IDEE`, `STAC`, `OGCAPIRecords` | Las tres clases de serie, para instanciarlas y parametrizarlas. |
| `crear(id, datos)` | Instancia un catálogo propio y lo deja en `propios`. Devuelve el catálogo. |
| `tipo(id)` | Devuelve el catálogo con ese id (de serie o propio) o `null`. |
| `ids()` | Ids en el orden del `<select>` (primero los de serie). |

### `IDEE.catalog.custom(options)` — catálogo declarado por el visualizador

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `id` | `string` | derivado del `nombre` (sin acentos, en minúsculas, con guiones; si queda vacío, `cat` + base36 de `Date.now()`) | Identificador. |
| `nombre` | `string` | `id` | Nombre visible. |
| `descripcion` | `string` | `''` | Texto que se pinta sobre la lista. |
| `servicios` | `Array` | `[]` | Lista plana de servicios. |
| `nodos` | `Array` | `[]` | Subnodos (un nodo puede llevar `servicios` y `nodos` a la vez, sin límite de profundidad). Se admiten también las claves `hijos` y `secciones`. |
| `secciones` | `Array` | `[]` | Secciones tipo IDEE (`{id, nombre, tipo, corto, descripcion, servicios[]}`). |
| `modo` | `string` | derivado: `'secciones'` si hay `secciones`, `'arbol'` si hay nodos, `'lista'` en otro caso | `'secciones'` \| `'arbol'` \| `'lista'`. |
| `cargarUrl` | `Function` | `cargarUrlGenerica(url, mapa, opciones)` de `catalogo.js` | Cargador propio, si el visualizador quiere otra cosa que la detección por URL. |

Un servicio se normaliza así: `nombre` ← `nombre`/`name`/`title`/`url`/`'(sin nombre)'`, `url` ← `url`/`capa`/`href`, `descripcion` ← `descripcion`/`description`, y `tipo` ← el declarado (`tipo`/`type`) o el que deduzca `CatalogoURL.detectarTipo(url)`.

### `IDEE.catalog.STAC(options)` / `IDEE.catalog.OGCAPIRecords(options)`

Ambas heredan de `CatalogoRemoto`, que por defecto usa `modo: 'lista'`, `tipoLectura: 'json'` y marca `seConsulta = true`.

| Clase | `id` | `nombre` | `url` por defecto | `tipoLectura` |
|---|---|---|---|---|
| `IDEE.catalog.STAC` | `'stac'` | `'STAC'` | `https://catalogue.dataspace.copernicus.eu/stac` | `'stac'` |
| `IDEE.catalog.OGCAPIRecords` | `'ogcapi-records'` | `'OGC API Records'` | `https://api-features.ign.es/collections` | `'ogcapi'` |

Acepta las mismas claves que `CatalogoCustom` más `url` y `tipoLectura`.

### `IDEE.catalog.IDEE(options)`

Catálogo de la IDEE, en modo `secciones`. Por defecto `id: 'idee'`, `nombre: 'Catálogo IDEE'` y `secciones: window.CatalogoIDEE.SECCIONES`. Se puede recortar pasando un `secciones` propio (p. ej. solo las WMS autonómicas) o añadir servicios a una sección con `servicios`.

### `window.CatalogoIDEE`

| Miembro | Descripción |
|---|---|
| `SECCIONES` | Tabla de tipos: `wms`, `wmts`, `xyz`, `mvt`, `wfs`, `wcs`, `ogcapi` (el WMS del portal está partido en estatal, autonómico, local y planos verticales y aquí se fusiona). |
| `PAGINA_CATALOGO` | URL de la página del catálogo, para abrirla en el navegador. |
| `urlSeccion(idSeccion)` | URL de la tabla de una sección del portal. |
| `listarSeccion(idSeccion, opciones)` | Devuelve `Promise<{seccion, familias, total}>`. Con `opciones.recargar` ignora la caché. Si no hay copia local, pide al portal (que no manda CORS). |
| `pedir(url)` | `fetch` directo con mensaje de error explícito para CORS. |
| `limpiarCache(idSeccion, mantenerId)` | Vacía la caché de secciones (una, todas, o todas menos una) y devuelve cuántas ha soltado. |

### `window.CatalogoURL`

| Miembro | Descripción |
|---|---|
| `TIPOS` | Tipos que la API puede construir: `WMS`, `WMTS`, `WFS`, `WCS`, `XYZ`, `TMS`, `MVT`, `GeoJSON`, `KML`, `GPX`, `GML`, `CSV`, `SHP`, `GeoTIFF`, `MBTiles`, `GeoPackage`, `OGCAPIFeatures`, `MapLibre`. |
| `ETIQUETAS` | Etiquetas legibles de cada tipo (más `desconocido`). |
| `httpDeS3(url)` | Pasa `s3://cubo/ruta` a `https://cubo.s3.amazonaws.com/ruta`. |
| `urlEsLegible(url)` | `Promise<boolean>`. Comprueba con HEAD y, si falla, GET con `Range: bytes=0-0` (10 s de tope). |
| `detectarTipo(url)` | Devuelve un tipo de `TIPOS` o `'desconocido'`. |
| `leerCapas(url, tipo)` | `Promise<{tipo, nombre, capas, aviso}>`. Pide el capabilities en WMS/WMTS/WFS; en el resto devuelve una capa sintética con la propia URL. |
| `urlCapabilities(url, tipo)` | Monta la URL de GetCapabilities respetando los parámetros ya presentes. |
| `pedir(url)` / `parsearJson(texto, url)` | `fetch` directo y `JSON.parse` con mensajes de error legibles. |
| `nombreDeUrl(url)` | Nombre deducido del final de la URL. |
| `cargar({url, mapa, tipo, capas, nombre})` | Crea y añade las capas con `mapa.addLayers(capas)` y devuelve el array de capas creadas. Iguala el `wrapX` de las fuentes con `window.miWrapX` si está disponible. |

### `window.CatalogoRegistro`

| Miembro | Descripción |
|---|---|
| `TIPOS` | `{stac:'STAC', ogcapi:'OGC API Records', json:'JSON de servicios'}`. |
| `CLAVE` | `'galeria_catalogo_usuario'`. |
| `leer(tipo, url)` | `Promise<Array<entrada>>` con el lector correspondiente. |
| `leerNodoStac(url)` | Lee un nodo STAC con hijos, metadatos, `padre`, `urlItems`, `urlItemsSiguiente` y `totalElementos`. |
| `leerPaginaStac(urlPagina)` | `Promise<{entradas, siguiente}>` de la página siguiente de items. |
| `leerBusquedaStac(urlItems, filtro)` | Búsqueda por `bbox` y `datetime` (`inicio/fin`, extremos abiertos con `..`). Devuelve `{entradas, siguiente, total, url}`. |
| `todos()` / `porId(id)` | Lista completa y búsqueda por id. |
| `alta({nombre, tipo, url})` | Valida (`nombre` obligatorio, URL `http(s)://`, tipo conocido), actualiza si ya hay uno con esa URL y devuelve el catálogo creado (id `usuario_<hash36>_<base36 de Date.now()>`). |
| `baja(id)` | Quita el catálogo y persiste. |

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{ tipo, url, mensaje, pestana, seccion, grupos[], filtro, analisis, panelCollapsed }`. `analisis` va como `{url, tipo, nombre, capas[{id,nombre}], elegidas[], aviso}` o `null`, para no tener que volver a pedir el servicio tras el swap. `panelCollapsed` se lee de `this._panel._collapsed` y, si no, de la clase `collapsed` del elemento. |
| `setState(state, map)` | Rehidrata el estado interno (acepta también catálogos del usuario, con id `usuario_*`, resolviéndolos por `CatalogoRegistro.porId`), aplica la pestaña y el estado abierto/plegado del panel y llama a `_sincronizarUI()` para volcar el estado a los elementos ya montados (selector, input de URL, buscador, lista y opciones de análisis). |

## ✅ Notas y limitaciones

- **El orden de los `<script>` es obligatorio**: `catalogo_idee.js` se cuelga del registro `IDEE.catalog` que crea `catalogo.js`, y `catalogo_url.js` es el que resuelve las URLs.
- **El catálogo de la IDEE se lee de las copias locales** (`datos/*.js`): `www.idee.es` no manda `Access-Control-Allow-Origin`, así que no se puede pedir desde el navegador. Para refrescar: `python ext/catalogo/generar_catalogo_idee.py` (todas las secciones) o con un id (`wmts`) para una sola.
- **`fetch` directo, sin el proxy de la API**: por eso los tipos que no consultan nada antes se comprueban con `urlEsLegible()`, y los errores de CORS se explican en el mensaje en vez de dejar la capa muda.
- **Los catálogos de IDEE se piden por secciones** y al cambiar de tipo de servicio se sueltan de memoria las demás (plugin y caché de `CatalogoIDEE`): solo hay una sección activa a la vez.
- **Elementos STAC que no son capas**: si un item no tiene ningún asset que la API sepa construir (por `type` MIME), se muestra como información (`soloInfo`) sin botón de cargar; solo la huella.
- **La búsqueda por zona solo funciona en 2D**: en Cesium la cámara no define un rectángulo, así que `_vistaActualEnGrados()` devuelve `null` y el formulario se queda solo con las fechas.
- **En TR** la API mete el botón dentro del panel y la cabecera queda partida: el CSS lo recoloca (`catalogo--tr`) para que el panel se vea igual que los demás.
- **`destroy()` es obligatorio**: quita la capa de huella (que si no se queda viva en el mapa sin panel desde el que quitarla), cierra el panel, suelta las referencias de UI y borra el globo, que vive en `document.body`.
- **MVT y GeoTIFF en 3D**: el plugin registra `miPlugin_MVTLayer` y `miPlugin_geotiffLayer` en el mapa (no los crea el visualizador); los `idLayer` de las capas cargadas los regenera la API en cada swap, así que el estado guarda ids de catálogo, no de capa.
