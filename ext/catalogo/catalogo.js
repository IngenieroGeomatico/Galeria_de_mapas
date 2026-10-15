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

  // =====================================================================
  //  Extensiones de formato: MVT y GeoTIFF
  // =====================================================================
  // El catálogo YA sabe deducir y construir estos dos formatos: están en
  // TIPOS_API de catalogo_url.js y en ASSETS_CARGABLES de catalogo_registro.js,
  // y una escena de satélite llega al mapa como GeoTIFF sin tocar nada.
  //
  // Lo que faltaba era que la API supiera hacerlos. El bundle de Cesium declara
  // `IDEE.layer.MVT` y `IDEE.layer.GeoTIFF` pero deja sus implementaciones como
  // módulos vacíos (medido: `IDEE.impl.layer.GeoTIFF` es undefined), así que en 3D
  // la capa no hay quien la dibuje y construirlas falla con "La implementación
  // usada no puede crear capas GeoTIFF". Las implementaciones están en
  // ext/MVTLayer y ext/geotiffLayer, que registran una fachada propia y solo
  // tocan la API cuando hay que hacerlo.
  //
  // Se cargan AQUÍ y no con dos <script> en el HTML de cada visualizador: quien
  // pone el catálogo quiere el catálogo, y no debería tener que acordarse de
  // añadir además las piezas de dos formatos. En 2D los dos plugins no hacen nada
  // (solo sustituyen la fachada cuando detectan Cesium), así que cargarlos siempre
  // es inocuo.
  //
  // La ruta se resuelve contra la de ESTE fichero y no contra la del documento:
  // los visualizadores cuelgan de mapas/<nombre>/index.html a distinta profundidad,
  // y un '../' a pelo se rompería en cuanto uno cambiara de sitio.

  /** URL de este propio fichero, para resolver las de los plugins vecinos. */
  const RUTA_PROPIA = (function () {
    const s = document.currentScript;
    if (s && s.src) return s.src;
    // Respaldo: si este fichero se cargara diferido o como módulo,
    // `currentScript` ya es null, pero el <script> sigue en el documento.
    const lista = document.getElementsByTagName('script');
    for (let i = lista.length - 1; i >= 0; i--) {
      const src = lista[i].src || '';
      if (/catalogo\/catalogo\.js(\?|#|$)/.test(src)) return src;
    }
    return '';
  })();

  /** Plugins que traen las implementaciones que a la API le faltan. */
  const EXTENSIONES_FORMATO = [
    { clase: 'miPlugin_MVTLayer', fichero: '../MVTLayer/MVTLayer.js' },
    { clase: 'miPlugin_geotiffLayer', fichero: '../geotiffLayer/geotiffLayer.js' }
  ];

  /** Promesa de la carga, para no volver a pedir los scripts por cada mapa. */
  let _cargaFormatos = null;

  /**
   * Carga los plugins de formato que falten y resuelve cuando están.
   *
   * Si ya están (porque el visualizador los trajo en su HTML, o porque es el
   * segundo mapa que se crea tras un cambio 2D/3D) no se vuelve a pedir nada.
   *
   * @returns {Promise<void>}
   */
  function cargarExtensionesDeFormato() {
    if (_cargaFormatos) return _cargaFormatos;

    _cargaFormatos = new Promise(function (resolver) {
      const IDEE = api();
      const faltan = EXTENSIONES_FORMATO.filter(function (e) {
        return !((window[e.clase] && typeof window[e.clase] === 'function') ||
                 (IDEE && IDEE.plugin && typeof IDEE.plugin[e.clase] === 'function'));
      });
      if (!faltan.length) { resolver(); return; }

      const base = RUTA_PROPIA || document.baseURI;
      let pendientes = faltan.length;
      faltan.forEach(function (e) {
        const s = document.createElement('script');
        s.src = new URL(e.fichero, base).href;
        s.async = false;
        const fallo = function () {
          console.warn('catalogo: no se pudo cargar ' + e.fichero +
            ', así que ese formato solo funciona en 2D.');
          if (--pendientes === 0) resolver();
        };
        s.onload = function () {
          if (--pendientes === 0) resolver();
        };
        s.onerror = fallo;
        document.head.appendChild(s);
      });
    });
    return _cargaFormatos;
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
  async function cargarUrlGenerica(url, mapa, opciones) {
    const opts = opciones || {};
    const urlTool = window.CatalogoURL;
    if (!urlTool) {
      console.error('[catalogo] no está cargado catalogo_url.js');
      return [];
    }
    // El tipo lo pone el panel si ya lo sabe (viene de leer las capabilities);
    // si no, lo deduce la algoritmia por la URL.
    const tipo = opts.tipo || urlTool.detectarTipo(url);

    // Los tipos de servicio (WMS, WMTS, WFS, WCS) ya se han leído antes, en
    // leerCapas, y un CORS ahí ya sale. El resto se carga sin consultar nada:
    // si el servidor no manda CORS, la capa se añade, no pinta y no dice nada.
    // Por eso se mira antes de añadir. Ver urlEsLegible en catalogo_url.js.
    const seConsulta = ['WMS', 'WMTS', 'WFS', 'WCS'].indexOf(String(tipo).toUpperCase()) > -1;
    if (!seConsulta && typeof urlTool.urlEsLegible === 'function') {
      const legible = await urlTool.urlEsLegible(url);
      if (!legible) {
        throw new Error('El navegador no ha podido leer «' + url + '» desde aquí: ' +
          'ese servidor no manda cabeceras CORS (Access-Control-Allow-Origin).');
      }
    }

    return urlTool.cargar({
      url: url,
      mapa: mapa,
      tipo: tipo,
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
      // Barra supraplugin anadida (ver getSupraElement mas abajo):
      // boton en la barra y panel en el mapa.
      this.supra = null;
      this._supraWrap = null;
      this._supraBoton = null;
      this._syncDoc = null;
      this._control = null;

      // Mapas en los que YA se han registrado los plugins de formato (MVT y
      // GeoTIFF), para no registrar dos veces los mismos en el mismo mapa. Es un
      // WeakMap y no un booleano porque el mismo plugin puede vivir con dos
      // mapas distintos, y porque tras un cambio 2D/3D `mapa()` crea una
      // instancia nueva con un mapa nuevo, que sí hay que registrar.
      this._formatosPorMapa = new WeakMap();

      // La huella del elemento STAC que se está viendo en el mapa, si hay alguna:
      // la capa y qué elemento es, para poder quitarla o volver a ponerla.
      this._huellaCapa = null;
      this._huellaDe = null;
      // La huella que se muestra al pasar el ratón por encima del botón, sin
      // llegar a hacer clic: es una capa aparte que se quita al salir.
      this._huellaPreviewCapa = null;
      this._huellaPreviewDe = null;

      // El filtro de búsqueda por zona y fechas que se está aplicando a la
      // colección abierta, si lo hay. Es de un nodo solo: al entrar en otro se
      // olvida, porque los filtros no tienen sentido entre colecciones.
      this._filtroStac = null;

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
      // Navegación por el árbol de un catálogo STAC: dónde se está y lo que se
      // ha pedido al bajar, para poder volver sin volver a preguntar nada.
      this._pilaStac = [];
      this._cacheStac = {};
      // Paginación de las colecciones de una API STAC: por URL de colección,
      // cuántas entradas hay cargadas y cuál es la página siguiente. Vive
      // aparte de _cacheStac porque crece al leer más, no al navegar.
      this._paginacionStac = {};
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

      // ── MVT y GeoTIFF en 3D ───────────────────────────────────────────
      // Van aparte porque llegan por red y no pueden estar listos al construir el
      // mapa. Se registran sobre este mapa una sola vez.
      this._registrarExtensionesDeFormato(map);
    }

    /**
     * Carga los plugins de MVT y GeoTIFF y los registra en el mapa.
     *
     * El registro va dentro del.then() a propósito: se llama a `map.addPlugin`
     * desde otro turno porque aquí la API está iterando sus plugins, y meter uno
     * más en mitad de la vuelta es pedir que se lo salte.
     *
     * @param {Object} map
     */
    _registrarExtensionesDeFormato(map) {
      if (this._formatosPorMapa.get(map)) return;
      this._formatosPorMapa.set(map, true);

      const mapa = map;
      cargarExtensionesDeFormato().then(function () {
        const IDEE = api();
        EXTENSIONES_FORMATO.forEach(function (e) {
          // Se mira primero en `window`: tras un cambio 2D/3D el bundle crea un
          // IDEE.plugin nuevo, pero el global directo persiste y el coordinador
          // de cambioImpl lo vuelve a colgar ahí (miPlugin_*).
          const clase = window[e.clase] ||
            (IDEE && IDEE.plugin && IDEE.plugin[e.clase]);
          if (typeof clase !== 'function') {
            console.warn('catalogo: ' + e.clase + ' no se ha registrado.');
            return;
          }
          try { mapa.addPlugin(new clase()); }
          catch (err) { console.warn('catalogo: no se pudo registrar ' + e.clase + '.', err); }
        });
      });
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
        // La navegación por el árbol STAC es de un catálogo: al cambiar de
        // catálogo se empieza por su raíz otra vez.
        self._resetPilaStac();
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
        // La raíz se guarda también desde la caché, no solo al descargarla. Sin
        // esto, volver a elegir un catálogo que ya estaba cargado (que es lo que
        // pasa al abrir el visualizador, porque se recuerda cuál era) dejaba la
        // raíz sin guardar: al subir desde una colección de primer nivel no
        // había de dónde volver y el catálogo se quedaba encerrado en la
        // colección, sin migas y sin botón de volver (medido).
        if (!this._pilaStac.length) this._raizStac = cache.datos;
        this._pintarLista(cont, cache.datos);
        return;
      }
      if (cache.promesa) return;   // ya se está pidiendo

      this._pintarAviso(cont, 'Consultando «' + tipo.nombre + '»…');

      cache.promesa = window.CatalogoRegistro.leer(tipo.tipoLectura, tipo.url).then(function (entradas) {
        cache.datos = entradas;
        cache.promesa = null;
        // La raíz del árbol se guarda aparte para poder volver a ella al subir
        // todo el recorrido, que si no no habría de dónde sacar la lista.
        self._raizStac = entradas;
        self._pilaStac = [];
        self._cacheStac = {};
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
      cuerpo.appendChild(this._crearPaginador(paginas, encontrados, todos, datos));
      cuerpo.appendChild(fragmentos);
      cuerpo.appendChild(this._crearPaginador(paginas, encontrados, todos, datos));

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
    _crearPaginador(paginas, encontrados, todos, datos) {
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
          self._repintarVista();
        });
        caja.appendChild(volver);
        return caja;
      }

      const irA = function (n) {
        self._pagina = n;
        self._repintarVista();
      };

      // En una colección de una API STAC puede quedar más cosas en el servidor
      // de las que hay cargadas: el enlace `next` que publica la API. En ese
      // caso "Siguiente" pide la página en vez de solo mover el corte local.
      const remoto = this._siguienteStacDe(datos);
      const hayMas = remoto && !todos;
      const cargando = remoto && remoto.cargando;

      const anterior = document.createElement('button');
      anterior.type = 'button';
      anterior.className = 'catalogo__pag-boton';
      anterior.textContent = 'Anterior';
      anterior.disabled = this._pagina <= 1 || !!cargando;
      anterior.addEventListener('click', function () { irA(self._pagina - 1); });

      const info = document.createElement('span');
      info.className = 'catalogo__paginador-info';
      info.textContent = 'Página ' + this._pagina + ' de ' + paginas +
        (cargando ? ' · cargando más…'
          : (hayMas ? ' · sigue habiendo más en el servidor' : ''));

      const siguiente = document.createElement('button');
      siguiente.type = 'button';
      siguiente.className = 'catalogo__pag-boton';
      siguiente.textContent = 'Siguiente';
      siguiente.disabled = (this._pagina >= paginas && !hayMas) || !!cargando;
      siguiente.addEventListener('click', function () {
        // Si la página siguiente aún no está en memoria, se pide antes de
        // pintar: si no, se acabaría en un "no hay nada más".
        if (hayMas && self._pagina >= paginas) self._pedirMasStac(datos);
        else irA(self._pagina + 1);
      });

      const todosBtn = document.createElement('button');
      todosBtn.type = 'button';
      todosBtn.className = 'catalogo__pie-boton';
      todosBtn.textContent = 'Ver los ' + encontrados;
      todosBtn.addEventListener('click', function () {
        self._verTodos = true;
        self._repintarVista();
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
      // Un elemento que es solo información no tiene una URL que enseñar: lo
      // que interesa de él es lo que el STAC dice de él (fecha, resolución).
      if (!srv.soloInfo && srv.url) {
        url.textContent = srv.url;
        url.title = srv.url;
      } else {
        url.textContent = srv.descripcion || '';
        url.title = srv.descripcion || '';
      }
      texto.appendChild(url);

      fila.appendChild(texto);

      // La huella de un elemento STAC, que es un Polygon GeoJSON en la propia
      // respuesta (medido) y que se estaba tirando. Sirve para dos cosas que
      // hacen falta: ver dónde está la escena antes de decidir si se descarga
      // (un COG pesa cientos de megas) y localizar un elemento que no se puede
      // cargar. Va antes del `soloInfo` a propósito: justo los elementos que no
      // se pueden cargar son los que más besoin tienen de verse en el mapa.
      if (srv.bbox || srv.geometria) {
        const botonHuella = document.createElement('button');
        botonHuella.type = 'button';
        botonHuella.className = 'catalogo__item-boton catalogo__item-boton--huella';
        botonHuella.textContent = 'Huella';
        botonHuella.title = 'Ver en el mapa dónde está este elemento';
        // Al pasar el ratón se muestra la huella sin añadirla: es un adelanto
        // de dónde está la escena. Al hacer clic se queda en el mapa.
        // En el preview NO se encuadra: el usuario está mirando su zona y
        // mover la vista sin que la haya pedido sería peor que no verla.
        botonHuella.addEventListener('mouseenter', function () {
          self._verHuella(srv, { preview: true, sinEncuadre: true });
        });
        botonHuella.addEventListener('mouseleave', function () {
          self._quitarHuellaPreview();
        });
        botonHuella.addEventListener('click', function (ev) {
          ev.stopPropagation();
          self._verHuella(srv);
        });
        fila.appendChild(botonHuella);
      }

      // Un elemento STAC se enseña pero no se carga: sus assets son ficheros
      // (COG, JP2, GeoTIFF) y la API no construye capas con ellos. Ponerle un
      // botón de cargar sería prometer algo que no puede cumplir.
      if (srv.soloInfo) {
        fila.classList.add('catalogo__item--info');
        return fila;
      }

      // El globo. Se engancha al ratón Y al teclado (focusin/focusout), para que
      // la descripción se lea también sin puntero.
      fila.addEventListener('mouseenter', function () { self._mostrarGlobo(fila, srv); });
      fila.addEventListener('mouseleave', function () { self._ocultarGlobo(); });
      fila.addEventListener('focusin', function () { self._mostrarGlobo(fila, srv); });
      fila.addEventListener('focusout', function () { self._ocultarGlobo(); });

      // Una colección se ENTRA a ella, y con ello la fila entera hace de botón, con
      // su marca de "se abre" al final. Pero entrar y cargar no son la misma
      // cosa: la colección de una API STAC publica sus elementos en un endpoint
      // OGC API Features que la API SÍ sabe construir como capa, y entonces
      // tiene las dos acciones. Solo las de un catálogo estático, que son un
      // fichero JSON y no una capa, se quedan con entrar.
      if (srv.abrir) {
        fila.classList.add('catalogo__item--abre');
        fila.setAttribute('role', 'button');
        fila.setAttribute('tabindex', '0');
        fila.title = 'Entrar en «' + srv.nombre + '»';
        const entrar = function () { self._abrirNodoStac(srv.abrir, String(srv.nombre || '').trim()); };
        fila.addEventListener('click', entrar);
        fila.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault();
            entrar();
          }
        });
      }

      // El botón de cargar va fuera si la fila NO es abrible (el caso normal de
      // un servicio). En las colecciones no: una colección no se carga como capa,
      // se entra en ella. Antes también salía ahí si era cargable, y era un botón
      // que no tenía sentido en la fila de un nodo padre.
      if (!srv.abrir) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'catalogo__item-boton';
        boton.textContent = 'Cargar';
        boton.addEventListener('click', function (ev) {
          // La fila es un botón y el botón está dentro: sin parar la subida, el
          // clic se contaría dos veces y cada carga abriría la colección.
          ev.stopPropagation();
          self._cargarServicio(srv, sec);
        });
        fila.appendChild(boton);
      }

      if (srv.abrir) {
        const flecha = document.createElement('span');
        flecha.className = 'catalogo__item-flecha';
        flecha.setAttribute('aria-hidden', 'true');
        flecha.textContent = '›';
        fila.appendChild(flecha);
      }

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
      // El buscador: sin él estos catálogos no
      // se podían filtrar.
      this._pintarBuscador(cont);

      // La barra de navegación del árbol STAC, si se ha bajado a alguna
      // colección. Va fuera de la caja de filas porque el filtro solo repinta las
      // filas y esta barra se tiene que quedar. Se inserta ANTES del buscador
      // (el bloque entero, no el input: el input cuelga de una caja interior y
      // no es hijo directo del gestor — insertBefore con él revienta).
      const barra = this._pintarBarraStac();
      if (barra) {
        const buscador = cont.querySelector('.catalogo__buscador');
        cont.insertBefore(barra, buscador || null);
      }

      // Los avisos que hubiera en el gestor (el "Consultando…" del catálogo
      // remoto) se van al terminar: si no, se quedan escritos encima de la lista
      // ya cargada (medido).
      cont.querySelectorAll(':scope > .catalogo__aviso').forEach(function (a) {
        a.parentNode.removeChild(a);
      });

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
        this._pintarAviso(caja, this._pilaStac.length
          ? 'Esta colección no tiene colecciones ni elementos dentro.'
          : 'Este catálogo todavía no tiene servicios predefinidos.');
        return;
      }
      this._pintarFilasPaginadas(caja, servicios);
    }

    /**
     * Barra de navegación del árbol STAC: el botón de volver y las migas.
     *
     *  Solo se pinta cuando se ha bajado de la raíz. En la raíz no hay a dónde
     *  volver y una fila vacía solo añade ruido.
     * @returns {HTMLElement|null} La barra, o null si se está en la raíz.
     */
    _pintarBarraStac() {
      const self = this;
      if (!this._pilaStac.length) return null;

      const barra = document.createElement('div');
      barra.className = 'catalogo__migas';

      const volver = document.createElement('button');
      volver.type = 'button';
      volver.className = 'catalogo__volver';
      volver.textContent = '← Volver';
      volver.title = 'Volver a ' + (this._pilaStac.length > 1
        ? this._pilaStac[this._pilaStac.length - 2].titulo : 'el catálogo');
      volver.addEventListener('click', function () { self._volverStac(); });

      const ruta = document.createElement('span');
      ruta.className = 'catalogo__migas-ruta';
      ruta.textContent = this._pilaStac.map(function (n) { return n.titulo; }).join('  ›  ');

      barra.appendChild(volver);
      barra.appendChild(ruta);

      // La ficha de la colección en la que se está, que es "lo que tiene ese
      // catálogo". Va fuera de la barra de migas y debajo, porque con los
      // metadatos nuevos (bandas, formatos, extensiones) ya no cabe en una línea.
      const ficha = this._pintarFichaStac(
        this._cacheStac[this._pilaStac[this._pilaStac.length - 1].url]
      );
      if (ficha) barra.appendChild(ficha);
      const nodoActual = this._cacheStac[this._pilaStac[this._pilaStac.length - 1].url];
      const buscadorStac = this._pintarBusquedaStac(nodoActual);
      if (buscadorStac) barra.appendChild(buscadorStac);
      return barra;
    }

    /**
     * La ficha de la colección en la que se está: qué es, cuándo cubre, con qué
     * licencia y quién la publica.
     *
     *  Antes solo enseñaba descripción, cobertura, licencia y número de
     *  elementos, y con ello se desperdiciaba casi todo lo que ya venía en la
     *  respuesta: `providers`, `summaries` (gsd, plataforma, instrumentos,
     *  constelación, DOI) y `eo:bands`. La de Sentinel-2 de Earth Search trae
     *  13 bandas con su longitud de onda y cuatro proveedores, y eso es justo lo
     *  que se va a buscar a un catálogo de satélite.
     *
     * @param {Object} nodo El nodo STAC abierto.
     * @returns {HTMLElement|null}
     */
    _pintarFichaStac(nodo) {
      if (!nodo) return null;
      const self = this;
      const resumenes = nodo.resumenes || {};
      const tieneAlgo = nodo.descripcion || nodo.temporal || nodo.licencia
        || nodo.totalElementos || (nodo.proveedores || []).length
        || (resumenes.resoluciones || []).length || (resumenes.bandas || []).length
        || (nodo.assetsPublicados || []).length;
      if (!tieneAlgo) return null;

      const ficha = document.createElement('div');
      ficha.className = 'catalogo__ficha';

      if (nodo.descripcion) {
        const d = document.createElement('p');
        d.className = 'catalogo__ficha-desc';
        d.textContent = nodo.descripcion;
        ficha.appendChild(d);
      }

      const linea = function (texto) {
        if (!texto) return;
        const p = document.createElement('div');
        p.className = 'catalogo__ficha-datos';
        p.textContent = texto;
        ficha.appendChild(p);
      };

      const primero = [];
      if (nodo.temporal) primero.push('Temporal: ' + nodo.temporal);
      if (nodo.totalElementos) {
        primero.push(nodo.totalElementos.toLocaleString('es-ES') + ' elementos');
      }
      if (nodo.licencia) primero.push('Licencia: ' + nodo.licencia);
      linea(primero.join(' · '));

      if ((nodo.proveedores || []).length) {
        linea('Proveedores: ' + nodo.proveedores.join(', '));
      }

      // Las resoluciones son lo primero que se mira de un catálogo de satélite:
      // si publica 60 m no sirve para lo que te has plantado delante.
      const tecnico = [];
      if ((resumenes.resoluciones || []).length) {
        tecnico.push('Resoluciones: ' + resumenes.resoluciones.join(', ') + ' m/píxel');
      }
      if ((resumenes.plataformas || []).length) {
        tecnico.push('Plataformas: ' + resumenes.plataformas.join(', '));
      }
      if ((resumenes.instrumentos || []).length) {
        tecnico.push('Instrumentos: ' + resumenes.instrumentos.join(', '));
      }
      if (resumenes.constelacion) tecnico.push('Constelación: ' + resumenes.constelacion);
      if (resumenes.doi) tecnico.push('DOI: ' + resumenes.doi);
      linea(tecnico.join(' · '));

      // El encuadre. Solo aparece si la huella dice algo: casi todas las
      // colecciones son mundiales y un botón que lleva al planeta entero es
      // ruido (medido: ocho de las nueve de Earth Search son el mundo entero).
      if (nodo.bbox) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'catalogo__ficha-boton';
        boton.textContent = 'Zoom a la huella';
        boton.title = 'Encuadrar la extensión del catálogo';
        boton.addEventListener('click', function () { self._encuadrarHuella(nodo.bbox); });
        ficha.appendChild(boton);
      }

      // Las bandas y los formatos publicados, plegados: son muchos y estorban
      // si van abiertos, pero son justo lo que se va a mirar antes de cargar.
      const bandas = resumenes.bandas || [];
      const formatos = nodo.assetsPublicados || [];
      const extras = [];
      if (bandas.length) extras.push(bandas.length + (bandas.length === 1 ? ' banda' : ' bandas'));
      if (formatos.length) {
        extras.push(formatos.length + (formatos.length === 1 ? ' formato' : ' formatos'));
      }
      if ((nodo.extensiones || []).length) {
        extras.push(nodo.extensiones.length + ' extensiones');
      }
      if (extras.length) {
        const detalle = document.createElement('details');
        detalle.className = 'catalogo__ficha-mas';
        const resumen = document.createElement('summary');
        resumen.className = 'catalogo__ficha-mas-titulo';
        resumen.textContent = extras.join(' · ');
        detalle.appendChild(resumen);

        if (bandas.length) {
          const lista = document.createElement('ul');
          lista.className = 'catalogo__ficha-bandas';
          bandas.forEach(function (b) {
            const li = document.createElement('li');
            // La longitud de onda viene en micras y lo útil son los nanometros.
            const nm = Number(b.center_wavelength);
            li.textContent = (b.name || b.common_name || '?')
              + (isFinite(nm) && nm ? ' · ' + Math.round(nm * 1000) + ' nm' : '');
            if (b.description) li.title = b.description;
            lista.appendChild(li);
          });
          detalle.appendChild(lista);
        }
        if (formatos.length) {
          const lista = document.createElement('ul');
          lista.className = 'catalogo__ficha-formatos';
          formatos.forEach(function (nombre) {
            const li = document.createElement('li');
            li.textContent = nombre;
            lista.appendChild(li);
          });
          detalle.appendChild(lista);
        }
        if ((nodo.extensiones || []).length) {
          const lista = document.createElement('ul');
          lista.className = 'catalogo__ficha-formatos';
          nodo.extensiones.forEach(function (x) {
            const li = document.createElement('li');
            li.textContent = self._nombreDeExtension(x);
            li.title = String(x);
            lista.appendChild(li);
          });
          detalle.appendChild(lista);
        }
        ficha.appendChild(detalle);
      }

      return ficha;
    }

    /**
     * Dibuja la huella de un elemento en el mapa y la encuadra, o la quita si
     * es el mismo elemento que ya estaba puesto.
     *
     *  Se hace con una capa GeoJSON de la propia API y no pintando en el
     *  OpenLayers a mano, para que funcione igual en 2D y en 3D: el STAC publica
     *  un Polygon GeoJSON y la API sabe construir una capa con él.
     *
     *  Solo una huella a la vez: la anterior se quita antes de poner la nueva.
     *  Encarcarl con veinte escenas de Sentinel-2 encima no dice nada.
     *
     * @param {Object} srv Entrada del catálogo con `bbox` y/o `geometria`.
     * @param {{preview: boolean}} [opciones] Con `preview: true` la huella es
     *   un adelanto al pasar el ratón: se quita al salir y no hace palanca.
     */
    _verHuella(srv, opciones) {
      const map = this._map;
      const api = window.IDEE || window.M;
      const esPreview = !!(opciones && opciones.preview);
      const sinEncuadre = !!(opciones && opciones.sinEncuadre);
      if (!map || !srv) return;
      if (!(api && api.layer && typeof api.layer.GeoJSON === 'function')) {
        this._decir('Este visor no puede dibujar la huella.', 'aviso');
        return;
      }

      // Con palanca: el mismo elemento otra vez es quitarlo. En preview no hay
      // palanca, porque el ratón entra y sale sin parar.
      if (!esPreview) {
        if (this._huellaDe === srv.id || this._huellaDe === srv.nombre) {
          this._quitarHuella();
          this._decir('Huella quitada.');
          return;
        }
        this._quitarHuella();
      } else {
        this._quitarHuellaPreview();
      }

      const geometria = srv.geometria || this._poligonoDe(srv.bbox);
      if (!geometria) {
        this._decir('Este elemento no trae huella.', 'aviso');
        return;
      }

      const nombre = 'Huella: ' + String(srv.nombre || '').slice(0, 48);
      const fuente = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { nombre: srv.nombre || '' },
          geometry: geometria
        }]
      };
      let capa;
      try {
        capa = new api.layer.GeoJSON({ name: nombre, source: fuente });
        // Relleno suave y contorno marcado: una escena de satélite es una
        // cuadrilátero de un par de grados y sin contraste no se ve.
        // En Cesium, además, se extruye el polígono: plano sobre el elipsoide
        // apenas se ve desde un ángulo oblicuo, y con un prisma de 1 km de
        // altura se distingue desde cualquier punto de vista.
        const impl = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null;
        const escena = (impl && impl.scene) ? impl.scene : null;
        const esCesium = !!(escena && escena.camera);
        const opcionesEstilo = {
          polygon: {
            fill: { color: '#1f6feb', opacity: 0.18 },
            stroke: { color: '#1f6feb', width: 2 }
          }
        };
        if (esCesium) opcionesEstilo.polygon.extrudedHeight = 1000;
        if (typeof capa.setStyle === 'function' && api.style && api.style.Generic) {
          capa.setStyle(new api.style.Generic(opcionesEstilo));
        }
      } catch (e) {
        this._decir('No se ha podido crear la capa de la huella: '
          + (e && e.message ? e.message : e), 'error');
        return;
      }

      // En preview se guarda en su propio sitio y no toca la huella fija.
      if (esPreview) {
        this._huellaPreviewDe = srv.id || srv.nombre;
        this._huellaPreviewCapa = capa;
      } else {
        this._huellaDe = srv.id || srv.nombre;
        this._huellaCapa = capa;
      }
      try {
        map.addLayers([capa]);
      } catch (e) {
        this._decir('No se ha podido dibujar la huella: '
          + (e && e.message ? e.message : e), 'error');
        if (esPreview) this._quitarHuellaPreview();
        else this._quitarHuella();
        return;
      }
      if (srv.bbox && !sinEncuadre) this._encuadrarHuella(srv.bbox);
    }

    /**
     * Quita la huella de preview, la que se muestra al pasar el ratón por encima
     * del botón sin llegar a hacer clic.
     *
     *  No toca la huella fija (la de `_huellaCapa`), que es la que se queda en el
     *  mapa cuando se pulsa el botón.
     */
    _quitarHuellaPreview() {
      const capa = this._huellaPreviewCapa;
      this._huellaPreviewCapa = null;
      this._huellaPreviewDe = null;
      if (!capa) return;
      const map = this._map;
      if (!map || typeof map.removeLayers !== 'function') return;
      try { map.removeLayers(capa); } catch (e) { /* ya no está */ }
    }

    /**
     * Un Polygon GeoJSON a partir de un rectángulo en grados.
     *
     *  Para los elementos que solo traen `bbox` y no `geometry`, que también los
     *  hay: el rectángulo del STAC es un polígono con cuatro esquinas.
     *
     * @param {Array<number>} bbox [oeste, sur, este, norte].
     * @returns {Object|null}
     */
    _poligonoDe(bbox) {
      if (!Array.isArray(bbox) || bbox.length < 4) return null;
      const [o, s, e, n] = bbox.map(Number);
      if (![o, s, e, n].every(isFinite)) return null;
      return {
        type: 'Polygon',
        coordinates: [[[o, s], [e, s], [e, n], [o, n], [o, s]]]
      };
    }

    /**
     * Quita la huella del mapa, si la hay.
     *
     *  Va en `destroy()`: si no, al cerrar el plugin la capa se queda en el mapa
     *  sin ningún panel desde el que quitarla. Quita también la de preview.
     */
    _quitarHuella() {
      this._quitarHuellaPreview();
      const capa = this._huellaCapa;
      this._huellaCapa = null;
      this._huellaDe = null;
      if (!capa) return;
      const map = this._map;
      if (!map || typeof map.removeLayers !== 'function') return;
      try { map.removeLayers(capa); } catch (e) { /* ya no está */ }
    }

    /**
     * El rectángulo que se está viendo ahora, en grados (EPSG:4326).
     *
     *  Es el filtro de zona que se le pasa a la API: "dame lo que hay donde
     *  estoy mirando". En 2D sale de la vista de OpenLayers, que sí es un
     *  rectángulo. En Cesium la cámara no lo es (mira al punto de vista con
     *  inclinación), así que se devuelve null y el buscador se queda solo con
     *  las fechas en vez de inventar una zona.
     *
     * @returns {Array<number>|null} [oeste, sur, este, norte].
     */
_vistaActualEnGrados() {
      const map = this._map;
      if (!map || typeof map.getMapImpl !== 'function') return null;
      const impl = map.getMapImpl();
      // En Cesium la cámara mira a un punto y puede ir inclinada: no es un
      // rectángulo, así que de aquí no sale una zona. Se distingue por `scene`,
      // que el impl de OpenLayers no tiene.
      if (!impl || impl.scene) return null;
      const vista = (typeof impl.getView === 'function') ? impl.getView() : null;
      const tam = (typeof impl.getSize === 'function') ? impl.getSize() : null;
      if (!vista || typeof vista.calculateExtent !== 'function' || !tam) return null;
      const api = window.IDEE || window.M;
      if (!(api && api.utils && typeof api.utils.reproject === 'function')) return null;

      let caja = null;
      try { caja = vista.calculateExtent(tam); } catch (e) { return null; }
      if (!caja || caja.length < 4) return null;

      let esquinaA = null;
      let esquinaB = null;
      try {
        esquinaA = api.utils.reproject([caja[0], caja[1]], 'EPSG:3857', 'EPSG:4326');
        esquinaB = api.utils.reproject([caja[2], caja[3]], 'EPSG:3857', 'EPSG:4326');
      } catch (e) { return null; }
      if (!esquinaA || !esquinaB) return null;

      // La proyección web se desboca en los polos: un encuadre casi mundial da
      // latitudes enormes y la API las rechaza, así que se recortan a 85.
      const Recorta = function (v) { return Math.max(-85, Math.min(85, v)); };
      const salida = [esquinaA[0], Recorta(esquinaA[1]), esquinaB[0], Recorta(esquinaB[1])];
      return salida.every(Number.isFinite) ? salida : null;
    }

    /**
     * El formulario de buscar elementos por zona y por fecha.
     *
     *  Solo tiene sentido en las colecciones de una API STAC, que son las que
     *  tienen endpoint `/items` al que preguntarle (lo publica `leerNodoStac`
     *  como `urlItems`). En un catálogo estático no hay nada que filtrar.
     *
     * @param {Object} nodo El nodo STAC abierto.
     * @returns {HTMLElement|null}
     */
    _pintarBusquedaStac(nodo) {
      if (!nodo || !nodo.urlItems) return null;
      const self = this;
      const api = window.IDEE || window.M;
      if (!(api && api.layer && typeof api.layer.GeoJSON === 'function')) return null;

      const caja = document.createElement('div');
      caja.className = 'catalogo__buscador-stac';

      const filtro = this._filtroStac || {};
      const zonaDisponible = !!this._vistaActualEnGrados();

      const linea = document.createElement('div');
      linea.className = 'catalogo__buscador-stac-linea';

      // Vive fuera del `if` porque lo usa el manejador del botón Buscar, que
      // se crea más abajo y en otro bloque.
      let chk = null;
      if (zonaDisponible) {
        chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'catalogo__buscador-stac-chk';
        chk.id = 'catalogo-stac-zona';
        chk.checked = !!filtro.bbox;
        linea.appendChild(chk);
        const lblZona = document.createElement('label');
        lblZona.className = 'catalogo__buscador-stac-lbl';
        lblZona.setAttribute('for', chk.id);
        lblZona.textContent = 'Solo en la vista';
        lblZona.title = 'Limitar a lo que hay en el rectángulo que se está viendo ahora';
        linea.appendChild(lblZona);
      } else {
        const aviso = document.createElement('span');
        aviso.className = 'catalogo__buscador-stac-lbl';
        aviso.textContent = 'La zona no se puede acotar en 3D';
        aviso.title = 'En Cesium la cámara no es un rectángulo: '
          + 'el filtro de zona solo va en la vista 2D.';
        linea.appendChild(aviso);
      }

      const rotulo = function (texto, valor) {
        const campo = document.createElement('label');
        campo.className = 'catalogo__buscador-stac-campo';
        const t = document.createElement('span');
        t.textContent = texto;
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'catalogo__buscador-stac-fecha';
        input.value = valor || '';
        campo.appendChild(t);
        campo.appendChild(input);
        return { campo: campo, input: input };
      };
      const desde = rotulo('desde', filtro.desde);
      const hasta = rotulo('hasta', filtro.hasta);
      linea.appendChild(desde.campo);
      linea.appendChild(hasta.campo);

      const buscar = document.createElement('button');
      buscar.type = 'button';
      buscar.className = 'catalogo__ficha-boton';
      buscar.textContent = 'Buscar';
      linea.appendChild(buscar);

      if (filtro.activo) {
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'catalogo__ficha-boton';
        quitar.textContent = 'Quitar filtro';
        quitar.addEventListener('click', function () { self._limpiarBusquedaStac(nodo); });
        linea.appendChild(quitar);
      }
      caja.appendChild(linea);

      if (filtro.activo) {
        const resumen = document.createElement('div');
        resumen.className = 'catalogo__ficha-datos';
        const trozos = [];
        if (filtro.bbox) {
          trozos.push('zona ' + filtro.bbox.map(function (v) {
            return v.toFixed(2);
          }).join(', '));
        }
        if (filtro.desde || filtro.hasta) {
          trozos.push('entre ' + (filtro.desde || '…') + ' y ' + (filtro.hasta || '…'));
        }
        let cuenta = '';
        if (filtro.total) {
          cuenta = filtro.total.toLocaleString('es-ES') + ' elementos';
        }
        resumen.textContent = (trozos.join(' · ') + (cuenta ? ' · ' + cuenta : ''));
        caja.appendChild(resumen);
      }

      buscar.addEventListener('click', function () {
        const activa = zonaDisponible && chk && chk.checked;
        const cajaVista = activa ? self._vistaActualEnGrados() : null;
        if (activa && !cajaVista) {
          self._decir('No se ha podido leer la zona que se está viendo.', 'aviso');
          return;
        }
        const d = desde.input.value || '';
        const h = hasta.input.value || '';
        if (!cajaVista && !d && !h) {
          self._decir('Marca la zona o pon alguna fecha: sin eso no se filtra nada.', 'aviso');
          return;
        }
        if (d && h && d > h) {
          self._decir('La fecha inicial es posterior a la final.', 'aviso');
          return;
        }
        self._aplicarBusquedaStac(nodo, { bbox: cajaVista, desde: d, hasta: h });
      });

      return caja;
    }

    /**
     * Pide a la API los elementos que casan con el filtro y los deja en la lista.
     *
     *  Se reescribe la lista entera y el enlace a la página siguiente, que es lo
     *  que hace que "Siguiente" siga dentro del filtro y no se salga de él.
     *
     * @param {Object} nodo El nodo STAC abierto.
     * @param {{bbox: (Array<number>|null), desde: string, hasta: string}} filtro
     */
    _aplicarBusquedaStac(nodo, filtro) {
      const self = this;
      const registro = window.CatalogoRegistro;
      if (!nodo || !nodo.urlItems) return;
      if (!registro || typeof registro.leerBusquedaStac !== 'function') {
        this._decir('No se puede buscar: falta el lector STAC.', 'aviso');
        return;
      }
      const estado = this._paginacionStac[nodo.url];
      if (estado) estado.cargando = true;
      this._decir('Buscando elementos…');

      registro.leerBusquedaStac(nodo.urlItems, filtro).then(function (r) {
        const tipo = self._catalogoActual();
        const cache = (tipo && self._entradasPropias[tipo.id]) || null;
        const nuevas = (r && r.entradas) || [];
        if (cache && Array.isArray(cache.datos)) {
          cache.datos = nuevas.map(function (e) {
            return Object.assign({}, e, { padre: nodo.url });
          });
        }
        if (estado) {
          estado.cargando = false;
          estado.siguiente = (r && r.siguiente) || null;
          estado.cargados = nuevas.length;
        }
        self._filtroStac = Object.assign({}, filtro, { activo: true, total: (r && r.total) || 0 });
        self._pagina = 1;
        self._pintarCatalogo();
        self._decir(nuevas.length
          ? 'Hay ' + nuevas.length + ' elementos con ese filtro.'
          : 'No hay ningún elemento con ese filtro.');
      }).catch(function (err) {
        if (estado) estado.cargando = false;
        self._decir('No se ha podido buscar: '
          + (err && err.message ? err.message : err), 'error');
        self._pintarCatalogo();
      });
    }

    /**
     * Quita el filtro y vuelve a la lista sin filtrar de la colección.
     *
     *  Se borra el nodo de la caché y se vuelve a entrar: es lo que garantiza
     *  que lo que se repinta es la colección entera y no el resultado de la
     *  última búsqueda.
     *
     * @param {Object} nodo El nodo STAC abierto.
     */
    _limpiarBusquedaStac(nodo) {
      this._filtroStac = null;
      this._pagina = 1;
      if (nodo) {
        delete this._cacheStac[nodo.url];
        delete this._paginacionStac[nodo.url];
        this._abrirNodoStac(nodo.url, nodo.titulo);
        return;
      }
      this._pintarCatalogo();
    }

    /**
     * El nombre corto de una extensión STAC, que es la URL que la publica.
     *
     *  Las extensiones son direcciones largas del tipo
     *  `https://stac-extensions.github.io/eo/v2.0.0/schema.json`, y quedarse con
     *  el último trozo las deja a todas en "schema.json", que no dice nada
     *  (medido: las cinco de la colección de Sentinel-2). Lo que identifica una
     *  extensión es el segmento anterior al de la versión, así que se busca el
     *  último que no sea una versión.
     *
     * @param {string} url
     * @returns {string}
     */
    _nombreDeExtension(url) {
      const trozos = String(url || '').split('/').filter(Boolean);
      if (trozos.length < 2) return String(url || '');
      // Se quita el nombre de fichero, que en todas es `schema.json`.
      const cuerpo = trozos.slice(0, -1);
      const esVersion = function (t) {
        const s = String(t || '');
        if (!s.length) return false;
        if (s.charAt(0) >= '0' && s.charAt(0) <= '9') return true;
        // La forma `v1.0.0` y `v2`: una letra y enseguida un número.
        return (s.charAt(0) === 'v' || s.charAt(0) === 'V')
          && s.length > 1 && s.charAt(1) >= '0' && s.charAt(1) <= '9';
      };
      for (let i = cuerpo.length - 1; i >= 0; i--) {
        if (!esVersion(cuerpo[i])) return cuerpo[i];
      }
      return cuerpo[cuerpo.length - 1];
    }

    /**
     * Encuadra una huella en el mapa, en 2D o en 3D.
     *
     *  El STAC publica su `bbox` en grados (EPSG:4326) siempre, así que aquí no
     *  hay que adivinar de dónde viene: para OpenLayers se reproyecta y se
     *  encuadra la vista, y para Cesium se vuela la cámara al rectángulo.
     *
     * @param {Array<number>} bbox [oeste, sur, este, norte] en EPSG:4326.
     */
    _encuadrarHuella(bbox) {
      const map = this._map;
      if (!map || !Array.isArray(bbox) || bbox.length < 4) return;
      const impl = (typeof map.getMapImpl === 'function') ? map.getMapImpl() : null;
      // El impl de Cesium trae `scene` y el de OpenLayers, no: es lo que los
      // distingue sin preguntar por la versión de la API.
      const escena = (impl && impl.scene) ? impl.scene : null;

      if (escena && escena.camera) {
        const C = window.Cesium;
        if (!C || !C.Rectangle) {
          this._decir('No se puede mover la cámara en esta implementación.', 'aviso');
          return;
        }
        try {
          escena.camera.flyTo({
            destination: C.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]),
            duration: 1.2
          });
        } catch (e) {
          this._decir('No se ha podido encuadrar la huella.', 'error');
        }
        return;
      }

      const vista = (impl && typeof impl.getView === 'function') ? impl.getView() : null;
      if (!vista || typeof vista.fit !== 'function') {
        this._decir('No se puede encuadrar la huella en esta implementación.', 'aviso');
        return;
      }
      const api = window.IDEE || window.M;
      if (!(api && api.utils && typeof api.utils.reproject === 'function')) {
        this._decir('No se ha podido convertir la huella a coordenadas del mapa.', 'aviso');
        return;
      }
      let oeste, este;
      try {
        oeste = api.utils.reproject([bbox[0], bbox[1]], 'EPSG:4326', 'EPSG:3857');
        este = api.utils.reproject([bbox[2], bbox[3]], 'EPSG:4326', 'EPSG:3857');
      } catch (e) {
        this._decir('No se ha podido convertir la huella a coordenadas del mapa.', 'error');
        return;
      }
      try {
        vista.fit([oeste[0], oeste[1], este[0], este[1]], {
          padding: [48, 48, 48, 48], maxZoom: 17, duration: 350
        });
      } catch (e) {
        this._decir('No se ha podido encuadrar la huella.', 'error');
      }
    }

    /**
     * Entra en una colección STAC y pinta lo que contiene en el MISMO sitio.
     *
     *  La lista se guarda en el mismo hueco que la del catálogo (`_entradasPropias`),
     *  así que el buscador, el recuento y el filtrado siguen funcionando sin
     *  tocar nada: bajando a un nodo no cambia cómo se ve, cambia qué hay.
     *
     * @param {string} url Documento STAC al que entrar.
     * @param {string} titulo Nombre para las migas.
     */
    _abrirNodoStac(url, titulo) {
      const self = this;
      const tipo = this._catalogoActual();
      if (!tipo) return;
      const registro = window.CatalogoRegistro;
      if (!registro || typeof registro.leerNodoStac !== 'function') {
        this._decir('No se puede navegar por este catálogo: falta el lector STAC.', 'aviso');
        return;
      }
      if (this._pilaStac.length) {
        this._decir('Abriendo «' + titulo + '»…');
      }

      const cache = this._entradasPropias[tipo.id] || (this._entradasPropias[tipo.id] = {});
      const yaEsta = this._cacheStac[url];
      // El filtro es de un nodo: al entrar en otro se olvida, que los filtros no
      // tienen sentido entre colecciones distintas.
      this._filtroStac = null;

      const pintar = function (nodo) {
        self._cacheStac[url] = nodo;
        cache.datos = (nodo.entradas || []).map(function (e) {
          return Object.assign({}, e, { nombre: e.nombre, padre: nodo.url });
        });
        // Estado de paginación de esta colección: cuántas entradas hay cargadas
        // y dónde está la página siguiente (si la API la publica).
        self._paginacionStac[nodo.url] = {
          url: nodo.url,
          cargados: cache.datos.length,
          siguiente: nodo.urlItemsSiguiente || null,
          cargando: false
        };
        self._pintarCatalogo();
        if ((self._filtro || '').trim()) self._repintarLista();
      };

      if (yaEsta) {
        this._pilaStac.push({ url: url, titulo: titulo });
        pintar(yaEsta);
        return;
      }

      cache.promesa = registro.leerNodoStac(url).then(function (nodo) {
        cache.promesa = null;
        self._pilaStac.push({ url: url, titulo: titulo });
        self._pagina = 1;
        pintar(nodo);
        return nodo;
      }).catch(function (err) {
        cache.promesa = null;
        self._decir('No se ha podido abrir «' + titulo + '»: '
          + (err && err.message ? err.message : err), 'error');
      });
    }

    /**
     * Repinta la vista que toca con el paginador: las secciones del catálogo de
     * la IDEE o la lista plana de los remotos (STAC, OGC API Records).
     *
     * El paginador se crea en los dos sitios, así que el botón tenía que saber
     * a cuál volver. Antes iba siempre a _filtrarSecciones() y el "Anterior" de
     * la lista de un STAC no hacía nada (medido).
     */
    _repintarVista() {
      const tipo = this._catalogoActual();
      if (tipo && this._listaEl && document.contains(this._listaEl)) {
        this._repintarLista();
        return;
      }
      this._filtrarSecciones();
    }

    /**
     * El estado de paginación de la colección STAC a la que pertenece una
     * sección, si esa sección viene de una API STAC.
     *
     * Se localiza por el `padre` que llevan las entradas de la colección, que es
     * la URL del nodo STAC (ver _abrirNodoStac).
     *
     * @param {Object} datos
     * @returns {Object|null}
     */
    _siguienteStacDe(datos) {
      const servicios = [];
      if (Array.isArray(datos)) {
        servicios.push.apply(servicios, datos);
      } else if (datos && Array.isArray(datos.familias)) {
        for (let i = 0; i < datos.familias.length; i++) {
          (datos.familias[i].servicios || []).forEach(function (s) { servicios.push(s); });
        }
      }
      for (let i = 0; i < servicios.length; i++) {
        const padre = servicios[i] && servicios[i].padre;
        if (padre && this._paginacionStac[padre]) return this._paginacionStac[padre];
      }
      return null;
    }

    /**
     * Pinta las filas de una lista plana, paginadas de TAMANIO_PAGINA en
     * TAMANIO_PAGINA, con el paginador arriba y abajo.
     *
     * Las listas de los catálogos remotos (STAC y OGC API Records) enseñan
     * TODO lo que hay cargado, que en una colección de satélite son ya 50
     * escenas de Sentinel-2; de ahí que paginar. Y si la colección publica más
     * páginas, el paginador lo pide en vez de quedarse en el final.
     *
     * @param {HTMLElement} caja Contenedor ya vacío.
     * @param {Array<Object>} servicios La lista, ya filtrada si hay filtro.
     * @returns {number} Cuántas filas se han pintado.
     */
    _pintarFilasPaginadas(caja, servicios) {
      const self = this;
      const total = servicios.length;
      if (!total) return 0;

      const remoto = this._siguienteStacDe(servicios);
      const hayMas = !!(remoto && remoto.siguiente);
      const paginas = Math.max(1, Math.ceil(total / TAMANIO_PAGINA));
      // Con más páginas en el servidor se permite una página más allá de las
      // cargadas: es la que está pidiendo el botón.
      if (this._pagina > paginas && !hayMas) this._pagina = paginas;
      if (this._pagina < 1) this._pagina = 1;

      const desde = (this._pagina - 1) * TAMANIO_PAGINA;
      const visibles = servicios.slice(desde, desde + TAMANIO_PAGINA);

      if (paginas > 1 || hayMas) {
        caja.appendChild(this._crearPaginador(paginas, total, false, servicios));
      }
      visibles.forEach(function (srv) {
        caja.appendChild(self._filaServicio(srv, { tipo: srv.tipo || null }));
      });
      if (paginas > 1 || hayMas) {
        caja.appendChild(this._crearPaginador(paginas, total, false, servicios));
      }
      return visibles.length;
    }

    /**
     * Pide la página siguiente de una colección STAC y la suma a la lista.
     *
     * Una colección de una API STAC puede tener millones de elementos: la de
     * Sentinel-2 de Earth Search declara 51.678.748 (medido), así que no cabe
     * ni de broma. Se pide una página, y para seguir hay que seguir el enlace
     * `rel="next"` que publica la API, cuyo token va en la URL (medido).
     *
     * @param {Object} datos La sección que se está pintando.
     */
    _pedirMasStac(datos) {
      const estado = this._siguienteStacDe(datos);
      if (!estado || !estado.siguiente || estado.cargando) return;
      const registro = window.CatalogoRegistro;
      if (!registro || typeof registro.leerPaginaStac !== 'function') {
        this._decir('No se puede pedir la página siguiente: falta el lector STAC.', 'aviso');
        return;
      }
      estado.cargando = true;
      const destino = this._pagina + 1;
      this._repintarLista();

      registro.leerPaginaStac(estado.siguiente).then((pagina) => {
        const tipo = this._catalogoActual();
        const cache = (tipo && this._entradasPropias[tipo.id]) || null;
        const nuevas = (pagina && pagina.entradas) || [];
        if (cache && Array.isArray(cache.datos)) {
          cache.datos = cache.datos.concat(nuevas.map(function (e) {
            return Object.assign({}, e, { padre: estado.url });
          }));
        }
        estado.cargando = false;
        estado.siguiente = (pagina && pagina.siguiente) || null;
        estado.cargados += nuevas.length;
        // Se avanza a la página que se ha pedido: si no, el botón parecería
        // que no hace nada, porque lo nuevo cae fuera de la ventana actual.
        this._pagina = destino;
        this._pintarCatalogo();
        if ((this._filtro || '').trim()) this._repintarLista();
      }).catch((err) => {
        estado.cargando = false;
        this._decir('No se ha podido pedir la página siguiente: '
          + (err && err.message ? err.message : err), 'error');
        this._repintarLista();
      });
    }

    /**
     * Sube un nivel en el árbol STAC.
     *
     *  No vuelve a pedir nada: los nodos ya visitados están en _cacheStac, que
     *  es justo para que subir y bajar sea instantáneo.
     */
    _volverStac() {
      const tipo = this._catalogoActual();
      if (!tipo || !this._pilaStac.length) return;
      this._pilaStac.pop();
      const actual = this._pilaStac.length
        ? this._pilaStac[this._pilaStac.length - 1]
        : null;

      const cache = this._entradasPropias[tipo.id] || (this._entradasPropias[tipo.id] = {});
      const nodo = actual ? this._cacheStac[actual.url] : null;

      if (nodo) {
        cache.datos = nodo.entradas || [];
      } else if (this._raizStac) {
        cache.datos = this._raizStac;
      } else {
        // Ni la raíz ni un nodo padre: no hay de dónde volver. Se borra lo que
        // había en memoria y se vuelve a leer el catálogo, que es lo único que
        // devuelve al usuario a la raíz en vez de dejarlo encerrado en la
        // colección en la que estaba.
        delete cache.datos;
        delete cache.promesa;
        this._pintarCatalogo();
        return;
      }
      this._pintarCatalogo();
      if ((this._filtro || '').trim()) this._repintarLista();
    }

    /** Olvida la navegación: se llama al cambiar de catálogo. */
    _resetPilaStac() {
      this._pilaStac = [];
      this._cacheStac = {};
      this._raizStac = null;
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
      this._pintarFilasPaginadas(caja, servicios);
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
      const urlTool = window.CatalogoURL;
      // Un `s3://cubo/ruta` no es una URL que entienda un navegador: se consume en
      // su forma HTTPS de S3 antes de pasar por la puerta de http(s). Ver
      // httpDeS3 en catalogo_url.js y el comentario de CORS que hay ahí.
      const crudo = String((input && input.value) || '').trim();
      const url = (urlTool && typeof urlTool.httpDeS3 === 'function')
        ? urlTool.httpDeS3(crudo) : crudo;

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
        // Si el motivo es CORS, además se dice en alto con el toast de la API:
        // el cuadro de estado está dentro del panel, que igual ni está abierto.
        if (self._esFalloCors(err)) self._avisoCors(err, url);
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
    async _cargarDesdeAnalisis() {
      const self = this;
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
        // La carga puede fallar en diferido (por CORS) y ahora se espera: ese
        // error se atrapa aquí, no en ningún sitio.
        const capas = await tipoActual.cargarUrl(info.url, this._map, {
          tipo: info.tipo,
          capas: info.elegidas,
          nombre: info.nombre
        });
        const cuantas = (capas && capas.length) || 0;
        this._decir('Cargada' + (cuantas > 1 ? 's ' + cuantas + ' capas' : '') + ': ' + info.nombre);
      } catch (err) {
        this._decir('No se ha podido cargar: ' + (err && err.message ? err.message : err), 'error');
        // El CORS se avisa en alto, además de en el cuadro de estado.
        if (self._esFalloCors(err)) self._avisoCors(err, info.url);
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

      urlTool.leerCapas(srv.url, tipo).then(async function (info) {
        if (!info.capas || info.capas.length <= 1) {
          const cargador = self._catalogoActual();
          if (!cargador) return;
          try {
            // Igual que arriba: la carga espera, y un fallo por CORS se atrapa aquí.
            const creadas = await cargador.cargarUrl(srv.url, self._map, {
              tipo: info.tipo || tipo,
              capas: (info.capas || []).map(function (c) { return c.id; }),
              nombre: srv.nombre
            });
            const cuantas = (creadas && creadas.length) || 0;
            self._decir('Cargada' + (cuantas > 1 ? 's ' + cuantas + ' capas' : '') + ': ' + srv.nombre);
          } catch (err) {
            self._decir('No se ha podido cargar: ' +
              (err && err.message ? err.message : err), 'error');
            if (self._esFalloCors(err)) self._avisoCors(err, srv.url);
          }
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
        // Igual que arriba: el CORS se avisa en alto, no solo en el cuadro.
        if (self._esFalloCors(err)) self._avisoCors(err, srv.url);
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

    // ── Aviso de CORS ──────────────────────────────────────────────────────
    // Cuando una capa no se puede cargar porque el servidor no manda
    // Access-Control-Allow-Origin, el mensaje del cuadro de estado se queda
    // corto: no dice que el fallo es del navegador y no de la URL, que es lo
    // que diferencia un CORS de una URL mal escrita o un servicio caído.
    //
    // Para eso está el toast de la API (IDEE.toast.error), que es lo que se ve
    // sin tener que abrir el panel del catálogo. Medido:
    //   · IDEE.toast.error(mensaje, orden, duracionEnMilisegundos).
    //   · Con duracion=1 no se llega a ver: hacen falta milisegundos de verdad.
    //   · Sale como <div class="m-toast error"> dentro del contenedor de la API.

    /** ¿El fallo es de CORS? */
    _esFalloCors(err) {
      const texto = String((err && err.message) || err || '');
      return /cors/i.test(texto) || /no ha podido leer/i.test(texto) ||
             /failed to fetch/i.test(texto) || /^s3:\/\//i.test(texto);
    }

    /**
     * Avisa en alto, con el toast de la API, de que una capa no se pudo cargar
     * por CORS. No hace nada si el visualizador no trae el toast.
     *
     * @param {Error|string} err
     * @param {string} [url] La URL en cuestión, para que se vea de qué se trata.
     * @returns {boolean} true si se pudo enseñar el toast.
     */
    _avisoCors(err, url) {
      const api = (window.IDEE && window.IDEE.toast && window.IDEE.toast.error) ? window.IDEE
        : (window.M && window.M.toast && window.M.toast.error) ? window.M : null;
      if (!api) return false;
      const texto = 'No se puede cargar la capa: ese servidor no permite leerlo ' +
        'desde el navegador (no manda cabeceras CORS).';
      try {
        api.toast.error(texto + (url ? '  URL: ' + url : ''), 5, 9000);
      } catch (e) {
        return false;
      }
      return true;
    }

    // ── Item del supraplugin: el boton vive en la barra, el panel en el mapa ──
    // Colgado con `supra.addItem(this)`, la barra pone aqui el boton y el panel
    // sigue siendo el que `addTo(map)` coloca en el mapa: la barra solo cambia
    // donde esta el mando. Por eso el boton redondo que la API pinta en el area
    // (BUTTON.m-panel-btn) se esconde, para no dejar dos puertas al mismo panel.
    //
    // El boton reutiliza las clases de la barra (supra-bar__boton y las suyas) a
    // proposito: hereda solos el tema claro/oscuro y el color de marca por las
    // variables --supra-*, sin duplicar aqui la paleta.
    getSupraElement(supra) {
      this.supra = supra || null;
      this._supraWrap = this._construirSupraUI();
      this._ocultarBotonDelMapa();
      this._sincronizarSupra();
      this._iconoEnBarra();
      return this._supraWrap;
    }

    // El icono propio del plugin (--g-plugin-icon-mask, el mismo que pinta su
    // boton del mapa) se lleva tambien al boton de la barra. Sin icono propio se
    // queda el glifo de la fuente de la API que pone catalogo.css.
    _iconoEnBarra() {
      if (!this.icon || !this._supraBoton) return;
      const url = urlDeIcono(this.icon);
      if (!url) return;
      try {
        this._supraBoton.style.setProperty('--g-plugin-icon-mask', url);
        const icono = this._supraBoton.querySelector('.catalogo-supra__icono');
        if (icono) icono.classList.add('catalogo-supra__icono--mascara');
      } catch (e) {
        console.warn(this.name + ': no se pudo aplicar el icono en la barra.', e);
      }
    }

    // Construye el boton de la barra. Devuelve el nodo raiz que se mete en la
    // ranura del item.
    _construirSupraUI() {
      const self = this;
      const wrap = document.createElement('div');
      wrap.className = 'catalogo-supra__wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'supra-bar__boton catalogo-supra__boton';
      btn.title = (this.options.tituloBarra || 'Catalogo');
      btn.setAttribute('aria-expanded', 'false');

      const icono = document.createElement('span');
      icono.className = 'supra-bar__boton-icono catalogo-supra__icono';
      icono.setAttribute('aria-hidden', 'true');

      const texto = document.createElement('span');
      texto.className = 'supra-bar__boton-texto';
      texto.textContent = (this.options.tituloBarra || 'Catalogo');

      btn.appendChild(icono);
      btn.appendChild(texto);
      btn.addEventListener('click', function (evt) {
        evt.preventDefault();
        // El gesto se queda aqui: la API registra un cierre de paneles al pulsar
        // fuera, y el click se propagaria hasta el suyo.
        evt.stopPropagation();
        self._alternarPanelDesdeBarra();
      });

      wrap.appendChild(btn);
      this._supraBoton = btn;

      // El panel tambien se pliega desde fuera (la API lo cierra al pulsar fuera),
      // asi que el boton se resincroniza en cada clic del documento. Va en fase de
      // captura para que lo vea aunque alguien detenga la propagacion.
      if (!this._syncDoc && typeof document !== 'undefined') {
        this._syncDoc = function () { self._sincronizarSupra(); };
        document.addEventListener('click', this._syncDoc, true);
      }

      return wrap;
    }

    // Abre el panel si esta plegado y lo pliega si esta abierto.
    _alternarPanelDesdeBarra() {
      if (!this._panel) return;
      try {
        if (this._panelColapsado()) this._panel.open();
        else this._panel.collapse();
      } catch (e) {
        console.warn('[miPlugin_catalogo] no se pudo alternar el panel:', e);
      }
      this._sincronizarSupra();
    }

    // ¿Esta el panel plegado? Misma cadena de recursos que usa getState(), para
    // que el boton y el estado guardado no se contradigan.
    _panelColapsado() {
      if (!this._panel) return true;
      if (this._panel._collapsed !== undefined) return !!this._panel._collapsed;
      if (typeof this._panel.isCollapsed === 'function') {
        try { return !!this._panel.isCollapsed(); } catch (e) { /* sigue */ }
      }
      if (typeof this._panel.getElement === 'function') {
        const el = this._panel.getElement();
        return el ? el.classList.contains('collapsed') : true;
      }
      return true;
    }

    _sincronizarSupra() {
      if (!this._supraBoton) return;
      const abierto = !this._panelColapsado();
      this._supraBoton.classList.toggle('supra-bar__boton--activo', abierto);
      this._supraBoton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    }

    // Esconde el boton propio de la API mientras el plugin viva en la barra.
    _ocultarBotonDelMapa() {
      const el = this._elementoPanel();
      if (el) el.classList.add('g-panel-en-barra');
    }

    // Restaura el boton de la API y suelta el boton de la barra.
    _destruirSupra() {
      if (this._syncDoc && typeof document !== 'undefined') {
        document.removeEventListener('click', this._syncDoc, true);
      }
      this._syncDoc = null;
      const el = this._elementoPanel();
      if (el) el.classList.remove('g-panel-en-barra');
      if (this._supraWrap && this._supraWrap.parentNode) {
        this._supraWrap.parentNode.removeChild(this._supraWrap);
      }
      this._supraWrap = null;
      this._supraBoton = null;
      this.supra = null;
    }

    // El nodo del panel, por el camino que lo fue la API.
    _elementoPanel() {
      try {
        return (this._panel && typeof this._panel.getElement === 'function')
          ? this._panel.getElement() : null;
      } catch (e) {
        return null;
      }
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
      this._sincronizarSupra();
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
      this._destruirSupra();
      // Antes de soltar el mapa: la huella es una capa viva y si no se quita
      // aquí se queda en el mapa sin ningún panel desde el que quitarla.
      this._quitarHuella();
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
