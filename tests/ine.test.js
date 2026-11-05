const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

function cargar(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  eval(codigo);
}

cargar('./ext/ineLayer/ineLayer.js');

const T = global.INETestables;

test('filtrarSeries: por texto', () => {
  const data = [{ Nombre: 'Andalucía, RECURSOS: X', Data: [] }, { Nombre: 'Aragón, RECURSOS: Y', Data: [] }];
  const r = T.filtrarSeries(data, 'Aragón');
  assert.equal(r.length, 1);
  assert.equal(r[0].Nombre, 'Aragón, RECURSOS: Y');
});

test('filtrarSeries: RegExp', () => {
  const data = [{ Nombre: 'Madrid', Data: [] }, { Nombre: 'Barcelona', Data: [] }];
  const r = T.filtrarSeries(data, /^Mad/);
  assert.equal(r.length, 1);
});

test('filtrarColumnas: conserva base + permitidas', () => {
  const regs = [{ serie: 's', periodo: '2023', valor: 5, secreto: false, extra: 9 }];
  const r = T.filtrarColumnas(regs, ['extra']);
  assert.deepEqual(r[0], { serie: 's', periodo: '2023', valor: 5, secreto: false, extra: 9 });
});

test('filtrarColumnas: sin columnas devuelve igual', () => {
  const regs = [{ a: 1 }];
  const r = T.filtrarColumnas(regs, null);
  assert.deepEqual(r, regs);
});

test('cargarTabla: construye parámetros y parsea respuesta', async () => {
  const respuesta = [{ Nombre: 'Serie A', Data: [{ NombrePeriodo: '2023', Valor: 42, Secreto: false }] }];
  global.fetch = async function (url) {
    // verificar parámetros
    if (!/DATOS_TABLA\/67301/.test(url)) throw new Error('url inesperada: ' + url);
    if (!/nult=5/.test(url)) throw new Error('falta nult');
    if (!/tip=A/.test(url)) throw new Error('falta tip');
    return { ok: true, json: async function () { return respuesta; } };
  };
  const capa = await global.INE.cargarTabla('67301', { nult: 5, tip: 'A', name: 'Renta' });
  assert.equal(capa.getRecords().length, 1);
  assert.equal(capa.getRecords()[0].valor, 42);
  assert.equal(capa.name, 'Renta');
});
