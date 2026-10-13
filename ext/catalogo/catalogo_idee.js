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

   Las secciones no se piden al vuelo: se leen de una COPIA LOCAL generada por
   ext/catalogo/generar_catalogo_idee.py, porque www.idee.es no manda CORS y un
   navegador no puede leer su respuesta. La copia es un .js cargado con una
   <script>, que funciona igual en http:// que en file:// (un fetch de un JSON
   local esta bloqueado en file://). Para refrescar el catalogo:

     python ext/catalogo/generar_catalogo_idee.py          # las diez secciones
     python ext/catalogo/generar_catalogo_idee.py wmts     # solo una

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
   * Los tipos de servicio del catálogo, con las secciones del portal que los
   * componen.
   *
   *  `secciones` son los identificadores que espera el portal; `tipo` es el tipo
   *  con el que se pasa la URL al cargador (ver CatalogoURL).
   *
   *  Ojo con el WMS: en el portal está partido en CUATRO tablas (estatal,
   *  autonómicos, locales y planos verticales), y aquí se fusionan en una sola.
   *  Todos los tipos tienen el mismo esquema: una sección por tipo de servicio.
   */
  const SECCIONES = [
    { id: 'wms', nombre: 'WMS', corto: 'WMS', tipo: 'WMS', secciones: ['supVisWmsEst', 'supVisWmsAut', 'supVisWmsLoc', 'supVisWmsPV'] },
    { id: 'wmts', nombre: 'WMTS', corto: 'WMTS', tipo: 'WMTS', secciones: ['sup-vis-wmts'] },
    { id: 'xyz', nombre: 'XYZ · Raster Tile Service', corto: 'XYZ', tipo: 'XYZ', secciones: ['sup-vis-rts'] },
    { id: 'mvt', nombre: 'Vector Tiles (MVT)', corto: 'MVT', tipo: 'MVT', secciones: ['sup-vis-vts'] },
    { id: 'wfs', nombre: 'WFS', corto: 'WFS', tipo: 'WFS', secciones: ['sup-des-wfs'] },
    { id: 'wcs', nombre: 'WCS', corto: 'WCS', tipo: 'WCS', secciones: ['sup-des-wcs'] },
    { id: 'ogcapi', nombre: 'OGC API', corto: 'OGC API', tipo: 'OGCAPIFeatures', secciones: ['sup-ogc-api'] }
  ];

  // Caché de secciones ya pedidas: { idSeccion: Promise<datos> }.
  // El portal no cambia entre recargas, así que no hay por qué volver a
  // pedirlo, y abrir/cerrar la sección tiene que ser instantáneo.
  const cache = {};

  // La URL de este script se lee UNA vez, al cargar: document.currentScript solo
  // vale mientras se ejecuta el script, y cuando el plugin llama a urlDatos ya es
  // null (medido: devolvía './datos/...', relativo a la página, y daba 404).
  const SCRIPT_AQUI = (document.currentScript && document.currentScript.src) || '';

  /**
   * URL de la copia local de una sección, que es lo que se lee de verdad.
   *
   *  La ruta sale de la posición de ESTE script, no de la página: así da igual a
   *  qué profundidad esté el visualizador.
   *
   *  @param {string} idSeccion Id de la sección ('wms_est', ...).
   * @returns {string} URL del fichero .js local.
   */
  function urlDatos(idSeccion) {
    const base = SCRIPT_AQUI.slice(0, SCRIPT_AQUI.lastIndexOf('/'));   // .../ext/catalogo
    return (base || '.') + '/datos/' + idSeccion + '.js';
  }

  /**
   * Carga la copia local de una sección con una etiqueta `<script>`.
   *
   *  Se carga así y NO con fetch: con `file://` (abrir el visualizador
   *  directamente del disco, sin servidor) el navegador bloquea el fetch de un
   *  fichero local, y una `<script>` sí que lo carga. En `http://` las dos vías
   *  funcionan, pero esta sirve para las dos.
   *
   *  @param {string} idSeccion Id de la sección ('wms_est', ...).
   * @returns {Promise<Object>} El JSON de la sección, tal como lo dejó el script.
   */
  function cargarDatos(idSeccion) {
    return new Promise(function (resolver, rechazar) {
      const url = urlDatos(idSeccion);
      const s = document.createElement('script');
      s.src = url;
      s.onload = function () {
        const datos = window.CatalogoIDEE_Datos && window.CatalogoIDEE_Datos[idSeccion];
        if (datos) resolver(datos);
        else rechazar(new Error('«' + url + '» se ha cargado pero no ha dejado datos.'));
      };
      s.onerror = function () {
        rechazar(new Error('No se ha podido cargar «' + url + '».'));
      };
      document.head.appendChild(s);
    });
  }

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
   * Pide un recurso con fetch, directamente (ver CatalogoURL.pedir).
   *
   * AVISO IMPORTANTE, medido: el catálogo de la IDEE se sirve en www.idee.es,
   * y www.idee.es NO manda Access-Control-Allow-Origin. Sin esa cabecera el
   * navegador permite la petición pero bloquea la lectura, así que desde un
   * visualizador estas diez secciones NO se pueden leer directamente. Los
   * catálogos STAC y OGC API de verdad sí mandan CORS.
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
        ' www.idee.es no manda cabeceras CORS, y sin ellas el navegador bloquea la lectura.');
    }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' al pedir «' + url + '».');
    return await r.text();
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
   * Deja el JSON de una sección en la forma que espera el plugin (familias con
   * sus servicios).
   *
   *  @param {Object} datos El JSON tal como lo dejó el portal (o el script).
   * @param {Object} def Definición de la sección en SECCIONES.
   * @returns {Promise<{seccion: Object, familias: Array<Object>, total: number}>}
   */
  function leerSeccion(datos, def) {
    const crudo = datos && datos.datos ? datos.datos : {};

    // El portal agrupa por ámbito (est/aut/loc/pve) y en una sección concreta
    // solo viene uno, pero se concatenan todos los que vengan.
    let familias = [];
    ['est', 'aut', 'loc', 'pve'].forEach(function (clave) {
      if (!Array.isArray(crudo[clave])) return;
      crudo[clave].forEach(function (f) { familias.push(normalizarFamilia(f)); });
    });

    // Las familias sin servicios no aportan nada: fuera.
    familias = familias.filter(function (f) { return f.servicios.length > 0; });

    let total = 0;
    familias.forEach(function (f) { total += f.servicios.length; });

    return Promise.resolve({ seccion: def, familias: familias, total: total });
  }

  /**
   * Pide un tipo de servicio al portal y lo deja en la forma que espera el plugin.
   *
   *  Un tipo puede estar partido en el portal en varias tablas (el WMS, en
   *  estatal, autonómicos, locales y planos verticales): se piden todas y se
   *  concatenan por ámbito, que es lo mismo que hace el parser con las claves
   *  est/aut/loc/pve.
   *
   * @param {Object} def Definición del tipo en SECCIONES.
   * @returns {Promise<{seccion: Object, familias: Array<Object>, total: number}>}
   */
  function leerPortal(def) {
    return Promise.all(def.secciones.map(function (idPortal) {
      return pedir(urlSeccion(idPortal));
    })).then(function (textos) {
      const crudo = { est: [], aut: [], loc: [], pve: [] };
      textos.forEach(function (texto) {
        const datos = JSON.parse(texto);
        const d = (datos && datos.datos) || {};
        ['est', 'aut', 'loc', 'pve'].forEach(function (clave) {
          const lista = Array.isArray(d[clave]) ? d[clave] : [];
          lista.forEach(function (f) { crudo[clave].push(f); });
        });
      });
      return leerSeccion({ datos: crudo }, def);
    });
  }

  function listarSeccion(idSeccion, opciones) {
    const opts = opciones || {};
    const def = SECCIONES.find(function (s) { return s.id === idSeccion; });
    if (!def) return Promise.reject(new Error('Sección desconocida: ' + idSeccion));

    if (cache[idSeccion] && !opts.recargar) return cache[idSeccion];

    const promesa = cargarDatos(idSeccion)
      .then(function (datos) { return leerSeccion(datos, def); })
      .catch(function () {
        // No hay copia local (o no se ha podido cargar): se pide al portal, que
        // es donde está el catálogo de verdad. Ojo: www.idee.es no manda CORS,
        // así que desde un visualizador esto falla; por eso existe la copia
        // local.
        return leerPortal(def);
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
    /**
     * Vacía la caché de secciones.
     *
     *  Con `idSeccion` suelta solo esa; sin argumento, todas. Y con
     *  `mantenerId` suelta todas menos esa, que es lo que hace el panel al
     *  cambiar de tipo de servicio: el catálogo de la IDEE viene partido en diez
     *  secciones y la de WMS estatal del IGN tiene más de setecientos servicios,
     *  así que tenerlas todas residentes es justo lo que no se quiere. Al soltar
     *  la memoria se vuelve a pedir si se vuelve a esa sección, que es el precio
     *  de no retenerlas todas.
     *
     *  @param {string} [idSeccion] Sección a soltar, o todas si no se indica.
     *  @param {string} [mantenerId] Sección que se deja en la caché.
     * @returns {number} Cuántas se han soltado.
     */
    limpiarCache: function (idSeccion, mantenerId) {
      let soltadas = 0;
      if (idSeccion) {
        if (idSeccion !== mantenerId && cache[idSeccion]) {
          delete cache[idSeccion];
          soltadas++;
        }
        return soltadas;
      }
      Object.keys(cache).forEach(function (k) {
        if (k === mantenerId) return;
        delete cache[k];
        soltadas++;
      });
      return soltadas;
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