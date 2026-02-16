
miPlugin_cambioImpl = new M.Plugin()
miPlugin_cambioImpl.name = "miPlugin_cambioImpl"

miPlugin_cambioImpl.addTo = (map) => {

    const panelExtracontrol_cambImpl = new M.ui.Panel('toolsExtra1_cambImpl', {
        "className": 'm-herramienta_cambImpl',
        "collapsedButtonClass": 'm-tools',
        "position": M.ui.position.TL
    });

    const htmlPanel =
        `
        <div class="m-control m-herramienta-container_cambImpl">
            <button id="m-herramienta-button" class="buttonHerramienta_cambImpl" title="Herramienta"></button>
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

    div = document.querySelector('.m-herramienta_cambImpl .m-panel-controls')
    div.innerHTML = htmlPanel

    btn = document.querySelector('.buttonHerramienta_cambImpl')

    divPanelol = document.querySelector('.ol-overlaycontainer-stopevent')

    control_cambImpl.manageActivation(div);

    btn.addEventListener('click', (e) => {

        if (btn.classList.contains('activated')) {
            control_cambImpl.deactivate();
        } else {
            control_cambImpl.activate();
        }
    })


    function reiniciarMapa() {
        M = IDEE
        /* ===============================
           3️⃣ REEMPLAZO DEL DIV DEL MAPA
        =============================== */
        const ID_div = map.getContainer().parentElement.parentElement.id || map.getContainer().id
        const oldDiv = document.getElementById(ID_div);

        /* ===============================
           4️⃣ REINICIALIZAR MAPA
        // =============================== */
        oldDiv.innerHTML = '';
        parent = oldDiv.parentNode;
        nextSibling = oldDiv.nextSibling;
        const newDIV = document.createElement('div');

        oldDiv.remove();
        parent.insertBefore(newDIV, nextSibling);
        newDIV.id = ID_div;
        // oldDiv.style.height = 'inherit';
        mapa(); // tu función de arranque
    }



    control_cambImpl.activate = async () => {
        console.log('Activado');

        await cambioImpl("3D");

        await reiniciarMapa();

        btn.classList.add("activated");
    };

    control_cambImpl.deactivate = async () => {

        console.log('Desactivado');

        mapajs.getMapImpl().scene.globe.pickWorldCoordinates = function () { }

        await cambioImpl("2D");

        await reiniciarMapa();

        btn.classList.remove("activated");
    }



    async function cambioImpl(tipo) {
        console.log(tipo)

        async function loadConfig(tipo) {
            config_c = IDEE.config
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {

                    if (tipo == "3D") {
                        if (IDEE.impl.cesium == undefined) {
                            return
                        }
                    } else if (tipo == "2D") {
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

        const a3D = tipo === "3D";


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

                parent = oldScript.parentNode;
                nextSibling = oldScript.nextSibling;

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



