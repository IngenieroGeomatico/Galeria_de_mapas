# 📊 Cuadros de Mandos y Gráficas (Dashboard)

> Extensión integral para construir cuadros de mandos interactivos, tableros analíticos y ventanas flotantes de gráficas conectadas a mapas con la API-IDEE / API-CNIG.

Permite organizar en un único contenedor o página completa:
- **Cabecera personalizable**: título, subtítulo, logotipo, acciones globales y cambio de tema (claro/oscuro).
- **Sistema de pestañas (Tabs)**: segmentación de vistas y temáticas.
- **Cuadrícula responsive (CSS Grid / Flex)**: distribución en filas, columnas y áreas.
- **Componentes interactivos interconectados**: mapas 2D/3D API-IDEE, gráficas de datos, tarjetas de indicadores (KPIs), tablas y filtros con bus de eventos reactivo.
- **Motor de gráficas abierto**: compatibilidad transparente con **ECharts**, **D3.js** y motor SVG nativo integrado sin dependencias externas.
- **Widgets de gráfica sobre el mapa**: ventanas flotantes arrastrables sobre el lienzo cartográfico o paneles colapsables de la API.

---

## 🚀 Integración rápida

Vincula los recursos en el HTML:

```html
<!-- Estilos -->
<link rel="stylesheet" href="../../ext/dashboard/dashboard.css" />
<!-- Script -->
<script type="text/javascript" src="../../ext/dashboard/dashboard.js"></script>
```

---

## 🛠️ Ejemplos de uso

### 1. Cuadro de mandos con mapa, gráficas y KPIs

```js
const dashboard = new IDEE.Dashboard({
  container: 'dashboardDIV',
  theme: 'light',
  header: {
    title: 'Monitor de Calidad y Tráfico',
    subtitle: 'Estadísticas territoriales en tiempo real',
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

---

### 2. Gráfica flotante arrastrable sobre el mapa

Puedes añadir ventanas flotantes arrastrables con gráficas directamente sobre cualquier mapa de la API-IDEE:

```js
const chart = new IDEE.widget.Chart({
  title: 'Evolución Temporal',
  chartType: 'line',
  data: [
    { label: 'Ene', value: 120 },
    { label: 'Feb', value: 180 },
    { label: 'Mar', value: 240 },
    { label: 'Abr', value: 210 },
    { label: 'May', value: 310 }
  ]
});

// Añade la ventana flotante en la esquina superior derecha
chart.addToMap(mapajs, {
  position: 'TR',
  width: 360,
  height: 240
});
```

---

### 3. Gráfica dentro de un panel lateral de plugin

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_dashboard({
  title: 'Estadísticas',
  position: 'TL',
  charts: [
    {
      title: 'Distribución por Categorías',
      chartType: 'bar',
      data: [
        { name: 'Urbano', value: 85 },
        { name: 'Forestal', value: 120 },
        { name: 'Agrícola', value: 95 }
      ]
    }
  ]
}));
```

---

## ⚡ Conexión y Reactividad entre Componentes

El cuadro de mandos incluye un **Bus de Eventos**:

```js
// Escuchar cuando el usuario hace clic en una barra o sector de la gráfica
dashboard.on('select:graficaSectores', (item) => {
  console.log('Elemento seleccionado:', item.name, item.value);
  // Filtrar o centrar el mapa
});

// Emitir eventos personalizados
dashboard.emit('filtroCambio', { categoria: 'Forestal' });
```
