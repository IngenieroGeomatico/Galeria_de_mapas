const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

function cargar(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  eval(codigo);
}

cargar('./ext/madridOpenDataLayer/madridOpenDataLayer.js');

const T = global.MadridTestables;

test('filtrarFilas: por texto', () => {
  const regs = [{ desc_distrito_local: 'CENTRO' }, { desc_distrito_local: 'SALAMANCA' }];
  const r = T.filtrarFilas(regs, 'salamanca');
  assert.equal(r.length, 1);
  assert.equal(r[0].desc_distrito_local, 'SALAMANCA');
});

test('filtrarFilas: RegExp', () => {
  const regs = [{ a: 'foo' }, { a: 'bar' }];
  const r = T.filtrarFilas(regs, /^foo$/);
  assert.equal(r.length, 0); // JSON.stringify contiene comillas
});

test('cargarRecurso: datastore con paginación', async () => {
  let calls = 0;
  global.fetch = async function (url) {
    calls++;
    const u = String(url);
    if (/resource_show/.test(u)) {
      return { ok: true, json: async function () { return { success: true, result: { id: 'r1', url: 'http://x.csv', format: 'CSV' } }; } };
    }
    if (/datastore_search/.test(u)) {
      return { ok: true, json: async function () { return { success: true, result: { total: 2, records: [{ a: 1 }, { a: 2 }], fields: [{ id: 'a', type: 'int' }] } }; } };
    }
    return { ok: false, status: 404, json: async function () { return {}; } };
  };
  const capa = await global.Madrid.cargarRecurso('r1', { limit: 10 });
  assert.equal(capa.getRecords().length, 2);
  assert.equal(capa.getRecords()[0].a, 1);
});

test('buscarDatasets: devuelve results', async () => {
  global.fetch = async function () {
    return { ok: true, json: async function () { return { success: true, result: { results: [{ id: 'd1', title: 'T1' }] } }; } };
  };
  const r = await global.Madrid.buscarDatasets('población');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'd1');
});
