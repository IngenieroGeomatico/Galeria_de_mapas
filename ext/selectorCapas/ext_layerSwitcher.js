// Reemplazamos la API basada en variables globales por una clase-plugin
class miPlugin_layerSwitcher {
  constructor(options = {}) {
    this.name = 'miPlugin_layerSwitcher';
    this.options = options || {};
    // idLayer de la capa cuyo desplegable de opciones (transparencia) está
    // abierto. Se conserva entre re-renders para no cerrarlo al alternar
    // la visibilidad de otra capa.
    this._optionsOpen = null;
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
    const panelSelector = document.querySelector('.g-herramienta_selectorCapa .m-panel-controls');
    if (panelSelector) panelSelector.innerHTML = htmlPanel;
    const contents = document.querySelector('#m-herramienta-contents-layerSwitcher');
    if (contents) contents.appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-layerSwitcher');

    // Capas seleccionables desde el selector (compartido entre el panel y el
    // dropdown del sidenav de la tabla de atributos). Se excluyen capas
    // temporales/auxiliares (p.ej. el resaltado del panel) marcadas con
    // displayInLayerSwitcher:false, las de terreno, y las capas internas
    // auto-generadas por Mapea (nombre "layer_<n>").
    const getSelectableLayers = async () => {
      const allLayers = await map.getOverlayLayers();
      return (allLayers || []).filter(l => {
        try {
          const direct = l && l.displayInLayerSwitcher;
          const impl = (l && typeof l.getImpl === 'function') ? l.getImpl() : null;
          const implFlag = impl && impl.displayInLayerSwitcher;
          if (direct === false || implFlag === false) return false;
          if (l && (l._type === 'Terrain' || l.type === 'Terrain')) return false;
          const nm = (l && (l.name || l.legend)) || '';
          if (/^layer_\d+$/.test(nm)) return false;
          return true;
        } catch (e) { return true; }
      });
    };

    const renderLayerList = async () => {
      try {
        const visibleLayers = await getSelectableLayers();
        const htmlList = visibleLayers.map(layer => {
          const layerName = layer.legend || layer.name || 'Sin nombre';
          const index = layer.idLayer;
          const visible = layer.isVisible ? layer.isVisible() : true;
          // icono de ojo: abierto = capa visible, tachado/cerrado = oculta
          const eyeIcon = visible ? '👁' : '🚫';
          // Transparencia actual en % (100 = totalmente transparente).
          // La API usa opacidad 0..1, asi que transparencia = (1 - opacity).
          let opacity = 1;
          try { if (layer.getOpacity !== undefined) opacity = layer.getOpacity() || 0; } catch (e) { /* ignorar */ }
          const transpPct = Math.round((1 - opacity) * 100);
          const optionsOpen = this._optionsOpen === index;
          // Gradiente del track del slider: representa la OPACIDAD (lo que
          // queda visible). 0% de transparencia (opaco) => relleno hasta la
          // derecha (100%); 100% de transparencia => riel vacio (0%).
          const fillPct = 100 - transpPct;
          const sliderFill = `linear-gradient(to right, #0078d4 0%, #0078d4 ${fillPct}%, #d7dde7 ${fillPct}%, #d7dde7 100%)`;
          return `
            <li>
              <label>
                <span class="ls-nombre">${layerName}</span>
                <button type="button" class="ls-eye ${visible ? 'ls-eye-on' : 'ls-eye-off'}" data-id="${index}" title="${visible ? 'Ocultar capa' : 'Mostrar capa'}" onclick="toggleLayerVisibility('${index}')">${eyeIcon}</button>
                <button type="button" class="ls-options ${optionsOpen ? 'ls-options-open' : ''}" data-id="${index}" title="Opciones de la capa" onclick="toggleLayerOptions('${index}')">▾</button>
              </label>
              <div class="ls-options-panel ${optionsOpen ? 'open' : ''}">
                <div class="ls-option-row">
                  <span class="ls-option-label" title="Transparencia de la capa">Transparencia</span>
                  <input type="range" min="0" max="100" value="${transpPct}" class="ls-opacity-slider" style="background:${sliderFill}" aria-label="Transparencia de ${layerName}" oninput="setLayerOpacity('${index}', this.value, this)">
                  <span class="ls-option-value">${transpPct}%</span>
                </div>
                <div class="ls-actions-row">
                  <button type="button" class="ls-action ls-action-info" data-id="${index}" title="Ver tabla de atributos / estadísticas de la capa" onclick="openLayerInfo('${index}')">📋 <span>Tabla</span></button>
                  <button type="button" class="ls-action ls-action-delete" data-id="${index}" title="Eliminar la capa del mapa" onclick="deleteLayer('${index}')">🗑 <span>Borrar</span></button>
                </div>
              </div>
            </li>`;
        }).join('');

        control.htmlView = `<ul class="overlay-layer-selector">${htmlList}</ul>`;
        const preview = document.querySelector('#m-herramienta-previews-layerSwitcher');
        if (preview) preview.innerHTML = control.htmlView;
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
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      if (!layer || typeof layer.setVisible !== 'function') return;

      // El ojito es el unico control de visibilidad: alterna la capa de forma
      // independiente (varias capas pueden estar visibles a la vez).
      layer.setVisible(!layer.isVisible());
      // Actualiza el ojito (estado visible/oculto) tras el cambio.
      if (window.renderLayerList && typeof window.renderLayerList === 'function') {
        window.renderLayerList();
      } else if (layer && layer.isVisible) {
        const eye = document.querySelector('.g-herramienta_selectorCapa .ls-eye[data-id="' + index + '"]');
        const visible = layer.isVisible();
        if (eye) {
          eye.textContent = visible ? '👁' : '🚫';
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

    // ── Borrar capa ─────────────────────────────────────────────────────
    // Elimina la capa del mapa y refresca la lista. La referencia se busca
    // de la misma forma que en el resto de handlers (por idLayer).
    window.deleteLayer = function (index) {
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      if (!layer) return;
      try {
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
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
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
          stroke: { color: '#e31a1c', width: 4 },
          fill: { color: '#e31a1c', opacity: 0.25 },
          point: { radius: 8, fill: { color: '#e31a1c' }, stroke: { color: '#ffffff', width: 2 } },
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
        try {
          if (typeof selLayer.addFeatures === 'function' && item.feature) {
            selLayer.addFeatures([item.feature]);
          }
          // Propaga el feature a la fuente OpenLayers nativa (la que dibuja).
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
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
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

    // Etiqueta legible para el tipo geometrico de una sub-capa GL.
    function mapLibreTypeLabel(types) {
      const labels = [];
      if (types.indexOf('symbol') >= 0 || types.indexOf('circle') >= 0) labels.push('Punto');
      if (types.indexOf('line') >= 0) labels.push('Línea');
      if (types.indexOf('fill') >= 0 || types.indexOf('fill-extrusion') >= 0) labels.push('Área');
      if (!labels.length) labels.push('Otro');
      return labels.join(' / ');
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

    // ── Paso 1 de una capa MapLibre: indice de sub-capas GL ───────────
    // Muestra la lista de "source-layers" de la fuente vectorial del estilo
    // con su tipo y el numero de features visibles en el viewport actual.
    async function buildMapLibreTable(layer) {
      const layerName = layer.legend || layer.name || 'Capa';
      const ml = getMapLibreMap(layer);
      if (!ml) {
        return `<p style="padding:8px;color:#555;">No se pudo acceder al render de la capa <b>${esc(layerName)}</b>.</p>`;
      }
      const ready = await awaitMapLibreStyle(ml);
      if (!ready) {
        return `<p style="padding:8px;color:#555;">El estilo de la capa <b>${esc(layerName)}</b> aún se está cargando. Vuelve a pulsar «Tabla» en unos segundos.</p>`;
      }

      let style = null, vectorSources = [], layers = [];
      try {
        style = ml.getStyle();
        layers = style.layers || [];
        for (const k in (style.sources || {})) {
          if (style.sources[k] && String(style.sources[k].type) === 'vector') vectorSources.push(k);
        }
      } catch (e) { /* estilo ilegible */ }
      if (!vectorSources.length) {
        return `<p style="padding:8px;color:#555;">La capa <b>${esc(layerName)}</b> no expone fuentes vectoriales consultables.</p>`;
      }

      // Agrupar las capas GL por su fuente vectorial y por "source-layer".
      // Cada source-layer equivale a una sub-capa temática del estilo BTN.
      const groups = {}; // sourceId -> map(sourceLayer -> {types:Set})
      for (const L of layers) {
        if (!L || !L.source) continue;
        if (vectorSources.indexOf(L.source) < 0) continue;
        const sl = L['source-layer'] || '(sin source-layer)';
        if (!groups[L.source]) groups[L.source] = {};
        if (!groups[L.source][sl]) groups[L.source][sl] = { types: [] };
        const g = groups[L.source][sl];
        if (g.types.indexOf(L.type) < 0) g.types.push(L.type);
      }
      let anySubLayer = false;
      for (const s of vectorSources) { if (groups[s] && Object.keys(groups[s]).length) { anySubLayer = true; break; } }
      if (!anySubLayer) {
        return `<p style="padding:8px;color:#555;">La capa <b>${esc(layerName)}</b> no expone sub-capas consultables en el estilo.</p>`;
      }

      // Calcular el numero de features del viewport para cada sub-capa (tolerante).
      const counts = {};
      for (const sourceId of vectorSources) {
        for (const sl in groups[sourceId]) {
          counts[sourceId + '::' + sl] = 0;
          try {
            counts[sourceId + '::' + sl] = ml.querySourceFeatures(sourceId, { sourceLayer: sl }).length;
          } catch (e) { /* mantener 0 */ }
        }
      }

      const layerId = (typeof layer.idLayer !== 'undefined') ? layer.idLayer : '';
      let html = `<p class="ls-sheet-note" style="margin-top:0;">Sub-capas de <b>${esc(layerName)}</b> (tiles vectoriales · ${esc(style.name || '')}): los features listados son los del <b>viewport actual</b> del mapa.</p>`;
      for (const sourceId of vectorSources) {
        const subLayers = Object.keys(groups[sourceId]).sort();
        if (!subLayers.length) continue;
        html += `<p class="ls-sheet-note" style="margin:6px 0 2px;font-weight:600;color:#444;">Fuente: ${esc(sourceId)}</p>`;
        html += `<ul class="ls-mapLibre-sublist">`;
        for (const sl of subLayers) {
          const c = counts[sourceId + '::' + sl] || 0;
          const g = groups[sourceId][sl];
          html += `<li>
            <button type="button" class="ls-ml-sublayer" data-id="${esc(layerId)}" data-source="${esc(sourceId)}" data-slayer="${esc(sl)}" onclick="openMapLibreSubLayer('${esc(layerId)}','${esc(sourceId)}','${esc(sl)}')" title="Ver tabla de atributos de '${esc(sl)}'">
              <span class="ls-ml-name">${esc(sl)}</span>
              <span class="ls-ml-type">${esc(mapLibreTypeLabel(g.types))}</span>
              <span class="ls-ml-count" title="Features en el viewport actual">${c} en vista</span>
            </button>
          </li>`;
        }
        html += `</ul>`;
      }
      return html;
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

    // Actualiza el contenido del panel con la tabla de una sub-capa MapLibre.
    window.openMapLibreSubLayer = function (index, sourceId, sourceLayer) {
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      if (!layer) return;
      closeSheet();
      openSheet(`Tabla de atributos · ${layer.legend || layer.name || 'Capa'} › ${sourceLayer}`,
        buildMapLibreFeaturesTable(layer, sourceId, sourceLayer), true);
    };

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
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
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
          // el indice de sub-capas (source-layers) del estilo. El builder es
          // asincrono (espera a que cargue el estilo), asi que se abre el panel
          // cero y se rellena el cuerpo cuando este listo.
          if (isMapLibreLayer(layer)) {
            const panel = openSheet(`Tabla de atributos · ${layerName}`, '<p style="padding:8px;color:#555;">Cargando sub-capas…</p>', false, selectableLayers, index);
            buildMapLibreTable(layer).then(function (html) {
              const body = panel && panel.querySelector('.ls-sheet-body');
              if (body) body.innerHTML = html;
            });
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
        getSelectableLayers().then(ls => { window._lsPickerLayers = ls; finish(ls); });
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

