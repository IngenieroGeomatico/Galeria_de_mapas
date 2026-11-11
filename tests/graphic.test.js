/**
 * tests/graphic.test.js
 * Pruebas unitarias para el componente de Gráficas (IDEE.graphic) y sus modos de uso.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./setup/env');

function cargar(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  // eslint-disable-next-line no-eval
  eval(codigo);
}

cargar('./ext/graphic/graphic.js');

test('IDEE.graphic: instanciación, renderizado SVG nativo y actualización de datos', () => {
  const Graphic = global.IDEE.graphic;
  assert.ok(Graphic, 'IDEE.graphic debe estar disponible');
  assert.equal(global.IDEE.Graphic, Graphic, 'IDEE.Graphic debe ser alias');
  assert.equal(global.M.graphic, Graphic, 'M.graphic debe ser alias');

  const grafica = new Graphic({
    id: 'grafica1',
    title: 'Evolución',
    subtitle: 'Valores mensuales',
    engine: 'svg',
    chartType: 'donut',
    data: [
      { name: 'Cat A', value: 30 },
      { name: 'Cat B', value: 70 }
    ]
  });

  const bodyEl = {
    innerHTML: '',
    appendChild: function (el) { this._child = el; },
    clientWidth: 300,
    clientHeight: 200
  };

  grafica._bodyElement = bodyEl;
  grafica.render();

  assert.ok(bodyEl._child, 'debe generar el elemento SVG');
  assert.equal(bodyEl._child.tagName, 'svg');

  // Actualizar datos
  grafica.setData([
    { name: 'Cat X', value: 50 },
    { name: 'Cat Y', value: 50 }
  ]);
  assert.equal(grafica.data.length, 2);
  assert.equal(grafica.data[0].name, 'Cat X');
});

test('IDEE.graphic: 1. Modo Ventana Flotante sobre el visualizador (addToMap)', () => {
  const Graphic = global.IDEE.graphic;
  const grafica = new Graphic({
    title: 'Gráfica Flotante',
    engine: 'svg',
    chartType: 'bar',
    data: [{ name: 'A', value: 100 }]
  });

  const contenedorMapa = {
    appendChild: function (el) { this._children = this._children || []; this._children.push(el); }
  };
  const mockMap = {
    getContainer: () => contenedorMapa
  };

  grafica.addToMap(mockMap, { position: 'TR', width: 380, height: 260 });

  assert.ok(grafica._floatingElement, 'debe crear el elemento flotante');
  assert.equal(grafica._floatingElement.className, 'g-graphic-floating');
  assert.equal(grafica._floatingElement.style.width, '380px');
  assert.equal(grafica._floatingElement.style.right, '16px');
  assert.equal(grafica._floatingElement.style.top, '16px');

  grafica.destroy();
  assert.equal(grafica._floatingElement, null);
});

test('IDEE.graphic: 2. Modo Plugin con botón y panel colapsable (asPlugin)', () => {
  const Graphic = global.IDEE.graphic;
  const grafica = new Graphic({
    title: 'Estadísticas de Categorías',
    engine: 'svg',
    chartType: 'pie',
    data: [{ name: 'Norte', value: 40 }]
  });

  const plugin = grafica.asPlugin({ position: 'TL', collapsible: true, order: 2 });
  assert.ok(plugin, 'debe generar una instancia de miPlugin_graphic');
  assert.equal(plugin.name, 'miPlugin_graphic');

  let panelAnadido = null;
  const mockMap = {
    addPanel: (p) => { panelAnadido = p; }
  };

  plugin.addTo(mockMap);
  assert.ok(panelAnadido, 'debe añadir el panel al mapa');

  const estado = plugin.getState();
  assert.equal(estado.opened, false);
  plugin.setState({ opened: true });
});
