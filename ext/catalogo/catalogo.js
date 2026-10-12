/* =====================================================================
   CATALOGO: plugin para API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   QUÉ ES
   ---------------------------------------------------------------------
   Un catálogo de servicios y capas que se pueden cargar en el visualizador
   de dos maneras:

     1. LISTADO PREDEFINIDO: cada tipo de catálogo trae sus propios
        servicios (WMS, WMTS, WFS, GeoJSON...) ya escritos, para no tener
        que saberse la URL de memoria. Se cambia de catálogo con un
        <select> y cada uno tiene su propia sección.

     2. AÑADIR POR URL: un botón abre un cuadro donde el usuario pega la
        URL de un servicio o de un archivo publicado por http/https, y el
        plugin la carga en el mapa.

   LOS TIPOS DE CATÁLOGO (objeto IDEE.catalog)
   ---------------------------------------------------------------------
   `IDEE.catalog` es el registro de tipos. Cada tipo sabe:
     - listar()        -> sus secciones (IDEE) o sus servicios fijos (STAC...)
     - cargarUrl(...)  -> qué capas crea a partir de una URL

   Tipos (ver CATALOGOS más abajo):
     - 'idee'           Catálogo IDEE, por secciones y tipo de servicio
     - 'stac'           STAC (SpatioTemporal Asset Catalog)
     - 'ogcapi-records' OGC API Records

   FICHEROS DEL PLUGIN
   ---------------------------------------------------------------------
     - catalogo.js      El plugin: interfaz, estado y carga.
     - catalogo_idee.js Cliente del catálogo de la IDEE (secciones y parseo),
                        adaptación del complemento de QGIS serviciosIDEE2QGIS.
     - catalogo_url.js  Detección del tipo de capa a partir de una URL, lectura
                        del documento de capacidades y creación de la capa.

   ESTADO DE DESARROLLO
   ---------------------------------------------------------------------
   Está hecho el circuito completo: el catálogo de la IDEE se pide por secciones
   al portal y se filtra; una URL se analiza, se lee su documento de
   capacidades y se eligen las capas y el nombre antes de cargarla.

   PATRONES DEL REPOSITORIO (ver ext/plantilla_plugin)
   ---------------------------------------------------------------------
   - Clase ES6 `miPlugin_catalogo` con constructor(options) + addTo(map),
     para poder registrarla con mapajs.addPlugin(new miPlugin_catalogo(...)).
   - Exposición triple al final (window, IDEE.plugin y M.plugin) para que
     sobreviva a la recarga del bundle de la API en el cambio 2D/3D.
   - Contrato de estado getState / setState para conservar la UI en el swap.
   - Colores color1/color2/color3 con los valores por defecto del repo.
   - Icono como MÁSCARA (--g-plugin-icon-mask), nunca con color escrito.
   ===================================================================== */

(function () {
  "use strict";

  /**
   * Resuelve el objeto global de la API cartográfica (IDEE en builds modernas
   * o M en builds históricos/compatibilidad).
   * @returns {Object} Espacio de nombres de la API-IDEE / API-CNIG.
   */
  function api() {
    return window.IDEE || window.M;
  }

  /**
   * Envuelve contenido suelto de un SVG en un `<svg>` de 24x24, que es la medida
   * en la que vienen dibujados casi todos los iconos.
   * @param {string} contenido Contenido interior del SVG.
   * @returns {string} SVG completo.
   */
  function envolverSvg(contenido) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
      + contenido + '</svg>';
  }

  /**
   * Prepara un SVG para meterlo en un data URI: codifica lo que
   * `encodeURIComponent` deja fuera y que ahí rompe la URL.
   * @param {string} svg SVG completo.
   * @returns {string} SVG listo para el data URI.
   */
  function codificarSvg(svg) {
    return encodeURIComponent(svg)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\'/g, '%27')
      .replace(/\+/g, '%20');
  }

  /**
   * Convierte el icono que se pasa al constructor en algo que se pueda poner en
   * un `mask-image` de CSS, que es como se pinta el icono del botón.
   * @param {string} icono Icono en cualquiera de las tres formas.
   * @returns {string|null} `url("...")` listo para CSS, o null si no es válido.
   */
  function urlDeIcono(icono) {
    if (typeof icono !== 'string') return null;
    const limpio = icono.trim();
    if (!limpio) return null;

    // Es una URL o una ruta: se respeta tal cual (sin codificar el contenido).
    const esUrl = /^(data:|https?:|blob:|file:|\/|\.\/|\.\.\/)/i.test(limpio)
      || /\.svg(?:[?#].*)?$/i.test(limpio);
    if (esUrl) {
      return 'url("' + limpio.replace(/"/g, '%22').replace(/\s/g, '%20') + '")';
    }

    const traeSvg = /<svg[\s>]/i.test(limpio);
    const traeForma = /<(path|circle|rect|line|polyline|polygon|ellipse|g|use|symbol|text)\b/i.test(limpio);
    if (!traeSvg && !traeForma) {
      return null;
    }

    const svg = traeSvg ? limpio : envolverSvg(limpio);
    return 'url("data:image/svg+xml,' + codificarSvg(svg) + '")';
  }

  // =====================================================================
  //  IDEE.catalog: el registro de tipos de catálogo
  // =====================================================================
  // Cada tipo es un objeto con:
  //   id        Identificador (lo que vale en el <select>).
  //   nombre    Lo que se ve en el <select>.
  //   listar()  Devuelve los servicios predefinidos de ese catálogo:
  //             [{ nombre, url, tipo, descripcion? }]  (tipo: 'WMS', 'WMTS',
  //             'WFS', 'GeoJSON', 'KML'...).
  //   cargarUrl(url, map)  Carga esa URL en el mapa y devuelve la capa creada
  //             (o null si no supo qué hacer con ella).
  //
  // Para añadir un tipo nuevo basta con meterlo en CATALOGOS: el <select>, la
  // lista y el estado lo cogen solos.
  // =====================================================================

  // El catálogo IDEE ya NO lleva una lista escrita a mano: se pide al portal
  // de la IDEE por secciones (ver catalogo_idee.js). Lo que aquí queda son los
  // catálogos que son una lista corta y fija: STAC y OGC API Records.

  /**
   * Servicios predefinidos de STAC.
   * Catálogos STAC públicos con colecciones de imágenes (Sentinel, Landsat...).
   */
  const SERVICIOS_STAC = [
    {
      nombre: 'Copernicus Data Space (STAC)',
      url: 'https://catalogue.dataspace.copernicus.eu/stac',
      tipo: 'STAC',
      descripcion: 'Sentinel-1/2/3/5P y datos Copernicus'
    },
    {
      nombre: 'Earth Search (Element84, STAC)',
      url: 'https://earth-search.aws.element84.com/v1',
      tipo: 'STAC',
      descripcion: 'Landsat, Sentinel-2 y MODIS en AWS'
    },
    {
      nombre: 'Microsoft Planetary Computer (STAC)',
      url: 'https://planetarycomputer.microsoft.com/api/stac/v1',
      tipo: 'STAC',
      descripcion: 'Landsat, Sentinel, MODIS y mucho más'
    },
    {
      nombre: 'STAC del IGN (Catálogo PNOA)',
      url: 'https://api.stac.ign.es',
      tipo: 'STAC',
      descripcion: 'Vuelos históricos y PNOA del IGN'
    }
  ];

  /**
   * Servicios predefinidos de OGC API Records.
   * Catálogos de metadatos (CSW moderno) con registros descargables.
   */
  const SERVICIOS_OGCAPI = [
    {
      nombre: 'Catálogo central IDEE (OGC API Records)',
      url: 'https://www.ign.es/ogcapi-records',
      tipo: 'OGCAPI',
      descripcion: 'Metadatos de los servicios IDEE'
    },
    {
      nombre: 'Catálogo INSPIRE de España',
      url: 'https://inspire-geoportal.ec.europa.eu/services/NetworkService/rest/ogcapi-records',
      tipo: 'OGCAPI',
      descripcion: 'Registros INSPIRE europeos'
    },
    {
      nombre: 'Catálogo de datos.gob.es',
      url: 'https://datos.gob.es/ogcapi-records',
      tipo: 'OGCAPI',
      descripcion: 'Datos abiertos de la AGE'
    }
  ];

  /**
   * Los tipos de catálogo.
   *
   * Cada tipo declara cómo se pinta su sección de gestión en el panel:
   *
   *   - modo 'secciones'  El catálogo se pide por secciones (tipo de servicio).
   *                       Debajo del <select> sale un buscador y un acordeón
   *                       con las secciones; cada una, al abrirse, se pide.
   *                       Es lo que hace la IDEE, con sus diez secciones.
   *   - modo 'lista'      El catálogo es una lista corta y fija y se pinta
   *                       tal cual, como hasta ahora.
   *
   * Para añadir un tipo nuevo basta con meterlo en CATALOGOS: el <select>, la
   * sección de gestión y el estado lo cogen solos.
   */
  const CATALOGOS = {
    idee: {
      id: 'idee',
      nombre: 'Catálogo IDEE',
      modo: 'secciones',
      descripcion: 'Servicios publicados en el catálogo de la IDEE, por tipo.',
      listar: function () {
        // Las secciones las trae el cliente del catálogo (ver catalogo_idee.js).
        return (window.CatalogoIDEE && window.CatalogoIDEE.SECCIONES) || [];
      },
      cargarUrl: function (url, mapa, opciones) {
        return cargarUrlGenerica(url, mapa, opciones);
      }
    },
    stac: {
      id: 'stac',
      nombre: 'STAC',
      modo: 'lista',
      descripcion: 'Catálogos STAC con colecciones de imágenes.',
      listar: function () { return SERVICIOS_STAC; },
      cargarUrl: function (url, mapa, opciones) {
        return cargarUrlGenerica(url, mapa, opciones);
      }
    },
    'ogcapi-records': {
      id: 'ogcapi-records',
      nombre: 'OGC API Records',
      modo: 'lista',
      descripcion: 'Catálogos de metadatos (CSW moderno).',
      listar: function () { return SERVICIOS_OGCAPI; },
      cargarUrl: function (url, mapa, opciones) {
        return cargarUrlGenerica(url, mapa, opciones);
      }
    }
  };

  /**
   * Carga una URL en el mapa.
   *
   * La detección de tipo y la lectura de las capas del servicio están en
   * catalogo_url.js; aquí solo se le pasa lo que el usuario ha elegido en el
   * panel (qué capas y con qué nombre).
   *
   * @param {string} url URL pegada por el usuario.
   * @param {Object} mapa Instancia del mapa API-IDEE.
   * @param {Object} [opciones] { tipo, capas, nombre }.
   * @returns {Array<Object>} Las capas creadas, o [].
   */
  function cargarUrlGenerica(url, mapa, opciones) {
    const opts = opciones || {};
    const urlTool = window.CatalogoURL;
    if (!urlTool) {
      console.error('[catalogo] no está cargado catalogo_url.js');
      return [];
    }
    return urlTool.cargar({
      url: url,
      mapa: mapa,
      tipo: opts.tipo || urlTool.detectarTipo(url),
      capas: opts.capas && opts.capas.length ? opts.capas : null,
      nombre: opts.nombre || ''
    });
  }

  /**
   * Expone el registro de catálogos en IDEE.catalog (y en M.catalog, que es el
   * alias histórico). Así cualquier código puede hacer
   * `IDEE.catalog.tipos.idee.listar()` o crear un tipo nuevo.
   */
  function exponerCatalog() {
    const registro = {
      tipos: CATALOGOS,
      /** Devuelve el tipo de catálogo con ese id, o null. */
      tipo: function (id) { return CATALOGOS[id] || null; },
      /** Lista de ids de catálogo, en el orden del <select>. */
      ids: function () { return Object.keys(CATALOGOS); }
    };
    window.IDEE = window.IDEE || {};
    window.IDEE.catalog = registro;
    window.M = window.M || {};
    window.M.catalog = registro;
    return registro;
  }

  // =====================================================================
  //  Clase principal del plugin
  // =====================================================================
  class miPlugin_catalogo {
    /**
     * @param {Object} [options={}] Opciones de configuración.
     * @param {string} [options.position='TR'] Esquina del panel ('TL','TR','BL','BR').
     * @param {boolean} [options.collapsible=true] Si el panel se pliega a botón.
     * @param {number} [options.order=null] Orden del panel dentro de la esquina.
     * @param {Object|string} [options.color1] Color de fondo ({active,deactive} o string).
     * @param {Object|string} [options.color2] Color de borde.
     * @param {Object|string} [options.color3] Color de icono y texto.
     * @param {string} [options.icon] Icono del botón (SVG completo, contenido o URL).
     */
    constructor(options = {}) {
      this.name = 'miPlugin_catalogo';
      this.options = options || {};

      this._map = null;
      this._panel = null;
      this._control = null;

      // Configuración de visualización y posición del panel
      this.position = options.position || 'TR';
      this.collapsible = (options.collapsible !== undefined) ? Boolean(options.collapsible) : true;
      this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
        ? Number(options.order)
        : null;

      // Colores del esquema del repositorio
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

      this.icon = options.icon || options.icono || options.svg || null;

      // Título de la barra del panel (la cabecera .m-herramienta-header).
      this.title = options.title || 'Catálogo';

      // En TR el API mete el botón DENTRO del panel (a la izquierda) y la
      // cabecera queda partida; en TL lo deja fuera y la cabecera es a todo
      // ancho. Con esta marca el CSS recoloca la cabecera en TR para que el
      // panel se vea igual que los demás.
      this._esTR = (this.options.position === 'TR');

      // Estado interno
      this._tipoSeleccionado = 'idee';
      this._urlIntroducida = '';
      this._ultimoMensaje = null;
      // Pestaña activa del panel ('catalogos' o 'capa').
      this._pestanaActiva = options.pestana || 'catalogos';
      this._pestanas = {};
      this._panelCatalogos = null;
      this._panelCapa = null;

      // Catálogo: secciones abiertas, filtro de texto y datos ya pedidos.
      this._seccionesAbiertas = Array.isArray(options.secciones) ? options.secciones.slice() : [];
      this._filtro = options.filtro || '';
      this._seccionesDom = {};
      this._estadoSecciones = {};
      // Grupos plegables de la pestaña de catálogos ("disponibles" y "nuevo").
      this._gruposAbiertos = Array.isArray(options.grupos) ? options.grupos.slice() : ['disponibles', 'nuevo'];
      this._gruposDom = {};
      // Entradas ya consultadas de los catálogos dados de alta por el usuario.
      this._entradasPropias = {};
      this._analisis = null;

      // Referencias a la interfaz (se rellenan en _construirUI).
      this._gestorEl = null;
      this._opcionesEl = null;
      this._urlInputEl = null;
      this._selectorEl = null;
      this._capasListaEl = null;
      this._buscadorEl = null;
    }

    /** Normaliza un color a {active, deactive}. */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /** Pinta el icono del botón como máscara (ver plantilla_plugin). */
    _aplicarIcono(panelEl) {
      if (!panelEl || !panelEl.style) return;
      if (!this.icon) return;
      const url = urlDeIcono(this.icon);
      if (!url) {
        console.warn(this.name + ': el icono no parece un SVG ni una URL, se deja el de por defecto.');
        return;
      }
      try {
        panelEl.style.setProperty('--g-plugin-icon-mask', url);
      } catch (e) {
        console.warn(this.name + ': no se pudo aplicar el icono.', e);
      }
    }

    /** Ayuda del plugin (protocolo API-IDEE). */
    getHelp() {
      const IDEE = api();
      return {
        title: 'Catálogo de servicios y capas',
        content: new Promise((resolve) => {
          let html =
            '<div>' +
            '<p>Catálogo de servicios y capas para cargar en el visualizador.</p>' +
            '<p><strong>Catálogos</strong>: elige un tipo de catálogo y ' +
            'gestiónalo en la sección que sale debajo. El catálogo de la IDEE se ' +
            'pide por secciones (WMS estatal, WMS autonómico, WMS local, planos ' +
            'verticales, WMTS, XYZ, MVT, WFS, WCS y OGC API) al portal de la IDEE, ' +
            'y se filtra por servicio u organismo. Pulsa <strong>Cargar</strong> ' +
            'en el servicio que quieras.</p>' +
            '<p><strong>Añadir capa</strong>: pega la URL de un servicio o de un ' +
            'archivo publicado por http/https y pulsa <strong>Analizar</strong>. El ' +
            'plugin deduce el tipo de capa, lee las capas que ofrece el servicio y ' +
            'deja elegir cuáles cargar y con qué nombre.</p>' +
            '</div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            try { html = IDEE.utils.stringToHtml(html); } catch (e) { /* string plano */ }
          }
          resolve(html);
        }),
      };
    }

    // =====================================================================
    //  Ciclo de vida
    // =====================================================================
    addTo(map) {
      this._map = map;
      const IDEE = api();

      if (!IDEE || !IDEE.ui || !IDEE.Control) {
        console.error(this.name + ': No se encontró el objeto global de la API (IDEE/M).');
        return;
      }

      const pos = (IDEE.ui.position && IDEE.ui.position[this.position])
        ? IDEE.ui.position[this.position]
        : (IDEE.ui.position ? IDEE.ui.position.TL : 'TL');

      const panel = new IDEE.ui.Panel('tools_catalogo', {
        collapsible: this.collapsible,
        className: 'g-herramienta_catalogo',
        collapsedButtonClass: 'm-tools',
        position: pos,
        order: this.order,
      });
      this._panel = panel;

      const control = new IDEE.Control(new IDEE.impl.Control(), 'control_catalogo');
      this._control = control;

      // OBLIGATORIO para que destroy() funciona: la API usa equals() para
      // distinguir controles al retirarlos del panel y del mapa.
      if (typeof control.equals !== 'function') {
        control.equals = function (c) { return c === control; };
      }

      control.createView = () => this._construirUI();

      panel.addControls(control);
      map.addPanels(panel);

      // La barra de título se puede arrastrar, igual que en baseLayer.
      try {
        if (IDEE.utils && typeof IDEE.utils.draggabillyPlugin === 'function') {
          IDEE.utils.draggabillyPlugin(panel, '#m-herramienta-title-catalogo');
        }
      } catch (e) {
        console.warn(this.name + ': no se pudo hacer arrastrable la barra de título.', e);
      }

      this._aplicarIcono(this._elementoPanel(panel));
      // No se refresca la lista aquí: la vista del control todavía no existe.
    }

    /**
     * Elemento DOM de un panel. La API no expone getElement() en el Panel (sí en
     * los controles), así que se cae a la propiedad interna _element.
     * @param {Object} panel
     * @returns {HTMLElement|null}
     */
    _elementoPanel(panel) {
      if (!panel) return null;
      if (typeof panel.getElement === 'function') {
        const el = panel.getElement();
        if (el) return el;
      }
      return panel._element || null;
    }

    /** Construye la interfaz del plugin dentro del control. */
    /** Construye la interfaz del plugin dentro del control. */
    _construirUI() {
      const self = this;

      // Contenedor con las clases del framework, igual que plantilla_plugin y
      // baseLayer: .m-control.m-container.m-herramienta, y dentro la CABECERA
      // .m-herramienta-header (la barra de título, arrastrable con
      // IDEE.utils.draggabillyPlugin) y el CONTENIDO .m-herramienta-contents.
      const container = document.createElement('div');
      container.setAttribute('aria-label', this.title);
      container.setAttribute('role', 'region');
      container.className = 'm-control m-container m-herramienta catalogo' + (this._esTR ? ' catalogo--tr' : '');

      const header = document.createElement('header');
      header.setAttribute('role', 'heading');
      header.setAttribute('aria-level', '3');
      header.setAttribute('tabindex', '0');
      header.id = 'm-herramienta-title-catalogo';
      header.className = 'm-herramienta-header';
      const titulo = document.createElement('span');
      titulo.textContent = this.title;
      header.appendChild(titulo);
      container.appendChild(header);

      const contents = document.createElement('div');
      contents.className = 'm-herramienta-contents catalogo__contenido';
      container.appendChild(contents);

      // --- Pestañas: "Gestión de catálogos" y "Añadir nueva capa" -------
      const tabs = document.createElement('div');
      tabs.className = 'catalogo__pestanas';
      tabs.setAttribute('role', 'tablist');
      this._pestanas = {};
      [
        { id: 'catalogos', nombre: 'Catálogos' },
        { id: 'capa', nombre: 'Añadir capa' }
      ].forEach(function (p) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'catalogo__pestana';
        b.id = 'catalogo-pestana-' + p.id;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', 'false');
        b.textContent = p.nombre;
        b.addEventListener('click', function () { self._verPestana(p.id); });
        self._pestanas[p.id] = b;
        tabs.appendChild(b);
      });
      contents.appendChild(tabs);

      // --- Pestaña 1: selector de catálogo + su sección de gestión --------
      // El selector arriba y, DEBAJO, la sección donde se gestiona el
      // catálogo elegido: el acordeón de secciones (IDEE) o la lista fija.
      const panelCatalogos = document.createElement('div');
      panelCatalogos.className = 'catalogo__panel';
      panelCatalogos.setAttribute('role', 'tabpanel');
      panelCatalogos.setAttribute('data-panel', 'catalogos');

      // La pestaña son dos secciones plegables: los catálogos disponibles (con
      // el selector y su contenido) y el alta de un catálogo nuevo. Las dos
      // usan el mismo acordeón que las secciones de tipo de servicio.
      const grupoDisponibles = this._crearAcordeon('Catálogos disponibles', 'disponibles');
      const grupoNuevo = this._crearAcordeon('Añadir un catálogo nuevo', 'nuevo');
      panelCatalogos.appendChild(grupoDisponibles.caja);
      panelCatalogos.appendChild(grupoNuevo.caja);

      const selector = document.createElement('select');
      selector.className = 'catalogo__selector';
      selector.setAttribute('aria-label', 'Tipo de catálogo');
      // Primero los de serie y después los que ha dado de alta el usuario, que
      // se marcan para que se distinguan de un vistazo.
      const opcionesCatalogo = Object.keys(CATALOGOS).map(function (id) {
        return { id: id, nombre: CATALOGOS[id].nombre, propio: false };
      });
      (window.CatalogoRegistro ? window.CatalogoRegistro.todos() : []).forEach(function (c) {
        opcionesCatalogo.push({ id: c.id, nombre: c.nombre, propio: true });
      });
      opcionesCatalogo.forEach(function (op) {
        const el = document.createElement('option');
        el.value = op.id;
        el.textContent = op.propio ? (op.nombre + ' (tuyo)') : op.nombre;
        if (op.id === self._tipoSeleccionado) el.selected = true;
        selector.appendChild(el);
      });
      selector.addEventListener('change', function () {
        self._tipoSeleccionado = this.value;
        self._pintarCatalogo();
      });
      grupoDisponibles.cuerpo.appendChild(selector);

      const gestor = document.createElement('div');
      gestor.className = 'catalogo__gestor';
      grupoDisponibles.cuerpo.appendChild(gestor);
      this._gestorEl = gestor;

      // El alta va dentro de la segunda sección.
      this._construirAlta(grupoNuevo.cuerpo);

      contents.appendChild(panelCatalogos);
      this._panelCatalogos = panelCatalogos;
      this._selectorEl = selector;

      // --- Pestaña 2: URL + opciones de carga ----------------------------
      const panelCapa = document.createElement('div');
      panelCapa.className = 'catalogo__panel';
      panelCapa.setAttribute('role', 'tabpanel');
      panelCapa.setAttribute('data-panel', 'capa');

      const cajaUrl = document.createElement('div');
      cajaUrl.className = 'catalogo__url';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'catalogo__url-input';
      input.placeholder = 'https://servicio/wms?request=GetCapabilities';
      input.value = this._urlIntroducida;
      input.setAttribute('aria-label', 'URL del servicio o archivo');
      input.addEventListener('input', function () { self._urlIntroducida = this.value; });
      // Intro en el campo = analizar, que es lo que se espera de un campo de
      // texto y no del botón.
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); self._analizarUrl(); }
      });
      cajaUrl.appendChild(input);
      this._urlInputEl = input;

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__url-boton';
      boton.textContent = 'Analizar';
      boton.addEventListener('click', function () { self._analizarUrl(); });
      cajaUrl.appendChild(boton);

      panelCapa.appendChild(cajaUrl);

      // Debajo del campo, y solo cuando ya hay algo que decidir, las opciones
      // de carga: tipo, capas y nombre.
      const opciones = document.createElement('div');
      opciones.className = 'catalogo__gestor';
      panelCapa.appendChild(opciones);
      this._opcionesEl = opciones;

      contents.appendChild(panelCapa);
      this._panelCapa = panelCapa;

      // --- Cuadro de estado (éxitos, avisos y errores) --------------------
      const estado = document.createElement('div');
      estado.className = 'catalogo__estado';
      estado.setAttribute('role', 'status');
      contents.appendChild(estado);
      this._estadoEl = estado;

      // Ni la lista ni las opciones se pintan en addTo: addTo se llama antes
      // de que la API construya la vista del control, así que los contenedores
      // aún serían null.
      this._verPestana(this._pestanaActiva);
      this._pintarCatalogo();
      if (this._analisis) this._pintarOpciones();

      return container;
    }

    /**
     * Muestra una pestaña (botón y panel). Un solo método para que el marcado
     * del botón y la visibilidad del panel no puedan desincronizarse.
     * @param {("catalogos"|"capa")} id
     */
    _verPestana(id) {
      this._pestanaActiva = id;
      Object.keys(this._pestanas).forEach(function (k) {
        const activo = (k === id);
        this._pestanas[k].classList.toggle('catalogo__pestana--activa', activo);
        this._pestanas[k].setAttribute('aria-selected', String(activo));
      }, this);
      if (this._panelCatalogos) this._panelCatalogos.hidden = (id !== 'catalogos');
      if (this._panelCapa) this._panelCapa.hidden = (id !== 'capa');
    }

    // =====================================================================
    //  Pestaña 1: gestión del catálogo
    // =====================================================================

    /**
     * Pinta la sección de gestión del catálogo activo. Debajo del selector,
     * como se pidió: el acordeón de secciones, la lista de un catálogo propio,
     * o la lista corta, según el tipo.
     */
    _pintarCatalogo() {
      const cont = this._gestorEl;
      if (!cont) return;
      cont.innerHTML = '';
      this._seccionesDom = {};

      const tipo = this._catalogoActual();
      if (!tipo) return;

      const desc = document.createElement('p');
      desc.className = 'catalogo__descripcion';
      desc.textContent = tipo.descripcion || '';
      cont.appendChild(desc);

      if (tipo.modo === 'secciones') {
        this._pintarSecciones(cont, tipo);
      } else if (tipo.esPropio) {
        this._pintarCatalogoPropio(cont, tipo);
      } else {
        this._pintarLista(cont, tipo.listar() || []);
      }
    }

    /**
     * El catálogo activo, tanto si es de serie como si lo ha dado de alta el
     * usuario. Todos los usos de CATALOGOS[...] pasan por aquí, porque un
     * catálogo del usuario no está en CATALOGOS.
     * @returns {Object|null}
     */
    _catalogoActual() {
      const registro = window.CatalogoRegistro;
      const propio = registro ? registro.porId(this._tipoSeleccionado) : null;
      if (propio) {
        const self = this;
        return {
          id: propio.id,
          nombre: propio.nombre,
          modo: 'lista',
          esPropio: true,
          tipoCatalogo: propio.tipo,
          url: propio.url,
          descripcion: 'Catálogo añadido por ti: ' + propio.url,
          cargarUrl: function (url, mapa, opciones) { return cargarUrlGenerica(url, mapa, opciones); },
          listar: function () { return self._entradasPropias[propio.id] || []; }
        };
      }
      return CATALOGOS[this._tipoSeleccionado] || null;
    }

    /**
     * Pinta las entradas de un catálogo dado de alta por el usuario. Se piden
     * al seleccionarlo y se cachean, como las secciones de la IDEE.
     */
    _pintarCatalogoPropio(cont, tipo) {
      const self = this;
      const cache = this._entradasPropias[tipo.id] || (this._entradasPropias[tipo.id] = {});

      if (cache.datos) {
        this._pintarLista(cont, cache.datos);
        return;
      }
      if (cache.promesa) return;   // ya se está pidiendo

      this._pintarAviso(cont, 'Consultando «' + tipo.nombre + '»…');

      cache.promesa = window.CatalogoRegistro.leer(tipo.tipoCatalogo, tipo.url).then(function (entradas) {
        cache.datos = entradas;
        cache.promesa = null;
        // Si mientras tanto el usuario ha cambiado de catálogo, este nodo ya no
        // está en la página y no hay que pintar nada.
        if (!document.contains(cont)) return;
        self._pintarLista(cont, entradas);
        self._decir('«' + tipo.nombre + '»: ' + entradas.length + ' entrada(s).');
      }).catch(function (err) {
        cache.promesa = null;
        if (!document.contains(cont)) return;
        cont.innerHTML = '';
        self._pintarAviso(cont,
          'No se ha podido consultar el catálogo: ' + (err && err.message ? err.message : err), 'error');
      });
    }

    /**
     * Crea una sección plegable, con el mismo acordeón que las secciones de
     * tipo de servicio (patrón de vueloFotogrametrico): cabecera con
     * role=button y cuerpo que se anima con alto y opacidad.
     *
     * @param {string} titulo Texto de la cabecera.
     * @param {string} id Identificador del grupo, para el estado.
     * @returns {{caja: HTMLElement, cuerpo: HTMLElement, alternar: Function}}
     */
    _crearAcordeon(titulo, id) {
      const self = this;

      const caja = document.createElement('div');
      caja.className = 'catalogo__seccion catalogo__seccion--grupo';
      caja.dataset.grupo = id;

      const cabecera = document.createElement('div');
      cabecera.className = 'catalogo__seccion-cabecera';
      cabecera.setAttribute('role', 'button');
      cabecera.setAttribute('tabindex', '0');
      cabecera.setAttribute('aria-expanded', 'false');

      const chevron = document.createElement('span');
      chevron.className = 'catalogo__seccion-chevron';
      chevron.setAttribute('aria-hidden', 'true');

      const nombre = document.createElement('span');
      nombre.className = 'catalogo__seccion-nombre';
      nombre.textContent = titulo;

      cabecera.appendChild(chevron);
      cabecera.appendChild(nombre);
      caja.appendChild(cabecera);

      const cuerpo = document.createElement('div');
      cuerpo.className = 'catalogo__seccion-cuerpo catalogo__seccion-cuerpo--grupo';
      caja.appendChild(cuerpo);

      const alternar = function () {
        const abierta = caja.classList.contains('collapsed');
        caja.classList.toggle('collapsed', !abierta);
        cabecera.setAttribute('aria-expanded', String(abierta));
        const pos = self._gruposAbiertos.indexOf(id);
        if (abierta && pos === -1) self._gruposAbiertos.push(id);
        if (!abierta && pos > -1) self._gruposAbiertos.splice(pos, 1);
      };
      this._gruposDom[id] = { caja: caja, cabecera: cabecera, alternar: alternar };

      cabecera.addEventListener('click', alternar);
      cabecera.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          alternar();
        }
      });

      // Los dos grupos de la pestaña arrancan abiertos: el catálogo es lo
      // principal y el alta tiene que verse para que se sepa que existe.
      if (this._gruposAbiertos.indexOf(id) === -1) this._gruposAbiertos.push(id);
      caja.classList.remove('collapsed');
      cabecera.setAttribute('aria-expanded', 'true');

      return { caja: caja, cuerpo: cuerpo, alternar: alternar };
    }

    /**
     * Pliega o despliega un grupo de la pestaña de catálogos.
     * @param {string} id
     */
    _alternarGrupo(id) {
      const grupo = this._gruposDom[id];
      if (grupo) grupo.alternar();
    }

    // =====================================================================
    //  Alta de catálogos nuevos
    // =====================================================================

    /**
     * Construye la sección de alta de catálogos, que va al final de la
     * pestaña: nombre, tipo, URL y la lista de los ya dados de alta.
     * @param {HTMLElement} padre
     */
    _construirAlta(padre) {
      const self = this;
      const registro = window.CatalogoRegistro;

      const caja = document.createElement('div');
      caja.className = 'catalogo__nuevo';

      const cabecera = document.createElement('div');
      cabecera.className = 'catalogo__nuevo-cabecera';
      cabecera.textContent = 'Añadir un catálogo nuevo';
      caja.appendChild(cabecera);

      if (!registro) {
        this._pintarAviso(caja, 'No está cargado catalogo_registro.js.', 'error');
        padre.appendChild(caja);
        return;
      }

      const nombre = document.createElement('input');
      nombre.type = 'text';
      nombre.className = 'catalogo__campo-control';
      nombre.placeholder = 'Nombre del catálogo';
      nombre.setAttribute('aria-label', 'Nombre del catálogo nuevo');

      const tipo = document.createElement('select');
      tipo.className = 'catalogo__campo-control';
      tipo.setAttribute('aria-label', 'Tipo de catálogo nuevo');
      Object.keys(registro.TIPOS).forEach(function (k) {
        const op = document.createElement('option');
        op.value = k;
        op.textContent = registro.TIPOS[k];
        tipo.appendChild(op);
      });

      const url = document.createElement('input');
      url.type = 'text';
      url.className = 'catalogo__campo-control';
      url.placeholder = 'https://servidor/catalogo';
      url.setAttribute('aria-label', 'URL del catálogo nuevo');

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__cargar';
      boton.textContent = 'Añadir al catálogo';
      boton.addEventListener('click', function () {
        let creado;
        try {
          creado = registro.alta({ nombre: nombre.value, tipo: tipo.value, url: url.value });
        } catch (e) {
          self._decir(e && e.message ? e.message : String(e), 'aviso');
          return;
        }
        nombre.value = '';
        url.value = '';
        self._decir('Catálogo añadido: ' + creado.nombre);
        // El tipo seleccionado se cambia ANTES de refrescar el selector: al
        // repintarlo se marca la opción elegida, y si se hace al revés el
        // desplegable se queda mostrando el catálogo anterior.
        self._tipoSeleccionado = creado.id;
        self._refrescarSelector();
        self._pintarNuevos();
        self._pintarCatalogo();
      });

      [['Nombre', nombre], ['Tipo', tipo], ['URL del catálogo', url]].forEach(function (campo) {
        const etiqueta = document.createElement('label');
        etiqueta.className = 'catalogo__campo';
        const texto = document.createElement('span');
        texto.className = 'catalogo__campo-etiqueta';
        texto.textContent = campo[0];
        etiqueta.appendChild(texto);
        etiqueta.appendChild(campo[1]);
        caja.appendChild(etiqueta);
      });

      const pie = document.createElement('div');
      pie.className = 'catalogo__nuevo-pie';
      pie.appendChild(boton);
      caja.appendChild(pie);

      const lista = document.createElement('div');
      lista.className = 'catalogo__nuevos';
      caja.appendChild(lista);
      this._nuevosEl = lista;

      padre.appendChild(caja);
      this._pintarNuevos();
    }

    /** Vuelve a pintar la lista de catálogos dados de alta. */
    _pintarNuevos() {
      const self = this;
      const lista = this._nuevosEl;
      const registro = window.CatalogoRegistro;
      if (!lista || !registro) return;

      lista.innerHTML = '';
      const dados = registro.todos();

      if (!dados.length) {
        const aviso = document.createElement('p');
        aviso.className = 'catalogo__aviso';
        aviso.textContent = 'Todavía no has añadido ningún catálogo.';
        lista.appendChild(aviso);
        return;
      }

      dados.forEach(function (c) {
        const fila = document.createElement('div');
        fila.className = 'catalogo__nuevo-item';

        const textos = document.createElement('div');
        textos.className = 'catalogo__item-texto';
        const nom = document.createElement('span');
        nom.className = 'catalogo__item-nombre';
        nom.textContent = c.nombre;
        nom.title = c.nombre;
        const dir = document.createElement('span');
        dir.className = 'catalogo__item-url';
        dir.textContent = registro.TIPOS[c.tipo] + ' · ' + c.url;
        dir.title = c.url;
        textos.appendChild(nom);
        textos.appendChild(dir);
        fila.appendChild(textos);

        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'catalogo__quitar';
        quitar.textContent = 'Quitar';
        quitar.setAttribute('aria-label', 'Quitar el catálogo ' + c.nombre);
        quitar.addEventListener('click', function () {
          registro.baja(c.id);
          delete self._entradasPropias[c.id];
          if (self._tipoSeleccionado === c.id) self._tipoSeleccionado = 'idee';
          self._decir('Catálogo quitado: ' + c.nombre);
          self._refrescarSelector();
          self._pintarNuevos();
          self._pintarCatalogo();
        });
        fila.appendChild(quitar);

        lista.appendChild(fila);
      });
    }

    /** Vuelve a pintar el <select> de catálogos (tras un alta o una baja). */
    _refrescarSelector() {
      const selector = this._selectorEl;
      const registro = window.CatalogoRegistro;
      if (!selector || !registro) return;

      const elegido = this._tipoSeleccionado;
      selector.innerHTML = '';

      const opciones = Object.keys(CATALOGOS).map(function (id) {
        return { id: id, nombre: CATALOGOS[id].nombre, propio: false };
      });
      registro.todos().forEach(function (c) {
        opciones.push({ id: c.id, nombre: c.nombre, propio: true });
      });

      opciones.forEach(function (op) {
        const el = document.createElement('option');
        el.value = op.id;
        el.textContent = op.propio ? (op.nombre + ' (tuyo)') : op.nombre;
        if (op.id === elegido) el.selected = true;
        selector.appendChild(el);
      });
      selector.value = elegido;
    }

    /**
     * Acordeón de secciones del catálogo, con buscador. Cada sección se pide
     * al abrirse y se cachea, porque son datos que no cambian.
     */
    _pintarSecciones(cont, tipo) {
      const self = this;
      const secciones = tipo.listar() || [];

      const buscador = document.createElement('div');
      buscador.className = 'catalogo__buscador';
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'catalogo__buscador-input';
      input.placeholder = 'Filtrar por servicio u organismo…';
      input.value = this._filtro || '';
      input.setAttribute('aria-label', 'Filtrar servicios del catálogo');
      input.addEventListener('input', function () {
        self._filtro = this.value;
        self._filtrarSecciones();
      });
      buscador.appendChild(input);
      cont.appendChild(buscador);
      this._buscadorEl = input;

      const lista = document.createElement('div');
      lista.className = 'catalogo__secciones';
      cont.appendChild(lista);
      this._seccionesEl = lista;

      if (!secciones.length) {
        this._pintarAviso(lista, 'No se ha podido cargar el catálogo de la IDEE.');
        return;
      }

      secciones.forEach(function (sec) {
        // Acordeón con el patrón de vueloFotogrametrico: un contenedor con la
        // clase "collapsed" cuando está plegado, una cabecera con role=button y
        // un cuerpo que se anima con alto y opacidad. Se hace con <div> en vez
        // de <details> por el mismo motivo que allí: así la cabecera puede
        // llevar el contador y el distintivo de tipo, y el plegado se puede
        // controlar desde el estado (getState/setState).
        const caja = document.createElement('div');
        // Nacen PLEGADAS: el catálogo de la IDEE tiene diez secciones y pedir
        // las diez de golpe sería una barbaridad. Se despliegan al pulsar.
        caja.className = 'catalogo__seccion collapsed';
        caja.dataset.seccion = sec.id;

        const cabecera = document.createElement('div');
        cabecera.className = 'catalogo__seccion-cabecera';
        cabecera.setAttribute('role', 'button');
        cabecera.setAttribute('tabindex', '0');
        cabecera.setAttribute('aria-expanded', 'false');

        const chevron = document.createElement('span');
        chevron.className = 'catalogo__seccion-chevron';
        chevron.setAttribute('aria-hidden', 'true');

        const nombre = document.createElement('span');
        nombre.className = 'catalogo__seccion-nombre';
        nombre.textContent = sec.nombre;

        const insignia = document.createElement('span');
        insignia.className = 'catalogo__seccion-tipo';
        insignia.textContent = sec.tipo;

        const cuenta = document.createElement('span');
        cuenta.className = 'catalogo__seccion-cuenta';

        cabecera.appendChild(chevron);
        cabecera.appendChild(nombre);
        cabecera.appendChild(insignia);
        cabecera.appendChild(cuenta);
        caja.appendChild(cabecera);

        const cuerpo = document.createElement('div');
        cuerpo.className = 'catalogo__seccion-cuerpo';
        caja.appendChild(cuerpo);

        const alternar = function () { self._alternarSeccion(sec.id); };
        cabecera.addEventListener('click', alternar);
        // Enter y Espacio, que es lo que se espera de un role=button.
        cabecera.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
            ev.preventDefault();
            alternar();
          }
        });

        self._seccionesDom[sec.id] = { caja: caja, cabecera: cabecera, cuerpo: cuerpo, cuenta: cuenta, sec: sec };
        lista.appendChild(caja);
      });

      // Las secciones que estaban abiertas antes (cambio 2D/3D) se reabren y
      // se piden.
      this._seccionesAbiertas.forEach(function (id) {
        const s = this._seccionesDom[id];
        if (s) this._alternarSeccion(id, true);
      }, this);

      if ((this._filtro || '').trim()) this._filtrarSecciones();
    }

    /**
     * Pliega o despliega una sección. Al desplegarla se pide al catálogo (y se
     * cachea); el estado de cuáles están abiertas viaja en el getState.
     * @param {string} id
     * @param {boolean} [forzar] true despliega siempre, false pliega siempre.
     */
    _alternarSeccion(id, forzar) {
      const s = this._seccionesDom[id];
      if (!s) return;

      const abierta = forzar === undefined ? s.caja.classList.contains('collapsed') : !forzar;
      const pos = this._seccionesAbiertas.indexOf(id);

      if (abierta) {
        s.caja.classList.remove('collapsed');
        s.cabecera.setAttribute('aria-expanded', 'true');
        if (pos === -1) this._seccionesAbiertas.push(id);
        this._cargarSeccion(s.sec, s.cuerpo, s.cuenta, (this._filtro || '').trim() || undefined);
      } else {
        s.caja.classList.add('collapsed');
        s.cabecera.setAttribute('aria-expanded', 'false');
        if (pos > -1) this._seccionesAbiertas.splice(pos, 1);
      }
    }

    /**
     * Aplica el filtro de texto. Las secciones ya cargadas se filtran en
     * local; las que no, se piden en segundo plano y se filtran al llegar, que
     * es la única forma de buscar en todo el catálogo (el WMS estatal del
     * IGN tiene más de setecientos servicios).
     */
    _filtrarSecciones() {
      const self = this;
      const filtro = (this._filtro || '').trim().toLowerCase();

      Object.keys(this._seccionesDom).forEach(function (id) {
        const s = self._seccionesDom[id];
        const st = self._estadoSecciones[id];

        if (!filtro) {
          // Sin filtro vuelve todo: la sección se reaparece y su cuerpo se
          // repinta entero, que se quedó con solo las coincidencias.
          s.caja.hidden = false;
          if (st && st.datos) self._pintarSeccion(st.datos, s.cuerpo, '');
          return;
        }

        if (st && st.datos) {
          s.caja.hidden = !self._pintarSeccion(st.datos, s.cuerpo, filtro);
        } else if (!st || !st.promesa) {
          // Sin datos todavía: se pide para poder filtrarla (queda cacheada).
          self._cargarSeccion(s.sec, s.cuerpo, s.cuenta, filtro);
        }
      });
    }

    /**
     * Pide una sección al catálogo y la pinta en su <details>.
     * @param {Object} sec Sección de CatalogoIDEE.SECCIONES.
     * @param {HTMLElement} cuerpo Donde se pinta.
     * @param {HTMLElement} cuenta Contador de la cabecera.
     * @param {string} [filtro] Filtro a aplicar al pintarla.
     * @returns {Promise<Object|null>}
     */
    _cargarSeccion(sec, cuerpo, cuenta, filtro) {
      const self = this;
      const st = this._estadoSecciones[sec.id] || (this._estadoSecciones[sec.id] = {});

      if (st.datos) {
        this._pintarSeccion(st.datos, cuerpo, filtro);
        return Promise.resolve(st.datos);
      }
      if (st.promesa) {
        return st.promesa.then(function () {
          if (filtro) self._pintarSeccion(st.datos, cuerpo, filtro);
        });
      }

      cuerpo.innerHTML = '';
      this._pintarAviso(cuerpo, 'Pidiendo «' + sec.nombre + '» al catálogo de la IDEE…');

      st.promesa = window.CatalogoIDEE.listarSeccion(sec.id).then(function (datos) {
        st.datos = datos;
        st.promesa = null;
        cuenta.textContent = datos.total + (datos.total === 1 ? ' servicio' : ' servicios');
        const queda = self._pintarSeccion(datos, cuerpo, filtro);
        // Si la sección se pidió solo para filtrar, se esconde si en ella no
        // hay nada que ver: si no, el filtro deja diez secciones vacías.
        const dom = self._seccionesDom[sec.id];
        if (filtro && dom) dom.caja.hidden = !queda;
        return datos;
      }).catch(function (err) {
        st.promesa = null;
        cuerpo.innerHTML = '';
        self._pintarAviso(cuerpo,
          'No se ha podido pedir esta sección: ' + (err && err.message ? err.message : err), 'error');
        return null;
      });

      return st.promesa;
    }

    /**
     * Pinta los servicios de una sección ya pedida, agrupados por organismo.
     * @param {Object} datos { seccion, familias, total }.
     * @param {HTMLElement} cuerpo
     * @param {string} [filtro] Texto a filtrar.
     * @returns {boolean} Si queda algo visible (para decidir si esconder la
     *   sección entera cuando el filtro no encuentra nada).
     */
    _pintarSeccion(datos, cuerpo, filtro) {
      const self = this;
      const f = (filtro || '').trim().toLowerCase();
      cuerpo.innerHTML = '';

      let encontrados = 0;
      const fragmentos = document.createDocumentFragment();

      datos.familias.forEach(function (fam) {
        const servicios = f
          ? fam.servicios.filter(function (s) {
            return (s.nombre || '').toLowerCase().indexOf(f) > -1
              || (fam.nombre || '').toLowerCase().indexOf(f) > -1
              || (s.url || '').toLowerCase().indexOf(f) > -1;
          })
          : fam.servicios;

        if (!servicios.length) return;
        encontrados += servicios.length;

        // Cabecera del organismo, con su número de servicios.
        const org = document.createElement('div');
        org.className = 'catalogo__organismo';
        const orgNombre = document.createElement('span');
        orgNombre.textContent = fam.nombre;
        const orgCuenta = document.createElement('span');
        orgCuenta.className = 'catalogo__organismo-cuenta';
        orgCuenta.textContent = servicios.length;
        org.appendChild(orgNombre);
        org.appendChild(orgCuenta);
        fragmentos.appendChild(org);

        servicios.forEach(function (srv) {
          fragmentos.appendChild(self._filaServicio(srv, datos.seccion));
        });
      });

      if (!encontrados) {
        this._pintarAviso(cuerpo,
          f ? 'Ninguna sección contiene «' + filtro + '».' : 'La sección no tiene servicios.');
        return false;
      }

      cuerpo.appendChild(fragmentos);
      return true;
    }

    /** Una fila de servicio con su botón de carga. */
    _filaServicio(srv, sec) {
      const self = this;
      const fila = document.createElement('div');
      fila.className = 'catalogo__item';

      const texto = document.createElement('div');
      texto.className = 'catalogo__item-texto';

      const nombre = document.createElement('span');
      nombre.className = 'catalogo__item-nombre';
      nombre.textContent = srv.nombre;
      nombre.title = srv.nombre;
      texto.appendChild(nombre);

      const url = document.createElement('span');
      url.className = 'catalogo__item-url';
      url.textContent = srv.url;
      url.title = srv.url;
      texto.appendChild(url);

      fila.appendChild(texto);

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__item-boton';
      boton.textContent = 'Cargar';
      boton.addEventListener('click', function () { self._cargarServicio(srv, sec); });
      fila.appendChild(boton);

      return fila;
    }

    /** Lista plana de servicios (catálogos STAC y OGC API Records). */
    _pintarLista(cont, servicios) {
      const self = this;
      if (!servicios.length) {
        this._pintarAviso(cont, 'Este catálogo todavía no tiene servicios predefinidos.');
        return;
      }
      servicios.forEach(function (srv) {
        cont.appendChild(self._filaServicio(srv, { tipo: srv.tipo || null }));
      });
    }

    // =====================================================================
    //  Pestaña 2: añadir una capa por URL
    // =====================================================================

    /** Analiza la URL escrita y, si puede, monta las opciones de carga. */
    _analizarUrl() {
      const self = this;
      const input = this._urlInputEl;
      const cont = this._opcionesEl;
      const url = input ? String(input.value || '').trim() : '';

      if (!cont) return;
      cont.innerHTML = '';

      if (!url) {
        this._decir('Escribe primero una URL.', 'aviso');
        return;
      }
      if (!/^https?:\/\//i.test(url)) {
        this._decir('La URL tiene que empezar por http:// o https://', 'aviso');
        return;
      }

      const urlTool = window.CatalogoURL;
      if (!urlTool) {
        this._decir('No está cargado catalogo_url.js.', 'error');
        return;
      }

      this._urlIntroducida = url;
      this._analisis = { url: url, tipo: urlTool.detectarTipo(url), capas: [], elegidas: [], nombre: '' };
      this._pintarAviso(cont, 'Analizando el servicio…');

      urlTool.leerCapas(url).then(function (info) {
        self._analisis = {
          url: url,
          tipo: info.tipo,
          capas: info.capas || [],
          elegidas: (info.capas || []).map(function (c) { return c.id; }),
          nombre: info.nombre || '',
          aviso: info.aviso || null
        };
        self._pintarOpciones();
        self._decir('Servicio analizado: ' + (info.capas || []).length + ' capa(s).');
      }).catch(function (err) {
        cont.innerHTML = '';
        // La URL se queda escrita y el tipo deducio a la vista, para que se
        // pueda probar a cargar a mano aunque no se haya podido leer nada.
        self._analisis = {
          url: url,
          tipo: urlTool.detectarTipo(url),
          capas: [],
          elegidas: [],
          nombre: urlTool.nombreDeUrl(url),
          aviso: null,
          error: (err && err.message) ? err.message : String(err)
        };
        self._pintarOpciones();
        self._decir('No se ha podido leer el servicio: ' + self._analisis.error, 'aviso');
      });
    }

    /** Pinta el bloque de opciones de carga de la URL analizada. */
    _pintarOpciones() {
      const self = this;
      const cont = this._opcionesEl;
      const info = this._analisis;
      if (!cont || !info) return;

      const urlTool = window.CatalogoURL;
      cont.innerHTML = '';

      const caja = document.createElement('div');
      caja.className = 'catalogo__opciones';

      // --- Tipo detectado (editable) --------------------------------------
      const filaTipo = document.createElement('label');
      filaTipo.className = 'catalogo__campo';
      const etiquetaTipo = document.createElement('span');
      etiquetaTipo.className = 'catalogo__campo-etiqueta';
      etiquetaTipo.textContent = 'Tipo de capa';
      const selTipo = document.createElement('select');
      selTipo.className = 'catalogo__campo-control';
      Object.keys(urlTool.TIPOS).forEach(function (t) {
        const op = document.createElement('option');
        op.value = t;
        op.textContent = urlTool.ETIQUETAS[t] || t;
        if (t === info.tipo) op.selected = true;
        selTipo.appendChild(op);
      });
      if (info.tipo === 'desconocido') {
        const op = document.createElement('option');
        op.value = 'desconocido';
        op.textContent = urlTool.ETIQUETAS.desconocido;
        op.selected = true;
        selTipo.insertBefore(op, selTipo.firstChild);
      }
      selTipo.addEventListener('change', function () {
        self._analisis.tipo = this.value;
      });
      filaTipo.appendChild(etiquetaTipo);
      filaTipo.appendChild(selTipo);
      caja.appendChild(filaTipo);

      // --- Nombre que se le quiere dar -------------------------------------
      const filaNombre = document.createElement('label');
      filaNombre.className = 'catalogo__campo';
      const etiquetaNombre = document.createElement('span');
      etiquetaNombre.className = 'catalogo__campo-etiqueta';
      etiquetaNombre.textContent = 'Nombre de la capa';
      const inputNombre = document.createElement('input');
      inputNombre.type = 'text';
      inputNombre.className = 'catalogo__campo-control';
      inputNombre.value = info.nombre || '';
      inputNombre.placeholder = 'Cómo se verá en el panel de capas';
      inputNombre.addEventListener('input', function () { self._analisis.nombre = this.value; });
      filaNombre.appendChild(etiquetaNombre);
      filaNombre.appendChild(inputNombre);
      caja.appendChild(filaNombre);

      // --- Capas del servicio ----------------------------------------------
      if (info.capas && info.capas.length) {
        const bloqueCapas = document.createElement('div');
        bloqueCapas.className = 'catalogo__capas';

        const cabecera = document.createElement('div');
        cabecera.className = 'catalogo__capas-cabecera';

        const titulo = document.createElement('span');
        titulo.className = 'catalogo__capas-titulo';
        titulo.textContent = 'Capas del servicio (' + info.capas.length + ')';
        cabecera.appendChild(titulo);

        const acciones = document.createElement('span');
        acciones.className = 'catalogo__capas-acciones';
        const todas = document.createElement('button');
        todas.type = 'button';
        todas.className = 'catalogo__enlace';
        todas.textContent = 'Todas';
        todas.addEventListener('click', function () {
          self._analisis.elegidas = info.capas.map(function (c) { return c.id; });
          self._pintarCapasElejidas();
          self._pintarOpciones();
        });
        const ninguna = document.createElement('button');
        ninguna.type = 'button';
        ninguna.className = 'catalogo__enlace';
        ninguna.textContent = 'Ninguna';
        ninguna.addEventListener('click', function () {
          self._analisis.elegidas = [];
          self._pintarCapasElejidas();
          self._pintarOpciones();
        });
        acciones.appendChild(todas);
        acciones.appendChild(ninguna);
        cabecera.appendChild(acciones);
        bloqueCapas.appendChild(cabecera);

        const lista = document.createElement('div');
        lista.className = 'catalogo__capas-lista';
        bloqueCapas.appendChild(lista);
        this._capasListaEl = lista;

        caja.appendChild(bloqueCapas);
        this._pintarCapasElejidas();
      }

      // --- Avisos ----------------------------------------------------------
      if (info.error) {
        this._pintarAviso(caja,
          'No se ha podido leer el documento del servicio (' + info.error + '). ' +
          'Se puede probar a cargarlo igualmente.', 'aviso');
      } else if (info.aviso) {
        this._pintarAviso(caja, info.aviso, 'aviso');
      }

      // --- Botón de cargar ---------------------------------------------------
      const pie = document.createElement('div');
      pie.className = 'catalogo__opciones-pie';
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__cargar';
      const elegidas = (info.elegidas || []).length;
      boton.textContent = (elegidas > 1)
        ? 'Cargar ' + elegidas + ' capas'
        : 'Cargar en el mapa';
      boton.addEventListener('click', function () {
        self._cargarDesdeAnalisis();
      });
      this._botonCargarEl = boton;
      pie.appendChild(boton);
      caja.appendChild(pie);

      cont.appendChild(caja);
      this._actualizarBotonCargar();
    }

    /** El botón de carga dice cuántas capas hay elegidas. */
    _actualizarBotonCargar() {
      const boton = this._botonCargarEl;
      if (!boton || !this._analisis) return;
      const elegidas = (this._analisis.elegidas || []).length;
      boton.textContent = (elegidas > 1)
        ? 'Cargar ' + elegidas + ' capas'
        : 'Cargar en el mapa';
      boton.disabled = (elegidas === 0);
    }

    /** Marca o desmarca una capa del servicio. */
    _alternarCapa(id, marcada) {
      const self = this;
      const elegidas = (this._analisis.elegidas || []).slice();
      const pos = elegidas.indexOf(id);
      if (marcada && pos === -1) elegidas.push(id);
      if (!marcada && pos > -1) elegidas.splice(pos, 1);
      self._analisis.elegidas = elegidas;
      self._actualizarBotonCargar();
    }

    /** Redibuja la lista de capas con su casilla de selección. */
    _pintarCapasElejidas() {
      const self = this;
      const lista = this._capasListaEl;
      const info = this._analisis;
      if (!lista || !info) return;

      lista.innerHTML = '';
      info.capas.forEach(function (c) {
        const marcada = (info.elegidas || []).indexOf(c.id) > -1;
        const fila = document.createElement('label');
        fila.className = 'catalogo__capa' + (marcada ? ' catalogo__capa--marcada' : '');

        const caja = document.createElement('input');
        caja.type = 'checkbox';
        caja.className = 'catalogo__capa-casilla';
        caja.checked = marcada;
        caja.addEventListener('change', function () {
          self._alternarCapa(c.id, this.checked);
          fila.classList.toggle('catalogo__capa--marcada', this.checked);
        });

        const textos = document.createElement('span');
        textos.className = 'catalogo__capa-textos';
        const nombre = document.createElement('span');
        nombre.className = 'catalogo__capa-nombre';
        nombre.textContent = c.nombre;
        nombre.title = c.nombre;
        const id = document.createElement('span');
        id.className = 'catalogo__capa-id';
        id.textContent = c.id;
        id.title = c.id;
        textos.appendChild(nombre);
        textos.appendChild(id);

        fila.appendChild(caja);
        fila.appendChild(textos);
        lista.appendChild(fila);
      });
    }

    /** Carga lo que haya elegido en el bloque de opciones. */
    _cargarDesdeAnalisis() {
      const info = this._analisis;
      if (!info) return;
      if (!info.elegidas || !info.elegidas.length) {
        this._decir('Elige al menos una capa del servicio.', 'aviso');
        return;
      }
      this._decir('Cargando…');
      try {
        const tipoActual = this._catalogoActual();
        if (!tipoActual) return;
        const capas = tipoActual.cargarUrl(info.url, this._map, {
          tipo: info.tipo,
          capas: info.elegidas,
          nombre: info.nombre
        });
        const cuantas = (capas && capas.length) || 0;
        this._decir('Cargada' + (cuantas > 1 ? 's ' + cuantas + ' capas' : '') + ': ' + info.nombre);
      } catch (err) {
        this._decir('No se ha podido cargar: ' + (err && err.message ? err.message : err), 'error');
      }
    }

    // =====================================================================
    //  Carga de servicios
    // =====================================================================

    /**
     * Carga un servicio del catálogo.
     *
     * La URL del catálogo es el GetCapabilities del SERVICIO, no de una capa
     * concreta, así que hay que leer el documento para saber qué capas ofrece.
     * Si ofrece una sola, se carga directamente; si ofrece varias, se salta a
     * la pestaña de opciones con la URL ya puesta, que es donde se decide.
     *
     * @param {Object} srv Servicio del catálogo.
     * @param {Object} sec Sección a la que pertenece.
     */
    _cargarServicio(srv, sec) {
      const self = this;
      const urlTool = window.CatalogoURL;
      const tipo = (sec && sec.tipo) || srv.tipo || (urlTool ? urlTool.detectarTipo(srv.url) : 'WMS');

      if (!urlTool) return;
      this._decir('Leyendo el servicio «' + srv.nombre + '»…');

      urlTool.leerCapas(srv.url, tipo).then(function (info) {
        if (!info.capas || info.capas.length <= 1) {
          const cargador = self._catalogoActual();
          if (!cargador) return;
          const creadas = cargador.cargarUrl(srv.url, self._map, {
            tipo: info.tipo || tipo,
            capas: (info.capas || []).map(function (c) { return c.id; }),
            nombre: srv.nombre
          });
          const cuantas = (creadas && creadas.length) || 0;
          self._decir('Cargada' + (cuantas > 1 ? 's ' + cuantas + ' capas' : '') + ': ' + srv.nombre);
          return;
        }

        // Varias capas: a la pestaña de opciones, con todo puesto.
        self._urlIntroducida = srv.url;
        if (self._urlInputEl) self._urlInputEl.value = srv.url;
        self._analisis = {
          url: srv.url,
          tipo: info.tipo || tipo,
          capas: info.capas,
          elegidas: info.capas.map(function (c) { return c.id; }),
          nombre: srv.nombre,
          aviso: null
        };
        self._verPestana('capa');
        self._pintarOpciones();
        self._decir('«' + srv.nombre + '» ofrece ' + info.capas.length +
          ' capas: elige cuáles cargar en la pestaña de opciones.', 'aviso');
      }).catch(function (err) {
        self._decir('No se ha podido leer «' + srv.nombre + '»: ' +
          (err && err.message ? err.message : err), 'error');
      });
    }

    /** Mensaje o error dentro de un contenedor de la interfaz. */
    _pintarAviso(contenedor, texto, clase) {
      const aviso = document.createElement('p');
      aviso.className = 'catalogo__aviso' + (clase ? ' catalogo__aviso--' + clase : '');
      aviso.textContent = texto;
      contenedor.appendChild(aviso);
      return aviso;
    }

    /** Escribe un mensaje en el cuadro de estado. */
    _decir(mensaje, clase) {
      this._ultimoMensaje = mensaje;
      if (!this._estadoEl) return;
      this._estadoEl.textContent = mensaje;
      this._estadoEl.className = 'catalogo__estado' + (clase ? (' catalogo__estado--' + clase) : '');
    }

    // =====================================================================
    //  Contrato de estado (cambio 2D/3D)
    // =====================================================================
    getState() {
      let panelCollapsed = true;
      if (this._panel) {
        if (this._panel._collapsed !== undefined) {
          panelCollapsed = !!this._panel._collapsed;
        } else if (typeof this._panel.getElement === 'function') {
          const panelEl = this._panel.getElement();
          panelCollapsed = panelEl ? panelEl.classList.contains('collapsed') : true;
        }
      }
      return {
        tipo: this._tipoSeleccionado,
        url: this._urlIntroducida,
        mensaje: this._ultimoMensaje,
        pestana: this._pestanaActiva,
        // Secciones del catálogo abiertas y filtro de texto: son lo que el
        // usuario estaba mirando, y abrirlas de nuevo cuesta una petición.
        secciones: this._seccionesAbiertas.slice(),
        grupos: this._gruposAbiertos.slice(),
        filtro: this._filtro || '',
        // Lo último analizado, para que la pestaña de opciones siga montada
        // después del cambio 2D/3D sin tener que volver a pedir el servicio.
        analisis: this._analisis ? {
          url: this._analisis.url,
          tipo: this._analisis.tipo,
          nombre: this._analisis.nombre,
          capas: (this._analisis.capas || []).map(function (c) { return { id: c.id, nombre: c.nombre }; }),
          elegidas: (this._analisis.elegidas || []).slice(),
          aviso: this._analisis.aviso || null
        } : null,
        panelCollapsed: panelCollapsed
      };
    }

    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      // Un catálogo del usuario vale igual que uno de serie: los ids de estos
      // empiezan por "usuario_" y no están en CATALOGOS.
      const esDelUsuario = window.CatalogoRegistro && window.CatalogoRegistro.porId(state.tipo);
      if (state.tipo && (CATALOGOS[state.tipo] || esDelUsuario)) {
        this._tipoSeleccionado = state.tipo;
      }
      if (typeof state.url === 'string') {
        this._urlIntroducida = state.url;
      }
      if (typeof state.mensaje === 'string') {
        this._ultimoMensaje = state.mensaje;
      }
      if (Array.isArray(state.secciones)) {
        this._seccionesAbiertas = state.secciones.filter(function (id) { return typeof id === 'string'; });
      }
      if (Array.isArray(state.grupos)) {
        this._gruposAbiertos = state.grupos.filter(function (id) { return typeof id === 'string'; });
      }
      if (typeof state.filtro === 'string') {
        this._filtro = state.filtro;
      }
      if (state.analisis && typeof state.analisis.url === 'string') {
        this._analisis = {
          url: state.analisis.url,
          tipo: state.analisis.tipo,
          nombre: state.analisis.nombre || '',
          capas: Array.isArray(state.analisis.capas) ? state.analisis.capas : [],
          elegidas: Array.isArray(state.analisis.elegidas) ? state.analisis.elegidas : [],
          aviso: state.analisis.aviso || null,
          error: null
        };
      }
      if (state.pestana && this._pestanas[state.pestana]) {
        this._verPestana(state.pestana);
      }
      if (typeof state.panelCollapsed === 'boolean' && this._panel) {
        try {
          if (state.panelCollapsed && typeof this._panel.collapse === 'function') {
            this._panel.collapse();
          } else if (!state.panelCollapsed && typeof this._panel.open === 'function') {
            this._panel.open();
          }
        } catch (e) {
          console.warn(this.name + ': no se pudo restaurar el panel.', e);
        }
      }
      // La UI se reconstruye sola en el swap (addTo se vuelve a llamar), así que
      // aquí solo hace falta que el estado esté guardado... y sincronizado: el
      // panel nuevo nace con los valores por defecto y setState llega después.
      this._sincronizarUI();
    }

    /**
     * Pasa el estado interno a los elementos de la UI ya montada.
     *
     * EstadoPlugins llama a setState DESPUÉS de que addTo haya reconstruido la
     * vista con los valores por defecto, así que sin esto el selector y la
     * lista se quedarían en el catálogo inicial aunque el usuario hubiera
     * elegido otro.
     */
    _sincronizarUI() {
      const raiz = this._control && typeof this._control.getElement === 'function'
        ? this._control.getElement()
        : null;
      if (!raiz) return;
      const selector = raiz.querySelector('.catalogo__selector');
      if (selector) selector.value = this._tipoSeleccionado;
      const input = raiz.querySelector('.catalogo__url-input');
      if (input) input.value = this._urlIntroducida;
      const buscador = raiz.querySelector('.catalogo__buscador-input');
      if (buscador) buscador.value = this._filtro || '';
      this._verPestana(this._pestanaActiva);
      this._pintarCatalogo();
      if (this._analisis) this._pintarOpciones();
      if (this._estadoEl && this._ultimoMensaje) {
        this._estadoEl.textContent = this._ultimoMensaje;
        this._estadoEl.className = 'catalogo__estado';
      }
    }

    destroy() {
      if (this._panel && typeof this._panel.close === 'function') {
        try { this._panel.close(); } catch (e) { /* ignora */ }
      }
      this._panel = null;
      this._control = null;
      this._map = null;
      this._estadoEl = null;
      // Las referencias a la interfaz se sueltan todas: el panel se va con el
      // DOM y dejarlas puestas daría acceso a nodos huérfanos.
      this._gestorEl = null;
      this._opcionesEl = null;
      this._urlInputEl = null;
      this._selectorEl = null;
      this._capasListaEl = null;
      this._buscadorEl = null;
      this._nuevosEl = null;
      this._seccionesDom = {};
      this._estadoSecciones = {};
      this._entradasPropias = {};
      this._gruposDom = {};
    }
  }

  // =====================================================================
  //  Exposición triple + registro de catálogos
  // =====================================================================
  exponerCatalog();

  if (typeof window !== 'undefined') {
    window.miPlugin_catalogo = miPlugin_catalogo;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_catalogo = miPlugin_catalogo;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_catalogo = miPlugin_catalogo;
  }
})();