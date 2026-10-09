/*
 * miPlugin_geotiffLayer: da soporte 3D a `IDEE.layer.GeoTIFF`.
 *
 * QUÉ HAY AQUÍ
 *
 * 1. Una fachada para `IDEE.layer.GeoTIFF` en Cesium, registrada igual que hace
 *    `ext/MVTLayer` con `IDEE.layer.MVT`: el visualizador escribe
 *    `new IDEE.layer.GeoTIFF({...})` y no sabe nada de las dos implementaciones.
 *
 * 2. El LECTOR, sin Cesium: `LectorGeoTIFF` abre un GeoTIFF (en memoria o por
 *    URL), lee su extensión y lo pinta en un canvas.
 *
 * 3. El DIBUJADO, en Cesium: una `SingleTileImageryProvider` sobre el
 *    `Rectangle` que ocupa la imagen, que es el clampToGround de Cesium.
 *
 *
 * POR QUÉ HACE FALTA UNA FACHADA PROPIA (medido)
 *
 * En el bundle de Cesium la capa GeoTIFF está declarada pero no implementada, y
 * no es que falte registrarla: el constructor pide la implementación a un módulo
 * de webpack que es un stub. Medido en el bundle de Cesium:
 *
 *   IDEE.layer.GeoTIFF            -> function (existe la fachada)
 *   IDEE.impl.layer.GeoTIFF       -> undefined (el módulo es un stub)
 *
 * Y aquí hay una diferencia con MVT que obliga a ir por otro lado. La fachada de
 * MVT se podía sustituir heredando de `IDEE.layer.Vector`, porque esa clase sí
 * acepta la implementación por parámetro. La de GeoTIFF no: **lanza antes de
 * mirar los argumentos**, porque hace
 *
 *   throw IDEE.exception.geoTIFFlayer_method
 *
 * y esa clave NO existe en el bundle de Cesium (medido: `Object.keys(IDEE.exception)`
 * no tiene ninguna clave con `geo` o `tif`). O sea que lo que salta es el string
 * `"undefined"`, y da igual cuántos argumentos se le pasen: probados 0, 3 y 4, los
 * tres fallan igual. Tampoco vale `extends IDEE.layer.GeoTIFF`.
 *
 * La salida es la misma que en MVTLayer, solo que apoyada en la clase BASE de las
 * capas en vez de en la fachada concreta. `IDEE.layer.GeoTIFF` y
 * `IDEE.layer.Vector` cuelgan de la misma base:
 *
 *   GeoTIFF      -> h -> c -> o -> o -> ...
 *   Vector       -> A -> c -> o -> o -> ...
 *                     ^
 *                     la base de todas las capas, `c`
 *
 * Y su constructor tiene la firma `constructor(userParameters, impl)`: la
 * implementación va como SEGUNDO argumento, no como cuarto (medido: pasando
 * `super(p, o, v, impl)` la base recibe `o` como implementación y `getImpl()`
 * devuelve el objeto equivocado; con `super(p, impl)` devuelve el mío).
 *
 *
 * LO QUE HACE, EN UNA LÍNEA
 *
 * Abre el GeoTIFF, lo pinta en un canvas y lo drapea sobre el terreno dentro de
 * la extensión que ocupa el fichero. En 2D no hace nada: ahí lo dibuja
 * OpenLayers con `ol.source.GeoTIFF`, que es lo que hay que hacer.
 *
 *
 * POR QUÉ UN SingleTileImageryProvider Y NO UNA CUADRÍCULA
 *
 * Medido en el bundle de Cesium (1.134.0): de los proveedores de imagen NO están
 * ni `GeoTIFFImageryProvider`, ni `ImageCanvasImageryProvider`, ni
 * `CanvasImageryProvider`, ni `TiledImageryProvider`. El único que queda es
 * `SingleTileImageryProvider`, que es además lo que corresponde: un GeoTIFF es
 * un fichero único con una extensión fija, no un servicio teselable.
 */
(function () {
  'use strict';

  // Acceso a la API, patrón del repo: en 2D es M, en 3D IDEE.
  function api() {
    return window.IDEE || window.M;
  }

  // Lado mayor del lienzo al que se rasteriza. Es un techo, no un destino: un
  // GeoTIFF de 20000x20000 se pinta en 2048 y se escala. El número es el mismo
  // que usa el visualizador en su `gdal_translate -outsize 2048 0`, para que las
  // dos implementaciones se vean igual de nítidas.
  const LADO_MAXIMO = 2048;

  /* ------------------------------------------------------------------ *
   * Dependencia: geotiff.js
   *
   * Va aquí, dentro del plugin, y no en el HTML del visualizador. Es la misma
   * decisión que en MVTLayer: el plugin se trae lo suyo y el HTML del visualizador
   * solo importa la API y los plugins.
   *
   * La importación es dinámica y a URL ABSOLUTA, con el sufijo `+esm` de jsDelivr,
   * que es lo que hace innecesario el `import map`: es el mismo paquete
   * reempaquetado con sus dependencias metidas dentro, así que al navegador no le
   * queda ningún nombre de paquete por resolver (medido).
   * ------------------------------------------------------------------ */

  const URL_GEOTIFF = 'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm';
  let promesaGeoTIFF = null;

  function cargarGeoTIFF() {
    if (!promesaGeoTIFF) {
      promesaGeoTIFF = import(URL_GEOTIFF).then(function (mod) {
        if (!mod || typeof mod.fromArrayBuffer !== 'function') {
          throw new Error('geotiff.js no ha exportado fromArrayBuffer');
        }
        return mod;
      });
    }
    return promesaGeoTIFF;
  }

  /* ------------------------------------------------------------------ *
   * Proyección: la extensión del fichero a lon/lat
   * ------------------------------------------------------------------ */

  // EPSG:3857 a EPSG:4326, fórmula cerrada. Es el caso normal (la mayoría de los
  // GeoTIFF que se suben a un visor están en Web Mercator) y no necesita proj4 ni
  // la API, así que no se puede romper por un orden de carga.
  function webMercatorALonLat(x, y) {
    const lon = (x / 20037508.342789244) * 180;
    const lat = (2 * Math.atan(Math.exp((y / 20037508.342789244) * Math.PI)) - Math.PI / 2)
      * (180 / Math.PI);
    return [lon, lat];
  }

  /**
   * La extensión en lon/lat (EPSG:4326) que ocupa el GeoTIFF.
   *
   * Se reproyectan las DOS esquinas opuestas, que es lo correcto: reproyectar el
   * centro y aplicar la mitad del ancho por los lados sólo vale si la proyección
   * es lineal, y en Web Mercator no lo es (las líneas de longitud constante se
   * curvan). Con dos esquinas el error es despreciable en la tamaño de un
   * fichero suelto.
   *
   * @param {Array<number>} bbox [minX, minY, maxX, maxY] en el SRC del fichero.
   * @param {string|number} epsg Código del SRC.
   * @returns {Array<Array<number>>} [[oeste, sur], [este, norte]].
   */
  async function bboxALonLat(bbox, epsg) {
    const [minX, minY, maxX, maxY] = bbox;
    const codigo = String(epsg || 'EPSG:4326').toUpperCase().replace('EPSG:', '');

    if (codigo === '4326') {
      return [[minX, minY], [maxX, maxY]];
    }
    if (codigo === '3857' || codigo === '900913' || codigo === '102100' || codigo === '3785') {
      return [webMercatorALonLat(minX, minY), webMercatorALonLat(maxX, maxY)];
    }

    // Cualquier otra proyección: se le pregunta a la API, que ya tiene los SRC
    // del catálogo de EPSG. Es asíncrono y no siempre está, y por eso esta
    // función también lo es.
    const IDEE = api();
    if (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function') {
      const src = 'EPSG:' + codigo;
      const p1 = await IDEE.utils.reproject([minX, minY], src, 'EPSG:4326');
      const p2 = await IDEE.utils.reproject([maxX, maxY], src, 'EPSG:4326');
      return [p1, p2];
    }

    throw new Error('No se sabe reproyectar de ' + src + ' a EPSG:4326');
  }

  /* ------------------------------------------------------------------ *
   * LectorGeoTIFF: la algoritmia de lectura, sin Cesium
   * ------------------------------------------------------------------ */

  class LectorGeoTIFF {
    /**
     * @param {Object} opciones
     * @param {Blob|string} opciones.blob Fichero en memoria, o su URL.
     * @param {number} [opciones.ladoMaximo=LADO_MAXIMO] Techo del lienzo.
     */
    constructor(opciones) {
      const o = opciones || {};
      this.blob = o.blob || null;
      this.url = o.url || null;
      this.ladoMaximo = o.ladoMaximo || LADO_MAXIMO;
      // Caché de imágenes ya pintadas, por identidad del fichero. La clave es el
      // propio blob cuando lo hay (los Blob no se comparan por valor y son
      // objetos únicos, así que sirve de identidad), y la URL cuando no.
      this._cache = new Map();
    }

    /**
     * Abre el GeoTIFF y lo pinta.
     * @returns {Promise<Object>} { canvas, rectangulo: [[o,s],[e,n]], ancho, alto, epsg }
     */
    async leer() {
      const clave = this.blob || this.url;
      if (clave && this._cache.has(clave)) return this._cache.get(clave);

      const mod = await cargarGeoTIFF();
      const buffer = await this._bytes();
      const tif = await mod.fromArrayBuffer(buffer);
      const imagen = await tif.getImage();

      const ancho = imagen.getWidth();
      const alto = imagen.getHeight();
      const muestras = imagen.getSamplesPerPixel();
      const bbox = imagen.getBoundingBox();
      const claves = imagen.getGeoKeys() || {};
      const epsg = this._epsgDe(claves);

      // Extensión en lon/lat. Sin bbox no hay dónde pintarlo: se avisa y ya.
      if (!bbox || bbox.length < 4 || !isFinite(bbox[0]) || !isFinite(bbox[2])) {
        throw new Error('El GeoTIFF no trae georreferenciación (sin bbox)');
      }
      const esquinas = await bboxALonLat(bbox, epsg);
      const rectangulo = [
        [Math.min(esquinas[0][0], esquinas[1][0]), Math.min(esquinas[0][1], esquinas[1][1])],
        [Math.max(esquinas[0][0], esquinas[1][0]), Math.max(esquinas[0][1], esquinas[1][1])],
      ];

      const canvas = await this._pintar(imagen, ancho, alto, muestras);

      const salida = { canvas: canvas, rectangulo: rectangulo, ancho: ancho, alto: alto, epsg: epsg };
      if (clave) {
        this._cache.set(clave, salida);
        // Un fichero subido cada vez y sin límite sería una fuga: aquí se
        // acotan las tres últimas imágenes.
        while (this._cache.size > 3) {
          this._cache.delete(this._cache.keys().next().value);
        }
      }
      return salida;
    }

    /** El SRC del fichero, de las claves GeoTIFF. */
    _epsgDe(claves) {
      if (claves.ProjectedCSTypeGeoKey) return 'EPSG:' + claves.ProjectedCSTypeGeoKey;
      if (claves.GeographicTypeGeoKey) return 'EPSG:' + claves.GeographicTypeGeoKey;
      // Sin clave proyectada: si el SRC es geográfico es 4326, que es lo único
      // que se puede suponer sin inventar.
      return 'EPSG:4326';
    }

    /** Los bytes del fichero, venga de un Blob o de una URL. */
    async _bytes() {
      if (this.blob) {
        return (await this.blob.arrayBuffer());
      }
      if (this.url) {
        const r = await fetch(this.url);
        if (!r.ok) throw new Error('HTTP ' + r.status + ' al bajar ' + this.url);
        return await r.arrayBuffer();
      }
      throw new Error('El GeoTIFF no tiene ni blob ni url');
    }

    /**
     * Pinta los píxeles en un canvas, estirados de su rango real a 0-255.
     *
     * EL ESTIRADO ES NECESARIO Y NO ES UN ADORNO. Un GeoTIFF de 16 bits con
     * valores entre 0 y 40000, pintados tal cual, salen casi negros: en Cesium un
     * PNG de 8 bits por canal solo sabe de 0 a 255, así que si no se estira se
     * pierde el contenido. Se calcula el mínimo y el máximo de cada banda y se
     * reparte entre 0 y 255, que es justo lo que hace `gdal_translate -scale` en
     * la ruta de GDAL.
     */
    async _pintar(imagen, ancho, alto, muestras) {
      const datos = await imagen.readRasters({ interleave: true });

      // Escala al techo, manteniendo la proporción.
      const escala = Math.min(1, this.ladoMaximo / Math.max(ancho, alto));
      const dstW = Math.max(1, Math.round(ancho * escala));
      const dstH = Math.max(1, Math.round(alto * escala));

      const canvas = document.createElement('canvas');
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext('2d');
      const img = ctx.createImageData(dstW, dstH);
      const out = img.data;

      // Mínimo y máximo por banda, para el estirado.
      const nB = Math.max(1, muestras);
      const min = new Array(nB).fill(Infinity);
      const max = new Array(nB).fill(-Infinity);
      const nPix = Math.floor(datos.length / muestras);
      for (let i = 0; i < nPix; i++) {
        for (let b = 0; b < nB; b++) {
          const v = datos[i * muestras + b];
          if (v < min[b]) min[b] = v;
          if (v > max[b]) max[b] = v;
        }
      }
      const rango = [];
      for (let b = 0; b < nB; b++) {
        rango.push(max[b] > min[b] ? max[b] - min[b] : 0);
      }

      // Qué banda va a cada canal. Con tres o más se toman las tres primeras,
      // que es el RGB; con una sola se reparte por los tres canales (escala de
      // grises); con dos, la primera va al gris y la segunda se ignora.
      const rB = 0;
      const gB = nB >= 3 ? 1 : 0;
      const bB = nB >= 3 ? 2 : 0;

      // Rellenado por bloques: se recorre la fuente píxel a píxel y se escribe en
      // el destino. Es más lento que `putImageData` sobre un lienzo del tamaño
      // original y luego escalar con el navegador, pero evita tener en memoria un
      // PNG del tamaño del fichero, que es justo lo que rompe con rásters grandes.
      for (let y = 0; y < dstH; y++) {
        // Índice de origen, redondeando al píxel de la fuente que cae en el centro
        // del píxel de destino. El `+0.5` es lo que hace que una reducción leve no
        // se vea sesgada.
        const fy = Math.min(alto - 1, Math.floor(((y + 0.5) / dstH) * alto));
        for (let x = 0; x < dstW; x++) {
          const fx = Math.min(ancho - 1, Math.floor(((x + 0.5) / dstW) * ancho));
          const i = fy * ancho + fx;
          const o = (y * dstW + x) * 4;
          if (i >= nPix) { out[o + 3] = 255; continue; }

          const vr = datos[i * muestras + rB];
          const vg = datos[i * muestras + gB];
          const vb = datos[i * muestras + bB];

          out[o] = rango[rB] ? Math.round(((vr - min[rB]) / rango[rB]) * 255) : 0;
          out[o + 1] = rango[gB] ? Math.round(((vg - min[gB]) / rango[gB]) * 255) : 0;
          out[o + 2] = rango[bB] ? Math.round(((vb - min[bB]) / rango[bB]) * 255) : 0;
          out[o + 3] = 255;
        }
      }

      ctx.putImageData(img, 0, 0);
      return canvas;
    }
  }

  /* ------------------------------------------------------------------ *
   * RenderGeoTIFF: el dibujado en Cesium
   * ------------------------------------------------------------------ */

  class RenderGeoTIFF {
    constructor(impl) {
      this.impl = impl;
      this.Cesium = null;
      this.scene = null;
      this.capaImagen = null;
      this._visible = true;
      this._cargando = false;
    }

    addTo(map) {
      this.map = map;
      this.Cesium = window.Cesium;
      this._esperarEscena(60);
    }

    /**
     * Para depurar desde la consola.
     * @returns {Object}
     */
    diagnostico() {
      return {
        hayEscena: Boolean(this.scene),
        hayCapa: Boolean(this.capaImagen),
        visible: this.isVisible(),
        cargando: this._cargando,
        rectangulo: this._rectangulo || null,
        lienzo: this._canvas ? [this._canvas.width, this._canvas.height] : null,
        error: this._error || null,
      };
    }

    setVisible(visible) {
      this._visible = Boolean(visible);
      if (this.capaImagen) {
        this.capaImagen.show = this._visible;
        if (this.scene && typeof this.scene.requestRender === 'function') {
          this.scene.requestRender();
        }
      }
    }

    isVisible() {
      if (this.capaImagen) return this.capaImagen.show;
      return this._visible !== false;
    }

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
        this.refrescar();
        return;
      }
      if (n > 0) setTimeout(() => this._esperarEscena(n - 1), 100);
    }

    refrescar() {
      if (this._cargando) return;
      this._cargando = true;
      this._error = null;

      const impl = this.impl;
      const Cesium = this.Cesium;
      const escena = this.scene;
      if (!escena || !Cesium) { this._cargando = false; return; }

      // Primero fuera la capa anterior, para no dejar la imagen vieja mientras se
      // lee la nueva (y para que un refresco con fichero nuevo no duplique).
      this._quitar();

      const lector = impl.lector;
      Promise.resolve(lector.leer()).then((salida) => {
        // El mapa puede haber cambiado entre la llamada y el `then`.
        if (this.scene !== escena || !this.map) return;

        const [[oeste, sur], [este, norte]] = salida.rectangulo;
        const rectangulo = Cesium.Rectangle.fromDegrees(oeste, sur, este, norte);
        this._rectangulo = [oeste, sur, este, norte];
        this._canvas = salida.canvas;

        // OJO con `tileWidth`/`tileHeight`: en el Cesium de este bundle (1.134) son
        // OBLIGATORIOS y sin ellos el constructor lanza "Expected
        // options.tileWidth to be typeof number, actual typeof was undefined"
        // (medido). En las versiones anteriores eran opcionales, así que si al
        // trasplantar esto a otro bundle sobran, no pasa nada.
        const proveedor = new Cesium.SingleTileImageryProvider({
          url: salida.canvas.toDataURL('image/png'),
          rectangle: rectangulo,
          tileWidth: salida.canvas.width,
          tileHeight: salida.canvas.height,
        });

        this.capaImagen = escena.imageryLayers.addImageryProvider(proveedor);
        this.capaImagen.show = this._visible !== false;

        // El ajuste de opacidad va por la capa de la API, que es quien la tiene
        // declarada; el provider no lleva alpha.
        if (impl.opacity !== undefined && this.capaImagen) {
          this.capaImagen.alpha = Number(impl.opacity);
        }

        if (typeof escena.requestRender === 'function') escena.requestRender();
        if (impl.onCargada) impl.onCargada(salida);
      }).catch((err) => {
        this._error = String((err && err.message) || err);
        // No es un fallo del visualizador: es que este fichero no se puede
        // pintar en 3D. Se avisa y se sigue.
        console.warn('geotiffLayer: no se pudo pintar el GeoTIFF en 3D:', err);
      }).then(() => {
        this._cargando = false;
      });
    }

    _quitar() {
      if (this.capaImagen && this.scene) {
        try { this.scene.imageryLayers.remove(this.capaImagen, true); } catch (e) { /* ya fuera */ }
      }
      this.capaImagen = null;
    }

    destroy() {
      this._quitar();
      this.scene = null;
      this.map = null;
    }
  }

  /* ------------------------------------------------------------------ *
   * La capa: estructura de IDEE.layer.GeoTIFF para Cesium
   * ------------------------------------------------------------------ */

  /**
   * La implementación. Hereda de la que la API usa para las capas vectoriales de
   * Cesium porque es la que trae el contrato (`isLoaded`, `on`, `refresh`...), y
   * solo se le añade la lectura del GeoTIFF y el dibujado.
   * @param {Function} BaseImpl Clase de implementación de la base de capas.
   * @returns {Function}
   */
  function crearImplementacion(BaseImpl) {
    return class GeoTIFFImplRaster extends BaseImpl {
      constructor(parameters, options, vendorOptions) {
        super(parameters, options, vendorOptions);
        const p = parameters || {};
        this.lector = new LectorGeoTIFF({
          blob: p.blob,
          url: p.url,
        });
        this.render = new RenderGeoTIFF(this);
        this.onCargada = null;
      }

      // OJO con el nombre: la clase base YA tiene un `refresh()` propio, así que
      // si aquí se llamara igual, el método de la base taparía al nuestro y la
      // capa no se pintaría nunca. Es el mismo apaño que usa MVTLayer.
      refrescarGeoTIFF() {
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

      setVisible(visible) {
        try { super.setVisible(visible); } catch (e) { /* la base puede no tenerlo */ }
        this.render.setVisible(visible);
      }

      isVisible() {
        return this.render.isVisible();
      }

      /** Extensión en lon/lat del fichero, una vez leido. */
      getBoundingBox() {
        return this.render._rectangulo || null;
      }
    };
  }

  /**
   * La fachada que se registra como `IDEE.layer.GeoTIFF` en 3D.
   * @param {Function} Base La clase base de las capas.
   * @param {Function} ImplGeoTIFF La implementación de arriba.
   * @returns {Function}
   */
  function crearFachada(Base, ImplGeoTIFF) {
    return class FachadaGeoTIFF extends Base {
      /**
       * OJO con el `super`: la firma de la base es
       * `constructor(userParameters, impl)`. La implementación va como SEGUNDO
       * argumento, no como cuarto (medido: con `super(p, o, v, impl)` la base
       * recibe `o` como implementación y `getImpl()` devuelve otra cosa).
       */
      constructor(parameters, options, vendorOptions, impl) {
        // La implementación se INSTANCIA AQUÍ, no se espera que venga dada. La
        // base `c` no construye nada: recibe un objeto ya hecho en su segundo
        // argumento y lo guarda. O sea que la fachada es quien tiene que
        // crearlo, igual que hace MVTLayer.
        //
        // OJO con el `super`: la firma de la base es
        // `constructor(userParameters, impl)`. La implementación va como SEGUNDO
        // argumento, no como cuarto (medido: con `super(p, o, v, impl)` la base
        // recibe `o` como implementación y `getImpl()` devuelve otra cosa).
        //
        // Y si aquí se pasara el `impl` sin instanciar, el fallo sale mucho más
        // tarde y sin decir por qué (medido: `getImpl()` devuelve `undefined`,
        // y lo primero que la base hace es `this.url = n.url`, que va al setter
        // `set url(e) { this.getImpl().url = e }` y revienta con "Cannot set
        // properties of undefined (setting 'url')").
        const miImpl = impl || new ImplGeoTIFF(parameters, options, vendorOptions);
        super(parameters, miImpl);
        miImpl.facade = this;

        const p = parameters || {};
        this.minZoom = p.minZoom;
        this.maxZoom = p.maxZoom;
        // `url` y `blob` NO se vuelven a poner aquí. La base ya los saca de los
        // parámetros, y además define un `set url(e) { this.getImpl().url = e }`,
        // o sea que reasignarlos dispara ese setter sin necesidad.

        // EL TIPO SE DEJA COMO VIENE, a propósito. Se ha probado a fijarlo a
        // 'GeoTIFF' y NO PUEDE: la base valida el tipo contra la lista de tipos
        // que declara la API, y en el bundle de Cesium 'GeoTIFF' no está (no hay
        // implementación, así que tampoco se registró el tipo). Con el tipo
        // forzado la capa ni siquiera se creaba y el aviso era
        // "El tipo de capa debe ser 'undefined' pero se ha especificado
        // 'GeoTIFF'" (medido).
        //
        // Quédate entonces con `type` en `undefined`, que es lo que produce el
        // propio parser de la API con esta fachada. No molesta: el selector de
        // capas lo lista igual y su botón de visibilidad funciona.
      }

      /** La implementación para iterar desde la consola. */
      getImplGeoTIFF() {
        return this.getImpl();
      }

      getFeatures() {
        return [];
      }

      getFeatureById() {
        return [];
      }

      getGeometryType() {
        return null;
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * El plugin
   * ------------------------------------------------------------------ */

  // Última instancia creada del plugin. Vive fuera de la clase a propósito: la
  // clase se reinstancia al cambiar de implementación y hay que poder preguntar
  // por la que está viva ahora.
  let INSTANCIA = null;

  class miPlugin_geotiffLayer {
    constructor(options) {
      this.name = 'miPlugin_geotiffLayer';
      this.options = options || {};
      this._map = null;
      this._fachada = null;
      // Se guarda la última instancia viva, para que quien cree una capa pueda
      // esperarla (ver `cuandoInstalado`). Solo hay una a la vez: al cambiar de
      // implementación esta clase se vuelve a instanciar desde cero.
      INSTANCIA = this;
    }

    getHelp() {
      const IDEE = api();
      return {
        title: 'GeoTIFF en 3D',
        content: new Promise((resolve) => {
          let html = '<div><p>Da soporte 3D a <code>IDEE.layer.GeoTIFF</code>. El bundle de '
            + 'Cesium deja su implementación como un módulo vacío, así que el plugin '
            + 'registra una fachada propia. La capa se crea con la misma definición '
            + 'que en 2D: <code>new IDEE.layer.GeoTIFF({ name, blob })</code>.</p></div>';
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

    /**
     * Promesa que se cumple cuando la fachada ya está registrada.
     *
     * HACE FALTA PORQUE HAY UNA CARRERA. `addTo()` instala la fachada, pero la
     * instalación va por sondeo cada 100 ms (hasta 3 s), porque el bundle de
     * Cesium sustituye `window.IDEE` cuando termina de cargar y hay que volver a
     * ponerla. Mientras tanto, `new IDEE.layer.GeoTIFF(...)` sigue siendo la del
     * bundle, que lanza (medido: en un ciclo funcionó y en el siguiente no, solo
     * por ganar o perder esta carrera). Quien cree la capa tiene que poder
     * esperar a que el plugin esté listo en vez de confiar en el orden.
     *
     * @param {number} [timeout=5000] Tope de seguridad, en milisegundos.
     * @returns {Promise<boolean>} `true` si quedó instalada.
     */
    cuandoInstalado(timeout) {
      const limite = timeout || 5000;
      if (this._instaladoYa()) return Promise.resolve(true);
      return new Promise((resolve) => {
        const t0 = Date.now();
        const comprobar = () => {
          if (this._instaladoYa()) { resolve(true); return; }
          if (Date.now() - t0 > limite) { resolve(false); return; }
          setTimeout(comprobar, 50);
        };
        comprobar();
      });
    }

    _instaladoYa() {
      const IDEE = api();
      return Boolean(IDEE && IDEE.layer && IDEE.layer.GeoTIFF === this._fachada);
    }

    /**
     * Sustituye `IDEE.layer.GeoTIFF`, y solo en Cesium: en 2D la clase del
     * bundle, que es la de OpenLayers con `ol.source.GeoTIFF`, se deja intacta.
     *
     * Se sigue vigilando después porque el bundle de Cesium reemplaza todo
     * `window.IDEE` cuando termina de cargar, y la clase puesta antes se pierde.
     * Por eso no se da por instalada a la primera, sino que se comprueba.
     * @param {number} [intentos]
     * @returns {boolean} Si ya está instalada.
     */
    _instalar(intentos) {
      const n = intentos || 0;
      const IDEE = api();

      if (IDEE && IDEE.impl && IDEE.impl.cesium && IDEE.layer && IDEE.impl.layer) {
        const GeoTIFF = IDEE.layer.GeoTIFF;
        const Vector = IDEE.layer.Vector;

        // LA BASE DE LAS CAPAS, para la fachada. Es el padre de `GeoTIFF` y de
        // `Vector` a la vez (medido: las dos cadenas son `h|A -> c -> o -> o`), y
        // de ahí sale que la fachada se pueda construir sin depender de la clase
        // concreta que no funciona. Se saca de `Vector` porque en 2D `GeoTIFF` es
        // de otra rama.
        const Base = Vector
          ? Object.getPrototypeOf(Vector.prototype).constructor
          : null;

        // LA BASE DE LAS IMPLEMENTACIONES, que es una cosa DISTINTA de la
        // anterior: la capa por un lado y su implementación por otro. Se coge de
        // `impl.layer.Vector` porque es la que trae el contrato completo
        // (`isLoaded`, `on`, `refresh`...), igual que usa MVTLayer.
        //
        // OJO con la confusión, que es fácil y falla tarde: pasar aquí la clase
        // base de las capas, como `crearImplementacion(Base)`, NO peta al crear la
        // capa, pero deja la instancia a medias y el fallo sale después y en un
        // sitio que no señala al motivo (medido: al montar la escena salía
        // "Cannot set properties of undefined (setting 'url')", dentro del
        // `set url` de la base, que es `this.getImpl().url = e`; es que
        // `getImpl()` devolvía undefined porque la implementación no era de la
        // familia correcta).
        const BaseImpl = IDEE.impl.layer.Vector || null;

        if (typeof Base === 'function' && typeof BaseImpl === 'function'
          && GeoTIFF !== this._fachada && !IDEE.impl.layer.GeoTIFF) {
          this._fachada = crearFachada(Base, crearImplementacion(BaseImpl));

          IDEE.layer.GeoTIFF = this._fachada;
          if (window.M && window.M.layer && window.M.layer !== IDEE.layer) {
            window.M.layer.GeoTIFF = this._fachada;
          }
        }

        if (IDEE.layer.GeoTIFF === this._fachada) return true;
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
    window.miPlugin_geotiffLayer = miPlugin_geotiffLayer;
    window.LectorGeoTIFF = LectorGeoTIFF;

    /**
     * Espera a que la fachada de `IDEE.layer.GeoTIFF` esté registrada en 3D.
     *
     * Para llamarlo desde el visualizador sin tener que buscar la instancia del
     * plugin, que en 3D cambia con cada conmutación y en 2D no existe.
     * @param {number} [timeout=5000] Tope de seguridad, en milisegundos.
     * @returns {Promise<boolean>}
     */
    window.geotiffLayerCuandoInstalado = function (timeout) {
      if (INSTANCIA && typeof INSTANCIA.cuandoInstalado === 'function') {
        return INSTANCIA.cuandoInstalado(timeout);
      }
      return Promise.resolve(false);
    };

    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_geotiffLayer = miPlugin_geotiffLayer;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_geotiffLayer = miPlugin_geotiffLayer;
  }
})();