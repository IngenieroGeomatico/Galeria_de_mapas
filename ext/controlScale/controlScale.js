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

   EDICIÓN A MANO:
     Los dos valores se pueden escribir y el mapa va allí. En reposo se ven
     como simples cifras; al pulsar encima se convierten en un campo de texto.
     El control 'scale*true' de la API hace lo mismo pero con contenteditable,
     que se ha descartado por tres motivos:

       - no hay teclado numérico en móvil (falta inputmode), ni semántica de
         min/max/step, ni escalado con las flechas;
       - admite texto enriquecido, así que un pegado mete marcado dentro;
       - no valida nada, y la API tampoco: map.setToClosestScale('abc') deja
         el mapa con getZoom() === NaN, sin resolución y sin recuperación.

     Aquí los valores son <input type="text" inputmode="decimal">, se validan
     y se topan ANTES de llamar a la API (ver _aplicarTexto), y después de
     aplicar se relee del mapa lo que ha quedado de verdad, porque la API no
     acierta siempre: setToClosestScale(50000) deja 49999.

      Lo que se escribe es la misma magnitud que se pinta, así que escribir lo
     que se lee deja lo que se lee (ver _descorregirPorLatitud). Sin esa vuelta,
     a 15 grados de latitud el campo enseñaba 25.900 tras escribir 25.000, y
     reescribir ese 25.900 se iba a 26.826.

   TRANSICIÓN:
     Un salto de golpe al escribir un número queda brusco, así que en 2D se
     anima con la propia vista de OpenLayers (view.animate, 550 ms, curva
     easeOut) y no con map.setZoom(), que salta. Para la escala se anima la
     resolución, que es lo que la vista sabe interpolar: la equivalente a una
     escala nominal es escala * 0,0254/72 (ver M_POR_PX_API, con el pie de que
     la API publica su escala midiendo el píxel a 72 dpi y no a los 96 con los
     que aquí se calcula la de 3D). Por eso no se usa setToClosestScale(), que
     además no devuelve nada.

     En 3D no hay vista que animar y la cámara no tiene transición de altura:
     el cambio es instantáneo, aunque se conservan el rumbo y la inclinación
     (ver _fijarAlturaCamara).

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
  /** Metros por píxel con los que PUBLICA la API su escala: 0,0254 / 72.
   *
   * Ojo: la API mide el píxel a 72 dpi cuando publica la escala, no a los 96 dpi
   * con los que este plugin calcula la de 3D. Comprobado a pelo:
   * resolución = escala * 0,0254/72 en 1:5.000 (1,76389), 1:25.000 (8,81944),
   * 1:100.000 (35,2778) y 1:500.000 (176,389). Con 96 dpi saldría un 33% mayor.
   * De aquí sale la resolución a la que hay que ir para escribir una escala. */
  const M_POR_PX_API = 0.0254 / 72;
  /** Duración de la transición al escribir un valor, en ms. */
  const DURACION_TRANSICION = 550;
  /** Campo de visión por defecto de la cámara de Cesium (rad). */
  const FOV_POR_DEFECTO = Math.PI / 3;
  /** Tope de espera (ms) para que aparezca la escena de Cesium. */
  const ESPERA_ESCENA = 12000;
  /** Ancho en caracteres de los campos de texto, para que el ancho no baile. */
  const ANCHO_CARACTERES = 8;
  /** Rangos admitidos de la escala 1:n. Cubre de sobra los zooms 0-28. */
  const ESCALA_MINIMA = 1;
  const ESCALA_MAXIMA = 1e9;
  /** Rango de altura de cámara admitido en 3D (m). */
  const ALTURA_MINIMA = 1;
  const ALTURA_MAXIMA = 2e7;

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

      // Estado de la edición a mano: qué campo se está escribiendo y si el
      // último cambio de foco debe descartarse en vez de aplicarse.
      this._campoEditando = null;
      this._descartar = null;
      this._textoAlEntrar = null;
      this._timerRechazo = null;
      // Último número calculado para cada campo, para poder escalonar con las
      // flechas partiendo del valor real y no del texto.
      this._ultimoPrincipal = null;
      this._ultimoEscala = null;

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
            'perspectiva, no es una constante en toda la vista.</p>' +
            '<p>Los dos valores se pueden escribir: pulse sobre el número, ' +
            'escriba el nuevo nivel de zoom o la nueva escala (1:n) y pulse ' +
            'Intro. La vista se desplaza con una transición suave, no de golpe. ' +
            'Se admite la escala con o sin el 1: delante (25000, 1:25000 o ' +
            '1 : 25.000) y con coma o punto decimal. Escape deshace. Con Alt y ' +
            'las flechas se salta de diez en diez.</p>' +
            '<p>La escala que se escribe es la del suelo, la misma que se ve: ' +
            'en 2D se corrige por la latitud, porque en Mercator un metro del ' +
            'plano son menos metros de suelo cuanto más al norte. Por eso la ' +
            'que publica la API sale distinta.</p></div>';
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
     *
     * Los dos valores son campos de texto, no cifras: hasta que no se pulse
     * encima se comportan como texto plano (el CSS les quita fondo y borde),
     * y entonces sirven para escribir el nivel de zoom o la escala a mano.
     * @returns {HTMLElement} Contenedor creado.
     */
    _construirUI() {
      const cont = document.createElement('div');
      cont.className = 'g-controlScale';
      cont.title = 'Escala y nivel de vista del mapa. Púlsalo para escribirlos a mano.';

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
      const valor = this._crearCampo('Nivel de zoom');
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
      const valorEscala = this._crearCampo('Escala');
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
     * Crea uno de los dos campos editables de la lectura.
     *
     * Se usa type="text" y no type="number" a propósito: el primero deja
     * escribir lo que la API formatea en español ("44.248") y lo normaliza
     * este plugin, mientras que el segundo descarta en silencio lo que no
     * entiende y trae problemas con el separador decimal según el navegador.
     * El teclado numérico en móvil lo aporta inputmode.
     *
     * El contenedor ya no es una región viva (aria-live): ahora contiene
     * controles de formulario, y una región viva no debe anunciar en cada
     * fotograma de un desplazamiento. Cada campo lleva su propia etiqueta.
     * @param {string} nombre Etiqueta accesible del campo.
     * @returns {HTMLInputElement} Campo creado.
     */
    _crearCampo(nombre) {
      const campo = document.createElement('input');
      campo.type = 'text';
      campo.className = 'g-controlScale-valor g-controlScale-campo';
      campo.inputMode = 'decimal';
      campo.autocomplete = 'off';
      campo.spellcheck = false;
      campo.size = ANCHO_CARACTERES;
      campo.value = '-';
      campo.setAttribute('aria-label', nombre);
      campo.title = 'Pulsa para escribirlo a mano. Intro aplica, Escape cancela.';

      // Al pulsar se entra en edición; al perder el foco se aplica (o se
      // descarta, si antes se pulsó Escape).
      this._on(campo, 'focus', function () { this._alEntrarEnEdicion(campo); }.bind(this));
      this._on(campo, 'blur', function () { this._alPerderFoco(campo); }.bind(this));
      this._on(campo, 'keydown', function (ev) { this._alPulsarTecla(campo, ev); }.bind(this));

      return campo;
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
     * Escribe el contenido de uno de los dos campos editables.
     *
     * Si el campo se está editando no se toca: si no, cada refresco del mapa
     * (y hay uno por cada cambio de la vista) le borraría al usuario lo que
     * acaba de teclear, con la sensación de que el campo no acepta el teclado.
     * @param {HTMLInputElement} campo Campo destino.
     * @param {string} texto Texto a escribir.
     */
    _pintarCampo(campo, texto) {
      if (!campo) return;
      if (campo === this._campoEditando) return;
      if (campo.value === texto) return;
      campo.value = texto;
    }

    /**
     * Convierte lo que ha escrito el usuario en un número.
     *
     * Tiene que deshacer dos cosas: el formato español con punto de millar
     * ("44.248", que es lo que pinta este mismo plugin) y la costumbre de
     * escribir la escala como cociente ("1:50000" o "1 : 50.000"). Con un
     * punto delante puede ser un millar o un decimal, y se decide por la forma:
     * si el texto encaja en d{1,3}(.d{3})+ son millares; si no, decimal.
     * @param {string} texto Texto escrito por el usuario.
     * @returns {number|null} El número, o null si no hay uno válido.
     */
    _parsearNumero(texto) {
      if (typeof texto !== 'string') return null;
      let t = texto.trim();
      if (!t) return null;

      // "1 : 50.000", que es como la propia lectura presenta la escala.
      const cociente = /^1\s*[:/]\s*(\d.*)$/.exec(t);
      if (cociente) t = cociente[1];

      // Se quitan espacios (tb. los finos) y apóstrofos de millar.
      t = t.replace(/[\s\u00a0\u202f']/g, '');

      // "50000:1" también vale.
      const reves = /^(\d[\d.]*):1$/.exec(t);
      if (reves) t = reves[1];

      // La unidad que la lectura escribe en 3D ("5200 m"): si el usuario
      // selecciona el valor y pulsa Intro sin más, tiene que contar como válido.
      t = t.replace(/m$/i, '');

      const millares = /^\d{1,3}(\.\d{3})+$/.test(t);
      const decimal = /^\d+([.,]\d+)?$/.test(t);

      let n;
      if (millares) {
        n = Number(t.replace(/\./g, ''));
      } else if (decimal) {
        n = Number(t.replace(',', '.'));
      } else {
        // 'abc', '-', '1e12': aquí no se admiten notaciones raras.
        return null;
      }
      return isFinite(n) ? n : null;
    }

    /**
     * Rango de zoom con el que se acota lo que se escribe.
     *
     * Se pregunta primero a la vista de OL y después al facade de la API, que
     * es el que se usa de reserva. El tope de arriba sí es de fiar en los dos
     * sitios (28 en estos mapas), y es donde está el riesgo real de escribir
     * 999999.
     *
     * El de abajo NO lo es, y conviene saberlo: getMinZoom() devuelve 0 tanto
     * en la vista como en el facade, pero escribir 0 no deja el mapa en 0, lo
     * deja en 2,32, que es su mínimo real y lo impone la lista de resoluciones
     * por dentro, no el atributo. Como getResolutions() tampoco está publicado,
     * ese suelo no se puede leer de antemano. No pasa nada: se acota a lo que
     * diga el atributo, la vista corrige sola y, como el refresco escucha a la
     * vista, el campo acaba enseñando el 2,32 de verdad.
     * @returns {{min: number, max: number}} Rango leído de la vista o de la API.
     */
    _rangoZoom() {
      let min = null;
      let max = null;
      const mapa = this._map;

      try {
        const vista = this._vistaOL();
        if (vista) {
          if (typeof vista.getMinZoom === 'function') {
            const v = Number(vista.getMinZoom());
            if (isFinite(v)) min = v;
          }
          if (typeof vista.getMaxZoom === 'function') {
            const v = Number(vista.getMaxZoom());
            if (isFinite(v)) max = v;
          }
        }
      } catch (e) {
        /* se prueba con la API */
      }

      if (min === null || max === null) {
        try {
          if (min === null && mapa && typeof mapa.getMinZoom === 'function') {
            const v = Number(mapa.getMinZoom());
            if (isFinite(v)) min = v;
          }
          if (max === null && mapa && typeof mapa.getMaxZoom === 'function') {
            const v = Number(mapa.getMaxZoom());
            if (isFinite(v)) max = v;
          }
        } catch (e) {
          /* valores por defecto */
        }
      }

      return {
        min: (min === null) ? 0 : min,
        max: (max === null) ? 28 : max,
      };
    }

    /**
     * Acota un valor a un rango.
     * @param {number} valor Valor pedido.
     * @param {number} min Mínimo admitido.
     * @param {number} max Máximo admitido.
     * @returns {number|null} El valor acotado, o null si no es un número.
     */
    _acotar(valor, min, max) {
      if (!isFinite(valor)) return null;
      let n = valor;
      if (isFinite(min) && n < min) n = min;
      if (isFinite(max) && n > max) n = max;
      return n;
    }

    /**
     * Último número que el plugin ha calculado para un campo, para poder
     * escalonar con las flechas partiendo de él.
     * @param {HTMLInputElement} campo Campo de la lectura.
     * @returns {number|null} El número, o null si no se sabe.
     */
    _valorNumerico(campo) {
      if (campo === this._elValor) return this._ultimoPrincipal;
      if (campo === this._elUnidad) return this._ultimoEscala;
      return null;
    }

    // ---------------------------------------------------------------------
    // EDICIÓN A MANO
    // ---------------------------------------------------------------------

    /**
     * El usuario ha pulsado dentro de un campo: se selecciona todo el texto
     * para que al escribir se sustituya la lectura en lugar de añadirse.
     * @param {HTMLInputElement} campo Campo enfocado.
     */
    _alEntrarEnEdicion(campo) {
      if (!campo || this._campoEditando === campo) return;
      this._campoEditando = campo;
      // Se apunta con qué texto se entra, porque la lectura que se pinta es la
      // escala YA CORREGIDA por la latitud y setToClosestScale() espera la
      // nominal: si alguien selecciona el valor y pulsa Intro sin escribir
      // nada, aplicarlo cambiaría la escala sin que nadie hubiera tocado nada.
      this._textoAlEntrar = campo.value;
      campo.classList.add('g-controlScale-campo--editando');
      try {
        campo.select();
      } catch (e) {
        /* silencioso */
      }
    }

    /**
     * Teclado dentro de un campo: Intro aplica, Escape deshace y las flechas
     * escalonan de valor en valor (con Alt, de diez en diez).
     * @param {HTMLInputElement} campo Campo enfocado.
     * @param {KeyboardEvent} ev Evento de teclado.
     */
    _alPulsarTecla(campo, ev) {
      if (!campo || !ev) return;
      const tecla = ev.key;
      if (tecla === 'Escape') {
        ev.preventDefault();
        this._descartar = campo;
        try { campo.blur(); } catch (e) { /* silencioso */ }
        return;
      }
      if (tecla === 'Enter') {
        ev.preventDefault();
        // Quitar el foco es lo que dispara la confirmación; se centraliza ahí
        // para no tener dos caminos distintos al mismo sitio.
        try { campo.blur(); } catch (e) { /* silencioso */ }
        return;
      }
      if (tecla === 'ArrowUp' || tecla === 'ArrowDown') {
        const salto = ev.altKey ? 10 : 1;
        const escrito = this._parsearNumero(campo.value);
        const base = (escrito === null) ? this._valorNumerico(campo) : escrito;
        if (base === null) return;
        ev.preventDefault();
        campo.value = String(base + ((tecla === 'ArrowUp') ? salto : -salto));
        try {
          const fin = campo.value.length;
          campo.setSelectionRange(fin, fin);
        } catch (e) {
          /* silencioso */
        }
      }
    }

    /**
     * El campo ha perdido el foco: se aplica lo escrito, salvo que el usuario
     * haya pulsado Escape antes.
     * @param {HTMLInputElement} campo Campo que pierde el foco.
     */
    _alPerderFoco(campo) {
      if (!campo) return;
      const descartado = (this._descartar === campo);
      this._descartar = null;
      this._cerrarEdicion(campo, !descartado);
    }

    /**
     * Termina la edición de un campo y repinta la lectura.
     * @param {HTMLInputElement} campo Campo editado.
     * @param {boolean} aplicar true para aplicar lo escrito, false para
     *   dejarlo como estaba.
     */
    _cerrarEdicion(campo, aplicar) {
      if (!campo) return;
      const sinCambiar = (campo.value === this._textoAlEntrar);
      if (aplicar && !sinCambiar) this._aplicarTexto(campo, campo.value);
      if (this._campoEditando === campo) {
        this._campoEditando = null;
        this._textoAlEntrar = null;
        campo.classList.remove('g-controlScale-campo--editando');
      }
      this._actualizar();
    }

    /**
     * Traduce el texto de un campo a la acción que corresponde sobre el mapa.
     * @param {HTMLInputElement} campo Campo editado.
     * @param {string} texto Texto escrito por el usuario.
     */
    _aplicarTexto(campo, texto) {
      const numero = this._parsearNumero(texto);
      if (numero === null) {
        this._rechazar(campo);
        return;
      }
      if (campo === this._elValor) {
        this._aplicarPrincipal(numero);
      } else if (campo === this._elUnidad) {
        this._aplicarEscala(numero);
      }
    }

    /**
     * Aplica el dato principal: el nivel de zoom en 2D, la altura de la
     * cámara en 3D.
     * @param {number} numero Valor pedido.
     */
    _aplicarPrincipal(numero) {
      if (this._es3D(this._map)) {
        const metros = this._acotar(numero, ALTURA_MINIMA, ALTURA_MAXIMA);
        if (metros === null) {
          this._rechazar(this._elValor);
          return;
        }
        this._fijarAlturaCamara(metros);
        return;
      }
      const rango = this._rangoZoom();
      const nivel = this._acotar(numero, rango.min, rango.max);
      if (nivel === null) {
        this._rechazar(this._elValor);
        return;
      }
      this._irAZoom(nivel);
    }

    /**
     * Lleva la escala 1:n a la que se le escriba.
     * @param {number} numero Denominador pedido.
     */
    _aplicarEscala(numero) {
      const escala = this._acotar(numero, ESCALA_MINIMA, ESCALA_MAXIMA);
      if (escala === null) {
        this._rechazar(this._elUnidad);
        return;
      }
      this._irAEscala(escala);
    }

    /**
     * Lleva la vista a un nivel de zoom con transición.
     *
     * Un salto de golpe al escribir un número queda muy brusco, así que se
     * anima con la propia vista de OpenLayers (view.animate), que trae una
     * curva easeOut suave y además cancela la animación anterior si el usuario
     * escribe otra cosa mientras corre.
     *
     * map.setZoom() se deja como recurso: si no hay vista (3D) o si animate()
     * no existe en esta versión de la API, se va directo a él.
     * @param {number} nivel Nivel de zoom pedido.
     */
    _irAZoom(nivel) {
      const vista = this._vistaOL();
      if (!vista || typeof vista.animate !== 'function') {
        try {
          if (this._map && typeof this._map.setZoom === 'function') {
            this._map.setZoom(nivel);
          }
        } catch (e) {
          this._rechazar(this._elValor);
        }
        return;
      }
      try {
        vista.animate({ zoom: nivel, duration: DURACION_TRANSICION });
      } catch (e) {
        try {
          if (this._map && typeof this._map.setZoom === 'function') {
            this._map.setZoom(nivel);
          }
        } catch (e2) {
          this._rechazar(this._elValor);
        }
      }
    }

    /**
     * Lleva la vista a una escala 1:n con transición.
     *
     * No se usa map.setToClosestScale() porque salta y no devuelve nada, y
     * porque aquí ya está el dato: la resolución equivalente a una escala
     * nominal es escala * 0,0254/72 (ver M_POR_PX_API). Con eso se anima la
     * resolución, que es lo que la vista sabe interpolar.
     *
     * El número que se escribe es la escala sobre el suelo, la misma que se
     * pinta, así que en 2D se deshace antes la corrección por latitud. En 3D no
     * hay vista que animar y la escala es una distancia real, así que se
     * convierte a altura de cámara (_alturaParaEscala3D) y se aplica por la
     * misma vía que la altura.
     * @param {number} escala Denominador pedido, sobre el suelo.
     */
    _irAEscala(escala) {
      // En 3D no hay vista de OL que animar: se cambia la altura de la cámara,
      // que es el equivalente de la escala ahí.
      if (this._es3D(this._map)) {
        const altura = this._alturaParaEscala3D(escala);
        if (altura === null) {
          this._rechazar(this._elUnidad);
          return;
        }
        this._fijarAlturaCamara(this._acotar(altura, ALTURA_MINIMA, ALTURA_MAXIMA));
        return;
      }
      // Lo que se escribe es la escala sobre el suelo, la misma que se pinta,
      // así que se deshace antes la corrección por latitud.
      const resolucion = this._descorregirPorLatitud(escala) * M_POR_PX_API;
      const vista = this._vistaOL();
      if (!vista || typeof vista.animate !== 'function') {
        try {
          if (this._map && typeof this._map.setToClosestScale === 'function') {
            this._map.setToClosestScale(this._descorregirPorLatitud(escala));
          }
        } catch (e) {
          this._rechazar(this._elUnidad);
        }
        return;
      }
      if (!isFinite(resolucion) || resolucion <= 0) {
        this._rechazar(this._elUnidad);
        return;
      }
      try {
        vista.animate({ resolution: resolucion, duration: DURACION_TRANSICION });
      } catch (e) {
        try {
          if (this._map && typeof this._map.setToClosestScale === 'function') {
            this._map.setToClosestScale(this._descorregirPorLatitud(escala));
          }
        } catch (e2) {
          this._rechazar(this._elUnidad);
        }
      }
    }

    /**
     * Altura de la cámara que corresponde a una escala 1:n en 3D.
     *
     * Se deduce de la propia fórmula que usa _escala3D(): metros por píxel =
     * escala * M_POR_PX, y a la vez = 2 * altura * tan(fov/2) / alto_del_lienzo.
     * Despejando la altura queda lo de abajo. Se invierte así, y no llamando a
     * setToClosestScale(), porque la fórmula de lectura es nuestra y es la que
     * garantiza que escribir lo que se lee deja lo que se lee.
     * @param {number} escala Denominador 1:n sobre el suelo.
     * @returns {number|null} Altura en metros, o null si falta la escena.
     */
    _alturaParaEscala3D(escala) {
      try {
        const escena = this._escenaCesium();
        if (!escena || !escena.camera) return null;
        let fov = FOV_POR_DEFECTO;
        if (escena.camera.frustum && isFinite(escena.camera.frustum.fov)) {
          fov = escena.camera.frustum.fov;
        }
        const lienzo = escena.canvas;
        let alto = (lienzo && lienzo.clientHeight) ? lienzo.clientHeight : 0;
        if (!alto && escena.container && escena.container.clientHeight) {
          alto = escena.container.clientHeight;
        }
        if (!alto || !isFinite(alto) || alto <= 0) return null;
        const altura = (escala * M_POR_PX * alto) / (2 * Math.tan(fov / 2));
        return (isFinite(altura) && altura > 0) ? altura : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Lleva la cámara de Cesium a una altura sobre el elipsoide.
     *
     * Conserva el rumbo y la inclinación: se relee la posición geodésica actual,
     * se cambia solo la altura y se vuelve a montar la cámara con la misma
     * orientación. Eso es lo que quiere quien escribe una altura (acercar o
     * alejar sin perder de vista a dónde mira), y no que la cámara se gire de
     * golpe al norte. Por eso se usa camera.setView() con orientation en vez
     * de tocar camera.position: setView() trabaja en coordenadas de mundo,
     * que es donde están las coordenadas geodésicas, y respeta el marco de
     * referencia que pueda tener la escena.
     *
     * OJO con la firma de Cesium: Cartesian3.fromRadians() NO admite un
     * Cartographic entero, sino longitud, latitud y altura sueltas. Pasándole
     * el objeto entero revienta con "Expected longitude to be typeof number,
     * actual typeof was object", el try se traga el error y la cámara se queda
     * donde estaba sin decir nada, que es como se vio el fallo.
     * @param {number} metros Altura pedida sobre el elipsoide.
     */
    _fijarAlturaCamara(metros) {
      const camara = this._camaraCesium();
      if (!camara) return;
      const Cesium = window.Cesium;
      if (!Cesium || !Cesium.Cartographic || !Cesium.Cartesian3 || !Cesium.Ellipsoid) {
        this._rechazar(this._elValor);
        return;
      }
      try {
        const elipsoide = this._elipsoideCesium(camara);
        const carto = Cesium.Cartographic.fromCartesian(camara.positionWC, elipsoide);
        if (!carto) {
          this._rechazar(this._elValor);
          return;
        }
        const destino = Cesium.Cartesian3.fromRadians(
          carto.longitude, carto.latitude, metros, elipsoide, new Cesium.Cartesian3()
        );
        camara.setView({
          destination: destino,
          orientation: { heading: camara.heading, pitch: camara.pitch, roll: camara.roll }
        });
      } catch (e) {
        this._rechazar(this._elValor);
      }
    }

    /**
     * Elipsoide con el que anda la escena de Cesium.
     *
     * Ni la cámara ni su frustum lo tienen (comprobado), así que se busca en el
     * globo y en la proyección del mapa antes de recurrir al WGS84, que es lo
     * que se usa siempre aquí.
     * @param {Object} camara Cámara de Cesium.
     * @returns {Object} Elipsoide de Cesium.
     */
    _elipsoideCesium(camara) {
      const Cesium = window.Cesium;
      const candidatas = [
        (camara && camara.frustum) ? camara.frustum.ellipsoid : null,
        (this._escenaCesium() || {}).globe,
        (this._escenaCesium() || {}).mapProjection,
        Cesium.Ellipsoid.WGS84
      ];
      for (let i = 0; i < candidatas.length; i++) {
        const elipsoide = candidatas[i] && candidatas[i].ellipsoid
          ? candidatas[i].ellipsoid : candidatas[i];
        if (elipsoide && typeof elipsoide.cartographicToCartesian === 'function') {
          return elipsoide;
        }
      }
      return Cesium.Ellipsoid.WGS84;
    }

    /**
     * Avisa de que lo escrito no vale y deja el campo como estaba.
     *
     * El mapa no se toca nunca en este camino, y es a propósito: la API no
     * valida y setToClosestScale('abc') deja el mapa con getZoom() === NaN,
     * es decir, sin resolución y sin manera de volver.
     * @param {HTMLInputElement} campo Campo con un valor no válido.
     */
    _rechazar(campo) {
      if (!campo) return;
      campo.classList.remove('g-controlScale-campo--rechazado');
      // Hay que forzar un reflow para que al volver a añadir la clase la
      // animación se ejecute otra vez en vez de no hacer nada.
      try { void campo.offsetWidth; } catch (e) { /* silencioso */ }
      campo.classList.add('g-controlScale-campo--rechazado');
      // Y un temporizador para quitar elAviso, que si se queda puesto parece
      // un resaltado permanente.
      if (this._timerRechazo) window.clearTimeout(this._timerRechazo);
      this._timerRechazo = window.setTimeout(function () {
        campo.classList.remove('g-controlScale-campo--rechazado');
      }, 700);
    }

    /**
     * Vista de OpenLayers, que es la que avisa de los cambios y la que sabe
     * animar el zoom. En Cesium no existe (getView() da undefined).
     * @returns {Object|null} Instancia de ol.View, o null en 3D.
     */
    _vistaOL() {
      try {
        const impl = this._impl();
        return (impl && typeof impl.getView === 'function') ? impl.getView() : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Proyección en la que está el mapa.
     * @returns {string} Código de la proyección ('EPSG:3857', 'EPSG:4326'...).
     */
    _proyeccion() {
      try {
        const vista = this._vistaOL();
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
     * Operación inversa de _corregirPorLatitud(): de la escala sobre el suelo
     * a la escala nominal con la que publica la API.
     *
     * Hace falta al escribir una escala, para que el número que se ve en el
     * campo y el número que se escribe coincidan. Sin esta corrección, a 15
     * grados de latitud el campo enseña 25.900 tras escribir 25.000, y
     * reescribir ese 25.900 se iba a 26.826: el control se contradecía a sí
     * mismo y no era idempotente. Con ella, escribir lo que se lee deja lo que
     * se lee.
     * @param {number} escala Escala 1:n sobre el suelo, tal y como se pinta.
     * @returns {number} Escala nominal 1:n que espera la API.
     */
    _descorregirPorLatitud(escala) {
      const latitud = this._latitudCentro();
      if (latitud === null) return escala;
      const coseno = Math.cos(latitud * Math.PI / 180);
      if (!isFinite(coseno) || coseno <= 0.05) return escala;
      const nominal = escala * coseno;
      return (isFinite(nominal) && nominal > 0) ? nominal : escala;
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
        const vista = this._vistaOL();
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
        this._ultimoPrincipal = altura;
        this._etiquetarCampo(this._elValor, 'Altura de la cámara en metros');
        this._pintarCampo(this._elValor, (altura === null) ? '-'
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
        if (nivel !== null && !isFinite(nivel)) nivel = null;
        this._ultimoPrincipal = nivel;
        this._etiquetarCampo(this._elValor, 'Nivel de zoom');
        // Con punto decimal, como el control 'scale*true' de la API, para que
        // el nivel se lea igual que en los visizadores originales.
        this._pintarCampo(this._elValor, (nivel === null)
          ? '-' : Number(nivel).toFixed(2));
      }

      const escala = es3D ? this._escala3D() : this._escala2D();
      this._ultimoEscala = escala;
      this._etiquetarCampo(this._elUnidad, 'Denominador de la escala, 1 : n');
      this._pintarCampo(this._elUnidad, (escala === null) ? '-' : this._formatear(escala));
    }

    /**
     * Cambia la etiqueta accesible de un campo si ha cambiado de significado.
     * @param {HTMLInputElement} campo Campo a etiquetar.
     * @param {string} texto Etiqueta a poner.
     */
    _etiquetarCampo(campo, texto) {
      if (!campo) return;
      if (campo.getAttribute('aria-label') === texto) return;
      campo.setAttribute('aria-label', texto);
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

      if (this._timerRechazo) {
        if (window.clearTimeout) window.clearTimeout(this._timerRechazo);
        this._timerRechazo = null;
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
      this._campoEditando = null;
      this._descartar = null;
      this._textoAlEntrar = null;
      this._timerRechazo = null;
      this._ultimoPrincipal = null;
      this._ultimoEscala = null;
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