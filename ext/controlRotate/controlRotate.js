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
  /**
   * La rosa de los vientos del dial: dos triángulos cruzados.
   *
   * SVG de https://www.svgrepo.com/svg/480720/compass, descargado de
   * https://www.svgrepo.com/download/480720/compass.svg y copiado también en
   * img/iconos/compass.svg.
   *
   * Va aquí en línea, y no como `<img>` ni como url de máscara, por dos cosas:
   * la rosa GIRA con la vista (va dentro de un elemento al que se le cambia el
   * `transform`) y tiene que tomar el color de `--g-plugin-icon-color`, cosa que
   * un `<img>` no puede hacer. El `viewBox` es el del original y el tamaño lo
   * pone el CSS.
   */
  const SVG_ROSA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"'
    + ' fill="currentColor" aria-hidden="true" focusable="false">'
    + '<path d="M359.328,257.563l-1.953-5.75l-5.656-16.719l-74.5-219.891v-0.047C274.109,6.094,265.625,0,256.031,0'
    + ' c-9.609,0-18.141,6.094-21.219,15.219v-0.047l-82.141,242.469l82.25,239.234l0.016,0.109c3.063,8.844,'
    + '11.594,15.063,21.156,15.016 c9.453,0.047,18.125-6.078,21.188-15.156l-0.031,0.031L359.328,257.563z'
    + ' M256.25,424.875l-0.156-0.484l-0.156,0.484 l-57.453-167.266h115.203L256.25,424.875z"/></svg>';

  /**
   * Icono que se ve al pasar el ratón por el botón: el átomo del pack "Minimal UI
   * Icons", guardado en img/iconos/atom-1298.svg y puesto aquí en línea para que
   * tome el color del esquema por `currentColor` (un `<img>` no lo haría).
   */
  const SVG_ATOM = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"> <path fill="currentColor" transform="translate(-118.72 -1653.7) scale(0.7399)" d="M180.407706,2250.77619 C178.984549,2252.60108 177.496521,2254.0618 175.773962,2255.40378 C177.201111,2256.22793 180.549423,2257.72157 181.634256,2256.63701 C182.374777,2255.89667 182.034457,2253.58088 180.407706,2250.77619 M174.001503,2254.25137 C175.983544,2252.80163 177.797919,2250.98771 179.247025,2249.00617 C177.803907,2247.03161 175.99053,2245.21569 174.001503,2243.76096 C172.00549,2245.21968 170.195106,2247.03759 168.754982,2249.00617 C170.204088,2250.98871 172.019462,2252.80163 174.001503,2254.25137 M172.228045,2255.40378 C170.501494,2254.05781 169.013466,2252.59709 167.594301,2250.77619 C165.96755,2253.58088 165.62723,2255.89667 166.367751,2256.63701 C167.442604,2257.71059 170.761973,2256.25187 172.228045,2255.40378 M167.594301,2247.23615 C169.01646,2245.41125 170.504488,2243.95153 172.228045,2242.60855 C170.802892,2241.78441 167.453582,2240.28977 166.367751,2241.37533 C165.62723,2242.11566 165.96755,2244.43146 167.594301,2247.23615 M175.773962,2242.60855 C177.500513,2243.95353 178.987543,2245.41424 180.407706,2247.23615 C184.018494,2241.00915 181.287948,2239.42172 175.773962,2242.60855 M181.664197,2249.00617 C187.098342,2257.49707 182.427671,2262.0648 174.001503,2256.67392 C165.595294,2262.05183 160.885701,2257.52501 166.338809,2249.00617 C160.941589,2240.57413 165.492499,2235.89465 174.001503,2241.33841 C182.424677,2235.94953 187.103332,2240.50828 181.664197,2249.00617 M175.065378,2247.94555 C175.649211,2248.53024 175.649211,2249.47811 175.065378,2250.06179 C174.480546,2250.64648 173.53244,2250.64648 172.947608,2250.06179 C172.362776,2249.47811 172.362776,2248.53024 172.947608,2247.94555 C173.53244,2247.36087 174.480546,2247.36087 175.065378,2247.94555"/> </svg>';

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
    // LA BOLITA DEL CONTROL NATIVO
    // =====================================================================

    /**
     * Saca los grados de un `transform: rotate(Ndeg)`.
     * @param {string} texto Valor de `style.transform`.
     * @returns {number|null} Los grados, o null si no es un giro en grados.
     */
    _gradosDelTransform(texto) {
      if (typeof texto !== 'string') return null;
      const encontrado = /rotate\(\s*(-?[\d.]+)\s*deg\s*\)/.exec(texto);
      return encontrado ? Number(encontrado[1]) : null;
    }

    /**
     * Mantiene al día la bolita del control nativo (`#m-rotate-marker`), que es
     * la que se ve al pasar el ratón por el botón.
     *
     * POR QUÉ HACE FALTA: la API mueve esa bolita con su propio `transform`
     * SOLO mientras el arrastre es suyo. Medido: la bolita está en
     * `rotate(45deg)` con la vista a 0, y al girar nosotros con `setRotation` el
     * `rotate(45deg)` se queda clavado. Así que cuando se va al norte con el
     * doble clic, o con la rueda, o con las teclas, la vista gira y la bolita se
     * queda en la última posición: el botón miente.
     *
     * CÓMO SE ARREGLA: se aplica al `transform` de la bolita la misma variación
     * que ha tenido la vista. Como solo se suman variaciones, el desfase que la
     * API usa de base (los 45°) se respeta solo.
     *
     * Si el `transform` ha cambiado sin que lo cambiemos nosotros, es que lo ha
     * movido la API, o sea que el arrastre es suyo: entonces solo se toma nota y
     * no se toca, para no mover la bolita dos veces.
     *
     * @param {number} rotacion Rotación actual de la vista, en radianes.
     */
    _sincronizarMarcador(rotacion) {
      // Se aplaza un frame a propósito. Con el arrastre de la API, su manejador
      // actualiza el marcador DESPUÉS de que se dispare CHANGE_ROTATION, así que
      // si se tocara aquí la bolita avanzaría dos veces.
      if (this._frameBolita && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(this._frameBolita);
      }
      const self = this;
      this._frameBolita = window.requestAnimationFrame
        ? window.requestAnimationFrame(function () {
            self._frameBolita = null;
            self._moverMarcador(rotacion);
          })
        : window.setTimeout(function () {
            self._frameBolita = null;
            self._moverMarcador(rotacion);
          }, 16);
    }

    /**
     * Aplica a la bolita la variación de la vista desde la última vez que se
     * vio. Trabaja en grados porque el `transform` de la API está en grados.
     * @param {number} rotacion Rotación actual de la vista, en radianes.
     */
    _moverMarcador(rotacion) {
      const marcador = (this._panel && this._panel.querySelector)
        ? this._panel.querySelector('#m-rotate-marker')
        : null;
      if (!marcador || !marcador.style) return;
      const grados = this._gradosDelTransform(marcador.style.transform);
      if (this._marcadorGrados === undefined || grados === null) {
        this._marcadorGrados = grados;
        this._marcadorRotacion = rotacion;
        return;
      }
      // Lo ha movido la API: solo se toma nota.
      if (Math.abs(grados - this._marcadorGrados) > 0.05) {
        this._marcadorGrados = grados;
        this._marcadorRotacion = rotacion;
        return;
      }
      const delta = this._normalizar(rotacion - this._marcadorRotacion);
      if (!delta) return;
      const nuevo = grados + delta * 180 / Math.PI;
      marcador.style.transform = 'rotate(' + nuevo.toFixed(1) + 'deg)';
      this._marcadorGrados = nuevo;
      this._marcadorRotacion = rotacion;
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
    /**
     * Pinta dentro del panel de 3D el mismo dial que en 2D: el disco de 40x40 con
     * el color del plugin y la rosa de svgrepo en el centro, y oculta la brújula
     * grande de la API, que es la que se colocaba fuera de la pantalla (ver el
     * comentario en _adaptarPanel).
     *
     * Lo que NO hace todavía es el gesto: el que gira y el que inclina son los de
     * la brújula de la API, que está oculta. La cámara va con lookAt y su
     * lookAtTransform, y está medido que rotateUp, rotateLeft y lookAt no la
     * mueven, y que un setView con orientation aplica la inclinación en el marco
     * equivocado (pedir -89 grados devuelve -20). Ese es el siguiente pendiente.
     *
     * @param {HTMLElement} panel Panel donde se pinta el dial.
     */
    _pintarDial3D(panel) {
      try {
        // Se marca el panel como el de 3D. Lo que se pinta dentro es una copia
        // del dial de 2D, y hay reglas de CSS que solo deben tocar a esa copia.
        panel.classList.add('g-controlRotate--3D');

        // La brújula grande de la API se borra en vez de ocultarse: el dial de
        // abajo lleva sus mismas clases (`m-control m-rotate-container`), y con un
        // `display: none` sobre lo que devuelva el selector, el selector a veces
        // cogía el nuestro y salía de 0x0 (medido). Borrando el suyo no hay
        // ambigüedad.
        const nativo = panel.querySelector('.m-control.m-rotate-container, .m-rotate-compass');
        if (nativo && nativo.parentNode) {
          nativo.parentNode.removeChild(nativo);
          this._nativo3D = nativo;
        }

        // La MISMA estructura que el dial de 2D, elemento por elemento:
        //   div.m-control.m-rotate-container
        //     > div#m-rotate-slider-container
        //         > svg#m-rotate-marker > circle#m-rotate-marker-circle
        //         > span.m-rotate-rosa.g-controlRotate-rosa
        // Lo único que NO se copia es `#m-rotate-slider`, que es el área de
        // arrastre de la variante de OpenLayers (medido: en 3D no existe), ni el
        // botón de norte, que en 2D ya se oculta con la clase --sinNorte.
        // Al ser los mismos id y clases, lo pinta el CSS de 2D tal cual.
        const NS = 'http://www.w3.org/2000/svg';
        const contenedor = document.createElement('div');
        contenedor.className = 'm-control m-rotate-container';
        contenedor.setAttribute('tabindex', '-1');

        const disco = document.createElement('div');
        disco.id = 'm-rotate-slider-container';

        // La bolita, tal cual en 2D: un svg con el circle dentro.
        const marcador = document.createElementNS(NS, 'svg');
        marcador.id = 'm-rotate-marker';
        const circulo = document.createElementNS(NS, 'circle');
        circulo.id = 'm-rotate-marker-circle';
        circulo.setAttribute('cx', '8');
        circulo.setAttribute('cy', '8');
        circulo.setAttribute('r', '6');
        marcador.appendChild(circulo);
        disco.appendChild(marcador);
        this._bola3D = marcador;

        const rosa = document.createElement('span');
        rosa.className = 'm-rotate-rosa g-controlRotate-rosa';
        rosa.setAttribute('aria-hidden', 'true');
        rosa.innerHTML = SVG_ROSA;
        disco.appendChild(rosa);

        // El icono de hover va al lado, no encima: los dos están siempre en
        // el DOM y el CSS los cambia de opacidad al pasar el ratón. Así el mismo
        // marcado sirve en línea (aquí) y como máscara en `mask-image`, y en
        // línea un elemento que aparece y desaparece al vuelo no se puede leer.
        const atom = document.createElement('span');
        atom.className = 'g-controlRotate-atom';
        atom.setAttribute('aria-hidden', 'true');
        atom.innerHTML = SVG_ATOM;
        disco.appendChild(atom);
        this._atom3D = atom;

        contenedor.appendChild(disco);
        panel.appendChild(contenedor);

        this._dial = disco;
        this._dial3D = disco;
        this._rosa = rosa;
        this._pintarRosa();
        if (this.order !== undefined) panel.style.order = String(this.order);
        this._aplicarVisibilidad();

        // El gesto de girar: en este dial no lo trae la API, hay que ponerlo.
        this._arrastrarDial3D(panel);
        // El gesto del átomo, que inclina la vista. También es solo de 3D.
        this._arrastrarAtomo3D(panel);
        // La rosa tiene que seguir a la cámara, que también se gira con el
        // ratón sobre el mapa, no solo con la bolita. Se escucha en
        // `postRender` y no en `camera.changed` porque es lo que hace la API con
        // su brújula, y porque `changed` va retardado: con él la rosa se
        // quedaba con un rumbo intermedio al terminar el arrastre (medido).
        const escena = this._escenaCesium();
        if (escena && escena.postRender && typeof escena.postRender.addEventListener === 'function') {
          // Se repinta la rosa y se recoloca la bolita. La bolita es la marca
          // de giro, así que tiene que ir detrás del rumbo de verdad:
          // medido, con la bolita a la derecha el rumbo es -90 grados.
          this._alCambiarCamara = () => {
            this._pintarRosa();
            this._sincronizarBolita3D();
          };
          escena.postRender.addEventListener(this._alCambiarCamara);
        }
      } catch (e) {
        console.warn(`${this.name}: no se pudo pintar el dial de 3D.`, e);
      }
    }

    /**
     * Engancha el gesto de girar del dial de 3D: arrastrar la bolita gira la
     * vista de Cesium.
     *
     * LA RECETA ES LA DE LA PROPIA API, no una inventada aquí. Medido en su
     * bundle (control Rotate de la variante de Cesium): el gesto `rotate` de su
     * brújula grande NO llama a la cámara tal cual, sino que envuelve la rotación
     * en un marco ENU del punto al que mira la cámara y aplica `rotateRight`
     * dentro, con `lookAtTransform` antes y después.
     *
     * POR QUÉ NO VALE LLAMAR A LA CÁMARA A PELO: porque la cámara va montada con
     * `lookAt`, y entonces `rotateUp`, `rotateLeft` y un `setView` con
     * `orientation` no la mueven (medido: `rotateRight` sin marco teletransporta
     * la cámara en vez de girarla, y `setView` mete la inclinación en el marco
     * equivocado: pedir -89 grados devuelve -20).
     *
     * El punto al que mira la cámara se saca como lo saca la API: un rayo desde
     * la posición de la cámara en su dirección, cortado por el globo
     * (`globe.pick`). Si ese punto no sale, se gira alrededor de la propia
     * cámara, que es lo que hace la API en ese caso.
     *
     * @param {HTMLElement} panel Panel del dial de 3D.
     */
    _arrastrarDial3D(panel) {
      const dial = this._dial3D || panel;
      if (!dial || typeof dial.addEventListener !== 'function') return;
      const self = this;

      const alMover = function (evento) {
        if (!self._girando3D) return;
        const angulo = self._anguloSobreDial(evento, dial);
        if (angulo === null) return;
        const delta = self._normalizar(angulo - self._anguloGiro3D);
        self._anguloGiro3D = angulo;
        if (!delta) return;
        self._girarCamara3D(delta);
        self._moverBolita3D(angulo);
      };

      const alSoltar = function () {
        self._girando3D = false;
        self._anguloGiro3D = null;
        if (self._panel && self._panel.classList) {
          self._panel.classList.remove('g-controlRotate-girando');
        }
        document.removeEventListener('pointermove', alMover, false);
        document.removeEventListener('pointerup', alSoltar, false);
        document.removeEventListener('pointercancel', alSoltar, false);
      };

      const alPulsar = function (evento) {
        if (!self._es3D(self._map)) return;
        if (evento.button !== undefined && evento.button !== 0) return;
        if (!self._marcoGiro3D()) return;
        const angulo = self._anguloSobreDial(evento, dial);
        if (angulo === null) return;
        if (typeof evento.preventDefault === 'function') evento.preventDefault();
        self._girando3D = true;
        self._anguloGiro3D = angulo;
        if (self._panel && self._panel.classList) {
          self._panel.classList.add('g-controlRotate-girando');
        }
        // Con captura, el gesto sigue aunque el puntero se salga del botón.
        if (evento.pointerId !== undefined && typeof dial.setPointerCapture === 'function') {
          try { dial.setPointerCapture(evento.pointerId); } catch (e) { /* sin captura */ }
        }
        document.addEventListener('pointermove', alMover, false);
        document.addEventListener('pointerup', alSoltar, false);
        document.addEventListener('pointercancel', alSoltar, false);
      };

      dial.addEventListener('pointerdown', alPulsar, false);
      this._gesto3D = { dial: dial, alPulsar: alPulsar, alSoltar: alSoltar };

      // El doble clic, igual que en 2D: al norte arriba. Va aquí porque
      // `_adaptarPanel` sale antes de registrarlo cuando el mapa es de 3D
      // (medido: en 3D no había ningún manejador de doble clic en el dial).
      dial.addEventListener('dblclick', function (evento) {
        if (typeof evento.preventDefault === 'function') evento.preventDefault();
        self._irAlNorte3D();
      });
    }

    /**
     * Ángulo del puntero alrededor del centro del dial, medido como lo mide la
     * API: con la Y del ratón cambiada de signo, para que crezca en sentido
     * antihorario en pantalla.
     * @param {Event} evento Evento del puntero.
     * @param {HTMLElement} dial Dial de 3D.
     * @returns {number|null} Ángulo en radianes, o null si no se puede calcular.
     */
    _anguloSobreDial(evento, dial) {
      if (!dial || typeof dial.getBoundingClientRect !== 'function') return null;
      const caja = dial.getBoundingClientRect();
      if (!caja.width || !caja.height) return null;
      const x = (evento.clientX !== undefined) ? evento.clientX : 0;
      const y = (evento.clientY !== undefined) ? evento.clientY : 0;
      return Math.atan2(-(y - caja.top - caja.height / 2), x - caja.left - caja.width / 2);
    }

    /**
     * Monta el marco ENU alrededor del que se gira la cámara, que es lo que hace
     * posible girar una cámara que va con `lookAt`.
     * @returns {Object|null} Matriz del marco, o null si no se puede.
     */
    _marcoGiro3D() {
      if (typeof Cesium === 'undefined' || !Cesium.Transforms) return null;
      const camara = this._camaraCesium();
      const escena = this._escenaCesium();
      if (!camara || !escena) return null;
      let pivote = null;
      try {
        const rayo = new Cesium.Ray(camara.positionWC, camara.directionWC);
        pivote = escena.globe.pick(rayo, escena);
      } catch (e) {
        pivote = null;
      }
      const utilizable = pivote && isFinite(pivote.x) && isFinite(pivote.y) && isFinite(pivote.z);
      const centro = utilizable ? pivote : camara.positionWC;
      try {
        this._marco = Cesium.Transforms.eastNorthUpToFixedFrame(centro, escena.globe.ellipsoid);
      } catch (e) {
        this._marco = null;
      }
      return this._marco;
    }

    /**
     * Gira la vista de Cesium un ángulo, alrededor del punto al que mira la
     * cámara.
     *
     * EL SIGNO VA NEGADO, y no es casualidad (medido): `rotateRight` con ángulo
     * positivo BAJA el rumbo ese mismo ángulo (+0,5 rad lleva el rumbo de 360 a
     * 331,4), pero en una cámara que mira hacia abajo subir el rumbo hace que el
     `terreno` gire en sentido ANTIHORARIO en pantalla. Como el dial de 2D gira
     * el mapa en el mismo sentido en que se mueve la bolita, aquí se aplica el
     * ángulo del puntero cambiado de signo: bolita en sentido horario, mapa en
     * sentido horario, igual que en 2D.
     * @param {number} delta Ángulo en radianes, en el sentido del puntero.
     */
    _girarCamara3D(delta) {
      if (typeof Cesium === 'undefined') return;
      const camara = this._camaraCesium();
      if (!camara || !this._marco) return;
      if (!this._marcoGuardado) this._marcoGuardado = new Cesium.Matrix4();
      try {
        Cesium.Matrix4.clone(camara.transform, this._marcoGuardado);
        camara.lookAtTransform(this._marco);
        camara.rotateRight(-delta);
        camara.lookAtTransform(this._marcoGuardado);
      } catch (e) {
        /* la cámara puede estar en medio de un vuelo */
      }
    }
    /**
     * Engancha el gesto del átomo, que es solo de 3D: arrastrarlo por dentro del
     * botón mueve la vista, y es el mismo gesto que Ctrl + arrastre en Cesium.
     *
     * CÓMO: con la misma receta del giro de la bolita, dentro del marco ENU.
     * Hacia arriba y abajo se inclina (`rotateUp`, sin tope: que llegue al cénit
     * es cosa de Cesium, que ya clava el pitch en ±90) y hacia los lados se gira
     * (`rotateRight`, en el mismo sentido que la bolita).
     *
     * NO SE COPIA EL GESTO DE CESIUM ENTERO porque sus eventos no se pueden
     * reenviar al canvas: medido, un `PointerEvent` con `ctrlKey` y el
     * `pointerId` del puntero real no mueve la cámara, porque el manejador aborta
     * antes (su lista de gestos de inclinación sí es la de Ctrl + arrastre
     * izquierdo: `[2, 4, {eventType: 0, modifier: 1}, {eventType: 1,
     * modifier: 1}]`).
     *
     * @param {HTMLElement} panel Panel del dial de 3D.
     */
    _arrastrarAtomo3D(panel) {
      const atom = (this._atom3D || (panel.querySelector ? panel.querySelector('.g-controlRotate-atom') : null));
      if (!atom || typeof atom.addEventListener !== 'function') return;
      const self = this;

      const alMover = function (evento) {
        if (!self._inclinando3D) return;
        self._moverAtomo3D(evento, atom);
      };

      const alSoltar = function () {
        self._inclinando3D = false;
        if (self._panel && self._panel.classList) {
          self._panel.classList.remove('g-controlRotate-inclinando');
        }
        document.removeEventListener('pointermove', alMover, false);
        document.removeEventListener('pointerup', alSoltar, false);
        document.removeEventListener('pointercancel', alSoltar, false);
        // El átomo vuelve al centro, pero la vista se queda donde la dejó el
        // gesto: el retorno mueve el átomo y nada más.
        self._devolverAtomo3D();
      };

      const alPulsar = function (evento) {
        if (!self._es3D(self._map)) return;
        if (evento.button !== undefined && evento.button !== 0) return;
        if (!self._marcoGiro3D()) return;
        // Que no empiece además el giro de la bolita: son dos gestos distintos
        // sobre el mismo botón.
        if (typeof evento.stopPropagation === 'function') evento.stopPropagation();
        if (typeof evento.preventDefault === 'function') evento.preventDefault();
        self._inclinando3D = true;
        self._atomX0 = self._atomDX || 0;
        self._atomY0 = self._atomDY || 0;
        if (self._panel && self._panel.classList) {
          self._panel.classList.add('g-controlRotate-inclinando');
        }
        if (evento.pointerId !== undefined && typeof atom.setPointerCapture === 'function') {
          try { atom.setPointerCapture(evento.pointerId); } catch (e) { /* sin captura */ }
        }
        document.addEventListener('pointermove', alMover, false);
        document.addEventListener('pointerup', alSoltar, false);
        document.addEventListener('pointercancel', alSoltar, false);
      };

      atom.addEventListener('pointerdown', alPulsar, false);
      this._gestoAtomo = { atom: atom, alPulsar: alPulsar, alSoltar: alSoltar };
    }

    /**
     * Lleva el átomo donde está el puntero, sin salirse del botón, e inclina y
     * gira la vista con lo que se ha movido desde el gesto anterior.
     * @param {Event} evento Evento del puntero.
     * @param {HTMLElement} atom Elemento del átomo.
     */
    _moverAtomo3D(evento, atom) {
      const dial = this._dial3D;
      if (!dial || typeof dial.getBoundingClientRect !== 'function') return;
      const caja = dial.getBoundingClientRect();
      if (!caja.width || !caja.height) return;
      const cx = caja.left + caja.width / 2;
      const cy = caja.top + caja.height / 2;
      // Que el átomo no se salga del botón: su centro puede llegar hasta el borde
      // del disco, o sea media caja menos la mitad del átomo.
      const maximo = caja.width / 2 - atom.offsetWidth / 2;
      let dx = (evento.clientX !== undefined ? evento.clientX : cx) - cx;
      let dy = (evento.clientY !== undefined ? evento.clientY : cy) - cy;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      if (distancia > maximo && distancia > 0) {
        dx = dx / distancia * maximo;
        dy = dy / distancia * maximo;
      }
      this._situarAtomo3D(dx, dy, true);
    }

    /**
     * Devuelve el átomo al centro después de soltarlo. Va paso a paso para que se
     * lea como que la palanca vuelve sola, y SIN tocar la cámara: la vista se
     * queda inclinada o girada, que es lo pedido.
     */
    _devolverAtomo3D() {
      if (!this._atom3D) return;
      if (this._frameAtomo && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(this._frameAtomo);
        this._frameAtomo = null;
      }
      if (!this._atomDX && !this._atomDY) return;
      const self = this;
      const paso = function () {
        self._frameAtomo = null;
        if (!self._atom3D) return;
        // Un cuarto de lo que le queda: llega al centro en unos diez frames.
        let dx = (self._atomDX || 0) * 0.75;
        let dy = (self._atomDY || 0) * 0.75;
        if (Math.abs(dx) < 0.2) dx = 0;
        if (Math.abs(dy) < 0.2) dy = 0;
        self._situarAtomo3D(dx, dy, false);
        if (dx || dy) {
          self._frameAtomo = window.requestAnimationFrame
            ? window.requestAnimationFrame(paso)
            : window.setTimeout(paso, 16);
        }
      };
      this._frameAtomo = window.requestAnimationFrame
        ? window.requestAnimationFrame(paso)
        : window.setTimeout(paso, 16);
    }

    /**
     * Coloca el átomo en un punto del dial y, si toca, mueve la vista.
     * @param {number} dx Desplazamiento horizontal, en píxeles.
     * @param {number} dy Desplazamiento vertical, en píxeles.
     * @param {boolean} [moverVista=false] Si hay que mover también la cámara.
     */
    _situarAtomo3D(dx, dy, moverVista) {
      const atom = this._atom3D;
      if (!atom || !atom.style) return;
      const antesX = this._atomDX || 0;
      const antesY = this._atomDY || 0;
      this._atomDX = dx;
      this._atomDY = dy;
      atom.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
      if (!moverVista) return;
      const dial = this._dial3D;
      if (!dial || typeof dial.getBoundingClientRect !== 'function') return;
      const ancho = dial.getBoundingClientRect().width;
      if (!ancho) return;
      // Un píxel del recorrido útil = un grado. El recorrido son 13,5 px en un
      // disco de 40 (medido), o sea 45 grados de inclinación y otros 45 de giro
      // si se lleva el átomo de lado a lado.
      const maximo = ancho / 2 - atom.offsetWidth / 2;
      const porPixel = (45 * Math.PI / 180) / Math.max(1, maximo);
      // Arriba (dy negativo) la vista se levanta, y a los lados se gira en el
      // mismo sentido que la bolita. Sin topes: al cénit y al nadir llega Cesium.
      const inclinacion = -(dy - antesY) * porPixel;
      const giro = -(dx - antesX) * porPixel;
      if (inclinacion) this._girarCamara3DInclinacion(inclinacion);
      if (giro) this._girarCamara3D(giro);
    }

    /**
     * Inclina la vista de Cesium, con la misma receta del giro: dentro del marco
     * ENU, `rotateUp`.
     * @param {number} delta Ángulo en radianes.
     */
    _girarCamara3DInclinacion(delta) {
      if (typeof Cesium === 'undefined') return;
      const camara = this._camaraCesium();
      if (!camara || !this._marco) return;
      if (!this._marcoGuardado) this._marcoGuardado = new Cesium.Matrix4();
      try {
        Cesium.Matrix4.clone(camara.transform, this._marcoGuardado);
        camara.lookAtTransform(this._marco);
        camara.rotateUp(delta);
        camara.lookAtTransform(this._marcoGuardado);
      } catch (e) {
        /* la cámara puede estar en medio de un vuelo */
      }
    }
    /**
     * Recoloca la bolita de giro según el rumbo de la cámara, para que no se
     * descompase cuando la vista gira por otra vía (el gesto propio de Cesium, un
     * vuelo del storymap, un `setView`).
     *
     * Mismo signo que el del gesto, porque es el mismo sitio: arrastrar la bolita
     * en sentido horario baja el rumbo, y el `transform` que se le pone crece.
     * Mientras se arrastra ella no se toca, que si no las dos cosas se pelean.
     */
    _sincronizarBolita3D() {
      if (!this._bola3D || !this._bola3D.style) return;
      if (this._girando3D) return;
      const camara = this._camaraCesium();
      if (!camara) return;
      // El -0,5 es el mismo medio píxel que deja la bolita centrada en 2D.
      // El -0,5 es el mismo medio píxel que deja la bolita centrada en 2D, y el
      // ángulo se normaliza a [-180, 180] para que con el rumbo en 360 salga
      // -0,5 y no -360,5 (medido: los dos son el mismo sitio, pero el segundo
      // parece un error).
      const grados = this._normalizar(-camara.heading) * 180 / Math.PI - 0.5;
      const texto = 'rotate(' + grados.toFixed(1) + 'deg)';
      if (this._bola3DGrados !== grados) {
        this._bola3DGrados = grados;
        this._bola3D.style.transform = texto;
      }
    }

    /**
     * Lleva la bolita al punto del dial donde está el puntero. El dial está en
     * el norte, que es arriba, así que el ángulo de la bolita es el del puntero
     * menos los 90 grados del norte.
     * @param {number} angulo Ángulo del puntero, en radianes.
     */
    _moverBolita3D(angulo) {
      const bola = this._bola3D;
      if (!bola || !bola.style) return;
      const grados = 90 - angulo * 180 / Math.PI;
      bola.style.transform = 'rotate(' + grados.toFixed(1) + 'deg)';
    }
    /**
     * Vuelve al norte en 3D, que es lo que hace el doble clic sobre el dial en
     * 2D pero con la cámara: el norte arriba es rumbo 0.
     *
     * Se gira dentro del mismo marco ENU del gesto, y con el ángulo normalizado
     * al intervalo [-π, π] para que el giro sea el corto y no el largo: con un
     * rumbo de 270° el norte se alcanza en 90°, no en 270° (medido).
     * @returns {boolean} true si se ha podido girar la cámara.
     */
    _irAlNorte3D() {
      if (typeof Cesium === 'undefined') return false;
      const camara = this._camaraCesium();
      if (!camara || !this._marcoGiro3D()) return false;
      if (!this._marcoGuardado) this._marcoGuardado = new Cesium.Matrix4();
      try {
        Cesium.Matrix4.clone(camara.transform, this._marcoGuardado);
        camara.lookAtTransform(this._marco);
        // `rotateRight` con ángulo positivo baja el rumbo ese mismo ángulo
        // (medido), así que el ángulo que lleva el rumbo a 0 es el propio rumbo.
        camara.rotateRight(this._normalizar(camara.heading));
        camara.lookAtTransform(this._marcoGuardado);
      } catch (e) {
        return false;
      }
      // Y la bolita, arriba, que es donde está con el norte arriba.
      this._moverBolita3D(Math.PI / 2);
      this._pintarRosa();
      return true;
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
      // Va aqui y no mas abajo porque los manejadores de la rosa y de la flecha,
      // que estan antes, lo usan: en el navegador `self` es `window`, y sin esta
      // linea `self._aplicarRotacion` daba "no es una funcion" (medido).
      const self = this;
      panel.classList.add('g-controlRotate');
      if (this._lado && this._lado !== 43.2) {
        panel.classList.add('g-controlRotate--tam');
        panel.style.setProperty('--g-controlRotate-lado', this._lado + 'px');
      }
      if (!this._conNorte) panel.classList.add('g-controlRotate--sinNorte');
      // Y los colores configurados, como variables CSS sobre el panel.
      this._aplicarColores();

      // En 3D se pinta el MISMO dial que en 2D, copiado aquí dentro del panel, y
      // se oculta el de la API. Motivo, todo medido: la variante de Cesium del
      // control construye otra cosa, la brujula grande de 150x150, y su contenedor
      // (`.m-control.m-rotate-container`, 150x190) la API lo coloca en (-100, -140)
      // de la pantalla, o sea 110 px a la izquierda y 150 px arriba de este panel
      // (medido con getBoundingClientRect). Por eso el botón salía vacío. Ni con
      // `top`/`left`/`margin` ni con `transform: scale()` se mueve, así que en vez
      // de pelear con su colocación se copia la nuestra, que es la que sabemos
      // dónde cae.
      if (this._es3D(this._map)) {
        this._pintarDial3D(panel);
        return;
      }
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
        rosa.className = 'm-rotate-rosa g-controlRotate-rosa';
        rosa.setAttribute('aria-hidden', 'true');
        // El dibujo es el SVG_ROSA de arriba (svgrepo), en línea y con
        // currentColor: así el color lo pone el CSS desde
        // --g-plugin-icon-color y la rosa puede girar sin que la fuente de la
        // API tenga ese glifo.
        rosa.innerHTML = SVG_ROSA;
        sitio.appendChild(rosa);

        // El icono de hover va al lado, no encima: los dos están siempre en
        // el DOM y el CSS los cambia de opacidad al pasar el ratón. Así el mismo
        // marcado sirve en línea (aquí) y como máscara en `mask-image`, y en
        // línea un elemento que aparece y desaparece al vuelo no se puede leer.
        this._rosa = rosa;
        // Púlsala para volver al norte, que es lo que se espera de una brújula.
        this._on(rosa, 'click', function (evento) {
          evento.stopPropagation();
          self._aplicarRotacion(0);
        });
      }
      this._pintarRosa();


      if (dial) {
        this._on(dial, 'dblclick', function (evento) {
          evento.preventDefault();
          // En 3D el norte arriba es el rumbo de la cámara a 0; en 2D la
          // rotación de la vista a 0. Se prueba primero la cámara, que en 2D
          // devuelve false y no hace nada.
          if (self._irAlNorte3D()) return;
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
      this._sincronizarMarcador(this._rotacion);
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
        this._sincronizarMarcador(this._rotacion);
      }
    }


    /**
     * Gira la rosa de los vientos del disco para que apunte al norte.
     *
     * El signo es el MISMO que el de la vista, y conviene no tocarlo: la vista
     * girada +45 grados lleva el norte arriba a la derecha (el mapa gira en
     * sentido horario), así que la rosa tiene que girar +45 también. Con el signo
     * contrario apuntaba al sur, que es lo que Pasó aquí antes (medido).
     */
    _pintarRosa() {
      if (!this._rosa) return;
      // En 3D lo que gira es la cámara, y su rumbo es su `heading`. La rosa se
      // gira lo contrario, igual que hace la API con su brújula grande
      // (`rotate(${-heading}rad)`, medido en su bundle).
      const es3D = !!(this._map && typeof this._es3D === 'function' && this._es3D(this._map));
      if (es3D) {
        const camara = this._camaraCesium();
        if (!camara) return;
        this._rosa.style.transform = 'rotate(' + (-camara.heading).toFixed(6) + 'rad)';
        return;
      }
      const grados = (this._rotacion * 180 / Math.PI);
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

      // En 3D se monta TAMBIEN el control nativo, y es lo correcto por dos motivos.
      //
      // Uno: la variante que construye Cesium no maneja la vista de OpenLayers sino
      // la camara, y su brujula si funciona: anillo exterior arrastrable para girar
      // 360 grados, giroscopio interior para inclinar, doble clic para la vista
      // inicial y Ctrl+arrastrar sobre el mapa.
      //
      // Dos: la camara de la API se construye con lookAt y lleva su
      // lookAtTransform, asi que controlarla a mano es pelearse con su marco de
      // referencia. Medido: rotateUp y rotateLeft no hacen nada, lookAt tampoco la
      // mueve, y un setView con orientation mueve el rumbo pero aplica la
      // inclinacion en el marco equivocado (pedir -89 grados devuelve -20). Quien
      // sabe hacerlo bien es la propia API.
      //
      // Hubo aqui un panel propio (bola + giroscopio, del tamano de un boton) que
      // sufria justo de lo segundo. Se retira: el camino es el mismo en 2D y en 3D,
      // y el estilo se itera encima, igual que en 2D.
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
      this._marcadorGrados = undefined;
      this._marcadorRotacion = 0;
      this._frameBolita = null;
      if (this._gesto3D) {
        if (typeof this._gesto3D.alSoltar === 'function') this._gesto3D.alSoltar();
        if (this._gesto3D.dial && typeof this._gesto3D.dial.removeEventListener === 'function') {
          this._gesto3D.dial.removeEventListener('pointerdown', this._gesto3D.alPulsar, false);
        }
        this._gesto3D = null;
      if (this._gestoAtomo) {
        if (typeof this._gestoAtomo.alSoltar === 'function') this._gestoAtomo.alSoltar();
        if (this._gestoAtomo.atom && typeof this._gestoAtomo.atom.removeEventListener === 'function') {
          this._gestoAtomo.atom.removeEventListener('pointerdown', this._gestoAtomo.alPulsar, false);
        }
        this._gestoAtomo = null;
      }
      this._inclinando3D = false;
      this._atomDX = 0;
      this._atomDY = 0;
      this._atom3D = null;
      }
      const camara = this._camaraCesium();
      const escena = this._escenaCesium();
      if (this._alCambiarCamara && escena && escena.postRender) {
        escena.postRender.removeEventListener(this._alCambiarCamara);
      }
      this._alCambiarCamara = null;
      this._girando3D = false;
      this._anguloGiro3D = null;
      this._marco = null;
      this._marcoGuardado = null;
      this._bola3D = null;
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