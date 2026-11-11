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

test('AlphanumericLayer: constructor con source de formato JSON plano y campo geometry (GeoJSON)', () => {
  const AlphanumericLayer = global.IDEE.layer.Alphanumeric;
  const capa = new AlphanumericLayer({
    name: 'prueba_json_plano_geojson',
    source: [
      { nombre: 'Barcelona (Ramblas)', categoria: 'Paseo', visitas: 3800, geometry: { type: 'Point', coordinates: [2.1734, 41.3851] } },
      { nombre: 'Madrid (Sol)', categoria: 'Monumento', visitas: 4500, geometry: { type: 'Point', coordinates: [-3.7037, 40.4167] } }
    ]
  });
  const records = capa.getRecords();
  assert.equal(records.length, 2);
  assert.equal(records[0].nombre, 'Barcelona (Ramblas)');
  const fc = capa.toGeoJSON();
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc.features.length, 2);
  assert.equal(fc.features[0].geometry.type, 'Point');
  assert.deepEqual(fc.features[0].geometry.coordinates, [2.1734, 41.3851]);
  assert.equal(fc.features[0].properties.nombre, 'Barcelona (Ramblas)');
  assert.equal(fc.features[0].properties.visitas, 3800);
});

test('AlphanumericLayer: constructor con source de formato JSON plano y campo geometry (WKT)', () => {
  const AlphanumericLayer = global.IDEE.layer.Alphanumeric;
  const capa = new AlphanumericLayer({
    name: 'prueba_json_plano_wkt',
    source: [
      { nombre: 'Valencia (Artes)', categoria: 'Cultura', visitas: 2900, geometry: 'POINT(-0.3547 39.4549)' }
    ]
  });
  const fc = capa.toGeoJSON();
  assert.equal(fc.features.length, 1);
  assert.equal(fc.features[0].geometry.type, 'Point');
  assert.deepEqual(fc.features[0].geometry.coordinates, [-0.3547, 39.4549]);
  assert.equal(fc.features[0].properties.nombre, 'Valencia (Artes)');
});

test('AlphanumericLayer: asignacion de campo a geometria con convertirCampoAGeometria', () => {
  const AlphanumericLayer = global.IDEE.layer.Alphanumeric;
  const capa = new AlphanumericLayer({
    name: 'prueba_asignar_geo',
    records: [
      { ciudad: 'Sevilla', coords_wkt: 'POINT(-5.9845 37.3891)', hab: 688000 }
    ]
  });
  assert.equal(capa.hasGeometry(), false);
  capa.convertirCampoAGeometria('wkt', { field: 'coords_wkt' });
  assert.equal(capa.hasGeometry(), true);
  const fc = capa.toGeoJSON();
  assert.equal(fc.features.length, 1);
  assert.equal(fc.features[0].geometry.type, 'Point');
  assert.deepEqual(fc.features[0].geometry.coordinates, [-5.9845, 37.3891]);
});

test('AlphanumericLayer: soporte para geometrías WKB y EWKB (HEX)', () => {
  const AlphanumericLayer = global.IDEE.layer.Alphanumeric;

  // WKB estándar Point (-3.7038, 40.4168)
  const bufWKB = Buffer.alloc(21);
  bufWKB.writeUInt8(1, 0);
  bufWKB.writeUInt32LE(1, 1);
  bufWKB.writeDoubleLE(-3.7038, 5);
  bufWKB.writeDoubleLE(40.4168, 13);
  const wkbHex = bufWKB.toString('hex');

  // EWKB con SRID 4326 Point (-0.3763, 39.4699)
  const bufEWKB = Buffer.alloc(25);
  bufEWKB.writeUInt8(1, 0);
  bufEWKB.writeUInt32LE(0x20000001, 1); // Point + SRID flag
  bufEWKB.writeUInt32LE(4326, 5);
  bufEWKB.writeDoubleLE(-0.3763, 9);
  bufEWKB.writeDoubleLE(39.4699, 17);
  const ewkbHex = bufEWKB.toString('hex');

  const capa = new AlphanumericLayer({
    name: 'prueba_wkb_ewkb',
    records: [
      { id: 1, nombre: 'Madrid', geom_wkb: wkbHex },
      { id: 2, nombre: 'Valencia', geom_wkb: ewkbHex }
    ]
  });

  const det = capa.detectarCamposGeo();
  assert.equal(det.wkbField, 'geom_wkb');

  capa.convertirCampoAGeometria('wkb', { field: 'geom_wkb' });
  assert.equal(capa.hasGeometry(), true);

  const fc = capa.toGeoJSON();
  assert.equal(fc.features.length, 2);
  assert.equal(fc.features[0].geometry.type, 'Point');
  assert.ok(Math.abs(fc.features[0].geometry.coordinates[0] - (-3.7038)) < 1e-4);
  assert.ok(Math.abs(fc.features[0].geometry.coordinates[1] - 40.4168) < 1e-4);

  assert.equal(fc.features[1].geometry.type, 'Point');
  assert.ok(Math.abs(fc.features[1].geometry.coordinates[0] - (-0.3763)) < 1e-4);
  assert.ok(Math.abs(fc.features[1].geometry.coordinates[1] - 39.4699) < 1e-4);
});

test('showcase: el ejemplo de alphanumericLayer añade directamente las 2 capas al mapa', () => {
  const fuente = fs.readFileSync('./ext/_comun/showcase.js', 'utf8');
  const inicio = fuente.indexOf("if (ext === 'alphanumericLayer') {");
  const fin = fuente.indexOf("if (ext === 'mbtilesLayer') {");
  assert.ok(inicio > 0 && fin > inicio, 'no se encontro el ejemplo de alphanumericLayer');

  const bloque = fuente.slice(inicio, fin);
  assert.match(bloque, /capaCSV\.addTo\(mapajs\)/, 'el ejemplo debe anadir capaCSV');
  assert.match(bloque, /capaJSON\.addTo\(mapajs\)/, 'el ejemplo debe anadir capaJSON');
  // No debe crear capas GeoJSON artificiales adicionales
  assert.ok(!bloque.includes('new IDEE.layer.GeoJSON'), 'no debe haber capas GeoJSON duplicadas en el showcase');
});
