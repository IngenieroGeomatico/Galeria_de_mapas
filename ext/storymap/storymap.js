// Plugin StoryMap local para API-IDEE compatible con OpenLayers (2D) y Cesium (3D).
// Sigue el patrón "miPlugin_*" del repositorio: clase con constructor + getHelp + addTo.
//
// ¿Por qué una versión local del plugin StoryMap de la CDN?
// En este visualizador, al alternar entre la vista 2D y 3D (mediante cambioImpl),
// se reemplaza dinámicamente el script de la API-IDEE (ol.min.js <-> cesium.min.js),
// lo que reinicializa window.IDEE y elimina los registros previos en IDEE.plugin.StoryMap.
// La instanciación directa (new miPlugin_storymap({...})) combinada con la resolución
// dinámica de api_storymap() permite que el plugin sobreviva y funcione de manera idéntica
// tanto en 2D como en 3D sin depender de la CDN de componentes.idee.es.
//
// Contrato DOM (necesario para que el visualizador pueda redefinir control.capIndex):
//   - #contentStoryMap  : contenedor de capítulos
//   - .chapters (id capN): un div por capítulo (display block/none)
//   - .step (id stepN)   : un div por paso dentro de cada capítulo (display block/none)
// Los scripts de los pasos del JSON de contenido se inyectan en ámbito global, por lo
// que el visualizador debe exponer en window las variables que usen (p. ej. las capas).

/**
 * Resuelve el objeto global de la API activa (IDEE o M) comprobando que
 * disponga de las propiedades funcionales necesarias (.ui y .map).
 * @returns {Object} Objeto API-IDEE / API-Core activo
 */
function api_storymap() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

// Iconos SVG (tabler) usados en el panel
const STORYMAP_SVG_PLAY = '<svg id="play" height="23" width="23" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-player-play" viewBox="0 0 24 24" stroke-width="1.5" stroke="#65a3d4" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 4v16l13 -8z" /></svg>';
const STORYMAP_SVG_PAUSE = '<svg id="pause" style="display: none;" height="23" width="23" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-player-pause" viewBox="0 0 24 24" stroke-width="1.5" stroke="#65a3d4" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>';
const STORYMAP_SVG_ARROW = '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-arrow-big-down" viewBox="0 0 24 24" stroke-width="1.5" stroke="#71a7d3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M15 4v8h3.586a1 1 0 0 1 .707 1.707l-6.586 6.586a1 1 0 0 1 -1.414 0l-6.586 -6.586a1 1 0 0 1 .707 -1.707h3.586v-8a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1z" /></svg>';

/**
 * Clase principal del plugin local StoryMap.
 */
class miPlugin_storymap {
  /**
   * Constructor con opciones idénticas a las del plugin oficial IDEE.plugin.StoryMap.
   * @param {Object} options Configuración del storymap
   * @param {string} [options.position='TR'] Posición del panel ('TL','TR','BL','BR')
   * @param {boolean} [options.collapsed=false] Estado inicial colapsado
   * @param {boolean} [options.collapsible=true] Permite colapsar el panel
   * @param {string} [options.tooltip='Story Map'] Tooltip del botón
   * @param {Object} [options.content={}] Contenido por idioma { es: { cap: [...] } }
   * @param {number} [options.delay=2000] Retardo (ms) del autoplay
   * @param {Object} [options.indexInContent=false] Tarjeta de índice inicial { title, subtitle, js }
   * @param {boolean} [options.isDraggable=false] Permite arrastrar el panel
   * @param {number} [options.order] Posición/orden dentro del área de botones
   */
  constructor(options = {}) {
    this.name = 'miPlugin_storymap';
    this.options = options || {};

    this.position_ = options.position || 'TR';
    this.collapsed_ = (options.collapsed !== undefined) ? options.collapsed : false;
    this.collapsible_ = (options.collapsible !== undefined) ? options.collapsible : true;
    this.tooltip_ = options.tooltip || 'Story Map';
    this.content_ = options.content || {};
    this.delay = (options.delay !== undefined && options.delay !== null) ? options.delay : 2000;
    this.indexInContent = options.indexInContent || false;
    this.isDraggable_ = (options.isDraggable !== undefined) ? options.isDraggable : false;
    this.order = (options.order !== undefined && options.order >= -1) ? options.order : null;

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
    const IDEE = api_storymap();
    return {
      title: 'Story Map',
      content: new Promise((resolve) => {
        let html = '<div><p>Story Map muestra un relato guiado combinando texto y mapa, capítulo a capítulo.</p></div>';
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
    const IDEE = api_storymap();
    const lang = (IDEE && IDEE.language && typeof IDEE.language.getLang === 'function')
      ? IDEE.language.getLang()
      : 'es';

    // El contenido llega por idioma: { es: StoryMapJSON, en: ... }
    const content = this.content_[lang] || this.content_.es || { cap: [] };

    // Los scripts de los pasos del contenido usan window.mapjs (contrato con el
    // plugin oficial) y window.map.
    window.map = map;
    window.mapjs = map;

    const self = this;

    // Crear el control contenedor del storymap
    const control = new IDEE.Control(new IDEE.impl.Control(), 'StoryMapControl');
    control.content_ = content;
    control.delay = this.delay;
    control.indexInContent = this.indexInContent;
    control.isDraggable_ = this.isDraggable_;
    control.cap_ = null;
    control.allIntervalId = [];
    control.idTimeCap = 0;
    control.svgArrowScroll = true;
    control.arrowScrollEffect_contador = 1;
    control.panelHTML_ = null;

    /**
     * Crea el contenido: capítulos (capN) y pasos (stepN) a partir del JSON.
     * Si indexInContent está definido se antepone una tarjeta de índice (cap 0).
     * Se trabaja con una copia de this.content_.cap para no mutar el JSON original
     * (necesario al alternar 2D/3D: mapa() se vuelve a ejecutar con el mismo objeto).
     * @param {HTMLElement} allhtml Raíz del panel
     * @param {Object|boolean} indexInContent Tarjeta de índice o false
     * @returns {HTMLElement} Panel con el contenido inyectado
     */
    control.createContent = function(allhtml, indexInContent) {
      const contentHistory = allhtml.querySelector('#contentStoryMap');

      // Copia defensiva (shallow): evita acumular el índice en el JSON compartido
      const cap = this.content_.cap.slice();
      this.cap_ = cap;

      if (indexInContent) {
        const index = {
          title: indexInContent.title || '',
          subtitle: indexInContent.subtitle || '',
          steps: [{
            html: `${this.createIndex()}<br><br><br><br><br><br><br><br>`,
            js: indexInContent.js || '',
          }],
        };
        cap.unshift(index);
        this.cap_ = cap;
      }

      const title = allhtml.querySelector('#title_contentStoryMap');
      title.innerHTML = this.cap_[0].title || '';

      const subtitle = allhtml.querySelector('#subtitle_contentStoryMap');
      subtitle.innerHTML = this.cap_[0].subtitle || '';

      let contentHtml = '';

      this.cap_.forEach(({ steps }, i) => {
        contentHtml += `<div id=cap${i} style="display: ${(i === 0) ? 'block' : 'none'};" class="chapters">`;
        (steps || []).forEach(({ html }, j) => {
          const visible = (i === 0 && j === 0);
          contentHtml += `<div id="step${j}" class="step" style="display: ${visible ? 'block' : 'none'};">${html}</div>`;
        });
        contentHtml += '</div>';
      });
      contentHistory.innerHTML += contentHtml;

      // Primer punto de paso (índice 0 del capítulo inicial)
      allhtml.querySelector('#navStep').innerHTML = `<svg id="pointStep0" height="23" width="23" index="0">
        <circle class="pointerEffect" index="0" stroke="#71a7d3" stroke-width="1" fill="#71a7d3" cx="50%" cy="50%" r="4" />
      </svg>`;

      return allhtml;
    };

    /**
     * Cambia al capítulo indicado ocultando el actual.
     * @param {number|string} indexNextCap Capítulo de destino
     * @param {number|string} indexCap Capítulo actual
     * @param {boolean} positionStep true = primer paso, false = último paso
     */
    control.disableCap = function(indexNextCap, indexCap, positionStep) {
      const divElement = document.querySelector('#contentStoryMap');
      const caps = divElement.querySelectorAll('.chapters');
      const steps = caps[indexNextCap].querySelectorAll('.step');
      const target = Number(indexNextCap);

      caps[indexCap].style = 'display: none';
      caps[target].style = 'display: block';

      const step = (positionStep) ? steps[0] : steps[steps.length - 1];

      this.addJSCap(target, (positionStep) ? 0 : steps.length - 1);

      step.style = 'display: block';

      if (typeof step.scroll === 'function') {
        step.scroll({ top: 20, behavior: 'smooth' });
      } else {
        step.scrollTop = 20;
      }

      this.changeTitleSubtitle(target);
      return target;
    };

    /**
     * Muestra el paso indicado dentro de un capítulo, ocultando los demás.
     * @param {number|string} numberCap Capítulo
     * @param {number|string} activate Paso a mostrar
     */
    control.disableStep = function(numberCap, activate) {
      const cap = document.querySelector(`#cap${numberCap}`);
      cap.querySelectorAll('.step').forEach((step) => {
        step.style = 'display: none;';
      });

      const stepActive = cap.querySelector(`#step${activate}`);
      stepActive.style = 'display: block';

      if (typeof stepActive.scroll === 'function') {
        stepActive.scroll({ top: 20, behavior: 'smooth' });
      } else {
        stepActive.scrollTop = 20;
      }
    };

    /**
     * Actualiza el título y subtítulo del panel al capítulo indicado.
     * @param {number|string} indexNextCap Capítulo activo
     */
    control.changeTitleSubtitle = function(indexNextCap) {
      const cap = this.cap_[Number(indexNextCap)];
      const title = document.querySelector('#title_contentStoryMap');
      title.innerHTML = (cap && cap.title) || '';

      const subtitle = document.querySelector('#subtitle_contentStoryMap');
      subtitle.innerHTML = (cap && cap.subtitle) || '';
    };

    /**
     * Devuelve el índice del elemento visible (display:block) dentro de un
     * contenedor. Método sustituible desde el visualizador
     * (p. ej. mp_StoryMap.control.capIndex = function(...) {...}).
     * @param {string} idContainer Selector del contenedor (p. ej. '#contentStoryMap' o '#cap0')
     * @param {string} idElement Selector de los elementos ('.chapters' o '.step')
     * @returns {number|boolean} Índice del elemento visible o false
     */
    control.capIndex = function(idContainer, idElement) {
      const container = document.querySelector(idContainer);
      if (!container) return false;
      const divElement = container.querySelectorAll(idElement);
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const key in divElement) {
        if (divElement[key] && divElement[key].style && divElement[key].style.display === 'block' && !Number.isNaN(key)) {
          const id = divElement[key].id;
          return Number.parseInt(id.match(/\d+/)[0], 10);
        }
      }
      return false;
    };

    /**
     * Crea los puntos de navegación de capítulos en #navPointer.
     * @param {HTMLElement} html Raíz del panel
     * @param {number} capLength Número de capítulos
     * @returns {HTMLElement} Panel con la navegación de capítulos
     */
    control.createNavPointer = function(html, capLength) {
      const divElement = html.querySelector('#navPointer');

      for (let i = 0; i < capLength; i++) {
        if (i === 0) {
          divElement.innerHTML += `
            <svg id="pointerNav${i}" height="23" width="23" index="${i}">
              <circle class="pointerEffect" index="${i}" stroke="#71a7d3" stroke-width="1" fill="#71a7d3" cx="50%" cy="50%" r="4" />
            </svg>`;
        } else {
          divElement.innerHTML += `
            <svg id="pointerNav${i}" height="23" width="23" index="${i}">
              <circle index="${i}" stroke="#71a7d3" stroke-width="1" fill="#71a7d3" cx="50%" cy="50%" r="4" />
            </svg>`;
        }
      }

      const clickHandler = (target) => {
        this.resetScroll();
        this.disableCap(target.getAttribute('index'), this.capIndex('#contentStoryMap', '.chapters'), true);
        this.createPointerSteps(target.getAttribute('index'));
        this.effectPointer(target.getAttribute('index'), '#pointerNav', 'navPointer');
        this.effectPointer(0, '#pointStep', 'navStep');
      };

      const pointers = html.querySelectorAll('#navPointer > svg');
      pointers.forEach((pointer, i) => {
        if (i === 0 || i === 1) return; // los dos primeros svg son play y pause, se omiten
        if (pointer.addEventListener) {
          pointer.addEventListener('click', ({ target }) => clickHandler(target));
          const circle = pointer.querySelector('circle');
          if (circle) circle.addEventListener('click', ({ target }) => clickHandler(target));
        }
      });

      return html;
    };

    /**
     * Crea los puntos de navegación de pasos del capítulo actual en #navStep.
     * @param {number|string} indexCap Capítulo activo
     */
    control.createPointerSteps = function(indexCap) {
      const cap = this.cap_[Number(indexCap)];
      if (!cap) return;
      const steps = cap.steps || [];

      let stepsPoint = '';

      steps.forEach((s, i) => {
        if (i === 0) {
          stepsPoint += `<svg id="pointStep${i}" height="23" width="23" index="${i}">
            <circle class="pointerEffect" index="${i}" stroke="#71a7d3" stroke-width="1" fill="#71a7d3" cx="50%" cy="50%" r="4" />
          </svg>`;
        } else {
          stepsPoint += `<svg id="pointStep${i}" height="23" width="23" index="${i}">
            <circle index="${i}" stroke="#71a7d3" stroke-width="1" fill="#71a7d3" cx="50%" cy="50%" r="4" />
          </svg>`;
        }
      });

      const navStep = document.querySelector('#navStep');
      if (!navStep) return;
      navStep.innerHTML = stepsPoint;

      navStep.querySelectorAll('svg').forEach((elemt) => {
        const stepClick = ({ target }) => {
          this.disableStep(indexCap, target.getAttribute('index'));
          this.addJSCap(indexCap, target.getAttribute('index'));
          this.effectPointer(target.getAttribute('index'), '#pointStep', 'navStep');
        };
        elemt.addEventListener('click', stepClick);
        const circle = elemt.querySelector('circle');
        if (circle) circle.addEventListener('click', stepClick);
      });
    };

    /**
     * Botones reproducir/pausar (autoplay) del panel.
     * @param {HTMLElement} html Raíz del panel
     * @returns {HTMLElement} Panel con el autoplay configurado
     */
    control.createPlayPause = function(html) {
      const play = html.querySelector('#play');
      const pause = html.querySelector('#pause');
      this.idTimeCap = 0;
      this.allIntervalId = [];

      play.addEventListener('click', () => {
        play.style.display = 'none';
        pause.style.display = 'block';
        this.idTimeCap = this.timeCap();
        this.allIntervalId.push(this.idTimeCap);
      });

      pause.addEventListener('click', () => {
        pause.style.display = 'none';
        play.style.display = 'block';
        this.allIntervalId.forEach((id) => {
          clearInterval(id);
        });
      });

      return html;
    };

    /**
     * Oculta todos los pasos del storymap.
     */
    control.resetScroll = function() {
      document.querySelectorAll('.step').forEach((e) => {
        e.style = 'display: none';
      });
    };

    /**
     * Asocia a cada paso el evento de scroll que permite avanzar/retroceder
     * al llegar al final o principio del texto.
     * @param {HTMLElement} html Raíz del panel
     * @returns {HTMLElement} Panel con el scroll configurado
     */
    control.scrollEvent = function(html) {
      const navContent = html.querySelectorAll('.chapters');

      navContent.forEach((cap) => {
        cap.querySelectorAll('.step').forEach((step) => {
          step.addEventListener('scroll', ({ target }) => {
            if (this.svgArrowScroll) this.arrowScrollEffect();

            // ***** Delante *****
            // Evitar que ejecute esto cuando es el último capítulo y el último paso
            if (Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 5
              && !(navContent[navContent.length - 1].id === cap.id && `step${cap.childElementCount - 1}` === target.id)) {
              if (typeof target.scroll === 'function') {
                target.scroll({ top: 10, behavior: 'auto' });
              }
              target.style = 'display: none';
              const idStep = Number(step.id.replace('step', '')) + 1;

              if (cap.querySelectorAll('.step').length - 1 < idStep) {
                const idCap = Number(cap.id.replace('cap', '')) + 1;
                const nextCap = document.querySelector(`#cap${idCap}`);
                if (!nextCap) return;
                nextCap.style = 'display: block';
                const siguienteStep = nextCap.querySelector('#step0');
                if (siguienteStep) siguienteStep.style = 'display: block';

                document.querySelector(`#${cap.id}`).style = 'display: none';
                this.addJSCap(idCap, 0);
                this.effectPointer(idCap, '#pointerNav', 'navPointer');
                this.createPointerSteps(idCap);
                this.effectPointer(0, '#pointStep', 'navStep');
                this.changeTitleSubtitle(idCap);
              } else {
                const siguienteStep = document.querySelector(`#${cap.id}`).querySelector(`#step${idStep}`);
                if (!siguienteStep) return;
                const idCap = Number(cap.id.replace('cap', ''));
                siguienteStep.style = 'display: block';
                siguienteStep.scrollTop = 1;
                this.addJSCap(idCap, idStep);
                this.effectPointer(idStep, '#pointStep', 'navStep');
              }
              // ***** Atrás *****
            } else if (target.scrollTop === 0 && !(cap.id === 'cap0' && target.id === 'step0')) {
              const idStep = Number(step.id.replace('step', '')) - 1;
              if (typeof target.scroll === 'function') {
                target.scroll({ top: 10, behavior: 'auto' });
              }
              target.style = 'display: none';

              if (idStep < 0) {
                const idCap = Number(cap.id.replace('cap', '')) - 1;
                const capNext = document.querySelector(`#cap${idCap}`);
                if (!capNext) return;
                capNext.style = 'display: block';

                const siguienteStep = capNext.querySelector(`#step${capNext.childElementCount - 1}`);
                if (siguienteStep) {
                  siguienteStep.style = 'display: block';
                  siguienteStep.scrollTop = 10;
                }

                document.querySelector(`#${cap.id}`).style = 'display: none';
                this.addJSCap(idCap, capNext.childElementCount - 1);
                this.effectPointer(idCap, '#pointerNav', 'navPointer');
                this.createPointerSteps(idCap);
                this.changeTitleSubtitle(idCap);
                this.effectPointer(capNext.childElementCount - 1, '#pointStep', 'navStep');
              } else {
                const idCap = Number(cap.id.replace('cap', ''));
                const siguienteStep = document.querySelector(`#${cap.id}`).querySelector(`#step${idStep}`);
                if (!siguienteStep) return;
                siguienteStep.style = 'display: block';
                siguienteStep.scrollTop = 10;
                this.addJSCap(idCap, idStep);
                this.effectPointer(idStep, '#pointStep', 'navStep');
              }
            }
          });
        });
      });

      return html;
    };

    /**
     * Ejecuta el script del paso indicado. Los scripts se inyectan como un
     * <script> en ámbito global (igual que el plugin oficial); por eso el
     * visualizador debe exponer en window las variables a las que recurran
     * (p. ej. capas, mapjs).
     * @param {number|string} indexCap Capítulo
     * @param {number|string} indexStep Paso
     */
    control.addJSCap = function(indexCap, indexStep) {
      try {
        const oldScript = document.querySelector('#storyMap_jsCap');
        if (oldScript) document.body.removeChild(oldScript);

        const cap = this.cap_[Number(indexCap)];
        const step = cap && cap.steps[Number(indexStep)];
        const js = (step && step.js) || '';

        const newScript = document.createElement('script');
        newScript.id = 'storyMap_jsCap';
        const inlineScript = document.createTextNode(`{${js}}`);
        newScript.appendChild(inlineScript);
        document.body.appendChild(newScript);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('miPlugin_storymap: comprueba el script del paso, respetando ";" y llamando a map o mapjs', error);
      }
    };

    /**
     * Temporizador del autoplay: hace scroll al final del paso activo cada
     * (speed * 1000) ms hasta alcanzar el último paso del último capítulo.
     * @returns {number} Identificador del intervalo
     */
    control.timeCap = function() {
      const speedEl = document.querySelector('#buttonDelay');
      const speed = speedEl ? Number(speedEl.getAttribute('speed')) : (this.delay / 1000);
      const id = setInterval(() => {
        const idCap = this.capIndex('#contentStoryMap', '.chapters');
        const idStep = this.capIndex(`#cap${idCap}`, '.step');
        const div = document.querySelector(`#cap${idCap}`);
        if (!div) return;
        const step = div.querySelector(`#step${idStep}`);
        if (!step) return;
        const lenghtCap = this.cap_.length - 1;
        const lengthStep = this.cap_[this.cap_.length - 1].steps.length - 1;
        if (idCap !== lenghtCap || idStep !== lengthStep) {
          if (typeof step.scroll === 'function') {
            step.scroll({ top: step.scrollHeight + 10, behavior: 'smooth' });
          } else {
            step.scrollTop = step.scrollHeight + 10;
          }
        }
      }, speed * 1000);

      return id;
    };

    /**
     * Efecto de desvanecimiento de la flecha de scroll.
     */
    control.arrowScrollEffect = function() {
      setTimeout(() => {
        this.arrowScrollEffect_contador -= 0.1;
        const arrow = document.querySelector('.arrowScroll');
        if (arrow) {
          arrow.style = `opacity: ${this.arrowScrollEffect_contador}`;
        }
        if (this.arrowScrollEffect_contador >= 0) this.arrowScrollEffect();
      }, 150);

      this.svgArrowScroll = !this.svgArrowScroll;
    };

    /**
     * La flecha de scroll baja el primer paso al pasar el ratón por encima.
     * @param {HTMLElement} html Raíz del panel
     * @returns {HTMLElement} Panel con el evento de la flecha configurado
     */
    control.arrowEvent = function(html) {
      const arrow = html.querySelector('.arrowScroll');
      if (arrow) {
        arrow.addEventListener('mouseover', () => {
          const firstStep = document.querySelector('#cap0') && document.querySelector('#cap0').querySelector('#step0');
          if (firstStep && typeof firstStep.scroll === 'function') {
            firstStep.scroll({ top: 70, behavior: 'smooth' });
          }
        });
      }
      return html;
    };

    /**
     * Aplica el efecto visual "pointerEffect" al punto indicado.
     * @param {number|string} indexNext Índice del punto
     * @param {string} typeNapID Prefijo del id (p. ej. '#pointerNav' o '#pointStep')
     * @param {string} container Clase contenedora (p. ej. 'navPointer' o 'navStep')
     */
    control.effectPointer = function(indexNext, typeNapID, container) {
      const current = document.querySelector(`.${container} .pointerEffect`);
      if (current) current.classList.remove('pointerEffect');
      const next = document.querySelector(`${typeNapID}${indexNext} > circle`);
      if (next) next.classList.add('pointerEffect');
    };

    /**
     * Genera el índice de capítulos (ol#indexContent) para la tarjeta inicial.
     * @returns {string} HTML del índice
     */
    control.createIndex = function() {
      const cap = this.cap_ || [];

      let index = '';

      cap.forEach(({ title = '', subtitle = '' }, i) => {
        index += `<li index="${i + 1}">${title}. ${subtitle}</li>`;
      });

      index = `<ol id='indexContent'>${index}</ol>`;

      return index;
    };

    /**
     * Navegación clicable del índice de capítulos.
     * @param {HTMLElement} html Raíz del panel
     * @returns {HTMLElement} Panel con el índice configurado
     */
    control.eventIndex = function(html) {
      html.querySelectorAll('#indexContent > li').forEach((li) => {
        const liClick = ({ target }) => {
          this.resetScroll();
          this.disableCap(target.getAttribute('index'), this.capIndex('#contentStoryMap', '.chapters'), true);
          this.createPointerSteps(target.getAttribute('index'));
          this.effectPointer(target.getAttribute('index'), '#pointerNav', 'navPointer');
        };
        li.addEventListener('click', liClick);
      });
      return html;
    };

    /**
     * Botón de velocidad del autoplay (0.5x, 1x, 2x, 3x, 5x).
     * @param {HTMLElement} html Raíz del panel
     * @returns {HTMLElement} Panel con el botón de velocidad configurado
     */
    control.buttonDelay = function(html) {
      const speedOptions = [
        { text: '0.5x', value: 0.5 },
        { text: '1x', value: 1 },
        { text: '2x', value: 2 },
        { text: '3x', value: 3 },
        { text: '5x', value: 5 },
      ];
      let position = 1; // empieza en 1x (coherente con el HTML inicial '1x')

      const button = html.querySelector('#buttonDelay');

      button.addEventListener('click', ({ target }) => {
        this.allIntervalId.forEach((id) => {
          clearInterval(id);
        });

        position = (position >= speedOptions.length - 1) ? 0 : position + 1;
        const option = speedOptions[position];
        target.setAttribute('speed', (this.delay / 1000) / option.value);
        target.innerHTML = option.text;

        const play = html.querySelector('#play');
        const pause = html.querySelector('#pause');

        if (play) play.style.display = 'none';
        if (pause) pause.style.display = 'block';

        const id = setInterval(() => {
          const lastCap = document.querySelector(`#cap${this.cap_.length - 1}`);
          const displayLast = lastCap ? lastCap.lastChild.style.display : 'block';

          const idCap = this.capIndex('#contentStoryMap', '.chapters');
          const idStep = this.capIndex(`#cap${idCap}`, '.step');
          const div = document.querySelector(`#cap${idCap}`);
          if (!div) return;
          const step = div.querySelector(`#step${idStep}`);
          if (!step) return;
          const lenghtCap = this.cap_.length - 1;
          const lengthStep = this.cap_[this.cap_.length - 1].steps.length - 1;
          if (idCap !== lenghtCap || idStep !== lengthStep) {
            if (typeof step.scroll === 'function') {
              step.scroll({ top: step.scrollHeight + 10, behavior: 'smooth' });
            } else {
              step.scrollTop = step.scrollHeight + 10;
            }
          }

          if (displayLast === 'block') {
            if (play) play.style.display = 'block';
            if (pause) pause.style.display = 'none';
            clearInterval(id);
          }
        }, target.getAttribute('speed') * 1000);

        this.allIntervalId.push(id);
      });

      return html;
    };

    /**
     * En móvil, al abrir el storymap oculta el resto de paneles (y los
     * restaura al cerrarlo).
     */
    control.handleMovil = function() {
      if (document.querySelector('.m-plugin-storymap.opened')) {
        document.querySelectorAll('.m-panel').forEach((p) => {
          if (!p.classList.contains('m-plugin-storymap')) {
            p.style.display = 'none';
          }
        });
      } else {
        document.querySelectorAll('.m-panel').forEach((p) => {
          if (!p.classList.contains('m-plugin-storymap')) {
            p.style.display = 'block';
          }
        });
      }
    };

    /**
     * Limpia los temporizadores del autoplay.
     */
    control.clearTimers = function() {
      (this.allIntervalId || []).forEach((id) => {
        clearInterval(id);
      });
      this.allIntervalId = [];
    };

    /**
     * Crea la vista del panel: sobrescritura de IDEE.Control.createView.
     * Devuelve el nodo raíz del storymap con todo el contenido y los eventos.
     * @param {Object} mapInstance Instancia del mapa
     * @returns {HTMLElement} Nodo raíz del panel storymap
     */
    control.createView = function(mapInstance) {
      this.map_ = mapInstance;

      const html = document.createElement('div');
      html.id = 'm-storymap-container';
      html.className = 'm-control m-container m-storymap-container m-storymap';

      const speed = (this.delay / 1000);
      html.innerHTML =
        '<div class="m-storymap-panel" id="m-storymap-panel">' +
        '<header class="m-storymap-header" role="heading">' +
        '<span class="m-storymap-header-title">Story Map</span>' +
        '</header>' +
        '<main class="mainStoryMap">' +
        '<div class="navPointer" id="navPointer">' +
        `<button speed="${speed}" id="buttonDelay" class="buttonDelay" title="Velocidad de reproducción">1x</button>` +
        STORYMAP_SVG_PLAY + STORYMAP_SVG_PAUSE +
        '</div>' +
        '<div class="navStep" id="navStep"></div>' +
        '<div class="navContent">' +
        '<section id="contentStoryMap" class="contentStoryMap">' +
        '<header class="header_contentStoryMap">' +
        '<h2 id="title_contentStoryMap">title</h2>' +
        '<p id="subtitle_contentStoryMap">sub</p>' +
        '</header>' +
        '</section>' +
        '</div>' +
        `<div class="arrowScroll" title="Seguir leyendo">${STORYMAP_SVG_ARROW}</div>` +
        '</main>' +
        '</div>';

      this.createContent(html, this.indexInContent);
      this.scrollEvent(html);
      this.createNavPointer(html, this.cap_.length);
      this.buttonDelay(html);

      if (mapInstance && typeof mapInstance.on === 'function') {
        mapInstance.on('IDEE.evt.COMPLETED', () => {
          this.createPointerSteps(0);
        });
      }

      this.createPlayPause(html);
      this.arrowEvent(html);
      this.eventIndex(html);

      this.panelHTML_ = html;
      return html;
    };

    control.equals = function(other) {
      return other instanceof IDEE.Control || other === this;
    };

    // Crear el panel storymap y asociar el control
    const panel = new IDEE.ui.Panel('panelStoryMap', {
      className: 'm-plugin-storymap',
      collapsible: this.collapsible_,
      collapsed: this.collapsed_,
      collapsedButtonClass: 'icon-capas2',
      position: IDEE.ui.position[this.position_],
      tooltip: this.tooltip_,
      order: this.order
    });

    panel.addControls([control]);
    map.addPanels(panel);

    // Cabecera arrastrable (patrón opcional isDraggable)
    if (this.isDraggable_ && IDEE.utils && typeof IDEE.utils.draggabillyPlugin === 'function') {
      try {
        IDEE.utils.draggabillyPlugin(panel, '.m-plugin-storymap .m-storymap-header');
      } catch (err) {
        console.warn('miPlugin_storymap: no se pudo activar el arrastre del panel', err);
      }
    }

    // Gestión móvil: ocultar el resto de paneles cuando el storymap está abierto
    if (window.innerWidth <= 772) {
      control.handleMovil();
      const btn = document.querySelector('.m-plugin-storymap .m-panel-btn');
      if (btn) btn.addEventListener('click', control.handleMovil);
    }

    this.controls_ = [control];
    this.control = control;
    this.control_ = control;
    this.panel = panel;
    this.panel_ = panel;
    this.map = map;
    this.map_ = map;
  }

  /**
   * Limpia controles, temporizadores y referencias asociadas al mapa.
   */
  destroy() {
    if (this.control_ && typeof this.control_.clearTimers === 'function') {
      this.control_.clearTimers();
    }
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
  window.miPlugin_storymap = miPlugin_storymap;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_storymap = miPlugin_storymap;
  if (window.M) {
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_storymap = miPlugin_storymap;
  }
}