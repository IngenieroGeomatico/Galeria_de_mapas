/**
 * =====================================================================
 *  wrapX: que TODAS las capas ráster den la vuelta al mundo
 * =====================================================================
 *
 *  Qué hace
 * --------
 *  En OpenLayers, una fuente de teselas dibuja el mundo en bucle cuando
 *  `wrapX` está a true: al cruzar el antimeridiano se ve el planeta repetido,
 *  que es lo que se quiere en un mapa generalista.
 *
 *  El problema es que ese valor por defecto NO es el mismo en todas las
 *  fuentes, y la API no lo unifica al construirlas:
 *
 *    ol.source.TileImage  (y las que heredan: XYZ, TMS)
 *        this.wrapX_ = options.wrapX !== false      →  POR DEFECTO TRUE
 *    ol.source.TileWMTS / ol.source.TileWMS
 *        sin valor por defecto                       →  POR DEFECTO FALSE
 *
 *  Medido en MapaBase: la capa base "Imagen" (BASE_PNOA_MA_TMS) viene con
 *  wrapX=true y "Callejero" (BASE_MapaBase_IGNBaseTodo_WMTS) con wrapX=false,
 *  así que una sí repite el mundo y la otra no, sin que el visualizador haya
 *  pedido ninguna de las dos cosas.
 *
 *  Además la API no deja pasar la opción: `new IDEE.layer.TMS({ wrapX: false })`
 *  sigue saliendo con wrapX=true (medido), porque al impl solo se le reenvía
 *  `crossOrigin`.
 *
 *  Y OJO con el otro camino: `fuente.set('wrapX', false)` NO sirve, porque esa
 *  versión de OpenLayers lee el CAMPO `wrapX_` y no la propiedad observable.
 *  Medido: con `set('wrapX', false)`, `fuente.get('wrapX')` vale false y
 *  `fuente.wrapX_` sigue valiendo true. Hay que tocar `wrapX_`.
 *
 *  Cómo se usa
 * -----------
 *    miWrapX.aplica(mapa);              // una vez, tras crear el mapa
 *
 *  Se queda escuchando altas y bajas de la colección de capas, así que también
 *  tapa las capas que se añadan después (un catálogo, un plugin, un grupo), sin
 *  que haya que volver a llamarla. Es idempotente: volver a llamarla no hace
 *  daño, y por eso se puede llamar desde los plugins sin miedo.
 *
 *  En 3D no hace nada: el impl de Cesium no tiene getLayers().
 * =====================================================================
 */
(function () {
  'use strict';

  /** El global de la API (IDEE o M, según cómo se haya cargado). */
  function api() {
    return window.IDEE || window.M || null;
  }

  /**
   * Devuelve la capa de OpenLayers que hay detrás de una capa de la API, o
   * null si no la hay (aún sin añadir al mapa, o una capa de 3D).
   *
   * @param {Object} capa Capa IDEE.layer.*.
   * @returns {Object|null} La olLayer.
   */
  function olDe(capa) {
    if (!capa) return null;
    // Camino corto: una capa de OpenLayers que se pasa tal cual.
    if (typeof capa.getSource === 'function') return capa;
    try {
      const impl = typeof capa.getImpl === 'function' ? capa.getImpl() : null;
      return (impl && impl.olLayer) ? impl.olLayer : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Pone wrapX_ = true a una capa de OpenLayers, y a todo lo que cuelgue de
   * ella si es un grupo.
   *
   * @param {Object} olCapa Capa o grupo de OpenLayers.
   * @param {Set} vistas Colecciones ya recorridas (evita ciclos).
   * @returns {number} Cuántas fuentes se han cambiado.
   */
  function envolver(olCapa, vistas) {
    if (!olCapa) return 0;
    let cuantas = 0;

    // Un grupo: se recorre su colección y se sigue escuchando.
    if (typeof olCapa.getLayers === 'function') {
      recorrer(olCapa.getLayers(), vistas);
      olCapa.getLayers().getArray().forEach(function (hijo) {
        cuantas += envolver(hijo, vistas);
      });
      return cuantas;
    }

    const fuente = typeof olCapa.getSource === 'function' ? olCapa.getSource() : null;
    // Las fuentes vectoriales no tienen wrapX_: se dejan como están.
    if (!fuente || !('wrapX_' in fuente) || fuente.wrapX_) return 0;

    fuente.wrapX_ = true;
    // changed() es lo que le dice a OpenLayers que repinte.
    if (typeof fuente.changed === 'function') fuente.changed();
    return 1;
  }

  /**
   * Recorre una colección de capas, las envuelve, y se queda escuchando sus
   * altas y bajas para envolver también lo que venga después.
   *
   * @param {Object} coleccion Colección de OpenLayers.
   * @param {Set} vistas Colecciones ya vistas.
   */
  function recorrer(coleccion, vistas) {
    if (!coleccion || vistas.has(coleccion)) return;
    vistas.add(coleccion);

    if (typeof coleccion.on === 'function') {
      const alCambiar = function (e) { envolver(e && e.element, vistas); };
      coleccion.on('add', alCambiar);
      // En un grupo, mover una capa fuera del mapa la quita de esta colección;
      // al volver a meterla hay que volver a envolverla.
      coleccion.on('remove', alCambiar);
    }
  }

  /**
   * Envuelve todas las capas del mapa, y se queda escuchando las que se
   * añadan después. En 3D no hace nada.
   *
   * @param {Object} mapa Instancia del mapa API-IDEE.
   * @returns {number} Cuántas fuentes se han cambiado en esta llamada.
   */
  function aplica(mapa) {
    if (!mapa || typeof mapa.getMapImpl !== 'function') return 0;
    let impl = null;
    try {
      impl = mapa.getMapImpl();
    } catch (e) {
      return 0;
    }
    // El impl de Cesium no tiene getLayers(): allí no hay teselas que envolver.
    if (!impl || typeof impl.getLayers !== 'function') return 0;

    const raiz = impl.getLayers();
    const vistas = new Set();
    let cuantas = 0;
    recorrer(raiz, vistas);
    raiz.getArray().forEach(function (ol) { cuantas += envolver(ol, vistas); });
    return cuantas;
  }

  /**
   * Envuelve solo una capa suelta (recién construida, ya añadida al mapa).
   *
   * @param {Object} mapa Instancia del mapa API-IDEE.
   * @param {Object} capa Capa IDEE.layer.*.
   * @returns {boolean} Si se ha cambiado algo.
   */
  function envuelve(mapa, capa) {
    return envolver(olDe(capa), new Set()) > 0;
  }

  window.miWrapX = {
    aplica: aplica,
    envuelve: envuelve,
    olDe: olDe
  };
})();