// Reemplazamos la API basada en variables globales por una clase-plugin
class miPlugin_layerSwitcher {
  constructor(options = {}) {
    this.name = 'miPlugin_layerSwitcher';
    this.options = options || {};
    // Posición (índice, empezando en 0) del botón del plugin dentro del div
    // de botones (el m-area donde se colocan los paneles). Si se omite o no es
    // un número válido, el botón queda donde lo coloca Mapea por defecto (el
    // orden de addPanels / addPlugin). Ej: order:0 => primer botón del área.
    this.order = (options.order !== undefined) ? Number(options.order) : null;
    // Colores configurables. Cada uno puede ser un color (string) o un
    // objeto {active, deactive}:
    //   color1 = fondo, color2 = borde (botón+panel), color3 = icono/flecha.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
    // idLayer de la capa cuyo desplegable de opciones (transparencia) está
    // abierto. Se conserva entre re-renders para no cerrarlo al alternar
    // la visibilidad de otra capa.
    this._optionsOpen = null;
    // Estado de colapso/expansión de los grupos de capas (idLayer -> bool).
    // Se conserva entre re-renders; si un grupo no está presente, se usa el
    // valor "collapsed" con el que se creó (constructorParameters).
    this._groupCollapsed = {};
  }

  // Devuelve {active, deactive} a partir de un color simple o un objeto.
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
  }

  getHelp() {
    return {
      title: 'Selector de capas',
      content: new Promise((success) => {
        let html = '<div><p>Selector de capas visibles en el mapa</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    // Referencia a la instancia para los handlers globales que necesitan
    // acceder a this._optionsOpen.
    const self = this;
    const panelExtra = new IDEE.ui.Panel('toolsExtra_layerSwitcher', {
      collapsible: true,
      className: 'g-herramienta_selectorCapa',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    const htmlPanel = `
      <div aria-label="Selector de capas" role="menuitem" id="div-contenedor-herramienta-layerSwitcher" class="m-control m-container m-herramienta">
        <header 
          role="heading" 
          tabindex="0" 
          id="m-herramienta-title-layerSwitcher"
          class="m-herramienta-header">
            Selector de capas
        </header>
        <section id="m-herramienta-previews-layerSwitcher" class="m-herramienta-previews"></section>
        <div id="m-herramienta-contents-layerSwitcher"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlLayer_layerSwitcher');
    control.createView = () => document.createElement('div');

    panelExtra.addControls(control);
    map.addPanels(panelExtra);

    // ── Posicionar el botón del plugin (opción `order`) ────────────────
    // Reordena el panel del plugin dentro del div donde Mapea coloca los
    // botones de los paneles (el m-area que contiene los .m-panel). El
    // `order` (opcional) es el índice 0-based del botón dentro de esa lista:
    // - order:0  => primer botón del área;
    // - order:2  => tercer botón del área;
    // - omitido  => el botón queda donde lo colocó map.addPanels.
    // Se ejecuta DESPUÉS de addPanels para disponer del panel en el DOM.
    if (this.order !== null && !Number.isNaN(this.order)) {
      const panelEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta_selectorCapa');
      if (panelEl && panelEl.parentElement) {
        // El div que contiene los botones/paneles (el m-area del panel).
        const area = Array.from(panelEl.parentElement.children).some(el => el === panelEl)
          ? panelEl.parentElement
          : panelEl.closest('.m-area');
        if (area) {
          // Paneles (botones) hermanos en el orden actual del DOM.
          const siblings = Array.from(area.children).filter(el =>
            el.classList && el.classList.contains('m-panel')
          );
          if (siblings.length > 1) {
            // Posición objetivo (clamp a rango válido).
            const target = Math.max(0, Math.min(this.order, siblings.length - 1));
            const current = siblings.indexOf(panelEl);
            if (current !== target) {
              const ref = (target >= siblings.length)
                ? null
                : siblings[target];
              if (ref && ref !== panelEl) {
                // Si movemos hacia delante y nos apoyamos en un hermano que
                // está antes del propio panel, hay que insertar en el
                // siguiente para no quedarnos pendientes. Se recalcula según
                // la posición relativa.
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
    }

    // ── Aplicar colores configurables (color1=fondo, color2=borde, color3=icono) ──
    // Se inyectan 6 variables CSS en el panel (estado normal y ".opened/active").
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const panelEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta_selectorCapa');
    if (panelEl) {
      panelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      panelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      panelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      panelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      panelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      panelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

    const panelSelector = document.querySelector('.g-herramienta_selectorCapa .m-panel-controls');
    if (panelSelector) panelSelector.innerHTML = htmlPanel;
    const contents = document.querySelector('#m-herramienta-contents-layerSwitcher');
    if (contents) contents.appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-layerSwitcher');

    // ── Grupos de capas (IDEE.layer.LayerGroup) ────────────────────────
    // Un grupo agrupa capas (que pueden ser a su vez otros grupos). La API
    // lo expone como una capa de tipo 'LayerGroup' con getLayers() para las
    // hijas. Su name/legend por defecto son 'layer_<n>', asi que el nombre
    // visible se construye con legend o title (constructorParameters).
    const isGroupLayer = (l) => !!l && (l.type === 'LayerGroup' || l._type === 'LayerGroup');

    const getLayerDisplayName = (l) => {
      try {
        if (l.legend && !/^layer_\d+$/.test(String(l.legend))) return l.legend;
        const up = l.constructorParameters && l.constructorParameters.userParameters;
        if (up && up.title && !/^layer_\d+$/.test(String(up.title))) return up.title;
        if (l.name && !/^layer_\d+$/.test(String(l.name))) return l.name;
        return l.legend || l.name || 'Sin nombre';
      } catch (e) { return l.legend || l.name || 'Sin nombre'; }
    };

    // ¿Colapsado? Estado manual conservado en _groupCollapsed, o si no el
    // valor "collapsed" del constructor del grupo.
    const isGroupCollapsed = (group) => {
      const key = String(group.idLayer);
      if (key in self._groupCollapsed) return self._groupCollapsed[key];
      try {
        const up = group.constructorParameters && group.constructorParameters.userParameters;
        return !!(up && up.collapsed);
      } catch (e) { return false; }
    };

    // Busca una capa por idLayer. Primero en el registro del mapa y, si no
    // esta, recursivamente dentro de los grupos (una capa puede vivir SOLO
    // dentro de un grupo y no aparecer en map.getLayers()).
    const findLayerById = (index) => {
      let found = null;
      try {
        found = map.getLayers().find(layer => {
          try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
        }) || null;
      } catch (e) { found = null; }
      if (found) return found;
      const stack = [];
      try { map.getLayers().forEach(l => { if (isGroupLayer(l)) stack.push(l); }); } catch (e) { /* sin grupos */ }
      while (stack.length) {
        const g = stack.pop();
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        for (const h of hijos) {
          if (h && h.idLayer == index) return h;
          if (isGroupLayer(h)) stack.push(h);
        }
      }
      return null;
    };

    // Encuentra el grupo padre que contiene directamente a una capa (busca
    // recursivamente entre los grupos del mapa). Devuelve el grupo o null.
    const findParentGroup = (target) => {
      const stack = [];
      try { map.getLayers().forEach(l => { if (isGroupLayer(l)) stack.push(l); }); } catch (e) { return null; }
      while (stack.length) {
        const g = stack.pop();
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        if (hijos.some(h => h === target)) return g;
        hijos.forEach(h => { if (isGroupLayer(h)) stack.push(h); });
      }
      return null;
    };

    // z-index REAL de una capa: el que usa el renderer de OpenLayers
    // (sortByZIndex) para pintar. Se lee del impl OL (layer.getImpl().olLayer),
    // que es la fuente de verdad: la fachada puede quedar desincronizada tras
    // un setZIndex() (no lo refleja). Fallback a la fachada si no hay impl.
    const getRealZIndex = (l) => {
      if (!l) return null;
      try {
        const impl = typeof l.getImpl === 'function' ? l.getImpl() : null;
        const ol = impl && impl.olLayer;
        if (ol && typeof ol.getZIndex === 'function') {
          const z = ol.getZIndex();
          if (z != null) return z;
        }
      } catch (e) { /* seguir con fachada */ }
      try {
        if (typeof l.getZIndex === 'function') return l.getZIndex();
      } catch (e) { /* sin z */ }
      return null;
    };

    // Ordena una lista de capas de MAYOR a MENOR z-index: la capa que se
    // dibuja encima (z-index mayor) va arriba del todo de la lista. Si alguna
    // capa no expone getZIndex() se mantiene al final (z-index nulo).
    const sortLayersByZDesc = (list) => {
      return (list || []).slice().sort((a, b) => {
        const za = getRealZIndex(a);
        const zb = getRealZIndex(b);
        if (za == null && zb == null) return 0;
        if (za == null) return 1;
        if (zb == null) return -1;
        return zb - za;
      });
    };

    // Capas seleccionables desde el selector (compartido entre el panel y el
    // dropdown del sidenav de la tabla de atributos). Se excluyen capas
    // temporales/auxiliares (p.ej. el resaltado del panel) marcadas con
    // displayInLayerSwitcher:false, las de terreno, las capas internas
    // auto-generadas por Mapea (nombre "layer_<n>"), y las capas BASE:
    // las capas base se gestionan desde la extension de capas base
    // (ext_backgorundLayers), no desde este selector de capas superpuestas.
    // Los GRUPOS (LayerGroup) SI pasan aunque su nombre interno sea
    // "layer_<n>" porque se muestran como nodos padre del arbol.
    // Se usa map.getLayers() (sincrono) en lugar de map.getOverlayLayers():
    // getLayers() refleja correctamente las eliminaciones con removeLayers(),
    // mientras que getOverlayLayers() de la fachada puede mantener caches
    // que causan capas fantasma tras un borrado.
    // El resultado se ordena por z-index DESCENDENTE (la capa superior del
    // mapa va arriba en la lista).
    const getSelectableLayers = async () => {
      const allLayers = map.getLayers() || [];
      // Recoge tambien las capas que viven SOLO dentro de un grupo (añadidas
      // con grupo.addLayers() pero no con map.addLayers()): la fachada no las
      // lista en map.getLayers() pero deben aparecer en el selector (bajo su
      // grupo) y en el dropdown del sidenav. Se aplanan recursivamente.
      const hijasDeGrupos = [];
      const collectGroupChildren = (g) => {
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        hijos.forEach(h => {
          hijasDeGrupos.push(h);
          if (isGroupLayer(h)) collectGroupChildren(h);
        });
      };
      allLayers.filter(isGroupLayer).forEach(collectGroupChildren);
      const result = (allLayers.concat(hijasDeGrupos)).filter(l => {
        try {
          const impl = (l && typeof l.getImpl === 'function') ? l.getImpl() : null;
          // Las capas base no se muestran aqui (van en la extension de capas base).
          if (l && l.isBase === true) return false;
          if (impl && impl.isBase === true) return false;
          const direct = l && l.displayInLayerSwitcher;
          const implFlag = impl && impl.displayInLayerSwitcher;
          if (direct === false || implFlag === false) return false;
          if (l && (l._type === 'Terrain' || l.type === 'Terrain')) return false;
          const nm = (l && (l.name || l.legend)) || '';
          if (/^layer_\d+$/.test(nm) && !isGroupLayer(l)) return false;
          return true;
        } catch (e) { return true; }
      });
      return sortLayersByZDesc(result);
    };

    // Construye el arbol de capas del selector: los grupos (LayerGroup) se
    // convierten en nodos padre con sus hijas (recursivo, con soporte de
    // subgrupos). Las capas que viven DENTRO de un grupo se eliminan del
    // nivel raiz para no duplicarlas.
    const buildLayerTree = async () => {
      const allLayers = await getSelectableLayers();
      const grupos = allLayers.filter(isGroupLayer);
      // idLayer de TODAS las capas que estan dentro de algun grupo (directa
      // o indirectamente): se muestran bajo su grupo, no en la raiz.
      const hijasEnGrupo = new Set();
      const collectChildren = (g) => {
        let hijos = [];
        try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
        hijos.forEach(h => {
          hijasEnGrupo.add(String(h.idLayer));
          if (isGroupLayer(h)) collectChildren(h);
        });
      };
      grupos.forEach(collectChildren);

      const nodeOf = (layer) => {
        if (isGroupLayer(layer)) {
          let hijos = [];
          try { hijos = layer.getLayers ? layer.getLayers() : []; } catch (e) { hijos = []; }
          // Mismo criterio que la raiz: la hija con mayor z-index va arriba.
          return { layer, isGroup: true, children: sortLayersByZDesc(hijos).map(nodeOf) };
        }
        return { layer, isGroup: false, children: [] };
      };

      return allLayers
        .filter(l => !hijasEnGrupo.has(String(l.idLayer)))
        .map(nodeOf);
    };

    const renderLayerNode = (node, depth) => {
      const layer = node.layer;
      const layerName = getLayerDisplayName(layer);
      const index = layer.idLayer;
      const visible = layer.isVisible ? layer.isVisible() : true;
      // icono de ojo: abierto = capa visible, tachado/cerrado = oculta.
      // Se usan SVGs inline (como el resto de iconos del plugin) en lugar de
      // emojis: los emojis 👁/🚫 dependen de la fuente del sistema y en algunos
      // navegadores/visualizadores no se renderizan (aparecen como un punto o
      // un cuadro). El SVG es fiable y consistente en todos los visualizadores.
      const eyeIcon = visible
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
      // Transparencia actual en % (100 = totalmente transparente).
      // La API usa opacidad 0..1, asi que transparencia = (1 - opacity).
      let opacity = 1;
      try { if (layer.getOpacity !== undefined) opacity = layer.getOpacity() || 0; } catch (e) { /* ignorar */ }
      const transpPct = Math.round((1 - opacity) * 100);
      const optionsOpen = self._optionsOpen === index;
      // Solo las capas VECTORIALES tienen tabla de atributos: las raster
      // (y los grupos) no aportan nada, asi que se omite el boton de tabla.
      const layerKind = window.getLayerKind(layer);
      const tableBtnHtml = layerKind === 'vector'
        ? `<button type="button" class="ls-action ls-action-info" data-id="${index}" title="Ver tabla de atributos / estadísticas de la capa" onclick="openLayerInfo('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg></button>`
        : '';
      // Gradiente del track del slider: representa la OPACIDAD (lo que
      // queda visible). 0% de transparencia (opaco) => relleno hasta la
      // derecha (100%); 100% de transparencia => riel vacio (0%).
      const fillPct = 100 - transpPct;
      const sliderFill = `linear-gradient(to right, #0078d4 0%, #0078d4 ${fillPct}%, #d7dde7 ${fillPct}%, #d7dde7 100%)`;
      const eyeBtn = `<button type="button" class="ls-eye ${visible ? 'ls-eye-on' : 'ls-eye-off'}" data-id="${index}" title="${visible ? 'Ocultar capa' : 'Mostrar capa'}" onclick="toggleLayerVisibility('${index}')">${eyeIcon}</button>`;
      const optsBtn = `<button type="button" class="ls-options ${optionsOpen ? 'ls-options-open' : ''}" data-id="${index}" title="Opciones de la capa" onclick="toggleLayerOptions('${index}')">▾</button>`;
      const optionsPanel = `
              <div class="ls-options-panel ${optionsOpen ? 'open' : ''}">
                <div class="ls-option-row">
                  <span class="ls-option-label" title="Transparencia de la capa">Transparencia</span>
                  <input type="range" min="0" max="100" value="${transpPct}" class="ls-opacity-slider" style="background:${sliderFill}" aria-label="Transparencia de ${layerName}" oninput="setLayerOpacity('${index}', this.value, this)">
                  <span class="ls-option-value">${transpPct}%</span>
                </div>
                <div class="ls-actions-row">
                  <button type="button" class="ls-action ls-action-rename" data-id="${index}" title="Renombrar capa" onclick="startRenameLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                  ${tableBtnHtml}
                  <button type="button" class="ls-action ls-action-delete" data-id="${index}" title="Eliminar la capa del mapa" onclick="deleteLayer('${index}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                </div>
              </div>`;

      // Asa de arrastre: unico punto desde el que se inicia el drag (así el
      // resto de botones de la fila siguen siendo clicables durante el Drag&Drop).
      const dragHandleHtml = `<span class="ls-drag-handle" title="Arrastra para reordenar" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.7"/><circle cx="15" cy="5" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="19" r="1.7"/><circle cx="15" cy="19" r="1.7"/></svg></span>`;

      // Nombre clicable: alterna la visibilidad (mismo comportamiento que el
      // ojito) pero sin duplicar el boton. Publico para que no dependa del
      // formato del panel de opciones.
      const nameBtn = `<button type="button" class="ls-nombre ${node.isGroup ? 'ls-group-name' : ''}" data-id="${index}" title="${visible ? 'Ocultar capa' : 'Mostrar capa'}" onclick="toggleLayerVisibility('${index}')">${layerName}</button>`;

      if (node.isGroup) {
        const collapsed = isGroupCollapsed(layer);
        const chevron = collapsed ? '▸' : '▾';
        const childrenHtml = node.children.map(c => renderLayerNode(c, depth + 1)).join('');
        return `
            <li class="ls-group" data-depth="${depth}" draggable="true" data-drag-id="${index}">
              <div class="ls-row">
                ${dragHandleHtml}
                <button type="button" class="ls-group-chevron" data-id="${index}" title="${collapsed ? 'Expandir grupo' : 'Colapsar grupo'}" onclick="toggleGroup('${index}')">${chevron}</button>
                ${nameBtn}
                ${eyeBtn}
                ${optsBtn}
              </div>
              ${optionsPanel}
              <ul class="ls-children ${collapsed ? 'ls-collapsed' : ''}">${childrenHtml}</ul>
            </li>`;
      }

      return `
            <li data-depth="${depth}" draggable="true" data-drag-id="${index}">
              <div class="ls-row">
                ${dragHandleHtml}
                ${nameBtn}
                ${eyeBtn}
                ${optsBtn}
              </div>
              ${optionsPanel}
            </li>`;
    };

    const renderLayerList = async () => {
      try {
        const tree = await buildLayerTree();
        const htmlList = tree.map(node => renderLayerNode(node, 0)).join('');

        control.htmlView = `<ul class="overlay-layer-selector">${htmlList}</ul>`;
        const preview = document.querySelector('#m-herramienta-previews-layerSwitcher');
        if (preview) preview.innerHTML = control.htmlView;

        // Enlaza los eventos de drag & drop UNA sola vez por lista. Se usan
        // listeners delegados en el <ul> para que sigan funcionando tras cada
        // re-render (renderLayerList reemplaza el innerHTML).
        if (!preview.__lsDragBound) {
          preview.__lsDragBound = true;
          // Arma el flag "el gesto empezó en el asa": el evento dragstart se
          // dispara con target = el <li> draggable (no el elemento bajo el
          // cursor), así que el origen real del gesto hay que capturarlo en
          // pointerdown. Sin esto el drag se cancelaría siempre.
          preview.addEventListener('pointerdown', (e) => {
            window.__lsDragHandleArmed = !!(e.target.closest && e.target.closest('.ls-drag-handle'));
          });
          preview.addEventListener('dragstart', window.handleDragStart);
          preview.addEventListener('dragover', window.handleDragOver);
          preview.addEventListener('drop', window.handleDrop);
          preview.addEventListener('dragend', window.handleDragEnd);
          preview.addEventListener('dragleave', (e) => {
            if (!preview.contains(e.relatedTarget)) clearDropMarks();
          });
        }
      } catch (e) {
        console.warn('layerSwitcher: error rendering layer list', e);
      }
    };

    // Expone el re-render para que los controles (ojito) refresquen
    // la lista y el estado de visibilidad tras cada cambio.
    window.renderLayerList = async () => { await renderLayerList(); };

    control.activate = async () => {
      await renderLayerList();
    };

    control.deactivate = () => { };

    window.toggleLayerVisibility = function (index) {
      const layer = findLayerById(index);
      if (!layer || typeof layer.setVisible !== 'function') return;

      // El ojito es el unico control de visibilidad: alterna la capa de forma
      // independiente (varias capas pueden estar visibles a la vez). En un
      // grupo, alterna la visibilidad del grupo COMPLETO (OpenLayers oculta
      // el render de todas sus hijas sin tocar su estado individual).
      layer.setVisible(!layer.isVisible());
      // Actualiza el ojito (estado visible/oculto) tras el cambio.
      if (window.renderLayerList && typeof window.renderLayerList === 'function') {
        window.renderLayerList();
      } else if (layer && layer.isVisible) {
        const eye = document.querySelector('.g-herramienta_selectorCapa .ls-eye[data-id="' + index + '"]');
        const visible = layer.isVisible();
        if (eye) {
          // Mismo SVG que en el render principal (ver eyeIcon en renderLayerNode).
          eye.innerHTML = visible
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
          eye.classList.toggle('ls-eye-on', visible);
          eye.classList.toggle('ls-eye-off', !visible);
          eye.title = visible ? 'Ocultar capa' : 'Mostrar capa';
        }
      }
    };

    // ── Desplegable de opciones por capa ────────────────────────────────
    // Abre/cierra el panel de opciones de una capa (por ahora transparencia).
    // Conserva en self._optionsOpen que capa tiene el panel abierto para no
    // cerrarlo al re-renderizar (p.ej. al alternar la visibilidad de otra).
    window.toggleLayerOptions = function (index) {
      self._optionsOpen = self._optionsOpen === index ? null : index;
      renderLayerList();
    };

    // ── Colapsar / expandir un grupo de capas ──────────────────────────
    // Alterna el estado y lo conserva en self._groupCollapsed (idLayer -> bool)
    // para que el re-render no lo pierda. Si es la primera vez, parte del
    // valor "collapsed" con el que se creó el grupo en el constructor.
    window.toggleGroup = function (index) {
      const key = String(index);
      const actual = (key in self._groupCollapsed) ? self._groupCollapsed[key] : (() => {
        let def = false;
        try {
          const up = findLayerById(index);
          if (up && up.constructorParameters) {
            const upar = up.constructorParameters.userParameters;
            def = !!(upar && upar.collapsed);
          }
        } catch (e) { def = false; }
        return def;
      })();
      self._groupCollapsed[key] = !actual;
      renderLayerList();
    };

    // ── Renombrar capa / grupo ─────────────────────────────────────────
    // Edita el nombre en linea: el <span class="ls-nombre"> se sustituye por
    // un input. Enter o blur guardan; Escape cancela. Se persiste en la
    // fachada (legend/name/title) y en el impl OL (name/title) para que los
    // paneles de Mapea (legenda, otros selectores) reflejen el cambio.
    window.startRenameLayer = function (index) {
      const layer = findLayerById(index);
      if (!layer) return;
      const li = document.querySelector('.g-herramienta_selectorCapa li[data-drag-id="' + index + '"]');
      if (!li) return;
      const nombreEl = li.querySelector('.ls-nombre');
      if (!nombreEl) return;
      const current = getLayerDisplayName(layer);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ls-rename-input';
      input.value = current;
      input.maxLength = 80;
      // Sustituye el span por el input y da el foco con el nombre seleccionado.
      nombreEl.replaceWith(input);
      input.focus();
      input.select();

      const commit = () => {
        const val = input.value.trim();
        renameLayerName(layer, val || current);
        window.renderLayerList();
      };
      const cancel = () => {
        window.renderLayerList();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });
      // mousedown para no disparar el drag al hacer clic en el input.
      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('blur', commit);
      input.addEventListener('dblclick', (e) => e.stopPropagation());
      // Evita que el input desencadene el drag & drop de la fila.
      input.setAttribute('draggable', 'false');
    };

    // Guarda el nuevo nombre en la fachada de Mapea y en el impl OL,
    // manteniendo el orden de prioridad que lee getLayerDisplayName:
    // legend -> title -> name. Se limpia en el nuevo nombre el patron interno
    // "layer_<n>" para no confundirlo con los nombres autogenerados.
    const renameLayerName = (layer, newName) => {
      try {
        const clean = String(newName == null ? '' : newName).trim();
        if (!clean) return;
        // La prioridad de lectura es legend > title > name: escribimos SIEMPRE
        // en legend (el primer que se lee) para que prevalezca este nombre.
        if (layer) layer.legend = clean;
        if (layer) layer.name = clean;
        // Impl OL: tambien se actualizan name/title para los componentes Mapea.
        const impl = (typeof layer.getImpl === 'function') ? layer.getImpl() : null;
        if (impl) {
          const ol = impl.olLayer;
          if (ol && typeof ol.set === 'function') {
            ol.set('name', clean);
            ol.set('title', clean);
          }
        }
      } catch (e) {
        console.warn('layerSwitcher: no se pudo renombrar la capa', e);
      }
    };
    // Expuesto para que drag & drop pueda reutilizarlo internamente si hace falta.
    window._renameLayerName = renameLayerName;

    // ── Drag & drop para reordenar capas ───────────────────────────────
    // La fila de cada capa/grupo arrastra con el asa (ls-drag-handle). El
    // reordenado se aplica REASIGNANDO el z-index del impl OL (el renderer de
    // OpenLayers pinta por zIndex, no por orden de coleccion: se verificó que
    // la coleccion raiz esta desordenada [1042,45,0,46] y el render es
    // correcto).
    //
    // applyReorder reindexa las capas seleccionables de un contenedor (raiz
    // del mapa o las hijas directas de un grupo): la capa movida sale de su
    // posicion y todas las del contenedor reciben z consecutivos en el rango
    // que les corresponde. Asi SOLO se alteran los z de las capas del
    // contenedor que intervienen, y las capas NO seleccionables (auxiliares,
    // capa de dibujo __draw__, base) conservan intactos su z y su intercalado.
    //
    //  - Para un GRUPO: las hijas se reparten z consecutivos justo DEBAJO del
    //    techo del grupo (z_del_grupo - 1, z_del_grupo - 2, ...). La primera de
    //    la lista recibe el z mas alto del rango (se dibuja encima de sus
    //    hermanas). Nunca supera el z del grupo (invariante jerarquico).
    //  - Para la RAÍZ: las capas seleccionables se reparten z consecutivos en
    //    el rango que ya ocupan (reindexado contiguo por debajo de su maximo
    //    actual), manteniendo las auxiliares intactas. Si la movida es un
    //    GRUPO, sus hijas se reindexan tambien al nuevo techo del grupo para
    //    no desconectarlas de el.
    const applyReorder = (movedLayer, parentGroup, visibleSiblings, newIndex) => {
      try {
        const vis = visibleSiblings.slice();
        if (vis.indexOf(movedLayer) < 0) return;

        // Nueva ordenacion (arriba = primero).
        const others = vis.filter(l => l !== movedLayer);
        others.splice(Math.max(0, Math.min(newIndex, others.length)), 0, movedLayer);

        if (parentGroup) {
          // ── Hijas de un grupo: rango justo bajo el techo del grupo. ──
          let techo = 0;
          try {
            const cImpl = parentGroup.getImpl ? parentGroup.getImpl() : null;
            const cOl = cImpl && cImpl.olLayer;
            if (cOl && typeof cOl.getZIndex === 'function') techo = cOl.getZIndex() || 0;
          } catch (e) { techo = 0; }
          // 'others' llega en orden visual (arriba = primera): la primera
          // fila recibe el z mas alto del rango (techo-1), la siguiente
          // techo-2, ... Asi el orden visual coincide con el render.
          others.forEach((l, i) => {
            recordZ(l, (techo - 1) - i);
          });
        } else {
          // ── Raiz del mapa: reindexado greedy conservando el orden visual. ──
          // Toda la lista (grupos incluidos) recibe z consecutivos hacia abajo
          // desde el maximo actual de las capas seleccionables: el orden
          // visual queda exacto y los grupos conservan su arbol bajo su nuevo
          // techo (reindexGroupTree). Las capas auxiliares (p.ej. __draw__) y
          // las bases estan fuera de la lista y no se tocan.
          let next = 0;
          vis.forEach(l => { const z = getRealZIndex(l); if (z != null && z > next) next = z; });
          others.forEach((l) => {
            // La primera fila (arriba) toma el maximo actual; las siguientes bajan.
            recordZ(l, Math.max(0, next));
            next -= 1;
            if (isGroupLayer(l)) reindexGroupTree(l);
          });
        }
        // Si la capa movida es un GRUPO, sus hijas deben reindexarse al nuevo
        // techo del grupo (mantenerlas en el rango viejo las desconectaria del
        // grupo). Mismo criterio: techo - 1, techo - 2, ... bajo el grupo.
        if (isGroupLayer(movedLayer)) {
          let techo = getRealZIndex(movedLayer);
          if (techo == null) techo = 0;
          let hijos = [];
          try { hijos = movedLayer.getLayers ? movedLayer.getLayers() : []; } catch (e) { hijos = []; }
          const hijasVis = hijos.filter(h => { try {
            const im = h.getImpl ? h.getImpl() : null;
            if (h && h.isBase === true) return false;
            if (im && im.isBase === true) return false;
            if (h && h.displayInLayerSwitcher === false) return false;
            if (im && im.displayInLayerSwitcher === false) return false;
            const nm = String(h && (h.name || h.legend) || '');
            if (/^layer_\d+$/.test(nm) && !isGroupLayer(h)) return false;
            return true;
          } catch (e) { return false; } });
          const nHijas = hijasVis.length;
          // Reordenadas por z actual (arriba = mayor z).
          hijasVis.sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
          hijasVis.forEach((h, i) => {
            recordZ(h, (techo - 1) - i);
          });
        }
        window.renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: error al reordenar', e);
      }
    };

    // Registra el z-index en la fachada y en el impl OL. Mapea puede leer el z
    // desde la fachada (getZIndex()) que delega al impl, asi que escribimos el
    // impl (fuente de verdad del render) y, si la fachada expone setter propio,
    // tambien lo sincronizamos.
    const recordZ = (layer, z) => {
      try {
        const impl = (typeof layer.getImpl === 'function') ? layer.getImpl() : null;
        const ol = impl && impl.olLayer;
        if (ol && typeof ol.setZIndex === 'function') ol.setZIndex(z);
        // Fallback: si no hay impl OL, intenta setZIndex en la propia fachada.
        if (!ol && typeof layer.setZIndex === 'function') layer.setZIndex(z);
      } catch (e) { /* defensivo */ }
    };

    // Obtiene el contenedor (raiz de mapa o grupo) de una capa: devuelve la
    // lista de capas "hermanas" (mismo nivel) y el grupo padre (null=raiz).
    const getSiblings = (layer) => {
      const parentGroup = findParentGroup(layer);
      if (parentGroup) {
        let hijos = [];
        try { hijos = parentGroup.getLayers ? parentGroup.getLayers() : []; } catch (e) { hijos = []; }
        return { parentGroup, siblings: hijos };
      }
      return { parentGroup: null, siblings: map.getLayers() || [] };
    };

    // ¿Aparece la capa en el selector? Mismo criterio que getSelectableLayers:
    // si no está visible para el usuario no participa en el orden visible.
    const isVisibleInSelector = (l) => {
      try {
        const impl = l.getImpl ? l.getImpl() : null;
        if (l && l.isBase === true) return false;
        if (impl && impl.isBase === true) return false;
        if (l && l.displayInLayerSwitcher === false) return false;
        if (impl && impl.displayInLayerSwitcher === false) return false;
        const nm = String(l && (l.name || l.legend) || '');
        if (/^layer_\d+$/.test(nm) && !isGroupLayer(l)) return false;
        return true;
      } catch (e) { return true; }
    };

    // Capas visibles en el selector de un contenedor (null = la raiz del mapa).
    const visibleIn = (container) => {
      let layers = [];
      try {
        layers = container ? (container.getLayers ? container.getLayers() : []) : (map.getLayers() || []);
      } catch (e) { layers = []; }
      return layers.filter(isVisibleInSelector);
    };

    // ── Reindexado de contenedores (tras mover capas entre ellos) ───────
    // Raiz: se renumera TODO el rango de forma greedy conservando el orden
    // visual (z descendente): cada elemento de la lista recibe el siguiente z
    // disponible hacia abajo. Los GRUPOS reciben tambien su nuevo techo y su
    // arbol se cierra bajo el (sus hijas quedan contiguas bajo el techo), de
    // modo que el orden queda exacto aunque haya varios grupos intercalados.
    // Las capas auxiliares (p.ej. __draw__) y las bases no estan en la lista
    // y no se tocan: el tope es el maximo z actual de las visibles.
    // Grupo: las hijas se reparten contiguas bajo el techo del grupo
    // (techo-1, techo-2, ...) manteniendo su orden visual (z descendente).
    const reindexContainer = (container) => {
      try {
        const sorted = visibleIn(container).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        if (!sorted.length) return;
        if (container) {
          const techo = getRealZIndex(container) || 0;
          sorted.forEach((l, i) => recordZ(l, (techo - 1) - i));
        } else {
          let next = 0;
          sorted.forEach(l => { const z = getRealZIndex(l) || 0; if (z > next) next = z; });
          sorted.forEach(l => {
            recordZ(l, Math.max(0, next));
            next -= 1;
            if (isGroupLayer(l)) reindexGroupTree(l);
          });
        }
      } catch (e) { console.warn('layerSwitcher: error al reindexar contenedor', e); }
    };

    // Cierra el arbol de un grupo bajo su techo actual: las hijas directas se
    // reparten contiguas bajo el techo (techo-1, techo-2, ...) y los subgrupos
    // hacen lo propio recursivamente. Se usa al mover un GRUPO a otro
    // contenedor, para que sus hijas no queden por encima del nuevo techo.
    const reindexGroupTree = (group) => {
      try {
        const hijos = visibleIn(group).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        if (!hijos.length) return;
        const techo = getRealZIndex(group) || 0;
        hijos.forEach((h, i) => {
          recordZ(h, (techo - 1) - i);
          if (isGroupLayer(h)) reindexGroupTree(h);
        });
      } catch (e) { /* defensivo */ }
    };

    // Coloca 'moved' en el contenedor 'container' (null = raiz) justo antes o
    // despues de 'targetLayer', reindexando el destino. 'container' ya debe
    // contener a 'moved' (se ha anadido antes de llamar).
    const placeInContainer = (moved, container, targetLayer, after) => {
      const destVis = visibleIn(container).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
      const others = destVis.filter(l => l !== moved);
      let slot = others.indexOf(targetLayer);
      if (slot < 0) slot = others.length - 1;
      const pos = Math.max(0, Math.min(after ? slot + 1 : slot, others.length));
      others.splice(pos, 0, moved);

      if (container) {
        const techo = getRealZIndex(container) || 0;
        others.forEach((l, i) => recordZ(l, (techo - 1) - i));
      } else {
        // Mismo criterio greedy que reindexContainer: orden visual exacto,
        // grupos reindexados con su arbol bajo su nuevo techo.
        let next = 0;
        destVis.forEach(l => { const z = getRealZIndex(l) || 0; if (z > next) next = z; });
        others.forEach(l => {
          recordZ(l, Math.max(0, next));
          next -= 1;
          if (isGroupLayer(l)) reindexGroupTree(l);
        });
      }
      // Si la pieza movida es un GRUPO, sus hijas deben reindexarse al nuevo
      // techo; si no, quedarian en el rango viejo (posiblemente por encima
      // del nuevo contenedor).
      if (isGroupLayer(moved)) reindexGroupTree(moved);
    };

    // Mueve 'moved' al contenedor de 'targetLayer' (raiz o grupo distinto),
    // insertandolo antes/despues del destino, y cierra el hueco en el origen.
    const moveLayerBetween = (moved, sourceParent, targetLayer, targetParent, after) => {
      try {
        if (sourceParent) sourceParent.removeLayers(moved); else map.removeLayers(moved);
        if (targetParent) targetParent.addLayers(moved); else map.addLayers(moved);
        if (sourceParent !== targetParent) reindexContainer(sourceParent);
        placeInContainer(moved, targetParent, targetLayer, after);
        window.renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo mover la capa entre contenedores', e);
      }
    };

    // Mueve 'moved' DENTRO de 'group' como primera hija (la que se dibuja
    // encima de sus hermanas) y expande el grupo para mostrarla. Se produce
    // al soltar sobre la mitad inferior de la cabecera de un grupo.
    const moveLayerIntoGroup = (moved, group) => {
      try {
        const sourceParent = findParentGroup(moved);
        if (sourceParent) sourceParent.removeLayers(moved); else map.removeLayers(moved);
        if (sourceParent !== group) reindexContainer(sourceParent);
        group.addLayers(moved);
        const hijos = visibleIn(group).slice().sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        const others = hijos.filter(l => l !== moved);
        const techo = getRealZIndex(group) || 0;
        const list = [moved].concat(others);
        list.forEach((l, i) => recordZ(l, (techo - 1) - i));
        if (isGroupLayer(moved)) reindexGroupTree(moved);
        // El grupo destino se expande para que la capa quede a la vista.
        self._groupCollapsed[String(group.idLayer)] = false;
        window.renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo meter la capa en el grupo', e);
      }
    };

    window.handleDragStart = function (e) {
      const li = e.target.closest ? e.target.closest('li[data-drag-id]') : null;
      if (!li) return;
      // Solo se inicia el drag si el gesto empezó en el asa (ls-drag-handle):
      // el flag lo arma el listener de pointerdown, porque en dragstart el
      // target es el <li> draggable y no el elemento bajo el cursor.
      if (!window.__lsDragHandleArmed) { e.preventDefault(); return; }
      window.__lsDragHandleArmed = false;
      // El dataTransfer no es legible durante dragover (getData() devuelve ''
      // por privacidad, salvo en drop), asi que se guarda el id arrastrado en
      // una variable global para consultarlo en dragover.
      window.__lsDragId = li.getAttribute('data-drag-id');
      const list = li.closest('.overlay-layer-selector');
      if (list) list.classList.add('ls-dragging-active');
      e.dataTransfer.setData('text/plain', window.__lsDragId);
      e.dataTransfer.effectAllowed = 'move';
      // Retraso para que el clic del asa no se confunda con el drag.
      li.classList.add('ls-dragging');
    };

    window.handleDragOver = function (e) {
      const li = e.target.closest ? e.target.closest('li[data-drag-id]') : null;
      if (!li) return;
      const moved = window.__lsDragId ? findLayerById(window.__lsDragId) : null;
      if (!moved) return;
      const targetLayer = findLayerById(li.getAttribute('data-drag-id'));
      if (!targetLayer || moved === targetLayer) return;
      const isGroupTarget = li.classList.contains('ls-group');
      // Para un GRUPO la "mitad" se calcula sobre su cabecera (.ls-row), no
      // sobre el li completo (que incluye las hijas expandidas): asi la mitad
      // inferior de la cabecera es la zona "meter dentro" y la superior la de
      // "insertar antes del grupo". Si el puntero esta bajo la cabecera (en el
      // area de hijas, sin una hija concreta bajo el cursor) tambien se mete
      // dentro del grupo.
      const refRect = isGroupTarget ? (li.querySelector('.ls-row') || li).getBoundingClientRect() : li.getBoundingClientRect();
      const after = (e.clientY - refRect.top) > refRect.height / 2;
      const sourceParent = findParentGroup(moved);
      const intoGroup = isGroupTarget && (e.clientY > refRect.bottom || after);

      // Zona "meter dentro" de un grupo (mitad inferior de su cabecera o area
      // de hijas sin fila concreta): la capa entrara como hija. Si la capa ya
      // es hija de ese grupo, soltar sobre su propia cabecera no aporta nada;
      // y un grupo no puede meterse en si mismo ni en un descendiente propio
      // (crearia un ciclo).
      if (intoGroup) {
        if (sourceParent === targetLayer) return;
        if (isGroupLayer(moved)) {
          let g = targetLayer;
          while (g) { if (g === moved) return; g = findParentGroup(g); }
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearDropMarks();
        li.classList.add('ls-drop-into-group');
        return;
      }

      // Cualquier otra fila (o mitad superior de la cabecera de un grupo): la
      // capa se inserta antes o despues del destino DENTRO DE SU CONTENEDOR.
      // Vale tanto para reordenar en el mismo contenedor como para sacar una
      // capa de un grupo (destino en la raiz) o meterla en otro grupo
      // (destino dentro del grupo): el drop se resuelve segun el contenedor
      // del destino, no el del origen.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDropMarks();
      li.classList.add(after ? 'ls-drop-below' : 'ls-drop-above');
    };

    window.handleDrop = function (e) {
      e.preventDefault();
      clearDropMarks();
      const dragId = window.__lsDragId || e.dataTransfer.getData('text/plain');
      if (!dragId) return;
      const targetLi = e.target.closest ? e.target.closest('li[data-drag-id]') : null;
      if (!targetLi) return;
      const moved = findLayerById(dragId);
      if (!moved) return;
      const targetLayer = findLayerById(targetLi.getAttribute('data-drag-id'));
      if (!targetLayer || moved === targetLayer) return;
      const isGroupTarget = targetLi.classList.contains('ls-group');
      // Misma geometria que en handleDragOver: para un GRUPO la zona se calcula
      // sobre su cabecera (.ls-row), no sobre el li completo (que incluye las
      // hijas expandidas). Mitad inferior de la cabecera (o area de hijas sin
      // fila concreta bajo el cursor) = "meter dentro" del grupo.
      const refRect = isGroupTarget ? (targetLi.querySelector('.ls-row') || targetLi).getBoundingClientRect() : targetLi.getBoundingClientRect();
      const after = (e.clientY - refRect.top) > refRect.height / 2;
      const intoGroup = isGroupTarget && (e.clientY > refRect.bottom || after);
      const sourceParent = findParentGroup(moved);
      const targetParent = findParentGroup(targetLayer);

      // ── Mover DENTRO de un grupo (mitad inferior de su cabecera o area de
      // hijas sin fila concreta). ──
      if (intoGroup && sourceParent !== targetLayer) {
        // Guarda anti-ciclo: un grupo no puede meterse en si mismo ni en un
        // descendiente propio.
        if (isGroupLayer(moved)) {
          let g = targetLayer;
          while (g) { if (g === moved) return; g = findParentGroup(g); }
        }
        moveLayerIntoGroup(moved, targetLayer);
        e.dataTransfer.clearData();
        return;
      }

      // ── Mismo contenedor: reorden interno antes/despues del destino. ──
      if (sourceParent === targetParent) {
        // 'vis' debe venir en ORDEN VISUAL (z descendente, arriba = primera):
        // la coleccion OL del contenedor no garantiza ningun orden (es el de
        // addLayers), y applyReorder reindexa por posicion en la lista.
        const vis = getSiblings(moved).siblings.filter(isVisibleInSelector)
          .sort((a, b) => (getRealZIndex(b) || 0) - (getRealZIndex(a) || 0));
        const idx = vis.indexOf(moved);
        const targetIdx = vis.indexOf(targetLayer);
        if (idx < 0 || targetIdx < 0) return;
        // La lista sin la capa arrastrada (los "huecos" donde puede insertarse).
        const others = vis.filter(l => l !== moved);
        // Posicion del destino en esa lista 'others'.
        let targetSlot = others.indexOf(targetLayer);
        if (targetSlot < 0) return;
        // newIndex = posicion (en 'others') donde se inserta moved:
        const newIndex = after ? targetSlot + 1 : targetSlot;
        applyReorder(moved, sourceParent, vis, newIndex);
        e.dataTransfer.clearData();
        return;
      }

      // ── Contenedores distintos: sacar una capa de un grupo y meterla en el
      // contenedor del destino (raiz u otro grupo), en la posicion indicada. ──
      moveLayerBetween(moved, sourceParent, targetLayer, targetParent, after);
      e.dataTransfer.clearData();
    };

    window.handleDragEnd = function () {
      window.__lsDragId = null;
      clearDropMarks();
      document.querySelectorAll('.overlay-layer-selector li.ls-dragging').forEach(el => el.classList.remove('ls-dragging'));
      const list = document.querySelector('.overlay-layer-selector');
      if (list) list.classList.remove('ls-dragging-active');
    };

    const clearDropMarks = () => {
      document.querySelectorAll('.ls-drop-above, .ls-drop-below, .ls-drop-into-group').forEach(el => {
        el.classList.remove('ls-drop-above');
        el.classList.remove('ls-drop-below');
        el.classList.remove('ls-drop-into-group');
      });
    };

    // ── Borrar capa (o grupo de capas) ─────────────────────────────────
    // Elimina la capa del mapa y refresca la lista. Para un grupo se eliminan
    // tambien sus hijas (recursivo, incluidos subgrupos): borrar el contenedor
    // sin su contenido dejaria capas huerfanas en el mapa. Para capas hijas
    // de un grupo, se quitan tanto del grupo como del mapa.
    window.deleteLayer = function (index) {
      const layer = findLayerById(index);
      if (!layer) return;
      try {
        const removeDeep = (g) => {
          let hijos = [];
          try { hijos = g.getLayers ? g.getLayers() : []; } catch (e) { hijos = []; }
          hijos.slice().forEach(h => {
            if (isGroupLayer(h)) removeDeep(h);
            try { g.removeLayers(h); } catch (e) { /* el grupo puede no soportar quitar esta capa */ }
            try { map.removeLayers(h); } catch (e) { /* la hija puede no estar registrada en el mapa nivel raíz */ }
          });
        };
        if (isGroupLayer(layer)) {
          removeDeep(layer);
        } else {
          const parentGroup = findParentGroup(layer);
          if (parentGroup) {
            try { parentGroup.removeLayers(layer); } catch (e) { /* defensivo */ }
          }
        }
        map.removeLayers(layer);
        closeSheet();
        renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo borrar la capa', e);
      }
    };

    // ── Identificador del tipo de capa ──────────────────────────────────
    // Devuelve 'vector' si la capa es vectorial (GeoJSON, WFS, Vector...)
    // y 'raster' en caso contrario. API-IDEE no expone un metodo unico
    // fiable, asi que se comparan los tipos conocidos por su nombre.
    window.getLayerKind = function (layer) {
      let typeName = '';
      try { typeName = String(layer.type || layer._type || ''); } catch (e) { /* ignorar */ }
      if (!typeName) {
        try { typeName = String((layer.getImpl() && layer.getImpl().type) || ''); } catch (e) { /* ignorar */ }
      }
      const t = typeName.toLowerCase();
      const vectorTypes = ['geojson', 'wfs', 'vector', 'geojsonparser', 'feature', 'mvt', 'kml', 'csv', 'datoselevacion', 'mapbox', 'maplibre'];
      return vectorTypes.includes(t) ? 'vector' : 'raster';
    };

    // ── Slider de transparencia ─────────────────────────────────────────
    // transpPct es 0..100 (0 = opaco, 100 = totalmente transparente). La API
    // usa opacidad 0..1, asi que transladamos: opacity = 1 - transp/100.
    window.setLayerOpacity = function (index, transpPct, sliderEl) {
      const layer = findLayerById(index);
      const pct = Math.max(0, Math.min(100, Number(transpPct) || 0));
      if (layer && layer.setOpacity) {
        layer.setOpacity(1 - pct / 100);
      }
      // Actualiza solo el texto del valor y el relleno del track del slider,
      // sin re-render (re-renderizar perderia el foco mientras se arrastra).
      // El relleno representa la opacidad (100 - transparencia): 0% de
      // transparencia => relleno al 100%, 100% de transp. => vacio.
      if (sliderEl) {
        const fillPct = 100 - pct;
        sliderEl.style.background =
          `linear-gradient(to right, #0078d4 0%, #0078d4 ${fillPct}%, #d7dde7 ${fillPct}%, #d7dde7 100%)`;
        if (sliderEl.parentElement) {
          const val = sliderEl.parentElement.querySelector('.ls-option-value');
          if (val) val.textContent = pct + '%';
        }
      }
    };

    // ── Panel inferior (bottom sheet): tabla de atributos / estadisticas ──
    // En lugar de un modal centrado, se abre un panel anclado a la parte
    // baja de la pantalla que se despliega hacia arriba (a semejanza del
    // panel de opciones de comparacionVistas). Al hacer clic en una fila
    // de la tabla de atributos se localiza y resalta el feature en el mapa.
    const SHEET_OVERLAY_ID = 'ls-sheet-overlay';
    // Capa vectorial temporal usada para resaltar el feature seleccionado.
    let selLayer = null;
    // Contexto de sincronia tabla<->mapa de la tabla actualmente abierta.
    // Contiene la capa, su idLayer y los features (con su geometria) en el
    // mismo orden que las filas de la tabla. Permite que tanto el clic en una
    // fila como el clic en el mapa resuelvan el MISMO feature de forma fiable.
    let sheetCtx = null;
    // Referencia al handler de clic en el mapa mientras la tabla esta abierta.
    let mapClickHandler = null;

    // Función para remarcar todas las filas de la tabla segun el índice activo.
    function highlightRow(idx) {
      document.querySelectorAll('.ls-attr-table tbody tr').forEach(function (tr) {
        tr.classList.toggle('ls-row-active', tr.getAttribute('data-row-idx') === String(idx));
      });
    }

    let closeSheet = function () {
      unbindMapClick();
      const old = document.getElementById(SHEET_OVERLAY_ID);
      if (old && old.parentElement) old.parentElement.removeChild(old);
      sheetCtx = null;
      clearHighlight();
    };
    // Expuesto para que deleteLayer pueda cerrarlo sin depender del orden.
    window.closeSheet = closeSheet;

    function openSheet(title, bodyHtml, vectorTable, selectableLayers, currentIndex) {
      const overlay = document.createElement('div');
      overlay.id = SHEET_OVERLAY_ID;
      overlay.className = 'ls-sheet-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      const panel = document.createElement('div');
      panel.className = 'ls-sheet';
      // Dropdown de capas en el header del sidenav, si se facilita la lista.
      const hasPicker = Array.isArray(selectableLayers) && selectableLayers.length > 0;
      const pickerHtml = hasPicker
        ? `<select class="ls-sheet-layer-picker" aria-label="Capa" onchange="openLayerInfo(this.value, true)">
             ${selectableLayers.map(L => `<option value="${L.idLayer}" ${String(L.idLayer) === String(currentIndex) ? 'selected' : ''}>${L.legend || L.name || 'Sin nombre'}</option>`).join('')}
           </select>`
        : '';
      panel.innerHTML =
        `<div class="ls-sheet__handle" title="Arrastra para cambiar la altura del panel"></div>
         <div class="ls-sheet-header">
           <div class="ls-sheet-header-left">
             ${pickerHtml}
             <span class="ls-sheet-title"></span>
           </div>
           <button type="button" class="ls-sheet-close" title="Cerrar" onclick="closeSheet()">✕</button>
         </div>
         <div class="ls-sheet-body"></div>`;
      panel.querySelector('.ls-sheet-title').textContent = title;
      panel.querySelector('.ls-sheet-body').innerHTML = bodyHtml;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      // Se usa requestAnimationFrame para que el navegador aplique primero el
      // transform inicial (abajo) y despues la clase --open dispare la subida.
      requestAnimationFrame(() => {
        panel.classList.add('ls-sheet--open');
        // Tras la animacion, redimensiona al ultimo tamano recordado (si existe).
        if (sheetHeight) applySheetHeight(panel);
      });
      // El tirador permite agrandar/encoger el panel arrastrandolo.
      enableSheetResize(panel);
      // Si es una tabla vectorial, activa la sincronia mapa->tabla.
      if (vectorTable) bindMapClick();
      return panel;
    }

    // ── Redimensionar el panel desde el tirador ────────────────────────
    // Altura (px) elegida por el usuario; persiste entre aperturas del mismo
    // panel en esta sesion. null = usar la altura por defecto del CSS (60vh).
    let sheetHeight = null;

    function applySheetHeight(panel) {
      if (!panel || !sheetHeight) return;
      const maxH = window.innerHeight - 40; // dejar al menos 40px de mapa visible
      const minH = Math.round(window.innerHeight * 0.2);
      const h = Math.max(minH, Math.min(sheetHeight, maxH));
      panel.style.height = h + 'px';
    }

    // Conecta el arrastre sobre el tirador del panel para cambiar su altura.
    function enableSheetResize(panel) {
      const handle = panel.querySelector('.ls-sheet__handle');
      if (!handle) return;

      const maxH = () => window.innerHeight - 40; // minimo de mapa visible
      const minH = () => Math.round(window.innerHeight * 0.2); // 20% de alto

      function onDown(e) {
        e.preventDefault();
        handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        const startH = panel.getBoundingClientRect().height;
        // Durante el arrastre no animamos el cambio de altura (seria molesto).
        const prevTransition = panel.style.transition;
        panel.style.transition = 'none';
        // Mientras se arrastra, redimensiona con el CRECIMIENTO del panel hacia
        // arriba: arrastrar hacia arriba (clientY menor) AUMENTA la altura.
        function onMove(ev) {
          let h = startH + (startY - ev.clientY);
          h = Math.max(minH(), Math.min(h, maxH()));
          panel.style.height = h + 'px';
        }
        function onUp() {
          sheetHeight = panel.getBoundingClientRect().height;
          panel.style.transition = prevTransition;
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      }

      handle.addEventListener('pointerdown', onDown);
    }

    // ── Sincronia mapa -> tabla ────────────────────────────────────────
    // Mientras la tabla de atributos esta abierta, un clic en un feature del
    // mapa resalta la fila correspondiente de la tabla. Se resuelve el feature
    // pulsado con OpenLayers (forEachFeatureAtPixel) y se compara con los
    // features cacheados de la tabla (por referencia primero, y por concordancia
    // de geometria + primer atributo como comprobacion de robustez).
    function bindMapClick() {
      let impl = null;
      try { impl = map.getMapImpl ? map.getMapImpl() : null; } catch (e) { impl = null; }
      if (!impl || typeof impl.on !== 'function' || typeof impl.forEachFeatureAtPixel !== 'function') return;

      mapClickHandler = function (evt) {
        if (!sheetCtx || !sheetCtx.features.length) return;
        if (!evt || !evt.pixel) return;
        const pixel = evt.pixel;

        // Reunir los features bajo el cursor. layerFilter restringe a la capa
        // del selector (no a overlays temporales tipo el resaltado).
        let hit = [];
        try {
          impl.forEachFeatureAtPixel(pixel, function (feature) {
            hit.push(feature);
          }, {
            hitTolerance: 6,
            layerFilter: function (olLayer) {
              try {
                return sheetCtx.olLayer ? olLayer === sheetCtx.olLayer : true;
              } catch (e) { return true; }
            },
          });
        } catch (e) { hit = []; }
        if (!hit.length) return;

        // Intentar casar el feature pulsado con uno de la tabla.
        const target = hit[0];
        const matchedIdx = matchFeatureToTable(target);
        if (matchedIdx !== -1) {
          // sincronizar SIEMPRE la fila con el feature pulsado (sync mapa -> tabla).
          locateFeatureByIdx(matchedIdx, true);
        }
      };

      // Listener directo del OL impl (no de la fachada IDEE) para no
      // interferir con el resto de la aplicacion.
      impl.addEventListener('singleclick', mapClickHandler);
    }

    function unbindMapClick() {
      if (!mapClickHandler) return;
      let impl = null;
      try { impl = map.getMapImpl ? map.getMapImpl() : null; } catch (e) { impl = null; }
      if (impl && typeof impl.removeEventListener === 'function') {
        impl.removeEventListener('singleclick', mapClickHandler);
      }
      mapClickHandler = null;
    }

    // Compara un feature del mapa (OL) con los features cacheados de la tabla.
    // 1) Por referencia (los objetos suelen ser los mismos). 2) Fallback:
    // concordancia de la geometria (extent) y del primer atributo no vacio.
    function matchFeatureToTable(target) {
      const feats = sheetCtx.features;
      for (let i = 0; i < feats.length; i++) {
        if (feats[i].feature === target) return i;
      }
      // Fallback por geometria/atributos (referencias distintas).
      let tGeom = null, tExt = null, tProp = null;
      try { tGeom = (target.getGeometry ? target.getGeometry() : null); } catch (e) { tGeom = null; }
      try { tExt = tGeom && tGeom.getExtent ? tGeom.getExtent() : null; } catch (e) { tExt = null; }
      try {
        const p = (target.getProperties ? target.getProperties() : null) ||
                  (target.getAttributes ? target.getAttributes() : null);
        if (p) { for (const k in p) { if (p[k] !== undefined && p[k] !== null && p[k] !== '') { tProp = p[k]; break; } } }
      } catch (e) { /* ignorar */ }

      for (let i = 0; i < feats.length; i++) {
        const c = feats[i];
        // Geometria coincidente.
        if (tExt && c.extent) {
          const close = Math.abs(tExt[0] - c.extent[0]) < 1e-6 &&
                        Math.abs(tExt[1] - c.extent[1]) < 1e-6 &&
                        Math.abs(tExt[2] - c.extent[2]) < 1e-6 &&
                        Math.abs(tExt[3] - c.extent[3]) < 1e-6;
          if (close) {
            // Si hay atributo coincidente, reforzamos; si no, aun asi ok.
            if (tProp === undefined || tProp === null || c.firstProp === undefined || c.firstProp === null) return i;
            if (String(tProp) === String(c.firstProp)) return i;
          }
        }
      }
      return -1;
    }

    // ── Resaltado del feature seleccionado en el mapa ──────────────────
    // Crea (una sola vez) una capa vectorial temporal y la popola con la
    // geometria del feature resaltado. Se añade por encima de todas las capas.
    function clearHighlight() {
      if (selLayer && map) {
        try {
          map.removeLayers(selLayer);
          selLayer = null;
        } catch (e) {
          selLayer = null;
        }
      }
      highlightRow(-1);
    }

    // Localiza un feature concreto (por indice de fila) en el mapa: centra la
    // vista en su geometria y lo resalta. Marca siempre su fila como activa,
    // tanto si la peticion viene de la tabla (clic en fila) como del mapa
    // (clic en el feature), manteniendo la sincronia bidireccional.
    function locateFeatureByIdx(idx) {
      if (!sheetCtx || !sheetCtx.features.length) return;
      const item = sheetCtx.features[idx];
      if (!item) return;
      const geom = item.geometry;
      if (!geom) return;

      // Encuadrar / centrar la vista sobre la geometria.
      let center = null, extent = null;
      try { extent = geom.getExtent ? geom.getExtent() : null; } catch (e) { extent = null; }
      try { if (extent) center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]; } catch (e) { /* ignorar */ }

      const impl = map.getMapImpl ? map.getMapImpl() : null;
      const view = (impl && typeof impl.getView === 'function') ? impl.getView() : null;
      if (view && typeof view.fit === 'function' && extent) {
        try { view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 14 }); } catch (e) { /* ignorar */ }
      } else if (view && center) {
        try { view.setCenter(center); } catch (e) { /* ignorar */ }
      } else if (!view) {
        try {
          if (extent && typeof map.setBbox === 'function') map.setBbox(extent);
          else if (center && typeof map.setCenter === 'function') map.setCenter({ x: center[0], y: center[1] });
          if (typeof map.setZoom === 'function') {
            const z = (typeof map.getZoom === 'function') ? map.getZoom() : undefined;
            if (z !== undefined) map.setZoom(Math.min(z + 1, 14));
          }
        } catch (e) { /* ignorar */ }
      }

      // Montar la capa de resaltado con la feature cacheada. Se usa el estilo
      // generico de API-IDEE (funciona en la implementacion OpenLayers 2D y en
      // la de Cesium 3D, que es como el resto del plugin dibuja sus features).
      clearHighlight();
      try {
        const style = new IDEE.style.Generic({
          stroke: { color: '#ffd400', width: 5 },
          fill: { color: '#ffd400', opacity: 0 },
          point: { radius: 8, fill: { color: '#ffd400', opacity: 0 }, stroke: { color: '#ffd400', width: 5 } },
        });
        selLayer = new IDEE.layer.Vector(
          {
            name: 'layerSwitcher_highlight',
            displayInLayerSwitcher: false,
            source: { features: [item.feature] },
            style: style,
          },
          // Las opciones del impl (2º argumento) gobiernan el layerSwitcher:
          // al poner displayInLayerSwitcher:false aqui la capa temporal NO
          // aparece en el listado de capas del plugin.
          { displayInLayerSwitcher: false }
        );
        // Refuerzo: Mapea tambien registra la capa OpenLayers interna. Forzamos
        // alli el mismo flag para que ninguna implementacion (lista custom o el
        // selector nativo de Mapea) muestre esta capa temporal como layer_<ts>.
        try {
          const olLayer = selLayer.getImpl && selLayer.getImpl().olLayer;
          if (olLayer && typeof olLayer.set === 'function') {
            olLayer.set('displayInLayerSwitcher', false);
          }
        } catch (e) { /* defensivo */ }
        map.addLayers(selLayer);
        // IMPORTANTE: ni el 1er argumento (source.features) ni addFeatures() de
        // la fachada pueblan la fuente OpenLayers que realmente renderiza el
        // mapa (la dejan vacia y el resaltado no se veria). Se inserta el
        // feature cacheado directamente en la fuente OpenLayers cuando existe.
        // Cada operacion va en su PROPIO try/catch: addFeatures de la fachada
        // puede lanzar (espera features con .getImpl(), y las de MapLibre —
        // convertidas desde querySourceFeatures — no lo tienen), y ese fallo no
        // debe impedir la propagacion a la fuente OpenLayers nativa.
        try {
          if (typeof selLayer.addFeatures === 'function' && item.feature) {
            selLayer.addFeatures([item.feature]);
          }
        } catch (e) { /* addFeatures de la fachada no critico: seguir */ }
        // Propaga el feature a la fuente OpenLayers nativa (la que dibuja).
        try {
          const olLayer = selLayer.getImpl && selLayer.getImpl().olLayer;
          const olSource = olLayer && olLayer.getSource ? olLayer.getSource() : null;
          if (olSource && typeof olSource.addFeature === 'function' && item.feature) {
            const feats = typeof olSource.getFeatures === 'function' ? olSource.getFeatures() : [];
            if (!feats.some(function (f) { return f === item.feature; })) {
              olSource.addFeature(item.feature);
            }
          }
        } catch (e) { /* defensivo */ }
        // Refresca el listado del selector para que la capa temporal (oculta
        // con displayInLayerSwitcher:false) ya no aparezca entre las capas.
        renderLayerList();
      } catch (e) {
        console.warn('layerSwitcher: no se pudo resaltar el feature', e);
      }

      highlightRow(idx);
    }

    // Api publica: localiza el feature de la fila en el mapa (tabla -> mapa).
    window.locateFeature = function (index, rowIdx) {
      const idx = Math.max(0, Number(rowIdx) || 0);
      // Si la tabla actual pertenece a esta capa y ya tenemos features cacheados.
      if (sheetCtx && String(sheetCtx.layerId) === String(index) && sheetCtx.features.length) {
        locateFeatureByIdx(idx, true);
        return;
      }
      // Fallback: recuperar features de la capa al vuelo.
      const layer = findLayerById(index);
      if (!layer) return;
      let features = [];
      try {
        if (typeof layer.getFeatures === 'function') features = layer.getFeatures() || [];
        else if (layer.getImpl() && typeof layer.getImpl().getFeatures === 'function') features = layer.getImpl().getFeatures() || [];
      } catch (e) { features = []; }
      if (!features.length) return;
      const f = features[Math.min(idx, features.length - 1)];
      let geom = null;
      try { geom = (f.getGeometry ? f.getGeometry() : null) || (f.getImpl && f.getImpl().getGeometry ? f.getImpl().getGeometry() : null); } catch (e) { geom = null; }
      if (!geom) return;
      const item = { feature: f, geometry: geom, extent: (geom.getExtent ? geom.getExtent() : null) };
      const prevCtx = sheetCtx;
      sheetCtx = { layerId: index, features: [item], firstProp: '' };
      locateFeatureByIdx(0, true);
      sheetCtx = prevCtx;
    };

    // Escapa texto plano para inyectarlo sin riesgo en el HTML del panel.
    function esc(v) {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ── Tabla de atributos de capa VECTORIAL ───────────────────────────
    function buildVectorTable(layer) {
      // Referencia a la capa OpenLayers que realmente dibuja los features.
      // Sus features de la fuente exponen geometrias y propiedades OL reales
      // (getGeometry().getType(), getExtent(), getProperties()) y son los MISMOS
      // objetos que devuelve forEachFeatureAtPixel, lo que permite casar por
      // referencia en la sincronia mapa->tabla.
      let olLayer = null;
      try {
        olLayer = (layer.getOLayer && layer.getOLayer()) ||
                  (layer.getImpl && layer.getImpl().getOLayer && layer.getImpl().getOLayer()) ||
                  (layer.getImpl && layer.getImpl().getLayer && layer.getImpl().getLayer()) ||
                  (layer.getImpl && layer.getImpl().layer) ||
                  (layer.getImpl && layer.getImpl().olLayer) || null;
      } catch (e) { olLayer = null; }

      let features = [];
      // 1) Preferencia: features reales de la fuente OpenLayers (geometrias OL
      //    con getType/getExtent validos y getProperties()), que garantizan el
      //    encuadre y el resaltado.
      try {
        if (olLayer && olLayer.getSource && typeof olLayer.getSource().getFeatures === 'function') {
          features = olLayer.getSource().getFeatures() || [];
        }
      } catch (e) { features = []; }

      // 2) Fallback: features de la capa IDEE (getFeatures() / getImpl). Pueden
      //    no exponer geometrias OL completas, pero aun asi permiten la tabla.
      if (!features.length) {
        try {
          if (typeof layer.getFeatures === 'function') features = layer.getFeatures() || [];
          else if (layer.getImpl() && typeof layer.getImpl().getFeatures === 'function') features = layer.getImpl().getFeatures() || [];
        } catch (e) { features = []; }
      }

      // Nombre de la capa.
      const layerName = layer.legend || layer.name || 'Capa';
      const featCount = features.length;
      if (!featCount) {
        sheetCtx = null;
        return `<p style="padding:8px;color:#555;">La capa <b>${esc(layerName)}</b> no tiene features disponibles en el cliente (los datos pueden cargarse de forma remota).</p>`;
      }

      // Reunir el conjunto de columnas a partir de los atributos.
      // Los features OL exponen getProperties(); los de API-IDEE, getAttributes().
      const columns = [];
      const rows = features.slice(0, 500).map(f => {
        let props = {};
        try {
          props = (f.getProperties ? f.getProperties() : null) ||
                  (f.getAttributes ? f.getAttributes() : null) || {};
        } catch (e) { /* sin atributos */ }
        if (typeof props !== 'object' || props === null) props = {};
        const geom = (f.getGeometry ? f.getGeometry() : null);
        for (const key in props) {
          if (!columns.includes(key)) columns.push(key);
        }
        return { props, geom, feature: f };
      });

      // Asegurar columnas utiles aunque no haya propiedades.
      if (!columns.length) columns.push('(sin atributos)');

      // Cachear los features (orden = filas de la tabla) para la sincronia
      // bidireccional tabla<->mapa. Se almacena la geometria OL (si existe) y
      // el primer atributo no vacio para poder casar un feature del mapa.
      const cached = rows.map((row, i) => {
        let extent = null;
        try { extent = row.geom && row.geom.getExtent ? row.geom.getExtent() : null; } catch (e) { extent = null; }
        let firstProp = null;
        for (const c of columns) {
          const v = row.props[c];
          if (v !== undefined && v !== null && v !== '' && c !== '(sin atributos)') { firstProp = v; break; }
        }
        return { feature: row.feature, geometry: row.geom, extent, firstProp, idx: i };
      });
      sheetCtx = {
        layerId: layer.idLayer,
        features: cached,
        olLayer: olLayer,
      };

      // idLayer necesario para localizar el feature en el mapa al pulsar la fila.
      const layerId = (typeof layer.idLayer !== 'undefined') ? layer.idLayer : '';

      let html = `<table class="ls-attr-table"><thead><tr>`;
      html += `<th>#</th>`;
      for (const c of columns) html += `<th>${esc(c)}</th>`;
      html += `</tr></thead><tbody>`;
      rows.forEach((row, i) => {
        // Cada fila es clicable: localiza y resalta el feature en el mapa.
        html += `<tr class="ls-clickable" data-row-idx="${i}" title="Localizar este elemento en el mapa" onclick="locateFeature('${layerId}', '${i}')">`;
        html += `<td>${i + 1}</td>`;
        for (const c of columns) {
          html += `<td>${esc(row.props[c] === undefined ? (c === '(sin atributos)' && row.props ? '—' : '') : row.props[c])}</td>`;
        }
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      const shown = rows.length;
      const more = featCount > shown ? `<p class="ls-sheet-note">Mostrando ${shown} de ${featCount} features.</p>` : `<p class="ls-sheet-note">${featCount} features (${columns.length} atributos).</p>`;
      return `${more}${html}`;
    }

    // ── Capas MapLibre / vector-tiles (p.ej. BTN) ─────────────────────
    // Estas capas NO almacenan sus features en una fuente OpenLayers (como
    // GeoJSON/WFS): se renderizan desde tiles vectoriales MapLibre y los
    // features solo estan disponibles (via querySourceFeatures) para las
    // tiles que caen dentro del viewport actual del mapa. Por eso no se puede
    // mostrar una "tabla con todos los features" de golpe; en su lugar se
    // listan las SUB-CAPAS GL del estilo (sus "source-layers") y, al elegir
    // una, se muestran los atributos de los features presentes en la vista.
    function getMapLibreMap(layer) {
      try {
        const impl = layer.getImpl ? layer.getImpl() : null;
        const ol = impl && impl.olLayer;
        if (ol && ol.mapLibreMap) return ol.mapLibreMap;
      } catch (e) { /* no es MapLibre */ }
      return null;
    }

    // Detecta si una capa es de tiles vectoriales MapLibre (dos pasos:
    // tipo de capa y presencia de una instancia maplibre con estilo).
    function isMapLibreLayer(layer) {
      const t = String(layer.type || layer._type || '').toLowerCase();
      if (!(t === 'maplibre' || t === 'mapbox')) return false;
      const ml = getMapLibreMap(layer);
      return !!ml && typeof ml.getStyle === 'function';
    }

    // Espera (con tope) a que el estilo MapLibre este cargado por completo.
    // El estilo de BTN es enorme (>300 capas) y tarda en cargarse.
    function awaitMapLibreStyle(ml, ms) {
      return new Promise(function (resolve) {
        const deadline = Date.now() + (ms || 12000);
        const poll = function () {
          const ready = (function () {
            try {
              const style = ml.getStyle();
              return !!(style && Array.isArray(style.layers) && style.layers.length && style.sources);
            } catch (e) { return false; }
          })();
          if (ready || Date.now() > deadline) return resolve(ready || false);
          setTimeout(poll, 400);
        };
        poll();
      });
    }

    // Devuelve un OL Feature (geometrias OL con getExtent/getType) a partir de
    // un feature GeoJSON devuelto por querySourceFeatures de MapLibre. Asi se
    // puede resaltar/mostrar con la misma logica que el resto de capas.
    function geoJsonToOlFeature(gjFeature) {
      try {
        const fmt = new (window.ol && window.ol.format && window.ol.format.GeoJSON)();
        const feat = fmt.readFeature(gjFeature, { featureProjection: 'EPSG:3857' });
        if (feat && feat.getGeometry && typeof feat.getGeometry === 'function') return feat;
      } catch (e) { /* convertir fallo */ }
      return null;
    }

    // ── Paso 1 de una capa MapLibre: sub-capas GL ─────────────────────
    // Recopila las sub-capas (source-layers) de la fuente vectorial del estilo
    // junto con su tipo y el numero de features visibles en el viewport actual.
    // Devuelve una estructura plana [{sourceId, sourceLayer, types, count}].
    async function getMapLibreSubStack(layer) {
      const ml = getMapLibreMap(layer);
      if (!ml) return [];
      const ready = await awaitMapLibreStyle(ml);
      if (!ready) return [];

      let layers = [], vectorSources = [];
      try {
        const style = ml.getStyle();
        layers = style.layers || [];
        for (const k in (style.sources || {})) {
          if (style.sources[k] && String(style.sources[k].type) === 'vector') vectorSources.push(k);
        }
      } catch (e) { return []; }
      if (!vectorSources.length) return [];

      // Agrupar las capas GL por su fuente vectorial y por "source-layer".
      const groups = {}; // sourceId -> map(sourceLayer -> {types:[]})
      for (const L of layers) {
        if (!L || !L.source) continue;
        if (vectorSources.indexOf(L.source) < 0) continue;
        const sl = L['source-layer'] || '(sin source-layer)';
        if (!groups[L.source]) groups[L.source] = {};
        if (!groups[L.source][sl]) groups[L.source][sl] = { types: [] };
        const g = groups[L.source][sl];
        if (g.types.indexOf(L.type) < 0) g.types.push(L.type);
      }

      const stack = [];
      for (const sourceId of vectorSources) {
        const subLayers = Object.keys(groups[sourceId] || {}).sort();
        for (const sl of subLayers) {
          let count = 0;
          try { count = (ml.querySourceFeatures(sourceId, { sourceLayer: sl }) || []).length; } catch (e) { /* mantener 0 */ }
          stack.push({ sourceId: sourceId, sourceLayer: sl, types: groups[sourceId][sl].types, count: count });
        }
      }
      return stack;
    }

    // Instala el dropdown (secundario) de sub-capas en el header del sidenav de
    // una capa MapLibre y conecta el cambio de seleccion con la tabla del body.
    // Al elegir una sub-capa se actualiza SOLO el cuerpo, manteniendo abierto el
    // panel y el primer dropdown de capas.
    function installMapLibreSubPicker(panel, layer, body) {
      const headLeft = panel.querySelector('.ls-sheet-header-left');
      const picker = document.createElement('select');
      picker.className = 'ls-sheet-sublayer-picker';
      picker.setAttribute('aria-label', 'Sub-capa');
      picker.disabled = true;
      picker.innerHTML = '<option>Cargando sub-capas…</option>';
      const titleEl = panel.querySelector('.ls-sheet-title');
      if (headLeft && titleEl) headLeft.insertBefore(picker, titleEl);

      const setBody = (sid, sl) => { body.innerHTML = buildMapLibreFeaturesTable(layer, sid, sl); };

      getMapLibreSubStack(layer).then(function (stack) {
        if (!stack.length) {
          picker.remove();
          body.innerHTML = `<p style="padding:8px;color:#555;">La capa <b>${esc(layer.legend || layer.name || 'Capa')}</b> no expone sub-capas consultables en el estilo.</p>`;
          return;
        }
        picker.disabled = false;
        picker.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = '— Selecciona una sub-capa —';
        picker.appendChild(ph);
        stack.forEach(function (item) {
          const o = document.createElement('option');
          o.value = `${item.sourceId}::${item.sourceLayer}`;
          o.textContent = item.sourceLayer + (item.count > 0 ? ` (${item.count})` : '');
          picker.appendChild(o);
        });
        picker.onchange = function () {
          const v = picker.value.split('::');
          if (v.length === 2) setBody(v[0], v[1]);
        };
        // Mostrar automaticamente la primera sub-capa con features en la vista.
        const withData = stack.filter(function (i) { return i.count > 0; });
        const first = withData.length ? withData[0] : stack[0];
        picker.value = `${first.sourceId}::${first.sourceLayer}`;
        setBody(first.sourceId, first.sourceLayer);
      }).catch(function () {
        picker.remove();
        body.innerHTML = `<p style="padding:8px;color:#555;">No se pudieron cargar las sub-capas de <b>${esc(layer.legend || layer.name || 'Capa')}</b>.</p>`;
      });
    }

    // ── Paso 2 de una capa MapLibre: tabla de atributos de una sub-capa ──
    // Consulta los features de un source-layer concreto dentro del viewport
    // (querySourceFeatures) y construye la tabla de atributos, cacheandolos
    // como OL features para permitir el resaltado al pulsar una fila.
    function buildMapLibreFeaturesTable(layer, sourceId, sourceLayer) {
      const layerName = layer.legend || layer.name || 'Capa';
      const ml = getMapLibreMap(layer);
      let gjFeatures = [];
      try {
        gjFeatures = ml.querySourceFeatures(sourceId, { sourceLayer: sourceLayer }) || [];
      } catch (e) { gjFeatures = []; }
      if (!gjFeatures.length) {
        return `<p style="padding:8px;color:#555;">No hay features de <b>${esc(sourceLayer)}</b> en el viewport actual del mapa. Acércate (zoom) o desplázate a una zona con datos y vuelve a pulsar la sub-capa.</p>`;
      }

      // Derivar columnas a partir de las propiedades (GeoJSON).
      const columns = [];
      const rows = gjFeatures.slice(0, 500).map(function (gj) {
        const props = (gj && gj.properties && typeof gj.properties === 'object') ? gj.properties : {};
        const ol = geoJsonToOlFeature(gj);
        for (const k in props) { if (!columns.includes(k)) columns.push(k); }
        return { props: props, feature: ol, geometry: ol && ol.getGeometry ? ol.getGeometry() : null };
      });
      if (!columns.length) columns.push('(sin atributos)');

      // Cachear en sheetCtx (misma estructura que buildVectorTable) para que
      // locateFeatureByIdx resalte el feature convenido al pulsar la fila.
      const cached = rows.map(function (row, i) {
        let extent = null;
        try { extent = row.geometry && row.geometry.getExtent ? row.geometry.getExtent() : null; } catch (e) { extent = null; }
        let firstProp = null;
        for (const c of columns) {
          const v = row.props[c];
          if (v !== undefined && v !== null && v !== '' && c !== '(sin atributos)') { firstProp = v; break; }
        }
        return { feature: row.feature, geometry: row.geometry, extent: extent, firstProp: firstProp, idx: i };
      });
      sheetCtx = { layerId: layer.idLayer, features: cached, olLayer: null };

      const layerId = (typeof layer.idLayer !== 'undefined') ? layer.idLayer : '';
      let html = `<p class="ls-sheet-note" style="margin-top:0;">Sub-capa <b>${esc(sourceLayer)}</b> · ${rows.length} features del viewport.</p>`;
      html += `<table class="ls-attr-table"><thead><tr><th>#</th>`;
      for (const c of columns) html += `<th>${esc(c)}</th>`;
      html += `</tr></thead><tbody>`;
      rows.forEach(function (row, i) {
        html += `<tr class="ls-clickable" data-row-idx="${i}" title="Localizar este elemento en el mapa" onclick="locateFeature('${layerId}', '${i}')">`;
        html += `<td>${i + 1}</td>`;
        for (const c of columns) {
          const v = row.props[c];
          html += `<td>${esc(v === undefined || v === null ? (c === '(sin atributos)' ? '—' : '') : v)}</td>`;
        }
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      return html;
    }

    // ── Estadisticas de capa RASTER ────────────────────────────────────
    function buildRasterInfo(layer) {
      const layerName = layer.legend || layer.name || 'Capa';
      let transparency = 0;
      try { transparency = Math.round((1 - (layer.getOpacity ? layer.getOpacity() : 1)) * 100); } catch (e) { /* ignorar */ }

      // Reunir datos del impl / source para metadatos opcionales.
      let info = null, source = null;
      try {
        const impl = layer.getImpl ? layer.getImpl() : null;
        info = (impl && impl.info) ? impl.info : null;
        source = (impl && typeof impl.getSource === 'function') ? impl.getSource() : null;
      } catch (e) { /* sin impl */ }

      // Numero de bandas: solo si el impl.info lo expone directamente
      // (p.ej. GeoTIFF/MBTiles locales). En servicios WMS/WMTS no hay una
      // API nativa, asi que no se inventa el valor.
      let bandsHtml = '<li><span class="ls-stat-label">Bandas</span><span class="ls-stat-value">(no disponible para este servicio)</span></li>';
      try {
        if (info && Array.isArray(info.bands) && info.bands.length) {
          bandsHtml = `<li><span class="ls-stat-label">Bandas</span><span class="ls-stat-value">${info.bands.length}</span></li>`;
        } else if (source && typeof source.getBandCount === 'function' && source.getBandCount() > 0) {
          bandsHtml = `<li><span class="ls-stat-label">Bandas</span><span class="ls-stat-value">${source.getBandCount()}</span></li>`;
        }
      } catch (e) { /* ignorar */ }

      let sizeHtml = '';
      try {
        if (info && Array.isArray(info.size) && info.size.length === 2) {
          sizeHtml = `<li><span class="ls-stat-label">Tamaño</span><span class="ls-stat-value">${info.size[0]} x ${info.size[1]} px</span></li>`;
        }
      } catch (e) { /* ignorar */ }

      // GeoRSS / tipo del impl para mostrarlo como subtitulo.
      let typeInfo = '';
      try { typeInfo = String(layer.type || layer._type || (layer.getImpl && layer.getImpl().type) || ''); } catch (e) { /* ignorar */ }

      return `
        <p class="ls-sheet-note" style="margin-top:0;">Estadísticas de la capa ráster.</p>
        <ul class="ls-stat-list">
          <li><span class="ls-stat-label">Nombre</span><span class="ls-stat-value">${esc(layerName)}</span></li>
          <li><span class="ls-stat-label">Tipo</span><span class="ls-stat-value">${esc(typeInfo || 'ráster')}</span></li>
          <li><span class="ls-stat-label">Transparencia</span><span class="ls-stat-value">${transparency}%</span></li>
          ${bandsHtml}
          ${sizeHtml}
        </ul>`;
    }

    // ── Abrir informacion de la capa ───────────────────────────────────
    // Abre el panel inferior (sidenav) con la tabla de atributos (vectorial) o
    // las estadisticas (raster). En su header se incluye un dropdown con todas
    // las capas seleccionables para poder cambiar de capa sin cerrar el panel.
    window.openLayerInfo = function (index, fromPicker) {
      const layer = findLayerById(index);
      if (!layer) return;
      const kind = window.getLayerKind(layer);
      const layerName = layer.legend || layer.name || 'Capa';
      // Cierra cualquier panel previo ANTES de construir el nuevo: el builder
      // (buildVectorTable) puebla sheetCtx y openSheet ya no debe resetearlo.
      closeSheet();
      // Capas seleccionables para el dropdown del header (asincrono).
      const finish = (selectableLayers) => {
        if (kind === 'vector') {
          // Las capas MapLibre (BTN) no tienen una fuente OL enumerable: se abre
          // el panel y se instala un dropdown secundario con sus sub-capas. El
          // builder es asincrono (espera a que cargue el estilo), asi que se
          // abre el cuerpo vacio y se rellena al cargar.
          if (isMapLibreLayer(layer)) {
            const panel = openSheet(`Tabla de atributos · ${layerName}`, '<p style="padding:8px;color:#555;">Cargando sub-capas…</p>', true, selectableLayers, index);
            installMapLibreSubPicker(panel, layer, panel.querySelector('.ls-sheet-body'));
            return;
          }
          openSheet(`Tabla de atributos · ${layerName}`, buildVectorTable(layer), true, selectableLayers, index);
        } else {
          sheetCtx = null;
          openSheet(`Estadísticas · ${layerName}`, buildRasterInfo(layer), false, selectableLayers, index);
        }
      };
      // Si venimos del dropdown del propio header, las capas ya no han cambiado:
      // se reutiliza la lista cargada (evita re-consultar en cada cambio).
      if (fromPicker && window._lsPickerLayers) {
        finish(window._lsPickerLayers);
      } else {
        // El dropdown del sidenav SOLO lista capas vectoriales: las raster no
        // tienen tabla de atributos y no aportan nada en el selector.
        getSelectableLayers().then(ls => {
          const vectorLayers = (ls || []).filter(l => window.getLayerKind(l) === 'vector');
          window._lsPickerLayers = vectorLayers;
          finish(vectorLayers);
        });
      }
    };

    // Update the list whenever a layer is added to the map
    try {
      if (map && typeof map.on === 'function' && IDEE && IDEE.evt) {
        map.on(IDEE.evt.ADDED_LAYER, async (capas) => {
          await renderLayerList();
        });
      }
    } catch (e) {
      console.warn('layerSwitcher: could not attach ADDED_LAYER listener', e);
    }

    control.activate();
  }
}

if (typeof window !== 'undefined') {
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_layerSwitcher = miPlugin_layerSwitcher;
}

