
function parseCSV(csvString) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvString.length; i++) {
        const char = csvString[i];
        const nextChar = csvString[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                // Handle escaped quotes
                currentField += '"';
                i++; // Skip the next quote
            } else if (char === '"') {
                // End of quoted field
                inQuotes = false;
            } else {
                // Add character to field
                currentField += char;
            }
        } else {
            if (char === '"') {
                // Start of quoted field
                inQuotes = true;
            } else if (char === ',') {
                // End of field
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n') {
                // End of row
                currentRow.push(currentField);
                rows.push(currentRow[0]);
                currentRow = [];
                currentField = '';
            } else {
                // Add character to field
                currentField += char;
            }
        }
    }

    // Add the last field and row if present
    if (currentField || currentRow.length) {
        currentRow.push(currentField);
        rows.push(currentRow[0]);
    }

    return rows;
}


/**
 * Convierte una cadena CSV en un objeto JSON.
 * 
 * @param {string} csvString - La cadena CSV que contiene los datos a convertir.
 * @param {string|boolean} [id=false] - El nombre de la columna que se usará como ID único. Si es `false`, se genera un array de objetos.
 * @returns {Object|Array} Un objeto JSON con los datos. Si se especifica un `id`, devuelve un objeto con claves de ID; de lo contrario, devuelve un array de objetos.
 * 
 * @example
 * const csvData = "id;name;age\n1;John;30\n2;Jane;25";
 * const jsonData = csvToJson(csvData, 'id');
 * console.log(jsonData);
 * 
 * const csvData = "id;name;age\n1;John;30\n2;Jane;25";
 * const jsonData = csvToJson(csvData, 'id');
 * console.log(jsonData);
 * // Salida esperada: { "1": { id: "1", name: "John", age: "30" }, "2": { id: "2", name: "Jane", age: "25" } }
 * 
 * 
 * const csvDataNoId = "name;age\nJohn;30\nJane;25";
 * const jsonDataNoId = csvToJson(csvDataNoId);
 * console.log(jsonDataNoId);
 * // Salida esperada: [ { name: "John", age: "30" }, { name: "Jane", age: "25" } ]
 */
function csvToJson(csvString, id = false) {
    const rows = csvString.split("\n");
    const headers = rows[0].split(";").map(h => h.trim());

    const jsonData = id ? {} : [];

    for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(";").map(v => v.trim());

        // Validar si la fila tiene el mismo número de valores que los encabezados
        if (values.length !== headers.length) {
            console.warn(`Fila ${i} no tiene el mismo número de valores que los encabezados. Se omite.`);
            continue;
        }

        const obj = {};
        let idKey = null;

        for (let j = 0; j < headers.length; j++) {
            const key = headers[j];
            const value = values[j];

            obj[key] = value;

            if (id && key === id) {
                idKey = value; // Guardar el valor del campo que actúa como ID
            }
        }

        if (id && idKey) {
            jsonData[idKey] = obj; // Asignar el objeto con el valor del campo ID como clave
        } else {
            jsonData.push(obj); // Agregar el objeto al array
        }
    }

    return jsonData;
}


/**
 * Convierte una cadena CSV en un objeto GeoJSON.
 * 
 * @param {string} csvString - La cadena CSV que contiene los datos a convertir.
 * @param {string} [long="long"] - El nombre de la columna que contiene la longitud (eje X).
 * @param {string} [lat="lat"] - El nombre de la columna que contiene la latitud (eje Y).
 * @param {string|boolean} [WKT=false] - El nombre de la columna que contiene datos en formato WKT (Well-Known Text). Si es `false`, se usan las columnas de longitud y latitud.
 * @returns {Object} Un objeto GeoJSON con la información del CSV.
 * 
 * @example
 * const csvData = "name;long;lat\nPoint A;-73.935242;40.730610";
 * const geoJson = csvToGeoJson(csvData);
 * console.log(geoJson);
 */
function csvToGeoJson({csvString, long = "long", lat = "lat", WKT = false, advancedParse = false}) {
    
    if (advancedParse){
        rows = parseCSV(csvString)
        headers = rows[0].split(";").map(h => h.trim());
        
    
    } else {
        rows = csvString.split("\n")
        headers = rows[0].split(";").map(h => h.trim());
    }
        


    const geojsonData = {
        type: "FeatureCollection",
        features: []
    };

    for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(";").map(v => v.trim());

        if (values.length !== headers.length) {
            console.warn(`Fila ${i} no coincide con los encabezados`);
            continue; // Ignorar filas mal formateadas
        }

        const feature = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Point",
                coordinates: []
            }
        };

        let geojsonLong = null, geojsonLat = null;

        for (let j = 0; j < headers.length; j++) {
            const key = headers[j];
            const value = values[j];

            if (WKT && key === WKT) {
                feature.geometry = WKTToGeoJson(value);
            } else {
                if (key === long) {
                    geojsonLong = parseFloat(value.replace(",", "."));
                } else if (key === lat) {
                    geojsonLat = parseFloat(value.replace(",", "."));
                } else {
                    feature.properties[key] = value;
                }
            }
        }

        if (!WKT) {
            if (isFinite(geojsonLong) && isFinite(geojsonLat)) {
                feature.geometry.coordinates = [geojsonLong, geojsonLat];
            } else {
                console.warn(`Coordenadas inválidas en fila ${i}`);
                continue; // Ignorar si las coordenadas no son válidas
            }
        }

        geojsonData.features.push(feature);
    }

    return geojsonData;
}

/**
 * Convierte una cadena en formato WKT a un objeto GeoJSON.
 * 
 * @param {string} wktString - La cadena WKT que representa un objeto geométrico.
 * @returns {Object} Un objeto GeoJSON equivalente a la geometría del WKT.
 * 
 * @example
 * const wkt = "POINT(-73.935242 40.730610)";
 * const geoJson = WKTToGeoJson(wkt);
 * console.log(geoJson);
 */
function WKTToGeoJson(wktString) {
    // Extraer el tipo de geometría (ej: POINT, LINESTRING, etc.)
    const geometryType = wktString.match(/^[A-Z]+/)[0];
    
    // Extraer las coordenadas
    const coordinatesString = wktString.match(/\((.+)\)/)[1];
    let coordinates;

    switch (geometryType) {
        case "POINT":
            coordinates = coordinatesString
                .split(" ")
                .map(Number);
            return {
                type: "Point",
                coordinates: coordinates
            };

        case "LINESTRING":
            coordinates = coordinatesString
                .split(",")
                .map(coord => coord.trim().split(" ").map(Number));
            return {
                type: "LineString",
                coordinates: coordinates
            };

        case "POLYGON":
            coordinates = coordinatesString
                .split("),(") // Divide en cada anillo exterior/interior
                .map(ring => ring.replace(/[()]/g, "").split(",").map(coord => coord.trim().split(" ").map(Number)));
            return {
                type: "Polygon",
                coordinates: coordinates
            };

        case "MULTIPOINT":
            coordinates = coordinatesString
                .split(",")
                .map(coord => coord.trim().split(" ").map(Number));
            return {
                type: "MultiPoint",
                coordinates: coordinates
            };

        case "MULTILINESTRING":
            coordinates = coordinatesString
                .split("),(")
                .map(line => line.replace(/[()]/g, "").split(",").map(coord => coord.trim().split(" ").map(Number)));
            return {
                type: "MultiLineString",
                coordinates: coordinates
            };

        case "MULTIPOLYGON":
            coordinates = coordinatesString
                .split(")),((") // Divide en polígonos
                .map(polygon => polygon.replace(/[()]/g, "").split("),(").map(ring => ring.split(",").map(coord => coord.trim().split(" ").map(Number))));
            return {
                type: "MultiPolygon",
                coordinates: coordinates
            };

        default:
            throw new Error(`Tipo de geometría no soportado: ${geometryType}`);
    }
}

/**
 * Convierte un array de objetos JSON a un objeto GeoJSON de tipo FeatureCollection.
 *
 * @param {Array<Object>} jsonArray - Array de objetos JSON que contiene los datos a convertir a GeoJSON.
 * @param {string} latKey - Nombre de la propiedad en los objetos JSON que contiene la latitud.
 * @param {string} lonKey - Nombre de la propiedad en los objetos JSON que contiene la longitud.
 * @returns {Object} Un objeto GeoJSON de tipo FeatureCollection con cada elemento del array como una Feature.
 *
 * @example
 * const jsonArray = [
 *   { id: "A", name: "Location1", latitude: 0, longitude: 0, population: 500 },
 *   { id: "B", name: "Location2", latitude: 1, longitude: 1, population: 1000 }
 * ];
 * 
 * const geoJson = jsonToGeoJson_fromLongLat(jsonArray, 'latitude', 'longitude');
 * // Resultado esperado:
 * // {
 * //   type: "FeatureCollection",
 * //   features: [
 * //     { type: "Feature", properties: { id: "A", name: "Location1", population: 500 }, geometry: { type: "Point", coordinates: [0, 0] } },
 * //     { type: "Feature", properties: { id: "B", name: "Location2", population: 1000 }, geometry: { type: "Point", coordinates: [1, 1] } }
 * //   ]
 * // }
 */
function jsonToGeoJson_fromLongLat(jsonArray, lonKey, latKey) {
    return {
        type: "FeatureCollection",
        features: jsonArray.map(item => {
            const { [latKey]: lat, [lonKey]: lon, ...properties } = item;
            return {
                type: "Feature",
                properties: properties,
                geometry: {
                    type: "Point",
                    coordinates: [lon, lat]
                }
            };
        })
    };
}





/**
 * Convierte un array de objetos JSON en un GeoJSON de tipo FeatureCollection.
 *
 * @param {Object[]} jsonArray - Array de objetos JSON que contienen datos geoespaciales.
 * @param {string} geometryField - Nombre del campo que contiene la geometría en formato GeoJSON.
 * @returns {Object} Un objeto GeoJSON de tipo FeatureCollection.
 *
 * @example
 * const data = [
 *   {
 *     id: 1,
 *     name: "Punto A",
 *     geometry: { type: "Point", coordinates: [40.4168, -3.7038] }
 *   },
 *   {
 *     id: 2,
 *     name: "Punto B",
 *     geometry: { type: "Point", coordinates: [40.4178, -3.7048] }
 *   }
 * ];
 * 
 * const geojson = jsonToGeoJson(data, "geometry");
 * console.log(geojson);
 * 
 * // Salida:
 * // {
 * //   "type": "FeatureCollection",
 * //   "features": [
 * //     {
 * //       "type": "Feature",
 * //       "properties": { "id": 1, "name": "Punto A" },
 * //       "geometry": { "type": "Point", "coordinates": [40.4168, -3.7038] }
 * //     },
 * //     {
 * //       "type": "Feature",
 * //       "properties": { "id": 2, "name": "Punto B" },
 * //       "geometry": { "type": "Point", "coordinates": [40.4178, -3.7048] }
 * //     }
 * //   ]
 * // }
 */
function jsonToGeoJson(jsonArray, geometryField) {
    return {
      type: "FeatureCollection",
      features: jsonArray.map(item => {
        const geometryGJSON = item[geometryField]
        // Desestructuramos item y excluimos geometry
        const { geometry: _, ...properties } = item; // _ se usa para ignorar la propiedad geometry
        return {
          type: "Feature",
          properties: properties, // Solo las propiedades sin geometry
          geometry: geometryGJSON // Se asigna el geometry que se pasa como argumento
        };
      })
    };
  }


/**
 * Convierte un SVG en formato de texto en un objeto GeoJSON.
 *
 * @param {string} svgText - El SVG en formato de texto.
 * @param {Array} bbox - La extensión geográfica [minLng, minLat, maxLng, maxLat].
 * @returns {Object} - El objeto en formato GeoJSON.
 */

function svgToGeoJSON(svgInput, bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  // 1) Aceptar tanto texto SVG como elemento <svg>
  let svgEl;
  if (typeof svgInput === 'string') {
    const doc = new DOMParser().parseFromString(svgInput, 'image/svg+xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('Error al parsear SVG: ' + (err.textContent || '').trim());
    svgEl = doc.documentElement;
  } else if (
    svgInput &&
    svgInput.nodeType === 1 && // Nodo elemento
    String(svgInput.tagName).toLowerCase() === 'svg'
  ) {
    svgEl = svgInput;
  } else {
    throw new Error('svgInput debe ser texto SVG o un elemento <svg> válido.');
  }

  // 2) Obtener viewBox (incluyendo offset x/y). Fallback a width/height o getBBox.
  const vb = svgEl.viewBox?.baseVal;
  let vbX = vb ? vb.x : 0;
  let vbY = vb ? vb.y : 0;
  let vbW = vb ? vb.width : parseFloat(svgEl.getAttribute('width') || svgEl.clientWidth || 0);
  let vbH = vb ? vb.height : parseFloat(svgEl.getAttribute('height') || svgEl.clientHeight || 0);

  if (!vbW || !vbH) {
    // Si faltan dimensiones, intentamos con getBBox (puede fallar si no está en árbol renderizable)
    try {
      const b = svgEl.getBBox();
      vbX = b.x; vbY = b.y; vbW = b.width; vbH = b.height;
      // Opcional: fijar viewBox para consistencia
      svgEl.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    } catch (e) {
      throw new Error('No se pudieron determinar las dimensiones del SVG (viewBox/width/height/getBBox).');
    }
  }

  // 3) Escalas (teniendo en cuenta el offset del viewBox)
  const scaleX = x => minLng + ((x - vbX) / vbW) * (maxLng - minLng);
  const scaleY = y => maxLat - ((y - vbY) / vbH) * (maxLat - minLat); // invertimos Y

  // 4) Recorrer paths y construir GeoJSON
  const features = [];
  const paths = svgEl.querySelectorAll('path');

  paths.forEach(path => {
    const d = path.getAttribute('d');
    if (!d) return;

    const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    let x = 0, y = 0;
    const points = [];

    commands.forEach(cmd => {
      const type = cmd[0]; // respetamos mayúsc/minúsc
      const nums = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);

      switch (type) {
        // Absolutos
        case 'M':
        case 'L': {
          for (let i = 0; i < nums.length; i += 2) {
            x = nums[i];
            y = nums[i + 1];
            points.push([scaleX(x), scaleY(y)]);
          }
          break;
        }
        case 'H': {
          nums.forEach(nx => { x = nx; points.push([scaleX(x), scaleY(y)]); });
          break;
        }
        case 'V': {
          nums.forEach(ny => { y = ny; points.push([scaleX(x), scaleY(y)]); });
          break;
        }

        // Relativos
        case 'm':
        case 'l': {
          for (let i = 0; i < nums.length; i += 2) {
            x += nums[i];
            y += nums[i + 1];
            points.push([scaleX(x), scaleY(y)]);
          }
          break;
        }
        case 'h': {
          nums.forEach(nx => { x += nx; points.push([scaleX(x), scaleY(y)]); });
          break;
        }
        case 'v': {
          nums.forEach(ny => { y += ny; points.push([scaleX(x), scaleY(y)]); });
          break;
        }

        // Cierre
        case 'Z':
        case 'z': {
          if (points.length > 0) points.push(points[0]);
          break;
        }

        // Curvas: muestreo del path
        default: {
          const len = path.getTotalLength?.();
          if (typeof len === 'number' && len > 0) {
            for (let i = 0; i <= len; i++) {
              const pt = path.getPointAtLength(i);
              points.push([scaleX(pt.x), scaleY(pt.y)]);
            }
          } else {
            console.warn(`Comando ${type} no soportado; se omite.`);
          }
          break;
        }
      }
    });

    if (points.length > 0) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [points] },
        properties: { id: path.id || null }
      });
    }
  });

  return { type: 'FeatureCollection', features };
}



/**
 * Convierte un JSON-LD a un GeoJSON válido.
 * 
 * El JSON-LD debe tener un campo `@graph` que contenga los datos. El parámetro `confJSON_LD` especifica 
 * el tipo de geometría, el campo de las coordenadas dentro de `@graph`, y los nombres de los subcampos 
 * que contienen la latitud y longitud.
 * 
 * @param {Object} jsonLd - El objeto JSON-LD a convertir.
 * @param {Object} confJSON_LD - Un objeto con el tipo de geometría, el campo de coordenadas y los subcampos de latitud y longitud.
 * @param {string} confJSON_LD.type - El tipo de geometría (por ejemplo, "Point", "LineString", "Polygon").
 * @param {string} confJSON_LD.field - El nombre del campo dentro de `@graph` que contiene las coordenadas.
 * @param {string} confJSON_LD.lat - El subcampo para la latitud (por defecto "latitude").
 * @param {string} confJSON_LD.long - El subcampo para la longitud (por defecto "longitude").
 * @returns {Object} - Un objeto GeoJSON válido.
 * @throws {Error} Si el formato del JSON-LD no es válido o faltan datos.
 */
function convertJsonLdToGeoJson(jsonLd, confJSON_LD) {
    // Validar que el JSON-LD contiene el campo @graph
    if (!jsonLd || !Array.isArray(jsonLd["@graph"])) {
        throw new Error('El JSON-LD debe contener un campo "@graph" con un array de datos.');
    }

    // Validar que confJSON_LD tenga los parámetros esperados
    if (!confJSON_LD || !confJSON_LD.type || !confJSON_LD.field) {
        throw new Error('El parámetro confJSON_LD debe contener "type" y "field".');
    }

    // Si el tipo es "Point", validar que existan latitud y longitud
    if (confJSON_LD.type === "Point" && (!confJSON_LD.lat || !confJSON_LD.long)) {
        throw new Error('Para el tipo "Point", confJSON_LD debe contener "lat" y "long".');
    }

    // Convertir cada elemento del @graph a un feature GeoJSON
    const features = jsonLd["@graph"].map(item => {
        // console.log(item)
        const geometryData = item[confJSON_LD.field];
        
        // Si las coordenadas no existen, se ignoran este elemento y se sigue con el siguiente
        if (!geometryData || geometryData[confJSON_LD.lat] == null || geometryData[confJSON_LD.long] == null) {
            console.warn(`Coordenadas faltantes para el campo "${confJSON_LD.field}" en el elemento con ID "${item["@id"]}". Se ignorará este elemento.`);
            return null;  // Retorna null para este elemento y se ignorará en el resultado final
        }

        // Crear el Feature con la geometría correspondiente
        const geometry = {
            type: confJSON_LD.type,
            coordinates: [geometryData[confJSON_LD.long], geometryData[confJSON_LD.lat]]
        };

        // Crear un feature GeoJSON
        return {
            type: "Feature",
            geometry,
            properties: Object.fromEntries(
                Object.entries(item).filter(([key]) => key !== confJSON_LD.field)
            )
        };
    });

    // Retornar el GeoJSON
    return {
        type: "FeatureCollection",
        features: features.filter(item => item !== null)
    };
}



/**
 * Convierte una coordenada en formato grados, minutos y segundos (GMS) a grados decimales (DD).
 *
 * @param {string} gms - La coordenada en formato "GG°MM'SS,S\"[N|S|E|W]".
 * @returns {number} La coordenada convertida a grados decimales.
 *
 * @example
 * // Convertir una latitud en formato GMS a decimal
 * const lat = convertGmsToDecimal("40°28'45,0\"N");
 * console.log(lat); // 40.479167
 *
 * // Convertir una longitud en formato GMS a decimal
 * const lon = convertGmsToDecimal("03°22'40,0\"W");
 * console.log(lon); // -3.377778
 */
function convertGmsToDecimal(gms) {

    if (typeof gms !== "string") {
        console.warn("El parámetro gms debe ser una cadena de texto.");
        return
    }

    const regex = /(\d+)°(\d+)'(\d+[\.,]?\d*)['"\s]*([NSEW])/;
    const match = gms.match(regex);

    if (!match) {
        throw new Error("Formato de coordenadas inválido: " + gms);
    }

    let [_, degrees, minutes, seconds, direction] = match;
    degrees = parseInt(degrees, 10);
    minutes = parseInt(minutes, 10);
    seconds = parseFloat(seconds.replace(",", "."));

    let decimal = degrees + minutes / 60 + seconds / 3600;

    if (direction === "S" || direction === "W") {
        decimal *= -1;
    }

    return decimal;
}

/**
 * Este método convierte una cadena WKT (Well-Known Text) de un sistema de
 * referencia de coordenadas (CRS) en un objeto JSON estructurado,
 * interpretando correctamente jerarquías, claves repetidas y valores anidados.
 *
 * - Si una clave aparece varias veces (como MEMBER), se agrupa en un array.
 * - Si un valor no tiene clave explícita, se asigna a "name".
 * - Si hay dos valores simples, se convierten en un objeto { clave: valor }.
 * - Si hay un solo valor, se devuelve directamente.
 *
 * @function
 * @param {string} wkt Cadena WKT que representa un sistema de referencia de coordenadas.
 * @returns {Object} Objeto JSON estructurado equivalente al WKT.
 */
function parseCRSWKTtoJSON(wkt) {
  const tokens = wkt.match(/"[^"]*"|[\[\],]|[^\s\[\],]+/g);
  let index = 0;

  function parseArrayOrObject(parentKey) {
    const values = [];
    let hasNested = false;

    while (index < tokens.length) {
      const token = tokens[index];

      if (token === ']') {
        index++;
        break;
      } else if (token === ',') {
        index++;
        continue;
      } else if (tokens[index + 1] === '[') {
        const key = tokens[index++];
        index++; // skip '['
        const value = parseArrayOrObject(key);
        values.push({ [key]: value });
        hasNested = true;
      } else {
        const value = parseValue(tokens[index++]);
        values.push(value);
      }
    }

    if (!hasNested) {
      if (values.length === 1) {
        return values[0];
      } else if (values.length === 2 && typeof values[0] !== 'object') {
        return { [values[0]]: values[1] };
      } else {
        return values;
      }
    } else {
      const obj = {};
      if (values.length > 0 && typeof values[0] !== 'object') {
        obj.name = values.shift();
      }
      for (const item of values) {
        if (typeof item === 'object' && !Array.isArray(item)) {
          const key = Object.keys(item)[0];
          const value = item[key];

          if (obj.hasOwnProperty(key)) {
            if (!Array.isArray(obj[key])) {
              obj[key] = [obj[key]];
            }
            obj[key].push(value);
          } else {
            obj[key] = value;
          }
        }
      }
      return obj;
    }
  }

  function parseValue(token) {
    if (token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1);
    } else if (!isNaN(token)) {
      return Number(token);
    } else {
      return token;
    }
  }

  function parseRoot() {
    const key = tokens[index++];
    index++; // skip first '['
    const value = parseArrayOrObject(key);
    return { [key]: value };
  }

  return parseRoot();
}




