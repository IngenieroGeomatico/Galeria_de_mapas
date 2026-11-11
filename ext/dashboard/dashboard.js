/**
 * ext/dashboard/dashboard.js
 * Extensión de Cuadros de Mandos (Dashboards) para API-IDEE / API-CNIG.
 *
 * Expone `IDEE.dashboard` / `IDEE.Dashboard` (y alias en `M` y `window`).
 *
 * Orquesta cuadros de mandos interactivos compuestos por:
 *  - Cabecera opcional con título, subtítulo, logo, acciones y filtros globales.
 *  - Sistema de pestañas (tabs) navegables o vista única.
 *  - Layout flexible por cuadrícula responsive (Grid / Flex).
 *  - Componentes conectados entre sí (Visualizadores API-IDEE, Gráficas IDEE.graphic, KPIs, Tablas, Filtros).
 *  - Bus de eventos para comunicación reactiva entre componentes.
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
  // 2. Clase Dashboard (IDEE.dashboard / IDEE.Dashboard)
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
        if (typeof document !== 'undefined') {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.mount());
          } else {
            setTimeout(() => this.mount(), 0);
          }
        }
      }
    }

    mount(target) {
      const container = typeof target === 'string'
        ? document.getElementById(target)
        : target || document.getElementById(this.containerId);

      if (!container) {
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
      } else if (type === 'chart' || type === 'graphic') {
        const GraphicClass = (typeof window !== 'undefined' && (window.IDEE?.graphic || window.Graphic)) || null;
        if (GraphicClass) {
          const g = new GraphicClass(Object.assign({}, config, {
            onSelect: (item, idx) => {
              if (config.onSelect) config.onSelect(item, idx, this);
              this.bus.emit(`select:${config.id}`, item);
            }
          }));
          g.mount(body);
          this._widgets.set(config.id, g);
        } else {
          body.innerHTML = '<div class="g-dash-empty">IDEE.graphic no disponible</div>';
        }
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
        container.innerHTML = '<div class="g-dash-empty">API-IDEE no disponible para inicializar visualizador</div>';
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
      const trend = config.trend || null;

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
      this._widgets.forEach((w) => {
        if (w && typeof w.destroy === 'function') w.destroy();
      });
      this._widgets.clear();
      this.bus.clear();
      if (this._containerEl) {
        this._containerEl.innerHTML = '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Exposición global triple
  // -------------------------------------------------------------------------
  if (typeof window !== 'undefined') {
    window.Dashboard = Dashboard;

    window.IDEE = window.IDEE || {};
    window.IDEE.dashboard = Dashboard;
    window.IDEE.Dashboard = Dashboard;

    window.M = window.M || {};
    window.M.dashboard = Dashboard;
    window.M.Dashboard = Dashboard;
  }
})();
