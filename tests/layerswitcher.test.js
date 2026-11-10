const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

test('layerSwitcher: el selector de geometria de capas alfanumericas esta en la ficha (boton de informacion), no en la tabla de atributos', () => {
  const fuente = fs.readFileSync('./ext/selectorCapas/ext_layerSwitcher.js', 'utf8');

  // El selector solo debe aparecer una vez: en la ficha.
  const ocurrencias = fuente.split('ls-alfa-geo').length - 1;
  assert.equal(ocurrencias, 1, 'ls-alfa-geo debe aparecer una sola vez (en la ficha)');

  // Y debe estar dentro de openLayerFicha, no de openLayerInfo.
  const idxFicha = fuente.indexOf('window.openLayerFicha = function');
  const idxInfo = fuente.indexOf('window.openLayerInfo = function');
  const idxSelector = fuente.indexOf('ls-alfa-geo');
  assert.ok(idxFicha > 0 && idxSelector > idxFicha, 'el selector debe estar dentro de openLayerFicha');
  // openLayerInfo, si existe despues, no debe contener el selector.
  if (idxInfo > 0 && idxInfo < idxSelector) {
    // El selector esta antes que openLayerInfo: comprobar que no hay otro despues.
    const segundo = fuente.indexOf('ls-alfa-geo', idxSelector + 1);
    assert.equal(segundo, -1, 'no debe haber un segundo selector en openLayerInfo');
  }
});
