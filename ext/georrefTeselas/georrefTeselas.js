// Plugin Georreferenciador de teselas para API-IDEE.
// Sigue el protocolo de ext_backgorundLayers.js: clase con constructor + getHelp
// + addTo(map) que crea el panel con IDEE.ui.Panel + IDEE.Control + map.addPanels.
// Se instancia con mapajs.addPlugin(new miPlugin_georrefTeselas()).
//
// El objeto global de la API puede llamarse IDEE (builds api-idee) o M (builds
// api-core). Elegimos el que tenga la API REALMENTE cargada (con .ui/.map): el
// bloque de exposición de este mismo archivo crea un window.IDEE vacío como
// namespace de plugins, así que no basta con comprobar que IDEE exista.
function api_georrefTeselas() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

const valueOri_georrefTeselas = "-- Seleccione un tipo de malla --";

/**
 * Propiedad con la que se marcan TODAS las partes de una misma tesela.
 *
 * Una tesela grande son en realidad N franjas de relleno + 1 contorno + 1 punto
 * de etiqueta (ver trocearParaCesium), y la tabla de atributos del selector de
 * capas pintaba una fila por cada una (p. ej. 8 filas por una sola tesela). Con
 * esta clave la tabla sabe que todas esas features son un unico elemento y las
 * muestra en una sola fila.
 *
 * El prefijo "_" marca la propiedad como metadato de la propia capa (no es un
 * atributo del dato): el selector la usa para agrupar y la oculta como columna.
 */
const CLAVE_GRUPO_TESELA = '_grupo';


/**
 * Recorta los extremos de un polígono para que no toque los limites del mundo.
 *
 * AQUI NO SE TROCEA: solo se recorta y se devuelve una sola feature. El troceo en
 * franjas de las teselas grandes (zoom 0-1) lo hace despues trocearParaCesium,
 * controlando etiqueta y contorno para que siga pareciendo una unica tesela.
 *
 * LA REGLA: un valor que toque el limite del mundo (±180 en longitud, ±90 en
 * latitud) se lleva a ±179.99999 / ±89.99999, para que el anillo no caiga justo
 * sobre la linea internacional de cambio de fecha ni sobre los polos, donde el
 * motor 3D invierte el relleno o lo descarta. El otro fallo de esas teselas (los
 * arcos de 180°-360° que hacian saltar a Cesium con "Expected value to be greater
 * than or equal to 0.0125") lo corrige trocearParaCesium interpolando vertices.
 *
 * @param {Object} gjson Feature con un Polygon de 5 vertices.
 * @returns {Object} El Feature con los extremos recortados.
 */
function recortarExtremos(gjson) {
  const recorta = (v, tope) => Math.max(-tope, Math.min(tope, v));

  try {
    if (!gjson || !gjson.geometry || gjson.geometry.type !== 'Polygon') return gjson;
    const anillo = gjson.geometry.coordinates[0];
    if (!Array.isArray(anillo) || anillo.length < 4) return gjson;

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [anillo.map((pt) => [recorta(pt[0], 179.99999), recorta(pt[1], 89.99999)])],
      },
      properties: gjson.properties,
    };
  } catch (e) {
    return gjson;
  }
}

/**
 * Prepara una tesela para Cesium: si es grande (ancho > 90°, las de zoom 0-1)
 * la trocea en franjas verticales de <= 60° e interpola vertices intermedios
 * cada 5°. Las teselas pequenas se devuelven tal cual.
 *
 * POR QUE HAY QUE TROCEAR. Cesium no sabe pintar un poligono que abarca mas de
 * 90° de longitud: el relleno sale recortado, invertido (pinta el complemento,
 * "lo que justo no deberia ocupar") o directamente no sale. Medido con la build
 * apiidee-1.1.0.cesium: un rectangulo de 90° de ancho pinta exactamente igual
 * que uno de 358°, y el poligono global de la tesela 0/0/0 no pinta nada. Es la
 * limitacion conocida del "projection to tangent plane" (blog oficial de Cesium
 * "Large Polygons in CesiumJS" e issue CesiumGS/cesium#4871), y la
 * recomendacion oficial es partir el poligono en trozos de <= 90°. Aqui se
 * parte en franjas de <= 60° por margen de seguridad.
 *
 * La interpolacion de vertices cada 5° evita el otro fallo del motor: cuando
 * dos vertices estaban muy separados (p. ej. 180° o 360°), la granularidad de
 * arco calculada caia por debajo del minimo que admite Cesium (0.0125 rad) y
 * lanzaba "DeveloperError: Expected value to be greater than or equal to
 * 0.0125", parando el render. Con los bordes interpolados nunca hay arcos
 * largos.
 *
 * ETIQUETA Y CONTORNO SIN COSTURAS. Si se devolvieran N poligonos sueltos, la
 * API pondria una etiqueta por trozo y dibujaria el contorno alrededor de cada
 * franja (lineas internas visibles en la tesela). Por eso se devuelve una
 * FeatureCollection con tres tipos de geometria, y el estilo se aplica por
 * tipo (IDEE.style.Generic con polygon/line/point):
 *   - N Polygon: las franjas con SOLO relleno (sin stroke).
 *   - 1 LineString: el contorno exterior de la tesela (el borde naranja).
 *   - 1 Point en el centro de la tesela: la etiqueta (el centro de una franja
 *     no es el centro de la tesela; por eso la etiqueta va en un punto propio).
 *
 * @param {Object} gjson Feature con un Polygon ya recortado (recortarExtremos).
 * @returns {Object} Feature (tesela pequena) o FeatureCollection (tesela grande).
 */
function trocearParaCesium(gjson) {
  try {
    if (!gjson || !gjson.geometry || gjson.geometry.type !== 'Polygon') return gjson;
    const anillo = gjson.geometry.coordinates[0];
    if (!Array.isArray(anillo) || anillo.length < 4) return gjson;

    const lons = anillo.map(pt => pt[0]);
    const lats = anillo.map(pt => pt[1]);
    const oeste = Math.min.apply(null, lons);
    const este = Math.max.apply(null, lons);
    const sur = Math.min.apply(null, lats);
    const norte = Math.max.apply(null, lats);
    const ancho = este - oeste;
    // Solo trocear cuando el ancho > 90° (zoom 0-1). Las pequenas no.
    if (ancho <= 90) return gjson;

    // Clave de agrupacion: la llevan TODAS las partes (franjas, contorno y
    // etiqueta) para que la tabla de atributos del selector de capas las
    // muestre como un unico elemento (ver CLAVE_GRUPO_TESELA). Se usa la
    // etiqueta de la tesela ("0/0/0") porque es estable y legible; todas las
    // partes de esta FeatureCollection comparten valor, y cada tesela vive en
    // su propia capa, asi que no puede colisionar con otra.
    const claveGrupo = (gjson.properties && gjson.properties.label)
      ? String(gjson.properties.label) : 'tesela';
    // Copia propia de las propiedades para cada parte (no compartir el mismo
    // objeto entre features) mas la clave de agrupacion.
    const propiedadesParte = () => Object.assign({}, gjson.properties, { [CLAVE_GRUPO_TESELA]: claveGrupo });

    const MAX_ANCHO = 60; // franjas de <= 60°: Cesium falla a partir de 90°
    const paso = 5; // vertices intermedios cada 5°
    const n = Math.max(2, Math.ceil(ancho / MAX_ANCHO));

    // Interpola un borde [x1,y1] -> [x2,y2] con vertices cada `paso` grados.
    const interpolar = (x1, y1, x2, y2) => {
      const puntos = [];
      const dx = x2 - x1, dy = y2 - y1;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const pasos = Math.max(1, Math.round(dist / paso));
      for (let j = 0; j < pasos; j++) {
        const t = j / pasos;
        puntos.push([+(x1 + dx * t).toFixed(6), +(y1 + dy * t).toFixed(6)]);
      }
      return puntos;
    };

    // Rectangulo exterior de la tesela: borde inferior, derecho, superior e
    // izquierdo con los vertices interpolados (sirve para las franjas y para
    // el contorno).
    const rectanguloInterpolado = () => {
      const pts = [];
      pts.push(...interpolar(oeste, sur, este, sur));
      pts.push(...interpolar(este, sur, este, norte));
      pts.push(...interpolar(este, norte, oeste, norte));
      pts.push(...interpolar(oeste, norte, oeste, sur));
      return pts;
    };

    // Franjas verticales de <= MAX_ANCHO: el relleno. El estilo `polygon` del
    // troceado no lleva stroke, asi que no salen lineas internas.
    const franjas = [];
    const dw = ancho / n;
    for (let k = 0; k < n; k++) {
      const w = +(oeste + k * dw).toFixed(6);
      const e = +(oeste + (k + 1) * dw).toFixed(6);
      const anilloFranja = [];
      anilloFranja.push(...interpolar(w, sur, e, sur));
      anilloFranja.push(...interpolar(e, sur, e, norte));
      anilloFranja.push(...interpolar(e, norte, w, norte));
      anilloFranja.push(...interpolar(w, norte, w, sur));
      anilloFranja.push(anilloFranja[0]); // cerrar el anillo (GeoJSON)
      franjas.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [anilloFranja] },
        properties: propiedadesParte(),
      });
    }

    // Contorno exterior (LineString): el borde naranja de la tesela.
    const contorno = rectanguloInterpolado();
    contorno.push(contorno[0]); // cerrar la linea

    return {
      type: 'FeatureCollection',
      features: [
        ...franjas,
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: contorno },
          // El contorno tambien lleva la clave de grupo (aunque no lleve la
          // etiqueta): sin ella la tabla lo contaria como un elemento aparte.
          properties: { [CLAVE_GRUPO_TESELA]: claveGrupo },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [+((oeste + este) / 2).toFixed(6), +((sur + norte) / 2).toFixed(6)],
          },
          // Esta feature lleva la propiedad `label`: el estilo `point` de la
          // tesela grande es el unico que pone etiqueta (en el centro).
          properties: propiedadesParte(),
        },
      ],
    };
  } catch (e) {
    return gjson;
  }
}

// ===================================================================
//  Carga bajo demanda de h3-js (solo para el modo H3)
//  --------------------------------------------------------------------
//  El georreferenciador de teselas solo necesita h3-js cuando se georreferencia
//  una tesela H3 (h3ToGeoJSON usa la global `h3`). En vez de cargar h3 por
//  <script> en el index.html, se inyecta bajo demanda desde aquí la primera vez
//  que se usa el modo H3. La carga se cachea en window.__georrefH3Promise para no
//  reinyectar. Se usa la build UMD (expone window.h3). TMS/XYZ no cargan nada.
// ===================================================================
const H3_CDN_URL_GT = "https://cdn.jsdelivr.net/npm/h3-js@4/dist/h3-js.umd.js";
function ensureH3_georrefTeselas() {
  if (typeof window.h3 !== "undefined") return Promise.resolve(window.h3);
  if (window.__georrefH3Promise) return window.__georrefH3Promise;
  window.__georrefH3Promise = new Promise(function (resolve, reject) {
    var existing = document.querySelector('script[data-lib="gt-h3"]');
    var script = existing || document.createElement("script");
    var onOk = function () {
      if (typeof window.h3 !== "undefined") resolve(window.h3);
      else reject(new Error("h3-js cargó pero no expuso window.h3"));
    };
    var onErr = function () { window.__georrefH3Promise = null; reject(new Error("No se pudo cargar h3-js")); };
    script.addEventListener("load", onOk);
    script.addEventListener("error", onErr);
    if (!existing) {
      script.src = H3_CDN_URL_GT;
      script.async = true;
      script.setAttribute("data-lib", "gt-h3");
      document.head.appendChild(script);
    }
  });
  return window.__georrefH3Promise;
}

class miPlugin_georrefTeselas {
  /**
   * @param {Object} [options]
   * @param {string} [options.position='TL'] Esquina de la API donde se coloca el
   *   panel (clave de `IDEE.ui.position`: TL, TR, BL, BR...).
   * @param {boolean} [options.collapsible=true] Si el panel se puede plegar.
   * @param {boolean} [options.collapsed] Si el panel nace plegado. Si no se
   *   indica, NO se le pasa la opción al panel y manda el default de la API
   *   (plegado, botón naranja), como layerSwitcher y baseLayer.
   * @param {string} [options.tooltip='Georreferenciar teselas'] Texto del tooltip del botón.
   * @param {string} [options.className] Clase ADICIONAL para el panel. La clase
   *   base `g-herramienta_georrefTeselas` se conserva siempre, porque es la que
   *   usan las reglas de georrefTeselas.css; esta opción sirve para afinar el
   *   estilo desde fuera sin romperlas.
   * @param {number} [options.order] Posición del panel dentro del área de botones
   *   (valor CSS `order`, no un índice; los paneles sin `order` valen 0).
   * @param {Object|string} [options.color1={active:'#ffffff',deactive:'orangered'}] Color de fondo ({ active, deactive } o string)
   * @param {Object|string} [options.color2={active:'#71A7D3',deactive:'#ffffff'}] Color de borde ({ active, deactive } o string)
   * @param {Object|string} [options.color3={active:'#71A7D3',deactive:'#ffffff'}] Color de icono/texto ({ active, deactive } o string)
   */
  constructor(options = {}) {
    this.name = 'miPlugin_georrefTeselas';
    this.options = options || {};
    // Opciones del panel, con el mismo nombre y los mismos valores por defecto que
    // usa miPlugin_estereoscopia, miPlugin_vueloFotogrametrico y miPlugin_storymap
    // (y el resto de plugins con panel), para que un visualizador pueda configurar
    // cualquiera de los dos igual. Antes iban escritas a fuego en addTo().
    this.position_ = options.position || 'TL';
    // `collapsed` NO tiene default propio a propósito: si el visualizador no lo
    // pide, la opción no se le pasa a IDEE.ui.Panel y manda el de la API, que es
    // plegado. Es lo que hacen miPlugin_layerSwitcher y miPlugin_baseLayer, y
    // importa más de lo que parece: el botón plegado se pinta con
    // `color1.deactive` (naranja) y el abierto con `color1.active` +
    // `color2.active` (azul #71A7D3 de la API). Forzar `collapsed: false` dejaba el
    // panel siempre abierto y por tanto azul, a diferencia del resto de plugins.
    this.collapsed_ = (options.collapsed !== undefined) ? options.collapsed : undefined;
    this.collapsible_ = (options.collapsible !== undefined) ? options.collapsible : true;
    this.tooltip_ = options.tooltip || 'Georreferenciar teselas';
    // Clase base del panel. Antes era `g-herramienta` a secas, que NO era única:
    // la comparten miPlugin_CalidadAireMadridTiempoReal y
    // miPlugin_FiltroCapasPuntosHistoricos. Se renombra con el sufijo del plugin
    // como el resto (g-herramienta_estereo, g-herramienta_vuelo,
    // g-herramienta_baseLayer, g-herramienta_selectorCapa), porque es la que
    // selectorizan las reglas de georrefTeselas.css y lo que da especificidad
    // suficiente para que el botón salga naranja en vez de azul. La opción
    // `className` se AÑADE, no sustituye.
    this.className_ = ['g-herramienta_georrefTeselas', options.className].filter(Boolean).join(' ');
    // Posición del panel dentro de la esquina elegida (área `.m-area`, que la
    // API monta como flex column). Es un valor CSS `order`, no un índice: lo
    // aplica la propia API haciendo style.order sobre el panel, así que no hay
    // que reordenar el DOM a mano.
    // Los paneles sin `order` valen 0, así que:
    //   order: -1  => por delante de todos (los negativos van antes que el 0);
    //   order: 0   => primera posición, empatada con los que no llevan order;
    //   order: 2   => detrás de los que van en 0;
    //   order: 99  => al final de la esquina;
    //   null       => sin valor explícito: donde lo deje la API.
    this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
      ? Number(options.order)
      : null;
    this.map = null;
    this._pendingState = null;
    // Referencia al panel IDEE (para preservar abierto/colapsado en el swap 2D/3D)
    this._panel = null;
    // Colores configurables. Cada uno puede ser un color (string) o un
    // objeto {active, deactive}:
    //   color1 = fondo, color2 = borde (botón+panel), color3 = icono/flecha.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
  }

  // Devuelve {active, deactive} a partir de un color simple o un objeto.
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
  }

  getHelp() {
    const IDEE = api_georrefTeselas();
    return {
      title: 'Georreferenciar teselas',
      content: new Promise((success) => {
        let html = '<div><p>Georreferencia teselas TMS, XYZ o H3 sobre el mapa a ' +
          'partir de sus índices.</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;
    const IDEE = api_georrefTeselas();

    const opcionesPanel = {
      className: this.className_,
      collapsible: this.collapsible_,
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position[this.position_],
      tooltip: this.tooltip_,
      // `order` lo aplica la propia API: IDEE.ui.Panel hace style.order sobre el
      // panel dentro del area (flex column). Es un valor CSS `order`, no un indice.
      order: this.order,
    };
    // `collapsed` solo se pasa si el visualizador lo ha pedido de verdad. Pasarlo
    // como `undefined` no es lo mismo que no pasarlo (la API comprueba
    // `options.collapsed !== undefined` en sitios), asi que se construye el objeto
    // sin esa propiedad. Asi manda el default de la API y el panel nace plegado,
    // con su boton en naranja, igual que layerSwitcher y baseLayer.
    if (this.collapsed_ !== undefined) opcionesPanel.collapsed = this.collapsed_;

    const panelExtra = new IDEE.ui.Panel('toolsExtra_georrefTeselas', opcionesPanel);

    const htmlPanel = `
      <div aria-label="Georreferenciar teselas" role="menuitem" id="div-contenedor-herramienta-georrefTeselas" class="m-control m-container m-herramienta">
          <header
              role="heading"
              tabindex="0"
              id="m-herramienta-title-georrefTeselas"
              class="m-herramienta-header">
                Georreferenciar Teselas
          </header>
          <section id="m-herramienta-previews-georrefTeselas" class="m-herramienta-previews"></section>
          <div id="m-herramienta-contents-georrefTeselas"></div>
      </div>
    `;

    const control = new IDEE.Control(new IDEE.impl.Control(), 'controlGeorrefTeselas');
    control.createView = () => document.createElement('div');
    // La API compara controles con equals() para retirarlos del panel
    // (IDEE.ui.Panel.removeControls) y del mapa. Sin este metodo, destroy() ->
    // map.removeControls() revienta con "e.equals is not a function" y el panel
    // se queda colgado en el mapa. Estricto a proposito: un equals laxo
    // ("other instanceof IDEE.Control") desregistraria tambien los controles de
    // los demas plugins al quitar este.
    control.equals = function (other) {
      return other === this;
    };

    panelExtra.addControls(control);
    map.addPanels(panelExtra);
    // Guardamos la referencia al panel IDEE para poder restablecer su estado
    // abierto/colapsado tras un cambio de implementación 2D<->3D. El control se
    // guarda aparte para que destroy() pueda soltarlo del mapa.
    this._panel = panelExtra;
    this._control = control;

    // Aplicar colores configurables (color1=fondo, color2=borde, color3=icono)
    // al panel. Se inyectan 6 variables CSS (estado normal y ".opened/active").
    const c1 = this.resolveColor(this.color1);
    const c2 = this.resolveColor(this.color2);
    const c3 = this.resolveColor(this.color3);
    const grEl = panelExtra.getElement ? panelExtra.getElement() : document.querySelector('.m-panel.g-herramienta_georrefTeselas');
    if (grEl) {
      grEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      grEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      grEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      grEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      grEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      grEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

    // El contenedor de controles del panel. Se busca DENTRO del panel que se acaba
    // de crear, no con un `document.querySelector` global: al cambiar de
    // implementacion el panel anterior sigue un momento en el DOM, y el selector
    // global se podia encontrar con el viejo e inyectar el contenido en el panel
    // que ya no manda. La clase base `g-herramienta_georrefTeselas` sigue siempre
    // presente (ver constructor), asi que la busqueda de reserva es equivalente.
    let panelControles = grEl ? grEl.querySelector('.m-panel-controls') : null;
    if (!panelControles) panelControles = document.querySelector('.g-herramienta_georrefTeselas .m-panel-controls');
    if (panelControles) panelControles.innerHTML = htmlPanel;
    // El id lo pone justo el HTML que se ha inyectado arriba, asi que se busca en
    // ese mismo contenedor.
    const contenido = panelControles ? panelControles.querySelector('#m-herramienta-contents-georrefTeselas') : null;
    if (contenido) contenido.appendChild(control.getElement());

    IDEE.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title-georrefTeselas');

    control.activate = () => { };
    control.deactivate = () => { };

    // Los estilos NO van en linea: todo se define en georrefTeselas.css. Con
    // `style="font-size: large"` en cada etiqueta el texto quedaba enorme y a
    // distinta escala del desplegable, y `style="width:auto"` hacia que los
    // inputs no ocuparan el panel. Las filas son etiqueta + input con clases,
    // para que el CSS las alinee en rejilla y los dos puntos de las etiquetas
    // queden en la misma columna.
    const htmlControl = `
        <h4 class="gr-seccion">Selector de malla</h4>
        <div id="selectorWrapperID" class="gr-campo">
        <select class="seleccionCapasClass" id="seleccionCapasID" name="seleccionCapas">
            <option value="TMS">TMS</option>
            <option value="XYZ">XYZ</option>
            <option value="H3">H3</option>
        </select>
         <h4 class="gr-seccion">Selección de tesela</h4>
         <div id="teselaWrapperID"></div>
        <div class="gr-acciones">
            <button id="botonCalcular" type="button">Georreferenciar</button>
        </div>
    `;

    // Poblado del contenido del panel.
    //
    // ANTES esto solo era el cuerpo del manejador de `evt.COMPLETED`, y en 3D el
    // panel se quedaba VACÍO: el contenedor quedaba con el `<div>` del control y
    // sin desplegable ni botón. La causa medida es que la build de Cesium no
    // dispara `evt.COMPLETED` en absoluto: registrando un listener de prueba nada
    // más cambiar a 3D, en 15 s no llegó ni una vez, mientras que el contenedor
    // (`#m-herramienta-contents-georrefTeselas`) YA existía nada más terminar este
    // addTo. Es decir, se esperaba un evento que en 3D no llega teniendo el
    // contenedor delante.
    //
    // Ahora se puebla en el acto y se vuelve a poblar con COMPLETED, que en 2D es
    // lo que llega. Poblarlo dos veces es inocuo: se reescribe el `innerHTML`, con
    // lo que los nodos viejos (y sus listeners) desaparecen, y se engancha a los
    // nuevos. La seleccion previa se lee antes de sobrescribir, asi que no se
    // pierde lo que el usuario hubiera elegido.
    const poblarControles = () => {
      // Guarda la selección actual antes de sobrescribir el HTML
      let selectedValue = "TMS";
      const selectorOld = document.getElementById('seleccionCapasID');
      if (selectorOld) {
        selectedValue = selectorOld.value;
      }
      if (this._pendingState && this._pendingState.gridType) {
        selectedValue = this._pendingState.gridType;
      }

      // El contenido se busca DENTRO del panel de ESTA instancia. Con un
      // `document.querySelector` global pasaba cualquier cosa: si el panel ya no
      // estaba (lo quitan al cambiar de implementación) reventaba con "Cannot set
      // properties of null", y si quedaban dos a la vez, rellenaba el que no
      // tocaba. `grEl` es el elemento del panel creado justo arriba en este mismo
      // addTo, asi que ya esta en alcance.
      const contenedor = (grEl ? grEl.querySelector('#m-herramienta-contents-georrefTeselas') : null)
        || document.querySelector('#m-herramienta-contents-georrefTeselas');
      if (!contenedor) return;
      contenedor.innerHTML = htmlControl;

      const selector = contenedor.querySelector('.seleccionCapasClass');
      const teselaWrapper = contenedor.querySelector('#teselaWrapperID');
      if (selector && teselaWrapper) {
        // Restaura la selección previa
        selector.value = selectedValue;

        selector.addEventListener('change', function (e) {
          // Cada fila es `etiqueta + input` y se alinea con el grid de
          // georrefTeselas.css. Antes era un `<label>` con `font-size: large` y
          // el input dentro, lo que dejaba los dos puntos desalineados
          // ("{z} :" frente a "{-y}:") y el input encogido.
          switch (e.target.value) {
            case 'TMS':
              teselaWrapper.innerHTML =
                '<div class="gr-fila"><span class="gr-etiqueta">{z}</span><input id="TMS_z" type="text" placeholder="valor z" aria-label="valor z de la tesela"></div>' +
                '<div class="gr-fila"><span class="gr-etiqueta">{x}</span><input id="TMS_x" type="text" placeholder="valor x" aria-label="valor x de la tesela"></div>' +
                '<div class="gr-fila"><span class="gr-etiqueta">{-y}</span><input id="TMS_y" type="text" placeholder="valor -y" aria-label="valor -y de la tesela"></div>';
              break;
            case 'XYZ':
              teselaWrapper.innerHTML =
                '<div class="gr-fila"><span class="gr-etiqueta">{z}</span><input id="XYZ_z" type="text" placeholder="valor z" aria-label="valor z de la tesela"></div>' +
                '<div class="gr-fila"><span class="gr-etiqueta">{x}</span><input id="XYZ_x" type="text" placeholder="valor x" aria-label="valor x de la tesela"></div>' +
                '<div class="gr-fila"><span class="gr-etiqueta">{y}</span><input id="XYZ_y" type="text" placeholder="valor y" aria-label="valor y de la tesela"></div>';
              break;
            case 'H3':
              teselaWrapper.innerHTML =
                '<div class="gr-fila"><span class="gr-etiqueta">H3</span><input id="H3_id" type="text" placeholder="ID de la tesela" aria-label="ID de la tesela H3"></div>';
              break;
            default:
              teselaWrapper.innerHTML = '';
          }
        });
        // Trigger para valor inicial (con la selección restaurada)
        selector.dispatchEvent(new Event('change'));

        if (this._pendingState) {
          this._applyState(this._pendingState);
          this._pendingState = null;
        }
      }

      const botonCalcular = contenedor.querySelector('#botonCalcular');
      if (botonCalcular) botonCalcular.addEventListener('click', () => this.myFunctionGetGrid());
    };

    // Primero, en el acto: es lo que arregla el 3D, donde COMPLETED no llega.
    poblarControles();
    // Y despues tambien con COMPLETED, que es lo que ocurre en 2D y repuebla por
    // si el panel todavia no estaba montado cuando se ha llamado lo de arriba.
    try { map.on(IDEE.evt.COMPLETED, poblarControles); } catch (e) { /* el mapa ya no esta */ }
  }

  async myFunctionGetGrid() {
    const map = this.map;
    const IDEE = api_georrefTeselas();
    let gjson;
    const gridType = document.getElementById("seleccionCapasID").value;
    switch (gridType) {
      case 'TMS': {
        const z = parseInt(document.getElementById("TMS_z").value);
        const x = parseInt(document.getElementById("TMS_x").value);
        const y = parseInt(document.getElementById("TMS_y").value);
        gjson = tmsTileToGeoJSON(z, x, y);
        break;
      }
      case 'XYZ': {
        const z = parseInt(document.getElementById("XYZ_z").value);
        const x = parseInt(document.getElementById("XYZ_x").value);
        const y = parseInt(document.getElementById("XYZ_y").value);
        gjson = xyzTileToGeoJSON(z, x, y);
        break;
      }
      case 'H3': {
        // h3-js se carga bajo demanda solo para el modo H3 (h3ToGeoJSON usa la
        // global `h3`). Si falla la red, avisa y aborta.
        try {
          await ensureH3_georrefTeselas();
        } catch (e) {
          IDEE.toast.error('No se pudo cargar la librería h3-js.', null, 3000);
          return;
        }
        const h3Index = document.getElementById("H3_id").value;
        gjson = h3ToGeoJSON(h3Index);
        break;
      }
      default:
        break;
    }

    // Antes se avisaba aqui de que las teselas grandes podian parar el render
    // 3D. Ya no hace falta: trocearParaCesium (aplicado al source mas abajo)
    // lo resuelve, asi que se intenta siempre y funciona en 2D y 3D.

    // recortarExtremos lleva los extremos a ±179.99999 / ±89.99999, y trocearParaCesium
    // trocea en franjas de <= 60° las teselas grandes (zoom 0-1), interpolando
    // vertices cada 5°. Las teselas grandes devuelven una FeatureCollection con
    // N poligonos (relleno), una LineString (contorno) y un Point (etiqueta);
    // las pequenas siguen siendo una sola feature con su etiqueta en el centro.
    const limiteRecortado = recortarExtremos(gjson);
    const preparado = trocearParaCesium(limiteRecortado);
    const esTeselaGrande = !!(preparado && preparado.type === 'FeatureCollection');

    // Con nombre propio (no el generico "layer_<n>") para que la capa
    // aparezca en el selector de capas (selectorCapas excluye las capas cuyo
    // nombre interno es layer_<n> por considerarlas auxiliares de Mapea).
    const nombreCapa = (gjson.properties && gjson.properties.label)
      ? ('Tesela ' + gjson.properties.label)
      : 'Tesela georreferenciada';

    const layer = new IDEE.layer.GeoJSON({
      name: nombreCapa,
      source: preparado,
      extract: true,
    });

    // Etiqueta comun: en las pequenas va sobre el poligono; en las grandes va
    // sobre el Point central de la FeatureCollection.
    const configEtiqueta = {
      // Texto etiqueta. fijo|función|atributo
      text: '{{label}}',
      scale: 5,
      color: 'white',
      align: IDEE.style.align.CENTER,
      baseline: IDEE.style.baseline.MIDDLE,
    };

    const estilo = esTeselaGrande
      ? new IDEE.style.Generic({
          polygon: {
            fill: { color: 'red', opacity: 0.2 },
            // Sin stroke a proposito: el contorno va en la LineString aparte,
            // para que las franjas no dibujen las lineas internas de union.
          },
          line: {
            stroke: { color: 'orange', width: 4 },
          },
          point: { label: configEtiqueta },
        })
      : new IDEE.style.Generic({
          polygon: {
            fill: { color: 'red', opacity: 0.2 },
            stroke: { color: 'orange', width: 4 },
            label: configEtiqueta,
          },
        });

    layer.setStyle(estilo);

    map.addLayers(layer);

    layer.on(IDEE.evt.LOAD, () => {
      map.setBbox(layer.getFeaturesExtent());
    });

    return;
  }

  // Destruccion. map.removePlugins() de la API la exige: sin este metodo lanza
  // "t.destroy is not a function" y aborta el resto del lote de plugins.
  // Suelta el control del mapa (la API se lleva el panel con el) y anula las
  // referencias. Los listeners del formulario viven dentro del HTML del panel,
  // asi que se van con el. No se toca el <script> de h3-js, que es una cache
  // global intencionada (window.__georrefH3Promise) compartida entre instancias.
  destroy() {
    try {
      if (this.map && this._control) this.map.removeControls([this._control]);
    } catch (e) { /* ignora si el mapa o el control ya no estan */ }
    this._control = null;
    this.map = null;
    this._panel = null;
    this._pendingState = null;
  }

  // ── Contrato de preservación de estado (cambioImpl OL <-> Cesium) ──
  getState() {
    try {
      const selector = document.getElementById('seleccionCapasID') || document.querySelector('.seleccionCapasClass');
      const gridType = selector ? selector.value : (this._pendingState && this._pendingState.gridType ? this._pendingState.gridType : 'TMS');
      const inputs = {};
      const ids = ['TMS_z', 'TMS_x', 'TMS_y', 'XYZ_z', 'XYZ_x', 'XYZ_y', 'H3_id'];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.value !== '') {
          inputs[id] = el.value;
        }
      });
      if (!Object.keys(inputs).length && this._pendingState && this._pendingState.inputs) {
        Object.assign(inputs, this._pendingState.inputs);
      }
      // Estado abierto/colapsado del panel (se conserva en el swap 2D/3D).
      let panelCollapsed = true;
      if (this._panel) {
        if (this._panel._collapsed !== undefined) {
          panelCollapsed = !!this._panel._collapsed;
        } else if (typeof this._panel.getElement === 'function') {
          const panelEl = this._panel.getElement();
          panelCollapsed = panelEl ? panelEl.classList.contains('collapsed') : true;
        }
      }
      return {
        gridType: gridType || 'TMS',
        inputs,
        panelCollapsed
      };
    } catch (e) {
      return null;
    }
  }

  _applyState(state) {
    if (!state || typeof state !== 'object') return false;
    const selector = document.getElementById('seleccionCapasID') || document.querySelector('.seleccionCapasClass');
    if (!selector) return false;

    if (state.gridType && selector.value !== state.gridType) {
      selector.value = state.gridType;
      selector.dispatchEvent(new Event('change'));
    }

    if (state.inputs && typeof state.inputs === 'object') {
      Object.keys(state.inputs).forEach((id) => {
        const inputEl = document.getElementById(id);
        if (inputEl && state.inputs[id] !== undefined) {
          inputEl.value = state.inputs[id];
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
    return true;
  }

  setState(state, map) {
    if (!state || typeof state !== 'object') return;

    // Estado del panel (abierto/colapsado) tras el reinicio del mapa (swap 2D/3D).
    if (state.panelCollapsed !== undefined && this._panel) {
      try {
        if (state.panelCollapsed && typeof this._panel.collapse === 'function') {
          this._panel.collapse();
        } else if (!state.panelCollapsed && typeof this._panel.open === 'function') {
          this._panel.open();
        }
      } catch (e) {
        console.warn('[miPlugin_georrefTeselas] Error al restaurar el estado del panel:', e);
      }
    }

    this._pendingState = state;
    this._applyState(state);
  }
}

// Exponer la clase en los namespaces IDEE.plugin y M.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_georrefTeselas = miPlugin_georrefTeselas;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_georrefTeselas = miPlugin_georrefTeselas;
  window.M = window.M || {};
  window.M.plugin = window.M.plugin || {};
  window.M.plugin.miPlugin_georrefTeselas = miPlugin_georrefTeselas;
}
