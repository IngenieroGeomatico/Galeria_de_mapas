/* =====================================================================
   3D Tiles
   ---------------------------------------------------------------------
   Una malla 3D servida por teselas: el cliente pide solo el nivel de
   detalle que necesita. Es el formato que pinta Cesium.

   En 2D la API no trae implementacion de Tiles3D: el constructor lanza
   ("la implementacion usada no puede crear capas Tiles3D"). Por eso la
   pagina dibuja la HUELLA del tileset (la region de su boundingVolume,
   leida del tileset.json) en una capa Vector.
   ===================================================================== */

const URL_TILESET = 'https://s3.eu-west-2.wasabisys.com/ems-sgct-photomaillage/ODACIT/EMS_PM2022/tileset.json';

// Estrasburgo (Eurometropole), el centro y el encuadre que trae el tileset.
const CENTRO_3857 = { x: 858375, y: 6202205 };
const CENTRO_4326 = { x: 7.7109, y: 48.57 };

function mapa() {
  // El tileset esta en un bucket S3 publico con CORS: se lee sin proxy.
  prepararFondo();

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  mapajs = IDEE.map({
    container: 'mapaDIV',
    // A este zoom la huella entra entera en 2D y en 3D se ve la ciudad.
    zoom: 11,
    center: es3D ? CENTRO_4326 : CENTRO_3857,
  });

  // El tileset es de Estrasburgo y el fondo por defecto de la API solo cubre
  // Espana: se pone OSM, que es mundial, para ver la ciudad debajo.
  mapajs.addLayers(new IDEE.layer.OSM({
    name: 'OSM',
    legend: 'OpenStreetMap',
  }, {}));

  if (es3D) {
    mapajs.addLayers(new IDEE.layer.Tiles3D({
      url: URL_TILESET,
      name: 'OdaCit',
      legend: 'Od@CiT Estrasburgo (3D Tiles)',
    }, {}));
  } else {
    dibujarHuellaTiles3D(mapajs);
  }

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

/**
 * Dibuja en 2D la huella del tileset: el rectangulo de la region que declara
 * su boundingVolume, reproyectado a EPSG:3857.
 *
 * @param {Object} map Mapa de la API-IDEE.
 */
function dibujarHuellaTiles3D(map) {
  const capa = new IDEE.layer.Vector({
    name: 'HuellaTiles3D',
    legend: 'Huella del tileset (3D Tiles solo en 3D)',
  }, {
    style: new IDEE.style.Generic({
      polygon: {
        fill: { color: '#5eead4', opacity: 0.18 },
        stroke: { color: '#0f766e', width: 2 },
      },
    }),
  });
  map.addLayers(capa);

  fetch(URL_TILESET)
    .then((respuesta) => respuesta.json())
    .then(async (tileset) => {
      const region = tileset && tileset.root && tileset.root.boundingVolume
        && tileset.root.boundingVolume.region;
      if (!region) return;

      const grados = (rad) => (rad * 180) / Math.PI;
      const oeste = grados(region[0]);
      const sur = grados(region[1]);
      const este = grados(region[2]);
      const norte = grados(region[3]);

      const [x1, y1] = await IDEE.utils.reproject([oeste, sur], 'EPSG:4326', 'EPSG:3857');
      const [x2, y2] = await IDEE.utils.reproject([este, norte], 'EPSG:4326', 'EPSG:3857');

      capa.addFeatures([new IDEE.Feature('huella', {
        type: 'Feature',
        id: 'huella',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
            [x1, y1],
          ]],
        },
        properties: {
          nombre: 'Huella del tileset',
          oeste,
          sur,
          este,
          norte,
        },
      })]);
    })
    .catch(() => {
      // Sin red o sin CORS no hay huella: el mapa queda con el fondo.
    });
}

mapa();
