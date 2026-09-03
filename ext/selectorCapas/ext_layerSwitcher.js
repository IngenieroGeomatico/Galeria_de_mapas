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

    const renderLayerList = async () => {
      try {
        const allLayers = await map.getOverlayLayers();
        const visibleLayers = (allLayers || []).filter(l => {
          try {
            return !(l && (l._type === 'Terrain' || l.type === 'Terrain'));
          } catch (e) { return true; }
        });
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
        closeLayerModal();
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

    // ── Modal: ver informacion / tabla de atributos de una capa ────────
    // Overlay centrado con un panel. Sirve tanto para la tabla de atributos
    // (capas vectoriales) como para las estadisticas (capas raster).
    const LAYER_MODAL_ID = 'ls-layer-modal';

    let closeLayerModal = function () {
      const old = document.getElementById(LAYER_MODAL_ID);
      if (old && old.parentElement) old.parentElement.removeChild(old);
    };
    // Expuesto para que deleteLayer pueda cerralo sin depender del orden.
    window.closeLayerModal = closeLayerModal;

    function openModal(title, bodyHtml, footerHtml) {
      closeLayerModal();
      const overlay = document.createElement('div');
      overlay.id = LAYER_MODAL_ID;
      overlay.className = 'ls-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      const panel = document.createElement('div');
      panel.className = 'ls-modal';
      panel.innerHTML =
        `<div class="ls-modal-header">
           <span class="ls-modal-title"></span>
           <button type="button" class="ls-modal-close" title="Cerrar" onclick="closeLayerModal()">✕</button>
         </div>
         <div class="ls-modal-body"></div>
         <div class="ls-modal-footer"></div>`;
      panel.querySelector('.ls-modal-title').textContent = title;
      panel.querySelector('.ls-modal-body').innerHTML = bodyHtml;
      if (footerHtml) panel.querySelector('.ls-modal-footer').innerHTML = footerHtml;
      // Cierra al pulsar el fondo del overlay.
      overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) closeLayerModal();
      });
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      return panel;
    }

    // Escapa texto plano para inyectarlo sin riesgo en el HTML del modal.
    function esc(v) {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ── Tabla de atributos de capa VECTORIAL ───────────────────────────
    function buildVectorTable(layer) {
      let features = [];
      try {
        if (typeof layer.getFeatures === 'function') features = layer.getFeatures() || [];
        else if (layer.getImpl() && typeof layer.getImpl().getFeatures === 'function') features = layer.getImpl().getFeatures() || [];
      } catch (e) { /* sin features */ }

      // Nombre de la capa.
      const layerName = layer.legend || layer.name || 'Capa';
      const featCount = features.length;
      if (!featCount) {
        return `<p style="padding:8px;color:#555;">La capa <b>${esc(layerName)}</b> no tiene features disponibles en el cliente (los datos pueden cargarse de forma remota).</p>`;
      }

      // Reunir el conjunto de columnas a partir de los atributos.
      // Los features de API-IDEE exponen getAttributes() (objeto clave-valor)
      // y/o getProperties(); se prueba en ese orden y se hace fallback.
      const columns = [];
      const rows = features.slice(0, 500).map(f => {
        let props = {};
        try {
          props = (f.getAttributes ? f.getAttributes() : null) ||
                  (f.getProperties ? f.getProperties() : null) || {};
        } catch (e) { /* sin atributos */ }
        if (typeof props !== 'object' || props === null) props = {};
        const geom = (f.getGeometry ? f.getGeometry() : null);
        for (const key in props) {
          if (!columns.includes(key)) columns.push(key);
        }
        return { props, geom };
      });

      // Asegurar columnas utiles aunque no haya propiedades.
      if (!columns.length) columns.push('(sin atributos)');

      let html = `<table class="ls-attr-table"><thead><tr>`;
      html += `<th>#</th>`;
      for (const c of columns) html += `<th>${esc(c)}</th>`;
      html += `</tr></thead><tbody>`;
      rows.forEach((row, i) => {
        html += `<tr><td>${i + 1}</td>`;
        for (const c of columns) {
          html += `<td>${esc(row.props[c] === undefined ? (c === '(sin atributos)' && row.props ? '—' : '') : row.props[c])}</td>`;
        }
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      const shown = rows.length;
      const more = featCount > shown ? `<p class="ls-modal-note">Mostrando ${shown} de ${featCount} features.</p>` : `<p class="ls-modal-note">${featCount} features (${columns.length} atributos).</p>`;
      return `${more}${html}`;
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
        <p class="ls-modal-note" style="margin-top:0;">Estadísticas de la capa ráster.</p>
        <ul class="ls-stat-list">
          <li><span class="ls-stat-label">Nombre</span><span class="ls-stat-value">${esc(layerName)}</span></li>
          <li><span class="ls-stat-label">Tipo</span><span class="ls-stat-value">${esc(typeInfo || 'ráster')}</span></li>
          <li><span class="ls-stat-label">Transparencia</span><span class="ls-stat-value">${transparency}%</span></li>
          ${bandsHtml}
          ${sizeHtml}
        </ul>`;
    }

    // ── Abrir informacion de la capa ───────────────────────────────────
    window.openLayerInfo = function (index) {
      const matches = map.getLayers().filter(layer => {
        try { return layer.getImpl().isBase === false && layer.getImpl().displayInLayerSwitcher === true && layer.idLayer == index; } catch (e) { return false; }
      });
      const layer = matches[0];
      if (!layer) return;
      const kind = window.getLayerKind(layer);
      const layerName = layer.legend || layer.name || 'Capa';
      if (kind === 'vector') {
        openModal(`Tabla de atributos · ${layerName}`, buildVectorTable(layer));
      } else {
        openModal(`Estadísticas · ${layerName}`, buildRasterInfo(layer));
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

