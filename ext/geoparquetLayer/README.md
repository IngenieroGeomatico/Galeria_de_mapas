# ext/geoparquetLayer

Capa `IDEE.layer.GeoParquet` (subclase de `IDEE.layer.GeoJSON`) que lee un fichero
`.parquet` geoespacial en 2D y en 3D, descargando solo el footer y los row groups
que caen en la vista mediante HTTP Range.

## Uso

```js
const capa = new IDEE.layer.GeoParquet({
  url: 'barrios.parquet',
  name: 'Barrios',
  legend: 'Barrios de Madrid',
}, { style });
mapajs.addLayers(capa);
```

## Caracteristicas

- Lectura por HTTP Range del footer y de los row groups necesarios.
- Teselado por bbox de la vista (renovacion al mover el mapa).
- Soporte 2D (OpenLayers) y 3D (Cesium) a traves de la fachada.
- Integracion con `ext/bboxFeatures` (modo "Todas / La vista").

## Parametros principales

- `url`: URL del fichero `.parquet`.
- `name`, `legend`: identificadores estables para el selector de capas.
- `style`: estilo de la capa (opciones de `IDEE.style.Generic`).

## Dependencias

- `hyparquet.min.js` (lector de Parquet), cargado por la propia extension desde
  su carpeta.

## Notas de mantenimiento

La extension sigue el patron comun del repositorio: fachada sobre
`IDEE.layer.GeoJSON`, instalacion sobre el bundle activo (`instalar()` con
`setInterval`), y exposicion global en `window.geoparquetLayer` /
`window.miGeoParquet`. No modificar la logica de teselado por bbox sin medir el
impacto en memoria y peticiones.
