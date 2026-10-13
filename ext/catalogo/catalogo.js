/* =====================================================================
   CATALOGO: plugin para API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   QUÉ ES
   ---------------------------------------------------------------------
   Un catálogo de servicios y capas que se pueden cargar en el visualizador
   de dos maneras:

     1. LISTADO PREDEFINIDO: cada tipo de catálogo trae sus propios
        servicios (WMS, WMTS, WFS, GeoJSON...) ya escritos, para no tener
        que saberse la URL de memoria. Se cambia de catálogo con un
        <select> y cada uno tiene su propia sección.

     2. AÑADIR POR URL: un botón abre un cuadro donde el usuario pega la
        URL de un servicio o de un archivo publicado por http/https, y el
        plugin la carga en el mapa.

   LOS TIPOS DE CATÁLOGO (objeto IDEE.catalog)
   ---------------------------------------------------------------------
   `IDEE.catalog` es el registro de tipos. Cada tipo sabe:
     - listar()        -> sus secciones (IDEE) o sus servicios fijos (STAC...)
     - cargarUrl(...)  -> qué capas crea a partir de una URL

   Tipos (ver CATALOGOS más abajo):
     - 'idee'           Catálogo IDEE, por secciones y tipo de servicio
     - 'stac'           STAC (SpatioTemporal Asset Catalog)
     - 'ogcapi-records' OGC API Records

   FICHEROS DEL PLUGIN
   ---------------------------------------------------------------------
     - catalogo.js      El plugin: interfaz, estado y carga.
     - catalogo_idee.js Cliente del catálogo de la IDEE (secciones y parseo),
                        adaptación del complemento de QGIS serviciosIDEE2QGIS.
     - catalogo_url.js  Detección del tipo de capa a partir de una URL, lectura
                        del documento de capacidades y creación de la capa.

   ESTADO DE DESARROLLO
   ---------------------------------------------------------------------
   Está hecho el circuito completo: el catálogo de la IDEE se pide por secciones
   al portal y se filtra; una URL se analiza, se lee su documento de
   capacidades y se eligen las capas y el nombre antes de cargarla.

   PATRONES DEL REPOSITORIO (ver ext/plantilla_plugin)
   ---------------------------------------------------------------------
   - Clase ES6 `miPlugin_catalogo` con constructor(options) + addTo(map),
     para poder registrarla con mapajs.addPlugin(new miPlugin_catalogo(...)).
   - Exposición triple al final (window, IDEE.plugin y M.plugin) para que
     sobreviva a la recarga del bundle de la API en el cambio 2D/3D.
   - Contrato de estado getState / setState para conservar la UI en el swap.
   - Colores color1/color2/color3 con los valores por defecto del repo.
   - Icono como MÁSCARA (--g-plugin-icon-mask), nunca con color escrito.
   ===================================================================== */

(function () {
  "use strict";

  /**
   * Resuelve el objeto global de la API cartográfica (IDEE en builds modernas
   * o M en builds históricos/compatibilidad).
   * @returns {Object} Espacio de nombres de la API-IDEE / API-CNIG.
   */
  function api() {
    return window.IDEE || window.M;
  }

  /**
   * Envuelve contenido suelto de un SVG en un `<svg>` de 24x24, que es la medida
   * en la que vienen dibujados casi todos los iconos.
   * @param {string} contenido Contenido interior del SVG.
   * @returns {string} SVG completo.
   */
  function envolverSvg(contenido) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
      + contenido + '</svg>';
  }

  /**
   * Prepara un SVG para meterlo en un data URI: codifica lo que
   * `encodeURIComponent` deja fuera y que ahí rompe la URL.
   * @param {string} svg SVG completo.
   * @returns {string} SVG listo para el data URI.
   */
  function codificarSvg(svg) {
    return encodeURIComponent(svg)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\'/g, '%27')
      .replace(/\+/g, '%20');
  }

  /**
   * Convierte el icono que se pasa al constructor en algo que se pueda poner en
   * un `mask-image` de CSS, que es como se pinta el icono del botón.
   * @param {string} icono Icono en cualquiera de las tres formas.
   * @returns {string|null} `url("...")` listo para CSS, o null si no es válido.
   */
  function urlDeIcono(icono) {
    if (typeof icono !== 'string') return null;
    const limpio = icono.trim();
    if (!limpio) return null;

    // Es una URL o una ruta: se respeta tal cual (sin codificar el contenido).
    const esUrl = /^(data:|https?:|blob:|file:|\/|\.\/|\.\.\/)/i.test(limpio)
      || /\.svg(?:[?#].*)?$/i.test(limpio);
    if (esUrl) {
      return 'url("' + limpio.replace(/"/g, '%22').replace(/\s/g, '%20') + '")';
    }

    const traeSvg = /<svg[\s>]/i.test(limpio);
    const traeForma = /<(path|circle|rect|line|polyline|polygon|ellipse|g|use|symbol|text)\b/i.test(limpio);
    if (!traeSvg && !traeForma) {
      return null;
    }

    const svg = traeSvg ? limpio : envolverSvg(limpio);
    return 'url("data:image/svg+xml,' + codificarSvg(svg) + '")';
  }

  // =====================================================================
  //  IDEE.catalog: el registro de tipos de catálogo
  // =====================================================================
  // Cada tipo es un objeto con:
  //   id        Identificador (lo que vale en el <select>).
  //   nombre    Lo que se ve en el <select>.
  //   listar()  Devuelve los servicios predefinidos de ese catálogo:
  //             [{ nombre, url, tipo, descripcion? }]  (tipo: 'WMS', 'WMTS',
  //             'WFS', 'GeoJSON', 'KML'...).
  //   cargarUrl(url, map)  Carga esa URL en el mapa y devuelve la capa creada
  //             (o null si no supo qué hacer con ella).
  //
  // Para añadir un tipo nuevo basta con meterlo en CATALOGOS: el <select>, la
  // lista y el estado lo cogen solos.
  // =====================================================================

  // El catálogo IDEE ya NO lleva una lista escrita a mano: se pide al portal
  // de la IDEE por secciones (ver catalogo_idee.js). Lo que aquí queda son los
  // catálogos que son una lista corta y fija: STAC y OGC API Records.

  /**
   * Carga una URL en el mapa.
   *
   * La detección de tipo y la lectura de las capas del servicio están en
   * catalogo_url.js; aquí solo se le pasa lo que el usuario ha elegido en el
   * panel (qué capas y con qué nombre).
   *
   * @param {string} url URL del servicio.
   * @param {Object} mapa Instancia del mapa API-IDEE.
   * @param {Object} [opciones] { tipo, capas, nombre }.
   * @returns {Array<Object>} Las capas creadas, o [].
   */
  function cargarUrlGenerica(url, mapa, opciones) {
    const opts = opciones || {};
    const urlTool = window.CatalogoURL;
    if (!urlTool) {
      console.error('[catalogo] no está cargado catalogo_url.js');
      return [];
    }
    // El tipo lo pone el panel si ya lo sabe (viene de leer las capabilities);
    // si no, lo deduce la algoritmia por la URL.
    return urlTool.cargar({
      url: url,
      mapa: mapa,
      tipo: opts.tipo || urlTool.detectarTipo(url),
      capas: (opts.capas && opts.capas.length) ? opts.capas : null,
      nombre: opts.nombre || ''
    });
  }

  /**
   * Normaliza un servicio declarado en el JSON.
   *
   * El TIPO NO HAY QUE PONERLO: si viene, se respeta; si no, lo deduce la
   * algoritmia de catalogo_url.js a partir de la URL, que es lo que sabe
   * distinguir un WMS de un GeoJSON o de una plantilla de teselas.
   *
   * @param {Object} s
   * @returns {Object}
   */
  function servicioDesdeDatos(s) {
    const url = s.url || s.capa || s.href || '';
    const declarado = s.tipo || s.type || null;
    const urlTool = window.CatalogoURL;
    return {
      nombre: s.nombre || s.name || s.title || url || '(sin nombre)',
      url: url,
      descripcion: s.descripcion || s.description || '',
      // Lo declarado manda; si no, se deduce de la URL.
      tipo: declarado || (urlTool ? urlTool.detectarTipo(url) : 'WMS')
    };
  }

  /**
   * Normaliza un nodo del árbol. Un nodo puede llevar servicios Y subnodos, y
   * los subnodos son nodos igual, así que el árbol es de profundidad libre:
   *
   *   { nombre: 'Rasters', servicios: [ ... ],
   *     nodos: [ { nombre: 'Ortofoto', servicios: [ ... ] } ] }
   *
   * @param {Object} datos
   * @param {string} [nombrePorDefecto]
   * @returns {Object} Nodo normalizado, con `total` ya calculado.
   */
  function nodoDesdeDatos(datos, nombrePorDefecto) {
    const d = datos || {};
    const servicios = (Array.isArray(d.servicios) ? d.servicios : []).map(servicioDesdeDatos);
    const crudos = Array.isArray(d.nodos) ? d.nodos
      : (Array.isArray(d.hijos) ? d.hijos : (Array.isArray(d.secciones) ? d.secciones : []));
    const nodos = crudos.map(function (n) { return nodoDesdeDatos(n); });

    let total = servicios.length;
    nodos.forEach(function (n) { total += n.total; });

    return {
      nombre: d.nombre || d.name || nombrePorDefecto || '(sin nombre)',
      descripcion: d.descripcion || d.description || '',
      servicios: servicios,
      nodos: nodos,
      total: total
    };
  }

  /**
   * Construye un catálogo a partir de datos planos, para declararlo desde el
   * constructor del plugin con un JSON, sin escribir funciones.
   *
   * Forma del dato:
   *
   *   {
   *     nombre: 'Servicios del visor',   // obligatorio-ish
   *     descripcion: '...',               // opcional
   *     modo: 'arbol',                    // 'arbol' (defecto si hay nodos),
   *     servicios: [ { nombre, url } ],   //   'lista', o
   *     nodos: [ { nombre, servicios, nodos } ]  //   'secciones' (IDEE)
   *   }
   *
   * El tipo de cada servicio NO se pone: lo deduce la algoritmia por la URL.
   *
   * @param {string} id Id del catálogo.
   * @param {Object} datos Datos planos, o un objeto con listar() si se
   *   prefiere pasar directamente un IDEE.catalog ya hecho.
   * @returns {Object} Catálogo con la forma de IDEE.catalog.tipos.{id}.
   */
  function catalogoDesdeDatos(id, datos) {
    // Si ya viene hecho (trae listar()), se respeta tal cual.
    if (datos && typeof datos.listar === 'function') {
      return Object.assign({ id: id }, datos);
    }

    const d = datos || {};
    const servicios = (Array.isArray(d.servicios) ? d.servicios : []).map(servicioDesdeDatos);
    const nodosCrudos = Array.isArray(d.nodos) ? d.nodos
      : (Array.isArray(d.hijos) ? d.hijos : []);
    const secciones = Array.isArray(d.secciones) ? d.secciones : [];

    // Modo por defecto: árbol si trae nodos, lista si solo trae servicios, y
    // secciones si lo dice explícitamente (que es lo de la IDEE).
    const modo = d.modo
      || (secciones.length ? 'secciones' : (nodosCrudos.length ? 'arbol' : 'lista'));

    const nodos = nodosCrudos.map(function (n) { return nodoDesdeDatos(n); });

    return {
      id: id,
      nombre: d.nombre || d.name || id,
      modo: modo,
      descripcion: d.descripcion || d.description || '',
      servicios: servicios,
      nodos: nodos,
      secciones: secciones.map(function (s) {
        return {
          id: s.id || s.nombre || '',
          nombre: s.nombre || s.name || s.id || '(sin nombre)',
          tipo: s.tipo || s.type || 'WMS',
          corto: s.corto || s.nombre || s.id || '',
          descripcion: s.descripcion || '',
          servicios: Array.isArray(s.servicios) ? s.servicios.map(servicioDesdeDatos) : []
        };
      }),
      listar: function () {
        if (this.modo === 'secciones') return this.secciones;
        if (this.modo === 'arbol') return this.nodos;
        return this.servicios;
      },
      cargarUrl: d.cargarUrl || function (url, mapa, opciones) {
        return cargarUrlGenerica(url, mapa, opciones);
      }
    };
  }

  /**
   * Clave de localStorage donde se recuerda con qué catálogo se quedó abierto
   * el panel, para que al volver al visualizador siga por el mismo.
   */
  const CLAVE_SELECCION = 'galeria_catalogo_seleccion';

  /**
   * Clave de localStorage donde se recuerda con qué TIPO DE SERVICIO se quedó el
   * catálogo de la IDEE, para que al volver al visualizador siga por el mismo
   * y no haya que volver a elegirlo.
   */
  const CLAVE_SECCION = 'galeria_catalogo_seccion';

  /**
   * Servicios que se pintan por página en una sección.
   *
   *  Antes había un tope de 250 filas con un aviso al final, que quedaba a
   *  18.000 px de scroll y no se veía: parecía que faltaban servicios. Fifty
   *  páginas de 50 se ven enteras en una o dos pantallas y el paginador deja
   *  claro en qué página se está, cuántas hay y cuántas cosas quedan.
   */
  const TAMANIO_PAGINA = 50;

  /** Último tipo de servicio elegido, o null. */
  function leerSeccion() {
    try {
      return window.localStorage.getItem(CLAVE_SECCION) || null;
    } catch (e) {
      return null;
    }
  }

  /** Recuerda el tipo de servicio elegido. */
  function guardarSeccion(id) {
    try {
      window.localStorage.setItem(CLAVE_SECCION, String(id));
    } catch (e) {
      /* sin localStorage se sigue funcionando, pero no se recuerda */
    }
  }

  /** Último catálogo elegido, o null si nunca se eligió o no hay localStorage. */
  function leerSeleccion() {
    try {
      return window.localStorage.getItem(CLAVE_SELECCION) || null;
    } catch (e) {
      return null;
    }
  }

  /** Recuerda el catálogo elegido. */
  function guardarSeleccion(id) {
    try {
      window.localStorage.setItem(CLAVE_SELECCION, String(id));
    } catch (e) {
      // Sin localStorage (modo privado, permisos) se sigue funcionando, pero
      // no se recuerda entre recargas.
    }
  }

  /**
   * A partir de cuántos caracteres el filtro puede mirar también la URL.
   *
   *  Las URLs de estos servicios llevan SIEMPRE su coletilla de protocolo
   *  ("…?request=GetCapabilities&service=WMS"), así que buscar "ca" en la URL
   *  sale en los 1642 servicios de la sección WMS de la IDEE (medido: escribir
   *  "ca" devolvía los 1642, porque "GetCapabilities" lleva "ca"). El campo dice
   *  "Filtrar por servicio u organismo", así que corto se busca en el nombre y
   *  en el organismo; a partir de seis caracteres ya se admite la URL, que es
   *  cuando se está buscando un dominio o una palabra larga de verdad.
   */
  const MIN_CARACTERES_BUSQUEDA_URL = 6;

  /**
   * ¿Coincide un servicio con lo que hay escrito en el filtro?
   *
   * @param {Object} srv Servicio {nombre, url}.
   * @param {string} [organismo] Nombre del organismo al que pertenece.
   * @param {string} f Texto del filtro ya en minúsculas y sin espacios.
   * @returns {boolean}
   */
  function coincideServicio(srv, organismo, f) {
    if (!f) return true;
    if (String(srv.nombre || '').toLowerCase().indexOf(f) > -1) return true;
    if (String(organismo || '').toLowerCase().indexOf(f) > -1) return true;
    if (f.length >= MIN_CARACTERES_BUSQUEDA_URL
      && String(srv.url || '').toLowerCase().indexOf(f) > -1) return true;
    return false;
  }

  /**
   * Saca un id utilizable de un nombre: "Servicios de Madrid" ->
   * "servicios-de-madrid". Sin acentos, en minúsculas y con guiones.
   * @param {string} nombre
   * @returns {string}
   */
  function idDesdeNombre(nombre) {
    const base = String(nombre || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // fuera los acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || ('cat' + Date.now().toString(36));
  }

  /**
   * IDEE.catalog.custom: un catálogo declarado por el visualizador, en datos
   * planos. Se instancia ANTES de crear el plugin y se le pasa en su array
   * de catálogos:
   *
   *   const propio = new IDEE.catalog.custom({
   *     nombre: 'Servicios del visor',
   *     nodos: [
   *       { nombre: 'Ráster', servicios: [{ nombre: 'Callejero', url: '...' }] },
   *       { nombre: 'Organismo', nodos: [ ... ] }
   *     ]
   *   });
   *
   *   mapajs.addPlugin(new miPlugin_catalogo({ catalogos: [propio] }));
   *
   * El TIPO de cada servicio no se pone: lo deduce la algoritmia de
   * catalogo_url.js a partir de la URL.
   *
   * El objeto resultante tiene la misma forma que IDEE.catalog.tipos.idee:
   * id, nombre, modo, listar() y cargarUrl(), así que se puede leer suelto
   * desde IDEE.catalog.propios.
   */
  class CatalogoCustom {
    /**
     * @param {Object} [opciones]
     * @param {string} [opciones.id] Id. Si no, se saca del nombre.
     * @param {string} opciones.nombre Nombre del catálogo.
     * @param {string} [opciones.descripcion]
     * @param {Array} [opciones.servicios] Lista plana de servicios.
     * @param {Array} [opciones.nodos] Subnodos (un nodo puede llevar
     *   servicios y subnodos a la vez, y así sucesivamente).
     * @param {Array} [opciones.secciones] Secciones tipo IDEE.
     * @param {string} [opciones.modo] arbol | lista | secciones.
     * @param {Function} [opciones.cargarUrl] Cargador propio, por si el
     *   visualizador quiere otra cosa que la detección por URL.
     */
    constructor(opciones = {}) {
      const datos = Object.assign({}, opciones || {});
      datos.id = datos.id || idDesdeNombre(datos.nombre);
      const base = catalogoDesdeDatos(datos.id, datos);
      Object.assign(this, base);
      // Marca de catálogo construido, para distinguirlo de un objeto suelto.
      this.esCatalogo = true;
    }
  }

  /**
   * Base de los catálogos que se CONSULTAN por una URL: al seleccionarlos el
   * plugin pide el documento a esa URL (con fetch directo) y lista lo
   * que encuentre. Es lo que hacen los catálogos STAC y OGC API Records, y
   * también los que se dan de alta desde el panel.
   *
   * El LECTOR es el de catalogo_registro.js (stac, ogcapi o json).
   */
  class CatalogoRemoto {
    constructor(opciones = {}) {
      // Los valores por defecto los mete cada subclase al llamar a super();
      // aquí no se puede tocar this, porque en una clase derivada no se puede
      // tocar this antes de super() y el script entero se caía al cargar.
      const d = Object.assign({}, opciones || {});
      const base = new CatalogoCustom({
        id: d.id,
        nombre: d.nombre,
        descripcion: d.descripcion,
        modo: 'lista'
      });
      Object.assign(this, base);
      // La URL del nodo inicial: lo que se consulta para sacar la lista.
      this.url = d.url || '';
      this.tipoLectura = d.tipoLectura || 'json';
      // Marca de catálogo consultado: el plugin lo pide y lo cachea.
      this.seConsulta = true;
      this.esCatalogo = true;
    }
  }

  /**
   * IDEE.catalog.STAC: un catálogo STAC, que se consulta para sacar sus
   * colecciones.
   *
   *   new IDEE.catalog.STAC({
   *     nombre: 'Copernicus Data Space',
   *     descripcion: 'Sentinel-1/2/3/5P y datos Copernicus',
   *     url: 'https://catalogue.dataspace.copernicus.eu/stac'
   *   })
   *
   * La URL es la del catálogo: el plugin le añade /collections y lee lo que
   * devuelva. Sin `url`, se usa la de Copernicus.
   */
  class CatalogoSTAC extends CatalogoRemoto {
    constructor(opciones = {}) {
      super(Object.assign({
        id: 'stac',
        nombre: 'STAC',
        descripcion: 'Catálogo STAC con colecciones de imágenes.',
        url: 'https://catalogue.dataspace.copernicus.eu/stac',
        tipoLectura: 'stac'
      }, opciones));
    }
  }

  /**
   * IDEE.catalog.OGCAPIRecords: un catálogo de metadatos, que se consulta
   * para sacar sus registros.
   *
   *   new IDEE.catalog.OGCAPIRecords({
   *     nombre: 'Catálogo central IDEE',
   *     descripcion: 'Metadatos de los servicios IDEE',
   *     url: 'https://www.ign.es/ogcapi-records'
   *   })
   *
   * Acepta tanto /records (OGC API Records) como /collections (OGC API
   * Features); el lector decide con lo que conteste. Sin `url`, se usa el
   * API de Features del IGN.
   */
  class CatalogoOGCAPIRecords extends CatalogoRemoto {
    constructor(opciones = {}) {
      super(Object.assign({
        id: 'ogcapi-records',
        nombre: 'OGC API Records',
        descripcion: 'Catálogo de metadatos (CSW moderno).',
        url: 'https://api-features.ign.es/collections',
        tipoLectura: 'ogcapi'
      }, opciones));
    }
  }
  /**
   * IDEE.catalog.IDEE: el catálogo de la IDEE, que no lleva la lista escrita
   * sino que se pide por secciones al portal (ver catalogo_idee.js).
   *
   *   const catalogo = new IDEE.catalog.IDEE();               // el de serie
   *   const parcial = new IDEE.catalog.IDEE({                  // solo unas
   *     nombre: 'WMS autonómicos',                            //   secciones
   *     secciones: [SECCIONES.find(s => s.id === 'wms_aut')]
   *   });
   *
   * Con `servicios` se le añaden servicios propios a una sección que ya no
   * los trae. Las secciones son las de CatalogoIDEE.SECCIONES.
   */
  class CatalogoIDEE {
    constructor(opciones = {}) {
      const secciones = (window.CatalogoIDEE && window.CatalogoIDEE.SECCIONES) || [];
      const base = new CatalogoCustom(Object.assign({
        id: 'idee',
        nombre: 'Catálogo IDEE',
        descripcion: 'Servicios publicados en el catálogo de la IDEE, por tipo.',
        modo: 'secciones',
        secciones: secciones
      }, opciones));
      Object.assign(this, base);
      this.esCatalogo = true;
    }
  }

  /**
   * Los tipos de catálogo.
   *
   * Cada tipo declara cómo se pinta su sección de gestión en el panel:
   *
   *   - modo 'secciones'  El catálogo se pide por secciones (tipo de servicio).
   *                       Debajo del <select> sale un buscador y un acordeón
   *                       con las secciones; cada una, al abrirse, se pide.
   *                       Es lo que hace la IDEE, con sus diez secciones.
   *   - modo 'arbol'      Un árbol de nodos desplegables, de profundidad libre.
   *   - modo 'lista'      Una lista corta y fija.
   *
   * Los tres de serie son clases (IDEE.catalog.IDEE, .STAC y .OGCAPIRecords) y
   * los propios se crean con new IDEE.catalog.custom({...}). Todos se pueden
   * pasar por el array `catalogos` del constructor del plugin para
   * parametrízarlos; si el id coincide con uno de estos, lo pisan.
   */
  const CATALOGOS = {
    idee: new CatalogoIDEE(),
    stac: new CatalogoSTAC(),
    'ogcapi-records': new CatalogoOGCAPIRecords()
  };

  /**
   * Monta el juego de catálogos de una instancia a partir de lo que le llega
   * al constructor.
   *
   * - `catalogos` puede ser un array de entradas o un objeto con la entrada
   *   como clave (en ese caso la clave es su id).
   * - Si un id coincide con uno de serie, lo pisa; si no, se añade.
   * - Con `soloCatalogos: true` se queda únicamente con los que llegan.
   *
   * @param {Object} [opciones] Opciones del constructor.
   * @returns {{todos: Object, propios: Object}}
   */
  function construirCatalogos(opciones) {
    const entrada = (opciones && opciones.catalogos) || null;
    const registro = window.IDEE && window.IDEE.catalog;
    const propios = {};

    const meter = function (id, dato) {
      // Una instancia de IDEE.catalog.custom (o cualquier catálogo ya
      // hecho) se respeta tal cual; los datos planos se convierten.
      propios[id] = (dato && typeof dato.listar === 'function')
        ? Object.assign({ id: id }, dato)
        : catalogoDesdeDatos(id, dato);
    };

    // Una entrada del array vale: un catálogo ya hecho, sus datos planos, o
    // el contenedor IDEE.catalog.propios (que se expande en sus catálogos).
    const meterContenedor = function (contenedor) {
      if (!contenedor || typeof contenedor !== 'object') return;
      Object.keys(contenedor).forEach(function (id) {
        if (typeof contenedor[id] === 'function') return;   // crear() y demás
        meter(id, contenedor[id]);
      });
    };

    const meterEntrada = function (item, i) {
      if (!item || typeof item !== 'object') return;
      if (typeof item.listar === 'function') { meter(item.id || ('cat' + i), item); return; }
      if (item === registro || item === registro.propios || item === registro.tipos) {
        meterContenedor(item === registro.tipos ? registro.propios : item);
        return;
      }
      if (Array.isArray(item.servicios) || Array.isArray(item.nodos)
        || Array.isArray(item.secciones) || item.modo) {
        meter(item.id || idDesdeNombre(item.nombre) || ('cat' + i), item);
        return;
      }
      meterContenedor(item);
    };

    if (Array.isArray(entrada)) {
      entrada.forEach(meterEntrada);
    } else if (entrada && typeof entrada === 'object') {
      // Forma antigua: un objeto con un catálogo por clave. Se sigue
      // admitiendo para no romper lo que ya haya escrito.
      meterContenedor(entrada);
    }

    const solo = opciones && opciones.soloCatalogos;
    const todos = solo ? Object.assign({}, propios) : Object.assign({}, CATALOGOS, propios);
    return { todos: todos, propios: propios };
  }

  /**
   * Expone el registro de catálogos en IDEE.catalog (y en M.catalog, que es el
   * alias histórico). Así cualquier código puede hacer
   * `IDEE.catalog.tipos.idee.listar()` o crear un tipo nuevo.
   */
  function exponerCatalog() {
    const registro = {
      tipos: CATALOGOS,
      // Catálogos declarados por los visualizadores, ya construidos. El
      // plugin deja aquí los que le llegan por su array de catálogos.
      propios: {},
      /**
       * La clase de catálogo propio: new IDEE.catalog.custom({...}). Lo que
       * devuelve tiene la misma forma que IDEE.catalog.tipos.idee.
       */
      custom: CatalogoCustom,
      // Los tres catálogos de serie, como clases, para poder instanciarlos y
      // parametrízarlos desde el visualizador:
      //   new IDEE.catalog.IDEE(), new IDEE.catalog.STAC(),
      //   new IDEE.catalog.OGCAPIRecords()
      IDEE: CatalogoIDEE,
      STAC: CatalogoSTAC,
      OGCAPIRecords: CatalogoOGCAPIRecords,
      /**
       * Instancia un catálogo propio y lo deja en IDEE.catalog.propios.
       * Es un atajo de custom: crearlo y cogerlo del mismo sitio.
       * @param {string} id
       * @param {Object} datos
       * @returns {Object} El catálogo creado.
       */
      crear: function (id, datos) {
        const c = new CatalogoCustom(Object.assign({ id: id }, datos || {}));
        registro.propios[c.id] = c;
        return c;
      },
      /** Devuelve el catálogo con ese id, de serie o propio, o null. */
      tipo: function (id) { return CATALOGOS[id] || registro.propios[id] || null; },
      /** Lista de ids de catálogo, en el orden del <select>. */
      ids: function () {
        return Object.keys(CATALOGOS).concat(
          Object.keys(registro.propios).filter(function (id) { return !CATALOGOS[id]; })
        );
      }
    };
    window.IDEE = window.IDEE || {};
    window.IDEE.catalog = registro;
    window.M = window.M || {};
    window.M.catalog = registro;
    // Al alternar 2D/3D la API recarga su bundle y window.IDEE pasa a ser un
    // objeto NUEVO, que se queda sin .catalog: el visualizador hace
    // `new IDEE.catalog.IDEE()` y revienta con "Cannot read properties of
    // undefined (reading 'IDEE')" al volver a ejecutar mapa() (medido en
    // MapaBase). Este global NO depende de window.IDEE, así que sobrevive al
    // swap, y es por donde miPlugin_cambioImpl vuelve a colgar el registro en la
    // build nueva. Mismo truco que los window.miPlugin_*.
    window.miCatalogos = { exponer: exponerCatalog };
    return registro;
  }

  // =====================================================================
  //  Clase principal del plugin
  // =====================================================================
  class miPlugin_catalogo {
    /**
     * @param {Object} [options={}] Opciones de configuración.
     * @param {string} [options.position='TR'] Esquina del panel ('TL','TR','BL','BR').
     * @param {boolean} [options.collapsible=true] Si el panel se pliega a botón.
     * @param {number} [options.order=null] Orden del panel dentro de la esquina.
     * @param {Object|string} [options.color1] Color de fondo ({active,deactive} o string).
     * @param {Object|string} [options.color2] Color de borde.
     * @param {Object|string} [options.color3] Color de icono y texto.
     * @param {string} [options.icon] Icono del botón (SVG completo, contenido o URL).
     * @param {Object|Array} [options.catalogos] Catálogos del visualizador, en
     *   datos planos (un JSON). Cada entrada es un catálogo: { nombre,
     *   descripcion, modo, servicios[] } o { nombre, secciones[] }. Se suman a
     *   los de serie y, si el id coincide con uno de ellos, lo pisan.
     * @param {boolean} [options.soloCatalogos=false] Con `catalogos` a true se
     *   queda solo con los del visualizador, sin los de serie.
     */
    constructor(options = {}) {
      this.name = 'miPlugin_catalogo';
      this.options = options || {};

      this._map = null;
      this._panel = null;
      this._control = null;

      // Configuración de visualización y posición del panel
      this.position = options.position || 'TR';
      this.collapsible = (options.collapsible !== undefined) ? Boolean(options.collapsible) : true;
      this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
        ? Number(options.order)
        : null;

      // Colores del esquema del repositorio
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

      this.icon = options.icon || options.icono || options.svg || null;

      // Título de la barra del panel (la cabecera .m-herramienta-header).
      this.title = options.title || 'Catálogo';

      // En TR el API mete el botón DENTRO del panel (a la izquierda) y la
      // cabecera queda partida; en TL lo deja fuera y la cabecera es a todo
      // ancho. Con esta marca el CSS recoloca la cabecera en TR para que el
      // panel se vea igual que los demás.
      this._esTR = (this.options.position === 'TR');

      // Estado interno
      this._tipoSeleccionado = 'idee';
      this._urlIntroducida = '';

      // Catálogos de esta instancia: los de serie más los que declare el
      // visualizador. A partir de aquí TODOS los usos del registro pasan por
      // this._catalogos, no por la constante CATALOGOS.
      const construidos = construirCatalogos(options);
      this._catalogos = construidos.todos;
      this._catalogosPropios = construidos.propios;

      // Los del visualizador quedan en IDEE.catalog.propios (donde se leen
      // desde cualquier código) y también en IDEE.catalog.tipos, que es la
      // lista de la que se pinta el <select>.
      const registro = (window.IDEE && window.IDEE.catalog) || (window.M && window.M.catalog);
      if (registro) {
        if (!registro.propios) registro.propios = {};
        Object.keys(this._catalogosPropios).forEach(function (id) {
          registro.propios[id] = this._catalogosPropios[id];
          if (registro.tipos) registro.tipos[id] = this._catalogosPropios[id];
        }, this);
      }

      // Catálogo con el que se abre el panel. Por orden: el que pida el
      // visualizador con catalogoPorDefecto, el que se eligió la última vez
      // (queda en localStorage, para que al volver al visualizador siga por
      // el mismo) o el primero que haya.
      const ids = Object.keys(this._catalogos);
      const guardado = leerSeleccion();
      const existe = function (id) {
        if (!id) return false;
        if (this._catalogos[id]) return true;
        // Los catálogos que el usuario se añadió con el formulario no están
        // en this._catalogos: se buscan en el registro.
        return !!(window.CatalogoRegistro && window.CatalogoRegistro.porId(id));
      }.bind(this);

      if (existe(options.catalogoPorDefecto)) {
        this._tipoSeleccionado = options.catalogoPorDefecto;
      } else if (existe(guardado)) {
        this._tipoSeleccionado = guardado;
      } else if (ids.length) {
        this._tipoSeleccionado = ids[0];
      }
      this._ultimoMensaje = null;
      // Pestaña activa del panel ('catalogos' o 'capa').
      this._pestanaActiva = options.pestana || 'catalogos';
      this._pestanas = {};
      this._panelCatalogos = null;
      this._panelCapa = null;

      // Catálogo: filtro de texto y datos ya pedidos de la sección a la vista.
      // El tipo de servicio se elige con el SEGUNDO desplegable (ver
      // _pintarSecciones): solo hay uno activo, y el resto de secciones se
      // sueltan de memoria al cambiar, que es lo que se busca (la sección de WMS
      // estatal del IGN tiene más de setecientos servicios).
      this._seccionActiva = (typeof options.seccion === 'string') ? options.seccion : leerSeccion();
      this._filtro = options.filtro || '';
      this._estadoSecciones = {};
      // Si se han pedido ya todos los servicios de la sección (botón del
      // paginador), y la página por la que se va. Cambiar de sección, de
      // catálogo o de filtro devuelve el paginador a la primera.
      this._verTodos = false;
      this._pagina = 1;
      this._totalSeccion = 0;
      // Grupos plegables de la pestaña de catálogos ("disponibles" y "nuevo").
      this._gruposAbiertos = Array.isArray(options.grupos) ? options.grupos.slice() : ['disponibles', 'nuevo'];
      this._gruposDom = {};
      // Entradas ya consultadas de los catálogos dados de alta por el usuario.
      this._entradasPropias = {};
      this._analisis = null;

      // Referencias a la interfaz (se rellenan en _construirUI).
      this._gestorEl = null;
      this._opcionesEl = null;
      this._urlInputEl = null;
      this._selectorEl = null;
      this._capasListaEl = null;
      this._buscadorEl = null;
      this._cuentaBuscadorEl = null;
    }

    /** Normaliza un color a {active, deactive}. */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /** Pinta el icono del botón como máscara (ver plantilla_plugin). */
    _aplicarIcono(panelEl) {
      if (!panelEl || !panelEl.style) return;
      if (!this.icon) return;
      const url = urlDeIcono(this.icon);
      if (!url) {
        console.warn(this.name + ': el icono no parece un SVG ni una URL, se deja el de por defecto.');
        return;
      }
      try {
        panelEl.style.setProperty('--g-plugin-icon-mask', url);
      } catch (e) {
        console.warn(this.name + ': no se pudo aplicar el icono.', e);
      }
    }

    /** Ayuda del plugin (protocolo API-IDEE). */
    getHelp() {
      const IDEE = api();
      return {
        title: 'Catálogo de servicios y capas',
        content: new Promise((resolve) => {
          let html =
            '<div>' +
            '<p>Catálogo de servicios y capas para cargar en el visualizador.</p>' +
            '<p><strong>Catálogos</strong>: elige un tipo de catálogo y ' +
            'gestiónalo en la sección que sale debajo. El catálogo de la IDEE se ' +
            'pide por secciones (WMS estatal, WMS autonómico, WMS local, planos ' +
            'verticales, WMTS, XYZ, MVT, WFS, WCS y OGC API) al portal de la IDEE, ' +
            'y se filtra por servicio u organismo. Pulsa <strong>Cargar</strong> ' +
            'en el servicio que quieras.</p>' +
            '<p><strong>Añadir capa</strong>: pega la URL de un servicio o de un ' +
            'archivo publicado por http/https y pulsa <strong>Analizar</strong>. El ' +
            'plugin deduce el tipo de capa, lee las capas que ofrece el servicio y ' +
            'deja elegir cuáles cargar y con qué nombre.</p>' +
            '</div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            try { html = IDEE.utils.stringToHtml(html); } catch (e) { /* string plano */ }
          }
          resolve(html);
        }),
      };
    }

    // =====================================================================
    //  Ciclo de vida
    // =====================================================================
    addTo(map) {
      this._map = map;
      const IDEE = api();

      if (!IDEE || !IDEE.ui || !IDEE.Control) {
        console.error(this.name + ': No se encontró el objeto global de la API (IDEE/M).');
        return;
      }

      const pos = (IDEE.ui.position && IDEE.ui.position[this.position])
        ? IDEE.ui.position[this.position]
        : (IDEE.ui.position ? IDEE.ui.position.TL : 'TL');

      const panel = new IDEE.ui.Panel('tools_catalogo', {
        collapsible: this.collapsible,
        className: 'g-herramienta_catalogo',
        collapsedButtonClass: 'm-tools',
        position: pos,
        order: this.order,
      });
      this._panel = panel;

      const control = new IDEE.Control(new IDEE.impl.Control(), 'control_catalogo');
      this._control = control;

      // OBLIGATORIO para que destroy() funciona: la API usa equals() para
      // distinguir controles al retirarlos del panel y del mapa.
      if (typeof control.equals !== 'function') {
        control.equals = function (c) { return c === control; };
      }

      control.createView = () => this._construirUI();

      panel.addControls(control);
      map.addPanels(panel);

      // La barra de título se puede arrastrar, igual que en baseLayer.
      try {
        if (IDEE.utils && typeof IDEE.utils.draggabillyPlugin === 'function') {
          IDEE.utils.draggabillyPlugin(panel, '#m-herramienta-title-catalogo');
        }
      } catch (e) {
        console.warn(this.name + ': no se pudo hacer arrastrable la barra de título.', e);
      }

      this._aplicarIcono(this._elementoPanel(panel));
      // No se refresca la lista aquí: la vista del control todavía no existe.
    }

    /**
     * Elemento DOM de un panel. La API no expone getElement() en el Panel (sí en
     * los controles), así que se cae a la propiedad interna _element.
     * @param {Object} panel
     * @returns {HTMLElement|null}
     */
    _elementoPanel(panel) {
      if (!panel) return null;
      if (typeof panel.getElement === 'function') {
        const el = panel.getElement();
        if (el) return el;
      }
      return panel._element || null;
    }

    /** Construye la interfaz del plugin dentro del control. */
    /** Construye la interfaz del plugin dentro del control. */
    _construirUI() {
      const self = this;

      // Contenedor con las clases del framework, igual que plantilla_plugin y
      // baseLayer: .m-control.m-container.m-herramienta, y dentro la CABECERA
      // .m-herramienta-header (la barra de título, arrastrable con
      // IDEE.utils.draggabillyPlugin) y el CONTENIDO .m-herramienta-contents.
      const container = document.createElement('div');
      container.setAttribute('aria-label', this.title);
      container.setAttribute('role', 'region');
      container.className = 'm-control m-container m-herramienta catalogo' + (this._esTR ? ' catalogo--tr' : '');

      const header = document.createElement('header');
      header.setAttribute('role', 'heading');
      header.setAttribute('aria-level', '3');
      header.setAttribute('tabindex', '0');
      header.id = 'm-herramienta-title-catalogo';
      header.className = 'm-herramienta-header';
      const titulo = document.createElement('span');
      titulo.textContent = this.title;
      header.appendChild(titulo);
      container.appendChild(header);

      const contents = document.createElement('div');
      contents.className = 'm-herramienta-contents catalogo__contenido';
      container.appendChild(contents);

      // --- Pestañas: "Gestión de catálogos" y "Añadir nueva capa" -------
      const tabs = document.createElement('div');
      tabs.className = 'catalogo__pestanas';
      tabs.setAttribute('role', 'tablist');
      this._pestanas = {};
      [
        { id: 'catalogos', nombre: 'Catálogos' },
        { id: 'capa', nombre: 'Añadir capa' }
      ].forEach(function (p) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'catalogo__pestana';
        b.id = 'catalogo-pestana-' + p.id;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', 'false');
        b.textContent = p.nombre;
        b.addEventListener('click', function () { self._verPestana(p.id); });
        self._pestanas[p.id] = b;
        tabs.appendChild(b);
      });
      contents.appendChild(tabs);

      // --- Pestaña 1: selector de catálogo + su sección de gestión --------
      // El selector arriba y, DEBAJO, la sección donde se gestiona el
      // catálogo elegido: el acordeón de secciones (IDEE) o la lista fija.
      const panelCatalogos = document.createElement('div');
      panelCatalogos.className = 'catalogo__panel';
      panelCatalogos.setAttribute('role', 'tabpanel');
      panelCatalogos.setAttribute('data-panel', 'catalogos');

      // La pestaña son dos secciones plegables: los catálogos disponibles (con
      // el selector y su contenido) y el alta de un catálogo nuevo. Las dos
      // usan el mismo acordeón que las secciones de tipo de servicio.
      const grupoDisponibles = this._crearAcordeon('Catálogos disponibles', 'disponibles');
      const grupoNuevo = this._crearAcordeon('Añadir un catálogo nuevo', 'nuevo');
      panelCatalogos.appendChild(grupoDisponibles.caja);
      panelCatalogos.appendChild(grupoNuevo.caja);

      const selector = document.createElement('select');
      selector.className = 'catalogo__selector';
      selector.setAttribute('aria-label', 'Tipo de catálogo');
      // Primero los de serie y después los que ha dado de alta el usuario, que
      // se marcan para que se distinguan de un vistazo.
      const opcionesCatalogo = Object.keys(self._catalogos).map(function (id) {
        return { id: id, nombre: self._catalogos[id].nombre, propio: false };
      });
      (window.CatalogoRegistro ? window.CatalogoRegistro.todos() : []).forEach(function (c) {
        opcionesCatalogo.push({ id: c.id, nombre: c.nombre, propio: true });
      });
      opcionesCatalogo.forEach(function (op) {
        const el = document.createElement('option');
        el.value = op.id;
        el.textContent = op.propio ? (op.nombre + ' (tuyo)') : op.nombre;
        if (op.id === self._tipoSeleccionado) el.selected = true;
        selector.appendChild(el);
      });
      selector.addEventListener('change', function () {
        self._tipoSeleccionado = this.value;
        // Se recuerda para que al volver al visualizador siga por este.
        guardarSeleccion(self._tipoSeleccionado);
        self._pintarCatalogo();
      });
      // El selector va con etiqueta, igual que el de "Tipo de servicio" que se
      // añade más abajo: si no, el primero de los dos se queda sin nombre y no
      // hay forma de saber de qué es el desplegable de arriba.
      const cajaSelector = document.createElement('div');
      cajaSelector.className = 'catalogo__campo';
      const etiquetaSelector = document.createElement('label');
      etiquetaSelector.className = 'catalogo__campo-etiqueta';
      etiquetaSelector.textContent = 'Catálogo';
      etiquetaSelector.setAttribute('for', 'catalogo-tipo');
      selector.id = 'catalogo-tipo';
      cajaSelector.appendChild(etiquetaSelector);
      cajaSelector.appendChild(selector);
      grupoDisponibles.cuerpo.appendChild(cajaSelector);

      const gestor = document.createElement('div');
      gestor.className = 'catalogo__gestor';
      grupoDisponibles.cuerpo.appendChild(gestor);
      this._gestorEl = gestor;

      // El alta va dentro de la segunda sección.
      this._construirAlta(grupoNuevo.cuerpo);

      contents.appendChild(panelCatalogos);
      this._panelCatalogos = panelCatalogos;
      this._selectorEl = selector;

      // --- Pestaña 2: URL + opciones de carga ----------------------------
      const panelCapa = document.createElement('div');
      panelCapa.className = 'catalogo__panel';
      panelCapa.setAttribute('role', 'tabpanel');
      panelCapa.setAttribute('data-panel', 'capa');

      const cajaUrl = document.createElement('div');
      cajaUrl.className = 'catalogo__url';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'catalogo__url-input';
      input.placeholder = 'https://servicio/wms?request=GetCapabilities';
      input.value = this._urlIntroducida;
      input.setAttribute('aria-label', 'URL del servicio o archivo');
      input.addEventListener('input', function () { self._urlIntroducida = this.value; });
      // Intro en el campo = analizar, que es lo que se espera de un campo de
      // texto y no del botón.
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); self._analizarUrl(); }
      });
      cajaUrl.appendChild(input);
      this._urlInputEl = input;

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__url-boton';
      boton.textContent = 'Analizar';
      boton.addEventListener('click', function () { self._analizarUrl(); });
      cajaUrl.appendChild(boton);

      panelCapa.appendChild(cajaUrl);

      // Debajo del campo, y solo cuando ya hay algo que decidir, las opciones
      // de carga: tipo, capas y nombre.
      const opciones = document.createElement('div');
      opciones.className = 'catalogo__gestor';
      panelCapa.appendChild(opciones);
      this._opcionesEl = opciones;

      contents.appendChild(panelCapa);
      this._panelCapa = panelCapa;

      // --- Cuadro de estado (éxitos, avisos y errores) --------------------
      const estado = document.createElement('div');
      estado.className = 'catalogo__estado';
      estado.setAttribute('role', 'status');
      contents.appendChild(estado);
      this._estadoEl = estado;

      // Ni la lista ni las opciones se pintan en addTo: addTo se llama antes
      // de que la API construya la vista del control, así que los contenedores
      // aún serían null.
      this._verPestana(this._pestanaActiva);
      this._pintarCatalogo();
      if (this._analisis) this._pintarOpciones();

      return container;
    }

    /**
     * Muestra una pestaña (botón y panel). Un solo método para que el marcado
     * del botón y la visibilidad del panel no puedan desincronizarse.
     * @param {("catalogos"|"capa")} id
     */
    _verPestana(id) {
      this._pestanaActiva = id;
      Object.keys(this._pestanas).forEach(function (k) {
        const activo = (k === id);
        this._pestanas[k].classList.toggle('catalogo__pestana--activa', activo);
        this._pestanas[k].setAttribute('aria-selected', String(activo));
      }, this);
      if (this._panelCatalogos) this._panelCatalogos.hidden = (id !== 'catalogos');
      if (this._panelCapa) this._panelCapa.hidden = (id !== 'capa');
    }

    // =====================================================================
    //  Pestaña 1: gestión del catálogo
    // =====================================================================

    /**
     * Pinta la sección de gestión del catálogo activo. Debajo del selector,
     * como se pidió: el acordeón de secciones, la lista de un catálogo propio,
     * o la lista corta, según el tipo.
     */
    _pintarCatalogo() {
      const cont = this._gestorEl;
      if (!cont) return;
      cont.innerHTML = '';

      const tipo = this._catalogoActual();
      if (!tipo) return;

      const desc = document.createElement('p');
      desc.className = 'catalogo__descripcion';
      desc.textContent = tipo.descripcion || '';
      cont.appendChild(desc);

      if (tipo.modo === 'secciones') {
        this._pintarSecciones(cont, tipo);
      } else if (tipo.modo === 'arbol') {
        this._pintarArbol(cont, tipo);
      } else if (tipo.seConsulta || tipo.esPropio) {
        this._pintarCatalogoRemoto(cont, tipo);
      } else {
        this._pintarLista(cont, tipo.listar() || []);
      }
    }

    // =====================================================================
    //  Árbol de catálogos (los que declara el visualizador)
    // =====================================================================
    // Un nodo puede llevar servicios y subnodos, y los subnodos son nodos
    // igual, así que la profundidad es libre. Cada nodo es un desplegable con
    // el MISMO acordeón que las secciones de tipo de servicio, así que un
    // nodo dentro de otro no desincroniza el chevron de su padre (el CSS usa
    // el combinador de hijo directo).

    /** Pinta el árbol de nodos del catálogo activo. */
    _pintarArbol(cont, tipo) {
      const nodos = tipo.listar() || [];

      // El mismo buscador de las secciones: aquí filtra por nombre de nodo, de
      // servicio y de URL, y esconde los nodos que se quedan sin nada.
      this._pintarBuscador(cont);

      const caja = document.createElement('div');
      caja.className = 'catalogo__arbol';
      cont.appendChild(caja);
      // Se guarda para poder rehacerlo al filtrar sin tocar el buscador.
      this._arbolEl = caja;

      if (!nodos.length) {
        this._pintarAviso(caja, 'El catálogo no declara ningún nodo.');
        return;
      }

      caja.appendChild(this._construirArbol(nodos));
    }

    /** Construye el árbol de nodos con el filtro puesto. */
    _construirArbol(nodos) {
      const fragmento = document.createDocumentFragment();
      nodos.forEach(function (nodo) {
        fragmento.appendChild(this._crearNodoArbol(nodo, 0));
      }, this);
      return fragmento;
    }

    /** Rehace SOLO el árbol, sin tocar el buscador (para no perder el foco). */
    _repintarArbol() {
      const caja = this._arbolEl;
      if (!caja) return;
      const tipo = this._catalogoActual();
      const nodos = (tipo && typeof tipo.listar === 'function') ? tipo.listar() : [];
      caja.innerHTML = '';
      if (!nodos.length) {
        this._pintarAviso(caja, 'El catálogo no declara ningún nodo.');
        this._pintarCuentaBuscador(0, 0);
        return;
      }
      caja.appendChild(this._construirArbol(nodos));
      // Mismo recuento que en las listas: las filas que han quedado a la vista
      // después de filtrar.
      const filas = caja.querySelectorAll('.catalogo__item');
      let visibles = 0;
      for (let i = 0; i < filas.length; i += 1) if (!filas[i].hidden) visibles += 1;
      this._pintarCuentaBuscador(visibles, filas.length);
    }

    /**
     * Crea el desplegable de un nodo y, recursivamente, los de sus hijos.
     *
     * Con el filtro puesto, un nodo se ve si coincide por su nombre, si tiene
     * algún servicio que coincida, o si queda algún hijo visible; y se abre
     * solo, que si no habría que desplegar a mano para ver el resultado.
     *
     * @param {Object} nodo Nodo normalizado (servicios, nodos y total).
     * @param {number} nivel Profundidad, para la sangría.
     * @returns {HTMLElement} La caja del nodo, ya con su visibilidad decidida.
     */
    _crearNodoArbol(nodo, nivel) {
      const filtro = (this._filtro || '').trim().toLowerCase();
      const contiene = function (texto) {
        return String(texto || '').toLowerCase().indexOf(filtro) > -1;
      };

      const caja = document.createElement('div');
      caja.className = 'catalogo__seccion catalogo__nodo collapsed';
      caja.style.setProperty('--cat-nivel', String(nivel));

      const cabecera = document.createElement('div');
      cabecera.className = 'catalogo__seccion-cabecera';
      cabecera.setAttribute('role', 'button');
      cabecera.setAttribute('tabindex', '0');
      cabecera.setAttribute('aria-expanded', 'false');

      const chevron = document.createElement('span');
      chevron.className = 'catalogo__seccion-chevron';
      chevron.setAttribute('aria-hidden', 'true');

      const nombre = document.createElement('span');
      nombre.className = 'catalogo__seccion-nombre';
      nombre.textContent = nodo.nombre;

      const cuenta = document.createElement('span');
      cuenta.className = 'catalogo__seccion-cuenta';
      cuenta.textContent = nodo.total + (nodo.total === 1 ? ' servicio' : ' servicios');

      cabecera.appendChild(chevron);
      cabecera.appendChild(nombre);
      cabecera.appendChild(cuenta);
      caja.appendChild(cabecera);

      const cuerpo = document.createElement('div');
      cuerpo.className = 'catalogo__seccion-cuerpo catalogo__nodo-cuerpo';
      caja.appendChild(cuerpo);

      // Los servicios del propio nodo.
      let serviciosVisibles = 0;
      (nodo.servicios || []).forEach(function (srv) {
        const fila = this._filaServicio(srv, { tipo: srv.tipo });
        const coincide = coincideServicio(srv, nodo.nombre, filtro);
        if (!coincide) fila.hidden = true; else serviciosVisibles += 1;
        cuerpo.appendChild(fila);
      }, this);

      // Y sus subnodos, recursivamente: se construyen antes de decidir si este
      // nodo se ve, porque puede que se vea solo por lo que haya dentro.
      const hijos = (nodo.nodos || []).map(function (hijo) {
        return this._crearNodoArbol(hijo, nivel + 1);
      }, this);
      hijos.forEach(function (h) { cuerpo.appendChild(h); });

      const alternar = function () {
        const abierta = caja.classList.contains('collapsed');
        caja.classList.toggle('collapsed', !abierta);
        cabecera.setAttribute('aria-expanded', String(abierta));
      };
      cabecera.addEventListener('click', alternar);
      cabecera.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          alternar();
        }
      });

      if (filtro) {
        const hijoVisible = hijos.some(function (h) { return !h.hidden; });
        const visible = contiene(nodo.nombre) || serviciosVisibles > 0 || hijoVisible;
        caja.hidden = !visible;
        if (visible) {
          caja.classList.remove('collapsed');
          cabecera.setAttribute('aria-expanded', 'true');
        }
      }

      return caja;
    }

    /**
     * El catálogo activo, tanto si es de serie como si lo ha dado de alta el
     * usuario. Todos los usos de CATALOGOS[...] pasan por aquí, porque un
     * catálogo del usuario no está en CATALOGOS.
     * @returns {Object|null}
     */
    _catalogoActual() {
      const registro = window.CatalogoRegistro;
      const propio = registro ? registro.porId(this._tipoSeleccionado) : null;
      if (propio) {
        const self = this;
        return {
          id: propio.id,
          nombre: propio.nombre,
          modo: 'lista',
          esPropio: true,
          seConsulta: true,
          tipoLectura: propio.tipo,
          url: propio.url,
          descripcion: 'Catálogo añadido por ti: ' + propio.url,
          cargarUrl: function (url, mapa, opciones) { return cargarUrlGenerica(url, mapa, opciones); },
          listar: function () { return self._entradasPropias[propio.id] || []; }
        };
      }
      return this._catalogos[this._tipoSeleccionado] || null;
    }

    /**
     * Pinta las entradas de un catálogo que se consulta por URL (STAC, OGC API
     * Records o uno dado de alta). Se piden al seleccionarlo y se cachean, como
     * las secciones de la IDEE.
     */
    _pintarCatalogoRemoto(cont, tipo) {
      const self = this;
      // El mismo buscador: las entradas de estos catálogos también se filtran.
      this._pintarBuscador(cont);
      const cache = this._entradasPropias[tipo.id] || (this._entradasPropias[tipo.id] = {});

      if (cache.datos) {
        this._pintarLista(cont, cache.datos);
        return;
      }
      if (cache.promesa) return;   // ya se está pidiendo

      this._pintarAviso(cont, 'Consultando «' + tipo.nombre + '»…');

      cache.promesa = window.CatalogoRegistro.leer(tipo.tipoLectura, tipo.url).then(function (entradas) {
        cache.datos = entradas;
        cache.promesa = null;
        // Si mientras tanto el usuario ha cambiado de catálogo, este nodo ya no
        // está en la página y no hay que pintar nada.
        if (!document.contains(cont)) return;
        self._pintarLista(cont, entradas);
        // Si mientras tanto se ha escrito algo en el buscador, el filtro se
        // aplicó sobre una lista vacía y hay que repetirlo ahora que ya están
        // las entradas: si no, se queda en 0 para siempre.
        if ((self._filtro || '').trim()) self._repintarLista();
        self._decir('«' + tipo.nombre + '»: ' + entradas.length + ' entrada(s).');
      }).catch(function (err) {
        cache.promesa = null;
        if (!document.contains(cont)) return;
        // Se limpia solo la lista: cargarse el gestor entero se llevaba el
        // buscador por delante.
        if (self._listaEl) self._listaEl.innerHTML = '';
        self._pintarAviso(cont,
          'No se ha podido consultar el catálogo: ' + (err && err.message ? err.message : err), 'error');
      });
    }

    /**
     * Crea una sección plegable, con el mismo acordeón que las secciones de
     * tipo de servicio (patrón de vueloFotogrametrico): cabecera con
     * role=button y cuerpo que se anima con alto y opacidad.
     *
     * @param {string} titulo Texto de la cabecera.
     * @param {string} id Identificador del grupo, para el estado.
     * @returns {{caja: HTMLElement, cuerpo: HTMLElement, alternar: Function}}
     */
    _crearAcordeon(titulo, id) {
      const self = this;

      const caja = document.createElement('div');
      caja.className = 'catalogo__seccion catalogo__seccion--grupo';
      caja.dataset.grupo = id;

      const cabecera = document.createElement('div');
      cabecera.className = 'catalogo__seccion-cabecera';
      cabecera.setAttribute('role', 'button');
      cabecera.setAttribute('tabindex', '0');
      cabecera.setAttribute('aria-expanded', 'false');

      const chevron = document.createElement('span');
      chevron.className = 'catalogo__seccion-chevron';
      chevron.setAttribute('aria-hidden', 'true');

      const nombre = document.createElement('span');
      nombre.className = 'catalogo__seccion-nombre';
      nombre.textContent = titulo;

      cabecera.appendChild(chevron);
      cabecera.appendChild(nombre);
      caja.appendChild(cabecera);

      const cuerpo = document.createElement('div');
      cuerpo.className = 'catalogo__seccion-cuerpo catalogo__seccion-cuerpo--grupo';
      caja.appendChild(cuerpo);

      const alternar = function () {
        const abierta = caja.classList.contains('collapsed');
        caja.classList.toggle('collapsed', !abierta);
        cabecera.setAttribute('aria-expanded', String(abierta));
        const pos = self._gruposAbiertos.indexOf(id);
        if (abierta && pos === -1) self._gruposAbiertos.push(id);
        if (!abierta && pos > -1) self._gruposAbiertos.splice(pos, 1);
      };
      this._gruposDom[id] = { caja: caja, cabecera: cabecera, alternar: alternar };

      cabecera.addEventListener('click', alternar);
      cabecera.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          alternar();
        }
      });

      // Los dos grupos de la pestaña arrancan abiertos: el catálogo es lo
      // principal y el alta tiene que verse para que se sepa que existe.
      if (this._gruposAbiertos.indexOf(id) === -1) this._gruposAbiertos.push(id);
      caja.classList.remove('collapsed');
      cabecera.setAttribute('aria-expanded', 'true');

      return { caja: caja, cuerpo: cuerpo, alternar: alternar };
    }

    /**
     * Pliega o despliega un grupo de la pestaña de catálogos.
     * @param {string} id
     */
    _alternarGrupo(id) {
      const grupo = this._gruposDom[id];
      if (grupo) grupo.alternar();
    }

    // =====================================================================
    //  Alta de catálogos nuevos
    // =====================================================================

    /**
     * Construye la sección de alta de catálogos, que va al final de la
     * pestaña: nombre, tipo, URL y la lista de los ya dados de alta.
     * @param {HTMLElement} padre
     */
    _construirAlta(padre) {
      const self = this;
      const registro = window.CatalogoRegistro;

      const caja = document.createElement('div');
      caja.className = 'catalogo__nuevo';

      // Sin título propio: la cabecera del acordeón "Añadir un catálogo nuevo"
      // ya lo pone (estaría duplicado).

      if (!registro) {
        this._pintarAviso(caja, 'No está cargado catalogo_registro.js.', 'error');
        padre.appendChild(caja);
        return;
      }

      const nombre = document.createElement('input');
      nombre.type = 'text';
      nombre.className = 'catalogo__campo-control';
      nombre.placeholder = 'Nombre del catálogo';
      nombre.setAttribute('aria-label', 'Nombre del catálogo nuevo');

      const tipo = document.createElement('select');
      tipo.className = 'catalogo__campo-control';
      tipo.setAttribute('aria-label', 'Tipo de catálogo nuevo');
      Object.keys(registro.TIPOS).forEach(function (k) {
        const op = document.createElement('option');
        op.value = k;
        op.textContent = registro.TIPOS[k];
        tipo.appendChild(op);
      });

      const url = document.createElement('input');
      url.type = 'text';
      url.className = 'catalogo__campo-control';
      url.placeholder = 'https://servidor/catalogo';
      url.setAttribute('aria-label', 'URL del catálogo nuevo');

      const boton = document.createElement('button');
      boton.type = 'button';
      // Clase propia, y no .catalogo__cargar como el de la pestaña de capas:
      // son dos botones distintos (este da de alta un catálogo nuevo, el otro
      // mete capas en el mapa) y compartir clase hacía que un
      // querySelector('.catalogo__cargar') cogiera el equivocado.
      boton.className = 'catalogo__nuevo-boton';
      boton.textContent = 'Añadir al catálogo';
      boton.addEventListener('click', function () {
        let creado;
        try {
          creado = registro.alta({ nombre: nombre.value, tipo: tipo.value, url: url.value });
        } catch (e) {
          self._decir(e && e.message ? e.message : String(e), 'aviso');
          return;
        }
        nombre.value = '';
        url.value = '';
        self._decir('Catálogo añadido: ' + creado.nombre);
        // El tipo seleccionado se cambia ANTES de refrescar el selector: al
        // repintarlo se marca la opción elegida, y si se hace al revés el
        // desplegable se queda mostrando el catálogo anterior.
        self._tipoSeleccionado = creado.id;
        self._refrescarSelector();
        self._pintarNuevos();
        self._pintarCatalogo();
        // El catálogo recién creado pasa a ser el elegido y se recuerda.
        guardarSeleccion(creado.id);
      });

      [['Nombre', nombre], ['Tipo', tipo], ['URL del catálogo', url]].forEach(function (campo) {
        const etiqueta = document.createElement('label');
        etiqueta.className = 'catalogo__campo';
        const texto = document.createElement('span');
        texto.className = 'catalogo__campo-etiqueta';
        texto.textContent = campo[0];
        etiqueta.appendChild(texto);
        etiqueta.appendChild(campo[1]);
        caja.appendChild(etiqueta);
      });

      const pie = document.createElement('div');
      pie.className = 'catalogo__nuevo-pie';
      pie.appendChild(boton);
      caja.appendChild(pie);

      const lista = document.createElement('div');
      lista.className = 'catalogo__nuevos';
      caja.appendChild(lista);
      this._nuevosEl = lista;

      padre.appendChild(caja);
      this._pintarNuevos();
    }

    /** Vuelve a pintar la lista de catálogos dados de alta. */
    _pintarNuevos() {
      const self = this;
      const lista = this._nuevosEl;
      const registro = window.CatalogoRegistro;
      if (!lista || !registro) return;

      lista.innerHTML = '';
      const dados = registro.todos();

      if (!dados.length) {
        const aviso = document.createElement('p');
        aviso.className = 'catalogo__aviso';
        aviso.textContent = 'Todavía no has añadido ningún catálogo.';
        lista.appendChild(aviso);
        return;
      }

      dados.forEach(function (c) {
        const fila = document.createElement('div');
        fila.className = 'catalogo__nuevo-item';

        const textos = document.createElement('div');
        textos.className = 'catalogo__item-texto';
        const nom = document.createElement('span');
        nom.className = 'catalogo__item-nombre';
        nom.textContent = c.nombre;
        nom.title = c.nombre;
        const dir = document.createElement('span');
        dir.className = 'catalogo__item-url';
        dir.textContent = registro.TIPOS[c.tipo] + ' · ' + c.url;
        dir.title = c.url;
        textos.appendChild(nom);
        textos.appendChild(dir);
        fila.appendChild(textos);

        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'catalogo__quitar';
        quitar.textContent = 'Quitar';
        quitar.setAttribute('aria-label', 'Quitar el catálogo ' + c.nombre);
        quitar.addEventListener('click', function () {
          registro.baja(c.id);
          delete self._entradasPropias[c.id];
          if (self._tipoSeleccionado === c.id) self._tipoSeleccionado = 'idee';
          self._decir('Catálogo quitado: ' + c.nombre);
          self._refrescarSelector();
          self._pintarNuevos();
          self._pintarCatalogo();
        });
        fila.appendChild(quitar);

        lista.appendChild(fila);
      });
    }

    /** Vuelve a pintar el <select> de catálogos (tras un alta o una baja). */
    _refrescarSelector() {
      const selector = this._selectorEl;
      const registro = window.CatalogoRegistro;
      if (!selector || !registro) return;

      const elegido = this._tipoSeleccionado;
      selector.innerHTML = '';

      const opciones = Object.keys(this._catalogos).map(function (id) {
        return { id: id, nombre: this._catalogos[id].nombre, propio: false };
      }, this);
      registro.todos().forEach(function (c) {
        opciones.push({ id: c.id, nombre: c.nombre, propio: true });
      });

      opciones.forEach(function (op) {
        const el = document.createElement('option');
        el.value = op.id;
        el.textContent = op.propio ? (op.nombre + ' (tuyo)') : op.nombre;
        if (op.id === elegido) el.selected = true;
        selector.appendChild(el);
      });
      selector.value = elegido;
    }

    /**
     * Selector de tipo de servicio y la sección elegida.
     *
     *  El catálogo de la IDEE viene partido en diez secciones (WMS estatal,
     *  WMTS, WFS...), cada una con su tabla de servicios. Antes se pintaban las
     *  diez en un acordeón y se pedía cada una al desplegarla; ahora hay un
     *  SEGUNDO desplegable, debajo del de catálogo, y solo se pide y se pinta la
     *  que está elegida.
     *
     *  El motivo es la memoria del cliente: la sección de WMS estatal del IGN
     *  tiene más de setecientos servicios, y recorrer las diez secciones
     *  dejando todas las que ya se han pedido acaba con el catálogo entero
     *  resident en memoria. Al cambiar de sección se sueltan las demás, en este
     *  plugin y en la caché de CatalogoIDEE.
     *
     * @param {HTMLElement} cont
     * @param {Object} tipo Catálogo en modo 'secciones'.
     */
    _pintarSecciones(cont, tipo) {
      const self = this;
      const secciones = tipo.listar() || [];

      if (!secciones.length) {
        this._pintarAviso(cont, 'No se ha podido cargar el catálogo de la IDEE.');
        return;
      }

      // --- El segundo selector ------------------------------------------
      const cajaSelector = document.createElement('div');
      cajaSelector.className = 'catalogo__campo';

      const etiqueta = document.createElement('label');
      etiqueta.className = 'catalogo__campo-etiqueta';
      etiqueta.textContent = 'Tipo de servicio';
      etiqueta.setAttribute('for', 'catalogo-seccion');

      const selector = document.createElement('select');
      selector.id = 'catalogo-seccion';
      selector.className = 'catalogo__selector catalogo__selector--seccion';
      selector.setAttribute('aria-label', 'Tipo de servicio del catálogo');
      secciones.forEach(function (sec) {
        const op = document.createElement('option');
        op.value = sec.id;
        op.textContent = sec.corto || sec.nombre || sec.id;
        op.title = sec.nombre || sec.id;
        selector.appendChild(op);
      });

      // La sección elegida: la que se dejó en localStorage si sigue existiendo,
      // y si no la primera.
      let activa = this._seccionActiva;
      if (!activa || !secciones.some(function (s) { return s.id === activa; })) {
        activa = secciones[0].id;
      }
      this._seccionActiva = activa;
      selector.value = activa;

      selector.addEventListener('change', function () {
        self._seccionActiva = this.value;
        guardarSeccion(this.value);
        // El "verlas todas" y la página eran de la sección anterior: al cambiar
        // de tipo de servicio se vuelve a la primera página, paginada.
        self._verTodos = false;
        self._pagina = 1;
        self._liberarSecciones(this.value);
        self._cargarSeccionActiva();
      });

      cajaSelector.appendChild(etiqueta);
      cajaSelector.appendChild(selector);
      cont.appendChild(cajaSelector);
      this._selectorSeccionEl = selector;

      // El buscador, que ahora filtra DENTRO de la sección elegida.
      this._pintarBuscador(cont);

      // --- El cuerpo de la sección elegida -------------------------------
      const cuerpo = document.createElement('div');
      cuerpo.className = 'catalogo__secciones catalogo__secciones--activa';
      cont.appendChild(cuerpo);
      this._seccionesEl = cuerpo;

      // Un contador de la sección, que se actualiza al pedirla.
      const cuenta = document.createElement('span');
      cuenta.className = 'catalogo__cuenta-seccion';
      cuenta.hidden = true;
      this._cuentaSeccionEl = cuenta;

      this._cargarSeccionActiva();
    }

    /**
     * Suelta de memoria las secciones que no son la activa.
     *
     *  Se vacían los datos ya pedidos de este plugin y la caché de
     *  CatalogoIDEE (que guarda el JSON ya parseado, que es lo que pesa). La
     *  activa se queda, así que volver a ella no vuelve a pedir nada.
     *
     * @param {string} [mantenerId] Sección que se deja.
     */
    _liberarSecciones(mantenerId) {
      Object.keys(this._estadoSecciones).forEach(function (id) {
        if (id === mantenerId) return;
        delete this._estadoSecciones[id];
      }, this);
      // La caché de CatalogoIDEE guarda el JSON ya parseado, que es lo que de
      // verdad pesa, así que también se suelta. Si no está cargado, no pasa nada.
      if (window.CatalogoIDEE && typeof window.CatalogoIDEE.limpiarCache === 'function') {
        window.CatalogoIDEE.limpiarCache(null, mantenerId);
      }
    }

    /**
     * Pide y pinta la sección activa.
     *
     *  @returns {Promise<Object|null>} Los datos de la sección, o null si falló.
     */
    _cargarSeccionActiva() {
      const self = this;
      const cont = this._seccionesEl;
      if (!cont) return Promise.resolve(null);

      const tipo = this._catalogoActual();
      const secciones = (tipo && tipo.listar()) || [];
      const sec = secciones.find(function (s) { return s.id === self._seccionActiva; });
      if (!sec) {
        cont.innerHTML = '';
        this._pintarAviso(cont, 'No hay ninguna sección seleccionada.');
        return Promise.resolve(null);
      }

      const cuenta = this._cuentaSeccionEl || document.createElement('span');
      return this._cargarSeccion(sec, cont, cuenta, (this._filtro || '').trim() || undefined);
    }

    /**
     * Aplica el filtro de texto a la sección activa, que es la única pintada.
     */
    _filtrarSecciones() {
      const cont = this._seccionesEl;
      const st = this._estadoSecciones[this._seccionActiva];
      if (!cont) return;
      if (st && st.datos) {
        this._pintarSeccion(st.datos, cont, (this._filtro || '').trim());
      } else {
        this._cargarSeccionActiva();
      }
    }

    /**
     * Pinta el buscador, que es el mismo para las secciones de tipo de servicio
     * y para el árbol de nodos: filtra por lo que haya escrito la persona.
     * @param {HTMLElement} cont
     */
    _pintarBuscador(cont) {
      const self = this;
      // Idempotente: _pintarLista y _pintarCatalogoRemoto pueden llamarlo los
      // dos, y dos buscadores es uno de más (medido: el gestor se quedaba con
      // dos).
      const previo = cont.querySelector('.catalogo__buscador');
      if (previo) {
        const input = previo.querySelector('.catalogo__buscador-input');
        if (input && input.value !== (this._filtro || '')) input.value = this._filtro || '';
        // Aunque se reutilice el buscador hay que volver a apuntar al recuento
        // de ESTE: el anterior puede quedar en un catálogo que ya no está.
        this._buscadorEl = input;
        this._cuentaBuscadorEl = previo.querySelector('.catalogo__buscador-cuenta');
        return;
      }
      const buscador = document.createElement('div');
      buscador.className = 'catalogo__buscador';

      // La lupa es un elemento de apoyo, no un botón: no se pulsa, solo dice de
      // qué va el campo. Va dentro de una caja para que el input pueda dejarse
      // sitio con padding en vez de con position:relative sobre el buscador
      // entero.
      const caja = document.createElement('div');
      caja.className = 'catalogo__buscador-caja';

      const lupa = document.createElement('span');
      lupa.className = 'catalogo__buscador-lupa';
      lupa.setAttribute('aria-hidden', 'true');

      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'catalogo__buscador-input';
      input.placeholder = 'Filtrar por servicio u organismo…';
      input.value = this._filtro || '';
      input.setAttribute('aria-label', 'Filtrar servicios del catálogo');
      input.addEventListener('input', function () {
        self._filtro = this.value;
        // Cada cambio de filtro vuelve a la primera página: los resultados son
        // otros y quedarse en la página 7 de la lista anterior no lleva a nada.
        self._pagina = 1;
        self._verTodos = false;
        // Se filtra sobre lo ya pintado, sin reconstruir el panel: reconstruirlo
        // destruía el input y se perdía el foco en cada pulsación.
        self._filtrar();
      });

      // El recuento: sin él no hay manera de distinguir "el filtro no ha
      // servido" de "no hay coincidencias" cuando se filtran miles de servicios.
      const cuenta = document.createElement('span');
      cuenta.className = 'catalogo__buscador-cuenta';
      cuenta.hidden = true;

      caja.appendChild(lupa);
      caja.appendChild(input);
      buscador.appendChild(caja);
      buscador.appendChild(cuenta);
      cont.appendChild(buscador);
      this._buscadorEl = input;
      this._cuentaBuscadorEl = cuenta;
    }

    /**
     * Escribe el recuento de resultados junto al buscador.
     *
     *  Solo aparece cuando hay texto de filtro, o cuando la lista ya está
     *  pintada y hay algo que contar; en reposo estorba.
     *
     * @param {number} [visibles] Cuántos hay ahora mismo a la vista.
     * @param {number} [total] Cuántos hay en total.
     */
    _pintarCuentaBuscador(visibles, total) {
      const cuenta = this._cuentaBuscadorEl;
      if (!cuenta || !cuenta.parentNode) return;
      if (visibles === undefined) {
        cuenta.hidden = true;
        cuenta.textContent = '';
        return;
      }
      if (visibles === total) {
        cuenta.textContent = total + (total === 1 ? ' servicio' : ' servicios');
      } else {
        cuenta.textContent = visibles + ' / ' + total;
      }
      cuenta.hidden = false;
    }

    /**
     * Pide una sección al catálogo y la pinta en su <details>.
     * @param {Object} sec Sección de CatalogoIDEE.SECCIONES.
     * @param {HTMLElement} cuerpo Donde se pinta.
     * @param {HTMLElement} cuenta Contador de la cabecera.
     * @param {string} [filtro] Filtro a aplicar al pintarla.
     * @returns {Promise<Object|null>}
     */
    _cargarSeccion(sec, cuerpo, cuenta, filtro) {
      const self = this;
      const st = this._estadoSecciones[sec.id] || (this._estadoSecciones[sec.id] = {});

      if (st.datos) {
        this._pintarSeccion(st.datos, cuerpo, filtro);
        return Promise.resolve(st.datos);
      }
      if (st.promesa) {
        return st.promesa.then(function () {
          if (filtro) self._pintarSeccion(st.datos, cuerpo, filtro);
        });
      }

      cuerpo.innerHTML = '';
      // Una sección puede traer sus servicios en el propio catálogo (así se
      // declaran desde el constructor del plugin) y entonces no hay que pedir
      // nada: se usan tal cual, con la misma forma que devuelve el portal.
      if (Array.isArray(sec.servicios) && sec.servicios.length) {
        const datos = {
          seccion: sec,
          familias: [{
            nombre: sec.nombre,
            id: sec.id,
            servicios: sec.servicios
          }],
          total: sec.servicios.length
        };
        st.datos = datos;
        self._totalSeccion = datos.total || 0;
        cuenta.textContent = datos.total + (datos.total === 1 ? ' servicio' : ' servicios');
        self._pintarSeccion(datos, cuerpo, filtro);
        return Promise.resolve(datos);
      }

      this._pintarAviso(cuerpo, 'Pidiendo «' + sec.nombre + '» al catálogo de la IDEE…');

      st.promesa = window.CatalogoIDEE.listarSeccion(sec.id).then(function (datos) {
        st.datos = datos;
        st.promesa = null;
        self._totalSeccion = datos.total || 0;
        cuenta.textContent = datos.total + (datos.total === 1 ? ' servicio' : ' servicios');
        self._pintarSeccion(datos, cuerpo, filtro);
        return datos;
      }).catch(function (err) {
        st.promesa = null;
        cuerpo.innerHTML = '';
        self._pintarAviso(cuerpo,
          'No se ha podido pedir esta sección: ' + (err && err.message ? err.message : err), 'error');
        return null;
      });

      return st.promesa;
    }

/**
     * Pinta una página de los servicios de una sección, agrupados por organismo.
     *
     *  Se pagina de TAMANIO_PAGINA en TAMANIO_PAGINA. Antes se pintaban los
     *  primeros LIMITE_FILAS y el aviso iba al final de la lista, a 18.000 px de
     *  scroll: no lo veía nadie y parecía directamente que faltaban servicios.
     *  Con el paginador se sabe en todo momento en qué página se está y cuántas
     *  hay.
     *
     * @param {Object} datos { seccion, familias, total }.
     * @param {HTMLElement} cuerpo
     * @param {string} [filtro] Texto a filtrar.
     * @returns {boolean} Si queda algo visible (para decidir si esconder la
     *   sección entera cuando el filtro no encuentra nada).
     */
    _pintarSeccion(datos, cuerpo, filtro) {
      const self = this;
      const f = (filtro || '').trim().toLowerCase();
      cuerpo.innerHTML = '';

      // 1) Aplanar en el orden del catálogo, filtrando. Se aplana ANTES de
      //    paginar porque si no, un corte de página podía dejar a un organismo
      //    con la cabecera puesta y sin ningún servicio debajo.
      const planos = [];
      datos.familias.forEach(function (fam) {
        (fam.servicios || []).forEach(function (srv) {
          if (!f || coincideServicio(srv, fam.nombre, f)) planos.push({ fam: fam, srv: srv });
        });
      });

      const encontrados = planos.length;
      if (!encontrados) {
        this._pintarAviso(cuerpo,
          f ? 'Ninguna sección contiene «' + filtro + '».' : 'La sección no tiene servicios.');
        this._pintarCuentaBuscador(0, 0);
        this._pagina = 1;
        return false;
      }

      // 2) Ventana de la página.
      const paginas = Math.max(1, Math.ceil(encontrados / TAMANIO_PAGINA));
      if (this._pagina > paginas || this._pagina < 1) this._pagina = paginas;
      const todos = this._verTodos;
      const desde = todos ? 0 : (this._pagina - 1) * TAMANIO_PAGINA;
      const hasta = todos ? encontrados : Math.min(encontrados, desde + TAMANIO_PAGINA);
      const visibles = planos.slice(desde, hasta);

      // 3) Pintar, reagrupando por organismo dentro de la página.
      const fragmentos = document.createDocumentFragment();
      let familiaActual = null;
      let cuentaActual = 0;
      let totalDeLaFamilia = 0;

      const cerrarOrganismo = function () {
        if (!familiaActual) return;
        const org = document.createElement('div');
        org.className = 'catalogo__organismo';
        const orgNombre = document.createElement('span');
        orgNombre.textContent = familiaActual.nombre;
        const orgCuenta = document.createElement('span');
        orgCuenta.className = 'catalogo__organismo-cuenta';
        // Con filtro o mostrando la lista entera, el número que interesa es el
        // de los que hay. Paginado, solo se enseña el total de la familia si la
        // página se ha quedado a medias en ella: si no, un número menor del real
        // parece que la cuenta esté mal.
        orgCuenta.textContent = (f || todos || cuentaActual >= totalDeLaFamilia)
          ? cuentaActual
          : cuentaActual + ' de ' + totalDeLaFamilia;
        org.appendChild(orgNombre);
        org.appendChild(orgCuenta);
        fragmentos.appendChild(org);
        familiaActual = null;
        cuentaActual = 0;
        totalDeLaFamilia = 0;
      };

      visibles.forEach(function (p) {
        if (p.fam !== familiaActual) {
          cerrarOrganismo();
          familiaActual = p.fam;
          totalDeLaFamilia = planos.filter(function (x) { return x.fam === p.fam; }).length;
        }
        cuentaActual++;
        fragmentos.appendChild(self._filaServicio(p.srv, datos.seccion));
      });
      cerrarOrganismo();

      // 4) Paginador arriba y abajo: arriba para verlo nada más abrir la sección,
      //    abajo para seguir leyendo sin tener que volver a subir.
      cuerpo.appendChild(this._crearPaginador(paginas, encontrados, todos));
      cuerpo.appendChild(fragmentos);
      cuerpo.appendChild(this._crearPaginador(paginas, encontrados, todos));

      this._pintarCuentaBuscador(visibles.length, encontrados);
      return true;
    }

    /**
     * Crea el paginador de una sección.
     *
     *  Se crea dos veces por página (arriba y abajo) y los dos escriben en el
     *  mismo estado, así que no hay nada que sincronizar entre ellos.
     *
     * @param {number} paginas Número de páginas.
     * @param {number} encontrados Servicios que hay en total.
     * @param {boolean} todos Si se están mostrando todos.
     * @returns {HTMLElement} El paginador.
     */
    _crearPaginador(paginas, encontrados, todos) {
      const self = this;
      const caja = document.createElement('div');
      caja.className = 'catalogo__paginador';

      if (todos) {
        // Lista entera: no hay páginas, pero sí una salida para volver a paginar.
        const texto = document.createElement('span');
        texto.className = 'catalogo__paginador-info';
        texto.textContent = 'Mostrando los ' + encontrados + ' servicios, sin paginar';
        caja.appendChild(texto);
        const volver = document.createElement('button');
        volver.type = 'button';
        volver.className = 'catalogo__pie-boton';
        volver.textContent = 'Ver de ' + TAMANIO_PAGINA + ' en ' + TAMANIO_PAGINA;
        volver.addEventListener('click', function () {
          self._verTodos = false;
          self._pagina = 1;
          self._filtrarSecciones();
        });
        caja.appendChild(volver);
        return caja;
      }

      const irA = function (n) {
        self._pagina = n;
        self._filtrarSecciones();
      };

      const anterior = document.createElement('button');
      anterior.type = 'button';
      anterior.className = 'catalogo__pag-boton';
      anterior.textContent = 'Anterior';
      anterior.disabled = this._pagina <= 1;
      anterior.addEventListener('click', function () { irA(self._pagina - 1); });

      const info = document.createElement('span');
      info.className = 'catalogo__paginador-info';
      info.textContent = 'Página ' + this._pagina + ' de ' + paginas;

      const siguiente = document.createElement('button');
      siguiente.type = 'button';
      siguiente.className = 'catalogo__pag-boton';
      siguiente.textContent = 'Siguiente';
      siguiente.disabled = this._pagina >= paginas;
      siguiente.addEventListener('click', function () { irA(self._pagina + 1); });

      const todosBtn = document.createElement('button');
      todosBtn.type = 'button';
      todosBtn.className = 'catalogo__pie-boton';
      todosBtn.textContent = 'Ver los ' + encontrados;
      todosBtn.addEventListener('click', function () {
        self._verTodos = true;
        self._filtrarSecciones();
      });

      caja.appendChild(anterior);
      caja.appendChild(info);
      caja.appendChild(siguiente);
      // "Ver los N" solo cuando de verdad hay más páginas: si todo cabe en una,
      // el botón abriría lo mismo que ya se está viendo.
      if (paginas > 1) caja.appendChild(todosBtn);
      return caja;
    }

    /** Una fila de servicio con su botón de carga. */
    _filaServicio(srv, sec) {
      const self = this;
      const fila = document.createElement('div');
      fila.className = 'catalogo__item';

      const texto = document.createElement('div');
      texto.className = 'catalogo__item-texto';

      const nombre = document.createElement('span');
      nombre.className = 'catalogo__item-nombre';
      nombre.textContent = srv.nombre;
      nombre.title = srv.nombre;
      texto.appendChild(nombre);

      const url = document.createElement('span');
      url.className = 'catalogo__item-url';
      url.textContent = srv.url;
      url.title = srv.url;
      texto.appendChild(url);

      fila.appendChild(texto);

      // El globo. Se engancha al ratón Y al teclado (focusin/focusout), para que
      // la descripción se lea también sin puntero.
      fila.addEventListener('mouseenter', function () { self._mostrarGlobo(fila, srv); });
      fila.addEventListener('mouseleave', function () { self._ocultarGlobo(); });
      fila.addEventListener('focusin', function () { self._mostrarGlobo(fila, srv); });
      fila.addEventListener('focusout', function () { self._ocultarGlobo(); });

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__item-boton';
      boton.textContent = 'Cargar';
      boton.addEventListener('click', function () { self._cargarServicio(srv, sec); });
      fila.appendChild(boton);

      return fila;
    }

    /**
     * El elemento del globo, creado la primera vez que hace falta.
     *
     *  Va colgado de document.body y NO de la fila: dentro del panel lo
     *  recortaría el scroll de .catalogo__contenido (overflow-y: auto), que es
     *  justo donde se pinta. Siendo fijo, además, no se va con el desplazamiento.
     *  Es UN solo globo para todas las filas, no uno por fila: con el catálogo
     *  de la IDEE hay hasta 250 filas en el documento y serían 250 nodos de más
     *  siempre en la página.
     *
     * @returns {HTMLElement}
     */
    _elementoGlobo() {
      if (this._globoEl && this._globoEl.parentNode) return this._globoEl;
      const globo = document.createElement('div');
      globo.className = 'catalogo__globo';
      globo.setAttribute('role', 'tooltip');
      globo.hidden = true;
      document.body.appendChild(globo);
      this._globoEl = globo;
      return globo;
    }

    /**
     * Muestra el globo de un servicio, con lo que el catálogo sepa de él.
     *
     *  La descripción solo está en algunos catálogos: el de servicios
     *  personalizados la trae declared en mapa.js y los dados de alta por el
     *  usuario la normalizan desde `description`/`abstract` (ver
     *  catalogo_registro.js). El de la IDEE no la tiene —medido: sus servicios
     *  solo traen name, url, id y clase—, así que ahí el globo se queda con el
     *  nombre y la URL enteros, que también están siempre truncados en la fila.
     *
     * @param {HTMLElement} fila Fila sobre la que se pasa el puntero.
     * @param {Object} srv Servicio {nombre, url, descripcion}.
     */
    _mostrarGlobo(fila, srv) {
      const globo = this._elementoGlobo();
      if (!globo || !fila) return;

      while (globo.firstChild) globo.removeChild(globo.firstChild);

      if (srv.nombre) {
        const titulo = document.createElement('div');
        titulo.className = 'catalogo__globo-titulo';
        titulo.textContent = srv.nombre;
        globo.appendChild(titulo);
      }
      if (srv.descripcion) {
        const desc = document.createElement('div');
        desc.className = 'catalogo__globo-desc';
        desc.textContent = srv.descripcion;
        globo.appendChild(desc);
      }
      if (srv.url) {
        const url = document.createElement('div');
        url.className = 'catalogo__globo-url';
        url.textContent = srv.url;
        globo.appendChild(url);
      }
      if (srv.id) {
        const id = document.createElement('div');
        id.className = 'catalogo__globo-id';
        id.textContent = 'Ref. ' + srv.id;
        globo.appendChild(id);
      }

      globo.hidden = false;

      // Colocarlo: a la IZQUIERDA de la fila, que es donde está el mapa. Si no
      // cabe (panel en el lado izquierdo de la pantalla), se pone encima. Se
      // mide DESPUÉS de quitarlo de hidden, que es cuando tiene tamaño real.
      const r = fila.getBoundingClientRect();
      const g = globo.getBoundingClientRect();
      const margen = 8;
      let x = r.left - g.width - 10;
      if (x < margen) x = Math.min(r.left, window.innerWidth - g.width - margen);
      let y = r.top;
      if (y + g.height > window.innerHeight - margen) {
        y = Math.max(margen, window.innerHeight - g.height - margen);
      }
      globo.style.left = Math.round(x) + 'px';
      globo.style.top = Math.round(y) + 'px';
    }

    /** Oculta el globo, si lo hay. */
    _ocultarGlobo() {
      if (this._globoEl) this._globoEl.hidden = true;
    }

    /** Lista plana de servicios (catálogos STAC y OGC API Records). */
    _pintarLista(cont, servicios) {
      const self = this;
      // El mismo buscador de las secciones y del árbol: sin él estos catálogos no
      // se podían filtrar.
      this._pintarBuscador(cont);

      // Las filas van en su propio contenedor, para poder rehacerlas al filtrar
      // sin tocar el buscador (que es lo que hacía perder el foco).
      let caja = this._listaEl;
      if (!caja || !document.contains(caja)) {
        caja = document.createElement('div');
        caja.className = 'catalogo__lista';
        cont.appendChild(caja);
        this._listaEl = caja;
      }
      caja.innerHTML = '';
      if (!servicios.length) {
        this._pintarAviso(caja, 'Este catálogo todavía no tiene servicios predefinidos.');
        return;
      }
      servicios.forEach(function (srv) {
        caja.appendChild(self._filaServicio(srv, { tipo: srv.tipo || null }));
      });
    }

    /**
     * Aplica el filtro de texto a lo que ya está pintado, SIN reconstruir el
     * buscador.
     *
     *  Antes el input llamaba a _pintarCatalogo(), que rehacía todo el panel
     *  incluido el propio input: en cada pulsación se destruía y se volvía a
     *  crear, y por eso se perdía el foco. Ahora cada modo repinta solo su
     *  cuerpo.
     */
    _filtrar() {
      const tipo = this._catalogoActual();
      if (!tipo) return;
      if (tipo.modo === 'secciones') {
        this._filtrarSecciones();
      } else if (tipo.modo === 'arbol') {
        this._repintarArbol();
      } else {
        this._repintarLista();
      }
    }

    /** Rehace solo la lista de servicios, sin tocar el buscador. */
    _repintarLista() {
      const caja = this._listaEl;
      if (!caja) return;
      const tipo = this._catalogoActual();
      // Ojo: en un catálogo remoto listar() devuelve los servicios declarados en el
      // constructor, que están vacíos. Las entradas de verdad viven en
      // _entradasPropias, que es donde las deja _pintarCatalogoRemoto.
      const cache = this._entradasPropias[tipo.id];
      const todos = (cache && cache.datos)
        || ((tipo && typeof tipo.listar === 'function') ? tipo.listar() : []);
      const f = (this._filtro || '').trim().toLowerCase();
      const servicios = f
        ? todos.filter(function (s) { return coincideServicio(s, null, f); })
        : todos;
      caja.innerHTML = '';
      if (!servicios.length) {
        this._pintarAviso(caja, f ? 'Ningún servicio coincide con «' + f + '».'
          : 'Este catálogo todavía no tiene servicios predefinidos.');
        this._pintarCuentaBuscador(0, 0);
        return;
      }
      const self = this;
      servicios.forEach(function (srv) {
        caja.appendChild(self._filaServicio(srv, { tipo: srv.tipo || null }));
      });
      this._pintarCuentaBuscador(servicios.length, todos.length || servicios.length);
    }

    // =====================================================================
    //  Pestaña 2: añadir una capa por URL
    // =====================================================================

    /** Analiza la URL escrita y, si puede, monta las opciones de carga. */
    _analizarUrl() {
      const self = this;
      const input = this._urlInputEl;
      const cont = this._opcionesEl;
      const url = input ? String(input.value || '').trim() : '';

      if (!cont) return;
      cont.innerHTML = '';

      if (!url) {
        this._decir('Escribe primero una URL.', 'aviso');
        return;
      }
      if (!/^https?:\/\//i.test(url)) {
        this._decir('La URL tiene que empezar por http:// o https://', 'aviso');
        return;
      }

      const urlTool = window.CatalogoURL;
      if (!urlTool) {
        this._decir('No está cargado catalogo_url.js.', 'error');
        return;
      }

      this._urlIntroducida = url;
      this._analisis = { url: url, tipo: urlTool.detectarTipo(url), capas: [], elegidas: [], nombre: '' };
      this._pintarAviso(cont, 'Analizando el servicio…');

      urlTool.leerCapas(url).then(function (info) {
        self._analisis = {
          url: url,
          tipo: info.tipo,
          capas: info.capas || [],
          elegidas: (info.capas || []).map(function (c) { return c.id; }),
          nombre: info.nombre || '',
          aviso: info.aviso || null
        };
        self._pintarOpciones();
        self._decir('Servicio analizado: ' + (info.capas || []).length + ' capa(s).');
      }).catch(function (err) {
        cont.innerHTML = '';
        // La URL se queda escrita y el tipo deducio a la vista, para que se
        // pueda probar a cargar a mano aunque no se haya podido leer nada.
        self._analisis = {
          url: url,
          tipo: urlTool.detectarTipo(url),
          capas: [],
          elegidas: [],
          nombre: urlTool.nombreDeUrl(url),
          aviso: null,
          error: (err && err.message) ? err.message : String(err)
        };
        self._pintarOpciones();
        self._decir('No se ha podido leer el servicio: ' + self._analisis.error, 'aviso');
      });
    }

    /** Pinta el bloque de opciones de carga de la URL analizada. */
    _pintarOpciones() {
      const self = this;
      const cont = this._opcionesEl;
      const info = this._analisis;
      if (!cont || !info) return;

      const urlTool = window.CatalogoURL;
      cont.innerHTML = '';

      const caja = document.createElement('div');
      caja.className = 'catalogo__opciones';

      // --- Tipo detectado (editable) --------------------------------------
      const filaTipo = document.createElement('label');
      filaTipo.className = 'catalogo__campo';
      const etiquetaTipo = document.createElement('span');
      etiquetaTipo.className = 'catalogo__campo-etiqueta';
      etiquetaTipo.textContent = 'Tipo de capa';
      const selTipo = document.createElement('select');
      selTipo.className = 'catalogo__campo-control';
      Object.keys(urlTool.TIPOS).forEach(function (t) {
        const op = document.createElement('option');
        op.value = t;
        op.textContent = urlTool.ETIQUETAS[t] || t;
        if (t === info.tipo) op.selected = true;
        selTipo.appendChild(op);
      });
      if (info.tipo === 'desconocido') {
        const op = document.createElement('option');
        op.value = 'desconocido';
        op.textContent = urlTool.ETIQUETAS.desconocido;
        op.selected = true;
        selTipo.insertBefore(op, selTipo.firstChild);
      }
      selTipo.addEventListener('change', function () {
        self._analisis.tipo = this.value;
      });
      filaTipo.appendChild(etiquetaTipo);
      filaTipo.appendChild(selTipo);
      caja.appendChild(filaTipo);

      // --- Nombre que se le quiere dar -------------------------------------
      const filaNombre = document.createElement('label');
      filaNombre.className = 'catalogo__campo';
      const etiquetaNombre = document.createElement('span');
      etiquetaNombre.className = 'catalogo__campo-etiqueta';
      etiquetaNombre.textContent = 'Nombre de la capa';
      const inputNombre = document.createElement('input');
      inputNombre.type = 'text';
      inputNombre.className = 'catalogo__campo-control';
      inputNombre.value = info.nombre || '';
      inputNombre.placeholder = 'Cómo se verá en el panel de capas';
      inputNombre.addEventListener('input', function () { self._analisis.nombre = this.value; });
      filaNombre.appendChild(etiquetaNombre);
      filaNombre.appendChild(inputNombre);
      caja.appendChild(filaNombre);

      // --- Capas del servicio ----------------------------------------------
      if (info.capas && info.capas.length) {
        const bloqueCapas = document.createElement('div');
        bloqueCapas.className = 'catalogo__capas';

        const cabecera = document.createElement('div');
        cabecera.className = 'catalogo__capas-cabecera';

        const titulo = document.createElement('span');
        titulo.className = 'catalogo__capas-titulo';
        titulo.textContent = 'Capas del servicio (' + info.capas.length + ')';
        cabecera.appendChild(titulo);

        const acciones = document.createElement('span');
        acciones.className = 'catalogo__capas-acciones';
        const todas = document.createElement('button');
        todas.type = 'button';
        todas.className = 'catalogo__enlace';
        todas.textContent = 'Todas';
        todas.addEventListener('click', function () {
          self._analisis.elegidas = info.capas.map(function (c) { return c.id; });
          self._pintarCapasElejidas();
          self._pintarOpciones();
        });
        const ninguna = document.createElement('button');
        ninguna.type = 'button';
        ninguna.className = 'catalogo__enlace';
        ninguna.textContent = 'Ninguna';
        ninguna.addEventListener('click', function () {
          self._analisis.elegidas = [];
          self._pintarCapasElejidas();
          self._pintarOpciones();
        });
        acciones.appendChild(todas);
        acciones.appendChild(ninguna);
        cabecera.appendChild(acciones);
        bloqueCapas.appendChild(cabecera);

        const lista = document.createElement('div');
        lista.className = 'catalogo__capas-lista';
        bloqueCapas.appendChild(lista);
        this._capasListaEl = lista;

        caja.appendChild(bloqueCapas);
        this._pintarCapasElejidas();
      }

      // --- Avisos ----------------------------------------------------------
      if (info.error) {
        this._pintarAviso(caja,
          'No se ha podido leer el documento del servicio (' + info.error + '). ' +
          'Se puede probar a cargarlo igualmente.', 'aviso');
      } else if (info.aviso) {
        this._pintarAviso(caja, info.aviso, 'aviso');
      }

      // --- Botón de cargar ---------------------------------------------------
      const pie = document.createElement('div');
      pie.className = 'catalogo__opciones-pie';
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__cargar';
      const elegidas = (info.elegidas || []).length;
      boton.textContent = (elegidas > 1)
        ? 'Cargar ' + elegidas + ' capas'
        : 'Cargar en el mapa';
      boton.addEventListener('click', function () {
        self._cargarDesdeAnalisis();
      });
      this._botonCargarEl = boton;
      pie.appendChild(boton);
      caja.appendChild(pie);

      cont.appendChild(caja);
      this._actualizarBotonCargar();
    }

    /** El botón de carga dice cuántas capas hay elegidas. */
    _actualizarBotonCargar() {
      const boton = this._botonCargarEl;
      if (!boton || !this._analisis) return;
      const elegidas = (this._analisis.elegidas || []).length;
      boton.textContent = (elegidas > 1)
        ? 'Cargar ' + elegidas + ' capas'
        : 'Cargar en el mapa';
      boton.disabled = (elegidas === 0);
    }

    /** Marca o desmarca una capa del servicio. */
    _alternarCapa(id, marcada) {
      const self = this;
      const elegidas = (this._analisis.elegidas || []).slice();
      const pos = elegidas.indexOf(id);
      if (marcada && pos === -1) elegidas.push(id);
      if (!marcada && pos > -1) elegidas.splice(pos, 1);
      self._analisis.elegidas = elegidas;
      self._actualizarBotonCargar();
    }

    /** Redibuja la lista de capas con su casilla de selección. */
    _pintarCapasElejidas() {
      const self = this;
      const lista = this._capasListaEl;
      const info = this._analisis;
      if (!lista || !info) return;

      lista.innerHTML = '';
      info.capas.forEach(function (c) {
        const marcada = (info.elegidas || []).indexOf(c.id) > -1;
        const fila = document.createElement('label');
        fila.className = 'catalogo__capa' + (marcada ? ' catalogo__capa--marcada' : '');

        const caja = document.createElement('input');
        caja.type = 'checkbox';
        caja.className = 'catalogo__capa-casilla';
        caja.checked = marcada;
        caja.addEventListener('change', function () {
          self._alternarCapa(c.id, this.checked);
          fila.classList.toggle('catalogo__capa--marcada', this.checked);
        });

        const textos = document.createElement('span');
        textos.className = 'catalogo__capa-textos';
        const nombre = document.createElement('span');
        nombre.className = 'catalogo__capa-nombre';
        nombre.textContent = c.nombre;
        nombre.title = c.nombre;
        const id = document.createElement('span');
        id.className = 'catalogo__capa-id';
        id.textContent = c.id;
        id.title = c.id;
        textos.appendChild(nombre);
        textos.appendChild(id);

        fila.appendChild(caja);
        fila.appendChild(textos);
        lista.appendChild(fila);
      });
    }

    /** Carga lo que haya elegido en el bloque de opciones. */
    _cargarDesdeAnalisis() {
      const info = this._analisis;
      if (!info) return;
      if (!info.elegidas || !info.elegidas.length) {
        this._decir('Elige al menos una capa del servicio.', 'aviso');
        return;
      }
      this._decir('Cargando…');
      try {
        const tipoActual = this._catalogoActual();
        if (!tipoActual) return;
        const capas = tipoActual.cargarUrl(info.url, this._map, {
          tipo: info.tipo,
          capas: info.elegidas,
          nombre: info.nombre
        });
        const cuantas = (capas && capas.length) || 0;
        this._decir('Cargada' + (cuantas > 1 ? 's ' + cuantas + ' capas' : '') + ': ' + info.nombre);
      } catch (err) {
        this._decir('No se ha podido cargar: ' + (err && err.message ? err.message : err), 'error');
      }
    }

    // =====================================================================
    //  Carga de servicios
    // =====================================================================

    /**
     * Carga un servicio del catálogo.
     *
     * La URL del catálogo es el GetCapabilities del SERVICIO, no de una capa
     * concreta, así que hay que leer el documento para saber qué capas ofrece.
     * Si ofrece una sola, se carga directamente; si ofrece varias, se salta a
     * la pestaña de opciones con la URL ya puesta, que es donde se decide.
     *
     * @param {Object} srv Servicio del catálogo.
     * @param {Object} sec Sección a la que pertenece.
     */
    _cargarServicio(srv, sec) {
      const self = this;
      const urlTool = window.CatalogoURL;
      const tipo = (sec && sec.tipo) || srv.tipo || (urlTool ? urlTool.detectarTipo(srv.url) : 'WMS');

      if (!urlTool) return;
      this._decir('Leyendo el servicio «' + srv.nombre + '»…');

      urlTool.leerCapas(srv.url, tipo).then(function (info) {
        if (!info.capas || info.capas.length <= 1) {
          const cargador = self._catalogoActual();
          if (!cargador) return;
          const creadas = cargador.cargarUrl(srv.url, self._map, {
            tipo: info.tipo || tipo,
            capas: (info.capas || []).map(function (c) { return c.id; }),
            nombre: srv.nombre
          });
          const cuantas = (creadas && creadas.length) || 0;
          self._decir('Cargada' + (cuantas > 1 ? 's ' + cuantas + ' capas' : '') + ': ' + srv.nombre);
          return;
        }

        // Varias capas: a la pestaña de opciones, con todo puesto.
        self._urlIntroducida = srv.url;
        if (self._urlInputEl) self._urlInputEl.value = srv.url;
        self._analisis = {
          url: srv.url,
          tipo: info.tipo || tipo,
          capas: info.capas,
          elegidas: info.capas.map(function (c) { return c.id; }),
          nombre: srv.nombre,
          aviso: null
        };
        self._verPestana('capa');
        self._pintarOpciones();
        self._decir('«' + srv.nombre + '» ofrece ' + info.capas.length +
          ' capas: elige cuáles cargar en la pestaña de opciones.', 'aviso');
      }).catch(function (err) {
        self._decir('No se ha podido leer «' + srv.nombre + '»: ' +
          (err && err.message ? err.message : err), 'error');
      });
    }

    /** Mensaje o error dentro de un contenedor de la interfaz. */
    _pintarAviso(contenedor, texto, clase) {
      const aviso = document.createElement('p');
      aviso.className = 'catalogo__aviso' + (clase ? ' catalogo__aviso--' + clase : '');
      aviso.textContent = texto;
      contenedor.appendChild(aviso);
      return aviso;
    }

    /** Escribe un mensaje en el cuadro de estado. */
    _decir(mensaje, clase) {
      this._ultimoMensaje = mensaje;
      if (!this._estadoEl) return;
      this._estadoEl.textContent = mensaje;
      this._estadoEl.className = 'catalogo__estado' + (clase ? (' catalogo__estado--' + clase) : '');
    }

    // =====================================================================
    //  Contrato de estado (cambio 2D/3D)
    // =====================================================================
    getState() {
      let panelCollapsed = true;
      if (this._panel) {
        if (this._panel._collapsed !== undefined) {
          panelCollapsed = !!this._panel._collapsed;
        } else if (typeof this._panel.getElement === 'function') {
          const panelEl = this._panel.getElement();
          panelCollapsed = panelEl ? panelEl.classList.contains('collapsed') : true;
        }
      }
      return {
        tipo: this._tipoSeleccionado,
        url: this._urlIntroducida,
        mensaje: this._ultimoMensaje,
        pestana: this._pestanaActiva,
        // Tipo de servicio que se estaba mirando y filtro de texto: es lo que
        // el usuario tenía delante, y volver a pedir esa sección cuesta una
        // petición al portal.
        seccion: this._seccionActiva,
        grupos: this._gruposAbiertos.slice(),
        filtro: this._filtro || '',
        // Lo último analizado, para que la pestaña de opciones siga montada
        // después del cambio 2D/3D sin tener que volver a pedir el servicio.
        analisis: this._analisis ? {
          url: this._analisis.url,
          tipo: this._analisis.tipo,
          nombre: this._analisis.nombre,
          capas: (this._analisis.capas || []).map(function (c) { return { id: c.id, nombre: c.nombre }; }),
          elegidas: (this._analisis.elegidas || []).slice(),
          aviso: this._analisis.aviso || null
        } : null,
        panelCollapsed: panelCollapsed
      };
    }

    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      // Un catálogo del usuario vale igual que uno de serie: los ids de estos
      // empiezan por "usuario_" y no están en CATALOGOS.
      const esDelUsuario = window.CatalogoRegistro && window.CatalogoRegistro.porId(state.tipo);
      if (state.tipo && (this._catalogos[state.tipo] || esDelUsuario)) {
        this._tipoSeleccionado = state.tipo;
      }
      if (typeof state.url === 'string') {
        this._urlIntroducida = state.url;
      }
      if (typeof state.mensaje === 'string') {
        this._ultimoMensaje = state.mensaje;
      }
      if (typeof state.seccion === 'string') {
        this._seccionActiva = state.seccion;
      }
      if (Array.isArray(state.grupos)) {
        this._gruposAbiertos = state.grupos.filter(function (id) { return typeof id === 'string'; });
      }
      if (typeof state.filtro === 'string') {
        this._filtro = state.filtro;
      }
      if (state.analisis && typeof state.analisis.url === 'string') {
        this._analisis = {
          url: state.analisis.url,
          tipo: state.analisis.tipo,
          nombre: state.analisis.nombre || '',
          capas: Array.isArray(state.analisis.capas) ? state.analisis.capas : [],
          elegidas: Array.isArray(state.analisis.elegidas) ? state.analisis.elegidas : [],
          aviso: state.analisis.aviso || null,
          error: null
        };
      }
      if (state.pestana && this._pestanas[state.pestana]) {
        this._verPestana(state.pestana);
      }
      if (typeof state.panelCollapsed === 'boolean' && this._panel) {
        try {
          if (state.panelCollapsed && typeof this._panel.collapse === 'function') {
            this._panel.collapse();
          } else if (!state.panelCollapsed && typeof this._panel.open === 'function') {
            this._panel.open();
          }
        } catch (e) {
          console.warn(this.name + ': no se pudo restaurar el panel.', e);
        }
      }
      // La UI se reconstruye sola en el swap (addTo se vuelve a llamar), así que
      // aquí solo hace falta que el estado esté guardado... y sincronizado: el
      // panel nuevo nace con los valores por defecto y setState llega después.
      this._sincronizarUI();
    }

    /**
     * Pasa el estado interno a los elementos de la UI ya montada.
     *
     * EstadoPlugins llama a setState DESPUÉS de que addTo haya reconstruido la
     * vista con los valores por defecto, así que sin esto el selector y la
     * lista se quedarían en el catálogo inicial aunque el usuario hubiera
     * elegido otro.
     */
    _sincronizarUI() {
      const raiz = this._control && typeof this._control.getElement === 'function'
        ? this._control.getElement()
        : null;
      if (!raiz) return;
      const selector = raiz.querySelector('.catalogo__selector');
      if (selector) selector.value = this._tipoSeleccionado;
      const input = raiz.querySelector('.catalogo__url-input');
      if (input) input.value = this._urlIntroducida;
      const buscador = raiz.querySelector('.catalogo__buscador-input');
      if (buscador) buscador.value = this._filtro || '';
      this._verPestana(this._pestanaActiva);
      this._pintarCatalogo();
      if (this._analisis) this._pintarOpciones();
      if (this._estadoEl && this._ultimoMensaje) {
        this._estadoEl.textContent = this._ultimoMensaje;
        this._estadoEl.className = 'catalogo__estado';
      }
    }

    destroy() {
      if (this._panel && typeof this._panel.close === 'function') {
        try { this._panel.close(); } catch (e) { /* ignora */ }
      }
      this._panel = null;
      this._control = null;
      this._map = null;
      this._estadoEl = null;
      // Las referencias a la interfaz se sueltan todas: el panel se va con el
      // DOM y dejarlas puestas daría acceso a nodos huérfanos.
      this._gestorEl = null;
      this._opcionesEl = null;
      this._urlInputEl = null;
      this._selectorEl = null;
      this._capasListaEl = null;
      this._buscadorEl = null;
      this._cuentaBuscadorEl = null;
      // El globo vive en document.body, así que no se va con el panel: hay que
      // quitarlo a mano o se quedaría en la página con el plugin desmontado.
      if (this._globoEl && this._globoEl.parentNode) {
        this._globoEl.parentNode.removeChild(this._globoEl);
      }
      this._globoEl = null;
      this._nuevosEl = null;
      // Las secciones se piden por su cuenta, no hace falta acordarse de cuáles
      // estaban ya pedidas: el portal no cambia y CatalogoIDEE las cachea.
      this._estadoSecciones = {};
      this._entradasPropias = {};
      this._gruposDom = {};
    }
  }

  // =====================================================================
  //  Exposición triple + registro de catálogos
  // =====================================================================
  exponerCatalog();

  if (typeof window !== 'undefined') {
    window.miPlugin_catalogo = miPlugin_catalogo;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_catalogo = miPlugin_catalogo;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_catalogo = miPlugin_catalogo;
  }
})();
