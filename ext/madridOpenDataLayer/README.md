# ext/madridOpenDataLayer — Datos Abiertos del Ayuntamiento de Madrid

Plugin/utilidad para consultar el **portal de Datos Abiertos del Ayuntamiento de Madrid** (https://datos.madrid.es) y crear capas `IDEE.layer.Alphanumeric` (y, si hay geometría, GeoJSON) a partir de sus datasets/recursos mediante la API CKAN v3.

## API usada (CKAN v3)

Base: `https://datos.madrid.es/api/3/action/`

| Acción | Descripción |
|---|---|
| `package_search?q=...&rows=...&start=...` | Buscar datasets. |
| `package_show?id=...` | Metadatos de un dataset (incluye `resources`). |
| `resource_show?id=...` | Metadatos de un recurso (URL, formato, datastore_active). |
| `datastore_search?resource_id=...&limit=...&offset=...&q=...` | Datos tabulares de un recurso (si está en el DataStore). |
| `datastore_search_sql?sql=...` | Consulta SQL sobre el DataStore. |

El portal permite CORS (`*`), así que la petición se hace desde el navegador.

## Cómo obtener el identificador

### Dataset
1. Entra en https://datos.madrid.es/ y busca el dataset (ej. "Población por distrito y barrio").
2. En la ficha del dataset, el campo "Nombre" (slug) es el `id` (ej. `300557-0-poblacion-distrito-barrio`). También vale el UUID.
3. O usa `package_search` para obtenerlo programáticamente.

### Recurso / resource_id
1. En la ficha del dataset, en "Descargas", cada fichero tiene un enlace. El `resource_id` es el identificador del recurso en CKAN.
2. Vía API: `package_show?id=<dataset>` devuelve `resources[]` con `id`, `url`, `format`, `datastore_active`.
3. Para el DataStore, usa el `id` del recurso (UUID) como `resource_id` en `datastore_search`.

### Buscar datasets programáticamente
```
https://datos.madrid.es/api/3/action/package_search?q=población+distrito&rows=10
```

## Uso básico

```javascript
// Buscar datasets
const lista = await window.Madrid.buscarDatasets('población distrito');

// Cargar un dataset por su id/name (usa su primer recurso)
const capa = await window.Madrid.cargarDataset('300557-0-poblacion-distrito-barrio');

// Cargar directamente un recurso del DataStore
const capa2 = await window.Madrid.cargarRecurso('200085-1-censo-locales', { limit: 500 });

// Factory estática
const capa3 = await IDEE.layer.Alphanumeric.fromMadrid('200085-1-censo-locales', { limit: 500 });
```

## Parámetros de `cargarRecurso(resourceId, opciones)`

| Opción | Tipo | Descripción |
|---|---|---|
| `limit` | number | Registros por página del DataStore (def. 1000). |
| `offset` | number | Desplazamiento inicial. |
| `maxRegistros` | number | Tope total de registros a traer (def. 50000). |
| `q` | string | Filtro de texto del DataStore. |
| `series` | string \| RegExp \| array \| function | Filtra filas por contenido. |
| `columnas` | string[] | Conserva solo esas columnas. |
| `name` / `legend` | string | Nombre/leyenda de la capa. |

## Otras fuentes de estadísticas de Madrid (no cubiertas aquí)

- **Banco de datos estadístico**: https://servpub.madrid.es/CSEBD_WBINTER/ (interfaz HTML legacy, sin REST documentado).
- **Estadística en www.madrid.es**: https://www.madrid.es/portales/munimadrid/es/.../Estadistica
- **Nuestra ciudad en cifras**: http://portalestadistico.com/municipioencifras/?pn=madrid

## Notas

- Si el recurso no está en el DataStore, se descarga por su URL (CSV/JSON) y se parsea.
- La capa resultante es `IDEE.layer.Alphanumeric` (sin geometría), apta para tablas, gráficos y joins por campo.