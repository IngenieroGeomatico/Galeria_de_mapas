# 🧩 MVT (miPlugin_MVTLayer)

> Da soporte 3D a `IDEE.layer.MVT` (Mapbox Vector Tiles), que en el bundle de Cesium está declarada pero sin implementación.

Plugin sin interfaz que hace que la capa se cree con la misma definición en 2D y en 3D. En 3D sustituye la fachada de `IDEE.layer.MVT` por una propia que hereda de `IDEE.layer.Vector` y le pasa una implementación que sí lee teselas: descarga la tesela, la decodifica con `@mapbox/vector-tile` + `pbf`, la recorta a su `extent`, agrupa los anillos por el signo de su área y la rasteriza en un canvas que se entrega a Cesium como `ImageryProvider`, de modo que queda **drapeada sobre el MDT**. En 2D no hace nada: ahí la implementa OpenLayers.

## ✨ Características

- **Fachada propia para `IDEE.layer.MVT`** registrada solo si la implementación activa es Cesium (`IDEE.impl.cesium`). En 2D la clase del bundle se deja intacta.
- **El porqué de la fachada**: el constructor de `IDEE.layer.MVT` pide su implementación a un módulo de webpack (`90505`) que en `apiidee.cesium.min.js` es `()=>{}`, un stub vacío. Registrar la clase en `IDEE.impl.layer` o en `M.layer` no arregla nada, porque `__webpack_require__` no se expone en la ventana.
- **Dibujado drapeado sobre el terreno** (`clampToGround` real): Cesium mapea las texturas de las teselas sobre la malla del MDT en la GPU, sin vértices hundidos, sin cortinas verticales en vistas oblicuas y sin las separaciones de las cuadrículas; y con gestión automática de LOD (Cesium pide los niveles que necesita según la distancia de la cámara).
- **Decodificación en canvas 2D** (1-2 ms por tesela) en vez de `GroundPrimitive`: evita las pausas de 10-15 s de la compilación de shaders en la GPU.
- **Recorte exacto a `0..extent`**: sin él, dos teselas vecinas pintan la misma franja dos veces porque cada una trae el buffer de la otra (el servicio del IGN manda unos 80 unidades, un 2 % por lado), y con opacidad < 1 salían franjas oscuras en cruz.
- **Agrupación de anillos por el signo de su área** (especificación MVT): sin este paso se perdían 799 de 9 199 municipios (entre ellos Móstoles, que tiene dos trozos).
- **Click resuelto a mano**: la API no dispara `evt.CLICK` en Cesium, y su `getFeaturesByLayer` haría `drillPick`, que solo ve `entities` (la coropleta es una capa de imágenes). El plugin saca el punto del rayo contra el globo y pregunta al lector de qué municipio es, y emite `IDEE.evt.SELECT_FEATURES` con el mismo contrato que en 2D.
- **Aguanta las dos formas de tesela vacía** (21 bytes medidos): si el buffer no llega a 40 bytes se devuelve un canvas de 1x1 y no se pinta nada.
- **Se trae sus dependencias**: `@mapbox/vector-tile@2.0.3/+esm` y `pbf@3.2.1/+esm` con importaciones dinámicas a URL absoluta. El sufijo `+esm` de jsDelivr es lo que hace innecesario el `import map` (el paquete viene reempaquetado con sus dependencias dentro). Se respeta el `window.Pbf` si la página lo carga.
- **Contrato de estado 2D/3D** (`getState`/`setState`): sin UI que rehidratar; la instalación se vuelve a hacer en cada `addTo`.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `MVTLayer.js` | Todo el plugin: la fachada de la capa, la implementación (`MVTImplVector`), el lector (`LectorMVT`) y el renderizado (`RenderMVT` + `MVTImageryProvider`). Expone `window.miPlugin_MVTLayer` y `window.LectorMVT`. |

No hay hoja de estilos: el plugin no tiene interfaz.

## 🔧 Integración en un visualizador

```html
<script type="text/javascript" src="../../ext/MVTLayer/MVTLayer.js"></script>
```

En el `index.html` no hace falta ni `pbf`, ni `proj4`, ni `import map`: el plugin se trae lo suyo.

## ⚙️ Parámetros de construcción

### El plugin

`new IDEE.plugin.miPlugin_MVTLayer(options)`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `options` | `Object` | `{}` | **No se lee ninguna propiedad**: se guarda en `this.options` y nada más. La configuración va en la capa, no aquí. |

### La clase de capa

`new IDEE.layer.MVT(parameters)` — las mismas claves que en 2D.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | `string` | — | Plantilla XYZ del servicio, con `{z}`, `{x}` y `{y}`. Ejemplo medido del IGN: `https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf`. |
| `name` | `string` | — | Nombre de la capa (clave del servicio). |
| `legend` | `string` | — | Nombre que se ve en el selector de capas. |
| `layers` | `string` | `''` | Capa dentro de la tesela. Ejemplo: `'municipio'`. Si va vacío, se toma la primera del fichero. |
| `extent` | `number` | `4096` | Unidades de lado de la tesela. Medido en el servicio del IGN: `4096`. |
| `visibility` | `boolean` | — | Visibilidad inicial (clave propia de la API). |
| `extract` | `boolean` | — | Extracción de atributos (clave propia de la API). |
| `attribution` | `Object` | — | `{name, description}` de la atribución. |
| `minZoom` / `maxZoom` | `number` | `undefined` | Se copian a la fachada (`this.minZoom` / `this.maxZoom`). No los usa el dibujado: el rango de zoom del renderizador está fijo en 5-14. |

### El lector (`window.LectorMVT`)

`new LectorMVT({url, capas, extent})`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | `string` | — | Plantilla con `{z}`, `{x}` y `{y}`. Si falta, `cargarTesela()` lanza. |
| `capas` | `string` | `''` | Capa dentro de la tesela. |
| `extent` | `number` | `4096` | Unidades de lado. |

### El proveedor de imágenes (interno)

`new MVTImageryProvider({url, capas, extent, colorDe})`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `url` | `string` | — | Plantilla XYZ. |
| `capas` | `string` | `'municipio'` | Capa dentro de la tesela. |
| `extent` | `number` | `4096` | Unidades de lado (de reserva: se prefiere el `extent` que declara la propia capa de la tesela). |
| `colorDe` | `Function` | `() => COLOR_SIN_DATO` | `(codigo, nombre) => colorCSS`. |

## 🎨 Colores

El plugin no pinta colores fijos: el color de cada elemento lo pone el visualizador con una función, y así 2D y 3D comparten el mismo *ramp*.

| Constante | Valor | Descripción |
|---|---|---|
| `COLOR_SIN_DATO` | `'rgba(150, 150, 150, 0.75)'` | Color de las entidades sin fila en el CSV, y el que se usa si no hay función de color o si esta lanza. Medido: son 84 de 9 199 y todas con código 53xxx (mancomunidades y entidades singulares, que el INE no publica como municipios). |
| `COLOR_BORDE` | `'#222222'` | Color del borde de cada polígono (`stroke`). |
| `ANCHO_BORDE` | `1.0` | Grosor del borde. Con `0` no se traza. |
| `ZOOM_MIN` / `ZOOM_MAX` | `5` / `14` | Rango de niveles del `MVTImageryProvider` y de `municipioEn()`. |

La función de color se registra con `setColorFunction(fn)` y recibe `(codigo, nombre)`, donde `codigo` son los 5 últimos dígitos del `nationalcode` (el servicio del IGN entrega 11 caracteres: `'34' + '07' + '37354'`, así que `nationalcode.slice(-5)` siempre acierta).

## 🚀 Ejemplo de uso

Real (`mapas/paroEspMun/js/mapa.js`), con **una sola capa para 2D y 3D**:

```js
// En 2D no hace nada; en 3D registra la implementación de Cesium, que es la que falta.
mapajs.addPlugin(new IDEE.plugin.miPlugin_MVTLayer());

const capaMVT_Municipios = new IDEE.layer.MVT({
  url: 'https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf',
  name: 'Municipios',
  layers: 'municipio',
  visibility: true,
  extract: false,
  attribution: {
    name: 'Municipios:',
    description: "<a style='color: #0000FF' href='https://www.ign.es/web/ign/portal' target='_blank'>IGN</a>"
  }
});
mapajs.addLayers(capaMVT_Municipios);

// El click es IGUAL en las dos implementaciones: llega SELECT_FEATURES con
// features[0].getAttributes().nationalcode y coord.
capaMVT_Municipios.on(IDEE.evt.SELECT_FEATURES, (features, m) => {
  if (!features || !features.length || !features[0]) return;
  const codMuni = features[0].getAttributes().nationalcode.slice(-5);
  // ...
});

if (!es3D) {
  // 2D: el estilo es un IDEE.style.Polygon con función.
  capaMVT_Municipios.setStyle(new IDEE.style.Polygon({
    fill: { color: (feature) => colorPorCodigo[feature.getAttributes().nationalcode.slice(-5)] },
    stroke: { color: 'grey', width: 1 },
  }));
} else {
  // 3D: el color lo da el lector, que rasteriza la tesela a canvas.
  const impl = capaMVT_Municipios.impl_;
  if (impl && typeof impl.setColorFunction === 'function') {
    impl.setColorFunction((codigo) => colorPorCodigo[codigo]);
  }
}
```

## 🧩 Métodos públicos

### Del plugin

| Método | Descripción |
|---|---|
| `addTo(map)` | Guarda el mapa e instala la fachada (`_instalar()`). |
| `getHelp()` | `{ title: 'MVT en 3D', content: Promise<html> }`. |
| `destroy()` | Suelta la referencia al mapa. |
| `getState()` / `setState(state, map)` | Contrato de estado: `{}` y reinstalación. |

### De la implementación (capa 3D)

| Método | Descripción |
|---|---|
| `setColorFunction(fn)` | Fija el color de cada municipio. Como el color se calcula al leer la tesela, lo ya pintado se queda con el color viejo; se avisa por `lector.alCambiarColor`, que el renderizador engancha para repintar. |
| `municipioEn(lon, lat)` | `Promise<Object\|null>`. Qué municipio hay en un punto (lo usa el click). |
| `cargar(z, x, y)` | `Promise<Object>` con `{z, x, y, features, bytes, vacia}` de la última tesela leída. Punto de entrada para iterar desde la consola. |
| `refrescarMVT()` | Vuelve a crear el `ImageryProvider`. **El nombre no es `refresh` a propósito**: la clase base ya tiene un `refresh()` propio que taparía al nuestro y la capa no pintaría nunca. |
| `get pintados` | Número de municipios de la **última tesela leída**. No es el número de municipios en pantalla: el dibujado va por `ImageryProvider` y no lleva la cuenta. |
| `addTo(map)` / `destroy()` | Montan y desmontan el renderizador (incluido el manejador de clic). |
| `setVisible(visible)` / `isVisible()` | Visibilidad (`imageryLayer.show`). |

### De la fachada

| Método | Descripción |
|---|---|
| `getLector()` | El `LectorMVT`, para iterar desde la consola. |
| `getFeatures()` / `getFeatureById()` | `[]` (no hay entidades de la API: el dibujado es una capa de imágenes). |
| `getGeometryType()` | `null`. |

### Del lector

| Método | Descripción |
|---|---|
| `setColorFunction(fn)` | `(codigo, nombre) => colorCSS`. |
| `urlTesela(z, x, y)` | La URL de una tesela, o `''` si la plantilla no cuadra. |
| `cargarTesela(z, x, y)` | Descarga y decodifica la tesela a `{z, x, y, features, bytes, vacia}`. |
| `municipioEn(lon, lat, zoom)` | `Promise<Object\|null>`. Zoom por defecto `ZOOM_MAX` (14): a z12 la geometría del MVT ya va generalizada y un municipio pequeño sale desplazado. |
| `LectorMVT.teselasDe(rect, zoom)` | `static`. Las teselas que cubren un rectángulo `{oeste, este, norte, sur}` en grados, como `["z/x/y", ...]`. |

## 🔄 Estado 2D/3D

| Método | Contenido |
|---|---|
| `getState()` | `{}`. El plugin no tiene UI que rehidratar. |
| `setState(state, map)` | Guarda el mapa si llega y llama a `_instalar()`. |

## ✅ Notas y limitaciones

- **Solo actúa en 3D**: la instalación exige `IDEE.impl.cesium`, `IDEE.layer.Vector` e `IDEE.impl.layer.Vector`. La fachada se construye dentro de `_instalar()` y no al cargar el script, porque la clase base cambia con cada recarga del bundle al alternar 2D/3D.
- **El click no lo hace la API en Cesium**: `featuresHandler_.activated_` vale `true` y las capas están en `layers_`, pero tras un clic real `evt.CLICK` no se emite ni una vez (medido). Y aunque se emitiera, `getFeaturesByLayer` de Cesium usa `drillPick`, que no ve una capa de imágenes. El plugin lo resuelve con `scene.camera.getPickRay` + `scene.globe.pick`.
- **La coordenada del evento lleva altura a propósito**: con 2 valores, la implementación de popup de Cesium espera a que cargue una capa de terreno para muestrear la altura, y en un visualizador sin terreno esa espera no termina nunca (medido: el popup se quedaba a `top: -628px`). Con 3 valores hace `Cartesian3.fromDegrees(lon, lat, altura)` y funciona siempre.
- **`fire` de la API es `fire(tipo, [args])`**, no `fire(tipo, ...args)`: el array se reparte entre los oyentes. El plugin llama `facade.fire(IDEE.evt.SELECT_FEATURES, [[feature], {coord, pixel}])`.
- **La API dispara `SELECT_FEATURES` también cuando el clic no ha caído sobre nada**, con la lista vacía. El oyente del visualizador tiene que comprobar `features[0]` o revienta.
- **El relleno se hunde bajo el terreno en algunos municipios** (Ambite, la parte de Cádiz que linda con San Fernando) mientras el borde va bien. Está **sin explicar**: la hipótesis del relieve se midió y es falsa (Ambite tiene más desnivel que Cádiz y solo 0,6 m más de desviación). Lo que distingue a los que fallan es que tienen municipios colindantes (Ceuta y Melilla no tienen ninguno y se ven bien).
- **El borde no va bien por sus vértices**: `GroundPolylineGeometry` reparte los puntos por la superficie y quien los clava al terreno es `clampToGround`, en el shader de vértices de la GPU. Por eso no hay vértices «buenos» que leer para construir el polígono a partir del borde.
- **La caché de teselas del lector (60, con expulsión del más viejo) es aparte de la del dibujado**: la de dibujado va con el `ImageryProvider` y no guarda nada en JS; la del lector hace falta porque cada clic necesita la geometría en CPU.
- **Rendimiento medido**: 0,2 ns por vértice al pasar de unidades de tesela a lon/lat (fórmula cerrada de Web Mercator), frente a desviaciones de hasta 14 km que producía una interpolación bilineal en z5.
