// Plugin Modal local para API-IDEE compatible con OpenLayers (2D) y Cesium (3D).
// Sigue el patrón "miPlugin_*" del repositorio: clase con constructor + getHelp + addTo.
//
// ¿Por qué una versión local del plugin Modal de la CDN?
// En este visualizador, al alternar entre la vista 2D y 3D (mediante cambioImpl),
// se reemplaza dinámicamente el script de la API-IDEE (ol.min.js <-> cesium.min.js),
// lo que reinicializa window.IDEE y elimina los registros previos en IDEE.plugin.Modal.
// La instanciación directa (new miPlugin_modal({...})) combinada con la resolución
// dinámica de api_modal() permite que el plugin sobreviva y funcione de manera idéntica
// tanto en 2D como en 3D sin depender de la CDN de componentes.idee.es.

/**
 * Resuelve el objeto global de la API activa (IDEE o M) comprobando que
 * disponga de las propiedades funcionales necesarias (.ui y .map).
 * @returns {Object} Objeto API-IDEE / API-Core activo
 */
function api_modal() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

// Plantillas HTML por defecto (inglés y español) usadas si no se especifica
// una URL remota o si falla la petición de red.
const DEFAULT_MODAL_TEMPLATE_EN = `<!-- Start Popup Content -->
<div id="popup-box">
    <div class="popup-section">
        <h3>Visualizer made with the API-IDEE</h3>
        <p><a href="https://plataforma.idee.es/cnig-api">https://plataforma.idee.es/cnig-api</a></p>
        <p class="popup-title">API-IDEE</p>
        <p>API CNIG is a tool that allows you to integrate a map viewer in a very simple way interactive on any web page
            and configure it by consuming WMC files, WMS services, WFS services, KML files etc In addition, it provides
            the ability to add a large number of tools and controls.</p>
    </div>
    <div class="popup-section">
        <p class="popup-title">API-IDEE Code</p>
        <p>Link to the repository: <a href="https://github.com/Desarrollos-IDEE/API-IDEE">https://github.com/Desarrollos-IDEE/API-IDEE</a></p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Plugin Gallery</p>
        <p>Link to plugin gallery: <a href="http://componentes.idee.es/api-idee/test.html">http://componentes.idee.es/api-idee/test.html</a>
        </p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Wiki API-IDEE</p>
        <p>Link to the API-IDEE Wiki: <a href="https://github.com/Desarrollos-IDEE/API-IDEE/wiki">https://github.com/Desarrollos-IDEE/API-IDEE/wiki</a></p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Gallery of API-IDEE examples</p>
        <p>Link to sample gallery: <a href="https://plataforma.idee.es/resources/GaleriaEjemplos_APICNIG/">https://plataforma.idee.es/resources/GaleriaEjemplos_APICNIG/</a>
        </p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Training Resources</p>
        <p>Link to training resources: <a href="https://plataforma.idee.es/cnig-api">https://plataforma.idee.es/cnig-api</a></p>
    </div>
</div>
<!-- End Popup Content -->`;

const DEFAULT_MODAL_TEMPLATE_ES = `<!-- Start Popup Content -->
<div id="popup-box">
    <div class="popup-section">
        <h3>Visualizador realizado con la API-IDEE</h3>
        <p><a href="https://plataforma.idee.es/cnig-api">https://plataforma.idee.es/cnig-api</a></p>
        <p class="popup-title">API-IDEE</p>
        <p>API CNIG es una herramienta que permite integrar de una forma muy sencilla un visualizador de mapas
            interactivo en cualquier página web y configurarlo consumiendo ficheros WMC, servicios WMS, servicios WFS,
            ficheros KML, etc. Además, provee la capacidad de añadir una gran cantidad de herramientas y controles.</p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Código API-IDEE</p>
        <p>Enlace al repositorio: <a href="https://github.com/Desarrollos-IDEE/API-IDEE">https://github.com/Desarrollos-IDEE/API-IDEE</a></p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Galería de plugins</p>
        <p>Enlace a la galería de plugins: <a href="http://componentes.idee.es/api-idee/test.html">http://componentes.idee.es/api-idee/test.html</a></p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Wiki API-IDEE</p>
        <p>Enlace a la Wiki de API-IDEE: <a href="https://github.com/Desarrollos-IDEE/API-IDEE/wiki">https://github.com/Desarrollos-IDEE/API-IDEE/wiki</a></p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Galería de ejemplos API-IDEE</p>
        <p>Enlace a la galería de ejemplos: <a href="https://plataforma.idee.es/resources/GaleriaEjemplos_APICNIG/">https://plataforma.idee.es/resources/GaleriaEjemplos_APICNIG/</a></p>
    </div>
    <div class="popup-section">
        <p class="popup-title">Recursos Formativos</p>
        <p>Enlace a los recursos formativos: <a href="https://plataforma.idee.es/cnig-api">https://plataforma.idee.es/cnig-api</a></p>
    </div>
</div>
<!-- End Popup Content -->`;

/**
 * Clase principal del plugin local Modal.
 */
class miPlugin_modal {
  /**
   * Constructor con opciones idénticas a las del plugin oficial IDEE.plugin.Modal.
   * @param {Object} options Configuración del modal
   * @param {string} [options.position='TR'] Posición del panel ('TL','TR','BL','BR')
   * @param {boolean} [options.collapsed=true] Estado inicial colapsado
   * @param {boolean} [options.collapsible=true] Permite colapsar el panel
   * @param {Object} [options.helpLink] URLs por idioma, ej: { es: '...', en: '...' }
   * @param {string} [options.url_es] URL alternativa en español
   * @param {string} [options.url_en] URL alternativa en inglés
   * @param {string} [options.tooltip='Más información'] Tooltip del botón
   * @param {number} [options.order] Posición/orden dentro del área de botones
   */
  constructor(options = {}) {
    this.name = 'miPlugin_modal';
    this.options = options || {};

    this.position_ = options.position || 'TR';
    this.collapsed_ = (options.collapsed !== undefined) ? options.collapsed : true;
    this.collapsible_ = (options.collapsible !== undefined) ? options.collapsible : true;
    this.tooltip_ = options.tooltip || 'Más información';
    this.order = (options.order !== undefined && options.order >= -1) ? options.order : null;

    // Contenido inline opcional (prioritario frente a remote.get): permite que el
    // popup funcione incluso abriendo el visualizador con file://, donde el
    // navegador bloquea XHR/fetch a ficheros locales por CORS (origin null).
    this.content_ = options.content || null;                 // HTML string directo
    this.contentSelector_ = options.contentSelector || null; // selector de un <template> en la página

    // Resolución de la URL del contenido según idioma
    const IDEE = api_modal();
    const lang = (IDEE && IDEE.language && typeof IDEE.language.getLang === 'function')
      ? IDEE.language.getLang()
      : 'es';

    if (options.helpLink && Object.keys(options.helpLink).length > 0) {
      this.url_ = options.helpLink[lang] || options.helpLink.es || options.helpLink.en;
    } else if (lang === 'en') {
      this.url_ = options.url_en || 'template_en';
    } else {
      this.url_ = options.url_es || 'template_es';
    }

    this.controls_ = [];
    this.control_ = null;
    this.control = null;
    this.panel_ = null;
    this.panel = null;
    this.map_ = null;
    this.map = null;
  }

  /**
   * Proporciona la ayuda para el gestor de ayuda de la API-IDEE.
   * @returns {Object} Objeto con título y promesa de contenido
   */
  getHelp() {
    const IDEE = api_modal();
    return {
      title: 'Modal',
      content: new Promise((resolve) => {
        let html = '<div><p>La extensión modal abre una ventana dentro del visualizador mostrando información relevante.</p></div>';
        if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
          html = IDEE.utils.stringToHtml(html);
        }
        resolve(html);
      }),
    };
  }

  /**
   * Método de enganche al mapa invocado por mapajs.addPlugin().
   * @param {Object} map Instancia del mapa (IDEE.Map / M.Map)
   */
  addTo(map) {
    const IDEE = api_modal();
    const url_ = this.url_;
    const content_ = this.content_;
    const contentSelector_ = this.contentSelector_;

    // Crear el control contenedor del modal
    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlModal');
    control.url_ = url_;
    control.content_ = content_;
    control.contentSelector_ = contentSelector_;

    // Sobrescribir createView: maneja retorno directo de nodo DOM o Promesa (asíncrono)
    control.createView = function(mapInstance) {
      // Registrar el listener de Escape una única vez a nivel global para no duplicar al alternar 2D/3D
      if (!window.__miPluginModalEscapeBound) {
        window.__miPluginModalEscapeBound = true;
        document.addEventListener('keydown', function(evt) {
          if (evt.key === 'Escape' || evt.key === 'Esc') {
            const openedPanel = document.querySelector('.m-panel.m-panel-modal.opened');
            if (openedPanel) {
              const closeBtn = openedPanel.querySelector('button.m-panel-btn');
              if (closeBtn) closeBtn.click();
            }
          }
        });
      }

      // Helper para envolver cualquier fragmento HTML en el contenedor del modal
      const buildDiv = function(html) {
        const d = document.createElement('div');
        d.classList.add('m-control', 'm-container', 'm-modal');
        d.innerHTML = html;
        return d;
      };

      const lang = (IDEE && IDEE.language && typeof IDEE.language.getLang === 'function')
        ? IDEE.language.getLang()
        : 'es';

      // 1. Contenido inline directo (string)
      const inlineContent = (this.content_ !== undefined && this.content_ !== null)
        ? this.content_
        : content_;
      if (typeof inlineContent === 'string' && inlineContent.length > 0) {
        return buildDiv(inlineContent);
      }

      // 2. Selector de un <template> presente en el DOM
      const selector = this.contentSelector_ || contentSelector_;
      if (selector) {
        const tpl = document.querySelector(selector);
        if (tpl) {
          return buildDiv(tpl.innerHTML);
        }
      }

      const currentUrl = this.url_ || url_;

      // 3. Plantillas por defecto
      if (currentUrl === 'template_es' || currentUrl === 'template_en') {
        return buildDiv(lang === 'en' || currentUrl === 'template_en' ? DEFAULT_MODAL_TEMPLATE_EN : DEFAULT_MODAL_TEMPLATE_ES);
      }

      // 4. Bajo protocolo file:// sin contenido inline: evitar bloqueo CORS por XHR/fetch
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
        console.warn('miPlugin_modal: protocolo file:// sin contenido inline: se usa la plantilla por defecto', currentUrl);
        return buildDiv(lang === 'en' ? DEFAULT_MODAL_TEMPLATE_EN : DEFAULT_MODAL_TEMPLATE_ES);
      }

      // 5. Entorno http / https: petición remota con fallback síncrono y asíncrono
      try {
        return IDEE.remote.get(currentUrl).then(function(response) {
          const text = (response && response.text) ? response.text : '';
          const i = text.indexOf('<!-- Start Popup Content -->');
          const j = text.lastIndexOf('<!-- End Popup Content -->');
          let content = '';
          if (i !== -1 && j > i) {
            content = text.substring(i, j);
          } else {
            content = text.trim();
          }
          return buildDiv(content);
        }).catch(function(err) {
          console.warn('miPlugin_modal: error al obtener contenido remoto de ' + currentUrl + ', usando plantilla por defecto', err);
          return buildDiv(lang === 'en' ? DEFAULT_MODAL_TEMPLATE_EN : DEFAULT_MODAL_TEMPLATE_ES);
        });
      } catch (err) {
        // remote.get puede lanzar de forma síncrona (ej. XHR bloqueado): no romper el popup
        console.warn('miPlugin_modal: error síncrono en remote.get, usando plantilla por defecto', err);
        return buildDiv(lang === 'en' ? DEFAULT_MODAL_TEMPLATE_EN : DEFAULT_MODAL_TEMPLATE_ES);
      }
    };

    control.equals = function(other) {
      return other instanceof IDEE.Control || other === this;
    };

    // Crear el panel modal y asociar el control
    const panel = new IDEE.ui.Panel('Modal', {
      className: 'm-panel-modal',
      collapsible: this.collapsible_,
      collapsed: this.collapsed_,
      collapsedButtonClass: 'icon-help',
      position: IDEE.ui.position[this.position_],
      tooltip: this.tooltip_,
      order: this.order
    });

    panel.addControls([control]);
    map.addPanels(panel);

    this.controls_ = [control];
    this.control = control;
    this.control_ = control;
    this.panel = panel;
    this.panel_ = panel;
    this.map = map;
    this.map_ = map;
  }

  /**
   * Limpia controles y referencias asociadas al mapa.
   */
  destroy() {
    if (this.map_ && this.control_) {
      try {
        this.map_.removeControls([this.control_]);
      } catch (e) {
        // Ignorar si el mapa o control ya fueron removidos
      }
    }
    this.map = null;
    this.map_ = null;
    this.control = null;
    this.control_ = null;
    this.panel = null;
    this.panel_ = null;
  }
}

// Exponer la clase en el namespace IDEE.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_modal = miPlugin_modal;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_modal = miPlugin_modal;
}
