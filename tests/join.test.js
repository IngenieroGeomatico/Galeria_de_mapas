const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

function cargar(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  eval(codigo);
}

cargar('./ext/joinLayer/joinLayer.js');

const T = global.JoinLayerTestables;

test('normalizarClave: case insensitive por defecto', () => {
  assert.equal(T.normalizarClave('  Hola  '), 'hola');
  assert.equal(T.normalizarClave('Hola', true), 'Hola');
  assert.equal(T.normalizarClave(null), '');
});

test('clonarSimple: clon profundo', () => {
  const o = { a: [1, 2], b: { c: 3 } };
  const c = T.clonarSimple(o);
  c.a.push(9); c.b.c = 99;
  assert.deepEqual(o, { a: [1, 2], b: { c: 3 } });
});

test('calcularBBoxGeometria: punto', () => {
  const b = T.calcularBBoxGeometria({ type: 'Point', coordinates: [1, 2] });
  assert.deepEqual(b, [1, 2, 1, 2]);
});

test('bboxesSeTocan: solape y disjunto', () => {
  assert.equal(T.bboxesSeTocan([0, 0, 1, 1], [0.5, 0.5, 2, 2]), true);
  assert.equal(T.bboxesSeTocan([0, 0, 1, 1], [2, 2, 3, 3]), false);
});

test('centroideBBox', () => {
  assert.deepEqual(T.centroideBBox([0, 0, 2, 4]), [1, 2]);
});

test('distanciaPuntos', () => {
  assert.equal(T.distanciaPuntos([0, 0], [3, 4]), 5);
});

test('puntoEnAnillo: dentro/fuera', () => {
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(T.puntoEnAnillo([5, 5], ring), true);
  assert.equal(T.puntoEnAnillo([15, 5], ring), false);
});

test('calcularAgregacion: sum/avg/min/max/count', () => {
  assert.equal(T.calcularAgregacion([1, 2, 3], 'sum'), 6);
  assert.equal(T.calcularAgregacion([1, 2, 3], 'avg'), 2);
  assert.equal(T.calcularAgregacion([1, 2, 3], 'min'), 1);
  assert.equal(T.calcularAgregacion([1, 2, 3], 'max'), 3);
  assert.equal(T.calcularAgregacion([1, 2, 3], 'count'), 3);
});

test('evaluarPredicadoEspacial: intersects bbox', () => {
  const g1 = { type: 'Point', coordinates: [1, 1] };
  const g2 = { type: 'Point', coordinates: [1, 1] };
  assert.equal(T.evaluarPredicadoEspacial(g1, g2, 'intersects'), true);
});

test('resolverCapaEnMapa: por legend', () => {
  const capa = { idLayer: 'id1', legend: 'MiCapa', name: 'MiCapa' };
  const mapa = { getLayers: () => [capa] };
  assert.equal(T.resolverCapaEnMapa(mapa, 'MiCapa'), capa);
});
