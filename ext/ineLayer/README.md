# ext/ineLayer — Leer el REST del INE y crear una capa `IDEE.layer.Alphanumeric`

Plugin/utilidad para consultar la **API JSON del INE** (Instituto Nacional de Estadística, base de datos Tempus3) y crear una capa alfanumérica (`IDEE.layer.Alphanumeric`) con los datos de una tabla de INEbase.

## Cómo obtener el identificador de la tabla

El servicio REST del INE se organiza por **tablas**. Cada tabla tiene un identificador numérico que es la clave de la petición.

### Opción A — Desde INEbase (navegador)

1. Entra en https://www.ine.es/dyngs/INEbase/ y busca la estadística que te interesa (p. ej. "Contabilidad Regional de España", "Padrón", "EPA").
2. Navega hasta la **tabla** concreta y pulsa en "Ver tabla" / "Exportar".
3. En la URL del navegador (o en el enlace "API Data Query" / "API JSON") aparece el identificador. Ejemplo:
   ```
   https://www.ine.es/jaxiT3/Tabla.htm?t=67301
   ```
   El número tras `t=` (aquí `67301`) es el identificador de la tabla.
4. También aparece en el bloque "Url de consulta" de la página "API Data Query":
   ```
   https://servicios.ine.es/wstempus/js/es/DATOS_TABLA/67301
   ```

### Opción B — Buscar programáticamente

La API ofrece buscadores:

- Tablas de una operación estadística:
  ```
  https://servicios.ine.es/wstempus/js/es/TABLAS_OPERACION/{codigoOperacion}
  ```
  (el código de operación se obtiene de `OPERACIONES_DISPONIBLES` o del catálogo de INEbase).

- Buscador de tablas por texto:
  ```
  https://servicios.ine.es/wstempus/js/es/BUSCADOR_TABLAS?texto={texto}
  ```

- Metadatos de una tabla (campos, variables, valores):
  ```
  https://servicios.ine.es/wstempus/js/es/METADATA_TABLA/{idTabla}
  ```

### Opción C — Desde la documentación OpenAPI

La documentación OpenAPI (Swagger UI) del INE está en:
https://servicios.ine.es/wstempus/js/es/ (y el portal https://www.ine.es/dyngs/DAB/).
Permite explorar todos los endpoints y obtener los identificadores.

## Uso básico

```javascript
// Descargar la tabla 67301 (Renta por CCAA) con los últimos 5 periodos
const capa = await window.INE.cargarTabla('67301', { nult: 5, name: 'Renta CCAA' });
capa.addTo(mapajs);

// O como factory estática
const capa2 = await IDEE.layer.Alphanumeric.fromINE('67301', { nult: 5, pivot: true });
```

## Parámetros de `cargarTabla(tablaId, opciones)`

| Opción | Tipo | Descripción |
|---|---|---|
| `nult` | number | Últimos N periodos a traer (se traduce a `?nult=N`). |
| `date` | string | Rango de fechas (formato del INE, ej. `20190101:20231231`). |
| `tip` | string | Tipo de dato: `'A'` (todos), `'M'` (modificados), `'T'` (último). |
| `det` | number | Nivel de detalle: `0`, `1` o `2`. |
| `tv` | string \| string[] | Filtros por variable: `"var:val"` o array de ellos. |
| `gv` | string | Filtro geográfico. |
| `series` | string \| RegExp \| array \| function | Filtra las series por nombre (cliente). |
| `columnas` | string[] | Conserva solo esas columnas en los registros (además de `serie`, `periodo`, `valor`, `secreto`). |
| `pivot` | boolean | Si es `true`, un registro por serie con una columna por periodo. |
| `name` / `legend` | string | Nombre/leyenda de la capa. |
| `idField` | string | Campo identificador de la capa alfanumérica. |

## Forma de los registros

Por defecto (forma larga), cada registro tiene:
```json
{ "serie": "Andalucía, RECURSOS: ...", "periodo": "2023 (P)", "valor": 36044969, "secreto": false }
```

Con `pivot: true`:
```json
{ "serie": "Andalucía, RECURSOS: ...", "2023 (P)": 36044969, "2022": 33978403, ... }
```

## Notas

- El servicio del INE permite CORS (`access-control-allow-origin: *`), así que la petición se hace directamente desde el navegador, sin proxy.
- Los valores secretos (`Secreto: true`) se convierten a `null` y se marca `secreto: true`.
- La capa resultante es `IDEE.layer.Alphanumeric` (sin geometría), apta para tablas, gráficos y joins por campo.