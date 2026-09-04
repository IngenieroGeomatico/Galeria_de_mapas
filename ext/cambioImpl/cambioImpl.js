
class miPlugin_cambioImpl {
    constructor(options = {}) {
        this.name = 'miPlugin_cambioImpl';
        this.options = options || {};
        // Colores configurables. Cada uno puede ser un color (string) o un
        // objeto {active, deactive}:
        //   color1 = fondo, color2 = borde (botón+panel), color3 = icono.
        // Sobrescribibles al instanciar:
        //   new miPlugin_cambioImpl({color1:'#..', color2:'#..', color3:'#..'})
        //   new miPlugin_cambioImpl({color1:{active:'#..',deactive:'#..'}, ...})
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

    // `addTo` será invocado por el framework cuando el plugin se añada al mapa
    addTo(map) {
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
            "position": M.ui.position.TL
        });

        const htmlPanel =
            `
        <div class="m-control m-herramienta-container_cambImpl">
            <button id="APIIDEE-herramienta-button" class="buttonHerramienta_cambImpl" title="${buttonTitle}"></button>
        </div>
        `

        const control_cambImpl = new M.Control(new M.impl.Control(), 'Control_cambImpl');
        panelExtracontrol_cambImpl.addControls(control_cambImpl);

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
        control_cambImpl.manageActivation(div);

        btn.addEventListener('click', (e) => {

            if (btn.classList.contains('activated')) {
                control_cambImpl.deactivate();
            } else {
                control_cambImpl.activate();
            }
        })

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
                        JSON.stringify(Overlaylayers[i].constructorParameters?.parameters)
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

        control_cambImpl.activate = async () => {
            // console.log('Activado');

            var tipo = "Cesium"

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
            }
        }



        control_cambImpl.deactivate = async () => {

            // console.log('Desactivado');
            var tipo = "OL"

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
}

// Exponer la clase en el namespace `IDEE.plugin.miPlugin_cambioImpl`
if (typeof window !== 'undefined') {
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_cambioImpl = miPlugin_cambioImpl;
}