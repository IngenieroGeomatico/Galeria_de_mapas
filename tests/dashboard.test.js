/**
 * tests/dashboard.test.js
 * Pruebas unitarias para la extensión de Cuadros de Mandos (Dashboard) y Gráficas.
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

cargar('./ext/dashboard/dashboard.js');

test('Dashboard: instanciación con cabecera, pestañas y componentes', () => {
  const Dashboard = global.IDEE.Dashboard;
  assert.ok(Dashboard, 'IDEE.Dashboard debe estar definido');

  // Contenedor mock
  const domContainer = {
    innerHTML: '',
    className: '',
    appendChild: function (el) { this._children = this._children || []; this._children.push(el); },
    querySelectorAll: function () { return []; }
  };

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

test('EventBus: suscripción, emisión y limpieza', () => {
  const Dashboard = global.IDEE.Dashboard;
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

test('ChartWidget: creación, renderizado SVG nativo y actualización de datos', () => {
  const ChartWidget = global.IDEE.widget.Chart;
  assert.ok(ChartWidget, 'IDEE.widget.Chart debe estar disponible');

  const chart = new ChartWidget({
    id: 'grafica1',
    title: 'Evolución',
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

  chart._bodyElement = bodyEl;
  chart.render();

  assert.ok(bodyEl._child, 'debe generar el elemento SVG');
  assert.equal(bodyEl._child.tagName, 'svg');

  // Actualizar datos
  chart.setData([
    { name: 'Cat X', value: 50 },
    { name: 'Cat Y', value: 50 }
  ]);
  assert.equal(chart.data.length, 2);
  assert.equal(chart.data[0].name, 'Cat X');
});

test('ChartWidget: addToMap genera ventana flotante arrastrable en el mapa', () => {
  const ChartWidget = global.IDEE.widget.Chart;
  const chart = new ChartWidget({
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

  chart.addToMap(mockMap, { position: 'TR', width: 350, height: 220 });

  assert.ok(chart._floatingElement, 'debe crear el elemento flotante');
  assert.equal(chart._floatingElement.className, 'g-dash-floating-chart');
  assert.equal(chart._floatingElement.style.width, '350px');
  assert.equal(chart._floatingElement.style.right, '16px');
  assert.equal(chart._floatingElement.style.top, '16px');

  chart.destroy();
  assert.equal(chart._floatingElement, null);
});

test('miPlugin_dashboard: plugin de mapa con contrato getState/setState', () => {
  const PluginDashboard = global.IDEE.plugin.miPlugin_dashboard;
  assert.ok(PluginDashboard, 'IDEE.plugin.miPlugin_dashboard debe estar disponible');

  const plugin = new PluginDashboard({
    title: 'Estadísticas Rápidas',
    position: 'TL',
    charts: [
      { title: 'Barras', engine: 'svg', data: [{ name: '1', value: 5 }] }
    ]
  });

  let panelAnadido = null;
  const mockMap = {
    addPanel: (p) => { panelAnadido = p; }
  };

  plugin.addTo(mockMap);
  assert.ok(panelAnadido, 'debe añadir el panel a través de addPanel');

  const estado = plugin.getState();
  assert.ok(typeof estado === 'object');
  assert.equal(estado.opened, false);

  plugin.setState({ opened: true });
});
