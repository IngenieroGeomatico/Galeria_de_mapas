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
