/* =====================================================================
   EXTENSIÓN DE ENTIDADES POR BBOX (WFS y OGC API Features)
   Repositorio: Galeria_de_mapas
   =====================================================================

   QUÉ ES:
   Un plugin sin interfaz propia que enseña a las capas WFS y OGC API
   Features a pedir al servicio SOLO las entidades de la vista (BBOX) y a
   repetir la petición cuando el mapa se mueve. El control para elegir entre
   "todas" y "solo la vista" lo pinta el selector de capas
   (ext/selectorCapas/ext_layerSwitcher.js), que delega aquí a través de
   window.miBBoxFeatures.

   POR QUÉ HACE FALTA:
   La API-IDEE 1.1.0 descarga las entidades UNA sola vez, sin extensión: el
   loader de features (módulo 26437 del bundle) llama siempre
   `service_.getFeatureUrl(null, proyección)`, es decir, con el extent a
   null. Los servicios sí saben filtrar:
     - WFS: `getFeatureUrl(extent, proyeccion)` añade
       `&bbox=minx,miny,maxx,maxy,<CRS>` cuando el extent no es null.
     - OGC API Features: el servicio lee `bbox` del constructor y lo mete
       como `bbox=minx,miny,maxx,maxy` (CRS84: longitud, latitud).
   Pero ninguna fachada de capa expone esas opciones al visualizador.

   CÓMO SE INYECTA EL BBOX (medido, sin tocar el bundle):
     - WFS: el parámetro de vendor `getFeature` se mezcla al final de la URL
       de GetFeature, así que basta escribir
         impl.options.vendor.getFeature.bbox = 'minx,miny,maxx,maxy,EPSG:3857'
       y llamar a `impl.refresh(true)`. Funciona igual en 2D y en 3D: en 2D
       el impl de OpenLayers crea un servicio nuevo en cada refresco con
       `this.options.vendor`; en 3D el de Cesium hace lo mismo y la URL ya
       sale con el bbox.
     - OGC API Features: la fachada sí tiene `bbox` (y el impl lo pasa al
       servicio en cada refresco), así que se escribe `impl.bbox` y se
       refresca.
   El resto de la recarga (borrar entidades, formulario, fuente nueva) lo
   hace la propia API con `refresh(true)`; aquí no se reimplementa.

   PROYECCIONES (lo que se manda en cada caso):
     - WFS: SIEMPRE el bbox en EPSG:3857. En 2D la proyección del mapa ya
       es 3857; en 3D (EPSG:4979, grados) se reproyecta. Se evita 4326 a
       propósito porque en WFS 2.0 su orden de ejes es lat,lon y hay
       servidores que lo aplican (medido con el WFS de IDENA: con
       `bbox=lat,lon,...` devuelve 0 entidades y con `lon,lat` las 862
       esperadas). Con 3857 no hay ambigüedad y el `srsname` de la
       respuesta lo sigue poniendo la API (3857 en 2D, 4326 en 3D).
     - OGC API Features: SIEMPRE longitud, latitud (CRS84), que es lo que
       exige la especificación; el servicio de la API no manda `bbox-crs`.

   CUÁNDO SE REPITE LA PETICIÓN:
   Al terminar un movimiento del mapa (evento `moveend` de OpenLayers en 2D
   y `camera.moveEnd` de Cesium en 3D), con un retardo para no pedir en cada
   frame. Solo se piden las capas que estén en modo "vista" y solo si el
   bbox ha cambiado respecto a la última petición de esa capa.

   ESTADO 2D/3D:
   Las capas se recrean en cada reinicio del mapa (cambioImpl), así que el
   modo de cada capa se guarda por `legend`/`name` (identificadores
   estables; los `idLayer` se regeneran) en getState()/setState(), el
   contrato que coordina window.EstadoPlugins.

   ALCANCE:
   No toca ext/layergroup_cesium/ ni el bundle de la API. No hay UI propia:
   el botón vive en el desplegable de opciones del selector de capas.
   ===================================================================== */

(function () {
  'use strict';

  // Tipos de capa que se saben pedir por bbox. Se comparan por el nombre del
  // tipo de la fachada (`layer.type`), que es el que usan los ayudantes del
  // selector (`getLayerKind`).
  var TIPO_WFS = 'WFS';
  var TIPO_OGCAPI = 'OGCAPIFeatures';

  // Espera tras el último movimiento antes de pedir. Un paneo emite un
  // `moveend` por gesto y una rueda puede emitir varios seguidos; 350 ms
  // agrupa la ráfaga sin que se note el retraso en la capa.
  var RETARDO_MOVIMIENTO = 350;

  // EPSG:3857 completo (el mundo en metros). Un bbox mayor que esto es la
  // vista entera: no se filtra y se piden todas las entidades.
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
   * plugin prefiere pedir todas las entidades antes que mandar un bbox mal.
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
     *   mapa antes de pedir las entidades de la vista (350 por defecto).
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
      this._vista = {};

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
        /** Vuelve a aplicar el modo de todas las capas filtrables del mapa. */
        aplicarTodo: function (forzar) { self._aplicarTodo(!!forzar); },
        /** Tipos de capa que atiende la extensión. */
        tipos: function () { return [TIPO_WFS, TIPO_OGCAPI]; },
        /** La instancia que atiende ahora mismo, para depurar. */
        plugin: self
      };
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
      return (ident && this._vista[ident]) ? 'vista' : 'todas';
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
      if (modo === 'vista') this._vista[ident] = true;
      else delete this._vista[ident];
      // Si la capa aún está en su primera descarga, refrescar ahora sería
      // pisado por esa respuesta (ver _aplicarCuandoCargue): se programa.
      if (this._lista(capa) || modo !== 'vista') {
        this._aplicarCapa(capa, true);
      } else {
        this._esperarYAplicar();
      }
    }

    // ── Estado 2D/3D (contrato de window.EstadoPlugins) ─────────────────
    /**
     * Estado serializable: los identificadores estables de las capas que
     * están en modo "solo la vista".
     * @returns {{vista: string[]}}
     */
    getState() {
      return { vista: Object.keys(this._vista) };
    }

    /**
     * Rehidrata los modos en la instancia nueva y los aplica a las capas
     * recién creadas. Es idempotente: se puede llamar varias veces.
     * @param {Object} state Estado devuelto por getState().
     * @param {Object} map Mapa nuevo.
     */
    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      var lista = Array.isArray(state.vista) ? state.vista : [];
      this._vista = {};
      for (var i = 0; i < lista.length; i += 1) {
        if (lista[i] !== undefined && lista[i] !== null && lista[i] !== '') {
          this._vista[String(lista[i])] = true;
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
     * petición inicial sin bbox (todas las entidades). Si se refresca con bbox
     * mientras esa petición sigue viva, la respuesta vieja llega después y
     * sobrescribe las entidades buenas: en 3D el WFS de IDENA tarda varios
     * segundos en pintar 1000 entidades y el refresco con bbox (unas pocas)
     * termina antes, dejando la capa con 1000 aunque el botón diga "La vista".
     * Se sondea la capa hasta que pinta entidades y se aplica entonces. Si no
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
      var pendientes = this._capas(this._map).filter(function (capa) {
        return self.getModo(capa) === 'vista' && !self._lista(capa);
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
        if (this.getModo(capas[i]) === 'vista') this._aplicarCapa(capas[i], true);
      }
      if (typeof window.renderLayerList === 'function') {
        try { window.renderLayerList(); } catch (e) { /* sin selector */ }
      }
    }

    /**
     * ¿La capa ya pintó entidades al menos una vez? Se usa para no pisar una
     * petición inicial en vuelo (ver _aplicarCuandoCargue). `impl.isLoaded()`
     * solo no vale: en Cesium la capa lo pone a true en cuanto llega la
     * respuesta, pero las entidades se añaden después, en lotes y esperando a
     * que el globo tenga las teselas (varios segundos con 1000 entidades).
     * @param {Object} capa Capa de la API-IDEE.
     * @returns {boolean}
     */
    _lista(capa) {
      var ident = identificadorDe(capa);
      if (ident && this._listos[ident]) return true;
      try {
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
     * Escribe (o retira) el bbox en el impl de la capa y la recarga. Guarda
     * el valor original de la capa para devolverlo al volver a "todas".
     * @param {Object} capa Capa de la API-IDEE.
     * @param {boolean} forzar Recarga aunque el bbox sea el mismo.
     */
    _aplicarCapa(capa, forzar) {
      var tipo = tipoDeCapa(capa);
      if (!tipo) return;
      var impl = null;
      try { impl = capa.getImpl ? capa.getImpl() : null; } catch (e) { impl = null; }
      if (!impl) return;

      var ident = identificadorDe(capa) || String(capa.idLayer || '');
      var modoVista = (this.getModo(capa) === 'vista');
      var bbox = modoVista ? this._bbox(tipo) : null;

      // Sin vista (o vista del mundo entero) no se filtra: se piden todas.
      var clave = bbox || '';
      if (!forzar && this._ultimoBBox[ident] === clave) return;

      try {
        if (tipo === TIPO_WFS) {
          if (!impl._bboxFeaturesOriginal) {
            var vendorPrevio = impl.options && impl.options.vendor;
            var getFeaturePrevio = vendorPrevio && vendorPrevio.getFeature;
            impl._bboxFeaturesOriginal = {
              bbox: getFeaturePrevio ? getFeaturePrevio.bbox : undefined
            };
          }
          if (!impl.options) impl.options = {};
          if (!impl.options.vendor) impl.options.vendor = {};
          if (!impl.options.vendor.getFeature) impl.options.vendor.getFeature = {};
          var original = impl._bboxFeaturesOriginal.bbox;
          if (bbox) {
            impl.options.vendor.getFeature.bbox = bbox;
          } else if (typeof original === 'string' && original) {
            impl.options.vendor.getFeature.bbox = original;
          } else {
            delete impl.options.vendor.getFeature.bbox;
          }
        } else {
          if (!impl._bboxFeaturesOriginal) {
            impl._bboxFeaturesOriginal = { bbox: impl.bbox };
          }
          var originalOgc = impl._bboxFeaturesOriginal.bbox;
          if (bbox) {
            impl.bbox = bbox;
          } else if (typeof originalOgc === 'string' && originalOgc) {
            impl.bbox = originalOgc;
          } else {
            delete impl.bbox;
          }
        }
      } catch (e) {
        console.warn('bboxFeatures: no se pudo escribir el bbox en la capa', e);
        return;
      }

      try {
        // `true` borra las entidades actuales y rehace la fuente: es la
        // recarga que ya usa la API para el CQL y los cambios de URL.
        impl.refresh(true);
        this._ultimoBBox[ident] = clave;
        this._listos[ident] = true;
      } catch (e) {
        console.warn('bboxFeatures: no se pudo recargar la capa', e);
      }
    }

    /**
     * Bbox de la vista en el sistema que espera el servicio.
     * @param {string} tipo 'WFS' u 'OGCAPIFeatures'.
     * @returns {string|null} bbox listo para la URL, o null si no se puede
     *   filtrar (sin vista, mundo entero, proyección desconocida...).
     */
    _bbox(tipo) {
      var map = this._map;
      if (!map) return null;

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
      // expresar en un solo bbox): mejor todas las entidades que un filtro
      // que se coma media Tierra.
      if (grados) {
        if ((maxx - minx) >= 359 || (maxy - miny) >= 179) return null;
        if (minx < -180.000001 || maxx > 180.000001) return null;
      } else {
        if ((maxx - minx) >= ANCHO_MUNDO_3857) return null;
      }

      if (tipo === TIPO_OGCAPI) {
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
