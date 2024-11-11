
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
