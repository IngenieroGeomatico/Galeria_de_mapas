# Checklist de integración — capas de `ext/` (plugins que son capas)

Validación manual (navegador/Playwright) para cualquier capa de `ext/` que se
comporte como capa (GeoTIFF, MVT, MBTiles, FlatGeobuf, etc.). Ejecutar en el
visualizador correspondiente de `mapas/tiposDeCapas/capas/<capa>/`.

## Validaciones obligatorias

Para cada capa, comprobar en **2D** y en **3D** (alternando con
`#APIIDEE-herramienta-button`):

1. **Carga**: la capa se pinta sin errores de consola.
2. **Selector de capas**: aparece en el árbol de capas superpuestas
   (miPlugin_layerSwitcher) con su leyenda.
3. **Herramientas**: activar/desactivar, cambiar opacidad y, si aplica,
   cambiar estilo/visualización responden sin errores.
4. **Información de feature/píxel**: al activar "Consultar información del
   punto" y clicar, devuelve la misma información en 2D y en 3D.
5. **Capa base (si aplica)**: si la capa se registra en
   `crearCapasBaseTipos()`, aparece en el selector de capas base y se puede
   seleccionar.

## Capas a cubrir

- MVT (`mapas/tiposDeCapas/capas/mvt/`) — ver `MVT.integration.md`.
- GeoTIFF (`mapas/tiposDeCapas/capas/geotiff/`).
- MBTiles (`mapas/tiposDeCapas/capas/mbtiles/`).
- FlatGeobuf (`mapas/tiposDeCapas/capas/flatgeobuf/`).
- GeoParquet (`mapas/tiposDeCapas/capas/geoparquet/`).
- PMTiles (`mapas/tiposDeCapas/capas/pmtiles/`).
- WMS, WFS, WMTS, OGC API Features, KML, GeoJSON, Vector, TMS, XYZ, MVT
  (carpetas de `mapas/tiposDeCapas/capas/`).

## Nota
No hay framework de E2E instalado. Estas validaciones se ejecutan a mano o con
Playwright cuando se añada (`npm i -D playwright`). Los tests unitarios de lógica
pura viven en `tests/*.test.js` (`npm test`).