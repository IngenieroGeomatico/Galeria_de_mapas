/**
 * ============================================================================
 *  getWMC_cesium - getWMC / addWMC / removeWMC del impl del Mapa en 3D
 * ============================================================================
 *
 *  QUE FALTA EN LA BUILD DE CESIUM (medido)
 *
 *  Las dos builds traen la MISMA fachada de Mapa: `IDEE.Map` define
 *  `getWMC()`, `addWMC()` y `removeWMC()`, y las tres delegan en el impl
 *  (`this.getImpl().getWMC(...)`). La build de OpenLayers trae la
 *  implementacion; la de Cesium no: en su `IDEE.impl.Map.prototype` no existe
 *  ninguno de los tres metodos.
 *
 *  Eso rompe algo que no tiene nada que ver con los WMC, porque la propia API
 *  llama a `getWMC()` desde `IDEE.Map.prototype.getMaxExtent()`:
 *
 *    getMaxExtent() {
 *      let e = this.userMaxExtent;
 *      if (esIndefinido(e)) {
 *        const t = this.getWMC().find((w) => w.selected);
 *        if (!esIndefinido(t)) e = t.getMaxExtent();
 *        if (esIndefinido(e)) e = this.getProjection().getExtent();
 *      }
 *      return e;
 *    }
 *
 *  En 3D, `getWMC()` avisa ("La implementacion usada no posee el metodo
 *  getWMC") y despues LANZA un TypeError al llamar a `undefined`. Y
 *  `getMaxExtent()` se ejecuta al anadir una capa WMTS
 *  (`addLayerNotCapabilities_` -> `facadeLayer_.getMaxExtent()`), asi que la
 *  WMTS de base se queda a medias y no se pinta nada. No era CORS ni las
 *  capabilities: es este TypeError (medido).
 *
 *  QUE HACE ESTA EXTENSION
 *
 *  Copia en el impl de Cesium la implementacion de la build de OL (leida de su
 *  propio `IDEE.impl.Map.prototype.getWMC`, medida en caliente), para que las
 *  tres respondan igual en 3D que en 2D:
 *
 *    - getWMC(lista): devuelve las capas WMC del mapa. Sin argumentos (o con la
 *      lista vacia) devuelve todas; con lista, las que se piden. Sin ninguna
 *      WMC en el mapa devuelve `[]`, y entonces `getMaxExtent()` cae al extent
 *      de la proyeccion, exactamente igual que en 2D.
 *    - addWMC(lista): registra las capas WMC en `layers_` y las anade al mapa.
 *    - removeWMC(lista): las da de baja.
 *
 *  NO implementa la capa WMC en 3D: la fachada `IDEE.layer.WMC` existe en el
 *  bundle de Cesium pero su impl no (`IDEE.impl.layer.WMC` es undefined,
 *  medido), asi que crear una capa WMC en 3D sigue sin funcionar. Lo que
 *  arregla esto es el CONTRATO DEL MAPA, que es lo que usa la API para todo lo
 *  demas (extent, capas base, etc.).
 *
 *  POR QUE ES UN PARCHE DE ARRANQUE Y NO UN PLUGIN REGISTRADO
 *
 *  Tiene que estar puesto ANTES de que `mapa()` cree las capas base: el
 *  `getMaxExtent()` de la WMTS se ejecuta al anadirla, dentro de `mapa()`. Un
 *  plugin anadido con `map.addPlugin(...)` llega despues (el mapa ya existe y
 *  sus capas tambien), asi que llegaria tarde. Por eso se instala solo, por
 *  sondeo, igual que `ext/layergroup_cesium`.
 *
 *  COMO SE APLICA
 *
 *  - Solo con la implementacion Cesium (`IDEE.impl.cesium`). La build de OL ya
 *    trae los tres metodos y no se toca.
 *  - Idempotente: si el prototipo ya tiene el metodo (nuestra pasada anterior o
 *    una build futura que lo implemente), no se sobrescribe.
 *  - Cada build de la API recrea `window.IDEE` al ejecutarse, asi que se
 *    re-aplica cada 10 ms y en el evento `load` del <script> del bundle. El
 *    sondeo de cambioImpl es de 100 ms, de modo que el parche llega antes de
 *    que se re-ejecute `mapa()`.
 * ============================================================================
 */
(function () {
  'use strict';

  // ── Utilidades ───────────────────────────────────────────────────────────
  const esIndefinido = (v) => v === undefined;

  function apiIDEE() {
    const IDEE = window.IDEE;
    if (IDEE && IDEE.impl && typeof IDEE.impl.Map === 'function' && IDEE.impl.Layer) {
      return IDEE;
    }
    return null;
  }

  // ── Las tres operaciones, calcadas de la build de OL ─────────────────────

  /**
   * `getWMC(lista)`: capas WMC del mapa.
   *
   * En la build de OL (leido del propio bundle):
   *   - sin argumentos o con lista vacia -> todas las WMC de `layers_`;
   *   - con lista -> las pedidas; un impl de capa se compara por identidad y
   *     cualquier otro objeto, por los campos que traiga (type/url/name).
   *     Nunca se repite una capa en el resultado.
   * @param {Array|Object} [lista] Capas (impls) o descriptores a buscar.
   * @returns {Array} Impls de las capas WMC encontradas.
   */
  function crearGetWMC(IDEE) {
    return function getWMC(lista) {
      let pedidas = lista;
      let encontradas = [];

      // En 2D: `this.layers_.filter((capa) => capa.type === 'WMC')`.
      const wmc = (Array.isArray(this.layers_) ? this.layers_ : [])
        .filter((capa) => capa && capa.type === 'WMC');

      if (esIndefinido(pedidas)) pedidas = [];
      if (!Array.isArray(pedidas)) pedidas = [pedidas];
      if (pedidas.length === 0) return wmc;

      pedidas.forEach((pedida) => {
        if (!pedida) return;
        encontradas = encontradas.concat(wmc.filter((capa) => {
          if (encontradas.indexOf(capa) !== -1) return false;
          // La fachada del Mapa ya convierte las fachadas a impls antes de
          // llamar aqui, asi que lo normal es la comparacion por identidad.
          if (pedida instanceof IDEE.impl.Layer) return pedida === capa;
          // Descriptor suelto: se compara por los campos que traiga.
          let coincide = true;
          if (!esIndefinido(pedida.type)) coincide = coincide && pedida.type === capa.type;
          if (!esIndefinido(pedida.url)) coincide = coincide && pedida.url === capa.url;
          if (!esIndefinido(pedida.name)) coincide = coincide && pedida.name === capa.name;
          return coincide;
        }));
      });

      return encontradas;
    };
  }

  /**
   * `addWMC(lista)`: registra las capas WMC en el mapa.
   *
   * En 2D fija el z-index de la tabla `Z_INDEX` y llama a
   * `capa.getImpl().addTo(this.facadeMap_)`. En Cesium el z es la POSICION del
   * impl dentro de su coleccion (lo acota `ext/layergroup_cesium`), asi que aqui
   * solo se anade y se registra en `layers_`.
   * @param {Array|Object} lista Impls de capas WMC.
   * @returns {Object} El propio impl del mapa (encadenable, como en 2D).
   */
  function crearAddWMC() {
    return function addWMC(lista) {
      if (!Array.isArray(this.layers_)) this.layers_ = [];
      const capas = Array.isArray(lista) ? lista : [lista];

      capas.forEach((capa) => {
        if (!capa || capa.type !== 'WMC') return;
        if (this.layers_.indexOf(capa) !== -1) return;
        const impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
        if (impl && typeof impl.addTo === 'function') impl.addTo(this.facadeMap_);
        this.layers_.push(capa);
      });

      return this;
    };
  }

  /**
   * `removeWMC(lista)`: da de baja las capas WMC del mapa.
   *
   * En 2D, antes de sacarlas de `layers_` quita sus WMS del mapa
   * (`facadeMap_.removeWMS(capa.layers)`, porque una WMC es un conjunto de
   * capas WMS) y rehace el selector de WMC. Se hace lo mismo cuando el impl
   * expone las subcapas.
   * @param {Array|Object} lista Capas (impls) o descriptores a dar de baja.
   * @returns {Object} El propio impl del mapa (encadenable, como en 2D).
   */
  function crearRemoveWMC() {
    return function removeWMC(lista) {
      const capas = this.getWMC(lista);
      if (!capas.length) return this;

      // Se sacan todas de golpe: filtrar capa a capa dejaria el `layers_`
      // resultante del ultimo filtro y volveria a meter las anteriores.
      this.layers_ = (Array.isArray(this.layers_) ? this.layers_ : []).filter((otra) => {
        if (capas.indexOf(otra) !== -1) return false;
        if (otra && typeof otra.equals === 'function') {
          try {
            return !capas.some((capa) => otra.equals(capa));
          } catch (e) { return true; }
        }
        return true;
      });

      capas.forEach((capa) => {
        const impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
        if (impl && Array.isArray(impl.layers) && this.facadeMap_ &&
            typeof this.facadeMap_.removeWMS === 'function') {
          try { this.facadeMap_.removeWMS(impl.layers); } catch (e) { /* defensivo */ }
        }
      });

      if (this.facadeMap_ && typeof this.facadeMap_.refreshWMCSelectorControl === 'function') {
        try { this.facadeMap_.refreshWMCSelectorControl(); } catch (e) { /* defensivo */ }
      }

      return this;
    };
  }

  // ── Aplicacion del parche (idempotente) ──────────────────────────────────
  function applyPatch() {
    const IDEE = apiIDEE();
    if (!IDEE) return false;
    // Solo en 3D: la build de OL ya implementa los tres metodos y no se toca.
    if (!IDEE.impl.cesium) return false;

    const proto = IDEE.impl.Map.prototype;

    // Nunca se pisa una implementacion que ya exista (nuestra pasada anterior
    // en la misma build, o una build futura que la traiga de serie).
    if (typeof proto.getWMC !== 'function') proto.getWMC = crearGetWMC(IDEE);
    if (typeof proto.addWMC !== 'function') proto.addWMC = crearAddWMC();
    if (typeof proto.removeWMC !== 'function') proto.removeWMC = crearRemoveWMC();

    return typeof proto.getWMC === 'function' &&
      typeof proto.addWMC === 'function' &&
      typeof proto.removeWMC === 'function';
  }

  // Arranque: parche inmediato (por si ya estamos en Cesium) + re-aplicacion
  // cada 10 ms (cada build de la API recrea window.IDEE al ejecutarse y el
  // sondeo de cambioImpl es de 100 ms, asi que el parche siempre llega antes
  // de que se re-ejecute mapa()).
  applyPatch();
  setInterval(applyPatch, 10);

  // Deteccion inmediata del cambio de build: miPlugin_cambioImpl reemplaza el
  // <script> de la build destino. Cuando ese script termina de ejecutarse,
  // window.IDEE YA es la build nueva (el eval termina antes del evento load),
  // asi que aplicar el parche ahi elimina la carrera con la re-ejecucion de
  // mapa() que hace el plugin justo despues.
  if (document.addEventListener) {
    document.addEventListener('load', (e) => {
      try {
        const t = e.target;
        if (t && t.tagName === 'SCRIPT' && typeof t.src === 'string' &&
          /cesium[^/]*\.js/i.test(t.src)) {
          applyPatch();
        }
      } catch (err) { /* defensivo */ }
    }, true);
  }
})();
