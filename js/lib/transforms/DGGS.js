/**
 * Convierte coordenadas de una tesela TMS (Z, X, Y) a un polígono GeoJSON.
 *
 * @param {number} z - Nivel de zoom (Z).
 * @param {number} x - Coordenada X de la tesela.
 * @param {number} y - Coordenada Y de la tesela (TMS usa origen en la esquina inferior izquierda).
 * @returns {object} Objeto GeoJSON Polygon representando el bounding box de la tesela.
 *
 * @example
 * // Para la tesela Z=2, X=1, Y=1:
 * const geojson = tmsTileToGeoJSON(2, 1, 1);
 * console.log(JSON.stringify(geojson, null, 2));
 */
function tmsTileToGeoJSON(z, x, y) {
    // Función auxiliar para convertir de coordenadas de tesela a lon/lat
    function tile2lon(x, z) {
        return (x / Math.pow(2, z)) * 360 - 180;
    }
    function tile2lat(y, z) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    // Invertir Y para pasar de TMS a XYZ
    const yXYZ = (Math.pow(2, z) - 1) - y;

    // Coordenadas de los bordes de la tesela
    const west = tile2lon(x, z);
    const east = tile2lon(x + 1, z);
    const south = tile2lat(yXYZ + 1, z);
    const north = tile2lat(yXYZ, z);

    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [[
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south]
            ]]
        },
        properties: {
            "z": z,
            "x": x,
            "-y": y,
            "label": `TMS: ${z}/${x}/${y}`
        }
    };
}

/**
 * Convierte coordenadas de una tesela XYZ (Z, X, Y) a un polígono GeoJSON.
 *
 * @param {number} z - Nivel de zoom (Z).
 * @param {number} x - Coordenada X de la tesela.
 * @param {number} y - Coordenada Y de la tesela (XYZ usa origen en la esquina superior izquierda).
 * @returns {object} Objeto GeoJSON Polygon representando el bounding box de la tesela.
 *
 * @example
 * // Para la tesela Z=2, X=1, Y=1:
 * const geojson = xyzTileToGeoJSON(2, 1, 1);
 * console.log(JSON.stringify(geojson, null, 2));
 */
function xyzTileToGeoJSON(z, x, y) {
    function tile2lon(x, z) {
        return (x / Math.pow(2, z)) * 360 - 180;
    }
    function tile2lat(y, z) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    const west = tile2lon(x, z);
    const east = tile2lon(x + 1, z);
    const north = tile2lat(y, z);
    const south = tile2lat(y + 1, z);

    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [[
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south]
            ]]
        },
        properties: {
            "z": z,
            "x": x,
            "y": y,
            "label": `XYZ: ${z}/${x}/${y}`
        }
    };
}

/**
 * Convierte un índice H3 a un polígono GeoJSON.
 *
 * Requiere la librería h3-js: https://github.com/uber/h3-js
 *
 * @param {string} h3Index - Índice H3 (ejemplo: '8928308280fffff').
 * @returns {object} Objeto GeoJSON Polygon representando el hexágono H3.
 *
 * @example
 * // Para el índice H3:
 * const geojson = h3ToGeoJSON('8928308280fffff');
 * console.log(JSON.stringify(geojson, null, 2));
 */
function h3ToGeoJSON(h3Index) {
    if (typeof h3 === "undefined" || typeof h3.cellToBoundary !== "function") {
        throw new Error("h3-js no está definido o no está correctamente importado. Asegúrate de importar h3-js y usar la variable 'h3'.");
    }
    // h3.cellToBoundary devuelve un array de [lat, lng], GeoJSON espera [lng, lat]
    const boundary = h3.cellToBoundary(h3Index, true);
    // Cerrar el polígono si es necesario
    if (boundary.length > 0 && (boundary[0][0] !== boundary[boundary.length-1][0] || boundary[0][1] !== boundary[boundary.length-1][1])) {
        boundary.push(boundary[0]);
    }
    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [boundary]
        },
        properties: {
            "h3": h3Index,
            "label": "H3: "+h3Index
        }
    };
}





