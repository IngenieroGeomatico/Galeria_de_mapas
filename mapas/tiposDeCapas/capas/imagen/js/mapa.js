/* =====================================================================
   Imagen (imagenes no georreferenciadas)
   ---------------------------------------------------------------------
   Una imagen PNG/JPEG no trae ni posicion ni tamano en metros. La
   extension ext/imageLayer anade a la API IDEE.layer.image, que la
   coloca con un `bbox` (que ademas fija el tamano) o con un `position`
   mas un tamano en metros, y la gira con `heading`.

   En 2D la capa es vectorial: una entidad con el poligono de la huella y
   un estilo con `renderer` que dibuja la imagen sobre sus cuatro
   esquinas. En 3D se apoya en el terreno; con `pitch`/`roll` se dibuja
   como plano inclinado.

   La imagen es local (misma origen), asi que no hay problemas de CORS.
   ===================================================================== */

const URL_IMAGEN = '../../../../img/georrefTeselas.png';

// Plaza del Pilar, Zaragoza. Centro del encuadre.
const CENTRO_3857 = { x: -97761, y: 5109588 };
const CENTRO_4326 = { x: -0.8782, y: 41.6560 };

function mapa() {
  prepararFondo();

  const es3D = Boolean(IDEE.impl && IDEE.impl.cesium);

  mapajs = IDEE.map({
    container: 'mapaDIV',
    zoom: 18,
    center: es3D ? CENTRO_4326 : CENTRO_3857,
  });

  if (window.imageLayer && typeof window.imageLayer.instalar === 'function') {
    window.imageLayer.instalar();
  }

  // 1) Georreferenciada por BBOX y girada 25 grados. La rotacion y la
  //    escala se aplican sobre el centro del rectangulo.
  mapajs.addLayers(new IDEE.layer.image({
    url: URL_IMAGEN,
    name: 'ImagenBbox',
    legend: 'Imagen por bbox, girada 25 grados',
    bbox: [-0.8795, 41.6560, -0.8777, 41.6566],
    heading: 25,
  }));

  // 2) Georreferenciada por POSICION y tamano en metros. En 3D va
  //    inclinada (`pitch`); en 2D se dibuja tumbada, como su huella.
  mapajs.addLayers(new IDEE.layer.image({
    url: URL_IMAGEN,
    name: 'ImagenInclinada',
    legend: 'Imagen por position, inclinada 35 grados (3D)',
    position: { lon: -0.8768, lat: 41.6554, height: 0 },
    ancho: 70,
    alto: 30,
    heading: 90,
    pitch: 35,
    scale: 0.8,
  }));

  anadirPluginsTipos(mapajs, mapa);
  return mapajs;
}

mapa();
