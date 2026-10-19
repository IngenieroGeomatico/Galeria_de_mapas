/*
 * maplibreLayer: da soporte 3D a `IDEE.layer.MapLibre`.
 *
 * QUÉ HACE Y POR QUÉ HACE FALTA
 *
 * En 2D la capa la implementa OpenLayers y funciona. En Cesium el bundle deja
 * el módulo de implementación vacío (`6149:()=>{}`), así que el constructor de
 * la fachada lanza siempre:
 *
 *   «La implementación usada no puede crear capas MapLibre»
 *
 * No es que falte registrarla: la fachada del bundle pide la implementación a
 * `n(6149)`, que en la build de Cesium es un stub, y `__webpack_require__` no
 * se expone en la ventana (igual que pasa con MVT, ver ext/MVTLayer). Por eso
 * aquí se sustituye la fachada `IDEE.layer.MapLibre` por una propia que hereda
 * de la MISMA clase base que la del bundle y le pasa una implementación que sí
 * pinta. El visualizador no cambia nada: sigue escribiendo
 * `new IDEE.layer.MapLibre(...)`.
 *
 *
 * CÓMO LO RESUELVE OPENLAYERS (medido en apiidee-1.1.0.ol.min.js)
 *
 * OL no mete las teselas vectoriales en una capa de OL: monta un
 * `maplibregl.Map` propio (MapLibre GL JS va embebido en esa build) dentro de
 * un div absoluto y lo deja sincronizado con la vista en cada frame:
 *
 *   - crea el mapa con `container` = div 100% x 100%, `attributionControl:
 *     false`, `interactive: false` y `trackResize: false`, o sea, sin capturar
 *     eventos ni gestionar su tamaño: los dos los lleva el mapa de fuera;
 *   - en `renderFrame(viewState)` hace
 *       jumpTo({ center: toLonLat(viewState.center), zoom: zoomOL - 1,
 *                bearing: -viewState.rotation })
 *     (el `-1` es porque MapLibre cuenta con teselas de 512 px y OL de 256) y
 *     devuelve el contenedor de MapLibre para que OL lo pinte en su sitio;
 *   - la opacidad de la capa se aplica al canvas (`canvas.style.opacity`);
 *   - `disableBackgroundColor` pone la capa `background` del estilo en
 *     `transparent` (true) o en `#f2f2f2` (false).
 *
 *
 * LO MISMO, EN CESIUM
 *
 * Cesium no tiene un "renderer de capa" al que devolver un DOM, así que el
 * equivalente es un overlay: el mismo div absoluto, colgado del contenedor del
 * widget de Cesium (encima del canvas del globo y por debajo de la interfaz de
 * la API) y con `pointer-events: none` para que Cesium siga recibiendo el ratón.
 * La vista se sincroniza en `scene.postRender`.
 *
 * Las cuentas no son las de OL (`viewState` no existe aquí) y están medidas:
 *
 *   - CENTRO: intersección del rayo del centro de pantalla con el terreno
 *     (`scene.globe.pick`, con el elipsoide como reserva). En la capa se usa su
 *     longitud/latitud.
 *   - ZOOM: se mide la escala en el centro: se lanzan dos rayos separados `k`
 *     píxeles en horizontal y se calcula el metro/píxel con la distancia
 *     geodésica entre los dos puntos del terreno. Con `78271.51696399994`
 *     (circunferencia / 512) sale el zoom de MapLibre:
 *     zoom = log2(78271.51696399994 · cos(lat) / mpp).
 *   - RUMBO: acimut geodésico del centro al punto que está `k` px más arriba en
 *     pantalla, que es justo lo que MapLibre llama `bearing` ("qué dirección
 *     queda arriba"). Medido en un giro de 40°: 39,9°.
 *   - INCLINACIÓN: `90 + pitch` de Cesium (nadir -90° = 0 en MapLibre).
 *
 * CUÁNTO CUADRA (medido comparando `map.project()` con
 * `Cesium.SceneTransforms.worldToWindowCoordinates()` de los mismos puntos):
 * 0-1 px en vista vertical, 0-2 px girando 40° y 0-1 px con 52° de inclinación,
 * en puntos de hasta 7 km del centro. Al medir hay que tener en cuenta la
 * ALTURA: los puntos de comparación van sobre el MDT (`globe.getHeight`) y no a
 * altura 0, porque el terreno de Madrid está a ~650 m y esa paralaje sale como
 * un 3,4 % de error de escala si se compara contra el elipsoide.
 *
 * Lo que no hace: no drapea el MDT (el overlay es un mapa plano, pintado por
 * encima del terreno) y no atiende clics (`interactive: false`, igual que en
 * OL); como el div no captura el ratón, Cesium sigue recibiendo todo.
 *
 * La librería no viene en la build de Cesium (medido: allí solo queda el
 * nombre de la clase `maplibregl-canvas` en el helper de impresión), así que se
 * trae de jsDelivr bajo demanda, como el resto de dependencias del proyecto.
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * La librería
   * ------------------------------------------------------------------ */

  const VERSION_MAPLIBRE = '5.24.0';
  const URL_MAPLIBRE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@' + VERSION_MAPLIBRE + '/dist/maplibre-gl.js';
  const URL_MAPLIBRE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@' + VERSION_MAPLIBRE + '/dist/maplibre-gl.css';

  let promesaMaplibre = null;

  /**
   * Deja MapLibre GL JS disponible en `window.maplibregl`, cargándolo la
   * primera vez. La promesa se comparte entre todas las capas.
   * @returns {Promise<Object>} El namespace `maplibregl`.
   */
  function cargarMaplibre() {
    if (promesaMaplibre) return promesaMaplibre;

    promesaMaplibre = new Promise((resolve, reject) => {
      if (window.maplibregl) {
        resolve(window.maplibregl);
        return;
      }

      if (!document.querySelector('link[data-maplibre-gl]')) {
        const enlace = document.createElement('link');
        enlace.rel = 'stylesheet';
        enlace.href = URL_MAPLIBRE_CSS;
        enlace.setAttribute('data-maplibre-gl', VERSION_MAPLIBRE);
        (document.head || document.documentElement).appendChild(enlace);
      }

      const script = document.createElement('script');
      script.src = URL_MAPLIBRE_JS;
      script.async = true;
      script.onload = () => {
        if (window.maplibregl) resolve(window.maplibregl);
        else reject(new Error('maplibre-gl no ha dejado window.maplibregl'));
      };
      script.onerror = () => reject(new Error('no se pudo cargar ' + URL_MAPLIBRE_JS));
      (document.head || document.documentElement).appendChild(script);
    });

    // Si falla (sin red, CDN caído...) se permite reintentar en la siguiente capa.
    promesaMaplibre.catch(() => { promesaMaplibre = null; });
    return promesaMaplibre;
  }

  /* ------------------------------------------------------------------ *
   * Constantes de la sincronización
   * ------------------------------------------------------------------ */

  // Metros por píxel a zoom 0 y ecuador con teselas de 512 px:
  // 40075016.685578488 / 512. Es la misma constante que usa MapLibre.
  const METROS_POR_PIXEL_ZOOM_0 = 78271.51696399994;

  // Separación (px) de los dos rayos con los que se mide escala y rumbo. Si se
  // acerca al borde se reduce, para que los tres rayos caigan dentro.
  const PIXELES_MEDIDA = 100;

  // Tolerancias para no llamar a `jumpTo` si la cámara no se ha movido.
  const EPS_POSICION = 1e-3;     // metros
  const EPS_ANGULO = 1e-6;       // radianes

  /**
   * Acimut (radianes) del punto 1 al punto 2. Se calcula a mano porque
   * `EllipsoidGeodesic.initialBearing` no está expuesto en la build de Cesium
   * (medido: devuelve `undefined`).
   * @param {number} lon1 Longitud en grados.
   * @param {number} lat1 Latitud en grados.
   * @param {number} lon2 Longitud en grados.
   * @param {number} lat2 Latitud en grados.
   * @returns {number} Acimut en radianes.
   */
  function acimut(lon1, lat1, lon2, lat2) {
    const f1 = lat1 * Math.PI / 180;
    const f2 = lat2 * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dl) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return Math.atan2(y, x);
  }

  /* ------------------------------------------------------------------ *
   * La implementación
   *
   * Hereda de la implementación base de Cesium (la de la que cuelga
   * `IDEE.impl.layer.Vector`), que es la que trae el contrato de capa:
   * `setVisible`, `setOpacity`, `destroy`, el emisor de eventos, etc.
   * ------------------------------------------------------------------ */

  /**
   * @param {Function} BaseImpl Implementación base de Cesium.
   * @returns {Function} Clase de implementación de la capa MapLibre.
   */
  function crearImplementacion(BaseImpl) {
    return class MapLibreImplCesium extends BaseImpl {
      constructor(parameters, options, vendorOptions) {
        super(options || {}, vendorOptions || {});

        const p = parameters || {};
        const o = options || {};

        this.url = p.url;
        this.maplibrestyle = p.maplibrestyle;
        this.estilo = leerEstilo(p.style);
        this.extract = p.extract === undefined ? true : p.extract;
        this.template = p.template;
        this.projection_ = p.projection || 'EPSG:3857';
        this.disableBackgroundColor = o.disableBackgroundColor !== undefined
          ? o.disableBackgroundColor
          : p.disableBackgroundColor;

        // La API llama `visible` al parámetro de la capa; la base de Cesium mira
        // `visibility`. Se respetan los dos.
        if (p.visible === false || o.visible === false) this.visibility = false;

        this.overlay_ = null;
        this.mapLibre_ = null;
        this.viewer_ = null;
        this.escuchaPostRender_ = null;
        this.camaraPrevia_ = null;
      }

      // ── Ciclo de vida ────────────────────────────────────────────────────

      addTo(map) {
        this.map = map;
        cargarMaplibre()
          .then(() => this.crearMapa_())
          .catch((e) => console.error('maplibreLayer: no se pudo crear la capa', e));
      }

      destroy() {
        if (this.escuchaPostRender_) {
          try { this.escuchaPostRender_(); } catch (e) { /* defensivo */ }
          this.escuchaPostRender_ = null;
        }
        if (this.mapLibre_) {
          try { this.mapLibre_.remove(); } catch (e) { /* defensivo */ }
          this.mapLibre_ = null;
        }
        if (this.overlay_ && this.overlay_.parentNode) {
          this.overlay_.parentNode.removeChild(this.overlay_);
        }
        this.overlay_ = null;
        this.viewer_ = null;
        this.camaraPrevia_ = null;
        this.map = null;
      }

      // ── Construcción del overlay ─────────────────────────────────────────

      /**
       * Crea el div y el mapa de MapLibre. Es async porque la librería se carga
       * bajo demanda; cuando llega aquí ya está en `window.maplibregl`.
       */
      crearMapa_() {
        if (this.mapLibre_ || !this.map) return;

        const viewer = this.map.getMapImpl();
        if (!viewer || !viewer.cesiumWidget || !viewer.cesiumWidget.container) {
          console.warn('maplibreLayer: el mapa no es Cesium, no se crea el overlay');
          return;
        }
        this.viewer_ = viewer;

        // Antes de crear nada se comprueba que hay estilo: sin él, MapLibre
        // lanza. Se hace aquí para no dejar un div colgado si falta.
        const estilo = this.estiloMapaLibre_();
        if (!estilo) {
          console.warn('maplibreLayer: la capa no tiene estilo (url, maplibrestyle o vendorOptions.mapLibreOptions.style)');
          return;
        }

        // El overlay va dentro del contenedor del widget (encima del canvas del
        // globo, debajo de `.m-areas`, que cuelga del contenedor del mapa) y no
        // captura el ratón: Cesium tiene que seguir recibiendo clics, rueda y
        // arrastre.
        const div = document.createElement('div');
        div.className = 'm-maplibre-cesium';
        div.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;'
          + 'pointer-events:none;z-index:2;';
        viewer.cesiumWidget.container.appendChild(div);
        this.overlay_ = div;

        this.mapLibre_ = new window.maplibregl.Map(this.opcionesMapaLibre_(estilo));
        this.mapLibre_.on('style.load', () => this.aplicarFondo_());

        // Sincronización con la cámara. `postRender` se dispara en cada frame
        // (medido: `requestRenderMode` está desactivado en la API), pero el
        // trabajo pesado solo se hace cuando la cámara ha cambiado.
        this.escuchaPostRender_ = viewer.scene.postRender.addEventListener(() => this.sincronizar_());

        this.sincronizar_(true);
        this.setOpacity(this.opacity_);
        this.setVisible(this.visibility);
      }

      /**
       * Estilo de la capa: el de `vendorOptions.mapLibreOptions` si lo trae, si no
       * la URL, el estilo ya resuelto (`maplibrestyle`) o el estilo serializado
       * que la API usa en los enlaces compartidos. Igual que en 2D.
       * @returns {string|Object|undefined}
       */
      estiloMapaLibre_() {
        const vendor = (this.vendorOptions_ && this.vendorOptions_.mapLibreOptions) || {};
        return vendor.style || this.url || this.maplibrestyle || this.estilo;
      }

      /**
       * Opciones del `maplibregl.Map`.
       * @param {string|Object} estilo Estilo ya resuelto.
       * @returns {Object}
       */
      opcionesMapaLibre_(estilo) {
        const vendor = (this.vendorOptions_ && this.vendorOptions_.mapLibreOptions) || {};
        return Object.assign({}, vendor, {
          container: this.overlay_,
          style: estilo,
          interactive: false,
          attributionControl: false,
          trackResize: false
        });
      }

      // ── Sincronización con la cámara de Cesium ───────────────────────────

      /**
       * Ajusta el mapa de MapLibre a la vista de Cesium.
       * @param {boolean} [forzar] Si es true no se comprueba si la cámara cambió.
       */
      sincronizar_(forzar) {
        const map = this.mapLibre_;
        const viewer = this.viewer_;
        if (!map || !viewer) return;

        const lienzo = viewer.canvas;
        const ancho = lienzo.clientWidth;
        const alto = lienzo.clientHeight;
        if (!ancho || !alto) return;

        // MapLibre no gestiona su tamaño (`trackResize: false`), así que se le
        // avisa cuando el canvas de Cesium cambia (redimensionar la ventana).
        const lienzoLibre = map.getCanvas();
        if (lienzoLibre.clientWidth !== ancho || lienzoLibre.clientHeight !== alto) {
          map.resize();
        }

        const camara = viewer.camera;
        const posicion = camara.position;
        const previa = this.camaraPrevia_;
        if (!forzar && previa
          && Math.abs(posicion.x - previa.x) < EPS_POSICION
          && Math.abs(posicion.y - previa.y) < EPS_POSICION
          && Math.abs(posicion.z - previa.z) < EPS_POSICION
          && Math.abs(camara.heading - previa.heading) < EPS_ANGULO
          && Math.abs(camara.pitch - previa.pitch) < EPS_ANGULO) {
          return;
        }
        this.camaraPrevia_ = { x: posicion.x, y: posicion.y, z: posicion.z, heading: camara.heading, pitch: camara.pitch };

        const vista = this.vistaDesdeCamara_(viewer, ancho, alto);
        if (!vista) return;

        map.jumpTo({
          center: [vista.lon, vista.lat],
          zoom: vista.zoom,
          bearing: vista.rumbo,
          pitch: vista.inclinacion
        });
      }

      /**
       * Traduce la cámara de Cesium a los parámetros de `jumpTo`.
       * @param {Object} viewer El `Cesium.Viewer`.
       * @param {number} ancho Ancho del canvas en píxeles CSS.
       * @param {number} alto Alto del canvas en píxeles CSS.
       * @returns {Object|null} `{lon, lat, zoom, rumbo, inclinacion}` o null.
       */
      vistaDesdeCamara_(viewer, ancho, alto) {
        const Cesium = window.Cesium;
        if (!Cesium) return null;

        const escena = viewer.scene;
        const camara = viewer.camera;
        const k = Math.max(20, Math.min(PIXELES_MEDIDA, Math.floor(Math.min(ancho, alto) / 4)));

        const centro = this.puntoSuelo_(escena, camara, ancho / 2, alto / 2);
        const derecha = this.puntoSuelo_(escena, camara, ancho / 2 + k, alto / 2);
        const arriba = this.puntoSuelo_(escena, camara, ancho / 2, alto / 2 - k);
        if (!centro || !derecha || !arriba) return null;

        const c0 = Cesium.Cartographic.fromCartesian(centro);
        const c1 = Cesium.Cartographic.fromCartesian(derecha);
        const c2 = Cesium.Cartographic.fromCartesian(arriba);

        const lon = Cesium.Math.toDegrees(c0.longitude);
        const lat = Cesium.Math.toDegrees(c0.latitude);

        const distancia = new Cesium.EllipsoidGeodesic(c0, c1).surfaceDistance;
        if (!(distancia > 0)) return null;
        const metrosPorPixel = distancia / k;

        const inclinacion = Cesium.Math.toDegrees(camara.pitch) + 90;

        return {
          lon: lon,
          lat: lat,
          zoom: Math.log2(METROS_POR_PIXEL_ZOOM_0 * Math.cos(lat * Math.PI / 180) / metrosPorPixel),
          rumbo: Cesium.Math.toDegrees(acimut(lon, lat, Cesium.Math.toDegrees(c2.longitude), Cesium.Math.toDegrees(c2.latitude))),
          inclinacion: Math.max(0, Math.min(85, inclinacion))
        };
      }

      /**
       * Punto del terreno (o del elipsoide) bajo un píxel.
       * @param {Object} escena La escena de Cesium.
       * @param {Object} camara La cámara de Cesium.
       * @param {number} x Píxel horizontal.
       * @param {number} y Píxel vertical.
       * @returns {Object|null} `Cesium.Cartesian3` o null si el rayo no toca.
       */
      puntoSuelo_(escena, camara, x, y) {
        const Cesium = window.Cesium;
        const ventana = new Cesium.Cartesian2(x, y);
        let punto = null;
        try {
          punto = escena.globe.pick(camara.getPickRay(ventana), escena);
        } catch (e) {
          punto = null;
        }
        if (!punto) {
          try {
            punto = camara.pickEllipsoid(ventana, escena.globe.ellipsoid);
          } catch (e) {
            punto = null;
          }
        }
        return punto;
      }

      // ── Visibilidad, opacidad y orden ────────────────────────────────────

      setVisible(visible) {
        this.visibility = visible;
        if (this.overlay_) this.overlay_.style.display = visible ? 'block' : 'none';
      }

      isVisible() {
        return this.visibility;
      }

      setOpacity(opacidad) {
        const valor = typeof opacidad === 'string' ? Number(opacidad) : opacidad;
        this.opacity_ = valor;
        if (this.mapLibre_) this.mapLibre_.getCanvas().style.opacity = String(valor);
      }

      getOpacity() {
        return this.opacity_;
      }

      // El overlay no está en `imageryLayers`: el orden lo da el DOM (la capa
      // que se añade después queda encima). Se guarda el valor y no se toca nada
      // para que `setZIndex` de la base no intente recolocar una capa que no
      // existe.
      setZIndex(zindex) {
        this.zIndex_ = zindex;
      }

      getZIndex() {
        return this.zIndex_;
      }

      // ── Estilo ───────────────────────────────────────────────────────────

      /**
       * Aplica `disableBackgroundColor` a la capa `background` del estilo, igual
       * que la implementación de OpenLayers: `true` deja el fondo transparente
       * (para pintar sobre el mapa de Cesium) y `false` lo pone opaco (la capa
       * funciona como capa base).
       *
       * Si el estilo no tiene capa `background` no se hace nada. Medido: el estilo
       * de BTN Completa no la tiene (0 capas de fondo de 337), y en 2D eso le
       * revienta a la implementación de OpenLayers, que hace
       * `getStyle().layers.find(l => l.type === 'background').id` sin comprobar el
       * resultado (TypeError: no se puede leer 'id' de undefined, en
       * apiidee-1.1.0.ol.min.js). Aquí se comprueba.
       */
      aplicarFondo_() {
        if (!this.mapLibre_ || this.disableBackgroundColor === undefined) return;
        let capaFondo = null;
        try {
          capaFondo = (this.mapLibre_.getStyle().layers || []).find((l) => l.type === 'background');
        } catch (e) {
          return;
        }
        if (!capaFondo) return;

        const color = this.disableBackgroundColor === true ? 'transparent' : '#f2f2f2';
        try {
          this.mapLibre_.setPaintProperty(capaFondo.id, 'background-color', color);
        } catch (e) { /* el estilo aún no está listo */ }
      }

      setStyleMap(estilo) {
        if (!this.mapLibre_) return;
        try {
          this.mapLibre_.setStyle(estilo);
        } catch (e) {
          console.warn('maplibreLayer: no se pudo aplicar el estilo', e);
        }
      }

      getMapLibreStyleFromId(ids) {
        if (!this.mapLibre_) return [];
        const capas = (this.mapLibre_.getStyle() || {}).layers || [];
        return (ids && ids.length) ? capas.filter((c) => ids.indexOf(c.id) !== -1) : capas;
      }

      setPaintProperty(capa, propiedad, valor) {
        if (!this.mapLibre_) return;
        try { this.mapLibre_.setPaintProperty(capa, propiedad, valor); } catch (e) { /* defensivo */ }
      }

      setLayoutProperty(capa, propiedad, valor) {
        if (!this.mapLibre_) return;
        try { this.mapLibre_.setLayoutProperty(capa, propiedad, valor); } catch (e) { /* defensivo */ }
      }

      // ── Consultas ────────────────────────────────────────────────────────

      getProjection() {
        return this.projection_;
      }

      /**
       * Entidades pintadas ahora mismo. Son entidades de MapLibre, no de la API:
       * la capa no tiene geometrías propias (no hay teselas decodificadas a
       * mano), y `getGeometryType()` devuelve null.
       * @returns {Array}
       */
      getFeatures() {
        if (!this.mapLibre_) return [];
        try { return this.mapLibre_.queryRenderedFeatures(); } catch (e) { return []; }
      }

      getFeatureById(id) {
        return this.getFeatures().filter((f) => f && ((f.properties && f.properties.id === id) || f.id === id));
      }
    };
  }

  /**
   * Estilo serializado (base64) que la API usa en los enlaces compartidos.
   * @param {string} estilo Texto en base64.
   * @returns {Object|null} El estilo, o null si no hay o no se puede leer.
   */
  function leerEstilo(estilo) {
    if (typeof estilo !== 'string' || !estilo) return null;
    try {
      return JSON.parse(decodeURIComponent(escape(window.atob(estilo.replace(' ', '+')))));
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * La fachada
   *
   * Sustituye a `IDEE.layer.MapLibre`. Hereda de la MISMA clase base que la
   * fachada del bundle (para no perder nada del contrato de capa) y replica sus
   * miembros públicos, que son los que usan los visualizadores y la propia API.
   * ------------------------------------------------------------------ */

  /**
   * @param {Function} Base Clase base de la fachada del bundle.
   * @param {Function} Impl Implementación creada con `crearImplementacion`.
   * @returns {Function} Clase que se registra como `IDEE.layer.MapLibre`.
   */
  function crearFachada(Base, Impl) {
    class FachadaMapLibre extends Base {
      constructor(parameters, options, vendorOptions) {
        const params = Object.assign({}, parameters || {}, options || {});
        params.type = 'MapLibre';
        if (params.maxExtent) {
          params.maxExtent = undefined;
          console.warn('La propiedad maxExtent no está soportada en las capas MapLibre');
        }

        const impl = new Impl(params, options || {}, vendorOptions || {});
        super(params, impl);
        impl.facade = this;

        this.constructorParameters = { parameters: parameters, options: options, vendorOptions: vendorOptions };
        this.infoEventType = params.infoEventType || 'click';
        this.disableBackgroundColor = options && options.disableBackgroundColor !== undefined
          ? options.disableBackgroundColor
          : undefined;

        // Los setters de la fachada escriben en la implementación.
        this.extract = params.extract === undefined ? true : params.extract;
        this.template = params.template;
        this.maplibrestyle = params.maplibrestyle;

        this.minZoom = (options && options.minZoom) || Number.NEGATIVE_INFINITY;
        this.maxZoom = (options && options.maxZoom) || Number.POSITIVE_INFINITY;
      }

      get extract() {
        return this.getImpl().extract;
      }

      set extract(valor) {
        // Mismo trato que la fachada del bundle: sin valor, `true`; y los textos
        // ('true'/'false') se convierten, porque los parámetros pueden venir de
        // atributos HTML.
        if (valor === undefined) {
          this.getImpl().extract = true;
        } else if (typeof valor === 'string') {
          this.getImpl().extract = valor.trim() === 'true';
        } else {
          this.getImpl().extract = valor;
        }
      }

      get template() {
        return this.getImpl().template;
      }

      set template(valor) {
        this.getImpl().template = valor;
      }

      get maplibrestyle() {
        return this.getImpl().maplibrestyle;
      }

      set maplibrestyle(valor) {
        if (valor === undefined) return;
        this.getImpl().maplibrestyle = valor;
        if (this.getImpl().getLayer && this.getImpl().getLayer()) this.getImpl().setStyleMap(valor);
      }

      get url() {
        return this.getImpl().url;
      }

      set url(valor) {
        if (valor === undefined) return;
        this.getImpl().url = valor;
        if (this.getImpl().getLayer && this.getImpl().getLayer()) this.getImpl().setStyleMap(valor);
      }

      getStyle() {
        return undefined;
      }

      setMaxExtent() { /* no soportado */ }

      setFilter() { /* no soportado */ }

      addFeatures() { /* no soportado */ }

      removeFeatures() { /* no soportado */ }

      refresh() { /* no soportado */ }

      redraw() { /* no soportado */ }

      toGeoJSON() { /* no soportado */ }

      getFeatureById(id) {
        return this.getImpl().getFeatureById(id);
      }

      setMapLibreStyleFromId(lista) {
        if (!Array.isArray(lista)) return;
        lista.forEach(({ id, paint, layout }) => {
          if (paint) paint.forEach(({ property, value }) => this.setPaintProperty(id, property, value));
          if (layout) layout.forEach(({ property, value }) => this.setLayoutProperty(id, property, value));
        });
      }

      getMapLibreStyleFromId(ids) {
        return this.getImpl().getMapLibreStyleFromId(ids || []);
      }

      setPaintProperty(capa, propiedad, valor) {
        this.getImpl().setPaintProperty(capa, propiedad, valor);
      }

      setLayoutProperty(capa, propiedad, valor) {
        this.getImpl().setLayoutProperty(capa, propiedad, valor);
      }

      getProjection() {
        return this.getImpl().getProjection();
      }

      getGeometryType() {
        return null;
      }

      getFeatures() {
        return this.getImpl().getFeatures();
      }

      equals(otra) {
        let igual = false;
        if (otra instanceof FachadaMapLibre) {
          igual = this.url === otra.url;
          igual = igual && this.name === otra.name;
          igual = igual && this.idLayer === otra.idLayer;
          igual = igual && this.template === otra.template;
        }
        return igual;
      }
    }

    return FachadaMapLibre;
  }

  /* ------------------------------------------------------------------ *
   * Instalación
   *
   * Es un parche de arranque, no un plugin: tiene que estar puesto antes de que
   * `mapa()` cree capas (las capas base y las rápidas se resuelven ahí). Se
   * aplica al cargar el script, se reintenta cada 10 ms mientras la build de
   * Cesium no exista y se re-aplica cuando termina de ejecutarse el <script> de
   * la build (el cambio 2D/3D la recarga y `window.IDEE` es un objeto nuevo).
   * ------------------------------------------------------------------ */

  let fachadaInstalada = null;

  /**
   * ¿Es una capa MapLibre de las nuestras? Por tipo (el de la API) o por clase.
   * @param {Object} capa Facade de capa.
   * @returns {boolean}
   */
  function esCapaMapLibre(capa) {
    if (!capa) return false;
    if (fachadaInstalada && capa instanceof fachadaInstalada) return true;
    return capa.type === 'MapLibre';
  }

  /**
   * Parchea la implementación del mapa para que sepa qué hacer con una capa
   * `MapLibre`.
   *
   * Medido: `IDEE.impl.Map.addLayers` mira el tipo y solo tiene rama para WMS,
   * WMTS, KML, WFS, OGCAPIFeatures, MBTiles, XYZ, TMS, Tiles3D y Terrain; para
   * el resto hace `know(tipo) || (addUnknowLayers_ + facadeMap_.addUnknowLayers_)`,
   * y en la lista de `know` del módulo de tipos están MVT y MapLibre... pero sin
   * rama. O sea que una capa `MapLibre` se ignora EN SILENCIO: no se anade, no
   * aparece en `getLayers()` y no dispara el `addTo` de su implementación.
   * (`Vector` no está en `know`, y por eso las capas de ext/MVTLayer sí entran
   * por la vía de las no clasificadas.)
   *
   * Aquí se hace lo mismo que hace el propio impl con las capas que no conoce:
   * `addUnknowLayers_` la mete en `layers_` y llama a `getImpl().addTo()`, y
   * `facadeMap_.addUnknowLayers_` dispara el evento de capa anadida. Lo mismo en
   * la retirada, porque `removeLayers` reparte por tipo y tampoco tiene rama para
   * `MapLibre`: sin esto la capa se quedaría en el mapa.
   *
   * Y como `getUnknowLayers_` filtra por `!know(tipo)`, la capa entraría en
   * `layers_` pero no saldría en `getLayers()` (que arma la lista con los getters
   * por tipo más ese cajón): se parchea también para que la incluya.
   *
   * @param {Function} ImplMap Implementación del mapa de Cesium.
   */
  function parchearMapaImpl(ImplMap) {
    if (!ImplMap || !ImplMap.prototype) return;
    const proto = ImplMap.prototype;
    if (proto.__maplibreLayerParche) return;

    const addLayersOriginal = proto.addLayers;
    const removeLayersOriginal = proto.removeLayers;
    const getUnknowLayersOriginal = proto.getUnknowLayers_;
    if (typeof addLayersOriginal !== 'function' || typeof removeLayersOriginal !== 'function'
      || typeof getUnknowLayersOriginal !== 'function') return;

    proto.addLayers = function (capas) {
      const lista = Array.isArray(capas) ? capas : (capas === undefined ? [] : [capas]);
      const nuestras = lista.filter(esCapaMapLibre);
      const resto = lista.filter((c) => nuestras.indexOf(c) === -1);

      nuestras.forEach((capa) => {
        try {
          this.addUnknowLayers_([capa]);
          this.facadeMap_.addUnknowLayers_(capa);
        } catch (e) {
          console.warn('maplibreLayer: no se pudo anadir la capa al mapa', e);
        }
      });

      if (resto.length) addLayersOriginal.call(this, resto);
      return this;
    };

    proto.removeLayers = function (capas) {
      const lista = Array.isArray(capas) ? capas : (capas === undefined ? [] : [capas]);
      const nuestras = lista.filter(esCapaMapLibre);

      if (nuestras.length) {
        try {
          this.removeUnknowLayers_(nuestras);   // quita de `layers_` y llama a `destroy()`
        } catch (e) {
          console.warn('maplibreLayer: no se pudo quitar la capa del mapa', e);
        }
      }

      // Se le pasa la lista entera para que la API dispare sus eventos con
      // todas las capas; de las nuestras ya no queda nada que quitar.
      return removeLayersOriginal.call(this, lista);
    };

    proto.getUnknowLayers_ = function (filtro) {
      const lista = getUnknowLayersOriginal.call(this, filtro) || [];
      (this.layers_ || []).forEach((capa) => {
        if (!esCapaMapLibre(capa) || lista.indexOf(capa) !== -1) return;
        if (filtro !== undefined && filtro !== null) {
          // El filtro de este getter es un objeto con nombre/tipo (o una capa).
          const nombre = (filtro && filtro.name) || null;
          const tipo = (filtro && filtro.type) || null;
          if (nombre && capa.name !== nombre) return;
          if (tipo && capa.type !== tipo) return;
        }
        lista.push(capa);
      });
      return lista;
    };

    proto.__maplibreLayerParche = true;
  }

  /**
   * Devuelve la API solo si la implementación activa es Cesium. En 2D no se
   * toca nada: allí la capa la implementa OpenLayers y funciona.
   * @returns {Object|null}
   */
  function apiCesium() {
    const IDEE = window.IDEE || window.M;
    if (IDEE && IDEE.impl && IDEE.impl.cesium && IDEE.layer && IDEE.impl.layer) return IDEE;
    return null;
  }

  function aplicarParche() {
    const IDEE = apiCesium();
    if (!IDEE) return false;
    if (typeof IDEE.layer.MapLibre !== 'function' || typeof IDEE.impl.layer.Vector !== 'function') return false;

    // La implementación del mapa tiene que saber enrutar una capa `MapLibre`.
    parchearMapaImpl(IDEE.impl.Map);

    if (IDEE.layer.MapLibre !== fachadaInstalada) {
      try {
        // La fachada del bundle cuelga de una clase base que no está expuesta:
        // se toma de su prototipo. La implementación, igual, de la base de la
        // que cuelga `IDEE.impl.layer.Vector`.
        const BaseFachada = Object.getPrototypeOf(IDEE.layer.MapLibre.prototype).constructor;
        const BaseImpl = Object.getPrototypeOf(IDEE.impl.layer.Vector.prototype).constructor;

        fachadaInstalada = crearFachada(BaseFachada, crearImplementacion(BaseImpl));
        IDEE.layer.MapLibre = fachadaInstalada;
        if (window.M && window.M.layer && window.M.layer !== IDEE.layer) {
          window.M.layer.MapLibre = fachadaInstalada;
        }
      } catch (e) {
        console.warn('maplibreLayer: no se pudo instalar la fachada MapLibre', e);
        fachadaInstalada = null;
      }
    }

    return IDEE.layer.MapLibre === fachadaInstalada;
  }

  aplicarParche();
  setInterval(aplicarParche, 10);

  // Detección del cambio de build: el plugin 2D/3D reemplaza el <script> de la
  // build y, cuando termina de ejecutarse, `window.IDEE` ya es la nueva. Aplicar
  // aquí elimina la carrera con la re-ejecución de `mapa()`.
  if (document.addEventListener) {
    document.addEventListener('load', (e) => {
      const objetivo = e && e.target;
      if (objetivo && objetivo.tagName === 'SCRIPT' && /apiidee.*cesium/i.test(objetivo.src || '')) {
        aplicarParche();
      }
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * Exposición
   * ------------------------------------------------------------------ */

  window.maplibreLayer = {
    cargar: cargarMaplibre,
    version: VERSION_MAPLIBRE,
    /**
     * Fachada instalada (para depurar desde la consola).
     * @returns {Function|null}
     */
    fachada: () => fachadaInstalada
  };
})();
