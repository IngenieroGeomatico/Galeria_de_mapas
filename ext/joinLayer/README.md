# IDEE.layer.join (JoinLayer)

Capa y extensión universal para realizar **uniones (Joins)** entre dos capas geográficas y/o alfanuméricas en la API-IDEE / API-CNIG (`M.layer.join` / `IDEE.layer.join`).

Permite combinar datos de **CUALQUIER tipo de capa vectorial** (`WFS`, `OGCAPIFeatures`, `KML`, `GeoJSON`, `FlatGeobuf`, `GeoParquet`, `Shapefile`, `Vector`, `Alphanumeric`, `BigQuery`, CSV, JSON, etc.) y enriquecer sus atributos tanto creando una nueva capa resultante como inyectando los atributos directamente en la capa base existente (*in-situ*).

---

## 1. Tipos de Join Soportados

El constructor admite el parámetro `type` (o `joinType`) con los siguientes tipos de unión relacional y espacial:

| Tipo | Alias | Descripción |
|---|---|---|
| `'left'` *(por defecto)* | `'left_outer'`, `'leftOuter'` | **Left Outer Join**: Conserva todos los elementos de la Capa 1. Si hay coincidencia en la Capa 2, añade sus atributos; si no hay correspondencia, los campos de la Capa 2 se rellenan con `null` (o el valor `nullValue`). |
| `'inner'` | `'inner'` | **Inner Join**: Conserva únicamente los elementos de la Capa 1 que tengan al menos una coincidencia en la Capa 2. Los elementos sin correspondencia se descartan. |
| `'right'` | `'right_outer'`, `'rightOuter'` | **Right Outer Join**: Conserva todos los registros de la Capa 2. Si coinciden con la Capa 1, toman su geometría y atributos combinados; si no coinciden, se preservan con los atributos de la Capa 1 en `null`. |
| `'full'` | `'full_outer'`, `'outer'` | **Full Outer Join**: Conserva todos los elementos de ambas capas. Los coincidentes se combinan; los no coincidentes de Capa 1 o Capa 2 se preservan con los campos de la otra capa en `null`. |
| `'semi'` | `'left_semi'`, `'exists'` | **Semi Join (Filtro por existencia)**: Conserva las features de la Capa 1 que existen en la Capa 2, manteniendo intactos sus atributos originales (sin añadir las columnas de Capa 2). |
| `'anti'` | `'left_anti'`, `'not_exists'` | **Anti Join (Filtro por no existencia)**: Conserva únicamente las features de la Capa 1 que **NO** tienen correspondencia en la Capa 2. |

---

## 2. Modos de Unión

- **Atributos (`mode: 'attribute'`, por defecto)**: Compara los valores de un campo clave en la Capa 1 (`key1`) con un campo clave en la Capa 2 (`key2`).
- **Espacial (`mode: 'spatial'`)**: Evalúa la relación geométrica entre los objetos de ambas capas mediante predicados espaciales:
  - `'intersects'` *(por defecto)*: Intersección geométrica de cualquier tipo.
  - `'contains'`: La geometría de la Capa 1 contiene a la de la Capa 2.
  - `'within'`: La geometría de la Capa 1 está dentro de la de la Capa 2.
  - `'touches'`: Comparten frontera sin solapamiento interior.
  - `'nearest'` / `'distance'`: Une con el elemento más cercano (o dentro de una distancia máxima `maxDistance`).
- **Automático (`mode: 'auto'`)**: Si no se proporcionan claves de atributos `key1`/`key2`, conmuta automáticamente a unión espacial.

---

## 3. Modos de Operación

### A. Capa Resultante Independiente (Capa nueva)
Crea una nueva capa en el mapa con su propia leyenda, estilo y control de visibilidad:
```javascript
const joinLayer = new IDEE.layer.Join({
  name: 'municipios_con_paro',
  legend: 'Municipios con datos de desempleo',
  layer1: 'capa_wfs_municipios', // Capa WFS, KML, GeoJSON, etc.
  layer2: 'tabla_desempleo_csv',   // Capa Alphanumeric, CSV, BigQuery, etc.
  key1: 'codigo_ine',
  key2: 'cod_mun',
  type: 'left',
  prefix: 'paro_'
});
mapajs.addLayers(joinLayer);
```

### B. Enriquecimiento In-Situ (`inplace: true`)
Modifica directamente las features de la Capa 1 existente en el mapa (válido para capas WFS, OGC API Features, KML, GeoJSON, etc.). Su tabla de atributos, ventanas de información y estilos adoptan los nuevos datos de inmediato:
```javascript
// Opción 1: En el constructor con inplace: true
const join = new IDEE.layer.join({
  layer1: capaWFS,
  layer2: capaAlfanumerica,
  key1: 'NATCODE',
  key2: 'codigo',
  type: 'left',
  inplace: true
});

// Opción 2: Mediante la función estática IDEE.layer.Join.apply
await IDEE.layer.Join.apply(capaWFS, 'datos_censo.csv', {
  key1: 'ID_SECCION',
  key2: 'seccion',
  prefix: 'censo_'
});
```

---

## 4. Opciones del Constructor

```javascript
new IDEE.layer.Join(options, layerOptions);
```

| Opción | Tipo | Defecto | Descripción |
|---|---|---|---|
| `layer1` / `target` | `Layer\|string\|Object\|string(URL)` | `null` | Capa base (instancia de capa vectorial WFS, KML, GeoJSON, etc., ID/legend en el mapa, FeatureCollection, array de objetos o URL). |
| `layer2` / `source` | `Layer\|string\|Object\|string(URL)` | `null` | Capa de origen de datos a unir (instancia de capa, ID/legend, GeoJSON, array de registros o URL a CSV/JSON). |
| `key1` / `field1` | `string` | `null` | Nombre del campo clave en la Capa 1. |
| `key2` / `field2` | `string` | `= key1` | Nombre del campo clave en la Capa 2. |
| `type` / `joinType` | `string` | `'left'` | Tipo de join: `'left'`, `'inner'`, `'right'`, `'full'`, `'semi'`, `'anti'`. |
| `mode` | `string` | `'attribute'` | Modo de unión: `'attribute'`, `'spatial'`, `'auto'`. |
| `spatialPredicate` | `string` | `'intersects'` | Predicado espacial si `mode: 'spatial'`: `'intersects'`, `'contains'`, `'within'`, `'touches'`, `'nearest'`. |
| `maxDistance` | `number` | `null` | Distancia máxima para unión espacial `'nearest'` (en metros o unidades del mapa). |
| `prefix` | `string` | `''` | Prefijo añadido a los nombres de las columnas traídas de la Capa 2 para evitar colisiones. |
| `fields` | `Array<string>\|Object` | `null` | Lista de campos a importar de la Capa 2, o mapa de renombramiento `{ campoCapa2: 'nuevoNombre' }`. Si no se pasa, se importan todos. |
| `exclude` | `Array<string>` | `[]` | Lista de columnas de la Capa 2 a ignorar/excluir. |
| `cardinality` | `string` | `'one-to-one'` | Manejo de correspondencias múltiples: `'one-to-one'` (primer match), `'last'`, `'one-to-many'` (duplica feature), `'aggregate'`. |
| `aggregations` | `Object` | `null` | Funciones de resumen cuando `cardinality: 'aggregate'`. Ej: `{ importe: 'sum', edad: 'avg', id: 'count' }`. |
| `inplace` | `boolean` | `false` | Si es `true`, inyecta los atributos directamente en las features de la Capa 1 existente. |
| `nullValue` | `any` | `null` | Valor asignado a los atributos de elementos no coincidentes. |
| `caseSensitive` | `boolean` | `false` | Si la comparación de claves de texto distingue mayúsculas/minúsculas. |
| `overwrite` | `boolean` | `false` | Si sobrescribir atributos de Capa 1 si hay colisión de nombres y no se usa prefijo. |

---

## 5. Métodos Públicos

- **`recalculate()`**: Ejecuta o refresca el cálculo de la unión a partir de las fuentes actuales. Devuelve una promesa con las features resultantes.
- **`applyToTarget()`**: Inyecta los atributos combinados en las features de la Capa 1 original.
- **`getJoinStats()`**: Devuelve estadísticas de ejecución:
  ```json
  {
    "type": "left",
    "mode": "attribute",
    "layer1Count": 8131,
    "layer2Count": 8131,
    "matchedCount": 8125,
    "unmatched1Count": 6,
    "unmatched2Count": 0,
    "resultCount": 8131,
    "executionTimeMs": 14
  }
  ```
- **`getJoinOptions()` / `setJoinOptions(newOptions)`**: Consulta o actualiza opciones del join en tiempo de ejecución (recalculando automáticamente).
- **`getUnmatchedFeatures(1 | 2)`**: Devuelve las features que no tuvieron correspondencia en la Capa 1 o en la Capa 2.
- **`toGeoJSON()`**: Exporta el resultado como un objeto GeoJSON `FeatureCollection`.
- **`getRecords()`**: Exporta la tabla de atributos combinada como un array de objetos JavaScript.

---

## 6. Ejemplos de Uso

### Ejemplo 1: Capa WFS de Municipios + CSV de Renta per Cápita (Left Join)
```javascript
// 1. Cargar capa WFS de municipios
const wfsMunicipios = new IDEE.layer.WFS({
  url: 'https://servicios.idee.es/wfs-inspire/unidades-administrativas',
  name: 'AU.AdministrativeUnit',
  legend: 'Municipios'
});
mapajs.addLayers(wfsMunicipios);

// 2. Cargar CSV con datos socioeconómicos
const datosRenta = new IDEE.layer.Alphanumeric({
  url: 'https://midominio.com/datos/renta_municipios.csv',
  legend: 'Renta 2024'
});
mapajs.addLayers(datosRenta);

// 3. Crear capa Join combinando ambos
const joinRenta = new IDEE.layer.Join({
  name: 'municipios_renta',
  legend: 'Municipios con Renta',
  layer1: wfsMunicipios,
  layer2: datosRenta,
  key1: 'nationalCode',
  key2: 'cod_ine',
  type: 'left',
  prefix: 'renta_',
  fields: ['renta_media', 'poblacion_total']
});
mapajs.addLayers(joinRenta);
```

### Ejemplo 2: Inner Join para filtrar geometrías que tengan datos
```javascript
// Muestra únicamente las provincias que tengan datos en la tabla
const joinProvincias = new IDEE.layer.join({
  layer1: 'Provincias_IGN',
  layer2: 'Datos_Ventas_Regionales',
  key1: 'codigo_ine',
  key2: 'cpro',
  type: 'inner'
});
mapajs.addLayers(joinProvincias);
```

### Ejemplo 3: Spatial Join (Puntos dentro de Polígonos con Agregación)
```javascript
// Sumar las ventas de todas las tiendas (puntos) ubicadas dentro de cada zona comercial (polígonos)
const joinZonas = new IDEE.layer.join({
  layer1: capaZonasComerciales, // Polígonos
  layer2: capaTiendas,          // Puntos
  mode: 'spatial',
  spatialPredicate: 'contains',
  cardinality: 'aggregate',
  aggregations: {
    volumen_ventas: 'sum',
    numero_empleados: 'sum',
    id_tienda: 'count'
  },
  prefix: 'tot_'
});
mapajs.addLayers(joinZonas);
```

---

## 7. Contrato de Estado 2D/3D

`JoinLayer` implementa los métodos `getState()` y `setState(state, map)`. Al cambiar entre la implementación 2D (OpenLayers) y 3D (Cesium) mediante el plugin `cambioImpl`, la configuración del join, sus campos, prefijos y capas de entrada se restauran fielmente sin pérdida de datos.
