/**
 * ext/graphic/graphic.js
 * Componente de Gráficas para API-IDEE / API-CNIG.
 *
 * Expone `IDEE.graphic` / `IDEE.Graphic` (y alias en `M` y `window`).
 *
 * Una gráfica se puede utilizar de tres formas:
 *  1. Añadirla directamente a un visualizador como ventana flotante arrastrable:
 *       grafica.addToMap(mapajs, { floating: true, position: 'TR', width: 380, height: 260 });
 *  2. Añadirla al visualizador como plugin estándar con botón en el rail y panel colapsable:
 *       mapajs.addPlugin(grafica.asPlugin({ position: 'TL', collapsible: true, order: 1 }));
 *       // o instanciando directamente: new IDEE.plugin.miPlugin_graphic({ chartType, data, ... });
 *  3. Añadirla a un cuadro de mandos (IDEE.dashboard) o montarla en cualquier contenedor HTML:
 *       grafica.mount('miDiv');
 */

(function () {
  'use strict';

  function resolverAPI() {
    return (typeof window !== 'undefined' && (window.IDEE || window.M)) || {};
  }

  // -------------------------------------------------------------------------
  // 1. Cargador perezoso de librerías de gráficos (ECharts / D3.js)
  // -------------------------------------------------------------------------
  const LibreriasGraficos = {
    _cargando: {},

    cargarECharts() {
      if (typeof window !== 'undefined' && window.echarts) {
        return Promise.resolve(window.echarts);
      }
      if (this._cargando.echarts) return this._cargando.echarts;
      this._cargando.echarts = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
        s.async = true;
        s.onload = () => resolve(window.echarts);
        s.onerror = (e) => reject(new Error('No se pudo cargar ECharts desde CDN'));
        document.head.appendChild(s);
      });
      return this._cargando.echarts;
    },

    cargarD3() {
      if (typeof window !== 'undefined' && window.d3) {
        return Promise.resolve(window.d3);
      }
      if (this._cargando.d3) return this._cargando.d3;
      this._cargando.d3 = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
        s.async = true;
        s.onload = () => resolve(window.d3);
        s.onerror = (e) => reject(new Error('No se pudo cargar D3.js desde CDN'));
        document.head.appendChild(s);
      });
      return this._cargando.d3;
    }
  };

  // -------------------------------------------------------------------------
  // 2. Renderizador SVG nativo (Fallback sin dependencias externas)
  // -------------------------------------------------------------------------
  function renderGraficoSVGNativo(container, config) {
    container.innerHTML = '';
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 220;
    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const w = Math.max(100, width - padding.left - padding.right);
    const h = Math.max(80, height - padding.top - padding.bottom);

    const type = config.chartType || 'bar';
    const data = Array.isArray(config.data) ? config.data : [];
    if (!data.length) {
      container.innerHTML = '<div class="g-graphic-empty">Sin datos para representar</div>';
      return;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.overflow = 'hidden';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${padding.left}, ${padding.top})`);
    svg.appendChild(g);

    const colPrimaria = config.color || 'var(--g-graphic-primary, #0284c7)';
    const paleta = config.colors || ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    if (type === 'bar') {
      const labels = data.map((d) => String(d.name || d.label || d.x || ''));
      const values = data.map((d) => Number(d.value || d.y || 0));
      const maxVal = Math.max(...values, 1);
      const stepX = w / data.length;
      const barW = Math.max(8, stepX * 0.65);

      const ejeX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ejeX.setAttribute('x1', '0');
      ejeX.setAttribute('y1', String(h));
      ejeX.setAttribute('x2', String(w));
      ejeX.setAttribute('y2', String(h));
      ejeX.setAttribute('stroke', 'var(--g-graphic-border, #cbd5e1)');
      g.appendChild(ejeX);

      values.forEach((v, i) => {
        const barH = (v / maxVal) * (h - 10);
        const x = i * stepX + (stepX - barW) / 2;
        const y = h - barH;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(barW));
        rect.setAttribute('height', String(barH));
        rect.setAttribute('rx', '3');
        rect.setAttribute('fill', paleta[i % paleta.length] || colPrimaria);
        rect.setAttribute('class', 'g-graphic-bar');
        rect.style.cursor = 'pointer';

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${labels[i]}: ${v}`;
        rect.appendChild(title);

        if (typeof config.onClick === 'function') {
          rect.addEventListener('click', () => config.onClick(data[i], i));
        }
        g.appendChild(rect);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', String(x + barW / 2));
        txt.setAttribute('y', String(h + 16));
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-size', '11');
        txt.setAttribute('fill', 'var(--g-graphic-text-muted, #64748b)');
        txt.textContent = labels[i].length > 8 ? labels[i].slice(0, 7) + '…' : labels[i];
        g.appendChild(txt);
      });
    } else if (type === 'line' || type === 'area') {
      const values = data.map((d) => Number(d.value || d.y || 0));
      const labels = data.map((d) => String(d.name || d.label || d.x || ''));
      const maxVal = Math.max(...values, 1);
      const minVal = Math.min(...values, 0);
      const rango = maxVal - minVal || 1;
      const stepX = data.length > 1 ? w / (data.length - 1) : w / 2;

      const pts = values.map((v, i) => {
        const x = i * stepX;
        const y = h - ((v - minVal) / rango) * (h - 10);
        return [x, y];
      });

      if (type === 'area') {
        const polyPts = [[0, h], ...pts, [pts[pts.length - 1][0], h]]
          .map((p) => p.join(','))
          .join(' ');
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', polyPts);
        poly.setAttribute('fill', colPrimaria);
        poly.setAttribute('fill-opacity', '0.15');
        g.appendChild(poly);
      }

      const pathStr = pts.reduce((acc, p, i) => acc + (i === 0 ? `M ${p[0]} ${p[1]}` : ` L ${p[0]} ${p[1]}`), '');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathStr);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', colPrimaria);
      path.setAttribute('stroke-width', '2.5');
      g.appendChild(path);

      pts.forEach((p, i) => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(p[0]));
        dot.setAttribute('cy', String(p[1]));
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', '#ffffff');
        dot.setAttribute('stroke', colPrimaria);
        dot.setAttribute('stroke-width', '2');
        dot.style.cursor = 'pointer';

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${labels[i]}: ${values[i]}`;
        dot.appendChild(title);

        if (typeof config.onClick === 'function') {
          dot.addEventListener('click', () => config.onClick(data[i], i));
        }
        g.appendChild(dot);
      });
    } else if (type === 'pie' || type === 'donut') {
      const values = data.map((d) => Math.max(0, Number(d.value || d.y || 0)));
      const labels = data.map((d) => String(d.name || d.label || d.x || ''));
      const total = values.reduce((a, b) => a + b, 0) || 1;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) * 0.9;
      const rInner = type === 'donut' ? r * 0.55 : 0;

      let angAcum = -Math.PI / 2;
      values.forEach((v, i) => {
        const ang = (v / total) * Math.PI * 2;
        const angFin = angAcum + ang;

        const x1 = cx + r * Math.cos(angAcum);
        const y1 = cy + r * Math.sin(angAcum);
        const x2 = cx + r * Math.cos(angFin);
        const y2 = cy + r * Math.sin(angFin);

        const x3 = cx + rInner * Math.cos(angFin);
        const y3 = cy + rInner * Math.sin(angFin);
        const x4 = cx + rInner * Math.cos(angAcum);
        const y4 = cy + rInner * Math.sin(angAcum);

        const largeArc = ang > Math.PI ? 1 : 0;
        let d = '';
        if (rInner > 0) {
          d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
        } else {
          d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', paleta[i % paleta.length]);
        path.setAttribute('stroke', 'var(--g-graphic-card-bg, #ffffff)');
        path.setAttribute('stroke-width', '1.5');
        path.style.cursor = 'pointer';

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${labels[i]}: ${v} (${Math.round((v / total) * 100)}%)`;
        path.appendChild(title);

        if (typeof config.onClick === 'function') {
          path.addEventListener('click', () => config.onClick(data[i], i));
        }
        g.appendChild(path);

        angAcum = angFin;
      });
    }

    container.appendChild(svg);
  }

  // -------------------------------------------------------------------------
  // 3. Clase Graphic (IDEE.graphic / IDEE.Graphic)
  // -------------------------------------------------------------------------
  class Graphic {
    constructor(options = {}) {
      this.id = options.id || 'graphic_' + Math.random().toString(36).slice(2, 8);
      this.title = options.title || '';
      this.subtitle = options.subtitle || '';
      this.engine = options.engine || 'auto'; // 'echarts' | 'd3' | 'svg' | 'auto'
      this.chartType = options.chartType || 'bar'; // 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'gauge' | 'custom'
      this.data = options.data || [];
      this.options = options.options || {};
      this.renderD3 = options.renderD3 || null;
      this.onSelect = options.onSelect || null;

      this.container = null;
      this._chartInstance = null;
      this._resizeObserver = null;
      this._floatingElement = null;
      this._bodyElement = null;
    }

    mount(target) {
      const el = typeof target === 'string' ? document.getElementById(target) : target;
      if (!el) return this;
      this.container = el;
      this.container.innerHTML = '';
      this.container.classList.add('g-graphic-container');

      if (this.title || this.subtitle) {
        const header = document.createElement('div');
        header.className = 'g-graphic-header';
        if (this.title) {
          const t = document.createElement('h4');
          t.className = 'g-graphic-title';
          t.textContent = this.title;
          header.appendChild(t);
        }
        if (this.subtitle) {
          const st = document.createElement('span');
          st.className = 'g-graphic-subtitle';
          st.textContent = this.subtitle;
          header.appendChild(st);
        }
        this.container.appendChild(header);
      }

      const body = document.createElement('div');
      body.className = 'g-graphic-body';
      this.container.appendChild(body);
      this._bodyElement = body;

      this.render();
      this._setupResize();
      return this;
    }

    async render() {
      if (!this._bodyElement) return;

      const engine = this._resolveEngine();
      if (engine === 'echarts') {
        try {
          const echarts = await LibreriasGraficos.cargarECharts();
          if (this._chartInstance && this._chartInstance.dispose) {
            this._chartInstance.dispose();
          }
          this._chartInstance = echarts.init(this._bodyElement, this.options.theme || null);
          const echartsOption = this._buildEChartsOption();
          this._chartInstance.setOption(echartsOption, true);
          if (this.onSelect) {
            this._chartInstance.on('click', (params) => {
              this.onSelect(params.data, params);
            });
          }
          return;
        } catch (e) {
          console.warn('[IDEE.graphic] ECharts no disponible, usando motor SVG nativo:', e);
        }
      }

      if (engine === 'd3') {
        try {
          const d3 = await LibreriasGraficos.cargarD3();
          this._bodyElement.innerHTML = '';
          if (typeof this.renderD3 === 'function') {
            this.renderD3(this._bodyElement, this.data, d3, this);
            return;
          }
        } catch (e) {
          console.warn('[IDEE.graphic] D3 no disponible, usando motor SVG nativo:', e);
        }
      }

      // Motor nativo SVG
      renderGraficoSVGNativo(this._bodyElement, {
        chartType: this.chartType,
        data: typeof this.data === 'function' ? this.data() : this.data,
        color: this.options.color,
        colors: this.options.colors,
        onClick: (item, idx) => {
          if (this.onSelect) this.onSelect(item, idx);
        }
      });
    }

    setData(newData) {
      this.data = newData;
      this.render();
      return this;
    }

    _resolveEngine() {
      if (this.engine && this.engine !== 'auto') return this.engine;
      if (typeof window !== 'undefined' && window.echarts) return 'echarts';
      if (typeof this.renderD3 === 'function') return 'd3';
      return 'echarts';
    }

    _buildEChartsOption() {
      if (this.options && Object.keys(this.options).length && this.options.series) {
        return this.options;
      }
      const data = typeof this.data === 'function' ? this.data() : this.data;
      const labels = data.map((d) => String(d.name || d.label || d.x || ''));
      const values = data.map((d) => (typeof d.value !== 'undefined' ? d.value : d.y || 0));

      const type = this.chartType === 'area' ? 'line' : this.chartType;
      const baseOption = {
        animation: true,
        tooltip: { trigger: type === 'pie' || type === 'donut' ? 'item' : 'axis' },
        grid: { left: '10%', right: '8%', top: '15%', bottom: '15%', containLabel: true }
      };

      if (type === 'pie' || type === 'donut') {
        baseOption.series = [
          {
            type: 'pie',
            radius: type === 'donut' ? ['45%', '70%'] : '70%',
            data: data.map((d) => ({ name: d.name || d.label, value: d.value || d.y })),
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } }
          }
        ];
      } else {
        baseOption.xAxis = { type: 'category', data: labels, axisLabel: { interval: 0, rotate: labels.length > 6 ? 30 : 0 } };
        baseOption.yAxis = { type: 'value' };
        const s = {
          type: type,
          data: values,
          itemStyle: { borderRadius: type === 'bar' ? [4, 4, 0, 0] : 0 }
        };
        if (this.chartType === 'area') {
          s.areaStyle = { opacity: 0.25 };
          s.smooth = true;
        }
        baseOption.series = [s];
      }
      return Object.assign(baseOption, this.options);
    }

    _setupResize() {
      if (typeof ResizeObserver === 'undefined') return;
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._resizeObserver = new ResizeObserver(() => {
        if (this._chartInstance && typeof this._chartInstance.resize === 'function') {
          this._chartInstance.resize();
        } else {
          this.render();
        }
      });
      if (this.container) this._resizeObserver.observe(this.container);
    }

    /**
     * Opción A: Añadir la gráfica al visualizador como VENTANA FLOTANTE arrastrable.
     * @param {Object} map Instancia del visualizador API-IDEE.
     * @param {Object} [opts] Opciones ({ position: 'TR'|'TL'|'BR'|'BL', width, height, title }).
     */
    addToMap(map, opts = {}) {
      const api = resolverAPI();
      const mapContainer = (map && typeof map.getContainer === 'function' ? map.getContainer() : null) ||
        document.querySelector('.m-api-idee-container') ||
        document.body;

      const floatEl = document.createElement('div');
      floatEl.className = 'g-graphic-floating';
      floatEl.style.width = typeof opts.width === 'number' ? `${opts.width}px` : opts.width || '380px';
      floatEl.style.height = typeof opts.height === 'number' ? `${opts.height}px` : opts.height || '260px';

      const pos = opts.position || 'TR';
      if (pos.includes('T')) floatEl.style.top = '16px';
      if (pos.includes('B')) floatEl.style.bottom = '24px';
      if (pos.includes('R')) floatEl.style.right = '16px';
      if (pos.includes('L')) floatEl.style.left = '16px';

      const header = document.createElement('div');
      header.className = 'g-graphic-floating-header';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'g-graphic-floating-title';
      titleSpan.textContent = opts.title || this.title || 'Gráfica';
      header.appendChild(titleSpan);

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'g-graphic-floating-actions';

      const btnCollapse = document.createElement('button');
      btnCollapse.type = 'button';
      btnCollapse.className = 'g-graphic-btn-icon g-graphic-btn-collapse';
      btnCollapse.title = 'Minimizar';
      btnCollapse.textContent = '▾';

      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.className = 'g-graphic-btn-icon g-graphic-btn-close';
      btnClose.title = 'Cerrar';
      btnClose.textContent = '✕';

      actionsWrap.appendChild(btnCollapse);
      actionsWrap.appendChild(btnClose);
      header.appendChild(actionsWrap);
      floatEl.appendChild(header);

      const body = document.createElement('div');
      body.className = 'g-graphic-floating-content';
      floatEl.appendChild(body);

      mapContainer.appendChild(floatEl);
      this._floatingElement = floatEl;
      this.mount(body);

      btnCollapse.addEventListener('click', () => {
        const collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        btnCollapse.textContent = collapsed ? '▾' : '▸';
        floatEl.style.height = collapsed ? (opts.height || '260px') : 'auto';
      });

      btnClose.addEventListener('click', () => this.destroy());

      if (api.utils && typeof api.utils.draggabillyPlugin === 'function') {
        try {
          api.utils.draggabillyPlugin(floatEl, header);
        } catch (e) { /* noop */ }
      }
      return this;
    }

    /**
     * Opción B: Convertir la gráfica en un PLUGIN con botón en el rail y panel colapsable.
     * @param {Object} [pluginOpts] Opciones del plugin ({ position: 'TL', collapsible, order, title }).
     * @returns {miPlugin_graphic}
     */
    asPlugin(pluginOpts = {}) {
      const opts = Object.assign({
        title: this.title || 'Gráfica',
        graphic: this
      }, pluginOpts);
      return new miPlugin_graphic(opts);
    }

    destroy() {
      if (this._resizeObserver) this._resizeObserver.disconnect();
      if (this._chartInstance && this._chartInstance.dispose) {
        this._chartInstance.dispose();
      }
      if (this._floatingElement && this._floatingElement.parentNode) {
        this._floatingElement.parentNode.removeChild(this._floatingElement);
      }
      this._floatingElement = null;
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Plugin de visualizador con Panel para Gráfica (miPlugin_graphic)
  // -------------------------------------------------------------------------
  class miPlugin_graphic {
    constructor(options = {}) {
      this.name = 'miPlugin_graphic';
      this.options = options;
      this.position = options.position || 'TL';
      this.collapsible = options.collapsible !== false;
      this.order = options.order != null ? options.order : 2;
      this.tooltip = options.tooltip || 'Gráfica estadística';
      this._panel = null;
      this._graphic = options.graphic || new Graphic(options);
    }

    addTo(map) {
      const api = resolverAPI();
      if (!api.ui || typeof api.ui.Panel !== 'function') return;

      const panel = new api.ui.Panel('toolsExtra_graphic', {
        title: this.options.title || this._graphic.title || 'Gráfica',
        className: 'g-herramienta_graphic g-panel-lateral',
        position: api.ui && api.ui.position ? api.ui.position[this.position] || this.position : this.position,
        collapsible: this.collapsible,
        collapsed: this.options.collapsed !== false
      });

      this._panel = panel;
      map.addPanel(panel);

      const panelEl = panel.getElement ? panel.getElement() : document.querySelector('.m-panel.g-herramienta_graphic');
      if (panelEl && this.order != null) {
        panelEl.style.order = String(this.order);
      }

      const body = document.createElement('div');
      body.className = 'g-herramienta_graphic-body';
      if (panelEl) {
        const controls = panelEl.querySelector('.m-panel-controls') || panelEl;
        controls.appendChild(body);
      }

      this._graphic.mount(body);
    }

    getGraphic() {
      return this._graphic;
    }

    getState() {
      const isOpened = this._panel && this._panel.getElement
        ? this._panel.getElement().classList.contains('opened')
        : false;
      return { opened: isOpened };
    }

    setState(state) {
      if (!state || !this._panel) return;
      if (state.opened && typeof this._panel.open === 'function') {
        this._panel.open();
      }
    }

    destroy() {
      if (this._graphic) this._graphic.destroy();
    }
  }

  // -------------------------------------------------------------------------
  // 5. Exposición global triple
  // -------------------------------------------------------------------------
  Graphic.Librerias = LibreriasGraficos;

  if (typeof window !== 'undefined') {
    window.Graphic = Graphic;
    window.miPlugin_graphic = miPlugin_graphic;

    window.IDEE = window.IDEE || {};
    window.IDEE.graphic = Graphic;
    window.IDEE.Graphic = Graphic;
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_graphic = miPlugin_graphic;

    window.M = window.M || {};
    window.M.graphic = Graphic;
    window.M.Graphic = Graphic;
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_graphic = miPlugin_graphic;
  }
})();
