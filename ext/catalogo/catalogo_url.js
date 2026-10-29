/* =====================================================================
   CatalogoURL: detección del tipo de capa a partir de una URL
   ---------------------------------------------------------------------
   Es la parte que faltaba: decidir QUÉ es lo que hay en una URL antes de
   poder cargarlo, y preguntar al usuario qué capas quiere y cómo quiere
   llamarlas.

   El criterio sigue el del selector de capas de la propia API-IDEE, que
   también tiene que deducir el tipo desde la URL antes de poder crear la capa.
   Aquí se ha desarrollado en una tabla explícita, con el orden de aplicación
   que se detalla justo debajo.

   La tabla se aplica EN ORDEN: gana la primera regla que encaja. El orden
   importa, porque una misma URL puede encajar en varias: una plantilla de
   teselas `{z}/{x}/{y}.png` también contiene "png", y un OGC API Features
   devuelve JSON.

     1. Ficheros: la extensión lo dice todo (.mbtiles, .gpkg, .tif, .kml...).
     2. Plantillas de teselas: {z}/{x}/{y} -> XYZ (imagen) o MVT (.pbf).
     3. Parámetros OGC: SERVICE=WMS|WMTS|WFS|WCS.
     4. Por defecto, WMS: es lo que devuelve la mayoría de portales IDEE.

   ===================================================================== */
(function () {
  'use strict';

  /**
   * Una dirección `s3://cubo/ruta` en la forma HTTPS de S3.
   *
   * POR QUÉ HACE FALTA: `s3://` no es un esquema que entienda un navegador.
   * Es propio de la AWS CLI y de los SDKs, no un protocolo de red, así que no
   * hay forma de pedirlo desde el cliente: ni fetch, ni XHR, ni un `<img>`, ni
   * un Service Worker, ni el AWS SDK para JS (que además va con firma). La
   * única vía es reescribirlo a HTTPS, en la forma virtual-hosted de S3.
   *
   * Medido sobre el DEM de Copernicus: `https://<cubo>.s3.amazonaws.com/<ruta>`
   * responde 200, `image/tiff` y `Accept-Ranges: bytes` (que es lo que pide
   * un COG para leer solo la cabecera). La forma `s3.amazonaws.com/<cubo>/`
   * devuelve 301 y no hay que usarla.
   *
   * @param {string} url
   * @returns {string} La misma URL en HTTPS si era s3://; si no, intacta.
   */
  function httpDeS3(url) {
    const limpio = String(url || '').trim();
    if (!/^s3:\/\//i.test(limpio)) return limpio;
    const cuerpo = limpio.replace(/^s3:\/\//i, '');
    const barra = cuerpo.indexOf('/');
    if (barra < 0) return limpio;
    const cubo = cuerpo.slice(0, barra);
    const ruta = cuerpo.slice(barra + 1);
    return 'https://' + cubo + '.s3.amazonaws.com/' + ruta;
  }

  /** Tipos que la API puede crear (comprobados antes de instanciar). */
  const TIPOS_API = {
    WMS: 'WMS',
    WMTS: 'WMTS',
    WFS: 'WFS',
    WCS: 'WCS',
    XYZ: 'XYZ',
    TMS: 'TMS',
    MVT: 'MVT',
    GeoJSON: 'GeoJSON',
    KML: 'KML',
    GPX: 'GPX',
    GML: 'GML',
    CSV: 'CSV',
    SHP: 'SHP',
    GeoTIFF: 'GeoTIFF',
    MBTiles: 'MBTiles',
    GeoPackage: 'GeoPackage',
    OGCAPIFeatures: 'OGCAPIFeatures',
    MapLibre: 'MapLibre',
    // Capas de las extensiones propias que la API no trae de serie. El catálogo
    // carga sus JS al arrancar (ver EXTENSIONES_FORMATO en catalogo.js).
    COPC: 'COPC',
    PMTiles: 'PMTiles',
    FlatGeobuf: 'FlatGeobuf',
    GeoParquet: 'GeoParquet',
    IFC: 'IFC',
    // Recursos de las extensiones propias que NO son servicios: son ficheros
    // sueltos sin georreferenciación, así que además del tipo hay que decir
    // dónde van (posición o rectángulo). Ver ext/glbLayer y ext/imageLayer.
    GLB: 'GLB',
    Imagen: 'Imagen'
  };

  /**
   * Tipos que necesitan colocación (posición o rectángulo) para poder pintarse.
   * El panel del catálogo enseña el formulario de colocación solo con estos.
   */
  const TIPOS_COLOCABLES = ['GLB', 'Imagen'];

  /**
   * Nombre del constructor de la API para cada tipo.
   *
   * La clave del tipo es la que se ve en la interfaz (`GLB`, `Imagen`), pero
   * las clases se llaman `IDEE.layer.glb` e `IDEE.layer.image`. El resto de
   * tipos coinciden, así que lo que no esté aquí se usa tal cual.
   */
  const CONSTRUCTORES = {
    GLB: 'glb',
    Imagen: 'image'
  };

  /** ¿Este tipo hay que colocarlo a mano en el mapa? */
  function esColocable(tipo) {
    return TIPOS_COLOCABLES.indexOf(String(tipo || '')) > -1;
  }

  /** Nombre de la clase de la API que construye un tipo. */
  function nombreConstructor(tipo) {
    return CONSTRUCTORES[tipo] || tipo;
  }

  /** Etiquetas legibles de cada tipo, para los mensajes de la interfaz. */
  const ETIQUETAS = {
    WMS: 'WMS (servidor de mapas)',
    WMTS: 'WMTS (teselas pregeneradas)',
    WFS: 'WFS (servidor de entidades)',
    WCS: 'WCS (coberturas)',
    XYZ: 'XYZ (teselas ráster)',
    TMS: 'TMS (teselas ráster)',
    MVT: 'MVT (teselas vectoriales)',
    GeoJSON: 'GeoJSON',
    KML: 'KML / KMZ',
    GPX: 'GPX (tracks y rutas)',
    GML: 'GML',
    CSV: 'CSV',
    SHP: 'Shapefile',
    GeoTIFF: 'GeoTIFF',
    MBTiles: 'MBTiles',
    GeoPackage: 'GeoPackage',
    OGCAPIFeatures: 'OGC API Features',
    MapLibre: 'Estilo MapLibre',
    COPC: 'COPC (nube de puntos)',
    PMTiles: 'PMTiles',
    FlatGeobuf: 'FlatGeobuf',
    GeoParquet: 'GeoParquet',
    IFC: 'IFC / BIM',
    GLB: 'GLB / glTF (modelo 3D)',
    Imagen: 'Imagen suelta (PNG, JPEG, WebP)',
    desconocido: 'No se ha podido reconocer'
  };

  /**
   * Quita la query y los fragmentos para quedarse con la ruta, que es donde
   * viven las extensiones.
   * @param {string} url
   * @returns {string}
   */
  function rutaDe(url) {
    return String(url || '').split('#')[0].split('?')[0].toLowerCase();
  }

  /**
   * Devuelve el valor de un parámetro de la query, en minúsculas y sin
   * distinguir mayúsculas.
   * @param {string} url
   * @param {string} nombre
   * @returns {string|null}
   */
  function parametro(url, nombre) {
    const q = String(url || '').split('?')[1];
    if (!q) return null;
    const found = q.split('&').find(function (par) {
      return par.split('=')[0].toLowerCase() === nombre.toLowerCase();
    });
    return found ? decodeURIComponent((found.split('=').slice(1).join('=') || '').trim()) : null;
  }

  /**
   * Deduce el tipo de capa de una URL.
   *
   * @param {string} url
   * @returns {string} Uno de TIPOS_API, o 'desconocido'.
   */
  function detectarTipo(url) {
    const limpio = String(url || '').trim();
    if (!limpio) return 'desconocido';

    const ruta = rutaDe(limpio);
    const lower = limpio.toLowerCase();

    // --- 1. Ficheros: manda la extensión -------------------------------
    if (/\.mbtiles$/.test(ruta)) return TIPOS_API.MBTiles;
    if (/\.gpkg$/.test(ruta)) return TIPOS_API.GeoPackage;
    if (/\.copc(\.laz)?$/.test(ruta)) return TIPOS_API.COPC;
    if (/\.pmtiles$/.test(ruta)) return TIPOS_API.PMTiles;
    if (/\.fgb$/.test(ruta)) return TIPOS_API.FlatGeobuf;
    if (/\.(geo)?parquet$/.test(ruta)) return TIPOS_API.GeoParquet;
    if (/\.ifc$/.test(ruta)) return TIPOS_API.IFC;
    if (/\.(tif|tiff)$/.test(ruta)) return TIPOS_API.GeoTIFF;
    if (/\.(kml|kmz)$/.test(ruta)) return TIPOS_API.KML;
    if (/\.gpx$/.test(ruta)) return TIPOS_API.GPX;
    if (/\.gml$/.test(ruta)) return TIPOS_API.GML;
    if (/\.csv$/.test(ruta)) return TIPOS_API.CSV;
    if (/\.(shp|zip)$/.test(ruta)) return TIPOS_API.SHP;
    if (/\.geojson$/.test(ruta)) return TIPOS_API.GeoJSON;

    // --- 2. Plantillas de teselas --------------------------------------
    // La API de la IDEE escribe el TMS con {-y} (eje invertido) y el XYZ con
    // {y}; el MVT es lo mismo pero en .pbf/.mvt.
    const esPlantilla = /\{z\}|\{x\}|\{y\}|\{-y\}|\{z\}\/\{x\}\/\{y\}/i.test(limpio);
    if (esPlantilla) {
      if (/\.(pbf|mvt)(\?|$)/i.test(lower)) return TIPOS_API.MVT;
      if (/\{-y\}/.test(limpio)) return TIPOS_API.TMS;
      return TIPOS_API.XYZ;
    }

    // --- 2 bis. Recursos que hay que colocar a mano --------------------
    // Van DESPUÉS de las plantillas de teselas a propósito: una URL del tipo
    // `.../{z}/{x}/{y}.png` es un XYZ, no una imagen suelta. Un `.glb` o una
    // foto sin más no dicen dónde van: eso lo resuelve el formulario de
    // colocación del catálogo.
    if (/\.(glb|gltf)$/.test(ruta)) return TIPOS_API.GLB;
    if (/\.(png|jpe?g|webp|gif|bmp)$/.test(ruta)) return TIPOS_API.Imagen;

    // --- 3. OGC API Features -------------------------------------------
    // Se reconoce por el camino /collections/<id>/items, que es como los
    // publica el API de Features del IGN.
    if (/\/collections\/[^/?#]+\/items(\?|$)/i.test(lower)) return TIPOS_API.OGCAPIFeatures;
    if (/api-features|ogcapi\/features/i.test(lower)) return TIPOS_API.OGCAPIFeatures;

    // --- 4. Parámetros del protocolo OGC ------------------------------
    const servicio = (parametro(limpio, 'service') || '').toUpperCase();
    if (servicio === 'WMTS') return TIPOS_API.WMTS;
    if (servicio === 'WFS') return TIPOS_API.WFS;
    if (servicio === 'WCS') return TIPOS_API.WCS;
    if (servicio === 'TMS') return TIPOS_API.TMS;

    // --- 5. Rutas típicas ---------------------------------------------
    if (/\/(wmts|geoserver)\/wmts(\?|$)/i.test(lower)) return TIPOS_API.WMTS;
    if (/\/wfs(\?|$)/i.test(lower)) return TIPOS_API.WFS;
    if (/\/wcs(\?|$)/i.test(lower)) return TIPOS_API.WCS;

    // --- 6. Documento de capacidades suelto ---------------------------
    const esCapabilities = /getcapabilities/i.test(lower);
    if (esCapabilities) return TIPOS_API.WMS;   // lo más frecuente; se afinará leyendo el XML

    // --- 7. Por defecto: WMS ------------------------------------------
    // Todos los portales de servicios (IDEE, Catálogo, ...) entregan WMS
    // cuando no dicen otra cosa.
    return TIPOS_API.WMS;
  }

  // =====================================================================
  //  Lectura del documento de capacidades
  // =====================================================================

  /**
   * Busca elementos por nombre local, ignorando el espacio de nombres. Los
   * capabilities viene en WMS 1.1.1, 1.3.0, WMTS y WFS 1.x o 2.0, y cada uno
   * usa sus propios prefijos.
   *
   * @param {Document} doc
   * @param {string} nombreLocal
   * @returns {Array<Element>}
   */
  function porNombre(doc, nombreLocal) {
    return Array.prototype.slice.call(doc.getElementsByTagName('*')).filter(function (el) {
      return el.localName === nombreLocal;
    });
  }

  /**
   * Texto del primer hijo directo con ese nombre local.
   * @param {Element} el
   * @param {string} nombreLocal
   * @returns {string}
   */
  function textoDe(el, nombreLocal) {
    const hijos = Array.prototype.slice.call(el.children).filter(function (h) {
      return h.localName === nombreLocal;
    });
    return hijos.length ? (hijos[0].textContent || '').trim() : '';
  }

  /**
   * Saca la lista de capas de un documento de capabilities ya parseado.
   * @param {Document} doc
   * @param {string} tipo Tipo detectado, que decide cómo se lee.
   * @returns {Array<{id: string, nombre: string}>}
   */
  function capasDe(doc, tipo) {
    const salida = [];

    if (tipo === 'WMTS') {
      porNombre(doc, 'Layer').forEach(function (el) {
        const id = textoDe(el, 'Identifier') || textoDe(el, 'Name');
        if (!id) return;
        salida.push({ id: id, nombre: textoDe(el, 'Title') || id });
      });
      return salida;
    }

    if (tipo === 'WFS') {
      porNombre(doc, 'FeatureType').forEach(function (el) {
        const id = textoDe(el, 'Name');
        if (!id) return;
        salida.push({ id: id, nombre: textoDe(el, 'Title') || id });
      });
      return salida;
    }

    // WMS. La estructura es
    //   <Capability><Layer>raíz<Title/><Layer><Name/>…capas</Layer></Layer></Capability>
    // Las capas que se pueden pedir tal cual son las HIJAS del Layer raíz, no el
    // raíz (que no tiene nombre) ni sus nietas (que son subcapas con estilo).
    // Los servicios que no anidan ponen las capas directamente en la raíz, así
    // que si no hay hijos se leen las del primer nivel que se encuentre.
    const todos = porNombre(doc, 'Layer');
    const hijos = todos.filter(function (el) {
      return el.parentElement && el.parentElement.localName === 'Layer';
    });
    const nivel = hijos.length
      ? hijos
      : todos.filter(function (el) {
        return el.parentElement && el.parentElement.localName !== 'Layer';
      });

    nivel.forEach(function (el) {
      const id = textoDe(el, 'Name');
      if (!id) return;
      salida.push({ id: id, nombre: textoDe(el, 'Title') || id });
    });
    return salida;
  }

  /**
   * Monta la URL de GetCapabilities a partir de la URL del servicio.
   * @param {string} url
   * @param {string} tipo
   * @returns {string}
   */
  function urlCapabilities(url, tipo) {
    const partes = [];
    const req = (parametro(url, 'request') || '').toUpperCase();
    if (req) partes.push('request=' + req);
    else partes.push('request=GetCapabilities');
    const srv = (parametro(url, 'service') || '').toUpperCase();
    if (srv && srv !== tipo.toUpperCase()) partes.push('service=' + srv);
    else partes.push('service=' + tipo.toUpperCase());
    return url + (url.indexOf('?') > -1 ? '&' : '?') + partes.join('&');
  }

  /**
   * ¿Un navegador puede leer esta URL?
   *
   * POR QUÉ HACE FALTA: hay tipos de capa que el catálogo carga sin consultar
   * nada antes (GeoTIFF, teselas, GeoPackage, GeoJSON, KML...). Se construyen y
   * se añaden, y si el servidor no manda CORS la capa simplemente no pinta y no
   * dice nada: no hay error que atrapar. Por eso se mira ANTES de añadir.
   *
   * Se pide con HEAD, que es lo más barato. El CORS se delata porque fetch ni
   * llega a responder y salta "Failed to fetch". Si el servidor no permite HEAD
   * (un 405, p. ej.) se cae a pedir un solo byte con Range, que es lo que
   * acepta cualquiera que sirva el fichero.
   *
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  async function urlEsLegible(url) {
    const limpio = String(url || '').trim();
    if (!/^https?:\/\//i.test(limpio)) return false;
    try {
      const r = await fetch(limpio, { method: 'HEAD', cache: 'no-store' });
      if (r.ok) return true;
    } catch (e) {
      // CORS (o la red caída): no hay nada que leer.
      return false;
    }
    try {
      const control = new AbortController();
      const temporizador = setTimeout(function () { control.abort(); }, 10000);
      const r = await fetch(limpio, {
        method: 'GET', cache: 'no-store',
        headers: { Range: 'bytes=0-0' }, signal: control.signal
      });
      clearTimeout(temporizador);
      return r.ok || r.status === 206;
    } catch (e) {
      return false;
    }
  }

  /**
   * Pide un recurso con fetch, directamente.
   *
   * NO se usa el proxy de la API. El precio de no usarlo es el CORS: si el
   * servidor no manda Access-Control-Allow-Origin, el navegador permite la
   * petición pero bloquea la lectura de la respuesta, y fetch falla sin más
   * detalle. Por eso el error lo dice explícitamente, para que no toque
   * adivinar. Medido: los servidores de capacidades del IGN y los catálogos
   * STAC de verdad SÍ mandan CORS; www.idee.es es la excepción.
   *
   * @param {string} url
   * @returns {Promise<string>} El cuerpo de la respuesta.
   */
  async function pedir(url) {
    let r;
    try {
      r = await fetch(url);
    } catch (e) {
      throw new Error('El navegador no ha podido leer «' + url + '» desde aquí.' +
        ' Suele ser porque ese servidor no manda cabeceras CORS' +
        ' (Access-Control-Allow-Origin), y sin ellas el navegador bloquea la lectura.');
    }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' al pedir «' + url + '».');
    return await r.text();
  }

  /**
   * Convierte un cuerpo de respuesta en JSON, con un mensaje que se entienda
   * cuando lo que llega no es JSON.
   *
   * Si lo que llega es una página web en vez de JSON, un JSON.parse a pelo
   * solo diría "Unexpected token '<'".
   *
   * @param {string} texto
   * @param {string} url Para poder nombrar el documento en el mensaje.
   * @returns {Object}
   */
  function parsearJson(texto, url) {
    const limpio = String(texto || '').trim();
    if (!limpio) {
      throw new Error('El documento de «' + url + '» ha llegado vacío.');
    }
    try {
      return JSON.parse(limpio);
    } catch (e) {
      if (/^</.test(limpio)) {
        throw new Error('Lo que devuelve «' + url + '» es una página web y no el JSON que se esperaba.');
      }
      throw new Error('La respuesta de «' + url + '» no es JSON válido.');
    }
  }

  /**
   * Lee las capas que ofrece un servicio.
   *
   * Para WMS/WMTS/WFS pide el documento de capacidades y lo parsea; para los
   * demás tipos (ficheros y teselas) no hay lista de capas que pedir, así que
   * se devuelve una capa sintética con la propia URL.
   *
   * @param {string} url
   * @param {string} [tipo] Tipo detectado; si no se pasa, se deduce.
   * @returns {Promise<{tipo: string, nombre: string, capas: Array<{id,nombre}>, aviso: string|null}>}
   */
  async function leerCapas(url, tipo) {
    // Un `s3://` no se puede pedir tal cual: se pasa a HTTPS de S3 antes de nada.
    const limpio = httpDeS3(String(url || '').trim());
    const tipoFinal = tipo || detectarTipo(limpio);

    if (['WMS', 'WMTS', 'WFS'].indexOf(tipoFinal) === -1) {
      return {
        tipo: tipoFinal,
        nombre: nombreDeUrl(limpio),
        capas: [{ id: limpio, nombre: nombreDeUrl(limpio) }],
        aviso: esColocable(tipoFinal)
          ? 'Este recurso no trae georreferenciación: hay que decir dónde va con el formulario de colocación (posición o rectángulo).'
          : 'Este tipo de servicio no publica una lista de capas: se cargará entera.'
      };
    }

    const caps = urlCapabilities(limpio, tipoFinal);
    const texto = await pedir(caps);
    const doc = new DOMParser().parseFromString(texto, 'text/xml');

    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('El documento de capacidades no es XML válido.');
    }

    // El tipo real lo dice el propio documento: si la URL era ambigua
    // (un GetCapabilities suelto, por ejemplo), aquí se afina.
    const servicio = (doc.documentElement && (
      doc.documentElement.getAttribute('service') ||
      (porNombre(doc, 'ServiceIdentification')[0] &&
        porNombre(doc, 'ServiceIdentification')[0].getAttribute('service')) || ''
    ) || '').toUpperCase();

    let tipoLeido = tipoFinal;
    if (servicio && ['WMS', 'WMTS', 'WFS', 'WCS'].indexOf(servicio) > -1) tipoLeido = servicio;

    const capas = capasDe(doc, tipoLeido);
    return {
      tipo: tipoLeido,
      nombre: nombreServicio(doc) || nombreDeUrl(limpio),
      capas: capas,
      aviso: capas.length ? null : 'El servicio no declara ninguna capa.'
    };
  }

  /**
   * Nombre del servicio en un documento de capacidades, si lo declara.
   * @param {Document} doc
   * @returns {string}
   */
  function nombreServicio(doc) {
    const raiz = porNombre(doc, 'Service')[0] || doc.documentElement;
    if (!raiz) return '';
    const t = textoDe(raiz, 'Title');
    return t;
  }

  /**
   * Nombre deducido del final de la URL, para cuando no hay nada mejor.
   * @param {string} url
   * @returns {string}
   */
  function nombreDeUrl(url) {
    const ruta = rutaDe(url).replace(/\/$/, '');
    const trozo = ruta.split('/').pop() || url;
    return trozo.replace(/[-_]+/g, ' ').trim() || url;
  }

  // =====================================================================
  //  Creación de la capa
  // =====================================================================

  /**
   * Crea y añade al mapa una capa a partir de una URL ya analizada.
   *
   * Sigue el patrón que usa la propia API: en WMS el nombre de la capa del
   * servicio va en `name` y lo que se ve en el panel, en `legend` (es lo que
   * hace la API en su addAllLayers_ al abrir un WMS con todas sus capas).
   *
   * @param {Object} opciones
   * @param {string} opciones.url
   * @param {string} opciones.tipo Tipo de capa.
   * @param {Array<string>} [opciones.capas] Nombres de capa del servicio.
   * @param {string} [opciones.nombre] Nombre que se quiere dar.
   * @param {Object} [opciones.colocacion] Solo para GLB e Imagen: `position`,
   *   `bbox`, `heading`, `scale`, `ancho`, `alto`... (ver ext/glbLayer y
   *   ext/imageLayer). Sin esto la capa no tiene dónde pintarse.
   * @param {Object} [opciones.parametros] Parámetros de usuario extra para la
   *   capa (p. ej. `displayInLayerSwitcher: false` para una vista previa).
   * @param {Object} opciones.mapa
   * @returns {Array<Object>} Las capas añadidas (puede ser más de una).
   */
  function cargar(opciones) {
    const IDEE = window.IDEE || window.M;
    const mapa = opciones.mapa;
    // Igual que al leer: si la entrada es `s3://` se consume en su forma HTTPS.
    const url = httpDeS3(String(opciones.url || '').trim());
    const tipo = opciones.tipo || detectarTipo(url);
    const nombre = (opciones.nombre || '').trim();
    const pedidas = (opciones.capas && opciones.capas.length) ? opciones.capas : [url];
    const clase = nombreConstructor(tipo);
    const parametrosExtra = (opciones.parametros && typeof opciones.parametros === 'object')
      ? opciones.parametros : {};

    if (!IDEE || !IDEE.layer) throw new Error('La API no está disponible.');
    if (typeof mapa.addLayers !== 'function') throw new Error('El mapa no está listo.');

    // Un tipo que la API no sabe construir (una colección STAC, un registro
    // de metadatos) se avisa en claro en vez de reventar con un
    // "IDEE.layer[x] is not a constructor" que no dice nada.
    if (typeof IDEE.layer[clase] !== 'function') {
      throw new Error('Una entrada de tipo ' + tipo +
        ' no se puede cargar como capa. Los tipos que la API construye son: ' +
        Object.keys(ETIQUETAS).filter(function (k) { return k !== 'desconocido'; }).join(', ') + '.');
    }

    // Factoria por tipo, con el nombre de la capa del servicio (o la URL en
    // los tipos que no la tienen) y la leyenda con el nombre pedido.
    const fabricar = function (nombreCapa, leyenda) {
      switch (tipo) {
        case 'WMS':
        case 'WMTS':
        case 'WFS':
        case 'WCS':
        case 'XYZ':
        case 'TMS':
        case 'MVT':
        case 'OGCAPIFeatures':
          return new IDEE.layer[tipo]({
            url: url,
            name: nombreCapa,
            legend: leyenda,
            visible: true,
            attribution: '<p><b>IDEE</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>'
          }, {});
        case 'GeoJSON':
        case 'KML':
        case 'GPX':
        case 'GML':
        case 'CSV':
        case 'SHP':
          return new IDEE.layer[tipo]({
            source: url,
            name: nombreCapa,
            legend: leyenda,
            visible: true
          }, {});
        case 'GLB':
        case 'Imagen': {
          // Estas capas no saben dónde van por sí mismas: los parámetros de
          // colocación (posición o rectángulo, giro, escala, cota) son los que
          // trae el formulario del catálogo. Se descartan los vacíos para no
          // pisar los valores por defecto de la extensión con `undefined`.
          const params = {
            url: url,
            name: nombreCapa,
            legend: leyenda,
            visible: true
          };
          const colocacion = opciones.colocacion && typeof opciones.colocacion === 'object'
            ? opciones.colocacion : {};
          Object.keys(colocacion).forEach(function (k) {
            const v = colocacion[k];
            if (v === undefined || v === null || v === '') return;
            params[k] = v;
          });
          return new IDEE.layer[clase](params, Object.assign({}, parametrosExtra));
        }
        default:
          // Tipos de fichero o teselas que se cargan por su URL.
          return new IDEE.layer[tipo]({
            url: url,
            name: nombreCapa,
            legend: leyenda,
            visible: true
          }, {});
      }
    };

    const capas = [];
    pedidas.forEach(function (nombreCapa, i) {
      // Con una sola capa el nombre pedido es el suyo; con varias se les
      // añade el identificador, que es lo único que las distingue.
      const leyenda = nombre
        ? (pedidas.length > 1 ? nombre + ' · ' + nombreCapa : nombre)
        : nombreCapa;
      try {
        capas.push(fabricar(nombreCapa, leyenda));
      } catch (e) {
        throw new Error('No se ha podido crear la capa de tipo ' + tipo + ': ' + (e && e.message ? e.message : e));
      }
      void i;
    });

    mapa.addLayers(capas);

    // Las fuentes de OpenLayers no coinciden en su wrapX por defecto: las TMS y
    // XYZ (TileImage) vienen con true y las WMTS y WMS con false, así que una
    // capa cargada desde el catálogo daría la vuelta al mundo y otra no. Se
    // igualan todas a true. La API no deja pasar la opción (a un TMS con
    // wrapX:false le sale true), y fuente.set('wrapX') tampoco sirve porque
    // OpenLayers lee el campo wrapX_. Ver window.miWrapX en ext_layerSwitcher.js.
    if (window.miWrapX) window.miWrapX.aplica(mapa);

    return capas;
  }

  // =====================================================================
  //  Exposición
  // =====================================================================
  window.CatalogoURL = {
    TIPOS: TIPOS_API,
    ETIQUETAS: ETIQUETAS,
    TIPOS_COLOCABLES: TIPOS_COLOCABLES.slice(),
    httpDeS3: httpDeS3,
    urlEsLegible: urlEsLegible,
    detectarTipo: detectarTipo,
    esColocable: esColocable,
    nombreConstructor: nombreConstructor,
    leerCapas: leerCapas,
    urlCapabilities: urlCapabilities,
    pedir: pedir,
    parsearJson: parsearJson,
    nombreDeUrl: nombreDeUrl,
    cargar: cargar
  };
})();