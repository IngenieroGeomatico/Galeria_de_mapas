


miPlugin = new M.Plugin()
miPlugin.name = "MiPlugin"

const valueOri = "-- Seleccione una capa para filtrar --"

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
            Filtrar capas
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
            <h4> Selector de capa: </h4>
            <div id="selectorWrapperID">
            <select class="seleccionCapasClass" id="seleccionCapasID" name="seleccionCapas">
                <option value="1">----</option>
                <option value="2">....</option>
            </select>
             <h4> Filtrado de capa por </h4>
             <input type="text" id="nameSearch" name="nameSearch" placeholder="Texto a buscar" required />
            </div>
             <button id="botonCalcular" onclick="myFunctionFilterLayer()" type="button">Filtrar</button> 
             <!--<button id="botonLimpiar" onclick="myFunctionFilterLayerClean()" type="button">Limpiar filtrado</button>  -->
             
        `

        map.on(M.evt.COMPLETED, () => {

            (async function checkForIncrease() {
                flag = true
                previousValue = -99
                while (flag) { // Salimos del bucle si no aumenta en 5 iteraciones
                    currentValue = map.getLayers().length;

                    if (currentValue > previousValue) {
                        // Simulamos un tiempo de espera para no saturar el bucle
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } else {
                        flag = false
                    }

                    previousValue = currentValue;
                }

                const legends = mapajs.getLayers()
                    .filter(capa => capa.displayInLayerSwitcher && capa.isBase == false && capa.filterID) // Filtrar capas que tengan la propiedad 'legend'
                    .map(capa => capa.getImpl().legend).reverse();
                selector = miPlugin.panel.getTemplatePanel().querySelector("#seleccionCapasID")
                selector.innerHTML = ""
                
                var option = document.createElement("option");
                option.text = valueOri;
                option.value = valueOri;
                selector.add(option);
                legends.forEach((element) => {
                    if (element.includes(' -//- ')) {
                        // pass
                    } else {
                        var option = document.createElement("option");
                        option.text = element;
                        option.value = element;
                        selector.add(option);
                    }

                });
            })();
        });

        document.querySelector('#m-herramienta-previews').innerHTML += htmlControl
    })

}


async function myFunctionFilterLayer() {
    SVGCarga.hidden = false;

    // Espera un ciclo de evento para que el navegador actualice el DOM
    M.toast.warning('Filtrando capa . . .', null, 2000);
    await new Promise(resolve => setTimeout(resolve, 100));

    selector = miPlugin.panel.getTemplatePanel().querySelector("#seleccionCapasID")
    value = selector.value
    if(value==valueOri){
        M.toast.warning('Seleccione una capa para realizar un filtro', null, 2000);
        SVGCarga.hidden = true
        return
    }
    capaSeleccionada = mapajs.getLayers().filter(capa => capa.getImpl().legend == value)[0]

    //se crea un filtro personalizado
    textoaBuscar = document.getElementById("nameSearch").value

    let filter = new M.filter.Function(feature => {
        if (capaSeleccionada.filterID=="Placas Stolpersteine"){
            return feature.getAttribute('nombre_completo').indexOf(textoaBuscar) >= 0;
        } else if (capaSeleccionada.filterID=="Placas conmemorativas"){
            return feature.getAttribute('Comentario').indexOf(textoaBuscar) >= 0;
        }else if (capaSeleccionada.filterID=="Monumentos"){
            return feature.getAttribute('organization')['organization-desc'].indexOf(textoaBuscar) >= 0;
        }
    });

    // capaSeleccionada.setFilter(filter);
    
    let Filtrados = filter.execute(capaSeleccionada.getFeatures());
    capaVectorial = new M.layer.Vector({ 
            name: capaSeleccionada.legend + ' - ' +textoaBuscar,
            legend: capaSeleccionada.legend + ' - ' +textoaBuscar,
            extract:true,
            attribution: {
                name: capaSeleccionada.legend +" :",
                description: " <a style='color: #0000FF' href='https://datos.madrid.es/portal/site/egob' target='_blank'>Ayuntamiento de Madrid</a> "
              }
    });

    // capaVectorial.filterID = capaSeleccionada.filterID
    mapajs.addLayers(capaVectorial)
    for (const elemento of Filtrados) {
        capaVectorial.addFeatures([elemento])
    }


    try {
        document.querySelector(`[value="Vector-${capaVectorial.legend}"]`).click()
    } catch (error) {
        console.error(error);
    }
    
    
    // console.log(capaSeleccionada.getImpl().legend)

    mapajs.getLayers()
        .filter(objeto => objeto.isBase === false)
        .forEach(objeto => {
            objeto.setVisible(false)
            // if(objeto.legend != '__draw__'){
            //     document.querySelector(`[value="GeoJSON-${capaSeleccionada.legend}"]`).checked = false
            // }
        });

    // await new Promise(resolve => setTimeout(resolve, 100));


    SVGCarga.hidden = true
    capaVectorial.setVisible(true)

    if(ext_LayerSwitcher.collapsed == false){

        while (!`[value="Vector-${capaVectorial.legend}"]`) {
            console.log("Esperando el elemento...");
            await new Promise(resolve => setTimeout(resolve, 500)); // Espera 500ms antes de volver a comprobar
        }
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            document.querySelector(`[value="Vector-${capaVectorial.legend}"]`).click()
        } catch (error) {
            console.error(error);
        }

    }

}


// No se usa debido a lo que tarda en limpiar el filtrado de una capa con cluster
async function myFunctionFilterLayerClean() {
    SVGCarga.hidden = false;

    // Espera un ciclo de evento para que el navegador actualice el DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    
    

    selector = miPlugin.panel.getTemplatePanel().querySelector("#seleccionCapasID")
    value = selector.value
    if(value==valueOri){
        M.toast.warning('Seleccione una capa para realizar un filtro', null, 2000);
        SVGCarga.hidden = true
        return
    }
    capaSeleccionada = mapajs.getLayers().filter(capa => capa.getImpl().legend == value)[0]
    Zindex = capaSeleccionada.getZIndex()

    //se elimina un filtro personalizado
    document.getElementById("nameSearch").value = ""


    // Primra iteración para eliminar filtros:
    // Lo veo inviable hasta que no se solucione quevaya tan lento en la API-IDEE
    // M.toast.warning('Eliminando filtro, esto puede tardar un "poco"', null, 1000);
    // await new Promise(resolve => setTimeout(resolve, 100));
    // estilo2 = new M.style.Generic({
    //     point: {
    //       radius: 5, 
    //       fill: {  
    //         color: 'green',
    //         opacity: 0.5
    //       },
    //       stroke: {
    //         color: '#FF0000'
    //       }
    //     }
    //   });
    // capaSeleccionada.setStyle(estilo2)
    // capaSeleccionada.removeFilter();
    // capaSeleccionada.setStyle(styleCluster_Monumentos)

    // Segunda iteración, añadir una capa nueca con el resultado del filtro: 
    

    SVGCarga.hidden = true
    capaSeleccionada.setVisible(true)

    // await new Promise(resolve => setTimeout(resolve, 500));
    try {
        document.querySelector(`[value="GeoJSON-${capaSeleccionada.legend}"]`).click()
    } catch (error) {
        console.error(error);
    }

    
}


miPlugin_leyenda = new M.Plugin()
miPlugin_leyenda.name = "MiPluginLeyenda"

miPlugin_leyenda.getHelp = () => {
    return {
        title: 'Mi Plugin Personalizado',
        content: new Promise((success) => {
            let html = '<div><p>Información del plugin</p></div>';
            html = M.utils.stringToHtml(html);
            success(html);
        }),
    };
}


const panelExtra_leyenda = new M.ui.Panel('toolsExtra_leyenda', {
    "collapsible": true,
    "className": 'g-herramienta_leyenda',
    "collapsedButtonClass": 'm-tools',
    "position": M.ui.position.BL
});

const htmlPanel_leyenda =
    `
  <div aria-label="Plugin View Management" role="menuitem" id="div-contenedor-herramienta" class="m-control m-container m-herramienta">
      <header 
          role="heading" 
          tabindex="0" 
          id="m-herramienta-htmlPanel_leyenda"
          class="m-herramienta-header">
            Leyenda
      </header>
      <section id="m-herramienta-htmlPanel_leyenda_preview">

      </section>
      <div id="m-herramienta-contents_leyenda"></div>
  </div>
  `

const controlToast_leyenda = new M.Control(new M.impl.Control(), 'controlToast_leyenda');

controlToast_leyenda.createView = (map) => {
    const contenedor = document.createElement('div');
    return contenedor;
}


miPlugin_leyenda.addTo = (map) => {

    miPlugin_leyenda.panel = panelExtra_leyenda

    panelExtra_leyenda.addControls(controlToast_leyenda);

    map.addPanels(panelExtra_leyenda);
    document.querySelector('.g-herramienta_leyenda .m-panel-controls').innerHTML = htmlPanel_leyenda;
    document.querySelector('#m-herramienta-contents_leyenda').appendChild(controlToast_leyenda.getElement());

    document.querySelector('.g-herramienta_leyenda .m-panel-controls').innerHTML = htmlPanel_leyenda;

    // Para hacer movible el panel desde el título
    M.utils.draggabillyPlugin(panelExtra_leyenda, '#m-herramienta-htmlPanel_leyenda');


    controlToast.activate = () => {

    }

    controlToast.deactivate = () => {

    }

    panelExtra.addControls(controlToast);

    panelExtra.getControls().forEach((btn) => {
        htmlControl = `
             <img src="../../img/mapas/leyendaCalidadAire.svg" height="300px"> 
        `
        document.querySelector('#m-herramienta-htmlPanel_leyenda_preview').innerHTML += htmlControl
    })

}


