/* =====================================================================
   PLANTILLA DE ITEM PARA BARRA SUPRAPLUGIN (API-IDEE / API-CNIG)
   Repositorio: Galeria_de_mapas
   =====================================================================

   ¿QUÉ ES UN ITEM DE SUPRAPLUGIN?
   --------------------------------------------------------------------
   Un supraplugin (`miPlugin_supraplugin`, ver `ext/supraplugin/supraplugin.js`)
   es un contenedor o barra transversal colocada por encima (arriba) o por
   debajo del visualizador cartográfico. A diferencia de un panel estándar
   (`IDEE.ui.Panel`), que vive confinado dentro del viewport de un mapa
   concreto, el supraplugin es un contenedor transversal que aloja
   herramientas globales y componentes que operan sobre el mapa o sobre
   múltiples instancias simultáneas (p. ej. el comparador de vistas).

   Un "item" es cualquier componente UI que se cuelga de la barra
   mediante `supra.addItem(item)`.

   CONTRATO DE UN ITEM DE SUPRAPLUGIN:
   --------------------------------------------------------------------
   La vía recomendada para crear un item avanzado es encapsularlo en una
   clase ES6 que implemente el método `getSupraElement(supra)`:

     1. `getSupraElement(supra)`:
        Recibe como argumento la instancia del supraplugin anfitrión.
        Debe guardar la referencia (`this.supra = supra`) y DEVOLVER un
        elemento HTML (`HTMLElement`) o una `Promise<HTMLElement>`.
        Este método se re-invoca de forma automática cada vez que la barra
        se monta o se reconstruye (por ejemplo, tras un cambio 2D/3D
        provocado por `cambioImpl`).

     2. Contrato de conservación de estado (`getState` / `setState`):
        - `getState()`: Devuelve un objeto JSON-serializable con el estado
          mínimo de la interfaz del item (textos, contadores, flags, etc.).
        - `setState(state, map)`: Recibe el estado previamente capturado
          y la nueva instancia del mapa tras una alternancia 2D/3D.
          Debe aplicar guardas defensivas (`if (!state || typeof state !== 'object') return;`)
          y rehidratar los valores sin asumir que referencias a capas u
          objetos del mapa anterior sigan vivas.

   PASOS PARA CREAR UN ITEM NUEVO A PARTIR DE ESTA PLANTILLA:
   --------------------------------------------------------------------
   1. Copiar la carpeta completa:
      `ext/plantilla_supraplugin/` -> `ext/<nombre_del_item>/`

   2. Renombrar los ficheros:
      `plantilla_item.js`  -> `<nombre_del_item>.js`
      `plantilla_item.css` -> `<nombre_del_item>.css`

   3. Sustituir el identificador "miPlugin_plantillaItem" en los 7 sitios clave:
      - [1] Nombre de la clase: `class miPlugin_<nombre>`
      - [2] Propiedad de nombre interno: `this.name = 'miPlugin_<nombre>'`
      - [3] Exposición global directa: `window.miPlugin_<nombre> = ...`
      - [4] Registro en IDEE.plugin: `window.IDEE.plugin.miPlugin_<nombre> = ...`
      - [5] Registro en M.plugin: `window.M.plugin.miPlugin_<nombre> = ...`
      - [6] Clases CSS y selectores en `<nombre_del_item>.css` y `_buildUI()`
      - [7] Instanciación en `mapas/<visualizador>/js/mapa.js` y `<script>` en `index.html`

   4. Implementar la UI deseada en `_buildUI()` y la lógica de negocio.
   ===================================================================== */

(function () {
  "use strict";

  /**
   * Resuelve el objeto global de la API cartográfica (IDEE o M).
   * @returns {Object} Espacio de nombres de la API-IDEE / API-CNIG.
   */
  function api() {
    return window.IDEE || window.M;
  }

  /**
   * Generador de identificadores únicos para instancias del item.
   */
  var _uid = 0;
  function nextUid() {
    _uid += 1;
    return _uid;
  }

  /**
   * Clase modelo de un item para barra supraplugin.
   */
  class miPlugin_plantillaItem {
    /**
     * @param {Object} [options={}] Opciones de configuración inicial.
     * @param {string} [options.id] Identificador único del item.
     * @param {string} [options.texto='Botón de ejemplo'] Texto inicial del botón.
     * @param {number} [options.vecesPulsado=0] Contador inicial de pulsaciones.
     * @param {boolean} [options.activo=false] Estado activo/inactivo inicial.
     * @param {number} [options.order=null] Posición del item dentro de la barra
     * supraplugin (CSS `order` sobre su ranura; las ranuras sin `order` valen 0):
     * -1 => por delante de todos, 0 => primera posición, 2 => detrás de las de
     * 0, 99 => al final, null => orden natural de addItem. Lo lee el
     * supraplugin al montar el item, así que no hay que hacer nada más con él.
     * @param {Function} [options.onClick] Callback opcional invocado al pulsar.
     */
    constructor(options = {}) {
      // Identificador formal del item / plugin
      this.name = "miPlugin_plantillaItem";
      this.options = options || {};
      this.id = this.options.id || ("plantillaItem-" + nextUid());

      // Posición en la barra supraplugin (la lee el supraplugin al montar).
      this.order = (this.options.order !== undefined && this.options.order !== null
        && !isNaN(Number(this.options.order))) ? Number(this.options.order) : null;

      // Referencia a la barra supraplugin anfitriona y al contenedor DOM
      this.supra = null;
      this.container = null;
      this._btn = null;
      this._textoSpan = null;
      this._badgeSpan = null;

      // Estado interno del item
      this._texto = (typeof this.options.texto === "string") ? this.options.texto : "Botón de ejemplo";
      this._vecesPulsado = (typeof this.options.vecesPulsado === "number" && !isNaN(this.options.vecesPulsado))
        ? this.options.vecesPulsado
        : 0;
      this._activo = Boolean(this.options.activo);
      this._onClickCallback = (typeof this.options.onClick === "function") ? this.options.onClick : null;

      // Colores configurables, con el mismo reparto y los mismos valores por
      // defecto que el resto de plugins del repositorio (color1 = fondo,
      // color2 = borde, color3 = icono y texto; ver
      // ext/CalidadAireMadridTiempoReal). Este item es la plantilla de los items
      // del supraplugin, así que el color se hereda del que se le pase al
      // supraplugin y, si no, del naranja del esquema.
      this.color1 = (this.options.color1 !== undefined) ? this.options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (this.options.color2 !== undefined) ? this.options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (this.options.color3 !== undefined) ? this.options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
    }

    /**
     * Devuelve {active, deactive} a partir de un color simple o de un objeto.
     * @param {string|Object} c Color u objeto de colores.
     * @returns {{active: string, deactive: string}} Los dos estados.
     */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /**
     * Vuelca los colores configurados a variables CSS del contenedor del item.
     *
     *  Las seis variables del esquema (reposo y activo de fondo, borde e icono) se
     *  ponen en línea sobre el nodo raíz del item, y plantilla_item.css las
     *  consume con `var(--g-plugin-bg-color, orangered)` y compañía.
     *
     *  Si el item está dentro de un supraplugin y este trae sus propios colores,
     *  se usan los del supraplugin: la barra es una sola cosa y sus items no
     *  pueden ir cada uno de un color.
     * @returns {boolean} true si se pudieron poner las variables.
     */
    _aplicarColores() {
      try {
        if (!this.container || !this.container.style) return false;
        const supra = this.supra;
        const c1 = this.resolveColor((supra && supra.color1 !== undefined) ? supra.color1 : this.color1);
        const c2 = this.resolveColor((supra && supra.color2 !== undefined) ? supra.color2 : this.color2);
        const c3 = this.resolveColor((supra && supra.color3 !== undefined) ? supra.color3 : this.color3);
        this.container.style.setProperty('--g-plugin-bg-color', c1.deactive);
        this.container.style.setProperty('--g-plugin-bg-color-active', c1.active);
        this.container.style.setProperty('--g-plugin-border-color', c2.deactive);
        this.container.style.setProperty('--g-plugin-border-color-active', c2.active);
        this.container.style.setProperty('--g-plugin-icon-color', c3.deactive);
        this.container.style.setProperty('--g-plugin-icon-color-active', c3.active);
        return true;
      } catch (e) {
        console.warn(`[${this.name}] no se pudieron aplicar los colores.`, e);
        return false;
      }
    }

    // --- Contrato de Item de Supraplugin -----------------------------------

    /**
     * Construye y devuelve el elemento raíz de la UI del item para ser montado
     * dentro de la barra supraplugin. Se invoca automáticamente en cada montaje
     * (incluyendo reinicializaciones tras cambio 2D/3D).
     *
     * @param {Object} supra Instancia del supraplugin anfitrión (miPlugin_supraplugin).
     * @returns {HTMLElement} Elemento DOM con la interfaz del item.
     */
    getSupraElement(supra) {
      this.supra = supra;
      this.container = this._buildUI();
      this._aplicarColores();
      this._updateUI();
      return this.container;
    }

    // --- Contrato de Estado (window.EstadoPlugins / cambioImpl) -------------

    /**
     * Captura el estado serializable actual del item para preservarlo
     * durante la alternancia entre implementaciones 2D (OpenLayers) y 3D (Cesium).
     *
     * @returns {Object} Objeto puro JSON-serializable con el estado mínimo.
     */
    getState() {
      return {
        texto: this._texto,
        vecesPulsado: this._vecesPulsado,
        activo: this._activo
      };
    }

    /**
     * Restaura el estado previamente capturado tras un reinicio del mapa o cambio 2D/3D.
     * Aplica guardas defensivas para asegurar la integridad frente a estados parciales o nulos.
     *
     * @param {Object} state Estado devuelto por getState().
     * @param {Object} [map] Nueva instancia del mapa anfitrión (opcional).
     */
    setState(state, map) {
      if (!state || typeof state !== "object") return;

      if (typeof state.texto === "string") {
        this._texto = state.texto;
      }
      if (typeof state.vecesPulsado === "number" && !isNaN(state.vecesPulsado)) {
        this._vecesPulsado = state.vecesPulsado;
      }
      if (typeof state.activo === "boolean") {
        this._activo = state.activo;
      }

      // Si el DOM ya está construido, reflejar los cambios inmediatamente
      if (this.container) {
        this._updateUI();
      }
    }

    // --- Métodos de Construcción y Actualización de UI -----------------------

    /**
     * Crea la estructura DOM del item.
     * @private
     * @returns {HTMLElement}
     */
    _buildUI() {
      var self = this;

      var wrap = document.createElement("div");
      wrap.className = "plantillaItem";
      wrap.id = this.id;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "plantillaItem__boton";
      btn.setAttribute("aria-label", this._texto);

      var icono = document.createElement("span");
      icono.className = "plantillaItem__icono";
      // TODO: sustituir por un icono propio (SVG inline o imagen) sin emojis.
      icono.textContent = "•";
      icono.setAttribute("aria-hidden", "true");

      var texto = document.createElement("span");
      texto.className = "plantillaItem__texto";
      texto.textContent = this._texto;

      var badge = document.createElement("span");
      badge.className = "plantillaItem__contador";
      badge.textContent = String(this._vecesPulsado);

      btn.appendChild(icono);
      btn.appendChild(texto);
      btn.appendChild(badge);

      // Manejador de eventos: actualiza el estado interno y refresca la UI
      btn.addEventListener("click", function (evt) {
        evt.preventDefault();
        self._vecesPulsado += 1;
        self._activo = !self._activo;
        self._updateUI();

        if (self._onClickCallback) {
          try {
            self._onClickCallback(self, evt);
          } catch (err) {
            console.error("[miPlugin_plantillaItem] Error en callback onClick:", err);
          }
        }
      });

      wrap.appendChild(btn);

      this._btn = btn;
      this._textoSpan = texto;
      this._badgeSpan = badge;

      return wrap;
    }

    /**
     * Refresca los elementos de la interfaz de acuerdo al estado interno actual.
     * @private
     */
    _updateUI() {
      if (this._textoSpan) {
        this._textoSpan.textContent = this._texto;
      }
      if (this._badgeSpan) {
        this._badgeSpan.textContent = String(this._vecesPulsado);
      }
      if (this._btn) {
        if (this._activo) {
          this._btn.classList.add("plantillaItem__boton--activo");
          this._btn.setAttribute("aria-pressed", "true");
        } else {
          this._btn.classList.remove("plantillaItem__boton--activo");
          this._btn.setAttribute("aria-pressed", "false");
        }
      }
    }

    // --- Métodos Públicos Auxiliares ----------------------------------------

    /**
     * Devuelve el mapa actual asociado al supraplugin anfitrión.
     * @returns {Object|null} Instancia del mapa API-IDEE.
     */
    getMap() {
      return (this.supra && typeof this.supra.getMap === "function") ? this.supra.getMap() : null;
    }

    /**
     * Permite cambiar programáticamente el texto del botón.
     * @param {string} nuevoTexto
     */
    setTexto(nuevoTexto) {
      if (typeof nuevoTexto === "string") {
        this._texto = nuevoTexto;
        this._updateUI();
      }
    }

    /**
     * Resetea el contador de clics.
     */
    resetContador() {
      this._vecesPulsado = 0;
      this._activo = false;
      this._updateUI();
    }

    /**
     * Limpia referencias y desmonta el contenedor.
     */
    destroy() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      this._btn = null;
      this._textoSpan = null;
      this._badgeSpan = null;
      this.supra = null;
    }
  }

  // --- Exposición Triple (Resistencia a recargas de bundle en cambioImpl) ----
  if (typeof window !== "undefined") {
    window.miPlugin_plantillaItem = miPlugin_plantillaItem;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_plantillaItem = miPlugin_plantillaItem;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_plantillaItem = miPlugin_plantillaItem;
  }
})();
