# ext/geoparquetLayer

Capa `IDEE.layer.GeoParquet` (subclase de `IDEE.layer.GeoJSON`) que lee ficheros de datos vectoriales en formato **GeoParquet** tanto en 2D (OpenLayers) como en 3D (Cesium), descargando mediante peticiones `HTTP Range` únicamente los metadatos (*FileMetaData* / footer) y los grupos de filas (*Row Groups*) requeridos por la vista o los filtros.

---

## El estándar GeoParquet

[GeoParquet](https://geoparquet.org/) es una especificación abierta para el almacenamiento eficiente de geometrías vectoriales sobre el formato columnar [Apache Parquet](https://parquet.apache.org/) (estándar OGC en proceso, versiones 1.0.0 y 1.1.0).

### Estructura de metadatos `geo`
En el footer de Apache Parquet (`key_value_metadata`), GeoParquet define un objeto JSON con clave `"geo"`:
- **`version`**: Versión de la especificación GeoParquet (ej. `"1.1.0"`, `"1.0.0"`).
- **`primary_column`**: Nombre de la columna que contiene la geometría principal (habitualmente `"geometry"`).
- **`columns`**: Diccionario con la configuración de cada columna de geometría:
  - `encoding`: Formato de codificación (habitualmente `"WKB"` o `"geometry"`).
  - `geometry_types`: Tipos de geometrías presentes (ej. `["Point", "MultiPolygon"]`).
  - `crs`: Sistema de referencia en formato PROJJSON o string EPSG (`null` indica OGC:CRS84 / EPSG:4326).
  - `bbox`: Bounding box global del dataset `[minx, miny, maxx, maxy]`.
  - `covering` (GeoParquet 1.1+): Estructura con las rutas a las columnas/subcolumnas del bounding box de cada feature (ej. `xmin: ["bbox", "xmin"]`, `ymin: ["bbox", "ymin"]`, etc.). Permite descartar *Row Groups* completos que no tocan la vista antes de descargar sus datos.

---

## Niveles de optimización en la lectura

| Nivel de optimización | ¿Cómo actúa? | ¿Descarga bytes de la red? |
| :--- | :--- | :--- |
| **Poda de columnas (*Column Pruning*)** | Indicando `columns: ['nombre', 'poblacion']` | ❌ **No.** Las columnas no solicitadas jamás se descargan. |
| **Poda espacial por BBOX** | Automático al mover el mapa en 2D y 3D | ❌ **No.** Solo descarga los *Row Groups* que tocan la vista. |
| **Predicate Pushdown alfanumérico** | Con `where: { poblacion: { $gte: 50000 }, provincia: 'Madrid' }` | ❌ **No.** Lee las estadísticas `[min, max]` del footer y descarta los *Row Groups* fuera de rango antes de pedir los bytes. |
| **Filtro funcional en memoria** | Con `filter: (props) => props.nombre.startsWith('A')` | ⬇️ Descarga solo las columnas pedidas de los bloques visibles y evalúa en memoria. |

---

## Ejemplos de uso

### 1. Filtro alfanumérico con Predicate Pushdown (`where`)

Permite descartar bloques de filas directamente leyendo las estadísticas del footer antes de la descarga HTTP Range:

```js
const capa = new IDEE.layer.GeoParquet({
  url: 'datos/municipios.parquet',
  name: 'Municipios',
  legend: 'Municipios grandes de Madrid',
  columns: ['nombre', 'provincia', 'poblacion'],
  // Pushdown predicate sobre estadísticas de Parquet + filtrado exacto:
  where: {
    provincia: 'Madrid',
    poblacion: { $gte: 50000 }
  }
}, { style });

mapajs.addLayers(capa);
```

#### Operadores soportados en `where`:
- Igualdad directa: `{ provincia: 'Madrid' }`
- Mayor / Mayor o igual: `{ $gt: 100 }`, `{ $gte: 100 }`, `{ min: 100 }`
- Menor / Menor o igual: `{ $lt: 500 }`, `{ $lte: 500 }`, `{ max: 500 }`
- Pertenencia a lista: `{ $in: ['Madrid', 'Toledo', 'Guadalajara'] }`
- Rango combinado: `{ poblacion: { $gte: 10000, $lte: 50000 } }`

---

### 2. Filtro alfanumérico dinámico en tiempo de ejecución

```js
// Cambiar el filtro where dinámicamente (ej. desde un selector de provincia):
capa.setWhere({ provincia: 'Barcelona', poblacion: { $gt: 20000 } });

// O con una función personalizada de JavaScript:
capa.setFilter((props) => props.nombre.toLowerCase().includes('sol'));

// Para limpiar el filtro:
capa.setWhere(null);
```

---

### 3. Consultar los metadatos GeoParquet del fichero

```js
capa.getGeoParquetMetadata().then((info) => {
  console.log('Versión GeoParquet:', info.version);
  console.log('Columna geometría:', info.primaryColumn);
  console.log('CRS:', info.crs);
  console.log('Filas totales:', info.numRows);
  console.log('Número de Row Groups:', info.numRowGroups);
  console.log('Columnas disponibles:', info.columns);
  console.log('BBOX global:', info.bbox);
});
```

---

## API de la capa `IDEE.layer.GeoParquet`

### Parámetros del constructor
- `url`: URL del fichero `.parquet`.
- `name`, `legend`: Identificadores para el selector de capas.
- `crs`: Código CRS destino/origen (opcional, por defecto se extrae del metadata).
- `columns`: Array de nombres de columnas a leer (opcional, para *Column Pruning*).
- `where`: Objeto de condiciones declarativas para *Predicate Pushdown*.
- `filter` / `filtro`: Función `(properties, feature) => boolean` o bien objeto de condiciones `where`.
- `headers` / `requestInit`: Cabeceras de autenticación (ej. `{ Authorization: 'Bearer ...' }`) para servidores S3 o APIs privadas.
- `byteLength`: Tamaño total en bytes del archivo (opcional: ahorra la petición HTTP HEAD inicial).
- `style`: Estilo de la capa (`IDEE.style.Generic`).

### Métodos públicos
- `capa.getGeoParquetMetadata()`: Devuelve `Promise<Object>` con los metadatos estructurados.
- `capa.setWhere(where)` / `capa.getWhere()`: Establece/obtiene condiciones de *Predicate Pushdown*.
- `capa.setFilter(fnOrWhere)` / `capa.getFilter()`: Establece/obtiene el predicado de filtro.
- `capa.setColumns(columns)` / `capa.getColumns()`: Modifica/obtiene las columnas a solicitar.
- `capa.reload()`: Fuerza la recarga de datos.

---

## Dependencias

- `hyparquet.min.js`: Lector ligero de Apache Parquet en JavaScript (~20 KB).
- `fzstd.min.js`: Descompresor Zstandard (ZSTD) para compresión estándar en Parquet.
