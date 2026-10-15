/* =====================================================================
   Supraplugin para API-IDEE
   --------------------------------------------------------------------
   Un "supraplugin" es un contenedor (barra) TRANSVERSAL a un mapa: se
   coloca ARRIBA o ABAJO del visualizador y aloja otros objetos que operan
   por encima del propio mapa (controles, plugins, HTML suelto e incluso
   otros supraplugins).

   Motivación: algunos plugins (p. ej. el comparador de vistas) no son
   "de un mapa" sino "sobre un mapa" (crean/gestionan varias instancias de
   mapa a la vez). Un IDEE.ui.Panel vive DENTRO del viewport de UN mapa y no
   encaja para eso. El supraplugin resuelve esto creando su propia barra como
   hermana del contenedor del visualizador.

   --------------------------------------------------------------------
   BARRA ESTILO UBUNTU: PLEGADO CON "TIRADOR"
   --------------------------------------------------------------------
   La barra se compone de DOS piezas:

     - CABECERA: el TIRADOR, siempre visible. Es una línea horizontal de
       10 px en el borde de la barra que MIRA AL MAPA (abajo si la barra va
       arriba, arriba si va abajo): es el borde por el que la barra se pliega y
       se despliega, y por tanto donde se agarra para cerrarla, como en las
       barras de Ubuntu.
     - CUERPO: el título y todos los items (controles, plugins, HTML).

   El plegado NO es un simple mostrar/ocultar, sino el juego de tres
   estados de la barra:

     1. ABIERTA         -> cabecera + cuerpo a la vista (uso normal).
     2. PLEGADA         -> sólo se ve la cabecera, o sea el tirador.
     3. ASOMANDO (peek) -> plegada pero desplegada mientras el puntero
                           esté encima; al salir del puntero se repliega.

   Y un cuarto bandillo, el FIJADO, que decide si el estado plegado es
   definitivo o sólo provisional:

     - `fijada = true`  -> lo que decidas con un click se queda (abierto
                           fijo o cerrado fijo). El hover no toca nada.
     - `fijada = false` -> la barra es "de hover": se pliega sola y asoma
                           mientras el ratón esté encima, sin poder quedar
                           abierta.

   Regla del click en el tirador (`_onClickTirador`), en tres pasos:

     - si NO está fijada -> se fija ABIERTA (el click "corta" el modo hover);
     - si está fijada    -> alterna abierta <-> cerrada.

   Con los valores por defecto (`pinned: true`) la barra aparece abierta y
   fijada; un click la cierra de verdad y entonces, como ya está fijada, hay
   que volver a clicar el tirador para abrirla. Si se quiere el juego de
   "asoma al pasar por encima", se construye con `pinned: false` (o
   `pinned: false, collapsed: true`, que es justo la barra oculta de Ubuntu).

   --------------------------------------------------------------------
   SUPRAPLUGINS ANIDADOS
   --------------------------------------------------------------------
   Un supraplugin puede contener a OTRO supraplugin. El hijo NO se
   mezcla en la fila del padre: aparece como un botón más de la barra y,
   al activarlo, se despliega su propia barra HERMANA apilada en el mismo
   dock (debajo de la del padre; si el dock va abajo, encima del mapa).
   Cada barra hija tiene su propio tirador y su propio juego de items.

   --------------------------------------------------------------------
   API pública
   --------------------------------------------------------------------
     supra.addItem(item, opts)        -> añade un item (ver contrato abajo)
     supra.addSupraplugin(subSupra)   -> anida otro supraplugin como botón
     supra.addSeparator(opts)         -> separador vertical entre items
     supra.getContainer()             -> HTMLElement de la barra
     supra.getItemsContainer()        -> HTMLElement donde se montan los items
     supra.getMap()                   -> mapa API-IDEE actual
     supra.setCollapsed(bool)         -> pliega/despliega
     supra.toggleCollapsed(force)     -> alterna (alias histórico)
     supra.setPinned(bool)            -> fija o deja en modo hover
     supra.setTheme('light'|'dark')   -> cambia la superficie en caliente
     supra.abrirHijo(sub)             -> abre la barra de un supra anidado
     supra.cerrarHijo(sub)            -> la cierra
     supra.toggleHijo(sub)            -> alterna la barra de un supra anidado
     supra.remove()                   -> desmonta la barra y limpia

   Opciones del constructor:

     id            Id único (idempotencia y estado).
     position      "top" (defecto) o "bottom".
     title         Título de la barra.
     icon          Glifo `g-cartografia` que precede al título.
     className     Clase CSS extra de la barra.
     items         Items iniciales (mismo contrato que addItem).
     order         Orden por defecto de los items que no declaren el suyo.
     collapsible   Si la barra se puede plegar (defecto: true).
     collapsed     Si ARRANCA plegada (defecto: false).
     pinned        Si el estado plegado es fijo o de hover (defecto: true).
     peek          Si el hover la despliega mientras esté encima
                   (defecto: true; sólo si collapsible).
     color1/2/3    Colores del esquema (fondo, borde, icono y texto). Los
                   usan sobre todo los ITEMS (que los heredan por CSS); en
                   la barra, color1 es el color de marca: tirador en hover,
                   botones activos y raya de las barras anidadas.
     theme         Paleta de superficie de la barra: "light" (defecto) o
                   "dark" (Ambiance). Se cambia en caliente con setTheme().
     surface       Colores de superficie de la barra, que SÍ se escriben
                   aquí: { bg, bgSolid, fg, fgDim, border, hover, shadow }.
                   También se pueden dar sueltos (bg, fg, border, hover,
                   shadow...) sin envoltura. Lo que no se declare sale del
                   tema. En caliente con setSurface({...}).

   Contrato de "item" (cualquiera de estas formas):
     1) HTMLElement                       -> se inserta tal cual.
     2) string (HTML)                     -> se parsea y se inserta.
     3) { getSupraElement(supra) }        -> función que DEVUELVE un HTMLElement
                                              (o Promise<HTMLElement>). Es la vía
                                              recomendada para plugins/controles:
                                              reciben el supraplugin y devuelven su
                                              UI. Se re-invoca en cada montaje
                                              (incluido tras un cambio 2D/3D).
                                              Se lo pasa antes de montarlo salvo que el
                                              item esté ya en map.getPlugins(): en ese
                                              caso la API ya se lo llamó con
                                              map.addPlugin() y la barra solo le pone el
                                              botón. El item esconde entonces su botón
                                              del mapa y deja el de la barra como único
                                              mando (ver _addToItems).
     4) miPlugin_supraplugin              -> barra anidada (ver arriba).
     5) supra.separator()                 -> separador vertical.
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

  // Marca con la que un item se reconoce como separador.
  var MARCA_SEPARADOR = "_supraSeparador";

  // Paletas de SUPERFICIE de la barra, una por tema. Son el valor por defecto
  // de las variables --supra-*: el constructor las escribe EN LÍNEA sobre cada
  // barra, de modo que quien monte un supraplugin decide sus colores sin tocar
  // el CSS (el CSS sólo deja valores de reserva, por si se carga sin su JS).
  var PALETAS = {
    light: {
      bg: "rgba(255, 255, 255, 0.80)",
      bgSolid: "rgba(255, 255, 255, 0.94)",
      fg: "#2b2b30",
      fgDim: "rgba(43, 43, 48, 0.62)",
      border: "rgba(20, 20, 25, 0.10)",
      hover: "rgba(20, 20, 25, 0.06)",
      shadow: "0 10px 30px rgba(15, 20, 30, 0.14), 0 2px 6px rgba(15, 20, 30, 0.06)",
      sheen: "rgba(255, 255, 255, 0.35)"
    },
    dark: {
      bg: "rgba(44, 44, 48, 0.84)",
      bgSolid: "rgba(44, 44, 48, 0.95)",
      fg: "#f2f1f0",
      fgDim: "rgba(242, 241, 240, 0.62)",
      border: "rgba(255, 255, 255, 0.10)",
      hover: "rgba(255, 255, 255, 0.10)",
      shadow: "0 12px 34px rgba(0, 0, 0, 0.40), 0 2px 6px rgba(0, 0, 0, 0.26)",
      sheen: "rgba(255, 255, 255, 0.08)"
    }
  };

  // Claves de superficie que el constructor puede pisar, con la variable CSS
  // donde se escriben. El mapeo es explícito porque los nombres de opción son
  // camelCase (bgSolid) y los de variable kebab-case (--supra-bg-solid): si se
  // concatenara '--supra-' + clave, las de camelCase se escribirían con otra
  // variable (--supra-bgSolid), no se usarían en el CSS y la barra se quedaría
  // con la reserva del tema claro (medido: la barra hija salía blanca en dark).
  var CLAVES_SUPERFICIE = [
    { opcion: "bg", css: "--supra-bg" },
    { opcion: "bgSolid", css: "--supra-bg-solid" },
    { opcion: "fg", css: "--supra-fg" },
    { opcion: "fgDim", css: "--supra-fg-dim" },
    { opcion: "border", css: "--supra-border" },
    { opcion: "hover", css: "--supra-hover" },
    { opcion: "shadow", css: "--supra-shadow" },
    { opcion: "sheen", css: "--supra-sheen" }
  ];

  class miPlugin_supraplugin {
    /**
     * @param {Object} options Ver "Opciones del constructor" en la cabecera.
     */
    constructor(options = {}) {
      this.name = "miPlugin_supraplugin";
      this.options = options || {};
      this.id = this.options.id || ("supraplugin-" + nextUid());

      this.position = (this.options.position === "bottom") ? "bottom" : "top";
      this.title = this.options.title || "";
      this.icon = this.options.icon || "";
      this.className = this.options.className || "";

      // Tema de superficie de la barra: "light" (tarjeta blanca con el mapa
      // difuminado detrás) o "dark" (Ambiance). Los hijos heredan el del padre
      // salvo que traigan el suyo propio, que es lo que marca _themePropio.
      this._themePropio = (this.options.theme !== undefined && this.options.theme !== null);
      this.theme = (this.options.theme === "dark" || this.options.theme === "light") ? this.options.theme : "light";

      // Superficie propia: los colores con los que se pinta ESTA barra. El
      // tema pone los suyos y encima se pisan, o todos de golpe con
      // `surface: {...}` o sueltos con bg/bgSolid/fg/fgDim/border/hover/shadow.
      // Así los colores de la barra se parametrizan en el constructor, que es
      // de donde salen todos los del repositorio, y no del CSS.
      this._superficie = {};
      if (this.options.surface && typeof this.options.surface === "object") {
        CLAVES_SUPERFICIE.forEach((k) => {
          if (this.options.surface[k.opcion] !== undefined) this._superficie[k.opcion] = this.options.surface[k.opcion];
        });
      }
      CLAVES_SUPERFICIE.forEach((k) => {
        if (this.options[k.opcion] !== undefined) this._superficie[k.opcion] = this.options[k.opcion];
      });

      // --- Estado de plegado -------------------------------------------------
      // `collapsible`: la barra tiene tirador y se puede plegar.
      // `collapsed`  : arranca plegada (sólo se ve el tirador).
      // `pinned`     : el estado plegado es fijo (click) o de hover (peek).
      // `peek`       : el hover despliega la barra plegada mientras esté encima.
      this.collapsible = (this.options.collapsible !== undefined) ? !!this.options.collapsible : true;
      this.peek = (this.options.peek !== undefined) ? !!this.options.peek : true;
      this._plegada = !!this.options.collapsed;
      this._fijada = (this.options.pinned !== undefined) ? !!this.options.pinned : true;
      this._asomando = false;

      // Orden por defecto de los items que no declaren el suyo (CSS `order`
      // sobre su ranura). Mismo parámetro que en los plugins con panel.
      this.order = (this.options.order !== undefined && this.options.order !== null
        && !isNaN(Number(this.options.order))) ? Number(this.options.order) : null;

      this.map = null;
      this._addToMapa = null;   // mapa al que ya se hizo addTo() en los items
      this._host = null;        // contenedor del visualizador
      this._dock = null;        // caja donde se apilan esta barra y las hijas
      this.container = null;    // barra raíz (nodo .supra-bar)
      this.cabecera = null;     // .supra-bar__cabecera (siempre visible)
      this.tirador = null;      // botón del tirador
      this.cuerpo = null;       // .supra-bar__cuerpo (lo que se pliega)
      this.itemsContainer = null;
      this.items = [];          // {item, opts, mountedEl, slot}

      this._padre = null;       // supraplugin anfitrión si es anidado
      this._hijos = {};         // idHijo -> {sub, boton, abierta}
      this._observer = null;    // ResizeObserver de la barra
      this._resizeTimer = null;

      // Colores configurables, con el mismo reparto y los mismos valores por
      // defecto que el resto de plugins del repositorio (color1 = fondo,
      // color2 = borde, color3 = icono y texto; ver
      // ext/CalidadAireMadridTiempoReal). La barra los expone a sus items: quien
      // no declare color1/color2/color3 propios hereda los de la barra, para que
      // la barra y sus botones no seseen cada uno de un color.
      this.color1 = (this.options.color1 !== undefined) ? this.options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (this.options.color2 !== undefined) ? this.options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (this.options.color3 !== undefined) ? this.options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

      // Adopta items iniciales (aún sin montar: se montan en addTo).
      // Cada entrada puede ser el item tal cual, o { item, order } para
      // colocarlo en una posición concreta de la barra.
      if (Array.isArray(this.options.items)) {
        this.options.items.forEach((it) => {
          if (it && typeof it === "object" && typeof it.getSupraElement !== "function" && it.item !== undefined) {
            this.items.push({
              item: it.item,
              opts: (it.order !== undefined && it.order !== null) ? { order: it.order } : {},
              mountedEl: null,
              slot: null
            });
          } else {
            this.items.push({ item: it, opts: {}, mountedEl: null, slot: null });
          }
        });
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
          this.items = prev.items.map((r) => ({ item: r.item, opts: r.opts, mountedEl: null, slot: null }));
        }
        try { prev._teardownDom(); } catch (e) { /* ignora */ }
      }
      window.__supraplugins[this.id] = this;

      this._buildBar();
      this._addToItems(map);
      this._mountAllItems();
      return this;
    }

    /**
     * Pasa el mapa a los items que lo necesitan para existir.
     *
     *  Un item que trae `getSupraElement` y además `addTo` (o `add`) es un
     *  plugin de la API al que se le ha cambiado el sitio de la UI: la barra solo
     *  le pone el botón, pero su panel, sus controles y sus capas los sigue
     *  montando `addTo(map)`, que es lo que construye `this._panel`. Sin esta
     *  llamada el botón se montaría contra un panel inexistente (medido: la barra
     *  aceptaba el item y el plugin se quedaba sin panel).
     *
     *  Los items autocontenidos (los que solo tienen `getSupraElement`, como
     *  `miPlugin_plantillaItem` o `comparacionVistas`) no definen `addTo` y se
     *  saltan solos. A una barra anidada se le pasa el mapa a sus items, pero sin
     *  volver a llamar a su `addTo` entero: de la construcción de su barra se
     *  encarga `_mountSubSupraplugin`.
     *
     * @param {Object} map Mapa API-IDEE anfitrión.
     */
    _addToItems(map) {
      if (!map || this._addToMapa === map) return;
      this._addToMapa = map;
      this.items.forEach(function (record) {
        var item = record && record.item;
        if (!item) return;
        if (item instanceof miPlugin_supraplugin) {
          try { item._addToItems(map); } catch (e) { /* ignora */ }
          return;
        }
        // Si el item está registrado como plugin del mapa, la API ya le llamó
        // addTo() por su cuenta al hacer map.addPlugin(item): volver a pasárselo
        // crearía un segundo panel (medido). La barra solo pone el botón.
        if (this._yaLoInitElMapa(item, map)) return;
        var ciclo = (typeof item.addTo === "function") ? item.addTo
          : (typeof item.add === "function") ? item.add
            : null;
        if (!ciclo) return;
        try {
          ciclo.call(item, map);
        } catch (e) {
          console.warn("[supraplugin] addTo() del item falló:", e);
        }
      }, this);
    }

    /**
     * ¿Está este item registrado como plugin del mapa?
     *
     *  Un plugin que vive en la barra puede estar además en `map.getPlugins()`,
     *  que es lo que se usa para que conserve su estado en el swap 2D/3D (el
     *  coordinador EstadoPlugins solo recorre esa lista, medido). Cuando lo está,
     *  la API ya lo inicializó y su panel ya existe: la barra se limita a
     *  esconderle el botón del mapa y a poner el suyo.
     *
     * @param {Object} item Item de la barra.
     * @param {Object} [map] Mapa API-IDEE.
     * @returns {boolean}
     */
    _yaLoInitElMapa(item, map) {
      if (!item || !map || typeof map.getPlugins !== "function") return false;
      try {
        return (map.getPlugins() || []).indexOf(item) >= 0;
      } catch (e) {
        return false;
      }
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
            "<p>Puede plegarse con el <strong>tirador</strong>, la línea " +
            "horizontal del borde: un <em>click</em> la deja abierta o cerrada de " +
            "forma fija, y si se construye con <code>pinned: false</code> " +
            "asoma sola mientras el puntero esté encima.</p>" +
            "</div>";
          try { html = IDEE.utils.stringToHtml(html); } catch (e) { /* string plano */ }
          success(html);
        }),
      };
    }

    /**
     * Captura el estado serializable del supraplugin para preservarlo entre cambios 2D/3D.
     * @returns {Object} {plegada, fijada, hijos: {idHijo: {abierta, plegada, fijada}},
     *                   plugins: {nombre: estado}}
     */
    getState() {
      var hijos = {};
      Object.keys(this._hijos).forEach((id) => {
        var h = this._hijos[id];
        if (!h || !h.sub) return;
        hijos[id] = {
          abierta: !!h.abierta,
          plegada: !!h.sub._plegada,
          fijada: !!h.sub._fijada
        };
      });
      return {
        plegada: Boolean(this._plegada),
        fijada: Boolean(this._fijada),
        hijos: hijos,
        plugins: this._capturarItems()
      };
    }

    /**
     * Estado de los plugins que aloja la barra, el árbol entero (esta barra y
     * las anidadas).
     *
     *  La barra los saca a su cuenta porque el coordinador `EstadoPlugins` solo
     *  recorre `map.getPlugins()` (medido), y un plugin que vive en la barra no
     *  siempre está en esa lista. Los que sí lo están los salta: de ésos ya se
     *  ocupa el coordinador, y capturarlos aquí sería aplicar su estado dos
     *  veces. La clave es `idHijo/nombre` para los items de una barra anidada,
     *  que es lo que después vuelve a recorrer setState().
     *
     * @param {Object} [map] Mapa, para poder saltar los plugins registrados.
     * @returns {Object} nombre -> estado. Vacío si no hay ninguno.
     */
    _capturarItems(map) {
      var salida = {};
      var self = this;
      // Sin mapa explícito (getState() no recibe ninguno) se usa el suyo.
      var mapa = map || this.map;
      this.items.forEach(function (record) {
        var item = record && record.item;
        if (!item) return;
        if (item instanceof miPlugin_supraplugin) {
          var dentro = item._capturarItems(mapa);
          Object.keys(dentro).forEach(function (k) { salida[item.id + "/" + k] = dentro[k]; });
          return;
        }
        if (!item.name || typeof item.getState !== "function") return;
        if (self._yaLoInitElMapa(item, mapa)) return;
        try {
          var st = item.getState();
          if (st !== undefined && st !== null) salida[item.name] = st;
        } catch (e) {
          console.warn("[supraplugin] no se pudo capturar el estado de " + item.name, e);
        }
      });
      return salida;
    }

    /**
     * Restaura el estado del supraplugin tras un cambio 2D/3D.
     * @param {Object} state Estado previamente capturado con getState()
     * @param {Object} [map] Instancia del nuevo mapa
     */
    setState(state, map) {
      if (!state || typeof state !== "object") return;
      if (typeof state.plegada === "boolean") this._plegada = state.plegada;
      if (typeof state.fijada === "boolean") this._fijada = state.fijada;
      // Estado heredado del nombre antiguo de la clave, por si alguien lo guardó
      // con la versión previa del plugin.
      if (typeof state.collapsed === "boolean" && typeof state.plegada !== "boolean") {
        this._plegada = state.collapsed;
      }
      this._asomando = false;

      if (state.hijos && typeof state.hijos === "object") {
        Object.keys(state.hijos).forEach((id) => {
          var h = state.hijos[id] || {};
          var hijo = this._hijos[id];
          if (!hijo || !hijo.sub) return;
          if (typeof h.plegada === "boolean") hijo.sub._plegada = h.plegada;
          if (typeof h.fijada === "boolean") hijo.sub._fijada = h.fijada;
          hijo.sub._asomando = false;
          hijo.sub._reflejarEstadoBarra();
          this._setHijoVisible(hijo.sub, !!h.abierta);
        });
      }
      this._reflejarEstadoBarra();
      this._restaurarItems(state.plugins, map);
    }

    /**
     * Reparte el estado capturado a los plugins que aloja la barra (el árbol
     * entero). Ver `_capturarItems`, que usa las mismas claves.
     * @param {Object} [estados] nombre -> estado.
     * @param {Object} [map] Instancia del mapa nuevo.
     */
    _restaurarItems(estados, map) {
      if (!estados || typeof estados !== "object") return;
      var destino = map || this.map;
      var self = this;
      this.items.forEach(function (record) {
        var item = record && record.item;
        if (!item) return;
        if (item instanceof miPlugin_supraplugin) {
          var dentro = {};
          Object.keys(estados).forEach(function (k) {
            var prefijo = item.id + "/";
            if (k.indexOf(prefijo) === 0) dentro[k.slice(prefijo.length)] = estados[k];
          });
          item._restaurarItems(dentro, destino);
          return;
        }
        if (!item.name || typeof item.setState !== "function") return;
        // Los plugins registrados en el mapa los restaura el coordinador.
        if (self._yaLoInitElMapa(item, destino)) return;
        var st = estados[item.name];
        if (st === undefined || st === null) return;
        try {
          item.setState(st, destino);
        } catch (e) {
          console.warn("[supraplugin] no se pudo restaurar el estado de " + item.name, e);
        }
      });
    }

    // --- Construcción de la barra ------------------------------------------
    // La barra se inserta como HERMANA del contenedor raíz del visualizador,
    // no dentro del viewport del mapa: así es transversal y sobrevive al mapa.
    // Todas las barras (la del supraplugin y las de sus hijos anidados) viven en
    // un mismo DOCK, para que se apilen unas debajo de otras.
    _buildBar() {
      // Localiza el div raíz del visualizador (el que contiene el mapa).
      var host = this._resolveHost();
      if (!host) {
        console.warn("[supraplugin] No se encontró el contenedor del visualizador.");
        return;
      }
      this._host = host;

      // El host necesita ser un contexto flex en columna para que el dock y el
      // mapa se apilen (top/bottom). Marcamos su padre como layout de supraplugin.
      var layoutParent = host.parentElement || document.body;
      layoutParent.classList.add("supra-layout");

      var dock = document.createElement("div");
      dock.id = "supra-dock-" + this.id;
      dock.className = "supra-dock supra-dock--" + this.position;
      dock.setAttribute("data-supra", this.id);
      dock.setAttribute("data-theme", this.theme);

      // Inserta el dock arriba (antes del host) o abajo (después del host).
      if (this.position === "top") {
        layoutParent.insertBefore(dock, host);
      } else {
        if (host.nextSibling) layoutParent.insertBefore(dock, host.nextSibling);
        else layoutParent.appendChild(dock);
      }
      this._dock = dock;

      this._construirBar(dock, "");

      // Reajusta el tamaño del mapa cuando la barra cambia el alto disponible.
      this._notifyMapResize();
    }

    /**
     * Construye el DOM de la barra (cabecera con el tirador + cuerpo con los
     * items) y la deja como última hija de `dock`.
     *
     * @param {HTMLElement} dock  Contenedor donde apilar la barra.
     * @param {string} claseExtra  Clases extra (p. ej. "supra-bar--hija").
     * @returns {HTMLElement} La barra creada.
     */
    _construirBar(dock, claseExtra) {
      var self = this;

      var bar = document.createElement("div");
      bar.id = "supra-bar-" + this.id;
      bar.className = "supra-bar supra-bar--" + this.position
        + (claseExtra ? (" " + claseExtra) : "")
        + (this.className ? (" " + this.className) : "");
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("aria-label", this.title || "Barra de herramientas");
      bar.setAttribute("data-theme", this.theme);

      // --- Cabecera: el TIRADOR, la única parte que nunca se esconde ---------
      var cab = document.createElement("div");
      cab.className = "supra-bar__cabecera";

      var tir = document.createElement("button");
      tir.type = "button";
      tir.className = "supra-bar__tirador";
      var agarre = document.createElement("span");
      agarre.className = "supra-bar__agarre";
      agarre.setAttribute("aria-hidden", "true");
      tir.appendChild(agarre);
      tir.addEventListener("click", function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        self._onClickTirador();
      });
      cab.appendChild(tir);
      bar.appendChild(cab);

      // --- Cuerpo: título + items, es lo que se pliega -----------------------
      var cuerpo = document.createElement("div");
      cuerpo.className = "supra-bar__cuerpo";

      if (this.title) {
        var titulo = document.createElement("span");
        titulo.className = "supra-bar__titulo";
        if (this.icon) {
          var ic = document.createElement("span");
          ic.className = "supra-bar__icono";
          ic.setAttribute("aria-hidden", "true");
          ic.textContent = this.icon;
          titulo.appendChild(ic);
        }
        titulo.appendChild(document.createTextNode(this.title));
        cuerpo.appendChild(titulo);
      }

      var itemsEl = document.createElement("div");
      itemsEl.className = "supra-bar__items";
      cuerpo.appendChild(itemsEl);

      bar.appendChild(cuerpo);
      dock.appendChild(bar);

      this.container = bar;
      this.cabecera = cab;
      this.tirador = tir;
      this.cuerpo = cuerpo;
      this.itemsContainer = itemsEl;

      this._aplicarColores();
      this._reflejarEstadoBarra();
      this._observarTamano();

      // El asomado: al entrar el puntero en la barra plegada se despliega, y al
      // salir se repliega. Sólo tiene efecto si la barra no está fijada.
      if (this.peek) {
        bar.addEventListener("mouseenter", function () { self._setAsomando(true); });
        bar.addEventListener("mouseleave", function () { self._setAsomando(false); });
      }

      return bar;
    }

    /**
     * Devuelve {active, deactive} a partir de un color simple o de un objeto.
     * @param {string|Object} c Color u objeto de colores.
     * @returns {{active: string, deactive: string}} Los dos estados.
     */
    resolveColor(c) {
      return (typeof c === "object" && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /**
     * Vuelca los colores configurados a variables CSS de la barra.
     *
     *  Las seis variables del esquema (reposo y activo de fondo, borde e icono) se
     *  ponen en línea sobre la barra, y supraplugin.css las consume con
     *  `var(--g-plugin-bg-color, orangered)` y compañía. Como se ponen en la barra
     *  y no en cada item, los items que no declaren color1/color2/color3 propios
     *  los heredan de aquí por herencia de CSS, que es justo lo que se quiere: una
     *  barra con un solo color.
     * @returns {boolean} true si se pudieron poner las variables.
     */
    _aplicarColores() {
      try {
        if (!this.container || !this.container.style) return false;
        var c1 = this.resolveColor(this.color1);
        var c2 = this.resolveColor(this.color2);
        var c3 = this.resolveColor(this.color3);
        this.container.style.setProperty("--g-plugin-bg-color", c1.deactive);
        this.container.style.setProperty("--g-plugin-bg-color-active", c1.active);
        this.container.style.setProperty("--g-plugin-border-color", c2.deactive);
        this.container.style.setProperty("--g-plugin-border-color-active", c2.active);
        this.container.style.setProperty("--g-plugin-icon-color", c3.deactive);
        this.container.style.setProperty("--g-plugin-icon-color-active", c3.active);

        // Superficie de la barra: la paleta del tema, con las opciones del
        // constructor por encima. Se escribe en línea para que cada barra
        // pueda llevar su propio color sin tocar el CSS.
        //
        // color1/2/3 pintan la barra con el mismo reparto que el resto de
        // plugins del repositorio (color1 = fondo, color2 = borde,
        // color3 = icono y texto), pero SOLO cuando el visualizador los
        // declara. Sin ellos la barra se queda con la paleta del tema, que es
        // lo que se quiere: los valores por defecto de este esquema
        // (naranja y blanco) son los de un panel, y aplicados a una barra
        // darían una franja naranja que nadie ha pedido.
        var pal = PALETAS[this.theme] || PALETAS.light;
        var base = {};
        var pone = (opcion, pares) => {
          if (this.options[opcion] === undefined) return;
          pares.forEach(function (par) { base[par.clave] = par.valor; });
        };
        pone("color1", [
          { clave: "bg", valor: c1.deactive },
          { clave: "bgSolid", valor: c1.active },
        ]);
        pone("color2", [
          { clave: "border", valor: c2.deactive },
          { clave: "hover", valor: c2.active },
        ]);
        pone("color3", [
          { clave: "fg", valor: c3.deactive },
          { clave: "fgDim", valor: c3.deactive },
        ]);
        var s = this._superficie || {};
        // Lo declarado en `surface` es lo explicito y gana sobre color1/2/3.
        var valor = (k) => (s[k] !== undefined && s[k] !== null) ? s[k]
          : (base[k] !== undefined && base[k] !== null) ? base[k] : pal[k];
        CLAVES_SUPERFICIE.forEach((k) => {
          this.container.style.setProperty(k.css, valor(k.opcion));
        });
        return true;
      } catch (e) {
        console.warn("[" + this.name + "] no se pudieron aplicar los colores.", e);
        return false;
      }
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
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(function () {
        self._resizeTimer = null;
        try {
          var impl = self.map && self.map.getMapImpl && self.map.getMapImpl();
          if (impl && typeof impl.updateSize === "function") impl.updateSize();       // ol.Map
          else if (impl && impl.scene && impl.scene.requestRender) impl.scene.requestRender(); // Cesium
        } catch (e) { /* ignora */ }
        try { window.dispatchEvent(new Event("resize")); } catch (e) { /* ignora */ }
      }, 80);
    }

    // Avisa al mapa cuando la barra cambia de alto. Se usa un ResizeObserver
    // porque el alto cambia sin que nosotros lo pidamos: al plegarse, al
    // asomarse con el hover, al abrir una barra hija y también cuando los
    // items envolviendo obligan a la barra a crecer.
    _observarTamano() {
      var self = this;
      if (typeof ResizeObserver === "undefined" || !this.container) return;
      if (this._observer) {
        try { this._observer.disconnect(); } catch (e) { /* ignora */ }
      }
      this._observer = new ResizeObserver(function () {
        self._notifyMapResize();
      });
      try { this._observer.observe(this.container); } catch (e) { /* ignora */ }
    }

    // --- Estado de plegado --------------------------------------------------
    /**
     * Click en el tirador. Si la barra estaba en modo hover la click la fija
     * abierta; si ya estaba fijada, alterna abierta <-> cerrada.
     */
    _onClickTirador() {
      if (!this.collapsible) return;
      // El click zanja el estado, así que el asomado (que era provisional) se
      // apaga: si no, su clase --asomando mantendría el cuerpo desplegado y el
      // siguiente click no llegaría a plegar de verdad.
      this._asomando = false;
      if (!this._fijada) {
        this._fijada = true;
        this._plegada = false;
      } else {
        this._plegada = !this._plegada;
      }
      this._reflejarEstadoBarra();
      this._notifyMapResize();
    }

    /** Asomado: sólo si está plegada, no está fijada y se permite el peek. */
    _setAsomando(valor) {
      var debe = !!valor && this.collapsible && this._plegada && !this._fijada && this.peek;
      if (debe === this._asomando) return;
      this._asomando = debe;
      this._reflejarEstadoBarra();
    }

    /** Pasa el estado interno a las clases CSS y al aria-expanded del tirador. */
    _reflejarEstadoBarra() {
      if (!this.container) return;
      // Visualmente plegada es "no se ve el cuerpo": o está plegada de verdad o
      // está asomando y hay que fingir que no lo está para que la animation
      // entre y salga del estado plegado.
      var plegada = this._plegada && !this._asomando;
      this.container.classList.toggle("supra-bar--plegable", this.collapsible);
      this.container.classList.toggle("supra-bar--plegada", plegada);
      this.container.classList.toggle("supra-bar--asomando", this._asomando);
      this.container.classList.toggle("supra-bar--fijada", this._fijada);
      if (this.tirador) {
        this.tirador.setAttribute("aria-expanded", String(!plegada));
        this.tirador.title = plegada ? "Desplegar la barra" : "Plegar la barra";
        this.tirador.setAttribute("aria-label", plegada ? "Desplegar la barra" : "Plegar la barra");
      }
    }

    /** Pliega o despliega la barra. */
    setCollapsed(force) {
      this._plegada = (typeof force === "boolean") ? force : !this._plegada;
      if (!this._plegada) this._asomando = false;
      this._reflejarEstadoBarra();
      this._notifyMapResize();
      return this;
    }

    /** Alias histórico: alterna el plegado. */
    toggleCollapsed(force) {
      return this.setCollapsed(typeof force === "boolean" ? force : !this._plegada);
    }

    isCollapsed() {
      return Boolean(this._plegada);
    }

    /** Fija el estado de plegado (true) o lo deja en modo hover (false). */
    setPinned(force) {
      this._fijada = (typeof force === "boolean") ? force : !this._fijada;
      if (this._fijada) this._asomando = false;
      this._reflejarEstadoBarra();
      return this;
    }

    isPinned() {
      return Boolean(this._fijada);
    }

    /**
     * Cambia la superficie de la barra en caliente.
     * @param {("light"|"dark")} tema
     * @param {boolean} [enCascada=true] Si además se aplica a las barras de los
     *   supraplugins anidados que NO tengan tema propio.
     * @returns {miPlugin_supraplugin} this (encadenable)
     */
    setTheme(tema, enCascada = true) {
      this.theme = (tema === "dark") ? "dark" : "light";
      if (this._dock) this._dock.setAttribute("data-theme", this.theme);
      if (this.container) this.container.setAttribute("data-theme", this.theme);
      // La paleta del tema son valores por defecto: si el constructor fijó
      // alguna clave de superficie, esa manda y el cambio de tema no la pisa.
      if (this.container) this._aplicarColores();
      if (enCascada) {
        Object.keys(this._hijos).forEach((id) => {
          var h = this._hijos[id];
          if (h && h.sub && !h.sub._themePropio) h.sub.setTheme(this.theme, true);
        });
      }
      return this;
    }

    /**
     * Cambia en caliente los colores de superficie de la barra.
     * @param {Object} parcial {bg, bgSolid, fg, fgDim, border, hover, shadow}
     *   (sólo las claves indicadas; el resto sigue como estaba).
     * @param {boolean} [enCascada=true] Si se propaga a las barras anidadas que
     *   no traigan superficie propia.
     * @returns {miPlugin_supraplugin} this (encadenable)
     */
    setSurface(parcial, enCascada = true) {
      this._superficie = this._superficie || {};
      CLAVES_SUPERFICIE.forEach((k) => {
        if (parcial && parcial[k.opcion] !== undefined) this._superficie[k.opcion] = parcial[k.opcion];
      });
      if (this.container) this._aplicarColores();
      if (enCascada) {
        Object.keys(this._hijos).forEach((id) => {
          var h = this._hijos[id];
          if (h && h.sub && (!h.sub._superficie || !Object.keys(h.sub._superficie).length)) {
            h.sub.setSurface(parcial, true);
          }
        });
      }
      return this;
    }

    /** @returns {("light"|"dark")} El tema actual de la barra. */
    getTheme() {
      return this.theme;
    }

    // --- Montaje de items ---------------------------------------------------
    _mountAllItems() {
      if (!this.itemsContainer) return;
      var self = this;
      this.items.forEach(function (record) { self._mountItem(record); });
    }

    _mountItem(record) {
      if (!this.itemsContainer) return;
      var item = record.item;

      var slot = document.createElement("div");
      slot.className = "supra-bar__ranura";
      // Posición del item dentro de la barra (CSS order sobre la ranura).
      // Prioridad: opts.order del addItem > item.order del propio item >
      // this.order (orden por defecto de la barra).
      var orden = (record.opts && record.opts.order !== undefined && record.opts.order !== null)
        ? record.opts.order
        : (item && typeof item.order !== "undefined" && item.order !== null)
          ? item.order
          : this.order;
      if (orden !== null && !isNaN(Number(orden))) {
        slot.style.order = String(Number(orden));
      }
      this.itemsContainer.appendChild(slot);
      record.slot = slot;

      // Separador vertical.
      if (item && item[MARCA_SEPARADOR]) {
        var sep = document.createElement("span");
        sep.className = "supra-bar__separador";
        sep.setAttribute("aria-hidden", "true");
        slot.classList.add("supra-bar__ranura--separador");
        slot.appendChild(sep);
        record.mountedEl = sep;
        return;
      }

      // Supraplugin anidado: botón en esta barra + barra hermana en el dock.
      if (item instanceof miPlugin_supraplugin) {
        this._mountSubSupraplugin(item, record, slot);
        return;
      }

      var el = this._resolveItemElement(item);
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

    /**
     * Monta un supraplugin anidado: un botón en esta barra y una barra hermana
     * apilada en el MISMO dock (debajo de la del padre). Activar el botón
     * muestra u oculta esa barra hermana.
     */
    _mountSubSupraplugin(subSupra, record, slot) {
      var self = this;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "supra-bar__boton supra-bar__boton--supra";
      btn.title = subSupra.title || subSupra.id;
      if (subSupra.icon) {
        var ic = document.createElement("span");
        ic.className = "supra-bar__boton-icono";
        ic.setAttribute("aria-hidden", "true");
        ic.textContent = subSupra.icon;
        btn.appendChild(ic);
      }
      var txt = document.createElement("span");
      txt.className = "supra-bar__boton-texto";
      txt.textContent = subSupra.title || subSupra.id;
      btn.appendChild(txt);
      btn.addEventListener("click", function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        self.toggleHijo(subSupra);
      });
      slot.appendChild(btn);

      // La barra del hijo: se desmonta la anterior (venía del mapa previo, tras
      // un cambio 2D/3D) y se construye de nuevo en el dock de este padre.
      try { if (typeof subSupra._teardownDom === "function") subSupra._teardownDom(); } catch (e) { /* ignora */ }
      subSupra.map = this.map;
      subSupra._padre = this;
      // El hijo hereda el tema del padre salvo que traiga el suyo propio: una
      // barra dentro de otra con otro fondo se rompe a la vista.
      if (!subSupra._themePropio) subSupra.setTheme(this.theme);
      if (this._dock) subSupra._construirBar(this._dock, "supra-bar--hija");
      subSupra._mountAllItems();

      this._hijos[subSupra.id] = { sub: subSupra, boton: btn, barra: subSupra.container, abierta: false };
      window.__supraplugins[subSupra.id] = subSupra;
      this._setHijoVisible(subSupra, false);

      record.mountedEl = btn;
      record.subSupra = subSupra;
    }

    /** Muestra u oculta la barra hermana de un supraplugin anidado. */
    _setHijoVisible(subSupra, visible) {
      var h = this._hijos[subSupra && subSupra.id];
      if (!h) return;
      h.abierta = !!visible;
      if (h.barra || (h.sub && h.sub.container)) {
        var barra = h.barra || h.sub.container;
        barra.classList.toggle("supra-bar--oculta", !h.abierta);
      }
      if (h.boton) {
        h.boton.classList.toggle("supra-bar__boton--activo", h.abierta);
        h.boton.setAttribute("aria-expanded", String(h.abierta));
        h.boton.title = (h.abierta ? "Ocultar " : "Mostrar ") + (h.sub.title || h.sub.id);
      }
      this._notifyMapResize();
    }

    /** Abre la barra hermana de un supraplugin anidado. */
    abrirHijo(subSupra) { this._setHijoVisible(subSupra, true); return this; }

    /** Cierra la barra hermana de un supraplugin anidado. */
    cerrarHijo(subSupra) { this._setHijoVisible(subSupra, false); return this; }

    /** Alterna la barra hermana de un supraplugin anidado. */
    toggleHijo(subSupra) {
      var h = this._hijos[subSupra && subSupra.id];
      if (!h) return this;
      this._setHijoVisible(subSupra, !h.abierta);
      return this;
    }

    /** @returns {boolean} Si la barra hermana de ese supraplugin está abierta. */
    isHijoAbierto(subSupra) {
      var h = this._hijos[subSupra && subSupra.id];
      return !!(h && h.abierta);
    }

    // --- API pública para colgar objetos -----------------------------------
    /**
     * Añade un item al supraplugin. Ver "Contrato de item" en la cabecera.
     * @param {Object} [opts] Opciones del item.
     * @param {number} [opts.order] Posición del item en la barra (CSS `order`;
     * las ranuras sin `order` valen 0): -1 => por delante de todos, 0 =>
     * primera posición, 2 => detrás de las de 0, 99 => al final. Si no se
     * pasa, se usa el `order` que declare el propio item (si lo tiene).
     * @returns {miPlugin_supraplugin} this (encadenable)
     */
    addItem(item, opts = {}) {
      var record = { item: item, opts: opts || {}, mountedEl: null, slot: null };
      this.items.push(record);
      // Si ya estamos montados, monta el item en caliente.
      if (this.itemsContainer) this._mountItem(record);
      return this;
    }

    /** Anida otro supraplugin como item de este (barra hermana con su botón). */
    addSupraplugin(subSupra) {
      return this.addItem(subSupra);
    }

    /** Añade un separador vertical entre items. */
    addSeparator(opts = {}) {
      var sep = {};
      sep[MARCA_SEPARADOR] = true;
      return this.addItem(sep, opts);
    }

    // --- Estado / utilidades -----------------------------------------------
    getContainer() { return this.container; }
    getItemsContainer() { return this.itemsContainer; }
    getMap() { return this.map; }
    getPosition() { return this.position; }
    /** @returns {HTMLElement|null} El dock donde se apilan esta barra y las hijas. */
    getDock() { return this._dock; }

    /**
     * Retira la barra del DOM.
     * @param {boolean} [conItems=false] Si además se llama a destroy() de cada
     *   item. Por defecto NO: en el cambio 2D/3D el supraplugin anterior
     *   entrega sus items al nuevo, y si se destruyeran aquí el nuevo montaría
     *   items ya desmontados. Solo remove()/destroy() los destruyen de verdad.
     */
    _teardownDom(conItems) {
      if (this._observer) {
        try { this._observer.disconnect(); } catch (e) { /* ignora */ }
        this._observer = null;
      }
      if (this._resizeTimer) {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = null;
      }

      // Primero las barras hijas, que cuelgan del dock de esta barra.
      Object.keys(this._hijos).forEach((id) => {
        var h = this._hijos[id];
        if (h && h.sub && typeof h.sub._teardownDom === "function") {
          try { h.sub._teardownDom(conItems); } catch (e) { console.warn("[supraplugin] al desmontar la barra hija:", e); }
        }
      });
      this._hijos = {};

      // El dock es nuestro: se quita entero (cubre la barra y las hijas).
      if (this._dock && this._dock.parentNode) {
        this._dock.parentNode.removeChild(this._dock);
      } else if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }

      this._dock = null;
      this.container = null;
      this.cabecera = null;
      this.tirador = null;
      this.cuerpo = null;
      this.itemsContainer = null;

      // Los items que se hayan montado se desmontan ellos mismos: quitar el
      // DOM no basta para los que tengan recursos fuera de él (oyentes en
      // window, BroadcastChannel, temporizadores...). Solo se llama a los que
      // implementen destroy(); el resto se conforma con desaparecer su HTML.
      this.items.forEach(function (r) {
        var item = r.item;
        if (conItems && item && typeof item.destroy === "function") {
          try { item.destroy(); } catch (e) { console.warn("[supraplugin] destroy() del item falló:", e); }
        }
        r.mountedEl = null;
        r.slot = null;
      });
    }

    /** Desmonta por completo la barra y limpia el registro global. */
    remove() {
      this._teardownDom(true);
      if (window.__supraplugins[this.id] === this) delete window.__supraplugins[this.id];
      this._notifyMapResize();
    }

    /**
     * Destruccion. map.removePlugins() de la API la exige: sin este metodo
     * lanza "t.destroy is not a function" y ABORTA el resto del lote de plugins
     * que se estuvieran quitando.
     *
     * El supraplugin no crea panel ni control de la API (su barra es hermana
     * del contenedor del mapa), asi que no hay nada que soltar con
     * map.removeControls(): basta con quitar la barra del DOM y limpiar el
     * registro global, que es justo lo que ya hace remove().
     */
    destroy() {
      this.remove();
      this.map = null;
      this._host = null;
      this._padre = null;
    }
  }

  // Exponer en los namespaces IDEE.plugin.* y M.plugin.* (los dos estilos de
  // invocación de la API) Y como global directo (este último es el que
  // sobrevive al swap de cambioImpl, que reinicializa IDEE.plugin).
  if (typeof window !== "undefined") {
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_supraplugin = miPlugin_supraplugin;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_supraplugin = miPlugin_supraplugin;
    window.miPlugin_supraplugin = miPlugin_supraplugin;
  }
})();
