(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const ext = params.get('ext') || params.get('plugin') || '';
  const titulo = document.getElementById('titulo');
  const nombreExt = document.getElementById('nombreExt');
  const descExt = document.getElementById('descExt');
  const consola = document.getElementById('consola');
  const loading = document.getElementById('loading');

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

  // Intentar leer el README de la extensión como descripción.
  fetch('../' + ext + '/README.md')
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (t) {
      if (t) {
        // Mostrar solo el primer párrafo (hasta la primera línea en blanco).
        const parrafo = t.split(/\n\s*\n/)[0] || t.slice(0, 400);
        descExt.textContent = parrafo.replace(/^#+\s*/gm, '').slice(0, 600);
        descExt.classList.remove('aviso');
      } else {
        descExt.textContent = 'Sin README.md en la extensión.';
      }
    })
    .catch(function () { descExt.textContent = 'No se pudo leer el README.'; });

  // Cargar el CSS de la extensión si existe.
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '../' + ext + '/' + ext + '.css';
  link.onerror = function () { /* sin css, no pasa nada */ };
  document.head.appendChild(link);

  // Cargar el JS de la extensión.
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

    const map = api.map({
      container: 'mapaDIV',
      zoom: 6,
      center: { x: -3.70379, y: 40.41678 }  // Madrid (lon/lat en 4326? OL espera 3857)
    });
    // En OL el centro debe ir en 3857; reintentar con proyección si la API lo permite.
    try {
      if (api.utils && typeof api.utils.reproject === 'function') {
        const c = api.utils.reproject([-3.70379, 40.41678], 'EPSG:4326', 'EPSG:3857');
        map.setCenter({ x: c[0], y: c[1] });
      }
    } catch (e) { /* noop */ }

    window.mapajs = map;
    log('Mapa creado.');

    // Intentar instanciar un plugin miPlugin_<ext> si existe.
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
})();
