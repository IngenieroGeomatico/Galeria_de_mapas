
/**
 * Realiza un join entre un objeto GeoJSON y un JSON basado en un campo ID común.
 * Las propiedades de cada característica del GeoJSON se ampliarán con los valores del JSON correspondiente.
 * 
 * @param {Object} geoJsonData - El objeto GeoJSON con las características a ser ampliadas.
 * @param {Object} jsonData - El objeto JSON que contiene los datos adicionales. Las claves deben coincidir con los valores del campo ID en el GeoJSON.
 * @param {string} geoJsonIdField - El campo en las propiedades del GeoJSON que actúa como ID.
 * @param {string} [jsonIdField=null] - El campo del JSON que actúa como ID. Si no se especifica, se usan las claves del JSON como ID.
 * @returns {Object} Un nuevo objeto GeoJSON con las propiedades ampliadas.
 * 
 * @example
 * const geoJson = {
 *   type: "FeatureCollection",
 *   features: [
 *     { type: "Feature", properties: { id: "1", name: "Location1" }, geometry: { type: "Point", coordinates: [0, 0] } },
 *     { type: "Feature", properties: { id: "2", name: "Location2" }, geometry: { type: "Point", coordinates: [1, 1] } }
 *   ]
 * };
 * 
 * const jsonData = {
 *   "1": { population: 1000, area: 50 },
 *   "2": { population: 2000, area: 75 }
 * };
 * 
 * const result = joinGeoJsonWithJson(geoJson, jsonData, 'id');
 * console.log(result);
 * 
 *  
 * 
 * Ejemplo 1: Sin un campo de ID en el JSON (usando las claves del JSON como ID):
 * 
 * const geoJson = {
 *   type: "FeatureCollection",
 *   features: [
 *     { type: "Feature", properties: { id: "1", name: "Location1" }, geometry: { type: "Point", coordinates: [0, 0] } },
 *     { type: "Feature", properties: { id: "2", name: "Location2" }, geometry: { type: "Point", coordinates: [1, 1] } }
 *   ]
 * };

 * const jsonData = {
 *   "1": { population: 1000, area: 50 },
 *   "2": { population: 2000, area: 75 }
 * };

 * const result = joinGeoJsonWithJson(geoJson, jsonData, 'id');
 * console.log(result);
 * /*
 *   Resultado:
 *   {
 *     type: "FeatureCollection",
 *     features: [
 *       { type: "Feature", properties: { id: "1", name: "Location1", population: 1000, area: 50 }, geometry: { type: "Point", coordinates: [0, 0] } },
 *       { type: "Feature", properties: { id: "2", name: "Location2", population: 2000, area: 75 }, geometry: { type: "Point", coordinates: [1, 1] } }
 *     ]
 *   }
 * 
 * 
 * 
 * Ejemplo 2: Usando un campo de ID en el JSON (jsonIdField):
 * 
 * 
 * const geoJson = {
 *   type: "FeatureCollection",
 *  features: [
 *    { type: "Feature", properties: { id: "A", name: "Location1" }, geometry: { type: "Point", coordinates: [0, 0] } },
 *    { type: "Feature", properties: { id: "B", name: "Location2" }, geometry: { type: "Point", coordinates: [1, 1] } }
 * ]
 * };
 * 
 * const jsonData = [
 *   { code: "A", population: 500, area: 25 },
 *   { code: "B", population: 1000, area: 50 }
 * ];
 * 
 * const result = joinGeoJsonWithJson(geoJson, jsonData, 'id', 'code');
 * console.log(result);
 * /*
 *   Resultado:
 *   {
 *     type: "FeatureCollection",
 *     features: [
 *       { type: "Feature", properties: { id: "A", name: "Location1", population: 500, area: 25 }, geometry: { type: "Point", coordinates: [0, 0] } },
 *       { type: "Feature", properties: { id: "B", name: "Location2", population: 1000, area: 50 }, geometry: { type: "Point", coordinates: [1, 1] } }
 *     ]
 *   }
 * 
*/
function joinGeoJsonWithJson(geoJsonData, jsonData, geoJsonIdField, jsonIdField = null) {
    //  Clon profundo para no modificar el original
    const updatedGeoJson = JSON.parse(JSON.stringify(geoJsonData));   

    updatedGeoJson.features.forEach(feature => {
        const geoJsonId = feature.properties[geoJsonIdField];
        let jsonRecord;

        if (jsonIdField) {
            //  Si jsonIdField está especificado, buscar en jsonData por el valor del campo
            jsonRecord = Object.values(jsonData).find(record => record[jsonIdField] === geoJsonId);
        } else {
            //  Usar las claves del jsonData como ID
            jsonRecord = jsonData[geoJsonId];
        }

        if (jsonRecord) {
            //  Ampliar las propiedades de la feature con los valores del JSON
            feature.properties = { ...feature.properties, ...jsonRecord };
        }
    });

    return updatedGeoJson;
}