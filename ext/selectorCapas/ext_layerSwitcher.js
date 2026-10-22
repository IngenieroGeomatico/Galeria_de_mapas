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

  window.miWrapX = {
    aplica: aplica,
    envuelve: envuelve,
    olDe: olDe
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
    // idLayer de la capa cuyo desplegable de opciones (transparencia) está
    // abierto. Se conserva entre re-renders para no cerrarlo al alternar
    // la visibilidad de otra capa.
    this._optionsOpen = null;
    // Estado de colapso/expansión de los grupos de capas (idLayer -> bool).
    // Se conserva entre re-renders; si un grupo no está presente, se usa el
    // valor "collapsed" con el que se creó (constructorParameters).
    this._groupCollapsed = {};
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

  // ── Coordinación de estado (swap 2D/3D con cambioImpl) ───────────────
  // Captura el estado serializable propio de la UI del selector de capas
  // (_optionsOpen y _groupCollapsed). El estado de las capas (visibilidad,
  // opacidad, orden z, renombrado) reside en las propias capas y es
  // transferido directamente por cambioImpl.
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
    return {
      panelCollapsed,
      optionsOpen: idAtOpen,
      optionsOpenLegend: legendAtOpen,
      groupCollapsed: groupCollapsedCopy,
      groupCollapsedLegends,
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
      className: 'g-herramienta_selectorCapa',
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

    // z-index REAL de una capa: el que usa el renderer de OpenLayers
    // (sortByZIndex) para pintar. Se lee del impl OL (layer.getImpl().olLayer),
    // que es la fuente de verdad: la fachada puede quedar desincronizada tras
    // un setZIndex() (no lo refleja). Fallback a la fachada si no hay impl.
    const getRealZIndex = (l) => {
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
    };

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

    const renderLayerNode = (node, depth) => {
      const layer = node.layer;
      const layerName = getLayerDisplayName(layer);
      const index = layer.idLayer;
      const visible = layer.isVisible ? layer.isVisible() : true;
      // icono de ojo: abierto = capa visible, tachado/cerrado = oculta.
      // Se usan SVGs inline (como el resto de iconos del plugin) en lugar de
      // emojis: los emojis 👁/🚫 dependen de la fuente del sistema y en algunos
      // navegadores/visualizadores no se renderizan (aparecen como un punto o
      // un cuadro). El SVG es fiable y consistente en todos los visualizadores.
      const eyeIcon = visible
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
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
      const eyeBtn = `<button type="button" class="ls-eye ${visible ? 'ls-eye-on' : 'ls-eye-off'}" data-id="${index}" title="${visible ? 'Ocultar capa' : 'Mostrar capa'}" onclick="toggleLayerVisibility('${index}')">${eyeIcon}</button>`;
      const optsBtn = `<button type="button" class="ls-options ${optionsOpen ? 'ls-options-open' : ''}" data-id="${index}" title="Opciones de la capa" onclick="toggleLayerOptions('${index}')">▾</button>`;
      const optionsPanel = `
              <div class="ls-options-panel ${optionsOpen ? 'open' : ''}">
                <div class="ls-option-row">
                  <span class="ls-option-label" title="Transparencia de la capa">Transparencia</span>
                  <input type="range" min="0" max="100" value="${transpPct}" class="ls-opacity-slider" style="background:${sliderFill}" aria-label="Transparencia de ${layerName}" oninput="setLayerOpacity('${index}', this.value, this)">
                  <span class="ls-option-value">${transpPct}%</span>
                </div>
                <div class="ls-actions-row">
                  <button type="button" class="ls-action ls-action-zoom" data-id="${index}" title="Zoom a la capa" onclick="zoomToLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="12" r="3.2"></circle></svg></button>
                  <button type="button" class="ls-action ls-action-rename" data-id="${index}" title="Renombrar capa" onclick="startRenameLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                  ${tableBtnHtml}
                  <button type="button" class="ls-action ls-action-ficha" data-id="${index}" title="Información de la capa: cómo está construida y su documento de servicio" onclick="openLayerFicha('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="11" x2="12" y2="16"></line><circle cx="12" cy="7.6" r="0.4" fill="currentColor"></circle></svg></button>
                  <button type="button" class="ls-action ls-action-delete" data-id="${index}" title="Eliminar la capa del mapa" onclick="deleteLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                </div>
              </div>`;

      // Asa de arrastre: unico punto desde el que se inicia el drag (así el
      // resto de botones de la fila siguen siendo clicables durante el Drag&Drop).
      const dragHandleHtml = `<span class="ls-drag-handle" title="Arrastra para reordenar" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.7"/><circle cx="15" cy="5" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="19" r="1.7"/><circle cx="15" cy="19" r="1.7"/></svg></span>`;

      // Nombre clicable: alterna la visibilidad (mismo comportamiento que el
      // ojito) pero sin duplicar el boton. Publico para que no dependa del
      // formato del panel de opciones.
      const nameBtn = `<button type="button" class="ls-nombre ${node.isGroup ? 'ls-group-name' : ''}" data-id="${index}" title="${visible ? 'Ocultar capa' : 'Mostrar capa'}" onclick="toggleLayerVisibility('${index}')">${layerName}</button>`;

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

        control.htmlView = `<ul class="overlay-layer-selector">${cuerpo}</ul>`;
        const preview = document.querySelector('#m-herramienta-previews-layerSwitcher');
        if (preview) preview.innerHTML = control.htmlView;

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
      await renderLayerList();
    };

    control.deactivate = () => { };

    window.toggleLayerVisibility = function (index) {
      const layer = findLayerById(index);
      if (!layer || typeof layer.setVisible !== 'function') return;

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
        const visible = layer.isVisible();
        if (eye) {
          // Mismo SVG que en el render principal (ver eyeIcon en renderLayerNode).
          eye.innerHTML = visible
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
          eye.classList.toggle('ls-eye-on', visible);
          eye.classList.toggle('ls-eye-off', !visible);
          eye.title = visible ? 'Ocultar capa' : 'Mostrar capa';
        }
      }
    };

    // ── Desplegable de opciones por capa ────────────────────────────────
    // Abre/cierra el panel de opciones de una capa (por ahora transparencia).
    // Conserva en self._optionsOpen que capa tiene el panel abierto para no
    // cerrarlo al re-renderizar (p.ej. al alternar la visibilidad de otra).
    window.toggleLayerOptions = function (index) {
      self._optionsOpen = self._optionsOpen === index ? null : index;
      renderLayerList();
    };

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

    // Registra el z-index en la fachada y en el impl OL. Mapea puede leer el z
    // desde la fachada (getZIndex()) que delega al impl, asi que escribimos el
    // impl (fuente de verdad del render) y, si la fachada expone setter propio,
    // tambien lo sincronizamos.
    const recordZ = (layer, z) => {
      try {
        const impl = (typeof layer.getImpl === 'function') ? layer.getImpl() : null;
        const ol = impl && impl.olLayer;
        if (ol && typeof ol.setZIndex === 'function') ol.setZIndex(z);
        // Fallback: si no hay impl OL, intenta setZIndex en la propia fachada.
        if (!ol && typeof layer.setZIndex === 'function') layer.setZIndex(z);
      } catch (e) { /* defensivo */ }
    };

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
      const ext = _extensionUtil(capa);
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
     * BBox de cada capa del servicio según sus capacidades.
     * @param {string} url URL del servicio.
     * @returns {Promise<Object|null>} { nombreCapa: [x0, y0, x1, y1] }
     */
    function _bboxCapacidadesWMS(url) {
      if (!_cacheCapacidadesWMS.has(url)) {
        _cacheCapacidadesWMS.set(url, _pedirCapacidadesWMS(url).catch(function () { return null; }));
      }
      return _cacheCapacidadesWMS.get(url);
    }

    /**
     * Pide y parsea el GetCapabilities del servicio.
     * @param {string} url
     * @returns {Promise<Object>}
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
          const salida = {};
          for (let i = 0; i < capas.length; i++) {
            const nombre = _textoHijoWMS(capas[i], 'Name');
            if (!nombre) continue;
            salida[nombre] = _bboxDeNodoWMS(capas[i]);
          }
          return salida;
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

      // 1) metadata.json del servicio de teselas.
      for (const f of fuentes) {
        const b = await _boundsDeMetadataTeselas(f);
        if (b) partes.push(b);
      }

      // 2) Sondeo de teselas, solo si no ha declarado nada.
      if (!partes.length) {
        for (const f of fuentes) {
          const b = await _extensionPorTeselas(f);
          if (b) { partes.push(b); break; }
        }
      }

      const enGrados = partes.length ? _unionExtensiones(partes) : null;
      const ext = enGrados ? _reproyectar(enGrados, 'EPSG:4326', _codigoDeLaProyeccion()) : null;
      _cacheExtensionMapLibre.set(clave, ext);
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

    /**
     * Cobertura de la fuente sondeando teselas: se parte de la tesela del
     * centro actual y se amplía la caja mientras aparezcan teselas nuevas.
     * Un borde entero sin teselas es el borde de los datos; si la caja llega
     * al tope (la capa llena el mundo) no se inventa extensión.
     * @param {Object} fuente {tiles}
     * @returns {Promise<Array<number>|null>} bounds en grados.
     */
    async function _extensionPorTeselas(fuente) {
      const plantillas = (fuente && fuente.tiles) || [];
      if (!plantillas.length) return null;
      const plantilla = plantillas[0];
      if (!/\{z\}/.test(plantilla) || (!/\{x\}/.test(plantilla) && !/\{y\}/.test(plantilla))) return null;
      const centro = _centroEnGrados();
      if (!centro) return null;

      const nivel = NIVEL_SONDEO_TESELAS;
      const n = Math.pow(2, nivel);
      const inicial = _teselaDe(centro[0], centro[1], nivel);
      if (!inicial) return null;

      const vistas = {};
      let peticiones = 0;
      const existe = async function (x, y) {
        if (x < 0 || y < 0 || x >= n || y >= n) return false;
        const clave = x + ',' + y;
        if (vistas[clave] !== undefined) return vistas[clave];
        if (peticiones >= MAX_PETICIONES_SONDEO) return false;
        peticiones++;
        let hay = false;
        try {
          const resp = await fetch(_urlDeTesela(plantilla, nivel, x, y));
          if (resp && resp.ok) {
            // Una tesela vacía llega como un PBF mínimo: se descarta.
            try {
              const buf = await resp.arrayBuffer();
              hay = !!(buf && buf.byteLength > 2);
            } catch (e) { hay = true; }
          }
        } catch (e) { hay = false; }
        vistas[clave] = hay;
        return hay;
      };

      if (!(await existe(inicial.x, inicial.y))) return null;
      let minX = inicial.x, maxX = inicial.x, minY = inicial.y, maxY = inicial.y;

      for (let vuelta = 0; vuelta < MAX_TESELAS_SONDEO; vuelta++) {
        const x0 = minX - 1, x1 = maxX + 1, y0 = minY - 1, y1 = maxY + 1;
        const borde = [];
        for (let x = x0; x <= x1; x++) { borde.push([x, y0]); borde.push([x, y1]); }
        for (let y = minY; y <= maxY; y++) { borde.push([x0, y]); borde.push([x1, y]); }

        let alguno = false;
        for (const p of borde) {
          if (await existe(p[0], p[1])) {
            alguno = true;
            minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
          }
        }
        if (!alguno) break;
        if ((maxX - minX + 1) >= MAX_TESELAS_SONDEO ||
            (maxY - minY + 1) >= MAX_TESELAS_SONDEO) break;
      }

      if ((maxX - minX + 1) >= MAX_TESELAS_SONDEO ||
          (maxY - minY + 1) >= MAX_TESELAS_SONDEO) return null;

      const nw = _gradosDeTesela(minX, minY, nivel);
      const se = _gradosDeTesela(maxX + 1, maxY + 1, nivel);
      return _extensionDeBounds([nw[0], se[1], se[0], nw[1]]);
    }

    /**
     * Tesela (esquema XYZ/Web Mercator) que contiene un punto.
     * @param {number} lon
     * @param {number} lat
     * @param {number} z
     * @returns {{x:number, y:number}}
     */
    function _teselaDe(lon, lat, z) {
      const n = Math.pow(2, z);
      const la = Math.max(-85.05112878, Math.min(85.05112878, Number(lat))) * Math.PI / 180;
      return {
        x: Math.floor((Number(lon) + 180) / 360 * n),
        y: Math.floor((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n),
      };
    }

    /**
     * Esquina noroeste de una tesela, en grados.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {Array<number>} [lon, lat]
     */
    function _gradosDeTesela(x, y, z) {
      const n = Math.pow(2, z);
      return [
        x / n * 360 - 180,
        Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI,
      ];
    }

    /**
     * URL de una tesela a partir de la plantilla del estilo.
     * @param {string} plantilla
     * @param {number} z
     * @param {number} x
     * @param {number} y
     * @returns {string}
     */
    function _urlDeTesela(plantilla, z, x, y) {
      const n = Math.pow(2, z);
      return String(plantilla)
        .replace(/\{z\}/g, z)
        .replace(/\{x\}/g, x)
        .replace(/\{y\}/g, y)
        .replace(/\{-y\}/g, n - 1 - y)
        .replace(/\{s\}/g, 'a');
    }

    /** Centro del mapa en grados [lon, lat], para el sondeo de teselas. */
    function _centroEnGrados() {
      try {
        const c = map.getCenter();
        if (!c || !isFinite(c.x) || !isFinite(c.y)) return null;
        const p = _reproyectar([c.x, c.y, c.x, c.y], _codigoDeLaProyeccion(), 'EPSG:4326');
        return (p && isFinite(p[0]) && isFinite(p[1])) ? [p[0], p[1]] : null;
      } catch (e) { return null; }
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
    // Devuelve 'vector' si la capa es vectorial (GeoJSON, WFS, Vector...)
    // y 'raster' en caso contrario. API-IDEE no expone un metodo unico
    // fiable, asi que se comparan los tipos conocidos por su nombre.
    window.getLayerKind = function (layer) {
      let typeName = '';
      try { typeName = String(layer.type || layer._type || ''); } catch (e) { /* ignorar */ }
      if (!typeName) {
        try { typeName = String((layer.getImpl() && layer.getImpl().type) || ''); } catch (e) { /* ignorar */ }
      }
      const t = typeName.toLowerCase();
      const vectorTypes = ['geojson', 'wfs', 'vector', 'geojsonparser', 'feature', 'mvt', 'kml', 'csv', 'datoselevacion', 'mapbox', 'maplibre'];
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

    // Función para remarcar todas las filas de la tabla segun el índice activo.
    function highlightRow(idx) {
      document.querySelectorAll('.ls-attr-table tbody tr').forEach(function (tr) {
        tr.classList.toggle('ls-row-active', tr.getAttribute('data-row-idx') === String(idx));
      });
    }

    let closeSheet = function () {
      unbindMapClick();
      unbindSheetMove();
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
      panel.innerHTML =
        `<div class="ls-sheet__handle" title="Arrastra para cambiar la altura del panel"></div>
         <div class="ls-sheet-header">
           <div class="ls-sheet-header-left">
             ${pickerHtml}
             <span class="ls-sheet-title"></span>
           </div>
           <button type="button" class="ls-sheet-close" title="Cerrar" onclick="closeSheet()">✕</button>
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

      panel.innerHTML =
        `<div class="ls-ficha-header">
            <div class="ls-ficha-title">${_escaparHtml(nombre)}</div>
            <div class="ls-ficha-tipo">${tipo}</div>
            <button type="button" class="ls-sheet-close" title="Cerrar" onclick="cerrarFicha()">✕</button>
          </div>
          <div class="ls-ficha-body">
            <div class="ls-ficha-col">
              <div class="ls-ficha-seccion-titulo">Parámetros de construcción</div>
              ${parametrosHtml}
            </div>
            <div class="ls-ficha-col">
              <div class="ls-ficha-seccion-titulo">Documento del servicio</div>
              <div class="ls-ficha-doc">Cargando…</div>
            </div>
          </div>`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => { overlay.classList.add('ls-ficha--open'); });

      const cerrar = function () {
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
      document.addEventListener('keydown', function onKey(ev) {
        if (ev.key !== 'Escape') return;
        document.removeEventListener('keydown', onKey);
        cerrar();
      });

      // El documento se trae aparte: puede tardar, y si no hay se dice.
      _rellenarDocumento(panel.querySelector('.ls-ficha-doc'), capa, url).catch(function (e) {
        panel.querySelector('.ls-ficha-doc').innerHTML =
          '<p class="ls-ficha-aviso">No se pudo leer el documento del servicio.</p>';
        console.warn('layerSwitcher: ficha, documento', e);
      });
    };

    /** Tabla de los parámetros de construcción de la capa. */
    function _tablaDeParametros(construccion, opciones, vendor, url) {
      const filas = [];
      const todo = Object.assign({}, construccion, { 'url (resuelto)': url },
        Object.keys(opciones).length ? { 'options': opciones } : {},
        Object.keys(vendor).length ? { 'vendorOptions': vendor } : {});
      const claves = Object.keys(todo).filter(function (k) { return k !== 'options' && k !== 'vendorOptions'; });
      claves.forEach(function (clave) {
        const valor = todo[clave];
        let texto;
        if (valor === null) texto = 'null';
        else if (valor === undefined) texto = '—';
        else if (typeof valor === 'object') texto = _escaparHtml(JSON.stringify(valor));
        else texto = String(valor);
        filas.push(`<tr><th>${_escaparHtml(clave)}</th><td>${texto}</td></tr>`);
      });
      if (!filas.length) return '<p class="ls-ficha-aviso">La capa no guarda parámetros de construcción.</p>';

      let extra = '';
      ['options', 'vendorOptions'].forEach(function (clave) {
        const obj = todo[clave];
        if (!obj || !Object.keys(obj).length) return;
        const dentro = Object.keys(obj).map(function (k) {
          const v = obj[k];
          const texto = (v === undefined || v === null) ? '—'
            : (typeof v === 'object' ? _escaparHtml(JSON.stringify(v)) : String(v));
          return `<div class="ls-ficha-subfila"><b>${_escaparHtml(k)}</b> ${texto}</div>`;
        }).join('');
        extra += `<details class="ls-ficha-detalle">
            <summary>${clave} (${Object.keys(obj).length})</summary>
            ${dentro || '<div class="ls-ficha-subfila">vacío</div>'}
          </details>`;
      });

      return `<table class="ls-ficha-tabla"><tbody>${filas.join('')}</tbody></table>${extra}`;
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
      const base = _baseDelServicio(url);
      if (!base) {
        contenedor.innerHTML = '<p class="ls-ficha-aviso">Esta capa no procede de un servicio publicado.</p>';
        return;
      }
      const candidatos = ['tileset.json', 'metadata.json'];
      let encontrado = null;
      for (const nombre of candidatos) {
        const completa = base + nombre;
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

    // ── Refresco de la tabla MapLibre al mover el mapa ──────────────────
    // Los features de una capa MapLibre se piden al viewport
    // (querySourceFeatures), asi que la tabla se queda obsoleta en cuanto se
    // desplaza o se hace zoom. Se rehace con un pequeño retardo para no
    // repetir la consulta en cada evento del arrastre.
    //
    // Los eventos de la fachada (IDEE.evt.MOVE/CHANGE) no se disparan al mover
    // (medido), asi que se escucha a la implementacion: `moveend` en el mapa de
    // OpenLayers y `scene.camera.moveEnd` en Cesium.
    function refreshMapLibreTable() {
      const ctx = mlTableCtx;
      if (!ctx || !ctx.body || !document.body.contains(ctx.body)) return;
      if (!getMapLibreMap(ctx.layer)) return;
      ctx.body.innerHTML = buildMapLibreFeaturesTable(ctx.layer, ctx.sourceId, ctx.sourceLayer);
    }

    function unbindSheetMove() {
      if (sheetMoveTimer) { clearTimeout(sheetMoveTimer); sheetMoveTimer = null; }
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
        if (sheetMoveTimer) clearTimeout(sheetMoveTimer);
        sheetMoveTimer = setTimeout(function () {
          sheetMoveTimer = null;
          refreshMapLibreTable();
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
        try { view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 14 }); } catch (e) { /* ignorar */ }
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
          if (!esMetadato(key) && !columns.includes(key)) columns.push(key);
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
          html += `<td>${esc(row.props[c] === undefined ? (c === '(sin atributos)' && row.props ? '—' : '') : row.props[c])}</td>`;
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

    // Instala el dropdown (secundario) de sub-capas en el header del sidenav de
    // una capa MapLibre y conecta el cambio de seleccion con la tabla del body.
    // Al elegir una sub-capa se actualiza SOLO el cuerpo, manteniendo abierto el
    // panel y el primer dropdown de capas.
    function installMapLibreSubPicker(panel, layer, body) {
      const headLeft = panel.querySelector('.ls-sheet-header-left');
      const picker = document.createElement('select');
      picker.className = 'ls-sheet-sublayer-picker';
      picker.setAttribute('aria-label', 'Sub-capa');
      picker.disabled = true;
      picker.innerHTML = '<option>Cargando sub-capas…</option>';
      const titleEl = panel.querySelector('.ls-sheet-title');
      if (headLeft && titleEl) headLeft.insertBefore(picker, titleEl);

      // Guardar el contexto de la tabla para poder rehacerla al mover el mapa:
      // los features de MapLibre salen del viewport y cambian con la vista.
      const setBody = (sid, sl) => {
        mlTableCtx = { layer: layer, sourceId: sid, sourceLayer: sl, body: body };
        body.innerHTML = buildMapLibreFeaturesTable(layer, sid, sl);
      };
      bindSheetMove();

      getMapLibreSubStack(layer).then(function (stack) {
        if (!stack.length) {
          picker.remove();
          body.innerHTML = `<p style="padding:8px;color:#555;">La capa <b>${esc(layer.legend || layer.name || 'Capa')}</b> no expone sub-capas consultables en el estilo.</p>`;
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

    // ── Paso 2 de una capa MapLibre: tabla de atributos de una sub-capa ──
    // Consulta los features de un source-layer concreto dentro del viewport
    // (querySourceFeatures) y construye la tabla de atributos, cacheandolos
    // como OL features para permitir el resaltado al pulsar una fila.
    function buildMapLibreFeaturesTable(layer, sourceId, sourceLayer) {
      const layerName = layer.legend || layer.name || 'Capa';
      const ml = getMapLibreMap(layer);
      let gjFeatures = [];
      try {
        gjFeatures = ml.querySourceFeatures(sourceId, { sourceLayer: sourceLayer }) || [];
      } catch (e) { gjFeatures = []; }
      if (!gjFeatures.length) {
        return `<p style="padding:8px;color:#555;">No hay features de <b>${esc(sourceLayer)}</b> en el viewport actual del mapa. Acércate (zoom) o desplázate a una zona con datos y vuelve a pulsar la sub-capa.</p>`;
      }

      // Derivar columnas a partir de las propiedades (GeoJSON).
      const columns = [];
      const rows = gjFeatures.slice(0, 500).map(function (gj) {
        const props = (gj && gj.properties && typeof gj.properties === 'object') ? gj.properties : {};
        const ol = geoJsonToOlFeature(gj);
        for (const k in props) { if (!columns.includes(k)) columns.push(k); }
        return { props: props, feature: ol, geometry: ol && ol.getGeometry ? ol.getGeometry() : null };
      });
      if (!columns.length) columns.push('(sin atributos)');

      // Cachear en sheetCtx (misma estructura que buildVectorTable) para que
      // locateFeatureByIdx resalte el feature convenido al pulsar la fila.
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
      let html = `<p class="ls-sheet-note" style="margin-top:0;">Sub-capa <b>${esc(sourceLayer)}</b> · ${rows.length} features del viewport.</p>`;
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
          // Las capas MapLibre (BTN) no tienen una fuente OL enumerable: se abre
          // el panel y se instala un dropdown secundario con sus sub-capas. El
          // builder es asincrono (espera a que cargue el estilo), asi que se
          // abre el cuerpo vacio y se rellena al cargar.
          if (isMapLibreLayer(layer)) {
            const panel = openSheet(`Tabla de atributos · ${layerName}`, '<p style="padding:8px;color:#555;">Cargando sub-capas…</p>', true, selectableLayers, index);
            installMapLibreSubPicker(panel, layer, panel.querySelector('.ls-sheet-body'));
            return;
          }
          openSheet(`Tabla de atributos · ${layerName}`, buildVectorTable(layer), true, selectableLayers, index);
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

    control.activate();
  }

  // Destruccion. map.removePlugins() de la API la exige: sin este metodo lanza
  // "t.destroy is not a function" y aborta el resto del lote de plugins.
  // Deja el mapa como estaba: suelta el control (y con el el panel), desengancha
  // el clic sobre el mapa y el de ADDED_LAYER, y borra los ayudantes globales
  // que el plugin deja en window para los atributos onclick en linea del panel.
  destroy() {
    this._destruirSupra();
    // 1) Clic sobre el mapa (singleclick del impl de OpenLayers).
    try {
      if (this._unbindMapClick) this._unbindMapClick();
    } catch (e) { /* ignora: el mapa puede estar ya destruido */ }
    this._unbindMapClick = null;

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
      'startRenameLayer', '_renameLayerName', 'handleDragStart', 'handleDragOver',
      'handleDrop', 'handleDragEnd', 'deleteLayer', 'getLayerKind', 'setLayerOpacity',
      'zoomToLayer', 'closeSheet', 'locateFeature', 'openLayerInfo', 'openLayerFicha',
      '_lsPickerLayers',
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

