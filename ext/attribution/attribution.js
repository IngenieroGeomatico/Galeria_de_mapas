// Plugin de Atribución local para API-IDEE compatible con OpenLayers (2D) y Cesium (3D).
// Sigue el patrón "miPlugin_*" del repositorio: clase con constructor + getHelp + addTo.
//
// ¿Por qué una versión local del plugin de Atribución?
// El control nativo de atribución de la API-IDEE solo existe en 2D (OpenLayers), no en Cesium (3D),
// y visualmente muestra un banner con título "Attributions" en inglés y estilos poco integrados.
// Este plugin unifica la experiencia en 2D y 3D, recopilando tanto atribuciones estáticas
// configuradas a nivel de visualizador como atribuciones asociadas a las capas cargadas en el mapa.

/**
 * Resuelve el objeto global de la API activa (IDEE o M) comprobando que
 * disponga de las propiedades funcionales necesarias (.ui y .map).
 * @returns {Object} Objeto API-IDEE / API-Core activo
 */
function api_attribution() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

/**
 * Clase principal del plugin local de Atribución.
 */
class miPlugin_attribution {
  /**
   * Constructor del plugin de atribución.
   * @param {Object} options Configuración del panel de atribución
   * @param {string} [options.position='BR'] Posición del panel ('TL','TR','BL','BR')
   * @param {string} [options.mode='full'] Modo de presentación:
   *   - 'full': panel colapsable de la API-IDEE con cabecera arrastrable (por defecto)
   *   - 'lite': botón estándar m-tools en el rail (como el resto de plugins) cuya
   *     barra de atribuciones se abre a lo largo de la base del visualizador
   *     (el contenido es el mismo en ambos modos)
   * @param {boolean} [options.collapsed=true] Estado inicial colapsado
   * @param {boolean} [options.collapsible=true] Permite colapsar el panel
   * @param {string} [options.tooltip='Atribución y créditos'] Tooltip del botón
   * @param {number} [options.order] Posición/orden dentro del área de botones
   * @param {Array<Object|string>} [options.attributions=[]] Atribuciones estáticas a nivel de mapa
   */
  constructor(options = {}) {
    this.name = 'miPlugin_attribution';
    this.options = options || {};

    this.position_ = options.position || 'BR';
    this.mode_ = (options.mode === 'lite') ? 'lite' : 'full';
    this.collapsed_ = (options.collapsed !== undefined) ? options.collapsed : true;
    this.collapsible_ = (options.collapsible !== undefined) ? options.collapsible : true;
    this.tooltip_ = options.tooltip || 'Atribución y créditos';
    this.order = (options.order !== undefined && options.order >= -1) ? options.order : null;
    this.attributions_ = options.attributions || [];

    // Colores configurables (color1=fondo, color2=borde, color3=icono).
    // Defaults idénticos al resto de plugins del visualizador (vuelo, capas).
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

    this.container_ = null;
    this._boundEvents = [];
    this._onLayerChange = null;

    this.controls_ = [];
    this.control_ = null;
    this.control = null;
    this.panel_ = null;
    this.panel = null;
    this.map_ = null;
    this.map = null;
  }

  /**
   * Proporciona la ayuda para el gestor de ayuda de la API-IDEE.
   * @returns {Object} Objeto con título y promesa de contenido
   */
  getHelp() {
    const IDEE = api_attribution();
    return {
      title: 'Atribución',
      content: new Promise((resolve) => {
        let html = '<div><p>Muestra las atribuciones y créditos del visualizador y sus fuentes de datos.</p></div>';
        if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
          html = IDEE.utils.stringToHtml(html);
        }
        resolve(html);
      }),
    };
  }

  /**
   * Genera el HTML de las atribuciones recopilando las estáticas del plugin
   * y las dinámicas asociadas a las capas del mapa.
   * @param {Object} [mapInstance] Instancia del mapa
   * @returns {string} HTML generado
   */
  buildAttributionsHTML(mapInstance) {
    const mapToUse = mapInstance || this.map_;
    const rawEntries = [];

    // a) Atribuciones estáticas configuradas en el plugin
    if (Array.isArray(this.attributions_)) {
      this.attributions_.forEach((attr) => {
        if (!attr) return;
        if (typeof attr === 'string') {
          rawEntries.push({ name: '', description: attr });
        } else if (typeof attr === 'object') {
          rawEntries.push({
            name: attr.name || '',
            description: attr.description || ''
          });
        }
      });
    }

    // b) Atribuciones de las capas del mapa
    try {
      if (mapToUse && typeof mapToUse.getLayers === 'function') {
        const layers = mapToUse.getLayers() || [];
        layers.forEach((t) => {
          if (!t || !t.attribution) return;
          const e = t.attribution;
          if (typeof e === 'string') {
            rawEntries.push({ name: '', description: e });
          } else if (typeof e === 'object') {
            rawEntries.push({
              name: e.name || t.name || '',
              description: e.description || ''
            });
          }
        });
      }
    } catch (err) {
      console.warn('miPlugin_attribution: error al recopilar atribuciones de capas', err);
    }

    // c) Deduplicar entradas por name + description y normalizar color inline
    const seen = new Set();
    const uniqueEntries = [];
    rawEntries.forEach((entry) => {
      let name = (entry.name || '').trim();
      let desc = (entry.description || '').replace(/color:\s*#0000FF/gi, 'color: inherit').trim();
      if (/^<p\b[^>]*>([\s\S]*?)<\/p>$/i.test(desc)) {
        desc = desc.replace(/^<p\b[^>]*>/i, '').replace(/<\/p>$/i, '').trim();
      }
      if (!name && !desc) return;
      const key = JSON.stringify({ name: name, description: desc });
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEntries.push({ name: name, description: desc });
      }
    });

    // d) Construcción del HTML (el título "Crédito" vive en la cabecera del panel)
    let html = '';
    if (uniqueEntries.length === 0) {
      html += '<p class="m-attribution-empty">Sin atribuciones.</p>';
    } else {
      uniqueEntries.forEach((entry) => {
        let row = '<p>';
        if (entry.name) {
          row += '<span class="m-attribution-name">' + entry.name + '</span> ';
        }
        if (entry.description) {
          row += '<span class="m-attribution-desc">' + entry.description + '</span>';
        }
        row += '</p>';
        html += row;
      });
    }

    return html;
  }

  /**
   * Actualiza el contenido del panel de atribución si ya está montado en el DOM.
   * @param {Object} [mapInstance] Instancia del mapa
   */
  refresh(mapInstance) {
    if (this.container_) {
      this.container_.innerHTML = this.buildAttributionsHTML(mapInstance || this.map_);
    }
  }

  /**
   * Devuelve {active, deactive} a partir de un color simple o un objeto.
   * @param {Object|string} c Color (objeto {active,deactive} o string)
   * @returns {Object} {active, deactive}
   */
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
  }

  /**
   * Método de enganche al mapa invocado por mapajs.addPlugin().
   * @param {Object} map Instancia del mapa (IDEE.Map / M.Map)
   */
  addTo(map) {
    const IDEE = api_attribution();
    this.map_ = map;
    this.map = map;

    if (this.mode_ === 'lite') {
      this._setupLiteMode(map, IDEE);
    } else {
      this._setupFullMode(map, IDEE);
    }
  }

  /**
   * Modo 'full' (por defecto): panel colapsable de la API-IDEE con cabecera
   * arrastrable, igual que el resto de plugins del visualizador.
   * @param {Object} map Instancia del mapa (IDEE.Map / M.Map)
   * @param {Object} IDEE API activa
   */
  _setupFullMode(map, IDEE) {
    const self = this;

    // Crear el control de atribución
    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlAttribution');

    // Sobrescribir createView: patrón del resto de plugins del visualizador.
    // Devuelve un div SIN clases (las clases m-control/m-container del framework
    // se posicionan con position:absolute y romperían el flujo del contenido,
    // dejando el panel abierto con altura 0).
    control.createView = function() {
      return document.createElement('div');
    };

    control.equals = function(other) {
      return other instanceof IDEE.Control || other === this;
    };

    // Crear el panel de atribución y asociar el control.
    // Patrón "g-herramienta" (igual que el resto de plugins del visualizador):
    // className g-herramienta_* + collapsedButtonClass m-tools + cabecera
    // #m-herramienta-title-* inyectada en .m-panel-controls para poder arrastrar el panel.
    const panel = new IDEE.ui.Panel('toolsExtra_attribution', {
      className: 'g-herramienta_attribution',
      collapsible: this.collapsible_,
      collapsed: this.collapsed_,
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position[this.position_],
      tooltip: this.tooltip_,
      order: this.order
    });

    panel.addControls([control]);
    map.addPanels(panel);

    // Aplicar colores configurables (color1=fondo, color2=borde, color3=icono)
    // inyectando las 6 variables CSS --g-plugin-* en el panel, igual que el
    // resto de plugins del visualizador (vuelo, selectorCapas).
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const panelEl = panel.getElement ? panel.getElement() : document.querySelector('.m-panel.g-herramienta_attribution');
    if (panelEl) {
      panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

    // HTML del panel con cabecera arrastrable (título "Crédito")
    const htmlPanel =
      '<div aria-label="Atribución y créditos" role="menuitem" ' +
      'id="div-contenedor-herramienta-attribution" class="m-control m-container m-herramienta">' +
      '<header role="heading" tabindex="0" id="m-herramienta-title-attribution" ' +
      'class="m-herramienta-header">Crédito</header>' +
      '<div id="m-herramienta-contents-attribution"></div>' +
      '</div>';

    const panelControls = document.querySelector('.g-herramienta_attribution .m-panel-controls');
    if (panelControls) {
      panelControls.innerHTML = htmlPanel;
    }
    const contentsAttribution = document.querySelector('#m-herramienta-contents-attribution');
    const controlElement = control.getElement();
    if (contentsAttribution && controlElement) {
      // El div del control (limpio, sin clases del framework) recibe la clase
      // de contenido y el HTML de atribuciones. Sin m-control/m-container el
      // framework no lo posiciona en absolute y el panel abre con altura real.
      controlElement.className = 'm-attribution';
      contentsAttribution.appendChild(controlElement);
      this.container_ = controlElement;
    }
    this.refresh(map);

    // Cerrar el panel con Escape (registro único a nivel global).
    // La apertura/cierre normal la gestiona el botón nativo m-panel-btn.
    if (!window.__miPluginAttributionEscapeBound) {
      window.__miPluginAttributionEscapeBound = true;
      document.addEventListener('keydown', function(evt) {
        if (evt.key === 'Escape' || evt.key === 'Esc') {
          const openedPanel = document.querySelector('.m-panel.g-herramienta_attribution.opened');
          if (openedPanel) {
            const closeBtn = openedPanel.querySelector('button.m-panel-btn');
            if (closeBtn) closeBtn.click();
          }
        }
      });
    }

    // Cabecera arrastrable (patrón del resto de plugins)
    if (IDEE.utils && typeof IDEE.utils.draggabillyPlugin === 'function') {
      try {
        IDEE.utils.draggabillyPlugin(panel, '#m-herramienta-title-attribution');
      } catch (err) {
        console.warn('miPlugin_attribution: no se pudo activar el arrastre del panel', err);
      }
    }

    this.controls_ = [control];
    this.control = control;
    this.control_ = control;
    this.panel = panel;
    this.panel_ = panel;
    this.map = map;
    this.map_ = map;

    this._bindLayerEvents(map, IDEE);
  }

  /**
   * Modo 'lite': botón estándar m-tools en el rail (como el resto de plugins
   * del visualizador) + barra de atribuciones que se abre a lo largo de la
   * base del visualizador (borde inferior), en lugar de un panel vertical.
   *
   * Se reutiliza el mecanismo de Panel de la API-IDEE para obtener el botón
   * estándar y su comportamiento de toggle (.opened); la caja del panel se
   * oculta por CSS y el contenido se pinta en una barra anclada al viewport.
   * @param {Object} map Instancia del mapa (IDEE.Map / M.Map)
   * @param {Object} IDEE API activa
   */
  _setupLiteMode(map, IDEE) {
    const self = this;

    // Botón/panel estándar: mismo patrón que el resto de plugins (m-tools).
    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlAttribution');
    control.createView = function() {
      return document.createElement('div');
    };
    control.equals = function(other) {
      return other instanceof IDEE.Control || other === this;
    };

    const panel = new IDEE.ui.Panel('toolsExtra_attribution', {
      className: 'g-herramienta_attribution m-attribution-lite',
      collapsible: this.collapsible_,
      collapsed: this.collapsed_,
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.BL,
      tooltip: this.tooltip_,
      order: this.order
    });
    panel.addControls([control]);
    map.addPanels(panel);

    // Colores configurables (mismo patrón que el resto de plugins)
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const panelEl = panel.getElement ? panel.getElement() : document.querySelector('.m-panel.m-attribution-lite');
    if (panelEl) {
      panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

    // Barra horizontal inferior anclada al contenedor del mapa.
    // Resolución robusta: en 2D (OL) el impl expone getViewport(); en 3D
    // (Cesium) ni getViewport ni getTargetElement existen, así que se usa el
    // contenedor raíz .m-api-idee-container como anclaje de la barra.
    let mapImpl = null;
    if (map.getMapImpl && typeof map.getMapImpl === 'function') {
      try {
        mapImpl = map.getMapImpl();
      } catch (e) {
        mapImpl = null;
      }
    }
    let container = null;
    if (mapImpl && typeof mapImpl.getViewport === 'function') {
      container = mapImpl.getViewport();
    } else if (mapImpl && typeof mapImpl.getTargetElement === 'function') {
      container = mapImpl.getTargetElement();
    }
    if (!container || !container.appendChild) {
      container = document.querySelector('.m-api-idee-container') || document.body;
    }
    if (!container) {
      console.warn('miPlugin_attribution: no se encontró el contenedor del mapa');
      return;
    }

    const bar = document.createElement('div');
    bar.className = 'm-attribution-bar';
    bar.hidden = true;

    const barTitle = document.createElement('span');
    barTitle.className = 'm-attribution-bar-title';
    barTitle.textContent = 'Créditos';
    bar.appendChild(barTitle);

    const content = document.createElement('div');
    content.className = 'm-attribution-bar-content';
    bar.appendChild(content);
    this.container_ = content;

    // Botón de cierre ("flechita") para colapsar los créditos
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'm-attribution-bar-close';
    closeBtn.title = 'Cerrar créditos';
    closeBtn.setAttribute('aria-label', 'Cerrar créditos');
    closeBtn.addEventListener('click', function() {
      const btn = panelEl ? panelEl.querySelector('button.m-panel-btn') : null;
      if (btn) {
        btn.click();
        btn.focus();
      }
    });
    bar.appendChild(closeBtn);

    container.appendChild(bar);
    this.refresh(map);

    // La barra sigue el estado del panel (abierto/cerrado) vía su clase .opened
    const syncBar = function() {
      bar.hidden = !(panelEl && panelEl.classList.contains('opened'));
    };
    syncBar();
    if (typeof MutationObserver === 'function' && panelEl) {
      this._liteObserver = new MutationObserver(syncBar);
      this._liteObserver.observe(panelEl, { attributes: true, attributeFilter: ['class'] });
    }

    // Cerrar el panel con Escape (registro único a nivel global)
    if (!window.__miPluginAttributionEscapeBound) {
      window.__miPluginAttributionEscapeBound = true;
      document.addEventListener('keydown', function(evt) {
        if (evt.key === 'Escape' || evt.key === 'Esc') {
          const openedPanel = document.querySelector('.m-panel.g-herramienta_attribution.opened');
          if (openedPanel) {
            const closeBtn = openedPanel.querySelector('button.m-panel-btn');
            if (closeBtn) closeBtn.click();
          }
        }
      });
    }

    this.controls_ = [control];
    this.control = control;
    this.control_ = control;
    this.panel = panel;
    this.panel_ = panel;
    this._liteBar = bar;

    this._bindLayerEvents(map, IDEE);
  }

  /**
   * Suscribe eventos de capas para refrescar automáticamente las atribuciones.
   * @param {Object} map Instancia del mapa
   * @param {Object} IDEE API activa
   */
  _bindLayerEvents(map, IDEE) {
    const self = this;
    const evt = (IDEE && IDEE.evt) || (window.M && window.M.evt) || {};
    const onLayerChange = function() {
      self.refresh(map);
    };
    this._onLayerChange = onLayerChange;
    this._boundEvents = [];

    const layerEvents = [
      'ADDED_LAYER',
      'ADDED_QUICK_LAYERS',
      'ADDED_VECTOR_TILE',
      'ADDED_WFS',
      'ADDED_WMS',
      'ADDED_WMTS',
      'ADDED_XYZ',
      'ADDED_TMS',
      'REMOVED_LAYER'
    ];

    if (typeof map.on === 'function') {
      layerEvents.forEach(function(eventName) {
        const eventType = evt[eventName];
        if (eventType) {
          map.on(eventType, onLayerChange);
          self._boundEvents.push(eventType);
        }
      });
    }
  }

  /**
   * Limpia controles y referencias asociadas al mapa.
   */
  destroy() {
    if (this.map_ && typeof this.map_.off === 'function' && this._onLayerChange && Array.isArray(this._boundEvents)) {
      this._boundEvents.forEach((eventType) => {
        try {
          this.map_.off(eventType, this._onLayerChange);
        } catch (e) {
          // Ignorar si el listener ya no está registrado
        }
      });
    }
    this._boundEvents = [];
    this._onLayerChange = null;
    this.container_ = null;

    // Limpieza del modo 'lite' (barra inferior + MutationObserver)
    if (this._liteObserver) {
      try {
        this._liteObserver.disconnect();
      } catch (e) {
        // Ignorar
      }
      this._liteObserver = null;
    }
    if (this._liteBar && this._liteBar.parentNode) {
      try {
        this._liteBar.parentNode.removeChild(this._liteBar);
      } catch (e) {
        // Ignorar
      }
    }
    this._liteBar = null;

    if (this.map_ && this.control_) {
      try {
        this.map_.removeControls([this.control_]);
      } catch (e) {
        // Ignorar si el mapa o control ya fueron removidos
      }
    }
    this.map = null;
    this.map_ = null;
    this.control = null;
    this.control_ = null;
    this.panel = null;
    this.panel_ = null;
  }
}

// Exponer la clase en el namespace IDEE.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_attribution = miPlugin_attribution;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_attribution = miPlugin_attribution;
  if (window.M) {
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_attribution = miPlugin_attribution;
  }
}
