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

test('MVTLayer: opacidad en la implementacion y fachada', () => {
  // Obtenemos las funciones constructoras desde el código cargado
  // Como están en una clausura de MVTLayer.js, podemos extraer las funciones creadoras.
  // Vamos a mockear la inicialización para verificar setOpacity/getOpacity.
  const constructorMVT = global.IDEE.plugin.miPlugin_MVTLayer;
  assert.ok(constructorMVT);

  // Verificamos si podemos extraer crearImplementacion y crearFachada indirectamente
  // o recrear un mock de la clase MVTImplVector.
  // Como están instalados en IDEE, podemos simular la fachada y su impl si se registraran.
  // Pero podemos simplemente probar los métodos del RenderMVT si estuviéramos en la clausura.
  // Dado que no están todos exportados a global, si mockeamos la API IDEE:
  const oldIDEE = global.IDEE;
  global.IDEE = {
    evt: { SELECT_FEATURES: 'select' },
    layer: {
      Vector: class MockVector {
        constructor(p, o, v, impl) {
          this.impl_ = impl;
        }
        getImpl() { return this.impl_; }
      }
    },
    impl: {
      cesium: {},
      layer: {
        Vector: class MockImplVector {
          constructor() {
            this.opacity_ = 1.0;
          }
          setOpacity(v) { this.opacity_ = v; }
          getOpacity() { return this.opacity_; }
        }
      }
    }
  };
  global.M = global.IDEE;

  try {
    // Instanciamos el plugin para registrar las clases de fachada e implementación
    const plugin = new constructorMVT();
    plugin.addTo({
      getLayers() { return []; },
      getMapImpl() { return { scene: {} }; }
    });

    const FachadaMVTClass = global.IDEE.layer.MVT;
    assert.ok(FachadaMVTClass);

    const capa = new FachadaMVTClass({ url: 'http://x/{z}/{x}/{y}.pbf', layers: 'municipio' });
    assert.equal(capa.getOpacity(), 1.0);

    capa.setOpacity(0.5);
    assert.equal(capa.getOpacity(), 0.5);

    capa.setOpacity(0.85);
    assert.equal(capa.getOpacity(), 0.85);
  } finally {
    global.IDEE = oldIDEE;
    global.M = oldIDEE;
  }
});
