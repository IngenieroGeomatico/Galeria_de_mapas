// Guardas y tests de comportamiento de las capas 3D de ext/.
//
// POR QUÉ EXISTE ESTE FICHERO
//
// Las capas 3D que no usan entidades de Cesium se pintan con una capa de
// imágenes (`scene.imageryLayers.addImageryProvider`). En ese caso la opacidad
// y la visibilidad NO las resuelve la API: la capa tiene que llevarlas al
// `.alpha` y al `.show` de su ImageryLayer. Si se olvida, el fallo es MUDO,
// porque el selector de capas comprueba antes de llamar:
//
//   if (typeof capa.setOpacity === 'function') capa.setOpacity(...)
//
// De modo que si el método no existe, el deslizador se mueve, el mapa no
// cambia y no aparece nada en consola.
//
// Eso es exactamente lo que pasaba en 3D con:
//   - `ext/MVTLayer`     (corregido en 7780b3a)
//   - `ext/geotiffLayer` (aplicaba `.alpha` solo al crear la imagen)
//   - `ext/mbtilesLayer` (sin opacidad ni visibilidad, y además detectaba mal
//     el 3D: miraba `map.scene`, que no existe en el mapa de la API)
//
// Aquí hay dos niveles de defensa:
//   1. Guardas estáticas: toda extensión que cree una ImageryLayer tiene que
//      exponer la opacidad y aplicarla al pintar.
//   2. Tests de comportamiento: se monta la cadena fachada -> impl -> render
//      con mocks de Cesium y se comprueba que el `alpha` y el `show` de la
//      ImageryLayer cambian de verdad.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./setup/env');

const RAIZ = path.join(__dirname, '..');
const RAIZ_EXT = path.join(RAIZ, 'ext');

/**
 * Carga un IIFE de ext/ en el entorno global, como el resto de tests.
 * @param {string} ruta Ruta relativa al repositorio.
 */
function cargar(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  // eslint-disable-next-line no-eval
  eval(codigo);
}

/**
 * Lista todos los .js de un directorio, recursivamente.
 * @param {string} dir Directorio de partida.
 * @returns {Array<string>} Rutas absolutas.
 */
function ficherosJS(dir) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficherosJS(ruta));
    else if (entrada.name.endsWith('.js')) salida.push(ruta);
  }
  return salida;
}

/**
 * Ficheros de ext/ que crean una capa de imágenes de Cesium, con su código.
 * @returns {Array<{relativa: string, codigo: string}>}
 */
function capasConImageryLayer() {
  const salida = [];
  for (const ruta of ficherosJS(RAIZ_EXT)) {
    const codigo = fs.readFileSync(ruta, 'utf8');
    if (codigo.indexOf('addImageryProvider') === -1) continue;
    salida.push({ relativa: path.relative(RAIZ, ruta), codigo: codigo });
  }
  return salida;
}

/**
 * ¿El código define o asigna el método? Vale tanto `setOpacity(v) {` como
 * `capa.setOpacity = function (v) {`. Una simple mención en un comentario no
 * cuenta, para que la guarda no se pueda satisfacer de boquilla.
 * @param {string} codigo Fuente del fichero.
 * @param {string} nombre Nombre del método.
 * @returns {boolean}
 */
function defineMetodo(codigo, nombre) {
  return new RegExp('\\b' + nombre + '\\b\\s*(?:=|:)\\s*function|\\b' + nombre + '\\s*\\(').test(codigo);
}

/* ------------------------------------------------------------------ *
 * 1. Guardas estáticas
 * ------------------------------------------------------------------ */

test('capas 3D con ImageryLayers: exponen setOpacity y getOpacity', () => {
  const fallos = [];

  for (const fichero of capasConImageryLayer()) {
    const exponeOpacidad = defineMetodo(fichero.codigo, 'setOpacity');
    const leeOpacidad = defineMetodo(fichero.codigo, 'getOpacity');
    if (!exponeOpacidad || !leeOpacidad) {
      const falta = [];
      if (!exponeOpacidad) falta.push('setOpacity');
      if (!leeOpacidad) falta.push('getOpacity');
      fallos.push(fichero.relativa + ' (falta ' + falta.join(' y ') + ')');
    }
  }

  assert.deepEqual(
    fallos,
    [],
    'Estas capas pintan con ImageryLayers de Cesium y no exponen la opacidad: '
    + 'el deslizador del selector no tendría efecto y no daría error.'
  );
});

test('capas 3D con ImageryLayers: aplican visibilidad y opacidad al pintar', () => {
  const fallos = [];

  for (const fichero of capasConImageryLayer()) {
    // Visibilidad: o se gestiona a mano (`setVisible`) o se asigna `.show`.
    const gestionaVisibilidad = defineMetodo(fichero.codigo, 'setVisible') || /\.show\s*=/.test(fichero.codigo);
    // Opacidad: tiene que llegar al `alpha` de la capa de imágenes.
    const aplicaAlpha = /\.alpha\s*=/.test(fichero.codigo);

    if (!gestionaVisibilidad) fallos.push(fichero.relativa + ' (no aplica .show / setVisible)');
    else if (!aplicaAlpha) fallos.push(fichero.relativa + ' (no aplica .alpha)');
  }

  assert.deepEqual(
    fallos,
    [],
    'Estas capas crean una ImageryLayer pero no le llevan la visibilidad o la '
    + 'opacidad: los controles del selector no tendrían efecto.'
  );
});

/* ------------------------------------------------------------------ *
 * 2. Mocks compartidos
 * ------------------------------------------------------------------ */

/**
 * Escena de Cesium de mentira, con la misma superficie que usa el renderizador.
 * @returns {Object}
 */
function escenaFalsa() {
  const escena = {
    capasImagen: [],
    renderizados: 0,
    imageryLayers: {
      addImageryProvider: function (provider) {
        const capaImagen = { provider: provider, alpha: 1, show: true };
        escena.capasImagen.push(capaImagen);
        return capaImagen;
      },
      remove: function (capaImagen) {
        const i = escena.capasImagen.indexOf(capaImagen);
        if (i >= 0) escena.capasImagen.splice(i, 1);
        return true;
      }
    },
    requestRender: function () { escena.renderizados += 1; }
  };
  return escena;
}

/**
 * Lo mínimo de Cesium que tocan los providers: un constructor de rectángulo,
 * un evento y un tiling scheme.
 * @returns {Object}
 */
function cesiumFalso() {
  return {
    Rectangle: {
      MAX_VALUE: {},
      fromDegrees: function (o, s, e, n) { return { west: o, south: s, east: e, north: n }; }
    },
    WebMercatorTilingScheme: function WebMercatorTilingScheme() {
      this.rectangle = { west: -Math.PI, south: -Math.PI / 2, east: Math.PI, north: Math.PI / 2 };
    },
    Event: function Event() { this.addEventListener = function () {}; },
    SingleTileImageryProvider: function SingleTileImageryProvider(o) { this.opciones = o || {}; }
  };
}

/**
 * Ejecuta una función con `window.Cesium` y `global.IDEE` sustituidos, y los
 * restaura al terminar (aunque falle).
 * @param {Object} opciones
 * @param {Object} opciones.idee API de mentira.
 * @param {Object} opciones.cesium Cesium de mentira.
 * @param {Function} opciones.cuerpo Cuerpo del test.
 * @returns {Promise<*>}
 */
async function conEntorno(opciones, cuerpo) {
  const viejoIDEE = global.IDEE;
  const viejoM = global.M;
  const viejoCesium = window.Cesium;
  global.IDEE = opciones.idee;
  global.M = opciones.idee;
  window.Cesium = opciones.cesium;
  try {
    return await cuerpo();
  } finally {
    global.IDEE = viejoIDEE;
    global.M = viejoM;
    window.Cesium = viejoCesium;
  }
}

/** Resuelve en el siguiente turno del bucle de eventos. */
function tick() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

/* ------------------------------------------------------------------ *
 * 3. GeoTIFF
 * ------------------------------------------------------------------ */

cargar('./ext/geotiffLayer/geotiffLayer.js');

test('geotiffLayer: la opacidad llega al alpha de la ImageryLayer', async () => {
  const T = global.GeoTIFFTestables;
  assert.ok(T, 'geotiffLayer debe exponer GeoTIFFTestables');

  const escena = escenaFalsa();

  // Bases de mentira con las firmas reales: la fachada recibe la implementación
  // como SEGUNDO argumento (ver el comentario del constructor en la extension).
  class BaseMock {
    constructor(parameters, impl) { this.impl_ = impl; }
    getImpl() { return this.impl_; }
    setOpacity(v) { this.getImpl().setOpacity(v); }
    getOpacity() { return this.getImpl().getOpacity(); }
    setVisible(v) { this.getImpl().setVisible(v); }
  }
  class BaseImplMock {
    constructor() { this.opacidad = 1; }
    setOpacity(v) { this.opacidad = v; }
    getOpacity() { return this.opacidad; }
    setVisible() {}
  }

  const ImplGeoTIFF = T.crearImplementacion(BaseImplMock);
  const FachadaGeoTIFF = T.crearFachada(BaseMock, ImplGeoTIFF);

  await conEntorno({ idee: global.IDEE, cesium: cesiumFalso() }, async () => {
    const capa = new FachadaGeoTIFF({ url: 'memoria.tif' });
    const impl = capa.getImpl();

    // El lector real necesita un GeoTIFF de verdad; aquí se sustituye la
    // lectura por una imagen de mentira y se comprueba el contrato.
    impl.lector.leer = function () {
      return Promise.resolve({
        rectangulo: [[-1, 40], [0, 41]],
        canvas: { width: 2, height: 2, toDataURL: function () { return 'data:image/png;base64,AA=='; } }
      });
    };

    // La opacidad se fija antes de que exista la capa de imágenes (el fichero
    // se lee de forma asíncrona) y no puede perderse.
    capa.setOpacity(0.4);
    assert.equal(capa.getOpacity(), 0.4);

    // Se añade al mapa como en el visualizador: `addTo` localiza la escena y
    // dispara el primer pintado.
    impl.render.addTo({ getMapImpl: function () { return { scene: escena }; } });
    await tick();

    assert.equal(escena.capasImagen.length, 1);
    assert.equal(escena.capasImagen[0].alpha, 0.4, 'el alpha debe salir con la opacidad guardada');

    // Cambiarla con la imagen ya pintada se aplica en caliente.
    capa.setOpacity(0.75);
    assert.equal(escena.capasImagen[0].alpha, 0.75);

    // Gestionar la visibilidad no puede tocar la opacidad.
    capa.setVisible(false);
    assert.equal(escena.capasImagen[0].show, false);
    assert.equal(escena.capasImagen[0].alpha, 0.75);
    capa.setVisible(true);
    assert.equal(escena.capasImagen[0].show, true);

    // Y un refresco (fichero nuevo) conserva la opacidad.
    impl.render.refrescar();
    await tick();
    assert.equal(escena.capasImagen.length, 1);
    assert.equal(escena.capasImagen[0].alpha, 0.75, 'refrescar() no debe resetear la opacidad');
  });
});

test('geotiffLayer: respeta opacity y visible pasados al constructor', async () => {
  const T = global.GeoTIFFTestables;
  const escena = escenaFalsa();

  class BaseMock {
    constructor(parameters, impl) { this.impl_ = impl; }
    getImpl() { return this.impl_; }
    setOpacity(v) { this.getImpl().setOpacity(v); }
    getOpacity() { return this.getImpl().getOpacity(); }
    setVisible(v) { this.getImpl().setVisible(v); }
  }
  class BaseImplMock {
    constructor() { this.opacidad = 1; }
    setOpacity(v) { this.opacidad = v; }
    getOpacity() { return this.opacidad; }
    setVisible() {}
  }

  const ImplGeoTIFF = T.crearImplementacion(BaseImplMock);
  const FachadaGeoTIFF = T.crearFachada(BaseMock, ImplGeoTIFF);

  await conEntorno({ idee: global.IDEE, cesium: cesiumFalso() }, async () => {
    const capa = new FachadaGeoTIFF({ url: 'memoria.tif', opacity: 0.2, visible: false });
    const impl = capa.getImpl();

    impl.lector.leer = function () {
      return Promise.resolve({
        rectangulo: [[-1, 40], [0, 41]],
        canvas: { width: 2, height: 2, toDataURL: function () { return 'data:image/png;base64,AA=='; } }
      });
    };

    // La opacidad del constructor ya está en el renderizador antes de pintar.
    assert.equal(capa.getOpacity(), 0.2);
    assert.equal(impl.render.isVisible(), false);

    impl.render.addTo({ getMapImpl: function () { return { scene: escena }; } });
    await tick();

    assert.equal(escena.capasImagen.length, 1);
    assert.equal(escena.capasImagen[0].alpha, 0.2, 'el alpha debe salir con la opacidad del constructor');
    assert.equal(escena.capasImagen[0].show, false, 'el show debe salir con la visibilidad del constructor');
  });
});

/* ------------------------------------------------------------------ *
 * 4. MBTiles
 * ------------------------------------------------------------------ */

cargar('./ext/mbtilesLayer/mbtilesLayer.js');

test('mbtilesLayer: opacidad y visibilidad llegan a la ImageryLayer de 3D', async () => {
  const crear = global.mbtilesLayer && global.mbtilesLayer.crear;
  assert.equal(typeof crear, 'function', 'mbtilesLayer debe exponer window.mbtilesLayer.crear');

  const escena = escenaFalsa();

  // La capa base de la API (TMS) y el mapa, de mentira.
  class TMSMock {
    constructor(o) { this.opciones = o || {}; this.visible_ = true; this.opacidad_ = 1; }
    addTo() {}
    destroy() {}
    setOpacity(v) { this.opacidad_ = v; }
    getOpacity() { return this.opacidad_; }
    setVisible(v) { this.visible_ = v; }
  }
  const map = {
    getMapImpl: function () { return { scene: escena }; }
  };

  const idee = {
    layer: { TMS: TMSMock, Vector: function () {} },
    plugin: {},
    impl: { cesium: {}, layer: { Vector: function () {} } }
  };

  await conEntorno({ idee: idee, cesium: cesiumFalso() }, async () => {
    const capa = crear({ url: 'datos/ejemplo.mbtiles', name: 'MBTiles', legend: 'MBTiles' });

    // El estado se fija ANTES de que la escena exista: el .mbtiles se descarga
    // y se abre de forma asíncrona.
    capa.setOpacity(0.6);
    capa.setVisible(false);
    assert.equal(capa.getOpacity(), 0.6);
    assert.equal(capa.isVisible(), false);

    capa.addTo(map);
    await tick();

    assert.equal(escena.capasImagen.length, 1, 'debe crear una ImageryLayer en 3D');
    const imagen = escena.capasImagen[0];
    assert.equal(imagen.alpha, 0.6, 'el alpha debe salir con la opacidad guardada');
    assert.equal(imagen.show, false, 'el show debe salir con la visibilidad guardada');

    // Cambios después de crear la capa de imágenes.
    capa.setOpacity(0.25);
    assert.equal(imagen.alpha, 0.25);
    capa.setVisible(true);
    assert.equal(imagen.show, true);

    // La opacidad se acota a 0..1 (Cesium no admite otra cosa en `alpha`).
    capa.setOpacity(3);
    assert.equal(capa.getOpacity(), 1);
    assert.equal(imagen.alpha, 1);

    // Al destruir la capa, la ImageryLayer no puede quedarse en la escena.
    capa.destroy();
    assert.equal(escena.capasImagen.length, 0);
  });
});

test('mbtilesLayer: respeta opacity y visible pasados al constructor', async () => {
  const crear = global.mbtilesLayer.crear;
  const escena = escenaFalsa();

  class TMSMock {
    constructor(o) { this.opciones = o || {}; }
    addTo() {}
    destroy() {}
    setOpacity() {}
    getOpacity() { return 1; }
    setVisible() {}
  }

  const idee = {
    layer: { TMS: TMSMock, Vector: function () {} },
    plugin: {},
    impl: { cesium: {}, layer: { Vector: function () {} } }
  };

  await conEntorno({ idee: idee, cesium: cesiumFalso() }, async () => {
    const capa = crear({ url: 'datos/ejemplo.mbtiles', opacity: 0.3, visible: false });

    // Los valores del constructor tienen que llegar a la ImageryLayer igual
    // que los del selector, y a la capa base (para el 2D).
    assert.equal(capa.getOpacity(), 0.3);
    assert.equal(capa.isVisible(), false);

    capa.addTo({ getMapImpl: function () { return { scene: escena }; } });
    await tick();

    assert.equal(escena.capasImagen.length, 1);
    assert.equal(escena.capasImagen[0].alpha, 0.3);
    assert.equal(escena.capasImagen[0].show, false);
  });
});
