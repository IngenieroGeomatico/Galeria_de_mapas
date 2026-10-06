/* =====================================================================
   PLANTILLA DE PLUGIN ESTÁNDAR PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   DESCRIPCIÓN:
   Esta plantilla proporciona la estructura base recomendada para crear
   nuevos plugins en el directorio ext/ del repositorio Galeria_de_mapas.
   Está escrita en JavaScript vanilla (ES6), autocontenida en una IIFE
   con "use strict", y no depende de frameworks externos.

   PATRONES CONSOLIDADOS QUE INCORPORA:
   1. Resolución dual de la API (window.IDEE || window.M) mediante helper api().
   2. Clase ES6 con constructor configurable y valores por defecto defensivos.
   3. Integración estándar con paneles de la API: IDEE.ui.Panel e IDEE.Control.
   4. Soporte para reordenación del botón en la barra de herramientas (opción `order`).
   5. Sistema de colores configurables mediante resolveColor() y variables CSS.
   6. Ayuda integrada con el gestor de ayuda de la API (getHelp con Promise y stringToHtml).
   7. Contrato de estado (getState / setState) para conservar la UI tras alternar
      entre OpenLayers (2D) y Cesium (3D) con el plugin cambioImpl.
   8. Helpers recursivos de búsqueda de capas (_findLayerByIdInMap y _findLayerByLegendInMap)
      para manejar identificadores estables (legend/name) frente a idLayer temporales.
   9. Método destroy() para limpieza de recursos y ciclo de vida limpio.
   10. Exposición triple en window, window.IDEE.plugin y window.M.plugin para
       sobrevivir a la recarga del bundle de la API durante el swap 2D/3D.
    11. Icono del botón configurable con el parámetro `icon`: se acepta el SVG
        completo, solo su contenido interior, o una URL. Si no se pasa nada, se
        queda el icono por defecto de la hoja de estilos (una rueda dentada).

   PARÁMETROS DE CONSTRUCCIÓN IMPORTANTES (todos en el constructor):
     - position : esquina donde se cuelga el panel ('TL', 'TR', 'BL', 'BR').
     - order    : posición del panel DENTRO de esa esquina. Es un valor CSS
                  `order` sobre el panel dentro del área `.m-area` (flex column),
                  NO un índice. Los paneles sin `order` valen 0, así que:
                  order:-1 => por delante de todos; order:0 => primera posición
                  (empatada con los que no lo llevan); order:2 => detrás de los
                  de 0; order:99 => al final; null => sin valor explícito.
     - collapsible : si el panel se pliega a botón o se deja abierto.
     - color1   : color de fondo del botón ({ active, deactive } o string).
     - color2   : color de borde ({ active, deactive } o string).
     - color3   : color de icono/texto ({ active, deactive } o string).
     - icon     : icono del botón. Acepta el `<svg ...>...</svg>` entero, solo
                   el contenido de dentro (`<path/>`, `<circle/>`, ...), o una
                   URL (`data:`, `http`, o una ruta del repositorio). Sin este
                   parámetro se usa el icono por defecto de plantilla_plugin.css.
                   Alias admitidos: `icono` y `svg`.
                   Ejemplo (icono sacado de https://www.svgrepo.com/):
                     new miPlugin_x({
                       icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="..."/></svg>',
                     })

     Estos (position, order, collapsible, color1, color2, color3, icon) son el
     mínimo que debe aceptar cualquier plugin con panel: son los que usa quien
     instancia el mapa para situar y pintar la herramienta.

   CÓMO SE PINTA EL ICONO (y por qué así):
     El icono va como MÁSCARA (`mask-image`) sobre el pseudo-elemento
     `.m-tools:before`, y el color sale de `background-color`, que es
     `var(--g-plugin-icon-color)`. De ahí dos cosas:
       - El SVG puede traer los colores que quiera: en una máscara solo cuenta
         la parte opaca (el alfa), así que siempre se ve con el color del plugin.
       - No hay que tocar el DOM del botón, que es de la API, ni escribir un
         color en el CSS: el SVG se inyecta en la variable
         `--g-plugin-icon-mask`, que el CSS usa como valor por defecto.

   PASOS PARA CREAR UN PLUGIN NUEVO A PARTIR DE ESTA PLANTILLA:
   1. Copiar la carpeta completa:
      ext/plantilla_plugin/  ->  ext/<nombre_del_plugin>/
   2. Renombrar los ficheros:
      plantilla_plugin.js   ->  <nombre_del_plugin>.js
      plantilla_plugin.css  ->  <nombre_del_plugin>.css
   3. Sustituir el identificador "miPlugin_plantilla" y "plantilla" en:
      - Nombre de la clase: class miPlugin_<nombre>
      - Propiedad de identificación: this.name = 'miPlugin_<nombre>'
      - Id de panel y control en addTo: 'tools_<nombre>', 'control_<nombre>'
      - Clases CSS del panel: 'g-herramienta_<nombre>'
      - Exposición triple al final del fichero:
          window.miPlugin_<nombre> = ...
          window.IDEE.plugin.miPlugin_<nombre> = ...
          window.M.plugin.miPlugin_<nombre> = ...
      - Fichero CSS: renombrar selectores .g-herramienta_plantilla y prefijos.
   4. Diseñar la interfaz dentro de control.createView en addTo(map).
   5. Implementar el estado propio en getState() y setState(state, map).
   6. Cargar CSS y JS en mapas/<visualizador>/index.html (después de la API).
   7. Registrar en mapas/<visualizador>/js/mapa.js:
      mapajs.addPlugin(new IDEE.plugin.miPlugin_<nombre>({ ... }));
   ===================================================================== */

(function () {
  "use strict";

  /**
   * Resuelve el objeto global de la API cartográfica (IDEE en builds modernas
   * o M en builds históricas/compatibilidad).
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
   *
   * Acepta tres formas:
   *   - el `<svg ...>...</svg>` completo, tal cual;
   *   - solo el contenido de dentro (`<path/>`, `<circle/>`, `<g>...</g>`, ...),
   *     y entonces se envuelve con un `<svg>` de 24x24;
   *   - una URL o una ruta (`data:...`, `http...`, `/img/iconos/plane.svg`,
   *     `img/iconos/plane.svg`, `./icono.svg`), que se usa tal cual sin codificar.
   *     Las rutas relativas se resuelven contra la URL de la página que carga el
   *     mapa, no contra el CSS del plugin.
   * En una máscara solo cuenta el alfa del dibujo, así que el SVG puede traer
   * cualquier color: el color lo pone `--g-plugin-icon-color`.
   * @param {string} icono Icono en cualquiera de las tres formas.
   * @returns {string|null} `url("...")` listo para CSS, o null si no es válido.
   */
  function urlDeIcono(icono) {
    if (typeof icono !== 'string') return null;
    const limpio = icono.trim();
    if (!limpio) return null;

    // Es una URL o una ruta: se respeta tal cual (sin codificar el contenido).
    // Se admiten los esquemas (data, http, blob, file), las rutas que empiezan
    // por /, ./ o ../, y las que solo terminan en .svg (p. ej.
    // `img/iconos/plane.svg`), que es como se escriben de verdad.
    //
    // OJO: una ruta relativa se resuelve contra la URL de la PAGINA que carga el
    // mapa, no contra el CSS del plugin. Si el plugin vive en ext/miHerramienta/
    // y el visualizador en mapas/miVisor/, desde la página hay que subir hasta
    // la raíz del repositorio. Con /img/... o con una URL absoluta no hay lío.
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

  /**
   * Clase principal del plugin estándar.
   * TODO: Renombrar "miPlugin_plantilla" por el nombre de tu plugin (ej. "miPlugin_miHerramienta").
   */
  class miPlugin_plantilla {
    /**
     * Constructor del plugin.
     * @param {Object} [options={}] Opciones de configuración.
     * @param {string} [options.position='TL'] Posición del panel ('TL', 'TR', 'BL', 'BR').
     * @param {boolean} [options.collapsible=true] Si el panel puede plegarse/desplegarse.
     * @param {number} [options.order=null] Posición del panel dentro de la esquina
     * elegida (valor CSS `order` sobre el panel, dentro del área `.m-area`):
     * -1 => por delante de todos, 0 => primera posición, 2 => detrás de los de
     * 0, 99 => al final, null => sin valor explícito.
     * @param {Object|string} [options.color1] Color de fondo del botón ({ active, deactive } o string).
     * @param {Object|string} [options.color2] Color de borde ({ active, deactive } o string).
     * @param {Object|string} [options.color3] Color de icono/texto ({ active, deactive } o string).
     * @param {string} [options.icon] Icono del botón. Admite el `<svg>...</svg>`
     * completo, solo el contenido de dentro (`<path/>`, `<circle/>`, ...) o una
     * URL o ruta (`data:`, `http`, `/img/iconos/plane.svg`, `./icono.svg`). Las
     * rutas relativas se resuelven contra la página que carga el mapa. Si no se
     * pasa nada, se usa el icono por defecto de la hoja de estilos.
     * Alias admitidos: `icono`, `svg`.
     */
    constructor(options = {}) {
      // Identificador obligatorio del plugin (usado por el gestor de plugins y cambioImpl)
      // TODO: Renombrar por el nombre de tu clase (ej. 'miPlugin_miHerramienta')
      this.name = 'miPlugin_plantilla';
      this.options = options || {};

      // Referencias al mapa y a los componentes de la interfaz
      this._map = null;
      this._panel = null;
      this._control = null;

      // Configuración de visualización y posición del panel
      this.position = options.position || 'TL';
      this.collapsible = (options.collapsible !== undefined) ? Boolean(options.collapsible) : true;

      // Posición del panel DENTRO de la esquina elegida (área `.m-area`, que la API
      // monta como flex column). Es un valor CSS `order`, no un índice: lo aplica
      // la propia API haciendo style.order sobre el panel (ver el addTo de más
      // abajo), así que no hay que reordenar el DOM a mano. Los paneles sin
      // `order` valen 0, así que:
      //   order: -1  => por delante de todos (los negativos van antes que el 0);
      //   order: 0   => primera posición, empatada con los que no llevan order;
      //   order: 2   => detrás de los que van en 0;
      //   order: 99  => al final de la esquina;
      //   null       => sin valor: el panel se queda donde lo deje la API.
      this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
        ? Number(options.order)
        : null;

      // Colores configurables para estados activo y desactivado
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

      // Icono del botón. Null significa "usa el de la hoja de estilos", que es lo
      // que se quiere: así el plugin nuevo trae ya un icono y solo hay que
      // cambiarlo si la herramienta tiene uno propio. Se aceptan `icon`, `icono`
      // y `svg` por alias, porque el mismo plugin se instancia desde mapas
      // distintos y cada uno escribe el nombre como le suena mejor.
      this.icon = options.icon || options.icono || options.svg || null;

      // TODO: Declarar aquí las variables de estado interno del plugin
      // Ejemplo: identificador de capa activa, filtros seleccionados, pestañas abiertas, etc.
      this._spanActivo = (options.spanActivo !== undefined) ? options.spanActivo : null;
      this._capaSeleccionadaId = null;
      this._capaSeleccionadaLegend = null;
    }

    /**
     * Normaliza un parámetro de color a la estructura { active, deactive }.
     * Permite admitir tanto strings simples ('#fff') como objetos ({ active: '#fff', deactive: '#000' }).
     * @param {Object|string} c Definición de color.
     * @returns {{active: string, deactive: string}} Objeto con colores para cada estado.
     */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /**
     * Proporciona la información de ayuda al gestor de ayuda de la API-IDEE.
     * @returns {{title: string, content: Promise<HTMLElement|string>}} Objeto con título y promesa HTML.
     */
    getHelp() {
      const IDEE = api();
      return {
        // TODO: Personalizar el título de la ayuda
        title: 'Plantilla de Plugin',
        content: new Promise((resolve) => {
          // TODO: Personalizar el contenido descriptivo de la ayuda
          let html = '<div><p>Descripción de la funcionalidad de la herramienta y guía de uso para el usuario.</p></div>';
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

    // =========================================================================
    // HELPERS DE BÚSQUEDA DE CAPAS (RESOLUCIÓN DEFENSIVA 2D / 3D)
    // =========================================================================
    // MOTIVACIÓN:
    // Al cambiar entre OpenLayers (2D) y Cesium (3D) con el plugin cambioImpl,
    // la función mapa() se vuelve a ejecutar desde cero. La API genera nuevos
    // idLayer con prefijos temporales (ej. WMS1711200000000nombre).
    // Por tanto, los idLayer NO son estables entre swaps. Los atributos 'legend'
    // o 'name' de las capas sí son estables y permiten reencontrar la capa.
    // =========================================================================

    /**
     * Busca una capa por su idLayer dentro del mapa, recorriendo de forma recursiva
     * los grupos de capas (LayerGroup) si existen.
     * @param {Object} mapRef Instancia del mapa (IDEE.Map / M.Map).
     * @param {string} id Identificador de capa idLayer a buscar.
     * @returns {Object|null} Instancia de la capa encontrada o null.
     */
    _findLayerByIdInMap(mapRef, id) {
      if (!mapRef || typeof mapRef.getLayers !== 'function' || id === null || id === undefined) {
        return null;
      }
      try {
        const isGroup = (l) => Boolean(
          l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function')
        );
        const allLayers = mapRef.getLayers() || [];
        const stack = [];
        for (const l of allLayers) {
          if (l && String(l.idLayer) === String(id)) return l;
          if (isGroup(l)) stack.push(l);
        }
        while (stack.length > 0) {
          const g = stack.pop();
          let hijos = [];
          try {
            hijos = (typeof g.getLayers === 'function') ? g.getLayers() : [];
          } catch (e) {
            hijos = [];
          }
          for (const h of hijos) {
            if (h && String(h.idLayer) === String(id)) return h;
            if (isGroup(h)) stack.push(h);
          }
        }
      } catch (e) {
        /* Silencioso: sin coincidencia */
      }
      return null;
    }

    /**
     * Busca una capa por su identificador estable (legend o name) dentro del mapa,
     * recorriendo de forma recursiva los grupos de capas.
     * @param {Object} mapRef Instancia del mapa (IDEE.Map / M.Map).
     * @param {string} ident Identificador estable (legend o name) de la capa.
     * @returns {Object|null} Instancia de la capa encontrada o null.
     */
    _findLayerByLegendInMap(mapRef, ident) {
      if (!mapRef || typeof mapRef.getLayers !== 'function' || !ident) {
        return null;
      }
      try {
        const isGroup = (l) => Boolean(
          l && (l.type === 'LayerGroup' || l._type === 'LayerGroup' || typeof l.getLayers === 'function')
        );
        const coincide = (c) => Boolean(
          c && (
            (c.legend && String(c.legend) === String(ident)) ||
            (c.name && String(c.name) === String(ident))
          )
        );
        const allLayers = mapRef.getLayers() || [];
        const stack = [];
        for (const l of allLayers) {
          if (coincide(l)) return l;
          if (isGroup(l)) stack.push(l);
        }
        while (stack.length > 0) {
          const g = stack.pop();
          let hijos = [];
          try {
            hijos = (typeof g.getLayers === 'function') ? g.getLayers() : [];
          } catch (e) {
            hijos = [];
          }
          for (const h of hijos) {
            if (coincide(h)) return h;
            if (isGroup(h)) stack.push(h);
          }
        }
      } catch (e) {
        /* Silencioso: sin coincidencia */
      }
      return null;
    }

    // =========================================================================
    // CONTRATO DE ESTADO (CAMBIO DE IMPLEMENTACIÓN 2D / 3D)
    // =========================================================================
    // Invocado por window.EstadoPlugins (coordinador en cambioImpl.js) antes
    // y después del reinicio del mapa al alternar entre OpenLayers y Cesium.
    // =========================================================================

    /**
     * Captura el estado serializable actual de la interfaz del plugin.
     * Debe devolver únicamente datos primitivos u objetos serializables en JSON.
     * @returns {Object} Estado mínimo necesario para reconstruir la UI.
     */
    getState() {
      // Capturamos el identificador estable (legend/name) si hay una capa seleccionada
      let capaLegend = this._capaSeleccionadaLegend;
      if (!capaLegend && this._capaSeleccionadaId && this._map) {
        const capa = this._findLayerByIdInMap(this._map, this._capaSeleccionadaId);
        if (capa) {
          capaLegend = (capa.legend && String(capa.legend) !== String(capa.idLayer))
            ? capa.legend
            : (capa.name || null);
        }
      }

      // Estado abierto/colapsado del panel (se conserva en el swap 2D/3D).
      // Patrón estándar: leer _collapsed del panel, con fallback a la clase
      // CSS 'collapsed' del elemento DOM (según versión de API-IDEE).
      let panelCollapsed = true;
      if (this._panel) {
        if (this._panel._collapsed !== undefined) {
          panelCollapsed = !!this._panel._collapsed;
        } else if (typeof this._panel.getElement === 'function') {
          const panelEl = this._panel.getElement();
          panelCollapsed = panelEl ? panelEl.classList.contains('collapsed') : true;
        }
      }

      // TODO: Adaptar las propiedades devueltas según el estado real de tu plugin
      return {
        spanActivo: this._spanActivo,
        capaSeleccionadaId: this._capaSeleccionadaId,
        capaSeleccionadaLegend: capaLegend,
        panelCollapsed,
      };
    }

    /**
     * Restaura el estado de la UI en la nueva instancia tras el reinicio del mapa.
     * Aplica guardas defensivas para no propagar datos corruptos o capas inexistentes.
     * @param {Object} state Estado previamente capturado con getState().
     * @param {Object} [map] Nueva instancia del mapa creada tras el cambio.
     */
    setState(state, map) {
      if (!state || typeof state !== 'object') return;
      const mapRef = map || this._map;

      // Restauración del estado del panel (abierto/colapsado) tras el reinicio.
      // Patrón estándar: collapse() / open() con guarda defensiva.
      if (typeof state.panelCollapsed === 'boolean' && this._panel) {
        try {
          if (state.panelCollapsed && typeof this._panel.collapse === 'function') {
            this._panel.collapse();
          } else if (!state.panelCollapsed && typeof this._panel.open === 'function') {
            this._panel.open();
          }
        } catch (e) {
          console.warn(`${this.name}: Error al restaurar el estado del panel:`, e);
        }
      }

      // Restauración de propiedades simples con validación de tipo
      if (state.spanActivo !== undefined) {
        this._spanActivo = state.spanActivo;
      }

      // Re-resolución defensiva de capas: primero por idLayer, fallback por legend/name
      let idResuelto = null;
      if (state.capaSeleccionadaId && this._findLayerByIdInMap(mapRef, state.capaSeleccionadaId)) {
        idResuelto = state.capaSeleccionadaId;
      } else if (state.capaSeleccionadaLegend) {
        const capa = this._findLayerByLegendInMap(mapRef, state.capaSeleccionadaLegend);
        if (capa) {
          idResuelto = capa.idLayer;
        }
      }

      this._capaSeleccionadaId = idResuelto;
      this._capaSeleccionadaLegend = state.capaSeleccionadaLegend || null;

      // TODO: Si tu plugin tiene un método de refresco visual, invócalo aquí:
      // if (typeof this._renderUI === 'function') {
      //   try { this._renderUI(); } catch (e) { console.warn(e); }
      // }
    }

    // =========================================================================
    // CICLO DE VIDA: MONTAJE EN EL MAPA
    // =========================================================================

    /**
     * Método invocado automáticamente por mapajs.addPlugin(pluginInstancia).
     * Construye el panel, el control, monta la UI y aplica estilos y ordenación.
     * @param {Object} map Instancia del mapa (IDEE.Map / M.Map).
     */
    /**
     * Pinta el icono del botón de la herramienta.
     *
     * Se inyecta como variable CSS (`--g-plugin-icon-mask`) en vez de tocar el
     * DOM del botón, que es de la API. La hoja de estilos la usa como valor por
     * defecto, así que si este método no llega a pintarla se queda el icono de
     * serie de la plantilla, que es justo el plan B.
     * @param {HTMLElement} panelEl Elemento del panel donde se escribe la variable.
     */
    _aplicarIcono(panelEl) {
      if (!panelEl || !panelEl.style) return;
      if (!this.icon) return;
      const url = urlDeIcono(this.icon);
      if (!url) {
        console.warn(`${this.name}: el icono no parece un SVG ni una URL, se deja el de por defecto.`);
        return;
      }
      try {
        panelEl.style.setProperty('--g-plugin-icon-mask', url);
      } catch (e) {
        console.warn(`${this.name}: no se pudo aplicar el icono.`, e);
      }
    }

    addTo(map) {
      this._map = map;
      const IDEE = api();

      if (!IDEE || !IDEE.ui || !IDEE.Control) {
        console.error(`${this.name}: No se encontró el objeto global de la API (IDEE/M).`);
        return;
      }

      // Resolver posición del panel (ej. IDEE.ui.position.TL)
      const pos = (IDEE.ui.position && IDEE.ui.position[this.position])
        ? IDEE.ui.position[this.position]
        : (IDEE.ui.position ? IDEE.ui.position.TL : 'TL');

      // 1. Crear el Panel contenedor en la interfaz
      // TODO: Personalizar el identificador y clases del panel
      const panel = new IDEE.ui.Panel('tools_plantilla', {
        collapsible: this.collapsible,
        className: 'g-herramienta_plantilla',
        collapsedButtonClass: 'm-tools',
        position: pos,
        // `order` lo aplica la propia API: IDEE.ui.Panel hace style.order sobre
        // el panel, dentro del area (un flex column). NO hay que reordenar el
        // DOM a mano. Ojo: es un valor CSS `order`, no un índice; los paneles
        // sin `order` valen 0 y se quedan por delante.
        order: this.order,
      });
      this._panel = panel;

      // 2. Crear el Control que alojará la vista del plugin
      // TODO: Personalizar el nombre del control
      const control = new IDEE.Control(new IDEE.impl.Control(), 'controlPlantilla');
      this._control = control;

      // OBLIGATORIO para que destroy() funcione: la API usa equals() para
      // distinguir controles al retirarlos del panel y del mapa. Sin este
      // método, destroy() -> map.removeControls() lanza "e.equals is not a
      // function" y el panel se queda colgado en el mapa aunque removePlugins()
      // devuelva sin error (el error lo traga su propio try/catch).
      //
      // Que sea ESTRICTO no es un detalle de estilo: la API lo llama en DOS
      // direcciones distintas, y solo una es evidente.
      //   - IDEE.ui.Panel.removeControls: controlQuitado.equals(controlDelPanel)
      //     Solo afecta a los controles de ESE panel.
      //   - impl.removeControls:           controlDelMapa.equals(controlQuitado)
      //     Recorre TODOS los controles del mapa, con el orden de argumentos
      //     invertido, para decidir cuáles conservar.
      // Esa segunda es la que obliga a la identidad: un equals laxo del estilo
      // "other instanceof IDEE.Control" da true ante cualquier control, así que
      // basta con que un control con equals laxo esté en el mapa para que el
      // primer removePlugins() desregistre los controles de todos los demás
      // plugins. Con equals estricto no se pierde nada, porque en las dos
      // llamadas el argumento es siempre el mismo objeto que ya está en la
      // lista que se está recorriendo.
      control.equals = function (other) {
        return other === this;
      };

      // 3. Definir la creación de la vista HTML (DOM)
      control.createView = () => {
        // Contenedor principal con semántica accesible y clases estándar de la API
        const container = document.createElement('div');
        container.setAttribute('aria-label', 'Plantilla de herramienta');
        container.setAttribute('role', 'region');
        container.className = 'm-control m-container m-herramienta plantilla-container';

        // Estructura interna básica con cabecera y sección de contenido
        container.innerHTML = `
          <header role="heading" aria-level="3" tabindex="0" class="m-herramienta-header plantilla-header">
            <span>Plantilla de Plugin</span>
          </header>
          <div class="m-herramienta-contents plantilla-body">
            <!-- ======================================================= -->
            <!-- AQUÍ VA LA UI DEL PLUGIN                                 -->
            <!-- ======================================================= -->
            <p class="plantilla-descripcion">
              Panel base de la herramienta. Personaliza este contenido en control.createView.
            </p>
            <div class="plantilla-acciones">
              <button type="button" class="plantilla-btn plantilla-btn-ejemplo">
                Acción de ejemplo
              </button>
            </div>
            <!-- ======================================================= -->
          </div>
        `;

        // Eventos y listeners de la interfaz
        const btnEjemplo = container.querySelector('.plantilla-btn-ejemplo');
        if (btnEjemplo) {
          btnEjemplo.addEventListener('click', () => {
            // TODO: Lógica de interacción de la UI
            if (this._spanActivo) {
              this._spanActivo = null;
            } else {
              this._spanActivo = 'activo';
            }
          });
        }

        return container;
      };

      // 4. Añadir control al panel y panel al mapa
      panel.addControls(control);
      map.addPanels(panel);

      // 5. El botón ya está colocado dentro del área por el `order` que se le
      // pasó al Panel en el paso 1. No hace falta reordenar el DOM.

      // 6. Aplicar variables CSS de colores configurables al panel
      try {
        const c1 = this.resolveColor(this.color1);
        const c2 = this.resolveColor(this.color2);
        const c3 = this.resolveColor(this.color3);
        const panelEl = (typeof panel.getElement === 'function')
          ? panel.getElement()
          : document.querySelector('.m-panel.g-herramienta_plantilla');

        if (panelEl && panelEl.style) {
          panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
          panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
          panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
          panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
          panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
          panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);

          // Y el icono, si lo han pasado en el constructor.
          this._aplicarIcono(panelEl);
        }
      } catch (e) {
        /* Ignorar si no está disponible el elemento en el DOM */
      }

      // 7. Activación defensiva del control
      try {
        if (control && typeof control.activate === 'function') {
          control.activate();
        }
      } catch (e) {
        console.warn(`${this.name}: No se pudo activar el control defensivamente`, e);
      }
    }

    /**
     * Desmonta el plugin y limpia referencias y oyentes de eventos.
     *
     * map.removePlugins([plugin]) de la API la exige: sin este método lanza
     * "t.destroy is not a function" y ABORTA el resto del lote de plugins que
     * se estiverem quitando. La API solo llama a destroy() y borra el plugin
     * de su lista: el panel y el control los tiene que soltar este método.
     *
     * Receta: map.removeControls([control]) -> IDEE.ui.Panel.removeControls()
     * descuelga el control del panel y, si era el último, hace removePanel().
     * Por eso el control necesita su método equals() (ver addTo). Ojo: llamar
     * solo a panel.close() NO desmonta nada, únicamente lo colapsa.
     */
    destroy() {
      // TODO: Desuscribir listeners de eventos del mapa (map.off(...)) si se registraron
      try {
        if (this._map && this._control && typeof this._map.removeControls === 'function') {
          this._map.removeControls([this._control]);
        }
      } catch (e) {
        /* El mapa o el control pueden estar ya destruidos */
      }
      this._panel = null;
      this._control = null;
      this._map = null;
    }
  }

  // =========================================================================
  // EXPOSICIÓN TRIPLE GLOBAL DEL PLUGIN
  // =========================================================================
  // POR QUÉ ES OBLIGATORIA LA EXPOSICIÓN TRIPLE:
  // Al alternar entre OpenLayers (2D) y Cesium (3D) con cambioImpl, la API
  // recarga dinámicamente su bundle JavaScript. Este proceso reinicializa
  // window.IDEE.plugin y window.M.plugin borrando cualquier registro previo.
  // Al exponer la clase también directamente en window (window.miPlugin_*),
  // la definición persiste intacta en el contexto global y permite
  // re-instanciar el plugin sin tener que volver a cargar el fichero .js.
  // =========================================================================
  if (typeof window !== 'undefined') {
    // 1. Ámbito global directo (permanece tras recarga de bundle en cambioImpl)
    window.miPlugin_plantilla = miPlugin_plantilla;

    // 2. Registro en espacio de nombres IDEE (convención moderna de la API)
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_plantilla = miPlugin_plantilla;

    // 3. Registro en espacio de nombres M (alias de compatibilidad API-CNIG)
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_plantilla = miPlugin_plantilla;
  }
})();
