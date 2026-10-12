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
   `IDEE.catalog` es el registro de tipos. Cada tipo sabe dos cosas:
     - listar()        -> sus servicios predefinidos
     - cargarUrl(url)  -> qué capa crea a partir de una URL

   Tipos previstos (ver CATALOGOS más abajo):
     - 'idee'           Catálogo IDEE (servicios del IGN-CNIG)
     - 'stac'           STAC (SpatioTemporal Asset Catalog)
     - 'ogcapi-records' OGC API Records

   ESTADO DE DESARROLLO (importante)
   ---------------------------------------------------------------------
   Hoy está hecha TODA la interfaz: el selector de catálogo, la lista de
   servicios predefinidos y el cuadro de "añadir por URL". Lo que NO está
   hecho todavía es la ALGORITMIA que decide qué tipo de capa es una URL
   (`detectarTipoDeCapa`): ahora mismo es un esqueleto que devuelve null y
   avisa en el cuadro de estado. Cuando se implemente, el resto del plugin
   (añadir la capa al mapa, el estado, el cambio 2D/3D) ya está preparado
   para ello: solo hay que rellenar esa función.

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

  /**
   * Servicios predefinidos del catálogo IDEE.
   * Fuentes: el complemento serviciosIDEE2QGIS
   * (https://github.com/IngenieroGeomatico/serviciosIDEE2QGIS), que es la
   * referencia de este tipo de catálogo.
   */
  const SERVICIOS_IDEE = [
    {
      nombre: 'Callejero (WMS)',
      url: 'https://www.ign.es/wms-inspire/ign-base',
      tipo: 'WMS',
      capa: 'IGNBaseTodo',
      descripcion: 'Callejero y toponimia de España'
    },
    {
      nombre: 'Mapa base (WMS)',
      url: 'https://www.ign.es/wms-inspire/mapa-raster',
      tipo: 'WMS',
      capa: 'mtn_rasterizado',
      descripcion: 'Mapa base raster del IGN'
    },
    {
      nombre: 'Ortofoto PNOA (WMS)',
      url: 'https://www.ign.es/wms-inspire/pnoa-ma',
      tipo: 'WMS',
      capa: 'OI.OrthoimageCoverage',
      descripcion: 'Ortofoto del Plan Nacional de Ortofotografía Aérea'
    },
    {
      nombre: 'Unidades administrativas (WMS)',
      url: 'https://www.ign.es/wms-inspire/unidades-administrativas',
      tipo: 'WMS',
      capa: 'AU.AdministrativeUnit',
      descripcion: 'Límites provinciales y municipales'
    },
    {
      nombre: 'Catálogo de PNOA (WMS)',
      url: 'https://www.ign.es/wms-inspire/pnoa-ma',
      tipo: 'WMS',
      capa: 'OI.OrthoimageCoverage',
      descripcion: 'Cobertura de ortofotos PNOA'
    },
    {
      nombre: 'Red de transportes (WMS)',
      url: 'https://www.ign.es/wms-inspire/transportes',
      tipo: 'WMS',
      capa: 'TN.RoadLink',
      descripcion: 'Carreteras y red viaria'
    },
    {
      nombre: 'Hidrografía (WMS)',
      url: 'https://www.ign.es/wms-inspire/hidrografia',
      tipo: 'WMS',
      capa: 'HY.PhysicalWaters.Waterbodies',
      descripcion: 'Ríos, embalses y masas de agua'
    },
    {
      nombre: 'Ocupación del suelo (WMS)',
      url: 'https://www.ign.es/wms-inspire/ocupacion-suelo',
      tipo: 'WMS',
      capa: 'LC.LandCoverSurfaces',
      descripcion: 'Corine Land Cover y SIOSE'
    }
  ];

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
   * Los tipos de catálogo. Cada uno con su lista y su cargador de URLs.
   * `cargarUrl` es lo que habrá que implementar por tipo cuando se haga la
   * algoritmia de detección (hoy es el mismo esqueleto para todos).
   */
  const CATALOGOS = {
    idee: {
      id: 'idee',
      nombre: 'Catálogo IDEE',
      listar: function () { return SERVICIOS_IDEE; },
      cargarUrl: function (url, mapa) { return cargarUrlGenerica(url, mapa, 'idee'); }
    },
    stac: {
      id: 'stac',
      nombre: 'STAC',
      listar: function () { return SERVICIOS_STAC; },
      cargarUrl: function (url, mapa) { return cargarUrlGenerica(url, mapa, 'stac'); }
    },
    'ogcapi-records': {
      id: 'ogcapi-records',
      nombre: 'OGC API Records',
      listar: function () { return SERVICIOS_OGCAPI; },
      cargarUrl: function (url, mapa) { return cargarUrlGenerica(url, mapa, 'ogcapi-records'); }
    }
  };

  /**
   * Carga una URL en el mapa.
   *
   *  ESTA ES LA FUNCIÓN QUE HABRÁ QUE ESCRIBIR CON LA ALGORITMIA DE DETECCIÓN.
   *  Hoy es un esqueleto: no decide nada y devuelve null. Cuando se
   *  implemente, tendrá que:
   *    1. Mirar la URL (¿termina en .geojson? ¿es un GetCapabilities? ¿lleva
   *       SERVICE=WMS?).
   *    2. Si hace falta, pedir el documento (capabilities, colección STAC,
   *       registro OGC API) y leerlo.
   *    3. Crear la capa correspondiente con IDEE.layer.<tipo>({...}) y
   *       añadirla al mapa con mapajs.addLayers(capa).
   *    4. Devolver la capa creada (o null si no se pudo).
   *
   *  Mientras tanto, el resto del plugin ya está preparado: el cuadro de
   *  estado, el refresco de la lista y el cambio 2D/3D funcionan igual.
   *
   * @param {string} url URL pegada por el usuario.
   * @param {Object} mapa Instancia del mapa API-IDEE.
   * @param {string} tipoCatalogo Tipo de catálogo activo (pista, no obligación).
   * @returns {Object|null} La capa creada, o null.
   */
  function cargarUrlGenerica(url, mapa, tipoCatalogo) {
    // TODO(algoritmia): decidir el tipo de capa a partir de la URL y cargarla.
    // Por ahora solo se anota en el estado para que el usuario vea que el
    // plugin ha entendido la petición.
    console.info('[catalogo] cargarUrl pendiente de la algoritmia:', url, '(catálogo ' + tipoCatalogo + ')');
    return null;
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
            '<p>Catálogo de servicios y capas para cargar en el mapa.</p>' +
            '<p>Elige un tipo de catálogo en el desplegable (Catálogo IDEE, STAC ' +
            'u OGC API Records) y pulsa <strong>Cargar</strong> en cualquiera de ' +
            'sus servicios, o pega la URL de un servicio o archivo publicado ' +
            'por http/https en <strong>Añadir por URL</strong>.</p>' +
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

      this._aplicarIcono(panel.getElement ? panel.getElement() : null);
      // No se refresca la lista aquí: la vista del control todavía no existe.
    }

    /** Construye la interfaz del plugin dentro del control. */
    _construirUI() {
      const self = this;
      const IDEE = api();

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

      // --- Selector de catálogo
      const selector = document.createElement('select');
      selector.className = 'catalogo__selector';
      selector.setAttribute('aria-label', 'Tipo de catálogo');
      Object.keys(CATALOGOS).forEach(function (id) {
        const op = document.createElement('option');
        op.value = id;
        op.textContent = CATALOGOS[id].nombre;
        if (id === self._tipoSeleccionado) op.selected = true;
        selector.appendChild(op);
      });
      selector.addEventListener('change', function () {
        self._tipoSeleccionado = this.value;
        self._refrescarLista();
      });
      contents.appendChild(selector);

      // --- Lista de servicios predefinidos del catálogo activo
      const lista = document.createElement('div');
      lista.className = 'catalogo__lista';
      contents.appendChild(lista);
      this._listaEl = lista;

      // --- Añadir por URL
      const cajaUrl = document.createElement('div');
      cajaUrl.className = 'catalogo__url';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'catalogo__url-input';
      input.placeholder = 'https://... (servicio o archivo)';
      input.value = this._urlIntroducida;
      input.setAttribute('aria-label', 'URL del servicio o archivo');
      input.addEventListener('input', function () { self._urlIntroducida = this.value; });
      cajaUrl.appendChild(input);

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'catalogo__url-boton';
      boton.textContent = 'Añadir por URL';
      boton.addEventListener('click', function () { self._cargarUrl(input.value); });
      cajaUrl.appendChild(boton);

      contents.appendChild(cajaUrl);

      // --- Cuadro de estado (éxitos, avisos y errores)
      const estado = document.createElement('div');
      estado.className = 'catalogo__estado';
      estado.setAttribute('role', 'status');
      contents.appendChild(estado);
      this._estadoEl = estado;

      // La lista se pinta aquí y no en addTo: addTo se llama antes de que la
      // API construya la vista del control, así que _listaEl aún sería null.
      this._refrescarLista();

      return container;
    }

    /** (Re)dibuja la lista de servicios del catálogo activo. */
    _refrescarLista() {
      const self = this; // el forEach de abajo es function(), no flecha: sin esto 'this' no es el plugin
      if (!this._listaEl) return;
      const tipo = CATALOGOS[this._tipoSeleccionado];
      if (!tipo) return;

      this._listaEl.innerHTML = '';
      const servicios = tipo.listar();

      if (!servicios.length) {
        const vacio = document.createElement('p');
        vacio.className = 'catalogo__vacio';
        vacio.textContent = 'Este catálogo todavía no tiene servicios predefinidos.';
        this._listaEl.appendChild(vacio);
        return;
      }

      servicios.forEach(function (servicio) {
        const fila = document.createElement('div');
        fila.className = 'catalogo__item';

        const texto = document.createElement('div');
        texto.className = 'catalogo__item-texto';
        const nombre = document.createElement('span');
        nombre.className = 'catalogo__item-nombre';
        nombre.textContent = servicio.nombre;
        texto.appendChild(nombre);
        if (servicio.descripcion) {
          const desc = document.createElement('span');
          desc.className = 'catalogo__item-desc';
          desc.textContent = servicio.descripcion;
          texto.appendChild(desc);
        }
        fila.appendChild(texto);

        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'catalogo__item-boton';
        boton.textContent = 'Cargar';
        boton.addEventListener('click', function () { self._cargarServicio(servicio); });
        fila.appendChild(boton);

        self._listaEl.appendChild(fila);
      });
    }

    /** Carga uno de los servicios predefinidos del catálogo activo. */
    _cargarServicio(servicio) {
      this._decir('Cargando ' + servicio.nombre + '…');
      // Los servicios predefinidos ya saben lo que son, así que se cargan
      // directamente por URL: la algoritmia de detección es la misma.
      const capa = this._cargarUrl(servicio.url, servicio.nombre);
      if (capa) this._decir('Cargado: ' + servicio.nombre);
    }

    /**
     * Carga una URL en el mapa.
     * @param {string} url URL pegada por el usuario (o de un servicio predefinido).
     * @param {string} [nombre] Nombre opcional para la capa.
     * @returns {Object|null} La capa creada, o null.
     */
    _cargarUrl(url, nombre) {
      const limpio = String(url || '').trim();
      if (!limpio) {
        this._decir('Pega primero una URL.', 'aviso');
        return null;
      }
      if (!/^https?:\/\//i.test(limpio)) {
        this._decir('La URL tiene que empezar por http:// o https://', 'aviso');
        return null;
      }

      const tipo = CATALOGOS[this._tipoSeleccionado];
      const capa = tipo.cargarUrl(limpio, this._map);
      if (!capa) {
        // La algoritmia todavía no decide: se avisa y se deja la URL guardada
        // para cuando esté.
        this._decir('URL anotada: ' + limpio + ' (pendiente de la algoritmia de detección)', 'aviso');
      }
      return capa;
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
        panelCollapsed: panelCollapsed
      };
    }

    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      if (state.tipo && CATALOGOS[state.tipo]) {
        this._tipoSeleccionado = state.tipo;
      }
      if (typeof state.url === 'string') {
        this._urlIntroducida = state.url;
      }
      if (typeof state.mensaje === 'string') {
        this._ultimoMensaje = state.mensaje;
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
      const raiz = this._listaEl ? this._listaEl.parentNode : null;
      if (!raiz) return;
      const selector = raiz.querySelector('.catalogo__selector');
      if (selector) selector.value = this._tipoSeleccionado;
      const input = raiz.querySelector('.catalogo__url-input');
      if (input) input.value = this._urlIntroducida;
      this._refrescarLista();
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
      this._listaEl = null;
      this._estadoEl = null;
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