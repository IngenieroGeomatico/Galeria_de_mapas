/* =====================================================================
   PLUGIN BASE / SEMILLA TRANSVERSAL PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   Esta clase base (miPlugin_base) centraliza TODOS los elementos transversales
   y repetitivos de los plugins del repositorio:
     1. Resolución dual de API (api(): window.IDEE || window.M).
     2. Autoinyección de su propia hoja de estilos (pluginBase.css).
     3. Constructor estándar: position, collapsible, order, colors (1, 2, 3),
        icon (SVG / data-URI / URL), title, className, etc.
     4. Normalizador de colores (resolveColor).
     5. Normalizador de icono para máscara CSS (urlDeIcono).
     6. Montaje estándar de Panel y Control (_addToBase / createStandardPanel).
     7. Contrato de Supraplugin (getSupraElement, _sincronizarSupra, _ocultarBotonDelMapa).
     8. Contrato de Estado 2D/3D (getState / setState con panelCollapsed y hooks).
     9. Helpers de resolución de capas recursivos e inmunes al cambio de implementación
        (_findLayerByIdInMap, _findLayerByLegendInMap, _findLayer, _getAllLayersFlat).
    10. Ayuda estándar (getHelp con Promise y stringToHtml).
    11. Ciclo de vida y limpieza (destroy, _destruirSupra).
    12. Helper de registro global triple (miPlugin_base.registrar).

   CÓMO USAR EN UN PLUGIN:
   ---------------------------------------------------------------------
   En el archivo del plugin (ej. ext/miHerramienta/miHerramienta.js):

   (function () {
     "use strict";

     // 1. Autocargar la clase base de forma transparente si no está cargada aún
     const SRC = (document.currentScript && document.currentScript.src) || '';
     const RUTA_BASE = SRC ? new URL('../pluginBase/pluginBase.js', SRC).href : '';
     if (!window.miPlugin_base && RUTA_BASE && !document.querySelector('script[data-pluginbase-js]')) {
       if (document.readyState === 'loading') {
         document.write('<script type="text/javascript" data-pluginbase-js="1" src="' + RUTA_BASE + '"><\\/script>');
       } else {
         const s = document.createElement('script');
         s.src = RUTA_BASE;
         s.setAttribute('data-pluginbase-js', '1');
         document.head.appendChild(s);
       }
     }

     const BaseClass = window.miPlugin_base || class {};

     // 2. Definir tu plugin heredando de BaseClass
     class miPlugin_miHerramienta extends BaseClass {
       constructor(options = {}) {
         super(options);
         this.name = 'miPlugin_miHerramienta';
         // Variables específicas...
       }

       addTo(map) {
         this._addToBase(map, 'tools_miHerramienta', 'control_miHerramienta',
                         'g-herramienta_miHerramienta g-panel-lateral');
         this._control.createView = (html) => this._buildUI(html);
       }

       _buildUI(html) {
         const div = document.createElement('div');
         // UI específica...
         return div;
       }

       getCustomState() {
         return { miDato: this._miDato };
       }

       setCustomState(state, map) {
         if (state && state.miDato !== undefined) this._miDato = state.miDato;
       }
     }

     if (typeof miPlugin_base !== 'undefined' && miPlugin_base.registrar) {
       miPlugin_base.registrar(miPlugin_miHerramienta, 'miPlugin_miHerramienta');
     } else {
       window.miPlugin_miHerramienta = miPlugin_miHerramienta;
     }
   })();
   ===================================================================== */

(function () {
  "use strict";

  /**
   * Resuelve la URL absoluta de este script para autoinyectar el CSS base.
   */
  const SRC_SCRIPT = (document.currentScript && document.currentScript.src) || (function () {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const s = scripts[i].src || '';
      if (/pluginBase\/pluginBase\.js(\?|#|$)/.test(s)) return s;
    }
    return '';
  })();

  /**
   * Autoinyecta pluginBase.css en el <head> si no está presente todavía.
   */
  (function inyectarCssPropio() {
    if (!SRC_SCRIPT || typeof document === 'undefined') return;
    if (document.querySelector('link[data-pluginbase-css]')) return;
    try {
      const urlCss = new URL('./pluginBase.css', SRC_SCRIPT).href;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = urlCss;
      link.setAttribute('data-pluginbase-css', '1');
      if (document.head) {
        document.head.appendChild(link);
      } else {
        document.addEventListener('DOMContentLoaded', () => document.head && document.head.appendChild(link));
      }
    } catch (e) {
      /* Silencioso */
    }
  })();

  /**
   * Resuelve el objeto global de la API cartográfica activa (IDEE o M).
   * @returns {Object} Espacio de nombres de la API.
   */
  function api() {
    return window.IDEE || window.M;
  }

  /**
   * Envuelve contenido suelto de un SVG en un `<svg>` de 24x24 estándar.
   * @param {string} contenido
   * @returns {string}
   */
  function envolverSvg(contenido) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' + contenido + '</svg>';
  }

  /**
   * Prepara un SVG para meterlo en un data URI codificando caracteres especiales.
   * @param {string} svg
   * @returns {string}
   */
  function codificarSvg(svg) {
    return encodeURIComponent(svg)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/'/g, '%27')
      .replace(/\+/g, '%20');
  }

  /**
   * Convierte una definición de icono (SVG string, path suelto, data URI o ruta/URL)
   * en un valor apto para la propiedad CSS `mask-image` o variable `--g-plugin-icon-mask`.
   * @param {string} icono
   * @returns {string|null}
   */
  function urlDeIcono(icono) {
    if (typeof icono !== 'string') return null;
    const limpio = icono.trim();
    if (!limpio) return null;

    // Si ya es una URL, ruta relativa/absoluta o data URI:
    const esUrl = /^(data:|https?:|blob:|file:|\/|\.\/|\.\.\/)/i.test(limpio)
      || /\.svg(?:[?#].*)?$/i.test(limpio);
    if (esUrl) {
      return 'url("' + limpio.replace(/"/g, '%22').replace(/\s/g, '%20') + '")';
    }

    const traeSvg = /<svg[\s>]/i.test(limpio);
    const traeForma = /<(path|circle|rect|line|polyline|polygon|ellipse|g|use|symbol|text)\b/i.test(limpio);
    if (!traeSvg && !traeForma) return null;

    const svg = traeSvg ? limpio : envolverSvg(limpio);
    return 'url("data:image/svg+xml,' + codificarSvg(svg) + '")';
  }

  /**
   * Clase base transversal para todos los plugins del repositorio.
   */
  class miPlugin_base {
    /**
     * @param {Object} [options={}] Opciones de inicialización.
     * @param {string} [options.position='TL'] Esquina del mapa ('TL', 'TR', 'BL', 'BR').
     * @param {boolean} [options.collapsible=true] Si el panel puede replegarse a botón.
     * @param {number|null} [options.order=null] Posición CSS order en el área de la API.
     * @param {string|Object} [options.color1] Color de fondo ({ active, deactive } o string).
     * @param {string|Object} [options.color2] Color de borde ({ active, deactive } o string).
     * @param {string|Object} [options.color3] Color de icono/texto ({ active, deactive } o string).
     * @param {string} [options.icon] SVG, path o URL del icono.
     * @param {string} [options.title] Título del panel o tooltip.
     * @param {string} [options.className] Clases CSS adicionales.
     */
    constructor(options = {}) {
      this.name = 'miPlugin_base';
      this.options = options || {};

      // Referencias al mapa y componentes de la UI
      this._map = null;
      this._panel = null;
      this._control = null;

      // Configuración de disposición y orden
      this.position = options.position || 'TL';
      this.collapsible = (options.collapsible !== undefined) ? Boolean(options.collapsible) : true;
      this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
        ? Number(options.order)
        : null;

      // Colores de interfaz
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

      // Icono y títulos
      this.icon = options.icon || options.icono || options.svg || null;
      this.title = options.title || options.titulo || options.tooltip || options.tituloBarra || '';
      this.className_ = options.className || '';

      // Integración Supraplugin
      this.supra = null;
      this._supraWrap = null;
      this._supraBoton = null;
      this._syncDoc = null;
    }

    /**
     * Acceso al espacio de nombres de la API activa.
     */
    api() {
      return api();
    }

    /**
     * Normaliza un color a formato `{ active, deactive }`.
     * @param {string|Object} c
     * @returns {{active: string, deactive: string}}
     */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /**
     * Convierte una definición de icono en url(...) para CSS.
     */
    urlDeIcono(icono) {
      return urlDeIcono(icono);
    }

    /**
     * Devuelve la implementación activa del mapa: 'cesium' o 'ol'.
     * @returns {string}
     */
    getMapImplType() {
      const map = this._map || this.map;
      if (!map) return 'ol';
      try {
        const impl = map.getMapImpl();
        return (impl && impl.scene && impl.scene.camera && typeof Cesium !== 'undefined') ? 'cesium' : 'ol';
      } catch (e) {
        return 'ol';
      }
    }

    /**
     * Comprueba si el mapa se está ejecutando bajo la implementación 3D de Cesium.
     * @returns {boolean}
     */
    isCesium() {
      return this.getMapImplType() === 'cesium';
    }

    /**
     * Busca una capa en el mapa activo utilizando identificadores estables (legend o name).
     * Útil tras el swap 2D/3D cuando los idLayer se regeneran.
     * @param {string} legend El legend o name de la capa a buscar.
     * @returns {Object|null} La capa de la API o null si no se encuentra.
     */
    findLayerByLegend(legend) {
      const map = this._map || this.map;
      if (!map || !legend) return null;
      try {
        const layers = map.getLayers();
        if (!Array.isArray(layers)) return null;
        const target = String(legend).trim().toLowerCase();
        return layers.find(l => {
          if (!l) return false;
          const leg = l.legend ? String(l.legend).trim().toLowerCase() : '';
          const nam = l.name ? String(l.name).trim().toLowerCase() : '';
          const id = l.idLayer ? String(l.idLayer).trim().toLowerCase() : '';
          return leg === target || nam === target || id === target;
        }) || null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Busca una capa en el mapa activo utilizando su idLayer, con fallback
     * a su legend/name estable si el ID original se perdió tras el swap 2D/3D.
     * @param {string} idLayer Identificador de la capa.
     * @param {string} [fallbackLegend] Leyenda o nombre estable de la capa.
     * @returns {Object|null} La capa de la API o null si no se encuentra.
     */
    findLayerById(idLayer, fallbackLegend) {
      const map = this._map || this.map;
      if (!map) return null;
      try {
        let l = null;
        if (idLayer) {
          const layers = map.getLayers();
          if (Array.isArray(layers)) {
            l = layers.find(layer => layer && layer.idLayer === idLayer) || null;
          }
        }
        if (!l && fallbackLegend) {
          l = this.findLayerByLegend(fallbackLegend);
        }
        return l;
      } catch (e) {
        return null;
      }
    }

    /**
     * Centra el mapa en las coordenadas especificadas, realizando la reproyección
     * condicional síncrona a EPSG:4326 (lon/lat) si el mapa está en modo 3D (Cesium).
     * En modo 2D (OpenLayers) asume la proyección EPSG:3857 (Web Mercator) por defecto.
     * @param {number} x Coordenada X (EPSG:3857).
     * @param {number} y Coordenada Y (EPSG:3857).
     * @param {number} [zoom] Nivel de zoom opcional a aplicar.
     */
    centrarMapa(x, y, zoom) {
      const map = this._map || this.map;
      if (!map) return;
      try {
        let coords = [x, y];
        if (this.isCesium()) {
          const IDEE = this.api();
          if (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function') {
            coords = IDEE.utils.reproject([x, y], 'EPSG:3857', 'EPSG:4326');
          }
        }
        map.setCenter(coords);
        if (zoom !== undefined && zoom !== null) {
          map.setZoom(zoom);
        }
      } catch (e) {
        console.error('[miPlugin_base] Error al centrar el mapa:', e);
      }
    }

    /**
     * Retorna el elemento DOM raíz del panel.
     * @param {Object} [panelRef] Referencia opcional al panel.
     * @returns {HTMLElement|null}
     */
    _elementoPanel(panelRef) {
      const pan = panelRef || this._panel;
      if (!pan) return null;
      try { if (pan._element) return pan._element; } catch (e) { /* sigue */ }
      try {
        if (typeof pan.getElement === 'function') {
          const el = pan.getElement();
          if (el) return el;
        }
      } catch (e) { /* sigue */ }
      try {
        const btn = (typeof pan.getButtonPanel === 'function') ? pan.getButtonPanel() : null;
        if (btn && btn.parentElement) return btn.parentElement;
      } catch (e) { /* sigue */ }
      return null;
    }

    /**
     * Comprueba si el panel se encuentra actualmente colapsado/cerrado.
     * @returns {boolean}
     */
    _panelColapsado() {
      if (!this._panel) return true;
      if (this._panel._collapsed !== undefined) return !!this._panel._collapsed;
      if (typeof this._panel.isCollapsed === 'function') {
        try { return !!this._panel.isCollapsed(); } catch (e) { /* sigue */ }
      }
      const el = this._elementoPanel();
      return el ? el.classList.contains('collapsed') : true;
    }

    // =========================================================================
    // MONTAJE BASE DE PANEL Y CONTROL
    // =========================================================================

    /**
     * Inicializa y registra en el mapa el panel estándar y el control.
     * Aplica position, collapsible, order, colores, icono y clases transversales.
     *
     * @param {Object} map Instancia del mapa (IDEE.Map / M.Map).
     * @param {string} [panelId] Identificador único del panel (ej. 'tools_miPlugin').
     * @param {string} [controlId] Identificador del control (ej. 'control_miPlugin').
     * @param {string} [customClassName] Clases CSS adicionales del panel.
     * @returns {miPlugin_base} Retorna `this` para encadenamiento.
     */
    _addToBase(map, panelId, controlId, customClassName) {
      const IDEE = api();
      this._map = map;

      const pId = panelId || ('tools_' + this.name.replace(/^miPlugin_/, ''));
      const cId = controlId || ('control_' + this.name.replace(/^miPlugin_/, ''));

      const clases = ['g-plugin-base', 'g-panel-lateral'];
      if (customClassName) clases.push(customClassName);
      if (this.className_) clases.push(this.className_);
      const finalClassName = Array.from(new Set(clases.join(' ').split(/\s+/))).filter(Boolean).join(' ');

      this._panel = new IDEE.ui.Panel(pId, {
        collapsible: this.collapsible,
        collapsed: true,
        className: finalClassName,
        position: this.position,
      });

      this._control = new IDEE.Control({ form: (html) => html }, cId);

      // Aplicar CSS order para reordenación en flex column del .m-area
      if (this.order !== null && this._panel && this._panel.element) {
        try { this._panel.element.style.order = String(this.order); } catch (e) { /* noop */ }
      }

      // Inyectar variables CSS de colores e icono
      this._aplicarEstilosBase();

      map.addPanels(this._panel);
      this._panel.addControls(this._control);

      return this;
    }

    /**
     * Inyecta variables CSS de colores y máscara de icono en el elemento del panel.
     */
    _aplicarEstilosBase() {
      const el = this._elementoPanel();
      if (!el) return;

      const c1 = this.resolveColor(this.color1);
      const c2 = this.resolveColor(this.color2);
      const c3 = this.resolveColor(this.color3);

      el.style.setProperty('--g-plugin-bg-color', c1.deactive);
      el.style.setProperty('--g-plugin-bg-color-active', c1.active);
      el.style.setProperty('--g-plugin-border-color', c2.deactive);
      el.style.setProperty('--g-plugin-border-color-active', c2.active);
      el.style.setProperty('--g-plugin-icon-color', c3.deactive);
      el.style.setProperty('--g-plugin-icon-color-active', c3.active);

      const urlIco = urlDeIcono(this.icon);
      if (urlIco) {
        el.style.setProperty('--g-plugin-icon-mask', urlIco);
      }
    }

    // =========================================================================
    // CONTRATO SUPRAPLUGIN (getSupraElement)
    // =========================================================================

    /**
     * Devuelve el elemento interactivo para alojar el plugin en una barra supraplugin.
     * @param {Object} supra Instancia del supraplugin contenedor.
     * @returns {HTMLElement} Contenedor con el botón del plugin para la barra.
     */
    getSupraElement(supra) {
      this.supra = supra || null;
      this._supraWrap = this._construirSupraUI();
      this._ocultarBotonDelMapa();
      this._sincronizarSupra();
      return this._supraWrap;
    }

    _construirSupraUI() {
      const self = this;
      const wrap = document.createElement('div');
      wrap.className = 'g-supra-item__wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      const conTexto = !!(this.supra && this.supra.options && this.supra.options.conTexto);
      const tituloTexto = this.title || this.name.replace(/^miPlugin_/, '');

      btn.className = 'supra-bar__boton ' + (conTexto ? '' : 'supra-bar__boton--solo ') + 'g-supra-item__boton';
      btn.title = tituloTexto;
      btn.setAttribute('aria-label', tituloTexto);
      btn.setAttribute('aria-expanded', 'false');

      const iconoSpan = document.createElement('span');
      iconoSpan.className = 'supra-bar__boton-icono g-supra-item__icono';
      iconoSpan.setAttribute('aria-hidden', 'true');

      const urlIco = urlDeIcono(this.icon);
      if (urlIco) {
        iconoSpan.style.setProperty('--g-plugin-icon-mask', urlIco);
      }

      btn.appendChild(iconoSpan);

      if (conTexto) {
        const textoSpan = document.createElement('span');
        textoSpan.className = 'supra-bar__boton-texto';
        textoSpan.textContent = tituloTexto;
        btn.appendChild(textoSpan);
      }

      btn.addEventListener('click', function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        self._alternarPanelDesdeBarra();
      });

      wrap.appendChild(btn);
      this._supraBoton = btn;

      // Sincronizar estado cuando el usuario pulsa fuera y la API cierra el panel
      if (!this._syncDoc && typeof document !== 'undefined') {
        this._syncDoc = function () { self._sincronizarSupra(); };
        document.addEventListener('click', this._syncDoc, true);
      }

      return wrap;
    }

    _alternarPanelDesdeBarra() {
      if (!this._panel) return;
      try {
        if (this._panelColapsado()) {
          if (typeof this._panel.open === 'function') this._panel.open();
        } else {
          if (typeof this._panel.collapse === 'function') this._panel.collapse();
        }
      } catch (e) {
        console.warn('[' + this.name + '] no se pudo alternar panel:', e);
      }
      this._sincronizarSupra();
    }

    _sincronizarSupra() {
      if (!this._supraBoton) return;
      const abierto = !this._panelColapsado();
      this._supraBoton.classList.toggle('supra-bar__boton--activo', abierto);
      this._supraBoton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    }

    _ocultarBotonDelMapa() {
      const el = this._elementoPanel();
      if (el) el.classList.add('g-panel-en-barra');
    }

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

    // =========================================================================
    // CONTRATO DE ESTADO 2D / 3D (getState / setState)
    // =========================================================================

    /**
     * Captura el estado transversal del plugin (panel colapsado) y combina
     * el estado específico devuelto por `getCustomState()`.
     * @returns {Object}
     */
    getState() {
      const baseState = {
        panelCollapsed: this._panelColapsado(),
      };
      if (typeof this.getCustomState === 'function') {
        const custom = this.getCustomState();
        if (custom && typeof custom === 'object') {
          Object.assign(baseState, custom);
        }
      }
      return baseState;
    }

    /**
     * Restaura el estado transversal del plugin y delega en `setCustomState()`
     * la restauración de parámetros específicos.
     * @param {Object} state
     * @param {Object} [map]
     */
    setState(state, map) {
      if (!state) return;
      this._map = map || this._map;

      const collapsed = (state.panelCollapsed !== undefined) ? state.panelCollapsed : state.collapsed;
      if (collapsed !== undefined && this._panel) {
        try {
          if (collapsed && typeof this._panel.collapse === 'function') {
            this._panel.collapse();
          } else if (!collapsed && typeof this._panel.open === 'function') {
            this._panel.open();
          }
        } catch (e) { /* defensivo */ }
      }

      this._sincronizarSupra();

      if (typeof this.setCustomState === 'function') {
        try {
          this.setCustomState(state, map);
        } catch (e) {
          console.warn('[' + this.name + '] error en setCustomState:', e);
        }
      }
    }

    // =========================================================================
    // HELPERS DE BÚSQUEDA Y GESTIÓN DE CAPAS (2D / 3D)
    // =========================================================================

    /**
     * Busca una capa por su `idLayer` en el mapa, explorando recursivamente grupos.
     * @param {Object} mapRef
     * @param {string|number} id
     * @returns {Object|null}
     */
    _findLayerByIdInMap(mapRef, id) {
      const mapa = mapRef || this._map;
      if (!mapa || typeof mapa.getLayers !== 'function' || id === null || id === undefined) {
        return null;
      }
      try {
        const isGroup = (l) => Boolean(
          l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function')
        );
        const allLayers = mapa.getLayers() || [];
        const stack = [];
        for (const l of allLayers) {
          if (l && String(l.idLayer) === String(id)) return l;
          if (isGroup(l)) stack.push(l);
        }
        while (stack.length > 0) {
          const g = stack.pop();
          let hijos = [];
          try {
            hijos = (typeof g.getLayers === 'function') ? g.getLayers() : [];
          } catch (e) {
            hijos = [];
          }
          for (const h of hijos) {
            if (h && String(h.idLayer) === String(id)) return h;
            if (isGroup(h)) stack.push(h);
          }
        }
      } catch (e) { /* silencioso */ }
      return null;
    }

    /**
     * Busca una capa por su identificador estable (`legend` o `name`), recursivo en grupos.
     * @param {Object} mapRef
     * @param {string} ident
     * @returns {Object|null}
     */
    _findLayerByLegendInMap(mapRef, ident) {
      const mapa = mapRef || this._map;
      if (!mapa || typeof mapa.getLayers !== 'function' || !ident) {
        return null;
      }
      try {
        const isGroup = (l) => Boolean(
          l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function')
        );
        const coincide = (c) => Boolean(
          c && (
            (c.legend && String(c.legend) === String(ident)) ||
            (c.name && String(c.name) === String(ident))
          )
        );
        const allLayers = mapa.getLayers() || [];
        const stack = [];
        for (const l of allLayers) {
          if (coincide(l)) return l;
          if (isGroup(l)) stack.push(l);
        }
        while (stack.length > 0) {
          const g = stack.pop();
          let hijos = [];
          try {
            hijos = (typeof g.getLayers === 'function') ? g.getLayers() : [];
          } catch (e) {
            hijos = [];
          }
          for (const h of hijos) {
            if (coincide(h)) return h;
            if (isGroup(h)) stack.push(h);
          }
        }
      } catch (e) { /* silencioso */ }
      return null;
    }

    /**
     * Resuelve una capa primero por idLayer y, si no existe, por legend/name.
     * @param {Object} mapRef
     * @param {string} idOrIdent
     * @returns {Object|null}
     */
    _findLayer(mapRef, idOrIdent) {
      return this._findLayerByIdInMap(mapRef, idOrIdent) || this._findLayerByLegendInMap(mapRef, idOrIdent);
    }

    /**
     * Obtiene una lista plana con todas las capas del mapa (desenrollando grupos).
     * @param {Object} [mapRef]
     * @returns {Array<Object>}
     */
    _getAllLayersFlat(mapRef) {
      const mapa = mapRef || this._map;
      if (!mapa || typeof mapa.getLayers !== 'function') return [];
      const resultado = [];
      const isGroup = (l) => Boolean(
        l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function')
      );
      const stack = [...(mapa.getLayers() || [])];
      while (stack.length > 0) {
        const item = stack.shift();
        if (!item) continue;
        resultado.push(item);
        if (isGroup(item)) {
          try {
            const hijos = (typeof item.getLayers === 'function') ? item.getLayers() : [];
            stack.unshift(...hijos);
          } catch (e) { /* sigue */ }
        }
      }
      return resultado;
    }

    // =========================================================================
    // AYUDA Y CICLO DE VIDA
    // =========================================================================

    /**
     * Proporciona la ayuda integrada para el gestor de ayuda de la API-IDEE.
     * @returns {{title: string, content: Promise<HTMLElement|string>}}
     */
    getHelp() {
      const IDEE = api();
      const titulo = this.title || this.name.replace(/^miPlugin_/, '');
      return {
        title: titulo,
        content: new Promise((resolve) => {
          let html = '<div><p>Ayuda de la herramienta ' + titulo + '.</p></div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            try {
              html = IDEE.utils.stringToHtml(html);
            } catch (e) { /* fallback defensivo */ }
          }
          resolve(html);
        }),
      };
    }

    /**
     * Limpieza de recursos y ciclo de vida del plugin.
     */
    destroy() {
      this._destruirSupra();
      try {
        if (this._panel && typeof this._panel.destroy === 'function') {
          this._panel.destroy();
        }
      } catch (e) { /* noop */ }
      this._map = null;
      this._panel = null;
      this._control = null;
    }

    // =========================================================================
    // HELPER ESTÁTICO DE REGISTRO GLOBAL TRIPLE
    // =========================================================================

    /**
     * Registra de forma defensiva la clase del plugin en:
     *  - `window[nombreClase]`
     *  - `window.IDEE.plugin[nombreClase]`
     *  - `window.M.plugin[nombreClase]`
     *
     * @param {Function} ClaseConstructor Clase del plugin.
     * @param {string} nombreClase Nombre identificador (ej. 'miPlugin_miHerramienta').
     */
    static registrar(ClaseConstructor, nombreClase) {
      if (typeof window === 'undefined') return;
      const nom = nombreClase || ClaseConstructor.name;
      if (!nom) return;

      window[nom] = ClaseConstructor;

      window.IDEE = window.IDEE || {};
      window.IDEE.plugin = window.IDEE.plugin || {};
      window.IDEE.plugin[nom] = ClaseConstructor;

      window.M = window.M || {};
      window.M.plugin = window.M.plugin || {};
      window.M.plugin[nom] = ClaseConstructor;
    }
  }

  // Registro global triple de la clase base
  miPlugin_base.registrar(miPlugin_base, 'miPlugin_base');
})();
