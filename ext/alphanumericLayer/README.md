# ext/alphanumericLayer (IDEE.layer.Alphanumeric)

Capa de datos **TEMÁTICOS SIN GEOMETRÍA** para el ecosistema de **API-IDEE / API-CNIG**.

Permite cargar, gestionar y consultar registros tabulares (procedentes de archivos CSV, JSON, GeoJSON, Excel/XLSX, o servicios externos como BigQuery o bases de datos) dentro de la arquitectura de la API. Es el contenedor de atributos unificado que utilizan otras herramientas de la galería para pintar tablas de atributos, generar gráficos estadísticos, realizar filtros complejos, o unir datos tabulares con capas vectoriales geográficas en tiempo de ejecución (mediante `joinLayer`).

---

## Características principales

- **Compatibilidad con el ciclo de vida de la API**: Implementa la interfaz y contrato de fachada mínimos que esperan las herramientas de la API (`type`, `name`, `legend`, `addTo`, `destroy`, `equals`, `getLegend`).
- **Registro propio en el mapa**: Se añade al mapa con `capa.addTo(mapajs)`. En lugar de mezclarse con las capas cartográficas visuales, se registra en un almacén específico consultable mediante `mapajs.getAlphanumericLayers()`, evitando sobrecargar el selector de capas visual.
- **Carga polivalente en constructor**: Admite datos de manera directa, asíncrona mediante URLs o a través de la propiedad `source` que autodetecta formatos (CSV string, JSON estructurado, array o GeoJSON).
- **Procesamiento de geometrías lat/lon, WKT o GeoJSON**: Si los registros contienen coordenadas, geometrías en formato WKT o GeoJSON, permite exportarse a un FeatureCollection estándar con el método `.toGeoJSON()`.

---

## Opciones del Constructor

```javascript
const capa = new IDEE.layer.Alphanumeric(options);
```

### Propiedades de `options`

| Parámetro | Tipo | Descripción |
|---|---|---|
| `name` | `string` | Nombre identificador de la capa. |
| `legend` | `string` | Nombre legible que se mostrará en las leyendas (por defecto hereda `name`). |
| `source` | `string` \| `Object` \| `Array` | Origen de los datos. Puede ser una cadena CSV, un array de objetos, un GeoJSON FeatureCollection, o un **objeto de configuración estructurado** (ver sección `source` estructurado abajo). |
| `url` | `string` | URL remota para descargar e inicializar el contenido de forma asíncrona y transparente. |
| `metadata` | `Object` | Objeto de metadatos libres adicionales. |

---

### Configuración Estructurada del parámetro `source`

En lugar de definir los metadatos de las columnas, coordenadas o identificadores en el constructor principal, se pueden encapsular de manera limpia dentro del propio objeto `source`:

```javascript
source: {
  data: ... // Los datos en crudo: CSV String, Array de objetos, JSON o GeoJSON FeatureCollection
  idField: 'campoId',         // Clave primaria identificadora de cada registro
  latField: 'campoLatitud',   // Campo de latitud (EPSG:4326)
  lonField: 'campoLongitud',  // Campo de longitud (EPSG:4326)
  xField: 'campoX',           // Campo de coordenada X proyectada
  yField: 'campoY',           // Campo de coordenada Y proyectada
  wktField: 'campoWkt',       // Campo de texto en formato WKT (Well-Known Text)
  geometryField: 'campoGeo',  // Campo con la geometría GeoJSON
  fields: [{ name, type }],   // Definición opcional de campos (infección automática por defecto)
  crs: 'EPSG:4326'            // Proyección cartográfica de origen (por defecto EPSG:4326)
}
```

---

## Ejemplos Prácticos de Uso

### 1. Carga de datos mediante `source` estructurado con un CSV

Encapsulamos la cadena CSV y los nombres de los campos de coordenadas y clave primaria dentro de un único objeto `source`:

```javascript
// Definimos los datos en formato CSV (texto plano)
const csvString = `id;nombre;poblacion;latitud;longitud
1;Cercedilla;7526;40.7388;-4.0628
2;Miraflores de la Sierra;6328;40.8143;-3.7681
3;Rascafría;1736;40.9056;-3.8781`;

// Instanciamos la capa alfanumérica pasando la configuración en el parámetro 'source'
const capaCSV = new IDEE.layer.Alphanumeric({
  name: 'municipios_sierra',
  legend: 'Municipios de la Sierra de Madrid',
  source: {
    data: csvString,
    idField: 'id',
    latField: 'latitud',
    lonField: 'longitud'
  }
});

// La añadimos al mapa
capaCSV.addTo(mapajs);

console.log(capaCSV.getRecords()); 
// Devuelve: [{ id: 1, nombre: "Cercedilla", poblacion: 7526, ... }, ...]
```

### 2. Carga de datos mediante `source` estructurado con un JSON

Admite tanto arrays directos de objetos, como estructuras de clave `records`, `data` o `rows`, e incluso colecciones de tipo **GeoJSON FeatureCollection**:

```javascript
// A. Array de registros pasados dentro de source.data
const capaJSON = new IDEE.layer.Alphanumeric({
  name: 'sensores_aire',
  legend: 'Sensores de Calidad del Aire',
  source: {
    data: [
      { id: 101, sensor: "Estación Norte", co2: 380.5, activo: true },
      { id: 102, sensor: "Estación Sur", co2: 412.3, activo: false }
    ],
    idField: 'id'
  }
});
capaJSON.addTo(mapajs);


// B. Array de registros planos con propiedad `geometry` (GeoJSON o WKT)
// Cada elemento tiene sus atributos en la raíz junto a la clave `geometry`:
const arrayLugares = [
  {
    nombre: "Madrid (Sol)",
    categoria: "Monumento",
    visitas: 4500,
    geometry: { type: "Point", coordinates: [-3.7037, 40.4167] }
  },
  {
    nombre: "Barcelona (Ramblas)",
    categoria: "Paseo",
    visitas: 3800,
    geometry: { type: "Point", coordinates: [2.1734, 41.3851] }
  },
  {
    nombre: "Valencia (Artes)",
    categoria: "Cultura",
    visitas: 2900,
    geometry: "POINT(-0.3547 39.4549)"
  }
];

const capaLugares = new IDEE.layer.Alphanumeric({
  name: 'lugares_interes',
  legend: 'Lugares de Interés',
  source: arrayLugares
});
capaLugares.addTo(mapajs);

// C. GeoJSON FeatureCollection
// Al pasar un GeoJSON en 'source.data', extrae las propiedades de cada feature automáticamente 
// y mapea la geometría a la propiedad de atributos '__idee_geojson' para posteriores uniones y mapas temáticos.
const geojsonSource = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "f1",
      geometry: { type: "Point", coordinates: [-3.703790, 40.416775] },
      properties: { nombre: "Puerta del Sol", categoria: "Monumento" }
    }
  ]
};

const capaGeoJSON = new IDEE.layer.Alphanumeric({
  name: 'lugares_sol',
  legend: 'Lugares de Interés',
  source: {
    data: geojsonSource
  }
});
capaGeoJSON.addTo(mapajs);
```

### 3. Carga asíncrona mediante el parámetro `url`

Al pasar el parámetro `url`, la capa gestiona automáticamente la descarga en segundo plano y asume el formato de datos basándose en la extensión del fichero (`.csv`, `.tsv`, `.json`, `.geojson`, `.xlsx`). Los parámetros de mapeo espacial se configuran de forma limpia en el constructor principal:

```javascript
const capaRemota = new IDEE.layer.Alphanumeric({
  name: 'datos_ine',
  legend: 'Estadísticas Municipales del INE',
  url: 'https://midominio.es/api/datos/poblacion.csv',
  idField: 'codigo_municipio'
});

capaRemota.addTo(mapajs);

// Al ser un proceso asíncrono, la capa expone la promesa '.ready'
capaRemota.ready.then((capaCargada) => {
  console.log('¡Datos cargados con éxito!', capaCargada.getRecords().length, 'registros.');
}).catch((error) => {
  console.error('Error en la descarga de la capa alfanumérica:', error);
});

// El mapa también dispara eventos globales del ciclo de vida al terminar la carga remota:
mapajs.on('alphanumeric:loaded', (capas) => {
  if (capas.includes(capaRemota)) {
    console.log('La capa remota del INE está completamente disponible en el mapa.');
  }
});
```

---

## Métodos Estáticos (Constructores Alternativos)

Si se prefiere una sintaxis funcional o se gestionan buffers binarios de datos (como Excel), se pueden instanciar utilizando los métodos estáticos del componente:

### `AlphanumericLayer.fromCSV(texto, opciones)`
Construye una capa procesando directamente un contenido CSV de texto.
```javascript
const capa = IDEE.layer.Alphanumeric.fromCSV("id;valor\n1;100", { name: "Mi CSV" });
```

### `AlphanumericLayer.fromJSON(datos, opciones)`
Construye una capa a partir de una cadena JSON o un objeto de Javascript (soporta GeoJSON, arrays o estructuras con propiedades).
```javascript
const capa = IDEE.layer.Alphanumeric.fromJSON(miObjetoJS, { name: "Mi JSON" });
```

### `AlphanumericLayer.fromXLSX(arrayBuffer, opciones)`
Método exclusivo para la lectura de hojas de cálculo binarias Excel (`.xlsx`, `.ods`, `.xlsm`). Requiere la carga previa de la biblioteca auxiliar `xlsx.js`.
```javascript
const capa = await IDEE.layer.Alphanumeric.fromXLSX(bufferExcel, { name: "Datos Excel" });
```

### `AlphanumericLayer.fromURL(url, opciones)`
Descarga y construye de forma asíncrona devolviendo una Promesa que resuelve la instancia de la capa.
```javascript
IDEE.layer.Alphanumeric.fromURL('https://datos.es/estaciones.geojson', { name: "Estaciones" })
  .then(capa => capa.addTo(mapajs));
```

---

## Cómo verla en el mapa

`IDEE.layer.Alphanumeric` es un contenedor de datos: `addTo(mapajs)` la registra en el mapa (`mapajs.getAlphanumericLayers()`) pero **no dibuja nada**, aunque los registros tengan coordenadas. Para pintarla hay que convertirla a GeoJSON y añadir una capa vectorial normal:

```javascript
const capaDatos = new IDEE.layer.Alphanumeric({
  name: 'municipios_sierra',
  legend: 'Municipios de la Sierra de Madrid',
  source: {
    data: csvString,
    idField: 'id',
    latField: 'latitud',
    lonField: 'longitud'
  }
});
capaDatos.addTo(mapajs); // solo registra los datos

const capaMapa = new IDEE.layer.GeoJSON({
  name: 'municipios_sierra_puntos',
  legend: 'Municipios de la Sierra de Madrid',
  source: capaDatos.toGeoJSON(),
  extract: true
}, {
  style: new IDEE.style.Generic({
    point: { radius: 7, fill: { color: '#0078d4' }, stroke: { color: '#ffffff', width: 2 } }
  })
});
mapajs.addLayers(capaMapa); // esto es lo que se ve
```

Si no hay coordenadas ni campo de geometría, `toGeoJSON()` devuelve una colección vacía: en ese caso la capa es solo para tablas, gráficos o uniones con `joinLayer`.
