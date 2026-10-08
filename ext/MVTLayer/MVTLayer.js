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
        this.featuresLeidas = [];
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
