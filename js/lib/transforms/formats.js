
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
 * const geoJson = jsonToGeoJson(jsonArray, 'latitude', 'longitude');
 * // Resultado esperado:
 * // {
 * //   type: "FeatureCollection",
 * //   features: [
 * //     { type: "Feature", properties: { id: "A", name: "Location1", population: 500 }, geometry: { type: "Point", coordinates: [0, 0] } },
 * //     { type: "Feature", properties: { id: "B", name: "Location2", population: 1000 }, geometry: { type: "Point", coordinates: [1, 1] } }
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


