/* =====================================================================
   PLUGIN DIAL DE ROTACIÓN PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   MOTIVACIÓN:
   El control de rotación ('rotate') del constructor IDEE.map({controls})
   lo dibuja la propia API como un panel de las areas de esquina
   (.m-area .m-top .m-left). Este plugin NO dibuja un dial propio: reutiliza
   ese control nativo (IDEE.control.Rotate) y lo cuelga en el mapa en
   caliente, que es lo que permite decidir la implementación antes de
   crearlo y retocarlo después.

   POR QUÉ NO SE MONTA EN 3D (medido sobre el bundle de Cesium):
   El motivo NO es que Cesium no sepa crear este control. Sí lo sabe: con el
   guard de 3D saltado, IDEE.control.Rotate se crea, se añade con addControls
   y pinta su panel sin lanzar nada. El motivo real es que el impl de Cesium
   no expone getView(), de modo que no hay vista a la que aplicar la
   rotación: el dial se dibujaría decorado y visible, pero inerte, porque la
   cámara no se mueve (mismo heading y mismo cuaternión antes y después de
   pedirle 90 grados). En 3D lo que hay para orientar la cámara es
   impl.scene.camera.heading, que este plugin no toca.

   Conviene no justificar el guard por la brújula de Cesium: el visor se crea
   sin sus widgets por defecto y no trae ninguna (no existe .cesium-compass
   en el DOM). No hay duplicación que evitar, simplemente no hay vista que
   gobernar.

   Lo que añade sobre el control nativo:
     - Lo deja con el tamaño y el aspecto de los botones de plugin
       (40x40, sombra incluida) en vez de los 43,2 px que trae de serie.
     - Quita el botón "Girar al norte" que el nativo lleva dentro: el norte
       se orienta con doble clic sobre el dial, que es la interacción que
       hacen los usuarios de los visores de la CNIG.
     - Oculta la flecha de plegado (los paneles no plegables no la usan).
     - Contrato de estado getState()/setState() para el swap 2D/3D: la
       rotación no la conserva la API al recrear el mapa, así que se guarda
       y se reaplica sobre la vista nueva.

   CONVENCIONES:
   1. Resolvedor dual de la API (window.IDEE || window.M) mediante api(),
      eligiendo el global que tenga la API REALMENTE cargada (.ui y .map).
   2. Detección de implementación: se prefiere map.getImplementation()
      ('ol' / 'cesium'), que es la que usa la propia API para distinguir sus
      dos implementaciones, y se cae al patrón canónico del repo
      (map.getMapImpl() con scene.camera) si ese método no existe.
   3. Constructor sin argumentos obligatorio:
      new IDEE.plugin.miPlugin_controlRotate()
   4. Contrato de estado getState()/setState() para el swap 2D/3D.
   5. Exposición triple (window / IDEE.plugin / M.plugin) para sobrevivir
      a la recarga del bundle de la API.
   ===================================================================== */

(function () {
  'use strict';

  /**
   * Resuelve el objeto global de la API cartográfica realmente cargada.
   * No basta con comprobar que exista window.IDEE: el bloque de exposición
   * de este mismo fichero crea un window.IDEE vacío como simple namespace
   * de plugins, así que se exige que tenga las propiedades funcionales
   * .ui y .map (patrón de api_clampToGround() en controlClampToGroundLayers).
   * @returns {Object} Espacio de nombres de la API-IDEE / API-CNIG.
   */
  function api() {
    const IDEE = window.IDEE;
    if (IDEE && IDEE.ui && IDEE.map) return IDEE;
    const M = window.M;
    if (M && M.ui && M.map) return M;
    return IDEE || M;
  }

  /**
   * Devuelve la implementación declarada por el mapa ('ol', 'cesium', ...).
   * @param {Object} map Instancia del mapa.
   * @returns {string} Nombre de la implementación, o cadena vacía si no se
   * puede averiguar.
   */
  function implementacion(map) {
    try {
      if (map && typeof map.getImplementation === 'function') {
        return String(map.getImplementation() || '').toLowerCase();
      }
    } catch (e) {
      /* Método no disponible en esta versión de la API */
    }
    return '';
  }

  /**
   * Dial de rotación del mapa. Solo tiene sentido en 2D: en 3D no se monta.
   */
  class miPlugin_controlRotate {
    /**
     * Constructor del plugin. Funciona sin argumentos.
     * @param {Object} [options={}] Opciones de configuración (todas opcionales).
     * @param {boolean} [options.visible=true] Estado inicial de visibilidad.
     * @param {number} [options.order] Orden dentro de la columna de esquina
     * (es el `order` CSS del panel de la API). Por defecto, al final.
     * @param {boolean} [options.norte=true] Mostrar el botón "Girar al norte"
     * que trae el control nativo. Por defecto false: el doble clic sobre el
     * dial hace lo mismo y el botón se quita.
     * @param {number} [options.size=40] Lado del dial en píxeles, el mismo que
     * los botones de las herramientas de la API.
     * @param {number} [options.step=15] Salto de giro con la rueda, en grados.
     * @param {number} [options.rotation=0] Rotación inicial, en radianes.
     * @param {string|Object} [options.color1] Color de fondo. Un color o un
     * objeto {active, deactive}.
     * @param {string|Object} [options.color2] Color de borde. Un color o un
     * objeto {active, deactive}.
     * @param {string|Object} [options.color3] Color de icono y texto. Un color o
     * un objeto {active, deactive}.
     */
    constructor(options = {}) {
      // Identificador obligatorio del plugin (gestor de plugins y cambioImpl).
      this.name = 'miPlugin_controlRotate';
      this.options = options || {};

      // Referencia al mapa y a los elementos de interfaz.
      this._map = null;
      this._host = null;
      this._control = null;
      this._panel = null;
      this._dial = null;

      // Listeners registrados (DOM, API y vista nativa) para poder soltarlos.
      this._listeners = [];
      this._listenersApi = [];
      this._listenersVista = [];
      this._vistaLigada = null;
      this._espera = null;

      // Configuración.
      this._visible = (options.visible !== undefined) ? Boolean(options.visible) : true;
      this.order = (options.order !== undefined && !Number.isNaN(Number(options.order)))
        ? Number(options.order) : undefined;
      this._conNorte = (options.norte !== undefined) ? Boolean(options.norte) : false;
      this._lado = (options.size !== undefined && Number(options.size) > 0) ? Number(options.size) : 40;
      const grados = (options.step !== undefined && !isNaN(Number(options.step))) ? Number(options.step) : 15;
      this._paso = Math.abs(grados) * Math.PI / 180;

      // En 3D el panel es propio: la roseta (que devuelve la cámara al norte) y los
      // cuatro botones de movimiento, que cuelgan de este y no del dial nativo.
      this._rosaBoton = null;
      this._cajaMovimiento = null;

      // Estado de la rotación (radianes, sentido horario como OpenLayers).
      this._rotacion = (options.rotation !== undefined && !isNaN(Number(options.rotation)))
        ? Number(options.rotation) : 0;

      // Colores configurables, con el mismo reparto y los mismos valores por
      // defecto que el resto de plugins del repositorio (color1 = fondo,
      // color2 = borde, color3 = icono; ver ext/CalidadAireMadridTiempoReal).
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
    }

    /**
     * Devuelve {active, deactive} a partir de un color simple o de un objeto.
     *
     *  Es el mismo traductor que usan los plugins que ya tenían esquema de
     *  colores, para que un color se pueda pasar como '#fff' o como
     *  {active: '#fff', deactive: '#eee'} indistintamente.
     * @param {string|Object} c Color u objeto de colores.
     * @returns {{active: string, deactive: string}} Los dos estados.
     */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /**
     * Vuelca los colores configurados a variables CSS del panel del dial.
     *
     *  Las seis variables del esquema (reposo y activo de fondo, borde e icono)
     *  se ponen en línea sobre el panel que la API crea para el control, y
     *  controlRotate.css las consume con `var(--g-plugin-bg-color, orangered)`
     *  y compañía. Así el color se cambia desde el visualizador sin tocar la hoja
     *  de estilos. El dial no tiene dos estados (no se abre ni se cierra), así
     *  que lo que se ve es el de reposo.
     * @returns {boolean} true si se pudieron poner las variables.
     */
    _aplicarColores() {
      try {
        if (!this._panel || !this._panel.style) return false;
        const c1 = this.resolveColor(this.color1);
        const c2 = this.resolveColor(this.color2);
        const c3 = this.resolveColor(this.color3);
        this._panel.style.setProperty('--g-plugin-bg-color', c1.deactive);
        this._panel.style.setProperty('--g-plugin-bg-color-active', c1.active);
        this._panel.style.setProperty('--g-plugin-border-color', c2.deactive);
        this._panel.style.setProperty('--g-plugin-border-color-active', c2.active);
        this._panel.style.setProperty('--g-plugin-icon-color', c3.deactive);
        this._panel.style.setProperty('--g-plugin-icon-color-active', c3.active);
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudieron aplicar los colores.`, e);
        return false;
      }
    }

    /**
     * Proporciona la información de ayuda al gestor de ayuda de la API-IDEE.
     * @returns {{title: string, content: Promise<HTMLElement|string>}} Ayuda del plugin.
     */
    getHelp() {
      const IDEE = api();
      return {
        title: 'Rotación del mapa',
        content: new Promise((resolve) => {
          let html = '<div><p>Botón de brújula que permite girar la orientación ' +
            'del mapa arrastrándolo, igual que los botones de herramientas ' +
            'del lateral.</p>' +
            '<p>Un doble clic sobre la brújula orienta el mapa al norte ' +
            '(0 grados). También se puede usar el teclado: con la brújula ' +
            'enfocada, las flechas izquierda y derecha giran el mapa y el ' +
            'inicio la orienta al norte.</p>' +
            '<p>En la visualización 3D (Cesium) no se muestra, ya que Cesium ' +
            'incorpora su propia brújula de orientación.</p></div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            try {
              html = IDEE.utils.stringToHtml(html);
            } catch (e) {
              /* Fallback defensivo si falla el conversor */
            }
          }
          resolve(html);
        }),
      };
    }

    // =====================================================================
    // UTILIDADES INTERNAS
    // =====================================================================

    /**
     * Indica si el mapa activo usa la implementación 3D (Cesium).
     * Se pregunta primero a la API (map.getImplementation()), que es la vía
     * que usa ella misma, y se cae al patrón canónico del repo
     * (getMapImpl() con scene.camera) si ese método no está disponible.
     * @param {Object} [map] Instancia del mapa (por defecto, la ya montada).
     * @returns {boolean} true si la implementación actual es Cesium (3D).
     */
    _es3D(map) {
      const mapRef = map || this._map;
      const impl = implementacion(mapRef);
      if (impl) return impl === 'cesium';
      try {
        const nativo = (mapRef && typeof mapRef.getMapImpl === 'function')
          ? mapRef.getMapImpl() : null;
        return !!(nativo && nativo.scene && nativo.scene.camera);
      } catch (e) {
        return false;
      }
    }

    /**
     * Devuelve la implementación nativa del mapa (ol.Map o Cesium.Viewer).
     * @returns {Object|null} Instancia nativa.
     */
    _impl() {
      try {
        return (this._map && typeof this._map.getMapImpl === 'function')
          ? this._map.getMapImpl() : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Devuelve la vista de OpenLayers (2D) o null si no está disponible.
     * @returns {Object|null} Vista del mapa OpenLayers.
     */
    _vista2D() {
      const impl = this._impl();
      if (!impl || typeof impl.getView !== 'function') return null;
      try {
        return impl.getView();
      } catch (e) {
        return null;
      }
    }

    /**
     * Localiza el elemento del DOM que aloja el mapa. Se sube desde
     * map.getContainer() hasta el contenedor raíz de la API
     * (.m-api-idee-container), que es el único nodo que existe igual en 2D
     * y en 3D: anclarlo a getContainer() no vale porque en OpenLayers
     * devuelve .ol-overlaycontainer-stopevent.
     * @param {Object} map Instancia del mapa.
     * @returns {HTMLElement|null} Elemento anfitrión.
     */
    _resolveHost(map) {
      let el = null;
      try {
        el = (map && typeof map.getContainer === 'function') ? map.getContainer() : null;
      } catch (e) {
        el = null;
      }
      if (!el || typeof el.querySelector !== 'function') {
        el = document.querySelector('.m-api-idee-container');
      }
      if (!el) return document.body || null;

      let nodo = el;
      let raiz = el;
      while (nodo && nodo !== document.body && nodo !== document.documentElement) {
        if (nodo.classList && nodo.classList.contains('m-api-idee-container')) {
          raiz = nodo;
          break;
        }
        if (nodo.querySelector && nodo.querySelector('.ol-viewport, .cesium-widget')) {
          raiz = nodo;
        }
        nodo = nodo.parentElement;
      }
      return raiz;
    }

    /**
     * Normaliza un ángulo en radianes al intervalo [-π, π].
     * @param {number} radianes Ángulo en radianes.
     * @returns {number} Ángulo normalizado.
     */
    _normalizar(radianes) {
      let r = Number(radianes);
      if (!isFinite(r)) return 0;
      const dosPi = Math.PI * 2;
      r = r % dosPi;
      if (r > Math.PI) r -= dosPi;
      if (r < -Math.PI) r += dosPi;
      return r;
    }

    // =====================================================================
    // MONTAJE DEL CONTROL NATIVO EN LA COLUMNA DE ESQUINA
    // =====================================================================

    /**
     * Crea el control Rotate de la API y lo añade al mapa en caliente.
     * Añadirlo en caliente (y no en IDEE.map({controls})) es lo que permite
     * decidir la implementación antes de crearlo y retocarlo después.
     * Ojo: este método funciona igual en 3D que en 2D y, al menos en esta
     * versión de la API, IDEE.map({controls: [Rotate]}) tampoco aborta la
     * creación del mapa en Cesium. Quien decide no montar en 3D es el guard
     * de addTo(), por lo de la vista; vease la MOTIVACIÓN de la cabecera.
     * @returns {boolean} true si se ha añadido el control.
     */
    _anadirControl() {
      const IDEE = api();
      if (!IDEE || !IDEE.control || typeof IDEE.control.Rotate !== 'function') {
        console.warn(`${this.name}: la API no expone IDEE.control.Rotate; ` +
          'el dial de rotación no se puede montar.');
        return false;
      }
      try {
        const op = { help: true };
        if (this.order !== undefined) op.order = this.order;
        this._control = new IDEE.control.Rotate(op);
        this._map.addControls([this._control]);
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudo crear el control de rotación.`, e);
        this._control = null;
        return false;
      }
    }

    /**
     * Monta, en 3D, el panel con la roseta y los cuatro botones de movimiento.
     *
     * El dial de 2D no sirve aquí (su rotación es la de la vista de OpenLayers y
     * el impl de Cesium no la tiene), pero la roseta sí sirve como botón para
     * volver al norte, porque en 3D el norte es un rumbo de cámara. Y debajo se
     * ponen los cuatro botones que mueven la cámara, que es lo que no había:
     *
     *   ← →  giran sobre el punto mirado   (camera.rotateLeft / rotateRight)
     *   ↑ ↓  inclinan la cámara            (camera.rotateUp / rotateDown)
     *
     * Se usan los métodos de la cámara de Cesium y no los de la escena a mano, que
     * son los que ya saben moverse alrededor del punto mirado y no están atados a
     * la resolución de la pantalla.
     *
     * El panel se pinta con las MISMAS clases que el de 2D (`.m-panel .m-rotate`)
     * para que herede el aspecto y el sitio de la API, y se cuelga en la misma
     * columna de esquina que usa el dial.
     * @returns {boolean} true si se ha montado.
     */
    _crearPanel3D() {
      const self = this;
      try {
        const panel = document.createElement('div');
        panel.className = 'm-panel m-rotate opened no-collapsible g-controlRotate g-controlRotate--3D';
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', 'Control de movimiento de la vista en 3D');

        // El disco: es a la vez el anillo que se arrastra para GIRAR y el
        //(container unlike the native one) el sitio donde se ve hacia donde mira
        // la camara. Con 40 px no hay anillo exterior e interior como en la
        // brujula de la API (150 px), asi que el anillo es el boton entero.
        const disco = document.createElement('div');
        disco.className = 'g-controlRotate-3D';
        disco.title = 'Arrastra para girar la vista';

        // La aguja con la N: gira al CONTRARIO que el mapa, para que la N apunte
        // siempre al norte de verdad (mismo truco que la rosa del dial de 2D).
        const aguja = document.createElement('div');
        aguja.className = 'g-controlRotate-3D-aguja';
        const norte = document.createElement('span');
        norte.className = 'g-controlRotate-3D-norte';
        norte.textContent = 'N';
        aguja.appendChild(norte);

        // El giroscopio del centro: se arrastra para INCLINAR la camara.
        const giroscopio = document.createElement('div');
        giroscopio.className = 'g-controlRotate-3D-giroscopio';
        giroscopio.title = 'Arrastra para inclinar la vista';

        disco.appendChild(aguja);
        disco.appendChild(giroscopio);
        panel.appendChild(disco);

        const area = this._host.querySelector('.m-area.m-top.m-left')
          || this._host.querySelector('.m-area')
          || this._host;
        area.appendChild(panel);
        this._panel = panel;
        this._dial = disco;
        this._aguja = aguja;
        this._giroscopio = giroscopio;

        // Un puntero, dos gestos: sobre el centro inclina, sobre el resto gira.
        // Se hace con los eventos de puntero (que ya traen el id de puntero) y
        // no con los del raton, porque el control tiene que funcionar tambien
        // con el dedo.
        this._arrastrar(disco, false);
        this._arrastrar(giroscopio, true);
        this._on(disco, 'dblclick', function () { self._vistaInicial3D(); });

        this._aplicarColores();
        if (this.order !== undefined) panel.style.order = String(this.order);
        this._aplicarVisibilidad();
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudo montar el panel de 3D.`, e);
        return false;
      }
    }

    /**
     * Conecta un arrastre de puntero sobre un elemento al movimiento de la
     * camara: en horizontal gira (rumbo) y en vertical inclina (pitch).
     * @param {HTMLElement} el Elemento que arrastra.
     * @param {boolean} inclina true si es el giroscopio (solo inclina).
     */
    _arrastrar(el, inclina) {
      const self = this;
      let x0 = 0, y0 = 0;
      const RATIO_GIRO = 0.008;
      const RATIO_INCLINAR = 0.006;
      this._on(el, 'pointerdown', function (ev) {
        if (ev.button !== undefined && ev.button !== 0) return;
        x0 = ev.clientX;
        y0 = ev.clientY;
        if (el.setPointerCapture && ev.pointerId !== undefined) {
          try { el.setPointerCapture(ev.pointerId); } catch (e) { /* no hace falta */ }
        }
        ev.preventDefault();
      });
      this._on(el, 'pointermove', function (ev) {
        const camara = self._camaraCesium();
        if (!camara) return;
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        if (!dx && !dy) return;
        x0 = ev.clientX;
        y0 = ev.clientY;
        try {
          if (inclina) {
            // Arriba del centro se mira más de lado y abajo más de cenital.
            camara.rotateUp(dy * RATIO_INCLINAR);
          } else {
            camara.rotateLeft(-dx * RATIO_GIRO);
          }
          self._pintarAguja3D();
        } catch (e) {
          /* la camara puede no estar lista todavia */
        }
      });
    }

    /**
     * Gira la aguja para que la N apunte al norte, y deduce el rumbo de la
     * camara. Como gira al reves que el mapa, es el mismo criterio que la rosa
     * del dial de 2D.
     */
    _pintarAguja3D() {
      const camara = this._camaraCesium();
      if (!camara || !this._aguja) return;
      const grados = -(Number(camara.heading) || 0) * 180 / Math.PI;
      this._aguja.style.transform = 'rotate(' + grados.toFixed(1) + 'deg)';
    }

    /**
     * Vuelve la camara a la vista de partida: sobre el punto mirado, mirando
     * hacia abajo y con rumbo cero. Es lo que hace el doble clic en la brjula
     * de la API.
     */
    _vistaInicial3D() {
      const escena = this._escenaCesium();
      const camara = this._camaraCesium();
      const C = window.Cesium;
      if (!escena || !camara || !C || !C.Math) return;
      try {
        const centro = camara.pickEllipsoid(
          new C.Cartesian2(escena.canvas.clientWidth / 2, escena.canvas.clientHeight / 2),
          escena.globe ? escena.globe.ellipsoid : null
        );
        camara.setView({
          destination: centro || camara.positionWC,
          orientation: { heading: 0, pitch: C.Math.toRadians(-90), roll: 0 },
        });
        this._pintarAguja3D();
      } catch (e) {
        console.warn(`${this.name}: no se pudo volver a la vista inicial.`, e);
      }
    }
    /**
     * Localiza el panel que la API acaba de crear para el control y lo deja
     * con el aspecto de un botón de herramienta.
     * El panel se crea de forma síncrona al añadir el control, pero se espera
     * con reintentos cortos por si alguna implementación lo difiere.
     */
    _prepararPanel() {
      const self = this;
      const buscar = function (intentos) {
        const host = self._host;
        if (!host || !host.querySelector) return;
        const panel = host.querySelector('.m-panel.m-rotate');
        if (panel) {
          self._panel = panel;
          self._adaptarPanel();
          return;
        }
        if (intentos <= 0) return;
        self._espera = window.requestAnimationFrame
          ? window.requestAnimationFrame(function () {
            self._espera = null;
            buscar(intentos - 1);
          })
          : window.setTimeout(function () {
            self._espera = null;
            buscar(intentos - 1);
          }, 60);
      };
      buscar(20);
    }

    /**
     * Ajusta el panel nativo al aspecto y tamaño de los botones de las
     * herramientas de la API: 40x40, sin flecha de plegado y, salvo que se
     * pida lo contrario, sin el botón de norte (lo hace el doble clic).
     * Lo que se toca son CLASES y atributos: los estilos de tamaño y de botón
     * de norte viven en controlRotate.css, para que se puedan revisar.
     */
    _adaptarPanel() {
      const panel = this._panel;
      if (!panel) return;
      panel.classList.add('g-controlRotate');
      if (this._lado && this._lado !== 43.2) {
        panel.classList.add('g-controlRotate--tam');
        panel.style.setProperty('--g-controlRotate-lado', this._lado + 'px');
      }
      if (!this._conNorte) panel.classList.add('g-controlRotate--sinNorte');
      // Y los colores configurados, como variables CSS sobre el panel.
      this._aplicarColores();
      // La API no lleva el `order` del control al panel, de modo que se
      // escribe aquí: en la columna (flex column) es lo que decide si el
      // dial va primero o al final.
      if (this.order !== undefined) panel.style.order = String(this.order);

      // El dial: doble clic para orientar al norte y rueda para girar en
      // saltos. El control nativo ya gestiona el arrastre con el puntero.
      const dial = panel.querySelector('#m-rotate-slider, #m-rotate-slider-container')
        || panel.querySelector('.m-rotate-container') || panel;
      this._dial = dial;

      // La rosa de los vientos en el centro del disco.
      //
      // POR QUÉ HAY QUE AÑADIRLA: el control nativo de la API solo pinta UN PUNTO
      // blanco que orbita cerca del borde (medido: el DOM del dial son el
      // contenedor, el área de arrastre, el botón de norte y el <svg> del punto;
      // no hay aguja ni rosa en ninguna parte, y el resto de las reglas de la API
      // para el dial, como `.m-rotate-rotation-maker`, son de la otra variante del
      // control, que esta instancia no construye). Con eso el dial se ve como un
      // disco de color liso, y no dice de qué va.
      //
      // Se pinta con la fuente de iconos de la propia API
      // (`.g-cartografia-brujula`, que es la brújula de la misma hoja que el
      // resto de iconos), en vez de con un SVG propio, para que el trazo y el
      // grosor sean los de la API y no los de este plugin.
      const sitio = panel.querySelector('#m-rotate-slider-container') || dial;
      if (sitio) {
        const rosa = document.createElement('span');
        rosa.className = 'm-rotate-rosa g-controlRotate-rosa g-cartografia-brujula';
        rosa.setAttribute('aria-hidden', 'true');
        sitio.appendChild(rosa);
        this._rosa = rosa;
      }
      this._pintarRosa();

      if (dial) {
        const self = this;
        this._on(dial, 'dblclick', function (evento) {
          evento.preventDefault();
          self._aplicarRotacion(0);
        });
        this._on(dial, 'wheel', function (evento) {
          if (self._es3D(self._map)) return;
          evento.preventDefault();
          self._girar((evento.deltaY > 0 ? -1 : 1) * self._paso);
        }, { passive: false });
        this._on(dial, 'keydown', function (evento) { self._alPulsarTecla(evento); });
      }
    }

    /**
     * Aplica una rotación al mapa (2D). En 3D se conserva el valor interno
     * (para que getState() siga siendo fiel y la rotación se recupere al
     * volver a 2D) pero NO se toca la cámara de Cesium.
     * @param {number} radianes Rotación deseada en radianes.
     */
    _aplicarRotacion(radianes) {
      this._rotacion = this._normalizar(radianes);
      // La rosa va antes del guard de 3D: es adorno del dial, que es de 2D, pero
      // pintarla siempre deja el elemento al día aunque el mapa cambie mientras.
      this._pintarRosa();
      if (this._es3D(this._map)) return;
      const vista = this._vista2D();
      if (vista && typeof vista.setRotation === 'function') {
        try {
          vista.setRotation(this._rotacion);
        } catch (e) {
          /* La vista puede no estar lista todavía */
        }
      }
    }

    /**
     * Gira un paso desde la rotación actual.
     * @param {number} delta Incremento en radianes (negativo = antihorario).
     */
    _girar(delta) {
      this._aplicarRotacion(this._rotacion + delta);
    }

    /**
     * Lee la rotación de la vista y la guarda, por si el mapa cambia por otra
     * vía (por ejemplo, el gesto de dos dedos).
     */
    _sincronizar() {
      if (this._es3D(this._map)) return;
      const vista = this._vista2D();
      if (!vista || typeof vista.getRotation !== 'function') return;
      let rotacion = 0;
      try {
        rotacion = Number(vista.getRotation());
      } catch (e) {
        return;
      }
      if (isFinite(rotacion)) {
        this._rotacion = this._normalizar(rotacion);
        this._pintarRosa();
      }
    }

    /**
     * Gira la rosa de los vientos del disco para que apunte al norte.
     *
     * El signo es el contrario al de la vista, y es lo importante: cuando el mapa
     * gira 45° en sentido horario, el norte se ve arriba a la izquierda, así que la
     * rosa tiene que girar 45° en sentido ANTIHORARIO. Con el mismo signo que la
     // vista la rosa apuntaría al sur (medido: con la vista en +45 la rosa queda
     * abajo a la derecha, que es justo lo contrario de lo que indica).
     */
    _pintarRosa() {
      if (!this._rosa) return;
      const grados = -(this._rotacion * 180 / Math.PI);
      this._rosa.style.transform = 'rotate(' + grados.toFixed(1) + 'deg)';
    }

    /**
     * Teclado sobre el dial: flechas para girar, Inicio para el norte.
     * @param {Event} evento Evento keydown.
     */
    _alPulsarTecla(evento) {
      if (this._es3D(this._map)) return;
      const paso = this._paso || (15 * Math.PI / 180);
      let manejado = true;
      switch (evento.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
        case 'Left':
        case 'Down':
          this._girar(-paso);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
        case 'Right':
        case 'Up':
          this._girar(paso);
          break;
        case 'Home':
          this._aplicarRotacion(0);
          break;
        default:
          manejado = false;
      }
      if (manejado && typeof evento.preventDefault === 'function') evento.preventDefault();
    }

    /**
     * Muestra u oculta el panel.
     */
    _aplicarVisibilidad() {
      if (!this._panel) return;
      // En 3D también se ve: lo que se monta es el panel de movimiento. Antes se
      // escondía porque en 3D no se montaba nada, y ahora sí.
      this._panel.style.display = this._visible ? '' : 'none';
    }

    /**
     * Escena de Cesium, o null si el mapa no es de 3D.
     * @returns {Object|null} Escena.
     */
    _escenaCesium() {
      try {
        const impl = this._impl();
        return (impl && impl.scene) ? impl.scene : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Cámara de Cesium, o null si el mapa no es de 3D.
     * @returns {Object|null} Cámara.
     */
    _camaraCesium() {
      const escena = this._escenaCesium();
      return escena ? escena.camera : null;
    }

    /**
     * @returns {number} Rotación actual en radianes.
     */
    getRotation() {
      return this._rotacion;
    }

    /**
     * Fija la rotación del mapa directamente.
     * @param {number} radianes Rotación en radianes.
     */
    setRotation(radianes) {
      this._aplicarRotacion(radianes);
    }

    /**
     * Cambia la visibilidad del dial.
     * @param {boolean} visible true para mostrar, false para ocultar.
     */
    setVisible(visible) {
      this._visible = Boolean(visible);
      this._aplicarVisibilidad();
    }

    /**
     * @returns {boolean} Visibilidad actual solicitada por el usuario.
     */
    getVisible() {
      return Boolean(this._visible);
    }

    // =====================================================================
    // GESTIÓN DE LISTENERS
    // =====================================================================

    /**
     * Registra un listener DOM y lo anota para poder soltarlo en destroy().
     * @param {EventTarget} objetivo Elemento destino.
     * @param {string} tipo Tipo de evento.
     * @param {Function} fn Función escuchada.
     * @param {Object|boolean} [opciones] Opciones de addEventListener.
     */
    _on(objetivo, tipo, fn, opciones) {
      if (!objetivo || typeof objetivo.addEventListener !== 'function') return;
      objetivo.addEventListener(tipo, fn, opciones);
      this._listeners.push({ objetivo: objetivo, tipo: tipo, fn: fn, opciones: opciones });
    }

    /**
     * Registra un listener de la API sobre el mapa (map.on).
     * @param {string} tipo Constante de IDEE.evt.
     * @param {Function} fn Función escuchada.
     */
    _onApi(tipo, fn) {
      if (!tipo || !this._map || typeof this._map.on !== 'function') return;
      try {
        this._map.on(tipo, fn);
        this._listenersApi.push(tipo);
      } catch (e) {
        /* El evento no existe en esta versión de la API */
      }
    }

    /**
     * Enlaza el listener 'change:rotation' de la vista de OpenLayers. Si la
     * vista es otra instancia (p. ej. tras el reinicio del mapa), suelta
     * primero los listeners de la vista anterior para no duplicarlos.
     */
    _enlazarVista() {
      const vista = this._vista2D();
      if (!vista) return;
      if (this._vistaLigada === vista) return;
      this._desenlazarVista();
      const self = this;
      try {
        vista.on('change:rotation', function () { self._sincronizar(); });
        this._listenersVista.push({ vista: vista, tipo: 'change:rotation' });
      } catch (e) {
        /* La vista no admite este evento */
      }
      this._vistaLigada = vista;
    }

    /**
     * Suelta los listeners nativos de la vista enlazada anteriormente.
     */
    _desenlazarVista() {
      for (let i = 0; i < this._listenersVista.length; i++) {
        const l = this._listenersVista[i];
        try {
          if (l.vista && typeof l.vista.un === 'function') l.vista.un(l.tipo);
        } catch (e) {
          /* silencioso */
        }
      }
      this._listenersVista = [];
      this._vistaLigada = null;
    }

    /**
     * Suelta todos los listeners registrados (DOM, API y vista nativa).
     */
    _offAll() {
      for (let i = 0; i < this._listeners.length; i++) {
        const l = this._listeners[i];
        try {
          l.objetivo.removeEventListener(l.tipo, l.fn, l.opciones);
        } catch (e) {
          /* silencioso */
        }
      }
      this._listeners = [];

      for (let i = 0; i < this._listenersApi.length; i++) {
        try {
          if (this._map && typeof this._map.off === 'function') this._map.off(this._listenersApi[i]);
        } catch (e) {
          /* silencioso */
        }
      }
      this._listenersApi = [];
      this._desenlazarVista();
    }

    // =====================================================================
    // CICLO DE VIDA: MONTAJE EN EL MAPA
    // =====================================================================

    /**
     * Método invocado por mapajs.addPlugin(pluginInstancia).
     * @param {Object} map Instancia del mapa (IDEE.Map / M.Map).
     */
    addTo(map) {
      this._map = map;
      const IDEE = api();
      const evt = (IDEE && IDEE.evt) ? IDEE.evt : {};
      this._host = this._resolveHost(map);

      // En 3D se monta el control NATIVO, que si funciona (la variante que
      // construye Cesium maneja la camara, no la vista de OpenLayers), pero es
      // una brujula de 150x150 (medido) y aqui tiene que caber en un boton de 40.
      //
      // Con 40 no cabe la brujula de la API, asi que se conserva su LENGUAJE y se
      // reducen las piezas: el disco entero es el anillo que gira y el giroscopio
      // del centro es lo que inclina. La rueda de 150 px (anillo fuera, circulo
      // dentro) se convierte en un boton con el circulo dentro, que es lo mismo
      // en un boton. Si el nuestro no se puede montar, se cae al nativo, que se
      // ve mas grande pero funciona.
      if (this._es3D(map)) {
        if (this._crearPanel3D()) return;
      }
      if (!this._anadirControl()) return;
      this._prepararPanel();

      // Sincronización si la rotación cambia por otra vía.
      this._onApi(evt.CHANGE_ROTATION, () => { this._sincronizar(); });
      this._onApi(evt.COMPLETED, () => {
        // Al terminar la carga del mapa la vista puede ser otra instancia:
        // se sueltan los listeners de la anterior y se enlaza la nueva.
        this._enlazarVista();
        this._sincronizar();
        this._aplicarVisibilidad();
      });
      this._enlazarVista();

      // Si el mapa llega ya girado (por ejemplo, restaurando una vista
      // guardada), se adopta esa rotación en lugar de la que traía el plugin.
      this._sincronizar();
      if (!this._rotacion) this._aplicarRotacion(this._rotacion);
    }

    /**
     * Desmonta el plugin: quita el control del mapa y desconecta listeners.
     */
    destroy() {
      this._offAll();
      if (this._espera) {
        if (window.cancelAnimationFrame) window.cancelAnimationFrame(this._espera);
        else window.clearTimeout(this._espera);
        this._espera = null;
      }
      if (this._control && this._map && typeof this._map.removeControls === 'function') {
        try {
          this._map.removeControls([this._control]);
        } catch (e) {
          /* el mapa puede estar ya destruido */
        }
      }
      // El panel de 3D es DOM propio (no lo gestiona la API), así que hay que
      // quitarlo a mano; el de 2D se va solo con removeControls.
      if (this._panel && !this._control && this._panel.parentNode) {
        try {
          this._panel.parentNode.removeChild(this._panel);
        } catch (e) {
          /* el mapa puede estar ya destruido */
        }
      }
      this._control = null;
      this._panel = null;
      this._dial = null;
      this._rosa = null;
      this._rosaBoton = null;
      this._cajaMovimiento = null;
      this._host = null;
      this._map = null;
    }

    // =====================================================================
    // CONTRATO DE ESTADO (CAMBIO DE IMPLEMENTACIÓN 2D / 3D)
    // =====================================================================

    /**
     * Captura el estado serializable mínimo de la interfaz.
     * @returns {{visible: boolean, rotacion: number}} Estado del dial.
     */
    getState() {
      this._sincronizar();
      return {
        visible: Boolean(this._visible),
        rotacion: Number(this._rotacion),
      };
    }

    /**
     * Restaura el estado en la instancia ya montada (addTo ya se ejecutó
     * tras el swap 2D/3D). No reconstruye la interfaz.
     * @param {Object} state Estado previamente capturado con getState().
     * @param {Object} [map] Nueva instancia del mapa.
     */
    setState(state, map) {
      if (map) this._map = map;
      const st = (state && typeof state === 'object') ? state : {};
      if (typeof st.visible === 'boolean') this._visible = st.visible;
      if (st.rotacion !== undefined && st.rotacion !== null && !isNaN(Number(st.rotacion))) {
        // Se aplica sobre el mapa NUEVO: no se asume nada del anterior.
        this._aplicarRotacion(Number(st.rotacion));
      } else {
        this._sincronizar();
      }
      this._enlazarVista();
      this._aplicarVisibilidad();
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
    window.miPlugin_controlRotate = miPlugin_controlRotate;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_controlRotate = miPlugin_controlRotate;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_controlRotate = miPlugin_controlRotate;
  }
})();