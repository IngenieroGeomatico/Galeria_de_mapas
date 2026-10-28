/* =====================================================================
   PLUGIN: LEYENDA DE CAPAS
   Repositorio: Galeria_de_mapas (API-IDEE / API-CNIG)
   =====================================================================

   DESCRIPCIÓN:
   Muestra la leyenda de las capas de un visualizador. El panel tiene dos
   partes:

     - Selector de capas: una lista de casillas con las capas superpuestas
       del mapa. Se puede marcar más de una a la vez.
     - Resultados: una tarjeta por cada capa marcada, con su leyenda.

   De dónde sale cada leyenda:
     - Servicios OGC (WMS / WMTS): de la leyenda publicada por el servicio,
       es decir, de `getLegendURL()` (GetLegendGraphic en WMS y la
       `LegendURL` de las capacidades en WMTS). Si la capa WMS no trae
       leyenda propia se construye la petición GetLegendGraphic.
     - Capas vectoriales: del estilo de la API (`IDEE.style.*`). Se
       recorren sus entradas cuando el estilo las tiene (categorías,
       rangos de agrupación, intervalos de coropletas, composición de
       estilos...) y, si no, se usa la imagen del estilo completo.
     - Capas ráster (GeoTIFF / COG): de las bandas del fichero. Con una
       banda se dibuja una rampa de grises; con tres o cuatro, los canales
       RGB y el alfa.

   CONTRATO DE ESTADO:
   Implementa `getState()` / `setState(state, map)` para sobrevivir al
   cambio de implementación 2D/3D (`ext/cambioImpl`). La selección se
   guarda por identificadores estables (`legend` / `name`), nunca solo por
   `idLayer`, porque al cambiar de implementación los `idLayer` se
   regeneran. `setState` resuelve primero por `legend`, después por `name`
   y, como último recurso, por `idLayer`.

   OJO CON EL NOMBRE:
   En `ext/CalidadAireMadridTiempoReal/CalidadAireMadridTiempoReal.js`
   existe otra clase `miPlugin_leyenda` (la leyenda fija de ese visor). Si
   se cargan los dos ficheros en la misma página, la segunda exposición
   global pisa a la primera. No conviene cargar ambos en el mismo visor.
   ===================================================================== */

(function () {
  "use strict";

  /** Patrón de las imágenes de leyenda genéricas de la API. */
  var LEYENDA_POR_DEFECTO = /legend-(default|error)\.png/i;

  /** Tiempo máximo de espera de los metadatos de una fuente ráster. */
  var ESPERA_METADATOS_MS = 6000;

  /**
   * Resuelve el objeto global de la API cartográfica (IDEE en las builds
   * modernas o M en las históricas).
   * @returns {Object} Espacio de nombres de la API-IDEE / API-CNIG.
   */
  function api() {
    return window.IDEE || window.M;
  }

  /**
   * ¿La capa es un grupo de capas?
   * @param {Object} capa Capa de la API.
   * @returns {boolean}
   */
  function esGrupo(capa) {
    return Boolean(
      capa && (
        capa.type === 'LayerGroup' ||
        capa._type === 'LayerGroup' ||
        typeof capa.getLayers === 'function'
      )
    );
  }

  /**
   * Nombre visible de una capa. Se prefiere `legend`, que es el nombre
   * humano, y se cae a `name` y al `idLayer`.
   * @param {Object} capa Capa de la API.
   * @returns {string}
   */
  function nombreCapa(capa) {
    if (!capa) return 'Capa sin nombre';
    if (capa.legend !== undefined && capa.legend !== null && String(capa.legend).trim() !== '') {
      return String(capa.legend);
    }
    if (capa.name !== undefined && capa.name !== null && String(capa.name).trim() !== '') {
      return String(capa.name);
    }
    return capa.idLayer ? String(capa.idLayer) : 'Capa sin nombre';
  }

  /**
   * Identificador estable de una capa para la selección y el estado.
   * @param {Object} capa Capa de la API.
   * @returns {string}
   */
  function identCapa(capa) {
    if (!capa) return '';
    if (capa.legend !== undefined && capa.legend !== null && String(capa.legend).trim() !== '') {
      return String(capa.legend);
    }
    if (capa.name !== undefined && capa.name !== null && String(capa.name).trim() !== '') {
      return String(capa.name);
    }
    return capa.idLayer ? String(capa.idLayer) : '';
  }

  /**
   * ¿Es una URL de leyenda genérica de la API?
   * @param {string} url URL a comprobar.
   * @returns {boolean}
   */
  function esLeyendaPorDefecto(url) {
    return typeof url === 'string' && LEYENDA_POR_DEFECTO.test(url);
  }

  /**
   * Convierte una URL relativa en absoluta. Las URLs de datos y las
   * absolutas se devuelven tal cual.
   * @param {string} url URL de la leyenda.
   * @returns {string|null}
   */
  function normalizarUrl(url) {
    if (typeof url !== 'string') return null;
    var limpia = url.trim();
    if (!limpia) return null;
    if (/^(data:|blob:|https?:|\/\/)/i.test(limpia)) return limpia;
    try {
      return new URL(limpia, document.baseURI).href;
    } catch (e) {
      return limpia;
    }
  }

  /**
   * Etiqueta legible de un rango de agrupación (Cluster).
   * @param {number} min Valor mínimo.
   * @param {number} max Valor máximo.
   * @returns {string}
   */
  function etiquetaRango(min, max) {
    var numero = function (valor) {
      if (valor === null || valor === undefined || valor === '') return null;
      var n = Number(valor);
      return isFinite(n) ? n : null;
    };
    var a = numero(min);
    var b = numero(max);
    if (a === null && b === null) return 'Rango';
    if (a === null) return '≤ ' + b;
    if (b === null) return '≥ ' + a;
    return a + ' – ' + b;
  }

  /**
   * Etiqueta legible de un intervalo de coropletas. Los cortes de la API
   * son los límites superiores de cada clase.
   * @param {Array<number>} cortes Cortes (`breakPoints_`).
   * @param {number} indice Índice de la clase.
   * @returns {string}
   */
  function etiquetaCorte(cortes, indice) {
    var numero = function (valor) {
      if (valor === null || valor === undefined) return null;
      var n = Number(valor);
      return isFinite(n) ? n : null;
    };
    var inicio = indice > 0 ? numero(cortes[indice - 1]) : null;
    var fin = numero(cortes[indice]);
    if (inicio === null && fin !== null) return '≤ ' + fin;
    if (inicio !== null && fin !== null) return inicio + ' < x ≤ ' + fin;
    if (inicio !== null && fin === null) return '> ' + inicio;
    return 'Intervalo ' + (indice + 1);
  }

  /**
   * Crea un elemento con clase y texto opcionales.
   * @param {string} etiqueta Etiqueta HTML.
   * @param {string} [clase] Clase CSS.
   * @param {string} [texto] Texto.
   * @returns {HTMLElement}
   */
  function crearElemento(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  /**
   * Envuelve contenido suelto de un SVG en un `<svg>` de 24x24.
   * @param {string} contenido Contenido interior del SVG.
   * @returns {string} SVG completo.
   */
  function envolverSvg(contenido) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
      + contenido + '</svg>';
  }

  /**
   * Codifica un SVG para meterlo en un data URI.
   * @param {string} svg SVG completo.
   * @returns {string}
   */
  function codificarSvg(svg) {
    return encodeURIComponent(svg)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\'/g, '%27')
      .replace(/\+/g, '%20');
  }

  /**
   * Convierte el icono del constructor en un `url(...)` para una máscara
   * CSS. Acepta el SVG completo, solo su contenido interior o una URL.
   * @param {string} icono Icono en cualquiera de las tres formas.
   * @returns {string|null}
   */
  function urlDeIcono(icono) {
    if (typeof icono !== 'string') return null;
    var limpio = icono.trim();
    if (!limpio) return null;

    var esUrl = /^(data:|https?:|blob:|file:|\/|\.\/|\.\.\/)/i.test(limpio)
      || /\.svg(?:[?#].*)?$/i.test(limpio);
    if (esUrl) {
      return 'url("' + limpio.replace(/"/g, '%22').replace(/\s/g, '%20') + '")';
    }

    var traeSvg = /<svg[\s>]/i.test(limpio);
    var traeForma = /<(path|circle|rect|line|polyline|polygon|ellipse|g|use|symbol|text)\b/i.test(limpio);
    if (!traeSvg && !traeForma) return null;

    var svg = traeSvg ? limpio : envolverSvg(limpio);
    return 'url("data:image/svg+xml,' + codificarSvg(svg) + '")';
  }

  /**
   * Clase principal del plugin de leyendas.
   */
  class miPlugin_leyenda {
    /**
     * @param {Object} [options={}] Opciones de configuración.
     * @param {string} [options.position='TR'] Esquina del panel ('TL', 'TR', 'BL', 'BR').
     * @param {number} [options.order=null] Valor CSS `order` del panel dentro de su esquina.
     * @param {boolean} [options.collapsible=true] Si el panel se puede plegar.
     * @param {Object|string} [options.color1] Fondo del botón.
     * @param {Object|string} [options.color2] Borde del botón.
     * @param {Object|string} [options.color3] Color del icono/texto.
     * @param {string} [options.icon] Icono propio del botón (SVG o URL).
     * @param {string} [options.title='Leyenda'] Título del panel.
     * @param {boolean} [options.autoVisible=true] Marca al arrancar las capas visibles.
     * @param {Array<string>} [options.excluir=[]] Nombres o `legend` de capas que no se listan.
     * @param {boolean} [options.incluirCapasBase=false] Si se listan también las capas base.
     */
    constructor(options) {
      var opts = options || {};
      this.name = 'miPlugin_leyenda';
      this.options = opts;

      this._map = null;
      this._panel = null;
      this._control = null;

      // TR por defecto: en la esquina inferior izquierda los visores suelen
      // colgar la barra de escala y coordenadas (ext/mapInfo), que taparía el
      // pie del panel.
      this.position = opts.position || 'TR';
      this.collapsible = (opts.collapsible !== undefined) ? Boolean(opts.collapsible) : true;
      this.order = (opts.order !== undefined && opts.order !== null && !Number.isNaN(Number(opts.order)))
        ? Number(opts.order)
        : null;

      this.color1 = (opts.color1 !== undefined) ? opts.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (opts.color2 !== undefined) ? opts.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (opts.color3 !== undefined) ? opts.color3 : { active: '#71A7D3', deactive: '#ffffff' };
      this.icon = opts.icon || opts.icono || opts.svg || null;

      this._titulo = (opts.title !== undefined) ? String(opts.title) : 'Leyenda';
      this._autoVisible = (opts.autoVisible !== undefined) ? Boolean(opts.autoVisible) : true;
      this._incluirCapasBase = (opts.incluirCapasBase !== undefined) ? Boolean(opts.incluirCapasBase) : false;
      this._excluir = Array.isArray(opts.excluir) ? opts.excluir.map(String) : [];

      // Estado de la interfaz
      this._seleccion = new Set();
      this._inicializado = false;
      this._cacheLeyendas = new Map();
      this._renderToken = 0;
      this._refrescoTimer = null;
      this._eventosMapa = [];
      this._onMapaLayersChanged = null;

      // Reintentos de las leyendas que aún no se pueden resolver: el canvas
      // de un estilo vectorial y las capacidades de un OGC no están listos en
      // el instante en que se monta el panel.
      this._reintentos = 0;
      this._reintentoTimer = null;

      // Referencias al DOM
      this._contenedor = null;
      this._listaEl = null;
      this._resultadosEl = null;
      this._contadorEl = null;
      this._btnRefrescar = null;
    }

    /**
     * Normaliza un color a la estructura { active, deactive }.
     * @param {Object|string} color Color simple u objeto.
     * @returns {{active: string, deactive: string}}
     */
    resolveColor(color) {
      return (typeof color === 'object' && color !== null)
        ? { active: color.active, deactive: color.deactive }
        : { active: color, deactive: color };
    }

    /**
     * Información de ayuda para el gestor de ayuda de la API.
     * @returns {{title: string, content: Promise<HTMLElement|string>}}
     */
    getHelp() {
      var IDEE = api();
      return {
        title: 'Leyenda de capas',
        content: new Promise(function (resolve) {
          var html = '<div>'
            + '<p>Muestra la leyenda de las capas superpuestas del mapa. '
            + 'Marca en la lista las capas cuya leyenda quieras ver: se pueden '
            + 'mostrar varias a la vez.</p>'
            + '<p>En los servicios OGC se usa la leyenda publicada por el servicio '
            + '(GetLegendGraphic o la LegendURL de las capacidades). En las capas '
            + 'vectoriales se dibuja a partir del estilo de la API y, en los ráster, '
            + 'a partir de las bandas del fichero.</p>'
            + '</div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            try { html = IDEE.utils.stringToHtml(html); } catch (e) { /* sin conversor */ }
          }
          resolve(html);
        }),
      };
    }

    // =====================================================================
    // HELPERS DE BÚSQUEDA DE CAPAS (2D / 3D)
    // =====================================================================
    // Los idLayer cambian al alternar OpenLayers y Cesium. `legend` y `name`
    // son estables y permiten reencontrar la capa en el mapa nuevo.

    /**
     * Busca una capa por su idLayer, recorriendo grupos anidados.
     * @param {Object} mapRef Instancia del mapa.
     * @param {string} id idLayer.
     * @returns {Object|null}
     */
    _findLayerByIdInMap(mapRef, id) {
      if (!mapRef || typeof mapRef.getLayers !== 'function' || id === null || id === undefined) {
        return null;
      }
      try {
        var allLayers = mapRef.getLayers() || [];
        var pila = [];
        for (var i = 0; i < allLayers.length; i += 1) {
          var l = allLayers[i];
          if (l && String(l.idLayer) === String(id)) return l;
          if (esGrupo(l)) pila.push(l);
        }
        while (pila.length > 0) {
          var g = pila.pop();
          var hijos = [];
          try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
          for (var j = 0; j < hijos.length; j += 1) {
            var h = hijos[j];
            if (h && String(h.idLayer) === String(id)) return h;
            if (esGrupo(h)) pila.push(h);
          }
        }
      } catch (e) {
        /* sin coincidencia */
      }
      return null;
    }

    /**
     * Busca una capa por su `legend` o su `name`, recorriendo grupos anidados.
     * @param {Object} mapRef Instancia del mapa.
     * @param {string} ident Identificador estable.
     * @returns {Object|null}
     */
    _findLayerByLegendInMap(mapRef, ident) {
      if (!mapRef || typeof mapRef.getLayers !== 'function' || !ident) return null;
      try {
        var coincide = function (c) {
          return Boolean(c && (
            (c.legend !== undefined && c.legend !== null && String(c.legend) === String(ident)) ||
            (c.name !== undefined && c.name !== null && String(c.name) === String(ident))
          ));
        };
        var allLayers = mapRef.getLayers() || [];
        var pila = [];
        for (var i = 0; i < allLayers.length; i += 1) {
          var l = allLayers[i];
          if (coincide(l)) return l;
          if (esGrupo(l)) pila.push(l);
        }
        while (pila.length > 0) {
          var g = pila.pop();
          var hijos = [];
          try { hijos = (typeof g.getLayers === 'function') ? g.getLayers() : []; } catch (e) { hijos = []; }
          for (var j = 0; j < hijos.length; j += 1) {
            var h = hijos[j];
            if (coincide(h)) return h;
            if (esGrupo(h)) pila.push(h);
          }
        }
      } catch (e) {
        /* sin coincidencia */
      }
      return null;
    }

    // =====================================================================
    // CONTRATO DE ESTADO (CAMBIO 2D / 3D)
    // =====================================================================

    /**
     * Estado actual del panel: capas marcadas y estado plegado.
     * @returns {Object}
     */
    getState() {
      var seleccion = [];
      var self = this;
      this._seleccion.forEach(function (ident) {
        var capa = self._capaPorIdent(ident);
        if (capa) {
          seleccion.push({
            ident: ident,
            legend: (capa.legend !== undefined && capa.legend !== null) ? String(capa.legend) : null,
            name: (capa.name !== undefined && capa.name !== null) ? String(capa.name) : null,
            idLayer: (capa.idLayer !== undefined && capa.idLayer !== null) ? String(capa.idLayer) : null,
          });
        } else {
          seleccion.push({ ident: ident });
        }
      });
      return {
        seleccion: seleccion,
        panelCollapsed: this._estadoPanelPlegado(),
      };
    }

    /**
     * Restaura el estado en la instancia nueva tras el cambio 2D/3D.
     * @param {Object} state Estado capturado con getState().
     * @param {Object} [map] Mapa nuevo.
     */
    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      var mapRef = map || this._map;
      if (map) this._map = map;

      if (Array.isArray(state.seleccion)) {
        var seleccion = [];
        var self = this;
        state.seleccion.forEach(function (item) {
          if (typeof item === 'string') {
            if (item) seleccion.push(item);
            return;
          }
          if (!item || typeof item !== 'object') return;
          var capa = null;
          if (item.legend) capa = self._findLayerByLegendInMap(mapRef, item.legend);
          if (!capa && item.name) capa = self._findLayerByLegendInMap(mapRef, item.name);
          if (!capa && item.idLayer) capa = self._findLayerByIdInMap(mapRef, item.idLayer);
          if (capa) {
            seleccion.push(identCapa(capa));
          } else if (item.ident) {
            seleccion.push(item.ident);
          }
        });
        this._seleccion = new Set(seleccion);
        this._inicializado = true;
      }

      if (typeof state.panelCollapsed === 'boolean' && this._panel) {
        try {
          if (state.panelCollapsed && typeof this._panel.collapse === 'function') {
            this._panel.collapse();
          } else if (!state.panelCollapsed && typeof this._panel.open === 'function') {
            this._panel.open();
          }
        } catch (e) {
          console.warn(this.name + ': no se pudo restaurar el estado del panel.', e);
        }
      }

      // La lista se repinta cuando el mapa nuevo ya tiene sus capas.
      var self = this;
      setTimeout(function () {
        try { self._refrescarLista(); } catch (e) { /* sin panel todavía */ }
      }, 0);
    }

    /**
     * Estado plegado del panel, con los dos patrones de la API.
     * @returns {boolean}
     */
    _estadoPanelPlegado() {
      if (!this._panel) return true;
      if (this._panel._collapsed !== undefined) return !!this._panel._collapsed;
      if (typeof this._panel.getElement === 'function') {
        var el = this._panel.getElement();
        return el ? el.classList.contains('collapsed') : true;
      }
      return true;
    }

    // =====================================================================
    // CICLO DE VIDA: MONTAJE EN EL MAPA
    // =====================================================================

    /**
     * Pinta el icono propio del botón, si el constructor recibió uno.
     * @param {HTMLElement} panelEl Elemento del panel.
     */
    _aplicarIcono(panelEl) {
      if (!panelEl || !panelEl.style || !this.icon) return;
      var url = urlDeIcono(this.icon);
      if (!url) {
        console.warn(this.name + ': el icono no parece un SVG ni una URL; se usa el de la API.');
        return;
      }
      try {
        panelEl.style.setProperty('--g-plugin-icon-mask', url);
      } catch (e) {
        console.warn(this.name + ': no se pudo aplicar el icono.', e);
      }
    }

    /**
     * Monta el panel, el control y los listeners del plugin.
     * @param {Object} map Instancia del mapa.
     */
    addTo(map) {
      this._map = map;
      var IDEE = api();
      if (!IDEE || !IDEE.ui || !IDEE.Control) {
        console.error(this.name + ': no se encontró el objeto global de la API (IDEE/M).');
        return;
      }

      var pos = (IDEE.ui.position && IDEE.ui.position[this.position])
        ? IDEE.ui.position[this.position]
        : (IDEE.ui.position ? IDEE.ui.position.TL : 'TL');

      var panel = new IDEE.ui.Panel('tools_leyenda', {
        collapsible: this.collapsible,
        className: 'g-herramienta_leyenda',
        collapsedButtonClass: 'm-tools',
        position: pos,
        order: this.order,
      });
      this._panel = panel;

      var control = new IDEE.Control(new IDEE.impl.Control(), 'controlLeyenda');
      this._control = control;

      // La API usa equals() para distinguir controles al retirarlos. Tiene
      // que ser estricto: un equals laxo desregistraría los controles de
      // los demás plugins al quitar este.
      control.equals = function (other) {
        return other === this;
      };

      var self = this;
      control.createView = function () {
        return self._crearVista();
      };

      panel.addControls(control);
      map.addPanels(panel);

      // Colores configurables del panel.
      var c1 = this.resolveColor(this.color1);
      var c2 = this.resolveColor(this.color2);
      var c3 = this.resolveColor(this.color3);
      var aplicarColores = function () {
        var panelEl = (typeof panel.getElement === 'function')
          ? panel.getElement()
          : document.querySelector('.m-panel.g-herramienta_leyenda');
        if (!panelEl || !panelEl.style) return false;
        panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
        panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
        panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
        panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
        panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
        panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
        if (self.icon) {
          panelEl.classList.add('leyenda-icono-propio');
          self._aplicarIcono(panelEl);
        }
        return true;
      };
      try {
        if (!aplicarColores()) setTimeout(aplicarColores, 0);
      } catch (e) {
        /* panel aún sin elemento */
      }

      this._engancharEventos(map);
      this._refrescarLista();

      try {
        if (control && typeof control.activate === 'function') control.activate();
      } catch (e) {
        console.warn(this.name + ': no se pudo activar el control.', e);
      }
    }

    /**
     * Engancha los eventos de capas del mapa. Se guardan los nombres para
     * poder desengancharlos en destroy().
     * @param {Object} map Instancia del mapa.
     */
    _engancharEventos(map) {
      var IDEE = api();
      if (!IDEE || !IDEE.evt || !map || typeof map.on !== 'function') return;
      var nombres = [
        'ADDED_LAYER', 'REMOVED_LAYER', 'ADDED_LAYERGROUP',
        'ADDED_WMS', 'ADDED_WMTS', 'ADDED_WFS', 'ADDED_TMS', 'ADDED_XYZ',
        'ADDED_VECTOR_TILE', 'ADDED_GEOTIFF', 'ADDED_OGCAPIFEATURES',
        'COMPLETED',
      ];
      var self = this;
      this._onMapaLayersChanged = function () {
        if (self._refrescoTimer) clearTimeout(self._refrescoTimer);
        self._refrescoTimer = setTimeout(function () {
          self._refrescoTimer = null;
          try { self._refrescarLista(); } catch (e) { /* panel cerrado */ }
        }, 150);
      };
      this._eventosMapa = [];
      nombres.forEach(function (nombre) {
        var evento = IDEE.evt[nombre];
        if (!evento) return;
        try {
          map.on(evento, self._onMapaLayersChanged);
          self._eventosMapa.push(nombre);
        } catch (e) {
          /* evento no soportado por esta implementación */
        }
      });
    }

    /**
     * Construye la vista del panel.
     * @returns {HTMLElement}
     */
    _crearVista() {
      var container = document.createElement('div');
      container.className = 'm-control m-container m-herramienta leyenda-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Leyenda de las capas');

      var header = document.createElement('header');
      header.className = 'm-herramienta-header leyenda-header';
      header.setAttribute('role', 'heading');
      header.setAttribute('aria-level', '3');
      header.setAttribute('tabindex', '0');

      var titulo = crearElemento('span', 'leyenda-titulo', this._titulo);
      header.appendChild(titulo);

      var btnRefrescar = document.createElement('button');
      btnRefrescar.type = 'button';
      btnRefrescar.className = 'leyenda-btn-refrescar';
      btnRefrescar.title = 'Actualizar leyendas';
      btnRefrescar.setAttribute('aria-label', 'Actualizar leyendas');
      btnRefrescar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>';
      var self = this;
      btnRefrescar.addEventListener('click', function () { self._onRefrescar(); });
      header.appendChild(btnRefrescar);

      var body = document.createElement('div');
      body.className = 'm-herramienta-contents leyenda-body';

      var selector = document.createElement('div');
      selector.className = 'leyenda-selector';
      var cabeceraSelector = document.createElement('div');
      cabeceraSelector.className = 'leyenda-selector-cabecera';
      cabeceraSelector.appendChild(crearElemento('span', 'leyenda-selector-titulo', 'Capas'));
      var contador = crearElemento('span', 'leyenda-contador', '0');
      cabeceraSelector.appendChild(contador);
      selector.appendChild(cabeceraSelector);

      var lista = document.createElement('ul');
      lista.className = 'leyenda-lista';
      lista.setAttribute('role', 'group');
      lista.setAttribute('aria-label', 'Capas con leyenda');
      selector.appendChild(lista);
      body.appendChild(selector);

      var resultados = document.createElement('div');
      resultados.className = 'leyenda-resultados';
      resultados.setAttribute('aria-live', 'polite');
      body.appendChild(resultados);

      container.appendChild(header);
      container.appendChild(body);

      this._contenedor = container;
      this._listaEl = lista;
      this._resultadosEl = resultados;
      this._contadorEl = contador;
      this._btnRefrescar = btnRefrescar;

      this._refrescarLista();
      return container;
    }

    /**
     * Rehace la lista de capas y repinta las leyendas seleccionadas.
     */
    _refrescarLista() {
      if (!this._listaEl || !this._map) return;

      var capas = this._recogerCapas();
      var self = this;

      // Quita de la selección las capas que ya no están en el mapa.
      var identsVivos = new Set();
      capas.forEach(function (item) { identsVivos.add(item.ident); });
      Array.from(this._seleccion).forEach(function (ident) {
        if (!identsVivos.has(ident)) self._seleccion.delete(ident);
      });

      // Un cambio en las capas del mapa abre un nuevo ciclo de reintentos.
      this._reintentos = 0;

      // La primera vez se marcan las capas visibles.
      if (!this._inicializado) {
        if (this._autoVisible) {
          capas.forEach(function (item) {
            if (self._esVisible(item.capa)) self._seleccion.add(item.ident);
          });
        }
        this._inicializado = true;
      }

      this._listaEl.innerHTML = '';
      if (!capas.length) {
        var vacio = document.createElement('li');
        vacio.className = 'leyenda-vacio';
        vacio.textContent = 'No hay capas superpuestas.';
        this._listaEl.appendChild(vacio);
      } else {
        capas.forEach(function (item) {
          var li = document.createElement('li');
          li.className = 'leyenda-fila';
          var visible = self._esVisible(item.capa);
          if (!visible) li.classList.add('leyenda-fila-oculta');

          var label = document.createElement('label');
          label.className = 'leyenda-opcion';

          var check = document.createElement('input');
          check.type = 'checkbox';
          check.className = 'leyenda-check';
          check.checked = self._seleccion.has(item.ident);
          check.dataset.ident = item.ident;
          check.addEventListener('change', function () {
            if (check.checked) self._seleccion.add(item.ident);
            else self._seleccion.delete(item.ident);
            self._reintentos = 0;
            self._renderResultados();
          });

          var nombre = crearElemento('span', 'leyenda-nombre', item.nombre);
          nombre.title = item.nombre;

          label.appendChild(check);
          label.appendChild(nombre);

          if (item.grupo) {
            label.appendChild(crearElemento('span', 'leyenda-grupo', item.grupo));
          }
          if (!visible) {
            label.appendChild(crearElemento('span', 'leyenda-badge-oculta', 'oculta'));
          }

          li.appendChild(label);
          self._listaEl.appendChild(li);
        });
      }

      if (this._contadorEl) this._contadorEl.textContent = String(this._seleccion.size);
      this._renderResultados();
    }

    /**
     * Capas superpuestas que pueden aparecer en el selector. Los grupos se
     * aplanan y se ordenan por z-index descendente (la capa superior arriba).
     * @returns {Array<{capa: Object, ident: string, nombre: string, grupo: string|null}>}
     */
    _recogerCapas() {
      var salida = [];
      var vistos = new Set();
      var self = this;

      var esCapaBase = function (capa) {
        try {
          if (capa && capa.isBase === true) return true;
          var impl = (capa && typeof capa.getImpl === 'function') ? capa.getImpl() : null;
          return Boolean(impl && impl.isBase === true);
        } catch (e) {
          return false;
        }
      };

      var excluida = function (capa) {
        if (!capa) return true;
        if (esCapaBase(capa)) return true;
        if (!self._incluirCapasBase && capa.isBase === true) return true;
        if (capa.displayInLayerSwitcher === false) return true;
        if (capa.type === 'Terrain' || capa._type === 'Terrain') return true;
        var nombre = String(capa.name || '');
        var legend = String(capa.legend || '');
        if (nombre === '__draw__' || legend === '__draw__') return true;
        if (/^layer_\d+$/.test(nombre) && !esGrupo(capa)) return true;
        if (self._excluir.indexOf(nombre) !== -1 || self._excluir.indexOf(legend) !== -1) return true;
        return false;
      };

      var visitar = function (capa, grupo) {
        if (!capa || excluida(capa)) return;

        if (esGrupo(capa)) {
          var nombreGrupo = nombreCapa(capa);
          var etiquetaGrupo = grupo ? (grupo + ' · ' + nombreGrupo) : nombreGrupo;
          var hijos = [];
          try { hijos = (typeof capa.getLayers === 'function') ? capa.getLayers() : []; } catch (e) { hijos = []; }
          hijos.forEach(function (hijo) { visitar(hijo, etiquetaGrupo); });
          return;
        }

        var idLayer = String(capa.idLayer || '');
        if (idLayer && vistos.has(idLayer)) return;
        if (idLayer) vistos.add(idLayer);

        var ident = identCapa(capa);
        if (!ident) return;
        salida.push({
          capa: capa,
          ident: ident,
          nombre: nombreCapa(capa),
          grupo: grupo || null,
        });
      };

      var capasMapa = [];
      try { capasMapa = this._map.getLayers() || []; } catch (e) { capasMapa = []; }
      capasMapa.forEach(function (capa) { visitar(capa, null); });

      // La capa superior del mapa va arriba en la lista.
      var zDe = function (capa) {
        try {
          if (typeof capa.getZIndex === 'function') {
            var z = Number(capa.getZIndex());
            return isFinite(z) ? z : null;
          }
        } catch (e) { /* sin z */ }
        return null;
      };
      salida.sort(function (a, b) {
        var za = zDe(a.capa);
        var zb = zDe(b.capa);
        if (za === null && zb === null) return 0;
        if (za === null) return 1;
        if (zb === null) return -1;
        return zb - za;
      });

      return salida;
    }

    /**
     * Devuelve la capa correspondiente a un identificador de selección.
     * @param {string} ident Identificador.
     * @returns {Object|null}
     */
    _capaPorIdent(ident) {
      if (!ident) return null;
      var capas = this._recogerCapas();
      for (var i = 0; i < capas.length; i += 1) {
        if (capas[i].ident === ident) return capas[i].capa;
      }
      return null;
    }

    /**
     * ¿La capa está visible?
     * @param {Object} capa Capa de la API.
     * @returns {boolean}
     */
    _esVisible(capa) {
      if (!capa) return false;
      try {
        if (typeof capa.isVisible === 'function') return !!capa.isVisible();
      } catch (e) { /* sin isVisible */ }
      return capa.visibility !== false;
    }

    /**
     * Tipo genérico de la capa: 'vector', 'ogc', 'raster', 'tiles' u 'otro'.
     * @param {Object} capa Capa de la API.
     * @returns {string}
     */
    _tipoCapa(capa) {
      if (!capa) return 'otro';
      var impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
      if (impl && (impl.lector || impl.render)) return 'raster';

      var tipo = String(capa.type || capa._type || '');
      if (!tipo && impl) tipo = String(impl.type || '');
      var t = tipo.toLowerCase();

      var vectoriales = [
        'geojson', 'wfs', 'vector', 'geojsonparser', 'feature', 'mvt',
        'kml', 'csv', 'ogcapifeatures', 'geoparquet', 'flatgeobuf',
        'datoselevacion',
      ];
      if (vectoriales.indexOf(t) !== -1) return 'vector';
      if (t === 'wms' || t === 'wmts') return 'ogc';
      if (t === 'geotiff' || t === 'cog' || t === 'genericraster') return 'raster';
      if (t === 'tms' || t === 'xyz' || t === 'mbtiles' || t === 'pmtiles' || t === 'maplibre') {
        return 'tiles';
      }

      try {
        if (typeof capa.getStyle === 'function' && capa.getStyle()) return 'vector';
      } catch (e) { /* sin estilo */ }
      return 'otro';
    }

    /**
     * Estilo de la API asociado a la capa, si lo tiene.
     * @param {Object} capa Capa de la API.
     * @returns {Object|null}
     */
    _estiloDeCapa(capa) {
      if (!capa) return null;
      try {
        if (typeof capa.getStyle === 'function') {
          var estilo = capa.getStyle();
          if (estilo && typeof estilo === 'object' && typeof estilo.toImage === 'function') {
            return estilo;
          }
        }
      } catch (e) { /* sin estilo */ }
      try {
        var directo = capa.style;
        if (directo && typeof directo === 'object' && typeof directo.toImage === 'function') {
          return directo;
        }
      } catch (e) { /* sin estilo */ }
      return null;
    }

    // =====================================================================
    // RESOLUCIÓN DE LEYENDAS
    // =====================================================================

    /**
     * Repinta las tarjetas de las capas seleccionadas. Las tarjetas se
     * crean ya (con el aviso de carga) y se rellenan en orden.
     */
    async _renderResultados() {
      if (!this._resultadosEl) return;
      var token = ++this._renderToken;
      this._resultadosEl.innerHTML = '';

      var capas = this._recogerCapas();
      var self = this;
      var seleccionadas = capas.filter(function (item) {
        return self._seleccion.has(item.ident);
      });

      if (this._contadorEl) this._contadorEl.textContent = String(seleccionadas.length);
      if (!seleccionadas.length) {
        this._resultadosEl.appendChild(this._mensaje('Selecciona una o varias capas para ver su leyenda.'));
        return;
      }

      var tarjetas = [];
      seleccionadas.forEach(function (item) {
        var tarjeta = self._crearTarjeta(item);
        self._resultadosEl.appendChild(tarjeta);
        tarjetas.push({ item: item, tarjeta: tarjeta });
      });

      var pendientes = 0;
      for (var i = 0; i < tarjetas.length; i += 1) {
        if (token !== this._renderToken) return;
        var pendiente = await this._rellenarTarjeta(tarjetas[i].item, tarjetas[i].tarjeta, token);
        if (pendiente) pendientes += 1;
      }

      // Alguna leyenda aún no se ha podido resolver (la capa sigue cargando):
      // se reintenta en unos segundos.
      if (pendientes > 0) this._programarReintento();
    }

    /**
     * Programa un reintento de las leyendas que siguen sin resolverse. El
     * canvas de los estilos vectoriales y las capacidades de los servicios
     * OGC no están listos en el instante en que se monta el panel, y su
     * primera resolución puede devolver "sin leyenda".
     */
    _programarReintento() {
      if (this._reintentos >= 3 || this._reintentoTimer) return;
      var self = this;
      this._reintentos += 1;
      this._reintentoTimer = setTimeout(function () {
        self._reintentoTimer = null;
        var capas = self._recogerCapas();
        capas.forEach(function (item) {
          if (self._seleccion.has(item.ident)) self._cacheLeyendas.delete(item.ident);
        });
        try {
          self._renderResultados();
        } catch (e) {
          /* panel cerrado */
        }
      }, 1500);
    }

    /**
     * Crea la tarjeta vacía de una capa.
     * @param {{capa: Object, ident: string, nombre: string}} item Capa.
     * @returns {HTMLElement}
     */
    _crearTarjeta(item) {
      var article = document.createElement('article');
      article.className = 'leyenda-tarjeta';
      article.dataset.ident = item.ident;

      var cabecera = document.createElement('header');
      cabecera.className = 'leyenda-tarjeta-cabecera';

      var titulo = crearElemento('h4', 'leyenda-tarjeta-titulo', item.nombre);
      titulo.title = item.nombre;
      cabecera.appendChild(titulo);

      var self = this;
      var quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'leyenda-tarjeta-quitar';
      quitar.title = 'Ocultar esta leyenda';
      quitar.setAttribute('aria-label', 'Ocultar la leyenda de ' + item.nombre);
      quitar.textContent = '×';
      quitar.addEventListener('click', function () {
        self._seleccion.delete(item.ident);
        self._reintentos = 0;
        if (self._listaEl) {
          var checks = self._listaEl.querySelectorAll('input.leyenda-check');
          for (var i = 0; i < checks.length; i += 1) {
            if (checks[i].dataset.ident === item.ident) checks[i].checked = false;
          }
        }
        self._renderResultados();
      });
      cabecera.appendChild(quitar);

      var cuerpo = document.createElement('div');
      cuerpo.className = 'leyenda-tarjeta-cuerpo';
      cuerpo.appendChild(crearElemento('p', 'leyenda-cargando', 'Cargando leyenda…'));

      article.appendChild(cabecera);
      article.appendChild(cuerpo);
      return article;
    }

    /**
     * Resuelve la leyenda de una capa y la pinta en su tarjeta.
     * @param {Object} item Capa.
     * @param {HTMLElement} tarjeta Tarjeta.
     * @param {number} token Token del render en curso.
     */
    async _rellenarTarjeta(item, tarjeta, token) {
      var cuerpo = tarjeta.querySelector('.leyenda-tarjeta-cuerpo');
      if (!cuerpo) return false;
      try {
        var leyenda = await this._resolverLeyenda(item.capa);
        if (token !== this._renderToken) return false;
        cuerpo.innerHTML = '';
        this._pintarLeyenda(cuerpo, leyenda, item);
        return Boolean(leyenda && leyenda.tipo === 'texto');
      } catch (e) {
        if (token !== this._renderToken) return false;
        cuerpo.innerHTML = '';
        this._pintarError(cuerpo, 'No se pudo obtener la leyenda de esta capa.');
        return true;
      }
    }

    /**
     * Resuelve la leyenda de una capa con caché por identificador.
     * @param {Object} capa Capa de la API.
     * @returns {Promise<Object>}
     */
    async _resolverLeyenda(capa) {
      var clave = identCapa(capa);
      if (clave && this._cacheLeyendas.has(clave)) {
        try {
          return await this._cacheLeyendas.get(clave);
        } catch (e) {
          this._cacheLeyendas.delete(clave);
        }
      }

      var resuelta = await this._resolverLeyendaSinCache(capa);
      // Los resultados "sin leyenda" no se cachean: pueden deberse a que la
      // capa aún no ha cargado (el canvas del estilo o las capacidades del
      // servicio todavía no están listos) y conviene reintentarlos.
      if (clave && resuelta && resuelta.tipo !== 'texto') {
        this._cacheLeyendas.set(clave, Promise.resolve(resuelta));
      }
      return resuelta;
    }

    /**
     * Estrategia de resolución: estilo vectorial, leyenda del servicio y,
     * por último, bandas del ráster.
     * @param {Object} capa Capa de la API.
     * @returns {Promise<Object>}
     */
    async _resolverLeyendaSinCache(capa) {
      var estilo = this._estiloDeCapa(capa);
      if (estilo) {
        try {
          var porEstilo = await this._leyendaDeEstilo(estilo, capa);
          if (porEstilo) return porEstilo;
        } catch (e) {
          /* se intenta la leyenda del servicio */
        }
      }

      try {
        var url = await this._legendUrlDeCapa(capa);
        if (url) return { tipo: 'imagen', url: url, fuente: 'servicio' };
      } catch (e) {
        /* se intentan las bandas */
      }

      try {
        var bandas = await this._leyendaDeBandas(capa);
        if (bandas) return bandas;
      } catch (e) {
        /* sin metadatos de bandas */
      }

      return { tipo: 'texto', texto: 'Esta capa no publica leyenda.' };
    }

    /**
     * Construye la leyenda a partir de un estilo de la API.
     * @param {Object} estilo Estilo de la API.
     * @param {Object} capa Capa a la que pertenece.
     * @returns {Promise<Object|null>}
     */
    async _leyendaDeEstilo(estilo, capa) {
      if (!estilo) return null;

      // Proportional: el propio estilo dibuja la leyenda con los valores
      // mínimo y máximo y los tamaños extremos.
      if (typeof estilo.getMinRadius === 'function' && typeof estilo.getMaxRadius === 'function') {
        var imgProporcional = await this._imagenDeEstilo(estilo);
        if (imgProporcional) {
          return { tipo: 'imagen', url: imgProporcional, nota: 'Tamaño proporcional al valor' };
        }
      }

      // Category: una entrada por categoría, con el nombre de la categoría.
      if (typeof estilo.getCategories === 'function') {
        var categorias = estilo.getCategories() || {};
        var claves = Object.keys(categorias);
        var entradasCategorias = [];
        for (var i = 0; i < claves.length; i += 1) {
          var imgCategoria = await this._imagenDeEstilo(categorias[claves[i]]);
          if (imgCategoria) {
            entradasCategorias.push({ etiqueta: claves[i], imagen: imgCategoria });
          }
        }
        if (entradasCategorias.length) {
          return { tipo: 'entradas', entradas: entradasCategorias, nota: 'Categorías' };
        }
      }

      // Cluster: una entrada por rango de agrupación.
      if (typeof estilo.getRanges === 'function') {
        var rangos = estilo.getRanges() || [];
        var entradasRangos = [];
        for (var j = 0; j < rangos.length; j += 1) {
          var rango = rangos[j];
          var imgRango = await this._imagenDeEstilo(rango && rango.style);
          if (imgRango) {
            entradasRangos.push({
              etiqueta: etiquetaRango(rango && rango.min, rango && rango.max),
              imagen: imgRango,
            });
          }
        }
        if (entradasRangos.length) {
          return { tipo: 'entradas', entradas: entradasRangos, nota: 'Rangos' };
        }
      }

      // Choropleth: una entrada por intervalo, con los cortes del estilo.
      if (typeof estilo.getChoroplethStyles === 'function') {
        var estilosCoropleta = estilo.getChoroplethStyles() || [];
        var cortes = Array.isArray(estilo.breakPoints_) ? estilo.breakPoints_ : [];
        var entradasCoropleta = [];
        for (var k = 0; k < estilosCoropleta.length; k += 1) {
          var imgCoropleta = await this._imagenDeEstilo(estilosCoropleta[k]);
          if (imgCoropleta) {
            entradasCoropleta.push({
              etiqueta: etiquetaCorte(cortes, k),
              imagen: imgCoropleta,
            });
          }
        }
        if (entradasCoropleta.length) {
          return { tipo: 'entradas', entradas: entradasCoropleta, nota: 'Intervalos' };
        }
      }

      // Heatmap: el estilo dibuja una barra de degradado con los pesos.
      if (typeof estilo.getGradient === 'function') {
        var imgCalor = await this._imagenDeEstilo(estilo);
        if (imgCalor) {
          return { tipo: 'imagen', url: imgCalor, nota: 'Densidad (mapa de calor)' };
        }
      }

      // Composite: varias entradas, una por sub-estilo.
      if (typeof estilo.getStyles === 'function') {
        var subEstilos = estilo.getStyles() || [];
        var entradasCompuestas = [];
        for (var m = 0; m < subEstilos.length; m += 1) {
          var imgSub = await this._imagenDeEstilo(subEstilos[m]);
          if (imgSub) {
            entradasCompuestas.push({
              etiqueta: this._etiquetaSubEstilo(subEstilos[m], m),
              imagen: imgSub,
            });
          }
        }
        if (entradasCompuestas.length === 1) {
          return { tipo: 'imagen', url: entradasCompuestas[0].imagen };
        }
        if (entradasCompuestas.length > 1) {
          return { tipo: 'entradas', entradas: entradasCompuestas, nota: 'Composición de estilos' };
        }
      }

      // Estilo único (Generic, Point, Line, Polygon, Simple, FlowLine, Chart...).
      var imgUnica = await this._imagenDeEstilo(estilo);
      if (imgUnica) return { tipo: 'imagen', url: imgUnica };
      return null;
    }

    /**
     * Etiqueta de un sub-estilo de composición, según su geometría.
     * @param {Object} subEstilo Estilo.
     * @param {number} indice Índice.
     * @returns {string}
     */
    _etiquetaSubEstilo(subEstilo, indice) {
      try {
        var opciones = (subEstilo && typeof subEstilo.getOptions === 'function')
          ? subEstilo.getOptions()
          : null;
        if (opciones) {
          if (opciones.point) return 'Puntos';
          if (opciones.line) return 'Líneas';
          if (opciones.polygon) return 'Polígonos';
        }
      } catch (e) { /* sin opciones */ }
      return 'Estilo ' + (indice + 1);
    }

    /**
     * Convierte el `toImage()` de un estilo en un data URL válido. Rechaza
     * los canvas vacíos y reintenta una vez tras `updateCanvas()`.
     * @param {Object} estilo Estilo de la API.
     * @returns {Promise<string|null>}
     */
    async _imagenDeEstilo(estilo) {
      if (!estilo || typeof estilo.toImage !== 'function') return null;

      var imagen = null;
      try {
        imagen = estilo.toImage();
        if (imagen && typeof imagen.then === 'function') imagen = await imagen;
      } catch (e) {
        return null;
      }
      if (typeof imagen !== 'string' || !imagen) return null;

      if (await this._imagenVacia(imagen)) {
        // El canvas del estilo puede no haberse actualizado todavía.
        try {
          if (typeof estilo.updateCanvas === 'function') estilo.updateCanvas();
          var imagen2 = estilo.toImage();
          if (imagen2 && typeof imagen2.then === 'function') imagen2 = await imagen2;
          if (typeof imagen2 === 'string' && imagen2 && !(await this._imagenVacia(imagen2))) {
            return imagen2;
          }
        } catch (e) {
          /* sin reintento */
        }
        return null;
      }
      return imagen;
    }

    /**
     * ¿La imagen es un canvas completamente transparente? Solo se comprueba
     * con data URLs: las imágenes remotas pueden contaminar el canvas.
     * @param {string} dataUrl Imagen.
     * @returns {Promise<boolean>}
     */
    _imagenVacia(dataUrl) {
      if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:') !== 0) {
        return Promise.resolve(false);
      }
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try {
            var ancho = img.naturalWidth || img.width;
            var alto = img.naturalHeight || img.height;
            if (!ancho || !alto) {
              resolve(true);
              return;
            }
            var canvas = document.createElement('canvas');
            canvas.width = ancho;
            canvas.height = alto;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            var datos = ctx.getImageData(0, 0, ancho, alto).data;
            for (var i = 3; i < datos.length; i += 4) {
              if (datos[i] !== 0) {
                resolve(false);
                return;
              }
            }
            resolve(true);
          } catch (e) {
            resolve(false);
          }
        };
        img.onerror = function () { resolve(true); };
        img.src = dataUrl;
      });
    }

    /**
     * Leyenda publicada por el servicio (OGC) o por el estilo vectorial.
     * @param {Object} capa Capa de la API.
     * @returns {Promise<string|null>}
     */
    async _legendUrlDeCapa(capa) {
      var url = null;
      try {
        if (capa && typeof capa.getLegendURL === 'function') {
          url = capa.getLegendURL();
          if (url && typeof url.then === 'function') url = await url;
        }
      } catch (e) {
        url = null;
      }

      if (typeof url === 'string' && url && !esLeyendaPorDefecto(url)) {
        if (!(await this._imagenVacia(url))) return normalizarUrl(url);
      }

      // WMS sin leyenda propia: se construye el GetLegendGraphic.
      var wms = this._getLegendGraphicWms(capa);
      if (wms) return wms;
      return null;
    }

    /**
     * Construye una petición GetLegendGraphic para una capa WMS.
     * @param {Object} capa Capa WMS.
     * @returns {string|null}
     */
    _getLegendGraphicWms(capa) {
      if (!capa) return null;
      var tipo = String(capa.type || capa._type || '').toUpperCase();
      if (tipo !== 'WMS') return null;

      var base = null;
      try { base = Array.isArray(capa.url) ? capa.url[0] : capa.url; } catch (e) { base = null; }
      if (!base || !capa.name) return null;

      var parametros = new URLSearchParams();
      parametros.set('SERVICE', 'WMS');
      parametros.set('VERSION', capa.version || '1.3.0');
      parametros.set('REQUEST', 'GetLegendGraphic');
      parametros.set('LAYER', capa.name);
      parametros.set('FORMAT', 'image/png');
      parametros.set('SLD_VERSION', '1.1.0');
      if (capa.styles) {
        var estilos = Array.isArray(capa.styles) ? capa.styles.join(',') : capa.styles;
        if (estilos) parametros.set('STYLE', estilos);
      }
      return base + (base.indexOf('?') >= 0 ? '&' : '?') + parametros.toString();
    }

    /**
     * Leyenda de una capa ráster a partir de sus bandas.
     * @param {Object} capa Capa de la API.
     * @returns {Promise<Object|null>}
     */
    async _leyendaDeBandas(capa) {
      var info = await this._infoBandas(capa);
      if (!info || !info.bandas) return null;
      return {
        tipo: 'bandas',
        bandas: info.bandas,
        alfa: !!info.alfa,
        rgb: !!info.rgb,
        bandsCfg: info.bandsCfg || null,
        ancho: info.ancho || null,
        alto: info.alto || null,
        nodata: (info.nodata !== undefined) ? info.nodata : null,
      };
    }

    /**
     * Lee el número de bandas de un GeoTIFF en 2D (OpenLayers) o en 3D
     * (Cesium). Devuelve null si la capa no es un ráster con bandas.
     * @param {Object} capa Capa de la API.
     * @returns {Promise<Object|null>}
     */
    async _infoBandas(capa) {
      if (!capa) return null;
      var impl = (typeof capa.getImpl === 'function') ? capa.getImpl() : null;
      if (!impl) return null;

      // 2D: fuente de teselas GeoTIFF de OpenLayers.
      var fuente = null;
      try {
        if (impl.olLayer && typeof impl.olLayer.getSource === 'function') {
          fuente = impl.olLayer.getSource();
        }
      } catch (e) {
        fuente = null;
      }

      if (fuente) {
        var esFuenteGeoTIFF = ('samplesPerPixel_' in fuente)
          || ('convertToRGB_' in fuente)
          || ('addAlpha_' in fuente)
          || ('bandCount' in fuente);
        if (esFuenteGeoTIFF) {
          if (!fuente.samplesPerPixel_ && !fuente.bandCount) {
            await this._esperarMetadatosFuente(fuente);
          }
          var muestras = fuente.samplesPerPixel_;
          if (Array.isArray(muestras)) muestras = muestras[0];
          var bandas = Number(muestras);
          if (!bandas && fuente.bandCount) {
            bandas = Number(fuente.bandCount) - (fuente.addAlpha_ ? 1 : 0);
          }
          if (bandas > 0) {
            return {
              bandas: bandas,
              alfa: !!fuente.addAlpha_ || (Number(fuente.bandCount) > bandas),
              rgb: fuente.convertToRGB_ === true || fuente.convertToRGB_ === 'auto' || bandas >= 3,
              bandsCfg: Array.isArray(impl.bands_) ? impl.bands_ : null,
              ancho: null,
              alto: null,
              fuente: '2D',
              nodata: impl.nodata_,
            };
          }
        }
      }

      // 3D: el lector del GeoTIFF de ext/geotiffLayer.
      var lector = impl.lector;
      if (lector && typeof lector._imagenPrincipal === 'function') {
        try {
          var imagen = await lector._imagenPrincipal();
          var bandas3D = Number(imagen.getSamplesPerPixel());
          if (bandas3D > 0) {
            var alfa3D = false;
            var nodata3D = null;
            try {
              var directorio = (typeof imagen.getFileDirectory === 'function')
                ? imagen.getFileDirectory()
                : null;
              if (directorio) {
                var extra = directorio.ExtraSamples || directorio.extraSamples;
                if (extra) {
                  var lista = Array.isArray(extra) ? extra : [extra];
                  alfa3D = lista.some(function (v) {
                    return Number(v) === 1 || Number(v) === 2;
                  });
                }
                var brutoNodata = directorio.GDAL_NODATA || directorio.gdalNodata;
                if (brutoNodata !== undefined && brutoNodata !== null && brutoNodata !== '') {
                  var n = Number(String(brutoNodata).trim());
                  if (isFinite(n)) nodata3D = n;
                }
              }
            } catch (e) { /* sin alfa ni nodata */ }

            return {
              bandas: bandas3D,
              alfa: alfa3D,
              rgb: bandas3D >= 3,
              bandsCfg: Array.isArray(impl.bands_) ? impl.bands_ : null,
              ancho: (typeof imagen.getWidth === 'function') ? imagen.getWidth() : null,
              alto: (typeof imagen.getHeight === 'function') ? imagen.getHeight() : null,
              fuente: '3D',
              nodata: nodata3D,
            };
          }
        } catch (e) {
          /* sin metadatos */
        }
      }

      return null;
    }

    /**
     * Espera a que la fuente ráster tenga sus metadatos. La fuente de
     * OpenLayers los rellena de forma asíncrona tras leer el fichero.
     * @param {Object} fuente Fuente de OpenLayers.
     * @returns {Promise<void>}
     */
    _esperarMetadatosFuente(fuente) {
      return new Promise(function (resolve) {
        var terminado = false;
        var finalizar = function () {
          if (terminado) return;
          terminado = true;
          try { if (typeof fuente.un === 'function') fuente.un('change', alCambiar); } catch (e) { /* ignora */ }
          resolve();
        };
        var alCambiar = function () {
          if (fuente.samplesPerPixel_ || fuente.bandCount) finalizar();
        };
        try {
          if (typeof fuente.getState === 'function' && fuente.getState() === 'error') {
            finalizar();
            return;
          }
          if (typeof fuente.on === 'function') fuente.on('change', alCambiar);
          else {
            finalizar();
            return;
          }
        } catch (e) {
          finalizar();
          return;
        }
        setTimeout(finalizar, ESPERA_METADATOS_MS);
      });
    }

    // =====================================================================
    // PINTADO DE LA LEYENDA
    // =====================================================================

    /**
     * Pinta en el cuerpo de una tarjeta la leyenda resuelta.
     * @param {HTMLElement} cuerpo Contenedor.
     * @param {Object} leyenda Resultado de la resolución.
     * @param {Object} item Capa.
     */
    _pintarLeyenda(cuerpo, leyenda, item) {
      if (!leyenda) {
        this._pintarError(cuerpo, 'No se pudo obtener la leyenda.');
        return;
      }

      if (leyenda.tipo === 'bandas') {
        this._pintarBandas(cuerpo, leyenda);
        return;
      }

      if (leyenda.tipo === 'entradas' && Array.isArray(leyenda.entradas) && leyenda.entradas.length) {
        if (leyenda.nota) cuerpo.appendChild(this._nota(leyenda.nota));
        var lista = document.createElement('ul');
        lista.className = 'leyenda-entradas';
        leyenda.entradas.forEach(function (entrada) {
          var li = document.createElement('li');
          li.className = 'leyenda-entrada';
          if (entrada.imagen) {
            var img = document.createElement('img');
            img.className = 'leyenda-entrada-imagen';
            img.src = entrada.imagen;
            img.alt = '';
            img.loading = 'lazy';
            li.appendChild(img);
          }
          li.appendChild(crearElemento('span', 'leyenda-entrada-etiqueta', entrada.etiqueta || ''));
          lista.appendChild(li);
        });
        cuerpo.appendChild(lista);
        return;
      }

      if (leyenda.tipo === 'imagen' && leyenda.url) {
        if (leyenda.nota) cuerpo.appendChild(this._nota(leyenda.nota));
        var self = this;
        var imagen = document.createElement('img');
        imagen.className = 'leyenda-imagen';
        imagen.src = leyenda.url;
        imagen.alt = 'Leyenda de ' + item.nombre;
        imagen.loading = 'lazy';
        imagen.addEventListener('error', function () {
          cuerpo.innerHTML = '';
          self._pintarError(cuerpo, 'No se pudo cargar la imagen de la leyenda.', leyenda.url);
        });
        cuerpo.appendChild(imagen);
        return;
      }

      if (leyenda.tipo === 'texto' && leyenda.texto) {
        cuerpo.appendChild(crearElemento('p', 'leyenda-texto', leyenda.texto));
        return;
      }

      this._pintarError(cuerpo, 'No se pudo obtener la leyenda.');
    }

    /**
     * Párrafo de nota.
     * @param {string} texto Texto.
     * @returns {HTMLElement}
     */
    _nota(texto) {
      return crearElemento('p', 'leyenda-nota', texto);
    }

    /**
     * Pinta la leyenda de bandas de un ráster.
     * @param {HTMLElement} cuerpo Contenedor.
     * @param {Object} leyenda Datos de bandas.
     */
    _pintarBandas(cuerpo, leyenda) {
      var contenedor = document.createElement('div');
      contenedor.className = 'leyenda-bandas';

      var n = Number(leyenda.bandas) || 0;
      var titulo = '';
      if (n === 1) titulo = '1 banda · escala de grises';
      else if (n === 2) titulo = '2 bandas · valor y transparencia';
      else if (n === 3) titulo = '3 bandas · composición RGB';
      else if (n === 4) titulo = '4 bandas · RGB' + (leyenda.alfa ? ' + alfa' : '');
      else titulo = n + ' bandas';
      contenedor.appendChild(crearElemento('p', 'leyenda-bandas-titulo', titulo));

      if (n === 1 || n === 2) {
        var rampa = document.createElement('div');
        rampa.className = 'leyenda-rampa';
        rampa.setAttribute('role', 'img');
        rampa.setAttribute('aria-label', 'Escala de grises de baja a alta');
        contenedor.appendChild(rampa);

        var extremos = document.createElement('div');
        extremos.className = 'leyenda-rampa-extremos';
        extremos.appendChild(crearElemento('span', '', 'Baja'));
        extremos.appendChild(crearElemento('span', '', 'Alta'));
        contenedor.appendChild(extremos);
      } else {
        var canales = document.createElement('ul');
        canales.className = 'leyenda-canales';
        var nombres = ['Rojo', 'Verde', 'Azul'];
        var clases = ['leyenda-canal-rojo', 'leyenda-canal-verde', 'leyenda-canal-azul'];
        var bandasCfg = Array.isArray(leyenda.bandsCfg) ? leyenda.bandsCfg : [];

        for (var i = 0; i < Math.min(3, n); i += 1) {
          var li = document.createElement('li');
          li.className = 'leyenda-canal';
          li.appendChild(crearElemento('span', 'leyenda-canal-muestra ' + clases[i]));
          var numero = (bandasCfg[i] !== undefined) ? bandasCfg[i] : (i + 1);
          li.appendChild(crearElemento('span', '', nombres[i] + ' · banda ' + numero));
          canales.appendChild(li);
        }

        if (leyenda.alfa) {
          var liAlfa = document.createElement('li');
          liAlfa.className = 'leyenda-canal';
          liAlfa.appendChild(crearElemento('span', 'leyenda-canal-muestra leyenda-canal-alfa'));
          var numeroAlfa = (bandasCfg[3] !== undefined) ? bandasCfg[3] : 4;
          liAlfa.appendChild(crearElemento('span', '', 'Alfa · banda ' + numeroAlfa));
          canales.appendChild(liAlfa);
        }
        contenedor.appendChild(canales);

        if (n > 4) {
          contenedor.appendChild(this._nota('Se muestran las tres primeras bandas.'));
        }
      }

      var detalles = [];
      if (leyenda.ancho && leyenda.alto) detalles.push(leyenda.ancho + ' × ' + leyenda.alto + ' px');
      if (leyenda.nodata !== undefined && leyenda.nodata !== null) {
        detalles.push('NoData: ' + leyenda.nodata);
      }
      if (detalles.length) contenedor.appendChild(this._nota(detalles.join(' · ')));

      cuerpo.appendChild(contenedor);
    }

    /**
     * Pinta un aviso de error, con enlace a la leyenda si hay URL.
     * @param {HTMLElement} cuerpo Contenedor.
     * @param {string} mensaje Mensaje.
     * @param {string} [url] URL de la leyenda.
     */
    _pintarError(cuerpo, mensaje, url) {
      cuerpo.appendChild(crearElemento('p', 'leyenda-error', mensaje));
      if (url) {
        var enlace = document.createElement('a');
        enlace.className = 'leyenda-enlace';
        enlace.href = url;
        enlace.target = '_blank';
        enlace.rel = 'noopener noreferrer';
        enlace.textContent = 'Abrir la leyenda en una pestaña nueva';
        cuerpo.appendChild(enlace);
      }
    }

    /**
     * Mensaje informativo.
     * @param {string} texto Texto.
     * @returns {HTMLElement}
     */
    _mensaje(texto) {
      return crearElemento('p', 'leyenda-mensaje', texto);
    }

    /**
     * Vacía la caché y repinta la lista y las leyendas.
     */
    _onRefrescar() {
      this._cacheLeyendas.clear();
      this._reintentos = 0;
      this._refrescarLista();
    }

    // =====================================================================
    // DESTRUCCIÓN
    // =====================================================================

    /**
     * Desmonta el plugin: suelta los listeners, el control y el panel, y
     * limpia las referencias.
     */
    destroy() {
      try {
        var IDEE = api();
        if (this._map && IDEE && IDEE.evt && typeof this._map.off === 'function' && this._onMapaLayersChanged) {
          for (var i = 0; i < this._eventosMapa.length; i += 1) {
            var evento = IDEE.evt[this._eventosMapa[i]];
            if (evento) this._map.off(evento, this._onMapaLayersChanged);
          }
        }
      } catch (e) {
        /* mapa ya destruido */
      }
      this._eventosMapa = [];
      this._onMapaLayersChanged = null;

      if (this._refrescoTimer) {
        clearTimeout(this._refrescoTimer);
        this._refrescoTimer = null;
      }
      if (this._reintentoTimer) {
        clearTimeout(this._reintentoTimer);
        this._reintentoTimer = null;
      }

      try {
        if (this._map && this._control && typeof this._map.removeControls === 'function') {
          this._map.removeControls([this._control]);
        }
      } catch (e) {
        /* el control puede estar ya fuera */
      }
      try {
        if (this._panel && typeof this._panel.close === 'function') this._panel.close();
      } catch (e) {
        /* el panel puede estar ya cerrado */
      }

      this._panel = null;
      this._control = null;
      this._map = null;
      this._contenedor = null;
      this._listaEl = null;
      this._resultadosEl = null;
      this._contadorEl = null;
      this._btnRefrescar = null;
      this._cacheLeyendas.clear();
      this._renderToken += 1;
    }
  }

  // =====================================================================
  // EXPOSICIÓN TRIPLE GLOBAL
  // =====================================================================
  if (typeof window !== 'undefined') {
    window.miPlugin_leyenda = miPlugin_leyenda;

    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_leyenda = miPlugin_leyenda;

    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_leyenda = miPlugin_leyenda;
  }
})();
