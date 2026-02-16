
class miPlugin_cambioImpl {
    constructor(options = {}) {
        this.name = 'miPlugin_cambioImpl';
        this.options = options || {};
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
        const sameMap = opts.sameMap || true;
        const shareLayers = opts.shareLayers || false;
        const shareView = opts.shareView || false;


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

        control_cambImpl.activate = async () => {
            console.log('Activado');

            var tipo = "Cesium"

            var bbox = map.getBbox()
            await localStorage.setItem("EPSG_OL", map.getProjection().code);
            var p1 = [bbox.x.min, bbox.y.min];
            var p2 = [bbox.x.max, bbox.y.max];

            await cambioImpl(tipo);

            var newMap = await reiniciarMapa(tipo);
            btn = await document.getElementById('APIIDEE-herramienta-button');
            await btn.classList.add("activated");

            if (shareView) {
                var p1_t = await IDEE.utils.reproject(p1, map.getProjection().code, "EPSG:4326");
                var p2_t = await IDEE.utils.reproject(p2, map.getProjection().code, "EPSG:4326");
                var newBbox = [p1_t[0], p1_t[1], p2_t[0], p2_t[1]];
                await newMap.setBbox(newBbox);
            }


        };

        control_cambImpl.deactivate = async () => {

            console.log('Desactivado');



            var tipo = "OL"

            var bbox = map.getBbox()

            var p1 = [bbox.x.min, bbox.y.min];
            var p2 = [bbox.x.max, bbox.y.max];

            map.getMapImpl().scene.globe.pickWorldCoordinates = function () { };


            await cambioImpl(tipo);

            var newMap = await reiniciarMapa(tipo);

            btn = await document.getElementById('APIIDEE-herramienta-button');
            await btn.classList.remove("activated");

            if (shareView) {

                var p1_t = await IDEE.utils.reproject(p1, map.getProjection().code, localStorage.getItem("EPSG_OL", "EPSG:3857"));
                var p2_t = await IDEE.utils.reproject(p2, map.getProjection().code, localStorage.getItem("EPSG_OL", "EPSG:3857"));

                var newBbox = [p1_t[0], p1_t[1], p2_t[0], p2_t[1]];
                await newMap.setBbox(newBbox);
            }
        }

        async function cambioImpl(tipo) {
            console.log(tipo)

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


            const olJS = "apiidee.ol.min.js";
            const cesiumJS = "apiidee.cesium.min.js";

            const olCSS = "apiidee.ol.min.css";
            const cesiumCSS = "apiidee.cesium.min.css";

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