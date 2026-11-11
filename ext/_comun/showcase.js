(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const ext = params.get('ext') || params.get('plugin') || '';

  // Algunas extensiones registran el plugin con un nombre distinto al de la carpeta.
  const EXT_TO_PLUGIN = {
    'CalidadAireMadridTiempoReal': 'calidadAire',
    'FiltroCapasPuntosHistoricos': 'filtroCapasPuntosHistoricos'
  };
  function pluginSuffix(e) { return EXT_TO_PLUGIN[e] || e; }
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
    attribution: [
      { name: 'mode', type: 'select', default: 'lite', label: 'Modo (lite / full)', options: ['lite', 'full'] },
      { name: 'position', type: 'select', default: 'BR', label: 'Posición (modo full)', options: ['BR', 'BL', 'TL', 'TR'] },
      { name: 'openPosition', type: 'select', default: 'bottom', label: 'Banda barra (modo lite)', options: ['bottom', 'top'] },
      { name: 'collapsed', type: 'boolean', default: true, label: 'Colapsado inicial' },
      { name: 'order', type: 'number', default: -1, label: 'Orden (CSS order)' },
      { name: 'tooltip', type: 'text', default: 'Atribución y créditos', label: 'Tooltip' },
      { name: 'color1_active', type: 'text', default: '#ffffff', label: 'Color1 activo' },
      { name: 'color1_deactive', type: 'text', default: 'orangered', label: 'Color1 inactivo' },
      { name: 'color2_active', type: 'text', default: '#71A7D3', label: 'Color2 activo' },
      { name: 'color2_deactive', type: 'text', default: '#ffffff', label: 'Color2 inactivo' }
    ],
    graphic: [
      { name: 'title', type: 'text', default: 'Estadísticas de Tráfico', label: 'Título' },
      { name: 'chartType', type: 'select', default: 'line', label: 'Tipo de Gráfica', options: ['line', 'bar', 'area', 'donut', 'pie'] },
      { name: 'mode', type: 'select', default: 'floating', label: 'Modo en Visualizador', options: ['floating', 'panel'] },
      { name: 'position', type: 'select', default: 'TR', label: 'Posición', options: ['TR', 'TL', 'BR', 'BL'] }
    ],
    dashboard: [
      { name: 'title', type: 'text', default: 'Monitor Territorial', label: 'Título' },
      { name: 'theme', type: 'select', default: 'light', label: 'Tema', options: ['light', 'dark'] }
    ],
    MVTLayer: [
      { name: 'url', type: 'text', default: 'https://vt-unidades-administrativas.ign.es/1.0.0/uadministrativa/{z}/{x}/{y}.pbf', label: 'URL de teselas MVT' },
      { name: 'layers', type: 'text', default: 'municipio', label: 'Capa en la tesela' },
      { name: 'extract', type: 'boolean', default: false, label: 'Extraer atributos' },
      { name: 'name', type: 'text', default: 'Municipios (MVT)', label: 'Nombre' },
      { name: 'legend', type: 'text', default: 'Municipios (MVT)', label: 'Leyenda' }
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
    if (ext === 'alphanumericLayer') {
      return [
        '// Al reconstruir el ejemplo se quitan las capas de la vez anterior.',
        '(mapajs.getAlphanumericLayers ? mapajs.getAlphanumericLayers() : []).forEach(function (c) {',
        '  try { c.destroy(); } catch (e) {}',
        '});',
        '',
        '// 1. Municipios Sierra (CSV con campos lat/lon parametrizados en constructor)',
        'const csvMunicipios = "id;municipio;poblacion;lat;lon\\n1;Cercedilla;7526;40.7388;-4.0628\\n2;Rascafría;1736;40.9056;-3.8781";',
        '',
        'const capaCSV = new IDEE.layer.Alphanumeric({',
        '  name: "capa_municipios_csv",',
        '  legend: "Municipios Sierra",',
        '  source: {',
        '    data: csvMunicipios,',
        '    idField: "id",',
        '    latField: "lat",',
        '    lonField: "lon"',
        '  },',
        '  style: new IDEE.style.Generic({',
        '    point: { radius: 8, fill: { color: "#2e7d32" }, stroke: { color: "#ffffff", width: 2 } }',
        '  })',
        '});',
        'capaCSV.addTo(mapajs);',
        '',
        '// 2. Lugares de interés (JSON plano con campo `geometry` GeoJSON / WKT)',
        'const arrayLugares = [',
        '  {',
        '    nombre: "Madrid (Sol)",',
        '    categoria: "Monumento",',
        '    visitas: 4500,',
        '    geometry: { type: "Point", coordinates: [-3.7037, 40.4167] }',
        '  },',
        '  {',
        '    nombre: "Barcelona (Ramblas)",',
        '    categoria: "Paseo",',
        '    visitas: 3800,',
        '    geometry: { type: "Point", coordinates: [2.1734, 41.3851] }',
        '  },',
        '  {',
        '    nombre: "Valencia (Artes)",',
        '    categoria: "Cultura",',
        '    visitas: 2900,',
        '    geometry: "POINT(-0.3547 39.4549)"',
        '  }',
        '];',
        '',
        'const capaJSON = new IDEE.layer.Alphanumeric({',
        '  name: "capa_lugares_json",',
        '  legend: "Lugares de interés",',
        '  source: arrayLugares,',
        '  style: new IDEE.style.Generic({',
        '    point: { radius: 8, fill: { color: "#0078d4" }, stroke: { color: "#ffffff", width: 2 } }',
        '  })',
        '});',
        'capaJSON.addTo(mapajs);'
      ].join('\n');
    }
    if (ext === 'attribution') {
      const mode = v.mode || 'lite';
      const pos = v.position || 'BR';
      const openPos = v.openPosition || 'bottom';
      const collapsed = v.collapsed !== false;
      const order = v.order != null ? Number(v.order) : -1;
      const tooltip = v.tooltip || 'Atribución y créditos';
      const color1 = { active: v.color1_active || '#ffffff', deactive: v.color1_deactive || 'orangered' };
      const color2 = { active: v.color2_active || '#71A7D3', deactive: v.color2_deactive || '#ffffff' };

      return [
        '// =========================================================================',
        '// Modos de presentación disponibles en miPlugin_attribution:',
        '//   • "lite": Botón © en el rail (BL) + barra horizontal inferior de créditos.',
        '//             Ideal para visualizadores limpios y responsivos.',
        '//   • "full": Ventana / panel lateral colapsable y arrastrable de la API-IDEE.',
        '// =========================================================================',
        'const plugin = new IDEE.plugin.miPlugin_attribution({',
        '  // Modo de presentación: "lite" (barra desplegable en la base) o "full" (panel flotante)',
        '  mode: ' + JSON.stringify(mode) + ',',
        '  // Posición del panel ("BR", "BL", "TL", "TR") cuando mode es "full"',
        '  position: ' + JSON.stringify(pos) + ',',
        '  // Banda donde se despliega la barra en modo "lite": "bottom" o "top"',
        '  openPosition: ' + JSON.stringify(openPos) + ',',
        '  collapsed: ' + (collapsed ? 'true' : 'false') + ',     // Estado inicial colapsado',
        '  collapsible: true,',
        '  order: ' + order + ',             // Orden relativo dentro del rail o la banda (-1 al principio)',
        '  tooltip: ' + JSON.stringify(tooltip) + ',',
        '  color1: ' + JSON.stringify(color1) + ',',
        '  color2: ' + JSON.stringify(color2) + ',',
        '  attributions: [',
        '    {',
        '      name: "Autor:",',
        '      description: "<a style=\\"color: #0B57D0\\" href=\\"https://github.com/IngenieroGeomatico\\" target=\\"_blank\\">IngenieroGeomático</a>"',
        '    }',
        '  ]',
        '});',
        'mapajs.addPlugin(plugin);'
      ].join('\n');
    }
    if (ext === 'graphic') {
      const title = v.title || 'Estadísticas de Tráfico';
      const chartType = v.chartType || 'line';
      const mode = v.mode || 'floating';
      const pos = v.position || 'TR';

      if (mode === 'panel') {
        return [
          '// Opción B: Gráfica como botón en el rail + panel colapsable de la API-IDEE',
          'const grafica = new IDEE.graphic({',
          '  title: ' + JSON.stringify(title) + ',',
          '  chartType: ' + JSON.stringify(chartType) + ',',
          '  data: [',
          '    { name: "08:00", value: 380 },',
          '    { name: "12:00", value: 720 },',
          '    { name: "16:00", value: 890 },',
          '    { name: "20:00", value: 540 }',
          '  ]',
          '});',
          '',
          '// Añadir como plugin al visualizador',
          'mapajs.addPlugin(grafica.asPlugin({',
          '  position: ' + JSON.stringify(pos) + ',',
          '  collapsible: true,',
          '  order: 1',
          '}));'
        ].join('\n');
      }

      return [
        '// Opción A: Gráfica como VENTANA FLOTANTE arrastrable sobre el visualizador',
        'const grafica = new IDEE.graphic({',
        '  title: ' + JSON.stringify(title) + ',',
        '  subtitle: "Mediciones horarias",',
        '  chartType: ' + JSON.stringify(chartType) + ',',
        '  data: [',
        '    { label: "08:00", value: 380 },',
        '    { label: "12:00", value: 720 },',
        '    { label: "16:00", value: 890 },',
        '    { label: "20:00", value: 540 }',
        '  ]',
        '});',
        '',
        'grafica.addToMap(mapajs, {',
        '  position: ' + JSON.stringify(pos) + ',',
        '  width: 380,',
        '  height: 250',
        '});'
      ].join('\n');
    }
    if (ext === 'dashboard') {
      const title = v.title || 'Monitor Territorial';
      const theme = v.theme || 'light';

      return [
        '// El cuadro de mandos orquesta visualizadores, gráficas, KPIs y tablas en un contenedor.',
        '// Ejemplo de inicialización de IDEE.dashboard:',
        'const dashboard = new IDEE.dashboard({',
        '  container: "mapaDIV",',
        '  theme: ' + JSON.stringify(theme) + ',',
        '  header: {',
        '    title: ' + JSON.stringify(title) + ',',
        '    subtitle: "Estadísticas territoriales conectadas"',
        '  },',
        '  components: [',
        '    {',
        '      id: "kpiTotal",',
        '      type: "kpi",',
        '      title: "Total Sensores",',
        '      value: "1.240",',
        '      unit: "uds",',
        '      trend: { direction: "up", text: "+12%" }',
        '    },',
        '    {',
        '      id: "graficaDonut",',
        '      type: "chart",',
        '      title: "Distribución por Categorías",',
        '      chartType: "donut",',
        '      data: [',
        '        { name: "Sector Norte", value: 420 },',
        '        { name: "Sector Sur", value: 310 },',
        '        { name: "Sector Centro", value: 580 }',
        '      ]',
        '    }',
        '  ]',
        '});'
      ].join('\n');
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
      return 'const capa = new IDEE.layer.MVT({\n  url: ' + JSON.stringify(v.url || '') + ',\n  layers: ' + JSON.stringify(v.layers || 'municipio') + ',\n  extract: ' + (v.extract ? 'true' : 'false') + ',\n  name: ' + JSON.stringify(v.name || 'MVT') + ',\n  legend: ' + JSON.stringify(v.legend || 'MVT') + '\n}, {});\nmapajs.addLayers(capa);';
    }
    // Genérico: plugin miPlugin_<ext>
    const color1 = { active: v.color1_active || '#ffffff', deactive: v.color1_deactive || 'orangered' };
    const color2 = { active: v.color2_active || '#71A7D3', deactive: v.color2_deactive || '#ffffff' };
    const color3 = { active: v.color3_active || '#71A7D3', deactive: v.color3_deactive || '#ffffff' };
    const opts = {
      position: v.position || 'TL',
      collapsible: v.collapsible !== false,
      order: (v.order != null ? Number(v.order) : 1),
      color1: color1,
      color2: color2,
      color3: color3
    };
    return 'const plugin = new IDEE.plugin.miPlugin_' + suffix + '(' + JSON.stringify(opts) + ');\nmapajs.addPlugin(plugin);';
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
        // Si la extensión tiene parámetros registrados, el ejemplo muestra
        // TODOS los parámetros de construcción (no el snippet reducido del README).
        const defsRegistrados = PARAMS[ext] || ( (window.IDEE || window.M).plugin && (window.IDEE || window.M).plugin['miPlugin_' + suffix] ? PLUGIN_PARAMS : null );
        if (defsRegistrados) {
          const vals = {};
          defsRegistrados.forEach(function (d) { vals[d.name] = d.default; });
          codigoEjemplo = plantillaConstructor(ext, vals);
        } else {
          let m = t.match(/```(?:javascript|js)\n([\s\S]*?)```/);
          if (!m) m = t.match(/```\n([\s\S]*?)```/);
          let candidato = m ? m[1].trim() : '';
          const pareceMarkdown = /(^|\n)#{1,6}\s|\n\|/.test(candidato) || !/[;{}()]/.test(candidato);
          if (m && !pareceMarkdown) {
            codigoEjemplo = candidato;
          } else {
            codigoEjemplo = 'const plugin = new IDEE.plugin.miPlugin_' + suffix + '({ position: "TL", collapsible: true, order: 1 });\nmapajs.addPlugin(plugin);';
          }
        }
        ejemplo.textContent = codigoEjemplo;
        // Si no hay formulario de parámetros, el textarea toma el ejemplo.
        if (!PARAMS[ext] && !(window.IDEE || window.M).plugin?.['miPlugin_' + suffix]) {
          constructorCode.value = codigoEjemplo;
        }
      } else {
        descExt.textContent = 'Sin README.md en la extensión.';
      }
    })
    .catch(function () { descExt.textContent = 'No se pudo leer el README.'; });

  // Parámetros comunes a los plugins basados en miPlugin_base.
  const PLUGIN_PARAMS = [
    { name: 'position', type: 'select', default: 'TL', label: 'Posición', options: ['TL', 'TR', 'BL', 'BR'] },
    { name: 'collapsible', type: 'boolean', default: true, label: 'Colapsable' },
    { name: 'order', type: 'number', default: 1, label: 'Orden' },
    { name: 'color1_active', type: 'text', default: '#ffffff', label: 'Color1 activo' },
    { name: 'color1_deactive', type: 'text', default: 'orangered', label: 'Color1 inactivo' },
    { name: 'color2_active', type: 'text', default: '#71A7D3', label: 'Color2 activo' },
    { name: 'color2_deactive', type: 'text', default: '#ffffff', label: 'Color2 inactivo' }
  ];

  // Renderizar formulario de parámetros si hay definición.
  let defs = PARAMS[ext];
  const api = window.IDEE || window.M;
  const suffix = pluginSuffix(ext);
  if (!defs && api && api.plugin && typeof api.plugin['miPlugin_' + suffix] === 'function') {
    defs = PLUGIN_PARAMS;
  }
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
    // Inicializar el textarea con TODOS los parámetros del formulario.
    actualizarCodigo();
  } else {
    // Sin formulario registrado: usar el ejemplo como código editable.
    constructorCode.value = codigoEjemplo;
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
    window.mapa();
  };
  s.onerror = function () {
    log('ERROR: no se pudo cargar ' + ext + '.js');
    descExt.textContent = 'No se pudo cargar el script de la extensión.';
    loading.style.display = 'none';
  };
  document.head.appendChild(s);

  window.mapa = function () {
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

    // Plugins comunes (selector de capas base, cambio 2D/3D, layerSwitcher, mapInfo, information).
    try {
      if (typeof prepararFondo === 'function') prepararFondo();
      const apiP = window.IDEE || window.M;
      if (apiP.plugin && apiP.plugin.miPlugin_cambioImpl) {
        map.addPlugin(new apiP.plugin.miPlugin_cambioImpl({ buttonTitle: 'Cambiar entre 2D y 3D', mapsFunction: window.mapa, shareView: true }));
      }
      if (typeof crearCapasBaseTipos === 'function' && apiP.plugin && apiP.plugin.miPlugin_baseLayer) {
        map.addPlugin(new apiP.plugin.miPlugin_baseLayer({ layers: crearCapasBaseTipos(), rows: 1, title: 'Capas base', order: 0 }));
      }
      if (apiP.plugin && apiP.plugin.miPlugin_layerSwitcher) {
        map.addPlugin(new apiP.plugin.miPlugin_layerSwitcher({ order: 1 }));
      }
      if (apiP.plugin && apiP.plugin.miPlugin_mapInfo) {
        map.addPlugin(new apiP.plugin.miPlugin_mapInfo({ order: 0, openPosition: 'bottom' }));
      }
      if (apiP.plugin && apiP.plugin.miPlugin_information) {
        map.addPlugin(new apiP.plugin.miPlugin_information({ position: 'TL', order: 2 }));
      }
      log('Plugins comunes añadidos (baseLayer, cambioImpl, layerSwitcher, mapInfo, information).');
    } catch (e) { log('Plugins comunes: ' + (e && e.message ? e.message : e)); }

    const clasePlugin = api.plugin && api.plugin['miPlugin_' + suffix];
    if (typeof clasePlugin === 'function' && ext !== 'attribution' && ext !== 'dashboard') {
      try {
        const plugin = new clasePlugin({ position: 'TL', collapsible: true, order: 1 });
        map.addPlugin(plugin);
        log('Plugin miPlugin_' + ext + ' añadido al mapa.');
      } catch (e) {
        log('No se pudo instanciar el plugin: ' + (e && e.message ? e.message : e));
      }
    } else if (ext !== 'attribution' && ext !== 'dashboard') {
      log('No hay miPlugin_' + ext + ' (puede ser una capa o utilidad).');
    }

    // MVT en 3D requiere instalar su fachada antes de crear la capa.
    if (ext === 'MVTLayer' && api.impl && api.impl.cesium && api.plugin && api.plugin.miPlugin_MVTLayer) {
      try { map.addPlugin(new api.plugin.miPlugin_MVTLayer()); log('miPlugin_MVTLayer instalado (3D).'); } catch (e) { log('MVTLayer plugin: ' + (e && e.message ? e.message : e)); }
    }

    // Ejecutar automáticamente el constructor para cargar la capa de ejemplo.
    setTimeout(function () {
      if (!map || !constructorCode) return;
      const code = constructorCode.value + '\n; try { window.__showcaseInstancia = (typeof capa !== "undefined" ? capa : (typeof plugin !== "undefined" ? plugin : null)); } catch (e) {}';
      if (!code || !code.trim()) return;
      try {
        const fn = new Function('map', 'mapajs', 'IDEE', 'M', code);
        fn(map, map, window.IDEE, window.M);
        log('Capa de ejemplo cargada automáticamente.');
      } catch (err) {
        log('Auto-carga falló: ' + (err && err.message ? err.message : err));
      }
    }, 500);

    loading.style.display = 'none';
    return map;
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

  // Reconstruir a partir del código editado: primero se elimina la instancia
  // anterior (capa o plugin) para evitar duplicados.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!map) { log('Mapa no listo'); return; }
    // Eliminar instancia anterior.
    if (window.__showcaseInstancia) {
      try { if (typeof window.__showcaseInstancia.destroy === 'function') window.__showcaseInstancia.destroy(); } catch (err) { /* noop */ }
      try { map.removeLayers(window.__showcaseInstancia); } catch (err) { /* noop */ }
      try { map.removePlugin(window.__showcaseInstancia); } catch (err) { /* noop */ }
      window.__showcaseInstancia = null;
      log('Instancia anterior eliminada.');
    }
    const code = constructorCode.value + '\n; try { window.__showcaseInstancia = (typeof capa !== "undefined" ? capa : (typeof plugin !== "undefined" ? plugin : null)); } catch (e) {}';
    try {
      const fn = new Function('map', 'mapajs', 'IDEE', 'M', code);
      fn(map, map, window.IDEE, window.M);
      log('Reconstrucción ejecutada.');
    } catch (err) {
      log('Error al ejecutar: ' + (err && err.message ? err.message : err));
    }
  });

  btnReset.addEventListener('click', function () {
    const defsActuales = PARAMS[ext] || ((window.IDEE || window.M).plugin && (window.IDEE || window.M).plugin['miPlugin_' + suffix] ? PLUGIN_PARAMS : null);
    if (defsActuales) {
      const vals = {};
      defsActuales.forEach(function (d) {
        vals[d.name] = d.default;
        const el = formFields.querySelector('[data-param="' + d.name + '"]');
        if (el) {
          if (d.type === 'boolean') el.checked = !!d.default;
          else if (d.type === 'select') el.value = (d.default == null ? '' : d.default);
          else el.value = (d.default == null ? '' : d.default);
        }
      });
      constructorCode.value = plantillaConstructor(ext, vals);
    } else if (codigoEjemplo) {
      constructorCode.value = codigoEjemplo;
    }
    log('Ejemplo restaurado.');
  });
})();
