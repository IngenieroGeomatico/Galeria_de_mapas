const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

test('layerSwitcher: el selector de geometria de capas alfanumericas esta en la ficha (boton de informacion), no en la tabla de atributos', () => {
  const fuente = fs.readFileSync('./ext/selectorCapas/ext_layerSwitcher.js', 'utf8');

  // El selector debe aparecer en la ficha con boton Aplicar.
  assert.ok(fuente.indexOf('id="ls-alfa-geo"') > 0, 'ls-alfa-geo debe existir');
  assert.ok(fuente.indexOf('Aplicar') > 0, 'debe tener boton Aplicar');

  // Y debe estar dentro de openLayerFicha, no de openLayerInfo.
  const idxFicha = fuente.indexOf('window.openLayerFicha = function');
  const idxInfo = fuente.indexOf('window.openLayerInfo = function');
  const idxSelector = fuente.indexOf('id="ls-alfa-geo"');
  assert.ok(idxFicha > 0 && idxSelector > idxFicha, 'el selector debe estar dentro de openLayerFicha');
  // openLayerInfo, si existe despues, no debe contener el selector.
  if (idxInfo > 0 && idxInfo < idxSelector) {
    const segundo = fuente.indexOf('id="ls-alfa-geo"', idxSelector + 1);
    assert.equal(segundo, -1, 'no debe haber un segundo selector en openLayerInfo');
  }
});
