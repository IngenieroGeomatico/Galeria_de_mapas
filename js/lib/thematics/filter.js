
/**
 * Filtra un objeto GeoJSON basado en un atributo específico y su valor.
 *
 * @param {Object} geojson - El objeto GeoJSON a filtrar. Debe tener la estructura de una 
 *                          FeatureCollection, con una propiedad 'features' que sea un 
 *                          array de características.
 * @param {string} attribute - El nombre del atributo por el cual se desea filtrar.
 * @param {*} value - El valor que debe tener el atributo para que la característica 
 *                   sea incluida en el resultado.
 * @returns {Object} Un nuevo objeto GeoJSON que contiene solo las características que 
 *                   cumplen con el criterio de filtrado.
 * @throws {Error} Lanza un error si el objeto GeoJSON no es válido o no contiene características.
 *
 * @example
 * const geojson = {
 *     "type": "FeatureCollection",
 *     "features": [
 *         {
 *             "type": "Feature",
 *             "properties": {
 *                 "name": "A",
 *                 "category": "park"
 *             },
 *             "geometry": {
 *                 "type": "Point",
 *                 "coordinates": [102.0, 0.5]
 *             }
 *         },
 *         {
 *             "type": "Feature",
 *             "properties": {
 *                 "name": "B",
 *                 "category": "lake"
 *             },
 *             "geometry": {
 *                 "type": "Point",
 *                 "coordinates": [103.0, 1.0]
 *             }
 *         }
 *     ]
 * };
 *
 * // Filtrar por 'category' igual a 'park'
 * const filteredGeoJSON = filterGeoJSON(geojson, 'category', 'park');
 * console.log(JSON.stringify(filteredGeoJSON, null, 2));
 */
function filterGeoJSON(geojson, attribute, value) {
    // Verifica que el geojson sea un objeto válido y contenga características
    if (!geojson || !geojson.features) {
        throw new Error("El objeto GeoJSON no es válido.");
    }

    // Filtra las características basadas en el atributo y el valor proporcionado
    const filteredFeatures = geojson.features.filter(feature => {
        return feature.properties && feature.properties[attribute] === value;
    });

    // Devuelve un nuevo objeto GeoJSON con las características filtradas
    return {
        type: "FeatureCollection",
        features: filteredFeatures
    };
}

/**
 * Cuenta el número de veces que un valor específico aparece en los atributos de un GeoJSON.
 * 
 * @param {Object} geojson - El objeto GeoJSON que contiene las características (features).
 * @param {string} valor - El valor a contar en los atributos de las propiedades del GeoJSON.
 * @returns {number} - El número de ocurrencias del valor en los atributos.
 * 
 * @example
 * const geojson = {
 *   type: "FeatureCollection",
 *   features: [
 *     {
 *       type: "Feature",
 *       properties: { H1: "V", H2: "N", H3: "V" },
 *       geometry: { type: "Point", coordinates: [0, 0] }
 *     },
 *     {
 *       type: "Feature",
 *       properties: { H1: "N", H2: "V", H3: "V" },
 *       geometry: { type: "Point", coordinates: [1, 1] }
 *     }
 *   ]
 * };
 * 
 * const numeroDeV = contarValoresenAtributos(geojson, "V");
 * console.log(numeroDeV); // Resultado: 4
 */
function contarValoresenAtributos(feature, valor) {
    let contador = 0;

        Object.keys(feature.properties).forEach(key => {
                if (feature.properties[key] === valor) {
                    contador++;
                }
        });

    return contador;
}
