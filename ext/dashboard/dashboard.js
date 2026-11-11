/**
 * ext/dashboard/dashboard.js
 * Extensión de Cuadros de Mandos (Dashboards) para API-IDEE / API-CNIG.
 *
 * Permite construir cuadros de mandos interactivos compuestos por:
 *  - Cabecera opcional con título, subtítulo, logo, acciones y filtros globales.
 *  - Sistema de pestañas (tabs) navegables o vista única.
 *  - Layout flexible por cuadrícula responsive (Grid / Flex).
 *  - Componentes conectados entre sí (Mapas API-IDEE, Gráficas interactivas, KPIs, Tablas, Filtros).
 *  - Soporte de gráficas con ECharts, D3.js o motor vectorial SVG integrado.
 *  - Widgets de gráfica que pueden montarse en el dashboard, incrustarse en paneles de plugins
 *    o añadirse como ventanas flotantes arrastrables sobre el mapa.
 */

(function () {
  'use strict';

  function resolverAPI() {
    return (typeof window !== 'undefined' && (window.IDEE || window.M)) || {};
  }

  // -------------------------------------------------------------------------
  // 1. Bus de Eventos para reactividad y conexión entre componentes
  // -------------------------------------------------------------------------
  class EventBus {
    constructor() {
      this._listeners = new Map();
    }

    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(callback);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (this._listeners.has(event)) {
        this._listeners.get(event).delete(callback);
      }
    }

    emit(event, payload) {
      if (this._listeners.has(event)) {
        this._listeners.get(event).forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('[Dashboard EventBus] Error en listener de "' + event + '":', err);
          }
        });
      }
    }

    clear() {
      this._listeners.clear();
    }
  }

  // -------------------------------------------------------------------------
  // 2. Cargador perezoso de librerías de gráficos (ECharts / D3.js)
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
  // 3. Renderizador SVG básico nativo (Fallback sin librerías externas)
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
      container.innerHTML = '<div class="g-dash-empty">Sin datos para representar</div>';
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

    const colPrimaria = config.color || 'var(--g-dash-primary, #0284c7)';
    const paleta = config.colors || ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    if (type === 'bar') {
      const labels = data.map((d) => String(d.name || d.label || d.x || ''));
      const values = data.map((d) => Number(d.value || d.y || 0));
      const maxVal = Math.max(...values, 1);
      const stepX = w / data.length;
      const barW = Math.max(8, stepX * 0.65);

      // Eje X línea
      const ejeX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ejeX.setAttribute('x1', '0');
      ejeX.setAttribute('y1', String(h));
      ejeX.setAttribute('x2', String(w));
      ejeX.setAttribute('y2', String(h));
      ejeX.setAttribute('stroke', 'var(--g-dash-border, #cbd5e1)');
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
        rect.setAttribute('class', 'g-dash-bar');
        rect.style.cursor = 'pointer';

        // Tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${labels[i]}: ${v}`;
        rect.appendChild(title);

        if (typeof config.onClick === 'function') {
          rect.addEventListener('click', () => config.onClick(data[i], i));
        }
        g.appendChild(rect);

        // Etiqueta X
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', String(x + barW / 2));
        txt.setAttribute('y', String(h + 16));
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-size', '11');
        txt.setAttribute('fill', 'var(--g-dash-text-muted, #64748b)');
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
        path.setAttribute('stroke', 'var(--g-dash-card-bg, #ffffff)');
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
  // 4. Clase ChartWidget (Widget de Gráficas interactivo y reutilizable)
  // -------------------------------------------------------------------------
  class ChartWidget {
    constructor(options = {}) {
      this.id = options.id || 'chart_' + Math.random().toString(36).slice(2, 8);
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
    }

    mount(target) {
      const el = typeof target === 'string' ? document.getElementById(target) : target;
      if (!el) return this;
      this.container = el;
      this.container.innerHTML = '';
      this.container.classList.add('g-dash-chart-container');

      if (this.title || this.subtitle) {
        const header = document.createElement('div');
        header.className = 'g-dash-widget-header';
        if (this.title) {
          const t = document.createElement('h4');
          t.className = 'g-dash-widget-title';
          t.textContent = this.title;
          header.appendChild(t);
        }
        if (this.subtitle) {
          const st = document.createElement('span');
          st.className = 'g-dash-widget-subtitle';
          st.textContent = this.subtitle;
          header.appendChild(st);
        }
        this.container.appendChild(header);
      }

      const body = document.createElement('div');
      body.className = 'g-dash-chart-body';
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
          console.warn('[Dashboard ChartWidget] ECharts no disponible, usando motor SVG nativo:', e);
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
          console.warn('[Dashboard ChartWidget] D3 no disponible, usando motor SVG nativo:', e);
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
     * Añade la gráfica como ventana flotante arrastrable directamente sobre el mapa.
     * @param {Object} map Instancia del mapa API-IDEE.
     * @param {Object} [opts] Opciones de posición ({ position: 'TR'|'TL'|'BR'|'BL', width, height, title }).
     */
    addToMap(map, opts = {}) {
      const api = resolverAPI();
      const mapContainer = (map && typeof map.getContainer === 'function' ? map.getContainer() : null) ||
        document.querySelector('.m-api-idee-container') ||
        document.body;

      const floatEl = document.createElement('div');
      floatEl.className = 'g-dash-floating-chart';
      floatEl.style.width = typeof opts.width === 'number' ? `${opts.width}px` : opts.width || '380px';
      floatEl.style.height = typeof opts.height === 'number' ? `${opts.height}px` : opts.height || '260px';

      const pos = opts.position || 'TR';
      if (pos.includes('T')) floatEl.style.top = '16px';
      if (pos.includes('B')) floatEl.style.bottom = '24px';
      if (pos.includes('R')) floatEl.style.right = '16px';
      if (pos.includes('L')) floatEl.style.left = '16px';

      // Cabecera arrastrable con botón de colapso y cierre
      const header = document.createElement('div');
      header.className = 'g-dash-floating-header';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'g-dash-floating-title';
      titleSpan.textContent = opts.title || this.title || 'Gráfica';
      header.appendChild(titleSpan);

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'g-dash-floating-actions';

      const btnCollapse = document.createElement('button');
      btnCollapse.type = 'button';
      btnCollapse.className = 'g-dash-btn-icon g-dash-btn-collapse';
      btnCollapse.title = 'Minimizar';
      btnCollapse.textContent = '▾';

      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.className = 'g-dash-btn-icon g-dash-btn-close';
      btnClose.title = 'Cerrar';
      btnClose.textContent = '✕';

      actionsWrap.appendChild(btnCollapse);
      actionsWrap.appendChild(btnClose);
      header.appendChild(actionsWrap);
      floatEl.appendChild(header);

      const body = document.createElement('div');
      body.className = 'g-dash-floating-content';
      floatEl.appendChild(body);

      mapContainer.appendChild(floatEl);
      this._floatingElement = floatEl;
      this.mount(body);

      // Eventos minimizar / cerrar
      btnCollapse.addEventListener('click', () => {
        const collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        btnCollapse.textContent = collapsed ? '▾' : '▸';
        floatEl.style.height = collapsed ? (opts.height || '260px') : 'auto';
      });

      btnClose.addEventListener('click', () => this.destroy());

      // Arrastre si draggabillyPlugin está disponible
      if (api.utils && typeof api.utils.draggabillyPlugin === 'function') {
        try {
          api.utils.draggabillyPlugin(floatEl, header);
        } catch (e) { /* noop */ }
      }
      return this;
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
  // 5. Clase Dashboard (Gestor principal del Cuadro de Mandos)
  // -------------------------------------------------------------------------
  class Dashboard {
    constructor(options = {}) {
      this.containerId = options.container || 'dashboardDIV';
      this.title = options.title || (options.header && options.header.title) || '';
      this.subtitle = options.subtitle || (options.header && options.header.subtitle) || '';
      this.logo = options.logo || (options.header && options.header.logo) || '';
      this.theme = options.theme || 'light';
      this.headerConfig = options.header || (this.title ? { title: this.title, subtitle: this.subtitle, logo: this.logo } : null);
      this.tabs = options.tabs || [];
      this.components = options.components || [];
      this.layout = options.layout || 'grid';
      this.activeTabId = options.activeTab || (this.tabs.length ? this.tabs[0].id : null);

      this.bus = new EventBus();
      this._widgets = new Map();
      this._maps = new Map();
      this._containerEl = null;

      if (options.autoMount !== false && this.containerId) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.mount());
        } else {
          setTimeout(() => this.mount(), 0);
        }
      }
    }

    mount(target) {
      const container = typeof target === 'string'
        ? document.getElementById(target)
        : target || document.getElementById(this.containerId);

      if (!container) {
        console.warn('[Dashboard] No se encontró el contenedor objetivo:', this.containerId);
        return this;
      }
      this._containerEl = container;
      container.innerHTML = '';
      container.className = `g-dashboard g-dashboard--${this.theme}`;

      // 1. Cabecera opcional
      if (this.headerConfig && this.headerConfig.visible !== false) {
        this._renderHeader(container);
      }

      // 2. Navegación por pestañas
      if (this.tabs && this.tabs.length > 0) {
        this._renderTabsNav(container);
      }

      // 3. Contenedor principal de vistas
      const main = document.createElement('main');
      main.className = 'g-dashboard-main';
      container.appendChild(main);
      this._mainEl = main;

      // 4. Renderizar contenido activo
      this._renderActiveContent();
      return this;
    }

    _renderHeader(container) {
      const header = document.createElement('header');
      header.className = 'g-dashboard-header';

      const left = document.createElement('div');
      left.className = 'g-dashboard-header__brand';

      if (this.headerConfig.logo) {
        const logoWrap = document.createElement('div');
        logoWrap.className = 'g-dashboard-header__logo';
        if (this.headerConfig.logo.startsWith('<svg') || this.headerConfig.logo.startsWith('<img')) {
          logoWrap.innerHTML = this.headerConfig.logo;
        } else {
          const img = document.createElement('img');
          img.src = this.headerConfig.logo;
          img.alt = 'Logo';
          logoWrap.appendChild(img);
        }
        left.appendChild(logoWrap);
      }

      const titles = document.createElement('div');
      titles.className = 'g-dashboard-header__titles';
      if (this.headerConfig.title) {
        const h1 = document.createElement('h1');
        h1.className = 'g-dashboard-header__title';
        h1.textContent = this.headerConfig.title;
        titles.appendChild(h1);
      }
      if (this.headerConfig.subtitle) {
        const p = document.createElement('p');
        p.className = 'g-dashboard-header__subtitle';
        p.textContent = this.headerConfig.subtitle;
        titles.appendChild(p);
      }
      left.appendChild(titles);
      header.appendChild(left);

      // Acciones o filtros globales en cabecera
      const right = document.createElement('div');
      right.className = 'g-dashboard-header__actions';
      if (Array.isArray(this.headerConfig.actions)) {
        this.headerConfig.actions.forEach((act) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `g-dash-btn ${act.className || ''}`;
          btn.innerHTML = (act.icon ? `<span class="g-dash-btn__icon">${act.icon}</span> ` : '') + (act.label || '');
          if (typeof act.onClick === 'function') {
            btn.addEventListener('click', () => act.onClick(this));
          }
          right.appendChild(btn);
        });
      }
      header.appendChild(right);
      container.appendChild(header);
    }

    _renderTabsNav(container) {
      const nav = document.createElement('nav');
      nav.className = 'g-dashboard-tabs';

      this.tabs.forEach((tab) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `g-dashboard-tab ${tab.id === this.activeTabId ? 'g-dashboard-tab--active' : ''}`;
        btn.innerHTML = (tab.icon ? `<span class="g-dashboard-tab__icon">${tab.icon}</span>` : '') +
          `<span class="g-dashboard-tab__label">${tab.title || tab.id}</span>`;
        btn.addEventListener('click', () => this.setTab(tab.id));
        nav.appendChild(btn);
      });

      container.appendChild(nav);
      this._tabsNavEl = nav;
    }

    setTab(tabId) {
      if (this.activeTabId === tabId) return;
      this.activeTabId = tabId;

      if (this._tabsNavEl) {
        const btns = this._tabsNavEl.querySelectorAll('.g-dashboard-tab');
        this.tabs.forEach((t, i) => {
          if (btns[i]) {
            btns[i].classList.toggle('g-dashboard-tab--active', t.id === tabId);
          }
        });
      }
      this._renderActiveContent();
      this.bus.emit('tabChange', { tabId });
    }

    _renderActiveContent() {
      if (!this._mainEl) return;
      this._mainEl.innerHTML = '';

      let comps = this.components;
      let layout = this.layout;

      if (this.tabs && this.tabs.length > 0) {
        const tab = this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0];
        if (tab) {
          comps = tab.components || [];
          layout = tab.layout || layout;
        }
      }

      const grid = document.createElement('div');
      grid.className = 'g-dashboard-grid';
      if (typeof layout === 'object' && layout.columns) {
        grid.style.gridTemplateColumns = layout.columns;
      }
      if (typeof layout === 'object' && layout.areas) {
        grid.style.gridTemplateAreas = layout.areas.map((a) => `"${a}"`).join(' ');
      }
      this._mainEl.appendChild(grid);

      comps.forEach((compConfig) => {
        this._renderComponent(grid, compConfig);
      });
    }

    _renderComponent(parent, config) {
      const card = document.createElement('section');
      card.className = `g-dash-card g-dash-card--${config.type || 'generic'}`;
      card.id = `dash_card_${config.id || Math.random().toString(36).slice(2, 7)}`;

      if (config.colSpan) card.style.gridColumn = `span ${config.colSpan}`;
      if (config.rowSpan) card.style.gridRow = `span ${config.rowSpan}`;
      if (config.gridArea) card.style.gridArea = config.gridArea;
      if (config.height) card.style.height = typeof config.height === 'number' ? `${config.height}px` : config.height;

      // Cabecera de la tarjeta
      if (config.title || config.actions) {
        const header = document.createElement('div');
        header.className = 'g-dash-card__header';
        if (config.title) {
          const h3 = document.createElement('h3');
          h3.className = 'g-dash-card__title';
          h3.textContent = config.title;
          header.appendChild(h3);
        }
        if (config.subtitle) {
          const st = document.createElement('p');
          st.className = 'g-dash-card__subtitle';
          st.textContent = config.subtitle;
          header.appendChild(st);
        }
        card.appendChild(header);
      }

      const body = document.createElement('div');
      body.className = 'g-dash-card__body';
      card.appendChild(body);
      parent.appendChild(card);

      // Inicialización por tipo
      const type = config.type || 'chart';

      if (type === 'map') {
        this._initMapComponent(body, config);
      } else if (type === 'chart') {
        const widget = new ChartWidget(Object.assign({}, config, {
          onSelect: (item, idx) => {
            if (config.onSelect) config.onSelect(item, idx, this);
            this.bus.emit(`select:${config.id}`, item);
          }
        }));
        widget.mount(body);
        this._widgets.set(config.id, widget);
      } else if (type === 'kpi' || type === 'indicator') {
        this._renderKPIComponent(body, config);
      } else if (type === 'table') {
        this._renderTableComponent(body, config);
      } else if (type === 'filter') {
        this._renderFilterComponent(body, config);
      } else if (type === 'html' || typeof config.render === 'function') {
        if (typeof config.render === 'function') {
          config.render(body, this);
        } else if (config.html) {
          body.innerHTML = config.html;
        }
      }
    }

    _initMapComponent(container, config) {
      const api = resolverAPI();
      const mapDivId = `map_${config.id || Math.random().toString(36).slice(2, 7)}`;
      container.id = mapDivId;
      container.style.minHeight = config.height || '350px';

      if (!api.map) {
        container.innerHTML = '<div class="g-dash-empty">API-IDEE no disponible para inicializar mapa</div>';
        return;
      }

      const mapOptions = Object.assign({
        container: mapDivId,
        zoom: config.zoom || 6,
        center: config.center || { x: -412000, y: 4928000 }
      }, config.mapOptions || {});

      const mapInstance = api.map(mapOptions);
      this._maps.set(config.id || mapDivId, mapInstance);

      if (Array.isArray(config.layers)) {
        config.layers.forEach((l) => mapInstance.addLayers(l));
      }
      if (Array.isArray(config.plugins)) {
        config.plugins.forEach((p) => mapInstance.addPlugin(p));
      }

      // Conexión reactiva de extensión
      if (config.syncExtent) {
        const trigger = () => {
          this.bus.emit(`extent:${config.id}`, {
            zoom: mapInstance.getZoom ? mapInstance.getZoom() : null,
            center: mapInstance.getCenter ? mapInstance.getCenter() : null
          });
        };
        if (typeof mapInstance.on === 'function') {
          mapInstance.on('moveend', trigger);
        }
      }

      if (typeof config.onReady === 'function') {
        config.onReady(mapInstance, this);
      }
    }

    _renderKPIComponent(container, config) {
      container.classList.add('g-dash-kpi');
      const val = config.value !== undefined ? config.value : '--';
      const label = config.label || config.title || '';
      const unit = config.unit || '';
      const trend = config.trend || null; // { direction: 'up'|'down', text: '+12%' }

      let trendHtml = '';
      if (trend) {
        const isUp = trend.direction === 'up' || String(trend.text).startsWith('+');
        const arrow = isUp ? '↑' : '↓';
        const trendClass = isUp ? 'g-dash-kpi__trend--up' : 'g-dash-kpi__trend--down';
        trendHtml = `<span class="g-dash-kpi__trend ${trendClass}">${arrow} ${trend.text || ''}</span>`;
      }

      container.innerHTML = `
        <div class="g-dash-kpi__content">
          <div class="g-dash-kpi__value-wrap">
            <span class="g-dash-kpi__value">${val}</span>
            ${unit ? `<span class="g-dash-kpi__unit">${unit}</span>` : ''}
          </div>
          ${label ? `<div class="g-dash-kpi__label">${label}</div>` : ''}
          ${trendHtml}
        </div>
        ${config.icon ? `<div class="g-dash-kpi__icon">${config.icon}</div>` : ''}
      `;
    }

    _renderTableComponent(container, config) {
      const data = config.data || [];
      const columns = config.columns || (data.length ? Object.keys(data[0]) : []);

      let html = '<div class="g-dash-table-wrap"><table class="g-dash-table"><thead><tr>';
      columns.forEach((c) => {
        const name = typeof c === 'string' ? c : c.title || c.field;
        html += `<th>${name}</th>`;
      });
      html += '</tr></thead><tbody>';

      data.forEach((row) => {
        html += '<tr>';
        columns.forEach((c) => {
          const field = typeof c === 'string' ? c : c.field;
          const val = row[field] !== undefined ? row[field] : '';
          html += `<td>${val}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      container.innerHTML = html;
    }

    _renderFilterComponent(container, config) {
      container.classList.add('g-dash-filter');
      const field = config.field || 'filter';
      const options = config.options || [];

      const select = document.createElement('select');
      select.className = 'g-dash-select';
      select.innerHTML = `<option value="">— ${config.placeholder || 'Todos'} —</option>` +
        options.map((o) => {
          const val = typeof o === 'object' ? o.value : o;
          const label = typeof o === 'object' ? o.label : o;
          return `<option value="${val}">${label}</option>`;
        }).join('');

      select.addEventListener('change', (e) => {
        const val = e.target.value;
        this.bus.emit(`filter:${field}`, { field, value: val });
        if (typeof config.onChange === 'function') config.onChange(val, this);
      });

      container.appendChild(select);
    }

    getWidget(id) {
      return this._widgets.get(id);
    }

    getMap(id) {
      return this._maps.get(id);
    }

    on(event, fn) {
      return this.bus.on(event, fn);
    }

    emit(event, payload) {
      this.bus.emit(event, payload);
    }

    destroy() {
      this._widgets.forEach((w) => w.destroy());
      this._widgets.clear();
      this.bus.clear();
      if (this._containerEl) {
        this._containerEl.innerHTML = '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. Plugin de Mapa para Gráficas / Dashboard (miPlugin_dashboard)
  // -------------------------------------------------------------------------
  class miPlugin_dashboard {
    constructor(options = {}) {
      this.name = 'miPlugin_dashboard';
      this.options = options;
      this.position = options.position || 'TL';
      this.collapsible = options.collapsible !== false;
      this.order = options.order != null ? options.order : 2;
      this.tooltip = options.tooltip || 'Cuadro de mandos';
      this._panel = null;
      this._dashboard = null;
      this._chartWidgets = [];
    }

    addTo(map) {
      const api = resolverAPI();
      if (!api.ui || typeof api.ui.Panel !== 'function') return;

      const panel = new api.ui.Panel('toolsExtra_dashboard', {
        title: this.options.title || 'Cuadro de Mandos',
        className: 'g-herramienta_dashboard g-panel-lateral',
        position: api.ui && api.ui.position ? api.ui.position[this.position] || this.position : this.position,
        collapsible: this.collapsible,
        collapsed: this.options.collapsed !== false
      });

      this._panel = panel;
      map.addPanel(panel);

      const panelEl = panel.getElement ? panel.getElement() : document.querySelector('.m-panel.g-herramienta_dashboard');
      if (panelEl && this.order != null) {
        panelEl.style.order = String(this.order);
      }

      const body = document.createElement('div');
      body.className = 'g-herramienta_dashboard-body';
      if (panelEl) {
        const controls = panelEl.querySelector('.m-panel-controls') || panelEl;
        controls.appendChild(body);
      }

      // Si se especifican widgets o componentes en el panel
      if (this.options.charts || this.options.components) {
        const container = document.createElement('div');
        container.className = 'g-dashboard-panel-content';
        body.appendChild(container);

        const items = this.options.charts || this.options.components || [];
        items.forEach((itemOpts) => {
          const w = new ChartWidget(itemOpts);
          const wDiv = document.createElement('div');
          wDiv.style.marginBottom = '16px';
          container.appendChild(wDiv);
          w.mount(wDiv);
          this._chartWidgets.push(w);
        });
      }
    }

    getState() {
      const isOpened = this._panel && this._panel.getElement
        ? this._panel.getElement().classList.contains('opened')
        : false;
      return {
        opened: isOpened,
        activeTab: this._dashboard ? this._dashboard.activeTabId : null
      };
    }

    setState(state) {
      if (!state || !this._panel) return;
      if (state.opened && typeof this._panel.open === 'function') {
        this._panel.open();
      }
    }

    destroy() {
      this._chartWidgets.forEach((w) => w.destroy());
      this._chartWidgets = [];
    }
  }

  // -------------------------------------------------------------------------
  // 7. Exposición global triple
  // -------------------------------------------------------------------------
  Dashboard.Chart = ChartWidget;
  Dashboard.ChartWidget = ChartWidget;
  Dashboard.LibreriasGraficos = LibreriasGraficos;

  if (typeof window !== 'undefined') {
    window.Dashboard = Dashboard;
    window.ChartWidget = ChartWidget;
    window.miPlugin_dashboard = miPlugin_dashboard;

    window.IDEE = window.IDEE || {};
    window.IDEE.Dashboard = Dashboard;
    window.IDEE.widget = window.IDEE.widget || {};
    window.IDEE.widget.Chart = ChartWidget;
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_dashboard = miPlugin_dashboard;

    window.M = window.M || {};
    window.M.Dashboard = Dashboard;
    window.M.widget = window.M.widget || {};
    window.M.widget.Chart = ChartWidget;
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_dashboard = miPlugin_dashboard;
  }
})();
