# ext/mbtilesLayer — MBTiles como capa teselada real

Plugin/capa para leer archivos `.mbtiles` y pintarlos como **capa teselada**: solo se
decodifican y pintan las teselas visibles en el zoom actual, en lugar de
descargar/decodificar el contenedor entero.

## Por qué "de nuevo"

La capa nativa `IDEE.layer.MBTiles` del bundle descarga el contenedor y lee las
teselas con sql.js, pero no se comporta como un origen teselado real: pide/decodifica
más de lo visible y va lenta. Esta extensión envuelve la base SQLite en memoria y
expone un origen teselado (OpenLayers XYZ en 2D, ImageryProvider en 3D) que solo
solicita las teselas del viewport.

## Uso

```javascript
const capa = new IDEE.layer.MBTiles2({
  url: 'https://raw.githubusercontent.com/mapbox/node-mbtiles/master/test/fixtures/plain_1.mbtiles',
  name: 'MBTiles',
  legend: 'MBTiles de ejemplo (z0-4)'
});
mapajs.addLayers(capa);
```

Alias disponible: `IDEE.layer.MBTilesTiled`.

## Cómo funciona

1. Descarga el `.mbtiles` (ArrayBuffer) una sola vez.
2. Abre la base con **sql.js** (cargado desde CDN).
3. Lee `metadata` (formato, min/max zoom) y consulta `tiles` por `(zoom_level, tile_column, tile_row)` (TMS).
4. 2D: sustituye el `tileLoadFunction` de la fuente de `IDEE.layer.TMS`.
5. 3D: añade un `ImageryProvider` personalizado a la escena de Cesium.

## Limitaciones

- MBTiles vectoriales (MVT dentro de MBTiles) no están soportados en esta versión;
  solo raster (png/jpg/webp).
- Requiere conexión a CDN para sql.js la primera vez.
- El fichero se descarga completo (no por rangos); la "teselación" afecta al
  renderizado (solo teselas visibles), no a la descarga.