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
    MapLibre: 'MapLibre'
  };

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
   * Pide un recurso que puede ser de otro dominio, pasando por el proxy de la
   * API. El proxy devuelve { valid, code, error, message, content } con el
   * cuerpo en `content` como texto.
   *
   * @param {string} url
   * @returns {Promise<string>}
   */
  async function pedir(url) {
    const IDEE = window.IDEE || window.M;
    const base = (IDEE && IDEE.config && IDEE.config.PROXY_URL) ? String(IDEE.config.PROXY_URL) : '';

    if (!base) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    }

    const r = await fetch(base + '?url=' + encodeURIComponent(url));
    if (!r.ok) throw new Error('HTTP ' + r.status + ' (proxy)');
    const texto = await r.text();

    try {
      const env = JSON.parse(texto);
      if (env && typeof env === 'object' && env.content !== undefined) {
        if (env.error) throw new Error(env.message || 'el proxy no ha podido traer el documento');
        return typeof env.content === 'string' ? env.content : JSON.stringify(env.content);
      }
    } catch (e) {
      if (e && e.message && /proxy no ha podido/.test(e.message)) throw e;
    }
    return texto;
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
    const limpio = String(url || '').trim();
    const tipoFinal = tipo || detectarTipo(limpio);

    if (['WMS', 'WMTS', 'WFS'].indexOf(tipoFinal) === -1) {
      return {
        tipo: tipoFinal,
        nombre: nombreDeUrl(limpio),
        capas: [{ id: limpio, nombre: nombreDeUrl(limpio) }],
        aviso: 'Este tipo de servicio no publica una lista de capas: se cargará entera.'
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
   * @param {Object} opciones.mapa
   * @returns {Array<Object>} Las capas añadidas (puede ser más de una).
   */
  function cargar(opciones) {
    const IDEE = window.IDEE || window.M;
    const mapa = opciones.mapa;
    const url = String(opciones.url || '').trim();
    const tipo = opciones.tipo || detectarTipo(url);
    const nombre = (opciones.nombre || '').trim();
    const pedidas = (opciones.capas && opciones.capas.length) ? opciones.capas : [url];

    if (!IDEE || !IDEE.layer) throw new Error('La API no está disponible.');
    if (typeof mapa.addLayers !== 'function') throw new Error('El mapa no está listo.');

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
    return capas;
  }

  // =====================================================================
  //  Exposición
  // =====================================================================
  window.CatalogoURL = {
    TIPOS: TIPOS_API,
    ETIQUETAS: ETIQUETAS,
    detectarTipo: detectarTipo,
    leerCapas: leerCapas,
    urlCapabilities: urlCapabilities,
    pedir: pedir,
    nombreDeUrl: nombreDeUrl,
    cargar: cargar
  };
})();