# ext/ifcLayer: Capa IFC y BIM para Cesium (3D) y OpenLayers (2D)

Capa `IDEE.layer.IFC` (compatible con `IDEE.layer.Vector`) para cargar y georreferenciar modelos BIM (IFC), glTF/GLB y 3D Tiles en la API-IDEE / API-CNIG.

---

## 1. El Estándar IFC (Industry Foundation Classes)

**IFC (Industry Foundation Classes)** es el estándar abierto internacional (norma **ISO 16739-1**) desarrollado y mantenido por **buildingSMART International** para el intercambio de datos e interoperabilidad en la metodología BIM (*Building Information Modeling*).

### Versiones Principales del Estándar
- **IFC2x3** (ISO/PAS 16739): Ampliamente extendido en la industria de la edificación tradicional.
- **IFC4** (ISO 16739-1:2013/2018): Introduce mejoras sustanciales en geometría, compatibilidad con GIS y definición formal de georreferenciación proyectada.
- **IFC4.3** (ISO 16739-1:2024): Extensión a infraestructuras lineales y obra civil (*IFCRoad*, *IFCRail*, *IFCPorts*, *IFCWaterways*).

---

## 2. Georreferenciación en el Estándar IFC

La integración entre el mundo **BIM** (centrado en coordenadas locales de proyecto, alta precisión milimétrica y orientación relativa de edificación) y el mundo **SIG** (centrado en sistemas de referencia de coordenadas terrestres globales o proyectados) es uno de los pilares del estándar IFC.

Existen **dos mecanismos principales de georreferenciación** según el esquema y la versión del estándar:

### A. Georreferenciación Geográfica Nativa en `IfcSite` (IFC2x3 e IFC4)
En modelos IFC2x3 e IFC4 convencionales, la ubicación geográfica del emplazamiento se define en la entidad `IfcSite`:
- **`RefLatitude`** y **`RefLongitude`**: Coordenadas geográficas (latitud y longitud) en el elipsoide WGS84, codificadas en el estándar STEP (ISO 10303-21) como listas de cuatro enteros en formato sexagesimal **(grados, minutos, segundos, microsegundos)**:
  - Formato STEP: `IFCSITE(..., (lat_deg, lat_min, lat_sec, lat_micro), (lon_deg, lon_min, lon_sec, lon_micro), RefElevation, ...)`
  - *Ejemplo*: `(40, 24, 59, 120000)` $\rightarrow 40^\circ 24' 59.12''$ N.
- **`RefElevation`**: Cota ortométrica o elipsoidal en metros de la cota cero del emplazamiento.
- **`TrueNorth`** (en `IfcGeometricRepresentationContext`): Vector 2D (`DirectionRatios`) que define la dirección del Norte Verdadero respecto al eje $Y$ local del proyecto.

### B. Georreferenciación Proyectada con `IfcMapConversion` e `IfcProjectedCRS` (IFC4 / IFC4.3)
A partir de **IFC4**, buildingSMART definió la forma estandarizada y matemáticamente rigurosa para convertir las coordenadas locales de diseño (Engineering Coordinate Reference System - *Local CRS*) a coordenadas cartográficas proyectadas (Map CRS) de un sistema de referencia oficial (como UTM ETRS89 o EPSG:25830):

```
       Local CRS (x, y, z)
                │
                ▼  (Escala, Rotación y Traslación)
         IfcMapConversion
                │
                ▼
   IfcProjectedCRS (EPSG / Map Coordinates)
```

1. **`IfcProjectedCRS`**: Declara el sistema de proyección de destino mediante:
   - `Name`: Código EPSG o identificador oficial (ej. `"EPSG:25830"` o `"ETRS89 / UTM zone 30N"`).
   - `GeodeticDatum`: Datum geodésico (ej. `"ETRS89"` o `"WGS84"`).
   - `MapProjection`: Nombre de la proyección cartográfica (ej. `"Transverse Mercator"`).
   - `MapZone`: Huso o zona cartográfica (ej. `"30"`).
   - `MapUnit`: Unidad de medida de la proyección (`IfcSIUnit` o `IfcConversionBasedUnit`, típicamente metros).

2. **`IfcMapConversion`**: Define la transformación afín entre el sistema de coordenadas local del proyecto (`SourceCRS`) y el sistema cartográfico proyectado (`TargetCRS`):
   - **`Eastings`**: Coordenada X (Este) de la proyección cartográfica donde se sitúa el origen $(0,0,0)$ local.
   - **`Northings`**: Coordenada Y (Norte) de la proyección cartográfica donde se sitúa el origen $(0,0,0)$ local.
   - **`OrthogonalHeight`**: Cota H ortométrica donde se sitúa el origen local.
   - **`XAxisAbscissa`** y **`XAxisOrdinate`**: Coseno director y seno director que definen la rotación del eje $X$ local en el plano cartográfico (convergencia de meridianos + orientación de diseño).
   - **`Scale`**: Factor de escala para corregir la deformación lineal de la proyección cartográfica (o `1.0` por defecto).

### Jerarquía Espacial de Colocación en IFC
Los elementos individuales del modelo (`IfcWall`, `IfcColumn`, `IfcBeam`, etc.) no tienen coordenadas geográficas absolutas directas, sino que heredan su posición mediante una cadena jerárquica de `IfcLocalPlacement`:

$$\text{IfcProject} \longrightarrow \text{IfcSite} \longrightarrow \text{IfcBuilding} \longrightarrow \text{IfcBuildingStorey} \longrightarrow \text{IfcProduct (Elemento)}$$

Cada entidad define una matriz o transformación relativa (`RelativePlacement`) respecto al contenedor padre (`PlacementRelTo`), permitiendo situar todo el edificio trasladando únicamente el origen del `IfcSite`.

---

## 3. Ejemplos de Archivos IFC con Georreferenciación Estándar

A continuación se presentan los ejemplos oficiales de la sintaxis STEP (ISO 10303-21) para los métodos de georreferenciación estándar:

### Ejemplo 1: Georreferenciación Proyectada Oficial de buildingSMART (`UT_GeoRef_1.ifc`)
*Escenario canónico de pruebas `UT_GeoRef_1.ifc` del grupo de trabajo de infraestructuras de buildingSMART International (IFC4 / IFC4.3)*:

```step21
ISO-10303-21;

/* ------- This file was produced manually for IFC Infra Extension Deployment project. --------- */
/* ------- Stefan Jaud, stefan.jaud@tum.de, 2020.07.27. ---------------------------------------- */

HEADER;
FILE_DESCRIPTION (('ViewDefinition [Ifc4X3NotAssigned]'), '2;1');
FILE_NAME ('UT_GeoRef_1.ifc', '2020-07-27T12:00:00', ('Stefan Jaud'), ('bSI Infra Extension Deployment project'), 'manual text editing', 'SublimeText 3.0', 'GitHub pull request');
FILE_SCHEMA (('IFC4X3_RC2'));
ENDSEC;

DATA;

/* ------- UT ProjectSetup_1 ------------------------------------------------------------------- */
#1 = IFCDIMENSIONALEXPONENTS(0, 0, 0, 0, 0, 0, 0);
#2 = IFCDIRECTION((1., 0., 0.));
#3 = IFCDIRECTION((0., 1., 0.));
#4 = IFCDIRECTION((0., 0., 1.));
#5 = IFCCARTESIANPOINT((0., 0., 0.));
#16 = IFCPROJECT('2DAvEupIz0HQr73cMaawtY', $, 'GeoRef_1', 'The bare minimum of an IFC file exchange with only georeferencing meta data.', $, $, $, (#28), #17);
#17 = IFCUNITASSIGNMENT((#18, #19, #20, #24, #25, #26, #27));
#18 = IFCSIUNIT(*, .LENGTHUNIT., $, .METRE.);
#19 = IFCSIUNIT(*, .AREAUNIT., $, .SQUARE_METRE.);
#20 = IFCSIUNIT(*, .VOLUMEUNIT., $, .CUBIC_METRE.);
#22 = IFCSIUNIT(*, .PLANEANGLEUNIT., $, .RADIAN.);
#23 = IFCMEASUREWITHUNIT(IFCPLANEANGLEMEASURE(0.017453292519943295), #22);
#24 = IFCCONVERSIONBASEDUNIT(#1, .PLANEANGLEUNIT., 'degree', #23);
#25 = IFCSIUNIT(*, .MASSUNIT., .KILO., .GRAM.);
#26 = IFCSIUNIT(*, .TIMEUNIT., $, .SECOND.);
#27 = IFCMONETARYUNIT('EUR');
#28 = IFCGEOMETRICREPRESENTATIONCONTEXT($, 'Model', 3, 1.E-6, #29, #54);
#29 = IFCAXIS2PLACEMENT3D(#5, #4, #2);

/* ------- UT GeoRef_1 ------------------------------------------------------------------------- */
/* ------- ProjectedCRS provides information about the underlying geodetic coordinate reference  */
#30 = IFCPROJECTEDCRS('EPSG:5834', 'DB_REF / 3-degree Gauss-Kruger zone 4 (E-N) + DHHN92 height', 'EPSG:5684', 'EPSG:5783', 'Gauss-Kruger', '4', #18);

/* ------- MapConversion provides information about the global-to-local transformation --------- */
#31 = IFCMAPCONVERSION(#28, #30, 4468005., 5334600., 515., 1., 0., 1.);

/* ------- UT Tin_1 ---------------------------------------------------------------------------- */
#32 = IFCSITE('27H$neCQf1NwtmczxBInPR', $, $, $, $, #33, #40, $, .ELEMENT., $, $, $, $, $);
#33 = IFCLOCALPLACEMENT($, #29);
#35 = IFCRELAGGREGATES('3Hu7f6BmT14B_XS9yS78Jr', $, $, $, #16, (#32));

/* TrueNorth en el plano 2D */
#54 = IFCDIRECTION((0., 1.));

ENDSEC;
END-ISO-10303-21;
```

---

## 4. Fuentes de Modelos IFC Georreferenciados en España

En España existen diversas iniciativas institucionales y conjuntos de datos abiertos donde descargar modelos IFC georreferenciados con sistemas de coordenadas oficiales (**ETRS89 / UTM huso 30N o 31N**):

### A. Modelos BIM del Territorio del Área Metropolitana de Barcelona (AMB / ICGC)
- **Descripción**: La Sección de Cartografía y la Oficina BIM del Área Metropolitana de Barcelona (AMB) publican modelos BIM en formato **IFC (IFC 2x3 e IFC 4)** derivados del Mapa Topográfico Metropolitano 1:1.000 (MTM-1M).
- **Georreferenciación**: Modelos orientados en el sistema **ETRS89 / UTM huso 31N (EPSG:25831)** y altitudes referenciadas a la red oficial. Incluyen volumetría 3D de edificios (`IfcBuilding`), terreno (`IfcSite`), calzadas, aceras y mobiliario urbano/arbolado estructurados por `IfcBuildingStorey`.
- **Acceso y descarga**:
  - [Geoportal de Cartografía del AMB (Modelos 3D / BIM)](https://geoportalcartografia.amb.cat/AppGeoportalCartografia2/?Categoria=Models3D&Producte=57)
  - [Visor de descargas del ICGC (Institut Cartogràfic i Geològic de Catalunya)](https://visors.icgc.cat/appdownloads)
  - Reseña técnica: [Blog IDEE - Modelos BIM del Área Metropolitana de Barcelona](https://blog-idee.blogspot.com/2023/04/modelos-bim-del-area-metropolitana-de.html)

### B. Geoportales y Repositorios Abiertos con IFC Georreferenciados
- **Ayuntamiento de Madrid**: Modelos BIM de infraestructuras y túneles integrados en el visor cartográfico municipal y exportables en formato IFC sobre **EPSG:25830 (ETRS89 / UTM huso 30N)**.
- **buildingSMART Spanish Chapter**: Guías de aplicación de georreferenciación en proyectos de licitación pública BIM (según el Plan BIM del Ministerio de Transportes y Movilidad Sostenible).

---

## 5. Estrategias de Visualización de IFC en Cesium (3D)

Cesium es un motor geoespacial 3D centrado en estándares abiertos (OGC, Khronos Group, buildingSMART). Actualmente existen **3 vías principales** para visualizar modelos IFC/BIM sobre Cesium:

### A. OGC 3D Tiles (`Cesium.Cesium3DTileset`) — *El estándar para grandes desarrollos BIM/GIS*
- **Cómo funciona**: El fichero `.ifc` se pre-procesa en servidor (utilizando herramientas como Cesium ion, *IfcOpenShell + py3dtiles*, FME o pipelines serverless) generando un árbol jerárquico espacial de teselas (B3DM o 3D Tiles 1.1 con *Property Tables*).
- **Ventajas**:
  - **Streaming masivo con LOD** (Level of Detail): Permite visualizar edificios completos o ciudades con millones de polígonos sin saturar la memoria del navegador.
  - **Consultas semánticas BIM**: Soporta tablas de propiedades asociadas a cada elemento (`IfcWall`, `IfcWindow`, materiales, propiedades térmicas, identificadores GUID).
  - **Estilizado dinámico**: Filtrado y coloreado instantáneo mediante `Cesium3DTileStyle`.
- **Casos de uso**: Grandes infraestructuras, gemelos digitales urbanos, proyectos federados multidisciplinares.

### B. glTF / GLB 2.0 (`Cesium.Model.fromGltfAsync`) — *Rendimiento nativo GPU para modelos aislados*
- **Cómo funciona**: El IFC se convierte a un binario `.glb` (o se genera en memoria) y se sitúa en el globo con matrices geográficas (`Transforms.headingPitchRollToFixedFrame`).
- **Ventajas**:
  - Renderizado PBR (Physically Based Rendering) completo con materiales estándar (Roughness, Metallic, transparencia BLEND/OPAQUE).
  - Shaders optimizados, iluminación solar real y sombras arrojadas de Cesium.
  - Control de opacidad dinámico en tiempo real (`colorBlendMode`).
- **Casos de uso**: Modelos individuales de edificación, arquitectura de detalle, visualización rápida sin infraestructura de teselado.

### C. Procesamiento Directo en Cliente con WebAssembly (`web-ifc` / That Open Company)
- **Cómo funciona**: El navegador descarga el archivo `.ifc` original y el motor C++ compilado a WebAssembly (`web-ifc`) procesa las operaciones booleanas/CSG y mallas en cliente.
- **Técnicas de integración en Cesium**:
  1. **Generación directa de GLB en memoria (Enfoque `ext/ifcLayer`)**: Extrae en un solo pase la georreferenciación (`IfcSite` / `IfcMapConversion`), geometrías, normales reales y materiales, empaquetándolos en un buffer GLB 2.0 binario que Cesium procesa con su pipeline PBR.
  2. **Desglose por plantas y categorías en Entidades Cesium**: Desglosa el IFC en sub-mallas por categoría (`IfcWall`, `IfcSlab`, `IfcWindow`) y planta (`levelName`), permitiendo selección e interacción elemento a elemento.

---

## 4. Uso en la API-IDEE

```js
const capaIFC = new IDEE.layer.IFC({
  url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/master/Ifc2x3_Duplex_Architecture.ifc',
  name: 'Duplex_Apartment_IFC',
  legend: 'Duplex Apartment - Modelo BIM (IFC)',
  
  // Georreferenciación completa con coordenadas, giros (heading/pitch/roll) y escala:
  // (En archivos IFC con IfcSite/IfcMapConversion la posición se extrae automáticamente)
  position: {
    lon: -87.6394,
    lat: 41.8744,
    height: 180,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
  },
  
  clampToGround: true,    // Ajustar al terreno en Cesium
  visible: true,          // Visibilidad inicial
  opacity: 1,             // Opacidad inicial (0 a 1)
}, {
  style: new IDEE.style.Generic({
    polygon: {
      fill: { color: '#0284c7', opacity: 0.35 },
      stroke: { color: '#0369a1', width: 2 },
    },
  }),
});

mapajs.addLayers(capaIFC);
```

---

## 5. Comportamiento 2D / 3D

- **En 2D (OpenLayers)**:
  - Lee la georreferenciación (`position`, `IfcSite` o `IfcMapConversion`) y las dimensiones calculadas del modelo para proyectar la huella poligonal exacta en EPSG:3857.
  - Ofrece metadatos en las propiedades de la entidad (huella, coordenadas, enlace de descarga).
- **En 3D (Cesium)**:
  - Carga el recurso 3D con orientación, sombras y materiales PBR.
  - Vuela suavemente a la posición del modelo al activarse.
- **Cambio 2D/3D (`cambioImpl`)**:
  - Implementa el contrato `getState()` y `setState()` compatible con `window.EstadoPlugins`, conservando posición, visibilidad, orientación y opacidad tras alternar de vista.

---

## 6. Referencias y Documentación Técnica

- **buildingSMART IFC Georeferencing Guide**: [https://technical.buildingsmart.org/resources/ifc-georeferencing-guide/](https://technical.buildingsmart.org/resources/ifc-georeferencing-guide/)
- **buildingSMART Standards Documentation (IFC 4.3 / 4.0 / 2x3)**: [https://standards.buildingsmart.org/](https://standards.buildingsmart.org/)
- **Geoportal de Cartografia del AMB**: [https://geoportalcartografia.amb.cat](https://geoportalcartografia.amb.cat)
- **Uzufly `showcase-cesium-ifc` / `cesium-ifc-viewer`**: [https://github.com/uzufly/showcase-cesium-ifc](https://github.com/uzufly/showcase-cesium-ifc)
- **Motor Web-IFC (That Open Company / IFC.js)**: [https://github.com/ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc)
- **Cesium 3D Tiles Specification**: [https://github.com/CesiumGS/3d-tiles](https://github.com/CesiumGS/3d-tiles)
- **glTF 2.0 Specification (Khronos Group)**: [https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
