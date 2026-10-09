/*
 * miPlugin_MVTLayer: da soporte 3D a `IDEE.layer.MVT`.
 *
 * QUÉ HAY AQUÍ Y QUÉ NO
 *
 * Hay dos cosas, y solo dos:
 *
 * 1. La ESTRUCTURA de una capa `IDEE.layer.MVT` para Cesium (abajo, en
 *    `crearFachada` y `crearImplementacion`). Esto está medido y funciona: la
 *    capa se crea, con la misma definición que en 2D.
 *
 * 2. La ALGORITMIA para leer el servicio MVT (la clase `LectorMVT`). Sin
 *    dependencias de Cesium: descarga la tesela, la decodifica, la recorta a su
 *    extent y devuelve los municipios con sus anillos y su color.
 *
 * NO hay renderizado. Todo lo de Cesium (primitivas, cámara, picking) se ha
 * quitado a propósito, para poder iterar sobre la lectura sin que el dibujo
 * enturbie lo que se está midiendo.
 *
 *
 * POR QUÉ HACE FALTA UNA FACHADA PROPIA (medido)
 *
 * `IDEE.layer.MVT` ya existe en la API y en 2D la implementa OpenLayers. En
 * Cesium no hay nada que la implemente, y no es que falte registrarla: es que la
 * API no tiene dónde meterla. Su constructor (clase `m` del bundle) pide la
 * implementación a un módulo de webpack:
 *
 *   let r = n.n(n(90505))                  // n = require del bundle
 *   if (isUndefined(r()) || ...) throw "La implementación usada no puede crear capas MVT"
 *   super(o, s, void 0, i || new (r())(o, s, n))
 *
 * Y en `apiidee.cesium.min.js` ese módulo es un stub vacío:
 *
 *   },90505:()=>{},90649:()=>{},6149:()=>{},10700:(e,t,n)=>{ ...
 *
 * Igual que `90649` y `6149`: son las tres capas que el bundle de Cesium no
 * implementa. Por eso `r()` es `undefined` y `new IDEE.layer.MVT(...)` lanzaba
 * siempre. Registrar la clase en `IDEE.impl.layer` o en `M.layer` no arregla
 * nada, porque el módulo 90505 ya está compilado como stub y
 * `__webpack_require__` no se expone en la ventana, de modo que su caché de
 * módulos no es alcanzable desde fuera (medido: un `Proxy` sobre todos los
 * registros candidatos no registra ni una lectura de `MVT`).
 *
 * La salida es sustituir la fachada. Se puede porque (medido):
 *
 *   - `Object.getPrototypeOf(IDEE.layer.MVT.prototype).constructor === IDEE.layer.Vector`
 *     o sea que la MVT del bundle hereda de `IDEE.layer.Vector`.
 *   - Las fachadas aceptan la implementación por el CUARTO parámetro del
 *     constructor: `new IDEE.layer.Vector(p, o, v, miImpl)` usa `miImpl`
 *     (medido: falla después solo porque un impl de mentira no tenía
 *     `isLoaded`).
 *
 * Así que este plugin registra `IDEE.layer.MVT` con una fachada propia que
 * hereda de `IDEE.layer.Vector` y le pasa la implementación. Para el
 * visualizador no cambia nada: sigue escribiendo `new IDEE.layer.MVT(...)`, y en
 * 2D sigue siendo la clase del bundle.
 *
 *
 * LA LECTURA DEL MVT (medido, servicio del IGN)
 *
 * - URL en XYZ: https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf
 * - Capa dentro de la tesela: `municipio`.
 * - Extent 4096. El servicio manda cada tesela con un buffer de unos 80
 *   unidades (2 %) por cada lado.
 * - Una tesela vacía pesa 21 bytes.
 *
 * Dos cosas que hay que hacer al leer, y las dos importantes:
 *
 * - RECORTAR a `0..extent`. Sin esto dos teselas vecinas pintan la misma franja
 *   dos veces, porque cada una trae el buffer de la otra. Se recorta exacto, sin
 *   margen, con Sutherland-Hodgman (que es exacto porque la ventana, el
 *   rectángulo del extent, es convexo).
 *
 * - AGRUPAR LOS ANILLOS POR EL SIGNO DE SU ÁREA. En el MVT el exterior de cada
 *   polígono conserva el signo del primero y sus huecos van al revés. Sin este
 *   paso, que se hizo tomando solo el primer anillo, se perdían 799 municipios
 *   de 9 199 (medido), entre ellos Móstoles, que tiene dos trozos.
 *
 *
 * LO QUE NO SE HA RESUELTO, Y NO ES RUIDO
 *
 * El relleno se hunde bajo el terreno en algunos municipios (Ambite, la parte de
 * Cádiz que toca con San Fernando) mientras el borde va bien. Está SIN
 * EXPLICAR. La hipótesis de que era el relieve se ha medido y es falsa:
 *
 *   sitio     desnivel   desviación del terreno respecto a la recta (aristas de 19 m)
 *   Ceuta       167 m            1,7 m
 *   Cádiz        35 m            2,2 m
 *   Ambite      234 m            2,8 m
 *
 * Ambite tiene más desnivel que Cádiz y solo 0,6 m más de desviación, y 2,8 m no
 * explican un relleno que desaparece. Lo que sí distingue a los que fallan es que
 * tienen municipios colindantes (Ceuta y Melilla no tienen ninguno y se ven
 * bien; de Cádiz falla justo la parte que linda con San Fernando). La siguiente
 * pista a mirar es esa, no el relieve.
 *
 * Y una corrección sobre el borde, porque se suele suponer mal: el borde no va
 * bien porque `GroundPolylineGeometry` tenga buenos vértices. Reparte los puntos
 * a lo largo de la superficie y quien los clava al terreno es `clampToGround`, en
 * el shader de vértices, en la GPU, al pintar. Por eso sus vértices están igual
 * de separados que los del relleno y no hay unos vértices buenos que leer para
 * construir el polígono a partir del borde: no existen fuera de la GPU.
 *
 *
 * LO QUE HACE FALTA EN EL index.html
 *
 * El decodificador es ESM puro y necesita un import map:
 *
 *   <script type="importmap">
 *     { "imports": {
 *         "@mapbox/point-geometry": "https://cdn.jsdelivr.net/npm/@mapbox/point-geometry@0.1.0/+esm",
 *         "@mapbox/vector-tile": "https://cdn.jsdelivr.net/npm/@mapbox/vector-tile@2.0.3/index.min.js"
 *     } }
 *   </script>
 *   <script src="../../ext/MVTLayer/MVTLayer.js"></script>
 *
 * Lo de point-geometry tiene su trampa: el `/index.js` del paquete es CommonJS
 * (`module.exports = Point`) y no vale para un import ESM. Pero jsdelivr sirve
 * cualquier paquete como ESM con el sufijo `+esm`, y ahí sí hay `export default`.
 * Medido: con esa URL el decodificador lee una tesela de verdad (157 features) y
 * el primer punto sale en x -80, y -77, que es el buffer del servicio. Antes de
 * esto había un shim propio en el plugin, y ya no hace falta.
 */
(function () {
  'use strict';

  // Acceso a la API, patrón del repo: en 2D es M, en 3D IDEE.
  function api() {
    return window.IDEE || window.M;
  }

  // EPSG:3857 tal y como la define proj4, para pasar unidades de tesela a
  // lon/lat. Solo se usa si el visualizador ha cargado proj4.
  const EPSG_3857 = '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 ' +
    '+x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs';
  const ANCHO_3857 = 40075016.685578488;

  const ZOOM_MIN = 5;
  const ZOOM_MAX = 14;

  // Color de las entidades sin fila en el CSV. Medido: son 84 de 9 199 y todas
  // tienen código 53xxx, o sea mancomunidades y entidades singulares, que el INE
  // no publica como municipios. No son municipios sin dato: no son municipios.
  const COLOR_SIN_DATO = 'rgba(150, 150, 150, 0.75)';

  /* ------------------------------------------------------------------ *
   * Decodificador
   *
   * Va aquí, dentro del plugin, y no en un módulo aparte porque es parte de la
   * lectura. Aun así tiene que ser una importación DINÁMICA: el bundle de
   * @mapbox/vector-tile@2.0.3 es ESM puro (empieza por
   * `import Point from '@mapbox/point-geometry'` y exporta con `export class`), y
   * un `<script>` normal no lo carga: da `Unexpected token 'export'`.
   *
   * Sobre las versiones, medido:
   * - La 1.3.1 no publica bundle de navegador: /dist/vector-tile.js da 404 y su
   *   /index.min.js son 528 bytes sin el código. Solo CommonJS.
   * - La 2.0.3 sí, en /index.min.js, pero es ESM.
   * - vt-pbf no sirve: serializa MVT, no lo decodifica, y usa require().
   * ------------------------------------------------------------------ */

  let promesaDecodificador = null;

  /**
   * Devuelve el constructor VectorTile, cargándolo la primera vez.
   * @returns {Promise<Function>} Promesa con el constructor.
   */
  function cargarVectorTile() {
    if (!promesaDecodificador) {
      promesaDecodificador = import('@mapbox/vector-tile').then(function (mod) {
        if (!mod || typeof mod.VectorTile !== 'function') {
          throw new Error('@mapbox/vector-tile no ha exportado VectorTile');
        }
        return mod.VectorTile;
      });
    }
    return promesaDecodificador;
  }

  /* ------------------------------------------------------------------ *
   * Utilidades de geometría
   * ------------------------------------------------------------------ */

  // Área con orientación (fórmula del zapatero). El signo dice si un anillo es un
  // exterior o un hueco, que es justo lo que usa el agrupado de anillos.
  function areaConSigno(anillo) {
    let s = 0;
    for (let i = 0; i < anillo.length - 1; i++) {
      s += (anillo[i + 1].x - anillo[i].x) * (anillo[i + 1].y + anillo[i].y);
    }
    return s / 2;
  }

  // Sutherland-Hodgman contra un rectángulo. Exacto cuando la ventana es
  // convexa, que es el caso aquí: el extent de la tesela.
  const corteX = (a, b, x) => (b.x === a.x
    ? { x, y: a.y }
    : { x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) });
  const corteY = (a, b, y) => (b.y === a.y
    ? { y, x: a.x }
    : { y, x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y) });

  function recortaAnillo(anillo, xmin, ymin, xmax, ymax) {
    const lados = [
      { dentro: (p) => p.x >= xmin, corte: (a, b) => corteX(a, b, xmin) },
      { dentro: (p) => p.x <= xmax, corte: (a, b) => corteX(a, b, xmax) },
      { dentro: (p) => p.y >= ymin, corte: (a, b) => corteY(a, b, ymin) },
      { dentro: (p) => p.y <= ymax, corte: (a, b) => corteY(a, b, ymax) },
    ];
    let actual = anillo;
    for (const lado of lados) {
      if (!actual.length) return [];
      const siguiente = [];
      let previo = actual[actual.length - 1];
      for (const punto of actual) {
        if (lado.dentro(punto)) {
          if (!lado.dentro(previo)) siguiente.push(lado.corte(previo, punto));
          siguiente.push(punto);
        } else if (lado.dentro(previo)) {
          siguiente.push(lado.corte(previo, punto));
        }
        previo = punto;
      }
      actual = siguiente;
    }
    return actual;
  }

  function distanciaM(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180;
    const la2 = b.lat * Math.PI / 180;
    const x = dLon * Math.cos((la1 + la2) / 2);
    return R * Math.sqrt(x * x + dLat * dLat);
  }

  /**
   * Pasa un punto de unidades de tesela a lon/lat. Usa la proyección del
   * teselado XYZ estándar, que es la del servicio del IGN (medido: encaja con
   * los municipios).
   * @param {number} px X en unidades de tesela.
   * @param {number} py Y en unidades de tesela.
   * @param {number} z Zoom.
   * @param {number} x Columna de la tesela.
   * @param {number} y Fila de la tesela.
   * @param {number} extent Unidades de lado de la tesela.
   * @returns {Array<number>} [lon, lat].
   */
  function puntoALonLat(px, py, z, x, y, extent) {
    const n = Math.pow(2, z);
    const mx = -ANCHO_3857 / 2 + ((x + px / extent) / n) * ANCHO_3857;
    const my = ANCHO_3857 / 2 - ((y + py / extent) / n) * ANCHO_3857;
    if (window.proj4) return window.proj4(EPSG_3857, 'EPSG:4326', [mx, my]);
    return [mx, my];
  }

  /**
   * AFÍN POR TESELA, en vez de una proyección por vértice. Es el cambio que hace
   * viable el dibujado, y es lo mismo que hace OpenLayers (medido).
   *
   * EL PROBLEMA
   *
   * `puntoALonLat` llama a `proj4` en CADA vértice. En una tesela de z5 hay del
   * orden de 90 000 vértices, y una llamada a proj4 cuesta ~14 µs: son 1,3 s por
   * tesela (medido). La vista de la península pide 54 teselas, o sea más de un
   * minuto de hilo principal bloqueado y no se ve nada (medido).
   *
   * POR QUÉ BASTAN CUATRO CORNES
   *
   * La proyección de una tesela XYZ es Web Mercator, y dentro de una tesela la
   * relación entre unidades de tesela y grados se puede escribir como un bilineal
   * a partir de las cuatro esquinas. Con eso: 4 llamadas a proj4 por tesela en vez
   * de una por vértice. Medido en la tesela 7/62/49 del IGN (575 municipios,
   * 48 994 vértices): 4 ms frente a 1 298 ms, o sea 295 veces menos, y el error
   * máximo en toda la tesela es de 2e-14 grados en longitud, unos dos micrómetros
   * (medido). Es de sobra: un vértice del MVT a z5 son 305 m.
   *
   * OJO CON EL BÚFER
   *
   * El servicio manda cada tesela con un buffer de unos 80 unidades por lado, así
   * que los anillos crudos tienen coordenadas NEGATIVAS (medido: `anillo0` de
   * Villanueva del Río y Minas va de x -80 a 15). El bilineal NO vale fuera del
   * extent: ahí extrapola y se desvía (medido: 929 km de error). Por eso hay que
   * recortar a `0..extent` ANTES de pasar por aquí, que es lo que ya hace
   * `recortaAnillo` al leer. Con los anillos ya recortados, el afín es seguro.
   *
   * Si el visualizador no ha cargado proj4, se degrada a los metros de 3857 sin
   * convertir, como antes.
   */
  function crearAfín(z, x, y, extent) {
    const n = Math.pow(2, z);
    const a3857 = (px, py) => [
      -ANCHO_3857 / 2 + ((x + px / extent) / n) * ANCHO_3857,
      ANCHO_3857 / 2 - ((y + py / extent) / n) * ANCHO_3857,
    ];

    if (!window.proj4) {
      // Sin proj4 solo se puede pasar por 3857. Menos preciso, pero no peor que
      // antes, y no deja la pantalla en negro porLlámalo a lo que había.
      return function sinProj4(px, py) { return a3857(px, py); };
    }

    const no = window.proj4(EPSG_3857, 'EPSG:4326', a3857(0, 0));
    const ne = window.proj4(EPSG_3857, 'EPSG:4326', a3857(extent, 0));
    const so = window.proj4(EPSG_3857, 'EPSG:4326', a3857(0, extent));
    const se = window.proj4(EPSG_3857, 'EPSG:4326', a3857(extent, extent));

    const lon0 = no[0], lonNE = ne[0], lonSO = so[0], lonSE = se[0];
    const lat0 = no[1], latNE = ne[1], latSO = so[1], latSE = se[1];

    // Bilineal sobre las cuatro esquinas. Se escriben los dos valores en el mismo
    // array para no reservar uno por vértice: son casi 90 000 por tesela.
    const salida = [0, 0];
    return function (px, py) {
      const fx = px / extent;
      const fy = py / extent;
      const g = 1 - fy;
      salida[0] = (lon0 + (lonNE - lon0) * fx) * g + (lonSO + (lonSE - lonSO) * fx) * fy;
      salida[1] = (lat0 + (latNE - lat0) * fx) * g + (latSO + (latSE - latSO) * fx) * fy;
      return salida;
    };
  }

  /* ------------------------------------------------------------------ *
   * LectorMVT: la algoritmia de lectura
   *
   * Sin Cesium. Dada una z/x/y devuelve los municipios de esa tesela con sus
   * anillos ya recortados y agrupados, y su color. Los anillos van en unidades
   * de tesela (0..extent), que es como los entrega el servicio; quien dibuje
   * decide si los pasa a lon/lat.
   * ------------------------------------------------------------------ */

  class LectorMVT {
    /**
     * @param {Object} opciones
     * @param {string} opciones.url Plantilla con {z}, {x} y {y}.
     * @param {string} [opciones.capas] Capa dentro de la tesela ('municipio').
     * @param {number} [opciones.extent] Unidades de lado. Medido: 4096.
     */
    constructor(opciones) {
      const o = opciones || {};
      this.url = o.url;
      this.capas = o.capas || '';
      this.extent = o.extent || 4096;
      this._funcionColor = null;
    }

    /**
     * El color de cada elemento, en CSS. La pone el visualizador y es lo que
     * permite que 2D y 3D compartan ramp.
     * @param {Function} fn Recibe (codigo, nombre) y devuelve un color CSS.
     */
    setColorFunction(fn) {
      this._funcionColor = fn;
      // El color se calcula al leer la tesela, así que lo que ya está pintado
      // sigue con el color viejo. Se avisa a quien lo sepa.
      if (this.alCambiarColor) this.alCambiarColor();
    }

    /** @returns {string} La URL de una tesela, o '' si la plantilla no cuadra. */
    urlTesela(z, x, y) {
      if (!this.url) return '';
      return this.url
        .replace('{z}', z).replace('{x}', x).replace('{y}', y);
    }

    _colorDe(codigo, nombre) {
      if (!this._funcionColor) return COLOR_SIN_DATO;
      try {
        const v = this._funcionColor(codigo, nombre);
        return (typeof v === 'string' && v) ? v : COLOR_SIN_DATO;
      } catch (e) {
        return COLOR_SIN_DATO;
      }
    }

    /**
     * Descarga y decodifica una tesela.
     * @param {number} z Zoom.
     * @param {number} x Columna.
     * @param {number} y Fila.
     * @returns {Promise<Object>} { z, x, y, features, bytes, vacia }
     */
    async cargarTesela(z, x, y) {
      const salida = { z: z, x: x, y: y, features: [], bytes: 0, vacia: true };

      const url = this.urlTesela(z, x, y);
      if (!url || url.indexOf('{') >= 0) {
        throw new Error('La plantilla de URL no tiene {z}, {x} y {y}: ' + this.url);
      }

      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status + ' en ' + url);
      const buffer = await respuesta.arrayBuffer();
      salida.bytes = buffer.byteLength;

      // Una tesela vacía son 21 bytes (medido): no hay nada que leer.
      if (!buffer || buffer.byteLength < 40) return salida;
      salida.vacia = false;

      const VectorTile = await cargarVectorTile();
      const tesela = new VectorTile(new window.Pbf(new Uint8Array(buffer)));
      const capa = this.capas
        ? tesela.layers[this.capas]
        : tesela.layers[Object.keys(tesela.layers)[0]];
      if (!capa) throw new Error('La tesela no trae la capa ' + this.capas);

      salida.features = this._features(capa, z, x, y);
      return salida;
    }

    _features(capa, z, x, y) {
      const extent = this.extent;
      const features = [];

      for (let i = 0; i < capa.length; i++) {
        const feature = capa.feature(i);
        if (feature.type !== 3) continue;   // 3 = polígono

        const anillos = feature.loadGeometry();
        if (!anillos || !anillos.length) continue;

        // Recorte exacto a la tesela. Sin esto cada tesela pinta el buffer de
        // la vecina y sale una franja más saturada.
        const recortados = anillos.map(
          (a) => recortaAnillo(a, 0, 0, extent, extent)
        );

        // Anillos degenerados: menos de 4 puntos o área ~0.
        const utiles = recortados.filter(
          (a) => a && a.length >= 4 && Math.abs(areaConSigno(a)) >= 1
        );
        if (!utiles.length) continue;

        // Agrupar: mismo signo que el primero = trozo nuevo; contrario = hueco
        // del trozo actual. Sin esto se perdían 799 municipios de 9 199.
        const signoBase = areaConSigno(utiles[0]) > 0 ? 1 : -1;
        const poligonos = [{ exterior: utiles[0], huecos: [] }];
        for (let j = 1; j < utiles.length; j++) {
          const mismoSigno = (areaConSigno(utiles[j]) > 0 ? 1 : -1) === signoBase;
          if (mismoSigno) poligonos.push({ exterior: utiles[j], huecos: [] });
          else poligonos[poligonos.length - 1].huecos.push(utiles[j]);
        }

        // El código del IGN es '34' + '07' + '37354', o sea 11 caracteres, y el
        // código municipal son los 5 últimos (medido: el de Móstoles es
        // 34132828092 -> 28092). Por eso `slice(-5)` siempre acierta.
        const codigoNacional = feature.properties && feature.properties.nationalcode;
        const codigo = codigoNacional ? String(codigoNacional).slice(-5) : null;
        const nombre = feature.properties && feature.properties.nameunit;

        features.push({
          codigo: codigo,
          nombre: nombre,
          color: this._colorDe(codigo, nombre),
          z: z, x: x, y: y,
          extent: extent,
          poligonos: poligonos,
        });
      }
      return features;
    }

    /**
     * Las teselas que cubren un rectángulo en lon/lat. Es matemática pura, sin
     * Cesium, para poder enumerar teselas desde la consola.
     * @param {Object} rect { oeste, este, norte, sur } en grados.
     * @param {number} zoom Zoom.
     * @returns {Array<string>} ["z/x/y", ...]
     */
    static teselasDe(rect, zoom) {
      let z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
      const n = Math.pow(2, z);
      const lonAX = (lon) => Math.floor(((lon + 180) / 360) * n);
      const latAY = (lat) => {
        const r = lat * Math.PI / 180;
        return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
      };
      const x0 = Math.max(0, Math.min(n - 1, lonAX(rect.oeste)));
      const x1 = Math.max(0, Math.min(n - 1, lonAX(rect.este)));
      const y0 = Math.max(0, Math.min(n - 1, latAY(rect.norte)));
      const y1 = Math.max(0, Math.min(n - 1, latAY(rect.sur)));
      const claves = [];
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) claves.push(z + '/' + x + '/' + y);
      }
      return claves;
    }
  }

   /* ------------------------------------------------------------------ *
   * El dibujado
   *
   * POR QUE `GroundPrimitive` PARA EL RELLENO
   *
   * La primera version pinto el relleno con `GroundPrimitive` y se descarto: el
   * sintoma era que el relleno se hundia y solo pasaba en los municipios CON
   * colindantes (Ambite, la parte de Cadiz que linda con San Fernando) mientras
   * Ceuta y Melilla, que no tienen ninguno, se veian bien. Se concluyo que era la
   * profundidad y se paso a `Primitive` NORMAL, con la altura del terreno en cada
   * vertice y `depthTestAgainstTerrain`.
   *
   * Ese cambio fue un error, y esta medido. Con `Primitive` normal el relleno no se
   * ve, NI UN PIXEL: contando pixeles del color de prueba en la misma escena y con
   * la misma geometria, 0 con `Primitive` normal frente a 748 890 con
   * `GroundPrimitive` (el 73 % de la pantalla). El borde si se veia siempre, que es
   * lo que despistaba: como el borde va en `GroundPolylinePrimitive` y ese si
   * funciona, parecia que el fallo era de la altura del terreno y no de la
   * primitiva del relleno.
   *
   * Por que `Primitive` normal no puede funcionar aqui: `GroundPrimitive` no es un
   * poligono a una altura fija, es una CLASIFICACION. Cesium resuelve en el fragment
   * shader, pixel a pixel, a que altura esta el terreno ahi, y pinta el poligono a
   * esa altura. Con un `Primitive` normal hay que adivinar la altura de antemano, y
   * la malla bilineal (PASO_MALLA = 400 m) se queda por debajo del terreno real: en
   * Ambite la desviacion medida es de 2,8 m, y con `depthTestAgainstTerrain` el
   * terreno gana siempre el z-buffer y el relleno desaparece. Subir la altura a ojo
   * no arregla nada, porque el error de la malla cambia de signo segun el relieve.
   *
   * La contrapartida: `GroundPrimitive` solo pinta donde el terreno esta cargado, y
   * con la camara muy inclinada el relleno se ve solo hasta el horizonte (medido en
   * la captura). Para una coropleta es el comportamiento correcto.
   *
   * El borde va aparte con `GroundPolylinePrimitive`, que subdivide los vertices
   * contra el terreno.
   * ------------------------------------------------------------------ */

  // Polígonos por primitiva. Medido antes: 500 en una sola no llega nunca a
  // `ready`, así que se baja a 60.
  const POLIGONOS_POR_LOTE = 60;
  const MAX_PETICIONES = 4;
  const ANCHO_BORDE = 1.5;
  const COLOR_BORDE = '#222222';

  class RenderMVT {
    constructor(impl) {
      this.impl = impl;
      this.lector = impl.lector;

      this.Cesium = null;
      this.scene = null;
      this.teselas = new Map();   // "z/x/y" -> { prims: [], instancias: number }
      this.enCurso = new Set();
      this.pendientes = [];
      this.enVuelo = 0;
      this.pintados = 0;
      this._listenerCamara = null;

      // El lector avisa cuando cambia el color, para repintar.
      this.lector.alCambiarColor = () => this._repintar();
    }

    /* --- ciclo de vida --- */

    addTo(map) {
      this.map = map;
      this.Cesium = window.Cesium;

      // Ojo: en el `addTo` la escena de Cesium todavía NO existe, y
      // `map.getMapImpl()` o `.scene` lanzan. Con el `try/catch` de antes el
      // error se comía y la capa se quedaba sin pintar para siempre (medido:
      // escena a NULL en el arranque y cero teselas cargadas, aunque 4 s después
      // la escena ya estuviera). Por eso se espera a tenerla.
      this._esperarEscena(60);
    }

    /** Para depurar desde la consola: por qué no se ha pintado. */
    diagnostico() {
      const s = this.scene;
      return {
        hayEscena: Boolean(s),
        trazaEsperarLienzo: this._traza || 0,
        trazaConLienzo: this._trazaOk || 0,
        vecesRefrescar: this._vecesRefrescar || 0,
        ultimasClaves: this._ultimasClaves === undefined ? null : this._ultimasClaves,
        ultimoZoom: this._ultimoZoom === undefined ? null : this._ultimoZoom,
        ultimoFallo: this._ultimoFallo === undefined ? null : this._ultimoFallo,
        listener: Boolean(this._listenerCamara),
        lienzoAncho: s && s.canvas ? s.canvas.clientWidth : null,
        rectangulo: this.rectanguloVisible(),
        pendientes: this.pendientes.length,
        enVuelo: this.enVuelo,
        enCurso: this.enCurso.size,
        teselas: this.teselas.size,
        pintados: this.pintados,
      };
    }

    // Espera a que la escena exista. Al aparecer se engancha a la cámara y se
    // espera a que el lienzo tenga tamaño, que es lo que hace falta para
    // calcular el rectángulo visible.
    _esperarEscena(intentos) {
      const n = intentos || 0;
      if (!this.map) return;

      let escena = null;
      try {
        const mi = this.map.getMapImpl();
        escena = mi ? mi.scene : null;
      } catch (e) {
        escena = null;
      }

      if (escena) {
        this.scene = escena;
        // Sin esto, el terreno se dibuja ENCIMA de los polígonos.
        this.scene.globe.depthTestAgainstTerrain = true;

        if (!this._listenerCamara) {
          this._listenerCamara = this.scene.camera.changed.addEventListener(() => {
            this.refrescar();
          });
        }
        this._esperarLienzo(30);
        return;
      }

      if (n > 0) setTimeout(() => this._esperarEscena(n - 1), 100);
    }

    // Reintenta `refrescar()` hasta que el lienzo tenga tamaño. Sin esto la
    // primera carga se queda en blanco, porque `addTo` corre antes de que el
    // lienzo tenga medidas y `rectanguloVisible()` no puede calcular nada.
    // Reintenta hasta que se pueda pintar de verdad, que son DOS condiciones y en
    // distinto orden. Con solo el lienzo no basta (medido): la primera llamada a
    // `refrescar` desde el arranque encuentra el lienzo ya dimensionado pero la
    // cámara todavía no está colocada, así que `rectanguloVisible()` devuelve
    // null y la capa se queda en blanco para siempre. Con esto se espera a que
    // haya lienzo Y rectángulo.
    _esperarLienzo(intentos) {
      if (!this.scene) return;
      const n = intentos || 0;
      this._traza = (this._traza || 0) + 1;

      const hayLienzo = this.scene.canvas && this.scene.canvas.clientWidth > 0;
      const rect = hayLienzo ? this.rectanguloVisible() : null;

      if (rect) {
        this._trazaOk = (this._trazaOk || 0) + 1;
        this.refrescar();
        return;
      }
      if (n > 0) setTimeout(() => this._esperarLienzo(n - 1), 100);
    }

    destroy() {
      if (this._listenerCamara && this.scene) {
        this.scene.camera.changed.removeEventListener(this._listenerCamara);
        this._listenerCamara = null;
      }
      this._quitarTodas();
      this.scene = null;
      this.map = null;
    }

    /* --- qué hay que pintar --- */

    refrescar() {
      this._vecesRefrescar = (this._vecesRefrescar || 0) + 1;
      if (!this.scene) return;
      const rect = this.rectanguloVisible();
      this._ultimoRect = rect;
      if (!rect) return;

      let claves = null;
      let zoom = null;
      let fallo = null;
      try {
        zoom = this.zoomAdecuado(rect);
        claves = LectorMVT.teselasDe(rect, zoom);
      } catch (e) {
        fallo = String((e && e.message) || e);
      }
      this._ultimoZoom = zoom;
      this._ultimasClaves = claves ? claves.length : null;
      this._ultimoFallo = fallo;
      if (!claves || !claves.length) return;

      // Fuera las que ya no se ven.
      const vistas = new Set(claves);
      for (const clave of Array.from(this.teselas.keys())) {
        if (vistas.has(clave)) continue;
        this._quitar(this.teselas.get(clave).prims);
        this.teselas.delete(clave);
      }

      // Entra lo que falta.
      for (const clave of claves) {
        if (this.teselas.has(clave) || this.enCurso.has(clave)) continue;
        if (this.pendientes.indexOf(clave) < 0) this.pendientes.push(clave);
      }
      this._bombear();
    }

    _bombear() {
      while (this.enVuelo < MAX_PETICIONES && this.pendientes.length) {
        this._cargar(this.pendientes.shift());
      }
    }

    // Cambió la función de color: lo pintado lleva el color viejo, así que se
    // tira todo y se vuelve a leer. Las teselas son las mismas, no hace falta
    // volver a decidir cuáles.
    _repintar() {
      if (!this.scene) return;
      this._quitarTodas();
      const rect = this.rectanguloVisible();
      if (!rect) return;
      const claves = LectorMVT.teselasDe(rect, this.zoomAdecuado(rect));
      this.pendientes = claves.filter((c) => this.pendientes.indexOf(c) < 0);
      this._bombear();
    }

    async _cargar(clave) {
      this.enCurso.add(clave);
      this.enVuelo++;
      try {
        const partes = clave.split('/');
        const z = Number(partes[0]);
        const x = Number(partes[1]);
        const y = Number(partes[2]);
        const salida = await this.lector.cargarTesela(z, x, y);
        if (!salida.features.length) {
          this.teselas.set(clave, { prims: [], instancias: 0 });
          return;
        }
        const prims = this._pintar(salida.features, z, x, y);
        this.teselas.set(clave, { prims: prims, instancias: salida.features.length });
        this.pintados += salida.features.length;
      } catch (err) {
        // Una tesela que falla no es un fallo del visualizador.
        console.debug('MVTLayer: tesela no cargada', clave, err);
      } finally {
        this.enCurso.delete(clave);
        this.enVuelo--;
        this._bombear();
      }
    }

    /* --- las primitivas --- */

    _pintar(features, z, x, y) {
      const Cesium = this.Cesium;
      const extent = this.lector.extent;

      // El paso de unidades de tesela a lon/lat va por el AFÍN de cuatro
      // esquinas. Pasa directamente a Cartesian3 sobre el elipsoide (altura 0)
      // para que Cesium.GroundPrimitive clasifique directamente sobre el MDT en la GPU.
      const esquina = crearAfín(z, x, y, extent);

      const aCartesian = (px, py) => {
        const ll = esquina(px, py);
        return Cesium.Cartesian3.fromDegrees(ll[0], ll[1], 0);
      };

      // Cesium NO tolera que el último punto del anillo repita el primero: con
      // `PolygonGeometry` eso revienta el render entero con "Cannot read
      // properties of undefined (reading 'length')" en `polygonsFromHierarchy`
      // (medido). Y el MVT siempre cierra el anillo, así que el último punto es
      // una copia del primero en el 100 % de los anillos (medido: 3 178 de
      // 3 178). Se quita.
      const anilloAPuntos = (anillo) => {
        const puntos = [];
        for (const p of anillo) {
          const c = aCartesian(p.x, p.y);
          if (!c) return null;
          puntos.push(c);
        }
        while (puntos.length > 1
          && puntos[0].equals(puntos[puntos.length - 1])) {
          puntos.pop();
        }
        return puntos.length >= 3 ? puntos : null;
      };

      const eps = 1.0;
      const esBordeTesela = (p1, p2) => {
        return (p1.x <= eps && p2.x <= eps)
          || (p1.x >= extent - eps && p2.x >= extent - eps)
          || (p1.y <= eps && p2.y <= eps)
          || (p1.y >= extent - eps && p2.y >= extent - eps);
      };

      const relleno = [];
      const bordes = [];

      for (const f of features) {
        for (const poli of f.poligonos) {
          const exterior = anilloAPuntos(poli.exterior);
          if (!exterior) continue;

          // LOS HUECOS VAN COMO `PolygonHierarchy` ANIDADO, no como array de
          // arrays. Es el bug que hacía que el 3D no pintara nada (medido):
          //
          //   new PolygonHierarchy(exterior, [[p1, p2, p3]])  -> se para el render
          //   new PolygonHierarchy(exterior, [jerarquiaHueco]) -> funciona
          const huecos = [];
          for (const h of poli.huecos) {
            const p = anilloAPuntos(h);
            if (p) huecos.push(new Cesium.PolygonHierarchy(p));
          }

          relleno.push(new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonGeometry({
              polygonHierarchy: new Cesium.PolygonHierarchy(exterior, huecos),
              perPositionHeight: false,
            }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                Cesium.Color.fromCssColorString(f.color)
              ),
            },
            id: { codigo: f.codigo, nombre: f.nombre },
          }));

          // Para los bordes: se filtran los segmentos que caen exactamente sobre
          // los límites de la tesela (creados por recortaAnillo) para que no se
          // dibujen líneas negras parásitas de la cuadrícula de teselado.
          if (ANCHO_BORDE > 0) {
            for (const anillo of [poli.exterior].concat(poli.huecos)) {
              if (!anillo || anillo.length < 2) continue;
              let cadena = [];
              for (let i = 0; i < anillo.length - 1; i++) {
                const p1 = anillo[i];
                const p2 = anillo[i + 1];
                if (esBordeTesela(p1, p2)) {
                  if (cadena.length >= 2) bordes.push(cadena);
                  cadena = [];
                } else {
                  if (cadena.length === 0) {
                    const c1 = aCartesian(p1.x, p1.y);
                    if (c1) cadena.push(c1);
                  }
                  const c2 = aCartesian(p2.x, p2.y);
                  if (c2) cadena.push(c2);
                }
              }
              if (cadena.length >= 2) bordes.push(cadena);
            }
          }
        }
      }

      const prims = [];

      // EL RELLENO VA EN `GroundPrimitive`, QUE ES EL clampToGround DE VERDAD.
      //
      // `GroundPrimitive` clasifica en tiempo real sobre la superficie del MDT en la GPU.
      if (relleno.length) {
        for (let i = 0; i < relleno.length; i += POLIGONOS_POR_LOTE) {
          prims.push(this.scene.primitives.add(new Cesium.GroundPrimitive({
            geometryInstances: relleno.slice(i, i + POLIGONOS_POR_LOTE),
            appearance: new Cesium.PerInstanceColorAppearance({ flat: true }),
            classificationType: Cesium.ClassificationType.TERRAIN,
          })));
        }
      }

      // El borde, aparte: `GroundPolylinePrimitive` subdivide contra el terreno.
      if (bordes.length) {
        prims.push(this.scene.primitives.add(new Cesium.GroundPolylinePrimitive({
          geometryInstances: bordes.map((puntos) => new Cesium.GeometryInstance({
            geometry: new Cesium.GroundPolylineGeometry({
              positions: puntos,
              width: ANCHO_BORDE,
            }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                Cesium.Color.fromCssColorString(COLOR_BORDE)
              ),
            },
          })),
          appearance: new Cesium.PolylineColorAppearance(),
          classificationType: Cesium.ClassificationType.TERRAIN,
        })));
      }

      return prims;
    }

    _quitar(prims) {
      for (const p of prims) {
        try { this.scene.primitives.remove(p); } catch (e) { /* ya estaba fuera */ }
      }
    }

    _quitarTodas() {
      for (const info of this.teselas.values()) this._quitar(info.prims);
      this.teselas.clear();
      this.pintados = 0;
    }

    /* --- la vista --- */

    rectanguloVisible() {
      const Cesium = this.Cesium;
      if (!this.scene) return null;
      const camara = this.scene.camera;
      const ancho = this.scene.canvas.clientWidth;
      const alto = this.scene.canvas.clientHeight;
      if (!ancho || !alto) return null;

      // `camera.pickEllipsoid` NO vale: con la cámara inclinada, los puntos del
      // lienzo fuera del horizonte no cortan el elipsoide. Se usa el rayo contra
      // el globo. Y como con la cámara muy inclinada SOLO el centro toca el globo
      // (medido: con la vista de la península las cuatro esquinas dan null), se
      // barre una rejilla y no solo las esquinas.
      //
      // Con un único punto el rectángulo sale degenerado (oeste === este), y de
      // ahí `zoomAdecuado` ve un ancho de 0,0001° y pide z14, una tesela
      // diminuta: hay que tener al menos dos puntos para acotar.
      //
      // LA REJILLA TIENE QUE LLEGAR A LOS BORDES DEL LIENZO. Antes barria de 0,1
      // a 0,9, y con eso se perdía el 10 % de cada lado. Como `refrescar()` solo
      // pide las teselas de este rectángulo, lo que se quedaba fuera no se
      // pintaba NUNCA y el relleno se cortaba en una línea recta, con el terreno
      // al otro lado sin coropleta (medido: el 8,8 % de los puntos de la pantalla
      // caían fuera del rectángulo, y con la cámara sobre la Sierra el sur se
      // quedaba 0,22° corto, casi 25 km).
      //
      // EL PASO NO HACE FALTA QUE SEA FINO. Medido contra un muestreo de 39 201
      // puntos de referencia (paso 0,005, o sea 200x200 rayos), en tres cámaras
      // distintas (inclinada sobre la Sierra, cenital sobre Madrid y vista de
      // la península):
      //
      //   25 rayos de 0,10 a 0,90 (la de antes) -> 8,778 % de la pantalla fuera
      //  625 rayos de 0,02 a 0,98              -> 0,135 % fuera, 1043 ms
      //   49 rayos de 0,01 a 0,99, margen 4 %  -> 0,000 % fuera, 17 ms
      //
      // Los 49 dan cobertura COMPLETA y son 60 veces más baratos que los 625,
      // porque `globe.pick` no es aritmética: es una intersección rayo-terreno
      // y cuesta unos 2 ms cada uno (medido). Los puntos van repartidos de 0,01 a
      // 0,99 para que los cuatro bordes del lienzo estén dentro de la rejilla,
      // que es justo lo que fallaba antes.
      const grados = [];
      for (let i = 0; i < 7; i++) {
        const fy = 0.01 + (0.98 * i) / 6;
        for (let j = 0; j < 7; j++) {
          const fx = 0.01 + (0.98 * j) / 6;
          const rayo = camara.getPickRay(
            new Cesium.Cartesian2(ancho * fx, alto * fy)
          );
          const punto = rayo ? this.scene.globe.pick(rayo, this.scene) : null;
          if (punto) {
            const c = Cesium.Cartographic.fromCartesian(punto);
            grados.push([Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)]);
          }
        }
      }

      if (grados.length < 2) return null;

      const longs = grados.map((g) => g[0]);
      const lats = grados.map((g) => g[1]);

      // Margen del 4 % del ancho y del alto, para que el borde de la pantalla no
      // caiga justo en el borde de la última tesela que se pide. Sin esto, al
      // acercar la cámara el borde del lienzo asoma por detrás de la coropleta y
      // se ve una franja de terreno sin pintar que se mueve al hacer zoom.
      // Medido: con 2 % se quedaba sin pintar el 0,7 % del borde oeste; con 4 %,
      // nada (medido en tres cámaras).
      const margenLon = (Math.max.apply(null, longs) - Math.min.apply(null, longs)) * 0.04;
      const margenLat = (Math.max.apply(null, lats) - Math.min.apply(null, lats)) * 0.04;

      return {
        oeste: Math.min.apply(null, longs) - margenLon,
        este: Math.max.apply(null, longs) + margenLon,
        norte: Math.max.apply(null, lats) + margenLat,
        sur: Math.min.apply(null, lats) - margenLat,
      };
    }

    // Una tesela por algo más de la pantalla. Con un factor mayor el zoom salía
    // tan bajo que la costa se veía en escalera: los vértices del MVT están
    // cuantizados a unidades de tesela, así que a z5 un vértice son 305 m.
    zoomAdecuado(rect) {
      const anchoLon = Math.max(0.0001, rect.este - rect.oeste);
      let z = Math.round(Math.log2(360 / Math.max(0.0001, anchoLon * 1.15)));
      if (z < ZOOM_MIN) z = ZOOM_MIN;
      if (z > ZOOM_MAX) z = ZOOM_MAX;
      return z;
    }
  }

  /* ------------------------------------------------------------------ *
   * La capa: estructura de IDEE.layer.MVT para Cesium
   *
   * Se construye dentro de `_instalar()` y no al cargar el script porque la
   * clase base cambia con cada recarga del bundle al alternar 2D/3D: si se
   * capturara aquí, heredaría de la del otro bundle.
   * ------------------------------------------------------------------ */

  // La implementación hereda de la de Vector real de Cesium, que es la que trae
  // el contrato (`isLoaded`, `on`, `getFeatures`...). Aquí solo se le añade la
  // lectura; el dibujo, cuando se retome, tiene que ir en `addTo`/`refresh`.
  function crearImplementacion(BaseImpl) {
    return class MVTImplVector extends BaseImpl {
      constructor(parameters, options, vendorOptions) {
        super(parameters, options, vendorOptions);
        const p = parameters || {};
        this.lector = new LectorMVT({
          url: p.url,
          capas: p.layers,
          extent: p.extent || 4096,
        });
        this.render = new RenderMVT(this);
        this.featuresLeidas = [];
      }

      // OJO con el nombre: `VectorImpl` (la clase base de la que hereda esta)
      // YA tiene un `refrescar()` propio, así que si aquí se llamara igual el
      // método de la base taparía al nuestro y la capa no pintaría nunca
      // (medido: `impl.refrescar !== render.refrescar`, y lo que se ejecutaba era
      // el de la base, que no sabe nada de teselas).
      refrescarMVT() {
        this.render.refrescar();
      }

      addTo(map) {
        super.addTo(map);
        this.render.addTo(map);
      }

      destroy() {
        this.render.destroy();
        super.destroy();
      }

      /** El color de cada municipio. Lo pone el visualizador. */
      setColorFunction(fn) {
        this.lector.setColorFunction(fn);
      }

      /**
       * Punto de entrada para iterar sobre la lectura:
       *   capa.getImpl().cargar(5, 16, 12).then(console.log)
       * @returns {Promise<Object>} Lo que devuelve `LectorMVT.cargarTesela`.
       */
      cargar(z, x, y) {
        return this.lector.cargarTesela(z, x, y).then((salida) => {
          this.featuresLeidas = salida.features;
          return salida;
        });
      }

      /** @returns {number} Municipios pintados ahora mismo en pantalla. */
      get pintados() {
        return this.render.pintados;
      }
    };
  }

  // La fachada que se registra como `IDEE.layer.MVT` en 3D.
  function crearFachada(Base, ImplMVT) {
    return class FachadaMVT extends Base {
      constructor(parameters, options, vendorOptions) {
        const impl = new ImplMVT(parameters, options, vendorOptions);
        super(parameters, options, vendorOptions, impl);
        impl.facade = this;
        this.minZoom = parameters && parameters.minZoom;
        this.maxZoom = parameters && parameters.maxZoom;
      }

      // Sin render no hay entidades de la API que devolver. Cuando se retome el
      // dibujado, aquí habrá que mapear las features de la tesela.
      getFeatures() {
        return [];
      }

      getFeatureById() {
        return [];
      }

      getGeometryType() {
        return null;
      }

      /** El lector, para iterar desde la consola. */
      getLector() {
        return this.getImpl().lector;
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * El plugin
   * ------------------------------------------------------------------ */

  class miPlugin_MVTLayer {
    constructor(options) {
      this.name = 'miPlugin_MVTLayer';
      this.options = options || {};
      this._map = null;
      this._instalado = false;
      this._fachada = null;
    }

    getHelp() {
      const IDEE = api();
      return {
        title: 'MVT en 3D',
        content: new Promise((resolve) => {
          let html = '<div><p>Da soporte 3D a <code>IDEE.layer.MVT</code>. El bundle de '
            + 'Cesium deja su implementación como un módulo vacío, así que el plugin '
            + 'registra una fachada propia. La capa se crea con la misma definición '
            + 'que en 2D.</p></div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            html = IDEE.utils.stringToHtml(html);
          }
          resolve(html);
        }),
      };
    }

    addTo(map) {
      this._map = map;
      this._instalar();
    }

    // Se sustituye `IDEE.layer.MVT`, y solo en Cesium: en 2D la clase del
    // bundle, que es la de OpenLayers, se deja intacta.
    //
    // Se sigue vigilando después porque el bundle de Cesium reemplaza todo
    // `window.IDEE` cuando termina de cargar, y la clase puesta antes se pierde.
    // Por eso no se da por instalada a la primera, sino que se comprueba.
    _instalar(intentos) {
      const n = intentos || 0;
      const IDEE = api();

      if (IDEE && IDEE.impl && IDEE.impl.cesium && IDEE.layer && IDEE.impl.layer) {
        const Base = IDEE.layer.Vector;
        const BaseImpl = IDEE.impl.layer.Vector;
        if (typeof Base === 'function' && typeof BaseImpl === 'function' &&
            IDEE.layer.MVT !== this._fachada) {
          this._fachada = crearFachada(Base, crearImplementacion(BaseImpl));

          IDEE.layer.MVT = this._fachada;
          if (window.M && window.M.layer && window.M.layer !== IDEE.layer) {
            window.M.layer.MVT = this._fachada;
          }
        }

        if (IDEE.layer.MVT === this._fachada) {
          this._instalado = true;
          return true;
        }
      }

      // Se sigue vigilando: si el namespace aún no existe o el bundle lo
      // reemplaza, hay que volver a ponerla. ~3 s a base de 100 ms.
      if (n < 30) setTimeout(() => this._instalar(n + 1), 100);
      return false;
    }

    destroy() {
      this._map = null;
    }

    // Contrato de estado para el cambio 2D/3D. Este plugin no tiene UI que
    // rehidratar: la instalación se vuelve a hacer en cada addTo.
    getState() {
      return {};
    }

    setState(state, map) {
      if (map) this._map = map;
      this._instalar();
    }
  }

  // Exposición triple, como el resto de extensiones del proyecto: el
  // coordinador de cambio de implementación reinicia IDEE.plugin al recargar el
  // bundle, pero el global directo persiste en la ventana.
  if (typeof window !== 'undefined') {
    window.miPlugin_MVTLayer = miPlugin_MVTLayer;
    window.LectorMVT = LectorMVT;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_MVTLayer = miPlugin_MVTLayer;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_MVTLayer = miPlugin_MVTLayer;
  }
})();
