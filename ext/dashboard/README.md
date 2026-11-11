# 📊 Cuadros de Mandos (IDEE.dashboard)

> Extensión para construir cuadros de mandos interactivos y tableros analíticos conectados a visualizadores y gráficas con la API-IDEE / API-CNIG.

Permite organizar en un único contenedor o página completa:
- **Cabecera personalizable**: título, subtítulo, logotipo, acciones globales y cambio de tema (claro/oscuro).
- **Sistema de pestañas (Tabs)**: segmentación de vistas y temáticas.
- **Cuadrícula responsive (CSS Grid / Flex)**: distribución en filas, columnas y áreas declarativas.
- **Componentes interactivos interconectados**: visualizadores 2D/3D API-IDEE, gráficas estadísticas (`IDEE.graphic`), tarjetas de indicadores (KPIs), tablas y filtros con bus de eventos reactivo.

---

## 🚀 Integración

```html
<!-- Recursos de gráficas (si se usan) -->
<link rel="stylesheet" href="../../ext/graphic/graphic.css" />
<script type="text/javascript" src="../../ext/graphic/graphic.js"></script>

<!-- Recursos del cuadro de mandos -->
<link rel="stylesheet" href="../../ext/dashboard/dashboard.css" />
<script type="text/javascript" src="../../ext/dashboard/dashboard.js"></script>
```

---

## 🛠️ Ejemplo de uso

```js
const dashboard = new IDEE.dashboard({
  container: 'dashboardDIV',
  theme: 'light',
  header: {
    title: 'Monitor Territorial',
    subtitle: 'Estadísticas e indicadores en tiempo real',
    logo: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>'
  },
  tabs: [
    {
      id: 'general',
      title: 'Visión General',
      layout: {
        columns: '2fr 1fr'
      },
      components: [
        {
          id: 'mapaPrincipal',
          type: 'map',
          title: 'Visualizador Territorial',
          height: 480,
          zoom: 6,
          center: { x: -412000, y: 4928000 }
        },
        {
          id: 'kpiTotal',
          type: 'kpi',
          title: 'Total Estaciones',
          value: '1.420',
          unit: 'est.',
          trend: { direction: 'up', text: '+8.4%' }
        },
        {
          id: 'graficaSectores',
          type: 'chart',
          title: 'Distribución por Sectores',
          chartType: 'donut',
          data: [
            { name: 'Norte', value: 450 },
            { name: 'Sur', value: 320 },
            { name: 'Este', value: 280 },
            { name: 'Oeste', value: 370 }
          ]
        }
      ]
    }
  ]
});
```
