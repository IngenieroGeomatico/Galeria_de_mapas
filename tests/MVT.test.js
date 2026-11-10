const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

function cargar(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  eval(codigo);
}

cargar('./ext/MVTLayer/MVTLayer.js');

const T = global.MVTTestables;

test('areaConSigno: cuadrado positivo', () => {
  const anillo = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.ok(Math.abs(T.areaConSigno(anillo)) > 0);
});

test('puntoALonLat: dentro de rango', () => {
  const c = T.puntoALonLat(2048, 2048, 1, 0, 0, 4096);
  assert.ok(c[0] >= -180 && c[0] <= 180);
  assert.ok(c[1] >= -90 && c[1] <= 90);
});

test('puntoEnAnillo: dentro/fuera', () => {
  const anillo = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(T.puntoEnAnillo(5, 5, anillo), true);
  assert.equal(T.puntoEnAnillo(15, 5, anillo), false);
});

test('puntoEnPoligono: hueco', () => {
  const exterior = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const hueco = [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }];
  const poli = [{ exterior: exterior, huecos: [hueco] }];
  assert.equal(T.puntoEnPoligono(5, 5, poli), false);
  assert.equal(T.puntoEnPoligono(1, 1, poli), true);
});

test('LectorMVT: instancia y cache vacío', () => {
  const L = T.LectorMVT;
  const lector = new L({ url: 'http://x/{z}/{x}/{y}.pbf', capas: 'municipio', extent: 4096 });
  assert.equal(lector.extent, 4096);
  assert.deepEqual(lector.getFeaturesGeoJSON(), []);
});

/* ------------------------------------------------------------------ *
 * Opacidad de la capa MVT en 3D
 *
 * REGRESIÓN QUE ESTOS TESTS CUBREN (medida en el visualizador)
 *
 * `IDEE.layer.MVT` en 3D pinta la coropleta con una capa de imágenes de
 * Cesium (`imageryLayers.addImageryProvider`). El selector de capas mueve la
 * opacidad llamando a `capa.setOpacity(0..1)`, y la API delega en la
 * implementación. Como ni la fachada ni el impl ni el renderizador exponían
 * `setOpacity`, la llamada se perdía en silencio (el selector comprueba
 * `typeof capa.setOpacity === 'function'` antes de llamar), el deslizador se
 * movía y el mapa no cambiaba: el fallo no dejaba ni un error en consola.
 *
 * Por eso aquí no basta con comprobar que el método existe: se comprueba que
 * la opacidad llega al `alpha` de la capa de imágenes, que es lo que se pinta,
 * y que sobrevive a un `refrescar()` (que es cuando se recrea la capa al
 * cambiar la coropleta).
 * ------------------------------------------------------------------ */

/**
 * Monta la API mínima que necesita el plugin para instalar su fachada en 3D y
 * devuelve la clase resultante, el mapa de mentira y la escena de mentira.
 * @returns {Object}
 */
function entornoMVT3D() {
  const constructorMVT = global.IDEE.plugin.miPlugin_MVTLayer;
  const viejoIDEE = global.IDEE;
  const viejoCesium = window.Cesium;

  // Lo mínimo que toca `MVTImageryProvider` en el constructor.
  window.Cesium = {
    WebMercatorTilingScheme: function WebMercatorTilingScheme() {
      this.rectangle = { west: -Math.PI, south: -Math.PI / 2, east: Math.PI, north: Math.PI / 2 };
    },
    Event: function Event() {
      this.addEventListener = function () {};
    }
  };

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

  global.IDEE = {
    evt: { SELECT_FEATURES: 'select' },
    layer: {
      Vector: class VectorMock {
        constructor(parameters, options, vendorOptions, impl) {
          this.impl_ = impl;
        }
        getImpl() { return this.impl_; }
      }
    },
    impl: {
      cesium: {},
      layer: {
        Vector: class VectorImplMock {
          constructor() { this.opacity = 1; }
          setOpacity(v) { this.opacity = v; }
          getOpacity() { return this.opacity; }
        }
      }
    }
  };
  global.M = global.IDEE;

  const plugin = new constructorMVT();
  plugin.addTo({ getLayers() { return []; }, getMapImpl() { return { scene: escena }; } });

  function restaurar() {
    global.IDEE = viejoIDEE;
    global.M = viejoIDEE;
    window.Cesium = viejoCesium;
  }

  return {
    Fachada: global.IDEE.layer.MVT,
    escena: escena,
    restaurar: restaurar
  };
}

test('MVTLayer: la opacidad llega al alpha del ImageryLayer de Cesium', () => {
  const entorno = entornoMVT3D();
  try {
    assert.equal(typeof entorno.Fachada, 'function', 'la fachada MVT debe quedar instalada en 3D');

    const capa = new entorno.Fachada({ url: 'http://x/{z}/{x}/{y}.pbf', layers: 'municipio' });
    capa.getImpl().render.scene = entorno.escena;
    // El selector mueve la opacidad ANTES de que la escena esté lista: se guarda.
    assert.equal(capa.getOpacity(), 1);
    capa.setOpacity(0.35);
    assert.equal(capa.getOpacity(), 0.35);

    // Al crearse la capa de imágenes, hereda la opacidad guardada.
    capa.getImpl().render.refrescar();
    assert.equal(entorno.escena.capasImagen.length, 1);
    const imagen = entorno.escena.capasImagen[0];
    assert.equal(imagen.alpha, 0.35, 'el alpha del ImageryLayer debe reflejar la opacidad');

    // Y cambiarla con la capa ya pintada se aplica en caliente.
    capa.setOpacity(0.8);
    assert.equal(imagen.alpha, 0.8);

    // El refresco recrea la capa de imágenes y NO puede perder la opacidad.
    capa.getImpl().render.refrescar();
    assert.equal(entorno.escena.capasImagen.length, 1);
    assert.equal(entorno.escena.capasImagen[0].alpha, 0.8,
      'refrescar() no debe resetear la opacidad a 1');
  } finally {
    entorno.restaurar();
  }
});

test('MVTLayer: la opacidad se acota a 0..1 y conserva la visibilidad', () => {
  const entorno = entornoMVT3D();
  try {
    const capa = new entorno.Fachada({ url: 'http://x/{z}/{x}/{y}.pbf', layers: 'municipio' });
    capa.getImpl().render.scene = entorno.escena;
    capa.getImpl().render.refrescar();
    const imagen = entorno.escena.capasImagen[0];

    capa.setOpacity(2);
    assert.equal(capa.getOpacity(), 1);
    assert.equal(imagen.alpha, 1);

    capa.setOpacity(-1);
    assert.equal(capa.getOpacity(), 0);
    assert.equal(imagen.alpha, 0);

    capa.setOpacity(0.5);
    capa.setVisible(false);
    assert.equal(imagen.show, false);
    assert.equal(imagen.alpha, 0.5, 'ocultar no debe tocar la opacidad');
    capa.setVisible(true);
    assert.equal(imagen.show, true);
    assert.equal(imagen.alpha, 0.5);
  } finally {
    entorno.restaurar();
  }
});
