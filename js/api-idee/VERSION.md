# API-IDEE 1.1.0 — copia local de seguridad

Esta carpeta contiene una copia local de la API-IDEE **1.1.0** (descargada el 09-09-2026 desde
`componentes-desarrollo.idee.es`), para que la Galería de mapas no dependa de la disponibilidad
del servicio de la IDEE.

## Consultar la versión vigente en el servidor

Endpoint oficial del estado de versiones de la API-IDEE (dev):

```
https://componentes-desarrollo.idee.es/api-idee/api/actions/version
```

Respuesta en el momento de la copia (09-09-2026):

```json
{"date":"04-09-2026","number":"1.1.0","number-ol":"10.7.0","number-cesium":"1.118.0"}
```

- `number`: versión de la API-IDEE
- `number-ol`: versión de OpenLayers integrada
- `number-cesium`: versión de CesiumJS integrada

## Archivos incluidos (origen: https://componentes-desarrollo.idee.es/api-idee/)

| Archivo | Tamaño |
|---|---|
| `apiidee-1.1.0.cesium.min.js` | 8 002 681 bytes |
| `apiidee-1.1.0.ol.min.js` | 4 932 709 bytes |
| `apiidee-1.1.0.cesium.min.css` | 572 289 bytes |
| `apiidee-1.1.0.ol.min.css` | 554 934 bytes |
| `configuration-1.1.0.js` | 4 611 bytes |
| `browser-polyfill.js` | 66 968 bytes |

## Cómo actualizar esta copia

Si el servicio de la IDEE publica una versión nueva (`number` distinto de 1.1.0 en el endpoint
anterior), descargar los archivos correspondientes con el nuevo número de versión en el nombre
y actualizar las referencias en los `index.html` de la galería (patrón `../../js/api-idee/...`).