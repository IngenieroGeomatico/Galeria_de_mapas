/* =====================================================================
   CatalogoRegistro: catálogos que añade el usuario
   ---------------------------------------------------------------------
   Los catálogos de serie (IDEE, STAC y OGC API Records) vienen en el
   CATALOGOS de catalogo.js. Aquí viven los que se dan de alta a mano desde el
   panel: se registra un nombre, un tipo y una URL, el plugin la consulta,
   lista lo que encuentra y lo añade al selector de catálogos.

   Tres clases de catálogo, porque son las que se encuentran en la práctica:

     stac      Catálogo STAC. Se pide /collections y cada colección se
               convierte en una entrada cuya URL es la de sus items, que ya
               es un endpoint OGC API Features y se carga como tal.

     ogcapi    Catálogo OGC API Records. Se piden los registros y se lee el
               título de cada uno; la URL de la entrada es la del propio
               registro (o su enlace de items, si lo declara).

     json      Documento JSON propio con una lista de servicios. Se acepta
               un array suelto o un objeto con una de las claves habituales,
               y cada entrada necesita un nombre y una URL.

   Los catálogos dados de alta se guardan en localStorage, así que sobreviven
   a recargar la página (y también al cambio 2D/3D, que reconstruye el mapa).
   ===================================================================== */
(function () {
  'use strict';

  /** Clave de localStorage. */
  const CLAVE = 'galeria_catalogo_usuario';

  /** Tipos que se pueden dar de alta. */
  const TIPOS = {
    stac: 'STAC',
    ogcapi: 'OGC API Records',
    json: 'JSON de servicios'
  };

  /** Claves con las que un JSON propio puede traer la lista de servicios. */
  const CLAVES_LISTA = ['services', 'servicios', 'catalogos', 'items', 'features', 'collections', 'datos'];

  /** Pide un recurso directamente (lo hace CatalogoURL). */
  async function pedir(url) {
    const urlTool = window.CatalogoURL;
    if (!urlTool) throw new Error('No está cargado catalogo_url.js.');
    return await urlTool.pedir(url);
  }

  /**
   * Convierte la respuesta en JSON con un mensaje que sirva cuando lo que
   * llega no es JSON (una página web de redirección, por ejemplo), y un
   * JSON.parse a pelo de eso solo diría "Unexpected token '<'".
   *
   * @param {string} texto
   * @param {string} url Para nombrar el documento en el mensaje.
   * @returns {Object}
   */
  function parsear(texto, url) {
    if (window.CatalogoURL && window.CatalogoURL.parsearJson) {
      return window.CatalogoURL.parsearJson(texto, url);
    }
    return JSON.parse(texto);
  }

  /**
   * Resuelve un href contra la URL del documento. Un catálogo STAC
   * estático guarda sus colecciones como rutas relativas ("../planet/
   * collection.json") y hay que resolverlas contra la del catálogo, no
   * contra su carpeta.
   * @param {string} base URL del documento.
   * @param {string} href
   * @returns {string}
   */
  function resolver(base, href) {
    const h = String(href || '').trim();
    if (/^https?:\/\//i.test(h)) return h;
    try {
      return new URL(h, base).href;
    } catch (e) {
      return h;
    }
  }

  /** Nombre deducido del final de un href, para cuando el enlace no trae título. */
  function nombreDeHref(href) {
    const limpio = String(href || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
    const partes = limpio.split('/').filter(Boolean);
    let ultimo = partes[partes.length - 1] || limpio;
    // En un catálogo STAC estático las colecciones suelen guardarse como
    // "<carpeta>/collection.json": el fichero es siempre el mismo, así que lo
    // que las distingue es la carpeta. Sin esto todas se llamarían "collection".
    if (/^(collection|catalog)\.json$/i.test(ultimo) && partes.length > 1) {
      ultimo = partes[partes.length - 2];
    }
    return (ultimo || limpio).replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
  }

  /** Quita la barra final. */
  function sinBarra(url) {
    return String(url || '').replace(/\/+$/, '');
  }

  /** Junta dos URLs sin duplicar la /. */
  function unir(base, trozo) {
    if (/^https?:\/\//i.test(trozo)) return trozo;
    return sinBarra(base) + '/' + String(trozo).replace(/^\/+/, '');
  }

  /** Acorta un texto largo para la lista. */
  function resumen(texto, max) {
    const t = String(texto || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  // =====================================================================
  //  Lectores por tipo de catálogo
  // =====================================================================

  /**
   * Cuántos elementos se piden de una colección STAC al entrar en ella.
   *
   *  La de Sentinel-2 de Earth Search tiene 51.669.232 elementos (medido), así
   *  que no se pueden listar todos ni interesa: se pide este lote y se dice
   *  cuántos hay en total.
   */
  const LIMITE_ITEMS_STAC = 50;

/**
   * Los metadatos de resumen de una colección, que es el bloque `summaries` del
   * documento STAC.
   *
   *  Es la parte del catálogo que más información da y que no se usaba (medido en
   *  la de Sentinel-2 de Earth Search):
   *
   *    platform         ["sentinel-2a","sentinel-2b"]
   *    constellation    "sentinel-2"
   *    instruments      "msi"
   *    gsd              [10,20,60]                resoluciones en m/píxel
   *    eo:bands         [{name, center_wavelength, ...}]  las bandas, en micras
   *    sci:doi          "10.5270/..."
   *
   *  El valor de cada resumen cambia de forma: un array de cadenas, un array de
   *  números, una cadena suelta o un array de objetos (las bandas). Por eso se
   *  leen todos con la misma pinta y se deja que la interfaz los presente.
   *
   * @param {Object} json Documento STAC.
   * @returns {Object} {resoluciones: number[], plataformas: string[],
   *   instrumentos: string[], constelacion: string, bandas: Array<Object>,
   *   doi: string}
   */
  function leerResumenes(json) {
    const s = (json && json.summaries) ? json.summaries : {};
    const aTexto = function (v) {
      if (v === null || v === undefined) return '';
      if (Array.isArray(v)) {
        return v.map(function (x) {
          return (x && typeof x === 'object') ? (x.name || x.title || '') : String(x);
        }).filter(Boolean).join(', ');
      }
      if (typeof v === 'object') return v.name || v.title || '';
      return String(v);
    };
    const aLista = function (v) {
      return aTexto(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    };

    return {
      resoluciones: (Array.isArray(s['gsd']) ? s['gsd'] : []).map(Number).filter(isFinite),
      plataformas: aLista(s.platform),
      instrumentos: aLista(s.instruments),
      constelacion: aTexto(s.constellation),
      bandas: Array.isArray(s['eo:bands']) ? s['eo:bands'] : [],
      doi: aTexto(s['sci:doi'])
    };
  }

  /**
   * La huella de una colección o de un item, como [oeste, sur, este, norte].
   *
   *  OJO con las colecciones: casi todas declaran el mundo entero (medido: las
   *  nueve de Earth Search menos `naip`, que va de Alaska a Florida con
   *  [-160, 17, -67, 50]), así que una huella mundial no dice nada y se devuelve
   *  nula para no pintar un botón de zoom que lleva al planeta entero.
   *
   * @param {Array<number>} bbox
   * @returns {Array<number>|null}
   */
  function huellaDe(bbox) {
    if (!Array.isArray(bbox) || bbox.length < 4) return null;
    const n = bbox.slice(0, 4).map(Number);
    if (!n.every(isFinite)) return null;
    if (n[0] <= -180 && n[1] <= -90 && n[2] >= 180 && n[3] >= 90) return null;
    return n;
  }

  /**
   * El rectángulo que envuelve un polígono GeoJSON.
   *
   *  Por si el item viene sin `bbox`, que es opcional en el STAC. Para un solo
   *  anillo (que es lo que son las huellas de las escenas) recorre los pares de
   *  coordenadas; con anillos interiores, como un multipolígono con islas, el
   *  resultado sigue siendo válido, porque ningún vértice aceptado sale del
   *  polígono.
   *
   * @param {Object} geo Un `Feature` o una `geometry`.
   * @returns {Array<number>|null} [oeste, sur, este, norte].
   */
  function cajaDe(geo) {
    if (!geo || typeof geo !== 'object') return null;
    const geometria = geo.type ? geo : geo.geometry;
    const coordenadas = geometria && geometria.coordinates;
    if (!Array.isArray(coordenadas)) return null;
    let oeste = Infinity, sur = Infinity, este = -Infinity, norte = -Infinity;
    const visitar = function (par) {
      if (!Array.isArray(par) || par.length < 2) return;
      const x = Number(par[0]);
      const y = Number(par[1]);
      if (!isFinite(x) || !isFinite(y)) return;
      if (x < oeste) oeste = x;
      if (x > este) este = x;
      if (y < sur) sur = y;
      if (y > norte) norte = y;
    };
    const recorrer = function (n) {
      if (!Array.isArray(n)) return;
      if (typeof n[0] === 'number') visitar(n);
      else n.forEach(recorrer);
    };
    recorrer(coordenadas);
    if (!isFinite(oeste) || !isFinite(sur) || !isFinite(este) || !isFinite(norte)) return null;
    return [oeste, sur, este, norte];
  }

  /**
   * Tipos de un asset STAC que la API sabe construir como capa.
   *
   *  Se decide por el `type` MIME que declara el asset, que es donde el STAC
   *  dice de qué es el fichero, y no por el nombre del asset.
   *
   *  `GeoTIFF` está porque los catálogos de satélite publican casi todo en COG
   *  (`image/tiff; profile=cloud-optimized`), que es un GeoTIFF optimizado para
   *  la nube, y la API tiene constructor para GeoTIFF (medido: `M.layer.GeoTIFF`
   *  es una función). Un item sin ninguno de estos se queda como información.
   */
  const ASSETS_CARGABLES = [
    { tipo: 'OGCAPIFeatures', mime: /^application\/geo\+json$/ },
    { tipo: 'GeoJSON', mime: /^application\/geo\+json$/ },
    { tipo: 'XYZ', mime: /tilejson|vnd\.mapbox-vector-tile/i },
    { tipo: 'MVT', mime: /application\/vnd\.mapbox-vector-tile/i },
    { tipo: 'GeoTIFF', mime: /image\/tiff/i },
    { tipo: 'CSV', mime: /^text\/csv$/ },
    { tipo: 'KML', mime: /vnd\.google-earth\.kml/i },
    { tipo: 'GML', mime: /^application\/gml\+xml$/ }
  ];

  /**
   * Busca en los assets de un item STAC el primero que se pueda cargar.
   *
   *  Primero se mira si algún asset es un servicio OGC (se carga por URL aunque
   *  lo que sirva por debajo sea una imagen), y luego los que son ficheros que la
   *  API sabe construir. Los de apoyo (metadatos, miniaturas) se descartan: no son
   *  la escena. Y entre los que valen se prefiere el marcado como `visual`, que es
   *  la imagen en color true, antes que una banda suelta.
   *
   *  OJO, con los catálogos de satélite esto es lo normal: los items de
   *  Earth Search son COG (`image/tiff; profile=cloud-optimized`) y la API sí tiene
   *  constructor para ellos, `M.layer.GeoTIFF` (medido), así que se cargan.
   *
   * @param {Object} assets El diccionario `assets` del item.
   * @returns {{tipo: string, url: string, clave: string}|null} El asset elegido.
   */
  function assetCargable(assets) {
    const claves = Object.keys(assets || {});
    for (const clave of claves) {
      const a = assets[clave] || {};
      const href = String(a.href || '');
      if (!href) continue;
      const servicio = /[?&]SERVICE=(WMS|WMTS|WFS|WCS)/i.exec(href);
      if (servicio) {
        const nombre = { WMS: 'WMS', WMTS: 'WMTS', WFS: 'WFS', WCS: 'WCS' }[servicio[1].toUpperCase()];
        return { tipo: nombre, url: href, clave: clave };
      }
    }
    // Dos pasadas: primero el asset visual, y si no hay, cualquier otro de
    // datos. Un item de Sentinel-2 tiene veinte bandas y una visual; cargar la
    // visual es lo que espera cualquiera.
    for (const clave of claves) {
      const a = assets[clave] || {};
      const href = String(a.href || '');
      if (!href) continue;
      const roles = Array.isArray(a.roles) ? a.roles : [];
      if (roles.indexOf('thumbnail') > -1 || roles.indexOf('metadata') > -1) continue;
      if (roles.indexOf('visual') < 0) continue;
      const mime = String(a.type || a['type:asset'] || '');
      for (const regla of ASSETS_CARGABLES) {
        if (regla.mime.test(mime)) return { tipo: regla.tipo, url: href, clave: clave };
      }
    }
    for (const clave of claves) {
      const a = assets[clave] || {};
      const href = String(a.href || '');
      if (!href) continue;
      const roles = Array.isArray(a.roles) ? a.roles : [];
      if (roles.indexOf('thumbnail') > -1 || roles.indexOf('metadata') > -1) continue;
      const mime = String(a.type || a['type:asset'] || '');
      for (const regla of ASSETS_CARGABLES) {
        if (regla.mime.test(mime)) return { tipo: regla.tipo, url: href, clave: clave };
      }
    }
    return null;
  }

   /**
   * Lee un documento STAC (un catálogo o una colección) y lo devuelve con sus
   * hijos, sus metadatos y su padre, que es lo que hace falta para PODER BAJAR
   * por el árbol y volver a subir.
   *
   *  Un catálogo estático (catalog.json) tiene sus colecciones en los enlaces
   *  con rel="child"; una colección, sus items en rel="item"; y cualquier nodo
   *  dice de dónde viene en rel="parent". Con eso se monta la navegación sin
   *  adivinar nada de la URL.
   *
   * @param {string} url URL del documento STAC.
   * @returns {Promise<Object>} {url, titulo, descripcion, padre, entradas, licencia, temporal}
   */
  async function leerNodoStac(url) {
    const base = sinBarra(url);
    const json = parsear(await pedir(url), url);
    const enlaces = Array.isArray(json.links) ? json.links : [];

    const buscarEnlace = function (rels) {
      return enlaces.find(function (l) {
        return l && rels.indexOf(l.rel) > -1;
      });
    };

    const padre = buscarEnlace(['parent']);
    const items = buscarEnlace(['items']);

    // Los hijos: primero las colecciones hijas, y si no hay, los items. Un
    // catálogo de ejemplo suele tener uno u otro, no los dos.
    const hijos = enlaces
      .filter(function (l) { return l && (l.rel === 'child' || l.rel === 'item'); })
      .map(function (l) {
        const abs = resolver(url, l.href);
        return {
          nombre: l.title || nombreDeHref(abs),
          url: abs,
          descripcion: resumen(l.description || '', 110),
          // Un hijo de rel="child" es otra colección en la que se puede entrar;
          // uno de rel="item" es un elemento, que ya es una carga.
          abrir: l.rel === 'child' ? abs : null,
          tipo: l.rel === 'child' ? 'STAC' : 'OGCAPIFeatures'
        };
      });

    // Si el documento es una colección de una API STAC (no un catálogo
    // estático), sus items no vienen por links sino en /items, y su tipo es
    // el que se puede cargar en el mapa.
    const titulo = json.title || json.id || nombreDeHref(base);
    const esColeccionApi = /\/collections\//.test(base) || json.type === 'Collection';
    const urlItems = items ? resolver(url, items.href) : null;

    let entradas = hijos;
    let totalElementos = 0;
    let urlItemsSiguiente = null;

    // Colección de una API STAC: sus elementos están en /items y no en el
    // documento, así que hay que ir a buscarlos. Y hay que pedirlos con tope:
    // la de Sentinel-2 de Earth Search tiene 51.669.232 elementos (medido), que
    // no caben en ninguna lista ni interesan.
    if (!entradas.length && urlItems) {
      const conTope = urlItems + (urlItems.indexOf('?') > -1 ? '&' : '?')
        + 'limit=' + LIMITE_ITEMS_STAC;
      const j = parsear(await pedir(conTope), conTope);
      const feats = Array.isArray(j.features) ? j.features : [];
      totalElementos = Number(j.numberMatched || j.numberReturned || feats.length) || 0;
      entradas = entradasDeItems(feats);
      // El enlace a la página siguiente, que es lo único que permite recorrer
      // una colección entera: el token va en la URL y es un GET normal (medido).
      urlItemsSiguiente = enlaceSiguiente(j, conTope);
    }

    return {
      url: base,
      titulo: titulo,
      descripcion: resumen(json.description || '', 160),
      padre: padre ? resolver(url, padre.href) : null,
      licencia: (json.license || (Array.isArray(json.licenses) && json.licenses[0]
        ? (json.licenses[0].name || json.licenses[0]) : '')) || '',
      temporal: leerTemporal(json),
      // La huella, solo si dice algo: la mayoría de las colecciones son
      // mundiales y su bbox es el mundo entero (medido).
      bbox: huellaDe(json.extent && json.extent.spatial
        && Array.isArray(json.extent.spatial.bbox) ? json.extent.spatial.bbox[0] : null),
      // Los metadatos de resumen, que antes no se leian (ver leerResumenes).
      resumenes: leerResumenes(json),
      proveedores: (Array.isArray(json.providers) ? json.providers : [])
        .map(function (p) { return p && (p.name || p.title) ? String(p.name || p.title) : ''; })
        .filter(Boolean),
      assetsPublicados: (json.item_assets && typeof json.item_assets === 'object')
        ? Object.keys(json.item_assets) : [],
      extensiones: Array.isArray(json.stac_extensions) ? json.stac_extensions : [],
      // La URL de los items de una colección de API, para cargarlos.
      urlItems: urlItems,
      // Y la de la página siguiente, que es lo que permite seguir leyendo más
      // allá de los primeros LIMITE_ITEMS_STAC.
      urlItemsSiguiente: urlItemsSiguiente,
      totalElementos: totalElementos,
      entradas: entradas,
      esColeccionApi: esColeccionApi
    };
  }

  /**
   * Una entrada de la lista del catálogo por cada item de una página.
   *
   *  Se guarda también la huella del item, que es lo que permite encuadrarla en
   * el mapa antes de descargar el fichero: los COG de satélite pesan cientos de
   * megas. El `geometry` es un Polygon GeoJSON de verdad y el `bbox` viene
   * siempre (medido en Earth Search: `[-64.353843, 42.387978, -64.095828,
   * 42.447434]`).
   *
   * @param {Array<Object>} feats Los `features` de la respuesta.
   * @returns {Array<Object>}
   */
  function entradasDeItems(feats) {
    return feats.map(function (f) {
      const props = f.properties || {};
      const assets = f.assets || {};
      const claves = Object.keys(assets);
      const gsd = props['gsd'] || props['proj:gsd'] || '';
      const fecha = props.datetime || props.start_datetime || '';
      const nubes = props['eo:cloud_cover'];
      const trozos = [];
      if (fecha) trozos.push(String(fecha).slice(0, 10));
      if (gsd) trozos.push(gsd + ' m/píxel');
      if (nubes !== undefined && nubes !== null && nubes !== '') {
        trozos.push(Math.round(Number(nubes)) + '% de nubes');
      }
      if (claves.length) trozos.push(claves.length + ' assets');
      // El botón de cargar solo aparece si el item tiene ALGÚN asset que la
      // API sepa construir como capa. Con los COG de Earth Search no hay
      // ninguno y el item se queda como información, que es lo honesto.
      const bueno = assetCargable(assets);
      const geometria = (f.geometry && f.geometry.type === 'Polygon') ? f.geometry : null;
      const bbox = huellaDe(f.bbox) || cajaDe(geometria);
      return {
        nombre: f.id || '(sin id)',
        url: bueno ? bueno.url : ((assets.visual && assets.visual.href) || ''),
        descripcion: trozos.join(' · '),
        id: f.id || null,
        tipo: bueno ? bueno.tipo : 'STAC',
        cargable: !!bueno,
        // Sin asset cargable, lo que se enseña del item es solo información:
        // sus assets son ficheros (COG, JP2, GeoTIFF) y la API no construye
        // capas con ellos. Un botón de cargar ahí solo podría fallar.
        soloInfo: !bueno,
        // La huella del item: el rectángulo para encuadrar y el polígono para
        // dibujar. Si no hay bbox, sale del polígono, que es lo mismo.
        bbox: bbox,
        geometria: geometria,
        // La cobertura de nubes, que es el dato con el que se decide si una
        // escena de satélite sirve para algo.
        nubes: (nubes === undefined || nubes === null) ? null : Number(nubes)
      };
    });
  }

  /**
   * El enlace `rel="next"` de una respuesta de items, resuelto a URL absoluta.
   *
   * Las APIs STAC lo dan de dos maneras y hay que saber leer las dos: con el
   * token en el href (GET, que es lo que hace Earth Search, medido) o con un
   * cuerpo POST aparte. Con el cuerpo no se puede seguir en un `fetch` normal,
   * así que aquí se devuelve null y quien llama sigue con lo que haya.
   *
   * @param {Object} json Respuesta de la API de items.
   * @param {string} base La URL que se pidió, para resolver un href relativo.
   * @returns {string|null}
   */
  function enlaceSiguiente(json, base) {
    const enlaces = (json && Array.isArray(json.links)) ? json.links : [];
    for (let i = 0; i < enlaces.length; i++) {
      const l = enlaces[i];
      if (!l || l.rel !== 'next' || !l.href) continue;
      const metodo = String(l.method || 'GET').toUpperCase();
      if (metodo !== 'GET') return null;
      return resolver(base, l.href);
    }
    return null;
  }

  /**
   * Lee la página siguiente de los items de una colección de una API STAC.
   *
   * No se invoca sola: el paginador la pide cuando el usuario quiere ver más de
   * los primeros `LIMITE_ITEMS_STAC`, y lo que devuelva se suma a los ya
   * cargados.
   *
   * @param {string} urlPagina La URL del enlace `rel="next"`.
   * @returns {Promise<{entradas: Array<Object>, siguiente: (string|null)}>}
   */
  async function leerPaginaStac(urlPagina) {
    const destino = String(urlPagina || '').trim();
    if (!destino) return { entradas: [], siguiente: null };
    const j = parsear(await pedir(destino), destino);
    const feats = Array.isArray(j.features) ? j.features : [];
    return { entradas: entradasDeItems(feats), siguiente: enlaceSiguiente(j, destino) };
  }

  /**
   * El intervalo temporal de un documento STAC, como texto.
   * @param {Object} json
   * @returns {string}
   */
  function leerTemporal(json) {
    try {
      const ext = json.extent || (json.extents ? json.extents.spatial : null);
      const temporal = (json.extent && json.extent.temporal)
        || (json.extents && json.extents.temporal);
      if (!temporal || !Array.isArray(temporal.interval) || !temporal.interval[0]) return '';
      const it = temporal.interval[0];
      const desde = it[0] ? String(it[0]).slice(0, 10) : '…';
      const hasta = it[1] ? String(it[1]).slice(0, 10) : 'hoy';
      return desde === hasta ? desde : desde + ' a ' + hasta;
    } catch (e) {
      return '';
    }
  }

  /**
   * Lee un catálogo STAC y devuelve sus colecciones.
   * @param {string} url URL del catálogo (con o sin /collections).
   * @returns {Promise<Array<{nombre, url, descripcion, tipo}>>}
   */
  async function leerStac(url) {
    const base = sinBarra(url);
    // Un catálogo STAC estático es un fichero (catalog.json) y se pide tal cual;
    // una API STAC se consulta en su /collections.
    const destino = (/\.json$/i.test(base) || /\/collections$/.test(base))
      ? base
      : base + '/collections';
    const json = parsear(await pedir(destino), destino);

    // Un catálogo STAC estático (un catalog.json) no tiene /collections: sus
    // colecciones vienen en los enlaces con rel="child".
    if (!Array.isArray(json.collections) && Array.isArray(json.links)) {
      return json.links
        .filter(function (l) { return l && (l.rel === 'child' || l.rel === 'item'); })
        .map(function (l) {
          const abs = resolver(destino, l.href);
          return {
            nombre: l.title || nombreDeHref(abs),
            url: abs,
            descripcion: resumen(l.description || '', 110),
            // Una colección STAC no es una capa: lo dice el tipo para que el
            // plugin lo explique en vez de fallar al cargar. Y trae `abrir`
            // para poder entrar en ella y ver lo que contiene.
            tipo: 'STAC',
            abrir: l.rel === 'child' ? abs : null
          };
        });
    }

    const colecciones = Array.isArray(json.collections) ? json.collections : [];
    // La raíz de la API se saca del documento que se ha pedido, y no de la URL
    // que se escribió: si esa ya acababa en /collections, construir las rutas
    // sobre ella las duplicaba ("/v1/collections/collections/<id>/items",
    // medido).
    const raiz = /\/collections$/.test(destino) ? destino.replace(/\/collections$/, '') : destino;

    return colecciones.map(function (c) {
      const id = c.id || (c.properties && c.properties.id) || '';
      const props = c.properties || c;
      const enlaces = Array.isArray(c.links) ? c.links : [];
      const relItems = enlaces.find(function (l) {
        return l && (l.rel === 'items' || /\/items(\?|$)/.test(String(l.href || '')));
      });
      return {
        nombre: c.title || props.title || id,
        url: relItems && relItems.href
          ? resolver(destino, relItems.href)
          : (id ? unir(raiz, 'collections/' + id + '/items') : raiz),
        descripcion: resumen(props.description || c.description || '', 110),
        tipo: 'OGCAPIFeatures',
        // Y se puede entrar en la colección a ver qué contiene, que es lo que
        // hace la fila en vez de offering un "Cargar" que no tiene sentido aquí.
        abrir: id ? unir(raiz, 'collections/' + id) : null,
        // Su /items es un endpoint OGC API Features y la API sí sabe construir
        // una capa con él, así que esta colección se puede cargar sin entrar.
        cargable: true
      };
    }).filter(function (e) { return e.id !== '' || e.url; });
  }

  /**
   * Lee un catálogo OGC API y devuelve sus colecciones o sus registros.
   *
   * Valen las dos formas: /collections (OGC API Features, que es lo que
   * publica el IGN) y /records (OGC API Records). Se lee la URL tal cual y se
   * decide con lo que conteste: primero se prueban las colecciones y, si no hay,
   * los registros. Así el mismo tipo sirve para los dos catálogos.
   *
   * @param {string} url
   * @returns {Promise<Array<{nombre, url, descripcion, tipo}>>}
   */
  async function leerOgapiRecords(url) {
    const base = sinBarra(url);
    // Se mira el CAMINO de la URL, sin la query: si ya apunta a /collections,
    // /records o /items se pide tal cual (una URL con ?f=json no acaba en
    // /collections y se le añadiría /records por el lado equivocado).
    const camino = String(base).split('?')[0];
    const final = /(\/collections|\/records|\/items)$/.test(camino) ? base : base + '/records';
    const json = parsear(await pedir(final), final);

    // Colecciones (OGC API Features).
    if (Array.isArray(json.collections)) {
      return json.collections.map(function (c) {
        const id = c.id || (c.properties && c.properties.id) || '';
        const props = c.properties || c;
        const enlaces = Array.isArray(c.links) ? c.links : [];
        const items = enlaces.find(function (l) {
          return l && (l.rel === 'items' || /\/items(\?|$)/.test(String(l.href || '')));
        });
        return {
          nombre: c.title || props.title || id,
          url: (items && items.href) ? resolver(final, items.href) : (id ? unir(base, 'collections/' + id + '/items') : base),
          descripcion: resumen(props.description || c.description || '', 110),
          tipo: 'OGCAPIFeatures'
        };
      }).filter(function (e) { return e.url; });
    }

    // Registros (OGC API Records).
    const registros = Array.isArray(json.features) ? json.features
      : (Array.isArray(json.records) ? json.records
        : (Array.isArray(json.items) ? json.items : []));
    if (!registros.length) throw new Error('La respuesta no trae colecciones ni registros.');
    return registros.map(function (r) {
      const props = r.properties || {};
      const enlaces = Array.isArray(r.links) ? r.links : [];
      const items = enlaces.find(function (l) { return l && (l.rel === 'items' || /\/items$/.test(String(l.href || ''))); });
      return {
        nombre: props.title || props.name || r.id || '(sin título)',
        url: (items && items.href) ? items.href : base,
        descripcion: resumen(props.description || props.abstract || '', 110),
        tipo: 'WFS'
      };
    });
  }

  /**
   * Lee un JSON propio con una lista de servicios.
   * @param {string} url
   * @returns {Promise<Array<{nombre, url, descripcion, tipo}>>}
   */
  async function leerJson(url) {
    const json = parsear(await pedir(url), url);

    let lista = null;
    if (Array.isArray(json)) {
      lista = json;
    } else {
      for (let i = 0; i < CLAVES_LISTA.length; i++) {
        if (Array.isArray(json[CLAVES_LISTA[i]])) { lista = json[CLAVES_LISTA[i]]; break; }
      }
    }
    if (!lista) throw new Error('El JSON no trae una lista reconocible de servicios.');

    return lista.map(function (e) {
      const nombre = e.nombre || e.name || e.title || e.id || e.url;
      const dir = e.url || e.capa || e.href || e.endpoint || e.uri || '';
      return {
        nombre: nombre || '(sin nombre)',
        url: unir(url, String(dir)),
        descripcion: resumen(e.descripcion || e.description || '', 110),
        tipo: e.tipo || e.type || 'WMS'
      };
    }).filter(function (e) { return e.url; });
  }

  /** Lector por tipo. */
  const LECTORES = {
    stac: leerStac,
    ogcapi: leerOgapiRecords,
    json: leerJson
  };

  /**
   * Consulta un catálogo y devuelve sus entradas.
   * @param {string} tipo 'stac' | 'ogcapi' | 'json'
   * @param {string} url
   * @returns {Promise<Array<Object>>}
   */
  function leer(tipo, url) {
    const lector = LECTORES[tipo];
    if (!lector) return Promise.reject(new Error('Tipo de catálogo desconocido: ' + tipo));
    return Promise.resolve().then(function () { return lector(String(url || '').trim()); });
  }

  // =====================================================================
  //  Alta, baja y persistencia
  // =====================================================================
  // Los catálogos del usuario se guardan en localStorage. Si no se puede
  // (modo privado, permisos), se siguen teniendo en memoria y ya está.

  let memoria = null;

  /** Lee todos los catálogos dados de alta. */
  function todos() {
    if (memoria) return memoria;
    try {
      const crudo = window.localStorage.getItem(CLAVE);
      memoria = crudo ? (JSON.parse(crudo) || []) : [];
    } catch (e) {
      memoria = [];
    }
    return memoria;
  }

  /** Escribe la lista en localStorage. */
  function guardar() {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(memoria || []));
    } catch (e) {
      // Sin localStorage se sigue funcionando, pero no sobrevive al recarga.
    }
  }

  /**
   * Da de alta un catálogo. Si ya había uno con esa URL, lo actualiza.
   *
   * @param {Object} datos { nombre, tipo, url }
   * @returns {Object} El catálogo dado de alta (con su id).
   */
  function alta(datos) {
    const nombre = String(datos.nombre || '').trim();
    const url = String(datos.url || '').trim();
    const tipo = String(datos.tipo || '').trim();

    if (!nombre) throw new Error('Ponle un nombre al catálogo.');
    if (!url) throw new Error('Falta la URL del catálogo.');
    if (!/^https?:\/\//i.test(url)) throw new Error('La URL tiene que empezar por http:// o https://');
    if (!LECTORES[tipo]) throw new Error('Elige el tipo de catálogo.');

    const lista = todos();
    const id = 'usuario_' + Math.abs([...url].reduce(function (a, c) {
      return ((a << 5) - a + c.charCodeAt(0)) | 0;
    }, 0)).toString(36) + '_' + Date.now().toString(36);

    const existente = lista.find(function (c) { return c.url === url; });
    if (existente) {
      existente.nombre = nombre;
      existente.tipo = tipo;
      guardar();
      return existente;
    }

    const catalogo = { id: id, nombre: nombre, tipo: tipo, url: url, propio: true };
    lista.push(catalogo);
    guardar();
    return catalogo;
  }

  /**
   * Da de baja un catálogo.
   * @param {string} id
   */
  function baja(id) {
    memoria = todos().filter(function (c) { return c.id !== id; });
    guardar();
  }

  /** Devuelve el catálogo dado de alta con ese id, o null. */
  function porId(id) {
    return todos().find(function (c) { return c.id === id; }) || null;
  }

  // =====================================================================
  //  Exposición
  // =====================================================================
  window.CatalogoRegistro = {
    TIPOS: TIPOS,
    CLAVE: CLAVE,
    leer: leer,
    // Lectura de UN nodo STAC con sus hijos y su padre: es lo que permite bajar
    // por el árbol de un catálogo y volver a subir (ver _abrirNodoStac).
    leerNodoStac: leerNodoStac,
    leerPaginaStac: leerPaginaStac,
    todos: todos,
    porId: porId,
    alta: alta,
    baja: baja
  };
})();
