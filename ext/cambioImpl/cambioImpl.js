

miPlugin_cambioImpl = new M.Plugin()
miPlugin_cambioImpl.name = "miPlugin_cambioImpl "

var M_ori_ol
var M_ori_cesium


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



miPlugin_cambioImpl.addTo = (map) => {

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


    function reiniciarMapa(){
        if (typeof IDEE.impl !== "undefined") {
            M = IDEE
        }
        if (typeof M.impl !== "undefined") {
            IDEE = M

        }
        /* ===============================
           3️⃣ REEMPLAZO DEL DIV DEL MAPA
        =============================== */
        const ID_div = map.getContainer().parentElement.parentElement.id;
        const oldDiv = document.getElementById(ID_div);

        /* ===============================
           4️⃣ REINICIALIZAR MAPA
        // =============================== */
        oldDiv.innerHTML = '';
        // oldDiv.style.height = 'inherit';
        mapa(); // tu función de arranque
    }



    control_cambImpl.activate = async () => {
        console.log('Activado');
        delete window.M

        await cambioImpl("3D");

        await reiniciarMapa();

        btn.classList.add("activated");
    };

    control_cambImpl.deactivate = async () => {

        console.log('Desactivado');
        delete window.IDEE

        await cambioImpl("2D");

        await reiniciarMapa();

        btn.classList.remove("activated");
    }




    async function cambioImpl(tipo) {

        async function loadLibraryInIframe(url) {
            return new Promise((resolve, reject) => {
                const iframe = document.createElement('iframe');
                iframe.id = 'iframeID_apiidee';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                const idoc = iframe.contentDocument || iframe.contentWindow.document;
                idoc.open();
                idoc.write('<!doctype html><html><head></head><body></body></html>');
                idoc.close();

                const script = idoc.createElement('script');
                script.src = url + '?v=' + Date.now();
                idoc.head.appendChild(script);
                script.onload = () => {
                    const interval = setInterval(() => {
                        if (typeof iframe.contentWindow.IDEE !== "undefined") {
                            clearInterval(interval);
                            newM = iframe.contentWindow.IDEE;
                            document.body.removeChild(iframe);
                            resolve(newM);
                            return
                        }
                        if (typeof iframe.contentWindow.M !== "undefined") {
                            clearInterval(interval);
                            newM = iframe.contentWindow.M;
                            document.body.removeChild(iframe);
                            resolve(newM);
                            return
                        }
                    }, 100); // Check every 100ms

                };
                script.onerror = (e) => {
                    try { document.body.removeChild(iframe); } catch (_) {}
                    reject(e);
                };
                
            });
        }

        const buscarBase = "https://componentes.cnig.es/api-core/";
        const reemplazarBase = "https://componentes-desarrollo.idee.es/api-idee/";

        const olJS = "apiign.ol.min.js";
        const cesiumJS = "apiidee.cesium.min.js";

        const olCSS = "apiign.ol.min.css";
        const cesiumCSS = "apiidee.cesium.min.css";

        const a3D = tipo === "3D";

        const baseFrom = a3D ? buscarBase : reemplazarBase;
        const baseTo = a3D ? reemplazarBase : buscarBase;

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
                oldScript.src.includes(baseFrom) &&
                oldScript.src.includes(jsFrom)
            ) {
                const newScript = document.createElement('script');
                newScript.src = oldScript.src
                    .replace(baseFrom, baseTo)
                    .replace(jsFrom, jsTo) + '?v=' + Date.now();
                newScript.defer = true;

                parent = oldScript.parentNode;
                nextSibling = oldScript.nextSibling;

                oldScript.remove();
                parent.insertBefore(newScript, nextSibling);

                M = await loadLibraryInIframe(newScript.src)

            } else if (oldScript.src.includes(baseFrom)){
                const newScript = document.createElement('script');
                newScript.src = oldScript.src
                    .replace(baseFrom, baseTo)
                newScript.defer = true;

                parent = oldScript.parentNode;
                nextSibling = oldScript.nextSibling;

                oldScript.remove();
                parent.insertBefore(newScript, nextSibling);

            }
        }

        
        /* ===============================
           2️⃣ RECARGA DE CSS
        =============================== */

        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            if (
                link.href.includes(baseFrom) &&
                link.href.includes(cssFrom)
            ) {
                link.href = link.href
                    .replace(baseFrom, baseTo)
                    .replace(cssFrom, cssTo)
                    .split('?')[0] + '?v=' + Date.now();
            }
        });

        
    }



}



