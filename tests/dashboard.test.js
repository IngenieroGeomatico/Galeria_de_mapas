/**
 * tests/dashboard.test.js
 * Pruebas unitarias para la extensión de Cuadros de Mandos (IDEE.dashboard).
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
cargar('./ext/dashboard/dashboard.js');

test('IDEE.dashboard: instanciación con cabecera, pestañas y componentes', () => {
  const Dashboard = global.IDEE.dashboard;
  assert.ok(Dashboard, 'IDEE.dashboard debe estar definido');
  assert.equal(global.IDEE.Dashboard, Dashboard, 'IDEE.Dashboard debe ser alias');
  assert.equal(global.M.dashboard, Dashboard, 'M.dashboard debe ser alias');

  const dash = new Dashboard({
    autoMount: false,
    theme: 'dark',
    header: {
      title: 'Panel Territorial',
      subtitle: 'Indicadores clave',
      logo: '<svg></svg>'
    },
    tabs: [
      {
        id: 'tab1',
        title: 'General',
        components: [
          { id: 'kpi1', type: 'kpi', title: 'Total', value: 1500, unit: 'km²' },
          { id: 'chart1', type: 'chart', chartType: 'bar', data: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }] }
        ]
      },
      {
        id: 'tab2',
        title: 'Detalle',
        components: [
          { id: 'table1', type: 'table', data: [{ id: 1, val: 'OK' }] }
        ]
      }
    ]
  });

  assert.equal(dash.title, 'Panel Territorial');
  assert.equal(dash.activeTabId, 'tab1');
  assert.equal(dash.theme, 'dark');

  // Cambio de pestaña
  let eventoTab = null;
  dash.on('tabChange', (payload) => { eventoTab = payload; });
  dash.setTab('tab2');
  assert.equal(dash.activeTabId, 'tab2');
  assert.deepEqual(eventoTab, { tabId: 'tab2' });
});

test('IDEE.dashboard: EventBus para reactividad y conexión', () => {
  const Dashboard = global.IDEE.dashboard;
  const dash = new Dashboard({ autoMount: false });

  let llamadas = 0;
  let ultimoPayload = null;

  const unsubscribe = dash.on('filtro', (p) => {
    llamadas++;
    ultimoPayload = p;
  });

  dash.emit('filtro', { sector: 'Norte' });
  assert.equal(llamadas, 1);
  assert.deepEqual(ultimoPayload, { sector: 'Norte' });

  unsubscribe();
  dash.emit('filtro', { sector: 'Sur' });
  assert.equal(llamadas, 1, 'después de desuscribirse no debe invocarse');
});
