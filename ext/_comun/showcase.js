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

  let map = null;
  let instanciaActual = null;
  let codigoEjemplo = '';

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

  // Leer README para descripción y ejemplo.
  fetch('../' + ext + '/README.md')
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (t) {
      if (t) {
        const parrafo = t.split(/\n\s*\n/)[0] || t.slice(0, 400);
        descExt.textContent = parrafo.replace(/^#+\s*/gm, '').slice(0, 600);
        descExt.classList.remove('aviso');
        // Extraer primer bloque de código cercado.
        const m = t.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
        if (m) {
          codigoEjemplo = m[1].trim();
          ejemplo.textContent = codigoEjemplo;
          constructorCode.value = codigoEjemplo;
        } else {
          codigoEjemplo = 'const capa = new IDEE.layer.' + ext + '({\n  // parámetros\n});\nmapajs.addLayers(capa);';
          ejemplo.textContent = codigoEjemplo;
          constructorCode.value = codigoEjemplo;
        }
      } else {
        descExt.textContent = 'Sin README.md en la extensión.';
      }
    })
    .catch(function () { descExt.textContent = 'No se pudo leer el README.'; });

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

    // Instanciar plugin si existe.
    const clasePlugin = api.plugin && api.plugin['miPlugin_' + ext];
    if (typeof clasePlugin === 'function') {
      try {
        const plugin = new clasePlugin({ position: 'TL', collapsible: true, order: 1 });
        map.addPlugin(plugin);
        instanciaActual = plugin;
        log('Plugin miPlugin_' + ext + ' añadido al mapa.');
      } catch (e) {
        log('No se pudo instanciar el plugin: ' + (e && e.message ? e.message : e));
      }
    } else {
      log('No hay miPlugin_' + ext + ' (puede ser una capa o utilidad).');
    }

    loading.style.display = 'none';
  }

  // Reconstruir a partir del código editado.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!map) { log('Mapa no listo'); return; }
    const code = constructorCode.value;
    try {
      // eslint-disable-next-line no-eval
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
