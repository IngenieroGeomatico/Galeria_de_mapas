# ext/ifcLayer

Capa `IDEE.layer.IFC` para cargar modelos BIM en formato IFC sobre Cesium.

## Uso

```js
const capa = new IDEE.layer.IFC({
  url: 'modelo.ifc',          // URL del IFC (siempre .ifc)
  directo: false,             // true: modo directo (web-ifc); false: conversion a GLB
  // position: { lon, lat, height }, // opcional: si se omite, se lee del IfcSite
  name: 'ModeloIFC',
  legend: 'Modelo IFC (3D)',
}, { style });
```

## Modos de carga

### Modo conversion (`directo: false`, por defecto)

Convierte el IFC a GLB en el navegador con `@ifc-lite` y lo carga con
`Cesium.Model.fromGltfAsync`. El GLB se genera en memoria (no se descarga un
fichero intermedio).

**Ventajas**
- Aprovecha el pipeline optimizado de Cesium para glTF/GLB: culling, bounding
  volumes, materiales, texturas e, idealmente, LOD/streaming.
- Mejor rendimiento y estabilidad en modelos de tamaño medio/grande.
- Menos primitivas en la escena.

**Inconvenientes**
- Coste inicial de CPU y memoria para la conversion.
- Modelos muy grandes pueden exceder la pila o la memoria disponible.
- Se pierden las propiedades IFC salvo que se exporten como extras.
- Dependencia de `@ifc-lite` (CDN).

### Modo directo (`directo: true`)

Usa `web-ifc` para extraer la geometria y crea primitivas de Cesium
directamente, sin pasar por GLB.

**Ventajas**
- Sin paso intermedio de conversion: mas directo y con menos dependencias.
- Conserva el control sobre la geometria extraida.
- Util para modelos pequenos o para depuracion.

**Inconvenientes**
- Render menos optimizado: sin LOD/streaming y mas primitivas en la escena.
- Peor rendimiento en modelos grandes.
- Materiales basicos (color por elemento).

## Recomendacion

- Modelos pequenos o medianos: cualquiera de los dos modos funciona.
- Modelos grandes: preferir el modo conversion (`directo: false`) o convertir
  el IFC a 3D Tiles/GLB en servidor.
- Si el IFC declara `IfcSite` (RefLatitude/RefLongitude/RefElevation), la capa
  se posiciona sola; no hace falta pasar `position`.

## Posicionamiento

La georreferenciacion se lee del IFC (`IfcSite`). Si no esta disponible, el
modelo queda en el origen y conviene pasar `position` manualmente.
