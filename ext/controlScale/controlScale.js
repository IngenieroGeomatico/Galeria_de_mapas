/* =====================================================================
   PLUGIN ESCALA Y NIVEL DE VISTA PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   MOTIVACIÓN:
   El control 'scale*true' del constructor IDEE.map({controls}) pintaba en la
   esquina inferior derecha un cuadro con el nivel de zoom y la escala
   ("Nivel de zoom 13.49 | Escala = 1 : 35.000"), que es el control 'Scale' de
   la propia API. Pero:

     - Cesium (3D) no sabe construirlo: lanza "La implementación usada no
       puede crear controles Scale" y aborta la creación del mapa;
     - y su panel cuelga del area de esquina, que es una columna estrecha de
       botones, mientras que esta lectura es un div ancho (272 px) que se
       cruza con el resto de herramientas.

   Este plugin sustituye a ese control con una lectura propia, colgada en la
   banda reservada de controles (ext/areaControls), que es un div a todo el
   ancho donde este tipo de lecturas sí encaja.

   CONTENIDO:
     - 2D (OpenLayers): nivel de zoom del mapa y su escala 1:nnnnnn. La escala
       se toma de la API (map.getExactScale(), con map.getScale() como
       reserva) y se corrige por la latitud del punto mirado: el valor de la
       API mide metros de plano y no cambia al desplazarse, cuando la escala de
       un mapa es sobre el suelo (ver _corregirPorLatitud).
     - 3D (Cesium): no hay nivel de zoom, así que en su lugar se muestra la
       altura de la cámara sobre el elipsoide, y la escala se calcula a partir
       del campo de visión y del tamaño del lienzo. La escala de un mapa en
       perspectiva no es constante (depende de la distancia a la que esté el
       punto mirado), de modo que el valor es el del centro de la vista. Esta
       vía no necesita corrección por latitud: ya sale de la geometría de la
       cámara.

   ESPACIOS:
     Los huecos entre etiqueta, valor y separador los pone el CSS (`gap` en
     .g-controlScale-dato y margen en .g-controlScale-separador), nunca el
     texto. Un espacio final dentro de un hijo flex se colapsa (CSS Text 3,
     4.1.1) y no se dibuja, así que "Nivel de zoom " se vería pegado al
     número.

   CONVENCIONES:
   1. Resolvedor dual de la API (window.IDEE || window.M) mediante api(),
      eligiendo el global que tenga la API REALMENTE cargada (.ui y .map).
   2. Detección de implementación: se prefiere map.getImplementation()
      ('ol' / 'cesium'), que es la que usa la propia API para distinguir sus
      dos implementaciones, y se cae al patrón canónico del repo
      (map.getMapImpl() con scene.camera) si ese método no existe.
   3. Constructor sin argumentos obligatorio:
      new IDEE.plugin.miPlugin_controlScale()
   4. Contrato de estado getState()/setState() para el swap 2D/3D.
   5. Exposición triple (window / IDEE.plugin / M.plugin) para sobrevivir
      a la recarga del bundle de la API.
   ===================================================================== */

(function () {
  'use strict';

  /** Píxeles por pulgada con los que trabaja la API (96 dpi). */
  const PPI = 96;
  /** Metros que mide un píxel a 96 dpi: 0,0254 / 96. */
  const M_POR_PX = 0.0254 / PPI;
  /** Semieje mayor de la esfera de Mercator (EPSG:3857). */
  const SEMI_MAYOR_3857 = 20037508.342789244;
  /** Límite de latitud de la proyección de Mercator. */
  const LAT_MAX_MERCATOR = 85;
  /** Campo de visión por defecto de la cámara de Cesium (rad). */
  const FOV_POR_DEFECTO = Math.PI / 3;
  /** Tope de espera (ms) para que aparezca la escena de Cesium. */
  const ESPERA_ESCENA = 12000;

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
   * Escala y nivel de vista del mapa, en la banda de controles.
   */
  class miPlugin_controlScale {
    /**
     * Constructor del plugin. Funciona sin argumentos.
     * @param {Object} [options={}] Opciones de configuración (todas opcionales).
     * @param {boolean} [options.visible=true] Estado inicial de visibilidad.
     * @param {string} [options.openPosition='bottom'] Banda donde se abre
     * ('bottom' o 'top').
     * @param {number} [options.order=0] Orden dentro de la banda. La banda es
     * un flex row, así que este `order` ordena de izquierda a derecha.
     * @param {boolean} [options.useArea=true] Colgar la lectura en la banda
     * reservada de controles (miPlugin_areaControls). Si la banda no está
     * cargada, la lectura se ancla abajo a la izquierda del mapa.
     */
    constructor(options = {}) {
      // Identificador obligatorio del plugin (gestor de plugins y cambioImpl).
      this.name = 'miPlugin_controlScale';
      this.options = options || {};

      // Referencia al mapa y a los elementos de interfaz.
      this._map = null;
      this._host = null;
      this._container = null;
      this._elEtiqueta = null;
      this._elValor = null;
      this._elUnidad = null;
      this._area = null;

      // Listeners registrados (DOM, API y Cesium) para poder soltarlos.
      this._listeners = [];
      this._listenersApi = [];
      this._listenersCesium = [];
      this._esperaEscena = null;

      // Configuración.
      this._visible = (options.visible !== undefined) ? Boolean(options.visible) : true;
      this._useArea = (options.useArea !== undefined) ? Boolean(options.useArea) : true;
      this._openPosition = (options.openPosition === 'top') ? 'top' : 'bottom';
      this.order = (options.order !== undefined && !Number.isNaN(Number(options.order)))
        ? Number(options.order) : 0;
    }

    /**
     * Proporciona la información de ayuda al gestor de ayuda de la API-IDEE.
     * @returns {{title: string, content: Promise<HTMLElement|string>}} Ayuda del plugin.
     */
    getHelp() {
      const IDEE = api();
      return {
        title: 'Escala y nivel de vista',
        content: new Promise((resolve) => {
          let html = '<div><p>Escala del mapa (1 : n) y nivel de zoom, o altura ' +
            'de la cámara en la visualización 3D.</p>' +
            '<p>El valor se actualiza automáticamente al desplazarse o cambiar ' +
            'de zoom el mapa. En 3D la escala es la del punto mirado: al haber ' +
            'perspectiva, no es una constante en toda la vista.</p></div>';
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
      let impl = '';
      try {
        if (mapRef && typeof mapRef.getImplementation === 'function') {
          impl = String(mapRef.getImplementation() || '').toLowerCase();
        }
      } catch (e) {
        impl = '';
      }
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
     * Intenta colgar la lectura en la banda reservada de controles.
     * @param {HTMLElement} elemento Elemento ya construido del plugin.
     * @returns {boolean} true si se ha colgado en la banda, false si no.
     */
    _montarEnArea(elemento) {
      if (!this._useArea) return false;
      // La banda es una extensión aparte: si no está cargada, la lectura
      // sigue funcionando con su anclaje a esquina, así que no es un error.
      const Clase = (typeof window !== 'undefined') ? window.miPlugin_areaControls : null;
      if (typeof Clase !== 'function') return false;
      try {
        if (!this._area) {
          this._area = new Clase({ openPosition: this._openPosition });
          this._area.addTo(this._map);
        }
        return this._area.monta(elemento, { order: this.order }) !== null;
      } catch (e) {
        console.warn(`${this.name}: no se pudo colgar en la banda de controles.`, e);
        return false;
      }
    }

    /**
     * Formatea un número con el separador de miles español ("38.439"), que es
     * el que usan los controles de la API. El nivel de zoom no se formatea
     * aquí: lleva punto decimal en vez de coma, como hacía el control
     * 'scale*true' que este plugin sustituye.
     * @param {number} valor Valor a formatear.
     * @returns {string} Texto formateado, o '-' si el valor no es válido.
     */
    _formatear(valor) {
      const n = Number(valor);
      if (!isFinite(n)) return '-';
      try {
        return n.toLocaleString('es-ES', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      } catch (e) {
        return String(Math.round(n));
      }
    }

    // =====================================================================
    // CONSTRUCCIÓN Y ACTUALIZACIÓN DE LA INTERFAZ
    // =====================================================================

    /**
     * Crea el DOM de la lectura: una caja con el dato principal, un separador
     * y la escala. Se parezca lo que se parezca al control 'scale*true' de la
     * API, porque es su sustituto visual.
     * @returns {HTMLElement} Contenedor creado.
     */
    _construirUI() {
      const cont = document.createElement('div');
      cont.className = 'g-controlScale';
      // Es una lectura: nunca debe robar el clic ni el arrastre al mapa.
      cont.setAttribute('role', 'status');
      cont.setAttribute('aria-live', 'polite');
      cont.setAttribute('aria-label', 'Escala y nivel de vista');
      cont.title = 'Escala y nivel de vista del mapa';

      const caja = document.createElement('div');
      caja.className = 'g-controlScale-caja';

      // Dato principal: nivel de zoom en 2D, altura de la cámara en 3D.
      // Los textos van SIN espacios de relleno: los aporta el `gap` de
      // .g-controlScale-dato y el margen del separador, porque un espacio
      // final dentro de un hijo flex se colapsa y no se vería.
      const principal = document.createElement('span');
      principal.className = 'g-controlScale-dato';
      const etiqueta = document.createElement('span');
      etiqueta.className = 'g-controlScale-etiqueta';
      etiqueta.textContent = 'Nivel de zoom';
      const valor = document.createElement('span');
      valor.className = 'g-controlScale-valor';
      valor.textContent = '-';
      principal.appendChild(etiqueta);
      principal.appendChild(valor);

      const separador = document.createElement('span');
      separador.className = 'g-controlScale-separador';
      separador.textContent = '|';

      // Escala 1 : n, común a las dos implementaciones.
      const escala = document.createElement('span');
      escala.className = 'g-controlScale-dato';
      const unidad = document.createElement('span');
      unidad.className = 'g-controlScale-etiqueta';
      unidad.textContent = 'Escala = 1 :';
      const valorEscala = document.createElement('span');
      valorEscala.className = 'g-controlScale-valor';
      valorEscala.textContent = '-';
      escala.appendChild(unidad);
      escala.appendChild(valorEscala);

      caja.appendChild(principal);
      caja.appendChild(separador);
      caja.appendChild(escala);
      cont.appendChild(caja);

      this._container = cont;
      this._elEtiqueta = etiqueta;
      this._elValor = valor;
      this._elUnidad = valorEscala;
      return cont;
    }

    /**
     * Escribe un valor en un nodo sin repetir el texto (evita reflows).
     * @param {HTMLElement} nodo Nodo destino.
     * @param {string} texto Texto a escribir.
     */
    _pintar(nodo, texto) {
      if (!nodo || nodo.textContent === texto) return;
      nodo.textContent = texto;
    }

    /**
     * Proyección en la que está el mapa.
     * @returns {string} Código de la proyección ('EPSG:3857', 'EPSG:4326'...).
     */
    _proyeccion() {
      try {
        const impl = this._impl();
        const vista = impl && typeof impl.getView === 'function' ? impl.getView() : null;
        if (vista && typeof vista.getProjection === 'function') {
          const proyeccion = vista.getProjection();
          if (proyeccion && typeof proyeccion.getCode === 'function') {
            return String(proyeccion.getCode());
          }
        }
      } catch (e) {
        /* se usa la de por defecto */
      }
      return 'EPSG:3857';
    }

    /**
     * Latitud del punto que se está mirando, en grados.
     *
     * Es el dato que hace falta para corregir la escala: la proyección de
     * Mercator estira el mapa hacia los polos, de modo que un metro del plano
     * son menos metros de suelo cuanto más al norte.
     * @returns {number|null} Latitud en grados, o null si no se puede saber.
     */
    _latitudCentro() {
      try {
        const mapa = this._map;
        if (!mapa || typeof mapa.getCenter !== 'function') return null;
        const centro = mapa.getCenter();
        if (!centro || !isFinite(centro.x) || !isFinite(centro.y)) return null;

        let latitud;
        if (this._proyeccion() === 'EPSG:4326') {
          latitud = centro.y;
        } else {
          // Inversa de Web Mercator: y = R * ln(tan(pi/4 + lat*pi/360)).
          latitud = (2 * Math.atan(Math.exp(centro.y / SEMI_MAYOR_3857)) - Math.PI / 2) * 180 / Math.PI;
        }
        if (!isFinite(latitud)) return null;
        // Mercator no llega a los polos y ahí el factor se dispara.
        return Math.max(-LAT_MAX_MERCATOR, Math.min(LAT_MAX_MERCATOR, latitud));
      } catch (e) {
        return null;
      }
    }

    /**
     * Corrige la escala nominal por la latitud del punto mirado.
     *
     * La API publica una escala nominal (map.getExactScale(), con map.getScale()
     * como reserva) que mide metros de PLANO por píxel, y por eso sale el mismo
     * número con el mapa en el ecuador y a 60 grados. La escala de un mapa es
     * sobre el suelo, y en Mercator el suelo se encoge con el factor
     * 1 / cos(latitud), así que la nominal hay que dividirla por ese coseno.
     * Es lo mismo que hace el control Scale de OpenLayers al apoyarse en
     * getPointResolution, que en la versión de la API no está disponible.
     *
     * En 3D no hace falta: la escala se calcula con la geometría de la cámara,
     * que ya es una distancia real sobre el terreno.
     * @param {number} escala Escala nominal 1:n.
     * @returns {number} Escala 1:n corregida por la latitud.
     */
    _corregirPorLatitud(escala) {
      const latitud = this._latitudCentro();
      if (latitud === null) return escala;
      const coseno = Math.cos(latitud * Math.PI / 180);
      // El tope de latitud ya acota el factor a ~11,5; esto es solo el cinturón.
      if (!isFinite(coseno) || coseno <= 0.05) return escala;
      const corregida = escala / coseno;
      return (isFinite(corregida) && corregida > 0) ? corregida : escala;
    }

    /**
     * Refresca la lectura cuando cambia la vista de OpenLayers.
     *
     * Los eventos de la API (evt.MOVE) solo avisan de los gestos del usuario:
     * con map.setCenter() o map.setZoom() la lectura se queda obsoleta, y eso
     * se nota al volver de 3D, porque el cambio de implementación recentra el
     * mapa por código. La vista de OL sí notifica cualquier cambio de su
     * estado, venga de donde venga, así que se escucha directamente a ella.
     * En 3D no hay vista que escuchar (eso lo cubre la cámara).
     */
    _vigilarVistaOL() {
      try {
        const impl = this._impl();
        const vista = impl && typeof impl.getView === 'function' ? impl.getView() : null;
        if (!vista || typeof vista.addEventListener !== 'function') return;
        const self = this;
        const alCambiar = function () { self._actualizar(); };
        ['change:center', 'change:resolution', 'change:rotation'].forEach(function (tipo) {
          self._on(vista, tipo, alCambiar);
        });
      } catch (e) {
        /* los eventos de la API siguen vigilando; ver _onApi en addTo() */
      }
    }

    /**
     * Escala 1:n del punto mirado en 2D.
     *
     * Se toma el valor nominal que publica la API y se corrige por la latitud,
     * para que la lectura cambie al desplazarse por el mapa (en Mercator, un
     * metro del plano son menos metros de suelo cuanto más nos alejamos del
     * ecuador). La razón está explicada en _corregirPorLatitud().
     * @returns {number|null} Denominador de la escala, o null si no hay dato.
     */
    _escala2D() {
      const map = this._map;
      if (!map) return null;
      let nominal = null;
      try {
        if (typeof map.getExactScale === 'function') {
          const exacto = Number(map.getExactScale());
          if (isFinite(exacto) && exacto > 0) nominal = exacto;
        }
      } catch (e) {
        /* se prueba el otro */
      }
      if (nominal === null) {
        try {
          if (typeof map.getScale === 'function') {
            const escala = Number(map.getScale());
            if (isFinite(escala) && escala > 0) nominal = escala;
          }
        } catch (e) {
          /* sin dato */
        }
      }
      if (nominal === null) return null;
      return this._corregirPorLatitud(nominal);
    }

    /**
     * Altura de la cámara de Cesium sobre el elipsoide, en metros.
     * @returns {number|null} Altura en metros, o null si no hay cámara.
     */
    _altura3D() {
      try {
        const camara = this._camaraCesium();
        if (!camara) return null;
        const altura = camara.positionCartographic.height;
        return isFinite(altura) ? altura : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Escala 1:n del punto mirado en 3D.
     *
     * Con la cámara de Cesium, los metros por píxel del centro de la vista
     * son 2 * altura * tan(fov/2) / alto_del_lienzo, y la escala es esa
     * resolución dividida por el tamaño del píxel. No se usa la proyección
     * del elipsoide porque la vista puede estar inclinada.
     * @returns {number|null} Denominador de la escala, o null si no hay dato.
     */
    _escala3D() {
      try {
        const escena = this._escenaCesium();
        if (!escena || !escena.camera) return null;
        const altura = this._altura3D();
        if (altura === null) return null;

        let fov = FOV_POR_DEFECTO;
        try {
          if (escena.camera.frustum && isFinite(escena.camera.frustum.fov)) {
            fov = escena.camera.frustum.fov;
          }
        } catch (e) {
          /* valor por defecto */
        }

        const lienzo = escena.canvas;
        let alto = (lienzo && lienzo.clientHeight) ? lienzo.clientHeight : 0;
        if (!alto && escena.container && escena.container.clientHeight) {
          alto = escena.container.clientHeight;
        }
        if (!alto) return null;

        const metrosPorPx = (2 * altura * Math.tan(fov / 2)) / alto;
        const escala = metrosPorPx / M_POR_PX;
        return isFinite(escala) && escala > 0 ? escala : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Refresca los dos valores según la implementación activa.
     */
    _actualizar() {
      if (!this._container) return;
      const es3D = this._es3D(this._map);

      if (es3D) {
        this._pintar(this._elEtiqueta, 'Altura de la vista');
        const altura = this._altura3D();
        this._pintar(this._elValor, (altura === null) ? '-'
          : this._formatear(altura) + ' m');
      } else {
        this._pintar(this._elEtiqueta, 'Nivel de zoom');
        let nivel = null;
        try {
          if (this._map && typeof this._map.getZoom === 'function') {
            nivel = Number(this._map.getZoom());
          }
        } catch (e) {
          nivel = null;
        }
        // Con punto decimal, como el control 'scale*true' de la API, para que
        // el nivel se lea igual que en los visizadores originales.
        this._pintar(this._elValor, (nivel === null || !isFinite(nivel))
          ? '-' : Number(nivel).toFixed(2));
      }

      const escala = es3D ? this._escala3D() : this._escala2D();
      this._pintar(this._elUnidad, (escala === null) ? '-' : this._formatear(escala));
    }

    /**
     * Muestra u oculta la lectura.
     */
    _aplicarVisibilidad() {
      if (!this._container) return;
      this._container.style.display = this._visible ? '' : 'none';
    }

    // =====================================================================
    // ENLACE CON LA ESCENA DE CESIUM (3D)
    // =====================================================================

    /**
     * Devuelve la escena de Cesium, o null si todavía no existe.
     * @returns {Object|null} Escena de Cesium.
     */
    _escenaCesium() {
      const impl = this._impl();
      if (impl && impl.scene) return impl.scene;
      return null;
    }

    /**
     * Devuelve la cámara de Cesium, o null si todavía no existe.
     * @returns {Object|null} Cámara de Cesium.
     */
    _camaraCesium() {
      const escena = this._escenaCesium();
      return (escena && escena.camera) ? escena.camera : null;
    }

    /**
     * Espera a que aparezca la escena de Cesium y engancha el refresco a sus
     * cambios de cámara.
     *
     * El mapa se crea antes de que la escena exista (es lo que hace también
     * CentrarVistaInicial en mapas/LucesDeBohemia), así que un fallo en este
     * primer intento NO significa que no haya 3D: se reintenta hasta que
     * aparezca la escena o se agote la espera.
     */
    _vigilarCamara() {
      const camara = this._camaraCesium();
      if (!camara) {
        this._esperarEscena(0);
        return;
      }
      const self = this;
      const alCambiar = function () { self._actualizar(); };

      // 'changed' es el evento propio de Cesium para la cámara.
      try {
        if (camara.changed && typeof camara.changed.addEventListener === 'function') {
          camara.changed.addEventListener(alCambiar);
          this._listenersCesium.push({ tipo: 'changed', destino: camara.changed, fn: alCambiar });
        }
      } catch (e) {
        /* se intenta con postRender */
      }
      // Red de seguridad: si el evento de cámara no está disponible, se
      // refresca en cada fotograma (que es cuando la cámara puede haber
      // cambiado) limitando el trabajo con el propio temporal.
      try {
        const escena = this._escenaCesium();
        if (escena && escena.postRender && typeof escena.postRender.addEventListener === 'function') {
          escena.postRender.addEventListener(alCambiar);
          this._listenersCesium.push({ tipo: 'postRender', destino: escena.postRender, fn: alCambiar });
        }
      } catch (e) {
        /* sin refresco automático en 3D; el resto de eventos lo cubren */
      }
      this._actualizar();
    }

    /**
     * Reintenta con margen la espera de la escena de Cesium.
     * @param {number} intento Número de intento (0 es el primero).
     */
    _esperarEscena(intento) {
      const self = this;
      if (this._esperaEscena) {
        if (window.clearTimeout) window.clearTimeout(this._esperaEscena);
        this._esperaEscena = null;
      }
      if (this._camaraCesium()) {
        this._vigilarCamara();
        return;
      }
      if (intento * 500 > ESPERA_ESCENA) return;
      this._esperaEscena = window.setTimeout(function () {
        self._esperaEscena = null;
        self._esperarEscena(intento + 1);
      }, 500);
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
     * Suelta todos los listeners registrados (DOM, API y Cesium).
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

      for (let i = 0; i < this._listenersCesium.length; i++) {
        const l = this._listenersCesium[i];
        try {
          if (l.destino && typeof l.destino.removeEventListener === 'function') {
            l.destino.removeEventListener(l.fn);
          }
        } catch (e) {
          /* silencioso */
        }
      }
      this._listenersCesium = [];

      if (this._esperaEscena) {
        if (window.clearTimeout) window.clearTimeout(this._esperaEscena);
        this._esperaEscena = null;
      }
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
      const self = this;

      this._host = this._resolveHost(map);
      if (!this._host) {
        console.warn(`${this.name}: no se encontró el contenedor del mapa para la escala.`);
        return;
      }

      // 1) Construir e insertar la lectura (una sola vez).
      if (!this._container) {
        const ui = this._construirUI();
        if (!this._montarEnArea(ui)) {
          // Sin banda (ext/areaControls no cargada): se ancla abajo a la
          // izquierda, que es donde la ponía el control de la API.
          ui.classList.add('g-controlScale--suelto');
          this._host.appendChild(ui);
        }
        this._container = ui;
      }

      // 2) Refresco: en 2D con los eventos de la API y con la vista de OL (que
      //    es la que avisa de los movimientos hechos por código), en 3D con la
      //    cámara.
      this._onApi(evt.CHANGE_ZOOM, function () { self._actualizar(); });
      this._onApi(evt.MOVE, function () { self._actualizar(); });
      this._onApi(evt.COMPLETED, function () { self._actualizar(); });
      this._on(window, 'resize', function () { self._actualizar(); });

      if (this._es3D(map)) {
        this._vigilarCamara();
      } else {
        this._vigilarVistaOL();
      }

      // 3) Primer pintado.
      this._aplicarVisibilidad();
      this._actualizar();
    }

    /**
     * Desmonta el plugin: quita el DOM creado y desconecta los listeners.
     */
    destroy() {
      this._offAll();
      if (this._area && this._container) {
        // El div de la banda, para poder comprobar si queda vacia.
        const banda = this._container.parentNode;
        try {
          this._area.desmonta(this._container);
        } catch (e) {
          /* silencioso */
        }
        // Si la banda se queda sin elementos se suelta entera: si no, sus
        // escuchadores (resize y MutationObserver sobre el rail) seguirian
        // vivos sin nadie que rellene el div.
        if (banda && banda.children.length === 0 && typeof this._area.destroy === 'function') {
          try {
            this._area.destroy();
            if (banda.parentNode) banda.parentNode.removeChild(banda);
          } catch (e) {
            /* silencioso */
          }
        }
      }
      if (this._container && this._container.parentNode) {
        try {
          this._container.parentNode.removeChild(this._container);
        } catch (e) {
          /* silencioso */
        }
      }
      this._container = null;
      this._elEtiqueta = null;
      this._elValor = null;
      this._elUnidad = null;
      this._area = null;
      this._host = null;
      this._map = null;
    }

    // =====================================================================
    // CONTRATO DE ESTADO (CAMBIO DE IMPLEMENTACIÓN 2D / 3D)
    // =====================================================================

    /**
     * Captura el estado serializable mínimo de la interfaz.
     * @returns {{visible: boolean}} Estado de la lectura.
     */
    getState() {
      return { visible: Boolean(this._visible) };
    }

    /**
     * Restaura el estado en la instancia ya montada (addTo ya se ejecutó
     * tras el swap 2D/3D). No reconstruye la interfaz.
     * @param {Object} state Estado previamente capturado con getState().
     * @param {Object} [map] Nueva instancia del mapa.
     */
    setState(state, map) {
      if (map) this._map = map;
      if (state && typeof state === 'object' && typeof state.visible === 'boolean') {
        this._visible = state.visible;
      }
      this._aplicarVisibilidad();
      if (this._es3D(this._map)) {
        this._vigilarCamara();
      } else {
        this._actualizar();
      }
    }

    /**
     * Cambia la visibilidad de la lectura.
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
    window.miPlugin_controlScale = miPlugin_controlScale;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_controlScale = miPlugin_controlScale;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_controlScale = miPlugin_controlScale;
  }
})();