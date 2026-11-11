/*
 * areaControls: div de area reservado para los plugins de tipo control.
 *
 * POR QUE EXISTE
 * La API-CNIG coloca los paneles en cuatro areas, una por esquina, y cada area es
 * un flex COLUMN (clases .m-area .m-top/.m-bottom .m-left/.m-right). De ahi salen
 * dos limitaciones para los plugins que son una barra o una lectura en pantalla:
 *
 *   1. IDEE.ui.position solo ofrece TL, TR, BL y BR. No hay forma de pedir que un
 *      panel se abra arriba o abajo CENTRADO, que es como se abren la lectura de
 *      escala o la barra de atribucion.
 *   2. El parametro `order` que acepta IDEE.ui.Panel solo reordena DENTRO de la
 *      esquina elegida (el Panel hace style.order sobre el elemento, y el padre es
 *      un flex column). No deja mover el panel de banda ni elegir en que banda
 *      colocarlo.
 *
 * Por eso los plugins de tipo control se posicionaban a mano con
 * position:absolute y sus propios left/bottom, cada uno por su cuenta, y por eso
 * ext/cambioImpl, ext/CalidadAireMadridTiempoReal y ext/controlClampToGroundLayers
 * arrastran codigo propio para reordenarse.
 *
 * QUE HACE ESTE
 * Crea (una sola vez) un div a todo el ancho, arriba o abajo del visualizador, con
 * los plugins metidos en fila. Cada plugin se cuelga en el con `order`, que aqui si
 * ordena de izquierda a derecha porque el div es un flex ROW. `openPosition` elige
 * en que banda se abre.
 *
 * USO
 *   const area = new miPlugin_areaControls({ openPosition: 'bottom' });
 *   area.addTo(mapa);
 *   ...
 *   area.monta(elemento, { order: 1 });   // cuelga el plugin en la banda
 *   area.desmonta(elemento);
 *
 // El constructor no recibe argumentos obligatorios: new miPlugin_areaControls()
 * deja la banda abajo y sin order asignado.
 *
 * COLORES: se declaran igual que en el resto de plugins (color1 = fondo, color2 =
 * borde, color3 = icono y texto; ver ext/CalidadAireMadridTiempoReal). La banda
 * en si no se pinta (es transparente, para que se vea el mapa detras), asi que
 * aqui lo que se hace es dejar las seis variables CSS puestas en ella: los plugins
 * que se cuelgan en la banda las heredan, y asi se puede dar color a toda la
 * banda de una vez sin tocar las hojas de estilo de cada plugin.
 */
class miPlugin_areaControls {
  /**
   * Constructor del plugin. Funciona sin argumentos.
   * @param {Object} [options={}] Opciones de configuracion (todas opcionales).
   * @param {string} [options.openPosition='bottom'] 'top' o 'bottom'.
   * @param {number} [options.order=0] Orden de los hijos que no traigan el suyo.
   * @param {string} [options.className] Prefijo de clase de la banda.
   * @param {number} [options.padLeft] Margen izquierdo en píxeles.
   * @param {number} [options.padRight] Margen derecho en píxeles.
   * @param {string|Object} [options.color1] Color de fondo. Un color o un objeto
   * {active, deactive}.
   * @param {string|Object} [options.color2] Color de borde. Un color o un objeto
   * {active, deactive}.
   * @param {string|Object} [options.color3] Color de icono y texto. Un color o un
   * objeto {active, deactive}.
   */
  constructor(options = {}) {
    this.name = 'miPlugin_areaControls';

    // Colores configurables, con el mismo reparto y los mismos valores por
    // defecto que el resto de plugins del repositorio.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

    // 'top' abre la banda arriba, 'bottom' (defecto) abajo.
    this.openPosition = (options.openPosition === 'top') ? 'top' : 'bottom';

    // Orden por defecto de los elementos que se cuelguen sin order explicito.
    this.order = (options.order !== undefined && !Number.isNaN(Number(options.order)))
      ? Number(options.order) : 0;

    // Prefijo de clase del area. Permite tener mas de una banda en el mismo mapa.
    this.className = options.className || 'g-areaControls';

    // Margenes laterales. Si no se fijan, se calculan solos para no pisar el
    // rail de botones de la API (ver _ajustarEspacio).
    this._padLeftAuto = (options.padLeft === undefined);
    this._padRightAuto = (options.padRight === undefined);
    this._padLeft = Number(options.padLeft) || 0;
    this._padRight = Number(options.padRight) || 0;

    this._map = null;
    this._area = null;
    this._hijos = [];
    this._observer = null;
    this._onResize = null;
    this._pendiente = null;
    // Vigilancia del alto de la banda y reintentos para cuando aún no está
    // creado el contenedor .m-areas de la API (ver _ajustarReserva).
    this._resizeObserver = null;
    this._reservaTimer = null;
    this._reservaReintentos = 0;
  }

  /**
   * Devuelve {active, deactive} a partir de un color simple o de un objeto.
   *
   *  Es el mismo traductor que usan los plugins que ya tenían esquema de colores,
   *  para que un color se pueda pasar como '#fff' o como {active: '#fff',
   *  deactive: '#eee'} indistintamente.
   * @param {string|Object} c Color u objeto de colores.
   * @returns {{active: string, deactive: string}} Los dos estados.
   */
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
  }

  /**
   * Vuelca los colores configurados a variables CSS de la banda.
   *
   *  Las seis variables del esquema (reposo y activo de fondo, borde e icono) se
   *  ponen en linea sobre el div de la banda. La banda no se pinta, asi que su
   *  valor no es que se vea de otro color, sino que los plugins que se cuelgan
   *  dentro la heredan: por la cascada, el que se ponga en el constructor de la
   *  banda alcanza a todos ellos sin tocar sus hojas de estilo. Los plugins que
   *  traigan sus propios colores se los ponen encima y mandan ellos.
   * @returns {boolean} true si se pudieron poner las variables.
   */
  _aplicarColores() {
    try {
      if (!this._area || !this._area.style) return false;
      const c1 = this.resolveColor(this.color1);
      const c2 = this.resolveColor(this.color2);
      const c3 = this.resolveColor(this.color3);
      this._area.style.setProperty('--g-plugin-bg-color', c1.deactive);
      this._area.style.setProperty('--g-plugin-bg-color-active', c1.active);
      this._area.style.setProperty('--g-plugin-border-color', c2.deactive);
      this._area.style.setProperty('--g-plugin-border-color-active', c2.active);
      this._area.style.setProperty('--g-plugin-icon-color', c3.deactive);
      this._area.style.setProperty('--g-plugin-icon-color-active', c3.active);
      return true;
    } catch (e) {
      console.warn(`${this.name}: no se pudieron aplicar los colores.`, e);
      return false;
    }
  }

  /**
   * Devuelve el div del area, creandolo la primera vez.
   * Reutiliza el que ya exista en el DOM, de modo que varios plugins que se
   * registren en el mismo mapa compartan banda.
   * @returns {HTMLElement|null} Div del area.
   */
  _asegurarArea() {
    if (this._area && this._area.parentNode) return this._area;

    // Reutiliza un area previa si el mapa ya se ha recreado (cambio 2D/3D).
    const previa = document.querySelector('.' + this.className +
      '--' + this.openPosition);
    if (previa && previa.parentNode) {
      this._area = previa;
      // La banda reutilizada puede venir de otra instancia (o del mapa anterior)
      // con otros colores, asi que se repintan los de esta.
      this._aplicarColores();
      this._vigilarAlto();
      this._programarAjuste();
      return this._area;
    }

    const area = document.createElement('div');
    area.className = this.className + ' ' + this.className + '--' + this.openPosition;

    // Anfitrion: el contenedor del mapa. Se sube por los mismos parents que
    // usan el resto de plugins para no colgarse fuera del visualizador.
    // Anfitrion: el contenedor del mapa. Se sube hasta .m-api-idee-container,
    // que es el unico nodo que existe igual en 2D (OL) y en 3D (Cesium).
    // Anclarlo al getContainer() no vale: en OpenLayers devuelve
    // .ol-overlaycontainer-stopevent, que no existe en Cesium, y la banda se
    // colocaria de una forma en 2D y de otra en 3D.
    let nodo = null;
    try {
      nodo = (this._map && typeof this._map.getContainer === 'function')
        ? this._map.getContainer() : null;
    } catch (e) {
      nodo = null;
    }
    if (!nodo) nodo = document.querySelector('.ol-viewport, .cesium-widget');

    let anfitrion = null;
    while (nodo && nodo !== document.body && nodo !== document.documentElement) {
      if (nodo.classList && nodo.classList.contains('m-api-idee-container')) {
        anfitrion = nodo;
        break;
      }
      nodo = nodo.parentElement;
    }
    if (!anfitrion) {
      anfitrion = document.querySelector('.m-api-idee-container')
        || document.getElementById('mapaDIV')
        || document.getElementById('mapa')
        || document.body;
    }
    if (!anfitrion || typeof anfitrion.appendChild !== 'function') return null;

    // La banda es position:absolute, asi que el anfitrion necesita contexto.
    try {
      if (window.getComputedStyle(anfitrion).position === 'static') {
        anfitrion.style.position = 'relative';
      }
    } catch (e) {
      /* si no se puede leer el estilo, se cuelga igualmente */
    }

    anfitrion.appendChild(area);
    this._area = area;
    this._aplicarColores();
    this._vigilarRail();
    this._vigilarAlto();
    this._ajustarEspacio();
    this._ajustarReserva();
    return this._area;
  }

  /**
   * Recalcula los margenes laterales de la banda para que sus controles no
   * queden debajo del rail de botones de la API.
   *
   * La API cuelga sus paneles en areas de esquina (.m-area .m-top/.m-bottom
   * .m-left/.m-right), y una banda a todo el ancho se cruzaría con ellas. En
   * lugar de fijar un margen a ojo, se mide cuanto ocupa de verdad el rail en
   * la mitad vertical de la banda y se aparta lo justo.
   *
   * La referencia es el contenedor (no el rect de la banda) para no realimentar:
   * la banda va con left:0/right:0, asi que su caja sin margenes coincide con la
   * del contenedor.
   */
  _ajustarEspacio() {
    const area = this._area;
    if (!area || !area.parentNode) return;
    if (!this._padLeftAuto && !this._padRightAuto) return;

    const base = area.parentNode.getBoundingClientRect();
    const banda = area.getBoundingClientRect();
    const arriba = area.classList.contains(this.className + '--top');
    const ARRIBA = banda.top;
    const ABAJO = banda.bottom;

    let huecoIzq = 0;
    let huecoDer = 0;
    const areas = document.querySelectorAll('.m-areas > .m-area');
    Array.prototype.forEach.call(areas, (a) => {
      // Solo las areas de la API que comparten banda vertical con la nuestra.
      if (a.contains(area)) return;
      if (arriba !== a.classList.contains('m-top')) return;
      // El lado (m-left / m-right) dice por donde invade el panel: hay que
      // apartar la banda de ese lado. Medir el lado por la posicion del pixel
      // daria falsos positivos, porque un panel de la derecha (la barra de
      // atribucion, p.ej.) tiene su borde derecho pegado al de la pantalla y
      // desplazaria el margen izquierdo hasta el tope.
      const invadeIzq = a.classList.contains('m-left');
      const invadeDer = a.classList.contains('m-right');
      if (!invadeIzq && !invadeDer) return;
      Array.prototype.forEach.call(a.children, (c) => {
        const r = c.getBoundingClientRect();
        if (!r || (!r.width && !r.height)) return;
        // Solo los paneles que solapan verticalmente con la banda estorban.
        if (r.bottom <= ARRIBA || r.top >= ABAJO) return;
        if (invadeIzq) huecoIzq = Math.max(huecoIzq, r.right - base.left);
        if (invadeDer) huecoDer = Math.max(huecoDer, base.right - r.left);
      });
    });

    // Un tope del 40% del ancho evita que un panel gigante desplace la banda
    // hasta dejarla inservible.
    const tope = base.width * 0.4;
    const izq = Math.max(0, Math.min(Math.ceil(huecoIzq) + 6, tope));
    const der = Math.max(0, Math.min(Math.ceil(huecoDer) + 6, tope));

    if (this._padLeftAuto && area.style.paddingLeft !== izq + 'px') {
      area.style.paddingLeft = izq + 'px';
    }
    if (this._padRightAuto && area.style.paddingRight !== der + 'px') {
      area.style.paddingRight = der + 'px';
    }
  }

  /**
   * Devuelve el contenedor .m-areas de la API, que es el padre de las cuatro
   * areas de esquina donde la API cuelga sus paneles.
   *
   * No vale buscarlo colgando de la banda: la banda vive en
   * .m-api-idee-container y .m-areas cuelga de .ol-overlaycontainer-stopevent,
   * que es otro hijo del mismo contenedor. Por eso se busca primero dentro del
   * anfitrion de la banda y solo si no aparece se cae al documento.
   * @returns {HTMLElement|null} Contenedor .m-areas.
   */
  _areasRaiz() {
    const host = (this._area && this._area.parentNode) ? this._area.parentNode : null;
    if (host && typeof host.querySelector === 'function') {
      const propia = host.querySelector('.m-areas');
      if (propia) return propia;
    }
    return document.querySelector('.m-areas');
  }

  /**
   * Aparta los paneles de la API que comparten borde con la banda.
   *
   * La banda ocupa todo el ancho pegada al borde inferior (o superior), asi que
   * un panel colapsado de la API en la esquina BL/BR (o TL/TR) quedaba justo
   * encima y los dos se pisaban. La API posiciona esos paneles con `bottom:0`
   * (o `top:0`) sobre .m-area.m-bottom / .m-area.m-top, de modo que aqui se le
   * pasa al contenedor .m-areas el alto real de la banda y su CSS sube (o baja)
   * las areas de esa banda lo justo para que el panel quede por encima.
   *
   * El alto se mide de TODAS las bandas del mismo tipo que hay en el DOM (no
   * solo de la de esta instancia) porque varias extensiones comparten banda:
   * asi, cuando una se desmonta, la cuenta sigue saliendo bien.
   */
  _ajustarReserva() {
    const areas = this._areasRaiz();
    if (!areas) {
      this._reintentarReserva();
      return;
    }
    this._reservaReintentos = 0;

    const prefijo = this.className;
    const host = (this._area && this._area.parentNode) ? this._area.parentNode : document;
    const medir = function (selector) {
      let alto = 0;
      const bandas = host.querySelectorAll ? host.querySelectorAll(selector) : [];
      Array.prototype.forEach.call(bandas, function (banda) {
        if (!banda.parentNode) return;
        const r = banda.getBoundingClientRect();
        if (r && r.height > alto) alto = r.height;
      });
      return Math.ceil(alto);
    };

    this._aplicarReserva(areas, 'bottom', medir('.' + prefijo + '--bottom'));
    this._aplicarReserva(areas, 'top', medir('.' + prefijo + '--top'));
  }

  /**
   * Escribe (o retira) la reserva de un borde en el contenedor .m-areas.
   * @param {HTMLElement} areas Contenedor .m-areas.
   * @param {string} lado 'bottom' o 'top'.
   * @param {number} alto Alto de la banda en pixeles (0 para retirarla).
   */
  _aplicarReserva(areas, lado, alto) {
    const clase = this.className + '-reserva-' + lado;
    const variable = '--' + clase;

    if (!alto) {
      if (areas.classList.contains(clase)) areas.classList.remove(clase);
      if (areas.style.getPropertyValue(variable)) areas.style.removeProperty(variable);
      return;
    }

    // El panel de la API deja 10 px de margen hacia el borde y la banda esta a
    // otros 10 px; apartando el alto de la banda y 6 px de aire el panel queda
    // por encima de ella sin tocarla.
    const valor = (alto + 6) + 'px';
    if (areas.style.getPropertyValue(variable) !== valor) {
      areas.style.setProperty(variable, valor);
    }
    if (!areas.classList.contains(clase)) areas.classList.add(clase);
  }

  /**
   * Reintenta el ajuste si .m-areas aun no existe (la API lo crea al construir
   * el mapa y puede no estar cuando se monta el primer plugin). Se limita el
   * numero de reintentos para no dejar un temporizador vivo sin motivo.
   */
  _reintentarReserva() {
    const self = this;
    if (this._reservaTimer || this._reservaReintentos >= 12) return;
    this._reservaReintentos++;
    this._reservaTimer = window.setTimeout(function () {
      self._reservaTimer = null;
      self._ajustarReserva();
    }, 250);
  }

  /**
   * Mantiene el margen al dia: el rail de la API se pobla de forma asincrona
   * (y cambia al conmutar 2D/3D), asi que no basta con medirlo una vez.
   */
  _vigilarRail() {
    const self = this;
    if (this._onResize) return;

    this._onResize = function () { self._programarAjuste(); };
    window.addEventListener('resize', this._onResize);

    if (typeof MutationObserver === 'function') {
      const raiz = document.querySelector('.m-areas');
      if (raiz) {
        this._observer = new MutationObserver(function () { self._programarAjuste(); });
        this._observer.observe(raiz, { childList: true, subtree: true });
      }
    }
  }

  /**
   * Vigila el alto de la banda: el contenido de un control puede pasar a dos
   * lineas al estrecharse la ventana (la lectura de mapInfo lo hace), y la
   * reserva que se le pasa a .m-areas tiene que seguirlo.
   */
  _vigilarAlto() {
    if (this._resizeObserver || !this._area) return;
    if (typeof ResizeObserver === 'undefined') return;
    const self = this;
    try {
      this._resizeObserver = new ResizeObserver(function () { self._programarAjuste(); });
      this._resizeObserver.observe(this._area);
    } catch (e) {
      this._resizeObserver = null;
    }
  }

  /**
   * Agrupa los ajustes en un solo frame: MutationObserver puede disparar
   * muchas veces seguidas al cambiar de implementacion.
   */
  _programarAjuste() {
    if (this._pendiente) return;
    const self = this;
    this._pendiente = window.requestAnimationFrame
      ? window.requestAnimationFrame(function () {
        self._pendiente = null;
        self._ajustarEspacio();
        self._ajustarReserva();
      })
      : window.setTimeout(function () {
        self._pendiente = null;
        self._ajustarEspacio();
        self._ajustarReserva();
      }, 80);
  }

  /**
   * Registra el area en el mapa. No dibuja nada por si mismo: solo prepara la
   * banda para que la rellenen los plugins.
   * @param {Object} map Mapa de la API.
   */
  addTo(map) {
    this._map = map;
    this._asegurarArea();
  }

  /**
   * Cuelga el elemento de un plugin dentro de la banda.
   * @param {HTMLElement} elemento Elemento ya construido por el plugin.
   * @param {Object} [opciones] { order:number } posicion en la fila.
   * @returns {HTMLElement|null} El elemento, o null si no se pudo colgar.
   */
  monta(elemento, opciones = {}) {
    if (!elemento || typeof elemento.appendChild !== 'function') return null;
    const area = this._asegurarArea();
    if (!area) return null;

    area.appendChild(elemento);

    // order es CSS: en un flex ROW ordena de izquierda a derecha.
    const orden = (opciones.order !== undefined && !Number.isNaN(Number(opciones.order)))
      ? Number(opciones.order) : this.order;
    elemento.style.order = String(orden);

    // Dentro de la banda manda el flujo: el plugin no debe seguir anclandose a
    // una esquina con position:absolute, se resetearia.
    elemento.style.position = 'static';
    elemento.style.left = 'auto';
    elemento.style.right = 'auto';
    elemento.style.top = 'auto';
    elemento.style.bottom = 'auto';
    elemento.style.margin = '0';

    if (this._hijos.indexOf(elemento) === -1) this._hijos.push(elemento);
    // El ancho del banda no cambia (los hijos van en fila), pero el alto sí, y
    // el alto decide qué paneles del rail se consideran solapados.
    this._programarAjuste();
    return elemento;
  }

  /**
   * Saca el elemento de la banda.
   * @param {HTMLElement} elemento Elemento a retirar.
   */
  desmonta(elemento) {
    if (!elemento) return;
    const i = this._hijos.indexOf(elemento);
    if (i > -1) this._hijos.splice(i, 1);
    if (elemento.parentNode) {
      try {
        elemento.parentNode.removeChild(elemento);
      } catch (e) {
        /* silencioso */
      }
    }
    this._programarAjuste();
  }

  /**
   * Cambia el order de un elemento ya montado.
   * @param {HTMLElement} elemento Elemento a reordenar.
   * @param {number} orden Nueva posicion.
   */
  reordena(elemento, orden) {
    if (!elemento || Number.isNaN(Number(orden))) return;
    elemento.style.order = String(Number(orden));
  }

  getHelp() {
    const IDEE = api_areaControls();
    return {
      title: 'Area de controles',
      content: new Promise((resolve) => {
        let html = '<div><p>Banda reservada para los plugins de tipo control ' +
          '(escala, atribucion). Se situa arriba o abajo del visualizador y ' +
          'ordena los plugins con el parametro <code>order</code>.</p></div>';
        if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
          html = IDEE.utils.stringToHtml(html);
        }
        resolve(html);
      }),
    };
  }

  getState() {
    return { openPosition: this.openPosition };
  }

  setState(state, map) {
    if (map) this._map = map;
    if (state && typeof state === 'object' && state.openPosition &&
      state.openPosition !== this.openPosition) {
      this.openPosition = (state.openPosition === 'top') ? 'top' : 'bottom';
      // Cambia de banda: suelta la actual para que se cree la nueva.
      this._soltarArea();
      this._area = null;
    }
    // El resto del estado es fijo por construccion; se limita a re-resolver el
    // DOM por si el mapa se ha recreado en el cambio de implementacion.
    this._asegurarArea();
    this._programarAjuste();
  }

  destroy() {
    // No se borra el div: lo comparten varios plugins y cada uno se desmonta a su
    // ritmo. Solo se sueltan las referencias y los escuchadores.
    this._soltarArea();
    this._hijos = [];
    this._area = null;
    this._map = null;
  }

  /**
   * Suelta el div del area y los escuchadores que vigilan el rail.
   */
  _soltarArea() {
    if (this._observer) {
      try {
        this._observer.disconnect();
      } catch (e) {
        /* silencioso */
      }
      this._observer = null;
    }
    if (this._onResize) {
      try {
        window.removeEventListener('resize', this._onResize);
      } catch (e) {
        /* silencioso */
      }
      this._onResize = null;
    }
    if (this._pendiente) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(this._pendiente);
      else window.clearTimeout(this._pendiente);
      this._pendiente = null;
    }
    if (this._resizeObserver) {
      try {
        this._resizeObserver.disconnect();
      } catch (e) {
        /* silencioso */
      }
      this._resizeObserver = null;
    }
    if (this._reservaTimer) {
      window.clearTimeout(this._reservaTimer);
      this._reservaTimer = null;
    }
    this._reservaReintentos = 0;
    // Al desmontar, el hueco que ocupaba la banda puede dejar de hacer falta.
    // Se recalcula aqui (y no solo en el siguiente frame) porque quien llama a
    // destroy() suele quitar el div del DOM acto seguido.
    this._ajustarReserva();
    const self = this;
    window.setTimeout(function () { self._ajustarReserva(); }, 0);
  }
}

// Resolvedor de la API: elije el global con la API REALMENTE cargada (con .ui y
// .map). No basta comprobar que IDEE exista porque este mismo fichero crea un
// window.IDEE vacio como namespace de plugins.
function api_areaControls() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

// Exposición triple: el global directo sobrevive al reinicio de window.IDEE que
// hace el cambio de implementacion, y desde ahi se repuebla el namespace nuevo.
if (typeof window !== 'undefined') {
  window.miPlugin_areaControls = miPlugin_areaControls;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_areaControls = miPlugin_areaControls;
  window.M = window.M || {};
  window.M.plugin = window.M.plugin || {};
  window.M.plugin.miPlugin_areaControls = miPlugin_areaControls;
}