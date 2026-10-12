/* =====================================================================
   CatalogoIDEE: cliente del catálogo de servicios de la IDEE
   ---------------------------------------------------------------------
   Adaptación a JavaScript del complemento de QGIS serviciosIDEE2QGIS
   (https://github.com/IngenieroGeomatico/serviciosIDEE2QGIS), que es la
   referencia de este tipo de catálogo.

   El complemento python NO lleva la lista de servicios escrita a mano: la
   pide al portal de la IDEE, sección por sección, y parsea el JSON que
   devuelve. Eso mismo hace este fichero.

   Las diez secciones del portal y sus identificadores:

     supVisWmsEst   WMS de la Administración General del Estado
     supVisWmsAut   WMS de las comunidades autónomas
     supVisWmsLoc   WMS locales (ayuntamientos, ...)
     supVisWmsPV    WMS de planos verticales
     sup-vis-wmts   WMTS
     sup-vis-rts    XYZ / Raster Tile Service
     sup-vis-vts    Vector Tiles (MVT)
     sup-des-wfs    WFS
     sup-des-wcs    WCS
     sup-ogc-api    OGC API

   Todas comparten la misma base y el mismo parámetro de acción, que es lo que
   hace que el portal devuelva SOLO la tabla de esa sección:

     ?p_p_id=es_igncnig_dirserv72_DirectorioServiciosPortlet_INSTANCE_<token>
      &p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage
      &_es_..._id=<seccion>&_es_..._actionName=cargaTablaSrv

   El token de instancia es público (lo trae el propio portal en su HTML) y no
   es un secreto. Si el portal lo cambiara, solo habría que tocar INSTANCE_TOKEN.

   La respuesta tiene esta forma:

     { "datos": { "est": [...], "aut": [...], "loc": [...], "pve": [...] } }

   donde cada elemento es una FAMILIA (un organismo proveedoror) con sus
   organizaciones y dentro los servicios:

     { name: "IDEE", tot: 14, id: "OGE-8", listorg: [
         { listserv: [ { capa: "...?request=GetCapabilities&service=WMS",
                         name: "Potencial solar",
                         url: "...",
                         id: "SRV-...",
                         clase: "contenidoClaro" } ] } ] }

   Ojo con dos detalles que ya están resueltos aquí porque en el JSON aparecen
   las dos formas:

     - unas familias traen `listorg` (organizaciones, con `listserv` dentro) y
       otras traen `listserv` directamente. Se leen las dos.
     - hay cuatro claves (est/aut/loc/pve) en casi todas las secciones, aunque
       la sección servida sea solo una. Se concatenan todas.

   ===================================================================== */
(function () {
  'use strict';

  /** Token de instancia del portal de la IDEE (público, no es un secreto). */
  const INSTANCE_TOKEN = 'YZFuNrhnVi4f';

  /** Base del portal donde vive el catálogo. */
  const BASE_CATALOGO =
    'https://www.idee.es/web/idee/segun-tipo-de-servicio';

  /** Página del catálogo, por si se quiere abrir en el navegador. */
  const PAGINA_CATALOGO = 'https://www.idee.es/segun-tipo-de-servicio';

  /**
   * Las diez secciones del catálogo, con el tipo de capa con el que se cargan.
   * `seccion` es el identificador que espera el portal; `tipo` es el tipo con
   * el que se pasa la URL al cargador (ver CatalogoURL).
   */
  const SECCIONES = [
    { id: 'wms_est', nombre: 'WMS · Administration General del Estado', corto: 'WMS estatal', tipo: 'WMS', seccion: 'supVisWmsEst' },
    { id: 'wms_aut', nombre: 'WMS · Comunidades autónomas', corto: 'WMS autonómicos', tipo: 'WMS', seccion: 'supVisWmsAut' },
    { id: 'wms_loc', nombre: 'WMS · Locales', corto: 'WMS locales', tipo: 'WMS', seccion: 'supVisWmsLoc' },
    { id: 'wms_pve', nombre: 'WMS · Planos verticales', corto: 'WMS planos verticales', tipo: 'WMS', seccion: 'supVisWmsPV' },
    { id: 'wmts', nombre: 'WMTS', corto: 'WMTS', tipo: 'WMTS', seccion: 'sup-vis-wmts' },
    { id: 'xyz', nombre: 'XYZ · Raster Tile Service', corto: 'XYZ', tipo: 'XYZ', seccion: 'sup-vis-rts' },
    { id: 'mvt', nombre: 'Vector Tiles (MVT)', corto: 'MVT', tipo: 'MVT', seccion: 'sup-vis-vts' },
    { id: 'wfs', nombre: 'WFS', corto: 'WFS', tipo: 'WFS', seccion: 'sup-des-wfs' },
    { id: 'wcs', nombre: 'WCS', corto: 'WCS', tipo: 'WCS', seccion: 'sup-des-wcs' },
    { id: 'ogcapi', nombre: 'OGC API', corto: 'OGC API', tipo: 'OGCAPIFeatures', seccion: 'sup-ogc-api' }
  ];

  // Caché de secciones ya pedidas: { idSeccion: Promise<datos> }.
  // El portal no cambia entre recargas, así que no hay por qué volver a
  // pedirlo, y abrir/cerrar la sección tiene que ser instantáneo.
  const cache = {};

  /**
   * Devuelve la URL de la tabla de servicios de una sección del portal.
   * @param {string} idSeccion Identificador de sección (supVisWmsEst, ...).
   * @returns {string}
   */
  function urlSeccion(idSeccion) {
    const P = 'es_igncnig_dirserv72_DirectorioServiciosPortlet_INSTANCE_' + INSTANCE_TOKEN;
    return BASE_CATALOGO
      + '?p_p_id=' + P
      + '&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage'
      + '&_' + P + '_id=' + idSeccion
      + '&_' + P + '_actionName=cargaTablaSrv';
  }

  /**
   * Pide un recurso que puede ser de otro dominio.
   *
   * www.idee.es NO manda cabeceras CORS, así que desde el navegador la
   * petición tiene que pasar por el proxy de la API (IDEE.config.PROXY_URL).
   * Ese proxy envuelve la respuesta en { valid, code, content, ... } y deja el
   * cuerpo en `content` COMO TEXTO, así que hay que desenvolverlo. Si no
   * hubiera proxy configurado se cae a la petición directa.
   *
   * @param {string} url
   * @returns {Promise<string>} El cuerpo de la respuesta.
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
      const envoltorio = JSON.parse(texto);
      // El proxy envuelve la respuesta; `content` lleva el cuerpo real.
      if (envoltorio && typeof envoltorio === 'object' && envoltorio.content !== undefined) {
        if (envoltorio.error) throw new Error(envoltorio.message || 'error del proxy');
        return typeof envoltorio.content === 'string' ? envoltorio.content : JSON.stringify(envoltorio.content);
      }
    } catch (e) {
      // Si no es el envoltorio del proxy, el texto ya es la respuesta.
      if (e && e.message && /error del proxy/.test(e.message)) throw e;
    }
    return texto;
  }

  /**
   * Vacía los servicios de una organización o los de la familia.
   *
   * @param {Object} nodo `{ listserv: [...] }`.
   * @returns {Array<Object>} Servicios normalizados.
   */
  function serviciosDe(nodo) {
    if (!nodo) return [];
    const lista = Array.isArray(nodo.listserv) ? nodo.listserv : [];
    return lista.filter(function (s) { return s && (s.capa || s.url); }).map(function (s) {
      return {
        // `capa` es la URL que se carga (el GetCapabilities en los WMS).
        url: s.capa || s.url,
        // `url` es la base del servicio, sin los parámetros de capabilities.
        base: s.url || s.capa || '',
        nombre: s.name || s.url || '(sin nombre)',
        id: s.id || null,
        clase: s.clase || null
      };
    });
  }

  /**
   * Normaliza una familia del JSON en { nombre, id, servicios }.
   * @param {Object} familia
   * @returns {Object}
   */
  function normalizarFamilia(familia) {
    const nombre = familia.name || '(sin nombre)';
    const grupos = Array.isArray(familia.listorg)
      ? familia.listorg
      : (Array.isArray(familia.listserv) ? familia.listserv : []);

    let servicios = [];
    grupos.forEach(function (g) {
      // Una organización trae `listserv`; si no, el propio grupo ya es servicio.
      if (g && Array.isArray(g.listserv)) {
        servicios = servicios.concat(serviciosDe(g));
      } else if (g && (g.capa || g.url)) {
        servicios.push({
          url: g.capa || g.url,
          base: g.url || g.capa || '',
          nombre: g.name || g.url || '(sin nombre)',
          id: g.id || null,
          clase: g.clase || null
        });
      }
    });

    return { nombre: nombre, id: familia.id || null, servicios: servicios };
  }

  /**
   * Lista los servicios de una sección del catálogo.
   *
   * @param {string} idSeccion Id de la sección en SECCIONES ('wms_est', ...).
   * @param {Object} [opciones]
   * @param {boolean} [opciones.recargar=false] Ignora la caché.
   * @returns {Promise<{seccion: Object, familias: Array<Object>, total: number}>}
   */
  function listarSeccion(idSeccion, opciones) {
    const opts = opciones || {};
    const def = SECCIONES.find(function (s) { return s.id === idSeccion; });
    if (!def) return Promise.reject(new Error('Sección desconocida: ' + idSeccion));

    if (cache[idSeccion] && !opts.recargar) return cache[idSeccion];

    const promesa = pedir(urlSeccion(def.seccion)).then(function (texto) {
      const json = JSON.parse(texto);
      const datos = json && json.datos ? json.datos : {};

      // El portal agrupa por ámbito (est/aut/loc/pve) y en una sección concreta
      // solo viene uno, pero se concatenan todos los que vengan.
      let familias = [];
      ['est', 'aut', 'loc', 'pve'].forEach(function (clave) {
        if (!Array.isArray(datos[clave])) return;
        datos[clave].forEach(function (f) { familias.push(normalizarFamilia(f)); });
      });

      // Las familias sin servicios no aportan nada: fuera.
      familias = familias.filter(function (f) { return f.servicios.length > 0; });

      let total = 0;
      familias.forEach(function (f) { total += f.servicios.length; });

      return { seccion: def, familias: familias, total: total };
    });

    // Si la petición falla se saca de la caché, para poder reintentar.
    cache[idSeccion] = promesa.catch(function (err) {
      delete cache[idSeccion];
      throw err;
    });

    return cache[idSeccion];
  }

  // =====================================================================
  //  Exposición
  // =====================================================================
  const CatalogoIDEE = {
    SECCIONES: SECCIONES,
    PAGINA_CATALOGO: PAGINA_CATALOGO,
    urlSeccion: urlSeccion,
    listarSeccion: listarSeccion,
    pedir: pedir,
    /** Vacía la caché de secciones (para el botón de recargar). */
    limpiarCache: function (idSeccion) {
      if (idSeccion) delete cache[idSeccion];
      else Object.keys(cache).forEach(function (k) { delete cache[k]; });
    }
  };

  window.CatalogoIDEE = CatalogoIDEE;

  // Se cuelga también del registro de catálogos para que se pueda usar desde
  // cualquier código sin saber el global: IDEE.catalog.idee.SECCIONES.
  const colgar = function (registro) {
    if (!registro) return;
    const tipos = registro.tipos || (registro.tipos = {});
    tipos.idee = tipos.idee || {};
    tipos.idee.servicios = CatalogoIDEE;
  };

  // El registro lo crea catalogo.js, que se carga después. Si ya existe (por el
  // orden inverso de las etiquetas), se cuelga directamente; si no, se espera.
  if (window.IDEE && window.IDEE.catalog) {
    colgar(window.IDEE.catalog);
    colgar(window.M && window.M.catalog);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      colgar(window.IDEE && window.IDEE.catalog);
      colgar(window.M && window.M.catalog);
    });
  }
})();