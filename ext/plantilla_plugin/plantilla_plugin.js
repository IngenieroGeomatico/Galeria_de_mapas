/* =====================================================================
   PLANTILLA DE PLUGIN PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   Esta plantilla importa automáticamente la clase base transversal
   `miPlugin_base` (`ext/pluginBase/pluginBase.js`) y crea el plugin
   con la parametrización del constructor.
   ===================================================================== */

(function () {
  "use strict";

  // ── 1. Autocarga de la clase base transversal ──────────────────────────
  const SRC_PROPIO = (document.currentScript && document.currentScript.src) || (function () {
    const scripts = document.getElementsByTagName('script');
    return (scripts.length > 0 && scripts[scripts.length - 1].src) || '';
  })();
  const RUTA_BASE = SRC_PROPIO ? new URL('../pluginBase/pluginBase.js', SRC_PROPIO).href : '';

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

  const BaseClass = window.miPlugin_base || (window.IDEE && window.IDEE.plugin && window.IDEE.plugin.miPlugin_base) || class {};

  // ── 2. Definición del plugin ───────────────────────────────────────────
  class miPlugin_plantilla extends BaseClass {
    /**
     * @param {Object} [options={}] Opciones de parametrización del constructor:
     *   - position: 'TL' | 'TR' | 'BL' | 'BR' (por defecto 'TL')
     *   - collapsible: true | false (por defecto true)
     *   - order: number | null (orden en barra flex)
     *   - color1: { active, deactive } | string (fondo)
     *   - color2: { active, deactive } | string (borde)
     *   - color3: { active, deactive } | string (icono/texto)
     *   - icon: string (SVG, path o URL)
     *   - title: string (título o tooltip)
     *   - className: string (clases CSS adicionales)
     */
    constructor(options = {}) {
      super(options);
      this.name = 'miPlugin_plantilla';
    }

    /**
     * Montaje del plugin en el mapa.
     * @param {Object} map Instancia del mapa (IDEE.Map / M.Map).
     */
    addTo(map) {
      this._addToBase(map, 'tools_plantilla', 'control_plantilla', 'g-herramienta_plantilla');
      this._control.createView = (html) => this._buildUI(html);
    }

    /**
     * Construye la vista del panel.
     * @param {HTMLElement|string} [html]
     * @returns {HTMLElement}
     */
    _buildUI(html) {
      const contenedor = document.createElement('div');
      contenedor.className = 'g-plantilla-container';
      return contenedor;
    }

    /**
     * Captura el estado específico del plugin para swap 2D/3D (opcional).
     * @returns {Object}
     */
    getCustomState() {
      return {};
    }

    /**
     * Restaura el estado específico del plugin tras swap 2D/3D (opcional).
     * @param {Object} state
     * @param {Object} [map]
     */
    setCustomState(state, map) {
      // Restauración de estado específico
    }
  }

  // ── 3. Registro global triple ──────────────────────────────────────────
  if (typeof miPlugin_base !== 'undefined' && miPlugin_base.registrar) {
    miPlugin_base.registrar(miPlugin_plantilla, 'miPlugin_plantilla');
  } else {
    window.miPlugin_plantilla = miPlugin_plantilla;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_plantilla = miPlugin_plantilla;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_plantilla = miPlugin_plantilla;
  }
})();
