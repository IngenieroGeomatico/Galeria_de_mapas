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
   * Clase principal del plugin estándar.
   * TODO: Renombrar "miPlugin_plantilla" por el nombre de tu plugin (ej. "miPlugin_miHerramienta").
   */
  class miPlugin_plantilla {
    /**
     * Constructor del plugin.
     * @param {Object} [options={}] Opciones de configuración.
     * @param {string} [options.position='TL'] Posición del panel ('TL', 'TR', 'BL', 'BR').
     * @param {boolean} [options.collapsible=true] Si el panel puede plegarse/desplegarse.
     * @param {number} [options.order=null] Posición ordinal (0-based) del botón en el área m-area.
     * @param {Object|string} [options.color1] Color de fondo del botón ({ active, deactive } o string).
     * @param {Object|string} [options.color2] Color de borde ({ active, deactive } o string).
     * @param {Object|string} [options.color3] Color de icono/texto ({ active, deactive } o string).
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

      // Posición (índice 0-based) del botón dentro del área de herramientas (m-area).
      // Si se define un número, se reordena en el DOM tras addPanels. Si es null,
      // queda en el orden natural en que se ejecutó addPanels / addPlugin.
      this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
        ? Number(options.order)
        : null;

      // Colores configurables para estados activo y desactivado
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

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
      });
      this._panel = panel;

      // 2. Crear el Control que alojará la vista del plugin
      // TODO: Personalizar el nombre del control
      const control = new IDEE.Control(new IDEE.impl.Control(), 'controlPlantilla');
      this._control = control;

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

      // 5. Posicionar el botón del plugin (opción `order`) en la barra de herramientas
      // Reordena el panel dentro del div de botones (el contenedor .m-area de Mapea/API-IDEE).
      if (this.order !== null && !Number.isNaN(this.order)) {
        try {
          const panelEl = (typeof panel.getElement === 'function')
            ? panel.getElement()
            : document.querySelector('.m-panel.g-herramienta_plantilla');

          if (panelEl && panelEl.parentElement) {
            const area = Array.from(panelEl.parentElement.children).some((el) => el === panelEl)
              ? panelEl.parentElement
              : panelEl.closest('.m-area');

            if (area) {
              const siblings = Array.from(area.children).filter((el) =>
                el.classList && el.classList.contains('m-panel')
              );
              if (siblings.length > 1) {
                const target = Math.max(0, Math.min(this.order, siblings.length - 1));
                const current = siblings.indexOf(panelEl);
                if (current !== -1 && current !== target) {
                  const ref = (target >= siblings.length) ? null : siblings[target];
                  if (ref && ref !== panelEl) {
                    if (target > current) {
                      const next = siblings[target + 1] || null;
                      area.insertBefore(panelEl, next);
                    } else {
                      area.insertBefore(panelEl, ref);
                    }
                  } else if (ref === null) {
                    area.appendChild(panelEl);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`${this.name}: No se pudo aplicar el orden en la barra de herramientas`, e);
        }
      }

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
     */
    destroy() {
      // TODO: Desuscribir listeners de eventos del mapa (map.un(...)) si se registraron
      if (this._panel && typeof this._panel.close === 'function') {
        try {
          this._panel.close();
        } catch (e) {
          /* Fallback silencioso */
        }
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
