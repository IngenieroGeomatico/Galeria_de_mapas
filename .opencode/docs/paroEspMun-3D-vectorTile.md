# paroEspMun: el MVT en 3D con Cesium

Notas de trabajo para cualquier sesión que siga aquí. Todo lo que hay debajo está
**medido** en el navegador o leyendo los bundles, no supuesto. Al final está lo que
falta.

## Qué se ha hecho ya (commiteado)

- `ext/upgradeLibs`: plugin sin interfaz que carga una versión de OpenLayers y otra de
  Cesium desde CDN, por los `que`, `olVersion`, `cesiumVersion` y `sobrescribirGlobales`
  que se le pasen. Las deja en `window.newOl` y `window.newCesium` (o encima de los
  globales), y expone la promesa `cargado`.
- `mapas/paroEspMun/js/mapa.js`: el alta del plugin con `que: 'ambos'` y
  `cesiumVersion: '1.145'`, y `sobrescribirGlobales: false`.
- El join del paro con la población: el CSV del SEPE trae la fila de cabecera también
  como dato, así que al ordenar los valores como cadenas esa cabecera ganaba (empieza
  por C) y el filtro se quedaba con una fila de basura; con eso el año salía
  `undefined` y el filtro de la población, que comparaba contra ese año, se caía
  también. Ahora los periodos se eligen por forma (`/^\d{6}$/`) y el periodo de la
  población se saca de los propios datos. Da 8 188 municipios con color.

## Lo que se sabe de la API-CNIG (medido)

- `apiidee.ol.min.js` hace `window.ol = {}` y copia clases dentro; `apiidee.cesium.min.js`
  hace `window.Cesium = require(modulo)`, o sea pisa el global con su copia. Al
  instrumentar `window.Cesium.Cartesian3.fromDegrees` y `window.ol.proj.transform`, la
  API **no llamó ni una vez**: usa sus módulos internos y no lee los globales. Por eso
  subir versiones no cambia el visor, y por eso `upgradeLibs` los deja aparte.
- `IDEE.layer.MVT` en 3D **crea las fuentes de datos con cero entidades**: por eso el
  visualizador salía vacío.
- `IDEE.layer.GenericVector({}, { clampToGround: true }, objetoDeCesium)` **funciona en
  3D**: se comprobó con un `CustomDataSource` y aparece en la escena.
- `IDEE.layer` expone 25 capas; no está `VectorTile`. Las de vector tile que hay en el
  bundle de Cesium son las de 3D Tiles, que son otro formato.

## Lo que se sabe de Cesium (medido)

- **`MVTDataProvider` existe a partir de la 1.145** y no estaba en la 1.134.1 (que es la
  que trae la API). Con `cesium@1.145` cargada desde CDN:
  `window.newCesium.MVTDataProvider` es función (1 352 clases, frente a 1 267).
- Con el MVT de municipios del IGN
  (`https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf`),
  `MVTDataProvider.fromUrl(url, { minZoom, maxZoom, extent, heightReference, scene })` se
  construye en ~151 ms, trae `tileset` y **funciona como una primitiva más**:
  `scene.primitives.add(provider)`. La jerarquía son 132 nodos con `minZoom: 5`,
  `maxZoom: 8` y la extensión de la península.
- El servicio usa **XYZ** y las teselas existen de verdad: `/6/31/24.pbf` contesta 200
  con 519 863 bytes, mientras que la misma en TMS (`/6/31/39.pbf`) contesta 200 con 21
  bytes (tesela vacía).
- La jerarquía se construye entera al arrancar: la memoria la marcan `maxZoom` y
  `extent` (una capa global hasta el 8 son unos 87 000 nodos, hasta el 14, 358
  millones). Los 404 se tratan como tesela vacía, no como error.

## Cuidado con las mediciones de teselas

Contar teselas cargadas con `t.content && t.content.length && t.contentReady` da
resultados contradictorios (1 en una medición, 0 en otra). Ese criterio no sirve: hay
que contar `t.content !== undefined` y mirar `tilesLoaded`. Con 0 con contenido puede
que no hayaloaded nada, o que la forma del `content` sea otra.

## Lo que falta, en orden

1. **Que se vea.** `MVTDataProvider` recién creado no trae estilo, así que sus
   polígonos no se ven (o se ven blancos sobre el mapa base). Hay que aplicarle un
   `provider.tileset.style = new Cesium.Cesium3DTileStyle({ color: '#ff0000' })` y
   acercarse a un municipio para comprobar que se pinta.
2. **Los atributos de la geometría**, que es lo que decide el color. Con geometría
   visible, `scene.pick` y `picked.getPropertyIds()` dan los nombres y los valores. En 2D
   el join se hace con `feature.getAttributes().nationalcode.slice(-5)`, o sea que el id
   es un texto de 5 caracteres por el final; **en la tesela puede venir como número**
   (28001), y eso cambia cómo se escribe la expresión.
3. **Qué expresiones acepta el lenguaje de estilo**, que es lo que decide si el color
   por municipio es viable:
   - `"color('${nationalcode}' == '28001' ? '#ff0000' : '#00ff00')"`
   - `"color(${nationalcode} == 28001 ? '#ff0000' : '#00ff00')"`
   - `"color(intToString(${nationalcode}) == '28001' ? ...)"` (si existe `intToString`)
   - `"color('28001' in ['28001','28002'] ? ...)"` y con números
   Ojo al escribir la prueba: Cesium lanza `DevelopmentError`, que no es un `Error` y no
   tiene `.message` como cadena, así que el `catch` hay que hacerlo con
   `String(e && e.message || e)`.
4. **El color.** En 3D Tiles el estilo es declarativo, no admite funciones (a diferencia
   de `IDEE.style.Polygon`, que en 2D usa `fill.color` como función). El `porcParo` sale
   de multiplicar paro por población y **no viene en la tesela**, así que no hay ningún
   atributo con el que clasificar. Salidas: una condición por municipio (8 188, enorme),
   una condición por tramo de la paleta (seis) con la lista de ids de cada tramo usando
   `in` (depende del punto 3), o color fijo en 3D y el coropleta vivo solo en 2D.
5. **El envoltorio**, una vez decidido lo anterior: el `provider` a
   `new IDEE.layer.GenericVector({}, { clampToGround: true }, provider)` para que salga en
   el árbol de capas de la API, y decidir si se sustituye la capa MVT en 3D o conviven.

## Documentación

- Tutorial de Cesium para MVT:
  `https://cesium.com/learn/cesiumjs-learn/load-mapbox-vector-tiles-in-cesiumjs/`
- Referencia de `MVTDataProvider`:
  `https://cesium.com/learn/ion-sdk/ref-doc/MVTDataProvider.html`
- Wiki de la API para `GenericVector`:
  `https://github.com/Desarrollos-IDEE/API-IDEE/wiki/GenericVector`