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

El estado guarda las capas de entrada por **identificador estable** (`legend`/`name`), nunca por `idLayer` (que se regenera en cada reinicio del mapa) ni por referencia al objeto de la capa vieja. `setState` aplica además la **visibilidad** y, si hay mapa nuevo, resuelve las capas y las vuelve a enganchar.

### 7.1. Cómo sobrevive la capa al cambio 2D/3D

`JoinLayer` está registrada en `CAPAS_CON_ESTADO` de `ext/cambioImpl/cambioImpl.js`:

| Marca | Constructor | Fachada |
|---|---|---|
| `_isJoinLayer` | `IDEE.layer.join` | `window.joinLayer` |

Al cambiar de implementación, `transferOverlayLayers` detecta la marca, pide `getState()`, construye una capa nueva con las capas de entrada ya como identificadores y llama a `setState`. Como el join **no tiene URL**, su entrada en la tabla usa `sinUrl: true`: si se exigiera `url` (como a GLB/Imagen/IFC) la capa se descartaría.

`ext/joinLayer/joinLayer.js` expone `window.joinLayer = { instalar, camposDeCapa }` para que `cambioImpl` pueda reinstalar la extensión sobre el bundle nuevo antes de recrear la capa. La reinstalación se dispara con el evento `load` del `<script>` de la API (capturado en fase de captura, así que también llega a los scripts insertados por JS) y con un sondeo corto de respaldo.

> **Riesgo conocido**: si la capa de origen no se transfiere al mapa nuevo o cambia de `legend`, `setState` no encuentra el identificador y el join se queda sin datos (las estadísticas salen a 0). En ese caso hay que usar `legend` estables y únicas en el visualizador. La capa resultado del join se vuelve a calcular de forma asíncrona al añadirse al mapa nuevo (`addTo` + `recálculo programado`).

Tras la rehidratación, el join se recalcula en cuanto las dos capas de entrada están disponibles: se escucha `evt.LOAD` de cada capa y, sobre todo, se reintenta el cálculo de forma **acotada** (12 intentos, ~4 s) mientras no haya ni una feature o quede algún identificador sin resolver. En 3D el volcado usa `impl.refresh(featureCollection)` y no `setSource`: este último conserva `loadFeaturesPromise_` ya resuelta y el `DataSource` de Cesium se quedaba con las features anteriores (vacías).

---

## 8. Recomendaciones y troubleshooting

### 8.1. Claves que no existen

`key1`/`key2` deben existir en las features de cada capa. La pestaña de Join de la ficha avisa y **no ejecuta** la unión si la clave elegida no aparece en los campos de la capa (o si no se ha elegido ninguna), en lugar de devolver un resultado con todas las filas sin correspondencia. El aviso se apoya en `JoinLayer.camposDeCapa(capa)`, que es la misma extracción que usa el core.

### 8.2. Recálculos concurrentes

`recalculate()` está serializado: si llega una petición mientras hay un cálculo en curso, no se solapa; se espera al actual y se programa **un** reintento con el último estado. Esto evita que el evento de carga de una WFS y el botón de la ficha escriban `_joinedFeatures` a la vez.

### 8.3. Modo in-situ

En modo `inplace` se usa **una sola** instancia (`JoinLayer.apply` crea, recalcula y aplica). No hay que crear otra capa ni volver a llamar a `recalculate()` desde la UI: eso duplicaba el trabajo.

### 8.4. FlatGeobuf y MVT

- **FlatGeobuf**: se fuerza la carga completa (`_recargar('todas')`) antes del join. En 3D se espera a que `getFeatures()` devuelva datos.
- **MVT**: solo existen las features de las teselas del viewport. En 2D se usan las features del viewport. En 3D (ext/MVTLayer) se exponen como GeoJSON fragmentos por tesela (solo viewport, posibles duplicados) para que el join pueda consumirlas, pero los joins espaciales pueden no encontrar correspondencias completas. La ficha del selector muestra un aviso.

### 8.6. Tabla de compatibilidad por tipo de capa

| Tipo de capa | 2D (OpenLayers) | 3D (Cesium) | Modo `vista` | Modo `todas` | Notas |
|---|---|---|---|---|---|
| GeoJSON / Vector | Sí | Sí | n/a | n/a | Fuente síncrona; sin recálculo al mover el mapa. |
| WFS / OGC API Features | Sí | Sí | Sí (bboxFeatures) | Sí | Recálculo al cambiar el viewport. |
| KML | Sí | Sí | n/a | n/a | Carga completa al añadirse. |
| FlatGeobuf | Sí | Sí | Sí (forzado a `todas`) | Sí | Se fuerza `_recargar('todas')` antes del join. |
| GeoParquet | Sí | Sí | Sí | Sí | Carga asíncrona; reintento acotado. |
| Alphanumeric / CSV / BigQuery | Sí | Sí | n/a | n/a | Sin geometría; solo joins por atributo. |
| MVT | Sí (teselas del viewport) | Sí (fragmentos por tesela, solo viewport) | Sí (teselas visibles) | No existe fichero único | En 3D los resultados pueden duplicar municipios; aviso en la ficha. |

### 8.5. El join no aparece tras el cambio 2D/3D

Comprobar, en este orden:

1. `window.joinLayer` existe y `IDEE.layer.join` está definido tras el swap.
2. `window.JoinLayer.camposDeCapa` está disponible (extensión reinstalada).
3. La capa de entrada conserva su `legend` en el mapa nuevo.
4. La consola no muestra `cambioImpl: IDEE.layer.join no esta instalada`.

---

## 9. Ejemplos adicionales de `inplace`

### 9.1. Enriquecer una WFS con un CSV y conservar la simbología

```javascript
const join = new IDEE.layer.join({
  layer1: capaMunicipios,          // WFS ya en el mapa
  layer2: 'renta_2024',            // Alphanumeric / CSV ya en el mapa
  key1: 'nationalCode',
  key2: 'cod_ine',
  type: 'left',
  prefix: 'renta_',
  inplace: true                    // inyecta en las features de capaMunicipios
});
await join.recalculate();
// La tabla de atributos y los popups de capaMunicipios ya muestran renta_*
```

### 9.2. Join in-situ con agregación espacial

```javascript
// Suma las ventas de las tiendas (puntos) dentro de cada zona (polígonos).
await IDEE.layer.Join.apply(capaZonas, capaTiendas, {
  mode: 'spatial',
  spatialPredicate: 'contains',
  cardinality: 'aggregate',
  aggregations: { ventas: 'sum', empleados: 'sum', id: 'count' },
  prefix: 'tot_'
});
```

### 9.3. Filtro semi/anti sin crear capa nueva

```javascript
// Deja en la capa base solo los municipios que NO están en la tabla de bajas.
await IDEE.layer.Join.apply(capaMunicipios, capaBajas, {
  key1: 'codigo_ine',
  key2: 'cod_mun',
  type: 'anti',
  inplace: true
});
```
