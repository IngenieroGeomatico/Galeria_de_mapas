
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


/**
 * Combina datos de un array JSON (`jsonData`) con datos de un objeto GeoJSON (`geoJson`), 
 * añadiendo todas las propiedades y la geometría de `geoJson` a cada elemento de `jsonData` 
 * cuando se cumple una coincidencia en los campos especificados.
 * 
 * @param {Array<Object>} jsonData - Array de objetos JSON que contiene los datos a los que se 
 * desea añadir información del GeoJSON. 
 * @param {Object} geoJson - Objeto GeoJSON en formato FeatureCollection, que contiene las 
 * propiedades y geometría a agregar a `jsonData`.
 * @param {string} jsonKey - Nombre de la propiedad en cada objeto de `jsonData` que se usará 
 * para la coincidencia con el `geoJson`.
 * @param {string} geoJsonKey - Nombre de la propiedad en `geoJson.features` que se usará para 
 * la coincidencia con `jsonData`.
 * 
 * @returns {Array<Object>} Un nuevo array de objetos donde cada objeto de `jsonData` tiene 
 * añadidas las propiedades y la geometría del objeto correspondiente en `geoJson`.
 * 
 * @example
const geoJson = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { id: "A", name: "Location1" }, geometry: { type: "Point", coordinates: [0, 0] } },
    { type: "Feature", properties: { id: "B", name: "Location2" }, geometry: { type: "Point", coordinates: [1, 1] } }
  ]
};

const jsonData = [
  { code: "A", population: 500, area: 25 },
  { code: "A", population: 500, area: 250 },
  { code: "A", population: 500, area: 2 },
  { code: "A", population: 500, area: 252 },
  { code: "B", population: 1000, area: 540 },
  { code: "B", population: 1000, area: 508 },
  { code: "B", population: 1000, area: 520 },
  { code: "B", population: 1000, area: 150 }
];
 * 
 * const result = joinJsonAndGeoJson(jsonData, geoJson, 'code', 'id');
 * // Resultado esperado:
 * // [
 * //   { code: "A", population: 500, area: 25, id: "A", name: "Location1", geometry: { type: "Point", coordinates: [0, 0] } },
 * //   { code: "B", population: 1000, area: 540, id: "B", name: "Location2", geometry: { type: "Point", coordinates: [1, 1] } }
 * // ]
 */
function joinJsonAndGeoJson(jsonData, geoJson, jsonKey, geoJsonKey) {
    // Crear un mapa para buscar rápidamente los features de geoJson por el campo especificado
    const geoJsonMap = new Map(
      geoJson.features.map(feature => [feature.properties[geoJsonKey], feature])
    );
  
    // Hacer el join: recorrer cada elemento en jsonData y buscar su feature correspondiente en geoJsonMap
    return jsonData.map(item => {
      const geoFeature = geoJsonMap.get(item[jsonKey]);
  
      // Si encontramos el feature correspondiente, unimos los datos
      if (geoFeature) {
        return {
          ...item,
          ...geoFeature.properties, // Añadimos todas las propiedades del geoJson
          geometry: geoFeature.geometry // Añadimos la geometría del geoJson
        };
      }
  
      // Si no se encuentra, devolver el item original sin cambios
      return item;
    });
  }
