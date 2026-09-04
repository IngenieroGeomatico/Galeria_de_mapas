/* =====================================================================
   miPlugin_baseLayer — selector de capas base con previsualización
   ---------------------------------------------------------------------
   Muestra un grid de imágenes cuadradas que funcionan como radiobuttons.
   Cada capa base se define con un "imgPreview" (URL de la miniatura).

   Parámetros del constructor (options):
     layers           Array de capas base. Cada elemento:
                        { id, title, layers, imgPreview }
                      Si se omite, se usa IDEE.config.backgroundlayers.
     rows             Nº de filas del grid (por defecto 1).
     noBaseLayer      true | { imgPreview, title } — añade una opción
                      "Sin mapa base" (imagen blanca por defecto).
     position         Posición del panel (por defecto IDEE.ui.position.TL).
     title            Título del panel (por defecto "Capas base").
     initActiveLayer  Capa base activa al iniciar el visualizador. Puede ser:
                        - el id de una capa (string)
                        - la posición (número, 0 = primera capa base). La
                          opción "Sin mapa base", si existe, va SIEMPRE al
                          final de la lista.
                      Gana sobre la selección guardada en localStorage.
   ===================================================================== */
class miPlugin_baseLayer {
  constructor(options = {}) {
    this.name = 'miPlugin_baseLayer';
    this.options = options || {};
    // Colores configurables. Cada uno puede ser un color (string) o un
    // objeto {active, deactive}:
    //   color1 = fondo, color2 = borde (botón+panel), color3 = icono/flecha.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
  }

  // Devuelve {active, deactive} a partir de un color simple o un objeto.
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
  }

  getHelp() {
    return {
      title: 'Selector de capas base',
      content: new Promise(function (success) {
        var html = '<div><p>Selector visual de capas base del mapa.</p></div>';
        try { html = IDEE.utils.stringToHtml(html); } catch (e) {}
        success(html);
      }),
    };
  }

  addTo(map) {
    var opts = this.options;
    var panelTitle = opts.title || 'Capas base';
    var rows = (typeof opts.rows === 'number' && opts.rows >= 1) ? opts.rows : 1;
    var position = opts.position || IDEE.ui.position.TL;

    // ── Construir la lista de capas ────────────────────────────────────
    var baseLayers = Array.isArray(opts.layers) && opts.layers.length
      ? opts.layers
      : (IDEE.config.backgroundlayers || []);

    // Imagen blanca 1×1 en base64 para la opción "sin mapa base".
    var blankImg = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#fff"/></svg>'
    );

    // Lista de items: las capas base primero y la opción "sin mapa base"
    // al final (si se usa initActiveLayer por posición, el índice de la
    // opción "sin mapa base" es la última posición de la lista).
    var items = [];
    baseLayers.forEach(function (l) { items.push(l); });
    if (opts.noBaseLayer) {
      var nbl = (typeof opts.noBaseLayer === 'object') ? opts.noBaseLayer : {};
      items.push({
        id: '__none__',
        title: nbl.title || 'Sin mapa base',
        layers: [],
        imgPreview: nbl.imgPreview || blankImg,
      });
    }

    // ── Panel IDEE ────────────────────────────────────────────────────
    var panel = new IDEE.ui.Panel('toolsExtra_baseLayer', {
      collapsible: true,
      className: 'g-herramienta_baseLayer',
      collapsedButtonClass: 'm-tools',
      position: position,
    });

    var control = new IDEE.Control(new IDEE.impl.Control(), 'controlBackgroundLayer');
    control.createView = function () { return document.createElement('div'); };
    panel.addControls(control);
    map.addPanels(panel);

    // ── Aplicar colores configurables (color1=fondo, color2=borde, color3=icono) ──
    // Se inyectan 6 variables CSS (estado normal y ".opened/active") mediante un
    // bloque <style> con ámbito al .m-panel del plugin. Un <style> en <head>
    // sobrevive a los re-renders que IDEE hace del panel (baseLayer / cambioImpl
    // no son fiables con estilo inline en addTo), por lo que es el método robusto.
    var c1 = this.resolveColor(this.color1);
    var c2 = this.resolveColor(this.color2);
    var c3 = this.resolveColor(this.color3);
    var styleId = 'g-plugin-colores-baseLayer';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.appendChild(document.createTextNode(
        '.m-areas>div.m-area>div.m-panel.g-herramienta_baseLayer,' +
        '.m-panel.g-herramienta_baseLayer,' +
        '.g-herramienta_baseLayer .m-herramienta-header,' +
        '.g-herramienta_baseLayer>button{' +
        '--g-plugin-bg-color:' + c1.deactive + ';' +
        '--g-plugin-bg-color-active:' + c1.active + ';' +
        '--g-plugin-border-color:' + c2.deactive + ';' +
        '--g-plugin-border-color-active:' + c2.active + ';' +
        '--g-plugin-icon-color:' + c3.deactive + ';' +
        '--g-plugin-icon-color-active:' + c3.active + ';}' +
        '.m-panel.g-herramienta_baseLayer.opened{' +
        '--g-plugin-bg-color:' + c1.active + ';' +
        '--g-plugin-bg-color-active:' + c1.active + ';' +
        '--g-plugin-border-color:' + c2.active + ';' +
        '--g-plugin-border-color-active:' + c2.active + ';' +
        '--g-plugin-icon-color:' + c3.active + ';' +
        '--g-plugin-icon-color-active:' + c3.active + ';}'
      ));
      (document.head || document.documentElement).appendChild(styleEl);
    }

    // Inyectar el HTML del panel sobre el contenedor que crea IDEE.
    var panelCtrl = document.querySelector('.g-herramienta_baseLayer .m-panel-controls');
    if (panelCtrl) {
      panelCtrl.innerHTML =
        '<div aria-label="cambio capa base" role="menuitem" ' +
        'id="div-contenedor-herramienta-baseLayer" ' +
        'class="m-control m-container m-herramienta">' +
        '<header role="heading" tabindex="0" ' +
        'id="m-herramienta-title-baseLayer" ' +
        'class="m-herramienta-header">' + panelTitle + '</header>' +
        '<section id="m-herramienta-baseLayer" class="m-herramienta-baseLayer"></section>' +
        '<div id="m-herramienta-contents-baseLayer"></div></div>';
    }
    var contentsEl = document.querySelector('#m-herramienta-contents-baseLayer');
    if (contentsEl) contentsEl.appendChild(control.getElement());
    IDEE.utils.draggabillyPlugin(panel, '#m-herramienta-title-baseLayer');

    // ── Calcular columnas a partir de filas ────────────────────────────
    var cols = Math.ceil(items.length / rows);

    // ── Generar el grid de imágenes ───────────────────────────────────
    // Estructura por item: imagen cuadrada + barra de título al pie
    // (el texto del pie es legible, al contrario que el overlay centrado).
    var htmlItems = items.map(function (layer) {
      var img = layer.imgPreview || blankImg;
      var safeId = (layer.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      return '<label class="bl-item" data-bl-id="' + layer.id + '" title="' + (layer.title || '') + '">' +
        '<input type="radio" name="bl-selector" value="' + layer.id + '" class="bl-radio">' +
        '<div class="bl-thumb">' +
        '<img src="' + img + '" alt="' + (layer.title || '') + '" class="bl-img" draggable="false">' +
        '<span class="bl-title">' + (layer.title || '') + '</span>' +
        '</div>' +
        '</label>';
    }).join('');

    var gridHtml =
      // Tamaño FIJO de columna (110px): cada miniatura mide siempre lo
      // mismo independientemente del nº de capas. El panel (contenedor
      // .m-herramienta) se adapta automáticamente al número de columnas.
      '<div class="bl-grid" style="grid-template-columns:repeat(' + cols + ', 110px)">' +
      htmlItems + '</div>';

    // ── Función de cambio de capa base ─────────────────────────────────
    var changeBase = function (layerId) {
      // Quitar la capa base actual.
      var currentBase = map.getBaseLayers();
      if (currentBase && currentBase.length) {
        currentBase.forEach(function (l) { try { map.removeLayers(l); } catch (e) {} });
      }
      if (layerId === '__none__') {
        localStorage.setItem('baseLayer_ID', layerId);
        return;
      }
      var selected = items.find(function (l) { return l.id === layerId; });
      if (!selected) return;
      map.addLayers(selected.layers);
      localStorage.setItem('baseLayer_ID', layerId);
    };

    // ── Activar ───────────────────────────────────────────────────────
    control.activate = function () {
      var section = document.querySelector('#m-herramienta-baseLayer');
      if (!section) return;
      section.innerHTML = gridHtml;

      // Escuchar cambios en los radios.
      section.querySelectorAll('.bl-radio').forEach(function (radio) {
        radio.addEventListener('change', function () {
          if (this.checked) changeBase(this.value);
        });
      });

      // ── Resolver el radio a marcar al iniciar ─────────────────────────
      // Precedencia:
      //   1. initActiveLayer definido por el usuario (por id o por posición).
      //   2. Selección guardada en localStorage.
      //   3. Primer item de la lista.
      var target = null;

      if (opts.initActiveLayer !== undefined && opts.initActiveLayer !== null) {
        var ial = opts.initActiveLayer;
        if (typeof ial === 'string') {
          // Por id de la capa.
          target = section.querySelector('.bl-radio[value="' + ial + '"]');
        } else if (typeof ial === 'number') {
          // Por posición (índice). Permite elegir también la opción
          // "Sin mapa base" si está en esa posición.
          var radios = section.querySelectorAll('.bl-radio');
          target = (ial >= 0 && ial < radios.length) ? radios[ial] : null;
        }
      }

      if (!target) {
        var saved = localStorage.getItem('baseLayer_ID');
        target = saved
          ? section.querySelector('.bl-radio[value="' + saved + '"]')
          : null;
      }
      if (!target) target = section.querySelector('.bl-radio');

      if (target) {
        requestAnimationFrame(function () {
          target.checked = true;
          target.dispatchEvent(new Event('change'));
        });
      }
    };

    control.deactivate = function () {};
    control.activate();
  }
}

// Exponer la clase en el namespace IDEE.plugin
if (typeof window !== 'undefined') {
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_baseLayer = miPlugin_baseLayer;
}
