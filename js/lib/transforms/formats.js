
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
function svgToGeoJSON(svgText, bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;

    // Crear un contenedor SVG temporal para analizarlo
    const svgElement = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
    const svgWidth = svgElement.viewBox.baseVal.width;
    const svgHeight = svgElement.viewBox.baseVal.height;

    // Función de escala para convertir coordenadas de SVG a coordenadas geográficas
    const scaleX = x => minLng + (x / svgWidth) * (maxLng - minLng);
    const scaleY = y => maxLat - (y / svgHeight) * (maxLat - minLat);

    // Recorrer todos los elementos 'path' y construir los datos de GeoJSON
    const features = [];
    const paths = svgElement.querySelectorAll('path');

    paths.forEach(pathElement => {
        const pathData = pathElement.getAttribute('d');
        const points = [];
        const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/ig);

        let x = 0, y = 0;
        commands.forEach(command => {
            const type = command[0];
            const coords = command.slice(1).trim().split(/[\s,]+/).map(Number);

            switch (type) {
                case 'M':
                case 'L':
                    x = coords[0];
                    y = coords[1];
                    points.push([scaleX(x), scaleY(y)]);
                    break;
                case 'Z':
                    if (points.length > 0) points.push(points[0]); // Cerrar el polígono
                    break;
                default:
                    console.warn(`Comando ${type} no soportado en esta función.`);
            }
        });

        // Crear el feature de tipo 'Polygon' para el GeoJSON
        if (points.length > 0) {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [points]
                },
                properties: {}
            });
        }
    });

    return {
        type: 'FeatureCollection',
        features: features
    };
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




