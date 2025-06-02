miPlugin = new M.Plugin()
miPlugin.name = "MiPlugin"

const valueOri = "-- Seleccione un tipo de malla --"

miPlugin.getHelp = () => {
    return {
        title: 'Mi Plugin Personalizado',
        content: new Promise((success) => {
            let html = '<div><p>Información del plugin</p></div>';
            html = M.utils.stringToHtml(html);
            success(html);
        }),
    };
}


const panelExtra = new M.ui.Panel('toolsExtra', {
    "collapsible": true,
    "collapsed": false,
    "className": 'g-herramienta',
    "collapsedButtonClass": 'm-tools',
    "position": M.ui.position.TL
});

const htmlPanel =
    `
  <div aria-label="Plugin View Management" role="menuitem" id="div-contenedor-herramienta" class="m-control m-container m-herramienta">
      <header 
          role="heading" 
          tabindex="0" 
          id="m-herramienta-title"
          class="m-herramienta-header">
            Georreferenciar Teselas
      </header>
      <section id="m-herramienta-previews" class="m-herramienta-previews">

      </section>
      <div id="m-herramienta-contents"></div>
  </div>
  `

const controlToast = new M.Control(new M.impl.Control(), 'controlToast');

controlToast.createView = (map) => {
    const contenedor = document.createElement('div');
    return contenedor;
}


miPlugin.addTo = (map) => {

    miPlugin.panel = panelExtra

    panelExtra.addControls(controlToast);

    map.addPanels(panelExtra);
    document.querySelector('.g-herramienta .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents').appendChild(controlToast.getElement());

    document.querySelector('.g-herramienta .m-panel-controls').innerHTML = htmlPanel;

    // Para hacer movible el panel desde el título
    M.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title');


    controlToast.activate = () => {

    }

    controlToast.deactivate = () => {

    }

    panelExtra.addControls(controlToast);

    panelExtra.getControls().forEach((btn) => {
        htmlControl = `
            <h4> Selector de malla: </h4>
            <div id="selectorWrapperID">
            <select class="seleccionCapasClass" id="seleccionCapasID" name="seleccionCapas">
                <option value="TMS">TMS</option>
                <option value="XYZ">XYZ</option>
                <option value="H3">H3</option>
            </select>
             <h4> Selección de tesela</h4>
             <div id="teselaWrapperID">
             </div>
            <div style="text-align: center;margin: 10px;">
                <button id="botonCalcular" type="button">Georreferenciar</button>
            </div>
        `

        map.on(M.evt.COMPLETED, () => {

            // Guarda la selección actual antes de sobrescribir el HTML
            let selectedValue = "TMS";
            const selectorOld = document.getElementById('seleccionCapasID');
            if (selectorOld) {
                selectedValue = selectorOld.value;
            }

            document.querySelector('#m-herramienta-contents').innerHTML = htmlControl;

            const selector = document.querySelector('.seleccionCapasClass');
            const teselaWrapper = document.getElementById('teselaWrapperID');
            if (selector && teselaWrapper) {
                // Restaura la selección previa
                selector.value = selectedValue;

                selector.addEventListener('change', function (e) {
                    switch (e.target.value) {
                        case 'TMS':
                            teselaWrapper.innerHTML = ` <div>
                                                            <label style="font-size: large; display: block;">{z} :  <input id="TMS_z" type="text" placeholder="valor z de la tesela" style="width:auto;"></label>
                                                            <label style="font-size: large; display: block;">{x} :  <input id="TMS_x" type="text" placeholder="valor x de la tesela" style="width:auto;"></label>    
                                                            <label style="font-size: large; display: block;">{-y}: <input id="TMS_y" type="text" placeholder="valor -y de la tesela" style="width:auto;"></label>
                                                        </div>`;
                            break;
                        case 'XYZ':
                            teselaWrapper.innerHTML =` <div>
                                                            <label style="font-size: large; display: block;">{z}: <input id="XYZ_z" type="text" placeholder="valor z de la tesela" style="width:auto;"></label>
                                                            <label style="font-size: large; display: block;">{x}: <input id="XYZ_x" type="text" placeholder="valor x de la tesela" style="width:auto;"></label>    
                                                            <label style="font-size: large; display: block;">{y}: <input id="XYZ_y" type="text" placeholder="valor y de la tesela" style="width:auto;"></label>
                                                        </div>`;
                            break;
                        case 'H3':
                            teselaWrapper.innerHTML = '<label style="font-size: large; display: block;">H3: <input id="H3_id" type="text" placeholder="ID de la tesela H3" style="width:auto;"></label>';
                            break;
                        default:
                            teselaWrapper.innerHTML = '';
                    }
                });
                // Trigger para valor inicial (con la selección restaurada)
                selector.dispatchEvent(new Event('change'));
            }

            document.getElementById('botonCalcular').addEventListener('click', myFunctionGetGrid);
        });
    })

}

function myFunctionGetGrid() {

    gridType = document.getElementById("seleccionCapasID").value
    switch (gridType) {
                        case 'TMS':
                            z = parseInt(document.getElementById("TMS_z").value)
                            x = parseInt(document.getElementById("TMS_x").value)
                            y = parseInt(document.getElementById("TMS_y").value) 
                            gjson = tmsTileToGeoJSON(z, x, y)
                            break;
                        case 'XYZ':
                            z = parseInt(document.getElementById("XYZ_z").value)
                            x = parseInt(document.getElementById("XYZ_x").value)
                            y = parseInt(document.getElementById("XYZ_y").value) 
                            gjson = xyzTileToGeoJSON(z, x, y)
                            
                            break;
                        case 'H3':
                            h3Index = document.getElementById("H3_id").value
                            gjson = h3ToGeoJSON(h3Index) 
                            break;
                        default:
                            break;
                    }
    layer = new M.layer.GeoJSON({
        source: gjson,
        extract: true,
    })
    estilo = new M.style.Generic({
        polygon: {
            fill: {
                color: 'red',
                opacity: 0.2,
            },
            stroke: {
                color: 'orange',
                width: 4
            },
            label: {
                // Texto etiqueta. fijo|función|atributo
                text: '{{label}}',
                scale: 5,
                color: 'white',
                align: M.style.align.CENTER,
                baseline: M.style.baseline.MIDDLE,
            }
        }
    });

    layer.setStyle(estilo)

    mapajs.addLayers(layer);

    layer.on(M.evt.LOAD, (features) => {
        mapajs.setBbox(layer.getFeaturesExtent())
    });

    return
}



