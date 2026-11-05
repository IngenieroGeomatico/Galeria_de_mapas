(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const ext = params.get('ext') || params.get('plugin') || '';
  const titulo = document.getElementById('titulo');
  const nombreExt = document.getElementById('nombreExt');
  const descExt = document.getElementById('descExt');
  const consola = document.getElementById('consola');
  const loading = document.getElementById('loading');
  const linkReadme = document.getElementById('linkReadme');
  const ejemplo = document.getElementById('ejemplo');
  const form = document.getElementById('formParams');
  const constructorCode = document.getElementById('constructorCode');
  const btnReset = document.getElementById('btnReset');
  const formFields = document.getElementById('formFields');

  let map = null;
  let codigoEjemplo = '';

  // Registro de parámetros de construcción por extensión.
  // Cada entrada: array de {name, type, default, label, options?}.
  const PARAMS = {
    ineLayer: [
      { name: 'tablaId', type: 'text', default: '67301', label: 'Id de tabla INE' },
      { name: 'nult', type: 'number', default: 5, label: 'Últimos periodos (nult)' },
      { name: 'pivot', type: 'boolean', default: false, label: 'Pivot (un registro por serie)' },
      { name: 'tip', type: 'text', default: '', label: 'Tipo de dato (A/M/T)' },
      { name: 'name', type: 'text', default: 'INE tabla', label: 'Nombre de la capa' }
    ],
    madridOpenDataLayer: [
      { name: 'resourceId', type: 'text', default: '200085-1-censo-locales', label: 'resource_id' },
      { name: 'limit', type: 'number', default: 100, label: 'Límite de registros' },
      { name: 'q', type: 'text', default: '', label: 'Filtro de texto (q)' },
      { name: 'name', type: 'text', default: 'Madrid recurso', label: 'Nombre de la capa' }
    ],
    mbtilesLayer: [
      { name: 'url', type: 'text', default: 'https://raw.githubusercontent.com/mapbox/node-mbtiles/master/test/fixtures/plain_1.mbtiles', label: 'URL del .mbtiles' },
      { name: 'name', type: 'text', default: 'MBTiles', label: 'Nombre' },
      { name: 'legend', type: 'text', default: 'MBTiles de ejemplo', label: 'Leyenda' }
    ],
    joinLayer: [
      { name: 'layer1', type: 'text', default: '', label: 'Capa 1 (legend/id)' },
      { name: 'layer2', type: 'text', default: '', label: 'Capa 2 (legend/id)' },
      { name: 'key1', type: 'text', default: '', label: 'Clave en capa 1' },
      { name: 'key2', type: 'text', default: '', label: 'Clave en capa 2' },
      { name: 'type', type: 'select', default: 'left', label: 'Tipo de join', options: ['left', 'inner', 'right', 'full', 'semi', 'anti'] },
      { name: 'mode', type: 'select', default: 'attribute', label: 'Modo', options: ['attribute', 'spatial', 'auto'] },
      { name: 'prefix', type: 'text', default: 'j_', label: 'Prefijo' },
      { name: 'inplace', type: 'boolean', default: false, label: 'In-situ' }
    ],
    alphanumericLayer: [
      { name: 'name', type: 'text', default: 'Datos', label: 'Nombre' },
      { name: 'legend', type: 'text', default: 'Datos', label: 'Leyenda' }
    ],
    MVTLayer: [
      { name: 'url', type: 'text', default: '', label: 'URL de teselas MVT' },
      { name: 'layers', type: 'text', default: 'municipio', label: 'Capa en la tesela' },
      { name: 'name', type: 'text', default: 'MVT', label: 'Nombre' }
    ]
  };

  // Plantilla de construcción por extensión (genera código JS a partir de los valores del formulario).
  function plantillaConstructor(ext, valores) {
    const v = valores || {};
    if (ext === 'ineLayer') {
      const tabla = v.tablaId || '67301';
      const opts = { nult: Number(v.nult) || 5, pivot: !!v.pivot, name: v.name || 'INE tabla' };
      if (v.tip) opts.tip = v.tip;
      return 'const capa = await window.INE.cargarTabla(' + JSON.stringify(tabla) + ', ' + JSON.stringify(opts) + ');\ncapa.addTo(mapajs);';
    }
    if (ext === 'madridOpenDataLayer') {
      const rid = v.resourceId || '';
      const opts = { limit: Number(v.limit) || 100, name: v.name || 'Madrid recurso' };
      if (v.q) opts.q = v.q;
      return 'const capa = await window.Madrid.cargarRecurso(' + JSON.stringify(rid) + ', ' + JSON.stringify(opts) + ');\ncapa.addTo(mapajs);';
    }
    if (ext === 'mbtilesLayer') {
      return 'const capa = new IDEE.layer.MBTiles({\n  url: ' + JSON.stringify(v.url || '') + ',\n  name: ' + JSON.stringify(v.name || 'MBTiles') + ',\n  legend: ' + JSON.stringify(v.legend || 'MBTiles') + '\n});\nmapajs.addLayers(capa);';
    }
    if (ext === 'joinLayer') {
      const opts = {
        layer1: v.layer1 || '', layer2: v.layer2 || '',
        key1: v.key1 || '', key2: v.key2 || '',
        type: v.type || 'left', mode: v.mode || 'attribute',
        prefix: v.prefix || 'j_', inplace: !!v.inplace
      };
      return 'const capa = new IDEE.layer.Join(' + JSON.stringify(opts) + ');\nmapajs.addLayers(capa);';
    }
    if (ext === 'MVTLayer') {
      return 'const capa = new IDEE.layer.MVT({\n  url: ' + JSON.stringify(v.url || '') + ',\n  layers: ' + JSON.stringify(v.layers || 'municipio') + ',\n  name: ' + JSON.stringify(v.name || 'MVT') + '\n});\nmapajs.addLayers(capa);';
    }
    // Genérico: plugin miPlugin_<ext>
    return 'const plugin = new IDEE.plugin.miPlugin_' + ext + '({ position: "TL", collapsible: true, order: 1 });\nmapajs.addPlugin(plugin);';
  }

  function log(msg) {
    const line = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n';
    consola.textContent = (consola.textContent || '') + line;
    consola.scrollTop = consola.scrollHeight;
  }

  if (!ext) {
    titulo.textContent = 'Muestra de extensión';
    descExt.textContent = 'Falta el parámetro ?ext=<nombre>. Ej.: showcase.html?ext=joinLayer';
    loading.style.display = 'none';
    return;
  }

  titulo.textContent = 'Extensión: ' + ext;
  nombreExt.textContent = ext;
  linkReadme.href = '../' + ext + '/README.md';

  fetch('../' + ext + '/README.md')
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (t) {
      if (t) {
        const parrafo = t.split(/\n\s*\n/)[0] || t.slice(0, 400);
        descExt.textContent = parrafo.replace(/^#+\s*/gm, '').slice(0, 600);
        descExt.classList.remove('aviso');
        let m = t.match(/```(?:javascript|js)\n([\s\S]*?)```/);
        if (!m) m = t.match(/```\n([\s\S]*?)```/);
        let candidato = m ? m[1].trim() : '';
        const pareceMarkdown = /(^|\n)#{1,6}\s|\n\|/.test(candidato) || !/[;{}()]/.test(candidato);
        if (m && !pareceMarkdown) {
          codigoEjemplo = candidato;
        } else {
          // Usar plantilla si hay parámetros registrados.
          const defs = PARAMS[ext];
          if (defs) {
            const vals = {};
            defs.forEach(function (d) { vals[d.name] = d.default; });
            codigoEjemplo = plantillaConstructor(ext, vals);
          } else {
            codigoEjemplo = 'const plugin = new IDEE.plugin.miPlugin_' + ext + '({ position: "TL", collapsible: true, order: 1 });\nmapajs.addPlugin(plugin);';
          }
        }
        ejemplo.textContent = codigoEjemplo;
        constructorCode.value = codigoEjemplo;
      } else {
        descExt.textContent = 'Sin README.md en la extensión.';
      }
    })
    .catch(function () { descExt.textContent = 'No se pudo leer el README.'; });

  // Renderizar formulario de parámetros si hay definición.
  const defs = PARAMS[ext];
  if (defs && formFields) {
    formFields.innerHTML = '';
    defs.forEach(function (d) {
      const row = document.createElement('div');
      row.className = 'campo-form';
      const label = document.createElement('label');
      label.textContent = d.label || d.name;
      row.appendChild(label);
      let input;
      if (d.type === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!d.default;
      } else if (d.type === 'select') {
        input = document.createElement('select');
        (d.options || []).forEach(function (opt) {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          if (opt === d.default) o.selected = true;
          input.appendChild(o);
        });
      } else {
        input = document.createElement('input');
        input.type = d.type === 'number' ? 'number' : 'text';
        input.value = (d.default == null ? '' : d.default);
      }
      input.name = d.name;
      input.dataset.param = d.name;
      input.dataset.ptype = d.type;
      row.appendChild(input);
      formFields.appendChild(row);
    });

    // Actualizar textarea cuando cambia un campo.
    function actualizarCodigo() {
      const valores = {};
      defs.forEach(function (d) {
        const el = formFields.querySelector('[data-param="' + d.name + '"]');
        if (!el) return;
        if (d.type === 'boolean') valores[d.name] = el.checked;
        else if (d.type === 'number') valores[d.name] = el.value === '' ? null : Number(el.value);
        else valores[d.name] = el.value;
      });
      constructorCode.value = plantillaConstructor(ext, valores);
    }
    formFields.addEventListener('input', actualizarCodigo);
    formFields.addEventListener('change', actualizarCodigo);
  }

  // Cargar CSS de la extensión si existe.
  const linkCss = document.createElement('link');
  linkCss.rel = 'stylesheet';
  linkCss.href = '../' + ext + '/' + ext + '.css';
  document.head.appendChild(linkCss);

  // Cargar JS de la extensión.
  const s = document.createElement('script');
  s.src = '../' + ext + '/' + ext + '.js';
  s.async = false;
  s.onload = function () {
    log('Script cargado: ' + ext + '.js');
    iniciarMapa(ext);
  };
  s.onerror = function () {
    log('ERROR: no se pudo cargar ' + ext + '.js');
    descExt.textContent = 'No se pudo cargar el script de la extensión.';
    loading.style.display = 'none';
  };
  document.head.appendChild(s);

  function iniciarMapa(ext) {
    const api = window.IDEE || window.M;
    if (!api) { log('API no disponible'); loading.style.display = 'none'; return; }

    map = api.map({
      container: 'mapaDIV',
      zoom: 6,
      center: { x: -412000, y: 4928000 }
    });
    try {
      if (api.utils && typeof api.utils.reproject === 'function') {
        const c = api.utils.reproject([-3.70379, 40.41678], 'EPSG:4326', 'EPSG:3857');
        map.setCenter({ x: c[0], y: c[1] });
      }
    } catch (e) { /* noop */ }

    window.mapajs = map;
    log('Mapa creado.');

    const clasePlugin = api.plugin && api.plugin['miPlugin_' + ext];
    if (typeof clasePlugin === 'function') {
      try {
        const plugin = new clasePlugin({ position: 'TL', collapsible: true, order: 1 });
        map.addPlugin(plugin);
        log('Plugin miPlugin_' + ext + ' añadido al mapa.');
      } catch (e) {
        log('No se pudo instanciar el plugin: ' + (e && e.message ? e.message : e));
      }
    } else {
      log('No hay miPlugin_' + ext + ' (puede ser una capa o utilidad).');
    }

    loading.style.display = 'none';
  }

  // Colapsar/expandir secciones.
  document.querySelectorAll('.colapsable').forEach(function (h) {
    h.style.cursor = 'pointer';
    h.addEventListener('click', function () {
      const target = document.getElementById(h.getAttribute('data-target'));
      if (!target) return;
      const oculto = target.style.display === 'none';
      target.style.display = oculto ? '' : 'none';
      const flecha = h.querySelector('.flecha');
      if (flecha) flecha.textContent = oculto ? '▾' : '▸';
    });
  });

  // Reconstruir a partir del código editado.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!map) { log('Mapa no listo'); return; }
    const code = constructorCode.value;
    try {
      const fn = new Function('map', 'mapajs', 'IDEE', 'M', code);
      fn(map, map, window.IDEE, window.M);
      log('Reconstrucción ejecutada.');
    } catch (err) {
      log('Error al ejecutar: ' + (err && err.message ? err.message : err));
    }
  });

  btnReset.addEventListener('click', function () {
    constructorCode.value = codigoEjemplo;
  });
})();
