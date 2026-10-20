/* =====================================================================
   PLUGIN DE INFORMACIÓN DEL PUNTO PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   QUÉ HACE:
   Pone en la barra de herramientas un botón de información. Mientras está
   activo, cada clic sobre el mapa pregunta a las capas visibles qué hay en
   ese punto y abre un popup con la respuesta:

     - En capas WMS se pide GetFeatureInfo al servicio. Si el servicio
       declara salida JSON y HTML en sus capacidades, el popup ofrece las dos
       y se puede cambiar de una a otra sin volver a pinchar.
     - En capas vectoriales (GeoJSON, Vector, KML, WFS, OGC API Features,
       MVT, MBTiles vectorial, MapLibre, GenericVector y WKT) se leen los
       features que caen bajo el clic, tanto en 2D como en 3D cuando la
       implementación los dibuja.
     - En capas GeoTIFF se leen los valores reales de sus bandas en el punto,
       en 2D (imágenes del origen de OpenLayers) y en 3D (LectorGeoTIFF de
       ext/geotiffLayer).
     - Con varias capas se abre una pestaña por capa y, dentro de cada una,
       se listan TODOS los features del punto (no solo el primero).
     - La salida JSON, los features vectoriales y las bandas del ráster se
       pintan con plantillas configurables. El plugin trae tres (ficha, tabla
       y json) y admite plantillas propias por constructor o con
       registrarPlantilla().

   EXTRACT:
   Mientras el plugin está añadido al mapa, las capas vectoriales llevan
   `extract` a false si la herramienta está desactivada y a true si está
   activa. Así la API no abre su popup de features cuando el plugin está
   apagado. Las capas que se añadan después se sincronizan con los eventos
   ADDED_LAYER/ADDED_LAYERGROUP, y destroy() devuelve el valor original.

   CURSOR:
   Con la herramienta activa, la vista o el canvas de Cesium llevan la clase
   `g-information-cursor`, que pinta una cruz de precisión con una insignia
   "i" (SVG) y deja `help` como respaldo.

   SIN PANEL:
   El plugin no tiene panel: solo un botón de 40x40 en la barra. Se reutiliza
   el patrón de cambioImpl, un IDEE.ui.Panel sin `collapsible` (la API le pone
   `no-collapsible`, oculta su botón de plegado y deja el control a la vista).
   El estado activo/desactivado se marca con la clase `activated` en el botón.

   CONTRATO DE ESTADO:
   Implementa getState()/setState(state, map) para sobrevivir al cambio 2D/3D:
   se conservan el estado activo, las preferencias de formato/plantilla por
   capa y, si el popup estaba abierto, el último punto consultado. Las
   preferencias se guardan con una clave estable (legend + name), nunca con
   el idLayer, que cambia al recrear el mapa.

   PLANTILLAS:
   Una plantilla es { id, nombre, descripcion, render(elemento, contexto) }.
   `render` devuelve HTML (string) o un HTMLElement. `elemento` llega ya
   normalizado:
     {
       propiedades, campos: [{clave, etiqueta, valor, texto}], titulo, id,
       geometria: { tipo, coordenadas } | null, crudo, fuente, capa
     }
   `contexto` ofrece ayudas: escapar(), texto(), etiqueta(), campo(), json(),
   ademas de plugin, capa, formato, plantilla, indice y total.
   ===================================================================== */

(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /**
   * Icono del botón: `img/iconos/icono-informacion.svg`, del pack "Modern UI
   * Icons" de SVG Repo (https://www.svgrepo.com/svg/369975/cursor-information).
   * Va en línea, y no como `<img>` ni como fondo CSS, para que el `fill` sea
   * `currentColor` y herede el color3 del botón. El `viewBox` es el original;
   * el tamaño lo pone el CSS.
   */
  var SVG_ICONO_INFORMACION = '<svg xmlns="http://www.w3.org/2000/svg"'
    + ' class="g-information-icono" viewBox="0 0 76 76"'
    + ' aria-hidden="true" focusable="false">'
    + '<path fill="currentColor" fill-opacity="1" stroke-width="0.2"'
    + ' stroke-linejoin="round" d="M 22.975,18L 46.225,41.1667L 37.0615,42.6585'
    + 'L 44.792,56.6949L 37.802,60.4115L 29.975,46.25L 22.975,53.25L 22.975,18 Z'
    + ' M 49.5,19C 54.1944,19 58,22.8056 58,27.5C 58,32.1944 54.1944,36 49.5,36'
    + 'C 44.8056,36 41,32.1944 41,27.5C 41,22.8056 44.8056,19 49.5,19 Z'
    + ' M 47.375,25.375L 47.375,26.7917L 48.7916,26.7917L 48.7916,31.75L 47.375,31.75'
    + 'L 47.375,33.1667L 52.3333,33.1667L 52.3333,31.75L 50.9166,31.75L 50.9166,26.7917'
    + 'L 50.9166,25.375L 47.375,25.375 Z'
    + ' M 49.8542,21.8333C 49.2674,21.8333 48.7917,22.309 48.7917,22.8958'
    + 'C 48.7917,23.4826 49.2674,23.9583 49.8542,23.9583C 50.441,23.9583 50.9167,23.4826'
    + ' 50.9167,22.8958C 50.9167,22.309 50.441,21.8333 49.8542,21.8333 Z "/></svg>';

  // Etiquetas TIFF que no se pintan, pero deciden si el píxel tiene
  // información: alfa (ExtraSamples) y valor nodata (GDAL_NODATA).
  var TAG_EXTRA_SAMPLES = 338;
  var TAG_GDAL_NODATA = 42113;

  // ---------------------------------------------------------------------
  // Utilidades generales
  // ---------------------------------------------------------------------

  /**
   * Devuelve el objeto global de la API activa. En este repositorio conviven
   * `IDEE` y `M` como alias; se prefiere el que tenga la interfaz y el mapa.
   */
  function api() {
    var IDEE = global.IDEE;
    if (IDEE && IDEE.ui && IDEE.map) return IDEE;
    var M = global.M;
    if (M && M.ui && M.map) return M;
    return IDEE || M || null;
  }

  function esFuncion(valor) {
    return typeof valor === 'function';
  }

  /** Escapa un valor para insertarlo como texto o como atributo HTML. */
  function escaparHtml(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Convierte cualquier valor de un feature a un texto legible. */
  function aTexto(valor) {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (typeof valor === 'number') {
      if (!isFinite(valor)) return String(valor);
      try {
        return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(valor);
      } catch (e) {
        return String(valor);
      }
    }
    if (typeof valor === 'object') {
      try {
        return JSON.stringify(valor);
      } catch (e) {
        return String(valor);
      }
    }
    return String(valor);
  }

  /** Humaniza el nombre de un campo: `fecha_alta` -> `Fecha alta`. */
  function nombreCampo(clave) {
    if (clave === null || clave === undefined || clave === '') return '';
    var texto = String(clave)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    if (!texto) return '';
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function normalizarLista(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor === null || valor === undefined || valor === '') return [];
    return [valor];
  }

  /**
   * Normaliza el valor de una banda. geotiff.js puede devolver BigInt en los
   * ficheros de 64 bits y ni `JSON.stringify` ni `Intl.NumberFormat` lo
   * aceptan; se pasa a número si cabe y, si no, a texto.
   */
  function valorRaster(valor) {
    if (typeof valor === 'bigint') {
      var numero = Number(valor);
      return isFinite(numero) ? numero : String(valor);
    }
    return valor;
  }

  /**
   * Lee un campo del directorio de una imagen de geotiff.js. Las imágenes
   * abiertas con `fromUrl`/`fromBlob` pueden tener el `fileDirectory` perezoso:
   * los campos resueltos viven en `actualizedFields` como pares [etiqueta,
   * valor], no como propiedades. Sin esto se perdería la rotación del GeoTIFF.
   */
  function campoImagen(imagen, nombre, etiqueta) {
    var fd = imagen && imagen.fileDirectory;
    if (!fd) return null;
    if (fd[nombre] !== undefined) return fd[nombre];
    var campos = fd.actualizedFields;
    if (campos && typeof campos.get === 'function') {
      var valor = campos.get(etiqueta);
      if (valor !== undefined) return valor;
    }
    if (Array.isArray(campos)) {
      for (var i = 0; i < campos.length; i += 1) {
        var par = campos[i];
        if (par && par[0] === etiqueta) return par[1];
      }
    }
    return null;
  }

  /**
   * Normaliza un color que puede llegar como string o como {active, deactive}.
   * Se mantiene el mismo contrato que los demás plugins del repositorio.
   */
  function normalizarColor(valor, defecto) {
    var base = defecto || { active: '#ffffff', deactive: 'orangered' };
    if (typeof valor === 'string') {
      return { active: valor, deactive: valor };
    }
    if (valor && typeof valor === 'object') {
      var activo = valor.active || valor.activo || valor.deactive || valor.inactivo || base.active;
      var inactivo = valor.deactive || valor.inactivo || valor.active || valor.activo || base.deactive;
      return { active: activo, deactive: inactivo };
    }
    return { active: base.active, deactive: base.deactive };
  }

  /**
   * Busca el primer valor no vacío de una lista de claves, sin distinguir
   * mayúsculas. Sirve para elegir el título de una ficha.
   */
  function buscarValor(propiedades, claves) {
    var props = propiedades || {};
    var porMinusculas = {};
    Object.keys(props).forEach(function (clave) {
      porMinusculas[String(clave).toLowerCase()] = props[clave];
    });
    for (var i = 0; i < claves.length; i += 1) {
      var valor = porMinusculas[String(claves[i]).toLowerCase()];
      if (valor !== null && valor !== undefined && valor !== '') return valor;
    }
    var nombres = Object.keys(props);
    for (var j = 0; j < nombres.length; j += 1) {
      var nombre = nombres[j];
      if (/^_/.test(nombre)) continue;
      var v = props[nombre];
      if (v !== null && v !== undefined && v !== '' && typeof v !== 'object') return v;
    }
    return null;
  }

  /** JSON.stringify defensivo: una propiedad circular no rompe el popup. */
  function jsonSeguro(valor) {
    try {
      return JSON.stringify(valor, null, 2);
    } catch (e) {
      try {
        return String(valor);
      } catch (e2) {
        return '';
      }
    }
  }

  // ---------------------------------------------------------------------
  // Plantillas por defecto
  // ---------------------------------------------------------------------
  // Las plantillas reciben un `elemento` ya normalizado y un `contexto` con
  // helpers. No deben leer nada privado del plugin: con eso se pueden
  // reutilizar tal cual en otros visualizadores.

  var PLANTILLAS_POR_DEFECTO = [
    {
      id: 'ficha',
      nombre: 'Ficha',
      descripcion: 'Título y lista de campos del elemento, uno por línea.',
      render: function (elemento, ctx) {
        var campos = elemento.campos || [];
        var html = '<div class="g-information-ficha">';
        if (elemento.titulo) {
          html += '<h4 class="g-information-ficha-titulo">' + ctx.escapar(elemento.titulo) + '</h4>';
        }
        if (campos.length) {
          html += '<dl class="g-information-ficha-campos">';
          campos.forEach(function (campo) {
            html += '<div class="g-information-ficha-fila">';
            html += '<dt>' + ctx.escapar(campo.etiqueta) + '</dt>';
            html += '<dd>' + ctx.escapar(campo.texto) + '</dd>';
            html += '</div>';
          });
          html += '</dl>';
        } else {
          html += '<p class="g-information-vacio">Sin atributos.</p>';
        }
        if (elemento.geometria && elemento.geometria.tipo) {
          html += '<p class="g-information-geometria">Geometría: ' +
            ctx.escapar(elemento.geometria.tipo) + '</p>';
        }
        html += '</div>';
        return html;
      },
    },
    {
      id: 'tabla',
      nombre: 'Tabla',
      descripcion: 'Tabla de dos columnas con todos los campos.',
      render: function (elemento, ctx) {
        var campos = elemento.campos || [];
        if (!campos.length) {
          return '<p class="g-information-vacio">Sin atributos.</p>';
        }
        var html = '<table class="g-information-tabla">';
        html += '<thead><tr><th>Campo</th><th>Valor</th></tr></thead><tbody>';
        campos.forEach(function (campo) {
          html += '<tr><th scope="row">' + ctx.escapar(campo.etiqueta) + '</th>';
          html += '<td>' + ctx.escapar(campo.texto) + '</td></tr>';
        });
        html += '</tbody></table>';
        if (elemento.geometria && elemento.geometria.tipo) {
          html += '<p class="g-information-geometria">Geometría: ' +
            ctx.escapar(elemento.geometria.tipo) + '</p>';
        }
        return html;
      },
    },
    {
      id: 'json',
      nombre: 'JSON',
      descripcion: 'El elemento original formateado como JSON.',
      render: function (elemento, ctx) {
        return '<pre class="g-information-pre">' + ctx.escapar(ctx.json()) + '</pre>';
      },
    },
  ];

  // ---------------------------------------------------------------------
  // Clase del plugin
  // ---------------------------------------------------------------------

  class miPlugin_information {
    /**
     * @param {Object} [options]
     * @param {string} [options.position='TL'] Esquina de la barra de herramientas.
     * @param {number} [options.order=2] Orden dentro de la esquina.
     * @param {string} [options.buttonTitle] Tooltip/aria-label del botón.
     * @param {Object|string} [options.color1] Fondo (activo/desactivado).
     * @param {Object|string} [options.color2] Borde (activo/desactivado).
     * @param {Object|string} [options.color3] Icono (activo/desactivado).
     * @param {Array|Object} [options.plantillas] Plantillas extra o que sustituyen a las de serie.
     * @param {string} [options.plantillaPorDefecto='ficha'] Plantilla inicial.
     * @param {boolean} [options.mostrarVacios=false] Muestra campos vacíos en las plantillas.
     * @param {Array<string>} [options.camposOcultos] Campos que no se listan.
     * @param {Object} [options.etiquetas] Mapa campo -> etiqueta visible.
     * @param {number} [options.maxFeatures=10] FEATURE_COUNT de GetFeatureInfo.
     * @param {number} [options.buffer=5] Tolerancia en píxeles de la consulta.
     * @param {string} [options.titulo='Información'] Título de las pestañas de aviso.
     * @param {boolean} [options.activo=false] Arranca activo.
     * @param {boolean} [options.debug=false] Muestra errores por consola.
     */
    constructor(options) {
      var opts = options || {};
      this.name = 'miPlugin_information';
      this.options = opts;

      this.position = opts.position || 'TL';
      this.order = (typeof opts.order === 'number') ? opts.order : 2;
      this.buttonTitle = opts.buttonTitle || 'Consultar información del punto';
      this._titulo = opts.titulo || 'Información';

      this._plantillas = this._construirPlantillas(opts.plantillas);
      this._plantillaPorDefecto = this._resolverPlantillaPorDefecto(opts.plantillaPorDefecto);
      this._preferencias = {};

      this._activo = !!opts.activo;
      this._map = null;
      this._panel = null;
      this._control = null;
      this._boton = null;

      this._popup = null;
      this._popupAbierto = false;
      this._resultados = [];
      this._ultimoPunto = null;
      this._coordPopup = null;
      this._pixel = null;
      this._mppActual = 1;
      this._handlers = {};
      this._cursorTarget = null;
      this._cursorPrevio = '';
      this._capsCache = {};
      this._extractPrevios = new Map();
      this._lectoresGeoTIFF = {};
      this._generacion = 0;
      this._tabActivaPendiente = null;
      this._popupsPrevios = [];
      this._capturaPopups = 0;
      this._reabriendo = false;

      this._maxFeatures = (typeof opts.maxFeatures === 'number' && isFinite(opts.maxFeatures))
        ? Math.max(1, Math.floor(opts.maxFeatures)) : 10;
      this._buffer = (typeof opts.buffer === 'number' && isFinite(opts.buffer))
        ? Math.max(0, opts.buffer) : 5;
      this._anchoConsulta = 256;
      this._altoConsulta = 256;

      this._mostrarVacios = !!opts.mostrarVacios;
      this._camposOcultos = {};
      normalizarLista(opts.camposOcultos).forEach(function (clave) {
        this._camposOcultos[String(clave)] = true;
      }, this);
      this._etiquetas = opts.etiquetas || {};
      this._debug = !!opts.debug;

      // Colores por defecto: los mismos que usan los demás botones del
      // repositorio (naranja en reposo, blanco con borde azul al activarse).
      this._colores = {
        fondo: normalizarColor(opts.color1, { active: '#ffffff', deactive: 'orangered' }),
        borde: normalizarColor(opts.color2, { active: '#71A7D3', deactive: '#ffffff' }),
        icono: normalizarColor(opts.color3, { active: '#71A7D3', deactive: '#ffffff' }),
      };
    }

    // ===================================================================
    //  API pública
    // ===================================================================

    /** Ayuda para el gestor de ayuda de la API. */
    getHelp() {
      var IDEE = api();
      return {
        title: 'Información del punto',
        content: new Promise(function (resolve) {
          var html = '<div>' +
            '<p>Consulta qué hay en un punto del mapa. Al activar la herramienta, ' +
            'cada clic pregunta a las capas visibles y abre un popup con la ' +
            'información encontrada.</p>' +
            '<p>En los servicios WMS se usa la operación GetFeatureInfo y se ' +
            'puede alternar entre la salida HTML y JSON si el servicio ofrece ' +
            'las dos. En las capas vectoriales se listan todos los elementos ' +
            'del punto y en los GeoTIFF se muestran los valores de sus bandas. ' +
            'En todos los casos se pueden cambiar las plantillas de ' +
            'presentación.</p>' +
            '</div>';
          if (IDEE && IDEE.utils && esFuncion(IDEE.utils.stringToHtml)) {
            try {
              html = IDEE.utils.stringToHtml(html);
            } catch (e) {
              /* se deja el HTML plano */
            }
          }
          resolve(html);
        }),
      };
    }

    /**
     * Añade o sustituye una plantilla en caliente.
     * @param {{id:string, nombre?:string, descripcion?:string, render:Function}} plantilla
     * @returns {miPlugin_information}
     */
    registrarPlantilla(plantilla) {
      if (!plantilla || !plantilla.id || !esFuncion(plantilla.render)) {
        console.warn(this.name + ': registrarPlantilla necesita { id, render }.');
        return this;
      }
      var normalizada = {
        id: String(plantilla.id),
        nombre: plantilla.nombre || String(plantilla.id),
        descripcion: plantilla.descripcion || '',
        render: plantilla.render,
      };
      var indice = this._plantillas.findIndex(function (p) {
        return p.id === normalizada.id;
      });
      if (indice >= 0) this._plantillas[indice] = normalizada;
      else this._plantillas.push(normalizada);

      // Si el popup está abierto, se repinta en el sitio para no obligar al
      // usuario a volver a pinchar.
      var self = this;
      this._resultados.forEach(function (resultado) {
        self._actualizarTab(resultado);
      });
      return this;
    }

    /** Devuelve una copia de las plantillas disponibles. */
    obtenerPlantillas() {
      return this._plantillas.map(function (p) {
        return { id: p.id, nombre: p.nombre, descripcion: p.descripcion, render: p.render };
      });
    }

    /** Estado que conserva el coordinador EstadoPlugins al cambiar 2D/3D. */
    getState() {
      var preferencias = {};
      Object.keys(this._preferencias).forEach(function (clave) {
        var pref = this._preferencias[clave] || {};
        preferencias[clave] = {
          formato: pref.formato || null,
          plantilla: pref.plantilla || null,
        };
      }, this);
      return {
        activo: !!this._activo,
        preferencias: preferencias,
        popupAbierto: !!(this._popupAbierto && this._popup),
        ultimoPunto: this._ultimoPunto ? {
          lon: this._ultimoPunto.lon,
          lat: this._ultimoPunto.lat,
          altura: this._ultimoPunto.altura || 0,
        } : null,
        tabActiva: this._indiceTabActivo(),
      };
    }

    /** Rehidrata el estado en la instancia nueva tras el cambio 2D/3D. */
    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      this._map = this._map || map || null;

      if (state.preferencias && typeof state.preferencias === 'object') {
        this._preferencias = {};
        Object.keys(state.preferencias).forEach(function (clave) {
          var pref = state.preferencias[clave] || {};
          this._preferencias[clave] = {
            formato: pref.formato || null,
            plantilla: pref.plantilla || null,
          };
        }, this);
      }

      if (state.activo) this._activar(false);
      else this._desactivar(false);

      if (state.activo && state.popupAbierto && state.ultimoPunto) {
        this._tabActivaPendiente = (typeof state.tabActiva === 'number') ? state.tabActiva : 0;
        this._reabrirCuandoListo(state.ultimoPunto, 8);
      } else {
        this._popupAbierto = false;
      }
    }

    // ===================================================================
    //  Ciclo de vida
    // ===================================================================

    addTo(map) {
      this._map = map;
      this._desadjuntarEventosCapas();
      var IDEE = api();
      if (!IDEE || !IDEE.ui || !IDEE.Control) {
        console.error(this.name + ': no se encontró el objeto global de la API (IDEE/M).');
        return;
      }

      var posicion = (IDEE.ui.position && IDEE.ui.position[this.position])
        ? IDEE.ui.position[this.position]
        : (IDEE.ui.position ? IDEE.ui.position.TL : 'TL');

      var panel = new IDEE.ui.Panel('tools_information', {
        className: 'g-herramienta_information',
        collapsedButtonClass: 'm-tools',
        position: posicion,
        order: this.order,
      });

      var control = new IDEE.Control(new IDEE.impl.Control(), 'control_information');
      // equals estricto: el panel compara controles para retirarlos en
      // destroy(). Un equals laxo se llevaría por delante los demás.
      control.equals = function (otro) {
        return otro === this;
      };

      var self = this;
      control.createView = function () {
        var vista = document.createElement('div');
        vista.className = 'm-control g-information-control';
        self._aplicarColores(vista);

        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'g-information-boton';
        boton.innerHTML = SVG_ICONO_INFORMACION;
        boton.title = self.buttonTitle;
        boton.setAttribute('aria-label', self.buttonTitle);
        boton.setAttribute('aria-pressed', self._activo ? 'true' : 'false');
        boton.addEventListener('click', function (evt) {
          evt.preventDefault();
          evt.stopPropagation();
          self._alternarActivo();
        });

        self._boton = boton;
        vista.appendChild(boton);
        self._actualizarBoton();
        return vista;
      };

      panel.addControls(control);
      map.addPanels([panel]);

      this._panel = panel;
      this._control = control;

      // Las capas que ya estaban en el mapa se sincronizan ahora; las que se
      // añadan después las recoge el evento ADDED_LAYER.
      this._adjuntarEventosCapas();
      if (this._activo) {
        this._activar(false);
      } else {
        this._sincronizarExtract(false);
      }
    }

    destroy() {
      this._generacion += 1;
      this._activo = false;
      this._actualizarBoton();
      this._desadjuntarEventos();
      this._desadjuntarEventosCapas();
      this._restaurarExtract();
      this._restaurarCursor();
      this._cerrarPopup();

      try {
        if (this._map && this._control) this._map.removeControls([this._control]);
      } catch (e) {
        /* el mapa puede estar ya destruido */
      }

      this._control = null;
      this._panel = null;
      this._boton = null;
      this._map = null;
      this._resultados = [];
    }

    // ===================================================================
    //  Botón y activación
    // ===================================================================

    _aplicarColores(vista) {
      if (!vista || !vista.style) return;
      vista.style.setProperty('--g-information-fondo-activo', this._colores.fondo.active);
      vista.style.setProperty('--g-information-fondo-inactivo', this._colores.fondo.deactive);
      vista.style.setProperty('--g-information-borde-activo', this._colores.borde.active);
      vista.style.setProperty('--g-information-borde-inactivo', this._colores.borde.deactive);
      vista.style.setProperty('--g-information-icono-activo', this._colores.icono.active);
      vista.style.setProperty('--g-information-icono-inactivo', this._colores.icono.deactive);
    }

    _actualizarBoton() {
      if (!this._boton) return;
      this._boton.classList.toggle('activated', this._activo);
      this._boton.setAttribute('aria-pressed', this._activo ? 'true' : 'false');
    }

    _alternarActivo() {
      if (this._activo) this._desactivar(true);
      else this._activar(true);
    }

    /**
     * @param {boolean} [avisarControl=true] Llama a activate() del control de
     *   la API. En la restauración de estado se puede omitir.
     */
    _activar(avisarControl) {
      if (!this._map) return;
      this._desadjuntarEventos();
      // Si ya estaba activo (por ejemplo, setState sobre una instancia
      // creada con activo:true), no se pisa el cursor original con crosshair.
      this._restaurarCursor();
      this._activo = true;
      this._actualizarBoton();
      // Con la herramienta activa la API puede extraer los features de las
      // capas vectoriales; el popup propio las lee igualmente.
      this._sincronizarExtract(true);
      if (avisarControl !== false && this._control) {
        try { this._control.activate(); } catch (e) { /* sin control */ }
      }
      this._aplicarCursor();
      this._adjuntarEventos();
    }

    _desactivar(avisarControl) {
      this._activo = false;
      this._actualizarBoton();
      // Al desactivar, la API no debe abrir sus popups de features: todas las
      // capas vectoriales se quedan con extract=false.
      this._sincronizarExtract(false);
      if (avisarControl !== false && this._control) {
        try { this._control.deactivate(); } catch (e) { /* sin control */ }
      }
      this._desadjuntarEventos();
      this._restaurarCursor();
      this._generacion += 1;
      this._cerrarPopup();
    }

    _aplicarCursor() {
      var impl = this._getImpl();
      if (!impl) return;
      var target = null;
      if (this._esCesium()) {
        target = impl.scene && impl.scene.canvas ? impl.scene.canvas : null;
      } else {
        target = esFuncion(impl.getViewport) ? impl.getViewport()
          : (esFuncion(impl.getTargetElement) ? impl.getTargetElement() : null);
      }
      if (!target) return;
      this._cursorTarget = target;
      this._cursorPrevio = target.style ? (target.style.cursor || '') : '';
      // La clase pinta una cruz de precisión con una insignia "i" y deja
      // `help` como respaldo si el navegador no puede cargar el SVG.
      if (target.classList && esFuncion(target.classList.add)) {
        target.classList.add('g-information-cursor');
      } else if (target.style) {
        target.style.cursor = 'help';
      }
    }

    _restaurarCursor() {
      if (!this._cursorTarget) {
        this._cursorPrevio = '';
        return;
      }
      var target = this._cursorTarget;
      if (target.classList && esFuncion(target.classList.remove)) {
        target.classList.remove('g-information-cursor');
      }
      if (target.style) target.style.cursor = this._cursorPrevio || '';
      this._cursorTarget = null;
      this._cursorPrevio = '';
    }

    // ===================================================================
    //  Detección de implementación y eventos del mapa
    // ===================================================================

    _getImpl() {
      if (!this._map) return null;
      try {
        return esFuncion(this._map.getMapImpl) ? this._map.getMapImpl() : null;
      } catch (e) {
        return null;
      }
    }

    _esCesium() {
      var impl = this._getImpl();
      return !!(impl && impl.scene && impl.scene.camera && global.Cesium);
    }

    _adjuntarEventos() {
      var impl = this._getImpl();
      if (!impl) return;
      var self = this;

      if (this._esCesium()) {
        var scene = impl.scene;
        if (!scene || !scene.canvas || !global.Cesium) return;
        try {
          var handler = new global.Cesium.ScreenSpaceEventHandler(scene.canvas);
          handler.setInputAction(function (movimiento) {
            if (!self._activo) return;
            var posicion = movimiento && movimiento.position;
            if (!posicion) return;

            var cartesiano = null;
            try {
              var rayo = scene.camera.getPickRay(posicion);
              if (rayo) cartesiano = scene.globe.pick(rayo, scene);
              if (!cartesiano) {
                cartesiano = scene.camera.pickEllipsoid(posicion, scene.globe.ellipsoid);
              }
            } catch (e) {
              cartesiano = null;
            }
            if (!cartesiano) return;

            var cartografica = scene.globe.ellipsoid.cartesianToCartographic(cartesiano);
            if (!cartografica) return;
            var lon = global.Cesium.Math.toDegrees(cartografica.longitude);
            var lat = global.Cesium.Math.toDegrees(cartografica.latitude);
            var altura = cartografica.height || 0;
            var xy = self._reproyectar3857([lon, lat], 'EPSG:4326');
            if (!xy) return;

            self._consultarEnPunto({
              x: xy[0],
              y: xy[1],
              lon: lon,
              lat: lat,
              altura: altura,
            }, [lon, lat, altura], posicion, cartesiano);
          }, global.Cesium.ScreenSpaceEventType.LEFT_CLICK);
          this._handlers.cesium = handler;
          this._adjuntarCapturaPopups(scene.canvas);
        } catch (e) {
          console.warn(this.name + ': no se pudo enganchar el clic de Cesium.', e);
        }
        return;
      }

      if (!esFuncion(impl.addEventListener)) return;
      var objetivo = esFuncion(impl.getViewport)
        ? impl.getViewport()
        : (esFuncion(impl.getTargetElement) ? impl.getTargetElement() : null);
      this._adjuntarCapturaPopups(objetivo);
      var manejador = function (evt) {
        if (!self._activo) return;
        var coord = evt && evt.coordinate;
        if (!coord) return;

        var proyeccion = 'EPSG:3857';
        try {
          proyeccion = impl.getView().getProjection().getCode();
        } catch (e) {
          proyeccion = 'EPSG:3857';
        }

        var xy = (proyeccion === 'EPSG:3857')
          ? [coord[0], coord[1]]
          : self._reproyectar3857(coord, proyeccion);
        if (!xy) return;
        var lonlat = self._reproyectar([xy[0], xy[1]], 'EPSG:3857', 'EPSG:4326');
        if (!lonlat) return;

        self._consultarEnPunto({
          x: xy[0],
          y: xy[1],
          lon: lonlat[0],
          lat: lonlat[1],
          altura: 0,
        }, [coord[0], coord[1]], evt.pixel || null, null);
      };
      impl.addEventListener('singleclick', manejador);
      this._handlers.ol = manejador;
    }

    /**
     * Guarda una foto de los popups abiertos en el pointerdown, antes de que
     * la API procese el singleclick de sus capas vectoriales. Sin esto, el
     * popup de la capa ya estaría abierto cuando arranca nuestra consulta y
     * la limpieza lo confundiría con un popup previo que hay que respetar.
     */
    _adjuntarCapturaPopups(target) {
      if (!target || !esFuncion(target.addEventListener)) return;
      this._desadjuntarCapturaPopups();
      var self = this;
      var capturar = function () {
        self._popupsPrevios = self._popupsActuales();
        self._capturaPopups = Date.now();
      };
      target.addEventListener('pointerdown', capturar, true);
      this._handlers.pointerdown = { target: target, fn: capturar };
    }

    _desadjuntarCapturaPopups() {
      var captura = this._handlers.pointerdown;
      if (!captura) return;
      try {
        captura.target.removeEventListener('pointerdown', captura.fn, true);
      } catch (e) { /* el elemento ya no existe */ }
      this._handlers.pointerdown = null;
    }

    _desadjuntarEventos() {
      var impl = this._getImpl();
      this._desadjuntarCapturaPopups();

      if (this._handlers.ol) {
        try {
          if (impl && esFuncion(impl.removeEventListener)) {
            impl.removeEventListener('singleclick', this._handlers.ol);
          }
        } catch (e) { /* el mapa puede estar destruido */ }
        this._handlers.ol = null;
      }

      if (this._handlers.cesium) {
        try {
          if (esFuncion(this._handlers.cesium.destroy)) this._handlers.cesium.destroy();
        } catch (e) { /* el mapa puede estar destruido */ }
        this._handlers.cesium = null;
      }
    }

    // ===================================================================
    //  extract de las capas vectoriales
    // ===================================================================
    //
    // `extract` es la propiedad con la que la API decide si una capa
    // vectorial participa en su extractor de features y, por tanto, si abre
    // su propio popup al pinchar. El plugin la pone a false mientras está
    // desactivado para que el clic no abra nada, y a true mientras está
    // activo para que la API siga extrayendo igual que antes. El popup
    // propio del plugin no depende de esta propiedad: lee los features por
    // su cuenta.

    /** Engancha el alta de capas para sincronizar las que lleguen después. */
    _adjuntarEventosCapas() {
      var IDEE = api();
      if (!this._map || !IDEE || !IDEE.evt || !esFuncion(this._map.on)) return;
      this._desadjuntarEventosCapas();
      var self = this;
      var manejador = function () {
        if (!self._map) return;
        // El alta puede dispararse varias veces seguidas al añadir un grupo;
        // se agrupa en un solo tick.
        clearTimeout(self._handlers.extractTimer);
        self._handlers.extractTimer = setTimeout(function () {
          if (self._map) self._sincronizarExtract(self._activo);
        }, 0);
      };
      this._handlers.extract = manejador;
      this._handlers.extractKeys = [];
      [IDEE.evt.ADDED_LAYER, IDEE.evt.ADDED_LAYERGROUP].forEach(function (evento) {
        if (!evento) return;
        try {
          var clave = self._map.on(evento, manejador);
          if (clave) self._handlers.extractKeys.push(clave);
        } catch (e) { /* el mapa no expone eventos */ }
      });
    }

    _desadjuntarEventosCapas() {
      var claves = this._handlers.extractKeys || [];
      if (this._map && esFuncion(this._map.un)) {
        var map = this._map;
        claves.forEach(function (clave) {
          try { map.un(clave); } catch (e) { /* ya estaba fuera */ }
        });
      }
      this._handlers.extractKeys = [];
      this._handlers.extract = null;
      if (this._handlers.extractTimer) {
        clearTimeout(this._handlers.extractTimer);
        this._handlers.extractTimer = null;
      }
    }

    /** Recorre capas y grupos anidados. */
    _recorrerCapas(callback) {
      var visitar = function (lista) {
        (lista || []).forEach(function (capa) {
          if (!capa) return;
          if (esFuncion(capa.getLayers)) {
            var hijas = null;
            try { hijas = capa.getLayers(); } catch (e) { hijas = null; }
            if (hijas && hijas.length) {
              visitar(hijas);
              return;
            }
          }
          callback(capa);
        });
      };
      try {
        visitar(this._map && this._map.getLayers ? this._map.getLayers() : []);
      } catch (e) { /* sin capas */ }
    }

    /** ¿Es una capa vectorial, es decir, tiene sentido tocarle `extract`? */
    _esCapaVectorial(capa) {
      if (!capa) return false;
      if (this._esGeoTIFF(capa)) return false;

      var tipo = String(capa.type || '').toUpperCase();
      if (tipo === 'GEOJSON' || tipo === 'VECTOR' || tipo === 'KML'
        || tipo === 'WFS' || tipo === 'OGCAPIFEATURES' || tipo === 'MVT'
        || tipo === 'MBTILESVECTOR' || tipo === 'MAPLIBRE'
        || tipo === 'GENERICVECTOR' || tipo === 'WKT') {
        return true;
      }

      // Las capas raster y los tiles 3D no son vectoriales aunque alguna
      // fachada herede métodos de features vacíos.
      if (tipo === 'WMS' || tipo === 'WMTS' || tipo === 'TMS' || tipo === 'XYZ'
        || tipo === 'OSM' || tipo === 'GEOTIFF' || tipo === 'MBTILES'
        || tipo === 'GENERICRASTER' || tipo === 'TILES3D' || tipo === 'TERRAIN') {
        return false;
      }

      // En 3D algunas fachadas no exponen `type`. Se usa el contrato de
      // features como última señal, siempre que no sea un GeoTIFF.
      if (esFuncion(capa.getFeatures) && esFuncion(capa.getFeatureById)) return true;
      var impl = null;
      try { impl = capa.getImpl ? capa.getImpl() : null; } catch (e) { impl = null; }
      return !!(impl && esFuncion(impl.getFeatures) && esFuncion(impl.getFeatureById)
        && !(impl.lector && impl.render));
    }

    _leerExtract(capa) {
      try {
        if (capa.extract !== undefined) return capa.extract;
      } catch (e) { /* getter roto */ }
      try {
        var impl = capa.getImpl ? capa.getImpl() : null;
        if (impl && impl.extract !== undefined) return impl.extract;
      } catch (e) { /* sin implementación */ }
      return true;
    }

    _escribirExtract(capa, valor) {
      var aplicado = !!valor;
      try { capa.extract = aplicado; } catch (e) { /* setter roto */ }
      try {
        var impl = capa.getImpl ? capa.getImpl() : null;
        if (impl) impl.extract = aplicado;
      } catch (e) { /* sin implementación */ }
    }

    /**
     * Pone `extract` al valor indicado en todas las capas vectoriales y
     * guarda el valor original para devolverlo en destroy().
     * @param {boolean} valor
     */
    _sincronizarExtract(valor) {
      if (!this._map) return;
      var self = this;
      var aplicado = !!valor;
      this._recorrerCapas(function (capa) {
        if (!self._esCapaVectorial(capa)) return;
        if (!self._extractPrevios.has(capa)) {
          self._extractPrevios.set(capa, self._leerExtract(capa));
        }
        self._escribirExtract(capa, aplicado);
      });
    }

    /** Devuelve a cada capa el `extract` que tenía antes de entrar el plugin. */
    _restaurarExtract() {
      var self = this;
      this._extractPrevios.forEach(function (valor, capa) {
        self._escribirExtract(capa, valor);
      });
      this._extractPrevios.clear();
    }

    // ===================================================================
    //  Reproyección y escala
    // ===================================================================

    _reproyectar(coordenadas, desde, hasta) {
      var IDEE = api();
      if (!IDEE || !IDEE.utils || !esFuncion(IDEE.utils.reproject)) return null;
      try {
        var salida = IDEE.utils.reproject(coordenadas, desde, hasta);
        if (!salida) return null;
        if (Array.isArray(salida)) return salida;
        if (typeof salida === 'object' && salida.x !== undefined && salida.y !== undefined) {
          return [salida.x, salida.y];
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    _reproyectar3857(coordenadas, desde) {
      if (desde === 'EPSG:3857') return [coordenadas[0], coordenadas[1]];
      return this._reproyectar(coordenadas, desde, 'EPSG:3857');
    }

    /**
     * Igual que `_reproyectar`, pero espera la respuesta. `reproject` puede
     * devolver un array o una promesa según el SRC; el GeoTIFF necesita la
     * versión asíncrona para no depender de que el catálogo ya esté cargado.
     */
    async _reproyectarAsync(coordenadas, desde, hasta) {
      var IDEE = api();
      if (!IDEE || !IDEE.utils || !esFuncion(IDEE.utils.reproject)) return null;
      try {
        var salida = await IDEE.utils.reproject(coordenadas, desde, hasta);
        if (!salida) return null;
        if (Array.isArray(salida)) return salida;
        if (typeof salida === 'object' && salida.x !== undefined && salida.y !== undefined) {
          return [salida.x, salida.y];
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Metros por píxel en el punto consultado. En 2D sale de la resolución de
     * la vista; en 3D se estima con la distancia de la cámara al punto y el
     * campo de visión. Se usa para construir el BBOX sintético de
     * GetFeatureInfo (256x256 alrededor del clic).
     */
    _calcularMpp(pixel, cartesiano, punto) {
      var impl = this._getImpl();
      if (!impl) return 1;

      if (this._esCesium()) {
        try {
          var scene = impl.scene;
          var camara = scene.camera;
          var lienzo = scene.canvas;
          var altoPx = (lienzo && (lienzo.clientHeight || lienzo.height)) || 1;
          var frustum = camara.frustum || {};
          if (frustum.width && !frustum.fov) {
            var anchoPx = (lienzo && (lienzo.clientWidth || lienzo.width)) || 1;
            return Math.abs(frustum.width) / anchoPx;
          }
          var distancia = null;
          if (cartesiano && global.Cesium && global.Cesium.Cartesian3) {
            distancia = global.Cesium.Cartesian3.distance(camara.positionWC, cartesiano);
          }
          if (!distancia || !isFinite(distancia)) {
            var cartografica = camara.positionCartographic;
            distancia = cartografica ? cartografica.height : 1000;
          }
          var fov = frustum.fov || (Math.PI / 3);
          var mpp = (2 * distancia * Math.tan(fov / 2)) / altoPx;
          return (isFinite(mpp) && mpp > 0) ? mpp : 1;
        } catch (e) {
          return 1;
        }
      }

      try {
        var vista = impl.getView();
        var resolucion = vista.getResolution();
        var proyeccion = vista.getProjection();
        var unidades = proyeccion && esFuncion(proyeccion.getUnits) ? proyeccion.getUnits() : 'm';
        if (unidades === 'degrees' || unidades === 'radians') {
          var lat = (punto && punto.lat) ? punto.lat : 0;
          var metrosPorGrado = 111320 * Math.max(0.05, Math.cos(lat * Math.PI / 180));
          if (unidades === 'radians') resolucion = resolucion * (180 / Math.PI);
          return resolucion * metrosPorGrado;
        }
        return (isFinite(resolucion) && resolucion > 0) ? resolucion : 1;
      } catch (e) {
        return 1;
      }
    }

    // ===================================================================
    //  Consulta del punto
    // ===================================================================

    /**
     * Lanza la consulta de todas las capas visibles y consultables.
     * @param {{x:number,y:number,lon:number,lat:number,altura:number}} punto
     * @param {Array|Object} coordPopup Coordenada que espera el popup.
     * @param {Array|Object} pixel Píxel del clic (2D) o Cartesian2 (3D).
     * @param {Object} cartesiano Punto Cartesian3 del clic en 3D.
     */
    async _consultarEnPunto(punto, coordPopup, pixel, cartesiano, reabriendo) {
      if (!this._activo || !this._map) return;
      var generacion = this._generacion + 1;
      this._generacion = generacion;
      // El modo restauración reintenta el pick 3D mientras la escena termina
      // de colocarse tras el cambio 2D/3D. Un clic normal lo desactiva.
      this._reabriendo = !!reabriendo;

      this._ultimoPunto = {
        lon: punto.lon,
        lat: punto.lat,
        altura: punto.altura || 0,
      };
      this._coordPopup = coordPopup;
      this._pixel = pixel;
      this._mppActual = this._calcularMpp(pixel, cartesiano, punto);

      if (!pixel) {
        pixel = this._pixelDesdePunto(punto);
        this._pixel = pixel;
      }

      // La API abre su propio popup al pinchar una capa vectorial. Para que
      // no tape el nuestro, se anota lo que ya estaba abierto ANTES del clic
      // (lo hace el listener de pointerdown) y, al terminar, se retiran los
      // popups nuevos que no sean el de este plugin.
      var ahora = Date.now();
      if (!this._capturaPopups || (ahora - this._capturaPopups) > 2000) {
        this._popupsPrevios = this._popupsActuales();
      }
      this._capturaPopups = 0;
      this._mostrarCargando(coordPopup);
      this._programarLimpiezaPopupsAjenos();

      var capas = this._capasConsultables();
      var self = this;
      var promesas = capas.map(function (item) {
        return self._consultarCapa(item.capa, item.tipo, punto, pixel, cartesiano, self._mppActual, generacion);
      });

      var settled = await Promise.allSettled(promesas);
      if (generacion !== this._generacion || !this._activo) return;
      if (!this._popupAbierto) return; // el usuario cerró el popup de carga

      var resultados = [];
      settled.forEach(function (resultado, indice) {
        if (resultado.status === 'fulfilled') {
          var valor = resultado.value;
          if (valor && !valor.omitida) resultados.push(valor);
        } else {
          var capa = capas[indice] ? capas[indice].capa : null;
          if (capa) resultados.push(self._resultadoError(capa, resultado.reason, punto, self._mppActual, generacion));
        }
      });

      var conContenido = resultados.filter(function (resultado) {
        return self._resultadoTieneContenido(resultado);
      });

      if (!conContenido.length) {
        var mensaje = capas.length
          ? 'No hay información en este punto.'
          : 'No hay capas consultables visibles en el mapa.';
        this._mostrarMensaje(mensaje);
        return;
      }

      conContenido.forEach(function (resultado, indice) {
        resultado.uid = 'info-tab-' + indice;
      });
      this._resultados = conContenido;
      this._renderizarPopupNuevo(conContenido);
    }

    _consultarCapa(capa, tipo, punto, pixel, cartesiano, mpp, generacion) {
      if (tipo === 'wms') {
        return this._consultarWMS(capa, punto, pixel, cartesiano, mpp, generacion);
      }
      if (tipo === 'vector') {
        return this._consultarVector(capa, punto, pixel, cartesiano, mpp, generacion);
      }
      if (tipo === 'raster') {
        return this._consultarRaster(capa, punto, pixel, cartesiano, mpp, generacion);
      }
      if (tipo === 'base') {
        return this._consultarBase(capa, punto, pixel, cartesiano, mpp, generacion);
      }
      return Promise.resolve({ omitida: true });
    }

    async _consultarWMS(capa, punto, pixel, cartesiano, mpp, generacion) {
      var caps = await this._capacidadesDe(capa);

      // Si las capacidades se leyeron y el servicio no declara GetFeatureInfo,
      // no hay nada que preguntar.
      if (caps && caps.leidas && (!caps.formatos || !caps.formatos.length)) {
        return { omitida: true, motivo: 'El servicio no ofrece GetFeatureInfo.' };
      }

      var infoCapa = caps && caps.capas ? caps.capas[capa.name] : null;
      if (infoCapa && infoCapa.queryable === false) {
        return { omitida: true, motivo: 'La capa no es consultable.' };
      }
      if (!infoCapa && esFuncion(capa.isQueryable)) {
        try {
          if (capa.isQueryable() === false) return { omitida: true };
        } catch (e) {
          /* se intenta igualmente */
        }
      }

      var formatos = this._formatosDisponibles(caps);
      if (!formatos.length) return { omitida: true };

      var clave = this._claveCapa(capa);
      var preferido = this._formatoPreferido(clave, formatos);
      var candidatos = [];
      var formatoPreferido = formatos.find(function (f) { return f.id === preferido; });
      if (formatoPreferido) candidatos.push(formatoPreferido);
      formatos.forEach(function (formato) {
        if (candidatos.indexOf(formato) === -1) candidatos.push(formato);
      });

      var resultado = {
        uid: '',
        tipo: 'wms',
        capa: capa,
        clave: clave,
        formatos: formatos,
        formatoActual: null,
        porFormato: {},
        error: null,
        caps: caps,
        punto: {
          x: punto.x,
          y: punto.y,
          lon: punto.lon,
          lat: punto.lat,
        },
        mpp: mpp || 1,
        generacion: generacion,
      };

      var ultimoError = null;
      for (var i = 0; i < candidatos.length; i += 1) {
        var formato = candidatos[i];
        try {
          var datos = await this._pedirFeatureInfo(capa, resultado.punto, formato, caps, resultado.mpp);
          resultado.porFormato[formato.id] = Object.assign({ estado: 'ok' }, datos);
          resultado.formatoActual = formato.id;
          // Si el formato preferido falló y se pudo con otro, se guarda el
          // que ha funcionado para no repetir el fallo en el siguiente clic.
          if (formato.id !== preferido) {
            var pref = this._preferencias[clave] || {};
            this._preferencias[clave] = {
              formato: formato.id,
              plantilla: pref.plantilla || null,
            };
          }
          return resultado;
        } catch (e) {
          ultimoError = e;
          resultado.porFormato[formato.id] = {
            estado: 'error',
            error: this._mensajeError(e),
          };
        }
      }

      resultado.error = this._mensajeError(ultimoError);
      resultado.formatoActual = candidatos.length ? candidatos[0].id : null;
      return resultado;
    }

    // ===================================================================
    //  Ráster: valores de las bandas de un GeoTIFF
    // ===================================================================

    /**
     * ¿La capa es un GeoTIFF? En 2D el tipo es 'GeoTIFF'; en 3D la fachada
     * de ext/geotiffLayer puede no exponer `type`, pero sí
     * `getImplGeoTIFF()` y una implementación con `lector` y `render`.
     */
    _esGeoTIFF(capa) {
      if (!capa) return false;
      var tipo = String(capa.type || '').toUpperCase();
      if (tipo === 'GEOTIFF') return true;
      if (esFuncion(capa.getImplGeoTIFF)) return true;
      var impl = null;
      try { impl = capa.getImpl ? capa.getImpl() : null; } catch (e) { impl = null; }
      return !!(impl && impl.lector && impl.render);
    }

    /**
     * Lee las bandas de un GeoTIFF en el punto y las presenta con la misma
     * maquinaria que los features vectoriales: un elemento con una propiedad
     * por banda. Así funcionan las plantillas ficha, tabla y json sin añadir
     * una plantilla nueva.
     */
    async _consultarRaster(capa, punto, pixel, cartesiano, mpp, generacion) {
      var impl = null;
      try { impl = capa.getImpl ? capa.getImpl() : null; } catch (e) { impl = null; }

      var datos = null;
      try {
        datos = await this._leerBandasConTimeout(capa, impl, punto);
      } catch (e) {
        return this._resultadoError(capa, e, punto, mpp, generacion);
      }
      if (this._datosRasterVacios(datos)) {
        return { omitida: true, motivo: 'El punto no tiene información.' };
      }

      var propiedades = {};
      var campos = [];
      datos.valores.forEach(function (banda) {
        var clave = 'Banda ' + banda.banda;
        var valor = valorRaster(banda.valor);
        propiedades[clave] = valor;
        campos.push({
          clave: clave,
          etiqueta: clave,
          valor: valor,
          texto: aTexto(valor),
        });
      });

      var elemento = {
        id: null,
        titulo: 'Valores de las bandas',
        propiedades: propiedades,
        campos: campos,
        // La ficha de un ráster no necesita la línea "Geometría: Point": el
        // punto ya es el clic. La geometría sí queda en `crudo` para la
        // plantilla JSON.
        geometria: null,
        crudo: {
          type: 'Feature',
          properties: Object.assign({}, propiedades, {
            SRC: datos.epsg || null,
            pixel: datos.pixel ? (datos.pixel.x + ', ' + datos.pixel.y) : null,
            tamano: (datos.ancho && datos.alto) ? (datos.ancho + ' x ' + datos.alto) : null,
          }),
          geometry: { type: 'Point', coordinates: [punto.lon, punto.lat] },
        },
        fuente: 'raster',
        capa: {
          name: capa.name,
          legend: capa.legend,
          type: capa.type,
          idLayer: capa.idLayer,
        },
      };

      return {
        uid: '',
        tipo: 'raster',
        capa: capa,
        clave: this._claveCapa(capa),
        formatos: [{ id: 'bandas', etiqueta: 'Bandas' }],
        formatoActual: 'bandas',
        porFormato: {
          bandas: { estado: 'ok', tipo: 'json', features: [elemento] },
        },
        error: null,
        caps: null,
        punto: {
          x: punto.x,
          y: punto.y,
          lon: punto.lon,
          lat: punto.lat,
        },
        mpp: mpp || 1,
        generacion: generacion,
      };
    }

    /**
     * ¿La lectura del ráster no aporta nada? Se descartan las respuestas sin
     * bandas, con todas las bandas vacías, con alfa 0 (píxel transparente) o
     * con todas las bandas iguales al valor nodata declarado por el GeoTIFF.
     */
    _datosRasterVacios(datos) {
      if (!datos || !datos.valores || !datos.valores.length) return true;

      if (datos.alpha !== null && datos.alpha !== undefined
        && Number(valorRaster(datos.alpha)) === 0) {
        return true;
      }

      var valores = datos.valores.map(function (banda) {
        return valorRaster(banda.valor);
      });
      var hayValor = valores.some(function (valor) {
        return valor !== null && valor !== undefined
          && !(typeof valor === 'number' && !isFinite(valor));
      });
      if (!hayValor) return true;

      if (datos.nodata !== null && datos.nodata !== undefined) {
        var self = this;
        var todosNodata = valores.every(function (valor) {
          return self._mismoValorRaster(valor, datos.nodata);
        });
        if (todosNodata) return true;
      }

      return false;
    }

    _mismoValorRaster(a, b) {
      var va = valorRaster(a);
      var vb = valorRaster(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return (isNaN(va) && isNaN(vb)) || va === vb;
      }
      return String(va) === String(vb);
    }

    /** Limita la espera de la lectura para que no bloquee el popup. */
    _leerBandasConTimeout(capa, impl, punto) {
      var self = this;
      return new Promise(function (resolve, reject) {
        var terminado = false;
        var temporizador = setTimeout(function () {
          if (terminado) return;
          terminado = true;
          reject(new Error('La lectura de las bandas tardó demasiado.'));
        }, 20000);

        Promise.resolve(self._leerBandasGeoTIFF(capa, impl, punto)).then(function (datos) {
          if (terminado) return;
          terminado = true;
          clearTimeout(temporizador);
          resolve(datos);
        }, function (error) {
          if (terminado) return;
          terminado = true;
          clearTimeout(temporizador);
          reject(error);
        });
      });
    }

    /**
     * Elige la vía de lectura según la implementación:
     *   2D -> las imágenes que ya tiene abiertas el origen GeoTIFF de OL.
     *   3D -> el LectorGeoTIFF de ext/geotiffLayer que usa la capa.
     *   Respaldo -> un LectorGeoTIFF nuevo con la URL/blob de la capa.
     */
    async _leerBandasGeoTIFF(capa, impl, punto) {
      var info2D = this._imagenGeoTIFF2D(impl);
      if (info2D) {
        return await this._leerBandasEnImagen2D(info2D, impl, punto);
      }

      if (impl && impl.lector && esFuncion(impl.lector.leerBandas)) {
        return await impl.lector.leerBandas(punto.lon, punto.lat);
      }

      var Lector = global.LectorGeoTIFF;
      var url = impl && (impl.url || (impl.lector && impl.lector.url));
      var blob = impl && (impl.blob || (impl.lector && impl.lector.blob));
      if (esFuncion(Lector) && (url || blob)) {
        if (!this._lectoresGeoTIFF) this._lectoresGeoTIFF = {};
        var clave = this._claveCapa(capa);
        var lector = this._lectoresGeoTIFF[clave];
        if (!lector) {
          lector = new Lector({ url: url || null, blob: blob || null });
          this._lectoresGeoTIFF[clave] = lector;
        }
        return await lector.leerBandas(punto.lon, punto.lat);
      }

      throw new Error('No hay un lector de bandas disponible para esta capa.');
    }

    /**
     * La imagen de resolución completa del origen GeoTIFF de OpenLayers. En
     * `sourceImagery_` conviven las overviews (sin georreferenciación) y la
     * imagen principal (con ModelTransformation), así que se elige la que
     * tiene transformación y más lado.
     */
    _imagenGeoTIFF2D(impl) {
      try {
        var olLayer = impl && impl.olLayer;
        var src = olLayer && esFuncion(olLayer.getSource) ? olLayer.getSource() : null;
        if (!src || !src.sourceImagery_) return null;

        var grupos = src.sourceImagery_;
        var principal = null;
        var ladoPrincipal = -1;
        for (var g = 0; g < grupos.length; g += 1) {
          var lista = grupos[g] || [];
          for (var i = 0; i < lista.length; i += 1) {
            var imagen = lista[i];
            if (!imagen) continue;
            var transformacion = campoImagen(imagen, 'ModelTransformation', 34264);
            var escalaGeo = campoImagen(imagen, 'ModelPixelScale', 33550);
            var tiepoint = campoImagen(imagen, 'ModelTiepoint', 33922);
            var tieneGeo = !!(transformacion || (escalaGeo && tiepoint));
            if (!tieneGeo) continue;
            var lado = 0;
            try { lado = Math.max(imagen.getWidth(), imagen.getHeight()); } catch (e) { lado = 0; }
            if (lado > ladoPrincipal) {
              ladoPrincipal = lado;
              principal = imagen;
            }
          }
        }
        if (!principal) return null;

        var epsg = null;
        try {
          if (src.getProjection && src.getProjection()) {
            epsg = src.getProjection().getCode ? src.getProjection().getCode() : null;
          }
        } catch (e) { epsg = null; }
        if (!epsg) epsg = this._epsgDeImagen(principal);
        return { imagen: principal, epsg: epsg };
      } catch (e) {
        return null;
      }
    }

    /** Las claves GeoTIFF de una imagen a un código EPSG. */
    _epsgDeImagen(imagen) {
      try {
        var claves = imagen.getGeoKeys ? imagen.getGeoKeys() : null;
        if (claves && claves.ProjectedCSTypeGeoKey) {
          return 'EPSG:' + claves.ProjectedCSTypeGeoKey;
        }
        if (claves && claves.GeographicTypeGeoKey) {
          return 'EPSG:' + claves.GeographicTypeGeoKey;
        }
      } catch (e) { /* sin claves */ }
      return null;
    }

    /**
     * Índice (0-based) de la banda alfa, o -1 si no la hay. `ExtraSamples`
     * distingue un RGBA de un RGB+NIR: solo el primero declara alfa.
     */
    _indiceAlfaImagen(imagen, total) {
      if (!total || total < 2) return -1;
      var extra = campoImagen(imagen, 'ExtraSamples', TAG_EXTRA_SAMPLES);
      if (extra === null || extra === undefined) return -1;
      var lista = Array.isArray(extra) ? extra : [extra];
      var tieneAlfa = lista.some(function (valor) {
        return Number(valor) === 1 || Number(valor) === 2;
      });
      return tieneAlfa ? total - 1 : -1;
    }

    /** Valor nodata declarado por el GeoTIFF, o null si no lo hay. */
    _nodataImagen(imagen) {
      var bruto = campoImagen(imagen, 'GDAL_NODATA', TAG_GDAL_NODATA);
      if (bruto === null || bruto === undefined || bruto === '') return null;
      var numero = Number(String(bruto).trim());
      return isFinite(numero) ? numero : null;
    }

    /**
     * Punto del mundo (en el SRC del fichero) a píxel de la imagen. Misma
     * lógica que LectorGeoTIFF._pixelDesdeMundo, pero aquí se usa la imagen
     * que ya tiene abierta OpenLayers en 2D.
     */
    _pixelEnImagen(imagen, x, y) {
      var ancho = 0;
      var alto = 0;
      try {
        ancho = imagen.getWidth();
        alto = imagen.getHeight();
      } catch (e) {
        return null;
      }

      var px = null;
      var py = null;
      var m = campoImagen(imagen, 'ModelTransformation', 34264);
      if (m && (m.length >= 8 || m[0] !== undefined)) {
        var val = function (i) { return typeof m[i] === 'number' ? m[i] : Number(m[String(i)]); };
        var a = val(0), b = val(1), c = val(3);
        var d = val(4), e = val(5), f = val(7);
        var det = a * e - b * d;
        if (!det) return null;
        px = (e * (x - c) - b * (y - f)) / det;
        py = (-d * (x - c) + a * (y - f)) / det;
      } else {
        var escala = campoImagen(imagen, 'ModelPixelScale', 33550);
        var tie = campoImagen(imagen, 'ModelTiepoint', 33922);
        if (escala && tie && escala[0] && escala[1]) {
          px = tie[0] + (x - tie[3]) / escala[0];
          py = tie[1] + (tie[4] - y) / escala[1];
        } else if (esFuncion(imagen.getOrigin) && esFuncion(imagen.getResolution)) {
          try {
            var origen = imagen.getOrigin();
            var resolucion = imagen.getResolution();
            px = (x - origen[0]) / resolucion[0];
            py = (y - origen[1]) / resolucion[1];
          } catch (e) {
            return null;
          }
        } else {
          return null;
        }
      }

      if (!isFinite(px) || !isFinite(py)) return null;
      var ix = Math.floor(px);
      var iy = Math.floor(py);
      if (ix < 0 || iy < 0 || ix >= ancho || iy >= alto) return null;
      return { x: ix, y: iy, ancho: ancho, alto: alto };
    }

    async _leerBandasEnImagen2D(info, impl, punto) {
      var imagen = info.imagen;
      var epsg = info.epsg || this._epsgDeImagen(imagen);
      if (!epsg) throw new Error('La capa GeoTIFF no declara su SRC.');

      var mundo = await this._reproyectarAsync([punto.lon, punto.lat], 'EPSG:4326', epsg);
      if (!mundo) throw new Error('No se pudo reproyectar el punto a ' + epsg);

      var pixel = this._pixelEnImagen(imagen, Number(mundo[0]), Number(mundo[1]));
      if (!pixel) return null;

      var total = 0;
      try { total = imagen.getSamplesPerPixel(); } catch (e) { total = 0; }
      if (!total) throw new Error('La imagen no declara bandas.');

      // `bands_` es la selección 1-based que pidió el visualizador; si está
      // vacía se leen todas las muestras de la imagen.
      var seleccion = [];
      if (impl && Array.isArray(impl.bands_) && impl.bands_.length) {
        impl.bands_.forEach(function (banda) {
          var indice = Number(banda) - 1;
          if (isFinite(indice) && indice >= 0 && indice < total) seleccion.push(indice);
        });
      }
      if (!seleccion.length) {
        for (var i = 0; i < total; i += 1) seleccion.push(i);
      }

      var datos = await imagen.readRasters({
        window: [pixel.x, pixel.y, pixel.x + 1, pixel.y + 1],
        samples: seleccion,
        interleave: false,
      });

      var valores = [];
      for (var j = 0; j < datos.length; j += 1) {
        valores.push({
          banda: seleccion[j] + 1,
          valor: datos[j] ? datos[j][0] : null,
        });
      }

      // El alfa puede quedar fuera de `bands_` (por ejemplo, una capa que
      // pinta solo las bandas 1-3 de un RGBA). En ese caso se lee aparte para
      // poder descartar el píxel transparente.
      var indiceAlfa = this._indiceAlfaImagen(imagen, total);
      var alfa = null;
      if (indiceAlfa >= 0) {
        var posicionAlfa = seleccion.indexOf(indiceAlfa);
        if (posicionAlfa >= 0) {
          alfa = datos[posicionAlfa] ? datos[posicionAlfa][0] : null;
        } else {
          var datosAlfa = await imagen.readRasters({
            window: [pixel.x, pixel.y, pixel.x + 1, pixel.y + 1],
            samples: [indiceAlfa],
            interleave: false,
          });
          alfa = datosAlfa && datosAlfa[0] ? datosAlfa[0][0] : null;
        }
      }

      return {
        valores: valores,
        pixel: { x: pixel.x, y: pixel.y },
        ancho: pixel.ancho,
        alto: pixel.alto,
        epsg: epsg,
        alpha: alfa,
        nodata: this._nodataImagen(imagen),
      };
    }

    // ===================================================================
    //  Capa base: color RGB(A) del píxel
    // ===================================================================

    /**
     * Capas base que se pueden leer como ráster (TMS, WMTS, XYZ, OSM,
     * MBTiles raster o un grupo que contenga alguna de ellas). En 3D la API
     * puede devolver en `getBaseLayers()` solo la hija base del grupo (por
     * ejemplo `PNOA_MA` del Híbrido) mientras el grupo sigue en `getLayers()`
     * con `isBase: true`; por eso se unen las dos fuentes.
     *
     * Si hay un grupo base, se prefiere el grupo y se descartan sus hijas para
     * no repetir la misma información en dos pestañas.
     */
    _capasBase() {
      if (!this._map) return [];
      var candidatas = [];
      var anadir = function (capa) {
        if (capa && candidatas.indexOf(capa) === -1) candidatas.push(capa);
      };

      try {
        var bases = this._map.getBaseLayers ? this._map.getBaseLayers() : [];
        (bases || []).forEach(anadir);
      } catch (e) { /* sin capas base */ }

      try {
        var capas = this._map.getLayers ? this._map.getLayers() : [];
        (capas || []).forEach(function (capa) {
          if (capa && capa.isBase === true) anadir(capa);
        });
      } catch (e) { /* sin capas */ }

      // Hijas de los grupos base: si el grupo es la capa base, sus hijas no
      // se consultan por separado.
      var self = this;
      var descendientes = [];
      var marcar = function (capa) {
        var hijas = self._hijasCapa(capa);
        hijas.forEach(function (hija) {
          if (!hija) return;
          if (descendientes.indexOf(hija) === -1) {
            descendientes.push(hija);
            marcar(hija);
          }
        });
      };
      candidatas.forEach(marcar);

      return candidatas.filter(function (capa) {
        if (descendientes.indexOf(capa) !== -1) return false;
        if (!self._esVisible(capa)) return false;
        return self._esRasterBase(capa);
      });
    }

    _esCapaBase(capa) {
      if (!capa) return false;
      try {
        if (capa.isBase === true) return true;
        if (esFuncion(capa.isBase)) return !!capa.isBase();
      } catch (e) { /* sin isBase */ }
      return false;
    }

    /**
     * ¿La capa (o alguna hija de un grupo) es una fuente ráster de teselas?
     * Las capas base WMS no entran aquí: se consultan por GetFeatureInfo como
     * cualquier WMS.
     */
    _esRasterBase(capa) {
      if (!capa) return false;
      var tipo = String(capa.type || '').toUpperCase();
      if (tipo === 'TMS' || tipo === 'WMTS' || tipo === 'XYZ' || tipo === 'OSM'
        || tipo === 'MBTILES' || tipo === 'GENERICRASTER' || tipo === 'RASTER') {
        return true;
      }
      if (esFuncion(capa.getLayers)) {
        var hijas = this._hijasCapa(capa);
        for (var i = 0; i < hijas.length; i += 1) {
          if (this._esRasterBase(hijas[i])) return true;
        }
      }
      return false;
    }

    _hijasCapa(capa) {
      if (!capa || !esFuncion(capa.getLayers)) return [];
      try {
        var hijas = capa.getLayers();
        if (!hijas) return [];
        if (Array.isArray(hijas)) return hijas;
        if (esFuncion(hijas.getArray)) return hijas.getArray();
        if (typeof hijas.length === 'number') {
          var lista = [];
          for (var i = 0; i < hijas.length; i += 1) lista.push(hijas[i]);
          return lista;
        }
      } catch (e) { /* sin hijas */ }
      return [];
    }

    _descendientesBase(bases) {
      var self = this;
      var salida = new Set();
      var marcar = function (capa) {
        self._hijasCapa(capa).forEach(function (hija) {
          if (!hija || salida.has(hija)) return;
          salida.add(hija);
          marcar(hija);
        });
      };
      (bases || []).forEach(marcar);
      return salida;
    }

    /**
     * Información de una capa base: color RGB(A) del píxel pulsado. En los
     * grupos base se compone el color de sus hijas visibles, de abajo a
     * arriba. Si el píxel es transparente o no se puede leer (CORS, tesela no
     * disponible), la pestaña se omite.
     */
    async _consultarBase(capa, punto, pixel, cartesiano, mpp, generacion) {
      var color = null;
      try {
        color = this._esCesium()
          ? await this._colorBase3D(capa, punto)
          : await this._colorBase2D(capa, punto);
      } catch (e) {
        color = null;
      }
      if (this._esColorTransparente(color)) {
        return { omitida: true, motivo: 'El píxel de la capa base es transparente.' };
      }

      var r = Math.max(0, Math.min(255, Math.round(color.r)));
      var g = Math.max(0, Math.min(255, Math.round(color.g)));
      var b = Math.max(0, Math.min(255, Math.round(color.b)));
      var a = Math.max(0, Math.min(255, Math.round(color.a)));
      var hex = this._hexColor(r, g, b);

      var propiedades = { R: r, G: g, B: b, A: a, Hex: hex };
      var campos = [
        { clave: 'R', etiqueta: 'R', valor: r, texto: String(r) },
        { clave: 'G', etiqueta: 'G', valor: g, texto: String(g) },
        { clave: 'B', etiqueta: 'B', valor: b, texto: String(b) },
        { clave: 'A', etiqueta: 'A', valor: a, texto: String(a) },
        { clave: 'Hex', etiqueta: 'Color', valor: hex, texto: hex },
      ];
      var elemento = {
        id: null,
        titulo: 'Color en el punto',
        propiedades: propiedades,
        campos: campos,
        geometria: null,
        crudo: {
          type: 'Feature',
          id: null,
          geometry: {
            type: 'Point',
            coordinates: [punto.lon, punto.lat],
          },
          properties: propiedades,
        },
        fuente: 'base',
      };

      return {
        uid: '',
        tipo: 'base',
        capa: capa,
        clave: this._claveCapa(capa),
        formatos: [{ id: 'color', etiqueta: 'Color', infoFormat: 'color' }],
        formatoActual: 'color',
        porFormato: {
          color: { estado: 'ok', tipo: 'json', features: [elemento] },
        },
        error: null,
        caps: null,
        punto: {
          x: punto.x,
          y: punto.y,
          lon: punto.lon,
          lat: punto.lat,
        },
        mpp: mpp || 1,
        generacion: generacion,
      };
    }

    async _colorBase2D(capa, punto) {
      var hijas = this._hijasCapa(capa);
      if (hijas.length) {
        var colores = [];
        for (var i = 0; i < hijas.length; i += 1) {
          colores.push(await this._colorBase2D(hijas[i], punto));
        }
        return this._componerColores(colores);
      }

      var impl = null;
      try { impl = capa.getImpl ? capa.getImpl() : null; } catch (e) { impl = null; }
      var olLayer = impl && impl.olLayer;
      if (!olLayer) return null;
      return this._colorOlLayer(olLayer, punto);
    }

    async _colorOlLayer(olLayer, punto) {
      if (!olLayer) return null;
      try {
        if (esFuncion(olLayer.getVisible) && !olLayer.getVisible()) return null;
      } catch (e) { /* sin visibilidad */ }

      if (esFuncion(olLayer.getLayers)) {
        var coleccion = null;
        try { coleccion = olLayer.getLayers(); } catch (e) { coleccion = null; }
        var lista = [];
        if (coleccion && esFuncion(coleccion.getArray)) lista = coleccion.getArray();
        else if (Array.isArray(coleccion)) lista = coleccion;
        var colores = [];
        for (var i = 0; i < lista.length; i += 1) {
          colores.push(await this._colorOlLayer(lista[i], punto));
        }
        return this._componerColores(colores);
      }

      var source = null;
      try { source = esFuncion(olLayer.getSource) ? olLayer.getSource() : null; } catch (e) { source = null; }
      if (!source) return null;
      var color = await this._colorTile2D(source, punto);
      if (!color) return null;

      try {
        var opacidad = esFuncion(olLayer.getOpacity) ? olLayer.getOpacity() : 1;
        if (typeof opacidad === 'number' && opacidad >= 0 && opacidad < 1) {
          color.a = Math.round(color.a * opacidad);
        }
      } catch (e) { /* sin opacidad */ }
      return color;
    }

    async _colorTile2D(source, punto) {
      if (!source || !esFuncion(source.getTileUrlFunction)
        || !esFuncion(source.getTileGrid)) {
        return null;
      }
      var grid = null;
      try { grid = source.getTileGrid(); } catch (e) { grid = null; }
      if (!grid || !esFuncion(grid.getTileCoordForCoordAndResolution)) return null;

      var impl = this._getImpl();
      if (!impl || !esFuncion(impl.getView)) return null;
      var vista = null;
      try { vista = impl.getView(); } catch (e) { vista = null; }
      if (!vista) return null;
      var resolucion = vista.getResolution();
      var proyeccionVista = vista.getProjection();
      var proyeccionFuente = esFuncion(source.getProjection) ? source.getProjection() : null;
      if (!proyeccionFuente) proyeccionFuente = proyeccionVista;

      var codigoVista = proyeccionVista && esFuncion(proyeccionVista.getCode)
        ? proyeccionVista.getCode() : 'EPSG:3857';
      var codigoFuente = proyeccionFuente && esFuncion(proyeccionFuente.getCode)
        ? proyeccionFuente.getCode() : codigoVista;
      // La resolución de la vista no se puede reutilizar en otra proyección
      // sin convertir unidades; las capas base de la galería son 3857.
      if (codigoFuente !== codigoVista) return null;

      var coordenada = [punto.x, punto.y];
      var tileCoord = null;
      try {
        tileCoord = grid.getTileCoordForCoordAndResolution(coordenada, resolucion);
      } catch (e) { tileCoord = null; }
      if (!tileCoord) return null;

      var extension = null;
      try { extension = grid.getTileCoordExtent(tileCoord); } catch (e) { extension = null; }
      if (!extension) return null;
      var ancho = extension[2] - extension[0];
      var alto = extension[3] - extension[1];
      if (!(ancho > 0) || !(alto > 0)) return null;

      var u = (coordenada[0] - extension[0]) / ancho;
      var v = (extension[3] - coordenada[1]) / alto;
      if (!isFinite(u) || !isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) return null;

      var url = null;
      try {
        url = source.getTileUrlFunction()(tileCoord, 1, proyeccionFuente);
      } catch (e) { url = null; }
      if (!url) return null;

      return this._leerPixelUrl(String(url), u, v);
    }

    _leerPixelUrl(url, u, v) {
      return new Promise(function (resolve) {
        var terminado = false;
        var temporizador = null;
        var fin = function (color) {
          if (terminado) return;
          terminado = true;
          if (temporizador !== null) clearTimeout(temporizador);
          resolve(color || null);
        };
        if (!url) { fin(null); return; }
        temporizador = setTimeout(function () { fin(null); }, 8000);

        var imagen = new Image();
        imagen.crossOrigin = 'anonymous';
        imagen.onload = function () {
          try {
            var ancho = imagen.naturalWidth || imagen.width;
            var alto = imagen.naturalHeight || imagen.height;
            if (!ancho || !alto) { fin(null); return; }
            var lienzo = document.createElement('canvas');
            lienzo.width = ancho;
            lienzo.height = alto;
            var contexto = lienzo.getContext('2d', { willReadFrequently: true });
            if (!contexto) { fin(null); return; }
            contexto.drawImage(imagen, 0, 0);
            var px = Math.min(ancho - 1, Math.max(0, Math.floor(u * ancho)));
            var py = Math.min(alto - 1, Math.max(0, Math.floor(v * alto)));
            var datos = contexto.getImageData(px, py, 1, 1).data;
            fin({ r: datos[0], g: datos[1], b: datos[2], a: datos[3] });
          } catch (e) {
            fin(null);
          }
        };
        imagen.onerror = function () { fin(null); };
        try { imagen.src = url; } catch (e) { fin(null); }
      });
    }

    async _colorBase3D(capa, punto) {
      var hijas = this._hijasCapa(capa);
      if (hijas.length) {
        var colores = [];
        for (var i = 0; i < hijas.length; i += 1) {
          colores.push(await this._colorBase3D(hijas[i], punto));
        }
        return this._componerColores(colores);
      }

      var impl = null;
      try { impl = capa.getImpl ? capa.getImpl() : null; } catch (e) { impl = null; }
      var imageryLayer = impl && (impl.cesiumLayer || impl.imageryLayer || impl.layer);
      if (!imageryLayer) return null;
      try { if (imageryLayer.show === false) return null; } catch (e) { /* sin show */ }

      var provider = imageryLayer.imageryProvider;
      if (!provider || !esFuncion(provider.requestImage)) return null;
      var scheme = provider.tilingScheme;
      if (!scheme || !esFuncion(scheme.positionToTileXY)) return null;

      var Cesium = global.Cesium;
      if (!Cesium || !Cesium.Cartographic || !Cesium.Cartesian2) return null;

      var cartografica = null;
      try {
        cartografica = Cesium.Cartographic.fromDegrees(punto.lon, punto.lat);
      } catch (e) {
        return null;
      }
      if (!cartografica) return null;

      var nivel = 15;
      try {
        var maximo = provider.maximumLevel;
        if (typeof maximo === 'number' && isFinite(maximo)) {
          nivel = Math.max(0, Math.min(Math.floor(maximo), 17));
        }
      } catch (e) { /* sin máximo */ }

      var xy = null;
      try {
        xy = scheme.positionToTileXY(cartografica, nivel, new Cesium.Cartesian2());
      } catch (e) { xy = null; }
      if (!xy) return null;

      var rectangulo = null;
      var nativo = null;
      try {
        if (esFuncion(scheme.tileXYToNativeRectangle)) {
          rectangulo = scheme.tileXYToNativeRectangle(xy.x, xy.y, nivel);
          nativo = esFuncion(scheme.projection.project)
            ? scheme.projection.project(cartografica)
            : cartografica;
        } else if (esFuncion(scheme.tileXYToRectangle)) {
          rectangulo = scheme.tileXYToRectangle(xy.x, xy.y, nivel);
          nativo = cartografica;
        }
      } catch (e) {
        rectangulo = null;
      }
      if (!rectangulo || !nativo) return null;

      var u = (nativo.x - rectangulo.west) / (rectangulo.east - rectangulo.west);
      var v = (rectangulo.north - nativo.y) / (rectangulo.north - rectangulo.south);
      if (!isFinite(u) || !isFinite(v)) return null;

      var imagen = null;
      try {
        imagen = await provider.requestImage(xy.x, xy.y, nivel);
      } catch (e) {
        imagen = null;
      }
      if (!imagen) return null;

      var color = this._pixelDeImagen(imagen, u, v);
      if (!color) return null;

      try {
        var alfaCapa = typeof imageryLayer.alpha === 'number' ? imageryLayer.alpha : 1;
        if (alfaCapa >= 0 && alfaCapa < 1) {
          color.a = Math.round(color.a * alfaCapa);
        }
      } catch (e) { /* sin alfa */ }
      return color;
    }

    _pixelDeImagen(imagen, u, v) {
      try {
        var ancho = imagen.naturalWidth || imagen.width;
        var alto = imagen.naturalHeight || imagen.height;
        if (!ancho || !alto) return null;
        var lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        var contexto = lienzo.getContext('2d', { willReadFrequently: true });
        if (!contexto) return null;
        contexto.drawImage(imagen, 0, 0);
        var px = Math.min(ancho - 1, Math.max(0, Math.floor(u * ancho)));
        var py = Math.min(alto - 1, Math.max(0, Math.floor(v * alto)));
        var datos = contexto.getImageData(px, py, 1, 1).data;
        return { r: datos[0], g: datos[1], b: datos[2], a: datos[3] };
      } catch (e) {
        return null;
      }
    }

    _componerColores(colores) {
      var salida = { r: 0, g: 0, b: 0, a: 0 };
      var hay = false;
      (colores || []).forEach(function (color) {
        if (!color || !isFinite(color.a) || color.a <= 0) return;
        hay = true;
        var origenA = color.a / 255;
        var destinoA = salida.a / 255;
        var finalA = origenA + destinoA * (1 - origenA);
        if (finalA <= 0) return;
        salida.r = (color.r * origenA + salida.r * destinoA * (1 - origenA)) / finalA;
        salida.g = (color.g * origenA + salida.g * destinoA * (1 - origenA)) / finalA;
        salida.b = (color.b * origenA + salida.b * destinoA * (1 - origenA)) / finalA;
        salida.a = finalA * 255;
      });
      if (!hay) return null;
      salida.r = Math.round(salida.r);
      salida.g = Math.round(salida.g);
      salida.b = Math.round(salida.b);
      salida.a = Math.round(salida.a);
      return salida;
    }

    _esColorTransparente(color) {
      return !color || !isFinite(color.a) || color.a <= 0;
    }

    _hexColor(r, g, b) {
      var hex = function (valor) {
        var texto = Math.max(0, Math.min(255, Math.round(valor))).toString(16);
        return texto.length < 2 ? '0' + texto : texto;
      };
      return '#' + hex(r) + hex(g) + hex(b);
    }

    /** Capas visibles y de un tipo que sabemos consultar (base, WMS, vectorial o ráster). */
    _capasConsultables() {
      var salida = [];
      var self = this;
      var bases = this._capasBase();
      var basesSet = new Set(bases);
      var descendientes = this._descendientesBase(bases);
      var contador = 0;

      bases.forEach(function (capa) {
        salida.push({ capa: capa, tipo: 'base', orden: contador++ });
      });

      var visitar = function (lista) {
        (lista || []).forEach(function (capa) {
          if (!capa) return;
          if (basesSet.has(capa) || descendientes.has(capa)) return;
          if (esFuncion(capa.getLayers)) {
            var hijas = null;
            try { hijas = capa.getLayers(); } catch (e) { hijas = null; }
            if (hijas && hijas.length) {
              if (self._esVisible(capa)) visitar(hijas);
              return;
            }
          }
          if (!self._esVisible(capa)) return;
          var tipo = String(capa.type || '').toUpperCase();
          if (tipo === 'WMS') {
            salida.push({ capa: capa, tipo: 'wms', orden: contador++ });
          } else if (self._esGeoTIFF(capa)) {
            salida.push({ capa: capa, tipo: 'raster', orden: contador++ });
          } else if (tipo === 'GEOJSON' || tipo === 'VECTOR' || tipo === 'KML'
            || tipo === 'WFS' || tipo === 'OGCAPIFEATURES' || tipo === 'MVT'
            || tipo === 'MBTILESVECTOR' || tipo === 'MAPLIBRE'
            || tipo === 'GENERICVECTOR' || tipo === 'WKT') {
            salida.push({ capa: capa, tipo: 'vector', orden: contador++ });
          }
        });
      };
      try {
        visitar(this._map.getLayers ? this._map.getLayers() : []);
      } catch (e) {
        /* sin capas */
      }

      // Las pestañas se ordenan como se apilan las capas: primero la de mayor
      // z-index (la que queda por encima). A igualdad de z-index se mantiene
      // el orden visual de la colección, con la última añadida delante.
      salida.sort(function (a, b) {
        var za = self._zIndexCapa(a.capa);
        var zb = self._zIndexCapa(b.capa);
        if (za !== zb) return zb - za;
        return b.orden - a.orden;
      });
      return salida;
    }

    _zIndexCapa(capa) {
      if (!capa) return 0;
      // La capa base es siempre el fondo. En 3D la API le asigna a veces el
      // índice de la colección (el grupo se añade al final) y no refleja el
      // apilado visual, así que se fuerza por debajo de cualquier superpuesta.
      if (this._esCapaBase(capa)) return -1000000;
      try {
        if (esFuncion(capa.getZIndex)) {
          var z = capa.getZIndex();
          if (typeof z === 'number' && isFinite(z)) return z;
        }
        if (typeof capa.zIndex_ === 'number' && isFinite(capa.zIndex_)) return capa.zIndex_;
        if (typeof capa.zIndex === 'number' && isFinite(capa.zIndex)) return capa.zIndex;
        var impl = esFuncion(capa.getImpl) ? capa.getImpl() : null;
        if (impl && typeof impl.zIndex_ === 'number' && isFinite(impl.zIndex_)) {
          return impl.zIndex_;
        }
        var ol = impl && impl.olLayer;
        if (ol && esFuncion(ol.getZIndex)) {
          var zo = ol.getZIndex();
          if (typeof zo === 'number' && isFinite(zo)) return zo;
        }
      } catch (e) { /* sin z-index */ }
      return 0;
    }

    _esVisible(capa) {
      try {
        if (esFuncion(capa.isVisible)) return capa.isVisible();
        if (esFuncion(capa.getVisibility)) return capa.getVisibility();
        return capa.visibility !== false;
      } catch (e) {
        return true;
      }
    }

    _claveCapa(capa) {
      if (!capa) return '';
      // legend y name son estables entre swaps 2D/3D; idLayer no lo es.
      return String(capa.legend || '') + '|' + String(capa.name || capa.idLayer || '');
    }

    _resultadoError(capa, motivo, punto, mpp, generacion) {
      return {
        uid: '',
        tipo: 'error',
        capa: capa,
        clave: this._claveCapa(capa),
        formatos: [],
        formatoActual: null,
        porFormato: {},
        error: this._mensajeError(motivo),
        caps: null,
        punto: punto ? { x: punto.x, y: punto.y, lon: punto.lon, lat: punto.lat } : null,
        mpp: mpp || 1,
        generacion: generacion,
      };
    }

    // ===================================================================
    //  WMS: capacidades y GetFeatureInfo
    // ===================================================================

    _urlServicio(capa) {
      if (!capa) return '';
      try {
        if (capa.url) return String(capa.url);
        if (esFuncion(capa.getURL)) return String(capa.getURL());
        if (capa.options && capa.options.url) return String(capa.options.url);
        if (capa.getImpl && esFuncion(capa.getImpl().getURL)) return String(capa.getImpl().getURL());
      } catch (e) { /* sin url */ }
      return '';
    }

    _urlCapacidades(url) {
      try {
        var u = new URL(url, global.location.href);
        u.searchParams.set('SERVICE', 'WMS');
        u.searchParams.set('REQUEST', 'GetCapabilities');
        return u.toString();
      } catch (e) {
        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'SERVICE=WMS&REQUEST=GetCapabilities';
      }
    }

    /**
     * Capacidades por URL de servicio. La primera llamada descarga una sola
     * vez aunque haya 18 capas del mismo WMS; las demás esperan la misma
     * promesa. Si el fetch directo falla (CORS), se intenta la vía de la API,
     * que respeta el proxy si está activado.
     */
    _capacidadesDe(capa) {
      var url = this._urlServicio(capa);
      if (!url) return Promise.resolve(null);
      if (this._capsCache[url]) return this._capsCache[url];
      var promesa = this._descargarCapacidades(capa, url);
      this._capsCache[url] = promesa;
      return promesa;
    }

    async _descargarCapacidades(capa, url) {
      var capacidades = null;
      try {
        var respuesta = await fetch(this._urlCapacidades(url), { cache: 'no-store' });
        if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
        var texto = await respuesta.text();
        var doc = new DOMParser().parseFromString(texto, 'text/xml');
        capacidades = this._parsearCapacidadesXML(doc);
      } catch (e) {
        capacidades = null;
      }

      if (!capacidades) {
        try {
          if (capa && esFuncion(capa.getCapabilities)) {
            var objeto = await capa.getCapabilities();
            capacidades = this._normalizarCapacidadesAPI(objeto);
          }
        } catch (e2) {
          capacidades = null;
        }
      }

      if (!capacidades) {
        capacidades = {
          version: '1.3.0',
          formatos: [],
          capas: {},
          crs: new Set(),
          leidas: false,
          error: 'No se pudieron leer las capacidades del servicio.',
        };
      }
      return capacidades;
    }

    _hijo(nodo, nombre) {
      if (!nodo || !nodo.children) return null;
      for (var i = 0; i < nodo.children.length; i += 1) {
        var hijo = nodo.children[i];
        if (hijo.localName === nombre || hijo.nodeName === nombre) return hijo;
      }
      return null;
    }

    _hijos(nodo, nombre) {
      var salida = [];
      if (!nodo || !nodo.children) return salida;
      for (var i = 0; i < nodo.children.length; i += 1) {
        var hijo = nodo.children[i];
        if (hijo.localName === nombre || hijo.nodeName === nombre) salida.push(hijo);
      }
      return salida;
    }

    _textoNodo(nodo) {
      return nodo && nodo.textContent ? nodo.textContent.trim() : '';
    }

    _textoHijo(nodo, nombre) {
      return this._textoNodo(this._hijo(nodo, nombre));
    }

    _parsearCapacidadesXML(doc) {
      var raiz = doc && doc.documentElement;
      if (!raiz) return null;
      var cap = this._hijo(raiz, 'Capability');
      if (!cap) return null;

      var request = this._hijo(cap, 'Request');
      var gfi = request ? this._hijo(request, 'GetFeatureInfo') : null;
      var formatos = gfi ? this._hijos(gfi, 'Format').map(this._textoNodo, this).filter(Boolean) : [];
      var capaRaiz = this._hijo(cap, 'Layer');
      var capas = {};
      var crsRaiz = null;

      var recorrer = function (nodo, heredaQueryable, heredaCrs) {
        if (!nodo) return;
        var atributoQ = nodo.getAttribute ? nodo.getAttribute('queryable') : null;
        var queryable = (atributoQ === null || atributoQ === undefined)
          ? heredaQueryable
          : (atributoQ === '1' || String(atributoQ).toLowerCase() === 'true');

        var crs = new Set();
        heredaCrs.forEach(function (valor) { crs.add(valor); });
        var nodosCrs = this._hijos(nodo, 'CRS').concat(this._hijos(nodo, 'SRS'));
        nodosCrs.forEach(function (nodoCrs) {
          var valor = this._textoNodo(nodoCrs);
          if (valor) crs.add(valor);
        }, this);

        if (nodo === capaRaiz) crsRaiz = crs;

        var nombre = this._textoHijo(nodo, 'Name');
        if (nombre) {
          capas[nombre] = {
            name: nombre,
            title: this._textoHijo(nodo, 'Title'),
            queryable: queryable,
            crs: Array.from(crs),
          };
        }

        this._hijos(nodo, 'Layer').forEach(function (hijo) {
          recorrer(hijo, queryable, crs);
        });
      }.bind(this);

      recorrer(capaRaiz, true, new Set());

      return {
        version: raiz.getAttribute('version') || '1.3.0',
        formatos: formatos,
        capas: capas,
        crs: crsRaiz || new Set(),
        leidas: true,
      };
    }

    _normalizarCapacidadesAPI(objeto) {
      var caps = objeto && objeto.capabilities_;
      if (!caps) return null;
      var cap = caps.Capability || {};
      var request = cap.Request || {};
      var gfi = request.GetFeatureInfo || {};
      var formatos = gfi.Format || [];
      if (!Array.isArray(formatos)) formatos = [formatos];
      formatos = formatos.map(function (formato) {
        if (typeof formato === 'string') return formato;
        if (formato && typeof formato === 'object') return formato._ || formato.value || '';
        return '';
      }).filter(Boolean);

      var capas = {};
      var crsRaiz = null;
      var recorrer = function (nodo, heredaQueryable, heredaCrs) {
        if (!nodo) return;
        var queryable = (nodo.queryable === undefined || nodo.queryable === null)
          ? heredaQueryable
          : (nodo.queryable === true || nodo.queryable === '1' || String(nodo.queryable).toLowerCase() === 'true');

        var crs = new Set();
        heredaCrs.forEach(function (valor) { crs.add(valor); });
        var crsNodo = nodo.CRS || nodo.SRS;
        normalizarLista(crsNodo).forEach(function (valor) {
          if (valor) crs.add(String(valor));
        });
        if (nodo === cap.Layer) crsRaiz = crs;

        if (nodo.Name) {
          capas[nodo.Name] = {
            name: nodo.Name,
            title: nodo.Title || '',
            queryable: queryable,
            crs: Array.from(crs),
          };
        }

        normalizarLista(nodo.Layer).forEach(function (hijo) {
          recorrer(hijo, queryable, crs);
        });
      };

      recorrer(cap.Layer, true, new Set());

      return {
        version: caps.version || '1.3.0',
        formatos: formatos,
        capas: capas,
        crs: crsRaiz || new Set(),
        leidas: true,
      };
    }

    /**
     * Traduce los INFO_FORMAT de las capacidades a los botones del popup.
     * Solo se ofrecen los que sabemos pintar: JSON, HTML, texto y XML/GML.
     */
    _formatosDisponibles(caps) {
      var encontrados = [];
      var anadir = function (id, etiqueta, infoFormat) {
        if (!encontrados.some(function (f) { return f.id === id; })) {
          encontrados.push({ id: id, etiqueta: etiqueta, infoFormat: infoFormat });
        }
      };

      var formatos = (caps && caps.formatos) || [];
      formatos.forEach(function (formato) {
        var texto = String(formato).toLowerCase();
        if (texto.indexOf('json') !== -1) anadir('json', 'JSON', formato);
        else if (texto.indexOf('html') !== -1) anadir('html', 'HTML', formato);
        else if (texto.indexOf('plain') !== -1) anadir('texto', 'Texto', formato);
        else if (texto.indexOf('gml') !== -1 || texto.indexOf('xml') !== -1) anadir('xml', 'XML', formato);
      });

      // Si no se pudieron leer las capacidades, se prueba con lo más común.
      if (!encontrados.length && caps && caps.leidas === false) {
        anadir('json', 'JSON', 'application/json');
        anadir('html', 'HTML', 'text/html');
      }

      // La herramienta nace para alternar JSON y HTML. Texto y XML se
      // mantienen como respaldo para servicios que no ofrecen ninguno de
      // esos dos, pero no se mezclan con ellos en el selector.
      var tieneJsonOHtml = encontrados.some(function (f) {
        return f.id === 'json' || f.id === 'html';
      });
      if (tieneJsonOHtml) {
        encontrados = encontrados.filter(function (f) {
          return f.id === 'json' || f.id === 'html';
        });
      }

      var orden = { json: 0, html: 1, texto: 2, xml: 3 };
      encontrados.sort(function (a, b) { return orden[a.id] - orden[b.id]; });
      return encontrados;
    }

    _formatoPreferido(clave, formatos) {
      var pref = this._preferencias[clave];
      if (pref && pref.formato && formatos.some(function (f) { return f.id === pref.formato; })) {
        return pref.formato;
      }
      if (formatos.some(function (f) { return f.id === 'json'; })) return 'json';
      return formatos.length ? formatos[0].id : null;
    }

    _crsPreferido(caps) {
      var crs = caps && caps.crs;
      if (crs && typeof crs.forEach === 'function') {
        var tiene3857 = false;
        var tiene4326 = false;
        crs.forEach(function (valor) {
          var texto = String(valor).toUpperCase();
          if (texto.indexOf('3857') !== -1) tiene3857 = true;
          if (texto.indexOf('4326') !== -1 || texto.indexOf('CRS:84') !== -1) tiene4326 = true;
        });
        if (tiene3857) return 'EPSG:3857';
        if (tiene4326) return 'EPSG:4326';
      }
      return 'EPSG:3857';
    }

    /**
     * Construye la URL de GetFeatureInfo con una vista sintética de 256x256
     * centrada en el clic. Así el mismo cálculo sirve en 2D y en 3D, y la
     * tolerancia BUFFER se mide en píxeles de esa vista (no en kilómetros).
     */
    _urlFeatureInfo(capa, punto, formato, caps, mpp) {
      var url = this._urlServicio(capa);
      if (!url) throw new Error('La capa no tiene URL de servicio.');

      var version = (caps && caps.version) || '1.3.0';
      var crs = (caps && caps.crsPreferido) || this._crsPreferido(caps);
      var ancho = this._anchoConsulta;
      var alto = this._altoConsulta;
      var centro = Math.floor(ancho / 2);
      var centroY = Math.floor(alto / 2);
      var metros = (isFinite(mpp) && mpp > 0) ? mpp : 1;
      var mitadX = (ancho * metros) / 2;
      var mitadY = (alto * metros) / 2;
      var bbox = null;

      if (crs === 'EPSG:4326') {
        var lon = punto.lon;
        var lat = punto.lat;
        var mitadLon = mitadX / (111320 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
        var mitadLat = mitadY / 110540;
        var minLon = lon - mitadLon;
        var maxLon = lon + mitadLon;
        var minLat = lat - mitadLat;
        var maxLat = lat + mitadLat;
        bbox = (version === '1.3.0')
          ? [minLat, minLon, maxLat, maxLon]
          : [minLon, minLat, maxLon, maxLat];
      } else {
        bbox = [
          punto.x - mitadX,
          punto.y - mitadY,
          punto.x + mitadX,
          punto.y + mitadY,
        ];
      }

      var nombre = Array.isArray(capa.name) ? capa.name.join(',') : capa.name;
      var u;
      try {
        u = new URL(url, global.location.href);
      } catch (e) {
        throw new Error('La URL del servicio no es válida.');
      }

      u.searchParams.set('SERVICE', 'WMS');
      u.searchParams.set('VERSION', version);
      u.searchParams.set('REQUEST', 'GetFeatureInfo');
      u.searchParams.set('LAYERS', nombre);
      u.searchParams.set('QUERY_LAYERS', nombre);
      u.searchParams.set('STYLES', '');
      u.searchParams.set('FORMAT', 'image/png');
      u.searchParams.set('INFO_FORMAT', formato.infoFormat);
      u.searchParams.set('FEATURE_COUNT', String(this._maxFeatures));
      u.searchParams.set('WIDTH', String(ancho));
      u.searchParams.set('HEIGHT', String(alto));
      u.searchParams.set('BUFFER', String(this._buffer));
      u.searchParams.set('BBOX', bbox.join(','));

      if (version === '1.3.0') {
        u.searchParams.set('CRS', crs);
        u.searchParams.set('I', String(centro));
        u.searchParams.set('J', String(centroY));
      } else {
        u.searchParams.set('SRS', crs);
        u.searchParams.set('X', String(centro));
        u.searchParams.set('Y', String(centroY));
      }

      return u.toString();
    }

    async _pedirFeatureInfo(capa, punto, formato, caps, mpp) {
      var self = this;
      var crs = this._crsPreferido(caps);
      var intentos = (crs === 'EPSG:3857') ? ['EPSG:3857', 'EPSG:4326'] : [crs];

      var ultimoError = null;
      for (var i = 0; i < intentos.length; i += 1) {
        var capsIntento = this._capsConCrs(caps, intentos[i]);
        var url = this._urlFeatureInfo(capa, punto, formato, capsIntento, mpp);
        var respuesta;
        var texto;
        try {
          respuesta = await fetch(url, { cache: 'no-store' });
          texto = await respuesta.text();
        } catch (e) {
          ultimoError = e;
          continue;
        }

        if (!respuesta.ok) {
          ultimoError = new Error('HTTP ' + respuesta.status);
          continue;
        }

        if (this._esExcepcionOGC(texto)) {
          ultimoError = new Error(this._mensajeExcepcion(texto));
          continue;
        }

        if (formato.id === 'json') {
          var json;
          try {
            json = JSON.parse(texto);
          } catch (e) {
            ultimoError = new Error('El servicio no devolvió un JSON válido.');
            continue;
          }
          return {
            tipo: 'json',
            json: json,
            features: this._featuresDeJson(json, capa),
            texto: texto,
          };
        }

        if (formato.id === 'html') {
          return {
            tipo: 'html',
            html: this._limpiarHtml(texto),
            texto: texto,
          };
        }

        return {
          tipo: 'texto',
          texto: texto,
        };
      }

      throw ultimoError || new Error('No se pudo consultar el servicio.');
    }

    _capsConCrs(caps, crs) {
      var copia = Object.assign({}, caps || {});
      copia.crs = new Set([crs]);
      return copia;
    }

    _esExcepcionOGC(texto) {
      if (!texto) return false;
      var recorte = String(texto).slice(0, 2000);
      if (!/^\s*</.test(recorte)) return false;
      return /ServiceExceptionReport|ExceptionReport|ServiceException|ExceptionText/i.test(recorte);
    }

    _mensajeExcepcion(texto) {
      try {
        var doc = new DOMParser().parseFromString(texto, 'text/xml');
        var nodos = doc.getElementsByTagName('ServiceException');
        if (!nodos.length) nodos = doc.getElementsByTagName('ExceptionText');
        if (nodos.length) return nodos[0].textContent.trim();
      } catch (e) { /* se devuelve un mensaje genérico */ }
      return 'El servicio devolvió una excepción OGC.';
    }

    _featuresDeJson(json, capa) {
      var lista = [];
      if (json && json.type === 'FeatureCollection' && Array.isArray(json.features)) {
        lista = json.features;
      } else if (Array.isArray(json)) {
        lista = json;
      } else if (json && Array.isArray(json.features)) {
        lista = json.features;
      } else if (json && Array.isArray(json.results)) {
        lista = json.results;
      } else if (json && json.type === 'Feature') {
        lista = [json];
      } else if (json && typeof json === 'object') {
        lista = [json];
      }

      var self = this;
      return lista.map(function (feature) {
        return self._normalizarFeatureJson(feature, capa);
      }).filter(Boolean);
    }

    _normalizarFeatureJson(feature, capa) {
      if (!feature || typeof feature !== 'object') return null;
      var props = feature.properties || feature.attributes || null;
      if (!props) {
        // Algunos servicios devuelven un objeto plano sin envoltorio Feature.
        props = {};
        Object.keys(feature).forEach(function (clave) {
          if (clave !== 'type' && clave !== 'geometry' && clave !== 'id') {
            props[clave] = feature[clave];
          }
        });
      }
      var geometria = feature.geometry || null;
      var id = (feature.id !== undefined && feature.id !== null)
        ? feature.id
        : (props.id !== undefined && props.id !== null ? props.id : null);
      // Un objeto vacío ({}, {"type":"FeatureCollection"}) no es una entidad.
      if (!Object.keys(props || {}).length && !geometria) return null;
      return this._prepararElemento({
        propiedades: props,
        geometria: geometria ? { tipo: geometria.type || null, coordenadas: geometria.coordinates || null } : null,
        id: id,
        crudo: feature,
        fuente: 'wms',
      }, capa);
    }

    /**
     * GeoServer devuelve una página HTML completa en GetFeatureInfo. Se
     * extrae el body y se quitan scripts, estilos y manejadores inline para
     * que no alteren el resto del visualizador.
     */
    _limpiarHtml(texto) {
      if (!texto) return '';
      try {
        var doc = new DOMParser().parseFromString(String(texto), 'text/html');
        var body = doc.body;
        if (!body) return '';
        body.querySelectorAll('script, style, link, meta, title, base, iframe, object, embed').forEach(function (nodo) {
          nodo.remove();
        });
        body.querySelectorAll('*').forEach(function (nodo) {
          Array.prototype.slice.call(nodo.attributes || []).forEach(function (atributo) {
            var nombre = String(atributo.name || '').toLowerCase();
            var valor = String(atributo.value || '');
            if (nombre.indexOf('on') === 0 || /^\s*javascript:/i.test(valor)) {
              nodo.removeAttribute(atributo.name);
            }
          });
        });
        return body.innerHTML.trim();
      } catch (e) {
        return escaparHtml(texto);
      }
    }

    // ===================================================================
    //  Capas vectoriales
    // ===================================================================

    async _consultarVector(capa, punto, pixel, cartesiano, mpp, generacion) {
      var esCesium = this._esCesium();
      // Al restaurar el estado tras el cambio 2D/3D la escena de Cesium aún
      // puede estar colocándose: el drillPick devuelve vacío aunque el punto
      // sea correcto. En ese caso se reintenta recalculando el píxel.
      var intentos = (esCesium && this._reabriendo) ? 5 : 1;
      var pixelIntento = pixel;
      var features = [];

      for (var i = 0; i < intentos; i += 1) {
        if (esCesium && this._reabriendo && i > 0) {
          var nuevoPixel = this._pixelDesdePunto(punto);
          if (nuevoPixel) pixelIntento = nuevoPixel;
        }
        features = esCesium
          ? this._consultarVector3D(capa, pixelIntento, punto, mpp)
          : this._consultarVector2D(capa, pixelIntento);
        if (features.length) break;
        if (i < intentos - 1) {
          await new Promise(function (resolve) { setTimeout(resolve, 500); });
        }
      }

      if (!features.length) return { omitida: true };

      return {
        uid: '',
        tipo: 'vector',
        capa: capa,
        clave: this._claveCapa(capa),
        formatos: [],
        formatoActual: 'vector',
        porFormato: {
          vector: {
            estado: 'ok',
            tipo: 'vector',
            features: features,
          },
        },
        error: null,
        caps: null,
        punto: punto ? { x: punto.x, y: punto.y, lon: punto.lon, lat: punto.lat } : null,
        mpp: mpp || 1,
        generacion: generacion,
      };
    }

    _consultarVector2D(capa, pixel) {
      if (!pixel) return [];
      var impl = this._getImpl();
      if (!impl || !esFuncion(impl.forEachFeatureAtPixel)) return [];

      var capaImpl = null;
      try {
        var implCapa = capa.getImpl ? capa.getImpl() : null;
        capaImpl = (implCapa && implCapa.olLayer)
          || (implCapa && esFuncion(implCapa.getLayer) ? implCapa.getLayer() : null);
      } catch (e) {
        capaImpl = null;
      }

      var salida = [];
      var vistos = new Set();
      var self = this;
      impl.forEachFeatureAtPixel(pixel, function (feature, capaOl) {
        if (capaImpl && capaOl) {
          var misma = (capaOl === capaImpl)
            || (capaOl.ol_uid !== undefined && capaOl.ol_uid === capaImpl.ol_uid);
          if (!misma) return;
        }
        var clave = null;
        try {
          clave = (feature.ol_uid !== undefined) ? feature.ol_uid : (esFuncion(feature.getId) ? feature.getId() : feature);
        } catch (e) {
          clave = feature;
        }
        if (vistos.has(clave)) return;
        vistos.add(clave);
        var normalizado = self._normalizarFeatureOL(feature, capa);
        if (normalizado) salida.push(normalizado);
      }, { hitTolerance: 6 });

      return salida;
    }

    _normalizarFeatureOL(feature, capa) {
      if (!feature) return null;
      var props = {};
      try {
        var propiedades = esFuncion(feature.getProperties) ? feature.getProperties() : {};
        Object.keys(propiedades || {}).forEach(function (clave) {
          if (clave !== 'geometry') props[clave] = propiedades[clave];
        });
      } catch (e) {
        props = {};
      }

      var geometria = null;
      try {
        var geom = esFuncion(feature.getGeometry) ? feature.getGeometry() : null;
        if (geom) {
          geometria = {
            tipo: esFuncion(geom.getType) ? geom.getType() : null,
            coordenadas: esFuncion(geom.getCoordinates) ? geom.getCoordinates() : null,
          };
        }
      } catch (e) {
        geometria = null;
      }

      var id = null;
      try {
        id = esFuncion(feature.getId) ? feature.getId() : null;
      } catch (e) {
        id = null;
      }
      if (id === null && props.id !== undefined) id = props.id;
      // Sin atributos ni geometría no hay nada que contar.
      if (!Object.keys(props || {}).length && !geometria) return null;

      var crudo = {
        type: 'Feature',
        id: id,
        properties: props,
        geometry: geometria ? { type: geometria.tipo, coordinates: geometria.coordenadas } : null,
      };

      return this._prepararElemento({
        propiedades: props,
        geometria: geometria,
        id: id,
        crudo: crudo,
        fuente: 'vector',
      }, capa);
    }

    /**
     * Consulta vectorial en 3D. Primero usa el pick de pantalla y, cuando se
     * está restaurando el estado tras el cambio 2D/3D, cae a una comprobación
     * geográfica contra las entidades de la fuente de datos. Esa segunda vía
     * no depende de que la cámara de Cesium ya esté colocada ni de que la
     * escena haya terminado de renderizar.
     */
    _consultarVector3D(capa, posicion, punto, mpp) {
      var porPick = this._consultarVector3DPorPick(capa, posicion);
      if (porPick.length) return porPick;
      if (punto && this._reabriendo) {
        try {
          return this._consultarVector3DPorCoordenada(capa, punto, mpp);
        } catch (e) {
          return porPick;
        }
      }
      return porPick;
    }

    _consultarVector3DPorPick(capa, posicion) {
      if (!posicion) return [];
      var impl = this._getImpl();
      if (!impl || !impl.scene) return [];
      var scene = impl.scene;
      if (!esFuncion(scene.drillPick) || !global.Cesium) return [];

      var fuente = this._dataSourceDeCapa(capa);
      if (!fuente || !fuente.entities) return [];

      var picks = [];
      try {
        picks = scene.drillPick(posicion, 12, 4) || [];
      } catch (e) {
        picks = [];
      }

      var salida = [];
      var vistos = new Set();
      var self = this;
      picks.forEach(function (pick) {
        var entidad = pick && pick.id;
        if (!entidad) return;

        var pertenece = false;
        try {
          if (esFuncion(fuente.entities.contains)) pertenece = fuente.entities.contains(entidad);
          else pertenece = fuente.entities.values.indexOf(entidad) !== -1;
        } catch (e) {
          pertenece = false;
        }
        if (!pertenece) return;

        var clave = entidad.id || entidad;
        if (vistos.has(clave)) return;
        vistos.add(clave);
        var normalizado = self._normalizarEntidadCesium(entidad, capa);
        if (normalizado) salida.push(normalizado);
      });

      return salida;
    }

    _consultarVector3DPorCoordenada(capa, punto, mpp) {
      if (!global.Cesium || !punto) return [];
      var fuente = this._dataSourceDeCapa(capa);
      if (!fuente || !fuente.entities) return [];

      var entidades = fuente.entities.values || [];
      var tiempo = global.Cesium.JulianDate.now();
      var tolerancia = Math.max(5 * (mpp || 1), 1);
      var salida = [];
      var vistos = new Set();
      var self = this;

      entidades.forEach(function (entidad) {
        if (!entidad) return;
        try {
          var visible = self._valorPropiedad(entidad.show, tiempo);
          if (visible === false) return;
        } catch (e) { /* se supone visible */ }

        var coincide = false;
        try {
          if (entidad.polygon && entidad.polygon.hierarchy) {
            var anillos = self._anillosDePoligono(entidad.polygon.hierarchy, tiempo);
            coincide = self._puntoEnAnillos(punto.lon, punto.lat, anillos);
          } else if (entidad.polyline && entidad.polyline.positions) {
            coincide = self._puntoEnPolilinea(entidad.polyline.positions, punto, tolerancia, tiempo);
          } else if (entidad.position) {
            coincide = self._puntoCercaDePosicion(entidad.position, punto, tolerancia, tiempo);
          }
        } catch (e) {
          coincide = false;
        }
        if (!coincide) return;

        var clave = entidad.id || entidad;
        if (vistos.has(clave)) return;
        vistos.add(clave);
        var normalizado = self._normalizarEntidadCesium(entidad, capa);
        if (normalizado) salida.push(normalizado);
      });

      return salida;
    }

    _valorPropiedad(propiedad, tiempo) {
      if (propiedad === null || propiedad === undefined) return null;
      if (esFuncion(propiedad.getValue)) {
        try {
          return propiedad.getValue(tiempo);
        } catch (e) {
          return null;
        }
      }
      return propiedad;
    }

    _lonLatDeCartesiano(valor) {
      if (!valor || !global.Cesium || !global.Cesium.Math) return null;
      if (Array.isArray(valor) && valor.length >= 2 && typeof valor[0] === 'number') {
        return [valor[0], valor[1]];
      }
      if (valor.longitude !== undefined && valor.latitude !== undefined) {
        return [
          global.Cesium.Math.toDegrees(valor.longitude),
          global.Cesium.Math.toDegrees(valor.latitude),
        ];
      }
      try {
        var cartografica = global.Cesium.Cartographic.fromCartesian(valor);
        if (!cartografica) return null;
        return [
          global.Cesium.Math.toDegrees(cartografica.longitude),
          global.Cesium.Math.toDegrees(cartografica.latitude),
        ];
      } catch (e) {
        return null;
      }
    }

    _anillosDePoligono(jerarquia, tiempo) {
      var valor = this._valorPropiedad(jerarquia, tiempo);
      var anillos = [];
      var self = this;

      var anadir = function (nodo) {
        if (!nodo) return;
        var posiciones = (nodo.positions !== undefined)
          ? self._valorPropiedad(nodo.positions, tiempo)
          : nodo;
        var anillo = [];
        normalizarLista(posiciones).forEach(function (posicion) {
          var lonlat = self._lonLatDeCartesiano(posicion);
          if (lonlat) anillo.push(lonlat);
        });
        if (anillo.length >= 3) anillos.push(anillo);

        var huecos = (nodo.holes !== undefined)
          ? self._valorPropiedad(nodo.holes, tiempo)
          : null;
        normalizarLista(huecos).forEach(anadir);
      };

      anadir(valor);
      return anillos;
    }

    _puntoEnAnillos(lon, lat, anillos) {
      var dentro = false;
      (anillos || []).forEach(function (anillo) {
        for (var i = 0, j = anillo.length - 1; i < anillo.length; j = i, i += 1) {
          var xi = anillo[i][0];
          var yi = anillo[i][1];
          var xj = anillo[j][0];
          var yj = anillo[j][1];
          var intersecta = ((yi > lat) !== (yj > lat))
            && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
          if (intersecta) dentro = !dentro;
        }
      });
      return dentro;
    }

    _puntoEnPolilinea(propiedad, punto, tolerancia, tiempo) {
      var valor = this._valorPropiedad(propiedad, tiempo);
      var puntos = [];
      var self = this;
      normalizarLista(valor).forEach(function (posicion) {
        var lonlat = self._lonLatDeCartesiano(posicion);
        if (lonlat) puntos.push(lonlat);
      });

      if (!puntos.length) return false;
      if (puntos.length === 1) return this._puntoCercaDeLonLat(puntos[0], punto, tolerancia);

      var cos = Math.cos(punto.lat * Math.PI / 180);
      for (var i = 1; i < puntos.length; i += 1) {
        var a = [
          (puntos[i - 1][0] - punto.lon) * 111320 * cos,
          (puntos[i - 1][1] - punto.lat) * 110540,
        ];
        var b = [
          (puntos[i][0] - punto.lon) * 111320 * cos,
          (puntos[i][1] - punto.lat) * 110540,
        ];
        if (this._distanciaPuntoSegmento([0, 0], a, b) <= tolerancia) return true;
      }
      return false;
    }

    _puntoCercaDePosicion(propiedad, punto, tolerancia, tiempo) {
      var valor = this._valorPropiedad(propiedad, tiempo);
      var lonlat = this._lonLatDeCartesiano(valor);
      if (!lonlat) return false;
      return this._puntoCercaDeLonLat(lonlat, punto, tolerancia);
    }

    _puntoCercaDeLonLat(lonlat, punto, tolerancia) {
      var cos = Math.cos(punto.lat * Math.PI / 180);
      var dx = (lonlat[0] - punto.lon) * 111320 * cos;
      var dy = (lonlat[1] - punto.lat) * 110540;
      return Math.sqrt(dx * dx + dy * dy) <= tolerancia;
    }

    _distanciaPuntoSegmento(p, a, b) {
      var dx = b[0] - a[0];
      var dy = b[1] - a[1];
      var largo2 = dx * dx + dy * dy;
      if (largo2 === 0) return Math.sqrt(Math.pow(p[0] - a[0], 2) + Math.pow(p[1] - a[1], 2));
      var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo2;
      t = Math.max(0, Math.min(1, t));
      var x = a[0] + t * dx;
      var y = a[1] + t * dy;
      return Math.sqrt(Math.pow(p[0] - x, 2) + Math.pow(p[1] - y, 2));
    }

    _dataSourceDeCapa(capa) {
      var implCapa = null;
      try {
        implCapa = capa.getImpl ? capa.getImpl() : null;
      } catch (e) {
        implCapa = null;
      }
      if (!implCapa) return null;

      var fuente = null;
      try {
        if (esFuncion(implCapa.getLayer)) fuente = implCapa.getLayer();
      } catch (e) {
        fuente = null;
      }
      if (!fuente && implCapa.cesiumLayer) fuente = implCapa.cesiumLayer;
      if (fuente && fuente.entities) return fuente;

      // Último recurso: buscar por nombre entre las fuentes de datos del
      // viewer. El nombre de la capa suele coincidir con el de la fuente.
      try {
        var viewer = this._getImpl();
        var lista = viewer && viewer.dataSources ? viewer.dataSources._dataSources : null;
        if (lista) {
          for (var i = 0; i < lista.length; i += 1) {
            if (lista[i] && lista[i].entities && lista[i].name === capa.name) return lista[i];
          }
        }
      } catch (e) { /* sin viewer */ }
      return null;
    }

    _normalizarEntidadCesium(entidad, capa) {
      var props = {};
      var tiempo = null;
      try {
        if (global.Cesium && global.Cesium.JulianDate) tiempo = global.Cesium.JulianDate.now();
      } catch (e) {
        tiempo = null;
      }

      try {
        if (entidad.properties && esFuncion(entidad.properties.getValue)) {
          props = entidad.properties.getValue(tiempo) || {};
        } else if (entidad.properties) {
          Object.keys(entidad.properties).forEach(function (clave) {
            var propiedad = entidad.properties[clave];
            props[clave] = (propiedad && esFuncion(propiedad.getValue))
              ? propiedad.getValue(tiempo)
              : propiedad;
          });
        }
      } catch (e) {
        props = {};
      }

      try {
        if (entidad.name && props.nombre === undefined && props.name === undefined) {
          props.nombre = entidad.name;
        }
      } catch (e) { /* sin nombre */ }

      var tipo = null;
      if (entidad.polygon) tipo = 'Polygon';
      else if (entidad.polyline) tipo = 'LineString';
      else if (entidad.position || entidad.point || entidad.billboard || entidad.label) tipo = 'Point';
      else if (entidad.box) tipo = 'Box';
      else if (entidad.ellipse) tipo = 'Ellipse';
      else if (entidad.cylinder) tipo = 'Cylinder';
      else if (entidad.corridor) tipo = 'Corridor';
      else if (entidad.model) tipo = 'Model';
      else if (entidad.tileset) tipo = 'Tileset';

      var id = null;
      try {
        id = (entidad.id !== undefined && entidad.id !== null) ? entidad.id : null;
      } catch (e) {
        id = null;
      }
      // Sin atributos ni forma no hay nada que contar.
      if (!Object.keys(props || {}).length && !tipo) return null;

      var crudo = {
        type: 'Feature',
        id: id,
        properties: props,
        geometry: tipo ? { type: tipo } : null,
      };

      return this._prepararElemento({
        propiedades: props,
        geometria: tipo ? { tipo: tipo } : null,
        id: id,
        crudo: crudo,
        fuente: 'vector',
      }, capa);
    }

    /** Normaliza atributos y geometría a la estructura que ven las plantillas. */
    _prepararElemento(datos, capa) {
      var props = datos.propiedades || {};
      var campos = [];
      var self = this;
      Object.keys(props).forEach(function (clave) {
        if (self._camposOcultos[clave]) return;
        if (clave === 'geometry' || clave === 'bbox' || clave === '__proto__') return;
        var valor = props[clave];
        if (!self._mostrarVacios && (valor === null || valor === undefined || valor === '')) return;
        campos.push({
          clave: clave,
          etiqueta: self._etiquetas[clave] || nombreCampo(clave),
          valor: valor,
          texto: aTexto(valor),
        });
      });

      var titulo = buscarValor(props, [
        'nombre', 'name', 'titulo', 'title', 'localidad', 'municipio',
        'NOMBRE', 'NOMDIS', 'sta',
      ]);
      if (titulo === null || titulo === undefined) {
        titulo = (datos.id !== null && datos.id !== undefined) ? String(datos.id) : '';
      }

      return {
        propiedades: props,
        campos: campos,
        titulo: titulo,
        id: datos.id,
        geometria: datos.geometria || null,
        crudo: datos.crudo || null,
        fuente: datos.fuente || 'vector',
        capa: {
          name: capa ? capa.name : '',
          legend: capa ? capa.legend : '',
          type: capa ? capa.type : '',
          idLayer: capa ? capa.idLayer : '',
        },
      };
    }

    // ===================================================================
    //  Popup
    // ===================================================================

    _indiceTabActivo() {
      if (!this._popup) return 0;
      var root = null;
      try { root = document.getElementById(this._popup.getId()); } catch (e) { root = null; }
      if (!root) return 0;
      var tabs = root.querySelectorAll('.m-tab');
      for (var i = 0; i < tabs.length; i += 1) {
        if (tabs[i].classList.contains('m-activated')) return i;
      }
      return 0;
    }

    _activarTab(indice) {
      if (!this._popup) return;
      var root = null;
      try { root = document.getElementById(this._popup.getId()); } catch (e) { root = null; }
      if (!root) return;
      var tabs = root.querySelectorAll('.m-tab');
      for (var i = 0; i < tabs.length; i += 1) {
        tabs[i].classList.toggle('m-activated', i === indice);
      }
      try {
        this._popup.switchTab(indice);
      } catch (e) {
        /* pestaña fuera de rango */
      }
    }

    _marcarPopup(popup, resultados) {
      if (!popup) return;
      var self = this;
      var marcar = function () {
        try {
          var root = document.getElementById(popup.getId());
          if (!root) return;
          root.classList.add('g-information-popup');

          // La plantilla del popup de la API pinta las pestañas solo con el
          // icono. Con varias capas eso deja una fila de iconos idénticos,
          // así que se añade el nombre de la capa (truncado por CSS) y el
          // título completo como tooltip/aria-label.
          if (!resultados || !resultados.length || root.getAttribute('data-info-etiquetado') === '1') return;
          var tabs = root.querySelectorAll('.m-tab');
          // El DOM del popup puede tardar un instante en montar las
          // pestañas. Si aún no están, no se marca como etiquetado para que
          // los reintentos de 0 y 120 ms lo hagan.
          if (!tabs.length) return;
          for (var i = 0; i < tabs.length; i += 1) {
            var resultado = resultados[i];
            if (!resultado) continue;
            var titulo = self._tituloCapa(resultado.capa);
            tabs[i].setAttribute('title', titulo);
            tabs[i].setAttribute('aria-label', titulo);
            if (titulo && !tabs[i].querySelector('.g-information-tab-texto')) {
              var texto = document.createElement('span');
              texto.className = 'g-information-tab-texto';
              texto.textContent = titulo;
              tabs[i].appendChild(texto);
            }
          }
          root.setAttribute('data-info-etiquetado', '1');
        } catch (e) { /* popup ya cerrado */ }
      };
      marcar();
      setTimeout(marcar, 0);
      setTimeout(marcar, 120);
    }

    _cerrarPopup() {
      if (this._popup && this._map) {
        try {
          this._map.removePopup(this._popup);
        } catch (e) {
          /* el popup ya no está */
        }
      }
      this._popup = null;
      this._popupAbierto = false;
    }

    _popupsActuales() {
      if (!this._map || !esFuncion(this._map.getPopups)) return [];
      try {
        var popups = this._map.getPopups();
        return Array.isArray(popups) ? popups.slice() : [];
      } catch (e) {
        return [];
      }
    }

    /**
     * La API abre un popup propio al pinchar una capa vectorial. Ese popup
     * se crea en el mismo evento que este plugin, así que la limpieza se
     * hace en dos pasos: al terminar el evento y un poco después, por si la
     * API lo abre con retraso. Solo se retiran los popups NUEVOS de este
     * clic; los que ya estaban abiertos (de otras herramientas) se respetan.
     */
    _programarLimpiezaPopupsAjenos() {
      var self = this;
      var limpiar = function () {
        if (!self._activo || !self._map) return;
        var previos = self._popupsPrevios || [];
        self._popupsActuales().forEach(function (popup) {
          if (!popup || popup === self._popup) return;
          if (previos.indexOf(popup) !== -1) return;
          try {
            self._map.removePopup(popup);
          } catch (e) {
            /* popup ya retirado */
          }
        });
      };
      setTimeout(limpiar, 0);
      setTimeout(limpiar, 180);
    }

    _mostrarCargando(coord) {
      var IDEE = api();
      if (!IDEE || !IDEE.Popup || !this._map) return;
      this._cerrarPopup();

      var self = this;
      var popup = new IDEE.Popup();
      var hideOriginal = popup.hide.bind(popup);
      popup.hide = function (evt) {
        self._popupAbierto = false;
        return hideOriginal(evt);
      };
      popup.addTab({
        icon: 'g-cartografia-info',
        title: this._titulo,
        content: '<div class="g-information-cargando">' +
          '<span class="g-information-spinner" aria-hidden="true"></span>' +
          ' Obteniendo información…</div>',
        listeners: [],
      });

      this._popup = popup;
      this._popupAbierto = true;
      try {
        this._map.addPopup(popup, coord, false);
      } catch (e) {
        this._popup = null;
        this._popupAbierto = false;
        return;
      }
      this._marcarPopup(popup);
    }

    _mostrarMensaje(mensaje) {
      var IDEE = api();
      if (!IDEE || !IDEE.Popup || !this._map || !this._coordPopup) return;
      this._cerrarPopup();

      var self = this;
      var popup = new IDEE.Popup();
      var hideOriginal = popup.hide.bind(popup);
      popup.hide = function (evt) {
        self._popupAbierto = false;
        return hideOriginal(evt);
      };
      popup.addTab({
        icon: 'g-cartografia-info',
        title: this._titulo,
        content: '<p class="g-information-vacio">' + escaparHtml(mensaje) + '</p>',
        listeners: [],
      });

      this._popup = popup;
      this._popupAbierto = true;
      try {
        this._map.addPopup(popup, this._coordPopup, false);
      } catch (e) {
        this._popup = null;
        this._popupAbierto = false;
        return;
      }
      this._marcarPopup(popup);
    }

    _renderizarPopupNuevo(resultados) {
      var IDEE = api();
      if (!IDEE || !IDEE.Popup || !this._map || !this._coordPopup) return;
      this._cerrarPopup();

      var self = this;
      var popup = new IDEE.Popup();
      var hideOriginal = popup.hide.bind(popup);
      popup.hide = function (evt) {
        self._popupAbierto = false;
        return hideOriginal(evt);
      };

      resultados.forEach(function (resultado) {
        popup.addTab({
          icon: 'g-cartografia-info',
          title: self._tituloCapa(resultado.capa),
          content: self._htmlTab(resultado),
          listeners: self._listenersTab(resultado),
        });
      });

      this._popup = popup;
      this._popupAbierto = true;
      try {
        this._map.addPopup(popup, this._coordPopup, false);
      } catch (e) {
        this._popup = null;
        this._popupAbierto = false;
        return;
      }
      this._marcarPopup(popup, resultados);

      var indice = 0;
      if (this._tabActivaPendiente !== null && this._tabActivaPendiente !== undefined) {
        indice = this._tabActivaPendiente;
        this._tabActivaPendiente = null;
      }
      if (indice >= resultados.length) indice = 0;
      var self2 = this;
      setTimeout(function () {
        self2._activarTab(indice);
      }, 0);
    }

    _tituloCapa(capa) {
      if (!capa) return this._titulo;
      return capa.legend || capa.name || capa.idLayer || this._titulo;
    }

    _resultadoTieneContenido(resultado) {
      if (!resultado) return false;
      if (resultado.tipo === 'error') return !!resultado.error;
      var estado = resultado.porFormato && resultado.porFormato[resultado.formatoActual];
      if (!estado) return !!resultado.error;
      if (estado.estado === 'error') return true;
      if (estado.tipo === 'html') {
        return !!(estado.html && String(estado.html).trim())
          && !this._textoSinInformacion(estado.html);
      }
      if (estado.tipo === 'texto') {
        var texto = estado.texto;
        if (!texto || !String(texto).trim()) return false;
        // Un XML/GML de WFS sin miembros no aporta nada.
        if (/<gml:featureMember|<gml:featureMembers|<wfs:member/i.test(texto)) return true;
        if (/<(?:wfs:)?FeatureCollection/i.test(texto)
          && !/<(?:gml|wfs):/i.test(texto)) {
          return false;
        }
        return !this._textoSinInformacion(texto);
      }
      return !!(estado.features && estado.features.length);
    }

    /** Texto visible de una respuesta HTML/XML, sin etiquetas ni espacios de más. */
    _textoVisible(valor) {
      var texto = String(valor || '');
      try {
        var contenedor = document.createElement('div');
        contenedor.innerHTML = texto;
        return (contenedor.textContent || contenedor.innerText || '')
          .replace(/\s+/g, ' ').trim();
      } catch (e) {
        return texto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    /**
     * Algunos WMS responden con una página HTML válida que solo dice que no
     * hay entidades. Sin esta comprobación se abriría una pestaña vacía.
     */
    _textoSinInformacion(valor) {
      var visible = this._textoVisible(valor);
      if (!visible) return true;
      var bajo = visible.toLowerCase();
      var marcas = [
        'no matching features',
        'no features were found',
        'no features found',
        'no feature found',
        'no se encontraron',
        'no se ha encontrado',
        'no hay informacion',
        'no hay información',
        'nothing found',
        'no results found',
        'sin resultados',
        'no records found',
        'no se encontro informacion',
        'no se encontró información',
      ];
      return marcas.some(function (marca) {
        return bajo.indexOf(marca) !== -1;
      });
    }

    /**
     * Genera el HTML de una pestaña. Los controles llevan un `data-info-tab`
     * único porque los listeners del popup buscan por selector dentro del
     * contenido y, si hay varias capas, no se pueden repetir selectores.
     */
    _htmlTab(resultado) {
      var uid = resultado.uid;
      var formatoActual = resultado.formatoActual;
      var formatos = resultado.formatos || [];
      var plantillas = this._plantillas;
      var plantillaActual = this._plantillaPara(resultado);
      var estado = resultado.porFormato ? resultado.porFormato[formatoActual] : null;
      var cargando = resultado.cargandoFormato === formatoActual
        || (estado && estado.estado === 'cargando');
      var error = resultado.error
        || (estado && estado.estado === 'error' ? estado.error : null);

      var html = '<div class="g-information-contenido" data-info-tab="' + escaparHtml(uid) + '">';
      html += '<div class="g-information-cabecera">';
      html += '<div class="g-information-titulo-capa">' +
        escaparHtml(this._tituloCapa(resultado.capa)) + '</div>';

      if (formatos.length > 1) {
        html += '<div class="g-information-formatos" role="group" aria-label="Formato de la información">';
        html += '<span class="g-information-etiqueta">Formato</span>';
        formatos.forEach(function (formato) {
          var activo = formato.id === formatoActual;
          html += '<button type="button" class="g-information-formato' + (activo ? ' activo' : '') + '"' +
            ' data-info-tab="' + escaparHtml(uid) + '"' +
            ' data-info-formato="' + escaparHtml(formato.id) + '"' +
            ' aria-pressed="' + (activo ? 'true' : 'false') + '">' +
            escaparHtml(formato.etiqueta) + '</button>';
        });
        html += '</div>';
      }

      html += '</div><div class="g-information-cuerpo">';

      if (cargando) {
        html += '<div class="g-information-cargando">' +
          '<span class="g-information-spinner" aria-hidden="true"></span>' +
          ' Obteniendo información…</div>';
      } else if (error) {
        html += '<p class="g-information-error">' + escaparHtml(error) + '</p>';
      } else if (estado && estado.tipo === 'html') {
        if (estado.html && String(estado.html).trim()) {
          html += '<div class="g-information-html">' + estado.html + '</div>';
        } else {
          html += '<p class="g-information-vacio">No hay información en este punto.</p>';
        }
      } else if (estado && estado.tipo === 'texto') {
        html += '<pre class="g-information-pre">' + escaparHtml(estado.texto || '') + '</pre>';
      } else {
        var features = (estado && estado.features) ? estado.features : [];
        if (!features.length) {
          html += '<p class="g-information-vacio">No hay información en este punto.</p>';
        } else {
          if (plantillas.length > 1) {
            html += '<label class="g-information-plantilla">Plantilla ';
            html += '<select data-info-tab="' + escaparHtml(uid) + '" data-info-plantilla>';
            plantillas.forEach(function (plantilla) {
              html += '<option value="' + escaparHtml(plantilla.id) + '"' +
                (plantilla.id === plantillaActual ? ' selected' : '') + '>' +
                escaparHtml(plantilla.nombre || plantilla.id) + '</option>';
            });
            html += '</select></label>';
          }
          html += '<div class="g-information-elementos">';
          features.forEach(function (elemento, indice) {
            html += '<article class="g-information-elemento">';
            if (features.length > 1) {
              html += '<div class="g-information-elemento-cabecera">Elemento ' +
                (indice + 1) + ' de ' + features.length + '</div>';
            }
            html += this._renderPlantilla(elemento, resultado, indice);
            html += '</article>';
          }, this);
          html += '</div>';
        }
      }

      html += '</div></div>';
      return html;
    }

    _listenersTab(resultado) {
      var uid = resultado.uid;
      var listeners = [];
      var self = this;

      if ((resultado.formatos || []).length > 1) {
        resultado.formatos.forEach(function (formato) {
          listeners.push({
            selector: '[data-info-tab="' + uid + '"][data-info-formato="' + formato.id + '"]',
            type: 'click',
            callback: function (evt) {
              evt.preventDefault();
              evt.stopPropagation();
              self._cambiarFormato(resultado, formato.id);
            },
          });
        });
      }

      if (this._debeMostrarSelectorPlantilla(resultado)) {
        listeners.push({
          selector: '[data-info-tab="' + uid + '"][data-info-plantilla]',
          type: 'change',
          callback: function (evt) {
            self._cambiarPlantilla(resultado, evt.target.value);
          },
        });
      }

      return listeners;
    }

    _debeMostrarSelectorPlantilla(resultado) {
      if (this._plantillas.length <= 1) return false;
      var estado = resultado.porFormato && resultado.porFormato[resultado.formatoActual];
      if (!estado || estado.estado === 'error') return false;
      if (estado.tipo !== 'json' && estado.tipo !== 'vector') return false;
      return !!(estado.features && estado.features.length);
    }

    _plantillaPara(resultado) {
      var pref = this._preferencias[resultado.clave];
      var id = pref && pref.plantilla;
      if (id && this._plantillas.some(function (p) { return p.id === id; })) return id;
      if (this._plantillas.some(function (p) { return p.id === this._plantillaPorDefecto; }, this)) {
        return this._plantillaPorDefecto;
      }
      return this._plantillas.length ? this._plantillas[0].id : null;
    }

    _renderPlantilla(elemento, resultado, indice) {
      var id = this._plantillaPara(resultado);
      var plantilla = this._plantillas.find(function (p) { return p.id === id; }) || this._plantillas[0];
      if (!plantilla) return '';

      var self = this;
      var contexto = {
        plugin: this,
        capa: resultado.capa,
        formato: resultado.formatoActual,
        plantilla: plantilla,
        indice: indice,
        total: (resultado.porFormato[resultado.formatoActual].features || []).length,
        escapar: escaparHtml,
        texto: aTexto,
        etiqueta: function (clave) {
          return self._etiquetas[clave] || nombreCampo(clave);
        },
        campo: function (clave) {
          var campo = (elemento.campos || []).find(function (c) { return c.clave === clave; });
          if (campo) return campo.texto;
          return aTexto(elemento.propiedades ? elemento.propiedades[clave] : '');
        },
        json: function () {
          return jsonSeguro(elemento.crudo || {
            type: 'Feature',
            id: elemento.id,
            properties: elemento.propiedades,
            geometry: elemento.geometria ? {
              type: elemento.geometria.tipo,
              coordinates: elemento.geometria.coordenadas,
            } : null,
          });
        },
      };

      try {
        var salida = plantilla.render(elemento, contexto);
        if (salida && typeof salida === 'object' && typeof salida.outerHTML === 'string') {
          salida = salida.outerHTML;
        }
        return String(salida === null || salida === undefined ? '' : salida);
      } catch (e) {
        console.error(this.name + ': fallo al aplicar la plantilla "' + plantilla.id + '".', e);
        return '<p class="g-information-error">No se pudo aplicar la plantilla ' +
          escaparHtml(plantilla.nombre || plantilla.id) + '.</p>';
      }
    }

    /**
     * Cambia el formato de una capa WMS. Si el formato aún no se ha pedido,
     * se solicita y se actualiza solo esa pestaña, sin cerrar el popup ni
     * perder la pestaña activa.
     */
    _cambiarFormato(resultado, formatoId) {
      var formato = (resultado.formatos || []).find(function (f) { return f.id === formatoId; });
      if (!formato) return;

      var estadoPrevio = resultado.porFormato[formatoId];
      if (resultado.formatoActual === formatoId && estadoPrevio
        && estadoPrevio.estado === 'ok') {
        return;
      }

      var pref = this._preferencias[resultado.clave] || {};
      this._preferencias[resultado.clave] = {
        formato: formatoId,
        plantilla: pref.plantilla || null,
      };

      resultado.formatoActual = formatoId;
      if (estadoPrevio && estadoPrevio.estado === 'ok') {
        this._actualizarTab(resultado);
        return;
      }

      resultado.porFormato[formatoId] = { estado: 'cargando' };
      this._actualizarTab(resultado);

      var self = this;
      var generacion = this._generacion;
      var punto = resultado.punto;
      var caps = resultado.caps;
      var mpp = resultado.mpp;

      this._pedirFeatureInfo(resultado.capa, punto, formato, caps, mpp)
        .then(function (datos) {
          if (generacion !== self._generacion || self._resultados.indexOf(resultado) === -1) return;
          resultado.porFormato[formatoId] = Object.assign({ estado: 'ok' }, datos);
          resultado.formatoActual = formatoId;
          resultado.error = null;
          self._actualizarTab(resultado);
        })
        .catch(function (err) {
          if (generacion !== self._generacion || self._resultados.indexOf(resultado) === -1) return;
          resultado.porFormato[formatoId] = {
            estado: 'error',
            error: self._mensajeError(err),
          };
          self._actualizarTab(resultado);
        });
    }

    _cambiarPlantilla(resultado, plantillaId) {
      if (!this._plantillas.some(function (p) { return p.id === plantillaId; })) return;
      var pref = this._preferencias[resultado.clave] || {};
      this._preferencias[resultado.clave] = {
        formato: pref.formato || resultado.formatoActual || null,
        plantilla: plantillaId,
      };
      this._actualizarTab(resultado);
    }

    /** Repinta una pestaña concreta sin reconstruir todo el popup. */
    _actualizarTab(resultado) {
      if (!this._popup) return;
      var indice = this._resultados.indexOf(resultado);
      if (indice === -1) return;

      var tabs = null;
      try { tabs = this._popup.getTabs(); } catch (e) { tabs = null; }
      if (!tabs || !tabs[indice]) return;

      var html = this._htmlTab(resultado);
      var listeners = this._listenersTab(resultado);
      tabs[indice].content = html;
      tabs[indice].listeners = listeners;

      // Solo se toca el DOM si la pestaña actualizada es la que se está
      // viendo. Las demás se repintarán al cambiar de pestaña.
      if (this._indiceTabActivo() !== indice) return;
      try {
        var cont = this._popup.getContent();
        if (!cont) return;
        cont.innerHTML = html;
        this._popup.addEventTabs(tabs[indice], cont);
      } catch (e) {
        console.warn(this.name + ': no se pudo repintar la pestaña.', e);
      }
    }

    _mensajeError(error) {
      if (!error) return 'No se pudo obtener la información.';
      if (typeof error === 'string') return error;
      if (error.message) return error.message;
      try {
        return String(error);
      } catch (e) {
        return 'No se pudo obtener la información.';
      }
    }

    // ===================================================================
    //  Restauración tras el cambio 2D/3D
    // ===================================================================

    _pixelDesdePunto(punto) {
      var impl = this._getImpl();
      if (!impl || !punto) return null;
      if (this._esCesium()) {
        try {
          var cartesiano = global.Cesium.Cartesian3.fromDegrees(
            punto.lon, punto.lat, punto.altura || 0
          );
          return impl.scene.cartesianToCanvasCoordinates(cartesiano);
        } catch (e) {
          return null;
        }
      }
      try {
        var xy = this._reproyectar([punto.lon, punto.lat], 'EPSG:4326', 'EPSG:3857');
        if (!xy) return null;
        var proyeccion = impl.getView().getProjection().getCode();
        var coord = (proyeccion === 'EPSG:3857')
          ? xy
          : this._reproyectar(xy, 'EPSG:3857', proyeccion);
        if (!coord) return null;
        return impl.getPixelFromCoordinate(coord);
      } catch (e) {
        return null;
      }
    }

    _coordPopupDesdeLonLat(punto) {
      if (this._esCesium()) {
        return [punto.lon, punto.lat, punto.altura || 0];
      }
      var impl = this._getImpl();
      if (!impl) return null;
      try {
        var xy = this._reproyectar([punto.lon, punto.lat], 'EPSG:4326', 'EPSG:3857');
        if (!xy) return null;
        var proyeccion = impl.getView().getProjection().getCode();
        if (proyeccion === 'EPSG:3857') return [xy[0], xy[1]];
        return this._reproyectar(xy, 'EPSG:3857', proyeccion);
      } catch (e) {
        return null;
      }
    }

    _reabrirCuandoListo(punto, intentos) {
      var self = this;
      setTimeout(function () {
        if (!self._activo || !self._map) return;
        var impl = self._getImpl();
        var coord = self._coordPopupDesdeLonLat(punto);
        if (!impl || !coord) {
          if (intentos > 0) self._reabrirCuandoListo(punto, intentos - 1);
          return;
        }
        var xy = self._reproyectar([punto.lon, punto.lat], 'EPSG:4326', 'EPSG:3857');
        if (!xy) {
          if (intentos > 0) self._reabrirCuandoListo(punto, intentos - 1);
          return;
        }
        var pixel = self._pixelDesdePunto(punto);
        self._consultarEnPunto({
          x: xy[0],
          y: xy[1],
          lon: punto.lon,
          lat: punto.lat,
          altura: punto.altura || 0,
        }, coord, pixel, null, true);
      }, 650);
    }

    // ===================================================================
    //  Plantillas: construcción y resolución
    // ===================================================================

    _construirPlantillas(extra) {
      var base = PLANTILLAS_POR_DEFECTO.map(function (plantilla) {
        return {
          id: plantilla.id,
          nombre: plantilla.nombre,
          descripcion: plantilla.descripcion,
          render: plantilla.render,
        };
      });

      var anadir = function (plantilla) {
        if (!plantilla || !plantilla.id || !esFuncion(plantilla.render)) return;
        var normalizada = {
          id: String(plantilla.id),
          nombre: plantilla.nombre || String(plantilla.id),
          descripcion: plantilla.descripcion || '',
          render: plantilla.render,
        };
        var indice = base.findIndex(function (p) { return p.id === normalizada.id; });
        if (indice >= 0) base[indice] = normalizada;
        else base.push(normalizada);
      };

      if (Array.isArray(extra)) {
        extra.forEach(anadir);
      } else if (extra && typeof extra === 'object') {
        Object.keys(extra).forEach(function (id) {
          var plantilla = extra[id];
          if (esFuncion(plantilla)) {
            anadir({ id: id, nombre: id, render: plantilla });
          } else if (plantilla && typeof plantilla === 'object') {
            anadir(Object.assign({ id: id }, plantilla));
          }
        });
      }

      return base;
    }

    _resolverPlantillaPorDefecto(id) {
      if (id && this._plantillas.some(function (p) { return p.id === id; })) return id;
      return this._plantillas.length ? this._plantillas[0].id : 'ficha';
    }
  }

  // ---------------------------------------------------------------------
  // Exposición triple: window, window.IDEE.plugin y window.M.plugin
  // ---------------------------------------------------------------------
  miPlugin_information.VERSION = VERSION;
  miPlugin_information.plantillasPorDefecto = PLANTILLAS_POR_DEFECTO;

  global.miPlugin_information = miPlugin_information;

  if (global.IDEE && global.IDEE.plugin) {
    global.IDEE.plugin.miPlugin_information = miPlugin_information;
  }
  if (global.M && global.M.plugin) {
    global.M.plugin.miPlugin_information = miPlugin_information;
  }
})(window);
