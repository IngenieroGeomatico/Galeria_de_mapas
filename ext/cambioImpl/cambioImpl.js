
/**
 * El engranaje: `img/iconos/gear-spinner.svg`, y NO una copia suya.
 *
 * Antes aqui iba el `path` del SVG reescrito a mano, en linea y con el `fill`
 * como `currentColor`. Es un error por partida doble: duplica el dibujo (que se
 * queda viejo en cuanto se toca el original) y hace que el engranaje de cambio y
 * el de arranque del visualizador no se parezcan, siendo el mismo dibujo.
 *
 * Ahora es el fichero, tal cual, con su `<animateTransform>` dentro: gira solo y
 * trae su color, sin tocar el CSS.
 *
 * LA RUTA SE RESUELVE DESDE EL PROPIO SCRIPT. `img/iconos/...` con ruta relativa
 * a la pagina solo funciona si cada visualizador la escribe bien, y desde un `.js`
 * una ruta relativa ni siquiera se sabe contra que se resuelve. Sacandola de
 * `document.currentScript.src` el plugin funciona igual en la raiz, en un
 * subdirectorio y en GitHub Pages, sin que nadie tenga que escribirla a mano.
 */
const URL_ENGRANAJE = (() => {
  try {
    const propio = (document.currentScript && document.currentScript.src) || '';
    return new URL('../../img/iconos/gear-spinner.svg', propio || location.href).href;
  } catch (e) {
    return '/img/iconos/gear-spinner.svg';
  }
})();

/**
 * Extensiones que amplian capas en la implementacion 3D.
 *
 * Antes de esto, cada visualizador tenia que acordarse de cargar su <script> en
 * el index.html. Ahora las carga el propio cambio de implementacion, que es
 * quien sabe cuando se pasa a Cesium y quien vuelve a levantar el mapa:
 *
 *   - `getWMC_cesium`: el contrato getWMC/addWMC/removeWMC del impl del Mapa.
 *     Tiene que estar puesto ANTES de que `mapa()` cree las capas base (una
 *     WMTS de base llama a `getMaxExtent()` -> `getWMC()`), asi que es un
 *     parche de arranque: se instala solo por sondeo.
 *   - `layergroup_cesium`: LayerGroup funcional en Cesium (capas hijas, orden
 *     z, ...). Tambien parche de arranque.
 *   - `geotiffLayer` y `MVTLayer`: fachada + impl de `IDEE.layer.GeoTIFF` y
 *     `IDEE.layer.MVT` para Cesium. Estos SI son plugins (miPlugin_...): se
 *     anaden al mapa nuevo despues de crearlo, si el visualizador no los ha
 *     anadido ya.
 *
 * `plugin` es el nombre con el que la extension se registra en `IDEE.plugin`;
 * las que no lo llevan no se anaden al mapa, se instalan solas al cargarse.
 */
const EXTENSIONES_CAPAS_3D = [
    { ruta: 'getWMC_cesium/getWMC_cesium.js' },
    { ruta: 'layergroup_cesium/layergroup_cesium.js' },
    { ruta: 'geotiffLayer/geotiffLayer.js', plugin: 'miPlugin_geotiffLayer' },
    { ruta: 'MVTLayer/MVTLayer.js', plugin: 'miPlugin_MVTLayer' }
];

// La base se resuelve desde este mismo fichero (ext/cambioImpl/), igual que
// URL_ENGRANAJE: asi funciona en la raiz, en un subdirectorio y en GitHub Pages.
const URL_BASE_EXTENSIONES_3D = (() => {
    try {
        const propio = (document.currentScript && document.currentScript.src) || '';
        return new URL('../../ext/', propio || location.href).href;
    } catch (e) {
        return '/ext/';
    }
})();

// Promesas de carga por URL: cada extension se pide una sola vez.
const CARGA_EXTENSIONES_3D = new Map();

/**
 * Carga (una sola vez) el <script> de una extension de capas 3D.
 *
 * Si el visualizador ya la trae en su index.html no se vuelve a cargar: el
 * parser la ha ejecutado antes que a este plugin, y una segunda ejecucion del
 * fichero duplicaria sus intervalos y registros.
 *
 * @param {string} url URL absoluta del fichero.
 * @returns {Promise<boolean>} true si esta cargada (o ya lo estaba).
 */
function cargarExtension3D(url) {
    if (CARGA_EXTENSIONES_3D.has(url)) return CARGA_EXTENSIONES_3D.get(url);

    const promesa = new Promise((resolve) => {
        let yaEsta = false;
        try {
            yaEsta = Array.from(document.querySelectorAll('script[src]'))
                .some((s) => s.src === url);
        } catch (e) {
            yaEsta = false;
        }
        if (yaEsta) {
            resolve(true);
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.onload = () => resolve(true);
        script.onerror = () => {
            console.warn('cambioImpl: no se pudo cargar la extension 3D ' + url);
            resolve(false);
        };
        (document.head || document.documentElement).appendChild(script);
    });

    CARGA_EXTENSIONES_3D.set(url, promesa);
    return promesa;
}

/**
 * Deja cargadas todas las extensiones de capas 3D.
 * @returns {Promise<Array<boolean>>}
 */
function asegurarExtensionesCapas3D() {
    return Promise.all(EXTENSIONES_CAPAS_3D.map((ext) =>
        cargarExtension3D(new URL(ext.ruta, URL_BASE_EXTENSIONES_3D).href)
    ));
}

/**
 * Anade al mapa las extensiones que son plugin (GeoTIFF y MVT) si no estan ya.
 *
 * Se hace justo despues de crear el mapa porque es el primer momento en que
 * existe. Un visualizador que cree capas GeoTIFF/MVT dentro de su `mapa()` las
 * sigue creando despues de su propio `addPlugin` (es el orden que ya tienen
 * GDAL_JS y paroEspMun), asi que aqui solo se cubre el caso de que no lo haga:
 * las capas que se anadan despues del cambio ya encuentran la fachada.
 *
 * @param {Object} map Mapa recien creado (instancia IDEE.Map).
 */
function anadirPluginsCapas3D(map) {
    const IDEE = window.IDEE;
    if (!IDEE || !IDEE.plugin || !map) return;

    let plugins = [];
    try {
        plugins = (typeof map.getPlugins === 'function') ? (map.getPlugins() || []) : [];
    } catch (e) {
        plugins = [];
    }
    const yaPuestos = plugins.map((p) => p && p.name).filter(Boolean);

    EXTENSIONES_CAPAS_3D.forEach((ext) => {
        if (!ext.plugin || yaPuestos.indexOf(ext.plugin) !== -1) return;
        const Clase = IDEE.plugin[ext.plugin];
        if (typeof Clase !== 'function') return;   // la extension no ha cargado
        try {
            map.addPlugin(new Clase());
            yaPuestos.push(ext.plugin);
        } catch (e) {
            console.warn('cambioImpl: no se pudo anadir ' + ext.plugin, e);
        }
    });
}

class miPlugin_cambioImpl {
    constructor(options = {}) {
        this.name = 'miPlugin_cambioImpl';
        this.options = options || {};
        // Orden del botón del plugin dentro del área de botones (el m-area donde se
        // colocan los paneles). Lo aplica la propia API: IDEE.ui.Panel hace
        // style.order sobre el panel, dentro de un flex column, así que el
        // valor es un valor CSS `order` y no un índice (los paneles sin `order`
        // valen 0 y se quedan por delante). Si se omite o no es un número
        // válido, el botón queda donde lo coloca Mapea por defecto (el orden de
        // addPanels / addPlugin).
        this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
          ? Number(options.order)
          : null;
        // Colores configurables. Cada uno puede ser un color (string) o un
        // objeto {active, deactive}:
        //   color1 = fondo, color2 = borde (botón+panel), color3 = icono.
        // Sobrescribibles al instanciar:
        //   new miPlugin_cambioImpl({color1:'#..', color2:'#..', color3:'#..'})
        //   new miPlugin_cambioImpl({color1:{active:'#..',deactive:'#..'}, ...})
        this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
        this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
        this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

        // Referencias que necesita destroy(): el mapa, el panel, el control y
        // el <style> de colores que se inyecta en <head>.
        this._map = null;
        this._panel = null;
        // Barra supraplugin anadida (ver getSupraElement mas abajo).
        this.supra = null;
        this._supraWrap = null;
        this._supraBoton = null;
        this._supraObs = null;
        this._control = null;
        this._styleEl = null;
        this._carga = null;
    }

    /* ------------------------------------------------------------------ *
     * EL ENGRANAJE DE CARGA
     *
     * Por qué está aquí y no en el visualizador
     *
     * El engranaje avisa de UNA sola cosa: de que al cambiar de implementación el
     * mapa se ha recreado entero y hay que esperar. Y quien sabe eso mejor que
     * nadie es este plugin, que es el que tira el mapa y lo vuelve a levantar. Si
     * lo pone el visualizador, cada visualizador con conmutación 2D/3D tiene que
     * acordarse de mostrarlo y de esconderlo en el sitio correcto, y ese "sitio
     * correcto" no existe: hasta que el mapa nuevo no está listo no hay evento
     * al que engancharse.
     *
     * Cuándo se quita
     *
     * No se quita al terminar el cambio de por sí:
     *
     *   - En Cesium, cuando `scene.globe.tilesLoaded` es cierto. Es el aviso de
     *     que ya se han pedido las teselas de terreno e imagen de lo que se ve.
     *     Se mira a cada frame, porque `tilesLoaded` también lo anuncia Cesium
     *     con un evento pero ese evento no está garantizado en este bundle
     *     (medido) y el sondeo no cuesta nada.
     *   - En OpenLayers, cuando el mapa emite COMPLETED, y con un tope de
     *     seguridad por tiempo, porque con `sameMap` el mapa nuevo puede no
     *     llegar a emitirlo nunca.
     *
     * Se quita, en cualquier caso, por `destruirCarga()` desde `destroy()`, para
     * que no se quede ahí puesto si el plugin se desmonta a mitad del cambio.
     * ------------------------------------------------------------------ */

    /**
     * El nodo donde colgar el overlay del engranaje.
     *
     * Se sube desde el contenedor del mapa hasta el elemento que tiene su id (el
     * que `reiniciarMapa()` va a sustituir) y devuelve SU padre, que es lo único
     * que sobrevive al reinicio. Si no se encuentra ese id, se cae al padre del
     * contenedor y, si tampoco, al `body`.
     * @returns {HTMLElement}
     */
    _anfitrionDeCarga() {
        try {
            const contenedor = (this._map && typeof this._map.getContainer === 'function')
                ? this._map.getContainer()
                : document.getElementById('mapa');
            if (!contenedor) return document.body;

            // El id del nodo que se va a reemplazar. Es el mismo cálculo que hace
            // `reiniciarMapa()`: dos niveles por encima, o el propio contenedor.
            const idMapa = (contenedor.parentElement
                && contenedor.parentElement.parentElement
                && contenedor.parentElement.parentElement.id)
                || contenedor.id;

            let nodo = contenedor;
            while (nodo && nodo.parentElement) {
                if (idMapa && nodo.id === idMapa) return nodo.parentElement;
                if (nodo.parentElement === document.body) break;
                nodo = nodo.parentElement;
            }
            return document.body;
        } catch (e) {
            return document.body;
        }
    }

    /**
     * El nodo del mapa que se va a vaciar al reiniciar, o null.
     *
     * Es el que calcula `reiniciarMapa()`: dos niveles por encima del
     * contenedor, o el propio contenedor.
     * @returns {HTMLElement|null}
     */
    _nodoDelMapa() {
        try {
            const contenedor = (this._map && typeof this._map.getContainer === 'function')
                ? this._map.getContainer()
                : document.getElementById('mapa');
            if (!contenedor) return null;
            const arriba = contenedor.parentElement && contenedor.parentElement.parentElement;
            return (arriba && arriba.id) ? arriba : contenedor;
        } catch (e) {
            return null;
        }
    }

    /**
     * Pone el engranaje. Idempotente.
     * @param {string} [mensaje] No se pinta: se queda como atributo `title` para
     *   poder leerlo en el inspector sin ensuciar la pantalla.
     */
    mostrarCarga(mensaje) {
        try {
            this._destruirCarga();

            const div = document.createElement('div');
            div.className = 'm-cambioImpl-carga';
            div.setAttribute('role', 'status');
            div.setAttribute('aria-label', mensaje || 'Cambiando de implementación');
            if (mensaje) div.title = mensaje;

            // El engranaje es `img/iconos/gear-spinner.svg` y entra tal cual: el
            // fichero ya trae su `<animateTransform>`, que gira el dibujo dentro
            // (por eso NO hay animación CSS aquí: sería dos giros encima).
            const img = document.createElement('img');
            img.className = 'm-cambioImpl-carga-gear';
            img.setAttribute('src', URL_ENGRANAJE);
            img.setAttribute('alt', '');
            img.setAttribute('aria-hidden', 'true');

            div.appendChild(img);

            // Se cuelga del nodo que `reiniciarMapa()` NO toca.
            //
            // `reiniciarMapa()` hace `oldDiv.innerHTML = ''` y luego quita y
            // vuelve a poner el div del mapa. Ese div es
            // `map.getContainer().parentElement.parentElement` (o el propio
            // contenedor si no tiene id), y TODO lo que cuelgue de él se
            // desaparece con él. Medido: colgar el overlay del
            // `parentElement` del contenedor, que era lo obvious, no vale de
            // nada, porque ese padre es el `.ol-viewport` de Cesium/OpenLayers
            // y está DENTRO de `#mapa`: el engranaje se evaporaba a los
            // segundos, justo en el tramo en que más hace falta.
            //
            // Así que se sube hasta el nodo que tiene el id del mapa (el que se
            // va a reemplazar) y se cuelga de SU padre, que es lo primero que
            // sobrevive al reinicio.
            const padre = this._anfitrionDeCarga();
            padre.appendChild(div);

            // Y APAGA EL MAPA VIEJO AHORA MISMO, en el mismo frame del clic.
            //
            // El engranaje, solo, no bastaba: se veía el mapa viejo por debajo
            // (medido: el div del mapa no se vacía hasta 2604 ms, que es cuando
            // `reiniciarMapa()` lo hace, y el velo del engranaje es
            // semitransparente). Es decir, parecía que seguía en la
            // implementación original durante casi tres segundos, que es
            // justo lo que se quería evitar.
            //
            // VACIARLO, NO: se oculta con `visibility: hidden`, y es a
            // propósito por dos motivos medidos.
            //
            //  - Vaciarlo rompe el reinicio. `reiniciarMapa()` saca el id del
            //    nodo del mapa subiendo desde `map.getContainer()`
            //    (`parentElement.parentElement.id`). Al vaciar, ese contenedor
            //    queda sin padre, el id sale `undefined`,
            //    `getElementById(undefined)` devuelve null y el reinicio revienta.
            //  - Y no hace falta: `visibility: hidden` saca el mapa de pantalla
            //    en el mismo frame sin tocar el árbol, así que los objetos de la
            //    API (que no cuelgan del DOM) siguen vivos mientras
            //    `capturarTodo` los lee, que es justo lo que va a pasar a
            //    continuación.
            const nodoMapa = this._nodoDelMapa();
            let visibilidadPrevia = '';
            if (nodoMapa) {
                visibilidadPrevia = nodoMapa.style.visibility || '';
                nodoMapa.style.visibility = 'hidden';
            }

            this._carga = {
                div: div,
                padre: padre,
                nodoMapa: nodoMapa,
                visibilidadPrevia: visibilidadPrevia,
                mapa: null,
                stop: false,
                timer: null,
                alSalir: null,
            };
        } catch (e) {
            // El engranaje es un aviso, nunca un motivo para romper el cambio.
            console.warn('cambioImpl: no se pudo mostrar el engranaje de carga', e);
        }
    }

    /** Quita el engranaje. Idempotente. */
    ocultarCarga() {
        this._destruirCarga();
    }

    _destruirCarga() {
        const c = this._carga;
        this._carga = null;
        if (!c) return;
        c.stop = true;
        if (c.timer) { clearTimeout(c.timer); c.timer = null; }
        if (c.mapa && typeof c.mapa.removeEventListener === 'function' && c.alSalir) {
            try { c.mapa.removeEventListener(c.alSalir); } catch (e) { /* ignora */ }
        }
        if (c.div && c.div.parentNode) {
            try { c.div.parentNode.removeChild(c.div); } catch (e) { /* ignora */ }
        }
        // El mapa viejo se ocultó al poner el engranaje. En el camino normal ya no
        // está en el DOM (`reiniciarMapa()` lo sustituyó por uno nuevo), así que
        // esto no hace nada; se deja por si el cambio falla a mitad y se vuelve
        // al mapa de antes, que entonces tiene que ser visible otra vez.
        if (c.nodoMapa) {
            try {
                if (c.nodoMapa.parentNode) {
                    c.nodoMapa.style.visibility = c.visibilidadPrevia || '';
                }
            } catch (e) { /* ya no está */ }
        }
    }

    /**
     * Espera a que el mapa nuevo esté listo y quita el engranaje.
     * @param {Object} newMap Mapa ya creado.
     * @param {number} [timeout=25000] Tope de seguridad, en milisegundos.
     */
    _esperarMapaListo(newMap, timeout) {
        const c = this._carga;
        if (!c) return;
        const limite = timeout || 25000;
        const t0 = Date.now();

        c.mapa = newMap;
        if (this._carga !== c) return;   // se mostró otro en medio: este ya no vale

        const terminar = () => {
            if (this._carga !== c) return;
            this._destruirCarga();
        };

        // OpenLayers avisa con COMPLETED. En Cesium ese mismo evento llega antes
        // de que las teselas estén, así que no sirve solo: de ahí el sondeo.
        //
        // OJO con engancharse TARDE. `reiniciarMapa()` ya ha awaited la creación
        // del mapa nuevo, así que COMPLETED puede haberse emitido ANTES de que
        // lleguemos aquí, y engancharse tarde se pierde el evento entero. Por eso
        // el sondeo no es un extra: es la red que cubre ese hueco.
        const evt = (window.IDEE || window.M) && (window.IDEE || window.M).evt;
        if (evt && evt.COMPLETED && newMap && typeof newMap.on === 'function') {
            c.alSalir = evt.COMPLETED;
            try { newMap.on(evt.COMPLETED, terminar); } catch (e) { c.alSalir = null; }
        }

        const comprobar = () => {
            if (this._carga !== c) return;
            if (Date.now() - t0 > limite) { this._destruirCarga(); return; }

            let listo = false;
            try {
                const impl = newMap && typeof newMap.getMapImpl === 'function'
                    ? newMap.getMapImpl()
                    : null;
                const escena = impl && impl.scene;
                if (escena && escena.globe) {
                    // El globo y las teselas cargadas: es el estado bueno.
                    listo = Boolean(escena.globe.tilesLoaded);
                } else if (impl) {
                    // OpenLayers: `getLoadingOrNotReady()` es su indicador de
                    // "quedan teselas por pedir o pintar". Es el que vale.
                    //
                    // Lo que se probó antes y NO vale, por si vuelve a tentarse:
                    //  - `impl.loaded()` no existe en el impl de la API.
                    //  - `renderer.frameState_` sale SIEMPRE `null` en el bundle
                    //    minificado (medido), así que nunca se cumpliría.
                    //  - "la vista tiene centro" da por bueno el mapa a los
                    //    200 ms, con los cuadros de tesela todavía sin pintar
                    //    (medido en la captura de la vuelta a 2D).
                    if (typeof impl.getLoadingOrNotReady === 'function') {
                        listo = !impl.getLoadingOrNotReady();
                    } else {
                        // Este impl no lo dice (si alguien cambia de
                        // implementación): se acepta la vista con destino, que es
                        // el mínimo, y el tope de seguridad cubre el resto.
                        const vista = typeof impl.getView === 'function' ? impl.getView() : null;
                        listo = Boolean(vista && typeof vista.getCenter === 'function'
                            && vista.getCenter());
                    }
                }
            } catch (e) {
                listo = false;
            }

            if (listo) this._destruirCarga();
            else c.timer = setTimeout(comprobar, 120);
        };

        c.timer = setTimeout(comprobar, 120);
    }

    // Devuelve {active, deactive} a partir de un color simple o un objeto.
    resolveColor(c) {
        return (typeof c === 'object' && c !== null)
            ? { active: c.active, deactive: c.deactive }
            : { active: c, deactive: c };
    }

    // `addTo` será invocado por el framework cuando el plugin se añada al mapa
    addTo(map) {
        this._map = map;

        // Si el visor arranca ya en 3D (el bundle de Cesium va en el
        // index.html, sin pasar por el cambio), las extensiones de capas tienen
        // que quedar cargadas igualmente: el mapa y sus capas ya existen, pero
        // siguen haciendo falta para todo lo que se anada despues.
        if (window.IDEE && window.IDEE.impl && window.IDEE.impl.cesium) {
            asegurarExtensionesCapas3D()
                .then(() => anadirPluginsCapas3D(map))
                .catch(() => { /* cargarExtension3D ya avisa por consola */ });
        }

        const opts = this.options || {};
        const buttonTitle = opts.buttonTitle || 'Herramienta';
        // mapsFunction puede ser:
        // - una función única: se asigna a `mapsFunction.same`
        // - un objeto con `ol` y/o `Cesium` (cada uno puede ser función)
        const mapsFunction = opts.mapsFunction || { ol: undefined, Cesium: undefined };
        if (typeof opts.mapsFunction === 'function') {
            mapsFunction.same = opts.mapsFunction;
        } else if (opts.mapsFunction && typeof opts.mapsFunction === 'object') {
            if (typeof opts.mapsFunction.ol === 'function') mapsFunction.ol = opts.mapsFunction.ol;
            if (typeof opts.mapsFunction.Cesium === 'function') mapsFunction.Cesium = opts.mapsFunction.Cesium;
        }
        const sameMap = opts.sameMap ?? true;
        const shareLayers = opts.shareLayers ?? false;
        const shareView = opts.shareView ?? false;


        const panelExtracontrol_cambImpl = new M.ui.Panel('toolsExtra1_cambImpl', {
            "className": 'm-herramienta_cambImpl',
            "collapsedButtonClass": 'm-tools',
            "position": M.ui.position.TL,
            // `order` lo aplica la propia API: el Panel hace
            // style.order sobre su elemento dentro del area, que es un flex
            // column, y asi coloca el boton dentro de la pila de la esquina.
            "order": this.order
        });

        const htmlPanel =
            `
        <div class="m-control m-herramienta-container_cambImpl">
            <button id="APIIDEE-herramienta-button" class="buttonHerramienta_cambImpl" title="${buttonTitle}"></button>
        </div>
        `

        const control_cambImpl = new M.Control(new M.impl.Control(), 'Control_cambImpl');
        panelExtracontrol_cambImpl.addControls(control_cambImpl);

        // La API compara controles con equals() para retirarlos del panel
        // (M.ui.Panel.removeControls) y del mapa. Sin este método, destroy() ->
        // map.removeControls() revienta con "e.equals is not a function" y el
        // panel se queda colgado en el mapa. Estricto a propósito: un equals laxo
        // ("other instanceof M.Control") desregistraría también los controles de
        // los demás plugins al quitar este.
        control_cambImpl.equals = function (other) {
            return other === this;
        };

        // Referencias que necesita destroy().
        this._panel = panelExtracontrol_cambImpl;
        this._control = control_cambImpl;

        // Con esta línea, se comparte con el objeto window la variable control1
        window.control_cambImpl = control_cambImpl;

        control_cambImpl.createView = (map) => {
            const contenedor = document.createElement('div');
            return contenedor;
        }


        map.addPanels([panelExtracontrol_cambImpl]);

        const div = document.querySelector('.m-herramienta_cambImpl .m-panel-controls');
        div.innerHTML = htmlPanel;

        var btn = document.getElementById('APIIDEE-herramienta-button');

        // Aplicar colores configurables (color1=fondo, color2=borde, color3=icono).
        // Se inyectan 6 variables CSS (estado normal y ".activated") mediante un
        // bloque <style> con ámbito al botón del plugin. Un <style> en <head>
        // sobrevive a los re-renders que IDEE hace del botón / panel (manageActivation
        // o el swap de cambioImpl), por lo que es el método robusto frente a
        // intentar ponerlas inline en addTo (no fiable en baseLayer / cambioImpl).
        var c1 = this.resolveColor(this.color1);
        var c2 = this.resolveColor(this.color2);
        var c3 = this.resolveColor(this.color3);
        var styleId = 'g-plugin-colores-cambioImpl';
        var styleEl = document.getElementById(styleId);
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = styleId;
          styleEl.appendChild(document.createTextNode(
            '.buttonHerramienta_cambImpl,' +
            '.m-herramienta-container_cambImpl{' +
            '--g-plugin-bg-color:' + c1.deactive + ';' +
            '--g-plugin-bg-color-active:' + c1.active + ';' +
            '--g-plugin-border-color:' + c2.deactive + ';' +
            '--g-plugin-border-color-active:' + c2.active + ';' +
            '--g-plugin-icon-color:' + c3.deactive + ';' +
            '--g-plugin-icon-color-active:' + c3.active + ';}' +
            '.buttonHerramienta_cambImpl.activated{' +
            '--g-plugin-bg-color:' + c1.active + ';' +
            '--g-plugin-bg-color-active:' + c1.active + ';' +
            '--g-plugin-border-color:' + c2.active + ';' +
            '--g-plugin-border-color-active:' + c2.active + ';' +
            '--g-plugin-icon-color:' + c3.active + ';' +
            '--g-plugin-icon-color-active:' + c3.active + ';}'
          ));
          (document.head || document.documentElement).appendChild(styleEl);
        }
        this._styleEl = styleEl;
        control_cambImpl.manageActivation(div);

        btn.addEventListener('click', (e) => {

            if (btn.classList.contains('activated')) {
                control_cambImpl.deactivate();
            } else {
                control_cambImpl.activate();
            }
        })

        // Si el visor arranca ya en la implementación Cesium (p. ej.
        // constelaciones o satelites), el botón debe empezar "activado":
        // así el primer click conmuta directamente a OL sin duplicar la
        // inicialización en Cesium.
        if (IDEE.impl && IDEE.impl.cesium) {
            btn.classList.add('activated');
        }

        async function reiniciarMapa(tipo) {
            M = IDEE
            /* ===============================
               3️⃣ REEMPLAZO DEL DIV DEL MAPA
            =============================== */
            var ID_div = map.getContainer().parentElement.parentElement.id || map.getContainer().id
            var oldDiv = document.getElementById(ID_div);

            /* ===============================
               4️⃣ REINICIALIZAR MAPA
            // =============================== */
            oldDiv.innerHTML = '';
            var parent = oldDiv.parentNode;
            var nextSibling = oldDiv.nextSibling;
            var newDIV = document.createElement('div');

            oldDiv.remove();
            parent.insertBefore(newDIV, nextSibling);
            newDIV.id = ID_div;
            // oldDiv.style.height = 'inherit';

            if (sameMap) {
                return mapsFunction.same();
            } else {
                if (tipo == "Cesium") {
                    return mapsFunction.Cesium();
                } else if (tipo == "OL") {
                    return mapsFunction.ol();
                } else {
                    console.error("Tipo no permitido");
                    return
                }
            }
        }

        const porcAltZoom = 2.5

        /**
         * Transfiere capas de Overlaylayers a newMap.
         * Si addExtrusion es true, intentará añadir `extrudedHeight` a opciones de polígono.
         */
        async function transferOverlayLayers(newMap, Overlaylayers, { addExtrusion = false } = {}) {
            for (var i = 0; i < Overlaylayers.length; i++) {
                if (Overlaylayers[i].type == "Vector") {
                    var l_source = await Overlaylayers[i].toGeoJSON();
                    var l = await new IDEE.layer.GeoJSON({
                        source: l_source
                    })
                    var l_styleOpt = await Overlaylayers[i].getStyle().getOptions()
                    var l_style = new IDEE.style.Generic(l_styleOpt)
                    if (addExtrusion) {
                        var opts = l_style.getOptions();
                        if (!opts.polygon) opts.polygon = {};
                        opts.polygon.extrudedHeight = 1000;
                    }

                    await l.setStyle(l_style);
                    await newMap.addLayers(l);

                } else {
                    var existe = await newMap.getLayers().some(layer =>
                        JSON.stringify(layer.constructorParameters?.parameters) ===
                        JSON.stringify(Overlaylayers[i].constructorParameters?.parameters) ||
                        (layer.name === Overlaylayers[i].name && layer.type === Overlaylayers[i].type)
                    );
                    if (!existe) {
                        try {
                            const original = Overlaylayers[i];
                            const l_styleOpt = await original.getStyle().getOptions();
                            const l_style = new IDEE.style.Generic(l_styleOpt);
                            // Añadir la capa al nuevo mapa
                            await newMap.addLayers(original);

                            // Obtener la referencia de la capa ya añadida en newMap
                            let layersList = newMap.getLayers();
                            if (layersList && typeof layersList.then === 'function') layersList = await layersList;

                            const added = (layersList || []).find(layer =>
                                JSON.stringify(layer.constructorParameters?.parameters) ===
                                JSON.stringify(original.constructorParameters?.parameters)
                            ) || (layersList || []).find(layer => layer.name === original.name || layer.legend === original.legend) || original;

                            // Aplicar estilo a la instancia encontrada en newMap
                            if (added && added.setStyle) {
                                const setRes = added.setStyle(l_style);
                                if (setRes && typeof setRes.then === 'function') await setRes;
                            }

                        } catch (error) {
                            console.log(error)
                        }
                    }
                }
            }
        }

        /**
         * Reaplica a newMap el orden relativo (z) que las capas overlay tenian
         * en el mapa original (OL). Al reiniciar el mapa con sameMap, todas las
         * capas se recrean en el orden de creacion original, perdiendo el
         * reorden realizado en el selector de capas. Se asigna a cada capa una
         * posicion normalizada (1..N, mayor arriba) segun su z de origen.
         */
        async function reapplyOverlayOrder(newMap, Overlaylayers) {
            try {
                let layersNew = newMap.getLayers();
                if (layersNew && typeof layersNew.then === 'function') layersNew = await layersNew;
                const list = (layersNew || []).slice();
                if (!list.length) return;

                const paired = [];
                for (const orig of Overlaylayers) {
                    if (!orig) continue;
                    let zOrig = null;
                    try {
                        const implO = (typeof orig.getImpl === 'function') ? orig.getImpl() : null;
                        const ol = implO && implO.olLayer;
                        if (ol && typeof ol.getZIndex === 'function') {
                            const z = ol.getZIndex();
                            if (typeof z === 'number' && isFinite(z)) zOrig = z;
                        }
                        if (zOrig === null && typeof orig.getZIndex === 'function') {
                            const z = orig.getZIndex();
                            if (typeof z === 'number' && isFinite(z)) zOrig = z;
                        }
                    } catch (e) { zOrig = null; }
                    if (zOrig === null) continue;

                    const match = list.find(l =>
                        (l.name === orig.name && l.type === orig.type) ||
                        (orig.constructorParameters && l.constructorParameters &&
                            JSON.stringify(l.constructorParameters.parameters) ===
                            JSON.stringify(orig.constructorParameters.parameters))
                    );
                    if (match && match !== orig) paired.push({ layer: match, zOrig });
                }
                if (!paired.length) return;

                paired.sort((a, b) => (b.zOrig ?? 0) - (a.zOrig ?? 0)); // mayor z = arriba
                const N = paired.length;
                for (let i = 0; i < N; i++) {
                    const target = N - i; // 1..N, el top recibe N
                    const layer = paired[i].layer;
                    const impl = (typeof layer.getImpl === 'function') ? layer.getImpl() : null;
                    const ol = impl && impl.olLayer;
                    try {
                        if (ol && typeof ol.setZIndex === 'function') ol.setZIndex(target);
                        else if (impl && typeof impl.setZIndex === 'function') impl.setZIndex(target);
                        else if (typeof layer.setZIndex === 'function') layer.setZIndex(target);
                    } catch (e) {
                        console.warn('reapplyOverlayOrder setZIndex fallo', e);
                    }
                }
            } catch (e) {
                console.warn('reapplyOverlayOrder fallo', e);
            }
        }

        /**
         * Captura el estado necesario para `shareView` antes del reinicio.
         * mode: 'activate' (a Cesium) | 'deactivate' (a OL)
         */
        function captureShareViewState(mode) {
            if (!shareView) return null;
            try {
                const center = map.getCenter();
                if (!center) return null;

                if (mode === 'activate') {
                    const zoom = map.getZoom();
                    const zoomInt = parseInt(zoom);
                    const zoomInt1 = zoomInt + 1;
                    const altitudeZoomInt = map.zoom_meters[zoomInt];
                    const altitudeZoomInt1 = map.zoom_meters[zoomInt1];
                    const zoomFrac = zoom - zoomInt;
                    const altitude = altitudeZoomInt + zoomFrac * (altitudeZoomInt1 - altitudeZoomInt);
                    try { localStorage.setItem("EPSG_OL", map.getProjection().code); } catch (e) { }
                    return { p1: [center.x, center.y], altitude, srcProj: map.getProjection && map.getProjection() && map.getProjection().code };
                } else {
                    const altitude = map.getZoom(true, true) * porcAltZoom;
                    var zoomInt = null;
                    var altitudeZoomInt = null;
                    var altitudeZoomInt1 = null;

                    for (var i = 0; i < Object.values(map.zoom_meters).length - 1; i++) {
                        if (
                            map.zoom_meters[i] >= altitude &&
                            map.zoom_meters[i + 1] <= altitude
                        ) {
                            zoomInt = i;
                            altitudeZoomInt = map.zoom_meters[i];
                            altitudeZoomInt1 = map.zoom_meters[i + 1];
                            break;
                        }
                    }

                    if (zoomInt === null) {
                        return null;
                    }

                    var zoomFrac = (altitude - altitudeZoomInt) / (altitudeZoomInt1 - altitudeZoomInt);
                    var zoom = zoomInt + zoomFrac;
                    return { p1: [center.x, center.y], zoom, srcProj: map.getProjection && map.getProjection() && map.getProjection().code };
                }
            } catch (e) {
                console.warn('captureShareViewState fallo', e);
                return null;
            }
        }

        async function applyShareViewState(newMap, state, mode) {
            if (!shareView || !state) return;
            try {
                const srcProj = state.srcProj || localStorage.getItem("EPSG_OL") || "EPSG:3857";
                const targetProj = (mode === 'activate') ? "EPSG:4326" : (localStorage.getItem("EPSG_OL") || "EPSG:3857");
                if (!state.p1) return;
                const p1_t = await IDEE.utils.reproject(state.p1, srcProj, targetProj);
                await newMap.setCenter(p1_t);
                if (mode === 'activate' && state.altitude !== undefined) {
                    newMap.setZoom(state.altitude / porcAltZoom, true);
                } else if (mode === 'deactivate' && state.zoom !== undefined) {
                    await newMap.setZoom(Number(state.zoom));
                }
            } catch (e) {
                console.warn('applyShareViewState fallo', e);
            }
        }

        /* Atajos de uso interno, para no repetir `this.` dentro de activate y
           deactivate. Enganchan el engranaje a esta misma instancia del plugin. */
        const mostrarEngranaje = (mensaje) => this.mostrarCarga(mensaje);
        const ocultarEngranaje = () => this.ocultarCarga();
        const esperarMapaListo = (newMap) => this._esperarMapaListo(newMap);

        control_cambImpl.activate = async () => {
            // console.log('Activado');

            var tipo = "Cesium"

            // El engranaje va ANTES de nada: a partir de `cambioImpl()` el mapa
            // viejo deja de existir y durante un rato no hay nada que mirar.
            mostrarEngranaje('Cambiando a 3D...');

            try {
                // Capturar el estado de los plugins ANTES de destruir el mapa.
                const estadoPlugins = (window.EstadoPlugins) ? window.EstadoPlugins.capturarTodo(map) : {};

                const shareStateBefore = captureShareViewState('activate');

                if (shareLayers) {
                    var Overlaylayers = await map.getOverlayLayers();
                    var BaseLayers = await map.getBaseLayers();
                }


                await cambioImpl(tipo);
                var newMap = await reiniciarMapa(tipo);
                // Extensiones de capas 3D que son plugin (GeoTIFF, MVT): si el
                // visualizador no las ha anadido en su mapa(), se anaden aqui.
                anadirPluginsCapas3D(newMap);
                btn = await document.getElementById('APIIDEE-herramienta-button');
                await btn.classList.add("activated");

                await applyShareViewState(newMap, shareStateBefore, 'activate');

                if (shareLayers) {
                    var mapaCesium = newMap.getMapImpl()
                    mapaCesium.scene.globe.depthTestAgainstTerrain = true;
                    await transferOverlayLayers(newMap, Overlaylayers, { addExtrusion: true });
                    // Reaplicar el orden que tenian las capas en OL (el reinicio con
                    // sameMap las recrea en orden de creacion original y pierde el
                    // reorden realizado en el selector de capas).
                    await reapplyOverlayOrder(newMap, Overlaylayers);
                    // El panel del selector de capas quedo renderizado en el orden
                    // de creacion (el reapplyOrder solo mueve dataSources, no el
                    // DOM de la lista), asi que se fuerza su re-render para que
                    // muestre el orden por z ya corregido sin necesidad de togglear.
                    if (window.renderLayerList && typeof window.renderLayerList === 'function') {
                        await window.renderLayerList();
                    }
                }

                // Restaurar el estado de los plugins sobre el mapa nuevo (despues
                // de transferir capas para que el selector de capas las encuentre).
                if (window.EstadoPlugins && Object.keys(estadoPlugins).length) {
                    window.EstadoPlugins.restaurarTodo(newMap, estadoPlugins, true);
                }

                // Y ahora sí, a esperar a que serellenen las teselas del globo.
                esperarMapaListo(newMap);
            } catch (e) {
                ocultarEngranaje();
                throw e;
            }
        }



        control_cambImpl.deactivate = async () => {

            // console.log('Desactivado');
            var tipo = "OL"

            mostrarEngranaje('Cambiando a 2D...');

            try {
                // Capturar el estado de los plugins ANTES de destruir el mapa.
                const estadoPlugins = (window.EstadoPlugins) ? window.EstadoPlugins.capturarTodo(map) : {};

                const shareStateBefore = captureShareViewState('deactivate');



                map.getMapImpl().scene.globe.pickWorldCoordinates = function () { };

                if (shareLayers) {
                    var Overlaylayers = await map.getOverlayLayers();
                    var BaseLayers = await map.getBaseLayers();
                }


                await cambioImpl(tipo);

                var newMap = await reiniciarMapa(tipo);

                btn = await document.getElementById('APIIDEE-herramienta-button');
                await btn.classList.remove("activated");

                await applyShareViewState(newMap, shareStateBefore, 'deactivate');

                if (shareLayers) {
                    await transferOverlayLayers(newMap, Overlaylayers, { addExtrusion: false });
                }

                // Restaurar el estado de los plugins sobre el mapa nuevo.
                if (window.EstadoPlugins && Object.keys(estadoPlugins).length) {
                    window.EstadoPlugins.restaurarTodo(newMap, estadoPlugins, true);
                }

                esperarMapaListo(newMap);
            } catch (e) {
                ocultarEngranaje();
                throw e;
            }
        }

        async function cambioImpl(tipo) {
            // console.log(tipo)

            async function loadConfig(tipo) {
                const config_c = IDEE.config
                return new Promise((resolve, reject) => {
                    const interval = setInterval(() => {

                        if (tipo == "Cesium") {
                            if (IDEE.impl.cesium == undefined) {
                                return
                            }
                        } else if (tipo == "OL") {
                            if (IDEE.impl.ol == undefined) {
                                return
                            }
                        }

                        clearInterval(interval);
                        IDEE.config = config_c
                        resolve(IDEE.config);
                        return


                    }, 100); // Check every 100ms

                });
            }


            const olJS = ".ol.min.js";
            const cesiumJS = ".cesium.min.js";

            const olCSS = ".ol.min.css";
            const cesiumCSS = ".cesium.min.css";

            const a3D = tipo === "Cesium";

            // Las extensiones de capas 3D se cargan ANTES de recargar el bundle.
            // Sus parches se re-aplican solos (sondeo de 10 ms y evento `load`
            // del <script> del bundle), asi que quedan puestos en la build nueva
            // antes de que corra `mapa()` y cree las capas base.
            if (a3D) await asegurarExtensionesCapas3D();


            const jsFrom = a3D ? olJS : cesiumJS;
            const jsTo = a3D ? cesiumJS : olJS;

            const cssFrom = a3D ? olCSS : cesiumCSS;
            const cssTo = a3D ? cesiumCSS : olCSS;

            /* ===============================
               1️⃣ RECARGA DE SCRIPTS JS
            =============================== */
            const scriptNodes = Array.from(document.querySelectorAll('script[src]'));
            for (const oldScript of scriptNodes) {

                if (
                    oldScript.src.includes(jsFrom) //|| oldScript.src.includes("configuration.js")
                ) {
                    const newScript = document.createElement('script');
                    newScript.src = oldScript.src
                        .replace(jsFrom, jsTo)
                    newScript.defer = true;

                    const parent = oldScript.parentNode;
                    const nextSibling = oldScript.nextSibling;

                    oldScript.remove();
                    parent.insertBefore(newScript, nextSibling);

                    IDEE.config = await loadConfig(tipo)
                }

            }

            // Tras recargar el bundle, window.IDEE es un objeto nuevo con
            // IDEE.plugin vacio; repoblar los namespaces desde los globales
            // miPlugin_* (los unicos registros que sobreviven al swap).
            reRegistrarPluginsTrasSwap();


            /* ===============================
               2️⃣ RECARGA DE CSS
            =============================== */
            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                if (
                    link.href.includes(cssFrom)
                ) {
                    link.href = link.href
                        .replace(cssFrom, cssTo)
                }
            });

        }


    }
        // ── Item del supraplugin: el boton vive en la barra, el del mapa se esconde ──
        // Colgado con `supra.addItem(this)`, la barra pone aqui el boton y el del
        // mapa (BUTTON.buttonHerramienta_cambImpl) deja de verse: un solo mando.
        // El boton no abre ningun panel (este plugin no lo tiene), asi que aqui no
        // hay nada que alternar.
        //
        // El boton lleva las clases .supra-bar__boton de la barra (asi hereda el
        // tema y el color de marca por las variables --supra-*) y su icono es el
        // MISMO que el del mapa, porque las dos reglas CSS comparten declaracion
        // (ver cambioImpl.css).
        getSupraElement(supra) {
          this.supra = supra || null;
          this._supraWrap = this._construirSupraUI();
          this._ocultarBotonDelMapa();
          this._sincronizarSupra();
          return this._supraWrap;
        }

        // Construye el boton de la barra y lo engancha al del mapa: este plugin
        // marca el suyo con la clase "activated" cuando esta en 3D (medido), asi que
        // se copia esa clase al boton de la barra con un observador. Asi el boton
        // de la barra se enciende al cambiar de implementacion sin tocar el codigo
        // que ya enciende el otro.
        _construirSupraUI() {
          const self = this;
          const wrap = document.createElement("div");
          wrap.className = "cambio-supra__wrap";

          const btn = document.createElement("button");
          btn.type = "button";
          // Con `conTexto` en el constructor de la barra el boton lleva tambien
          // su etiqueta; sin ella es solo icono (y cuadrado, por --solo).
          const conTexto = !!(this.supra && this.supra.options && this.supra.options.conTexto);
          btn.className = 'supra-bar__boton ' + (conTexto ? '' : 'supra-bar__boton--solo ') + 'cambio-supra__boton';
          const nombre = this.options.buttonTitle || "Cambiar de implementacion";
          btn.title = nombre;
          btn.setAttribute("aria-label", nombre);
          btn.setAttribute("aria-pressed", "false");

          const icono = document.createElement("span");
          icono.className = "supra-bar__boton-icono cambio-supra__icono";
          icono.setAttribute("aria-hidden", "true");

          btn.appendChild(icono);
            if (conTexto) {
              const texto = document.createElement("span");
              texto.className = "supra-bar__boton-texto";
              texto.textContent = btn.title;
              btn.appendChild(texto);
            }

          wrap.appendChild(btn);
          this._supraBoton = btn;

          // El boton de la barra llama al del mapa, que es quien sabe cambiar de
          // implementacion: el click se propaga al original en lugar de duplicar
          // aqui la logica del swap.
          btn.addEventListener("click", function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            const original = document.getElementById("APIIDEE-herramienta-button");
            if (original) { original.click(); return; }
            console.warn("[miPlugin_cambioImpl] no se encuentra el boton del mapa.");
          });

          return wrap;
        }

        _sincronizarSupra() {
          if (!this._supraBoton) return;
          const original = document.getElementById("APIIDEE-herramienta-button");
          const activo = !!(original && original.classList.contains("activated"));
          this._supraBoton.classList.toggle("supra-bar__boton--activo", activo);
          this._supraBoton.setAttribute("aria-pressed", activo ? "true" : "false");

          // El boton del mapa se reconstruye en cada swap, asi que el observador se
          // vuelve a colgar en el que haya ahora.
          if (this._supraObs) { try { this._supraObs.disconnect(); } catch (e) { /* ignora */ } this._supraObs = null; }
          if (!original || typeof MutationObserver === "undefined") return;
          const self = this;
          this._supraObs = new MutationObserver(function () { self._sincronizarSupra(); });
          this._supraObs.observe(original, { attributes: true, attributeFilter: ["class"] });
        }

        _ocultarBotonDelMapa() {
          const el = this._elementoPanel();
          if (el) el.classList.add("g-panel-en-barra");
        }

        _destruirSupra() {
          if (this._supraObs) { try { this._supraObs.disconnect(); } catch (e) { /* ignora */ } }
          this._supraObs = null;
          const el = this._elementoPanel();
          if (el) el.classList.remove("g-panel-en-barra");
          if (this._supraWrap && this._supraWrap.parentNode) {
            this._supraWrap.parentNode.removeChild(this._supraWrap);
          }
          this._supraWrap = null;
          this._supraBoton = null;
          this.supra = null;
        }

        // MEDIDO: IDEE.ui.Panel no expone getElement(); trae getButtonPanel() y el
        // campo _element. Se van probando los dos caminos.
        _elementoPanel() {
          const pan = this._panel;
          if (!pan) return null;
          try { if (pan._element) return pan._element; } catch (e) { /* sigue */ }
          try {
            const btn = (typeof pan.getButtonPanel === "function") ? pan.getButtonPanel() : null;
            if (btn && btn.parentElement) return btn.parentElement;
          } catch (e) { /* sigue */ }
          return null;
        }


    /**
     * Destruccion. map.removePlugins() de la API la exige: sin este metodo
     * lanza "t.destroy is not a function" y ABORTA el resto del lote de plugins
     * que se estuvieran quitando.
     *
     * Solo retira la UI de este plugin (el boton 2D/3D y su panel): su
     * activate/deactivate no se tocan, asi que el mapa sigue siendo valido y el
     * resto de plugins puede seguir desmontandose con normalidad. Lo que hay
     * que soltar ademas del control es el <style> de colores, que se metio en
     * <head> con un id propio y se queda ahi para siempre.
     */
    destroy() {
        this._destruirSupra();
        // El engranaje es de este plugin: si se desmonta a mitad de un cambio no
        // se queda puesto tapando el mapa.
        this._destruirCarga();

        try {
            if (this._map && this._control) this._map.removeControls([this._control]);
        } catch (e) { /* Si el mapa o el control ya no estan */ }

        // El <style> de colores se inyecta una sola vez por id: se quita solo
        // si es el que creo esta instancia (puede haberlo creado otra anterior
        // que se dismantelo antes).
        if (this._styleEl && this._styleEl.parentNode) {
            try { this._styleEl.parentNode.removeChild(this._styleEl); } catch (e) { /* ignora */ }
        }

        // El control se compartia con el resto del visor por window: se retira
        // solo si sigue siendo el de esta instancia.
        if (typeof window !== 'undefined' && window.control_cambImpl === this._control) {
            try { delete window.control_cambImpl; } catch (e) { window.control_cambImpl = null; }
        }

        this._styleEl = null;
        this._control = null;
        this._panel = null;
        this._map = null;
    }
}

// Exponer la clase en los namespaces IDEE.plugin y M.plugin (y global directo).
// El global directo (window.miPlugin_cambioImpl) es el que sobrevive al
// reinicio de window.IDEE que este mismo plugin hace al alternar 2D/3D, y es
// la fuente que usa reRegistrarPlugins() para repoblar los namespaces nuevos.
if (typeof window !== 'undefined') {
    window.miPlugin_cambioImpl = miPlugin_cambioImpl;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_cambioImpl = miPlugin_cambioImpl;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_cambioImpl = miPlugin_cambioImpl;
}

// Repuebla los namespaces IDEE.plugin y M.plugin con las clases expuestas como
// globals directos (window.miPlugin_*). Se invoca tras recargar el bundle de
// la API al alternar 2D/3D, porque cada build recrea window.IDEE (y window.M)
// desde cero y pierde los registros hechos al cargar la pagina. Los globals
// directos NO dependen del objeto IDEE, asi que sobreviven al swap y son la
// fuente fiable para volver a registrarlos en la build nueva.
function reRegistrarPluginsTrasSwap() {
    const apiIDEE = window.IDEE || window.M;
    if (!apiIDEE) return;
    apiIDEE.plugin = apiIDEE.plugin || {};
    // Recorre los globals que empiezan por "miPlugin_" y son clases (function).
    Object.keys(window).forEach((k) => {
        if (k.indexOf('miPlugin_') === 0 && typeof window[k] === 'function') {
            apiIDEE.plugin[k] = window[k];
            if (window.M && window.M.plugin) {
                window.M.plugin[k] = window[k];
            }
        }
    });
    // Y los REGISTROS que los plugins cuelgan de la API y que la build nueva se
    // queda sin ellos, que es un agujero distinto: el de las clases lo cubre el
    // bucle de arriba, pero un registro colgado aparte (window.IDEE.catalog, el
    // de tipos de catalogo) no. Se cuelgan con la convencion de un global
    // window.mi* que sea un objeto con una funcion exponer(), y se recorren
    // igual, para no tener que tocar este fichero cada vez que un plugin anada
    // uno. Sin esto, MapaBase reventaba al volver a 3D con
    // "Cannot read properties of undefined (reading 'IDEE')" en
    // `new IDEE.catalog.IDEE()`, que se llevaba por delante mapa(), plugins y
    // boton de cambio (medido).
    Object.keys(window).forEach((k) => {
        if (k.indexOf('mi') !== 0 || !window[k] || typeof window[k] !== 'object') return;
        if (typeof window[k].exponer === 'function') {
            try {
                window[k].exponer();
            } catch (e) {
                console.warn('[cambioImpl] al reponer ' + k + ':', e);
            }
        }
    });
}

/* =====================================================================
   5️⃣ COORDINADOR DE ESTADO DE PLUGINS ENTRE IMPLEMENTACIONES (OL <-> Cesium)
   =====================================================================
   Problema transversal: al alternar 2D/3D, este plugin recarga el bundle de
   la API y re-ejecuta mapa(), que recrea el mapa y re-instancia todos los
   plugins desde cero. Cada plugin pierde así su estado actual (paso activo
   del storymap, panel colapsado, grupos del selector de capas, modo de
   estereoscopia, gas seleccionado, etc.).

   Solución: un contrato uniforme y opcional por plugin, que cada extensión
   implementa si quiere conservar su estado:
     plugin.getState()            -> objeto serializable con el estado actual
     plugin.setState(state, map)  -> rehidrata la instancia nueva con ese
                                      estado (map es el mapa recién creado)

   Este coordinador es el ÚNICO punto que ve el mapa viejo (al capturar,
   antes del swap) y el mapa nuevo (al restaurar, tras reiniciar). Además
   admite un registro externo (adapters) para plugins que no se puedan
   tocar o que prefieran declarar su captura/restauración fuera de la clase.

   Los plugins que NO implementen el contrato se ignoran sin error
   (migración incremental): la ausencia de getState/setState simplemente
   se salta. El propio cambioImpl se excluye siempre de la captura.

   window.EstadoPlugins se guarda en window para que sobreviva al swap
   (el objeto window NO se recrea; solo se recarga el bundle de la API).
   ===================================================================== */
if (typeof window !== 'undefined' && !window.EstadoPlugins) {
    const estadoAdaptadores = {}; // nombrePlugin -> { capturar(plugin) -> state, restaurar(plugin, state, map) }

    window.EstadoPlugins = {
        /**
         * Registra un adaptador de estado para un plugin que no implemente
         * el contrato getState/setState directamente.
         * @param {string} nombre Nombre del plugin (p. ej. 'miPlugin_storymap')
         * @param {Object} adapter { capturar(plugin) -> state, restaurar(plugin, state, map) }
         */
        registrar(nombre, adapter) {
            if (!nombre || !adapter) return;
            estadoAdaptadores[nombre] = adapter;
        },

        /**
         * Captura el estado de todos los plugins del mapa viejo.
         * Prueba primero plugin.getState(); si no existe, busca en el registro.
         * @param {Object} mapViejo Mapa antes del swap (instancia IDEE.Map)
         * @returns {Object} Mapa nombrePlugin -> estado capturado
         */
        capturarTodo(mapViejo) {
            const estados = {};
            let plugins = [];
            try {
                plugins = (mapViejo && typeof mapViejo.getPlugins === 'function')
                    ? mapViejo.getPlugins()
                    : [];
            } catch (e) {
                plugins = [];
            }
            (plugins || []).forEach((plugin) => {
                if (!plugin || !plugin.name) return;
                // El propio cambioImpl no se captura.
                if (plugin.name === 'miPlugin_cambioImpl' || plugin.name === 'cambioImpl') return;
                const nombre = plugin.name;
                try {
                    if (typeof plugin.getState === 'function') {
                        const st = plugin.getState();
                        if (st !== undefined && st !== null) estados[nombre] = st;
                    } else if (estadoAdaptadores[nombre] && typeof estadoAdaptadores[nombre].capturar === 'function') {
                        const st = estadoAdaptadores[nombre].capturar(plugin);
                        if (st !== undefined && st !== null) estados[nombre] = st;
                    }
                } catch (e) {
                    console.warn(`EstadoPlugins: no se pudo capturar estado de ${nombre}`, e);
                }
            });
            return estados;
        },

        /**
         * Restaura el estado capturado en los plugins del mapa nuevo.
         * @param {Object} mapNuevo Mapa tras el swap (instancia IDEE.Map)
         * @param {Object} estados Mapa nombrePlugin -> estado (de capturarTodo)
         * @param {boolean} [diferido=false] Si true, la restauración se ejecuta
         *   cuando el mapa nuevo esté completamente cargado (events COMPLETED)
         */
        restaurarTodo(mapNuevo, estados, diferido) {
            if (!estados || !mapNuevo) return;
            const accion = () => {
                let plugins = [];
                try {
                    plugins = (mapNuevo && typeof mapNuevo.getPlugins === 'function')
                        ? mapNuevo.getPlugins()
                        : [];
                } catch (e) {
                    plugins = [];
                }
                (plugins || []).forEach((plugin) => {
                    if (!plugin || !plugin.name) return;
                    const nombre = plugin.name;
                    if (!(nombre in estados)) return;
                    try {
                        if (typeof plugin.setState === 'function') {
                            plugin.setState(estados[nombre], mapNuevo);
                        } else if (estadoAdaptadores[nombre] && typeof estadoAdaptadores[nombre].restaurar === 'function') {
                            estadoAdaptadores[nombre].restaurar(plugin, estados[nombre], mapNuevo);
                        }
                    } catch (e) {
                        console.warn(`EstadoPlugins: no se pudo restaurar estado de ${nombre}`, e);
                    }
                });
            };
            if (diferido) {
                // Restaura cuando el mapa nuevo emita COMPLETED (y reintento tardío
                // por si el evento ya se disparó o nunca llega).
                let ejecutada = false;
                const disparar = () => {
                    if (ejecutada) return;
                    ejecutada = true;
                    accion();
                };
                try {
                    const evt = (window.IDEE || window.M)?.evt;
                    if (evt && evt.COMPLETED && typeof mapNuevo.on === 'function') {
                        mapNuevo.on(evt.COMPLETED, disparar);
                    }
                } catch (e) { /* si falla, se usa el reintento */ }
                setTimeout(disparar, 1200);
            } else {
                accion();
            }
        }
    };
}
