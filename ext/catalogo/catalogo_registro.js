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
          return {
            nombre: l.title || nombreDeHref(l.href),
            url: resolver(destino, l.href),
            descripcion: resumen(l.description || '', 110),
            // Una colección STAC no es una capa: lo dice el tipo para que el
            // plugin lo explique en vez de fallar al cargar.
            tipo: 'STAC'
          };
        });
    }

    const colecciones = Array.isArray(json.collections) ? json.collections : [];
    return colecciones.map(function (c) {
      const id = c.id || (c.properties && c.properties.id) || '';
      const props = c.properties || c;
      return {
        nombre: c.title || props.title || id,
        url: id ? unir(base, 'collections/' + id + '/items') : base,
        descripcion: resumen(props.description || c.description || '', 110),
        tipo: 'OGCAPIFeatures'
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
    todos: todos,
    porId: porId,
    alta: alta,
    baja: baja
  };
})();