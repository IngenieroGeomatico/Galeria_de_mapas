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

  function pintarStats(cont, st) {
    if (!cont) return;
    let html = '<div class="ls-join-results-card ' + (st.matchedCount > 0 ? 'ls-join-results-card--ok' : '') + '">';
    html += '<div class="ls-join-results-titulo">Resultado del join</div>';
    html += '<div class="ls-join-stats-grid">';
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num">${st.layer1Count}</div><div class="ls-join-stat-label">Capa 1</div></div>`;
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num">${st.layer2Count}</div><div class="ls-join-stat-label">Capa 2</div></div>`;
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num">${st.matchedCount}</div><div class="ls-join-stat-label">Coincidencias</div></div>`;
    html += `<div class="ls-join-stat-box"><div class="ls-join-stat-num">${st.resultCount}</div><div class="ls-join-stat-label">Resultado</div></div>`;
    html += '</div>';
    html += '<div class="ls-join-results-pie">';
    html += 'Sin correspondencia en capa 1: ' + st.unmatched1Count + ' · en capa 2: ' + st.unmatched2Count +
            ' · ' + st.executionTimeMs + ' ms';
    html += '</div>';
    html += '</div>';
    cont.innerHTML = html;
  }

  function escHtml(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
      html += '<span class="ls-join-banner-badge">Join</span>';
      html += '<span class="ls-join-banner-texto">Combina los atributos de esta capa con los de otra capa del mapa.</span>';
      html += '</div></div>';

      html += '<div class="ls-join-mode-pills">';
      html += '<button type="button" class="ls-join-mode-pill active" data-mode="attribute" onclick="window._joinSetMode(\'attribute\')">Por atributo</button>';
      html += '<button type="button" class="ls-join-mode-pill" data-mode="spatial" onclick="window._joinSetMode(\'spatial\')">Espacial</button>';
      html += '</div>';

      html += '<div class="ls-ficha-card">';
      html += '<div class="ls-ficha-seccion-titulo">Capa de origen (datos a unir)</div>';
      html += '<select id="ls-join-source" class="ls-ficha-input" style="margin-bottom:10px;">';
      html += '<option value="">— Selecciona una capa —</option>';
      candidatos.forEach(function (l) {
        const nm = esc(l.legend || l.name || 'Sin nombre');
        const kind = (window.getLayerKind ? window.getLayerKind(l) : '');
        html += `<option value="${esc(l.idLayer)}">${nm} (${esc(kind)})</option>`;
      });
      html += '</select>';

      html += '<div id="ls-join-attr-block">';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
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
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
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

      html += '<div class="ls-ficha-seccion-titulo" style="margin-top:12px;">Tipo de join</div>';
      html += '<div class="ls-join-types-grid">';
      const tipos = [
        { id: 'left', nombre: 'Left', badge: 'LEFT', desc: 'Conserva todos los elementos de esta capa; añade atributos de la origen si hay coincidencia.' },
        { id: 'inner', nombre: 'Inner', badge: 'INNER', desc: 'Solo los elementos con coincidencia en ambas capas.' },
        { id: 'right', nombre: 'Right', badge: 'RIGHT', desc: 'Conserva todos los registros de la capa origen.' },
        { id: 'full', nombre: 'Full', badge: 'FULL', desc: 'Conserva todos los elementos de ambas capas.' },
        { id: 'semi', nombre: 'Semi', badge: 'SEMI', desc: 'Filtra esta capa por existencia en la origen (sin añadir columnas).' },
        { id: 'anti', nombre: 'Anti', badge: 'ANTI', desc: 'Filtra esta capa por no existencia en la origen.' }
      ];
      tipos.forEach(function (t, i) {
        html += `<div class="ls-join-type-card ${i === 0 ? 'active' : ''}" data-type="${t.id}" onclick="window._joinSetType('${t.id}', this)">`;
        html += `<div class="ls-join-type-name">${t.nombre} <span class="ls-join-type-badge">${t.badge}</span></div>`;
        html += `<div class="ls-join-type-desc">${t.desc}</div>`;
        html += `</div>`;
      });
      html += '</div>';

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
      html += '<div><div class="ls-ficha-campo-etiqueta">Modo de resultado</div>';
      html += '<select id="ls-join-result" class="ls-ficha-input">';
      html += '<option value="new">Crear nueva capa en el mapa</option>';
      html += '<option value="inplace">Aplicar a esta capa (in-situ)</option>';
      html += '</select></div>';
      html += '<div><div class="ls-ficha-campo-etiqueta">Sobrescribir campos existentes</div>';
      html += '<select id="ls-join-overwrite" class="ls-ficha-input"><option value="false">No</option><option value="true">Sí</option></select></div>';
      html += '</div>';

      html += '<div class="ls-ficha-editor-pie" style="position:static;border-top:none;padding:0;margin-top:8px;">';
      html += '<button type="button" class="ls-ficha-boton ls-ficha-boton--primario" id="ls-join-run">Ejecutar unión</button>';
      html += '<span id="ls-join-status" class="ls-ficha-editor-estado" role="status"></span>';
      html += '</div>';

      html += '<div id="ls-join-results" style="margin-top:14px;"></div>';
      html += '</div>';

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
