/* =====================================================================
   Supraplugin para API-IDEE
   --------------------------------------------------------------------
   Un "supraplugin" es un contenedor (barra) TRANSVERSAL a un mapa: se
   coloca ARRIBA o ABAJO del visualizador y aloja otros objetos que operan
   por encima del propio mapa (plugins, controles, HTML suelto e incluso
   otros supraplugins anidados).

   Motivación: algunos plugins (p. ej. el comparador de vistas) no son
   "de un mapa" sino "sobre un mapa" (crean/gestionan varias instancias de
   mapa a la vez). Un IDEE.ui.Panel vive DENTRO del viewport de UN mapa y no
   encaja para eso. El supraplugin resuelve esto creando su propia barra como
   hermana del contenedor del visualizador.

   Diseño (consistente con el resto de ext/*.js):
     - Clase ES6 `miPlugin_supraplugin` con constructor(options) + addTo(map),
       de modo que se pueda registrar con `mapajs.addPlugin(new miPlugin_supraplugin(...))`.
     - Se expone como GLOBAL directo (window.miPlugin_supraplugin), NO solo en
       IDEE.plugin.*, porque el plugin cambioImpl recarga el bundle de la API
       al alternar OL <-> Cesium y reinicializa IDEE.plugin, borrando ese
       registro. El global directo persiste.
     - Singleton por id: si cambioImpl recrea el mapa, el supraplugin se vuelve
       a añadir; reutilizamos/recreamos su barra de forma idempotente y
       re-montamos los items registrados.

   API pública (para que otros objetos se cuelguen del supraplugin):
     supra.addItem(item, opts)        -> añade un item (ver contrato abajo)
     supra.addSupraplugin(subSupra)   -> anida otro supraplugin como item
     supra.getContainer()             -> HTMLElement de la barra
     supra.getItemsContainer()        -> HTMLElement donde se montan los items
     supra.getMap()                   -> mapa API-IDEE actual
     supra.remove()                   -> desmonta la barra y limpia

   Contrato de "item" (cualquiera de estas formas):
     1) HTMLElement                       -> se inserta tal cual.
     2) string (HTML)                     -> se parsea y se inserta.
     3) { getSupraElement(supra) }        -> función que DEVUELVE un HTMLElement
                                             (o Promise<HTMLElement>). Es la vía
                                             recomendada para plugins/controles:
                                             reciben el supraplugin y devuelven su
                                             UI. Se re-invoca en cada montaje
                                             (incluido tras un cambio 2D/3D).
   ===================================================================== */
(function () {
  "use strict";

  // El objeto global de la API puede llamarse IDEE (builds nuevas) o M (alias
  // usado en ejemplos antiguos del repo). Resolvemos el que exista.
  function api() {
    return window.IDEE || window.M;
  }

  // Registro global de supraplugins vivos por id, para hacer el ciclo de vida
  // idempotente frente a los reinicios de cambioImpl.
  window.__supraplugins = window.__supraplugins || {};

  var _uid = 0;
  function nextUid() { _uid += 1; return _uid; }

  class miPlugin_supraplugin {
    /**
     * @param {Object} options
     * @param {string} [options.id]        Id único del supraplugin (para idempotencia).
     * @param {("top"|"bottom")} [options.position="top"]  Arriba o abajo del mapa.
     * @param {string} [options.title]     Título opcional mostrado a la izquierda de la barra.
     * @param {string} [options.className] Clase CSS extra para la barra.
     * @param {Array}  [options.items]     Items iniciales a montar (ver contrato).
     * @param {boolean}[options.collapsible=false] Si la barra puede plegarse.
     */
    constructor(options = {}) {
      this.name = "miPlugin_supraplugin";
      this.options = options || {};
      this.id = this.options.id || ("supraplugin-" + nextUid());
      this.position = (this.options.position === "bottom") ? "bottom" : "top";
      this.title = this.options.title || "";
      this.className = this.options.className || "";
      this.collapsible = !!this.options.collapsible;

      this.map = null;
      this.container = null;      // barra raíz
      this.itemsContainer = null; // zona donde se montan los items
      this.items = [];            // lista de items registrados {item, opts, mountedEl}
      this._collapsed = false;

      // Adopta items iniciales (aún sin montar: se montan en addTo).
      if (Array.isArray(this.options.items)) {
        this.options.items.forEach((it) => this.items.push({ item: it, opts: {}, mountedEl: null }));
      }
    }

    // --- Lifecycle API-IDEE -------------------------------------------------
    addTo(map) {
      this.map = map;

      // Idempotencia: si ya existe un supraplugin vivo con este id (tras un
      // cambio 2D/3D de cambioImpl que recreó el mapa), limpiamos su barra
      // anterior y reutilizamos su lista de items.
      var prev = window.__supraplugins[this.id];
      if (prev && prev !== this) {
        // Heredamos los items registrados por el anterior para no perderlos en
        // el swap (el mapa se destruyó, pero la intención del usuario persiste).
        if (Array.isArray(prev.items) && prev.items.length && !this.items.length) {
          this.items = prev.items.map((r) => ({ item: r.item, opts: r.opts, mountedEl: null }));
        }
        try { prev._teardownDom(); } catch (e) { /* ignora */ }
      }
      window.__supraplugins[this.id] = this;

      this._buildBar();
      this._mountAllItems();
      return this;
    }

    // Devuelve la ayuda del plugin (protocolo API-IDEE: {title, content}).
    getHelp() {
      var IDEE = api();
      var self = this;
      return {
        title: "Barra de herramientas (supraplugin)",
        content: new Promise(function (success) {
          var html =
            "<div>" +
            "<p>Barra transversal situada " + (self.position === "bottom" ? "debajo" : "encima") +
            " del mapa. Aloja herramientas que operan por encima del visualizador " +
            "(por ejemplo, la comparación de vistas).</p>" +
            "</div>";
          try { html = IDEE.utils.stringToHtml(html); } catch (e) { /* string plano */ }
          success(html);
        }),
      };
    }

    // --- Construcción de la barra ------------------------------------------
    // La barra se inserta como HERMANA del contenedor raíz del visualizador,
    // no dentro del viewport del mapa: así es transversal y sobrevive al mapa.
    _buildBar() {
      // Localiza el div raíz del visualizador (el que contiene el mapa).
      var host = this._resolveHost();
      if (!host) {
        console.warn("[supraplugin] No se encontró el contenedor del visualizador.");
        return;
      }
      this._host = host;

      // El host necesita ser un contexto flex en columna para que la barra y el
      // mapa se apilen (top/bottom). Marcamos su padre como layout de supraplugin.
      var layoutParent = host.parentElement || document.body;
      layoutParent.classList.add("supra-layout");

      var bar = document.createElement("div");
      bar.id = "supra-bar-" + this.id;
      bar.className = "supra-bar supra-bar--" + this.position + (this.className ? (" " + this.className) : "");
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("aria-label", this.title || "Barra de herramientas");

      var inner = document.createElement("div");
      inner.className = "supra-bar__inner";

      if (this.title) {
        var titleEl = document.createElement("span");
        titleEl.className = "supra-bar__title";
        titleEl.textContent = this.title;
        inner.appendChild(titleEl);
      }

      var itemsEl = document.createElement("div");
      itemsEl.className = "supra-bar__items";
      inner.appendChild(itemsEl);

      if (this.collapsible) {
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "supra-bar__toggle";
        toggle.title = "Plegar/desplegar";
        toggle.setAttribute("aria-expanded", "true");
        toggle.textContent = "▾";
        var self = this;
        toggle.addEventListener("click", function () { self.toggleCollapsed(); });
        inner.appendChild(toggle);
        this._toggleBtn = toggle;
      }

      bar.appendChild(inner);

      // Inserta la barra arriba (antes del host) o abajo (después del host).
      if (this.position === "top") {
        layoutParent.insertBefore(bar, host);
      } else {
        if (host.nextSibling) layoutParent.insertBefore(bar, host.nextSibling);
        else layoutParent.appendChild(bar);
      }

      this.container = bar;
      this.itemsContainer = itemsEl;

      // Reajusta el tamaño del mapa cuando la barra cambia el alto disponible.
      this._notifyMapResize();
    }

    // Resuelve el contenedor raíz del visualizador. En API-IDEE el div que se
    // pasa a IDEE.map({container}) acaba envuelto en .m-api-idee-container; nos
    // interesa el ancestro visible que ocupa el área del visualizador.
    _resolveHost() {
      var el = null;
      try { el = this.map.getContainer(); } catch (e) { el = null; }
      if (!el) {
        // Respaldo: el div de mapa por convención del repo.
        el = document.getElementById("mapaDIV") || document.getElementById("mapa");
      }
      if (!el) return null;

      var node = el;
      var root = el;
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains("m-api-idee-container")) { root = node; break; }
        node = node.parentElement;
      }
      // Si el contenedor API está dentro de un wrapper propio del visualizador
      // (p. ej. #mapaDIV), preferimos ese wrapper como host apilable.
      var wrapper = root.closest ? (root.closest("#mapaDIV, #mapa") || root) : root;
      return wrapper;
    }

    _notifyMapResize() {
      var self = this;
      // API-IDEE/OL/Cesium recalculan al hacer resize del window; forzamos uno.
      setTimeout(function () {
        try {
          var impl = self.map && self.map.getMapImpl && self.map.getMapImpl();
          if (impl && typeof impl.updateSize === "function") impl.updateSize();       // ol.Map
          else if (impl && impl.scene && impl.scene.requestRender) impl.scene.requestRender(); // Cesium
        } catch (e) { /* ignora */ }
        try { window.dispatchEvent(new Event("resize")); } catch (e) { /* ignora */ }
      }, 60);
    }

    // --- Montaje de items ---------------------------------------------------
    _mountAllItems() {
      if (!this.itemsContainer) return;
      var self = this;
      this.items.forEach(function (record) { self._mountItem(record); });
    }

    _mountItem(record) {
      if (!this.itemsContainer) return;
      var slot = document.createElement("div");
      slot.className = "supra-bar__slot";
      this.itemsContainer.appendChild(slot);
      record.slot = slot;

      var el = this._resolveItemElement(record.item);
      if (el && typeof el.then === "function") {
        // Promise<HTMLElement>
        var self = this;
        el.then(function (resolved) {
          if (resolved) { slot.appendChild(resolved); record.mountedEl = resolved; self._notifyMapResize(); }
        }).catch(function (e) { console.warn("[supraplugin] item async falló:", e); });
      } else if (el) {
        slot.appendChild(el);
        record.mountedEl = el;
      }
    }

    // Traduce cualquier forma de "item" a un HTMLElement (o Promise de él).
    _resolveItemElement(item) {
      if (!item) return null;

      // 3) Objeto con getSupraElement(supra) -> HTMLElement | Promise
      if (typeof item === "object" && typeof item.getSupraElement === "function") {
        return item.getSupraElement(this);
      }
      // Objeto que ES otro supraplugin -> lo montamos como sub-barra embebida.
      if (typeof item === "object" && item instanceof miPlugin_supraplugin) {
        return this._embedSupraplugin(item);
      }
      // 1) HTMLElement directo
      if (item instanceof HTMLElement) return item;
      // 2) string HTML
      if (typeof item === "string") {
        var wrap = document.createElement("div");
        wrap.className = "supra-bar__html";
        wrap.innerHTML = item;
        return wrap;
      }
      console.warn("[supraplugin] Tipo de item no soportado:", item);
      return null;
    }

    // Embebe otro supraplugin como item de este (anidamiento). El sub-supra no
    // crea su propia barra hermana del mapa: se monta dentro de una ranura.
    _embedSupraplugin(subSupra) {
      var box = document.createElement("div");
      box.className = "supra-bar__nested supra-bar__nested--" + subSupra.position;
      // Reutiliza la construcción de la sub-barra pero anclada a `box`.
      subSupra.map = this.map;
      subSupra._host = box;
      subSupra.container = box;
      var itemsEl = document.createElement("div");
      itemsEl.className = "supra-bar__items";
      box.appendChild(itemsEl);
      subSupra.itemsContainer = itemsEl;
      window.__supraplugins[subSupra.id] = subSupra;
      subSupra._mountAllItems();
      return box;
    }

    // --- API pública para colgar objetos -----------------------------------
    /**
     * Añade un item al supraplugin. Ver "Contrato de item" en la cabecera.
     * @returns {miPlugin_supraplugin} this (encadenable)
     */
    addItem(item, opts = {}) {
      var record = { item: item, opts: opts || {}, mountedEl: null };
      this.items.push(record);
      // Si ya estamos montados, monta el item en caliente.
      if (this.itemsContainer) this._mountItem(record);
      return this;
    }

    /** Anida otro supraplugin como item de este. */
    addSupraplugin(subSupra) {
      return this.addItem(subSupra);
    }

    // --- Estado / utilidades -----------------------------------------------
    getContainer() { return this.container; }
    getItemsContainer() { return this.itemsContainer; }
    getMap() { return this.map; }
    getPosition() { return this.position; }

    toggleCollapsed(force) {
      this._collapsed = (typeof force === "boolean") ? force : !this._collapsed;
      if (this.container) this.container.classList.toggle("supra-bar--collapsed", this._collapsed);
      if (this._toggleBtn) {
        this._toggleBtn.setAttribute("aria-expanded", String(!this._collapsed));
        this._toggleBtn.textContent = this._collapsed ? "▸" : "▾";
      }
      this._notifyMapResize();
    }

    _teardownDom() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      this.itemsContainer = null;
      this.items.forEach(function (r) { r.mountedEl = null; r.slot = null; });
    }

    /** Desmonta por completo la barra y limpia el registro global. */
    remove() {
      this._teardownDom();
      if (window.__supraplugins[this.id] === this) delete window.__supraplugins[this.id];
      this._notifyMapResize();
    }
  }

  // Exponer en el namespace IDEE.plugin.* Y como global directo (este último es
  // el que sobrevive al swap de cambioImpl).
  if (typeof window !== "undefined") {
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_supraplugin = miPlugin_supraplugin;
    window.miPlugin_supraplugin = miPlugin_supraplugin;
  }
})();
