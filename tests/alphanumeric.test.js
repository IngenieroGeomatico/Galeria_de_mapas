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

test('AlphanumericLayer: constructor con source conteniendo array de JSON simple', () => {
  const AlphanumericLayer = global.IDEE.layer.Alphanumeric;
  const capa = new AlphanumericLayer({
    name: 'prueba_array_json',
    source: [
      { id: 1, nombre: 'Ana', edad: 30 },
      { id: 2, nombre: 'Pedro', edad: 25 }
    ]
  });
  const records = capa.getRecords();
  assert.equal(records.length, 2);
  assert.equal(records[0].nombre, 'Ana');
  assert.equal(records[1].edad, 25);
});

test('AlphanumericLayer: constructor con source conteniendo array de GeoJSON Features', () => {
  const AlphanumericLayer = global.IDEE.layer.Alphanumeric;
  const capa = new AlphanumericLayer({
    name: 'prueba_array_features',
    source: [
      {
        type: 'Feature',
        id: 'f1',
        geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
        properties: { nombre: 'Madrid', poblacion: 3300000 }
      },
      {
        type: 'Feature',
        id: 'f2',
        geometry: { type: 'Point', coordinates: [2.1, 41.3] },
        properties: { nombre: 'Barcelona', poblacion: 1600000 }
      }
    ],
    idField: '__idee_id'
  });
  const records = capa.getRecords();
  assert.equal(records.length, 2);
  assert.equal(records[0].nombre, 'Madrid');
  assert.equal(JSON.parse(records[0].__idee_geojson).type, 'Point');
  assert.equal(records[0].__idee_id, 'f1');
});

test('showcase: el ejemplo de alphanumericLayer convierte los datos y los pinta', () => {
  // `IDEE.layer.Alphanumeric` no pinta nada: `addTo` solo registra los datos.
  // El ejemplo del showcase tiene que dar el paso a `GeoJSON`, porque si no
  // se abre la pagina y no aparece ninguna capa en el mapa.
  const fuente = fs.readFileSync('./ext/_comun/showcase.js', 'utf8');
  const inicio = fuente.indexOf("if (ext === 'alphanumericLayer') {");
  const fin = fuente.indexOf("if (ext === 'mbtilesLayer') {");
  assert.ok(inicio > 0 && fin > inicio, 'no se encontro el ejemplo de alphanumericLayer');

  const bloque = fuente.slice(inicio, fin);
  assert.match(bloque, /toGeoJSON\(\)/, 'el ejemplo debe convertir las capas con toGeoJSON()');
  assert.match(bloque, /IDEE\.layer\.GeoJSON/, 'el ejemplo debe crear una capa GeoJSON visible');
  assert.match(bloque, /addLayers\(/, 'el ejemplo debe anadir la capa visible al mapa');
});
