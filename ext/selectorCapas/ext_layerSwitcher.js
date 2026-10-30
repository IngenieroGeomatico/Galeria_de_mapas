/**
 * =====================================================================
 *  window.miWrapX: que TODAS las capas ráster den la vuelta al mundo
 * =====================================================================
 *
 *  Vive aquí, en el plugin que gestiona las capas, y no en un script aparte:
 *  es cosa de las capas, así que la lleva quien las gestiona. El visualizador
 *  no tiene que cargar nada más (los 28 visores del repositorio ya cargan
 *  este fichero), y ext_backgorundLayers.js y mapInfo.js la usan con guardia.
 *
 *  Qué arregla
 *  -----------
 *  En OpenLayers una fuente de teselas pinta el mundo en bucle cuando wrapX
 *  está a true: al cruzar el antimeridiano se ve el planeta repetido, que es
 *  lo que se quiere en un mapa generalista.
 *
 *  El valor por defecto NO es el mismo en todas las fuentes, y la API no lo
 *  unifica al construirlas:
 *
 *    ol.source.TileImage (y las que heredan: XYZ, TMS)
 *        this.wrapX_ = options.wrapX !== false      ->  POR DEFECTO TRUE
 *    ol.source.TileWMTS / ol.source.TileWMS
 *        sin valor por defecto                      ->  POR DEFECTO FALSE
 *
 *  Medido en MapaBase: la capa base "Imagen" (BASE_PNOA_MA_TMS) viene con
 *  wrapX=true y "Callejero" (BASE_MapaBase_IGNBaseTodo_WMTS) con wrapX=false,
 *  así que una sí repite el mundo y la otra no, sin que el visualizador haya
 *  pedido ninguna de las dos cosas.
 *
 *  Además la API no deja pasar la opción: new IDEE.layer.TMS({wrapX: false})
 *  sigue saliendo con wrapX=true (medido), porque al impl solo se le reenvía
 *  crossOrigin. Y OJO con el otro camino: fuente.set('wrapX', false) NO sirve,
 *  porque esa versión de OpenLayers lee el CAMPO wrapX_ y no la propiedad
 *  observable (medido: get('wrapX') dice false y wrapX_ sigue en true). Hay
 *  que tocar wrapX_ y avisar con changed() para que repinte.
 *
 *  Uso
 *  ---
 *    miWrapX.aplica(mapa);            una vez tras crear el mapa
 *    miWrapX.envuelve(mapa, capa);     para una capa suelta
 *
 *  Se queda escuchando altas y bajas de la colección de capas, así que también
 *  tapa las capas que se añadan después (un catálogo, un plugin, un grupo), sin
 *  que haya que volver a llamarla. Es idempotente. En 3D no hace nada: el impl
 *  de Cesium no tiene getLayers().
 *
 *  OJO: esto es la mitad del asunto. La otra mitad es la extensión de la capa,
 *  que también recorta las copias, y de eso se encarga mapInfo (que ya tenía su
 *  modo global). Ver _recortarCapas en ext/mapInfo/mapInfo.js.
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

  /**
   * Baja al fondo de la pila las capas de una base recien puesta. Solo actua
   * en 3D: en Cesium la pila es la coleccion `imageryLayers` (indice 0 = la
   * de abajo) y las capas se anaden al final, salvo que lleven `isBase`, que
   * las mete en el 0. Las bases hechas con un grupo (el Hibrido) no llevan
   * `isBase` en sus hijas, asi que se apilaban ENCIMA de las superpuestas y el
   * fondo tapaba la capa elegida (medido: las dos hijas del Hibrido en los
   * indices 19 y 20 con 19 fondos XYZ debajo).
   *
   * Se recolocan solo las capas indicadas, conservando su orden relativo, y no
   * se toca nada si ya estan abajo. En 2D no hace nada (alli manda el z-index,
   * y las bases ya se crean por debajo).
   *
   * @param {Object} mapa Instancia del mapa API-IDEE.
   * @param {Array} capas Capas o grupos que forman la base.
   * @returns {number} Cuantas capas de Cesium se han bajado.
   */
  function bajaBase(mapa, capas) {
    let bajadas = 0;
    try {
      if (!mapa || typeof mapa.getMapImpl !== 'function') return 0;
      const impl = mapa.getMapImpl();
      const coleccion = impl && impl.imageryLayers;
      // Solo Cesium: el impl de OpenLayers no tiene imageryLayers.
      if (!coleccion || !impl.scene || !impl.scene.camera) return 0;

      const cesiumDe = function (capa) {
        try {
          const i = (capa && typeof capa.getImpl === 'function') ? capa.getImpl() : null;
          if (!i) return null;
          if (i.cesiumLayer) return i.cesiumLayer;
          if (typeof i.getLayer === 'function') return i.getLayer();
        } catch (e) { /* sin capa Cesium */ }
        return null;
      };

      const lista = [];
      const visitar = function (capa) {
        if (!capa) return;
        const esGrupo = (capa.type === 'LayerGroup' || typeof capa.getLayers === 'function');
        if (esGrupo) {
          let hijas = [];
          try { hijas = capa.getLayers ? capa.getLayers() : []; } catch (e) { hijas = []; }
          hijas.forEach(visitar);
          return;
        }
        const cl = cesiumDe(capa);
        if (cl && lista.indexOf(cl) < 0) lista.push(cl);
      };
      (capas || []).forEach(visitar);
      if (!lista.length) return 0;

      const indices = lista.map(function (cl) { return coleccion._layers.indexOf(cl); });
      if (indices.some(function (i) { return i < 0; })) return 0;   // aun no estan
      // ¿Ya estan al fondo, en el mismo orden relativo? Entonces no se toca.
      const yaAbajo = indices.slice().sort(function (a, b) { return a - b; })
        .every(function (v, i) { return v === i; });
      if (yaAbajo) return 0;

      // Se recolocan de abajo arriba conservando el orden que ya tenian.
      const ordenadas = lista.slice().sort(function (a, b) {
        return coleccion._layers.indexOf(a) - coleccion._layers.indexOf(b);
      });
      ordenadas.forEach(function (cl) { coleccion.remove(cl, false); });
      ordenadas.forEach(function (cl, i) { coleccion.add(cl, i); });
      bajadas = ordenadas.length;
    } catch (e) { /* defensivo: una base recolocada no debe romper el mapa */ }
    return bajadas;
  }

  /**
   * Programa `bajaBase` varias veces: la API da de alta las capas de forma
   * asincrona y las hijas de un grupo pueden llegar despues que el grupo.
   *
   * @param {Object} mapa Instancia del mapa API-IDEE.
   * @param {Array} capas Capas o grupos que forman la base.
   */
  function programaBajaBase(mapa, capas) {
    [0, 400, 1500].forEach(function (espera) {
      setTimeout(function () { bajaBase(mapa, capas); }, espera);
    });
  }

  window.miWrapX = {
    aplica: aplica,
    envuelve: envuelve,
    olDe: olDe
  };

  window.miBaseAbajo = {
    aplica: bajaBase,
    programa: programaBajaBase
  };
})();

// Reemplazamos la API basada en variables globales por una clase-plugin
class miPlugin_layerSwitcher {
  constructor(options = {}) {
    this.name = 'miPlugin_layerSwitcher';
    this.options = options || {};
    // Posición del panel dentro de la esquina elegida (área `.m-area`, que la
    // API monta como flex column). Es un valor CSS `order`, no un índice: lo
    // aplica la propia API haciendo style.order sobre el panel, así que no hay
    // que reordenar el DOM a mano.
    // Los paneles sin `order` valen 0, así que:
    //   order: -1  => por delante de todos (los negativos van antes que el 0);
    //   order: 0   => primera posición, empatada con los que no llevan order;
    //   order: 2   => detrás de los que van en 0;
    //   order: 99  => al final de la esquina;
    //   null       => sin valor explícito: donde lo deje la API.
    this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
      ? Number(options.order)
      : null;
    // Colores configurables. Cada uno puede ser un color (string) o un
    // objeto {active, deactive}:
    //   color1 = fondo, color2 = borde (botón+panel), color3 = icono/flecha.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
    // Modo "una capa a la vez": las capas de este grupo se pintan con un
    // control de radio (en vez del ojito) y solo puede haber una visible;
    // encender otra apaga la anterior. Vale `true` (todas las capas del
    // selector) o una lista de identificadores para dejar fuera las que se
    // superponen (una ortofoto, un seamark, una red viaria...), que siguen
    // funcionando como casilla independiente encima del fondo elegido.
    // OJO CON LOS IDENTIFICADORES: se comparan contra `legend`, `name` e
    // `idLayer`, y los idLayer se regeneran en cada reinicio de mapa (cambio
    // 2D/3D), así que en un visualizador hay que pasar `legend` o `name`.
    this.seleccionUnica = (options.seleccionUnica !== undefined) ? options.seleccionUnica : false;
    // idLayer de la capa cuyo desplegable de opciones (transparencia) está
    // abierto. Se conserva entre re-renders para no cerrarlo al alternar
    // la visibilidad de otra capa.
    this._optionsOpen = null;
    // Desenganche del refresco del ojito al mover el mapa (ver addTo/destroy).
    this._lsOjosUnbind = null;
    // Estado de colapso/expansión de los grupos de capas (idLayer -> bool).
    // Se conserva entre re-renders; si un grupo no está presente, se usa el
    // valor "collapsed" con el que se creó (constructorParameters).
    this._groupCollapsed = {};
    // Capa del modo "una capa a la vez" que estaba encendida al pulsar
    // "Ocultar todas", para devolverla al pulsar "Mostrar todas". Es un
    // recuerdo transitorio de la acción masiva, no estado persistente.
    this._radioVisibleAntesDeOcultar = null;
    // Panel contenedor del selector (colapsable). Referencia guardada en
    // addTo() para poder conservar su estado abierto/colapsado entre swaps
    // 2D/3D (contrato EstadoPlugins), igual que hacen FiltroCapas o storymap.
    this._panel = null;
    // Barra supraplugin anadida (ver getSupraElement mas abajo):
    // boton en la barra y panel en el mapa.
    this.supra = null;
    this._supraWrap = null;
    this._supraBoton = null;
    this._syncDoc = null;
  }

  // Devuelve {active, deactive} a partir de un color simple o un objeto.
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
  }

  getHelp() {
    return {
      title: 'Selector de capas',
      content: new Promise((success) => {
        let html = '<div><p>Selector de capas visibles en el mapa</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
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
    return this._supraWrap;
  }

  // Construye el boton de la barra. Devuelve el nodo raiz que se mete en la
  // ranura del item.
  _construirSupraUI() {
    const self = this;
    const wrap = document.createElement('div');
    wrap.className = 'ls-supra__wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    // Con `conTexto` en el constructor de la barra el boton lleva tambien
    // su etiqueta; sin ella es solo icono (y cuadrado, por --solo).
    const conTexto = !!(this.supra && this.supra.options && this.supra.options.conTexto);
    btn.className = 'supra-bar__boton ' + (conTexto ? '' : 'supra-bar__boton--solo ') + 'ls-supra__boton';
    btn.title = (this.options.tituloBarra || 'Selector de capas');
    btn.setAttribute('aria-label', (this.options.tituloBarra || 'Selector de capas'));
    btn.setAttribute('aria-expanded', 'false');

    const icono = document.createElement('span');
    icono.className = 'supra-bar__boton-icono ls-supra__icono';
    icono.setAttribute('aria-hidden', 'true');

    btn.appendChild(icono);
      if (conTexto) {
        const texto = document.createElement("span");
        texto.className = "supra-bar__boton-texto";
        texto.textContent = btn.title;
        btn.appendChild(texto);
      }
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
      console.warn('[miPlugin_layerSwitcher] no se pudo alternar el panel:', e);
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
    const el = this._elementoPanel();
    return el ? el.classList.contains('collapsed') : true;
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
    const pan = this._panel;
    if (!pan) return null;
    // MEDIDO: IDEE.ui.Panel no expone getElement(); su prototipo trae
    // getButtonPanel() y el campo _element. Se van probando los dos caminos.
    try { if (pan._element) return pan._element; } catch (e) { /* sigue */ }
    try {
      const btn = (typeof pan.getButtonPanel === 'function') ? pan.getButtonPanel() : null;
      if (btn && btn.parentElement) return btn.parentElement;
    } catch (e) { /* sigue */ }
    return null;
  }

  // ── Modo "una capa a la vez" (opción `seleccionUnica`) ───────────────
  // ¿La capa entra en el grupo radio? La opción puede ser `true` (todas las
  // capas del selector) o una lista de identificadores (legend, name o
  // idLayer).
  _enGrupoRadio(layer) {
    const opt = this.seleccionUnica;
    if (!opt || !layer) return false;
    if (opt === true) return true;
    const lista = Array.isArray(opt) ? opt : [opt];
    const ids = [layer.legend, layer.name, layer.idLayer]
      .map(v => String(v == null ? '' : v));
    return lista.some(o => ids.indexOf(String(o)) >= 0);
  }

  // Capas del grupo radio que hay en un mapa, incluidas las que viven dentro
  // de grupos anidados (una capa puede estar solo ahí).
  _capasGrupoRadio(mapRef) {
    const salida = [];
    if (!mapRef || typeof mapRef.getLayers !== 'function') return salida;
    const visitar = (l) => {
      if (!l) return;
      const esGrupo = (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
      if (esGrupo) {
        let hijas = [];
        try { hijas = l.getLayers ? l.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
        return;
      }
      if (this._enGrupoRadio(l)) salida.push(l);
    };
    try { (mapRef.getLayers() || []).forEach(visitar); } catch (e) { /* sin capas */ }
    return salida;
  }

  // ── Orden de apilado (z-index) ───────────────────────────────────────
  // z-index REAL de una capa: el que usa el renderer de OpenLayers
  // (sortByZIndex) para pintar. Se lee del impl OL (layer.getImpl().olLayer),
  // que es la fuente de verdad: la fachada puede quedar desincronizada tras
  // un setZIndex() (no lo refleja). Fallback a la fachada, que en Cesium
  // devuelve el índice dentro de imageryLayers (0 = la de abajo).
  _zReal(l) {
    if (!l) return null;
    try {
      const impl = typeof l.getImpl === 'function' ? l.getImpl() : null;
      const ol = impl && impl.olLayer;
      if (ol && typeof ol.getZIndex === 'function') {
        const z = ol.getZIndex();
        if (z != null) return z;
      }
    } catch (e) { /* seguir con fachada */ }
    try {
      if (typeof l.getZIndex === 'function') return l.getZIndex();
    } catch (e) { /* sin z */ }
    return null;
  }

  // Escribe el z-index en la fuente de verdad de cada implementacion: el
  // olLayer en 2D (la fachada no refleja el setZIndex) y la propia fachada en
  // 3D, que delega en el impl de Cesium (quita la capa de imageryLayers y la
  // vuelve a insertar en esa posicion).
  _escribirZ(layer, z) {
    try {
      const impl = (typeof layer.getImpl === 'function') ? layer.getImpl() : null;
      const ol = impl && impl.olLayer;
      if (ol && typeof ol.setZIndex === 'function') {
        ol.setZIndex(z);
        return;
      }
    } catch (e) { /* probar la fachada */ }
    try {
      if (typeof layer.setZIndex === 'function') layer.setZIndex(z);
    } catch (e) { /* capa sin z-index */ }
  }

  // Capas del mapa que participan en el orden de apilado: rasteres y grupos,
  // incluidas las hijas, y las bases aunque no salgan en el selector. Se
  // quedan fuera los vectores (en Cesium su setZIndex reindexa TODOS los
  // dataSources a 0, ver el bundle) y las capas de terreno, que no son
  // imageryLayers. Devuelve una lista plana.
  _capasConZ(mapRef) {
    const salida = [];
    if (!mapRef || typeof mapRef.getLayers !== 'function') return salida;
    const visitar = (l) => {
      if (!l) return;
      const esGrupo = (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
      const tipo = String(l.type || '');
      if (esGrupo) {
        let hijas = [];
        try { hijas = l.getLayers ? l.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
        return;
      }
      if (tipo === 'Vector' || tipo === 'Terrain') return;
      if (l.displayInLayerSwitcher === false && l.isBase !== true) return;
      salida.push(l);
    };
    try { (mapRef.getLayers() || []).forEach(visitar); } catch (e) { /* sin capas */ }
    return salida;
  }

  // Capas cuyo estado de visibilidad/opacidad hay que conservar. A diferencia
  // de `_capasConZ`, incluye las vectoriales: no participan en el reordenado z
  // (en Cesium `setZIndex` reindexa todos los dataSources), pero su ojo y su
  // transparencia también tienen que sobrevivir al cambio 2D/3D.
  _capasConEstado(mapRef) {
    const salida = [];
    if (!mapRef || typeof mapRef.getLayers !== 'function') return salida;
    const visitar = (l) => {
      if (!l) return;
      const esGrupo = (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
      if (esGrupo) {
        let hijas = [];
        try { hijas = l.getLayers ? l.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
        return;
      }
      if (l.type === 'Terrain' || l._type === 'Terrain') return;
      if (l.displayInLayerSwitcher === false && l.isBase !== true) return;
      salida.push(l);
    };
    try { (mapRef.getLayers() || []).forEach(visitar); } catch (e) { /* sin capas */ }
    return salida;
  }

  // Identificador estable de una capa para el estado (legend si no es el id).
  _identificadorDe(capa) {
    if (!capa) return null;
    if (capa.legend && String(capa.legend) !== String(capa.idLayer)) return capa.legend;
    return capa.name || null;
  }

  // Reaplica el orden de apilado guardado. `orden` viene de arriba abajo (la
  // primera se dibuja encima). Los valores de z que ya tienen esas capas en el
  // mapa nuevo se permutan entre ellas para no invadir el rango de las capas
  // que no gestiona el selector ni chocar con las constantes Z_INDEX de la
  // API. El orden guardado ya trae las bases debajo (asi estaban en el mapa de
  // origen); NO se miran las banderas `isBase` de la instancia nueva porque en
  // Cesium `isBase` significa "la primera capa visible" y cambia segun lo que
  // se encienda (medido: con el fondo Esri encendido y los demas apagados, la
  // propia API marcaba ese fondo como base).
  _restaurarOrdenZ(mapRef, orden) {
    if (!mapRef || !Array.isArray(orden) || orden.length < 2) return;
    const capas = [];
    for (const item of orden) {
      const ident = (typeof item === 'string') ? item : (item && (item.legend || item.name));
      if (!ident) continue;
      const capa = this._findLayerByLegendInMap(mapRef, ident);
      if (!capa || capas.indexOf(capa) >= 0) continue;
      capas.push(capa);
    }
    if (capas.length < 2) return;

    const validos = capas.map((c) => this._zReal(c)).filter((z) => typeof z === 'number' && isFinite(z)).sort((a, b) => a - b);
    const zMin = validos.length ? validos[0] : 0;
    capas.slice().reverse().forEach((capa, i) => {
      // Con los z completos se permutan los existentes; si alguno venia nulo,
      // se rellena una escalera desde el menor.
      const z = (validos.length === capas.length) ? validos[i] : (zMin + i);
      this._escribirZ(capa, z);
    });
  }

  // ── Coordinación de estado (swap 2D/3D con cambioImpl) ───────────────
  // Captura el estado serializable propio de la UI del selector de capas
  // (_optionsOpen, _groupCollapsed, visibilidad/opacidad por capa y orden de
  // apilado). Las capas se recrean en cada reinicio de mapa (cambio 2D/3D),
  // así que la visibilidad y la opacidad hay que reaplicarlas aquí: no viajan
  // en `mapa()` y cambioImpl no las transfiere. Se guardan por legend/name,
  // que son estables, porque el idLayer cambia en cada reinicio. La capa
  // elegida en el modo "una capa a la vez" (radioVisibleLegend) y el orden z
  // (ordenZ) también se guardan aparte.
  getState() {
    const groupCollapsedCopy = {};
    if (this._groupCollapsed && typeof this._groupCollapsed === 'object') {
      for (const key of Object.keys(this._groupCollapsed)) {
        if (typeof this._groupCollapsed[key] === 'boolean') {
          groupCollapsedCopy[key] = this._groupCollapsed[key];
        }
      }
    }
    // Estado abierto/colapsado del panel del selector: se conserva entre
    // swaps 2D/3D para que el selector no aparezca plegado tras alternar
    // la implementación. Mismo patrón que FiltroCapas/storymap.
    let panelCollapsed = false;
    if (this._panel) {
      if (this._panel._collapsed !== undefined) {
        panelCollapsed = !!this._panel._collapsed;
      } else if (typeof this._panel.getElement === 'function') {
        const panelEl = this._panel.getElement();
        panelCollapsed = panelEl ? panelEl.classList.contains('collapsed') : false;
      }
    }
    // El idLayer se regenera en cada reinicio de mapa (mapa() crea las capas
    // de nuevo con prefijos temporales), asi que ademas del idLayer actual se
    // captura la legend/name (identificadores estables) para poder reencontrar
    // la capa en la instancia nueva aunque cambie su idLayer.
    const idAtOpen = (this._optionsOpen !== undefined && this._optionsOpen !== null) ? this._optionsOpen : null;
    let legendAtOpen = null;
    if (idAtOpen !== null && this._map && typeof this._map.getLayers === 'function') {
      const capa = this._findLayerByIdInMap(this._map, idAtOpen);
      if (capa) {
        legendAtOpen = (capa.legend && String(capa.legend) !== String(capa.idLayer)) ? capa.legend : (capa.name || null);
      }
    }
    const groupCollapsedLegends = {};
    if (this._groupCollapsed && typeof this._groupCollapsed === 'object' && this._map && typeof this._map.getLayers === 'function') {
      for (const key of Object.keys(this._groupCollapsed)) {
        if (typeof this._groupCollapsed[key] !== 'boolean') continue;
        const capa = this._findLayerByIdInMap(this._map, key);
        if (capa) {
          const leg = (capa.legend && String(capa.legend) !== String(capa.idLayer)) ? capa.legend : (capa.name || null);
          if (leg) groupCollapsedLegends[leg] = this._groupCollapsed[key];
        }
      }
    }
    // En el modo "una capa a la vez" la elección sí es estado de la UI: las
    // capas se recrean desde cero en cada reinicio de mapa con la visibilidad
    // que declara el visualizador y cambioImpl no la transfiere (solo
    // reengancha capas que falten), así que sin esto el fondo elegido volvía
    // al de por defecto al cambiar de 2D a 3D. Se guarda por legend/name,
    // que son estables, igual que el resto de identificadores de este estado.
    let radioVisibleLegend = null;
    if (this.seleccionUnica && this._map) {
      const visibles = this._capasGrupoRadio(this._map).filter((c) => {
        try { return !!c.isVisible(); } catch (e) { return false; }
      });
      if (visibles.length) {
        const capa = visibles[visibles.length - 1];
        radioVisibleLegend = (capa.legend && String(capa.legend) !== String(capa.idLayer))
          ? capa.legend
          : (capa.name || null);
      }
    }
    // Orden de apilado (z-index) de arriba abajo. Las capas se recrean en el
    // orden que declara el visualizador en cada reinicio de mapa (cambio
    // 2D/3D), asi que sin esto se perdia el reordenado del selector: en 2D
    // los z volvian a los de creacion y en 3D el orden de imageryLayers era
    // el de alta de las capas (medido: tras arrastrar las balizas debajo de
    // "Esri gris claro" volvian arriba, ultimas de la pila). Se guarda por
    // legend/name, que son estables, con una marca de si es capa base.
    let ordenZ = [];
    if (this._map) {
      const entradas = [];
      this._capasConZ(this._map).forEach((capa) => {
        const ident = this._identificadorDe(capa);
        if (!ident) return;
        entradas.push({ ident, z: this._zReal(capa) });
      });
      entradas.sort((a, b) => {
        if (a.z == null && b.z == null) return 0;
        if (a.z == null) return 1;
        if (b.z == null) return -1;
        return b.z - a.z;
      });
      ordenZ = entradas.map((e) => e.ident);
    }
    // Visibilidad y opacidad de cada capa, por identificador estable. En el
    // reinicio del mapa las capas se crean de nuevo con los valores del
    // visualizador, así que sin esto el selector perdía los cambios hechos
    // con el ojo y con el deslizador (medido con la capa PMTiles ráster:
    // 25 % de transparencia volvía al 10 % del constructor al pasar a 3D).
    const layerStates = [];
    if (this._map) {
      this._capasConEstado(this._map).forEach((capa) => {
        if (!capa || capa.isBase === true || capa.displayInLayerSwitcher === false) return;
        const ident = this._identificadorDe(capa);
        if (!ident) return;
        let visible;
        let opacity;
        let selectedStyle;
        try {
          if (typeof capa.isVisible === 'function') visible = !!capa.isVisible();
        } catch (e) { /* capa sin visibilidad */ }
        try {
          if (typeof capa.getOpacity === 'function') {
            const op = Number(capa.getOpacity());
            if (isFinite(op)) opacity = op;
          }
        } catch (e) { /* capa sin opacidad */ }
        try {
          if (capa._selectedStyleName !== undefined) {
            selectedStyle = capa._selectedStyleName;
          } else if (capa._selectedStyleIndex !== undefined) {
            selectedStyle = capa._selectedStyleIndex;
          } else if (capa._currentStyleId !== undefined) {
            selectedStyle = capa._currentStyleId;
          } else if (typeof capa.getStyles === 'function') {
            const st = capa.getStyles();
            if (st) selectedStyle = st;
          }
        } catch (e) { /* capa sin estilos */ }
        if (visible !== undefined || opacity !== undefined || selectedStyle !== undefined) {
          layerStates.push({ ident, visible, opacity, style: selectedStyle });
        }
      });
    }
    // Visibilidad de los GRUPOS. `_capasConEstado` los salta a propósito (un
    // grupo no tiene opacidad ni estilo propios), pero su ojito sí es estado
    // de la UI: al reiniciarse el mapa el grupo volvía a nacer visible aunque
    // el usuario lo hubiera apagado, y con él el estado de la barra de
    // acciones rápidas ("Ocultar todas" con todo apagado). Se guarda aparte y
    // por legend/name, como el resto de identificadores estables.
    const groupStates = [];
    if (this._map) {
      const visitarGrupos = (l) => {
        if (!l) return;
        const esGrupo = (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
        if (!esGrupo) return;
        let saltar = false;
        try {
          const impl = (typeof l.getImpl === 'function') ? l.getImpl() : null;
          if (l.isBase === true || (impl && impl.isBase === true)) saltar = true;
          if (l.displayInLayerSwitcher === false || (impl && impl.displayInLayerSwitcher === false)) saltar = true;
        } catch (e) { /* se queda como está */ }
        if (!saltar) {
          const ident = this._identificadorDe(l);
          let visible;
          try { if (typeof l.isVisible === 'function') visible = !!l.isVisible(); } catch (e) { /* sin visibilidad */ }
          if (ident && visible !== undefined) groupStates.push({ ident, visible });
        }
        let hijas = [];
        try { hijas = l.getLayers ? l.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitarGrupos);
      };
      try { (this._map.getLayers() || []).forEach(visitarGrupos); } catch (e) { /* sin capas */ }
    }
    // Capa aislada ("solo esta"). La visibilidad de las capas ya viaja en
    // `layerStates`, así que aquí solo hace falta la marca y el estado previo:
    // sin ella, el botón de aislar volvía a ofrecer "aislar" en la instancia
    // nueva (aunque el mapa se viera igual) y el "dejar de aislar" se perdía.
    let aislada = null;
    if (this._aislada && this._aislada.ident) {
      aislada = {
        ident: this._aislada.ident,
        previo: Array.isArray(this._aislada.previo)
          ? this._aislada.previo.filter((p) => p && p.ident).map((p) => ({ ident: p.ident, visible: !!p.visible }))
          : [],
      };
    }
    return {
      panelCollapsed,
      optionsOpen: idAtOpen,
      optionsOpenLegend: legendAtOpen,
      groupCollapsed: groupCollapsedCopy,
      groupCollapsedLegends,
      radioVisibleLegend,
      aislada,
      ordenZ,
      layerStates,
      groupStates,
    };
  }

  // Busca una capa por idLayer dentro del mapa (incluidos grupos anidados).
  _findLayerByIdInMap(mapRef, id) {
    if (!mapRef || typeof mapRef.getLayers !== 'function') return null;
    try {
      const isGroup = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
      const allLayers = mapRef.getLayers() || [];
      const stack = [];
      for (const l of allLayers) {
        if (l && String(l.idLayer) === String(id)) return l;
        if (isGroup(l)) stack.push(l);
      }
      while (stack.length) {
        const g = stack.pop();
        let hijos = [];
        try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
        for (const h of hijos) {
          if (h && String(h.idLayer) === String(id)) return h;
          if (isGroup(h)) stack.push(h);
        }
      }
    } catch (e) { /* sin coincidencia */ }
    return null;
  }

  // Busca la capa del mapa cuyo legend (o name) coincida con el identificador
  // estable capturado. Devuelve la capa o null.
  _findLayerByLegendInMap(mapRef, ident) {
    if (!mapRef || typeof mapRef.getLayers !== 'function' || !ident) return null;
    try {
      const isGroup = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
      const coincide = (c) => !!c && (
        (c.legend && String(c.legend) === String(ident)) ||
        (c.name && String(c.name) === String(ident))
      );
      const allLayers = mapRef.getLayers() || [];
      const stack = [];
      for (const l of allLayers) {
        if (coincide(l)) return l;
        if (isGroup(l)) stack.push(l);
      }
      while (stack.length) {
        const g = stack.pop();
        let hijos = [];
        try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
        for (const h of hijos) {
          if (coincide(h)) return h;
          if (isGroup(h)) stack.push(h);
        }
      }
    } catch (e) { /* sin coincidencia */ }
    return null;
  }

  // Restaura el estado de la UI en la nueva instancia tras el reinicio del mapa.
  // Filtra defensivamente identificadores que ya no existan en el nuevo mapa.
  setState(state, map) {
    if (!state || typeof state !== 'object') return;
    const mapRef = map || this._map;

    // La ventana de información (hoja inferior con la tabla de atributos) vive
    // en document.body, no dentro del div del mapa, así que el reinicio del
    // mapa no se la lleva: quedaba abierta con los datos y los idLayer del mapa
    // viejo. Se cierra aquí, en la instancia nueva (window.closeSheet ya es la
    // suya y borra la hoja por id).
    try { if (typeof window.closeSheet === 'function') window.closeSheet(); } catch (e) { /* nada */ }

    // Restaurar estado abierto/colapsado del panel del selector: si estaba
    // desplegado antes del swap, reabrirlo (por defecto addTo lo crea plegado).
    if (state.panelCollapsed !== undefined && this._panel) {
      try {
        if (state.panelCollapsed && typeof this._panel.collapse === 'function') {
          this._panel.collapse();
        } else if (!state.panelCollapsed && typeof this._panel.open === 'function') {
          this._panel.open();
        }
      } catch (e) {
        console.warn('layerSwitcher: no se pudo restaurar el estado del panel', e);
      }
    }
    this._sincronizarSupra();

    const layerExists = (id) => {
      if (!mapRef || typeof mapRef.getLayers !== 'function') return true;
      try {
        const isGroup = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
        const allLayers = mapRef.getLayers() || [];
        const stack = [];
        for (const l of allLayers) {
          if (l && String(l.idLayer) === String(id)) return true;
          if (isGroup(l)) stack.push(l);
        }
        while (stack.length) {
          const g = stack.pop();
          let hijos = [];
          try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
          for (const h of hijos) {
            if (h && String(h.idLayer) === String(id)) return true;
            if (isGroup(h)) stack.push(h);
          }
        }
        return false;
      } catch (e) {
        return true;
      }
    };

    // Restaurar panel de opciones abierto. Se resuelve primero por idLayer y,
    // si la capa se recreo con otro id (mapa() regenera los ids), por legend.
    let optionsId = null;
    if (state.optionsOpen !== undefined && state.optionsOpen !== null) {
      if (layerExists(state.optionsOpen)) {
        optionsId = state.optionsOpen;
      } else if (state.optionsOpenLegend) {
        const capa = this._findLayerByLegendInMap(mapRef, state.optionsOpenLegend);
        optionsId = capa ? capa.idLayer : null;
      }
    }
    this._optionsOpen = optionsId;

    // Restaurar estado de colapso de grupos (idLayer -> bool), resolviendo
    // tambien por legend si el grupo se recreo con otro idLayer.
    this._groupCollapsed = {};
    if (state.groupCollapsed && typeof state.groupCollapsed === 'object') {
      for (const key of Object.keys(state.groupCollapsed)) {
        if (typeof state.groupCollapsed[key] === 'boolean' && layerExists(key)) {
          this._groupCollapsed[String(key)] = state.groupCollapsed[key];
        }
      }
    }
    if (state.groupCollapsedLegends && typeof state.groupCollapsedLegends === 'object') {
      for (const leg of Object.keys(state.groupCollapsedLegends)) {
        if (typeof state.groupCollapsedLegends[leg] !== 'boolean') continue;
        const capa = this._findLayerByLegendInMap(mapRef, leg);
        if (capa) {
          this._groupCollapsed[String(capa.idLayer)] = state.groupCollapsedLegends[leg];
        }
      }
    }

    // Restaurar visibilidad y opacidad de cada capa. Se resuelve por
    // legend/name porque el idLayer cambia en cada reinicio de mapa. La
    // opacidad se aplica con `setLayerOpacity` (porcentaje de transparencia)
    // para que las capas vectoriales de Cesium reconstruyan sus primitivas y
    // el cambio se vea de verdad; si aún no está disponible, se llama
    // directamente a `setOpacity`.
    if (Array.isArray(state.layerStates)) {
      state.layerStates.forEach((estadoCapa) => {
        if (!estadoCapa || !estadoCapa.ident) return;
        const capa = this._findLayerByLegendInMap(mapRef, estadoCapa.ident);
        if (!capa) return;
        // Solo se tocan los valores que han cambiado. Las capas nacen con la
        // visibilidad y la opacidad del visualizador, y reaplicar lo mismo en
        // cada swap reconstruiría entidades de Cesium sin necesidad.
        let visibleActual;
        try {
          if (typeof capa.isVisible === 'function') visibleActual = !!capa.isVisible();
        } catch (e) { /* capa sin visibilidad */ }
        if (typeof estadoCapa.visible === 'boolean' && estadoCapa.visible !== visibleActual
          && typeof capa.setVisible === 'function') {
          try { capa.setVisible(estadoCapa.visible); } catch (e) { /* capa sin visibilidad */ }
        }
        let opacidadActual;
        try {
          if (typeof capa.getOpacity === 'function') opacidadActual = Number(capa.getOpacity());
        } catch (e) { /* capa sin opacidad */ }
        const opacidadDistinta = typeof estadoCapa.opacity === 'number'
          && (!isFinite(opacidadActual) || Math.abs(opacidadActual - estadoCapa.opacity) > 0.001);
        if (opacidadDistinta && typeof capa.setOpacity === 'function') {
          try {
            const pct = Math.max(0, Math.min(100, Math.round((1 - estadoCapa.opacity) * 100)));
            if (typeof window.setLayerOpacity === 'function' && capa.idLayer) {
              window.setLayerOpacity(capa.idLayer, pct);
            } else {
              capa.setOpacity(estadoCapa.opacity);
            }
          } catch (e) { /* capa sin opacidad */ }
        }
        if (estadoCapa.style !== undefined && estadoCapa.style !== null) {
          try {
            if (typeof window.setLayerStyle === 'function' && capa.idLayer) {
              window.setLayerStyle(capa.idLayer, estadoCapa.style);
            }
          } catch (e) { /* ignorar fallo al restaurar estilo */ }
        }
      });
    }

    // Restaurar la visibilidad de los grupos, que viaja aparte de las capas
    // (`layerStates` solo lleva hojas). Sin esto, un grupo apagado por el
    // usuario volvía a nacer visible tras el cambio 2D/3D y con él se
    // encendía el rótulo "Ocultar todas" de la barra de acciones rápidas.
    // Igual que en el resto, se resuelve por legend/name porque el idLayer
    // se regenera al recrear el mapa.
    if (Array.isArray(state.groupStates)) {
      state.groupStates.forEach((estadoGrupo) => {
        if (!estadoGrupo || !estadoGrupo.ident) return;
        if (typeof estadoGrupo.visible !== 'boolean') return;
        const grupo = this._findLayerByLegendInMap(mapRef, estadoGrupo.ident);
        if (!grupo || typeof grupo.setVisible !== 'function') return;
        let visibleActual;
        try { visibleActual = !!grupo.isVisible(); } catch (e) { visibleActual = true; }
        if (visibleActual === estadoGrupo.visible) return;
        try { grupo.setVisible(estadoGrupo.visible); } catch (e) { /* grupo sin visibilidad */ }
      });
    }

    // Restaurar la capa elegida en el modo "una capa a la vez": se enciende
    // esa y se apagan las demás del grupo. Se resuelve por legend/name porque
    // el idLayer cambia en cada reinicio de mapa.
    if (state.radioVisibleLegend) {
      const elegida = this._findLayerByLegendInMap(mapRef, state.radioVisibleLegend);
      if (elegida && this._enGrupoRadio(elegida)) {
        this._capasGrupoRadio(mapRef).forEach((c) => {
          try { c.setVisible(c === elegida); } catch (e) { /* capa sin visibilidad */ }
        });
      }
    }

    // Restaurar la marca de "capa aislada". La visibilidad ya la ha devuelto
    // `layerStates` (las demás siguen apagadas), así que aquí solo se recupera
    // el interruptor para que el botón ofrezca deshacer el aislamiento y se
    // pueda devolver el estado previo a la instancia nueva.
    this._aislada = null;
    if (state.aislada && state.aislada.ident) {
      const capaAislada = this._findLayerByLegendInMap(mapRef, state.aislada.ident);
      if (capaAislada) {
        this._aislada = {
          index: capaAislada.idLayer,
          ident: state.aislada.ident,
          previo: Array.isArray(state.aislada.previo)
            ? state.aislada.previo.filter((p) => p && p.ident)
            : [],
        };
      }
    }

    // Restaurar el orden de apilado: en 3D la pila es la coleccion de
    // imageryLayers (indice 0 = abajo) y en 2D el zIndex del renderer, y en
    // los dos casos las capas se recrean en el orden del visualizador. Se
    // reaplica antes de renderizar la lista para que el panel y el mapa
    // cuenten lo mismo.
    if (Array.isArray(state.ordenZ) && state.ordenZ.length) {
      try { this._restaurarOrdenZ(mapRef, state.ordenZ); } catch (e) {
        console.warn('layerSwitcher: no se pudo restaurar el orden de las capas', e);
      }
    }

    // Forzar re-render de la lista para reflejar los chevrons y paneles restaurados
    if (typeof this._renderLayerList === 'function') {
      try { this._renderLayerList(); } catch (e) {}
    } else if (typeof window !== 'undefined' && typeof window.renderLayerList === 'function') {
      try { window.renderLayerList(); } catch (e) {}
    }
  }

  addTo(map) {
    // Referencia a la instancia para los handlers globales que necesitan
    // acceder a this._optionsOpen.
    const self = this;
    this._map = map;

    // El wrapX de todas las capas a true. Aquí es donde toca: este plugin es el
    // que gestiona las capas del mapa, así que el arreglo se aplica desde él y
    // el visualizador no tiene que cargar ningún script aparte. Se queda
    // escuchando altas y bajas, de modo que también cubre las capas que se
    // añadan después (un catálogo, un grupo, otra capa base).
    if (window.miWrapX) window.miWrapX.aplica(map);
    const panelExtra = new IDEE.ui.Panel('toolsExtra_layerSwitcher', {
      collapsible: true,
      className: 'g-herramienta_selectorCapa g-panel-lateral',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
      // `order` lo aplica la propia API: IDEE.ui.Panel hace style.order sobre el
      // panel dentro del area (flex column). Es un valor CSS `order`, no un indice.
      order: this.order,
    });
    // Referencia al panel para poder restaurar su estado (abierto/colapsado)
    // en setState() tras un swap 2D/3D con cambioImpl.
    this._panel = panelExtra;

    const htmlPanel = `
      <div aria-label="Selector de capas" role="menuitem" id="div-contenedor-herramienta-layerSwitcher" class="m-control m-container m-herramienta">
        <header 
          role="heading" 
          tabindex="0" 
          id="m-herramienta-title-layerSwitcher"
          class="m-herramienta-header">
            Selector de capas
        </header>
        <section id="m-herramienta-previews-layerSwitcher" class="m-herramienta-previews"></section>
        <div id="m-herramienta-contents-layerSwitcher"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlLayer_layerSwitcher');
    control.createView = () => document.createElement('div');
    // La API compara controles con equals() para retirarlos del panel
    // (IDEE.ui.Panel.removeControls) y del mapa. Sin este metodo, destroy() ->
    // map.removeControls() revienta con "e.equals is not a function" y el panel
    // se queda colgado en el mapa. Estricto a proposito: un equals laxo
    // ("other instanceof IDEE.Control") desregistraria tambien los controles de
    // los demas plugins al quitar este.
    control.equals = function (other) {
      return other === this;
    };

    panelExtra.addControls(control);
    map.addPanels(panelExtra);
    // Referencia al control: destroy() la usa para soltarlo del mapa.
    this._control = control;

    // ── Aplicar colores configurables (color1=fondo, color2=borde, color3=icono) ──
    // Se inyectan 6 variables CSS en el panel (estado normal y ".opened/active").
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const panelEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta_selectorCapa');
    if (panelEl) {
      panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

    const panelSelector = document.querySelector('.g-herramienta_selectorCapa .m-panel-controls');
    if (panelSelector) panelSelector.innerHTML = htmlPanel;
    const contents = document.querySelector('#m-herramienta-contents-layerSwitcher');
    if (contents) contents.appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-layerSwitcher');

    // ── Grupos de capas (IDEE.layer.LayerGroup) ────────────────────────
    // Un grupo agrupa capas (que pueden ser a su vez otros grupos). La API
    // lo expone como una capa de tipo 'LayerGroup' con getLayers() para las
    // hijas. Su name/legend por defecto son 'layer_<n>', asi que el nombre
    // visible se construye con legend o title (constructorParameters).
    const isGroupLayer = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup');

    const getLayerDisplayName = (l) => {
      try {
        if (l.legend && !/^layer_\d+$/.test(String(l.legend))) return l.legend;
        const up = l.constructorParameters && l.constructorParameters.userParameters;
        if (up && up.title && !/^layer_\d+$/.test(String(up.title))) return up.title;
        if (l.name && !/^layer_\d+$/.test(String(l.name))) return l.name;
        return l.legend || l.name || 'Sin nombre';
      } catch (e) { return l.legend || l.name || 'Sin nombre'; }
    };

    // ¿Colapsado? Estado manual conservado en _groupCollapsed, o si no el
    // valor "collapsed" del constructor del grupo.
    const isGroupCollapsed = (group) => {
      const key = String(group.idLayer);
      if (key in self._groupCollapsed) return self._groupCollapsed[key];
      try {
        const up = group.constructorParameters && group.constructorParameters.userParameters;
        return !!(up && up.collapsed);
      } catch (e) { return false; }
    };

    // Busca una capa por idLayer. Primero en el registro del mapa y, si no
    // esta, recursivamente dentro de los grupos (una capa puede vivir SOLO
    // dentro de un grupo y no aparecer en map.getLayers()).
    const findLayerById = (index) => {
      let found = null;
      try {
        found = map.getLayers().find(layer => {
          try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
        }) || null;
      } catch (e) { found = null; }
      if (found) return found;
      const stack = [];
      try { map.getLayers().forEach(l => { if (isGroupLayer(l)) stack.push(l); }); } catch (e) { /* sin grupos */ }
      while (stack.length) {
        const g = stack.pop();
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        for (const h of hijos) {
          if (h && h.idLayer == index) return h;
          if (isGroupLayer(h)) stack.push(h);
        }
      }
      return null;
    };

    // Encuentra el grupo padre que contiene directamente a una capa (busca
    // recursivamente entre los grupos del mapa). Devuelve el grupo o null.
    const findParentGroup = (target) => {
      const stack = [];
      try { map.getLayers().forEach(l => { if (isGroupLayer(l)) stack.push(l); }); } catch (e) { return null; }
      while (stack.length) {
        const g = stack.pop();
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        if (hijos.some(h => h === target)) return g;
        hijos.forEach(h => { if (isGroupLayer(h)) stack.push(h); });
      }
      return null;
    };

    // ¿Esta capa entra en el modo "una capa a la vez"? y ¿cuáles del grupo hay
    // ahora en el mapa? La lógica vive en la clase (_enGrupoRadio /
    // _capasGrupoRadio) porque también la necesita el contrato getState/setState
    // para conservar el fondo elegido al cambiar de implementación.
    const enGrupoRadio = (layer) => self._enGrupoRadio(layer);
    const capasGrupoRadio = () => self._capasGrupoRadio(map);

    // Si llegan dos o más capas del grupo encendidas (un estado restaurado,
    // una capa añadida después del arranque), se queda la última visible y se
    // apagan las demás: el modo no admite dos y el radio tiene que decir la
    // verdad de lo que se está viendo.
    const normalizarGrupoRadio = () => {
      const visibles = capasGrupoRadio().filter(c => {
        try { return !!c.isVisible(); } catch (e) { return false; }
      });
      if (visibles.length < 2) return;
      const elegida = visibles[visibles.length - 1];
      visibles.forEach(c => { if (c !== elegida) c.setVisible(false); });
    };

    // z-index REAL de una capa. La implementacion vive en la clase
    // (_zReal) porque el contrato getState/setState tambien la necesita para
    // guardar y reaplicar el orden de apilado entre 2D y 3D.
    const getRealZIndex = (l) => self._zReal(l);

    // Ordena una lista de capas de MAYOR a MENOR z-index: la capa que se
    // dibuja encima (z-index mayor) va arriba del todo de la lista. Si alguna
    // capa no expone getZIndex() se mantiene al final (z-index nulo).
    const sortLayersByZDesc = (list) => {
      return (list || []).slice().sort((a, b) => {
        const za = getRealZIndex(a);
        const zb = getRealZIndex(b);
        if (za == null && zb == null) return 0;
        if (za == null) return 1;
        if (zb == null) return -1;
        return zb - za;
      });
    };

    // Capas seleccionables desde el selector (compartido entre el panel y el
    // dropdown del sidenav de la tabla de atributos). Se excluyen capas
    // temporales/auxiliares (p.ej. el resaltado del panel) marcadas con
    // displayInLayerSwitcher:false, las de terreno, las capas internas
    // auto-generadas por Mapea (nombre "layer_<n>"), y las capas BASE:
    // las capas base se gestionan desde la extension de capas base
    // (ext_backgorundLayers), no desde este selector de capas superpuestas.
    // Los GRUPOS (LayerGroup) SI pasan aunque su nombre interno sea
    // "layer_<n>" porque se muestran como nodos padre del arbol.
    // Se usa map.getLayers() (sincrono) en lugar de map.getOverlayLayers():
    // getLayers() refleja correctamente las eliminaciones con removeLayers(),
    // mientras que getOverlayLayers() de la fachada puede mantener caches
    // que causan capas fantasma tras un borrado.
    // El resultado se ordena por z-index DESCENDENTE (la capa superior del
    // mapa va arriba en la lista).
    const getSelectableLayers = async () => {
      const allLayers = map.getLayers() || [];
      // Recoge tambien las capas que viven SOLO dentro de un grupo (añadidas
      // con grupo.addLayers() pero no con map.addLayers()): la fachada no las
      // lista en map.getLayers() pero deben aparecer en el selector (bajo su
      // grupo) y en el dropdown del sidenav. Se aplanan recursivamente.
      const hijasDeGrupos = [];
      const esCapaBase = (l) => {
        try {
          if (l && l.isBase === true) return true;
          const impl = (l && typeof l.getImpl === 'function') ? l.getImpl() : null;
          return Boolean(impl && impl.isBase === true);
        } catch (e) { return false; }
      };
      const collectGroupChildren = (g) => {
        // Las hijas de un grupo que ES capa base no se recogen. La API marca de
        // isBase al grupo, no a sus capas (el Híbrido de MapaBase es un
        // LayerGroup con dos TMS dentro), así que el filtro de más abajo, que
        // solo mira la propia capa, las dejaba pasar y salían como si fueran
        // superpuestas. Aquí solo se recogen las de los grupos que no son base,
        // que es lo único que este selector tiene que mostrar.
        if (esCapaBase(g)) return;
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        hijos.forEach(h => {
          hijasDeGrupos.push(h);
          if (isGroupLayer(h)) collectGroupChildren(h);
        });
      };
      allLayers.filter(isGroupLayer).forEach(collectGroupChildren);
      const result = (allLayers.concat(hijasDeGrupos)).filter(l => {
        try {
          const impl = (l && typeof l.getImpl === 'function') ? l.getImpl() : null;
          // Las capas base no se muestran aqui (van en la extension de capas base).
          if (l && l.isBase === true) return false;
          if (impl && impl.isBase === true) return false;
          const direct = l && l.displayInLayerSwitcher;
          const implFlag = impl && impl.displayInLayerSwitcher;
          if (direct === false || implFlag === false) return false;
          if (l && (l._type === 'Terrain' || l.type === 'Terrain')) return false;
          const nm = (l && (l.name || l.legend)) || '';
          if (/^layer_\d+$/.test(nm) && !isGroupLayer(l)) return false;
          return true;
        } catch (e) { return true; }
      });
      return sortLayersByZDesc(result);
    };

    // Construye el arbol de capas del selector: los grupos (LayerGroup) se
    // convierten en nodos padre con sus hijas (recursivo, con soporte de
    // subgrupos). Las capas que viven DENTRO de un grupo se eliminan del
    // nivel raiz para no duplicarlas.
    const buildLayerTree = async () => {
      const allLayers = await getSelectableLayers();
      const grupos = allLayers.filter(isGroupLayer);
      // idLayer de TODAS las capas que estan dentro de algun grupo (directa
      // o indirectamente): se muestran bajo su grupo, no en la raiz.
      const hijasEnGrupo = new Set();
      const collectChildren = (g) => {
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        hijos.forEach(h => {
          hijasEnGrupo.add(String(h.idLayer));
          if (isGroupLayer(h)) collectChildren(h);
        });
      };
      grupos.forEach(collectChildren);

      const nodeOf = (layer) => {
        if (isGroupLayer(layer)) {
          let hijos = [];
          try { hijos = layer.getLayers ? layer.getLayers() : []; } catch (e) { hijos = []; }
          // Mismo criterio que la raiz: la hija con mayor z-index va arriba.
          return { layer, isGroup: true, children: sortLayersByZDesc(hijos).map(nodeOf) };
        }
        return { layer, isGroup: false, children: [] };
      };

      return allLayers
        .filter(l => !hijasEnGrupo.has(String(l.idLayer)))
        .map(nodeOf);
    };

    // ── Estado del ojito: encendida, oculta o encendida pero sin pintar ──
    // Una capa puede estar visible para la API y aun así no pintar nada: su
    // minZoom/maxZoom deja fuera el zoom actual o su cobertura no cae en la
    // vista. Ese caso no es "oculta" (el usuario la tiene encendida), así que
    // el ojito necesita un tercer dibujo. Se resuelve solo con datos que ya
    // están en el cliente (nada de red), porque hay que recalcularlo en cada
    // movimiento del mapa.

    /**
     * minZoom/maxZoom efectivos de una capa, en la escala de la vista.
     *
     * Se miran la fachada de la API (`minZoom`/`getMinZoom`), los campos de
     * los plugins propios (GeoParquet, PMTiles) y las hijas de un grupo: un
     * grupo se queda con el rango más amplio, que es cuando alguna de sus
     * capas puede pintar.
     *
     * @param {Object} capa
     * @returns {{min: number|null, max: number|null}}
     */
    function _limitesZoomCapa(capa) {
      const salida = { min: null, max: null };
      const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
      const sumar = (min, max) => {
        if (min !== null) salida.min = (salida.min === null) ? min : Math.min(salida.min, min);
        if (max !== null) salida.max = (salida.max === null) ? max : Math.max(salida.max, max);
      };
      const visitar = (c) => {
        if (!c) return;
        let min = num(c.minZoom);
        let max = num(c.maxZoom);
        if (min === null && typeof c.getMinZoom === 'function') {
          try { min = num(c.getMinZoom()); } catch (e) { min = null; }
        }
        if (max === null && typeof c.getMaxZoom === 'function') {
          try { max = num(c.getMaxZoom()); } catch (e) { max = null; }
        }
        // Plugins propios: no pasan el límite por el constructor de la API.
        if (min === null && c._gpMinZoom !== undefined) min = num(c._gpMinZoom);
        if (max === null && c._gpMaxZoom !== undefined) max = num(c._gpMaxZoom);
        if (min === null && c._pmtilesMinZoom !== undefined) min = num(c._pmtilesMinZoom);
        if (max === null && c._pmtilesMaxZoom !== undefined) max = num(c._pmtilesMaxZoom);
        sumar(min, max);
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
      };
      visitar(capa);
      return salida;
    }

    /**
     * ¿Alguna capa del grupo no tiene una extensión conocida?
     *
     * `_extensionUtil` une solo las hijas con extensión válida y descarta
     * las que cubren el mundo. En un grupo mixto (una capa local + una
     * global) la unión se queda con la local y avisar al salir de ella sería
     * un falso positivo: si alguna hija no tiene extensión fiable, el grupo
     * no se comprueba.
     *
     * @param {Object} grupo
     * @returns {boolean}
     */
    function _grupoConExtensionDesconocida(grupo) {
      let desconocida = false;
      const visitar = (c) => {
        if (desconocida || !c) return;
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        if (!hijas.length) {
          if (!_esExtension(_extensionUtil(c))) desconocida = true;
          return;
        }
        hijas.forEach(visitar);
      };
      visitar(grupo);
      return desconocida;
    }

    /**
     * Extensión de la capa en grados (EPSG:4326), con lo que ya está en el
     * cliente.
     *
     * Si la cobertura todavía no se conoce, devuelve `null` y el ojito no
     * avisa: mejor no avisar que avisar mal. No se piden capacidades ni
     * metadatos por red, porque esto se ejecuta en cada movimiento del mapa.
     *
     * @param {Object} capa
     * @returns {Array<number>|null} [oeste, sur, este, norte].
     */
    function _extensionCapaEnGrados(capa) {
      // GeoParquet es el caso que más interesa (datos de una ciudad: al
      // salir de ella la capa no pinta nada) y publica su cobertura en
      // 3857 en cuanto ha leído el metadata, en la primera carga.
      try {
        if (capa && capa._geoparquet === true && typeof capa._extensionParaZoom === 'function') {
          const extGp = capa._extensionParaZoom();
          if (_esExtension(extGp)) {
            const enGrados = _reproyectar(extGp.slice(0, 4), 'EPSG:3857', 'EPSG:4326');
            if (enGrados) return enGrados;
          }
        }
      } catch (e) { /* sin cobertura todavía */ }

      // En un grupo, la unión de extensiones solo vale si TODAS las hijas
      // tienen una cobertura fiable (ver `_grupoConExtensionDesconocida`).
      if (capa && typeof capa.getLayers === 'function' && _grupoConExtensionDesconocida(capa)) return null;

      const ext = _extensionUtil(capa);
      if (!_esExtension(ext)) return null;
      const n = ext.slice(0, 4).map(Number);
      // En 3D (Cesium) la API devuelve grados y en 2D, unidades de la
      // proyección del mapa. Los grados se reconocen porque no pasan de
      // 180/90, igual que se hace en `_irAExtentEn3D`.
      if (n[0] >= -180 && n[2] <= 180 && n[1] >= -90 && n[3] <= 90) return n;
      return _reproyectar(n, _codigoDeLaProyeccion(), 'EPSG:4326');
    }

    /**
     * ¿Se solapan una extensión y la vista actual? Ambas en grados y en el
     * mismo orden [oeste, sur, este, norte].
     *
     * @param {Array<number>} ext
     * @param {Object} vista Resultado de `vistaEnGrados()`.
     * @returns {boolean}
     */
    function _seSolapaConVista(ext, vista) {
      if (!ext || !vista) return true;
      return !(ext[2] < vista.oeste || ext[0] > vista.este ||
               ext[3] < vista.sur || ext[1] > vista.norte);
    }

    /**
     * ¿Se puede usar la extensión de la capa para decidir si se ve?
     *
     * En MVT `getMaxExtent()` devuelve la caja de las teselas YA cargadas (la
     * del viewport anterior), y en MapLibre la cobertura vive en el estilo o
     * en el TileJSON, no en el cliente: con esas dos, al mover el mapa se
     * avisaría en falso. Se dejan fuera y solo se comprueba el zoom.
     *
     * @param {Object} capa
     * @returns {boolean}
     */
    function _extentFiable(capa) {
      try {
        if (_tieneMVT(capa)) return false;
        if (_tieneMapLibre(capa)) return false;
      } catch (e) { /* si falla la detección se comprueba igual */ }
      return true;
    }

    /**
     * Estado del ojito de una capa.
     *
     * - `on`: encendida y, con lo que se sabe, pintando.
     * - `off`: apagada por el usuario.
     * - `fuera`: encendida, pero ahora mismo no se ve (zoom fuera de su
     *   rango o cobertura fuera de la vista).
     *
     * @param {Object} capa
     * @returns {{estado: string, motivo: (string|null), detalle: string}}
     */
    function _estadoOjoCapa(capa) {
      let visible = true;
      try { visible = (capa && typeof capa.isVisible === 'function') ? !!capa.isVisible() : true; } catch (e) { visible = true; }
      if (!visible) return { estado: 'off', motivo: null, detalle: '' };

      const vista = vistaEnGrados();

      // El zoom que manda es el de la API: es el que usan las capas para
      // decidir si cargan (GeoParquet compara `map.getZoom()` con su
      // minZoom). En 3D, `vistaEnGrados().zoom` es una estimación por
      // grados/píxel y puede no coincidir, así que solo se usa de reserva.
      let zoomActual = vista ? vista.zoom : null;
      try {
        const z = (map && typeof map.getZoom === 'function') ? Number(map.getZoom()) : NaN;
        if (isFinite(z)) zoomActual = z;
      } catch (e) { /* se queda con la estimada */ }

      // 1) Fuera de la escala de la capa.
      if (isFinite(zoomActual)) {
        const lim = _limitesZoomCapa(capa);
        if (lim.min !== null && zoomActual < lim.min) {
          return {
            estado: 'fuera',
            motivo: 'zoom',
            detalle: 'el zoom actual (' + _formatoZoom(zoomActual) + ') es menor que el mínimo de la capa (' + _formatoZoom(lim.min) + ')',
          };
        }
        if (lim.max !== null && zoomActual > lim.max) {
          return {
            estado: 'fuera',
            motivo: 'zoom',
            detalle: 'el zoom actual (' + _formatoZoom(zoomActual) + ') es mayor que el máximo de la capa (' + _formatoZoom(lim.max) + ')',
          };
        }
      }

      // 2) Cobertura fuera de la vista (sin vista no se puede decidir).
      if (vista && _extentFiable(capa)) {
        const ext = _extensionCapaEnGrados(capa);
        if (ext && !_seSolapaConVista(ext, vista)) {
          return {
            estado: 'fuera',
            motivo: 'extension',
            detalle: 'su cobertura queda fuera de la vista actual',
          };
        }
      }

      return { estado: 'on', motivo: null, detalle: '' };
    }

    /** Zoom con un decimal y coma decimal, para los títulos del ojito. */
    function _formatoZoom(v) {
      const n = Math.round(Number(v) * 10) / 10;
      return String(n).replace('.', ',');
    }

    /** Título (tooltip) del botón de visibilidad según el estado. */
    function _tituloOjo(estado, esRadio) {
      if (estado.estado === 'fuera') {
        return 'Encendida, pero no se ve: ' + estado.detalle + '. Pulsa para ocultarla.';
      }
      if (estado.estado === 'off') return esRadio ? 'Ver solo esta capa' : 'Mostrar capa';
      return esRadio ? 'Es la capa que se ve: elige otra para cambiarla' : 'Ocultar capa';
    }

    // SVG del ojo abierto y del ojo tachado. Son inline (como el resto de
    // iconos del plugin) en lugar de emojis: los emojis 👁/🚫 dependen de la
    // fuente del sistema y en algunos navegadores aparecen como un punto.
    const SVG_OJO_ABIERTO = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const SVG_OJO_TACHADO = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    // Chevrones para la acción masiva sobre grupos: hacia dentro (plegar) y
    // hacia fuera (desplegar). Se dibujan como el resto de iconos del plugin
    // (SVG en línea con stroke=currentColor) para que hereden el color del
    // botón y no dependan de emojis ni de la fuente del sistema.
    const SVG_PLEGAR_GRUPOS = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 20 5-5 5 5"></path><path d="m7 4 5 5 5-5"></path></svg>';
    const SVG_DESPLEGAR_GRUPOS = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>';

    /**
     * Dibujo del ojito. El estado `fuera` mantiene el ojo ABIERTO (la capa
     * está encendida) y añade la insignia "!" que pinta el CSS.
     */
    function _svgOjo(estado) {
      return estado === 'off' ? SVG_OJO_TACHADO : SVG_OJO_ABIERTO;
    }

    /**
     * Repinta un botón de visibilidad ya montado con el estado actual.
     * Se usa al mover el mapa, sin rehacer la lista (rehacerla cerraría el
     * desplegable de opciones y cortaría un arrastre en curso).
     *
     * @param {HTMLElement} btn
     * @param {Object} capa
     */
    function _aplicarOjoBoton(btn, capa) {
      if (!btn || !capa) return;
      const estado = _estadoOjoCapa(capa);
      const visible = estado.estado !== 'off';
      const fuera = estado.estado === 'fuera';
      const esRadio = btn.classList.contains('ls-radio');
      if (esRadio) {
        btn.classList.toggle('ls-radio-on', visible);
        btn.classList.toggle('ls-radio-off', !visible);
        btn.innerHTML = '<span class="ls-radio-marca" aria-hidden="true"></span>'
          + (fuera ? '<span class="ls-eye-badge" aria-hidden="true">!</span>' : '');
        btn.setAttribute('aria-checked', visible ? 'true' : 'false');
      } else {
        btn.classList.toggle('ls-eye-on', visible);
        btn.classList.toggle('ls-eye-off', !visible);
        btn.innerHTML = _svgOjo(estado.estado)
          + (fuera ? '<span class="ls-eye-badge" aria-hidden="true">!</span>' : '');
      }
      btn.classList.toggle('ls-eye-fuera', fuera);
      btn.title = _tituloOjo(estado, esRadio);
    }

    /** Recalcula y repinta los ojitos ya montados en el panel. */
    function _refrescarOjos() {
      let botones = [];
      try {
        botones = Array.prototype.slice.call(
          document.querySelectorAll('.g-herramienta_selectorCapa .ls-eye[data-id]')
        );
      } catch (e) { return; }
      botones.forEach((btn) => {
        const capa = findLayerById(btn.getAttribute('data-id'));
        if (capa) _aplicarOjoBoton(btn, capa);
      });
    }

    /**
     * Engancha `hecho` al final de cada movimiento del mapa, en 2D y en 3D,
     * y devuelve la función que lo desengancha.
     *
     * No se usa la fachada de la API porque no publica un evento de fin de
     * movimiento: se escucha a la implementación, que es la que sabe cuándo
     * termina (en OpenLayers, `moveend`; en Cesium, `camera.moveEnd`).
     *
     * @param {Function} hecho
     * @returns {Function}
     */
    function _engancharFinDeMovimiento(hecho) {
      const sueltas = [];
      let pendiente = null;
      // Se agrupa la ráfaga: un `fit()` dispara varios eventos seguidos.
      const diferido = function () {
        if (pendiente) clearTimeout(pendiente);
        pendiente = setTimeout(function () { pendiente = null; hecho(); }, 120);
      };

      let impl = null;
      try { impl = (map && typeof map.getMapImpl === 'function') ? map.getMapImpl() : null; } catch (e) { impl = null; }
      const escena = (impl && impl.scene) ? impl.scene : null;
      if (escena && escena.camera) {
        const camara = escena.camera;
        if (camara.moveEnd && typeof camara.moveEnd.addEventListener === 'function') {
          camara.moveEnd.addEventListener(diferido);
          sueltas.push(function () { try { camara.moveEnd.removeEventListener(diferido); } catch (e) { /* ya suelto */ } });
        } else if (camara.changed && typeof camara.changed.addEventListener === 'function') {
          // Reserva para versiones de Cesium sin `moveEnd`.
          try { camara.percentageChanged = 0.05; } catch (e) { /* sin umbral */ }
          camara.changed.addEventListener(diferido);
          sueltas.push(function () { try { camara.changed.removeEventListener(diferido); } catch (e) { /* ya suelto */ } });
        }
      } else if (impl && typeof impl.on === 'function') {
        impl.on('moveend', diferido);
        sueltas.push(function () { try { impl.un('moveend', diferido); } catch (e) { /* ya suelto */ } });
      }

      return function () {
        if (pendiente) { clearTimeout(pendiente); pendiente = null; }
        sueltas.forEach(function (s) { try { s(); } catch (e) { /* ya suelto */ } });
      };
    }

    /**
     * Obtiene la lista de estilos disponibles para una capa (vectorial o ráster).
     * Devuelve { styles: [{ id, name, styleObj, isVector, isWms }], currentId } o null si no tiene múltiples estilos.
     * @param {Object} layer
     * @returns {Object|null}
     */
    function getLayerAvailableStyles(layer) {
      if (!layer) return null;
      const stylesList = [];

      // 1. Capas Vectoriales (Vector, GeoJSON, KML, WFS, etc.)
      let rawVectorStyles = null;
      if (layer.options && Array.isArray(layer.options.styles) && layer.options.styles.length > 0) {
        rawVectorStyles = layer.options.styles;
      } else if (layer.constructorParameters && layer.constructorParameters.options && Array.isArray(layer.constructorParameters.options.styles) && layer.constructorParameters.options.styles.length > 0) {
        rawVectorStyles = layer.constructorParameters.options.styles;
      } else if (layer.constructorParameters && Array.isArray(layer.constructorParameters.styles) && layer.constructorParameters.styles.length > 0) {
        rawVectorStyles = layer.constructorParameters.styles;
      } else if (Array.isArray(layer.predefinedStyles) && layer.predefinedStyles.length > 0) {
        rawVectorStyles = layer.predefinedStyles;
      } else if (Array.isArray(layer.styles) && layer.styles.length > 0 && typeof layer.styles[0] === 'object') {
        rawVectorStyles = layer.styles;
      }

      if (rawVectorStyles && rawVectorStyles.length > 1) {
        rawVectorStyles.forEach((st, idx) => {
          let name = '';
          if (st) {
            name = st.name || (st.options_ && st.options_.name) || (st.impl_ && st.impl_.options_ && st.impl_.options_.name) || st.title || st.label || st.id || '';
          }
          if (!name) name = 'Estilo ' + (idx + 1);
          stylesList.push({
            id: String(idx),
            name: String(name),
            styleObj: st,
            isVector: true,
          });
        });

        let currentId = '0';
        if (layer._selectedStyleIndex !== undefined && stylesList[layer._selectedStyleIndex]) {
          currentId = String(layer._selectedStyleIndex);
        } else if (layer._selectedStyleName) {
          const match = stylesList.find(s => s.name === layer._selectedStyleName);
          if (match) currentId = match.id;
        } else if (typeof layer.getStyle === 'function') {
          const cur = layer.getStyle();
          if (cur) {
            const matchIdx = rawVectorStyles.indexOf(cur);
            if (matchIdx !== -1) currentId = String(matchIdx);
            else {
              const curName = cur.name || (cur.options_ && cur.options_.name);
              if (curName) {
                const m = stylesList.find(s => s.name === curName);
                if (m) currentId = m.id;
              }
            }
          }
        }
        return { styles: stylesList, currentId, isVector: true };
      }

      // 2. Capas WMS (o con setStyles)
      const layerType = String(layer.type || layer._type || (layer.getImpl && layer.getImpl().type) || '').toLowerCase();
      const esWMS = layerType === 'wms' || typeof layer.setStyles === 'function' || _esCapaWMS(layer);

      if (esWMS) {
        let wmsRaw = layer.options && (layer.options.availableStyles || layer.options.styles);
        if (!wmsRaw && layer.constructorParameters && layer.constructorParameters.options) {
          wmsRaw = layer.constructorParameters.options.availableStyles || layer.constructorParameters.options.styles;
        }
        if (!wmsRaw && layer.availableStyles) wmsRaw = layer.availableStyles;
        if (!wmsRaw && layer.styles && typeof layer.styles === 'string' && layer.styles.includes(',')) wmsRaw = layer.styles;

        if (Array.isArray(wmsRaw)) {
          wmsRaw.forEach((item, idx) => {
            if (typeof item === 'string') {
              stylesList.push({ id: item, name: item || 'Por defecto', isWms: true });
            } else if (item && typeof item === 'object') {
              const id = item.name || item.id || item.style || String(idx);
              const name = item.title || item.name || item.label || id;
              stylesList.push({ id: String(id), name: String(name), isWms: true });
            }
          });
        } else if (typeof wmsRaw === 'string' && wmsRaw.trim()) {
          const parts = wmsRaw.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
          if (parts.length > 1) {
            parts.forEach((p) => {
              stylesList.push({ id: p, name: p || 'Por defecto', isWms: true });
            });
          }
        }

        // Si no hay estilos explícitos en las opciones, se usan los que el
        // plugin ya haya leído del GetCapabilities al abrir el panel de la
        // capa (`toggleLayerOptions` los deja en `_wmsAvailableStyles`). No se
        // consulta aquí la caché porque este render es síncrono.
        if (stylesList.length === 0 && Array.isArray(layer._wmsAvailableStyles)) {
          layer._wmsAvailableStyles.forEach((s) => {
            stylesList.push({ id: s.id || s.name, name: s.name || s.title || s.id, isWms: true });
          });
        }

        if (stylesList.length > 1) {
          let currentStyles = '';
          if (typeof layer.getStyles === 'function') {
            try { currentStyles = layer.getStyles() || ''; } catch (e) {}
          }
          if (!currentStyles && layer.options && typeof layer.options.styles === 'string') {
            currentStyles = layer.options.styles;
          }
          let currentId = stylesList[0].id;
          if (layer._selectedStyleName) {
            const m = stylesList.find(s => s.id === layer._selectedStyleName || s.name === layer._selectedStyleName);
            if (m) currentId = m.id;
          } else if (layer._currentStyleId) {
            const m = stylesList.find(s => s.id === layer._currentStyleId);
            if (m) currentId = m.id;
          } else if (currentStyles) {
            const match = stylesList.find(s => s.id === currentStyles || s.name === currentStyles);
            if (match) currentId = match.id;
          }
          return { styles: stylesList, currentId, isWms: true };
        }
      }

      // 3. Soporte universal para capas con availableStyles
      const av = (layer.options && layer.options.availableStyles) || layer.availableStyles;
      if (Array.isArray(av) && av.length > 1) {
        av.forEach((item, idx) => {
          if (typeof item === 'string') {
            stylesList.push({ id: item, name: item, styleObj: item });
          } else if (item && typeof item === 'object') {
            const id = item.id || item.name || String(idx);
            const name = item.title || item.name || item.label || id;
            stylesList.push({ id: String(id), name: String(name), styleObj: item.style || item });
          }
        });
        let currentId = stylesList[0].id;
        if (layer._currentStyleId !== undefined) currentId = String(layer._currentStyleId);
        return { styles: stylesList, currentId };
      }

      return null;
    }

    const renderLayerNode = (node, depth) => {
      const layer = node.layer;
      const layerName = getLayerDisplayName(layer);
      const index = layer.idLayer;
      // El ojito tiene TRES estados (ver `_estadoOjoCapa`): abierto (visible
      // y pintando), tachado (oculta) y abierto con insignia (encendida,
      // pero ahora mismo no se ve porque el zoom o la vista la dejan fuera).
      const estadoOjo = _estadoOjoCapa(layer);
      const visible = estadoOjo.estado !== 'off';
      const fueraDeVista = estadoOjo.estado === 'fuera';
      const eyeIcon = _svgOjo(estadoOjo.estado);
      const badgeOjo = fueraDeVista ? '<span class="ls-eye-badge" aria-hidden="true">!</span>' : '';
      // Transparencia actual en % (100 = totalmente transparente).
      // La API usa opacidad 0..1, asi que transparencia = (1 - opacity).
      let opacity = 1;
      try { if (layer.getOpacity !== undefined) opacity = layer.getOpacity() || 0; } catch (e) { /* ignorar */ }
      const transpPct = Math.round((1 - opacity) * 100);
      const optionsOpen = self._optionsOpen === index;
      // Solo las capas VECTORIALES tienen tabla de atributos: las raster
      // (y los grupos) no aportan nada, asi que se omite el boton de tabla.
      const layerKind = window.getLayerKind(layer);
      const tableBtnHtml = layerKind === 'vector'
        ? `<button type="button" class="ls-action ls-action-info" data-id="${index}" title="Ver tabla de atributos / estadísticas de la capa" onclick="openLayerInfo('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg></button>`
        : '';
      // Gradiente del track del slider: representa la OPACIDAD (lo que
      // queda visible). 0% de transparencia (opaco) => relleno hasta la
      // derecha (100%); 100% de transparencia => riel vacio (0%).
      const fillPct = 100 - transpPct;
      const sliderFill = `linear-gradient(to right, #0078d4 0%, #0078d4 ${fillPct}%, #d7dde7 ${fillPct}%, #d7dde7 100%)`;
      // En el modo "una capa a la vez" el control no es un ojito sino un
      // radio: dice cuál se está viendo y, al pulsar otra, la enciende y
      // apaga la anterior. El resto de capas (las que se superponen y quedan
      // fuera del grupo) siguen con el ojito de siempre.
      const esRadio = !node.isGroup && enGrupoRadio(layer);
      const tituloVisibilidad = _tituloOjo(estadoOjo, esRadio);
      const claseFuera = fueraDeVista ? ' ls-eye-fuera' : '';
      const eyeBtn = esRadio
        ? `<button type="button" class="ls-eye ls-radio ${visible ? 'ls-radio-on' : 'ls-radio-off'}${claseFuera}" data-id="${index}" role="radio" aria-checked="${visible ? 'true' : 'false'}" title="${tituloVisibilidad}" onclick="toggleLayerVisibility('${index}')"><span class="ls-radio-marca" aria-hidden="true"></span>${badgeOjo}</button>`
        : `<button type="button" class="ls-eye ${visible ? 'ls-eye-on' : 'ls-eye-off'}${claseFuera}" data-id="${index}" title="${tituloVisibilidad}" onclick="toggleLayerVisibility('${index}')">${eyeIcon}${badgeOjo}</button>`;
      const optsBtn = `<button type="button" class="ls-options ${optionsOpen ? 'ls-options-open' : ''}" data-id="${index}" title="Opciones de la capa" onclick="toggleLayerOptions('${index}')">▾</button>`;

      // Selector de estilos si la capa tiene múltiples estilos disponibles
      const availableStyles = getLayerAvailableStyles(layer);
      let stylesRowHtml = '';
      if (availableStyles && availableStyles.styles && availableStyles.styles.length > 1) {
        const optionsHtml = availableStyles.styles.map((st) => {
          const isSelected = String(st.id) === String(availableStyles.currentId);
          return `<option value="${_escaparHtml(st.id)}" ${isSelected ? 'selected' : ''}>${_escaparHtml(st.name)}</option>`;
        }).join('');

        stylesRowHtml = `
                <div class="ls-option-row ls-option-row-style">
                  <span class="ls-option-label" title="Estilo visual de la capa">Estilo</span>
                  <select class="ls-style-select" aria-label="Estilo de ${layerName}" onchange="setLayerStyle('${index}', this.value)">
                    ${optionsHtml}
                  </select>
                </div>`;
      }

      // ── Segunda fila: mover, copiar y recargar ──────────────────────
      // Va aparte de la primera (zoom, renombrar, tabla, ficha, borrar) para
      // no amontonar nueve iconos en una sola línea, y porque son otra cosa:
      // las de arriba miran la capa, estas la mueven en la pila, la copian o
      // le vuelven a pedir los datos al servicio.
      //
      // "Aislar" solo se ofrece en hojas. Un grupo no tiene un estado de
      // visibilidad propio que aislar (lo que se enciende y apaga son sus
      // hijas), así que en un grupo el botón sobra.
      const aisladaActiva = !!(self._aislada && String(self._aislada.index) === String(index));
      const isolateBtnHtml = node.isGroup
        ? ''
        : `<button type="button" class="ls-action ls-action-aislar${aisladaActiva ? ' ls-action-activo' : ''}" data-id="${index}" title="${aisladaActiva ? 'Dejar de aislar: devolver la visibilidad anterior' : 'Aislar: dejar solo esta capa visible'}" onclick="isolateLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="22" y1="12" x2="17" y2="12"></line><line x1="7" y1="12" x2="2" y2="12"></line><line x1="12" y1="7" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="17"></line></svg></button>`;

      const optionsPanel = `
              <div class="ls-options-panel ${optionsOpen ? 'open' : ''}">
                <div class="ls-option-row">
                  <span class="ls-option-label" title="Transparencia de la capa">Transparencia</span>
                  <input type="range" min="0" max="100" value="${transpPct}" class="ls-opacity-slider" style="background:${sliderFill}" aria-label="Transparencia de ${layerName}" oninput="setLayerOpacity('${index}', this.value, this)">
                  <span class="ls-option-value">${transpPct}%</span>
                </div>
                ${stylesRowHtml}
                <div class="ls-actions-row">
                  <button type="button" class="ls-action ls-action-zoom" data-id="${index}" title="Zoom a la capa" onclick="zoomToLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="12" r="3.2"></circle></svg></button>
                  <button type="button" class="ls-action ls-action-rename" data-id="${index}" title="Renombrar capa" onclick="startRenameLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                  ${tableBtnHtml}
                  <button type="button" class="ls-action ls-action-ficha" data-id="${index}" title="Información de la capa: cómo está construida y su documento de servicio" onclick="openLayerFicha('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="11" x2="12" y2="16"></line><circle cx="12" cy="7.6" r="0.4" fill="currentColor"></circle></svg></button>
                  <button type="button" class="ls-action ls-action-delete" data-id="${index}" title="Eliminar la capa del mapa" onclick="deleteLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                </div>
                <div class="ls-actions-row ls-actions-row-gestion">
                  <button type="button" class="ls-action ls-action-frente" data-id="${index}" title="Traer al frente (encima de las demás)" onclick="layerToFront('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14"></path><path d="m18 13-6-6-6 6"></path><path d="M12 7v14"></path></svg></button>
                  <button type="button" class="ls-action ls-action-fondo" data-id="${index}" title="Enviar al fondo (debajo de las demás)" onclick="layerToBack('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3"></path><path d="m6 11 6 6 6-6"></path><path d="M19 21H5"></path></svg></button>
                  <button type="button" class="ls-action ls-action-duplicar" data-id="${index}" title="Duplicar la capa" onclick="duplicateLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                  <button type="button" class="ls-action ls-action-recargar" data-id="${index}" title="Recargar la capa (vuelve a pedir los datos al servicio)" onclick="reloadLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><path d="M3 21v-5h5"></path></svg></button>
                  ${isolateBtnHtml}
                </div>
              </div>`;

      // Asa de arrastre: unico punto desde el que se inicia el drag (así el
      // resto de botones de la fila siguen siendo clicables durante el Drag&Drop).
      const dragHandleHtml = `<span class="ls-drag-handle" title="Arrastra para reordenar" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.7"/><circle cx="15" cy="5" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="19" r="1.7"/><circle cx="15" cy="19" r="1.7"/></svg></span>`;

      // Nombre clicable: alterna la visibilidad (mismo comportamiento que el
      // ojito) pero sin duplicar el boton. Publico para que no dependa del
      // formato del panel de opciones.
      const nameBtn = `<button type="button" class="ls-nombre ${node.isGroup ? 'ls-group-name' : ''}" data-id="${index}" title="${tituloVisibilidad}" onclick="toggleLayerVisibility('${index}')">${layerName}</button>`;

      if (node.isGroup) {
        const collapsed = isGroupCollapsed(layer);
        const chevron = collapsed ? '▸' : '▾';
        const childrenHtml = node.children.map(c => renderLayerNode(c, depth + 1)).join('');
        return `
            <li class="ls-group" data-depth="${depth}" draggable="true" data-drag-id="${index}">
              <div class="ls-row">
                ${dragHandleHtml}
                <button type="button" class="ls-group-chevron" data-id="${index}" title="${collapsed ? 'Expandir grupo' : 'Colapsar grupo'}" onclick="toggleGroup('${index}')">${chevron}</button>
                ${nameBtn}
                ${eyeBtn}
                ${optsBtn}
              </div>
              ${optionsPanel}
              <ul class="ls-children ${collapsed ? 'ls-collapsed' : ''}">${childrenHtml}</ul>
            </li>`;
      }

      return `
            <li data-depth="${depth}" draggable="true" data-drag-id="${index}">
              <div class="ls-row">
                ${dragHandleHtml}
                ${nameBtn}
                ${eyeBtn}
                ${optsBtn}
              </div>
              ${optionsPanel}
            </li>`;
    };

    const renderLayerList = async () => {
      try {
        const tree = await buildLayerTree();
        const htmlList = tree.map(node => renderLayerNode(node, 0)).join('');

        // Sin capas que gestionar se pintaba un <ul> vacío, que en el panel
        // parecía un hueco roto en vez de "aquí no hay nada". Se pone un texto
        // que lo explique, y por qué: las capas base y las que llevan
        // displayInLayerSwitcher false quedan fuera a propósito.
        const cuerpo = htmlList || '<li class="ls-vacio" role="status">'
          + 'No se han encontrado capas superpuestas para gestionar desde el selector de capas.'
          + '</li>';

        // ── Barra de acciones rápidas ──────────────────────────────────
        // Los rótulos se calculan sobre el árbol ya construido (no se vuelve
        // a recorrer el mapa): así dicen la verdad de lo que hay pintado.
        // - "Ocultar todas" / "Mostrar todas": es un interruptor maestro. Si
        //   se ve ALGUNA capa HOJA, el botón las apaga todas; si no se ve
        //   ninguna, las enciende. Se evita el criterio "si no están todas,
        //   enciende": en el modo "una capa a la vez" nunca se pueden ver
        //   todas (solo una del grupo puede estar encendida) y el botón se
        //   quedaría clavado en "Mostrar todas" sin poder apagar nada.
        //   Los nodos de grupo no cuentan: su visibilidad es la del grupo y
        //   no dice si se está viendo algo (un grupo apagado con las hijas
        //   encendidas no pinta nada, pero al revés tampoco).
        // - "Plegar grupos" / "Desplegar grupos": según si ya están todos
        //   plegados. Solo aparece si hay grupos, para no dejar un botón
        //   muerto en un selector de capas sueltas.
        let totalHojas = 0;
        let visiblesHojas = 0;
        let totalGrupos = 0;
        let gruposPlegados = 0;
        const contarNodos = (nodos) => {
          nodos.forEach((n) => {
            if (n.isGroup) {
              totalGrupos++;
              if (isGroupCollapsed(n.layer)) gruposPlegados++;
              contarNodos(n.children);
              return;
            }
            totalHojas++;
            let visible = true;
            try {
              visible = !!(n.layer && typeof n.layer.isVisible === 'function' && n.layer.isVisible());
            } catch (e) { visible = true; }
            if (visible) visiblesHojas++;
          });
        };
        contarNodos(tree);

        const algoVisible = visiblesHojas > 0;
        const todosPlegados = totalGrupos > 0 && gruposPlegados >= totalGrupos;
        const toolbarHtml = (totalHojas + totalGrupos) === 0 ? '' : `
          <div class="ls-toolbar" role="toolbar" aria-label="Acciones rápidas del selector de capas">
            <button type="button" class="ls-tool ls-tool-visibilidad" data-accion="visibilidad"
              title="${algoVisible ? 'Ocultar todas las capas del selector' : 'Mostrar todas las capas del selector'}"
              aria-pressed="${algoVisible ? 'true' : 'false'}"
              onclick="toggleAllLayersVisibility()">
              ${algoVisible ? SVG_OJO_TACHADO : SVG_OJO_ABIERTO}
              <span class="ls-tool-text">${algoVisible ? 'Ocultar todas' : 'Mostrar todas'}</span>
            </button>
            ${totalGrupos ? `<button type="button" class="ls-tool ls-tool-grupos" data-accion="grupos"
              title="${todosPlegados ? 'Desplegar todos los grupos de capas' : 'Plegar todos los grupos de capas'}"
              aria-pressed="${todosPlegados ? 'true' : 'false'}"
              onclick="toggleAllGroups()">
              ${todosPlegados ? SVG_DESPLEGAR_GRUPOS : SVG_PLEGAR_GRUPOS}
              <span class="ls-tool-text">${todosPlegados ? 'Desplegar grupos' : 'Plegar grupos'}</span>
            </button>` : ''}
          </div>`;

        // El contenedor con clase `overlay-layer-selector` pasa de ser el
        // propio <ul> a un <div> que envuelve la barra y la lista: todas las
        // reglas CSS del plugin son descendientes de esa clase, así que el
        // árbol se pinta igual y la barra puede quedarse fija al hacer scroll.
        control.htmlView = `<div class="overlay-layer-selector">${toolbarHtml}<ul class="ls-lista">${cuerpo}</ul></div>`;
        const preview = document.querySelector('#m-herramienta-previews-layerSwitcher');
        if (preview) preview.innerHTML = control.htmlView;

        // Hay capas cuya extensión llega después de pintar la lista (un
        // GeoTIFF en 3D, un GeoParquet en su primera carga). Un segundo pase
        // corrige el ojito sin rehacer la lista.
        setTimeout(_refrescarOjos, 1200);

        // Enlaza los eventos de drag & drop UNA sola vez por lista. Se usan
        // listeners delegados en el <ul> para que sigan funcionando tras cada
        // re-render (renderLayerList reemplaza el innerHTML).
        if (!preview.__lsDragBound) {
          preview.__lsDragBound = true;
          // Arma el flag "el gesto empezó en el asa": el evento dragstart se
          // dispara con target = el <li> draggable (no el elemento bajo el
          // cursor), así que el origen real del gesto hay que capturarlo en
          // pointerdown. Sin esto el drag se cancelaría siempre.
          preview.addEventListener('pointerdown', (e) => {
            window.__lsDragHandleArmed = !!(e.target.closest && e.target.closest('.ls-drag-handle'));
          });
          preview.addEventListener('dragstart', window.handleDragStart);
          preview.addEventListener('dragover', window.handleDragOver);
          preview.addEventListener('drop', window.handleDrop);
          preview.addEventListener('dragend', window.handleDragEnd);
          preview.addEventListener('dragleave', (e) => {
            if (!preview.contains(e.relatedTarget)) clearDropMarks();
          });
        }
      } catch (e) {
        console.warn('layerSwitcher: error rendering layer list', e);
      }
    };

    // Expone el re-render para que los controles (ojito) refresquen
    // la lista y el estado de visibilidad tras cada cambio.
    self._renderLayerList = renderLayerList;
    window.renderLayerList = async () => { await renderLayerList(); };

    control.activate = async () => {
      normalizarGrupoRadio();
      await renderLayerList();
    };

    control.deactivate = () => { };

    window.toggleLayerVisibility = function (index) {
      const layer = findLayerById(index);
      if (!layer || typeof layer.setVisible !== 'function') return;

      // Modo "una capa a la vez" (`seleccionUnica`): encender una capa del
      // grupo apaga las demás del grupo, y la que ya se está viendo no se
      // apaga (un radio no se desmarca; apagarla dejaría el hueco sin fondo).
      // Las capas que quedan fuera del grupo se siguen alternando con el
      // ojito, encima del fondo elegido.
      if (!isGroupLayer(layer) && enGrupoRadio(layer)) {
        if (layer.isVisible()) return;
        capasGrupoRadio().forEach(c => {
          if (c !== layer && typeof c.setVisible === 'function') c.setVisible(false);
        });
        layer.setVisible(true);
        if (window.renderLayerList && typeof window.renderLayerList === 'function') {
          window.renderLayerList();
        }
        return;
      }

      // El ojito es el unico control de visibilidad: alterna la capa de forma
      // independiente (varias capas pueden estar visibles a la vez). En un
      // grupo, alterna la visibilidad del grupo COMPLETO (OpenLayers oculta
      // el render de todas sus hijas sin tocar su estado individual).
      layer.setVisible(!layer.isVisible());
      // Actualiza el ojito (estado visible/oculto) tras el cambio.
      if (window.renderLayerList && typeof window.renderLayerList === 'function') {
        window.renderLayerList();
      } else if (layer && layer.isVisible) {
        const eye = document.querySelector('.g-herramienta_selectorCapa .ls-eye[data-id="' + index + '"]');
        // Mismo dibujo y mismo estado que en el render principal
        // (`_aplicarOjoBoton` incluye el tercer estado "fuera").
        if (eye) _aplicarOjoBoton(eye, layer);
      }
    };

    // ── Acciones masivas: mostrar/ocultar todas y plegar/desplegar grupos ──
    // Actúan sobre TODO lo que lista el selector, no solo sobre la raíz: una
    // capa que vive dentro de un grupo también tiene su ojito en la lista y
    // su visibilidad es estado de la UI (se conserva entre swaps 2D/3D), así
    // que dejarla fuera del "todas" daría un resultado a medias. Los grupos
    // entran también: ocultar un grupo esconde a sus hijas en el render, y
    // para que "mostrar todas" las devuelva hay que encender el grupo además
    // de cada hija.

    /** ¿Está visible la capa? Sin lanzar si no expone isVisible(). */
    function _esVisible(capa) {
      try { return !!(capa && typeof capa.isVisible === 'function' && capa.isVisible()); } catch (e) { return false; }
    }

    window.toggleAllLayersVisibility = async function () {
      let capas = [];
      try { capas = await getSelectableLayers(); } catch (e) { capas = []; }
      if (!capas.length) return;

      // Interruptor maestro: si se ve ALGUNA capa hoja, el botón las apaga
      // todas; si no se ve ninguna, las enciende. Es la misma regla que usa
      // el rótulo en el render, para que lo que dice el botón sea lo que hace.
      // Los grupos no cuentan: su visibilidad es la del contenedor, no la de
      // una capa que se esté viendo.
      const ocultarTodas = capas.some(c => !isGroupLayer(c) && _esVisible(c));

      if (ocultarTodas) {
        // Se recuerda qué capa del modo "una capa a la vez" estaba encendida
        // para devolverla al volver a mostrar: en ese modo solo puede haber
        // una visible y elegir otra cambiaría el fondo que tenía el usuario.
        self._radioVisibleAntesDeOcultar = null;
        const radioVisible = capas.find(c => !isGroupLayer(c) && enGrupoRadio(c) && _esVisible(c));
        if (radioVisible) self._radioVisibleAntesDeOcultar = radioVisible.legend || radioVisible.name || null;
        capas.forEach((c) => {
          try { if (typeof c.setVisible === 'function') c.setVisible(false); } catch (e) { /* capa sin visibilidad */ }
        });
      } else {
        // En el modo "una capa a la vez" no se pueden encender todas: se
        // enciende la que ya estaba visible (si el usuario apagó a mano) o la
        // que había antes de "Ocultar todas", y se apagan las demás, que es
        // la única combinación que admite el modo.
        let radioElegida = capas.find(c => !isGroupLayer(c) && enGrupoRadio(c) && _esVisible(c)) || null;
        if (!radioElegida && self._radioVisibleAntesDeOcultar) {
          radioElegida = capas.find(c => !isGroupLayer(c) && enGrupoRadio(c) && (
            String(c.legend) === String(self._radioVisibleAntesDeOcultar) ||
            String(c.name) === String(self._radioVisibleAntesDeOcultar)
          )) || null;
        }
        if (!radioElegida) radioElegida = capas.find(c => !isGroupLayer(c) && enGrupoRadio(c)) || null;
        capas.forEach((c) => {
          try {
            if (typeof c.setVisible !== 'function') return;
            if (!isGroupLayer(c) && enGrupoRadio(c)) {
              c.setVisible(c === radioElegida);
              return;
            }
            c.setVisible(true);
          } catch (e) { /* capa sin visibilidad */ }
        });
      }

      if (typeof window.renderLayerList === 'function') window.renderLayerList();
    };

    window.toggleAllGroups = async function () {
      let capas = [];
      try { capas = await getSelectableLayers(); } catch (e) { capas = []; }

      // Grupos únicos, incluidos los anidados (una capa puede estar solo
      // dentro de un subgrupo y ese subgrupo no aparece en map.getLayers()).
      const grupos = [];
      const vistos = new Set();
      const visitar = (l) => {
        if (!l || !isGroupLayer(l)) return;
        const id = String(l.idLayer);
        if (!vistos.has(id)) { vistos.add(id); grupos.push(l); }
        let hijas = [];
        try { hijas = l.getLayers ? l.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
      };
      capas.forEach(visitar);
      if (!grupos.length) return;

      // Si ya están todos plegados, el botón despliega; si no, pliega (es lo
      // que promete el rótulo "Plegar grupos" cuando hay alguno abierto).
      const plegados = grupos.filter(g => isGroupCollapsed(g)).length;
      const contraer = plegados < grupos.length;
      grupos.forEach((g) => { self._groupCollapsed[String(g.idLayer)] = contraer; });

      if (typeof window.renderLayerList === 'function') window.renderLayerList();
    };

    // ── Desplegable de opciones por capa ────────────────────────────────
    // Abre/cierra el panel de opciones de una capa (transparencia, estilos).
    // Conserva en self._optionsOpen que capa tiene el panel abierto para no
    // cerrarlo al re-renderizar (p.ej. al alternar la visibilidad de otra).
    window.toggleLayerOptions = function (index) {
      self._optionsOpen = self._optionsOpen === index ? null : index;
      if (self._optionsOpen === index) {
        const layer = findLayerById(index);
        if (layer && _esCapaWMS(layer) && layer.url && layer.name && !layer._wmsAvailableStyles) {
          _estilosCapacidadesWMS(layer.url).then(function (porCapa) {
            if (porCapa && porCapa[layer.name] && porCapa[layer.name].length > 1) {
              layer._wmsAvailableStyles = porCapa[layer.name];
              if (self._optionsOpen === index) {
                renderLayerList();
              }
            }
          }).catch(function () {});
        }
      }
      renderLayerList();
    };

    // ── Objetos geográficos: modo, límite y página ──────────────────────
    // La ventana de información (la que abre la tabla de atributos) pinta una
    // barra para decidir qué se pide al servicio: todos los objetos o solo
    // los de la vista, cuántos objetos por página (límite) y qué página. El
    // trabajo lo hace la extensión miPlugin_bboxFeatures, que escribe en el
    // impl de la capa el bbox, el `count`/`startIndex` (WFS 2.0) o el
    // `limit`/`offset` (OGC API Features) y la recarga. Aquí solo se resuelve
    // la capa por idLayer y se repinta la barra sin esperar a la respuesta.
    window.setBBoxModo = function (index, modo) {
      _conCapaDeObjetos(index, function (capa, api) {
        if (typeof api.setModo === 'function') api.setModo(capa, modo === 'vista' ? 'vista' : 'todas');
      });
    };

    window.setBBoxLimite = function (index, n) {
      _conCapaDeObjetos(index, function (capa, api) {
        if (typeof api.setLimite === 'function') api.setLimite(capa, n);
      });
    };

    window.setBBoxPagina = function (index, pagina) {
      _conCapaDeObjetos(index, function (capa, api) {
        if (typeof api.setPagina === 'function') api.setPagina(capa, pagina);
      });
    };

    /**
     * Resuelve la capa de un control de objetos geográficos, aplica el cambio
     * y repinta la barra de la ventana de información.
     * @param {string} index idLayer de la capa.
     * @param {Function} accion Recibe (capa, window.miBBoxFeatures).
     */
    function _conCapaDeObjetos(index, accion) {
      const capa = findLayerById(index);
      if (!capa || !window.miBBoxFeatures) return;
      try {
        accion(capa, window.miBBoxFeatures);
      } catch (e) {
        console.warn('layerSwitcher: no se pudo cambiar los objetos geográficos', e);
      }
      refrescarBarraObjetos(capa);
      refrescarBarraObjetosFicha(capa);
    }

    // ── Colapsar / expandir un grupo de capas ──────────────────────────
    // Alterna el estado y lo conserva en self._groupCollapsed (idLayer -> bool)
    // para que el re-render no lo pierda. Si es la primera vez, parte del
    // valor "collapsed" con el que se creó el grupo en el constructor.
    window.toggleGroup = function (index) {
      const key = String(index);
      const actual = (key in self._groupCollapsed) ? self._groupCollapsed[key] : (() => {
        let def = false;
        try {
          const up = findLayerById(index);
          if (up && up.constructorParameters) {
            const upar = up.constructorParameters.userParameters;
            def = !!(upar && upar.collapsed);
          }
        } catch (e) { def = false; }
        return def;
      })();
      self._groupCollapsed[key] = !actual;
      renderLayerList();
    };

    // ── Renombrar capa / grupo ─────────────────────────────────────────
    // Edita el nombre en linea: el <span class="ls-nombre"> se sustituye por
    // un input. Enter o blur guardan; Escape cancela. Se persiste en la
    // fachada (legend/name/title) y en el impl OL (name/title) para que los
    // paneles de Mapea (legenda, otros selectores) reflejen el cambio.
    window.startRenameLayer = function (index) {
      const layer = findLayerById(index);
      if (!layer) return;
      const li = document.querySelector('.g-herramienta_selectorCapa li[data-drag-id="' + index + '"]');
      if (!li) return;
      const nombreEl = li.querySelector('.ls-nombre');
      if (!nombreEl) return;
      const current = getLayerDisplayName(layer);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ls-rename-input';
      input.value = current;
      input.maxLength = 80;
      // Sustituye el span por el input y da el foco con el nombre seleccionado.
      nombreEl.replaceWith(input);
      input.focus();
      input.select();

      const commit = () => {
        const val = input.value.trim();
        renameLayerName(layer, val || current);
        window.renderLayerList();
      };
      const cancel = () => {
        window.renderLayerList();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });
      // mousedown para no disparar el drag al hacer clic en el input.
      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('blur', commit);
      input.addEventListener('dblclick', (e) => e.stopPropagation());
      // Evita que el input desencadene el drag & drop de la fila.
      input.setAttribute('draggable', 'false');
    };

    // Guarda el nuevo nombre en la fachada de Mapea y en el impl OL,
    // manteniendo el orden de prioridad que lee getLayerDisplayName:
    // legend -> title -> name. Se limpia en el nuevo nombre el patron interno
    // "layer_<n>" para no confundirlo con los nombres autogenerados.
    const renameLayerName = (layer, newName) => {
      try {
        const clean = String(newName == null ? '' : newName).trim();
        if (!clean) return;
        // La prioridad de lectura es legend > title > name: escribimos SIEMPRE
        // en legend (el primer que se lee) para que prevalezca este nombre.
        if (layer) layer.legend = clean;
        if (layer) layer.name = clean;
        // Impl OL: tambien se actualizan name/title para los componentes Mapea.
        const impl = (typeof layer.getImpl === 'function') ? layer.getImpl() : null;
        if (impl) {
          const ol = impl.olLayer;
          if (ol && typeof ol.set === 'function') {
            ol.set('name', clean);
            ol.set('title', clean);
          }
        }
      } catch (e) {
        console.warn('layerSwitcher: no se pudo renombrar la capa', e);
      }
    };
    // Expuesto para que drag & drop pueda reutilizarlo internamente si hace falta.
    window._renameLayerName = renameLayerName;

    // ── Drag & drop para reordenar capas ───────────────────────────────
    // La fila de cada capa/grupo arrastra con el asa (ls-drag-handle). El
    // reordenado se aplica REASIGNANDO el z-index del impl OL (el renderer de
    // OpenLayers pinta por zIndex, no por orden de coleccion: se verificó que
    // la coleccion raiz esta desordenada [1042,45,0,46] y el render es
    // correcto).
    //
    // applyReorder reindexa las capas seleccionables de un contenedor (raiz
    // del mapa o las hijas directas de un grupo): la capa movida sale de su
    // posicion y todas las del contenedor reciben z consecutivos en el rango
    // que les corresponde. Asi SOLO se alteran los z de las capas del
    // contenedor que intervienen, y las capas NO seleccionables (auxiliares,
    // capa de dibujo __draw__, base) conservan intactos su z y su intercalado.
    //
    //  - Para un GRUPO: las hijas se reparten z consecutivos justo DEBAJO del
    //    techo del grupo (z_del_grupo - 1, z_del_grupo - 2, ...). La primera de
    //    la lista recibe el z mas alto del rango (se dibuja encima de sus
    //    hermanas). Nunca supera el z del grupo (invariante jerarquico).
    //  - Para la RAÍZ: las capas seleccionables se reparten z consecutivos en
    //    el rango que ya ocupan (reindexado contiguo por debajo de su maximo
    //    actual), manteniendo las auxiliares intactas. Si la movida es un
    //    GRUPO, sus hijas se reindexan tambien al nuevo techo del grupo para
    //    no desconectarlas de el.
    const applyReorder = (movedLayer, parentGroup, visibleSiblings, newIndex) => {
      try {
        const vis = visibleSiblings.slice();
        if (vis.indexOf(movedLayer) < 0) return;

        // Nueva ordenacion (arriba = primero).
        const others = vis.filter(l => l !== movedLayer);
        others.splice(Math.max(0, Math.min(newIndex, others.length)), 0, movedLayer);

        if (parentGroup) {
          // ── Hijas de un grupo: rango justo bajo el techo del grupo. ──
          let techo = 0;
          try {
            const cImpl = parentGroup.getImpl ? parentGroup.getImpl() : null;
            const cOl = cImpl && cImpl.olLayer;
            if (cOl && typeof cOl.getZIndex === 'function') techo = cOl.getZIndex() || 0;
          } catch (e) { techo = 0; }
          // 'others' llega en orden visual (arriba = primera): la primera
          // fila recibe el z mas alto del rango (techo-1), la siguiente
          // techo-2, ... Asi el orden visual coincide con el render.
          others.forEach((l, i) => {
            recordZ(l, (techo - 1) - i);
          });
        } else {
          // ── Raiz del mapa: reindexado greedy conservando el orden visual. ──
          // Toda la lista (grupos incluidos) recibe z consecutivos hacia abajo
          // desde el maximo actual de las capas seleccionables: el orden
          // visual queda exacto y los grupos conservan su arbol bajo su nuevo
          // techo (reindexGroupTree). Las capas auxiliares (p.ej. __draw__) y
          // las bases estan fuera de la lista y no se tocan.
          let next = 0;
          vis.forEach(l => { const z = getRealZIndex(l); if (z != null && z > next) next = z; });
          others.forEach((l) => {
            // La primera fila (arriba) toma el maximo actual; las siguientes bajan.
            recordZ(l, Math.max(0, next));
            next -= 1;
            if (isGroupLayer(l)) reindexGroupTree(l);
          });
        }
        // Si la capa movida es un GRUPO, sus hijas deben reindexarse al nuevo
        // techo del grupo (mantenerlas en el rango viejo las desconectaria del
        // grupo). Mismo criterio: techo - 1, techo - 2, ... bajo el grupo.
        if (isGroupLayer(movedLayer)) {
          let techo = getRealZIndex(movedLayer);
          if (techo == null) techo = 0;
          let hijos = [];
          try { hijos = movedLayer.getLayers ? movedLayer.getLayers() : []; } catch (e) { hijos = []; }
          const hijasVis = hijos.filter(h => { try {
            const im = h.getImpl ? h.getImpl() : null;
            if (h && h.isBase === true) return false;
            if (im && im.isBase === true) return false;
            if (h && h.displayInLayerSwitcher === false) return false;
            if (im && im.displayInLayerSwitcher === false) return false;
            const nm = String(h && (h.name || h.legend) || '');
            if (/^layer_\d+$/.test(nm) && !isGroupLayer(h)) return false;
            return true;
          } catch (e) { return false; } });
          const nHijas = hijasVis.length;
          // Reordenadas por z actual (arriba = mayor z).
          hijasVis.sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
          hijasVis.forEach((h, i) => {
            recordZ(h, (techo - 1) - i);
          });
        }
        window.renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: error al reordenar', e);
      }
    };

    // Registra el z-index en la fachada y en el impl OL (logica en _escribirZ,
    // compartida con la restauracion del orden entre 2D y 3D).
    const recordZ = (layer, z) => self._escribirZ(layer, z);

    // Obtiene el contenedor (raiz de mapa o grupo) de una capa: devuelve la
    // lista de capas "hermanas" (mismo nivel) y el grupo padre (null=raiz).
    const getSiblings = (layer) => {
      const parentGroup = findParentGroup(layer);
      if (parentGroup) {
        let hijos = [];
        try { hijos = parentGroup.getLayers ? parentGroup.getLayers() : []; } catch (e) { hijos = []; }
        return { parentGroup, siblings: hijos };
      }
      return { parentGroup: null, siblings: map.getLayers() || [] };
    };

    // ¿Aparece la capa en el selector? Mismo criterio que getSelectableLayers:
    // si no está visible para el usuario no participa en el orden visible.
    const isVisibleInSelector = (l) => {
      try {
        const impl = l.getImpl ? l.getImpl() : null;
        if (l && l.isBase === true) return false;
        if (impl && impl.isBase === true) return false;
        if (l && l.displayInLayerSwitcher === false) return false;
        if (impl && impl.displayInLayerSwitcher === false) return false;
        const nm = String(l && (l.name || l.legend) || '');
        if (/^layer_\d+$/.test(nm) && !isGroupLayer(l)) return false;
        return true;
      } catch (e) { return true; }
    };

    // Capas visibles en el selector de un contenedor (null = la raiz del mapa).
    const visibleIn = (container) => {
      let layers = [];
      try {
        layers = container ? (container.getLayers ? container.getLayers() : []) : (map.getLayers() || []);
      } catch (e) { layers = []; }
      return layers.filter(isVisibleInSelector);
    };

    // ── Reindexado de contenedores (tras mover capas entre ellos) ───────
    // Raiz: se renumera TODO el rango de forma greedy conservando el orden
    // visual (z descendente): cada elemento de la lista recibe el siguiente z
    // disponible hacia abajo. Los GRUPOS reciben tambien su nuevo techo y su
    // arbol se cierra bajo el (sus hijas quedan contiguas bajo el techo), de
    // modo que el orden queda exacto aunque haya varios grupos intercalados.
    // Las capas auxiliares (p.ej. __draw__) y las bases no estan en la lista
    // y no se tocan: el tope es el maximo z actual de las visibles.
    // Grupo: las hijas se reparten contiguas bajo el techo del grupo
    // (techo-1, techo-2, ...) manteniendo su orden visual (z descendente).
    const reindexContainer = (container) => {
      try {
        const sorted = visibleIn(container).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        if (!sorted.length) return;
        if (container) {
          const techo = getRealZIndex(container) || 0;
          sorted.forEach((l, i) => recordZ(l, (techo - 1) - i));
        } else {
          let next = 0;
          sorted.forEach(l => { const z = getRealZIndex(l) || 0; if (z > next) next = z; });
          sorted.forEach(l => {
            recordZ(l, Math.max(0, next));
            next -= 1;
            if (isGroupLayer(l)) reindexGroupTree(l);
          });
        }
      } catch (e) { console.warn('layerSwitcher: error al reindexar contenedor', e); }
    };

    // Cierra el arbol de un grupo bajo su techo actual: las hijas directas se
    // reparten contiguas bajo el techo (techo-1, techo-2, ...) y los subgrupos
    // hacen lo propio recursivamente. Se usa al mover un GRUPO a otro
    // contenedor, para que sus hijas no queden por encima del nuevo techo.
    const reindexGroupTree = (group) => {
      try {
        const hijos = visibleIn(group).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        if (!hijos.length) return;
        const techo = getRealZIndex(group) || 0;
        hijos.forEach((h, i) => {
          recordZ(h, (techo - 1) - i);
          if (isGroupLayer(h)) reindexGroupTree(h);
        });
      } catch (e) { /* defensivo */ }
    };

    // Coloca 'moved' en el contenedor 'container' (null = raiz) justo antes o
    // despues de 'targetLayer', reindexando el destino. 'container' ya debe
    // contener a 'moved' (se ha anadido antes de llamar).
    const placeInContainer = (moved, container, targetLayer, after) => {
      const destVis = visibleIn(container).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
      const others = destVis.filter(l => l !== moved);
      let slot = others.indexOf(targetLayer);
      if (slot < 0) slot = others.length - 1;
      const pos = Math.max(0, Math.min(after ? slot + 1 : slot, others.length));
      others.splice(pos, 0, moved);

      if (container) {
        const techo = getRealZIndex(container) || 0;
        others.forEach((l, i) => recordZ(l, (techo - 1) - i));
      } else {
        // Mismo criterio greedy que reindexContainer: orden visual exacto,
        // grupos reindexados con su arbol bajo su nuevo techo.
        let next = 0;
        destVis.forEach(l => { const z = getRealZIndex(l) || 0; if (z > next) next = z; });
        others.forEach(l => {
          recordZ(l, Math.max(0, next));
          next -= 1;
          if (isGroupLayer(l)) reindexGroupTree(l);
        });
      }
      // Si la pieza movida es un GRUPO, sus hijas deben reindexarse al nuevo
      // techo; si no, quedarian en el rango viejo (posiblemente por encima
      // del nuevo contenedor).
      if (isGroupLayer(moved)) reindexGroupTree(moved);
    };

    // Mueve 'moved' al contenedor de 'targetLayer' (raiz o grupo distinto),
    // insertandolo antes/despues del destino, y cierra el hueco en el origen.
    const moveLayerBetween = (moved, sourceParent, targetLayer, targetParent, after) => {
      try {
        if (sourceParent) sourceParent.removeLayers(moved); else map.removeLayers(moved);
        if (targetParent) targetParent.addLayers(moved); else map.addLayers(moved);
        if (sourceParent !== targetParent) reindexContainer(sourceParent);
        placeInContainer(moved, targetParent, targetLayer, after);
        window.renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo mover la capa entre contenedores', e);
      }
    };

    // Mueve 'moved' DENTRO de 'group' como primera hija (la que se dibuja
    // encima de sus hermanas) y expande el grupo para mostrarla. Se produce
    // al soltar sobre la mitad inferior de la cabecera de un grupo.
    const moveLayerIntoGroup = (moved, group) => {
      try {
        const sourceParent = findParentGroup(moved);
        if (sourceParent) sourceParent.removeLayers(moved); else map.removeLayers(moved);
        if (sourceParent !== group) reindexContainer(sourceParent);
        group.addLayers(moved);
        const hijos = visibleIn(group).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        const others = hijos.filter(l => l !== moved);
        const techo = getRealZIndex(group) || 0;
        const list = [moved].concat(others);
        list.forEach((l, i) => recordZ(l, (techo - 1) - i));
        if (isGroupLayer(moved)) reindexGroupTree(moved);
        // El grupo destino se expande para que la capa quede a la vista.
        self._groupCollapsed[String(group.idLayer)] = false;
        window.renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo meter la capa en el grupo', e);
      }
    };

    window.handleDragStart = function (e) {
      const li = e.target.closest ? e.target.closest('li[data-drag-id]') : null;
      if (!li) return;
      // Solo se inicia el drag si el gesto empezó en el asa (ls-drag-handle):
      // el flag lo arma el listener de pointerdown, porque en dragstart el
      // target es el <li> draggable y no el elemento bajo el cursor.
      if (!window.__lsDragHandleArmed) { e.preventDefault(); return; }
      window.__lsDragHandleArmed = false;
      // El dataTransfer no es legible durante dragover (getData() devuelve ''
      // por privacidad, salvo en drop), asi que se guarda el id arrastrado en
      // una variable global para consultarlo en dragover.
      window.__lsDragId = li.getAttribute('data-drag-id');
      const list = li.closest('.overlay-layer-selector');
      if (list) list.classList.add('ls-dragging-active');
      e.dataTransfer.setData('text/plain', window.__lsDragId);
      e.dataTransfer.effectAllowed = 'move';
      // Retraso para que el clic del asa no se confunda con el drag.
      li.classList.add('ls-dragging');
    };

    window.handleDragOver = function (e) {
      const li = e.target.closest ? e.target.closest('li[data-drag-id]') : null;
      if (!li) return;
      const moved = window.__lsDragId ? findLayerById(window.__lsDragId) : null;
      if (!moved) return;
      const targetLayer = findLayerById(li.getAttribute('data-drag-id'));
      if (!targetLayer || moved === targetLayer) return;
      const isGroupTarget = li.classList.contains('ls-group');
      // Para un GRUPO la "mitad" se calcula sobre su cabecera (.ls-row), no
      // sobre el li completo (que incluye las hijas expandidas): asi la mitad
      // inferior de la cabecera es la zona "meter dentro" y la superior la de
      // "insertar antes del grupo". Si el puntero esta bajo la cabecera (en el
      // area de hijas, sin una hija concreta bajo el cursor) tambien se mete
      // dentro del grupo.
      const refRect = isGroupTarget ? (li.querySelector('.ls-row') || li).getBoundingClientRect() : li.getBoundingClientRect();
      const after = (e.clientY - refRect.top) > refRect.height / 2;
      const sourceParent = findParentGroup(moved);
      const intoGroup = isGroupTarget && (e.clientY > refRect.bottom || after);

      // Zona "meter dentro" de un grupo (mitad inferior de su cabecera o area
      // de hijas sin fila concreta): la capa entrara como hija. Si la capa ya
      // es hija de ese grupo, soltar sobre su propia cabecera no aporta nada;
      // y un grupo no puede meterse en si mismo ni en un descendiente propio
      // (crearia un ciclo).
      if (intoGroup) {
        if (sourceParent === targetLayer) return;
        if (isGroupLayer(moved)) {
          let g = targetLayer;
          while (g) { if (g === moved) return; g = findParentGroup(g); }
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearDropMarks();
        li.classList.add('ls-drop-into-group');
        return;
      }

      // Cualquier otra fila (o mitad superior de la cabecera de un grupo): la
      // capa se inserta antes o despues del destino DENTRO DE SU CONTENEDOR.
      // Vale tanto para reordenar en el mismo contenedor como para sacar una
      // capa de un grupo (destino en la raiz) o meterla en otro grupo
      // (destino dentro del grupo): el drop se resuelve segun el contenedor
      // del destino, no el del origen.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDropMarks();
      li.classList.add(after ? 'ls-drop-below' : 'ls-drop-above');
    };

    window.handleDrop = function (e) {
      e.preventDefault();
      clearDropMarks();
      const dragId = window.__lsDragId || e.dataTransfer.getData('text/plain');
      if (!dragId) return;
      const targetLi = e.target.closest ? e.target.closest('li[data-drag-id]') : null;
      if (!targetLi) return;
      const moved = findLayerById(dragId);
      if (!moved) return;
      const targetLayer = findLayerById(targetLi.getAttribute('data-drag-id'));
      if (!targetLayer || moved === targetLayer) return;
      const isGroupTarget = targetLi.classList.contains('ls-group');
      // Misma geometria que en handleDragOver: para un GRUPO la zona se calcula
      // sobre su cabecera (.ls-row), no sobre el li completo (que incluye las
      // hijas expandidas). Mitad inferior de la cabecera (o area de hijas sin
      // fila concreta bajo el cursor) = "meter dentro" del grupo.
      const refRect = isGroupTarget ? (targetLi.querySelector('.ls-row') || targetLi).getBoundingClientRect() : targetLi.getBoundingClientRect();
      const after = (e.clientY - refRect.top) > refRect.height / 2;
      const intoGroup = isGroupTarget && (e.clientY > refRect.bottom || after);
      const sourceParent = findParentGroup(moved);
      const targetParent = findParentGroup(targetLayer);

      // ── Mover DENTRO de un grupo (mitad inferior de su cabecera o area de
      // hijas sin fila concreta). ──
      if (intoGroup && sourceParent !== targetLayer) {
        // Guarda anti-ciclo: un grupo no puede meterse en si mismo ni en un
        // descendiente propio.
        if (isGroupLayer(moved)) {
          let g = targetLayer;
          while (g) { if (g === moved) return; g = findParentGroup(g); }
        }
        moveLayerIntoGroup(moved, targetLayer);
        e.dataTransfer.clearData();
        return;
      }

      // ── Mismo contenedor: reorden interno antes/despues del destino. ──
      if (sourceParent === targetParent) {
        // 'vis' debe venir en ORDEN VISUAL (z descendente, arriba = primera):
        // la coleccion OL del contenedor no garantiza ningun orden (es el de
        // addLayers), y applyReorder reindexa por posicion en la lista.
        const vis = getSiblings(moved).siblings.filter(isVisibleInSelector)
          .sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        const idx = vis.indexOf(moved);
        const targetIdx = vis.indexOf(targetLayer);
        if (idx < 0 || targetIdx < 0) return;
        // La lista sin la capa arrastrada (los "huecos" donde puede insertarse).
        const others = vis.filter(l => l !== moved);
        // Posicion del destino en esa lista 'others'.
        let targetSlot = others.indexOf(targetLayer);
        if (targetSlot < 0) return;
        // newIndex = posicion (en 'others') donde se inserta moved:
        const newIndex = after ? targetSlot + 1 : targetSlot;
        applyReorder(moved, sourceParent, vis, newIndex);
        e.dataTransfer.clearData();
        return;
      }

      // ── Contenedores distintos: sacar una capa de un grupo y meterla en el
      // contenedor del destino (raiz u otro grupo), en la posicion indicada. ──
      moveLayerBetween(moved, sourceParent, targetLayer, targetParent, after);
      e.dataTransfer.clearData();
    };

    window.handleDragEnd = function () {
      window.__lsDragId = null;
      clearDropMarks();
      document.querySelectorAll('.overlay-layer-selector li.ls-dragging').forEach(el => el.classList.remove('ls-dragging'));
      const list = document.querySelector('.overlay-layer-selector');
      if (list) list.classList.remove('ls-dragging-active');
    };

    const clearDropMarks = () => {
      document.querySelectorAll('.ls-drop-above, .ls-drop-below, .ls-drop-into-group').forEach(el => {
        el.classList.remove('ls-drop-above');
        el.classList.remove('ls-drop-below');
        el.classList.remove('ls-drop-into-group');
      });
    };

    // ── Borrar capa (o grupo de capas) ─────────────────────────────────
    // Elimina la capa del mapa y refresca la lista. Para un grupo se eliminan
    // tambien sus hijas (recursivo, incluidos subgrupos): borrar el contenedor
    // sin su contenido dejaria capas huerfanas en el mapa. Para capas hijas
    // de un grupo, se quitan tanto del grupo como del mapa.
    window.deleteLayer = function (index) {
      const layer = findLayerById(index);
      if (!layer) return;
      try {
        const removeDeep = (g) => {
          let hijos = [];
          try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
          hijos.slice().forEach(h => {
            if (isGroupLayer(h)) removeDeep(h);
            try { g.removeLayers(h); } catch (e) { /* el grupo puede no soportar quitar esta capa */ }
            try { map.removeLayers(h); } catch (e) { /* la hija puede no estar registrada en el mapa nivel raíz */ }
          });
        };
        if (isGroupLayer(layer)) {
          removeDeep(layer);
        } else {
          const parentGroup = findParentGroup(layer);
          if (parentGroup) {
            try { parentGroup.removeLayers(layer); } catch (e) { /* defensivo */ }
          }
        }
        map.removeLayers(layer);
        closeSheet();
        renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo borrar la capa', e);
      }
    };

    // ── Orden de apilado: al frente / al fondo ─────────────────────────
    // Mueve una capa (o un grupo entero, con sus hijas) al extremo de la pila
    // sin inventar z-index nuevos: se PERMUTAN los que ya tienen las capas
    // que participan en el orden. Es el mismo criterio que `_restaurarOrdenZ`,
    // y por la misma razón: así no se invade el rango de las capas que no
    // gestiona el selector ni se generan valores negativos. En Cesium un
    // z-index es la posición dentro de `imageryLayers`, y la API la aplica
    // sacando la capa y volviéndola a insertar en ese índice: un número
    // negativo o fuera de rango no es un orden, es un error.
    window.layerToFront = function (index) { _moverCapaAlExtremo(index, true); };
    window.layerToBack = function (index) { _moverCapaAlExtremo(index, false); };

    /**
     * Lleva una capa al principio o al final de la pila de capas.
     * @param {string} index idLayer de la capa o grupo.
     * @param {boolean} alFrente true = encima de todas; false = debajo.
     */
    function _moverCapaAlExtremo(index, alFrente) {
      const capa = findLayerById(index);
      if (!capa || !map) return;
      // Un grupo no tiene z propio: lo que se mueve son sus hojas.
      const hojas = _hojasDeCapa(capa);
      if (!hojas.length) {
        _avisar('Esta capa no participa en el orden de apilado.');
        return;
      }
      // Capas que sí están en la pila (las vectoriales y las de terreno se
      // quedan fuera: en Cesium su setZIndex reindexa todos los dataSources).
      const conZ = self._capasConZ(map).filter((l) => {
        const z = self._zReal(l);
        return typeof z === 'number' && isFinite(z);
      });
      const bloque = hojas.filter((l) => conZ.indexOf(l) >= 0);
      if (!bloque.length) {
        _avisar('Esta capa no participa en el orden de apilado.');
        return;
      }
      // Las capas base no salen en el selector, pero sí están en la pila: sin
      // separarlas, "enviar al fondo" dejaba la capa DEBAJO del mapa base y
      // desaparecía. "Al fondo" es el fondo de las superpuestas, no el de las
      // bases.
      const esBase = (l) => {
        try {
          if (l && l.isBase === true) return true;
          const impl = (l && typeof l.getImpl === 'function') ? l.getImpl() : null;
          return !!(impl && impl.isBase === true);
        } catch (e) { return false; }
      };
      const bases = conZ.filter((l) => esBase(l) && bloque.indexOf(l) < 0)
        .sort((a, b) => self._zReal(a) - self._zReal(b));
      const ordenadas = conZ.slice().sort((a, b) => self._zReal(a) - self._zReal(b));
      const resto = ordenadas.filter((l) => bloque.indexOf(l) < 0);
      const valores = conZ.map((l) => self._zReal(l)).sort((a, b) => a - b);
      // Dentro del bloque se conserva el orden relativo que ya tenían.
      bloque.sort((a, b) => self._zReal(a) - self._zReal(b));
      const nuevoOrden = alFrente
        ? resto.concat(bloque)
        : bases.concat(bloque, resto.filter((l) => bases.indexOf(l) < 0));
      nuevoOrden.forEach((l, i) => {
        if (typeof valores[i] === 'number') self._escribirZ(l, valores[i]);
      });
      renderLayerList();
    }

    /**
     * Hojas de una capa: ella misma si no es grupo, o todas sus descendientes
     * si lo es (los grupos no se apilan por sí solos).
     * @param {Object} capa
     * @returns {Array<Object>}
     */
    function _hojasDeCapa(capa) {
      if (!capa) return [];
      if (!isGroupLayer(capa)) return [capa];
      const salida = [];
      const visitar = (g) => {
        let hijas = [];
        try { hijas = g.getLayers ? g.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach((h) => {
          if (!h) return;
          if (isGroupLayer(h)) visitar(h);
          else salida.push(h);
        });
      };
      visitar(capa);
      return salida;
    }

    // ── Duplicar capa ─────────────────────────────────────────────────
    // `clone()` copia la capa pero CONSERVA el idLayer (medido en 2D con WMS
    // y GeoJSON), y `addLayers` con un idLayer repetido no añade: quita la
    // capa vieja y deja la nueva en su sitio, así que la original
    // desaparecía. Por eso al clon se le da un id propio con `setId()`.
    //
    // El `name` NO se toca: en WMS y WMTS es la capa que se pide al servicio
    // (el parámetro LAYERS) y cambiarlo rompe las peticiones (medido: pedir
    // "name_copia" devuelve una capa inexistente). Lo que sí cambia es la
    // `legend`, que es el identificador estable del selector y el nombre que
    // se ve.
    window.duplicateLayer = function (index) {
      const capa = findLayerById(index);
      if (!capa || !map) return;
      try {
        if (typeof capa.clone !== 'function') {
          _avisar('Esta capa no se puede duplicar.');
          return;
        }
        const clon = capa.clone();
        if (!clon) {
          _avisar('Esta capa no se puede duplicar.');
          return;
        }
        const idNuevo = 'copia_' + Date.now() + '_' + String(capa.type || 'capa');
        if (typeof clon.setId === 'function') {
          try { clon.setId(idNuevo); } catch (e) { /* se queda con el id de la original */ }
        }

        // La leyenda es única: es el identificador con el que getState/setState
        // reencuentra la capa tras el cambio 2D/3D y el nombre que se ve.
        const base = String(capa.legend || capa.name || 'Capa');
        let leyenda = base + ' (copia)';
        let n = 2;
        while (self._findLayerByLegendInMap(map, leyenda)) {
          leyenda = base + ' (copia ' + n + ')';
          n += 1;
        }
        clon.legend = leyenda;

        // Donde vive la original: una capa se añade SOLO a su contenedor
        // (el mapa o su grupo), nunca a los dos, o se duplica el registro OL.
        const grupo = findParentGroup(capa);
        if (grupo && typeof grupo.addLayers === 'function') grupo.addLayers(clon);
        else map.addLayers([clon]);

        // La copia nace justo encima de la original, para que se vea dónde ha
        // ido a parar sin tener que buscarla en la lista.
        _ponerEncimaDe(clon, capa);

        renderLayerList();
        _avisar('Capa duplicada como «' + leyenda + '».');
      } catch (e) {
        console.warn('layerSwitcher: no se pudo duplicar la capa', e);
        _avisar('No se ha podido duplicar la capa.');
      }
    };

    /**
     * Coloca `nueva` justo por encima de `original`: abre un hueco subiendo un
     * puesto a las que estaban por encima y le da el z libre.
     * @param {Object} nueva
     * @param {Object} original
     */
    function _ponerEncimaDe(nueva, original) {
      const zOriginal = self._zReal(original);
      if (typeof zOriginal !== 'number' || !isFinite(zOriginal)) return;
      self._capasConZ(map).forEach((l) => {
        if (l === nueva) return;
        const z = self._zReal(l);
        if (typeof z === 'number' && isFinite(z) && z > zOriginal) self._escribirZ(l, z + 1);
      });
      self._escribirZ(nueva, zOriginal + 1);
    }

    // ── Recargar capa ─────────────────────────────────────────────────
    // Vuelve a pedir los datos al servicio. Sirve para un WMS/WMTS que se ha
    // quedado con una tesela vieja, para un GeoJSON que ha cambiado en el
    // servidor y, en general, después de tocar parámetros en la ficha.
    window.reloadLayer = function (index) {
      const capa = findLayerById(index);
      if (!capa) return;
      if (typeof capa.refresh !== 'function') {
        _avisar('Esta capa no admite recarga.');
        return;
      }
      try {
        capa.refresh();
      } catch (e) {
        try {
          capa.refresh(map);
        } catch (e2) {
          console.warn('layerSwitcher: no se pudo recargar la capa', e2);
          _avisar('No se ha podido recargar la capa.');
          return;
        }
      }
      renderLayerList();
    };

    // ── Aislar capa ───────────────────────────────────────────────────
    // Deja encendida solo la capa elegida y apaga el resto, guardando cómo
    // estaban para poder devolverlo. Es un interruptor: el segundo clic sobre
    // la capa aislada deshace el aislamiento.
    //
    // Se apagan las capas, no los grupos: apagar un grupo entero se lleva por
    // delante las hijas que luego haya que devolver una a una, y el estado
    // previo se vuelve ambiguo. A los grupos que CONTIENEN la capa sí se les
    // enciende el ojo, porque si no la capa aislada seguiría sin verse.
    window.isolateLayer = function (index) {
      const capa = findLayerById(index);
      if (!capa || !map) return;

      // Segundo clic sobre la capa aislada: se devuelve la visibilidad previa.
      if (self._aislada && String(self._aislada.index) === String(index)) {
        _desaislar();
        renderLayerList();
        return;
      }
      // Si había otra aislada, primero se deshace: no se encadenan estados.
      if (self._aislada) _desaislar();

      const previo = [];
      const guardar = (c) => {
        const ident = self._identificadorDe(c);
        if (!ident) return;
        let visible = true;
        try { if (typeof c.isVisible === 'function') visible = !!c.isVisible(); } catch (e) { /* sin visibilidad */ }
        previo.push({ ident: ident, visible: visible });
      };

      // Grupos que la contienen: se guardan y se encienden después.
      const padres = [];
      let padre = findParentGroup(capa);
      while (padre && padres.indexOf(padre) < 0) {
        padres.push(padre);
        padre = findParentGroup(padre);
      }
      padres.forEach(guardar);

      self._capasConEstado(map).forEach((c) => {
        if (!c || c === capa) return;
        if (c.isBase === true || c.displayInLayerSwitcher === false) return;
        guardar(c);
        try { if (typeof c.setVisible === 'function') c.setVisible(false); } catch (e) { /* nada */ }
      });

      padres.forEach((g) => {
        try { if (typeof g.setVisible === 'function') g.setVisible(true); } catch (e) { /* nada */ }
      });
      try { if (typeof capa.setVisible === 'function') capa.setVisible(true); } catch (e) { /* nada */ }

      self._aislada = { index: index, ident: self._identificadorDe(capa), previo: previo };
      renderLayerList();
    };

    /** Devuelve la visibilidad que había antes de aislar. */
    function _desaislar() {
      const estado = self._aislada;
      self._aislada = null;
      if (!estado) return;
      (estado.previo || []).forEach((p) => {
        if (!p || !p.ident) return;
        const c = self._findLayerByLegendInMap(map, p.ident);
        if (!c || typeof c.setVisible !== 'function') return;
        try { c.setVisible(!!p.visible); } catch (e) { /* nada */ }
      });
    }

    // ── Copiar la URL y el código de la capa ──────────────────────────
    // Estas dos viven en la ventana de información (la hoja de la tabla de
    // atributos / estadísticas) y no en el desplegable de la fila: allí es
    // donde se mira cómo está hecha la capa, y el botón no se pierde entre
    // los demás.
    window.copyLayerUrl = function (index, boton) {
      const capa = findLayerById(index);
      if (!capa) return;
      const url = _urlDeCapa(capa);
      if (!url) {
        _confirmarEnBoton(boton, 'Sin URL', false);
        _avisar('Esta capa no tiene URL: sus datos van dentro de la propia capa.');
        return;
      }
      _copiarTexto(url).then(function (ok) {
        _confirmarEnBoton(boton, ok ? 'Copiada' : 'Error', ok);
      });
    };

    window.copyLayerCode = function (index, boton) {
      const capa = findLayerById(index);
      if (!capa) return;
      _copiarTexto(_codigoDeCapa(capa)).then(function (ok) {
        _confirmarEnBoton(boton, ok ? 'Copiado' : 'Error', ok);
      });
    };

    /** URL del servicio de la capa, o null si sus datos van dentro. */
    function _urlDeCapa(capa) {
      if (!capa) return null;
      try {
        if (capa.url !== undefined && capa.url !== null && String(capa.url).trim() !== '') {
          return String(capa.url);
        }
      } catch (e) { /* capa sin url */ }
      const cp = capa.constructorParameters || {};
      const params = cp.userParameters || cp.parameters || {};
      if (params && params.url) return String(params.url);
      return null;
    }

    // Tamaño máximo de una fuente en línea que se copia dentro del código.
    // Por encima se sustituye por un aviso: un GeoJSON de miles de objetos
    // pegado en el portapapeles no ayuda a nadie.
    const LIMITE_FUENTE_CODIGO = 40000;

    /**
     * Reconstruye el código de creación de la capa a partir de los parámetros
     * que la API guardó al construirla (`constructorParameters`).
     *
     * OJO con las claves: las capas de servicio (WMS, WMTS, TMS, GeoTIFF...)
     * los guardan en `userParameters` y las de datos (GeoJSON, MVT...) en
     * `parameters` (medido). Se leen las dos, como en la ficha.
     *
     * @param {Object} capa
     * @returns {string} Código listo para pegar en el `mapa.js` del visualizador.
     */
    function _codigoDeCapa(capa) {
      const tipo = String(capa.type || 'Layer');
      const cp = capa.constructorParameters || {};
      const params = cp.userParameters || cp.parameters || {};
      const opciones = cp.options || {};
      const vendor = cp.vendorOptions || {};
      const notas = [];

      const limpios = _parametrosParaCodigo(params, notas);
      const partes = [_jsObjeto(limpios)];
      const opcionesLimpias = _parametrosParaCodigo(opciones, notas);
      if (Object.keys(opcionesLimpias).length) partes.push(_jsObjeto(opcionesLimpias));
      const vendorLimpio = _parametrosParaCodigo(vendor, notas);
      if (Object.keys(vendorLimpio).length) partes.push(_jsObjeto(vendorLimpio));

      if (typeof M !== 'undefined' && M.layer && typeof M.layer[tipo] !== 'function') {
        notas.unshift('La API no expone M.layer.' + tipo + ': ajusta la clase del constructor.');
      }

      const lineas = [
        'const capa = new M.layer.' + tipo + '(' + partes.join(', ') + ');',
        'mapajs.addLayers([capa]);',
      ];
      if (notas.length) {
        lineas.push('');
        notas.forEach((n) => lineas.push('// ' + n));
      }
      return lineas.join('\n');
    }

    /**
     * Copia los parámetros quitando lo que no se puede escribir como código:
     * funciones y fuentes en línea demasiado grandes.
     * @param {Object} obj
     * @param {Array<string>} notas Se rellena con lo que se ha omitido.
     * @returns {Object}
     */
    function _parametrosParaCodigo(obj, notas) {
      const salida = {};
      if (!obj || typeof obj !== 'object') return salida;
      Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (v === undefined) return;
        if (typeof v === 'function') {
          notas.push('El parámetro "' + k + '" era una función y se ha omitido.');
          return;
        }
        if (k === 'source' && v && typeof v === 'object') {
          let texto = '';
          try { texto = JSON.stringify(v); } catch (e) { texto = ''; }
          if (texto.length > LIMITE_FUENTE_CODIGO) {
            salida[k] = null;
            const cuantos = (v.features && v.features.length) ? v.features.length : '?';
            notas.push('La fuente va en línea (' + cuantos + ' objetos) y se ha omitido por tamaño: pon ahí tu URL o tu objeto GeoJSON.');
          } else {
            salida[k] = v;
          }
          return;
        }
        salida[k] = v;
      });
      return salida;
    }

    /**
     * Objeto a literal JavaScript con sangría. `JSON.stringify` vale tal cual
     * para los valores que guarda la API (texto, número, booleano, null,
     * objeto, array); las referencias circulares se marcan en vez de romper.
     */
    function _jsObjeto(obj) {
      try {
        const visto = new WeakSet();
        return JSON.stringify(obj, function (k, v) {
          if (typeof v === 'object' && v !== null) {
            if (visto.has(v)) return '[circular]';
            visto.add(v);
          }
          if (typeof v === 'function') return undefined;
          return v;
        }, 2);
      } catch (e) {
        return '{}';
      }
    }

    /**
     * Copia texto al portapapeles. `navigator.clipboard` solo existe en
     * contextos seguros (https o localhost); en el resto se cae al
     * `textarea` + `execCommand`, que los navegadores siguen aceptando.
     * @param {string} texto
     * @returns {Promise<boolean>} true si se ha copiado.
     */
    function _copiarTexto(texto) {
      return new Promise(function (resolver) {
        const porFallback = function () {
          let ok = false;
          try {
            const ta = document.createElement('textarea');
            ta.value = texto;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand('copy');
            document.body.removeChild(ta);
          } catch (e) {
            ok = false;
          }
          resolver(ok);
        };
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(texto).then(function () { resolver(true); }, porFallback);
        } else {
          porFallback();
        }
      });
    }

    /** Rótulo temporal en el botón que ha copiado ("Copiado", "Error"...). */
    function _confirmarEnBoton(boton, texto, ok) {
      if (!boton) return;
      if (!boton.dataset.rotuloOriginal) boton.dataset.rotuloOriginal = boton.textContent;
      boton.textContent = texto;
      boton.classList.toggle('ls-copiado', ok === true);
      boton.classList.toggle('ls-copiado-error', ok === false);
      setTimeout(function () {
        boton.textContent = boton.dataset.rotuloOriginal;
        boton.classList.remove('ls-copiado');
        boton.classList.remove('ls-copiado-error');
      }, 1400);
    }

    // ── Zoom a la capa ────────────────────────────────────────────────
    // Encuadra la vista sobre lo que ocupa la capa. Funciona con grupos
    // tambien: se unen las extensiones de todas sus hijas, con el grupo
    // dentro y sin él.
    //
    // DE DONDE SALE LA EXTENSIÓN: primero de `layer.getMaxExtent()`, y si esa
    // llamada no devuelve nada utilizable se recurre a la rejilla de la fuente de
    // la capa (_extensionDeLaRejilla), que es donde la guardan los rasteres de
    // verdad. Sin ese segundo camino, un GeoTIFF se queda sin extensión y el
    // botón no hace nada (medido: con esta API `getMaxExtent()` devuelve null en
    // las capas GeoTIFF, y si se le pasa una extensión a mano hasta revienta con
    // "Cannot read properties of null (reading '0')").
    //
    // OJO ENCIMA, `getMaxExtent()` devuelve EL MUNDO ENTERO cuando la capa no tiene
    // extensión propia, que es lo que pasa con las TMS y con las de terreno (medido:
    // [-20037508.34, ...] en EPSG:3857 y [-180, -90, 180, 90] en Cesium). Si se
    // tomara tal cual, el botón llevaría siempre al planeta entero, así que
    // _esMundoEntero() lo descarta y se avisa en vez de hacer eso.
    window.zoomToLayer = function (index) {
      const capa = findLayerById(index);
      if (!capa || !map) return;
      // Una capa raster tarda un poco en tener la rejilla de su fuente (medido:
      // ~1,1 s, lo que tarda en leerse la cabecera del GeoTIFF), así que antes de
      // decir que no hay a dónde ir se insiste un par de veces.
      _conExtension(capa, function (ext) {
        if (!ext) {
          _avisar('Esta capa no tiene una extensión conocida, así que no hay a dónde ir.');
          return;
        }
        _irALaExtension(ext);
      });
    };

    /**
     * Calcula la extensión de una capa y se la pasa a `hecho`, reintentando
     * mientras no aparezca.
     *
     * El margen es corto en el caso normal, porque casi todo o llega ya o no
     * llega nunca, y largo solo mientras la capa siga cargándose de verdad: un
     * GeoTIFF en 3D se pinta en 9,4 s y hay que aguantar hasta entonces.
     *
     * @param {Object} capa
     * @param {Function} hecho Recibe la extensión o null.
     * @param {number} [intento]
     */
    function _conExtension(capa, hecho, intento) {
      const n = intento || 0;
      // Una capa MVT se mira ANTES que `getMaxExtent()`: en estas capas esa
      // llamada devuelve la caja de las teselas YA cargadas (medido: la del
      // viewport), asi que "zoom a la capa" se quedaba donde estaba. La
      // cobertura se busca en el TileJSON del servicio y, si no hay documento,
      // se encuadra el mundo entero (ver _extensionMVT).
      if (n === 0 && _tieneMVT(capa)) {
        _extensionMVT(capa, function (extMvt) {
          hecho(extMvt || _extensionMundo() || null);
        });
        return;
      }
      if (n === 0 && _tieneGeoParquet(capa)) {
        _extensionGeoParquet(capa, function (extGp) {
          if (_esExtension(extGp)) { hecho(extGp); return; }
          _conExtension(capa, hecho, 1);
        });
        return;
      }      const ext = _extensionUtil(capa);
      if (ext) { hecho(ext); return; }
      // Un WMS no lleva la extension en el cliente: hay que preguntarsela al
      // servicio (capacidades y, si el bbox que declara no sirve, lo que pinta
      // de verdad). Se hace una sola vez por capa; la respuesta queda cacheada.
      if (n === 0 && _tieneWMS(capa)) {
        _extensionWMS(capa, function (extWms) {
          if (extWms) { hecho(extWms); return; }
          _conExtension(capa, hecho, 1);
        });
        return;
      }
      // Una capa MapLibre (teselas vectoriales) tampoco lleva la extensión en
      // el cliente: su estilo no suele declararla y `getMaxExtent()` devuelve
      // el mundo (en 3D la API ni siquiera admite maxExtent). Se busca en el
      // metadata.json del servicio y, si no, en el estilo y en las teselas que
      // existen (ver _extensionMapLibre).
      if (n === 0 && _tieneMapLibre(capa)) {
        _extensionMapLibre(capa, function (extMl) {
          if (extMl) { hecho(extMl); return; }
          _conExtension(capa, hecho, 1);
        });
        return;
      }
      const maxIntentos = _capaCargando(capa) ? 22 : n;
      if (n >= maxIntentos) { hecho(null); return; }
      setTimeout(function () { _conExtension(capa, hecho, n + 1); }, (n < 4) ? 600 : 900);
    }

    /**
     * Mueve la vista hasta la extensión, por la vía que corresponda a la
     * implementación que esté cargada.
     * @param {Array<number>} ext [x0, y0, x1, y1].
     */
    function _irALaExtension(ext) {
      const impl = map.getMapImpl ? map.getMapImpl() : null;
      // El impl de Cesium trae `scene` y no `getView()`: es lo que distingue una
      // implementacion de otra sin preguntar por la version de la API.
      const escena = (impl && impl.scene) ? impl.scene : null;
      const vista = (impl && typeof impl.getView === 'function') ? impl.getView() : null;

      if (escena && escena.camera) {
        _irAExtentEn3D(ext, escena);
      } else if (vista && typeof vista.fit === 'function') {
        try { vista.fit(ext, { padding: [48, 48, 48, 48], maxZoom: 17, duration: 350 }); }
        catch (e) { _avisar('No se ha podido encuadrar la capa.'); }
      } else if (typeof map.setBbox === 'function') {
        // Reserva: sin vista de OpenLayers a la que preguntarle.
        try { map.setBbox(ext); }
        catch (e) { _avisar('No se ha podido encuadrar la capa.'); }
      }
    };

    /**
     * ¿La extensión que devuelve la capa es de relleno (el mundo entero)?
     * @param {Array<number>} ext [x0, y0, x1, y1].
     * @returns {boolean}
     */
    function _esMundoEntero(ext) {
      // EPSG:3857. OJO: la y del mundo no llega a ±20037508,34, se queda en la
      // latitud máxima de Web Mercator (±19971868,88), que es lo que devuelve
      // la API. Con el semieje mayor en las dos componentes el mundo de la API
      // no se detectaba y el zoom se iba al planeta entero.
      const MUNDO_X = 20037508.34;
      const MUNDO_Y = 19971868.88;
      if (Math.abs(ext[0]) >= MUNDO_X * 0.999 && Math.abs(ext[2]) >= MUNDO_X * 0.999 &&
          Math.abs(ext[1]) >= MUNDO_Y * 0.999 && Math.abs(ext[3]) >= MUNDO_Y * 0.999) return true;
      // En grados, como devuelve Cesium. OJO: el test solo vale si la caja
      // entera cabe en lon/lat; si no, una caja en 3857 que cruza el meridiano
      // (España sin ir más lejos) se tomaría por el mundo entero. Medido con la
      // caja real de las estaciones sísmicas: [-7,0 M, -9,4 M, 0,5 M, 5,5 M].
      const enGrados = ext[0] >= -180 && ext[2] <= 180 && ext[1] >= -90 && ext[3] <= 90;
      return enGrados && ext[0] <= -179.9 && ext[2] >= 179.9 &&
        ext[1] <= -89.9 && ext[3] >= 89.9;
    }

    /**
     * Extensión real de una capa o de un grupo, en EPSG:3857.
     *
     * Para un grupo se unen las de todas sus hijas, y se ignoran las que no
     * traen extensión: si solo una de las diez tiene datos, el encuadre tiene que
     * ser el de esa, no el mundo entero de las otras nueve.
     *
     * @param {Object} capa
     * @returns {Array<number>|null} [x0, y0, x1, y1] o null si no hay extensión.
     */
    function _extensionUtil(capa) {
      const propias = [];
      const visitar = (c) => {
        // Primero lo que dice la API, y si no hay nada, la rejilla de la fuente
        // (2D) o la caja que pinta el lector (3D).
        let ext = null;
        try { ext = c.getMaxExtent(); } catch (e) { ext = null; }
        if (!(_esExtension(ext))) ext = _extensionDeLaRejilla(c);
        if (!(_esExtension(ext))) ext = _extensionDeLaCaja(c);
        if (_esExtension(ext)) propias.push(ext.slice(0, 4).map(Number));
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        hijas.slice().forEach(visitar);
      };
      visitar(capa);
      if (!propias.length) return null;

      return propias.reduce(function (acc, e) {
        return [
          Math.min(acc[0], e[0]), Math.min(acc[1], e[1]),
          Math.max(acc[2], e[2]), Math.max(acc[3], e[3]),
        ];
      }, [Infinity, Infinity, -Infinity, -Infinity]);
    }

    /**
     * ¿Es una extensión utilizable (creciente, finita y no el mundo entero de relleno)?
     * @param {*} ext
     * @returns {boolean}
     */
    function _esExtension(ext) {
      if (!Array.isArray(ext) || ext.length < 4) return false;
      const n = ext.slice(0, 4).map(Number);
      return n.every(isFinite) && n[0] < n[2] && n[1] < n[3] && !_esMundoEntero(n);
    }

    // ── Extensión de una capa WMS ─────────────────────────────────────
    // Un WMS no trae la extensión en el cliente: el bbox viaja en las
    // capacidades del servicio. La API ya lo intenta y lo deja en
    // `getMaxExtent(false)`, pero hay servicios que declaran el mundo entero
    // en todas sus capas (medido: el WMS de volcanología del IGN) y entonces
    // ese dato no sirve para encuadrar nada.
    //
    // De dónde sale la extensión, por orden:
    //   1. `getMaxExtent(false)`, que es el bbox que la API leyó del servicio.
    //   2. Las capacidades, leídas aquí: BoundingBox en EPSG:3857 o, si no,
    //      EX_GeographicBoundingBox reproyectado.
    //   3. Lo que la capa pinta de verdad: un GetMap transparente del mundo,
    //      se leen en un canvas los píxeles opacos y se encuadra su caja. Es
    //      lo único que funciona cuando el servicio miente en el bbox. Si a
    //      escala mundial no pinta (hay capas con reglas de escala), se repite
    //      la medición sobre la vista actual.
    //
    // Las capacidades se cachean por URL y la sonda por capa, así que el
    // trabajo se hace una vez aunque se pulse el botón varias veces.

    const _cacheCapacidadesWMS = new Map();
    const _cacheSondaWMS = new Map();

    /**
     * ¿La capa, o alguna de sus hijas, es un WMS?
     * @param {Object} capa
     * @returns {boolean}
     */
    function _tieneWMS(capa) {
      let encontrado = false;
      const visitar = function (c) {
        if (encontrado || !c) return;
        if (_esCapaWMS(c)) { encontrado = true; return; }
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
      };
      visitar(capa);
      return encontrado;
    }

    /**
     * ¿Es una capa WMS de la API? Se comprueba por instancia y, como reserva,
     * por las señales que solo tiene un WMS (url, name y getCapabilities).
     * @param {Object} c
     * @returns {boolean}
     */
    function _esCapaWMS(c) {
      try {
        if (window.IDEE && IDEE.layer && IDEE.layer.WMS && c instanceof IDEE.layer.WMS) return true;
      } catch (e) { /* ignorar */ }
      return Boolean(c && typeof c.url === 'string' && typeof c.name === 'string' &&
        typeof c.getCapabilities === 'function');
    }

    /**
     * Extensión de una capa WMS (o de un grupo con WMS dentro), en EPSG:3857.
     * @param {Object} capa
     * @param {Function} hecho Recibe la extensión o null.
     */
    function _extensionWMS(capa, hecho) {
      const pendientes = [];
      const visitar = function (c) {
        if (_esCapaWMS(c)) {
          let propio = null;
          try { propio = c.getMaxExtent(false); } catch (e) { propio = null; }
          pendientes.push(_esExtension(propio) ? Promise.resolve(propio.slice(0, 4).map(Number)) : _bboxDeCapaWMS(c));
          return;
        }
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
      };
      visitar(capa);
      if (!pendientes.length) { hecho(null); return; }

      Promise.all(pendientes).then(function (lista) {
        const validas = lista.filter(_esExtension);
        hecho(validas.length ? _unionExtensiones(validas) : null);
      }).catch(function () { hecho(null); });
    }

    /**
     * Extensión de una capa WMS: capacidades primero y, si el bbox no vale,
     * lo que la capa pinta.
     * @param {Object} capa
     * @returns {Promise<Array<number>|null>}
     */
    function _bboxDeCapaWMS(capa) {
      return _bboxCapacidadesWMS(capa.url).then(function (porCapa) {
        const bb = porCapa ? porCapa[capa.name] : null;
        if (_esExtension(bb)) return bb;
        return _bboxSondaWMS(capa.url, capa.name);
      }).catch(function () { return null; });
    }

    /**
     * Capacidades del servicio ya parseadas (bbox y estilos por capa). Se pide
     * UNA sola vez por URL: todas las capas del mismo servicio comparten la
     * misma promesa, en lugar de lanzar un GetCapabilities por cada consulta.
     * @param {string} url URL del servicio.
     * @returns {Promise<{ bbox: Object, estilos: Object }|null>}
     */
    function _capacidadesWMS(url) {
      if (!_cacheCapacidadesWMS.has(url)) {
        _cacheCapacidadesWMS.set(url, _pedirCapacidadesWMS(url).catch(function () { return null; }));
      }
      return _cacheCapacidadesWMS.get(url);
    }

    /**
     * BBox de cada capa del servicio según sus capacidades.
     * @param {string} url URL del servicio.
     * @returns {Promise<Object|null>} { nombreCapa: [x0, y0, x1, y1] }
     */
    function _bboxCapacidadesWMS(url) {
      return _capacidadesWMS(url).then(function (res) {
        return res ? res.bbox : null;
      });
    }

    /**
     * Estilos declarados de cada capa del servicio según sus capacidades.
     * @param {string} url URL del servicio.
     * @returns {Promise<Object|null>} { nombreCapa: [{ id, name }, ...] }
     */
    function _estilosCapacidadesWMS(url) {
      return _capacidadesWMS(url).then(function (res) {
        return res ? res.estilos : null;
      });
    }

    /**
     * Pide y parsea el GetCapabilities del servicio.
     * @param {string} url
     * @returns {Promise<{ bbox: Object, estilos: Object }>}
     */
    function _pedirCapacidadesWMS(url) {
      const destino = _urlWMS(url, {
        service: 'WMS',
        request: 'GetCapabilities',
        version: '1.3.0',
      });
      return fetch(destino, { credentials: 'omit' })
        .then(function (respuesta) { return respuesta.text(); })
        .then(function (texto) {
          const doc = new DOMParser().parseFromString(texto, 'text/xml');
          const capas = doc.getElementsByTagNameNS('*', 'Layer');
          const salidaBbox = {};
          const salidaEstilos = {};
          for (let i = 0; i < capas.length; i++) {
            const nombre = _textoHijoWMS(capas[i], 'Name');
            if (!nombre) continue;
            salidaBbox[nombre] = _bboxDeNodoWMS(capas[i]);

            // Estilos asociados al nodo Layer
            const hijos = capas[i].childNodes || [];
            const estilosNodo = [];
            for (let j = 0; j < hijos.length; j++) {
              const h = hijos[j];
              if (h.nodeType === 1 && (h.localName || h.nodeName) === 'Style') {
                const sName = _textoHijoWMS(h, 'Name');
                const sTitle = _textoHijoWMS(h, 'Title') || sName;
                if (sName) estilosNodo.push({ id: sName, name: sTitle || sName });
              }
            }
            if (estilosNodo.length > 0) {
              salidaEstilos[nombre] = estilosNodo;
            }
          }
          return { bbox: salidaBbox, estilos: salidaEstilos };
        });
    }

    /**
     * Texto del primer hijo directo con ese nombre local.
     * @param {Node} nodo
     * @param {string} nombreLocal
     * @returns {string}
     */
    function _textoHijoWMS(nodo, nombreLocal) {
      const hijo = _hijoDirectoWMS(nodo, nombreLocal);
      return hijo ? String(hijo.textContent || '').trim() : '';
    }

    /**
     * Primer hijo directo con ese nombre local (no baja a nietos).
     * @param {Node} nodo
     * @param {string} nombreLocal
     * @returns {Node|null}
     */
    function _hijoDirectoWMS(nodo, nombreLocal) {
      const hijos = (nodo && nodo.childNodes) ? nodo.childNodes : [];
      for (let i = 0; i < hijos.length; i++) {
        const h = hijos[i];
        if (h.nodeType === 1 && (h.localName || h.nodeName) === nombreLocal) return h;
      }
      return null;
    }

    /**
     * BBox de un nodo Layer de las capacidades, en EPSG:3857.
     * @param {Node} nodo
     * @returns {Array<number>|null}
     */
    function _bboxDeNodoWMS(nodo) {
      // BoundingBox en 3857 (o 900913, su alias). Es el dato directo.
      const cajas = (nodo && nodo.childNodes) ? nodo.childNodes : [];
      for (let i = 0; i < cajas.length; i++) {
        const h = cajas[i];
        if (h.nodeType !== 1 || (h.localName || h.nodeName) !== 'BoundingBox') continue;
        const crs = (h.getAttribute('CRS') || h.getAttribute('SRS') || '').toUpperCase();
        if (crs === 'EPSG:3857' || crs === 'EPSG:900913') {
          const bb = ['minx', 'miny', 'maxx', 'maxy'].map(function (a) { return Number(h.getAttribute(a)); });
          if (_esExtension(bb)) return bb;
        }
      }
      // Si no, la caja geográfica (lon/lat) que todo WMS 1.3.0 declara.
      const geo = _hijoDirectoWMS(nodo, 'EX_GeographicBoundingBox');
      if (geo) {
        const oeste = Number(_textoHijoWMS(geo, 'westBoundLongitude'));
        const este = Number(_textoHijoWMS(geo, 'eastBoundLongitude'));
        const sur = Number(_textoHijoWMS(geo, 'southBoundLatitude'));
        const norte = Number(_textoHijoWMS(geo, 'northBoundLatitude'));
        const a = _lonLatA3857(oeste, sur);
        const b = _lonLatA3857(este, norte);
        const bb = [a[0], a[1], b[0], b[1]];
        if (_esExtension(bb)) return bb;
      }
      return null;
    }

    /**
     * Pasa lon/lat (EPSG:4326) a EPSG:3857 sin depender de la API.
     * @param {number} lon
     * @param {number} lat
     * @returns {Array<number>} [x, y]
     */
    function _lonLatA3857(lon, lat) {
      const R = 6378137;
      const x = (lon * Math.PI * R) / 180;
      const y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * R;
      return [x, y];
    }

    /**
     * Extensión real de una capa WMS midiendo lo que pinta. Cacheada por capa.
     * @param {string} url
     * @param {string} nombre
     * @returns {Promise<Array<number>|null>}
     */
    function _bboxSondaWMS(url, nombre) {
      const clave = url + '|' + nombre;
      if (!_cacheSondaWMS.has(clave)) {
        _cacheSondaWMS.set(clave, _medirPintadoWMS(url, nombre).catch(function () { return null; }));
      }
      return _cacheSondaWMS.get(clave);
    }

    /**
     * Mide la caja de lo pintado. Primero a escala mundial; si la capa no pinta
     * ahí (muchos servicios las esconden por escala, y este es uno de ellos),
     * se repite sobre la vista actual, que es la escala a la que se está viendo.
     * @param {string} url
     * @param {string} nombre
     * @returns {Promise<Array<number>|null>}
     */
    function _medirPintadoWMS(url, nombre) {
      const MUNDO = 20037508.34;
      const PX_MUNDO = (2 * MUNDO) / 512;
      return _cajaPintadaWMS(url, nombre, [-MUNDO, -MUNDO, MUNDO, MUNDO], 512).then(function (caja) {
        // Un píxel suelto no es una extensión: el servicio no está pintando la
        // capa a esta escala, solo una marca o un símbolo arrastrado.
        const despreciable = caja &&
          (caja[2] - caja[0]) <= 2 * PX_MUNDO && (caja[3] - caja[1]) <= 2 * PX_MUNDO;
        if (caja && !despreciable) return _refinarWMS(url, nombre, caja);
        const vista = _bboxVistaWMS();
        if (!vista) return caja ? _refinarWMS(url, nombre, caja) : null;
        return _cajaPintadaWMS(url, nombre, vista, 512).then(function (cajaVista) {
          if (cajaVista) return cajaVista;
          return caja ? _refinarWMS(url, nombre, caja) : null;
        });
      });
    }

    /**
     * Repite dos veces la medición sobre la caja encontrada, con un margen,
     * para pasar de la precisión de la imagen mundial a la del dato.
     * @param {string} url
     * @param {string} nombre
     * @param {Array<number>} caja
     * @returns {Promise<Array<number>>}
     */
    function _refinarWMS(url, nombre, caja) {
      let actual = caja;
      const refinar = function (pasadas) {
        if (pasadas <= 0) return Promise.resolve(actual);
        const mx = (actual[2] - actual[0]) * 0.08;
        const my = (actual[3] - actual[1]) * 0.08;
        const zona = [actual[0] - mx, actual[1] - my, actual[2] + mx, actual[3] + my];
        return _cajaPintadaWMS(url, nombre, zona, 512).then(function (siguiente) {
          if (siguiente) actual = siguiente;
          return refinar(pasadas - 1);
        });
      };
      return refinar(2);
    }

    /**
     * BBox de la vista actual en EPSG:3857, para las capas que solo pintan a
     * escala de trabajo. En 3D se toma de la cámara, porque `getBbox()` ahí
     * devuelve el mundo entero.
     * @returns {Array<number>|null}
     */
    function _bboxVistaWMS() {
      // En Cesium `getBbox()` devuelve el mundo entero, así que la vista se
      // toma de la cámara: el rectángulo que está mirando. Y de paso sirve
      // para no pedir un bbox con latitud ±90, que en 3857 se va a infinito.
      const impl = (map && typeof map.getMapImpl === 'function') ? map.getMapImpl() : null;
      const escena = (impl && impl.scene) ? impl.scene : null;
      const camara = (escena && escena.camera) ? escena.camera : null;
      if (camara && typeof camara.computeViewRectangle === 'function' && window.Cesium) {
        try {
          const r = camara.computeViewRectangle(escena.globe ? escena.globe.ellipsoid : undefined);
          if (r && window.Cesium.Math) {
            const C = window.Cesium;
            const caja = _gradosACaja3857(
              C.Math.toDegrees(r.west), C.Math.toDegrees(r.south),
              C.Math.toDegrees(r.east), C.Math.toDegrees(r.north)
            );
            if (caja) return caja;
          }
        } catch (e) { /* se intenta getBbox */ }
      }

      let bb = null;
      try { bb = map.getBbox(); } catch (e) { return null; }
      let n = null;
      if (Array.isArray(bb)) {
        n = bb.slice(0, 4).map(Number);
      } else if (bb && bb.x && bb.y) {
        // La API devuelve {x: {min, max}, y: {min, max}}.
        n = [Number(bb.x.min), Number(bb.y.min), Number(bb.x.max), Number(bb.y.max)];
      }
      if (!n || !n.every(isFinite) || n[0] >= n[2] || n[1] >= n[3]) return null;
      if (n[0] >= -180 && n[2] <= 180 && n[1] >= -90 && n[3] <= 90) {
        // Si la "vista" es el mundo entero no sirve para acotar una capa.
        if (_esMundoEntero(n)) return null;
        return _gradosACaja3857(n[0], n[1], n[2], n[3]);
      }
      return n;
    }

    /**
     * Caja lon/lat (grados) a EPSG:3857, recortando la latitud al límite de
     * Web Mercator para que no salga infinito.
     * @param {number} oeste
     * @param {number} sur
     * @param {number} este
     * @param {number} norte
     * @returns {Array<number>|null}
     */
    function _gradosACaja3857(oeste, sur, este, norte) {
      const latMax = 85.05112878;
      const s = Math.max(-latMax, Math.min(latMax, sur));
      const n = Math.max(-latMax, Math.min(latMax, norte));
      if (![oeste, s, este, n].every(isFinite) || oeste >= este || s >= n) return null;
      const a = _lonLatA3857(oeste, s);
      const b = _lonLatA3857(este, n);
      return [a[0], a[1], b[0], b[1]];
    }

    /**
     * Caja de los píxeles opacos de un GetMap.
     * @param {string} url
     * @param {string} nombre
     * @param {Array<number>} bbox BBox pedido, en EPSG:3857.
     * @param {number} lado Ancho y alto de la imagen.
     * @returns {Promise<Array<number>|null>}
     */
    function _cajaPintadaWMS(url, nombre, bbox, lado) {
      return new Promise(function (resolver) {
        if (typeof Image === 'undefined' || typeof document === 'undefined') { resolver(null); return; }
        const destino = _urlWMS(url, {
          service: 'WMS',
          version: '1.3.0',
          request: 'GetMap',
          layers: nombre,
          styles: '',
          crs: 'EPSG:3857',
          bbox: bbox.map(function (v) { return v.toFixed(2); }).join(','),
          width: lado,
          height: lado,
          format: 'image/png',
          transparent: 'true',
        });
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
          try {
            const lienzo = document.createElement('canvas');
            lienzo.width = img.naturalWidth || lado;
            lienzo.height = img.naturalHeight || lado;
            const ctx = lienzo.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
            let x0 = lienzo.width, y0 = lienzo.height, x1 = -1, y1 = -1;
            for (let y = 0; y < lienzo.height; y++) {
              for (let x = 0; x < lienzo.width; x++) {
                if (datos[(y * lienzo.width + x) * 4 + 3] > 8) {
                  if (x < x0) x0 = x;
                  if (x > x1) x1 = x;
                  if (y < y0) y0 = y;
                  if (y > y1) y1 = y;
                }
              }
            }
            if (x1 < 0 || y1 < 0) { resolver(null); return; }
            const ancho = (bbox[2] - bbox[0]) / lienzo.width;
            const alto = (bbox[3] - bbox[1]) / lienzo.height;
            const caja = [
              bbox[0] + x0 * ancho,
              bbox[3] - (y1 + 1) * alto,
              bbox[0] + (x1 + 1) * ancho,
              bbox[3] - y0 * alto,
            ];
            resolver(_esExtension(caja) ? caja : null);
          } catch (e) {
            // Canvas contaminado (servicio sin CORS): no se puede medir.
            resolver(null);
          }
        };
        img.onerror = function () { resolver(null); };
        img.src = destino;
      });
    }

    /**
     * Añade parámetros a una URL de servicio sin romper los que ya lleve.
     * @param {string} base
     * @param {Object} parametros
     * @returns {string}
     */
    function _urlWMS(base, parametros) {
      const trozos = [];
      Object.keys(parametros).forEach(function (clave) {
        trozos.push(encodeURIComponent(clave) + '=' + encodeURIComponent(parametros[clave]));
      });
      const url = String(base || '');
      let separador = '?';
      if (url.indexOf('?') !== -1) separador = /[?&]$/.test(url) ? '' : '&';
      return url + separador + trozos.join('&');
    }

    /**
     * Une varias extensiones en una.
     * @param {Array<Array<number>>} lista
     * @returns {Array<number>}
     */
    function _unionExtensiones(lista) {
      return lista.reduce(function (acc, e) {
        return [
          Math.min(acc[0], e[0]), Math.min(acc[1], e[1]),
          Math.max(acc[2], e[2]), Math.max(acc[3], e[3]),
        ];
      }, [Infinity, Infinity, -Infinity, -Infinity]);
    }

    /**
     * Extensión de una capa raster tomándola de la rejilla de su fuente, que es
     * donde la guardan los teseleros de verdad, y no en `getMaxExtent()`.
     *
     * POR QUÉ HACE FALTA: el `getMaxExtent()` de la implementación de OpenLayers
     * para un GeoTIFF toma `source.getTileGrid().getExtent()` y acto seguido lo
     * transforma desde `source.projection`, y de ahí sale un disparate en lugar de
     * una extensión. Medido con un GeoTIFF de Sentinel-2: la fuente está en
     * EPSG:32621 y su rejilla mide [699960, 190200, 809760, 300000] (110 x 110 km,
     * la tesela entera), que en EPSG:3857 es [-6145114, 191359, -6035105, 302104].
     * Con `getMaxExtent()` la capa no tenía extensión ninguna y el botón no hacía nada.
     *
     * La capa raster se llega a tener la rejilla al cabo de ~1,1 s (medido: es lo
     * que tarda en leerse la cabecera del GeoTIFF), así que antes de rendirse se
     * espera un poco y se vuelve a mirar.
     *
     * Solo tiene sentido en 2D: en Cesium no hay rejilla de OpenLayers, y de hecho
     * la implementación 3D ni siquiera sabe construir capas GeoTIFF (medido: "La
     * implementación usada no puede crear capas GeoTIFF").
     *
     * @param {Object} capa
     * @returns {Array<number>|null} [x0, y0, x1, y1] en la proyección del mapa.
     */
    function _extensionDeLaRejilla(capa) {
      let impl = null;
      try { impl = (capa && typeof capa.getImpl === 'function') ? capa.getImpl() : null; } catch (e) { return null; }
      if (!impl || !impl.olLayer || typeof impl.olLayer.getSource !== 'function') return null;
      // A partir de aquí se toca una implementación ajena, con fuentes y rejillas
      // que pueden pedir cosas raras. Nada de esto puede dejar el botón a medias,
      // así que va entero en un try y, si algo falla, no hay extensión.
      try {
        const fuente = impl.olLayer.getSource();
        if (!fuente || !fuente.tileGrid || typeof fuente.tileGrid.getExtent !== 'function') return null;
        const cruda = fuente.tileGrid.getExtent();
        const ext = Array.isArray(cruda) ? cruda : (cruda && cruda.getExtent ? cruda.getExtent() : null);
        if (!Array.isArray(ext) || ext.length < 4 || !ext.slice(0, 4).every(isFinite)) return null;

        const desde = (fuente.projection && typeof fuente.projection.getCode === 'function')
          ? fuente.projection.getCode() : 'EPSG:3857';
        const hasta = _codigoDeLaProyeccion();
        return hasta ? _reproyectar(ext.slice(0, 4), desde, hasta) : ext.slice(0, 4);
      } catch (e) {
        return null;
      }
    }

    /**
     * Extensión de una capa GeoTIFF en 3D, por la caja que pinta el lector.
     *
     * En Cesium la escena no la dibuja OpenLayers sino el `LectorGeoTIFF` de
     * ext/geotiffLayer, que abre el fichero, elige un escalón de la pirámide y lo
     * pinta en un lienzo. El sitio que ocupa es el rectángulo del propio COG, en
     * GRADOS: `[-55.2025, 1.71994, -54.21427, 2.71095]` para una tesela de
     * Sentinel-2 (medido). Lo publica la fachada 3D como `impl.getBoundingBox()`,
     * que devuelve `null` mientras el lector no ha terminado (medido: con un COG
     * de 112 MB tarda 9,4 s, contra los 1,1 s que tarda la cabecera en 2D).
     *
     * `getMaxExtent()` no sirve aquí: sin extensión de usuario devuelve la de la
     * proyección, que en Cesium es el mundo entero `[-180, -90, 180, 90]`.
     *
     * @param {Object} capa
     * @returns {Array<number>|null} [oeste, sur, este, norte] en grados.
     */
    function _extensionDeLaCaja(capa) {
      const impl = (capa && typeof capa.getImpl === 'function') ? capa.getImpl() : null;
      if (!impl || typeof impl.getBoundingBox !== 'function') return null;
      let caja = null;
      try { caja = impl.getBoundingBox(); } catch (e) { caja = null; }
      return _esExtension(caja) ? caja.slice(0, 4) : null;
    }

    /**
     * ¿La capa sigue cargándose de verdad? De esto depende cuánto se insiste
     * antes de decir que no hay a dónde ir.
     *
     * Solo se mira el GeoTIFF de 3D, que es el caso con una espera larga
     * justificada. En 2D no se pregunta a la fuente si tiene rejilla porque no
     * hay forma de distinguir "aún no ha leído la cabecera" de "es un WMS, que no
     * lleva rejilla nunca", y con esa prueba un WMS esperaría inútilmente.
     *
     * @param {Object} capa
     * @returns {boolean}
     */
    function _tieneGeoParquet(capa) {
      return !!(capa && capa._geoparquet === true);
    }

    function _extensionGeoParquet(capa, hecho) {
      if (!capa || typeof capa._prepararFuente !== 'function' || !capa._geoparquetUrl) {
        hecho(null);
        return;
      }
      capa._prepararFuente(capa._geoparquetUrl).then(function () {
        let ext = null;
        try {
          if (typeof capa._extensionParaZoom === 'function') ext = capa._extensionParaZoom();
        } catch (e) { ext = null; }
        if (ext) { hecho(ext); return; }
        if (typeof capa._extensionParaZoomCompleta === 'function') {
          capa._extensionParaZoomCompleta().then(function (ext2) {
            hecho(ext2);
          }).catch(function () { hecho(null); });
          return;
        }
        hecho(null);
      }).catch(function () { hecho(null); });
    }
    function _capaCargando(capa) {
      let impl = null;
      try { impl = (capa && typeof capa.getImpl === 'function') ? capa.getImpl() : null; } catch (e) { return false; }
      if (!impl || typeof impl.getBoundingBox !== 'function') return false;
      try { return !impl.getBoundingBox(); } catch (e) { return false; }
    }

    // ── Extensión de una capa MapLibre (teselas vectoriales) ────────────
    // Un estilo MapLibre no lleva la cobertura en el cliente: `getMaxExtent()`
    // devuelve el mundo entero y en 3D la API descarta `maxExtent` (lo avisa
    // ext/maplibreLayer). Sin extensión el botón de zoom no hacía nada: solo
    // dejaba un aviso en la consola (medido con la BTN).
    //
    // De dónde sale la extensión, por orden:
    //   1. El `metadata.json` que los servicios de teselas publican junto a su
    //      ruta de teselas: es un TileJSON con `bounds` (medido en
    //      https://vt-btn.idee.es/1.0.0/btn/metadata.json). Las teselas de la
    //      BTN cuelgan de .../btn/tile/{z}/{y}/{x}.pbf, así que el documento
    //      está en la carpeta padre y esa se prueba primero.
    //   2. El propio `style.json`: `bounds` de la fuente vectorial o del
    //      estilo (los estilos que salen de un TileJSON los arrastran).
    //   3. Si no hay ningún valor, se encuadra el MUNDO entero: el botón
    //      siempre acaba moviendo la vista y no se inventa una extensión a ojo
    //      (probarla pidiendo teselas exigía fijar un nivel de zoom, y ese
    //      nivel no lo declara el estilo).
    //
    // El resultado se cachea por capa, así que el trabajo se hace una vez
    // aunque se pulse el botón varias veces (igual que en el WMS).

    const _cacheMetadataTeselas = new Map();
    const _cacheExtensionMapLibre = new Map();

    /**
     * ¿La capa, o alguna de sus hijas, es MapLibre?
     * @param {Object} capa
     * @returns {boolean}
     */
    function _tieneMapLibre(capa) {
      let encontrado = false;
      const visitar = function (c) {
        if (encontrado || !c) return;
        if (_esCapaMapLibre(c)) { encontrado = true; return; }
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
      };
      visitar(capa);
      return encontrado;
    }

    /**
     * ¿Es una capa MapLibre con una instancia viva de MapLibre GL?
     * @param {Object} c
     * @returns {boolean}
     */
    function _esCapaMapLibre(c) {
      const t = String((c && (c.type || c._type)) || '').toLowerCase();
      if (t !== 'maplibre' && t !== 'mapbox') return false;
      return !!getMapLibreMap(c);
    }

    /**
     * Extensión de una capa MapLibre (o grupo con MapLibre dentro), en la
     * proyección que tenga el mapa ahora mismo.
     * @param {Object} capa
     * @param {Function} hecho Recibe la extensión o null.
     */
    function _extensionMapLibre(capa, hecho) {
      const capas = [];
      const visitar = function (c) {
        if (!c) return;
        if (_esCapaMapLibre(c)) { capas.push(c); return; }
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
      };
      visitar(capa);
      if (!capas.length) { hecho(null); return; }

      Promise.all(capas.map(function (c) { return _extensionDeUnaMapLibre(c); }))
        .then(function (lista) {
          // Aquí no vale `_esExtension`: la última salida posible es el mundo
          // entero, que esa prueba descarta por definición.
          const validas = lista.filter(function (e) {
            return Array.isArray(e) && e.length >= 4 && e.slice(0, 4).every(isFinite);
          });
          hecho(validas.length ? _unionExtensiones(validas) : null);
        })
        .catch(function () { hecho(null); });
    }

    /**
     * Extensión de una sola capa MapLibre, en la proyección del mapa.
     * @param {Object} capa
     * @returns {Promise<Array<number>|null>}
     */
    async function _extensionDeUnaMapLibre(capa) {
      if (!capa) return null;
      const clave = String(capa.idLayer || '') + '|' + String(capa.legend || capa.name || '');
      if (_cacheExtensionMapLibre.has(clave)) return _cacheExtensionMapLibre.get(clave);

      const ml = getMapLibreMap(capa);
      if (!ml) return null;
      // El estilo de la BTN es enorme (>300 capas) y tarda en cargarse, pero
      // para el zoom basta con que estén las fuentes: se espera poco.
      const listo = await awaitMapLibreStyle(ml, 4000);
      if (!listo) return null; // todavía sin estilo: se reintenta en otro clic

      const partes = [];
      let fuentes = [];
      try {
        const estilo = ml.getStyle();
        // Los estilos que vienen de un TileJSON dejan los bounds en el propio
        // estilo o en su metadata (no es la norma, pero está en el formato).
        const enEstilo = _extensionDeBounds(
          estilo && (estilo.bounds || (estilo.metadata && estilo.metadata.bounds))
        );
        if (enEstilo) partes.push(enEstilo);
        fuentes = _fuentesVectorialesMapLibre(estilo);
        for (const f of fuentes) {
          const b = _extensionDeBounds(f.bounds);
          if (b) partes.push(b);
        }
      } catch (e) { /* estilo a medio cargar */ }

      // El metadata.json del servicio de teselas (TileJSON con bounds).
      for (const f of fuentes) {
        const b = await _boundsDeMetadataTeselas(f);
        if (b) partes.push(b);
      }

      // Sin ningún valor no se inventa una extensión: se encuadra el mundo
      // entero, que es lo único que se puede encuadrar sin saber la cobertura,
      // y así el botón siempre hace algo.
      if (partes.length) {
        const enGrados = _unionExtensiones(partes);
        const ext = _reproyectar(enGrados, 'EPSG:4326', _codigoDeLaProyeccion());
        if (ext) { _cacheExtensionMapLibre.set(clave, ext); return ext; }
      }
      return _extensionMundo();
    }

    /**
     * Extensión del mundo entero en la proyección que tenga el mapa ahora
     * mismo, que es la de la propia proyección del visor (no se fija a mano un
     * rectángulo: en 2D son metros y en 3D grados).
     * @returns {Array<number>|null}
     */
    function _extensionMundo() {
      try {
        const p = (map && typeof map.getProjection === 'function') ? map.getProjection() : null;
        const e = (p && typeof p.getExtent === 'function') ? p.getExtent() : null;
        if (Array.isArray(e) && e.length >= 4 && e.slice(0, 4).every(isFinite)) {
          return e.slice(0, 4).map(Number);
        }
      } catch (e) { /* sin extensión de proyección */ }
      return null;
    }

    // ── Extensión de una capa MVT (teselas vectoriales) ─────────────────
    // `getMaxExtent()` no sirve aqui: en una MVT devuelve la caja de las teselas
    // YA cargadas (medido con la de unidades administrativas del IGN: la del
    // viewport en ese momento), de modo que "zoom a la capa" no movia la vista a
    // ningun sitio util. La cobertura de verdad la publica el servicio en el
    // TileJSON que acompana a las teselas (`metadata.json` con `bounds`; medido
    // en .../uadministrativa/metadata.json). Si ese documento no existe o no
    // trae bounds, se encuadra el MUNDO entero: el boton siempre hace algo y no
    // se inventa una cobertura.
    //
    // Igual que en las MapLibre, el resultado se cachea por capa.

    const _cacheExtensionMVT = new Map();

    /**
     * Capas MVT que hay dentro de una capa: ella misma o, si es un grupo, sus
     * hijas (los grupos se pueden anidar).
     * @param {Object} capa
     * @returns {Array<Object>}
     */
    function _capasMVT(capa) {
      const salida = [];
      const visitar = function (c) {
        if (!c) return;
        if (esCapaMVT(c)) { salida.push(c); return; }
        let hijas = [];
        try { hijas = c.getLayers ? c.getLayers() : []; } catch (e) { hijas = []; }
        hijas.forEach(visitar);
      };
      visitar(capa);
      return salida;
    }

    /**
     * ¿La capa, o alguna de sus hijas, es una MVT?
     * @param {Object} capa
     * @returns {boolean}
     */
    function _tieneMVT(capa) {
      return _capasMVT(capa).length > 0;
    }

    /**
     * Extensión de una capa MVT (o grupo con MVT dentro), en la proyección que
     * tenga el mapa ahora mismo.
     * @param {Object} capa
     * @param {Function} hecho Recibe la extensión o null.
     */
    function _extensionMVT(capa, hecho) {
      const capas = _capasMVT(capa);
      if (!capas.length) { hecho(null); return; }

      Promise.all(capas.map(function (c) { return _extensionDeUnaMVT(c); }))
        .then(function (lista) {
          const validas = lista.filter(function (e) {
            return Array.isArray(e) && e.length >= 4 && e.slice(0, 4).every(isFinite);
          });
          hecho(validas.length ? _unionExtensiones(validas) : null);
        })
        .catch(function () { hecho(null); });
    }

    /**
     * Extensión de una sola capa MVT: el `bounds` del TileJSON del servicio o,
     * si no hay documento, el mundo entero.
     * @param {Object} capa
     * @returns {Promise<Array<number>|null>}
     */
    async function _extensionDeUnaMVT(capa) {
      if (!capa) return null;
      const clave = 'mvt|' + String(capa.idLayer || '') + '|' + String(capa.legend || capa.name || '');
      if (_cacheExtensionMVT.has(clave)) return _cacheExtensionMVT.get(clave);

      const datos = mvtDatos(capa);
      if (!datos) return null;
      // Las teselas son lo unico que declara la capa; de ahi se deducen las
      // carpetas donde puede estar el metadata.json.
      const bounds = await _boundsDeMetadataTeselas({ tiles: [datos.url] });
      let ext = null;
      if (bounds) ext = _reproyectar(bounds, 'EPSG:4326', _codigoDeLaProyeccion());
      if (!ext) ext = _extensionMundo();
      if (ext) _cacheExtensionMVT.set(clave, ext);
      return ext;
    }

    /**
     * Fuentes vectoriales del estilo, con sus teselas y sus bounds.
     * @param {Object} estilo style.json
     * @returns {Array<Object>}
     */
    function _fuentesVectorialesMapLibre(estilo) {
      const salida = [];
      if (!estilo || !estilo.sources) return salida;
      Object.keys(estilo.sources).forEach(function (id) {
        const s = estilo.sources[id];
        if (!s || String(s.type) !== 'vector') return;
        salida.push({
          id: id,
          url: s.url || null,
          tiles: Array.isArray(s.tiles) ? s.tiles.slice() : [],
          bounds: s.bounds || (s.tileJSON && s.tileJSON.bounds) || null,
        });
      });
      return salida;
    }

    /**
     * Bounds en grados ([oeste, sur, este, norte]) a extensión utilizable.
     * @param {*} bounds
     * @returns {Array<number>|null} null si no vale o es el mundo entero.
     */
    function _extensionDeBounds(bounds) {
      if (!Array.isArray(bounds) || bounds.length < 4) return null;
      const n = bounds.slice(0, 4).map(Number);
      if (!n.every(isFinite)) return null;
      if (n[0] < -180 || n[2] > 180 || n[1] < -90 || n[3] > 90) return null;
      return _esExtension(n) ? n : null;
    }

    /**
     * Bases candidatas a partir de una plantilla de teselas,
     * `https://host/1.0.0/btn/tile/{z}/{y}/{x}.pbf` → `.../btn/` y `.../btn/tile/`.
     *
     * Se prueba primero la carpeta PADRE: el TileJSON suele estar en la raíz
     * del servicio y las teselas en una subcarpeta (medido en la BTN, que lo
     * tiene en .../btn/metadata.json y las teselas en .../btn/tile/...). Así el
     * caso normal se resuelve con una sola petición y sin errores de consola.
     * @param {string} plantilla
     * @returns {Array<string>}
     */
    function _basesDeTeselas(plantilla) {
      const bases = [];
      const limpia = String(plantilla || '').split('?')[0];
      const corte = limpia.search(/\{[xyz-]/);
      const antes = (corte > -1 ? limpia.slice(0, corte) : limpia).replace(/\/+$/, '');
      const anade = function (u) {
        const b = String(u || '').replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(b)) return;
        if (bases.indexOf(b + '/') === -1) bases.push(b + '/');
      };
      anade(antes.slice(0, antes.lastIndexOf('/')));
      anade(antes);
      return bases;
    }

    /**
     * Bounds del TileJSON que el servicio publica junto a las teselas.
     * @param {Object} fuente {url, tiles}
     * @returns {Promise<Array<number>|null>}
     */
    async function _boundsDeMetadataTeselas(fuente) {
      if (!fuente) return null;
      const urls = [];
      if (fuente.url) urls.push(fuente.url);
      (fuente.tiles || []).forEach(function (t) {
        _basesDeTeselas(t).forEach(function (b) {
          if (urls.indexOf(b + 'metadata.json') === -1) urls.push(b + 'metadata.json');
        });
      });

      for (const u of urls) {
        if (_cacheMetadataTeselas.has(u)) {
          const cacheado = _cacheMetadataTeselas.get(u);
          if (cacheado) return cacheado;
          continue;
        }
        let ext = null;
        try {
          const cuerpo = await _pedirTexto(u);
          const datos = _jsonDeVerdad(cuerpo);
          ext = datos ? _extensionDeBounds(datos.bounds) : null;
        } catch (e) { ext = null; }
        _cacheMetadataTeselas.set(u, ext);
        if (ext) return ext;
      }
      return null;
    }

    /** Código de la proyección que tiene el mapa ahora mismo. */
    function _codigoDeLaProyeccion() {
      try {
        const p = (map && typeof map.getProjection === 'function') ? map.getProjection() : null;
        return (p && p.code) ? p.code : 'EPSG:3857';
      } catch (e) {
        return 'EPSG:3857';
      }
    }

    /**
     * Reproyecta un rectángulo [x0, y0, x1, y1] de un sistema a otro.
     *
     * Está medido que `IDEE.utils.reproject` solo mira el primer par de coordenadas,
     * así que para un rectángulo hay que ir esquina por esquina (y eso es lo que
     * hace aquí); la vía de OpenLayers reproyecta el rectángulo entero de una vez
     * y da el mismo resultado, así que se prefiere si está a mano.
     *
     * @param {Array<number>} ext
     * @param {string} desde
     * @param {string} hasta
     * @returns {Array<number>|null}
     */
    function _reproyectar(ext, desde, hasta) {
      if (desde === hasta) return ext.slice(0, 4);
      const ol = window.ol && window.ol.proj;
      if (ol && typeof ol.transformExtent === 'function') {
        try {
          const r = ol.transformExtent(ext, desde, hasta);
          if (Array.isArray(r) && r.every(isFinite)) return r;
        } catch (e) { /* se intenta la otra vía */ }
      }
      const api = window.IDEE || window.M;
      if (api && api.utils && typeof api.utils.reproject === 'function') {
        try {
          const esquinas = [[ext[0], ext[1]], [ext[2], ext[1]], [ext[0], ext[3]], [ext[2], ext[3]]]
            .map((p) => api.utils.reproject(p, desde, hasta));
          const xs = esquinas.map((p) => Number(p[0]));
          const ys = esquinas.map((p) => Number(p[1]));
          const r = [Math.min.apply(null, xs), Math.min.apply(null, ys),
                     Math.max.apply(null, xs), Math.max.apply(null, ys)];
          return r.every(isFinite) ? r : null;
        } catch (e) { /* sin reproyección */ }
      }
      return null;
    }

    /**
     * Lleva la cámara de Cesium hasta la extensión (implementación 3D).
     *
     * OJO CON LAS UNIDADES: `getMaxExtent()` devuelve el bbox en las unidades de
     * la proyección que tenga el mapa AHORA. En 2D (EPSG:3857) son metros
     * proyectados y en 3D (Cesium) son GRADOS (medido: la misma capa da
     * [-412305, 4926696, ...] en 2D y [-3.7127, 40.4078, ...] en 3D). Por eso
     * aquí no se supone nada: se mira el valor, que es inequívoco porque los
     * grados no pasan de 180 y 90, y solo si son metros se reproyectan.
     *
     * @param {Array<number>} ext [x0, y0, x1, y1].
     * @param {Object} escena Escena de Cesium.
     */
    function _irAExtentEn3D(ext, escena) {
      const C = window.Cesium;
      const camara = escena && escena.camera;
      if (!C || !C.Rectangle || !camara) {
        _avisar('No se puede mover la cámara en esta implementación.');
        return;
      }
      let oeste = [ext[0], ext[1]];
      let este = [ext[2], ext[3]];

      const pareceGrados = Math.abs(ext[0]) <= 180 && Math.abs(ext[2]) <= 180 &&
                           Math.abs(ext[1]) <= 90 && Math.abs(ext[3]) <= 90;
      if (!pareceGrados) {
        const api = window.IDEE || window.M;
        if (!(api && api.utils && typeof api.utils.reproject === 'function')) {
          _avisar('No se ha podido convertir la extensión a coordenadas geográficas.');
          return;
        }
        try {
          oeste = api.utils.reproject([ext[0], ext[1]], 'EPSG:3857', 'EPSG:4326');
          este = api.utils.reproject([ext[2], ext[3]], 'EPSG:3857', 'EPSG:4326');
        } catch (e) {
          _avisar('No se ha podido convertir la extensión a coordenadas geográficas.');
          return;
        }
      }

      try {
        camara.flyTo({
          destination: C.Rectangle.fromDegrees(
            oeste[0], oeste[1], este[0], este[1]
          ),
          duration: 1.2,
        });
      } catch (e) {
        _avisar('No se ha podido encuadrar la capa.');
      }
    }

    /** Aviso corto dentro del propio selector de capas. */
    function _avisar(texto) {
      try { console.info('layerSwitcher: ' + texto); } catch (e) { /* ignorar */ }
    }

    // ── Identificador del tipo de capa ──────────────────────────────────
    // Devuelve 'vector' si la capa es vectorial (GeoJSON, WFS, OGC API
    // Features, Vector...) y 'raster' en caso contrario. API-IDEE no expone un
    // metodo unico fiable, asi que se comparan los tipos conocidos por su
    // nombre. `ogcapifeatures` faltaba: por eso la capa de OGC API Features no
    // tenia tabla de atributos (se trataba como raster).
    window.getLayerKind = function (layer) {
      let typeName = '';
      try { typeName = String(layer.type || layer._type || ''); } catch (e) { /* ignorar */ }
      if (!typeName) {
        try { typeName = String((layer.getImpl() && layer.getImpl().type) || ''); } catch (e) { /* ignorar */ }
      }
      const t = typeName.toLowerCase();
      const vectorTypes = ['geojson', 'wfs', 'vector', 'geojsonparser', 'feature', 'mvt', 'kml', 'csv', 'datoselevacion', 'mapbox', 'maplibre', 'ogcapifeatures'];
      return vectorTypes.includes(t) ? 'vector' : 'raster';
    };

    // ── Repintado de capas vectoriales en Cesium (3D) ───────────────────
    // POR QUE HACE FALTA: en la implementacion 3D las capas vectoriales con
    // coordenadas 2D (lon/lat, el caso normal) se dibujan como "primitivas de
    // suelo" (GroundPrimitive: Cesium las drapea sobre el terreno) y Cesium las
    // construye UNA sola vez: los cambios posteriores del material no se
    // reflejan. Medido con capturas del parche central de la pantalla: tras
    // setOpacity el color de la entidad ya tiene el alfa nuevo (la API SI lo
    // muta) pero los pixeles siguen con el alfa viejo, y no lo arreglan ni
    // `scene.requestRender()`, ni un ciclo `entity.show`, ni reasignar
    // `polygon.material`, ni quitar y volver a anadir el dataSource. Lo unico
    // que reconstruye las primitivas con el material actual -y por tanto hace
    // visible el cambio- es sacar las entidades del dataSource y volver a
    // meterlas (medido: alfa 1 -> [255,0,0] en el centro; alfa 0.5 -> [240,53,57]).
    //
    // El coste va con el numero de entidades, asi que se agrupan las rafagas del
    // slider (emite un `input` por pixel arrastrado) y se omite en capas
    // enormes, donde reconstruir varias veces por segundo congelaria el
    // navegador. En 2D no se hace nada: alli la API repinta por su cuenta.
    const RECONSTRUCCION_CESIO_MS = 150;
    const MAX_ENTIDADES_RECONSTRUIBLES = 5000;
    let reconstruccionCesioUltima = 0;
    let reconstruccionCesioTimer = null;
    let reconstruccionCesioCapa = null;
    let reconstruccionCesioAvisada = false;

    // Escena de Cesium, o null si estamos en 2D.
    function escenaCesio() {
      try {
        const impl = map.getMapImpl ? map.getMapImpl() : null;
        return (impl && impl.scene && impl.scene.camera) ? impl.scene : null;
      } catch (e) { return null; }
    }

    // DataSources de Cesium que contienen las entidades de una capa. Por su
    // impl y, si no hubiera, por nombre en el Viewer: los idLayer se regeneran
    // en cada reinicio del mapa (cambio 2D/3D), legend/name son estables.
    function datasourcesCesioDeCapa(layer) {
      const datasources = [];
      const anade = (ds) => { if (ds && datasources.indexOf(ds) === -1) datasources.push(ds); };
      try {
        const impl = layer.getImpl ? layer.getImpl() : null;
        if (impl) {
          if (typeof impl.getLayer === 'function') anade(impl.getLayer());
          anade(impl.cesiumLayer);
        }
      } catch (e) { /* la capa puede no tener impl todavia */ }
      try {
        const viewer = (map && typeof map.getMapImpl === 'function') ? map.getMapImpl() : null;
        const datasourcesViewer = viewer && viewer.dataSources;
        const ident = String(layer.legend || layer.name || '');
        if (datasourcesViewer && datasourcesViewer.length !== undefined && ident) {
          for (let i = 0; i < datasourcesViewer.length; i++) {
            const ds = datasourcesViewer.get(i);
            if (ds && String(ds.name || '') === ident) anade(ds);
          }
        }
      } catch (e) { /* sin Viewer (2D) */ }
      return datasources;
    }

    // Saca del dataSource y vuelve a meter las entidades de una capa: es lo que
    // obliga a Cesium a reconstruir sus primitivas con el material actual. Se
    // conservan los MISMOS objetos Entity, asi que las referencias que guarda la
    // API (facade de features, getFeatures...) siguen siendo validas.
    function reconstruirEntidadesCesio(layer) {
      if (!layer || !escenaCesio()) return;
      const datasources = datasourcesCesioDeCapa(layer);
      let total = 0;
      datasources.forEach((ds) => {
        try { total += ds.entities ? ds.entities.values.length : 0; } catch (e) { /* ignorar */ }
      });
      if (!total) return;
      if (total > MAX_ENTIDADES_RECONSTRUIBLES) {
        // Aviso unico: en 3D la opacidad de una capa tan grande no se puede
        // refrescar (reconstruirla bloquea el hilo principal).
        if (!reconstruccionCesioAvisada) {
          reconstruccionCesioAvisada = true;
          console.warn('layerSwitcher: la capa "' + (layer.legend || layer.name || '')
            + '" tiene ' + total + ' entidades; en 3D el cambio de opacidad no se refresca'
            + ' (limite ' + MAX_ENTIDADES_RECONSTRUIBLES + ').');
        }
        return;
      }
      datasources.forEach((ds) => {
        try {
          const entidades = ds.entities ? ds.entities.values.slice() : [];
          if (!entidades.length) return;
          ds.entities.removeAll();
          entidades.forEach((e) => { ds.entities.add(e); });
        } catch (e) { /* dataSource no reconstruible */ }
      });
    }

    // Igual que reconstruirEntidadesCesio, pero agrupando rafagas: durante el
    // arrastre del slider se reconstruye en cuanto se puede y despues como
    // mucho una vez por ventana, sin perder nunca el valor final.
    function reconstruirEntidadesCesioDiferido(layer) {
      if (!layer || !escenaCesio()) return;
      const ahora = Date.now();
      const transcurrido = ahora - reconstruccionCesioUltima;
      reconstruccionCesioCapa = layer;
      if (transcurrido >= RECONSTRUCCION_CESIO_MS) {
        reconstruccionCesioUltima = ahora;
        reconstruirEntidadesCesio(reconstruccionCesioCapa);
        return;
      }
      if (reconstruccionCesioTimer === null) {
        reconstruccionCesioTimer = window.setTimeout(() => {
          reconstruccionCesioTimer = null;
          reconstruccionCesioUltima = Date.now();
          reconstruirEntidadesCesio(reconstruccionCesioCapa);
        }, RECONSTRUCCION_CESIO_MS - transcurrido);
      }
    }

    // ── Slider de transparencia ─────────────────────────────────────────
    // transpPct es 0..100 (0 = opaco, 100 = totalmente transparente). La API
    // usa opacidad 0..1, asi que transladamos: opacity = 1 - transp/100.
    window.setLayerOpacity = function (index, transpPct, sliderEl) {
      const layer = findLayerById(index);
      const pct = Math.max(0, Math.min(100, Number(transpPct) || 0));
      if (layer && layer.setOpacity) {
        layer.setOpacity(1 - pct / 100);
        // En Cesium la API deja el material nuevo en la entidad pero la
        // primitiva de suelo no se reconstruye (ver reconstruirEntidadesCesio).
        reconstruirEntidadesCesioDiferido(layer);
      }
      // Actualiza solo el texto del valor y el relleno del track del slider,
      // sin re-render (re-renderizar perderia el foco mientras se arrastra).
      // El relleno representa la opacidad (100 - transparencia): 0% de
      // transparencia => relleno al 100%, 100% de transp. => vacio.
      if (sliderEl) {
        const fillPct = 100 - pct;
        sliderEl.style.background =
          `linear-gradient(to right, #0078d4 0%, #0078d4 ${fillPct}%, #d7dde7 ${fillPct}%, #d7dde7 100%)`;
        if (sliderEl.parentElement) {
          const val = sliderEl.parentElement.querySelector('.ls-option-value');
          if (val) val.textContent = pct + '%';
        }
      }
    };

    // ── Selector de estilo de capa ───────────────────────────────────────
    // Permite cambiar entre los estilos disponibles de una capa vectorial (array de
    // styles) o ráster (WMS/WMTS con varios estilos ofrecidos o configurados).
    window.setLayerStyle = function (index, styleId) {
      const layer = findLayerById(index);
      if (!layer) return;

      const info = getLayerAvailableStyles(layer);
      if (!info || !info.styles || info.styles.length === 0) return;

      const item = info.styles.find(s => String(s.id) === String(styleId)) || info.styles[Number(styleId)] || info.styles[0];
      if (!item) return;

      layer._selectedStyleIndex = info.styles.indexOf(item);
      layer._selectedStyleName = item.name;
      layer._currentStyleId = item.id;

      if (info.isVector) {
        if (typeof layer.setStyle === 'function') {
          try { layer.setStyle(item.styleObj); } catch (e) { console.warn('layerSwitcher: error en setStyle', e); }
        }
        reconstruirEntidadesCesioDiferido(layer);
        try { if (typeof layer.redraw === 'function') layer.redraw(); } catch (e) {}
        try { if (typeof layer.refresh === 'function') layer.refresh(); } catch (e) {}
      } else if (info.isWms || typeof layer.setStyles === 'function') {
        if (typeof layer.setStyles === 'function') {
          try { layer.setStyles(item.id); } catch (e) { console.warn('layerSwitcher: error en setStyles', e); }
        }
      } else if (typeof layer.setStyle === 'function') {
        try { layer.setStyle(item.styleObj || item.id); } catch (e) {}
      }

      const selectEl = document.querySelector('.ls-options-panel.open .ls-style-select');
      if (selectEl && selectEl.value !== String(item.id)) {
        selectEl.value = String(item.id);
      }
    };

    // ── Panel inferior (bottom sheet): tabla de atributos / estadisticas ──
    // En lugar de un modal centrado, se abre un panel anclado a la parte
    // baja de la pantalla que se despliega hacia arriba (a semejanza del
    // panel de opciones de comparacionVistas). Al hacer clic en una fila
    // de la tabla de atributos se localiza y resalta el feature en el mapa.
    const SHEET_OVERLAY_ID = 'ls-sheet-overlay';
    // Capa vectorial temporal usada para resaltar el feature seleccionado.
    let selLayer = null;
    // Contexto de sincronia tabla<->mapa de la tabla actualmente abierta.
    // Contiene la capa, su idLayer y los features (con su geometria) en el
    // mismo orden que las filas de la tabla. Permite que tanto el clic en una
    // fila como el clic en el mapa resuelvan el MISMO feature de forma fiable.
    let sheetCtx = null;
    // Referencia al handler de clic en el mapa mientras la tabla esta abierta.
    let mapClickHandler = null;
    // Contexto de la tabla MapLibre abierta. Sus features salen del viewport
    // (querySourceFeatures), asi que la tabla se rehace cuando el mapa se mueve.
    let mlTableCtx = null;
    let sheetMoveCleanup = null;
    let sheetMoveTimer = null;
    // Segundo pase del refresco en MapLibre: `moveend` llega antes de que las
    // teselas de la vista nueva esten cargadas (ver refreshSubLayerTable).
    let sheetMoveTimer2 = null;

    // Función para remarcar todas las filas de la tabla segun el índice activo.
    function highlightRow(idx) {
      document.querySelectorAll('.ls-attr-table tbody tr').forEach(function (tr) {
        tr.classList.toggle('ls-row-active', tr.getAttribute('data-row-idx') === String(idx));
      });
    }

    let closeSheet = function () {
      unbindMapClick();
      unbindSheetMove();
      unbindSheetReload();
      mlTableCtx = null;
      const old = document.getElementById(SHEET_OVERLAY_ID);
      if (old && old.parentElement) old.parentElement.removeChild(old);
      sheetCtx = null;
      clearHighlight();
    };
    // Expuesto para que deleteLayer pueda cerrarlo sin depender del orden.
    window.closeSheet = closeSheet;

    function openSheet(title, bodyHtml, vectorTable, selectableLayers, currentIndex) {
      const overlay = document.createElement('div');
      overlay.id = SHEET_OVERLAY_ID;
      overlay.className = 'ls-sheet-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      const panel = document.createElement('div');
      panel.className = 'ls-sheet';
      // Dropdown de capas en el header del sidenav, si se facilita la lista.
      const hasPicker = Array.isArray(selectableLayers) && selectableLayers.length > 0;
      const pickerHtml = hasPicker
        ? `<select class="ls-sheet-layer-picker" aria-label="Capa" onchange="openLayerInfo(this.value, true)">
             ${selectableLayers.map(L => `<option value="${L.idLayer}" ${String(L.idLayer) === String(currentIndex) ? 'selected' : ''}>${L.legend || L.name || 'Sin nombre'}</option>`).join('')}
           </select>`
        : '';
      // Copiar URL y código: van aquí, en la ventana de información, porque es
      // donde se mira cómo está hecha la capa y de dónde salen sus datos. Solo
      // aparecen cuando la hoja sabe de qué capa habla (`currentIndex`), que es
      // el caso de `openLayerInfo`; una hoja sin capa no tiene nada que copiar.
      let copiarHtml = '';
      if (currentIndex !== undefined && currentIndex !== null) {
        const capaHoja = findLayerById(currentIndex);
        if (capaHoja) {
          copiarHtml = `<div class="ls-sheet-copiar-grupo">
              <button type="button" class="ls-sheet-copiar" title="Copiar la URL del servicio" onclick="copyLayerUrl('${capaHoja.idLayer}', this)">URL</button>
              <button type="button" class="ls-sheet-copiar" title="Copiar el código de creación de la capa" onclick="copyLayerCode('${capaHoja.idLayer}', this)">Código</button>
            </div>`;
        }
      }
      panel.innerHTML =
        `<div class="ls-sheet__handle" title="Arrastra para cambiar la altura del panel"></div>
         <div class="ls-sheet-header">
           <div class="ls-sheet-header-left">
             ${pickerHtml}
             <span class="ls-sheet-title"></span>
           </div>
           <div class="ls-sheet-header-right">
             ${copiarHtml}
             <button type="button" class="ls-sheet-close" title="Cerrar" onclick="closeSheet()">✕</button>
           </div>
         </div>
         <div class="ls-sheet-body"></div>`;
      panel.querySelector('.ls-sheet-title').textContent = title;
      panel.querySelector('.ls-sheet-body').innerHTML = bodyHtml;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      // Se usa requestAnimationFrame para que el navegador aplique primero el
      // transform inicial (abajo) y despues la clase --open dispare la subida.
      requestAnimationFrame(() => {
        panel.classList.add('ls-sheet--open');
        // Tras la animacion, redimensiona al ultimo tamano recordado (si existe).
        if (sheetHeight) applySheetHeight(panel);
      });
      // El tirador permite agrandar/encoger el panel arrastrandolo.
      enableSheetResize(panel);
      // Si es una tabla vectorial, activa la sincronia mapa->tabla.
      if (vectorTable) bindMapClick();
      return panel;
    }

    // ── Ficha de una capa ──────────────────────────────────────────────────
    // Un modal centrado que abre con la ventana emergente de los parámetros
    // de construcción y, si la hay, la del documento del servicio.
    //
    // DE DONDE SALEN LOS PARÁMETROS: de `layer.constructorParameters`, que es
    // lo que la API guarda tal como se construyó la capa. OJO con la clave:
    // las capas de servicio (WMS, WMTS, TMS, GeoTIFF...) la llaman
    // `userParameters`, y las de datos (MVT, GeoJSON...) `parameters`
    // (medido). Por eso se leen las dos.
    window.openLayerFicha = function (index) {
      const capa = findLayerById(index);
      if (!capa) return;
      fichaVectorLayer = capa;
      const nombre = capa.legend || capa.name || 'Sin nombre';
      const cp = capa.constructorParameters || {};
      const construccion = cp.userParameters || cp.parameters || {};
      const opciones = cp.options || {};
      const vendor = cp.vendorOptions || {};
      let url = null;
      try { url = (typeof capa.url !== 'undefined' && capa.url !== null) ? capa.url : null; } catch (e) { url = null; }

      closeSheet();

      const overlay = document.createElement('div');
      overlay.className = 'ls-ficha-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', `Información de ${nombre}`);

      const panel = document.createElement('div');
      panel.className = 'ls-ficha';

      const parametrosHtml = _tablaDeParametros(construccion, opciones, vendor, url);
      const tipo = _tipoDeCapa(capa);
      const barraObjetosHtml = (typeof barraObjetos === 'function') ? barraObjetos(capa) : '';

      panel.innerHTML =
        `<div class="ls-ficha-header">
            <div class="ls-ficha-title">${_escaparHtml(nombre)}</div>
            <div class="ls-ficha-tipo">${tipo}</div>
            <button type="button" class="ls-sheet-close" title="Cerrar" onclick="cerrarFicha()">✕</button>
          </div>
          <div class="ls-ficha-body">
            <div class="ls-ficha-col">
              <div class="ls-ficha-seccion-titulo">Editar parámetros</div>
              <div class="ls-ficha-editor-wrap"></div>
              <details class="ls-ficha-detalle ls-ficha-params">
                <summary>Parámetros de construcción</summary>
                <div class="ls-ficha-params-cuerpo">${parametrosHtml}</div>
              </details>
              ${barraObjetosHtml ? `<div class="ls-ficha-seccion-titulo" style="margin-top:14px">Objetos geográficos</div><div class="ls-ficha-objetos-wrap">${barraObjetosHtml}</div>` : ''}
            </div>
            <div class="ls-ficha-col">
              <div class="ls-ficha-seccion-titulo">Documento del servicio</div>
              <div class="ls-ficha-doc">Cargando…</div>
            </div>
          </div>`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => { overlay.classList.add('ls-ficha--open'); });

      let alEscapeCerrar = null;
      const cerrar = function () {
        // Si se estaba pinchando o dibujando sobre el mapa, se sueltan los
        // manejadores antes de desmontar el modal.
        if (typeof _cancelarPickFicha === 'function') {
          try { _cancelarPickFicha(); } catch (e) { /* nada */ }
          _cancelarPickFicha = null;
        }
        if (alEscapeCerrar) {
          try { document.removeEventListener('keydown', alEscapeCerrar); } catch (e) { /* nada */ }
          alEscapeCerrar = null;
        }
        const editorAbierto = panel.querySelector('.ls-ficha-editor');
        if (editorAbierto && editorAbierto._lsEscapeEditor) {
          try { window.removeEventListener('keydown', editorAbierto._lsEscapeEditor, true); } catch (e) { /* nada */ }
          editorAbierto._lsEscapeEditor = null;
        }
        fichaVectorLayer = null;
        try { overlay.classList.remove('ls-ficha--open'); } catch (e) { /* nada */ }
        setTimeout(function () {
          try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) { /* nada */ }
        }, 260);
      };
      // Su propio global, en el mismo estilo que el resto del plugin: el cierre
      // del panel inferior es `closeSheet` y este no puede tocarlo.
      window.cerrarFicha = cerrar;
      // Clic fuera de la caja y Escape: las dos cierran.
      overlay.addEventListener('mousedown', function (ev) { if (ev.target === overlay) cerrar(); });
      alEscapeCerrar = function (ev) {
        if (ev.key !== 'Escape') return;
        cerrar();
      };
      document.addEventListener('keydown', alEscapeCerrar);

      // El editor de parámetros se monta con la capa viva: al aplicar cambios
      // que obligan a reconstruirla, la ficha se queda abierta apuntando a la
      // capa nueva.
      _montarEditorFicha(panel.querySelector('.ls-ficha-editor-wrap'), capa, overlay, function (nueva) {
        fichaVectorLayer = nueva;
        // La cabecera también apunta a la capa nueva: leyenda y tipo pueden
        // haber cambiado en el propio editor.
        const titulo = panel.querySelector('.ls-ficha-title');
        if (titulo) titulo.textContent = nueva.legend || nueva.name || 'Sin nombre';
        const tipo = panel.querySelector('.ls-ficha-tipo');
        if (tipo) tipo.textContent = _tipoDeCapa(nueva);
        // Si se ha cambiado la URL o el nombre del servicio, el documento que
        // se está enseñando ya no es el suyo: se vuelve a pedir.
        const doc = panel.querySelector('.ls-ficha-doc');
        if (doc) {
          const urlNueva = (typeof nueva.url !== 'undefined' && nueva.url) ? nueva.url : null;
          _rellenarDocumento(doc, nueva, urlNueva).catch(function () {
            doc.innerHTML = '<p class="ls-ficha-aviso">No se pudo leer el documento del servicio.</p>';
          });
        }
      });

      // El documento se trae aparte: puede tardar, y si no hay se dice.
      _rellenarDocumento(panel.querySelector('.ls-ficha-doc'), capa, url).catch(function (e) {
        panel.querySelector('.ls-ficha-doc').innerHTML =
          '<p class="ls-ficha-aviso">No se pudo leer el documento del servicio.</p>';
        console.warn('layerSwitcher: ficha, documento', e);
      });
    };

    /**
     * Texto seguro (y escapado) de un valor para la tabla.
     *
     * Un LayerGroup guarda sus capas en `constructorParameters`, y esas capas
     * apuntan al mapa: `JSON.stringify` revienta por estructura circular. En
     * ese caso se resume el objeto en vez de romper la ficha.
     */
    function _textoDeValor(valor) {
      if (valor === null) return 'null';
      if (valor === undefined) return '—';
      if (typeof valor !== 'object') return _escaparHtml(String(valor));
      try {
        return _escaparHtml(JSON.stringify(valor));
      } catch (e) {
        try {
          if (Array.isArray(valor)) return _escaparHtml('[' + valor.length + ' elementos]');
          const claves = Object.keys(valor);
          return _escaparHtml('{' + claves.slice(0, 8).join(', ') + (claves.length > 8 ? ', …' : '') + '}');
        } catch (e2) {
          return '[objeto]';
        }
      }
    }

    /** Tabla de los parámetros de construcción de la capa. */
    function _tablaDeParametros(construccion, opciones, vendor, url) {
      const filas = [];
      const todo = Object.assign({}, construccion, { 'url (resuelto)': url },
        Object.keys(opciones).length ? { 'options': opciones } : {},
        Object.keys(vendor).length ? { 'vendorOptions': vendor } : {});
      const claves = Object.keys(todo).filter(function (k) { return k !== 'options' && k !== 'vendorOptions' && k !== 'source'; });
      claves.forEach(function (clave) {
        const texto = _textoDeValor(todo[clave]);
        filas.push(`<tr><th>${_escaparHtml(clave)}</th><td>${texto}</td></tr>`);
      });
      if (!filas.length) return '<p class="ls-ficha-aviso">La capa no guarda parámetros de construcción.</p>';

      let extra = '';
      ['options', 'vendorOptions'].forEach(function (clave) {
        const obj = todo[clave];
        if (!obj || !Object.keys(obj).length) return;
        const dentro = Object.keys(obj).map(function (k) {
          return `<div class="ls-ficha-subfila"><b>${_escaparHtml(k)}</b> ${_textoDeValor(obj[k])}</div>`;
        }).join('');
        extra += `<details class="ls-ficha-detalle">
            <summary>${clave} (${Object.keys(obj).length})</summary>
            ${dentro || '<div class="ls-ficha-subfila">vacío</div>'}
          </details>`;
      });

      return `<table class="ls-ficha-tabla"><tbody>${filas.join('')}</tbody></table>${extra}`;
    }

    /* ── Editor de parámetros de la ficha ────────────────────────────────
       La tabla de arriba enseña los parámetros en solo lectura; este bloque
       los deja cambiar. Se aplican de dos maneras:

         - Lo que la capa sabe cambiar en caliente (visibilidad y opacidad) se
           aplica directamente, sin recrear nada.
         - Lo que forma parte del constructor (URL, capas del servicio, nombre,
           atribución, colocación de GLB/Imagen/IFC...) obliga a reconstruir la
           capa: se crea la nueva, se sustituye a la vieja en su mismo grupo y
           z, y se conserva el estilo elegido en el selector.

       Los campos salen de `constructorParameters` (`userParameters` en los
       servicios, `parameters` en los datos) filtrados por una lista blanca: lo
       que no está en ella se sigue viendo en la tabla, pero no se toca (un
       `source` ya consumido, un `vendorOptions` del servicio...).

       La colocación (position/bbox) se reconoce por el contrato
       getState/setState de ext/glbLayer, ext/imageLayer y ext/ifcLayer, y es
       lo único que tiene interacción con el mapa: pinchar un punto, tomar la
       vista actual o dibujar el rectángulo (solo 2D, como en el catálogo).
    */

    // Claves de constructorParameters que se pueden editar.
    const CLAVES_EDITABLES = [
      'url', 'name', 'legend', 'attribution', 'layers', 'styles', 'format',
      'version', 'transparent', 'tiled', 'namespace', 'outputFormat', 'crs',
      'maxFeatures', 'minZoom', 'maxZoom', 'tileGridMaxZoom'
    ];

    const ETIQUETAS_EDITOR = {
      url: 'URL',
      name: 'Nombre (capa del servicio)',
      legend: 'Leyenda (lo que se ve)',
      attribution: 'Atribución',
      layers: 'Capas (separadas por comas)',
      styles: 'Estilos (separados por comas)',
      format: 'Formato',
      version: 'Versión',
      transparent: 'Fondo transparente',
      tiled: 'Teselado',
      namespace: 'Espacio de nombres',
      outputFormat: 'Formato de salida',
      crs: 'Sistema de referencia',
      maxFeatures: 'Máximo de entidades',
      minZoom: 'Zoom mínimo',
      maxZoom: 'Zoom máximo',
      tileGridMaxZoom: 'Zoom máximo de la rejilla'
    };

    const AYUDAS_EDITOR = {
      url: 'Cambiar la URL vuelve a crear la capa contra el servicio nuevo.',
      name: 'En WMS/WMTS es la capa publicada (LAYERS); en WFS, el typename.',
      legend: 'Es la etiqueta del selector y el identificador que usan los plugins.'
    };

    /** Parámetros de construcción de una capa, en la forma en que se editan. */
    function _parametrosDeCapa(capa) {
      const cp = (capa && capa.constructorParameters) || {};
      const base = Object.assign({}, cp.userParameters || cp.parameters || {});
      // Las capas de extensión (GLB, Imagen, IFC) borran sus claves propias
      // antes de llamar al constructor base, así que en
      // `constructorParameters` no queda ni la url ni la colocación. La url se
      // recupera de getState() para que se pueda editar y reconstruir; la
      // colocación se lee aparte en `_estadoColocacion`.
      if (capa && typeof capa.getState === 'function' && !base.url) {
        try {
          const estado = capa.getState();
          if (estado && typeof estado === 'object' && typeof estado.url === 'string') {
            base.url = estado.url;
          }
        } catch (e) { /* capa sin estado */ }
      }
      return {
        base: base,
        opciones: Object.assign({}, cp.options || {})
      };
    }

    /**
     * Estado de colocación de la capa, si lo tiene.
     *
     * GLB, Imagen e IFC heredan de Vector y exponen getState()/setState() con
     * `position` y/o `bbox`: son los únicos parámetros que se pueden señalar
     * sobre el mapa. Del estado se conservan SOLO las claves de colocación:
     * getState() devuelve además `url`, `visible` y `opacity`, que ya se
     * editan en su propio campo y no deben pisarse al aplicar.
     */
    const CLAVES_COLOCACION = [
      'position', 'bbox', 'heading', 'pitch', 'roll', 'scale', 'heightOffset',
      'ancho', 'alto', 'metrosPorPixel', 'clampToGround', 'baseAlSuelo',
      'ajustarABbox'
    ];

    function _estadoColocacion(capa) {
      if (!capa || typeof capa.getState !== 'function') return null;
      let estado = null;
      try { estado = capa.getState(); } catch (e) { return null; }
      if (!estado || typeof estado !== 'object') return null;
      if (!('position' in estado) && !('bbox' in estado)) return null;
      const limpio = {};
      CLAVES_COLOCACION.forEach(function (clave) {
        if (clave in estado) limpio[clave] = estado[clave];
      });
      return limpio;
    }

    /** Campos editables de la capa, ya con su valor actual. */
    function _camposEditorFicha(capa) {
      const { base } = _parametrosDeCapa(capa);
      const campos = [];

      // 1. Del constructor: solo la lista blanca y solo valores simples. Un
      //    objeto (el `attribution` de una TMS, un `source` de GeoJSON) no se
      //    puede escribir en un campo de texto sin inventarse un formato.
      CLAVES_EDITABLES.forEach(function (clave) {
        if (!(clave in base)) return;
        const valor = base[clave];
        if (valor === undefined) return;
        if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) return;
        let tipo = 'texto';
        if (typeof valor === 'boolean') tipo = 'casilla';
        else if (typeof valor === 'number') tipo = 'numero';
        const texto = Array.isArray(valor) ? valor.join(', ')
          : (valor === null ? '' : valor);
        campos.push({
          clave: clave,
          etiqueta: ETIQUETAS_EDITOR[clave] || clave,
          tipo: tipo,
          valor: texto,
          ayuda: AYUDAS_EDITOR[clave] || ''
        });
      });

      // 2. Presentación: lo que no siempre viaja en constructorParameters.
      if (!('legend' in base)) {
        campos.push({
          clave: 'legend', etiqueta: ETIQUETAS_EDITOR.legend, tipo: 'texto',
          valor: capa.legend || capa.name || '', ayuda: AYUDAS_EDITOR.legend
        });
      }
      if (!('attribution' in base) && typeof capa.attribution === 'string') {
        campos.push({
          clave: 'attribution', etiqueta: ETIQUETAS_EDITOR.attribution,
          tipo: 'texto', valor: capa.attribution
        });
      }

      let opacidad = 100;
      try {
        if (typeof capa.getOpacity === 'function') opacidad = Math.round(Number(capa.getOpacity()) * 100);
      } catch (e) { /* capa sin opacidad */ }
      if (!isFinite(opacidad)) opacidad = 100;
      campos.push({
        clave: 'opacity', etiqueta: 'Opacidad (%)', tipo: 'numero',
        valor: opacidad, min: 0, max: 100, paso: 1,
        ayuda: 'Se aplica al momento, sin recrear la capa.'
      });

      let visible = true;
      try { if (typeof capa.isVisible === 'function') visible = !!capa.isVisible(); } catch (e) { /* nada */ }
      campos.push({ clave: 'visible', etiqueta: 'Visible', tipo: 'casilla', valor: visible });

      return campos;
    }

    /** HTML de un campo del editor. */
    function _campoEditorHtml(c) {
      if (c.tipo === 'casilla') {
        return `<label class="ls-ficha-campo ls-ficha-campo--casilla">
            <input type="checkbox" data-campo="${_escaparHtml(c.clave)}"${c.valor ? ' checked' : ''}>
            <span>${_escaparHtml(c.etiqueta)}</span>
          </label>`;
      }
      const attrs = [
        `data-campo="${_escaparHtml(c.clave)}"`,
        'class="ls-ficha-input"',
        c.tipo === 'numero' ? 'type="number"' : 'type="text"',
        c.paso !== undefined ? `step="${c.paso}"` : '',
        c.min !== undefined ? `min="${c.min}"` : '',
        c.max !== undefined ? `max="${c.max}"` : '',
        `value="${_escaparHtml(c.valor)}"`
      ].filter(Boolean).join(' ');
      return `<label class="ls-ficha-campo">
          <span class="ls-ficha-campo-etiqueta">${_escaparHtml(c.etiqueta)}</span>
          <input ${attrs}>
          ${c.ayuda ? `<span class="ls-ficha-campo-ayuda">${_escaparHtml(c.ayuda)}</span>` : ''}
        </label>`;
    }

    /** HTML del bloque de colocación (solo capas con getState/setState). */
    function _htmlColocacion(estado) {
      const tienePunto = ('position' in estado);
      const tieneBbox = ('bbox' in estado);
      const pos = (estado.position && typeof estado.position === 'object') ? estado.position : {};
      const caja = Array.isArray(estado.bbox) ? estado.bbox : [];
      // Sin posición y con rectángulo, se abre en rectángulo.
      const modo = (!tienePunto && tieneBbox) ? 'bbox' : 'position';
      const num = (v) => (v === null || v === undefined || !isFinite(Number(v))) ? '' : String(v);

      let html = '<div class="ls-ficha-coloc" data-colocacion>';
      html += '<div class="ls-ficha-coloc-modos" role="group" aria-label="Forma de colocar el recurso">';
      if (tienePunto) {
        html += `<button type="button" class="ls-ficha-coloc-modo${modo === 'position' ? ' ls-ficha-coloc-modo--activo' : ''}" data-modo="position">Punto</button>`;
      }
      if (tieneBbox) {
        html += `<button type="button" class="ls-ficha-coloc-modo${modo === 'bbox' ? ' ls-ficha-coloc-modo--activo' : ''}" data-modo="bbox">Rectángulo</button>`;
      }
      html += '</div>';

      if (tienePunto) {
        html += `<div class="ls-ficha-coloc-grupo" data-grupo="position"${modo === 'position' ? '' : ' hidden'}>
            <div class="ls-ficha-editor-rejilla">
              <label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Longitud</span>
                <input class="ls-ficha-input" type="number" step="any" data-coloc="lon" value="${num(pos.lon)}"></label>
              <label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Latitud</span>
                <input class="ls-ficha-input" type="number" step="any" data-coloc="lat" value="${num(pos.lat)}"></label>
              <label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Cota (m)</span>
                <input class="ls-ficha-input" type="number" step="1" data-coloc="height" value="${num(pos.height)}"></label>
            </div>
            <div class="ls-ficha-coloc-acciones">
              <button type="button" class="ls-ficha-boton" data-accion="centro">Centro del mapa</button>
              <button type="button" class="ls-ficha-boton" data-accion="pinchar">Pinchar en el mapa</button>
            </div>
          </div>`;
      }

      if (tieneBbox) {
        html += `<div class="ls-ficha-coloc-grupo" data-grupo="bbox"${modo === 'bbox' ? '' : ' hidden'}>
            <div class="ls-ficha-editor-rejilla">
              <label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Oeste</span>
                <input class="ls-ficha-input" type="number" step="any" data-coloc="oeste" value="${num(caja[0])}"></label>
              <label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Sur</span>
                <input class="ls-ficha-input" type="number" step="any" data-coloc="sur" value="${num(caja[1])}"></label>
              <label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Este</span>
                <input class="ls-ficha-input" type="number" step="any" data-coloc="este" value="${num(caja[2])}"></label>
              <label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Norte</span>
                <input class="ls-ficha-input" type="number" step="any" data-coloc="norte" value="${num(caja[3])}"></label>
            </div>
            <div class="ls-ficha-coloc-acciones">
              <button type="button" class="ls-ficha-boton" data-accion="vista">Vista actual</button>
              <button type="button" class="ls-ficha-boton" data-accion="dibujar">Dibujar rectángulo</button>
            </div>
          </div>`;
      }

      if ('heading' in estado) {
        const giro = isFinite(Number(estado.heading)) ? Number(estado.heading) : 0;
        html += `<div class="ls-ficha-coloc-giro">
            <div class="ls-ficha-coloc-fila">
              <span class="ls-ficha-campo-etiqueta">Giro (grados)</span>
              <input class="ls-ficha-input ls-ficha-giro-numero" type="number" step="1" data-coloc="heading" value="${giro}">
              <button type="button" class="ls-ficha-enlace" data-accion="giro-cero">0°</button>
            </div>
            <input class="ls-ficha-rango" type="range" min="-180" max="180" step="1" data-coloc="heading-rango" value="${Math.max(-180, Math.min(180, giro))}" aria-label="Giro del recurso en grados">
          </div>`;
      }

      // Avanzado: solo los campos que la capa lleva de verdad.
      const avanzados = [];
      [['pitch', 'Inclinación (°)', '1'], ['roll', 'Alabeo (°)', '1'],
        ['heightOffset', 'Cota sobre el terreno (m)', '1'],
        ['ancho', 'Ancho (m)', '1'], ['alto', 'Alto (m)', '1'],
        ['metrosPorPixel', 'Metros por píxel', '0.1']].forEach(function (def) {
        if (!(def[0] in estado)) return;
        const v = estado[def[0]];
        avanzados.push(`<label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">${def[1]}</span>
            <input class="ls-ficha-input" type="number" step="${def[2]}" data-coloc="${def[0]}" value="${num(v)}"></label>`);
      });
      // La escala llega como número en el constructor, pero getState la
      // devuelve normalizada a objeto {x, y} (Imagen) o {x, y, z} (GLB).
      if ('scale' in estado) {
        const escala = estado.scale;
        if (escala && typeof escala === 'object') {
          ['x', 'y', 'z'].forEach(function (eje) {
            if (!(eje in escala)) return;
            avanzados.push(`<label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Escala ${eje.toUpperCase()}</span>
                <input class="ls-ficha-input" type="number" step="0.1" data-coloc="escala-${eje}" value="${num(escala[eje])}"></label>`);
          });
        } else {
          avanzados.push(`<label class="ls-ficha-campo"><span class="ls-ficha-campo-etiqueta">Escala</span>
              <input class="ls-ficha-input" type="number" step="0.1" data-coloc="scale" value="${num(escala)}"></label>`);
        }
      }
      ['clampToGround', 'baseAlSuelo', 'ajustarABbox'].forEach(function (clave) {
        if (!(clave in estado)) return;
        const etiqueta = clave === 'clampToGround' ? 'Apoyar en el terreno'
          : (clave === 'baseAlSuelo' ? 'Apoyar la base del modelo' : 'Ajustar al rectángulo');
        avanzados.push(`<label class="ls-ficha-campo ls-ficha-campo--casilla">
            <input type="checkbox" data-coloc="${clave}"${estado[clave] ? ' checked' : ''}>
            <span>${etiqueta}</span></label>`);
      });
      if (avanzados.length) {
        html += `<details class="ls-ficha-detalle">
            <summary>Orientación, escala y cota</summary>
            <div class="ls-ficha-editor-rejilla">${avanzados.join('')}</div>
          </details>`;
      }

      html += '</div>';
      return { html: html, modo: modo };
    }

    /** Número de un campo de texto; vacío no es cero. */
    function _numDeCampo(texto) {
      const t = String(texto === null || texto === undefined ? '' : texto).trim().replace(',', '.');
      if (t === '') return null;
      const n = Number(t);
      return isFinite(n) ? n : null;
    }

    /** ¿Son el mismo valor a efectos de formulario? */
    function _mismoValor(a, b) {
      const normal = (v) => {
        if (v === null || v === undefined) return '';
        if (Array.isArray(v)) return v.join(',');
        if (typeof v === 'number') return String(v);
        return String(v).trim();
      };
      return normal(a) === normal(b);
    }

    /** ¿Está el mapa en la implementación de Cesium? */
    function _esCesium(mapa) {
      try {
        const impl = (mapa && typeof mapa.getMapImpl === 'function') ? mapa.getMapImpl() : null;
        return !!(impl && impl.scene && impl.scene.camera && typeof window.Cesium !== 'undefined');
      } catch (e) {
        return false;
      }
    }

    /** Centro de la vista en grados (en 2D hay que reproyectar). */
    function _centroEnGrados() {
      const mapa = self._map;
      if (!mapa) return null;

      // En 3D, la fachada devuelve el centro en grados (setCenter espera
      // EPSG:4326) y lo mantiene al mover la cámara. Si no lo diera, se toma
      // el punto del globo bajo el centro del lienzo.
      if (_esCesium(mapa)) {
        let centro = null;
        try { centro = (typeof mapa.getCenter === 'function') ? mapa.getCenter() : null; } catch (e) { centro = null; }
        if (centro && isFinite(centro.x) && isFinite(centro.y)
          && Math.abs(centro.x) <= 180 && Math.abs(centro.y) <= 90) {
          return [centro.x, centro.y];
        }
        const Cesium = window.Cesium;
        let impl = null;
        try { impl = mapa.getMapImpl(); } catch (e) { impl = null; }
        const escena = impl && impl.scene;
        if (Cesium && escena && escena.camera && escena.globe && escena.canvas) {
          const lienzo = escena.canvas;
          const ancho = lienzo.clientWidth || lienzo.width;
          const alto = lienzo.clientHeight || lienzo.height;
          if (ancho && alto) {
            const posicion = new Cesium.Cartesian2(ancho / 2, alto / 2);
            let cartesiano = null;
            try {
              const rayo = escena.camera.getPickRay(posicion);
              if (rayo) cartesiano = escena.globe.pick(rayo, escena);
            } catch (e) { cartesiano = null; }
            if (!cartesiano) {
              try { cartesiano = escena.camera.pickEllipsoid(posicion, escena.globe.ellipsoid); } catch (e) { cartesiano = null; }
            }
            if (cartesiano) {
              try {
                const c = escena.globe.ellipsoid.cartesianToCartographic(cartesiano);
                const lon = Cesium.Math.toDegrees(c.longitude);
                const lat = Cesium.Math.toDegrees(c.latitude);
                if (isFinite(lon) && isFinite(lat)) return [lon, lat];
              } catch (e) { /* sin centro */ }
            }
          }
        }
        return null;
      }

      if (typeof mapa.getCenter !== 'function') return null;
      let centro = null;
      try { centro = mapa.getCenter(); } catch (e) { return null; }
      if (!centro || !isFinite(centro.x) || !isFinite(centro.y)) return null;
      const IDEE = apiIdee();
      if (!(IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function')) return null;
      try {
        const ll = IDEE.utils.reproject([centro.x, centro.y], 'EPSG:3857', 'EPSG:4326');
        return (ll && isFinite(ll[0]) && isFinite(ll[1])) ? [ll[0], ll[1]] : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Rectángulo que se está viendo, en grados.
     *
     * En 2D sale de la vista de OpenLayers. En 3D se usa
     * camera.computeViewRectangle(), que ya resuelve la cámara inclinada; si
     * no da un rectángulo (vista que no toca el globo), se lanzan rayos por las
     * esquinas del lienzo como respaldo.
     */
    function _vistaEnGrados() {
      const mapa = self._map;
      if (!mapa || typeof mapa.getMapImpl !== 'function') return null;
      let impl = null;
      try { impl = mapa.getMapImpl(); } catch (e) { return null; }
      if (!impl) return null;

      if (!impl.scene) {
        const vista = (typeof impl.getView === 'function') ? impl.getView() : null;
        const tam = (typeof impl.getSize === 'function') ? impl.getSize() : null;
        if (!vista || typeof vista.calculateExtent !== 'function' || !tam) return null;
        const IDEE = apiIdee();
        if (!(IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function')) return null;
        let caja = null;
        try { caja = vista.calculateExtent(tam); } catch (e) { return null; }
        if (!caja || caja.length < 4) return null;
        try {
          const a = IDEE.utils.reproject([caja[0], caja[1]], 'EPSG:3857', 'EPSG:4326');
          const b = IDEE.utils.reproject([caja[2], caja[3]], 'EPSG:3857', 'EPSG:4326');
          return [Math.min(a[0], b[0]), Math.min(a[1], b[1]),
            Math.max(a[0], b[0]), Math.max(a[1], b[1])];
        } catch (e) {
          return null;
        }
      }

      const Cesium = window.Cesium;
      const escena = impl.scene;
      if (!Cesium || !escena || !escena.camera || !escena.globe) return null;
      const elipsoide = escena.globe.ellipsoid;

      // computeViewRectangle ya tiene en cuenta la inclinación de la cámara y
      // devuelve el rectángulo sobre el globo en radianes.
      if (typeof escena.camera.computeViewRectangle === 'function') {
        try {
          const rect = escena.camera.computeViewRectangle(elipsoide);
          if (rect && isFinite(rect.west) && isFinite(rect.south)
            && isFinite(rect.east) && isFinite(rect.north)) {
            return [
              Cesium.Math.toDegrees(rect.west), Cesium.Math.toDegrees(rect.south),
              Cesium.Math.toDegrees(rect.east), Cesium.Math.toDegrees(rect.north)
            ];
          }
        } catch (e) { /* se cae a los rayos de las esquinas */ }
      }

      const lienzo = escena.canvas;
      if (!lienzo) return null;
      const ancho = lienzo.clientWidth || lienzo.width;
      const alto = lienzo.clientHeight || lienzo.height;
      if (!ancho || !alto) return null;

      const lons = [];
      const lats = [];
      [[0, 0], [ancho, 0], [ancho, alto], [0, alto]].forEach(function (px) {
        let cartesiano = null;
        try {
          const posicion = new Cesium.Cartesian2(px[0], px[1]);
          const rayo = escena.camera.getPickRay(posicion);
          if (rayo) cartesiano = escena.globe.pick(rayo, escena);
          if (!cartesiano) cartesiano = escena.camera.pickEllipsoid(posicion, elipsoide);
        } catch (e) {
          cartesiano = null;
        }
        if (!cartesiano) return;
        try {
          const cartografica = elipsoide.cartesianToCartographic(cartesiano);
          lons.push(Cesium.Math.toDegrees(cartografica.longitude));
          lats.push(Cesium.Math.toDegrees(cartografica.latitude));
        } catch (e) { /* esquina perdida */ }
      });
      if (lons.length < 2) return null;
      return [Math.min.apply(null, lons), Math.min.apply(null, lats),
        Math.max.apply(null, lons), Math.max.apply(null, lats)];
    }

    /** Deja el modal translúcido para poder pinchar en el mapa que hay debajo. */
    function _modoPick(overlay, activo) {
      if (!overlay) return;
      overlay.classList.toggle('ls-ficha--pick', !!activo);
    }

    /** Vuelve a poner el cursor normal en el lienzo del mapa. */
    function _cursorMapa(activo) {
      const mapa = self._map;
      if (!mapa || typeof mapa.getMapImpl !== 'function') return;
      let impl = null;
      try { impl = mapa.getMapImpl(); } catch (e) { return; }
      const lienzo = (impl && typeof impl.getViewport === 'function')
        ? impl.getViewport()
        : ((impl && impl.scene && impl.scene.canvas) ? impl.scene.canvas : null);
      if (lienzo) lienzo.style.cursor = activo ? 'crosshair' : '';
    }

    /**
     * Activa la captura de un clic sobre el mapa.
     *
     * @param {HTMLElement} overlay Modal de la ficha (se hace translúcido).
     * @param {Function} alPunto Recibe (lon, lat).
     * @returns {Function} Cancelador.
     */
    function _capturarPunto(overlay, alPunto) {
      const mapa = self._map;
      if (!mapa || typeof mapa.getMapImpl !== 'function') return null;
      const cesium = _esCesium(mapa);
      let impl = null;
      try { impl = mapa.getMapImpl(); } catch (e) { return null; }
      if (!impl) return null;

      _modoPick(overlay, true);
      _cursorMapa(true);

      let soltar = function () { /* se rellena abajo */ };
      let alEscape = null;
      const terminar = function () {
        if (alEscape) {
          try { window.removeEventListener('keydown', alEscape, true); } catch (e) { /* nada */ }
          alEscape = null;
        }
        _modoPick(overlay, false);
        _cursorMapa(false);
        try { soltar(); } catch (e) { /* ya suelto */ }
      };

      // Esc cancela la captura sin cerrar la ficha: va en captura y corta la
      // propagación para que no llegue al manejador global del modal.
      alEscape = function (ev) {
        if (ev.key !== 'Escape') return;
        ev.preventDefault();
        ev.stopPropagation();
        terminar();
      };
      window.addEventListener('keydown', alEscape, true);

      if (!cesium) {
        const manejador = function (evt) {
          terminar();
          const coordenada = evt && evt.coordinate;
          if (!coordenada) return;
          const IDEE = apiIdee();
          let ll = null;
          try {
            ll = (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function')
              ? IDEE.utils.reproject([coordenada[0], coordenada[1]], 'EPSG:3857', 'EPSG:4326')
              : null;
          } catch (e) { ll = null; }
          if (!ll) return;
          alPunto(ll[0], ll[1]);
        };
        try {
          impl.once('singleclick', manejador);
          soltar = function () { try { impl.un('singleclick', manejador); } catch (e) { /* nada */ } };
        } catch (e) {
          terminar();
          return null;
        }
        return terminar;
      }

      const Cesium = window.Cesium;
      const escena = impl.scene;
      if (!Cesium || !escena || !escena.canvas) { terminar(); return null; }
      let manejadorCesium = null;
      try {
        manejadorCesium = new Cesium.ScreenSpaceEventHandler(escena.canvas);
        manejadorCesium.setInputAction(function (movimiento) {
          const posicion = movimiento && movimiento.position;
          if (!posicion) return;
          let cartesiano = null;
          try {
            const rayo = escena.camera.getPickRay(posicion);
            if (rayo) cartesiano = escena.globe.pick(rayo, escena);
            if (!cartesiano) cartesiano = escena.camera.pickEllipsoid(posicion, escena.globe.ellipsoid);
          } catch (e) {
            cartesiano = null;
          }
          if (!cartesiano) return;
          const cartografica = escena.globe.ellipsoid.cartesianToCartographic(cartesiano);
          terminar();
          alPunto(Cesium.Math.toDegrees(cartografica.longitude), Cesium.Math.toDegrees(cartografica.latitude));
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        soltar = function () { try { manejadorCesium.destroy(); } catch (e) { /* nada */ } };
      } catch (e) {
        terminar();
        return null;
      }
      return terminar;
    }

    /**
     * Activa el arrastre de un rectángulo sobre el mapa (solo 2D).
     *
     * La marquesina se cuelga del body y va en coordenadas de pantalla: así no
     * hay que tocar el posicionamiento del viewport del mapa.
     *
     * @returns {Function|null} Cancelador, o null si no se puede dibujar.
     */
    function _capturarRectangulo(overlay, alBbox) {
      const mapa = self._map;
      if (!mapa || typeof mapa.getMapImpl !== 'function') return null;
      if (_esCesium(mapa)) return null;
      let impl = null;
      try { impl = mapa.getMapImpl(); } catch (e) { return null; }
      const viewport = (impl && typeof impl.getViewport === 'function') ? impl.getViewport() : null;
      if (!impl || !viewport) return null;

      _modoPick(overlay, true);
      _cursorMapa(true);

      const marco = document.createElement('div');
      marco.className = 'ls-ficha-marco';
      marco.hidden = true;
      document.body.appendChild(marco);

      let inicio = null;
      let fin = null;
      let cancelar = null;

      const pintar = function () {
        if (!inicio || !fin) return;
        marco.style.left = Math.min(inicio.x, fin.x) + 'px';
        marco.style.top = Math.min(inicio.y, fin.y) + 'px';
        marco.style.width = Math.abs(fin.x - inicio.x) + 'px';
        marco.style.height = Math.abs(fin.y - inicio.y) + 'px';
      };

      const alMover = function (ev) {
        if (!inicio) return;
        fin = { x: ev.clientX, y: ev.clientY };
        pintar();
      };

      const soltar = function () {
        window.removeEventListener('pointermove', alMover, true);
        window.removeEventListener('pointerup', alSoltar, true);
        window.removeEventListener('keydown', alEscape, true);
      };

      const limpiar = function () {
        soltar();
        _modoPick(overlay, false);
        _cursorMapa(false);
        if (marco.parentNode) marco.parentNode.removeChild(marco);
      };

      const alEscape = function (ev) {
        if (ev.key !== 'Escape') return;
        ev.stopPropagation();
        limpiar();
      };

      const alSoltar = function (ev) {
        if (!inicio) return;
        fin = { x: ev.clientX, y: ev.clientY };
        const anchoPx = Math.abs(fin.x - inicio.x);
        const altoPx = Math.abs(fin.y - inicio.y);
        const caja = viewport.getBoundingClientRect();
        const p1 = [Math.min(inicio.x, fin.x) - caja.left, Math.min(inicio.y, fin.y) - caja.top];
        const p2 = [Math.max(inicio.x, fin.x) - caja.left, Math.max(inicio.y, fin.y) - caja.top];
        limpiar();
        if (anchoPx < 6 || altoPx < 6) return;

        let c1 = null;
        let c2 = null;
        try {
          c1 = impl.getCoordinateFromPixel(p1);
          c2 = impl.getCoordinateFromPixel(p2);
        } catch (e) {
          c1 = null;
          c2 = null;
        }
        if (!c1 || !c2) return;
        const IDEE = apiIdee();
        let ll1 = null;
        let ll2 = null;
        try {
          if (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function') {
            ll1 = IDEE.utils.reproject([c1[0], c1[1]], 'EPSG:3857', 'EPSG:4326');
            ll2 = IDEE.utils.reproject([c2[0], c2[1]], 'EPSG:3857', 'EPSG:4326');
          }
        } catch (e) {
          ll1 = null;
          ll2 = null;
        }
        if (!ll1 || !ll2) return;
        alBbox([
          Math.min(ll1[0], ll2[0]), Math.min(ll1[1], ll2[1]),
          Math.max(ll1[0], ll2[0]), Math.max(ll1[1], ll2[1])
        ]);
      };

      const alPulsar = function (ev) {
        if (ev.button !== 0) return;
        // En captura: se corta antes de que OpenLayers empiece a arrastrar el mapa.
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        inicio = { x: ev.clientX, y: ev.clientY };
        fin = { x: ev.clientX, y: ev.clientY };
        marco.hidden = false;
        pintar();
        window.addEventListener('pointermove', alMover, true);
        window.addEventListener('pointerup', alSoltar, true);
        window.addEventListener('keydown', alEscape, true);
      };

      viewport.addEventListener('pointerdown', alPulsar, true);
      cancelar = function () {
        viewport.removeEventListener('pointerdown', alPulsar, true);
        limpiar();
      };
      return cancelar;
    }

    /** Sustituye una capa por otra en su mismo grupo y con su mismo z. */
    function _sustituirCapa(capaVieja, capaNueva) {
      const mapa = self._map;
      if (!mapa) return false;

      // Padre (grupo) de la capa, si está anidada.
      const esGrupo = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function');
      let padre = null;
      const buscarPadre = function (lista) {
        for (const l of lista) {
          if (!esGrupo(l)) continue;
          let hijas = [];
          try { hijas = l.getLayers() || []; } catch (e) { hijas = []; }
          if (hijas.indexOf(capaVieja) > -1) return l;
          const dentro = buscarPadre(hijas);
          if (dentro) return dentro;
        }
        return null;
      };
      try { padre = buscarPadre(mapa.getLayers() || []); } catch (e) { padre = null; }

      const z = self._zReal(capaVieja);
      let opacidad = null;
      try { if (typeof capaVieja.getOpacity === 'function') opacidad = Number(capaVieja.getOpacity()); } catch (e) { opacidad = null; }
      const estilo = (capaVieja._selectedStyleName !== undefined) ? capaVieja._selectedStyleName
        : ((capaVieja._selectedStyleIndex !== undefined) ? capaVieja._selectedStyleIndex
          : ((capaVieja._currentStyleId !== undefined) ? capaVieja._currentStyleId : undefined));

      try {
        if (padre && typeof padre.removeLayers === 'function') padre.removeLayers(capaVieja);
        else if (typeof mapa.removeLayers === 'function') mapa.removeLayers(capaVieja);
      } catch (e) {
        console.warn('layerSwitcher: no se pudo quitar la capa vieja', e);
      }

      try {
        if (padre && typeof padre.addLayers === 'function') padre.addLayers(capaNueva);
        else mapa.addLayers(capaNueva);
      } catch (e) {
        // Si la nueva no entra, se devuelve la vieja a su sitio: mejor eso que
        // dejar al usuario sin capa.
        try {
          if (padre && typeof padre.addLayers === 'function') padre.addLayers(capaVieja);
          else mapa.addLayers(capaVieja);
        } catch (e2) { /* nada más que hacer */ }
        throw e;
      }

      if (z !== null && z !== undefined) {
        try { self._escribirZ(capaNueva, z); } catch (e) { /* sin z */ }
      }
      if (opacidad !== null && isFinite(opacidad) && typeof capaNueva.setOpacity === 'function') {
        try { capaNueva.setOpacity(opacidad); } catch (e) { /* sin opacidad */ }
      }
      if (estilo !== undefined && typeof window.setLayerStyle === 'function') {
        try { window.setLayerStyle(capaNueva.idLayer, estilo); } catch (e) { /* estilo no válido */ }
      }
      return true;
    }

    /**
     * Aplica los valores del formulario a la capa.
     *
     * @returns {{ok:boolean, capa:Object, recreada:boolean, mensaje:string}}
     */
    function _aplicarEditorFicha(capa, lectura) {
      const valores = lectura.campos || {};
      const { base, opciones } = _parametrosDeCapa(capa);

      // 1. En caliente: opacidad y visibilidad no obligan a recrear nada.
      if (typeof valores.opacity === 'number' && isFinite(valores.opacity)
        && typeof capa.setOpacity === 'function') {
        try { capa.setOpacity(Math.max(0, Math.min(100, valores.opacity)) / 100); } catch (e) { /* nada */ }
      }
      if (typeof valores.visible === 'boolean' && typeof capa.setVisible === 'function') {
        try { capa.setVisible(valores.visible); } catch (e) { /* nada */ }
      }

      // 2. Lo del constructor: se compara con lo que hay para no recrear la
      //    capa cuando solo se ha tocado la transparencia.
      const params = Object.assign({}, base);
      let cambia = false;
      Object.keys(valores).forEach(function (clave) {
        if (clave === 'opacity' || clave === 'visible') return;
        const nuevo = valores[clave];
        const actual = (clave in base) ? base[clave] : capa[clave];
        if (_mismoValor(nuevo, actual)) return;
        params[clave] = nuevo;
        cambia = true;
      });

      const colocacion = lectura.colocacion;
      if (colocacion) {
        const anterior = _estadoColocacion(capa);
        const cambiaColocacion = JSON.stringify(colocacion) !== JSON.stringify(anterior);
        // La colocación se pasa SIEMPRE al constructor: las capas de extensión
        // (GLB/Imagen/IFC) no la guardan en constructorParameters, así que si
        // solo se cambia la leyenda habría que reconstruirla sin posición.
        Object.keys(colocacion).forEach(function (clave) {
          if (clave === 'visible' || clave === 'opacity') return;
          params[clave] = colocacion[clave];
        });
        if (cambiaColocacion) cambia = true;
      }

      if (!cambia) return { ok: true, capa: capa, recreada: false, mensaje: 'Aplicado.' };

      // La visibilidad y la opacidad van como estado, no como constructor: se
      // reaplican después de crear la capa nueva.
      delete params.visible;
      delete params.opacity;

      const Ctor = capa.constructor;
      if (typeof Ctor !== 'function') {
        return { ok: false, capa: capa, recreada: false, mensaje: 'Esta capa no se puede reconstruir.' };
      }

      let nueva = null;
      try {
        nueva = new Ctor(params, opciones);
      } catch (e) {
        console.warn('layerSwitcher: no se pudo reconstruir la capa', e);
        return {
          ok: false, capa: capa, recreada: false,
          mensaje: 'No se ha podido reconstruir la capa: ' + (e && e.message ? e.message : e)
        };
      }

      try {
        _sustituirCapa(capa, nueva);
      } catch (e) {
        return {
          ok: false, capa: capa, recreada: false,
          mensaje: 'No se ha podido sustituir la capa en el mapa: ' + (e && e.message ? e.message : e)
        };
      }

      // `setVisible` y `setOpacity` no viajan en el constructor de todas las
      // capas: se reponen a mano con lo que había más lo que se acaba de tocar.
      const visible = (typeof valores.visible === 'boolean') ? valores.visible
        : (typeof capa.isVisible === 'function' ? !!capa.isVisible() : true);
      if (typeof nueva.setVisible === 'function') {
        try { nueva.setVisible(visible); } catch (e) { /* nada */ }
      }
      if (typeof valores.opacity === 'number' && isFinite(valores.opacity)
        && typeof nueva.setOpacity === 'function') {
        try { nueva.setOpacity(Math.max(0, Math.min(100, valores.opacity)) / 100); } catch (e) { /* nada */ }
      }

      return { ok: true, capa: nueva, recreada: true, mensaje: 'Aplicado: la capa se ha reconstruido.' };
    }

    /**
     * Monta el editor dentro de la ficha.
     *
     * @param {HTMLElement} contenedor Hueco del formulario.
     * @param {Object} capa Capa viva.
     * @param {HTMLElement} overlay Modal (para el modo de pinchazo).
     * @param {Function} alCambiar Recibe la capa nueva tras aplicar.
     */
    function _montarEditorFicha(contenedor, capa, overlay, alCambiar) {
      if (!contenedor || !capa) return;

      // Si se vuelve a montar el editor (tras aplicar o descartar), se retira
      // el manejador de Escape del formulario anterior.
      const anterior = contenedor.querySelector('.ls-ficha-editor');
      if (anterior && anterior._lsEscapeEditor) {
        try { window.removeEventListener('keydown', anterior._lsEscapeEditor, true); } catch (e) { /* nada */ }
      }

      if (capa.type === 'LayerGroup' || capa._type === 'LayerGroup' || typeof capa.getLayers === 'function') {
        contenedor.innerHTML = '<p class="ls-ficha-aviso">Un grupo no tiene parámetros propios: edita los de cada capa que contiene.</p>';
        return;
      }

      const campos = _camposEditorFicha(capa);
      const { base } = _parametrosDeCapa(capa);
      const estado = _estadoColocacion(capa);
      const coloc = estado ? _htmlColocacion(estado) : null;

      let html = '<form class="ls-ficha-editor" autocomplete="off" onsubmit="return false">';
      html += `<div class="ls-ficha-editor-rejilla">${campos.map(_campoEditorHtml).join('')}</div>`;
      if (coloc) {
        html += '<div class="ls-ficha-seccion-titulo ls-ficha-seccion-titulo--sub">Colocación en el mapa</div>';
        html += coloc.html;
      }
      html += `<div class="ls-ficha-editor-pie">
          <button type="button" class="ls-ficha-boton ls-ficha-boton--primario" data-accion="aplicar">Aplicar cambios</button>
          <button type="button" class="ls-ficha-boton" data-accion="restablecer">Descartar cambios</button>
          <span class="ls-ficha-editor-estado" role="status"></span>
        </div>`;
      html += '</form>';
      contenedor.innerHTML = html;

      const form = contenedor.querySelector('.ls-ficha-editor');
      const estadoEl = contenedor.querySelector('.ls-ficha-editor-estado');
      if (coloc) form.setAttribute('data-modo-coloc', coloc.modo);

      // Al cancelar una captura con Esc, el botón deja de estar resaltado. Va
      // en captura sobre window y no usa stopPropagation: el manejador de la
      // captura corta la propagación, pero los listeners del mismo destino
      // siguen ejecutándose.
      const alEscapeEditor = function (ev) {
        if (ev.key !== 'Escape') return;
        form.querySelectorAll('.ls-ficha-boton--activo').forEach(function (b) {
          b.classList.remove('ls-ficha-boton--activo');
        });
      };
      form._lsEscapeEditor = alEscapeEditor;
      window.addEventListener('keydown', alEscapeEditor, true);

      const decir = function (texto, clase) {
        if (!estadoEl) return;
        estadoEl.textContent = texto || '';
        estadoEl.className = 'ls-ficha-editor-estado' + (clase ? ' ls-ficha-editor-estado--' + clase : '');
      };

      const soltarPick = function () {
        if (typeof _cancelarPickFicha === 'function') {
          try { _cancelarPickFicha(); } catch (e) { /* nada */ }
          _cancelarPickFicha = null;
        }
        form.querySelectorAll('.ls-ficha-boton--activo').forEach(function (b) {
          b.classList.remove('ls-ficha-boton--activo');
        });
      };

      const ponerColoc = function (nombre, valor) {
        const el = form.querySelector('[data-coloc="' + nombre + '"]');
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!valor;
        else if (valor === null || valor === undefined || !isFinite(Number(valor))) el.value = '';
        else el.value = String(valor);
      };

      const leerColoc = function () {
        if (!coloc || !estado) return null;
        const nuevo = JSON.parse(JSON.stringify(estado));
        const modo = form.getAttribute('data-modo-coloc') || 'position';
        const leer = function (nombre) {
          const el = form.querySelector('[data-coloc="' + nombre + '"]');
          if (!el) return undefined;
          if (el.type === 'checkbox') return !!el.checked;
          return _numDeCampo(el.value);
        };
        if ('position' in nuevo) {
          const lon = leer('lon');
          const lat = leer('lat');
          const height = leer('height');
          nuevo.position = (lon === null || lat === null) ? null : {
            lon: lon, lat: lat, height: height === null ? 0 : height
          };
        }
        if ('bbox' in nuevo) {
          const o = leer('oeste');
          const s = leer('sur');
          const e = leer('este');
          const n = leer('norte');
          nuevo.bbox = (o === null || s === null || e === null || n === null) ? null : [o, s, e, n];
        }
        ['heading', 'pitch', 'roll', 'heightOffset', 'ancho', 'alto', 'metrosPorPixel']
          .forEach(function (clave) {
            if (!(clave in nuevo)) return;
            const v = leer(clave);
            if (v !== undefined && v !== null) nuevo[clave] = v;
          });
        // La escala puede venir como número o como objeto {x, y[, z]}.
        if ('scale' in nuevo) {
          if (nuevo.scale && typeof nuevo.scale === 'object') {
            const escala = {};
            ['x', 'y', 'z'].forEach(function (eje) {
              if (!(eje in nuevo.scale)) return;
              const v = leer('escala-' + eje);
              escala[eje] = (v === null || v === undefined) ? nuevo.scale[eje] : v;
            });
            nuevo.scale = escala;
          } else {
            const v = leer('scale');
            if (v !== null && v !== undefined) nuevo.scale = v;
          }
        }
        ['clampToGround', 'baseAlSuelo', 'ajustarABbox'].forEach(function (clave) {
          if (!(clave in nuevo)) return;
          const v = leer(clave);
          if (v !== undefined) nuevo[clave] = v;
        });
        // El modo elegido manda: si se está en punto, el rectángulo que hubiera
        // se conserva pero no se exige, y al revés.
        nuevo.__modo = modo;
        return nuevo;
      };

      /** Validación mínima antes de tocar el mapa. */
      const validarColoc = function (nuevo) {
        if (!nuevo) return { ok: true, mensaje: '' };
        const modo = nuevo.__modo || 'position';
        if (modo === 'position' && ('position' in nuevo)) {
          if (!nuevo.position) {
            return { ok: false, mensaje: 'Escribe la longitud y la latitud, o usa «Centro del mapa» / «Pinchar en el mapa».' };
          }
          if (nuevo.position.lon < -180 || nuevo.position.lon > 180
            || nuevo.position.lat < -90 || nuevo.position.lat > 90) {
            return { ok: false, mensaje: 'La longitud va entre -180 y 180, y la latitud entre -90 y 90.' };
          }
        }
        if (modo === 'bbox' && ('bbox' in nuevo)) {
          const caja = nuevo.bbox;
          if (!caja) return { ok: false, mensaje: 'Marca un rectángulo o escribe sus cuatro coordenadas.' };
          if (caja[2] <= caja[0] || caja[3] <= caja[1]) {
            return { ok: false, mensaje: 'El rectángulo está vacío: el este tiene que ser mayor que el oeste y el norte mayor que el sur.' };
          }
        }
        return { ok: true, mensaje: '' };
      };

      /* --- Modos y acciones de mapa -------------------------------- */

      form.querySelectorAll('.ls-ficha-coloc-modo').forEach(function (boton) {
        boton.addEventListener('click', function () {
          const modo = this.getAttribute('data-modo');
          form.setAttribute('data-modo-coloc', modo);
          form.querySelectorAll('.ls-ficha-coloc-modo').forEach(function (b) {
            b.classList.toggle('ls-ficha-coloc-modo--activo', b === boton);
          });
          form.querySelectorAll('.ls-ficha-coloc-grupo').forEach(function (g) {
            g.hidden = g.getAttribute('data-grupo') !== modo;
          });
          decir('');
        });
      });

      form.addEventListener('click', function (ev) {
        const boton = ev.target.closest ? ev.target.closest('[data-accion]') : null;
        if (!boton || !form.contains(boton)) return;
        const accion = boton.getAttribute('data-accion');

        if (accion === 'centro') {
          const centro = _centroEnGrados();
          if (!centro) { decir('No se ha podido leer el centro del mapa.', 'error'); return; }
          ponerColoc('lon', centro[0]);
          ponerColoc('lat', centro[1]);
          decir('Punto en el centro del mapa.');
          return;
        }

        if (accion === 'vista') {
          const caja = _vistaEnGrados();
          if (!caja) {
            decir(_esCesium(self._map)
              ? 'En 3D la cámara va inclinada y no hay un rectángulo limpio: escribe las coordenadas.'
              : 'No se ha podido leer la vista actual.', 'aviso');
            return;
          }
          ponerColoc('oeste', caja[0]);
          ponerColoc('sur', caja[1]);
          ponerColoc('este', caja[2]);
          ponerColoc('norte', caja[3]);
          decir('Rectángulo de la vista actual tomado.');
          return;
        }

        if (accion === 'pinchar') {
          soltarPick();
          const cancelar = _capturarPunto(overlay, function (lon, lat) {
            ponerColoc('lon', lon);
            ponerColoc('lat', lat);
            decir('Punto tomado: ' + lon.toFixed(6) + ', ' + lat.toFixed(6) + '.');
            _cancelarPickFicha = null;
            if (boton) boton.classList.remove('ls-ficha-boton--activo');
          });
          if (!cancelar) { decir('No se ha podido activar el pinchazo en el mapa.', 'error'); return; }
          _cancelarPickFicha = cancelar;
          boton.classList.add('ls-ficha-boton--activo');
          decir('Haz clic en el mapa. Esc para cancelar.');
          return;
        }

        if (accion === 'dibujar') {
          soltarPick();
          if (_esCesium(self._map)) {
            decir('En 3D no se puede dibujar el rectángulo: usa «Vista actual» o escribe las coordenadas.', 'aviso');
            return;
          }
          const cancelar = _capturarRectangulo(overlay, function (caja) {
            ponerColoc('oeste', caja[0]);
            ponerColoc('sur', caja[1]);
            ponerColoc('este', caja[2]);
            ponerColoc('norte', caja[3]);
            decir('Rectángulo tomado. Ajusta el giro si hace falta.');
            _cancelarPickFicha = null;
            if (boton) boton.classList.remove('ls-ficha-boton--activo');
          });
          if (!cancelar) { decir('No se ha podido activar el dibujo.', 'error'); return; }
          _cancelarPickFicha = cancelar;
          boton.classList.add('ls-ficha-boton--activo');
          decir('Arrastra sobre el mapa para marcar el rectángulo. Esc para cancelar.');
          return;
        }

        if (accion === 'giro-cero') {
          ponerColoc('heading', 0);
          ponerColoc('heading-rango', 0);
          return;
        }

        if (accion === 'restablecer') {
          soltarPick();
          _montarEditorFicha(contenedor, capa, overlay, alCambiar);
          return;
        }

        if (accion === 'aplicar') {
          soltarPick();
          const camposValores = {};
          form.querySelectorAll('[data-campo]').forEach(function (el) {
            const clave = el.getAttribute('data-campo');
            if (el.type === 'checkbox') camposValores[clave] = !!el.checked;
            else if (el.type === 'number') camposValores[clave] = _numDeCampo(el.value);
            else camposValores[clave] = String(el.value).trim();
          });
          // Los arrays vuelven a ser arrays.
          Object.keys(camposValores).forEach(function (clave) {
            const original = (clave in base) ? base[clave] : null;
            if (Array.isArray(original) && typeof camposValores[clave] === 'string') {
              camposValores[clave] = camposValores[clave]
                .split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
            }
          });

          const colocacion = leerColoc();
          const revision = validarColoc(colocacion);
          if (!revision.ok) { decir(revision.mensaje, 'error'); return; }

          // `__modo` es solo del formulario: no es un parámetro de la capa.
          if (colocacion) delete colocacion.__modo;

          const resultado = _aplicarEditorFicha(capa, { campos: camposValores, colocacion: colocacion });
          decir(resultado.mensaje, resultado.ok ? 'ok' : 'error');
          if (!resultado.ok) return;

          if (typeof window.renderLayerList === 'function') {
            try { window.renderLayerList(); } catch (e) { /* nada */ }
          }
          if (resultado.recreada) {
            if (typeof alCambiar === 'function') alCambiar(resultado.capa);
            _montarEditorFicha(contenedor, resultado.capa, overlay, alCambiar);
            // El formulario se acaba de reconstruir: el aviso se repone a mano.
            const nuevoEstado = contenedor.querySelector('.ls-ficha-editor-estado');
            if (nuevoEstado) {
              nuevoEstado.textContent = resultado.mensaje;
              nuevoEstado.className = 'ls-ficha-editor-estado ls-ficha-editor-estado--ok';
            }
          }
          return;
        }
      });

      // El número del giro y el rango se siguen el uno al otro.
      const giroNum = form.querySelector('[data-coloc="heading"]');
      const giroRango = form.querySelector('[data-coloc="heading-rango"]');
      if (giroNum && giroRango) {
        giroNum.addEventListener('input', function () {
          const v = _numDeCampo(this.value);
          giroRango.value = String(Math.max(-180, Math.min(180, v === null ? 0 : v)));
        });
        giroRango.addEventListener('input', function () {
          giroNum.value = this.value;
        });
      }
    }

    /** Tipo legible de la capa, para la cabecera. */
    function _tipoDeCapa(capa) {
      const nombre = capa.constructor && capa.constructor.name ? capa.constructor.name : null;
      if (nombre && nombre !== 'h' && nombre !== 'c' && nombre !== 'f' && nombre !== 'o' && nombre !== 'u') {
        return nombre;
      }
      // Los nombres de clase de la API llegan minificados en el bundle; en ese
      // caso se mira qué metodos tiene, que es lo que distingue unas de otras.
      try {
        if (typeof capa.getCapabilities === 'function') return 'WMS / WMTS';
        if (typeof capa.getFeatureInfoUrl === 'function') return 'Servicio WMS';
        if (typeof capa.toGeoJSON === 'function') return 'Capa vectorial';
        if (typeof capa.getFeaturesCount === 'function') return 'Capa vectorial';
      } catch (e) { /* nada */ }
      try {
        if (capa.url && /\.pbf($|\?)/i.test(String(capa.url))) return 'MVT (teselas vectoriales)';
      } catch (e) { /* nada */ }
      return 'Capa';
    }

    /**
     * Trae el documento del servicio y lo pinta.
     *
     * WMS y WMTS se leen con `getCapabilities()`, que es la llamada que hace la
     * API al construirlas y que devuelve el XML entero (medido: puede ser de
     * cientos de KB, asi que se resume y se deja el volcado entero plegable).
     *
     * Para teselas (TMS, MVT) no hay capabilities: lo que a veces publican es un
     * `tileset.json` o un `metadata.json` junto al servicio (por ejemplo, los
     * tileset de Mapbox). Se intentan los dos nombres y, si no hay, se dice.
     *
     * @param {HTMLElement} contenedor
     * @param {Object} capa
     * @param {string|null} url
     */
    async function _rellenarDocumento(contenedor, capa, url) {
      // 1) Capacidades: solo WMS y WMTS.
      if (typeof capa.getCapabilities === 'function') {
        try {
          const xml = await capa.getCapabilities();
          const texto = typeof xml === 'string' ? xml : JSON.stringify(xml);
          contenedor.innerHTML = _resumenCapacidades(texto);
          return;
        } catch (e) {
          contenedor.innerHTML =
            '<p class="ls-ficha-aviso">No se pudieron leer las capacidades del servicio.</p>';
          console.warn('layerSwitcher: ficha, getCapabilities', e);
          return;
        }
      }

      // 2) JSON asociado a un servicio de teselas.
      //
      // OJO CON LAS CAPAS MapLibre: el `url` de la capa es el style.json, que
      // vive en otra ruta que los datos (medido en la BTN: el estilo está en
      // .../files/styles/BTN_Completa.json y las teselas en
      // .../1.0.0/btn/tile/{z}/{y}/{x}.pbf). Por eso, además de la carpeta del
      // propio url, se miran las carpetas de sus fuentes de teselas: el
      // TileJSON del servicio suele estar un nivel por encima de .../tile/
      // (medido: https://vt-btn.idee.es/1.0.0/btn/metadata.json).
      const candidatos = [];
      const anade = function (u) { if (u && candidatos.indexOf(u) === -1) candidatos.push(u); };
      const ml = getMapLibreMap(capa);
      if (ml) {
        let fuentes = [];
        try { fuentes = _fuentesVectorialesMapLibre(ml.getStyle()); } catch (e) { fuentes = []; }
        fuentes.forEach(function (f) {
          if (f.url) anade(f.url);
          (f.tiles || []).forEach(function (t) {
            _basesDeTeselas(t).forEach(function (b) {
              anade(b + 'metadata.json');
              anade(b + 'tileset.json');
            });
          });
        });
      }
      const base = _baseDelServicio(url);
      if (base) { anade(base + 'tileset.json'); anade(base + 'metadata.json'); }

      if (!candidatos.length) {
        contenedor.innerHTML = '<p class="ls-ficha-aviso">Esta capa no procede de un servicio publicado.</p>';
        return;
      }
      let encontrado = null;
      for (const completa of candidatos) {
        try {
          const cuerpo = await _pedirTexto(completa);
          const datos = _jsonDeVerdad(cuerpo);
          if (datos) { encontrado = { url: completa, datos: datos }; break; }
        } catch (e) { /* ese candidato no esta; se prueba el siguiente */ }
      }
      if (!encontrado) {
        contenedor.innerHTML =
          '<p class="ls-ficha-aviso">No se encontró ningún documento de servicio asociado ' +
          '(se buscaron <code>tileset.json</code> y <code>metadata.json</code>).</p>';
        return;
      }
      const cuerpo = JSON.stringify(encontrado.datos, null, 2);
      const corto = cuerpo.length > 12000 ? cuerpo.slice(0, 12000) +
        '\n… (truncado, ' + cuerpo.length + ' caracteres en total)' : cuerpo;
      contenedor.innerHTML =
        `<p class="ls-ficha-doc-url"><a href="${_escaparHtml(encontrado.url)}" target="_blank" rel="noopener">${_escaparHtml(encontrado.url)}</a></p>` +
        `<pre class="ls-ficha-pre">${_escaparHtml(corto)}</pre>`;
    }

    /** Pide una URL y devuelve el cuerpo como texto. */
    async function _pedirTexto(url) {
      const api = apiIdee();
      if (api && api.remote && typeof api.remote.get === 'function') {
        const resp = await api.remote.get(url);
        if (typeof resp === 'string') return resp;
        if (resp && typeof resp.text === 'function') return await resp.text();
        // La utilidad de la API devuelve el cuerpo en la propiedad `text`, que
        // es una CADENA, no una respuesta con .text(). Si aquí se madeja el
        // objeto entero y se serializa, los bytes de una imagen se escapan a
        // \u0000 y la prueba de "esto es binario" deja de verlos (medido).
        if (resp && typeof resp.text === 'string') return resp.text;
        if (resp && typeof resp === 'object') return JSON.stringify(resp);
        return null;
      }
      const resp = await fetch(url);
      return await resp.text();
    }

    /**
     * ¿El texto es JSON de verdad?
     *
     * Sin esta prueba el botón enseñaba una tesela PNG como si fuera un documento:
     * un servicio que no publica `tileset.json` devuelve lo que sea, y una imagen
     * no tiene por qué empezar por `{` para colarse (medido).
     */
    function _jsonDeVerdad(texto) {
      if (!texto || typeof texto !== 'string') return null;
      const limpio = texto.trim();
      if (!/^[{\[]/.test(limpio)) return null;
      // Binario (PNG, JPEG, una tesela) lleva caracteres de control: no es texto.
      if (/[\x00-\x08\x0e-\x1f]/.test(limpio.slice(0, 2000))) return null;
      try {
        const datos = JSON.parse(limpio);
        return (datos && typeof datos === 'object') ? datos : null;
      } catch (e) {
        return null;
      }
    }

    /** Base de un servicio a partir de su URL, para buscar documentos vecinos. */
    function _baseDelServicio(url) {
      if (!url) return null;
      let limpia = String(url).split('?')[0];
      // Quedarse con lo que hay antes de la primera tesela: si la URL trae
      // {z}/{x}/{y}..., la base es lo que va antes de la primera llave.
      const i = limpia.search(/\{[xyz-]/);
      if (i > -1) limpia = limpia.slice(0, i);
      limpia = limpia.replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(limpia)) return null;
      return limpia + '/';
    }

    /** Un objeto a texto JSON, o null si no se puede. */
    function _aTexto(valor) {
      if (valor === null || valor === undefined) return null;
      if (typeof valor === 'string') return valor;
      try { return JSON.stringify(valor); } catch (e) { return null; }
    }

    /** Un texto JSON a objeto, o null si no es JSON. */
    function _aJson(texto) {
      if (!texto || typeof texto !== 'string') return null;
      if (!/^\s*\{/.test(texto)) return null;
      try {
        const datos = JSON.parse(texto);
        return (datos && typeof datos === 'object') ? datos : null;
      } catch (e) {
        return null;
      }
    }

    /** Resumen legible de un GetCapabilities, con el documento entero plegable. */
    function _resumenCapacidades(crudo) {
      // El envoltorio que pone la API es uniproblema: `getCapabilities()` puede
      // devolver un objeto o una CADENA, y lo de dentro, capabilities_, puede
      // ser a su vez un objeto o una cadena (medidas las cuatro formas con el
      // WMS de la IGN y con el GeoTIFF). Se normaliza a un objeto plano antes de
      // buscar el Service, y si lo que sale es XML se sigue por esa vía.
      let texto = _aTexto(crudo);
      let datos = _aJson(texto);
      for (let vuelta = 0; vuelta < 3; vuelta++) {
        if (!datos || datos.capabilities_ === undefined) break;
        texto = _aTexto(datos.capabilities_);
        if (!texto) { datos = null; break; }
        datos = _aJson(texto);
      }
      if (!texto) {
        return '<p class="ls-ficha-aviso">El servicio no devolvió documento de capacidades.</p>';
      }

      // Puede venir como JSON (lo que da la API en este visualizador) o como XML
      // (un GetCapabilities al uso). Se prueba el primero.
      let meta = null;
      if (datos) {
        try {
          const servicio = (datos && datos.Service) ||
            (datos && datos.Capabilities && datos.Capabilities.Service) || null;
          if (servicio) {
            meta = {
              nombre: servicio.Name || null,
              titulo: servicio.Title || null,
              resumen: servicio.Abstract || null,
              capas: _contarCapasJson(datos),
            };
          }
        } catch (e) { meta = null; }
      }
      // Y si no, como XML.
      if (!meta && /^\s*</.test(texto)) {
        try {
          const doc = new DOMParser().parseFromString(texto, 'text/xml');
          const q = function (sel) {
            let e = null;
            try { e = doc.querySelector(sel); } catch (err) { e = null; }
            return e && e.textContent ? e.textContent.trim() : null;
          };
          let lista = 0;
          try { lista = doc.querySelectorAll('Layer > Name').length; } catch (e) { lista = 0; }
          meta = {
            nombre: q('Service > Name'),
            titulo: q('Service > Title'),
            resumen: q('Service > Abstract'),
            capas: lista || null,
          };
        } catch (e) { meta = null; }
      }

      if (!meta) {
        return '<p class="ls-ficha-aviso">El documento no traía metadatos reconocibles.</p>';
      }

      const partes = [];
      if (meta.titulo) partes.push(`<p class="ls-ficha-doc-linea"><b>Título:</b> ${_escaparHtml(meta.titulo)}</p>`);
      if (meta.nombre) partes.push(`<p class="ls-ficha-doc-linea"><b>Nombre del servicio:</b> <code>${_escaparHtml(meta.nombre)}</code></p>`);
      if (meta.resumen) partes.push(`<p class="ls-ficha-doc-linea"><b>Resumen:</b> ${_escaparHtml(meta.resumen)}</p>`);
      if (meta.capas !== null) partes.push(`<p class="ls-ficha-doc-linea"><b>Capas publicadas:</b> ${meta.capas}</p>`);

      const volcado = texto.length > 12000 ? texto.slice(0, 12000) + '\n… (truncado)' : texto;
      partes.push(`<details class="ls-ficha-detalle"><summary>Ver el documento completo (${texto.length} caracteres)</summary>` +
        `<pre class="ls-ficha-pre">${_escaparHtml(volcado)}</pre></details>`);
      return partes.join('');
    }

    /** Cuántas capas publica un capabilities en JSON, contando los nodos con Name. */
    function _contarCapasJson(datos) {
      let total = 0;
      (function recorrer(nodo) {
        if (!nodo || typeof nodo !== 'object') return;
        if (Array.isArray(nodo)) { nodo.forEach(recorrer); return; }
        if (typeof nodo.Name === 'string') total += 1;
        Object.keys(nodo).forEach(function (k) { recorrer(nodo[k]); });
      })(datos);
      return total || null;
    }

    /** Escapa texto para que pueda ir dentro de HTML sin romperlo. */
    function _escaparHtml(texto) {
      return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /** Objeto global de la API (IDEE en builds modernas, M en las antiguas). */
    function apiIdee() {
      try {
        if (window.IDEE && (window.IDEE.map || window.IDEE.ui)) return window.IDEE;
        if (window.M && (window.M.map || window.M.ui)) return window.M;
      } catch (e) { /* nada */ }
      return window.IDEE || window.M || null;
    }

    // ── Redimensionar el panel desde el tirador ────────────────────────
    // Altura (px) elegida por el usuario; persiste entre aperturas del mismo
    // panel en esta sesion. null = usar la altura por defecto del CSS (60vh).
    let sheetHeight = null;

    function applySheetHeight(panel) {
      if (!panel || !sheetHeight) return;
      const maxH = window.innerHeight - 40; // dejar al menos 40px de mapa visible
      const minH = Math.round(window.innerHeight * 0.2);
      const h = Math.max(minH, Math.min(sheetHeight, maxH));
      panel.style.height = h + 'px';
    }

    // Conecta el arrastre sobre el tirador del panel para cambiar su altura.
    function enableSheetResize(panel) {
      const handle = panel.querySelector('.ls-sheet__handle');
      if (!handle) return;

      const maxH = () => window.innerHeight - 40; // minimo de mapa visible
      const minH = () => Math.round(window.innerHeight * 0.2); // 20% de alto

      function onDown(e) {
        e.preventDefault();
        handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        const startH = panel.getBoundingClientRect().height;
        // Durante el arrastre no animamos el cambio de altura (seria molesto).
        const prevTransition = panel.style.transition;
        panel.style.transition = 'none';
        // Mientras se arrastra, redimensiona con el CRECIMIENTO del panel hacia
        // arriba: arrastrar hacia arriba (clientY menor) AUMENTA la altura.
        function onMove(ev) {
          let h = startH + (startY - ev.clientY);
          h = Math.max(minH(), Math.min(h, maxH()));
          panel.style.height = h + 'px';
        }
        function onUp() {
          sheetHeight = panel.getBoundingClientRect().height;
          panel.style.transition = prevTransition;
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      }

      handle.addEventListener('pointerdown', onDown);
    }

    // ── Sincronia mapa -> tabla ────────────────────────────────────────
    // Mientras la tabla de atributos esta abierta, un clic en un feature del
    // mapa resalta la fila correspondiente de la tabla. Se resuelve el feature
    // pulsado con OpenLayers (forEachFeatureAtPixel) y se compara con los
    // features cacheados de la tabla (por referencia primero, y por concordancia
    // de geometria + primer atributo como comprobacion de robustez).
    function bindMapClick() {
      let impl = null;
      try { impl = map.getMapImpl ? map.getMapImpl() : null; } catch (e) { impl = null; }
      if (!impl || typeof impl.on !== 'function' || typeof impl.forEachFeatureAtPixel !== 'function') return;

      mapClickHandler = function (evt) {
        if (!sheetCtx || !sheetCtx.features.length) return;
        if (!evt || !evt.pixel) return;
        const pixel = evt.pixel;

        // Reunir los features bajo el cursor. layerFilter restringe a la capa
        // del selector (no a overlays temporales tipo el resaltado).
        let hit = [];
        try {
          impl.forEachFeatureAtPixel(pixel, function (feature) {
            hit.push(feature);
          }, {
            hitTolerance: 6,
            layerFilter: function (olLayer) {
              try {
                return sheetCtx.olLayer ? olLayer === sheetCtx.olLayer : true;
              } catch (e) { return true; }
            },
          });
        } catch (e) { hit = []; }
        if (!hit.length) return;

        // Intentar casar el feature pulsado con uno de la tabla.
        const target = hit[0];
        const matchedIdx = matchFeatureToTable(target);
        if (matchedIdx !== -1) {
          // sincronizar SIEMPRE la fila con el feature pulsado (sync mapa -> tabla).
          locateFeatureByIdx(matchedIdx, true);
        }
      };

      // Listener directo del OL impl (no de la fachada IDEE) para no
      // interferir con el resto de la aplicacion.
      impl.addEventListener('singleclick', mapClickHandler);
    }

    function unbindMapClick() {
      if (!mapClickHandler) return;
      let impl = null;
      try { impl = map.getMapImpl ? map.getMapImpl() : null; } catch (e) { impl = null; }
      if (impl && typeof impl.removeEventListener === 'function') {
        impl.removeEventListener('singleclick', mapClickHandler);
      }
      mapClickHandler = null;
    }

    // ── Refresco de la tabla al mover el mapa ───────────────────────────
    // Los features de estas capas salen del viewport: MapLibre los pide con
    // querySourceFeatures y una capa MVT se lee de las teselas de la vista, asi
    // que tabla y recuentos se quedan obsoletos en cuanto se desplaza o se hace
    // zoom. Se rehacen con un pequeño retardo para no repetir la consulta en
    // cada evento del arrastre.
    //
    // Ademas del cuerpo se refresca el SELECTOR de sub-capas: es el que dice
    // entre parentesis cuantas features hay de cada una en la vista, y hasta
    // ahora se quedaba con las cifras del momento de abrir el panel.
    //
    // Los eventos de la fachada (IDEE.evt.MOVE/CHANGE) no se disparan al mover
    // (medido), asi que se escucha a la implementacion: `moveend` en el mapa de
    // OpenLayers y `scene.camera.moveEnd` en Cesium.
    function refreshSubLayerTable() {
      const ctx = mlTableCtx;
      if (!ctx || !ctx.body || !document.body.contains(ctx.body)) return;
      if (!ctx.provider || !ctx.provider.disponible()) return;
      const html = ctx.provider.buildTable(ctx.sourceId, ctx.sourceLayer);
      if (typeof html === 'string') {
        ctx.body.innerHTML = html;
      } else if (html && typeof html.then === 'function') {
        html.then(function (h) {
          // La tabla puede haberse cerrado mientras se leian las teselas.
          if (mlTableCtx === ctx && document.body.contains(ctx.body)) ctx.body.innerHTML = h;
        }).catch(function () { /* se queda lo que hubiera */ });
      }
      actualizarConteosSubCapas(ctx);

      // MapLibre necesita un segundo pase: `moveend` llega antes de que el
      // mapa haya cargado las teselas de la vista nueva, y querySourceFeatures
      // solo ve las cargadas. Si aun no estan, se rehace una vez mas (con tope)
      // cuando deberian estarlo; si no, se quedarian cifras parciales hasta el
      // siguiente movimiento.
      if (ctx.layer && isMapLibreLayer(ctx.layer)) {
        const ml = getMapLibreMap(ctx.layer);
        const sinCargar = ml && typeof ml.areTilesLoaded === 'function' && !ml.areTilesLoaded();
        if (sinCargar && (ctx.reintentos || 0) < 2) {
          ctx.reintentos = (ctx.reintentos || 0) + 1;
          if (sheetMoveTimer2) clearTimeout(sheetMoveTimer2);
          sheetMoveTimer2 = setTimeout(function () {
            sheetMoveTimer2 = null;
            refreshSubLayerTable();
          }, 900);
        } else {
          ctx.reintentos = 0;
        }
      }
    }

    // Reevalua cuantas features hay de cada sub-capa en la vista y reescribe
    // SOLO el texto de las opciones del selector. Cambiar `textContent` no
    // dispara su `change`, asi que la sub-capa elegida y la tabla que se esta
    // viendo no se mueven.
    function actualizarConteosSubCapas(ctx) {
      const picker = ctx.picker;
      if (!picker || !ctx.provider || !document.body.contains(picker)) return;
      let conteos = null;
      try { conteos = ctx.provider.counts(picker); } catch (e) { conteos = null; }
      if (!conteos) return;
      Promise.resolve(conteos).then(function (valores) {
        if (!valores || !document.body.contains(picker)) return;
        for (let i = 0; i < picker.options.length; i++) {
          const opcion = picker.options[i];
          if (!opcion.value) continue;
          const n = valores[opcion.value];
          if (n === undefined) continue;
          // El nombre se guarda la primera vez: reescribir el texto no puede
          // comerse el paréntesis anterior.
          let nombre = opcion.getAttribute('data-nombre');
          if (nombre === null) {
            nombre = opcion.textContent.replace(/\s*\(\d[\d.]*\)\s*$/, '');
            opcion.setAttribute('data-nombre', nombre);
          }
          opcion.textContent = nombre + (n > 0 ? ' (' + n + ')' : '');
        }
      }).catch(function () { /* sin cifras nuevas: se quedan las anteriores */ });
    }

    function unbindSheetMove() {
      if (sheetMoveTimer) { clearTimeout(sheetMoveTimer); sheetMoveTimer = null; }
      if (sheetMoveTimer2) { clearTimeout(sheetMoveTimer2); sheetMoveTimer2 = null; }
      if (!sheetMoveCleanup) return;
      try { sheetMoveCleanup(); } catch (e) { /* ignorar */ }
      sheetMoveCleanup = null;
    }

    function bindSheetMove() {
      unbindSheetMove();
      let impl = null;
      try { impl = map.getMapImpl ? map.getMapImpl() : null; } catch (e) { impl = null; }
      if (!impl) return;

      const disparar = function () {
        // Al pulsar una fila, la propia tabla mueve el mapa para encuadrar el
        // feature: ese movimiento no debe rehacer la tabla (se perderia la fila
        // resaltada y la lista que el usuario esta mirando). Se ignora el
        // primero que llegue, y solo si es reciente.
        const ctx = mlTableCtx;
        if (ctx && ctx.ignorarMovimiento) {
          const desde = ctx.ignorarMovimiento;
          ctx.ignorarMovimiento = 0;
          if (Date.now() - desde < 6000) return;
        }
        if (sheetMoveTimer) clearTimeout(sheetMoveTimer);
        sheetMoveTimer = setTimeout(function () {
          sheetMoveTimer = null;
          refreshSubLayerTable();
        }, 300);
      };

      try {
        if (impl.scene && impl.scene.camera && impl.scene.camera.moveEnd) {
          const camara = impl.scene.camera;
          camara.moveEnd.addEventListener(disparar);
          sheetMoveCleanup = function () { camara.moveEnd.removeEventListener(disparar); };
        } else if (typeof impl.on === 'function') {
          impl.on('moveend', disparar);
          sheetMoveCleanup = function () { impl.un('moveend', disparar); };
        }
      } catch (e) { sheetMoveCleanup = null; }
    }

    // Compara un feature del mapa (OL) con los features cacheados de la tabla.
    // 1) Por referencia (los objetos suelen ser los mismos). 2) Fallback:
    // concordancia de la geometria (extent) y del primer atributo no vacio.
    function matchFeatureToTable(target) {
      const feats = sheetCtx.features;
      for (let i = 0; i < feats.length; i++) {
        // Coincidencia directa y, si la fila agrupa varias partes (tesela
        // troceada), cualquiera de esas partes vale.
        if (feats[i].feature === target) return i;
        if (feats[i].partes && feats[i].partes.indexOf(target) !== -1) return i;
      }
      // Fallback por geometria/atributos (referencias distintas).
      let tGeom = null, tExt = null, tProp = null;
      try { tGeom = (target.getGeometry ? target.getGeometry() : null); } catch (e) { tGeom = null; }
      try { tExt = tGeom && tGeom.getExtent ? tGeom.getExtent() : null; } catch (e) { tExt = null; }
      try {
        const p = (target.getProperties ? target.getProperties() : null) ||
                  (target.getAttributes ? target.getAttributes() : null);
        if (p) { for (const k in p) { if (p[k] !== undefined && p[k] !== null && p[k] !== '') { tProp = p[k]; break; } } }
      } catch (e) { /* ignorar */ }

      for (let i = 0; i < feats.length; i++) {
        const c = feats[i];
        // Geometria coincidente.
        if (tExt && c.extent) {
          const close = Math.abs(tExt[0] - c.extent[0]) < 1e-6 &&
                        Math.abs(tExt[1] - c.extent[1]) < 1e-6 &&
                        Math.abs(tExt[2] - c.extent[2]) < 1e-6 &&
                        Math.abs(tExt[3] - c.extent[3]) < 1e-6;
          if (close) {
            // Si hay atributo coincidente, reforzamos; si no, aun asi ok.
            if (tProp === undefined || tProp === null || c.firstProp === undefined || c.firstProp === null) return i;
            if (String(tProp) === String(c.firstProp)) return i;
          }
        }
      }
      return -1;
    }

    // ── Resaltado del feature seleccionado en el mapa ──────────────────
    // Crea (una sola vez) una capa vectorial temporal y la popola con la
    // geometria del feature resaltado. Se añade por encima de todas las capas.
    function clearHighlight() {
      if (selLayer && map) {
        try {
          map.removeLayers(selLayer);
          selLayer = null;
        } catch (e) {
          selLayer = null;
        }
      }
      highlightRow(-1);
    }

    // Localiza un feature concreto (por indice de fila) en el mapa: centra la
    // vista en su geometria y lo resalta. Marca siempre su fila como activa,
    // tanto si la peticion viene de la tabla (clic en fila) como del mapa
    // (clic en el feature), manteniendo la sincronia bidireccional.
    /**
     * Lleva la camara de Cesium hasta el feature (implementacion 3D).
     *
     * POR QUE HACE FALTA UNA RAMA PROPIA: en 3D la geometria no es un objeto de
     * OpenLayers, asi que no tiene `getExtent()`, y `impl.getView()` tampoco
     * existe. Medido: sin esto, al pulsar una fila de la tabla de atributos en 3D
     * la camara no iba al feature y se quedaba haciendo un zoom atras.
     *
     * De donde sale el punto: `feature.getGeoJSON()`, que en 3D devuelve las
     * coordenadas YA en 4326 con la altura (medido: [-8.903, 43.294, 0]),
     * mientras que en 2D las devuelve en 3857. Como aqui solo se usa la rama 3D,
     * no hay que reproyectar nada.
     *
     * Se conservan el rumbo y la inclinacion que tuviera la camara (igual que
     * haria un `setCenter` de OpenLayers), pero con una altura minima: si el
     * usuario esta casi a ras de suelo, moverse a la altura actual lo dejaria
     * dentro del terreno y se veria en negro.
     *
     * @param {Object} item Elemento de `sheetCtx.features` (con .feature).
     * @param {Object} escena Escena de Cesium.
     */
    function irAFeatureEn3D(item, escena) {
      const C = window.Cesium;
      const camara = escena && escena.camera;
      if (!C || !C.Cartesian3 || !C.Math || !camara) return;
      let coord = null;
      try {
        const gj = (item && item.feature && typeof item.feature.getGeoJSON === 'function')
          ? item.feature.getGeoJSON()
          : null;
        if (gj && gj.geometry && gj.geometry.coordinates) coord = gj.geometry.coordinates;
      } catch (e) { coord = null; }
      // Los features que construye el selector para las sub-capas de MapLibre y
      // MVT son features de OpenLayers: no tienen `getGeoJSON`, pero su
      // geometria esta en 3857 y su extent da el centro para llevar la camara.
      if (!coord) {
        try {
          const geom = item && item.geometry;
          const ext = geom && geom.getExtent ? geom.getExtent() : null;
          if (ext) {
            const centro = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
            let ll = null;
            if (window.IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function') {
              ll = IDEE.utils.reproject(centro, 'EPSG:3857', 'EPSG:4326');
            } else if (window.ol && window.ol.proj && window.ol.proj.toLonLat) {
              ll = window.ol.proj.toLonLat(centro);
            }
            if (ll && isFinite(ll[0]) && isFinite(ll[1])) coord = ll;
          }
        } catch (e) { /* se queda sin coordenada */ }
      }
      // Un Point viene como [lon, lat, alt]; una linea o un poligono, anidados.
      while (Array.isArray(coord) && Array.isArray(coord[0])) coord = coord[0];
      if (!coord || !isFinite(coord[0]) || !isFinite(coord[1])) return;
      const ALTURA_MINIMA = 1500;
      let altura = 0;
      try { altura = camara.positionCartographic ? camara.positionCartographic.height : 0; } catch (e) { altura = 0; }
      if (!isFinite(altura) || altura < ALTURA_MINIMA) altura = ALTURA_MINIMA;
      try {
        camara.setView({
          destination: C.Cartesian3.fromDegrees(coord[0], coord[1], altura),
          orientation: { heading: camara.heading, pitch: camara.pitch, roll: 0 },
        });
      } catch (e) { /* la camara puede no estar lista todavia */ }
    }

    function locateFeatureByIdx(idx) {
      if (!sheetCtx || !sheetCtx.features.length) return;
      const item = sheetCtx.features[idx];
      if (!item) return;
      const geom = item.geometry;
      if (!geom) return;

      // Marca para que el refresco automatico de la tabla no confunda este
      // movimiento (provocado por la propia fila) con un desplazamiento del
      // usuario. Ver bindSheetMove.
      if (mlTableCtx) mlTableCtx.ignorarMovimiento = Date.now();

      // Encuadrar / centrar la vista sobre la geometria.
      let center = null, extent = null;
      try { extent = geom.getExtent ? geom.getExtent() : null; } catch (e) { extent = null; }
      try { if (extent) center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]; } catch (e) { /* ignorar */ }

      const impl = map.getMapImpl ? map.getMapImpl() : null;
      // El impl de Cesium tiene `scene` y no `getView()`: es lo que distingue una
      // implementacion de otra sin preguntar por la version de la API.
      const escena = (impl && impl.scene) ? impl.scene : null;
      const view = (impl && typeof impl.getView === 'function') ? impl.getView() : null;
      if (escena && escena.camera) {
        irAFeatureEn3D(item, escena);
      } else if (view && typeof view.fit === 'function' && extent) {
        // El panel de la tabla ocupa la parte de abajo del mapa: si se encuadra
        // a pelo, el feature queda justo detras de la hoja. Se le pasa su alto
        // como padding inferior (con tope, para no alejar la vista en exceso).
        let padAbajo = 40;
        try {
          const hoja = document.querySelector('.ls-sheet');
          if (hoja) {
            padAbajo = Math.round(hoja.getBoundingClientRect().height) + 24;
            padAbajo = Math.max(40, Math.min(padAbajo, Math.round(window.innerHeight * 0.55)));
          }
        } catch (e) { padAbajo = 40; }
        try { view.fit(extent, { padding: [40, 40, padAbajo, 40], maxZoom: 14 }); } catch (e) { /* ignorar */ }
      } else if (view && center) {
        try { view.setCenter(center); } catch (e) { /* ignorar */ }
      } else if (!view) {
        try {
          if (extent && typeof map.setBbox === 'function') map.setBbox(extent);
          else if (center && typeof map.setCenter === 'function') map.setCenter({ x: center[0], y: center[1] });
          if (typeof map.setZoom === 'function') {
            const z = (typeof map.getZoom === 'function') ? map.getZoom() : undefined;
            if (z !== undefined) map.setZoom(Math.min(z + 1, 14));
          }
        } catch (e) { /* ignorar */ }
      }

      // Montar la capa de resaltado con la feature cacheada. Se usa el estilo
      // generico de API-IDEE (funciona en la implementacion OpenLayers 2D y en
      // la de Cesium 3D, que es como el resto del plugin dibuja sus features).
      clearHighlight();
      try {
        const style = new IDEE.style.Generic({
          stroke: { color: '#ffd400', width: 5 },
          fill: { color: '#ffd400', opacity: 0 },
          point: { radius: 8, fill: { color: '#ffd400', opacity: 0 }, stroke: { color: '#ffd400', width: 5 } },
        });
        selLayer = new IDEE.layer.Vector(
          {
            name: 'layerSwitcher_highlight',
            displayInLayerSwitcher: false,
            source: { features: [item.feature] },
            style: style,
          },
          // Las opciones del impl (2º argumento) gobiernan el layerSwitcher:
          // al poner displayInLayerSwitcher:false aqui la capa temporal NO
          // aparece en el listado de capas del plugin.
          { displayInLayerSwitcher: false }
        );
        // Refuerzo: Mapea tambien registra la capa OpenLayers interna. Forzamos
        // alli el mismo flag para que ninguna implementacion (lista custom o el
        // selector nativo de Mapea) muestre esta capa temporal como layer_<ts>.
        try {
          const olLayer = selLayer.getImpl && selLayer.getImpl().olLayer;
          if (olLayer && typeof olLayer.set === 'function') {
            olLayer.set('displayInLayerSwitcher', false);
          }
        } catch (e) { /* defensivo */ }
        map.addLayers(selLayer);
        // IMPORTANTE: ni el 1er argumento (source.features) ni addFeatures() de
        // la fachada pueblan la fuente OpenLayers que realmente renderiza el
        // mapa (la dejan vacia y el resaltado no se veria). Se inserta el
        // feature cacheado directamente en la fuente OpenLayers cuando existe.
        // Cada operacion va en su PROPIO try/catch: addFeatures de la fachada
        // puede lanzar (espera features con .getImpl(), y las de MapLibre —
        // convertidas desde querySourceFeatures — no lo tienen), y ese fallo no
        // debe impedir la propagacion a la fuente OpenLayers nativa.
        try {
          if (typeof selLayer.addFeatures === 'function' && item.feature) {
            selLayer.addFeatures([item.feature]);
          }
        } catch (e) { /* addFeatures de la fachada no critico: seguir */ }
        // Propaga el feature a la fuente OpenLayers nativa (la que dibuja).
        try {
          const olLayer = selLayer.getImpl && selLayer.getImpl().olLayer;
          const olSource = olLayer && olLayer.getSource ? olLayer.getSource() : null;
          if (olSource && typeof olSource.addFeature === 'function' && item.feature) {
            const feats = typeof olSource.getFeatures === 'function' ? olSource.getFeatures() : [];
            if (!feats.some(function (f) { return f === item.feature; })) {
              olSource.addFeature(item.feature);
            }
          }
        } catch (e) { /* defensivo */ }
        // Refresca el listado del selector para que la capa temporal (oculta
        // con displayInLayerSwitcher:false) ya no aparezca entre las capas.
        renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo resaltar el feature', e);
      }

      highlightRow(idx);
    }

    // Api publica: localiza el feature de la fila en el mapa (tabla -> mapa).
    window.locateFeature = function (index, rowIdx) {
      const idx = Math.max(0, Number(rowIdx) || 0);
      // Si la tabla actual pertenece a esta capa y ya tenemos features cacheados.
      if (sheetCtx && String(sheetCtx.layerId) === String(index) && sheetCtx.features.length) {
        locateFeatureByIdx(idx, true);
        return;
      }
      // Fallback: recuperar features de la capa al vuelo.
      const layer = findLayerById(index);
      if (!layer) return;
      let features = [];
      try {
        if (typeof layer.getFeatures === 'function') features = layer.getFeatures() || [];
        else if (layer.getImpl() && typeof layer.getImpl().getFeatures === 'function') features = layer.getImpl().getFeatures() || [];
      } catch (e) { features = []; }
      if (!features.length) return;
      const f = features[Math.min(idx, features.length - 1)];
      let geom = null;
      try { geom = (f.getGeometry ? f.getGeometry() : null) || (f.getImpl && f.getImpl().getGeometry ? f.getImpl().getGeometry() : null); } catch (e) { geom = null; }
      if (!geom) return;
      const item = { feature: f, geometry: geom, extent: (geom.getExtent ? geom.getExtent() : null) };
      const prevCtx = sheetCtx;
      sheetCtx = { layerId: index, features: [item], firstProp: '' };
      locateFeatureByIdx(0, true);
      sheetCtx = prevCtx;
    };

    // Escapa texto plano para inyectarlo sin riesgo en el HTML del panel.
    function esc(v) {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* Texto de una celda de la tabla de atributos. Un valor objeto (algunos
       servicios devuelven la geometria dentro de las propiedades) se pinta como
       JSON corto en vez del "[object Object]" de String(). */
    function textoCelda(v) {
      if (v === null || v === undefined) return '';
      if (typeof v !== 'object') return String(v);
      try {
        const texto = JSON.stringify(v);
        if (!texto) return '';
        return (texto.length > 60) ? texto.slice(0, 59) + '…' : texto;
      } catch (e) { return ''; }
    }

    // ── Objetos geográficos: barra, límite y paginado ───────────────────
    // La barra va sobre la tabla de atributos de las capas WFS y OGC API
    // Features: qué se pide al servicio ("Todas" o "La vista"), cuántos
    // objetos por página (límite, 100 por defecto) y el paginado. El paginado
    // se resuelve EN EL SERVIDOR (startIndex/count en WFS, offset y limit en
    // OGC API Features), así que el mapa y la tabla muestran siempre la misma
    // página de objetos. El trabajo lo hace miPlugin_bboxFeatures
    // (ext/bboxFeatures/bboxFeatures.js) a través de window.miBBoxFeatures.
    let sheetVectorLayer = null;
    let fichaVectorLayer = null;
    // Cancelador de la captura de punto/rectángulo que pueda estar activa
    // desde el editor de la ficha. Se guarda aquí para poder soltarla al
    // cerrar el modal o al cambiar de acción.
    let _cancelarPickFicha = null;
    let sheetReloadCleanup = null;
    let sheetReloadTimer = null;

    /**
     * HTML de la barra de objetos geográficos de una capa, o '' si la capa no
     * sabe pedirse por páginas (WMS, GeoJSON...) o si la extensión no está.
     * @param {Object} layer Capa de la API-IDEE.
     * @returns {string}
     */
    function barraObjetos(layer) {
      const api = window.miBBoxFeatures;
      if (!layer || !api || typeof api.getEstado !== 'function') return '';
      let soporta = false;
      try { soporta = typeof api.soporta === 'function' && api.soporta(layer); } catch (e) { soporta = false; }
      if (!soporta) return '';
      let estado = null;
      try { estado = api.getEstado(layer); } catch (e) { estado = null; }
      if (!estado) return '';
      let limites = [25, 50, 100, 200, 500];
      try {
        if (typeof api.limites === 'function') limites = api.limites() || limites;
      } catch (e) { /* los de por defecto */ }
      const id = String(layer.idLayer);
      const opciones = limites.map(n =>
        `<option value="${n}" ${Number(n) === Number(estado.limite) ? 'selected' : ''}>${n}</option>`).join('');
      // FlatGeobuf y GeoParquet no se pagan: solo tiene sentido elegir entre
      // "Todas" y "La vista". El límite y las páginas se ocultan.
      const controles = (estado.paginable === false) ? '' : `
          <label class="ls-objetos__limite" title="Objetos geográficos que se piden de cada vez">
            Límite
            <select onchange="setBBoxLimite('${id}', this.value)" aria-label="Objetos geográficos por página">${opciones}</select>
          </label>
          <span class="ls-objetos__pager">
            <button type="button" class="ls-objetos__pagina-btn" ${estado.hayAnterior ? '' : 'disabled'} title="Página anterior" onclick="setBBoxPagina('${id}', ${estado.pagina - 1})">‹</button>
            <span class="ls-objetos__pagina" title="El servicio no informa del total de páginas: hay siguiente mientras la página venga completa">Página ${estado.pagina}</span>
            <button type="button" class="ls-objetos__pagina-btn" ${estado.haySiguiente ? '' : 'disabled'} title="Página siguiente" onclick="setBBoxPagina('${id}', ${estado.pagina + 1})">›</button>
          </span>`;
      return `
        <div class="ls-objetos">
          <span class="ls-objetos__titulo" title="Qué objetos geográficos se piden al servicio, cuántos por página y en qué página">Objetos geográficos</span>
          <div class="ls-objetos__modo" role="group" aria-label="Objetos geográficos que se piden al servicio">
            <button type="button" class="ls-objetos__btn ${estado.modo === 'todas' ? 'ls-objetos__btn-on' : ''}" aria-pressed="${estado.modo === 'todas' ? 'true' : 'false'}" title="Pedir la primera página de todos los objetos de la capa (una sola petición)" onclick="setBBoxModo('${id}', 'todas')">Todas</button>
            <button type="button" class="ls-objetos__btn ${estado.modo === 'vista' ? 'ls-objetos__btn-on' : ''}" aria-pressed="${estado.modo === 'vista' ? 'true' : 'false'}" title="Pedir la primera página de los objetos de la vista y renovarla al mover el mapa (BBOX)" onclick="setBBoxModo('${id}', 'vista')">La vista</button>
          </div>${controles}
        </div>`;
    }

    /**
     * Cuerpo de la hoja de una capa vectorial: la barra de objetos (si la capa
     * se pagina en el servidor) y la tabla. Se envuelve en un div propio para
     * poder rehacer SOLO esto cuando la capa recarga.
     * @param {Object} layer Capa de la API-IDEE.
     * @returns {string}
     */
    function cuerpoTablaVector(layer) {
      return `<div class="ls-sheet-objetos-wrap">${buildVectorTable(layer)}</div>`;
    }

    /**
     * Vuelve a pintar la barra y la tabla de la hoja abierta. Se llama al
     * cambiar modo, límite o página (para no esperar a la respuesta) y cada
     * vez que la capa termina de cargar.
     * @param {Object} layer Capa de la API-IDEE.
     */
    function refrescarBarraObjetos(layer) {
      const overlay = document.getElementById(SHEET_OVERLAY_ID);
      if (!overlay || !layer || !sheetVectorLayer) return;
      if (String(sheetVectorLayer.idLayer) !== String(layer.idLayer)) return;
      const wrap = overlay.querySelector('.ls-sheet-objetos-wrap');
      if (!wrap) return;
      wrap.innerHTML = buildVectorTable(layer);
    }

    /**
     * Vuelve a pintar la barra de objetos geográficos de la ficha abierta
     * (si la capa que la originó es la que se está refrescando).
     */
    function refrescarBarraObjetosFicha(layer) {
      if (!layer || !fichaVectorLayer) return;
      if (String(fichaVectorLayer.idLayer) !== String(layer.idLayer)) return;
      const wrap = document.querySelector('.ls-ficha-objetos-wrap');
      if (!wrap) return;
      wrap.innerHTML = barraObjetos(layer);
    }

    /**
     * Rehace la tabla cuando la capa termina de cargar (evento `LOAD`): es lo
     * que mantiene la tabla y el mapa con la misma página de objetos cuando la
     * capa se recarga (cambio de modo, de límite, de página o movimiento del
     * mapa en "la vista"). Se escucha en el impl y en la fachada porque en 3D
     * el evento lo dispara la fachada y en 2D el impl.
     * @param {Object} layer Capa de la API-IDEE.
     */
    function bindSheetReload(layer) {
      unbindSheetReload();
      sheetVectorLayer = layer || null;
      if (!layer) return;
      const avisar = function () {
        if (sheetReloadTimer) clearTimeout(sheetReloadTimer);
        sheetReloadTimer = setTimeout(function () {
          sheetReloadTimer = null;
          refrescarBarraObjetos(layer);
        }, 150);
      };
      const sueltas = [];
      const EVENTO = (window.IDEE && IDEE.evt && IDEE.evt.LOAD) || 'load';
      try {
        const impl = layer.getImpl ? layer.getImpl() : null;
        if (impl && typeof impl.on === 'function') {
          impl.on(EVENTO, avisar);
          sueltas.push(function () { try { impl.un(EVENTO, avisar); } catch (e) { /* ya no existe */ } });
        }
      } catch (e) { /* la capa no deja escuchar */ }
      try {
        if (typeof layer.on === 'function') {
          layer.on(EVENTO, avisar);
          sueltas.push(function () { try { layer.un(EVENTO, avisar); } catch (e) { /* ya no existe */ } });
        }
      } catch (e) { /* la fachada no deja escuchar */ }
      sheetReloadCleanup = function () {
        for (let i = 0; i < sueltas.length; i += 1) {
          try { sueltas[i](); } catch (e) { /* nada */ }
        }
      };
    }

    /** Suelta la escucha de recarga de la tabla y su temporizador. */
    function unbindSheetReload() {
      if (sheetReloadCleanup) {
        try { sheetReloadCleanup(); } catch (e) { /* nada */ }
      }
      sheetReloadCleanup = null;
      if (sheetReloadTimer) {
        clearTimeout(sheetReloadTimer);
        sheetReloadTimer = null;
      }
      sheetVectorLayer = null;
    }

    // ── Tabla de atributos de capa VECTORIAL ───────────────────────────
    function buildVectorTable(layer) {
      // Referencia a la capa OpenLayers que realmente dibuja los features.
      // Sus features de la fuente exponen geometrias y propiedades OL reales
      // (getGeometry().getType(), getExtent(), getProperties()) y son los MISMOS
      // objetos que devuelve forEachFeatureAtPixel, lo que permite casar por
      // referencia en la sincronia mapa->tabla.
      let olLayer = null;
      try {
        olLayer = (layer.getOLayer && layer.getOLayer()) ||
                  (layer.getImpl && layer.getImpl().getOLayer && layer.getImpl().getOLayer()) ||
                  (layer.getImpl && layer.getImpl().getLayer && layer.getImpl().getLayer()) ||
                  (layer.getImpl && layer.getImpl().layer) ||
                  (layer.getImpl && layer.getImpl().olLayer) || null;
      } catch (e) { olLayer = null; }

      let features = [];
      // 1) Preferencia: features reales de la fuente OpenLayers (geometrias OL
      //    con getType/getExtent validos y getProperties()), que garantizan el
      //    encuadre y el resaltado.
      try {
        if (olLayer && olLayer.getSource && typeof olLayer.getSource().getFeatures === 'function') {
          features = olLayer.getSource().getFeatures() || [];
        }
      } catch (e) { features = []; }

      // 2) Fallback: features de la capa IDEE (getFeatures() / getImpl). Pueden
      //    no exponer geometrias OL completas, pero aun asi permiten la tabla.
      if (!features.length) {
        try {
          if (typeof layer.getFeatures === 'function') features = layer.getFeatures() || [];
          else if (layer.getImpl() && typeof layer.getImpl().getFeatures === 'function') features = layer.getImpl().getFeatures() || [];
        } catch (e) { features = []; }
      }

      // Nombre de la capa.
      const layerName = layer.legend || layer.name || 'Capa';
      const featCount = features.length;
      if (!featCount) {
        sheetCtx = null;
        // En las capas que se piden por páginas (WFS y OGC API Features) el
        // vacío puede ser la página siguiente que ya no tiene objetos: se
        // avisa de eso, que es lo normal al pasarse con el paginado.
        let paginada = false;
        try {
          paginada = !!(window.miBBoxFeatures && window.miBBoxFeatures.soporta && window.miBBoxFeatures.soporta(layer));
        } catch (e) { paginada = false; }
        if (paginada) {
          return `<p class="ls-sheet-note">La capa <b>${esc(layerName)}</b> no tiene objetos geográficos en esta petición: el servicio no ha devuelto ninguno para esta página o esta extensión.</p>`;
        }
        return `<p style="padding:8px;color:#555;">La capa <b>${esc(layerName)}</b> no tiene features disponibles en el cliente (los datos pueden cargarse de forma remota).</p>`;
      }

      // Reunir el conjunto de columnas a partir de los atributos.
      // Los features OL exponen getProperties(); los de API-IDEE, getAttributes().
      // Las claves que empiezan por "_" son metadatos que pone la propia capa
      // (no atributos del dato) y no se pintan como columna.
      const esMetadato = (clave) => typeof clave === 'string' && clave.charAt(0) === '_';
      // Clave con la que una capa puede declarar que VARIAS features son en
      // realidad un solo elemento. La usa el georreferenciador de teselas: una
      // tesela grande se trocea en N franjas de relleno + 1 contorno + 1 punto
      // de etiqueta, y sin agrupar la tabla mostraba una fila por cada trozo.
      // Ver CLAVE_GRUPO_TESELA en ext/georrefTeselas/georrefTeselas.js.
      const CLAVE_GRUPO = '_grupo';
      // Peso de una geometria para elegir la representativa del grupo. El
      // contorno (LineString) representa la tesela entera mejor que una franja
      // suelta, asi que se prefiere para centrar/resaltar al pulsar la fila.
      const pesoGeometria = (geom) => {
        let tipo = '';
        try { tipo = (geom && geom.getType) ? String(geom.getType()) : ''; } catch (e) { tipo = ''; }
        if (/LineString/i.test(tipo)) return 3;
        if (/Polygon/i.test(tipo)) return 2;
        if (/Point/i.test(tipo)) return 1;
        return 0;
      };
      const columns = [];
      const rows = [];
      const rowsPorGrupo = Object.create(null);
      features.slice(0, 500).forEach(f => {
        let props = {};
        try {
          props = (f.getProperties ? f.getProperties() : null) ||
                  (f.getAttributes ? f.getAttributes() : null) || {};
        } catch (e) { /* sin atributos */ }
        if (typeof props !== 'object' || props === null) props = {};
        const geom = (f.getGeometry ? f.getGeometry() : null);
        for (const key in props) {
          if (esMetadato(key) || columns.includes(key)) continue;
          // Los valores objeto (algunos servicios devuelven la geometria dentro
          // de las propiedades) no son atributos de la tabla: se omiten para no
          // llenar la columna de JSON.
          if (props[key] !== null && typeof props[key] === 'object') continue;
          columns.push(key);
        }
        const valorGrupo = props[CLAVE_GRUPO];
        const grupo = (valorGrupo === undefined || valorGrupo === null || valorGrupo === '')
          ? null : String(valorGrupo);
        // Si el grupo ya tiene fila, esta feature es otra parte del mismo
        // elemento: se acumula (no genera fila propia).
        if (grupo && rowsPorGrupo[grupo]) {
          const acumulada = rowsPorGrupo[grupo];
          acumulada.features.push(f);
          if (pesoGeometria(geom) > pesoGeometria(acumulada.geom)) acumulada.geom = geom;
          return;
        }
        const row = { props, geom, feature: f, features: [f] };
        if (grupo) rowsPorGrupo[grupo] = row;
        rows.push(row);
      });

      // Asegurar columnas utiles aunque no haya propiedades.
      if (!columns.length) columns.push('(sin atributos)');

      // Cachear los features (orden = filas de la tabla) para la sincronia
      // bidireccional tabla<->mapa. Se almacena la geometria OL (si existe) y
      // el primer atributo no vacio para poder casar un feature del mapa.
      // `partes` son todas las features que resume la fila (una sola cuando la
      // capa no agrupa), para que el clic en cualquiera de ellas resalte la
      // fila correcta en el sentido mapa->tabla.
      const cached = rows.map((row, i) => {
        let extent = null;
        try { extent = row.geom && row.geom.getExtent ? row.geom.getExtent() : null; } catch (e) { extent = null; }
        let firstProp = null;
        for (const c of columns) {
          const v = row.props[c];
          if (v !== undefined && v !== null && v !== '' && c !== '(sin atributos)') { firstProp = v; break; }
        }
        return { feature: row.feature, geometry: row.geom, extent, firstProp, idx: i, partes: row.features };
      });
      sheetCtx = {
        layerId: layer.idLayer,
        features: cached,
        olLayer: olLayer,
      };

      // idLayer necesario para localizar el feature en el mapa al pulsar la fila.
      const layerId = (typeof layer.idLayer !== 'undefined') ? layer.idLayer : '';

      let html = `<table class="ls-attr-table"><thead><tr>`;
      html += `<th>#</th>`;
      for (const c of columns) html += `<th>${esc(c)}</th>`;
      html += `</tr></thead><tbody>`;
      rows.forEach((row, i) => {
        // Cada fila es clicable: localiza y resalta el feature en el mapa.
        html += `<tr class="ls-clickable" data-row-idx="${i}" title="Localizar este elemento en el mapa" onclick="locateFeature('${layerId}', '${i}')">`;
        html += `<td>${i + 1}</td>`;
        for (const c of columns) {
          const v = row.props[c];
          const txt = (v === undefined)
            ? ((c === '(sin atributos)' && row.props) ? '—' : '')
            : textoCelda(v);
          html += `<td>${esc(txt)}</td>`;
        }
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      const shown = rows.length;
      // Nota informativa: si la capa agrupa partes, el numero de filas no
      // coincide con el de features de la capa (una tesela troceada son varias
      // features en una sola fila); se indican las dos cifras.
      let nota = `${shown} ${shown === 1 ? 'elemento' : 'elementos'} (${columns.length} ${columns.length === 1 ? 'atributo' : 'atributos'})`;
      if (featCount !== shown) nota += ` a partir de ${featCount} features`;
      if (featCount > shown && featCount > 500) nota += `; solo se inspeccionan las 500 primeras`;
      return `<p class="ls-sheet-note">${nota}.</p>${html}`;
    }

    // ── Capas MapLibre / vector-tiles (p.ej. BTN) ─────────────────────
    // Estas capas NO almacenan sus features en una fuente OpenLayers (como
    // GeoJSON/WFS): se renderizan desde tiles vectoriales MapLibre y los
    // features solo estan disponibles (via querySourceFeatures) para las
    // tiles que caen dentro del viewport actual del mapa. Por eso no se puede
    // mostrar una "tabla con todos los features" de golpe; en su lugar se
    // listan las SUB-CAPAS GL del estilo (sus "source-layers") y, al elegir
    // una, se muestran los atributos de los features presentes en la vista.
    function getMapLibreMap(layer) {
      try {
        const impl = layer.getImpl ? layer.getImpl() : null;
        if (!impl) return null;
        // 2D: la implementacion de OpenLayers deja la instancia de MapLibre GL
        // dentro del `olLayer` que pinta las teselas.
        const ol = impl.olLayer;
        if (ol && ol.mapLibreMap) return ol.mapLibreMap;
        // 3D: ext/maplibreLayer drapea su propio lienzo de MapLibre sobre el
        // globo y lo guarda en `mapLibre_`. Sin esta rama la capa no se
        // reconocia como MapLibre y la tabla caia en la rama vectorial
        // (medido con la BTN: 500 filas con la columna "(sin atributos)").
        // El estilo se lee igual en las dos implementaciones.
        if (impl.mapLibre_ && typeof impl.mapLibre_.getStyle === 'function') return impl.mapLibre_;
      } catch (e) { /* no es MapLibre */ }
      return null;
    }

    // Detecta si una capa es de tiles vectoriales MapLibre (dos pasos:
    // tipo de capa y presencia de una instancia maplibre con estilo).
    function isMapLibreLayer(layer) {
      const t = String(layer.type || layer._type || '').toLowerCase();
      if (!(t === 'maplibre' || t === 'mapbox')) return false;
      const ml = getMapLibreMap(layer);
      return !!ml && typeof ml.getStyle === 'function';
    }

    // Espera (con tope) a que el estilo MapLibre este cargado por completo.
    // El estilo de BTN es enorme (>300 capas) y tarda en cargarse.
    function awaitMapLibreStyle(ml, ms) {
      return new Promise(function (resolve) {
        const deadline = Date.now() + (ms || 12000);
        const poll = function () {
          const ready = (function () {
            try {
              const style = ml.getStyle();
              return !!(style && Array.isArray(style.layers) && style.layers.length && style.sources);
            } catch (e) { return false; }
          })();
          if (ready || Date.now() > deadline) return resolve(ready || false);
          setTimeout(poll, 400);
        };
        poll();
      });
    }

    // Devuelve un OL Feature (geometrias OL con getExtent/getType) a partir de
    // un feature GeoJSON devuelto por querySourceFeatures de MapLibre. Asi se
    // puede resaltar/mostrar con la misma logica que el resto de capas.
    function geoJsonToOlFeature(gjFeature) {
      try {
        const fmt = new (window.ol && window.ol.format && window.ol.format.GeoJSON)();
        const feat = fmt.readFeature(gjFeature, { featureProjection: 'EPSG:3857' });
        if (feat && feat.getGeometry && typeof feat.getGeometry === 'function') return feat;
      } catch (e) { /* convertir fallo */ }
      return null;
    }

    // ── Paso 1 de una capa MapLibre: sub-capas GL ─────────────────────
    // Recopila las sub-capas (source-layers) de la fuente vectorial del estilo
    // junto con su tipo y el numero de features visibles en el viewport actual.
    // Devuelve una estructura plana [{sourceId, sourceLayer, types, count}].
    async function getMapLibreSubStack(layer) {
      const ml = getMapLibreMap(layer);
      if (!ml) return [];
      const ready = await awaitMapLibreStyle(ml);
      if (!ready) return [];

      let layers = [], vectorSources = [];
      try {
        const style = ml.getStyle();
        layers = style.layers || [];
        for (const k in (style.sources || {})) {
          if (style.sources[k] && String(style.sources[k].type) === 'vector') vectorSources.push(k);
        }
      } catch (e) { return []; }
      if (!vectorSources.length) return [];

      // Agrupar las capas GL por su fuente vectorial y por "source-layer".
      const groups = {}; // sourceId -> map(sourceLayer -> {types:[]})
      for (const L of layers) {
        if (!L || !L.source) continue;
        if (vectorSources.indexOf(L.source) < 0) continue;
        const sl = L['source-layer'] || '(sin source-layer)';
        if (!groups[L.source]) groups[L.source] = {};
        if (!groups[L.source][sl]) groups[L.source][sl] = { types: [] };
        const g = groups[L.source][sl];
        if (g.types.indexOf(L.type) < 0) g.types.push(L.type);
      }

      const stack = [];
      for (const sourceId of vectorSources) {
        const subLayers = Object.keys(groups[sourceId] || {}).sort();
        for (const sl of subLayers) {
          let count = 0;
          try { count = (ml.querySourceFeatures(sourceId, { sourceLayer: sl }) || []).length; } catch (e) { /* mantener 0 */ }
          stack.push({ sourceId: sourceId, sourceLayer: sl, types: groups[sourceId][sl].types, count: count });
        }
      }
      return stack;
    }

    // Instala el dropdown (secundario) de sub-capas en el header del sidenav y
    // conecta el cambio de seleccion con la tabla del body. Al elegir una
    // sub-capa se actualiza SOLO el cuerpo, manteniendo abierto el panel y el
    // primer dropdown de capas.
    //
    // Vale igual para las capas MapLibre (sub-capas = source-layers del estilo)
    // y para las MVT (sub-capas = capas internas de la tesela, ver
    // `proveedorMVT_`); lo unico que cambia es el proveedor.
    //
    // @param {Object} provider {disponible, getStack, buildTable, counts}
    function installSubLayerPicker(panel, layer, body, provider) {
      const headLeft = panel.querySelector('.ls-sheet-header-left');
      const picker = document.createElement('select');
      picker.className = 'ls-sheet-sublayer-picker';
      picker.setAttribute('aria-label', 'Sub-capa');
      picker.disabled = true;
      picker.innerHTML = '<option>Cargando sub-capas…</option>';
      const titleEl = panel.querySelector('.ls-sheet-title');
      if (headLeft && titleEl) headLeft.insertBefore(picker, titleEl);

      // Contexto de la tabla, para poder rehacerla (y refrescar los recuentos
      // del selector) al mover el mapa: los features salen del viewport.
      const ctx = { layer: layer, provider: provider, sourceId: null, sourceLayer: null, body: body, picker: picker };

      const setBody = (sid, sl) => {
        ctx.sourceId = sid;
        ctx.sourceLayer = sl;
        mlTableCtx = ctx;
        const html = provider.buildTable(sid, sl);
        if (typeof html === 'string') {
          body.innerHTML = html;
          return;
        }
        // Las teselas de una MVT se leen por red: se avisa mientras llegan.
        body.innerHTML = '<p style="padding:8px;color:#555;">Leyendo las teselas de la vista…</p>';
        Promise.resolve(html).then(function (h) {
          if (mlTableCtx === ctx && document.body.contains(body)) body.innerHTML = h;
        }).catch(function () {
          if (mlTableCtx === ctx && document.body.contains(body)) {
            body.innerHTML = '<p style="padding:8px;color:#555;">No se pudieron leer las teselas de la capa.</p>';
          }
        });
      };
      bindSheetMove();

      Promise.resolve(provider.getStack()).then(function (stack) {
        if (!stack || !stack.length) {
          picker.remove();
          body.innerHTML = provider.mensajeSinCapas
            || `<p style="padding:8px;color:#555;">La capa <b>${esc(layer.legend || layer.name || 'Capa')}</b> no expone sub-capas consultables.</p>`;
          return;
        }
        picker.disabled = false;
        picker.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = '— Selecciona una sub-capa —';
        picker.appendChild(ph);
        stack.forEach(function (item) {
          const o = document.createElement('option');
          o.value = `${item.sourceId}::${item.sourceLayer}`;
          o.setAttribute('data-nombre', item.sourceLayer);
          o.textContent = item.sourceLayer + (item.count > 0 ? ` (${item.count})` : '');
          picker.appendChild(o);
        });
        picker.onchange = function () {
          const v = picker.value.split('::');
          if (v.length === 2) setBody(v[0], v[1]);
        };
        // Mostrar automaticamente la primera sub-capa con features en la vista.
        const withData = stack.filter(function (i) { return i.count > 0; });
        const first = withData.length ? withData[0] : stack[0];
        picker.value = `${first.sourceId}::${first.sourceLayer}`;
        setBody(first.sourceId, first.sourceLayer);
      }).catch(function () {
        picker.remove();
        body.innerHTML = `<p style="padding:8px;color:#555;">No se pudieron cargar las sub-capas de <b>${esc(layer.legend || layer.name || 'Capa')}</b>.</p>`;
      });
    }

    // ── Proveedor de sub-capas de una capa MapLibre ─────────────────────
    function proveedorMapLibre_(layer) {
      return {
        disponible: function () { return !!getMapLibreMap(layer); },
        getStack: function () { return getMapLibreSubStack(layer); },
        buildTable: function (sid, sl) { return buildMapLibreFeaturesTable(layer, sid, sl); },
        // Recuento de cada opcion ya listada: se pregunta solo por las que hay
        // en el selector (300 en la BTN) en vez de recorrer otra vez el estilo.
        counts: function (picker) {
          const ml = getMapLibreMap(layer);
          if (!ml || !picker) return null;
          const salida = {};
          for (let i = 0; i < picker.options.length; i++) {
            const valor = picker.options[i].value;
            if (!valor) continue;
            const partes = valor.split('::');
            try {
              salida[valor] = (ml.querySourceFeatures(partes[0], { sourceLayer: partes[1] }) || []).length;
            } catch (e) {
              salida[valor] = 0;
            }
          }
          return salida;
        }
      };
    }

    // ── Paso 2 de una capa MapLibre: tabla de atributos de una sub-capa ──
    // Consulta los features de un source-layer concreto dentro del viewport
    // (querySourceFeatures) y construye la tabla de atributos, cacheandolos
    // como OL features para permitir el resaltado al pulsar una fila.
    function buildMapLibreFeaturesTable(layer, sourceId, sourceLayer) {
      const ml = getMapLibreMap(layer);
      let gjFeatures = [];
      try {
        gjFeatures = ml.querySourceFeatures(sourceId, { sourceLayer: sourceLayer }) || [];
      } catch (e) { gjFeatures = []; }
      if (!gjFeatures.length) {
        return `<p style="padding:8px;color:#555;">No hay features de <b>${esc(sourceLayer)}</b> en el viewport actual del mapa. Acércate (zoom) o desplázate a una zona con datos y vuelve a pulsar la sub-capa.</p>`;
      }
      const rows = gjFeatures.slice(0, 500).map(function (gj) {
        const props = (gj && gj.properties && typeof gj.properties === 'object') ? gj.properties : {};
        const ol = geoJsonToOlFeature(gj);
        return { props: props, feature: ol, geometry: ol && ol.getGeometry ? ol.getGeometry() : null };
      });
      return tablaSubCapaHtml(layer, sourceLayer, rows, gjFeatures.length);
    }

    // Tabla de atributos comun a las sub-capas de MapLibre y de MVT, para que
    // las dos se vean igual (mismas columnas, mismo resaltado al pulsar).
    // Rellena `sheetCtx`, que es lo que usa `locateFeatureByIdx` para llevar la
    // camara al elemento de la fila.
    // @param {number} [totalFeatures] Features en la vista, si son mas que las
    //   filas listadas (se listan 500 como maximo).
    function tablaSubCapaHtml(layer, sourceLayer, rows, totalFeatures) {
      const columns = [];
      rows.forEach(function (row) { for (const k in row.props) { if (!columns.includes(k)) columns.push(k); } });
      if (!columns.length) columns.push('(sin atributos)');

      const cached = rows.map(function (row, i) {
        let extent = null;
        try { extent = row.geometry && row.geometry.getExtent ? row.geometry.getExtent() : null; } catch (e) { extent = null; }
        let firstProp = null;
        for (const c of columns) {
          const v = row.props[c];
          if (v !== undefined && v !== null && v !== '' && c !== '(sin atributos)') { firstProp = v; break; }
        }
        return { feature: row.feature, geometry: row.geometry, extent: extent, firstProp: firstProp, idx: i };
      });
      sheetCtx = { layerId: layer.idLayer, features: cached, olLayer: null };

      const layerId = (typeof layer.idLayer !== 'undefined') ? layer.idLayer : '';
      const total = (typeof totalFeatures === 'number' && totalFeatures > rows.length)
        ? totalFeatures : rows.length;
      let nota = `Sub-capa <b>${esc(sourceLayer)}</b> · ${total} features del viewport`;
      if (total > rows.length) nota += ` (se listan las ${rows.length} primeras)`;
      let html = `<p class="ls-sheet-note" style="margin-top:0;">${nota}.</p>`;
      html += `<table class="ls-attr-table"><thead><tr><th>#</th>`;
      for (const c of columns) html += `<th>${esc(c)}</th>`;
      html += `</tr></thead><tbody>`;
      rows.forEach(function (row, i) {
        html += `<tr class="ls-clickable" data-row-idx="${i}" title="Localizar este elemento en el mapa" onclick="locateFeature('${layerId}', '${i}')">`;
        html += `<td>${i + 1}</td>`;
        for (const c of columns) {
          const v = row.props[c];
          html += `<td>${esc(v === undefined || v === null ? (c === '(sin atributos)' ? '—' : '') : v)}</td>`;
        }
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      return html;
    }

    // ── Capas MVT: capas internas de la tesela ─────────────────────────
    // Un servicio de teselas vectoriales trae VARIAS capas dentro de la misma
    // tesela: medido en el de unidades administrativas del IGN, cualquier
    // z/x/y lleva comunidadautonoma, municipio, provincia y pais en el mismo
    // fichero. La ficha declara una sola en `parameters.layers`, pero la tabla
    // las ofrece todas, igual que hace MapLibre con los `source-layer` de su
    // estilo.
    //
    // Los features no se pueden enumerar desde la capa: en 2D la fuente es un
    // VectorTile de OpenLayers, que no expone las features de las teselas, y en
    // 3D la fachada de ext/MVTLayer devuelve []. Asi que se leen aqui las
    // teselas del viewport con el mismo par de modulos que usa ese plugin
    // (@mapbox/vector-tile + pbf, importados del CDN) y una cache por z/x/y.
    // Es el equivalente a `querySourceFeatures` de MapLibre.
    const MVT_MODULO_VT = 'https://cdn.jsdelivr.net/npm/@mapbox/vector-tile@2.0.3/+esm';
    const MVT_MODULO_PBF = 'https://cdn.jsdelivr.net/npm/pbf@3.2.1/+esm';
    // Teselas que se leen como maximo por vista: con el lienzo de 1280 px y un
    // zoom de lectura un nivel por debajo del del mapa son 5x3 = 15. Si la vista
    // cubre mas, se baja de nivel antes que recortar la zona.
    const MVT_MAX_TESELAS = 16;
    const MVT_MAX_CACHE = 40;
    const MVT_ZOOM_MIN = 5;
    const MVT_ZOOM_MAX = 14;
    let mvtDecodificador = null;
    const mvtCache = new Map();

    // Carga (una sola vez) el decodificador de teselas vectoriales.
    function cargarDecodificadorMVT() {
      if (!mvtDecodificador) {
        mvtDecodificador = Promise.all([
          import(MVT_MODULO_VT),
          import(MVT_MODULO_PBF)
        ]).then(function (modulos) {
          const vt = modulos[0] || {};
          const pbf = modulos[1] || {};
          const VectorTile = vt.VectorTile || (vt.default && vt.default.VectorTile);
          const Pbf = pbf.default || pbf.Pbf;
          if (!VectorTile || !Pbf) throw new Error('sin decodificador MVT');
          return { VectorTile: VectorTile, Pbf: Pbf };
        });
        mvtDecodificador.catch(function () { mvtDecodificador = null; });
      }
      return mvtDecodificador;
    }

    // Datos del servicio de una capa MVT: plantilla de URL, capas declaradas y
    // tamano de la tesela. Se leen de la fachada de la capa porque en 2D es la
    // del bundle y en 3D la de ext/MVTLayer, que guarda el lector de teselas.
    function mvtDatos(layer) {
      let impl = null;
      try { impl = layer.getImpl ? layer.getImpl() : null; } catch (e) { impl = null; }
      const lector = (impl && impl.lector) ? impl.lector : null;
      const cp = layer.constructorParameters || {};
      const p = cp.parameters || cp.userParameters || {};
      let url = (impl && impl.url) || p.url || (lector && lector.url) || null;
      if (!url || typeof url !== 'string' || url.indexOf('{z}') < 0) return null;
      let declaradas = p.layers || (impl && impl.layers_) || (lector && lector.capas) || [];
      if (Array.isArray(declaradas)) declaradas = declaradas.map(String);
      else declaradas = String(declaradas).split(',').map(function (s) { return s.trim(); });
      declaradas = declaradas.filter(Boolean);
      return { url: url, declaradas: declaradas };
    }

    // Detecta una capa MVT. En 2D se identifica por el tipo; en 3D la fachada de
    // ext/MVTLayer hereda de la implementacion Vector y declara `type: 'Vector'`,
    // asi que lo que la distingue es el lector de teselas que monta.
    function esCapaMVT(layer) {
      const t = String(layer.type || layer._type || '').toLowerCase();
      let esMvt = (t === 'mvt');
      if (!esMvt) {
        let impl = null;
        try { impl = layer.getImpl ? layer.getImpl() : null; } catch (e) { impl = null; }
        esMvt = !!(impl && impl.lector && typeof impl.lector.capas !== 'undefined');
      }
      return esMvt && !!mvtDatos(layer);
    }

    // Extension visible del mapa en grados, con un zoom de referencia. Sirve
    // igual en 2D (extent de OpenLayers, en 3857) que en 3D (rectangulo de la
    // camara de Cesium). El rectangulo de Cesium incluye la inclinacion, asi que
    // el zoom se estima con los grados por pixel del centro.
    function vistaEnGrados() {
      let impl = null;
      try { impl = map.getMapImpl ? map.getMapImpl() : null; } catch (e) { impl = null; }
      if (!impl) return null;
      const RAD = Math.PI / 180;
      if (impl.scene && impl.scene.camera) {
        const escena = impl.scene;
        let rect = null;
        try { rect = escena.camera.computeViewRectangle(escena.globe && escena.globe.ellipsoid); } catch (e) { rect = null; }
        if (!rect || !isFinite(rect.west)) return null;
        const anchoPx = (escena.canvas && escena.canvas.clientWidth) || 0;
        const oeste = rect.west / RAD, este = rect.east / RAD;
        const norte = rect.north / RAD, sur = rect.south / RAD;
        const porPx = anchoPx > 0 ? (este - oeste) / anchoPx : 360 / 1024;
        return { oeste: oeste, este: este, norte: norte, sur: sur, zoom: Math.log2(360 / (porPx * 256)) };
      }
      const vista = (typeof impl.getView === 'function') ? impl.getView() : null;
      if (!vista) return null;
      let ext = null;
      try { ext = vista.calculateExtent(impl.getSize()); } catch (e) { ext = null; }
      if (!ext) return null;
      // 3857 -> 4326 (Web Mercator esferico, exacto).
      const R = 6378137;
      const lon = (x) => x / R / RAD;
      const lat = (y) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / RAD;
      const zoom = (typeof vista.getZoom === 'function') ? vista.getZoom() : null;
      return { oeste: lon(ext[0]), este: lon(ext[2]), norte: lat(ext[3]), sur: lat(ext[1]), zoom: zoom };
    }

    // Teselas z/x/y que cubren la vista. El zoom de lectura va un nivel por
    // debajo del del mapa: con el lienzo normal son 5x3 teselas, que caben en el
    // tope. Si la vista es tan amplia que no caben, se baja de nivel hasta que
    // quepan, para que el recuento cubra TODA la vista y no solo una esquina.
    function mvtTeselas(vista) {
      if (!vista || !isFinite(vista.zoom)) return [];
      const rango = function (z) {
        const n = Math.pow(2, z);
        const xDe = (lonVal) => Math.max(0, Math.min(n - 1, Math.floor(((lonVal + 180) / 360) * n)));
        const yDe = (latVal) => {
          const r = Math.max(-85.05112878, Math.min(85.05112878, latVal)) * Math.PI / 180;
          const merc = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
          return Math.max(0, Math.min(n - 1, Math.floor(merc * n)));
        };
        const x0 = xDe(vista.oeste), x1 = xDe(vista.este);
        const y0 = yDe(vista.norte), y1 = yDe(vista.sur);
        return { x0: x0, x1: x1, y0: y0, y1: y1, total: (x1 - x0 + 1) * (y1 - y0 + 1) };
      };
      let z = Math.max(MVT_ZOOM_MIN, Math.min(MVT_ZOOM_MAX, Math.round(vista.zoom) - 1));
      let r = rango(z);
      while (r.total > MVT_MAX_TESELAS && z > MVT_ZOOM_MIN) {
        z--;
        r = rango(z);
      }
      const teselas = [];
      for (let x = r.x0; x <= r.x1 && teselas.length < MVT_MAX_TESELAS; x++) {
        for (let y = r.y0; y <= r.y1 && teselas.length < MVT_MAX_TESELAS; y++) teselas.push({ z: z, x: x, y: y });
      }
      return teselas;
    }

    function mvtUrl(url, t) {
      return url
        .replace('{z}', t.z)
        .replace('{x}', t.x)
        .replace(/\{-y\}/, String(Math.pow(2, t.z) - 1 - t.y))
        .replace('{y}', t.y);
    }

    // Descarga y decodifica una tesela. Devuelve { z, x, y, capas } con TODAS
    // las capas internas y sus features en crudo (props y geometria en unidades
    // de tesela). Un fallo de red devuelve la tesela vacia: la tabla sigue
    // funcionando con las demas.
    function mvtLeerTesela(url, t) {
      // La clave lleva la URL: dos capas MVT distintas comparten z/x/y y no
      // pueden compartir tesela decodificada.
      const clave = url + '|' + t.z + '/' + t.x + '/' + t.y;
      if (mvtCache.has(clave)) return mvtCache.get(clave);
      const promesa = cargarDecodificadorMVT().then(function (dec) {
        return fetch(mvtUrl(url, t)).then(function (respuesta) {
          if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
          return respuesta.arrayBuffer();
        }).then(function (buffer) {
          const salida = { z: t.z, x: t.x, y: t.y, capas: {} };
          // Tesela vacia: medido, 21 bytes.
          if (!buffer || buffer.byteLength < 40) return salida;
          const tesela = new dec.VectorTile(new dec.Pbf(new Uint8Array(buffer)));
          for (const nombre in tesela.layers) {
            const capa = tesela.layers[nombre];
            const features = [];
            for (let i = 0; i < capa.length; i++) {
              const f = capa.feature(i);
              features.push({ tipo: f.type, props: f.properties || {}, geometria: f.loadGeometry() });
            }
            salida.capas[nombre] = { extent: capa.extent || 4096, features: features };
          }
          return salida;
        });
      }).catch(function () {
        return { z: t.z, x: t.x, y: t.y, capas: {}, error: true };
      });
      mvtCache.set(clave, promesa);
      // Cache acotada por orden de insercion (la mas vieja primero).
      while (mvtCache.size > MVT_MAX_CACHE) mvtCache.delete(mvtCache.keys().next().value);
      return promesa;
    }

    // Lee todas las teselas de la vista actual.
    function mvtLeerVista(layer) {
      const datos = mvtDatos(layer);
      if (!datos) return Promise.resolve({ datos: null, leidas: [] });
      const teselas = mvtTeselas(vistaEnGrados());
      if (!teselas.length) return Promise.resolve({ datos: datos, leidas: [] });
      return Promise.all(teselas.map(function (t) {
        return mvtLeerTesela(datos.url, t);
      })).then(function (leidas) {
        return { datos: datos, leidas: leidas };
      });
    }

    // Sub-capas de una capa MVT: las declaradas en la ficha mas las que traen
    // las teselas, con el numero de features de cada una en la vista.
    function getMVTSubStack(layer) {
      return mvtLeerVista(layer).then(function (r) {
        if (!r.datos) return [];
        const nombres = [];
        const conteo = Object.create(null);
        r.datos.declaradas.forEach(function (n) { if (nombres.indexOf(n) < 0) nombres.push(n); });
        r.leidas.forEach(function (t) {
          for (const n in t.capas) {
            if (nombres.indexOf(n) < 0) nombres.push(n);
            conteo[n] = (conteo[n] || 0) + t.capas[n].features.length;
          }
        });
        return nombres.map(function (n) {
          return { sourceId: 'mvt', sourceLayer: n, count: conteo[n] || 0, types: ['mvt'] };
        });
      });
    }

    // Coordenada de la tesela (0..extent) a lon/lat.
    function mvtPuntoAGrados(t, extent, p) {
      const n = Math.pow(2, t.z);
      const lon = ((t.x + p.x / extent) / n) * 360 - 180;
      const my = (t.y + p.y / extent) / n;
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180 / Math.PI;
      return [lon, lat];
    }

    // Area con signo de un anillo: en el MVT el exterior de cada poligono
    // conserva el signo del primero y sus huecos van al reves.
    function mvtAreaConSigno(puntos) {
      let a = 0;
      for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
        a += (puntos[j].x * puntos[i].y - puntos[i].x * puntos[j].y);
      }
      return a / 2;
    }

    // Feature de una tesela MVT a GeoJSON en 4326 (para poder construir la
    // geometria de OpenLayers como en las capas MapLibre).
    function mvtFeatureAGeoJSON(t, extent, feature) {
      const anillos = feature.geometria || [];
      if (!anillos.length) return null;
      const aGrados = function (anillo) {
        return anillo.map(function (p) { return mvtPuntoAGrados(t, extent, p); });
      };
      let geometry = null;
      if (feature.tipo === 1) {
        const p = aGrados(anillos[0])[0];
        if (p) geometry = { type: 'Point', coordinates: p };
      } else if (feature.tipo === 2) {
        geometry = { type: 'LineString', coordinates: aGrados(anillos[0]) };
      } else if (feature.tipo === 3) {
        // Exteriores e huecos por el signo del area, como en ext/MVTLayer.
        const poligonos = [];
        let actual = null;
        let signoExterior = 0;
        for (let i = 0; i < anillos.length; i++) {
          const signo = Math.sign(mvtAreaConSigno(anillos[i]));
          if (!actual || (signoExterior && signo === signoExterior)) {
            actual = { anillos: [] };
            poligonos.push(actual);
            if (!signoExterior) signoExterior = signo;
          }
          actual.anillos.push(aGrados(anillos[i]));
        }
        if (poligonos.length === 1) {
          geometry = { type: 'Polygon', coordinates: poligonos[0].anillos };
        } else if (poligonos.length > 1) {
          geometry = { type: 'MultiPolygon', coordinates: poligonos.map(function (p) { return p.anillos; }) };
        }
      }
      if (!geometry) return null;
      return { type: 'Feature', properties: feature.props || {}, geometry: geometry };
    }

    // Tabla de atributos de una capa interna de un servicio MVT.
    function buildMVTFeaturesTable(layer, sourceLayer) {
      return mvtLeerVista(layer).then(function (r) {
        const items = [];
        r.leidas.forEach(function (t) {
          const capa = t.capas[sourceLayer];
          if (!capa) return;
          for (let i = 0; i < capa.features.length; i++) {
            items.push({ tesela: t, extent: capa.extent, feature: capa.features[i] });
          }
        });
        if (!items.length) {
          const conError = r.leidas.length > 0 && r.leidas.every(function (t) { return t.error; });
          if (conError) {
            return `<p style="padding:8px;color:#555;">No se pudieron descargar las teselas del servicio MVT de <b>${esc(layer.legend || layer.name || 'la capa')}</b>. Comprueba que la URL admite CORS.</p>`;
          }
          return `<p style="padding:8px;color:#555;">No hay features de <b>${esc(sourceLayer)}</b> en el viewport actual del mapa. Acércate (zoom) o desplázate a una zona con datos y vuelve a pulsar la sub-capa.</p>`;
        }
        const rows = items.slice(0, 500).map(function (item) {
          const props = item.feature.props || {};
          const gj = mvtFeatureAGeoJSON(item.tesela, item.extent, item.feature);
          const ol = gj ? geoJsonToOlFeature(gj) : null;
          return { props: props, feature: ol, geometry: ol && ol.getGeometry ? ol.getGeometry() : null };
        });
        return tablaSubCapaHtml(layer, sourceLayer, rows, items.length);
      });
    }

    // ── Proveedor de sub-capas de una capa MVT ──────────────────────────
    function proveedorMVT_(layer) {
      return {
        disponible: function () { return !!mvtDatos(layer); },
        getStack: function () { return getMVTSubStack(layer); },
        buildTable: function (sid, sl) { return buildMVTFeaturesTable(layer, sl); },
        counts: function () {
          return getMVTSubStack(layer).then(function (stack) {
            const salida = {};
            stack.forEach(function (i) { salida[i.sourceId + '::' + i.sourceLayer] = i.count; });
            return salida;
          });
        },
        mensajeSinCapas: `<p style="padding:8px;color:#555;">No se pudieron leer las capas internas del servicio MVT de <b>${esc(layer.legend || layer.name || 'la capa')}</b>. Comprueba que la URL de las teselas admite CORS.</p>`
      };
    }

    // ── Estadisticas de capa RASTER ────────────────────────────────────
    function buildRasterInfo(layer) {
      const layerName = layer.legend || layer.name || 'Capa';
      let transparency = 0;
      try { transparency = Math.round((1 - (layer.getOpacity ? layer.getOpacity() : 1)) * 100); } catch (e) { /* ignorar */ }

      // Reunir datos del impl / source para metadatos opcionales.
      let info = null, source = null;
      try {
        const impl = layer.getImpl ? layer.getImpl() : null;
        info = (impl && impl.info) ? impl.info : null;
        source = (impl && typeof impl.getSource === 'function') ? impl.getSource() : null;
      } catch (e) { /* sin impl */ }

      // Numero de bandas: solo si el impl.info lo expone directamente
      // (p.ej. GeoTIFF/MBTiles locales). En servicios WMS/WMTS no hay una
      // API nativa, asi que no se inventa el valor.
      let bandsHtml = '<li><span class="ls-stat-label">Bandas</span><span class="ls-stat-value">(no disponible para este servicio)</span></li>';
      try {
        if (info && Array.isArray(info.bands) && info.bands.length) {
          bandsHtml = `<li><span class="ls-stat-label">Bandas</span><span class="ls-stat-value">${info.bands.length}</span></li>`;
        } else if (source && typeof source.getBandCount === 'function' && source.getBandCount() > 0) {
          bandsHtml = `<li><span class="ls-stat-label">Bandas</span><span class="ls-stat-value">${source.getBandCount()}</span></li>`;
        }
      } catch (e) { /* ignorar */ }

      let sizeHtml = '';
      try {
        if (info && Array.isArray(info.size) && info.size.length === 2) {
          sizeHtml = `<li><span class="ls-stat-label">Tamaño</span><span class="ls-stat-value">${info.size[0]} x ${info.size[1]} px</span></li>`;
        }
      } catch (e) { /* ignorar */ }

      // GeoRSS / tipo del impl para mostrarlo como subtitulo.
      let typeInfo = '';
      try { typeInfo = String(layer.type || layer._type || (layer.getImpl && layer.getImpl().type) || ''); } catch (e) { /* ignorar */ }

      return `
        <p class="ls-sheet-note" style="margin-top:0;">Estadísticas de la capa ráster.</p>
        <ul class="ls-stat-list">
          <li><span class="ls-stat-label">Nombre</span><span class="ls-stat-value">${esc(layerName)}</span></li>
          <li><span class="ls-stat-label">Tipo</span><span class="ls-stat-value">${esc(typeInfo || 'ráster')}</span></li>
          <li><span class="ls-stat-label">Transparencia</span><span class="ls-stat-value">${transparency}%</span></li>
          ${bandsHtml}
          ${sizeHtml}
        </ul>`;
    }

    // ── Abrir informacion de la capa ───────────────────────────────────
    // Abre el panel inferior (sidenav) con la tabla de atributos (vectorial) o
    // las estadisticas (raster). En su header se incluye un dropdown con todas
    // las capas seleccionables para poder cambiar de capa sin cerrar el panel.
    window.openLayerInfo = function (index, fromPicker) {
      const layer = findLayerById(index);
      if (!layer) return;
      const kind = window.getLayerKind(layer);
      const layerName = layer.legend || layer.name || 'Capa';
      // Cierra cualquier panel previo ANTES de construir el nuevo: el builder
      // (buildVectorTable) puebla sheetCtx y openSheet ya no debe resetearlo.
      closeSheet();
      // Capas seleccionables para el dropdown del header (asincrono).
      const finish = (selectableLayers) => {
        if (kind === 'vector') {
          // Las capas MapLibre (BTN) y las MVT no tienen una fuente OL
          // enumerable: se abre el panel y se instala un dropdown secundario con
          // sus sub-capas (source-layers del estilo en MapLibre, capas internas
          // de la tesela en MVT). Los dos builders son asincronos, asi que se
          // abre el cuerpo con el aviso y se rellena al cargar.
          if (isMapLibreLayer(layer) || esCapaMVT(layer)) {
            const provider = isMapLibreLayer(layer) ? proveedorMapLibre_(layer) : proveedorMVT_(layer);
            const panel = openSheet(`Tabla de atributos · ${layerName}`, '<p style="padding:8px;color:#555;">Cargando sub-capas…</p>', true, selectableLayers, index);
            installSubLayerPicker(panel, layer, panel.querySelector('.ls-sheet-body'), provider);
            return;
          }
          // Vectorial "de verdad" (GeoJSON, WFS, OGC API Features...): la
          // barra de objetos geográficos (qué se pide, límite y página) va
          // sobre la tabla, dentro del mismo cuerpo. La tabla se rehace sola
          // cuando la capa recarga (ver bindSheetReload).
          sheetVectorLayer = layer;
          openSheet(`Tabla de atributos · ${layerName}`, cuerpoTablaVector(layer), true, selectableLayers, index);
          bindSheetReload(layer);
        } else {
          sheetCtx = null;
          openSheet(`Estadísticas · ${layerName}`, buildRasterInfo(layer), false, selectableLayers, index);
        }
      };
      // Si venimos del dropdown del propio header, las capas ya no han cambiado:
      // se reutiliza la lista cargada (evita re-consultar en cada cambio).
      if (fromPicker && window._lsPickerLayers) {
        finish(window._lsPickerLayers);
      } else {
        // El dropdown del sidenav SOLO lista capas vectoriales: las raster no
        // tienen tabla de atributos y no aportan nada en el selector.
        getSelectableLayers().then(ls => {
          const vectorLayers = (ls || []).filter(l => window.getLayerKind(l) === 'vector');
          window._lsPickerLayers = vectorLayers;
          finish(vectorLayers);
        });
      }
    };

    // Update the list whenever a layer is added to the map
    try {
      if (map && typeof map.on === 'function' && IDEE && IDEE.evt) {
        // Se guarda la funcion para poder desengancharla en destroy().
        this._onAddedLayer = async (capas) => {
          await renderLayerList();
        };
        map.on(IDEE.evt.ADDED_LAYER, this._onAddedLayer);
      }
    } catch (e) {
      console.warn('layerSwitcher: could not attach ADDED_LAYER listener', e);
    }

    // Igual se guarda el desenganche del clic sobre el mapa (esta definido mas
    // arriba, pero lo alcanza la elevacion de la declaracion de funcion).
    this._unbindMapClick = unbindMapClick;

    // ── Refresco del ojito al terminar de mover el mapa ─────────────────
    // El estado "encendida pero no se ve" depende del zoom y de la vista, así
    // que se recalcula al final de cada movimiento. Solo se repintan los
    // ojitos ya montados: rehacer la lista cerraría el desplegable de
    // opciones y cortaría un arrastre en curso.
    this._lsOjosUnbind = _engancharFinDeMovimiento(_refrescarOjos);

    control.activate();
  }

  // Destruccion. map.removePlugins() de la API la exige: sin este metodo lanza
  // "t.destroy is not a function" y aborta el resto del lote de plugins.
  // Deja el mapa como estaba: suelta el control (y con el el panel), desengancha
  // el clic sobre el mapa y el de ADDED_LAYER, y borra los ayudantes globales
  // que el plugin deja en window para los atributos onclick en linea del panel.
  destroy() {
    this._destruirSupra();
    // 0) Ventana de informacion: la hoja inferior sobrevive al plugin (vive en
    //    document.body), asi que al cambiar 2D/3D se quedaba abierta con la
    //    tabla del mapa viejo. Se cierra aqui, que ademas suelta la escucha de
    //    recarga (bindSheetReload) y el resaltado del mapa.
    try { if (typeof window.closeSheet === 'function') window.closeSheet(); } catch (e) { /* ignora */ }
    // 1) Clic sobre el mapa (singleclick del impl de OpenLayers).
    try {
      if (this._unbindMapClick) this._unbindMapClick();
    } catch (e) { /* ignora: el mapa puede estar ya destruido */ }
    this._unbindMapClick = null;

    // 1 bis) Refresco del ojito al mover el mapa.
    try {
      if (this._lsOjosUnbind) this._lsOjosUnbind();
    } catch (e) { /* ignora: el mapa puede estar ya destruido */ }
    this._lsOjosUnbind = null;

    // 2) Listener de capas añadidas en la fachada de la API.
    try {
      const API = (typeof window !== 'undefined') ? (window.IDEE || window.M) : null;
      if (this._map && this._onAddedLayer && API && API.evt && typeof this._map.off === 'function') {
        this._map.off(API.evt.ADDED_LAYER, this._onAddedLayer);
      }
    } catch (e) { /* ignora */ }
    this._onAddedLayer = null;

    // 3) Control fuera del mapa (la API se lleva el panel con el).
    try {
      if (this._map && this._control) this._map.removeControls([this._control]);
    } catch (e) { /* ignora si el mapa o el control ya no estan */ }
    this._control = null;
    this._map = null;
    this._panel = null;

    // 4) Ayudantes globales que el HTML del panel referencia en linea
    //    (onclick="renderLayerList()" y compañía). Solo se borran los que
    //    define este plugin; la clase en window.IDEE.plugin no se toca.
    const GLOBALES = [
      'renderLayerList', 'toggleLayerVisibility', 'toggleLayerOptions', 'toggleGroup',
      'toggleAllLayersVisibility', 'toggleAllGroups',
      'startRenameLayer', '_renameLayerName', 'handleDragStart', 'handleDragOver',
      'handleDrop', 'handleDragEnd', 'deleteLayer', 'getLayerKind', 'setLayerOpacity',
      'setLayerStyle', 'zoomToLayer', 'closeSheet', 'locateFeature', 'openLayerInfo',
      'openLayerFicha', '_lsPickerLayers', 'setBBoxModo', 'setBBoxLimite', 'setBBoxPagina',
      'layerToFront', 'layerToBack', 'duplicateLayer', 'reloadLayer', 'isolateLayer',
      'copyLayerUrl', 'copyLayerCode',
      '__lsDragId', '__lsDragHandleArmed'
    ];
    if (typeof window !== 'undefined') {
      GLOBALES.forEach((nombre) => {
        try {
          if (typeof window[nombre] === 'function') delete window[nombre];
        } catch (e) { /* ignora */ }
      });
    }

    this._optionsOpen = null;
    this._groupCollapsed = {};
    this._aislada = null;
  }
}

if (typeof window !== 'undefined') {
  window.miPlugin_layerSwitcher = miPlugin_layerSwitcher;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_layerSwitcher = miPlugin_layerSwitcher;
  window.M = window.M || {};
  window.M.plugin = window.M.plugin || {};
  window.M.plugin.miPlugin_layerSwitcher = miPlugin_layerSwitcher;
}

