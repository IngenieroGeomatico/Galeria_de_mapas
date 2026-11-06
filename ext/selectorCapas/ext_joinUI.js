/* =====================================================================
   UI de la pestaña "Unión de capas (Join)" de la ficha del selector.
   Se carga después del selector (ext_layerSwitcher.js) y define
   `window.__montarJoinFichaImpl`, que el selector invoca con su scope.
   ===================================================================== */

(function () {
  'use strict';

  function camposDe(capa) {
    if (!capa) return [];
    // Fuente única: la misma extracción que usa el core del join
    // (`normalizarFeatureNativa`), expuesta como `JoinLayer.camposDeCapa`.
    try {
      if (window.JoinLayer && typeof window.JoinLayer.camposDeCapa === 'function') {
        return window.JoinLayer.camposDeCapa(capa);
      }
    } catch (e) { /* se usa el respaldo local */ }
    if (typeof capa.getFieldNames === 'function') {
      try { const f = capa.getFieldNames(); if (Array.isArray(f) && f.length) return f; } catch (e) {}
    }
    let feats = [];
    try { feats = (typeof capa.getFeatures === 'function') ? (capa.getFeatures() || []) : []; } catch (e) { feats = []; }
    if (!feats.length) {
      try { const ol = capa.getImpl && capa.getImpl().olLayer; if (ol && ol.getSource) feats = ol.getSource().getFeatures() || []; } catch (e) {}
    }
    const cols = [];
    feats.slice(0, 50).forEach(function (f) {
      let props = {};
      try { props = (f.getProperties ? f.getProperties() : null) || (f.getAttributes ? f.getAttributes() : null) || {}; } catch (e) {}
      for (const k in props) {
        if (typeof k === 'string' && k.charAt(0) === '_') continue;
        if (props[k] !== null && typeof props[k] === 'object') continue;
        if (cols.indexOf(k) === -1) cols.push(k);
      }
    });
    return cols;
  }

  const VENN_SVGS = {
    left: `<svg class="ls-join-venn" viewBox="0 0 46 26" width="46" height="26">
      <circle cx="17" cy="13" r="10" class="ls-venn-fill" />
      <circle cx="17" cy="13" r="10" class="ls-venn-stroke" />
      <circle cx="29" cy="13" r="10" class="ls-venn-stroke ls-venn-stroke--dim" />
    </svg>`,
    inner: `<svg class="ls-join-venn" viewBox="0 0 46 26" width="46" height="26">
      <defs><clipPath id="ls-cl-inn"><circle cx="29" cy="13" r="10"/></clipPath></defs>
      <circle cx="17" cy="13" r="10" clip-path="url(#ls-cl-inn)" class="ls-venn-fill" />
      <circle cx="17" cy="13" r="10" class="ls-venn-stroke ls-venn-stroke--dim" />
      <circle cx="29" cy="13" r="10" class="ls-venn-stroke ls-venn-stroke--dim" />
    </svg>`,
    right: `<svg class="ls-join-venn" viewBox="0 0 46 26" width="46" height="26">
      <circle cx="29" cy="13" r="10" class="ls-venn-fill" />
      <circle cx="17" cy="13" r="10" class="ls-venn-stroke ls-venn-stroke--dim" />
      <circle cx="29" cy="13" r="10" class="ls-venn-stroke" />
    </svg>`,
    full: `<svg class="ls-join-venn" viewBox="0 0 46 26" width="46" height="26">
      <circle cx="17" cy="13" r="10" class="ls-venn-fill" />
      <circle cx="29" cy="13" r="10" class="ls-venn-fill" />
      <circle cx="17" cy="13" r="10" class="ls-venn-stroke" />
      <circle cx="29" cy="13" r="10" class="ls-venn-stroke" />
    </svg>`,
    semi: `<svg class="ls-join-venn" viewBox="0 0 46 26" width="46" height="26">
      <defs><clipPath id="ls-cl-semi"><circle cx="29" cy="13" r="10"/></clipPath></defs>
      <circle cx="17" cy="13" r="10" clip-path="url(#ls-cl-semi)" class="ls-venn-fill" />
      <circle cx="17" cy="13" r="10" class="ls-venn-stroke" />
      <circle cx="29" cy="13" r="10" class="ls-venn-stroke ls-venn-stroke--dash" stroke-dasharray="2,2" />
    </svg>`,
    anti: `<svg class="ls-join-venn" viewBox="0 0 46 26" width="46" height="26">
      <path d="M 23 4.9 A 10 10 0 1 0 23 21.1 A 10 10 0 0 0 23 4.9 Z" class="ls-venn-fill" />
      <circle cx="17" cy="13" r="10" class="ls-venn-stroke" />
      <circle cx="29" cy="13" r="10" class="ls-venn-stroke ls-venn-stroke--dash" stroke-dasharray="2,2" />
    </svg>`
  };

  function pintarStats(cont, st) {
    if (!cont) return;
    let html = '<details class="ls-ficha-seccion ls-join-seccion-stats" open>';
    html += '<summary class="ls-ficha-seccion-header">';
    html += '<div class="ls-ficha-seccion-header-main">';
    html += '<span class="ls-ficha-seccion-icon" style="background:var(--ls-ok-fondo, #f0fdf4);color:var(--ls-exito, #16a34a);"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>';
    html += '<div class="ls-ficha-seccion-textos">';
    html += '<span class="ls-ficha-seccion-titulo">4. Resultado y estadísticas del Join</span>';
    html += '<span class="ls-ficha-seccion-sub">' + (st.matchedCount > 0 ? (st.matchedCount + ' coincidencias encontradas en ' + st.executionTimeMs + ' ms') : 'Sin coincidencias') + '</span>';
    html += '</div></div>';
    html += '<span class="ls-ficha-seccion-chevron"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';
    html += '</summary>';
    html += '<div class="ls-ficha-seccion-cuerpo">';
    html += '<div class="ls-join-results-card ' + (st.matchedCount > 0 ? 'ls-join-results-card--ok' : '') + '">';
    html += '<div class="ls-join-stats-grid">';
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num">${st.layer1Count}</div><div class="ls-join-stat-label">Capa activa</div></div>`;
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num">${st.layer2Count}</div><div class="ls-join-stat-label">Capa origen</div></div>`;
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num" style="color:var(--ls-exito, #16a34a);">${st.matchedCount}</div><div class="ls-join-stat-label">Coincidencias</div></div>`;
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num" style="color:var(--ls-primario, #0078d4);">${st.resultCount}</div><div class="ls-join-stat-label">Resultado final</div></div>`;
    html += '</div>';
    html += '<div class="ls-join-results-pie">';
    html += 'Sin correspondencia en capa 1: ' + st.unmatched1Count + ' · en capa origen: ' + st.unmatched2Count +
            ' · Tiempo de cálculo: ' + st.executionTimeMs + ' ms';
    html += '</div>';
    html += '</div>';
    html += '</div></details>';
    cont.innerHTML = html;
  }

  function escHtml(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function esImplCesium() {
    try {
      const m = window.mapajs || null;
      const impl = m && typeof m.getMapImpl === 'function' ? m.getMapImpl() : null;
      return !!(impl && impl.scene && impl.scene.camera);
    } catch (e) { return false; }
  }

  function esCapaMVT(l) {
    if (!l) return false;
    try { if (String(l.type || l._type || '').toLowerCase() === 'mvt') return true; } catch (e) {}
    try {
      const impl = (typeof l.getImpl === 'function') ? l.getImpl() : null;
      if (impl && impl.lector && typeof impl.lector.capas !== 'undefined') return true;
    } catch (e) {}
    return false;
  }
  window.__montarJoinFichaImpl = async function (panel, capa, overlay, map) {
    const esc = escHtml;
    const cont = panel.querySelector('#ls-join-container');
    if (!cont) return;
    if (!capa) {
      cont.innerHTML = '<p class="ls-ficha-aviso">No hay capa seleccionada.</p>';
      return;
    }
    const capaId = capa.idLayer;
    // FlatGeobuf arranca en modo "vista": se fuerza la carga completa del
    // fichero para que la ficha y el join vean TODAS las features.
    if (capa && capa._flatgeobuf === true && typeof capa._recargar === 'function') {
      try { await capa._recargar('todas', map, true); } catch (e) { /* seguir con lo disponible */ }
      // Esperar a que las features esten disponibles (3D: carga asincrona).
      let espera = 0;
      while (espera < 8000) {
        let fs = [];
        try { fs = (typeof capa.getFeatures === 'function') ? (capa.getFeatures() || []) : []; } catch (e) { fs = []; }
        if (fs.length) break;
        await new Promise(function (r) { setTimeout(r, 250); });
        espera += 250;
      }
    }
    const targetFields = camposDe(capa);

    function obtenerCapasSeleccionables() {
      const out = [];
      const stack = [];
      try { (map.getLayers() || []).forEach(function (l) { stack.push(l); }); } catch (e) {}
      while (stack.length) {
        const l = stack.pop();
        if (!l) continue;
        if (typeof l.getLayers === 'function' && !l.idLayer) {
          try { (l.getLayers() || []).forEach(function (h) { stack.push(h); }); } catch (e) {}
          continue;
        }
        out.push(l);
      }
      try {
        if (typeof map.getAlphanumericLayers === 'function') {
          (map.getAlphanumericLayers() || []).forEach(function (l) { out.push(l); });
        }
      } catch (e) {}
      return out;
    }
    const ls = obtenerCapasSeleccionables();
    const candidatos = (ls || []).filter(function (l) { return String(l.idLayer) !== String(capaId); });

      let html = '';
      html += '<div class="ls-join-banner"><div class="ls-join-banner-info">';
      html += '<span class="ls-join-banner-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></span>';
      html += '<div>';
      html += '<div class="ls-join-banner-badge-row"><span class="ls-join-banner-badge">JOIN</span><span class="ls-join-banner-titulo">Unión tabular y espacial de capas</span></div>';
      html += '<div class="ls-join-banner-texto">Combina los atributos de la capa activa con otra capa vectorial o alfanumérica del mapa.</div>';
      html += '</div></div></div>';

      if (esImplCesium() && (esCapaMVT(capa) || candidatos.some(esCapaMVT))) {
        html += '<div class="ls-ficha-aviso ls-ficha-aviso--aviso" style="margin-bottom:12px;">';
        html += 'Aviso: una o varias capas son MVT. En 3D (Cesium) las features MVT son fragmentos por tesela (solo viewport, posibles duplicados); el join puede dar resultados parciales. Para joins completos usa 2D o una capa WFS/GeoJSON.';
        html += '</div>';
      }

      // Sección 1: Capas y campos
      html += '<details class="ls-ficha-seccion" open>';
      html += '<summary class="ls-ficha-seccion-header">';
      html += '<div class="ls-ficha-seccion-header-main">';
      html += '<span class="ls-ficha-seccion-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></span>';
      html += '<div class="ls-ficha-seccion-textos">';
      html += '<span class="ls-ficha-seccion-titulo">1. Capas y campos a enlazar</span>';
      html += '<span class="ls-ficha-seccion-sub">Elige la capa origen y el criterio de correspondencia</span>';
      html += '</div></div>';
      html += '<span class="ls-ficha-seccion-chevron"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';
      html += '</summary>';
      html += '<div class="ls-ficha-seccion-cuerpo">';

      html += '<div class="ls-join-mode-wrap" style="margin-bottom:12px;">';
      html += '<div class="ls-ficha-campo-etiqueta" style="margin-bottom:6px;">Modo de enlace</div>';
      html += '<div class="ls-join-mode-pills">';
      html += '<button type="button" class="ls-join-mode-pill active" data-mode="attribute" onclick="window._joinSetMode(\'attribute\')">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';
      html += 'Por atributo (clave común)</button>';
      html += '<button type="button" class="ls-join-mode-pill" data-mode="spatial" onclick="window._joinSetMode(\'spatial\')">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/></svg>';
      html += 'Espacial (geometría)</button>';
      html += '</div></div>';

      html += '<div class="ls-ficha-campo" style="margin-bottom:12px;">';
      html += '<div class="ls-ficha-campo-etiqueta">Capa de origen (datos a unir)</div>';
      html += '<select id="ls-join-source" class="ls-ficha-input">';
      html += '<option value="">— Selecciona una capa de origen —</option>';
      candidatos.forEach(function (l) {
        const nm = esc(l.legend || l.name || 'Sin nombre');
        const kind = (window.getLayerKind ? window.getLayerKind(l) : '');
        html += `<option value="${esc(l.idLayer)}">${nm} (${esc(kind)})</option>`;
      });
      html += '</select></div>';

      html += '<div id="ls-join-attr-block">';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
      html += '<div><div class="ls-ficha-campo-etiqueta">Clave en esta capa (key1)</div>';
      html += '<select id="ls-join-key1" class="ls-ficha-input">';
      targetFields.forEach(function (f) { html += `<option value="${esc(f)}">${esc(f)}</option>`; });
      if (!targetFields.length) html += '<option value="">— sin campos —</option>';
      html += '</select></div>';
      html += '<div><div class="ls-ficha-campo-etiqueta">Clave en la capa origen (key2)</div>';
      html += '<select id="ls-join-key2" class="ls-ficha-input"><option value="">— elige capa origen —</option></select></div>';
      html += '</div>';
      html += '<div class="ls-ficha-campo"><div class="ls-ficha-campo-etiqueta">Prefijo para las columnas unidas</div>';
      html += '<input id="ls-join-prefix" class="ls-ficha-input" value="j_" placeholder="j_"></div>';
      html += '</div>';

      html += '<div id="ls-join-spatial-block" style="display:none;">';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
      html += '<div><div class="ls-ficha-campo-etiqueta">Predicado espacial</div>';
      html += '<select id="ls-join-pred" class="ls-ficha-input">';
      ['intersects','contains','within','touches','nearest'].forEach(function (p) {
        html += `<option value="${p}">${p}</option>`;
      });
      html += '</select></div>';
      html += '<div><div class="ls-ficha-campo-etiqueta">Distancia máxima (m, solo nearest)</div>';
      html += '<input id="ls-join-dist" class="ls-ficha-input" type="number" value="" placeholder="sin límite"></div>';
      html += '</div>';
      html += '</div>';

      html += '</div></details>';

      // Sección 2: Tipo de Join
      html += '<details class="ls-ficha-seccion" open>';
      html += '<summary class="ls-ficha-seccion-header">';
      html += '<div class="ls-ficha-seccion-header-main">';
      html += '<span class="ls-ficha-seccion-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg></span>';
      html += '<div class="ls-ficha-seccion-textos">';
      html += '<span class="ls-ficha-seccion-titulo">2. Tipo de unión (Join)</span>';
      html += '<span class="ls-ficha-seccion-sub">Selecciona qué entidades y atributos se conservan en el resultado</span>';
      html += '</div></div>';
      html += '<span class="ls-ficha-seccion-chevron"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';
      html += '</summary>';
      html += '<div class="ls-ficha-seccion-cuerpo">';

      html += '<div class="ls-join-types-grid">';
      const tipos = [
        { id: 'left', nombre: 'Left Join', badge: 'LEFT', desc: 'Conserva todas las filas de la capa activa; añade atributos de origen si coinciden.' },
        { id: 'inner', nombre: 'Inner Join', badge: 'INNER', desc: 'Conserva únicamente las entidades con coincidencia en ambas capas.' },
        { id: 'right', nombre: 'Right Join', badge: 'RIGHT', desc: 'Conserva todas las filas de la capa de origen con correspondencia.' },
        { id: 'full', nombre: 'Full Join', badge: 'FULL', desc: 'Conserva todas las entidades de ambas capas (unión completa).' },
        { id: 'semi', nombre: 'Semi Join', badge: 'SEMI', desc: 'Filtra la capa activa por existencia en origen (sin agregar columnas).' },
        { id: 'anti', nombre: 'Anti Join', badge: 'ANTI', desc: 'Filtra la capa activa por NO existencia en la capa de origen.' }
      ];
      tipos.forEach(function (t, i) {
        html += `<div class="ls-join-type-card ${i === 0 ? 'active' : ''}" data-type="${t.id}" onclick="window._joinSetType('${t.id}', this)">`;
        html += `<div class="ls-join-type-card-top">`;
        html += `<div class="ls-join-type-card-izq">`;
        html += (VENN_SVGS[t.id] || '');
        html += `<span class="ls-join-type-name">${t.nombre}</span>`;
        html += `</div>`;
        html += `<span class="ls-join-type-badge">${t.badge}</span>`;
        html += `</div>`;
        html += `<div class="ls-join-type-desc">${t.desc}</div>`;
        html += `</div>`;
      });
      html += '</div>';

      html += '</div></details>';

      // Sección 3: Opciones y ejecución
      html += '<details class="ls-ficha-seccion" open>';
      html += '<summary class="ls-ficha-seccion-header">';
      html += '<div class="ls-ficha-seccion-header-main">';
      html += '<span class="ls-ficha-seccion-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></span>';
      html += '<div class="ls-ficha-seccion-textos">';
      html += '<span class="ls-ficha-seccion-titulo">3. Opciones de salida y ejecución</span>';
      html += '<span class="ls-ficha-seccion-sub">Elige el destino del resultado y ejecuta la operación</span>';
      html += '</div></div>';
      html += '<span class="ls-ficha-seccion-chevron"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';
      html += '</summary>';
      html += '<div class="ls-ficha-seccion-cuerpo">';

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">';
      html += '<div><div class="ls-ficha-campo-etiqueta">Modo de resultado</div>';
      html += '<select id="ls-join-result" class="ls-ficha-input">';
      html += '<option value="new">Crear nueva capa en el mapa</option>';
      html += '<option value="inplace">Aplicar a esta capa (in-situ)</option>';
      html += '</select></div>';
      html += '<div><div class="ls-ficha-campo-etiqueta">Sobrescribir campos existentes</div>';
      html += '<select id="ls-join-overwrite" class="ls-ficha-input"><option value="false">No (añade sufijo)</option><option value="true">Sí (reemplaza valor)</option></select></div>';
      html += '</div>';

      html += '<div class="ls-ficha-editor-pie" style="position:static;border-top:none;padding:0;margin-top:6px;">';
      html += '<button type="button" class="ls-ficha-boton ls-ficha-boton--primario" id="ls-join-run">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      html += 'Ejecutar unión</button>';
      html += '<span id="ls-join-status" class="ls-ficha-editor-estado" role="status"></span>';
      html += '</div>';

      html += '</div></details>';

      html += '<div id="ls-join-results" style="margin-top:14px;"></div>';

      cont.innerHTML = html;

      cont.innerHTML = html;

      const srcSel = cont.querySelector('#ls-join-source');
      srcSel.addEventListener('change', async function () {
        const id = this.value;
        const srcLayer = candidatos.find(function (l) { return String(l.idLayer) === String(id); });
        if (srcLayer && srcLayer._flatgeobuf === true && typeof srcLayer._recargar === 'function') {
          try { await srcLayer._recargar('todas', map, true); } catch (e) { /* seguir con lo disponible */ }
          let esperaSrc = 0;
          while (esperaSrc < 8000) {
            let fs = [];
            try { fs = (typeof srcLayer.getFeatures === 'function') ? (srcLayer.getFeatures() || []) : []; } catch (e) { fs = []; }
            if (fs.length) break;
            await new Promise(function (r) { setTimeout(r, 250); });
            esperaSrc += 250;
          }
        }
        const key2 = cont.querySelector('#ls-join-key2');
        const cols = srcLayer ? camposDe(srcLayer) : [];
        key2.innerHTML = cols.length
          ? cols.map(function (c) { return `<option value="${esc(c)}">${esc(c)}</option>`; }).join('')
          : '<option value="">— sin campos —</option>';
      });

      panel._joinState = { capa: capa, candidatos: candidatos, selectedType: 'left', selectedMode: 'attribute' };

      window._joinSetMode = function (mode) {
        const root = document.querySelector('.ls-join-container') || cont;
        root.querySelectorAll('.ls-join-mode-pill').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-mode') === mode);
        });
        const attr = document.getElementById('ls-join-attr-block');
        const spa = document.getElementById('ls-join-spatial-block');
        if (attr) attr.style.display = (mode === 'attribute') ? '' : 'none';
        if (spa) spa.style.display = (mode === 'spatial') ? '' : 'none';
        if (panel._joinState) panel._joinState.selectedMode = mode;
      };
      window._joinSetType = function (type) {
        document.querySelectorAll('.ls-join-type-card').forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-type') === type);
        });
        if (panel._joinState) panel._joinState.selectedType = type;
      };

      const runBtn = cont.querySelector('#ls-join-run');
      runBtn.addEventListener('click', async function () {
        const status = cont.querySelector('#ls-join-status');
        const results = cont.querySelector('#ls-join-results');

        // Mensajes con estado semántico (clases del CSS de la ficha).
        const aviso = function (texto, tipo) {
          if (!status) return;
          status.className = 'ls-ficha-editor-estado' +
            (tipo === 'error' ? ' ls-ficha-editor-estado--error' :
              tipo === 'ok' ? ' ls-ficha-editor-estado--ok' :
                tipo === 'aviso' ? ' ls-ficha-editor-estado--aviso' : '');
          status.textContent = texto;
        };

        const srcId = cont.querySelector('#ls-join-source').value;
        if (!srcId) { aviso('Elige una capa de origen.', 'aviso'); return; }
        const srcLayer = candidatos.find(function (l) { return String(l.idLayer) === String(srcId); });
        if (!srcLayer) { aviso('Capa de origen no encontrada.', 'error'); return; }

        const modo = panel._joinState.selectedMode;
        const tipoJoin = panel._joinState.selectedType;
        const prefijo = (cont.querySelector('#ls-join-prefix').value || '').trim();
        const sobrescribir = cont.querySelector('#ls-join-overwrite').value === 'true';
        const modoResultado = cont.querySelector('#ls-join-result').value;

        // Las claves se leen ANTES de validar y ejecutar.
        let clave1 = null;
        let clave2 = null;
        if (modo === 'attribute') {
          clave1 = cont.querySelector('#ls-join-key1').value;
          clave2 = cont.querySelector('#ls-join-key2').value;
        }

        try { await (window.cargarJoinLayer ? window.cargarJoinLayer() : Promise.resolve()); } catch (e) {}
        const JoinClass = window.JoinLayer;
        if (!JoinClass) { aviso('Módulo JoinLayer no disponible.', 'error'); return; }

        // Validación de claves: avisa si no existen en las capas de origen (o
        // si no se ha elegido ninguna). Sin esto el join se ejecutaba con
        // todas las filas sin correspondencia y el resultado parecía correcto.
        if (modo === 'attribute') {
          if (!clave1 || !clave2) {
            aviso('Elige la clave de esta capa (key1) y la de la capa de origen (key2).', 'aviso');
            return;
          }
          const campos1 = camposDe(capa);
          const campos2 = camposDe(srcLayer);
          const problemas = [];
          if (campos1.length && campos1.indexOf(clave1) === -1) {
            problemas.push('«' + clave1 + '» no existe en «' + (capa.legend || capa.name || 'esta capa') + '»');
          }
          if (campos2.length && campos2.indexOf(clave2) === -1) {
            problemas.push('«' + clave2 + '» no existe en «' + (srcLayer.legend || srcLayer.name || 'la capa de origen') + '»');
          }
          if (problemas.length) {
            aviso('No se ejecuta la unión: ' + problemas.join('; ') + '.', 'error');
            return;
          }
        }

        const opts = {
          layer1: capa,
          layer2: srcLayer,
          type: tipoJoin,
          mode: modo,
          prefix: prefijo,
          overwrite: sobrescribir
        };
        if (modo === 'attribute') {
          opts.key1 = clave1;
          opts.key2 = clave2;
        } else {
          opts.spatialPredicate = cont.querySelector('#ls-join-pred').value;
          const dist = cont.querySelector('#ls-join-dist').value;
          if (dist) opts.maxDistance = Number(dist);
        }

        aviso('Ejecutando unión…');
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Calculando…'; }

        try {
          if (modoResultado === 'inplace') {
            // `JoinClass.apply` ya crea el JoinClass, recalcula y aplica
            // in-situ: no se instancia un segundo objeto (antes se hacía y se
            // recalculaba dos veces el mismo join).
            const join = await JoinClass.apply(capa, srcLayer, opts);
            pintarStats(results, join.getJoinStats());
            aviso('Unión aplicada sobre la capa actual.', 'ok');
          } else {
            const join = new JoinClass(opts);
            await join.recalculate();
            const st = join.getJoinStats();
            try {
              try { join.addTo(window.mapajs || map); } catch (e) { /* nada */ }
              try { (window.mapajs || map).addLayers(join); } catch (e2) { /* nada */ }
            } catch (e) {
              try { map.addLayers(join); } catch (e2) { /* nada */ }
            }
            pintarStats(results, st);
            aviso('Nueva capa creada: ' + (join.legend || join.name), 'ok');
            try { if (typeof window.renderLayerList === 'function') window.renderLayerList(); } catch (e) {}
          }
        } catch (e) {
          console.warn('join ficha:', e);
          aviso('Error: ' + (e && e.message ? e.message : e), 'error');
        } finally {
          if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Ejecutar unión'; }
        }
      });

  };

  window._pintarStatsJoin = pintarStats;
})();
