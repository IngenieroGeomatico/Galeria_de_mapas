const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

function cargar(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  // eslint-disable-next-line no-eval
  eval(codigo);
}

cargar('./ext/alphanumericLayer/alphanumericLayer.js');

const T = global.AlphanumericTestables;

test('detectarSeparador: punto y coma', () => {
  assert.equal(T.detectarSeparador('a;b;c\n1;2;3'), ';');
});

test('parsearCSV: básico con ;', () => {
  const res = T.parsearCSV('a;b\n1;2\n3;4', ';');
  assert.deepEqual(res, [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('matrizARegistros: infiere campos', () => {
  const m = [['nombre', 'edad'], ['Ana', '30'], ['Luis', '25']];
  const r = T.matrizARegistros(m, (v) => (isNaN(Number(v)) ? v : Number(v)));
  assert.equal(r.registros.length, 2);
  assert.deepEqual(r.registros[0], { nombre: 'Ana', edad: 30 });
  assert.equal(r.campos.length, 2);
});

test('esWKT: detecta WKT', () => {
  assert.equal(T.esWKT('POINT(1 2)'), true);
  assert.equal(T.esWKT('no es wkt'), false);
});

test('wktAGeoJSON: POINT', () => {
  const g = T.wktAGeoJSON('POINT(1 2)');
  assert.deepEqual(g, { type: 'Point', coordinates: [1, 2] });
});

test('wktAGeoJSON: POLYGON', () => {
  const g = T.wktAGeoJSON('POLYGON((0 0,1 0,1 1,0 1,0 0))');
  assert.equal(g.type, 'Polygon');
  assert.equal(g.coordinates[0].length, 5);
});

test('normalizarCRS: identidad', () => {
  assert.equal(T.normalizarCRS('EPSG:4326'), 'EPSG:4326');
});

test('inferirTipo: número y texto', () => {
  assert.equal(T.inferirTipo('42'), 'integer');
  assert.equal(T.inferirTipo('hola'), 'string');
});

test('convertirValor: número', () => {
  assert.equal(T.convertirValor('3.14'), 3.14);
});

test('normalizarRegistros: array de objetos', () => {
  const r = T.normalizarRegistros([{ a: 1 }, { a: 2 }]);
  assert.equal(r.length, 2);
});

test('geometriaDeValor: Point GeoJSON', () => {
  const g = T.geometriaDeValor({ type: 'Point', coordinates: [1, 2] });
  assert.deepEqual(g, { type: 'Point', coordinates: [1, 2] });
});
