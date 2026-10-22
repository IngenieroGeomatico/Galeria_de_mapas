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
    // Posición del panel dentro de la esquina elegida (área `.m-area`, que la
    // API monta como flex column). Es un valor CSS `order`, no un índice: lo
    // aplica la propia API haciendo style.order sobre el panel, así que no hay
    // que reordenar el DOM a mano.
    // Los paneles sin `order` valen 0, así que:
    //   order: -1  => por delante de todos (los negativos van antes que el 0);
    //   order: 0   => primera posición, empatada con los que no llevan order;
    //   order: 2   => detrás de los que van en 0;
    //   order: 99  => al final de la esquina;
    //   null       => sin valor explícito: donde lo deje la API.
    this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
      ? Number(options.order)
      : null;
    // Colores configurables. Cada uno puede ser un color (string) o un
    // objeto {active, deactive}:
    //   color1 = fondo, color2 = borde (botón+panel), color3 = icono/flecha.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
    this._activeLayerId = null;
    // Referencia al panel IDEE (para preservar abierto/colapsado en el swap 2D/3D)
    this._panel = null;
    // Barra supraplugin anadida (ver getSupraElement mas abajo):
    // boton en la barra y panel en el mapa.
    this.supra = null;
    this._supraWrap = null;
    this._supraBoton = null;
    this._syncDoc = null;
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

  // ── Item del supraplugin: el boton vive en la barra, el panel en el mapa ──
  // Colgado con `supra.addItem(this)`, la barra pone aqui el boton y el panel
  // sigue siendo el que `addTo(map)` coloca en el mapa: la barra solo cambia
  // donde esta el mando. Por eso el boton redondo que la API pinta en el area
  // (BUTTON.m-panel-btn) se esconde, para no dejar dos puertas al mismo panel.
  //
  // El boton reutiliza las clases de la barra (supra-bar__boton y las suyas) a
  // proposito: hereda solos el tema claro/oscuro y el color de marca por las
  // variables --supra-*, sin duplicar aqui la paleta.
  getSupraElement(supra) {
    this.supra = supra || null;
    this._supraWrap = this._construirSupraUI();
    this._ocultarBotonDelMapa();
    this._sincronizarSupra();
    return this._supraWrap;
  }

  // Construye el boton de la barra. Devuelve el nodo raiz que se mete en la
  // ranura del item.
  _construirSupraUI() {
    const self = this;
    const wrap = document.createElement('div');
    wrap.className = 'bl-supra__wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    // Con `conTexto` en el constructor de la barra el boton lleva tambien
    // su etiqueta; sin ella es solo icono (y cuadrado, por --solo).
    const conTexto = !!(this.supra && this.supra.options && this.supra.options.conTexto);
    btn.className = 'supra-bar__boton ' + (conTexto ? '' : 'supra-bar__boton--solo ') + 'bl-supra__boton';
    btn.title = (this.options.tituloBarra || this.options.title || 'Capas base');
    btn.setAttribute('aria-label', (this.options.tituloBarra || this.options.title || 'Capas base'));
    btn.setAttribute('aria-expanded', 'false');

    const icono = document.createElement('span');
    icono.className = 'supra-bar__boton-icono bl-supra__icono';
    icono.setAttribute('aria-hidden', 'true');

    btn.appendChild(icono);
      if (conTexto) {
        const texto = document.createElement("span");
        texto.className = "supra-bar__boton-texto";
        texto.textContent = btn.title;
        btn.appendChild(texto);
      }
    btn.addEventListener('click', function (evt) {
      evt.preventDefault();
      // El gesto se queda aqui: la API registra un cierre de paneles al pulsar
      // fuera, y el click se propagaria hasta el suyo.
      evt.stopPropagation();
      self._alternarPanelDesdeBarra();
    });

    wrap.appendChild(btn);
    this._supraBoton = btn;

    // El panel tambien se pliega desde fuera (la API lo cierra al pulsar fuera),
    // asi que el boton se resincroniza en cada clic del documento. Va en fase de
    // captura para que lo vea aunque alguien detenga la propagacion.
    if (!this._syncDoc && typeof document !== 'undefined') {
      this._syncDoc = function () { self._sincronizarSupra(); };
      document.addEventListener('click', this._syncDoc, true);
    }

    return wrap;
  }

  // Abre el panel si esta plegado y lo pliega si esta abierto.
  _alternarPanelDesdeBarra() {
    if (!this._panel) return;
    try {
      if (this._panelColapsado()) this._panel.open();
      else this._panel.collapse();
    } catch (e) {
      console.warn('[miPlugin_baseLayer] no se pudo alternar el panel:', e);
    }
    this._sincronizarSupra();
  }

  // ¿Esta el panel plegado? Misma cadena de recursos que usa getState(), para
  // que el boton y el estado guardado no se contradigan.
  _panelColapsado() {
    if (!this._panel) return true;
    if (this._panel._collapsed !== undefined) return !!this._panel._collapsed;
    if (typeof this._panel.isCollapsed === 'function') {
      try { return !!this._panel.isCollapsed(); } catch (e) { /* sigue */ }
    }
    const el = this._elementoPanel();
    return el ? el.classList.contains('collapsed') : true;
  }

  _sincronizarSupra() {
    if (!this._supraBoton) return;
    const abierto = !this._panelColapsado();
    this._supraBoton.classList.toggle('supra-bar__boton--activo', abierto);
    this._supraBoton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  }

  // Esconde el boton propio de la API mientras el plugin viva en la barra.
  _ocultarBotonDelMapa() {
    const el = this._elementoPanel();
    if (el) el.classList.add('g-panel-en-barra');
  }

  // Restaura el boton de la API y suelta el boton de la barra.
  _destruirSupra() {
    if (this._syncDoc && typeof document !== 'undefined') {
      document.removeEventListener('click', this._syncDoc, true);
    }
    this._syncDoc = null;
    const el = this._elementoPanel();
    if (el) el.classList.remove('g-panel-en-barra');
    if (this._supraWrap && this._supraWrap.parentNode) {
      this._supraWrap.parentNode.removeChild(this._supraWrap);
    }
    this._supraWrap = null;
    this._supraBoton = null;
    this.supra = null;
  }

  // El nodo del panel, por el camino que lo fue la API.
  _elementoPanel() {
    const pan = this._panel;
    if (!pan) return null;
    // MEDIDO: IDEE.ui.Panel no expone getElement(); su prototipo trae
    // getButtonPanel() y el campo _element. Se van probando los dos caminos.
    try { if (pan._element) return pan._element; } catch (e) { /* sigue */ }
    try {
      const btn = (typeof pan.getButtonPanel === 'function') ? pan.getButtonPanel() : null;
      if (btn && btn.parentElement) return btn.parentElement;
    } catch (e) { /* sigue */ }
    return null;
  }

  // ── Coordinación de estado (swap 2D/3D con cambioImpl) ───────────────
  // Captura el identificador de la capa base actualmente seleccionada y el
  // estado abierto/colapsado del panel (que se conserva en el swap 2D/3D).
  getState() {
    let activeId = this._activeLayerId;
    if (!activeId && typeof document !== 'undefined') {
      try {
        const checked = document.querySelector('#m-herramienta-baseLayer .bl-radio:checked');
        if (checked && checked.value) {
          activeId = checked.value;
        }
      } catch (e) {}
    }
    if (!activeId && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('baseLayer_ID');
        if (saved) activeId = saved;
      } catch (e) {}
    }

    // Estado abierto/colapsado del panel (se conserva en el swap 2D/3D).
    let panelCollapsed = true;
    if (this._panel) {
      if (this._panel._collapsed !== undefined) {
        panelCollapsed = !!this._panel._collapsed;
      } else if (typeof this._panel.getElement === 'function') {
        const el = this._panel.getElement();
        panelCollapsed = el ? el.classList.contains('collapsed') : true;
      }
    }

    // Aunque no haya capa activa, se captura el estado del panel (por ejemplo
    // user con el selector abierto pero sin capa seleccionada).
    return {
      activeLayerId: activeId || null,
      panelCollapsed,
    };
  }

  // Restaura la capa base seleccionada en la nueva instancia tras el reinicio del mapa.
  // Selecciona el radio button en la UI y aplica la capa base mediante changeBase.
  setState(state, map) {
    if (!state || typeof state !== 'object') return;

    // Estado del panel (abierto/colapsado) tras el reinicio del mapa (swap 2D/3D).
    if (state.panelCollapsed !== undefined && this._panel) {
      try {
        if (state.panelCollapsed && typeof this._panel.collapse === 'function') {
          this._panel.collapse();
        } else if (!state.panelCollapsed && typeof this._panel.open === 'function') {
          this._panel.open();
        }
      } catch (e) {
        console.warn('[miPlugin_baseLayer] Error al restaurar el estado del panel:', e);
      }
    }
    this._sincronizarSupra();

    if (!state.activeLayerId) return;
    const targetId = String(state.activeLayerId);
    this._activeLayerId = targetId;
    if (this.options) {
      this.options.initActiveLayer = targetId;
    }
    const mapRef = map || this._map;

    // Si la UI ya está renderizada en el DOM, marcar el radio y disparar su evento
    if (typeof document !== 'undefined') {
      const section = document.querySelector('#m-herramienta-baseLayer');
      if (section) {
        const radio = section.querySelector('.bl-radio[value="' + targetId + '"]');
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
          return;
        }
      }
    }

    // Fallback: invocar _changeBase si está disponible
    if (typeof this._changeBase === 'function') {
      try {
        this._changeBase(targetId);
        return;
      } catch (e) {}
    }

    // Fallback defensivo: aplicar directamente al mapa si la UI aún no se ha montado
    if (mapRef && Array.isArray(this._items)) {
      try {
        const currentBase = (typeof mapRef.getBaseLayers === 'function') ? mapRef.getBaseLayers() : null;
        if (currentBase && currentBase.length) {
          currentBase.forEach(function (l) { try { mapRef.removeLayers(l); } catch (e) {} });
        }
        if (targetId !== '__none__') {
          const selected = this._items.find(function (l) { return l.id === targetId; });
          if (selected && selected.layers && typeof mapRef.addLayers === 'function') {
            mapRef.addLayers(selected.layers);
            // Las capas base las construye la API a partir de su catálogo, y su
            // wrapX sale del defecto de cada clase de fuente (las TMS con true y
            // las WMTS con false). Se igualan a true para que todas den la vuelta
            // al mundo. Ver window.miWrapX en ext_layerSwitcher.js.
            if (window.miWrapX) window.miWrapX.aplica(mapRef);
          }
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('baseLayer_ID', targetId);
        }
      } catch (e) {}
    }
  }

  addTo(map) {
    var self = this;
    this._map = map;
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
    // this._control se guarda para que destroy() pueda soltar el control del
    // mapa (y con el el panel) cuando el plugin se desmonta.
    var panel = new IDEE.ui.Panel('toolsExtra_baseLayer', {
      collapsible: true,
      className: 'g-herramienta_baseLayer',
      collapsedButtonClass: 'm-tools',
      position: position,
      // `order` lo aplica la propia API: IDEE.ui.Panel hace style.order sobre el
      // panel dentro del area (flex column). Es un valor CSS `order`, no un indice.
      order: this.order,
    });

    var control = new IDEE.Control(new IDEE.impl.Control(), 'controlBackgroundLayer');
    control.createView = function () { return document.createElement('div'); };
    // La API compara controles con equals() para retirarlos del panel
    // (IDEE.ui.Panel.removeControls) y del mapa. Sin este metodo, destroy() ->
    // map.removeControls() revienta con "e.equals is not a function" y el panel
    // se queda colgado en el mapa. Estricto a proposito: un equals laxo
    // ("other instanceof IDEE.Control") desregistraria tambien los controles de
    // los demas plugins al quitar este.
    control.equals = function (other) {
      return other === this;
    };
    panel.addControls(control);
    map.addPanels(panel);
    // Guardamos las referencias que necesita destroy(): el panel para poder
    // restablecer su estado abierto/colapsado tras un cambio de implementación
    // 2D<->3D, y el control para soltarlo del mapa al desmontar.
    this._panel = panel;
    this._control = control;

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

    // ── Capas que trajo la última selección ─────────────────────────────
    // Quitar `getBaseLayers()` no basta en 3D: el impl de Cesium solo contempla
    // UNA capa base (`getBaseLayers() { return this.getLayers().filter(l => l.isBase === true) }`)
    // y, además, quitar un LayerGroup no se lleva a sus hijas (medido: siguen
    // como capas sueltas). Con el Híbrido eso dejaba el nomenclátor pintado
    // sobre la base siguiente (medido: 2 imageries al pasar a Imagen y 3 al
    // volver). Guardando la diferencia de `getLayers()` antes/después de
    // `addLayers` sabemos exactamente qué hay que quitar la próxima vez: sirva
    // para una capa suelta (WMTS/TMS) o para un grupo con sus hijas.
    var anadidas = [];

    var quitarAnadidas = function () {
      if (!anadidas.length) return;
      var lote = anadidas;
      anadidas = [];
      try {
        map.removeLayers(lote);
      } catch (e) {
        lote.forEach(function (l) { try { map.removeLayers(l); } catch (err) {} });
      }
    };

    // ── Función de cambio de capa base ─────────────────────────────────
    var changeBase = function (layerId) {
      self._activeLayerId = layerId;
      // Quitar la capa base actual.
      var currentBase = map.getBaseLayers();
      if (currentBase && currentBase.length) {
        currentBase.forEach(function (l) { try { map.removeLayers(l); } catch (e) {} });
      }
      // Y lo que trajo la selección anterior (grupos e hijas incluidas).
      quitarAnadidas();
      if (layerId === '__none__') {
        localStorage.setItem('baseLayer_ID', layerId);
        return;
      }
      var selected = items.find(function (l) { return l.id === layerId; });
      if (!selected) return;

      // Solución temporal: Si la capa a añadir es un grupo que ya contiene capas
      // base, evitar añadirlo si ya están presentes en el mapa para no duplicar.
      // En un futuro, el plugin debería gestionar el estado de visibilidad
      // interno de los grupos en lugar de añadir/quitar capas.
      var yaPresentes = selected.layers.filter(function (l) {
        return map.getLayers().indexOf(l) !== -1;
      });
      if (yaPresentes.length === selected.layers.length) return;

      // Aviso a las extensiones de capas antes de añadir la base: el Híbrido de
      // 3D necesita rehacer las banderas de sus hijas (en Cesium la capa base va
      // al fondo y esas banderas se estropean al quitar el grupo). Mismo patrón
      // que `window.miWrapX.aplica(map)` de más abajo, y opcional.
      try {
        if (window.quicklayers_cesium && typeof window.quicklayers_cesium.antesDeAnadirBase === 'function') {
          window.quicklayers_cesium.antesDeAnadirBase();
        }
      } catch (e) {}
      var antes = map.getLayers().slice();
      map.addLayers(selected.layers);
      anadidas = map.getLayers().filter(function (l) { return antes.indexOf(l) === -1; });
      // Ver el comentario del otro alta: el wrapX de las capas base sale del
      // defecto de cada clase de fuente y se iguala a true (window.miWrapX).
      if (window.miWrapX) window.miWrapX.aplica(map);
      localStorage.setItem('baseLayer_ID', layerId);
    };
    this._changeBase = changeBase;
    this._items = items;

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

  // Destruccion. map.removePlugins() de la API la exige: sin este metodo lanza
  // "t.destroy is not a function" y aborta el resto del lote de plugins.
  // Suelta el control del mapa (la API se lleva el panel con el) y anula las
  // referencias. Los listeners de los radios viven dentro del HTML del panel,
  // asi que se van con el.
  destroy() {
      this._destruirSupra();
    try {
      if (this._map && this._control) this._map.removeControls([this._control]);
    } catch (e) { /* ignora si el mapa o el control ya no estan */ }
    this._control = null;
    this._map = null;
    this._panel = null;
    this._activeLayerId = null;
  }
}

// Exponer la clase en los namespaces IDEE.plugin y M.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_baseLayer = miPlugin_baseLayer;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_baseLayer = miPlugin_baseLayer;
  window.M = window.M || {};
  window.M.plugin = window.M.plugin || {};
  window.M.plugin.miPlugin_baseLayer = miPlugin_baseLayer;
}
