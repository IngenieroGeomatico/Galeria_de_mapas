/* =====================================================================
   PLUGIN BOTÓN DE UBICACIÓN PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   MOTIVACIÓN:
   El control de ubicación ('location') del constructor IDEE.map({controls})
   lo dibuja la propia API como un botón con el icono de GPS en las areas de
   esquina; al pulsarlo pide la posición al navegador y centra el mapa. Pero
   Cesium (3D) NO sabe construirlo: lanza "La implementación usada no puede
   crear controles Location" y aborta la creación del mapa al conmutar 2D/3D.

   En 2D este plugin NO reimplementa la geolocalización: reutiliza el control
   nativo de la API (IDEE.control.Location) y lo cuelga en el mapa en tiempo de
   ejecución, que es lo que permite decidir la implementación antes de crearlo.

   En 3D sí hace falta hacerlo aquí, porque el control nativo no existe para ese
   motor: se dibuja a mano el mismo panel (con las mismas clases que usa la API,
   para que se vea igual y para que controlLocation.css siga sirviendo tal cual) y
   la geolocalización la pone el plugin con la API de Cesium:
     - posición: navigator.geolocation (watchPosition si hay seguimiento,
       getCurrentPosition si no, que es lo que distingue el control de la API);
     - cámara: camera.flyTo, bajando a una altura de ciudad si se estaba viendo
       el mundo entero y respetando la altura actual si ya se está más cerca;
     - marca: una entidad de Cesium, y trackedEntity cuando hay seguimiento.
   Está todo en _crearPanel3D(), _localizar(), _llevarAposicion() y _marcar().

   A diferencia de una lectura de coordenadas del puntero (que es lo que
  Este plugin NO muestra), aquí no hay ningún texto: el botón ofrece la
   única información útil, la posición del usuario, y el mapa se centra
   sobre ella.

   CONVENCIONES:
   1. Resolvedor dual de la API (window.IDEE || window.M) mediante api(),
      eligiendo el global que tenga la API REALMENTE cargada (.ui y .map).
   2. Detección de implementación: se prefiere map.getImplementation()
      ('ol' / 'cesium'), que es la que usa la propia API para distinguir sus
      dos implementaciones, y se cae al patrón canónico del repo
      (map.getMapImpl() con scene.camera) si ese método no existe.
   3. Constructor sin argumentos obligatorio:
      new IDEE.plugin.miPlugin_controlLocation()
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
   * Botón de "mi ubicación": pide la posición al navegador y centra el mapa
   * sobre ella.
   *
   * En 2D se reutiliza el control nativo de la API (IDEE.control.Location). En 3D
   * ese control no existe —es el de MapLibre y el motor de Cesium no lo puede
   * construir—, así que este plugin dibuja el mismo panel a mano y mueve la
   * cámara con la API de Cesium. Vease _crearPanel3D().
   */
  class miPlugin_controlLocation {
    /**
     * Constructor del plugin. Funciona sin argumentos.
     * @param {Object} [options={}] Opciones de configuración (todas opcionales).
     * @param {boolean} [options.visible=true] Estado inicial de visibilidad.
     * @param {number} [options.order] Orden dentro de la columna de esquina
     * (es el `order` CSS del panel de la API). Por defecto, al final.
     * @param {boolean} [options.tracking=true] El control nativo distingue si
     * sigue la posición (tracking) o solo centra una vez. Por defecto true,
     * que es el comportamiento del control 'location' de la API. En 3D el
     * seguimiento se hace con watchPosition y la entidad seguida de Cesium.
     * @param {number} [options.altura3D=1500] Altura de cámara (m) a la que se
     * baja cuando se localiza estando muy alto (vista de mundo). Si la cámara ya
     * está más cerca, se respeta la que hay.
     * @param {number} [options.alturaMinima3D=20000] Por debajo de esta altura de
     * cámara (m) no se cambia la altura: se va a la posición con la que se está,
     * que es lo que se espera al pulsar "mi ubicación" estando a escala de ciudad.
     * @param {string|Object} [options.color1] Color de fondo. Un color o un
     * objeto {active, deactive}.
     * @param {string|Object} [options.color2] Color de borde. Un color o un
     * objeto {active, deactive}.
     * @param {string|Object} [options.color3] Color de icono y texto. Un color o
     * un objeto {active, deactive}.
     */
    constructor(options = {}) {
      // Identificador obligatorio del plugin (gestor de plugins y cambioImpl).
      this.name = 'miPlugin_controlLocation';
      this.options = options || {};

      // Referencia al mapa y a los elementos de interfaz.
      this._map = null;
      this._host = null;
      this._control = null;
      this._panel = null;

      // Listeners registrados (DOM y API) para poder soltarlos.
      this._listeners = [];
      this._listenersApi = [];
      this._espera = null;

      // Estado de la geolocalizacion en 3D: el id de watchPosition en curso y la
      // entidad de Cesium que marca la posicion. En 2D los lleva el control
      // nativo de la API; aqui se guardan para poder soltarlos al desmontar y
      // para el cambio de implementacion.
      this._watchId = null;
      this._entidad = null;

      // Configuración.
      this._visible = (options.visible !== undefined) ? Boolean(options.visible) : true;
      this.order = (options.order !== undefined && !Number.isNaN(Number(options.order)))
        ? Number(options.order) : undefined;
      this._tracking = (options.tracking !== undefined) ? Boolean(options.tracking) : true;
      // Alturas de camara al localizar en 3D (metros).
      this._altura3D = (options.altura3D !== undefined && Number(options.altura3D) > 0)
        ? Number(options.altura3D) : 1500;
      this._alturaMinima3D = (options.alturaMinima3D !== undefined && Number(options.alturaMinima3D) > 0)
        ? Number(options.alturaMinima3D) : 20000;

      // Colores configurables, con el mismo reparto y los mismos valores por
      // defecto que el resto de plugins del repositorio (color1 = fondo,
      // color2 = borde, color3 = icono; ver ext/CalidadAireMadridTiempoReal).
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
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
     * Vuelca los colores configurados a variables CSS del panel del botón.
     *
     *  Las seis variables del esquema (reposo y activo de fondo, borde e icono)
     *  se ponen en línea sobre el panel que la API crea para el control, y
     *  controlLocation.css las consume. El botón no se abre ni se cierra, así
     *  que lo que se ve es el estado de reposo.
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
        title: 'Mi ubicación',
        content: new Promise((resolve) => {
          let html = '<div><p>Botón que obtiene la posición del usuario a través ' +
            'del navegador y centra el mapa sobre ella.</p>' +
            '<p>El navegador pedirá permiso para compartir la ubicación la ' +
            'primera vez. Si lo deniega, el mapa no se mueve.</p>' +
            '<p>En la visualización 3D (Cesium) el botón también está: como el ' +
            'control de la API no se puede construir en ese motor, lo dibuja ' +
            'este plugin y mueve la cámara y la marca de posición directamente.</p></div>';
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
     *
     *  Es el patrón que usan el resto de plugins del repositorio
     *  (ext/controlRotate, ext/mapInfo): en 3D hace falta para llegar a la
     *  cámara y a las entidades de Cesium.
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

    // =====================================================================
    // MONTAJE DEL CONTROL NATIVO EN LA COLUMNA DE ESQUINA
    // =====================================================================

    /**
     * Devuelve el espacio de nombres de Cesium, o null si no está cargado.
     *
     *  Es el mismo global que usa el resto del repositorio para el 3D (ver
     *  ext/comparacionVistas). Se comprueba `Cartesian3.fromDegrees` y no
     *  `fromDegrees` porque en la versión de Cesium que trae la API el atajo no
     *  está exportado (medido: `window.Cesium` tiene 1267 miembros y
     *  `Cesium.fromDegrees` es undefined, mientras que
     *  `Cesium.Cartesian3.fromDegrees` sí es función).
     * @returns {Object|null} Namespace de Cesium.
     */
    _cesium() {
      try {
        const C = window.Cesium;
        if (!C || !C.Cartesian3 || typeof C.Cartesian3.fromDegrees !== 'function') return null;
        return C;
      } catch (e) {
        return null;
      }
    }

    /**
     * Crea el panel del botón de ubicación en 3D, sin control nativo de la API.
     *
     *  En 3D el control Location de la API no existe: es el de MapLibre y la
     *  implementación de Cesium no lo puede construir ("La implementación usada no
     *  puede crear controles Location", medido). Así que aquí se dibuja a mano el
     *  mismo DOM que la API construye en 2D —con las mismas clases— para que el
     *  plugin se vea igual y para que controlLocation.css, que ya se apoya en
     *  esas clases, siga sirviendo sin cambiar nada.
     *
     *  El panel se cuelga en la misma esquina que en 2D (.m-area.m-bottom.m-right,
     *  medido) y con el mismo `order` que el botón nativo, para que caiga en el
     *  mismo sitio de la columna.
     * @returns {boolean} true si se ha creado el panel.
     */
    _crearPanel3D() {
      const C = this._cesium();
      if (!C) return false;
      const host = this._host;
      if (!host || !host.querySelector) return false;

      // Ya montado (o reutilizado de otra instancia): no se duplica.
      const previo = host.querySelector('.m-panel.m-location.g-controlLocation');
      if (previo) {
        this._panel = previo;
        this._enlazarBoton3D();
        this._aplicarColores();
        return true;
      }

      let area = host.querySelector('.m-area.m-bottom.m-right');
      if (!area) area = host.querySelector('.m-area');
      if (!area) return false;

      const panel = document.createElement('div');
      panel.className = 'm-panel m-location opened no-collapsible g-controlLocation';
      if (this.order !== undefined) panel.style.order = String(this.order);

      // La flecha de plegado: en 2D la pone la API con el icono de cerrar y
      // controlLocation.css la esconde (este panel no se pliega). Se reproduce
      // para que el DOM sea el mismo y el CSS no tenga que saber de dónde viene.
      const cerrar = document.createElement('button');
      cerrar.type = 'button';
      cerrar.className = 'm-panel-btn g-cartografia-flecha-izquierda';
      cerrar.setAttribute('aria-hidden', 'true');
      cerrar.tabIndex = -1;
      panel.appendChild(cerrar);

      const controles = document.createElement('div');
      controles.className = 'm-panel-controls';
      const contenedor = document.createElement('div');
      contenedor.className = 'm-control m-location-container';
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.id = 'm-location-button';
      boton.className = 'g-cartografia-gps2';
      boton.title = 'Mi ubicación';
      boton.setAttribute('aria-label', 'Mi ubicación');
      contenedor.appendChild(boton);
      controles.appendChild(contenedor);
      panel.appendChild(controles);
      area.appendChild(panel);

      this._panel = panel;
      this._boton3D = boton;
      this._enlazarBoton3D();
      this._aplicarColores();
      return true;
    }

    /**
     * Enlaza el clic del botón propio de 3D con la geolocalización.
     *
     *  Va en `_crearPanel3D()` y no en el constructor porque el botón se crea
     *  distinto en 2D (lo crea la API) y en 3D.
     */
    _enlazarBoton3D() {
      if (!this._boton3D) {
        this._boton3D = (this._panel && this._panel.querySelector) ? this._panel.querySelector('#m-location-button') : null;
      }
      if (!this._boton3D) return;
      const self = this;
      this._on(this._boton3D, 'click', function (evento) {
        if (evento && typeof evento.preventDefault === 'function') evento.preventDefault();
        self._localizar();
      });
    }

    /**
     * Pide la posición al navegador y lleva la cámara hasta ella.
     *
     *  Con `tracking` se usa watchPosition y la posición se va siguiendo; sin él,
     *  getCurrentPosition y una sola vez, que es lo que distingue el control de
     *  la API. Si ya había una escucha en curso se suelta antes de abrir otra,
     *  porque al pulsar dos veces se acumulaban.
     * @returns {boolean} true si se ha podido pedir la posición.
     */
    _localizar() {
      const nav = window.navigator;
      if (!nav || !nav.geolocation) {
        console.warn(`${this.name}: este navegador no tiene geolocalización.`);
        return false;
      }
      if (!this._es3D(this._map)) {
        // En 2D la hace el control nativo de la API.
        if (this._control && typeof this._control.setTracking === 'function') {
          this._control.setTracking(true);
        }
        return false;
      }
      const C = this._cesium();
      if (!C) return false;

      const self = this;
      const opciones = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      };
      const alRecibir = function (posicion) { self._llevarAposicion(posicion); };
      const alFallar = function (error) { self._errorGeolocalizacion(error); };

      this._pararSeguimiento();
      try {
        if (this._tracking) {
          this._watchId = nav.geolocation.watchPosition(alRecibir, alFallar, opciones);
        } else {
          nav.geolocation.getCurrentPosition(alRecibir, alFallar, opciones);
        }
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudo pedir la posición.`, e);
        return false;
      }
    }

    /**
     * Lleva la cámara de Cesium a la posición recibida y la marca en el globo.
     *
     *  La altura se decide así: si la cámara está más alta que
     *  `alturaMinima3D` (es decir, se está viendo casi el mundo entero) se baja a
     *  `altura3D`, que es una altura de ciudad; y si ya está más cerca se respeta
     *  la que hay, que es lo que se espera al pulsar "mi ubicación" estando a
     *  escala de ciudad. Sin esto, localizar desde la vista de mundo dejaría el
     *  globo a la altura del mundo y no se vería nada.
     * @param {GeolocationPosition} posicion Posición del navegador.
     */
    _llevarAposicion(posicion) {
      const C = this._cesium();
      const mapa = this._impl();
      if (!C || !mapa || !mapa.scene || !posicion || !posicion.coords) return;

      const longitud = Number(posicion.coords.longitude);
      const latitud = Number(posicion.coords.latitude);
      if (!isFinite(longitud) || !isFinite(latitud)) return;

      let altura = this._altura3D;
      try {
        const actual = Number(mapa.camera.positionCartographic.height);
        if (isFinite(actual) && actual > 0 && actual <= this._alturaMinima3D) altura = actual;
      } catch (e) {
        /* si no se puede leer la altura, se usa la por defecto */
      }
      // La precisión que da el navegador es la altura mínima: bajar por debajo de
      // ella solo pone la cámara dentro del suelo.
      const precision = Number(posicion.coords.accuracy);
      if (isFinite(precision) && precision > 0 && altura < precision) altura = precision;

      try {
        const destino = C.Cartesian3.fromDegrees(longitud, latitud, altura);
        // Solo la posición: un flyTo con destino y sin heading ni pitch deja la
        // cámara con la orientación que ya tenía, que es lo que se quiere (la
        // brújula se queda como estaba). Antes se añadía un lookAt detrás para
        // mirar al norte, pero con rango 0 Cesium lanza "normalized result is not a
        // number" (medido) porque la cámara acaba en el mismo punto que el
        // destino; y no hace falta, porque el flyTo ya coloca la cámara.
        mapa.camera.flyTo({ destination: destino, duration: 2 });
      } catch (e) {
        try {
          mapa.camera.setView({ destination: C.Cartesian3.fromDegrees(longitud, latitud, altura) });
        } catch (e2) {
          console.warn(`${this.name}: no se pudo mover la cámara.`, e2);
          return;
        }
      }
      this._marcar(longitud, latitud, altura);
    }

    /**
     * Pone (o mueve) la entidad que marca la posición en el globo.
     *
     *  Con seguimiento activo se le asigna a `trackedEntity`, que es la forma que
     *  tiene Cesium de hacer que la cámara la siga; sin él, la entidad se queda
     *  quieta en el sitio como marca de referencia.
     * @param {number} longitud Longitud en grados.
     * @param {number} latitud Latitud en grados.
     * @param {number} altura Altura de la cámara (m).
     */
    _marcar(longitud, latitud, altura) {
      const C = this._cesium();
      const mapa = this._impl();
      if (!C || !mapa || !mapa.entities) return;
      try {
        const posicion = C.Cartesian3.fromDegrees(longitud, latitud, 0);
        if (this._entidad && !this._entidad.isDestroyed && !this._entidad.isDestroyed()) {
          this._entidad.position = posicion;
        } else {
          this._entidad = mapa.entities.add({
            name: 'miPlugin_controlLocation',
            position: posicion,
            point: {
              pixelSize: 12,
              color: C.Color.fromCssColorString ? C.Color.fromCssColorString('#ffffff') : undefined,
              outlineColor: C.Color.BLACK,
              outlineWidth: 2,
              heightReference: C.HeightReference.CLAMP_TO_GROUND,
            },
          });
        }
        if (this._tracking) mapa.trackedEntity = this._entidad;
      } catch (e) {
        console.warn(`${this.name}: no se pudo marcar la posición.`, e);
      }
    }

    /**
     * Avisa de que no se ha podido obtener la posición.
     *
     *  No se mueve el mapa (igual que el control de la API: si el navegador
     *  deniega el permiso, lo que hay que hacer es no hacer nada visible) y el
     *  motivo se deja en el título del botón, que es donde se mira cuando el
     *  mapa no se ha movido.
     * @param {GeolocationPositionError} error Error del navegador.
     */
    _errorGeolocalizacion(error) {
      const motivos = {
        1: 'Permiso de ubicación denegado',
        2: 'No se ha podido determinar la posición',
        3: 'La solicitud de ubicación ha tardado demasiado',
      };
      const motivo = motivos[error && error.code] || 'No se ha podido determinar la posición';
      console.warn(`${this.name}: ${motivo}.`);
      const boton = this._boton3D;
      if (boton) boton.title = this._tracking ? 'Mi ubicación (seguimiento)' : 'Mi ubicación';
    }

    /**
     * Suelta la escucha de `watchPosition`, si la hubiera.
     */
    _pararSeguimiento() {
      if (this._watchId === null || this._watchId === undefined) return;
      try {
        if (window.navigator && window.navigator.geolocation) {
          window.navigator.geolocation.clearWatch(this._watchId);
        }
      } catch (e) {
        /* el navegador puede no tener ya la escucha */
      }
      this._watchId = null;
    }

    /**
     * Quita la entidad de la posición y deja de seguirla.
     */
    _quitarMarca() {
      const mapa = this._impl();
      try {
        if (mapa && mapa.trackedEntity && this._entidad && mapa.trackedEntity === this._entidad) {
          mapa.trackedEntity = undefined;
        }
        if (this._entidad && typeof this._entidad.remove === 'function') this._entidad.remove();
      } catch (e) {
        /* el mapa puede estar ya destruido */
      }
      this._entidad = null;
    }

    /**
     * Crea el control Location de la API y lo añade al mapa en caliente.
     * Añadirlo en caliente (y no en IDEE.map({controls})) es justamente lo que
     * permite saltarse el fallo de Cesium: si el mapa es 3D, no se llega a
     * construir el control.
     * @returns {boolean} true si se ha añadido el control.
     */
    _anadirControl() {
      const IDEE = api();
      if (!IDEE || !IDEE.control || typeof IDEE.control.Location !== 'function') {
        console.warn(`${this.name}: la API no expone IDEE.control.Location; ` +
          'el botón de ubicación no se puede montar.');
        return false;
      }
      try {
        // Firma del control nativo: (tracking, conVistaInicial, opciones).
        this._control = new IDEE.control.Location(this._tracking, false, {});
        if (this.order !== undefined && typeof this._control.setOrder === 'function') {
          this._control.setOrder(this.order);
        }
        this._map.addControls([this._control]);
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudo crear el control de ubicación.`, e);
        this._control = null;
        return false;
      }
    }

    /**
     * Localiza el panel que la API acaba de crear para el control y le añade
     * la clase propia, para poder identificarlo y ajustar su estado.
     * El panel se crea de forma síncrona al añadir el control, pero se espera
     * con reintentos cortos por si alguna implementación lo difiere.
     */
    _prepararPanel() {
      const self = this;
      const buscar = function (intentos) {
        const host = self._host;
        if (!host || !host.querySelector) return;
        const panel = host.querySelector('.m-panel.m-location');
        if (panel) {
          self._panel = panel;
          panel.classList.add('g-controlLocation');
          self._aplicarColores();
          self._aplicarVisibilidad();
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
     * Muestra u oculta el panel.
     */
    _aplicarVisibilidad() {
      if (!this._panel) return;
      this._panel.style.display = this._visible ? '' : 'none';
    }

    /**
     * Cambia la visibilidad del botón.
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

    /**
     * Indica si el control sigue la posición del usuario de forma continua.
     * @param {boolean} tracking true para seguir, false para centrar una vez.
     */
    setTracking(tracking) {
      this._tracking = Boolean(tracking);
      if (this._control && typeof this._control.setTracking === 'function') {
        try {
          this._control.setTracking(this._tracking);
        } catch (e) {
          /* el control puede no estar listo */
        }
      }
      // En 3D el seguimiento es de este plugin: si se desactiva, se suelta la
      // escucha y la entidad deja de estar seguida.
      if (!this._tracking) {
        this._pararSeguimiento();
        const mapa = this._impl();
        if (mapa && this._entidad && mapa.trackedEntity === this._entidad) {
          try { mapa.trackedEntity = undefined; } catch (e) { /* el mapa puede estar yendo a destruirse */ }
        }
      }
    }

    /**
     * @returns {boolean} Si el control sigue la posición de forma continua.
     */
    getTracking() {
      return Boolean(this._tracking);
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
     * Suelta todos los listeners registrados.
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

      if (this._es3D(map)) {
        // En 3D no hay control nativo que montar (es el de MapLibre y el motor de
        // Cesium no lo construye), así que se dibuja el panel aquí y la
        // geolocalización la pone este plugin. Vease _crearPanel3D().
        this._crearPanel3D();
        this._aplicarVisibilidad();
        return;
      }

      if (!this._anadirControl()) return;
      this._prepararPanel();
      this._onApi(evt.COMPLETED, () => { this._aplicarVisibilidad(); });
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
      // Geolocalización de 3D: primero se suelta la escucha y la marca, que si
      // no se quedan escuchando y escribiendo en un mapa que ya no existe.
      this._pararSeguimiento();
      this._quitarMarca();
      // Y el panel propio de 3D, que es de este plugin y no de la API (en 2D el
      // panel lo crea el control nativo y se va con removeControls).
      if (this._panel && this._panel.parentNode) {
        try { this._panel.parentNode.removeChild(this._panel); } catch (e) { /* silencioso */ }
      }
      if (this._control && this._map && typeof this._map.removeControls === 'function') {
        try {
          this._map.removeControls([this._control]);
        } catch (e) {
          /* el mapa puede estar ya destruido */
        }
      }
      this._control = null;
      this._panel = null;
      this._boton3D = null;
      this._host = null;
      this._map = null;
    }

    // =====================================================================
    // CONTRATO DE ESTADO (CAMBIO DE IMPLEMENTACIÓN 2D / 3D)
    // =====================================================================

    /**
     * Captura el estado serializable mínimo de la interfaz.
     * @returns {{visible: boolean}} Estado del botón de ubicación.
     */
    getState() {
      return {
        visible: Boolean(this._visible),
        tracking: Boolean(this._tracking),
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
      if (typeof st.tracking === 'boolean' && st.tracking !== this._tracking) {
        this.setTracking(st.tracking);
      }
      // En 3D el panel lo pone este plugin, no la API: sin esto, al volver de 3D
      // el botón no se volvería a montar (en 2D lo monta _prepararPanel, que
      // busca el panel que la API acaba de crear).
      if (this._es3D(this._map)) this._crearPanel3D();
      else this._prepararPanel();
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
    window.miPlugin_controlLocation = miPlugin_controlLocation;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_controlLocation = miPlugin_controlLocation;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_controlLocation = miPlugin_controlLocation;
  }
})();