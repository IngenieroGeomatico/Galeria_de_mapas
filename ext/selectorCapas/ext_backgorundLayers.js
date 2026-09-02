/* =====================================================================
   miPlugin_baseLayer — selector de capas base con previsualización
   ---------------------------------------------------------------------
   Muestra un grid de imágenes cuadradas que funcionan como radiobuttons.
   Cada capa base se define con un "imgPreview" (URL de la miniatura).

   Parámetros del constructor (options):
     layers       Array de capas base. Cada elemento:
                    { id, title, layers, imgPreview }
                  Si se omite, se usa IDEE.config.backgroundlayers.
     rows         Nº de filas del grid (por defecto 1).
     noBaseLayer  true | { imgPreview, title } — añade una opción
                  "Sin mapa base" (imagen blanca por defecto).
     position     Posición del panel (por defecto IDEE.ui.position.TL).
     title        Título del panel (por defecto "Capas base").
   ===================================================================== */
class miPlugin_baseLayer {
  constructor(options = {}) {
    this.name = 'miPlugin_baseLayer';
    this.options = options || {};
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

    // Opción "sin mapa base": se inserta al principio de la lista.
    var items = [];
    if (opts.noBaseLayer) {
      var nbl = (typeof opts.noBaseLayer === 'object') ? opts.noBaseLayer : {};
      items.push({
        id: '__none__',
        title: nbl.title || 'Sin mapa base',
        layers: [],
        imgPreview: nbl.imgPreview || blankImg,
      });
    }
    baseLayers.forEach(function (l) { items.push(l); });

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
    // El título se muestra superpuesto en el centro de la imagen (overlay),
    // con un efecto visual en hover gestionado desde el CSS.
    var htmlItems = items.map(function (layer) {
      var img = layer.imgPreview || blankImg;
      var safeId = (layer.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      return '<label class="bl-item" data-bl-id="' + layer.id + '" title="' + (layer.title || '') + '">' +
        '<input type="radio" name="bl-selector" value="' + layer.id + '" class="bl-radio">' +
        '<div class="bl-thumb">' +
        '<img src="' + img + '" alt="' + (layer.title || '') + '" class="bl-img" draggable="false">' +
        '<span class="bl-label">' + (layer.title || '') + '</span>' +
        '</div>' +
        '</label>';
    }).join('');

    var gridHtml =
      '<div class="bl-grid" style="grid-template-columns:repeat(' + cols + ', minmax(0,1fr))">' +
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

      // Restaurar selección guardada o usar la primera.
      var saved = localStorage.getItem('baseLayer_ID');
      var target = saved
        ? section.querySelector('.bl-radio[value="' + saved + '"]')
        : null;
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
