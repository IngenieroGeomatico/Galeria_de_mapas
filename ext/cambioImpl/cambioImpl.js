
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