/* =====================================================================
   CatalogoColocacion: formulario para colocar recursos no georreferenciados
   ---------------------------------------------------------------------
   Los ficheros que carga el catálogo no siempre saben dónde van. Un WMS trae
   su extensión en el documento de capacidades y una plantilla XYZ la lleva en
   la propia URL, pero un `.glb` es solo una malla y una foto no guarda ni las
   coordenadas ni el tamaño en metros. Para esos dos casos (ver TIPOS_COLOCABLES
   en catalogo_url.js) hay que decir a mano:

     - DÓNDE va: un punto (longitud, latitud y cota) o un rectángulo.
     - CÓMO se orienta y se escala: giro, inclinación, alabeo y escala.
     - CUÁNTO mide, en el caso de una imagen colocada por punto.

   Este módulo construye ese formulario y resuelve las tres formas de rellenar
   la posición sin escribir números:

     - «Centro del mapa»: toma el centro de la vista actual.
     - «Pinchar en el mapa»: el siguiente clic deja el punto.
     - «Vista actual»: el rectángulo que se está viendo, como bbox.
     - «Dibujar rectángulo»: arrastrar sobre el mapa (solo 2D; en Cesium la
       cámara mira inclinada y el arrastre no define un rectángulo limpio, así
       que se ofrece la vista actual o las coordenadas a mano).

   El estado del formulario es un objeto serializable, porque el catálogo lo
   guarda en su getState()/setState() y tiene que sobrevivir al cambio 2D/3D:

     {
       modo: 'position' | 'bbox',
       lon, lat, height,              // punto, en EPSG:4326 y metros
       bbox: [o, s, e, n] | null,     // rectángulo, en EPSG:4326
       heading, pitch, roll, scale,
       ancho, alto, metrosPorPixel,   // solo imagen por punto
       ajustarABbox, baseAlSuelo, clampToGround,
       vistaPrevia
     }

   La conversión de ese estado a los parámetros que esperan ext/glbLayer y
   ext/imageLayer la hace getValor(); el formulario no conoce las capas.
   ===================================================================== */
(function () {
  'use strict';

  /** Estado de partida: un punto sin rellenar, sin giro y a escala 1. */
  const ESTADO_POR_DEFECTO = {
    modo: 'position',
    lon: null,
    lat: null,
    height: 0,
    bbox: null,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    ancho: null,
    alto: null,
    metrosPorPixel: null,
    ajustarABbox: false,
    baseAlSuelo: true,
    clampToGround: true,
    vistaPrevia: false
  };

  /** ¿El mapa es la implementación de Cesium? Mismo criterio que cambioImpl. */
  function esCesium(mapa) {
    try {
      const impl = (mapa && typeof mapa.getMapImpl === 'function') ? mapa.getMapImpl() : null;
      return !!(impl && impl.scene && impl.scene.camera &&
        typeof window.Cesium !== 'undefined');
    } catch (e) {
      return false;
    }
  }

  /** La API, con los dos alias que conviven en el repositorio. */
  function api() {
    return window.IDEE || window.M;
  }

  /** Número finito o null. Un campo vacío no es un cero. */
  function aNumero(valor) {
    if (valor === null || valor === undefined) return null;
    const texto = String(valor).trim().replace(',', '.');
    if (texto === '') return null;
    const n = Number(texto);
    return isFinite(n) ? n : null;
  }

  /**
   * ¿Es un número de verdad? `isFinite(null)` es true (Number(null) es 0),
   * así que no sirve para distinguir un campo vacío de un cero.
   */
  function esNumero(valor) {
    return typeof valor === 'number' && isFinite(valor);
  }

  /** Copia del estado, para no entregar la referencia interna. */
  function clonar(estado) {
    const copia = {};
    Object.keys(estado).forEach(function (k) {
      copia[k] = Array.isArray(estado[k]) ? estado[k].slice() : estado[k];
    });
    return copia;
  }

  /** Centro de la vista en grados. En 2D llega en 3857 y hay que reproyectar. */
  function centroEnGrados(mapa) {
    if (!mapa || typeof mapa.getCenter !== 'function') return null;
    let centro = null;
    try { centro = mapa.getCenter(); } catch (e) { return null; }
    if (!centro || !isFinite(centro.x) || !isFinite(centro.y)) return null;

    // El impl de Cesium devuelve ya longitud y latitud en grados; el de
    // OpenLayers, el centro en EPSG:3857.
    if (esCesium(mapa)) return [centro.x, centro.y];

    const IDEE = api();
    if (!(IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function')) return null;
    try {
      const ll = IDEE.utils.reproject([centro.x, centro.y], 'EPSG:3857', 'EPSG:4326');
      if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) return null;
      return [ll[0], ll[1]];
    } catch (e) {
      return null;
    }
  }

  /**
   * Rectángulo que se está viendo, en grados.
   *
   * En 2D sale de la vista de OpenLayers. En 3D la cámara mira a un punto con
   * inclinación, así que se lanzan cuatro rayos por las esquinas del lienzo y
   * se toma la caja que los contiene; si alguna esquina se pierde en el cielo
   * (mirando al horizonte) no hay rectángulo fiable y se devuelve null.
   */
  function vistaEnGrados(mapa) {
    if (!mapa || typeof mapa.getMapImpl !== 'function') return null;
    let impl = null;
    try { impl = mapa.getMapImpl(); } catch (e) { return null; }
    if (!impl) return null;

    if (!impl.scene) {
      const vista = (typeof impl.getView === 'function') ? impl.getView() : null;
      const tam = (typeof impl.getSize === 'function') ? impl.getSize() : null;
      if (!vista || typeof vista.calculateExtent !== 'function' || !tam) return null;
      const IDEE = api();
      if (!(IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function')) return null;
      let caja = null;
      try { caja = vista.calculateExtent(tam); } catch (e) { return null; }
      if (!caja || caja.length < 4) return null;
      try {
        const a = IDEE.utils.reproject([caja[0], caja[1]], 'EPSG:3857', 'EPSG:4326');
        const b = IDEE.utils.reproject([caja[2], caja[3]], 'EPSG:3857', 'EPSG:4326');
        return [
          Math.min(a[0], b[0]), Math.min(a[1], b[1]),
          Math.max(a[0], b[0]), Math.max(a[1], b[1])
        ];
      } catch (e) {
        return null;
      }
    }

    const Cesium = window.Cesium;
    const escena = impl.scene;
    if (!Cesium || !escena || !escena.camera || !escena.globe) return null;
    const lienzo = escena.canvas;
    if (!lienzo) return null;
    const ancho = lienzo.clientWidth || lienzo.width;
    const alto = lienzo.clientHeight || lienzo.height;
    if (!ancho || !alto) return null;

    const esquinas = [[0, 0], [ancho, 0], [ancho, alto], [0, alto]];
    const lons = [];
    const lats = [];
    const elipsoide = escena.globe.ellipsoid;
    esquinas.forEach(function (px) {
      let cartesiano = null;
      try {
        const posicion = new Cesium.Cartesian2(px[0], px[1]);
        const rayo = escena.camera.getPickRay(posicion);
        if (rayo) cartesiano = escena.globe.pick(rayo, escena);
        if (!cartesiano) cartesiano = escena.camera.pickEllipsoid(posicion, elipsoide);
      } catch (e) {
        cartesiano = null;
      }
      if (!cartesiano) return;
      try {
        const cartografica = elipsoide.cartesianToCartographic(cartesiano);
        lons.push(Cesium.Math.toDegrees(cartografica.longitude));
        lats.push(Cesium.Math.toDegrees(cartografica.latitude));
      } catch (e) { /* esquina perdida */ }
    });
    if (lons.length < 2) return null;
    return [
      Math.min.apply(null, lons), Math.min.apply(null, lats),
      Math.max.apply(null, lons), Math.max.apply(null, lats)
    ];
  }

  /** Crea un elemento con clase y texto opcionales. */
  function el(tag, clase, texto) {
    const nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  /** Un campo de texto/numérico con su etiqueta, con las clases del catálogo. */
  function campo(etiqueta, opciones) {
    const o = opciones || {};
    const caja = el('label', 'catalogo__campo');
    caja.appendChild(el('span', 'catalogo__campo-etiqueta', etiqueta));
    const input = document.createElement('input');
    input.type = o.tipo || 'number';
    input.className = 'catalogo__campo-control';
    input.step = o.paso || 'any';
    if (o.min !== undefined) input.min = String(o.min);
    if (o.max !== undefined) input.max = String(o.max);
    if (o.placeholder) input.placeholder = o.placeholder;
    if (o.inputmode) input.inputMode = o.inputmode;
    input.setAttribute('data-campo', o.campo);
    caja.appendChild(input);
    return { caja: caja, input: input };
  }

  /** Una casilla con su etiqueta. */
  function casilla(etiqueta, campo) {
    const caja = el('label', 'cat-coloc__check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('data-campo', campo);
    caja.appendChild(input);
    caja.appendChild(el('span', '', etiqueta));
    return { caja: caja, input: input };
  }

  /**
   * Construye el formulario de colocación.
   *
   * @param {HTMLElement} contenedor Donde se inserta.
   * @param {Object} opciones
   * @param {Object} opciones.map Mapa de la API.
   * @param {string} opciones.tipo 'GLB' o 'Imagen'.
   * @param {string} opciones.url URL del recurso (para la vista previa).
   * @param {string} [opciones.nombre] Nombre de la capa de vista previa.
   * @param {Object} [opciones.valor] Estado previo (tras un cambio 2D/3D).
   * @param {Function} [opciones.onCambio] Recibe el estado cada vez que cambia.
   * @param {Function} [opciones.onAviso] Recibe (texto, clase) para el panel.
   * @returns {Object} Control con getValor(), validar(), estado(), destruir().
   */
  function crear(contenedor, opciones) {
    const opts = opciones || {};
    const mapa = opts.map;
    const tipo = String(opts.tipo || '');
    const esGLB = tipo === 'GLB';
    const esImagen = tipo === 'Imagen';
    const url = opts.url || '';
    const nombre = opts.nombre || '';
    const onCambio = (typeof opts.onCambio === 'function') ? opts.onCambio : null;
    const onAviso = (typeof opts.onAviso === 'function') ? opts.onAviso : null;

    // Estado de trabajo, mezclando los valores por defecto con lo que llegue.
    const estado = Object.assign({}, ESTADO_POR_DEFECTO);
    if (opts.valor && typeof opts.valor === 'object') {
      Object.keys(ESTADO_POR_DEFECTO).forEach(function (k) {
        if (opts.valor[k] !== undefined) estado[k] = opts.valor[k];
      });
    }
    if (estado.modo !== 'bbox') estado.modo = 'position';
    if (!Array.isArray(estado.bbox) || estado.bbox.length < 4) estado.bbox = null;

    let destruido = false;
    let temporizadorVistaPrevia = null;
    let capaVistaPrevia = null;
    let cancelarCaptura = null;
    let quitarEscapePunto = null;
    let cancelarDibujo = null;
    let marcoDibujo = null;

    /* ---------------------------------------------------------------- */
    /*  DOM                                                             */
    /* ---------------------------------------------------------------- */

    const raiz = el('div', 'cat-coloc');
    raiz.setAttribute('data-tipo', tipo);

    // Cabecera
    const cabecera = el('div', 'cat-coloc__cabecera');
    cabecera.appendChild(el('span', 'cat-coloc__titulo', 'Colocación'));
    cabecera.appendChild(el('span', 'cat-coloc__etiqueta',
      esGLB ? 'Modelo 3D' : (esImagen ? 'Imagen' : 'Recurso')));
    raiz.appendChild(cabecera);

    raiz.appendChild(el('p', 'cat-coloc__ayuda',
      'Este recurso no trae georreferenciación. Elige dónde va y cómo se orienta.'));

    // Selector de modo
    const modos = el('div', 'cat-coloc__modos');
    modos.setAttribute('role', 'group');
    modos.setAttribute('aria-label', 'Forma de colocar el recurso');
    const botonPunto = el('button', 'cat-coloc__modo', 'Punto');
    botonPunto.type = 'button';
    botonPunto.setAttribute('data-modo', 'position');
    const botonBbox = el('button', 'cat-coloc__modo', 'Rectángulo');
    botonBbox.type = 'button';
    botonBbox.setAttribute('data-modo', 'bbox');
    modos.appendChild(botonPunto);
    modos.appendChild(botonBbox);
    raiz.appendChild(modos);

    // --- Grupo punto ---------------------------------------------------
    const grupoPunto = el('div', 'cat-coloc__grupo');
    grupoPunto.setAttribute('data-grupo', 'position');

    const rejillaPunto = el('div', 'cat-coloc__rejilla');
    const cLon = campo('Longitud', { campo: 'lon', placeholder: '-3.7038' });
    const cLat = campo('Latitud', { campo: 'lat', placeholder: '40.4168' });
    const cCota = campo('Cota (m)', { campo: 'height', paso: '1', placeholder: '0' });
    rejillaPunto.appendChild(cLon.caja);
    rejillaPunto.appendChild(cLat.caja);
    rejillaPunto.appendChild(cCota.caja);

    // La imagen por punto necesita tamaño: sin ancho/alto la extensión usa
    // metrosPorPixel por el tamaño natural del fichero.
    let cAncho = null;
    let cAlto = null;
    if (esImagen) {
      cAncho = campo('Ancho (m)', { campo: 'ancho', paso: '1', min: 0, placeholder: 'auto' });
      cAlto = campo('Alto (m)', { campo: 'alto', paso: '1', min: 0, placeholder: 'auto' });
      rejillaPunto.appendChild(cAncho.caja);
      rejillaPunto.appendChild(cAlto.caja);
    }
    grupoPunto.appendChild(rejillaPunto);

    const accionesPunto = el('div', 'cat-coloc__acciones');
    const bCentro = el('button', 'cat-coloc__accion', 'Centro del mapa');
    bCentro.type = 'button';
    bCentro.setAttribute('data-accion', 'centro');
    const bPinchar = el('button', 'cat-coloc__accion', 'Pinchar en el mapa');
    bPinchar.type = 'button';
    bPinchar.setAttribute('data-accion', 'pinchar');
    accionesPunto.appendChild(bCentro);
    accionesPunto.appendChild(bPinchar);
    grupoPunto.appendChild(accionesPunto);
    raiz.appendChild(grupoPunto);

    // --- Grupo rectángulo ----------------------------------------------
    const grupoBbox = el('div', 'cat-coloc__grupo');
    grupoBbox.setAttribute('data-grupo', 'bbox');

    const rejillaBbox = el('div', 'cat-coloc__rejilla');
    const cOeste = campo('Oeste', { campo: 'oeste', placeholder: '-3.71' });
    const cSur = campo('Sur', { campo: 'sur', placeholder: '40.41' });
    const cEste = campo('Este', { campo: 'este', placeholder: '-3.69' });
    const cNorte = campo('Norte', { campo: 'norte', placeholder: '40.42' });
    rejillaBbox.appendChild(cOeste.caja);
    rejillaBbox.appendChild(cSur.caja);
    rejillaBbox.appendChild(cEste.caja);
    rejillaBbox.appendChild(cNorte.caja);
    grupoBbox.appendChild(rejillaBbox);

    const accionesBbox = el('div', 'cat-coloc__acciones');
    const bVista = el('button', 'cat-coloc__accion', 'Vista actual');
    bVista.type = 'button';
    bVista.setAttribute('data-accion', 'vista');
    const bDibujar = el('button', 'cat-coloc__accion', 'Dibujar rectángulo');
    bDibujar.type = 'button';
    bDibujar.setAttribute('data-accion', 'dibujar');
    accionesBbox.appendChild(bVista);
    accionesBbox.appendChild(bDibujar);
    grupoBbox.appendChild(accionesBbox);

    const cAjustar = casilla('Ajustar el modelo al rectángulo', 'ajustarABbox');
    grupoBbox.appendChild(cAjustar.caja);
    raiz.appendChild(grupoBbox);

    // --- Giro (visible: es lo que más se toca) -------------------------
    const bloqueGiro = el('div', 'cat-coloc__giro');
    const filaGiro = el('div', 'cat-coloc__fila');
    filaGiro.appendChild(el('span', 'catalogo__campo-etiqueta', 'Giro (grados)'));
    const cGiro = document.createElement('input');
    cGiro.type = 'number';
    cGiro.className = 'cat-coloc__giro-numero';
    cGiro.step = '1';
    cGiro.setAttribute('data-campo', 'heading');
    filaGiro.appendChild(cGiro);
    const bGiroCero = el('button', 'catalogo__enlace', '0°');
    bGiroCero.type = 'button';
    bGiroCero.setAttribute('data-accion', 'giro-cero');
    filaGiro.appendChild(bGiroCero);
    bloqueGiro.appendChild(filaGiro);

    const rangoGiro = document.createElement('input');
    rangoGiro.type = 'range';
    rangoGiro.className = 'cat-coloc__rango';
    rangoGiro.min = '-180';
    rangoGiro.max = '180';
    rangoGiro.step = '1';
    rangoGiro.setAttribute('data-campo', 'heading-rango');
    rangoGiro.setAttribute('aria-label', 'Giro del recurso en grados');
    bloqueGiro.appendChild(rangoGiro);
    raiz.appendChild(bloqueGiro);

    // --- Avanzado: escala y orientación 3D -----------------------------
    const detalles = document.createElement('details');
    detalles.className = 'cat-coloc__avanzado';
    detalles.appendChild(el('summary', '', 'Escala y orientación 3D'));
    const rejillaAvanzado = el('div', 'cat-coloc__rejilla');
    const cEscala = campo('Escala', { campo: 'scale', paso: '0.1', min: 0, placeholder: '1' });
    const cPitch = campo('Inclinación (°)', { campo: 'pitch', paso: '1', placeholder: '0' });
    const cRoll = campo('Alabeo (°)', { campo: 'roll', paso: '1', placeholder: '0' });
    rejillaAvanzado.appendChild(cEscala.caja);
    rejillaAvanzado.appendChild(cPitch.caja);
    rejillaAvanzado.appendChild(cRoll.caja);
    if (esImagen) {
      const cMpp = campo('Metros por píxel', {
        campo: 'metrosPorPixel', paso: '0.1', min: 0, placeholder: '1'
      });
      rejillaAvanzado.appendChild(cMpp.caja);
    }
    detalles.appendChild(rejillaAvanzado);

    const cClamp = casilla('Apoyar en el terreno', 'clampToGround');
    detalles.appendChild(cClamp.caja);
    if (esGLB) {
      const cBase = casilla('Apoyar la base del modelo', 'baseAlSuelo');
      detalles.appendChild(cBase.caja);
    }
    raiz.appendChild(detalles);

    // --- Vista previa ---------------------------------------------------
    const cVistaPrevia = casilla('Ver la colocación en el mapa', 'vistaPrevia');
    raiz.appendChild(cVistaPrevia.caja);

    const estadoEl = el('p', 'cat-coloc__estado');
    estadoEl.setAttribute('role', 'status');
    raiz.appendChild(estadoEl);

    contenedor.appendChild(raiz);

    /* ---------------------------------------------------------------- */
    /*  Estado y UI                                                      */
    /* ---------------------------------------------------------------- */

    function aviso(texto, clase) {
      if (destruido) return;
      estadoEl.textContent = texto || '';
      estadoEl.className = 'cat-coloc__estado' +
        (clase ? ' cat-coloc__estado--' + clase : '');
      if (onAviso && texto) onAviso(texto, clase);
    }

    function estadoCrudo() {
      return clonar(estado);
    }

    /** Vuelca el estado a los controles. No dispara eventos. */
    function volcar() {
      const esBbox = estado.modo === 'bbox';
      botonPunto.classList.toggle('cat-coloc__modo--activo', !esBbox);
      botonPunto.setAttribute('aria-pressed', String(!esBbox));
      botonBbox.classList.toggle('cat-coloc__modo--activo', esBbox);
      botonBbox.setAttribute('aria-pressed', String(esBbox));
      grupoPunto.hidden = esBbox;
      grupoBbox.hidden = !esBbox;

      cLon.input.value = (estado.lon === null || estado.lon === undefined)
        ? '' : String(estado.lon);
      cLat.input.value = (estado.lat === null || estado.lat === undefined)
        ? '' : String(estado.lat);
      cCota.input.value = (estado.height === null || estado.height === undefined)
        ? '' : String(estado.height);

      const caja = estado.bbox || [];
      cOeste.input.value = caja.length >= 4 ? String(caja[0]) : '';
      cSur.input.value = caja.length >= 4 ? String(caja[1]) : '';
      cEste.input.value = caja.length >= 4 ? String(caja[2]) : '';
      cNorte.input.value = caja.length >= 4 ? String(caja[3]) : '';

      const giro = esNumero(estado.heading) ? estado.heading : 0;
      cGiro.value = String(giro);
      rangoGiro.value = String(Math.max(-180, Math.min(180, giro)));
      cEscala.input.value = (estado.scale === null || estado.scale === undefined)
        ? '' : String(estado.scale);
      cPitch.input.value = (estado.pitch === null || estado.pitch === undefined)
        ? '' : String(estado.pitch);
      cRoll.input.value = (estado.roll === null || estado.roll === undefined)
        ? '' : String(estado.roll);
      if (cAncho) cAncho.input.value = (estado.ancho === null || estado.ancho === undefined)
        ? '' : String(estado.ancho);
      if (cAlto) cAlto.input.value = (estado.alto === null || estado.alto === undefined)
        ? '' : String(estado.alto);
      const mpp = raiz.querySelector('[data-campo="metrosPorPixel"]');
      if (mpp) mpp.value = (estado.metrosPorPixel === null || estado.metrosPorPixel === undefined)
        ? '' : String(estado.metrosPorPixel);

      cAjustar.input.checked = !!estado.ajustarABbox;
      cClamp.input.checked = !!estado.clampToGround;
      const base = raiz.querySelector('[data-campo="baseAlSuelo"]');
      if (base) base.checked = !!estado.baseAlSuelo;
      cVistaPrevia.input.checked = !!estado.vistaPrevia;
    }

    /** Programa la vista previa: se espera a que el usuario deje de teclear. */
    function programarVistaPrevia() {
      if (temporizadorVistaPrevia) clearTimeout(temporizadorVistaPrevia);
      if (!estado.vistaPrevia) {
        quitarVistaPrevia();
        return;
      }
      temporizadorVistaPrevia = setTimeout(function () {
        temporizadorVistaPrevia = null;
        actualizarVistaPrevia();
      }, 450);
    }

    /** Comunica el cambio y refresca la vista previa. */
    function cambio() {
      if (destruido) return;
      if (onCambio) onCambio(estadoCrudo());
      programarVistaPrevia();
    }

    /* ---------------------------------------------------------------- */
    /*  Vista previa                                                     */
    /* ---------------------------------------------------------------- */

    function quitarVistaPrevia() {
      // Un cambio de campo programa la vista previa con retardo. Si la capa
      // real se carga antes de que salte el temporizador, hay que cancelarlo o
      // aparecería una segunda capa de adelanto encima de la definitiva.
      if (temporizadorVistaPrevia) {
        clearTimeout(temporizadorVistaPrevia);
        temporizadorVistaPrevia = null;
      }
      if (estadoEl && estadoEl.textContent &&
          estadoEl.textContent.indexOf('Vista previa') === 0) {
        estadoEl.textContent = '';
        estadoEl.className = 'cat-coloc__estado';
      }
      if (!capaVistaPrevia) return;
      const capa = capaVistaPrevia;
      capaVistaPrevia = null;
      if (mapa && typeof mapa.removeLayers === 'function') {
        try { mapa.removeLayers(capa); } catch (e) { /* ya no está */ }
      }
    }

    function actualizarVistaPrevia() {
      if (destruido || !estado.vistaPrevia) return;
      quitarVistaPrevia();
      const valor = getValor();
      if (!valor) {
        aviso('Falta la posición para poder previsualizar.');
        return;
      }
      if (!window.CatalogoURL || typeof window.CatalogoURL.cargar !== 'function') {
        aviso('No está cargado catalogo_url.js: no hay vista previa.', 'error');
        return;
      }
      try {
        const capas = window.CatalogoURL.cargar({
          url: url,
          mapa: mapa,
          tipo: tipo,
          nombre: nombre || 'Vista previa',
          colocacion: valor,
          // Fuera del selector de capas: es un adelanto, no una capa del mapa.
          parametros: { displayInLayerSwitcher: false }
        });
        capaVistaPrevia = (capas && capas.length) ? capas[0] : null;
        aviso('Vista previa en el mapa. Quita la casilla para retirarla.');
      } catch (e) {
        aviso('No se ha podido previsualizar: ' +
          (e && e.message ? e.message : e), 'error');
      }
    }

    /* ---------------------------------------------------------------- */
    /*  Captura de un punto en el mapa                                   */
    /* ---------------------------------------------------------------- */

    function ponerCursor(activo) {
      if (!mapa || typeof mapa.getMapImpl !== 'function') return;
      let impl = null;
      try { impl = mapa.getMapImpl(); } catch (e) { return; }
      const lienzo = (impl && typeof impl.getViewport === 'function')
        ? impl.getViewport()
        : ((impl && impl.scene && impl.scene.canvas) ? impl.scene.canvas : null);
      if (lienzo) lienzo.style.cursor = activo ? 'crosshair' : '';
    }

    function cancelarPunto() {
      if (cancelarCaptura) {
        const f = cancelarCaptura;
        cancelarCaptura = null;
        try { f(); } catch (e) { /* ya estaba suelto */ }
      }
      if (quitarEscapePunto) {
        const f = quitarEscapePunto;
        quitarEscapePunto = null;
        try { f(); } catch (e) { /* ya estaba suelto */ }
      }
      ponerCursor(false);
      bPinchar.classList.remove('cat-coloc__accion--activa');
    }

    function aplicarPunto(lon, lat) {
      if (!isFinite(lon) || !isFinite(lat)) return;
      estado.modo = 'position';
      estado.lon = lon;
      estado.lat = lat;
      volcar();
      cambio();
      aviso('Punto tomado: ' + lon.toFixed(6) + ', ' + lat.toFixed(6) + '.');
    }

    function pincharEnMapa() {
      cancelarPunto();
      if (!mapa || typeof mapa.getMapImpl !== 'function') {
        aviso('El mapa no está listo para tomar un punto.', 'error');
        return;
      }
      const cesium = esCesium(mapa);
      let impl = null;
      try { impl = mapa.getMapImpl(); } catch (e) { impl = null; }
      if (!impl) {
        aviso('El mapa no está listo para tomar un punto.', 'error');
        return;
      }

      ponerCursor(true);
      bPinchar.classList.add('cat-coloc__accion--activa');
      aviso('Haz clic en el mapa para dejar el punto. Esc para cancelar.');

      const alPulsarEscape = function (ev) {
        if (ev.key === 'Escape') {
          cancelarPunto();
          aviso('Colocación cancelada.');
        }
      };
      document.addEventListener('keydown', alPulsarEscape, true);
      quitarEscapePunto = function () {
        document.removeEventListener('keydown', alPulsarEscape, true);
      };

      if (!cesium) {
        // OpenLayers emite 'singleclick' (no 'click') y el evento trae la
        // coordenada ya en la proyección del mapa (EPSG:3857).
        const manejador = function (evt) {
          cancelarPunto();
          const coordenada = evt && evt.coordinate;
          if (!coordenada) return;
          const IDEE = api();
          let ll = null;
          try {
            ll = (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function')
              ? IDEE.utils.reproject([coordenada[0], coordenada[1]], 'EPSG:3857', 'EPSG:4326')
              : null;
          } catch (e) { ll = null; }
          if (!ll) {
            aviso('No se ha podido convertir el punto a coordenadas geográficas.', 'error');
            return;
          }
          aplicarPunto(ll[0], ll[1]);
        };
        try {
          impl.once('singleclick', manejador);
          cancelarCaptura = function () { impl.un('singleclick', manejador); };
        } catch (e) {
          cancelarPunto();
          aviso('No se ha podido activar la captura del punto.', 'error');
        }
        return;
      }

      const Cesium = window.Cesium;
      const escena = impl.scene;
      if (!Cesium || !escena || !escena.canvas) {
        cancelarPunto();
        aviso('Cesium no está disponible para tomar el punto.', 'error');
        return;
      }
      let manejadorCesium = null;
      try {
        manejadorCesium = new Cesium.ScreenSpaceEventHandler(escena.canvas);
        manejadorCesium.setInputAction(function (movimiento) {
          const posicion = movimiento && movimiento.position;
          if (!posicion) return;
          let cartesiano = null;
          try {
            const rayo = escena.camera.getPickRay(posicion);
            if (rayo) cartesiano = escena.globe.pick(rayo, escena);
            if (!cartesiano) {
              cartesiano = escena.camera.pickEllipsoid(posicion, escena.globe.ellipsoid);
            }
          } catch (e) {
            cartesiano = null;
          }
          if (!cartesiano) {
            aviso('Ese punto del cielo no está sobre el globo: prueba más abajo.', 'aviso');
            return;
          }
          const cartografica = escena.globe.ellipsoid.cartesianToCartographic(cartesiano);
          const lon = Cesium.Math.toDegrees(cartografica.longitude);
          const lat = Cesium.Math.toDegrees(cartografica.latitude);
          cancelarPunto();
          aplicarPunto(lon, lat);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        cancelarCaptura = function () {
          try { manejadorCesium.destroy(); } catch (e) { /* ya destruido */ }
        };
      } catch (e) {
        cancelarPunto();
        aviso('No se ha podido activar la captura del punto.', 'error');
      }
    }

    /* ---------------------------------------------------------------- */
    /*  Dibujo de un rectángulo (solo 2D)                                */
    /* ---------------------------------------------------------------- */

    function cancelarDibujoRectangulo() {
      if (cancelarDibujo) {
        const f = cancelarDibujo;
        cancelarDibujo = null;
        try { f(); } catch (e) { /* ya estaba suelto */ }
      }
      if (marcoDibujo && marcoDibujo.parentNode) {
        marcoDibujo.parentNode.removeChild(marcoDibujo);
      }
      marcoDibujo = null;
      ponerCursor(false);
      bDibujar.classList.remove('cat-coloc__accion--activa');
    }

    function dibujarRectangulo() {
      cancelarDibujoRectangulo();
      if (esCesium(mapa)) {
        aviso('En 3D la cámara va inclinada y el arrastre no define un rectángulo fiable: ' +
          'usa «Vista actual» o escribe las coordenadas.', 'aviso');
        return;
      }
      if (!mapa || typeof mapa.getMapImpl !== 'function') {
        aviso('El mapa no está listo para dibujar.', 'error');
        return;
      }
      let impl = null;
      try { impl = mapa.getMapImpl(); } catch (e) { impl = null; }
      const viewport = (impl && typeof impl.getViewport === 'function')
        ? impl.getViewport() : null;
      if (!impl || !viewport) {
        aviso('El mapa no está listo para dibujar.', 'error');
        return;
      }

      // Marquesina flotante: se cuelga del body y se coloca en coordenadas de
      // pantalla, así no hay que tocar el posicionamiento del viewport del mapa.
      marcoDibujo = el('div', 'cat-coloc__marco');
      marcoDibujo.hidden = true;
      document.body.appendChild(marcoDibujo);

      let inicio = null;
      let fin = null;

      const aPixeles = function (ev) {
        const caja = viewport.getBoundingClientRect();
        return [ev.clientX - caja.left, ev.clientY - caja.top];
      };

      const pintarMarco = function () {
        if (!inicio || !fin || !marcoDibujo) return;
        const izq = Math.min(inicio.x, fin.x);
        const arr = Math.min(inicio.y, fin.y);
        marcoDibujo.style.left = izq + 'px';
        marcoDibujo.style.top = arr + 'px';
        marcoDibujo.style.width = Math.abs(fin.x - inicio.x) + 'px';
        marcoDibujo.style.height = Math.abs(fin.y - inicio.y) + 'px';
      };

      const alMover = function (ev) {
        if (!inicio) return;
        fin = { x: ev.clientX, y: ev.clientY };
        pintarMarco();
      };

      const soltar = function () {
        window.removeEventListener('pointermove', alMover, true);
        window.removeEventListener('pointerup', alSoltar, true);
        window.removeEventListener('keydown', alEscape, true);
      };

      const alEscape = function (ev) {
        if (ev.key !== 'Escape') return;
        soltar();
        cancelarDibujoRectangulo();
        aviso('Dibujo cancelado.');
      };

      const alSoltar = function (ev) {
        if (!inicio) return;
        fin = { x: ev.clientX, y: ev.clientY };
        const anchoPx = Math.abs(fin.x - inicio.x);
        const altoPx = Math.abs(fin.y - inicio.y);
        soltar();
        cancelarDibujoRectangulo();

        if (anchoPx < 6 || altoPx < 6) {
          aviso('El rectángulo es demasiado pequeño: arrastra para marcar una zona.', 'aviso');
          return;
        }

        const p1 = aPixeles({ clientX: Math.min(inicio.x, fin.x), clientY: Math.min(inicio.y, fin.y) });
        const p2 = aPixeles({ clientX: Math.max(inicio.x, fin.x), clientY: Math.max(inicio.y, fin.y) });
        let c1 = null;
        let c2 = null;
        try {
          c1 = impl.getCoordinateFromPixel(p1);
          c2 = impl.getCoordinateFromPixel(p2);
        } catch (e) {
          c1 = null;
          c2 = null;
        }
        if (!c1 || !c2) {
          aviso('No se ha podido leer el rectángulo dibujado.', 'error');
          return;
        }
        const IDEE = api();
        let ll1 = null;
        let ll2 = null;
        try {
          if (IDEE && IDEE.utils && typeof IDEE.utils.reproject === 'function') {
            ll1 = IDEE.utils.reproject([c1[0], c1[1]], 'EPSG:3857', 'EPSG:4326');
            ll2 = IDEE.utils.reproject([c2[0], c2[1]], 'EPSG:3857', 'EPSG:4326');
          }
        } catch (e) {
          ll1 = null;
          ll2 = null;
        }
        if (!ll1 || !ll2) {
          aviso('No se ha podido convertir el rectángulo a coordenadas geográficas.', 'error');
          return;
        }
        estado.modo = 'bbox';
        estado.bbox = [
          Math.min(ll1[0], ll2[0]), Math.min(ll1[1], ll2[1]),
          Math.max(ll1[0], ll2[0]), Math.max(ll1[1], ll2[1])
        ];
        volcar();
        cambio();
        aviso('Rectángulo tomado. Ajusta el giro si hace falta.');
      };

      const alPulsar = function (ev) {
        if (ev.button !== 0) return;
        // En captura: se corta antes de que OpenLayers empiece a arrastrar el mapa.
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        inicio = { x: ev.clientX, y: ev.clientY };
        fin = { x: ev.clientX, y: ev.clientY };
        marcoDibujo.hidden = false;
        pintarMarco();
        window.addEventListener('pointermove', alMover, true);
        window.addEventListener('pointerup', alSoltar, true);
        window.addEventListener('keydown', alEscape, true);
      };

      viewport.addEventListener('pointerdown', alPulsar, true);
      ponerCursor(true);
      bDibujar.classList.add('cat-coloc__accion--activa');
      aviso('Arrastra sobre el mapa para marcar el rectángulo. Esc para cancelar.');

      cancelarDibujo = function () {
        viewport.removeEventListener('pointerdown', alPulsar, true);
        soltar();
      };
    }

    /* ---------------------------------------------------------------- */
    /*  Valores para la capa                                             */
    /* ---------------------------------------------------------------- */

    /** Estado convertido a los parámetros de ext/glbLayer o ext/imageLayer. */
    function getValor() {
      const comunes = {
        heading: esNumero(estado.heading) ? estado.heading : 0,
        pitch: esNumero(estado.pitch) ? estado.pitch : 0,
        roll: esNumero(estado.roll) ? estado.roll : 0,
        scale: (esNumero(estado.scale) && estado.scale > 0) ? estado.scale : 1,
        clampToGround: !!estado.clampToGround
      };
      if (esGLB) comunes.baseAlSuelo = !!estado.baseAlSuelo;

      if (estado.modo === 'bbox') {
        const caja = estado.bbox;
        if (!Array.isArray(caja) || caja.length < 4) return null;
        const o = Number(caja[0]);
        const s = Number(caja[1]);
        const e = Number(caja[2]);
        const n = Number(caja[3]);
        if (!isFinite(o) || !isFinite(s) || !isFinite(e) || !isFinite(n)) return null;
        if (e <= o || n <= s) return null;
        comunes.bbox = [o, s, e, n];
        comunes.ajustarABbox = !!estado.ajustarABbox;
        comunes.heightOffset = esNumero(estado.height) ? estado.height : 0;
        return comunes;
      }

      if (!esNumero(estado.lon) || !esNumero(estado.lat)) return null;
      comunes.position = {
        lon: estado.lon,
        lat: estado.lat,
        height: esNumero(estado.height) ? estado.height : 0
      };
      if (esImagen) {
        if (esNumero(estado.ancho) && estado.ancho > 0) comunes.ancho = estado.ancho;
        if (esNumero(estado.alto) && estado.alto > 0) comunes.alto = estado.alto;
        if (esNumero(estado.metrosPorPixel) && estado.metrosPorPixel > 0) {
          comunes.metrosPorPixel = estado.metrosPorPixel;
        }
      }
      return comunes;
    }

    /** ¿Se puede cargar ya con lo que hay en el formulario? */
    function validar() {
      if (estado.modo === 'bbox') {
        const caja = estado.bbox;
        if (!Array.isArray(caja) || caja.length < 4) {
          return { ok: false, mensaje: 'Marca un rectángulo con «Vista actual», «Dibujar rectángulo» o escribe sus coordenadas.' };
        }
        const o = Number(caja[0]);
        const s = Number(caja[1]);
        const e = Number(caja[2]);
        const n = Number(caja[3]);
        if (!isFinite(o) || !isFinite(s) || !isFinite(e) || !isFinite(n)) {
          return { ok: false, mensaje: 'Las coordenadas del rectángulo no son válidas.' };
        }
        if (o < -180 || e > 180 || s < -90 || n > 90) {
          return { ok: false, mensaje: 'El rectángulo se sale del rango de coordenadas geográficas.' };
        }
        if (e <= o || n <= s) {
          return { ok: false, mensaje: 'El rectángulo está vacío: el este tiene que ser mayor que el oeste y el norte mayor que el sur.' };
        }
        return { ok: true, mensaje: '' };
      }

      if (!esNumero(estado.lon) || !esNumero(estado.lat)) {
        return { ok: false, mensaje: 'Escribe la longitud y la latitud, o usa «Centro del mapa» / «Pinchar en el mapa».' };
      }
      if (estado.lon < -180 || estado.lon > 180 || estado.lat < -90 || estado.lat > 90) {
        return { ok: false, mensaje: 'La longitud tiene que estar entre -180 y 180, y la latitud entre -90 y 90.' };
      }
      return { ok: true, mensaje: '' };
    }

    /* ---------------------------------------------------------------- */
    /*  Eventos                                                          */
    /* ---------------------------------------------------------------- */

    function alCambiarModo(modo) {
      estado.modo = (modo === 'bbox') ? 'bbox' : 'position';
      volcar();
      cambio();
    }
    botonPunto.addEventListener('click', function () { alCambiarModo('position'); });
    botonBbox.addEventListener('click', function () { alCambiarModo('bbox'); });

    // Campos del punto
    cLon.input.addEventListener('input', function () {
      estado.lon = aNumero(this.value);
      cambio();
    });
    cLat.input.addEventListener('input', function () {
      estado.lat = aNumero(this.value);
      cambio();
    });
    cCota.input.addEventListener('input', function () {
      estado.height = aNumero(this.value);
      cambio();
    });

    // Rectángulo: se van guardando las cuatro esquinas; el bbox solo se da por
    // bueno cuando las cuatro son números y forman una caja.
    function leerBbox() {
      const o = aNumero(cOeste.input.value);
      const s = aNumero(cSur.input.value);
      const e = aNumero(cEste.input.value);
      const n = aNumero(cNorte.input.value);
      estado.bbox = (o !== null && s !== null && e !== null && n !== null)
        ? [o, s, e, n] : null;
      cambio();
    }
    [cOeste, cSur, cEste, cNorte].forEach(function (c) {
      c.input.addEventListener('input', leerBbox);
    });

    // Giro: el número y el rango se siguen el uno al otro.
    cGiro.addEventListener('input', function () {
      estado.heading = aNumero(this.value);
      if (estado.heading === null) estado.heading = 0;
      rangoGiro.value = String(Math.max(-180, Math.min(180, estado.heading)));
      cambio();
    });
    rangoGiro.addEventListener('input', function () {
      estado.heading = aNumero(this.value);
      if (estado.heading === null) estado.heading = 0;
      cGiro.value = String(estado.heading);
      cambio();
    });
    bGiroCero.addEventListener('click', function () {
      estado.heading = 0;
      volcar();
      cambio();
    });

    cEscala.input.addEventListener('input', function () {
      estado.scale = aNumero(this.value);
      cambio();
    });
    cPitch.input.addEventListener('input', function () {
      estado.pitch = aNumero(this.value);
      cambio();
    });
    cRoll.input.addEventListener('input', function () {
      estado.roll = aNumero(this.value);
      cambio();
    });
    if (cAncho) {
      cAncho.input.addEventListener('input', function () {
        estado.ancho = aNumero(this.value);
        cambio();
      });
      cAlto.input.addEventListener('input', function () {
        estado.alto = aNumero(this.value);
        cambio();
      });
      const mpp = raiz.querySelector('[data-campo="metrosPorPixel"]');
      if (mpp) {
        mpp.addEventListener('input', function () {
          estado.metrosPorPixel = aNumero(this.value);
          cambio();
        });
      }
    }

    cAjustar.input.addEventListener('change', function () {
      estado.ajustarABbox = !!this.checked;
      cambio();
    });
    cClamp.input.addEventListener('change', function () {
      estado.clampToGround = !!this.checked;
      cambio();
    });
    const cBase = raiz.querySelector('[data-campo="baseAlSuelo"]');
    if (cBase) {
      cBase.addEventListener('change', function () {
        estado.baseAlSuelo = !!this.checked;
        cambio();
      });
    }
    cVistaPrevia.input.addEventListener('change', function () {
      estado.vistaPrevia = !!this.checked;
      if (estado.vistaPrevia) programarVistaPrevia();
      else {
        if (temporizadorVistaPrevia) clearTimeout(temporizadorVistaPrevia);
        temporizadorVistaPrevia = null;
        quitarVistaPrevia();
        aviso('');
      }
      if (onCambio) onCambio(estadoCrudo());
    });

    // Acciones de mapa
    bCentro.addEventListener('click', function () {
      const centro = centroEnGrados(mapa);
      if (!centro) {
        aviso('No se ha podido leer el centro del mapa.', 'error');
        return;
      }
      estado.modo = 'position';
      estado.lon = centro[0];
      estado.lat = centro[1];
      volcar();
      cambio();
      aviso('Punto en el centro del mapa: ' +
        centro[0].toFixed(6) + ', ' + centro[1].toFixed(6) + '.');
    });

    bPinchar.addEventListener('click', function () {
      if (cancelarCaptura) {
        cancelarPunto();
        aviso('Colocación cancelada.');
        return;
      }
      pincharEnMapa();
    });

    bVista.addEventListener('click', function () {
      const caja = vistaEnGrados(mapa);
      if (!caja) {
        aviso(esCesium(mapa)
          ? 'En 3D no hay un rectángulo limpio (la cámara va inclinada): escribe las coordenadas o usa «Pinchar en el mapa» en modo punto.'
          : 'No se ha podido leer la vista actual del mapa.', 'aviso');
        return;
      }
      estado.modo = 'bbox';
      estado.bbox = caja;
      volcar();
      cambio();
      aviso('Rectángulo de la vista actual tomado.');
    });

    bDibujar.addEventListener('click', function () {
      if (cancelarDibujo) {
        cancelarDibujoRectangulo();
        aviso('Dibujo cancelado.');
        return;
      }
      dibujarRectangulo();
    });

    // Si no había posición, se parte del centro del mapa: así el formulario
    // nunca arranca en un estado que no se puede cargar.
    if (estado.modo === 'position' &&
        (!esNumero(estado.lon) || !esNumero(estado.lat))) {
      const centro = centroEnGrados(mapa);
      if (centro) {
        estado.lon = centro[0];
        estado.lat = centro[1];
      }
    }
    if (estado.modo === 'bbox' && !estado.bbox) {
      const caja = vistaEnGrados(mapa);
      if (caja) estado.bbox = caja;
    }

    volcar();
    if (onCambio) onCambio(estadoCrudo());
    if (estado.vistaPrevia) programarVistaPrevia();

    /* ---------------------------------------------------------------- */
    /*  API del control                                                  */
    /* ---------------------------------------------------------------- */

    return {
      getValor: getValor,
      validar: validar,
      estado: estadoCrudo,
      quitarVistaPrevia: quitarVistaPrevia,
      desactivarVistaPrevia: function () {
        estado.vistaPrevia = false;
        cVistaPrevia.input.checked = false;
        quitarVistaPrevia();
        if (onCambio) onCambio(estadoCrudo());
      },
      destruir: function () {
        if (destruido) return;
        destruido = true;
        if (temporizadorVistaPrevia) clearTimeout(temporizadorVistaPrevia);
        temporizadorVistaPrevia = null;
        cancelarPunto();
        cancelarDibujoRectangulo();
        quitarVistaPrevia();
        if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
      }
    };
  }

  // =====================================================================
  //  Exposición
  // =====================================================================

  window.CatalogoColocacion = {
    crear: crear,
    ESTADO_POR_DEFECTO: ESTADO_POR_DEFECTO
  };
})();
