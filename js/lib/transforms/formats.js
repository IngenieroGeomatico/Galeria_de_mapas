
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
function csvToGeoJson(csvString, long = "long", lat = "lat", WKT = false) {
    const rows = csvString.split("\n");
    const headers = rows[0].split(";").map(h => h.trim());

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
                    geojsonLong = parseFloat(value);
                } else if (key === lat) {
                    geojsonLat = parseFloat(value);
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