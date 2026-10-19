/**
 * ============================================================================
 *  quicklayers_cesium - repone en 3D las capas rapidas que la build de Cesium
 *  deja sin definir
 * ============================================================================
 *
 *  QUE PASA (medido, y no es lo que parece)
 *
 *  Las dos builds traen el MISMO catalogo de capas rapidas: 42 claves en 2D y
 *  42 en 3D, sin una sola diferencia entre las dos listas. Lo que no coincide
 *  son los VALORES. La build de Cesium construye algunas entradas con clases
 *  INTERNAS suyas, y si la implementacion de esa clase no existe en Cesium el
 *  constructor lanza, el `try/catch` de la propia entrada se traga el error y
 *  la entrada se queda en `undefined`:
 *
 *    BASE_HIBRIDO_LayerGroup: C()
 *      // C = () => new a.Z({name:"Híbrido", isBase:!0, layers:[...]})
 *    BTN_Completa_MapLibre: _()
 *      // _ = () => new c.Z({url:"https://vt-btn.idee.es/files/styles/BTN_Completa.json", ...})
 *
 *  (`a.Z` es la fachada interna de LayerGroup y `c.Z` la de MVT; en el bundle
 *  de Cesium sus implementaciones no existen, de ahi que lanzen).
 *
 *  Medido en vivo: 2D -> 0 entradas `undefined`; 3D -> esas 2. Al pedirlas, la
 *  API avisa "No se encuentra definida X como capa rapida" y no anade nada.
 *
 *  Y el detalle que lo explica todo: en el bundle de Cesium no hay ni una
 *  aparicion de `new IDEE.layer.LayerGroup` ni de `new IDEE.layer.MVT`. El
 *  catalogo NO usa los globales, asi que los parches de `ext/layergroup_cesium`
 *  y `ext/MVTLayer` (que sustituyen `IDEE.layer.*`) no llegan nunca a esas dos
 *  entradas. Por eso esto no se arregla cargando scripts antes o despues del
 *  bundle, ni "justo antes de mapa()": no es CUANDO, es QUE objeto se construye.
 *
 *  QUE HACE ESTA EXTENSION
 *
 *  Repone las entradas rotas con un "get/set" del catalogo, que la API no expone
 *  con esos nombres pero que son dos funciones suyas:
 *
 *    - `IDEE.getQuickLayers()` (sin argumento) devuelve el catalogo entero;
 *    - `IDEE.addQuickLayers(catalogo, true)` lo SUSTITUYE por ese mismo objeto.
 *      El segundo argumento es la clave: en la API, `addQuickLayers = (t, e) => {
 *      e === true ? v = () => t : v = () => Object.assign(v(), t) }`, o sea que
 *      con `true` el catalogo pasa a ser el objeto recibido ("setQuickLayers"),
 *      y sin `true` se fusiona y se reconstruye entero en ese instante.
 *
 *  Las entradas se reponen copiando la definicion de la build (mismos datos,
 *  URLs y opciones) pero construidas con las fachadas del GLOBAL, que en 3D son
 *  las parcheadas: el LayerGroup de ext/layergroup_cesium y el MVT de
 *  ext/MVTLayer.
 *
 *  OJO CON EL MOMENTO. El `get` construye el catalogo entero en ese instante (y
 *  el `set` lo deja fijo), asi que si se llamara antes de que la build tenga la
 *  config de la pagina -medido: el build esta vivo a los ~0,8 s y la config de
 *  la pagina llega a los ~2,0 s- las entradas que leen la config (la atribucion
 *  kml del PNOA) se quedarian con la de por defecto. Por eso:
 *
 *    - `cambioImpl` llama a `reponer()` despues de
 *      `IDEE.config = await loadConfig(...)` y ANTES de `reiniciarMapa()`, que
 *      es cuando `mapa()` resuelve las capas base (incluida la que el usuario
 *      tenia recordada en localStorage);
 *    - y otra vez despues de `anadirPluginsCapas3D()`, porque `IDEE.layer.MVT`
 *      solo esta parcheada cuando miPlugin_MVTLayer ha sustituido la clase.
 *
 *  `reponer()` es idempotente por build y por clave: cada receta se aplica
 *  cuando su clase ya esta disponible y la entrada sigue `undefined`; si la
 *  clase aun no esta (por ejemplo el MVT antes de su plugin), no se toca nada y
 *  se reintenta en la siguiente llamada. Una entrada que quede `undefined` y no
 *  tenga receta aqui se avisa por consola una sola vez por build, para que no
 *  vuelva a pasar en silencio.
 *
 *  Para el Hibrido hay ademas un `normalizar()`: rehace las banderas `isBase` de
 *  sus hijas antes de cada alta de capa base (el selector avisa con
 *  `antesDeAnadirBase`). No es cosmetico: en Cesium la capa base va al fondo y
 *  esas banderas se estropean al quitar el grupo, con lo que el Hibrido volvia a
 *  pintarse sin rotulos (ver el comentario de `normalizar`).
 * ============================================================================
 */
(function () {
  'use strict';

  const NOMBRE = 'quicklayers_cesium';

  // ── Recetas: las definiciones de la build, con las fachadas del global ────
  //
  // Los datos (URLs, leyendas, nombres, atribuciones, zooms y opciones) estan
  // copiados de la propia build, para no inventar nada: la unica diferencia es
  // que aqui se usan `IDEE.layer.*`, que en 3D son las clases parcheadas.

  // Referencias a las hijas del Hibrido tal y como las crea la receta. El
  // catalogo queda congelado, asi que el grupo y sus hijas son SIEMPRE los
  // mismos objetos: guardarlas aqui es lo que permite rehacerles las banderas
  // con `normalizar()`.
  let hijasHibrido = null;

  const RECETAS = {

    /**
     * `BASE_HIBRIDO_LayerGroup` es, en la build, un LayerGroup con la ortofoto
     * PNOA_MA debajo y el nomenclator IGNBaseOrto encima.
     *
     * Dos ajustes que necesita Cesium:
     *  - la fachada de ext/layergroup_cesium no lee `layers` del constructor,
     *    asi que las hijas se anaden con `addLayers()` (si no, el grupo sale
     *    con 0 hijas, medido);
     *  - en Cesium el impl contempla UNA sola capa base (`getBaseLayers()
     *    filtra `isBase === true`) y a esa la pone en el indice 0, o sea al
     *    fondo. La ortofoto es la que lleva `isBase: true` para ocupar ese
     *    indice y dejar el nomenclator encima, como en 2D; si las DOS hijas son
     *    base, el nomenclator se va al fondo y el Hibrido se ve como una
     *    ortofoto sin rotulos (medido: `[IGNBaseOrto, PNOA_MA]`).
     *
     * Esas banderas se estropean al quitar el grupo: tras salir del Hibrido el
     * nomenclator queda con `isBase: true` (medido) y al volver a anadirlo
     * Cesium lo pone al fondo. Por eso `normalizar()` las rehace antes de cada
     * alta (el selector avisa con `antesDeAnadirBase`, y ademas hay sondeo).
     *
     * Y el nomenclator no puede quedar como "base", asi que el selector de capas
     * base no lo ve: al salir del Hibrido se quedaba pintado sobre la base
     * siguiente. Eso se arregla donde toca, en el propio selector, quitando las
     * capas que anadio la seleccion anterior (ver `changeBase` en
     * ext/selectorCapas/ext_backgorundLayers.js).
     *
     * @param {Object} IDEE La API (build de Cesium en curso).
     * @returns {Object} Grupo listo para registrar como capa rapida.
     */
    BASE_HIBRIDO_LayerGroup: function (IDEE) {
      const pnoa = new IDEE.layer.TMS({
        url: 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg',
        legend: 'PNOA_MA',
        name: 'PNOA_MA',
        visible: true,
        isBase: true,
        tileGridMaxZoom: 19,
        attribution: {
          name: 'PNOA-MA',
          description: 'IGN',
          url: 'https://www.ign.es',
          contentAttributions: IDEE.config.STATIC_RESOURCES_URL +
            '/Datos/reconocimientos/WMTS_PNOA_20170220/atribucionPNOA_Url.kml',
          contentType: 'kml'
        }
      }, { crossOrigin: 'anonymous', displayInLayerSwitcher: false });

      const nomenclator = new IDEE.layer.TMS({
        url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseOrto/{z}/{x}/{-y}.png',
        legend: 'IGNBaseOrto',
        name: 'IGNBaseOrto',
        visible: true,
        tileGridMaxZoom: 17,
        attribution: '<p><b>IDEE</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>'
      }, { crossOrigin: 'anonymous', displayInLayerSwitcher: false });

      const grupo = new IDEE.layer.LayerGroup({ name: 'Híbrido', isBase: true });
      grupo.addLayers([pnoa, nomenclator]);
      // Guardadas para `normalizar()` (ver su comentario).
      hijasHibrido = [pnoa, nomenclator];
      return grupo;
    },

    /**
     * `BTN_Completa_MapLibre` es la capa vectorial BTN Completa del estilo que
     * sirve el IGN, una MVT.
     *
     * En 3D necesita `IDEE.layer.MVT` parcheada por ext/MVTLayer: mientras el
     * plugin no este anadido, el constructor lanza y la receta se reintenta.
     *
     * @param {Object} IDEE La API (build de Cesium en curso).
     * @returns {Object} Capa MVT lista para registrar como capa rapida.
     */
    BTN_Completa_MapLibre: function (IDEE) {
      return new IDEE.layer.MVT({
        url: 'https://vt-btn.idee.es/files/styles/BTN_Completa.json',
        name: 'BTN_Completa',
        legend: 'BTN Completa',
        extract: true,
        attribution: {
          name: 'BTN Completa',
          description: '<p><b>IDEE</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>'
        }
      }, { disableBackgroundColor: false });
    }
  };

  // ── Utilidades ───────────────────────────────────────────────────────────

  /**
   * La API, solo si la build en curso es la de Cesium y trae lo que hace falta
   * para leer y fundir el catalogo de capas rapidas.
   * @returns {Object|null}
   */
  function apiIDEE() {
    const IDEE = window.IDEE;
    if (IDEE && IDEE.impl && IDEE.impl.cesium && IDEE.layer &&
        typeof IDEE.addQuickLayers === 'function' &&
        typeof IDEE.getQuickLayers === 'function') {
      return IDEE;
    }
    return null;
  }

  // ── Estado de las hijas del Hibrido ──────────────────────────────────────

  /**
   * Rehace las banderas de las hijas del Hibrido tal y como las define la
   * receta: la ortofoto (PNOA_MA) como unica hija base, para que ocupe el indice
   * 0, y el nomenclator (IGNBaseOrto) sin ser base, para que quede encima.
   *
   * Hace falta porque ese estado se estropea al quitar el grupo: tras salir del
   * Hibrido el nomenclator queda con `isBase: true` (medido) y, como el impl de
   * Cesium manda al fondo la capa base, al volver a anadirlo el Hibrido se ve
   * como una ortofoto sin rotulos (`[IGNBaseOrto, PNOA_MA]`, medido). Rehacer
   * las banderas antes de cada alta devuelve el orden correcto (medido:
   * `[PNOA_MA, IGNBaseOrto]`).
   *
   * Es idempotente y no toca nada si ya estan como toca.
   */
  function normalizar() {
    if (!hijasHibrido || hijasHibrido.length !== 2) return;
    if (hijasHibrido[0].isBase !== true) hijasHibrido[0].isBase = true;
    if (hijasHibrido[1].isBase !== false) hijasHibrido[1].isBase = false;
  }

  // ── Reposicion de entradas (idempotente por build y por clave) ────────────

  let buildActual = null;   // build en la que estamos trabajando
  const avisadas = [];      // claves ya avisadas como sin receta en esta build

  /**
   * Repone en el catalogo de capas rapidas de la build en curso todas las
   * entradas que esten `undefined` y tengan receta aqui.
   *
   * Se puede llamar tantas veces como se quiera: cada receta se aplica una sola
   * vez (cuando la entrada esta `undefined` y su clase ya existe) y las que no
   * se hayan podido aplicar se reintentan en la llamada siguiente.
   *
   * @returns {boolean} true si no queda ninguna entrada rota con receta.
   */
  function reponer() {
    const IDEE = apiIDEE();
    if (!IDEE) return false;

    if (buildActual !== IDEE) {
      buildActual = IDEE;
      avisadas.length = 0;
    }

    // `getQuickLayers()` sin argumentos devuelve el catalogo entero. Ese mismo
    // objeto es el que se parchea y se vuelve a dejar con
    // `addQuickLayers(catalogo, true)` (ver la cabecera del fichero).
    let catalogo = null;
    try { catalogo = IDEE.getQuickLayers(); } catch (e) { return false; }
    if (!catalogo || typeof catalogo !== 'object') return false;

    const sinDefinir = Object.keys(catalogo).filter((clave) => typeof catalogo[clave] === 'undefined');
    if (!sinDefinir.length) return true;

    const sinReceta = [];
    let pendientes = 0;
    let repuestas = 0;

    sinDefinir.forEach((clave) => {
      const receta = RECETAS[clave];
      if (!receta) { sinReceta.push(clave); return; }

      let capa = null;
      try {
        capa = receta(IDEE);
      } catch (e) {
        // Su clase todavia no esta parcheada (p. ej. el MVT antes de su
        // plugin): la entrada se deja como esta y se reintenta mas adelante.
        pendientes++;
        return;
      }
      if (!capa) { pendientes++; return; }

      catalogo[clave] = capa;
      repuestas++;
    });

    if (repuestas) {
      // Un solo "set" con el catalogo ya parcheado. Se hace aqui, cuando la
      // build ya tiene la config de la pagina: el `get` de arriba construye las
      // entradas que faltan con esa config (la atribucion kml del PNOA la lee) y
      // el `set` deja ese mismo objeto como catalogo definitivo.
      try {
        IDEE.addQuickLayers(catalogo, true);
      } catch (e) {
        console.warn('[' + NOMBRE + '] no se pudo dejar el catalogo de capas rapidas', e);
      }
      // Comprobacion final: lo que siga sin definir se reintenta en la proxima.
      sinDefinir.forEach((clave) => {
        if (RECETAS[clave] && typeof IDEE.getQuickLayers(clave) === 'undefined') pendientes++;
      });
    }

    if (sinReceta.length) {
      const nuevas = sinReceta.filter((c) => avisadas.indexOf(c) === -1);
      if (nuevas.length) {
        nuevas.forEach((c) => avisadas.push(c));
        console.warn('[' + NOMBRE + '] la build de Cesium deja sin definir estas capas rapidas ' +
          'y aqui no hay receta para ellas: ' + nuevas.join(', '));
      }
    }

    return !pendientes;
  }

  // Expuesto para que el plugin del cambio 2D/3D pueda reponer en el momento en
  // que toca (su propio flujo conoce cuando la build ya tiene la config) y para
  // que el selector de capas base avise antes de anadir una base, que es cuando
  // hay que tener las banderas del Hibrido en su sitio.
  window.quicklayers_cesium = {
    reponer: reponer,
    antesDeAnadirBase: normalizar
  };
})();
