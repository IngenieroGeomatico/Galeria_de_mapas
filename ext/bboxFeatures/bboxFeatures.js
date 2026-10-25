/* =====================================================================
   EXTENSIÓN DE OBJETOS GEOGRÁFICOS (WFS y OGC API Features)
   Repositorio: Galeria_de_mapas
   =====================================================================

   QUÉ ES:
   Un plugin sin interfaz propia que enseña a las capas WFS y OGC API
   Features a pedir al servicio SOLO los objetos geográficos de la vista
   (BBOX), a pedirlos a PÁGINAS (límite + desplazamiento resueltos en el
   servidor) y a repetir la petición cuando el mapa se mueve. El control para
   elegir entre "todas" y "la vista", el límite y el paginado lo pinta el
   selector de capas (ext/selectorCapas/ext_layerSwitcher.js) dentro de la
   ventana de información (la que abre la tabla de atributos), que delega
   aquí a través de window.miBBoxFeatures.

   POR QUÉ HACE FALTA:
   La API-IDEE 1.1.0 descarga los objetos UNA sola vez, sin extensión: el
   loader de features (módulo 26437 del bundle) llama siempre
   `service_.getFeatureUrl(null, proyección)`, es decir, con el extent a
   null. Los servicios sí saben filtrar y paginar:
     - WFS: `getFeatureUrl(extent, proyeccion)` añade
       `&bbox=minx,miny,maxx,maxy,<CRS>` cuando el extent no es null; el
       número de objetos y el salto de página van en `count` (WFS 2.0) o
       `maxFeatures` (1.x) y `startIndex`.
     - OGC API Features: el servicio lee `bbox` del constructor y lo mete
       como `bbox=minx,miny,maxx,maxy` (CRS84: longitud, latitud); para el
       paginado usa `limit` y `offset`.
   Pero ninguna fachada de capa expone esas opciones al visualizador.

   CÓMO SE INYECTA LA PETICIÓN (medido, sin tocar el bundle):
     - WFS: los parámetros de vendor `getFeature` se mezclan al final de la
       URL de GetFeature, así que basta escribir
         impl.options.vendor.getFeature.bbox = 'minx,miny,maxx,maxy,EPSG:3857'
         impl.options.vendor.getFeature.count = 100
         impl.options.vendor.getFeature.startIndex = 200
       y llamar a `impl.refresh(true)`. Funciona igual en 2D y en 3D: en 2D
       el impl de OpenLayers crea un servicio nuevo en cada refresco con
       `this.options.vendor`; en 3D el de Cesium hace lo mismo y la URL ya
       sale con el bbox y la página.
     - OGC API Features: la fachada sí tiene `bbox` (y el impl lo pasa al
       servicio en cada refresco), así que se escribe `impl.bbox`, `impl.limit`
       e `impl.offset` y se refresca.
   El resto de la recarga (borrar objetos, formulario, fuente nueva) lo hace
   la propia API con `refresh(true)`; aquí no se reimplementa.

   LÍMITE Y PAGINADO:
   - El límite (100 objetos por defecto) se aplica SIEMPRE, en "todas" y en
     "la vista": una capa nacional sin límite se trae todos los registros del
     servicio y bloquea el navegador. El tamaño de página se puede cambiar
     desde la ventana de información (25, 50, 100, 200, 500).
   - La página se resuelve en el servidor (startIndex/count en WFS, offset y
     limit en OGC API), así que el mapa pinta exactamente los objetos de la
     tabla: la tabla y el mapa siempre coinciden.
   - Al mover el mapa en modo "la vista" se vuelve a la primera página (la
     extensión es otra y la página N puede no existir).
   - El servicio no devuelve el total de objetos (la API tira
     `numberMatched`), así que el paginado usa la regla de la página llena:
     si la página trae menos objetos que el límite, no hay siguiente.

   PROYECCIONES (lo que se manda en cada caso):
     - WFS: SIEMPRE el bbox en EPSG:3857. En 2D la proyección del mapa ya
       es 3857; en 3D (EPSG:4979, grados) se reproyecta. Se evita 4326 a
       propósito porque en WFS 2.0 su orden de ejes es lat,lon y hay
       servidores que lo aplican (medido con el WFS de IDENA: con
       `bbox=lat,lon,...` devuelve 0 objetos y con `lon,lat` los 862
       esperados). Con 3857 no hay ambigüedad y el `srsname` de la
       respuesta lo sigue poniendo la API (3857 en 2D, 4326 en 3D).
     - OGC API Features: SIEMPRE longitud, latitud (CRS84), que es lo que
       exige la especificación; el servicio de la API no manda `bbox-crs`.

   CUÁNDO SE REPITE LA PETICIÓN:
   Al terminar un movimiento del mapa (evento `moveend` de OpenLayers en 2D
   y `camera.moveEnd` de Cesium en 3D), con un retardo para no pedir en cada
   frame. Solo se piden las capas que estén en modo "vista" y solo si la
   petición (extensión, límite y página) ha cambiado respecto a la última.

   ESTADO 2D/3D:
   Las capas se recrean en cada reinicio del mapa (cambioImpl), así que el
   modo, el límite y la página de cada capa se guardan por `legend`/`name`
   (identificadores estables; los `idLayer` se regeneran) en
   getState()/setState(), el contrato que coordina window.EstadoPlugins.

   ALCANCE:
   No toca ext/layergroup_cesium/ ni el bundle de la API. No hay UI propia:
   los controles viven en la ventana de información del selector de capas.
   ===================================================================== */

(function () {
  'use strict';

  // Tipos de capa que se saben pedir por bbox. Se comparan por el nombre del
  // tipo de la fachada (`layer.type`), que es el que usan los ayudantes del
  // selector (`getLayerKind`).
  var TIPO_WFS = 'WFS';
  var TIPO_OGCAPI = 'OGCAPIFeatures';
  var TIPO_FLATGEOBUF = 'FlatGeobuf';
  var TIPO_GEOPARQUET = 'GeoParquet';

  // Espera tras el último movimiento antes de pedir. Un paneo emite un
  // `moveend` por gesto y una rueda puede emitir varios seguidos; 350 ms
  // agrupa la ráfaga sin que se note el retraso en la capa.
  var RETARDO_MOVIMIENTO = 350;

  // Objetos geográficos que se piden al servicio por página. El límite se
  // aplica SIEMPRE (también en modo "todas"): sin él, una capa nacional se
  // trae todos los registros del servicio de golpe y bloquea el navegador.
  var LIMITE_POR_DEFECTO = 100;

  // Tamaños de página que ofrece la ventana de información.
  var LIMITES = [25, 50, 100, 200, 500];

  // EPSG:3857 completo (el mundo en metros). Un bbox mayor que esto es la
  // vista entera: no se filtra y se piden todos los objetos.
  var MITAD_MUNDO = 20037508.342789244;
  var ANCHO_MUNDO_3857 = MITAD_MUNDO * 2;

  /**
   * Tipo de capa de la extensión, o null si no es una capa filtrable.
   * @param {Object} capa Capa de la API-IDEE.
   * @returns {string|null} 'WFS', 'OGCAPIFeatures' o null.
   */
  function tipoDeCapa(capa) {
    if (!capa) return null;
    var tipo = '';
    try { tipo = String(capa.type || capa._type || ''); } catch (e) { tipo = ''; }
    if (!tipo) {
      try { tipo = String((capa.getImpl && capa.getImpl().type) || ''); } catch (e) { tipo = ''; }
    }
    if (tipo === TIPO_WFS) return TIPO_WFS;
    if (tipo === TIPO_OGCAPI) return TIPO_OGCAPI;
    // FlatGeobuf y GeoParquet se sirven como IDEE.layer.GeoJSON, asi que se
    // reconocen por la marca que pone su extension al crear la capa.
    try { if (capa && capa._flatgeobuf) return TIPO_FLATGEOBUF; } catch (e) { /* noop */ }
    try { if (capa && capa._geoparquet) return TIPO_GEOPARQUET; } catch (e) { /* noop */ }
    return null;
  }

  /**
   * Identificador estable de la capa: `legend` si no es el idLayer
   * autogenerado, y si no `name`. Es el mismo criterio que usa el selector
   * de capas para su estado y lo que sobrevive al cambio 2D/3D.
   * @param {Object} capa Capa de la API-IDEE.
   * @returns {string|null} Identificador o null.
   */
  function identificadorDe(capa) {
    if (!capa) return null;
    try {
      var legend = capa.legend;
      if (legend && String(legend) !== String(capa.idLayer)) return String(legend);
      if (capa.name) return String(capa.name);
    } catch (e) { /* sin identificador */ }
    return null;
  }

  /**
   * Reproyecta un punto con el ayudante de la API. Devuelve null si no se
   * puede (proyección desconocida, API sin el ayudante...): en ese caso el
   * plugin prefiere pedir todos los objetos antes que mandar un bbox mal.
   * @param {number[]} punto [x, y].
   * @param {string} desde Código de la proyección de origen.
   * @param {string} hasta Código de la proyección de destino.
   * @returns {number[]|null} [x, y] reproyectado o null.
   */
  function reproyectar(punto, desde, hasta) {
    if (desde === hasta) return [Number(punto[0]), Number(punto[1])];
    try {
      if (typeof IDEE !== 'undefined' && IDEE.utils &&
          typeof IDEE.utils.reproject === 'function') {
        var p = IDEE.utils.reproject([Number(punto[0]), Number(punto[1])], desde, hasta);
        if (p && isFinite(p[0]) && isFinite(p[1])) return [p[0], p[1]];
      }
    } catch (e) { /* sin reproyección */ }
    return null;
  }

  class miPlugin_bboxFeatures {
    /**
     * @param {Object} [options]
     * @param {number} [options.retardo] Milisegundos de espera tras mover el
     *   mapa antes de pedir los objetos de la vista (350 por defecto).
     */
    constructor(options) {
      this.name = 'miPlugin_bboxFeatures';
      this.options = options || {};
      this._retardo = (typeof this.options.retardo === 'number' && this.options.retardo >= 0)
        ? this.options.retardo
        : RETARDO_MOVIMIENTO;

      this._map = null;

      // Modo "solo la vista" por identificador estable de capa. Es un objeto
      // plano para que getState() devuelva algo serializable tal cual.
      this._todas = {};

      // Límite de objetos por página y desplazamiento (paginado en el
      // servidor) por identificador estable de capa.
      this._limite = {};
      this._offset = {};

      // Último bbox pedido a cada capa (por identificador), para no repetir
      // la petición cuando el movimiento del mapa no cambia la extensión.
      this._ultimoBBox = {};

      // Capas que ya han pintado alguna vez (primera carga terminada).
      this._listos = {};

      this._manejador = null;
      this._oyentes = [];
      this._temporizador = null;
      this._esperaId = 0;
    }

    // ── Alta / baja en el mapa ──────────────────────────────────────────
    /**
     * Engancha el plugin al mapa: escucha el fin de los movimientos y publica
     * el ayudante window.miBBoxFeatures que consume el selector de capas.
     * @param {Object} map Mapa de la API-IDEE.
     */
    addTo(map) {
      this._map = map;
      this._instalarEscucha(map);

      var self = this;
      window.miBBoxFeatures = {
        /** ¿La extensión sabe filtrar esta capa? */
        soporta: function (capa) { return !!tipoDeCapa(capa); },
        /** 'vista' si la capa está en modo solo la vista, 'todas' si no. */
        getModo: function (capa) { return self.getModo(capa); },
        /** Cambia el modo y recarga la capa con (o sin) bbox. */
        setModo: function (capa, modo) { self.setModo(capa, modo); },
        /** Límite de objetos por página de la capa. */
        getLimite: function (capa) { return self.getLimite(capa); },
        /** Cambia el límite y vuelve a la primera página. */
        setLimite: function (capa, n) { self.setLimite(capa, n); },
        /** Página (1..n) que se está pidiendo al servicio. */
        setPagina: function (capa, pagina) { self.setPagina(capa, pagina); },
        /** Modo, límite, página y si hay páginas anterior/siguiente. */
        getEstado: function (capa) { return self.getEstado(capa); },
        /** Tamaños de página que ofrece la ventana de información. */
        limites: function () { return LIMITES.slice(); },
        /** Vuelve a aplicar el modo de todas las capas filtrables del mapa. */
        aplicarTodo: function (forzar) { self._aplicarTodo(!!forzar); },
        /** Tipos de capa que atiende la extensión. */
        tipos: function () { return [TIPO_WFS, TIPO_OGCAPI, TIPO_FLATGEOBUF, TIPO_GEOPARQUET]; },
        /** La instancia que atiende ahora mismo, para depurar. */
        plugin: self
      };

      // El límite por defecto también se aplica sin tocar nada: en cuanto la
      // capa pinta su primera carga se recarga con los objetos de una página.
      this._esperarYAplicar();
    }

    /**
     * Suelta los listeners y retira el ayudante global (solo si es el de esta
     * instancia: al cambiar 2D/3D el plugin nuevo puede haberse dado de alta
     * antes de que la API destruya el viejo).
     */
    destroy() {
      this._quitarEscucha();
      try {
        if (window.miBBoxFeatures && window.miBBoxFeatures.plugin === this) {
          delete window.miBBoxFeatures;
        }
      } catch (e) { /* nada que retirar */ }
      this._map = null;
    }

    // ── Modo de cada capa ───────────────────────────────────────────────
    /**
     * @param {Object} capa Capa de la API-IDEE.
     * @returns {string} 'vista' o 'todas'.
     */
    getModo(capa) {
      var ident = identificadorDe(capa);
      return (ident && this._todas[ident]) ? 'todas' : 'vista';
    }

    /**
     * Cambia el modo de una capa y la recarga en el acto. El selector de
     * capas vuelve a pintar su lista después para marcar el botón elegido.
     * @param {Object} capa Capa de la API-IDEE.
     * @param {string} modo 'vista' o 'todas'.
     */
    setModo(capa, modo) {
      if (!tipoDeCapa(capa)) return;
      var ident = identificadorDe(capa);
      if (!ident) return;
      if (modo === 'todas') this._todas[ident] = true;
      else delete this._todas[ident];
      // Cambia lo que se pide (con o sin bbox): siempre se vuelve a la
      // primera página.
      this._offset[ident] = 0;
      // Si la capa aún está en su primera descarga, refrescar ahora sería
      // pisado por esa respuesta (ver _aplicarCuandoCargue): se programa.
      if (this._lista(capa) || modo !== 'vista') {
        this._aplicarCapa(capa, true);
      } else {
        this._esperarYAplicar();
      }
    }

    // ── Objetos por página ──────────────────────────────────────────────
    /**
     * Límite de objetos que se piden al servicio para esta capa.
     * @param {Object} capa Capa de la API-IDEE.
     * @returns {number} Límite (100 por defecto).
     */
    getLimite(capa) {
      var ident = identificadorDe(capa);
      var n = ident ? Number(this._limite[ident]) : NaN;
      return (isFinite(n) && n > 0) ? Math.round(n) : LIMITE_POR_DEFECTO;
    }

    /**
     * Estado de la petición de una capa, para pintar la barra de la ventana
     * de información.
     * @param {Object} capa Capa de la API-IDEE.
     * @returns {{modo:string, limite:number, offset:number, pagina:number,
     *   hayAnterior:boolean, haySiguiente:boolean, objetos:number}}
     */
    getEstado(capa) {
      var ident = identificadorDe(capa);
      var limite = this.getLimite(capa);
      var offset = (ident && Number(this._offset[ident]) > 0) ? Number(this._offset[ident]) : 0;
      var objetos = 0;
      try { objetos = (capa.getFeatures ? capa.getFeatures() : []).length; } catch (e) { objetos = 0; }
      // FlatGeobuf y GeoParquet no se pagan en el servidor: el fichero se
      // lee entero (o por row groups) y el paginado no tiene efecto. El
      // selector oculta límite y páginas para no ofrecer controles falsos.
      var tipo = tipoDeCapa(capa);
      var paginable = (tipo === TIPO_WFS || tipo === TIPO_OGCAPI);
      return {
        modo: this.getModo(capa),
        limite: limite,
        offset: offset,
        pagina: Math.floor(offset / limite) + 1,
        hayAnterior: paginable && offset > 0,
        // El servicio no dice cuántos objetos hay en total (la API tira
        // `numberMatched`), así que se usa la regla de la página llena: si
        // vienen menos objetos que el límite, esta es la última página.
        haySiguiente: paginable && objetos > 0 && objetos >= limite,
        paginable: paginable,
        objetos: objetos
      };
    }

    /**
     * Cambia el límite de objetos por página y vuelve a la primera.
     * @param {Object} capa Capa de la API-IDEE.
     * @param {number} n Objetos por página.
     */
    setLimite(capa, n) {
      if (!tipoDeCapa(capa)) return;
      var ident = identificadorDe(capa);
      if (!ident) return;
      var valor = Math.round(Number(n));
      if (!isFinite(valor) || valor < 1) valor = LIMITE_POR_DEFECTO;
      this._limite[ident] = valor;
      this._offset[ident] = 0;
      this._aplicarCapa(capa, true);
    }

    /**
     * Salta a una página (1..n) de la capa. El paginado se resuelve en el
     * servicio: se pide el desplazamiento equivalente.
     * @param {Object} capa Capa de la API-IDEE.
     * @param {number} pagina Página, empezando en 1.
     */
    setPagina(capa, pagina) {
      if (!tipoDeCapa(capa)) return;
      var ident = identificadorDe(capa);
      if (!ident) return;
      var limite = this.getLimite(capa);
      var p = Math.round(Number(pagina));
      if (!isFinite(p) || p < 1) p = 1;
      this._offset[ident] = (p - 1) * limite;
      this._aplicarCapa(capa, true);
    }

    // ── Estado 2D/3D (contrato de window.EstadoPlugins) ─────────────────
    /**
     * Estado serializable: capas en modo "solo la vista" y, solo cuando no
     * están en el valor por defecto, el límite y la página de cada una.
     * @returns {{vista: string[], limite: Object, offset: Object}}
     */
    getState() {
      var estado = { todas: Object.keys(this._todas) };
      var limites = {};
      var offsets = {};
      var id;
      for (id in this._limite) {
        if (Object.prototype.hasOwnProperty.call(this._limite, id)
          && Number(this._limite[id]) !== LIMITE_POR_DEFECTO) {
          limites[id] = Number(this._limite[id]);
        }
      }
      for (id in this._offset) {
        if (Object.prototype.hasOwnProperty.call(this._offset, id) && Number(this._offset[id]) > 0) {
          offsets[id] = Number(this._offset[id]);
        }
      }
      estado.limite = limites;
      estado.offset = offsets;
      return estado;
    }

    /**
     * Rehidrata los modos, los límites y las páginas en la instancia nueva y
     * los aplica a las capas recién creadas. Es idempotente: se puede llamar
     * varias veces.
     * @param {Object} state Estado devuelto por getState().
     * @param {Object} map Mapa nuevo.
     */
    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      var lista = Array.isArray(state.todas) ? state.todas : [];
      this._todas = {};
      for (var i = 0; i < lista.length; i += 1) {
        if (lista[i] !== undefined && lista[i] !== null && lista[i] !== '') {
          this._todas[String(lista[i])] = true;
        }
      }
      this._limite = {};
      this._offset = {};
      var id;
      for (id in (state.limite || {})) {
        if (Object.prototype.hasOwnProperty.call(state.limite, id) && Number(state.limite[id]) > 0) {
          this._limite[String(id)] = Math.round(Number(state.limite[id]));
        }
      }
      for (id in (state.offset || {})) {
        if (Object.prototype.hasOwnProperty.call(state.offset, id) && Number(state.offset[id]) > 0) {
          this._offset[String(id)] = Math.round(Number(state.offset[id]));
        }
      }
      if (map) this._map = map;
      if (!this._map) return;

      // La instancia nueva puede no haber pasado por addTo todavía (el orden
      // de restauración depende de cuándo se registró cada plugin).
      this._quitarEscucha();
      this._instalarEscucha(this._map);

      // Las capas son nuevas: ni bbox pedido ni primera carga terminada.
      this._ultimoBBox = {};
      this._listos = {};
      this._esperarYAplicar();
    }

    /**
     * Arranca una espera a la primera carga. Cada llamada invalida la
     * anterior (solo hay una espera viva), para no aplicar dos veces el mismo
     * bbox cuando coinciden la restauración 2D/3D y un clic del usuario.
     */
    _esperarYAplicar() {
      this._esperaId = (this._esperaId || 0) + 1;
      this._aplicarCuandoCargue(0, this._esperaId);
    }

    /**
     * Aplica el bbox cuando las capas ya han terminado su PRIMERA carga.
     *
     * Por qué se espera: al recrear el mapa (cambio 2D/3D) cada capa lanza una
     * petición inicial sin bbox (todos los objetos). Si se refresca con bbox
     * mientras esa petición sigue viva, la respuesta vieja llega después y
     * sobrescribe los objetos buenos: en 3D el WFS de IDENA tarda varios
     * segundos en pintar 1000 objetos y el refresco con bbox (unos pocos)
     * termina antes, dejando la capa con 1000 aunque el botón diga "La vista".
     * Se sondea la capa hasta que pinta objetos y se aplica entonces. Si no
     * carga (servicio caído, colección vacía) se aplica igualmente al agotar
     * el plazo, para no dejar el modo sin efecto.
     * @param {number} intento Número de sondeo (interno).
     * @param {number|null} esperaId Identificador de la espera (interno).
     */
    _aplicarCuandoCargue(intento, esperaId) {
      var self = this;
      if (!this._map) return;
      // La ha sustituido otra espera más reciente: no aplicar dos veces.
      if (esperaId !== undefined && esperaId !== null && esperaId !== this._esperaId) return;
      // Se espera a TODAS las capas filtrables, estén en "todas" o en "la
      // vista": el límite de objetos también se aplica a las de "todas".
      var pendientes = this._capas(this._map).filter(function (capa) {
        return !!tipoDeCapa(capa) && !self._lista(capa);
      });

      // 40 sondeos x 500 ms = 20 s de margen para la primera descarga (en 3D
      // la capa tarda en pintar: espera a las teselas del globo).
      if (pendientes.length && intento < 40) {
        setTimeout(function () { self._aplicarCuandoCargue(intento + 1, esperaId); }, 500);
        return;
      }

      this._ultimoBBox = {};
      var capas = this._capas(this._map);
      for (var i = 0; i < capas.length; i += 1) {
        if (tipoDeCapa(capas[i])) this._aplicarCapa(capas[i], true);
      }
    }

    /**
     * ¿La capa ya pintó objetos al menos una vez? Se usa para no pisar una
     * petición inicial en vuelo (ver _aplicarCuandoCargue). `impl.isLoaded()`
     * solo no vale: en Cesium la capa lo pone a true en cuanto llega la
     * respuesta, pero los objetos se añaden después, en lotes y esperando a
     * que el globo tenga las teselas (varios segundos con 1000 objetos).
     * @param {Object} capa Capa de la API-IDEE.
     * @returns {boolean}
     */
    _lista(capa) {
      var ident = identificadorDe(capa);
      if (ident && this._listos[ident]) return true;
      try {
        // FlatGeobuf se carga por bbox desde el inicio: se considera "listo"
        // de inmediato para que bboxFeatures aplique el bbox inicial sin
        // esperar a que pinte features (que nunca pintaria si espera).
        if (tipoDeCapa(capa) === TIPO_FLATGEOBUF ||
            tipoDeCapa(capa) === TIPO_GEOPARQUET) return true;
        var impl = capa.getImpl ? capa.getImpl() : null;
        if (!impl) return false;
        if (typeof impl.isLoaded === 'function' && !impl.isLoaded()) return false;
        var fs = (typeof capa.getFeatures === 'function') ? capa.getFeatures() : null;
        return !!(fs && fs.length > 0);
      } catch (e) { return true; }
    }

    // ── Escucha del movimiento del mapa ────────────────────────────────
    /** ¿El mapa está en 3D (Cesium)? Mismo criterio que cambioImpl. */
    _esCesium() {
      try {
        var impl = (this._map && typeof this._map.getMapImpl === 'function')
          ? this._map.getMapImpl()
          : null;
        return !!(impl && impl.scene && impl.camera);
      } catch (e) { return false; }
    }

    /**
     * Escucha el final de los movimientos: `moveend` en OpenLayers y
     * `camera.moveEnd` de Cesium en 3D.
     * @param {Object} map Mapa de la API-IDEE.
     */
    _instalarEscucha(map) {
      var self = this;
      if (this._manejador) return;
      this._manejador = function () { self._programar(); };
      var impl = null;
      try { impl = map.getMapImpl(); } catch (e) { impl = null; }
      if (!impl) return;

      try {
        if (this._esCesium()) {
          if (impl.camera && impl.camera.moveEnd &&
              typeof impl.camera.moveEnd.addEventListener === 'function') {
            impl.camera.moveEnd.addEventListener(this._manejador);
            this._oyentes.push({ cesium: true, impl: impl, fn: this._manejador });
          }
        } else if (typeof impl.on === 'function') {
          impl.on('moveend', this._manejador);
          this._oyentes.push({ cesium: false, impl: impl, fn: this._manejador });
        }
      } catch (e) {
        console.warn('bboxFeatures: no se pudo escuchar el movimiento del mapa', e);
      }
    }

    /** Suelta los listeners y el temporizador pendiente. */
    _quitarEscucha() {
      for (var i = 0; i < this._oyentes.length; i += 1) {
        var o = this._oyentes[i];
        try {
          if (o.cesium) {
            o.impl.camera.moveEnd.removeEventListener(o.fn);
          } else if (typeof o.impl.un === 'function') {
            o.impl.un('moveend', o.fn);
          } else if (typeof o.impl.removeEventListener === 'function') {
            o.impl.removeEventListener('moveend', o.fn);
          }
        } catch (e) { /* el mapa ya no existe */ }
      }
      this._oyentes = [];
      this._manejador = null;
      if (this._temporizador) {
        clearTimeout(this._temporizador);
        this._temporizador = null;
      }
    }

    /** Agrupa los movimientos seguidos en una sola pasada. */
    _programar() {
      var self = this;
      if (this._temporizador) clearTimeout(this._temporizador);
      this._temporizador = setTimeout(function () {
        self._temporizador = null;
        // El mapa se ha movido: lo que se pide es otra extensión, así que se
        // vuelve a la primera página. Si no, se seguiría pidiendo la página 4
        // de una vista nueva en la que puede no haber más de 30 objetos.
        var capas = self._capas(self._map);
        for (var i = 0; i < capas.length; i += 1) {
          var ident = identificadorDe(capas[i]);
          if (ident && self.getModo(capas[i]) === 'vista') self._offset[ident] = 0;
        }
        self._aplicarTodo(false);
      }, this._retardo);
    }

    // ── Aplicación del bbox ─────────────────────────────────────────────
    /**
     * Recorre las capas del mapa (también dentro de grupos) y recarga las
     * que estén en modo "vista".
     * @param {boolean} forzar Recarga aunque el bbox no haya cambiado.
     */
    _aplicarTodo(forzar) {
      var capas = this._capas(this._map);
      for (var i = 0; i < capas.length; i += 1) {
        if (this.getModo(capas[i]) !== 'vista') continue;
        // Sin forzar (movimiento del mapa) no se toca una capa que todavía
        // está en su primera descarga; ya la aplicará _aplicarCuandoCargue.
        if (!forzar && !this._lista(capas[i])) continue;
        this._aplicarCapa(capas[i], forzar);
      }
    }

    /**
     * Escribe (o retira) el bbox de la vista, el límite de objetos y la página
     * en el impl de la capa y la recarga. Guarda el valor original del bbox
     * para devolverlo al volver a "todas".
     * @param {Object} capa Capa de la API-IDEE.
     * @param {boolean} forzar Recarga aunque la petición sea la misma.
     */
    _aplicarCapa(capa, forzar) {
      var tipo = tipoDeCapa(capa);
      if (!tipo) return;
      var impl = null;
      try { impl = capa.getImpl ? capa.getImpl() : null; } catch (e) { impl = null; }
      if (!impl) return;

      var ident = identificadorDe(capa) || String(capa.idLayer || '');
      var modoVista = (this.getModo(capa) === 'vista');
      var bbox = modoVista ? this._bbox(tipo, capa) : null;
      var limite = this.getLimite(capa);
      var offset = (Number(this._offset[ident]) > 0) ? Number(this._offset[ident]) : 0;

      // Sin vista (o vista del mundo entero) no se filtra por extensión: se
      // piden todos los objetos, pero solo una página (el límite se aplica
      // en los dos modos). La clave incluye extensión, límite y página: al
      // cambiar cualquiera de los tres hay que volver a pedir.
      var clave = (bbox || '') + '|' + limite + '|' + offset;
      // GeoParquet calcula su propio bbox en la CRS del fichero (que puede no
      // ser 4326 ni 3857). Para no bloquear el refresco al mover el mapa, la
      // clave usa el bbox del mapa tal cual.
      if (tipo === TIPO_GEOPARQUET) {
        try { clave = JSON.stringify(this._map.getBbox()) + '|' + limite + '|' + offset; } catch (e) { /* noop */ }
      }
      if (!forzar && this._ultimoBBox[ident] === clave) return;

      // La capa puede llevar ya justo esta petición (el visualizador la creó
      // con el mismo límite): refrescarla otra vez sería una petición
      // idéntica de más en el arranque.
      if (this._peticionPuesta(capa, tipo, impl, bbox, limite, offset)) {
        this._ultimoBBox[ident] = clave;
        this._listos[ident] = true;
        return;
      }

      // FlatGeobuf: la fuente se rehace descargando el fichero entero (sin
      // bbox) o solo las features del bbox (HTTP Range, con indice espacial).
      // Se hace de forma asincrona; el resto del flujo (WFS/OGC) sigue el
      // camino sincrono de abajo.
      if (tipo === TIPO_FLATGEOBUF || tipo === TIPO_GEOPARQUET) {
        // La propia capa sabe calcular el bbox visible, cachear la ultima
        // carga y refrescarse igual en 2D y en 3D (en 3D ademas escucha el
        // moveEnd de la camara). Aqui solo se le pide el modo.
        if (capa && typeof capa._recargar === 'function') {
          capa._recargar(modoVista ? 'vista' : 'todas', this._map, false);
          this._ultimoBBox[ident] = clave;
          this._listos[ident] = true;
          return;
        }
      }

      if (tipo === TIPO_FLATGEOBUF) {
        // Respaldo para versiones antiguas sin `_recargar`.
        var selfFg = this;
        var urlFg = null;
        try { urlFg = capa._flatgeobufUrl || capa.url; } catch (e) { urlFg = capa.url; }
        var crsFg = (capa && capa._flatgeobufCRS) ? capa._flatgeobufCRS : 'EPSG:4326';
        // Convertir el bbox (string en 3857, salvo OGC que es lon/lat) a un
        // rect en la CRS del fichero.
        var rectFg = null;
        if (bbox) {
          var partes = String(bbox).split(',');
          // 5 partes -> 3857; 4 partes -> lon,lat
          if (partes.length >= 4) {
            var n0 = Number(partes[0]);
            var n1 = Number(partes[1]);
            var n2 = Number(partes[2]);
            var n3 = Number(partes[3]);
            if (isFinite(n0) && isFinite(n1) && isFinite(n2) && isFinite(n3)) {
              if (crsFg === 'EPSG:4326' && partes.length === 4) {
                rectFg = { minX: n0, minY: n1, maxX: n2, maxY: n3 };
              } else if (crsFg === 'EPSG:3857') {
                rectFg = { minX: n0, minY: n1, maxX: n2, maxY: n3 };
              } else {
                // Convertir el bbox 3857 a la CRS del fichero via el mapa.
                // Fallback: pedir todo.
                rectFg = null;
              }
            }
          }
        }
        var apiFg = (typeof window !== 'undefined')
          ? (window.flatgeobufLayer || window.miFlatGeobuf)
          : null;
        var promesaFg = null;
        if (rectFg && apiFg && typeof apiFg.cargarBbox === 'function') {
          promesaFg = apiFg.cargarBbox(urlFg, rectFg, crsFg);
        } else if (apiFg && typeof apiFg.cargar === 'function') {
          promesaFg = apiFg.cargar(urlFg, {});
        } else {
          console.warn('bboxFeatures: flatgeobuf sin ayudante, no se recarga');
          return;
        }
        promesaFg.then(function (fc) {
          try {
            impl.setSource(fc);
            selfFg._ultimoBBox[ident] = clave;
            selfFg._listos[ident] = true;
          } catch (e2) {
            console.warn('bboxFeatures: flatgeobuf setSource', e2);
          }
        }).catch(function (e3) {
          console.warn('bboxFeatures: flatgeobuf fetch', e3);
        });
        return;
      }

      try {
        if (tipo === TIPO_WFS) {
          if (!impl._bboxFeaturesOriginal) {
            var vendorPrevio = impl.options && impl.options.vendor;
            var getFeaturePrevio = vendorPrevio && vendorPrevio.getFeature;
            impl._bboxFeaturesOriginal = {
              bbox: getFeaturePrevio ? getFeaturePrevio.bbox : undefined,
              count: getFeaturePrevio ? getFeaturePrevio.count : undefined,
              maxFeatures: getFeaturePrevio ? getFeaturePrevio.maxFeatures : undefined,
              startIndex: getFeaturePrevio ? getFeaturePrevio.startIndex : undefined
            };
          }
          if (!impl.options) impl.options = {};
          if (!impl.options.vendor) impl.options.vendor = {};
          if (!impl.options.vendor.getFeature) impl.options.vendor.getFeature = {};
          var gf = impl.options.vendor.getFeature;
          var original = impl._bboxFeaturesOriginal.bbox;
          if (bbox) {
            gf.bbox = bbox;
          } else if (typeof original === 'string' && original) {
            gf.bbox = original;
          } else {
            delete gf.bbox;
          }
          // Página pedida al servicio. WFS 2.0 usa `count`/`startIndex` y
          // 1.1 `maxFeatures`/`startIndex`; el vendor los mezcla en la URL
          // igual que el bbox. `startIndex` solo cuando hay página que
          // saltar, para no ensuciar la URL de la primera.
          var campoLimite = (this._versionWfs(capa).charAt(0) === '1') ? 'maxFeatures' : 'count';
          var campoOtro = (campoLimite === 'count') ? 'maxFeatures' : 'count';
          gf[campoLimite] = limite;
          if (offset > 0) gf.startIndex = offset;
          else delete gf.startIndex;
          // No dejar puesto el campo de la otra versión si lo hubiera.
          if (impl._bboxFeaturesOriginal[campoOtro] === undefined) delete gf[campoOtro];
        } else {
          if (!impl._bboxFeaturesOriginal) {
            impl._bboxFeaturesOriginal = {
              bbox: impl.bbox,
              limit: impl.limit,
              offset: impl.offset
            };
          }
          var originalOgc = impl._bboxFeaturesOriginal.bbox;
          if (bbox) {
            impl.bbox = bbox;
          } else if (typeof originalOgc === 'string' && originalOgc) {
            impl.bbox = originalOgc;
          } else {
            delete impl.bbox;
          }
          // El impl de OGC API Features construye el servicio con `limit` y
          // `offset` en cada refresco: basta con dejarlos puestos.
          impl.limit = limite;
          impl.offset = offset;
        }
      } catch (e) {
        console.warn('bboxFeatures: no se pudo escribir el bbox en la capa', e);
        return;
      }

      try {
        // `true` borra los objetos actuales y rehace la fuente: es la
        // recarga que ya usa la API para el CQL y los cambios de URL.
        impl.refresh(true);
        this._ultimoBBox[ident] = clave;
        this._listos[ident] = true;
      } catch (e) {
        console.warn('bboxFeatures: no se pudo recargar la capa', e);
      }
    }

    /**
     * ¿La capa ya lleva exactamente la petición que se quiere (extensión,
     * límite y página)? Sirve para no repetir en el arranque una petición
     * idéntica a la que ya lanzó el visualizador al crear la capa con el mismo
     * límite (WFS: `vendorOptions.getFeature.count`; OGC API: `limit`).
     * @param {Object} capa Capa de la API-IDEE.
     * @param {string} tipo Tipo de la capa ('WFS' u 'OGCAPIFeatures').
     * @param {Object} impl Implementación de la capa.
     * @param {string|null} bbox Extensión que se quiere pedir.
     * @param {number} limite Objetos por página que se quieren.
     * @param {number} offset Desplazamiento que se quiere.
     * @returns {boolean}
     */
    _peticionPuesta(capa, tipo, impl, bbox, limite, offset) {
      try {
        if (tipo === TIPO_FLATGEOBUF || tipo === TIPO_GEOPARQUET) {
          // La capa (`_recargar`) lleva su propia cache de modo+bbox. Aqui
          // siempre hay que dejarla pasar para que decida si recarga o no.
          return false;
        }
        if (tipo === TIPO_WFS) {
          var gf = (impl.options && impl.options.vendor) ? impl.options.vendor.getFeature : null;
          if (!gf) return false;
          var campo = (this._versionWfs(capa).charAt(0) === '1') ? 'maxFeatures' : 'count';
          var puestoLimite = Number(gf[campo]);
          var puestoOffset = (gf.startIndex === undefined || gf.startIndex === null) ? 0 : Number(gf.startIndex);
          var puestoBbox = (typeof gf.bbox === 'string') ? gf.bbox : '';
          return puestoLimite === limite && puestoOffset === offset && puestoBbox === (bbox || '');
        }
        var limiteImpl = Number(impl.limit);
        var offsetImpl = (impl.offset === undefined || impl.offset === null) ? 0 : Number(impl.offset);
        var bboxImpl = (typeof impl.bbox === 'string') ? impl.bbox : '';
        return limiteImpl === limite && offsetImpl === offset && bboxImpl === (bbox || '');
      } catch (e) {
        return false;
      }
    }

    /**
     * Versión del servicio WFS de la capa. En 1.x el límite de objetos se pide
     * con `maxFeatures` y en 2.0 con `count`.
     * @param {Object} capa Capa de la API-IDEE.
     * @returns {string} Versión ('2.0.0' si no se puede averiguar).
     */
    _versionWfs(capa) {
      var v = '';
      try { v = String(capa.version || ''); } catch (e) { v = ''; }
      if (!v) {
        try {
          var userParams = capa.constructorParameters && capa.constructorParameters.userParameters;
          v = String((userParams && userParams.version) || '');
        } catch (e2) { v = ''; }
      }
      if (!v) {
        try {
          var url = String(capa.url || '');
          var m = url.match(/[?&]version=([^&]+)/i);
          if (m) v = decodeURIComponent(m[1]);
        } catch (e3) { v = ''; }
      }
      return v || '2.0.0';
    }

    /**
     * Bbox de la vista en el sistema que espera el servicio.
     * @param {string} tipo 'WFS' u 'OGCAPIFeatures'.
     * @returns {string|null} bbox listo para la URL, o null si no se puede
     *   filtrar (sin vista, mundo entero, proyección desconocida...).
     */
    _bbox(tipo, capa) {
      var map = this._map;
      if (!map) return null;

      var crsFlat = (capa && capa._flatgeobufCRS) ? capa._flatgeobufCRS : null;

      var b = null;
      try { b = map.getBbox(); } catch (e) { b = null; }
      if (!b || !b.x || !b.y) return null;
      var minx = Number(b.x.min);
      var miny = Number(b.y.min);
      var maxx = Number(b.x.max);
      var maxy = Number(b.y.max);
      if (!isFinite(minx) || !isFinite(miny) || !isFinite(maxx) || !isFinite(maxy)) return null;
      if (maxx <= minx || maxy <= miny) return null;

      var proj = {};
      try { proj = map.getProjection() || {}; } catch (e) { proj = {}; }
      var code = String(proj.code || '');
      var grados = (String(proj.units || '') === 'd') ||
        code === 'EPSG:4326' || code === 'EPSG:4979';

      // Vista del mundo entero (o que cruza el antimeridiano, que no se puede
      // expresar en un solo bbox): mejor todos los objetos que un filtro
      // que se coma media Tierra.
      if (grados) {
        if ((maxx - minx) >= 359 || (maxy - miny) >= 179) return null;
        if (minx < -180.000001 || maxx > 180.000001) return null;
      } else {
        if ((maxx - minx) >= ANCHO_MUNDO_3857) return null;
      }

      if (tipo === TIPO_OGCAPI || (tipo === TIPO_FLATGEOBUF && crsFlat === 'EPSG:4326')) {
        // CRS84: longitud, latitud.
        var ll;
        if (grados) {
          ll = [minx, miny, maxx, maxy];
        } else {
          var swLl = reproyectar([minx, miny], code, 'EPSG:4326');
          var neLl = reproyectar([maxx, maxy], code, 'EPSG:4326');
          if (!swLl || !neLl) return null;
          ll = [swLl[0], swLl[1], neLl[0], neLl[1]];
        }
        return ll.join(',');
      }

      // WFS: EPSG:3857, sin ambigüedad de orden de ejes.
      var m;
      if (!grados && code === 'EPSG:3857') {
        m = [minx, miny, maxx, maxy];
      } else {
        var desde = grados ? 'EPSG:4326' : code;
        var sw = reproyectar([minx, miny], desde, 'EPSG:3857');
        var ne = reproyectar([maxx, maxy], desde, 'EPSG:3857');
        if (!sw || !ne) return null;
        m = [sw[0], sw[1], ne[0], ne[1]];
      }
      return m.join(',') + ',EPSG:3857';
    }

    /**
     * Capas filtrables del mapa, incluidas las hijas de grupos anidados.
     * @param {Object} map Mapa de la API-IDEE.
     * @returns {Array<Object>} Capas WFS / OGC API Features.
     */
    _capas(map) {
      var salida = [];
      if (!map || typeof map.getLayers !== 'function') return salida;
      try {
        var pila = (map.getLayers() || []).slice();
        while (pila.length) {
          var capa = pila.pop();
          if (!capa) continue;
          var esGrupo = (typeof capa.getLayers === 'function') ||
            capa.type === 'LayerGroup' || capa._type === 'LayerGroup';
          if (esGrupo) {
            var hijas = [];
            try { hijas = capa.getLayers() || []; } catch (e) { hijas = []; }
            for (var i = 0; i < hijas.length; i += 1) pila.push(hijas[i]);
          } else if (tipoDeCapa(capa)) {
            salida.push(capa);
          }
        }
      } catch (e) { /* sin capas */ }
      return salida;
    }
  }

  // =====================================================================
  // EXPOSICIÓN TRIPLE GLOBAL DEL PLUGIN
  // =====================================================================
  // Al alternar entre OpenLayers (2D) y Cesium (3D) con cambioImpl, la API
  // recarga su bundle y reinicializa window.IDEE.plugin / window.M.plugin.
  // Exponer la clase también en el ámbito global directo permite
  // re-instanciarla sin volver a cargar este fichero.
  // =====================================================================
  if (typeof window !== 'undefined') {
    window.miPlugin_bboxFeatures = miPlugin_bboxFeatures;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_bboxFeatures = miPlugin_bboxFeatures;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_bboxFeatures = miPlugin_bboxFeatures;
  }
})();
