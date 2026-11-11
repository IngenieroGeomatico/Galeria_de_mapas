# 📈 Gráficas Estadísticas (IDEE.graphic)

> Componente independiente de gráficas para visualizadores cartográficos y cuadros de mandos con la API-IDEE / API-CNIG.

Permite renderizar gráficas interactivas con **ECharts**, **D3.js** o mediante un motor vectorial **SVG nativo** integrado.

---

## 🎯 Formas de uso

Una gráfica creada con `new IDEE.graphic(options)` se puede utilizar de tres formas:

### 1. Como Ventana Flotante sobre el Visualizador
Crea una ventana arrastrable sobre el mapa, con cabecera movible, botón para minimizar/expandir y botón de cierre:

```js
const grafica = new IDEE.graphic({
  title: 'Evolución de Tráfico',
  chartType: 'line',
  data: [
    { label: '08:00', value: 450 },
    { label: '12:00', value: 720 },
    { label: '16:00', value: 890 },
    { label: '20:00', value: 610 }
  ]
});

// Añadir al visualizador en la esquina superior derecha
grafica.addToMap(mapajs, {
  position: 'TR',
  width: 380,
  height: 250
});
```

---

### 2. Como Botón con Panel Colapsable en el Visualizador (Plugin)
Se integra en el rail de herramientas con el glifo de gráfica de la API-IDEE:

```js
const grafica = new IDEE.graphic({
  title: 'Distribución por Categorías',
  chartType: 'donut',
  data: [
    { name: 'Urbano', value: 120 },
    { name: 'Forestal', value: 340 },
    { name: 'Agrícola', value: 210 }
  ]
});

// Convertir en plugin y añadir al visualizador
mapajs.addPlugin(grafica.asPlugin({
  position: 'TL',
  collapsible: true,
  order: 1
}));
```

O instanciando directamente el plugin:

```js
mapajs.addPlugin(new IDEE.plugin.miPlugin_graphic({
  title: 'Sectores',
  chartType: 'bar',
  data: [{ name: 'A', value: 30 }, { name: 'B', value: 70 }]
}));
```

---

### 3. Dentro de un Cuadro de Mandos (`IDEE.dashboard`) o Contenedor HTML
```js
grafica.mount('miContenedorDIV');
```
